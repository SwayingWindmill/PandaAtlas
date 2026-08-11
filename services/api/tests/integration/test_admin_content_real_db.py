from __future__ import annotations

import hashlib
import json
import os
from collections.abc import Iterator
from datetime import UTC, date, datetime, timedelta
from pathlib import Path
from uuid import UUID, uuid4

import psycopg
import pytest
from fastapi import HTTPException
from sqlalchemy import text

from app.admin_content.repository import AdminContentRepository
from app.admin_media.models import AdminMediaUploadReservation
from app.admin_media.repository import AdminMediaUploadRepository
from app.archive_publication.models import AccountablePublishCommand, AccountableValidationCommand
from app.archive_publication.service import publish_change_set, validate_change_set
from app.community_intake.storage import OpaqueStorageReferenceSigner
from app.db.session import configure_database, session_scope
from app.games.guess_repository import GuessPandaRepository
from app.games.models import AdminGuessQuestionInput, GuessAnswerCommand
from app.identity.models import AccountState, RequestIdentity
from app.projection.approved_release_bootstrap import (
    activate_public_projection,
    import_archive_release,
    load_approved_release,
)
from app.projection.postgres_source import load_reviewed_postgres_release
from app.projection.public_release import build_public_release
from app.schemas.admin_content import (
    AdminEvidenceSourceCreate,
    AdminPandaBasicChange,
    AdminPandaCreate,
    AdminPandaEventCreate,
    AdminPandaMediaCreate,
    AdminPandaNameCreate,
    AdminPandaParentCreate,
    AdminPandaResidencyCreate,
)

REPO_ROOT = Path(__file__).resolve().parents[4]


class _MemoryAdminMediaStorage(OpaqueStorageReferenceSigner):
    def __init__(self) -> None:
        super().__init__(signing_key="admin-media-test-signing-key-1234567890")
        self.objects: dict[str, bytes] = {}

    def upload_content(
        self,
        *,
        bucket: str,
        object_key: str,
        content: bytes,
        media_type: str,
    ) -> str:
        _ = bucket, media_type
        self.objects[object_key] = content
        return hashlib.sha256(content).hexdigest()


def _normalize_dsn(value: str) -> str:
    return value.replace("postgresql+psycopg://", "postgresql://", 1)


@pytest.fixture(scope="module")
def real_db_url() -> Iterator[str]:
    if os.getenv("RUN_REAL_DB_TESTS") != "1":
        pytest.skip("Set RUN_REAL_DB_TESTS=1 to run admin content database tests")
    value = os.getenv("REAL_DB_URL") or os.getenv("DATABASE_URL")
    if not value:
        pytest.skip("Set REAL_DB_URL or DATABASE_URL")
    configure_database(value)
    try:
        yield value
    finally:
        configure_database(None)


def _identity(account_id: UUID) -> RequestIdentity:
    now = datetime.now(UTC)
    return RequestIdentity(
        account_id=account_id,
        email="admin-content-test@example.invalid",
        session_id="admin-content-real-db-test",
        state=AccountState.ACTIVE,
        roles=frozenset({"administrator"}),
        capabilities=frozenset(
            {
                "account.session.read",
                "admin.shell.access",
                "identity.role.manage",
                "identity.account.manage",
                "archive.change_set.create",
                "archive.accountable.validate",
                "archive.accountable.publish",
                "archive.accountable.metrics",
                "archive.workbench.read",
            }
        ),
        authenticated_at=now,
        authentication_method="otp",
        issued_at=now,
        expires_at=now + timedelta(hours=1),
        assurance_level="aal1",
        recent_auth=True,
    )


def _create_account(database_url: str, account_id: UUID) -> None:
    email = f"admin-content-{account_id}@example.invalid"
    with psycopg.connect(_normalize_dsn(database_url)) as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                insert into auth.users (
                  instance_id, id, aud, role, email, encrypted_password,
                  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
                  created_at, updated_at
                ) values (
                  '00000000-0000-0000-0000-000000000000', %s, 'authenticated',
                  'authenticated', %s, '', now(),
                  '{"provider":"email","providers":["email"]}', '{}', now(), now()
                )
                """,
                (account_id, email),
            )
            cursor.execute(
                """
                insert into identity.accounts (
                  account_id, email, last_authenticated_at, last_authentication_method
                ) values (%s, %s, now(), 'otp')
                """,
                (account_id, email),
            )
            cursor.execute(
                """
                insert into identity.role_assignments (
                  account_id, role_key, assigned_by_account_id, reason,
                  correlation_id, idempotency_key
                ) values (%s, 'administrator', %s, 'Admin content integration', %s, %s)
                """,
                (account_id, account_id, uuid4(), f"admin-content-role-{account_id}"),
            )
        connection.commit()


def _bootstrap_approved_release(account_id: UUID) -> None:
    bundle = load_approved_release(REPO_ROOT)
    with session_scope() as session:
        assert session is not None
        release_id = import_archive_release(
            session,
            bundle,
            account_id,
            reason="Initialize approved Archive baseline for Admin content test",
        )
        activate_public_projection(
            session,
            bundle,
            release_id,
            account_id,
            reason="Activate approved public baseline for Admin content test",
        )
        session.commit()


def test_administrator_role_inherits_ordinary_content_capabilities(real_db_url: str) -> None:
    with psycopg.connect(_normalize_dsn(real_db_url)) as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                select capability_key
                from identity.role_capabilities
                where role_key = 'administrator'
                order by capability_key
                """
            )
            capabilities = {str(row[0]) for row in cursor.fetchall()}

    assert {
        "archive.change_set.create",
        "archive.accountable.validate",
        "archive.accountable.publish",
        "archive.accountable.metrics",
        "archive.workbench.read",
    }.issubset(capabilities)
    assert "moderation.review" not in capabilities
    assert "privacy.operate" not in capabilities
    assert "archive.sensitive.merge_split" not in capabilities
    assert "game.question.publish" in capabilities
    assert "media.upload" in capabilities


def test_admin_raw_media_upload_stays_private_and_records_sha256(real_db_url: str) -> None:
    account_id = uuid4()
    _create_account(real_db_url, account_id)
    identity = _identity(account_id)
    storage = _MemoryAdminMediaStorage()
    panda_id = uuid4()
    content = b"zhipanda-admin-media-test-bytes"

    with session_scope() as session:
        assert session is not None
        repository = AdminMediaUploadRepository(session, storage)
        reservation = repository.reserve(
            AdminMediaUploadReservation(
                panda_id=panda_id,
                filename="admin-media-test.jpg",
                content_type="image/jpeg",
                byte_size=len(content),
            ),
            identity,
        )
        uploaded = repository.upload(
            reservation.upload_id,
            upload_reference=reservation.upload_reference,
            content=content,
            content_type="image/jpeg",
            identity=identity,
        )
        assert uploaded.state == "uploaded"
        assert uploaded.content_sha256 == hashlib.sha256(content).hexdigest()
        listed = repository.list_for_panda(panda_id)
        assert [item.upload_id for item in listed.items] == [reservation.upload_id]
        public_media_count = session.execute(
            text(
                """
                select count(*)
                from public.entity_revisions revision
                where revision.entity_type = 'media_item'
                  and revision.entity_id = :upload_id
                """
            ),
            {"upload_id": str(reservation.upload_id)},
        ).scalar_one()
        assert int(public_media_count) == 0


def test_failed_panda_validation_can_reopen_to_draft_with_audit(real_db_url: str) -> None:
    account_id = uuid4()
    _create_account(real_db_url, account_id)
    _bootstrap_approved_release(account_id)
    identity = _identity(account_id)
    slug = f"admin-reopen-{str(uuid4())[:8]}"

    with session_scope() as session:
        assert session is not None
        repository = AdminContentRepository(session)
        draft = repository.create_panda_draft(
            AdminPandaCreate(name_zh="重开测试熊猫", slug=slug, gender="unknown"),
            identity,
        )
        change_set = repository.create_basic_change_set(
            draft.id,
            AdminPandaBasicChange(
                name_zh="重开测试熊猫",
                name_en="Reopen Test Panda",
                slug=slug,
                gender="unknown",
                birth_date=None,
                death_date=None,
                status="unknown",
                birthplace=None,
                current_location=None,
                intro=None,
                tags=[],
                is_featured=False,
                reason="Create reopen workflow test",
            ),
            identity,
        )
        session.execute(
            text(
                """
                update public.change_sets
                set status = 'validation_failed',
                    validation_state = 'validation_failed',
                    governance_version = governance_version + 1
                where id = :change_set_id
                """
            ),
            {"change_set_id": change_set.change_set_id},
        )
        session.commit()
        before_version = int(
            session.execute(
                text("select governance_version from public.change_sets where id = :id"),
                {"id": change_set.change_set_id},
            ).scalar_one()
        )
        reopened = repository.reopen_failed_change_set(
            change_set.change_set_id,
            identity=identity,
            reason="Fix failed Panda validation",
        )
        assert reopened.status == "draft"
        assert reopened.governance_version == before_version + 1
        audit_count = session.execute(
            text(
                """
                select count(*) from public.audit_events
                where event_type = 'admin.change_set.reopened'
                  and subject_id = :change_set_id
                """
            ),
            {"change_set_id": str(change_set.change_set_id)},
        ).scalar_one()
        assert int(audit_count) == 1


def test_guess_panda_question_bank_serves_only_published_curated_questions(
    real_db_url: str,
) -> None:
    account_id = uuid4()
    _create_account(real_db_url, account_id)
    _bootstrap_approved_release(account_id)
    identity = _identity(account_id)

    with session_scope() as session:
        assert session is not None
        repository = GuessPandaRepository(session)
        baseline_question = repository.public_question(None)
        assert baseline_question.question_id == UUID("55ad14ea-cc08-4aa2-bba2-4e77823f74db")
        assert len(baseline_question.options) == 4
        session.execute(text("delete from game.guess_questions"))
        session.commit()
        repository = GuessPandaRepository(session)
        pandas = repository._release_index()
        eligible = [
            panda
            for panda in pandas.values()
            if any(
                isinstance(media, dict)
                and media.get("status") == "available"
                and media.get("url")
                for media in panda.get("media", [])
            )
        ]
        assert len(eligible) >= 4
        answer = eligible[0]
        option_ids = [UUID(str(panda["id"])) for panda in eligible[:4]]
        media = next(
            media
            for media in answer["media"]
            if isinstance(media, dict) and media.get("status") == "available" and media.get("url")
        )
        created = repository.create(
            AdminGuessQuestionInput(
                panda_id=UUID(str(answer["id"])),
                media_id=str(media["id"]),
                difficulty="medium",
                option_panda_ids=option_ids,
                recognition_tips=["观察耳朵与脸型"],
            ),
            identity,
        )
        assert created.state == "draft"
        published = repository.publish(created.question_id, identity)
        assert published.state == "published"

    with session_scope() as session:
        assert session is not None
        repository = GuessPandaRepository(session)
        question = repository.public_question("medium")
        assert question.question_id == created.question_id
        assert len(question.options) == 4
        assert not hasattr(question, "answer_panda_id")
        answer_result = repository.answer(
            GuessAnswerCommand(
                question_id=question.question_id,
                selected_panda_id=UUID(str(answer["id"])),
            )
        )
        assert answer_result.correct is True
        assert answer_result.answer.panda_id == UUID(str(answer["id"]))
        listed = repository.list_admin(
            query=None,
            difficulty="medium",
            state="published",
            page=1,
            page_size=20,
        )
        assert listed.items[0].attempt_count == 1
        assert listed.items[0].correct_count == 1
        assert listed.items[0].accuracy == 1.0
        disabled = repository.disable(created.question_id, identity)
        assert disabled.state == "disabled"
        with pytest.raises(HTTPException) as exc_info:
            repository.public_question("medium")
        assert exc_info.value.status_code == 404


def test_panda_admin_flow_keeps_draft_private_and_publishes_through_archive(
    real_db_url: str,
) -> None:
    account_id = uuid4()
    _create_account(real_db_url, account_id)
    _bootstrap_approved_release(account_id)
    identity = _identity(account_id)
    slug = f"admin-flow-{str(uuid4())[:8]}"

    with session_scope() as session:
        assert session is not None
        repository = AdminContentRepository(session)
        draft = repository.create_panda_draft(
            AdminPandaCreate(
                name_zh="后台测试熊猫",
                slug=slug,
                gender="unknown",
            ),
            identity,
        )
        detail = repository.get_panda(draft.id, identity)
        assert detail.panda.publication_state == "draft"
        assert "missing_cover" in detail.quality_issues
        assert "missing_source" in detail.quality_issues
        assert repository.list_pandas(
            query=slug,
            publication_state="draft",
            quality=None,
            issue=None,
            page=1,
            page_size=20,
        ).total == 1

    with psycopg.connect(_normalize_dsn(real_db_url)) as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                "select publication_status from public.panda_slugs where panda_id = %s",
                (draft.id,),
            )
            assert cursor.fetchone()[0] == "draft"
            cursor.execute(
                """
                select count(*)
                from public.publication_batch_change_sets batch_link
                join public.change_set_revisions change_link
                  on change_link.change_set_id = batch_link.change_set_id
                join public.entity_revisions revision on revision.id = change_link.revision_id
                where revision.entity_type = 'panda' and revision.entity_id = %s
                """,
                (str(draft.id),),
            )
            assert int(cursor.fetchone()[0]) == 0

    with session_scope() as session:
        assert session is not None
        repository = AdminContentRepository(session)
        change_set = repository.create_basic_change_set(
            draft.id,
            AdminPandaBasicChange(
                name_zh="后台测试熊猫",
                name_en="Admin Test Panda",
                slug=slug,
                gender="female",
                birth_date=None,
                death_date=None,
                status="alive",
                birthplace=None,
                current_location="测试动物园",
                intro="用于验证 Panda-first 管理后台发布链。",
                tags=["admin-test"],
                is_featured=False,
                reason="Verify product admin publication flow",
            ),
            identity,
        )
        parent_id = UUID(
            str(
                session.execute(
                    text(
                        """
                        select id from public.pandas
                        where id <> :panda_id
                        order by slug
                        limit 1
                        """
                    ),
                    {"panda_id": draft.id},
                ).scalar_one()
            )
        )
        source_id = f"src_admin_{str(uuid4()).replace('-', '')[:12]}"
        repository.add_source(
            draft.id,
            AdminEvidenceSourceCreate(
                source_id=source_id,
                publisher="ZhiPanda Admin Integration",
                title="Admin Panda evidence",
                url=f"https://example.org/{source_id}",
                published_at=date(2026, 8, 11),
                last_verified_at=date(2026, 8, 11),
                language_tag="zh-CN",
                access_state="accessible",
                evidence_tier="primary",
                reason="Add reviewed source for Panda admin integration",
            ),
            identity,
        )
        repository.add_name(
            draft.id,
            AdminPandaNameCreate(
                value="后台宝",
                language_tag="zh-CN",
                name_kind="nickname",
                source_ids=[source_id],
                reason="Add nickname from Panda admin",
            ),
            identity,
        )
        repository.add_parent(
            draft.id,
            AdminPandaParentCreate(
                role="mother",
                parent_id=parent_id,
                status="confirmed",
                source_ids=[source_id],
                reason="Add mother from Panda admin",
            ),
            identity,
        )
        repository.add_residency(
            draft.id,
            AdminPandaResidencyCreate(
                residency_type="primary",
                start_date=date(2026, 8, 11),
                start_precision="unknown",
                coarse_location="测试动物园",
                status="confirmed",
                source_ids=[source_id],
                reason="Add current residency from Panda admin",
            ),
            identity,
        )
        repository.add_event(
            draft.id,
            AdminPandaEventCreate(
                event_type="naming",
                event_date=date(2026, 8, 11),
                event_date_precision="unknown",
                event_status="completed",
                coarse_location="测试动物园",
                source_ids=[source_id],
                reason="Add naming event from Panda admin",
            ),
            identity,
        )
        media_id = f"media_admin_{str(uuid4()).replace('-', '')[:12]}"
        repository.add_media(
            draft.id,
            AdminPandaMediaCreate(
                media_id=media_id,
                source_url=f"https://example.org/{media_id}/source",
                url=f"https://example.org/{media_id}/original.jpg",
                rights="public_domain",
                credit="ZhiPanda Admin Integration",
                alt_zh="后台测试熊猫图片",
                alt_en="Admin test panda image",
                source_ids=[source_id],
                sha256="a" * 64,
                mime_type="image/jpeg",
                width=1200,
                height=800,
                byte_size=1000,
                derivative_url=f"https://example.org/{media_id}/display.webp",
                derivative_sha256="b" * 64,
                derivative_width=960,
                derivative_height=640,
                is_cover=True,
                reason="Register approved Panda media",
            ),
            identity,
        )
        pending = repository.get_panda(draft.id, identity)
        assert any(item.value == "后台宝" for item in pending.names)
        assert any(item.parent_id == parent_id for item in pending.parents)
        assert any(item.start_precision == "unknown" for item in pending.residencies)
        assert any(item.event_type == "naming" for item in pending.events)
        assert any(item.id == media_id and item.is_cover for item in pending.media)
        assert any(item.id == source_id for item in pending.sources)

        repository.refresh_runtime_panda_revisions(change_set.change_set_id, identity)
        base_version = repository.current_archive_version()

    validation = validate_change_set(
        change_set.change_set_id,
        AccountableValidationCommand(
            expected_version=change_set.governance_version,
            idempotency_key=f"validate-{uuid4()}",
            base_archive_version=base_version,
            reason="Validate Panda admin draft",
            risk_level="ordinary",
            correlation_id=uuid4(),
        ),
        identity,
    )
    assert validation.outcome.value == "ready"

    release = publish_change_set(
        change_set.change_set_id,
        AccountablePublishCommand(
            expected_version=validation.governance_version,
            idempotency_key=f"publish-{uuid4()}",
            reason="Publish Panda admin draft",
            data_version=AdminContentRepository.planned_data_version(change_set.change_set_id),
            public_schema_version="1.3.0",
            database_migration_version="0041",
            projection_code_version="public-experience-v1",
            correlation_id=uuid4(),
        ),
        identity,
    )
    assert release.change_set_id == change_set.change_set_id

    projected_release = build_public_release(
        load_reviewed_postgres_release(
            database_url=real_db_url,
            publication_batch_id=release.release_id,
        )
    )
    runtime = json.loads(projected_release.files["api.json"])
    projected_panda = next(item for item in runtime["pandas"] if item["id"] == str(draft.id))
    assert projected_panda["slug"] == slug
    assert projected_panda["name_zh"] == "后台测试熊猫"
    assert projected_panda["name_en"] == "Admin Test Panda"
    assert projected_panda["gender"] == "female"

    with session_scope() as session:
        assert session is not None
        repository = AdminContentRepository(session)
        detail = repository.get_panda(draft.id, identity)
        assert detail.workflow.status == "none"
        assert repository.list_pandas(
            query=slug,
            publication_state="draft",
            quality=None,
            issue=None,
            page=1,
            page_size=20,
        ).total == 1

    with psycopg.connect(_normalize_dsn(real_db_url)) as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                "select status from public.change_sets where id = %s",
                (change_set.change_set_id,),
            )
            assert cursor.fetchone()[0] == "published"
            cursor.execute(
                "select count(*) from public.archive_release_evidence where release_id = %s",
                (release.release_id,),
            )
            assert int(cursor.fetchone()[0]) == 1

from __future__ import annotations

from contextlib import contextmanager
from uuid import UUID

from app.services import panda_service

TAI_SHAN_ID = UUID("96d00a39-7865-55db-b5c2-f339ef692258")
BAO_BAO_ID = UUID("7cf4e916-4801-5b2e-b49b-4e33bb50d5d6")
MEI_XIANG_ID = UUID("2939c16f-1938-5629-928c-b36b1d5cd6ed")
TIAN_TIAN_ID = UUID("38cd1cad-3e34-5511-bc35-a091ece74e11")


class FakeResult:
    def __init__(self, rows: list[dict[str, object]]) -> None:
        self._rows = rows

    def mappings(self) -> FakeResult:
        return self

    def all(self) -> list[dict[str, object]]:
        return self._rows


class FakeSession:
    def __init__(self, rows: list[dict[str, object]]) -> None:
        self.rows = rows
        self.sql = ""

    def execute(self, statement: object, params: dict[str, object]) -> FakeResult:
        assert params["panda_id"] == TAI_SHAN_ID
        self.sql = str(statement)
        return FakeResult(self.rows)


def lineage_row(
    panda_id: UUID,
    slug: str,
    name: str,
    *,
    father_id: UUID | None = None,
    mother_id: UUID | None = None,
) -> dict[str, object]:
    return {
        "id": panda_id,
        "slug": slug,
        "name_zh": name,
        "name_en": None,
        "gender": "unknown",
        "status": "alive",
        "birth_date": None,
        "current_location": None,
        "intro": None,
        "tags": [],
        "father_id": father_id,
        "mother_id": mother_id,
        "cover_image_url": None,
    }


def test_db_lineage_query_requires_public_sources_and_selects_siblings(monkeypatch) -> None:
    session = FakeSession(
        [
            lineage_row(
                TAI_SHAN_ID,
                "tai-shan",
                "泰山",
                father_id=TIAN_TIAN_ID,
                mother_id=MEI_XIANG_ID,
            ),
            lineage_row(
                BAO_BAO_ID,
                "bao-bao",
                "宝宝",
                father_id=TIAN_TIAN_ID,
                mother_id=MEI_XIANG_ID,
            ),
            lineage_row(MEI_XIANG_ID, "mei-xiang", "美香"),
            lineage_row(TIAN_TIAN_ID, "tian-tian", "添添"),
        ]
    )

    @contextmanager
    def fake_session_scope():
        yield session

    monkeypatch.setattr(panda_service, "session_scope", fake_session_scope)

    response = panda_service._get_panda_lineage_from_db(
        TAI_SHAN_ID,
        ancestor_depth=2,
        descendant_depth=2,
    )

    normalized_sql = " ".join(session.sql.lower().split())
    assert "pa.publication_status = 'published'" in normalized_sql
    assert "pa.status = 'confirmed'" in normalized_sql
    assert "join public.public_evidence_sources" in normalized_sql
    assert "siblings as" in normalized_sql
    assert any(
        relationship.subject_id == TAI_SHAN_ID
        and relationship.related_id == BAO_BAO_ID
        and relationship.kind == "sibling"
        for relationship in response.relationships
    )

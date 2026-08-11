from __future__ import annotations

from typing import Any
from uuid import UUID

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.admin_content.repository import AdminContentRepository
from app.schemas.admin_content import AdminCenterDomain, AdminCenterItemRead, AdminCenterRead


class AdminContentCenterService:
    def __init__(self, session: Session) -> None:
        self.session = session
        self.repository = AdminContentRepository(session)

    @staticmethod
    def _panda_name(record: dict[str, Any] | None, fallback: str) -> str:
        if record is None:
            return fallback
        names = [item for item in record.get("names", []) if isinstance(item, dict)]
        for language in ("zh-Hans", "en"):
            for item in names:
                if item.get("language") == language and item.get("primary") and item.get("value"):
                    return str(item["value"])
        return str(
            record.get("name_zh")
            or record.get("name_en")
            or record.get("canonical_slug")
            or fallback
        )

    @staticmethod
    def _uuid(value: str | None) -> UUID | None:
        if not value:
            return None
        try:
            return UUID(value)
        except ValueError:
            return None

    @staticmethod
    def _page(
        domain: AdminCenterDomain,
        items: list[AdminCenterItemRead],
        *,
        query: str | None,
        issue_only: bool,
        page: int,
        page_size: int,
    ) -> AdminCenterRead:
        needle = (query or "").strip().casefold()
        filtered: list[AdminCenterItemRead] = []
        for item in items:
            if issue_only and not item.issue_codes:
                continue
            haystack = " ".join(
                value
                for value in (item.id, item.title, item.subtitle, item.panda_name)
                if value
            ).casefold()
            if needle and needle not in haystack:
                continue
            filtered.append(item)
        filtered.sort(key=lambda item: (not bool(item.issue_codes), item.title.casefold(), item.id))
        total = len(filtered)
        start = (page - 1) * page_size
        return AdminCenterRead(
            domain=domain,
            items=filtered[start : start + page_size],
            total=total,
            page=page,
            page_size=page_size,
            issue_count=sum(1 for item in items if item.issue_codes),
        )

    def list_center(
        self,
        domain: AdminCenterDomain,
        *,
        query: str | None,
        issue_only: bool,
        page: int,
        page_size: int,
    ) -> AdminCenterRead:
        if domain == "users":
            items = self._users()
        else:
            records = self.repository._effective_admin_records()
            pandas = {
                entity_id: public
                for (entity_type, entity_id), public in records.items()
                if entity_type == "panda"
            }
            if domain == "locations":
                items = self._locations(records)
            elif domain == "relationships":
                items = self._relationships(records, pandas)
            elif domain == "events":
                items = self._events(records, pandas)
            elif domain == "images":
                items = self._images(records, pandas)
            else:
                items = self._sources(records)
        return self._page(
            domain,
            items,
            query=query,
            issue_only=issue_only,
            page=page,
            page_size=page_size,
        )

    def _locations(
        self,
        records: dict[tuple[str, str], dict[str, Any]],
    ) -> list[AdminCenterItemRead]:
        items: list[AdminCenterItemRead] = []
        for (entity_type, entity_id), public in records.items():
            if entity_type not in {"facility", "institution", "place"}:
                continue
            title = str(
                public.get("name_zh")
                or public.get("name")
                or public.get("name_en")
                or public.get("canonical_slug")
                or entity_id
            )
            location = " · ".join(
                str(value)
                for value in (
                    public.get("locality"),
                    public.get("province"),
                    public.get("country_code"),
                )
                if value
            )
            issues: list[str] = []
            if not public.get("country_code"):
                issues.append("missing_country")
            if not any(public.get(key) for key in ("name", "name_zh", "name_en")):
                issues.append("missing_name")
            items.append(
                AdminCenterItemRead(
                    id=entity_id,
                    domain="locations",
                    entity_type=entity_type,
                    title=title,
                    subtitle=location
                    or str(public.get("facility_type") or public.get("place_type") or entity_type),
                    state="published",
                    issue_codes=issues,
                    href=f"/archive?subjectType={entity_type}&subjectId={entity_id}",
                )
            )
        return items

    def _relationships(
        self,
        records: dict[tuple[str, str], dict[str, Any]],
        pandas: dict[str, dict[str, Any]],
    ) -> list[AdminCenterItemRead]:
        items: list[AdminCenterItemRead] = []
        for (entity_type, entity_id), public in records.items():
            if entity_type != "parentage_assertion":
                continue
            child_id = str(public.get("child_id") or "")
            parent_id = str(public.get("parent_id") or "")
            child_name = self._panda_name(pandas.get(child_id), child_id or "未知子代")
            parent_name = self._panda_name(pandas.get(parent_id), parent_id or "未知亲本")
            issues: list[str] = []
            if not public.get("source_ids"):
                issues.append("missing_source")
            if public.get("status") == "disputed":
                issues.append("disputed")
            items.append(
                AdminCenterItemRead(
                    id=entity_id,
                    domain="relationships",
                    entity_type=entity_type,
                    title=f"{child_name} ← {parent_name}",
                    subtitle=f"{public.get('role', 'parent')} · {public.get('status', 'unknown')}",
                    state=str(public.get("status") or "unknown"),
                    issue_codes=issues,
                    panda_id=self._uuid(child_id),
                    panda_name=child_name,
                    href=f"/pandas/{child_id}" if child_id else None,
                )
            )
        return items

    def _events(
        self,
        records: dict[tuple[str, str], dict[str, Any]],
        pandas: dict[str, dict[str, Any]],
    ) -> list[AdminCenterItemRead]:
        items: list[AdminCenterItemRead] = []
        for (entity_type, entity_id), public in records.items():
            if entity_type != "event":
                continue
            participants = [str(value) for value in public.get("participants", []) if value]
            panda_id = participants[0] if participants else None
            panda_name = self._panda_name(pandas.get(panda_id or ""), panda_id or "无关联熊猫")
            issues: list[str] = []
            if not public.get("source_ids"):
                issues.append("missing_source")
            if public.get("event_date_precision") == "unknown":
                issues.append("unknown_date_precision")
            if public.get("event_status") == "disputed":
                issues.append("disputed")
            location = (
                public.get("to_coarse_location")
                or public.get("coarse_location")
                or "地点未记录"
            )
            items.append(
                AdminCenterItemRead(
                    id=entity_id,
                    domain="events",
                    entity_type=entity_type,
                    title=f"{panda_name} · {public.get('event_type', 'event')}",
                    subtitle=f"{public.get('event_date', '日期未知')} · {location}"[:300],
                    state=str(public.get("event_status") or "unknown"),
                    issue_codes=issues,
                    panda_id=self._uuid(panda_id),
                    panda_name=panda_name,
                    href=f"/pandas/{panda_id}" if panda_id else None,
                )
            )
        return items

    def _images(
        self,
        records: dict[tuple[str, str], dict[str, Any]],
        pandas: dict[str, dict[str, Any]],
    ) -> list[AdminCenterItemRead]:
        items: list[AdminCenterItemRead] = []
        for (entity_type, entity_id), public in records.items():
            if entity_type != "media_item" or "status" not in public:
                continue
            panda_id = str(public.get("panda_id") or "")
            panda_name = self._panda_name(pandas.get(panda_id), panda_id or "无关联熊猫")
            issues: list[str] = []
            if not public.get("rights"):
                issues.append("unknown_rights")
            if not public.get("source_ids"):
                issues.append("missing_source")
            if public.get("status") == "available" and not public.get("derivatives"):
                issues.append("missing_derivative")
            items.append(
                AdminCenterItemRead(
                    id=entity_id,
                    domain="images",
                    entity_type=entity_type,
                    title=f"{panda_name} · {public.get('credit') or entity_id}",
                    subtitle=(
                        f"{public.get('rights') or 'rights unknown'} · "
                        f"{public.get('status') or 'unknown'}"
                    ),
                    state=str(public.get("status") or "unknown"),
                    issue_codes=issues,
                    panda_id=self._uuid(panda_id),
                    panda_name=panda_name,
                    href=f"/pandas/{panda_id}" if panda_id else None,
                )
            )
        return items

    def _sources(
        self,
        records: dict[tuple[str, str], dict[str, Any]],
    ) -> list[AdminCenterItemRead]:
        items: list[AdminCenterItemRead] = []
        for (entity_type, entity_id), public in records.items():
            if entity_type != "source":
                continue
            issues: list[str] = []
            if public.get("access_state") in {"unavailable", "restricted", "changed"}:
                issues.append("source_access_issue")
            if public.get("evidence_tier") in {None, "unverified"}:
                issues.append("unverified_source")
            items.append(
                AdminCenterItemRead(
                    id=entity_id,
                    domain="sources",
                    entity_type=entity_type,
                    title=str(public.get("title") or entity_id),
                    subtitle=(
                        f"{public.get('publisher') or '发布机构未知'} · "
                        f"{public.get('url') or 'URL 缺失'}"
                    ),
                    state=str(public.get("access_state") or "unknown"),
                    issue_codes=issues,
                    href=f"/archive?subjectType=source&subjectId={entity_id}",
                )
            )
        return items

    def _users(self) -> list[AdminCenterItemRead]:
        rows = self.session.execute(
            text(
                """
                select account.account_id, account.email, account.state::text as state,
                       account.created_at, account.last_authenticated_at,
                       coalesce(
                         array_agg(distinct assignment.role_key)
                           filter (where assignment.assignment_id is not null
                             and revocation.assignment_id is null
                             and (
                               assignment.expires_at is null
                               or assignment.expires_at > now()
                             )),
                         '{}'
                       ) as roles
                from identity.accounts account
                left join identity.role_assignments assignment
                  on assignment.account_id = account.account_id
                left join identity.role_assignment_revocations revocation
                  on revocation.assignment_id = assignment.assignment_id
                group by account.account_id, account.email, account.state,
                         account.created_at, account.last_authenticated_at
                order by account.created_at desc
                """
            )
        ).mappings()
        items: list[AdminCenterItemRead] = []
        for row in rows:
            roles = [str(value) for value in row["roles"]]
            state = str(row["state"])
            issues: list[str] = []
            if state != "active":
                issues.append(f"account_{state}")
            if not roles:
                issues.append("no_role")
            items.append(
                AdminCenterItemRead(
                    id=str(row["account_id"]),
                    domain="users",
                    entity_type="account",
                    title=str(row["email"]),
                    subtitle="角色：" + (", ".join(roles) if roles else "无"),
                    state=state,
                    issue_codes=issues,
                    updated_at=row["last_authenticated_at"] or row["created_at"],
                    href="/moderation" if state != "active" else "/capabilities",
                )
            )
        return items

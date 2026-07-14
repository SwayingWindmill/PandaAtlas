from __future__ import annotations

from dataclasses import dataclass, replace
from datetime import date
from typing import Any, Literal
from uuid import UUID, uuid4

ChangeSetStatus = Literal["draft", "submitted", "approved", "rejected"]
ReviewDecision = Literal["approved", "rejected"]
PreviewCategory = Literal[
    "unresolved_reference",
    "residency_conflict",
    "translation_state",
    "source_availability",
    "license_problem",
]


class WorkflowConflict(ValueError):
    """Raised when an actor requests an invalid workflow transition."""


@dataclass(frozen=True)
class PublicationIssue:
    category: PreviewCategory
    entity_type: str
    entity_id: str
    detail: str


@dataclass(frozen=True)
class PublicationPreview:
    issues: tuple[PublicationIssue, ...]

    @property
    def is_publishable(self) -> bool:
        return not self.issues


@dataclass(frozen=True)
class EntityRevision:
    id: UUID
    entity_type: str
    entity_id: str
    revision_number: int
    payload: dict[str, Any]
    created_by: UUID
    substantive_modified_by: UUID

    @classmethod
    def create(
        cls,
        *,
        entity_type: str,
        entity_id: str,
        payload: dict[str, Any],
        actor_id: UUID,
    ) -> EntityRevision:
        return cls(
            id=uuid4(),
            entity_type=entity_type,
            entity_id=entity_id,
            revision_number=1,
            payload=payload,
            created_by=actor_id,
            substantive_modified_by=actor_id,
        )


@dataclass(frozen=True)
class ChangeSet:
    id: UUID
    title: str
    reason: str
    created_by: UUID
    revisions: tuple[EntityRevision, ...]
    status: ChangeSetStatus = "draft"
    reviewed_by: UUID | None = None
    review_reason: str | None = None

    @classmethod
    def create(
        cls,
        *,
        title: str,
        reason: str,
        actor_id: UUID,
        revisions: tuple[EntityRevision, ...],
    ) -> ChangeSet:
        if not revisions:
            raise WorkflowConflict("A change set must contain at least one revision")
        return cls(
            id=uuid4(),
            title=title,
            reason=reason,
            created_by=actor_id,
            revisions=revisions,
        )

    def submit(self, *, actor_id: UUID) -> ChangeSet:
        if self.status != "draft":
            raise WorkflowConflict("Only a draft change set can be submitted")
        if actor_id != self.created_by:
            raise WorkflowConflict("Only the contributor can submit a change set")
        return replace(self, status="submitted")

    def review(
        self,
        *,
        actor_id: UUID,
        decision: ReviewDecision,
        reason: str,
    ) -> ChangeSet:
        if self.status != "submitted":
            raise WorkflowConflict("Only a submitted change set can be reviewed")
        if decision == "approved" and any(
            revision.substantive_modified_by == actor_id
            for revision in self.revisions
        ):
            raise WorkflowConflict("Approval requires an independent reviewer")
        return replace(
            self,
            status=decision,
            reviewed_by=actor_id,
            review_reason=reason,
        )


def _issue(
    revision: EntityRevision,
    category: PreviewCategory,
    detail: str,
) -> PublicationIssue:
    return PublicationIssue(
        category=category,
        entity_type=revision.entity_type,
        entity_id=revision.entity_id,
        detail=detail,
    )


def preview_revisions(revisions: tuple[EntityRevision, ...]) -> PublicationPreview:
    issues: list[PublicationIssue] = []
    by_panda: dict[str, list[tuple[date, date | None, EntityRevision]]] = {}

    for revision in revisions:
        checks = revision.payload.get("publication_checks")
        if not isinstance(checks, dict):
            for category in (
                "unresolved_reference",
                "residency_conflict",
                "translation_state",
                "source_availability",
                "license_problem",
            ):
                issues.append(_issue(revision, category, "missing_check_manifest"))
            continue

        for reference in checks.get("references", []):
            if isinstance(reference, dict) and not reference.get("resolved", False):
                target_type = reference.get("target_type", "entity")
                target_id = reference.get("target_id", "unknown")
                target = f"{target_type}:{target_id}"
                issues.append(_issue(revision, "unresolved_reference", target))

        residencies = [
            residency
            for residency in checks.get("residencies", [])
            if isinstance(residency, dict)
        ]
        for residency in residencies:
            panda_id = str(residency.get("panda_id", revision.entity_id))
            start_value = residency.get("start_date")
            if not isinstance(start_value, str):
                continue
            end_value = residency.get("end_date")
            try:
                start = date.fromisoformat(start_value)
                end = date.fromisoformat(end_value) if isinstance(end_value, str) else None
            except ValueError:
                issues.append(
                    _issue(revision, "residency_conflict", f"invalid_interval:{panda_id}")
                )
                continue
            by_panda.setdefault(panda_id, []).append((start, end, revision))

        for translation in checks.get("translations", []):
            if isinstance(translation, dict) and translation.get("status") != "approved":
                issues.append(
                    _issue(
                        revision,
                        "translation_state",
                        str(translation.get("language_tag", "unknown")),
                    )
                )

        for source in checks.get("sources", []):
            if isinstance(source, dict) and source.get("access_state") not in {
                "accessible",
                "redirected",
                "archived",
            }:
                issues.append(
                    _issue(
                        revision,
                        "source_availability",
                        str(source.get("id", "unknown")),
                    )
                )

        for media in checks.get("media", []):
            if isinstance(media, dict) and not media.get("license"):
                issues.append(
                    _issue(
                        revision,
                        "license_problem",
                        str(media.get("id", "unknown")),
                    )
                )

    for panda_id, intervals in by_panda.items():
        ordered = sorted(intervals, key=lambda item: item[0])
        for previous, current in zip(ordered, ordered[1:], strict=False):
            if previous[1] is None or current[0] < previous[1]:
                issues.append(
                    _issue(current[2], "residency_conflict", f"overlap:{panda_id}")
                )
                break

    return PublicationPreview(issues=tuple(issues))

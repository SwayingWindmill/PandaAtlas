from __future__ import annotations

from uuid import UUID

from app.domain.archive_relationships import ParentageAssertion, derive_lineage

MEI_XIANG = UUID("2939c16f-1938-5629-928c-b36b1d5cd6ed")
TIAN_TIAN = UUID("38cd1cad-3e34-5511-bc35-a091ece74e11")
TAI_SHAN = UUID("96d00a39-7865-55db-b5c2-f339ef692258")
BAO_BAO = UUID("7cf4e916-4801-5b2e-b49b-4e33bb50d5d6")
BAO_LI = UUID("434e10e3-7ba0-5de7-a59e-d3984524c58c")


def confirmed_parent(
    assertion_id: str,
    *,
    child_id: UUID,
    parent_id: UUID,
    role: str,
) -> ParentageAssertion:
    return ParentageAssertion(
        id=assertion_id,
        child_id=child_id,
        parent_id=parent_id,
        role=role,
        status="confirmed",
        publication_status="published",
        source_ids=("src-reviewed",),
    )


def test_reviewed_parentage_derives_public_family_relationships() -> None:
    graph = derive_lineage(
        (
            confirmed_parent(
                "tai-father",
                child_id=TAI_SHAN,
                parent_id=TIAN_TIAN,
                role="father",
            ),
            confirmed_parent(
                "tai-mother",
                child_id=TAI_SHAN,
                parent_id=MEI_XIANG,
                role="mother",
            ),
            confirmed_parent(
                "bao-bao-father",
                child_id=BAO_BAO,
                parent_id=TIAN_TIAN,
                role="father",
            ),
            confirmed_parent(
                "bao-bao-mother",
                child_id=BAO_BAO,
                parent_id=MEI_XIANG,
                role="mother",
            ),
            confirmed_parent(
                "bao-li-mother",
                child_id=BAO_LI,
                parent_id=BAO_BAO,
                role="mother",
            ),
        )
    )

    assert graph.parents_of(TAI_SHAN) == (MEI_XIANG, TIAN_TIAN)
    assert graph.children_of(MEI_XIANG) == (BAO_BAO, TAI_SHAN)
    assert graph.siblings_of(TAI_SHAN) == (BAO_BAO,)
    assert graph.grandparents_of(BAO_LI) == (MEI_XIANG, TIAN_TIAN)
    assert graph.relationship_path(MEI_XIANG, BAO_LI) == (
        MEI_XIANG,
        BAO_BAO,
        BAO_LI,
    )


def test_unreviewed_or_disputed_parentage_does_not_enter_public_lineage() -> None:
    graph = derive_lineage(
        (
            ParentageAssertion(
                id="unsourced-parent",
                child_id=TAI_SHAN,
                parent_id=TIAN_TIAN,
                role="father",
                status="confirmed",
                publication_status="published",
                source_ids=(),
            ),
            ParentageAssertion(
                id="disputed-parent",
                child_id=TAI_SHAN,
                parent_id=MEI_XIANG,
                role="mother",
                status="disputed",
                publication_status="published",
                source_ids=("src-conflict",),
            ),
        )
    )

    assert graph.parents_of(TAI_SHAN) == ()

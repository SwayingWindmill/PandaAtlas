from uuid import UUID

from fastapi import APIRouter, Path, Query

from app.schemas.panda import PaginatedPandasResponse, PandaDetail, PandaLineageResponse
from app.services.panda_service import get_panda_by_ref, get_panda_lineage_by_ref, list_pandas

router = APIRouter(prefix="/pandas")


@router.get("", response_model=PaginatedPandasResponse)
def list_pandas_endpoint(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    q: str | None = None,
    status: str | None = Query(default=None, pattern="^(alive|deceased|unknown)$"),
    gender: str | None = Query(default=None, pattern="^(male|female|unknown)$"),
    habitat_id: UUID | None = None,
    featured: bool | None = None,
    sort: str = Query(default="created_at_desc"),
) -> PaginatedPandasResponse:
    return list_pandas(
        page=page,
        page_size=page_size,
        q=q,
        status=status,
        gender=gender,
        habitat_id=habitat_id,
        featured=featured,
        sort=sort,
    )


@router.get("/{panda_ref}", response_model=PandaDetail)
def get_panda_endpoint(
    panda_ref: str = Path(..., description="Canonical panda slug or legacy UUID alias")
) -> PandaDetail:
    return get_panda_by_ref(panda_ref)


@router.get("/{panda_ref}/lineage", response_model=PandaLineageResponse)
def get_panda_lineage_endpoint(
    panda_ref: str = Path(..., description="Canonical panda slug or legacy UUID alias"),
    ancestor_depth: int = Query(default=6, ge=0, le=16),
    descendant_depth: int = Query(default=6, ge=0, le=16),
) -> PandaLineageResponse:
    return get_panda_lineage_by_ref(
        panda_ref,
        ancestor_depth=ancestor_depth,
        descendant_depth=descendant_depth,
    )

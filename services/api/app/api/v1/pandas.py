from uuid import UUID

from fastapi import APIRouter, Path, Query

from app.api.v1.release_responses import PUBLIC_RELEASE_RESPONSES
from app.schemas.panda import PaginatedPandasResponse, PandaDetail, PandaLineageResponse
from app.services.release_read_service import (
    get_release_lineage,
    get_release_panda,
    list_release_pandas,
)

router = APIRouter(prefix="/pandas")


@router.get(
    "", response_model=PaginatedPandasResponse, responses=PUBLIC_RELEASE_RESPONSES
)
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
    return list_release_pandas(
        page=page,
        page_size=page_size,
        q=q,
        status=status,
        gender=gender,
        habitat_id=habitat_id,
        featured=featured,
        sort=sort,
    )


@router.get(
    "/{panda_ref}", response_model=PandaDetail, responses=PUBLIC_RELEASE_RESPONSES
)
def get_panda_endpoint(
    panda_ref: str = Path(..., description="Canonical panda slug or legacy UUID alias")
) -> PandaDetail:
    return get_release_panda(panda_ref)


@router.get(
    "/{panda_ref}/lineage",
    response_model=PandaLineageResponse,
    responses=PUBLIC_RELEASE_RESPONSES,
)
def get_panda_lineage_endpoint(
    panda_ref: str = Path(..., description="Canonical panda slug or legacy UUID alias"),
    ancestor_depth: int = Query(default=6, ge=0, le=16),
    descendant_depth: int = Query(default=6, ge=0, le=16),
) -> PandaLineageResponse:
    return get_release_lineage(
        panda_ref,
        ancestor_depth=ancestor_depth,
        descendant_depth=descendant_depth,
    )

from fastapi import APIRouter, Path, Query

from app.api.v1.release_responses import PUBLIC_RELEASE_RESPONSES
from app.schemas.public_experience import (
    PublicFamilyStoryListResponse,
    PublicFamilyStoryResponse,
)
from app.services.public_experience_service import (
    get_public_family_story,
    list_public_family_stories,
)

router = APIRouter(prefix="/family-stories")


@router.get(
    "",
    response_model=PublicFamilyStoryListResponse,
    responses=PUBLIC_RELEASE_RESPONSES,
)
def list_family_stories_endpoint(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
) -> PublicFamilyStoryListResponse:
    return list_public_family_stories(page=page, page_size=page_size)


@router.get(
    "/{story_ref}",
    response_model=PublicFamilyStoryResponse,
    responses=PUBLIC_RELEASE_RESPONSES,
)
def get_family_story_endpoint(
    story_ref: str = Path(..., description="Canonical family-story slug or stable story ID"),
) -> PublicFamilyStoryResponse:
    return get_public_family_story(story_ref)

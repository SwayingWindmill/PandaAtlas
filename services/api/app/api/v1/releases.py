from fastapi import APIRouter

from app.api.v1.release_responses import PUBLIC_RELEASE_RESPONSES
from app.schemas.release import PublicPandaRelease, PublicReleaseMetadata
from app.services.release_service import get_current_panda_release, get_current_release_metadata

router = APIRouter(prefix="/releases")


@router.get(
    "/current", response_model=PublicReleaseMetadata, responses=PUBLIC_RELEASE_RESPONSES
)
def current_release() -> PublicReleaseMetadata:
    return get_current_release_metadata()


@router.get(
    "/current/pandas", response_model=PublicPandaRelease, responses=PUBLIC_RELEASE_RESPONSES
)
def current_panda_release() -> PublicPandaRelease:
    return get_current_panda_release()

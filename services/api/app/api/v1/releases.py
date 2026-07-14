from fastapi import APIRouter

from app.schemas.release import PublicPandaRelease, PublicReleaseMetadata
from app.services.release_service import get_current_panda_release, get_current_release_metadata

router = APIRouter(prefix="/releases")


@router.get("/current", response_model=PublicReleaseMetadata)
def current_release() -> PublicReleaseMetadata:
    return get_current_release_metadata()


@router.get("/current/pandas", response_model=PublicPandaRelease)
def current_panda_release() -> PublicPandaRelease:
    return get_current_panda_release()

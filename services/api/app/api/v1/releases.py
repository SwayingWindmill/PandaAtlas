from fastapi import APIRouter

from app.schemas.release import PublicReleaseMetadata
from app.services.release_service import get_current_release_metadata

router = APIRouter(prefix="/releases")


@router.get("/current", response_model=PublicReleaseMetadata)
def current_release() -> PublicReleaseMetadata:
    return get_current_release_metadata()

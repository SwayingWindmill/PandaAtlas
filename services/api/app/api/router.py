from fastapi import APIRouter

from app.api.v1 import (
    admin_accountable_publications,
    admin_archive_operations,
    admin_archive_workbench,
    admin_audit,
    admin_community_curation,
    admin_imports,
    admin_moderation,
    admin_publications,
    admin_review_content,
    admin_reviews,
    community_intake,
    engagement,
    family_stories,
    feed,
    identity,
    map,
    moderation,
    moments,
    notification,
    pandas,
    privacy,
    releases,
    stats,
)

api_router = APIRouter(prefix="/api/v1")
api_router.include_router(pandas.router, tags=["pandas"])
api_router.include_router(moments.router, tags=["moments"])
api_router.include_router(family_stories.router, tags=["family-stories"])
api_router.include_router(map.router, tags=["map"])
api_router.include_router(stats.router, tags=["stats"])
api_router.include_router(releases.router, tags=["releases"])
api_router.include_router(identity.router, tags=["identity"])
api_router.include_router(engagement.router, tags=["engagement"])
api_router.include_router(feed.router, tags=["feed"])
api_router.include_router(notification.router, tags=["notification"])
api_router.include_router(moderation.router, tags=["moderation"])
api_router.include_router(privacy.router, tags=["privacy"])
api_router.include_router(privacy.admin_router, tags=["admin-privacy"])
api_router.include_router(community_intake.router, tags=["community-intake"])
api_router.include_router(identity.admin_router, tags=["admin-identity"])
api_router.include_router(admin_audit.router, tags=["admin-audit"])
api_router.include_router(admin_imports.router, tags=["admin"])
api_router.include_router(
    admin_accountable_publications.router,
    tags=["admin-accountable-publication"],
)
api_router.include_router(
    admin_archive_operations.router,
    tags=["admin-archive-operations"],
)
api_router.include_router(
    admin_archive_workbench.router,
    tags=["admin-archive-workbench"],
)
api_router.include_router(
    admin_community_curation.router,
    tags=["admin-community-curation"],
)
api_router.include_router(admin_publications.router, tags=["admin-publication"])
api_router.include_router(admin_moderation.router, tags=["admin-moderation"])
api_router.include_router(admin_reviews.router, tags=["admin-review"])
api_router.include_router(admin_review_content.router, tags=["admin-review"])

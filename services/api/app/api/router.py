from fastapi import APIRouter

from app.api.v1 import (
    admin_accountable_publications,
    admin_imports,
    admin_publications,
    admin_review_content,
    admin_reviews,
    community_intake,
    engagement,
    feed,
    identity,
    map,
    notification,
    pandas,
    releases,
    stats,
)

api_router = APIRouter(prefix="/api/v1")
api_router.include_router(pandas.router, tags=["pandas"])
api_router.include_router(map.router, tags=["map"])
api_router.include_router(stats.router, tags=["stats"])
api_router.include_router(releases.router, tags=["releases"])
api_router.include_router(identity.router, tags=["identity"])
api_router.include_router(engagement.router, tags=["engagement"])
api_router.include_router(feed.router, tags=["feed"])
api_router.include_router(notification.router, tags=["notification"])
api_router.include_router(community_intake.router, tags=["community-intake"])
api_router.include_router(identity.admin_router, tags=["admin-identity"])
api_router.include_router(admin_imports.router, tags=["admin"])
api_router.include_router(
    admin_accountable_publications.router,
    tags=["admin-accountable-publication"],
)
api_router.include_router(admin_publications.router, tags=["admin-publication"])
api_router.include_router(admin_reviews.router, tags=["admin-review"])
api_router.include_router(admin_review_content.router, tags=["admin-review"])

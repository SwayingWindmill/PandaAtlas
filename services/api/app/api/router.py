from fastapi import APIRouter

from app.api.v1 import admin_imports, admin_publications, identity, map, pandas, releases, stats

api_router = APIRouter(prefix="/api/v1")
api_router.include_router(pandas.router, tags=["pandas"])
api_router.include_router(map.router, tags=["map"])
api_router.include_router(stats.router, tags=["stats"])
api_router.include_router(releases.router, tags=["releases"])
api_router.include_router(identity.router, tags=["identity"])
api_router.include_router(identity.admin_router, tags=["admin-identity"])
api_router.include_router(admin_imports.router, tags=["admin"])
api_router.include_router(admin_publications.router, tags=["admin-publication"])

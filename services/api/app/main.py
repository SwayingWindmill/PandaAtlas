from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.router import api_router
from app.core.config import settings
from app.db.session import configure_database, database_health
from app.services.release_service import (
    get_current_release_metadata,
    pin_current_release_metadata,
    release_headers,
    reset_current_release_metadata,
)


@asynccontextmanager
async def lifespan(_: FastAPI):
    configure_database(settings.database_url)
    yield


app = FastAPI(
    title="Panda Atlas API",
    version="0.1.0",
    summary="Panda encyclopedia and distribution map backend",
    lifespan=lifespan,
)

@app.middleware("http")
async def attach_public_release(request: Request, call_next):
    path = request.url.path
    is_public_api = path.startswith("/api/v1/") and not path.startswith(
        "/api/v1/admin/"
    )
    metadata = None
    if is_public_api:
        try:
            metadata = get_current_release_metadata()
        except HTTPException as error:
            return JSONResponse(status_code=error.status_code, content={"detail": error.detail})
    token = pin_current_release_metadata(metadata) if metadata is not None else None
    try:
        response = await call_next(request)
    finally:
        if token is not None:
            reset_current_release_metadata(token)
    if metadata is not None:
        for name, value in release_headers(metadata).items():
            response.headers[name] = value
    return response


app.add_middleware(
    CORSMiddleware,
    allow_origins=list(settings.cors_origins()),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=[
        "X-PandaAtlas-Dataset-Version",
        "X-PandaAtlas-Public-Schema-Version",
        "X-PandaAtlas-Database-Migration-Version",
    ],
)


@app.get("/health", tags=["health"])
def health() -> dict[str, str]:
    return {
        "status": "ok",
        "version": app.version,
        "db": database_health(),
    }


app.include_router(api_router)

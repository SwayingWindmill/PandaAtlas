from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.router import api_router
from app.core.config import settings
from app.db.session import configure_database, database_health


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

app.add_middleware(
    CORSMiddleware,
    allow_origins=list(settings.cors_origins()),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health", tags=["health"])
def health() -> dict[str, str]:
    return {
        "status": "ok",
        "version": app.version,
        "db": database_health(),
    }


app.include_router(api_router)

"""Vercel ASGI entrypoint for the authoritative FastAPI application."""

from app.main import app

__all__ = ["app"]

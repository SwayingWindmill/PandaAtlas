from __future__ import annotations

import hashlib
import secrets

_HANDLE_BYTES = 32


def new_opaque_handle() -> str:
    return secrets.token_urlsafe(_HANDLE_BYTES)


def hash_opaque_handle(value: str) -> str:
    if not value or len(value) > 512:
        raise ValueError("opaque handle is invalid")
    return hashlib.sha256(value.encode("utf-8")).hexdigest()

from __future__ import annotations

import pytest
from fastapi import HTTPException

from app.api.v1.admin_moderation import _raise_moderation_database_error


class _OriginalDatabaseError(Exception):
    def __init__(self, message: str, sqlstate: str) -> None:
        super().__init__(message)
        self.sqlstate = sqlstate


class _DatabaseError(Exception):
    def __init__(self, original: Exception) -> None:
        super().__init__(str(original))
        self.orig = original


def test_account_state_ownership_conflict_maps_to_http_409() -> None:
    error = _DatabaseError(
        _OriginalDatabaseError(
            "moderation cannot restore an account suspended by another process",
            "40001",
        )
    )

    with pytest.raises(HTTPException) as raised:
        _raise_moderation_database_error(error)  # type: ignore[arg-type]

    assert raised.value.status_code == 409
    assert raised.value.detail["code"] == "moderation_account_state_ownership_conflict"


def test_unrelated_database_error_is_not_hidden() -> None:
    error = _DatabaseError(_OriginalDatabaseError("connection failed", "08006"))

    with pytest.raises(_DatabaseError) as raised:
        _raise_moderation_database_error(error)  # type: ignore[arg-type]

    assert raised.value is error

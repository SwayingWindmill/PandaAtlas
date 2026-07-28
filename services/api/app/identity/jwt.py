from __future__ import annotations

from collections.abc import Callable, Mapping, Sequence
from datetime import UTC, datetime
from typing import Any
from uuid import UUID

import jwt
from jwt import InvalidSignatureError, InvalidTokenError, PyJWKClient, PyJWKClientError

from app.identity.models import VerifiedSupabaseIdentity


class SupabaseTokenError(ValueError):
    """Raised when a bearer token cannot be trusted as a Supabase user token."""


JWKClientFactory = Callable[[str], PyJWKClient]


def _unix_datetime(value: Any, claim: str) -> datetime:
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        raise SupabaseTokenError(f"JWT claim {claim!r} must be a Unix timestamp")
    return datetime.fromtimestamp(value, tz=UTC)


def _authentication_reference(claims: Mapping[str, Any]) -> tuple[datetime | None, str | None]:
    entries = claims.get("amr")
    if not isinstance(entries, list):
        return None, None

    candidates: list[tuple[datetime, str]] = []
    for entry in entries:
        if not isinstance(entry, Mapping):
            continue
        method = entry.get("method")
        timestamp = entry.get("timestamp")
        if not isinstance(method, str) or method == "token_refresh":
            continue
        try:
            authenticated_at = _unix_datetime(timestamp, "amr.timestamp")
        except SupabaseTokenError:
            continue
        candidates.append((authenticated_at, method))

    if not candidates:
        return None, None
    return max(candidates, key=lambda item: item[0])


class SupabaseJWTVerifier:
    """Verify asymmetric Supabase JWTs against a cached JWKS with one rotation retry."""

    def __init__(
        self,
        *,
        issuer: str,
        audience: str,
        jwks_url: str,
        allowed_algorithms: Sequence[str],
        jwks_cache_seconds: int = 300,
        client_factory: JWKClientFactory | None = None,
    ) -> None:
        normalized_algorithms = tuple(
            dict.fromkeys(algorithm.strip() for algorithm in allowed_algorithms)
        )
        if not normalized_algorithms or any(
            not algorithm for algorithm in normalized_algorithms
        ):
            raise ValueError("At least one JWT algorithm must be configured")
        if any(algorithm.startswith("HS") for algorithm in normalized_algorithms):
            raise ValueError("Symmetric JWT algorithms are not allowed for Supabase user sessions")

        self.issuer = issuer.rstrip("/")
        self.audience = audience
        self.jwks_url = jwks_url
        self.allowed_algorithms = normalized_algorithms
        self.jwks_cache_seconds = jwks_cache_seconds
        self._client_factory = client_factory or self._default_client_factory
        self._client = self._client_factory(self.jwks_url)

    def _default_client_factory(self, url: str) -> PyJWKClient:
        return PyJWKClient(
            url,
            cache_keys=True,
            cache_jwk_set=True,
            lifespan=self.jwks_cache_seconds,
            timeout=5,
        )

    def _decode_once(self, token: str) -> dict[str, Any]:
        try:
            header = jwt.get_unverified_header(token)
        except InvalidTokenError as error:
            raise SupabaseTokenError("Malformed bearer token") from error

        algorithm = header.get("alg")
        key_id = header.get("kid")
        if algorithm not in self.allowed_algorithms:
            raise SupabaseTokenError("Bearer token uses an unsupported signing algorithm")
        if not isinstance(key_id, str) or not key_id:
            raise SupabaseTokenError("Bearer token is missing a signing key identifier")

        signing_key = self._client.get_signing_key_from_jwt(token)
        claims = jwt.decode(
            token,
            signing_key,
            algorithms=[algorithm],
            audience=self.audience,
            issuer=self.issuer,
            options={
                "require": [
                    "iss",
                    "aud",
                    "exp",
                    "iat",
                    "sub",
                    "role",
                    "aal",
                    "session_id",
                    "email",
                    "is_anonymous",
                ],
                "verify_signature": True,
                "verify_exp": True,
                "verify_iat": True,
                "verify_aud": True,
                "verify_iss": True,
            },
        )
        if not isinstance(claims, dict):
            raise SupabaseTokenError("JWT payload must be an object")
        return claims

    def verify(self, token: str) -> VerifiedSupabaseIdentity:
        try:
            claims = self._decode_once(token)
        except (InvalidSignatureError, PyJWKClientError):
            self._client = self._client_factory(self.jwks_url)
            try:
                claims = self._decode_once(token)
            except (InvalidTokenError, PyJWKClientError, SupabaseTokenError) as error:
                raise SupabaseTokenError(
                    "Bearer token signature or signing key is invalid"
                ) from error
        except InvalidTokenError as error:
            raise SupabaseTokenError("Bearer token claims are invalid") from error

        if claims.get("role") != "authenticated" or claims.get("is_anonymous") is not False:
            raise SupabaseTokenError("Bearer token is not an authenticated user session")

        try:
            account_id = UUID(str(claims["sub"]))
        except (ValueError, TypeError) as error:
            raise SupabaseTokenError("JWT subject must be a UUID") from error

        email = claims.get("email")
        session_id = claims.get("session_id")
        assurance_level = claims.get("aal")
        if not isinstance(email, str) or not email.strip():
            raise SupabaseTokenError("JWT email claim is missing")
        if not isinstance(session_id, str) or not session_id:
            raise SupabaseTokenError("JWT session_id claim is missing")
        if assurance_level not in {"aal1", "aal2"}:
            raise SupabaseTokenError("JWT aal claim is invalid")

        authenticated_at, authentication_method = _authentication_reference(claims)
        return VerifiedSupabaseIdentity(
            account_id=account_id,
            email=email.strip().lower(),
            session_id=session_id,
            issued_at=_unix_datetime(claims["iat"], "iat"),
            expires_at=_unix_datetime(claims["exp"], "exp"),
            authenticated_at=authenticated_at,
            authentication_method=authentication_method,
            assurance_level=assurance_level,
            claims=claims,
        )


__all__ = [
    "SupabaseJWTVerifier",
    "SupabaseTokenError",
    "VerifiedSupabaseIdentity",
    "_authentication_reference",
]

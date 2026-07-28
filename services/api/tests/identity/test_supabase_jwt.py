from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import Any
from uuid import uuid4

import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import rsa
from jwt import PyJWKClientError

from app.identity.jwt import SupabaseJWTVerifier, SupabaseTokenError

ISSUER = "https://test.invalid/auth/v1"
AUDIENCE = "authenticated"
KEY_ID = "rotation-fixture"


class StaticJWKClient:
    def __init__(self, verification_key: Any, *, fail: bool = False) -> None:
        self.verification_key = verification_key
        self.fail = fail

    def get_signing_key_from_jwt(self, encoded: str) -> Any:
        _ = encoded
        if self.fail:
            raise PyJWKClientError("rotated key not found")
        return self.verification_key


def build_encoded_session(
    signer: Any,
    *,
    audience: str = AUDIENCE,
    expired: bool = False,
) -> tuple[str, datetime]:
    now = datetime.now(UTC).replace(microsecond=0)
    authenticated_at = now - timedelta(minutes=4)
    claims = {
        "iss": ISSUER,
        "aud": audience,
        "exp": int((now + (-timedelta(minutes=1) if expired else timedelta(hours=1))).timestamp()),
        "iat": int(now.timestamp()),
        "sub": str(uuid4()),
        "role": "authenticated",
        "aal": "aal1",
        "session_id": str(uuid4()),
        "email": "operator@example.test",
        "is_anonymous": False,
        "amr": [
            {"method": "otp", "timestamp": int(authenticated_at.timestamp())},
            {"method": "token_refresh", "timestamp": int(now.timestamp())},
        ],
    }
    encoded = jwt.encode(claims, signer, algorithm="RS256", headers={"kid": KEY_ID})
    return encoded, authenticated_at


def make_signer() -> Any:
    return rsa.generate_private_key(public_exponent=65537, key_size=2048)


def test_verifier_validates_asymmetric_claims_and_uses_non_refresh_amr() -> None:
    signer = make_signer()
    encoded, authenticated_at = build_encoded_session(signer)
    verifier = SupabaseJWTVerifier(
        issuer=ISSUER,
        audience=AUDIENCE,
        jwks_url="https://test.invalid/jwks.json",
        allowed_algorithms=("RS256",),
        client_factory=lambda url: StaticJWKClient(signer.public_key()),
    )

    identity = verifier.verify(encoded)

    assert identity.email == "operator@example.test"
    assert identity.authentication_method == "otp"
    assert identity.authenticated_at == authenticated_at
    assert identity.assurance_level == "aal1"


@pytest.mark.parametrize(
    ("audience", "expired"),
    [("wrong-audience", False), (AUDIENCE, True)],
)
def test_verifier_rejects_invalid_audience_or_expiry(audience: str, expired: bool) -> None:
    signer = make_signer()
    encoded, _ = build_encoded_session(signer, audience=audience, expired=expired)
    verifier = SupabaseJWTVerifier(
        issuer=ISSUER,
        audience=AUDIENCE,
        jwks_url="https://test.invalid/jwks.json",
        allowed_algorithms=("RS256",),
        client_factory=lambda url: StaticJWKClient(signer.public_key()),
    )

    with pytest.raises(SupabaseTokenError, match="claims are invalid"):
        verifier.verify(encoded)


def test_verifier_refreshes_jwks_client_once_for_key_rotation() -> None:
    signer = make_signer()
    encoded, _ = build_encoded_session(signer)
    clients = [
        StaticJWKClient(signer.public_key(), fail=True),
        StaticJWKClient(signer.public_key()),
    ]

    def factory(url: str) -> StaticJWKClient:
        _ = url
        return clients.pop(0)

    verifier = SupabaseJWTVerifier(
        issuer=ISSUER,
        audience=AUDIENCE,
        jwks_url="https://test.invalid/jwks.json",
        allowed_algorithms=("RS256",),
        client_factory=factory,
    )

    assert verifier.verify(encoded).session_id
    assert clients == []


def test_verifier_refuses_symmetric_algorithm_configuration() -> None:
    with pytest.raises(ValueError, match="Symmetric JWT algorithms"):
        SupabaseJWTVerifier(
            issuer=ISSUER,
            audience=AUDIENCE,
            jwks_url="https://test.invalid/jwks.json",
            allowed_algorithms=("HS256",),
        )

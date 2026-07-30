from __future__ import annotations

import base64
import hashlib
import hmac
import json
import time
from collections.abc import Callable
from dataclasses import dataclass
from typing import Protocol
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen
from uuid import UUID

from app.notification.templates import RenderedEmail


@dataclass(frozen=True, slots=True)
class ProviderDeliveryResult:
    provider: str
    provider_message_id: str
    latency_ms: int


class NotificationTransportError(RuntimeError):
    def __init__(self, code: str, detail: str, *, retryable: bool, latency_ms: int = 0) -> None:
        super().__init__(detail)
        self.code = code
        self.detail = detail[:1000]
        self.retryable = retryable
        self.latency_ms = max(0, latency_ms)


class NotificationEmailTransport(Protocol):
    provider: str

    def send(
        self,
        *,
        delivery_id: UUID,
        to_email: str,
        rendered: RenderedEmail,
    ) -> ProviderDeliveryResult: ...


class ResendTransport:
    provider = "resend"

    def __init__(
        self,
        *,
        api_url: str,
        api_key: str,
        from_email: str,
        timeout_seconds: float = 15.0,
        opener: Callable[[Request, float], bytes] | None = None,
    ) -> None:
        self.api_url = api_url
        self.api_key = api_key
        self.from_email = from_email
        self.timeout_seconds = timeout_seconds
        self._opener = opener or _open_request

    def send(
        self,
        *,
        delivery_id: UUID,
        to_email: str,
        rendered: RenderedEmail,
    ) -> ProviderDeliveryResult:
        body = json.dumps(
            {
                "from": self.from_email,
                "to": [to_email],
                "subject": rendered.subject,
                "html": rendered.html,
                "text": rendered.text,
                "headers": {
                    "X-PandaAtlas-Delivery-ID": str(delivery_id),
                    "X-PandaAtlas-Template": (
                        f"{rendered.template_key};v={rendered.template_version};locale={rendered.locale}"
                    ),
                },
            },
            separators=(",", ":"),
        ).encode()
        request = Request(
            self.api_url,
            data=body,
            method="POST",
            headers={
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json",
                "Idempotency-Key": str(delivery_id),
                "User-Agent": "PandaAtlasNotificationWorker/1.0",
            },
        )
        started = time.monotonic()
        try:
            response_body = self._opener(request, self.timeout_seconds)
        except HTTPError as error:
            latency_ms = int((time.monotonic() - started) * 1000)
            detail = _read_http_error(error)
            retryable = error.code in {408, 409, 425, 429} or error.code >= 500
            raise NotificationTransportError(
                f"resend_http_{error.code}",
                detail,
                retryable=retryable,
                latency_ms=latency_ms,
            ) from error
        except (URLError, TimeoutError, OSError) as error:
            latency_ms = int((time.monotonic() - started) * 1000)
            raise NotificationTransportError(
                "resend_transport",
                str(error),
                retryable=True,
                latency_ms=latency_ms,
            ) from error
        latency_ms = int((time.monotonic() - started) * 1000)
        try:
            response = json.loads(response_body)
            provider_message_id = str(response["id"])
        except (json.JSONDecodeError, KeyError, TypeError, ValueError) as error:
            raise NotificationTransportError(
                "resend_invalid_response",
                "Resend response did not contain a stable message ID",
                retryable=True,
                latency_ms=latency_ms,
            ) from error
        return ProviderDeliveryResult(
            provider=self.provider,
            provider_message_id=provider_message_id,
            latency_ms=latency_ms,
        )


def verify_resend_webhook(
    *,
    body: bytes,
    message_id: str,
    timestamp: str,
    signature_header: str,
    secret: str,
    now: int | None = None,
    tolerance_seconds: int = 300,
) -> None:
    try:
        timestamp_value = int(timestamp)
    except ValueError as error:
        raise ValueError("invalid Resend webhook timestamp") from error
    current = int(time.time()) if now is None else now
    if abs(current - timestamp_value) > tolerance_seconds:
        raise ValueError("Resend webhook timestamp is outside the allowed tolerance")
    secret_value = secret.removeprefix("whsec_")
    try:
        secret_bytes = base64.b64decode(secret_value, validate=True)
    except ValueError:
        secret_bytes = secret_value.encode()
    signed = f"{message_id}.{timestamp}.".encode() + body
    expected = hmac.new(secret_bytes, signed, hashlib.sha256).digest()
    signatures = []
    for value in signature_header.split():
        version, separator, encoded = value.partition(",")
        if separator and version == "v1":
            try:
                signatures.append(base64.b64decode(encoded, validate=True))
            except ValueError:
                continue
    if not signatures or not any(hmac.compare_digest(expected, value) for value in signatures):
        raise ValueError("invalid Resend webhook signature")


def minimal_resend_webhook_payload(body: bytes, *, provider_event_id: str) -> dict[str, object]:
    try:
        payload = json.loads(body)
    except json.JSONDecodeError as error:
        raise ValueError("invalid Resend webhook JSON") from error
    if not isinstance(payload, dict):
        raise ValueError("Resend webhook body must be an object")
    event_type = str(payload.get("type", ""))
    data = payload.get("data")
    data = data if isinstance(data, dict) else {}
    provider_message_id = data.get("email_id") or data.get("id")
    bounce_type = data.get("bounce_type") or data.get("type")
    return {
        "provider_event_id": provider_event_id,
        "event_type": event_type,
        "provider_message_id": None if provider_message_id is None else str(provider_message_id),
        "created_at": payload.get("created_at"),
        "bounce_type": None if bounce_type is None else str(bounce_type),
    }


def _open_request(request: Request, timeout_seconds: float) -> bytes:
    with urlopen(request, timeout=timeout_seconds) as response:  # noqa: S310 - fixed configured API URL
        return response.read()


def _read_http_error(error: HTTPError) -> str:
    try:
        body = error.read(2000).decode("utf-8", errors="replace")
    except OSError:
        body = ""
    return body or str(error)

from __future__ import annotations

import base64
import hashlib
import hmac
import json
from io import BytesIO
from urllib.error import HTTPError
from uuid import uuid4

import pytest

from app.core.config import Settings
from app.notification.delivery import (
    NotificationDeliveryJob,
    bounded_backoff_seconds,
)
from app.notification.templates import NotificationTemplateRenderer
from app.notification.transport import (
    NotificationTransportError,
    ResendTransport,
    minimal_resend_webhook_payload,
    verify_resend_webhook,
)


def test_delivery_queue_contract_contains_only_stable_ids() -> None:
    payload = {
        "delivery_id": str(uuid4()),
        "source_event_id": str(uuid4()),
        "target_type": "intent",
        "target_id": str(uuid4()),
        "correlation_id": str(uuid4()),
    }
    job = NotificationDeliveryJob.model_validate(payload)

    assert set(job.model_dump(mode="json")) == {
        "schema_version",
        "delivery_id",
        "source_event_id",
        "target_type",
        "target_id",
        "correlation_id",
    }
    with pytest.raises(ValueError):
        NotificationDeliveryJob.model_validate({**payload, "email": "private@example.com"})
    with pytest.raises(ValueError):
        NotificationDeliveryJob.model_validate({**payload, "content": {"title": "private"}})


def test_bounded_retry_backoff_is_exponential_and_capped() -> None:
    assert [bounded_backoff_seconds(value, base_seconds=30) for value in range(1, 6)] == [
        30,
        60,
        120,
        240,
        480,
    ]
    assert bounded_backoff_seconds(20, base_seconds=30) == 3600


def test_bilingual_templates_render_html_and_text_from_source_files() -> None:
    renderer = NotificationTemplateRenderer(public_base_url="https://zhipanda.example")
    chinese = renderer.render_intent(
        locale="zh-CN",
        category="major_activity",
        content={
            "localized_snapshots": [
                {
                    "locale": "zh-CN",
                    "title": "美香 <更新>",
                    "summary": "已发布 & 已审核",
                }
            ]
        },
    )
    english = renderer.render_digest(
        locale="en",
        frequency="weekly",
        content={
            "items": [
                {
                    "category": "submission_status",
                    "content": {
                        "payload": {"status": "accepted", "public_message_key": "Accepted"}
                    },
                }
            ]
        },
    )

    assert chinese.locale == "zh-CN"
    assert "美香 &lt;更新&gt;" in chinese.html
    assert "已发布 &amp; 已审核" in chinese.html
    assert "美香 <更新>" in chinese.text
    assert "https://zhipanda.example/zh/me/inbox" in chinese.text
    assert english.subject == "ZhiPanda weekly digest"
    assert "Accepted" in english.html
    assert "https://zhipanda.example/en/me/inbox" in english.text


def test_resend_transport_uses_delivery_id_as_idempotency_key() -> None:
    captured: dict[str, object] = {}

    def opener(request: object, timeout: float) -> bytes:
        captured["request"] = request
        captured["timeout"] = timeout
        return b'{"id":"resend-message-1"}'

    delivery_id = uuid4()
    rendered = NotificationTemplateRenderer(
        public_base_url="https://zhipanda.example"
    ).render_intent(
        locale="en",
        category="security_role",
        content={},
    )
    result = ResendTransport(
        api_url="https://api.resend.example/emails",
        api_key="test-resend-key",
        from_email="ZhiPanda <updates@example.com>",
        opener=opener,
    ).send(
        delivery_id=delivery_id,
        to_email="reader@example.com",
        rendered=rendered,
    )

    request = captured["request"]
    assert request.get_header("Idempotency-key") == str(delivery_id)
    payload = json.loads(request.data)
    assert payload["to"] == ["reader@example.com"]
    assert payload["headers"]["X-PandaAtlas-Delivery-ID"] == str(delivery_id)
    assert result.provider_message_id == "resend-message-1"


def test_resend_transport_classifies_provider_retries() -> None:
    def opener(request: object, timeout: float) -> bytes:
        del request, timeout
        raise HTTPError(
            "https://api.resend.example/emails",
            429,
            "rate limited",
            {},
            BytesIO(b'{"message":"rate limited"}'),
        )

    rendered = NotificationTemplateRenderer(
        public_base_url="https://zhipanda.example"
    ).render_intent(locale="en", category="major_activity", content={})
    transport = ResendTransport(
        api_url="https://api.resend.example/emails",
        api_key="test-resend-key",
        from_email="updates@example.com",
        opener=opener,
    )

    with pytest.raises(NotificationTransportError) as captured:
        transport.send(
            delivery_id=uuid4(),
            to_email="reader@example.com",
            rendered=rendered,
        )
    assert captured.value.code == "resend_http_429"
    assert captured.value.retryable is True


def test_resend_webhook_signature_is_verified_and_timestamp_bound() -> None:
    body = b'{"type":"email.delivered","data":{"email_id":"email-1"}}'
    secret_bytes = b"test-webhook-secret"
    secret = "whsec_" + base64.b64encode(secret_bytes).decode()
    message_id = "event-1"
    timestamp = "1785384000"
    signature = base64.b64encode(
        hmac.new(
            secret_bytes,
            f"{message_id}.{timestamp}.".encode() + body,
            hashlib.sha256,
        ).digest()
    ).decode()

    verify_resend_webhook(
        body=body,
        message_id=message_id,
        timestamp=timestamp,
        signature_header=f"v1,{signature}",
        secret=secret,
        now=1785384000,
    )
    with pytest.raises(ValueError, match="signature"):
        verify_resend_webhook(
            body=body,
            message_id=message_id,
            timestamp=timestamp,
            signature_header="v1,invalid",
            secret=secret,
            now=1785384000,
        )
    with pytest.raises(ValueError, match="tolerance"):
        verify_resend_webhook(
            body=body,
            message_id=message_id,
            timestamp=timestamp,
            signature_header=f"v1,{signature}",
            secret=secret,
            now=1785385000,
        )


def test_webhook_storage_projection_excludes_recipient_and_subject() -> None:
    body = json.dumps(
        {
            "type": "email.bounced",
            "created_at": "2026-07-30T04:00:00Z",
            "data": {
                "email_id": "email-1",
                "to": ["private@example.com"],
                "subject": "Private subject",
                "bounce_type": "Permanent",
            },
        }
    ).encode()
    minimal = minimal_resend_webhook_payload(body, provider_event_id="event-1")

    assert minimal == {
        "provider_event_id": "event-1",
        "event_type": "email.bounced",
        "provider_message_id": "email-1",
        "created_at": "2026-07-30T04:00:00Z",
        "bounce_type": "Permanent",
    }
    assert "private@example.com" not in json.dumps(minimal)
    assert "Private subject" not in json.dumps(minimal)


def test_delivery_configuration_separates_auth_and_application_credentials() -> None:
    with pytest.raises(ValueError, match="must differ"):
        Settings(
            _env_file=None,
            NOTIFICATION_ENABLED=True,
            NOTIFICATION_EMAIL_ENABLED=True,
            NOTIFICATION_TRANSPORT="resend",
            RESEND_API_KEY="shared-credential",
            RESEND_FROM_EMAIL="updates@example.com",
            RESEND_WEBHOOK_SECRET="whsec_test",
            AUTH_SMTP_PASSWORD="shared-credential",
        )


def test_delivery_configuration_separates_resend_send_and_webhook_credentials() -> None:
    shared = "same-provider-credential"
    with pytest.raises(ValueError, match="must differ"):
        Settings(
            _env_file=None,
            NOTIFICATION_ENABLED=True,
            NOTIFICATION_EMAIL_ENABLED=True,
            NOTIFICATION_TRANSPORT="resend",
            RESEND_API_KEY=shared,
            RESEND_FROM_EMAIL="updates@example.com",
            RESEND_WEBHOOK_SECRET=shared,
        )

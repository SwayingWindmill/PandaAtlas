from __future__ import annotations

import base64
import hashlib
import hmac
import json
import os
import smtplib
import ssl
import sys
import time
from datetime import UTC, datetime
from email.message import EmailMessage
from pathlib import Path
from uuid import uuid4

from app.notification.templates import RenderedEmail
from app.notification.transport import ResendTransport, verify_resend_webhook

REPO_ROOT = Path(__file__).resolve().parents[3]
REPORT_DIR = Path(os.getenv("RELEASE_GATE_REPORT_DIR", REPO_ROOT / ".release-gate"))
REPORT_PATH = REPORT_DIR / "notification-staging.json"


def _write(report: dict[str, object]) -> None:
    REPORT_DIR.mkdir(parents=True, exist_ok=True)
    REPORT_PATH.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")


def _required_environment() -> dict[str, str]:
    names = (
        "RESEND_API_KEY",
        "RESEND_FROM_EMAIL",
        "RESEND_WEBHOOK_SECRET",
        "AUTH_SMTP_HOST",
        "AUTH_SMTP_PORT",
        "AUTH_SMTP_USERNAME",
        "AUTH_SMTP_PASSWORD",
        "AUTH_SMTP_FROM_EMAIL",
        "NOTIFICATION_STAGING_TO_EMAIL",
    )
    return {name: os.getenv(name, "").strip() for name in names}


def _send_auth_smtp(values: dict[str, str], rendered: RenderedEmail) -> None:
    try:
        port = int(values["AUTH_SMTP_PORT"])
    except ValueError as error:
        raise ValueError("AUTH_SMTP_PORT must be an integer") from error
    message = EmailMessage()
    message["Subject"] = f"Auth SMTP: {rendered.subject}"
    message["From"] = values["AUTH_SMTP_FROM_EMAIL"]
    message["To"] = values["NOTIFICATION_STAGING_TO_EMAIL"]
    message.set_content(rendered.text)
    context = ssl.create_default_context()
    if port == 465:
        with smtplib.SMTP_SSL(
            values["AUTH_SMTP_HOST"],
            port,
            timeout=15,
            context=context,
        ) as client:
            client.login(values["AUTH_SMTP_USERNAME"], values["AUTH_SMTP_PASSWORD"])
            client.send_message(message)
        return
    with smtplib.SMTP(values["AUTH_SMTP_HOST"], port, timeout=15) as client:
        client.ehlo()
        client.starttls(context=context)
        client.ehlo()
        client.login(values["AUTH_SMTP_USERNAME"], values["AUTH_SMTP_PASSWORD"])
        client.send_message(message)


def main() -> int:
    values = _required_environment()
    missing = sorted(name for name, value in values.items() if not value)
    base_report: dict[str, object] = {
        "schema_version": 1,
        "gate": "notification-staging",
        "generated_at": datetime.now(UTC).isoformat(),
        "checks": [
            "repository-owned-template",
            "delivery-id-idempotency-key",
            "resend-webhook-signature",
            "auth-smtp-tls-submission",
            "application-and-auth-credentials-separated",
        ],
    }
    staging_required = os.getenv("RUN_NOTIFICATION_STAGING") == "1"
    if not staging_required or missing:
        base_report.update(
            {
                "outcome": "environment-blocked",
                "reason": "notification staging credentials are not configured",
                "missing_environment": missing,
                "provider_request_attempted": False,
            }
        )
        _write(base_report)
        print("Notification staging drill is environment-blocked; evidence was recorded.")
        return 2 if staging_required else 0

    try:
        smtp_port = int(values["AUTH_SMTP_PORT"])
        if not 1 <= smtp_port <= 65535:
            raise ValueError
    except ValueError:
        base_report.update(
            {
                "outcome": "failed",
                "reason": "AUTH_SMTP_PORT must be an integer from 1 through 65535",
                "provider_request_attempted": False,
                "auth_smtp_request_attempted": False,
            }
        )
        _write(base_report)
        return 1

    if values["RESEND_API_KEY"] in {
        values["RESEND_WEBHOOK_SECRET"],
        values["AUTH_SMTP_PASSWORD"],
    }:
        base_report.update(
            {
                "outcome": "failed",
                "reason": "application, webhook, and Auth SMTP credentials must be distinct",
            }
        )
        _write(base_report)
        return 1

    delivery_id = uuid4()
    rendered = RenderedEmail(
        subject="ZhiPanda notification staging verification",
        html="<p>ZhiPanda notification staging verification.</p>",
        text="ZhiPanda notification staging verification.",
        template_key="staging-verification",
        template_version=1,
        locale="en",
    )
    resend_attempted = False
    auth_smtp_attempted = False
    try:
        resend_attempted = True
        result = ResendTransport(
            api_url=os.getenv("RESEND_API_URL", "https://api.resend.com/emails"),
            api_key=values["RESEND_API_KEY"],
            from_email=values["RESEND_FROM_EMAIL"],
        ).send(
            delivery_id=delivery_id,
            to_email=values["NOTIFICATION_STAGING_TO_EMAIL"],
            rendered=rendered,
        )
        timestamp = str(int(time.time()))
        message_id = f"staging-{delivery_id}"
        body = json.dumps(
            {
                "type": "email.delivered",
                "created_at": datetime.now(UTC).isoformat(),
                "data": {"email_id": result.provider_message_id},
            },
            separators=(",", ":"),
        ).encode()
        secret = values["RESEND_WEBHOOK_SECRET"].removeprefix("whsec_")
        try:
            secret_bytes = base64.b64decode(secret, validate=True)
        except ValueError:
            secret_bytes = secret.encode()
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
            secret=values["RESEND_WEBHOOK_SECRET"],
            now=int(timestamp),
        )
        auth_smtp_attempted = True
        _send_auth_smtp(values, rendered)
    except Exception as error:  # noqa: BLE001 - evidence must retain every external failure.
        base_report.update(
            {
                "outcome": "failed",
                "reason": type(error).__name__,
                "provider_request_attempted": resend_attempted,
                "auth_smtp_request_attempted": auth_smtp_attempted,
            }
        )
        _write(base_report)
        print("Notification staging drill failed.", file=sys.stderr)
        return 1

    base_report.update(
        {
            "outcome": "passed",
            "provider": result.provider,
            "provider_message_id_sha256": hashlib.sha256(
                result.provider_message_id.encode()
            ).hexdigest(),
            "delivery_id": str(delivery_id),
            "provider_latency_ms": result.latency_ms,
            "provider_request_attempted": True,
            "auth_smtp_request_attempted": True,
            "auth_smtp": "submitted",
            "recipient_sha256": hashlib.sha256(
                values["NOTIFICATION_STAGING_TO_EMAIL"].encode()
            ).hexdigest(),
        }
    )
    _write(base_report)
    print("Notification staging drill passed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

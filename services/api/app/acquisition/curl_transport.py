from __future__ import annotations

import shutil
import subprocess
import tempfile
from pathlib import Path
from typing import Protocol

from .models import ResponseEnvelope
from .source_registry import ReviewedSource


class ReviewedRequest(Protocol):
    url: str
    method: str


class CurlTransportError(RuntimeError):
    pass


def fetch_curl_response(
    source: ReviewedSource,
    request: ReviewedRequest,
    current_url: str,
) -> ResponseEnvelope:
    policy = source.request_policy
    if policy is None:
        raise CurlTransportError(f"source {source.source_id} has no reviewed request policy")
    executable = shutil.which("curl") or shutil.which("curl.exe")
    if executable is None:
        raise CurlTransportError("reviewed curl transport requires the curl executable")

    with tempfile.TemporaryDirectory(prefix="pandaatlas-curl-") as temporary:
        directory = Path(temporary)
        headers_path = directory / "headers.txt"
        body_path = directory / "body.bin"
        command = build_curl_command(
            executable=executable,
            source=source,
            request=request,
            current_url=current_url,
            headers_path=headers_path,
            body_path=body_path,
        )
        try:
            completed = subprocess.run(
                command,
                check=False,
                capture_output=True,
                text=True,
                encoding="utf-8",
                errors="replace",
                timeout=policy.timeout_seconds + 10,
            )
        except subprocess.TimeoutExpired as error:
            raise CurlTransportError(
                f"reviewed curl transport timed out after {policy.timeout_seconds} seconds"
            ) from error
        if completed.returncode != 0:
            detail = " ".join(completed.stderr.split()) or f"exit code {completed.returncode}"
            raise CurlTransportError(f"reviewed curl transport failed: {detail}")

        status, final_url = parse_curl_write_out(completed.stdout)
        if not headers_path.is_file() or not body_path.is_file():
            raise CurlTransportError("reviewed curl transport did not produce response files")
        headers = parse_curl_headers(headers_path.read_bytes())
        body = body_path.read_bytes()
        declared_length = headers.get("content-length")
        if declared_length and declared_length.isdigit() and int(declared_length) != len(body):
            raise CurlTransportError(
                "reviewed curl response Content-Length does not match captured bytes"
            )
        return ResponseEnvelope(
            requested_url=request.url,
            final_url=final_url,
            status=status,
            headers=headers,
            body=body,
        )


def build_curl_command(
    *,
    executable: str,
    source: ReviewedSource,
    request: ReviewedRequest,
    current_url: str,
    headers_path: Path,
    body_path: Path,
) -> list[str]:
    policy = source.request_policy
    if policy is None:
        raise CurlTransportError(f"source {source.source_id} has no reviewed request policy")
    if request.method not in policy.allowed_methods:
        raise CurlTransportError("curl request method is outside the reviewed request policy")
    return [
        executable,
        "--silent",
        "--show-error",
        "--http2",
        "--proto",
        "=https",
        "--max-time",
        str(policy.timeout_seconds),
        "--connect-timeout",
        str(policy.timeout_seconds),
        "--max-redirs",
        "0",
        "--request",
        request.method,
        "--user-agent",
        policy.user_agent,
        "--header",
        f"Accept: {policy.accept}",
        "--dump-header",
        str(headers_path),
        "--output",
        str(body_path),
        "--write-out",
        "%{http_code}\t%{url_effective}",
        current_url,
    ]


def parse_curl_write_out(value: str) -> tuple[int, str]:
    parts = value.strip().split("\t", 1)
    if len(parts) != 2 or not parts[0].isdigit() or not parts[1].strip():
        raise CurlTransportError("reviewed curl transport returned invalid status metadata")
    status = int(parts[0])
    if status < 100 or status > 599:
        raise CurlTransportError("reviewed curl transport returned an invalid HTTP status")
    return status, parts[1].strip()


def parse_curl_headers(value: bytes) -> dict[str, str]:
    text = value.decode("latin-1").replace("\r\n", "\n").replace("\r", "\n")
    blocks = [block.strip() for block in text.split("\n\n") if block.strip()]
    http_blocks = [block for block in blocks if block.splitlines()[0].startswith("HTTP/")]
    if not http_blocks:
        raise CurlTransportError("reviewed curl transport returned no HTTP header block")
    lines = http_blocks[-1].splitlines()
    headers: dict[str, str] = {}
    for line in lines[1:]:
        if not line or ":" not in line:
            continue
        key, raw_value = line.split(":", 1)
        normalized_key = key.strip().lower()
        normalized_value = raw_value.strip()
        if not normalized_key:
            continue
        if normalized_key in headers:
            headers[normalized_key] = f"{headers[normalized_key]}, {normalized_value}"
        else:
            headers[normalized_key] = normalized_value
    return headers


__all__ = [
    "CurlTransportError",
    "build_curl_command",
    "fetch_curl_response",
    "parse_curl_headers",
    "parse_curl_write_out",
]

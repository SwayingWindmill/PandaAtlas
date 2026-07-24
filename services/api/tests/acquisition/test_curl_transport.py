from __future__ import annotations

import subprocess
from datetime import date
from pathlib import Path

import pytest

from app.acquisition import curl_transport
from app.acquisition.curl_transport import (
    CurlTransportError,
    fetch_curl_response,
    parse_curl_headers,
    parse_curl_write_out,
)
from app.acquisition.runner import AdapterRequest
from app.acquisition.source_registry import load_source_registry


def test_reviewed_curl_transport_uses_fixed_safe_arguments(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    del tmp_path
    source = load_source_registry(today=date(2026, 7, 23)).get(
        "chengdu-panda-base-international-cooperation"
    )
    request = AdapterRequest(
        request_id="international-cooperation-zh",
        url="https://www.panda.org.cn/cn/cooperate/international/",
    )
    observed: list[str] = []

    monkeypatch.setattr(curl_transport.shutil, "which", lambda _: "/usr/bin/curl")

    def fake_run(command: list[str], **kwargs) -> subprocess.CompletedProcess[str]:
        del kwargs
        observed.extend(command)
        headers_path = Path(command[command.index("--dump-header") + 1])
        body_path = Path(command[command.index("--output") + 1])
        headers_path.write_bytes(
            b"HTTP/2 200\r\nContent-Type: text/html\r\nContent-Length: 4\r\n\r\n"
        )
        body_path.write_bytes(b"test")
        return subprocess.CompletedProcess(
            command,
            0,
            stdout="200\thttps://www.panda.org.cn/cn/cooperate/international/",
            stderr="",
        )

    monkeypatch.setattr(curl_transport.subprocess, "run", fake_run)

    response = fetch_curl_response(source, request, request.url)

    assert response.status == 200
    assert response.body == b"test"
    assert response.headers["content-type"] == "text/html"
    assert "--http2" in observed
    assert observed[observed.index("--max-redirs") + 1] == "0"
    assert "--location" not in observed
    assert "--cookie" not in observed
    assert observed[-1] == request.url


def test_curl_header_parser_selects_final_http_block() -> None:
    headers = parse_curl_headers(
        b"HTTP/1.1 200 Connection established\r\n\r\n"
        b"HTTP/2 200\r\nContent-Type: text/html\r\nX-Test: first\r\n"
        b"X-Test: second\r\n\r\n"
    )
    assert headers == {
        "content-type": "text/html",
        "x-test": "first, second",
    }


def test_curl_write_out_parser_fails_closed() -> None:
    assert parse_curl_write_out("200\thttps://www.panda.org.cn/en/cooperate/international/") == (
        200,
        "https://www.panda.org.cn/en/cooperate/international/",
    )
    with pytest.raises(CurlTransportError, match="invalid status metadata"):
        parse_curl_write_out("not-a-status")

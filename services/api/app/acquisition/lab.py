from __future__ import annotations

import json
import threading
from collections.abc import Callable, Iterator
from contextlib import contextmanager
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Any

from scrapling.fetchers import DynamicFetcher, FetcherSession, StealthyFetcher


class _LabHandler(BaseHTTPRequestHandler):
    server_version = "PandaAtlasAcquisitionLab/1.0"

    def do_GET(self) -> None:  # noqa: N802
        if self.path == "/http":
            self._send_html(
                200,
                _profile_html(
                    extra=f'<pre id="request-json">{_html_json(self._request_fingerprint())}</pre>'
                ),
                set_cookie="panda_lab_session=approved; Path=/; HttpOnly; SameSite=Lax",
            )
            return
        if self.path == "/session":
            if "panda_lab_session=approved" not in (self.headers.get("cookie") or ""):
                self._send_html(401, "<h1>Authentication required</h1>")
                return
            self._send_html(200, _profile_html(extra='<p id="session-state">authorized</p>'))
            return
        if self.path == "/js":
            payload = json.dumps(self._request_fingerprint(), ensure_ascii=False)
            html = f"""<!doctype html>
<html><body><main id="app">loading</main>
<script>
const probe = {{
  request: {payload},
  navigator: {{
    webdriver: navigator.webdriver,
    userAgent: navigator.userAgent,
    languages: navigator.languages,
    platform: navigator.platform,
    plugins: navigator.plugins.length,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
  }}
}};
const node = document.createElement('pre');
node.id = 'browser-probe';
node.textContent = JSON.stringify(probe);
document.querySelector('#app').replaceWith(node);
</script></body></html>"""
            self._send_html(200, html)
            return
        if self.path == "/challenge":
            self._send_html(
                403,
                "<main id='challenge-platform'><h1>Verify you are human</h1>"
                "<div class='turnstile'>CAPTCHA challenge required</div></main>",
            )
            return
        self._send_html(404, "<h1>Not found</h1>")

    def log_message(self, format: str, *args: object) -> None:
        return

    def _request_fingerprint(self) -> dict[str, Any]:
        return {
            "user_agent": self.headers.get("user-agent"),
            "accept": self.headers.get("accept"),
            "accept_language": self.headers.get("accept-language"),
            "sec_ch_ua": self.headers.get("sec-ch-ua"),
            "sec_fetch_site": self.headers.get("sec-fetch-site"),
            "referer": self.headers.get("referer"),
            "cookie_present": bool(self.headers.get("cookie")),
        }

    def _send_html(self, status: int, body: str, *, set_cookie: str | None = None) -> None:
        encoded = body.encode("utf-8")
        self.send_response(status)
        self.send_header("content-type", "text/html; charset=utf-8")
        self.send_header("content-length", str(len(encoded)))
        self.send_header("cache-control", "no-store")
        if set_cookie:
            self.send_header("set-cookie", set_cookie)
        self.end_headers()
        self.wfile.write(encoded)


@contextmanager
def controlled_lab_server() -> Iterator[str]:
    server = ThreadingHTTPServer(("127.0.0.1", 0), _LabHandler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        yield f"http://127.0.0.1:{server.server_port}"
    finally:
        server.shutdown()
        server.server_close()
        thread.join(timeout=5)


def run_scrapling_browser_lab() -> dict[str, Any]:
    with controlled_lab_server() as base_url:
        with FetcherSession(
            stealthy_headers=True,
            impersonate="chrome",
            follow_redirects="safe",
            retries=1,
        ) as http_session:
            static = http_session.get(f"{base_url}/http")
            static_probe = _json_from_selector(static, "#request-json::text")
            session = http_session.get(f"{base_url}/session")
            challenge = http_session.get(f"{base_url}/challenge")

        dynamic_result = _run_browser_probe(
            "dynamic",
            lambda: DynamicFetcher.fetch(
                f"{base_url}/js",
                headless=True,
                real_chrome=False,
                google_search=False,
                wait_selector="#browser-probe",
                timeout=30_000,
            ),
        )
        stealth_result = _run_browser_probe(
            "stealth",
            lambda: StealthyFetcher.fetch(
                f"{base_url}/js",
                headless=True,
                real_chrome=False,
                google_search=False,
                solve_cloudflare=False,
                hide_canvas=False,
                wait_selector="#browser-probe",
                timeout=30_000,
            ),
        )

    static_passed = (
        static.status == 200
        and "Chrome" in (static_probe.get("user_agent") or "")
        and session.status == 200
        and "authorized" in str(session.css("#session-state::text").get())
        and challenge.status == 403
    )
    browser_passed = _browser_identity_passed(dynamic_result)
    stealth_passed = _browser_identity_passed(
        stealth_result,
        require_hidden_webdriver=True,
    )
    outcomes = {dynamic_result["outcome"], stealth_result["outcome"]}
    identity_failed = (
        dynamic_result["outcome"] == "passed" and not browser_passed
    ) or (
        stealth_result["outcome"] == "passed" and not stealth_passed
    )
    if not static_passed or "failed" in outcomes or identity_failed:
        outcome = "failed"
    elif "environment-blocked" in outcomes:
        outcome = "environment-blocked"
    else:
        outcome = "passed"

    return {
        "outcome": outcome,
        "target_scope": "loopback-controlled-fixture-only",
        "static_http": {
            "status": static.status,
            "browser_consistent_user_agent": "Chrome" in (static_probe.get("user_agent") or ""),
            "request_fingerprint": static_probe,
        },
        "authorized_session": {
            "status": session.status,
            "cookie_reused": "authorized" in str(session.css("#session-state::text").get()),
        },
        "dynamic_browser": dynamic_result,
        "stealth_lab": {
            **stealth_result,
            "solve_cloudflare": False,
            "hide_canvas": False,
        },
        "challenge": {
            "status": challenge.status,
            "action": "stop-and-review",
            "follow_up_identity_switch": False,
        },
    }


def _run_browser_probe(name: str, fetch: Callable[[], Any]) -> dict[str, Any]:
    try:
        response = fetch()
        return {
            "outcome": "passed",
            "status": response.status,
            "probe": _json_from_selector(response, "#browser-probe::text"),
        }
    except Exception as error:
        detail = " ".join(str(error).split())
        return {
            "outcome": "environment-blocked",
            "probe_name": name,
            "error_type": type(error).__name__,
            "error": detail[:500],
        }


def _browser_identity_passed(
    result: dict[str, Any],
    *,
    require_hidden_webdriver: bool = False,
) -> bool:
    if result.get("outcome") != "passed" or result.get("status") != 200:
        return False
    probe = result.get("probe") or {}
    navigator = probe.get("navigator") or {}
    request = probe.get("request") or {}
    browser_identity = (
        "Chrome" in str(navigator.get("userAgent") or "")
        and "Chrome" in str(request.get("user_agent") or "")
        and bool(navigator.get("languages"))
    )
    if require_hidden_webdriver:
        return browser_identity and navigator.get("webdriver") in {False, None}
    return browser_identity


def _json_from_selector(response: Any, selector: str) -> dict[str, Any]:
    value = response.css(selector).get()
    if value is None:
        raise AssertionError(f"missing browser-lab payload for {selector}")
    return json.loads(str(value))


def _profile_html(*, extra: str) -> str:
    return f"""<!doctype html><html lang="zh-CN"><body>
<article id="panda-card" data-panda-id="panda-bi-li">
<h1 data-field="name-zh">比力</h1>
<p data-field="name-en">Bi Li</p>
<p data-field="institution">Singapore Zoo</p>
{extra}
</article></body></html>"""


def _html_json(value: dict[str, Any]) -> str:
    return json.dumps(value, ensure_ascii=False).replace("&", "&amp;").replace("<", "&lt;")

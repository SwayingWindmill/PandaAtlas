"""Running a collector CLI that lives in its own checkout on the collector host."""

from __future__ import annotations

import asyncio
import os
import re
import shlex
import subprocess
from pathlib import Path

from collector.models import CollectError, ErrorKind

#: Log lines that mean the run did not work, whatever the exit code says. Both CLIs log and swallow
#: most exceptions, so the exit code alone is not enough.
PATTERNS: list[tuple[re.Pattern[str], ErrorKind]] = [
    (re.compile(r"验证码|滑块|安全验证|风控|captcha|risk[ _-]?control", re.I), ErrorKind.CHALLENGE),
    (
        re.compile(
            r"(cookie|登录|login).{0,20}(失效|过期|无效|失败|expired|invalid)|请先登录|扫码登录",
            re.I,
        ),
        ErrorKind.LOGIN_EXPIRED,
    ),
    (
        re.compile(r"\b(414|418|429)\b|访问频繁|请求过于频繁|too many requests", re.I),
        ErrorKind.RATE_LIMITED,
    ),
]


def classify(output: str) -> ErrorKind | None:
    for pattern, kind in PATTERNS:
        if pattern.search(output):
            return kind
    return None


async def run(command: str, args: list[str], cwd: Path, timeout: int, service: str) -> str:
    if not cwd.is_dir():
        raise CollectError(ErrorKind.NOT_FOUND, f"{service}: checkout not found at {cwd}")
    # A thread rather than asyncio subprocesses: on Windows psycopg needs the selector event loop,
    # which cannot start subprocesses.
    try:
        completed = await asyncio.to_thread(
            subprocess.run,
            [*shlex.split(command, posix=os.name != "nt"), *args],
            cwd=cwd,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            timeout=timeout,
            env={**os.environ, "PYTHONIOENCODING": "utf-8"},
        )
    except subprocess.TimeoutExpired as exc:
        raise CollectError(ErrorKind.TRANSIENT, f"{service}: timed out after {timeout}s") from exc
    except OSError as exc:
        raise CollectError(
            ErrorKind.NOT_FOUND, f"{service}: cannot start {command!r}: {exc}"
        ) from exc
    output = completed.stdout.decode("utf-8", errors="replace")
    kind = classify(output)
    if kind:
        raise CollectError(kind, f"{service}: {_tail(output)}")
    if completed.returncode != 0:
        raise CollectError(
            ErrorKind.TRANSIENT, f"{service}: exit {completed.returncode}: {_tail(output)}"
        )
    return output


def _tail(output: str, lines: int = 8) -> str:
    return " | ".join(output.strip().splitlines()[-lines:])[:600]

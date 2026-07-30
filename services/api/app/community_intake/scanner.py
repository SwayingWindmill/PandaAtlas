from __future__ import annotations

from dataclasses import dataclass
from typing import BinaryIO, Protocol

from app.community_intake.models import AttachmentState


@dataclass(frozen=True, slots=True)
class MalwareScanResult:
    outcome: AttachmentState
    scanner_name: str
    scanner_version: str | None
    result_code: str

    def __post_init__(self) -> None:
        if self.outcome not in {
            AttachmentState.CLEAN,
            AttachmentState.INFECTED,
            AttachmentState.SCAN_FAILED,
        }:
            raise ValueError("scanner result must be clean, infected, or scan_failed")


class MalwareScanner(Protocol):
    """Adapter boundary; implementations must not log file bytes or object paths."""

    def scan(self, stream: BinaryIO, *, media_type: str) -> MalwareScanResult: ...

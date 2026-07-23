from __future__ import annotations

import argparse
import csv
import importlib.util
import json
import os
import shutil
import tempfile
from collections.abc import Mapping
from datetime import UTC, datetime
from hashlib import sha256
from pathlib import Path
from types import ModuleType
from typing import cast
from uuid import uuid4

_REPOSITORY_ROOT = Path(__file__).resolve().parents[3]
_DEFAULT_CURATION_DIR = _REPOSITORY_ROOT / "data" / "curation" / "pandas"
_VALIDATOR_PATH = _REPOSITORY_ROOT / "scripts" / "curation" / "validate_panda_curation.py"
_REPORT_ROOT = _REPOSITORY_ROOT / ".acquisition" / "application-reports"
_TARGET_EVENT_SOURCES = {
    "evt_bao_li_birth": "src_smithsonian_giant_panda_faq",
    "evt_qing_bao_birth": "src_smithsonian_giant_panda_faq",
    "evt_bao_li_arrival_20241015": "src_smithsonian_history",
    "evt_qing_bao_arrival_20241015": "src_smithsonian_history",
    "evt_bao_li_public_debut_20250124": "src_smithsonian_history",
    "evt_qing_bao_public_debut_20250124": "src_smithsonian_history",
}
_BAO_LI_MEDIA = {
    "panda_slug": "bao-li",
    "asset": (
        "https://upload.wikimedia.org/wikipedia/commons/thumb/0/00/Bao_Li.jpg/1920px-Bao_Li.jpg"
    ),
    "source_url": "https://commons.wikimedia.org/wiki/File:Bao_Li.jpg",
    "rights": "CC BY-SA 4.0",
    "credit": "Melina Kolburn / Wikimedia Commons",
    "alt_zh": "宝力在史密森尼国家动物园的栖息地内",
    "alt_en": "Bao Li in his habitat at Smithsonian's National Zoo",
    "review_status": "approved",
    "notes": (
        "Commons API reviewed 2026-07-23: exact title File:Bao Li.jpg; description identifies "
        "Bao Li at the Smithsonian National Zoo; photographer Melina Kolburn; CC BY-SA 4.0; "
        "4752x3168 JPEG; original SHA-1 57e368f85cd620e828436f14b7efbf4316643aff."
    ),
}
_QING_BAO_COLLECTION_MEDIA = {
    "panda_slug": "qing-bao",
    "asset": (
        "https://upload.wikimedia.org/wikipedia/commons/thumb/d/d8/"
        "Qing_Bao-5_-_54260941750.jpg/1920px-Qing_Bao-5_-_54260941750.jpg"
    ),
    "source_url": "https://commons.wikimedia.org/wiki/File:Qing_Bao-5_-_54260941750.jpg",
    "rights": "CC BY 2.0",
    "credit": "Mike Maguire / Wikimedia Commons",
    "alt_zh": "疑似青宝在史密森尼国家动物园的雪地中吃竹子",
    "alt_en": "Probable Qing Bao eating bamboo in the snow at Smithsonian's National Zoo",
    "review_status": "collection_only",
    "notes": (
        "Private collection only: the Commons description says the photographer is not fully "
        "confident the panda is Qing Bao. The image remains displayable with probable identity "
        "wording and must not be represented as a certain individual identification."
    ),
}
_APPROVAL_NOTE = (
    "Curator-approved 2026-07-23 after project-owner continuation; event value and source "
    "were already accepted in Smithsonian curation patch "
    "curation-patch-2792fa5b4c95704a0ec7aac41c7f59575392fdc8997263f2371bcfaa23b1da3b."
)
_REQUIRED_FILES = ("events.csv", "media.csv", "pandas.csv", "sources.csv")


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description=(
            "Review the Smithsonian current-pair release inputs. Defaults to dry-run and only "
            "writes the curation directory when --apply is supplied."
        )
    )
    parser.add_argument("--curation-dir", type=Path, default=_DEFAULT_CURATION_DIR)
    parser.add_argument("--apply", action="store_true")
    parser.add_argument("--report-output", type=Path)
    parser.add_argument("--overwrite-report", action="store_true")
    return parser


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    try:
        result = review_release_inputs(
            curation_dir=args.curation_dir.resolve(),
            apply=args.apply,
            reviewed_at=datetime.now(UTC),
        )
        if args.report_output is not None:
            path = _write_report(
                args.report_output,
                result,
                overwrite=args.overwrite_report,
            )
            result["report_output"] = str(path)
        print(json.dumps(result, ensure_ascii=False, indent=2, allow_nan=False))
        return 0
    except (FileExistsError, FileNotFoundError, ValueError) as error:
        print(
            json.dumps(
                {"outcome": "refused", "message": str(error)},
                ensure_ascii=False,
                indent=2,
            )
        )
        return 2


def review_release_inputs(
    *,
    curation_dir: Path,
    apply: bool,
    reviewed_at: datetime,
) -> dict[str, object]:
    if reviewed_at.tzinfo is None or reviewed_at.utcoffset() is None:
        raise ValueError("reviewed_at must include a timezone")
    if curation_dir.is_symlink() or not curation_dir.is_dir():
        raise ValueError("curation_dir must be an existing non-symlink directory")
    missing = [name for name in _REQUIRED_FILES if not (curation_dir / name).is_file()]
    if missing:
        raise FileNotFoundError("missing curation CSV files: " + ", ".join(missing))

    before_sha256 = _csv_hashes(curation_dir)
    validator = _load_validator()
    with tempfile.TemporaryDirectory(
        prefix=".smithsonian-release-inputs-stage-",
        dir=curation_dir.parent,
    ) as temporary_root:
        stage_dir = Path(temporary_root) / curation_dir.name
        shutil.copytree(curation_dir, stage_dir)
        counts = _mutate_stage(stage_dir)
        errors, validation_counts = validator(stage_dir)
        if errors:
            raise ValueError("staged release-input review failed validation: " + "; ".join(errors))
        after_sha256 = _csv_hashes(stage_dir)
        changed_files = sorted(
            name for name, digest in after_sha256.items() if before_sha256.get(name) != digest
        )
        blockers = _publication_blockers(stage_dir)
        if apply:
            _commit_directory_swap(
                curation_dir=curation_dir,
                stage_dir=stage_dir,
                expected_sha256=before_sha256,
            )

    return {
        "outcome": "applied" if apply else "dry-run",
        "applied": apply,
        "reviewed_at": reviewed_at.isoformat(),
        "event_approvals": counts["event_approvals"],
        "approved_media_additions": counts["approved_media_additions"],
        "collection_media_updates": counts["collection_media_updates"],
        "panda_approvals": counts["panda_approvals"],
        "changed_files": changed_files,
        "before_sha256": before_sha256,
        "after_sha256": after_sha256,
        "validation_counts": validation_counts,
        "publication_blockers": blockers,
    }


def _mutate_stage(stage_dir: Path) -> dict[str, int]:
    event_fields, events = _read_csv(stage_dir / "events.csv")
    media_fields, media = _read_csv(stage_dir / "media.csv")
    panda_fields, pandas = _read_csv(stage_dir / "pandas.csv")

    event_by_id = {row["event_id"]: row for row in events}
    if len(event_by_id) != len(events):
        raise ValueError("events.csv contains duplicate event IDs")
    event_approvals = 0
    for event_id, expected_source_id in _TARGET_EVENT_SOURCES.items():
        row = event_by_id.get(event_id)
        if row is None:
            raise ValueError(f"missing required Smithsonian event {event_id}")
        if row["evidence_status"] != "verified":
            raise ValueError(f"event {event_id} is not verified")
        if expected_source_id not in _split_ids(row["source_ids"]):
            raise ValueError(f"event {event_id} lost expected source {expected_source_id}")
        if row["review_status"] not in {"draft", "reviewed", "approved"}:
            raise ValueError(f"event {event_id} has forbidden review status")
        if row["review_status"] != "approved":
            row["review_status"] = "approved"
            row["notes"] = _append_note(row["notes"], _APPROVAL_NOTE)
            event_approvals += 1

    approved_media_additions = _upsert_exact_media(media, _BAO_LI_MEDIA)
    collection_media_updates = _upsert_exact_media(media, _QING_BAO_COLLECTION_MEDIA)

    panda_by_slug = {row["slug"]: row for row in pandas}
    bao_li = panda_by_slug.get("bao-li")
    qing_bao = panda_by_slug.get("qing-bao")
    if bao_li is None or qing_bao is None:
        raise ValueError("Smithsonian current-pair panda rows are incomplete")
    if any(panda["evidence_status"] != "verified" for panda in (bao_li, qing_bao)):
        raise ValueError("Smithsonian current-pair panda rows are not verified")
    if qing_bao["review_status"] not in {"draft", "reviewed", "approved"}:
        raise ValueError("Qing Bao has forbidden review status")
    panda_approvals = 0
    for panda in (bao_li, qing_bao):
        if panda["review_status"] == "approved":
            continue
        if panda["review_status"] not in {"draft", "reviewed"}:
            raise ValueError("Smithsonian current-pair panda has forbidden review status")
        panda["review_status"] = "approved"
        panda_approvals += 1

    _write_csv(stage_dir / "events.csv", event_fields, events)
    _write_csv(stage_dir / "media.csv", media_fields, media)
    _write_csv(stage_dir / "pandas.csv", panda_fields, pandas)
    return {
        "event_approvals": event_approvals,
        "approved_media_additions": approved_media_additions,
        "collection_media_updates": collection_media_updates,
        "panda_approvals": panda_approvals,
    }


def _upsert_exact_media(rows: list[dict[str, str]], expected: Mapping[str, str]) -> int:
    matches = [
        row
        for row in rows
        if row["panda_slug"] == expected["panda_slug"]
        and row["source_url"] == expected["source_url"]
    ]
    if len(matches) > 1:
        raise ValueError(f"duplicate media review rows for {expected['source_url']}")
    if matches:
        current = matches[0]
        if current == dict(expected):
            return 0
        if (
            expected["review_status"] == "collection_only"
            and current.get("review_status") == "rejected"
        ):
            current.clear()
            current.update(expected)
            return 1
        raise ValueError(f"existing media row drifted for {expected['source_url']}")
    rows.append(dict(expected))
    return 1


def _publication_blockers(curation_dir: Path) -> dict[str, list[str]]:
    _, events = _read_csv(curation_dir / "events.csv")
    _, media = _read_csv(curation_dir / "media.csv")
    _, pandas = _read_csv(curation_dir / "pandas.csv")
    panda_by_slug = {row["slug"]: row for row in pandas}
    blockers: dict[str, list[str]] = {}
    for slug in ("bao-li", "qing-bao"):
        approved_events = sum(
            row["panda_slug"] == slug
            and row["review_status"] == "approved"
            and row["evidence_status"] == "verified"
            for row in events
        )
        approved_media = sum(
            row["panda_slug"] == slug and row["review_status"] in {"approved", "collection_only"}
            for row in media
        )
        reasons: list[str] = []
        if approved_events < 3:
            reasons.append(f"approved-verified-event-count={approved_events}/3")
        if approved_media < 1:
            reasons.append(f"approved-photo-count={approved_media}/1")
        if panda_by_slug[slug]["review_status"] != "approved":
            reasons.append(f"panda-review-status={panda_by_slug[slug]['review_status']}")
        blockers[slug] = reasons
    return blockers


def _read_csv(path: Path) -> tuple[tuple[str, ...], list[dict[str, str]]]:
    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        return tuple(reader.fieldnames or ()), [dict(row) for row in reader]


def _write_csv(path: Path, fields: tuple[str, ...], rows: list[dict[str, str]]) -> None:
    with path.open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fields, lineterminator="\n")
        writer.writeheader()
        writer.writerows(rows)


def _split_ids(value: str) -> set[str]:
    return {item.strip() for item in value.split(";") if item.strip()}


def _append_note(current: str, note: str) -> str:
    current = current.strip()
    if note in current:
        return current
    return f"{current} {note}".strip()


def _csv_hashes(curation_dir: Path) -> dict[str, str]:
    return {
        path.name: sha256(path.read_bytes()).hexdigest()
        for path in sorted(curation_dir.glob("*.csv"))
    }


def _commit_directory_swap(
    *,
    curation_dir: Path,
    stage_dir: Path,
    expected_sha256: dict[str, str],
) -> None:
    if _csv_hashes(curation_dir) != expected_sha256:
        raise ValueError("curation CSVs changed after staging; refusing directory swap")
    backup_dir = curation_dir.with_name(f".{curation_dir.name}.backup-{uuid4().hex}")
    os.replace(curation_dir, backup_dir)
    try:
        os.replace(stage_dir, curation_dir)
    except BaseException:
        os.replace(backup_dir, curation_dir)
        raise
    shutil.rmtree(backup_dir)


def _load_validator():
    spec = importlib.util.spec_from_file_location(
        "panda_atlas_curation_validator",
        _VALIDATOR_PATH,
    )
    if spec is None or spec.loader is None:
        raise RuntimeError("could not load repository curation validator")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    typed_module = cast(ModuleType, module)
    validator = getattr(typed_module, "validate_curation", None)
    if not callable(validator):
        raise RuntimeError("repository curation validator lacks validate_curation")
    return validator


def _write_report(output: Path, payload: dict[str, object], *, overwrite: bool) -> Path:
    root = _REPORT_ROOT.resolve()
    path = output.resolve() if output.is_absolute() else (root / output).resolve()
    try:
        path.relative_to(root)
    except ValueError as error:
        raise ValueError(f"application report must stay below {root}") from error
    if path.suffix != ".json":
        raise ValueError("application reports must use the .json suffix")
    path.parent.mkdir(parents=True, exist_ok=True)
    if path.exists() and not overwrite:
        raise FileExistsError(f"application report already exists: {path}")
    body = json.dumps(payload, ensure_ascii=False, indent=2, allow_nan=False) + "\n"
    temporary = path.with_name(f".{path.name}.{uuid4().hex}.tmp")
    try:
        temporary.write_text(body, encoding="utf-8")
        temporary.replace(path)
    finally:
        temporary.unlink(missing_ok=True)
    return path


if __name__ == "__main__":
    raise SystemExit(main())

from __future__ import annotations

import argparse
import json
import os
import shutil
import tempfile
from datetime import datetime
from pathlib import Path

from app.projection.collection_release import build_collection_release_candidate
from app.projection.public_release import PublicReleaseInput, build_public_release

REPOSITORY_ROOT = Path(__file__).resolve().parents[3]
DEFAULT_CURATION_DIR = REPOSITORY_ROOT / "data" / "curation" / "pandas"
DEFAULT_REVIEWED_ROOT = REPOSITORY_ROOT / "data" / "reviewed-batches"
DEFAULT_PUBLIC_ROOT = REPOSITORY_ROOT / "data" / "public-releases"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Compile reviewed collection curation into a deterministic reviewed batch and Public "
            "Release candidate. The command is dry-run by default and never activates D1, uploads "
            "media, or deploys the site."
        )
    )
    parser.add_argument("--base-version", required=True)
    parser.add_argument("--release-version", required=True)
    parser.add_argument("--publication-batch-id", required=True)
    parser.add_argument("--released-at", required=True, help="Timezone-aware ISO-8601 timestamp")
    parser.add_argument("--projection-code-version", default="collection-release-v1")
    parser.add_argument("--database-migration-version", default="0007")
    parser.add_argument("--curation-dir", type=Path, default=DEFAULT_CURATION_DIR)
    parser.add_argument("--reviewed-root", type=Path, default=DEFAULT_REVIEWED_ROOT)
    parser.add_argument("--public-root", type=Path, default=DEFAULT_PUBLIC_ROOT)
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument("--apply", action="store_true")
    mode.add_argument("--check", action="store_true")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    released_at = datetime.fromisoformat(args.released_at.replace("Z", "+00:00"))
    base_path = args.reviewed_root / args.base_version / "source.json"
    base_source = json.loads(base_path.read_text(encoding="utf-8"))
    candidate = build_collection_release_candidate(
        base_source_state=base_source,
        curation_dir=args.curation_dir.resolve(),
        release_version=args.release_version,
        publication_batch_id=args.publication_batch_id,
        released_at=released_at,
    )
    public_release = build_public_release(
        PublicReleaseInput(
            source_state=candidate.source_state,
            publication_batch_id=args.publication_batch_id,
            projection_code_version=args.projection_code_version,
            database_migration_version=args.database_migration_version,
            released_at=released_at,
        )
    )
    reviewed_target = args.reviewed_root / args.release_version
    public_target = args.public_root / args.release_version

    if args.check:
        _check_outputs(
            candidate=candidate,
            public_release=public_release,
            reviewed_target=reviewed_target,
            public_target=public_target,
        )
        outcome = "checked"
    elif args.apply:
        _write_outputs_atomically(
            candidate=candidate,
            public_release=public_release,
            reviewed_target=reviewed_target,
            public_target=public_target,
        )
        outcome = "applied"
    else:
        outcome = "dry-run"

    print(
        json.dumps(
            {
                "outcome": outcome,
                "report_id": candidate.report["report_id"],
                "release_version": args.release_version,
                "base_version": args.base_version,
                "reviewed_target": str(reviewed_target),
                "public_target": str(public_target),
                "summary": candidate.report["summary"],
                "manifest_record_counts": public_release.manifest["record_counts"],
                "write_boundary": candidate.report["write_boundary"],
            },
            ensure_ascii=False,
            indent=2,
        )
    )
    return 0


def _write_outputs_atomically(
    *,
    candidate,
    public_release,
    reviewed_target: Path,
    public_target: Path,
) -> None:
    if reviewed_target.exists():
        raise FileExistsError(reviewed_target)
    if public_target.exists():
        raise FileExistsError(public_target)
    reviewed_target.parent.mkdir(parents=True, exist_ok=True)
    public_target.parent.mkdir(parents=True, exist_ok=True)
    reviewed_staging_root = Path(
        tempfile.mkdtemp(prefix=".collection-release-", dir=reviewed_target.parent)
    )
    public_staging_root = Path(
        tempfile.mkdtemp(prefix=".collection-release-", dir=public_target.parent)
    )
    staged_reviewed = reviewed_staging_root / reviewed_target.name
    staged_public = public_staging_root / public_target.name
    reviewed_installed = False
    try:
        _write_reviewed_directory(candidate, staged_reviewed)
        _write_public_directory(public_release, staged_public)
        os.replace(staged_reviewed, reviewed_target)
        reviewed_installed = True
        os.replace(staged_public, public_target)
    except Exception:
        if reviewed_installed and reviewed_target.exists() and not public_target.exists():
            shutil.rmtree(reviewed_target)
        raise
    finally:
        shutil.rmtree(reviewed_staging_root, ignore_errors=True)
        shutil.rmtree(public_staging_root, ignore_errors=True)


def _write_reviewed_directory(candidate, target: Path) -> None:
    target.mkdir(parents=True, exist_ok=False)
    (target / "source.json").write_text(candidate.source_json(), encoding="utf-8", newline="")
    (target / "risk-report.json").write_text(candidate.report_json(), encoding="utf-8", newline="")


def _write_public_directory(public_release, target: Path) -> None:
    target.mkdir(parents=True, exist_ok=False)
    for filename, content in public_release.files.items():
        (target / filename).write_text(content, encoding="utf-8", newline="")
    (target / "manifest.json").write_text(
        json.dumps(
            public_release.manifest,
            ensure_ascii=False,
            indent=2,
            sort_keys=True,
            allow_nan=False,
        )
        + "\n",
        encoding="utf-8",
        newline="",
    )


def _check_outputs(
    *,
    candidate,
    public_release,
    reviewed_target: Path,
    public_target: Path,
) -> None:
    expected_reviewed = {
        "source.json": candidate.source_json(),
        "risk-report.json": candidate.report_json(),
    }
    expected_public = dict(public_release.files)
    expected_public["manifest.json"] = (
        json.dumps(
            public_release.manifest,
            ensure_ascii=False,
            indent=2,
            sort_keys=True,
            allow_nan=False,
        )
        + "\n"
    )
    _assert_directory_matches(reviewed_target, expected_reviewed)
    _assert_directory_matches(public_target, expected_public)


def _assert_directory_matches(target: Path, expected: dict[str, str]) -> None:
    if not target.is_dir():
        raise FileNotFoundError(target)
    actual_names = sorted(path.name for path in target.iterdir() if path.is_file())
    expected_names = sorted(expected)
    if actual_names != expected_names:
        raise ValueError(
            f"Generated file set drifted for {target}: expected {expected_names}, "
            f"got {actual_names}"
        )
    for filename, content in expected.items():
        path = target / filename
        if path.read_text(encoding="utf-8") != content:
            raise ValueError(f"Generated content drifted: {path}")


if __name__ == "__main__":
    raise SystemExit(main())

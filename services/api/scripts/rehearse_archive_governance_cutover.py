from __future__ import annotations

import argparse
import json
import os
from pathlib import Path

from app.archive_workbench.service import rehearsal_snapshot


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Produce a deterministic Archive governance cutover rehearsal artifact."
    )
    parser.add_argument(
        "--output",
        type=Path,
        required=True,
        help="JSON artifact path. Parent directories are created when required.",
    )
    parser.add_argument(
        "--require-go",
        action="store_true",
        help="Exit non-zero when the rehearsal reports blockers.",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    if not os.getenv("DATABASE_URL"):
        raise SystemExit("DATABASE_URL is required for a production-like rehearsal clone")
    snapshot = rehearsal_snapshot()
    payload = snapshot.model_dump(mode="json")
    args.output.parent.mkdir(parents=True, exist_ok=True)
    temporary = args.output.with_suffix(f"{args.output.suffix}.tmp")
    temporary.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )
    temporary.replace(args.output)
    print(json.dumps(payload, ensure_ascii=False, sort_keys=True))
    if args.require_go and not snapshot.go:
        return 2
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

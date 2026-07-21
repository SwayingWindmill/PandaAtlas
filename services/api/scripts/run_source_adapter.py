from __future__ import annotations

import argparse
import json
from pathlib import Path

from app.acquisition.models import ResponseEnvelope
from app.acquisition.source_registry import load_source_registry
from app.acquisition.wikimedia_commons import (
    DEFAULT_USER_AGENT,
    XI_LUN_FILE_TITLE,
    build_imageinfo_url,
    fetch_imageinfo,
    parse_xi_lun_result,
)

_API_ROOT = Path(__file__).resolve().parents[1]
_REPOSITORY_ROOT = _API_ROOT.parents[1]
_DEFAULT_FIXTURE = (
    _API_ROOT
    / "tests"
    / "acquisition"
    / "fixtures"
    / "commons-xi-lun-imageinfo.json"
)
_DEFAULT_OUTPUT = (
    _REPOSITORY_ROOT / ".release-gate" / "acquisition-sources" / "xi-lun-commons.json"
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Build a reviewed Xi Lun Wikimedia Commons metadata candidate."
    )
    parser.add_argument(
        "--live",
        action="store_true",
        help="Perform one reviewed Wikimedia Action API metadata request.",
    )
    parser.add_argument(
        "--fixture",
        type=Path,
        default=_DEFAULT_FIXTURE,
        help="Offline Action API response fixture used when --live is absent.",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=_DEFAULT_OUTPUT,
        help="Machine-readable report path.",
    )
    parser.add_argument(
        "--user-agent",
        default=DEFAULT_USER_AGENT,
        help="Descriptive Wikimedia bot User-Agent with contact information.",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    registry = load_source_registry()
    source = registry.get("wikimedia-commons-action-api")

    if args.live:
        request_url, response = fetch_imageinfo(
            registry,
            title=XI_LUN_FILE_TITLE,
            user_agent=args.user_agent,
        )
        mode = "live"
    else:
        request_url = build_imageinfo_url(source, title=XI_LUN_FILE_TITLE)
        fixture_path = args.fixture.resolve()
        if not fixture_path.is_file():
            raise FileNotFoundError(f"Commons fixture not found: {fixture_path}")
        response = ResponseEnvelope(
            requested_url=request_url,
            final_url=request_url,
            status=200,
            headers={
                "content-type": "application/json; charset=utf-8",
                "x-panda-atlas-fixture": fixture_path.name,
            },
            body=fixture_path.read_bytes(),
        )
        mode = "fixture"

    result = parse_xi_lun_result(
        registry,
        response,
        request_url=request_url,
        user_agent=args.user_agent,
    )
    report = result.to_dict()
    report["mode"] = mode
    report["fixture"] = None if args.live else str(args.fixture.resolve())

    output_path = args.output.resolve()
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(
        json.dumps(report, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(
        json.dumps(
            {
                "outcome": report["outcome"],
                "mode": mode,
                "output": str(output_path),
                "candidate": report["candidate"]["panda_name_en"],
                "license": report["candidate"]["license_short_name"],
                "original_image_downloaded": report["candidate"][
                    "original_image_downloaded"
                ],
            },
            ensure_ascii=False,
            indent=2,
        )
    )


if __name__ == "__main__":
    main()

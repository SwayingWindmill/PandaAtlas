from __future__ import annotations

import argparse
import json
from pathlib import Path

from app.acquisition.poc import write_comparison_report


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run the offline Scrapy/Scrapling comparison PoC.")
    parser.add_argument(
        "--output",
        type=Path,
        default=Path("../../.release-gate/crawler-poc/report.json"),
        help="Machine-readable report path, relative to services/api by default.",
    )
    parser.add_argument(
        "--browser-lab",
        action="store_true",
        help="Run the loopback-only Scrapling HTTP/browser/stealth capability lab.",
    )
    parser.add_argument(
        "--require-browser-lab",
        action="store_true",
        help="Fail when the loopback browser runtime is unavailable.",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    report = write_comparison_report(
        args.output.resolve(),
        include_browser_lab=args.browser_lab or args.require_browser_lab,
        require_browser_lab=args.require_browser_lab,
    )
    print(
        json.dumps(
            {
                "outcome": report["outcome"],
                "output": str(args.output.resolve()),
                "primary_orchestrator": report["decision"]["primary_orchestrator"],
                "specialized_adapter": report["decision"]["specialized_adapter"],
            },
            ensure_ascii=False,
            indent=2,
        )
    )


if __name__ == "__main__":
    main()

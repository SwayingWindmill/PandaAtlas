from __future__ import annotations

import argparse
import json
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any, Iterable

ROOT = Path(__file__).resolve().parents[2]
RESEARCH_ROOT = ROOT / "data" / "local-panda-research"
DEFAULT_CANDIDATES = RESEARCH_ROOT / "media" / "candidates.jsonl"
DEFAULT_RECORDS_DIR = RESEARCH_ROOT / "records"
DEFAULT_OUTPUT = RESEARCH_ROOT / "reports" / "coverage-gaps.json"


def read_jsonl(path: Path) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    with path.open("r", encoding="utf-8-sig") as handle:
        for line_number, raw_line in enumerate(handle, start=1):
            line = raw_line.strip()
            if not line:
                continue
            value = json.loads(line)
            if not isinstance(value, dict):
                raise ValueError(f"{path}:{line_number}: expected JSON object")
            rows.append(value)
    return rows


def iter_record_rows(records_dir: Path) -> Iterable[dict[str, Any]]:
    for path in sorted(records_dir.glob("*.jsonl")):
        yield from read_jsonl(path)


def panda_subject_ids(candidate: dict[str, Any]) -> set[str]:
    media_kind = str(candidate.get("media_kind") or "")
    result = {
        str(subject_id)
        for subject_id in candidate.get("related_subject_ids") or []
        if isinstance(subject_id, str) and subject_id
    }
    subject_id = str(candidate.get("subject_id") or "")
    if media_kind == "individual_panda" and subject_id:
        result.add(subject_id)
    return {
        subject_id
        for subject_id in result
        if not subject_id.startswith(("topic-", "historic-", "group-", "unresolved-"))
    }


def build_report(candidates: list[dict[str, Any]], records: Iterable[dict[str, Any]]) -> dict[str, Any]:
    media_counts: Counter[str] = Counter()
    labels: dict[str, str] = {}
    for candidate in candidates:
        subject_ids = panda_subject_ids(candidate)
        for subject_id in subject_ids:
            media_counts[subject_id] += 1
            if len(subject_ids) == 1:
                label = str(candidate.get("subject_label") or "")
                if label and " / " not in label:
                    labels.setdefault(subject_id, label)

    record_counts: Counter[str] = Counter()
    direct_counts: Counter[str] = Counter()
    categories: dict[str, Counter[str]] = defaultdict(Counter)
    for record in records:
        subject = record.get("subject")
        if not isinstance(subject, dict) or subject.get("type") != "panda":
            continue
        subject_id = str(subject.get("id") or "")
        if not subject_id:
            continue
        labels.setdefault(subject_id, str(subject.get("label") or subject_id))
        record_counts[subject_id] += 1
        if record.get("evidence_level") == "direct":
            direct_counts[subject_id] += 1
        category = str(record.get("category") or "unknown")
        categories[subject_id][category] += 1

    rows: list[dict[str, Any]] = []
    for subject_id, media_count in media_counts.items():
        facts = record_counts[subject_id]
        direct = direct_counts[subject_id]
        category_count = len(categories[subject_id])
        score = media_count * 5 - direct * 3 - category_count * 2
        rows.append(
            {
                "subject_id": subject_id,
                "subject_label": labels.get(subject_id, subject_id),
                "media_count": media_count,
                "record_count": facts,
                "direct_record_count": direct,
                "category_count": category_count,
                "categories": dict(sorted(categories[subject_id].items())),
                "coverage_gap_score": score,
            }
        )

    rows.sort(
        key=lambda row: (
            -int(row["coverage_gap_score"]),
            -int(row["media_count"]),
            int(row["direct_record_count"]),
            str(row["subject_id"]),
        )
    )
    return {
        "schema_version": 1,
        "candidate_count": len(candidates),
        "pandas_with_media": len(media_counts),
        "pandas_with_media_and_no_records": sum(1 for row in rows if row["record_count"] == 0),
        "ranked_gaps": rows,
    }


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Rank panda subjects whose media coverage exceeds fact coverage.")
    parser.add_argument("--candidates", type=Path, default=DEFAULT_CANDIDATES)
    parser.add_argument("--records-dir", type=Path, default=DEFAULT_RECORDS_DIR)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--limit", type=int, default=25)
    return parser.parse_args()


def resolve(path: Path) -> Path:
    return path if path.is_absolute() else ROOT / path


def main() -> int:
    args = parse_args()
    candidates = read_jsonl(resolve(args.candidates))
    report = build_report(candidates, iter_record_rows(resolve(args.records_dir)))
    output = resolve(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    print(
        "Local panda coverage audit passed: "
        f"candidates={report['candidate_count']}, pandas_with_media={report['pandas_with_media']}, "
        f"no_fact_records={report['pandas_with_media_and_no_records']}, output={output.relative_to(ROOT)}."
    )
    for row in report["ranked_gaps"][: max(args.limit, 0)]:
        print(
            f"{row['subject_id']}\tmedia={row['media_count']}\t"
            f"direct={row['direct_record_count']}\tcategories={row['category_count']}\t"
            f"score={row['coverage_gap_score']}\t{row['subject_label']}"
        )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

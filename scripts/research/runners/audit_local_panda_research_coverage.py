from __future__ import annotations

import argparse
import json
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any, Iterable

ROOT = Path(__file__).resolve().parents[3]
RESEARCH_ROOT = ROOT / "data" / "local-panda-research"
DEFAULT_CANDIDATES = RESEARCH_ROOT / "media" / "candidates.jsonl"
DEFAULT_RECORDS_DIR = RESEARCH_ROOT / "records"
DEFAULT_IMPORTS_DIR = RESEARCH_ROOT / "imports"
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


def iter_import_record_rows(imports_dir: Path) -> Iterable[dict[str, Any]]:
    for path in sorted(imports_dir.glob("*.json")):
        try:
            payload = json.loads(path.read_text(encoding="utf-8-sig"))
        except (UnicodeDecodeError, json.JSONDecodeError):
            continue
        if not isinstance(payload, dict) or not isinstance(payload.get("records"), list):
            continue
        for row in payload["records"]:
            if isinstance(row, dict):
                yield row


def iter_import_source_rows(imports_dir: Path) -> Iterable[dict[str, Any]]:
    for path in sorted(imports_dir.glob("*.json")):
        try:
            payload = json.loads(path.read_text(encoding="utf-8-sig"))
        except (UnicodeDecodeError, json.JSONDecodeError):
            continue
        if not isinstance(payload, dict) or not isinstance(payload.get("sources"), list):
            continue
        for row in payload["sources"]:
            if isinstance(row, dict):
                yield row


def iter_import_media_rows(imports_dir: Path) -> Iterable[dict[str, Any]]:
    for path in sorted(imports_dir.glob("*-media.jsonl")):
        yield from read_jsonl(path)


def unique_rows(rows: Iterable[dict[str, Any]], id_key: str) -> list[dict[str, Any]]:
    result: list[dict[str, Any]] = []
    seen: set[str] = set()
    for row in rows:
        row_id = str(row.get(id_key) or "")
        if not row_id:
            row_id = json.dumps(row, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
        if row_id in seen:
            continue
        seen.add(row_id)
        result.append(row)
    return result


def inferred_source_family(source: dict[str, Any]) -> str:
    source_id = str(source.get("source_id") or "")
    explicit = str(source.get("source_family") or "")
    if explicit:
        return explicit
    publisher = str(source.get("publisher") or "").casefold()
    url = str(source.get("url") or "").casefold()
    if publisher == "pandapia" or "pandapia" in source_id.casefold() or "pandapia.com" in url:
        return "pandapia-profile-network"
    return source_id


def supporting_panda_subject_ids(candidate: dict[str, Any]) -> set[str]:
    result = {
        str(subject_id)
        for subject_id in candidate.get("related_subject_ids") or []
        if isinstance(subject_id, str) and subject_id
    }
    subject_id = str(candidate.get("subject_id") or "")
    if str(candidate.get("media_kind") or "") == "individual_panda" and subject_id:
        result.add(subject_id)
    return {
        panda_id
        for panda_id in result
        if not panda_id.startswith(("topic-", "historic-", "group-", "unresolved-"))
    }


def individual_panda_subject_id(candidate: dict[str, Any]) -> str | None:
    if str(candidate.get("media_kind") or "") != "individual_panda":
        return None
    if candidate.get("subject_depiction_confirmed") is False:
        return None
    subject_id = str(candidate.get("subject_id") or "")
    if not subject_id or subject_id.startswith(("topic-", "historic-", "group-", "unresolved-")):
        return None
    return subject_id


def build_report(
    candidates: list[dict[str, Any]],
    records: Iterable[dict[str, Any]],
    source_family_by_id: dict[str, str] | None = None,
) -> dict[str, Any]:
    source_family_by_id = source_family_by_id or {}
    individual_media_counts: Counter[str] = Counter()
    supporting_media_counts: Counter[str] = Counter()
    labels: dict[str, str] = {}

    for candidate in candidates:
        for subject_id in supporting_panda_subject_ids(candidate):
            supporting_media_counts[subject_id] += 1

        subject_id = individual_panda_subject_id(candidate)
        if subject_id is None:
            continue
        individual_media_counts[subject_id] += 1
        label = str(candidate.get("subject_label") or "")
        if label:
            labels.setdefault(subject_id, label)

    record_counts: Counter[str] = Counter()
    direct_counts: Counter[str] = Counter()
    source_ids: dict[str, set[str]] = defaultdict(set)
    source_families: dict[str, set[str]] = defaultdict(set)
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
        source_id = str(record.get("source_id") or "")
        if source_id:
            source_ids[subject_id].add(source_id)
            source_families[subject_id].add(source_family_by_id.get(source_id, source_id))
        category = str(record.get("category") or "unknown")
        categories[subject_id][category] += 1

    ranked_gaps: list[dict[str, Any]] = []
    for subject_id, media_count in individual_media_counts.items():
        facts = record_counts[subject_id]
        direct = direct_counts[subject_id]
        category_count = len(categories[subject_id])
        source_count = len(source_families[subject_id])
        score = media_count * 5 - direct * 3 - category_count * 2 + (4 if source_count <= 1 else 0)
        ranked_gaps.append(
            {
                "subject_id": subject_id,
                "subject_label": labels.get(subject_id, subject_id),
                "media_count": media_count,
                "record_count": facts,
                "direct_record_count": direct,
                "source_count": source_count,
                "source_id_count": len(source_ids[subject_id]),
                "single_source_only": source_count <= 1,
                "category_count": category_count,
                "categories": dict(sorted(categories[subject_id].items())),
                "coverage_gap_score": score,
            }
        )

    missing_individual_media: list[dict[str, Any]] = []
    for subject_id, facts in record_counts.items():
        if individual_media_counts[subject_id] > 0:
            continue
        missing_individual_media.append(
            {
                "subject_id": subject_id,
                "subject_label": labels.get(subject_id, subject_id),
                "record_count": facts,
                "direct_record_count": direct_counts[subject_id],
                "source_count": len(source_families[subject_id]),
                "source_id_count": len(source_ids[subject_id]),
                "single_source_only": len(source_families[subject_id]) <= 1,
                "category_count": len(categories[subject_id]),
                "categories": dict(sorted(categories[subject_id].items())),
                "supporting_non_individual_media_count": supporting_media_counts[subject_id],
            }
        )

    ranked_gaps.sort(
        key=lambda row: (
            -int(row["coverage_gap_score"]),
            -int(row["media_count"]),
            int(row["source_count"]),
            int(row["direct_record_count"]),
            str(row["subject_id"]),
        )
    )
    missing_individual_media.sort(
        key=lambda row: (
            -int(row["direct_record_count"]),
            -int(row["category_count"]),
            str(row["subject_id"]),
        )
    )

    return {
        "schema_version": 4,
        "candidate_count": len(candidates),
        "pandas_with_facts": len(record_counts),
        "pandas_with_media": len(individual_media_counts),
        "pandas_with_media_and_no_records": sum(
            1 for row in ranked_gaps if row["record_count"] == 0
        ),
        "pandas_with_facts_and_no_individual_media": len(missing_individual_media),
        "missing_individual_media": missing_individual_media,
        "ranked_gaps": ranked_gaps,
    }


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Audit individual-image coverage and rank panda subjects whose media coverage "
            "exceeds fact coverage."
        )
    )
    parser.add_argument("--candidates", type=Path, default=DEFAULT_CANDIDATES)
    parser.add_argument("--records-dir", type=Path, default=DEFAULT_RECORDS_DIR)
    parser.add_argument("--imports-dir", type=Path, default=DEFAULT_IMPORTS_DIR)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--limit", type=int, default=25)
    return parser.parse_args()


def resolve(path: Path) -> Path:
    return path if path.is_absolute() else ROOT / path


def main() -> int:
    args = parse_args()
    candidates_path = resolve(args.candidates)
    legacy_candidates = read_jsonl(candidates_path) if candidates_path.exists() else []
    imports_dir = resolve(args.imports_dir)
    import_media = list(iter_import_media_rows(imports_dir))
    candidates = unique_rows([*legacy_candidates, *import_media], "media_id")
    import_sources = unique_rows(iter_import_source_rows(imports_dir), "source_id")
    source_family_by_id = {
        str(source["source_id"]): inferred_source_family(source)
        for source in import_sources
        if source.get("source_id")
    }
    records = unique_rows(
        [
            *iter_record_rows(resolve(args.records_dir)),
            *iter_import_record_rows(imports_dir),
        ],
        "record_id",
    )
    report = build_report(candidates, records, source_family_by_id)
    report["legacy_candidate_rows"] = len(legacy_candidates)
    report["import_media_rows"] = len(import_media)
    report["deduplicated_source_rows"] = len(import_sources)
    report["deduplicated_record_rows"] = len(records)
    output = resolve(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    print(
        "Local panda coverage audit passed: "
        f"candidates={report['candidate_count']}, pandas_with_media={report['pandas_with_media']}, "
        f"no_fact_records={report['pandas_with_media_and_no_records']}, "
        f"facts_without_individual_media={report['pandas_with_facts_and_no_individual_media']}, "
        f"output={output.relative_to(ROOT)}."
    )
    for row in report["missing_individual_media"][: max(args.limit, 0)]:
        print(
            f"MISSING_IMAGE\t{row['subject_id']}\tdirect={row['direct_record_count']}\t"
            f"sources={row['source_count']}\tcategories={row['category_count']}\tsupporting_media="
            f"{row['supporting_non_individual_media_count']}\t{row['subject_label']}"
        )
    for row in report["ranked_gaps"][: max(args.limit, 0)]:
        print(
            f"{row['subject_id']}\tmedia={row['media_count']}\t"
            f"direct={row['direct_record_count']}\tsources={row['source_count']}\t"
            f"categories={row['category_count']}\t"
            f"score={row['coverage_gap_score']}\t{row['subject_label']}"
        )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

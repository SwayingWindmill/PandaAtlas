from __future__ import annotations

from collections import defaultdict
from datetime import datetime, timezone
import json
from pathlib import Path
import re
import sys
from typing import Any

ROOT = Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from scripts.research.audit_local_panda_research_coverage import (
    _canonical_subject_aliases,
    _canonical_subject_id,
    media_row_is_confirmed_subject_depiction,
    unique_rows,
)
from scripts.research.build_information_collection_queue import (
    SYSTEM_PATH,
    _life_status_value,
    _load_vault,
    _record_subject,
    build_report,
)

OUTPUT = ROOT / ".ai-bridge/fan-v08-research-catalog.json"
YEAR_RE = re.compile(r"(?<!\d)(18\d{2}|19\d{2}|20\d{2})(?!\d)")
CJK_RE = re.compile(r"[\u3400-\u9fff]")


def _clean_name(value: str) -> str:
    value = value.strip()
    value = re.sub(r"\s*[（(].*$", "", value).strip()
    return value


def _names_from_label(label: str, subject_id: str) -> tuple[str, str | None]:
    parts = [_clean_name(part) for part in label.split(" / ") if _clean_name(part)]
    if len(parts) >= 2:
        cjk = next((part for part in parts if CJK_RE.search(part)), None)
        latin = next((part for part in parts if not CJK_RE.search(part)), None)
        if cjk:
            return cjk, latin
    cleaned = _clean_name(label)
    if CJK_RE.search(cleaned):
        return cleaned, None
    fallback = " ".join(part.capitalize() for part in subject_id.split("-") if part)
    return cleaned or fallback, cleaned if cleaned and cleaned != fallback else None


def _normalize_sex(value: Any) -> str | None:
    if not isinstance(value, str):
        return None
    normalized = value.strip().casefold().replace("_", " ")
    if normalized in {"female", "f", "雌性", "雌"}:
        return "female"
    if normalized in {"male", "m", "雄性", "雄"}:
        return "male"
    return None


def _subject_sex(rows: list[dict[str, Any]]) -> str:
    values: set[str] = set()
    for row in rows:
        predicate = str(row.get("predicate") or "").casefold()
        value = row.get("value")
        candidate: Any = None
        if predicate in {"sex", "gender", "biological_sex"}:
            candidate = value
        elif isinstance(value, dict):
            candidate = value.get("sex") or value.get("gender")
        normalized = _normalize_sex(candidate)
        if normalized:
            values.add(normalized)
    return next(iter(values)) if len(values) == 1 else "unknown"


def _subject_status(rows: list[dict[str, Any]]) -> str:
    explicit: set[str] = set()
    death_evidence = False
    for row in rows:
        status = _life_status_value(row)
        if status in {"alive", "living", "in_life"}:
            explicit.add("alive")
        elif status in {"deceased", "dead", "died"}:
            explicit.add("deceased")
        category = str(row.get("category") or "").casefold()
        predicate = str(row.get("predicate") or "").casefold()
        if category == "death" or predicate in {"death_date", "death_month", "date_of_death"} or predicate.startswith("death_"):
            death_evidence = True
    if len(explicit) > 1:
        return "unknown"
    if explicit == {"deceased"}:
        return "deceased"
    if explicit == {"alive"} and not death_evidence:
        return "alive"
    if not explicit and death_evidence:
        return "deceased"
    return "unknown"


def _extract_birth_year(rows: list[dict[str, Any]]) -> str | None:
    years: list[str] = []
    for row in rows:
        predicate = str(row.get("predicate") or "").casefold()
        value = row.get("value")
        candidates: list[Any] = []
        if predicate in {"birth_date", "date_of_birth", "birth_year", "birth"}:
            candidates.append(value)
        if isinstance(value, dict):
            for key in ("birth_date", "date_of_birth", "birth_year"):
                if key in value:
                    candidates.append(value[key])
        for candidate in candidates:
            match = YEAR_RE.search(str(candidate or ""))
            if match:
                years.append(match.group(1))
    if not years:
        return None
    counts: dict[str, int] = defaultdict(int)
    for year in years:
        counts[year] += 1
    return sorted(counts, key=lambda year: (-counts[year], year))[0]


def _media_score(row: dict[str, Any]) -> tuple[int, float, int]:
    rights_state = str(row.get("rights_state") or "").casefold()
    rights_rank = {
        "public_domain": 5,
        "open_license": 5,
        "licensed": 5,
        "permission_granted": 5,
        "restricted": 3,
        "unknown": 2,
    }.get(rights_state, 1)
    confidence = float(row.get("identity_confidence") or 0)
    direct_asset = 1 if row.get("asset_url") else 0
    return rights_rank, confidence, direct_asset


def main() -> None:
    records, sources, media = _load_vault()
    system = json.loads(SYSTEM_PATH.read_text(encoding="utf-8"))
    report = build_report(records, sources, media, system)
    aliases = _canonical_subject_aliases(records)

    rows_by_subject: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for row in records:
        subject = _record_subject(row)
        if subject is None:
            continue
        raw_subject_id, _ = subject
        rows_by_subject[_canonical_subject_id(raw_subject_id, aliases)].append(row)

    media_by_subject: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for row in unique_rows(media, "media_id"):
        if not media_row_is_confirmed_subject_depiction(row):
            continue
        raw_subject_id = str(row.get("subject_id") or "").strip()
        asset_url = str(row.get("asset_url") or row.get("url") or "").strip()
        if not raw_subject_id or not asset_url.startswith(("https://", "http://")):
            continue
        subject_id = _canonical_subject_id(raw_subject_id, aliases)
        media_by_subject[subject_id].append(row)

    pandas: list[dict[str, Any]] = []
    media_subject_count = 0
    for queue_row in report["next_queue"]:
        subject_id = str(queue_row["subject_id"])
        label = str(queue_row["subject_label"])
        name_zh, name_en = _names_from_label(label, subject_id)
        subject_rows = rows_by_subject.get(subject_id, [])
        p0_status = queue_row["p0_status"]
        media_rows = sorted(media_by_subject.get(subject_id, []), key=_media_score, reverse=True)
        media_row = media_rows[0] if media_rows else None
        if media_row:
            media_subject_count += 1
        pandas.append(
            {
                "id": subject_id,
                "slug": subject_id,
                "label": label,
                "name_zh": name_zh,
                "name_en": name_en,
                "gender": _subject_sex(subject_rows) if p0_status.get("sex_or_explicit_unknown") == "present" else "unknown",
                "status": _subject_status(subject_rows) if p0_status.get("life_status") == "present" else "unknown",
                "birth_year": _extract_birth_year(subject_rows) if p0_status.get("birth_date_or_explicit_unknown") == "present" else None,
                "record_count": int(queue_row["record_count"]),
                "direct_record_count": int(queue_row["direct_record_count"]),
                "source_family_count": int(queue_row["source_family_count"]),
                "individual_media_count": int(queue_row["individual_media_count"]),
                "p0_status": queue_row["p0_status"],
                "media": None
                if media_row is None
                else {
                    "url": media_row.get("asset_url") or media_row.get("url"),
                    "credit": media_row.get("credit"),
                    "rights": media_row.get("rights_label") or media_row.get("rights_state"),
                    "source_url": media_row.get("source_page_url"),
                    "media_id": media_row.get("media_id"),
                },
            }
        )

    payload = {
        "schema_version": 1,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "scope": "local prototype only; research/acquisition subjects are not equivalent to published PublicRead profiles",
        "summary": {
            "subject_count": len(pandas),
            "subjects_with_confirmed_media": media_subject_count,
            "subjects_without_confirmed_media": len(pandas) - media_subject_count,
            "direct_zero_subject_count": report["summary"]["direct_zero_subject_count"],
        },
        "pandas": pandas,
    }
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    print(
        "Fan V8 research catalog built: "
        f"subjects={len(pandas)}, media={media_subject_count}, "
        f"no_media={len(pandas) - media_subject_count}, output={OUTPUT.relative_to(ROOT)}"
    )


if __name__ == "__main__":
    main()

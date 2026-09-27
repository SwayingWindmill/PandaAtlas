#!/usr/bin/env python3
from __future__ import annotations

import json
import re
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any

from fan_v08_media_policy import media_is_hero_usable

ROOT = Path(__file__).resolve().parents[2]
CATALOG_PATH = ROOT / ".ai-bridge" / "fan-v08-research-catalog.json"
DETAILS_PATH = ROOT / ".ai-bridge" / "fan-v08-research-details.json"
OUTPUT_PATH = ROOT / ".ai-bridge" / "fan-v08-detail-profile-audit.json"
DIRTY_COPY_PATTERNS = [
    re.compile(pattern, re.I)
    for pattern in (
        r"\bSubject\b",
        r"事实层|媒体发现层|采集层|关系层|繁殖轴|可查询繁殖范围",
        r"^(?:新增|补齐|补录|补入|补(?:兰田|思缘|盛林|姬姬|晓晓|卧龙)|直接整理|接回|复用|显式把|强来源补充)",
        r"不修改生物学母亲|不把野培状态误写成已放归",
        r"旧批次|采集任务|来源记录(?:为|称)|显式把",
    )
]
FAMILY_TEXT_RE = re.compile(
    r"母亲|父亲|父母|双胞胎|同胞|兄弟|姐妹|女儿|儿子|幼崽|幼仔|后代|"
    r"\bmother\b|\bfather\b|\bparent\b|\btwin\b|\bsibling\b|\bdaughter\b|\bson\b|\boffspring\b",
    re.I,
)
FAMILY_PREDICATE_RE = re.compile(
    r"mother|father|parent|twin|sibling|daughter|son|offspring|child|maternal|paternal",
    re.I,
)
LOCATION_TEXT_RE = re.compile(r"出生于|生活在|居住在|入住|抵达|来到|返回|圈舍|基地|动物园|保护区")
BIRTHPLACE_TEXT_RE = re.compile(
    r"出生地|出生在|出生于(?!\d{4}(?:年|[-/]))|生于(?!\d{4}(?:年|[-/]))|"
    r"在(?!\d)(?=[^，。；]{1,36}(?:园|基地|中心|圣迭戈|重庆|新加坡|中国|宝兴))"
    r"[^，。；]{1,36}(?:出生|诞生)|\bborn\s+(?:at|in)\b",
    re.I,
)
BIRTHPLACE_NONSPECIFIC_RE = re.compile(
    r"(?:未载|未注明|未说明|不详|未知)[^，。；]{0,12}出生地|"
    r"出生于野外|出生在中国|在中国出生|中国大熊猫保护研究中心所属基地",
    re.I,
)


def load_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8-sig"))


def fact_text(fact: dict[str, Any]) -> str:
    return " ".join(
        str(value).strip()
        for value in (fact.get("summary_zh"), fact.get("summary_en"))
        if value
    )


def is_subject_birth_fact(fact: dict[str, Any]) -> bool:
    if fact.get("category") not in {"birth", "birth_event"}:
        return False
    date = str(fact.get("date") or "")
    if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", date):
        return False
    predicate = str(fact.get("predicate") or "").casefold()
    if predicate in {
        "birth_profile",
        "birth_event",
        "birth_datetime",
        "birth_date_or_year",
        "birth_order_and_weight",
        "birth_order_weight_and_interval",
        "birth_record_upgrade",
        "contemporaneous_birth_event_resolution",
        "official_birth_date",
    }:
        return True
    return predicate.startswith("birth_date_") and "estimate" not in predicate


def has_family_evidence(fact: dict[str, Any]) -> bool:
    category = str(fact.get("category") or "").casefold()
    predicate = str(fact.get("predicate") or "")
    text = fact_text(fact)
    # Audit only records that are explicitly relation-shaped. Narrative mentions of
    # mothers/twins in behaviour, media or milestone copy are useful context but do
    # not by themselves justify a clickable biological-family edge.
    return category in {"relationship", "lineage", "social_relationship"} and (
        bool(FAMILY_PREDICATE_RE.search(predicate)) or bool(FAMILY_TEXT_RE.search(text))
    )


def issue(code: str, severity: str, **extra: Any) -> dict[str, Any]:
    return {"code": code, "severity": severity, **extra}


def main() -> None:
    catalog = load_json(CATALOG_PATH)
    details = load_json(DETAILS_PATH)
    pandas = catalog.get("pandas", [])
    subjects = details.get("subjects", {})
    known_slugs = {str(p.get("slug")) for p in pandas if p.get("slug")}

    results: list[dict[str, Any]] = []
    issue_counts: Counter[str] = Counter()
    severity_counts: Counter[str] = Counter()
    category_counts: defaultdict[str, Counter[str]] = defaultdict(Counter)

    for panda in pandas:
        subject_id = str(panda.get("id"))
        slug = str(panda.get("slug"))
        detail = subjects.get(subject_id) or {}
        highlights = detail.get("highlights") or []
        facts = detail.get("facts") if "facts" in detail else highlights
        relations = detail.get("relations") or []
        media = detail.get("media") or []
        core = detail.get("core") or {}
        panda_issues: list[dict[str, Any]] = []

        if not detail:
            panda_issues.append(issue("missing_detail_projection", "critical"))
        elif panda.get("record_count", 0) and not facts and not core and not relations:
            direct_count = int(panda.get("direct_record_count", 0) or 0)
            safe_direct_count = int(detail.get("safe_direct_record_count", 0) or 0)
            public_highlights = [
                item
                for item in highlights
                if str(item.get("category") or "").casefold() not in {"media_candidate", "media_discovery"}
            ]
            if public_highlights:
                panda_issues.append(
                    issue(
                        "public_highlights_not_promoted_to_profile_fields",
                        "warning",
                        record_count=panda.get("record_count", 0),
                        direct_record_count=direct_count,
                        safe_direct_record_count=safe_direct_count,
                        examples=[fact_text(item)[:180] for item in public_highlights[:3]],
                    )
                )
            elif safe_direct_count:
                panda_issues.append(
                    issue(
                        "safe_direct_records_without_public_profile_payload",
                        "info",
                        record_count=panda.get("record_count", 0),
                        direct_record_count=direct_count,
                        safe_direct_record_count=safe_direct_count,
                    )
                )
            elif direct_count:
                panda_issues.append(
                    issue(
                        "catalog_direct_records_below_detail_threshold",
                        "info",
                        record_count=panda.get("record_count", 0),
                        direct_record_count=direct_count,
                    )
                )
            else:
                panda_issues.append(
                    issue(
                        "sparse_profile_without_public_fact_payload",
                        "info",
                        record_count=panda.get("record_count", 0),
                        direct_record_count=0,
                    )
                )

        family_facts = [fact for fact in facts if has_family_evidence(fact)]
        if family_facts and not relations:
            panda_issues.append(
                issue(
                    "family_evidence_without_structured_relation",
                    "warning",
                    evidence_count=len(family_facts),
                    examples=[fact_text(fact)[:220] for fact in family_facts[:3]],
                )
            )

        for relation in relations:
            target_slug = relation.get("target_slug")
            if target_slug and target_slug == slug:
                panda_issues.append(
                    issue(
                        "self_relation",
                        "critical",
                        kind=relation.get("kind"),
                        target_slug=target_slug,
                    )
                )
            elif target_slug and target_slug not in known_slugs:
                panda_issues.append(
                    issue(
                        "relation_target_missing_from_catalog",
                        "critical",
                        kind=relation.get("kind"),
                        target_slug=target_slug,
                    )
                )

        hero_usable_media = [item for item in media if media_is_hero_usable(item)]
        non_hero_media = [item for item in media if item.get("url") and not media_is_hero_usable(item)]
        catalog_media = panda.get("media") or None
        if catalog_media and not media_is_hero_usable(catalog_media):
            panda_issues.append(
                issue(
                    "catalog_selected_media_not_hero_usable",
                    "warning",
                    media_id=catalog_media.get("media_id"),
                    url=catalog_media.get("url"),
                )
            )
        if non_hero_media:
            panda_issues.append(
                issue(
                    "detail_media_not_hero_usable",
                    "info",
                    count=len(non_hero_media),
                    media_ids=[item.get("id") for item in non_hero_media[:8]],
                )
            )
        if panda.get("individual_media_count", 0) and not media:
            panda_issues.append(
                issue(
                    "catalog_media_missing_from_detail_projection",
                    "critical",
                    individual_media_count=panda.get("individual_media_count"),
                )
            )
        elif panda.get("individual_media_count", 0) and not hero_usable_media:
            panda_issues.append(
                issue(
                    "subject_has_media_but_no_hero_usable_photo",
                    "warning",
                    individual_media_count=panda.get("individual_media_count"),
                )
            )

        sex_facts = [fact for fact in facts if fact.get("category") == "sex"]
        unresolved_sex_facts = [
            fact
            for fact in sex_facts
            if re.search(
                r"(?:initial|preliminary|pending|sex_status)|(?:初步|待定|待确认|尚未确认)",
                f"{fact.get('predicate') or ''} {fact_text(fact)}",
                re.I,
            )
        ]
        final_sex_facts = [fact for fact in sex_facts if fact not in unresolved_sex_facts]
        if not core.get("sex") and panda.get("gender") in (None, "unknown") and final_sex_facts:
            panda_issues.append(
                issue(
                    "sex_evidence_not_promoted_to_core",
                    "warning",
                    examples=[fact_text(fact)[:180] for fact in final_sex_facts[:2]],
                )
            )
        elif not core.get("sex") and panda.get("gender") in (None, "unknown") and unresolved_sex_facts:
            panda_issues.append(
                issue(
                    "sex_evidence_awaiting_confirmation",
                    "info",
                    examples=[fact_text(fact)[:180] for fact in unresolved_sex_facts[:2]],
                )
            )

        birth_facts = [fact for fact in facts if fact.get("category") == "birth"]
        subject_birth_facts = [fact for fact in facts if is_subject_birth_fact(fact)]
        if not (core.get("birth_date") or panda.get("birth_year")) and subject_birth_facts:
            panda_issues.append(
                issue(
                    "dated_birth_evidence_not_promoted_to_core",
                    "warning",
                    dates=sorted({str(fact.get("date")) for fact in subject_birth_facts if fact.get("date")})[:5],
                )
            )

        subject_death_facts = [
            fact
            for fact in facts
            if fact.get("category") == "death"
            and re.search(r"(?:^|_)(?:death|deceased|stillborn)(?:_|$)|cause_of_death", str(fact.get("predicate") or ""), re.I)
            and not re.search(r"cub_loss|offspring|litter", str(fact.get("predicate") or ""), re.I)
        ]
        effective_status = core.get("life_status") or panda.get("status") or "unknown"
        if effective_status == "unknown" and not core.get("death_date") and subject_death_facts:
            panda_issues.append(
                issue(
                    "subject_death_fact_not_promoted_to_status",
                    "critical",
                    examples=[fact_text(fact)[:220] for fact in subject_death_facts[:2]],
                )
            )

        place_facts = [
            fact
            for fact in facts
            if fact.get("category") in {"location", "residence", "residency_history", "transfer"}
            or LOCATION_TEXT_RE.search(fact_text(fact))
        ]
        if not core.get("birthplace") and any(
            BIRTHPLACE_TEXT_RE.search(fact_text(fact))
            and not BIRTHPLACE_NONSPECIFIC_RE.search(fact_text(fact))
            for fact in facts
            if fact.get("category") in {"birth", "birth_event"}
        ):
            panda_issues.append(issue("birthplace_text_not_promoted_to_core", "info"))
        if place_facts and not any(fact.get("category") in {"location", "residence", "residency_history"} for fact in facts):
            category_counts["location"]["transfer_only_place_evidence"] += 1

        dirty_facts = [
            fact
            for fact in facts
            if any(pattern.search(fact_text(fact)) for pattern in DIRTY_COPY_PATTERNS)
        ]
        if dirty_facts:
            panda_issues.append(
                issue(
                    "internal_or_acquisition_copy_in_projection",
                    "warning",
                    count=len(dirty_facts),
                    examples=[fact_text(fact)[:260] for fact in dirty_facts[:3]],
                )
            )

        if panda_issues:
            for item in panda_issues:
                issue_counts[item["code"]] += 1
                severity_counts[item["severity"]] += 1
            results.append(
                {
                    "id": subject_id,
                    "slug": slug,
                    "label": panda.get("label"),
                    "name_zh": panda.get("name_zh"),
                    "record_count": panda.get("record_count", 0),
                    "direct_record_count": panda.get("direct_record_count", 0),
                    "relation_count": len(relations),
                    "fact_count": len(facts),
                    "detail_media_count": len(media),
                    "hero_usable_media_count": len(hero_usable_media),
                    "issues": panda_issues,
                }
            )

    report = {
        "schema_version": 1,
        "catalog_subject_count": len(pandas),
        "detail_subject_count": len(subjects),
        "subjects_with_any_issue": len(results),
        "subjects_without_flagged_issue": len(pandas) - len(results),
        "severity_counts": dict(severity_counts),
        "issue_counts": dict(issue_counts.most_common()),
        "category_counts": {key: dict(value) for key, value in category_counts.items()},
        "subjects": results,
    }
    OUTPUT_PATH.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")

    print(
        "FAN_V08_DETAIL_PROFILE_AUDIT "
        f"subjects={len(pandas)} "
        f"flagged={len(results)} "
        f"clean={len(pandas) - len(results)} "
        f"critical={severity_counts['critical']} "
        f"warning={severity_counts['warning']} "
        f"info={severity_counts['info']}"
    )
    for code, count in issue_counts.most_common():
        print(f"  {code}: {count}")
    print(f"output={OUTPUT_PATH.relative_to(ROOT)}")


if __name__ == "__main__":
    main()

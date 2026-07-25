from __future__ import annotations

import csv
import hashlib
import json
import re
from datetime import datetime
from pathlib import Path
from typing import Any, Iterable

ROOT = Path(__file__).resolve().parents[2]
VAULT_DIR = ROOT / "data" / "local-panda-research"
MEDIA_CANDIDATES_PATH = VAULT_DIR / "media" / "candidates.jsonl"
DISCOVERY_DIR = VAULT_DIR / "media" / "discovery"
SOURCES_PATH = VAULT_DIR / "sources.jsonl"
OUTPUT_PATH = VAULT_DIR / "records" / "2026-07-25-media-derived-facts.jsonl"
PANDAS_CSV = ROOT / "data" / "curation" / "pandas" / "pandas.csv"

SOURCE_ID = "src-wikimedia-commons-local-media-20260725"
COLLECTED_AT = "2026-07-25T00:00:00+08:00"

SOURCE_ROW = {
    "source_id": SOURCE_ID,
    "publisher": "Wikimedia Commons contributors",
    "title": "Wikimedia Commons panda media pages collected in local bounded batches",
    "url": "https://commons.wikimedia.org/wiki/Category:Giant_pandas",
    "language": "multilingual",
    "region": "Global",
    "source_type": "community_media_archive",
    "authority": "mixed_secondary_and_file_metadata",
    "access_mode": "public_web",
    "automated_collection": "rate_limited_action_api",
    "rights_status": "per_file_metadata_preserved",
    "retrieved_at": COLLECTED_AT,
    "notes": (
        "Collection-level source entry. Every generated record retains the exact Commons file page "
        "in source_locator; media descriptions and categories are treated as direct file metadata, "
        "not as authoritative studbook evidence."
    ),
}

LOCATION_PATTERNS: tuple[tuple[tuple[str, ...], str, str], ...] = (
    (("copenhagen zoo", "zoologisk have københavn", "frederiksberg"), "copenhagen-zoo", "Copenhagen Zoo"),
    (("river wonders", "river safari, singapore", "river safari"), "river-wonders", "River Wonders, Singapore"),
    (("ocean park",), "ocean-park-hong-kong", "Ocean Park Hong Kong"),
    (("ueno zoo", "上野動物園", "恩賜上野動物園"), "ueno-zoo", "Ueno Zoo, Tokyo"),
    (("zoo atlanta", "atlanta zoo"), "zoo-atlanta", "Zoo Atlanta"),
    (("smithsonian", "national zoo", "washington, d.c."), "smithsonian-national-zoo", "Smithsonian National Zoo"),
    (("berlin zoo", "zoo berlin"), "zoo-berlin", "Zoo Berlin"),
    (("vienna zoo", "tiergarten schönbrunn", "schönbrunn"), "vienna-zoo", "Tiergarten Schönbrunn, Vienna"),
    (("chiang mai zoo",), "chiang-mai-zoo", "Chiang Mai Zoo"),
    (("zoo negara", "gpcc"), "zoo-negara", "Zoo Negara Malaysia"),
    (("memphis zoo",), "memphis-zoo", "Memphis Zoo"),
    (("beauval", "zooparc"), "zooparc-de-beauval", "ZooParc de Beauval"),
    (("chengdu", "ĉengduo", "成都"), "chengdu-base", "Chengdu panda institution"),
    (("moscow zoo",), "moscow-zoo", "Moscow Zoo"),
    (("madrid zoo", "zoo aquarium madrid"), "madrid-zoo", "Zoo Aquarium Madrid"),
    (("taipei zoo",), "taipei-zoo", "Taipei Zoo"),
    (("san diego zoo",), "san-diego-zoo", "San Diego Zoo"),
    (("everland",), "everland", "Everland"),
    (("columbus zoo",), "columbus-zoo", "Columbus Zoo"),
    (("chongqing", "重庆"), "chongqing", "Chongqing"),
)

BEHAVIOUR_PATTERNS: tuple[tuple[tuple[str, ...], str, str], ...] = (
    (("sleeping", "asleep", "sleep", "nap", "자고있는"), "observed_sleeping", "睡眠"),
    (("eating bamboo", "eating", "feeding on", "mangeant", "먹고"), "observed_eating", "进食"),
    (("playing", "play with", "tumbling", "wrestles"), "observed_playing", "玩耍"),
    (("climbing", "in a tree", "on a tree"), "observed_climbing", "攀爬"),
    (("swimming", "in the water"), "observed_swimming", "游水"),
)

FEMALE_PATTERNS = (" female ", "femelle", "hunpandaen", "weibchen", "雌性", "母熊猫")
MALE_PATTERNS = (" male ", " mâle ", "hanpandaen", "männchen", "雄性", "公熊猫")


def canonical_json(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))


def load_jsonl(path: Path) -> list[dict[str, Any]]:
    if not path.exists():
        return []
    rows: list[dict[str, Any]] = []
    with path.open("r", encoding="utf-8-sig") as handle:
        for raw_line in handle:
            line = raw_line.strip()
            if line:
                value = json.loads(line)
                if isinstance(value, dict):
                    rows.append(value)
    return rows


def write_jsonl(path: Path, rows: Iterable[dict[str, Any]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        "".join(canonical_json(row) + "\n" for row in rows),
        encoding="utf-8",
        newline="",
    )


def load_labels(path: Path = PANDAS_CSV) -> dict[str, str]:
    labels: dict[str, str] = {}
    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        for row in csv.DictReader(handle):
            slug = (row.get("slug") or "").strip()
            if not slug:
                continue
            labels[slug] = (
                (row.get("name_zh") or "").strip()
                or (row.get("name_en") or "").strip()
                or slug
            )
    return labels


def load_discovery_metadata(discovery_dir: Path = DISCOVERY_DIR) -> dict[str, dict[str, Any]]:
    by_asset_url: dict[str, dict[str, Any]] = {}
    for path in sorted(discovery_dir.glob("commons-batch-*-results.json")):
        try:
            payload = json.loads(path.read_text(encoding="utf-8-sig"))
        except (OSError, json.JSONDecodeError):
            continue
        for source in payload.get("candidates") or []:
            if not isinstance(source, dict):
                continue
            asset_url = str(source.get("original_url") or "").strip()
            if asset_url:
                by_asset_url[asset_url] = source
    return by_asset_url


def ensure_collection_source(path: Path = SOURCES_PATH) -> None:
    rows = load_jsonl(path)
    existing = {str(row.get("source_id") or "") for row in rows}
    if SOURCE_ID not in existing:
        rows.append(SOURCE_ROW)
        write_jsonl(path, rows)


def detect_language(text: str) -> str:
    if re.search(r"[가-힣]", text):
        return "ko"
    if re.search(r"[ぁ-んァ-ン]", text):
        return "ja"
    if re.search(r"[\u3400-\u9fff]", text):
        return "zh"
    lowered = text.casefold()
    if any(term in lowered for term in ("hunpandaen", "zoologisk have", "københavn")):
        return "da"
    if any(term in lowered for term in ("femelle", "panda géant", "à beauval")):
        return "fr"
    if any(term in lowered for term in ("reuzepanda", "dierenpark")):
        return "nl"
    if any(term in lowered for term in ("tiergarten", "weibchen", "männchen")):
        return "de"
    return "en"


def parse_capture_date(value: str) -> str | None:
    exact = re.search(r"(?<!\d)(18\d{2}|19\d{2}|20\d{2})[-/](\d{1,2})[-/](\d{1,2})(?!\d)", value)
    if exact:
        year, month, day = (int(part) for part in exact.groups())
        try:
            return datetime(year, month, day).date().isoformat()
        except ValueError:
            return None

    named = re.search(
        r"(?<!\d)(\d{1,2})\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+(18\d{2}|19\d{2}|20\d{2})",
        value,
        flags=re.IGNORECASE,
    )
    if named:
        try:
            return datetime.strptime(" ".join(named.groups()), "%d %B %Y").date().isoformat()
        except ValueError:
            return None
    return None


def source_text(candidate: dict[str, Any], raw: dict[str, Any]) -> str:
    values = [
        candidate.get("subject_label"),
        candidate.get("description"),
        raw.get("file_title"),
        raw.get("description"),
        " ".join(str(value) for value in raw.get("categories") or []),
    ]
    return " ".join(str(value or "") for value in values).strip()


def detect_locations(text: str) -> list[dict[str, str]]:
    lowered = text.casefold()
    found: list[dict[str, str]] = []
    for patterns, institution_id, label in LOCATION_PATTERNS:
        if any(pattern.casefold() in lowered for pattern in patterns):
            found.append({"institution_id": institution_id, "label": label})
    return found


def detect_sex(text: str) -> str | None:
    lowered = f" {text.casefold()} "
    if any(pattern in lowered for pattern in FEMALE_PATTERNS):
        return "female"
    if any(pattern in lowered for pattern in MALE_PATTERNS):
        return "male"
    return None


def detect_behaviours(text: str) -> list[tuple[str, str]]:
    lowered = text.casefold()
    found: list[tuple[str, str]] = []
    for patterns, predicate, label_zh in BEHAVIOUR_PATTERNS:
        if any(pattern in lowered for pattern in patterns):
            found.append((predicate, label_zh))
    return found


def detect_life_stage(text: str) -> str | None:
    lowered = text.casefold()
    if any(pattern in lowered for pattern in ("adult panda", "all grown up")):
        return "adult"
    if any(pattern in lowered for pattern in ("panda cub", "giant panda cub", "baby panda", "pandajong")):
        return "cub"
    return None


def confidence_label(value: Any) -> str:
    try:
        numeric = float(value)
    except (TypeError, ValueError):
        numeric = 0.25
    if numeric >= 0.85:
        return "high"
    if numeric >= 0.5:
        return "medium"
    return "low"


def record_id(key: str) -> str:
    digest = hashlib.sha256(key.encode("utf-8")).hexdigest()[:20]
    return f"lpr-media-{digest}"


def build_record(
    *,
    key: str,
    subject_type: str,
    subject_id: str,
    subject_label: str,
    category: str,
    predicate: str,
    value: Any,
    source_locator: str,
    source_language: str,
    summary_zh: str,
    confidence: str,
    tags: list[str],
) -> dict[str, Any]:
    return {
        "record_id": record_id(key),
        "subject": {"type": subject_type, "id": subject_id, "label": subject_label},
        "category": category,
        "predicate": predicate,
        "value": value,
        "source_id": SOURCE_ID,
        "source_locator": source_locator,
        "source_language": source_language,
        "summary_zh": summary_zh,
        "evidence_level": "direct",
        "confidence": confidence,
        "review_status": "captured",
        "publication_status": "local_only",
        "collected_at": COLLECTED_AT,
        "tags": tags,
    }


def infer_media_kind(candidate: dict[str, Any], labels: dict[str, str]) -> str:
    explicit = str(candidate.get("media_kind") or "").strip()
    if explicit:
        return explicit
    subject_id = str(candidate.get("subject_id") or "").strip()
    related = [str(value) for value in candidate.get("related_subject_ids") or [] if str(value).strip()]

    if subject_id == "topic-1972-panda-transport-crates":
        return "historical_artifact"
    if subject_id == "topic-panda-facility-signage":
        return "facility_signage"
    if subject_id == "unresolved-commons" or not subject_id:
        return "unresolved_panda"
    if subject_id.startswith("group-") or len(related) > 1:
        return "panda_group"
    if subject_id in labels or len(related) == 1:
        return "individual_panda"
    return "unclassified_media"


def candidate_subjects(candidate: dict[str, Any], labels: dict[str, str]) -> list[tuple[str, str, str]]:
    media_kind = infer_media_kind(candidate, labels)
    subject_id = str(candidate.get("subject_id") or "").strip()
    subject_label = str(candidate.get("subject_label") or subject_id).strip()
    related = [str(value) for value in candidate.get("related_subject_ids") or [] if str(value).strip()]

    if media_kind == "individual_panda" and subject_id:
        return [("panda", subject_id, labels.get(subject_id, subject_label))]
    if media_kind == "panda_group" and related:
        return [("panda", slug, labels.get(slug, slug)) for slug in related]
    if media_kind == "historical_artifact":
        return [("historic_programme", subject_id, subject_label)]
    if media_kind == "facility_signage":
        return [("media_collection", subject_id, subject_label)]
    return [("media_collection", subject_id or "unresolved-commons", subject_label or "Unresolved panda media")]


def derive_records(
    candidates: list[dict[str, Any]],
    raw_by_asset_url: dict[str, dict[str, Any]],
    labels: dict[str, str],
) -> list[dict[str, Any]]:
    records: dict[str, dict[str, Any]] = {}

    for candidate in candidates:
        media_id = str(candidate.get("media_id") or "").strip()
        asset_url = str(candidate.get("asset_url") or "").strip()
        source_locator = str(candidate.get("source_page_url") or "").strip()
        if not media_id or not source_locator:
            continue

        raw = raw_by_asset_url.get(asset_url, {})
        text = source_text(candidate, raw)
        language = detect_language(text)
        capture_date = parse_capture_date(str(candidate.get("captured_at") or ""))
        confidence = confidence_label(candidate.get("identity_confidence"))
        locations = detect_locations(text)
        sex = detect_sex(text)
        behaviours = detect_behaviours(text)
        life_stage = detect_life_stage(text)
        categories = [str(value) for value in raw.get("categories") or []]
        file_title = str(raw.get("file_title") or "")
        resolved_media_kind = infer_media_kind(candidate, labels)
        subjects = candidate_subjects(candidate, labels)
        subject_ids = [item[1] for item in subjects if item[0] == "panda"]

        for subject_type, subject_id, subject_label in subjects:
            co_depicted = [slug for slug in subject_ids if slug != subject_id]
            media_value = {
                "media_id": media_id,
                "media_kind": resolved_media_kind,
                "asset_url": asset_url,
                "file_title": file_title,
                "description": str(candidate.get("description") or ""),
                "captured_at": str(candidate.get("captured_at") or "unknown"),
                "credit": str(candidate.get("credit") or ""),
                "rights_label": str(candidate.get("rights_label") or "unknown"),
                "rights_state": str(candidate.get("rights_state") or "unknown"),
                "commons_categories": categories,
                "co_depicted_subject_ids": co_depicted,
                "represented_subject_ids": [
                    str(value) for value in candidate.get("represented_subject_ids") or []
                ],
                "identity_basis": str(candidate.get("identity_basis") or ""),
            }
            key = f"{subject_id}|depicted|{media_id}"
            records[key] = build_record(
                key=key,
                subject_type=subject_type,
                subject_id=subject_id,
                subject_label=subject_label,
                category="media_candidate",
                predicate="depicted_in_collected_media",
                value=media_value,
                source_locator=source_locator,
                source_language=language,
                summary_zh=f"本地媒体库收录了一项与{subject_label}相关的媒体资料，并保留拍摄说明、日期、来源、分类和署名信息。",
                confidence=confidence,
                tags=["media", "wikimedia-commons", resolved_media_kind],
            )

            if capture_date and subject_type == "panda":
                key = f"{subject_id}|photographed|{capture_date}|{media_id}"
                records[key] = build_record(
                    key=key,
                    subject_type="panda",
                    subject_id=subject_id,
                    subject_label=subject_label,
                    category="milestone",
                    predicate="photographed_on",
                    value={"date": capture_date, "media_id": media_id},
                    source_locator=source_locator,
                    source_language=language,
                    summary_zh=f"Commons 文件元数据显示，{subject_label}的这张影像拍摄于{capture_date}。",
                    confidence=confidence,
                    tags=["photograph", "date", "media-derived"],
                )

            if subject_type == "panda":
                for location in locations:
                    key = f"{subject_id}|observed-location|{location['institution_id']}|{capture_date or media_id}"
                    records[key] = build_record(
                        key=key,
                        subject_type="panda",
                        subject_id=subject_id,
                        subject_label=subject_label,
                        category="location",
                        predicate="observed_at_location_in_media",
                        value={
                            **location,
                            "observed_on": capture_date,
                            "media_id": media_id,
                        },
                        source_locator=source_locator,
                        source_language=language,
                        summary_zh=f"该媒体页明确将{subject_label}与{location['label']}联系在一起。",
                        confidence=confidence,
                        tags=["location", "media-derived", location["institution_id"]],
                    )

                if sex:
                    key = f"{subject_id}|sex-description|{sex}|{source_locator}"
                    records[key] = build_record(
                        key=key,
                        subject_type="panda",
                        subject_id=subject_id,
                        subject_label=subject_label,
                        category="sex",
                        predicate="sex_as_described_in_media_metadata",
                        value=sex,
                        source_locator=source_locator,
                        source_language=language,
                        summary_zh=f"该媒体页将{subject_label}描述为{'雌性' if sex == 'female' else '雄性'}大熊猫。",
                        confidence=confidence,
                        tags=["sex", "media-description"],
                    )

                for predicate, behaviour_zh in behaviours:
                    key = f"{subject_id}|{predicate}|{media_id}"
                    records[key] = build_record(
                        key=key,
                        subject_type="panda",
                        subject_id=subject_id,
                        subject_label=subject_label,
                        category="behaviour",
                        predicate=predicate,
                        value={"media_id": media_id, "observed_on": capture_date, "description": str(candidate.get("description") or "")},
                        source_locator=source_locator,
                        source_language=language,
                        summary_zh=f"该媒体描述记录了{subject_label}的{behaviour_zh}状态。",
                        confidence=confidence,
                        tags=["behaviour", "media-observation"],
                    )

                if life_stage:
                    key = f"{subject_id}|life-stage|{life_stage}|{media_id}"
                    records[key] = build_record(
                        key=key,
                        subject_type="panda",
                        subject_id=subject_id,
                        subject_label=subject_label,
                        category="milestone",
                        predicate="life_stage_as_described_in_media_metadata",
                        value={"life_stage": life_stage, "media_id": media_id, "observed_on": capture_date},
                        source_locator=source_locator,
                        source_language=language,
                        summary_zh=f"该媒体页将{subject_label}描述为{'幼崽' if life_stage == 'cub' else '成年大熊猫'}阶段。",
                        confidence=confidence,
                        tags=["life-stage", "media-description", life_stage],
                    )

        lowered = text.casefold()
        if (
            "xing xing and qin qin" in lowered
            and "columbus zoo" in lowered
            and "1992" in lowered
        ):
            key = "historic-1992-columbus-zoo-panda-loan"
            records[key] = build_record(
                key=key,
                subject_type="historic_programme",
                subject_id="historic-1992-columbus-zoo-panda-loan",
                subject_label="1992 Columbus Zoo giant panda loan",
                category="diplomacy",
                predicate="temporary_panda_loan_documented",
                value={
                    "year": 1992,
                    "season": "summer",
                    "destination": "Columbus Zoo",
                    "panda_ids": ["qin-qin-xian-1989", "xing-xing-chengdu-1989"],
                    "media_id": media_id,
                },
                source_locator=source_locator,
                source_language=language,
                summary_zh="该历史照片说明记录了中国在1992年夏季将琴琴和星星借展给哥伦布动物园。",
                confidence="high",
                tags=["history", "columbus-zoo", "1992", "panda-diplomacy"],
            )

        if "madam chiang" in lowered and "baby panda" in lowered and "1941" in lowered:
            key = "historic-1941-chongqing-panda-photo"
            records[key] = build_record(
                key=key,
                subject_type="historic_programme",
                subject_id="historic-1941-chongqing-panda-photo",
                subject_label="1941 Chongqing baby panda photograph",
                category="cultural_context",
                predicate="historic_baby_panda_photograph",
                value={
                    "date": "1941-11-09",
                    "location": "Madam Chiang's yard, Chongqing",
                    "people_named": ["Madam Chiang", "Mr. Tee Van"],
                    "media_id": media_id,
                },
                source_locator=source_locator,
                source_language=language,
                summary_zh="一张1941年11月9日的历史照片记录了蒋夫人与 Tee Van 先生在重庆院中和一只幼年大熊猫同框。",
                confidence="high",
                tags=["history", "chongqing", "cultural-context", "baby-panda"],
            )

        if (
            resolved_media_kind == "historical_artifact"
            and "1972" in lowered
            and any(signal in lowered for signal in ("transport crate", "shipping crate", "运输箱"))
        ):
            key = f"1972-transport-crate|{media_id}"
            records[key] = build_record(
                key=key,
                subject_type="historic_programme",
                subject_id="topic-1972-panda-transport-crates",
                subject_label="1972 panda transport crates",
                category="diplomacy",
                predicate="transport_crate_documented",
                value={"year": 1972, "media_id": media_id, "description": str(candidate.get("description") or "")},
                source_locator=source_locator,
                source_language=language,
                summary_zh="该媒体资料记录了1972年中国赠美大熊猫运输所使用的运输箱。",
                confidence="high",
                tags=["panda-diplomacy", "1972", "historical-artifact"],
            )

        if (
            resolved_media_kind == "historical_artifact"
            and "pat nixon" in lowered
            and "peking zoo" in lowered
            and "1972" in lowered
        ):
            key = f"1972-nixon-peking-zoo|{media_id}"
            records[key] = build_record(
                key=key,
                subject_type="historic_programme",
                subject_id="historic-1972-nixon-peking-zoo-visit",
                subject_label="1972 Nixon-party Peking Zoo panda visit",
                category="diplomacy",
                predicate="panda_diplomacy_zoo_visit_documented",
                value={
                    "date": "1972-02-22",
                    "location": "Peking Zoo",
                    "people_named": ["Pat Nixon"],
                    "media_id": media_id,
                },
                source_locator=source_locator,
                source_language=language,
                summary_zh="该美国政府档案照片记录了1972年2月22日帕特·尼克松一行在北京动物园观看大熊猫。",
                confidence="high",
                tags=["panda-diplomacy", "1972", "peking-zoo", "official-archive"],
            )

        if resolved_media_kind == "facility_signage":
            key = f"facility-signage|{media_id}"
            records[key] = build_record(
                key=key,
                subject_type="media_collection",
                subject_id="topic-panda-facility-signage",
                subject_label="Panda facility signage",
                category="cultural_context",
                predicate="visitor_signage_documented",
                value={"media_id": media_id, "description": str(candidate.get("description") or ""), "categories": categories},
                source_locator=source_locator,
                source_language=language,
                summary_zh="本地媒体库保存了一项熊猫场馆导览、入口或等候时间标识资料。",
                confidence="high",
                tags=["facility", "signage", "visitor-experience"],
            )

        if resolved_media_kind == "cultural_object":
            key = f"panda-cultural-object|{media_id}"
            records[key] = build_record(
                key=key,
                subject_type="media_collection",
                subject_id="topic-panda-cultural-objects",
                subject_label="Panda-themed cultural objects",
                category="cultural_context",
                predicate="panda_cultural_object_documented",
                value={
                    "media_id": media_id,
                    "description": str(candidate.get("description") or ""),
                    "categories": categories,
                },
                source_locator=source_locator,
                source_language=language,
                summary_zh="本地媒体库保存了一项以大熊猫为主题的玩偶、手工艺品或其他文化物件资料。",
                confidence="high",
                tags=["cultural-object", "panda-themed", "media"],
            )

        if resolved_media_kind == "panda_costume":
            key = f"panda-costume|{media_id}"
            records[key] = build_record(
                key=key,
                subject_type="media_collection",
                subject_id="topic-panda-costumes",
                subject_label="Panda costumes and cosplay",
                category="cultural_context",
                predicate="panda_costume_or_cosplay_documented",
                value={
                    "media_id": media_id,
                    "description": str(candidate.get("description") or ""),
                    "categories": categories,
                },
                source_locator=source_locator,
                source_language=language,
                summary_zh="本地媒体库保存了一项大熊猫服装、吉祥物或 cosplay 文化活动资料。",
                confidence="high",
                tags=["costume", "cosplay", "cultural-context"],
            )

        if resolved_media_kind == "panda_memorial":
            represented_subject_ids = [
                str(value) for value in candidate.get("represented_subject_ids") or []
            ]
            key = f"panda-memorial|{media_id}"
            records[key] = build_record(
                key=key,
                subject_type="media_collection",
                subject_id="topic-panda-memorials",
                subject_label="Panda statues and memorials",
                category="cultural_context",
                predicate="panda_memorial_documented",
                value={
                    "media_id": media_id,
                    "description": str(candidate.get("description") or ""),
                    "categories": categories,
                    "represented_subject_ids": represented_subject_ids,
                },
                source_locator=source_locator,
                source_language=language,
                summary_zh="本地媒体库保存了一项大熊猫雕塑、纪念像或纪念设施资料，并单独记录其所纪念的个体线索。",
                confidence="high",
                tags=["memorial", "statue", "cultural-context"],
            )

        if resolved_media_kind == "research_diagram":
            key = f"panda-research-diagram|{media_id}"
            records[key] = build_record(
                key=key,
                subject_type="research_programme",
                subject_id="topic-panda-research-diagrams",
                subject_label="Panda-related research diagrams",
                category="research",
                predicate="research_diagram_documented",
                value={
                    "media_id": media_id,
                    "description": str(candidate.get("description") or ""),
                    "categories": categories,
                    "asset_url": asset_url,
                },
                source_locator=source_locator,
                source_language=language,
                summary_zh="本地媒体库保存了一项包含大熊猫的系统发育、比较基因组学或其他科研图表资料。",
                confidence="high",
                tags=["research", "diagram", "phylogeny"],
            )

    return [records[key] for key in sorted(records)]


def main() -> int:
    candidates = load_jsonl(MEDIA_CANDIDATES_PATH)
    raw_by_asset_url = load_discovery_metadata()
    labels = load_labels()
    ensure_collection_source()
    records = derive_records(candidates, raw_by_asset_url, labels)
    write_jsonl(OUTPUT_PATH, records)

    categories = sorted({str(record["category"]) for record in records})
    subjects = {(record["subject"]["type"], record["subject"]["id"]) for record in records}
    print(
        "Local media-derived fact extraction passed: "
        f"candidates={len(candidates)}, records={len(records)}, subjects={len(subjects)}, "
        f"categories={','.join(categories)}, output={OUTPUT_PATH.relative_to(ROOT)}."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

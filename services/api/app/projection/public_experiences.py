from __future__ import annotations

from typing import Any


def _published(dataset: dict[str, Any], collection: str) -> list[dict[str, Any]]:
    return [
        {"id": str(record["id"]), **record.get("public", {})}
        for record in dataset.get(collection, [])
        if record.get("publication_status") == "published"
    ]


def _unique(values: list[str]) -> list[str]:
    return sorted({value for value in values if value})


def _localized(
    zh_title: str, en_title: str, zh_summary: str, en_summary: str
) -> list[dict[str, str]]:
    return [
        {"locale": "zh-CN", "title": zh_title, "summary": zh_summary},
        {"locale": "en", "title": en_title, "summary": en_summary},
    ]


def _story(
    *,
    story_id: str,
    slug: str,
    story_type: str,
    localized_content: list[dict[str, str]],
    member_ids: list[str],
    relationship_ids: list[str],
    excluded_relationship_ids: list[str],
    chapters: list[dict[str, Any]],
    media_panda_ids: list[str],
    coverage_state: str,
    release: dict[str, str],
    event_by_id: dict[str, dict[str, Any]],
    relationship_by_id: dict[str, dict[str, Any]],
) -> dict[str, Any]:
    source_ids = _unique(
        [
            source_id
            for event_id in [
                event_id for chapter in chapters for event_id in chapter.get("event_ids", [])
            ]
            for source_id in event_by_id.get(event_id, {}).get("source_ids", [])
        ]
        + [
            source_id
            for relationship_id in relationship_ids
            for source_id in relationship_by_id.get(relationship_id, {}).get("source_ids", [])
        ]
    )
    return {
        "id": story_id,
        "slug": slug,
        "story_type": story_type,
        "localized_content": localized_content,
        "scope": {
            "coverage_state": coverage_state,
            "member_ids": member_ids,
            "relationship_assertion_ids": relationship_ids,
            "excluded_relationship_assertion_ids": excluded_relationship_ids,
        },
        "member_ids": member_ids,
        "relationship_assertion_ids": relationship_ids,
        "chapters": chapters,
        "media": {
            "featured_panda_ids": media_panda_ids,
            "selection_state": "reviewed",
        },
        "source_ids": source_ids,
        "revision": {
            "data_version": release["dataset_release_version"],
            "public_schema_version": release["public_schema_version"],
        },
    }


def build_public_experience_runtime(
    dataset: dict[str, Any], release: dict[str, str]
) -> dict[str, Any]:
    pandas = _published(dataset, "pandas")
    facilities = _published(dataset, "facilities")
    sources = _published(dataset, "sources")
    relationships = _published(dataset, "parentage_assertions")
    events = _published(dataset, "events")

    panda_id_by_slug = {
        record.get("canonical_slug"): record["id"]
        for record in pandas
        if record.get("canonical_slug")
    }
    relationship_by_id = {record["id"]: record for record in relationships}
    event_by_id = {record["id"]: record for record in events}

    def panda_ids(slugs: list[str]) -> list[str]:
        return [panda_id_by_slug[slug] for slug in slugs if slug in panda_id_by_slug]

    smithsonian_relationship_ids = [
        "parent-tai-shan-father",
        "parent-tai-shan-mother",
        "parent-bao-bao-father",
        "parent-bao-bao-mother",
        "parent-bei-bei-father",
        "parent-bei-bei-mother",
        "parent-xiao-qi-ji-father",
        "parent-xiao-qi-ji-mother",
        "parent-bao-li-mother",
        "parent-bao-li-father",
    ]
    smithsonian_members = panda_ids(
        [
            "mei-xiang",
            "tian-tian",
            "tai-shan",
            "bao-bao",
            "bei-bei",
            "xiao-qi-ji",
            "bao-li",
        ]
    )
    smithsonian_chapters = [
        {
            "id": "washington-programme",
            "kind": "programme",
            "localized_content": _localized(
                "华盛顿的长期篇章",
                "A long Washington chapter",
                "美香与添添在史密森国家动物园的长期项目背景。",
                "The long Smithsonian programme chapter of Mei Xiang and Tian Tian.",
            ),
            "member_ids": panda_ids(["mei-xiang", "tian-tian"]),
            "event_ids": [],
            "relationship_assertion_ids": [],
            "facility_ids": [],
            "place_ids": [],
        },
        {
            "id": "four-published-offspring",
            "kind": "generation",
            "localized_content": _localized(
                "四个已发布子代",
                "Four published offspring",
                "泰山、宝宝、贝贝和小奇迹通过八条已确认亲本断言进入故事。",
                (
                    "Tai Shan, Bao Bao, Bei Bei, and Xiao Qi Ji enter through eight "
                    "confirmed parentage assertions."
                ),
            ),
            "member_ids": panda_ids(["tai-shan", "bao-bao", "bei-bei", "xiao-qi-ji"]),
            "event_ids": [],
            "relationship_assertion_ids": smithsonian_relationship_ids[:8],
            "facility_ids": [],
            "place_ids": [],
        },
        {
            "id": "return-to-china",
            "kind": "journey",
            "localized_content": _localized(
                "宣布与完成必须分开",
                "Announcement and completion stay separate",
                "2020 年的返回计划与 2023 年完成的多人迁移是两个不同状态的事件。",
                (
                    "The 2020 return plan and the completed multi-participant 2023 "
                    "transfer remain distinct events."
                ),
            ),
            "member_ids": panda_ids(["mei-xiang", "tian-tian", "xiao-qi-ji"]),
            "event_ids": ["event-smithsonian-return-plan-2020", "event-smithsonian-departure-2023"],
            "relationship_assertion_ids": [],
            "facility_ids": [],
            "place_ids": [],
        },
        {
            "id": "bao-li-next-generation",
            "kind": "maternal_line",
            "localized_content": _localized(
                "下一代回到华盛顿",
                "A next generation returns to Washington",
                "宝宝之子宝力以已确认母系、暂定父系和独立到达及亮相事件进入第三代。",
                (
                    "Bao Bao's son Bao Li enters the third generation through a "
                    "confirmed maternal edge, a tentative paternal edge, and separate "
                    "arrival and debut events."
                ),
            ),
            "member_ids": panda_ids(["bao-bao", "bao-li"]),
            "event_ids": [
                "event-bao-li-birth",
                "event-bao-li-arrival-2024",
                "event-bao-li-public-debut-2025",
            ],
            "relationship_assertion_ids": ["parent-bao-li-mother", "parent-bao-li-father"],
            "facility_ids": [],
            "place_ids": [],
        },
    ]

    ueno_relationship_ids = [
        "parent-xiao-xiao-father",
        "parent-xiao-xiao-mother",
        "parent-lei-lei-father",
        "parent-lei-lei-mother",
    ]
    ueno_members = panda_ids(["shin-shin", "ri-ri", "xiao-xiao", "lei-lei"])
    ueno_chapters = [
        {
            "id": "parents-arrive-ueno",
            "kind": "pair",
            "localized_content": _localized(
                "父母抵达上野",
                "The parents arrive at Ueno",
                "真真与力力的共同到达事件构成家庭故事的机构起点。",
                "Shin Shin and Ri Ri's shared arrival is the institutional starting point.",
            ),
            "member_ids": panda_ids(["shin-shin", "ri-ri"]),
            "event_ids": ["event-ueno-pair-arrival-2011"],
            "relationship_assertion_ids": [],
            "facility_ids": [],
            "place_ids": [],
        },
        {
            "id": "twins-born-and-named",
            "kind": "twin_parallel",
            "localized_content": _localized(
                "同日出生，独立身份",
                "Born together, retained as distinct identities",
                "晓晓与蕾蕾共享出生和命名事件，但继续保留各自档案与四条亲本断言。",
                (
                    "Xiao Xiao and Lei Lei share birth and naming events while retaining "
                    "separate profiles and four parentage assertions."
                ),
            ),
            "member_ids": panda_ids(["xiao-xiao", "lei-lei"]),
            "event_ids": ["event-ueno-twins-birth-2021", "event-ueno-twins-named-2021"],
            "relationship_assertion_ids": ueno_relationship_ids,
            "facility_ids": [],
            "place_ids": [],
        },
        {
            "id": "two-return-chapters",
            "kind": "journey",
            "localized_content": _localized(
                "两次返回，不合并成一次",
                "Two returns, not one merged event",
                "父母 2024 年返回与双胞胎 2026 年返回分别保留事件身份和参与者。",
                (
                    "The parents' 2024 return and the twins' 2026 return retain separate "
                    "event identities and participants."
                ),
            ),
            "member_ids": ueno_members,
            "event_ids": ["event-ueno-pair-return-2024", "event-ueno-twins-return-2026"],
            "relationship_assertion_ids": [],
            "facility_ids": [],
            "place_ids": [],
        },
    ]

    family_stories = [
        _story(
            story_id="family-smithsonian-generations",
            slug="smithsonian-generations",
            story_type="programme_longform_v1",
            localized_content=_localized(
                "从美香到宝力",
                "From Mei Xiang to Bao Li",
                "一个声明为部分范围的三代史密森家族故事。",
                "A deliberately bounded three-generation Smithsonian family story.",
            ),
            member_ids=smithsonian_members,
            relationship_ids=[
                relationship_id
                for relationship_id in smithsonian_relationship_ids
                if relationship_id in relationship_by_id
            ],
            excluded_relationship_ids=[
                relationship_id
                for relationship_id in ["parent-tian-tian-father", "parent-tian-tian-mother"]
                if relationship_id in relationship_by_id
            ],
            chapters=smithsonian_chapters,
            media_panda_ids=panda_ids(["bao-li"]),
            coverage_state="partial",
            release=release,
            event_by_id=event_by_id,
            relationship_by_id=relationship_by_id,
        ),
        _story(
            story_id="family-ueno-twins",
            slug="ueno-twins",
            story_type="twin_parallel_v1",
            localized_content=_localized(
                "上野双胞胎家庭",
                "The Ueno twin family",
                "以父母、双胞胎和两次返回为主线的紧凑家庭故事。",
                (
                    "A compact family story organized around the parents, the twins, "
                    "and two return journeys."
                ),
            ),
            member_ids=ueno_members,
            relationship_ids=[
                relationship_id
                for relationship_id in ueno_relationship_ids
                if relationship_id in relationship_by_id
            ],
            excluded_relationship_ids=[],
            chapters=ueno_chapters,
            media_panda_ids=panda_ids(["shin-shin", "ri-ri"]),
            coverage_state="complete_for_declared_scope",
            release=release,
            event_by_id=event_by_id,
            relationship_by_id=relationship_by_id,
        ),
    ]

    return {
        "facilities": facilities,
        "sources": sources,
        "parentage_assertions": relationships,
        "events": events,
        "family_stories": family_stories,
        "profile_cohort": [
            {"slug": "xi-lun", "state": "rich"},
            {"slug": "lun-hui", "state": "sparse"},
            {"slug": "yong-ba", "state": "historic"},
        ],
    }

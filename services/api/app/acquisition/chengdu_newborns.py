from __future__ import annotations

import re
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from urllib.parse import urljoin

from .chengdu_international import (
    ExtractedFact,
    HtmlNode,
    SemanticPage,
    _assert_unique_pre_reconciliation_candidates,
    _css_selector,
    _header,
)
from .contracts import (
    AcquisitionMode,
    CandidateKind,
    ConflictState,
    CurrentTrustedValue,
    FieldCandidate,
    IdentityMatchState,
    PandaIdentityMatch,
    SourceLocator,
    SourceLocatorKind,
)
from .contracts import EvidenceSnapshot as BundleEvidenceSnapshot
from .contracts.v1 import JsonValue
from .runner import AdapterParseContext, AdapterRequest
from .source_registry import ReviewedSource

SOURCE_ID = "chengdu-panda-base-international-cooperation"
ADAPTER_ID = "chengdu-newborns-2021"
ADAPTER_VERSION = "1.0.0"
PARSER_NAME = "chengdu-panda-base-newborns-2021"
PARSER_VERSION = "1.0.0"
DEFAULT_COHORT = "chengdu-newborns-2021"

CHINESE_REQUEST_ID = "newborns-2021-zh"
ENGLISH_REQUEST_ID = "newborns-2021-en"
_CHINESE_PATH = "/cn/culture/activities/2023-07-07/6594.html"
_ENGLISH_PATH = "/en/culture/activities/2023-09-19/8165.html"
_DEFAULT_FIXTURE = (
    Path(__file__).resolve().parents[2]
    / "tests"
    / "acquisition"
    / "fixtures"
    / "chengdu-newborns-2021.manifest.json"
)
_MIN_LIVE_BODY_BYTES = 8_000
_BASE_LOCATION = "Chengdu Research Base of Giant Panda Breeding"
_CHINESE_PROFILE_PATTERN = re.compile(
    r"^(?P<name>[^：]+)：(?P<year>\d{4})年(?P<month>\d{1,2})月(?P<day>\d{1,2})日出生，"
    r"(?P<sex>雄性|雌性)，母亲为[“\"](?P<mother>[^”\"]+)[”\"]。?$"
)
_ENGLISH_PROFILE_PATTERN = re.compile(
    r"^(?P<name>[^:]+):\s*born on\s+(?P<month>[A-Za-z]+)\s+(?P<day>\d{1,2}),\s*"
    r"(?P<year>\d{4}),\s*(?P<sex>male|female),\s*mother:\s*(?P<mother>.+?)\s*$"
)
_PROFILE_IDENTITIES = (
    ("bao-xin", "宝新", "Bao Xin", "a-bao", "阿宝", "A Bao"),
    ("pu-pu", "噗噗", "Pu Pu", "qi-fu", "奇福", "Qi Fu"),
    ("jin-xiao", "金宵", "Jin Xiao", "zhao-mei", "昭美", "Zhao Mei"),
    ("lun-hui", "轮辉", "Lun Hui", "mei-lun", "美仑", "Mei Lun"),
    ("ya-song", "雅颂", "Ya Song", "ya-li", "雅莉", "Ya Li"),
)


@dataclass(frozen=True, slots=True)
class NewbornProfile:
    source_key: str
    name_zh: str
    name_en: str
    birth_date: str
    sex: str
    mother_key: str
    mother_name_zh: str
    mother_name_en: str
    source_node: HtmlNode


@dataclass(frozen=True, slots=True)
class ParsedNewbornPage:
    profiles: tuple[NewbornProfile, ...]
    facts: tuple[ExtractedFact, ...]

    @property
    def parity_projection(self) -> tuple[tuple[str, str, str, str, str, str], ...]:
        return tuple(
            sorted(
                (
                    item.source_key,
                    item.name_zh,
                    item.name_en,
                    item.birth_date,
                    item.sex,
                    item.mother_key,
                )
                for item in self.profiles
            )
        )


@dataclass(frozen=True, slots=True)
class ChengduNewborns2021Adapter:
    adapter_id: str = ADAPTER_ID
    adapter_version: str = ADAPTER_VERSION
    source_id: str = SOURCE_ID
    parser_name: str = PARSER_NAME
    parser_version: str = PARSER_VERSION
    default_cohort: str | None = DEFAULT_COHORT
    default_fixture: Path | None = _DEFAULT_FIXTURE

    def build_requests(
        self,
        source: ReviewedSource,
        *,
        cohort: str | None,
    ) -> tuple[AdapterRequest, ...]:
        del cohort
        source.assert_adapter_allowed(self.adapter_id)
        if source.source_id != SOURCE_ID or source.base_url is None:
            raise ValueError("Chengdu newborn adapter requires the reviewed Panda Base source")
        return (
            AdapterRequest(
                request_id=CHINESE_REQUEST_ID,
                url=urljoin(source.base_url, _CHINESE_PATH.lstrip("/")),
            ),
            AdapterRequest(
                request_id=ENGLISH_REQUEST_ID,
                url=urljoin(source.base_url, _ENGLISH_PATH.lstrip("/")),
            ),
        )

    def parse(self, context: AdapterParseContext) -> tuple[FieldCandidate, ...]:
        chinese_page, chinese_evidence = _page_and_evidence(
            context,
            CHINESE_REQUEST_ID,
            "成都大熊猫繁育研究基地2021海内外新生幼仔",
            "2021级新生熊猫信息",
        )
        english_page, english_evidence = _page_and_evidence(
            context,
            ENGLISH_REQUEST_ID,
            "Online Debut of 2021 Newborn Cubs",
            "Profilesof the 2021 Newborn Pandas",
        )
        chinese = _extract_chinese(chinese_page)
        english = _extract_english(english_page)
        if chinese.parity_projection != english.parity_projection:
            raise ValueError("Chengdu 2021 newborn Chinese and English profile facts drifted")

        facts_with_evidence = [
            *((fact, chinese_evidence) for fact in chinese.facts),
            *((fact, english_evidence) for fact in english.facts),
        ]
        candidates = tuple(
            _to_field_candidate(fact, evidence) for fact, evidence in facts_with_evidence
        )
        _assert_unique_pre_reconciliation_candidates(candidates)
        return candidates


ADAPTER = ChengduNewborns2021Adapter()


def _page_and_evidence(
    context: AdapterParseContext,
    request_id: str,
    title_phrase: str,
    profile_phrase: str,
) -> tuple[SemanticPage, BundleEvidenceSnapshot]:
    response = context.responses.get(request_id)
    evidence = context.evidence_snapshots.get(request_id)
    if response is None or evidence is None:
        raise ValueError(f"Chengdu newborn adapter did not receive {request_id!r}")
    if response.status != 200:
        raise ValueError(f"{request_id} returned HTTP {response.status}")
    content_type = _header(response.headers, "content-type").lower()
    if "text/html" not in content_type:
        raise ValueError(f"{request_id} must return text/html")
    if context.mode is AcquisitionMode.LIVE and len(response.body) < _MIN_LIVE_BODY_BYTES:
        raise ValueError(f"{request_id} body size collapsed below the reviewed threshold")
    page = SemanticPage.parse(request_id, response.body)
    page.require_document_text(title_phrase)
    page.require_document_text(profile_phrase)
    return page, evidence


def _extract_chinese(page: SemanticPage) -> ParsedNewbornPage:
    profiles = tuple(
        _parse_chinese_profile(
            page,
            source_key=source_key,
            expected_name_zh=name_zh,
            name_en=name_en,
            mother_key=mother_key,
            expected_mother_name_zh=mother_name_zh,
            mother_name_en=mother_name_en,
        )
        for (
            source_key,
            name_zh,
            name_en,
            mother_key,
            mother_name_zh,
            mother_name_en,
        ) in _PROFILE_IDENTITIES
    )
    return ParsedNewbornPage(profiles=profiles, facts=_profile_facts(profiles, language="zh"))


def _extract_english(page: SemanticPage) -> ParsedNewbornPage:
    profiles = tuple(
        _parse_english_profile(
            page,
            source_key=source_key,
            name_zh=name_zh,
            expected_name_en=name_en,
            mother_key=mother_key,
            mother_name_zh=mother_name_zh,
            expected_mother_name_en=mother_name_en,
        )
        for (
            source_key,
            name_zh,
            name_en,
            mother_key,
            mother_name_zh,
            mother_name_en,
        ) in _PROFILE_IDENTITIES
    )
    return ParsedNewbornPage(profiles=profiles, facts=_profile_facts(profiles, language="en"))


def _parse_chinese_profile(
    page: SemanticPage,
    *,
    source_key: str,
    expected_name_zh: str,
    name_en: str,
    mother_key: str,
    expected_mother_name_zh: str,
    mother_name_en: str,
) -> NewbornProfile:
    node = page.one_paragraph_containing(f"{expected_name_zh}：2021年")
    match = _CHINESE_PROFILE_PATTERN.fullmatch(node.text())
    if match is None:
        raise ValueError(f"{page.request_id} profile format drifted for {expected_name_zh}")
    if match.group("name") != expected_name_zh:
        raise ValueError(f"{page.request_id} profile name drifted for {source_key}")
    if match.group("mother") != expected_mother_name_zh:
        raise ValueError(f"{page.request_id} mother name drifted for {source_key}")
    return NewbornProfile(
        source_key=source_key,
        name_zh=match.group("name"),
        name_en=name_en,
        birth_date=(
            f"{int(match.group('year')):04d}-{int(match.group('month')):02d}-"
            f"{int(match.group('day')):02d}"
        ),
        sex={"雄性": "male", "雌性": "female"}[match.group("sex")],
        mother_key=mother_key,
        mother_name_zh=match.group("mother"),
        mother_name_en=mother_name_en,
        source_node=node,
    )


def _parse_english_profile(
    page: SemanticPage,
    *,
    source_key: str,
    name_zh: str,
    expected_name_en: str,
    mother_key: str,
    mother_name_zh: str,
    expected_mother_name_en: str,
) -> NewbornProfile:
    node = page.one_paragraph_containing(f"{expected_name_en}: born on")
    match = _ENGLISH_PROFILE_PATTERN.fullmatch(node.text())
    if match is None:
        raise ValueError(f"{page.request_id} profile format drifted for {expected_name_en}")
    if match.group("name") != expected_name_en:
        raise ValueError(f"{page.request_id} profile name drifted for {source_key}")
    if match.group("mother") != expected_mother_name_en:
        raise ValueError(f"{page.request_id} mother name drifted for {source_key}")
    parsed_date = datetime.strptime(
        f"{match.group('month')} {match.group('day')}, {match.group('year')}",
        "%B %d, %Y",
    ).date()
    return NewbornProfile(
        source_key=source_key,
        name_zh=name_zh,
        name_en=match.group("name"),
        birth_date=parsed_date.isoformat(),
        sex=match.group("sex"),
        mother_key=mother_key,
        mother_name_zh=mother_name_zh,
        mother_name_en=match.group("mother"),
        source_node=node,
    )


def _profile_facts(
    profiles: tuple[NewbornProfile, ...],
    *,
    language: str,
) -> tuple[ExtractedFact, ...]:
    facts: list[ExtractedFact] = []
    emitted_mothers: set[str] = set()
    for profile in profiles:
        name = profile.name_zh if language == "zh" else profile.name_en
        mother_name = profile.mother_name_zh if language == "zh" else profile.mother_name_en
        facts.extend(
            (
                _fact(
                    profile.source_key,
                    CandidateKind.IDENTITY,
                    f"identity.names.official.{language}",
                    name,
                    profile.source_node,
                ),
                _fact(
                    profile.source_key,
                    CandidateKind.IDENTITY,
                    "identity.birth_date",
                    profile.birth_date,
                    profile.source_node,
                ),
                _fact(
                    profile.source_key,
                    CandidateKind.IDENTITY,
                    "identity.sex",
                    profile.sex,
                    profile.source_node,
                ),
                _fact(
                    profile.source_key,
                    CandidateKind.RELATIONSHIP,
                    "relationship.mother",
                    mother_name,
                    profile.source_node,
                    notes=(
                        "Mother name is preserved as source text; the adapter does not "
                        "infer a parent slug.",
                    ),
                ),
                _fact(
                    profile.source_key,
                    CandidateKind.EVENT,
                    "event",
                    {
                        "event_type": "birth",
                        "event_date": profile.birth_date,
                        "location": _BASE_LOCATION,
                    },
                    profile.source_node,
                ),
            )
        )
        if profile.mother_key not in emitted_mothers:
            facts.append(
                _fact(
                    profile.mother_key,
                    CandidateKind.IDENTITY,
                    f"identity.names.official.{language}",
                    mother_name,
                    profile.source_node,
                    notes=(
                        "The mother is an explicitly named source-local identity, "
                        "independent of relationship resolution.",
                    ),
                )
            )
            emitted_mothers.add(profile.mother_key)
    return tuple(facts)


def _fact(
    source_key: str,
    candidate_kind: CandidateKind,
    field_path: str,
    value: JsonValue,
    source_node: HtmlNode,
    *,
    notes: tuple[str, ...] = (),
) -> ExtractedFact:
    return ExtractedFact(
        subject_key=f"chengdu:{source_key}",
        candidate_kind=candidate_kind,
        field_path=field_path,
        raw_value=value,
        source_node=source_node,
        notes=notes,
    )


def _to_field_candidate(
    fact: ExtractedFact,
    evidence: BundleEvidenceSnapshot,
) -> FieldCandidate:
    return FieldCandidate(
        source_id=SOURCE_ID,
        evidence_snapshot_id=evidence.snapshot_id,
        evidence_body_sha256=evidence.body_sha256,
        candidate_kind=fact.candidate_kind,
        subject_key=fact.subject_key,
        field_path=fact.field_path,
        source_locator=SourceLocator(
            kind=SourceLocatorKind.CSS_SELECTOR,
            value=_css_selector(fact.source_node),
        ),
        raw_value=fact.raw_value,
        normalized_value=fact.raw_value,
        identity_match=PandaIdentityMatch(
            state=IdentityMatchState.NOT_ATTEMPTED,
            source_identity=fact.subject_key,
            notes=(
                "The adapter preserves a source-local subject; shared reconciliation "
                "owns the curation identity match.",
            ),
        ),
        current_trusted_value=CurrentTrustedValue(present=False),
        parser_name=PARSER_NAME,
        parser_version=PARSER_VERSION,
        conflict_state=ConflictState.NOT_COMPARED,
        notes=(
            "Deterministic factual candidate only; no source prose, media, trusted, "
            "or public data was copied or modified.",
            *fact.notes,
        ),
    )


__all__ = [
    "ADAPTER",
    "ADAPTER_ID",
    "ADAPTER_VERSION",
    "CHINESE_REQUEST_ID",
    "DEFAULT_COHORT",
    "ENGLISH_REQUEST_ID",
    "PARSER_NAME",
    "PARSER_VERSION",
    "SOURCE_ID",
    "ChengduNewborns2021Adapter",
]

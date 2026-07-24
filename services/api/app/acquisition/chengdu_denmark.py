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
ADAPTER_ID = "chengdu-denmark-handover-2019"
ADAPTER_VERSION = "1.0.0"
PARSER_NAME = "chengdu-panda-base-denmark-handover-2019"
PARSER_VERSION = "1.0.0"
DEFAULT_COHORT = "chengdu-denmark-handover-2019"

CHINESE_REQUEST_ID = "denmark-handover-2019-zh"
ENGLISH_REQUEST_ID = "denmark-handover-2019-en"
_CHINESE_PATH = "/cn/culture/activities/2023-07-07/6593.html"
_ENGLISH_PATH = "/en/culture/activities/2023-08-24/8081.html"
_DEFAULT_FIXTURE = (
    Path(__file__).resolve().parents[2]
    / "tests"
    / "acquisition"
    / "fixtures"
    / "chengdu-denmark-handover-2019.manifest.json"
)
_MIN_LIVE_BODY_BYTES = 8_000
_TRANSFER_DATE = "2019-04-04"
_TRANSFER_LOCATION = "Copenhagen Zoo, Denmark"

_CHINESE_PROFILE_PATTERN = re.compile(
    r"^大熊猫(?P<name>[^：]+)：谱系号(?P<pedigree>\d+)，"
    r"(?:(?:乳名(?P<nickname>[^，]+)，))?(?P<sex>雄性|雌性)。"
    r"出生于(?P<year>\d{4})年(?P<month>\d{1,2})月(?P<day>\d{1,2})日，"
    r"父亲是大熊猫[“\"](?P<father>[^”\"]+)[”\"]，"
    r"母亲是大熊猫[“\"](?P<mother>[^”\"]+)[”\"]。.*$"
)
_ENGLISH_PROFILE_PATTERN = re.compile(
    r"^(?P<name>[^:]+):\s*Pedigree No\.:\s*(?P<pedigree>\d+),\s*"
    r"(?:(?:nickname:\s*(?P<nickname>[^,]+),\s*))?sex:\s*(?P<sex>male|female),\s*"
    r"born on\s*(?P<month>[A-Za-z]+)\s+(?P<day>\d{1,2}),\s*(?P<year>\d{4}),\s*"
    r"father:\s*(?P<father>[^,]+),\s*mother:\s*(?P<mother>[^.]+)\..*$"
)
_PROFILE_SPECS = (
    {
        "source_key": "xing-er",
        "name_zh": "星二",
        "name_en": "Xing Er",
        "pedigree": "900",
        "sex": "male",
        "birth_date": "2013-08-23",
        "father_zh": "勇勇",
        "father_en": "Yong Yong",
        "mother_zh": "星蓉",
        "mother_en": "Xing Rong",
        "alias_zh": None,
        "alias_en": None,
    },
    {
        "source_key": "mao-er",
        "name_zh": "毛二",
        "name_en": "Mao Er",
        "pedigree": "919",
        "sex": "female",
        "birth_date": "2014-07-26",
        "father_zh": "雄浜",
        "father_en": "Xiong Bang",
        "mother_zh": "福娃",
        "mother_en": "Fu Wa",
        "alias_zh": "毛笋",
        "alias_en": "Mao Sun",
    },
)


@dataclass(frozen=True, slots=True)
class DenmarkProfile:
    source_key: str
    name_zh: str
    name_en: str
    pedigree: str
    sex: str
    birth_date: str
    father_zh: str
    father_en: str
    mother_zh: str
    mother_en: str
    alias_zh: str | None
    alias_en: str | None
    source_node: HtmlNode

    @property
    def parity_projection(self) -> tuple[str | None, ...]:
        return (
            self.source_key,
            self.pedigree,
            self.sex,
            self.birth_date,
            self.alias_zh,
            self.alias_en,
        )


@dataclass(frozen=True, slots=True)
class ParsedDenmarkPage:
    profiles: tuple[DenmarkProfile, ...]
    facts: tuple[ExtractedFact, ...]

    @property
    def parity_projection(self) -> tuple[tuple[str | None, ...], ...]:
        return tuple(sorted(item.parity_projection for item in self.profiles))


@dataclass(frozen=True, slots=True)
class ChengduDenmarkHandover2019Adapter:
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
            raise ValueError("Chengdu Denmark adapter requires the reviewed Panda Base source")
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
            "成都大熊猫“星二”“毛二”赴丹欢送仪式",
            "成都大熊猫繁育研究基地赴丹大熊猫简介",
        )
        english_page, english_evidence = _page_and_evidence(
            context,
            ENGLISH_REQUEST_ID,
            "Chengdu Giant Pandas Xing Er and Mao Er Handover",
            "Introductions to the giant pandas from the Chengdu Research Base",
        )
        chinese = _extract_chinese(chinese_page)
        english = _extract_english(english_page)
        if chinese.parity_projection != english.parity_projection:
            raise ValueError("Chengdu Denmark Chinese and English profile facts drifted")

        facts_with_evidence = [
            *((fact, chinese_evidence) for fact in chinese.facts),
            *((fact, english_evidence) for fact in english.facts),
        ]
        candidates = tuple(
            _to_field_candidate(fact, evidence) for fact, evidence in facts_with_evidence
        )
        _assert_unique_pre_reconciliation_candidates(candidates)
        return candidates


ADAPTER = ChengduDenmarkHandover2019Adapter()


def _page_and_evidence(
    context: AdapterParseContext,
    request_id: str,
    title_phrase: str,
    profile_phrase: str,
) -> tuple[SemanticPage, BundleEvidenceSnapshot]:
    response = context.responses.get(request_id)
    evidence = context.evidence_snapshots.get(request_id)
    if response is None or evidence is None:
        raise ValueError(f"Chengdu Denmark adapter did not receive {request_id!r}")
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


def _extract_chinese(page: SemanticPage) -> ParsedDenmarkPage:
    profiles = tuple(_parse_chinese_profile(page, spec) for spec in _PROFILE_SPECS)
    return ParsedDenmarkPage(profiles=profiles, facts=_profile_facts(profiles, language="zh"))


def _extract_english(page: SemanticPage) -> ParsedDenmarkPage:
    profiles = tuple(_parse_english_profile(page, spec) for spec in _PROFILE_SPECS)
    return ParsedDenmarkPage(profiles=profiles, facts=_profile_facts(profiles, language="en"))


def _parse_chinese_profile(page: SemanticPage, spec: dict[str, str | None]) -> DenmarkProfile:
    expected_name = str(spec["name_zh"])
    node = page.one_paragraph_containing(f"大熊猫{expected_name}：谱系号")
    match = _CHINESE_PROFILE_PATTERN.fullmatch(node.text())
    if match is None:
        raise ValueError(f"{page.request_id} profile format drifted for {expected_name}")
    _assert_profile_values(
        page.request_id,
        spec,
        name=match.group("name"),
        pedigree=match.group("pedigree"),
        sex={"雄性": "male", "雌性": "female"}[match.group("sex")],
        birth_date=(
            f"{int(match.group('year')):04d}-{int(match.group('month')):02d}-"
            f"{int(match.group('day')):02d}"
        ),
        father=match.group("father"),
        mother=match.group("mother"),
        nickname=match.group("nickname"),
        language="zh",
    )
    return _profile_from_spec(spec, node)


def _parse_english_profile(page: SemanticPage, spec: dict[str, str | None]) -> DenmarkProfile:
    expected_name = str(spec["name_en"])
    node = page.one_paragraph_containing(f"{expected_name}: Pedigree No.:")
    match = _ENGLISH_PROFILE_PATTERN.fullmatch(node.text())
    if match is None:
        raise ValueError(f"{page.request_id} profile format drifted for {expected_name}")
    parsed_date = datetime.strptime(
        f"{match.group('month')} {match.group('day')}, {match.group('year')}",
        "%B %d, %Y",
    ).date()
    _assert_profile_values(
        page.request_id,
        spec,
        name=match.group("name"),
        pedigree=match.group("pedigree"),
        sex=match.group("sex"),
        birth_date=parsed_date.isoformat(),
        father=match.group("father").strip(),
        mother=match.group("mother").strip(),
        nickname=match.group("nickname").strip() if match.group("nickname") else None,
        language="en",
    )
    return _profile_from_spec(spec, node)


def _assert_profile_values(
    request_id: str,
    spec: dict[str, str | None],
    *,
    name: str,
    pedigree: str,
    sex: str,
    birth_date: str,
    father: str,
    mother: str,
    nickname: str | None,
    language: str,
) -> None:
    expected = {
        "name": spec[f"name_{language}"],
        "pedigree": spec["pedigree"],
        "sex": spec["sex"],
        "birth_date": spec["birth_date"],
        "father": spec[f"father_{language}"],
        "mother": spec[f"mother_{language}"],
        "nickname": spec[f"alias_{language}"],
    }
    actual = {
        "name": name,
        "pedigree": pedigree,
        "sex": sex,
        "birth_date": birth_date,
        "father": father,
        "mother": mother,
        "nickname": nickname,
    }
    if actual != expected:
        raise ValueError(
            f"{request_id} profile facts drifted for {spec['source_key']}: "
            f"expected {expected!r}, found {actual!r}"
        )


def _profile_from_spec(spec: dict[str, str | None], node: HtmlNode) -> DenmarkProfile:
    return DenmarkProfile(
        source_key=str(spec["source_key"]),
        name_zh=str(spec["name_zh"]),
        name_en=str(spec["name_en"]),
        pedigree=str(spec["pedigree"]),
        sex=str(spec["sex"]),
        birth_date=str(spec["birth_date"]),
        father_zh=str(spec["father_zh"]),
        father_en=str(spec["father_en"]),
        mother_zh=str(spec["mother_zh"]),
        mother_en=str(spec["mother_en"]),
        alias_zh=spec["alias_zh"],
        alias_en=spec["alias_en"],
        source_node=node,
    )


def _profile_facts(
    profiles: tuple[DenmarkProfile, ...],
    *,
    language: str,
) -> tuple[ExtractedFact, ...]:
    facts: list[ExtractedFact] = []
    for profile in profiles:
        name = profile.name_zh if language == "zh" else profile.name_en
        father = profile.father_zh if language == "zh" else profile.father_en
        mother = profile.mother_zh if language == "zh" else profile.mother_en
        alias = profile.alias_zh if language == "zh" else profile.alias_en
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
                    "identity.external_identifier.studbook",
                    profile.pedigree,
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
                    CandidateKind.IDENTITY,
                    "identity.birth_date",
                    profile.birth_date,
                    profile.source_node,
                ),
                _fact(
                    profile.source_key,
                    CandidateKind.RELATIONSHIP,
                    "relationship.father",
                    father,
                    profile.source_node,
                    notes=(
                        "Father name is preserved as source text; the adapter does not "
                        "infer a parent slug.",
                    ),
                ),
                _fact(
                    profile.source_key,
                    CandidateKind.RELATIONSHIP,
                    "relationship.mother",
                    mother,
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
                        "event_type": "transfer",
                        "event_date": _TRANSFER_DATE,
                        "location": _TRANSFER_LOCATION,
                    },
                    profile.source_node,
                ),
            )
        )
        if alias:
            facts.append(
                _fact(
                    profile.source_key,
                    CandidateKind.IDENTITY,
                    f"identity.aliases.{language}",
                    alias,
                    profile.source_node,
                )
            )
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
    "ChengduDenmarkHandover2019Adapter",
]

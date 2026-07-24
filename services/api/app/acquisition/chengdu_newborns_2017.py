from __future__ import annotations

from dataclasses import dataclass
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
ADAPTER_ID = "chengdu-newborns-2017"
ADAPTER_VERSION = "1.0.0"
PARSER_NAME = "chengdu-panda-base-newborns-2017"
PARSER_VERSION = "1.0.0"
DEFAULT_COHORT = "chengdu-newborns-2017"

CHINESE_REQUEST_ID = "newborns-2017-zh"
ENGLISH_REQUEST_ID = "newborns-2017-en"
_CHINESE_PATH = "/cn/culture/activities/2023-08-23/8079.html"
_ENGLISH_PATH = "/en/culture/activities/2023-08-24/8080.html"
_DEFAULT_FIXTURE = (
    Path(__file__).resolve().parents[2]
    / "tests"
    / "acquisition"
    / "fixtures"
    / "chengdu-newborns-2017.manifest.json"
)
_MIN_LIVE_BODY_BYTES = 8_000
_BASE_LOCATION = "Chengdu Research Base of Giant Panda Breeding"


@dataclass(frozen=True, slots=True)
class CubSpec:
    source_key: str
    name_zh: str
    name_en: str
    sex: str
    aliases_en: tuple[str, ...] = ()
    pre_naming_descriptor: bool = False


@dataclass(frozen=True, slots=True)
class LitterSpec:
    birth_date: str
    mother_zh: str
    mother_en: str
    chinese_marker: str
    english_marker: str
    cubs: tuple[CubSpec, ...]


_LITTERS = (
    LitterSpec(
        birth_date="2017-04-24",
        mother_zh="芝芝",
        mother_en="Zhi Zhi",
        chinese_marker="2017年4月24日 大熊猫芝芝",
        english_marker="On April 24, 2017 Giant Panda Zhi Zhi",
        cubs=(
            CubSpec("zhi-shi", "芝士", "Zhi Shi", "male", aliases_en=("Cheese",)),
            CubSpec("zhi-ma", "芝麻", "Zhi Ma", "male", aliases_en=("Sesame",)),
        ),
    ),
    LitterSpec(
        birth_date="2017-06-27",
        mother_zh="成大",
        mother_en="Cheng Da",
        chinese_marker="2017年6月27日 大熊猫成大",
        english_marker="On June 27, 2017 Giant Panda Cheng Da",
        cubs=(
            CubSpec("da-mei-2017", "大美", "Da Mei", "female"),
            CubSpec("cheng-lan", "成兰", "Cheng Lan", "male"),
        ),
    ),
    LitterSpec(
        birth_date="2017-07-10",
        mother_zh="晶晶",
        mother_en="Jing Jing",
        chinese_marker="2017年7月10日 大熊猫晶晶",
        english_marker="On July 10, 2017 Giant Panda Jing Jing",
        cubs=(CubSpec("jing-liang", "晶亮", "Jing Liang", "male"),),
    ),
    LitterSpec(
        birth_date="2017-07-15",
        mother_zh="奇珍",
        mother_en="Qi Zhen",
        chinese_marker="2017年7月15日 大熊猫奇珍",
        english_marker="On July 15, 2017 Giant Panda Qi Zhen",
        cubs=(CubSpec("zhen-xi", "珍喜", "Zhen Xi", "female"),),
    ),
    LitterSpec(
        birth_date="2017-07-20",
        mother_zh="妮妮",
        mother_en="Ni Ni",
        chinese_marker="2017年7月20日 大熊猫妮妮",
        english_marker="On July 20, 2017 Giant Panda Ni Ni",
        cubs=(
            CubSpec("ni-ke-2017", "妮可", "Ni Ke", "female", aliases_en=("Nicole",)),
            CubSpec("ni-na", "妮娜", "Ni Na", "female"),
        ),
    ),
    LitterSpec(
        birth_date="2017-07-26",
        mother_zh="二巧",
        mother_en="Er Qiao",
        chinese_marker="2017年7月26日 大熊猫二巧",
        english_marker="On July 26, 2017 Giant panda Er Qiao",
        cubs=(CubSpec("qing-qing-2017-07-26", "青青", "Qing Qing", "female"),),
    ),
    LitterSpec(
        birth_date="2017-07-26",
        mother_zh="小丫头",
        mother_en="Xiao Yatou",
        chinese_marker="2017年7月26日 大熊猫小丫头",
        english_marker="On July 26, 2017 Giant panda Xiao Yatou",
        cubs=(CubSpec("xiao-xin-2017", "小馨", "Xiao Xin", "female"),),
    ),
    LitterSpec(
        birth_date="2017-08-04",
        mother_zh="欢欢",
        mother_en="Huan Huan",
        chinese_marker="2017年8月4日 大熊猫欢欢",
        english_marker="On August 4, 2017 Giant Panda Huan Huan",
        cubs=(
            CubSpec(
                "huan-huanzai-2017",
                "欢欢仔",
                "Huan Huanzai",
                "male",
                pre_naming_descriptor=True,
            ),
        ),
    ),
)


@dataclass(frozen=True, slots=True)
class ParsedCub:
    spec: CubSpec
    birth_date: str
    mother_zh: str
    mother_en: str
    source_node: HtmlNode

    @property
    def parity_projection(self) -> tuple[str, str, str, str, str]:
        return (
            self.spec.source_key,
            self.birth_date,
            self.spec.sex,
            self.mother_zh,
            self.mother_en,
        )


@dataclass(frozen=True, slots=True)
class ParsedNewbornPage:
    cubs: tuple[ParsedCub, ...]
    facts: tuple[ExtractedFact, ...]

    @property
    def parity_projection(self) -> tuple[tuple[str, str, str, str, str], ...]:
        return tuple(sorted(item.parity_projection for item in self.cubs))


@dataclass(frozen=True, slots=True)
class ChengduNewborns2017Adapter:
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
            raise ValueError("Chengdu 2017 newborn adapter requires the reviewed Panda Base source")
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
            "2017新生大熊猫宝宝齐亮相",
            "2017年成都大熊猫繁育研究基地产仔情况",
        )
        english_page, english_evidence = _page_and_evidence(
            context,
            ENGLISH_REQUEST_ID,
            "Debut of 2017 Newborn Pandas",
            "Delivery Overview of the Base in 2017",
        )
        chinese = _extract_page(chinese_page, language="zh")
        english = _extract_page(english_page, language="en")
        if chinese.parity_projection != english.parity_projection:
            raise ValueError("Chengdu 2017 newborn Chinese and English facts drifted")

        facts_with_evidence = [
            *((fact, chinese_evidence) for fact in chinese.facts),
            *((fact, english_evidence) for fact in english.facts),
        ]
        candidates = tuple(
            _to_field_candidate(fact, evidence) for fact, evidence in facts_with_evidence
        )
        _assert_unique_pre_reconciliation_candidates(candidates)
        return candidates


ADAPTER = ChengduNewborns2017Adapter()


def _page_and_evidence(
    context: AdapterParseContext,
    request_id: str,
    title_phrase: str,
    overview_phrase: str,
) -> tuple[SemanticPage, BundleEvidenceSnapshot]:
    response = context.responses.get(request_id)
    evidence = context.evidence_snapshots.get(request_id)
    if response is None or evidence is None:
        raise ValueError(f"Chengdu 2017 newborn adapter did not receive {request_id!r}")
    if response.status != 200:
        raise ValueError(f"{request_id} returned HTTP {response.status}")
    content_type = _header(response.headers, "content-type").lower()
    if "text/html" not in content_type:
        raise ValueError(f"{request_id} must return text/html")
    if context.mode is AcquisitionMode.LIVE and len(response.body) < _MIN_LIVE_BODY_BYTES:
        raise ValueError(f"{request_id} body size collapsed below the reviewed threshold")
    page = SemanticPage.parse(request_id, response.body)
    page.require_document_text(title_phrase)
    page.require_document_text(overview_phrase)
    return page, evidence


def _extract_page(page: SemanticPage, *, language: str) -> ParsedNewbornPage:
    document_text = page.root.text()
    parsed: list[ParsedCub] = []
    for index, litter in enumerate(_LITTERS):
        marker = litter.chinese_marker if language == "zh" else litter.english_marker
        next_marker = None
        if index + 1 < len(_LITTERS):
            following = _LITTERS[index + 1]
            next_marker = following.chinese_marker if language == "zh" else following.english_marker
        segment = _segment(document_text, marker, next_marker, request_id=page.request_id)
        for cub in litter.cubs:
            _validate_cub_segment(page.request_id, segment, cub, language=language)
            token = cub.name_zh if language == "zh" else cub.name_en
            source_node = _smallest_node_containing(page, token)
            parsed.append(
                ParsedCub(
                    spec=cub,
                    birth_date=litter.birth_date,
                    mother_zh=litter.mother_zh,
                    mother_en=litter.mother_en,
                    source_node=source_node,
                )
            )
    cubs = tuple(parsed)
    return ParsedNewbornPage(cubs=cubs, facts=_cub_facts(cubs, language=language))


def _segment(text: str, marker: str, next_marker: str | None, *, request_id: str) -> str:
    start = text.find(marker)
    if start < 0:
        raise ValueError(f"{request_id} is missing reviewed litter marker {marker!r}")
    if next_marker is None:
        return text[start:]
    end = text.find(next_marker, start + len(marker))
    if end < 0:
        raise ValueError(f"{request_id} is missing reviewed litter marker {next_marker!r}")
    return text[start:end]


def _validate_cub_segment(
    request_id: str,
    segment: str,
    cub: CubSpec,
    *,
    language: str,
) -> None:
    if language == "zh":
        expected = f"{cub.name_zh}：{'雄性' if cub.sex == 'male' else '雌性'}"
    else:
        alias_text = f" ({cub.aliases_en[0]})" if cub.aliases_en else ""
        if cub.pre_naming_descriptor:
            alias_text = " (son of Huan Huan)"
        expected = f"{cub.name_en}{alias_text}: {cub.sex}"
    if expected not in segment:
        raise ValueError(
            f"{request_id} cub facts drifted for {cub.source_key}: missing {expected!r}"
        )


def _smallest_node_containing(page: SemanticPage, phrase: str) -> HtmlNode:
    matches = [
        node
        for node in page.nodes
        if node.tag in {"p", "li", "div", "section", "article"} and phrase in node.text()
    ]
    if not matches:
        raise ValueError(f"{page.request_id} has no evidence node containing {phrase!r}")
    return min(matches, key=lambda node: (len(node.text()), node.tag))


def _cub_facts(
    cubs: tuple[ParsedCub, ...],
    *,
    language: str,
) -> tuple[ExtractedFact, ...]:
    facts: list[ExtractedFact] = []
    for parsed in cubs:
        cub = parsed.spec
        name = cub.name_zh if language == "zh" else cub.name_en
        mother = parsed.mother_zh if language == "zh" else parsed.mother_en
        name_path = (
            f"identity.aliases.{language}"
            if cub.pre_naming_descriptor
            else f"identity.names.official.{language}"
        )
        notes = (
            ("This is a pre-naming source descriptor and is preserved as an alias.",)
            if cub.pre_naming_descriptor
            else ()
        )
        facts.extend(
            (
                _fact(
                    cub.source_key,
                    CandidateKind.IDENTITY,
                    name_path,
                    name,
                    parsed.source_node,
                    notes=notes,
                ),
                _fact(
                    cub.source_key,
                    CandidateKind.IDENTITY,
                    "identity.birth_date",
                    parsed.birth_date,
                    parsed.source_node,
                ),
                _fact(
                    cub.source_key,
                    CandidateKind.IDENTITY,
                    "identity.sex",
                    cub.sex,
                    parsed.source_node,
                ),
                _fact(
                    cub.source_key,
                    CandidateKind.RELATIONSHIP,
                    "relationship.mother",
                    mother,
                    parsed.source_node,
                    notes=(
                        "Mother name is preserved as source text; the adapter does not "
                        "infer a parent slug.",
                    ),
                ),
                _fact(
                    cub.source_key,
                    CandidateKind.EVENT,
                    "event",
                    {
                        "event_type": "birth",
                        "event_date": parsed.birth_date,
                        "location": _BASE_LOCATION,
                    },
                    parsed.source_node,
                ),
            )
        )
        if language == "en":
            for alias in cub.aliases_en:
                facts.append(
                    _fact(
                        cub.source_key,
                        CandidateKind.IDENTITY,
                        "identity.aliases.en",
                        alias,
                        parsed.source_node,
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
    "ChengduNewborns2017Adapter",
]

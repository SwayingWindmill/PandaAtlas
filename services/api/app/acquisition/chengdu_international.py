from __future__ import annotations

import re
from collections.abc import Iterator, Sequence
from dataclasses import dataclass, field
from html.parser import HTMLParser
from pathlib import Path
from typing import Any
from urllib.parse import urljoin

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
from .contracts.v1 import JsonValue, canonical_json_bytes
from .runner import AdapterParseContext, AdapterRequest
from .source_registry import ReviewedSource

SOURCE_ID = "chengdu-panda-base-international-cooperation"
ADAPTER_ID = "chengdu-international-cooperation"
ADAPTER_VERSION = "1.0.0"
PARSER_NAME = "chengdu-panda-base-international-cooperation"
PARSER_VERSION = "1.0.0"
DEFAULT_COHORT = "chengdu-international-cooperation-2026"

CHINESE_REQUEST_ID = "international-cooperation-zh"
ENGLISH_REQUEST_ID = "international-cooperation-en"
_CHINESE_PATH = "/cn/cooperate/international/"
_ENGLISH_PATH = "/en/cooperate/international/"
_DEFAULT_FIXTURE = (
    Path(__file__).resolve().parents[2]
    / "tests"
    / "acquisition"
    / "fixtures"
    / "chengdu-international-cooperation.manifest.json"
)
_MIN_LIVE_BODY_BYTES = 10_000
_VOID_TAGS = frozenset(
    {
        "area",
        "base",
        "br",
        "col",
        "embed",
        "hr",
        "img",
        "input",
        "link",
        "meta",
        "param",
        "source",
        "track",
        "wbr",
    }
)
_SKIP_TEXT_TAGS = frozenset({"script", "style", "noscript", "svg", "template"})


@dataclass(slots=True, eq=False)
class HtmlNode:
    tag: str
    attrs: dict[str, str]
    parent: HtmlNode | None = None
    children: list[HtmlNode | str] = field(default_factory=list)

    def iter_nodes(self) -> Iterator[HtmlNode]:
        yield self
        for child in self.children:
            if isinstance(child, HtmlNode):
                yield from child.iter_nodes()

    def text(self) -> str:
        parts: list[str] = []
        self._append_text(parts)
        return _collapse_space("".join(parts))

    def _append_text(self, parts: list[str]) -> None:
        if self.tag in _SKIP_TEXT_TAGS:
            return
        for child in self.children:
            if isinstance(child, str):
                parts.append(child)
            else:
                child._append_text(parts)


class _TreeParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.root = HtmlNode("document", {})
        self.stack = [self.root]

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        node = HtmlNode(
            tag=tag.lower(),
            attrs={key.lower(): value or "" for key, value in attrs},
            parent=self.stack[-1],
        )
        self.stack[-1].children.append(node)
        if node.tag not in _VOID_TAGS:
            self.stack.append(node)

    def handle_startendtag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        self.handle_starttag(tag, attrs)
        if self.stack[-1].tag == tag.lower() and tag.lower() not in _VOID_TAGS:
            self.stack.pop()

    def handle_endtag(self, tag: str) -> None:
        normalized = tag.lower()
        for index in range(len(self.stack) - 1, 0, -1):
            if self.stack[index].tag == normalized:
                del self.stack[index:]
                return

    def handle_data(self, data: str) -> None:
        self.stack[-1].children.append(data)


@dataclass(frozen=True, slots=True)
class SemanticPage:
    request_id: str
    root: HtmlNode
    nodes: tuple[HtmlNode, ...]

    @classmethod
    def parse(cls, request_id: str, body: bytes) -> SemanticPage:
        try:
            text = body.decode("utf-8")
        except UnicodeDecodeError as error:
            raise ValueError(f"{request_id} response is not UTF-8 HTML") from error
        parser = _TreeParser()
        parser.feed(text)
        parser.close()
        return cls(request_id=request_id, root=parser.root, nodes=tuple(parser.root.iter_nodes()))

    def exact_text_node(self, tag: str, text: str) -> HtmlNode:
        matches = [node for node in self.nodes if node.tag == tag and node.text() == text]
        if len(matches) != 1:
            raise ValueError(
                f"{self.request_id} expected exactly one {tag} with text {text!r}; "
                f"found {len(matches)}"
            )
        return matches[0]

    def require_document_text(self, phrase: str) -> None:
        if phrase not in self.root.text():
            raise ValueError(f"{self.request_id} is missing reviewed text {phrase!r}")

    def one_paragraph_containing(self, phrase: str) -> HtmlNode:
        matches = [node for node in self.nodes if node.tag == "p" and phrase in node.text()]
        if len(matches) != 1:
            raise ValueError(
                f"{self.request_id} expected exactly one paragraph containing {phrase!r}; "
                f"found {len(matches)}"
            )
        return matches[0]


@dataclass(frozen=True, slots=True)
class ExtractedFact:
    subject_key: str
    candidate_kind: CandidateKind
    field_path: str
    raw_value: JsonValue
    source_node: HtmlNode
    notes: tuple[str, ...] = ()


@dataclass(frozen=True, slots=True)
class ParsedCohort:
    facts: tuple[ExtractedFact, ...]
    identity_names: dict[str, tuple[str, str]]
    transfer_dates: dict[str, str]


@dataclass(frozen=True, slots=True)
class ChengduInternationalCooperationAdapter:
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
            raise ValueError("Chengdu adapter requires the reviewed Panda Base source")
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
        chinese_page, chinese_evidence = _page_and_evidence(context, CHINESE_REQUEST_ID, "国际合作")
        english_page, english_evidence = _page_and_evidence(
            context,
            ENGLISH_REQUEST_ID,
            "International Cooperation",
        )
        chinese = _extract_chinese(chinese_page)
        english = _extract_english(english_page)
        _assert_bilingual_parity(chinese, english)

        facts_with_evidence = [
            *((fact, chinese_evidence) for fact in chinese.facts),
            *((fact, english_evidence) for fact in english.facts),
        ]
        candidates = tuple(
            _to_field_candidate(fact, evidence) for fact, evidence in facts_with_evidence
        )
        _assert_unique_pre_reconciliation_candidates(candidates)
        return candidates


ADAPTER = ChengduInternationalCooperationAdapter()


def _page_and_evidence(
    context: AdapterParseContext,
    request_id: str,
    heading: str,
) -> tuple[SemanticPage, BundleEvidenceSnapshot]:
    response = context.responses.get(request_id)
    evidence = context.evidence_snapshots.get(request_id)
    if response is None or evidence is None:
        raise ValueError(f"Chengdu adapter did not receive planned response {request_id!r}")
    if response.status != 200:
        raise ValueError(f"{request_id} returned HTTP {response.status}")
    content_type = _header(response.headers, "content-type").lower()
    if "text/html" not in content_type:
        raise ValueError(f"{request_id} must return text/html")
    if context.mode is AcquisitionMode.LIVE and len(response.body) < _MIN_LIVE_BODY_BYTES:
        raise ValueError(f"{request_id} body size collapsed below the reviewed threshold")
    page = SemanticPage.parse(request_id, response.body)
    page.require_document_text(heading)
    page.require_document_text(
        "繁育合作" if request_id == CHINESE_REQUEST_ID else "Breeding Cooperation"
    )
    return page, evidence


def _extract_chinese(page: SemanticPage) -> ParsedCohort:
    mei_mei_node = page.one_paragraph_containing("大熊猫“梅梅”")
    lun_lun_node = page.one_paragraph_containing("旅美大熊猫“伦伦”")
    hua_node = page.one_paragraph_containing("雌性大熊猫“花嘴巴”")
    france_node = page.one_paragraph_containing("雄性大熊猫“圆仔”")
    yuan_meng_node = page.one_paragraph_containing("首只在法国出生的大熊猫“圆梦”")
    berlin_node = page.one_paragraph_containing("“梦梦”和“娇庆”")
    copenhagen_node = page.one_paragraph_containing("大熊猫 “星二”和“毛二”")

    facts: list[ExtractedFact] = []
    names = {
        "mei-mei": ("梅梅", "Mei Mei"),
        "lun-lun": ("伦伦", "Lun Lun"),
        "mei-lan": ("美兰", "Mei Lan"),
        "hua-zui-ba": ("花嘴巴", "Hua Zui Ba"),
        "yuan-zai": ("圆仔", "Yuan Zai"),
        "huan-huan": ("欢欢", "Huan Huan"),
        "yuan-meng": ("圆梦", "Yuan Meng"),
        "meng-meng": ("梦梦", "Meng Meng"),
        "jiao-qing": ("娇庆", "Jiao Qing"),
        "xing-er": ("星二", "Xing Er"),
        "mao-er": ("毛二", "Mao Er"),
    }
    nodes = {
        "mei-mei": mei_mei_node,
        "lun-lun": lun_lun_node,
        "mei-lan": lun_lun_node,
        "hua-zui-ba": hua_node,
        "yuan-zai": france_node,
        "huan-huan": france_node,
        "yuan-meng": yuan_meng_node,
        "meng-meng": berlin_node,
        "jiao-qing": berlin_node,
        "xing-er": copenhagen_node,
        "mao-er": copenhagen_node,
    }
    for key, (name_zh, _) in names.items():
        facts.append(
            _fact(key, CandidateKind.IDENTITY, "identity.names.official.zh", name_zh, nodes[key])
        )

    facts.extend(
        (
            _fact(
                "mei-lan",
                CandidateKind.IDENTITY,
                "identity.birth_date",
                {"value": "2006", "precision": "year"},
                lun_lun_node,
            ),
            _fact("hua-zui-ba", CandidateKind.IDENTITY, "identity.sex", "female", hua_node),
            _fact("yuan-zai", CandidateKind.IDENTITY, "identity.sex", "male", france_node),
            _fact("huan-huan", CandidateKind.IDENTITY, "identity.sex", "female", france_node),
        )
    )
    for year in ("2000", "2001", "2003", "2005", "2006"):
        facts.append(
            _event_fact("mei-mei", "gave_birth", year, "Adventure World, Shirahama", mei_mei_node)
        )
    for year in ("2006", "2008", "2010", "2013"):
        facts.append(_event_fact("lun-lun", "gave_birth", year, "Zoo Atlanta", lun_lun_node))
    for year in ("2010", "2013", "2016", "2021"):
        facts.append(_event_fact("hua-zui-ba", "gave_birth", year, "Madrid Zoo", hua_node))
    facts.extend(
        (
            _event_fact("yuan-zai", "transfer", "2012-01-15", "Beauval Zoo", france_node),
            _event_fact("huan-huan", "transfer", "2012-01-15", "Beauval Zoo", france_node),
            _event_fact("yuan-meng", "return", "2023-07-25", "China", yuan_meng_node),
            _event_fact("meng-meng", "arrival", "2017-06-24", "Germany", berlin_node),
            _event_fact("jiao-qing", "arrival", "2017-06-24", "Germany", berlin_node),
            _event_fact(
                "meng-meng", "arrival", "2017-07-05", "Berlin Zoo Panda House", berlin_node
            ),
            _event_fact(
                "jiao-qing", "arrival", "2017-07-05", "Berlin Zoo Panda House", berlin_node
            ),
            _event_fact("meng-meng", "gave_birth", "2019-09-01", "Berlin Zoo", berlin_node),
            _event_fact("xing-er", "transfer", "2019-04-04", "Copenhagen Zoo", copenhagen_node),
            _event_fact("mao-er", "transfer", "2019-04-04", "Copenhagen Zoo", copenhagen_node),
        )
    )
    return ParsedCohort(
        facts=tuple(facts),
        identity_names=names,
        transfer_dates={
            "france": "2012-01-15",
            "yuan-meng-return": "2023-07-25",
            "berlin-arrival": "2017-06-24",
            "berlin-house": "2017-07-05",
            "copenhagen": "2019-04-04",
        },
    )


def _extract_english(page: SemanticPage) -> ParsedCohort:
    mei_mei_node = page.one_paragraph_containing("Giant panda Mei Mei")
    lun_lun_node = page.one_paragraph_containing("giant panda Lun Lun")
    mei_lan_node = page.one_paragraph_containing("Mei Lan born in 2006")
    hua_node = page.one_paragraph_containing("female giant panda Hua Zui Ba")
    france_node = page.one_paragraph_containing("male giant panda Yuan Zai")
    yuan_meng_node = page.one_paragraph_containing(
        "Yuan Meng, the first giant panda born in France"
    )
    berlin_node = page.one_paragraph_containing("Meng Meng and Jiao Qing")
    copenhagen_node = page.one_paragraph_containing("giant pandas Xing Er and Mao Er")

    names = {
        "mei-mei": ("梅梅", "Mei Mei"),
        "lun-lun": ("伦伦", "Lun Lun"),
        "mei-lan": ("美兰", "Mei Lan"),
        "hua-zui-ba": ("花嘴巴", "Hua Zui Ba"),
        "yuan-zai": ("圆仔", "Yuan Zai"),
        "huan-huan": ("欢欢", "Huan Huan"),
        "yuan-meng": ("圆梦", "Yuan Meng"),
        "meng-meng": ("梦梦", "Meng Meng"),
        "jiao-qing": ("娇庆", "Jiao Qing"),
        "xing-er": ("星二", "Xing Er"),
        "mao-er": ("毛二", "Mao Er"),
    }
    nodes = {
        "mei-mei": mei_mei_node,
        "lun-lun": lun_lun_node,
        "mei-lan": mei_lan_node,
        "hua-zui-ba": hua_node,
        "yuan-zai": france_node,
        "huan-huan": france_node,
        "yuan-meng": yuan_meng_node,
        "meng-meng": berlin_node,
        "jiao-qing": berlin_node,
        "xing-er": copenhagen_node,
        "mao-er": copenhagen_node,
    }
    facts = [
        _fact(key, CandidateKind.IDENTITY, "identity.names.official.en", name_en, nodes[key])
        for key, (_, name_en) in names.items()
    ]
    facts.extend(
        (
            _fact(
                "mei-lan",
                CandidateKind.IDENTITY,
                "identity.birth_date",
                {"value": "2006", "precision": "year"},
                mei_lan_node,
            ),
            _fact("hua-zui-ba", CandidateKind.IDENTITY, "identity.sex", "female", hua_node),
            _fact("yuan-zai", CandidateKind.IDENTITY, "identity.sex", "male", france_node),
            _fact("huan-huan", CandidateKind.IDENTITY, "identity.sex", "female", france_node),
        )
    )
    for year in ("2000", "2001", "2003", "2005", "2006"):
        facts.append(
            _event_fact("mei-mei", "gave_birth", year, "Adventure World, Shirahama", mei_mei_node)
        )
    for year in ("2006", "2008", "2010", "2013"):
        facts.append(_event_fact("lun-lun", "gave_birth", year, "Zoo Atlanta", lun_lun_node))
    for year in ("2010", "2013", "2016", "2021"):
        facts.append(_event_fact("hua-zui-ba", "gave_birth", year, "Madrid Zoo", hua_node))
    facts.extend(
        (
            _event_fact("yuan-zai", "transfer", "2012-01-15", "Beauval Zoo", france_node),
            _event_fact("huan-huan", "transfer", "2012-01-15", "Beauval Zoo", france_node),
            _event_fact("yuan-meng", "return", "2023-07-25", "China", yuan_meng_node),
            _event_fact("meng-meng", "arrival", "2017-06-24", "Germany", berlin_node),
            _event_fact("jiao-qing", "arrival", "2017-06-24", "Germany", berlin_node),
            _event_fact(
                "meng-meng", "arrival", "2017-07-05", "Berlin Zoo Panda House", berlin_node
            ),
            _event_fact(
                "jiao-qing", "arrival", "2017-07-05", "Berlin Zoo Panda House", berlin_node
            ),
            _event_fact("meng-meng", "gave_birth", "2019-09-01", "Berlin Zoo", berlin_node),
            _event_fact("xing-er", "transfer", "2019-04-04", "Copenhagen Zoo", copenhagen_node),
            _event_fact("mao-er", "transfer", "2019-04-04", "Copenhagen Zoo", copenhagen_node),
        )
    )
    return ParsedCohort(
        facts=tuple(facts),
        identity_names=names,
        transfer_dates={
            "france": "2012-01-15",
            "yuan-meng-return": "2023-07-25",
            "berlin-arrival": "2017-06-24",
            "berlin-house": "2017-07-05",
            "copenhagen": "2019-04-04",
        },
    )


def _assert_bilingual_parity(chinese: ParsedCohort, english: ParsedCohort) -> None:
    if chinese.identity_names != english.identity_names:
        raise ValueError("Chengdu Chinese and English identity sets drifted")
    if chinese.transfer_dates != english.transfer_dates:
        raise ValueError("Chengdu Chinese and English event dates drifted")


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


def _event_fact(
    source_key: str,
    event_type: str,
    event_date: str,
    location: str,
    source_node: HtmlNode,
) -> ExtractedFact:
    return _fact(
        source_key,
        CandidateKind.EVENT,
        "event",
        {
            "event_type": event_type,
            "event_date": event_date,
            "location": location,
        },
        source_node,
        notes=(
            "The event subject is the named panda; gave_birth events describe the "
            "panda as the mother, not the newborn cub.",
        )
        if event_type == "gave_birth"
        else (),
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


def _assert_unique_pre_reconciliation_candidates(candidates: Sequence[FieldCandidate]) -> None:
    keys: set[bytes] = set()
    for candidate in candidates:
        key = canonical_json_bytes(
            {
                "evidence_snapshot_id": candidate.evidence_snapshot_id,
                "subject_key": candidate.subject_key,
                "candidate_kind": candidate.candidate_kind.value,
                "field_path": candidate.field_path,
                "raw_value": candidate.raw_value,
            }
        )
        if key in keys:
            raise ValueError("Chengdu adapter emitted a duplicate pre-reconciliation candidate")
        keys.add(key)


def _css_selector(node: HtmlNode) -> str:
    segments: list[str] = []
    current: HtmlNode | None = node
    while current is not None and current.tag != "document":
        segment = current.tag
        node_id = current.attrs.get("id")
        if node_id:
            segments.append(f"{segment}#{_css_escape(node_id)}")
            break
        classes = [value for value in current.attrs.get("class", "").split() if value]
        if classes:
            segment += "".join(f".{_css_escape(value)}" for value in classes[:2])
        if current.parent is not None:
            siblings = [
                child
                for child in current.parent.children
                if isinstance(child, HtmlNode) and child.tag == current.tag
            ]
            if len(siblings) > 1:
                segment += f":nth-of-type({siblings.index(current) + 1})"
        segments.append(segment)
        current = current.parent
    return " > ".join(reversed(segments))


def _css_escape(value: str) -> str:
    return re.sub(r"[^a-zA-Z0-9_-]", lambda match: f"\\{match.group(0)}", value)


def _collapse_space(value: str) -> str:
    return " ".join(value.replace("\xa0", " ").split())


def _header(headers: Any, key: str) -> str:
    for header, value in headers.items():
        if str(header).lower() == key.lower():
            return str(value).strip()
    return ""


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
    "ChengduInternationalCooperationAdapter",
]

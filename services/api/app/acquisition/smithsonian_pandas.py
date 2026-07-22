from __future__ import annotations

import re
from collections.abc import Iterable, Iterator, Sequence
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

SOURCE_ID = "smithsonian-national-zoo-panda-pages"
ADAPTER_ID = "smithsonian-panda-profiles"
ADAPTER_VERSION = "1.0.0"
PARSER_NAME = "smithsonian-national-zoo-panda-pages"
PARSER_VERSION = "1.0.0"
DEFAULT_COHORT = "smithsonian-reviewed-profile-cohort"

PROFILE_REQUEST_ID = "giant-panda-profile"
FAQ_REQUEST_ID = "giant-panda-faqs"
HISTORY_REQUEST_ID = "giant-panda-history"

_PROFILE_PATH = "/animals/giant-panda"
_FAQ_PATH = "/animals/giant-panda-faqs"
_HISTORY_PATH = "/animals/history-giant-pandas-zoo"

_DEFAULT_FIXTURE = (
    Path(__file__).resolve().parents[2]
    / "tests"
    / "acquisition"
    / "fixtures"
    / "smithsonian-panda-pages.manifest.json"
)

_MIN_LIVE_BODY_BYTES = {
    PROFILE_REQUEST_ID: 40_000,
    FAQ_REQUEST_ID: 40_000,
    HISTORY_REQUEST_ID: 40_000,
}

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
_HEADING_TAGS = frozenset({"h1", "h2", "h3", "h4", "h5", "h6"})


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

    def descendants(self, *, tag: str | None = None) -> Iterator[HtmlNode]:
        for child in self.children:
            if not isinstance(child, HtmlNode):
                continue
            if tag is None or child.tag == tag:
                yield child
            yield from child.descendants(tag=tag)

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

    def has_class(self, value: str) -> bool:
        return value in self.attrs.get("class", "").split()


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

    def nodes_with_tag(self, tag: str) -> tuple[HtmlNode, ...]:
        return tuple(node for node in self.nodes if node.tag == tag)

    def exact_text_node(self, tag: str, text: str) -> HtmlNode:
        matches = [node for node in self.nodes_with_tag(tag) if node.text() == text]
        if len(matches) != 1:
            raise ValueError(
                f"{self.request_id} expected exactly one {tag} with text {text!r}; "
                f"found {len(matches)}"
            )
        return matches[0]

    def one_paragraph_containing(self, phrase: str) -> HtmlNode:
        matches = [node for node in self.nodes_with_tag("p") if phrase in node.text()]
        if len(matches) != 1:
            raise ValueError(
                f"{self.request_id} expected exactly one paragraph containing {phrase!r}; "
                f"found {len(matches)}"
            )
        return matches[0]

    def preceding_year(self, node: HtmlNode) -> str:
        index = next(
            (position for position, candidate in enumerate(self.nodes) if candidate is node),
            None,
        )
        if index is None:
            raise ValueError("timeline node is outside the parsed document")
        for candidate in reversed(self.nodes[:index]):
            if candidate.tag not in _HEADING_TAGS:
                continue
            match = re.fullmatch(r"(18|19|20)\d{2}", candidate.text())
            if match:
                return match.group(0)
        raise ValueError(f"{self.request_id} could not find a preceding timeline year")

    def faq_item(self, question: str) -> tuple[HtmlNode, tuple[HtmlNode, ...]]:
        matches: list[tuple[HtmlNode, tuple[HtmlNode, ...]]] = []
        for item in (node for node in self.nodes if node.has_class("accordion-item")):
            buttons = tuple(item.descendants(tag="button"))
            if len(buttons) != 1:
                continue
            question_nodes = tuple(buttons[0].descendants(tag="p"))
            if len(question_nodes) != 1 or question_nodes[0].text() != question:
                continue
            paragraphs = tuple(
                paragraph
                for paragraph in item.descendants(tag="p")
                if not _is_descendant_of(paragraph, buttons[0])
            )
            matches.append((item, paragraphs))
        if len(matches) != 1:
            raise ValueError(
                f"{self.request_id} expected exactly one FAQ item {question!r}; "
                f"found {len(matches)}"
            )
        item, paragraphs = matches[0]
        if not paragraphs:
            raise ValueError(f"{self.request_id} FAQ item {question!r} has no answer paragraphs")
        return item, paragraphs


@dataclass(frozen=True, slots=True)
class ExtractedFact:
    subject_key: str
    candidate_kind: CandidateKind
    field_path: str
    raw_value: JsonValue
    source_node: HtmlNode
    notes: tuple[str, ...] = ()


@dataclass(frozen=True, slots=True)
class SmithsonianPandaProfilesAdapter:
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
            raise ValueError("Smithsonian adapter requires the reviewed National Zoo source")
        return tuple(
            AdapterRequest(request_id=request_id, url=urljoin(source.base_url, path.lstrip("/")))
            for request_id, path in (
                (PROFILE_REQUEST_ID, _PROFILE_PATH),
                (FAQ_REQUEST_ID, _FAQ_PATH),
                (HISTORY_REQUEST_ID, _HISTORY_PATH),
            )
        )

    def parse(self, context: AdapterParseContext) -> tuple[FieldCandidate, ...]:
        facts: list[tuple[ExtractedFact, BundleEvidenceSnapshot]] = []
        for request_id, extractor in (
            (PROFILE_REQUEST_ID, _extract_profile_facts),
            (FAQ_REQUEST_ID, _extract_faq_facts),
            (HISTORY_REQUEST_ID, _extract_history_facts),
        ):
            response = context.responses.get(request_id)
            evidence = context.evidence_snapshots.get(request_id)
            if response is None or evidence is None:
                raise ValueError(
                    f"Smithsonian adapter did not receive planned response {request_id!r}"
                )
            page = _validated_page(
                request_id,
                response.status,
                response.headers,
                response.body,
                mode=context.mode,
            )
            facts.extend((fact, evidence) for fact in extractor(page))

        candidates = tuple(_to_field_candidate(fact, evidence) for fact, evidence in facts)
        _assert_unique_pre_reconciliation_candidates(candidates)
        return candidates


ADAPTER = SmithsonianPandaProfilesAdapter()


def _validated_page(
    request_id: str,
    status: int,
    headers: Any,
    body: bytes,
    *,
    mode: AcquisitionMode,
) -> SemanticPage:
    if status != 200:
        raise ValueError(f"{request_id} returned HTTP {status}")
    content_type = _header(headers, "content-type").lower()
    if "text/html" not in content_type:
        raise ValueError(f"{request_id} must return text/html")
    if mode is AcquisitionMode.LIVE and len(body) < _MIN_LIVE_BODY_BYTES[request_id]:
        raise ValueError(f"{request_id} body size collapsed below the reviewed threshold")

    page = SemanticPage.parse(request_id, body)
    title_expectation, h1_expectation = {
        PROFILE_REQUEST_ID: (
            "Giant panda | Smithsonian's National Zoo and Conservation Biology Institute",
            "Giant panda",
        ),
        FAQ_REQUEST_ID: (
            "Giant Panda FAQs | Smithsonian's National Zoo and Conservation Biology Institute",
            "Giant Panda FAQs",
        ),
        HISTORY_REQUEST_ID: (
            "The History of Giant Pandas at the Smithsonian's National Zoo and Conservation "
            "Biology Institute | Smithsonian's National Zoo and Conservation Biology Institute",
            "The History of Giant Pandas at the Smithsonian's National Zoo and Conservation "
            "Biology Institute",
        ),
    }[request_id]
    page.exact_text_node("title", title_expectation)
    page.exact_text_node("h1", h1_expectation)
    return page


def _extract_profile_facts(page: SemanticPage) -> tuple[ExtractedFact, ...]:
    page.exact_text_node("h2", "Meet the Animals")
    bao_node = page.one_paragraph_containing("Male panda Bao Li was born")
    qing_node = page.one_paragraph_containing("Female panda Qing Bao was born")

    bao = _required_match(
        re.compile(r"Male panda (?P<name>Bao Li) was born (?P<date>Aug\. 4, 2021)\b"),
        bao_node.text(),
        "Bao Li profile",
    )
    qing = _required_match(
        re.compile(r"Female panda (?P<name>Qing Bao) was born (?P<date>Sept\. 12, 2021)\b"),
        qing_node.text(),
        "Qing Bao profile",
    )

    facts: list[ExtractedFact] = []
    for node, match, sex in ((bao_node, bao, "Male"), (qing_node, qing, "Female")):
        name = match.group("name")
        facts.extend(
            (
                _fact(name, CandidateKind.IDENTITY, "identity.names.official.en", name, node),
                _fact(name, CandidateKind.IDENTITY, "identity.sex", sex, node),
                _fact(
                    name, CandidateKind.IDENTITY, "identity.birth_date", match.group("date"), node
                ),
                _absent_fact(
                    name,
                    CandidateKind.IDENTITY,
                    "identity.life_status",
                    node,
                    "The reviewed profile states sex and birth details but not "
                    "current life status.",
                ),
            )
        )
    return tuple(facts)


def _extract_faq_facts(page: SemanticPage) -> tuple[ExtractedFact, ...]:
    page.exact_text_node("h2", "Visiting the Pandas at the Smithsonian's National Zoo")
    _, name_paragraphs = page.faq_item("What are the giant panda's names?")
    name_node = _one_node_containing(name_paragraphs, "The giant pandas’ names are")
    name_match = _required_match(
        re.compile(r"The giant pandas’ names are (?P<bao>Bao Li).* and (?P<qing>Qing Bao)"),
        name_node.text(),
        "current panda names FAQ",
    )

    _, origin_paragraphs = page.faq_item("Where did they come from?")
    bao_node = _one_node_containing(origin_paragraphs, "Bao Li was born")
    qing_node = _one_node_containing(origin_paragraphs, "Qing Bao was born")
    bao = _required_match(
        re.compile(
            r"Bao Li was born (?P<date>Aug\. 4, 2021), at the "
            r"(?P<birthplace>China Conservation and Research Center for the Giant Panda "
            r"\(CCRCGP\) in Sichuan), to father (?P<father>An An) and mother "
            r"(?P<mother>Bao Bao)\."
        ),
        bao_node.text(),
        "Bao Li origin FAQ",
    )
    qing = _required_match(
        re.compile(
            r"Qing Bao was born (?P<date>Sept\. 12, 2021), at (?P<birthplace>CCRCGP), "
            r"to father (?P<father>Qing Qing) and mother (?P<mother>Jia Mei)\."
        ),
        qing_node.text(),
        "Qing Bao origin FAQ",
    )
    _, habitat_paragraphs = page.faq_item("Where at the Zoo do the giant pandas live?")
    habitat_node = _one_node_containing(habitat_paragraphs, "Both giant pandas live at")
    habitat = _required_match(
        re.compile(
            r"Both giant pandas live at the (?P<location>David M\. Rubenstein and Family "
            r"Giant Panda Habitat)"
        ),
        habitat_node.text(),
        "current Smithsonian habitat FAQ",
    ).group("location")

    facts: list[ExtractedFact] = [
        _fact(
            name_match.group("bao"),
            CandidateKind.IDENTITY,
            "identity.names.official.en",
            name_match.group("bao"),
            name_node,
        ),
        _fact(
            name_match.group("qing"),
            CandidateKind.IDENTITY,
            "identity.names.official.en",
            name_match.group("qing"),
            name_node,
        ),
    ]
    center_name = "China Conservation and Research Center for the Giant Panda, Sichuan"
    for node, child, match in (
        (bao_node, "Bao Li", bao),
        (qing_node, "Qing Bao", qing),
    ):
        facts.extend(
            (
                _fact(
                    child, CandidateKind.IDENTITY, "identity.birth_date", match.group("date"), node
                ),
                _fact(
                    child,
                    CandidateKind.IDENTITY,
                    "identity.birthplace",
                    {
                        "name": center_name,
                        "source_text": match.group("birthplace"),
                    },
                    node,
                ),
                _fact(
                    child,
                    CandidateKind.RELATIONSHIP,
                    "relationship.father",
                    match.group("father"),
                    node,
                    notes=("Parent name is source text only; the adapter does not infer a slug.",),
                ),
                _fact(
                    child,
                    CandidateKind.RELATIONSHIP,
                    "relationship.mother",
                    match.group("mother"),
                    node,
                    notes=("Parent name is source text only; the adapter does not infer a slug.",),
                ),
                _fact(
                    child,
                    CandidateKind.RESIDENCY,
                    "residency.current_location",
                    {
                        "facility": habitat,
                        "institution": "Smithsonian National Zoo",
                    },
                    habitat_node,
                ),
            )
        )
        for parent in (match.group("father"), match.group("mother")):
            facts.append(
                _fact(
                    parent,
                    CandidateKind.IDENTITY,
                    "identity.names.official.en",
                    parent,
                    node,
                    notes=("Name is explicitly stated in a parent role.",),
                )
            )
    return tuple(facts)


def _extract_history_facts(page: SemanticPage) -> tuple[ExtractedFact, ...]:
    page.exact_text_node("h2", "Ling-Ling and Hsing-Hsing, the Zoo's first giant pandas")
    page.exact_text_node(
        "h2", "The next chapter: Tian Tian, Mei Xiang, and advances in conservation technology"
    )
    page.exact_text_node("h2", "Welcoming the new panda pair: Bao Li and Qing Bao")

    facts: list[ExtractedFact] = []
    first_pair_node = page.one_paragraph_containing("On April 16, 1972")
    first_pair = _required_match(
        re.compile(
            r"On (?P<date>April 16, 1972), the giant pandas (?P<female>Ling-Ling) "
            r"\(a female\) and (?P<male>Hsing-Hsing) \(a male\) arrived at their new home\."
        ),
        first_pair_node.text(),
        "first Smithsonian panda pair",
    )
    for name, sex in ((first_pair.group("female"), "female"), (first_pair.group("male"), "male")):
        facts.extend(
            (
                _fact(
                    name,
                    CandidateKind.IDENTITY,
                    "identity.names.official.en",
                    name,
                    first_pair_node,
                ),
                _fact(name, CandidateKind.IDENTITY, "identity.sex", sex, first_pair_node),
                _event_fact(
                    name,
                    "arrival",
                    first_pair.group("date"),
                    first_pair_node,
                    source_location_text="their new home",
                ),
            )
        )

    second_pair_node = page.one_paragraph_containing("On Dec. 6, 2000")
    second_pair = _required_match(
        re.compile(
            r"On (?P<date>Dec\. 6, 2000), giant pandas (?P<female>Mei Xiang) "
            r"\(female\) and (?P<male>Tian Tian) \(male\) came to live at the Zoo\."
        ),
        second_pair_node.text(),
        "second Smithsonian panda pair",
    )
    for name, sex in ((second_pair.group("female"), "female"), (second_pair.group("male"), "male")):
        facts.extend(
            (
                _fact(
                    name,
                    CandidateKind.IDENTITY,
                    "identity.names.official.en",
                    name,
                    second_pair_node,
                ),
                _fact(name, CandidateKind.IDENTITY, "identity.sex", sex, second_pair_node),
                _event_fact(
                    name,
                    "arrival",
                    second_pair.group("date"),
                    second_pair_node,
                    source_location_text="the Zoo",
                ),
            )
        )

    departure_node = page.one_paragraph_containing("3-year-old cub Xiao Qi Ji")
    departure = _required_match(
        re.compile(
            r"On (?P<date>Nov\. 8, 2023), (?P<tian>Tian Tian), (?P<mei>Mei Xiang) and "
            r"3-year-old cub (?P<xiao>Xiao Qi Ji) \(male\) departed from the "
            r"Smithsonian's National Zoo and Conservation Biology Institute\."
        ),
        departure_node.text(),
        "2023 panda departure",
    )
    facts.extend(
        (
            _fact(
                departure.group("xiao"),
                CandidateKind.IDENTITY,
                "identity.sex",
                "male",
                departure_node,
            ),
            _absent_fact(
                departure.group("tian"),
                CandidateKind.RESIDENCY,
                "residency.current_location",
                departure_node,
                "The passage states a departure but not a current holder.",
            ),
            _absent_fact(
                departure.group("mei"),
                CandidateKind.RESIDENCY,
                "residency.current_location",
                departure_node,
                "The passage states a departure but not a current holder.",
            ),
            _absent_fact(
                departure.group("xiao"),
                CandidateKind.RESIDENCY,
                "residency.current_location",
                departure_node,
                "The passage states a departure but not a current holder.",
            ),
        )
    )
    for name in (departure.group("tian"), departure.group("mei"), departure.group("xiao")):
        facts.append(
            _event_fact(
                name,
                "transfer",
                departure.group("date"),
                departure_node,
                source_location_text=(
                    "Smithsonian's National Zoo and Conservation Biology Institute"
                ),
                source_action="departed",
            )
        )

    new_pair_node = page.one_paragraph_containing("official public debut")
    new_pair = _required_match(
        re.compile(
            r"two young giant pandas, (?P<qing>Qing Bao) \(female\) and (?P<bao>Bao Li) "
            r"\(male\).* official public debut .* on (?P<date>Jan\. 24, 2025)\."
        ),
        new_pair_node.text(),
        "new Smithsonian panda pair",
    )
    for name, sex in ((new_pair.group("qing"), "female"), (new_pair.group("bao"), "male")):
        facts.extend(
            (
                _fact(
                    name, CandidateKind.IDENTITY, "identity.names.official.en", name, new_pair_node
                ),
                _fact(name, CandidateKind.IDENTITY, "identity.sex", sex, new_pair_node),
                _event_fact(
                    name,
                    "public_debut",
                    new_pair.group("date"),
                    new_pair_node,
                    location="David M. Rubenstein Family Giant Panda Exhibit",
                ),
            )
        )

    ling_death_node = page.one_paragraph_containing("Ling-Ling died Dec. 30")
    ling_year = page.preceding_year(ling_death_node)
    ling_death = _required_match(
        re.compile(r"(?P<name>Ling-Ling) (?P<action>died) (?P<date>Dec\. 30)"),
        ling_death_node.text(),
        "Ling-Ling death",
    )
    facts.extend(_death_facts(ling_death, ling_year, ling_death_node))

    hsing_death_node = page.one_paragraph_containing("Hsing-Hsing, suffering")
    hsing_year = page.preceding_year(hsing_death_node)
    hsing_death = _required_match(
        re.compile(
            r"(?P<name>Hsing-Hsing).* was (?P<action>euthanized) (?P<date>Nov\. 28), "
            r"(?P<year>1999)"
        ),
        hsing_death_node.text(),
        "Hsing-Hsing death",
    )
    if hsing_year != hsing_death.group("year"):
        raise ValueError("Hsing-Hsing death year disagrees with its timeline heading")
    facts.extend(_death_facts(hsing_death, hsing_year, hsing_death_node))

    tai_node = page.one_paragraph_containing("gave birth to Tai Shan")
    tai = _required_match(
        re.compile(
            r"On (?P<date>July 9, 2005), giant panda (?P<mother>Mei Xiang) gave birth "
            r"to (?P<name>Tai Shan).* born at the Smithsonian's National Zoo"
        ),
        tai_node.text(),
        "Tai Shan birth",
    )
    facts.extend(
        (
            _fact(
                tai.group("name"),
                CandidateKind.IDENTITY,
                "identity.names.official.en",
                tai.group("name"),
                tai_node,
            ),
            _fact(
                tai.group("name"),
                CandidateKind.IDENTITY,
                "identity.birthplace",
                "Smithsonian's National Zoo",
                tai_node,
            ),
            _fact(
                tai.group("name"),
                CandidateKind.RELATIONSHIP,
                "relationship.mother",
                tai.group("mother"),
                tai_node,
                notes=("Parent name is source text only; the adapter does not infer a slug.",),
            ),
            _event_fact(
                tai.group("name"),
                "birth",
                tai.group("date"),
                tai_node,
                location="Smithsonian's National Zoo",
            ),
        )
    )

    bao_bao_node = page.one_paragraph_containing("gave birth to Bao Bao")
    bao_bao_year = page.preceding_year(bao_bao_node)
    bao_bao = _required_match(
        re.compile(r"(?P<mother>Mei Xiang) gave birth to (?P<name>Bao Bao) (?P<date>Aug\. 23)"),
        bao_bao_node.text(),
        "Bao Bao birth",
    )
    bao_bao_father_node = page.one_paragraph_containing("Bao Bao was sired by Tian Tian")
    bao_bao_father = _required_match(
        re.compile(r"(?P<name>Bao Bao) was sired by (?P<father>Tian Tian)"),
        bao_bao_father_node.text(),
        "Bao Bao father",
    )
    facts.extend(
        (
            _fact(
                bao_bao.group("name"),
                CandidateKind.IDENTITY,
                "identity.names.official.en",
                bao_bao.group("name"),
                bao_bao_node,
            ),
            _fact(
                bao_bao.group("name"),
                CandidateKind.RELATIONSHIP,
                "relationship.mother",
                bao_bao.group("mother"),
                bao_bao_node,
                notes=("Parent name is source text only; the adapter does not infer a slug.",),
            ),
            _fact(
                bao_bao.group("name"),
                CandidateKind.RELATIONSHIP,
                "relationship.father",
                bao_bao_father.group("father"),
                bao_bao_father_node,
                notes=("Parent name is source text only; the adapter does not infer a slug.",),
            ),
            _event_fact(
                bao_bao.group("name"),
                "birth",
                _date_with_section_year(bao_bao.group("date"), bao_bao_year),
                bao_bao_node,
                source_date_text=bao_bao.group("date"),
                section_year=bao_bao_year,
            ),
        )
    )

    bei_node = page.one_paragraph_containing("Giant panda Bei Bei")
    bei = _required_match(
        re.compile(
            r"Giant panda (?P<name>Bei Bei).* was born (?P<date>Aug\. 22, 2015), at the "
            r"Zoo’s (?P<birthplace>David M\. Rubenstein Family Giant Panda Habitat)"
        ),
        bei_node.text(),
        "Bei Bei birth",
    )
    facts.extend(
        (
            _fact(
                bei.group("name"),
                CandidateKind.IDENTITY,
                "identity.names.official.en",
                bei.group("name"),
                bei_node,
            ),
            _fact(
                bei.group("name"),
                CandidateKind.IDENTITY,
                "identity.birthplace",
                {
                    "facility": bei.group("birthplace"),
                    "institution": "Smithsonian National Zoo",
                },
                bei_node,
            ),
            _event_fact(
                bei.group("name"),
                "birth",
                bei.group("date"),
                bei_node,
                location=bei.group("birthplace"),
            ),
        )
    )

    xiao_node = page.one_paragraph_containing("named Xiao Qi Ji")
    xiao_year = page.preceding_year(xiao_node)
    xiao = _required_match(
        re.compile(
            r"(?P<mother>Mei Xiang).* using frozen semen from (?P<father>Tian Tian).* "
            r"gave birth .* on (?P<birth_date>Aug\. 21).* The cub is (?P<sex>male)\. "
            r"On (?P<naming_date>Nov\. 23).* named (?P<name>Xiao Qi Ji)"
        ),
        xiao_node.text(),
        "Xiao Qi Ji birth and naming",
    )
    facts.extend(
        (
            _fact(
                xiao.group("name"),
                CandidateKind.IDENTITY,
                "identity.names.official.en",
                xiao.group("name"),
                xiao_node,
            ),
            _fact(
                xiao.group("name"),
                CandidateKind.IDENTITY,
                "identity.sex",
                xiao.group("sex"),
                xiao_node,
            ),
            _fact(
                xiao.group("name"),
                CandidateKind.RELATIONSHIP,
                "relationship.mother",
                xiao.group("mother"),
                xiao_node,
                notes=("Parent name is source text only; the adapter does not infer a slug.",),
            ),
            _fact(
                xiao.group("name"),
                CandidateKind.RELATIONSHIP,
                "relationship.father",
                xiao.group("father"),
                xiao_node,
                notes=("Parent name is source text only; the adapter does not infer a slug.",),
            ),
            _event_fact(
                xiao.group("name"),
                "birth",
                _date_with_section_year(xiao.group("birth_date"), xiao_year),
                xiao_node,
                source_date_text=xiao.group("birth_date"),
                section_year=xiao_year,
            ),
            _event_fact(
                xiao.group("name"),
                "naming",
                _date_with_section_year(xiao.group("naming_date"), xiao_year),
                xiao_node,
                source_date_text=xiao.group("naming_date"),
                section_year=xiao_year,
            ),
        )
    )

    transfer_specs = (
        ("Tai Shan", "left for Wolong Nature Reserve", "Feb. 4", "2010"),
        ("Bao Bao", "Bao Bao, departed for China", "Feb. 21", "2017"),
        ("Bei Bei", "Bei Bei, departed for China", "Nov. 19", "2019"),
    )
    for name, phrase, date_text, year in transfer_specs:
        node = page.one_paragraph_containing(phrase)
        if page.preceding_year(node) != year:
            raise ValueError(f"{name} transfer year disagrees with its timeline heading")
        facts.append(
            _event_fact(
                name,
                "transfer",
                _date_with_section_year(date_text, year),
                node,
                source_date_text=date_text,
                section_year=year,
                source_action=phrase,
            )
        )

    arrival_node = page.one_paragraph_containing("arrived at the Smithsonian’s National Zoo")
    arrival = _required_match(
        re.compile(
            r"giant pandas (?P<bao>Bao Li) and (?P<qing>Qing Bao) arrived at the "
            r"Smithsonian’s National Zoo and Conservation Biology Institute.* "
            r"(?P<date>Oct\. 15, 2024)"
        ),
        arrival_node.text(),
        "2024 Bao Li and Qing Bao arrival",
    )
    for name in (arrival.group("bao"), arrival.group("qing")):
        facts.append(
            _event_fact(
                name,
                "arrival",
                arrival.group("date"),
                arrival_node,
                location="Smithsonian’s National Zoo and Conservation Biology Institute",
            )
        )

    return tuple(_deduplicate_facts(facts))


def _death_facts(
    match: re.Match[str],
    year: str,
    node: HtmlNode,
) -> tuple[ExtractedFact, ...]:
    name = match.group("name")
    action = match.group("action")
    date_text = match.group("date")
    return (
        _fact(name, CandidateKind.IDENTITY, "identity.names.official.en", name, node),
        _fact(name, CandidateKind.IDENTITY, "identity.life_status", action, node),
        _event_fact(
            name,
            "death",
            _date_with_section_year(date_text, year),
            node,
            source_date_text=date_text,
            section_year=year,
        ),
    )


def _fact(
    subject_name: str,
    candidate_kind: CandidateKind,
    field_path: str,
    raw_value: JsonValue,
    source_node: HtmlNode,
    *,
    notes: tuple[str, ...] = (),
) -> ExtractedFact:
    return ExtractedFact(
        subject_key=_subject_key(subject_name),
        candidate_kind=candidate_kind,
        field_path=field_path,
        raw_value=raw_value,
        source_node=source_node,
        notes=notes,
    )


def _absent_fact(
    subject_name: str,
    candidate_kind: CandidateKind,
    field_path: str,
    source_node: HtmlNode,
    reason: str,
) -> ExtractedFact:
    return _fact(
        subject_name,
        candidate_kind,
        field_path,
        None,
        source_node,
        notes=(reason, "Absence is recorded explicitly; no value was inferred."),
    )


def _event_fact(
    subject_name: str,
    event_type: str,
    event_date: str,
    source_node: HtmlNode,
    *,
    location: str | None = None,
    source_date_text: str | None = None,
    section_year: str | None = None,
    source_action: str | None = None,
    source_location_text: str | None = None,
) -> ExtractedFact:
    value: dict[str, JsonValue] = {
        "event_type": event_type,
        "event_date": event_date,
    }
    if location:
        value["location"] = location
    if source_date_text:
        value["source_date_text"] = source_date_text
    if section_year:
        value["section_year"] = section_year
    if source_action:
        value["source_action"] = source_action
    if source_location_text:
        value["source_location_text"] = source_location_text
    return _fact(subject_name, CandidateKind.EVENT, "event", value, source_node)


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
                "The adapter preserves a source-local subject and explicit official name; "
                "shared reconciliation owns the curation identity match.",
            ),
        ),
        current_trusted_value=CurrentTrustedValue(present=False),
        parser_name=PARSER_NAME,
        parser_version=PARSER_VERSION,
        conflict_state=ConflictState.NOT_COMPARED,
        notes=(
            "Deterministic factual reference candidate only; no source prose, media, trusted, "
            "or public data was copied or modified.",
            *fact.notes,
        ),
    )


def _assert_unique_pre_reconciliation_candidates(
    candidates: Sequence[FieldCandidate],
) -> None:
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
            raise ValueError("Smithsonian adapter emitted a duplicate pre-reconciliation candidate")
        keys.add(key)


def _deduplicate_facts(facts: Iterable[ExtractedFact]) -> tuple[ExtractedFact, ...]:
    result: list[ExtractedFact] = []
    keys: set[bytes] = set()
    for fact in facts:
        key = canonical_json_bytes(
            {
                "subject_key": fact.subject_key,
                "candidate_kind": fact.candidate_kind.value,
                "field_path": fact.field_path,
                "raw_value": fact.raw_value,
            }
        )
        if key in keys:
            continue
        keys.add(key)
        result.append(fact)
    return tuple(result)


def _required_match(pattern: re.Pattern[str], text: str, label: str) -> re.Match[str]:
    match = pattern.search(text)
    if match is None:
        raise ValueError(f"Smithsonian parser drifted while reading {label}")
    return match


def _one_node_containing(nodes: Sequence[HtmlNode], phrase: str) -> HtmlNode:
    matches = [node for node in nodes if phrase in node.text()]
    if len(matches) != 1:
        raise ValueError(
            f"Smithsonian FAQ expected exactly one answer paragraph containing {phrase!r}; "
            f"found {len(matches)}"
        )
    return matches[0]


def _is_descendant_of(node: HtmlNode, ancestor: HtmlNode) -> bool:
    current = node.parent
    while current is not None:
        if current is ancestor:
            return True
        current = current.parent
    return False


def _css_selector(node: HtmlNode) -> str:
    segments: list[str] = []
    current: HtmlNode | None = node
    while current is not None and current.tag != "document":
        segment = current.tag
        node_id = current.attrs.get("id")
        if node_id:
            segments.append(f"{segment}#{_css_escape(node_id)}")
            break
        classes = [
            value
            for value in current.attrs.get("class", "").split()
            if value in {"faq", "accordion-item", "accordion-body", "body", "text-block"}
        ]
        if classes:
            segment += "".join(f".{_css_escape(value)}" for value in classes)
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


def _subject_key(name: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", name.casefold()).strip("-")
    if not slug:
        raise ValueError("Smithsonian subject name did not produce a source key")
    return f"smithsonian:{slug}"


def _date_with_section_year(date_text: str, year: str) -> str:
    month_day = date_text.rstrip(".,")
    return f"{month_day}, {year}"


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
    "DEFAULT_COHORT",
    "FAQ_REQUEST_ID",
    "HISTORY_REQUEST_ID",
    "PARSER_NAME",
    "PARSER_VERSION",
    "PROFILE_REQUEST_ID",
    "SOURCE_ID",
    "SmithsonianPandaProfilesAdapter",
]

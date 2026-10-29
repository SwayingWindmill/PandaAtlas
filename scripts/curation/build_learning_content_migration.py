"""Turn data/curation/learning/learning.json into a forward-only content migration.

Migrations are the one path to production data, and an applied migration never changes. So the
latest ``*_learning_content.sql`` migration must match the data file: ``--check`` fails when it
does not, and ``--write`` adds the next numbered migration with the current content. The migration
is idempotent: it ensures the catalog table and upserts the one document. Draft entries stay in
that document. ``GET /api/v2/learning`` returns published entries only.
"""

from __future__ import annotations

import argparse
import csv
import json
import re
import sys
from datetime import date
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[2]
DATA_PATH = ROOT / "data" / "curation" / "learning" / "learning.json"
PANDA_CSV = ROOT / "data" / "curation" / "pandas" / "pandas.csv"
MEDIA_CSV = ROOT / "data" / "curation" / "pandas" / "media.csv"
MIGRATIONS_DIR = ROOT / "infra" / "supabase" / "migrations"
MIGRATION_SUFFIX = "_learning_content.sql"

SLUG = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
VERSION = re.compile(r"^\d{4}\.\d{2}\.\d{2}\.\d+$")
ISO_DAY = re.compile(r"^\d{4}-\d{2}-\d{2}$")
STATUSES = {"draft", "published"}
FACE_TIP_KEYS = ("shape", "leftRight", "eyePatches", "ears")
COLLECTIONS = ("articles", "cards", "topics", "terms", "faceGuides", "challenges")
CATEGORIES = {
    "外形与识别": "Shape and recognition",
    "食性": "Diet",
    "繁殖与成长": "Growth",
    "保护": "Conservation",
}
BLOCK_TYPES = {"heading", "paragraph", "pullQuote", "figure", "factBox", "termRef"}

# (zh max, en max). The writer brief copies these numbers.
LIMITS = {
    "title": (24, 48),
    "summary": (80, 160),
    "topic.summary": (120, 240),
    "body": (400, 800),
    "heading": (24, 48),
    "term": (16, 40),
    "definition": (200, 400),
    "label": (16, 40),
    "tip": (200, 400),
    "prompt": (40, 80),
    "source": (160, 320),
    "article.title": (40, 80),
    "dek": (160, 320),
    "article.heading": (40, 80),
    "paragraph": (2000, 4000),
    "pullQuote": (240, 480),
    "caption": (160, 320),
    "credit": (80, 160),
    "alt": (160, 320),
    "factTitle": (24, 48),
    "fact": (120, 240),
    "termRef": (80, 160),
    "reference.title": (160, 320),
    "publisher": (80, 160),
    "shot": (400, 800),
}


def approved_assets() -> dict[str, set[str]]:
    assets: dict[str, set[str]] = {}
    with MEDIA_CSV.open(encoding="utf-8-sig", newline="") as handle:
        for row in csv.DictReader(handle):
            if row.get("review_status") != "approved":
                continue
            assets.setdefault(row["panda_slug"], set()).add(row["asset"])
    return assets


def panda_slugs() -> set[str]:
    slugs: set[str] = set()
    for index, line in enumerate(PANDA_CSV.read_text(encoding="utf-8").splitlines()):
        if index == 0 or not line.strip():
            continue
        slugs.add(line.split(",", 1)[0])
    return slugs


def validate_text(
    value: object,
    label: str,
    limit_key: str,
    status: str,
    errors: list[str],
    *,
    allow_empty: bool = False,
) -> None:
    zh_max, en_max = LIMITS[limit_key]
    if not isinstance(value, dict) or set(value) != {"zh", "en"}:
        errors.append(f"{label}: must be an object with zh and en")
        return
    for language, limit in (("zh", zh_max), ("en", en_max)):
        text = value.get(language)
        field = f"{label}.{language}"
        if not isinstance(text, str) or len(text) > limit:
            errors.append(f"{field}: must be at most {limit} characters")
            continue
        if not text.strip():
            # Draft articles and terms may be Chinese-only until a translation exists.
            if language == "en" and status == "draft":
                continue
            if not allow_empty:
                errors.append(f"{field}: must be 1 to {limit} characters")
            continue
        # Drafts may be unmarked while the owner reviews them. Published copy must not look like a draft.
        if status == "published" and ("[草稿]" in text or "[draft]" in text):
            errors.append(f"{field}: published text must not include a draft mark")


def validate_sources(sources: object, label: str, status: str, errors: list[str]) -> None:
    if not isinstance(sources, list) or not sources:
        errors.append(f"{label}: needs at least one source")
        return
    for index, source in enumerate(sources):
        field = f"{label}[{index}]"
        if not isinstance(source, dict) or set(source) != {"title", "url", "citedOn"}:
            errors.append(f"{field}: must have title, url and citedOn")
            continue
        validate_text(source.get("title"), f"{field}.title", "source", status, errors)
        url = source.get("url")
        cited_on = source.get("citedOn")
        if url is None and cited_on is None:
            if status == "published":
                errors.append(f"{field}.url: published sources need an absolute https URL")
            continue
        if url is None or cited_on is None:
            errors.append(f"{field}: url and citedOn go together")
            continue
        parsed = urlparse(url) if isinstance(url, str) else None
        if parsed is None or parsed.scheme != "https" or not parsed.netloc:
            errors.append(f"{field}.url: must be an absolute https URL")
        try:
            if not isinstance(cited_on, str) or not ISO_DAY.match(cited_on):
                raise ValueError
            date.fromisoformat(cited_on)
        except ValueError:
            errors.append(f"{field}.citedOn: must be a YYYY-MM-DD day")


def require_slug(value: object, label: str, seen: set[str], errors: list[str]) -> str:
    if not isinstance(value, str) or not SLUG.match(value):
        errors.append(f"{label}: must be a lowercase slug")
        return ""
    if value in seen:
        errors.append(f"{label}: duplicate slug {value}")
    seen.add(value)
    return value


def require_status(entry: dict, label: str, errors: list[str]) -> str:
    status = entry.get("status")
    if status not in STATUSES:
        errors.append(f"{label}.status: must be draft or published")
        return "draft"
    return str(status)


def validate_known_slugs(values: object, label: str, known: set[str], errors: list[str], *, allow_self: str | None = None) -> None:
    if not isinstance(values, list) or any(not isinstance(item, str) for item in values):
        errors.append(f"{label}: must be a list of slugs")
        return
    for item in values:
        if item == allow_self:
            errors.append(f"{label}: {item} cannot point at itself")
        elif item not in known:
            errors.append(f"{label}: unknown slug {item}")


def validate_content(content: object, known_pandas: set[str] | None = None) -> list[str]:
    errors: list[str] = []
    pandas = panda_slugs() if known_pandas is None else known_pandas
    if not isinstance(content, dict):
        return ["learning: must be an object"]
    unknown = set(content) - {"$comment", "version", *COLLECTIONS}
    if unknown:
        errors.append(f"learning: unknown fields {sorted(unknown)}")
    version = content.get("version")
    if not isinstance(version, str) or not VERSION.match(version):
        errors.append("version: must look like 2026.10.29.1")
    comment = content.get("$comment")
    if comment is not None and not isinstance(comment, str):
        errors.append("$comment: must be a string")

    cards: dict = {}
    for index, card in enumerate(content.get("cards") or []):
        label = f"cards[{index}]"
        if not isinstance(card, dict) or set(card) != {"slug", "status", "title", "summary", "body", "sources"}:
            errors.append(f"{label}: unexpected fields")
            continue
        slug = require_slug(card.get("slug"), f"{label}.slug", set(cards), errors)
        status = require_status(card, label, errors)
        cards[slug] = card
        validate_text(card.get("title"), f"{label}.title", "title", status, errors)
        validate_text(card.get("summary"), f"{label}.summary", "summary", status, errors)
        validate_text(card.get("body"), f"{label}.body", "body", status, errors)
        validate_sources(card.get("sources"), f"{label}.sources", status, errors)
    if not isinstance(content.get("cards"), list):
        errors.append("cards: must be a list")

    topics: set[str] = set()
    topic_rows = content.get("topics")
    if not isinstance(topic_rows, list):
        errors.append("topics: must be a list")
        topic_rows = []
    for index, topic in enumerate(topic_rows):
        label = f"topics[{index}]"
        fields = {"slug", "status", "title", "summary", "sections", "cardSlugs", "sources"}
        if not isinstance(topic, dict) or set(topic) != fields:
            errors.append(f"{label}: unexpected fields")
            continue
        slug = require_slug(topic.get("slug"), f"{label}.slug", topics, errors)
        status = require_status(topic, label, errors)
        validate_text(topic.get("title"), f"{label}.title", "title", status, errors)
        validate_text(topic.get("summary"), f"{label}.summary", "topic.summary", status, errors)
        sections = topic.get("sections")
        if not isinstance(sections, list) or not sections:
            errors.append(f"{label}.sections: needs at least one section")
        else:
            for section_index, section in enumerate(sections):
                section_label = f"{label}.sections[{section_index}]"
                if not isinstance(section, dict) or set(section) != {"heading", "body"}:
                    errors.append(f"{section_label}: must have heading and body")
                    continue
                validate_text(section.get("heading"), f"{section_label}.heading", "heading", status, errors)
                validate_text(section.get("body"), f"{section_label}.body", "body", status, errors)
        validate_known_slugs(topic.get("cardSlugs"), f"{label}.cardSlugs", set(cards), errors)
        validate_sources(topic.get("sources"), f"{label}.sources", status, errors)
        _ = slug

    terms: set[str] = set()
    term_rows = content.get("terms")
    if not isinstance(term_rows, list):
        errors.append("terms: must be a list")
        term_rows = []
    parsed_terms: list[dict] = []
    for index, term in enumerate(term_rows):
        label = f"terms[{index}]"
        if not isinstance(term, dict) or set(term) != {"slug", "status", "term", "definition", "relatedSlugs", "sources"}:
            errors.append(f"{label}: unexpected fields")
            continue
        slug = require_slug(term.get("slug"), f"{label}.slug", terms, errors)
        status = require_status(term, label, errors)
        validate_text(term.get("term"), f"{label}.term", "term", status, errors)
        validate_text(term.get("definition"), f"{label}.definition", "definition", status, errors)
        validate_sources(term.get("sources"), f"{label}.sources", status, errors)
        parsed_terms.append(term)
        _ = slug
    for term in parsed_terms:
        validate_known_slugs(term.get("relatedSlugs"), f"term {term.get('slug')}.relatedSlugs", terms, errors, allow_self=term.get("slug"))

    guide_rows = content.get("faceGuides")
    if not isinstance(guide_rows, list):
        errors.append("faceGuides: must be a list")
        guide_rows = []
    guides: set[str] = set()
    for index, guide in enumerate(guide_rows):
        label = f"faceGuides[{index}]"
        fields = {"slug", "status", "pandaSlug", "title", "tips", "sources"}
        if not isinstance(guide, dict) or set(guide) != fields:
            errors.append(f"{label}: unexpected fields")
            continue
        require_slug(guide.get("slug"), f"{label}.slug", guides, errors)
        status = require_status(guide, label, errors)
        panda_slug = guide.get("pandaSlug")
        if panda_slug not in pandas:
            errors.append(f"{label}.pandaSlug: {panda_slug} is not a panda in data/curation/pandas/pandas.csv")
        validate_text(guide.get("title"), f"{label}.title", "title", status, errors)
        tips = guide.get("tips")
        keys = [tip.get("key") for tip in tips] if isinstance(tips, list) else []
        if keys != list(FACE_TIP_KEYS):
            errors.append(f"{label}.tips: must be {list(FACE_TIP_KEYS)} in that order")
        if isinstance(tips, list):
            for tip_index, tip in enumerate(tips):
                tip_label = f"{label}.tips[{tip_index}]"
                if not isinstance(tip, dict) or set(tip) != {"key", "label", "body"}:
                    errors.append(f"{tip_label}: must have key, label and body")
                    continue
                validate_text(tip.get("label"), f"{tip_label}.label", "label", status, errors)
                validate_text(tip.get("body"), f"{tip_label}.body", "tip", status, errors, allow_empty=True)
        validate_sources(guide.get("sources"), f"{label}.sources", status, errors)

    challenge_rows = content.get("challenges")
    if not isinstance(challenge_rows, list):
        errors.append("challenges: must be a list")
        challenge_rows = []
    challenges: set[str] = set()
    for index, challenge in enumerate(challenge_rows):
        label = f"challenges[{index}]"
        fields = {"slug", "status", "answerPandaSlug", "decoyPandaSlugs", "prompt", "tip", "sources"}
        if not isinstance(challenge, dict) or set(challenge) != fields:
            errors.append(f"{label}: unexpected fields")
            continue
        require_slug(challenge.get("slug"), f"{label}.slug", challenges, errors)
        status = require_status(challenge, label, errors)
        answer = challenge.get("answerPandaSlug")
        if answer not in pandas:
            errors.append(f"{label}.answerPandaSlug: {answer} is not a panda in data/curation/pandas/pandas.csv")
        decoys = challenge.get("decoyPandaSlugs")
        if not isinstance(decoys, list) or len(decoys) != 3 or len(set(decoys)) != 3:
            errors.append(f"{label}.decoyPandaSlugs: must be three different pandas")
        elif answer in decoys:
            errors.append(f"{label}.decoyPandaSlugs: the answer cannot also be a decoy")
        else:
            for decoy in decoys:
                if decoy not in pandas:
                    errors.append(f"{label}.decoyPandaSlugs: {decoy} is not a panda in data/curation/pandas/pandas.csv")
        validate_text(challenge.get("prompt"), f"{label}.prompt", "prompt", status, errors)
        validate_text(challenge.get("tip"), f"{label}.tip", "tip", status, errors)
        validate_sources(challenge.get("sources"), f"{label}.sources", status, errors)

    validate_articles(content.get("articles"), terms, pandas, errors)
    return errors


MARKUP = re.compile(r"\[\[([a-z0-9]+(?:-[a-z0-9]+)*)\|([^\]]+)\]\]")
ARTICLE_FIELDS = {
    "slug",
    "status",
    "category",
    "title",
    "dek",
    "pullQuote",
    "body",
    "keyFacts",
    "images",
    "references",
    "relatedArticles",
    "stats",
    "glossaryTerms",
}


def validate_zh_text(value: object, label: str, limit_key: str, status: str, errors: list[str], *, extra: set[str] | None = None) -> str:
    limit = LIMITS[limit_key][0]
    allowed = {"zh", "en"} | (extra or set())
    if not isinstance(value, dict) or set(value) - allowed or "zh" not in value:
        errors.append(f"{label}: must include zh")
        return ""
    zh = value.get("zh")
    if not isinstance(zh, str) or not zh.strip() or len(zh) > limit:
        errors.append(f"{label}.zh: must be 1 to {limit} characters")
        return ""
    en = value.get("en")
    if en is not None and not isinstance(en, str):
        errors.append(f"{label}.en: must be a string")
    if status == "published" and ("[草稿]" in zh or "[draft]" in zh):
        errors.append(f"{label}.zh: published text must not include a draft mark")
    return zh


def markup_slugs(value: str, label: str, terms: set[str], errors: list[str]) -> None:
    for match in MARKUP.finditer(value):
        slug_value, shown = match.group(1), match.group(2)
        if not shown.strip():
            errors.append(f"{label}: empty glossary label")
        elif slug_value not in terms:
            errors.append(f"{label}: unknown term {slug_value}")


def validate_articles(rows: object, terms: set[str], pandas: set[str], errors: list[str]) -> None:
    if not isinstance(rows, list):
        errors.append("articles: must be a list")
        return
    assets = approved_assets()
    slugs: set[str] = set()
    parsed: list[dict] = []
    for index, article in enumerate(rows):
        label = f"articles[{index}]"
        if not isinstance(article, dict):
            errors.append(f"{label}: must be an object")
            continue
        source_keys = {"sourceCardSlug", "sourceTopicSlug"} & set(article)
        if len(source_keys) != 1 or set(article) - ARTICLE_FIELDS - source_keys:
            errors.append(f"{label}: unexpected fields")
            continue
        slug_value = require_slug(article.get("slug"), f"{label}.slug", slugs, errors)
        status = require_status(article, label, errors)
        category = article.get("category")
        if category not in CATEGORIES:
            errors.append(f"{label}.category: must be one of {list(CATEGORIES)}")
        title = validate_zh_text(article.get("title"), f"{label}.title", "article.title", status, errors)
        dek = validate_zh_text(article.get("dek"), f"{label}.dek", "dek", status, errors)
        quote = validate_zh_text(article.get("pullQuote"), f"{label}.pullQuote", "pullQuote", status, errors, extra={"drawnFromBody"})
        drawn = article.get("pullQuote", {}).get("drawnFromBody") if isinstance(article.get("pullQuote"), dict) else None
        if drawn is not None and not isinstance(drawn, bool):
            errors.append(f"{label}.pullQuote.drawnFromBody: must be a boolean")
        markup_slugs(title + dek + quote, label, terms, errors)
        reference_ids = validate_article_references(article.get("references"), f"{label}.references", status, errors)
        validate_article_body(article.get("body"), label, status, terms, reference_ids, errors)
        validate_key_facts(article.get("keyFacts"), label, status, terms, reference_ids, errors)
        validate_article_images(article.get("images"), label, status, pandas, assets, reference_ids, errors)
        validate_stats(article.get("stats"), f"{label}.stats", errors)
        validate_glossary_terms(article.get("glossaryTerms"), f"{label}.glossaryTerms", terms, errors)
        pointer = article.get(next(iter(source_keys)))
        if not isinstance(pointer, str) or not SLUG.match(pointer):
            errors.append(f"{label}.{next(iter(source_keys))}: must be a slug")
        parsed.append(article)
        _ = slug_value
    known = {article.get("slug") for article in parsed}
    for article in parsed:
        related = article.get("relatedArticles")
        label = f"article {article.get('slug')}.relatedArticles"
        if not isinstance(related, list) or any(not isinstance(item, str) for item in related):
            errors.append(f"{label}: must be a list of slugs")
            continue
        for item in related:
            if item == article.get("slug"):
                errors.append(f"{label}: {item} cannot point at itself")
            elif item not in known:
                errors.append(f"{label}: unknown article {item}")


def validate_article_body(body: object, label: str, status: str, terms: set[str], reference_ids: set[str], errors: list[str]) -> None:
    if not isinstance(body, dict) or set(body) != {"sections"}:
        errors.append(f"{label}.body: must have sections")
        return
    sections = body.get("sections")
    if not isinstance(sections, list) or not sections:
        errors.append(f"{label}.body.sections: needs at least one section")
        return
    for index, section in enumerate(sections):
        section_label = f"{label}.body.sections[{index}]"
        if not isinstance(section, dict) or set(section) != {"heading", "paragraphs"}:
            errors.append(f"{section_label}: must have heading and paragraphs")
            continue
        heading = validate_zh_text(section.get("heading"), f"{section_label}.heading", "article.heading", status, errors)
        markup_slugs(heading, section_label, terms, errors)
        paragraphs = section.get("paragraphs")
        if not isinstance(paragraphs, list) or not paragraphs:
            errors.append(f"{section_label}.paragraphs: needs at least one paragraph")
            continue
        for paragraph_index, paragraph in enumerate(paragraphs):
            paragraph_label = f"{section_label}.paragraphs[{paragraph_index}]"
            if not isinstance(paragraph, dict) or set(paragraph) != {"text", "refs"}:
                errors.append(f"{paragraph_label}: must have text and refs")
                continue
            text = validate_zh_text(paragraph.get("text"), f"{paragraph_label}.text", "paragraph", status, errors)
            markup_slugs(text, paragraph_label, terms, errors)
            validate_ref_ids(paragraph.get("refs"), f"{paragraph_label}.refs", reference_ids, errors)


def validate_key_facts(facts: object, label: str, status: str, terms: set[str], reference_ids: set[str], errors: list[str]) -> None:
    field = f"{label}.keyFacts"
    if not isinstance(facts, list) or not 1 <= len(facts) <= 8:
        errors.append(f"{field}: needs 1 to 8 facts")
        return
    for index, fact in enumerate(facts):
        fact_label = f"{field}[{index}]"
        if not isinstance(fact, dict) or set(fact) != {"text", "refs"}:
            errors.append(f"{fact_label}: must have text and refs")
            continue
        text = validate_zh_text(fact.get("text"), f"{fact_label}.text", "fact", status, errors)
        markup_slugs(text, fact_label, terms, errors)
        validate_ref_ids(fact.get("refs"), f"{fact_label}.refs", reference_ids, errors)


def validate_ref_ids(refs: object, label: str, known: set[str], errors: list[str]) -> None:
    if not isinstance(refs, list) or any(not isinstance(item, str) for item in refs):
        errors.append(f"{label}: must be a list of reference ids")
        return
    for item in refs:
        if item not in known:
            errors.append(f"{label}: unknown reference {item}")


def validate_article_references(references: object, label: str, status: str, errors: list[str]) -> set[str]:
    ids: set[str] = set()
    if not isinstance(references, list) or not references:
        errors.append(f"{label}: needs at least one reference")
        return ids
    for index, reference in enumerate(references):
        field = f"{label}[{index}]"
        if not isinstance(reference, dict) or set(reference) != {"id", "title", "publisher", "url", "citedOn"}:
            errors.append(f"{field}: must have id, title, publisher, url and citedOn")
            continue
        require_slug(reference.get("id"), f"{field}.id", ids, errors)
        for key, limit_key in (("title", "reference.title"), ("publisher", "publisher")):
            value = reference.get(key)
            limit = LIMITS[limit_key][0]
            if not isinstance(value, str) or not value.strip() or len(value) > limit:
                errors.append(f"{field}.{key}: must be 1 to {limit} characters")
            elif status == "published" and ("[草稿]" in value or "[draft]" in value):
                errors.append(f"{field}.{key}: published text must not include a draft mark")
        url = reference.get("url")
        cited_on = reference.get("citedOn")
        parsed = urlparse(url) if isinstance(url, str) else None
        if parsed is None or parsed.scheme != "https" or not parsed.netloc:
            errors.append(f"{field}.url: must be an absolute https URL")
        try:
            if not isinstance(cited_on, str) or not ISO_DAY.match(cited_on):
                raise ValueError
            date.fromisoformat(cited_on)
        except ValueError:
            errors.append(f"{field}.citedOn: must be a YYYY-MM-DD day")
    return ids


def validate_article_images(
    images: object,
    label: str,
    status: str,
    pandas: set[str],
    assets: dict[str, set[str]],
    reference_ids: set[str],
    errors: list[str],
) -> None:
    field = f"{label}.images"
    if not isinstance(images, list) or not images:
        errors.append(f"{field}: needs a hero image")
        return
    heroes = 0
    for index, image in enumerate(images):
        image_label = f"{field}[{index}]"
        if not isinstance(image, dict):
            errors.append(f"{image_label}: must be an object")
            continue
        role = image.get("role")
        kind = image.get("type")
        if role not in {"hero", "inline", "compare"} or kind not in {"existing", "wanted"}:
            errors.append(f"{image_label}: unknown role or type")
            continue
        if role == "hero":
            heroes += 1
        validate_zh_text(image.get("caption"), f"{image_label}.caption", "caption", status, errors)
        validate_ref_ids(image.get("captionRefs"), f"{image_label}.captionRefs", reference_ids, errors)
        if kind == "existing":
            fields = {"role", "type", "pandaSlug", "asset", "sourcePage", "credit", "rights", "caption", "captionRefs"}
            if set(image) != fields:
                errors.append(f"{image_label}: unexpected fields")
                continue
            panda_slug = image.get("pandaSlug")
            asset = image.get("asset")
            if panda_slug not in pandas:
                errors.append(f"{image_label}.pandaSlug: {panda_slug} is not a panda")
            elif not isinstance(asset, str) or asset not in assets.get(str(panda_slug), set()):
                errors.append(f"{image_label}.asset: must be an approved photo of {panda_slug}")
            for key in ("sourcePage", "credit", "rights"):
                value = image.get(key)
                if not isinstance(value, str) or not value.strip() or len(value) > 200:
                    errors.append(f"{image_label}.{key}: must be 1 to 200 characters")
        else:
            fields = {"role", "type", "pandaSlug", "shot", "caption", "captionRefs"}
            if set(image) != fields:
                errors.append(f"{image_label}: unexpected fields")
                continue
            if image.get("asset"):
                errors.append(f"{image_label}: a wanted figure must not include a photo")
            panda_slug = image.get("pandaSlug")
            if panda_slug is not None and panda_slug not in pandas:
                errors.append(f"{image_label}.pandaSlug: {panda_slug} is not a panda")
            validate_zh_text(image.get("shot"), f"{image_label}.shot", "shot", status, errors)
    if heroes != 1:
        errors.append(f"{field}: needs exactly one hero")


def validate_stats(stats: object, label: str, errors: list[str]) -> None:
    if not isinstance(stats, dict) or set(stats) != {"bodyChars", "bodyCjkChars", "sectionCount", "referenceCount"}:
        errors.append(f"{label}: unexpected fields")
        return
    for key in ("bodyChars", "bodyCjkChars", "sectionCount", "referenceCount"):
        value = stats.get(key)
        if not isinstance(value, int) or isinstance(value, bool) or value < 0:
            errors.append(f"{label}.{key}: must be a non-negative integer")


def validate_glossary_terms(terms: object, label: str, known: set[str], errors: list[str]) -> None:
    if not isinstance(terms, list):
        errors.append(f"{label}: must be a list")
        return
    for index, term in enumerate(terms):
        field = f"{label}[{index}]"
        if not isinstance(term, dict) or set(term) != {"slug", "label", "inLearningJson"}:
            errors.append(f"{field}: unexpected fields")
            continue
        if not isinstance(term.get("slug"), str) or term.get("slug") not in known:
            errors.append(f"{field}.slug: unknown term {term.get('slug')}")
        if not isinstance(term.get("label"), str) or not term.get("label"):
            errors.append(f"{field}.label: must be a string")
        if not isinstance(term.get("inLearningJson"), bool):
            errors.append(f"{field}.inLearningJson: must be a boolean")


def sql_text(value: str) -> str:
    return "'" + value.replace("'", "''") + "'"


def sql_json(value: object) -> str:
    return sql_text(json.dumps(value, ensure_ascii=False, separators=(",", ":"))) + "::jsonb"


def stored_document(content: dict) -> dict:
    return {key: content[key] for key in ("version", *COLLECTIONS)}


def render_migration(content: dict) -> str:
    document = stored_document(content)
    lines = [
        "-- Generated by scripts/curation/build_learning_content_migration.py from",
        "-- data/curation/learning/learning.json. Do not edit: change the data file and run the script.",
        "-- Upserts the one learning catalog. Draft entries stay in the document;",
        "-- GET /api/v2/learning returns published entries only.",
        "",
        "begin;",
        "",
        "create schema if not exists learning;",
        "",
        "create table if not exists learning.catalog (",
        "  catalog_id smallint primary key default 1,",
        "  version text not null,",
        "  document jsonb not null,",
        "  updated_at timestamptz not null default now(),",
        "  constraint learning_catalog_singleton check (catalog_id = 1),",
        "  constraint learning_catalog_document_object check (jsonb_typeof(document) = 'object')",
        ");",
        "",
        "comment on table learning.catalog is",
        "  'Versioned 科普 copy. The document holds draft and published entries; the public API returns published entries only.';",
        "",
        "grant usage on schema learning to zhipanda_app;",
        "grant select on learning.catalog to zhipanda_app;",
        "",
        "insert into learning.catalog (catalog_id, version, document)",
        f"values (1, {sql_text(content['version'])}, {sql_json(document)})",
        "on conflict (catalog_id) do update set",
        "  version = excluded.version,",
        "  document = excluded.document,",
        "  updated_at = now();",
        "",
        "commit;",
    ]
    return "\n".join(lines) + "\n"


def migration_paths() -> list[Path]:
    return sorted(MIGRATIONS_DIR.glob("[0-9][0-9][0-9][0-9]_*.sql"))


def latest_content_migration() -> Path | None:
    matches = [path for path in migration_paths() if path.name.endswith(MIGRATION_SUFFIX)]
    return matches[-1] if matches else None


def next_migration_path() -> Path:
    paths = migration_paths()
    number = int(paths[-1].name[:4]) + 1 if paths else 1
    return MIGRATIONS_DIR / f"{number:04d}{MIGRATION_SUFFIX}"


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument("--check", action="store_true", help="fail when the latest content migration is stale")
    mode.add_argument("--write", action="store_true", help="add a new content migration when the data changed")
    args = parser.parse_args(argv)

    content = json.loads(DATA_PATH.read_text(encoding="utf-8"))
    errors = validate_content(content)
    if errors:
        for error in errors:
            print(f"error: {error}", file=sys.stderr)
        return 1

    rendered = render_migration(content)
    latest = latest_content_migration()
    if latest is not None and latest.read_text(encoding="utf-8") == rendered:
        print(f"Learning content is current in {latest.relative_to(ROOT).as_posix()}.")
        return 0
    if args.check:
        print(
            "error: learning content changed since the latest content migration; "
            "run python scripts/curation/build_learning_content_migration.py --write",
            file=sys.stderr,
        )
        return 1
    target = next_migration_path()
    target.write_text(rendered, encoding="utf-8", newline="\n")
    print(f"Wrote {target.relative_to(ROOT).as_posix()}.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

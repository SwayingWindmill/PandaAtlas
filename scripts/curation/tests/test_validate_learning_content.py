from __future__ import annotations

import copy
import importlib.util
import json
import unittest
from pathlib import Path

MODULE_PATH = Path(__file__).resolve().parents[1] / "validate_learning_content.py"
SPEC = importlib.util.spec_from_file_location("validate_learning_content", MODULE_PATH)
assert SPEC and SPEC.loader
BUILDER = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(BUILDER)

PANDAS = {"bao-li", "lun-lun", "lei-lei", "yang-yang", "ya-lun"}
PUBLISHED = {"bao-li", "lun-lun", "lei-lei", "yang-yang-atlanta", "xi-lun"}


def source(status: str = "draft") -> dict:
    if status == "draft":
        return {"title": {"zh": "[草稿] 来源待写", "en": "[draft] Source to be cited"}, "url": None, "citedOn": None}
    return {
        "title": {"zh": "基地官网", "en": "The base's website"},
        "url": "https://www.panda.org.cn/",
        "citedOn": "2026-10-29",
    }


def text(status: str, zh: str, en: str) -> dict:
    if status == "draft":
        return {"zh": f"[草稿] {zh}", "en": f"[draft] {en}"}
    return {"zh": zh, "en": en}


def card(status: str = "draft") -> dict:
    return {
        "slug": "black-eye-patches",
        "status": status,
        "title": text(status, "黑眼圈", "Eye patches"),
        "summary": text(status, "摘要", "Summary"),
        "body": text(status, "正文", "Body"),
        "sources": [source(status)],
    }


def document(status: str = "draft") -> dict:
    sample = card(status)
    return {
        "version": "2026.10.29.1",
        "articles": [],
        "cards": [sample],
        "topics": [
            {
                "slug": "telling-faces-apart",
                "status": status,
                "title": text(status, "怎么认脸", "Faces"),
                "summary": text(status, "摘要", "Summary"),
                "sections": [{"heading": text(status, "形状", "Shape"), "body": text(status, "正文", "Body")}],
                "cardSlugs": ["black-eye-patches"],
                "sources": [source(status)],
            }
        ],
        "terms": [
            {
                "slug": "eye-patch",
                "status": status,
                "term": text(status, "黑眼圈", "Eye patches"),
                "definition": text(status, "释义", "Definition"),
                "relatedSlugs": [],
                "sources": [source(status)],
            }
        ],
        "faceGuides": [
            {
                "slug": "bao-li",
                "status": status,
                "pandaSlug": "bao-li",
                "title": text(status, "宝力", "Bao Li"),
                "tips": [
                    {"key": key, "label": text(status, "提示", "Tip"), "body": text(status, "正文", "Body")}
                    for key in ("shape", "leftRight", "eyePatches", "ears")
                ],
                "sources": [source(status)],
            }
        ],
        "challenges": [
            {
                "slug": "bao-li-round",
                "status": status,
                "answerPandaSlug": "bao-li",
                "decoyPandaSlugs": ["lun-lun", "lei-lei", "yang-yang-atlanta"],
                "prompt": text(status, "选出这只", "Which one"),
                "tip": text(status, "提示", "Tip"),
                "sources": [source(status)],
            }
        ],
    }


class ValidateLearningContentTests(unittest.TestCase):
    def test_valid_draft_and_published_documents(self) -> None:
        self.assertEqual(BUILDER.validate_content(document(), PANDAS, PUBLISHED), [])
        self.assertEqual(BUILDER.validate_content(document("published"), PANDAS, PUBLISHED), [])

    def test_the_repository_file_is_valid(self) -> None:
        content = json.loads(BUILDER.DATA_PATH.read_text(encoding="utf-8"))
        self.assertEqual(BUILDER.validate_content(content), [])

    def assert_error(self, mutate, fragment: str, status: str = "draft") -> None:
        content = copy.deepcopy(document(status))
        mutate(content)
        errors = BUILDER.validate_content(content, PANDAS, PUBLISHED)
        self.assertTrue(any(fragment in error for error in errors), errors)

    def test_month_themes_are_optional_and_checked(self) -> None:
        theme = {"month": "2026-11", "status": "published", "title": {"zh": "认脸月"}, "intro": None, "tasks": ["learn", "daily"]}
        content = {**document(), "monthThemes": [theme]}
        self.assertEqual(BUILDER.validate_content(content, PANDAS, PUBLISHED), [])
        self.assert_error(lambda c: c.update(monthThemes=[{**theme, "month": "2026-13"}]), "month: must be YYYY-MM")
        self.assert_error(lambda c: c.update(monthThemes=[theme, theme]), "listed twice")
        self.assert_error(lambda c: c.update(monthThemes=[{**theme, "tasks": ["fly"]}]), "each task must be one of")
        self.assert_error(lambda c: c.update(monthThemes=[{**theme, "tasks": []}]), "needs different tasks")

    def test_unmarked_drafts_are_allowed_and_published_text_must_not_look_like_a_draft(self) -> None:
        content = document()
        content["cards"][0]["title"] = {"zh": "黑眼圈", "en": "Eye patches"}
        self.assertEqual(BUILDER.validate_content(content, PANDAS, PUBLISHED), [])
        self.assert_error(lambda c: c["cards"][0]["body"].update(en="[draft] A real fact."), "draft mark", "published")

    def test_published_sources_need_an_https_citation(self) -> None:
        self.assert_error(lambda c: c["cards"][0]["sources"][0].update(url="http://example.test/a"), "https", "published")
        self.assert_error(lambda c: c["cards"][0]["sources"][0].update(url="https://example.test/a"), "citedOn", "draft")

    def test_a_face_tip_body_may_be_empty(self) -> None:
        content = document()
        content["faceGuides"][0]["tips"][1]["body"] = {"zh": "", "en": ""}
        self.assertEqual(BUILDER.validate_content(content, PANDAS, PUBLISHED), [])

    def test_published_items_may_be_chinese_only(self) -> None:
        content = document("published")
        content["articles"] = [minimal_article()]
        omit_english(content)
        self.assertEqual(BUILDER.validate_content(content, PANDAS, PUBLISHED), [])

    def test_published_english_may_be_blank(self) -> None:
        content = document("published")
        for field in ("title", "summary", "body"):
            content["cards"][0][field]["en"] = ""
        content["cards"][0]["sources"][0]["title"]["en"] = "   "
        content["faceGuides"][0]["tips"][0]["body"] = {"zh": "两颊圆润。"}
        self.assertEqual(BUILDER.validate_content(content, PANDAS, PUBLISHED), [])

    def test_a_written_english_string_still_has_a_length_limit(self) -> None:
        self.assert_error(lambda c: c["cards"][0]["title"].update(en="x" * 49), "title.en", "published")
        self.assert_error(lambda c: c["challenges"][0]["prompt"].update(en="x" * 81), "prompt.en", "published")

    def test_chinese_is_still_required_when_english_is_omitted(self) -> None:
        self.assert_error(lambda c: c["cards"][0]["title"].pop("zh"), "must include zh", "published")
        self.assert_error(lambda c: c["terms"][0]["definition"].pop("zh"), "must include zh", "published")

    def test_face_tips_and_real_pandas(self) -> None:
        self.assert_error(lambda c: c["faceGuides"][0]["tips"].pop(), "tips")
        self.assert_error(lambda c: c["faceGuides"][0].update(pandaSlug="not-a-panda"), "pandaSlug")
        self.assert_error(lambda c: c["challenges"][0]["decoyPandaSlugs"].append("bao-li"), "three different")

    def test_rejects_unknown_fields_and_self_links(self) -> None:
        self.assert_error(lambda c: c["cards"][0].update(extra=True), "unexpected fields")
        self.assert_error(lambda c: c["terms"][0]["relatedSlugs"].append("eye-patch"), "itself")

    def test_challenge_options_must_be_published_pandas(self) -> None:
        self.assert_error(lambda c: c["challenges"][0].update(answerPandaSlug="ya-lun"), "answerPandaSlug: ya-lun is not a published panda")
        self.assert_error(
            lambda c: c["challenges"][0].update(decoyPandaSlugs=["lun-lun", "lei-lei", "yang-yang"]),
            "decoyPandaSlugs: yang-yang is not a published panda",
        )

    def test_the_repository_challenges_use_published_pandas(self) -> None:
        content = json.loads(BUILDER.DATA_PATH.read_text(encoding="utf-8"))
        published = BUILDER.published_panda_slugs()
        for challenge in content["challenges"]:
            for slug in [challenge["answerPandaSlug"], *challenge["decoyPandaSlugs"]]:
                self.assertIn(slug, published, challenge["slug"])


def omit_english(value: object) -> None:
    if isinstance(value, dict):
        if "zh" in value and set(value) <= {"zh", "en", "drawnFromBody"}:
            value.pop("en", None)
        for child in value.values():
            omit_english(child)
    elif isinstance(value, list):
        for child in value:
            omit_english(child)


def minimal_article() -> dict:
    def copy(zh: str) -> dict:
        return {"zh": zh}

    return {
        "slug": "zh-only-article",
        "status": "published",
        "category": "外形与识别",
        "sourceCardSlug": "black-eye-patches",
        "title": copy("只有中文"),
        "dek": copy("导语"),
        "pullQuote": copy("引语"),
        "body": {"sections": [{"heading": copy("小节"), "paragraphs": [{"text": copy("段落"), "refs": ["ref"]}]}]},
        "keyFacts": [{"text": copy("要点"), "refs": ["ref"]}],
        "images": [commons_figure(caption=copy("图说"))],
        "references": [
            {
                "id": "ref",
                "title": "基地官网",
                "publisher": "基地",
                "url": "https://www.panda.org.cn/",
                "citedOn": "2026-10-29",
            }
        ],
        "relatedArticles": [],
        "stats": {"bodyChars": 2, "bodyCjkChars": 2, "sectionCount": 1, "referenceCount": 1},
        "glossaryTerms": [],
    }


def commons_figure(**changes: object) -> dict:
    figure = {
        "role": "hero",
        "type": "existing",
        "pandaSlug": None,
        "asset": "https://commons.wikimedia.org/wiki/Special:Redirect/file/Chengdu-pandas-d18.jpg",
        "sourcePage": "https://commons.wikimedia.org/wiki/File:Chengdu-pandas-d18.jpg",
        "credit": "Colegota / Wikimedia Commons",
        "rights": "CC BY-SA 2.5 es",
        "caption": {"zh": "新生幼仔"},
        "captionRefs": ["ref"],
    }
    figure.update(changes)
    return figure


class ArticleImageTests(unittest.TestCase):
    def errors(self, figure: dict) -> list[str]:
        errors: list[str] = []
        BUILDER.validate_article_images([figure], "articles[0]", "draft", PANDAS, {}, {"ref"}, errors)
        return errors

    def test_a_figure_without_a_panda_may_use_a_free_commons_file(self) -> None:
        self.assertEqual(self.errors(commons_figure()), [])
        self.assertEqual(self.errors(commons_figure(rights="CC0 1.0")), [])
        self.assertEqual(self.errors(commons_figure(rights="CC BY-SA 4.0")), [])

    def test_a_figure_without_a_panda_needs_a_commons_page_and_a_free_license(self) -> None:
        self.assertIn("sourcePage", " ".join(self.errors(commons_figure(sourcePage="https://example.test/photo"))))
        self.assertIn("asset", " ".join(self.errors(commons_figure(asset="https://example.test/photo.jpg"))))
        self.assertIn("rights", " ".join(self.errors(commons_figure(rights="All rights reserved"))))
        self.assertIn("rights", " ".join(self.errors(commons_figure(rights="CC BY-NC 4.0"))))

    def test_a_figure_of_a_panda_still_needs_an_approved_photo(self) -> None:
        self.assertIn("approved photo", " ".join(self.errors(commons_figure(pandaSlug="bao-li"))))

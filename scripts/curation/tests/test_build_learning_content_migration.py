from __future__ import annotations

import copy
import importlib.util
import json
import unittest
from pathlib import Path

MODULE_PATH = Path(__file__).resolve().parents[1] / "build_learning_content_migration.py"
SPEC = importlib.util.spec_from_file_location("build_learning_content_migration", MODULE_PATH)
assert SPEC and SPEC.loader
BUILDER = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(BUILDER)

PANDAS = {"bao-li", "lun-lun", "lei-lei", "yang-yang", "ya-lun"}


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
                "decoyPandaSlugs": ["lun-lun", "lei-lei", "yang-yang"],
                "prompt": text(status, "选出这只", "Which one"),
                "tip": text(status, "提示", "Tip"),
                "sources": [source(status)],
            }
        ],
    }


class ValidateLearningContentTests(unittest.TestCase):
    def test_valid_draft_and_published_documents(self) -> None:
        self.assertEqual(BUILDER.validate_content(document(), PANDAS), [])
        self.assertEqual(BUILDER.validate_content(document("published"), PANDAS), [])

    def test_repository_file_matches_its_migration(self) -> None:
        content = json.loads(BUILDER.DATA_PATH.read_text(encoding="utf-8"))
        self.assertEqual(BUILDER.validate_content(content), [])
        latest = BUILDER.latest_content_migration()
        self.assertIsNotNone(latest)
        self.assertEqual(latest.read_text(encoding="utf-8"), BUILDER.render_migration(content))

    def assert_error(self, mutate, fragment: str, status: str = "draft") -> None:
        content = copy.deepcopy(document(status))
        mutate(content)
        errors = BUILDER.validate_content(content, PANDAS)
        self.assertTrue(any(fragment in error for error in errors), errors)

    def test_unmarked_drafts_are_allowed_and_published_text_must_not_look_like_a_draft(self) -> None:
        content = document()
        content["cards"][0]["title"] = {"zh": "黑眼圈", "en": "Eye patches"}
        self.assertEqual(BUILDER.validate_content(content, PANDAS), [])
        self.assert_error(lambda c: c["cards"][0]["body"].update(en="[draft] A real fact."), "draft mark", "published")

    def test_published_sources_need_an_https_citation(self) -> None:
        self.assert_error(lambda c: c["cards"][0]["sources"][0].update(url="http://example.test/a"), "https", "published")
        self.assert_error(lambda c: c["cards"][0]["sources"][0].update(url="https://example.test/a"), "citedOn", "draft")

    def test_a_face_tip_body_may_be_empty(self) -> None:
        content = document()
        content["faceGuides"][0]["tips"][1]["body"] = {"zh": "", "en": ""}
        self.assertEqual(BUILDER.validate_content(content, PANDAS), [])

    def test_face_tips_and_real_pandas(self) -> None:
        self.assert_error(lambda c: c["faceGuides"][0]["tips"].pop(), "tips")
        self.assert_error(lambda c: c["faceGuides"][0].update(pandaSlug="not-a-panda"), "pandaSlug")
        self.assert_error(lambda c: c["challenges"][0]["decoyPandaSlugs"].append("bao-li"), "three different")

    def test_rejects_unknown_fields_and_self_links(self) -> None:
        self.assert_error(lambda c: c["cards"][0].update(extra=True), "unexpected fields")
        self.assert_error(lambda c: c["terms"][0]["relatedSlugs"].append("eye-patch"), "itself")

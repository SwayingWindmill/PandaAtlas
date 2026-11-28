from __future__ import annotations

import importlib.util
import unittest
from datetime import date
from pathlib import Path

MODULE_PATH = Path(__file__).resolve().parents[1] / "review_due.py"
SPEC = importlib.util.spec_from_file_location("review_due", MODULE_PATH)
assert SPEC and SPEC.loader
REVIEW = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(REVIEW)

TODAY = date(2026, 11, 25)


class ReviewDueTests(unittest.TestCase):
    def test_visit_guides_fall_due_before_profiles(self) -> None:
        content = {
            "institutions": [
                {
                    "slug": "zoo",
                    "nameZh": "动物园",
                    "profile": {"verifiedOn": "2026-06-01"},
                    "places": [{"slug": "zoo-main", "visitGuide": {"verifiedOn": "2026-08-01"}}, {"slug": "annex"}],
                }
            ]
        }
        items = REVIEW.institution_items(content, TODAY)
        self.assertEqual(len(items), 1)
        self.assertIn("zoo-main", items[0])
        self.assertIn("checked 2026-08-01", items[0])

    def test_open_overseas_entries_and_old_news(self) -> None:
        overseas = {
            "items": [
                {"status": "published", "pandaSlug": "a", "stage": "abroad", "updatedAt": "2026-10-01T09:00:00+08:00"},
                {"status": "published", "pandaSlug": "b", "stage": "returned", "updatedAt": "2025-01-01T09:00:00+08:00"},
                {"status": "draft", "pandaSlug": "c", "stage": "abroad", "updatedAt": "2025-01-01T09:00:00+08:00"},
            ]
        }
        self.assertEqual(len(REVIEW.overseas_items(overseas, TODAY)), 1)
        news = {"items": [{"status": "published", "headline": "闭馆", "publishedOn": "2026-09-01"}]}
        self.assertEqual(len(REVIEW.news_items(news, TODAY)), 1)

    def test_reminds_about_next_month_theme_near_month_end(self) -> None:
        self.assertEqual(len(REVIEW.theme_items({"monthThemes": []}, TODAY)), 1)
        published = {"monthThemes": [{"month": "2026-12", "status": "published"}]}
        self.assertEqual(REVIEW.theme_items(published, TODAY), [])
        self.assertEqual(REVIEW.theme_items({"monthThemes": []}, date(2026, 11, 5)), [])

    def test_renders_a_checklist_or_says_nothing_is_due(self) -> None:
        self.assertIn("没有到期", REVIEW.render([("场馆动态", [])], TODAY))
        self.assertIn("- [ ] x", REVIEW.render([("场馆动态", ["x"])], TODAY))

    def test_repository_files_review_cleanly(self) -> None:
        REVIEW.render(REVIEW.review(TODAY), TODAY)


if __name__ == "__main__":
    unittest.main()

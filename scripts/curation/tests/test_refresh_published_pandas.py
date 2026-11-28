from __future__ import annotations

import importlib.util
import unittest
from pathlib import Path

MODULE_PATH = Path(__file__).resolve().parents[1] / "refresh_published_pandas.py"
SPEC = importlib.util.spec_from_file_location("refresh_published_pandas", MODULE_PATH)
assert SPEC and SPEC.loader
REFRESH = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(REFRESH)


class RefreshPublishedPandasTests(unittest.TestCase):
    def test_build_snapshot_collects_unique_slugs_and_chinese_names(self) -> None:
        payload = {
            "release": {"version": "2026.10.31.1"},
            "items": [
                {
                    "canonicalSlug": "he-hua-chengdu",
                    "names": [
                        {"languageTag": "en", "value": "He Hua"},
                        {"languageTag": "zh-Hans", "value": "和花"},
                        {"languageTag": "zh-Hans", "value": " 和花 "},
                    ],
                },
                {
                    "canonicalSlug": "a-bao",
                    "names": [
                        {"languageTag": "zh-Hans", "value": "阿宝"},
                        {"languageTag": "en", "value": "A Bao"},
                    ],
                },
            ],
        }
        snapshot = REFRESH.build_snapshot(payload, "https://api.zhipanda.com/api/v2/pandas", "2026-11-19")
        self.assertEqual(snapshot["releaseVersion"], "2026.10.31.1")
        self.assertEqual(snapshot["slugs"], ["a-bao", "he-hua-chengdu"])
        self.assertEqual(
            snapshot["pandas"],
            [
                {"slug": "a-bao", "namesZh": ["阿宝"]},
                {"slug": "he-hua-chengdu", "namesZh": ["和花"]},
            ],
        )

    def test_build_snapshot_rejects_empty_items(self) -> None:
        with self.assertRaisesRegex(ValueError, "no items"):
            REFRESH.build_snapshot({"items": []}, "https://api.zhipanda.com/api/v2/pandas", "2026-11-19")


if __name__ == "__main__":
    unittest.main()

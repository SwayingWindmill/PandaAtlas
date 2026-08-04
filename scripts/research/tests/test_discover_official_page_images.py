from __future__ import annotations

import importlib.util
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
SCRIPT_DIR = ROOT / "scripts" / "research" / "runners"
if str(SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPT_DIR))
MODULE_PATH = SCRIPT_DIR / "discover_official_page_images.py"
SPEC = importlib.util.spec_from_file_location("discover_official_page_images", MODULE_PATH)
assert SPEC is not None and SPEC.loader is not None
MODULE = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = MODULE
SPEC.loader.exec_module(MODULE)


class DiscoverOfficialPageImagesTests(unittest.TestCase):
    def test_discovers_meta_img_lazy_and_srcset_images(self) -> None:
        html = """
        <html>
          <head>
            <base href="https://example.org/articles/">
            <meta property="og:image" content="/media/panda-og.jpg">
          </head>
          <body>
            <img src="thumb.jpg" data-src="https://cdn.example.org/panda-main.webp"
                 alt="Po and De De giant pandas" class="hero panda">
            <picture><source srcset="small.jpg 400w, large.jpg 1200w"></picture>
          </body>
        </html>
        """
        result = MODULE.discover_from_html("https://example.org/page", html)
        urls = [row["asset_url"] for row in result["images"]]
        self.assertEqual(
            urls,
            [
                "https://example.org/media/panda-og.jpg",
                "https://example.org/articles/thumb.jpg",
                "https://cdn.example.org/panda-main.webp",
                "https://example.org/articles/small.jpg",
                "https://example.org/articles/large.jpg",
            ],
        )
        self.assertEqual(result["image_count"], 5)

    def test_deduplicates_same_resolved_asset(self) -> None:
        html = """
        <meta property="og:image" content="https://example.org/panda.jpg">
        <img src="/panda.jpg" alt="giant panda">
        """
        result = MODULE.discover_from_html("https://example.org/news/item", html)
        self.assertEqual(result["image_count"], 1)
        self.assertEqual(
            result["images"][0]["source_types"],
            ["meta:og:image", "img:src"],
        )

    def test_keyword_filters_use_url_alt_title_and_element_evidence(self) -> None:
        html = """
        <img src="/images/logo.png" alt="Official zoo logo">
        <img src="/images/po-de-de.jpg" alt="Po y De De">
        <img src="/images/red-panda.jpg" alt="Red panda">
        <img src="/images/panda-statue.jpg" title="Panda statue">
        """
        result = MODULE.discover_from_html(
            "https://example.org/page",
            html,
            required_keywords=["panda", "po y de de"],
            excluded_keywords=["red panda", "statue"],
        )
        self.assertEqual(
            [row["asset_url"] for row in result["images"]],
            ["https://example.org/images/po-de-de.jpg"],
        )

    def test_ignores_data_blob_javascript_and_http_assets(self) -> None:
        html = """
        <img src="data:image/png;base64,AAAA">
        <img src="blob:https://example.org/id">
        <img src="javascript:void(0)">
        <img src="http://example.org/insecure.jpg">
        <img src="https://example.org/secure.jpg">
        """
        result = MODULE.discover_from_html("https://example.org/page", html)
        self.assertEqual(
            [row["asset_url"] for row in result["images"]],
            ["https://example.org/secure.jpg"],
        )

    def test_parse_srcset_strips_descriptors(self) -> None:
        self.assertEqual(
            MODULE.parse_srcset("a.jpg 1x, b.jpg 2x, c.jpg 1200w"),
            ["a.jpg", "b.jpg", "c.jpg"],
        )

    def test_parse_srcset_skips_empty_items(self) -> None:
        self.assertEqual(
            MODULE.parse_srcset(" , a.jpg 1x,, b.jpg 2x, "),
            ["a.jpg", "b.jpg"],
        )


if __name__ == "__main__":
    unittest.main()

from __future__ import annotations

import importlib.util
import json
import sys
import tempfile
import unittest
from pathlib import Path

MODULE_PATH = Path(__file__).resolve().parents[1] / "audit_launch_coverage.py"
SPEC = importlib.util.spec_from_file_location("audit_launch_coverage", MODULE_PATH)
assert SPEC and SPEC.loader
AUDIT = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = AUDIT
SPEC.loader.exec_module(AUDIT)


def make_panda(
    panda_id: str,
    slug: str,
    name_zh: str,
    *,
    birth_date: str | None = None,
    sex: str | None = None,
    life_status: str | None = "alive",
    place: dict | None = None,
    has_cover: bool = False,
) -> dict:
    facts = []
    if life_status is not None:
        facts.append({"fieldKey": "life_status", "value": life_status})
    if sex is not None:
        facts.append({"fieldKey": "sex", "value": sex})
    if birth_date is not None:
        facts.append({"fieldKey": "birth_date", "value": birth_date})
    item = {
        "pandaId": panda_id,
        "canonicalSlug": slug,
        "legacySlugs": [],
        "names": [
            {"languageTag": "zh-Hans", "nameKind": "official", "value": name_zh, "isPrimary": True}
        ],
        "facts": facts,
        "hasFullBleedCover": has_cover,
    }
    if place is not None:
        item["currentPlace"] = place
    return item


class AuditLaunchCoverageTests(unittest.TestCase):
    def test_analyze_export_directory_computes_coverage_and_gaps(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            export_dir = Path(tmp) / "export"
            export_dir.mkdir()
            inst_file = Path(tmp) / "institutions.json"
            learning_file = Path(tmp) / "learning.json"

            place_chengdu = {
                "placeId": "place-1",
                "slug": "chengdu-research-base",
                "placeType": "facility",
                "nameZh": "成都大熊猫繁育研究基地",
                "countryCode": "CN",
                "longitude": 104.14,
                "latitude": 30.73,
                "visitGuide": {"viewing": {"activeWindows": [{"start": "08:00", "end": "11:00"}]}},
            }
            p1 = make_panda(
                "id-1",
                "he-hua",
                "和花",
                birth_date="2020-07-04",
                sex="female",
                place=place_chengdu,
                has_cover=True,
            )
            p2 = make_panda(
                "id-2", "meng-lan", "萌兰", birth_date=None, sex="male", place=None, has_cover=False
            )

            (export_dir / "stats.json").write_text(
                json.dumps(
                    {
                        "release": {"releaseId": "rel-1", "version": "2026.10.31.1"},
                        "stats": {"pandaCount": 2, "institutionCount": 1, "placeCount": 1},
                    }
                ),
                encoding="utf-8",
            )
            (export_dir / "pandas.json").write_text(
                json.dumps({"items": [p1, p2]}), encoding="utf-8"
            )
            (export_dir / "places.json").write_text(
                json.dumps({"items": [place_chengdu]}), encoding="utf-8"
            )
            (export_dir / "institutions.json").write_text(
                json.dumps(
                    {"items": [{"institutionId": "inst-1", "slug": "chengdu-research-base"}]}
                ),
                encoding="utf-8",
            )
            (export_dir / "lineage.json").write_text(
                json.dumps({"items": [{"childId": "id-1", "parentId": "id-0"}]}), encoding="utf-8"
            )
            (export_dir / "residencies.json").write_text(
                json.dumps({"items": [{"pandaId": "id-1", "placeId": "place-1"}]}), encoding="utf-8"
            )
            (export_dir / "life-events.json").write_text(
                json.dumps({"items": [{"participantIds": ["id-1"]}]}), encoding="utf-8"
            )
            (export_dir / "learning.json").write_text(
                json.dumps({"version": "2026.11.01.2", "articles": [{"slug": "a"}], "terms": []}),
                encoding="utf-8",
            )
            (export_dir / "panda-details.jsonl").write_text(
                json.dumps(
                    {
                        "panda": p1,
                        "residencies": [{"id": "r1"}],
                        "lineage": [{"id": "l1"}],
                        "events": [{"id": "e1"}],
                        "media": [{"assetId": "m1"}],
                    }
                )
                + "\n",
                encoding="utf-8",
            )

            inst_file.write_text(
                json.dumps(
                    {
                        "institutions": [
                            {
                                "slug": "chengdu-research-base",
                                "places": [{"slug": "chengdu-research-base"}],
                            }
                        ]
                    }
                ),
                encoding="utf-8",
            )
            learning_file.write_text(
                json.dumps(
                    {
                        "version": "2026.11.18.1",
                        "articles": [{"status": "published"}, {"status": "draft"}],
                        "terms": [],
                    }
                ),
                encoding="utf-8",
            )

            dataset = AUDIT.load_export_dataset(export_dir)
            report = AUDIT.analyze_coverage(
                dataset, institutions_file=inst_file, learning_file=learning_file
            )

            self.assertEqual(report["release"]["version"], "2026.10.31.1")
            self.assertEqual(
                report["field_coverage"]["cover_photo"], {"count": 1, "total": 2, "percent": 50.0}
            )
            self.assertEqual(
                report["field_coverage"]["birth_date"], {"count": 1, "total": 2, "percent": 50.0}
            )
            self.assertEqual(
                report["field_coverage"]["current_place"], {"count": 1, "total": 2, "percent": 50.0}
            )

            by_name = {item["query_name"]: item for item in report["focus_pandas"]}
            self.assertTrue(by_name["花花（和花）"]["matched"])
            self.assertEqual(by_name["花花（和花）"]["canonical_slug"], "he-hua")
            self.assertEqual(by_name["花花（和花）"]["residency_count"], 1)
            self.assertEqual(by_name["花花（和花）"]["lineage_count"], 1)
            self.assertTrue(by_name["萌兰"]["matched"])
            self.assertFalse(by_name["萌兰"]["has_birth_date"])
            self.assertFalse(by_name["福宝"]["matched"])

            markdown = AUDIT.render_markdown(report)
            self.assertIn("落后于仓库版本", markdown)
            self.assertIn("`he-hua`", markdown)
            self.assertIn("北京动物园", markdown)

    def test_load_live_dataset_uses_mocked_fetcher_and_batches_covers(self) -> None:
        place = {
            "placeId": "pl-1",
            "slug": "beijing-zoo",
            "placeType": "facility",
            "nameZh": "北京动物园",
            "countryCode": "CN",
        }
        p1 = make_panda(
            "uuid-1", "meng-lan", "萌兰", birth_date="2015-07-04", sex="male", place=place
        )
        responses = {
            "https://mock.local/api/v2/stats": {
                "release": {"releaseId": "r1", "version": "2026.11.01"},
                "stats": {"pandaCount": 1},
            },
            "https://mock.local/api/v2/pandas": {"items": [p1], "nextCursor": "c2"},
            "https://mock.local/api/v2/pandas?cursor=c2": {"items": []},
            "https://mock.local/api/v2/places": {"items": [place]},
            "https://mock.local/api/v2/institutions": {"items": []},
            "https://mock.local/api/v2/lineage": {"items": []},
            "https://mock.local/api/v2/residencies": {"items": []},
            "https://mock.local/api/v2/life-events": {"items": []},
            "https://mock.local/api/v2/popular-pandas": {
                "windowDays": 30,
                "items": [{"pandaId": "uuid-1", "slug": "meng-lan"}],
            },
            "https://mock.local/api/v2/learning": {
                "version": "2026.11.18.1",
                "articles": [],
                "terms": [],
                "faceGuides": [],
                "challenges": [],
                "monthThemes": [],
            },
            "https://mock.local/api/v2/venue-news": {"version": "", "items": []},
            "https://mock.local/api/v2/overseas-status": {"version": "", "items": []},
            "https://mock.local/api/v2/comparisons": {"version": "2026.11.11.1", "items": []},
            "https://mock.local/api/v2/panda-covers?ids=uuid-1": {"items": [{"pandaId": "uuid-1"}]},
            "https://mock.local/api/v2/pandas/meng-lan": {
                "panda": p1,
                "residencies": [{"id": "r"}],
                "lineage": [],
                "events": [],
                "media": [{"id": "m"}],
            },
        }

        def fake_fetch(url: str) -> dict:
            if url not in responses:
                raise AssertionError(f"Unexpected URL requested: {url}")
            return responses[url]

        dataset = AUDIT.load_live_dataset("https://mock.local", fetch_json=fake_fetch)
        report = AUDIT.analyze_coverage(
            dataset, institutions_file=None, learning_file=None, fetch_json=fake_fetch
        )

        self.assertEqual(report["field_coverage"]["cover_photo"]["count"], 1)
        self.assertEqual(report["catalogs"]["popular_pandas"], {"windowDays": 30, "count": 1})
        matched_meng_lan = next(
            item for item in report["focus_pandas"] if item["canonical_slug"] == "meng-lan"
        )
        self.assertTrue(matched_meng_lan["from_popular_api"])
        self.assertEqual(matched_meng_lan["residency_count"], 1)
        self.assertEqual(matched_meng_lan["media_count"], 1)

    def test_prefers_exact_chinese_name_or_slug_over_romanization_homophone(self) -> None:
        fu_bao_real = make_panda(
            "id-real", "fu-bao", "福宝", birth_date=None, sex=None, life_status=None
        )
        fu_bao_vienna = make_panda(
            "id-vienna",
            "fu-bao-vienna",
            "福豹",
            birth_date="2010-08-23",
            sex="male",
            life_status="alive",
            has_cover=True,
        )
        fu_bao_vienna["names"].append(
            {
                "languageTag": "en",
                "nameKind": "official_romanization",
                "value": "Fu Bao",
                "isPrimary": True,
            }
        )

        dataset = {
            "source_mode": "export",
            "source": "mock",
            "stats": {},
            "pandas": {"items": [fu_bao_vienna, fu_bao_real]},
            "places": {"items": []},
            "institutions": {"items": []},
            "cover_ids": {"id-vienna"},
            "details_by_slug": {},
        }
        report = AUDIT.analyze_coverage(dataset, institutions_file=None, learning_file=None)
        fubao_row = next(item for item in report["focus_pandas"] if item["query_name"] == "福宝")
        self.assertTrue(fubao_row["matched"])
        self.assertEqual(fubao_row["canonical_slug"], "fu-bao")
        self.assertEqual(fubao_row["display_name"], "福宝")


if __name__ == "__main__":
    unittest.main()

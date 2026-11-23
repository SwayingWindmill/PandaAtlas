from __future__ import annotations

import importlib.util
import io
import json
import sys
import tempfile
import unittest
from email.message import Message
from pathlib import Path
from unittest.mock import patch
from urllib.error import HTTPError

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


def http_error(url: str, code: int) -> HTTPError:
    return HTTPError(url, code, f"HTTP {code}", Message(), None)


class _FakeResponse:
    def __init__(self, body: str) -> None:
        self._body = body.encode("utf-8")

    def read(self) -> bytes:
        return self._body

    def __enter__(self) -> _FakeResponse:
        return self

    def __exit__(self, *_args: object) -> None:
        return None


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
                "id-2",
                "meng-lan",
                "萌兰",
                birth_date=None,
                sex="male",
                place=None,
                has_cover=False,
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
            # Top-level relation collections loaded: zero matches resolve to 0, not None.
            self.assertEqual(by_name["萌兰"]["residency_count"], 0)
            self.assertEqual(by_name["萌兰"]["lineage_count"], 0)
            self.assertEqual(by_name["萌兰"]["event_count"], 0)
            self.assertFalse(by_name["福宝"]["matched"])

            markdown = AUDIT.render_markdown(report)
            self.assertIn("落后于仓库版本", markdown)
            self.assertIn("`he-hua`", markdown)
            self.assertIn("北京动物园", markdown)

    def test_load_live_dataset_paginates_batches_covers_and_handles_optional_errors(self) -> None:
        place = {
            "placeId": "pl-1",
            "slug": "beijing-zoo",
            "placeType": "facility",
            "nameZh": "北京动物园",
            "countryCode": "CN",
        }
        pandas = [
            make_panda(
                f"uuid-{idx}",
                "meng-lan" if idx == 0 else f"panda-{idx}",
                "萌兰" if idx == 0 else f"熊猫{idx}",
                birth_date="2015-07-04" if idx == 0 else None,
                sex="male",
                place=place if idx == 0 else None,
            )
            for idx in range(51)
        ]
        batch_one_ids = ",".join(f"uuid-{idx}" for idx in range(50))
        batch_two_ids = "uuid-50"
        requested_urls: list[str] = []

        responses: dict[str, object] = {
            "https://mock.local/api/v2/stats": {
                "release": {"releaseId": "r1", "version": "2026.11.01"},
                "stats": {"pandaCount": 51},
            },
            # Page 1 -> page.nextCursor -> Page 2 -> cycle guard stops repeat cursor.
            "https://mock.local/api/v2/pandas": {
                "items": pandas[:30],
                "page": {"nextCursor": "c2"},
            },
            "https://mock.local/api/v2/pandas?cursor=c2": {
                "items": pandas[30:],
                "nextCursor": "c2",
            },
            "https://mock.local/api/v2/places": {"items": [place]},
            "https://mock.local/api/v2/institutions": {"items": []},
            "https://mock.local/api/v2/lineage": {"items": []},
            "https://mock.local/api/v2/residencies": {"items": []},
            "https://mock.local/api/v2/life-events": {"items": []},
            "https://mock.local/api/v2/popular-pandas": {
                "windowDays": 30,
                "items": [{"pandaId": "uuid-0", "slug": "meng-lan"}],
            },
            "https://mock.local/api/v2/learning": {
                "version": "2026.11.18.1",
                "articles": [],
                "terms": [],
                "faceGuides": [],
                "challenges": [],
                "monthThemes": [],
            },
            "https://mock.local/api/v2/venue-news": http_error(
                "https://mock.local/api/v2/venue-news", 404
            ),
            "https://mock.local/api/v2/overseas-status": {"version": "", "items": []},
            "https://mock.local/api/v2/comparisons": {"version": "2026.11.11.1", "items": []},
            f"https://mock.local/api/v2/panda-covers?ids={batch_one_ids}": {
                "items": [{"pandaId": "uuid-0"}]
            },
            f"https://mock.local/api/v2/panda-covers?ids={batch_two_ids}": {
                "items": [{"pandaId": "uuid-50"}]
            },
            "https://mock.local/api/v2/pandas/meng-lan": http_error(
                "https://mock.local/api/v2/pandas/meng-lan", 404
            ),
        }

        def fake_fetch(url: str) -> dict:
            requested_urls.append(url)
            if url not in responses:
                raise AssertionError(f"Unexpected URL requested: {url}")
            value = responses[url]
            if isinstance(value, Exception):
                raise value
            return value  # type: ignore[return-value]

        dataset = AUDIT.load_live_dataset("https://mock.local", fetch_json=fake_fetch)
        report = AUDIT.analyze_coverage(
            dataset, institutions_file=None, learning_file=None, fetch_json=fake_fetch
        )

        self.assertEqual(len(dataset["pandas"]["items"]), 51)
        self.assertEqual(
            report["field_coverage"]["cover_photo"], {"count": 2, "total": 51, "percent": 3.9}
        )
        self.assertIsNone(report["catalogs"]["venue_news"])
        self.assertEqual(report["catalogs"]["popular_pandas"], {"windowDays": 30, "count": 1})
        matched_meng_lan = next(
            item for item in report["focus_pandas"] if item["canonical_slug"] == "meng-lan"
        )
        self.assertTrue(matched_meng_lan["from_popular_api"])
        # Detail 404 falls back to loaded top-level relation collections (0).
        self.assertEqual(matched_meng_lan["residency_count"], 0)
        self.assertEqual(requested_urls.count("https://mock.local/api/v2/pandas?cursor=c2"), 1)

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
        self.assertIsNone(fubao_row["residency_count"])

    def test_ignores_disputed_invalid_facts_and_coarse_venue_false_positives(self) -> None:
        coarse_fuzhou = {
            "placeId": "coarse-fz",
            "slug": "coarse-fuzhou",
            "placeType": "coarse_location",
            "nameZh": "福州",
        }
        panda_valley = {
            "placeId": "pv-1",
            "slug": "chengdu-panda-valley-dujiangyan",
            "placeType": "facility",
            "nameZh": "成都基地都江堰熊猫谷",
            "countryCode": "CN",
        }
        panda = {
            "pandaId": "id-1",
            "canonicalSlug": "test-panda",
            "legacySlugs": [],
            "names": [],
            "facts": [
                {"fieldKey": "sex", "value": "unknown", "status": "confirmed"},
                {"fieldKey": "life_status", "value": "alive", "status": "disputed"},
                {"fieldKey": "birth_date", "value": "   ", "status": "confirmed"},
            ],
        }
        dataset = {
            "source_mode": "export",
            "source": "mock",
            "stats": {},
            "pandas": {"items": [panda]},
            "places": {"items": [coarse_fuzhou, panda_valley]},
            "institutions": {"items": []},
            "cover_ids": set(),
            "details_by_slug": {},
        }
        report = AUDIT.analyze_coverage(dataset, institutions_file=None, learning_file=None)
        self.assertEqual(report["field_coverage"]["sex"]["count"], 0)
        self.assertEqual(report["field_coverage"]["life_status"]["count"], 0)
        self.assertEqual(report["field_coverage"]["birth_date"]["count"], 0)

        venues = {v["name"]: v for v in report["core_venues"]}
        self.assertFalse(venues["福州熊猫世界（海峡大熊猫研究交流中心）"]["present_live"])
        self.assertTrue(
            venues["成都大熊猫繁育研究基地都江堰野放繁育研究中心（熊猫谷）"]["present_live"]
        )
        self.assertFalse(venues["中国大熊猫保护研究中心都江堰基地（中华大熊猫苑）"]["present_live"])

    def test_handles_empty_dataset_and_missing_export_directory(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            with self.assertRaises(FileNotFoundError):
                AUDIT.load_export_dataset(Path(tmp) / "missing")

        empty_dataset = {
            "source_mode": "export",
            "source": "empty",
            "stats": {},
            "pandas": {"items": []},
            "places": {"items": []},
            "institutions": {"items": []},
            "cover_ids": set(),
            "details_by_slug": {},
        }
        report = AUDIT.analyze_coverage(empty_dataset, institutions_file=None, learning_file=None)
        self.assertEqual(
            report["field_coverage"]["cover_photo"], {"count": 0, "total": 0, "percent": 0.0}
        )
        self.assertIn("未命中 / 未收录", AUDIT.render_markdown(report))

    def test_default_fetch_json_retries_transient_errors_and_rejects_bad_schemes_or_4xx(
        self,
    ) -> None:
        with self.assertRaises(ValueError):
            AUDIT.default_fetch_json("file:///etc/passwd")

        with patch.object(
            AUDIT, "urlopen", side_effect=http_error("https://mock.local/x", 400)
        ) as m:
            with self.assertRaises(HTTPError):
                AUDIT.default_fetch_json("https://mock.local/x")
            self.assertEqual(m.call_count, 1)

        with (
            patch.object(AUDIT.time, "sleep") as sleep_mock,
            patch.object(
                AUDIT,
                "urlopen",
                side_effect=[
                    http_error("https://mock.local/y", 503),
                    _FakeResponse('{"ok": true}'),
                ],
            ) as m,
        ):
            self.assertEqual(AUDIT.default_fetch_json("https://mock.local/y"), {"ok": True})
            self.assertEqual(m.call_count, 2)
            sleep_mock.assert_called_once()

    def test_main_writes_json_output_and_handles_stdout_without_reconfigure(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            export_dir = Path(tmp) / "export"
            export_dir.mkdir()
            (export_dir / "pandas.json").write_text(json.dumps({"items": []}), encoding="utf-8")
            out_file = Path(tmp) / "report.json"
            inst_file = Path(tmp) / "missing-inst.json"
            learning_file = Path(tmp) / "missing-learning.json"
            fake_stdout = io.StringIO()

            with patch.object(sys, "stdout", fake_stdout):
                exit_code = AUDIT.main(
                    [
                        "--from-export",
                        str(export_dir),
                        "--institutions-file",
                        str(inst_file),
                        "--learning-file",
                        str(learning_file),
                        "--format",
                        "json",
                        "--output",
                        str(out_file),
                    ]
                )

            self.assertEqual(exit_code, 0)
            written = json.loads(out_file.read_text(encoding="utf-8"))
            printed = json.loads(fake_stdout.getvalue())
            self.assertEqual(written, printed)
            self.assertEqual(written["source"]["mode"], "export")


if __name__ == "__main__":
    unittest.main()

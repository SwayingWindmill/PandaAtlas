from __future__ import annotations

import importlib.util
import json
import unittest
from pathlib import Path

MODULE_PATH = Path(__file__).resolve().parents[1] / "validate_panda_enrichment.py"
SPEC = importlib.util.spec_from_file_location("validate_panda_enrichment", MODULE_PATH)
assert SPEC and SPEC.loader
VALIDATOR = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(VALIDATOR)


def valid_doc(**overrides):
    doc = {
        "version": "2026.11.22.1",
        "updatedAt": "2026-11-22T18:00:00+08:00",
        "sources": [
            {
                "key": "samsung-2025",
                "publisher": "Samsung C&T Newsroom",
                "title": "Bamboo, Cake, and Goodbyes",
                "url": "https://news.samsungcnt.com/en/features/resort/test/",
                "lastVerifiedOn": "2026-11-22",
                "publishedOn": "2025-07-15",
                "languageTag": "en",
                "accessState": "accessible",
                "evidenceTier": "primary",
            }
        ],
        "items": [
            {
                "pandaSlug": "le-bao",
                "facts": [
                    {
                        "fieldKey": "birth_date",
                        "value": "2012-07-28",
                        "certainty": "confirmed",
                        "lastVerifiedOn": "2026-11-22",
                        "sourceKeys": ["samsung-2025"],
                    }
                ],
                "currentResidency": {
                    "placeSlug": "everland",
                    "startOn": "2016-03-03",
                    "startPrecision": "day",
                    "status": "confirmed",
                    "sourceKeys": ["samsung-2025"],
                },
            }
        ],
    }
    doc.update(overrides)
    return doc


class PandaEnrichmentValidatorTests(unittest.TestCase):
    def test_shipped_file_is_valid(self):
        document = json.loads(VALIDATOR.SOURCE.read_text(encoding="utf-8"))
        errors = VALIDATOR.validate(
            document,
            VALIDATOR.known_panda_slugs(),
            VALIDATOR.known_facility_place_slugs(),
        )
        self.assertEqual(errors, [])

    def test_rejects_bad_document_and_source_fields(self):
        bad_version = valid_doc(version="v1")
        self.assertTrue(VALIDATOR.validate(bad_version, {"le-bao"}, {"everland"}))

        bad_http = valid_doc()
        bad_http["sources"][0]["url"] = "http://example.com/a"
        self.assertTrue(VALIDATOR.validate(bad_http, {"le-bao"}, {"everland"}))

        bad_redirect = valid_doc()
        bad_redirect["sources"][0]["url"] = "https://vertexaisearch.cloud.google.com/grounding-api-redirect/abc"
        self.assertTrue(VALIDATOR.validate(bad_redirect, {"le-bao"}, {"everland"}))

        bad_date = valid_doc()
        bad_date["sources"][0]["lastVerifiedOn"] = "2026-02-30"
        self.assertTrue(VALIDATOR.validate(bad_date, {"le-bao"}, {"everland"}))

    def test_rejects_unknown_references_and_constraint_violations(self):
        doc = valid_doc()
        self.assertTrue(VALIDATOR.validate(doc, {"ai-bao"}, {"everland"}))
        self.assertTrue(VALIDATOR.validate(doc, {"le-bao"}, {"other-zoo"}))

        bad_source_ref = valid_doc()
        bad_source_ref["items"][0]["facts"][0]["sourceKeys"] = ["missing-source"]
        self.assertTrue(VALIDATOR.validate(bad_source_ref, {"le-bao"}, {"everland"}))

        bad_precision = valid_doc()
        bad_precision["items"][0]["currentResidency"] = {
            "placeSlug": "everland",
            "startOn": "2016-03-03",
            "startPrecision": "unknown",
            "status": "confirmed",
            "sourceKeys": ["samsung-2025"],
        }
        self.assertTrue(VALIDATOR.validate(bad_precision, {"le-bao"}, {"everland"}))

        bad_death = valid_doc()
        bad_death["items"][0]["facts"].append(
            {
                "fieldKey": "death_date",
                "value": "2010-01-01",
                "certainty": "confirmed",
                "lastVerifiedOn": "2026-11-22",
                "sourceKeys": ["samsung-2025"],
            }
        )
        self.assertTrue(VALIDATOR.validate(bad_death, {"le-bao"}, {"everland"}))

        deceased_residency = valid_doc()
        deceased_residency["items"][0]["facts"].append(
            {
                "fieldKey": "life_status",
                "value": "deceased",
                "certainty": "confirmed",
                "lastVerifiedOn": "2026-11-22",
                "sourceKeys": ["samsung-2025"],
            }
        )
        self.assertTrue(VALIDATOR.validate(deceased_residency, {"le-bao"}, {"everland"}))

    def test_rejects_self_or_same_parent_lineage(self):
        self_parent = valid_doc()
        self_parent["items"][0]["lineage"] = {
            "mother": {"parentSlug": "le-bao", "status": "confirmed", "sourceKeys": ["samsung-2025"]}
        }
        self.assertTrue(VALIDATOR.validate(self_parent, {"le-bao", "ai-bao"}, {"everland"}))

        same_parents = valid_doc()
        same_parents["items"][0]["lineage"] = {
            "mother": {"parentSlug": "ai-bao", "status": "confirmed", "sourceKeys": ["samsung-2025"]},
            "father": {"parentSlug": "ai-bao", "status": "confirmed", "sourceKeys": ["samsung-2025"]},
        }
        self.assertTrue(VALIDATOR.validate(same_parents, {"le-bao", "ai-bao"}, {"everland"}))


if __name__ == "__main__":
    unittest.main()

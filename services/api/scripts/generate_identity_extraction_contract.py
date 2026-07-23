from __future__ import annotations

import json
from pathlib import Path

from app.enrichment import (
    IdentityCandidateBatch,
    IdentityFieldEvidence,
    IdentitySubjectExtraction,
    build_identity_candidate_batch,
)
from app.identity_resolution import (
    IdentityFeatureSet,
    IdentityIdentifierClaim,
    IdentityNameClaim,
)
from app.knowledge.contracts import PopulationContext

ROOT = Path(__file__).resolve().parents[3]
SCHEMA_PATH = ROOT / "contracts" / "panda-identity-extraction.v1.json"
FIXTURE_DIR = ROOT / "contracts" / "panda-identity-extraction-fixtures" / "v1"


def _evidence(
    *,
    snapshot_id: str,
    body_sha256: str,
    field_path: str,
    raw_value: str,
    normalized_value: object,
    language: str,
) -> IdentityFieldEvidence:
    return IdentityFieldEvidence(
        evidence_snapshot_id=snapshot_id,
        evidence_body_sha256=body_sha256,
        field_path=field_path,
        raw_value=raw_value,
        normalized_value=normalized_value,
        language=language,
        source_locator={"section": field_path},
        parser_name="identity-fixture-parser",
        parser_version="1.0.0",
    )


def build_fixtures() -> dict[str, IdentityCandidateBatch]:
    multilingual = build_identity_candidate_batch(
        (
            IdentitySubjectExtraction(
                source_id="source-multilingual-profile",
                intake_candidate_id="intake-multilingual-hua-hua",
                subject_key="profile:花花",
                names=(
                    IdentityNameClaim(
                        value="花花",
                        language="zh",
                        kind="primary",
                        normalized_forms=("hua hua",),
                    ),
                    IdentityNameClaim(
                        value="Hua Hua",
                        language="en",
                        kind="romanized",
                        normalized_forms=("hua hua",),
                    ),
                    IdentityNameClaim(
                        value="ファファ",
                        language="ja",
                        kind="translated",
                        normalized_forms=("hua hua",),
                    ),
                    IdentityNameClaim(
                        value="화화",
                        language="ko",
                        kind="translated",
                        normalized_forms=("hua hua",),
                    ),
                ),
                features=IdentityFeatureSet(
                    birth_year=2020,
                    sex="female",
                    institution_ids=("chengdu-base",),
                    external_identifiers=(
                        IdentityIdentifierClaim(
                            system="institution-profile",
                            value="hua-hua",
                        ),
                    ),
                ),
                population_context=PopulationContext.CAPTIVE,
                evidence=(
                    _evidence(
                        snapshot_id="snapshot-multilingual-hua-hua",
                        body_sha256="a" * 64,
                        field_path="identity.names",
                        raw_value="花花 / Hua Hua / ファファ / 화화",
                        normalized_value=["花花", "Hua Hua", "ファファ", "화화"],
                        language="zh",
                    ),
                    _evidence(
                        snapshot_id="snapshot-multilingual-hua-hua",
                        body_sha256="a" * 64,
                        field_path="identity.birth_year",
                        raw_value="2020年出生",
                        normalized_value=2020,
                        language="zh",
                    ),
                    _evidence(
                        snapshot_id="snapshot-multilingual-hua-hua",
                        body_sha256="a" * 64,
                        field_path="identity.sex",
                        raw_value="雌性",
                        normalized_value="female",
                        language="zh",
                    ),
                    _evidence(
                        snapshot_id="snapshot-multilingual-hua-hua",
                        body_sha256="a" * 64,
                        field_path="identity.institution_ids",
                        raw_value="成都大熊猫繁育研究基地",
                        normalized_value=["chengdu-base"],
                        language="zh",
                    ),
                    _evidence(
                        snapshot_id="snapshot-multilingual-hua-hua",
                        body_sha256="a" * 64,
                        field_path="identity.external_identifiers",
                        raw_value="档案编号 hua-hua",
                        normalized_value={
                            "system": "institution-profile",
                            "value": "hua-hua",
                        },
                        language="zh",
                    ),
                    _evidence(
                        snapshot_id="snapshot-multilingual-hua-hua",
                        body_sha256="a" * 64,
                        field_path="identity.population_context",
                        raw_value="圈养大熊猫",
                        normalized_value="captive",
                        language="zh",
                    ),
                ),
            ),
        )
    )
    unresolved = build_identity_candidate_batch(
        (
            IdentitySubjectExtraction(
                source_id="source-name-only",
                intake_candidate_id="intake-name-only",
                subject_key="article:小雪",
                names=(
                    IdentityNameClaim(
                        value="小雪",
                        language="zh",
                        kind="primary",
                        normalized_forms=("xiao xue",),
                    ),
                ),
                features=IdentityFeatureSet(),
                evidence=(
                    _evidence(
                        snapshot_id="snapshot-name-only",
                        body_sha256="b" * 64,
                        field_path="identity.names",
                        raw_value="小雪",
                        normalized_value="小雪",
                        language="zh",
                    ),
                ),
            ),
        )
    )
    group = build_identity_candidate_batch(
        (
            IdentitySubjectExtraction(
                source_id="source-field-observation",
                intake_candidate_id="intake-field-group",
                subject_key="observation:qinling-group",
                names=(
                    IdentityNameClaim(
                        value="Qinling observation group",
                        language="en",
                        kind="observation-label",
                        normalized_forms=("qinling observation group",),
                    ),
                ),
                features=IdentityFeatureSet(
                    institution_ids=("qinling-field-team",),
                    is_group_observation=True,
                ),
                population_context=PopulationContext.WILD,
                evidence=(
                    _evidence(
                        snapshot_id="snapshot-field-group",
                        body_sha256="c" * 64,
                        field_path="identity.names",
                        raw_value="a group of giant pandas observed in Qinling",
                        normalized_value="Qinling observation group",
                        language="en",
                    ),
                    _evidence(
                        snapshot_id="snapshot-field-group",
                        body_sha256="c" * 64,
                        field_path="identity.group_observation",
                        raw_value="a group of giant pandas",
                        normalized_value=True,
                        language="en",
                    ),
                    _evidence(
                        snapshot_id="snapshot-field-group",
                        body_sha256="c" * 64,
                        field_path="identity.institution_ids",
                        raw_value="Qinling field team",
                        normalized_value=["qinling-field-team"],
                        language="en",
                    ),
                    _evidence(
                        snapshot_id="snapshot-field-group",
                        body_sha256="c" * 64,
                        field_path="identity.population_context",
                        raw_value="wild observation",
                        normalized_value="wild",
                        language="en",
                    ),
                ),
            ),
        )
    )
    return {
        "group-observation.valid.json": group,
        "multilingual.valid.json": multilingual,
        "unresolved-name-only.valid.json": unresolved,
    }


def write_contract_files() -> None:
    SCHEMA_PATH.parent.mkdir(parents=True, exist_ok=True)
    FIXTURE_DIR.mkdir(parents=True, exist_ok=True)
    SCHEMA_PATH.write_text(
        json.dumps(
            IdentityCandidateBatch.model_json_schema(),
            ensure_ascii=False,
            indent=2,
            sort_keys=True,
        )
        + "\n",
        encoding="utf-8",
    )
    for name, fixture in build_fixtures().items():
        (FIXTURE_DIR / name).write_text(
            json.dumps(
                fixture.model_dump(mode="json"),
                ensure_ascii=False,
                indent=2,
                sort_keys=True,
            )
            + "\n",
            encoding="utf-8",
        )


if __name__ == "__main__":
    write_contract_files()

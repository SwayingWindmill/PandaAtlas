from __future__ import annotations

import json
from datetime import UTC, date, datetime
from pathlib import Path

from app.identity_resolution import (
    CanonicalIdentityRecord,
    IdentityCandidateRecord,
    IdentityFeatureSet,
    IdentityNameClaim,
    IdentityResolutionPackage,
    build_identity_resolution_package,
    plan_identity_merge,
    plan_identity_split,
    resolve_identity_batch,
)
from app.knowledge.contracts import PopulationContext

ROOT = Path(__file__).resolve().parents[3]
SCHEMA_PATH = ROOT / "contracts" / "panda-identity-resolution.v1.json"
FIXTURE_DIR = ROOT / "contracts" / "panda-identity-resolution-fixtures" / "v1"
CREATED_AT = datetime(2026, 7, 23, 0, 0, tzinfo=UTC)


def _name(
    value: str,
    language: str,
    *,
    kind: str = "official",
    normalized_forms: tuple[str, ...] = (),
) -> IdentityNameClaim:
    return IdentityNameClaim(
        value=value,
        language=language,
        kind=kind,
        normalized_forms=normalized_forms,
    )


def _canonical(
    panda_id: str,
    slug: str,
    names: tuple[IdentityNameClaim, ...],
    *,
    birth_date: date | None = None,
    birth_year: int | None = None,
    sex: str | None = None,
    parent_ids: tuple[str, ...] = (),
) -> CanonicalIdentityRecord:
    return CanonicalIdentityRecord(
        panda_id=panda_id,
        canonical_slug=slug,
        names=names,
        features=IdentityFeatureSet(
            birth_date=birth_date,
            birth_year=birth_year,
            sex=sex,
            parent_ids=parent_ids,
        ),
        source_ids=(f"source-{panda_id}",),
        population_context=PopulationContext.CAPTIVE,
    )


def _candidate(
    record_id: str,
    names: tuple[IdentityNameClaim, ...],
    *,
    birth_date: date | None = None,
    birth_year: int | None = None,
    sex: str | None = None,
    parent_ids: tuple[str, ...] = (),
    institution_ids: tuple[str, ...] = (),
) -> IdentityCandidateRecord:
    return IdentityCandidateRecord(
        record_id=record_id,
        names=names,
        features=IdentityFeatureSet(
            birth_date=birth_date,
            birth_year=birth_year,
            sex=sex,
            parent_ids=parent_ids,
            institution_ids=institution_ids,
        ),
        source_ids=(f"source-{record_id}",),
        population_context=PopulationContext.CAPTIVE,
    )


def _package(
    fixture_id: str,
    canonical_records: tuple[CanonicalIdentityRecord, ...],
    candidate_records: tuple[IdentityCandidateRecord, ...],
) -> IdentityResolutionPackage:
    batch = resolve_identity_batch(
        batch_id=f"identity-batch-{fixture_id}",
        created_at=CREATED_AT,
        canonical_records=canonical_records,
        candidate_records=candidate_records,
    )
    return build_identity_resolution_package(batch)


def build_fixtures() -> dict[str, IdentityResolutionPackage]:
    canonical = _canonical(
        "panda-xing-xing",
        "xing-xing",
        (
            _name("星星", "zh-CN"),
            _name("Xing Xing", "en", kind="romanized"),
            _name("シンシン", "ja", kind="translated", normalized_forms=("xingxing",)),
            _name("新星", "zh-CN", kind="historical"),
        ),
        birth_year=2017,
        parent_ids=("parent-a",),
    )
    exact = _package(
        "exact",
        (canonical,),
        (_candidate("exact", (_name("星星", "zh-CN"),), birth_year=2017),),
    )
    alias = _package(
        "alias",
        (canonical,),
        (_candidate("alias", (_name("Xing-Xing", "en"),), parent_ids=("parent-a",)),),
    )
    translated = _package(
        "translated-name",
        (canonical,),
        (
            _candidate(
                "translated-name",
                (_name("싱싱", "ko", normalized_forms=("xingxing",)),),
                birth_year=2017,
            ),
        ),
    )
    changed = _package(
        "changed-name",
        (canonical,),
        (
            _candidate(
                "changed-name",
                (_name("新星", "zh-CN", kind="historical"),),
                birth_year=2017,
            ),
        ),
    )
    same_name = _package(
        "same-name-different-panda",
        (
            _canonical(
                "panda-le-le-old",
                "le-le-old",
                (_name("乐乐", "zh-CN"),),
                birth_date=date(2005, 8, 8),
                sex="male",
            ),
        ),
        (
            _candidate(
                "le-le-young",
                (_name("乐乐", "zh-CN"),),
                birth_date=date(2020, 7, 21),
                sex="female",
                institution_ids=("institution-b",),
            ),
        ),
    )
    unresolved = _package(
        "unresolved-name-only",
        (canonical,),
        (_candidate("name-only", (_name("星星", "zh-CN"),)),),
    )

    before_a = _canonical(
        "panda-a",
        "xing-xing-old",
        (_name("星星", "zh-CN"),),
        birth_year=2017,
    )
    before_b = _canonical(
        "panda-b",
        "xing-xing-copy",
        (_name("Xing Xing", "en"),),
        birth_year=2017,
    )
    merged = _canonical(
        "panda-a",
        "xing-xing",
        (_name("星星", "zh-CN"), _name("Xing Xing", "en")),
        birth_year=2017,
    )
    operation_batch = resolve_identity_batch(
        batch_id="identity-batch-operations",
        created_at=CREATED_AT,
        canonical_records=(merged,),
        candidate_records=(),
    )
    merge = build_identity_resolution_package(
        operation_batch,
        changesets=(
            plan_identity_merge(
                operation_id="merge-a-b",
                before_records=(before_a, before_b),
                merged_record=merged,
                decided_at=CREATED_AT,
                actor="identity-reviewer",
                evidence=("duplicate identity evidence",),
            ),
        ),
    )
    split = build_identity_resolution_package(
        operation_batch,
        changesets=(
            plan_identity_split(
                operation_id="split-a-b",
                before_record=merged,
                split_records=(before_a, before_b),
                decided_at=CREATED_AT,
                actor="identity-reviewer",
                evidence=("corrected identity evidence",),
            ),
        ),
    )
    return {
        "alias.valid.json": alias,
        "changed-name.valid.json": changed,
        "exact.valid.json": exact,
        "merge.valid.json": merge,
        "same-name-different-panda.valid.json": same_name,
        "split.valid.json": split,
        "translated-name.valid.json": translated,
        "unresolved-name-only.valid.json": unresolved,
    }


def write_contract_files() -> None:
    SCHEMA_PATH.parent.mkdir(parents=True, exist_ok=True)
    FIXTURE_DIR.mkdir(parents=True, exist_ok=True)
    SCHEMA_PATH.write_text(
        json.dumps(
            IdentityResolutionPackage.model_json_schema(),
            ensure_ascii=False,
            indent=2,
            sort_keys=True,
        )
        + "\n",
        encoding="utf-8",
    )
    for name, package in build_fixtures().items():
        (FIXTURE_DIR / name).write_text(
            json.dumps(
                package.model_dump(mode="json"),
                ensure_ascii=False,
                indent=2,
                sort_keys=True,
            )
            + "\n",
            encoding="utf-8",
        )


if __name__ == "__main__":
    write_contract_files()

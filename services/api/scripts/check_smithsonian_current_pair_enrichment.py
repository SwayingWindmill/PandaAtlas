from __future__ import annotations

import argparse
import tempfile
from collections import Counter
from datetime import UTC, date, datetime, timedelta
from pathlib import Path

from app.acquisition import bundles as bundle_io
from app.acquisition.adapters import DEFAULT_ADAPTER_REGISTRY
from app.acquisition.contracts import (
    AcquisitionBundle,
    AcquisitionMode,
    FieldCandidate,
    canonical_json_bytes,
)
from app.acquisition.curation import (
    load_acquisition_bundle,
    load_decision_log,
    write_curation_patch,
)
from app.acquisition.reconciliation import CurationPanda, load_reconciliation_snapshot
from app.acquisition.runner import AdapterRunRequest, run_adapter
from app.acquisition.smithsonian_pandas import ADAPTER_ID, SOURCE_ID
from app.enrichment import (
    SmithsonianCurrentPairCohort,
    build_smithsonian_current_pair_cohort,
    build_smithsonian_current_pair_curation_review_plan,
    export_smithsonian_current_pair_curation_patch,
    write_smithsonian_curation_review_plan,
)
from app.identity_resolution import (
    CanonicalIdentityRecord,
    IdentityFeatureSet,
    IdentityIdentifierClaim,
    IdentityNameClaim,
)
from app.knowledge.contracts import (
    ConfidenceBand,
    SourceAccessBasis,
    SourceAssessment,
    SourceEvidence,
    SourceKind,
)

_SELECTED_SLUGS = ("bao-li", "qing-bao")
_NOW = datetime(2026, 7, 23, 18, 0, tzinfo=UTC)
_GENERATOR_VERSION = "smithsonian-bilingual-summary/v1"


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Validate the Smithsonian current-pair fixture enrichment path and optionally "
            "compare one reviewed live acquisition bundle with the fixture at semantic, "
            "fact, conclusion, and bilingual-output layers."
        )
    )
    parser.add_argument(
        "--live-bundle",
        type=Path,
        help=(
            "Existing live AcquisitionBundle below .acquisition/bundles. The script does not "
            "perform network requests."
        ),
    )
    parser.add_argument(
        "--review-plan-output",
        type=Path,
        help=(
            "Write the zero-write current-pair curator review plan below "
            ".acquisition/review-plans. Requires --live-bundle."
        ),
    )
    parser.add_argument(
        "--overwrite-review-plan",
        action="store_true",
        help="Replace an existing local Smithsonian review-plan artifact.",
    )
    parser.add_argument(
        "--decisions",
        type=Path,
        help=(
            "Completed curator decision log below .acquisition/decisions. Requires "
            "--live-bundle and --patch-output."
        ),
    )
    parser.add_argument(
        "--patch-output",
        type=Path,
        help=(
            "Write the review-only curation patch below .acquisition/curation-patches. "
            "Requires --decisions."
        ),
    )
    parser.add_argument(
        "--overwrite-patch",
        action="store_true",
        help="Replace an existing local Smithsonian curation-patch artifact.",
    )
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> None:
    args = parse_args(argv)
    if args.review_plan_output is not None and args.live_bundle is None:
        raise ValueError("--review-plan-output requires --live-bundle")
    if (args.decisions is None) != (args.patch_output is None):
        raise ValueError("--decisions and --patch-output must be supplied together")
    if args.decisions is not None and args.live_bundle is None:
        raise ValueError("--decisions and --patch-output require --live-bundle")

    canonical_records, canonical_source = _canonical_inputs()
    fixture = _run_fixture()
    fixture_cohort = _build_cohort(
        fixture,
        canonical_records=canonical_records,
        canonical_source=canonical_source,
        created_at=_NOW + timedelta(minutes=5),
        generated_at=_NOW + timedelta(minutes=10),
    )

    result = _cohort_summary(fixture_cohort)
    result["fixture_bundle_id"] = fixture.bundle_id
    if args.live_bundle is not None:
        live = load_acquisition_bundle(args.live_bundle)
        if live.run.mode is not AcquisitionMode.LIVE:
            raise ValueError("--live-bundle must reference a live acquisition bundle")
        live_completed_at = live.run.completed_at or live.run.started_at
        live_cohort = _build_cohort(
            live,
            canonical_records=canonical_records,
            canonical_source=canonical_source,
            created_at=live_completed_at,
            generated_at=live_completed_at + timedelta(minutes=5),
        )
        _assert_semantic_replay(
            fixture=fixture,
            live=live,
            fixture_cohort=fixture_cohort,
            live_cohort=live_cohort,
        )
        result.update(
            {
                "live_bundle_id": live.bundle_id,
                "live_run_id": live.run.run_id,
                "acquisition_semantics_equal": True,
                "partition_semantics_equal": True,
                "fact_semantics_equal": True,
                "conclusion_semantics_equal": True,
                "bilingual_semantics_equal": True,
                "evidence": _evidence_comparison(fixture, live),
            }
        )
        if args.review_plan_output is not None:
            review_created_at = datetime.now(UTC)
            review_plan = build_smithsonian_current_pair_curation_review_plan(
                live_cohort,
                created_at=review_created_at,
            )
            review_path = write_smithsonian_curation_review_plan(
                review_plan,
                args.review_plan_output,
                overwrite=args.overwrite_review_plan,
            )
            result.update(
                {
                    "review_plan_id": review_plan.plan_id,
                    "review_plan_output": str(review_path),
                    "review_recommendation_counts": (review_plan.recommendation_counts()),
                    "review_out_of_scope_count": len(review_plan.out_of_scope_candidate_ids),
                }
            )
        if args.decisions is not None and args.patch_output is not None:
            decision_log = load_decision_log(args.decisions)
            patch_created_at = max(datetime.now(UTC), decision_log.updated_at)
            patch = export_smithsonian_current_pair_curation_patch(
                live_cohort,
                decision_log,
                created_at=patch_created_at,
            )
            patch_path = write_curation_patch(
                patch,
                args.patch_output,
                overwrite=args.overwrite_patch,
            )
            result.update(
                {
                    "curation_patch_id": patch.patch_id,
                    "curation_patch_output": str(patch_path),
                    "curation_patch_proposal_counts": patch.proposal_counts(),
                    "curation_patch_source_evidence_count": len(patch.sources),
                }
            )
    print(result)


def _canonical_inputs() -> tuple[tuple[CanonicalIdentityRecord, ...], SourceEvidence]:
    snapshot = load_reconciliation_snapshot()
    canonical_source_id = f"curation-{snapshot.snapshot_id}"
    records = tuple(
        _canonical_record(snapshot.pandas_by_slug[slug], source_id=canonical_source_id)
        for slug in _SELECTED_SLUGS
    )
    source = _canonical_source(
        source_id=canonical_source_id,
        snapshot_id=snapshot.snapshot_id,
    )
    return records, source


def _run_fixture() -> AcquisitionBundle:
    acquisition_root = Path(".acquisition")
    acquisition_root.mkdir(exist_ok=True)
    original_root = bundle_io.LOCAL_BUNDLE_ROOT
    try:
        with tempfile.TemporaryDirectory(
            prefix="issue-131-smithsonian-current-pair-",
            dir=acquisition_root,
        ) as temporary:
            bundle_io.LOCAL_BUNDLE_ROOT = Path(temporary) / "bundles"
            return run_adapter(
                AdapterRunRequest(
                    source_id=SOURCE_ID,
                    adapter_id=ADAPTER_ID,
                    mode=AcquisitionMode.FIXTURE,
                    cohort="issue-131-current-pair",
                    output_bundle="smithsonian-current-pair.json",
                    overwrite=True,
                ),
                adapter_registry=DEFAULT_ADAPTER_REGISTRY,
                clock=lambda: _NOW,
                sleeper=lambda _seconds: None,
            ).bundle
    finally:
        bundle_io.LOCAL_BUNDLE_ROOT = original_root


def _build_cohort(
    acquisition: AcquisitionBundle,
    *,
    canonical_records: tuple[CanonicalIdentityRecord, ...],
    canonical_source: SourceEvidence,
    created_at: datetime,
    generated_at: datetime,
) -> SmithsonianCurrentPairCohort:
    return build_smithsonian_current_pair_cohort(
        acquisition_bundle=acquisition,
        canonical_records=canonical_records,
        canonical_sources=(canonical_source,),
        created_at=created_at,
        generated_at=generated_at,
        generator_version=_GENERATOR_VERSION,
    )


def _assert_semantic_replay(
    *,
    fixture: AcquisitionBundle,
    live: AcquisitionBundle,
    fixture_cohort: SmithsonianCurrentPairCohort,
    live_cohort: SmithsonianCurrentPairCohort,
) -> None:
    checks = (
        (
            "acquisition candidate semantics",
            _candidate_projection(fixture.candidates),
            _candidate_projection(live.candidates),
        ),
        (
            "selected partition semantics",
            _partition_projection(fixture_cohort, fixture_cohort.selected_candidate_ids),
            _partition_projection(live_cohort, live_cohort.selected_candidate_ids),
        ),
        (
            "deferred partition semantics",
            _partition_projection(fixture_cohort, fixture_cohort.deferred_candidate_ids),
            _partition_projection(live_cohort, live_cohort.deferred_candidate_ids),
        ),
        (
            "out-of-scope partition semantics",
            _partition_projection(fixture_cohort, fixture_cohort.out_of_scope_candidate_ids),
            _partition_projection(live_cohort, live_cohort.out_of_scope_candidate_ids),
        ),
        (
            "fact semantics",
            _fact_projection(fixture_cohort),
            _fact_projection(live_cohort),
        ),
        (
            "conclusion semantics",
            _conclusion_projection(fixture_cohort),
            _conclusion_projection(live_cohort),
        ),
        (
            "bilingual normalized-value semantics",
            _normalized_value_projection(fixture_cohort),
            _normalized_value_projection(live_cohort),
        ),
        (
            "bilingual sentence semantics",
            _sentence_projection(fixture_cohort),
            _sentence_projection(live_cohort),
        ),
        (
            "translation semantics",
            _translation_projection(fixture_cohort),
            _translation_projection(live_cohort),
        ),
    )
    for label, expected, actual in checks:
        if expected != actual:
            raise ValueError(f"Smithsonian live replay drifted in {label}")


def _candidate_projection(candidates: tuple[FieldCandidate, ...]) -> tuple[tuple[str, ...], ...]:
    return tuple(sorted(_candidate_semantics(candidate) for candidate in candidates))


def _candidate_semantics(candidate: FieldCandidate) -> tuple[str, ...]:
    return (
        candidate.subject_key,
        candidate.identity_match.matched_canonical_slug or "",
        candidate.candidate_kind.value,
        candidate.field_path,
        _json_text(candidate.raw_value),
        _json_text(candidate.normalized_value),
        candidate.conflict_state.value,
        _json_text(candidate.current_trusted_value.to_dict()),
        candidate.parser_name,
        candidate.parser_version,
    )


def _partition_projection(
    cohort: SmithsonianCurrentPairCohort,
    candidate_ids: tuple[str, ...],
) -> tuple[tuple[str, ...], ...]:
    by_id = {
        candidate.candidate_id: candidate for candidate in cohort.acquisition_bundle.candidates
    }
    return tuple(
        sorted(_candidate_semantics(by_id[candidate_id]) for candidate_id in candidate_ids)
    )


def _record_slug_map(cohort: SmithsonianCurrentPairCohort) -> dict[str, str]:
    result: dict[str, str] = {}
    for record in cohort.fact_enrichment.knowledge_bundle.records:
        slug = record.identity.canonical_slug
        if slug is None:
            raise ValueError("Smithsonian replay comparison requires canonical record slugs")
        result[record.identity.identity_key] = slug
    return result


def _fact_projection(cohort: SmithsonianCurrentPairCohort) -> tuple[tuple[str, ...], ...]:
    slug_by_record = _record_slug_map(cohort)
    return tuple(
        sorted(
            (
                slug_by_record[fact.record_id],
                fact.field_path,
                _json_text(fact.raw_value),
                _json_text(fact.normalized_value),
                fact.language,
                fact.confidence.value,
                fact.publication_scope.value,
                fact.evidence_mode.value,
                fact.qualifier.value if fact.qualifier is not None else "",
                fact.lifecycle.value,
                fact.parser_name,
                fact.parser_version,
            )
            for fact in cohort.fact_enrichment.facts
        )
    )


def _conclusion_projection(
    cohort: SmithsonianCurrentPairCohort,
) -> tuple[tuple[str, ...], ...]:
    rows: list[tuple[str, ...]] = []
    for record in cohort.fact_enrichment.knowledge_bundle.records:
        slug = record.identity.canonical_slug
        if slug is None:
            raise ValueError("Smithsonian replay comparison requires canonical record slugs")
        assertion_values = {
            assertion.assertion_id: _json_text(assertion.normalized_value)
            for assertion in record.assertions
        }
        for conclusion in record.conclusions:
            primary = (
                assertion_values[conclusion.primary_assertion_id]
                if conclusion.primary_assertion_id is not None
                else ""
            )
            alternatives = tuple(
                sorted(assertion_values[item] for item in conclusion.alternative_assertion_ids)
            )
            rows.append(
                (
                    slug,
                    conclusion.field_path,
                    conclusion.status.value,
                    primary,
                    _json_text(list(alternatives)),
                )
            )
    return tuple(sorted(rows))


def _normalized_value_projection(
    cohort: SmithsonianCurrentPairCohort,
) -> tuple[tuple[str, ...], ...]:
    slug_by_record = _record_slug_map(cohort)
    return tuple(
        sorted(
            (
                slug_by_record[value.record_id],
                value.field_path,
                value.source_language,
                value.zh_text,
                value.en_text,
            )
            for value in cohort.bilingual_summary.normalized_values
        )
    )


def _sentence_projection(
    cohort: SmithsonianCurrentPairCohort,
) -> tuple[tuple[str, ...], ...]:
    slug_by_record = _record_slug_map(cohort)
    return tuple(
        sorted(
            (
                slug_by_record[sentence.record_id],
                sentence.field_path,
                sentence.source_language,
                sentence.zh_text,
                sentence.en_text,
            )
            for sentence in cohort.bilingual_summary.sentences
        )
    )


def _translation_projection(
    cohort: SmithsonianCurrentPairCohort,
) -> tuple[tuple[str, ...], ...]:
    rows: list[tuple[str, ...]] = []
    for record in cohort.bilingual_summary.knowledge_bundle.records:
        slug = record.identity.canonical_slug
        if slug is None:
            raise ValueError("Smithsonian replay comparison requires canonical record slugs")
        rows.extend(
            (
                slug,
                translation.subject_type,
                translation.locale,
                translation.text,
                translation.status.value,
                translation.source_language,
                translation.generator_version or "",
            )
            for translation in record.translations
        )
    return tuple(sorted(rows))


def _evidence_comparison(
    fixture: AcquisitionBundle,
    live: AcquisitionBundle,
) -> list[dict[str, object]]:
    fixture_by_url = {snapshot.requested_url: snapshot for snapshot in fixture.evidence_snapshots}
    live_by_url = {snapshot.requested_url: snapshot for snapshot in live.evidence_snapshots}
    if set(fixture_by_url) != set(live_by_url):
        raise ValueError("Smithsonian live replay request URL set drifted from fixture")
    return [
        {
            "url": url,
            "fixture_body_bytes": fixture_by_url[url].body_bytes,
            "live_body_bytes": live_by_url[url].body_bytes,
            "fixture_body_sha256": fixture_by_url[url].body_sha256,
            "live_body_sha256": live_by_url[url].body_sha256,
            "body_hash_changed": (fixture_by_url[url].body_sha256 != live_by_url[url].body_sha256),
            "http_status": live_by_url[url].status,
            "block_state": live_by_url[url].block_state.value,
        }
        for url in sorted(fixture_by_url)
    ]


def _cohort_summary(cohort: SmithsonianCurrentPairCohort) -> dict[str, object]:
    field_counts = Counter(
        assertion.field_path
        for record in cohort.fact_enrichment.knowledge_bundle.records
        for assertion in record.assertions
    )
    decision_counts = Counter(
        decision.kind.value for decision in cohort.identity_resolution.decisions
    )
    return {
        "acquisition_candidate_count": len(cohort.acquisition_bundle.candidates),
        "selected_slugs": list(cohort.selected_slugs),
        "selected_candidate_count": len(cohort.selected_candidate_ids),
        "deferred_candidate_count": len(cohort.deferred_candidate_ids),
        "out_of_scope_candidate_count": len(cohort.out_of_scope_candidate_ids),
        "identity_decisions": dict(sorted(decision_counts.items())),
        "fact_assertion_count": sum(field_counts.values()),
        "fact_fields": dict(sorted(field_counts.items())),
        "summary_sentence_count": len(cohort.bilingual_summary.sentences),
        "translation_count": sum(
            len(record.translations) for record in cohort.bilingual_summary.knowledge_bundle.records
        ),
        "write_boundary": cohort.write_boundary,
    }


def _json_text(value: object) -> str:
    return canonical_json_bytes(value).decode("utf-8")


def _canonical_record(
    panda: CurationPanda,
    *,
    source_id: str,
) -> CanonicalIdentityRecord:
    names: list[IdentityNameClaim] = [
        IdentityNameClaim(
            value=panda.name_en,
            language="en",
            kind="official",
            normalized_forms=(panda.name_en.casefold(),),
        )
    ]
    if panda.name_zh:
        names.append(
            IdentityNameClaim(
                value=panda.name_zh,
                language="zh-Hans",
                kind="official",
            )
        )
    for alias in panda.aliases:
        if alias.casefold() == panda.name_en.casefold():
            continue
        names.append(
            IdentityNameClaim(
                value=alias,
                language="und",
                kind="alias",
            )
        )
    name_keys: set[tuple[str, str, str]] = set()
    unique_names: list[IdentityNameClaim] = []
    for name in names:
        key = (name.language.casefold(), name.kind.casefold(), name.value.casefold())
        if key in name_keys:
            continue
        name_keys.add(key)
        unique_names.append(name)

    birth_date = (
        date.fromisoformat(panda.birth_date)
        if panda.birth_date is not None and panda.birth_date_precision == "day"
        else None
    )
    parent_ids = tuple(sorted(value for value in (panda.father_slug, panda.mother_slug) if value))
    identifiers = tuple(
        sorted(
            (
                IdentityIdentifierClaim(system=system, value=value)
                for system, value in panda.external_identifiers
            ),
            key=lambda item: (item.system.casefold(), item.value.casefold()),
        )
    )
    return CanonicalIdentityRecord(
        panda_id=panda.stable_id or panda.canonical_slug,
        canonical_slug=panda.canonical_slug,
        names=tuple(unique_names),
        features=IdentityFeatureSet(
            birth_date=birth_date,
            sex=panda.gender if panda.gender in {"male", "female"} else None,
            parent_ids=parent_ids,
            external_identifiers=identifiers,
        ),
        source_ids=(source_id,),
    )


def _canonical_source(*, source_id: str, snapshot_id: str) -> SourceEvidence:
    return SourceEvidence(
        source_id=source_id,
        kind=SourceKind.MATURE_DATABASE,
        access_basis=SourceAccessBasis.PUBLIC,
        publisher="Panda Atlas reviewed curation",
        title=f"Reviewed reconciliation snapshot {snapshot_id}",
        url="https://github.com/SwayingWindmill/PandaAtlas",
        original_language="und",
        captured_at=_NOW,
        is_first_hand=False,
        assessment=SourceAssessment(
            confidence=ConfidenceBand.HIGH,
            authority_score=90,
            recency_score=90,
            specificity_score=100,
            consistency_score=100,
            corroboration_score=90,
            rationale=("content-addressed-reviewed-curation-snapshot",),
        ),
    )


if __name__ == "__main__":
    main()

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import os
import shutil
import tempfile
from dataclasses import dataclass
from pathlib import Path
from typing import Any

REPO_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_RELEASE = "2026.07.24.2"
DEFAULT_CURATION_DIR = REPO_ROOT / "data" / "curation" / "pandas"
DEFAULT_OVERRIDES = REPO_ROOT / "data" / "media-library" / "selection-overrides.json"
DEFAULT_OUTPUT_ROOT = REPO_ROOT / "data" / "media-library" / "releases"
OPEN_RIGHTS_STATES = {"open_license", "public_domain", "explicit_authorization"}
COLLECTION_REVIEW_STATES = {"approved", "collection_only"}


class MediaLibraryError(RuntimeError):
    pass


@dataclass(frozen=True)
class BuildResult:
    candidates: dict[str, Any]
    selections: dict[str, Any]
    coverage: dict[str, Any]
    manifest: dict[str, Any]


def canonical_json(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))


def pretty_json(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, sort_keys=True, indent=2) + "\n"


def sha256_bytes(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def sha256_text(value: str) -> str:
    return sha256_bytes(value.encode("utf-8"))


def sha256_normalized_text(path: Path) -> str:
    text = path.read_text(encoding="utf-8-sig")
    normalized = text.replace("\r\n", "\n").replace("\r", "\n")
    return sha256_text(normalized)


def read_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def read_csv(path: Path) -> list[dict[str, str]]:
    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        return [dict(row) for row in csv.DictReader(handle)]


def candidate_id(row: dict[str, str]) -> str:
    identity = "\0".join(
        [row["panda_slug"].strip(), row["source_url"].strip(), row["asset"].strip()]
    )
    return f"media-candidate-{sha256_text(identity)[:24]}"


def classify_rights(rights: str) -> tuple[str, float, str]:
    normalized = rights.strip().lower()
    if normalized in {"public domain", "cc0", "cc0 1.0"}:
        return "public_domain", 0.99, "recognized-public-domain-label"
    if normalized.startswith("cc by") or normalized.startswith("cc-by"):
        return "open_license", 0.99, "recognized-creative-commons-label"
    if normalized.startswith("explicit authorization"):
        return "explicit_authorization", 0.95, "explicit-authorization-label"
    if normalized == "all rights reserved":
        return "restricted", 0.99, "recognized-restricted-rights-label"
    return "unknown", 0.20, "unrecognized-rights-label"


def classify_identity(row: dict[str, str]) -> tuple[float, str]:
    text = " ".join([row.get("notes", ""), row.get("alt_en", ""), row.get("alt_zh", "")]).lower()
    if "probable" in text or "not fully confident" in text or "疑似" in text:
        return 0.65, "probable-individual-identification"
    if "cohort photograph only" in text or "属于该批次" in text:
        return 0.55, "cohort-association-without-position-identification"
    return 0.95, "reviewed-individual-or-explicit-group-identification"


def delivery_objects(media: dict[str, Any]) -> list[dict[str, Any]]:
    values: dict[str, dict[str, Any]] = {}
    if media.get("url") and media.get("sha256") and media.get("bytes"):
        values[media["url"]] = {
            "url": media["url"],
            "sha256": media["sha256"],
            "bytes": media["bytes"],
            "width": media.get("width"),
            "height": media.get("height"),
            "mime_type": media.get("mime_type"),
            "kind": "primary",
        }
    for derivative in media.get("derivatives", []):
        values[derivative["url"]] = {
            "url": derivative["url"],
            "sha256": derivative["sha256"],
            "bytes": derivative["bytes"],
            "width": derivative["width"],
            "height": derivative["height"],
            "mime_type": derivative["mime_type"],
            "kind": derivative["kind"],
        }
    return sorted(values.values(), key=lambda item: (item.get("width") or 0, item["url"]))


def primary_delivery(delivery: list[dict[str, Any]]) -> dict[str, Any] | None:
    if not delivery:
        return None
    return max(delivery, key=lambda item: (item.get("width") or 0, item["bytes"], item["url"]))


def quality_score(delivery: list[dict[str, Any]], identity_confidence: float) -> float:
    primary = primary_delivery(delivery)
    if primary is None:
        return 0.0
    resolution = min((primary.get("width") or 0) / 1200, 1.0)
    return round((0.70 * resolution) + (0.30 * identity_confidence), 4)


def scope_score(candidate: dict[str, Any], scope: str) -> float:
    recency = 0.5
    if scope == "public_open":
        return round(
            0.45 * candidate["identity_confidence"]
            + 0.25 * candidate["rights_confidence"]
            + 0.25 * candidate["quality_score"]
            + 0.05 * recency,
            6,
        )
    return round(
        0.50 * candidate["identity_confidence"]
        + 0.15 * candidate["rights_confidence"]
        + 0.30 * candidate["quality_score"]
        + 0.05 * recency,
        6,
    )


def eligible(candidate: dict[str, Any], scope: str) -> tuple[bool, list[str]]:
    reasons: list[str] = []
    if not candidate["delivery"]:
        reasons.append("no-processed-delivery")
    if candidate["withdrawn"]:
        reasons.append("withdrawn")
    if candidate["identity_confidence"] < 0.50:
        reasons.append("identity-confidence-below-collection-threshold")
    if scope == "public_open":
        if candidate["review_state"] != "approved":
            reasons.append("not-approved-for-open-publication")
        if candidate["rights_state"] not in OPEN_RIGHTS_STATES:
            reasons.append("rights-not-open-or-authorized")
        if candidate["identity_confidence"] < 0.85:
            reasons.append("identity-confidence-below-open-threshold")
        if candidate["rights_confidence"] < 0.90:
            reasons.append("rights-confidence-below-open-threshold")
    else:
        if candidate["review_state"] not in COLLECTION_REVIEW_STATES:
            reasons.append("not-reviewed-for-collection")
        if candidate["rights_state"] == "unknown":
            reasons.append("rights-state-unknown")
    return not reasons, reasons


def load_overrides(path: Path) -> dict[str, Any]:
    if not path.exists():
        return {"schema_version": 1, "reviewed_at": None, "overrides": []}
    payload = read_json(path)
    if payload.get("schema_version") != 1 or not isinstance(payload.get("overrides"), list):
        raise MediaLibraryError("Media selection overrides must use schema_version 1")
    return payload


def media_lookup(api_payload: dict[str, Any]) -> dict[tuple[str, str], dict[str, Any]]:
    result: dict[tuple[str, str], dict[str, Any]] = {}
    for panda in api_payload.get("pandas", []):
        for media in panda.get("media", []):
            if media.get("status") != "available":
                continue
            key = (panda["slug"], media.get("source_url", ""))
            if key in result:
                raise MediaLibraryError(f"Multiple available media records share {key}")
            result[key] = media
    return result


def build_candidates(
    media_rows: list[dict[str, str]], api_payload: dict[str, Any], released_at: str
) -> list[dict[str, Any]]:
    lookup = media_lookup(api_payload)
    candidates: list[dict[str, Any]] = []
    for row in media_rows:
        rights_state, rights_confidence, rights_basis = classify_rights(row["rights"])
        identity_confidence, identity_basis = classify_identity(row)
        media = lookup.get((row["panda_slug"], row["source_url"]))
        delivery = delivery_objects(media) if media else []
        primary = primary_delivery(delivery)
        candidate = {
            "candidate_id": candidate_id(row),
            "panda_slug": row["panda_slug"],
            "asset_url": row["asset"],
            "source_url": row["source_url"],
            "credit": row["credit"],
            "rights_label": row["rights"],
            "rights_state": rights_state,
            "rights_confidence": rights_confidence,
            "rights_basis": rights_basis,
            "identity_confidence": identity_confidence,
            "identity_basis": identity_basis,
            "quality_score": quality_score(delivery, identity_confidence),
            "review_state": row["review_status"],
            "discovered_at": released_at,
            "captured_at": None,
            "delivery": delivery,
            "primary_delivery_sha256": primary["sha256"] if primary else None,
            "duplicate_group_id": (
                f"delivery-sha256-{primary['sha256']}" if primary else None
            ),
            "withdrawn": False,
            "withdrawal_reason": None,
            "alt_zh": row["alt_zh"],
            "alt_en": row["alt_en"],
            "notes": row["notes"],
        }
        candidate["scope_eligibility"] = {}
        for scope in ("private_collection", "public_open"):
            allowed, reasons = eligible(candidate, scope)
            candidate["scope_eligibility"][scope] = {
                "eligible": allowed,
                "reasons": reasons,
                "score": scope_score(candidate, scope) if allowed else None,
            }
        candidates.append(candidate)
    candidates.sort(key=lambda item: (item["panda_slug"], item["candidate_id"]))
    return candidates


def apply_withdrawals(
    candidates: list[dict[str, Any]], overrides: dict[str, Any]
) -> dict[tuple[str, str], str]:
    selections: dict[tuple[str, str], str] = {}
    by_id = {candidate["candidate_id"]: candidate for candidate in candidates}
    for override in overrides["overrides"]:
        action = override.get("action")
        scope = override.get("scope")
        candidate = by_id.get(override.get("candidate_id"))
        if candidate is None:
            unknown_id = override.get("candidate_id")
            raise MediaLibraryError(f"Override references unknown candidate {unknown_id}")
        if action == "withdraw":
            candidate["withdrawn"] = True
            candidate["withdrawal_reason"] = override.get("reason") or "administrator-withdrawal"
            for candidate_scope in ("private_collection", "public_open"):
                allowed, reasons = eligible(candidate, candidate_scope)
                candidate["scope_eligibility"][candidate_scope] = {
                    "eligible": allowed,
                    "reasons": reasons,
                    "score": scope_score(candidate, candidate_scope) if allowed else None,
                }
        elif action == "select":
            if scope not in {"private_collection", "public_open"}:
                raise MediaLibraryError("Selection override requires a valid scope")
            allowed = candidate["scope_eligibility"][scope]["eligible"]
            if not allowed:
                candidate_id_value = candidate["candidate_id"]
                raise MediaLibraryError(
                    f"Override cannot select ineligible candidate "
                    f"{candidate_id_value} for {scope}"
                )
            selections[(scope, candidate["panda_slug"])] = candidate["candidate_id"]
        else:
            raise MediaLibraryError(f"Unsupported media override action: {action}")
    return selections


def build_scope_selection(
    candidates: list[dict[str, Any]], scope: str, forced: dict[tuple[str, str], str]
) -> list[dict[str, Any]]:
    by_panda: dict[str, list[dict[str, Any]]] = {}
    for candidate in candidates:
        if candidate["scope_eligibility"][scope]["eligible"]:
            by_panda.setdefault(candidate["panda_slug"], []).append(candidate)

    output: list[dict[str, Any]] = []
    for panda_slug, values in sorted(by_panda.items()):
        values.sort(
            key=lambda item: (
                -item["scope_eligibility"][scope]["score"],
                item["candidate_id"],
            )
        )
        deduplicated: list[dict[str, Any]] = []
        seen_groups: set[str] = set()
        for candidate in values:
            group = candidate["duplicate_group_id"] or candidate["candidate_id"]
            if group in seen_groups:
                continue
            seen_groups.add(group)
            deduplicated.append(candidate)
        forced_id = forced.get((scope, panda_slug))
        if forced_id:
            selected = next(item for item in deduplicated if item["candidate_id"] == forced_id)
            deduplicated.remove(selected)
            deduplicated.insert(0, selected)
        output.append(
            {
                "panda_slug": panda_slug,
                "main_candidate_id": deduplicated[0]["candidate_id"],
                "gallery_candidate_ids": [item["candidate_id"] for item in deduplicated],
                "selection_reason": (
                    "administrator-override" if forced_id else "deterministic-score"
                ),
                "scores": {
                    item["candidate_id"]: item["scope_eligibility"][scope]["score"]
                    for item in deduplicated
                },
            }
        )
    return output


def build(
    release_version: str = DEFAULT_RELEASE,
    curation_dir: Path = DEFAULT_CURATION_DIR,
    overrides_path: Path = DEFAULT_OVERRIDES,
) -> BuildResult:
    release_dir = REPO_ROOT / "data" / "public-releases" / release_version
    manifest = read_json(release_dir / "manifest.json")
    api_payload = read_json(release_dir / "api.json")
    media_rows = read_csv(curation_dir / "media.csv")
    panda_rows = read_csv(curation_dir / "pandas.csv")
    overrides = load_overrides(overrides_path)
    released_at = manifest["released_at"]

    candidates = build_candidates(media_rows, api_payload, released_at)
    forced = apply_withdrawals(candidates, overrides)
    private_selection = build_scope_selection(candidates, "private_collection", forced)
    public_selection = build_scope_selection(candidates, "public_open", forced)

    candidate_payload = {
        "schema_version": 1,
        "library": "internal_media_candidates",
        "dataset_release_version": release_version,
        "generated_at": released_at,
        "candidate_count": len(candidates),
        "candidates": candidates,
    }
    selection_payload = {
        "schema_version": 1,
        "dataset_release_version": release_version,
        "generated_at": released_at,
        "overrides_reviewed_at": overrides.get("reviewed_at"),
        "scopes": {
            "private_collection": {
                "policy": "reviewed collection media with known rights state",
                "selections": private_selection,
            },
            "public_open": {
                "policy": (
                    "approved identity plus open license, public domain, "
                    "or explicit authorization"
                ),
                "selections": public_selection,
            },
        },
    }

    candidate_by_panda: dict[str, list[dict[str, Any]]] = {}
    for candidate in candidates:
        candidate_by_panda.setdefault(candidate["panda_slug"], []).append(candidate)
    private_by_panda = {item["panda_slug"]: item for item in private_selection}
    public_by_panda = {item["panda_slug"]: item for item in public_selection}
    records = []
    for panda in sorted(panda_rows, key=lambda row: row["slug"]):
        values = candidate_by_panda.get(panda["slug"], [])
        records.append(
            {
                "panda_slug": panda["slug"],
                "candidate_count": len(values),
                "private_collection_eligible_count": sum(
                    item["scope_eligibility"]["private_collection"]["eligible"]
                    for item in values
                ),
                "public_open_eligible_count": sum(
                    item["scope_eligibility"]["public_open"]["eligible"]
                    for item in values
                ),
                "private_collection_main_candidate_id": private_by_panda.get(
                    panda["slug"], {}
                ).get("main_candidate_id"),
                "public_open_main_candidate_id": public_by_panda.get(panda["slug"], {}).get(
                    "main_candidate_id"
                ),
                "state": "has-candidate" if values else "needs-discovery",
            }
        )
    coverage_payload = {
        "schema_version": 1,
        "dataset_release_version": release_version,
        "generated_at": released_at,
        "summary": {
            "panda_count": len(records),
            "pandas_with_candidates": sum(record["candidate_count"] > 0 for record in records),
            "pandas_needing_discovery": sum(record["candidate_count"] == 0 for record in records),
            "private_collection_main_images": len(private_selection),
            "public_open_main_images": len(public_selection),
            "restricted_candidates": sum(
                candidate["rights_state"] == "restricted" for candidate in candidates
            ),
            "low_identity_candidates": sum(
                candidate["identity_confidence"] < 0.85 for candidate in candidates
            ),
        },
        "records": records,
    }

    files = {
        "candidates.json": pretty_json(candidate_payload),
        "selections.json": pretty_json(selection_payload),
        "coverage.json": pretty_json(coverage_payload),
    }
    manifest_payload = {
        "schema_version": 1,
        "dataset_release_version": release_version,
        "generated_at": released_at,
        "inputs": {
            "public_release_manifest_sha256": sha256_bytes(
                (release_dir / "manifest.json").read_bytes()
            ),
            "public_release_api_sha256": sha256_bytes((release_dir / "api.json").read_bytes()),
            "curation_media_sha256": sha256_bytes((curation_dir / "media.csv").read_bytes()),
            "curation_pandas_sha256": sha256_bytes((curation_dir / "pandas.csv").read_bytes()),
            "selection_overrides_sha256": sha256_normalized_text(overrides_path),
        },
        "files": {
            filename: {"bytes": len(content.encode("utf-8")), "sha256": sha256_text(content)}
            for filename, content in files.items()
        },
    }
    return BuildResult(
        candidates=candidate_payload,
        selections=selection_payload,
        coverage=coverage_payload,
        manifest=manifest_payload,
    )


def install_atomically(output_dir: Path, result: BuildResult) -> None:
    output_dir.parent.mkdir(parents=True, exist_ok=True)
    temporary = Path(
        tempfile.mkdtemp(prefix=f"{output_dir.name}-build-", dir=output_dir.parent)
    )
    try:
        payloads = {
            "candidates.json": result.candidates,
            "selections.json": result.selections,
            "coverage.json": result.coverage,
            "manifest.json": result.manifest,
        }
        for filename, payload in payloads.items():
            (temporary / filename).write_text(pretty_json(payload), encoding="utf-8", newline="")
        if output_dir.exists():
            backup = output_dir.parent / f".{output_dir.name}-backup"
            if backup.exists():
                shutil.rmtree(backup)
            os.replace(output_dir, backup)
            try:
                os.replace(temporary, output_dir)
            except Exception:
                os.replace(backup, output_dir)
                raise
            shutil.rmtree(backup)
        else:
            os.replace(temporary, output_dir)
    finally:
        shutil.rmtree(temporary, ignore_errors=True)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Build deterministic internal and public panda media libraries."
    )
    parser.add_argument("--release", default=DEFAULT_RELEASE)
    parser.add_argument("--curation-dir", type=Path, default=DEFAULT_CURATION_DIR)
    parser.add_argument("--overrides", type=Path, default=DEFAULT_OVERRIDES)
    parser.add_argument("--output-root", type=Path, default=DEFAULT_OUTPUT_ROOT)
    parser.add_argument("--check", action="store_true")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    result = build(args.release, args.curation_dir, args.overrides)
    output_dir = args.output_root / args.release
    if args.check:
        if not output_dir.exists():
            raise MediaLibraryError(f"Missing generated media library {output_dir}")
        expected = {
            "candidates.json": pretty_json(result.candidates),
            "selections.json": pretty_json(result.selections),
            "coverage.json": pretty_json(result.coverage),
            "manifest.json": pretty_json(result.manifest),
        }
        for filename, content in expected.items():
            if (output_dir / filename).read_text(encoding="utf-8") != content:
                raise MediaLibraryError(f"Generated media library drift: {filename}")
        print(f"OK: media library {args.release} is reproducible")
        return 0
    install_atomically(output_dir, result)
    print(
        json.dumps(
            {
                "outcome": "applied",
                "release": args.release,
                **result.coverage["summary"],
            },
            ensure_ascii=False,
            indent=2,
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

from __future__ import annotations

import csv
import json
import shutil
from pathlib import Path

from app.acquisition import reconciliation as reconciliation_module
from app.acquisition.reconciliation import ReconciliationSnapshot, load_reconciliation_snapshot

_REPOSITORY_ROOT = Path(__file__).resolve().parents[4]
_CURRENT_CURATION_DIR = _REPOSITORY_ROOT / "data" / "curation" / "pandas"
_CURRENT_IDENTITY_LINKS = _REPOSITORY_ROOT / "data" / "acquisition-sources" / "identity-links.json"
_NEW_SLUGS = {
    "bao-xin",
    "zhen-xi",
    "qing-qing-chengdu-2017-07-26",
    "xiao-xin-chengdu-2017",
}
_NEW_SOURCE_IDS = {
    "src_chengdu_international_zh",
    "src_chengdu_international_en",
    "src_chengdu_newborns_2021_zh",
    "src_chengdu_newborns_2021_en",
    "src_chengdu_denmark_2019_zh",
    "src_chengdu_denmark_2019_en",
    "src_chengdu_newborns_2017_zh",
    "src_chengdu_newborns_2017_en",
}
_NEW_SOURCE_KEYS = {
    "chengdu:bao-xin",
    "chengdu:zhen-xi",
    "chengdu:qing-qing-2017-07-26",
    "chengdu:xiao-xin-2017",
}
_MATCHED_NAME_SOURCE_BY_SLUG = {
    "ya-li": "src_chengdu_newborns_2021_zh",
    "qi-fu-changsha": "src_chengdu_newborns_2021_zh",
    "zhao-mei": "src_chengdu_newborns_2021_zh",
    "pu-pu-shenyang": "src_chengdu_newborns_2021_zh",
    "jin-xiao": "src_chengdu_newborns_2021_zh",
    "lun-hui": "src_chengdu_newborns_2021_zh",
    "ya-song": "src_chengdu_newborns_2021_zh",
    "jing-liang": "src_chengdu_newborns_2017_zh",
    "da-mei-changsha": "src_chengdu_newborns_2017_zh",
    "zhi-shi": "src_chengdu_newborns_2017_zh",
    "zhi-ma": "src_chengdu_newborns_2017_zh",
    "cheng-lan": "src_chengdu_newborns_2017_zh",
    "ni-ke": "src_chengdu_newborns_2017_zh",
    "ni-na": "src_chengdu_newborns_2017_zh",
}


def prepare_chengdu_preapplication_targets(root: Path) -> tuple[Path, Path]:
    root.mkdir(parents=True, exist_ok=False)
    curation_dir = root / "pandas"
    identity_links = root / "identity-links.json"
    shutil.copytree(_CURRENT_CURATION_DIR, curation_dir)
    shutil.copyfile(_CURRENT_IDENTITY_LINKS, identity_links)

    panda_fields, panda_rows = _read_csv(curation_dir / "pandas.csv")
    restored_pandas: list[dict[str, str]] = []
    for row in panda_rows:
        slug = row["slug"]
        if slug in _NEW_SLUGS:
            continue
        source_id = _MATCHED_NAME_SOURCE_BY_SLUG.get(slug)
        if source_id is not None:
            row["name_zh"] = ""
            row["primary_source_ids"] = _remove_ids(row["primary_source_ids"], {source_id})
        restored_pandas.append(row)
    _write_csv(curation_dir / "pandas.csv", panda_fields, restored_pandas)

    event_fields, event_rows = _read_csv(curation_dir / "events.csv")
    restored_events = [
        row
        for row in event_rows
        if not (
            row["notes"].startswith("Accepted collection patch ")
            and set(_split_ids(row["source_ids"])) <= _NEW_SOURCE_IDS
        )
    ]
    _write_csv(curation_dir / "events.csv", event_fields, restored_events)

    source_fields, source_rows = _read_csv(curation_dir / "sources.csv")
    restored_sources = [row for row in source_rows if row["source_id"] not in _NEW_SOURCE_IDS]
    _write_csv(curation_dir / "sources.csv", source_fields, restored_sources)

    raw_links = json.loads(identity_links.read_text(encoding="utf-8"))
    raw_links["source_keys"] = [
        item
        for item in raw_links["source_keys"]
        if not (
            item.get("source_id") == "chengdu-panda-base-international-cooperation"
            and item.get("source_key") in _NEW_SOURCE_KEYS
        )
    ]
    raw_links["reviewed_at"] = "2026-07-23"
    identity_links.write_text(
        json.dumps(raw_links, ensure_ascii=False, indent=2, allow_nan=False) + "\n",
        encoding="utf-8",
        newline="",
    )
    return curation_dir, identity_links


def install_chengdu_preapplication_reconciliation(
    root: Path,
    monkeypatch,
) -> tuple[Path, Path, ReconciliationSnapshot]:
    curation_dir, identity_links = prepare_chengdu_preapplication_targets(root)
    snapshot = load_reconciliation_snapshot(
        curation_dir,
        identity_links_path=identity_links,
    )
    monkeypatch.setattr(
        reconciliation_module,
        "load_reconciliation_snapshot",
        lambda *args, **kwargs: snapshot,
    )
    return curation_dir, identity_links, snapshot


def _read_csv(path: Path) -> tuple[tuple[str, ...], list[dict[str, str]]]:
    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        return tuple(reader.fieldnames or ()), [dict(row) for row in reader]


def _write_csv(
    path: Path,
    fields: tuple[str, ...],
    rows: list[dict[str, str]],
) -> None:
    with path.open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fields, lineterminator="\n")
        writer.writeheader()
        writer.writerows(rows)


def _split_ids(value: str) -> list[str]:
    return [item.strip() for item in value.split(";") if item.strip()]


def _remove_ids(value: str, removed: set[str]) -> str:
    return ";".join(item for item in _split_ids(value) if item not in removed)


__all__ = [
    "install_chengdu_preapplication_reconciliation",
    "prepare_chengdu_preapplication_targets",
]

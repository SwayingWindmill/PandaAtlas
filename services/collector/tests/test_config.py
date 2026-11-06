from __future__ import annotations

import json
from pathlib import Path

import pytest

from collector.config import REPO_ROOT, ConfigError, load_targets
from collector.lexicon import Lexicon
from collector.models import Role, TargetKind, Tier


def write(tmp_path: Path, text: str) -> Path:
    path = tmp_path / "targets.yaml"
    path.write_text(text, encoding="utf-8")
    return path


def test_keyword_groups_fan_out_per_adapter_and_platform(tmp_path: Path) -> None:
    targets = load_targets(
        write(
            tmp_path,
            """
targets:
  - {adapter: weibo_crawler, kind: account, value: "123", label: 基地, tier: official}
keyword_groups:
  - adapters: [xhs_mcp, {adapter: mediacrawler, params: {platform: dy}}]
    terms: [福宝]
""",
        )
    )
    by_id = {t.id: t for t in targets}
    assert set(by_id) == {
        "weibo_crawler:account:123",
        "xhs_mcp:keyword:福宝",
        "mediacrawler@dy:keyword:福宝",
    }
    assert by_id["weibo_crawler:account:123"].interval_minutes == 15
    keyword = by_id["xhs_mcp:keyword:福宝"]
    assert (keyword.kind, keyword.tier, keyword.interval_minutes) == (
        TargetKind.KEYWORD,
        Tier.KEYWORD,
        180,
    )


def test_rejects_duplicates_and_unknown_adapters(tmp_path: Path) -> None:
    with pytest.raises(ConfigError, match="duplicate"):
        load_targets(
            write(
                tmp_path,
                """
keyword_groups:
  - {adapters: [xhs_mcp], terms: [福宝, 福宝]}
""",
            )
        )
    with pytest.raises(ConfigError, match="unknown adapter"):
        load_targets(write(tmp_path, "targets: [{adapter: tiktok, kind: account, value: x}]"))


def test_repository_targets_file_loads() -> None:
    targets = load_targets(REPO_ROOT / "data/collector/targets.yaml")
    assert targets and len({t.id for t in targets}) == len(targets)


def test_lexicon_maps_names_and_aliases_to_every_slug(tmp_path: Path) -> None:
    csv = tmp_path / "pandas.csv"
    csv.write_text(
        "slug,name_zh\nfu-bao,福宝\nhe-hua,和花\nle-le-a,乐乐\nle-le-b,乐乐\nx,宝\n",
        encoding="utf-8",
    )
    aliases = tmp_path / "aliases.yaml"
    aliases.write_text("he-hua: [花花]\n", encoding="utf-8")
    lexicon = Lexicon.load(csv, aliases)
    assert lexicon.slugs("花花和乐乐，还有福宝") == ["fu-bao", "he-hua", "le-le-a", "le-le-b"]
    assert lexicon.slugs("宝") == []  # one-character names are ignored


def test_role_and_institution_are_loaded(tmp_path: Path) -> None:
    [base, fan, keyword] = load_targets(
        write(
            tmp_path,
            """
targets:
  - {adapter: weibo_crawler, kind: account, value: "1", role: institution, institution: ccrcgp}
  - {adapter: weibo_crawler, kind: account, value: "2", role: fan}
  - {adapter: weibo_crawler, kind: keyword, value: 福宝}
""",
        )
    )
    assert (base.role, base.institution) == (Role.INSTITUTION, "ccrcgp")
    assert (fan.role, fan.institution) == (Role.FAN, None)
    assert (keyword.role, keyword.institution) == (None, None)


@pytest.mark.parametrize(
    ("entry", "message"),
    [
        ("role: chief", "chief"),
        ("role: fan, institution: ccrcgp", "only role institution"),
    ],
)
def test_bad_role_fails_loading(tmp_path: Path, entry: str, message: str) -> None:
    path = write(
        tmp_path,
        f"targets:\n  - {{adapter: weibo_crawler, kind: account, value: '1', {entry}}}\n",
    )
    with pytest.raises(ConfigError, match=message):
        load_targets(path)


def test_every_account_in_targets_yaml_has_a_role_and_a_known_institution() -> None:
    targets = load_targets(REPO_ROOT / "data/collector/targets.yaml")
    institutions = json.loads(
        (REPO_ROOT / "data/curation/institutions/institutions.json").read_text(encoding="utf-8")
    )["institutions"]
    slugs = {i["slug"] for i in institutions}
    accounts = [t for t in targets if t.kind is TargetKind.ACCOUNT]
    assert [t.id for t in accounts if t.role is None] == []
    assert [t.id for t in targets if t.kind is not TargetKind.ACCOUNT and t.role] == []
    assert {t.institution for t in accounts if t.institution} <= slugs

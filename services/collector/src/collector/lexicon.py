"""Panda name lexicon: tags each item with the slugs of the pandas whose names it mentions.

Names come from the curated archive (`data/curation/pandas/pandas.csv`) plus hand-kept nicknames
(`data/collector/aliases.yaml`). Many pandas share a name, so a mention maps to every slug that
carries it; telling them apart is left to AIHOT's extraction and to review.
"""

from __future__ import annotations

import csv
import re
from collections import defaultdict
from pathlib import Path

import yaml

from collector.models import Item

#: Two characters is the shortest Chinese panda name; one character matches everywhere.
MIN_NAME_LENGTH = 2


class Lexicon:
    def __init__(self, names: dict[str, set[str]]):
        self.names = {n: s for n, s in names.items() if len(n) >= MIN_NAME_LENGTH}
        ordered = sorted(self.names, key=len, reverse=True)
        self.pattern = re.compile("|".join(map(re.escape, ordered))) if ordered else None

    @classmethod
    def load(cls, pandas_csv: Path, aliases_yaml: Path | None) -> Lexicon:
        names: dict[str, set[str]] = defaultdict(set)
        with pandas_csv.open(encoding="utf-8-sig", newline="") as handle:
            for row in csv.DictReader(handle):
                if row.get("name_zh"):
                    names[row["name_zh"].strip()].add(row["slug"])
        if aliases_yaml and aliases_yaml.is_file():
            for slug, aliases in (yaml.safe_load(aliases_yaml.read_text("utf-8")) or {}).items():
                for alias in aliases or []:
                    names[str(alias).strip()].add(slug)
        return cls(names)

    def slugs(self, text: str) -> list[str]:
        if not self.pattern:
            return []
        found: set[str] = set()
        for match in self.pattern.findall(text):
            found |= self.names[match]
        return sorted(found)

    def tag(self, item: Item) -> list[str]:
        return self.slugs(f"{item.title}\n{item.body}")

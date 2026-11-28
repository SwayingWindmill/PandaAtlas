"""List curated content that is due for a re-check, as a Markdown checklist.

Usage: python3 scripts/curation/review_due.py [--today YYYY-MM-DD] [--out PATH]

The weekly content-review workflow posts this list to one GitHub issue, so the owner has a single place
to work from. Nothing here fails a build: an old entry is a reminder, not an error. After checking an
entry, update its date (verifiedOn, updatedAt) in the data file and release the file as usual.
"""

from __future__ import annotations

import argparse
import json
import sys
from datetime import date, datetime, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
INSTITUTIONS = ROOT / "data/curation/institutions/institutions.json"
VENUE_NEWS = ROOT / "data/curation/venue-news/venue-news.json"
OVERSEAS = ROOT / "data/curation/overseas-status/overseas-status.json"
LEARNING = ROOT / "data/curation/learning/learning.json"

# How long a checked fact stays fresh. Opening hours, prices and enclosures change with the season;
# an institution's profile rarely does.
PROFILE_DAYS = 365
VISIT_DAYS = 90
OVERSEAS_DAYS = 30
NEWS_DAYS = 60
# Remind about next month's 挑战 theme this many days before the month ends.
THEME_LEAD_DAYS = 10


def load(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8")) if path.exists() else {}


def day_of(value: object) -> date | None:
    try:
        text = str(value)
        return datetime.fromisoformat(text).date() if "T" in text else date.fromisoformat(text)
    except ValueError:
        return None


def overdue(value: object, days: int, today: date) -> date | None:
    """The day it was last checked, when that is more than `days` ago or missing."""
    checked = day_of(value)
    if checked is None:
        return date.min
    return checked if today - checked > timedelta(days=days) else None


def label(day: date) -> str:
    return "never checked" if day == date.min else f"checked {day.isoformat()}"


def institution_items(content: dict, today: date) -> list[str]:
    items: list[str] = []
    for institution in content.get("institutions", []):
        name = institution.get("nameZh") or institution.get("slug")
        checked = overdue((institution.get("profile") or {}).get("verifiedOn"), PROFILE_DAYS, today)
        if checked:
            items.append(f"{name}：简介（{label(checked)}）")
        for place in institution.get("places") or []:
            guide = place.get("visitGuide")
            if not guide:
                continue
            checked = overdue(guide.get("verifiedOn"), VISIT_DAYS, today)
            if checked:
                items.append(f"{name} · {place.get('slug')}：开放时间、票价、观猫时段（{label(checked)}）")
    return items


def overseas_items(content: dict, today: date) -> list[str]:
    items: list[str] = []
    for item in content.get("items", []):
        if item.get("status") != "published" or item.get("stage") == "returned":
            continue
        checked = overdue(item.get("updatedAt"), OVERSEAS_DAYS, today)
        if checked:
            items.append(f"{item.get('pandaSlug')}：{item.get('stage')}（{label(checked)}）")
    return items


def news_items(content: dict, today: date) -> list[str]:
    items: list[str] = []
    for item in content.get("items", []):
        if item.get("status") != "published":
            continue
        published = overdue(item.get("publishedOn"), NEWS_DAYS, today)
        if published:
            items.append(f"{item.get('headline')}：发布于 {item.get('publishedOn')}，还有效吗？无效就改回 draft")
    return items


def theme_items(content: dict, today: date) -> list[str]:
    first_of_next = (today.replace(day=28) + timedelta(days=4)).replace(day=1)
    if (first_of_next - today).days > THEME_LEAD_DAYS:
        return []
    month = first_of_next.strftime("%Y-%m")
    themes = {theme.get("month") for theme in content.get("monthThemes", []) if theme.get("status") == "published"}
    return [] if month in themes else [f"{month} 还没有发布的挑战主题（没有就用默认清单，也可以不写）"]


def review(today: date) -> list[tuple[str, list[str]]]:
    return [
        ("场馆与观猫信息", institution_items(load(INSTITUTIONS), today)),
        ("海外大熊猫状态", overseas_items(load(OVERSEAS), today)),
        ("场馆动态", news_items(load(VENUE_NEWS), today)),
        ("月度挑战", theme_items(load(LEARNING), today)),
    ]


def render(sections: list[tuple[str, list[str]]], today: date) -> str:
    due = [(title, items) for title, items in sections if items]
    lines = [f"内容复核清单，{today.isoformat()} 生成。核对一条，就在数据文件里更新它的日期，再按内容发布流程发布。", ""]
    if not due:
        return "\n".join(lines + ["这周没有到期的内容。", ""])
    for title, items in due:
        lines += [f"### {title}", "", *[f"- [ ] {item}" for item in items], ""]
    lines.append("流程见 docs/runbooks/content-entry.md。")
    return "\n".join(lines) + "\n"


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--today", type=date.fromisoformat, default=date.today())
    parser.add_argument("--out", type=Path)
    args = parser.parse_args(argv)
    sections = review(args.today)
    markdown = render(sections, args.today)
    if args.out:
        args.out.write_text(markdown, encoding="utf-8")
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stdout.write(markdown)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

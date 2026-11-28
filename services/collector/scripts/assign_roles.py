"""Add `role` (and `institution`) to the account targets in data/collector/targets.yaml.

The file is edited as text so comments and layout survive. Run it again after adding accounts:
targets that already have a role are left alone.

    uv run python scripts/assign_roles.py            # rewrite the file
    uv run python scripts/assign_roles.py --check    # list what is missing, change nothing
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

TARGETS = Path(__file__).resolve().parents[3] / "data/collector/targets.yaml"

#: Account name (platform suffix removed) -> ZhiPanda institution slug, for institutions that
#: exist in place.institutions (data/curation/institutions).
INSTITUTIONS = {
    "成都大熊猫繁育研究基地": "chengdu-research-base",
    "中国大熊猫保护研究中心": "ccrcgp",
    "卧龙大熊猫俱乐部（中国大熊猫保护研究中心）": "ccrcgp",
}

#: Institutions' own accounts whose institution is not yet in ZhiPanda's catalog: role institution,
#: no slug. Add the slug to INSTITUTIONS once the institution is published.
INSTITUTIONS_WITHOUT_SLUG = {
    "大熊猫国家公园成都管理分局",
    "四川唐家河国家级自然保护区",
    "秦岭大熊猫佛坪基地",
    "北京动物园",
    "重庆动物园",
    "上海动物园",
    "上海野生动物园",
    "西安秦岭野生动物园",
    "南京市红山森林动物园",
    "长隆野生动物世界",
    "广州长隆野生动物世界",
    "香港海洋公园",
    "都江堰熊猫家园",
    "广州长隆熊猫村",
    "秦岭四宝科学公园",
    "卧龙中华大熊猫苑",
    "南山竹海大熊猫",
}

#: Official channels that are not an institution's own account.
OFFICIAL = {
    "iPanda熊猫频道",
    "开饭了大熊猫（咪咕）",
    "成都大熊猫繁育研究基金会",
    "熊猫守护者",
}

MEDIA = {
    "纪录片守护大熊猫之福宝诞生记",
    "Pandaful熊猫社区",
    "pandapia熊猫乌托邦",
    "aPandaCity熊猫之都",
}

PLATFORM_SUFFIX = re.compile(r"（(微博|抖音|小红书)）$")


def classify(label: str) -> tuple[str, str | None]:
    name = PLATFORM_SUFFIX.sub("", label)
    if name in INSTITUTIONS:
        return "institution", INSTITUTIONS[name]
    if name in INSTITUTIONS_WITHOUT_SLUG:
        return "institution", None
    if name in OFFICIAL:
        return "official", None
    if name in MEDIA:
        return "media", None
    return "fan", None


def rewrite(text: str) -> tuple[str, list[str]]:
    blocks = re.split(r"(?m)^(?=  - adapter:)", text)
    out, assigned = [blocks[0]], []
    for block in blocks[1:]:
        if re.search(r"(?m)^    kind: account$", block) and not re.search(r"(?m)^    role:", block):
            name = re.search(r"(?m)^    label: (.+)$", block).group(1).strip()  # type: ignore[union-attr]
            role, institution = classify(name)
            extra = f"    role: {role}\n"
            if institution:
                extra += f"    institution: {institution}\n"
            block = re.sub(r"(?m)^(    tier: .+\n)", rf"\1{extra}", block, count=1)
            assigned.append(f"{role:11} {institution or '-':22} {name}")
        out.append(block)
    return "".join(out), assigned


def main() -> None:
    text = TARGETS.read_text(encoding="utf-8")
    new, assigned = rewrite(text)
    print("\n".join(assigned) or "nothing to assign")
    if "--check" not in sys.argv and new != text:
        TARGETS.write_text(new, encoding="utf-8", newline="")


if __name__ == "__main__":
    main()

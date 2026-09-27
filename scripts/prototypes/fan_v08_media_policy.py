from __future__ import annotations

import re
from typing import Any


NON_PHOTO_PATTERNS = [
    re.compile(pattern, re.I)
    for pattern in (
        r"illustration|cartoon|avatar|logo|插画|卡通|头像|示意图",
        r"pandapia\.com/upload/misc/crop/.*\.png(?:$|\?)",
    )
]

# These assets are individually bound in the research vault but are not suitable
# as public profile photography. Keep this list intentionally tiny and evidence-
# based; broad media classes should be handled by NON_PHOTO_PATTERNS instead.
KNOWN_UNUSABLE_MEDIA_IDS = {
    "local-media-batch371-wolong-white-panda-tracked-2019",
}


def media_is_hero_usable(media: dict[str, Any]) -> bool:
    raw_id = str(media.get("id") or media.get("media_id") or "")
    if raw_id in KNOWN_UNUSABLE_MEDIA_IDS:
        return False

    url = str(media.get("asset_url") or media.get("url") or "").strip()
    value = " ".join(
        str(media.get(key) or "")
        for key in (
            "id",
            "media_id",
            "asset_url",
            "url",
            "description",
            "rights",
            "rights_label",
            "rights_state",
            "credit",
        )
    )
    return bool(url) and not any(pattern.search(value) for pattern in NON_PHOTO_PATTERNS)

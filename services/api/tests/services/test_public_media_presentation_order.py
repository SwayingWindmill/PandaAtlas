from __future__ import annotations

from app.projection.public_release import _attach_public_media

PANDA_ID = "2939c16f-1938-5629-928c-b36b1d5cd6ed"


def media_record(media_id: str, role: str, suffix: str) -> dict[str, object]:
    return {
        "id": media_id,
        "entity_type": "media",
        "public": {
            "panda_id": PANDA_ID,
            "presentation_role": role,
            "url": f"https://media.example.org/{suffix}-w1200.webp",
            "source_url": f"https://commons.wikimedia.org/wiki/File:{suffix}.jpg",
            "rights": "CC BY 2.0",
            "credit": "Example Author / Wikimedia Commons",
            "alt_zh": "开放许可大熊猫图片",
            "alt_en": "Open-license panda image",
            "status": "available",
            "sha256": suffix[0] * 64,
            "mime_type": "image/webp",
            "width": 1200,
            "height": 800,
            "bytes": 1000,
            "derivatives": [
                {
                    "kind": "width-1200",
                    "url": f"https://media.example.org/{suffix}-w1200.webp",
                    "sha256": suffix[-1] * 64,
                    "mime_type": "image/webp",
                    "width": 1200,
                    "height": 800,
                    "bytes": 1000,
                }
            ],
            "source_ids": ["src-media"],
        },
    }


def test_primary_media_is_first_and_all_gallery_media_is_preserved() -> None:
    records = [
        {
            "id": PANDA_ID,
            "entity_type": "pandas",
            "public": {"canonical_slug": "mei-xiang"},
        },
        media_record("media-aaa-gallery", "gallery", "dddd"),
        media_record("media-zzz-primary", "primary", "eeee"),
        media_record("media-bbb-gallery", "gallery", "ffff"),
    ]

    projected = _attach_public_media(records, "1.2.0")
    panda = next(record for record in projected if record["entity_type"] == "pandas")
    media = panda["public"]["media"]

    assert [item["presentation_role"] for item in media] == [
        "primary",
        "gallery",
        "gallery",
    ]
    assert [item["id"] for item in media] == [
        "media-zzz-primary",
        "media-aaa-gallery",
        "media-bbb-gallery",
    ]
    assert panda["public"]["cover_image_url"] == media[0]["url"]
    assert panda["public"]["media_release"] == {
        "license_state": "licensed",
        "display_mode": "gallery",
        "source_ids": ["src-media"],
    }

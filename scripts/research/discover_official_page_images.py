from __future__ import annotations

import argparse
import json
import time
from dataclasses import dataclass, field
from datetime import datetime, timezone
from html.parser import HTMLParser
from pathlib import Path
from typing import Any, Iterable
from urllib.error import URLError
from urllib.parse import urljoin, urlparse
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[2]
USER_AGENT = "PandaAtlasLocalResearch/0.1 (+https://github.com/SwayingWindmill/PandaAtlas)"
MAX_HTML_BYTES = 8 * 1024 * 1024
IMAGE_META_NAMES = {"og:image", "og:image:url", "twitter:image", "twitter:image:src"}
IMAGE_ATTRS = ("src", "data-src", "data-original", "data-lazy-src", "data-lazy", "data-image")


class OfficialImageDiscoveryError(RuntimeError):
    pass


@dataclass
class ImageEvidence:
    raw_url: str
    source_type: str
    alt: str = ""
    title: str = ""
    width: str = ""
    height: str = ""
    evidence: list[str] = field(default_factory=list)

    def searchable_text(self) -> str:
        return " ".join(
            part
            for part in [self.raw_url, self.alt, self.title, *self.evidence]
            if isinstance(part, str) and part
        ).casefold()


class OfficialImageHTMLParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.base_href = ""
        self.images: list[ImageEvidence] = []

    @staticmethod
    def _attrs(attrs: list[tuple[str, str | None]]) -> dict[str, str]:
        return {key.casefold(): value or "" for key, value in attrs}

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        tag = tag.casefold()
        values = self._attrs(attrs)
        if tag == "base" and values.get("href"):
            self.base_href = values["href"]
            return

        if tag == "meta":
            name = (values.get("property") or values.get("name") or "").casefold()
            content = values.get("content", "").strip()
            if name in IMAGE_META_NAMES and content:
                self.images.append(
                    ImageEvidence(
                        raw_url=content,
                        source_type=f"meta:{name}",
                        evidence=[name],
                    )
                )
            return

        if tag == "link":
            rel_tokens = {token.casefold() for token in values.get("rel", "").split()}
            href = values.get("href", "").strip()
            as_value = values.get("as", "").casefold()
            if href and ("image_src" in rel_tokens or ("preload" in rel_tokens and as_value == "image")):
                self.images.append(
                    ImageEvidence(
                        raw_url=href,
                        source_type="link:image",
                        evidence=[values.get("rel", ""), values.get("as", "")],
                    )
                )
            return

        if tag not in {"img", "source"}:
            return

        alt = values.get("alt", "").strip()
        title = values.get("title", "").strip()
        width = values.get("width", "").strip()
        height = values.get("height", "").strip()
        classes = values.get("class", "").strip()
        element_id = values.get("id", "").strip()

        if tag == "img":
            for attr in IMAGE_ATTRS:
                raw_url = values.get(attr, "").strip()
                if raw_url:
                    self.images.append(
                        ImageEvidence(
                            raw_url=raw_url,
                            source_type=f"img:{attr}",
                            alt=alt,
                            title=title,
                            width=width,
                            height=height,
                            evidence=[classes, element_id],
                        )
                    )

        srcset = values.get("srcset", "").strip()
        if srcset:
            for raw_url in parse_srcset(srcset):
                self.images.append(
                    ImageEvidence(
                        raw_url=raw_url,
                        source_type=f"{tag}:srcset",
                        alt=alt,
                        title=title,
                        width=width,
                        height=height,
                        evidence=[classes, element_id],
                    )
                )


def parse_srcset(value: str) -> list[str]:
    urls: list[str] = []
    for item in value.split(","):
        parts = item.strip().split(maxsplit=1)
        if not parts:
            continue
        candidate = parts[0].strip()
        if candidate:
            urls.append(candidate)
    return urls


def is_https_url(value: str) -> bool:
    parsed = urlparse(value)
    return parsed.scheme == "https" and bool(parsed.netloc)


def normalize_images(page_url: str, parser: OfficialImageHTMLParser) -> list[dict[str, Any]]:
    base_url = urljoin(page_url, parser.base_href) if parser.base_href else page_url
    ordered: list[str] = []
    by_url: dict[str, dict[str, Any]] = {}

    for image in parser.images:
        raw_url = image.raw_url.strip()
        if not raw_url or raw_url.startswith(("data:", "blob:", "javascript:")):
            continue
        resolved = urljoin(base_url, raw_url)
        if not is_https_url(resolved):
            continue

        if resolved not in by_url:
            ordered.append(resolved)
            by_url[resolved] = {
                "asset_url": resolved,
                "source_types": [],
                "alt": image.alt,
                "title": image.title,
                "width": image.width,
                "height": image.height,
                "evidence": [],
            }
        row = by_url[resolved]
        if image.source_type not in row["source_types"]:
            row["source_types"].append(image.source_type)
        for evidence in image.evidence:
            if evidence and evidence not in row["evidence"]:
                row["evidence"].append(evidence)
        for field_name in ("alt", "title", "width", "height"):
            if not row[field_name] and getattr(image, field_name):
                row[field_name] = getattr(image, field_name)

    return [by_url[url] for url in ordered]


def filter_images(
    images: Iterable[dict[str, Any]],
    required_keywords: list[str],
    excluded_keywords: list[str],
) -> list[dict[str, Any]]:
    required = [keyword.casefold() for keyword in required_keywords if keyword.strip()]
    excluded = [keyword.casefold() for keyword in excluded_keywords if keyword.strip()]
    filtered: list[dict[str, Any]] = []

    for image in images:
        searchable = " ".join(
            str(part)
            for part in [
                image.get("asset_url", ""),
                image.get("alt", ""),
                image.get("title", ""),
                *(image.get("evidence") or []),
            ]
        ).casefold()
        if required and not any(keyword in searchable for keyword in required):
            continue
        if excluded and any(keyword in searchable for keyword in excluded):
            continue
        filtered.append(image)
    return filtered


def discover_from_html(
    page_url: str,
    html: str,
    required_keywords: list[str] | None = None,
    excluded_keywords: list[str] | None = None,
) -> dict[str, Any]:
    parser = OfficialImageHTMLParser()
    parser.feed(html)
    parser.close()
    images = normalize_images(page_url, parser)
    images = filter_images(images, required_keywords or [], excluded_keywords or [])
    return {
        "schema_version": 1,
        "page_url": page_url,
        "discovered_at": datetime.now(timezone.utc).isoformat(),
        "image_count": len(images),
        "images": images,
    }


def fetch_html(page_url: str, timeout_seconds: int, attempts: int = 3) -> str:
    if not is_https_url(page_url):
        raise OfficialImageDiscoveryError("page URL must be HTTPS")
    request = Request(
        page_url,
        headers={
            "User-Agent": USER_AGENT,
            "Accept": "text/html,application/xhtml+xml",
        },
    )
    last_error: OSError | None = None
    for attempt in range(1, max(attempts, 1) + 1):
        try:
            with urlopen(request, timeout=timeout_seconds) as response:
                content_type = response.headers.get_content_type()
                if content_type not in {"text/html", "application/xhtml+xml"}:
                    raise OfficialImageDiscoveryError(f"expected HTML response, received {content_type}")
                raw = response.read(MAX_HTML_BYTES + 1)
                if len(raw) > MAX_HTML_BYTES:
                    raise OfficialImageDiscoveryError(f"HTML response exceeds {MAX_HTML_BYTES} bytes")
                charset = response.headers.get_content_charset() or "utf-8"
                try:
                    return raw.decode(charset)
                except (LookupError, UnicodeDecodeError):
                    return raw.decode("utf-8", errors="replace")
        except URLError as error:
            last_error = error
            if attempt >= max(attempts, 1):
                break
            time.sleep(min(2 ** (attempt - 1), 4))
    raise OfficialImageDiscoveryError(
        f"failed to fetch page after {max(attempts, 1)} attempts: {last_error}"
    )


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Discover publicly embedded images on an official panda page.")
    parser.add_argument("--page-url", required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--required-keyword", action="append", default=[])
    parser.add_argument("--exclude-keyword", action="append", default=[])
    parser.add_argument("--timeout-seconds", type=int, default=30)
    parser.add_argument("--html-fixture", type=Path)
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    output = args.output if args.output.is_absolute() else ROOT / args.output
    try:
        if args.html_fixture:
            fixture = args.html_fixture if args.html_fixture.is_absolute() else ROOT / args.html_fixture
            html = fixture.read_text(encoding="utf-8-sig")
        else:
            html = fetch_html(args.page_url, args.timeout_seconds)
        result = discover_from_html(
            args.page_url,
            html,
            required_keywords=args.required_keyword,
            excluded_keywords=args.exclude_keyword,
        )
        output.parent.mkdir(parents=True, exist_ok=True)
        output.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    except (OSError, OfficialImageDiscoveryError) as error:
        print(f"Official page image discovery failed: {error}")
        return 1

    print(
        "Official page image discovery passed: "
        f"page={args.page_url}, images={result['image_count']}, output={output}."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

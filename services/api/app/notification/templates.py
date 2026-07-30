from __future__ import annotations

from dataclasses import dataclass
from html import escape
from importlib.resources import files
from string import Template


@dataclass(frozen=True, slots=True)
class RenderedEmail:
    subject: str
    html: str
    text: str
    template_key: str
    template_version: int
    locale: str


class NotificationTemplateRenderer:
    """Render repository-owned, versioned HTML and text notification templates."""

    def __init__(self, *, public_base_url: str) -> None:
        self.public_base_url = public_base_url.rstrip("/")

    def render_intent(
        self,
        *,
        locale: str,
        category: str,
        content: dict[str, object],
    ) -> RenderedEmail:
        normalized_locale = _normalize_locale(locale)
        title, summary = _intent_copy(normalized_locale, category, content)
        context = {
            "title": title,
            "summary": summary,
            "category": category.replace("_", " "),
            "inbox_url": f"{self.public_base_url}/{_path_locale(normalized_locale)}/me/inbox",
        }
        return self._render("intent", normalized_locale, context, subject=title)

    def render_digest(
        self,
        *,
        locale: str,
        frequency: str,
        content: dict[str, object],
    ) -> RenderedEmail:
        normalized_locale = _normalize_locale(locale)
        raw_items = content.get("items", [])
        items = raw_items if isinstance(raw_items, list) else []
        item_lines: list[str] = []
        item_html: list[str] = []
        for index, raw_item in enumerate(items, start=1):
            item = raw_item if isinstance(raw_item, dict) else {}
            item_content = item.get("content", {})
            item_content = item_content if isinstance(item_content, dict) else {}
            category = str(item.get("category", "activity"))
            title, summary = _intent_copy(normalized_locale, category, item_content)
            item_lines.append(f"{index}. {title} — {summary}")
            item_html.append(
                "<li><strong>" + escape(title) + "</strong><br>" + escape(summary) + "</li>"
            )
        if not item_lines:
            item_lines.append(_copy(normalized_locale, "empty_digest"))
            item_html.append(f"<li>{escape(_copy(normalized_locale, 'empty_digest'))}</li>")
        title = _copy(normalized_locale, f"{frequency}_digest_title")
        context = {
            "title": title,
            "frequency": frequency,
            "item_count": str(len(items)),
            "items_text": "\n".join(item_lines),
            "items_html": "".join(item_html),
            "inbox_url": f"{self.public_base_url}/{_path_locale(normalized_locale)}/me/inbox",
        }
        return self._render("digest", normalized_locale, context, subject=title)

    def _render(
        self,
        template_key: str,
        locale: str,
        context: dict[str, str],
        *,
        subject: str,
    ) -> RenderedEmail:
        template_root = files("app.notification").joinpath("templates", locale)
        html_template = Template(template_root.joinpath(f"{template_key}.html").read_text("utf-8"))
        text_template = Template(template_root.joinpath(f"{template_key}.txt").read_text("utf-8"))
        html_context = {
            key: value if key.endswith("_html") else escape(value) for key, value in context.items()
        }
        return RenderedEmail(
            subject=subject,
            html=html_template.substitute(html_context),
            text=text_template.substitute(context),
            template_key=template_key,
            template_version=1,
            locale=locale,
        )


def _normalize_locale(locale: str) -> str:
    return "zh-CN" if locale.lower() in {"zh", "zh-cn", "zh_cn"} else "en"


def _path_locale(locale: str) -> str:
    return "zh" if locale == "zh-CN" else "en"


def _intent_copy(
    locale: str,
    category: str,
    content: dict[str, object],
) -> tuple[str, str]:
    localized = content.get("localized_snapshots")
    if isinstance(localized, list):
        desired = {"zh-CN", "zh"} if locale == "zh-CN" else {"en", "en-US"}
        for snapshot in localized:
            if not isinstance(snapshot, dict) or str(snapshot.get("locale")) not in desired:
                continue
            title = str(snapshot.get("title") or _copy(locale, "generic_title"))
            summary = str(snapshot.get("summary") or _copy(locale, "generic_summary"))
            return title, summary
    payload = content.get("payload")
    payload = payload if isinstance(payload, dict) else {}
    title = str(
        content.get("title_zh" if locale == "zh-CN" else "title_en")
        or payload.get("public_message_key")
        or _copy(locale, f"category_{category}")
        or _copy(locale, "generic_title")
    )
    status = payload.get("status") or payload.get("outcome") or content.get("activity_type")
    summary = str(status or _copy(locale, "generic_summary"))
    return title, summary


def _copy(locale: str, key: str) -> str:
    values: dict[str, dict[str, str]] = {
        "zh-CN": {
            "generic_title": "吱熊猫有新动态",
            "generic_summary": "你的吱熊猫账号有一项新动态。",
            "empty_digest": "此周期没有新的邮件动态。",
            "daily_digest_title": "吱熊猫每日熊猫动态",
            "weekly_digest_title": "吱熊猫每周熊猫动态",
            "category_birthday": "熊猫生日动态",
            "category_major_activity": "熊猫重要动态",
            "category_submission_status": "投稿状态更新",
            "category_incorporation": "投稿收录更新",
            "category_correction_retraction": "更正或撤回通知",
            "category_security_role": "账号安全或权限更新",
        },
        "en": {
            "generic_title": "New ZhiPanda update",
            "generic_summary": "There is a new update for your ZhiPanda account.",
            "empty_digest": "There are no new email updates for this period.",
            "daily_digest_title": "Your daily ZhiPanda panda updates",
            "weekly_digest_title": "Your weekly ZhiPanda panda updates",
            "category_birthday": "Panda birthday update",
            "category_major_activity": "Important panda update",
            "category_submission_status": "Submission status update",
            "category_incorporation": "Contribution incorporation update",
            "category_correction_retraction": "Correction or retraction notice",
            "category_security_role": "Account security or role update",
        },
    }
    return values[locale].get(key, values[locale]["generic_title"])

"""Sends newly raised alerts to a chat webhook (Feishu, WeCom or Slack-style)."""

from __future__ import annotations

import logging

import httpx

from collector.store import Alert, Store

log = logging.getLogger(__name__)

KIND_LABELS = {
    "login_expired": "登录失效",
    "rate_limited": "被限流",
    "challenge": "遇到验证码或风控",
    "upstream_changed": "接口或页面变了",
    "not_found": "目标不存在或配置有误",
    "transient": "连续失败",
    "empty": "连续空结果",
    "push_failed": "推送 AIHOT 失败",
}


def text(alert: Alert) -> str:
    where = f"{alert.adapter} / {alert.target_id}" if alert.target_id else alert.adapter
    return f"[吱熊猫采集] {KIND_LABELS.get(alert.kind, alert.kind)}：{where}\n{alert.message}"


def payload(fmt: str, message: str) -> dict[str, object]:
    if fmt == "feishu":
        return {"msg_type": "text", "content": {"text": message}}
    if fmt == "wecom":
        return {"msgtype": "text", "text": {"content": message}}
    return {"text": message}


async def notify(store: Store, client: httpx.AsyncClient, url: str | None, fmt: str) -> int:
    alerts = await store.unnotified_alerts()
    if not alerts:
        return 0
    sent: list[int] = []
    for alert in alerts:
        log.warning("%s", text(alert))
        if url:
            try:
                response = await client.post(url, json=payload(fmt, text(alert)), timeout=15)
                response.raise_for_status()
            except httpx.HTTPError as exc:
                # The rest stay unnotified and go out next cycle.
                log.error("alert webhook failed: %r", exc)
                break
        sent.append(alert.id)
    if sent:
        await store.mark_notified(sent)
    return len(sent)

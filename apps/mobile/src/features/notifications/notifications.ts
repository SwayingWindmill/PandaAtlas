import type { components } from "@zhipanda/api-client";

// The in-app inbox: messages the API projects for a fan's followed pandas, and which kinds reach them where.
// Pure rules here, calls in inbox.ts.

export type Message = components["schemas"]["NotificationMessageDto"];
export type Preference = components["schemas"]["NotificationPreferenceDto"];
type Category = Preference["category"];
type Channel = Preference["channel"];

export interface MessageView {
  title: string;
  detail: string | null;
  /** The panda the message is about, when it can be opened. */
  pandaId: string | null;
}

/** What a message says, from its content kind; content the app does not know yet still reads as a notice. */
export function messageView(message: Message, pandaName: (pandaId: string) => string | null): MessageView {
  const content = message.content;
  if (content.erased === true) return { title: "这条通知已清除", detail: null, pandaId: null };
  if (content.kind === "knowledge_update") {
    const count = typeof content.changedResourceCount === "number" ? content.changedResourceCount : null;
    const version = typeof content.releaseVersion === "string" ? content.releaseVersion : null;
    return {
      title: "关注的熊猫资料更新了",
      detail:
        [count === null ? null : `${count} 处变化`, version && `版本 ${version}`].filter(Boolean).join("　") || null,
      pandaId: null,
    };
  }
  if (content.kind === "publication_control" && typeof content.resourceId === "string") {
    const name = pandaName(content.resourceId) ?? "一只关注的熊猫";
    return content.action === "restored"
      ? { title: `${name}的资料恢复公开了`, detail: null, pandaId: content.resourceId }
      : { title: `${name}的资料暂时下线核对`, detail: "核对完成后会再通知你。", pandaId: null };
  }
  return {
    title: message.category === "correction" ? "资料有更正" : "关注的熊猫有新消息",
    detail: null,
    pandaId: null,
  };
}

export function unreadCount(messages: Message[]): number {
  return messages.filter((message) => message.readAt === null).length;
}

const PREFERENCE_ROWS: { category: Category; channel: Channel; label: string }[] = [
  { category: "knowledge_update", channel: "station", label: "资料更新，App 内通知" },
  { category: "knowledge_update", channel: "email", label: "资料更新，邮件" },
  { category: "correction", channel: "station", label: "资料下线或恢复，App 内通知" },
  { category: "correction", channel: "email", label: "资料下线或恢复，邮件" },
];

export interface PreferenceRow {
  category: Category;
  channel: Channel;
  label: string;
  enabled: boolean;
}

/** The API returns every kind and channel with its default filled in; rows keep a fixed, readable order. */
export function preferenceRows(preferences: Preference[]): PreferenceRow[] {
  return PREFERENCE_ROWS.flatMap((row) => {
    const stored = preferences.find((item) => item.category === row.category && item.channel === row.channel);
    return stored ? [{ ...row, enabled: stored.enabled }] : [];
  });
}

/** "10月26日 14:05". */
export function messageTime(iso: string, now = new Date()): string {
  const at = new Date(iso);
  const pad = (value: number) => String(value).padStart(2, "0");
  const day = `${at.getMonth() + 1}月${at.getDate()}日`;
  const year = at.getFullYear() === now.getFullYear() ? "" : `${at.getFullYear()}年`;
  return `${year}${day} ${pad(at.getHours())}:${pad(at.getMinutes())}`;
}

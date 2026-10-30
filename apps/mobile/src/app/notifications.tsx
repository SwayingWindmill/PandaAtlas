import { useCallback, useEffect, useState } from "react";
import { Pressable, View } from "react-native";
import Animated from "react-native-reanimated";

import { Icon } from "@/components/icon";
import { Bell } from "@/components/icons";
import { LoadFailed } from "@/components/load-failed";
import { Page } from "@/components/page";
import { PandaThumb } from "@/components/panda-thumb";
import { ScreenState } from "@/components/screen-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Text } from "@/components/ui/text";
import { PAGE_ENTER } from "@/design/motion";
import { loadInbox, loadPreferences, markAllRead, markRead, savePreference } from "@/features/notifications/inbox";
import {
  type Message,
  type Preference,
  type PreferenceRow,
  messageTime,
  messageView,
  preferenceRows,
  unreadCount,
} from "@/features/notifications/notifications";
import { openPanda } from "@/features/pandas/panda-row";
import { type PandaListItem, loadPandaIndex } from "@/features/pandas/pandas";
import { HAIRLINE } from "@/lib/surface";
import { cn } from "@/lib/utils";

const AVATAR = 40;
/** Mail's unread dot sits in the gutter before the avatar. */
const DOT = 10;
const GUTTER = 8 + DOT + 8;

function Inbox({
  messages,
  pandas,
  onRead,
}: {
  messages: Message[];
  pandas: Map<string, PandaListItem>;
  onRead: (message: Message) => void;
}) {
  if (messages.length === 0) {
    return <ScreenState message="还没有通知。关注熊猫后，它们的资料有变化会通知你。" className="py-stack" />;
  }
  return (
    <View className="overflow-hidden rounded-group bg-card" style={{ borderCurve: "continuous" }}>
      {messages.map((message, index) => {
        const view = messageView(message, (pandaId) => pandas.get(pandaId)?.name ?? null);
        const unread = message.readAt === null;
        const panda = view.pandaId ? pandas.get(view.pandaId) : undefined;
        const time = (
          <Text variant="footnote" className="text-muted-foreground tabular-nums">
            {messageTime(message.createdAt)}
          </Text>
        );
        return (
          <View key={message.messageId}>
            <Pressable
              onPress={() => {
                if (unread) onRead(message);
                if (panda) openPanda(panda.slug);
              }}
              role="button"
              accessibilityLabel={`${unread ? "未读，" : ""}${view.title}`}
              className="min-h-11 flex-row items-start py-row pr-inset active:bg-accent"
            >
              <View className="items-center justify-center" style={{ width: GUTTER, height: AVATAR }}>
                <View
                  className={cn("rounded-full", unread ? "bg-primary" : "bg-transparent")}
                  style={{ width: DOT, height: DOT }}
                />
              </View>
              {panda ? (
                <PandaThumb pandaId={panda.id} name={panda.name} size={AVATAR} shape="round" />
              ) : (
                <View className="items-center justify-center rounded-full bg-secondary" style={{ width: AVATAR, height: AVATAR }}>
                  <Icon icon={Bell} size="subhead" />
                </View>
              )}
              <View className="ml-row min-w-0 flex-1 gap-hair-gap">
                <Text variant={unread ? "headline" : "body"}>{view.title}</Text>
                {view.detail ? (
                  <Text variant="subheadline" className="text-muted-foreground">
                    {view.detail}
                  </Text>
                ) : null}
                {time}
              </View>
            </Pressable>
            {index === messages.length - 1 ? null : (
              <View className="bg-border" style={{ height: HAIRLINE, marginLeft: GUTTER + AVATAR + 12 }} />
            )}
          </View>
        );
      })}
    </View>
  );
}

/** "资料更新，邮件" → section 资料更新, row 邮件. The switch keeps the full label for VoiceOver. */
function split(label: string): [string, string] {
  const [group = label, channel = label] = label.split("，");
  return [group, channel];
}

function Preferences({
  rows,
  onChange,
}: {
  rows: PreferenceRow[];
  onChange: (row: PreferenceRow, enabled: boolean) => void;
}) {
  const groups = new Map<string, PreferenceRow[]>();
  for (const row of rows) {
    const [group] = split(row.label);
    groups.set(group, [...(groups.get(group) ?? []), row]);
  }
  return (
    <View className="gap-section-tight">
      <Text variant="title">通知设置</Text>
      {[...groups].map(([group, items]) => (
        <View key={group} className="gap-1.5">
          <Text variant="footnote" role="heading" className="px-inset text-muted-foreground">
            {group}
          </Text>
          <View className="overflow-hidden rounded-group bg-card" style={{ borderCurve: "continuous" }}>
            {items.map((row, index) => (
              <View key={`${row.category}:${row.channel}`}>
                <View className="min-h-11 flex-row items-center gap-row px-inset py-stack-tight">
                  <Text variant="body" className="min-w-0 flex-1">
                    {split(row.label)[1]}
                  </Text>
                  <Switch
                    checked={row.enabled}
                    onCheckedChange={(enabled) => onChange(row, enabled)}
                    accessibilityLabel={row.label}
                    hitSlop={12}
                  />
                </View>
                {index === items.length - 1 ? null : <View className="ml-4 bg-border" style={{ height: HAIRLINE }} />}
              </View>
            ))}
          </View>
        </View>
      ))}
    </View>
  );
}

export default function NotificationsScreen() {
  const [messages, setMessages] = useState<Message[] | null>(null);
  const [preferences, setPreferences] = useState<Preference[] | null>(null);
  const [pandas, setPandas] = useState<Map<string, PandaListItem>>(new Map());
  const [failed, setFailed] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const [readFailed, setReadFailed] = useState(false);

  const load = useCallback(() => {
    Promise.all([loadInbox(), loadPreferences()])
      .then(([inbox, stored]) => {
        setMessages(inbox);
        setPreferences(stored);
      })
      .catch(() => setFailed(true));
    void loadPandaIndex().then((list) => setPandas(new Map(list.map((panda) => [panda.id, panda]))));
  }, []);
  useEffect(load, [load]);

  function retry() {
    setFailed(false);
    load();
  }

  function read(message: Message) {
    setReadFailed(false);
    markRead(message.messageId)
      .then((updated) =>
        setMessages((current) => current?.map((item) => (item.messageId === updated.messageId ? updated : item)) ?? null),
      )
      .catch(() => setReadFailed(true));
  }

  function readAll() {
    const now = new Date().toISOString();
    setReadFailed(false);
    markAllRead()
      .then(() =>
        setMessages(
          (current) => current?.map((item) => (item.readAt === null ? { ...item, readAt: now } : item)) ?? null,
        ),
      )
      .catch(() => setReadFailed(true));
  }

  function change(row: PreferenceRow, enabled: boolean) {
    setSaveFailed(false);
    savePreference({ category: row.category, channel: row.channel, enabled })
      .then((saved) =>
        setPreferences(
          (current) =>
            current?.map((item) =>
              item.category === saved.category && item.channel === saved.channel ? saved : item,
            ) ?? null,
        ),
      )
      .catch(() => setSaveFailed(true));
  }

  const unread = messages ? unreadCount(messages) : 0;
  return (
    <Page title="通知" label={messages && messages.length > 0 ? (unread > 0 ? `${unread} 条未读` : "都读过了") : undefined}>
      {failed ? (
        <LoadFailed message="通知暂时打不开。" onRetry={retry} />
      ) : messages === null || preferences === null ? (
        <View className="gap-1.5" accessibilityLabel="正在加载通知">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-56 w-full rounded-group" />
        </View>
      ) : (
        <Animated.View entering={PAGE_ENTER} className="gap-section">
          <View className="gap-1.5">
            {messages.length > 0 ? (
              <View className="min-h-11 flex-row items-end gap-row px-inset">
                <Text variant="footnote" role="heading" className="min-w-0 flex-1 pb-hair-gap text-muted-foreground">
                  收件箱
                </Text>
                {unread > 0 ? (
                  <Pressable onPress={readAll} role="button" hitSlop={8} className="min-h-11 justify-end pb-hair-gap active:opacity-60">
                    <Text variant="subheadline" className="text-primary">
                      全部已读
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            ) : null}
            <Inbox messages={messages} pandas={pandas} onRead={read} />
            {readFailed ? (
              <Text variant="footnote" className="px-inset text-destructive">
                没能标记已读，请再试一次。
              </Text>
            ) : null}
          </View>
          <View className="gap-1.5">
            <Preferences rows={preferenceRows(preferences)} onChange={change} />
            {saveFailed ? (
              <Text variant="footnote" className="px-inset text-destructive">
                没能保存设置，请再试一次。
              </Text>
            ) : null}
          </View>
        </Animated.View>
      )}
    </Page>
  );
}

import { useCallback, useEffect, useState } from "react";
import { Pressable, View } from "react-native";

import { Page } from "@/components/page";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Text } from "@/components/ui/text";
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
import { cn } from "@/lib/utils";

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
    return <Text className="text-muted-foreground">还没有通知。关注熊猫后，它们的资料有变化会通知你。</Text>;
  }
  return (
    <View>
      {messages.map((message, index) => {
        const view = messageView(message, (pandaId) => pandas.get(pandaId)?.name ?? null);
        const unread = message.readAt === null;
        const panda = view.pandaId ? pandas.get(view.pandaId) : undefined;
        return (
          <Pressable
            key={message.messageId}
            onPress={() => {
              if (unread) onRead(message);
              if (panda) openPanda(panda.slug);
            }}
            role="button"
            accessibilityLabel={`${unread ? "未读，" : ""}${view.title}`}
            className={cn(
              "flex-row gap-3 border-t-hairline border-border py-3 active:bg-accent",
              index === messages.length - 1 && "border-b-hairline",
            )}
          >
            <View className={cn("mt-2 size-2 rounded-full", unread ? "bg-highlight-foreground" : "bg-transparent")} />
            <View className="min-w-0 flex-1 gap-0.5">
              <Text className={cn(unread && "font-bold")}>{view.title}</Text>
              {view.detail ? <Text variant="muted">{view.detail}</Text> : null}
              <Text variant="muted">{messageTime(message.createdAt)}</Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

function Preferences({
  rows,
  onChange,
}: {
  rows: PreferenceRow[];
  onChange: (row: PreferenceRow, enabled: boolean) => void;
}) {
  return (
    <View className="gap-3">
      <Text variant="h2">通知设置</Text>
      <View>
        {rows.map((row, index) => (
          <View
            key={`${row.category}:${row.channel}`}
            className={cn(
              "flex-row items-center justify-between gap-3 border-t-hairline border-border py-3",
              index === rows.length - 1 && "border-b-hairline",
            )}
          >
            <Text className="min-w-0 flex-1">{row.label}</Text>
            <Switch
              checked={row.enabled}
              onCheckedChange={(enabled) => onChange(row, enabled)}
              accessibilityLabel={row.label}
              hitSlop={12}
            />
          </View>
        ))}
      </View>
      <Text variant="muted">邮件发到你登录用的邮箱。</Text>
    </View>
  );
}

export default function NotificationsScreen() {
  const [messages, setMessages] = useState<Message[] | null>(null);
  const [preferences, setPreferences] = useState<Preference[] | null>(null);
  const [pandas, setPandas] = useState<Map<string, PandaListItem>>(new Map());
  const [failed, setFailed] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);

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

  function read(message: Message) {
    void markRead(message.messageId).then((updated) =>
      setMessages((current) => current?.map((item) => (item.messageId === updated.messageId ? updated : item)) ?? null),
    );
  }

  function readAll() {
    const now = new Date().toISOString();
    void markAllRead().then(() =>
      setMessages(
        (current) => current?.map((item) => (item.readAt === null ? { ...item, readAt: now } : item)) ?? null,
      ),
    );
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
    <Page label="我的" title="通知">
      {failed ? (
        <View className="items-start gap-3 rounded-lg bg-muted p-5">
          <Text>通知暂时打不开。</Text>
          <Button
            onPress={() => {
              setFailed(false);
              load();
            }}
          >
            <Text>重试</Text>
          </Button>
        </View>
      ) : messages === null || preferences === null ? (
        <Skeleton className="h-48 w-full" accessibilityLabel="正在加载通知" />
      ) : (
        <>
          <View className="gap-3">
            {unread > 0 ? (
              <View className="flex-row items-center justify-between">
                <Text variant="muted">{`${unread} 条未读`}</Text>
                <Button variant="secondary" size="sm" onPress={readAll}>
                  <Text>全部已读</Text>
                </Button>
              </View>
            ) : null}
            <Inbox messages={messages} pandas={pandas} onRead={read} />
          </View>
          <Preferences rows={preferenceRows(preferences)} onChange={change} />
          {saveFailed ? <Text className="text-destructive">没能保存设置，请再试一次。</Text> : null}
        </>
      )}
    </Page>
  );
}

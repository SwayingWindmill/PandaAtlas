import { router, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Pressable, TextInput, View } from "react-native";
import { useCSSVariable } from "uniwind";

import { Page } from "@/components/page";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import { statusLabel } from "@/features/corrections/correction";
import { type ContributionRecord, loadMyContributions } from "@/features/corrections/submissions";
import { shortDay } from "@/features/engagement/seen";
import { useFollowed } from "@/features/engagement/favorites";
import { loadInbox } from "@/features/notifications/inbox";
import { unreadCount } from "@/features/notifications/notifications";
import { PandaRow, openPanda } from "@/features/pandas/panda-row";
import { type PandaListItem, loadPandaIndex } from "@/features/pandas/pandas";
import { useSession } from "@/features/session/session";
import { authedApi } from "@/lib/api";
import { cn } from "@/lib/utils";

const NICKNAME_MAX = 40;

function SignedOut() {
  return (
    <View className="items-start gap-3">
      <Text className="text-muted-foreground">登录后，关注的熊猫和图鉴会保存在你的账号里。</Text>
      <Button onPress={() => router.push("/sign-in")}>
        <Text>登录</Text>
      </Button>
    </View>
  );
}

function Profile({ email }: { email: string | null }) {
  const muted = String(useCSSVariable("--color-muted-foreground"));
  const [profile, setProfile] = useState<{ nickname: string; bio: string } | null>(null);
  const [draft, setDraft] = useState("");
  const [editing, setEditing] = useState(false);
  const [status, setStatus] = useState<"idle" | "saving" | "failed">("idle");

  const load = useCallback(() => {
    void authedApi.GET("/api/v2/me/profile").then(({ data }) => {
      if (data) setProfile({ nickname: data.nickname, bio: data.bio });
    });
  }, []);
  useEffect(load, [load]);

  async function save() {
    if (!profile) return;
    setStatus("saving");
    const { data } = await authedApi.PUT("/api/v2/me/profile", { body: { nickname: draft.trim(), bio: profile.bio } });
    if (!data) {
      setStatus("failed");
      return;
    }
    setProfile({ nickname: data.nickname, bio: data.bio });
    setEditing(false);
    setStatus("idle");
  }

  if (!profile) return <Skeleton className="h-16 w-full" accessibilityLabel="正在加载" />;
  const name = profile.nickname || email || "熊猫粉丝";

  return (
    <View className="gap-3">
      <View className="flex-row items-center gap-3">
        <View className="size-12 items-center justify-center rounded-full bg-primary">
          <Text className="font-bold text-primary-foreground">{name.slice(0, 1).toUpperCase()}</Text>
        </View>
        <View className="min-w-0 flex-1">
          <Text className="font-bold" numberOfLines={1}>
            {name}
          </Text>
          {email ? (
            <Text variant="muted" numberOfLines={1}>
              {email}
            </Text>
          ) : null}
        </View>
      </View>
      {editing ? (
        <View className="gap-2">
          <TextInput
            value={draft}
            onChangeText={(value) => setDraft(value.slice(0, NICKNAME_MAX))}
            placeholder="名字"
            placeholderTextColor={muted}
            accessibilityLabel="名字"
            autoFocus
            className="h-14 rounded-full border-hairline border-input px-5 text-base text-foreground"
          />
          <View className="flex-row gap-2">
            <Button onPress={save} disabled={status === "saving" || draft.trim().length === 0}>
              <Text>保存</Text>
            </Button>
            <Button variant="secondary" onPress={() => setEditing(false)}>
              <Text>取消</Text>
            </Button>
          </View>
          {status === "failed" ? <Text className="text-destructive">没能保存，请再试一次。</Text> : null}
        </View>
      ) : (
        <Button
          variant="secondary"
          className="self-start"
          onPress={() => {
            setDraft(profile.nickname);
            setEditing(true);
          }}
        >
          <Text>改名字</Text>
        </Button>
      )}
    </View>
  );
}

function EntryRow({ label, meta, href, last }: { label: string; meta?: string; href: "/notifications" | "/account"; last?: boolean }) {
  return (
    <Pressable
      onPress={() => router.push(href)}
      role="button"
      accessibilityLabel={meta ? `${label}，${meta}` : label}
      className={cn(
        "flex-row items-center justify-between gap-3 border-t-hairline border-border py-3.5 active:bg-accent",
        last && "border-b-hairline",
      )}
    >
      <Text className="font-bold">{label}</Text>
      <View className="flex-row items-center gap-2">
        {meta ? <Text className="text-highlight-foreground">{meta}</Text> : null}
        <Text className="text-muted-foreground">›</Text>
      </View>
    </Pressable>
  );
}

function Entries() {
  const [unread, setUnread] = useState(0);
  useFocusEffect(
    useCallback(() => {
      loadInbox()
        .then((messages) => setUnread(unreadCount(messages)))
        .catch(() => setUnread(0));
    }, []),
  );
  return (
    <View>
      <EntryRow label="通知" meta={unread > 0 ? `${unread} 条未读` : undefined} href="/notifications" />
      <EntryRow label="账号与数据" href="/account" last />
    </View>
  );
}

function Following() {
  const followed = useFollowed();
  const [pandas, setPandas] = useState<PandaListItem[] | null>(null);
  useEffect(() => {
    void loadPandaIndex().then(setPandas);
  }, []);
  if (followed === null || pandas === null) return null;
  const items = pandas.filter((panda) => followed.has(panda.id));
  return (
    <View className="gap-2">
      <Text variant="h2">{`关注的熊猫　${items.length}`}</Text>
      {items.length === 0 ? (
        <Text className="text-muted-foreground">在熊猫资料页点「关注」。</Text>
      ) : (
        <View>
          {items.map((item, index) => (
            <PandaRow key={item.id} item={item} last={index === items.length - 1} />
          ))}
        </View>
      )}
    </View>
  );
}

function Contributions() {
  const [items, setItems] = useState<ContributionRecord[] | null>(null);
  const [pandas, setPandas] = useState<Map<string, PandaListItem> | null>(null);
  useEffect(() => {
    void loadMyContributions()
      .then(setItems)
      .catch(() => setItems(null));
    void loadPandaIndex().then((list) => setPandas(new Map(list.map((panda) => [panda.id, panda]))));
  }, []);
  if (!items || !pandas || items.length === 0) return null;
  return (
    <View className="gap-2">
      <Text variant="h2">{`我的纠错　${items.length}`}</Text>
      <View>
        {items.map((item, index) => {
          const panda = pandas.get(item.targetPandaId);
          const name = panda?.name ?? "熊猫";
          const status = statusLabel(item.status);
          return (
            <Pressable
              key={item.submissionId}
              disabled={!panda}
              onPress={() => panda && openPanda(panda.slug)}
              role="button"
              accessibilityLabel={`${name}，${status}`}
              className={cn(
                "gap-0.5 border-t-hairline border-border py-3 active:bg-accent",
                index === items.length - 1 && "border-b-hairline",
              )}
            >
              <View className="flex-row items-center justify-between gap-3">
                <Text className="min-w-0 flex-1 font-bold" numberOfLines={1}>
                  {name}
                </Text>
                <Text
                  className={cn(item.status === "accepted" ? "text-highlight-foreground" : "text-muted-foreground")}
                >
                  {status}
                </Text>
              </View>
              <Text variant="muted">{`${shortDay(item.submittedAt.slice(0, 10))}提交`}</Text>
              {item.statusExplanation ? <Text variant="muted">{item.statusExplanation}</Text> : null}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export default function MeScreen() {
  const { state, signOut } = useSession();
  return (
    <Page title="我的" back={false}>
      {state.status === "loading" ? <Skeleton className="h-16 w-full" accessibilityLabel="正在加载" /> : null}
      {state.status === "signedOut" ? <SignedOut /> : null}
      {state.status === "unavailable" ? (
        <Text className="text-muted-foreground">账号暂时不可用，请稍后再试。</Text>
      ) : null}
      {state.status === "signedIn" ? <Profile email={state.email} /> : null}
      {state.status === "signedIn" ? <Following /> : null}
      {state.status === "signedIn" ? <Contributions /> : null}
      {state.status === "signedIn" ? <Entries /> : null}
      {state.status === "signedIn" || state.status === "unavailable" ? (
        <View className="border-t-hairline border-border pt-4">
          <Button variant="secondary" className="self-start" onPress={() => void signOut()}>
            <Text>退出登录</Text>
          </Button>
        </View>
      ) : null}
    </Page>
  );
}

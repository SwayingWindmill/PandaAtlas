import { router } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { TextInput, View } from "react-native";
import { useCSSVariable } from "uniwind";

import { Page } from "@/components/page";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import { useSession } from "@/features/session/session";
import { authedApi } from "@/lib/api";

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

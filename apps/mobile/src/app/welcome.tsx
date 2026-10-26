import { Image } from "expo-image";
import { router } from "expo-router";
import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { Pressable, View } from "react-native";

import { Page } from "@/components/page";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import { setFollowing } from "@/features/engagement/favorites";
import { suggestions } from "@/features/onboarding/suggestions";
import { markWelcomeSeen } from "@/features/onboarding/welcome";
import { type PandaListItem, loadPandaIndex, searchPandas } from "@/features/pandas/pandas";
import { SearchField } from "@/features/pandas/search-field";
import { useSession } from "@/features/session/session";
import { usePandaCover } from "@/lib/covers";
import { cn } from "@/lib/utils";

function Tile({ panda, selected, onToggle }: { panda: PandaListItem; selected: boolean; onToggle: () => void }) {
  const photo = usePandaCover(panda.id);
  return (
    <Pressable
      onPress={onToggle}
      role="checkbox"
      accessibilityLabel={panda.name}
      accessibilityState={{ checked: selected }}
      className={cn(
        "basis-[31%] grow gap-1.5 rounded-lg border-hairline border-border p-2 active:bg-accent",
        selected && "border-highlight-foreground bg-highlight-soft",
      )}
    >
      <View className="aspect-square items-center justify-center overflow-hidden rounded-md bg-accent">
        {photo ? (
          <Image source={photo} style={{ width: "100%", height: "100%" }} contentFit="cover" accessible={false} />
        ) : (
          <Text className="text-2xl font-extrabold">{panda.name.slice(0, 1)}</Text>
        )}
      </View>
      <Text className={cn("text-center", selected && "font-bold")} numberOfLines={1}>
        {panda.name}
      </Text>
    </Pressable>
  );
}

export default function WelcomeScreen() {
  const { state: session } = useSession();
  const [pandas, setPandas] = useState<PandaListItem[] | null>(null);
  const [query, setQuery] = useState("");
  const deferred = useDeferredValue(query);
  const [selected, setSelected] = useState<PandaListItem[]>([]);
  const [status, setStatus] = useState<"idle" | "following" | "failed">("idle");

  useEffect(() => {
    loadPandaIndex()
      .then(setPandas)
      .catch(() => setPandas([]));
  }, []);

  const shown = useMemo(
    () => (pandas ? (deferred.trim() ? searchPandas(pandas, deferred).slice(0, 12) : suggestions(pandas)) : []),
    [pandas, deferred],
  );
  const isSelected = (panda: PandaListItem) => selected.some((item) => item.id === panda.id);

  function toggle(panda: PandaListItem) {
    setSelected((current) =>
      current.some((item) => item.id === panda.id)
        ? current.filter((item) => item.id !== panda.id)
        : [...current, panda],
    );
  }

  async function finish() {
    await markWelcomeSeen();
    router.replace("/");
  }

  async function follow() {
    if (session.status !== "signedIn") {
      router.push("/sign-in");
      return;
    }
    setStatus("following");
    const results = await Promise.all(selected.map((panda) => setFollowing(panda.id, true)));
    if (results.every(Boolean)) await finish();
    else setStatus("failed");
  }

  const signedIn = session.status === "signedIn";
  return (
    <Page label="欢迎来到知熊猫" title="先关注几只熊猫" back={false} keyboardShouldPersistTaps="handled">
      <Text className="text-muted-foreground">
        这里有大熊猫的资料、家谱和住处。关注几只你喜欢的，它们有新资料时会出现在「今天」。
      </Text>
      <SearchField value={query} onChange={setQuery} label="搜索想关注的熊猫" />
      {pandas === null ? (
        <Skeleton className="h-64 w-full" accessibilityLabel="正在加载熊猫" />
      ) : (
        <View className="flex-row flex-wrap gap-2">
          {shown.map((panda) => (
            <Tile key={panda.id} panda={panda} selected={isSelected(panda)} onToggle={() => toggle(panda)} />
          ))}
        </View>
      )}
      {selected.length > 0 ? (
        <Text className="text-muted-foreground">{`已选：${selected.map((panda) => panda.name).join("、")}`}</Text>
      ) : null}
      {status === "failed" ? <Text className="text-destructive">有几只没能关注，请再试一次。</Text> : null}
      <View className="gap-2">
        <Button onPress={() => void follow()} disabled={selected.length === 0 || status === "following"}>
          <Text>
            {selected.length === 0
              ? "选几只熊猫"
              : signedIn
                ? `关注这 ${selected.length} 只`
                : `登录并关注这 ${selected.length} 只`}
          </Text>
        </Button>
        <Button variant="ghost" onPress={() => void finish()}>
          <Text>先逛逛</Text>
        </Button>
      </View>
    </Page>
  );
}

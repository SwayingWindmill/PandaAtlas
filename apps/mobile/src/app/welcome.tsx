import { Image } from "expo-image";
import { router } from "expo-router";
import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Icon } from "@/components/icon";
import { Check } from "@/components/icons";
import { Page } from "@/components/page";
import { PhotoOutline } from "@/components/photo-outline";
import { PressScale } from "@/components/press-scale";
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
import { tapHaptic } from "@/lib/haptics";
import { HAIRLINE, RADIUS } from "@/lib/surface";
import { cn } from "@/lib/utils";

const COLUMNS = 3;

function rows<T>(items: readonly T[]): T[][] {
  const out: T[][] = [];
  for (let start = 0; start < items.length; start += COLUMNS) out.push(items.slice(start, start + COLUMNS));
  return out;
}

/** A panda to follow: its cover, its name, and a jade ring with a check once chosen, as Photos marks a pick. */
function Tile({ panda, selected, onToggle }: { panda: PandaListItem; selected: boolean; onToggle: () => void }) {
  const photo = usePandaCover(panda.id);
  return (
    <PressScale
      onPress={() => {
        tapHaptic();
        onToggle();
      }}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={panda.name}
      containerStyle={{ flex: 1 }}
      className="gap-stack-tight"
    >
      <View
        className={cn("rounded-tile border-2 p-hair-gap", selected ? "border-primary" : "border-transparent")}
        style={{ borderCurve: "continuous" }}
      >
        <View
          className="aspect-square items-center justify-center overflow-hidden rounded-control bg-secondary"
          style={{ borderCurve: "continuous" }}
        >
          {photo ? (
            <Image source={photo} style={{ width: "100%", height: "100%" }} contentFit="cover" accessible={false} />
          ) : (
            <Text variant="title" role="none" className="text-muted-foreground">
              {panda.name.slice(0, 1)}
            </Text>
          )}
          {photo ? <PhotoOutline radius={RADIUS.control} /> : null}
        </View>
        {selected ? (
          <View className="absolute right-stack-tight top-stack-tight size-6 items-center justify-center rounded-pill bg-primary">
            <Icon icon={Check} size="footnote" tone="onMedia" strokeWidth={3} />
          </View>
        ) : null}
      </View>
      <Text
        variant="subheadline"
        className={cn("text-center", selected && "font-semibold text-primary")}
        numberOfLines={1}
      >
        {panda.name}
      </Text>
    </PressScale>
  );
}

export default function WelcomeScreen() {
  const insets = useSafeAreaInsets();
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
    <View className="flex-1 bg-background">
      <Page label="欢迎来到吱熊猫" title="先关注几只熊猫" back={false} keyboardShouldPersistTaps="handled">
        <SearchField value={query} onChange={setQuery} label="搜索想关注的熊猫" />
        {pandas === null ? (
          <View className="gap-row" accessibilityLabel="正在加载熊猫">
            {[0, 1].map((row) => (
              <View key={row} className="flex-row gap-row">
                {[0, 1, 2].map((cell) => (
                  <Skeleton key={cell} className="aspect-square flex-1 rounded-tile" />
                ))}
              </View>
            ))}
          </View>
        ) : shown.length === 0 ? (
          <Text variant="footnote" className="px-inset text-muted-foreground">
            没有找到这只熊猫
          </Text>
        ) : (
          <View className="gap-inset">
            {rows(shown).map((row) => (
              <View key={row.map((panda) => panda.id).join()} className="flex-row gap-row">
                {row.map((panda) => (
                  <Tile key={panda.id} panda={panda} selected={isSelected(panda)} onToggle={() => toggle(panda)} />
                ))}
                {Array.from({ length: COLUMNS - row.length }, (_, index) => (
                  <View key={`gap-${index}`} className="flex-1" />
                ))}
              </View>
            ))}
          </View>
        )}
      </Page>
      <View className="gap-stack-tight bg-background px-inset pt-row" style={{ paddingBottom: insets.bottom + 12 }}>
        <View className="absolute inset-x-0 top-0 bg-border" style={{ height: HAIRLINE }} />
        {selected.length > 0 ? (
          <Text variant="footnote" className="text-center text-muted-foreground" numberOfLines={1}>
            {`已选：${selected.map((panda) => panda.name).join("、")}`}
          </Text>
        ) : null}
        {status === "failed" ? (
          <Text variant="footnote" className="text-center text-destructive">
            有几只没能关注，请再试一次。
          </Text>
        ) : null}
        <Button onPress={() => void follow()} disabled={selected.length === 0 || status === "following"}>
          <Text>
            {selected.length === 0
              ? "选几只熊猫"
              : signedIn
                ? `关注这 ${selected.length} 只`
                : `登录并关注这 ${selected.length} 只`}
          </Text>
        </Button>
        <Button variant="plain" onPress={() => void finish()}>
          <Text>先逛逛</Text>
        </Button>
      </View>
    </View>
  );
}

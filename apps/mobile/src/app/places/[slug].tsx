import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Pressable, View } from "react-native";

import { LoadFailed } from "@/components/load-failed";
import { Page } from "@/components/page";
import { Skeleton } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import { loadPlacePage } from "@/features/map/load";
import { type PlacePage } from "@/features/map/model";
import { openPanda } from "@/features/pandas/panda-row";
import { cn } from "@/lib/utils";

export default function PlaceScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const [place, setPlace] = useState<PlacePage | null>(null);
  const [missing, setMissing] = useState(false);
  const [failed, setFailed] = useState(false);

  const load = useCallback(() => {
    loadPlacePage(slug)
      .then((page) => {
        if (page) setPlace(page);
        else setMissing(true);
      })
      .catch(() => setFailed(true));
  }, [slug]);
  useEffect(load, [load]);

  function retry() {
    setFailed(false);
    setMissing(false);
    load();
  }

  if (!place) {
    return (
      <Page title="地点">
        {failed ? (
          <LoadFailed message="这一页暂时打不开。" onRetry={retry} />
        ) : missing ? (
          <Text className="text-muted-foreground">没有这个地点。</Text>
        ) : (
          <Skeleton className="h-24 w-full" accessibilityLabel="正在加载" />
        )}
      </Page>
    );
  }

  const institution = place.institution;
  return (
    <Page label={place.where ?? undefined} title={place.name}>
      {institution ? (
        <Pressable
          onPress={() => router.push({ pathname: "/institutions/[slug]", params: { slug: institution.slug } })}
          role="button"
          accessibilityLabel={`${institution.name}，基地和动物园`}
          className="flex-row items-center gap-3 border-b-hairline border-t-hairline border-border py-3 active:bg-accent"
        >
          <View className="min-w-0 flex-1">
            <Text className="font-bold">{institution.name}</Text>
            <Text variant="muted">基地和动物园</Text>
          </View>
          <Text className="text-muted-foreground">›</Text>
        </Pressable>
      ) : null}
      {place.residents.length > 0 ? (
        <View className="gap-3">
          <Text variant="h2">住在这里的熊猫</Text>
          <View>
            {place.residents.map((panda, index) => (
              <Pressable
                key={panda.id}
                onPress={() => openPanda(panda.slug)}
                role="button"
                accessibilityLabel={panda.name}
                className={cn(
                  "flex-row items-center justify-between border-t-hairline border-border py-3 active:bg-accent",
                  index === place.residents.length - 1 && "border-b-hairline",
                )}
              >
                <Text className="font-bold">{panda.name}</Text>
                <Text className="text-muted-foreground">›</Text>
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}
    </Page>
  );
}

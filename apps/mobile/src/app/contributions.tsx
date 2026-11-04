import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, View } from "react-native";

import { LoadFailed } from "@/components/load-failed";
import { Page } from "@/components/page";
import { ScreenState } from "@/components/screen-state";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import { statusLabel } from "@/features/corrections/correction";
import { type ContributionRecord, loadMyContributions } from "@/features/corrections/submissions";
import { shortDay } from "@/features/engagement/seen";
import { openPanda } from "@/features/pandas/panda-row";
import { type PandaListItem, loadPandaIndex } from "@/features/pandas/pandas";
import { HAIRLINE } from "@/lib/surface";

/** 我的纠错, opened from 我的: each report the fan sent, its status and the editors' note. */
export default function ContributionsScreen() {
  const [items, setItems] = useState<ContributionRecord[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [pandas, setPandas] = useState<Map<string, PandaListItem>>(new Map());
  const load = useCallback(() => {
    setFailed(false);
    loadMyContributions()
      .then(setItems)
      .catch(() => setFailed(true));
    loadPandaIndex()
      .then((list) => setPandas(new Map(list.map((panda) => [panda.id, panda]))))
      .catch(() => undefined);
  }, []);
  // Read again whenever the page shows, so a report sent from a profile appears on return.
  useFocusEffect(load);

  return (
    <Page title="我的纠错">
      {failed ? <LoadFailed message="纠错记录暂时打不开。" onRetry={load} /> : null}
      {!failed && items === null ? <Skeleton className="h-44 w-full rounded-group" accessibilityLabel="正在加载" /> : null}
      {items && items.length === 0 ? <ScreenState message="在熊猫资料页点「告诉我们」，发出的纠错会列在这里。" /> : null}
      {items && items.length > 0 ? (
        <View className="overflow-hidden rounded-group bg-card" style={{ borderCurve: "continuous" }}>
          {items.map((item, index) => {
            const panda = pandas.get(item.targetPandaId);
            const name = panda?.name ?? "熊猫";
            const status = statusLabel(item.status);
            return (
              <View key={item.submissionId}>
                <Pressable
                  disabled={!panda}
                  onPress={() => panda && openPanda(panda.slug)}
                  role="button"
                  accessibilityLabel={`${name}，${status}`}
                  className="min-h-11 gap-hair-gap px-inset py-row active:bg-accent"
                >
                  <View className="flex-row items-center justify-between gap-row">
                    <Text variant="headline" className="min-w-0 flex-1" numberOfLines={1}>
                      {name}
                    </Text>
                    <Badge variant={item.status === "accepted" ? "tint" : "neutral"}>
                      <Text>{status}</Text>
                    </Badge>
                  </View>
                  <Text variant="footnote" className="text-muted-foreground tabular-nums">
                    {`${shortDay(item.submittedAt.slice(0, 10))}提交`}
                  </Text>
                  {item.statusExplanation ? (
                    <Text variant="subheadline" className="text-muted-foreground">
                      {item.statusExplanation}
                    </Text>
                  ) : null}
                </Pressable>
                {index < items.length - 1 ? <View className="ml-inset bg-border" style={{ height: HAIRLINE }} /> : null}
              </View>
            );
          })}
        </View>
      ) : null}
    </Page>
  );
}

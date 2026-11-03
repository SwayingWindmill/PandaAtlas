import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, View } from "react-native";

import { useStacked } from "@/components/grouped-list";
import { SectionHeader } from "@/components/section-header";
import { Text } from "@/components/ui/text";
import { cn } from "@/lib/utils";

import { type DigestGroup, type WeekDigest, namesLine } from "./week";
import { type Week, loadWeek } from "./week-data";

/** Counts the card shows side by side; the rest are on 本周新鲜事. */
const TALLIES_SHOWN = 3;

export interface Tally {
  count: number;
  label: string;
}

/** The week's counts in news order: births and moves before a bulk of new records, photos last. */
export function tallies(digest: WeekDigest): Tally[] {
  const groups = digest.groups.map((group) => ({
    count: group.pandaIds.length,
    label: group.label,
  }));
  return digest.photos > 0 ? [...groups, { count: digest.photos, label: "新照片" }] : groups;
}

/** "新生：宝力、青宝". The first group with names, which is the most newsworthy one. */
export function headline(group: DigestGroup | undefined, pandas: Week["pandas"]): string | null {
  if (!group) return null;
  const names = group.pandaIds.flatMap((id) => pandas.get(id)?.name ?? []);
  return names.length > 0 ? `${group.label}：${namesLine(names)}` : null;
}

/**
 * 本周新鲜事 on 今天: a few counts and the names behind the first of them, one tap from the whole week. It is
 * there only when the week brought news, and says nothing otherwise: no "nothing new" card, no push. A load
 * that fails leaves 今天 as it was; the page itself says when it cannot load.
 */
export function WeekCard() {
  const [week, setWeek] = useState<Week | null>(null);
  const stacked = useStacked();

  useFocusEffect(
    useCallback(() => {
      let live = true;
      loadWeek()
        .then((next) => live && setWeek(next))
        .catch(() => live && setWeek(null));
      return () => {
        live = false;
      };
    }, []),
  );

  const digest = week?.digest;
  if (!week || !digest) return null;
  const shown = tallies(digest).slice(0, TALLIES_SHOWN);
  const names = headline(digest.groups[0], week.pandas);
  const summary = shown.map((tally) => `${tally.label} ${tally.count}`).join("，");

  return (
    <View className="gap-row">
      <SectionHeader
        title="本周新鲜事"
        action={{
          label: "全部",
          href: "/week",
          accessibilityLabel: "本周新鲜事全部",
        }}
      />
      <Pressable
        onPress={() => router.push("/week")}
        role="button"
        accessibilityLabel={`本周新鲜事，${digest.range}。${summary}${names ? `。${names}` : ""}`}
        className="gap-stack rounded-card bg-card p-inset active:bg-accent"
        style={{ borderCurve: "continuous" }}
      >
        <Text variant="footnote" className="text-muted-foreground">
          {digest.range}
        </Text>
        {/* At large text the tallies become a list, "2 搬家" per line, so three of them stay short. */}
        <View className={cn(stacked ? "gap-hair-gap" : "flex-row gap-stack")}>
          {shown.map((tally) => (
            <View
              key={tally.label}
              className={cn("min-w-0", stacked ? "flex-row flex-wrap items-baseline gap-stack-tight" : "flex-1")}
            >
              <Text variant={stacked ? "headline" : "stat"} style={{ fontVariant: ["tabular-nums"] }}>
                {tally.count.toLocaleString("zh-CN")}
              </Text>
              <Text
                variant={stacked ? "body" : "footnote"}
                className="text-muted-foreground"
                numberOfLines={stacked ? undefined : 1}
              >
                {tally.label}
              </Text>
            </View>
          ))}
        </View>
        {names ? (
          <Text variant="subheadline" numberOfLines={stacked ? undefined : 2}>
            {names}
          </Text>
        ) : null}
      </Pressable>
    </View>
  );
}

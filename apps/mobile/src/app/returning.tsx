import { useQuery } from "@tanstack/react-query";
import { router, Stack } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import Animated from "react-native-reanimated";

import { Chip } from "@/components/chip";
import { Chevron, useStacked } from "@/components/grouped-list";
import { Icon } from "@/components/icon";
import { MapPin, Plane } from "@/components/icons";
import { LoadFailed } from "@/components/load-failed";
import { PandaThumb } from "@/components/panda-thumb";
import { ScreenState } from "@/components/screen-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import { PAGE_ENTER } from "@/design/motion";
import { institutionListQueryOptions } from "@/features/institutions/institutions";
import {
  type OverseasStage,
  type OverseasStatusItem,
  type ReturnGroup,
  loadOverseasStatus,
  returnMeta,
  returnSections,
} from "@/features/overseas/overseas-status";
import { type PandaListItem, pandaIndexQueryOptions } from "@/features/pandas/pandas";
import { useBottomClearance } from "@/lib/bottom-clearance";
import { usePullToRefresh } from "@/lib/pull-to-refresh";
import { PAGE_COLUMN } from "@/lib/surface";
import { cn } from "@/lib/utils";

const PHOTO = 36;
const ALL = "全部";
const COUNTRY: Record<string, string> = {
  US: "美国",
  JP: "日本",
  KR: "韩国",
  GB: "英国",
  DE: "德国",
  FR: "法国",
  AT: "奥地利",
  ES: "西班牙",
  BE: "比利时",
  NL: "荷兰",
  FI: "芬兰",
  DK: "丹麦",
  AU: "澳大利亚",
  MY: "马来西亚",
  TH: "泰国",
  SG: "新加坡",
  ID: "印度尼西亚",
  QA: "卡塔尔",
  MX: "墨西哥",
  RU: "俄罗斯",
};

function stageBadge(stage: OverseasStage): { label: string; abroad: boolean } {
  if (stage === "returned") return { label: "已归国", abroad: false };
  if (stage === "abroad") return { label: "现居海外", abroad: true };
  return { label: "即将归国", abroad: false };
}

function ReturnRouteCard({
  group,
  pandas,
  place,
}: {
  group: ReturnGroup;
  pandas: Map<string, PandaListItem>;
  place: string;
}) {
  const stacked = useStacked();
  const meta = returnMeta(group);
  const { label: statusLabel, abroad } = stageBadge(group.stage);
  const destination = abroad ? "旅居展馆" : "中国";

  const rows: OverseasStatusItem[][] = [];
  if (stacked || group.items.length <= 1) {
    for (const item of group.items) rows.push([item]);
  } else {
    for (let index = 0; index < group.items.length; index += 2) {
      rows.push(group.items.slice(index, index + 2));
    }
  }

  return (
    <View
      className="gap-row rounded-card border-hairline border-border bg-card p-3.5"
      style={{ borderCurve: "continuous" }}
    >
      <View className={stacked ? "items-start gap-hair-gap" : "flex-row items-center justify-between gap-row"}>
        <View
          className={cn("rounded-pill px-2.5 py-0.5", abroad ? "bg-secondary" : "bg-highlight-soft")}
          style={{ borderCurve: "continuous" }}
        >
          <Text variant="footnote" className={cn("font-semibold", abroad ? "text-muted-foreground" : "text-primary")}>
            {statusLabel}
          </Text>
        </View>
        {meta ? (
          <Text variant="footnote" className="font-medium text-muted-foreground tabular-nums">
            {meta}
          </Text>
        ) : null}
      </View>

      {stacked ? (
        <View className="gap-hair-gap">
          <Text variant="headline" className="font-bold">
            {place}
          </Text>
          <View className="flex-row items-center gap-1.5">
            <Icon icon={abroad ? MapPin : Plane} size="footnote" tone={abroad ? "secondary" : "tint"} />
            <Text variant="subheadline" className={abroad ? "text-muted-foreground" : "font-semibold text-primary"}>
              {destination}
            </Text>
          </View>
        </View>
      ) : (
        <View className="flex-row items-center gap-2">
          <Text variant="headline" className="min-w-0 shrink font-bold" numberOfLines={1}>
            {place}
          </Text>
          <View className="min-w-6 flex-1 flex-row items-center gap-1.5" aria-hidden>
            <View className={cn("flex-1 border-t border-dashed", abroad ? "border-border" : "border-primary/50")} />
            <Icon icon={abroad ? MapPin : Plane} size="footnote" tone={abroad ? "secondary" : "tint"} />
            <View className={cn("flex-1 border-t border-dashed", abroad ? "border-border" : "border-primary/50")} />
          </View>
          <Text variant="headline" className={cn("shrink-0 font-bold", abroad && "text-muted-foreground")} numberOfLines={1}>
            {destination}
          </Text>
        </View>
      )}

      <View className="gap-stack-tight">
        {rows.map((row, rowIndex) => (
          <View key={rowIndex} className={stacked || row.length <= 1 ? "gap-stack-tight" : "flex-row gap-stack-tight"}>
            {row.map((item) => {
              const panda = pandas.get(item.pandaSlug);
              const pandaName = panda?.name ?? item.pandaSlug;
              return (
                <Pressable
                  key={item.pandaSlug}
                  role="link"
                  accessibilityLabel={`查看${pandaName}的档案`}
                  onPress={() => router.push({ pathname: "/pandas/[slug]", params: { slug: item.pandaSlug } })}
                  className={cn(
                    "min-h-11 flex-row items-center gap-2.5 rounded-control border-hairline border-border bg-background px-2.5 py-2 active:opacity-75",
                    !stacked && row.length > 1 && "min-w-0 flex-1",
                  )}
                  style={{ borderCurve: "continuous" }}
                >
                  <PandaThumb pandaId={panda?.id ?? item.pandaSlug} name={pandaName} size={PHOTO} shape="round" />
                  <View className="min-w-0 flex-1">
                    <Text variant="subheadline" className="font-semibold" numberOfLines={stacked ? undefined : 1}>
                      {pandaName}
                    </Text>
                    <Text variant="footnote" className="text-muted-foreground" numberOfLines={1}>
                      查看档案
                    </Text>
                  </View>
                  <Chevron />
                </Pressable>
              );
            })}
          </View>
        ))}
      </View>
    </View>
  );
}

/**
 * 归国与旅居 (v4.5): Flighty-style route cards with independent tappable panda profile cards,
 * keeping stack title `归国熊猫` for route continuity.
 */
export default function ReturningScreen() {
  const bottom = useBottomClearance();
  const refreshControl = usePullToRefresh();
  const status = useQuery({ queryKey: ["overseas-status"], queryFn: loadOverseasStatus });
  const index = useQuery(pandaIndexQueryOptions());
  const institutions = useQuery(institutionListQueryOptions());
  const [country, setCountry] = useState(ALL);
  const pandas = new Map((index.data ?? []).map((panda) => [panda.slug, panda]));
  const venues = new Map((institutions.data ?? []).map((item) => [item.slug, item]));
  const countryOf = (slug: string) => {
    const code = venues.get(slug)?.countryCode;
    return code ? (COUNTRY[code] ?? null) : null;
  };

  const items = status.data ?? [];
  const countries = [...new Set(items.flatMap((item) => countryOf(item.institutionSlug) ?? []))];
  const shown = country === ALL ? items : items.filter((item) => countryOf(item.institutionSlug) === country);

  return (
    <>
      <Stack.Screen options={{ title: "归国熊猫", headerLargeTitleEnabled: false }} />
      <ScrollView
        className="flex-1 bg-background"
        contentInsetAdjustmentBehavior="automatic"
        contentContainerClassName="gap-6 px-gutter"
        refreshControl={refreshControl}
        contentContainerStyle={[PAGE_COLUMN, { paddingBottom: bottom }]}
      >
        <View className="gap-hair-gap pt-stack-tight">
          <Text variant="footnote" className="font-semibold text-primary">
            海外合作与归国行程
          </Text>
          <Text variant="display" aria-level="2">
            归国与旅居
          </Text>
        </View>

      {status.isError ? (
        <LoadFailed message="归国熊猫暂时打不开。" onRetry={() => void status.refetch()} />
      ) : !status.data ? (
        <View className="gap-row" accessibilityLabel="正在加载">
          <Skeleton className="h-8 w-2/3 rounded-pill" />
          <Skeleton className="h-40 w-full rounded-group" />
        </View>
      ) : items.length === 0 ? (
        <ScreenState message="暂无记录" />
      ) : (
        <Animated.View entering={PAGE_ENTER} className="gap-section-tight">
          {countries.length > 1 ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              className="-mx-gutter"
              contentContainerClassName="gap-stack-tight px-gutter"
            >
              {[ALL, ...countries].map((name) => (
                <Chip key={name} label={name} appearance="ink" selected={country === name} onPress={() => setCountry(name)} />
              ))}
            </ScrollView>
          ) : null}

          {returnSections(shown).map((section) => (
            <View key={section.title} className="gap-stack-tight">
              <Text variant="headline" role="heading" className="px-1 tabular-nums">
                {section.title}
              </Text>
              <View className="gap-row">
                {section.groups.map((group) => (
                  <ReturnRouteCard
                    key={group.key}
                    group={group}
                    pandas={pandas}
                    place={venues.get(group.institutionSlug)?.nameZh ?? group.institutionSlug}
                  />
                ))}
              </View>
            </View>
          ))}

          <Text variant="footnote" className="px-1 text-center text-muted-foreground">
            整理自官方合作与旅居公告，点选任意头像直达档案
          </Text>
        </Animated.View>
      )}
      </ScrollView>
    </>
  );
}

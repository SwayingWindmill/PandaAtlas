import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Linking, Pressable, View } from "react-native";

import { Chip } from "@/components/chip";
import { Chevron, useStacked } from "@/components/grouped-list";
import { Icon } from "@/components/icon";
import { Moon, Sun, Video } from "@/components/icons";
import { LoadFailed } from "@/components/load-failed";
import { Page } from "@/components/page";
import { PandaThumb } from "@/components/panda-thumb";
import { ScreenState } from "@/components/screen-state";
import { SectionHeader } from "@/components/section-header";
import { Skeleton } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import {
  type LiveHallFilter,
  type LiveHallVenue,
  buildLiveHallModel,
} from "@/features/explore/live-hall";
import { institutionListQueryOptions } from "@/features/institutions/institutions";
import { mapViewQueryOptions } from "@/features/map/load";
import { VenueActivityBar, venueStatusColorOf } from "@/features/viewing/venue-live-card";
import { HAIRLINE } from "@/lib/surface";
import { useIOSColors } from "@/lib/theme";
import { cn } from "@/lib/utils";

const FILTERS: readonly { key: LiveHallFilter; label: string }[] = [
  { key: "all", label: "全部" },
  { key: "live", label: "有直播" },
  { key: "active", label: "正在活跃" },
  { key: "overseas", label: "海外" },
];

const AWAKE_THUMB = 72;
const RESTING_THUMB = 40;

function AwakeVenueCard({ venue }: { venue: LiveHallVenue }) {
  const colors = useIOSColors();
  const stacked = useStacked();
  const statusColor = venueStatusColorOf(venue.status, colors);
  const lead = venue.residents[0];
  const namesText =
    venue.residents.length > 0
      ? venue.residents
          .slice(0, 3)
          .map((item) => item.name)
          .join("　")
      : `${venue.residentCount} 只在馆`;

  const openVenue = () => router.push({ pathname: "/institutions/[slug]", params: { slug: venue.slug } });

  return (
    <View
      className="gap-3 rounded-group border-hairline border-border bg-card p-3.5"
      style={{ borderCurve: "continuous" }}
    >
      <Pressable
        role="button"
        accessibilityLabel={`${venue.name}，当地 ${venue.localTime}，${venue.statusLabel}，${namesText}`}
        onPress={openVenue}
        className="flex-row items-center gap-3 active:opacity-75"
      >
        {lead ? (
          <PandaThumb pandaId={lead.id} name={lead.name} size={AWAKE_THUMB} shape="tile" />
        ) : null}
        <View className="min-w-0 flex-1 gap-1">
          <View className="flex-row items-center gap-1.5">
            <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: statusColor }} />
            <Text variant="footnote" className="font-semibold tabular-nums" style={{ color: statusColor }}>
              {`当地 ${venue.localTime}　${venue.statusLabel}`}
            </Text>
          </View>
          <Text variant="headline" numberOfLines={1}>
            {venue.name}
          </Text>
          <Text variant="footnote" className="text-muted-foreground" numberOfLines={1}>
            {namesText}
          </Text>
        </View>
      </Pressable>

      <VenueActivityBar snapshot={venue.snapshot} dotColor={statusColor} cardColor={colors.card} />

      <View className={cn("items-center justify-between gap-2", stacked ? "flex-row flex-wrap" : "flex-row")}>
        <Pressable
          role="link"
          accessibilityLabel={`进入${venue.name}看熊猫`}
          onPress={openVenue}
          hitSlop={6}
          className="min-h-11 flex-row items-center gap-0.5 active:opacity-60"
        >
          <Text variant="subheadline" className="font-semibold text-primary">
            进馆看熊猫
          </Text>
          <Chevron />
        </Pressable>

        {venue.liveCamUrl ? (
          <Pressable
            role="link"
            accessibilityLabel={`看${venue.name}官方直播`}
            onPress={() => void Linking.openURL(venue.liveCamUrl!)}
            hitSlop={6}
            className="min-h-11 flex-row items-center gap-1.5 rounded-pill bg-highlight-soft px-3.5 active:opacity-75"
            style={{ borderCurve: "continuous" }}
          >
            <Icon icon={Video} size="footnote" tone="tint" strokeWidth={2} />
            <Text variant="footnote" className="font-semibold text-primary">
              看直播
            </Text>
          </Pressable>
        ) : (
          <Text variant="footnote" className="text-muted-foreground tabular-nums">
            {venue.snapshot.peakLabel}
          </Text>
        )}
      </View>
    </View>
  );
}

function RestingVenueRow({ venue, last }: { venue: LiveHallVenue; last: boolean }) {
  const lead = venue.residents[0];
  const openVenue = () => router.push({ pathname: "/institutions/[slug]", params: { slug: venue.slug } });

  return (
    <View>
      <View className="flex-row items-center gap-3 px-4 py-3">
        <Pressable
          role="link"
          accessibilityLabel={`${venue.name}，当地 ${venue.localTime}，夜间休整，${venue.nextOpenLabel}`}
          onPress={openVenue}
          className="min-h-11 min-w-0 flex-1 flex-row items-center gap-3 active:opacity-70"
        >
          {lead ? (
            <PandaThumb pandaId={lead.id} name={lead.name} size={RESTING_THUMB} />
          ) : null}
          <View className="min-w-0 flex-1 gap-0.5">
            <Text variant="body" className="font-medium" numberOfLines={1}>
              {venue.name}
            </Text>
            <Text variant="footnote" className="text-muted-foreground tabular-nums" numberOfLines={1}>
              {`当地 ${venue.localTime}　${venue.nextOpenLabel}`}
            </Text>
          </View>
          {venue.liveCamUrl ? null : <Chevron />}
        </Pressable>

        {venue.liveCamUrl ? (
          <Pressable
            role="link"
            accessibilityLabel={`打开${venue.name}官方直播页`}
            onPress={() => void Linking.openURL(venue.liveCamUrl!)}
            hitSlop={6}
            className="min-h-9 shrink-0 justify-center rounded-pill bg-secondary px-3 active:opacity-75"
            style={{ borderCurve: "continuous" }}
          >
            <Text variant="footnote" className="font-medium text-primary">
              官方频道
            </Text>
          </Pressable>
        ) : null}
      </View>
      {last ? null : (
        <View
          className="bg-border"
          style={[{ height: HAIRLINE }, { marginLeft: lead ? 16 + RESTING_THUMB + 12 : 16 }]}
        />
      )}
    </View>
  );
}

export default function LiveHallScreen() {
  const stacked = useStacked();
  const [filter, setFilter] = useState<LiveHallFilter>("all");
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(timer);
  }, []);

  const mapQuery = useQuery(mapViewQueryOptions());
  const instQuery = useQuery(institutionListQueryOptions());

  const model = useMemo(() => {
    const items = mapQuery.data?.items ?? [];
    const instInputs = (instQuery.data ?? []).map((inst) => ({
      slug: inst.slug,
      liveCamUrl: inst.profile?.liveCamUrl ?? null,
    }));
    return buildLiveHallModel(items, instInputs, filter, now);
  }, [filter, instQuery.data, mapQuery.data?.items, now]);

  const countFor = (key: LiveHallFilter): number => {
    switch (key) {
      case "all":
        return model.summary.totalCount;
      case "live":
        return model.summary.liveCount;
      case "active":
        return model.summary.activeCount;
      case "overseas":
        return model.summary.overseasCount;
    }
  };

  if (mapQuery.isLoading && !mapQuery.data) {
    return (
      <Page title="此刻直播与作息" prominent>
        <View className="gap-3" accessibilityLabel="正在加载">
          <Skeleton className="h-32 w-full rounded-group" />
          <Skeleton className="h-44 w-full rounded-group" />
          <Skeleton className="h-44 w-full rounded-group" />
        </View>
      </Page>
    );
  }

  if (mapQuery.isError && !mapQuery.data) {
    return (
      <Page title="此刻直播与作息" prominent>
        <LoadFailed message="全球场馆作息暂时打不开。" onRetry={() => void mapQuery.refetch()} />
      </Page>
    );
  }

  return (
    <Page title="此刻直播与作息" prominent>
      <View
        className="gap-3 rounded-group border-hairline border-border bg-card p-3.5"
        style={{ borderCurve: "continuous" }}
      >
        <View className={stacked ? "gap-2.5" : "flex-row items-stretch gap-2"}>
          {model.pulses.map((pulse) => (
            <View
              key={pulse.key}
              accessible
              accessibilityLabel={`${pulse.label}，当地 ${pulse.localTime}，${pulse.isDaytime ? "日间" : "夜间"}${pulse.activeCount > 0 ? `，${pulse.activeCount} 馆开放中` : ""}`}
              className={cn(
                "gap-0.5 rounded-control bg-background px-3 py-2",
                !stacked && "min-w-0 flex-1",
              )}
              style={{ borderCurve: "continuous" }}
            >
              <View className="flex-row items-center justify-between gap-1">
                <Text variant="footnote" className="font-semibold text-muted-foreground" numberOfLines={1}>
                  {pulse.label}
                </Text>
                <Icon
                  icon={pulse.isDaytime ? Sun : Moon}
                  size={13}
                  tone={pulse.isDaytime ? "tint" : "secondary"}
                  strokeWidth={2}
                />
              </View>
              <Text variant="headline" className="font-bold tabular-nums" numberOfLines={1}>
                {pulse.localTime}
              </Text>
              <Text variant="footnote" className="text-muted-foreground tabular-nums" numberOfLines={1}>
                {pulse.activeCount > 0 ? `${pulse.activeCount} 馆开放` : pulse.isDaytime ? "日间时段" : "夜间休整"}
              </Text>
            </View>
          ))}
        </View>

        <View className="bg-border" style={{ height: HAIRLINE }} />

        <View className={stacked ? "gap-1.5" : "flex-row items-center"}>
          <View className={stacked ? "flex-row justify-between" : "flex-1 items-center"}>
            <Text variant="footnote" className="text-muted-foreground">
              正在活跃
            </Text>
            <Text variant="headline" className="font-bold tabular-nums">
              {`${model.summary.activeCount} 馆`}
            </Text>
          </View>
          {stacked ? null : <View className="h-6 w-hairline bg-border" />}
          <View className={stacked ? "flex-row justify-between" : "flex-1 items-center"}>
            <Text variant="footnote" className="text-muted-foreground">
              可看直播
            </Text>
            <Text variant="headline" className="font-bold text-primary tabular-nums">
              {`${model.summary.liveCount} 馆`}
            </Text>
          </View>
          {stacked ? null : <View className="h-6 w-hairline bg-border" />}
          <View className={stacked ? "flex-row justify-between" : "flex-1 items-center"}>
            <Text variant="footnote" className="text-muted-foreground">
              午休或闭园
            </Text>
            <Text variant="headline" className="font-bold text-muted-foreground tabular-nums">
              {`${model.summary.restingCount} 馆`}
            </Text>
          </View>
        </View>
      </View>

      <View className="flex-row flex-wrap gap-2">
        {FILTERS.map((item) => {
          const count = countFor(item.key);
          const label = count > 0 ? `${item.label} ${count}` : item.label;
          return (
            <Chip
              key={item.key}
              label={label}
              appearance="ink"
              selected={filter === item.key}
              onPress={() => setFilter(item.key)}
            />
          );
        })}
      </View>

      {model.awake.length === 0 && model.resting.length === 0 ? (
        <ScreenState message="暂无符合筛选条件的场馆作息。" />
      ) : null}

      {model.awake.length > 0 ? (
        <View className="gap-stack-tight">
          <SectionHeader title="日间开放与活跃" count={`${model.awake.length} 馆`} />
          <View className="gap-3">
            {model.awake.map((venue) => (
              <AwakeVenueCard key={venue.slug} venue={venue} />
            ))}
          </View>
        </View>
      ) : null}

      {model.resting.length > 0 ? (
        <View className="gap-stack-tight">
          <SectionHeader title="夜间休整" count={`${model.resting.length} 馆`} />
          <View
            className="overflow-hidden rounded-group border-hairline border-border bg-card"
            style={{ borderCurve: "continuous" }}
          >
            {model.resting.map((venue, index) => (
              <RestingVenueRow
                key={venue.slug}
                venue={venue}
                last={index === model.resting.length - 1}
              />
            ))}
          </View>
        </View>
      ) : null}

      <Text variant="footnote" className="text-muted-foreground">
        各场馆作息均按当地时区实时换算，实际展区开放与直播画面请以各基地官方公布为准。
      </Text>
    </Page>
  );
}

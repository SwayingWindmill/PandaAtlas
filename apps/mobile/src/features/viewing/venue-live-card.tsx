import { useEffect, useState } from "react";
import { Linking, Pressable, View } from "react-native";

import { useStacked } from "@/components/grouped-list";
import { Icon } from "@/components/icon";
import { MapPin, Video } from "@/components/icons";
import { Text } from "@/components/ui/text";
import { component } from "@/design/tokens";
import type { VenueClockStatus } from "@/features/explore/venue-clock";
import { placeOnStrip } from "@/features/viewing/day-window";
import {
  type VenueLiveSnapshot,
  buildVenueLiveSnapshot,
  resolveVenueLiveCamUrl,
} from "@/features/viewing/venue-live";
import { RADIUS } from "@/lib/surface";
import { useIOSColors } from "@/lib/theme";
import { cn } from "@/lib/utils";

type VenueLiveCardProps =
  | {
      variant: "venue";
      slug: string;
      apiLiveCamUrl?: string | null;
    }
  | {
      variant: "panda";
      slug: string;
      venueName: string;
      apiLiveCamUrl?: string | null;
      onOpenVenue: () => void;
    };

export function venueStatusColorOf(
  status: VenueClockStatus,
  colors: ReturnType<typeof useIOSColors>,
): string {
  if (status === "active") return colors.mapWildInk;
  if (status === "upcoming" || status === "nap") return colors.warning;
  return colors.secondaryLabel;
}

export function VenueActivityBar({
  snapshot,
  dotColor,
  cardColor,
  compact = false,
}: {
  snapshot: VenueLiveSnapshot;
  dotColor: string;
  cardColor: string;
  compact?: boolean;
}) {
  const { track, marker } = component.timeBand;
  const span = Math.max(snapshot.range.to - snapshot.range.from, 1);
  const nowPct = Math.min(Math.max(((snapshot.minutes - snapshot.range.from) / span) * 100, 0), 100);
  const dotSize = compact ? marker - 2 : marker;

  return (
    <View
      style={{ height: dotSize }}
      className="justify-center"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <View className="overflow-hidden rounded-pill bg-secondary" style={{ height: compact ? track - 2 : track }}>
        {snapshot.nap ? (
          <View
            className="absolute inset-y-0 rounded-pill bg-tertiary-foreground/40"
            style={{
              left: `${placeOnStrip(snapshot.nap, snapshot.range).left * 100}%`,
              width: `${placeOnStrip(snapshot.nap, snapshot.range).width * 100}%`,
            }}
          />
        ) : null}
        {snapshot.active.map((window, index) => {
          const { left, width } = placeOnStrip(window, snapshot.range);
          return (
            <View
              key={`${window.start}-${window.end}-${index}`}
              className="absolute inset-y-0 rounded-pill bg-graphic"
              style={{ left: `${left * 100}%`, width: `${width * 100}%` }}
            />
          );
        })}
      </View>
      <View
        className="absolute rounded-pill"
        style={{
          left: `${nowPct}%`,
          width: dotSize,
          height: dotSize,
          marginLeft: -dotSize / 2,
          borderWidth: compact ? 2 : 2.5,
          borderColor: dotColor,
          backgroundColor: cardColor,
        }}
      />
    </View>
  );
}

function ScheduleLabels({ snapshot, stacked }: { snapshot: VenueLiveSnapshot; stacked: boolean }) {
  return (
    <View className={cn(stacked ? "gap-1" : "flex-row flex-wrap items-center justify-between gap-x-3 gap-y-1")}>
      <Text variant="footnote" className="text-muted-foreground tabular-nums" numberOfLines={stacked ? undefined : 1}>
        {snapshot.openLabel}
      </Text>
      <Text variant="footnote" className="text-muted-foreground tabular-nums" numberOfLines={stacked ? undefined : 1}>
        {snapshot.peakLabel}
      </Text>
      <Text variant="footnote" className="text-muted-foreground tabular-nums" numberOfLines={stacked ? undefined : 1}>
        {snapshot.closeLabel}
      </Text>
    </View>
  );
}

/** Real-time venue activity card shown on both panda profiles and institution detail screens. */
export function VenueLiveCard(props: VenueLiveCardProps) {
  const colors = useIOSColors();
  const stacked = useStacked();
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(timer);
  }, []);

  const snapshot = buildVenueLiveSnapshot(props.slug, props.apiLiveCamUrl, now);
  const liveCamUrl = snapshot?.liveCamUrl ?? resolveVenueLiveCamUrl(props.slug, props.apiLiveCamUrl);

  if (props.variant === "venue") {
    if (!snapshot) return null;
    const statusColor = venueStatusColorOf(snapshot.status, colors);
    return (
      <View
        className="gap-2.5 border-hairline border-border bg-card px-4 py-3.5"
        style={{ borderRadius: RADIUS.group, borderCurve: "continuous" }}
      >
        <View className="flex-row items-center gap-2.5">
          <View
            className="min-w-0 flex-1 gap-0.5"
            accessible
            accessibilityLabel={`当地 ${snapshot.localTime}，${snapshot.statusLabel}，${snapshot.hint}，${snapshot.openLabel}，${snapshot.peakLabel}，${snapshot.closeLabel}`}
          >
            <View className="flex-row items-center gap-1.5">
              <View className="size-2 rounded-pill" style={{ backgroundColor: statusColor }} />
              <Text variant="subheadline" className="font-semibold tabular-nums" style={{ color: statusColor }}>
                {`当地 ${snapshot.localTime}　${snapshot.statusLabel}`}
              </Text>
            </View>
            <Text variant="footnote" className="text-muted-foreground">
              {snapshot.hint}
            </Text>
          </View>
          {liveCamUrl ? (
            <Pressable
              role="link"
              accessibilityLabel="看官方直播"
              accessibilityHint="在浏览器中打开"
              onPress={() => void Linking.openURL(liveCamUrl)}
              className="-my-1.5 min-h-11 shrink-0 justify-center active:opacity-75"
            >
              <View className="h-8 flex-row items-center gap-1 rounded-pill border-hairline border-border bg-highlight-soft px-3">
                <Icon icon={Video} size="footnote" tone="tint" strokeWidth={2} />
                <Text variant="footnote" className="font-semibold text-primary">
                  看直播
                </Text>
              </View>
            </Pressable>
          ) : null}
        </View>
        <VenueActivityBar snapshot={snapshot} dotColor={statusColor} cardColor={colors.card} />
        <ScheduleLabels snapshot={snapshot} stacked={stacked} />
      </View>
    );
  }

  if (!snapshot && !liveCamUrl) return null;
  const statusColor = snapshot ? venueStatusColorOf(snapshot.status, colors) : colors.secondaryLabel;

  return (
    <View
      className="gap-2.5 bg-card px-4 py-3.5"
      style={{ borderRadius: RADIUS.group, borderCurve: "continuous" }}
    >
      <View className="flex-row items-center gap-2.5">
        <Pressable
          role="link"
          accessibilityLabel={`打开${props.venueName}的页面${snapshot ? `，当地 ${snapshot.localTime}，${snapshot.statusLabel}` : ""}`}
          onPress={props.onOpenVenue}
          className="min-h-11 min-w-0 flex-1 flex-row items-center gap-2.5 active:opacity-70"
        >
          <Icon icon={MapPin} tone="tint" strokeWidth={2} />
          <View className="min-w-0 flex-1 gap-0.5">
            <Text variant="headline" numberOfLines={stacked ? undefined : 2}>
              {props.venueName}
            </Text>
            {snapshot ? (
              <View className="flex-row items-center gap-1.5">
                <View className="size-2 rounded-pill" style={{ backgroundColor: statusColor }} />
                <Text variant="footnote" className="font-semibold tabular-nums" style={{ color: statusColor }}>
                  {`当地 ${snapshot.localTime}　${snapshot.statusLabel}`}
                </Text>
              </View>
            ) : null}
          </View>
        </Pressable>
        {liveCamUrl ? (
          <Pressable
            role="link"
            accessibilityLabel={`看${props.venueName}官方直播`}
            accessibilityHint="在浏览器中打开"
            onPress={() => void Linking.openURL(liveCamUrl)}
            className="-my-1.5 min-h-11 justify-center active:opacity-75"
          >
            <View className="h-8 flex-row items-center gap-1 rounded-pill bg-highlight-soft px-3">
              <Icon icon={Video} size="footnote" tone="tint" strokeWidth={2} />
              <Text variant="footnote" className="font-semibold text-primary">
                看直播
              </Text>
            </View>
          </Pressable>
        ) : null}
      </View>
      {snapshot ? (
        <>
          <VenueActivityBar snapshot={snapshot} dotColor={statusColor} cardColor={colors.card} />
          <ScheduleLabels snapshot={snapshot} stacked={stacked} />
        </>
      ) : null}
    </View>
  );
}

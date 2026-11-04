import { View } from "react-native";

import { Text } from "@/components/ui/text";
import { component } from "@/design/tokens";

/** "08:00" → minutes since midnight. */
export function minutesOf(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

/**
 * A day as a band, as Weather draws its hourly bar: the opening hours as a `graphic` span on the
 * `fill` track from `from` to `to`, and a 笋金 marker at the time now. Open or closed reads from where
 * the marker sits; VoiceOver hears it in words. Times are the venue's own local times.
 */
export function TimeBand({
  open,
  close,
  now,
  from = "06:00",
  to = "20:00",
}: {
  open: string;
  close: string;
  /** Where to draw the marker, in the venue's time. Omit when the venue's time zone is unknown. */
  now?: string;
  from?: string;
  to?: string;
}) {
  const { track, marker } = component.timeBand;
  const start = minutesOf(from);
  const span = minutesOf(to) - start;
  const at = (time: string) => Math.min(Math.max((minutesOf(time) - start) / span, 0), 1) * 100;
  const isOpen = now ? minutesOf(now) >= minutesOf(open) && minutesOf(now) < minutesOf(close) : undefined;
  const spoken = `开放 ${open} 至 ${close}${now ? `，现在 ${now}，${isOpen ? "开放中" : "未开放"}` : ""}`;
  return (
    <View accessible accessibilityLabel={spoken} className="gap-hair-gap">
      <View style={{ height: marker }} className="justify-center">
        <View className="overflow-hidden rounded-pill bg-secondary" style={{ height: track }}>
          <View
            className="absolute rounded-pill bg-graphic"
            style={{ left: `${at(open)}%`, width: `${at(close) - at(open)}%`, top: 0, bottom: 0 }}
          />
        </View>
        {now ? (
          <View
            className="absolute rounded-pill border-card bg-foreground"
            style={{ left: `${at(now)}%`, width: marker, height: marker, marginLeft: -marker / 2, borderWidth: 2 }}
          />
        ) : null}
      </View>
      <View className="flex-row justify-between">
        <Text variant="footnote" className="text-muted-foreground tabular-nums">
          {open}
        </Text>
        <Text variant="footnote" className="text-muted-foreground tabular-nums">
          {close}
        </Text>
      </View>
    </View>
  );
}

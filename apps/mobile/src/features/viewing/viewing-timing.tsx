import { View } from "react-native";

import { ListCell, ListSection } from "@/components/grouped-list";
import { Icon } from "@/components/icon";
import { Camera, Sun } from "@/components/icons";
import { Text } from "@/components/ui/text";
import { component } from "@/design/tokens";
import type { Facility, TimeWindow } from "@/features/institutions/institutions";

import { daySlots, minutesOf, partOfDay, placeOnStrip, spanLabel, stripRange } from "./day-window";

type Viewing = NonNullable<Facility["viewing"]>;

/** "09:00" → "9:00", as the mockup's big hours read. */
const short = (time: string) => time.replace(/^0(\d)/, "$1");
const shortSpan = (window: TimeWindow) => `${short(window.start)}–${short(window.end)}`;

/**
 * The day as one band (v4 `07-venue-guide`): the hours the pandas are usually up in `graphic`, the midday
 * rest in a quiet fill, the rest of the day on the track, hour labels every four hours under it.
 * Decorative: the card's label says the same in words.
 */
export function DayBand({ viewing }: { viewing: Viewing }) {
  const { track } = component.timeBand;
  const range = stripRange([...viewing.active, ...(viewing.nap ? [viewing.nap] : [])]);
  const ticks: number[] = [];
  for (let minutes = Math.ceil(range.from / 240) * 240; minutes <= range.to; minutes += 240) ticks.push(minutes);
  const segment = (window: TimeWindow, className: string, key: string) => {
    const { left, width } = placeOnStrip(window, range);
    return <View key={key} className={`absolute inset-y-0 rounded-pill ${className}`} style={{ left: `${left * 100}%`, width: `${width * 100}%` }} />;
  };
  return (
    <View className="gap-hair-gap" importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
      <View className="overflow-hidden rounded-pill bg-secondary" style={{ height: track }}>
        {viewing.nap ? segment(viewing.nap, "bg-tertiary-foreground/40", "nap") : null}
        {viewing.active.map((window, index) => segment(window, "bg-graphic", `active-${index}`))}
      </View>
      <View className="h-5">
        {ticks.map((minutes) => (
          <Text
            key={minutes}
            variant="footnote"
            numberOfLines={1}
            className="absolute top-0 text-center text-muted-foreground tabular-nums"
            style={{ left: `${((minutes - range.from) / (range.to - range.from)) * 100}%`, width: 40, marginLeft: -20 }}
          >
            {String(minutes / 60)}
          </Text>
        ))}
      </View>
    </View>
  );
}

function Key({ className, label }: { className: string; label: string }) {
  return (
    <View className="flex-row items-center gap-1.5">
      <View className={`rounded-pill ${className}`} style={{ width: 14, height: 6 }} />
      <Text variant="footnote" className="text-muted-foreground">
        {label}
      </Text>
    </View>
  );
}

/**
 * 观猫时机 as the guide's lead card: the first window the pandas are up in large type, the day band, the
 * other windows in a line, a key. Then 拍照点位 as a list: the facility publishes names and times, no photos.
 * Only published times appear; no slot, no card.
 */
export function ViewingTiming({ facility }: { facility: Facility }) {
  const viewing = facility.viewing;
  const slots = viewing ? daySlots(viewing) : [];
  const lead = viewing?.active[0] ?? null;
  const rest = slots.filter((slot) => slot.window !== lead);
  const spoken = slots.map((slot) => `${slot.kind === "nap" ? "午睡" : `${partOfDay(slot.window)}活跃`} ${spanLabel(slot.window)}`).join("，");
  return (
    <>
      {viewing && lead ? (
        <View
          accessible
          accessibilityLabel={`观猫时机，${spoken}`}
          className="gap-row rounded-group bg-card px-inset py-inset"
          style={{ borderCurve: "continuous" }}
        >
          <View className="flex-row items-center gap-stack-tight">
            <Icon icon={Sun} size="footnote" tone="tint" />
            <Text variant="subheadline" className="font-semibold">
              观猫时机
            </Text>
          </View>
          <View className="gap-hair-gap">
            <Text variant="figure">
              {shortSpan(lead)}
            </Text>
            <Text variant="footnote" className="text-muted-foreground">
              {minutesOf(lead.start) < 12 * 60 ? "上午" : "下午"}最活跃
            </Text>
          </View>
          <DayBand viewing={viewing} />
          {rest.length > 0 ? (
            <Text variant="footnote" className="text-muted-foreground tabular-nums">
              {rest.map((slot) => `${slot.kind === "nap" ? "午睡" : partOfDay(slot.window)} ${shortSpan(slot.window)}`).join(" · ")}
            </Text>
          ) : null}
          <View className="flex-row flex-wrap gap-x-inset gap-y-hair-gap">
            <Key className="bg-graphic" label="活跃" />
            {viewing.nap ? <Key className="bg-tertiary-foreground/40" label="午睡" /> : null}
          </View>
        </View>
      ) : null}
      {facility.photoSpots.length > 0 ? (
        <ListSection title="拍照点位" titleIcon={Camera}>
          {facility.photoSpots.map((spot, index) => (
            <ListCell
              key={`${spot.name}-${index}`}
              label={spot.name}
              meta={spot.window ? shortSpan(spot.window) : undefined}
              lines={2}
              last={index === facility.photoSpots.length - 1}
            />
          ))}
        </ListSection>
      ) : null}
    </>
  );
}

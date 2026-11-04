import { View } from "react-native";
import { ListCell, ListSection } from "@/components/grouped-list";
import { Moon, Sun } from "@/components/icons";
import { Text } from "@/components/ui/text";
import type { Facility, TimeWindow } from "@/features/institutions/institutions";
import { daySlots, partOfDay, placeOnStrip, spanLabel, stripRange } from "./day-window";

type Viewing = NonNullable<Facility["viewing"]>;

/**
 * A day strip after Health's sleep schedule and Weather's hourly bar: one track, 笋金 where the
 * pandas are usually up, a quiet fill for the midday rest, hour ticks under it. Decorative: the
 * rows below carry the same times for VoiceOver.
 */
function DayStrip({ viewing }: { viewing: Viewing }) {
  const windows: TimeWindow[] = [...viewing.active, ...(viewing.nap ? [viewing.nap] : [])];
  const range = stripRange(windows);
  const ticks: number[] = [];
  for (let minutes = range.from; minutes <= range.to; minutes += 120) ticks.push(minutes);
  const segment = (window: TimeWindow, className: string, key: string) => {
    const { left, width } = placeOnStrip(window, range);
    return <View key={key} className={`absolute inset-y-0 rounded-full ${className}`} style={{ left: `${left * 100}%`, width: `${width * 100}%` }} />;
  };
  return (
    <View className="gap-2 px-6 pb-1 pt-4" importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
      <View className="h-2.5 overflow-hidden rounded-full bg-secondary">
        {viewing.nap ? segment(viewing.nap, "bg-muted-foreground/35", "nap") : null}
        {viewing.active.map((window, index) => segment(window, "bg-warm", `active-${index}`))}
      </View>
      <View className="h-5">
        {ticks.map((minutes) => (
          <Text
            key={minutes}
            variant="footnote"
            numberOfLines={1}
            className="absolute top-0 text-center text-muted-foreground tabular-nums"
            style={{ left: `${((minutes - range.from) / (range.to - range.from)) * 100}%`, width: 48, marginLeft: -24 }}
          >
            {String(minutes / 60)}
          </Text>
        ))}
      </View>
    </View>
  );
}

/** 观猫时机 and 拍照点 for one facility. Only published times appear; no slot, no section. */
export function ViewingTiming({ facility }: { facility: Facility }) {
  const viewing = facility.viewing;
  const slots = viewing ? daySlots(viewing) : [];
  return (
    <>
      {viewing ? (
        <ListSection title="观猫时机">
          <DayStrip viewing={viewing} />
          {slots.map((slot, index) => (
            <ListCell
              key={slot.window.start}
              icon={slot.kind === "nap" ? Moon : Sun}
              label={slot.kind === "nap" ? "午睡" : `${partOfDay(slot.window)}活跃`}
              meta={spanLabel(slot.window)}
              last={index === slots.length - 1}
            />
          ))}
        </ListSection>
      ) : null}
      {facility.photoSpots.length > 0 ? (
        <ListSection title="拍照点">
          {facility.photoSpots.map((spot, index) => (
            <ListCell
              key={`${spot.name}-${index}`}
              label={spot.name}
              meta={spot.window ? spanLabel(spot.window) : undefined}
              lines={2}
              last={index === facility.photoSpots.length - 1}
            />
          ))}
        </ListSection>
      ) : null}
    </>
  );
}

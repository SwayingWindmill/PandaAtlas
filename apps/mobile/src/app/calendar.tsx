import { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, View } from "react-native";
import Animated from "react-native-reanimated";

import { ListCell, ListSection } from "@/components/grouped-list";
import { Icon } from "@/components/icon";
import { ChevronLeft, ChevronRight } from "@/components/icons";
import { LoadFailed } from "@/components/load-failed";
import { Page } from "@/components/page";
import { PandaThumb } from "@/components/panda-thumb";
import { ScreenState } from "@/components/screen-state";
import { Segmented } from "@/components/segmented";
import { Skeleton } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import { PAGE_ENTER } from "@/design/motion";
import {
  type CalendarDay,
  type CalendarEvent,
  type CalendarPanda,
  calendarMonth,
  dayHeading,
  monthGrid,
  shiftMonth,
} from "@/features/calendar/calendar";
import { loadCalendarSources } from "@/features/calendar/sources";
import { useFollowed } from "@/features/engagement/favorites";
import { localToday } from "@/features/engagement/seen";
import { openPanda } from "@/features/pandas/panda-row";
import { cn } from "@/lib/utils";

type Sources = { pandas: CalendarPanda[]; events: CalendarEvent[] };
type Scope = "all" | "followed";

const WEEK = ["一", "二", "三", "四", "五", "六", "日"];
const SCOPES = [
  { value: "all", label: "全部" },
  { value: "followed", label: "我关注的" },
] as const;
/** The selected day's circle: 36pt inside a 44pt-tall cell, as Calendar draws it. */
const DAY_CIRCLE = 36;

/** A 44pt round glyph button beside the month, as Calendar steps months. */
function MonthButton({ to, direction, onPress }: { to: number; direction: "back" | "forward"; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      role="button"
      accessibilityLabel={`${direction === "back" ? "上个月" : "下个月"}，${to}月`}
      hitSlop={4}
      className="size-11 items-center justify-center rounded-full bg-secondary active:bg-accent"
    >
      <Icon icon={direction === "back" ? ChevronLeft : ChevronRight} size="body" tone="tint" strokeWidth={2.25} />
    </Pressable>
  );
}

function MonthGrid({
  year,
  month,
  days,
  today,
  selected,
  onSelect,
}: {
  year: number;
  month: number;
  days: CalendarDay[];
  today: string;
  selected: number | null;
  onSelect: (day: number | null) => void;
}) {
  const marked = new Map(days.map((day) => [day.day, day.entries.length]));
  const prefix = `${year}-${String(month).padStart(2, "0")}-`;
  return (
    <View className="gap-hair-gap">
      <View className="flex-row">
        {WEEK.map((weekday) => (
          <Text key={weekday} variant="footnote" className="flex-1 text-center text-muted-foreground" accessible={false}>
            {weekday}
          </Text>
        ))}
      </View>
      {monthGrid(year, month).map((week, row) => (
        <View key={row} className="flex-row">
          {week.map((day, column) => {
            if (day === null) return <View key={column} className="min-h-12 flex-1" />;
            const count = marked.get(day) ?? 0;
            const isToday = `${prefix}${String(day).padStart(2, "0")}` === today;
            const isSelected = selected === day;
            return (
              <Pressable
                key={column}
                disabled={count === 0}
                onPress={() => onSelect(isSelected ? null : day)}
                role="button"
                accessibilityLabel={`${month}月${day}日，${count} 件`}
                accessibilityState={{ selected: isSelected, disabled: count === 0 }}
                className="min-h-12 flex-1 items-center justify-center gap-hair-gap"
              >
                <View
                  className={cn("items-center justify-center rounded-full", isSelected && "bg-primary")}
                  style={{ minWidth: DAY_CIRCLE, minHeight: DAY_CIRCLE }}
                >
                  <Text
                    variant="body"
                    className={cn(
                      "tabular-nums",
                      isSelected
                        ? "font-semibold text-primary-foreground"
                        : isToday
                          ? "font-semibold text-warm"
                          : count === 0 && "text-muted-foreground",
                    )}
                  >
                    {day}
                  </Text>
                </View>
                {/* The day's marker: a dot under the number, gone under the selection's circle. */}
                <View className={cn("size-1 rounded-full", count > 0 && !isSelected ? "bg-muted-foreground" : "bg-transparent")} />
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

function DayList({ days }: { days: CalendarDay[] }) {
  return (
    <View className="gap-section-tight">
      {days.map((day) => (
        <ListSection key={day.date} title={dayHeading(day.date)}>
          {day.entries.map((entry, index) => (
            <ListCell
              key={entry.key}
              label={entry.name}
              detail={entry.what}
              leading={<PandaThumb pandaId={entry.pandaId} name={entry.name} size={36} shape="round" />}
              onPress={() => openPanda(entry.slug)}
              accessibilityLabel={`${entry.name}，${entry.what}`}
              last={index === day.entries.length - 1}
            />
          ))}
        </ListSection>
      ))}
    </View>
  );
}

export default function CalendarScreen() {
  const today = localToday();
  const [{ year, month }, setMonth] = useState({
    year: Number(today.slice(0, 4)),
    month: Number(today.slice(5, 7)),
  });
  const [selected, setSelected] = useState<number | null>(null);
  const [sources, setSources] = useState<Sources | null>(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(() => {
    loadCalendarSources()
      .then(setSources)
      .catch(() => setFailed(true));
  }, []);
  useEffect(load, [load]);

  const days = useMemo(
    () => (sources ? calendarMonth(sources.pandas, sources.events, year, month) : []),
    [sources, year, month],
  );
  const followed = useFollowed();
  const [scope, setScope] = useState<Scope>("all");
  // 我关注的 keeps only the entries of followed pandas; days left empty drop out.
  const scoped =
    scope === "followed" && followed
      ? days.flatMap((day) => {
          const entries = day.entries.filter((entry) => followed.has(entry.pandaId));
          return entries.length > 0 ? [{ ...day, entries }] : [];
        })
      : days;
  const shown = selected === null ? scoped : scoped.filter((day) => day.day === selected);

  function go(by: number) {
    setMonth(shiftMonth(year, month, by));
    setSelected(null);
  }

  function retry() {
    setFailed(false);
    load();
  }

  return (
    <Page title="熊猫日历">
      {followed && followed.size > 0 && sources ? (
        <Segmented
          value={scope}
          options={SCOPES}
          onChange={(value) => {
            setScope(value);
            setSelected(null);
          }}
          accessibilityLabel="日历范围"
        />
      ) : null}
      <View className="gap-stack rounded-card bg-card px-row pt-inset pb-row" style={{ borderCurve: "continuous" }}>
        <View className="flex-row items-center gap-row px-hair-gap">
          <Text variant="title" className="min-w-0 flex-1 tabular-nums">{`${year}年${month}月`}</Text>
          <MonthButton to={shiftMonth(year, month, -1).month} direction="back" onPress={() => go(-1)} />
          <MonthButton to={shiftMonth(year, month, 1).month} direction="forward" onPress={() => go(1)} />
        </View>
        {failed ? (
          <LoadFailed message="日历暂时打不开。" onRetry={retry} />
        ) : sources === null ? (
          <Skeleton className="h-72 w-full rounded-tile" accessibilityLabel="正在加载日历" />
        ) : (
          <MonthGrid year={year} month={month} days={scoped} today={today} selected={selected} onSelect={setSelected} />
        )}
      </View>
      {sources && !failed ? (
        scoped.length === 0 ? (
          <ScreenState
            message={scope === "followed" ? "这个月关注的熊猫没有生日或大事。" : "这个月还没有公开的生日或大事。"}
            className="py-stack"
          />
        ) : (
          // Arrival only: stepping months swaps the list in place, as Calendar does.
          <Animated.View entering={PAGE_ENTER}>
            <DayList days={shown} />
          </Animated.View>
        )
      ) : null}
    </Page>
  );
}

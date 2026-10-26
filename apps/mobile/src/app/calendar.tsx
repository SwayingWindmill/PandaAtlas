import { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import { useCSSVariable } from "uniwind";

import { LoadFailed } from "@/components/load-failed";
import { Page } from "@/components/page";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
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

const WEEK = ["一", "二", "三", "四", "五", "六", "日"];

function MonthButton({ to, direction, onPress }: { to: number; direction: "back" | "forward"; onPress: () => void }) {
  const ink = String(useCSSVariable("--color-foreground"));
  const chevron = (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
      <Path
        d={direction === "back" ? "M15 5l-7 7 7 7" : "M9 5l7 7-7 7"}
        stroke={ink}
        strokeWidth={2.2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
  return (
    <Button
      variant="secondary"

      onPress={onPress}
      accessibilityLabel={`${direction === "back" ? "上个月" : "下个月"}，${to}月`}
    >
      {direction === "back" ? chevron : null}
      <Text>{to}月</Text>
      {direction === "forward" ? chevron : null}
    </Button>
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
    <View className="gap-1">
      <View className="flex-row">
        {WEEK.map((weekday) => (
          <Text key={weekday} variant="small" className="flex-1 text-center text-muted-foreground">
            {weekday}
          </Text>
        ))}
      </View>
      {monthGrid(year, month).map((week, row) => (
        <View key={row} className="flex-row">
          {week.map((day, column) => {
            if (day === null) return <View key={column} className="h-11 flex-1" />;
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
                accessibilityState={{
                  selected: isSelected,
                  disabled: count === 0,
                }}
                className={cn("h-11 flex-1 items-center justify-center rounded-md", isSelected && "bg-accent")}
              >
                <Text
                  className={cn(
                    count === 0 && "text-muted-foreground",
                    isToday && "font-extrabold text-highlight-foreground",
                  )}
                >
                  {day}
                </Text>
                <View className={cn("size-1 rounded-full", count > 0 ? "bg-foreground" : "bg-transparent")} />
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
    <View className="gap-6">
      {days.map((day) => (
        <View key={day.date} className="gap-1">
          <Text variant="small" className="text-muted-foreground">
            {dayHeading(day.date)}
          </Text>
          {day.entries.map((entry, index) => (
            <Pressable
              key={entry.key}
              onPress={() => openPanda(entry.slug)}
              role="button"
              accessibilityLabel={`${entry.name}，${entry.what}`}
              className={cn(
                "flex-row items-center justify-between gap-3 border-t-hairline border-border py-3 active:bg-accent",
                index === day.entries.length - 1 && "border-b-hairline",
              )}
            >
              <Text className="min-w-0 flex-1 font-bold" numberOfLines={1}>
                {entry.name}
              </Text>
              <Text className="text-muted-foreground">{entry.what}</Text>
            </Pressable>
          ))}
        </View>
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
  const [scope, setScope] = useState<"all" | "followed">("all");
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

  return (
    <Page label="熊猫日历" title={`${year}年${month}月`}>
      <View className="flex-row items-center justify-between">
        <MonthButton to={shiftMonth(year, month, -1).month} direction="back" onPress={() => go(-1)} />
        <MonthButton to={shiftMonth(year, month, 1).month} direction="forward" onPress={() => go(1)} />
      </View>
      {failed ? (
        <LoadFailed message="日历暂时打不开。" onRetry={() => { setFailed(false); load(); }} />
      ) : sources === null ? (
        <Skeleton className="h-72 w-full" accessibilityLabel="正在加载日历" />
      ) : (
        <>
          {followed && followed.size > 0 ? (
            <ToggleGroup
              type="single"
              variant="outline"
              value={scope}
              onValueChange={(value) => {
                if (value === "all" || value === "followed") {
                  setScope(value);
                  setSelected(null);
                }
              }}
              accessibilityLabel="日历范围"
            >
              <ToggleGroupItem value="all" accessibilityLabel="全部">
                <Text>全部</Text>
              </ToggleGroupItem>
              <ToggleGroupItem value="followed" accessibilityLabel="我关注的">
                <Text>我关注的</Text>
              </ToggleGroupItem>
            </ToggleGroup>
          ) : null}
          <MonthGrid year={year} month={month} days={scoped} today={today} selected={selected} onSelect={setSelected} />
          {scoped.length === 0 ? (
            <Text className="text-muted-foreground">
              {scope === "followed" ? "这个月关注的熊猫没有生日或大事。" : "这个月还没有公开的生日或大事。"}
            </Text>
          ) : (
            <DayList days={shown} />
          )}
        </>
      )}
    </Page>
  );
}

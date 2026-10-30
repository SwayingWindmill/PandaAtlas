import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { View } from "react-native";

import { Chevron } from "@/components/grouped-list";
import { PressScale } from "@/components/press-scale";
import { Text } from "@/components/ui/text";

import { type CheckinSummary, dayMark, loadCheckins, weekOf } from "./checkin";
import { DayCircle, useDayCircle } from "./day-mark";

const WEEK = ["一", "二", "三", "四", "五", "六", "日"];
/** The week strip's circles: smaller than the month grid's, as Fitness shows a week. */
const WEEK_CIRCLE = 32;

/**
 * 我的: this week at a glance and the running totals, opening 每日打卡. Without an answer from the
 * API (offline, or before the server has it) the card still opens the page and says how a day counts.
 */
export function CheckinCard() {
  const [summary, setSummary] = useState<CheckinSummary | null>(null);
  const circle = useDayCircle(WEEK_CIRCLE);
  useFocusEffect(
    useCallback(() => {
      loadCheckins()
        .then(setSummary)
        .catch(() => setSummary(null));
    }, []),
  );
  const totals = summary
    ? `累计来过 ${summary.totalVisitDays.toLocaleString("zh-CN")} 天　本月 ${summary.thisMonth.visitDays} 天`
    : "每天打开每日一猫，就记下一天";
  return (
    <PressScale
      onPress={() => router.push("/checkin")}
      role="button"
      accessibilityLabel={`每日打卡，${totals}`}
      className="gap-row rounded-card bg-card p-inset"
      style={{ borderCurve: "continuous" }}
    >
      <View className="flex-row items-center gap-row">
        <Text variant="headline" className="min-w-0 flex-1">
          每日打卡
        </Text>
        <Chevron />
      </View>
      {summary ? (
        <View className="flex-row" accessible={false} onLayout={circle.onLayout}>
          {weekOf(summary.today).map((day, index) => (
            <View key={day} className="flex-1 items-center gap-hair-gap">
              <Text
                variant="footnote"
                className={day === summary.today ? "font-semibold text-warm" : "text-muted-foreground"}
              >
                {WEEK[index]}
              </Text>
              <DayCircle mark={dayMark(summary, day)} size={circle.size} today={day === summary.today} />
            </View>
          ))}
        </View>
      ) : null}
      <Text variant="subheadline" className="text-muted-foreground tabular-nums">
        {totals}
      </Text>
    </PressScale>
  );
}

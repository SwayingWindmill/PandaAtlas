import { View } from "react-native";

import { ListCell, ListSection } from "@/components/grouped-list";
import { PandaThumb } from "@/components/panda-thumb";
import { useFollowed } from "@/features/engagement/favorites";

import { followedInWeek, whenLabel } from "./birthday-week";
import { useBirthdayReminder } from "./prefs";
import { useBirthdayWeek } from "./use-week";

/**
 * The opt-in reminder on 今天: followed pandas with a birthday in the next seven days, one row each, and a
 * way to the whole 生日周. Nothing shows while the switch is off, signed out, or no followed panda has one.
 */
export function BirthdayReminderCard() {
  const on = useBirthdayReminder();
  const followed = useFollowed();
  const { data: week } = useBirthdayWeek();
  if (!on || !followed || !week) return null;
  const mine = followedInWeek(week, followed);
  if (mine.length === 0) return null;
  return (
    <View>
      <ListSection title="关注的熊猫快过生日了">
        {mine.slice(0, 3).map((entry) => (
          <ListCell
            key={entry.pandaId}
            label={entry.name}
            detail={`${whenLabel(entry.inDays)} · ${entry.age} 岁生日`}
            leading={<PandaThumb pandaId={entry.pandaId} name={entry.name} size={36} shape="round" />}
            href="/birthdays"
            accessibilityLabel={`${entry.name}${whenLabel(entry.inDays)}过 ${entry.age} 岁生日，打开生日周`}
          />
        ))}
        <ListCell label="看生日周" tone="tint" role="link" href="/birthdays" last />
      </ListSection>
    </View>
  );
}

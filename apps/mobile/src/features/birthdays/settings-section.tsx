import { ListSection, SwitchRow } from "@/components/grouped-list";
import { Cake } from "@/components/icons";
import { tapHaptic } from "@/lib/haptics";

import { setBirthdayReminder, useBirthdayReminder } from "./prefs";

/** 生日提醒: the opt-in reminder on 今天, in 设置's 提醒 group. Off by default. */
export function BirthdaySwitch({ separator }: { separator?: boolean }) {
  const on = useBirthdayReminder();
  if (on === null) return null;
  return (
    <SwitchRow
      glyph={Cake}
      label="生日提醒"
      accessibilityLabel="关注的熊猫过生日前在今天页提醒我"
      value={on}
      separator={separator}
      onChange={(next) => {
        tapHaptic();
        setBirthdayReminder(next);
      }}
    />
  );
}

/** The same switch at the foot of 生日周, with what it does. */
export function BirthdayReminderSettings() {
  return (
    <ListSection footer="打开后，你关注的熊猫在 7 天内过生日时，今天页会提醒你。不发推送，这个选择只保存在这台设备上。">
      <BirthdaySwitch />
    </ListSection>
  );
}

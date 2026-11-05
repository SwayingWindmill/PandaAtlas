import { SwitchRow } from "@/components/grouped-list";
import { Newspaper } from "@/components/icons";
import { tapHaptic } from "@/lib/haptics";

import { setVenueNewsOn, useVenueNewsOn } from "./prefs";

/** 场馆动态 in 设置's 提醒 group: the 今天 card with news from the venues the followed pandas live at. */
export function VenueNewsSwitch({ separator }: { separator?: boolean }) {
  const on = useVenueNewsOn();
  if (on === null) return null;
  return (
    <SwitchRow
      glyph={Newspaper}
      label="场馆动态"
      accessibilityLabel="在今天页显示关注熊猫所在场馆的动态"
      value={on}
      separator={separator}
      onChange={(next) => {
        tapHaptic();
        setVenueNewsOn(next);
      }}
    />
  );
}

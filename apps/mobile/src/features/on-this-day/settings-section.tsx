import { View } from "react-native";

import { ListCell, ListSection, SwitchRow } from "@/components/grouped-list";
import { History } from "@/components/icons";
import { tapHaptic } from "@/lib/haptics";

import { setMemoryPrefs, useMemoryPrefs } from "./prefs";

/**
 * 那年今天 in 设置 and at the foot of its page: the switch for the 今天 card, and a way back for everything
 * shown less. Both live on this device only, which the footer says.
 */
export function OnThisDaySettings() {
  const prefs = useMemoryPrefs();
  if (!prefs) return null;
  const hidden = prefs.less.length;
  return (
    <View className="gap-section-tight">
      <ListSection footer="在今天页回看往年的今天：生日、来到新家、回国，和你自己的记录。这些选择只保存在这台设备上。">
        <SwitchRow
          glyph={History}
          label="那年今天"
          accessibilityLabel="在今天页显示那年今天"
          value={!prefs.off}
          onChange={(on) => {
            tapHaptic();
            setMemoryPrefs({ ...prefs, off: !on });
          }}
        />
      </ListSection>
      {hidden > 0 ? (
        <ListSection>
          <ListCell
            label={`恢复少显示的 ${hidden} 项`}
            tone="tint"
            onPress={() => {
              tapHaptic();
              setMemoryPrefs({ ...prefs, less: [] });
            }}
            last
          />
        </ListSection>
      ) : null}
    </View>
  );
}


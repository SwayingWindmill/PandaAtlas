import { View } from "react-native";

import { GlyphSquare, ListCell, ListSection } from "@/components/grouped-list";
import { History } from "@/components/icons";
import { Switch } from "@/components/ui/switch";
import { Text } from "@/components/ui/text";
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
        <View className="min-h-11 flex-row items-center gap-row px-inset py-stack-tight">
          <GlyphSquare icon={History} />
          <Text variant="body" className="min-w-0 flex-1">
            那年今天
          </Text>
          <Switch
            checked={!prefs.off}
            onCheckedChange={(on) => {
              tapHaptic();
              setMemoryPrefs({ ...prefs, off: !on });
            }}
            accessibilityLabel="在今天页显示那年今天"
            hitSlop={12}
          />
        </View>
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


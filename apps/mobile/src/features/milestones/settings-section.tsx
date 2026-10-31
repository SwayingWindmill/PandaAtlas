import { View } from "react-native";

import { GlyphSquare, ListSection } from "@/components/grouped-list";
import { Flag } from "@/components/icons";
import { Switch } from "@/components/ui/switch";
import { Text } from "@/components/ui/text";
import { tapHaptic } from "@/lib/haptics";

import { MILESTONE_CONFIG } from "./milestones";
import { setMilestonePrefs, useMilestonePrefs } from "./prefs";

/**
 * 里程碑 in 设置 and at the foot of its page: one switch for every place a milestone shows. It lives on this
 * device only, which the footer says.
 */
export function MilestoneSettings() {
  const prefs = useMilestonePrefs();
  if (!prefs) return null;
  return (
    <ListSection
      footer={`认出或见过的第 ${MILESTONE_CONFIG.pandas.join("、")} 只熊猫，第 ${MILESTONE_CONFIG.visits.join("、")} 次去同一个地方，和熊猫的满月、满百天、生日、当妈妈或爸爸，会记成里程碑。没有目标，也不和别人比。这个选择只保存在这台设备上。`}
    >
      <View className="min-h-11 flex-row items-center gap-row px-inset py-stack-tight">
        <GlyphSquare icon={Flag} />
        <Text variant="body" className="min-w-0 flex-1">
          里程碑
        </Text>
        <Switch
          checked={!prefs.off}
          onCheckedChange={(on) => {
            tapHaptic();
            setMilestonePrefs({ off: !on });
          }}
          accessibilityLabel="显示里程碑"
          hitSlop={12}
        />
      </View>
    </ListSection>
  );
}

import { ListSection, SwitchRow } from "@/components/grouped-list";
import { Flag } from "@/components/icons";
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
      <SwitchRow
        glyph={Flag}
        label="里程碑"
        accessibilityLabel="显示里程碑"
        value={!prefs.off}
        onChange={(on) => {
          tapHaptic();
          setMilestonePrefs({ off: !on });
        }}
      />
    </ListSection>
  );
}

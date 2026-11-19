import { useState } from "react";
import { View } from "react-native";

import { Chip, ChipRow } from "@/components/chip";
import { IconRow } from "@/components/icon-row";
import { Baby, Cake, Clock, MapPin, Sparkles } from "@/components/icons";
import { ProgressRing } from "@/components/progress-ring";
import { SectionHeader } from "@/components/section-header";
import { SourceBadge } from "@/components/source-badge";
import { TimeBand } from "@/components/time-band";
import { Timeline } from "@/components/timeline";
import { Badge } from "@/components/ui/badge";
import { Text } from "@/components/ui/text";

/**
 * Shared component samples, each with 示例 data. Nothing here is a real record: names, dates and
 * figures are placeholders to show the shape, labelled 示例 on screen.
 */
function Demo({ name, children }: { name: string; children: React.ReactNode }) {
  return (
    <View className="gap-stack-tight">
      <View className="flex-row items-center gap-stack-tight">
        <Text variant="subheadline" className="font-semibold">{name}</Text>
        <Badge>
          <Text>示例</Text>
        </Badge>
      </View>
      <View className="gap-row rounded-group bg-card p-inset" style={{ borderCurve: "continuous" }}>
        {children}
      </View>
    </View>
  );
}

export function ComponentGallery() {
  const [chips, setChips] = useState<string[]>(["在世"]);
  const toggle = (label: string) =>
    setChips((current) => (current.includes(label) ? current.filter((c) => c !== label) : [...current, label]));
  return (
    <View className="gap-section-tight">
      <Demo name="Badge">
        <View className="flex-row flex-wrap gap-stack-tight">
          <Badge><Text>中性</Text></Badge>
          <Badge variant="tint"><Text>已关注</Text></Badge>
          <Badge variant="outline"><Text>描边</Text></Badge>
        </View>
      </Demo>

      <Demo name="Chip">
        <ChipRow>
          {["在世", "国内", "国外", "雌性", "雄性"].map((label) => (
            <Chip key={label} label={label} selected={chips.includes(label)} onPress={() => toggle(label)} />
          ))}
        </ChipRow>
      </Demo>

      <Demo name="SourceBadge">
        <SourceBadge name="示例动物园" official verifiedOn="2026 年 10 月 1 日" />
        <SourceBadge name="示例新闻网" />
      </Demo>

      <Demo name="IconRow">
        <IconRow icon={MapPin} text="示例市　示例动物园" />
        <IconRow icon={Clock} text="09:00 – 17:00" />
        <IconRow icon={Cake} text="2020 年 1 月 1 日" />
      </Demo>

      <Demo name="ProgressRing">
        <View className="flex-row items-center gap-section-tight">
          <ProgressRing value={7 / 12} label="7/12" accessibilityLabel="示例：已认识 7 只，共 12 只" />
          <ProgressRing value={0.3} size="small" label="3" accessibilityLabel="示例：30%" />
          <ProgressRing value={1} size="small" label="✓" accessibilityLabel="示例：已完成" />
        </View>
      </Demo>

      <Demo name="Timeline">
        <Timeline
          items={[
            { key: "c", date: "2024 年", title: "示例：迁往新场馆" },
            { key: "b", date: "2022 年", title: "示例：第一次在户外活动场亮相", detail: "示例说明一行" },
            { key: "a", date: "2020 年 1 月 1 日", title: "示例：出生", icon: Baby },
          ]}
        />
      </Demo>

      <Demo name="TimeBand">
        <TimeBand open="09:00" close="17:00" now="13:30" />
      </Demo>

      <Demo name="SectionHeader icon">
        <SectionHeader title="示例分区" icon={Sparkles} count="3 只" />
      </Demo>
    </View>
  );
}

import { View } from "react-native";

import { Icon } from "@/components/icon";
import type { LucideIcon } from "@/components/icons";
import { Text } from "@/components/ui/text";
import { cn } from "@/lib/utils";

// The label column is a little wider than a value column.
const LABEL_FLEX = 1.1;

export interface CompareRow {
  key: string;
  label: string;
  icon?: LucideIcon;
  values: string[];
  /** Which column to mark as the larger or the earlier, in the tint. */
  lead?: number;
}

/**
 * Two or three things side by side, as the App Store compares plans: a header row of names, then
 * one row per attribute with its glyph. The label column is the secondary label; values are body.
 * VoiceOver hears each row as "年龄：和花 5 岁，福宝 6 岁". No registry table fits a phone column.
 */
export function CompareTable({ columns, rows }: { columns: string[]; rows: CompareRow[] }) {
  return (
    <View className="overflow-hidden rounded-group bg-card">
      <View className="flex-row border-b-hairline border-border px-4 py-stack-tight" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <View style={{ flex: LABEL_FLEX }} />
        {columns.map((name) => (
          <Text key={name} variant="subheadline" className="flex-1 font-semibold" numberOfLines={1}>
            {name}
          </Text>
        ))}
      </View>
      {rows.map((row, index) => (
        <View
          key={row.key}
          accessible
          accessibilityLabel={`${row.label}：${row.values.map((value, i) => `${columns[i]} ${value}`).join("，")}`}
          className={cn("min-h-11 flex-row items-center px-4 py-stack-tight", index < rows.length - 1 && "border-b-hairline border-border")}
        >
          <View style={{ flex: LABEL_FLEX }} className="flex-row items-center gap-hair-gap">
            {row.icon ? <Icon icon={row.icon} size="footnote" /> : null}
            <Text variant="footnote" className="shrink text-muted-foreground" numberOfLines={1}>
              {row.label}
            </Text>
          </View>
          {row.values.map((value, i) => (
            <Text key={i} variant="body" className={cn("flex-1 tabular-nums", row.lead === i && "text-primary")} numberOfLines={2}>
              {value}
            </Text>
          ))}
        </View>
      ))}
    </View>
  );
}

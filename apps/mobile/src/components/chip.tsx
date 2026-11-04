import { Pressable, View } from "react-native";

import { Icon } from "@/components/icon";
import { Check, type LucideIcon } from "@/components/icons";
import { Text } from "@/components/ui/text";
import { component } from "@/design/tokens";
import { cn } from "@/lib/utils";

const HIT_SLOP = (component.hitTarget - component.chip.height) / 2;

/**
 * A filter or choice chip, as Maps and Photos draw them: a 32pt capsule inside a 44pt hit area.
 * Selected is the tinted fill with a check, so the state reads without color too. Built on the
 * RNR Badge's capsule; interactive chips are buttons with `selected` state for VoiceOver.
 */
export function Chip({
  label,
  selected = false,
  icon,
  onPress,
  accessibilityLabel,
}: {
  label: string;
  selected?: boolean;
  icon?: LucideIcon;
  onPress?: () => void;
  accessibilityLabel?: string;
}) {
  const body = (
    <View
      className={cn(
        "flex-row items-center gap-hair-gap rounded-pill",
        selected ? "bg-highlight-soft" : "bg-secondary",
      )}
      style={{ height: component.chip.height, paddingHorizontal: component.chip.paddingX, borderCurve: "continuous" }}
    >
      {selected ? (
        <Icon icon={Check} size="footnote" tone="tint" strokeWidth={component.iconStroke.bold} />
      ) : icon ? (
        <Icon icon={icon} size="footnote" />
      ) : null}
      <Text variant="subheadline" className={cn("font-semibold", selected ? "text-primary" : "text-foreground")} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
  if (!onPress) {
    return (
      <View accessible accessibilityLabel={accessibilityLabel ?? label}>
        {body}
      </View>
    );
  }
  return (
    <Pressable
      onPress={onPress}
      role="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ selected }}
      hitSlop={HIT_SLOP}
      className="active:opacity-60"
    >
      {body}
    </Pressable>
  );
}

/** A wrapping row of chips. */
export function ChipRow({ children }: { children: React.ReactNode }) {
  return <View className="flex-row flex-wrap gap-stack-tight">{children}</View>;
}

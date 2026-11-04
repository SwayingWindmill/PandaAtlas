import { View } from "react-native";

import { Icon } from "@/components/icon";
import { Check } from "@/components/icons";
import { component } from "@/design/tokens";

/**
 * Status as structure, not copy (DESIGN.md, The Structure Rule). A confirmed fact gets a tint check
 * beside it; a fact still being verified gets a hollow dot. Both are decoration: the element that
 * holds them puts the words (生日已确认, 在世待核实) in its accessibilityLabel.
 */
export function ConfirmedMark({ size = "footnote" }: { size?: "footnote" | "subhead" }) {
  return <Icon icon={Check} size={size} tone="confirmed" strokeWidth={component.iconStroke.bold} />;
}

/** A hollow secondary dot: "on record, not yet verified". Never alone; the row says what it marks. */
export function PendingDot() {
  const size = component.statusDot;
  return (
    <View
      aria-hidden
      accessible={false}
      className="rounded-pill border-muted-foreground"
      style={{ width: size, height: size, borderWidth: 1.5 }}
    />
  );
}

/** The spoken form of a status mark, appended to an accessibility label. */
export function statusWords(status: "confirmed" | "pending" | undefined, what: { confirmed: string; pending: string }) {
  if (status === "confirmed") return `，${what.confirmed}`;
  if (status === "pending") return `，${what.pending}`;
  return "";
}

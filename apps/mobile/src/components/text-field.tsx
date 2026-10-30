import { type ComponentProps } from "react";
import { TextInput } from "react-native";
import { useCSSVariable } from "uniwind";

import { cn } from "@/lib/utils";

/**
 * A text field as iOS draws one on a grouped page: the elevated surface, a group radius, body text,
 * and no outline. min-h, not h: at large text sizes the line grows and the field grows with it.
 */
export function TextField({ className, ...props }: ComponentProps<typeof TextInput>) {
  const muted = String(useCSSVariable("--color-muted-foreground"));
  return (
    <TextInput
      placeholderTextColor={muted}
      className={cn("min-h-12 rounded-group bg-card px-inset py-row text-body text-foreground", className)}
      style={{ borderCurve: "continuous" }}
      {...props}
    />
  );
}

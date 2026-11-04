import { View } from "react-native";

import { Icon } from "@/components/icon";
import { Check } from "@/components/icons";
import { Text } from "@/components/ui/text";
import { component } from "@/design/tokens";
import { useIOSColors } from "@/lib/theme";
import { cn } from "@/lib/utils";

export interface Step {
  key: string;
  title: string;
  detail?: string;
}

/**
 * Steps in order, as a setup flow shows them: a numbered disc per step, a check once done, the
 * current one ringed in the tint. The order and the discs say where a fan is; no "第 2 步，共 4 步"
 * line. VoiceOver hears it per step. A composition: ReUI/Kibo steppers are web only.
 */
export function Stepper({ steps, current }: { steps: Step[]; current: number }) {
  const disc = component.stepper.disc;
  // The check on a filled disc takes the label color that sits on a tint fill.
  const { buttonLabel } = useIOSColors();
  return (
    <View>
      {steps.map((step, index) => {
        const done = index < current;
        const now = index === current;
        const last = index === steps.length - 1;
        const state = done ? "已完成" : now ? "当前" : "未开始";
        return (
          <View
            key={step.key}
            className="flex-row gap-row"
            accessible
            accessibilityLabel={`第 ${index + 1} 步，共 ${steps.length} 步，${step.title}，${state}`}
          >
            <View className="items-center" style={{ width: disc }}>
              <View
                className={cn(
                  "items-center justify-center rounded-pill",
                  done ? "bg-graphic" : now ? "border-primary bg-card" : "bg-secondary",
                )}
                style={{ width: disc, height: disc, borderWidth: now ? 2 : 0 }}
              >
                {done ? (
                  <Icon icon={Check} size="footnote" color={buttonLabel} strokeWidth={component.iconStroke.bold} />
                ) : (
                  <Text variant="footnote" className={cn("font-rounded font-semibold", now ? "text-primary" : "text-muted-foreground")}>
                    {String(index + 1)}
                  </Text>
                )}
              </View>
              {last ? null : <View className={cn("flex-1", done ? "bg-graphic" : "bg-border")} style={{ width: 2, minHeight: 12 }} />}
            </View>
            <View className={cn("min-w-0 flex-1 gap-hair-gap", !last && "pb-stack")} style={{ minHeight: disc }}>
              <Text variant="body" className={cn(now && "font-semibold", !done && !now && "text-muted-foreground")}>
                {step.title}
              </Text>
              {step.detail ? (
                <Text variant="footnote" className="text-muted-foreground">
                  {step.detail}
                </Text>
              ) : null}
            </View>
          </View>
        );
      })}
    </View>
  );
}

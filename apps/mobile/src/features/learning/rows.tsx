import type { ReactNode } from "react";
import { Pressable, View } from "react-native";

import { Icon } from "@/components/icon";
import { ChevronRight } from "@/components/icons";
import { Text } from "@/components/ui/text";

import { ReadingRule } from "./reading-page";

/**
 * A section in the reading column: the reading heading, then rows set straight on the paper
 * between hairlines, the way News lists what follows a story. A filled group would vanish on
 * white paper, so the rules carry the structure.
 */
export function ManualSection({ title, meta, children }: { title: string; meta?: string; children: ReactNode }) {
  return (
    <View className="gap-stack-tight">
      <View className="flex-row items-baseline justify-between gap-row">
        <Text variant="readingHeading">{title}</Text>
        {meta ? <Text variant="readingCaption">{meta}</Text> : null}
      </View>
      <View>
        <ReadingRule />
        {children}
      </View>
    </View>
  );
}

/** One contents line in the column, with the disclosure chevron. */
export function IndexRow({
  label,
  detail,
  onPress,
}: {
  label: string;
  detail?: string;
  onPress: () => void;
  last?: boolean;
}) {
  return (
    <View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={detail ? `${detail}：${label}` : label}
        onPress={onPress}
        className="min-h-11 flex-row items-center gap-row py-row active:opacity-60"
      >
        <View className="min-w-0 flex-1 gap-hair-gap">
          {detail ? <Text variant="readingCaption">{detail}</Text> : null}
          <Text variant="body" className="font-semibold">
            {label}
          </Text>
        </View>
        <Icon icon={ChevronRight} size="footnote" tone="tertiary" />
      </Pressable>
      <ReadingRule />
    </View>
  );
}

/** A face-guide mark: the feature in the brand color, then the sentence in the reading body. */
export function DefinitionRow({ label, body, index }: { label: string; body: string; index: number; last?: boolean }) {
  return (
    <View className="flex-row gap-inset py-row">
      <Text variant="headline" className="w-6 text-primary tabular-nums">
        {index + 1}
      </Text>
      <View className="min-w-0 flex-1 gap-hair-gap">
        <Text variant="headline">{label}</Text>
        <Text variant="readingBody">{body}</Text>
      </View>
    </View>
  );
}

export function neighborsAt<T>(items: readonly T[], index: number): { previous?: T; next?: T } {
  return {
    previous: index > 0 ? items[index - 1] : undefined,
    next: index >= 0 && index < items.length - 1 ? items[index + 1] : undefined,
  };
}

export function NeighborRows<T extends { slug: string }>({
  previous,
  next,
  labelOf,
  onOpen,
}: {
  previous?: T;
  next?: T;
  labelOf: (entry: T) => string;
  onOpen: (entry: T) => void;
}) {
  if (!previous && !next) return null;
  return (
    <View>
      <ReadingRule />
      {previous ? <IndexRow label={labelOf(previous)} detail="上一篇" onPress={() => onOpen(previous)} /> : null}
      {next ? <IndexRow label={labelOf(next)} detail="下一篇" onPress={() => onOpen(next)} /> : null}
    </View>
  );
}

import type { ReactNode } from "react";
import { Pressable, View } from "react-native";

import { Text } from "@/components/ui/text";
import { HAIRLINE } from "@/lib/surface";

/** A reading section: the heading, then an inset group. */
export function ManualSection({ title, meta, children }: { title: string; meta?: string; children: ReactNode }) {
  return (
    <View className="gap-2">
      <View className="flex-row items-baseline justify-between gap-3 px-4">
        <Text variant="title2">{title}</Text>
        {meta ? <Text variant="footnote" className="text-muted-foreground">{meta}</Text> : null}
      </View>
      <View className="overflow-hidden rounded-[10px] bg-card">{children}</View>
    </View>
  );
}

/** One contents line inside a grouped section. */
export function IndexRow({ label, detail, onPress, last }: { label: string; detail?: string; onPress: () => void; last: boolean }) {
  return (
    <View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        onPress={onPress}
        className="min-h-11 justify-center px-4 py-3 active:bg-accent"
      >
        <Text variant="body">{label}</Text>
        {detail ? (
          <Text variant="footnote" className="text-muted-foreground" numberOfLines={2}>
            {detail}
          </Text>
        ) : null}
      </Pressable>
      {last ? null : <View className="ml-4 bg-border" style={{ height: HAIRLINE }} />}
    </View>
  );
}

/** A face-guide mark: the name, then the sentence, inside the group. */
export function DefinitionRow({ label, body, last }: { label: string; body: string; last: boolean }) {
  return (
    <View>
      <View className="gap-1 px-4 py-3">
        <Text variant="footnote" className="text-muted-foreground">{label}</Text>
        <Text variant="body">{body}</Text>
      </View>
      {last ? null : <View className="ml-4 bg-border" style={{ height: HAIRLINE }} />}
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
    <View className="overflow-hidden rounded-[10px] bg-card">
      {previous ? <IndexRow label={labelOf(previous)} detail="上一篇" onPress={() => onOpen(previous)} last={!next} /> : null}
      {next ? <IndexRow label={labelOf(next)} detail="下一篇" onPress={() => onOpen(next)} last /> : null}
    </View>
  );
}

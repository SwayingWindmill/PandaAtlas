import type { ReactNode } from "react";
import { Pressable, View } from "react-native";

import { Text } from "@/components/ui/text";
import { cn } from "@/lib/utils";

/** A manual section: the heading, then hairline rows. Space above the heading comes from the page. */
export function ManualSection({ title, meta, children }: { title: string; meta?: string; children: ReactNode }) {
  return (
    <View className="gap-2">
      <View className="flex-row items-baseline justify-between gap-3">
        <Text variant="h2">{title}</Text>
        {meta ? <Text variant="muted">{meta}</Text> : null}
      </View>
      <View>{children}</View>
    </View>
  );
}

/** One contents line. The accessible name is the entry, not the section. */
export function IndexRow({ label, detail, onPress, last }: { label: string; detail?: string; onPress: () => void; last: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      className={cn("min-h-11 justify-center border-t-hairline border-border py-3 active:bg-accent", last && "border-b-hairline")}
    >
      <Text className="font-bold">{label}</Text>
      {detail ? (
        <Text variant="muted" className="mt-1" numberOfLines={2}>
          {detail}
        </Text>
      ) : null}
    </Pressable>
  );
}

/** A face-guide mark: a 12px label over the sentence, ruled like the profile fact list. */
export function DefinitionRow({ label, body, last }: { label: string; body: string; last: boolean }) {
  return (
    <View className={cn("gap-1 border-t-hairline border-border py-3", last && "border-b-hairline")}>
      <Text variant="muted">{label}</Text>
      <Text className="leading-6">{body}</Text>
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
      {previous ? (
        <IndexRow label={labelOf(previous)} detail="上一篇" onPress={() => onOpen(previous)} last={!next} />
      ) : null}
      {next ? <IndexRow label={labelOf(next)} detail="下一篇" onPress={() => onOpen(next)} last /> : null}
    </View>
  );
}

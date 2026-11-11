import { Image } from "expo-image";
import { router } from "expo-router";
import { View } from "react-native";

import { PressScale } from "@/components/press-scale";
import { Scrim } from "@/components/scrim";
import { Text } from "@/components/ui/text";
import { semantic } from "@/design/tokens";
import type { PandaListItem } from "@/features/pandas/pandas";
import { usePandaCover } from "@/lib/covers";
import { RADIUS } from "@/lib/surface";

import type { Comparison } from "./comparisons";

const PLACEHOLDER = semantic.color.light.mediaPlaceholder;
const BADGE = 28;
/** 比 on its white disc stays ink in both appearances. */
const INK = semantic.color.light.label;

function Half({ panda, side }: { panda: PandaListItem; side: "left" | "right" }) {
  const cover = usePandaCover(panda.id);
  return (
    <View style={{ flex: 1 }}>
      {cover ? (
        <Image source={cover} style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} contentFit="cover" transition={200} accessible={false} />
      ) : null}
      <Scrim id={`compare-${panda.id}-${side}`} />
      <Text
        variant="headline"
        role="none"
        numberOfLines={1}
        className={side === "left" ? "absolute bottom-3 left-3 text-on-media" : "absolute right-3 bottom-3 text-on-media"}
      >
        {panda.name}
      </Text>
    </View>
  );
}

/**
 * One published 比一比: the two pandas' covers side by side, split by a hairline with 比 on it, their
 * names at the bottom corners, and the title and the dek under the photo. It opens the comparison.
 */
export function ComparisonCard({
  comparison,
  pandas,
  width,
}: {
  comparison: Comparison;
  pandas: readonly [PandaListItem, PandaListItem];
  width: number;
}) {
  const [a, b] = pandas;
  return (
    <PressScale
      onPress={() => router.push({ pathname: "/compare", params: { a: a.slug, b: b.slug } })}
      role="button"
      accessibilityLabel={`比一比：${comparison.title}，${a.name}和${b.name}。${comparison.dek}`}
      style={{ width }}
    >
      <View className="gap-stack-tight">
        <View
          className="flex-row"
          style={{ height: Math.round(width * 0.75), borderRadius: RADIUS.tile, borderCurve: "continuous", overflow: "hidden", backgroundColor: PLACEHOLDER }}
        >
          <Half panda={a} side="left" />
          <View className="bg-on-media" style={{ width: 1.5 }} />
          <Half panda={b} side="right" />
          <View
            className="absolute items-center justify-center rounded-full bg-on-media"
            style={{ width: BADGE, height: BADGE, left: width / 2 - BADGE / 2, top: Math.round(width * 0.375) - BADGE / 2 }}
          >
            <Text variant="footnote" role="none" className="font-semibold" style={{ color: INK }}>
              比
            </Text>
          </View>
        </View>
        <View className="gap-hair-gap">
          <Text variant="headline" numberOfLines={1}>
            {comparison.title}
          </Text>
          <Text variant="subheadline" className="text-muted-foreground" numberOfLines={2}>
            {comparison.dek}
          </Text>
        </View>
      </View>
    </PressScale>
  );
}

/** The two pandas of a comparison, or nothing when either is not in the release (the card is then left out). */
export function pairOf(comparison: Comparison, pandas: readonly PandaListItem[] | undefined): [PandaListItem, PandaListItem] | null {
  const [slugA, slugB] = comparison.pandaSlugs;
  const a = pandas?.find((panda) => panda.slug === slugA);
  const b = pandas?.find((panda) => panda.slug === slugB);
  return a && b ? [a, b] : null;
}

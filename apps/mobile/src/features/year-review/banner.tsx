import { Image } from "expo-image";
import { router } from "expo-router";
import { Pressable, View } from "react-native";

import { Scrim } from "@/components/scrim";
import { Text } from "@/components/ui/text";
import { localToday } from "@/features/engagement/seen";
import { usePandaCover } from "@/lib/covers";

import { useYearReview } from "./load";

/**
 * The 年度回顾 banner on 我的 (v4 `04-me`): the year's first panda as the photo, the year over 年度回顾.
 * It shows once the year holds a record of the fan's own, and opens the review.
 */
export function YearReviewBanner() {
  const year = Number(localToday().slice(0, 4));
  const { data } = useYearReview(year);
  const photo = usePandaCover(data?.review.first?.pandaId ?? "");
  if (!data || data.review.empty) return null;
  return (
    <Pressable
      role="link"
      accessibilityLabel={`${year} 年度回顾`}
      onPress={() => router.push("/year-review")}
      className="overflow-hidden rounded-group bg-media-placeholder active:opacity-80"
      style={{ height: 116, borderCurve: "continuous" }}
    >
      {photo ? <Image source={photo} style={{ position: "absolute", inset: 0 }} contentFit="cover" accessible={false} /> : null}
      <Scrim id="year-review-banner" height="100%" />
      <View className="mt-auto gap-hair-gap p-inset">
        <Text variant="footnote" className="font-semibold text-on-media tabular-nums">
          {year}
        </Text>
        <Text variant="title" className="text-on-media">
          年度回顾
        </Text>
      </View>
    </Pressable>
  );
}

import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { ScrollView, View } from "react-native";

import { PandaThumb } from "@/components/panda-thumb";
import { PressScale } from "@/components/press-scale";
import { SectionHeader } from "@/components/section-header";
import { Text } from "@/components/ui/text";
import { useFollowed } from "@/features/engagement/favorites";
import { openPanda } from "@/features/pandas/panda-row";
import { pandaIndexQueryOptions } from "@/features/pandas/pandas";
import { usePopularPandas } from "@/features/pandas/popular";

import { pickStarStrip } from "./gallery-filter";

const AVATAR_SIZE = 56;

function StripAvatar({ id, slug, name }: { id: string; slug: string; name: string }) {
  return (
    <PressScale
      onPress={() => openPanda(slug)}
      role="button"
      accessibilityLabel={name}
      className="items-center gap-1"
      style={{ width: AVATAR_SIZE + 6 }}
    >
      <PandaThumb pandaId={id} name={name} size={AVATAR_SIZE} />
      <Text variant="footnote" className="text-center font-medium" numberOfLines={1}>
        {name}
      </Text>
    </PressScale>
  );
}

/**
 * Option B top circular quick-jump strip:
 * - Signed out or zero follows: shows 明星熊猫 ("关注后切为你的关注").
 * - With followed pandas: switches to 你关注的 N 只.
 */
export function StarOrFollowedStrip() {
  const followed = useFollowed();
  const { data: pandas } = useQuery(pandaIndexQueryOptions());
  const { rows: popular } = usePopularPandas(pandas);

  const hasFollows = Boolean(followed && followed.size > 0);
  const items = useMemo(() => {
    if (!pandas) return [];
    if (hasFollows && followed) {
      return pandas.filter((panda) => followed.has(panda.id));
    }
    return pickStarStrip(pandas, popular, 10);
  }, [followed, hasFollows, pandas, popular]);

  if (items.length === 0) return null;

  return (
    <View className="gap-stack-tight">
      {hasFollows ? (
        <SectionHeader title={`你关注的 ${items.length} 只`} />
      ) : (
        <View className="flex-row items-baseline justify-between gap-row">
          <Text variant="title" className="min-w-0 flex-1" numberOfLines={1}>
            明星熊猫
          </Text>
          <Text variant="footnote" className="font-medium text-muted-foreground" numberOfLines={1}>
            关注后切为你的关注
          </Text>
        </View>
      )}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        className="-mx-gutter"
        contentContainerClassName="gap-row px-gutter"
      >
        {items.map((panda) => (
          <StripAvatar key={panda.id} id={panda.id} slug={panda.slug} name={panda.name} />
        ))}
      </ScrollView>
    </View>
  );
}

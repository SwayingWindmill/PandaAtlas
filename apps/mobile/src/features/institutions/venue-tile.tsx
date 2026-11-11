import { useQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import { router } from "expo-router";
import { View } from "react-native";

import { PhotoOutline } from "@/components/photo-outline";
import { PressScale } from "@/components/press-scale";
import { Text } from "@/components/ui/text";
import { semantic } from "@/design/tokens";
import { useInstitutionHero } from "@/features/institutions/institution-hero";
import { loadInstitution } from "@/features/institutions/institutions";
import { RADIUS } from "@/lib/surface";

const PLACEHOLDER = semantic.color.light.mediaPlaceholder;

/**
 * One venue in 找熊猫's 场馆 row: the photo its own page leads with (a resident's reviewed cover), its name under it.
 * A venue with no such photo keeps a plate with the first character of its name.
 */
export function VenueTile({ slug, name, size }: { slug: string; name: string; size: number }) {
  const { data } = useQuery({ queryKey: ["institution", slug], queryFn: () => loadInstitution(slug), staleTime: 300_000 });
  const hero = useInstitutionHero(data ? data.residents : null);
  return (
    <PressScale
      onPress={() => router.push({ pathname: "/institutions/[slug]", params: { slug } })}
      role="link"
      accessibilityLabel={name}
      style={{ width: size }}
      className="gap-stack-tight"
    >
      <View
        style={{ width: size, height: size, borderRadius: RADIUS.tile, borderCurve: "continuous", overflow: "hidden", backgroundColor: PLACEHOLDER }}
        className="items-center justify-center"
      >
        {hero ? (
          <Image source={hero.url} style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} contentFit="cover" transition={200} accessible={false} />
        ) : hero === null ? (
          <Text variant="title" className="text-on-media" aria-hidden>
            {name.slice(0, 1)}
          </Text>
        ) : null}
        <PhotoOutline radius={RADIUS.tile} />
      </View>
      <Text variant="footnote" numberOfLines={2}>
        {name}
      </Text>
    </PressScale>
  );
}

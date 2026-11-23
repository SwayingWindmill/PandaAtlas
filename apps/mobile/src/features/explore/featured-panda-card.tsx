import { useQuery } from "@tanstack/react-query";
import { Link } from "expo-router";
import { View } from "react-native";

import { PhotoOutline } from "@/components/photo-outline";
import { PressScale } from "@/components/press-scale";
import { RemoteImage } from "@/components/remote-image";
import { Scrim } from "@/components/scrim";
import { Text } from "@/components/ui/text";
import { semantic } from "@/design/tokens";
import { localToday } from "@/features/engagement/seen";
import { pandaIndexQueryOptions } from "@/features/pandas/pandas";
import { usePandaCover } from "@/lib/covers";
import { RADIUS } from "@/lib/surface";

import { pickFeaturedPanda } from "./gallery-filter";

const PLACEHOLDER = semantic.color.light.mediaPlaceholder;
const HERO_HEIGHT = 196;

function birthMonthLabel(birthDate: string | null): string | null {
  if (!birthDate) return null;
  const match = /^(\d{4})-(\d{2})/.exec(birthDate);
  if (!match) return birthDate.slice(0, 4) ? `${birthDate.slice(0, 4)} 年出生` : null;
  return `${match[1]} 年 ${Number(match[2])} 月出生`;
}

export function FeaturedPandaCard() {
  const { data: pandas } = useQuery(pandaIndexQueryOptions());
  const panda = pandas ? pickFeaturedPanda(pandas, localToday()) : null;
  const photo = usePandaCover(panda?.id);

  if (!panda) return null;

  const subtitle = [panda.place, birthMonthLabel(panda.birthDate)].filter(Boolean).join("　");

  return (
    <Link href={{ pathname: "/pandas/[slug]", params: { slug: panda.slug } }} asChild>
      <Link.AppleZoom>
        <PressScale role="link" accessibilityLabel={`精选档案，${panda.name}${subtitle ? `，${subtitle}` : ""}`} style={{ height: HERO_HEIGHT }}>
          <View
            style={{
              flex: 1,
              borderRadius: RADIUS.card,
              borderCurve: "continuous",
              overflow: "hidden",
              backgroundColor: PLACEHOLDER,
            }}
          >
            {photo ? (
              <RemoteImage
                source={photo}
                style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
                contentFit="cover"
                transition={250}
                accessible={false}
              />
            ) : null}
            <Scrim id="explore-featured-scrim" />
            <View className="absolute left-3.5 top-3 rounded-pill bg-bar-material px-2.5 py-1">
              <Text variant="footnote" className="font-semibold text-foreground">
                精选档案
              </Text>
            </View>
            <View className="absolute right-0 bottom-0 left-0 gap-0.5 px-4 pb-3.5">
              <Text variant="display" role="none" className="text-on-media" numberOfLines={1}>
                {panda.name}
              </Text>
              {subtitle ? (
                <Text variant="footnote" className="font-medium text-on-media/90" numberOfLines={1}>
                  {subtitle}
                </Text>
              ) : null}
            </View>
            <PhotoOutline radius={RADIUS.card} />
          </View>
        </PressScale>
      </Link.AppleZoom>
    </Link>
  );
}

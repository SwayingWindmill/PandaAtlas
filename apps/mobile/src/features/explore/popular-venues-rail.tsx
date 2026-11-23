import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { ScrollView, View } from "react-native";

import { PandaThumb } from "@/components/panda-thumb";
import { PressScale } from "@/components/press-scale";
import { SectionHeader } from "@/components/section-header";
import { Text } from "@/components/ui/text";
import { mapViewQueryOptions } from "@/features/map/load";
import { useIOSColors } from "@/lib/theme";

const MINI_FACE = 28;
const CARD_WIDTH = 160;
const CARD_GAP = 10;

export function PopularVenuesRail() {
  const colors = useIOSColors();
  const { data: view } = useQuery(mapViewQueryOptions());

  const venues = (view?.items ?? []).filter((item) => item.residentCount > 0).slice(0, 8);
  if (venues.length === 0) return null;

  return (
    <View className="gap-stack-tight">
      <SectionHeader
        title="热门场馆"
        action={{ label: "按地区查看", href: "/institutions" }}
      />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        className="-mx-gutter"
        contentContainerClassName="px-gutter"
        contentContainerStyle={{ gap: CARD_GAP }}
        snapToInterval={CARD_WIDTH + CARD_GAP}
        snapToAlignment="start"
        decelerationRate="fast"
      >
        {venues.map((venue) => (
          <PressScale
            key={venue.id}
            role="link"
            accessibilityLabel={`${venue.name}，现居 ${venue.residentCount} 只`}
            onPress={() =>
              router.push({
                pathname: venue.kind === "institution" ? "/institutions/[slug]" : "/places/[slug]",
                params: { slug: venue.slug },
              })
            }
            className="gap-2 rounded-tile bg-card px-3 py-2.5"
            style={{ width: CARD_WIDTH, borderCurve: "continuous" }}
          >
            <View className="flex-row items-center">
              {venue.residents.slice(0, 3).map((resident, idx) => (
                <View
                  key={resident.id}
                  style={{
                    marginLeft: idx > 0 ? -6 : 0,
                    borderWidth: 2,
                    borderColor: colors.card,
                    borderRadius: MINI_FACE / 2 + 2,
                  }}
                >
                  <PandaThumb pandaId={resident.id} name={resident.name} size={MINI_FACE} />
                </View>
              ))}
            </View>
            <View className="gap-hair-gap">
              <Text variant="subheadline" className="font-semibold" numberOfLines={1}>
                {venue.name}
              </Text>
              <Text variant="footnote" className="text-muted-foreground tabular-nums" numberOfLines={1}>
                {`现居 ${venue.residentCount} 只`}
              </Text>
            </View>
          </PressScale>
        ))}
      </ScrollView>
    </View>
  );
}

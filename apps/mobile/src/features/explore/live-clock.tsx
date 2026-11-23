import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Linking, Pressable, ScrollView, View } from "react-native";
import { useCSSVariable } from "uniwind";

import { Icon } from "@/components/icon";
import { Video } from "@/components/icons";
import { PandaThumb } from "@/components/panda-thumb";
import { Text } from "@/components/ui/text";
import { institutionListQueryOptions } from "@/features/institutions/institutions";
import { mapViewQueryOptions } from "@/features/map/load";
import { useIOSColors } from "@/lib/theme";

import { type VenueClockStatus, buildLiveClockCards, localClockOf } from "./venue-clock";

const MINI_FACE = 26;
const CARD_WIDTH = 244;
const CARD_GAP = 10;

export function LiveClockSection() {
  const colors = useIOSColors();
  const [wildInk, warningInk] = useCSSVariable(["--color-map-wild-ink", "--color-warning"]);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(timer);
  }, []);

  const { data: mapView } = useQuery(mapViewQueryOptions());
  const { data: institutions } = useQuery(institutionListQueryOptions());

  const cards = useMemo(() => {
    if (!mapView) return [];
    const institutionInputs = (institutions ?? []).map((inst) => ({
      slug: inst.slug,
      liveCamUrl: inst.profile?.liveCamUrl ?? null,
    }));
    return buildLiveClockCards(mapView.items, institutionInputs, now).slice(0, 8);
  }, [institutions, mapView, now]);

  if (cards.length === 0) return null;

  const beijingTime = localClockOf(now, "Asia/Shanghai").hhmm;
  const activeColor = String(wildInk || colors.tint);
  const upcomingColor = String(warningInk || colors.secondaryLabel);

  const statusColorOf = (status: VenueClockStatus) => {
    if (status === "active") return activeColor;
    if (status === "upcoming" || status === "nap") return upcomingColor;
    return colors.secondaryLabel;
  };

  return (
    <View className="gap-stack-tight">
      <View className="flex-row items-baseline justify-between gap-row">
        <Text variant="title" className="min-w-0 flex-1" numberOfLines={1}>
          此刻谁醒着
        </Text>
        <Text variant="footnote" className="font-medium text-muted-foreground tabular-nums">
          {`北京时间 ${beijingTime}`}
        </Text>
      </View>

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
        {cards.map((card) => {
          const statusColor = statusColorOf(card.status);
          const namesText =
            card.residents.length > 0
              ? card.residents
                  .slice(0, 2)
                  .map((p) => p.name)
                  .join("　")
              : `${card.residentCount} 只在馆`;
          const openInstitution = () =>
            router.push({ pathname: "/institutions/[slug]", params: { slug: card.slug } });

          return (
            <View
              key={card.slug}
              className="gap-2 rounded-group bg-card px-3 py-2.5"
              style={{ width: CARD_WIDTH, borderCurve: "continuous" }}
            >
              <Pressable
                role="button"
                accessibilityLabel={`${card.name}，当地 ${card.localTime}，${card.statusLabel}`}
                onPress={openInstitution}
                className="gap-2 active:opacity-75"
              >
                <View className="flex-row items-center gap-1.5">
                  <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: statusColor }} />
                  <Text variant="footnote" className="font-semibold tabular-nums" style={{ color: statusColor }}>
                    {`当地 ${card.localTime}　${card.statusLabel}`}
                  </Text>
                </View>

                <Text variant="headline" numberOfLines={1}>
                  {card.name}
                </Text>
              </Pressable>

              <View className="flex-row items-center justify-between gap-2 pt-0.5">
                <Pressable
                  role="button"
                  accessibilityLabel={`查看${card.name}在馆大熊猫`}
                  onPress={openInstitution}
                  className="min-w-0 flex-1 flex-row items-center gap-2 active:opacity-75"
                >
                  {card.residents.length > 0 ? (
                    <View className="flex-row items-center" aria-hidden>
                      {card.residents.slice(0, 2).map((resident, idx) => (
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
                  ) : null}
                  <Text variant="footnote" className="min-w-0 flex-1 font-medium text-muted-foreground" numberOfLines={1}>
                    {namesText}
                  </Text>
                </Pressable>

                {card.liveCamUrl ? (
                  <Pressable
                    role="link"
                    accessibilityLabel={`看${card.name}官方直播`}
                    hitSlop={8}
                    onPress={() => void Linking.openURL(card.liveCamUrl!)}
                    className="flex-row items-center gap-1 rounded-pill bg-highlight-soft px-2.5 active:opacity-70"
                    style={{ height: 28 }}
                  >
                    <Icon icon={Video} size={13} tone="tint" strokeWidth={2} />
                    <Text variant="footnote" className="font-semibold text-primary">
                      看直播
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

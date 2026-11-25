import { router } from "expo-router";
import { Pressable, Share, StyleSheet, View } from "react-native";
import Animated from "react-native-reanimated";
import Svg, { Defs, Line, LinearGradient, Rect, Stop } from "react-native-svg";
import { useCSSVariable } from "uniwind";

import { useStacked } from "@/components/grouped-list";
import { Icon } from "@/components/icon";
import { Share as ShareIcon } from "@/components/icons";
import { PandaThumb } from "@/components/panda-thumb";
import { PhotoOutline } from "@/components/photo-outline";
import { ProgressRing } from "@/components/progress-ring";
import { RemoteImage } from "@/components/remote-image";
import { Scrim } from "@/components/scrim";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { PAGE_ENTER } from "@/design/motion";
import { useInstitutionHero } from "@/features/institutions/institution-hero";
import type { InstitutionDetail } from "@/features/institutions/institutions";
import { openPanda } from "@/features/pandas/panda-row";
import type { PandaListItem } from "@/features/pandas/pandas";
import { longDate } from "@/features/pandas/profile";
import { HAIRLINE, RADIUS } from "@/lib/surface";
import { useIOSColors } from "@/lib/theme";
import { cn } from "@/lib/utils";

const HERO_HEIGHT = 168;
const NOTCH_SIZE = 24;

/**
 * Collectible notched check-in souvenir ticket shown right after saving a venue visit
 * and the pandas seen during that visit.
 */
export function SouvenirTicket({
  institution,
  facilityName,
  visitedOn,
  visitCount,
  note,
  newlyLitPandas,
  seenIds,
  onDone,
}: {
  institution: InstitutionDetail;
  facilityName: string;
  visitedOn: string;
  visitCount: number;
  note: string | null;
  newlyLitPandas: PandaListItem[];
  seenIds: ReadonlySet<string>;
  onDone: () => void;
}) {
  const colors = useIOSColors();
  const stacked = useStacked();
  const [tint, cardGround] = useCSSVariable(["--color-highlight-soft", "--color-card"]);
  const hero = useInstitutionHero(institution.residents);

  const totalResidents = institution.residents.length;
  const venueSeenCount = institution.residents.filter((panda) => seenIds.has(panda.id)).length;
  const pct = totalResidents > 0 ? Math.round((venueSeenCount / totalResidents) * 100) : 0;
  const allSeenAtVenue = totalResidents > 0 && venueSeenCount >= totalResidents;

  const stripSource = newlyLitPandas.length > 0 ? newlyLitPandas : institution.residents;
  const shownPandas = stripSource.slice(0, 3);
  const extraCount = newlyLitPandas.length > 3 ? newlyLitPandas.length - 3 : 0;

  const dateBadge = visitCount > 1 ? `${longDate(visitedOn)}　第 ${visitCount} 次到访` : longDate(visitedOn);
  const subtitle = [
    institution.meta || null,
    facilityName !== institution.name ? facilityName : null,
    "线下逛园纪念票根",
  ]
    .filter(Boolean)
    .join("　");

  function shareTicket() {
    const lines = [
      "吱熊猫　线下逛园纪念票根",
      `${institution.name}${facilityName !== institution.name ? `（${facilityName}）` : ""}`,
      dateBadge,
      ...(note ? [`“${note}”`] : []),
      ...(newlyLitPandas.length > 0 ? [`当日点亮见过：${newlyLitPandas.map((p) => p.name).join("、")}`] : []),
      ...(totalResidents > 0 ? [`本馆已见过 ${venueSeenCount} / ${totalResidents} 只`] : []),
    ];
    void Share.share({ message: lines.join("\n") }).catch(() => undefined);
  }

  return (
    <Animated.View entering={PAGE_ENTER} className="gap-stack">
      <View
        className="rounded-card border-hairline border-border bg-card"
        style={{ borderCurve: "continuous" }}
      >
        <View
          className="overflow-hidden rounded-t-card bg-media-placeholder"
          style={{ height: HERO_HEIGHT, borderCurve: "continuous" }}
        >
          {hero ? (
            <>
              <RemoteImage
                source={hero.url}
                style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
                contentFit="cover"
                accessible={false}
                transition={200}
              />
              <Scrim id="souvenir-ticket-hero" height="72%" />
            </>
          ) : (
            <Svg aria-hidden style={StyleSheet.absoluteFill} width="100%" height="100%" preserveAspectRatio="none">
              <Defs>
                <LinearGradient id="souvenir-ticket-plate" x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0" stopColor={String(tint)} stopOpacity={1} />
                  <Stop offset="0.7" stopColor={String(tint)} stopOpacity={0.45} />
                  <Stop offset="1" stopColor={String(cardGround)} stopOpacity={1} />
                </LinearGradient>
              </Defs>
              <Rect x="0" y="0" width="100%" height="100%" fill="url(#souvenir-ticket-plate)" />
            </Svg>
          )}

          <View className="flex-1 justify-between p-inset">
            <View
              className={cn(
                "self-start rounded-pill px-2.5 py-1",
                hero ? "bg-glass-fallback" : "border-hairline border-border bg-background/85",
              )}
            >
              <Text
                variant="footnote"
                className={cn("font-semibold tabular-nums", hero ? "text-on-media" : "text-foreground")}
              >
                {dateBadge}
              </Text>
            </View>
            <View className="gap-0.5">
              <Text variant="title" className={hero ? "text-on-media" : "text-foreground"} numberOfLines={2}>
                {institution.name}
              </Text>
              <Text
                variant="footnote"
                className={hero ? "text-on-media/85" : "text-muted-foreground"}
                numberOfLines={1}
              >
                {subtitle}
              </Text>
            </View>
          </View>
          {hero ? <PhotoOutline radius={RADIUS.card} /> : null}
        </View>

        {/* Left and right semi-circle ticket notches + dashed tear line */}
        <View
          className="relative h-6 justify-center"
          aria-hidden
          importantForAccessibility="no-hide-descendants"
        >
          <View className="px-5">
            <Svg height={2} width="100%">
              <Line
                x1="0"
                y1="1"
                x2="100%"
                y2="1"
                stroke={colors.separator}
                strokeWidth={1}
                strokeDasharray="5 4"
              />
            </Svg>
          </View>
          <View
            style={{
              position: "absolute",
              left: -NOTCH_SIZE / 2,
              width: NOTCH_SIZE,
              height: NOTCH_SIZE,
              borderRadius: NOTCH_SIZE / 2,
              backgroundColor: colors.background,
              borderWidth: HAIRLINE,
              borderColor: colors.separator,
            }}
          />
          <View
            style={{
              position: "absolute",
              left: -2,
              width: 4,
              height: NOTCH_SIZE - 2,
              backgroundColor: colors.background,
            }}
          />
          <View
            style={{
              position: "absolute",
              right: -NOTCH_SIZE / 2,
              width: NOTCH_SIZE,
              height: NOTCH_SIZE,
              borderRadius: NOTCH_SIZE / 2,
              backgroundColor: colors.background,
              borderWidth: HAIRLINE,
              borderColor: colors.separator,
            }}
          />
          <View
            style={{
              position: "absolute",
              right: -2,
              width: 4,
              height: NOTCH_SIZE - 2,
              backgroundColor: colors.background,
            }}
          />
        </View>

        <View className="gap-4 px-inset pt-1 pb-inset">
          {note ? (
            <View
              className="rounded-control border-hairline border-border bg-background px-3.5 py-2.5"
              style={{ borderCurve: "continuous" }}
            >
              <Text variant="subheadline" className="text-foreground">
                {`“${note}”`}
              </Text>
            </View>
          ) : null}

          <View className="gap-stack-tight">
            <View className="flex-row items-baseline justify-between gap-2">
              <Text variant="footnote" className="font-semibold text-foreground tabular-nums">
                {newlyLitPandas.length > 0 ? `当日点亮见过　${newlyLitPandas.length} 只` : "在馆大熊猫"}
              </Text>
              {allSeenAtVenue ? (
                <Text variant="footnote" className="font-semibold text-primary">
                  全部收入图鉴
                </Text>
              ) : extraCount > 0 ? (
                <Text variant="footnote" className="text-muted-foreground tabular-nums">
                  {`另有 ${extraCount} 只`}
                </Text>
              ) : null}
            </View>

            {shownPandas.length > 0 ? (
              <View className={cn("gap-2", stacked ? "flex-col" : "flex-row")}>
                {shownPandas.map((panda) => (
                  <Pressable
                    key={panda.id}
                    role="link"
                    accessibilityLabel={`查看${panda.name}资料`}
                    onPress={() => openPanda(panda.slug)}
                    className={cn(
                      "items-center gap-1.5 rounded-tile border-hairline border-border bg-background px-2 py-2.5 active:opacity-75",
                      !stacked && "min-w-0 flex-1",
                    )}
                    style={{ borderCurve: "continuous" }}
                  >
                    <PandaThumb pandaId={panda.id} name={panda.name} size={44} shape="round" />
                    <Text variant="footnote" className="font-semibold" numberOfLines={1}>
                      {panda.name}
                    </Text>
                  </Pressable>
                ))}
              </View>
            ) : (
              <Text variant="footnote" className="text-muted-foreground">
                已记下本次逛园足迹
              </Text>
            )}
          </View>

          <View
            className={cn(
              "border-t-hairline border-border pt-3",
              stacked ? "gap-2.5" : "flex-row items-center justify-between gap-3",
            )}
          >
            {totalResidents > 0 ? (
              <View className={cn("flex-row items-center gap-3", !stacked && "min-w-0 flex-1")}>
                <ProgressRing
                  size="small"
                  value={venueSeenCount / totalResidents}
                  label={`${pct}%`}
                  accessibilityLabel={`本馆已见过 ${venueSeenCount} / ${totalResidents} 只`}
                />
                <View className="min-w-0 flex-1 gap-0.5">
                  <Text variant="subheadline" className="font-semibold tabular-nums" numberOfLines={stacked ? undefined : 1}>
                    {`本馆已见过 ${venueSeenCount} / ${totalResidents} 只`}
                  </Text>
                  <Text variant="footnote" className="text-muted-foreground" numberOfLines={stacked ? undefined : 1}>
                    {allSeenAtVenue ? "住在这里的都已见过" : `还有 ${totalResidents - venueSeenCount} 只待相遇`}
                  </Text>
                </View>
              </View>
            ) : (
              <Text variant="subheadline" className={cn("font-semibold", !stacked && "min-w-0 flex-1")}>
                已收进看猫日记
              </Text>
            )}
            <Text variant="footnote" className="shrink-0 text-tertiary-foreground">
              吱熊猫　看猫护照
            </Text>
          </View>
        </View>
      </View>

      <View className="gap-2.5">
        <Button onPress={shareTicket}>
          <Icon icon={ShareIcon} size="subhead" tone="onButton" strokeWidth={2} />
          <Text>分享纪念票根</Text>
        </Button>
        <View className={cn("gap-2.5", stacked ? "flex-col" : "flex-row")}>
          <Button
            variant="secondary"
            className={stacked ? undefined : "flex-1"}
            onPress={() => router.push("/visits")}
          >
            <Text>查看看猫日记</Text>
          </Button>
          <Button variant="secondary" className={stacked ? undefined : "flex-1"} onPress={onDone}>
            <Text>返回场馆页</Text>
          </Button>
        </View>
      </View>
    </Animated.View>
  );
}

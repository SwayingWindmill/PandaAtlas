import { Linking, Platform, Pressable, ScrollView, View } from "react-native";
import Svg, { Circle, Path, Rect } from "react-native-svg";

import { ICON_INSET, ListCell, ListSection, useSingleColumn, useStacked } from "@/components/grouped-list";
import { Icon } from "@/components/icon";
import {
  Camera,
  Clock,
  Globe,
  Hourglass,
  IdCard,
  Info,
  type LucideIcon,
  MapPin,
  Navigation,
  PawPrint,
  ShieldAlert,
  Sunrise,
  Thermometer,
  Ticket,
  TramFront,
} from "@/components/icons";
import { PandaThumb } from "@/components/panda-thumb";
import { Text } from "@/components/ui/text";
import { VENUE_CLOCK_SPECS } from "@/features/explore/venue-clock";
import {
  type Facility,
  type InstitutionDetail,
  addressOf,
  hasGuide,
  hostname,
} from "@/features/institutions/institutions";
import {
  type CuratedPhotoSpot,
  type PracticalTip,
  type PreTripBentoItem,
  type RouteStep,
  VENUE_GUIDE_EXTRAS,
  buildPreTripBento,
  mergePhotoSpots,
  mergePracticalTips,
} from "@/features/institutions/venue-guide-extras";
import type { PandaListItem } from "@/features/pandas/pandas";
import { ViewingTiming } from "@/features/viewing/viewing-timing";
import { HAIRLINE, RADIUS } from "@/lib/surface";
import { useIOSColors } from "@/lib/theme";
import { cn } from "@/lib/utils";

const BENTO_ICON: Record<PreTripBentoItem["key"], LucideIcon> = {
  hours: Clock,
  ticket: Ticket,
  bestWindow: Sunrise,
  duration: Hourglass,
};

const TIP_ICON: Record<PracticalTip["kind"], LucideIcon> = {
  temperature: Thermometer,
  id: IdCard,
  etiquette: ShieldAlert,
  info: Info,
};

export function openFacilityNavigation(name: string, { latitude, longitude }: NonNullable<Facility["coordinates"]>) {
  const label = encodeURIComponent(name);
  const url = Platform.select({
    ios: `maps:?q=${label}&ll=${latitude},${longitude}`,
    default: `geo:${latitude},${longitude}?q=${latitude},${longitude}(${label})`,
  });
  void Linking.openURL(url);
}

export function NavigateCell({ facility, detail }: { facility: Facility; detail?: string }) {
  const coordinates = facility.coordinates;
  if (!coordinates) return null;
  return (
    <ListCell
      icon={Navigation}
      label="导航过去"
      detail={detail}
      tone="tint"
      accessibilityLabel={`在地图中导航到${facility.name}`}
      onPress={() => openFacilityNavigation(facility.name, coordinates)}
      last
    />
  );
}

function PreTripBentoGrid({ items }: { items: readonly PreTripBentoItem[] }) {
  const single = useSingleColumn();
  if (items.length === 0) return null;

  const rows: PreTripBentoItem[][] = [];
  if (single) {
    for (const item of items) rows.push([item]);
  } else {
    for (let i = 0; i < items.length; i += 2) {
      rows.push(items.slice(i, i + 2));
    }
  }

  return (
    <View className="gap-2">
      {rows.map((row, rowIndex) => (
        <View key={rowIndex} className={single ? "gap-2" : "flex-row gap-2"}>
          {row.map((item) => (
            <View
              key={item.key}
              accessible
              accessibilityLabel={item.spoken}
              className="min-w-0 flex-1 gap-1 border-hairline border-border bg-card px-3.5 py-3"
              style={{ borderRadius: RADIUS.group, borderCurve: "continuous" }}
            >
              <View className="flex-row items-center gap-1.5">
                <Icon icon={BENTO_ICON[item.key]} size="footnote" tone="tint" strokeWidth={2} />
                <Text variant="footnote" className="font-medium text-muted-foreground" numberOfLines={1}>
                  {item.label}
                </Text>
              </View>
              <Text variant="headline" className="font-bold tabular-nums" numberOfLines={1}>
                {item.value}
              </Text>
              {item.sub ? (
                <Text variant="footnote" className="text-muted-foreground" numberOfLines={2}>
                  {item.sub}
                </Text>
              ) : null}
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

function RouteTimelineCard({
  steps,
  residents,
}: {
  steps: readonly RouteStep[];
  residents: readonly PandaListItem[];
}) {
  const colors = useIOSColors();
  const bySlug = new Map(residents.map((p) => [p.slug, p]));
  if (steps.length === 0) return null;

  return (
    <View className="gap-stack-tight">
      <View className="flex-row items-baseline justify-between gap-row">
        <Text variant="headline" role="heading">
          推荐逛园路线
        </Text>
        <Text variant="footnote" className="text-muted-foreground">
          错峰顺游建议
        </Text>
      </View>
      <View
        className="border-hairline border-border bg-card px-4 py-3.5"
        style={{ borderRadius: RADIUS.group, borderCurve: "continuous" }}
      >
        {steps.map((step, index) => {
          const isLast = index === steps.length - 1;
          const faces = (step.highlightSlugs ?? []).flatMap((slug) => bySlug.get(slug) ?? []).slice(0, 2);
          return (
            <View key={step.step} className="flex-row gap-3">
              <View className="items-center" aria-hidden importantForAccessibility="no-hide-descendants">
                <View
                  className={cn(
                    "size-6 items-center justify-center rounded-pill",
                    index === 0 ? "bg-primary" : "bg-highlight-soft",
                  )}
                >
                  <Text
                    variant="footnote"
                    className={cn("font-bold tabular-nums", index === 0 ? "text-primary-foreground" : "text-primary")}
                  >
                    {step.step}
                  </Text>
                </View>
                {isLast ? null : <View className="my-1 flex-1 bg-border" style={{ width: 1.5 }} />}
              </View>
              <View className={cn("min-w-0 flex-1 gap-0.5", !isLast && "pb-3.5")}>
                <View className="flex-row items-baseline justify-between gap-2">
                  <Text variant="headline" className="min-w-0 flex-1" numberOfLines={2}>
                    {step.title}
                  </Text>
                  <Text variant="footnote" className="shrink-0 font-semibold text-primary tabular-nums">
                    {step.time}
                  </Text>
                </View>
                <View className="flex-row items-center justify-between gap-2">
                  <Text variant="footnote" className="min-w-0 flex-1 text-muted-foreground">
                    {step.detail}
                  </Text>
                  {faces.length > 0 ? (
                    <View className="flex-row items-center shrink-0" aria-hidden importantForAccessibility="no-hide-descendants">
                      {faces.map((panda, faceIndex) => (
                        <View
                          key={panda.id}
                          style={{
                            marginLeft: faceIndex === 0 ? 0 : -6,
                            borderWidth: 1.5,
                            borderColor: colors.card,
                            borderRadius: 12,
                          }}
                        >
                          <PandaThumb pandaId={panda.id} name={panda.name} size={22} />
                        </View>
                      ))}
                    </View>
                  ) : null}
                </View>
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}

function PhotoSpotsStrip({ spots }: { spots: readonly CuratedPhotoSpot[] }) {
  const single = useSingleColumn();
  if (spots.length === 0) return null;

  return (
    <View className="gap-stack-tight">
      <View className="flex-row items-baseline justify-between gap-row">
        <Text variant="headline" role="heading">
          拍照点位
        </Text>
        <Text variant="footnote" className="text-muted-foreground">
          推荐时段与机位
        </Text>
      </View>
      <ScrollView
        horizontal={!single}
        showsHorizontalScrollIndicator={false}
        className={single ? undefined : "-mx-gutter"}
        contentContainerClassName={single ? "gap-2.5" : "gap-2.5 px-gutter"}
      >
        {spots.map((spot) => (
          <View
            key={spot.name}
            accessible
            accessibilityLabel={`${spot.name}${spot.window ? `，最佳时段 ${spot.window.start} 至 ${spot.window.end}` : ""}，${spot.note}`}
            className="gap-1.5 border-hairline border-border bg-card px-3.5 py-3"
            style={{
              width: single ? undefined : 228,
              borderRadius: RADIUS.group,
              borderCurve: "continuous",
            }}
          >
            <View className="flex-row items-center justify-between gap-2">
              <Icon icon={Camera} size="footnote" tone="tint" strokeWidth={2} />
              {spot.window ? (
                <Text variant="footnote" className="font-semibold text-primary tabular-nums">
                  {`${spot.window.start}–${spot.window.end}`}
                </Text>
              ) : null}
            </View>
            <Text variant="headline" numberOfLines={2}>
              {spot.name}
            </Text>
            <Text variant="footnote" className="text-muted-foreground" numberOfLines={3}>
              {spot.note}
            </Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

function VenueLocationMapCard({
  facility,
  distanceHint,
  transitText,
  areaSummary,
}: {
  facility: Facility;
  distanceHint?: string;
  transitText?: string;
  areaSummary?: string;
}) {
  const colors = useIOSColors();
  const stacked = useStacked();
  const address = addressOf(facility);
  const transitTip = facility.tips.find((tip) => tip.label === "怎么去")?.text ?? transitText;
  const pandaArea = facility.guide.find((row) => row.label === "熊猫馆")?.value ?? areaSummary;
  const coordinates = facility.coordinates;

  if (!coordinates && !address && !transitTip && !pandaArea) return null;

  return (
    <View
      className="overflow-hidden border-hairline border-border bg-card"
      style={{ borderRadius: RADIUS.group, borderCurve: "continuous" }}
    >
      {coordinates ? (
        <View
          className="overflow-hidden"
          style={{ height: 96, backgroundColor: colors.mapLand }}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          <Svg viewBox="0 0 350 96" width="100%" height="100%" preserveAspectRatio="xMidYMid slice">
            <Rect width="350" height="96" fill={colors.mapLand} />
            <Path d="M118,8 Q210,2 296,20 L332,78 Q220,90 144,72 Z" fill={colors.mapWild} />
            <Path d="M0,70 Q112,50 212,64 T350,44" fill="none" stroke={colors.mapWater} strokeWidth={7} />
            <Path d="M0,36 L350,30" fill="none" stroke={colors.separator} strokeWidth={2.5} />
            <Path d="M180,0 L196,96" fill="none" stroke={colors.separator} strokeWidth={2.5} />
            <Circle cx="222" cy="42" r="14" fill={colors.tint} fillOpacity={0.2} />
            <Circle cx="222" cy="42" r="6" fill={colors.tint} stroke={colors.buttonLabel} strokeWidth={2} />
          </Svg>
          {distanceHint ? (
            <View className="absolute bottom-2 left-3 rounded-pill border-hairline border-border bg-background/90 px-2.5 py-0.5">
              <Text variant="footnote" className="font-semibold">
                {distanceHint}
              </Text>
            </View>
          ) : null}
        </View>
      ) : null}

      {address || coordinates ? (
        <View className={cn("gap-3 px-4 py-3", stacked ? "items-start" : "flex-row items-center")}>
          {stacked ? null : <Icon icon={MapPin} size="subhead" tone="tint" strokeWidth={2} />}
          <View className="min-w-0 flex-1 gap-0.5">
            <Text variant="body" numberOfLines={2}>
              {address ?? facility.name}
            </Text>
            {pandaArea ? (
              <Text variant="footnote" className="text-muted-foreground" numberOfLines={2}>
                {`重点展区　${pandaArea}`}
              </Text>
            ) : null}
          </View>
          {coordinates ? (
            <Pressable
              role="button"
              accessibilityLabel={`在地图中导航到${facility.name}`}
              onPress={() => openFacilityNavigation(facility.name, coordinates)}
              className="min-h-11 shrink-0 justify-center active:opacity-75"
            >
              <View className="rounded-pill bg-highlight-soft px-3 py-1.5">
                <Text variant="footnote" className="font-semibold text-primary">
                  导航
                </Text>
              </View>
            </Pressable>
          ) : null}
        </View>
      ) : pandaArea ? (
        <View className="flex-row items-start gap-3 px-4 py-3">
          <Icon icon={PawPrint} size="subhead" tone="secondary" style={{ marginTop: 3 }} />
          <View className="min-w-0 flex-1 gap-0.5">
            <Text variant="footnote" className="text-muted-foreground">
              熊猫馆
            </Text>
            <Text variant="body">{pandaArea}</Text>
          </View>
        </View>
      ) : null}

      {transitTip ? (
        <>
          {address || coordinates || pandaArea ? (
            <View className="bg-border" style={[{ height: HAIRLINE }, stacked ? { marginLeft: 16 } : ICON_INSET]} />
          ) : null}
          <View className="flex-row items-start gap-3 px-4 py-3">
            {stacked ? null : <Icon icon={TramFront} size="subhead" tone="secondary" style={{ marginTop: 3 }} />}
            <View className="min-w-0 flex-1 gap-0.5">
              <Text variant="footnote" className="text-muted-foreground">
                交通接驳
              </Text>
              <Text variant="subheadline">{transitTip}</Text>
            </View>
          </View>
        </>
      ) : null}
    </View>
  );
}

function PracticalTipsCard({ tips }: { tips: readonly PracticalTip[] }) {
  if (tips.length === 0) return null;
  const shown = tips.filter((tip) => tip.title !== "怎么去").slice(0, 4);
  if (shown.length === 0) return null;

  return (
    <View className="gap-stack-tight">
      <Text variant="headline" role="heading">
        行前贴士
      </Text>
      <ListSection>
        {shown.map((tip, index) => (
          <View key={`${tip.title}-${index}`}>
            <View className="flex-row items-start gap-3 px-4 py-3">
              <Icon icon={TIP_ICON[tip.kind]} size="subhead" tone="tint" style={{ marginTop: 3 }} />
              <View className="min-w-0 flex-1 gap-0.5">
                <Text variant="subheadline" className="font-semibold">
                  {tip.title}
                </Text>
                <Text variant="footnote" className="text-muted-foreground">
                  {tip.text}
                </Text>
              </View>
            </View>
            {index === shown.length - 1 ? null : (
              <View className="bg-border" style={[{ height: HAIRLINE }, ICON_INSET]} />
            )}
          </View>
        ))}
      </ListSection>
    </View>
  );
}

/** First-principles enriched Visit Guide rendered seamlessly inside the single-scroll institution canvas. */
export function VisitGuide({
  institution,
}: {
  institution: InstitutionDetail;
}) {
  const extras = VENUE_GUIDE_EXTRAS[institution.slug];
  const bento = buildPreTripBento(institution);
  const spots = mergePhotoSpots(institution.facilities, extras);
  const tips = mergePracticalTips(institution.facilities, extras);
  const guided = institution.facilities.filter(hasGuide);
  const primaryLocation = institution.facilities.find((f) => f.coordinates) ?? institution.facilities[0];
  const primaryViewingFacility = institution.facilities.find((f) => f.viewing) ?? (() => {
    const fallback = VENUE_CLOCK_SPECS[institution.slug];
    if (!fallback || !primaryLocation) return undefined;
    return {
      ...primaryLocation,
      viewing: { active: [...fallback.active], nap: fallback.nap },
    };
  })();

  const hasContent =
    bento.length > 0 ||
    spots.length > 0 ||
    tips.length > 0 ||
    (extras?.routeSteps?.length ?? 0) > 0 ||
    guided.length > 0 ||
    Boolean(institution.websiteUrl);

  if (!hasContent) return null;

  return (
    <View className="gap-4">
      <View className="flex-row items-baseline justify-between gap-row">
        <View className="flex-row items-center gap-stack-tight">
          <Icon icon={Ticket} size="title3" />
          <Text variant="title" role="heading">
            参观攻略
          </Text>
        </View>
        {extras?.durationLabel ? (
          <Text variant="footnote" className="text-muted-foreground">
            {`建议预留 ${extras.durationLabel}`}
          </Text>
        ) : null}
      </View>

      <PreTripBentoGrid items={bento} />

      {primaryViewingFacility ? (
        <ViewingTiming facility={{ ...primaryViewingFacility, photoSpots: [] }} />
      ) : null}

      {extras?.routeSteps && extras.routeSteps.length > 0 ? (
        <RouteTimelineCard steps={extras.routeSteps} residents={institution.residents} />
      ) : null}

      <PhotoSpotsStrip spots={spots} />

      {primaryLocation ? (
        <VenueLocationMapCard
          facility={primaryLocation}
          distanceHint={extras?.distanceHint}
          transitText={extras?.defaultTransitText}
          areaSummary={extras?.defaultAreaSummary}
        />
      ) : null}

      <PracticalTipsCard tips={tips} />

      {institution.websiteUrl ? (
        <ListSection>
          <ListCell
            icon={Globe}
            label="出发前看官网"
            meta={hostname(institution.websiteUrl)}
            tone="tint"
            role="link"
            accessibilityHint="在浏览器中打开"
            onPress={() => void Linking.openURL(institution.websiteUrl!)}
            last
          />
        </ListSection>
      ) : null}
    </View>
  );
}

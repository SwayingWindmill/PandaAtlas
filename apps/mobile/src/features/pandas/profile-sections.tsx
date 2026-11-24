import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";
import { useCSSVariable } from "uniwind";

import { Chevron, useStacked } from "@/components/grouped-list";
import { Icon } from "@/components/icon";
import {
  BookOpen,
  Calendar,
  ChevronDown,
  ChevronRight,
  Clock,
  Columns,
  ExternalLink,
  House,
  IdCard,
  type LucideIcon,
  Mars,
  Network,
  Newspaper,
  Plane,
  Ruler,
  ScanFace,
  Sparkles,
  Venus,
} from "@/components/icons";
import { PandaThumb } from "@/components/panda-thumb";
import { PhotoOutline } from "@/components/photo-outline";
import { PressScale } from "@/components/press-scale";
import { RemoteImage } from "@/components/remote-image";
import { Timeline } from "@/components/timeline";
import { Text } from "@/components/ui/text";
import { relativesOf } from "@/features/family/family";
import { entryBySlug, learningText } from "@/features/learning/catalog";
import { useLearningCatalog } from "@/features/learning/use-catalog";
import { openPanda } from "@/features/pandas/panda-row";
import { pandaIndexQueryOptions } from "@/features/pandas/pandas";
import { type Profile, longDate } from "@/features/pandas/profile";
import { openPandaCorrection } from "@/features/pandas/profile-overview";
import type { HighlightIcon, LifeStageInfo, ProfileHighlight } from "@/features/pandas/rich-facts";
import { sameCohortPandas } from "@/features/pandas/same-cohort";
import { loadVenueNews } from "@/features/venue-news/venue-news";
import { usePandaCover } from "@/lib/covers";
import { nameInitial } from "@/lib/panda";
import { HAIRLINE, PAGE_COLUMN, RADIUS } from "@/lib/surface";
import { cn } from "@/lib/utils";

const INITIAL_SOURCES_SHOWN = 5;
const STAGE_LABELS = ["幼崽", "亚成体", "成年", "老年"] as const;
const STAGE_WEIGHTS = [0.9, 1.1, 1.7, 1.1] as const;

const HIGHLIGHT_ICONS: Record<HighlightIcon, LucideIcon> = {
  house: House,
  sparkles: Sparkles,
  ruler: Ruler,
  clock: Clock,
  calendar: Calendar,
};

function SectionHeaderLink({
  title,
  actionLabel,
  accessibilityLabel,
  onPress,
}: {
  title: string;
  actionLabel: string;
  accessibilityLabel: string;
  onPress: () => void;
}) {
  return (
    <View className="flex-row items-baseline justify-between gap-3">
      <Text variant="headline" role="heading" className="min-w-0 shrink font-bold">
        {title}
      </Text>
      <Pressable
        role="link"
        accessibilityLabel={accessibilityLabel}
        hitSlop={12}
        onPress={onPress}
        className="flex-row items-center gap-0.5 active:opacity-60"
      >
        <Text variant="footnote" className="font-semibold text-primary">
          {actionLabel}
        </Text>
        <Icon icon={ChevronRight} size={13} tone="tint" strokeWidth={2.2} />
      </Pressable>
    </View>
  );
}

/** Smooth top gradient + compact horizontal initial monogram header for pandas without published photos. */
export function NoPhotoIdentityHeader({
  profile,
  adoptionName,
  leadBio,
}: {
  profile: Profile;
  adoptionName: string | null;
  leadBio: string | null;
}) {
  const insets = useSafeAreaInsets();
  const [tint, ground] = useCSSVariable(["--color-highlight-soft", "--color-background"]);
  const sexIcon = profile.sex === "male" ? Mars : profile.sex === "female" ? Venus : null;
  const sexSpoken = profile.sex === "male" ? "，雄性" : profile.sex === "female" ? "，雌性" : "";

  return (
    <View>
      <View aria-hidden style={{ position: "absolute", top: 0, left: 0, right: 0, height: insets.top + 112 }}>
        <Svg style={StyleSheet.absoluteFill} width="100%" height="100%" preserveAspectRatio="none">
          <Defs>
            <LinearGradient id={`panda-plate-${profile.id}`} x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={String(tint)} stopOpacity={1} />
              <Stop offset="0.65" stopColor={String(tint)} stopOpacity={0.35} />
              <Stop offset="1" stopColor={String(ground)} stopOpacity={1} />
            </LinearGradient>
          </Defs>
          <Rect x="0" y="0" width="100%" height="100%" fill={`url(#panda-plate-${profile.id})`} />
        </Svg>
      </View>
      <View className="gap-2.5 px-gutter" style={[PAGE_COLUMN, { paddingTop: insets.top + 58 }]}>
        <View className="flex-row items-center gap-3.5">
          <View
            accessible={false}
            aria-hidden
            importantForAccessibility="no-hide-descendants"
            className="items-center justify-center border-hairline border-border bg-card"
            style={{ width: 60, height: 60, borderRadius: 18, borderCurve: "continuous" }}
          >
            <Text variant="title" allowFontScaling={false} className="font-bold">
              {nameInitial(profile.name)}
            </Text>
          </View>
          <View className="min-w-0 flex-1">
            <View className="flex-row items-baseline justify-between gap-2">
              <Text variant="display" role="heading" className="min-w-0 shrink">
                {profile.name}
              </Text>
              {adoptionName ? (
                <Text variant="footnote" className="shrink-0 font-semibold text-primary">
                  {`认养名　${adoptionName}`}
                </Text>
              ) : null}
            </View>
            {profile.nameEn || sexIcon ? (
              <View className="flex-row items-center gap-1.5" accessible accessibilityLabel={`${profile.nameEn ?? ""}${sexSpoken}`}>
                {profile.nameEn ? (
                  <Text variant="subheadline" className="min-w-0 shrink text-muted-foreground" numberOfLines={2}>
                    {profile.nameEn}
                  </Text>
                ) : null}
                {sexIcon ? <Icon icon={sexIcon} size="footnote" tone="secondary" strokeWidth={2.4} /> : null}
              </View>
            ) : null}
          </View>
        </View>
        {leadBio ? (
          <Text variant="subheadline" className="text-muted-foreground">
            {leadBio}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

/** Borderless 3-column strip (`生日 | 现居 | 谱系号`) with calm muted dashes for unrecorded cells. */
export function UnifiedMetricStrip({ profile }: { profile: Profile }) {
  const stacked = useStacked();
  const visit = !profile.deceased ? profile.visit : null;

  return (
    <View className={cn("border-t-hairline border-b-hairline border-border py-0.5", stacked ? "gap-1 py-1.5" : "flex-row items-stretch")}>
      {profile.metrics.map((metric, index) => {
        const onPress =
          metric.key === "place" && metric.link && visit
            ? () => router.push({ pathname: "/institutions/[slug]", params: { slug: visit.institutionSlug } })
            : metric.key === "studbook" && metric.link
              ? () => router.push({ pathname: "/learn/terms/[slug]", params: { slug: "studbook" } })
              : undefined;

        const isPrimaryLink = metric.key === "place" && metric.link && Boolean(visit);
        const content = (
          <View
            className={cn(
              stacked ? "flex-row items-center justify-between gap-3 py-1.5" : "min-w-0 flex-1 items-center justify-center px-1.5 py-2",
            )}
          >
            <Text variant="footnote" className="font-medium text-muted-foreground" numberOfLines={1}>
              {metric.label}
            </Text>
            <View className={cn("min-w-0 w-full", stacked ? "items-end" : "mt-0.5 items-center overflow-hidden")}>
              <View className="min-w-0 max-w-full flex-row items-center justify-center gap-0.5 overflow-hidden">
                <Text
                  variant="headline"
                  className={cn(
                    "min-w-0 shrink font-bold tabular-nums",
                    metric.muted ? "text-tertiary-foreground" : isPrimaryLink ? "text-primary" : undefined,
                  )}
                  numberOfLines={stacked ? undefined : 1}
                >
                  {metric.value}
                </Text>
                {onPress ? (
                  <Icon
                    icon={ChevronRight}
                    size={12}
                    tone={isPrimaryLink ? "tint" : "secondary"}
                    strokeWidth={2.2}
                  />
                ) : null}
              </View>
              {metric.sub ? (
                <Text
                  variant="footnote"
                  className={cn("min-w-0 max-w-full text-muted-foreground", !stacked && "text-center")}
                  numberOfLines={stacked ? undefined : 1}
                >
                  {metric.sub}
                </Text>
              ) : null}
            </View>
          </View>
        );

        return (
          <View key={metric.key} className={cn(stacked ? undefined : "min-w-0 flex-1 flex-row items-stretch")}>
            {!stacked && index > 0 ? <View className="my-2 w-hairline bg-border" /> : null}
            {onPress ? (
              <Pressable
                role="link"
                accessibilityLabel={metric.spoken}
                onPress={onPress}
                className="min-w-0 flex-1 active:opacity-60"
              >
                {content}
              </Pressable>
            ) : (
              <View className="min-w-0 flex-1" accessible accessibilityLabel={metric.spoken}>
                {content}
              </View>
            )}
          </View>
        );
      })}
    </View>
  );
}

/** Horizontal photo peek strip leading directly into the full zoomable gallery. */
export function PhotoPeekStrip({ profile }: { profile: Profile }) {
  if (profile.photos.length < 2) return null;
  const shown = profile.photos.slice(0, 8);
  return (
    <View className="gap-2.5">
      <SectionHeaderLink
        title="照片"
        actionLabel={`全部 ${profile.photos.length} 张`}
        accessibilityLabel={`全部 ${profile.photos.length} 张`}
        onPress={() => router.push({ pathname: "/pandas/[slug]/photos", params: { slug: profile.slug } })}
      />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} className="-mx-gutter" contentContainerClassName="gap-2.5 px-gutter">
        {shown.map((photo, index) => (
          <PressScale
            key={photo.id}
            role="link"
            accessibilityLabel={`照片 ${index + 1}`}
            onPress={() =>
              router.push({
                pathname: "/pandas/[slug]/photos",
                params: { slug: profile.slug, index: String(index) },
              })
            }
          >
            <View
              className="overflow-hidden bg-secondary"
              style={{ width: 142, height: 114, borderRadius: RADIUS.tile, borderCurve: "continuous" }}
            >
              <RemoteImage source={photo.url} style={{ width: 142, height: 114 }} contentFit="cover" accessible={false} />
              <PhotoOutline radius={RADIUS.tile} />
            </View>
          </PressScale>
        ))}
      </ScrollView>
    </View>
  );
}

/** Horizontal highlight cards from curated facts (enclosure, birth weight/time, twin rank, first-year weight). */
export function HighlightCarousel({ highlights }: { highlights: ProfileHighlight[] }) {
  if (highlights.length === 0) return null;
  return (
    <View className="gap-2">
      <Text variant="headline" role="heading" className="font-bold">
        小档案
      </Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} className="-mx-gutter" contentContainerClassName="gap-2.5 px-gutter">
        {highlights.map((item, index) => {
          const tint = index === 0;
          const Glyph = HIGHLIGHT_ICONS[item.icon];
          return (
            <View
              key={item.key}
              accessible
              accessibilityLabel={`${item.label}，${item.value}${item.note ? `，${item.note}` : ""}`}
              className={cn("justify-between gap-1.5 px-3.5 py-2.5", tint ? "bg-highlight-soft" : "bg-card")}
              style={{ minWidth: 134, maxWidth: 196, borderRadius: RADIUS.tile, borderCurve: "continuous" }}
            >
              <View className="flex-row items-center gap-1.5">
                <Icon icon={Glyph} size="footnote" tone={tint ? "tint" : "secondary"} strokeWidth={2.1} />
                <Text variant="footnote" className={cn("font-semibold", tint ? "text-primary" : "text-muted-foreground")} numberOfLines={1}>
                  {item.label}
                </Text>
              </View>
              <View>
                <Text variant="headline" className="font-bold tabular-nums" numberOfLines={1}>
                  {item.value}
                </Text>
                {item.note ? (
                  <Text variant="footnote" className={cn("mt-0.5", tint ? "text-primary" : "text-muted-foreground")} numberOfLines={1}>
                    {item.note}
                  </Text>
                ) : null}
              </View>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

/** Appearance feature pills + feeding/care notes when verified data is available. */
export function TraitsAndCareSection({
  name,
  traits,
}: {
  name: string;
  traits: Profile["rich"]["traits"];
}) {
  if (!traits) return null;
  return (
    <View className="gap-2">
      <View className="flex-row items-center gap-1.5">
        <Icon icon={ScanFace} size="subhead" tone="label" strokeWidth={1.9} />
        <Text variant="headline" role="heading" className="min-w-0 shrink font-bold">
          {`认出${name}`}
        </Text>
      </View>
      {traits.pills.length > 0 ? (
        <View className="flex-row flex-wrap gap-1.5">
          {traits.pills.map((pill) => (
            <View key={pill} className="rounded-pill bg-card px-3 py-1">
              <Text variant="footnote" className="font-semibold">
                {pill}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
      {traits.careNote ? (
        <Text variant="subheadline" className="text-muted-foreground">
          {traits.careNote}
        </Text>
      ) : null}
    </View>
  );
}

/** Four-stage growth bar + countdown to next birthday, placed mid-scroll away from the live venue bar. */
export function LifeStageSection({ stage }: { stage: LifeStageInfo | null }) {
  const ground = String(useCSSVariable("--color-background"));
  if (!stage) return null;

  return (
    <View className="gap-1.5" accessible accessibilityLabel={`成长阶段，${stage.stageLabel}，${stage.countdownText}`}>
      <View className="flex-row items-baseline justify-between gap-2">
        <Text variant="footnote" className="font-semibold">
          成长阶段
        </Text>
        <Text variant="footnote" className="font-semibold tabular-nums text-primary">
          {stage.countdownText}
        </Text>
      </View>
      <View className="justify-center" style={{ height: 12 }}>
        <View className="flex-row" style={{ gap: 3 }}>
          {STAGE_WEIGHTS.map((weight, index) => (
            <View
              key={STAGE_LABELS[index]}
              className={cn("rounded-pill", index <= stage.stageIndex ? "bg-graphic" : "bg-secondary")}
              style={{ flex: weight, height: 5 }}
            />
          ))}
        </View>
        <View
          className="absolute rounded-pill bg-primary"
          style={{
            left: `${stage.dotPercent}%`,
            marginLeft: -5.5,
            width: 11,
            height: 11,
            borderWidth: 2,
            borderColor: ground,
          }}
        />
      </View>
      <View className="flex-row justify-between gap-2">
        {STAGE_LABELS.map((label, index) => (
          <Text
            key={label}
            variant="footnote"
            className={index === stage.stageIndex ? "font-semibold" : "text-muted-foreground"}
            numberOfLines={1}
          >
            {label}
          </Text>
        ))}
      </View>
    </View>
  );
}

/** Dual-stop journey card or timeline summary with direct link to the full timeline screen. */
export function JourneyRouteSection({ profile }: { profile: Profile }) {
  const stacked = useStacked();
  const route = profile.rich.routeSummary;
  const fallbackEvents = [...profile.events]
    .reverse()
    .slice(0, 3)
    .map((event) => ({ key: event.id, date: event.date, meta: event.kind, title: event.text }));
  const hasPlaces = Boolean(route) || profile.placesLived.length > 0 || Boolean(profile.move);

  if (!hasPlaces && fallbackEvents.length === 0) return null;

  const title = hasPlaces ? "去过的地方" : "经历";
  const openTimeline = () => router.push({ pathname: "/pandas/[slug]/timeline", params: { slug: profile.slug } });

  return (
    <View className="gap-2">
      <SectionHeaderLink title={title} actionLabel="时间线" accessibilityLabel="时间线" onPress={openTimeline} />
      {route ? (
        <Pressable
          role="link"
          accessibilityLabel={`去过的地方，从${route.fromPlace}到${route.toPlace}，打开时间线`}
          onPress={openTimeline}
          className="gap-2 bg-card px-4 py-3 active:opacity-75"
          style={{ borderRadius: RADIUS.group, borderCurve: "continuous" }}
        >
          <View className={stacked ? "gap-2" : "flex-row items-center gap-2.5"}>
            <View className="min-w-0 flex-1">
              <Text variant="subheadline" className="font-bold" numberOfLines={stacked ? undefined : 1}>
                {route.fromPlace}
              </Text>
              <Text variant="footnote" className="tabular-nums text-muted-foreground" numberOfLines={1}>
                {route.fromYears}
              </Text>
            </View>
            {stacked ? null : (
              <View className="flex-row items-center gap-1.5" style={{ width: 58 }}>
                <View className="flex-1 bg-border" style={{ height: 1.5 }} />
                <Icon icon={Plane} size="footnote" tone="tint" strokeWidth={2} />
                <View className="flex-1 bg-border" style={{ height: 1.5 }} />
              </View>
            )}
            <View className={cn("min-w-0 flex-1", !stacked && "items-end")}>
              <Text
                variant="subheadline"
                className="font-bold text-primary"
                numberOfLines={stacked ? undefined : 1}
              >
                {route.toPlace}
              </Text>
              <Text variant="footnote" className="tabular-nums text-muted-foreground" numberOfLines={1}>
                {route.toYears}
              </Text>
            </View>
          </View>
          {route.note ? (
            <>
              <View className="bg-border" style={{ height: HAIRLINE }} />
              <Text variant="footnote" className="text-muted-foreground">
                {route.note}
              </Text>
            </>
          ) : null}
        </Pressable>
      ) : profile.move ? (
        <Pressable
          role="link"
          accessibilityLabel={`${profile.move.year} 年从${profile.move.from}到${profile.move.to}，打开时间线`}
          onPress={openTimeline}
          className="flex-row items-center justify-between gap-3 bg-card px-4 py-3 active:opacity-75"
          style={{ borderRadius: RADIUS.group, borderCurve: "continuous" }}
        >
          <View className="min-w-0 flex-1 flex-row items-center gap-2">
            <Icon icon={Plane} size="subhead" tone="label" />
            <Text variant="subheadline" className="min-w-0 flex-1 font-semibold" numberOfLines={2}>
              {`${profile.move.from} → ${profile.move.to}`}
            </Text>
          </View>
          <Text variant="footnote" className="shrink-0 tabular-nums text-muted-foreground">
            {profile.move.year}
          </Text>
        </Pressable>
      ) : profile.placesLived.length > 0 ? (
        <Pressable
          role="link"
          accessibilityLabel={`去过 ${profile.placesLived.map((p) => p.place).join("、")}，打开时间线`}
          onPress={openTimeline}
          className="gap-1.5 bg-card px-4 py-3 active:opacity-75"
          style={{ borderRadius: RADIUS.group, borderCurve: "continuous" }}
        >
          {profile.placesLived.slice(0, 3).map((stay, idx) => (
            <View key={`${stay.place}-${idx}`} className="flex-row items-baseline justify-between gap-3">
              <Text variant="subheadline" className={cn("min-w-0 flex-1 font-semibold", stay.current && "text-primary")} numberOfLines={2}>
                {stay.place}
              </Text>
              {stay.years ? (
                <Text variant="footnote" className="shrink-0 tabular-nums text-muted-foreground">
                  {stay.years}
                </Text>
              ) : null}
            </View>
          ))}
        </Pressable>
      ) : (
        <View className="bg-card px-4 py-3" style={{ borderRadius: RADIUS.group, borderCurve: "continuous" }}>
          <Timeline
            items={fallbackEvents.map((ev) => ({
              key: ev.key,
              date: ev.date,
              meta: ev.meta === "birth" ? "出生" : ev.meta === "home" ? "回国" : "动态",
              title: ev.title,
            }))}
          />
        </View>
      )}
    </View>
  );
}

function RelativePortrait({
  pandaId,
  name,
  photoUrl,
  width,
  height,
  rounded,
}: {
  pandaId: string | null;
  name: string;
  photoUrl: string | null;
  width: number;
  height: number;
  rounded: number;
}) {
  const cachedCover = usePandaCover(photoUrl || !pandaId ? undefined : pandaId);
  const uri = photoUrl ?? cachedCover ?? null;
  const fallback = (
    <Text variant="headline" allowFontScaling={false} className="font-bold text-muted-foreground">
      {nameInitial(name)}
    </Text>
  );
  return (
    <View
      className="overflow-hidden bg-secondary"
      style={{ width, height, borderRadius: rounded, borderCurve: "continuous" }}
      accessible={false}
      aria-hidden
      importantForAccessibility="no-hide-descendants"
    >
      <RemoteImage source={uri ? { uri } : undefined} fallback={fallback} style={{ width, height }} contentFit="cover" accessible={false} />
    </View>
  );
}

/** Relatives strip merging canonical family members with verified `local.*` relative records. */
export function FamilyStripSection({ profile }: { profile: Profile }) {
  const stacked = useStacked();
  const { data: index = [] } = useQuery(pandaIndexQueryOptions());

  const canonical = profile.family ? relativesOf(profile.family) : [];
  const combined: { id: string | null; slug: string | null; name: string; relation: string; photoUrl: string | null }[] =
    canonical.map((member) => ({
      id: member.id,
      slug: member.slug,
      name: member.name,
      relation: member.relation,
      photoUrl: member.photoUrl,
    }));

  const bySlug = new Map(index.map((item) => [item.slug, item]));
  const byName = new Map<string, (typeof index)[number]>();
  const seenNames = new Set<string>();
  for (const item of index) {
    if (!seenNames.has(item.name)) {
      byName.set(item.name, item);
      seenNames.add(item.name);
    } else {
      byName.delete(item.name);
    }
  }

  for (const extra of profile.rich.extraRelatives) {
    const matched = (extra.slug ? bySlug.get(extra.slug) : undefined) ?? byName.get(extra.name);
    const resolvedSlug = matched?.slug ?? extra.slug;
    const resolvedId = matched?.id ?? null;
    if (combined.some((m) => (resolvedSlug && m.slug === resolvedSlug) || m.name === extra.name)) continue;
    combined.push({
      id: resolvedId,
      slug: resolvedSlug,
      name: extra.name,
      relation: extra.relation,
      photoUrl: null,
    });
  }

  if (combined.length === 0) return null;

  const openTree = () => router.push({ pathname: "/pandas/[slug]/family", params: { slug: profile.slug } });

  return (
    <View className="gap-2">
      <SectionHeaderLink title="家人" actionLabel="家族树" accessibilityLabel="家族树" onPress={openTree} />
      {combined.length <= 2 ? (
        <View className={stacked ? "gap-2" : "flex-row gap-2.5"}>
          {combined.map((member) => {
            const spoken = `${member.relation}，${member.name}`;
            const body = (
              <View
                className="min-w-0 flex-1 flex-row items-center gap-2.5 bg-card px-3 py-2"
                style={{ borderRadius: RADIUS.tile, borderCurve: "continuous" }}
              >
                {member.id ? (
                  <PandaThumb pandaId={member.id} name={member.name} photoUrl={member.photoUrl} size={38} shape="round" />
                ) : (
                  <RelativePortrait pandaId={null} name={member.name} photoUrl={null} width={38} height={38} rounded={19} />
                )}
                <View className="min-w-0 flex-1">
                  <Text variant="subheadline" className="font-bold" numberOfLines={stacked ? undefined : 1}>
                    {member.name}
                  </Text>
                  <Text variant="footnote" className="text-muted-foreground" numberOfLines={1}>
                    {member.relation}
                  </Text>
                </View>
                {member.slug ? <Chevron /> : null}
              </View>
            );
            return member.slug ? (
              <Pressable
                key={`${member.relation}-${member.name}`}
                role="link"
                accessibilityLabel={spoken}
                onPress={() => openPanda(member.slug!)}
                className="min-w-0 flex-1 active:opacity-75"
              >
                {body}
              </Pressable>
            ) : (
              <View key={`${member.relation}-${member.name}`} className="min-w-0 flex-1" accessible accessibilityLabel={spoken}>
                {body}
              </View>
            );
          })}
        </View>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="-mx-gutter" contentContainerClassName="gap-2.5 px-gutter">
          {combined.slice(0, 12).map((member) => {
            const spoken = `${member.relation}，${member.name}`;
            const card = (
              <View
                className="overflow-hidden bg-card"
                style={{ width: 92, borderRadius: RADIUS.tile, borderCurve: "continuous" }}
              >
                <RelativePortrait
                  pandaId={member.id}
                  name={member.name}
                  photoUrl={member.photoUrl}
                  width={92}
                  height={66}
                  rounded={0}
                />
                <View className="px-2 py-1.5">
                  <Text variant="footnote" className="font-bold" numberOfLines={1}>
                    {member.name}
                  </Text>
                  <Text variant="footnote" className="text-muted-foreground" numberOfLines={1}>
                    {member.relation}
                  </Text>
                </View>
              </View>
            );
            return member.slug ? (
              <PressScale key={`${member.relation}-${member.name}`} role="link" accessibilityLabel={spoken} onPress={() => openPanda(member.slug!)}>
                {card}
              </PressScale>
            ) : (
              <View key={`${member.relation}-${member.name}`} accessible accessibilityLabel={spoken}>
                {card}
              </View>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

/** Compact 3-button tool strip (`名片卡`, `查关系`, `比一比`). */
export function QuickToolsBar({ slug, name }: { slug: string; name: string }) {
  const stacked = useStacked();
  const tools = [
    {
      key: "card",
      label: "名片卡",
      spoken: `生成${name}的名片卡`,
      icon: IdCard,
      onPress: () => router.push({ pathname: "/pandas/[slug]/share", params: { slug } }),
    },
    {
      key: "rel",
      label: "查关系",
      spoken: `查询${name}的亲缘关系`,
      icon: Network,
      onPress: () => router.push({ pathname: "/relationship", params: { from: slug } }),
    },
    {
      key: "cmp",
      label: "比一比",
      spoken: `和别的熊猫比一比${name}`,
      icon: Columns,
      onPress: () => router.push({ pathname: "/compare", params: { a: slug } }),
    },
  ] as const;

  return (
    <View className={cn("flex-row gap-2", stacked && "flex-wrap")}>
      {tools.map((tool) => (
        <PressScale
          key={tool.key}
          role="button"
          accessibilityLabel={tool.spoken}
          onPress={tool.onPress}
          containerStyle={stacked ? { minWidth: "46%", flexGrow: 1 } : { flex: 1, minWidth: 0 }}
        >
          <View
            className="min-h-11 flex-row items-center justify-center gap-1.5 bg-card px-2.5"
            style={{ borderRadius: RADIUS.control, borderCurve: "continuous" }}
          >
            <Icon icon={tool.icon} size="footnote" tone="tint" strokeWidth={2} />
            <Text variant="footnote" className="font-semibold" numberOfLines={1}>
              {tool.label}
            </Text>
          </View>
        </PressScale>
      ))}
    </View>
  );
}

/** Same-year cohort row of living peers. */
export function SameCohortSection({ profile }: { profile: Profile }) {
  const stacked = useStacked();
  const { data: index } = useQuery(pandaIndexQueryOptions());
  const cohort = index ? sameCohortPandas(profile, index, 4) : null;
  if (!cohort) return null;

  return (
    <View className="gap-2">
      <View className="flex-row items-baseline justify-between gap-2">
        <Text variant="headline" role="heading" className="font-bold">
          同年生
        </Text>
        <Text variant="footnote" className="text-muted-foreground">
          {cohort.label}
        </Text>
      </View>
      <View className={cn("flex-row gap-2", stacked && "flex-wrap")}>
        {cohort.items.map(({ panda, dateLabel }) => (
          <PressScale
            key={panda.id}
            role="link"
            accessibilityLabel={`同年生，${panda.name}，${dateLabel}`}
            onPress={() => openPanda(panda.slug)}
            containerStyle={stacked ? { minWidth: "46%", flexGrow: 1 } : { flex: 1, minWidth: 0 }}
            className="w-full min-w-0 items-center gap-1 overflow-hidden"
          >
            <PandaThumb pandaId={panda.id} name={panda.name} size={48} shape="round" />
            <Text variant="footnote" className="w-full text-center font-semibold" numberOfLines={1}>
              {panda.name}
            </Text>
            <Text variant="footnote" className="w-full text-center tabular-nums text-muted-foreground" numberOfLines={1}>
              {dateLabel}
            </Text>
          </PressScale>
        ))}
      </View>
    </View>
  );
}

/** Official venue announcements mentioning this panda, shown when present. */
export function PandaVenueNewsCard({ slug }: { slug: string }) {
  const { data: items } = useQuery({
    queryKey: ["public", "venue-news", "all"],
    queryFn: () => loadVenueNews(),
    staleTime: 300_000,
  });
  const matching = (items ?? []).filter((item) => item.pandaSlugs.includes(slug)).slice(0, 2);
  if (matching.length === 0) return null;

  return (
    <View className="gap-2">
      {matching.map((item) => (
        <PressScale
          key={item.id}
          role="link"
          accessibilityLabel={`场馆动态，${item.headline}，${item.sourcePublisher}`}
          accessibilityHint="在浏览器中打开"
          onPress={() => void WebBrowser.openBrowserAsync(item.sourceUrl)}
        >
          <View
            className="flex-row items-center gap-2.5 bg-card px-3.5 py-2.5"
            style={{ borderRadius: RADIUS.tile, borderCurve: "continuous" }}
          >
            <Icon icon={Newspaper} size="footnote" tone="tint" strokeWidth={2} />
            <View className="min-w-0 flex-1">
              <Text variant="subheadline" className="font-semibold" numberOfLines={2}>
                {item.headline}
              </Text>
              <Text variant="footnote" className="text-muted-foreground" numberOfLines={1}>
                {`${item.sourcePublisher}　${item.publishedOn}`}
              </Text>
            </View>
            <Icon icon={ExternalLink} size="footnote" tone="tertiary" strokeWidth={2} />
          </View>
        </PressScale>
      ))}
    </View>
  );
}

/** One related science/learning article matched cleanly to the panda's traits or age stage. */
export function RecommendedArticleCard({ articleSlug }: { articleSlug: string }) {
  const { state } = useLearningCatalog();
  if (state.status !== "ready") return null;

  const article = entryBySlug(state.catalog.articles, articleSlug) ?? state.catalog.articles[0];
  if (!article) return null;

  const title = learningText(article.title);
  return (
    <PressScale
      role="link"
      accessibilityLabel={`科普延伸阅读，${title}`}
      onPress={() => router.push({ pathname: "/learn/articles/[slug]", params: { slug: article.slug } })}
    >
      <View
        className="flex-row items-center gap-2.5 bg-card px-3.5 py-2.5"
        style={{ borderRadius: RADIUS.tile, borderCurve: "continuous" }}
      >
        <Icon icon={BookOpen} size="subhead" tone="tint" strokeWidth={1.9} />
        <View className="min-w-0 flex-1">
          <Text variant="subheadline" className="font-semibold" numberOfLines={1}>
            {title}
          </Text>
          <Text variant="footnote" className="text-muted-foreground" numberOfLines={1}>
            {`${article.category}　科普延伸阅读`}
          </Text>
        </View>
        <Chevron />
      </View>
    </PressScale>
  );
}

/** Collapsible footer sources + low-key correction prompt + optional photo credit. */
export function QuietProfileFooter({ profile }: { profile: Profile }) {
  const [expanded, setExpanded] = useState(false);
  const [showAll, setShowAll] = useState(false);

  const sources = profile.sources;
  const shown = showAll ? sources : sources.slice(0, INITIAL_SOURCES_SHOWN);
  const hiddenCount = sources.length - shown.length;
  const coverCredit = profile.photos[0]?.credit;

  return (
    <View className="mt-1 gap-1 border-t-hairline border-border pt-2">
      {sources.length > 0 ? (
        <View>
          <Pressable
            role="button"
            accessibilityLabel={`资料来源，${sources.length} 处`}
            accessibilityState={{ expanded }}
            onPress={() => setExpanded((prev) => !prev)}
            className="min-h-11 flex-row items-center justify-between gap-2 active:opacity-60"
          >
            <Text variant="footnote" className="font-semibold text-muted-foreground">
              资料来源
            </Text>
            <View className="flex-row items-center gap-1">
              <Text variant="footnote" className="tabular-nums text-muted-foreground">
                {`${sources.length} 处`}
              </Text>
              <Icon icon={expanded ? ChevronDown : ChevronRight} size={14} tone="tertiary" strokeWidth={2.2} />
            </View>
          </Pressable>
          {expanded ? (
            <View className="pb-1">
              {shown.map((source) => (
                <Pressable
                  key={source.id}
                  role="link"
                  accessibilityLabel={`${source.publisher}，${source.title}，核实于 ${longDate(source.lastVerifiedOn)}`}
                  accessibilityHint="在浏览器中打开"
                  onPress={() => void WebBrowser.openBrowserAsync(source.url)}
                  className="min-h-11 flex-row items-center justify-between gap-3 border-t-hairline border-border py-2 active:opacity-60"
                >
                  <View className="min-w-0 flex-1">
                    <Text variant="footnote" className="font-semibold" numberOfLines={2}>
                      {source.title}
                    </Text>
                    <Text variant="footnote" className="text-muted-foreground" numberOfLines={1}>
                      {`${source.publisher}　${longDate(source.lastVerifiedOn)}`}
                    </Text>
                  </View>
                  <Icon icon={ExternalLink} size={13} tone="tertiary" strokeWidth={2} />
                </Pressable>
              ))}
              {hiddenCount > 0 ? (
                <Pressable
                  role="button"
                  onPress={() => setShowAll(true)}
                  className="min-h-11 justify-center border-t-hairline border-border active:opacity-60"
                >
                  <Text variant="footnote" className="font-semibold text-primary">
                    {`显示全部 ${sources.length} 条`}
                  </Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}
        </View>
      ) : null}

      <Pressable
        role="button"
        accessibilityLabel="信息有遗漏？帮我们补充"
        onPress={() => openPandaCorrection(profile.slug)}
        className="min-h-11 flex-row items-center justify-between gap-2 active:opacity-60"
      >
        <Text variant="footnote" className="text-muted-foreground">
          信息有遗漏？
        </Text>
        <View className="flex-row items-center gap-0.5">
          <Text variant="footnote" className="font-medium text-muted-foreground">
            帮我们补充
          </Text>
          <Icon icon={ChevronRight} size={12} tone="tertiary" strokeWidth={2.1} />
        </View>
      </Pressable>

      {coverCredit ? (
        <Text variant="footnote" className="text-muted-foreground">
          {`封面照片：${coverCredit}`}
        </Text>
      ) : null}
    </View>
  );
}

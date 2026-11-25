import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "expo-router";
import { useState } from "react";
import { Linking, Pressable, StyleSheet, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";
import { useCSSVariable } from "uniwind";

import { Chevron, ListCell, ListSection, SectionTitle, useSingleColumn, useStacked } from "@/components/grouped-list";
import { Icon } from "@/components/icon";
import { Globe, Heart, History, MapPinCheck, Navigation, PawPrint, Video, Check } from "@/components/icons";
import { PandaThumb } from "@/components/panda-thumb";
import { PhotoOutline } from "@/components/photo-outline";
import { PressScale } from "@/components/press-scale";
import { RemoteImage } from "@/components/remote-image";
import { ScreenState } from "@/components/screen-state";
import { Scrim } from "@/components/scrim";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { semantic } from "@/design/tokens";
import { useFollowVenue } from "@/features/engagement/followed-venues";
import { guestVisitsQueryOptions, recordGuestVisit } from "@/features/engagement/guest-store";
import { localToday } from "@/features/engagement/seen";
import { openFacilityNavigation } from "@/features/institutions/institution-guide";
import {
  type FormerResident,
  type InstitutionDetail,
} from "@/features/institutions/institutions";
import {
  type ResidentFilter,
  filterResidents,
  splitResidentsByCover,
} from "@/features/institutions/resident-filter";
import { buildVenueMetrics } from "@/features/institutions/venue-guide-extras";
import { openPanda } from "@/features/pandas/panda-row";
import type { PandaListItem } from "@/features/pandas/pandas";
import { SearchField } from "@/features/pandas/search-field";
import { useSession } from "@/features/session/session";
import { resolveVenueLiveCamUrl } from "@/features/viewing/venue-live";
import { type Visit, lastVisitByPlace, recordVisit, sortVisits, visitsQueryKey, visitsQueryOptions } from "@/features/visits/visits";
import { usePandaCover } from "@/lib/covers";
import { successHaptic } from "@/lib/haptics";
import { PAGE_COLUMN, RADIUS, pageColumn } from "@/lib/surface";
import { useIOSColors } from "@/lib/theme";
import { useRefetchOnFocus } from "@/lib/use-focus-refetch";
import { cn } from "@/lib/utils";

/** Hero height below the status bar, balanced so dual action capsules + metrics sit cleanly on screen 1. */
export const INSTITUTION_HERO_HEIGHT = 276;
const PLACEHOLDER = semantic.color.light.mediaPlaceholder;
const GAP = semantic.spacing.row.value;
const PREVIEW_RESIDENTS = 6;
const PREVIEW_FORMER = 6;
const PROGRESS_FACES = 3;
const STACKED_FACE = 24;

export function HeroTitle({ institution }: { institution: InstitutionDetail }) {
  return (
    <View pointerEvents="none" className="absolute right-0 bottom-0 left-0">
      <View className="gap-1 px-gutter pb-4" style={PAGE_COLUMN}>
        <Text variant="display" className="text-on-media" numberOfLines={3}>
          {institution.name}
        </Text>
        {institution.meta ? (
          <Text variant="footnote" className="font-semibold text-on-media/85">
            {institution.meta}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

/** Smooth top gradient placeholder while cover availability resolves or when a venue has no cleared photo. */
export function PlateHero({ institution, pending }: { institution: InstitutionDetail; pending: boolean }) {
  const insets = useSafeAreaInsets();
  const [tint, ground] = useCSSVariable(["--color-highlight-soft", "--color-background"]);
  return (
    <View style={{ height: INSTITUTION_HERO_HEIGHT + insets.top }}>
      <Svg aria-hidden style={StyleSheet.absoluteFill} width="100%" height="100%" preserveAspectRatio="none">
        <Defs>
          <LinearGradient id="institution-plate" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={String(tint)} stopOpacity={1} />
            <Stop offset="0.55" stopColor={String(tint)} stopOpacity={0.6} />
            <Stop offset="1" stopColor={String(ground)} stopOpacity={1} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#institution-plate)" />
      </Svg>
      {pending ? null : (
        <View className="absolute right-0 bottom-0 left-0">
          <View className="gap-hair-gap px-gutter pb-4" style={PAGE_COLUMN}>
            <Text variant="display" numberOfLines={3}>
              {institution.name}
            </Text>
            {institution.meta ? (
              <Text variant="footnote" className="font-semibold text-muted-foreground">
                {institution.meta}
              </Text>
            ) : null}
          </View>
        </View>
      )}
    </View>
  );
}

/** Primary action pair under the summary: 关注场馆 (filled ink) and 去过打卡 (neutral card capsule). */
export function VenueActionPair({
  institution,
  onScrollToVisits,
}: {
  institution: InstitutionDetail;
  onScrollToVisits?: () => void;
}) {
  const stacked = useStacked();
  const { following, toggle } = useFollowVenue(institution.slug);
  const { state: session } = useSession();
  const queryClient = useQueryClient();
  const [savingVisit, setSavingVisit] = useState(false);

  const signedIn = session.status === "signedIn";
  const signedOut = session.status === "signedOut";
  const accountId = signedIn ? session.accountId : "";
  const singleFacility = institution.facilities.length === 1 ? institution.facilities[0] : undefined;

  const remoteVisits = useQuery({ ...visitsQueryOptions(accountId), enabled: signedIn && Boolean(singleFacility) });
  const guestVisits = useQuery({ ...guestVisitsQueryOptions(), enabled: signedOut && Boolean(singleFacility) });
  useRefetchOnFocus(remoteVisits.refetch, signedIn && Boolean(singleFacility));

  const visits = (signedOut ? guestVisits.data : remoteVisits.data) ?? [];
  const today = localToday();
  const lastDay = singleFacility ? lastVisitByPlace(visits).get(singleFacility.id) : undefined;
  const visitedToday = Boolean(singleFacility && lastDay === today);

  async function recordSingleVisit() {
    if (!singleFacility || savingVisit || visitedToday || (!signedIn && !signedOut)) return;
    setSavingVisit(true);
    try {
      if (signedOut) {
        await recordGuestVisit(singleFacility.id, today);
      } else if (signedIn) {
        const visit = await recordVisit(singleFacility.id, today);
        const key = visitsQueryKey(accountId);
        await queryClient.cancelQueries({ queryKey: key });
        queryClient.setQueryData<Visit[]>(key, (current) => sortVisits([visit, ...(current ?? [])]));
      }
      successHaptic();
    } catch {
      onScrollToVisits?.();
    } finally {
      setSavingVisit(false);
    }
  }

  return (
    <View className={cn("gap-2.5", stacked ? "flex-col" : "flex-row items-center")}>
      <Button
        variant={following ? "secondary" : "default"}
        className={cn("px-5", !stacked && "flex-1")}
        accessibilityLabel={following ? `已关注${institution.name}，点按取消` : `关注${institution.name}`}
        onPress={toggle}
      >
        <Icon icon={Heart} size="subhead" tone={following ? "label" : "onButton"} strokeWidth={2} />
        <Text className="text-body font-semibold" numberOfLines={1}>
          {following ? "已关注场馆" : "关注场馆"}
        </Text>
      </Button>
      {institution.facilities.length > 0 ? (
        <Button
          variant="secondary"
          className={cn("border-hairline border-border bg-card px-4", !stacked && "flex-1")}
          disabled={singleFacility ? visitedToday || savingVisit || (!signedIn && !signedOut) : false}
          accessibilityLabel={
            singleFacility
              ? visitedToday
                ? `今天已打卡${singleFacility.name}`
                : `去过打卡，${singleFacility.name}`
              : `查看${institution.name}到访记录`
          }
          onPress={() => {
            if (singleFacility) void recordSingleVisit();
            else onScrollToVisits?.();
          }}
        >
          <Icon icon={MapPinCheck} size="subhead" tone={visitedToday ? "tint" : "label"} strokeWidth={2} />
          <Text className={cn("text-body font-semibold", visitedToday && "text-primary")} numberOfLines={1}>
            {visitedToday ? "今天已打卡" : "去过打卡"}
          </Text>
        </Button>
      ) : null}
    </View>
  );
}

/** Borderless 3-column summary strip (`现在住这里 | 在这里出生 | 门票概况`) with calm dashes when missing. */
export function VenueMetricStrip({ institution }: { institution: InstitutionDetail }) {
  const stacked = useStacked();
  const metrics = buildVenueMetrics(institution);

  return (
    <View className={cn("border-t-hairline border-b-hairline border-border py-0.5", stacked ? "gap-1 py-1.5" : "flex-row items-stretch")}>
      {metrics.map((metric, index) => (
        <View key={metric.key} className={cn(stacked ? undefined : "min-w-0 flex-1 flex-row items-stretch")}>
          {!stacked && index > 0 ? <View className="my-2 w-hairline bg-border" /> : null}
          <View
            accessible
            accessibilityLabel={metric.spoken}
            className={cn(
              stacked ? "flex-row items-center justify-between gap-3 py-1.5" : "min-w-0 flex-1 items-center justify-center px-1.5 py-2",
            )}
          >
            <Text variant="footnote" className={cn("font-medium text-muted-foreground", stacked && "shrink-0")} numberOfLines={1}>
              {metric.label}
            </Text>
            <View className={cn("min-w-0 overflow-hidden", stacked ? "flex-1 items-end" : "mt-0.5 w-full items-center")}>
              <Text
                variant="headline"
                className={cn("min-w-0 shrink font-bold tabular-nums", metric.muted && "text-tertiary-foreground")}
                numberOfLines={stacked ? undefined : 1}
              >
                {metric.value}
              </Text>
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
        </View>
      ))}
    </View>
  );
}

/** Compact 2-to-3 tile utility row (`导航过去` | `官方直播` | `查看官网`). */
export function VenueQuickTools({
  institution,
  liveCardShown,
}: {
  institution: InstitutionDetail;
  liveCardShown: boolean;
}) {
  const stacked = useStacked();
  const primaryLocation = institution.facilities.find((facility) => facility.coordinates);
  const liveCamUrl = resolveVenueLiveCamUrl(institution.slug, institution.liveCamUrl);
  const websiteUrl = institution.websiteUrl;

  const tools = [
    primaryLocation?.coordinates
      ? {
          key: "nav",
          role: "button" as const,
          icon: Navigation,
          label: "导航过去",
          spoken: `导航过去，${primaryLocation.name}`,
          onPress: () => openFacilityNavigation(primaryLocation.name, primaryLocation.coordinates!),
        }
      : null,
    liveCamUrl
      ? {
          key: "live",
          role: "link" as const,
          icon: Video,
          label: "官方直播",
          // If the VenueLiveCard is absent for this venue, keep the primary "看官方直播" link label reachable here.
          spoken: liveCardShown ? `打开${institution.name}官方直播页` : "看官方直播",
          onPress: () => void Linking.openURL(liveCamUrl),
        }
      : null,
    websiteUrl
      ? {
          key: "web",
          role: "link" as const,
          icon: Globe,
          label: "查看官网",
          spoken: `打开${institution.name}官方网站`,
          onPress: () => void Linking.openURL(websiteUrl),
        }
      : null,
  ].filter((tool) => tool !== null);

  if (tools.length === 0) return null;

  return (
    <View className={stacked ? "gap-2" : "flex-row gap-2"}>
      {tools.map((tool) => (
        <Pressable
          key={tool.key}
          role={tool.role}
          accessibilityLabel={tool.spoken}
          onPress={tool.onPress}
          className={cn(
            "min-h-11 flex-row items-center justify-center gap-1.5 rounded-control border-hairline border-border bg-card px-3 py-2.5 active:opacity-75",
            !stacked && "min-w-0 flex-1",
          )}
          style={{ borderCurve: "continuous" }}
        >
          <Icon icon={tool.icon} size="footnote" tone="tint" strokeWidth={2} />
          <Text variant="footnote" className="font-semibold" numberOfLines={1}>
            {tool.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

function VenueCollectionProgressCard({
  pandas,
  seen,
}: {
  pandas: PandaListItem[];
  seen: ReadonlySet<string>;
}) {
  const colors = useIOSColors();
  const seenCount = pandas.filter((panda) => seen.has(panda.id)).length;
  const unseen = pandas.filter((panda) => !seen.has(panda.id));
  const pct = Math.round((seenCount / Math.max(pandas.length, 1)) * 100);
  const previewFaces = (unseen.length > 0 ? unseen : pandas).slice(0, PROGRESS_FACES);

  return (
    <View
      className="gap-2 border-hairline border-border bg-card px-4 py-3"
      style={{ borderRadius: RADIUS.group, borderCurve: "continuous" }}
    >
      <View className="flex-row items-baseline justify-between gap-2">
        <Text variant="headline" className="min-w-0 flex-1 tabular-nums" numberOfLines={1}>
          {`你在本馆已见过 ${seenCount} / ${pandas.length} 只`}
        </Text>
        <Text variant="footnote" className="font-semibold text-primary tabular-nums">
          {`${pct}%`}
        </Text>
      </View>
      <View className="h-1.5 overflow-hidden rounded-pill bg-secondary" aria-hidden>
        <View className="h-full rounded-pill bg-primary" style={{ width: `${pct}%` }} />
      </View>
      <View className="flex-row items-center gap-2 pt-0.5">
        <View className="flex-row items-center" accessible={false} importantForAccessibility="no-hide-descendants">
          {previewFaces.map((panda, index) => (
            <View
              key={panda.id}
              style={{
                marginLeft: index === 0 ? 0 : -6,
                borderWidth: 2,
                borderColor: colors.card,
                borderRadius: STACKED_FACE / 2 + 2,
              }}
            >
              <PandaThumb pandaId={panda.id} name={panda.name} size={STACKED_FACE} />
            </View>
          ))}
        </View>
        <Text variant="footnote" className="min-w-0 flex-1 text-muted-foreground" numberOfLines={1}>
          {unseen.length === 0
            ? "住在这里的你都见过了"
            : `还有 ${unseen.length} 只待相遇（含 ${unseen.slice(0, 2).map((p) => p.name).join("、")} 等）`}
        </Text>
      </View>
    </View>
  );
}

function ResidentTile({ panda, width, seen }: { panda: PandaListItem; width: number; seen: boolean }) {
  const photo = usePandaCover(panda.id);
  const height = Math.round((width * 5) / 4);
  const birthYear = panda.birthDate ? panda.birthDate.slice(0, 4) : null;
  return (
    <Link href={{ pathname: "/pandas/[slug]", params: { slug: panda.slug } }} asChild>
      <Link.AppleZoom>
        <PressScale
          role="link"
          accessibilityLabel={seen ? `${panda.name}，已见过` : panda.name}
          style={{ width, height }}
        >
          <View
            style={{ flex: 1, borderRadius: RADIUS.tile, borderCurve: "continuous", overflow: "hidden", backgroundColor: PLACEHOLDER }}
          >
            {photo ? (
              <RemoteImage
                source={photo}
                style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
                contentFit="cover"
                accessible={false}
                transition={200}
              />
            ) : null}
            <Scrim id={`resident-${panda.id}`} height="50%" />
            <View className="absolute right-0 bottom-0 left-0 gap-1 p-3">
              <Text variant="title" role="none" className="text-on-media" numberOfLines={2}>
                {panda.name}
              </Text>
              {birthYear || seen ? (
                <View className="flex-row flex-wrap items-center justify-between gap-x-2 gap-y-1">
                  {birthYear ? (
                    <Text
                      variant="footnote"
                      role="none"
                      className="min-w-0 shrink text-on-media/85 tabular-nums"
                      numberOfLines={1}
                    >
                      {`${birthYear} 年出生`}
                    </Text>
                  ) : (
                    <View />
                  )}
                  {seen ? (
                    <View className="flex-row items-center gap-1 rounded-pill bg-glass-fallback px-2 py-0.5">
                      <Icon icon={Check} size={11} tone="onMedia" strokeWidth={2.5} />
                      <Text variant="footnote" role="none" className="font-semibold text-on-media">
                        见过
                      </Text>
                    </View>
                  ) : null}
                </View>
              ) : null}
            </View>
            <PhotoOutline radius={RADIUS.tile} />
          </View>
        </PressScale>
      </Link.AppleZoom>
    </Link>
  );
}

/** Single-scroll resident showcase: personal progress, filter tabs, search, initial 6-item grid preview + expand all. */
export function Residents({
  pandas,
  seen = null,
  followed = null,
}: {
  pandas: PandaListItem[];
  seen?: ReadonlySet<string> | null;
  followed?: ReadonlySet<string> | null;
}) {
  const { width } = useWindowDimensions();
  const columns = useSingleColumn() ? 1 : 2;
  const tile = Math.floor((pageColumn(width) - GAP * (columns - 1)) / columns);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<ResidentFilter>("all");
  const [expanded, setExpanded] = useState(false);

  if (pandas.length === 0) return null;

  const filterPills: { key: ResidentFilter; label: string }[] = [
    { key: "all", label: `全部 ${pandas.length}` },
    ...(seen !== null
      ? [{ key: "unseen" as const, label: `未见过 ${pandas.filter((panda) => !seen.has(panda.id)).length}` }]
      : []),
    ...(followed !== null
      ? [{ key: "followed" as const, label: `我关注 ${pandas.filter((panda) => followed.has(panda.id)).length}` }]
      : []),
  ];

  const activeFilter = filterPills.some((pill) => pill.key === filter) ? filter : "all";
  const filtered = filterResidents(pandas, query, activeFilter, seen, followed);
  const isNarrowed = activeFilter !== "all" || query.trim().length > 0;
  const visible = expanded || isNarrowed ? filtered : filtered.slice(0, PREVIEW_RESIDENTS);
  const hiddenCount = filtered.length - visible.length;
  const { featured, compact } = splitResidentsByCover(visible);

  return (
    <View className="gap-3">
      <View className="flex-row items-baseline justify-between gap-row">
        <View className="flex-row items-baseline gap-2">
          <Text variant="title" role="heading">
            住在这里
          </Text>
          <Text variant="subheadline" className="text-muted-foreground tabular-nums">
            {`${pandas.length} 只`}
          </Text>
        </View>
        {!expanded && !isNarrowed && pandas.length > PREVIEW_RESIDENTS ? (
          <Pressable
            role="button"
            accessibilityLabel="看全部熊猫"
            onPress={() => setExpanded(true)}
            hitSlop={12}
            className="min-h-11 flex-row items-center gap-0.5 justify-end active:opacity-60"
          >
            <Text variant="subheadline" className="font-semibold text-primary">
              全部
            </Text>
            <Chevron />
          </Pressable>
        ) : null}
      </View>

      {seen !== null && pandas.length >= 2 ? (
        <VenueCollectionProgressCard pandas={pandas} seen={seen} />
      ) : null}

      {pandas.length >= 2 && filterPills.length > 1 ? (
        <View className="flex-row flex-wrap gap-2" accessibilityRole="tablist">
          {filterPills.map((pill) => {
            const selected = activeFilter === pill.key;
            return (
              <Pressable
                key={pill.key}
                role="tab"
                aria-selected={selected}
                accessibilityState={{ selected }}
                accessibilityLabel={pill.label}
                onPress={() => setFilter(pill.key)}
                className="-my-1 min-h-11 justify-center active:opacity-75"
              >
                <View
                  className={cn(
                    "items-center justify-center rounded-pill px-3 py-1.5",
                    selected ? "bg-foreground" : "bg-secondary",
                  )}
                  style={{ minHeight: 36 }}
                >
                  <Text
                    variant="subheadline"
                    className={cn("font-semibold tabular-nums", selected ? "text-background" : "text-foreground")}
                  >
                    {pill.label}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      ) : null}

      {pandas.length >= 4 ? (
        <SearchField
          value={query}
          onChange={setQuery}
          label="在馆内搜索熊猫"
          placeholder={`在 ${pandas.length} 只住客中搜名字…`}
        />
      ) : null}

      {expanded || isNarrowed ? (
        <Text variant="footnote" role="heading" className="px-1 text-muted-foreground tabular-nums">
          {isNarrowed ? `匹配 ${filtered.length} 只` : `住在这里的熊猫　${pandas.length} 只`}
        </Text>
      ) : null}

      {visible.length === 0 ? (
        <ScreenState message="没有找到符合条件的熊猫。" />
      ) : (
        <View className="gap-3">
          {featured.length > 0 ? (
            <View className="flex-row flex-wrap" style={{ gap: GAP }}>
              {featured.map((panda) => (
                <ResidentTile key={panda.id} panda={panda} width={tile} seen={Boolean(seen?.has(panda.id))} />
              ))}
            </View>
          ) : null}
          {compact.length > 0 ? (
            <ListSection>
              {compact.map((panda, index) => {
                const birthYear = panda.birthDate ? panda.birthDate.slice(0, 4) : null;
                const isSeen = Boolean(seen?.has(panda.id));
                return (
                  <ListCell
                    key={panda.id}
                    role="link"
                    leading={<PandaThumb pandaId={panda.id} name={panda.name} size={44} shape="round" />}
                    label={panda.name}
                    detail={birthYear ? `${birthYear} 年出生` : undefined}
                    meta={isSeen ? "见过" : undefined}
                    accessibilityLabel={`${panda.name}${birthYear ? `，${birthYear} 年出生` : ""}${isSeen ? "，已见过" : ""}`}
                    onPress={() => openPanda(panda.slug)}
                    last={index === compact.length - 1}
                  />
                );
              })}
            </ListSection>
          ) : null}
        </View>
      )}

      {!isNarrowed && hiddenCount > 0 ? (
        <Pressable
          role="button"
          accessibilityLabel={`展开其余 ${hiddenCount} 只住客`}
          onPress={() => setExpanded(true)}
          className="min-h-11 flex-row items-center justify-center gap-1 rounded-group border-hairline border-border bg-card px-4 py-2.5 active:opacity-75"
          style={{ borderCurve: "continuous" }}
        >
          <Text variant="subheadline" className="font-semibold text-primary tabular-nums">
            {`展开其余 ${hiddenCount} 只住客`}
          </Text>
          <Chevron />
        </Pressable>
      ) : !isNarrowed && expanded && pandas.length > PREVIEW_RESIDENTS ? (
        <Pressable
          role="button"
          accessibilityLabel="收起全部住客"
          onPress={() => setExpanded(false)}
          className="min-h-11 items-center justify-center rounded-group border-hairline border-border bg-card px-4 py-2.5 active:opacity-75"
          style={{ borderCurve: "continuous" }}
        >
          <Text variant="subheadline" className="font-semibold text-primary">
            收起部分住客
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function spanOf({ from, to }: FormerResident): string | undefined {
  if (from !== null && to !== null) return from === to ? `${from}` : `${from}–${to}`;
  if (to !== null) return `${to} 年离开`;
  return from !== null ? `${from} 年起` : undefined;
}

export function Former({ pandas }: { pandas: FormerResident[] }) {
  const [expanded, setExpanded] = useState(false);
  if (pandas.length === 0) return null;
  const shown = expanded ? pandas : pandas.slice(0, PREVIEW_FORMER);
  const restCount = pandas.length - shown.length;

  return (
    <View className="gap-stack-tight">
      <View className="flex-row items-baseline justify-between">
        <SectionTitle title={`以前住过　${pandas.length} 只`} icon={History} />
        {restCount > 0 ? (
          <Pressable
            role="button"
            accessibilityLabel={`查看全部 ${pandas.length} 只以前住过的熊猫`}
            onPress={() => setExpanded(true)}
            hitSlop={8}
            className="min-h-11 justify-end active:opacity-60"
          >
            <Text variant="footnote" className="font-semibold text-primary">
              {`展开全部 ${pandas.length} 只`}
            </Text>
          </Pressable>
        ) : null}
      </View>
      <ListSection>
        {shown.map((item, index) => (
          <ListCell
            key={item.panda.id}
            leading={<PandaThumb pandaId={item.panda.id} name={item.panda.name} size={36} shape="round" />}
            label={item.panda.name}
            detail={item.bornHere ? "在这里出生" : undefined}
            meta={spanOf(item)}
            onPress={() => openPanda(item.panda.slug)}
            last={index === shown.length - 1}
          />
        ))}
      </ListSection>
    </View>
  );
}

/** Quiet single-line caveat replacing internal audit dates and raw source link walls. */
export function VenueFooter({ institution }: { institution: InstitutionDetail }) {
  if (!institution.websiteUrl && institution.facilities.length === 0) return null;
  return (
    <View className="flex-row items-center justify-between gap-row border-t-hairline border-border pt-3">
      <Text variant="footnote" className="min-w-0 flex-1 text-muted-foreground">
        开放时间与票价以官方公布为准
      </Text>
      {institution.websiteUrl ? (
        <Pressable
          role="link"
          accessibilityLabel={`查看${institution.name}官网`}
          onPress={() => void Linking.openURL(institution.websiteUrl!)}
          hitSlop={8}
          className="min-h-11 shrink-0 flex-row items-center gap-0.5 active:opacity-60"
        >
          <Text variant="footnote" className="font-semibold text-primary">
            查看官网
          </Text>
          <Chevron />
        </Pressable>
      ) : null}
    </View>
  );
}

export { PawPrint };

import { Link } from "expo-router";
import { useState } from "react";
import { Linking, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";
import { useCSSVariable } from "uniwind";

import { ListCell, ListSection, SectionTitle, useSingleColumn } from "@/components/grouped-list";
import { Icon } from "@/components/icon";
import { IconRow } from "@/components/icon-row";
import { CalendarCheck, Check, Globe, History, MapPin, PawPrint, Ticket, Video } from "@/components/icons";
import { PandaThumb } from "@/components/panda-thumb";
import { PhotoOutline } from "@/components/photo-outline";
import { PressScale } from "@/components/press-scale";
import { RemoteImage } from "@/components/remote-image";
import { ScreenState } from "@/components/screen-state";
import { Scrim } from "@/components/scrim";
import { SourceBadge } from "@/components/source-badge";
import { StatTile } from "@/components/stat-tile";
import { Text } from "@/components/ui/text";
import { semantic } from "@/design/tokens";
import { useFollowVenue } from "@/features/engagement/followed-venues";
import { NavigateCell } from "@/features/institutions/institution-guide";
import {
  type FormerResident,
  type InstitutionDetail,
  addressOf,
  hostname,
  isFreeEntry,
} from "@/features/institutions/institutions";
import {
  type ResidentFilter,
  filterResidents,
  splitResidentsByCover,
} from "@/features/institutions/resident-filter";
import { openPanda } from "@/features/pandas/panda-row";
import type { PandaListItem } from "@/features/pandas/pandas";
import { longDate } from "@/features/pandas/profile";
import { SearchField } from "@/features/pandas/search-field";
import { VenueNewsSection } from "@/features/venue-news/venue-news-section";
import { resolveVenueLiveCamUrl } from "@/features/viewing/venue-live";
import { usePandaCover } from "@/lib/covers";
import { PAGE_COLUMN, pageColumn, RADIUS } from "@/lib/surface";
import { cn } from "@/lib/utils";

/** Hero height below the status bar, a little shorter than a panda's: the name sits on it. */
export const INSTITUTION_HERO_HEIGHT = 300;
/** Under a resident's photo while it loads, dark enough that the white name already reads. */
const PLACEHOLDER = semantic.color.light.mediaPlaceholder;
const GAP = semantic.spacing.row.value;
const FACE = 72;
/** A venue can house a hundred pandas; the strip previews a few and 全部 opens the rest. */
const FACE_LIMIT = 12;

export function HeroTitle({ institution }: { institution: InstitutionDetail }) {
  return (
    <View pointerEvents="none" className="absolute right-0 bottom-0 left-0">
      <View className="gap-1 px-4 pb-4" style={PAGE_COLUMN}>
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

/**
 * The top of a page with no curated photo: keeps the hero's height while covers are looked up
 * so a photo that then arrives replaces the plate without moving the content.
 */
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
          <View className="gap-hair-gap px-inset pb-inset" style={PAGE_COLUMN}>
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

function FollowButton({ slug, name }: { slug: string; name: string }) {
  const { following, toggle } = useFollowVenue(slug);
  return (
    <Pressable
      role="button"
      accessibilityLabel={following ? `已关注${name}，点按取消` : `关注${name}`}
      onPress={toggle}
      hitSlop={6}
      className={cn("items-center justify-center rounded-pill px-section active:opacity-80", following ? "bg-highlight-soft" : "bg-button")}
      style={{ height: 32 }}
    >
      <Text variant="subheadline" className={cn("font-semibold", following ? "text-primary" : "text-primary-foreground")}>
        {following ? "已关注" : "关注"}
      </Text>
    </Pressable>
  );
}

export function Badges({ institution }: { institution: InstitutionDetail }) {
  const count = institution.residents.length;
  const liveCamUrl = resolveVenueLiveCamUrl(institution.slug, institution.liveCamUrl);
  const infoBadges = [
    count > 0 ? { icon: PawPrint, label: `${count} 只`, spoken: `住着 ${count} 只熊猫` } : null,
    isFreeEntry(institution.facilities) ? { icon: Ticket, label: "免费", spoken: "免费参观" } : null,
  ].filter((badge) => badge !== null);
  return (
    <View className="flex-row items-center gap-stack-tight">
      <View className="min-w-0 flex-1 flex-row flex-wrap gap-stack-tight">
        {infoBadges.map((badge) => (
          <View
            key={badge.label}
            accessible
            accessibilityLabel={badge.spoken}
            className="flex-row items-center gap-hair-gap rounded-pill bg-secondary px-row"
            style={{ height: 32 }}
          >
            <Icon icon={badge.icon} size="footnote" tone="label" />
            <Text variant="subheadline" className="font-semibold">
              {badge.label}
            </Text>
          </View>
        ))}
        {liveCamUrl ? (
          <Pressable
            role="link"
            accessibilityLabel="看官方直播"
            accessibilityHint="在浏览器中打开"
            hitSlop={6}
            onPress={() => void Linking.openURL(liveCamUrl)}
            className="flex-row items-center gap-1 rounded-pill bg-highlight-soft px-row active:opacity-75"
            style={{ height: 32 }}
          >
            <Icon icon={Video} size="footnote" tone="tint" />
            <Text variant="subheadline" className="font-semibold text-primary">
              看直播
            </Text>
          </Pressable>
        ) : null}
      </View>
      <FollowButton slug={institution.slug} name={institution.name} />
    </View>
  );
}

function ResidentFace({ panda }: { panda: PandaListItem }) {
  return (
    <PressScale role="link" accessibilityLabel={panda.name} onPress={() => openPanda(panda.slug)} className="items-center gap-1.5" style={{ width: FACE }}>
      <PandaThumb pandaId={panda.id} name={panda.name} size={FACE} shape="round" />
      <Text variant="subheadline" className="font-semibold" numberOfLines={1}>
        {panda.name}
      </Text>
    </PressScale>
  );
}

function ResidentFaces({ pandas, onAll }: { pandas: PandaListItem[]; onAll: () => void }) {
  return (
    <View className="gap-stack-tight">
      <View className="flex-row items-baseline justify-between">
        <SectionTitle title="住在这里" icon={PawPrint} />
        <Pressable role="button" accessibilityLabel="看全部熊猫" onPress={onAll} hitSlop={12} className="active:opacity-60">
          <Text variant="body" className="text-primary">
            全部
          </Text>
        </Pressable>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} className="-mx-gutter" contentContainerClassName="gap-section px-gutter">
        {pandas.slice(0, FACE_LIMIT).map((panda) => (
          <ResidentFace key={panda.id} panda={panda} />
        ))}
      </ScrollView>
    </View>
  );
}

function Sources({ institution }: { institution: InstitutionDetail }) {
  if (!institution.verifiedOn && institution.sources.length === 0) return null;
  return (
    <View className="flex-row flex-wrap items-center gap-x-row gap-y-hair-gap px-4">
      {institution.verifiedOn ? (
        <IconRow
          icon={CalendarCheck}
          text={longDate(institution.verifiedOn)}
          accessibilityLabel={`核实于 ${longDate(institution.verifiedOn)}`}
        />
      ) : null}
      {institution.sources.map((url) => (
        <SourceBadge
          key={url}
          name={hostname(url)}
          icon={Globe}
          accessibilityLabel={`来源 ${hostname(url)}`}
          onPress={() => void Linking.openURL(url)}
        />
      ))}
    </View>
  );
}

export function Overview({ institution, onPandas }: { institution: InstitutionDetail; onPandas: () => void }) {
  const counts = [
    { label: "现在住这里", value: institution.residents.length },
    { label: "以前住过", value: institution.former.length },
    { label: "在这里出生", value: institution.bornHere },
  ].filter((count) => count.value > 0);
  const location = institution.facilities.find((facility) => facility.coordinates);
  return (
    <>
      {institution.summary ? <Text variant="body">{institution.summary}</Text> : null}
      {counts.length > 1 ? (
        <View className="flex-row gap-stack-tight">
          {counts.map((count) => (
            <StatTile key={count.label} label={count.label} value={`${count.value} 只`} />
          ))}
        </View>
      ) : null}
      {institution.residents.length > 0 ? <ResidentFaces pandas={institution.residents} onAll={onPandas} /> : null}
      <VenueNewsSection institutionSlug={institution.slug} />
      {location ? (
        <ListSection title="位置" titleIcon={MapPin}>
          <NavigateCell facility={location} detail={addressOf(location)} />
        </ListSection>
      ) : null}
      <Sources institution={institution} />
    </>
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
            {/* Padding on the wrapper: on web a padded, clamped Text shows a third line in its padding. */}
            <View className="absolute right-0 bottom-0 left-0 gap-1 p-3">
              <Text variant="title" role="none" className="text-on-media" numberOfLines={2}>
                {panda.name}
              </Text>
              {birthYear || seen ? (
                <View className="flex-row items-center justify-between gap-2">
                  {birthYear ? (
                    <Text variant="footnote" role="none" className="text-on-media/85 tabular-nums" numberOfLines={1}>
                      {`${birthYear} 年生`}
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
  const { featured, compact } = splitResidentsByCover(filtered);

  return (
    <View className="gap-3">
      <SectionTitle title={`住在这里的熊猫　${pandas.length} 只`} icon={PawPrint} />
      {pandas.length >= 4 ? (
        <SearchField
          value={query}
          onChange={setQuery}
          label="在馆内搜索熊猫"
          placeholder={`在 ${pandas.length} 只住客中搜名字…`}
        />
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
                hitSlop={4}
                onPress={() => setFilter(pill.key)}
                className={cn(
                  "h-9 items-center justify-center rounded-full px-3.5 active:opacity-75",
                  selected ? "bg-foreground" : "bg-secondary",
                )}
              >
                <Text
                  variant="subheadline"
                  className={cn("font-semibold tabular-nums", selected ? "text-background" : "text-foreground")}
                >
                  {pill.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}
      {filtered.length === 0 ? (
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
                    detail={birthYear ? `${birthYear} 年生` : undefined}
                    meta={isSeen ? "见过" : undefined}
                    accessibilityLabel={`${panda.name}${birthYear ? `，${birthYear} 年生` : ""}${isSeen ? "，已见过" : ""}`}
                    onPress={() => openPanda(panda.slug)}
                    last={index === compact.length - 1}
                  />
                );
              })}
            </ListSection>
          ) : null}
        </View>
      )}
    </View>
  );
}

function spanOf({ from, to }: FormerResident): string | undefined {
  if (from !== null && to !== null) return from === to ? `${from}` : `${from}–${to}`;
  if (to !== null) return `${to} 年离开`;
  return from !== null ? `${from} 年起` : undefined;
}

export function Former({ pandas }: { pandas: FormerResident[] }) {
  return (
    <ListSection title={`以前住过　${pandas.length} 只`} titleIcon={History}>
      {pandas.map((item, index) => (
        <ListCell
          key={item.panda.id}
          label={item.panda.name}
          detail={item.bornHere ? "在这里出生" : undefined}
          meta={spanOf(item)}
          onPress={() => openPanda(item.panda.slug)}
          last={index === pandas.length - 1}
        />
      ))}
    </ListSection>
  );
}

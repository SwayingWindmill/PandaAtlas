import { Image } from "expo-image";
import { Link } from "expo-router";
import { Linking, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";
import { useCSSVariable } from "uniwind";

import { ListCell, ListSection, SectionTitle, useSingleColumn } from "@/components/grouped-list";
import { Icon } from "@/components/icon";
import { IconRow } from "@/components/icon-row";
import { CalendarCheck, Globe, History, MapPin, PawPrint, Ticket, Video } from "@/components/icons";
import { PandaThumb } from "@/components/panda-thumb";
import { PhotoOutline } from "@/components/photo-outline";
import { PressScale } from "@/components/press-scale";
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
import { openPanda } from "@/features/pandas/panda-row";
import type { PandaListItem } from "@/features/pandas/pandas";
import { longDate } from "@/features/pandas/profile";
import { VenueNewsSection } from "@/features/venue-news/venue-news-section";
import { usePandaCover } from "@/lib/covers";
import { RADIUS, pageColumn } from "@/lib/surface";
import { cn } from "@/lib/utils";

/** Hero height below the status bar, a little shorter than a panda's: the name sits on it. */
export const INSTITUTION_HERO_HEIGHT = 300;
/** Under a resident's photo while it loads, dark enough that the white name already reads. */
const PLACEHOLDER = semantic.color.light.mediaPlaceholder;
const GAP = semantic.spacing.row.value;
const FACE = 72;

export function HeroTitle({ institution }: { institution: InstitutionDetail }) {
  return (
    <View pointerEvents="none" className="absolute right-0 bottom-0 left-0 gap-1 px-4 pb-4">
      <Text variant="display" className="text-on-media" numberOfLines={3}>
        {institution.name}
      </Text>
      {institution.meta ? (
        <Text variant="footnote" className="font-semibold text-on-media/85">
          {institution.meta}
        </Text>
      ) : null}
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
        <View className="absolute right-0 bottom-0 left-0 gap-hair-gap px-inset pb-inset">
          <Text variant="display" numberOfLines={3}>
            {institution.name}
          </Text>
          {institution.meta ? (
            <Text variant="footnote" className="font-semibold text-muted-foreground">
              {institution.meta}
            </Text>
          ) : null}
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
  const badges = [
    isFreeEntry(institution.facilities) ? { icon: Ticket, label: "免费", spoken: "免费参观" } : null,
    institution.liveCamUrl ? { icon: Video, label: "直播", spoken: "有官方直播" } : null,
    count > 0 ? { icon: PawPrint, label: `${count} 只`, spoken: `住着 ${count} 只熊猫` } : null,
  ].filter((badge) => badge !== null);
  return (
    <View className="flex-row items-center gap-stack-tight">
      <View className="min-w-0 flex-1 flex-row flex-wrap gap-stack-tight">
        {badges.map((badge) => (
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
        <Pressable role="button" accessibilityLabel="看全部熊猫" onPress={onAll} hitSlop={8} className="active:opacity-60">
          <Text variant="body" className="text-primary">
            全部
          </Text>
        </Pressable>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} className="-mx-gutter" contentContainerClassName="gap-section px-gutter">
        {pandas.map((panda) => (
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
      {institution.liveCamUrl ? (
        <ListSection>
          <ListCell
            icon={Video}
            label="看官方直播"
            tone="tint"
            role="link"
            accessibilityHint="在浏览器中打开"
            onPress={() => void Linking.openURL(institution.liveCamUrl!)}
            last
          />
        </ListSection>
      ) : null}
      <Sources institution={institution} />
    </>
  );
}

function ResidentTile({ panda, width }: { panda: PandaListItem; width: number }) {
  const photo = usePandaCover(panda.id);
  const height = Math.round((width * 5) / 4);
  return (
    <Link href={{ pathname: "/pandas/[slug]", params: { slug: panda.slug } }} asChild>
      <Link.AppleZoom>
        <PressScale role="link" accessibilityLabel={panda.name} style={{ width, height }}>
          <View
            style={{ flex: 1, borderRadius: RADIUS.tile, borderCurve: "continuous", overflow: "hidden", backgroundColor: PLACEHOLDER }}
          >
            {photo ? (
              <Image
                source={photo}
                style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
                contentFit="cover"
                accessible={false}
                transition={200}
              />
            ) : null}
            <Scrim id={`resident-${panda.id}`} height="45%" />
            {/* Padding on the wrapper: on web a padded, clamped Text shows a third line in its padding. */}
            <View className="absolute right-0 bottom-0 left-0 p-3">
              <Text variant="title" role="none" className="text-on-media" numberOfLines={2}>
                {panda.name}
              </Text>
            </View>
            <PhotoOutline radius={RADIUS.tile} />
          </View>
        </PressScale>
      </Link.AppleZoom>
    </Link>
  );
}

export function Residents({ pandas }: { pandas: PandaListItem[] }) {
  const { width } = useWindowDimensions();
  const columns = useSingleColumn() ? 1 : 2;
  const tile = Math.floor((pageColumn(width) - GAP * (columns - 1)) / columns);
  return (
    <View className="gap-1.5">
      <SectionTitle title={`住在这里的熊猫　${pandas.length} 只`} icon={PawPrint} />
      <View className="flex-row flex-wrap" style={{ gap: GAP }}>
        {pandas.map((panda) => (
          <ResidentTile key={panda.id} panda={panda} width={tile} />
        ))}
      </View>
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

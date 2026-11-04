import { Image } from "expo-image";
import { Link, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Linking, Platform, StyleSheet, View, useWindowDimensions } from "react-native";
import Animated from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";
import { useCSSVariable } from "uniwind";

import { ICON_INSET, ListCell, ListSection, SectionTitle, useSingleColumn } from "@/components/grouped-list";
import { Icon } from "@/components/icon";
import {
  Binoculars,
  CalendarCheck,
  Clock,
  History,
  Globe,
  Info,
  type LucideIcon,
  MapPin,
  Navigation,
  PawPrint,
  Sunrise,
  Ticket,
  TramFront,
  Users,
  Video,
} from "@/components/icons";
import { IconRow } from "@/components/icon-row";
import { SourceBadge } from "@/components/source-badge";
import { TimeBand } from "@/components/time-band";
import { LoadFailed } from "@/components/load-failed";
import { PhotoOutline } from "@/components/photo-outline";
import { PressScale } from "@/components/press-scale";
import { Scrim } from "@/components/scrim";
import { HeroHeader, useHeroScroll } from "@/components/hero-header";
import { StretchyHero } from "@/components/stretchy-hero";
import { PAGE_ENTER } from "@/design/motion";
import { Skeleton } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import { semantic } from "@/design/tokens";
import { useInstitutionHero } from "@/features/institutions/institution-hero";
import {
  type Facility,
  type InstitutionDetail,
  guideVerifiedOn,
  hasGuide,
  hostname,
  loadInstitution,
  unseenResidents,
} from "@/features/institutions/institutions";
import { loadSeenIds } from "@/features/engagement/seen";
import { useSession } from "@/features/session/session";
import { openPanda } from "@/features/pandas/panda-row";
import type { PandaListItem } from "@/features/pandas/pandas";
import { longDate } from "@/features/pandas/profile";
import { VenueNewsSection } from "@/features/venue-news/venue-news-section";
import { FacilityVisits } from "@/features/visits/facility-visits";
import { usePandaCover } from "@/lib/covers";
import { HAIRLINE, RADIUS } from "@/lib/surface";

/** Under a resident's photo while it loads, dark enough that the white name already reads. */
const PLACEHOLDER = semantic.color.light.mediaPlaceholder;
const GUTTER = semantic.spacing.gutter.value;
const GAP = semantic.spacing.row.value;

function openMaps(name: string, { latitude, longitude }: NonNullable<Facility["coordinates"]>) {
  const label = encodeURIComponent(name);
  const url = Platform.select({
    ios: `maps:?q=${label}&ll=${latitude},${longitude}`,
    default: `geo:${latitude},${longitude}?q=${latitude},${longitude}(${label})`,
  });
  void Linking.openURL(url);
}

/** A resident as a portrait photograph with its name in white over the scrim, as Music lays out artists. */
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

function Residents({ pandas }: { pandas: PandaListItem[] }) {
  const { width } = useWindowDimensions();
  // Two large tiles a row, one at the largest sizes or in a narrow window, where the name needs the width.
  const columns = useSingleColumn() ? 1 : 2;
  const tile = Math.floor((Math.min(width, 700) - GUTTER * 2 - GAP * (columns - 1)) / columns);
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

function Former({ pandas }: { pandas: PandaListItem[] }) {
  return (
    <ListSection title="以前住过" titleIcon={History}>
      {pandas.map((panda, index) => (
        <ListCell key={panda.id} label={panda.name} onPress={() => openPanda(panda.slug)} last={index === pandas.length - 1} />
      ))}
    </ListSection>
  );
}

/** The glyph for each 参观攻略 fact, the way Maps marks hours, address and transit on a place card. */
const GUIDE_ICON: Record<string, LucideIcon> = {
  开放时间: Clock,
  门票: Ticket,
  熊猫馆: PawPrint,
  地址: MapPin,
  什么时候去: Sunrise,
  怎么找到熊猫: Binoculars,
  怎么去: TramFront,
  提示: Info,
};

/**
 * One 参观攻略 fact, the way Maps lays out a place card: a footnote label over the value, in a
 * grouped card with inset separators. The value wraps freely, so it reads at every text size.
 * The icon sits on the label's line, not centred on a long value.
 */
/** "09:00–17:00" as one span, or null when the hours are seasonal, several, or free text. */
function singleSpan(value: string): { open: string; close: string } | null {
  const spans = [...value.matchAll(/(\d{1,2}:\d{2})\s*[-–—~至到]\s*(\d{1,2}:\d{2})/g)];
  if (spans.length !== 1) return null;
  const pad = (time: string) => time.padStart(5, "0");
  return { open: pad(spans[0]![1]!), close: pad(spans[0]![2]!) };
}

function GuideRow({ label, value, last }: { label: string; value: string; last: boolean }) {
  // One plain span of opening hours also draws as a band of the day. No "now" marker: the
  // venue's time zone is not in the guide, so the band says when, not whether it is open.
  const span = label === "开放时间" ? singleSpan(value) : null;
  return (
    <View accessible accessibilityLabel={`${label}，${value}`}>
      <View className="flex-row gap-3 px-4 py-3">
        <Icon icon={GUIDE_ICON[label] ?? Info} style={{ marginTop: 6 }} />
        <View className="min-w-0 flex-1 gap-0.5">
          <Text variant="footnote" className="text-muted-foreground">
            {label}
          </Text>
          <Text variant="body">{value}</Text>
          {span ? (
            <View className="pt-hair-gap" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
              <TimeBand open={span.open} close={span.close} />
            </View>
          ) : null}
        </View>
      </View>
      {last ? null : <View className="bg-border" style={[{ height: HAIRLINE }, ICON_INSET]} />}
    </View>
  );
}

function FacilityGuide({ facility, title }: { facility: Facility; title?: string }) {
  const rows = [
    ...facility.guide,
    ...facility.tips.map((tip) => ({ label: tip.label, value: tip.text })),
  ];
  const coordinates = facility.coordinates;
  return (
    <ListSection title={title}>
      {rows.map((row, index) => (
        <GuideRow
          key={`${row.label}-${index}`}
          label={row.label}
          value={row.value}
          last={index === rows.length - 1 && !coordinates}
        />
      ))}
      {coordinates ? (
        <ListCell
          icon={Navigation}
          label="导航过去"
          tone="tint"
          accessibilityLabel={`在地图中导航到${facility.name}`}
          onPress={() => openMaps(facility.name, coordinates)}
          last
        />
      ) : null}
    </ListSection>
  );
}

/**
 * 参观攻略: what a visitor checks before going, folded into the base's own page rather than a page
 * of its own. Only published guide lines appear; hours and prices change, so the section says when
 * they were checked and sends the visitor to the official site. With no guide and no site it is left out.
 */
function VisitGuide({ institution, unseen }: { institution: InstitutionDetail; unseen: PandaListItem[] | null }) {
  const guided = institution.facilities.filter(hasGuide);
  const several = institution.facilities.length > 1;
  const verifiedOn = guideVerifiedOn(guided);
  const sources = [...new Set(guided.flatMap((facility) => facility.sourceUrls))];
  if (guided.length === 0 && !institution.websiteUrl) return null;
  return (
    <View className="gap-4">
      <View className="gap-hair-gap">
        <View className="flex-row items-center gap-stack-tight">
          <Icon icon={Ticket} size="title3" />
          <Text variant="title" role="heading">
            参观攻略
          </Text>
        </View>
        {/* The date is the caveat: hours and prices are as checked then; 出发前看官网 below says the rest. */}
        {guided.length > 0 && verifiedOn ? (
          <IconRow
            icon={CalendarCheck}
            text={longDate(verifiedOn)}
            accessibilityLabel={`开放时间和门票会调整，以官方公布为准。核实于 ${longDate(verifiedOn)}`}
          />
        ) : null}
      </View>
      {unseen && institution.residents.length > 0 ? (
        <ListSection title="这次去" titleIcon={Users}>
          <ListCell
            label={unseen.length === 0 ? "住在这里的你都见过了" : "还没见过"}
            detail={unseen.length === 0 ? undefined : unseen.map((panda) => panda.name).join("、")}
            meta={unseen.length === 0 ? undefined : `${unseen.length} 只`}
            last
          />
        </ListSection>
      ) : null}
      {guided.map((facility) => (
        <FacilityGuide key={facility.id} facility={facility} title={several ? facility.name : undefined} />
      ))}
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
      {sources.length > 0 ? (
        <View className="flex-row flex-wrap gap-x-row gap-y-hair-gap px-4">
          {sources.map((url) => (
            <SourceBadge
              key={url}
              name={hostname(url)}
              icon={Globe}
              accessibilityLabel={`攻略出处 ${hostname(url)}`}
              onPress={() => void Linking.openURL(url)}
            />
          ))}
        </View>
      ) : null}
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

/** Hero height below the status bar, a little shorter than a panda's: the name sits on it. */
const HERO = 300;

/** The name and meta in white over the hero's scrim, as Music sets an artist's name on the photo. */
function HeroTitle({ institution }: { institution: InstitutionDetail }) {
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
 * The top of a page with no curated photo: a plate in the brand's soft tint fading into the page,
 * with the name in the label color at its foot, so the page keeps the hero's height and rhythm
 * without showing a photo that was not reviewed. While the covers are still being looked up the
 * plate stands empty, so a photo that then arrives replaces it without moving the content.
 */
function PlateHero({ institution, pending }: { institution: InstitutionDetail; pending: boolean }) {
  const insets = useSafeAreaInsets();
  const [tint, ground] = useCSSVariable(["--color-highlight-soft", "--color-background"]);
  return (
    <View style={{ height: HERO + insets.top }}>
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

export default function InstitutionScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const [institution, setInstitution] = useState<InstitutionDetail | null>(null);
  const [failed, setFailed] = useState(false);
  const hero = useInstitutionHero(institution?.residents ?? null);
  const { state } = useSession();
  const signedIn = state.status === "signedIn";
  const [seen, setSeen] = useState<ReadonlySet<string> | null>(null);
  useEffect(() => {
    if (!signedIn) return;
    // 见过 is a nicety on the 攻略: signed out, or if it fails, the row is simply left out.
    let live = true;
    loadSeenIds()
      .then((ids) => live && setSeen(ids))
      .catch(() => live && setSeen(null));
    return () => {
      live = false;
    };
  }, [signedIn]);
  const insets = useSafeAreaInsets();
  const { scrollY, onScroll, pastHero } = useHeroScroll(HERO);

  const load = useCallback(() => {
    loadInstitution(slug)
      .then(setInstitution)
      .catch(() => setFailed(true));
  }, [slug]);
  useEffect(load, [load]);

  function retry() {
    setFailed(false);
    load();
  }

  if (!institution) {
    return (
      <View className="flex-1 bg-background">
        <HeroHeader title="" pastHero={false} />
        {failed ? (
          <View className="px-gutter" style={{ paddingTop: insets.top + 64 }}>
            <LoadFailed message="这一页暂时打不开。" onRetry={retry} />
          </View>
        ) : (
          <View className="gap-4" accessibilityLabel="正在加载">
            <Skeleton className="w-full rounded-none" style={{ height: HERO + insets.top }} />
            <View className="flex-row gap-3 px-4">
              <Skeleton className="h-56 flex-1 rounded-tile" />
              <Skeleton className="h-56 flex-1 rounded-tile" />
            </View>
          </View>
        )}
      </View>
    );
  }

  const unseen = signedIn && seen ? unseenResidents(institution.residents, seen) : null;

  return (
    <View className="flex-1 bg-background">
      <HeroHeader title={institution.name} pastHero={pastHero} />
      <Animated.ScrollView
        className="flex-1"
        contentInsetAdjustmentBehavior="never"
        contentContainerClassName="pb-16"
        onScroll={onScroll}
        scrollEventThrottle={16}
      >
        {hero ? (
          <StretchyHero
            url={hero.url}
            height={HERO}
            scrollY={scrollY}
            label={`${institution.name}，照片里是${hero.pandaName}`}
            overlay={
              <>
                <Scrim id="institution-hero" height="70%" />
                <HeroTitle institution={institution} />
              </>
            }
          />
        ) : (
          <PlateHero institution={institution} pending={hero === undefined} />
        )}
        <Animated.View entering={PAGE_ENTER} className="gap-7 bg-background px-gutter pt-5">
          {institution.summary ? <Text variant="body">{institution.summary}</Text> : null}
          {institution.residents.length > 0 ? <Residents pandas={institution.residents} /> : null}
          <VenueNewsSection institutionSlug={institution.slug} />
          <VisitGuide institution={institution} unseen={unseen} />
          {institution.facilities.length > 0 ? <FacilityVisits facilities={institution.facilities} /> : null}
          {institution.former.length > 0 ? <Former pandas={institution.former} /> : null}
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
          {hero?.credit ? (
            <Text variant="footnote" className="px-4 text-muted-foreground">
              {`顶部照片：${hero.pandaName}，${hero.credit}`}
            </Text>
          ) : null}
        </Animated.View>
      </Animated.ScrollView>
    </View>
  );
}

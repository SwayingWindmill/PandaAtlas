import { Linking, Platform, View } from "react-native";

import { ICON_INSET, ListCell, ListSection } from "@/components/grouped-list";
import { Icon } from "@/components/icon";
import { IconRow } from "@/components/icon-row";
import {
  Binoculars,
  CalendarCheck,
  Clock,
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
} from "@/components/icons";
import { SourceBadge } from "@/components/source-badge";
import { TimeBand } from "@/components/time-band";
import { Text } from "@/components/ui/text";
import {
  type Facility,
  type InstitutionDetail,
  guideVerifiedOn,
  hasGuide,
  hostname,
} from "@/features/institutions/institutions";
import type { PandaListItem } from "@/features/pandas/pandas";
import { longDate } from "@/features/pandas/profile";
import { ViewingTiming } from "@/features/viewing/viewing-timing";
import { HAIRLINE } from "@/lib/surface";

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

function openMaps(name: string, { latitude, longitude }: NonNullable<Facility["coordinates"]>) {
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
      onPress={() => openMaps(facility.name, coordinates)}
      last
    />
  );
}

function singleSpan(value: string): { open: string; close: string } | null {
  const spans = [...value.matchAll(/(\d{1,2}:\d{2})\s*[-–—~至到]\s*(\d{1,2}:\d{2})/g)];
  if (spans.length !== 1) return null;
  const pad = (time: string) => time.padStart(5, "0");
  return { open: pad(spans[0]![1]!), close: pad(spans[0]![2]!) };
}

function GuideRow({ label, value, last }: { label: string; value: string; last: boolean }) {
  // No "now" marker: the venue's time zone is not in the guide, so the band says when, not whether it is open.
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
  if (rows.length === 0 && !coordinates) return null;
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
      <NavigateCell facility={facility} />
    </ListSection>
  );
}

export function VisitGuide({ institution, unseen }: { institution: InstitutionDetail; unseen: PandaListItem[] | null }) {
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
        <View key={facility.id} className="gap-4">
          {several ? (
            <Text variant="headline" role="heading">
              {facility.name}
            </Text>
          ) : null}
          <ViewingTiming facility={facility} />
          <FacilityGuide facility={facility} title="须知" />
        </View>
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

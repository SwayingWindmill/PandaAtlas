import { Image } from "expo-image";
import { useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Linking, Platform, Pressable, View, useWindowDimensions } from "react-native";

import { ListCell, ListSection } from "@/components/grouped-list";
import { LoadFailed } from "@/components/load-failed";
import { Page } from "@/components/page";
import { Skeleton } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import { type Facility, type InstitutionDetail, hostname, loadInstitution } from "@/features/institutions/institutions";
import { FacilityVisits } from "@/features/visits/facility-visits";
import { openPanda } from "@/features/pandas/panda-row";
import type { PandaListItem } from "@/features/pandas/pandas";
import { longDate } from "@/features/pandas/profile";
import { usePandaCover } from "@/lib/covers";

const GUTTER = 16;
const GAP = 12;

function openMaps(name: string, { latitude, longitude }: NonNullable<Facility["coordinates"]>) {
  const label = encodeURIComponent(name);
  const url = Platform.select({
    ios: `maps:?q=${label}&ll=${latitude},${longitude}`,
    default: `geo:${latitude},${longitude}?q=${latitude},${longitude}(${label})`,
  });
  void Linking.openURL(url);
}

/** Four tiles a row at the default text size, three at large sizes, two at the accessibility sizes. */
function columnsFor(fontScale: number) {
  if (fontScale >= 2) return 2;
  if (fontScale >= 1.35) return 3;
  return 4;
}

function ResidentTile({ panda, width }: { panda: PandaListItem; width: number }) {
  const photo = usePandaCover(panda.id);
  const height = (width * 5) / 4;
  return (
    <Pressable onPress={() => openPanda(panda.slug)} role="button" accessibilityLabel={panda.name} style={{ width }} className="gap-1.5 active:opacity-70">
      <View className="items-center justify-center overflow-hidden rounded-[10px] bg-secondary" style={{ width, height }}>
        {photo ? (
          <Image source={photo} style={{ width, height }} contentFit="cover" accessible={false} transition={150} />
        ) : (
          <Text variant="title3" className="text-muted-foreground">
            {panda.name.slice(0, 1)}
          </Text>
        )}
      </View>
      <Text variant="footnote" numberOfLines={2}>
        {panda.name}
      </Text>
    </Pressable>
  );
}

function Residents({ pandas }: { pandas: PandaListItem[] }) {
  const { width, fontScale } = useWindowDimensions();
  const columns = columnsFor(fontScale);
  const tile = Math.floor((Math.min(width, 700) - GUTTER * 2 - GAP * (columns - 1)) / columns);
  return (
    <View className="gap-1.5">
      <Text variant="footnote" role="heading" className="px-4 text-muted-foreground">
        {`住在这里的熊猫　${pandas.length} 只`}
      </Text>
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
    <ListSection title="以前住过">
      {pandas.map((panda, index) => (
        <ListCell key={panda.id} label={panda.name} onPress={() => openPanda(panda.slug)} last={index === pandas.length - 1} />
      ))}
    </ListSection>
  );
}

/**
 * One 去之前 fact, the way Maps lays out a place card: a footnote label over the value, in a
 * grouped card with inset separators. The value wraps freely, so it reads at every text size.
 */
function GuideRow({ label, value, last }: { label: string; value: string; last: boolean }) {
  return (
    <View accessible accessibilityLabel={`${label}，${value}`}>
      <View className="gap-0.5 px-4 py-3">
        <Text variant="footnote" className="text-muted-foreground">
          {label}
        </Text>
        <Text variant="body">
          {value}
        </Text>
      </View>
      {last ? null : <View className="ml-4 h-hairline bg-border" />}
    </View>
  );
}

function FacilityGuide({ facility, title }: { facility: Facility; title: string }) {
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

function Sources({ institution }: { institution: InstitutionDetail }) {
  if (!institution.verifiedOn && institution.sources.length === 0) return null;
  return (
    <View className="flex-row flex-wrap gap-x-3 gap-y-1 px-4">
      {institution.verifiedOn ? (
        <Text variant="footnote" className="text-muted-foreground">
          核实于 {longDate(institution.verifiedOn)}
        </Text>
      ) : null}
      {institution.sources.map((url) => (
        <Pressable key={url} onPress={() => void Linking.openURL(url)} role="link" accessibilityLabel={`来源 ${hostname(url)}`}>
          <Text variant="footnote" className="text-muted-foreground underline">
            {hostname(url)}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

export default function InstitutionScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const [institution, setInstitution] = useState<InstitutionDetail | null>(null);
  const [failed, setFailed] = useState(false);

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
      <Page title="基地和动物园">
        {failed ? (
          <LoadFailed message="这一页暂时打不开。" onRetry={retry} />
        ) : (
          <Skeleton className="h-72 w-full" accessibilityLabel="正在加载" />
        )}
      </Page>
    );
  }

  const guided = institution.facilities.filter((facility) => facility.guide.length + facility.tips.length > 0 || facility.coordinates);
  const several = institution.facilities.length > 1;

  return (
    <Page label={institution.meta} title={institution.name}>
      {institution.summary ? (
        <View className="rounded-[10px] bg-card px-4 py-3">
          <Text variant="body">{institution.summary}</Text>
        </View>
      ) : null}
      {institution.residents.length > 0 ? <Residents pandas={institution.residents} /> : null}
      {guided.map((facility) => (
        <FacilityGuide key={facility.id} facility={facility} title={several ? `去之前　${facility.name}` : "去之前"} />
      ))}
      {institution.facilities.length > 0 ? <FacilityVisits facilities={institution.facilities} /> : null}
      {institution.former.length > 0 ? <Former pandas={institution.former} /> : null}
      {institution.liveCamUrl || institution.websiteUrl ? (
        <ListSection>
          {institution.liveCamUrl ? (
            <ListCell
              label="看官方直播"
              tone="tint"
              role="link"
              accessibilityHint="在浏览器中打开"
              onPress={() => void Linking.openURL(institution.liveCamUrl!)}
              last={!institution.websiteUrl}
            />
          ) : null}
          {institution.websiteUrl ? (
            <ListCell
              label="官网"
              meta={hostname(institution.websiteUrl)}
              tone="tint"
              role="link"
              accessibilityHint="在浏览器中打开"
              onPress={() => void Linking.openURL(institution.websiteUrl!)}
              last
            />
          ) : null}
        </ListSection>
      ) : null}
      <Sources institution={institution} />
    </Page>
  );
}

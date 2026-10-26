import { Image } from "expo-image";
import { useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Linking, Platform, Pressable, View, useWindowDimensions } from "react-native";
import Svg, { Path } from "react-native-svg";
import { useCSSVariable } from "uniwind";

import { LoadFailed } from "@/components/load-failed";
import { Page } from "@/components/page";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import { type Facility, type InstitutionDetail, hostname, loadInstitution } from "@/features/institutions/institutions";
import { FacilityVisits } from "@/features/visits/facility-visits";
import { openPanda } from "@/features/pandas/panda-row";
import type { PandaListItem } from "@/features/pandas/pandas";
import { longDate } from "@/features/pandas/profile";
import { usePandaCover } from "@/lib/covers";
import { cn } from "@/lib/utils";

const GUTTER = 20;
const GAP = 12;

function openMaps(name: string, { latitude, longitude }: NonNullable<Facility["coordinates"]>) {
  const label = encodeURIComponent(name);
  const url = Platform.select({
    ios: `maps:?q=${label}&ll=${latitude},${longitude}`,
    default: `geo:${latitude},${longitude}?q=${latitude},${longitude}(${label})`,
  });
  void Linking.openURL(url);
}

function ResidentTile({ panda, width }: { panda: PandaListItem; width: number }) {
  const photo = usePandaCover(panda.id);
  return (
    <Pressable onPress={() => openPanda(panda.slug)} role="button" accessibilityLabel={panda.name} style={{ width }} className="gap-1.5">
      <View className="items-center justify-center overflow-hidden rounded-md bg-accent" style={{ width, height: (width * 5) / 4 }}>
        {photo ? (
          <Image source={photo} style={{ width, height: (width * 5) / 4 }} contentFit="cover" accessible={false} />
        ) : (
          <Text className="font-extrabold">{panda.name.slice(0, 1)}</Text>
        )}
      </View>
      <Text variant="small" numberOfLines={1}>
        {panda.name}
      </Text>
    </Pressable>
  );
}

function Residents({ pandas }: { pandas: PandaListItem[] }) {
  const { width } = useWindowDimensions();
  const tile = (width - GUTTER * 2 - GAP * 3) / 4;
  return (
    <View className="gap-3">
      <Text variant="h2">住在这里的熊猫</Text>
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
    <View className="gap-3">
      <Text variant="h2">以前住过</Text>
      <View className="flex-row flex-wrap gap-2">
        {pandas.map((panda) => (
          <Pressable
            key={panda.id}
            onPress={() => openPanda(panda.slug)}
            role="button"
            accessibilityLabel={panda.name}
            className="h-11 justify-center rounded-full bg-secondary px-4 active:bg-accent"
          >
            <Text className="font-bold">{panda.name}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function FacilityGuide({ facility, named }: { facility: Facility; named: boolean }) {
  const rows = [
    ...facility.guide.map((row) => ({ ...row, strong: true })),
    ...facility.tips.map((tip) => ({ label: tip.label, value: tip.text, strong: false })),
  ];
  return (
    <View className="gap-3">
      {named ? <Text variant="h3">{facility.name}</Text> : null}
      {rows.length > 0 ? (
        <View>
          {rows.map((row, index) => (
            <View
              key={`${row.label}-${index}`}
              className={cn("gap-0.5 border-t-hairline border-border py-2.5", index === rows.length - 1 && "border-b-hairline")}
            >
              <Text variant="muted">{row.label}</Text>
              <Text className={cn(row.strong && "font-bold")}>{row.value}</Text>
            </View>
          ))}
        </View>
      ) : null}
      {facility.coordinates ? (
        <Button variant="secondary" className="self-start" onPress={() => openMaps(facility.name, facility.coordinates!)}>
          <Text>导航过去</Text>
        </Button>
      ) : null}
    </View>
  );
}

function ExternalLink({ label, url }: { label: string; url: string }) {
  const ink = String(useCSSVariable("--color-foreground"));
  return (
    <Pressable
      onPress={() => void Linking.openURL(url)}
      role="link"
      accessibilityLabel={label}
      className="flex-row items-center justify-between rounded-lg border-hairline border-border p-4 active:bg-accent"
    >
      <Text className="font-bold">{label}</Text>
      <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={ink} strokeWidth={2} strokeLinecap="round">
        <Path d="M7 17L17 7M9 7h8v8" />
      </Svg>
    </Pressable>
  );
}

function Sources({ institution }: { institution: InstitutionDetail }) {
  if (!institution.verifiedOn && institution.sources.length === 0) return null;
  return (
    <View className="flex-row flex-wrap gap-x-3 gap-y-1">
      {institution.verifiedOn ? <Text variant="muted">核实于 {longDate(institution.verifiedOn)}</Text> : null}
      {institution.sources.map((url) => (
        <Pressable key={url} onPress={() => void Linking.openURL(url)} role="link" accessibilityLabel={`来源 ${hostname(url)}`}>
          <Text variant="muted" className="underline">
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

  return (
    <Page label={institution.meta} title={institution.name}>
      {institution.summary ? <Text className="leading-6">{institution.summary}</Text> : null}
      {institution.residents.length > 0 ? <Residents pandas={institution.residents} /> : null}
      {guided.length > 0 ? (
        <View className="gap-5">
          <Text variant="h2">去之前</Text>
          {guided.map((facility) => (
            <FacilityGuide key={facility.id} facility={facility} named={institution.facilities.length > 1} />
          ))}
        </View>
      ) : null}
      {institution.facilities.length > 0 ? <FacilityVisits facilities={institution.facilities} /> : null}
      {institution.former.length > 0 ? <Former pandas={institution.former} /> : null}
      {institution.liveCamUrl || institution.websiteUrl ? (
        <View className="gap-2">
          {institution.liveCamUrl ? <ExternalLink label="看官方直播" url={institution.liveCamUrl} /> : null}
          {institution.websiteUrl ? <ExternalLink label="官网" url={institution.websiteUrl} /> : null}
        </View>
      ) : null}
      <Sources institution={institution} />
    </Page>
  );
}

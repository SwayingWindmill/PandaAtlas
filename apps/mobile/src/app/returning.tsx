import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { useState } from "react";
import { Linking, Pressable, ScrollView, View } from "react-native";
import Animated from "react-native-reanimated";

import { Chip } from "@/components/chip";
import { ListSection } from "@/components/grouped-list";
import { Icon } from "@/components/icon";
import { MapPin, Plane } from "@/components/icons";
import { LoadFailed } from "@/components/load-failed";
import { Page } from "@/components/page";
import { PandaThumb } from "@/components/panda-thumb";
import { ScreenState } from "@/components/screen-state";
import { SourceBadge } from "@/components/source-badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import { PAGE_ENTER } from "@/design/motion";
import { institutionListQueryOptions } from "@/features/institutions/institutions";
import { type ReturnGroup, loadOverseasStatus, returnMeta, returnSections, sourceHost } from "@/features/overseas/overseas-status";
import { type PandaListItem, pandaIndexQueryOptions } from "@/features/pandas/pandas";
import { HAIRLINE } from "@/lib/surface";

const PHOTO = 36;
const ALL = "全部";
const COUNTRY: Record<string, string> = { US: "美国", JP: "日本", KR: "韩国", GB: "英国", DE: "德国", FR: "法国", AT: "奥地利", ES: "西班牙", BE: "比利时", NL: "荷兰", FI: "芬兰", DK: "丹麦", AU: "澳大利亚", MY: "马来西亚", TH: "泰国", SG: "新加坡", ID: "印度尼西亚", QA: "卡塔尔", MX: "墨西哥", RU: "俄罗斯" };

/** Two faces overlapping, as Messages draws a group; one when the panda came home alone. */
function Faces({ pandas }: { pandas: PandaListItem[] }) {
  return (
    <View className="flex-row" style={{ width: PHOTO * 1.7 }} accessible={false}>
      {pandas.slice(0, 2).map((panda, index) => (
        <View key={panda.id} style={index > 0 ? { marginLeft: -PHOTO * 0.3 } : undefined} className="rounded-pill border-2 border-card">
          <PandaThumb pandaId={panda.id} name={panda.name} size={PHOTO} shape="round" />
        </View>
      ))}
    </View>
  );
}

/** One return: the faces, the names, where they came home from, and the day (or the stage) at the right. */
function ReturnRow({ group, pandas, place, last }: { group: ReturnGroup; pandas: Map<string, PandaListItem>; place: string; last: boolean }) {
  const found = group.items.flatMap((item) => pandas.get(item.pandaSlug) ?? []);
  const names = group.items.map((item) => pandas.get(item.pandaSlug)?.name ?? item.pandaSlug).join("、");
  const meta = returnMeta(group);
  const abroad = group.stage === "abroad";
  return (
    <View>
      <Pressable
        role="link"
        accessibilityLabel={[names, abroad ? `在${place}` : `从${place}归国`, meta].filter(Boolean).join("，")}
        onPress={() => router.push({ pathname: "/pandas/[slug]", params: { slug: group.items[0]!.pandaSlug } })}
        className="min-h-14 flex-row items-center gap-row px-inset py-stack-tight active:bg-accent"
      >
        <Faces pandas={found} />
        <View className="min-w-0 flex-1 gap-hair-gap">
          <Text variant="headline" numberOfLines={2}>
            {names}
          </Text>
          <View className="flex-row items-center gap-1.5">
            <Icon icon={abroad ? MapPin : Plane} size="footnote" />
            <Text variant="footnote" className="min-w-0 shrink text-muted-foreground" numberOfLines={1}>
              {abroad ? place : `${place} → 中国`}
            </Text>
          </View>
        </View>
        {meta ? (
          <Text variant="subheadline" className="text-muted-foreground tabular-nums">
            {meta}
          </Text>
        ) : null}
      </Pressable>
      {last ? null : <View className="ml-inset bg-border" style={{ height: HAIRLINE }} />}
    </View>
  );
}

/**
 * 归国熊猫 (v4 `15-overseas-return`): the returns coming up, then each year's returns newest first, then the
 * pandas still abroad. Pandas that came home together share a row. Chips narrow it to one country. Every
 * entry comes from an announcement; the publishers follow as badges.
 */
export default function ReturningScreen() {
  const status = useQuery({ queryKey: ["overseas-status"], queryFn: loadOverseasStatus });
  const index = useQuery(pandaIndexQueryOptions());
  const institutions = useQuery(institutionListQueryOptions());
  const [country, setCountry] = useState(ALL);
  const pandas = new Map((index.data ?? []).map((panda) => [panda.slug, panda]));
  const venues = new Map((institutions.data ?? []).map((item) => [item.slug, item]));
  const countryOf = (slug: string) => {
    const code = venues.get(slug)?.countryCode;
    return code ? (COUNTRY[code] ?? null) : null;
  };

  const items = status.data ?? [];
  const countries = [...new Set(items.flatMap((item) => countryOf(item.institutionSlug) ?? []))];
  const shown = country === ALL ? items : items.filter((item) => countryOf(item.institutionSlug) === country);
  const sources = [...new Map(shown.map((item) => [item.sourceUrl, item])).values()];

  return (
    <Page title="归国熊猫">
      {status.isError ? (
        <LoadFailed message="归国熊猫暂时打不开。" onRetry={() => void status.refetch()} />
      ) : !status.data ? (
        <View className="gap-row" accessibilityLabel="正在加载">
          <Skeleton className="h-8 w-2/3 rounded-pill" />
          <Skeleton className="h-40 w-full rounded-group" />
        </View>
      ) : items.length === 0 ? (
        <ScreenState message="暂无记录" />
      ) : (
        <Animated.View entering={PAGE_ENTER} className="gap-section-tight">
          {countries.length > 1 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="-mx-gutter" contentContainerClassName="gap-stack-tight px-gutter">
              {[ALL, ...countries].map((name) => (
                <Chip key={name} label={name} appearance="ink" selected={country === name} onPress={() => setCountry(name)} />
              ))}
            </ScrollView>
          ) : null}
          {returnSections(shown).map((section) => (
            <View key={section.title} className="gap-stack-tight">
              <Text variant="headline" role="heading" className="px-inset tabular-nums">
                {section.title}
              </Text>
              <ListSection>
                {section.groups.map((group, groupIndex) => (
                  <ReturnRow
                    key={group.key}
                    group={group}
                    pandas={pandas}
                    place={venues.get(group.institutionSlug)?.nameZh ?? group.institutionSlug}
                    last={groupIndex === section.groups.length - 1}
                  />
                ))}
              </ListSection>
            </View>
          ))}
          <View className="flex-row flex-wrap gap-x-row gap-y-hair-gap px-inset">
            {sources.map((item) => (
              <SourceBadge
                key={item.sourceUrl}
                name={item.sourcePublisher}
                official
                accessibilityLabel={`官方出处 ${item.sourcePublisher}，${sourceHost(item.sourceUrl)}`}
                onPress={() => void Linking.openURL(item.sourceUrl)}
              />
            ))}
          </View>
        </Animated.View>
      )}
    </Page>
  );
}

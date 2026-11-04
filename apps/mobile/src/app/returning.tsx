import { useQuery } from "@tanstack/react-query";
import { Linking, View } from "react-native";
import Animated from "react-native-reanimated";

import { ListCell, ListSection, useStacked } from "@/components/grouped-list";
import { LoadFailed } from "@/components/load-failed";
import { Page } from "@/components/page";
import { ScreenState } from "@/components/screen-state";
import { StatTile } from "@/components/stat-tile";
import { Skeleton } from "@/components/ui/skeleton";
import { PAGE_ENTER } from "@/design/motion";
import { institutionListQueryOptions } from "@/features/institutions/institutions";
import {
  type OverseasStatusItem,
  byStage,
  loadOverseasStatus,
  sourceHost,
  statusDetail,
} from "@/features/overseas/overseas-status";
import { pandaIndexQueryOptions } from "@/features/pandas/pandas";

function summary(items: OverseasStatusItem[]) {
  const count = (stages: OverseasStatusItem["stage"][]) => String(items.filter((i) => stages.includes(i.stage)).length);
  return [
    { label: "旅居海外", value: count(["abroad"]) },
    { label: "归国中", value: count(["return_announced", "in_transit", "quarantine"]) },
    { label: "已归国", value: count(["returned"]) },
  ];
}

/** Each announcement once, in page order. */
function sources(items: OverseasStatusItem[]) {
  const seen = new Map<string, { url: string; publisher: string }>();
  for (const group of byStage(items))
    for (const item of group.items) if (!seen.has(item.sourceUrl)) seen.set(item.sourceUrl, { url: item.sourceUrl, publisher: item.sourcePublisher });
  return [...seen.values()];
}

/**
 * 归国熊猫: where each overseas panda is, the return as announced, and the quarantine stage. Nearest
 * to home first. A row opens the panda; its second line is the source host and checked-at
 * date, and the 来源 section opens each announcement. Summary tiles as Fitness shows totals.
 */
export default function ReturningScreen() {
  const stacked = useStacked();
  const status = useQuery({ queryKey: ["overseas-status"], queryFn: loadOverseasStatus });
  const pandas = useQuery(pandaIndexQueryOptions());
  const institutions = useQuery(institutionListQueryOptions());
  const pandaNames = new Map((pandas.data ?? []).map((p) => [p.slug, p.name]));
  const placeNames = new Map((institutions.data ?? []).map((i) => [i.slug, i.nameZh ?? i.nameEn ?? i.slug]));

  return (
    <Page title="归国熊猫" label="海外大熊猫状态">
      {status.isError ? (
        <LoadFailed message="归国熊猫暂时打不开。" onRetry={() => void status.refetch()} />
      ) : !status.data ? (
        <View className="gap-1.5" accessibilityLabel="正在加载">
          <Skeleton className="h-20 w-full rounded-tile" />
          <Skeleton className="h-16 w-full rounded-group" />
        </View>
      ) : status.data.length === 0 ? (
        <ScreenState message="暂无记录" />
      ) : (
        <Animated.View entering={PAGE_ENTER} className="gap-section-tight">
          <View className={stacked ? "gap-1.5" : "flex-row gap-1.5"}>
            {summary(status.data).map((tile) => (
              <StatTile key={tile.label} label={tile.label} value={tile.value} />
            ))}
          </View>
          {byStage(status.data).map((group) => (
            <ListSection key={group.stage} title={group.label}>
              {group.items.map((item, index) => {
                const name = pandaNames.get(item.pandaSlug) ?? item.pandaSlug;
                const detail = statusDetail(item, placeNames.get(item.institutionSlug) ?? item.institutionSlug);
                return (
                  <ListCell
                    key={item.pandaSlug}
                    label={name}
                    detail={detail}
                    detailLines={4}
                    href={{ pathname: "/pandas/[slug]", params: { slug: item.pandaSlug } }}
                    accessibilityLabel={`${name}，${group.label}，${detail.replace("\n", "，")}`}
                    last={index === group.items.length - 1}
                  />
                );
              })}
            </ListSection>
          ))}
          <ListSection title="来源">
            {sources(status.data).map((source, index, all) => (
              <ListCell
                key={source.url}
                label={source.publisher}
                detail={sourceHost(source.url)}
                role="link"
                onPress={() => void Linking.openURL(source.url)}
                accessibilityHint="打开原文"
                last={index === all.length - 1}
              />
            ))}
          </ListSection>
        </Animated.View>
      )}
    </Page>
  );
}

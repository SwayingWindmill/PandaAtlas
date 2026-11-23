import { useQuery } from "@tanstack/react-query";
import { View } from "react-native";
import Animated from "react-native-reanimated";

import { ListCell, ListSection, useStacked } from "@/components/grouped-list";
import { FileText, PawPrint, Photo } from "@/components/icons";
import { LoadFailed } from "@/components/load-failed";
import { Page } from "@/components/page";
import { StatTile } from "@/components/stat-tile";
import { Skeleton } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import { PAGE_ENTER } from "@/design/motion";
import { statsQueryOptions } from "@/features/about/stats";

/** 内容和照片从哪来: what the published release holds, and where a fan sees each source and credit. */
export default function AboutScreen() {
  const { data: counts, isError: failed, refetch } = useQuery(statsQueryOptions());

  const stacked = useStacked();
  const count = (value: number, unit: string) => `${value.toLocaleString("zh-CN")} ${unit}`;

  return (
    <Page label="关于" title="内容和照片从哪来">
      {failed ? (
        <LoadFailed
          message="暂时打不开。"
          onRetry={() => void refetch()}
        />
      ) : !counts ? (
        <View className="gap-row" accessibilityLabel="正在加载">
          <Skeleton className="h-20 w-full rounded-tile" />
          <Skeleton className="h-20 w-full rounded-tile" />
          <Skeleton className="h-12 w-full rounded-group" />
        </View>
      ) : (
        <Animated.View entering={PAGE_ENTER} className="gap-section">
          <View className="gap-row">
            <StatTile icon={PawPrint} label="熊猫" value={count(counts.pandas, "只")} />
            <View className={stacked ? "gap-row" : "flex-row gap-row"}>
              <StatTile icon={FileText} label="资料来源" value={count(counts.sources, "条")} />
              <StatTile icon={Photo} label="媒体资料" value={count(counts.photos, "条")} />
            </View>
          </View>
          <View className="gap-1.5">
            <ListSection>
              <ListCell label="资料版本" meta={counts.version} last />
            </ListSection>
            <View className="gap-stack-tight px-inset">
              <Text variant="footnote" className="text-muted-foreground">
                资料来源见熊猫资料页，照片署名见照片下方和查看器。
              </Text>
              <Text variant="footnote" className="text-muted-foreground">
                发现资料有误，可以在熊猫资料页纠错。
              </Text>
            </View>
          </View>
        </Animated.View>
      )}
    </Page>
  );
}

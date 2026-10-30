import { useCallback, useEffect, useState } from "react";
import { View } from "react-native";
import Animated from "react-native-reanimated";

import { ListCell, ListSection } from "@/components/grouped-list";
import { LoadFailed } from "@/components/load-failed";
import { Page } from "@/components/page";
import { ScreenState } from "@/components/screen-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import { PAGE_ENTER } from "@/design/motion";
import { PandaRow } from "@/features/pandas/panda-row";
import type { DigestGroup } from "@/features/today/week";
import { type Week, loadWeek } from "@/features/today/week-data";

/** Rows a group shows before 显示全部: a bulk import of hundreds would bury the births under it. */
const ROWS_SHOWN = 8;

export default function WeekScreen() {
  const [week, setWeek] = useState<Week | null>(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(() => {
    loadWeek()
      .then(setWeek)
      .catch(() => setFailed(true));
  }, []);
  useEffect(load, [load]);

  function retry() {
    setFailed(false);
    load();
  }

  if (!week) {
    return (
      <Page title="本周新鲜事">
        {failed ? <LoadFailed message="本周新鲜事暂时打不开。" onRetry={retry} /> : <WeekSkeleton />}
      </Page>
    );
  }

  const { digest } = week;
  if (!digest) {
    return (
      <Page title="本周新鲜事">
        <ScreenState message="这 7 天还没有新收录、搬家或新照片。有了会出现在今天页。" />
      </Page>
    );
  }

  return (
    <Page title="本周新鲜事" label={digest.range}>
      <Animated.View entering={PAGE_ENTER} className="gap-section">
        {digest.groups.map((group) => (
          <Group key={group.kind} group={group} pandas={week.pandas} />
        ))}
        {digest.photos > 0 ? (
          <ListSection title="新照片">
            <ListCell
              label={`新增 ${digest.photos.toLocaleString("zh-CN")} 张照片`}
              detail="已放进各自熊猫的相册"
              last
            />
          </ListSection>
        ) : null}
        <Text variant="footnote" className="px-4 text-muted-foreground">
          {`按 ${digest.releases.length} 次公开资料更新整理（${digest.releases.join("、")}）。只算最近 7 天，没有新内容的一周这里不出现。`}
        </Text>
      </Animated.View>
    </Page>
  );
}

function Group({ group, pandas }: { group: DigestGroup; pandas: Week["pandas"] }) {
  const [all, setAll] = useState(false);
  const items = group.pandaIds.flatMap((id) => pandas.get(id) ?? []);
  const shown = all ? items : items.slice(0, ROWS_SHOWN);
  const hidden = items.length - shown.length;
  return (
    <View className="gap-1.5">
      <Text variant="footnote" role="heading" className="px-4 text-muted-foreground">
        {`${group.label} · ${items.length} 只`}
      </Text>
      <View>
        {shown.map((item, index) => (
          <PandaRow key={item.id} item={item} first={index === 0} last={hidden === 0 && index === shown.length - 1} />
        ))}
        {hidden > 0 ? (
          <View className="overflow-hidden rounded-b-group bg-card" style={{ borderCurve: "continuous" }}>
            <ListCell tone="tint" label={`显示全部 ${items.length} 只`} onPress={() => setAll(true)} last />
          </View>
        ) : null}
      </View>
    </View>
  );
}

/** A group header and three panda rows, as the loaded page lays them out. */
function WeekSkeleton() {
  return (
    <View className="gap-1.5" accessibilityLabel="正在加载本周新鲜事">
      <Skeleton className="mx-4 h-4 w-24 rounded-control" />
      <View className="overflow-hidden rounded-group bg-card" style={{ borderCurve: "continuous" }}>
        {[0, 1, 2].map((row) => (
          <View key={row} className="flex-row items-center gap-row px-inset py-stack-tight">
            <Skeleton className="rounded-control" style={{ width: 56, height: 56 }} />
            <View className="flex-1 gap-2">
              <Skeleton className="h-5 w-1/3 rounded-control" />
              <Skeleton className="h-4 w-1/2 rounded-control" />
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

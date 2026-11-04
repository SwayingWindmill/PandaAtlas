import { router } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { View } from "react-native";

import { LoadFailed } from "@/components/load-failed";
import { Page } from "@/components/page";
import { ScreenState } from "@/components/screen-state";
import { Skeleton } from "@/components/ui/skeleton";
import { useFollowed } from "@/features/engagement/favorites";
import { PandaRow } from "@/features/pandas/panda-row";
import { type PandaListItem, loadPandaIndex } from "@/features/pandas/pandas";

/** 关注的熊猫, opened from 我的: every panda the fan follows, in the catalog's own order. */
export default function FollowingScreen() {
  const followed = useFollowed();
  const [pandas, setPandas] = useState<PandaListItem[] | null>(null);
  const [failed, setFailed] = useState(false);
  const load = useCallback(() => {
    loadPandaIndex()
      .then(setPandas)
      .catch(() => setFailed(true));
  }, []);
  useEffect(load, [load]);
  const retry = () => {
    setFailed(false);
    load();
  };

  const items = followed && pandas ? pandas.filter((panda) => followed.has(panda.id)) : null;
  return (
    <Page title="关注的熊猫">
      {failed ? <LoadFailed message="关注的熊猫暂时打不开。" onRetry={retry} /> : null}
      {!failed && items === null ? <Skeleton className="h-72 w-full rounded-group" accessibilityLabel="正在加载" /> : null}
      {items && items.length === 0 ? (
        <ScreenState message="在熊猫资料页点「关注」，它们会排在这里。" actionLabel="找熊猫" onAction={() => router.push("/find")} />
      ) : null}
      {items && items.length > 0 ? (
        <View>
          {items.map((panda, index) => (
            <PandaRow key={panda.id} item={panda} first={index === 0} last={index === items.length - 1} />
          ))}
        </View>
      ) : null}
    </Page>
  );
}

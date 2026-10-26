import { useCallback, useEffect, useState } from "react";
import { View } from "react-native";

import { LoadFailed } from "@/components/load-failed";
import { Page } from "@/components/page";
import { Skeleton } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

interface Counts {
  version: string;
  pandas: number;
  sources: number;
  photos: number;
}

/** 内容和照片从哪来: what the published release holds, and where a fan sees each source and credit. */
export default function AboutScreen() {
  const [counts, setCounts] = useState<Counts | null>(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(() => {
    api
      .GET("/api/v2/stats")
      .then(({ data }) => {
        if (!data) throw new Error("Stats unavailable");
        setCounts({
          version: data.release.version,
          pandas: data.stats.pandaCount,
          sources: data.stats.evidenceSourceCount,
          photos: data.stats.mediaCount,
        });
      })
      .catch(() => setFailed(true));
  }, []);
  useEffect(load, [load]);

  const rows = counts
    ? [
        { label: "熊猫", value: `${counts.pandas.toLocaleString("zh-CN")} 只` },
        { label: "资料来源", value: `${counts.sources.toLocaleString("zh-CN")} 条` },
        { label: "照片", value: `${counts.photos.toLocaleString("zh-CN")} 张` },
        { label: "资料版本", value: counts.version },
      ]
    : [];

  return (
    <Page label="关于" title="内容和照片从哪来">
      {failed ? (
        <LoadFailed
          message="暂时打不开。"
          onRetry={() => {
            setFailed(false);
            load();
          }}
        />
      ) : counts === null ? (
        <Skeleton className="h-40 w-full" accessibilityLabel="正在加载" />
      ) : (
        <>
          <View>
            {rows.map((row, index) => (
              <View
                key={row.label}
                className={cn(
                  "flex-row items-center justify-between border-t-hairline border-border py-2.5",
                  index === rows.length - 1 && "border-b-hairline",
                )}
              >
                <Text variant="muted">{row.label}</Text>
                <Text className="font-bold">{row.value}</Text>
              </View>
            ))}
          </View>
          <View className="gap-2">
            <Text>每条资料都有来源，熊猫资料页底部的「资料来源」能打开原文。</Text>
            <Text>每张照片都写明作者和授权方式，在照片下面和照片查看器里。</Text>
            <Text>发现不对的地方，在资料页点「资料有误？纠错」。</Text>
          </View>
        </>
      )}
    </Page>
  );
}

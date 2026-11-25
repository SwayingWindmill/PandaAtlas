import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { View } from "react-native";

import { useStacked } from "@/components/grouped-list";
import { Icon } from "@/components/icon";
import { ScanFace, Sparkles } from "@/components/icons";
import { PandaThumb } from "@/components/panda-thumb";
import { PressScale } from "@/components/press-scale";
import { SectionHeader } from "@/components/section-header";
import { Text } from "@/components/ui/text";
import type { GameEntry } from "@/features/book/book";
import { loadDailyPanda } from "@/features/daily-panda/daily-panda";
import { loadGuestGames } from "@/features/engagement/guest-store";
import { localToday } from "@/features/engagement/seen";
import { pickStarStrip } from "@/features/explore/gallery-filter";
import { pandaIndexQueryOptions } from "@/features/pandas/pandas";
import { useSession } from "@/features/session/session";
import { authedApi } from "@/lib/api";
import { cn } from "@/lib/utils";

const TOTAL_CLUES = 4;

async function loadSignedInGames(): Promise<GameEntry[]> {
  const { data } = await authedApi.GET("/api/v2/me/panda-book");
  return data?.items ?? [];
}

/** Side-by-side daily interactive challenges promoted from buried Learn rows. */
export function DailyPlaySection() {
  const stacked = useStacked();
  const today = localToday();
  const { state: session } = useSession();

  const { data: daily } = useQuery({
    queryKey: ["explore", "daily-panda", today],
    queryFn: () => loadDailyPanda().catch(() => null),
    staleTime: 60_000,
  });

  const { data: games } = useQuery({
    queryKey:
      session.status === "signedIn"
        ? ["explore", "panda-book", session.accountId]
        : ["explore", "guest-games"],
    queryFn: () => (session.status === "signedIn" ? loadSignedInGames() : loadGuestGames()),
    enabled: session.status !== "loading",
    staleTime: 60_000,
  });

  const { data: pandas } = useQuery(pandaIndexQueryOptions());
  const previewPair = pandas ? pickStarStrip(pandas.filter((p) => p.hasFullBleedCover), [], 2) : [];

  const totalClues = daily?.clueCount ?? TOTAL_CLUES;
  const unlockedClues = daily ? Math.min(totalClues, Math.max(1, daily.clues.length)) : 1;
  const dailyStatus = daily?.solved ? "今日已猜中" : daily?.finished ? "今日已揭晓" : "今日待猜";

  const recognizedCount = games ? new Set(games.map((item) => item.pandaId)).size : 0;
  const guessSubtitle = recognizedCount > 0 ? `已认出 ${recognizedCount} 只` : "看照片认熊猫";

  return (
    <View className="gap-stack-tight">
      <SectionHeader
        title="每日一玩"
        action={{ label: "全部 4 项", href: "/play", accessibilityLabel: "趣味挑战" }}
      />
      <View className={stacked ? "gap-row" : "flex-row gap-row"}>
        <PressScale
          role="button"
          accessibilityLabel={`每日一猫，${dailyStatus}，从线索猜今日主角`}
          onPress={() => router.push("/daily")}
          containerStyle={stacked ? undefined : { flex: 1 }}
          className="min-w-0 justify-between gap-3 rounded-group border-hairline border-border bg-card p-3.5"
        >
          <View className="gap-0.5">
            <View className="flex-row items-center gap-1.5">
              <Icon icon={Sparkles} size="footnote" tone="tint" strokeWidth={2} />
              <Text variant="headline" numberOfLines={1}>
                每日一猫
              </Text>
            </View>
            <Text
              variant="footnote"
              className={cn(daily?.solved ? "font-semibold text-primary" : "text-muted-foreground")}
              numberOfLines={1}
            >
              {dailyStatus}
            </Text>
          </View>

          <View className="flex-row items-center justify-between gap-2">
            <Text variant="footnote" className="min-w-0 flex-1 font-medium text-primary" numberOfLines={1}>
              猜今日主角
            </Text>
            <View className="shrink-0 flex-row items-center gap-1" aria-hidden>
              {Array.from({ length: totalClues }, (_, index) => (
                <View
                  key={index}
                  className={cn(
                    "size-2 rounded-full",
                    index < unlockedClues ? "bg-primary" : "bg-border",
                  )}
                />
              ))}
            </View>
          </View>
        </PressScale>

        <PressScale
          role="button"
          accessibilityLabel={`猜熊猫，${guessSubtitle}`}
          onPress={() => router.push("/guess")}
          containerStyle={stacked ? undefined : { flex: 1 }}
          className="min-w-0 justify-between gap-3 rounded-group border-hairline border-border bg-card p-3.5"
        >
          <View className="flex-row items-center justify-between gap-2">
            <View className="min-w-0 flex-1 gap-0.5">
              <View className="flex-row items-center gap-1.5">
                <Icon icon={ScanFace} size="footnote" tone="tint" strokeWidth={2} />
                <Text variant="headline" numberOfLines={1}>
                  猜熊猫
                </Text>
              </View>
              <Text variant="footnote" className="text-muted-foreground tabular-nums" numberOfLines={1}>
                {guessSubtitle}
              </Text>
            </View>
            {previewPair.length > 0 ? (
              <View className="shrink-0 flex-row items-center pr-1" aria-hidden>
                {previewPair.map((panda, index) => (
                  <View
                    key={panda.id}
                    style={{
                      marginLeft: index > 0 ? -10 : 0,
                      transform: [{ rotate: index === 0 ? "-7deg" : "7deg" }],
                    }}
                  >
                    <PandaThumb pandaId={panda.id} name={panda.name} size={30} shape="tile" />
                  </View>
                ))}
              </View>
            ) : null}
          </View>

          <Text variant="footnote" className="font-medium text-primary" numberOfLines={1}>
            看照片辨脸
          </Text>
        </PressScale>
      </View>
    </View>
  );
}

import { router } from "expo-router";
import { View } from "react-native";

import { ListCell, ListSection } from "@/components/grouped-list";
import { Icon } from "@/components/icon";
import { Check } from "@/components/icons";
import { LoadFailed } from "@/components/load-failed";
import { Page } from "@/components/page";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import {
  Attempts,
  ClueTile,
  DailyCheckinRow,
  GuessHistoryList,
  MysteryCard,
  SectionLabel,
  pairs,
  shortDate,
} from "@/features/daily-panda/daily-panda-views";
import { useDailyPanda } from "@/features/daily-panda/use-daily-panda";
import { openPanda } from "@/features/pandas/panda-row";
import { SearchField } from "@/features/pandas/search-field";

const TITLE = "今天是哪只熊猫？";
const LABEL = "每日一猫";

export default function DailyPandaScreen() {
  const {
    state,
    loadFailed,
    retry,
    guessFailed,
    pending,
    search,
    setSearch,
    openedWith,
    savedToBook,
    signedOut,
    checkin,
    pandasById,
    matches,
    answer,
    answerPhoto,
    choose,
    share,
  } = useDailyPanda();

  if (!state) {
    return (
      <Page label={LABEL} title={TITLE}>
        {loadFailed ? (
          <LoadFailed message="今天的每日一猫暂时打不开。" onRetry={retry} />
        ) : (
          <View className="gap-row" accessibilityLabel="正在加载每日一猫">
            <Skeleton className="h-6 w-32 rounded-pill" />
            <Skeleton className="w-full rounded-card" style={{ aspectRatio: 4 / 3 }} />
            <Skeleton className="h-11 w-full rounded-control" />
          </View>
        )}
      </Page>
    );
  }

  const slots = Array.from({ length: state.clueCount }, (_, index) => ({ index, clue: state.clues[index] }));

  return (
    <Page label={LABEL} title={TITLE} keyboardShouldPersistTaps="handled">
      <View className="gap-row">
        <View className="flex-row flex-wrap items-center justify-between gap-stack-tight">
          <View className="rounded-pill bg-secondary px-stack-tight py-hair-gap">
            <Text
              variant="footnote"
              className="font-semibold tabular-nums"
            >{`今天　${shortDate(state.puzzleDate)}`}</Text>
          </View>
          <Attempts state={state} />
        </View>
        <MysteryCard state={state} answerName={answer?.name} answerPhoto={answerPhoto} />
        {state.finished && answerPhoto?.credit ? (
          <Text variant="footnote" className="px-inset text-muted-foreground" numberOfLines={2}>
            {`照片：${answerPhoto.credit}`}
          </Text>
        ) : null}
      </View>

      {state.finished ? (
        <View className="gap-stack-tight">
          {savedToBook ? (
            <View className="flex-row items-center justify-center gap-hair-gap">
              <Icon icon={Check} size="footnote" tone="tint" />
              <Text variant="footnote" className="text-primary">
                已收进图鉴
              </Text>
            </View>
          ) : null}
          <Button onPress={share}>
            <Text>分享结果</Text>
          </Button>
          {state.answer ? (
            <Button variant="tinted" onPress={() => openPanda(state.answer!.canonicalSlug)}>
              <Text>{answer ? `看${answer.name}的资料` : "看资料"}</Text>
            </Button>
          ) : null}
          {!savedToBook && signedOut ? (
            <Button variant="plain" onPress={() => router.push("/sign-in")}>
              <Text>登录，收进图鉴</Text>
            </Button>
          ) : null}
          <Text variant="footnote" className="text-center text-muted-foreground">
            明天 0:00（北京时间）换新的一只
          </Text>
        </View>
      ) : (
        <View className="gap-stack-tight">
          <SearchField
            value={search}
            onChange={setSearch}
            label="猜一只熊猫"
            placeholder="输入你猜的熊猫名字"
            editable={!pending}
          />
          {search.trim() !== "" && matches.length === 0 ? (
            <Text variant="footnote" className="px-inset text-muted-foreground">
              没有找到这只熊猫
            </Text>
          ) : null}
          {matches.length > 0 ? (
            <ListSection>
              {matches.map((panda, index) => (
                <ListCell
                  key={panda.id}
                  label={panda.name}
                  meta={panda.alternateName ?? undefined}
                  onPress={() => choose(panda.id)}
                  last={index === matches.length - 1}
                />
              ))}
            </ListSection>
          ) : null}
          {guessFailed ? (
            <Text variant="footnote" className="px-inset text-destructive">
              这次没能提交，请再猜一次。
            </Text>
          ) : null}
        </View>
      )}

      <View className="gap-stack-tight">
        <SectionLabel trailing={`${state.clues.length} / ${state.clueCount}`}>线索</SectionLabel>
        <View className="gap-row">
          {pairs(slots).map((row) => (
            <View key={row[0]!.index} className="flex-row gap-row">
              {row.map(({ index, clue }) => (
                <ClueTile
                  key={`${index}-${clue ? "open" : "locked"}`}
                  clue={clue}
                  index={index}
                  fresh={index >= openedWith}
                />
              ))}
              {row.length === 1 ? <View className="flex-1" /> : null}
            </View>
          ))}
        </View>
      </View>

      <GuessHistoryList guesses={state.guesses} pandasById={pandasById} />
      <DailyCheckinRow checkin={checkin} />
    </Page>
  );
}

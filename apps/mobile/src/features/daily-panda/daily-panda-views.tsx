import { Image } from "expo-image";
import { StyleSheet, View } from "react-native";
import Animated from "react-native-reanimated";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";
import { useCSSVariable } from "uniwind";

import { ListCell, ListSection } from "@/components/grouped-list";
import { Icon } from "@/components/icon";
import {
  Cake,
  CalendarHeart,
  Check,
  Flower,
  HeartPulse,
  Lock,
  type LucideIcon,
  MapPin,
  Mars,
  Photo,
  Type,
  Venus,
  X,
} from "@/components/icons";
import { PhotoOutline } from "@/components/photo-outline";
import { Scrim } from "@/components/scrim";
import { Text } from "@/components/ui/text";
import { PAGE_ENTER } from "@/design/motion";
import type { CheckinSummary } from "@/features/checkin/checkin";
import {
  type DailyPandaClue,
  type DailyPandaState,
  type PandaChoice,
  feedbackParts,
} from "@/features/daily-panda/daily-panda";
import type { HeroPhoto } from "@/features/institutions/institution-hero";
import { HAIRLINE, RADIUS } from "@/lib/surface";
import { cn } from "@/lib/utils";

/** "2026-10-26" -> "10月26日" */
export function shortDate(isoDate: string): string {
  const [, month, day] = isoDate.split("-").map(Number);
  return `${month}月${day}日`;
}

export function pairs<T>(items: readonly T[]): T[][] {
  const rows: T[][] = [];
  for (let start = 0; start < items.length; start += 2) rows.push(items.slice(start, start + 2));
  return rows;
}

function clueGlyph(clue: DailyPandaClue): LucideIcon {
  switch (clue.kind) {
    case "sex":
      return clue.value === "female" ? Venus : Mars;
    case "birth_year":
      return Cake;
    case "life_status":
      return clue.value === "alive" ? HeartPulse : Flower;
    case "birthplace":
      return MapPin;
    case "name_initial":
      return Type;
    case "photo":
      return Photo;
  }
}

/**
 * The mystery card before any photo: shows the newest unlocked text clue over a gradient plate,
 * never a progress meter or blurred image.
 */
function NewestClue({ state }: { state: DailyPandaState }) {
  const newest = state.clues
    .flatMap((clue) => (clue.kind === "photo" ? [] : [clue]))
    .at(-1);
  const count = `已解锁 ${state.clues.length} / ${state.clueCount} 条`;
  return (
    <View className="flex-1 justify-center gap-stack-tight p-stack">
      <Text variant="display" className={newest ? undefined : "text-primary"}>
        {newest ? newest.text : "?"}
      </Text>
      <Text variant="footnote" className="text-muted-foreground tabular-nums">
        {newest ? `${newest.label}　·　${count}` : count}
      </Text>
      <Text variant="subheadline" className="text-muted-foreground">
        猜错一次，多一条线索
      </Text>
    </View>
  );
}

function Plate({ id }: { id: string }) {
  const [tint, ground] = useCSSVariable(["--color-highlight-soft", "--color-card"]);
  return (
    <Svg aria-hidden style={StyleSheet.absoluteFill} width="100%" height="100%" preserveAspectRatio="none">
      <Defs>
        <LinearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor={String(tint)} stopOpacity={1} />
          <Stop offset="1" stopColor={String(ground)} stopOpacity={1} />
        </LinearGradient>
      </Defs>
      <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${id})`} />
    </Svg>
  );
}

export function MysteryCard({
  state,
  answerName,
  answerPhoto,
}: {
  state: DailyPandaState;
  answerName: string | undefined;
  answerPhoto: HeroPhoto | null | undefined;
}) {
  const photo = state.clues.find((clue) => clue.kind === "photo");
  const photoUrl =
    (state.finished ? answerPhoto?.url : undefined) ?? (photo?.kind === "photo" ? photo.imageUrl : undefined);
  const result = state.solved ? `第 ${state.guesses.length} 次猜中` : "这次没猜中";

  return (
    <View
      className="overflow-hidden rounded-card bg-card"
      // A photo keeps 4:3; the clue plate grows with its text so large type never clips.
      style={photoUrl || state.finished ? { aspectRatio: 4 / 3, borderCurve: "continuous" } : { minHeight: 240, borderCurve: "continuous" }}
      accessibilityLiveRegion="polite"
    >
      {photoUrl ? (
        <Image
          source={photoUrl}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          transition={250}
          accessibilityLabel={state.finished ? `${answerName ?? "今天的熊猫"}的照片` : "照片线索"}
        />
      ) : (
        <Plate id="daily-plate" />
      )}

      {state.finished ? (
        <>
          {photoUrl ? <Scrim id="daily-scrim" height="60%" /> : null}
          <View className="absolute right-0 bottom-0 left-0 gap-hair-gap p-inset">
            <Text variant="display" className={photoUrl ? "text-on-media" : undefined} numberOfLines={2}>
              {answerName ?? "这只熊猫"}
            </Text>
            <View className="flex-row items-center gap-hair-gap">
              <Icon
                icon={state.solved ? Check : X}
                size="footnote"
                tone={photoUrl ? "onMedia" : "secondary"}
                strokeWidth={2.5}
              />
              <Text
                variant="subheadline"
                className={cn(
                  "font-semibold",
                  photoUrl ? "text-on-media" : state.solved ? "text-primary" : "text-muted-foreground",
                )}
              >
                {result}
              </Text>
            </View>
          </View>
        </>
      ) : photoUrl ? (
        <View className="absolute top-0 left-0 p-inset">
          <View className="flex-row items-center gap-hair-gap rounded-pill bg-glass-fallback px-stack-tight py-hair-gap">
            <Icon icon={Photo} size="footnote" tone="onMedia" />
            <Text variant="footnote" className="font-semibold text-on-media">
              照片线索
            </Text>
          </View>
        </View>
      ) : (
        <NewestClue state={state} />
      )}
      {photoUrl ? <PhotoOutline radius={RADIUS.card} /> : null}
    </View>
  );
}

export function Attempts({ state }: { state: DailyPandaState }) {
  const left = state.maxGuesses - state.guesses.length;
  const label = state.finished ? `用了 ${state.guesses.length} / ${state.maxGuesses} 次` : `还剩 ${left} 次`;
  return (
    <View className="flex-row items-center gap-stack-tight" accessible accessibilityLabel={label}>
      <View className="flex-row gap-hair-gap">
        {Array.from({ length: state.maxGuesses }, (_, index) => {
          const guess = state.guesses[index];
          return (
            <View
              key={index}
              className={cn(
                "h-2 w-4 rounded-pill",
                guess === undefined ? "bg-secondary" : guess.correct ? "bg-primary" : "bg-muted-foreground",
              )}
            />
          );
        })}
      </View>
      <Text variant="footnote" className="text-muted-foreground tabular-nums">
        {label}
      </Text>
    </View>
  );
}

export function ClueTile({ clue, index, fresh }: { clue: DailyPandaClue | undefined; index: number; fresh: boolean }) {
  const [glyph] = useCSSVariable(["--color-highlight-foreground"]);
  if (clue === undefined) {
    return (
      <View
        className="min-h-24 flex-1 justify-between gap-stack-tight rounded-tile border border-dashed border-border p-inset"
        style={{ borderCurve: "continuous" }}
        accessible
        accessibilityLabel={`第 ${index + 1} 条线索，猜错一次解锁`}
      >
        <View className="size-8 items-start justify-center">
          <Icon icon={Lock} size="body" tone="tertiary" />
        </View>
        <Text variant="footnote" className="text-muted-foreground">
          猜错解锁
        </Text>
      </View>
    );
  }
  const label = clue.kind === "photo" ? "照片" : clue.label;
  const text = clue.kind === "photo" ? "在上面的卡片里" : clue.text;
  return (
    <Animated.View
      // Only a clue unlocked on this visit arrives; the ones already open on load are just there.
      entering={fresh ? PAGE_ENTER : undefined}
      className="min-h-24 flex-1 justify-between gap-stack-tight rounded-group bg-card p-inset"
      style={{ borderCurve: "continuous" }}
      accessible
      accessibilityLabel={`${label}：${text}`}
    >
      <View className="size-8 items-start justify-center">
        <Icon icon={clueGlyph(clue)} size="body" color={String(glyph)} />
      </View>
      <View className="gap-hair-gap">
        <Text variant="footnote" className="text-muted-foreground">
          {label}
        </Text>
        <Text variant={clue.kind === "name_initial" ? "title" : "headline"} numberOfLines={2}>
          {text}
        </Text>
      </View>
    </Animated.View>
  );
}

export function SectionLabel({ children, trailing }: { children: string; trailing?: string }) {
  return (
    <View className="flex-row items-baseline justify-between px-inset">
      <Text variant="footnote" className="font-semibold text-muted-foreground">
        {children}
      </Text>
      {trailing ? (
        <Text variant="footnote" className="text-muted-foreground tabular-nums">
          {trailing}
        </Text>
      ) : null}
    </View>
  );
}

export function GuessHistoryList({
  guesses,
  pandasById,
}: {
  guesses: DailyPandaState["guesses"];
  pandasById: Map<string, PandaChoice>;
}) {
  if (guesses.length === 0) return null;
  return (
    <View className="gap-stack-tight">
      <SectionLabel>你猜过</SectionLabel>
      <View className="overflow-hidden rounded-group bg-card" style={{ borderCurve: "continuous" }}>
        {guesses.map((guess, index) => (
          <View key={guess.pandaId}>
            {index > 0 ? <View className="ml-inset bg-border" style={{ height: HAIRLINE }} /> : null}
            <View className="min-h-11 flex-row gap-row px-inset py-row">
              <View
                className={cn(
                  "size-7 items-center justify-center rounded-pill",
                  guess.correct ? "bg-highlight-soft" : "bg-secondary",
                )}
              >
                <Icon
                  icon={guess.correct ? Check : X}
                  size="footnote"
                  tone={guess.correct ? "tint" : "secondary"}
                  strokeWidth={2.5}
                />
              </View>
              <View className="flex-1 gap-stack-tight">
                <Text variant="headline">{pandasById.get(guess.pandaId)?.name ?? guess.pandaId}</Text>
                {guess.correct ? (
                  <Text variant="footnote" className="font-semibold text-primary">
                    就是它
                  </Text>
                ) : (
                  <View className="flex-row flex-wrap gap-stack-tight">
                    {feedbackParts(guess).map((part) => (
                      <View key={part} className="rounded-pill bg-secondary px-stack-tight py-hair-gap">
                        <Text variant="footnote" className="text-muted-foreground">
                          {part}
                        </Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

export function DailyCheckinRow({ checkin }: { checkin: CheckinSummary | null }) {
  if (!checkin) return null;
  return (
    <ListSection>
      <ListCell
        icon={CalendarHeart}
        label="每日打卡"
        detail="今天来过了"
        meta={`累计 ${checkin.totalVisitDays.toLocaleString("zh-CN")} 天`}
        href="/checkin"
        last
      />
    </ListSection>
  );
}

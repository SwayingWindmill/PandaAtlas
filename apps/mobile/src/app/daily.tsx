import { Image } from "expo-image";
import { router } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Platform, Share, StyleSheet, View } from "react-native";
import Animated from "react-native-reanimated";
import Svg, { Defs, LinearGradient, Path, Rect, Stop } from "react-native-svg";
import { useCSSVariable } from "uniwind";

import { ListCell, ListSection } from "@/components/grouped-list";
import { Icon } from "@/components/icon";
import {
  Cake,
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
import { LoadFailed } from "@/components/load-failed";
import { Page } from "@/components/page";
import { PhotoOutline } from "@/components/photo-outline";
import { Scrim } from "@/components/scrim";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import { CONTENT_ENTER } from "@/design/motion";
import {
  feedbackParts,
  guessDailyPanda,
  loadDailyPanda,
  loadPandaChoices,
  saveDailyResult,
  type DailyPandaClue,
  type DailyPandaState,
  type PandaChoice,
} from "@/features/daily-panda/daily-panda";
import { type HeroPhoto, useInstitutionHero } from "@/features/institutions/institution-hero";
import { openPanda } from "@/features/pandas/panda-row";
import { SearchField } from "@/features/pandas/search-field";
import { useSession } from "@/features/session/session";
import { selectionHaptic, successHaptic } from "@/lib/haptics";
import { HAIRLINE, RADIUS } from "@/lib/surface";
import { cn } from "@/lib/utils";

const MAX_MATCHES = 8;
const TITLE = "今天是哪只熊猫？";
const LABEL = "每日一猫";

/** A clue that arrives after a wrong guess rises into place; on web an entering view would overlap its neighbours. */
const REVEAL = Platform.OS === "web" ? undefined : CONTENT_ENTER;

/** "2026-10-26" -> "10月26日" */
function shortDate(isoDate: string): string {
  const [, month, day] = isoDate.split("-").map(Number);
  return `${month}月${day}日`;
}

function pairs<T>(items: readonly T[]): T[][] {
  const rows: T[][] = [];
  for (let start = 0; start < items.length; start += 2) rows.push(items.slice(start, start + 2));
  return rows;
}

/** The glyph that names what a clue is about: the symbol for its sex, a cake for its birth, a pin for where. */
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
 * The ring on the mystery card: one arc per clue, filled in the tint as each one is unlocked, the way
 * Activity closes a ring. It shows how much of the panda is known without showing any of the panda.
 */
function ClueRing({ total, unlocked }: { total: number; unlocked: number }) {
  const [tint, rest] = useCSSVariable(["--color-primary", "--color-border"]);
  const size = 132;
  const radius = 58;
  const centre = size / 2;
  const gap = total > 1 ? 14 : 0;
  const arcs = Array.from({ length: total }, (_, index) => {
    const span = 360 / total;
    const from = ((-90 + index * span + gap / 2) * Math.PI) / 180;
    const to = ((-90 + (index + 1) * span - gap / 2) * Math.PI) / 180;
    const point = (angle: number) => `${centre + radius * Math.cos(angle)} ${centre + radius * Math.sin(angle)}`;
    const large = span - gap > 180 ? 1 : 0;
    return { d: `M ${point(from)} A ${radius} ${radius} 0 ${large} 1 ${point(to)}`, on: index < unlocked };
  });
  return (
    <View style={{ width: size, height: size }} className="items-center justify-center">
      <Svg style={StyleSheet.absoluteFill} width={size} height={size}>
        {arcs.map((arc, index) => (
          <Path
            key={index}
            d={arc.d}
            stroke={String(arc.on ? tint : rest)}
            strokeWidth={8}
            strokeLinecap="round"
            fill="none"
          />
        ))}
      </Svg>
      <Text variant="display" className="text-primary">
        ?
      </Text>
    </View>
  );
}

/** A soft plate in the brand's tint, for the card before any photo is known and for a panda without one. */
function Plate({ id }: { id: string }) {
  const [tint, ground] = useCSSVariable(["--color-highlight-soft", "--color-card"]);
  return (
    <Svg style={StyleSheet.absoluteFill} width="100%" height="100%" preserveAspectRatio="none">
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

/**
 * The card at the top. Before the photo clue is unlocked the app has no picture of the panda at all,
 * so the card is a plate with the clue ring, never a blurred photo that could be read. Once the photo
 * clue arrives it shows that photo. Once the day is over it shows the answer's reviewed cover (or the
 * photo clue, or the plate when there is neither) with the answer's name.
 */
function MysteryCard({
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
      style={{ aspectRatio: 4 / 3, borderCurve: "continuous" }}
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
            <Text
              variant="footnote"
              className={cn("font-semibold", photoUrl ? "text-white/85" : "text-muted-foreground")}
            >
              今天的答案
            </Text>
            <Text variant="display" className={photoUrl ? "text-white" : undefined} numberOfLines={2}>
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
                  photoUrl ? "text-white" : state.solved ? "text-primary" : "text-muted-foreground",
                )}
              >
                {result}
              </Text>
            </View>
          </View>
        </>
      ) : photoUrl ? (
        <View className="absolute top-0 left-0 p-inset">
          <View className="flex-row items-center gap-hair-gap rounded-pill bg-black/45 px-stack-tight py-hair-gap">
            <Icon icon={Photo} size="footnote" tone="onMedia" />
            <Text variant="footnote" className="font-semibold text-white">
              照片线索
            </Text>
          </View>
        </View>
      ) : (
        <View className="flex-1 items-center justify-center gap-stack-tight p-inset">
          <ClueRing total={state.clueCount} unlocked={state.clues.length} />
          <View className="items-center gap-hair-gap">
            <Text variant="headline">猜错一次，多一条线索</Text>
            <Text variant="footnote" className="text-muted-foreground tabular-nums">
              {`已解锁 ${state.clues.length} / ${state.clueCount} 条`}
            </Text>
          </View>
        </View>
      )}
      {photoUrl ? <PhotoOutline radius={RADIUS.card} /> : null}
    </View>
  );
}

/**
 * The guesses as a row of capsules, as Fitness counts sets: spent ones in the label tint, the right
 * one in the brand tint, the rest empty. The count beside it is the one line the field reads.
 */
function Attempts({ state }: { state: DailyPandaState }) {
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

/** One clue as a tile: its glyph on a soft tint, what it is about, and the fact itself. */
function ClueTile({ clue, index }: { clue: DailyPandaClue | undefined; index: number }) {
  const [glyph] = useCSSVariable(["--color-highlight-foreground"]);
  if (clue === undefined) {
    return (
      <View
        className="min-h-24 flex-1 justify-between gap-stack-tight rounded-tile border border-dashed border-border p-inset"
        style={{ borderCurve: "continuous" }}
        accessible
        accessibilityLabel={`第 ${index + 1} 条线索，猜错一次解锁`}
      >
        <View className="size-8 items-center justify-center rounded-pill bg-secondary">
          <Icon icon={Lock} size="footnote" tone="tertiary" />
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
      entering={REVEAL}
      className="min-h-24 flex-1 justify-between gap-stack-tight rounded-tile bg-card p-inset"
      style={{ borderCurve: "continuous" }}
      accessible
      accessibilityLabel={`${label}：${text}`}
    >
      <View className="size-8 items-center justify-center rounded-pill bg-highlight-soft">
        <Icon icon={clueGlyph(clue)} size="footnote" color={String(glyph)} strokeWidth={2} />
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

function SectionLabel({ children, trailing }: { children: string; trailing?: string }) {
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

export default function DailyPandaScreen() {
  const [state, setState] = useState<DailyPandaState | null>(null);
  const [pandas, setPandas] = useState<PandaChoice[]>([]);
  const [loadFailed, setLoadFailed] = useState(false);
  const [guessFailed, setGuessFailed] = useState(false);
  const [pending, setPending] = useState(false);
  const [search, setSearch] = useState("");

  const load = useCallback(() => {
    Promise.all([loadDailyPanda(), loadPandaChoices()])
      .then(([puzzle, choices]) => {
        setState(puzzle);
        setPandas(choices);
      })
      .catch(() => setLoadFailed(true));
  }, []);
  useEffect(load, [load]);

  function retry() {
    setLoadFailed(false);
    load();
  }

  // A finished puzzle joins the signed-in fan's 图鉴; saving the same day again changes nothing.
  const { state: session } = useSession();
  const accountId = session.status === "signedIn" ? session.accountId : null;
  const [savedFor, setSavedFor] = useState<string | null>(null);
  useEffect(() => {
    if (!state?.finished || accountId === null) return;
    let active = true;
    void saveDailyResult(state).then((saved) => {
      if (active && saved) setSavedFor(`${accountId}:${state.puzzleDate}`);
    });
    return () => {
      active = false;
    };
  }, [state, accountId]);
  const savedToBook = state !== null && accountId !== null && savedFor === `${accountId}:${state.puzzleDate}`;

  const pandasById = useMemo(() => new Map(pandas.map((panda) => [panda.id, panda])), [pandas]);
  const guessedIds = useMemo(() => new Set(state?.guesses.map((guess) => guess.pandaId)), [state]);
  const matches = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (query === "") return [];
    return pandas
      .filter((panda) => !guessedIds.has(panda.id))
      .filter((panda) =>
        [panda.name, panda.alternateName ?? "", panda.slug].some((value) => value.toLowerCase().includes(query)),
      )
      .slice(0, MAX_MATCHES);
  }, [guessedIds, pandas, search]);

  // The answer's cover is asked for only once the day is over, and only from the reviewed list.
  const answerId = state?.finished ? state.answer?.pandaId : undefined;
  const answerPhoto = useInstitutionHero(
    answerId ? [{ id: answerId, name: pandasById.get(answerId)?.name ?? "今天的熊猫" }] : null,
  );

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

  const current = state;
  const answer = current.answer ? pandasById.get(current.answer.pandaId) : undefined;

  function choose(pandaId: string) {
    if (current.finished || pending) return;
    setSearch("");
    setPending(true);
    setGuessFailed(false);
    guessDailyPanda(current, [...current.guesses.map((guess) => guess.pandaId), pandaId])
      .then((next) => {
        if (next.guesses.at(-1)?.correct) successHaptic();
        else selectionHaptic();
        setState(next);
      })
      .catch(() => setGuessFailed(true))
      .finally(() => setPending(false));
  }

  function share() {
    const marks = current.guesses.map((guess) => (guess.correct ? "🟩" : "🟥")).join("");
    const score = current.solved ? `${current.guesses.length}/${current.maxGuesses}` : `X/${current.maxGuesses}`;
    void Share.share({ message: `吱熊猫 每日一猫 ${current.puzzleDate} ${score}\n${marks}` });
  }

  const slots = Array.from({ length: current.clueCount }, (_, index) => ({ index, clue: current.clues[index] }));

  return (
    <Page label={LABEL} title={TITLE} keyboardShouldPersistTaps="handled">
      <View className="gap-row">
        <View className="flex-row flex-wrap items-center justify-between gap-stack-tight">
          {/* 笋金 marks today, once on the screen. */}
          <View className="rounded-pill bg-warm-soft px-stack-tight py-hair-gap">
            <Text
              variant="footnote"
              className="font-semibold text-warm"
            >{`今天　${shortDate(current.puzzleDate)}`}</Text>
          </View>
          <Attempts state={current} />
        </View>
        <MysteryCard state={current} answerName={answer?.name} answerPhoto={answerPhoto} />
        {current.finished && answerPhoto?.credit ? (
          <Text variant="footnote" className="px-inset text-muted-foreground" numberOfLines={2}>
            {`照片：${answerPhoto.credit}`}
          </Text>
        ) : null}
      </View>

      {current.finished ? (
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
          {current.answer ? (
            <Button variant="tinted" onPress={() => openPanda(current.answer!.canonicalSlug)}>
              <Text>{answer ? `看${answer.name}的资料` : "看资料"}</Text>
            </Button>
          ) : null}
          {!savedToBook && session.status === "signedOut" ? (
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
        <SectionLabel trailing={`${current.clues.length} / ${current.clueCount}`}>线索</SectionLabel>
        <View className="gap-row">
          {pairs(slots).map((row) => (
            <View key={row[0]!.index} className="flex-row gap-row">
              {row.map(({ index, clue }) => (
                <ClueTile key={`${index}-${clue ? "open" : "locked"}`} clue={clue} index={index} />
              ))}
              {row.length === 1 ? <View className="flex-1" /> : null}
            </View>
          ))}
        </View>
      </View>

      {current.guesses.length > 0 ? (
        <View className="gap-stack-tight">
          <SectionLabel>你猜过</SectionLabel>
          <View className="overflow-hidden rounded-group bg-card" style={{ borderCurve: "continuous" }}>
            {current.guesses.map((guess, index) => (
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
      ) : null}
    </Page>
  );
}

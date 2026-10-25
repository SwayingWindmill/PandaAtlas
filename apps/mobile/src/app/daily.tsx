import { Image } from "expo-image";
import * as Linking from "expo-linking";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Share, StyleSheet, Text, TextInput, View } from "react-native";

import {
  feedbackText,
  guessDailyPanda,
  loadDailyPanda,
  loadPandaChoices,
  type DailyPandaState,
  type PandaChoice,
} from "@/features/daily-panda/daily-panda";
import { colors, radius } from "@/lib/theme";

const MAX_MATCHES = 8;

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

  const pandasById = useMemo(() => new Map(pandas.map((panda) => [panda.id, panda])), [pandas]);
  const guessedIds = useMemo(() => new Set(state?.guesses.map((guess) => guess.pandaId)), [state]);
  const matches = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (query === "") return [];
    return pandas
      .filter((panda) => !guessedIds.has(panda.id))
      .filter((panda) => [panda.name, panda.alternateName ?? "", panda.slug].some((value) => value.toLowerCase().includes(query)))
      .slice(0, MAX_MATCHES);
  }, [guessedIds, pandas, search]);

  if (!state) {
    return (
      <View style={styles.center}>
        {loadFailed ? (
          <>
            <Text style={styles.body}>今天的每日一猫暂时不可用，请稍后再来。</Text>
            <Pressable style={styles.button} onPress={retry} accessibilityRole="button">
              <Text style={styles.buttonText}>重试</Text>
            </Pressable>
          </>
        ) : (
          <ActivityIndicator color={colors.accent} accessibilityLabel="正在准备今天的熊猫" />
        )}
      </View>
    );
  }

  const current = state;
  const left = current.maxGuesses - current.guesses.length;
  const answer = current.answer ? pandasById.get(current.answer.pandaId) : undefined;

  function choose(pandaId: string) {
    if (current.finished || pending) return;
    setSearch("");
    setPending(true);
    setGuessFailed(false);
    guessDailyPanda(current, [...current.guesses.map((guess) => guess.pandaId), pandaId])
      .then(setState)
      .catch(() => setGuessFailed(true))
      .finally(() => setPending(false));
  }

  function share() {
    const marks = current.guesses.map((guess) => (guess.correct ? "🟩" : "🟥")).join("");
    const score = current.solved ? `${current.guesses.length}/${current.maxGuesses}` : `X/${current.maxGuesses}`;
    void Share.share({ message: `吱熊猫 每日一猫 ${current.puzzleDate} ${score}\n${marks}` });
  }

  return (
    <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
      <View style={styles.headerRow}>
        <Text style={styles.title}>{current.puzzleDate} 的熊猫</Text>
        {!current.finished ? <Text style={styles.muted}>还能猜 {left} 次</Text> : null}
      </View>

      <View style={styles.clues}>
        {Array.from({ length: current.clueCount }, (_, index) => {
          const clue = current.clues[index];
          if (clue === undefined) {
            return (
              <View key={index} style={[styles.clue, styles.locked]}>
                <Text style={styles.muted}>🔒 猜错一次解锁</Text>
              </View>
            );
          }
          if (clue.kind === "photo") {
            return (
              <Image
                key={index}
                source={clue.imageUrl}
                style={styles.photo}
                contentFit="cover"
                accessibilityLabel="TA 的公开照片"
              />
            );
          }
          return (
            <View key={index} style={styles.clue}>
              <Text style={styles.clueText}>{clue.text}</Text>
            </View>
          );
        })}
      </View>

      {current.finished ? (
        <View style={styles.card} accessibilityLiveRegion="polite">
          <Text style={styles.resultTitle}>{current.solved ? `猜对了！用了 ${current.guesses.length} 次。` : "这次没猜出来。"}</Text>
          {answer ? <Text style={styles.body}>今天的熊猫是{answer.name}。</Text> : null}
          <View style={styles.actions}>
            {current.answer ? (
              <Pressable
                style={styles.button}
                accessibilityRole="link"
                onPress={() => void Linking.openURL(`https://zhipanda.com/zh/pandas/${current.answer!.canonicalSlug}`)}
              >
                <Text style={styles.buttonText}>打开熊猫资料</Text>
              </Pressable>
            ) : null}
            <Pressable style={styles.secondaryButton} onPress={share} accessibilityRole="button">
              <Text style={styles.secondaryButtonText}>分享结果</Text>
            </Pressable>
          </View>
          <Text style={styles.muted}>明天 0 点（北京时间）换一只新熊猫。</Text>
        </View>
      ) : (
        <View style={styles.card}>
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="输入熊猫名字"
            placeholderTextColor={colors.muted}
            editable={!pending}
            autoCorrect={false}
            accessibilityLabel="猜一只熊猫"
            style={styles.input}
          />
          {search.trim() !== "" && matches.length === 0 ? <Text style={styles.muted}>没有找到这只熊猫</Text> : null}
          {matches.map((panda) => (
            <Pressable key={panda.id} style={styles.match} onPress={() => choose(panda.id)} accessibilityRole="button">
              <Text style={styles.matchName}>{panda.name}</Text>
              {panda.alternateName ? <Text style={styles.muted}>{panda.alternateName}</Text> : null}
            </Pressable>
          ))}
          {guessFailed ? <Text style={styles.error}>这次没能提交，请再试一次。</Text> : null}
        </View>
      )}

      {current.guesses.length > 0 ? (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>你猜过的</Text>
          {current.guesses.map((guess) => (
            <View key={guess.pandaId} style={styles.guess}>
              <Text style={styles.matchName}>
                {guess.correct ? "✓ " : "✕ "}
                {pandasById.get(guess.pandaId)?.name ?? guess.pandaId}
              </Text>
              {!guess.correct ? <Text style={styles.muted}>{feedbackText(guess)}</Text> : null}
            </View>
          ))}
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { padding: 20, gap: 16 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 16 },
  headerRow: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", flexWrap: "wrap", gap: 8 },
  title: { color: colors.ink, fontSize: 22, fontWeight: "700" },
  body: { color: colors.ink, fontSize: 16, lineHeight: 24 },
  muted: { color: colors.muted, fontSize: 14 },
  error: { color: colors.danger, fontSize: 14 },
  clues: { gap: 10 },
  clue: { minHeight: 48, justifyContent: "center", borderWidth: 1, borderColor: colors.line, borderRadius: radius.control, backgroundColor: colors.surface, paddingHorizontal: 16, paddingVertical: 12 },
  locked: { borderStyle: "dashed", backgroundColor: "transparent" },
  clueText: { color: colors.ink, fontSize: 16, fontWeight: "600" },
  photo: { width: "100%", aspectRatio: 4 / 3, borderRadius: radius.control, backgroundColor: colors.line },
  card: { backgroundColor: colors.surface, borderColor: colors.line, borderWidth: 1, borderRadius: radius.card, padding: 18, gap: 10 },
  input: { borderWidth: 1, borderColor: colors.line, borderRadius: radius.control, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, color: colors.ink },
  match: { paddingVertical: 10, paddingHorizontal: 4, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
  matchName: { color: colors.ink, fontSize: 16, fontWeight: "600" },
  sectionTitle: { color: colors.ink, fontSize: 16, fontWeight: "700" },
  guess: { borderWidth: 1, borderColor: colors.line, borderRadius: radius.control, padding: 12, gap: 2 },
  resultTitle: { color: colors.ink, fontSize: 22, fontWeight: "700" },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  button: { backgroundColor: colors.accent, borderRadius: radius.control, paddingHorizontal: 18, paddingVertical: 12 },
  buttonText: { color: colors.onAccent, fontWeight: "700", fontSize: 16 },
  secondaryButton: { borderWidth: 1, borderColor: colors.line, borderRadius: radius.control, paddingHorizontal: 18, paddingVertical: 12 },
  secondaryButtonText: { color: colors.ink, fontWeight: "700", fontSize: 16 },
});

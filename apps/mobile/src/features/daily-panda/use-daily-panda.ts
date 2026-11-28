import { useCallback, useEffect, useMemo, useState } from "react";
import { Share } from "react-native";

import {
  type DailyPandaState,
  type PandaChoice,
  guessDailyPanda,
  loadDailyPanda,
  loadPandaChoices,
  saveDailyResult,
} from "@/features/daily-panda/daily-panda";
import { recordGuestGame } from "@/features/engagement/guest-store";
import { useInstitutionHero } from "@/features/institutions/institution-hero";
import { useSession } from "@/features/session/session";
import { selectionHaptic, successHaptic } from "@/lib/haptics";

const MAX_MATCHES = 8;

export function useDailyPanda() {
  const [state, setState] = useState<DailyPandaState | null>(null);
  const [pandas, setPandas] = useState<PandaChoice[]>([]);
  const [loadFailed, setLoadFailed] = useState(false);
  const [guessFailed, setGuessFailed] = useState(false);
  const [pending, setPending] = useState(false);
  const [search, setSearch] = useState("");
  const [openedWith, setOpenedWith] = useState(0);

  const load = useCallback(() => {
    Promise.all([loadDailyPanda(), loadPandaChoices()])
      .then(([puzzle, choices]) => {
        setState(puzzle);
        setOpenedWith(puzzle.clues.length);
        setPandas(choices);
      })
      .catch(() => setLoadFailed(true));
  }, []);
  useEffect(load, [load]);

  function retry() {
    setLoadFailed(false);
    load();
  }

  // A finished puzzle joins the fan's 图鉴 (cloud when signed in, local device when signed out).
  const { state: session } = useSession();
  const accountId = session.status === "signedIn" ? session.accountId : null;
  const signedOut = session.status === "signedOut";
  const [savedFor, setSavedFor] = useState<string | null>(null);
  useEffect(() => {
    if (!state?.finished) return;
    let active = true;
    if (accountId !== null) {
      void saveDailyResult(state).then((saved) => {
        if (active && saved) setSavedFor(`${accountId}:${state.puzzleDate}`);
      });
    } else if (signedOut && state.answer?.pandaId) {
      void recordGuestGame(state.answer.pandaId, "daily_panda", state.puzzleDate).then(() => {
        if (active) setSavedFor(`guest:${state.puzzleDate}`);
      });
    }
    return () => {
      active = false;
    };
  }, [state, accountId, signedOut]);

  const savedToBook =
    state !== null && savedFor === `${accountId ?? (signedOut ? "guest" : "none")}:${state.puzzleDate}`;

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
  const answerChoice = answerId ? pandasById.get(answerId) : undefined;
  const answerPhoto = useInstitutionHero(
    answerId
      ? [{ id: answerId, name: answerChoice?.name ?? "今天的熊猫", hasFullBleedCover: answerChoice?.hasFullBleedCover ?? false }]
      : null,
  );
  const answer = state?.answer ? pandasById.get(state.answer.pandaId) : undefined;

  function choose(pandaId: string) {
    if (!state || state.finished || pending) return;
    setSearch("");
    setPending(true);
    setGuessFailed(false);
    guessDailyPanda(state, [...state.guesses.map((guess) => guess.pandaId), pandaId])
      .then((next) => {
        if (next.guesses.at(-1)?.correct) successHaptic();
        else selectionHaptic();
        setState(next);
      })
      .catch(() => setGuessFailed(true))
      .finally(() => setPending(false));
  }

  function share() {
    if (!state) return;
    const marks = state.guesses.map((guess) => (guess.correct ? "🟩" : "🟥")).join("");
    const score = state.solved ? `${state.guesses.length}/${state.maxGuesses}` : `X/${state.maxGuesses}`;
    void Share.share({ message: `吱熊猫 每日一猫 ${state.puzzleDate} ${score}\n${marks}` });
  }

  return {
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
    pandasById,
    matches,
    answer,
    answerPhoto,
    choose,
    share,
  };
}

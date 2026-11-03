import { router, useFocusEffect } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useCallback, useRef, useState } from "react";
import { View } from "react-native";
import Animated from "react-native-reanimated";

import { ListCell, ListSection } from "@/components/grouped-list";
import { BookOpen, MessageCircleQuestion } from "@/components/icons";
import { Icon } from "@/components/icon";
import { Page } from "@/components/page";
import { ScreenState } from "@/components/screen-state";
import { TextField } from "@/components/text-field";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import { CONTENT_ENTER } from "@/design/motion";
import {
  type AskAnswer,
  AskError,
  type AskFailure,
  type AskLink,
  type AskStatus,
  appHref,
  askPanda,
  canSend,
  closesToday,
  FAILURE_COPY,
  loadAskStatus,
  QUESTION_LIMIT,
  questionLength,
  referenceUrl,
  sourceDetail,
  STARTERS,
} from "@/features/ask/ask";
import { useSession } from "@/features/session/session";
import { successHaptic, tapHaptic } from "@/lib/haptics";

const TITLE = "问问熊猫";
const INTRO = "只根据吱熊猫已发布的科普和熊猫资料回答，每个回答都附上出处。";

interface Exchange {
  id: number;
  question: string;
  answer: AskAnswer | null;
}

/** Where an answer came from: one row per page in the app, with the publishers behind it. */
function Sources({ links, title }: { links: AskLink[]; title: string }) {
  const shown = links.filter((link) => appHref(link.appPath) !== null || link.references.some((ref) => referenceUrl(ref.url)));
  if (shown.length === 0) return null;
  return (
    <ListSection title={title}>
      {shown.map((link, index) => {
        const href = appHref(link.appPath);
        const detail = sourceDetail(link);
        const outside = link.references.map((ref) => referenceUrl(ref.url)).find((url) => url !== null) ?? null;
        return (
          <ListCell
            key={`${link.appPath}-${index}`}
            icon={BookOpen}
            label={link.title}
            detail={detail || undefined}
            onPress={href ? () => router.push(href as never) : outside ? () => void WebBrowser.openBrowserAsync(outside) : undefined}
            role={href ? "button" : "link"}
            accessibilityHint={href ? "打开这一页" : "在浏览器中打开原始资料"}
            last={index === shown.length - 1}
          />
        );
      })}
    </ListSection>
  );
}

function ExchangeCard({ exchange }: { exchange: Exchange }) {
  const { answer } = exchange;
  return (
    <Animated.View entering={CONTENT_ENTER} className="gap-row">
      <View className="ml-section self-end rounded-tile bg-highlight-soft px-inset py-row" style={{ borderCurve: "continuous" }}>
        <Text variant="body" accessibilityLabel={`你问：${exchange.question}`}>
          {exchange.question}
        </Text>
      </View>
      {answer === null ? (
        <View className="gap-stack-tight rounded-group bg-card p-inset" style={{ borderCurve: "continuous" }} accessibilityLabel="正在查资料">
          <Text variant="footnote" className="text-muted-foreground">
            正在查资料…
          </Text>
          <Skeleton className="h-4 w-full rounded-full" />
          <Skeleton className="h-4 w-2/3 rounded-full" />
        </View>
      ) : (
        <View className="gap-row" accessibilityLiveRegion="polite">
          <View className="gap-stack-tight rounded-group bg-card p-inset" style={{ borderCurve: "continuous" }}>
            <Text variant="body" className={answer.kind === "answer" ? undefined : "text-muted-foreground"} selectable>
              {answer.text}
            </Text>
          </View>
          <Sources links={answer.links} title={answer.kind === "answer" ? "出处" : "可以看看"} />
        </View>
      )}
    </Animated.View>
  );
}

function Starters({ onPick }: { onPick: (question: string) => void }) {
  return (
    <ListSection title="可以这样问">
      {STARTERS.map((question, index) => (
        <ListCell key={question} label={question} onPress={() => onPick(question)} chevron={false} tone="tint" lines={2} last={index === STARTERS.length - 1} />
      ))}
    </ListSection>
  );
}

export default function AskScreen() {
  const { state: session } = useSession();
  const signedIn = session.status === "signedIn";
  const [status, setStatus] = useState<AskStatus | null>(null);
  const [statusFailed, setStatusFailed] = useState(false);
  const [draft, setDraft] = useState("");
  const [exchanges, setExchanges] = useState<Exchange[]>([]);
  const [problem, setProblem] = useState<AskFailure | null>(null);
  const [closed, setClosed] = useState<AskFailure | null>(null);
  const busy = exchanges.some((exchange) => exchange.answer === null);
  const next = useRef(1);

  const load = useCallback(() => {
    if (!signedIn) return;
    setStatusFailed(false);
    loadAskStatus()
      .then((value) => {
        setStatus(value);
        if (!value.enabled) setClosed("disabled");
        else if (value.remainingToday === 0) setClosed("quotaExhausted");
      })
      .catch(() => setStatusFailed(true));
  }, [signedIn]);
  useFocusEffect(load);

  async function send(text: string) {
    if (!canSend(text) || busy) return;
    tapHaptic();
    const id = next.current++;
    setProblem(null);
    setDraft("");
    setExchanges((list) => [{ id, question: text.trim(), answer: null }, ...list]);
    try {
      const answer = await askPanda(text);
      setExchanges((list) => list.map((item) => (item.id === id ? { ...item, answer } : item)));
      setStatus((current) => (current ? { ...current, remainingToday: answer.remainingToday } : current));
      if (answer.kind === "answer") successHaptic();
      if (answer.remainingToday === 0) setClosed("quotaExhausted");
    } catch (error) {
      const failure = error instanceof AskError ? error.failure : "failed";
      // The question was not answered: take it back out and give the words back to the field.
      setExchanges((list) => list.filter((item) => item.id !== id));
      setDraft(text);
      if (closesToday(failure)) setClosed(failure);
      else setProblem(failure);
    }
  }

  if (session.status === "loading") {
    return <Page title={TITLE} />;
  }

  if (session.status === "unavailable") {
    return (
      <Page title={TITLE}>
        <ScreenState message="账号暂时不可用，请稍后再试。" />
      </Page>
    );
  }

  if (session.status === "signedOut") {
    return (
      <Page title={TITLE} label={INTRO}>
        <View className="items-center gap-row pt-section">
          <Icon icon={MessageCircleQuestion} size={44} tone="tint" />
        </View>
        <ScreenState message="登录后就能提问，每天 20 次。" actionLabel="登录" onAction={() => router.push("/sign-in")} />
      </Page>
    );
  }

  if (statusFailed) {
    return (
      <Page title={TITLE} label={INTRO}>
        <ScreenState message="问问熊猫暂时打不开。" actionLabel="重试" onAction={load} />
      </Page>
    );
  }

  if (status === null) {
    return (
      <Page title={TITLE} label={INTRO}>
        <View className="gap-row" accessibilityLabel="正在加载">
          <Skeleton className="h-28 w-full rounded-group" />
          <Skeleton className="h-36 w-full rounded-group" />
        </View>
      </Page>
    );
  }

  if (closed === "disabled") {
    return (
      <Page title={TITLE} label={INTRO}>
        <ScreenState message={FAILURE_COPY.disabled} />
      </Page>
    );
  }

  const length = questionLength(draft);
  const over = length > QUESTION_LIMIT;
  return (
    <Page title={TITLE} label={INTRO} keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive">
      {closed ? (
        <View className="gap-stack-tight rounded-group bg-card p-inset" style={{ borderCurve: "continuous" }} accessibilityLiveRegion="polite">
          <Text variant="headline">{closed === "dailyCap" ? "先休息一下" : "今天问完了"}</Text>
          <Text variant="subheadline" className="text-muted-foreground">
            {FAILURE_COPY[closed]}
          </Text>
        </View>
      ) : (
        <View className="gap-stack-tight">
          <TextField
            value={draft}
            onChangeText={setDraft}
            placeholder="比如：大熊猫为什么爱吃竹子？"
            accessibilityLabel="你的问题"
            multiline
            textAlignVertical="top"
            className="min-h-24"
            editable={!busy}
            returnKeyType="send"
            submitBehavior="blurAndSubmit"
            onSubmitEditing={() => void send(draft)}
          />
          <View className="flex-row items-center gap-row">
            <Text
              variant="footnote"
              className={over ? "flex-1 text-destructive tabular-nums" : "flex-1 text-muted-foreground tabular-nums"}
              accessibilityLabel={`今天还能问 ${status.remainingToday} 次${over ? `，问题超过 ${QUESTION_LIMIT} 字` : ""}`}
            >
              {`今天还能问 ${status.remainingToday} 次${length > QUESTION_LIMIT - 100 ? ` · ${length}/${QUESTION_LIMIT}` : ""}`}
            </Text>
            <Button size="sm" onPress={() => void send(draft)} disabled={!canSend(draft) || busy} accessibilityLabel="提问">
              <Text>提问</Text>
            </Button>
          </View>
          {problem ? (
            <Text variant="footnote" className="text-destructive" accessibilityLiveRegion="polite">
              {FAILURE_COPY[problem]}
            </Text>
          ) : null}
        </View>
      )}

      {exchanges.length === 0 && !closed ? <Starters onPick={(question) => void send(question)} /> : null}

      {exchanges.map((exchange) => (
        <ExchangeCard key={exchange.id} exchange={exchange} />
      ))}

      <Text variant="footnote" className="text-muted-foreground">
        回答由 AI 根据出处整理，可能有疏漏，请以出处原文为准。问题和回答都不会保存。
      </Text>
    </Page>
  );
}

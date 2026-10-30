import { router, useLocalSearchParams } from "expo-router";
import { type ReactNode, useCallback, useEffect, useState } from "react";
import { TextInput, type TextInputProps, View } from "react-native";
import { useCSSVariable } from "uniwind";

import { LoadFailed } from "@/components/load-failed";
import { Page } from "@/components/page";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  type CorrectionDraft,
  EMPTY_DRAFT,
  LIMITS,
  TOPICS,
  buildSubmission,
  draftProblem,
} from "@/features/corrections/correction";
import { type CorrectionTarget, loadCorrectionTarget, submitCorrection } from "@/features/corrections/submissions";
import { localToday } from "@/features/engagement/seen";
import { useSession } from "@/features/session/session";
import { cn } from "@/lib/utils";

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View className="gap-2">
      <Text className="font-bold">{label}</Text>
      {children}
    </View>
  );
}

function Input({ multiline, ...props }: TextInputProps) {
  const muted = String(useCSSVariable("--color-muted-foreground"));
  return (
    <TextInput
      placeholderTextColor={muted}
      multiline={multiline}
      textAlignVertical={multiline ? "top" : "center"}
      className={cn(
        "border-hairline border-input px-4 text-body text-foreground",
        multiline ? "min-h-24 rounded-control py-3" : "h-12 rounded-full",
      )}
      {...props}
    />
  );
}

function Form({ target }: { target: CorrectionTarget }) {
  const [draft, setDraft] = useState<CorrectionDraft>(EMPTY_DRAFT);
  // Problems show once the fan has tried to send, and follow the draft from then on.
  const [attempted, setAttempted] = useState(false);
  const [status, setStatus] = useState<"editing" | "sending" | "sent" | "failed">("editing");
  const set = (patch: Partial<CorrectionDraft>) => setDraft((current) => ({ ...current, ...patch }));

  async function send() {
    setAttempted(true);
    if (draftProblem(draft)) return;
    setStatus("sending");
    try {
      await submitCorrection(buildSubmission(draft, target, localToday()));
      setStatus("sent");
    } catch {
      setStatus("failed");
    }
  }

  const problem = attempted ? draftProblem(draft) : null;
  if (status === "sent") {
    return (
      <View className="items-start gap-3" accessibilityLiveRegion="polite">
        <Text variant="title">已收到</Text>
        <Text className="text-muted-foreground">审核后，结果会出现在「我的」里。谢谢你帮忙把资料改对。</Text>
        <Button onPress={() => router.back()}>
          <Text>回到资料</Text>
        </Button>
      </View>
    );
  }

  return (
    <View className="gap-6">
      <Field label="哪里不对">
        <ToggleGroup
          type="single"
          variant="outline"
          value={draft.topic ?? undefined}
          onValueChange={(value) => set({ topic: (TOPICS.find((topic) => topic.fieldKey === value)?.fieldKey ?? null) })}
          accessibilityLabel="哪里不对"
        >
          {TOPICS.map((topic) => (
            <ToggleGroupItem key={topic.fieldKey} value={topic.fieldKey} accessibilityLabel={topic.label}>
              <Text>{topic.label}</Text>
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </Field>
      <Field label="正确的是">
        <Input
          value={draft.value}
          onChangeText={(value) => set({ value: value.slice(0, LIMITS.value) })}
          placeholder="例如：2020 年 7 月 21 日出生"
          accessibilityLabel="正确的是"
          multiline
        />
      </Field>
      <Field label="来源名称">
        <Input
          value={draft.sourceTitle}
          onChangeText={(sourceTitle) => set({ sourceTitle: sourceTitle.slice(0, LIMITS.sourceTitle) })}
          placeholder="例如：成都大熊猫繁育研究基地公告"
          accessibilityLabel="来源名称"
        />
      </Field>
      <Field label="来源链接或出处">
        <Input
          value={draft.locator}
          onChangeText={(locator) => set({ locator: locator.slice(0, LIMITS.locator) })}
          placeholder="网址，或书名和页码"
          accessibilityLabel="来源链接或出处"
          autoCapitalize="none"
          autoCorrect={false}
          inputMode="url"
        />
      </Field>
      {problem ? <Text className="text-destructive">{problem}</Text> : null}
      {status === "failed" ? <Text className="text-destructive">没能提交，请稍后再试。</Text> : null}
      <Button className="self-start" onPress={() => void send()} disabled={status === "sending"}>
        <Text>提交</Text>
      </Button>
    </View>
  );
}

export default function CorrectScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { state: session } = useSession();
  const [target, setTarget] = useState<CorrectionTarget | null>(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(() => {
    loadCorrectionTarget(slug)
      .then(setTarget)
      .catch(() => setFailed(true));
  }, [slug]);
  useEffect(load, [load]);

  return (
    <Page label={target ? `纠错　${target.name}` : "纠错"} title="资料哪里不对？" keyboardShouldPersistTaps="handled">
      {session.status === "signedOut" ? (
        <View className="items-start gap-3">
          <Text className="text-muted-foreground">登录后才能纠错，审核结果会发到你的账号里。</Text>
          <Button onPress={() => router.push("/sign-in")}>
            <Text>登录</Text>
          </Button>
        </View>
      ) : session.status === "unavailable" ? (
        <Text className="text-muted-foreground">账号暂时不可用，请稍后再试。</Text>
      ) : failed ? (
        <LoadFailed message="资料暂时打不开。" onRetry={() => { setFailed(false); load(); }} />
      ) : target && session.status === "signedIn" ? (
        <Form target={target} />
      ) : (
        <Skeleton className="h-64 w-full" accessibilityLabel="正在加载" />
      )}
    </Page>
  );
}

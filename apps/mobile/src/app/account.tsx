import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { View } from "react-native";
import Animated from "react-native-reanimated";

import { ListCell, ListSection } from "@/components/grouped-list";
import { Check, CircleAlert, Download, FileText, Hourglass, RotateCw } from "@/components/icons";
import { LoadFailed } from "@/components/load-failed";
import { Page } from "@/components/page";
import { TextField } from "@/components/text-field";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import { PAGE_ENTER } from "@/design/motion";
import {
  type PrivacyKind,
  type PrivacyRequest,
  canRequest,
  latestRequest,
  requestReason,
  DELETION_NOTICE,
  requestStatus,
} from "@/features/account/privacy";
import {
  VerificationRequired,
  createPrivacyRequest,
  newRequestKey,
  privacyRequestsQueryKey,
  privacyRequestsQueryOptions,
  saveExport,
} from "@/features/account/requests";
import { shortDay } from "@/features/engagement/seen";
import { useAccount } from "@/features/session/account";
import { useSession } from "@/features/session/session";
import { Verification } from "@/features/session/verification";
import { failedWithoutData } from "@/lib/query-failed";

function StatusCell({ request, last }: { request: PrivacyRequest; last?: boolean }) {
  const done = request.state === "completed";
  return (
    <ListCell
      icon={done ? Check : request.state === "failed" ? CircleAlert : Hourglass}
      label={requestStatus(request)}
      detail={`${shortDay(request.requestedAt.slice(0, 10))}申请`}
      last={last}
    />
  );
}

type Work = "idle" | "working" | "failed";

function useWork() {
  const [status, setStatus] = useState<Work>("idle");
  async function run(action: () => Promise<void>) {
    if (status === "working") return;
    setStatus("working");
    try {
      await action();
      setStatus("idle");
    } catch {
      setStatus("failed");
    }
  }
  return [status, run] as const;
}

function ExportSection({
  request,
  onRequest,
  onDownload,
}: {
  request: PrivacyRequest | null;
  onRequest: () => Promise<void>;
  onDownload: (requestId: string) => Promise<void>;
}) {
  const [status, run] = useWork();
  const ready = request?.kind === "access_export" && request.state === "completed";
  const again = canRequest(request);
  return (
    <View className="gap-1.5">
      <ListSection title="导出我的数据" footer="导出的是一个 JSON 文件，准备好后 24 小时内可下载。">
        {request ? <StatusCell request={request} last={!ready && !again} /> : null}
        {ready ? (
          <ListCell
            tone="tint"
            icon={Download}
            label="下载导出文件"
            onPress={() => void run(() => onDownload(request.requestId))}
            last={!again}
          />
        ) : null}
        {again ? (
          <ListCell tone="tint" icon={ready ? RotateCw : FileText} label={ready ? "重新导出" : "申请导出"} onPress={() => void run(onRequest)} last />
        ) : null}
      </ListSection>
      {status === "failed" ? (
        <Text variant="footnote" className="px-inset text-destructive" accessibilityLiveRegion="polite">
          没能完成，请稍后再试。
        </Text>
      ) : null}
    </View>
  );
}

function DeletionSection({
  request,
  reason,
  onReasonChange,
  onRequest,
}: {
  request: PrivacyRequest | null;
  reason: string;
  onReasonChange: (reason: string) => void;
  onRequest: (reason: string) => Promise<void>;
}) {
  const [confirming, setConfirming] = useState(false);
  const [status, run] = useWork();
  const open = canRequest(request) && !confirming;

  return (
    <View className="gap-row">
      {request || open ? (
        <ListSection title="注销账号" footer={DELETION_NOTICE}>
          {request ? <StatusCell request={request} last={!open} /> : null}
          {open ? <ListCell tone="destructive" label="申请注销账号" onPress={() => setConfirming(true)} last /> : null}
        </ListSection>
      ) : null}
      {confirming ? (
        <Animated.View
          entering={PAGE_ENTER}
          className="gap-row rounded-card bg-card p-stack"
          style={{ borderCurve: "continuous" }}
        >
          <View className="gap-hair-gap">
            <Text variant="headline" role="heading">
              确定要注销吗？
            </Text>
            <Text variant="subheadline" className="text-muted-foreground">
              {DELETION_NOTICE}
            </Text>
          </View>
          <TextField
            value={reason}
            onChangeText={(value) => onReasonChange(value.slice(0, 1000))}
            placeholder="原因（可不填）"
            accessibilityLabel="注销原因"
            multiline
            textAlignVertical="top"
            className="min-h-24 bg-secondary"
          />
          <Button
            variant="destructive"
            onPress={() =>
              void run(async () => {
                await onRequest(reason);
                setConfirming(false);
              })
            }
            disabled={status === "working"}
          >
            <Text>确认注销</Text>
          </Button>
          <Button variant="plain" onPress={() => setConfirming(false)}>
            <Text>取消</Text>
          </Button>
          {status === "failed" ? (
            <Text variant="footnote" className="text-center text-destructive" accessibilityLiveRegion="polite">
              没能提交，请稍后再试。
            </Text>
          ) : null}
        </Animated.View>
      ) : null}
    </View>
  );
}

export default function AccountScreen() {
  const { state: session } = useSession();
  const { accountId, unavailable } = useAccount();
  const queryClient = useQueryClient();
  const email = session.status === "signedIn" ? session.email : null;
  // Privacy requests require recent email-code authentication on a live session; the API says when it lapses.
  const list = useQuery({ ...privacyRequestsQueryOptions(accountId ?? ""), enabled: accountId !== null });
  const requests = list.data;
  const pendingAction = useRef<(() => Promise<void>) | null>(null);
  // Held here so the typed reason survives the verification screen replacing the form.
  const [deletionReason, setDeletionReason] = useState("");
  const [actionGate, setActionGate] = useState<"verify" | "resuming" | "failed" | null>(null);

  const lapsed = list.isError && list.error instanceof VerificationRequired;
  // A refetch with no data resets the query to pending, which would otherwise unmount the code form mid-entry.
  if (lapsed && actionGate === null) setActionGate("verify");
  const gate =
    actionGate === "resuming" ? "checking"
    : actionGate === "verify" ? "verify"
    : actionGate === "failed" || failedWithoutData(list) || unavailable ? "failed"
    : requests ? "open"
    : "checking";

  function reload() {
    setActionGate(null);
    void list.refetch();
  }

  // One key per request the fan means to file, kept across retries until it succeeds.
  const keys = useRef<Partial<Record<PrivacyKind, string>>>({});

  async function performRequest(kind: PrivacyKind, written = "") {
    const key = (keys.current[kind] ??= newRequestKey());
    const created = await createPrivacyRequest(kind, requestReason(kind, written), key);
    delete keys.current[kind];
    if (kind === "account_deletion") setDeletionReason("");
    if (accountId) {
      const queryKey = privacyRequestsQueryKey(accountId);
      await queryClient.cancelQueries({ queryKey });
      queryClient.setQueryData<PrivacyRequest[]>(queryKey, (current) => [
        created,
        ...(current ?? []).filter((item) => item.requestId !== created.requestId),
      ]);
    }
  }

  async function request(kind: PrivacyKind, written = "") {
    try {
      await performRequest(kind, written);
    } catch (error) {
      if (error instanceof VerificationRequired) {
        pendingAction.current = () => performRequest(kind, written);
        setActionGate("verify");
        return;
      }
      throw error;
    }
  }

  async function download(requestId: string) {
    try {
      await saveExport(requestId);
    } catch (error) {
      if (error instanceof VerificationRequired) {
        pendingAction.current = () => saveExport(requestId);
        setActionGate("verify");
        return;
      }
      throw error;
    }
  }

  async function handleVerified() {
    setActionGate("resuming");
    const pending = pendingAction.current;
    pendingAction.current = null;
    try {
      if (pending) await pending();
      const { error } = await list.refetch({ throwOnError: false });
      if (error) throw error;
      setActionGate(null);
    } catch (error) {
      if (error instanceof VerificationRequired) {
        pendingAction.current = pending;
        setActionGate("verify");
        return;
      }
      setActionGate("failed");
    }
  }

  return (
    <Page label="我的" title="账号与数据">
      {gate === "failed" ? (
        <LoadFailed message="暂时打不开。" onRetry={reload} />
      ) : null}
      {gate === "checking" ? (
        <Skeleton className="h-48 w-full rounded-card" accessibilityLabel="正在加载" />
      ) : null}
      {gate === "verify" ? <Verification email={email} onVerified={() => void handleVerified()} /> : null}
      {gate === "open" && requests ? (
        <Animated.View entering={PAGE_ENTER} className="gap-section">
          <ExportSection
            request={latestRequest(requests, "access_export")}
            onRequest={() => request("access_export")}
            onDownload={download}
          />
          <DeletionSection
            request={latestRequest(requests, "account_deletion")}
            reason={deletionReason}
            onReasonChange={setDeletionReason}
            onRequest={(reason) => request("account_deletion", reason)}
          />
        </Animated.View>
      ) : null}
    </Page>
  );
}

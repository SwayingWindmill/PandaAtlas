import { useCallback, useEffect, useRef, useState } from "react";
import { TextInput, View } from "react-native";
import { useCSSVariable } from "uniwind";

import { LoadFailed } from "@/components/load-failed";
import { Page } from "@/components/page";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
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
  loadPrivacyRequests,
  newRequestKey,
  saveExport,
} from "@/features/account/requests";
import { shortDay } from "@/features/engagement/seen";
import { loadAssurance } from "@/features/session/mfa";
import { Verification } from "@/features/session/verification";

function Status({ request }: { request: PrivacyRequest }) {
  return (
    <Text variant="muted" accessibilityLiveRegion="polite">
      {`${shortDay(request.requestedAt.slice(0, 10))}申请　${requestStatus(request)}`}
    </Text>
  );
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
  const [status, setStatus] = useState<"idle" | "working" | "failed">("idle");
  async function run(action: () => Promise<void>) {
    setStatus("working");
    try {
      await action();
      setStatus("idle");
    } catch {
      setStatus("failed");
    }
  }
  const ready = request?.kind === "access_export" && request.state === "completed";
  return (
    <View className="items-start gap-3">
      <Text variant="h2">导出我的数据</Text>
      {request ? <Status request={request} /> : null}
      <View className="flex-row flex-wrap gap-2">
        {ready ? (
          <Button onPress={() => void run(() => onDownload(request.requestId))} disabled={status === "working"}>
            <Text>下载导出文件</Text>
          </Button>
        ) : null}
        {canRequest(request) ? (
          <Button
            variant={ready ? "secondary" : "default"}
            onPress={() => void run(onRequest)}
            disabled={status === "working"}
          >
            <Text>{ready ? "重新导出" : "申请导出"}</Text>
          </Button>
        ) : null}
      </View>
      {status === "failed" ? <Text className="text-destructive">没能完成，请稍后再试。</Text> : null}
    </View>
  );
}

function DeletionSection({
  request,
  onRequest,
}: {
  request: PrivacyRequest | null;
  onRequest: (reason: string) => Promise<void>;
}) {
  const muted = String(useCSSVariable("--color-muted-foreground"));
  const [confirming, setConfirming] = useState(false);
  const [reason, setReason] = useState("");
  const [status, setStatus] = useState<"idle" | "working" | "failed">("idle");

  async function confirm() {
    setStatus("working");
    try {
      await onRequest(reason);
      setConfirming(false);
      setStatus("idle");
    } catch {
      setStatus("failed");
    }
  }

  return (
    <View className="items-start gap-3 border-t-hairline border-border pt-6">
      <Text variant="h2">注销账号</Text>
      <Text className="text-muted-foreground">{DELETION_NOTICE}</Text>
      {request ? <Status request={request} /> : null}
      {canRequest(request) && !confirming ? (
        <Button variant="outline" onPress={() => setConfirming(true)}>
          <Text>申请注销账号</Text>
        </Button>
      ) : null}
      {confirming ? (
        <View className="w-full gap-3 rounded-lg border-hairline border-destructive p-4">
          <Text className="font-bold">确定要注销吗？</Text>
          <TextInput
            value={reason}
            onChangeText={(value) => setReason(value.slice(0, 1000))}
            placeholder="原因（可不填）"
            placeholderTextColor={muted}
            accessibilityLabel="注销原因"
            multiline
            textAlignVertical="top"
            className="min-h-20 rounded-lg border-hairline border-input px-4 py-3 text-base text-foreground"
          />
          <View className="flex-row flex-wrap gap-2">
            <Button variant="destructive" onPress={() => void confirm()} disabled={status === "working"}>
              <Text>确认注销</Text>
            </Button>
            <Button variant="secondary" onPress={() => setConfirming(false)}>
              <Text>取消</Text>
            </Button>
          </View>
          {status === "failed" ? <Text className="text-destructive">没能提交，请稍后再试。</Text> : null}
        </View>
      ) : null}
    </View>
  );
}

type Gate =
  { status: "checking" } | { status: "verify"; factorId: string | null } | { status: "open" } | { status: "failed" };

export default function AccountScreen() {
  const [gate, setGate] = useState<Gate>({ status: "checking" });
  const [requests, setRequests] = useState<PrivacyRequest[] | null>(null);

  // Privacy requests need a recent two-step verification; the API says when it has lapsed.
  const verify = useCallback(() => {
    setGate({ status: "checking" });
    loadAssurance()
      .then((assurance) => setGate({ status: "verify", factorId: assurance.factorId }))
      .catch(() => setGate({ status: "failed" }));
  }, []);

  const load = useCallback(() => {
    loadAssurance()
      .then(async (assurance) => {
        if (assurance.level !== "aal2") {
          setGate({ status: "verify", factorId: assurance.factorId });
          return;
        }
        setRequests(await loadPrivacyRequests());
        setGate({ status: "open" });
      })
      .catch((error: unknown) => (error instanceof VerificationRequired ? verify() : setGate({ status: "failed" })));
  }, [verify]);
  useEffect(load, [load]);

  function reload() {
    setGate({ status: "checking" });
    load();
  }

  // One key per request the fan means to file, kept across retries until it succeeds.
  const keys = useRef<Partial<Record<PrivacyKind, string>>>({});

  async function request(kind: PrivacyKind, written = "") {
    try {
      const key = (keys.current[kind] ??= newRequestKey());
      const created = await createPrivacyRequest(kind, requestReason(kind, written), key);
      delete keys.current[kind];
      setRequests((current) => [created, ...(current ?? []).filter((item) => item.requestId !== created.requestId)]);
    } catch (error) {
      if (error instanceof VerificationRequired) verify();
      throw error;
    }
  }

  async function download(requestId: string) {
    try {
      await saveExport(requestId);
    } catch (error) {
      if (error instanceof VerificationRequired) verify();
      throw error;
    }
  }

  return (
    <Page label="我的" title="账号与数据">
      {gate.status === "failed" ? (
        <LoadFailed message="暂时打不开。" onRetry={reload} />
      ) : null}
      {gate.status === "checking" ? <Skeleton className="h-48 w-full" accessibilityLabel="正在加载" /> : null}
      {gate.status === "verify" ? <Verification factorId={gate.factorId} onVerified={reload} /> : null}
      {gate.status === "open" && requests ? (
        <>
          <ExportSection
            request={latestRequest(requests, "access_export")}
            onRequest={() => request("access_export")}
            onDownload={download}
          />
          <DeletionSection
            request={latestRequest(requests, "account_deletion")}
            onRequest={(reason) => request("account_deletion", reason)}
          />
        </>
      ) : null}
    </Page>
  );
}

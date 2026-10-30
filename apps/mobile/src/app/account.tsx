import { useCallback, useEffect, useRef, useState } from "react";
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
  loadPrivacyRequests,
  newRequestKey,
  saveExport,
} from "@/features/account/requests";
import { shortDay } from "@/features/engagement/seen";
import { loadAssurance } from "@/features/session/mfa";
import { Verification } from "@/features/session/verification";

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
  onRequest,
}: {
  request: PrivacyRequest | null;
  onRequest: (reason: string) => Promise<void>;
}) {
  const [confirming, setConfirming] = useState(false);
  const [reason, setReason] = useState("");
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
            onChangeText={(value) => setReason(value.slice(0, 1000))}
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
      {gate.status === "checking" ? (
        <Skeleton className="h-48 w-full rounded-card" accessibilityLabel="正在加载" />
      ) : null}
      {gate.status === "verify" ? <Verification factorId={gate.factorId} onVerified={reload} /> : null}
      {gate.status === "open" && requests ? (
        <Animated.View entering={PAGE_ENTER} className="gap-section">
          <ExportSection
            request={latestRequest(requests, "access_export")}
            onRequest={() => request("access_export")}
            onDownload={download}
          />
          <DeletionSection
            request={latestRequest(requests, "account_deletion")}
            onRequest={(reason) => request("account_deletion", reason)}
          />
        </Animated.View>
      ) : null}
    </Page>
  );
}

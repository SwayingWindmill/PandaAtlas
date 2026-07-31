"use client";

import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { Button } from "@/components/ui/button";

type AdminSession = {
  capabilities: string[];
  recent_auth: boolean;
};

type RehearsalSnapshot = {
  archive_pointer_release_id: string | null;
  public_pointer_release_id: string | null;
  canonical_sha256: string;
  go: boolean;
  blockers: string[];
};

type ArchiveOperationRead = {
  operation_id: string;
  release_id: string;
  operation_type: string;
  public_projection_status: "pending" | "projected";
  followup_due_at: string | null;
};

type EmergencyFollowupRead = {
  operation_id: string;
  followup_change_set_id: string;
  completed_at: string;
};

type EntityRef = {
  entity_type: string;
  entity_id: string;
};

function commandKey(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`;
}

function errorText(value: unknown): string {
  return value instanceof Error ? value.message : "Archive 高级操作失败。";
}

async function parseResponse<T>(response: Response): Promise<T> {
  const body = (await response.json().catch(() => null)) as
    | T
    | { detail?: string | { code?: string; message?: string } }
    | null;
  if (response.ok) return body as T;
  const detail = body && typeof body === "object" && "detail" in body ? body.detail : null;
  if (typeof detail === "string") throw new Error(detail);
  if (detail && typeof detail === "object") {
    throw new Error(detail.message ?? detail.code ?? `Archive 服务返回 ${response.status}`);
  }
  throw new Error(`Archive 服务返回 ${response.status}`);
}

async function archiveFetch<T>(path: string, init?: RequestInit): Promise<T> {
  return parseResponse<T>(
    await fetch(`/api/admin/archive${path}`, {
      ...init,
      cache: "no-store",
      credentials: "same-origin",
      headers: {
        Accept: "application/json",
        ...(init?.body ? { "Content-Type": "application/json" } : {}),
        ...init?.headers,
      },
    }),
  );
}

function parseObject(value: string, label: string): Record<string, unknown> {
  const parsed = JSON.parse(value) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(`${label} 必须是 JSON object。`);
  }
  return parsed as Record<string, unknown>;
}

function parseEntities(value: string): EntityRef[] {
  const rows = value
    .split("\n")
    .map((row) => row.trim())
    .filter(Boolean);
  return rows.map((row) => {
    const separator = row.indexOf(":");
    if (separator < 1 || separator === row.length - 1) {
      throw new Error("实体必须按 entity_type:entity_id 每行一个填写。");
    }
    return {
      entity_type: row.slice(0, separator).trim(),
      entity_id: row.slice(separator + 1).trim(),
    };
  });
}

function Field({
  label,
  value,
  onChange,
  multiline = false,
}: Readonly<{
  label: string;
  value: string;
  onChange: (value: string) => void;
  multiline?: boolean;
}>) {
  const className =
    "mt-1 min-h-11 w-full rounded-md border border-stone-400 bg-white px-3 py-2 text-sm text-stone-950";
  return (
    <label className="block text-sm font-semibold text-stone-800">
      {label}
      {multiline ? (
        <textarea
          className={`${className} min-h-28 font-mono`}
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
      ) : (
        <input
          className={className}
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
      )}
    </label>
  );
}

export function ArchiveAdvancedOperations() {
  const [session, setSession] = useState<AdminSession | null>(null);
  const [snapshot, setSnapshot] = useState<RehearsalSnapshot | null>(null);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);

  const [operationType, setOperationType] = useState<"merge" | "split">("merge");
  const [sourceEntities, setSourceEntities] = useState("panda:\npanda:");
  const [destinationEntities, setDestinationEntities] = useState("panda:");
  const [aliasRedirects, setAliasRedirects] = useState("{}");
  const [mergeEffect, setMergeEffect] = useState('{"identity_changes":[]}');
  const [mergeImpact, setMergeImpact] = useState(
    '{"follow_count":0,"activity_count":0,"slug_alias_count":0,"relationship_count":0,"residency_count":0,"media_count":0,"source_count":0,"public_urls":[],"warnings":[]}',
  );
  const [mergeReason, setMergeReason] = useState(
    "Reviewed stable IDs, aliases, relationships, residency, media, sources, follows, Activity, and public URLs.",
  );
  const [mergeDataVersion, setMergeDataVersion] = useState("");

  const [subjectType, setSubjectType] = useState("panda");
  const [subjectId, setSubjectId] = useState("");
  const [publicScope, setPublicScope] = useState("");
  const [takedownEffect, setTakedownEffect] = useState('{"remove_public_fields":[]}');
  const [takedownImpact, setTakedownImpact] = useState(
    '{"follow_count":0,"activity_count":0,"slug_alias_count":0,"relationship_count":0,"residency_count":0,"media_count":0,"source_count":0,"public_urls":[],"warnings":[]}',
  );
  const [takedownReason, setTakedownReason] = useState(
    "Urgent public-risk reduction; no new unverified facts are introduced.",
  );
  const [takedownDataVersion, setTakedownDataVersion] = useState("");

  const [followupOperationId, setFollowupOperationId] = useState("");
  const [followupChangeSetId, setFollowupChangeSetId] = useState("");
  const [followupReason, setFollowupReason] = useState(
    "Formal Change Set records the evidence, review, and durable resolution for the emergency action.",
  );

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      parseResponse<AdminSession>(
        fetch("/api/admin/session", { credentials: "same-origin", cache: "no-store" }),
      ),
      archiveFetch<RehearsalSnapshot>("/workbench/rehearsal-snapshot"),
    ])
      .then(([sessionResult, snapshotResult]) => {
        if (!cancelled) {
          setSession(sessionResult);
          setSnapshot(snapshotResult);
        }
      })
      .catch((cause) => {
        if (!cancelled) setError(errorText(cause));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const canMergeSplit =
    session?.capabilities.includes("archive.sensitive.merge_split") ?? false;
  const canTakedown = session?.capabilities.includes("archive.sensitive.takedown") ?? false;
  const recentAuth = session?.recent_auth ?? false;

  async function runCommand<T>(path: string, payload: Record<string, unknown>): Promise<T | null> {
    setWorking(true);
    setError(null);
    setResult(null);
    try {
      const response = await archiveFetch<T>(path, {
        method: "POST",
        body: JSON.stringify(payload),
      });
      setResult(JSON.stringify(response, null, 2));
      return response;
    } catch (cause) {
      setError(errorText(cause));
      return null;
    } finally {
      setWorking(false);
    }
  }

  async function submitMergeSplit() {
    if (!snapshot?.archive_pointer_release_id || !mergeDataVersion.trim()) return;
    try {
      const sources = parseEntities(sourceEntities);
      const destinations = parseEntities(destinationEntities);
      if (operationType === "merge" && (sources.length < 2 || destinations.length !== 1)) {
        throw new Error("Merge 需要至少两个源实体和一个目标实体。");
      }
      if (operationType === "split" && (sources.length !== 1 || destinations.length < 2)) {
        throw new Error("Split 需要一个源实体和至少两个目标实体。");
      }
      await runCommand<ArchiveOperationRead>("/operations/merge-split", {
        expected_archive_release_id: snapshot.archive_pointer_release_id,
        idempotency_key: commandKey(`archive-${operationType}`),
        reason: mergeReason,
        data_version: mergeDataVersion.trim(),
        risk_level: "sensitive",
        correlation_id: crypto.randomUUID(),
        operation_type: operationType,
        source_entities: sources,
        destination_entities: destinations,
        alias_redirects: parseObject(aliasRedirects, "Alias redirects"),
        effect_payload: parseObject(mergeEffect, "Effect payload"),
        impact_preview: parseObject(mergeImpact, "Impact preview"),
      });
    } catch (cause) {
      setError(errorText(cause));
    }
  }

  async function submitEmergencyTakedown() {
    if (
      !snapshot?.archive_pointer_release_id ||
      !subjectId.trim() ||
      !publicScope.trim() ||
      !takedownDataVersion.trim()
    ) {
      return;
    }
    try {
      const response = await runCommand<ArchiveOperationRead>("/operations/emergency-takedowns", {
        expected_archive_release_id: snapshot.archive_pointer_release_id,
        idempotency_key: commandKey("archive-emergency-takedown"),
        reason: takedownReason,
        data_version: takedownDataVersion.trim(),
        risk_level: "sensitive",
        correlation_id: crypto.randomUUID(),
        subject: { entity_type: subjectType.trim(), entity_id: subjectId.trim() },
        public_scope: publicScope.trim(),
        effect_payload: parseObject(takedownEffect, "Takedown effect"),
        impact_preview: parseObject(takedownImpact, "Takedown impact"),
        reduction_only: true,
      });
      if (response) setFollowupOperationId(response.operation_id);
    } catch (cause) {
      setError(errorText(cause));
    }
  }

  async function submitFollowup() {
    if (!followupOperationId.trim() || !followupChangeSetId.trim()) return;
    await runCommand<EmergencyFollowupRead>(
      `/operations/emergency-takedowns/${encodeURIComponent(followupOperationId.trim())}/followup`,
      {
        expected_operation_id: followupOperationId.trim(),
        followup_change_set_id: followupChangeSetId.trim(),
        idempotency_key: commandKey("archive-emergency-followup"),
        reason: followupReason,
        correlation_id: crypto.randomUUID(),
      },
    );
  }

  return (
    <main
      className="mx-auto w-full max-w-6xl px-4 py-6"
      aria-labelledby="advanced-archive-heading"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-stone-700">Trusted Archive · Senior</p>
          <h1 id="advanced-archive-heading" className="mt-1 text-3xl font-bold text-stone-950">
            合并、拆分与紧急下架
          </h1>
          <p className="mt-2 max-w-4xl text-sm leading-6 text-stone-700">
            所有操作都创建新的不可变 Release。页面不直接修改 Archive 或 Public Projection；FastAPI 与 PostgreSQL 会重新校验 capability、recent-auth、版本、幂等和风险约束。
          </p>
        </div>
        <Link
          to="/archive"
          className="inline-flex min-h-11 items-center rounded-md border border-stone-400 bg-white px-4 py-2 text-sm font-semibold text-stone-950"
        >
          返回 Archive 工作台
        </Link>
      </div>

      {!recentAuth ? (
        <p className="mt-5 rounded-lg border border-amber-700 bg-amber-50 p-4 text-sm text-amber-950" role="alert">
          敏感操作要求 15 分钟内认证。请重新登录后再提交。
        </p>
      ) : null}
      {error ? (
        <p className="mt-5 rounded-lg border border-red-800 bg-red-50 p-4 text-sm text-red-950" role="alert">
          {error}
        </p>
      ) : null}
      {result ? (
        <pre className="mt-5 max-h-80 overflow-auto whitespace-pre-wrap rounded-lg border border-emerald-800 bg-emerald-50 p-4 text-xs text-emerald-950">
          {result}
        </pre>
      ) : null}

      <section className="mt-7 rounded-xl border border-stone-300 bg-white p-5" aria-labelledby="baseline-heading">
        <h2 id="baseline-heading" className="text-xl font-bold text-stone-950">当前不可变基线</h2>
        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
          <div><dt className="font-semibold text-stone-700">Archive Release</dt><dd className="mt-1 break-all font-mono text-stone-950">{snapshot?.archive_pointer_release_id ?? "读取中"}</dd></div>
          <div><dt className="font-semibold text-stone-700">Public Release</dt><dd className="mt-1 break-all font-mono text-stone-950">{snapshot?.public_pointer_release_id ?? "读取中"}</dd></div>
          <div><dt className="font-semibold text-stone-700">Rehearsal</dt><dd className="mt-1 text-stone-950">{snapshot?.go ? "GO" : "NO-GO"}</dd></div>
          <div><dt className="font-semibold text-stone-700">Snapshot SHA-256</dt><dd className="mt-1 break-all font-mono text-stone-950">{snapshot?.canonical_sha256 ?? "读取中"}</dd></div>
        </dl>
      </section>

      <section className="mt-7 rounded-xl border border-stone-300 bg-white p-5" aria-labelledby="merge-heading">
        <h2 id="merge-heading" className="text-xl font-bold text-stone-950">实体合并或拆分</h2>
        <p className="mt-2 text-sm text-stone-700">提交前必须预览 Follow、Activity、slug alias、关系、居住、媒体、来源和公开 URL 影响。</p>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <label className="block text-sm font-semibold text-stone-800">操作类型
            <select className="mt-1 min-h-11 w-full rounded-md border border-stone-400 bg-white px-3" value={operationType} onChange={(event) => setOperationType(event.target.value as "merge" | "split") }>
              <option value="merge">Merge</option><option value="split">Split</option>
            </select>
          </label>
          <Field label="新 data_version" value={mergeDataVersion} onChange={setMergeDataVersion} />
          <Field label="源实体，每行 entity_type:entity_id" value={sourceEntities} onChange={setSourceEntities} multiline />
          <Field label="目标实体，每行 entity_type:entity_id" value={destinationEntities} onChange={setDestinationEntities} multiline />
          <Field label="Alias redirects JSON" value={aliasRedirects} onChange={setAliasRedirects} multiline />
          <Field label="Effect payload JSON" value={mergeEffect} onChange={setMergeEffect} multiline />
          <div className="md:col-span-2"><Field label="Impact preview JSON" value={mergeImpact} onChange={setMergeImpact} multiline /></div>
          <div className="md:col-span-2"><Field label="必填原因" value={mergeReason} onChange={setMergeReason} multiline /></div>
        </div>
        <Button className="mt-4 min-h-11" disabled={working || !canMergeSplit || !recentAuth} onClick={() => void submitMergeSplit()}>
          创建新的 {operationType === "merge" ? "Merge" : "Split"} Release
        </Button>
      </section>

      <section className="mt-7 rounded-xl border border-stone-300 bg-white p-5" aria-labelledby="takedown-heading">
        <h2 id="takedown-heading" className="text-xl font-bold text-stone-950">紧急下架</h2>
        <p className="mt-2 text-sm text-stone-700">只能减少公开风险，不能引入未经验证的新事实；成功后必须在一个工作日内绑定正式 Change Set。</p>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <Field label="Subject entity_type" value={subjectType} onChange={setSubjectType} />
          <Field label="Subject entity_id" value={subjectId} onChange={setSubjectId} />
          <Field label="新 data_version" value={takedownDataVersion} onChange={setTakedownDataVersion} />
          <Field label="公开风险范围" value={publicScope} onChange={setPublicScope} />
          <Field label="Reduction-only effect JSON" value={takedownEffect} onChange={setTakedownEffect} multiline />
          <Field label="Impact preview JSON" value={takedownImpact} onChange={setTakedownImpact} multiline />
          <div className="md:col-span-2"><Field label="必填原因" value={takedownReason} onChange={setTakedownReason} multiline /></div>
        </div>
        <Button className="mt-4 min-h-11" disabled={working || !canTakedown || !recentAuth} onClick={() => void submitEmergencyTakedown()}>
          创建紧急下架 Release
        </Button>
      </section>

      <section className="mt-7 rounded-xl border border-stone-300 bg-white p-5" aria-labelledby="followup-heading">
        <h2 id="followup-heading" className="text-xl font-bold text-stone-950">正式 Change Set 跟进</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <Field label="Emergency operation UUID" value={followupOperationId} onChange={setFollowupOperationId} />
          <Field label="Follow-up Change Set UUID" value={followupChangeSetId} onChange={setFollowupChangeSetId} />
          <div className="md:col-span-2"><Field label="跟进说明" value={followupReason} onChange={setFollowupReason} multiline /></div>
        </div>
        <Button className="mt-4 min-h-11" disabled={working || !canTakedown || !recentAuth} onClick={() => void submitFollowup()}>
          登记正式跟进
        </Button>
      </section>
    </main>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { createImportJob, getImportJob, listImportSources, runImportJob } from "@/lib/admin-api-client";
import type { ImportJob, ImportSourceOption } from "@/lib/types";

function isPendingStatus(status: string): boolean {
  return status === "queued" || status === "running";
}

function formatDate(value: string | null): string {
  if (!value) {
    return "-";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString("zh-CN");
}

export function ImportJobsConsole() {
  const [sources, setSources] = useState<ImportSourceOption[]>([]);
  const [sourceName, setSourceName] = useState("");
  const [job, setJob] = useState<ImportJob | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [isLoadingSources, setIsLoadingSources] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  const canCreate = useMemo(
    () => !isLoadingSources && Boolean(sourceName.trim()) && sources.some((item) => item.name === sourceName),
    [isLoadingSources, sourceName, sources],
  );

  useEffect(() => {
    let cancelled = false;

    async function loadSources() {
      setIsLoadingSources(true);
      try {
        const payload = await listImportSources();
        if (cancelled) {
          return;
        }
        setSources(payload.items);
        setSourceName((current) => {
          if (current && payload.items.some((item) => item.name === current)) {
            return current;
          }
          return payload.items[0]?.name ?? "";
        });
      } catch (error) {
        if (!cancelled) {
          setMessage(error instanceof Error ? error.message : "加载导入源失败");
        }
      } finally {
        if (!cancelled) {
          setIsLoadingSources(false);
        }
      }
    }

    void loadSources();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!job || !isPendingStatus(job.status)) {
      return;
    }

    const handle = window.setInterval(async () => {
      try {
        const latest = await getImportJob(job.id);
        setJob(latest);
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "轮询任务状态失败");
      }
    }, 1500);

    return () => {
      window.clearInterval(handle);
    };
  }, [job]);

  async function onCreate() {
    if (!canCreate) {
      setMessage("请先选择批准的导入源");
      return;
    }

    setIsBusy(true);
    setMessage(null);
    try {
      const created = await createImportJob({ source_name: sourceName });
      setJob(created);
      setMessage("导入任务已创建");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "创建导入任务失败");
    } finally {
      setIsBusy(false);
    }
  }

  async function onRun() {
    if (!job) {
      return;
    }

    setIsBusy(true);
    setMessage(null);
    try {
      const executed = await runImportJob(job.id);
      setJob(executed);
      setMessage(executed.status === "succeeded" ? "导入执行成功" : "导入执行失败");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "执行导入任务失败");
    } finally {
      setIsBusy(false);
    }
  }

  async function onRefresh() {
    if (!job) {
      return;
    }

    setIsBusy(true);
    setMessage(null);
    try {
      const latest = await getImportJob(job.id);
      setJob(latest);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "刷新导入任务失败");
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <section className="grid gap-4 md:grid-cols-2">
      <article className="card">
        <h3>创建导入任务</h3>
        <div className="mt-3 grid gap-3 text-sm">
          <p className="rounded-md border border-dashed border-stone-300 bg-stone-50 px-3 py-2 text-stone-700">
            This local operator console uses same-origin server routes. The browser does not hold the
            backend admin token.
          </p>
          <label className="grid gap-1">
            <span>approved source</span>
            <select
              className="rounded-md border bg-white px-3 py-2"
              value={sourceName}
              onChange={(event) => setSourceName(event.target.value)}
              disabled={isLoadingSources || isBusy || sources.length === 0}
            >
              {sources.length === 0 ? <option value="">No approved sources available</option> : null}
              {sources.map((source) => (
                <option key={source.name} value={source.name}>
                  {source.label} ({source.name})
                </option>
              ))}
            </select>
          </label>
          <div className="rounded-md border bg-white px-3 py-2 text-stone-700">
            <div className="font-medium">repo path</div>
            <div className="mt-1 text-xs">
              {sources.find((item) => item.name === sourceName)?.source_path ?? "-"}
            </div>
          </div>
        </div>
        <div className="mt-3 flex gap-2">
          <Button onClick={onCreate} disabled={isBusy || !canCreate}>
            创建任务
          </Button>
          <Button variant="outline" onClick={onRun} disabled={isBusy || !job}>
            执行任务
          </Button>
          <Button variant="outline" onClick={onRefresh} disabled={isBusy || !job}>
            刷新状态
          </Button>
        </div>
        {message ? <p className="mt-3 text-sm text-stone-700">{message}</p> : null}
      </article>

      <article className="card">
        <h3>任务状态</h3>
        {!job ? <p className="meta mt-3">尚未创建任务</p> : null}
        {job ? (
          <dl className="mt-3 grid gap-2 text-sm">
            <div className="flex justify-between gap-2 border-b pb-1">
              <dt className="meta">job_id</dt>
              <dd>{job.id}</dd>
            </div>
            <div className="flex justify-between gap-2 border-b pb-1">
              <dt className="meta">status</dt>
              <dd>{job.status}</dd>
            </div>
            <div className="flex justify-between gap-2 border-b pb-1">
              <dt className="meta">created_at</dt>
              <dd>{formatDate(job.created_at)}</dd>
            </div>
            <div className="flex justify-between gap-2 border-b pb-1">
              <dt className="meta">started_at</dt>
              <dd>{formatDate(job.started_at)}</dd>
            </div>
            <div className="flex justify-between gap-2 border-b pb-1">
              <dt className="meta">finished_at</dt>
              <dd>{formatDate(job.finished_at)}</dd>
            </div>
            <div className="grid gap-1">
              <dt className="meta">summary</dt>
              <dd className="rounded-md border bg-white p-2">
                <pre className="text-xs whitespace-pre-wrap break-all">
                  {JSON.stringify(job.summary, null, 2)}
                </pre>
              </dd>
            </div>
            <div className="grid gap-1">
              <dt className="meta">error_log</dt>
              <dd className="rounded-md border bg-white p-2">
                <pre className="text-xs whitespace-pre-wrap break-all">{job.error_log ?? "-"}</pre>
              </dd>
            </div>
          </dl>
        ) : null}
      </article>
    </section>
  );
}

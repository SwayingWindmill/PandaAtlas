"use client";

import { useQuery } from "@tanstack/react-query";
import { getCoreRowModel, useReactTable, type ColumnDef } from "@tanstack/react-table";
import { parseAsInteger, useQueryState } from "nuqs";
import Link from "next/link";
import { useMemo, useState } from "react";
import { ScrollText } from "lucide-react";

import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/table/data-table";
import { auditEvidenceQueryOptions } from "../api/queries";
import type { AuditEvidence } from "../api/types";
import { auditDomainName, auditEventName, auditObjectName } from "../presentation";
import { auditEvidenceColumns } from "./audit-evidence-columns";

export function AuditEvidenceCollection() {
  const [limit, setLimit] = useQueryState("limit", parseAsInteger.withDefault(25).withOptions({ shallow: true }));
  const evidence = useQuery(auditEvidenceQueryOptions(limit));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = evidence.data?.find((item) => item.sourceEventId === selectedId);
  const columns = useMemo<ColumnDef<AuditEvidence>[]>(() => [
    ...auditEvidenceColumns,
    {
      id: "inspect",
      header: "操作",
      cell: ({ row }) => (
        <Button type="button" size="sm" variant="outline"
          aria-label={`查看审计详情：${auditEventName(row.original.eventType)}，${new Date(row.original.occurredAt).toLocaleString("zh-CN")}`}
          aria-pressed={selectedId === row.original.sourceEventId}
          className={selectedId === row.original.sourceEventId ? "border-teal-300 bg-teal-50 text-teal-900" : undefined}
          onClick={() => setSelectedId(row.original.sourceEventId)}>
          查看审计详情
        </Button>
      ),
    },
  ], [selectedId]);
  // TanStack Table intentionally exposes non-memoizable helpers; React Compiler skips this hook safely.
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: evidence.data ?? [],
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <div className="mx-auto w-full max-w-7xl px-5 pb-12 pt-7 md:px-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-950">审计记录</h1>
        <p className="mt-1.5 max-w-3xl text-sm leading-6 text-slate-600">
          按发生时间查看操作及影响对象。仅展示最近记录，不等于完整历史导出。
        </p>
      </header>

      <div className="mt-5 grid items-start gap-5 xl:grid-cols-[minmax(20rem,0.9fr)_minmax(0,1.5fr)]">
      <section aria-label="审计记录列表" className="min-w-0 xl:sticky xl:top-24">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div><h2 className="text-base font-semibold text-slate-950">最近记录</h2><p className="mt-1 text-xs text-slate-600">选择一项记录，在右侧查看追溯信息</p></div>
          {evidence.data && <span className="text-xs text-slate-600">已加载 {evidence.data.length} 项</span>}
        </div>
        <label className="mb-3 flex items-center justify-between gap-3 text-sm font-medium text-slate-700">
          最近记录数
          <select
            aria-label="最近记录数"
            value={String(limit)}
            onChange={(event) => void setLimit(Number(event.target.value))}
            className="min-h-10 min-w-32 rounded-lg border border-slate-300 bg-white px-3 text-sm font-normal text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
          >
            {[25, 50, 100, 200].map((value) => <option key={value} value={value}>{value}</option>)}
          </select>
        </label>
        {evidence.isPending ? <p role="status" className="text-sm text-slate-600">正在加载审计记录…</p> : null}
        {evidence.isError ? <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-900">{evidence.error.message}</p> : null}
        {evidence.isSuccess ? <DataTable table={table} emptyMessage="当前范围内没有可查看的审计记录。可扩大上方最近记录数。" /> : null}
      </section>

      <section aria-label="审计事件详情" className="min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white">
      {!selected && <div className="flex min-h-72 flex-col items-center justify-center px-8 py-12 text-center">
        <ScrollText className="size-9 text-slate-400" aria-hidden="true" strokeWidth={1.5} />
        <h2 className="mt-4 text-base font-semibold text-slate-950">选择一条审计记录</h2>
        <p className="mt-2 max-w-sm text-sm leading-6 text-slate-600">在左侧选择记录，可在这里检查事件、发生时间和技术追溯信息。</p>
      </div>}
      {selected && (
        <div className="p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-teal-800">{auditDomainName(selected.sourceContext)}</p>
              <h2 className="mt-1 text-lg font-semibold text-slate-950">{auditEventName(selected.eventType)}</h2>
            </div>
            <Button type="button" variant="outline" onClick={() => setSelectedId(null)}>关闭详情</Button>
          </div>
          <dl className="mt-5 grid gap-4 border-t border-slate-200 pt-5 text-sm md:grid-cols-2">
            <div><dt className="text-slate-600">影响对象</dt><dd className="mt-1 font-semibold text-slate-950">{auditObjectName(selected.aggregateType)}</dd></div>
            <div><dt className="text-slate-600">实际发生时间</dt><dd className="mt-1 tabular-nums font-semibold text-slate-950">{new Date(selected.occurredAt).toLocaleString("zh-CN")}</dd></div>
          </dl>
          <p className="mt-4 text-sm text-slate-600">操作人信息未由此审计接口提供。</p>
          <details className="mt-5 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
            <summary className="cursor-pointer font-medium text-teal-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700">技术追溯信息</summary>
            <p className="mt-3 text-slate-600">下方 SHA-256 仅为载荷摘要，不代表页面已完成完整性验证。</p>
            <dl className="mt-3 grid gap-3 md:grid-cols-2">
              {([
                ["事件标识", selected.sourceEventId],
                ["原始事件代码", selected.eventType],
                ["来源代码", selected.sourceContext],
                ["对象类型代码", selected.aggregateType],
                ["对象 ID", selected.aggregateId],
                ["关联追踪 ID", selected.correlationId],
                ["审计记录时间", new Date(selected.recordedAt).toLocaleString("zh-CN")],
                ["SHA-256 载荷摘要", selected.payloadSha256],
              ] as const).map(([label, value]) => (
                <div key={label}><dt className="text-slate-600">{label}</dt><dd className="mt-1 break-all font-mono text-xs text-slate-950">{value}</dd></div>
              ))}
            </dl>
          </details>
          {selected.aggregateType === "public_release" && selected.sourceContext === "publication" && (
            <Link className="mt-5 inline-block text-sm font-semibold text-teal-800 underline underline-offset-2"
              href={`/admin/publication?release=${encodeURIComponent(selected.aggregateId)}`}>
              查看关联发布版本
            </Link>
          )}
          {selected.aggregateType === "review_case" && selected.sourceContext === "review" && (
            <Link className="mt-5 inline-block text-sm font-semibold text-teal-800 underline underline-offset-2"
              href="/admin/reviews">
              前往审核队列
            </Link>
          )}
        </div>
      )}
      </section>
      </div>
    </div>
  );
}

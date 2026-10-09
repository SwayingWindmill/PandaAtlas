"use client";

import { useQuery } from "@tanstack/react-query";
import { getCoreRowModel, useReactTable, type ColumnDef } from "@tanstack/react-table";
import { parseAsInteger, useQueryState } from "nuqs";
import Link from "next/link";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/table/data-table";
import { auditEvidenceQueryOptions } from "../api/queries";
import type { AuditEvidence } from "../api/types";
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
        <Button type="button" variant="outline" onClick={() => setSelectedId(row.original.sourceEventId)}>
          查看审计详情
        </Button>
      ),
    },
  ], []);
  // TanStack Table intentionally exposes non-memoizable helpers; React Compiler skips this hook safely.
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: evidence.data ?? [],
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-stone-600">审计</p>
          <h1 className="mt-1 text-3xl font-bold text-stone-950">审计证据</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-stone-700">
            查看最近的只追加审计证据，追踪操作对象、关联事件及内容摘要。列表不代表完整历史导出。
          </p>
        </div>
        <label className="text-sm font-semibold text-stone-700">
          最近记录数
          <select
            aria-label="最近记录数"
            value={String(limit)}
            onChange={(event) => void setLimit(Number(event.target.value))}
            className="ml-2 min-h-10 rounded-md border border-stone-400 bg-white px-3"
          >
            {[25, 50, 100, 200].map((value) => <option key={value} value={value}>{value}</option>)}
          </select>
        </label>
      </div>

      <section className="mt-6" aria-live="polite">
        {evidence.isPending ? <p className="text-sm text-stone-600">正在加载审计证据…</p> : null}
        {evidence.isError ? <p role="alert" className="rounded-md border border-red-300 bg-red-50 p-4 text-sm text-red-900">{evidence.error.message}</p> : null}
        {evidence.isSuccess ? <DataTable table={table} emptyMessage="尚无可查看的审计证据记录。" /> : null}
      </section>

      {selected && (
        <section aria-label="审计事件详情" className="mt-6 rounded-xl border border-stone-300 bg-white p-6">
          <h2 className="text-xl font-bold text-stone-950">审计事件详情</h2>
          <p className="mt-2 text-sm text-stone-700">记录为只读证据元数据；SHA-256 是载荷摘要，不表示已在此界面完成完整性验证。</p>
          <dl className="mt-4 grid gap-4 text-sm md:grid-cols-2">
            {([
              ["事件标识", selected.sourceEventId],
              ["事件类型", selected.eventType],
              ["来源领域", selected.sourceContext],
              ["对象类型", selected.aggregateType],
              ["对象 ID", selected.aggregateId],
              ["关联追踪 ID", selected.correlationId],
              ["实际发生时间", new Date(selected.occurredAt).toLocaleString("zh-CN")],
              ["审计记录时间", new Date(selected.recordedAt).toLocaleString("zh-CN")],
              ["SHA-256 载荷摘要", selected.payloadSha256],
            ] as const).map(([label, value]) => (
              <div key={label}>
                <dt className="font-semibold text-stone-700">{label}</dt>
                <dd className="mt-1 break-all font-mono text-stone-950">{value}</dd>
              </div>
            ))}
          </dl>
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
        </section>
      )}
    </div>
  );
}

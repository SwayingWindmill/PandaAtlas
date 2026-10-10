"use client";

import { useQuery } from "@tanstack/react-query";
import { getCoreRowModel, useReactTable, type ColumnDef } from "@tanstack/react-table";
import { parseAsInteger, useQueryState } from "nuqs";
import Link from "next/link";
import { useMemo, useState } from "react";
import { ScrollText } from "lucide-react";

import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/table/data-table";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { auditEvidenceQueryOptions } from "../api/queries";
import type { AuditEvidence } from "../api/types";
import { auditDomainName, auditEventName, auditObjectName } from "../presentation";

export function AuditEvidenceCollection() {
  const [limit, setLimit] = useQueryState("limit", parseAsInteger.withDefault(25).withOptions({ shallow: true }));
  const evidence = useQuery(auditEvidenceQueryOptions(limit));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = evidence.data?.find((item) => item.sourceEventId === selectedId);
  const columns = useMemo<ColumnDef<AuditEvidence>[]>(() => [
    {
      accessorKey: "eventType",
      header: "事件与影响对象",
      cell: ({ row }) => (
        <Button type="button" size="sm" variant="ghost"
          aria-label={`查看审计详情：${auditEventName(row.original.eventType)}，${new Date(row.original.occurredAt).toLocaleString("zh-CN")}`}
          aria-pressed={selectedId === row.original.sourceEventId}
          className={`h-auto w-full flex-col items-start gap-1 whitespace-normal px-2 py-2 text-left ${selectedId === row.original.sourceEventId ? "bg-teal-50 text-teal-900" : "text-slate-900"}`}
          onClick={() => setSelectedId(row.original.sourceEventId)}>
          <span className="text-sm font-semibold">{auditEventName(row.original.eventType)}</span>
          <span className="text-xs font-normal text-slate-600">{auditObjectName(row.original.aggregateType)} · {auditDomainName(row.original.sourceContext)}</span>
          <time dateTime={row.original.occurredAt} className="text-xs font-normal tabular-nums text-slate-600">{new Date(row.original.occurredAt).toLocaleString("zh-CN")}</time>
          <span className="text-xs font-medium text-teal-800 underline underline-offset-2">查看审计详情</span>
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
    <div className="mx-auto w-full max-w-[1480px] px-6 pb-12 pt-9 md:px-9">
      <header className="border-b border-slate-200 pb-5">
        <h1 className="text-[28px] font-semibold tracking-tight text-slate-950">审计记录</h1>
        <p className="mt-1.5 max-w-3xl text-sm leading-6 text-slate-600">
          按发生时间查看操作及影响对象。仅展示最近记录，不等于完整历史导出。
        </p>
      </header>

      <ResizablePanelGroup orientation="horizontal" className="mt-5 min-h-[720px] items-stretch">
      <ResizablePanel defaultSize="38%" minSize="29%" maxSize="55%" className="min-w-0">
      <section aria-label="审计记录列表" className="min-w-0 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div><h2 className="text-base font-semibold text-slate-950">最近记录</h2><p className="mt-1 text-xs text-slate-600">选择一项记录，在右侧查看追溯信息</p></div>
          {evidence.data && <span className="text-xs text-slate-600">已加载 {evidence.data.length} 项</span>}
        </div>
        <label className="mb-3 flex items-center justify-between gap-3 text-sm font-medium text-slate-700">
          最近记录数
          <NativeSelect
            aria-label="最近记录数"
            value={String(limit)}
            onChange={(event) => void setLimit(Number(event.target.value))}
            className="min-h-10 min-w-32 border-slate-200 bg-white text-slate-900"
          >
            {[25, 50, 100, 200].map((value) => <NativeSelectOption key={value} value={value}>{value}</NativeSelectOption>)}
          </NativeSelect>
        </label>
        {evidence.isPending ? <div role="status" aria-label="正在加载审计记录" className="space-y-3"><Skeleton className="h-10 w-full" /><Skeleton className="h-16 w-full" /><Skeleton className="h-16 w-full" /></div> : null}
        {evidence.isError ? <div role="alert" className="space-y-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-900"><p>{evidence.error.message}</p><Button variant="outline" size="sm" onClick={() => void evidence.refetch()}>重试加载审计记录</Button></div> : null}
        {evidence.isSuccess ? <div className="max-h-[min(65vh,760px)] overflow-auto rounded-xl"><DataTable table={table} emptyMessage="当前范围内没有可查看的审计记录。可扩大上方最近记录数。" /></div> : null}
      </section>

      </ResizablePanel>
      <ResizableHandle withHandle aria-label="调整审计列表与事件详情宽度" className="mx-2 w-1 rounded-full bg-slate-200 [&>div]:h-10 [&>div]:w-3 [&>div]:rounded-full [&>div]:border-slate-300 [&>div]:bg-white" />
      <ResizablePanel defaultSize="62%" minSize="45%" className="min-w-0">
      <section aria-label="审计事件详情" className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs">
      {!selected && <Empty className="min-h-[540px]"><EmptyHeader><EmptyMedia variant="icon"><ScrollText aria-hidden="true" /></EmptyMedia><EmptyTitle><h2>选择一条审计记录</h2></EmptyTitle><EmptyDescription>在左侧选择记录，可在这里检查事件、发生时间和技术追溯信息。</EmptyDescription></EmptyHeader></Empty>}
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
          <Collapsible className="mt-5 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
            <CollapsibleTrigger className="min-h-9 font-medium text-teal-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700">技术追溯信息</CollapsibleTrigger>
            <CollapsibleContent>
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
            </CollapsibleContent>
          </Collapsible>
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
      </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}

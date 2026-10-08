"use client";

import { useQuery } from "@tanstack/react-query";
import { getCoreRowModel, useReactTable } from "@tanstack/react-table";
import { parseAsInteger, useQueryState } from "nuqs";

import { DataTable } from "@/components/ui/table/data-table";
import { auditEvidenceQueryOptions } from "../api/queries";
import { auditEvidenceColumns } from "./audit-evidence-columns";

export function AuditEvidenceCollection() {
  const [limit, setLimit] = useQueryState("limit", parseAsInteger.withDefault(25).withOptions({ shallow: true }));
  const evidence = useQuery(auditEvidenceQueryOptions(limit));
  // TanStack Table intentionally exposes non-memoizable helpers; React Compiler skips this hook safely.
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: evidence.data ?? [],
    columns: auditEvidenceColumns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-stone-600">审计</p>
          <h1 className="mt-1 text-3xl font-bold text-stone-950">审计证据</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-stone-700">
            通过正式审计接口查看仅追加、不可更改的操作证据记录。
          </p>
        </div>
        <label className="text-sm font-semibold text-stone-700">
          每页条数
          <select
            aria-label="每页条数"
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
    </div>
  );
}

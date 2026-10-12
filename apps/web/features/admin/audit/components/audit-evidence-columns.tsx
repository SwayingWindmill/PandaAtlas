"use client";

import type { ColumnDef } from "@tanstack/react-table";

import type { AuditEvidence } from "../api/types";
import { auditDomainName, auditEventName, auditObjectName } from "../presentation";

export const auditEvidenceColumns: ColumnDef<AuditEvidence>[] = [
  {
    accessorKey: "eventType",
    header: "事件与影响对象",
    cell: ({ row }) => (
      <div className="min-w-0 space-y-1 py-0.5">
        <p className="text-sm font-semibold leading-5 text-slate-950">{auditEventName(row.original.eventType)}</p>
        <p className="text-xs text-slate-600">{auditObjectName(row.original.aggregateType)} · {auditDomainName(row.original.sourceContext)}</p>
        <time dateTime={row.original.occurredAt} className="block text-xs tabular-nums text-slate-600">{new Date(row.original.occurredAt).toLocaleString("zh-CN")}</time>
      </div>
    ),
  },
];

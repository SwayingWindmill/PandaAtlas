"use client";

import type { ColumnDef } from "@tanstack/react-table";

import type { AuditEvidence } from "../api/types";
import { auditDomainName, auditEventName, auditObjectName } from "../presentation";

export const auditEvidenceColumns: ColumnDef<AuditEvidence>[] = [
  {
    accessorKey: "occurredAt",
    header: "发生时间",
    cell: ({ row }) => <time dateTime={row.original.occurredAt} className="whitespace-nowrap tabular-nums text-slate-700">{new Date(row.original.occurredAt).toLocaleString("zh-CN")}</time>,
  },
  { accessorKey: "eventType", header: "发生的操作", cell: ({ row }) => <span className="font-medium text-slate-950">{auditEventName(row.original.eventType)}</span> },
  {
    id: "aggregate",
    header: "影响对象",
    cell: ({ row }) => <span className="text-slate-700">{auditObjectName(row.original.aggregateType)}</span>,
  },
  { accessorKey: "sourceContext", header: "业务领域", cell: ({ row }) => auditDomainName(row.original.sourceContext) },
];

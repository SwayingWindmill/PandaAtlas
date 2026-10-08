"use client";

import type { ColumnDef } from "@tanstack/react-table";

import type { AuditEvidence } from "../api/types";

export const auditEvidenceColumns: ColumnDef<AuditEvidence>[] = [
  {
    accessorKey: "recordedAt",
    header: "记录时间",
    cell: ({ row }) => new Date(row.original.recordedAt).toLocaleString("zh-CN"),
  },
  { accessorKey: "sourceContext", header: "来源领域" },
  { accessorKey: "eventType", header: "事件类型" },
  {
    id: "aggregate",
    header: "关联对象",
    cell: ({ row }) => `${row.original.aggregateType}:${row.original.aggregateId}`,
  },
  { accessorKey: "correlationId", header: "追踪 ID" },
];

"use client";

import type { ColumnDef } from "@tanstack/react-table";

import type { AuditEvidence } from "../api/types";

export const auditEvidenceColumns: ColumnDef<AuditEvidence>[] = [
  {
    accessorKey: "recordedAt",
    header: "Recorded",
    cell: ({ row }) => new Date(row.original.recordedAt).toLocaleString(),
  },
  { accessorKey: "sourceContext", header: "Context" },
  { accessorKey: "eventType", header: "Event" },
  {
    id: "aggregate",
    header: "Aggregate",
    cell: ({ row }) => `${row.original.aggregateType}:${row.original.aggregateId}`,
  },
  { accessorKey: "correlationId", header: "Correlation" },
];

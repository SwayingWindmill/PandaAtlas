import type { ModeMetric } from "./helpers";

interface ModeSummaryProps {
  modeLabel: string;
  snapshotDate: string;
  description: string;
  metrics: ModeMetric[];
}

export function ModeSummary({ modeLabel, snapshotDate, description, metrics }: ModeSummaryProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[13px] leading-6 text-zinc-500">当前模式</p>
          <h3 className="text-2xl font-semibold leading-tight text-zinc-900">{modeLabel}</h3>
        </div>
        <p className="pt-1 text-[13px] leading-6 text-zinc-500">{snapshotDate}</p>
      </div>

      <p className="text-[15px] leading-7 text-zinc-600">{description}</p>

      <div className="grid gap-3 sm:grid-cols-3">
        {metrics.map((metric) => (
          <div
            key={metric.label}
            className="rounded-[20px] border border-zinc-200/80 bg-white/80 px-4 py-4 shadow-sm shadow-zinc-200/20"
          >
            <p className="text-[13px] leading-6 text-zinc-500">{metric.label}</p>
            <p
              className="pt-1 text-[22px] font-semibold leading-tight text-zinc-900"
              style={{ fontFamily: "var(--font-display)" }}
            >
              {metric.value}
            </p>
            <p className="pt-2 text-[13px] leading-6 text-zinc-500">{metric.note}</p>
          </div>
        ))}
      </div>
    </div>
  );
}


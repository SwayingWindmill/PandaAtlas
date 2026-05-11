import type { SummaryBarItem } from "./helpers";
import { cn } from "@/lib/utils";

const toneClassName: Record<SummaryBarItem["tone"], string> = {
  wild: "bg-[#2F6B3B]",
  domestic: "bg-[#C98A45]",
  overseas: "bg-[#4E86D8]",
  muted: "bg-[#8D968E]"
};

interface MapSummaryBarProps {
  items: SummaryBarItem[];
  detailOpen?: boolean;
  sheetOpen?: boolean;
}

export function MapSummaryBar({ items, detailOpen = false, sheetOpen = false }: MapSummaryBarProps) {
  return (
    <div
      className={cn(
        "pointer-events-none absolute inset-x-0 z-20 flex justify-center px-4",
        detailOpen || sheetOpen ? "hidden md:flex md:bottom-6" : "bottom-6"
      )}
    >
      <div className="grid w-full max-w-[760px] divide-y divide-[rgba(63,125,72,0.1)] border border-[rgba(63,125,72,0.12)] bg-[rgba(247,246,242,0.88)] backdrop-blur-sm md:grid-cols-3 md:divide-x md:divide-y-0">
        {items.map((item) => (
          <div key={item.label} className="px-5 py-3">
            <div className="flex items-center gap-2 text-[12px] font-medium leading-5 text-[#6D7C6E]">
              <span className={`inline-flex h-2.5 w-2.5 rounded-full ${toneClassName[item.tone]}`} />
              <span>{item.label}</span>
            </div>
            <div className="mt-2 flex items-end justify-between gap-4">
              <p
                className="text-[24px] leading-none text-[#233126]"
                style={{ fontFamily: "var(--font-display)" }}
              >
                {item.value}
              </p>
              <p className="max-w-[12rem] text-right text-[12px] leading-5 text-[#6D7C6E]">{item.hint}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

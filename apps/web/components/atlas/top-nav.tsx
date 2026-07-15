import Link from "next/link";
import { Compass, Leaf, ShieldCheck, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatDateLabel } from "./helpers";

const navItems = [
  { label: "首页", href: "/" },
  { label: "全球分布", href: "/global-distribution" },
  { label: "熊猫档案", href: "/atlas" },
  { label: "谱系专题", href: "/lineage" }
] as const;

interface TopNavProps {
  activeModeLabel: string;
  selectedSnapshotDate: string;
  latestSnapshotDate: string;
  sheetOpen?: boolean;
  onToggleControls?: () => void;
  onUseLatestSnapshot: () => void;
}

export function TopNav({
  activeModeLabel,
  selectedSnapshotDate,
  latestSnapshotDate,
  sheetOpen = false,
  onToggleControls,
  onUseLatestSnapshot
}: TopNavProps) {
  const isLatest = selectedSnapshotDate === latestSnapshotDate;

  return (
    <header className="sticky top-0 z-40 border-b border-[rgba(63,125,72,0.12)] bg-[rgba(247,246,242,0.92)] backdrop-blur-xl">
      <div className="flex h-[76px] w-full items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <div className="flex min-w-0 items-center gap-6 lg:gap-10">
          <Link href="/" className="flex min-w-0 items-center gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-[rgba(47,107,59,0.14)] bg-[#2F6B3B] text-stone-50 shadow-[0_10px_24px_rgba(47,107,59,0.14)]">
              <Leaf className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p
                className="truncate text-[19px] font-semibold leading-none text-[#213126]"
                style={{ fontFamily: "var(--font-display)" }}
              >
                大熊猫图鉴 / Panda Atlas
              </p>
              <p className="truncate pt-1 text-[12px] leading-5 text-[var(--atlas-muted-fg)]">分布地图与保育图谱工作台</p>
            </div>
          </Link>

          <nav className="hidden items-center gap-6 lg:flex">
            {navItems.map((item) => {
              const active = item.href === "/global-distribution";

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "border-b-2 pb-1 text-[14px] leading-6 transition-colors",
                    active
                      ? "border-[#2F6B3B] font-semibold text-[#2F6B3B]"
                      : "border-transparent text-[#5E6B5F] hover:text-[#233126]"
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="flex shrink-0 items-center gap-2 md:gap-4">
          {onToggleControls ? (
            <Button
              type="button"
              variant="outline"
              onClick={onToggleControls}
              className="h-10 rounded-none border-x-0 border-t-0 border-b border-[rgba(63,125,72,0.16)] bg-transparent px-0 text-[13px] text-[#233126] shadow-none hover:bg-transparent hover:text-[#2F6B3B] xl:hidden"
            >
              <SlidersHorizontal className="mr-2 h-4 w-4" />
              {sheetOpen ? "收起控制" : "地图控制"}
            </Button>
          ) : null}

          <div className="hidden items-center gap-3 border-l border-[rgba(63,125,72,0.12)] pl-4 lg:flex">
            <Compass className="h-4 w-4 text-[var(--atlas-muted-fg)]" />
            <div className="leading-none">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--atlas-muted-fg)]">Current View</p>
              <p className="mt-1 text-[13px] text-[#233126]">{activeModeLabel}</p>
            </div>
          </div>

          <div className="hidden items-center gap-2 border-l border-[rgba(63,125,72,0.12)] pl-4 sm:flex">
            <span className="inline-flex h-2 w-2 rounded-full bg-[#2F6B3B]" />
            <span className="text-[13px] leading-5 text-[var(--atlas-muted-fg)]">当前数据快照 {formatDateLabel(selectedSnapshotDate)}</span>
          </div>

          {!isLatest ? (
            <Button
              type="button"
              variant="outline"
              onClick={onUseLatestSnapshot}
              className="hidden h-10 rounded-none border-0 bg-transparent px-2 text-[13px] text-[#2F6B3B] shadow-none hover:bg-transparent hover:text-[#244F2D] md:inline-flex"
            >
              切到最新快照
            </Button>
          ) : (
            <div className="hidden items-center gap-2 border-l border-[rgba(63,125,72,0.12)] pl-4 md:flex">
              <ShieldCheck className="h-4 w-4 text-[var(--atlas-muted-fg)]" />
              <span className="text-[13px] leading-5 text-[var(--atlas-muted-fg)]">已是最新</span>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

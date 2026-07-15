import { ArrowRight, Database, FileText, PlaneTakeoff, X } from "lucide-react";
import type { AtlasChangeEntry } from "@/lib/panda-atlas";
import { ATLAS_CHANGES, ATLAS_MODES, ATLAS_TIMELINE_CHANGES } from "@/lib/panda-atlas";
import { Button } from "@/components/ui/button";
import { closestSnapshotDate, formatDateLabel } from "./helpers";

type TimelineTab = "history" | "changes" | null;

interface TimelineSectionProps {
  activeTab: TimelineTab;
  activeHistoryId: string | null;
  activeChangeId: string | null;
  availableSnapshotDates: string[];
  itemNames: Record<string, string>;
  selectedSnapshotDate: string;
  onOpenHistory: () => void;
  onOpenChanges: () => void;
  onClose: () => void;
  onSelectHistory: (change: AtlasChangeEntry) => void;
  onSelectChange: (change: AtlasChangeEntry) => void;
}

function changeIcon(change: AtlasChangeEntry) {
  if (change.kind === "sync") {
    return <Database className="h-4 w-4" />;
  }

  if (change.kind === "travel") {
    return <PlaneTakeoff className="h-4 w-4" />;
  }

  return <FileText className="h-4 w-4" />;
}

function toneClassName(change: AtlasChangeEntry): string {
  switch (change.mode) {
    case "china_wild":
      return "text-[#2F6B3B]";
    case "china_captive":
      return "text-[#A8692C]";
    case "overseas_captive":
      return "text-[#3F6FAE]";
    default:
      return "text-[#5F6E61]";
  }
}

function modeLabel(change: AtlasChangeEntry): string {
  if (change.mode === "all") {
    return "全球总览";
  }

  return ATLAS_MODES.find((item) => item.value === change.mode)?.label ?? "地图模式";
}

function detailLabel(change: AtlasChangeEntry, itemNames: Record<string, string>): string {
  if (!change.focusItemId) {
    return "当前视图总览";
  }

  return itemNames[change.focusItemId] ?? "地图对象";
}

function ChangeDetail({
  change,
  availableSnapshotDates,
  itemNames,
  onSelect
}: {
  change: AtlasChangeEntry;
  availableSnapshotDates: string[];
  itemNames: Record<string, string>;
  onSelect: (change: AtlasChangeEntry) => void;
}) {
  return (
    <section className="border-b border-[rgba(63,125,72,0.08)] pb-5 xl:border-b-0 xl:border-r xl:pb-0 xl:pr-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className={`text-[12px] font-semibold uppercase tracking-[0.16em] ${toneClassName(change)}`}>
            {modeLabel(change)}
          </p>
          <h3
            className="mt-2 text-[26px] leading-[1.15] text-[#233126]"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {change.title}
          </h3>
        </div>
        <span className="text-[12px] leading-5 text-[var(--atlas-muted-fg)]">{formatDateLabel(change.date)}</span>
      </div>

      <p className="mt-4 text-[14px] leading-7 text-[#5F6E61]">{change.summary}</p>

      <dl className="mt-6 divide-y divide-[rgba(63,125,72,0.08)] border-y border-[rgba(63,125,72,0.08)] text-[14px] leading-6">
        <div className="flex items-start justify-between gap-4 py-3">
          <dt className="text-[var(--atlas-muted-fg)]">对应快照</dt>
          <dd className="max-w-[12rem] text-right text-[#233126]">
            {formatDateLabel(closestSnapshotDate(change.date, availableSnapshotDates))}
          </dd>
        </div>
        <div className="flex items-start justify-between gap-4 py-3">
          <dt className="text-[var(--atlas-muted-fg)]">关联对象</dt>
          <dd className="max-w-[12rem] text-right text-[#233126]">{detailLabel(change, itemNames)}</dd>
        </div>
      </dl>

      <Button
        type="button"
        variant="outline"
        onClick={() => onSelect(change)}
        className="mt-4 h-10 rounded-none border-x-0 border-t-0 border-b border-[rgba(47,107,59,0.18)] bg-transparent px-0 text-[13px] text-[#2F6B3B] shadow-none hover:bg-transparent hover:text-[#244F2D]"
      >
        在地图中查看
        <ArrowRight className="ml-2 h-4 w-4" />
      </Button>
    </section>
  );
}

function ChangeList({
  items,
  activeId,
  itemNames,
  onSelect
}: {
  items: AtlasChangeEntry[];
  activeId: string;
  itemNames: Record<string, string>;
  onSelect: (change: AtlasChangeEntry) => void;
}) {
  return (
    <div className="min-h-0 overflow-y-auto">
      <div className="divide-y divide-[rgba(63,125,72,0.08)] border-y border-[rgba(63,125,72,0.08)]">
        {items.map((change) => {
          const active = change.id === activeId;

          return (
            <button
              key={change.id}
              type="button"
              onClick={() => onSelect(change)}
              className={`grid w-full gap-4 px-1 py-4 text-left transition-colors md:grid-cols-[auto_minmax(0,1fr)] ${
                active ? "bg-[rgba(232,242,229,0.62)]" : "hover:bg-[rgba(255,255,255,0.56)]"
              }`}
            >
              <span className={`mt-0.5 flex h-9 w-9 items-center justify-center ${toneClassName(change)}`}>
                {changeIcon(change)}
              </span>

              <div className="min-w-0">
                <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <p className="text-[16px] leading-6 text-[#233126]">{change.title}</p>
                    <p className="mt-1 text-[13px] leading-6 text-[#5F6E61]">{change.summary}</p>
                  </div>
                  <span className="shrink-0 text-[12px] leading-5 text-[var(--atlas-muted-fg)]">{formatDateLabel(change.date)}</span>
                </div>

                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[12px] leading-5">
                  <span className={toneClassName(change)}>{modeLabel(change)}</span>
                  <span className="text-[var(--atlas-muted-fg)]">{detailLabel(change, itemNames)}</span>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function TimelineSection({
  activeTab,
  activeHistoryId,
  activeChangeId,
  availableSnapshotDates,
  itemNames,
  selectedSnapshotDate,
  onOpenHistory,
  onOpenChanges,
  onClose,
  onSelectHistory,
  onSelectChange
}: TimelineSectionProps) {
  const activeHistory =
    ATLAS_TIMELINE_CHANGES.find((item) => item.id === activeHistoryId) ?? ATLAS_TIMELINE_CHANGES[0] ?? null;
  const activeChange = ATLAS_CHANGES.find((item) => item.id === activeChangeId) ?? ATLAS_CHANGES[0] ?? null;
  const open = activeTab !== null;

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-30">
      {!open ? (
        <div className="flex justify-center px-4 pb-4">
          <div className="pointer-events-auto flex items-center gap-5 border-t border-[rgba(63,125,72,0.16)] bg-[linear-gradient(180deg,rgba(247,246,242,0.92),rgba(247,246,242,0.74))] px-4 py-3 backdrop-blur-sm">
            <button
              type="button"
              onClick={onOpenHistory}
              className="text-[13px] leading-6 text-[#233126] transition-colors hover:text-[#2F6B3B]"
            >
              查看历史事件轴
            </button>
            <button
              type="button"
              onClick={onOpenChanges}
              className="text-[13px] leading-6 text-[#233126] transition-colors hover:text-[#2F6B3B]"
            >
              查看最近变化
            </button>
          </div>
        </div>
      ) : null}

      <div
        className={`pointer-events-auto absolute inset-x-0 bottom-0 h-[68%] rounded-t-[28px] border-t border-[rgba(63,125,72,0.12)] bg-[rgba(247,246,242,0.98)] shadow-[0_-24px_48px_rgba(24,34,25,0.16)] backdrop-blur-xl transition-transform duration-300 lg:h-[38%] ${
          open ? "translate-y-0" : "translate-y-full"
        }`}
      >
        <div className="flex h-full flex-col px-4 pb-4 pt-3 lg:px-5">
          <div className="mx-auto h-1.5 w-14 rounded-full bg-[rgba(63,125,72,0.16)]" />

          <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-b border-[rgba(63,125,72,0.08)] pb-3">
            <div className="flex flex-wrap items-center gap-5">
              <button
                type="button"
                onClick={onOpenHistory}
                className={`border-b pb-1 text-[13px] leading-6 ${
                  activeTab === "history"
                    ? "border-[#2F6B3B] text-[#2F6B3B]"
                    : "border-transparent text-[#5F6E61] hover:text-[#233126]"
                }`}
              >
                历史事件轴
              </button>
              <button
                type="button"
                onClick={onOpenChanges}
                className={`border-b pb-1 text-[13px] leading-6 ${
                  activeTab === "changes"
                    ? "border-[#2F6B3B] text-[#2F6B3B]"
                    : "border-transparent text-[#5F6E61] hover:text-[#233126]"
                }`}
              >
                最近变化
              </button>
            </div>

            <div className="flex items-center gap-3">
              <div className="hidden text-[12px] leading-5 text-[var(--atlas-muted-fg)] md:block">
                当前快照 · {formatDateLabel(selectedSnapshotDate)}
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                className="h-9 w-9 rounded-none border-0 bg-transparent p-0 text-[#233126] shadow-none hover:bg-transparent hover:text-[#2F6B3B]"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="mt-4 grid min-h-0 flex-1 gap-5 xl:grid-cols-[340px_minmax(0,1fr)]">
            {activeTab === "history" && activeHistory ? (
              <>
                <ChangeDetail
                  change={activeHistory}
                  availableSnapshotDates={availableSnapshotDates}
                  itemNames={itemNames}
                  onSelect={onSelectHistory}
                />
                <ChangeList
                  items={ATLAS_TIMELINE_CHANGES}
                  activeId={activeHistory.id}
                  itemNames={itemNames}
                  onSelect={onSelectHistory}
                />
              </>
            ) : null}

            {activeTab === "changes" && activeChange ? (
              <>
                <ChangeDetail
                  change={activeChange}
                  availableSnapshotDates={availableSnapshotDates}
                  itemNames={itemNames}
                  onSelect={onSelectChange}
                />
                <ChangeList
                  items={ATLAS_CHANGES}
                  activeId={activeChange.id}
                  itemNames={itemNames}
                  onSelect={onSelectChange}
                />
              </>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

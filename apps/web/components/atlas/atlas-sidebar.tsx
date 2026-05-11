import {
  ATLAS_MODES,
  ATLAS_SEARCH_PLACEHOLDER,
  type AtlasInstitutionTypeFilter,
  type AtlasItem,
  type AtlasMode,
  type AtlasModeMeta,
  type AtlasRegionFilter,
  type AtlasStatusFilter
} from "@/lib/panda-atlas";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  formatDateLabel,
  formatShortDate,
  modeNarrative,
  REGION_OPTIONS,
  selectedEntityHint,
  STATUS_OPTIONS,
  TYPE_OPTIONS,
  type ModeMetric
} from "./helpers";

interface AtlasSidebarProps {
  mode: AtlasMode;
  modeMeta: AtlasModeMeta;
  searchQuery: string;
  resultCount: number;
  regionFilter: AtlasRegionFilter;
  statusFilter: AtlasStatusFilter;
  typeFilter: AtlasInstitutionTypeFilter;
  selectedItem: AtlasItem | null;
  selectedSnapshotDate: string;
  latestSnapshotDate: string;
  availableSnapshotDates: string[];
  metrics: ModeMetric[];
  dataStatus: string;
  dataSource: string;
  onModeChange: (nextValue: AtlasMode) => void;
  onSearchChange: (nextValue: string) => void;
  onRegionChange: (nextValue: AtlasRegionFilter) => void;
  onStatusChange: (nextValue: AtlasStatusFilter) => void;
  onTypeChange: (nextValue: AtlasInstitutionTypeFilter) => void;
  onSnapshotChange: (nextValue: string) => void;
  onUseLatestSnapshot: () => void;
  onLocateSelected: () => void;
}

export function AtlasSidebar({
  mode,
  modeMeta,
  searchQuery,
  resultCount,
  regionFilter,
  statusFilter,
  typeFilter,
  selectedItem,
  selectedSnapshotDate,
  latestSnapshotDate,
  availableSnapshotDates,
  metrics,
  dataStatus,
  dataSource,
  onModeChange,
  onSearchChange,
  onRegionChange,
  onStatusChange,
  onTypeChange,
  onSnapshotChange,
  onUseLatestSnapshot,
  onLocateSelected
}: AtlasSidebarProps) {
  const selection = selectedEntityHint(selectedItem);
  const snapshotTabs = Array.from(new Set([...availableSnapshotDates.slice(-3), selectedSnapshotDate])).sort((a, b) =>
    a.localeCompare(b)
  );
  const isLatest = selectedSnapshotDate === latestSnapshotDate;

  return (
    <aside className="flex h-full min-h-0 flex-col border-r border-[rgba(63,125,72,0.12)] bg-[linear-gradient(180deg,#f6f7f4_0%,#f1f4ee_100%)]">
      <div className="pointer-events-none absolute inset-y-0 left-0 hidden w-[420px] bg-[radial-gradient(circle_at_18%_10%,rgba(186,212,191,0.24),transparent_26%),radial-gradient(circle_at_85%_16%,rgba(255,255,255,0.46),transparent_28%)] xl:block" />

      <div className="relative flex h-full min-h-0 flex-col gap-4 overflow-hidden px-5 py-5">
        <section className="relative overflow-hidden rounded-[1.7rem] border border-[rgba(47,92,69,0.08)] bg-[linear-gradient(145deg,rgba(255,253,246,0.96),rgba(237,247,234,0.9))] px-5 py-5 shadow-[0_18px_42px_rgba(31,48,32,0.08)]">
          <div className="absolute -right-10 -top-12 h-28 w-28 rounded-full bg-[rgba(63,125,72,0.08)] blur-2xl" />
          <span className="inline-flex rounded-full bg-[rgba(63,125,71,0.1)] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--accent)]">
            {modeMeta.kicker}
          </span>
          <h1
            className="mt-4 text-[2.35rem] leading-[1.02] text-[var(--fg)]"
            style={{ fontFamily: "var(--font-display)" }}
          >
            全球熊猫
            <br />
            分布图谱
          </h1>
          <p className="mt-3 text-[14px] leading-7 text-[var(--muted)]">{modeNarrative(mode)}</p>
        </section>

        <section className="rounded-[1.4rem] border border-[rgba(47,92,69,0.08)] bg-white/92 p-4 shadow-[0_14px_32px_rgba(36,49,36,0.05)]">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <p className="text-[12px] font-semibold uppercase tracking-[0.2em] text-[var(--accent)]">阅读模式</p>
              <p className="mt-1 text-[13px] text-[var(--muted)]">切换空间语义与对象层级</p>
            </div>
            <span className="text-[12px] text-[var(--muted)]">{formatDateLabel(selectedSnapshotDate)}</span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {ATLAS_MODES.map((entry) => {
              const active = entry.value === mode;

              return (
                <button
                  key={entry.value}
                  type="button"
                  onClick={() => onModeChange(entry.value)}
                  className={`rounded-[1.1rem] border px-3 py-3 text-left transition-all ${
                    active
                      ? "border-[rgba(63,125,72,0.18)] bg-[rgba(63,125,71,0.08)] shadow-[0_10px_24px_rgba(47,92,69,0.08)]"
                      : "border-[rgba(47,92,69,0.08)] bg-[rgba(247,248,245,0.72)] hover:bg-[rgba(63,125,71,0.05)]"
                  }`}
                >
                  <p className="text-[14px] font-semibold text-[var(--fg)]">{entry.label}</p>
                  <p className="mt-1 text-[12px] leading-5 text-[var(--muted)]">{entry.shortLabel}</p>
                </button>
              );
            })}
          </div>
        </section>

        <section className="rounded-[1.4rem] border border-[rgba(47,92,69,0.08)] bg-white/92 p-4 shadow-[0_14px_32px_rgba(36,49,36,0.05)]">
          <div className="mb-3">
            <p className="text-[12px] font-semibold uppercase tracking-[0.2em] text-[var(--accent)]">搜索与筛选</p>
            <p className="mt-1 text-[13px] text-[var(--muted)]">搜索国家、城市、机构或区域</p>
          </div>

          <div className="space-y-3">
            <Input
              value={searchQuery}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder={ATLAS_SEARCH_PLACEHOLDER}
              className="h-11 rounded-[1rem] border-[rgba(47,92,69,0.08)] bg-[rgba(246,247,244,0.86)] shadow-none"
            />

            <div className="grid grid-cols-2 gap-3">
              <label className="space-y-1.5">
                <span className="text-[12px] text-[var(--muted)]">区域</span>
                <Select
                  value={regionFilter}
                  onChange={(event) => onRegionChange(event.target.value as AtlasRegionFilter)}
                  className="h-11 rounded-[1rem] border-[rgba(47,92,69,0.08)] bg-[rgba(246,247,244,0.86)] shadow-none"
                >
                  {REGION_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </Select>
              </label>

              <label className="space-y-1.5">
                <span className="text-[12px] text-[var(--muted)]">状态</span>
                <Select
                  value={statusFilter}
                  onChange={(event) => onStatusChange(event.target.value as AtlasStatusFilter)}
                  className="h-11 rounded-[1rem] border-[rgba(47,92,69,0.08)] bg-[rgba(246,247,244,0.86)] shadow-none"
                >
                  {STATUS_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </Select>
              </label>

              <label className="col-span-2 space-y-1.5">
                <span className="text-[12px] text-[var(--muted)]">机构类型</span>
                <Select
                  value={typeFilter}
                  onChange={(event) => onTypeChange(event.target.value as AtlasInstitutionTypeFilter)}
                  className="h-11 rounded-[1rem] border-[rgba(47,92,69,0.08)] bg-[rgba(246,247,244,0.86)] shadow-none"
                >
                  {TYPE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </Select>
              </label>
            </div>

            <div className="flex items-center justify-between border-t border-[rgba(47,92,69,0.08)] pt-3 text-[12px] text-[var(--muted)]">
              <span>当前命中 {resultCount} 个对象</span>
              {!isLatest ? (
                <button
                  type="button"
                  onClick={onUseLatestSnapshot}
                  className="font-semibold text-[var(--accent)] transition-colors hover:text-[#2f5c45]"
                >
                  切到最新快照
                </button>
              ) : (
                <span className="text-[var(--accent)]">已是最新</span>
              )}
            </div>
          </div>
        </section>

        <section className="flex-1 rounded-[1.4rem] border border-[rgba(47,92,69,0.08)] bg-white/92 p-4 shadow-[0_14px_32px_rgba(36,49,36,0.05)]">
          <div className="grid h-full grid-rows-[auto_auto_auto_1fr_auto] gap-3">
            <div>
              <p className="text-[12px] font-semibold uppercase tracking-[0.2em] text-[var(--accent)]">模式概览</p>
              <h2
                className="mt-2 text-[1.55rem] leading-tight text-[var(--fg)]"
                style={{ fontFamily: "var(--font-display)" }}
              >
                {modeMeta.label}
              </h2>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {metrics.map((metric) => (
                <div key={metric.label} className="rounded-[1rem] bg-[rgba(63,125,71,0.06)] px-3 py-3">
                  <p className="text-[11px] leading-4 text-[var(--muted)]">{metric.label}</p>
                  <p
                    className="mt-1 text-[1.25rem] leading-none text-[var(--fg)]"
                    style={{ fontFamily: "var(--font-display)" }}
                  >
                    {metric.value}
                  </p>
                  <p className="mt-1 text-[10px] leading-4 text-[var(--muted)]">{metric.note}</p>
                </div>
              ))}
            </div>

            <div className="rounded-[1rem] border border-[rgba(47,92,69,0.08)] bg-[rgba(246,247,244,0.8)] px-3 py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--accent)]">当前选中</p>
                  <p
                    className="mt-1 truncate text-[1.05rem] text-[var(--fg)]"
                    style={{ fontFamily: "var(--font-display)" }}
                  >
                    {selection.title}
                  </p>
                </div>
                {selectedItem ? (
                  <button
                    type="button"
                    onClick={onLocateSelected}
                    className="shrink-0 rounded-full bg-[rgba(63,125,71,0.1)] px-3 py-1.5 text-[11px] font-semibold text-[var(--accent)]"
                  >
                    地图定位
                  </button>
                ) : null}
              </div>
              <p className="mt-2 text-[12px] leading-5 text-[var(--muted)]">{selection.body}</p>
            </div>

            <div className="space-y-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--accent)]">图例</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {modeMeta.legend.map((item) => (
                    <span
                      key={item.label}
                      className="inline-flex items-center gap-2 rounded-full bg-[rgba(246,247,244,0.86)] px-3 py-1.5 text-[11px] text-[var(--fg)]"
                    >
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: item.color }} />
                      {item.label}
                    </span>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--accent)]">快照</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {snapshotTabs.map((snapshot) => {
                    const active = snapshot === selectedSnapshotDate;

                    return (
                      <button
                        key={snapshot}
                        type="button"
                        onClick={() => onSnapshotChange(snapshot)}
                        className={`rounded-full px-3 py-1.5 text-[11px] transition-colors ${
                          active
                            ? "bg-[var(--accent)] text-white"
                            : "bg-[rgba(246,247,244,0.86)] text-[var(--muted)] hover:text-[var(--fg)]"
                        }`}
                      >
                        {formatShortDate(snapshot).replace(".", "/")}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="border-t border-[rgba(47,92,69,0.08)] pt-3 text-[11px] leading-5 text-[var(--muted)]">
              <p>{dataStatus}</p>
              <p className="mt-1">{dataSource}</p>
            </div>
          </div>
        </section>
      </div>
    </aside>
  );
}

"use client";

import { Check, Clipboard, ExternalLink, Play, RotateCcw } from "lucide-react";
import { useMemo, useState, useSyncExternalStore } from "react";

import type {
  OfficialPandaVideoCandidate,
  OfficialPandaVideoSegment,
} from "@/features/home/official-video-candidates";

const STORAGE_KEY = "zhipanda:official-video-audition:v3";
const CHANGE_EVENT = "zhipanda:official-video-audition-change";

function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener(CHANGE_EVENT, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(CHANGE_EVENT, callback);
  };
}

function getSnapshot() {
  return window.localStorage.getItem(STORAGE_KEY) ?? "__DEFAULT_ALL__";
}

function getServerSnapshot() {
  return "__DEFAULT_ALL__";
}

function readSelected(raw: string) {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? new Set(parsed.filter((value): value is string => typeof value === "string"))
      : new Set<string>();
  } catch {
    return new Set<string>();
  }
}

function writeSelected(values: Set<string>) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify([...values]));
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

function keyFor(candidateId: string, segmentId: string) {
  return candidateId + ":" + segmentId;
}

function segmentCuts(
  candidate: OfficialPandaVideoCandidate,
  segment: OfficialPandaVideoSegment,
) {
  return candidate.cutPoints.filter((cut) => cut > segment.start && cut < segment.end);
}

function SegmentButton({
  candidate,
  segment,
  active,
  selected,
  zh,
  onPreview,
  onToggle,
}: {
  candidate: OfficialPandaVideoCandidate;
  segment: OfficialPandaVideoSegment;
  active: boolean;
  selected: boolean;
  zh: boolean;
  onPreview: () => void;
  onToggle: () => void;
}) {
  const internalCuts = segmentCuts(candidate, segment);
  const boundaries = [segment.start, ...internalCuts, segment.end];
  const duration = segment.end - segment.start;
  const shotCount = internalCuts.length + 1;
  const isWholeSourceShot =
    segment.sourceShotStart !== undefined &&
    segment.sourceShotEnd !== undefined &&
    Math.abs(segment.start - segment.sourceShotStart) < 0.01 &&
    Math.abs(segment.end - segment.sourceShotEnd) < 0.01;

  return (
    <div
      className={[
        "grid grid-cols-[1fr_auto] gap-3 rounded-2xl border p-3 transition-colors",
        active ? "border-[#003e40] bg-[#edf4ec]" : "border-[#d8ddd6] bg-white",
      ].join(" ")}
    >
      <button type="button" onClick={onPreview} className="min-w-0 text-left">
        <span className="flex items-center gap-2 text-sm font-[760]">
          <Play className="size-3.5" aria-hidden="true" />
          {zh ? "镜头 " : "Shot "}{segment.label}
          <span className="font-normal text-[#66726a]">
            {segment.start}s–{segment.end}s
          </span>
        </span>
        <span className="mt-1 block text-xs text-[#66726a]">
          {zh ? "熊猫主体" : "Panda primary"}
          {" · "}
          {duration.toFixed(2)}s
          {" · "}
          {isWholeSourceShot
            ? (zh ? "完整原片镜头" : "full source shot")
            : shotCount > 1
              ? (zh ? shotCount + " 个连续原片镜头" : shotCount + " consecutive source shots")
              : (zh ? "原片镜头内窗口" : "window inside source shot")}
        </span>
        <span className="mt-2 flex h-1.5 gap-[2px] overflow-hidden rounded-full bg-[#dfe5df]" aria-hidden="true">
          {boundaries.slice(0, -1).map((start, index) => {
            const end = boundaries[index + 1];
            const width = ((end - start) / duration) * 100;
            return (
              <span
                key={start + ":" + end}
                className="h-full min-w-[3px] rounded-full bg-[#003e40]"
                style={{ width: width + "%" }}
              />
            );
          })}
        </span>
      </button>

      <button
        type="button"
        onClick={onToggle}
        aria-pressed={selected}
        className={[
          "inline-flex size-9 items-center justify-center rounded-full border transition-colors",
          selected
            ? "border-[#003e40] bg-[#003e40] text-[#fffff2]"
            : "border-[#cbd3cd] bg-[#fffff2] text-[#60716b] hover:border-[#003e40]",
        ].join(" ")}
        aria-label={
          zh
            ? (selected ? "取消选择 " : "选择 ") + candidate.title + " " + segment.label
            : (selected ? "Deselect " : "Select ") + candidate.title + " " + segment.label
        }
      >
        <Check className="size-4" aria-hidden="true" />
      </button>
    </div>
  );
}

export function OfficialVideoAuditionClient({
  candidates,
  locale,
}: {
  candidates: OfficialPandaVideoCandidate[];
  locale: "zh" | "en";
}) {
  const zh = locale === "zh";
  const stored = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const allKeys = useMemo(
    () =>
      candidates.flatMap((candidate) =>
        candidate.segments.map((segment) => keyFor(candidate.id, segment.id)),
      ),
    [candidates],
  );
  const selected = useMemo(
    () => (stored === "__DEFAULT_ALL__" ? new Set(allKeys) : readSelected(stored)),
    [allKeys, stored],
  );
  const [previewByCandidate, setPreviewByCandidate] = useState<Record<string, string>>(() =>
    Object.fromEntries(candidates.map((candidate) => [candidate.id, candidate.segments[0]?.id ?? ""])),
  );
  const [copied, setCopied] = useState(false);

  const selectedRows = useMemo(
    () =>
      candidates.flatMap((candidate) =>
        candidate.segments
          .filter((segment) => selected.has(keyFor(candidate.id, segment.id)))
          .map((segment) => ({
            candidateId: candidate.id,
            institution: candidate.institution,
            title: candidate.title,
            youtubeId: candidate.youtubeId,
            sourceUrl: candidate.sourceUrl,
            segmentId: segment.id,
            start: segment.start,
            end: segment.end,
            duration: segment.end - segment.start,
            sourceCuts: segmentCuts(candidate, segment),
            shotCount: segmentCuts(candidate, segment).length + 1,
            use: segment.use,
          })),
      ),
    [candidates, selected],
  );

  const toggle = (key: string) => {
    const next = new Set(selected);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    writeSelected(next);
  };

  const clear = () => {
    writeSelected(new Set());
  };

  const selectAll = () => {
    writeSelected(new Set(allKeys));
  };

  const copy = async () => {
    await navigator.clipboard.writeText(JSON.stringify(selectedRows, null, 2));
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  };

  return (
    <>
      <div className="sticky top-3 z-30 mb-8 flex flex-wrap items-center justify-between gap-3 rounded-full border border-white/10 bg-[#fffff2]/94 px-4 py-3 text-[#002526] shadow-[0_14px_45px_rgba(0,0,0,.18)] backdrop-blur-md">
        <div className="flex min-w-0 items-center gap-3">
          <span className="inline-flex min-w-9 items-center justify-center rounded-full bg-[#fbff36] px-3 py-1.5 text-sm font-[800]">
            {selectedRows.length}
          </span>
          <span className="truncate text-sm font-[700]">
            {zh ? "个片段已加入 shortlist" : "segments in shortlist"}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {selectedRows.length < allKeys.length ? (
            <button
              type="button"
              onClick={selectAll}
              className="inline-flex min-h-9 items-center gap-1.5 rounded-full px-3 text-xs font-semibold text-[#003e40] hover:bg-[#edf0e9]"
            >
              <Check className="size-3.5" aria-hidden="true" />
              {zh ? "全部采用" : "Use all"}
            </button>
          ) : null}
          {selectedRows.length ? (
            <button
              type="button"
              onClick={clear}
              className="inline-flex min-h-9 items-center gap-1.5 rounded-full px-3 text-xs font-semibold text-[#60716b] hover:bg-[#edf0e9]"
            >
              <RotateCcw className="size-3.5" aria-hidden="true" />
              {zh ? "清空" : "Clear"}
            </button>
          ) : null}
          <button
            type="button"
            onClick={copy}
            disabled={!selectedRows.length}
            className="inline-flex min-h-9 items-center gap-1.5 rounded-full bg-[#003e40] px-4 text-xs font-semibold text-[#fffff2] disabled:cursor-not-allowed disabled:opacity-35"
          >
            <Clipboard className="size-3.5" aria-hidden="true" />
            {copied ? (zh ? "已复制" : "Copied") : zh ? "复制已选片段" : "Copy shortlist"}
          </button>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        {candidates.map((candidate, index) => {
          const activeId = previewByCandidate[candidate.id] ?? candidate.segments[0]?.id ?? "";
          const active = candidate.segments.find((segment) => segment.id === activeId)
            ?? candidate.segments[0];
          if (!active) return null;

          const query =
            "?rel=0&playsinline=1&controls=1&start=" +
            active.start +
            "&end=" +
            active.end;

          return (
            <article
              key={candidate.id}
              className="overflow-hidden rounded-[1.6rem] bg-[#fffff2] text-[#002526] shadow-[0_20px_60px_rgba(0,0,0,.16)]"
            >
              <div className="aspect-video bg-black">
                <iframe
                  key={candidate.id + ":" + active.id}
                  className="size-full"
                  src={"https://www.youtube-nocookie.com/embed/" + candidate.youtubeId + query}
                  title={candidate.title + " " + active.label}
                  allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  loading={index < 2 ? "eager" : "lazy"}
                />
              </div>

              <div className="p-5 sm:p-6">
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-[#003e40] px-2.5 py-1 text-[11px] font-semibold text-[#fffff2]">
                    {candidate.institution}
                  </span>
                  <span className="rounded-full bg-[#e8eadf] px-2.5 py-1 text-[11px] font-semibold">
                    {candidate.recommendation === "hero" ? "HERO" : "SECONDARY"}
                  </span>
                  <span className="rounded-full border border-[#d8ddd6] px-2.5 py-1 text-[11px] text-[#66726a]">
                    {candidate.sourceStatus}
                  </span>
                </div>

                <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
                  <div>
                    <h2 className="text-xl font-[780] tracking-[-0.025em]">
                      {candidate.title}
                    </h2>
                    <p className="mt-1.5 text-sm text-[#60716b]">
                      {candidate.subjects} · {candidate.duration}s
                    </p>
                  </div>
                  <a
                    href={candidate.sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex min-h-10 items-center gap-1.5 self-start rounded-full border border-[#002526]/20 px-3.5 text-xs font-semibold hover:bg-[#002526] hover:text-[#fffff2]"
                  >
                    {zh ? "官方源" : "Official source"}
                    <ExternalLink className="size-3.5" aria-hidden="true" />
                  </a>
                </div>

                <div className="mt-5">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <strong className="text-sm">
                      {zh ? "熊猫主体镜头" : "Panda-primary shots"}
                    </strong>
                    <span className="text-xs text-[#66726a]">
                      {candidate.segments.filter((segment) =>
                        selected.has(keyFor(candidate.id, segment.id)),
                      ).length}
                      {zh ? " 个已选" : " selected"}
                    </span>
                  </div>

                  <div className="grid gap-2 sm:grid-cols-2">
                    {candidate.segments.map((segment) => (
                      <SegmentButton
                        key={segment.id}
                        candidate={candidate}
                        segment={segment}
                        active={segment.id === active.id}
                        selected={selected.has(keyFor(candidate.id, segment.id))}
                        zh={zh}
                        onPreview={() =>
                          setPreviewByCandidate((previous) => ({
                            ...previous,
                            [candidate.id]: segment.id,
                          }))
                        }
                        onToggle={() => toggle(keyFor(candidate.id, segment.id))}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </>
  );
}

"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { cn } from "@/lib/utils";

export interface LicensedHeroSequenceItem {
  id: string;
  playbackSrc: string;
  mediaType?: string;
  sourcePage: string;
  creator: string;
  sourceLabel: string;
  sourceLabelUrl: string;
  startAt: number;
  endAt: number;
  objectPosition?: string;
}

type Slot = 0 | 1;
type FrameWatch = { kind: "video" | "animation"; id: number } | null;

const END_GUARD_SECONDS = 0.35;
const START_GUARD_SECONDS = 0.06;
const START_TOLERANCE_SECONDS = 0.08;

export function LicensedHeroVideoSequence({
  items,
  poster,
  className,
  videoClassName,
  creditClassName,
  showCredit = true,
}: {
  items: LicensedHeroSequenceItem[];
  poster?: string | null;
  className?: string;
  videoClassName?: string;
  creditClassName?: string;
  showCredit?: boolean;
}) {
  const initialSlots = useMemo<[number, number]>(
    () => [0, items.length > 1 ? 1 : 0],
    [items.length],
  );

  const [slotIndices, setSlotIndices] = useState<[number, number]>(initialSlots);
  const [activeSlot, setActiveSlot] = useState<Slot>(0);
  const [currentIndex, setCurrentIndex] = useState(initialSlots[0]);
  const [canPlaySequence, setCanPlaySequence] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);

  const slot0Ref = useRef<HTMLVideoElement>(null);
  const slot1Ref = useRef<HTMLVideoElement>(null);
  const refs = useMemo(() => [slot0Ref, slot1Ref] as const, []);

  const slotIndicesRef = useRef<[number, number]>(initialSlots);
  const activeSlotRef = useRef<Slot>(0);
  const readySlotsRef = useRef<[boolean, boolean]>([false, false]);
  const pendingAdvanceRef = useRef(false);
  const switchingRef = useRef(false);
  const startedRef = useRef(false);
  const frameWatchRef = useRef<[FrameWatch, FrameWatch]>([null, null]);

  const current = items[currentIndex] ?? null;

  useEffect(() => {
    const width = window.matchMedia("(min-width: 768px)");
    const motion = window.matchMedia("(prefers-reduced-motion: no-preference)");

    const sync = () => setCanPlaySequence(width.matches && motion.matches);
    const frame = requestAnimationFrame(sync);

    width.addEventListener("change", sync);
    motion.addEventListener("change", sync);

    return () => {
      cancelAnimationFrame(frame);
      width.removeEventListener("change", sync);
      motion.removeEventListener("change", sync);
    };
  }, []);

  const itemForSlot = (slot: Slot) =>
    items[slotIndicesRef.current[slot]] ?? null;

  const cancelFrameWatch = (slot: Slot) => {
    const video = refs[slot].current;
    const watch = frameWatchRef.current[slot];
    if (!watch) return;

    if (
      watch.kind === "video" &&
      video &&
      typeof video.cancelVideoFrameCallback === "function"
    ) {
      video.cancelVideoFrameCallback(watch.id);
    } else if (watch.kind === "animation") {
      cancelAnimationFrame(watch.id);
    }

    frameWatchRef.current[slot] = null;
  };

  const markSlotReady = (slot: Slot, ready: boolean) => {
    readySlotsRef.current[slot] = ready;
  };

  const playSlot = async (slot: Slot) => {
    const video = refs[slot].current;
    if (!video) return;

    try {
      await video.play();
    } catch {
      // Browser autoplay policy may block playback; the poster remains available.
    }
  };

  const switchToStandby = () => {
    if (switchingRef.current || items.length < 2) return;

    const oldActive = activeSlotRef.current;
    const nextActive: Slot = oldActive === 0 ? 1 : 0;
    const oldVideo = refs[oldActive].current;

    if (!readySlotsRef.current[nextActive]) {
      pendingAdvanceRef.current = true;
      oldVideo?.pause();
      return;
    }

    switchingRef.current = true;
    pendingAdvanceRef.current = false;
    cancelFrameWatch(oldActive);

    const nextIndex = slotIndicesRef.current[nextActive];
    const followingIndex = (nextIndex + 1) % items.length;

    oldVideo?.pause();

    activeSlotRef.current = nextActive;
    setActiveSlot(nextActive);
    setCurrentIndex(nextIndex);

    void playSlot(nextActive);

    slotIndicesRef.current[oldActive] = followingIndex;
    markSlotReady(oldActive, false);
    setSlotIndices([...slotIndicesRef.current] as [number, number]);

    requestAnimationFrame(() => {
      switchingRef.current = false;
    });
  };

  const stopAtBoundary = (slot: Slot) => {
    if (slot !== activeSlotRef.current || switchingRef.current) return;
    refs[slot].current?.pause();
    switchToStandby();
  };

  const startFrameWatch = (slot: Slot, item: LicensedHeroSequenceItem) => {
    cancelFrameWatch(slot);

    const video = refs[slot].current;
    if (!video) return;

    const threshold = Math.max(item.startAt, item.endAt - END_GUARD_SECONDS);

    if (typeof video.requestVideoFrameCallback === "function") {
      const tick: VideoFrameRequestCallback = (_now, metadata) => {
        if (slot !== activeSlotRef.current) {
          frameWatchRef.current[slot] = null;
          return;
        }

        if (metadata.mediaTime >= threshold) {
          frameWatchRef.current[slot] = null;
          stopAtBoundary(slot);
          return;
        }

        const id = video.requestVideoFrameCallback(tick);
        frameWatchRef.current[slot] = { kind: "video", id };
      };

      const id = video.requestVideoFrameCallback(tick);
      frameWatchRef.current[slot] = { kind: "video", id };
      return;
    }

    const tick = () => {
      if (slot !== activeSlotRef.current) {
        frameWatchRef.current[slot] = null;
        return;
      }

      if (video.currentTime >= threshold) {
        frameWatchRef.current[slot] = null;
        stopAtBoundary(slot);
        return;
      }

      const id = requestAnimationFrame(tick);
      frameWatchRef.current[slot] = { kind: "animation", id };
    };

    const id = requestAnimationFrame(tick);
    frameWatchRef.current[slot] = { kind: "animation", id };
  };

  const startActiveSlot = (slot: Slot) => {
    const item = itemForSlot(slot);
    if (!item || slot !== activeSlotRef.current) return;

    if (!startedRef.current) {
      startedRef.current = true;
      setHasStarted(true);
    }

    void playSlot(slot);
    startFrameWatch(slot, item);
  };

  const prepareSlot = (slot: Slot) => {
    const video = refs[slot].current;
    const item = itemForSlot(slot);
    if (!video || !item || !Number.isFinite(video.duration)) return;

    cancelFrameWatch(slot);
    markSlotReady(slot, false);

    const safeStart = Math.min(
      item.startAt + START_GUARD_SECONDS,
      Math.max(0, video.duration - 0.25),
      Math.max(item.startAt, item.endAt - END_GUARD_SECONDS - 0.08),
    );

    if (Math.abs(video.currentTime - safeStart) <= START_TOLERANCE_SECONDS) {
      markSlotReady(slot, true);
      if (slot === activeSlotRef.current) startActiveSlot(slot);
      return;
    }

    video.currentTime = safeStart;
  };

  const confirmPreparedSlot = (slot: Slot) => {
    const video = refs[slot].current;
    const item = itemForSlot(slot);
    if (!video || !item || video.readyState < 2) return;

    const safeStart = Math.min(
      item.startAt + START_GUARD_SECONDS,
      Math.max(0, video.duration - 0.25),
      Math.max(item.startAt, item.endAt - END_GUARD_SECONDS - 0.08),
    );

    if (Math.abs(video.currentTime - safeStart) > START_TOLERANCE_SECONDS) {
      return;
    }

    markSlotReady(slot, true);

    if (slot === activeSlotRef.current) {
      startActiveSlot(slot);
    } else if (pendingAdvanceRef.current) {
      requestAnimationFrame(switchToStandby);
    }
  };

  useEffect(() => {
    return () => {
      cancelFrameWatch(0);
      cancelFrameWatch(1);
    };
    // refs is stable for the component lifetime.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!current) return null;

  return (
    <div className={cn("relative size-full overflow-hidden bg-black", className)}>
      {poster ? (
        <div
          data-hero-poster="true"
          className={cn(
            "absolute inset-0 bg-cover bg-center transition-opacity duration-150",
            hasStarted ? "opacity-0" : "opacity-100",
          )}
          style={{ backgroundImage: `url("${poster}")` }}
          aria-hidden="true"
        />
      ) : null}

      {canPlaySequence
        ? ([0, 1] as Slot[]).map((slot) => {
            const item = items[slotIndices[slot]] ?? null;
            if (!item) return null;
            const isActive = slot === activeSlot;

            return (
              <video
                key={`${slot}:${item.id}`}
                ref={refs[slot]}
                data-hero-video-slot={slot}
                data-hero-video-active={isActive ? "true" : "false"}
                data-hero-video-item={item.id}
                data-hero-video-start={item.startAt}
                data-hero-video-end={item.endAt}
                className={cn(
                  "pointer-events-none absolute inset-0 size-full object-cover",
                  isActive ? "z-[2] opacity-100" : "z-[1] opacity-0",
                  videoClassName,
                )}
                style={{ objectPosition: item.objectPosition ?? "center center" }}
                muted
                playsInline
                preload="auto"
                aria-hidden="true"
                tabIndex={-1}
                onLoadedMetadata={() => prepareSlot(slot)}
                onSeeked={() => confirmPreparedSlot(slot)}
                onCanPlay={() => confirmPreparedSlot(slot)}
                onPlaying={() => {
                  if (slot === activeSlotRef.current) {
                    startFrameWatch(slot, item);
                  }
                }}
                onTimeUpdate={(event) => {
                  if (slot !== activeSlotRef.current) return;
                  if (
                    event.currentTarget.currentTime >=
                    item.endAt - END_GUARD_SECONDS
                  ) {
                    stopAtBoundary(slot);
                  }
                }}
                onEnded={() => {
                  if (slot === activeSlotRef.current) stopAtBoundary(slot);
                }}
                onError={() => {
                  if (slot === activeSlotRef.current) stopAtBoundary(slot);
                }}
              >
                <source
                  src={item.playbackSrc}
                  type={item.mediaType ?? "video/webm"}
                />
              </video>
            );
          })
        : null}

      {showCredit ? (
        <div
          className={cn(
            "absolute bottom-3 right-3 z-10 rounded-full bg-black/34 px-2.5 py-1 text-[10px] leading-4 text-white/86 backdrop-blur-sm",
            creditClassName,
          )}
        >
          <a
            href={current.sourcePage}
            target="_blank"
            rel="noreferrer"
            className="hover:text-white"
          >
            {current.creator}
          </a>
          <span aria-hidden="true"> · </span>
          <a
            href={current.sourceLabelUrl}
            target="_blank"
            rel="noreferrer"
            className="hover:text-white"
          >
            {current.sourceLabel}
          </a>
        </div>
      ) : null}
    </div>
  );
}

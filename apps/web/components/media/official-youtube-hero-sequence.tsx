"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import type { OfficialPandaHeroPlaylistItem } from "@/features/home/official-video-shot-pool";
import { cn } from "@/lib/utils";

interface YouTubeVideoSpec {
  videoId: string;
  startSeconds: number;
  endSeconds: number;
}

interface YouTubePlayer {
  mute(): void;
  playVideo(): void;
  pauseVideo(): void;
  destroy(): void;
  cueVideoById(spec: YouTubeVideoSpec): void;
  loadVideoById(spec: YouTubeVideoSpec): void;
  getCurrentTime(): number;
  setPlaybackQuality?(quality: string): void;
}

interface YouTubePlayerEvent {
  target: YouTubePlayer;
  data: number;
}

interface YouTubeNamespace {
  Player: new (
    element: HTMLElement,
    options: {
      width: string;
      height: string;
      host?: string;
      playerVars: Record<string, string | number>;
      events: {
        onReady: (event: YouTubePlayerEvent) => void;
        onStateChange: (event: YouTubePlayerEvent) => void;
        onError: () => void;
      };
    },
  ) => YouTubePlayer;
  PlayerState: {
    ENDED: number;
    PLAYING: number;
    PAUSED: number;
    CUED: number;
  };
}

declare global {
  interface Window {
    YT?: YouTubeNamespace;
  }
}

let youtubeApiPromise: Promise<YouTubeNamespace> | null = null;

function loadYouTubeApi() {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("YouTube API requires a browser"));
  }
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (youtubeApiPromise) return youtubeApiPromise;

  youtubeApiPromise = new Promise<YouTubeNamespace>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      'script[src="https://www.youtube.com/iframe_api"]',
    );

    if (!existing) {
      const script = document.createElement("script");
      script.src = "https://www.youtube.com/iframe_api";
      script.async = true;
      document.head.appendChild(script);
    }

    const startedAt = performance.now();
    const timer = window.setInterval(() => {
      if (window.YT?.Player) {
        window.clearInterval(timer);
        resolve(window.YT);
        return;
      }
      if (performance.now() - startedAt > 15000) {
        window.clearInterval(timer);
        youtubeApiPromise = null;
        reject(new Error("YouTube API timed out"));
      }
    }, 80);
  });

  return youtubeApiPromise;
}

type Slot = 0 | 1;

export function OfficialYouTubeHeroSequence({
  items,
  poster,
  className,
  frameClassName,
  creditClassName,
}: {
  items: OfficialPandaHeroPlaylistItem[];
  poster?: string | null;
  className?: string;
  frameClassName?: string;
  creditClassName?: string;
}) {
  const initialIndices = useMemo<[number, number]>(
    () => [0, items.length > 1 ? 1 : 0],
    [items.length],
  );
  const host0Ref = useRef<HTMLDivElement>(null);
  const host1Ref = useRef<HTMLDivElement>(null);
  const hostRefs = useMemo(
    () => [host0Ref, host1Ref] as const,
    [],
  );
  const playersRef = useRef<[YouTubePlayer | null, YouTubePlayer | null]>([
    null,
    null,
  ]);
  const indicesRef = useRef<[number, number]>(initialIndices);
  const activeSlotRef = useRef<Slot>(0);
  const pendingSlotRef = useRef<Slot | null>(null);
  const switchingRef = useRef(false);
  const startedRef = useRef(false);
  const [activeSlot, setActiveSlot] = useState<Slot>(0);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [canPlay, setCanPlay] = useState(false);
  const [started, setStarted] = useState(false);

  const current = items[currentIndex] ?? null;

  useEffect(() => {
    const width = window.matchMedia("(min-width: 768px)");
    const motion = window.matchMedia("(prefers-reduced-motion: no-preference)");

    const sync = () => setCanPlay(width.matches && motion.matches);
    const frame = requestAnimationFrame(sync);
    width.addEventListener("change", sync);
    motion.addEventListener("change", sync);

    return () => {
      cancelAnimationFrame(frame);
      width.removeEventListener("change", sync);
      motion.removeEventListener("change", sync);
    };
  }, []);

  useEffect(() => {
    if (!canPlay || items.length === 0) return;

    let cancelled = false;
    let monitor = 0;
    const players = playersRef.current;

    const specFor = (index: number): YouTubeVideoSpec => {
      const item = items[index % items.length];
      return {
        videoId: item.youtubeId,
        startSeconds: item.start,
        endSeconds: item.end,
      };
    };

    const prepareStandby = (slot: Slot, index: number) => {
      const player = players[slot];
      if (!player) return;
      indicesRef.current[slot] = index % items.length;
      player.cueVideoById(specFor(index));
    };

    const beginSwitch = () => {
      if (switchingRef.current || items.length < 2) return;
      const nextSlot: Slot = activeSlotRef.current === 0 ? 1 : 0;
      const nextPlayer = players[nextSlot];
      if (!nextPlayer) return;

      switchingRef.current = true;
      pendingSlotRef.current = nextSlot;
      nextPlayer.mute();
      nextPlayer.setPlaybackQuality?.("hd1080");
      nextPlayer.playVideo();
    };

    const finishSwitch = (nextSlot: Slot) => {
      if (pendingSlotRef.current !== nextSlot) return;

      const previousSlot = activeSlotRef.current;
      const previousPlayer = players[previousSlot];
      const nextIndex = indicesRef.current[nextSlot];
      const followingIndex = (nextIndex + 1) % items.length;

      activeSlotRef.current = nextSlot;
      setActiveSlot(nextSlot);
      setCurrentIndex(nextIndex);
      if (!startedRef.current) {
        startedRef.current = true;
        setStarted(true);
      }
      previousPlayer?.pauseVideo();

      pendingSlotRef.current = null;
      switchingRef.current = false;
      prepareStandby(previousSlot, followingIndex);
    };

    loadYouTubeApi()
      .then((YT) => {
        if (cancelled) return;

        ([0, 1] as Slot[]).forEach((slot) => {
          const host = hostRefs[slot].current;
          if (!host) return;

          players[slot] = new YT.Player(host, {
            width: "100%",
            height: "100%",
            host: "https://www.youtube-nocookie.com",
            playerVars: {
              controls: 0,
              disablekb: 1,
              fs: 0,
              iv_load_policy: 3,
              playsinline: 1,
              rel: 0,
              modestbranding: 1,
              origin: window.location.origin,
            },
            events: {
              onReady: ({ target }) => {
                target.mute();
                target.setPlaybackQuality?.("hd1080");

                const index = indicesRef.current[slot];
                if (slot === 0) {
                  target.loadVideoById(specFor(index));
                } else {
                  target.cueVideoById(specFor(index));
                }
              },
              onStateChange: (event) => {
                if (event.data === YT.PlayerState.PLAYING) {
                  if (slot === activeSlotRef.current && !startedRef.current) {
                    startedRef.current = true;
                    setStarted(true);
                  }
                  if (pendingSlotRef.current === slot) {
                    finishSwitch(slot);
                  }
                }
                if (
                  event.data === YT.PlayerState.ENDED &&
                  slot === activeSlotRef.current
                ) {
                  beginSwitch();
                }
              },
              onError: () => {
                if (slot === activeSlotRef.current) beginSwitch();
              },
            },
          });
        });

        monitor = window.setInterval(() => {
          const slot = activeSlotRef.current;
          const player = players[slot];
          const item = items[indicesRef.current[slot]];
          if (!player || !item || switchingRef.current) return;

          const currentTime = player.getCurrentTime();
          if (currentTime >= item.end - 0.08) {
            beginSwitch();
          }
        }, 100);
      })
      .catch(() => {
        setCanPlay(false);
      });

    return () => {
      cancelled = true;
      if (monitor) window.clearInterval(monitor);
      players.forEach((player, index) => {
        player?.destroy();
        players[index as Slot] = null;
      });
      pendingSlotRef.current = null;
      switchingRef.current = false;
      startedRef.current = false;
    };
  }, [canPlay, hostRefs, items]);

  if (!current) return null;

  return (
    <div className={cn("relative size-full overflow-hidden bg-black", className)}>
      {poster ? (
        <div
          className={cn(
            "absolute inset-0 z-0 bg-cover bg-center transition-opacity duration-200",
            started ? "opacity-0" : "opacity-100",
          )}
          style={{ backgroundImage: `url("${poster}")` }}
          aria-hidden="true"
        />
      ) : null}

      {canPlay
        ? ([0, 1] as Slot[]).map((slot) => (
            <div
              key={slot}
              className={cn(
                "pointer-events-none absolute inset-0 overflow-hidden",
                slot === activeSlot ? "z-[2] opacity-100" : "z-[1] opacity-0",
                frameClassName,
              )}
              aria-hidden="true"
            >
              <div
                ref={hostRefs[slot]}
                className="absolute left-1/2 top-1/2 h-[56.25vw] min-h-full w-[177.78vh] min-w-full -translate-x-1/2 -translate-y-1/2"
              />
            </div>
          ))
        : null}

      <div
        className={cn(
          "absolute bottom-3 right-3 z-10 rounded-full bg-black/34 px-2.5 py-1 text-[10px] leading-4 text-white/86 backdrop-blur-sm",
          creditClassName,
        )}
      >
        <a
          href={current.sourceUrl}
          target="_blank"
          rel="noreferrer"
          className="hover:text-white"
        >
          {current.institution}
        </a>
        <span aria-hidden="true"> · </span>
        <span>{current.subjects}</span>
      </div>
    </div>
  );
}

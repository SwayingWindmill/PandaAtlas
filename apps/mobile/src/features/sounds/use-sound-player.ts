import { setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus } from "expo-audio";
import { useCallback, useEffect, useState } from "react";

import { AUDIO_SOURCES } from "./audio-assets";
import type { PandaSoundId } from "./catalog";

export interface SoundPlayerController {
  activeId: PandaSoundId;
  isPlaying: boolean;
  progress: number;
  toggle: (id?: PandaSoundId) => void;
  selectClip: (id: PandaSoundId, autoPlay?: boolean) => void;
}

/** Single-track player controller backed by expo-audio with graceful web fallback. */
export function useSoundPlayer(initialId: PandaSoundId = "panda-twittering"): SoundPlayerController {
  const [activeId, setActiveId] = useState<PandaSoundId>(initialId);
  const [loadedId, setLoadedId] = useState<PandaSoundId | null>(null);
  const player = useAudioPlayer(null, { updateInterval: 150 });
  const status = useAudioPlayerStatus(player);

  useEffect(() => {
    void setAudioModeAsync({ playsInSilentMode: true }).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!status.didJustFinish) return;
    try {
      player.pause();
      void player.seekTo(0).catch(() => undefined);
    } catch {
      // Ignore cleanup failures in headless environments.
    }
  }, [player, status.didJustFinish]);

  const startClip = useCallback(
    (id: PandaSoundId) => {
      try {
        if (loadedId !== id) {
          setLoadedId(id);
          player.replace(AUDIO_SOURCES[id]);
        } else if (status.duration > 0 && status.currentTime >= status.duration - 0.15) {
          void player.seekTo(0).catch(() => undefined);
        }
        player.play();
      } catch {
        // Ignore playback errors in environments without audio output devices.
      }
    },
    [loadedId, player, status.currentTime, status.duration],
  );

  const toggle = useCallback(
    (targetId?: PandaSoundId) => {
      const id = targetId ?? activeId;
      if (loadedId === id && status.playing) {
        try {
          player.pause();
        } catch {
          // Ignore pause errors when audio backend is inactive.
        }
        return;
      }
      setActiveId(id);
      startClip(id);
    },
    [activeId, loadedId, player, startClip, status.playing],
  );

  const selectClip = useCallback(
    (id: PandaSoundId, autoPlay = false) => {
      const same = activeId === id;
      setActiveId(id);
      if (autoPlay) {
        if (same && status.playing) return;
        startClip(id);
        return;
      }
      if (!same && status.playing) {
        startClip(id);
      }
    },
    [activeId, startClip, status.playing],
  );

  const progress =
    loadedId === activeId && status.duration > 0
      ? Math.max(0, Math.min(1, status.currentTime / status.duration))
      : 0;

  return {
    activeId,
    isPlaying: loadedId === activeId && status.playing,
    progress,
    toggle,
    selectClip,
  };
}

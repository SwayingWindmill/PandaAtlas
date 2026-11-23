import type { PandaSoundId } from "./catalog";

export const AUDIO_SOURCES: Record<PandaSoundId, number> = {
  "panda-twittering": require("../../../assets/audio/panda-twittering.mp3"),
  "bamboo-eating-long": require("../../../assets/audio/bamboo-eating-long.mp3"),
  "bamboo-eating-short": require("../../../assets/audio/bamboo-eating-short.mp3"),
  "memphis-ambient": require("../../../assets/audio/memphis-ambient.mp3"),
  "cub-moscow-ambient": require("../../../assets/audio/cub-moscow-ambient.mp3"),
};

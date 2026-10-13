import { OFFICIAL_PANDA_HERO_PLAYLIST } from "./official-video-shot-pool";

export interface ZhiPandaBrandVideoAsset {
  id: string;
  subjects: string[];
  institution: string;
  sourcePage: string;
  playbackSrc: string;
  mediaType: "video/webm" | "video/mp4";
  creator: string;
  sourceLabel: string;
  sourceLabelUrl: string;
  startAt: number;
  endAt: number;
  objectPosition?: string;
  notes: string;
}

const OFFICIAL_MEDIA_BY_YOUTUBE_ID: Record<
  string,
  { playbackSrc: string; mediaType: "video/webm" | "video/mp4" }
> = {
  "wTVtbr-R4yA": {
    playbackSrc: "/media/home-official/wTVtbr-R4yA.webm",
    mediaType: "video/webm",
  },
  ebcCgSRobc4: {
    playbackSrc: "/media/home-official/ebcCgSRobc4.webm",
    mediaType: "video/webm",
  },
  f9KVNw799aE: {
    playbackSrc: "/media/home-official/f9KVNw799aE.webm",
    mediaType: "video/webm",
  },
  pgxIO6nyZEY: {
    playbackSrc: "/media/home-official/pgxIO6nyZEY.webm",
    mediaType: "video/webm",
  },
  "s-lxbWhtq40": {
    playbackSrc: "/media/home-official/s-lxbWhtq40.webm",
    mediaType: "video/webm",
  },
  pNff91GIIUg: {
    playbackSrc: "/media/home-official/pNff91GIIUg.webm",
    mediaType: "video/webm",
  },
  CNnEP98dul4: {
    playbackSrc: "/media/home-official/CNnEP98dul4.mp4",
    mediaType: "video/mp4",
  },
  "l10zoaT-Q04": {
    playbackSrc: "/media/home-official/l10zoaT-Q04.webm",
    mediaType: "video/webm",
  },
  wKR67WFrlj8: {
    playbackSrc: "/media/home-official/wKR67WFrlj8.webm",
    mediaType: "video/webm",
  },
};

export const ZHIPANDA_HOME_HERO_VIDEOS: ZhiPandaBrandVideoAsset[] =
  OFFICIAL_PANDA_HERO_PLAYLIST.map((item) => {
    const media = OFFICIAL_MEDIA_BY_YOUTUBE_ID[item.youtubeId];

    if (!media) {
      throw new Error(`Missing local official Hero media for YouTube source ${item.youtubeId}`);
    }

    return {
      id: item.id,
      subjects: [item.subjects],
      institution: item.institution,
      sourcePage: item.sourceUrl,
      playbackSrc: media.playbackSrc,
      mediaType: media.mediaType,
      creator: item.institution,
      sourceLabel: "Official source",
      sourceLabelUrl: item.sourceUrl,
      startAt: item.start,
      endAt: item.end,
      notes: "Panda-primary official-source segment aligned to source-video edit boundaries.",
    };
  });

import type {
  OfficialPandaVideoCandidate,
  OfficialPandaVideoSegment,
} from "./official-video-candidates";

export interface OfficialPandaVideoShotPoolCandidate extends OfficialPandaVideoCandidate {
  acceptedSourceShots: Array<[number, number]>;
}

function roundTime(value: number) {
  return Math.round(value * 100) / 100;
}

function buildCutAlignedHeroSegments(
  acceptedSourceShots: Array<[number, number]>,
): OfficialPandaVideoSegment[] {
  const segments: OfficialPandaVideoSegment[] = [];
  let index = 0;

  while (index < acceptedSourceShots.length) {
    const [sourceStart, sourceEnd] = acceptedSourceShots[index];
    const duration = sourceEnd - sourceStart;

    if (duration >= 3 && duration <= 8) {
      segments.push({
        id: `shot-${segments.length + 1}`,
        start: roundTime(sourceStart),
        end: roundTime(sourceEnd),
        label: String(segments.length + 1).padStart(2, "0"),
        use: "hero",
        sourceShotStart: sourceStart,
        sourceShotEnd: sourceEnd,
      });
      index += 1;
      continue;
    }

    // A long source shot has no internal source cut. Do not create an artificial
    // montage cut inside it just to force a fixed Hero duration.
    if (duration > 8) {
      index += 1;
      continue;
    }

    // Very short accepted shots may be grouped only when they are adjacent in
    // the original edit. Every source cut remains present inside the segment.
    let end = sourceEnd;
    let nextIndex = index + 1;

    while (nextIndex < acceptedSourceShots.length) {
      const [nextStart, nextEnd] = acceptedSourceShots[nextIndex];
      if (Math.abs(nextStart - end) > 0.02) break;
      if (nextEnd - sourceStart > 8) break;

      end = nextEnd;
      nextIndex += 1;
      if (end - sourceStart >= 3) break;
    }

    const groupedDuration = end - sourceStart;
    if (groupedDuration >= 3 && groupedDuration <= 8) {
      segments.push({
        id: `shot-${segments.length + 1}`,
        start: roundTime(sourceStart),
        end: roundTime(end),
        label: String(segments.length + 1).padStart(2, "0"),
        use: "hero",
        sourceShotStart: sourceStart,
        sourceShotEnd: end,
      });
      index = nextIndex;
    } else {
      index += 1;
    }
  }

  return segments;
}

function makeCandidate(
  input: Omit<OfficialPandaVideoShotPoolCandidate, "segments" | "sourceStatus">,
): OfficialPandaVideoShotPoolCandidate {
  return {
    ...input,
    sourceStatus: "官方源 · 熊猫主体 · 人物密集扫描通过 · 原片切点对齐",
    segments: buildCutAlignedHeroSegments(input.acceptedSourceShots),
  };
}

export const OFFICIAL_PANDA_VIDEO_SHOT_POOL: OfficialPandaVideoShotPoolCandidate[] = [
  makeCandidate({
    id: "smithsonian-public-debut",
    institution: "Smithsonian's National Zoo",
    title: "#DCPandas: Giant Pandas Bao Li and Qing Bao",
    youtubeId: "wTVtbr-R4yA",
    duration: 158.45,
    subjects: "Bao Li / Qing Bao",
    sourceUrl: "https://www.youtube.com/watch?v=wTVtbr-R4yA",
    recommendation: "hero",
    cutPoints: [5, 19.25, 23.25, 30.5, 36.5, 40, 44.25, 50.75, 54.5, 68.25, 75.5, 80.75, 99.5, 109, 118.25, 119.75, 123, 126.5, 131.5, 141.75, 145.25, 149],
    acceptedSourceShots: [
      [5, 19.25], [19.25, 23.25], [30.5, 36.5], [36.5, 40],
      [40, 44.25], [44.25, 50.75], [50.75, 54.5], [68.25, 75.5],
      [75.5, 80.75], [99.5, 109], [109, 118.25], [118.25, 119.75],
      [119.75, 123], [123, 126.5], [126.5, 131.5], [131.5, 141.75],
      [141.75, 145.25], [145.25, 149],
    ],
  }),
  makeCandidate({
    id: "smithsonian-snow-2025",
    institution: "Smithsonian's National Zoo",
    title: "Bao Li and Qing Bao Play In The Snow",
    youtubeId: "ebcCgSRobc4",
    duration: 82.67,
    subjects: "Bao Li / Qing Bao",
    sourceUrl: "https://www.youtube.com/watch?v=ebcCgSRobc4",
    recommendation: "hero",
    cutPoints: [5.5, 9, 14.25, 22, 32, 51.75, 61.75, 65.25, 76.5],
    acceptedSourceShots: [
      [0, 5.5], [22, 32], [61.75, 65.25], [65.25, 76.5],
    ],
  }),
  makeCandidate({
    id: "smithsonian-autumn",
    institution: "Smithsonian's National Zoo",
    title: "Qing Bao in Autumn",
    youtubeId: "f9KVNw799aE",
    duration: 60.02,
    subjects: "Qing Bao",
    sourceUrl: "https://www.youtube.com/watch?v=f9KVNw799aE",
    recommendation: "hero",
    cutPoints: [4, 10.75, 13.5, 19.5, 24.25, 38.75, 41, 54.25],
    acceptedSourceShots: [
      [0, 4], [4, 10.75], [10.75, 13.5], [19.5, 24.25],
      [24.25, 38.75], [41, 54.25], [54.25, 60.02],
    ],
  }),
  makeCandidate({
    id: "smithsonian-settling-in",
    institution: "Smithsonian's National Zoo",
    title: "Bao Li and Qing Bao Settle In To Their New Home",
    youtubeId: "pgxIO6nyZEY",
    duration: 58.1,
    subjects: "Bao Li / Qing Bao",
    sourceUrl: "https://www.youtube.com/watch?v=pgxIO6nyZEY",
    recommendation: "hero",
    cutPoints: [7.5, 18.75, 23.5, 26.25, 31.5, 34.75, 42.5, 46.25, 53.25],
    acceptedSourceShots: [
      [0, 7.5], [7.5, 18.75], [18.75, 23.5], [23.5, 26.25],
      [26.25, 31.5], [31.5, 34.75], [34.75, 42.5], [42.5, 46.25],
      [46.25, 53.25], [53.25, 58.1],
    ],
  }),
  makeCandidate({
    id: "smithsonian-snow-social-2026",
    institution: "Smithsonian's National Zoo",
    title: "Bao Li and Qing Bao Socialize in the Snow",
    youtubeId: "s-lxbWhtq40",
    duration: 60.17,
    subjects: "Bao Li / Qing Bao",
    sourceUrl: "https://www.youtube.com/watch?v=s-lxbWhtq40",
    recommendation: "secondary",
    cutPoints: [12.5, 17.5, 21, 26, 31, 38.25, 44.5, 54.5],
    acceptedSourceShots: [[21, 26]],
  }),
  makeCandidate({
    id: "smithsonian-snow-2019",
    institution: "Smithsonian's National Zoo",
    title: "Giant pandas in the snow",
    youtubeId: "pNff91GIIUg",
    duration: 44.63,
    subjects: "Mei Xiang / Bei Bei",
    sourceUrl: "https://www.youtube.com/watch?v=pNff91GIIUg",
    recommendation: "secondary",
    cutPoints: [3.6, 6, 8.4, 10.6, 13.6, 17, 19.2, 22, 24.8, 30, 33.8, 37, 41],
    acceptedSourceShots: [
      [6, 8.4], [8.4, 10.6], [10.6, 13.6], [13.6, 17], [22, 24.8],
    ],
  }),
  makeCandidate({
    id: "sandiego-intro",
    institution: "San Diego Zoo",
    title: "Announcing San Diego Zoo's Panda Pair",
    youtubeId: "CNnEP98dul4",
    duration: 39.84,
    subjects: "Yun Chuan / Xin Bao",
    sourceUrl: "https://www.youtube.com/watch?v=CNnEP98dul4",
    recommendation: "hero",
    cutPoints: [4.8, 6.4, 7.4, 8.6, 12.2, 19.8, 26.4, 30.2],
    acceptedSourceShots: [
      [0, 4.8], [4.8, 6.4], [6.4, 7.4], [7.4, 8.6], [8.6, 12.2],
      [12.2, 19.8], [19.8, 26.4], [26.4, 30.2], [30.2, 39.84],
    ],
  }),
  makeCandidate({
    id: "sandiego-campaign",
    institution: "San Diego Zoo",
    title: "See Giant Pandas For The First Time",
    youtubeId: "l10zoaT-Q04",
    duration: 30.03,
    subjects: "Yun Chuan / Xin Bao",
    sourceUrl: "https://www.youtube.com/watch?v=l10zoaT-Q04",
    recommendation: "hero",
    cutPoints: [1.8, 3.6, 6.8, 7.8, 8.8, 10.2, 13.8, 15, 16, 17.4, 18, 18.6, 20.6, 24.4, 28.2],
    acceptedSourceShots: [[20.6, 24.4], [24.4, 28.2]],
  }),
  makeCandidate({
    id: "ipanda-keeper-2026",
    institution: "iPanda / CCTV.com",
    title: "Panda Academy: The Right Distance Between Keepers And Pandas",
    youtubeId: "wKR67WFrlj8",
    duration: 195.83,
    subjects: "Giant panda",
    sourceUrl: "https://www.youtube.com/watch?v=wKR67WFrlj8",
    recommendation: "secondary",
    cutPoints: [9.75, 13.5, 19, 23.5, 86.5, 105.25, 132.25, 140.5, 145.5, 153.75, 193],
    acceptedSourceShots: [
      [132.25, 140.5], [140.5, 145.5],
    ],
  }),
];

export const OFFICIAL_PANDA_VIDEO_SHOT_POOL_SOURCE_COUNT =
  OFFICIAL_PANDA_VIDEO_SHOT_POOL.length;

export const OFFICIAL_PANDA_VIDEO_SHOT_POOL_SOURCE_SHOT_COUNT =
  OFFICIAL_PANDA_VIDEO_SHOT_POOL.reduce(
    (total, candidate) => total + candidate.acceptedSourceShots.length,
    0,
  );

export const OFFICIAL_PANDA_VIDEO_SHOT_POOL_SEGMENT_COUNT =
  OFFICIAL_PANDA_VIDEO_SHOT_POOL.reduce(
    (total, candidate) => total + candidate.segments.length,
    0,
  );

export interface OfficialPandaHeroPlaylistItem {
  id: string;
  youtubeId: string;
  start: number;
  end: number;
  institution: string;
  title: string;
  subjects: string;
  sourceUrl: string;
}

function buildRoundRobinPlaylist(
  candidates: OfficialPandaVideoShotPoolCandidate[],
): OfficialPandaHeroPlaylistItem[] {
  const maxSegments = Math.max(...candidates.map((candidate) => candidate.segments.length));
  const playlist: OfficialPandaHeroPlaylistItem[] = [];

  for (let segmentIndex = 0; segmentIndex < maxSegments; segmentIndex += 1) {
    for (const candidate of candidates) {
      const segment = candidate.segments[segmentIndex];
      if (!segment) continue;

      playlist.push({
        id: candidate.id + ":" + segment.id,
        youtubeId: candidate.youtubeId,
        start: segment.start,
        end: segment.end,
        institution: candidate.institution,
        title: candidate.title,
        subjects: candidate.subjects,
        sourceUrl: candidate.sourceUrl,
      });
    }
  }

  return playlist;
}

export const OFFICIAL_PANDA_HERO_PLAYLIST = buildRoundRobinPlaylist(
  OFFICIAL_PANDA_VIDEO_SHOT_POOL,
);

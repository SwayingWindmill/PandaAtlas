export interface OfficialPandaVideoSegment {
  id: string;
  start: number;
  end: number;
  label: string;
  use: "hero" | "action" | "close" | "environment" | "transition";
  sourceShotStart: number;
  sourceShotEnd: number;
}

export interface OfficialPandaVideoCandidate {
  id: string;
  institution: string;
  title: string;
  youtubeId: string;
  duration: number;
  subjects: string;
  sourceUrl: string;
  recommendation: "hero" | "secondary";
  sourceStatus: string;
  localPlaybackSrc?: string;
  mediaType?: "video/webm" | "video/mp4";
  cutPoints: number[];
  segments: OfficialPandaVideoSegment[];
}

export const OFFICIAL_PANDA_VIDEO_CANDIDATES: OfficialPandaVideoCandidate[] = [
  {
    "id": "smithsonian-public-debut",
    "institution": "Smithsonian's National Zoo",
    "title": "#DCPandas: Giant Pandas Bao Li and Qing Bao",
    "youtubeId": "wTVtbr-R4yA",
    "duration": 158.45,
    "subjects": "Bao Li / Qing Bao",
    "sourceUrl": "https://www.youtube.com/watch?v=wTVtbr-R4yA",
    "recommendation": "hero",
    "sourceStatus": "官方源 · 熊猫主体 · 人物密集扫描通过",
    "localPlaybackSrc": "/media/home-official/wTVtbr-R4yA.webm",
    "mediaType": "video/webm",
    "cutPoints": [
      5,
      19.25,
      23.25,
      30.5,
      36.5,
      40,
      44.25,
      50.75,
      54.5,
      68.25,
      75.5,
      80.75,
      99.5,
      109,
      118.25,
      119.75,
      123,
      126.5,
      131.5,
      141.75,
      145.25,
      149
    ],
    "segments": [
      {
        "id": "01a",
        "start": 5,
        "end": 9.75,
        "label": "01a",
        "use": "hero",
        "sourceShotStart": 5,
        "sourceShotEnd": 19.25
      },
      {
        "id": "01b",
        "start": 9.75,
        "end": 14.5,
        "label": "01b",
        "use": "hero",
        "sourceShotStart": 5,
        "sourceShotEnd": 19.25
      },
      {
        "id": "01c",
        "start": 14.5,
        "end": 19.25,
        "label": "01c",
        "use": "hero",
        "sourceShotStart": 5,
        "sourceShotEnd": 19.25
      },
      {
        "id": "02",
        "start": 19.25,
        "end": 23.25,
        "label": "02",
        "use": "hero",
        "sourceShotStart": 19.25,
        "sourceShotEnd": 23.25
      },
      {
        "id": "03",
        "start": 30.5,
        "end": 36.5,
        "label": "03",
        "use": "hero",
        "sourceShotStart": 30.5,
        "sourceShotEnd": 36.5
      },
      {
        "id": "04",
        "start": 36.5,
        "end": 40,
        "label": "04",
        "use": "hero",
        "sourceShotStart": 36.5,
        "sourceShotEnd": 40
      },
      {
        "id": "05",
        "start": 40,
        "end": 44.25,
        "label": "05",
        "use": "hero",
        "sourceShotStart": 40,
        "sourceShotEnd": 44.25
      },
      {
        "id": "06",
        "start": 44.25,
        "end": 50.75,
        "label": "06",
        "use": "hero",
        "sourceShotStart": 44.25,
        "sourceShotEnd": 50.75
      },
      {
        "id": "07",
        "start": 50.75,
        "end": 54.5,
        "label": "07",
        "use": "hero",
        "sourceShotStart": 50.75,
        "sourceShotEnd": 54.5
      },
      {
        "id": "08a",
        "start": 68.25,
        "end": 71.88,
        "label": "08a",
        "use": "hero",
        "sourceShotStart": 68.25,
        "sourceShotEnd": 75.5
      },
      {
        "id": "08b",
        "start": 71.88,
        "end": 75.5,
        "label": "08b",
        "use": "hero",
        "sourceShotStart": 68.25,
        "sourceShotEnd": 75.5
      },
      {
        "id": "09",
        "start": 75.5,
        "end": 80.75,
        "label": "09",
        "use": "hero",
        "sourceShotStart": 75.5,
        "sourceShotEnd": 80.75
      },
      {
        "id": "10a",
        "start": 99.5,
        "end": 104.25,
        "label": "10a",
        "use": "hero",
        "sourceShotStart": 99.5,
        "sourceShotEnd": 109
      },
      {
        "id": "10b",
        "start": 104.25,
        "end": 109,
        "label": "10b",
        "use": "hero",
        "sourceShotStart": 99.5,
        "sourceShotEnd": 109
      },
      {
        "id": "11a",
        "start": 109,
        "end": 113.63,
        "label": "11a",
        "use": "hero",
        "sourceShotStart": 109,
        "sourceShotEnd": 118.25
      },
      {
        "id": "11b",
        "start": 113.63,
        "end": 118.25,
        "label": "11b",
        "use": "hero",
        "sourceShotStart": 109,
        "sourceShotEnd": 118.25
      },
      {
        "id": "12",
        "start": 118.25,
        "end": 119.75,
        "label": "12",
        "use": "hero",
        "sourceShotStart": 118.25,
        "sourceShotEnd": 119.75
      },
      {
        "id": "13",
        "start": 119.75,
        "end": 123,
        "label": "13",
        "use": "hero",
        "sourceShotStart": 119.75,
        "sourceShotEnd": 123
      },
      {
        "id": "14",
        "start": 123,
        "end": 126.5,
        "label": "14",
        "use": "hero",
        "sourceShotStart": 123,
        "sourceShotEnd": 126.5
      },
      {
        "id": "15",
        "start": 126.5,
        "end": 131.5,
        "label": "15",
        "use": "hero",
        "sourceShotStart": 126.5,
        "sourceShotEnd": 131.5
      },
      {
        "id": "16a",
        "start": 131.5,
        "end": 136.63,
        "label": "16a",
        "use": "hero",
        "sourceShotStart": 131.5,
        "sourceShotEnd": 141.75
      },
      {
        "id": "16b",
        "start": 136.63,
        "end": 141.75,
        "label": "16b",
        "use": "hero",
        "sourceShotStart": 131.5,
        "sourceShotEnd": 141.75
      },
      {
        "id": "17",
        "start": 141.75,
        "end": 145.25,
        "label": "17",
        "use": "hero",
        "sourceShotStart": 141.75,
        "sourceShotEnd": 145.25
      },
      {
        "id": "18",
        "start": 145.25,
        "end": 149,
        "label": "18",
        "use": "hero",
        "sourceShotStart": 145.25,
        "sourceShotEnd": 149
      }
    ]
  },
  {
    "id": "smithsonian-snow-2025",
    "institution": "Smithsonian's National Zoo",
    "title": "Bao Li and Qing Bao Play In The Snow",
    "youtubeId": "ebcCgSRobc4",
    "duration": 82.67,
    "subjects": "Bao Li / Qing Bao",
    "sourceUrl": "https://www.youtube.com/watch?v=ebcCgSRobc4",
    "recommendation": "hero",
    "sourceStatus": "官方源 · 熊猫主体 · 人物密集扫描通过",
    "localPlaybackSrc": "/media/home-official/ebcCgSRobc4.webm",
    "mediaType": "video/webm",
    "cutPoints": [
      5.5,
      9,
      14.25,
      22,
      32,
      51.75,
      61.75,
      65.25,
      76.5
    ],
    "segments": [
      {
        "id": "01",
        "start": 0,
        "end": 5.5,
        "label": "01",
        "use": "hero",
        "sourceShotStart": 0,
        "sourceShotEnd": 5.5
      },
      {
        "id": "02a",
        "start": 22,
        "end": 27,
        "label": "02a",
        "use": "hero",
        "sourceShotStart": 22,
        "sourceShotEnd": 32
      },
      {
        "id": "02b",
        "start": 27,
        "end": 32,
        "label": "02b",
        "use": "hero",
        "sourceShotStart": 22,
        "sourceShotEnd": 32
      },
      {
        "id": "03",
        "start": 61.75,
        "end": 65.25,
        "label": "03",
        "use": "hero",
        "sourceShotStart": 61.75,
        "sourceShotEnd": 65.25
      },
      {
        "id": "04a",
        "start": 65.25,
        "end": 70.88,
        "label": "04a",
        "use": "hero",
        "sourceShotStart": 65.25,
        "sourceShotEnd": 76.5
      },
      {
        "id": "04b",
        "start": 70.88,
        "end": 76.5,
        "label": "04b",
        "use": "hero",
        "sourceShotStart": 65.25,
        "sourceShotEnd": 76.5
      }
    ]
  },
  {
    "id": "smithsonian-autumn",
    "institution": "Smithsonian's National Zoo",
    "title": "Qing Bao in Autumn",
    "youtubeId": "f9KVNw799aE",
    "duration": 60.02,
    "subjects": "Qing Bao",
    "sourceUrl": "https://www.youtube.com/watch?v=f9KVNw799aE",
    "recommendation": "hero",
    "sourceStatus": "官方源 · 熊猫主体 · 人物密集扫描通过",
    "localPlaybackSrc": "/media/home-official/f9KVNw799aE.webm",
    "mediaType": "video/webm",
    "cutPoints": [
      4,
      10.75,
      13.5,
      19.5,
      24.25,
      38.75,
      41,
      54.25
    ],
    "segments": [
      {
        "id": "01",
        "start": 0,
        "end": 4,
        "label": "01",
        "use": "hero",
        "sourceShotStart": 0,
        "sourceShotEnd": 4
      },
      {
        "id": "02a",
        "start": 4,
        "end": 7.38,
        "label": "02a",
        "use": "hero",
        "sourceShotStart": 4,
        "sourceShotEnd": 10.75
      },
      {
        "id": "02b",
        "start": 7.38,
        "end": 10.75,
        "label": "02b",
        "use": "hero",
        "sourceShotStart": 4,
        "sourceShotEnd": 10.75
      },
      {
        "id": "03",
        "start": 10.75,
        "end": 13.5,
        "label": "03",
        "use": "hero",
        "sourceShotStart": 10.75,
        "sourceShotEnd": 13.5
      },
      {
        "id": "04",
        "start": 19.5,
        "end": 24.25,
        "label": "04",
        "use": "hero",
        "sourceShotStart": 19.5,
        "sourceShotEnd": 24.25
      },
      {
        "id": "05a",
        "start": 24.25,
        "end": 29.08,
        "label": "05a",
        "use": "hero",
        "sourceShotStart": 24.25,
        "sourceShotEnd": 38.75
      },
      {
        "id": "05b",
        "start": 29.08,
        "end": 33.92,
        "label": "05b",
        "use": "hero",
        "sourceShotStart": 24.25,
        "sourceShotEnd": 38.75
      },
      {
        "id": "05c",
        "start": 33.92,
        "end": 38.75,
        "label": "05c",
        "use": "hero",
        "sourceShotStart": 24.25,
        "sourceShotEnd": 38.75
      },
      {
        "id": "06a",
        "start": 41,
        "end": 45.42,
        "label": "06a",
        "use": "hero",
        "sourceShotStart": 41,
        "sourceShotEnd": 54.25
      },
      {
        "id": "06b",
        "start": 45.42,
        "end": 49.83,
        "label": "06b",
        "use": "hero",
        "sourceShotStart": 41,
        "sourceShotEnd": 54.25
      },
      {
        "id": "06c",
        "start": 49.83,
        "end": 54.25,
        "label": "06c",
        "use": "hero",
        "sourceShotStart": 41,
        "sourceShotEnd": 54.25
      },
      {
        "id": "07",
        "start": 54.25,
        "end": 60.02,
        "label": "07",
        "use": "hero",
        "sourceShotStart": 54.25,
        "sourceShotEnd": 60.02
      }
    ]
  },
  {
    "id": "smithsonian-settling-in",
    "institution": "Smithsonian's National Zoo",
    "title": "Bao Li and Qing Bao Settle In To Their New Home",
    "youtubeId": "pgxIO6nyZEY",
    "duration": 58.1,
    "subjects": "Bao Li / Qing Bao",
    "sourceUrl": "https://www.youtube.com/watch?v=pgxIO6nyZEY",
    "recommendation": "hero",
    "sourceStatus": "官方源 · 熊猫主体 · 人物密集扫描通过",
    "localPlaybackSrc": "/media/home-official/pgxIO6nyZEY.webm",
    "mediaType": "video/webm",
    "cutPoints": [
      7.5,
      18.75,
      23.5,
      26.25,
      31.5,
      34.75,
      42.5,
      46.25,
      53.25
    ],
    "segments": [
      {
        "id": "01a",
        "start": 0,
        "end": 3.75,
        "label": "01a",
        "use": "hero",
        "sourceShotStart": 0,
        "sourceShotEnd": 7.5
      },
      {
        "id": "01b",
        "start": 3.75,
        "end": 7.5,
        "label": "01b",
        "use": "hero",
        "sourceShotStart": 0,
        "sourceShotEnd": 7.5
      },
      {
        "id": "02a",
        "start": 7.5,
        "end": 13.13,
        "label": "02a",
        "use": "hero",
        "sourceShotStart": 7.5,
        "sourceShotEnd": 18.75
      },
      {
        "id": "02b",
        "start": 13.13,
        "end": 18.75,
        "label": "02b",
        "use": "hero",
        "sourceShotStart": 7.5,
        "sourceShotEnd": 18.75
      },
      {
        "id": "03",
        "start": 18.75,
        "end": 23.5,
        "label": "03",
        "use": "hero",
        "sourceShotStart": 18.75,
        "sourceShotEnd": 23.5
      },
      {
        "id": "04",
        "start": 23.5,
        "end": 26.25,
        "label": "04",
        "use": "hero",
        "sourceShotStart": 23.5,
        "sourceShotEnd": 26.25
      },
      {
        "id": "05",
        "start": 26.25,
        "end": 31.5,
        "label": "05",
        "use": "hero",
        "sourceShotStart": 26.25,
        "sourceShotEnd": 31.5
      },
      {
        "id": "06",
        "start": 31.5,
        "end": 34.75,
        "label": "06",
        "use": "hero",
        "sourceShotStart": 31.5,
        "sourceShotEnd": 34.75
      },
      {
        "id": "07a",
        "start": 34.75,
        "end": 38.63,
        "label": "07a",
        "use": "hero",
        "sourceShotStart": 34.75,
        "sourceShotEnd": 42.5
      },
      {
        "id": "07b",
        "start": 38.63,
        "end": 42.5,
        "label": "07b",
        "use": "hero",
        "sourceShotStart": 34.75,
        "sourceShotEnd": 42.5
      },
      {
        "id": "08",
        "start": 42.5,
        "end": 46.25,
        "label": "08",
        "use": "hero",
        "sourceShotStart": 42.5,
        "sourceShotEnd": 46.25
      },
      {
        "id": "09a",
        "start": 46.25,
        "end": 49.75,
        "label": "09a",
        "use": "hero",
        "sourceShotStart": 46.25,
        "sourceShotEnd": 53.25
      },
      {
        "id": "09b",
        "start": 49.75,
        "end": 53.25,
        "label": "09b",
        "use": "hero",
        "sourceShotStart": 46.25,
        "sourceShotEnd": 53.25
      },
      {
        "id": "10",
        "start": 53.25,
        "end": 58.1,
        "label": "10",
        "use": "hero",
        "sourceShotStart": 53.25,
        "sourceShotEnd": 58.1
      }
    ]
  },
  {
    "id": "smithsonian-snow-social-2026",
    "institution": "Smithsonian's National Zoo",
    "title": "Bao Li and Qing Bao Socialize in the Snow",
    "youtubeId": "s-lxbWhtq40",
    "duration": 60.17,
    "subjects": "Bao Li / Qing Bao",
    "sourceUrl": "https://www.youtube.com/watch?v=s-lxbWhtq40",
    "recommendation": "hero",
    "sourceStatus": "官方源 · 熊猫主体 · 人物密集扫描通过",
    "localPlaybackSrc": "/media/home-official/s-lxbWhtq40.webm",
    "mediaType": "video/webm",
    "cutPoints": [
      12.5,
      17.5,
      21,
      26,
      31,
      38.25,
      44.5,
      54.5
    ],
    "segments": [
      {
        "id": "01",
        "start": 21,
        "end": 26,
        "label": "01",
        "use": "hero",
        "sourceShotStart": 21,
        "sourceShotEnd": 26
      }
    ]
  },
  {
    "id": "smithsonian-snow-2019",
    "institution": "Smithsonian's National Zoo",
    "title": "Giant pandas in the snow",
    "youtubeId": "pNff91GIIUg",
    "duration": 44.63,
    "subjects": "Mei Xiang / Bei Bei",
    "sourceUrl": "https://www.youtube.com/watch?v=pNff91GIIUg",
    "recommendation": "hero",
    "sourceStatus": "官方源 · 熊猫主体 · 人物密集扫描通过",
    "localPlaybackSrc": "/media/home-official/pNff91GIIUg.webm",
    "mediaType": "video/webm",
    "cutPoints": [
      3.6,
      6,
      8.4,
      10.6,
      13.6,
      17,
      19.2,
      22,
      24.8,
      30,
      33.8,
      37,
      41
    ],
    "segments": [
      {
        "id": "01",
        "start": 6,
        "end": 8.4,
        "label": "01",
        "use": "hero",
        "sourceShotStart": 6,
        "sourceShotEnd": 8.4
      },
      {
        "id": "02",
        "start": 8.4,
        "end": 10.6,
        "label": "02",
        "use": "hero",
        "sourceShotStart": 8.4,
        "sourceShotEnd": 10.6
      },
      {
        "id": "03",
        "start": 10.6,
        "end": 13.6,
        "label": "03",
        "use": "hero",
        "sourceShotStart": 10.6,
        "sourceShotEnd": 13.6
      },
      {
        "id": "04",
        "start": 13.6,
        "end": 17,
        "label": "04",
        "use": "hero",
        "sourceShotStart": 13.6,
        "sourceShotEnd": 17
      },
      {
        "id": "05",
        "start": 22,
        "end": 24.8,
        "label": "05",
        "use": "hero",
        "sourceShotStart": 22,
        "sourceShotEnd": 24.8
      }
    ]
  },
  {
    "id": "sandiego-intro",
    "institution": "San Diego Zoo",
    "title": "Announcing San Diego Zoo's Panda Pair",
    "youtubeId": "CNnEP98dul4",
    "duration": 39.84,
    "subjects": "Yun Chuan / Xin Bao",
    "sourceUrl": "https://www.youtube.com/watch?v=CNnEP98dul4",
    "recommendation": "hero",
    "sourceStatus": "官方源 · 熊猫主体 · 人物密集扫描通过",
    "localPlaybackSrc": "/media/home-official/CNnEP98dul4.mp4",
    "mediaType": "video/mp4",
    "cutPoints": [
      8.6,
      12.2,
      19.8,
      30.2
    ],
    "segments": [
      {
        "id": "01",
        "start": 0,
        "end": 4.8,
        "label": "01",
        "use": "hero",
        "sourceShotStart": 0,
        "sourceShotEnd": 8.6
      },
      {
        "id": "02",
        "start": 4.8,
        "end": 6.4,
        "label": "02",
        "use": "hero",
        "sourceShotStart": 0,
        "sourceShotEnd": 8.6
      },
      {
        "id": "03",
        "start": 6.4,
        "end": 7.4,
        "label": "03",
        "use": "hero",
        "sourceShotStart": 0,
        "sourceShotEnd": 8.6
      },
      {
        "id": "04",
        "start": 7.4,
        "end": 8.6,
        "label": "04",
        "use": "hero",
        "sourceShotStart": 0,
        "sourceShotEnd": 8.6
      },
      {
        "id": "05",
        "start": 8.6,
        "end": 12.2,
        "label": "05",
        "use": "hero",
        "sourceShotStart": 8.6,
        "sourceShotEnd": 12.2
      },
      {
        "id": "06a",
        "start": 12.2,
        "end": 16,
        "label": "06a",
        "use": "hero",
        "sourceShotStart": 12.2,
        "sourceShotEnd": 19.8
      },
      {
        "id": "06b",
        "start": 16,
        "end": 19.8,
        "label": "06b",
        "use": "hero",
        "sourceShotStart": 12.2,
        "sourceShotEnd": 19.8
      },
      {
        "id": "07a",
        "start": 19.8,
        "end": 23.1,
        "label": "07a",
        "use": "hero",
        "sourceShotStart": 19.8,
        "sourceShotEnd": 30.2
      },
      {
        "id": "07b",
        "start": 23.1,
        "end": 26.4,
        "label": "07b",
        "use": "hero",
        "sourceShotStart": 19.8,
        "sourceShotEnd": 30.2
      },
      {
        "id": "08",
        "start": 26.4,
        "end": 30.2,
        "label": "08",
        "use": "hero",
        "sourceShotStart": 19.8,
        "sourceShotEnd": 30.2
      },
      {
        "id": "09a",
        "start": 30.2,
        "end": 35.02,
        "label": "09a",
        "use": "hero",
        "sourceShotStart": 30.2,
        "sourceShotEnd": 39.84
      },
      {
        "id": "09b",
        "start": 35.02,
        "end": 39.84,
        "label": "09b",
        "use": "hero",
        "sourceShotStart": 30.2,
        "sourceShotEnd": 39.84
      }
    ]
  },
  {
    "id": "sandiego-campaign",
    "institution": "San Diego Zoo",
    "title": "See Giant Pandas For The First Time",
    "youtubeId": "l10zoaT-Q04",
    "duration": 30.03,
    "subjects": "Yun Chuan / Xin Bao",
    "sourceUrl": "https://www.youtube.com/watch?v=l10zoaT-Q04",
    "recommendation": "hero",
    "sourceStatus": "官方源 · 熊猫主体 · 人物密集扫描通过",
    "localPlaybackSrc": "/media/home-official/l10zoaT-Q04.webm",
    "mediaType": "video/webm",
    "cutPoints": [
      1.8,
      3.6,
      6.8,
      7.8,
      8.8,
      10.2,
      13.8,
      15,
      16,
      17.4,
      18,
      18.6,
      20.6,
      24.4,
      28.2
    ],
    "segments": [
      {
        "id": "01",
        "start": 20.6,
        "end": 24.4,
        "label": "01",
        "use": "hero",
        "sourceShotStart": 20.6,
        "sourceShotEnd": 24.4
      },
      {
        "id": "02",
        "start": 24.4,
        "end": 28.2,
        "label": "02",
        "use": "hero",
        "sourceShotStart": 24.4,
        "sourceShotEnd": 28.2
      }
    ]
  },
  {
    "id": "ipanda-keeper-2026",
    "institution": "iPanda / CCTV.com",
    "title": "Panda Academy: The Right Distance Between Keepers And Pandas",
    "youtubeId": "wKR67WFrlj8",
    "duration": 195.83,
    "subjects": "Giant panda",
    "sourceUrl": "https://www.youtube.com/watch?v=wKR67WFrlj8",
    "recommendation": "hero",
    "sourceStatus": "官方源 · 熊猫主体 · 人物密集扫描通过",
    "localPlaybackSrc": "/media/home-official/wKR67WFrlj8.webm",
    "mediaType": "video/webm",
    "cutPoints": [
      9.75,
      13.5,
      19,
      23.5,
      86.5,
      105.25,
      132.25,
      140.5,
      145.5,
      153.75,
      193
    ],
    "segments": [
      {
        "id": "01a",
        "start": 132.25,
        "end": 136.38,
        "label": "01a",
        "use": "hero",
        "sourceShotStart": 132.25,
        "sourceShotEnd": 140.5
      },
      {
        "id": "01b",
        "start": 136.38,
        "end": 140.5,
        "label": "01b",
        "use": "hero",
        "sourceShotStart": 132.25,
        "sourceShotEnd": 140.5
      },
      {
        "id": "02",
        "start": 140.5,
        "end": 145.5,
        "label": "02",
        "use": "hero",
        "sourceShotStart": 140.5,
        "sourceShotEnd": 145.5
      }
    ]
  }
];

export const OFFICIAL_PANDA_VIDEO_SOURCE_COUNT = OFFICIAL_PANDA_VIDEO_CANDIDATES.length;
export const OFFICIAL_PANDA_VIDEO_SOURCE_SHOT_COUNT = 58;
export const OFFICIAL_PANDA_VIDEO_SEGMENT_COUNT = OFFICIAL_PANDA_VIDEO_CANDIDATES.reduce((total, source) => total + source.segments.length, 0);

const maxHeroSegmentsPerSource = Math.max(...OFFICIAL_PANDA_VIDEO_CANDIDATES.map((source) => source.segments.length));

export const OFFICIAL_HOME_HERO_SEGMENTS = Array.from({ length: maxHeroSegmentsPerSource }, (_, index) => index).flatMap((segmentIndex) =>
  OFFICIAL_PANDA_VIDEO_CANDIDATES.flatMap((source) => {
    const segment = source.segments[segmentIndex];
    if (!segment) return [];
    return [{
      id: source.id + ":" + segment.id,
      playbackSrc: source.localPlaybackSrc!,
      mediaType: source.mediaType ?? "video/webm",
      sourcePage: source.sourceUrl,
      creator: source.institution,
      sourceLabel: "Official source",
      sourceLabelUrl: source.sourceUrl,
      startAt: segment.start,
      endAt: segment.end,
      subjects: source.subjects,
    }];
  }),
);

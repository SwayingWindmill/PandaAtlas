export type PandaSoundId =
  | "panda-twittering"
  | "bamboo-eating-long"
  | "bamboo-eating-short"
  | "memphis-ambient"
  | "cub-moscow-ambient";

export interface PandaSoundClip {
  id: PandaSoundId;
  shortLabel: string;
  sceneLabel: string;
  title: string;
  durationLabel: string;
  durationSec: number;
  license: string;
  artist: string;
  pageUrl: string;
  description: string;
  waveform: readonly number[];
}

export interface VocalizationReference {
  id: string;
  name: string;
  context: string;
  description: string;
  linkedClipId?: PandaSoundId;
}

export const PANDA_SOUND_CLIPS: readonly PandaSoundClip[] = [
  {
    id: "panda-twittering",
    shortLabel: "轻声鸣叫",
    sceneLabel: "高频轻鸣实录",
    title: "大熊猫轻声鸣叫",
    durationLabel: "0:03",
    durationSec: 3.1,
    license: "Public domain",
    artist: "Myself (Wikimedia Commons)",
    pageUrl: "https://commons.wikimedia.org/wiki/File:Giant_panda_twittering.ogg",
    description: "短促连续的高频轻鸣（chirp / twitter），常见于友好试探或进食陪伴场景。",
    waveform: [7, 13, 19, 11, 22, 16, 9, 20, 24, 14, 8, 17, 12, 6, 15, 21, 10, 14, 8, 12],
  },
  {
    id: "bamboo-eating-long",
    shortLabel: "啃竹原声",
    sceneLabel: "竹竿啃食原声",
    title: "大熊猫啃竹 ASMR",
    durationLabel: "0:43",
    durationSec: 43.4,
    license: "CC BY-SA 4.0",
    artist: "Pauloleong2002",
    pageUrl: "https://commons.wikimedia.org/wiki/File:Giant_panda_eating_bamboo.ogv",
    description: "持续啃咬并剥开竹竿表皮的清脆咀嚼声，大熊猫宽平臼齿咬合力极强。",
    waveform: [10, 18, 14, 23, 19, 12, 17, 24, 15, 21, 9, 16, 22, 13, 18, 11, 20, 14, 9, 15],
  },
  {
    id: "memphis-ambient",
    shortLabel: "展区环境",
    sceneLabel: "室外展区实录",
    title: "展区啃食环境声",
    durationLabel: "0:10",
    durationSec: 9.8,
    license: "CC BY 3.0",
    artist: "Thomas R Machnitzki",
    pageUrl: "https://commons.wikimedia.org/wiki/File:Memphis_Zoo_panda_2013-03-29.theora.ogv",
    description: "场馆室外活动区取食竹枝与树叶沙沙作响的环境实录。",
    waveform: [6, 11, 16, 13, 18, 12, 15, 19, 11, 9, 14, 17, 12, 8, 13, 16, 10, 11, 7, 9],
  },
  {
    id: "bamboo-eating-short",
    shortLabel: "成都碎竹声",
    sceneLabel: "成都外场原声",
    title: "成都基地啃竹短段",
    durationLabel: "0:06",
    durationSec: 5.8,
    license: "CC BY-SA 2.5 es",
    artist: "Wikimedia Commons",
    pageUrl: "https://commons.wikimedia.org/wiki/File:Chengdu-oso-panda-comiendo-v01.ogv",
    description: "成都大熊猫繁育研究基地外场近距离嚼碎竹节原声。",
    waveform: [8, 15, 22, 17, 12, 20, 16, 10, 23, 18, 14, 19, 11, 15, 9, 17, 13, 10, 12, 8],
  },
  {
    id: "cub-moscow-ambient",
    shortLabel: "幼仔亮相",
    sceneLabel: "幼仔见面现场",
    title: "莫斯科幼仔“喀秋莎”亮相声",
    durationLabel: "0:39",
    durationSec: 39.5,
    license: "CC BY 3.0",
    artist: "中国新闻社",
    pageUrl: "https://commons.wikimedia.org/wiki/File:Russia%27s_first_giant_panda_cub_meets_public_in_Moscow.webm",
    description: "大熊猫幼仔喀秋莎首次与公众见面时的展馆现场原声。",
    waveform: [9, 14, 18, 16, 21, 13, 17, 22, 15, 19, 12, 16, 20, 14, 11, 18, 15, 12, 14, 10],
  },
];

export const VOCALIZATION_GUIDE: readonly VocalizationReference[] = [
  {
    id: "bleat",
    name: "咩咩叫（Bleat）",
    context: "友好示好 / 春季繁殖交流",
    description: "大熊猫最具代表性的社交声，音色类似绵羊轻颤，表达友善、渴望靠近或安抚同行同伴（纯干声待后续授权补录）。",
  },
  {
    id: "chirp",
    name: "轻声鸣叫（Chirp / Twitter）",
    context: "温和互动 / 兴奋求关注",
    description: "较高频率的连续轻颤音，常见于雌性发情期或大熊猫情绪愉悦、期待投喂时。",
    linkedClipId: "panda-twittering",
  },
  {
    id: "crunch",
    name: "啃竹咀嚼声（Bamboo Crunch）",
    context: "日常进食（每日约 10–14 小时）",
    description: "大熊猫依靠伪拇指抓握竹竿，并用平阔臼齿压碎坚韧纤维，形成规律而清脆的碎竹声。",
    linkedClipId: "bamboo-eating-long",
  },
  {
    id: "bark",
    name: "犬吠与低吼（Bark / Growl）",
    context: "领地警戒 / 紧张防御",
    description: "遇到陌生气味或领地冲突时发出短促沉闷的犬吠声或低频咆哮，意在驱离而非主动攻击（纯干声待后续授权补录）。",
  },
];

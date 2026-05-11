export type LineageGender = "male" | "female" | "unknown";

export interface LineagePanda {
  id: string;
  slug: string;
  name_zh: string;
  name_en: string;
  gender: LineageGender;
  birth_date: string | null;
  current_location: string | null;
  avatar_url: string | null;
  intro: string;
  highlights: string[];
  father_id: string | null;
  mother_id: string | null;
}

export const DEFAULT_LINEAGE_FOCUS_ID = "he-hua";

export const LINEAGE_PANDAS: LineagePanda[] = [
  {
    id: "4e0e5e7d-02af-480d-b3b2-2d25a6211f4b",
    slug: "bi-li",
    name_zh: "比力",
    name_en: "Bi Li",
    gender: "male",
    birth_date: "1990-09-16",
    current_location: "Dujiangyan Panda Valley",
    avatar_url: "/pandas/he-hua/family-father.jpg",
    intro: "Senior male with long-running archival value across breeding and behavior records.",
    highlights: ["Founder branch", "Longitudinal records", "Senior archive"],
    father_id: null,
    mother_id: null
  },
  {
    id: "b7bb809b-c9b1-4d7f-b9a9-0fb1e30af1df",
    slug: "hua-mei",
    name_zh: "华美",
    name_en: "Hua Mei",
    gender: "female",
    birth_date: "1999-08-21",
    current_location: "Historical archive",
    avatar_url: "/pandas/he-hua/gallery-5.jpg",
    intro: "Historic female profile used as a stable lineage reference anchor.",
    highlights: ["Founder branch", "Historic archive", "Pedigree reference"],
    father_id: null,
    mother_id: null
  },
  {
    id: "7b7f8cb4-80d3-40c4-8d98-c0846ef4a13e",
    slug: "xi-yue",
    name_zh: "喜月",
    name_en: "Xi Yue",
    gender: "female",
    birth_date: "2010-03-14",
    current_location: "Historical archive",
    avatar_url: "/pandas/he-hua/gallery-3.jpg",
    intro: "Archived female with complete maternal-line notes and stable reference value.",
    highlights: ["Maternal branch", "Historic archive", "Reference profile"],
    father_id: "4e0e5e7d-02af-480d-b3b2-2d25a6211f4b",
    mother_id: "b7bb809b-c9b1-4d7f-b9a9-0fb1e30af1df"
  },
  {
    id: "a6dd8c77-f8dc-4a1a-9bf5-910f5f0cb57f",
    slug: "zhen-zhen",
    name_zh: "珍珍",
    name_en: "Zhen Zhen",
    gender: "female",
    birth_date: "2007-08-03",
    current_location: "International Collaboration Center",
    avatar_url: "/pandas/he-hua/gallery-2.jpg",
    intro: "Internationally documented female with complete breeding and transfer records.",
    highlights: ["International profile", "Breeding archive", "Stable health"],
    father_id: "4e0e5e7d-02af-480d-b3b2-2d25a6211f4b",
    mother_id: "b7bb809b-c9b1-4d7f-b9a9-0fb1e30af1df"
  },
  {
    id: "6f61fd4f-1c4d-4db0-8f10-67ea58f98f80",
    slug: "qing-shan",
    name_zh: "青山",
    name_en: "Qing Shan",
    gender: "male",
    birth_date: "2017-05-02",
    current_location: "Qinling Science Park",
    avatar_url: "/home/archive-tian-tian.jpg",
    intro: "Behaviorally steady male used as a reliable connector between public family branches.",
    highlights: ["Steady rhythm", "Research monitored", "Connector branch"],
    father_id: "4e0e5e7d-02af-480d-b3b2-2d25a6211f4b",
    mother_id: "7b7f8cb4-80d3-40c4-8d98-c0846ef4a13e"
  },
  {
    id: "89264f73-d0e2-44e0-aad6-8d8fca58f879",
    slug: "yun-chuan",
    name_zh: "云川",
    name_en: "Yun Chuan",
    gender: "male",
    birth_date: "2019-06-16",
    current_location: "Chengdu Research Base",
    avatar_url: "/home/archive-mei-lan.jpg",
    intro: "Core male branch in the current public atlas, linking archived lines to current profiles.",
    highlights: ["Core branch", "Stable appetite", "Public profile"],
    father_id: "6f61fd4f-1c4d-4db0-8f10-67ea58f98f80",
    mother_id: "a6dd8c77-f8dc-4a1a-9bf5-910f5f0cb57f"
  },
  {
    id: "53acaf2b-3f5b-4adb-9e47-bf0ef6744fd7",
    slug: "jin-hu",
    name_zh: "金虎",
    name_en: "Jin Hu",
    gender: "female",
    birth_date: "2018-08-11",
    current_location: "Bifengxia Base",
    avatar_url: "/home/archive-bao-bao.jpg",
    intro: "Female profile with strong adaptation notes and good public-facing relation coverage.",
    highlights: ["Adaptive behavior", "Maternal branch", "Public profile"],
    father_id: "4e0e5e7d-02af-480d-b3b2-2d25a6211f4b",
    mother_id: "7b7f8cb4-80d3-40c4-8d98-c0846ef4a13e"
  },
  {
    id: "e2f0ff4a-4a98-413a-a0d2-64e12d68db43",
    slug: "meng-lan",
    name_zh: "萌兰",
    name_en: "Meng Lan",
    gender: "male",
    birth_date: "2015-07-04",
    current_location: "Beijing Zoo",
    avatar_url: "/home/archive-xiao-qi-ji.jpg",
    intro: "Highly recognizable male known for activity and exploratory behavior.",
    highlights: ["High activity", "Exploration behavior", "Public attention"],
    father_id: "6f61fd4f-1c4d-4db0-8f10-67ea58f98f80",
    mother_id: "a6dd8c77-f8dc-4a1a-9bf5-910f5f0cb57f"
  },
  {
    id: "95f8e2e0-a8f1-45e5-8b4f-bdb7235d7ce2",
    slug: "xin-bao",
    name_zh: "鑫宝",
    name_en: "Xin Bao",
    gender: "male",
    birth_date: "2020-09-02",
    current_location: "Dujiangyan Panda Valley",
    avatar_url: "/home/archive-xiao-qi-ji.jpg",
    intro: "Younger male with a pronounced daytime activity window and clear public profile identity.",
    highlights: ["Daytime active", "Athletic profile", "Monitoring sample"],
    father_id: "89264f73-d0e2-44e0-aad6-8d8fca58f879",
    mother_id: "53acaf2b-3f5b-4adb-9e47-bf0ef6744fd7"
  },
  {
    id: "1d08f72f-7550-42e9-a4d5-bd74bc505955",
    slug: "he-hua",
    name_zh: "和花",
    name_en: "He Hua",
    gender: "female",
    birth_date: "2020-07-04",
    current_location: "Chengdu Research Base",
    avatar_url: "/pandas/he-hua/hero.jpg",
    intro: "Current focus panda whose public profile anchors the profile to lineage journey.",
    highlights: ["Star profile", "Social behavior", "Core observation target"],
    father_id: "89264f73-d0e2-44e0-aad6-8d8fca58f879",
    mother_id: "53acaf2b-3f5b-4adb-9e47-bf0ef6744fd7"
  },
  {
    id: "31d1f8be-7b95-4f0d-8f65-1e030fd22d71",
    slug: "fu-bao",
    name_zh: "福宝",
    name_en: "Fu Bao",
    gender: "female",
    birth_date: "2020-07-20",
    current_location: "Wolong Shenshuping Base",
    avatar_url: "/home/archive-bao-bao.jpg",
    intro: "Widely followed female with a strong youth-growth narrative and stable archive potential.",
    highlights: ["Youth archive", "High attention", "Cross-base interest"],
    father_id: "e2f0ff4a-4a98-413a-a0d2-64e12d68db43",
    mother_id: "7b7f8cb4-80d3-40c4-8d98-c0846ef4a13e"
  }
];

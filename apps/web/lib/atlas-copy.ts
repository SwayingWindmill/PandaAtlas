import type { Metadata } from "next";

export const ATLAS_PAGE_META: Metadata = {
  title: "熊猫档案 | Panda Atlas",
  description: "浏览不同年龄、机构与地理背景的大熊猫档案，按地点、年龄阶段与关键词快速定位目标个体。",
};

export const ATLAS_HERO_COPY = {
  breadcrumb: "首页",
  kicker: "档案浏览",
  title: "探索熊猫个体档案",
  body: "按地点、年龄阶段与关键词浏览收录个体，在安静清晰的档案索引中继续进入完整资料。",
  imageAlt: "竹林中的大熊猫档案主题图",
} as const;

export const ATLAS_HERO_STATS = [
  { key: "records", label: "个体收录" },
  { key: "locations", label: "驻留地点" },
  { key: "featured", label: "重点档案" },
] as const;

export const ATLAS_ROUTE_BAND = [
  {
    href: "/map",
    kicker: "全球分布地图",
    title: "从空间分布继续浏览",
    body: "切换到地图工作台，按地理分布、栖息地与机构网络继续延伸阅读。",
  },
  {
    href: "/lineage",
    kicker: "谱系关系",
    title: "从个体进入关系网络",
    body: "沿着亲缘线索查看相关个体，让档案索引自然延伸到谱系阅读。",
  },
] as const;

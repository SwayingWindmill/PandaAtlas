export interface FanV08VisualFixture {
  slug: string;
  zh: string;
  en: string;
  image: string;
  credit: string;
  rights: string;
  source: string;
  metaZh: string;
  metaEn: string;
}

// Prototype-only visual fixtures recovered from the reviewed V0.7-era public release.
// They are intentionally isolated from production PublicRead data and exist only so
// the visual direction can be reviewed while current V2 Production has no media rows.
export const fanV08VisualFixtures: FanV08VisualFixture[] = [
  {
    slug: "mei-xiang",
    zh: "美香",
    en: "Mei Xiang",
    image: "https://upload.wikimedia.org/wikipedia/commons/1/14/Mei_Xiang_at_Smithsonian%27s_National_Zoo.jpg",
    credit: "O01326 / Wikimedia Commons",
    rights: "CC BY-SA 4.0",
    source: "https://commons.wikimedia.org/wiki/File:Mei_Xiang_at_Smithsonian%27s_National_Zoo.jpg",
    metaZh: "1998 · 中国 / 华盛顿",
    metaEn: "1998 · China / Washington, DC",
  },
  {
    slug: "fu-bao",
    zh: "福宝",
    en: "Fu Bao",
    image: "https://upload.wikimedia.org/wikipedia/commons/a/a6/Fu_Bao_20240115_02.jpg",
    credit: "Youngjin / Wikimedia Commons",
    rights: "CC BY-SA 4.0",
    source: "https://commons.wikimedia.org/wiki/File:Fu_Bao_20240115_02.jpg",
    metaZh: "2020 · 爱宝乐园 / 中国",
    metaEn: "2020 · Everland / China",
  },
  {
    slug: "xiao-qi-ji",
    zh: "小奇迹",
    en: "Xiao Qi Ji",
    image: "https://upload.wikimedia.org/wikipedia/commons/d/dc/Panda_Cub_Xiao_Qi_Ji_Wrestling_Mama_Panda_for_Ice_Treat_15.jpg",
    credit: "Amaury Laporte / Wikimedia Commons",
    rights: "CC BY 2.0",
    source: "https://commons.wikimedia.org/wiki/File:Panda_Cub_Xiao_Qi_Ji_Wrestling_Mama_Panda_for_Ice_Treat_15.jpg",
    metaZh: "2020 · 华盛顿",
    metaEn: "2020 · Washington, DC",
  },
  {
    slug: "lun-lun",
    zh: "伦伦",
    en: "Lun Lun",
    image: "https://commons.wikimedia.org/wiki/Special:Redirect/file/Lun_Lun_at_Zoo_Atlanta.jpg",
    credit: "O01326 / Wikimedia Commons",
    rights: "CC BY-SA 4.0",
    source: "https://commons.wikimedia.org/wiki/File:Lun_Lun_at_Zoo_Atlanta.jpg",
    metaZh: "1997 · 亚特兰大",
    metaEn: "1997 · Atlanta",
  },
  {
    slug: "ya-lun",
    zh: "雅伦",
    en: "Ya Lun",
    image: "https://commons.wikimedia.org/wiki/Special:Redirect/file/Ya_Lun_at_Zoo_Atlanta.jpg",
    credit: "O01326 / Wikimedia Commons",
    rights: "CC BY-SA 4.0",
    source: "https://commons.wikimedia.org/wiki/File:Ya_Lun_at_Zoo_Atlanta.jpg",
    metaZh: "2016 · 亚特兰大",
    metaEn: "2016 · Atlanta",
  },
  {
    slug: "xi-lun",
    zh: "喜伦",
    en: "Xi Lun",
    image: "https://commons.wikimedia.org/wiki/Special:Redirect/file/Xi_Lun_at_Zoo_Atlanta.jpg?width=1600",
    credit: "O01326 / Wikimedia Commons",
    rights: "CC BY-SA 4.0",
    source: "https://commons.wikimedia.org/wiki/File:Xi_Lun_at_Zoo_Atlanta.jpg",
    metaZh: "2016 · 亚特兰大",
    metaEn: "2016 · Atlanta",
  },
];

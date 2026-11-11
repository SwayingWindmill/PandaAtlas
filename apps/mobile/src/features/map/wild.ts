import { projectToWorld } from "@zhipanda/world-map";

/**
 * Wild giant pandas inside the Giant Panda National Park, by local population, from Table 1
 * (大熊猫种群和栖息地情况表) of 《大熊猫国家公园总体规划（2023—2030年）》, which gives the 4th
 * national survey as its source. Counts and habitat areas are copied as published; positions are
 * the mean of the listed county seats, so an area on the map is a sketch, not a boundary.
 */
export const WILD_SOURCE = {
  title: "《大熊猫国家公园总体规划（2023—2030年）》表 1，数据来自第四次全国大熊猫调查",
  url: "https://www.forestry.gov.cn/u/cms/www/202404/121800447jxg.pdf",
  parkTotal: 1340,
  nationalTotal: 1864,
  nationalSourceUrl: "http://env.people.com.cn/n/2015/0301/c1010-26615131.html",
} as const;

type Province = "四川" | "陕西" | "甘肃";

/** County seats named in Table 1: longitude, latitude, province. */
const COUNTIES: Record<string, [number, number, Province]> = {
  宁强: [106.26, 32.83, "陕西"],
  武都: [104.92, 33.39, "甘肃"],
  文县: [104.68, 32.94, "甘肃"],
  青川: [105.24, 32.58, "四川"],
  九寨沟: [104.24, 33.26, "四川"],
  平武: [104.53, 32.41, "四川"],
  松潘: [103.6, 32.64, "四川"],
  北川: [104.45, 31.62, "四川"],
  茂县: [103.85, 31.68, "四川"],
  安州区: [104.57, 31.53, "四川"],
  都江堰: [103.62, 31.0, "四川"],
  绵竹: [104.22, 31.34, "四川"],
  彭州: [103.96, 30.99, "四川"],
  什邡: [104.17, 31.13, "四川"],
  汶川: [103.59, 31.48, "四川"],
  宝兴: [102.81, 30.37, "四川"],
  崇州: [103.67, 30.63, "四川"],
  大邑: [103.52, 30.59, "四川"],
  芦山: [102.93, 30.14, "四川"],
  天全: [102.76, 30.07, "四川"],
  荥经: [102.85, 29.79, "四川"],
  洪雅: [103.37, 29.9, "四川"],
  石棉: [102.36, 29.23, "四川"],
};

export interface WildPopulation {
  /** Table 1's name for the local population (局域种群). */
  name: string;
  counties: string[];
  count: number;
  habitatKm2: number;
}

export interface WildRange {
  id: string;
  name: string;
  populations: WildPopulation[];
}

/** Table 1, grouped by mountain range in the table's order. 凉山 lies outside the park and is not in it. */
export const WILD_RANGES: WildRange[] = [
  {
    id: "qinling",
    name: "秦岭",
    populations: [{ name: "秦岭F", counties: ["宁强", "武都", "青川"], count: 4, habitatKm2: 125.41 }],
  },
  {
    id: "minshan",
    name: "岷山",
    populations: [
      { name: "岷山G", counties: ["文县", "九寨沟", "平武", "青川"], count: 228, habitatKm2: 2134.33 },
      { name: "岷山J", counties: ["九寨沟", "平武", "松潘"], count: 162, habitatKm2: 1565.15 },
      { name: "岷山K", counties: ["北川", "茂县", "平武", "松潘"], count: 340, habitatKm2: 2920.85 },
      {
        name: "岷山L",
        counties: ["安州区", "北川", "都江堰", "茂县", "绵竹", "彭州", "什邡", "汶川"],
        count: 35,
        habitatKm2: 1182.34,
      },
    ],
  },
  {
    id: "qionglai",
    name: "邛崃山",
    populations: [
      { name: "邛崃山A", counties: ["汶川"], count: 87, habitatKm2: 689.68 },
      { name: "邛崃山B", counties: ["宝兴", "崇州", "大邑", "都江堰", "芦山", "汶川"], count: 224, habitatKm2: 2308.36 },
      { name: "邛崃山C", counties: ["宝兴", "天全"], count: 180, habitatKm2: 2225.87 },
      { name: "邛崃山D", counties: ["天全", "荥经"], count: 28, habitatKm2: 539.14 },
    ],
  },
  {
    id: "daxiangling",
    name: "大相岭",
    populations: [
      { name: "大相岭A", counties: ["荥经"], count: 4, habitatKm2: 142.67 },
      { name: "大相岭B", counties: ["洪雅", "荥经"], count: 26, habitatKm2: 799.73 },
    ],
  },
  {
    id: "xiaoxiangling",
    name: "小相岭",
    populations: [
      { name: "小相岭A", counties: ["石棉"], count: 21, habitatKm2: 293.19 },
      { name: "小相岭B", counties: ["石棉"], count: 1, habitatKm2: 90.89 },
    ],
  },
];

export interface WildPatch {
  name: string;
  /** Centre in outline units, and the radius of a circle with the population's habitat area. */
  x: number;
  y: number;
  radius: number;
}

export interface WildArea {
  range: WildRange;
  patches: WildPatch[];
  /** Where the range's label sits: the patches' centre, weighted by habitat. */
  label: { x: number; y: number };
  count: number;
  habitatKm2: number;
  provinces: Province[];
}

const KM_PER_DEGREE = 111.32;

function patchOf(population: WildPopulation): WildPatch {
  const seats = population.counties.map((county) => COUNTIES[county]).filter((seat) => seat !== undefined);
  const lon = seats.reduce((sum, seat) => sum + seat[0], 0) / seats.length;
  const lat = seats.reduce((sum, seat) => sum + seat[1], 0) / seats.length;
  const centre = projectToWorld(lon, lat);
  // The circle's radius in degrees of longitude, measured back through the projection.
  const radiusKm = Math.sqrt(population.habitatKm2 / Math.PI);
  const east = projectToWorld(lon + radiusKm / (KM_PER_DEGREE * Math.cos((lat * Math.PI) / 180)), lat);
  return { name: population.name, x: centre.x, y: centre.y, radius: Math.hypot(east.x - centre.x, east.y - centre.y) };
}

function areaOf(range: WildRange): WildArea {
  const patches = range.populations.map(patchOf);
  const habitatKm2 = range.populations.reduce((sum, population) => sum + population.habitatKm2, 0);
  const weight = (index: number) => range.populations[index]!.habitatKm2 / habitatKm2;
  const provinces = [
    ...new Set(range.populations.flatMap((population) => population.counties.map((county) => COUNTIES[county]?.[2]))),
  ].filter((province): province is Province => province !== undefined);
  return {
    range,
    patches,
    label: {
      x: patches.reduce((sum, patch, index) => sum + patch.x * weight(index), 0),
      y: patches.reduce((sum, patch, index) => sum + patch.y * weight(index), 0),
    },
    count: range.populations.reduce((sum, population) => sum + population.count, 0),
    habitatKm2,
    provinces,
  };
}

export const WILD_AREAS: WildArea[] = WILD_RANGES.map(areaOf);

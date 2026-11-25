import { VENUE_CLOCK_SPECS } from "@/features/explore/venue-clock";
import type { Facility, InstitutionDetail, TimeWindow } from "@/features/institutions/institutions";

export interface RouteStep {
  step: string;
  time: string;
  title: string;
  detail: string;
  highlightSlugs?: readonly string[];
}

export interface CuratedPhotoSpot {
  name: string;
  window: TimeWindow | null;
  note: string;
}

export interface PracticalTip {
  kind: "temperature" | "id" | "etiquette" | "info";
  title: string;
  text: string;
}

export interface VenueGuideExtras {
  durationLabel?: string;
  durationNote?: string;
  defaultTicketShort?: string;
  defaultTicketNote?: string;
  defaultHoursShort?: string;
  defaultHoursNote?: string;
  defaultAreaSummary?: string;
  defaultTransitText?: string;
  distanceHint?: string;
  routeSteps?: readonly RouteStep[];
  extraPhotoSpots?: readonly CuratedPhotoSpot[];
  practicalTips?: readonly PracticalTip[];
}

export interface VenueMetric {
  key: "residents" | "born" | "ticket";
  label: string;
  value: string;
  sub?: string;
  muted?: boolean;
  spoken: string;
}

export interface PreTripBentoItem {
  key: "hours" | "ticket" | "bestWindow" | "duration";
  label: string;
  value: string;
  sub?: string;
  spoken: string;
}

export const VENUE_GUIDE_EXTRAS: Readonly<Record<string, VenueGuideExtras>> = {
  "chengdu-research-base": {
    durationLabel: "3–4 小时",
    durationNote: "园区较广，可配合观光车",
    defaultTicketShort: "¥55",
    defaultTicketNote: "全价票，旺季建议提前预约",
    defaultHoursShort: "07:30–18:00",
    defaultHoursNote: "17:00 停止入园",
    defaultAreaSummary: "幼年别墅 / 月亮产房 / 星星产房",
    defaultTransitText: "地铁 3 号线熊猫大道站 A 口换乘景区直通车（约 15 分钟）",
    distanceHint: "距成都市中心约 10 公里",
    routeSteps: [
      {
        step: "01",
        time: "07:30",
        title: "南门入园直奔核心区",
        detail: "早场入园人流较少，可先乘观光车至核心外场区",
      },
      {
        step: "02",
        time: "07:50",
        title: "幼年大熊猫别墅",
        detail: "趁晨间凉爽看和花、和叶在外场木架进食与活动",
        highlightSlugs: ["he-hua-chengdu", "he-ye-chengdu"],
      },
      {
        step: "03",
        time: "09:00",
        title: "月亮产房",
        detail: "室外草坪区域视野开阔，便于观察亚成体及幼崽攀爬",
      },
      {
        step: "04",
        time: "10:30",
        title: "星星产房与新区展馆",
        detail: "顺游扩建新区与熊猫塔，避开正午高峰排队",
      },
    ],
    extraPhotoSpots: [
      { name: "六号别墅与幼年别墅外场", window: { start: "07:30", end: "10:30" }, note: "清晨顺光毛发通透，木架前常有近距离啃竹" },
      { name: "月亮产房室外木栈道", window: { start: "08:30", end: "11:00" }, note: "微俯视角减少玻璃反光，适合观察互动" },
    ],
    practicalTips: [
      { kind: "temperature", title: "高温转入室内", text: "夏季气温高于 26°C 时大熊猫多转入室内空调展厅" },
      { kind: "id", title: "实名预约证件", text: "需通过官方渠道提前实名购票，刷身份证原件入园" },
      { kind: "etiquette", title: "安静文明观猫", text: "请关闭相机闪光灯，不拍打玻璃或向展区投喂" },
    ],
  },
  ccrcgp: {
    durationLabel: "3–4 小时",
    durationNote: "各基地依山而建，建议穿防滑鞋",
    defaultTicketShort: "官网购票",
    defaultTicketNote: "卧龙神树坪与雅安碧峰峡分园预约",
    defaultHoursShort: "08:30–17:00",
    defaultHoursNote: "各基地入园时段请以当日公告为准",
    defaultAreaSummary: "卧龙神树坪 / 雅安碧峰峡 / 都江堰",
    defaultTransitText: "成都至卧龙神树坪自驾或景区大巴约 2 小时，雅安碧峰峡约 2 小时",
    routeSteps: [
      {
        step: "01",
        time: "08:30",
        title: "神树坪内圈与海归大熊猫乐园",
        detail: "上午山谷气温适宜，优先探访归国大熊猫外场圈舍",
        highlightSlugs: ["fu-bao", "xiang-xiang"],
      },
      {
        step: "02",
        time: "09:40",
        title: "外圈半山展区",
        detail: "沿步行栈道逐步上行，林荫与溪流外场适合远景观察",
      },
      {
        step: "03",
        time: "11:00",
        title: "繁育场与科普馆",
        detail: "临近午间回到室内了解繁育与野化放归历程",
      },
    ],
    extraPhotoSpots: [
      { name: "海归大熊猫外场高台", window: { start: "09:00", end: "11:30" }, note: "上午晨光与竹林背景层次丰富，便于抓拍进食" },
      { name: "碧峰峡白熊坪", window: { start: "09:00", end: "11:00" }, note: "山涧环境清幽，上午外场活动较规律" },
    ],
    practicalTips: [
      { kind: "temperature", title: "山区温差与雨具", text: "卧龙海拔较高且多阵雨，早晚建议加带防风外套" },
      { kind: "etiquette", title: "遵守限流与安静距离", text: "部分海归展区实行分批限流参观，请配合现场引导" },
    ],
  },
  "beijing-zoo": {
    durationLabel: "2–3 小时",
    durationNote: "含亚运馆与奥运馆室外运动场",
    defaultTicketShort: "含联票约 ¥19",
    defaultTicketNote: "大熊猫馆需另购或买动物园联票",
    defaultHoursShort: "07:30–18:00",
    defaultHoursNote: "大熊猫馆一般 08:00 起开放",
    defaultAreaSummary: "大熊猫奥运馆 / 亚运馆",
    defaultTransitText: "地铁 4 号线动物园站 C1 口出即达正门，进门右转步行约 3 分钟",
    distanceHint: "地铁 4 号线直达园区门口",
    routeSteps: [
      {
        step: "01",
        time: "08:00",
        title: "入园右转直达奥运馆",
        detail: "开馆时段外场温度宜人，先看奥运馆室外活动情况",
        highlightSlugs: ["meng-lan"],
      },
      {
        step: "02",
        time: "09:00",
        title: "亚运馆内厅与外场",
        detail: "顺路穿过展馆连廊，观察多只大熊猫的日常作息",
      },
      {
        step: "03",
        time: "10:15",
        title: "科普展廊错峰返程",
        detail: "周末客流升高前可转往科普廊休整后继续逛全园",
      },
    ],
    extraPhotoSpots: [
      { name: "奥运馆南侧外场围栏", window: { start: "08:30", end: "11:00" }, note: "早场顺光无强背影，常能在木架附近看到萌兰" },
    ],
    practicalTips: [
      { kind: "id", title: "节假日分段预约", text: "旺季周末馆区排队较长，建议开园时段即入园" },
      { kind: "etiquette", title: "勿高声呼喊或抛物", text: "展区紧邻游览通道，安静观察更能看到自然行为" },
    ],
  },
  "chongqing-zoo": {
    durationLabel: "2.5–3 小时",
    durationNote: "上下两院山地坡道较多",
    defaultTicketShort: "¥25",
    defaultTicketNote: "淡季 ¥20 / 旺季 ¥25（含大熊猫馆）",
    defaultHoursShort: "08:00–17:30",
    defaultHoursNote: "建议 09:00 前到达下院",
    defaultAreaSummary: "上熊猫馆 / 下熊猫馆（多园互通）",
    defaultTransitText: "轨道交通 2 号线动物园站 A 口出站步行约 2 分钟",
    routeSteps: [
      {
        step: "01",
        time: "08:45",
        title: "下熊猫馆室外院子",
        detail: "先看四喜丸子与双胞胎姐妹同框吃播",
        highlightSlugs: ["yu-ai-chongqing-2022", "yu-ke-chongqing-2022"],
      },
      {
        step: "02",
        time: "09:45",
        title: "上熊猫馆平台",
        detail: "从下院步道向上游览高龄与亚成体大熊猫展区",
      },
    ],
    extraPhotoSpots: [
      { name: "下熊猫馆水池旁院落", window: { start: "09:00", end: "11:00" }, note: "多只同院进食场面常见，适合广角记录" },
    ],
    practicalTips: [
      { kind: "temperature", title: "山城夏季防暑降温", text: "夏季 11 点后气温迅速升高，大熊猫多入冰室空调房" },
    ],
  },
  "qinling-four-treasures-park": {
    durationLabel: "2–3 小时",
    durationNote: "可同看秦岭大熊猫与朱鹮、羚牛",
    defaultTicketShort: "¥30",
    defaultTicketNote: "淡季 ¥20 / 旺季 ¥30",
    defaultHoursShort: "09:00–17:00",
    defaultHoursNote: "16:30 停止售票",
    defaultAreaSummary: "大熊猫一号馆 / 二号馆",
    defaultTransitText: "西安市周至县楼观台景区附近，距市区自驾约 1.5 小时",
    routeSteps: [
      {
        step: "01",
        time: "09:00",
        title: "大熊猫一号馆外场",
        detail: "进园后乘景交车先看棕色大熊猫七仔早场啃竹",
        highlightSlugs: ["qizai-qinling"],
      },
      {
        step: "02",
        time: "10:15",
        title: "二号馆与小熊猫园",
        detail: "顺游二号馆外场草地后步行看朱鹮与金丝猴",
      },
    ],
    extraPhotoSpots: [
      { name: "一号馆中心草坪视角", window: { start: "09:00", end: "11:15" }, note: "草坪反光柔和，最能拍出七仔棕白毛色质感" },
    ],
    practicalTips: [
      { kind: "id", title: "远离城区早出门", text: "周至县距西安主城区较远，上午早点到达外场活跃度最好" },
    ],
  },
  "ocean-park-hong-kong": {
    durationLabel: "半日游",
    durationNote: "香港大熊猫之旅与赛马会四川奇珍馆",
    defaultAreaSummary: "香港赛马会四川奇珍馆 / 大熊猫之旅",
    routeSteps: [
      {
        step: "01",
        time: "10:00",
        title: "入园先往海滨乐园大熊猫之旅",
        detail: "开园时段先看安安、可可适应与进食状态",
        highlightSlugs: ["an-an-hk-2019", "ke-ke-hk-2019"],
      },
      {
        step: "02",
        time: "11:00",
        title: "香港赛马会四川奇珍馆",
        detail: "看乐乐、盈盈与在港新生双胞胎家族展区",
      },
    ],
    extraPhotoSpots: [
      { name: "大熊猫之旅木桥通道", window: { start: "10:00", end: "12:00" }, note: "室内恒温仿森林布景，上午时段最活跃" },
    ],
    practicalTips: [
      { kind: "etiquette", title: "室内馆关闭闪光", text: "室内展馆光线较柔和，摄影请关闭闪光灯并低声交谈" },
    ],
  },
  "smithsonian-national-zoo": {
    durationLabel: "2 小时",
    durationNote: "亚洲步道核心展区，免费入园",
    defaultTicketShort: "免费",
    defaultTicketNote: "需提前在官网领取免费通行证",
    defaultAreaSummary: "亚洲步道（Asia Trail）大熊猫展区",
    routeSteps: [
      {
        step: "01",
        time: "08:30",
        title: "亚洲步道东侧外场",
        detail: "华盛顿清晨较凉爽，宝力和青宝外场攀爬较多",
        highlightSlugs: ["bao-li", "qing-bao"],
      },
      {
        step: "02",
        time: "09:30",
        title: "大熊猫室内观景廊",
        detail: "沿室内栈道看栖架与科普互动展示",
      },
    ],
    extraPhotoSpots: [
      { name: "Asia Trail 露天栈道", window: { start: "08:00", end: "11:30" }, note: "无玻璃阻隔，上午自然光与竹枝前景极佳" },
    ],
    practicalTips: [
      { kind: "id", title: "免费入园仍需领票", text: "园方免费开放但实行人数控制，行前务必确认官网通行证名额" },
    ],
  },
  "san-diego-zoo": {
    durationLabel: "2–3 小时",
    durationNote: "Panda Ridge 需按时段取号或排队",
    defaultAreaSummary: "Panda Ridge 展区",
    practicalTips: [
      { kind: "id", title: "分时段取通行卡", text: "Panda Ridge 人流较高，建议上午入园后先领观览时段票" },
    ],
  },
  "zoo-atlanta": {
    durationLabel: "2 小时",
    durationNote: "Grant Park 园区大熊猫展馆",
    practicalTips: [
      { kind: "temperature", title: "夏季午后室内展示", text: "亚特兰大午后气温较高时可至室内玻璃展厅观察" },
    ],
  },
  everland: {
    durationLabel: "2–3 小时",
    durationNote: "Panda World 热门展区多按限时入场",
    defaultAreaSummary: "Panda World 室内外展区",
    practicalTips: [
      { kind: "id", title: "现场智能排队入场", text: "爱宝乐园 Panda World 常采取 Q-Pass 或分批限时入内参观" },
    ],
  },
  "tiergarten-schonbrunn": {
    durationLabel: "2 小时",
    durationNote: "美泉宫皇家花园内的历史展馆",
    defaultAreaSummary: "美泉宫大熊猫馆（Panda House）",
    practicalTips: [
      { kind: "temperature", title: "欧洲夏季绿荫外场", text: "上午开园后可先看外场草地，正午时段常移至室内树屋休息" },
    ],
  },
};

function firstGuideValue(facilities: readonly Facility[], label: string): string | null {
  for (const facility of facilities) {
    const match = facility.guide.find((row) => row.label === label);
    if (match?.value) return match.value;
  }
  return null;
}

function compactHours(text: string): { value: string; sub?: string } | null {
  const span = /(\d{1,2}:\d{2})\s*[-–—~至到]\s*(\d{1,2}:\d{2})/.exec(text);
  if (span) {
    const normalized = `${span[1]!.padStart(5, "0")}–${span[2]!.padStart(5, "0")}`;
    const rest = text
      .replace(span[0], "")
      .replace(/^[\s常规开放至到，。、；：]+/, "")
      .replace(/[。]+$/, "")
      .trim();
    return { value: normalized, sub: rest || undefined };
  }
  return text.length <= 14 ? { value: text } : { value: "见官宣", sub: text };
}

/** Summarizes admission into a compact value + footnote subtitle without fabricating unrecorded prices. */
export function summarizeTicket(
  facilities: readonly Facility[],
  extras: VenueGuideExtras | undefined,
): { value: string; sub?: string; muted?: boolean } {
  const raw = firstGuideValue(facilities, "门票");
  if (raw) {
    if (raw.startsWith("免费")) {
      const rest = raw.replace(/^免费[。，\s]*/, "").replace(/[。]+$/, "");
      return { value: "免费", sub: rest || "部分时段需预约" };
    }
    const yen = /(\d+\s*日元)/.exec(raw);
    if (yen) return { value: yen[1]!, sub: raw };
    const rmb = /([¥￥]\s*\d+|\d+\s*元)/.exec(raw);
    if (rmb) return { value: rmb[1]!.replace(/\s+/g, ""), sub: raw };
    return { value: raw.length <= 8 ? raw : "查看票价", sub: raw.length > 8 ? raw : undefined };
  }
  if (extras?.defaultTicketShort) {
    return { value: extras.defaultTicketShort, sub: extras.defaultTicketNote };
  }
  return { value: "—", sub: "以官方公布为准", muted: true };
}

/** Builds the unified 3-column stat strip for an institution detail screen. */
export function buildVenueMetrics(
  institution: Pick<InstitutionDetail, "slug" | "residents" | "former" | "bornHere" | "facilities">,
): VenueMetric[] {
  const extras = VENUE_GUIDE_EXTRAS[institution.slug];
  const residentCount = institution.residents.length;
  const formerCount = institution.former.length;
  const ticket = summarizeTicket(institution.facilities, extras);

  const middle: VenueMetric =
    institution.bornHere > 0
      ? {
          key: "born",
          label: "在这里出生",
          value: `${institution.bornHere} 只`,
          sub: formerCount > 0 ? `${formerCount} 只曾在此居住` : "繁育记录",
          spoken: `在这里出生 ${institution.bornHere} 只`,
        }
      : {
          key: "born",
          label: "以前住过",
          value: formerCount > 0 ? `${formerCount} 只` : "—",
          muted: formerCount === 0,
          sub: formerCount > 0 ? "历史住客" : "暂无历史住客",
          spoken: formerCount > 0 ? `以前住过 ${formerCount} 只` : "以前住过暂无记录",
        };

  return [
    {
      key: "residents",
      label: "现在住这里",
      value: residentCount > 0 ? `${residentCount} 只` : "—",
      muted: residentCount === 0,
      sub: residentCount > 0 ? (formerCount > 0 && institution.bornHere > 0 ? `${formerCount} 只曾住` : "现居大熊猫") : "当前暂无大熊猫",
      spoken: residentCount > 0 ? `现在住这里 ${residentCount} 只` : "现在住这里暂无大熊猫",
    },
    middle,
    {
      key: "ticket",
      label: "门票概况",
      value: ticket.value,
      muted: ticket.muted,
      sub: ticket.sub,
      spoken: ticket.sub ? `门票概况，${ticket.value}，${ticket.sub}` : `门票概况 ${ticket.value}`,
    },
  ];
}

/** Builds up to 4 scannable Pre-Trip Bento cards prioritizing live API visitGuide data over static defaults. */
export function buildPreTripBento(
  institution: Pick<InstitutionDetail, "slug" | "facilities">,
): PreTripBentoItem[] {
  const extras = VENUE_GUIDE_EXTRAS[institution.slug];
  const clockSpec = VENUE_CLOCK_SPECS[institution.slug];
  const hoursRaw = firstGuideValue(institution.facilities, "开放时间");
  const parsedHours = hoursRaw ? compactHours(hoursRaw) : null;
  const items: PreTripBentoItem[] = [];

  if (parsedHours) {
    items.push({
      key: "hours",
      label: "开放时间",
      value: parsedHours.value,
      sub: parsedHours.sub,
      spoken: `开放时间 ${hoursRaw}`,
    });
  } else if (extras?.defaultHoursShort) {
    items.push({
      key: "hours",
      label: "开放时间",
      value: extras.defaultHoursShort,
      sub: extras.defaultHoursNote,
      spoken: `开放时间 ${extras.defaultHoursShort}`,
    });
  }

  const ticket = summarizeTicket(institution.facilities, extras);
  if (!ticket.muted) {
    items.push({
      key: "ticket",
      label: "门票预约",
      value: ticket.value,
      sub: ticket.sub,
      spoken: `门票预约 ${ticket.value}${ticket.sub ? `，${ticket.sub}` : ""}`,
    });
  }

  const apiWindow = institution.facilities.find((f) => f.viewing && f.viewing.active.length > 0)?.viewing?.active[0];
  const activeWindow = apiWindow ?? clockSpec?.active[0];
  if (activeWindow) {
    const windowStr = `${activeWindow.start}–${activeWindow.end}`;
    items.push({
      key: "bestWindow",
      label: "最佳观猫",
      value: windowStr,
      sub: "上午活跃进食高峰",
      spoken: `最佳观猫时段 ${windowStr}`,
    });
  }

  if (extras?.durationLabel) {
    items.push({
      key: "duration",
      label: "游览节奏",
      value: extras.durationLabel,
      sub: extras.durationNote,
      spoken: `建议游览 ${extras.durationLabel}`,
    });
  }

  return items;
}

/** Merges facility photoSpots from the API with curated field notes (API order leads, deduplicated by name). */
export function mergePhotoSpots(
  facilities: readonly Facility[],
  extras: VenueGuideExtras | undefined,
): CuratedPhotoSpot[] {
  const seen = new Set<string>();
  const out: CuratedPhotoSpot[] = [];

  for (const facility of facilities) {
    for (const spot of facility.photoSpots) {
      if (seen.has(spot.name)) continue;
      seen.add(spot.name);
      const curated = extras?.extraPhotoSpots?.find((item) => item.name === spot.name);
      out.push({
        name: spot.name,
        window: spot.window,
        note: curated?.note ?? `${facility.name} 观猫拍照点位`,
      });
    }
  }

  for (const spot of extras?.extraPhotoSpots ?? []) {
    if (seen.has(spot.name)) continue;
    seen.add(spot.name);
    out.push({ name: spot.name, window: spot.window, note: spot.note });
  }

  return out;
}

/** Merges facility tips from the API with practical pre-trip reminders. */
export function mergePracticalTips(
  facilities: readonly Facility[],
  extras: VenueGuideExtras | undefined,
): PracticalTip[] {
  const out: PracticalTip[] = [];
  const seenText = new Set<string>();

  for (const facility of facilities) {
    for (const tip of facility.tips) {
      if (seenText.has(tip.text)) continue;
      seenText.add(tip.text);
      out.push({
        kind: "info",
        title: tip.label,
        text: tip.text,
      });
    }
  }

  for (const tip of extras?.practicalTips ?? []) {
    if (seenText.has(tip.text)) continue;
    seenText.add(tip.text);
    out.push(tip);
  }

  return out;
}

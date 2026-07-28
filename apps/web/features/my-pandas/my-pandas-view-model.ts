import type { PublicAtlasDataset } from "@/features/public-content/public-release";
import type { PublicLocale } from "@/foundation/content/locales";
import type { PandaDetail } from "@/lib/types";

export interface MyPandasProfileSummary {
  id: string;
  slug: string;
  name: string;
  alternateName: string | null;
  status: string;
  currentPlace: string;
  href: string;
  aliases: string[];
}

export interface MyPandasCopy {
  eyebrow: string;
  title: string;
  description: string;
  releaseLabel: string;
  localOnlyTitle: string;
  localOnlyBody: string;
  privacyPoints: readonly string[];
  savedTitle: string;
  savedDescription: string;
  recentTitle: string;
  recentDescription: string;
  loading: string;
  emptySaved: string;
  emptyRecent: string;
  browseAtlas: string;
  openProfile: string;
  remove: string;
  clearSaved: string;
  clearRecent: string;
  sortLabel: string;
  sortRecent: string;
  sortName: string;
  savedAt: string;
  viewedAt: string;
  unavailableTitle: string;
  unavailableBody: string;
  stableId: string;
  noJsTitle: string;
  noJsBody: string;
  feedbackSavedRemoved: string;
  feedbackRecentRemoved: string;
  feedbackSavedCleared: string;
  feedbackRecentCleared: string;
  localCount: string;
}

export interface MyPandasViewModel {
  profiles: MyPandasProfileSummary[];
  copy: MyPandasCopy;
}

const copy = {
  zh: {
    eyebrow: "账号关注与本地回访",
    title: "我的熊猫",
    description: "查看账号私有的熊猫护照和当前浏览器的最近浏览。护照不会成为公开用户主页，也不会公开排名。",
    releaseLabel: "档案事实来自当前公开发布",
    localOnlyTitle: "护照与最近浏览使用不同存储边界",
    localOnlyBody: "关注关系和首次关注历史保存在账号私有护照中；最近浏览只保存在当前浏览器，可随时清除。",
    privacyPoints: [
      "熊猫护照只对当前登录账号可见，并可从关注事件重建。",
      "浏览器最近记录只保存稳定档案 ID 和本地操作时间。",
      "旧的匿名收藏不会转换为关注、护照或邮件许可。",
    ],
    savedTitle: "熊猫护照",
    savedDescription: "跨设备同步当前关注关系，并保留首次关注历史。",
    recentTitle: "最近浏览",
    recentDescription: "最多保留最近 12 个熊猫档案，用于恢复探索上下文。",
    loading: "正在读取熊猫护照和本地记录……",
    emptySaved: "当前浏览器还没有收藏档案。可以从任意熊猫档案页开始收藏。",
    emptyRecent: "当前浏览器还没有最近浏览记录。打开一个熊猫档案后会在这里出现。",
    browseAtlas: "浏览全部熊猫档案",
    openProfile: "打开档案",
    remove: "移除",
    clearSaved: "清除全部收藏",
    clearRecent: "清除全部最近浏览",
    sortLabel: "收藏排序",
    sortRecent: "最近收藏",
    sortName: "名称",
    savedAt: "收藏于",
    viewedAt: "浏览于",
    unavailableTitle: "当前发布中没有此档案",
    unavailableBody: "这个稳定 ID 可能已撤回、合并或尚未进入当前公开 Release。ZhiPanda 不会用旧缓存补写事实。",
    stableId: "稳定 ID",
    noJsTitle: "需要 JavaScript 才能读取本地记录",
    noJsBody: "关闭 JavaScript 时，本页仍提供隐私说明与普通档案导航，但不会显示护照或本地最近浏览。",
    feedbackSavedRemoved: "已从收藏中移除",
    feedbackRecentRemoved: "已从最近浏览中移除",
    feedbackSavedCleared: "已清除全部收藏",
    feedbackRecentCleared: "已清除全部最近浏览",
    localCount: "本地记录",
  },
  en: {
    eyebrow: "Account follows and local return",
    title: "My Pandas",
    description: "View your private Panda Passport and profiles recently opened in this browser. Passport data never becomes a public user profile or ranking.",
    releaseLabel: "Profile facts come from the current public release",
    localOnlyTitle: "Passport and recent history use separate storage boundaries",
    localOnlyBody: "Follows and first-follow history stay in your private account Passport; recent visits stay only in this browser and can be cleared at any time.",
    privacyPoints: [
      "Panda Passport is visible only to the signed-in account and can be rebuilt from Follow events.",
      "Local recent history stores only stable profile IDs and local action times.",
      "Legacy anonymous saves are never converted into Follow, Passport, or email consent.",
    ],
    savedTitle: "Panda Passport",
    savedDescription: "Sync current follows across devices while preserving first-follow history.",
    recentTitle: "Recently viewed",
    recentDescription: "Up to 12 recent panda profiles are retained to restore exploration context.",
    loading: "Reading Panda Passport and local history…",
    emptySaved: "No profiles are saved in this browser yet. Save one from any panda profile page.",
    emptyRecent: "No recent profile visits are stored in this browser yet. Open a panda profile to add one.",
    browseAtlas: "Browse all panda profiles",
    openProfile: "Open profile",
    remove: "Remove",
    clearSaved: "Clear all saved profiles",
    clearRecent: "Clear all recent profiles",
    sortLabel: "Saved profile sort",
    sortRecent: "Most recently saved",
    sortName: "Name",
    savedAt: "Saved",
    viewedAt: "Viewed",
    unavailableTitle: "Profile unavailable in this release",
    unavailableBody: "This stable ID may have been withdrawn, merged, or not included in the current public Release. ZhiPanda does not restore public facts from an old browser cache.",
    stableId: "Stable ID",
    noJsTitle: "JavaScript is required to read local records",
    noJsBody: "Without JavaScript, this page still provides privacy information and archive navigation, but cannot display Passport or local recent history.",
    feedbackSavedRemoved: "Removed from saved profiles",
    feedbackRecentRemoved: "Removed from recent profiles",
    feedbackSavedCleared: "Cleared all saved profiles",
    feedbackRecentCleared: "Cleared all recent profiles",
    localCount: "Local records",
  },
} as const satisfies Record<PublicLocale, MyPandasCopy>;

function localizedName(panda: PandaDetail, locale: PublicLocale): { name: string; alternateName: string | null } {
  if (locale === "zh") {
    return { name: panda.name_zh, alternateName: panda.name_en };
  }
  return {
    name: panda.name_en ?? panda.name_zh,
    alternateName: panda.name_en ? panda.name_zh : null,
  };
}

function statusLabel(status: PandaDetail["status"], locale: PublicLocale): string {
  const labels = locale === "zh"
    ? { alive: "存活", deceased: "已死亡", unknown: "状态未公开" }
    : { alive: "Alive", deceased: "Deceased", unknown: "Status unavailable" };
  return labels[status];
}

function currentPlaceLabel(panda: PandaDetail, locale: PublicLocale): string {
  return panda.current_place?.coarse_location
    ?? panda.current_location
    ?? (locale === "zh" ? "当前地点未公开" : "Current place not published");
}

function storageAliases(panda: PandaDetail): string[] {
  return Array.from(new Set([
    panda.slug,
    ...(panda.identity?.legacy_slugs.map((item) => item.value) ?? []),
  ]));
}

export function buildMyPandasViewModel(
  dataset: PublicAtlasDataset,
  locale: PublicLocale,
): MyPandasViewModel {
  return {
    copy: copy[locale],
    profiles: dataset.pandas.map((panda) => {
      const names = localizedName(panda, locale);
      return {
        id: panda.identity?.stable_id ?? panda.id,
        slug: panda.slug,
        name: names.name,
        alternateName: names.alternateName,
        status: statusLabel(panda.status, locale),
        currentPlace: currentPlaceLabel(panda, locale),
        href: `/${locale}/atlas/${panda.slug}`,
        aliases: storageAliases(panda),
      };
    }),
  };
}

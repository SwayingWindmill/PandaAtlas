import type { PandaListItem } from "@/features/pandas/pandas";

export interface SameCohortResult {
  label: string;
  items: { panda: PandaListItem; dateLabel: string }[];
}

function peerDateLabel(peerBirthDate: string, targetMonth: string | null): string {
  const month = peerBirthDate.slice(5, 7);
  const day = peerBirthDate.slice(8, 10);
  if (targetMonth && month === targetMonth && day) return `${Number(month)}月${Number(day)}日`;
  if (month) return `${Number(month)}月生`;
  return "同年";
}

function seasonSuffix(month: string | null): string {
  const m = month ? Number(month) : 0;
  if (m >= 3 && m <= 5) return "春";
  if (m >= 6 && m <= 8) return "夏";
  if (m >= 9 && m <= 11) return "秋";
  if (m === 12 || m === 1 || m === 2) return "冬";
  return "";
}

/**
 * Picks up to 4 living peers born in the same year as the focus panda, prioritizing pandas with
 * cover photos and nearby birth months.
 */
export function sameCohortPandas(
  target: { id: string; birthDate: string | null; deceased: boolean },
  index: PandaListItem[],
  limit = 4,
): SameCohortResult | null {
  if (target.deceased || !target.birthDate || !/^\d{4}/.test(target.birthDate)) return null;
  const targetYear = target.birthDate.slice(0, 4);
  const targetMonth = target.birthDate.length >= 7 ? target.birthDate.slice(5, 7) : null;
  const targetMonthNum = targetMonth ? Number(targetMonth) : 6;

  const peers = index
    .filter((item) => item.id !== target.id && !item.deceased && item.birthDate?.startsWith(targetYear))
    .sort((a, b) => {
      const coverDiff = Number(b.hasFullBleedCover) - Number(a.hasFullBleedCover);
      if (coverDiff !== 0) return coverDiff;
      const monthA = a.birthDate && a.birthDate.length >= 7 ? Number(a.birthDate.slice(5, 7)) : 99;
      const monthB = b.birthDate && b.birthDate.length >= 7 ? Number(b.birthDate.slice(5, 7)) : 99;
      return Math.abs(monthA - targetMonthNum) - Math.abs(monthB - targetMonthNum) || a.slug.localeCompare(b.slug);
    })
    .slice(0, limit)
    .map((panda) => ({
      panda,
      dateLabel: peerDateLabel(panda.birthDate!, targetMonth),
    }));

  if (peers.length === 0) return null;
  const season = seasonSuffix(targetMonth);
  return {
    label: season ? `${targetYear} 年${season}` : `${targetYear} 年生`,
    items: peers,
  };
}

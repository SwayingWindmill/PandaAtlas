import { useQuery } from "@tanstack/react-query";

import { bundledLearningDocument } from "@/features/learning/draft-catalog";
import { api } from "@/lib/api";

import type { MonthThemeEntry } from "./challenge";

// Development builds preview the working file, drafts included, as the 科普 screens do. Production builds
// show only what GET /api/v2/learning publishes.
function bundledThemes(): MonthThemeEntry[] {
  return (bundledLearningDocument() as { monthThemes?: MonthThemeEntry[] }).monthThemes ?? [];
}

export async function loadMonthThemes(): Promise<MonthThemeEntry[]> {
  if (__DEV__) return bundledThemes();
  const { data, error } = await api.GET("/api/v2/learning");
  if (error || !data) throw new Error("learning catalog unavailable");
  return (data.monthThemes ?? []) as MonthThemeEntry[];
}

/** Published 月度主题. Empty while loading or offline: the challenge then runs on its default checklist. */
export function useMonthThemes(): MonthThemeEntry[] {
  const { data } = useQuery({ queryKey: ["public", "month-themes"], queryFn: loadMonthThemes, staleTime: 3_600_000 });
  return data ?? [];
}

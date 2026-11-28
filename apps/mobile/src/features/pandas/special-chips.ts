import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import { lookAlikePairs } from "@/features/compare/look-alikes";
import { loadOverseasStatus } from "@/features/overseas/overseas-status";
import { loadLineage } from "@/lib/public-data";

import { loadPandaIndex } from "./pandas";

/**
 * 找熊猫's 双胞胎 and 归国 chips (v4 `02-find`): the pandas each one keeps. Twins come from sourced lineage
 * (same mother, same exact birth date), 归国 from the published overseas catalog. A chip shows only when its
 * set has a panda.
 */
export interface SpecialChips {
  双胞胎: ReadonlySet<string>;
  归国: ReadonlySet<string>;
}

export const SPECIAL_CHIPS = ["双胞胎", "归国"] as const;
export type SpecialChip = (typeof SPECIAL_CHIPS)[number];

/** The slugs behind each chip; an empty set while loading or when a source fails. */
export function useSpecialChips(): SpecialChips {
  const twins = useQuery({
    queryKey: ["find", "twins"],
    staleTime: 300_000,
    queryFn: async () => {
      const [pandas, links] = await Promise.all([loadPandaIndex(), loadLineage()]);
      return new Set(lookAlikePairs(pandas, links, []).flatMap((pair) => (pair.kind === "twins" ? [pair.a.slug, pair.b.slug] : [])));
    },
  });
  const returned = useQuery({
    queryKey: ["find", "returned"],
    staleTime: 300_000,
    queryFn: async () => new Set((await loadOverseasStatus()).flatMap((item) => (item.stage === "returned" ? [item.pandaSlug] : []))),
  });
  return useMemo(() => ({ 双胞胎: twins.data ?? new Set<string>(), 归国: returned.data ?? new Set<string>() }), [twins.data, returned.data]);
}

export function isSpecialChip(chip: string): chip is SpecialChip {
  return (SPECIAL_CHIPS as readonly string[]).includes(chip);
}

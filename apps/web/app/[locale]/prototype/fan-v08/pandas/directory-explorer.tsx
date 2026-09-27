"use client";

import { useDeferredValue, useMemo, useState } from "react";
import { ArrowDown } from "lucide-react";

import { Button } from "@/components/ui/button";

import {
  DirectoryControls,
  type AdvancedFilters,
  type BrowseMode,
} from "./directory-controls";
import styles from "./directory.module.css";
import { PandaPortraitCard } from "./panda-portrait-card";

export interface DirectoryPanda {
  id: string;
  slug: string;
  name: string;
  altName: string | null;
  gender: "male" | "female" | "unknown";
  status: "alive" | "deceased" | "unknown";
  birthYear: string | null;
  location: string | null;
  image: string | null;
  imageCandidates?: string[];
  imageAlt: string;
  credit: string | null;
  rights: string | null;
  published: boolean;
}

const PAGE_SIZE = 60;

const EMPTY_ADVANCED: AdvancedFilters = {
  gender: "all",
  status: "all",
  photo: "all",
  birthFrom: "",
  birthTo: "",
  location: "",
};

function normalize(value: string): string {
  return value
    .normalize("NFKD")
    .toLocaleLowerCase()
    .replace(/[\s_\-:,.()'’]+/g, "")
    .trim();
}

export function DirectoryExplorer({
  locale,
  pandas,
  initialQuery = "",
}: {
  locale: "zh" | "en";
  pandas: DirectoryPanda[];
  initialQuery?: string;
}) {
  const zh = locale === "zh";
  const [query, setQuery] = useState(initialQuery);
  const [mode, setMode] = useState<BrowseMode>("all");
  const [advanced, setAdvanced] = useState<AdvancedFilters>(EMPTY_ADVANCED);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const deferredQuery = useDeferredValue(query);
  const deferredLocation = useDeferredValue(advanced.location);

  const filtered = useMemo(() => {
    const needle = normalize(deferredQuery);
    const locationNeedle = normalize(deferredLocation);
    const birthFrom = advanced.birthFrom ? Number(advanced.birthFrom) : null;
    const birthTo = advanced.birthTo ? Number(advanced.birthTo) : null;

    return pandas.filter((panda) => {
      if (mode === "photos" && !panda.image) return false;
      if (mode === "alive" && panda.status !== "alive") return false;

      if (advanced.gender !== "all" && panda.gender !== advanced.gender) return false;
      if (advanced.status !== "all" && panda.status !== advanced.status) return false;
      if (advanced.photo === "with" && !panda.image) return false;
      if (advanced.photo === "without" && panda.image) return false;

      if (birthFrom || birthTo) {
        const year = panda.birthYear ? Number(panda.birthYear) : null;
        if (!year) return false;
        if (birthFrom && year < birthFrom) return false;
        if (birthTo && year > birthTo) return false;
      }

      if (locationNeedle && !normalize(panda.location ?? "").includes(locationNeedle)) return false;

      if (!needle) return true;

      return normalize([
        panda.name,
        panda.altName,
        panda.slug,
        panda.birthYear,
        panda.location,
      ].filter(Boolean).join(" ")).includes(needle);
    });
  }, [advanced.birthFrom, advanced.birthTo, advanced.gender, advanced.photo, advanced.status, deferredLocation, deferredQuery, mode, pandas]);

  const visible = filtered.slice(0, visibleCount);
  const locationOptions = useMemo(() => {
    return Array.from(
      new Set(
        pandas
          .map((panda) => panda.location?.trim())
          .filter((location): location is string => Boolean(location)),
      ),
    )
      .sort((a, b) => a.localeCompare(b, locale === "zh" ? "zh-CN" : "en"))
      .slice(0, 120);
  }, [locale, pandas]);

  const resetWindow = () => setVisibleCount(PAGE_SIZE);

  const handleQueryChange = (value: string) => {
    setQuery(value);
    resetWindow();
  };

  const handleModeChange = (value: BrowseMode) => {
    setMode(value);
    resetWindow();
  };

  const handleAdvancedChange = (value: AdvancedFilters) => {
    setAdvanced(value);
    resetWindow();
  };

  const clearFilters = () => {
    setQuery("");
    setMode("all");
    setAdvanced(EMPTY_ADVANCED);
    resetWindow();
  };

  const activeAdvancedCount = [
    advanced.gender !== "all",
    advanced.status !== "all",
    advanced.photo !== "all",
    Boolean(advanced.birthFrom || advanced.birthTo),
    Boolean(advanced.location.trim()),
  ].filter(Boolean).length;

  return (
    <>
      <DirectoryControls
        locale={locale}
        query={query}
        mode={mode}
        filteredCount={filtered.length}
        advanced={advanced}
        activeAdvancedCount={activeAdvancedCount}
        locationOptions={locationOptions}
        onQueryChange={handleQueryChange}
        onModeChange={handleModeChange}
        onAdvancedChange={handleAdvancedChange}
        onClearAll={clearFilters}
      />

      <section className={styles.listSection} aria-label={zh ? "熊猫目录" : "Panda directory"}>
        <div className={styles.listShell}>
          {visible.length ? (
            <div className={styles.pandaGrid} data-testid="fan-v08-directory-list">
              {visible.map((panda, index) => (
                <PandaPortraitCard
                  key={panda.id}
                  locale={locale}
                  panda={panda}
                  index={index}
                  priority={index < 2}
                />
              ))}
            </div>
          ) : (
            <div className={styles.emptyState}>
              <h2>{zh ? "没有匹配的熊猫" : "No pandas matched"}</h2>
              <p>{zh ? "换一个名字或清除筛选继续浏览。" : "Try another name or clear the filters to continue browsing."}</p>
              <Button type="button" variant="outline" onClick={clearFilters}>
                {zh ? "清除条件" : "Clear filters"}
              </Button>
            </div>
          )}

          {filtered.length > visible.length ? (
            <div className={styles.loadMoreRow}>
              <Button
                type="button"
                variant="outline"
                onClick={() => setVisibleCount((value) => value + PAGE_SIZE)}
              >
                <span>
                  {zh
                    ? `继续显示 ${Math.min(PAGE_SIZE, filtered.length - visible.length)} 只`
                    : `Show ${Math.min(PAGE_SIZE, filtered.length - visible.length)} more`}
                </span>
                <span className={styles.loadMoreMeta}>
                  <em>{visible.length} / {filtered.length}</em>
                  <ArrowDown aria-hidden="true" />
                </span>
              </Button>
            </div>
          ) : null}
        </div>
      </section>
    </>
  );
}

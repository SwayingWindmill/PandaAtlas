/* eslint-disable @next/next/no-img-element -- prototype review renders identity-matched research media directly. */
"use client";

import type { Route } from "next";
import Link from "next/link";
import { useDeferredValue, useMemo, useState } from "react";
import { ArrowRight, Search, SlidersHorizontal } from "lucide-react";

import styles from "./directory.module.css";

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
  imageAlt: string;
  credit: string | null;
  rights: string | null;
  published: boolean;
}

type BrowseMode = "all" | "photos" | "alive" | "female" | "male";
const PAGE_SIZE = 60;

function normalize(value: string): string {
  return value
    .normalize("NFKD")
    .toLocaleLowerCase()
    .replace(/[\s_\-:,.()'’]+/g, "")
    .trim();
}

function genderLabel(value: DirectoryPanda["gender"], zh: boolean): string {
  if (value === "female") return zh ? "雌性" : "Female";
  if (value === "male") return zh ? "雄性" : "Male";
  return "";
}

function statusLabel(value: DirectoryPanda["status"], zh: boolean): string {
  if (value === "alive") return zh ? "在世" : "Living";
  if (value === "deceased") return zh ? "历史档案" : "Historic";
  return "";
}

function PandaThumbnail({ panda, zh }: { panda: DirectoryPanda; zh: boolean }) {
  if (panda.image) {
    return <img src={panda.image} alt={panda.imageAlt} loading="lazy" />;
  }

  return (
    <span className={styles.noPhoto} aria-label={zh ? `${panda.name}暂无确认个体照片` : `No confirmed individual photograph for ${panda.name}`}>
      <span aria-hidden="true">●</span>
      <small>{zh ? "暂无照片" : "No photo"}</small>
    </span>
  );
}

function PandaIdentity({ panda }: { panda: DirectoryPanda }) {
  return (
    <span className={styles.identity}>
      <strong>{panda.name}</strong>
      {panda.altName ? <em>{panda.altName}</em> : null}
    </span>
  );
}

export function DirectoryExplorer({ locale, pandas, initialQuery = "" }: { locale: "zh" | "en"; pandas: DirectoryPanda[]; initialQuery?: string }) {
  const zh = locale === "zh";
  const [query, setQuery] = useState(initialQuery);
  const [mode, setMode] = useState<BrowseMode>("all");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const deferredQuery = useDeferredValue(query);

  const filtered = useMemo(() => {
    const needle = normalize(deferredQuery);
    return pandas.filter((panda) => {
      if (mode === "photos" && !panda.image) return false;
      if (mode === "alive" && panda.status !== "alive") return false;
      if (mode === "female" && panda.gender !== "female") return false;
      if (mode === "male" && panda.gender !== "male") return false;

      if (!needle) return true;
      return normalize([
        panda.name,
        panda.altName,
        panda.slug,
        panda.birthYear,
        panda.location,
      ].filter(Boolean).join(" ")).includes(needle);
    });
  }, [deferredQuery, mode, pandas]);

  const visible = filtered.slice(0, visibleCount);
  const modes: Array<{ id: BrowseMode; label: string }> = [
    { id: "all", label: zh ? "全部" : "All" },
    { id: "photos", label: zh ? "有照片" : "With photo" },
    { id: "alive", label: zh ? "在世" : "Living" },
    { id: "female", label: zh ? "雌性" : "Female" },
    { id: "male", label: zh ? "雄性" : "Male" },
  ];

  const resetWindow = () => setVisibleCount(PAGE_SIZE);

  return (
    <>
      <section className={styles.discoveryRail} id="directory-search" aria-label={zh ? "寻找熊猫" : "Find pandas"}>
        <div className={styles.discoveryShell}>
          <div className={styles.searchLine}>
            <Search aria-hidden="true" />
            <input
              type="search"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                resetWindow();
              }}
              aria-label={zh ? "按名字搜索熊猫" : "Search pandas by name"}
              placeholder={zh ? "搜索名字、英文名或标识" : "Search name, alternate name, or identifier"}
            />
            <span aria-live="polite">{zh ? `${filtered.length} 只` : `${filtered.length} pandas`}</span>
          </div>

          <div className={styles.modeRow}>
            <div className={styles.modeButtons} role="group" aria-label={zh ? "快速筛选" : "Quick filters"}>
              {modes.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  aria-pressed={mode === item.id}
                  onClick={() => {
                    setMode(item.id);
                    resetWindow();
                  }}
                >
                  {item.label}
                </button>
              ))}
            </div>
            <Link href={`/${locale}/pandas` as Route} className={styles.precisionLink}>
              <SlidersHorizontal aria-hidden="true" />
              {zh ? "更多筛选" : "More filters"}
            </Link>
          </div>
        </div>
      </section>

      <section className={styles.listSection} aria-labelledby="panda-list-heading">
        <div className={styles.listShell}>
          <div className={styles.listHeading}>
            <div>
              <h2 id="panda-list-heading">{zh ? "熊猫列表" : "Panda list"}</h2>
              <p>{zh ? "缩略图和名字共同构成每只熊猫的主体信息；其余字段只用于快速辨认。" : "Thumbnail and name are the primary identity cues. Everything else stays secondary."}</p>
            </div>
            <span>{zh ? `显示 ${Math.min(visible.length, filtered.length)} / ${filtered.length}` : `Showing ${Math.min(visible.length, filtered.length)} / ${filtered.length}`}</span>
          </div>

          {visible.length ? (
            <div className={styles.pandaList} data-testid="fan-v08-directory-list">
              {visible.map((panda) => {
                const content = (
                  <>
                    <span className={styles.thumbnail}><PandaThumbnail panda={panda} zh={zh} /></span>
                    <PandaIdentity panda={panda} />
                    <span className={styles.metaCluster}>
                      <span className={styles.birth}>{panda.birthYear ?? ""}</span>
                      <span>{genderLabel(panda.gender, zh)}</span>
                      <span>{statusLabel(panda.status, zh)}</span>
                    </span>
                    <span className={styles.accessState}>
                      {panda.published ? (zh ? "已发布" : "Published") : (zh ? "研究原型" : "Research")}
                    </span>
                    {panda.published ? <ArrowRight className={styles.rowArrow} aria-hidden="true" /> : null}
                  </>
                );

                return panda.published ? (
                  <Link key={panda.id} className={styles.pandaRow} data-testid="fan-v08-panda-row" href={`/${locale}/pandas/${panda.slug}` as Route}>
                    {content}
                  </Link>
                ) : (
                  <div key={panda.id} className={`${styles.pandaRow} ${styles.researchRow}`} data-testid="fan-v08-panda-row">
                    {content}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className={styles.emptyState}>
              <h2>{zh ? "没有匹配的熊猫" : "No pandas matched"}</h2>
              <p>{zh ? "换一个名字或清除筛选继续浏览。" : "Try another name or clear the filters to continue browsing."}</p>
              <button type="button" onClick={() => { setQuery(""); setMode("all"); resetWindow(); }}>{zh ? "清除条件" : "Clear filters"}</button>
            </div>
          )}

          {filtered.length > visible.length ? (
            <div className={styles.loadMoreRow}>
              <button type="button" onClick={() => setVisibleCount((value) => value + PAGE_SIZE)}>
                <span>{zh ? `继续显示 ${Math.min(PAGE_SIZE, filtered.length - visible.length)} 只` : `Show ${Math.min(PAGE_SIZE, filtered.length - visible.length)} more`}</span>
                <em>{visible.length} / {filtered.length}</em>
              </button>
            </div>
          ) : null}
        </div>
      </section>
    </>
  );
}

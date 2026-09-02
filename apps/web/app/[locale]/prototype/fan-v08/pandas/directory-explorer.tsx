/* eslint-disable @next/next/no-img-element -- V8 review intentionally renders isolated, identity-matched prototype media fixtures. */
"use client";

import type { Route } from "next";
import Link from "next/link";
import { useDeferredValue, useMemo, useState } from "react";
import { ArrowRight, Search, SlidersHorizontal, Shuffle } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";

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
const PHOTO_BATCH_SIZE = 48;

function normalize(value: string): string {
  return value
    .normalize("NFKD")
    .toLocaleLowerCase()
    .replace(/[\s_\-:,.()'’]+/g, "")
    .trim();
}

function metaFor(panda: DirectoryPanda, zh: boolean): string {
  const gender = panda.gender === "female"
    ? zh ? "雌性" : "Female"
    : panda.gender === "male"
      ? zh ? "雄性" : "Male"
      : null;
  const status = panda.status === "alive"
    ? zh ? "在世" : "Living"
    : panda.status === "deceased"
      ? zh ? "历史档案" : "Historic"
      : null;

  return [panda.birthYear, gender, panda.location, status].filter(Boolean).join(" · ");
}

function PandaCaption({ panda, zh, showArrow }: { panda: DirectoryPanda; zh: boolean; showArrow: boolean }) {
  return (
    <>
      <span className={styles.visualCaption}>
        <span>
          <strong>{panda.name}</strong>
          {panda.altName ? <em>{panda.altName}</em> : null}
        </span>
        {showArrow ? <ArrowRight aria-hidden="true" /> : <small>{zh ? "研究库原型" : "Research prototype"}</small>}
      </span>
      {metaFor(panda, zh) ? <span className={styles.visualMeta}>{metaFor(panda, zh)}</span> : null}
    </>
  );
}

export function DirectoryExplorer({ locale, pandas, initialQuery = "" }: { locale: "zh" | "en"; pandas: DirectoryPanda[]; initialQuery?: string }) {
  const zh = locale === "zh";
  const reduceMotion = useReducedMotion();
  const [query, setQuery] = useState(initialQuery);
  const [mode, setMode] = useState<BrowseMode>("all");
  const [photoLimit, setPhotoLimit] = useState(PHOTO_BATCH_SIZE);
  const deferredQuery = useDeferredValue(query);

  const filtered = useMemo(() => {
    const needle = normalize(deferredQuery);
    return pandas.filter((panda) => {
      if (mode === "photos" && !panda.image) return false;
      if (mode === "alive" && panda.status !== "alive") return false;
      if (mode === "female" && panda.gender !== "female") return false;
      if (mode === "male" && panda.gender !== "male") return false;

      if (!needle) return true;
      const haystack = normalize([
        panda.name,
        panda.altName,
        panda.slug,
        panda.birthYear,
        panda.location,
      ].filter(Boolean).join(" "));
      return haystack.includes(needle);
    });
  }, [deferredQuery, mode, pandas]);

  const photographed = filtered.filter((panda) => Boolean(panda.image));
  const visiblePhotographed = photographed.slice(0, photoLimit);
  const namesOnly = filtered.filter((panda) => !panda.image)
    .sort((left, right) => left.name.localeCompare(right.name, locale));

  const modes: Array<{ id: BrowseMode; label: string }> = [
    { id: "all", label: zh ? "全部" : "All" },
    { id: "photos", label: zh ? "从照片开始" : "Start with photos" },
    { id: "alive", label: zh ? "还在世" : "Living" },
    { id: "female", label: zh ? "雌性" : "Female" },
    { id: "male", label: zh ? "雄性" : "Male" },
  ];

  const resetPhotoWindow = () => setPhotoLimit(PHOTO_BATCH_SIZE);

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
                resetPhotoWindow();
              }}
              aria-label={zh ? "按名字搜索熊猫" : "Search pandas by name"}
              placeholder={zh ? "输入名字：美香、福宝、小奇迹……" : "Type a name: Mei Xiang, Fu Bao, Xiao Qi Ji…"}
            />
            <span aria-live="polite">{zh ? `${filtered.length} 只` : `${filtered.length} pandas`}</span>
          </div>

          <div className={styles.modeRow}>
            <div className={styles.modeButtons} role="group" aria-label={zh ? "快速浏览方式" : "Quick browse modes"}>
              {modes.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  aria-pressed={mode === item.id}
                  onClick={() => {
                    setMode(item.id);
                    resetPhotoWindow();
                  }}
                >
                  {item.label}
                </button>
              ))}
            </div>
            <Link href={`/${locale}/pandas` as Route} className={styles.precisionLink}>
              <SlidersHorizontal aria-hidden="true" />
              {zh ? "正式站精确筛选" : "Production precise filters"}
            </Link>
          </div>
        </div>
      </section>

      <section className={styles.gallerySection} aria-labelledby="visual-index-heading">
        <div className={styles.sectionShell}>
          <div className={styles.sectionHeading}>
            <h2 id="visual-index-heading">{zh ? "先从一张脸开始。" : "Start with a face."}</h2>
            <p>{zh ? "照片不是结果缩略图，而是认识一只熊猫的第一条线索。本地研究库影像只用于这张原型评审，不代表已经获得公开发布资格。" : "Photography is not a result thumbnail. It is the first clue to an individual panda. Local research-vault media appears here for prototype review only and is not publication clearance."}</p>
          </div>

          {photographed.length ? (
            <div className={styles.visualGrid} data-testid="fan-v08-directory-grid">
              {visiblePhotographed.map((panda) => (
                <motion.article
                  className={styles.visualCard}
                  key={panda.id}
                  layout={reduceMotion ? false : "position"}
                  transition={reduceMotion ? { duration: 0 } : { layout: { duration: 0.46, ease: [0.16, 1, 0.3, 1] } }}
                >
                  {panda.published ? (
                    <Link className={styles.visualLink} href={`/${locale}/pandas/${panda.slug}` as Route}>
                      <span className={styles.visualFrame}>
                        <img src={panda.image ?? ""} alt={panda.imageAlt} loading="lazy" />
                        <span className={styles.visualShade} aria-hidden="true" />
                      </span>
                      <PandaCaption panda={panda} zh={zh} showArrow />
                    </Link>
                  ) : (
                    <div className={styles.visualLink}>
                      <span className={styles.visualFrame}>
                        <img src={panda.image ?? ""} alt={panda.imageAlt} loading="lazy" />
                        <span className={styles.visualShade} aria-hidden="true" />
                      </span>
                      <PandaCaption panda={panda} zh={zh} showArrow={false} />
                    </div>
                  )}
                  {panda.credit ? <p className={styles.photoCredit}>{panda.credit}{panda.rights ? ` · ${panda.rights}` : ""}</p> : null}
                </motion.article>
              ))}
            </div>
          ) : (
            <div className={styles.noVisualResults}>
              <p>{zh ? "这个条件下暂时没有确认的个体照片。名字索引仍会保留匹配的研究 Subject。" : "There are no confirmed individual photographs for this view. Matching research subjects still remain in the name index."}</p>
            </div>
          )}

          {photographed.length > visiblePhotographed.length ? (
            <div className={styles.loadMoreRow}>
              <button type="button" onClick={() => setPhotoLimit((value) => value + PHOTO_BATCH_SIZE)}>
                <span>{zh ? `继续浏览另外 ${Math.min(PHOTO_BATCH_SIZE, photographed.length - visiblePhotographed.length)} 只` : `Browse ${Math.min(PHOTO_BATCH_SIZE, photographed.length - visiblePhotographed.length)} more`}</span>
                <em>{visiblePhotographed.length} / {photographed.length}</em>
              </button>
            </div>
          ) : null}
        </div>
      </section>

      {mode !== "photos" ? (
        <section className={styles.nameSection} aria-labelledby="name-index-heading">
          <div className={styles.sectionShell}>
            <div className={styles.nameHeading}>
              <h2 id="name-index-heading">{zh ? "没有照片，也仍然是一个名字。" : "No photograph does not mean no identity."}</h2>
              <p>{zh ? "没有确认个体影像的研究 Subject，不会被塞进一排灰色占位卡。它们在这里以名字和已知基础信息继续被看见。" : "Research subjects without confirmed individual imagery do not become rows of gray placeholders. They remain visible through names and the basic information actually known."}</p>
            </div>

            {namesOnly.length ? (
              <div className={styles.nameIndex}>
                {namesOnly.map((panda) => panda.published ? (
                  <Link key={panda.id} href={`/${locale}/pandas/${panda.slug}` as Route}>
                    <span>
                      <strong>{panda.name}</strong>
                      {panda.altName ? <em>{panda.altName}</em> : null}
                    </span>
                    <span>{metaFor(panda, zh) || (zh ? "公开基础档案" : "Public basic profile")}</span>
                    <ArrowRight aria-hidden="true" />
                  </Link>
                ) : (
                  <div key={panda.id}>
                    <span>
                      <strong>{panda.name}</strong>
                      {panda.altName ? <em>{panda.altName}</em> : null}
                    </span>
                    <span>{metaFor(panda, zh) || (zh ? "研究库基础记录" : "Research-vault record")}</span>
                    <small>{zh ? "原型" : "Prototype"}</small>
                  </div>
                ))}
              </div>
            ) : filtered.length ? (
              <p className={styles.namesComplete}>{zh ? "当前匹配的熊猫都有确认个体影像。" : "Every panda in the current result has confirmed individual media."}</p>
            ) : null}
          </div>
        </section>
      ) : null}

      {!filtered.length ? (
        <section className={styles.emptyState}>
          <div>
            <h2>{zh ? "没有找到这个名字。" : "That name is not here yet."}</h2>
            <p>{zh ? "换一个名字，或回到“全部”继续浏览当前原型数据集。" : "Try another name or return to All to keep browsing the current prototype dataset."}</p>
            <button type="button" onClick={() => { setQuery(""); setMode("all"); resetPhotoWindow(); }}>{zh ? "清除条件" : "Clear filters"}</button>
          </div>
        </section>
      ) : null}

      <section className={styles.randomScene}>
        <div>
          <h2>{zh ? "不知道从谁开始？\n交给偶然。" : "Not sure who to meet?\nLeave it to chance."}</h2>
          <p>{zh ? "随机功能仍只进入正式已发布熊猫；研究库 Subject 不会被当成公开档案。" : "Random discovery still opens published pandas only; research-vault subjects are never presented as public profiles."}</p>
          <Link href={`/${locale}/games/random` as Route}><Shuffle aria-hidden="true" />{zh ? "随机遇见一只已发布熊猫" : "Meet a published panda at random"}<ArrowRight aria-hidden="true" /></Link>
        </div>
      </section>
    </>
  );
}

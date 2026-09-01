"use client";

import type { Route } from "next";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useState } from "react";

import styles from "./prototype.module.css";

export interface HeroStagePanda {
  id: string;
  slug: string;
  name: string;
  meta: string;
  imageUrl: string;
  imageAlt: string;
}

export function HeroStage({ locale, pandas, total }: { locale: "zh" | "en"; pandas: HeroStagePanda[]; total: number }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const reduceMotion = useReducedMotion();
  const active = pandas[activeIndex] ?? pandas[0];

  if (!active) return null;

  return (
    <div className={styles.heroStage}>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={active.id}
          className={styles.heroStageScene}
          initial={reduceMotion ? { opacity: 1 } : { opacity: 0, scale: 1.035, x: 18 }}
          animate={reduceMotion ? { opacity: 1 } : { opacity: 1, scale: 1, x: 0 }}
          exit={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.99, x: -12 }}
          transition={{ duration: reduceMotion ? 0.01 : 0.72, ease: [0.22, 1, 0.36, 1] }}
        >
          <Link href={`/${locale}/pandas/${active.slug}` as Route} className={styles.heroStageLink}>
            <img src={active.imageUrl} alt={active.imageAlt} />
            <span className={styles.heroStageShade} aria-hidden="true" />
            <span className={styles.heroStageIdentity}>
              <strong>{active.name}</strong>
              {active.meta ? <span>{active.meta}</span> : null}
            </span>
          </Link>
        </motion.div>
      </AnimatePresence>

      <div className={styles.heroStageRail} aria-label={locale === "zh" ? "切换熊猫" : "Switch panda"}>
        {pandas.slice(0, 4).map((panda, index) => (
          <button
            key={panda.id}
            type="button"
            className={index === activeIndex ? styles.heroStageThumbActive : styles.heroStageThumb}
            onClick={() => setActiveIndex(index)}
            aria-label={panda.name}
            aria-pressed={index === activeIndex}
          >
            <img src={panda.imageUrl} alt="" />
            <span>{panda.name}</span>
          </button>
        ))}
      </div>

      <Link className={styles.heroStageCount} href={`/${locale}/pandas` as Route}>
        <strong>{total}</strong>
        <span>{locale === "zh" ? "只熊猫 →" : "pandas →"}</span>
      </Link>
    </div>
  );
}

"use client";

/* eslint-disable @next/next/no-img-element -- prototype renders current published external panda media directly. */

import type { Route } from "next";
import Link from "next/link";
import { Heart, RefreshCw } from "lucide-react";
import { LazyMotion, m, useReducedMotion } from "motion/react";
import { useState } from "react";

import { Button } from "@/components/ui/button";

import styles from "./prototype.module.css";

export interface DiscoveryPanda {
  id: string;
  slug: string;
  name: string;
  altName: string | null;
  birthYear: string | null;
  location: string | null;
  imageUrl: string;
  imageAlt: string;
}

const loadMotionFeatures = () => import("./motion-features").then((module) => module.default);

function rotate<T>(items: readonly T[], offset: number, count: number): T[] {
  if (!items.length) return [];
  return Array.from({ length: Math.min(count, items.length) }, (_, index) => items[(index + offset) % items.length]);
}

export function DiscoveryGrid({ locale, pandas }: { locale: "zh" | "en"; pandas: DiscoveryPanda[] }) {
  const zh = locale === "zh";
  const [offset, setOffset] = useState(0);
  const reduceMotion = useReducedMotion();
  const visible = rotate(pandas, offset, 15);

  return (
    <LazyMotion features={loadMotionFeatures} strict>
      <div>
        <div className={styles.discoveryToolbar}>
          <div className={styles.discoveryTabs} role="group" aria-label={zh ? "熊猫发现方式" : "Panda discovery mode"}>
            <span className={styles.discoveryTabActive}>{zh ? "推荐认识" : "Meet these"}</span>
            <Link href={`/${locale}/pandas?gender=female` as Route}>{zh ? "女生" : "Female"}</Link>
            <Link href={`/${locale}/pandas?gender=male` as Route}>{zh ? "男生" : "Male"}</Link>
          </div>
          <Button
            type="button"
            variant="outline"
            className={styles.shuffleButton}
            onClick={() => setOffset((current) => pandas.length ? (current + 7) % pandas.length : 0)}
          >
            <m.span
              key={offset}
              aria-hidden="true"
              className={styles.shuffleIcon}
              initial={reduceMotion ? false : { rotate: -70, opacity: 0.5 }}
              animate={{ rotate: 0, opacity: 1 }}
              transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
            >
              <RefreshCw />
            </m.span>
            {zh ? "换一批" : "Shuffle"}
          </Button>
        </div>
        <div className={styles.discoveryGrid} aria-live="polite">
          {visible.map((panda, index) => (
            <m.div
              key={`${offset}-${panda.id}`}
              className={styles.discoveryMotionItem}
              initial={reduceMotion ? false : { opacity: 0, y: 10, scale: 0.99 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{
                duration: 0.3,
                delay: reduceMotion ? 0 : Math.min(index * 0.016, 0.1),
                ease: [0.22, 1, 0.36, 1],
              }}
            >
              <Link className={styles.discoveryCard} href={`/${locale}/pandas/${panda.slug}` as Route}>
                <div className={styles.discoveryMedia}>
                  <img src={panda.imageUrl} alt={panda.imageAlt} loading="lazy" />
                  <span className={styles.discoveryHeart}><Heart aria-hidden="true" /></span>
                </div>
                <div className={styles.discoveryInfo}>
                  <strong>{panda.name}</strong>
                  <span>{[panda.altName, panda.birthYear, panda.location].filter(Boolean).join(" · ")}</span>
                </div>
              </Link>
            </m.div>
          ))}
        </div>
      </div>
    </LazyMotion>
  );
}

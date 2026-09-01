"use client";

import type { Route } from "next";
import Link from "next/link";
import { ArrowDown, ArrowUpRight, Shuffle } from "lucide-react";

import { BlurText } from "@/components/react-bits/blur-text";
import { Button } from "@/components/ui/button";

import styles from "./prototype.module.css";

export interface ImmersiveHeroPanda {
  id: string;
  slug: string;
  name: string;
  meta: string;
  imageUrl: string;
  imageAlt: string;
}

export function ImmersiveHero({ locale, pandas, total }: { locale: "zh" | "en"; pandas: ImmersiveHeroPanda[]; total: number }) {
  const zh = locale === "zh";
  const active = pandas[0];
  if (!active) return null;

  return (
    <section className={styles.immersiveHero}>
      <div className={styles.immersiveHeroMedia}>
        <img src={active.imageUrl} alt={active.imageAlt} />
      </div>
      <div className={styles.immersiveHeroShade} aria-hidden="true" />

      <div className={styles.immersiveHeroContent}>
        <BlurText
          text={zh ? "从一只熊猫，走进整个世界。" : "One panda can open an entire world."}
          className={styles.immersiveHeroTitle}
          animateBy={zh ? "letters" : "words"}
          delay={zh ? 64 : 105}
        />
        <p className={styles.immersiveHeroLead}>{zh
          ? "家族、地点、时间与记忆，不再是分散的资料。它们都从同一个名字开始。"
          : "Family, places, moments, and memories stop being separate records. They all begin with one name."}</p>
        <div className={styles.immersiveHeroActions}>
          <Button asChild className={styles.heroPrimaryCta}>
            <Link href={`/${locale}/prototype/fan-v07/panda/${active.slug}` as Route}>{zh ? `认识${active.name}` : `Meet ${active.name}`}<ArrowUpRight aria-hidden="true" /></Link>
          </Button>
          <Button asChild variant="outline" className={styles.heroSecondaryCta}>
            <Link href={`/${locale}/games/random` as Route}><Shuffle aria-hidden="true" />{zh ? "换一只看看" : "Meet another"}</Link>
          </Button>
        </div>
      </div>

      <Link href={`/${locale}/prototype/fan-v07/panda/${active.slug}` as Route} className={styles.heroIdentity}>
        <span>{zh ? "今天从这里开始" : "Start here today"}</span>
        <strong>{active.name}</strong>
        {active.meta ? <em>{active.meta}</em> : null}
        <ArrowUpRight aria-hidden="true" />
      </Link>

      <div className={styles.heroAtlasCount}>
        <strong>{total}</strong>
        <span>{zh ? "只公开熊猫档案" : "published panda profiles"}</span>
      </div>

      <div className={styles.heroScrollCue} aria-hidden="true"><ArrowDown />{zh ? "沿着这只熊猫继续" : "Follow this panda"}</div>
    </section>
  );
}

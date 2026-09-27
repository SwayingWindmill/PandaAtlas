/* eslint-disable @next/next/no-img-element -- prototype review renders identity-matched research media directly. */
"use client";

import { useState } from "react";
import { ArrowUpRight } from "lucide-react";

import { BlurFade } from "@/components/registry/magicui/blur-fade";

import styles from "./directory.module.css";
import type { DirectoryPanda } from "./directory-explorer";
import { PortraitTransitionLink } from "./portrait-transition-link";

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

function PandaPhoto({
  panda,
  zh,
  priority,
}: {
  panda: DirectoryPanda;
  zh: boolean;
  priority: boolean;
}) {
  const candidates = panda.imageCandidates?.length
    ? panda.imageCandidates
    : panda.image
      ? [panda.image]
      : [];
  const [candidateIndex, setCandidateIndex] = useState(0);
  const src = candidates[candidateIndex] ?? null;

  if (src) {
    return (
      <img
        src={src}
        alt={panda.imageAlt}
        loading={priority ? "eager" : "lazy"}
        decoding="async"
        onError={() => setCandidateIndex((index) => index + 1)}
      />
    );
  }

  return (
    <span
      className={styles.noPhoto}
      aria-label={zh ? `${panda.name}暂无确认个体照片` : `No confirmed individual photograph for ${panda.name}`}
    >
      <span className={styles.noPhotoInitial} aria-hidden="true">{panda.name.slice(0, 1)}</span>
      <small>{zh ? "暂无确认照片" : "No confirmed photo"}</small>
    </span>
  );
}

function PandaPortraitCopy({ panda, zh }: { panda: DirectoryPanda; zh: boolean }) {
  return (
    <span className={styles.portraitCopy}>
      <span className={styles.identity}>
        <strong>{panda.name}</strong>
        {panda.altName ? <em>{panda.altName}</em> : null}
      </span>

      <span className={styles.metaCluster}>
        {panda.birthYear ? <span className={styles.birth}>{panda.birthYear}</span> : null}
        {panda.gender !== "unknown" ? <span>{genderLabel(panda.gender, zh)}</span> : null}
        {panda.status !== "unknown" ? <span>{statusLabel(panda.status, zh)}</span> : null}
      </span>

      {panda.location ? <span className={styles.location}>{panda.location}</span> : null}
    </span>
  );
}

interface PandaPortraitCardProps {
  locale: "zh" | "en";
  panda: DirectoryPanda;
  index?: number;
  priority?: boolean;
}

export function PandaPortraitCard({
  locale,
  panda,
  index = 0,
  priority = false,
}: PandaPortraitCardProps) {
  const zh = locale === "zh";

  return (
    <BlurFade
      className={styles.cardMotion}
      delay={Math.min(index % 8, 5) * 0.025}
      duration={0.42}
      offset={10}
    >
      <article className={styles.pandaCard}>
        <PortraitTransitionLink
          className={styles.cardLink}
          href={`/${locale}/pandas/${panda.slug}`}
        >
          <span data-testid="fan-v08-panda-row" className={styles.cardContents}>
            <span className={`${styles.thumbnail} ${panda.image ? "" : styles.thumbnailNoPhoto}`}>
              <PandaPhoto panda={panda} zh={zh} priority={priority} />
              <span className={styles.photoShade} aria-hidden="true" />
              <span className={styles.cardArrow} aria-hidden="true"><ArrowUpRight /></span>
              <PandaPortraitCopy panda={panda} zh={zh} />
            </span>
          </span>
        </PortraitTransitionLink>
      </article>
    </BlurFade>
  );
}

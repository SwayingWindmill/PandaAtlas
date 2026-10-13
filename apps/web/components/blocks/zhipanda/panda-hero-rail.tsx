"use client";

/* eslint-disable @next/next/no-img-element -- reviewed remote panda media uses source URLs directly. */

import type { Route } from "next";
import Link from "next/link";
import type { CSSProperties } from "react";
import { useState } from "react";

import styles from "./panda-hero-rail.module.css";

export interface PandaHeroRailItem {
  id: string;
  href: string;
  imageSrc: string;
  imageSources?: string[];
  imageAlt: string;
  name: string;
  meta: string;
}

function PandaRailCard({
  item,
  duplicate,
  onUnavailable,
}: {
  item: PandaHeroRailItem;
  duplicate: boolean;
  onUnavailable: (id: string) => void;
}) {
  const sources = item.imageSources?.length ? item.imageSources : [item.imageSrc];
  const [sourceIndex, setSourceIndex] = useState(0);

  function handleImageError() {
    if (sourceIndex < sources.length - 1) {
      setSourceIndex((current) => current + 1);
      return;
    }

    onUnavailable(item.id);
  }

  return (
    <Link
      href={item.href as Route}
      className={styles.card}
      data-panda-rail-card="true"
      data-panda-rail-duplicate={duplicate ? "true" : "false"}
      tabIndex={duplicate ? -1 : undefined}
    >
      <img
        src={sources[sourceIndex]}
        alt=""
        aria-hidden="true"
        draggable={false}
        onError={handleImageError}
      />
      <div className={styles.shade} aria-hidden="true" />
      <div className={styles.copy}>
        <strong>{item.name}</strong>
        <span>{item.meta}</span>
      </div>
    </Link>
  );
}

function PandaRailGroup({
  items,
  duplicate = false,
  onUnavailable,
}: {
  items: PandaHeroRailItem[];
  duplicate?: boolean;
  onUnavailable: (id: string) => void;
}) {
  return (
    <div className={styles.group} aria-hidden={duplicate ? "true" : undefined}>
      {items.map((item) => (
        <PandaRailCard
          key={`${duplicate ? "duplicate-" : ""}${item.id}`}
          item={item}
          duplicate={duplicate}
          onUnavailable={onUnavailable}
        />
      ))}
    </div>
  );
}

export function PandaHeroRail({
  items,
  label,
}: {
  items: PandaHeroRailItem[];
  label: string;
  previousLabel: string;
  nextLabel: string;
}) {
  const [unavailableIds, setUnavailableIds] = useState<Set<string>>(() => new Set());
  const visibleItems = items.filter((item) => !unavailableIds.has(item.id));

  if (!visibleItems.length) return null;

  const duration = Math.max(42, visibleItems.length * 5.5);
  const railStyle = {
    "--panda-rail-duration": `${duration}s`,
  } as CSSProperties;
  const handleUnavailable = (id: string) => {
    setUnavailableIds((current) => {
      if (current.has(id)) return current;
      const next = new Set(current);
      next.add(id);
      return next;
    });
  };

  return (
    <div className={styles.railShell} aria-label={label}>
      <div className={styles.viewport}>
        <div className={styles.track} style={railStyle} data-panda-rail-track="true">
          <PandaRailGroup items={visibleItems} onUnavailable={handleUnavailable} />
          <PandaRailGroup items={visibleItems} duplicate onUnavailable={handleUnavailable} />
        </div>
      </div>
    </div>
  );
}

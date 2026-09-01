"use client";

import type { Route } from "next";
import Link from "next/link";
import useEmblaCarousel from "embla-carousel-react";
import { ArrowUpRight } from "lucide-react";

import styles from "./prototype.module.css";

export interface PanoramaPanda {
  id: string;
  slug: string;
  name: string;
  meta: string;
  imageUrl: string;
  imageAlt: string;
}

export function PandaPanorama({ locale, pandas }: { locale: "zh" | "en"; pandas: PanoramaPanda[] }) {
  const [emblaRef] = useEmblaCarousel({ align: "start", dragFree: true, containScroll: "trimSnaps" });

  return (
    <div className={styles.pandaPanoramaViewport} ref={emblaRef} data-lenis-prevent>
      <div className={styles.pandaPanorama}>
        {pandas.map((panda, index) => (
          <Link key={panda.id} className={styles.pandaPanoramaItem} href={`/${locale}/prototype/fan-v07/panda/${panda.slug}` as Route}>
            <img src={panda.imageUrl} alt={panda.imageAlt} loading={index > 2 ? "lazy" : undefined} />
            <span className={styles.pandaPanoramaShade} />
            <span className={styles.pandaPanoramaLabel}>
              <span><strong>{panda.name}</strong><em>{panda.meta}</em></span>
              <ArrowUpRight aria-hidden="true" />
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}

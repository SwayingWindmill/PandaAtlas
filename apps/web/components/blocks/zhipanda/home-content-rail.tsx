"use client";

import useEmblaCarousel from "embla-carousel-react";
import type { ReactNode } from "react";

import styles from "./home-content-rail.module.css";

export function HomeContentRail({
  children,
  label,
  variant = "standard",
}: {
  children: ReactNode;
  label: string;
  variant?: "standard" | "wide";
}) {
  const [viewportRef] = useEmblaCarousel({
    align: "start",
    containScroll: "trimSnaps",
    dragFree: true,
    loop: false,
  });

  return (
    <div className={styles.shell} aria-label={label}>
      <div
        ref={viewportRef}
        className={styles.viewport}
        onDragStart={(event) => event.preventDefault()}
      >
        <div className={styles.track} data-variant={variant}>
          {children}
        </div>
      </div>
    </div>
  );
}

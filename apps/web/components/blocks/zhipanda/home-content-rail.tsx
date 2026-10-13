"use client";

import { Children, type ReactNode } from "react";

import { Carousel, CarouselContent, CarouselItem } from "@/components/ui/carousel";

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
  return (
    <Carousel
      className={styles.shell}
      aria-label={label}
      opts={{ align: "start", containScroll: "trimSnaps", dragFree: true, loop: false }}
    >
      <CarouselContent className={styles.track} data-variant={variant} onDragStart={(event) => event.preventDefault()}>
        {Children.map(children, (child) => (
          <CarouselItem className={styles.item}>{child}</CarouselItem>
        ))}
      </CarouselContent>
    </Carousel>
  );
}

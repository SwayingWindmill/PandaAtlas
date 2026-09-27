"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import styles from "./hero-photo-carousel.module.css";

export interface HeroPhotoCarouselItem {
  id: string;
  url: string;
  alt: string;
}

interface Props {
  items: HeroPhotoCarouselItem[];
  ariaLabel: string;
  previousLabel: string;
  nextLabel: string;
}

const COPY_COUNT = 5;
const CENTER_COPY = 2;

export function HeroPhotoCarousel({ items, ariaLabel, previousLabel, nextLabel }: Props) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const metricsRef = useRef({ step: 0, setWidth: 0 });
  const dragRef = useRef({ pointerId: -1, startX: 0, startScrollLeft: 0, active: false });
  const recenteringRef = useRef(false);
  const [dragging, setDragging] = useState(false);

  const measureAndCenter = useCallback(() => {
    const viewport = viewportRef.current;
    const track = trackRef.current;
    if (!viewport || !track || items.length === 0) return;

    const firstSlide = track.querySelector<HTMLElement>("[data-hero-carousel-slide='true']");
    if (!firstSlide) return;

    const trackStyle = getComputedStyle(track);
    const gap = Number.parseFloat(trackStyle.columnGap || trackStyle.gap || "0") || 0;
    const step = firstSlide.getBoundingClientRect().width + gap;
    const setWidth = step * items.length;
    metricsRef.current = { step, setWidth };

    recenteringRef.current = true;
    viewport.scrollLeft = setWidth * CENTER_COPY + step * 0.48;
    requestAnimationFrame(() => {
      recenteringRef.current = false;
    });
  }, [items.length]);

  useEffect(() => {
    const frame = requestAnimationFrame(measureAndCenter);
    const viewport = viewportRef.current;
    if (!viewport) return () => cancelAnimationFrame(frame);

    const observer = new ResizeObserver(() => measureAndCenter());
    observer.observe(viewport);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [measureAndCenter]);

  const recenterIfNeeded = () => {
    const viewport = viewportRef.current;
    const { setWidth } = metricsRef.current;
    if (!viewport || !setWidth || recenteringRef.current) return;

    const min = setWidth * 1.2;
    const max = setWidth * 3.8;
    if (viewport.scrollLeft < min) {
      recenteringRef.current = true;
      viewport.scrollLeft += setWidth * 2;
      requestAnimationFrame(() => {
        recenteringRef.current = false;
      });
    } else if (viewport.scrollLeft > max) {
      recenteringRef.current = true;
      viewport.scrollLeft -= setWidth * 2;
      requestAnimationFrame(() => {
        recenteringRef.current = false;
      });
    }
  };

  const scrollOne = (direction: -1 | 1) => {
    const viewport = viewportRef.current;
    const { step } = metricsRef.current;
    if (!viewport || !step) return;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    viewport.scrollBy({ left: direction * step, behavior: reduceMotion ? "auto" : "smooth" });
  };

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    const viewport = viewportRef.current;
    if (!viewport) return;

    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startScrollLeft: viewport.scrollLeft,
      active: true,
    };
    viewport.setPointerCapture(event.pointerId);
    setDragging(true);
  };

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const viewport = viewportRef.current;
    const drag = dragRef.current;
    if (!viewport || !drag.active || drag.pointerId !== event.pointerId) return;

    const delta = event.clientX - drag.startX;
    viewport.scrollLeft = drag.startScrollLeft - delta;
    if (Math.abs(delta) > 3) event.preventDefault();
  };

  const endDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    const viewport = viewportRef.current;
    const drag = dragRef.current;
    if (!viewport || !drag.active || drag.pointerId !== event.pointerId) return;

    dragRef.current.active = false;
    if (viewport.hasPointerCapture(event.pointerId)) viewport.releasePointerCapture(event.pointerId);
    setDragging(false);
    recenterIfNeeded();
  };

  if (!items.length) return null;

  return (
    <div className={styles.carousel} aria-label={ariaLabel}>
      <div
        ref={viewportRef}
        className={`${styles.viewport} ${dragging ? styles.viewportDragging : ""}`}
        onScroll={recenterIfNeeded}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        <div ref={trackRef} className={styles.track}>
          {Array.from({ length: COPY_COUNT }, (_, copyIndex) => (
            <div key={`copy:${copyIndex}`} className={styles.set} aria-hidden={copyIndex === CENTER_COPY ? undefined : true}>
              {items.map((item) => (
                <figure key={`${copyIndex}:${item.id}`} className={styles.slide} data-hero-carousel-slide="true">
                  <img src={item.url} alt={copyIndex === CENTER_COPY ? item.alt : ""} draggable={false} />
                </figure>
              ))}
            </div>
          ))}
        </div>
      </div>

      {items.length > 1 ? (
        <>
          <button className={`${styles.button} ${styles.previous}`} type="button" aria-label={previousLabel} onClick={() => scrollOne(-1)}>
            <ChevronLeft aria-hidden="true" />
          </button>
          <button className={`${styles.button} ${styles.next}`} type="button" aria-label={nextLabel} onClick={() => scrollOne(1)}>
            <ChevronRight aria-hidden="true" />
          </button>
        </>
      ) : null}
    </div>
  );
}

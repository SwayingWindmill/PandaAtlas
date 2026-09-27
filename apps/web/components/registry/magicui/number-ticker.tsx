"use client";

import { useEffect, useRef, useState } from "react";
import { animate, useInView, useReducedMotion } from "motion/react";

import { cn } from "@/lib/utils";

interface NumberTickerProps {
  value: number;
  startValue?: number;
  direction?: "up" | "down";
  delay?: number;
  decimalPlaces?: number;
  locale?: string;
  className?: string;
}

export function NumberTicker({
  value,
  startValue = 0,
  direction = "up",
  delay = 0,
  decimalPlaces = 0,
  locale,
  className,
}: NumberTickerProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-24px" });
  const reduceMotion = useReducedMotion();
  const firstValue = direction === "down" ? value : startValue;
  const lastValue = useRef(firstValue);
  const [display, setDisplay] = useState(reduceMotion ? value : firstValue);

  useEffect(() => {
    if (!inView || reduceMotion) return;

    const from = lastValue.current;
    const controls = animate(from, value, {
      delay,
      duration: 0.72,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (latest) => {
        lastValue.current = latest;
        setDisplay(latest);
      },
      onComplete: () => {
        lastValue.current = value;
        setDisplay(value);
      },
    });

    return () => controls.stop();
  }, [delay, inView, reduceMotion, value]);

  const currentValue = reduceMotion ? value : display;
  const formatted = new Intl.NumberFormat(locale, {
    minimumFractionDigits: decimalPlaces,
    maximumFractionDigits: decimalPlaces,
  }).format(currentValue);

  return (
    <span ref={ref} className={cn("tabular-nums", className)}>
      {formatted}
    </span>
  );
}

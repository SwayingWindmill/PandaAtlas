"use client";

import { useCallback, useEffect, useRef } from "react";
import { animate, useInView, useReducedMotion } from "motion/react";

interface CountUpProps {
  to: number;
  from?: number;
  duration?: number;
  delay?: number;
  className?: string;
  separator?: string;
}

export function CountUp({
  to,
  from = 0,
  duration = 0.82,
  delay = 0,
  className,
  separator = "",
}: CountUpProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.2 });
  const reduceMotion = useReducedMotion();

  const format = useCallback((value: number) => {
    const rounded = Math.round(value);
    if (!separator) return String(rounded);
    return new Intl.NumberFormat("en-US").format(rounded).replace(/,/g, separator);
  }, [separator]);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    if (reduceMotion) {
      element.textContent = format(to);
      return;
    }

    element.textContent = format(from);
    if (!inView) return;

    const controls = animate(from, to, {
      duration,
      delay,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (latest) => {
        if (ref.current) ref.current.textContent = format(latest);
      },
    });

    return () => controls.stop();
  }, [delay, duration, format, from, inView, reduceMotion, to]);

  return <span ref={ref} className={className}>{format(reduceMotion ? to : from)}</span>;
}

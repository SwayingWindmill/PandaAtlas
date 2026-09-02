"use client";

import type { CSSProperties, PointerEvent, ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { animate, motion, useReducedMotion } from "motion/react";

interface AnimatedContentProps {
  children: ReactNode;
  className?: string;
  delay?: number;
  distance?: number;
}

export function AnimatedContent({ children, className, delay = 0, distance = 18 }: AnimatedContentProps) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      className={className}
      initial={reduceMotion ? false : { opacity: 0.72, y: distance, filter: "blur(6px)" }}
      whileInView={reduceMotion ? undefined : { opacity: 1, y: 0, filter: "blur(0px)" }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.62, delay, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
  );
}

export function CountUpNumber({ value }: { value: number }) {
  const reduceMotion = useReducedMotion();
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    if (reduceMotion) return;

    const controls = animate(0, value, {
      duration: 0.82,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (latest) => setDisplay(Math.round(latest)),
    });
    return () => controls.stop();
  }, [reduceMotion, value]);

  return <>{(reduceMotion ? value : display).toLocaleString()}</>;
}

interface SpotlightCardProps {
  children: ReactNode;
  className: string;
  disabled?: boolean;
}

export function SpotlightCard({ children, className, disabled = false }: SpotlightCardProps) {
  const reduceMotion = useReducedMotion();
  const ref = useRef<HTMLElement>(null);

  const handlePointerMove = (event: PointerEvent<HTMLElement>) => {
    if (disabled || reduceMotion || !ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    ref.current.style.setProperty("--spotlight-x", `${event.clientX - rect.left}px`);
    ref.current.style.setProperty("--spotlight-y", `${event.clientY - rect.top}px`);
  };

  return (
    <motion.article
      ref={ref}
      className={className}
      onPointerMove={handlePointerMove}
      whileHover={disabled || reduceMotion ? undefined : { y: -2 }}
      transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
      style={{ "--spotlight-x": "50%", "--spotlight-y": "28%" } as CSSProperties}
    >
      {children}
    </motion.article>
  );
}

export function ActivePill({ layoutId = "directory-filter-pill" }: { layoutId?: string }) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.span
      aria-hidden="true"
      layoutId={reduceMotion ? undefined : layoutId}
      transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
    />
  );
}

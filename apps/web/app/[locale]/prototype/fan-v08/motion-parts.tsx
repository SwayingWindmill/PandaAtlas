"use client";

import type { ReactNode } from "react";
import { motion, useReducedMotion } from "motion/react";

interface MotionImageProps {
  src: string;
  alt: string;
  className: string;
}

export function HeroMotionImage({ src, alt, className }: MotionImageProps) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.img
      className={className}
      src={src}
      alt={alt}
      initial={reduceMotion ? false : { scale: 1.035 }}
      animate={reduceMotion ? undefined : { scale: 1 }}
      transition={{ duration: 1.25, ease: [0.16, 1, 0.3, 1] }}
    />
  );
}

export function HeroMotionCopy({ className, children }: { className: string; children: ReactNode }) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      className={className}
      initial={reduceMotion ? false : { y: 12, opacity: 0.88 }}
      animate={reduceMotion ? undefined : { y: 0, opacity: 1 }}
      transition={{ duration: 0.72, delay: 0.12, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
  );
}

export function FamilyMotionImage({ src, alt, className }: MotionImageProps) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.img
      className={className}
      src={src}
      alt={alt}
      initial={reduceMotion ? false : { scale: 1.035 }}
      whileInView={reduceMotion ? undefined : { scale: 1 }}
      viewport={{ once: true, amount: 0.35 }}
      transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1] }}
    />
  );
}

export function JourneyMotionPath({ className }: { className: string }) {
  const reduceMotion = useReducedMotion();
  const d = "M30 122 C210 28, 466 28, 690 108";

  return (
    <svg className={className} viewBox="0 0 720 180" aria-hidden="true">
      <path d={d} data-route-base="true" />
      <motion.path
        d={d}
        data-route-motion="true"
        initial={reduceMotion ? false : { pathLength: 0, opacity: 0.2 }}
        whileInView={reduceMotion ? undefined : { pathLength: 1, opacity: 1 }}
        viewport={{ once: true, amount: 0.55 }}
        transition={{ duration: 0.95, ease: [0.16, 1, 0.3, 1] }}
      />
    </svg>
  );
}

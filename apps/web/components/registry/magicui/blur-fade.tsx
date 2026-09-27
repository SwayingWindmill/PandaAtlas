"use client";

import type { ReactNode } from "react";
import { motion, useReducedMotion } from "motion/react";

import { cn } from "@/lib/utils";

type Direction = "up" | "down" | "left" | "right";

interface BlurFadeProps {
  children: ReactNode;
  className?: string;
  delay?: number;
  duration?: number;
  offset?: number;
  blur?: string;
  direction?: Direction;
  inView?: boolean;
  inViewMargin?: string;
}

function offsetFor(direction: Direction, offset: number) {
  if (direction === "up") return { y: offset };
  if (direction === "down") return { y: -offset };
  if (direction === "left") return { x: offset };
  return { x: -offset };
}

export function BlurFade({
  children,
  className,
  delay = 0,
  duration = 0.42,
  offset = 8,
  blur = "7px",
  direction = "up",
  inView = true,
  inViewMargin = "-40px",
}: BlurFadeProps) {
  const reduceMotion = useReducedMotion();
  const hidden = reduceMotion
    ? { opacity: 1, filter: "blur(0px)", x: 0, y: 0 }
    : { opacity: 0, filter: `blur(${blur})`, ...offsetFor(direction, offset) };
  const visible = { opacity: 1, filter: "blur(0px)", x: 0, y: 0 };

  return (
    <motion.div
      className={cn(className)}
      initial={hidden}
      animate={inView ? undefined : visible}
      whileInView={inView ? visible : undefined}
      viewport={inView ? { once: true, margin: inViewMargin as never } : undefined}
      transition={reduceMotion ? { duration: 0 } : { delay, duration, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
  );
}

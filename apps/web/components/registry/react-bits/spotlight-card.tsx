"use client";

import type { CSSProperties, HTMLAttributes, PointerEvent, ReactNode } from "react";
import { useRef } from "react";
import { useReducedMotion } from "motion/react";

interface SpotlightCardProps extends HTMLAttributes<HTMLElement> {
  children: ReactNode;
  as?: "article" | "div";
  spotlightColor?: string;
}

export function SpotlightCard({
  children,
  as: Comp = "article",
  className,
  spotlightColor = "rgba(255, 255, 255, 0.2)",
  onPointerMove,
  onPointerLeave,
  style,
  ...props
}: SpotlightCardProps) {
  const ref = useRef<HTMLElement>(null);
  const reduceMotion = useReducedMotion();

  const handlePointerMove = (event: PointerEvent<HTMLElement>) => {
    onPointerMove?.(event);
    if (reduceMotion || !ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    ref.current.style.setProperty("--spotlight-x", `${event.clientX - rect.left}px`);
    ref.current.style.setProperty("--spotlight-y", `${event.clientY - rect.top}px`);
    ref.current.style.setProperty("--spotlight-opacity", "1");
  };

  const handlePointerLeave = (event: PointerEvent<HTMLElement>) => {
    onPointerLeave?.(event);
    if (!ref.current) return;
    ref.current.style.setProperty("--spotlight-opacity", "0");
  };

  return (
    <Comp
      ref={ref as never}
      className={className}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      style={{
        "--spotlight-x": "50%",
        "--spotlight-y": "28%",
        "--spotlight-opacity": "0",
        "--spotlight-color": spotlightColor,
        ...style,
      } as CSSProperties}
      {...props}
    >
      {children}
    </Comp>
  );
}

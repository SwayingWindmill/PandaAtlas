"use client";

import type { HTMLAttributes, ReactNode } from "react";
import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

interface AnimatedContentProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  distance?: number;
  direction?: "vertical" | "horizontal";
  reverse?: boolean;
  duration?: number;
  delay?: number;
  initialOpacity?: number;
  threshold?: number;
}

export function AnimatedContent({
  children,
  className,
  distance = 24,
  direction = "vertical",
  reverse = false,
  duration = 0.72,
  delay = 0,
  initialOpacity = 0.72,
  threshold = 0.2,
  ...props
}: AnimatedContentProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion) {
      gsap.set(element, { clearProps: "all", autoAlpha: 1 });
      return;
    }

    const axis = direction === "horizontal" ? "x" : "y";
    const offset = (reverse ? -1 : 1) * distance;
    const context = gsap.context(() => {
      gsap.fromTo(
        element,
        {
          [axis]: offset,
          autoAlpha: initialOpacity,
          filter: "blur(6px)",
        },
        {
          [axis]: 0,
          autoAlpha: 1,
          filter: "blur(0px)",
          duration,
          delay,
          ease: "power3.out",
          scrollTrigger: {
            trigger: element,
            start: `top ${Math.round((1 - threshold) * 100)}%`,
            once: true,
          },
        },
      );
    }, element);

    return () => context.revert();
  }, [delay, direction, distance, duration, initialOpacity, reverse, threshold]);

  return (
    <div ref={ref} className={className} {...props}>
      {children}
    </div>
  );
}

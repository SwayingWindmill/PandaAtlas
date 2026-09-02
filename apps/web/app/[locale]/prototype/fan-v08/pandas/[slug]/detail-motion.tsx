"use client";

import type { ReactNode } from "react";
import { useEffect } from "react";
import { gsap } from "gsap";
import { motion, useReducedMotion } from "motion/react";

export function DetailEntrance() {
  useEffect(() => {
    const overlay = document.querySelector<HTMLElement>("[data-panda-transition-overlay='true']");
    const veil = document.querySelector<HTMLElement>("[data-panda-transition-veil='true']");
    if (!overlay && !veil) {
      delete document.documentElement.dataset.pandaTransitioning;
      return;
    }

    const transitionEndAt = Number(overlay?.dataset.pandaTransitionEndAt ?? performance.now());
    const remaining = Math.max(0, transitionEndAt - performance.now()) / 1000;
    const takeover = gsap.delayedCall(remaining + 0.03, () => {
      const timeline = gsap.timeline({
        defaults: { overwrite: "auto" },
        onComplete: () => {
          overlay?.remove();
          veil?.remove();
          delete document.documentElement.dataset.pandaTransitioning;
        },
      });

      if (overlay) {
        timeline.to(overlay, { opacity: 0, duration: 0.2, ease: "power2.out" }, 0.03);
      }
      if (veil) {
        timeline.to(veil, { opacity: 0, duration: 0.46, ease: "power2.out" }, 0);
      }
    });

    return () => {
      takeover.kill();
    };
  }, []);

  return null;
}

export function Reveal({ children, className, delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  const reduceMotion = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={reduceMotion ? false : { opacity: 0, y: 26 }}
      animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
      transition={{ duration: 0.86, delay: delay + 0.28, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}

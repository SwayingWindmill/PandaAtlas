import type { CSSProperties } from "react";

import { cn } from "@/lib/utils";

interface ProgressiveBlurProps {
  className?: string;
  direction?: "top" | "bottom";
  strength?: number;
  layers?: number;
}

export function ProgressiveBlur({
  className,
  direction = "bottom",
  strength = 16,
  layers = 7,
}: ProgressiveBlurProps) {
  const count = Math.max(2, layers);

  return (
    <div aria-hidden="true" className={cn("pointer-events-none absolute inset-x-0 overflow-hidden", className)}>
      {Array.from({ length: count }, (_, index) => {
        const progress = index / (count - 1);
        const start = Math.max(0, progress * 100 - 20);
        const end = Math.min(100, progress * 100 + 32);
        const gradient = direction === "bottom"
          ? `linear-gradient(to bottom, transparent ${start}%, black ${end}%)`
          : `linear-gradient(to top, transparent ${start}%, black ${end}%)`;

        return (
          <span
            key={index}
            className="absolute inset-0"
            style={{
              backdropFilter: `blur(${Math.max(0.5, progress * strength)}px)`,
              WebkitBackdropFilter: `blur(${Math.max(0.5, progress * strength)}px)`,
              maskImage: gradient,
              WebkitMaskImage: gradient,
            } as CSSProperties}
          />
        );
      })}
    </div>
  );
}

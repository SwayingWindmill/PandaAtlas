"use client";

import React, {
  type HTMLAttributes,
  useEffect,
  useRef,
  useState,
} from "react";

import { cn } from "@/lib/utils";

export interface GalleryItem {
  common: string;
  binomial: string;
  href?: string;
  photo: {
    url: string;
    text: string;
    pos?: string;
    by: string;
  };
}

interface CircularGalleryProps extends HTMLAttributes<HTMLDivElement> {
  items: GalleryItem[];
  /** Controls how far the items are from the center. */
  radius?: number;
  /** Controls the speed of auto-rotation when not scrolling. */
  autoRotateSpeed?: number;
  creditLabel?: string;
  regionLabel?: string;
}

function GalleryCard({
  item,
  index,
  creditLabel,
}: {
  item: GalleryItem;
  index: number;
  creditLabel: string;
}) {
  const content = (
    <div className="group relative h-full w-full overflow-hidden rounded-[1.75rem] border border-white/30 bg-black/20 shadow-2xl backdrop-blur-lg transition-transform duration-300 hover:-translate-y-1 focus-within:-translate-y-1">
      {/* The public media release already provides bounded image URLs and reviewed alternative text. */}
      <img
        src={item.photo.url}
        alt={item.photo.text}
        className="absolute inset-0 h-full w-full object-cover"
        style={{ objectPosition: item.photo.pos || "center" }}
        loading={index < 3 ? "eager" : "lazy"}
        decoding="async"
      />
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black via-black/70 to-transparent p-5 pt-20 text-white">
        <h2 className="text-2xl font-bold tracking-[-0.035em]">{item.common}</h2>
        <p className="mt-1 text-sm font-medium text-white/80">{item.binomial}</p>
        <p className="mt-3 text-xs text-white/65">{creditLabel}: {item.photo.by}</p>
      </div>
    </div>
  );

  if (!item.href) return content;

  return (
    <a
      href={item.href}
      className="block h-full w-full rounded-[1.75rem] outline-none focus-visible:ring-4 focus-visible:ring-white/80 focus-visible:ring-offset-4 focus-visible:ring-offset-black"
      aria-label={`${item.common} · ${item.binomial}`}
    >
      {content}
    </a>
  );
}

const CircularGallery = React.forwardRef<HTMLDivElement, CircularGalleryProps>(
  (
    {
      items,
      className,
      radius = 520,
      autoRotateSpeed = 0.015,
      creditLabel = "Photo",
      regionLabel = "Circular panda gallery",
      ...props
    },
    ref,
  ) => {
    const [rotation, setRotation] = useState(0);
    const [isScrolling, setIsScrolling] = useState(false);
    const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
    const scrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const animationFrameRef = useRef<number | null>(null);

    useEffect(() => {
      const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
      const updatePreference = () => setPrefersReducedMotion(mediaQuery.matches);
      updatePreference();
      mediaQuery.addEventListener("change", updatePreference);
      return () => mediaQuery.removeEventListener("change", updatePreference);
    }, []);

    useEffect(() => {
      if (prefersReducedMotion) return;

      const handleScroll = () => {
        setIsScrolling(true);
        if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);

        const scrollableHeight = document.documentElement.scrollHeight - window.innerHeight;
        const scrollProgress = scrollableHeight > 0 ? window.scrollY / scrollableHeight : 0;
        setRotation(scrollProgress * 360);

        scrollTimeoutRef.current = setTimeout(() => setIsScrolling(false), 150);
      };

      handleScroll();
      window.addEventListener("scroll", handleScroll, { passive: true });
      return () => {
        window.removeEventListener("scroll", handleScroll);
        if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
      };
    }, [prefersReducedMotion]);

    useEffect(() => {
      if (prefersReducedMotion || autoRotateSpeed === 0) return;

      const autoRotate = () => {
        if (!isScrolling) setRotation((previous) => previous + autoRotateSpeed);
        animationFrameRef.current = requestAnimationFrame(autoRotate);
      };

      animationFrameRef.current = requestAnimationFrame(autoRotate);
      return () => {
        if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      };
    }, [autoRotateSpeed, isScrolling, prefersReducedMotion]);

    if (!items.length) return null;

    if (prefersReducedMotion) {
      return (
        <div
          ref={ref}
          role="region"
          aria-label={regionLabel}
          className={cn("flex h-full w-full snap-x gap-5 overflow-x-auto px-6 py-24", className)}
          {...props}
        >
          {items.map((item, index) => (
            <div key={`${item.photo.url}-${index}`} className="h-[400px] w-[min(300px,78vw)] shrink-0 snap-center">
              <GalleryCard item={item} index={index} creditLabel={creditLabel} />
            </div>
          ))}
        </div>
      );
    }

    const anglePerItem = 360 / items.length;
    const rotateBy = anglePerItem;

    return (
      <div
        ref={ref}
        role="region"
        aria-label={regionLabel}
        tabIndex={0}
        onKeyDown={(event) => {
          if (event.key === "ArrowLeft") {
            event.preventDefault();
            setRotation((previous) => previous - rotateBy);
          }
          if (event.key === "ArrowRight") {
            event.preventDefault();
            setRotation((previous) => previous + rotateBy);
          }
        }}
        className={cn(
          "relative flex h-full w-full items-center justify-center outline-none focus-visible:ring-4 focus-visible:ring-black/20",
          className,
        )}
        style={{ perspective: "2000px" }}
        {...props}
      >
        <div
          className="relative h-full w-full"
          style={{
            transform: `rotateY(${rotation}deg)`,
            transformStyle: "preserve-3d",
          }}
        >
          {items.map((item, index) => {
            const itemAngle = index * anglePerItem;
            const totalRotation = rotation % 360;
            const relativeAngle = (itemAngle + totalRotation + 360) % 360;
            const normalizedAngle = Math.abs(relativeAngle > 180 ? 360 - relativeAngle : relativeAngle);
            const opacity = Math.max(0.24, 1 - normalizedAngle / 180);

            return (
              <div
                key={`${item.photo.url}-${index}`}
                role="group"
                aria-label={item.common}
                className="absolute left-1/2 top-1/2 h-[min(400px,54vh)] w-[min(300px,72vw)]"
                style={{
                  transform: `translate(-50%, -50%) rotateY(${itemAngle}deg) translateZ(${radius}px)`,
                  opacity,
                  transition: "opacity 300ms linear",
                }}
              >
                <GalleryCard item={item} index={index} creditLabel={creditLabel} />
              </div>
            );
          })}
        </div>
      </div>
    );
  },
);

CircularGallery.displayName = "CircularGallery";

export { CircularGallery };

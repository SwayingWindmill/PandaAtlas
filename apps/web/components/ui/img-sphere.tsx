"use client";

import {
  type CSSProperties,
  type HTMLAttributes,
  type PointerEvent as ReactPointerEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { cn } from "@/lib/utils";

export interface ImageData {
  id: string;
  src: string;
  alt: string;
  title?: string;
  description?: string;
  href?: string;
}

interface SphereImageGridProps extends HTMLAttributes<HTMLDivElement> {
  images: ImageData[];
  sphereRadius?: number;
  dragSensitivity?: number;
  momentumDecay?: number;
  maxRotationSpeed?: number;
  baseImageScale?: number;
  hoverScale?: number;
  perspective?: number;
  autoRotate?: boolean;
  autoRotateSpeed?: number;
  regionLabel?: string;
}

interface Point3D {
  x: number;
  y: number;
  z: number;
}

interface Rotation {
  x: number;
  y: number;
}

const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function fibonacciSphere(count: number, radius: number): Point3D[] {
  if (count <= 1) return [{ x: 0, y: 0, z: radius }];

  return Array.from({ length: count }, (_, index) => {
    const y = 1 - (index / (count - 1)) * 2;
    const horizontalRadius = Math.sqrt(Math.max(0, 1 - y * y));
    const theta = GOLDEN_ANGLE * index;

    return {
      x: Math.cos(theta) * horizontalRadius * radius,
      y: y * radius,
      z: Math.sin(theta) * horizontalRadius * radius,
    };
  });
}

function rotatePoint(point: Point3D, rotation: Rotation): Point3D {
  const xRadians = (rotation.x * Math.PI) / 180;
  const yRadians = (rotation.y * Math.PI) / 180;
  const cosX = Math.cos(xRadians);
  const sinX = Math.sin(xRadians);
  const cosY = Math.cos(yRadians);
  const sinY = Math.sin(yRadians);

  const yAfterX = point.y * cosX - point.z * sinX;
  const zAfterX = point.y * sinX + point.z * cosX;

  return {
    x: point.x * cosY + zAfterX * sinY,
    y: yAfterX,
    z: -point.x * sinY + zAfterX * cosY,
  };
}

export default function SphereImageGrid({
  images,
  sphereRadius = 205,
  dragSensitivity = 0.8,
  momentumDecay = 0.94,
  maxRotationSpeed = 5,
  baseImageScale = 0.145,
  hoverScale = 1.22,
  perspective = 900,
  autoRotate = true,
  autoRotateSpeed = 0.12,
  regionLabel = "Interactive image sphere",
  className,
  ...props
}: SphereImageGridProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const velocityRef = useRef<Rotation>({ x: 0, y: 0 });
  const draggingRef = useRef(false);
  const movedRef = useRef(false);
  const pointerRef = useRef({ x: 0, y: 0 });
  const frameRef = useRef<number | null>(null);
  const [rotation, setRotation] = useState<Rotation>({ x: -7, y: 18 });
  const [containerSize, setContainerSize] = useState(560);
  const [reducedMotion, setReducedMotion] = useState(false);

  const effectiveRadius = Math.min(sphereRadius, containerSize * 0.39);
  const points = useMemo(
    () => fibonacciSphere(images.length, effectiveRadius),
    [effectiveRadius, images.length],
  );

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;

    const updateSize = () => {
      const rect = node.getBoundingClientRect();
      setContainerSize(Math.max(280, Math.min(rect.width, rect.height || rect.width)));
    };

    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (reducedMotion) return;

    const animate = () => {
      if (!draggingRef.current) {
        const velocity = velocityRef.current;
        const speed = Math.abs(velocity.x) + Math.abs(velocity.y);

        if (speed > 0.01) {
          setRotation((current) => ({
            x: current.x + velocity.x,
            y: current.y + velocity.y,
          }));
          velocityRef.current.x *= momentumDecay;
          velocityRef.current.y *= momentumDecay;
        } else if (autoRotate) {
          setRotation((current) => ({ ...current, y: current.y + autoRotateSpeed }));
        }
      }

      frameRef.current = requestAnimationFrame(animate);
    };

    frameRef.current = requestAnimationFrame(animate);
    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    };
  }, [autoRotate, autoRotateSpeed, momentumDecay, reducedMotion]);

  const startDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    draggingRef.current = true;
    movedRef.current = false;
    pointerRef.current = { x: event.clientX, y: event.clientY };
    velocityRef.current = { x: 0, y: 0 };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const moveDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current) return;

    const deltaX = event.clientX - pointerRef.current.x;
    const deltaY = event.clientY - pointerRef.current.y;
    pointerRef.current = { x: event.clientX, y: event.clientY };

    if (Math.abs(deltaX) + Math.abs(deltaY) > 2) movedRef.current = true;

    const nextY = clamp(deltaX * dragSensitivity * 0.22, -maxRotationSpeed, maxRotationSpeed);
    const nextX = clamp(-deltaY * dragSensitivity * 0.22, -maxRotationSpeed, maxRotationSpeed);

    setRotation((current) => ({ x: current.x + nextX, y: current.y + nextY }));
    velocityRef.current = { x: nextX, y: nextY };
  };

  const endDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    draggingRef.current = false;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  if (!images.length) return null;

  const imageSize = clamp(containerSize * baseImageScale, 48, 84);

  return (
    <div
      ref={containerRef}
      role="region"
      aria-label={regionLabel}
      tabIndex={0}
      onPointerDown={startDrag}
      onPointerMove={moveDrag}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onKeyDown={(event) => {
        if (event.key === "ArrowLeft") {
          event.preventDefault();
          setRotation((current) => ({ ...current, y: current.y - 8 }));
        }
        if (event.key === "ArrowRight") {
          event.preventDefault();
          setRotation((current) => ({ ...current, y: current.y + 8 }));
        }
        if (event.key === "ArrowUp") {
          event.preventDefault();
          setRotation((current) => ({ ...current, x: current.x - 8 }));
        }
        if (event.key === "ArrowDown") {
          event.preventDefault();
          setRotation((current) => ({ ...current, x: current.x + 8 }));
        }
      }}
      className={cn(
        "relative isolate h-full w-full cursor-grab touch-none select-none overflow-hidden rounded-[2rem] outline-none active:cursor-grabbing focus-visible:ring-4 focus-visible:ring-[var(--accent)]/35",
        className,
      )}
      style={{ perspective: `${perspective}px` }}
      {...props}
    >
      <div className="pointer-events-none absolute inset-[12%] rounded-full bg-[radial-gradient(circle,rgba(255,255,255,0.28),rgba(117,177,132,0.11)_42%,transparent_70%)] blur-2xl" />
      {points.map((point, index) => {
        const image = images[index];
        const rotated = rotatePoint(point, rotation);
        const depthScale = perspective / Math.max(120, perspective - rotated.z);
        const scale = clamp(depthScale, 0.48, 1.45);
        const opacity = clamp(0.18 + ((rotated.z + effectiveRadius) / (effectiveRadius * 2)) * 0.9, 0.16, 1);
        const blur = rotated.z < -effectiveRadius * 0.32 ? 1.4 : 0;
        const transform = `translate3d(calc(-50% + ${rotated.x * depthScale}px), calc(-50% + ${rotated.y * depthScale}px), 0) scale(${scale})`;
        const itemStyle = {
          width: imageSize,
          height: imageSize,
          opacity,
          filter: blur ? `blur(${blur}px)` : undefined,
          transform,
          zIndex: Math.round(rotated.z + effectiveRadius + 10),
          "--sphere-hover-scale": hoverScale,
        } as CSSProperties & { "--sphere-hover-scale": number };

        return (
          <a
            key={image.id}
            href={image.href}
            aria-label={image.title ?? image.alt}
            title={image.title}
            onClick={(event) => {
              if (movedRef.current) event.preventDefault();
            }}
            className="group absolute left-1/2 top-1/2 block overflow-hidden rounded-[1rem] border border-white/55 bg-white/20 shadow-[0_18px_45px_rgba(14,38,24,0.2)] outline-none transition-[box-shadow] duration-300 hover:z-[999] hover:shadow-[0_24px_60px_rgba(14,38,24,0.34)] focus-visible:z-[999] focus-visible:ring-4 focus-visible:ring-white"
            style={itemStyle}
          >
            {/* Public release media URLs are already reviewed and bounded by the application. */}
            <img
              src={image.src}
              alt={image.alt}
              draggable={false}
              loading={index < 8 ? "eager" : "lazy"}
              decoding="async"
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[var(--sphere-hover-scale)] group-focus-visible:scale-[var(--sphere-hover-scale)]"
            />
            <span className="pointer-events-none absolute inset-x-0 bottom-0 translate-y-full bg-gradient-to-t from-black/80 to-transparent px-2 pb-1.5 pt-5 text-[9px] font-bold leading-tight text-white transition-transform duration-300 group-hover:translate-y-0 group-focus-visible:translate-y-0">
              {image.title}
            </span>
          </a>
        );
      })}
    </div>
  );
}

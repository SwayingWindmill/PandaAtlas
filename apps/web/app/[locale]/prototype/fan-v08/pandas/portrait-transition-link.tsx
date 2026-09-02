"use client";

import type { Route } from "next";
import type { MouseEvent, ReactNode } from "react";
import { useRouter } from "next/navigation";
import { gsap } from "gsap";

interface PortraitTransitionLinkProps {
  href: string;
  className?: string;
  children: ReactNode;
}

const TRANSITION_DURATION = 0.92;
const ROUTE_AT = 0.44;

function shouldHandle(event: MouseEvent<HTMLAnchorElement>): boolean {
  return event.button === 0
    && !event.defaultPrevented
    && !event.metaKey
    && !event.ctrlKey
    && !event.shiftKey
    && !event.altKey;
}

function heroGeometry() {
  const desktop = window.innerWidth >= 768;
  const heroTop = desktop ? 72 : 68;
  return {
    heroTop,
    width: desktop ? window.innerWidth * 0.56 : window.innerWidth,
    height: desktop
      ? window.innerHeight - heroTop
      : Math.min(window.innerHeight * 0.58, 520),
  };
}

function removeStaleTransitionNodes() {
  document.querySelectorAll("[data-panda-transition-overlay='true'], [data-panda-transition-veil='true']")
    .forEach((node) => node.remove());
}

export function PortraitTransitionLink({ href, className, children }: PortraitTransitionLinkProps) {
  const router = useRouter();

  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (!shouldHandle(event) || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const image = event.currentTarget.querySelector("img");
    if (!image) return;

    event.preventDefault();
    removeStaleTransitionNodes();

    const portraitFrame = image.parentElement ?? image;
    const sourceRect = portraitFrame.getBoundingClientRect();
    const target = heroGeometry();
    const sourceRadius = getComputedStyle(portraitFrame).borderRadius || "0.7rem";

    const veil = document.createElement("div");
    veil.dataset.pandaTransitionVeil = "true";
    Object.assign(veil.style, {
      position: "fixed",
      inset: "0",
      zIndex: "998",
      background: "#f7f6f1",
      opacity: "0",
      pointerEvents: "none",
      willChange: "opacity",
    });

    const overlay = document.createElement("div");
    overlay.dataset.pandaTransitionOverlay = "true";
    Object.assign(overlay.style, {
      position: "fixed",
      left: `${sourceRect.left}px`,
      top: `${sourceRect.top}px`,
      width: `${sourceRect.width}px`,
      height: `${sourceRect.height}px`,
      zIndex: "999",
      overflow: "hidden",
      borderRadius: sourceRadius,
      pointerEvents: "none",
      willChange: "left, top, width, height, border-radius, opacity",
      backfaceVisibility: "hidden",
      contain: "layout paint style",
    });

    const overlayImage = image.cloneNode(true) as HTMLImageElement;
    Object.assign(overlayImage.style, {
      position: "absolute",
      inset: "0",
      width: "100%",
      height: "100%",
      display: "block",
      objectFit: "cover",
      objectPosition: getComputedStyle(image).objectPosition || "50% 50%",
      transform: "none",
      borderRadius: "0",
      willChange: "auto",
      backfaceVisibility: "hidden",
    });
    overlay.append(overlayImage);

    document.body.append(veil, overlay);
    document.documentElement.dataset.pandaTransitioning = "true";
    gsap.set(image, { opacity: 0 });

    const timeline = gsap.timeline({ defaults: { overwrite: "auto" } });
    timeline
      .to(veil, { opacity: 1, duration: 0.42, ease: "power2.out" }, 0.04)
      .to(overlay, {
        left: 0,
        top: target.heroTop,
        width: target.width,
        height: target.height,
        borderRadius: 0,
        duration: TRANSITION_DURATION,
        ease: "power3.inOut",
      }, 0)
      .call(() => router.push(href as Route), [], ROUTE_AT);

    overlay.dataset.pandaTransitionEndAt = String(performance.now() + TRANSITION_DURATION * 1000);

    window.setTimeout(() => {
      gsap.set(image, { clearProps: "opacity" });
      overlay.remove();
      veil.remove();
      delete document.documentElement.dataset.pandaTransitioning;
    }, 2600);
  };

  const prefetch = () => router.prefetch(href as Route);

  return (
    <a
      className={className}
      href={href}
      onClick={handleClick}
      onPointerDown={prefetch}
      onPointerEnter={prefetch}
      onFocus={prefetch}
    >
      {children}
    </a>
  );
}

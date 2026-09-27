"use client";

import { motion, useReducedMotion } from "motion/react";
import * as React from "react";

import { cn } from "@/lib/utils";

export interface SmoothTabItem {
  value: string;
  label: React.ReactNode;
}

interface SmoothTabsProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "onChange"> {
  items: SmoothTabItem[];
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  ariaLabel?: string;
  variant?: "surface" | "underline";
}

export function SmoothTabs({
  items,
  value,
  defaultValue,
  onValueChange,
  ariaLabel,
  variant = "surface",
  className,
  ...props
}: SmoothTabsProps) {
  const fallback = defaultValue ?? items[0]?.value ?? "";
  const [internalValue, setInternalValue] = React.useState(fallback);
  const currentValue = value ?? internalValue;
  const reduceMotion = useReducedMotion();
  const id = React.useId();

  const select = (next: string) => {
    if (value === undefined) setInternalValue(next);
    onValueChange?.(next);
  };

  return (
    <div
      className={cn(
        "flex overflow-x-auto",
        variant === "surface" ? "gap-1 rounded-lg border border-black/10 bg-black/[0.035] p-1" : "gap-0 border-b border-black/10",
        className,
      )}
      role="tablist"
      aria-label={ariaLabel}
      {...props}
    >
      {items.map((item) => {
        const active = currentValue === item.value;
        return (
          <button
            key={item.value}
            type="button"
            role="tab"
            aria-selected={active}
            className={cn(
              "relative min-h-10 flex-1 whitespace-nowrap px-4 text-sm font-medium text-stone-500 transition-colors",
              variant === "surface" ? "rounded-md" : "flex-none rounded-none",
              active && "text-emerald-950",
            )}
            onClick={() => select(item.value)}
          >
            {active ? (
              <motion.span
                className={cn(
                  "absolute",
                  variant === "surface"
                    ? "inset-0 rounded-md bg-white shadow-sm"
                    : "inset-x-0 bottom-0 h-0.5 bg-emerald-800",
                )}
                layoutId={`smooth-tabs-${id}`}
                transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 380, damping: 34 }}
              />
            ) : null}
            <span className="relative z-10">{item.label}</span>
          </button>
        );
      })}
    </div>
  );
}

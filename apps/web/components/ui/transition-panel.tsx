"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import * as React from "react";

import { cn } from "@/lib/utils";

export interface TransitionPanelItem {
  value: string;
  label: React.ReactNode;
  content: React.ReactNode;
}

interface TransitionPanelProps extends React.HTMLAttributes<HTMLDivElement> {
  items: TransitionPanelItem[];
  defaultValue?: string;
}

export function TransitionPanel({ items, defaultValue, className, ...props }: TransitionPanelProps) {
  const [value, setValue] = React.useState(defaultValue ?? items[0]?.value ?? "");
  const reduceMotion = useReducedMotion();
  const active = items.find((item) => item.value === value) ?? items[0];
  if (!active) return null;

  return (
    <div className={cn("grid gap-4 md:grid-cols-[minmax(12rem,0.7fr)_minmax(0,1.3fr)]", className)} {...props}>
      <div className="flex overflow-x-auto border-b border-black/10 md:block md:border-b-0 md:border-t">
        {items.map((item) => (
          <button
            key={item.value}
            type="button"
            aria-pressed={value === item.value}
            className={cn(
              "min-h-12 shrink-0 border-0 bg-transparent pr-5 text-left text-sm text-stone-500 md:block md:w-full md:border-b md:border-black/10 md:pr-0",
              value === item.value && "font-semibold text-emerald-950",
            )}
            onClick={() => setValue(item.value)}
          >
            {item.label}
          </button>
        ))}
      </div>
      <div className="grid min-h-40 place-items-center rounded-lg bg-emerald-950/[0.055] p-6">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={active.value}
            className="w-full"
            initial={reduceMotion ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduceMotion ? undefined : { opacity: 0, y: -6 }}
            transition={{ duration: reduceMotion ? 0 : 0.18 }}
          >
            {active.content}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

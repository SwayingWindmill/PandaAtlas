"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ChevronDown } from "lucide-react";
import * as React from "react";

import { cn } from "@/lib/utils";

export interface DisclosureItem {
  id: string;
  title: React.ReactNode;
  content: React.ReactNode;
}

interface DisclosureProps extends React.HTMLAttributes<HTMLDivElement> {
  items: DisclosureItem[];
  defaultOpenId?: string | null;
}

export function Disclosure({ items, defaultOpenId, className, ...props }: DisclosureProps) {
  const [openId, setOpenId] = React.useState<string | null>(defaultOpenId ?? items[0]?.id ?? null);
  const reduceMotion = useReducedMotion();

  return (
    <div className={cn("border-t border-black/10", className)} {...props}>
      {items.map((item) => {
        const open = openId === item.id;
        return (
          <div key={item.id} className="border-b border-black/10">
            <button
              type="button"
              className="flex min-h-14 w-full items-center justify-between gap-4 bg-transparent py-1 text-left text-sm font-semibold text-stone-800"
              aria-expanded={open}
              onClick={() => setOpenId(open ? null : item.id)}
            >
              <span>{item.title}</span>
              <motion.span
                className="shrink-0"
                animate={{ rotate: open ? 180 : 0 }}
                transition={reduceMotion ? { duration: 0 } : { duration: 0.2 }}
              >
                <ChevronDown className="h-4 w-4" aria-hidden="true" />
              </motion.span>
            </button>
            <AnimatePresence initial={false}>
              {open ? (
                <motion.div
                  className="overflow-hidden"
                  initial={reduceMotion ? false : { height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: reduceMotion ? 0 : 0.22 }}
                >
                  <div className="pb-4 pr-8 text-sm leading-7 text-stone-600">{item.content}</div>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
}

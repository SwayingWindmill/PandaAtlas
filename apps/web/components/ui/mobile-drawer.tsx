"use client";

import { X } from "lucide-react";
import * as React from "react";
import { Drawer } from "vaul";

import { cn } from "@/lib/utils";

interface MobileDrawerProps {
  trigger: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
  closeLabel?: string;
  className?: string;
}

export function MobileDrawer({
  trigger,
  title,
  description,
  children,
  closeLabel = "Close",
  className,
}: MobileDrawerProps) {
  return (
    <Drawer.Root>
      <Drawer.Trigger asChild>{trigger}</Drawer.Trigger>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-[80] bg-black/45" />
        <Drawer.Content
          className={cn(
            "fixed inset-x-0 bottom-0 z-[81] max-h-[82vh] rounded-t-2xl bg-white outline-none",
            className,
          )}
        >
          <div className="mx-auto mt-3 h-1 w-11 rounded-full bg-stone-300" />
          <div className="mx-auto w-[min(34rem,calc(100%-2rem))] px-0 pb-6 pt-5">
            <Drawer.Title className="text-xl font-semibold tracking-tight text-stone-900">{title}</Drawer.Title>
            {description ? (
              <Drawer.Description className="mt-2 text-sm leading-6 text-stone-600">{description}</Drawer.Description>
            ) : null}
            <div className="mt-5">{children}</div>
            <Drawer.Close asChild>
              <button
                type="button"
                className="mt-5 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-md border border-black/10 bg-white text-sm font-semibold text-stone-700"
              >
                <X className="h-4 w-4" aria-hidden="true" />
                {closeLabel}
              </button>
            </Drawer.Close>
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}

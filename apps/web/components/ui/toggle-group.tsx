"use client";

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { ToggleGroup as ToggleGroupPrimitive } from "radix-ui";

import { cn } from "@/lib/utils";

const toggleGroupVariants = cva(
  "inline-flex w-fit items-center justify-center rounded-full",
  {
    variants: {
      variant: {
        default: "bg-transparent",
        outline: "border border-current/15 bg-transparent p-1",
        soft: "bg-white/[0.06] p-1",
      },
      size: {
        sm: "min-h-9",
        default: "min-h-10",
        lg: "min-h-11",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

const toggleGroupItemVariants = cva(
  "relative inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full font-semibold transition-[color,background-color,border-color,transform] outline-none disabled:pointer-events-none disabled:opacity-45 focus-visible:ring-2 focus-visible:ring-current/30 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent data-[state=on]:bg-[var(--zp-brand-acid,#fbff36)] data-[state=on]:text-[var(--zp-brand-ink,#002526)]",
  {
    variants: {
      size: {
        sm: "min-h-8 px-3 text-xs",
        default: "min-h-9 px-3.5 text-[0.78rem]",
        lg: "min-h-10 px-4 text-sm",
      },
    },
    defaultVariants: {
      size: "default",
    },
  },
);

type ToggleGroupContextValue = VariantProps<typeof toggleGroupVariants> & {
  itemClassName?: string;
};

const ToggleGroupContext = React.createContext<ToggleGroupContextValue>({});

function ToggleGroup({
  className,
  variant,
  size,
  itemClassName,
  ...props
}: React.ComponentProps<typeof ToggleGroupPrimitive.Root> &
  VariantProps<typeof toggleGroupVariants> & {
    itemClassName?: string;
  }) {
  return (
    <ToggleGroupPrimitive.Root
      data-slot="toggle-group"
      className={cn(toggleGroupVariants({ variant, size }), className)}
      {...props}
    >
      <ToggleGroupContext.Provider value={{ variant, size, itemClassName }}>
        {props.children}
      </ToggleGroupContext.Provider>
    </ToggleGroupPrimitive.Root>
  );
}

function ToggleGroupItem({
  className,
  size,
  ...props
}: React.ComponentProps<typeof ToggleGroupPrimitive.Item> &
  VariantProps<typeof toggleGroupItemVariants>) {
  const context = React.useContext(ToggleGroupContext);

  return (
    <ToggleGroupPrimitive.Item
      data-slot="toggle-group-item"
      className={cn(
        toggleGroupItemVariants({ size: size ?? context.size }),
        context.itemClassName,
        className,
      )}
      {...props}
    />
  );
}

export { ToggleGroup, ToggleGroupItem, toggleGroupVariants };

"use client";

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { Button, type ButtonProps } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

function InputGroup({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="input-group"
      role="group"
      className={cn(
        "group/input-group relative flex min-h-10 w-full min-w-0 items-center rounded-md border border-black/10 bg-white transition-[border-color,box-shadow]",
        "has-[[data-slot=input-group-control]:focus-visible]:border-[var(--accent)] has-[[data-slot=input-group-control]:focus-visible]:ring-2 has-[[data-slot=input-group-control]:focus-visible]:ring-[var(--accent)]/15",
        className,
      )}
      {...props}
    />
  );
}

const addonVariants = cva(
  "flex shrink-0 items-center gap-2 text-sm text-current/65 [&>svg:not([class*='size-'])]:size-4",
  {
    variants: {
      align: {
        start: "order-first pl-3",
        end: "order-last pr-3",
      },
    },
    defaultVariants: {
      align: "start",
    },
  },
);

function InputGroupAddon({
  className,
  align,
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof addonVariants>) {
  return (
    <div
      data-slot="input-group-addon"
      className={cn(addonVariants({ align }), className)}
      onClick={(event) => {
        if ((event.target as HTMLElement).closest("button, a")) return;
        event.currentTarget.parentElement?.querySelector("input")?.focus();
      }}
      {...props}
    />
  );
}

function InputGroupInput({ className, ...props }: React.ComponentProps<"input">) {
  return (
    <Input
      data-slot="input-group-control"
      className={cn(
        "h-auto min-h-10 flex-1 rounded-none border-0 bg-transparent px-3 shadow-none focus-visible:border-0 focus-visible:ring-0",
        className,
      )}
      {...props}
    />
  );
}

function InputGroupText({ className, ...props }: React.ComponentProps<"span">) {
  return <span className={cn("text-sm text-current/65", className)} {...props} />;
}

function InputGroupButton({
  className,
  variant = "default",
  size = "sm",
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <Button
      type={type}
      variant={variant}
      size={size}
      className={cn("m-1 shrink-0 shadow-none", className)}
      {...props}
    />
  );
}

export {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
  InputGroupText,
};

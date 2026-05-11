import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex min-h-9 items-center rounded-full border px-3 py-1.5 text-[13px] leading-6 transition-colors",
  {
    variants: {
      variant: {
        subtle: "border-zinc-200 bg-white/80 text-zinc-600",
        olive: "border-green-200 bg-green-100 text-green-800",
        amber: "border-orange-200 bg-orange-100 text-orange-800",
        blue: "border-sky-200 bg-sky-100 text-sky-800"
      }
    },
    defaultVariants: {
      variant: "subtle"
    }
  }
);

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}


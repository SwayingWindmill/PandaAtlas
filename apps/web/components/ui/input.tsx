import * as React from "react";
import { cn } from "@/lib/utils";

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

export const Input = React.forwardRef<HTMLInputElement, InputProps>(({ className, ...props }, ref) => {
  return (
    <input
      ref={ref}
      className={cn(
        "flex h-10 w-full rounded-2xl border border-zinc-200 bg-white px-4 py-2 text-[15px] leading-7 text-zinc-900 shadow-sm shadow-zinc-200/30 transition-colors placeholder:text-zinc-400 focus-visible:border-green-700/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-800/15",
        className
      )}
      {...props}
    />
  );
});

Input.displayName = "Input";


import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement>;

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <div className="relative">
        <select
          ref={ref}
          className={cn(
            "h-10 w-full appearance-none rounded-2xl border border-zinc-200 bg-white px-4 py-2 pr-11 text-[15px] leading-7 text-zinc-900 shadow-sm shadow-zinc-200/30 transition-colors focus-visible:border-green-700/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-800/15",
            className
          )}
          {...props}
        >
          {children}
        </select>
        <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
      </div>
    );
  }
);

Select.displayName = "Select";


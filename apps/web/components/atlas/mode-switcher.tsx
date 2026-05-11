import type { AtlasMode } from "@/lib/panda-atlas";
import { ATLAS_MODES } from "@/lib/panda-atlas";
import { cn } from "@/lib/utils";

interface ModeSwitcherProps {
  value: AtlasMode;
  onValueChange: (nextValue: AtlasMode) => void;
}

export function ModeSwitcher({ value, onValueChange }: ModeSwitcherProps) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {ATLAS_MODES.map((mode) => {
        const active = value === mode.value;

        return (
          <button
            key={mode.value}
            type="button"
            onClick={() => onValueChange(mode.value)}
            aria-pressed={active}
            className={cn(
              "min-h-14 rounded-[18px] border px-4 py-3 text-left transition-colors",
              active
                ? "border-green-200 bg-green-100 text-green-800"
                : "border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300 hover:bg-stone-100"
            )}
          >
            <div className="text-[15px] font-medium leading-6">{mode.label}</div>
            <div className="pt-1 text-[12px] leading-5 text-inherit/70">{mode.kicker}</div>
          </button>
        );
      })}
    </div>
  );
}


import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

// `text-display` is the design system's display size (src/global.css). Without this,
// tailwind-merge reads it as a text color and drops the color class next to it.
const twMerge = extendTailwindMerge({
  extend: { classGroups: { "font-size": [{ text: ["display"] }] } },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

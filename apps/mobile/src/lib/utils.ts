import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

// tailwind-merge has to know the design system's own utilities (src/global.css): otherwise it
// reads `text-display` as a text color and `border-t-hairline` as a border color, and drops
// them when a color class follows.
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [{ text: ["display"] }],
      "border-w": [{ border: ["hairline"] }],
      "border-w-t": [{ "border-t": ["hairline"] }],
      "border-w-b": [{ "border-b": ["hairline"] }],
      h: [{ h: ["hairline"] }],
      w: [{ w: ["hairline"] }],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

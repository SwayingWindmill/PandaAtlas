import type { FamilyLayout, PlacedLine } from "./family-layout";

/** Translate the old canvas into the new viewport, including each canvas's centered scroll position. */
export function transitionOffset(previous: FamilyLayout, next: FamilyLayout, viewportWidth: number): number {
  function scrollPosition(tree: FamilyLayout): number {
    const focus = tree.cards.find((card) => card.kind === "focus");
    return focus ? Math.max(0, Math.min(tree.width - viewportWidth, focus.x + focus.width / 2 - viewportWidth / 2)) : 0;
  }
  return scrollPosition(next) - scrollPosition(previous);
}

const numberPattern = /-?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?/gi;

/** Shift only x coordinates, keeping the old paths in the new viewport. */
function shiftPathX(path: string, dx: number): string {
  return path.replace(/([MHVQ])([^MHVQ]*)/g, (_, command: string, args: string) => {
    const numbers = args.trim().split(/\s+/).filter(Boolean).map(Number);
    return command + numbers.map((value, index) => command === "V" || (command !== "H" && index % 2 === 1) ? value : value + dx).join(" ");
  });
}

export interface MorphLine {
  id: string;
  parts: string[];
  from: number[];
  to: number[];
}

/** Match only the same relationship and SVG command structure. */
export function matchLines(previous: PlacedLine[], next: PlacedLine[], offset: number) {
  const old = new Map(previous.map((line) => [line.id, { ...line, path: shiftPathX(line.path, offset) }]));
  const matched: MorphLine[] = [];
  const added: PlacedLine[] = [];
  for (const line of next) {
    const before = old.get(line.id);
    const parts = line.path.split(numberPattern);
    const fromParts = before?.path.split(numberPattern);
    if (before && fromParts && parts.join("|") === fromParts.join("|")) {
      matched.push({ id: line.id, parts, from: (before.path.match(numberPattern) ?? []).map(Number), to: (line.path.match(numberPattern) ?? []).map(Number) });
      old.delete(line.id);
    } else {
      added.push(line);
    }
  }
  return { matched, added, removed: [...old.values()] };
}

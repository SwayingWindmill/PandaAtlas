import type { Family, FamilyMember } from "@/features/family/family";

// One generation up and one down around the focus panda, like FamilySearch's family view.
// Tapping any relative re-centres the tree on it, so the layout never needs more rows.

export const PARENT_CARD = { width: 144, height: 72 };
export const MEMBER_CARD = { width: 96, height: 124 };
export const FOCUS_CARD = { width: 120, height: 152 };

const PAD = 16;
const ROW_GAP = 52;
const UNIT_GAP = 16;
const CARD_GAP = 8;
const COUPLE_GAP = 24;
const GROUP_PAD = 8;
const GROUP_LABEL = 26;
const BUS_OFFSET = 22;
const CORNER = 12;

export type CardKind = "parent" | "focus" | "member";

export interface PlacedCard {
  member: FamilyMember;
  kind: CardKind;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PlacedGroup {
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface FamilyLayout {
  width: number;
  height: number;
  cards: PlacedCard[];
  groups: PlacedGroup[];
  /** SVG path data for the connectors. */
  lines: string[];
  /** The dot joining the two parents, when both are known. */
  couple: { x: number; y: number } | null;
  /** Where the "no descendants" placeholder sits, when the focus panda has none. */
  noChildren: { x: number; y: number; width: number; height: number } | null;
}

interface Point {
  x: number;
  y: number;
}

/** A trunk from `source` to a horizontal bus, then a drop to each target, with rounded outer corners. */
function branch(source: Point, targets: Point[]): string[] {
  if (targets.length === 1 && targets[0].x === source.x) return [`M${source.x} ${source.y}V${targets[0].y}`];
  const busY = Math.min(...targets.map((target) => target.y)) - BUS_OFFSET;
  const xs = targets.map((target) => target.x).sort((a, b) => a - b);
  const left = Math.min(xs[0], source.x);
  const right = Math.max(xs[xs.length - 1], source.x);
  const paths = [`M${source.x} ${source.y}V${busY}`];
  const leftTarget = targets.find((target) => target.x === left);
  const rightTarget = targets.find((target) => target.x === right);
  paths.push(
    [
      leftTarget ? `M${left} ${leftTarget.y}V${busY + CORNER}Q${left} ${busY} ${left + CORNER} ${busY}` : `M${left} ${busY}`,
      rightTarget ? `H${right - CORNER}Q${right} ${busY} ${right} ${busY + CORNER}V${rightTarget.y}` : `H${right}`,
    ].join(""),
  );
  for (const target of targets) {
    if (target !== leftTarget && target !== rightTarget) paths.push(`M${target.x} ${busY}V${target.y}`);
  }
  return paths;
}

export function layoutFamily(family: Family, availableWidth: number): FamilyLayout {
  const cards: PlacedCard[] = [];
  const groups: PlacedGroup[] = [];
  const parents = [family.father, family.mother].filter((parent): parent is FamilyMember => parent !== null);

  // Positions are built from x = 0 and shifted into view at the end.
  const parentsTop = 0;
  const generationTop = parents.length > 0 ? parentsTop + PARENT_CARD.height + ROW_GAP : 0;
  const anyTwins = family.generation.some((group) => group.twins);
  const cardTop = generationTop + (anyTwins ? GROUP_LABEL : 0);

  // The focus panda's generation: one unit per sibling group.
  let cursor = 0;
  const drops: Point[] = [];
  let focusCard: PlacedCard | null = null;
  for (const group of family.generation) {
    const start = cursor + (group.twins ? GROUP_PAD : 0);
    let x = start;
    let tallest = 0;
    for (const member of group.members) {
      const size = member.id === family.focus.id ? FOCUS_CARD : MEMBER_CARD;
      const card: PlacedCard = { member, kind: member.id === family.focus.id ? "focus" : "member", x, y: cardTop, ...size };
      cards.push(card);
      if (card.kind === "focus") focusCard = card;
      x += size.width + CARD_GAP;
      tallest = Math.max(tallest, size.height);
    }
    const innerWidth = x - CARD_GAP - start;
    const unitWidth = innerWidth + (group.twins ? GROUP_PAD * 2 : 0);
    if (group.twins) {
      const year = group.members[0].birthDate?.slice(0, 4);
      groups.push({
        label: year ? `双胞胎　${year}` : "双胞胎",
        x: cursor,
        y: generationTop,
        width: unitWidth,
        height: GROUP_LABEL + tallest + GROUP_PAD,
      });
    }
    drops.push({ x: cursor + unitWidth / 2, y: group.twins ? generationTop : cardTop });
    cursor += unitWidth + UNIT_GAP;
  }
  const generationWidth = cursor - UNIT_GAP;
  const generationBottom = Math.max(...cards.map((card) => card.y + card.height), cardTop) + (anyTwins ? GROUP_PAD : 0);

  // Parents, centred over their children.
  const centre = generationWidth / 2;
  const lines: string[] = [];
  let couple: FamilyLayout["couple"] = null;
  if (parents.length === 2) {
    const [father, mother] = parents;
    cards.push({ member: father, kind: "parent", x: centre - COUPLE_GAP / 2 - PARENT_CARD.width, y: parentsTop, ...PARENT_CARD });
    cards.push({ member: mother, kind: "parent", x: centre + COUPLE_GAP / 2, y: parentsTop, ...PARENT_CARD });
    const coupleY = parentsTop + PARENT_CARD.height / 2;
    couple = { x: centre, y: coupleY };
    lines.push(`M${centre - COUPLE_GAP / 2} ${coupleY}H${centre + COUPLE_GAP / 2}`);
    lines.push(...branch({ x: centre, y: coupleY }, drops));
  } else if (parents.length === 1) {
    cards.push({ member: parents[0], kind: "parent", x: centre - PARENT_CARD.width / 2, y: parentsTop, ...PARENT_CARD });
    lines.push(...branch({ x: centre, y: parentsTop + PARENT_CARD.height }, drops));
  }

  // Children, centred under the focus panda.
  const focus = focusCard!;
  const focusCentre = focus.x + focus.width / 2;
  const focusBottom = focus.y + focus.height;
  const childrenTop = generationBottom + ROW_GAP;
  let noChildren: FamilyLayout["noChildren"] = null;
  if (family.children.length > 0) {
    const rowWidth = family.children.length * MEMBER_CARD.width + (family.children.length - 1) * CARD_GAP;
    const childTargets = family.children.map((member, index) => {
      const x = focusCentre - rowWidth / 2 + index * (MEMBER_CARD.width + CARD_GAP);
      cards.push({ member, kind: "member", x, y: childrenTop, ...MEMBER_CARD });
      return { x: x + MEMBER_CARD.width / 2, y: childrenTop };
    });
    lines.push(...branch({ x: focusCentre, y: focusBottom }, childTargets));
  } else {
    noChildren = { x: focusCentre - 56, y: childrenTop, width: 112, height: 36 };
  }
  const bottom = noChildren
    ? noChildren.y + noChildren.height
    : Math.max(...cards.map((card) => card.y + card.height));

  // Shift everything into view, centred when the tree is narrower than the screen.
  const boxes = [...cards, ...groups, ...(noChildren ? [noChildren] : [])];
  const minX = Math.min(...boxes.map((box) => box.x));
  const maxX = Math.max(...boxes.map((box) => box.x + box.width));
  const contentWidth = maxX - minX + PAD * 2;
  const width = Math.max(contentWidth, availableWidth);
  const dx = PAD - minX + (width - contentWidth) / 2;
  const dy = PAD;
  const shift = <T extends { x: number; y: number }>(box: T): T => ({ ...box, x: box.x + dx, y: box.y + dy });
  const shiftPath = (path: string) =>
    path.replace(/([MHVQ])([^MHVQ]*)/g, (_, command: string, args: string) => {
      const numbers = args.trim().split(/\s+/).filter(Boolean).map(Number);
      if (command === "H") return `H${numbers[0] + dx}`;
      if (command === "V") return `V${numbers[0] + dy}`;
      return command + numbers.map((value, index) => (index % 2 === 0 ? value + dx : value + dy)).join(" ");
    });

  return {
    width,
    height: bottom + PAD * 2,
    cards: cards.map(shift),
    groups: groups.map(shift),
    lines: lines.map(shiftPath),
    couple: couple ? shift(couple) : null,
    noChildren: noChildren ? shift(noChildren) : null,
  };
}

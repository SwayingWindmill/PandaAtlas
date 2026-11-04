import type { Family, FamilyMember } from "@/features/family/family";

// One generation up and one down around the focus panda, like FamilySearch's family view.
// Tapping any relative re-centres the tree on it, so the layout never needs more rows.

const PARENT = { width: 112, height: 124 };
const MEMBER = { width: 96, height: 124 };
const FOCUS = { width: 120, height: 140 };

// A card's two text lines (body name, footnote relation) at the default text size; they grow with it.
const CARD_TEXT = 24 + 18;
/** The largest text scale the tree follows; past it the 家谱 lists below carry the names. */
export const TREE_MAX_TEXT_SCALE = 2;

const PAD = 16;
const ROW_GAP = 52;
const UNIT_GAP = 16;
const CARD_GAP = 8;
const COUPLE_GAP = 24;
const GROUP_PAD = 8;
const GROUP_LABEL = 26;
// Matches the tree cards' top padding and 48px parent/relative portraits.
const PORTRAIT_TOP = 8;
const PORTRAIT_RADIUS = 24;

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

export interface PlacedLine {
  id: string;
  path: string;
}

export interface FamilyLayout {
  width: number;
  height: number;
  cards: PlacedCard[];
  groups: PlacedGroup[];
  /** SVG path data for the connectors. */
  lines: PlacedLine[];
  /** The dot joining the two parents, when both are known. */
  couple: { x: number; y: number } | null;
  /** Where the "no descendants" placeholder sits, when the focus panda has none. */
  noChildren: { x: number; y: number; width: number; height: number } | null;
}

interface Point {
  x: number;
  y: number;
}

/** A shared sibling rail with rounded ends and a drop to each portrait. */
function branch(source: Point, targets: (Point & { id: string })[], familyId: string): PlacedLine[] {
  if (targets.length === 0) return [];
  const railY = (source.y + Math.min(...targets.map((target) => target.y))) / 2;
  const left = Math.min(source.x, ...targets.map((target) => target.x));
  const right = Math.max(source.x, ...targets.map((target) => target.x));
  if (left === right) return [{ id: `${familyId}:single:${targets[0]!.id}`, path: `M${source.x} ${source.y}V${targets[0]!.y}` }];
  const radius = Math.min(8, (right - left) / 2);
  const leftTarget = targets.find((target) => target.x === left);
  const rightTarget = targets.find((target) => target.x === right);
  const rail = [
    leftTarget ? `M${left} ${leftTarget.y}V${railY + radius}Q${left} ${railY} ${left + radius} ${railY}` : `M${left} ${railY}`,
    rightTarget ? `H${right - radius}Q${right} ${railY} ${right} ${railY + radius}V${rightTarget.y}` : `H${right}`,
  ].join("");
  return [
    { id: `${familyId}:trunk`, path: `M${source.x} ${source.y}V${railY}` },
    { id: `${familyId}:rail:${targets.map((target) => target.id).sort().join(":")}`, path: rail },
    ...targets.filter((target) => target !== leftTarget && target !== rightTarget).map((target) => ({ id: `${familyId}:drop:${target.id}`, path: `M${target.x} ${railY}V${target.y}` })),
  ];
}

export function layoutFamily(family: Family, availableWidth: number, textScale = 1): FamilyLayout {
  const grow = CARD_TEXT * (Math.min(Math.max(textScale, 1), TREE_MAX_TEXT_SCALE) - 1);
  const PARENT_CARD = { ...PARENT, height: PARENT.height + grow };
  const MEMBER_CARD = { ...MEMBER, height: MEMBER.height + grow };
  const FOCUS_CARD = { ...FOCUS, height: FOCUS.height + grow };
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
  const drops: (Point & { id: string })[] = [];
  let focusCard: PlacedCard | null = null;
  for (const group of family.generation) {
    const start = cursor + (group.twins ? GROUP_PAD : 0);
    let x = start;
    let tallest = 0;
    for (const member of group.members) {
      const size = member.id === family.focus.id ? FOCUS_CARD : MEMBER_CARD;
      const card: PlacedCard = { member, kind: member.id === family.focus.id ? "focus" : "member", x, y: cardTop, ...size };
      cards.push(card);
      // A half-sibling must not be connected to both of the focus panda's parents.
      if (parents.length < 2 || !member.relation.startsWith("同")) {
        drops.push({ id: member.id, x: card.x + card.width / 2, y: card.y + PORTRAIT_TOP });
      }
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
    cursor += unitWidth + UNIT_GAP;
  }
  const generationWidth = cursor - UNIT_GAP;
  const generationBottom = Math.max(...cards.map((card) => card.y + card.height), cardTop) + (anyTwins ? GROUP_PAD : 0);

  // Parents, centred over their children.
  const centre = generationWidth / 2;
  const lines: PlacedLine[] = [];
  const parentsId = `parents:${parents.map((parent) => parent.id).sort().join(":")}`;
  let couple: FamilyLayout["couple"] = null;
  const [father, mother] = parents;
  if (father && mother) {
    cards.push({ member: father, kind: "parent", x: centre - COUPLE_GAP / 2 - PARENT_CARD.width, y: parentsTop, ...PARENT_CARD });
    cards.push({ member: mother, kind: "parent", x: centre + COUPLE_GAP / 2, y: parentsTop, ...PARENT_CARD });
    const coupleY = parentsTop + PORTRAIT_TOP + PORTRAIT_RADIUS;
    couple = { x: centre, y: coupleY };
    const portraitEdge = COUPLE_GAP / 2 + PARENT_CARD.width / 2 - PORTRAIT_RADIUS;
    lines.push({ id: `${parentsId}:couple`, path: `M${centre - portraitEdge} ${coupleY}H${centre + portraitEdge}` });
    // Keep the branches below the parents' labels, so curves never cross their text.
    const branchY = parentsTop + PARENT_CARD.height + 4;
    lines.push({ id: `${parentsId}:stem`, path: `M${centre} ${coupleY}V${branchY}` });
    lines.push(...branch({ x: centre, y: branchY }, drops, parentsId));
  } else if (father) {
    const parent: PlacedCard = { member: father, kind: "parent", x: centre - PARENT_CARD.width / 2, y: parentsTop, ...PARENT_CARD };
    cards.push(parent);
    lines.push(...branch({ x: centre, y: parentsTop + PARENT_CARD.height }, drops, parentsId));
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
      return { id: member.id, x: x + MEMBER_CARD.width / 2, y: childrenTop + PORTRAIT_TOP };
    });
    lines.push(...branch({ x: focusCentre, y: focusBottom }, childTargets, `children:${family.focus.id}`));
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
      const [first = 0] = numbers;
      if (command === "H") return `H${first + dx}`;
      if (command === "V") return `V${first + dy}`;
      return command + numbers.map((value, index) => (index % 2 === 0 ? value + dx : value + dy)).join(" ");
    });

  return {
    width,
    height: bottom + PAD * 2,
    // Top to bottom, left to right: the order VoiceOver reads the absolutely placed cards in.
    cards: cards.map(shift).sort((a, b) => a.y - b.y || a.x - b.x),
    groups: groups.map(shift),
    lines: lines.map((line) => ({ ...line, path: shiftPath(line.path) })),
    couple: couple ? shift(couple) : null,
    noChildren: noChildren ? shift(noChildren) : null,
  };
}

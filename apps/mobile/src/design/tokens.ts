/**
 * 吱熊猫 design tokens: the single source of truth for the app's colors, type, spacing, radii,
 * sizes and motion.
 *
 * Three layers:
 *   1. `primitive`  raw values (palettes, the 4pt scale, durations, curves). Nothing on a screen
 *                   should point here directly.
 *   2. `semantic`   roles a screen asks for (label, tint, inset, enter). Values are references to
 *                   primitives, never raw literals.
 *   3. `component`  sizes and parts owned by one component (button height, chip avatar).
 *
 * `npm run design:tokens -w @zhipanda/mobile` writes the generated blocks in `src/global.css` and
 * the front matter of `DESIGN.md` from this file; `src/lib/theme.ts` and the motion helpers import
 * it directly. `src/design/tokens.test.ts` fails when a generated file is out of date.
 *
 * This file has no imports so Node can run the generator on it with type stripping alone.
 */

// ---------------------------------------------------------------------------------------------
// 1. Primitives
// ---------------------------------------------------------------------------------------------

/** Black or white at an alpha, the only translucent colors the app uses. */
function alpha(base: "black" | "white", a: number) {
  return base === "black" ? `rgba(0,0,0,${a})` : `rgba(255,255,255,${a})`;
}

const palette = {
  /** iOS system neutrals (light and dark grouped backgrounds, labels, fills, separators). */
  gray: {
    white: "#FFFFFF",
    50: "#F2F2F7", // systemGroupedBackground
    100: "#E5E5EA", // systemFill (light), systemGray5
    150: "#D1D1D6", // systemGray4, pressed
    200: "#C6C6C8", // opaqueSeparator
    250: "#C4C4C7", // tertiaryLabel, opaque
    300: "#AEAEB2", // secondaryLabel (dark)
    500: "#636366", // secondaryLabel (light), AA on white and grouped
    600: "#5B5B60", // tertiaryLabel (dark), opaque
    700: "#3A3A3C", // systemGray4 dark, pressed (dark), photo placeholder
    750: "#38383A", // opaqueSeparator (dark)
    800: "#2C2C2E", // systemFill (dark)
    900: "#1C1C1E", // secondarySystemGroupedBackground (dark)
    black: "#000000",
  },
  /** The tint. Deep bamboo jade in light mode, pale jade in dark mode. */
  jade: {
    50: "#E3EBE8", // tint at ~12% on white
    300: "#7DCAA4",
    700: "#165C3C",
    950: "#16241E", // tint at ~18% on black
  },
  /**
   * The warm accent, 笋金 (bamboo-shoot gold): a muted brass that sits opposite the jade on the
   * colour wheel without competing with it. Hue ~40°, kept apart from the warning orange (27°).
   */
  shoot: {
    50: "#F5EDDB",
    300: "#E3BD6E",
    700: "#846018",
    950: "#2B2312",
  },
  red: { light: "#CE2C31", dark: "#FF6961" },
  orange: { light: "#B25000", dark: "#FF9F0A" },
} as const;

/** The 4pt spacing scale. Keys follow Tailwind's numbering, so `p-4` is 16. */
const space = { 0: 0, 1: 4, 2: 8, 3: 12, 4: 16, 5: 20, 6: 24, 8: 32, 10: 40 } as const;

const radius = { xs: 4, sm: 8, md: 10, lg: 12, xl: 16, "2xl": 24, full: 999 } as const;

const duration = { instant: 100, press: 120, quick: 200, base: 280, slow: 480 } as const;

/** Cubic-bezier control points. */
const easing = {
  /** Strong ease-out: fast start, gentle settle. UI motion never eases in. */
  out: [0.23, 1, 0.32, 1],
  /** On-screen movement from one place to another. */
  inOut: [0.77, 0, 0.175, 1],
  /** 竹 bamboo: a stalk that bends past its mark by ~3% and settles. Transforms only. */
  bamboo: [0.3, 1.15, 0.5, 1],
} as const;

/** Spring configs for Reanimated (`withSpring`). */
const spring = {
  /** 竹 bamboo: damping ratio ≈0.84, settles in ~0.5s with one small overshoot. */
  bamboo: { mass: 1, stiffness: 170, damping: 22 },
  /** Critically damped: follows a finger without bounce. */
  snappy: { mass: 1, stiffness: 400, damping: 40 },
} as const;

const fontFamily = {
  system: "-apple-system, BlinkMacSystemFont, PingFang SC, sans-serif",
} as const;

const fontWeight = { regular: "400", semibold: "600", bold: "700" } as const;

export const primitive = { palette, space, radius, duration, easing, spring, fontFamily, fontWeight } as const;

// ---------------------------------------------------------------------------------------------
// 2. Semantic tokens
// ---------------------------------------------------------------------------------------------

/**
 * Color roles, both appearances. Keys are what screens read through `useIOSColors()`.
 * Every value is a primitive, or black/white at an alpha.
 */
const colorLight = {
  groupedBackground: palette.gray[50],
  background: palette.gray.white,
  card: palette.gray.white,
  label: palette.gray.black,
  secondaryLabel: palette.gray[500],
  tertiaryLabel: palette.gray[250],
  separator: palette.gray[200],
  tint: palette.jade[700],
  button: palette.jade[700],
  buttonLabel: palette.gray.white,
  highlightSoft: palette.jade[50],
  warm: palette.shoot[700],
  warmSoft: palette.shoot[50],
  destructive: palette.red.light,
  warning: palette.orange.light,
  fill: palette.gray[100],
  pressed: palette.gray[150],
  onMedia: palette.gray.white,
  mediaPlaceholder: palette.gray[700],
  photoStroke: alpha("black", 0.1),
  glassFallback: alpha("black", 0.38),
  barMaterial: alpha("white", 0.86),
} as const;

export type ColorRole = keyof typeof colorLight;

const colorDark: Record<ColorRole, string> = {
  groupedBackground: palette.gray.black,
  background: palette.gray.black,
  card: palette.gray[900],
  label: palette.gray.white,
  secondaryLabel: palette.gray[300],
  tertiaryLabel: palette.gray[600],
  separator: palette.gray[750],
  tint: palette.jade[300],
  button: palette.jade[300],
  buttonLabel: palette.gray.black,
  highlightSoft: palette.jade[950],
  warm: palette.shoot[300],
  warmSoft: palette.shoot[950],
  destructive: palette.red.dark,
  warning: palette.orange.dark,
  fill: palette.gray[800],
  pressed: palette.gray[700],
  onMedia: palette.gray.white,
  mediaPlaceholder: palette.gray[700],
  photoStroke: alpha("white", 0.1),
  glassFallback: alpha("black", 0.38),
  barMaterial: "rgba(28,28,30,0.86)", // gray[900] at 86%
};

/** What each color role is for. Read by the generator (DESIGN.md) and the showcase. */
export const colorRoleNotes: Record<ColorRole, string> = {
  groupedBackground: "The page: systemGroupedBackground.",
  background: "An article column: systemBackground.",
  card: "Inset groups, cards, stat tiles: secondarySystemGroupedBackground.",
  label: "Primary text.",
  secondaryLabel: "Footnotes, the line under a row, icons, the date.",
  tertiaryLabel: "The disclosure chevron and placeholder glyphs. Not body text.",
  separator: "Inset hairline row dividers.",
  tint: "What a fan can do: selected tab, link, action row, focus ring.",
  button: "The ground of the one filled button.",
  buttonLabel: "The label on a filled button.",
  highlightSoft: "The ground of a tinted capsule button (关注).",
  warm: "笋金. A marker, never an action: today, new, a milestone badge.",
  warmSoft: "The ground of a warm badge, with `warm` text on it.",
  destructive: "Delete and remove.",
  warning: "A caution line (closed today, unconfirmed).",
  fill: "Secondary buttons, search field, toggles.",
  pressed: "A pressed row or control.",
  onMedia: "Text and glyphs over a photograph, always over a scrim.",
  mediaPlaceholder: "The dark ground a story card shows while its photo loads.",
  photoStroke: "The 1px inside edge on a rounded photograph.",
  glassFallback: "The translucent disc behind a toolbar glyph where Liquid Glass is unavailable.",
  barMaterial: "The web tab bar, under a backdrop blur.",
};

/** The bottom scrim over a photograph: black, clear at the top to 72% at the bottom. */
const scrim = {
  color: palette.gray.black,
  stops: [
    { offset: 0, opacity: 0 },
    { offset: 0.45, opacity: 0.32 },
    { offset: 1, opacity: 0.72 },
  ],
} as const;

export interface TextStyle {
  size: number;
  lineHeight: number;
  weight: (typeof fontWeight)[keyof typeof fontWeight];
  /** Letter spacing in px. 0 everywhere: CJK text is never tracked. */
  tracking: number;
  /** What the style is for, and where it must not go. */
  use: string;
}

/**
 * The text styles, named by purpose (iOS text styles). Each binds size, line height, weight and
 * tracking; a screen picks a style, never a size. Line heights are opened up so Chinese doesn't clip.
 */
const text = {
  display: {
    size: 34, lineHeight: 41, weight: fontWeight.bold, tracking: 0,
    use: "The one title on a screen: a tab root, a panda's or an institution's name, the featured story.",
  },
  title: {
    size: 22, lineHeight: 28, weight: fontWeight.bold, tracking: 0,
    use: "A section, a card title, a resident's name on a tile, a stat value (with tabular figures).",
  },
  headline: {
    size: 17, lineHeight: 24, weight: fontWeight.semibold, tracking: 0,
    use: "A name or label that leads a row or chip; emphasis at body size.",
  },
  body: {
    size: 17, lineHeight: 26, weight: fontWeight.regular, tracking: 0,
    use: "Sentences, row titles, buttons.",
  },
  subheadline: {
    size: 15, lineHeight: 22, weight: fontWeight.regular, tracking: 0,
    use: "A second line in a dense row or a chip's relation, when footnote is too small to read in Chinese.",
  },
  footnote: {
    size: 13, lineHeight: 18, weight: fontWeight.regular, tracking: 0,
    use: "Group headers, captions, credits, stat labels, the date. The smallest text in the app.",
  },
} as const satisfies Record<string, TextStyle>;

export type TextStyleName = keyof typeof text;

/** The 科普 reading column: articles, terms, face guides. A formal set, used only there. */
const reading = {
  "reading-title": {
    size: 28, lineHeight: 36, weight: fontWeight.bold, tracking: 0,
    use: "An article's title at the top of the column.",
  },
  "reading-heading": {
    size: 22, lineHeight: 30, weight: fontWeight.bold, tracking: 0,
    use: "A section inside an article.",
  },
  "reading-lead": {
    size: 17, lineHeight: 28, weight: fontWeight.regular, tracking: 0,
    use: "The dek under the title, in the secondary label.",
  },
  "reading-body": {
    size: 17, lineHeight: 28, weight: fontWeight.regular, tracking: 0,
    use: "Running text in an article. Line height 1.65 for long Chinese reading.",
  },
  "reading-caption": {
    size: 13, lineHeight: 20, weight: fontWeight.regular, tracking: 0,
    use: "A photo caption or a reference under the column.",
  },
} as const satisfies Record<string, TextStyle>;

export type ReadingStyleName = keyof typeof reading;

/**
 * Deprecated sizes, kept so screens that have not been redesigned keep rendering. Do not use on a
 * new or redesigned screen; each names its replacement. Removed once the four tabs are redone.
 */
const legacyText = {
  "large-title": { size: 34, lineHeight: 41, replacement: "display" },
  title1: { size: 28, lineHeight: 36, replacement: "display, or reading-title in 科普" },
  title2: { size: 22, lineHeight: 28, replacement: "title" },
  title3: { size: 20, lineHeight: 26, replacement: "title" },
  callout: { size: 16, lineHeight: 24, replacement: "body" },
  subhead: { size: 15, lineHeight: 22, replacement: "subheadline" },
  caption: { size: 12, lineHeight: 16, replacement: "footnote" },
  base: { size: 17, lineHeight: 26, replacement: "body" },
  xs: { size: 12, lineHeight: 16, replacement: "footnote" },
  sm: { size: 15, lineHeight: 22, replacement: "subheadline" },
  xl: { size: 22, lineHeight: 28, replacement: "title" },
} as const;

/** Spacing roles on the 4pt scale. */
const spacing = {
  hairGap: { value: space[1], use: "Between an icon and its label, a value and its unit." },
  stackTight: { value: space[2], use: "Between lines that belong together (title and footnote)." },
  row: { value: space[3], use: "A row's vertical padding; the gap between tiles in a grid or scroller." },
  inset: { value: space[4], use: "The page's side inset and a card's padding." },
  stack: { value: space[5], use: "Between blocks inside a section." },
  sectionTight: { value: space[6], use: "Between a section header and the previous group on a dense screen." },
  section: { value: space[8], use: "Between sections on a page." },
  page: { value: space[10], use: "Above the first section under a hero, and the bottom clearance." },
} as const;

/** Radius roles. Nested shapes are concentric: inner = outer − padding (see `concentric`). */
const radii = {
  card: { value: radius["2xl"], use: "The featured 今天 story card." },
  tile: { value: radius.xl, use: "Story cards in the scroller, resident tiles, stat blocks, quiz photos." },
  control: { value: radius.lg, use: "Search field, segmented control, small photo in a row." },
  group: { value: radius.md, use: "Inset grouped lists." },
  pill: { value: radius.full, use: "Buttons, capsules and chips. Height / 2 in practice." },
  glyph: { value: radius.sm, use: "The 30pt rounded square behind a row glyph on 设置, and only there." },
} as const;

/** Motion roles. Each pairs a duration with a curve, so a screen asks for a role, not numbers. */
const motion = {
  press: { duration: duration.press, easing: "out", use: "Cards and tiles scale to 0.97 while pressed." },
  enter: {
    // 280, not 480: it plays on every page open, and UI that repeats that often stays under 300ms.
    duration: duration.base, easing: "bamboo",
    use: "A page's content arrives once its data is in: fade and an 8pt rise on the bamboo curve.",
  },
  exit: { duration: duration.quick, easing: "out", use: "Something leaves: shorter than it came, no overshoot." },
  move: { duration: duration.base, easing: "inOut", use: "Something already on screen changes place." },
  hero: {
    duration: duration.slow, easing: "bamboo", spring: "bamboo",
    use: "A photo or card growing into place (a reveal, a zoom-in). The signature moment.",
  },
} as const;

export const semantic = {
  color: { light: colorLight, dark: colorDark },
  scrim,
  text,
  reading,
  legacyText,
  spacing,
  radius: radii,
  motion,
} as const;

// ---------------------------------------------------------------------------------------------
// 3. Component tokens
// ---------------------------------------------------------------------------------------------

export const component = {
  /** Every tappable thing is at least this tall and wide (Apple HIG). */
  hitTarget: 44,
  button: { height: 48, paddingX: space[6], radius: radius.full },
  listRow: { minHeight: 44, paddingX: space[4], paddingY: space[3], iconInset: 50 },
  searchField: { height: 44, radius: radius.md },
  glassButton: { size: 44 },
  familyChip: { height: 52, padding: space[1], avatar: 44 },
  /** 设置 rows: a glyph in a tinted rounded square, as the system Settings app draws them. */
  settingsGlyph: { size: 30, icon: 18, inset: space[4] + 30 + space[3] },
  /** A segmented control: a 44pt track with the selected segment inset 2pt (concentric radius). */
  segmented: { height: 44, padding: 2 },
  /** Icons follow the text they sit beside, like SF Symbols. */
  icon: { footnote: 15, subhead: 18, body: 22, title3: 24, chevron: 17 },
  /** The web tab bar (native tabs draw their own). */
  tabBar: { icon: 25, iconStroke: 1.9, label: 10, labelLine: 14, webHeight: 54 },
  iconStroke: { regular: 1.75, bold: 2 },
  press: { scale: 0.97, reducedOpacity: 0.85 },
  enter: { rise: space[2] },
} as const;

// ---------------------------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------------------------

/** The concentric rule: a shape inside another takes the outer radius minus the padding. */
export function concentric(outer: number, padding: number) {
  return Math.max(outer - padding, 0);
}

export function cubicBezierCss(name: keyof typeof easing) {
  return `cubic-bezier(${easing[name].join(", ")})`;
}

export const tokens = { primitive, semantic, component } as const;

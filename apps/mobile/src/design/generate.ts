/**
 * Renders the generated parts of `src/global.css` and `DESIGN.md` from `tokens.ts`.
 * Pure functions: `scripts/design-tokens.mjs` writes the output, `tokens.test.ts` checks it.
 */
import {
  type ColorRole,
  component,
  primitive,
  semantic,
  type TextStyle,
} from "./tokens.ts";

export const CSS_START = "/* @generated design-tokens:start (edit src/design/tokens.ts, then npm run design:tokens) */";
export const CSS_END = "/* @generated design-tokens:end */";

const kebab = (name: string) => name.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();

/**
 * CSS color variables. The shadcn names (`primary`, `muted`, `accent` = pressed) stay because the
 * React Native Reusables components use them; new roles get their own names.
 */
const CSS_COLORS: [cssName: string, role: ColorRole, note?: string][] = [
  ["background", "groupedBackground", "systemGroupedBackground"],
  ["foreground", "label", "label"],
  ["card", "card", "secondarySystemGroupedBackground"],
  ["card-foreground", "label"],
  ["popover", "card"],
  ["popover-foreground", "label"],
  ["primary", "tint", "tint"],
  ["primary-foreground", "buttonLabel"],
  ["secondary", "fill", "system fill"],
  ["secondary-foreground", "label"],
  ["muted", "fill"],
  ["muted-foreground", "secondaryLabel", "secondary label"],
  ["accent", "pressed", "pressed (shadcn name; the brand accent is `warm`)"],
  ["accent-foreground", "label"],
  ["destructive", "destructive"],
  ["border", "separator", "opaqueSeparator"],
  ["input", "fill"],
  ["ring", "tint"],
  ["highlight", "tint"],
  ["highlight-foreground", "tint"],
  ["highlight-soft", "highlightSoft", "tinted-button fill"],
  ["warning", "warning"],
  ["paper", "background", "systemBackground, the reading column"],
  ["tertiary-foreground", "tertiaryLabel", "tertiary label: chevrons, not text"],
  ["warm", "warm", "笋金: markers only, never actions"],
  ["warm-soft", "warmSoft", "warm badge fill"],
  ["on-media", "onMedia", "over a scrim"],
  ["media-placeholder", "mediaPlaceholder"],
  ["photo-stroke", "photoStroke"],
  ["glass-fallback", "glassFallback"],
  ["bar-material", "barMaterial"],
];

function textVars(name: string, style: { size: number; lineHeight: number }) {
  return [`  --text-${name}: ${style.size}px;`, `  --text-${name}--line-height: ${style.lineHeight}px;`];
}

export function renderCssBlock(): string {
  const lines: string[] = [CSS_START, "@theme {"];

  lines.push("  /* Radius. sm–xl are the React Native Reusables scale; the named roles are for screens. */");
  for (const key of ["sm", "md", "lg", "xl"] as const) {
    lines.push(`  --radius-${key}: ${primitive.radius[key]}px;`);
  }
  for (const [name, { value }] of Object.entries(semantic.radius)) {
    lines.push(`  --radius-${kebab(name)}: ${value}px;`);
  }

  lines.push("", "  /* Spacing roles on the 4pt scale (numbers like p-4 still work: 4 × 4px). */");
  for (const [name, { value }] of Object.entries(semantic.spacing)) {
    lines.push(`  --spacing-${kebab(name)}: ${value}px;`);
  }

  lines.push("", "  /* Text styles. Weight comes from the <Text> variant, not the size class. */");
  for (const [name, style] of Object.entries(semantic.text)) lines.push(...textVars(name, style));
  lines.push("", "  /* 科普 reading column. */");
  for (const [name, style] of Object.entries(semantic.reading)) lines.push(...textVars(name, style));
  lines.push("", "  /* Deprecated sizes: kept for screens not yet redesigned. See DESIGN.md › Deprecated. */");
  for (const [name, style] of Object.entries(semantic.legacyText)) {
    if (name in semantic.text) continue;
    lines.push(...textVars(name, style));
  }

  lines.push("", "  /* Motion. */");
  for (const [name, ms] of Object.entries(primitive.duration)) lines.push(`  --duration-${name}: ${ms}ms;`);
  for (const [name, points] of Object.entries(primitive.easing)) {
    lines.push(`  --ease-${kebab(name)}: cubic-bezier(${points.join(", ")});`);
  }
  lines.push("}", "");

  lines.push("@layer theme {", "  :root {");
  for (const scheme of ["light", "dark"] as const) {
    lines.push(`    @variant ${scheme} {`);
    for (const [cssName, role, note] of CSS_COLORS) {
      const value = semantic.color[scheme][role].toLowerCase();
      lines.push(`      --color-${cssName}: ${value};${note ? ` /* ${note} */` : ""}`);
    }
    lines.push("    }");
    if (scheme === "light") lines.push("");
  }
  lines.push("  }", "}", CSS_END);
  return lines.join("\n");
}

/** Replaces the generated block in a CSS file, keeping everything around it. */
export function applyCssBlock(css: string): string {
  const start = css.indexOf(CSS_START);
  const end = css.indexOf(CSS_END);
  if (start === -1 || end === -1) throw new Error("global.css is missing the @generated design-tokens markers");
  return css.slice(0, start) + renderCssBlock() + css.slice(end + CSS_END.length);
}

// ---------------------------------------------------------------------------------------------
// DESIGN.md front matter (google-labs-code/design.md format)
// ---------------------------------------------------------------------------------------------

const yamlString = (value: string) => JSON.stringify(value);

/** Front-matter color names: the role in kebab case, `-dark` for the dark value. */
function colorEntries() {
  const entries: [string, string][] = [];
  for (const role of Object.keys(semantic.color.light) as ColorRole[]) {
    if (role === "button" || role === "photoStroke" || role === "glassFallback" || role === "barMaterial") continue;
    const name = role === "tint" ? "primary" : kebab(role);
    entries.push([name, semantic.color.light[role]]);
    entries.push([`${name}-dark`, semantic.color.dark[role]]);
  }
  return entries;
}

function typographyEntry(style: Pick<TextStyle, "size" | "lineHeight" | "weight" | "tracking">) {
  return [
    `    fontFamily: ${yamlString("system-ui")}`,
    `    fontSize: ${style.size}px`,
    `    fontWeight: ${Number(style.weight)}`,
    `    lineHeight: ${style.lineHeight}px`,
    `    letterSpacing: ${style.tracking}px`,
  ];
}

/**
 * Components as the spec models them: one entry per variant, light and dark. They reference every
 * color so the linter can see which tokens are in use.
 */
function componentEntries(): [string, Record<string, string>][] {
  const c = (light: Record<string, string>, dark: Record<string, string>, name: string) =>
    [
      [name, light],
      [`${name}-dark`, dark],
    ] as [string, Record<string, string>][];
  const pair = (map: (s: "" | "-dark") => Record<string, string>, name: string) => c(map(""), map("-dark"), name);
  return [
    ...pair(
      (s) => ({ backgroundColor: `{colors.grouped-background${s}}`, textColor: `{colors.label${s}}` }),
      "page",
    ),
    ...pair(
      (s) => ({
        backgroundColor: `{colors.background${s}}`,
        textColor: `{colors.label${s}}`,
        typography: "{typography.reading-body}",
        padding: `${component.listRow.paddingX}px`,
      }),
      "reading-column",
    ),
    ...pair(
      (s) => ({
        backgroundColor: `{colors.card${s}}`,
        textColor: `{colors.secondary-label${s}}`,
        typography: "{typography.footnote}",
        rounded: "{rounded.group}",
      }),
      "grouped-list",
    ),
    ...pair(
      (s) => ({
        backgroundColor: `{colors.pressed${s}}`,
        textColor: `{colors.label${s}}`,
        typography: "{typography.body}",
        height: `${component.listRow.minHeight}px`,
      }),
      "list-row-pressed",
    ),
    ...pair((s) => ({ backgroundColor: `{colors.separator${s}}`, height: "1px" }), "separator"),
    ...pair(
      (s) => ({
        backgroundColor: `{colors.card${s}}`,
        textColor: `{colors.tertiary-label${s}}`,
        size: `${component.icon.chevron}px`,
      }),
      "disclosure-chevron",
    ),
    ...pair(
      (s) => ({
        backgroundColor: `{colors.primary${s}}`,
        textColor: `{colors.button-label${s}}`,
        typography: "{typography.headline}",
        rounded: "{rounded.pill}",
        height: `${component.button.height}px`,
        padding: `${component.button.paddingX}px`,
      }),
      "button-primary",
    ),
    ...pair(
      (s) => ({
        backgroundColor: `{colors.highlight-soft${s}}`,
        textColor: `{colors.primary${s}}`,
        typography: "{typography.headline}",
        rounded: "{rounded.pill}",
        height: `${component.button.height}px`,
      }),
      "button-tinted",
    ),
    ...pair(
      (s) => ({
        backgroundColor: `{colors.fill${s}}`,
        textColor: `{colors.label${s}}`,
        typography: "{typography.headline}",
        rounded: "{rounded.pill}",
        height: `${component.button.height}px`,
      }),
      "button-secondary",
    ),
    ...pair(
      (s) => ({
        backgroundColor: `{colors.card${s}}`,
        textColor: `{colors.destructive${s}}`,
        typography: "{typography.body}",
        height: `${component.listRow.minHeight}px`,
      }),
      "row-destructive",
    ),
    ...pair(
      (s) => ({
        backgroundColor: `{colors.card${s}}`,
        textColor: `{colors.warning${s}}`,
        typography: "{typography.footnote}",
      }),
      "caution-line",
    ),
    ...pair(
      (s) => ({
        backgroundColor: `{colors.warm-soft${s}}`,
        textColor: `{colors.warm${s}}`,
        typography: "{typography.footnote}",
        rounded: "{rounded.pill}",
        padding: "4px",
      }),
      "warm-badge",
    ),
    ...pair(
      (s) => ({
        backgroundColor: `{colors.card${s}}`,
        textColor: `{colors.label${s}}`,
        typography: "{typography.title}",
        rounded: "{rounded.tile}",
        padding: `${semantic.spacing.inset.value}px`,
      }),
      "stat-block",
    ),
    ...pair(
      (s) => ({
        backgroundColor: `{colors.media-placeholder${s}}`,
        textColor: `{colors.on-media${s}}`,
        typography: "{typography.title}",
        rounded: "{rounded.card}",
        padding: `${semantic.spacing.inset.value}px`,
      }),
      "story-card",
    ),
  ];
}

export function renderFrontMatter(): string {
  const out: string[] = ["---"];
  out.push(
    "# Generated from apps/mobile/src/design/tokens.ts by `npm run design:tokens -w @zhipanda/mobile`. Do not edit by hand.",
    "version: alpha",
    "name: 吱熊猫",
    `description: ${yamlString(
      "A calm iOS app about giant pandas: system colors with a bamboo-jade tint and a rare shoot-gold accent, purpose-named type, and photographs that do the talking.",
    )}`,
    "colors:",
  );
  for (const [name, value] of colorEntries()) out.push(`  ${name}: ${yamlString(value)}`);

  out.push("typography:");
  for (const [name, style] of [...Object.entries(semantic.text), ...Object.entries(semantic.reading)]) {
    out.push(`  ${name}:`, ...typographyEntry(style));
  }

  out.push("rounded:");
  for (const [name, { value }] of Object.entries(semantic.radius)) out.push(`  ${name}: ${value}px`);

  out.push("spacing:");
  for (const [name, { value }] of Object.entries(semantic.spacing)) out.push(`  ${kebab(name)}: ${value}px`);
  out.push(`  hit-target: ${component.hitTarget}px`);

  out.push("components:");
  for (const [name, props] of componentEntries()) {
    out.push(`  ${name}:`);
    for (const [key, value] of Object.entries(props)) {
      out.push(`    ${key}: ${value.startsWith("{") ? yamlString(value) : value}`);
    }
  }
  out.push("---");
  return out.join("\n");
}

/** Replaces the front matter of DESIGN.md, keeping the prose. */
export function applyFrontMatter(markdown: string): string {
  const match = /^---\n[\s\S]*?\n---(?=\n)/.exec(markdown);
  if (!match) throw new Error("DESIGN.md has no front matter");
  return renderFrontMatter() + markdown.slice(match[0].length);
}

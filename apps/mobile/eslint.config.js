// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require("eslint/config");
const expoConfig = require("eslint-config-expo/flat");

// Hardcoded values, deprecated variants and old motion imports (DESIGN.md › Governance, › Deprecated).
const ARBITRARY = "Arbitrary Tailwind value. Use a token class (p-inset, rounded-tile, text-footnote) or add a token.";
const TOKEN_RULES = [
  {
    selector: "Literal[value=/^#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/]",
    message: "Hardcoded hex color. Use a color role (useIOSColors(), a bg-/text- class, or src/design/tokens.ts).",
  },
  {
    selector: "Literal[value=/^(?:rgba?|hsla?)\\(/]",
    message: "Hardcoded rgba/hsl color. Name it in src/design/tokens.ts and read the role instead.",
  },
  {
    selector: "Property[key.name='fontSize'][value.type='Literal']",
    message: "Numeric fontSize. Use a <Text> variant (display, title, headline, body, subheadline, footnote).",
  },
  { selector: "Literal[value=/(?:^|\\s)[!a-z0-9:-]*-\\[[^\\]]+\\]/]", message: ARBITRARY },
  { selector: "TemplateElement[value.raw=/(?:^|\\s)[!a-z0-9:-]*-\\[[^\\]]+\\]/]", message: ARBITRARY },
  {
    selector:
      "JSXOpeningElement[name.name='Text'] > JSXAttribute[name.name='variant'] > Literal[value=/^(?:largeTitle|title1|title2|title3|callout|subhead|caption|h1|h2|h3|h4|p|muted|small|large|lead)$/]",
    message: "Deprecated Text variant. Use display, title, headline, body, subheadline or footnote (DESIGN.md › Deprecated).",
  },
  {
    selector: "ImportDeclaration[source.value='@/components/stretchy-hero'] > ImportSpecifier[imported.name=/^(?:CONTENT_ENTER|EASE_OUT)$/]",
    message: "Motion tokens live in @/design/motion (PAGE_ENTER for a page's content).",
  },
];
// Old type-size and numeric-radius classes, as a whole class with or without a variant prefix (dark:, web:).
const OLD_CLASS =
  "(?:^|\\s)(?:[a-z0-9-]+:)*(?:text-(?:large-title|title1|title2|title3|callout|subhead|caption|xs|sm|base|lg|xl|2xl|3xl|4xl)|rounded(?:-[trblse]{1,2})?-(?:sm|md|lg|xl|2xl|3xl))(?=$|\\s)";
const OLD_CLASS_MESSAGE =
  "Deprecated class. Use a text style class (text-footnote, text-subheadline, text-body…) or a radius role (rounded-card/tile/control/group/pill).";
const DEPRECATED_CLASS_RULES = [
  { selector: `Literal[value=/${OLD_CLASS}/]`, message: OLD_CLASS_MESSAGE },
  { selector: `TemplateElement[value.raw=/${OLD_CLASS}/]`, message: OLD_CLASS_MESSAGE },
];

module.exports = defineConfig([
  expoConfig,
  {
    // eslint-plugin-react 7.37.5 still detects the React version with context.getFilename(),
    // which ESLint 10 removed. Pinning the version skips that path. The app depends on React 19.3.1.
    settings: {
      react: {
        version: "19.3.1",
      },
    },
  },
  {
    // Design-system governance (DESIGN.md › Governance). Errors since v2.8: every screen is on the
    // tokens, so a hardcoded value or a deprecated style fails `npm run lint` and CI.
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["src/design/**", "src/lib/theme.ts", "src/global.css", "**/*.test.ts"],
    rules: { "no-restricted-syntax": ["error", ...TOKEN_RULES, ...DEPRECATED_CLASS_RULES] },
  },
  {
    // The Text component defines the deprecated variants (kept so nothing old breaks); only its
    // callers are held to the v2 names.
    files: ["src/components/ui/text.tsx"],
    rules: { "no-restricted-syntax": ["error", ...TOKEN_RULES] },
  },
  {
    ignores: [".expo/*", "dist/*"],
  },
]);

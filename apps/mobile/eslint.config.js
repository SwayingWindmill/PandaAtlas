// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require("eslint/config");
const expoConfig = require("eslint-config-expo/flat");

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
    // Design-system governance (DESIGN.md › Governance). Warnings only: they never fail CI, and
    // screens that predate the tokens are migrated when they are redesigned, not in bulk.
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["src/design/**", "src/lib/theme.ts", "src/global.css", "**/*.test.ts"],
    rules: {
      "no-restricted-syntax": [
        "warn",
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
        {
          selector: "Literal[value=/(?:^|\\s)[!a-z0-9:-]*-\\[[^\\]]+\\]/]",
          message: "Arbitrary Tailwind value. Use a token class (p-inset, rounded-tile, text-footnote) or add a token.",
        },
        {
          selector: "TemplateElement[value.raw=/(?:^|\\s)[!a-z0-9:-]*-\\[[^\\]]+\\]/]",
          message: "Arbitrary Tailwind value. Use a token class (p-inset, rounded-tile, text-footnote) or add a token.",
        },
      ],
    },
  },
  {
    ignores: [".expo/*", "dist/*"],
  },
]);

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
    ignores: [".expo/*", "dist/*"],
  },
]);

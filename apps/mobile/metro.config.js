const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");
const { withUniwindConfig } = require("uniwind/metro");

const config = getDefaultConfig(__dirname);
// The 科普 working copy lives with the other curated files, outside this package.
config.watchFolders = [path.resolve(__dirname, "../../data/curation/learning")];

module.exports = withUniwindConfig(config, {
  cssEntryFile: "./src/global.css",
  dtsFile: "./src/uniwind-types.d.ts",
});

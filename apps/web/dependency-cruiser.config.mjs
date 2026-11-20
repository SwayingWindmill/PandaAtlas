/** @type {import('dependency-cruiser').IConfiguration} */
const config = {
  forbidden: [
    {
      name: "no-circular-web-dependencies",
      severity: "error",
      from: { path: "^(app|components|features|lib|proxy\\.ts)" },
      to: { circular: true },
    },
    {
      name: "components-must-not-import-features",
      severity: "error",
      from: { path: "^components/" },
      to: { path: "^features/" },
    },
  ],
  options: {
    doNotFollow: { path: "node_modules" },
    tsPreCompilationDeps: true,
    tsConfig: { fileName: "tsconfig.json" },
    includeOnly: "^(app|components|features|lib|proxy\\.ts)",
    enhancedResolveOptions: {
      exportsFields: ["exports"],
      conditionNames: ["import", "require", "node", "default"],
    },
    reporterOptions: {
      dot: { collapsePattern: "node_modules/[^/]+" },
    },
  },
};

export default config;

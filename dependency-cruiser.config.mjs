/** @type {import('dependency-cruiser').IConfiguration} */
export default {
  forbidden: [
    {
      name: "no-circular-api-dependencies",
      severity: "error",
      from: { path: "^services/api/src" },
      to: { circular: true },
    },
    {
      name: "domain-does-not-import-platform",
      severity: "error",
      from: { path: "^services/api/src/modules/[^/]+/domain" },
      to: { path: "^services/api/src/platform" },
    },
    {
      name: "application-does-not-import-http",
      severity: "error",
      from: { path: "^services/api/src/modules/[^/]+/application" },
      to: { path: "^services/api/src/modules/[^/]+/http" },
    }
  ],
  options: {
    doNotFollow: { path: "node_modules" },
    includeOnly: "^(services/api/src|packages/api-client/src)",
    enhancedResolveOptions: { exportsFields: ["exports"] },
    reporterOptions: {
      dot: { collapsePattern: "node_modules/[^/]+" }
    }
  }
};

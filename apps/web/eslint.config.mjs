import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypeScript from "eslint-config-next/typescript";

const eslintConfig = [
  ...nextCoreWebVitals,
  ...nextTypeScript,
  {
    // Upstream shadcn/ui ships this file byte-identical to ours and sets state in an effect; keep
    // it upstream-identical so `shadcn add --overwrite` updates apply cleanly.
    files: ["hooks/use-mobile.ts"],
    rules: { "react-hooks/set-state-in-effect": "off" },
  },
  {
    ignores: [
      ".next/**",
      ".next-*/**",
      ".cloudflare/**",
      "out/**",
      "build/**",
      "next-env.d.ts",
      "public/maplibre/maplibre-gl-csp-worker.js",
    ]
  }
];

export default eslintConfig;

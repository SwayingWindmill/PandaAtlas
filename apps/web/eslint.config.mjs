import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypeScript from "eslint-config-next/typescript";

const eslintConfig = [
  ...nextCoreWebVitals,
  ...nextTypeScript,
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

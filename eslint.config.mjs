import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "**/coverage/**",
      "apps/web/**",
      "services/worker-api/**",
      "services/api/app/**",
      "services/api/scripts/**",
      "services/api/tests/**"
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    files: ["services/api/src/**/*.ts", "services/api/test/**/*.ts", "packages/api-client/src/**/*.ts"],
    languageOptions: {
      globals: globals.node,
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      "@typescript-eslint/consistent-type-imports": ["error", { prefer: "type-imports" }],
      "@typescript-eslint/no-explicit-any": "error",
    },
  },
  {
    files: ["services/api/src/modules/*/domain/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            "@nestjs/*",
            "fastify",
            "kysely",
            "pg",
            "pino",
            "@sentry/*",
            "@opentelemetry/*",
            "../../../platform/*",
            "../../../../platform/*"
          ],
        },
      ],
    },
  },
  {
    files: ["services/api/src/modules/*/application/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            "@nestjs/*",
            "fastify",
            "kysely",
            "pg",
            "pino",
            "@sentry/*",
            "@opentelemetry/*"
          ],
        },
      ],
    },
  },
);

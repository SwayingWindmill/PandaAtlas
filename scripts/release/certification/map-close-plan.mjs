import {
  apiDir,
  apiReleaseEnv,
  runCommand,
  uvRunPrefix,
} from "../default.mjs";

export const MAP_CLOSE_PROFILE = Object.freeze({
  AUTHORITATIVE: "authoritative",
  WINDOWS_COMPATIBILITY: "windows-compatibility",
});

export const MAP_CLOSE_WEB_ENVIRONMENT = Object.freeze({
  NEXT_PUBLIC_API_BASE_URL: "http://127.0.0.1:65535",
  NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:65534",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "test-publishable-key",
  NEXT_PUBLIC_ENGAGEMENT_ENABLED: "true",
  NEXT_PUBLIC_FEED_ENABLED: "true",
  NEXT_PUBLIC_NOTIFICATION_ENABLED: "true",
});

function publishedReturnBrowserStep({ label, dependsOn, env }) {
  return {
    id: "published-return-loop-browser",
    label,
    dependsOn,
    run: () =>
      runCommand(
        "npm",
        [
          "run",
          "smoke",
          "-w",
          "web",
          "--",
          "tests/smoke/published-return-loop.spec.ts",
        ],
        { env },
      ),
  };
}

function authoritativeSteps(playwrightEnv) {
  return [
    {
      id: "archive-governance-evidence",
      label: "Issue #196 single-accountable Archive governance evidence package",
      run: () => runCommand("node", ["scripts/release/validate-archive-governance-evidence.mjs"]),
    },
    {
      id: "archive-governance-inventory",
      label: "Exhaustive four-eyes inventory and superseding ADR contract",
      dependsOn: ["archive-governance-evidence"],
      run: () => runCommand("npm", ["run", "check:archive-governance-migration"]),
    },
    {
      id: "archive-governance-contracts",
      label: "Accountable publication, Archive operation, and workbench contracts",
      dependsOn: ["archive-governance-evidence", "archive-governance-inventory"],
      run: () =>
        runCommand(
          "uv",
          [
            ...uvRunPrefix,
            "pytest",
            "-q",
            "tests/archive_publication",
            "tests/archive_operations",
            "tests/archive_workbench",
            "tests/contracts/test_accountable_publication_storage_contract.py",
            "tests/contracts/test_accountable_publication_openapi_contract.py",
            "tests/contracts/test_accountable_archive_operations_openapi_contract.py",
            "tests/contracts/test_accountable_archive_operations_storage_contract.py",
            "tests/contracts/test_archive_operation_activity_event_contract.py",
            "tests/contracts/test_archive_workbench_storage_contract.py",
            "tests/contracts/test_archive_workbench_openapi_contract.py",
            "tests/contracts/test_archive_governance_canonical_openapi.py",
            "tests/contracts/test_archive_governance_canonical_openapi_contract.py",
          ],
          { cwd: apiDir, env: apiReleaseEnv },
        ),
    },
    {
      id: "archive-governance-openapi",
      label: "Integrated canonical Archive governance OpenAPI and SHA-256",
      dependsOn: ["archive-governance-contracts", "archive-governance-inventory"],
      run: () =>
        runCommand(
          "uv",
          [
            ...uvRunPrefix,
            "python",
            "scripts/build_archive_governance_openapi.py",
            "--output",
            "../../.release-gate/panda-atlas-v1-integrated.yaml",
          ],
          { cwd: apiDir, env: apiReleaseEnv },
        ),
    },
    {
      id: "archive-governance-web-contracts",
      label: "Bounded Archive workbench, cutover, and evidence source contracts",
      dependsOn: ["archive-governance-evidence"],
      run: () =>
        runCommand("node", [
          "--test",
          "scripts/release/tests/archive-governance-evidence.test.mjs",
          "scripts/release/tests/archive-governance-migration.test.mjs",
          "scripts/release/tests/archive-workbench.test.mjs",
        ]),
    },
    {
      id: "admin-bundle-budget",
      label: "Isolated React-admin gzip budget",
      dependsOn: ["archive-governance-web-contracts"],
      run: () => runCommand("node", ["scripts/release/check-admin-bundle-budget.mjs"]),
    },
    {
      id: "structured-contribution-evidence",
      label: "Issue #193 structured contribution evidence package",
      dependsOn: ["archive-governance-evidence"],
      run: () => runCommand("node", ["scripts/release/validate-structured-contribution-evidence.mjs"]),
    },
    {
      id: "notification-center-budget",
      label: "Private notification center performance budget",
      dependsOn: ["structured-contribution-evidence", "archive-governance-evidence"],
      run: () => runCommand("npm", ["run", "check:notification-center-budget"]),
    },
    {
      id: "zhipanda-brand-closure",
      label: "ZhiPanda public-brand and compatibility closure",
      run: () => runCommand("node", ["scripts/release/check-zhipanda-brand-closure.mjs"]),
    },
    {
      id: "supabase-foundation-contracts",
      label: "Supabase/PostGIS/PGMQ foundation contracts",
      dependsOn: ["structured-contribution-evidence", "archive-governance-evidence"],
      run: () =>
        runCommand(
          "uv",
          [
            ...uvRunPrefix,
            "pytest",
            "-q",
            "tests/scripts/test_check_zhipanda_foundation.py",
            "tests/contracts/test_integration_event_contract.py",
            "tests/contracts/test_identity_capability_storage_contract.py",
          ],
          { cwd: apiDir, env: apiReleaseEnv },
        ),
    },
    {
      id: "identity-engagement-contracts",
      label: "Identity, capability, Follow, consent, and Passport contracts",
      dependsOn: ["structured-contribution-evidence", "archive-governance-evidence"],
      run: () =>
        runCommand(
          "uv",
          [
            ...uvRunPrefix,
            "pytest",
            "-q",
            "tests/identity",
            "tests/engagement",
            "tests/api/test_engagement_feature_flags.py",
          ],
          { cwd: apiDir, env: apiReleaseEnv },
        ),
    },
    {
      id: "secure-web-boundary",
      label: "Public/admin bundle, browser-write, and legacy Saved boundary",
      dependsOn: ["structured-contribution-evidence", "archive-governance-evidence"],
      run: () => runCommand("node", ["scripts/release/check-secure-engagement-boundary.mjs"]),
    },
    {
      id: "follow-through-login-browser",
      label: "Follow-through-login and private Passport browser journey",
      dependsOn: ["secure-web-boundary", "identity-engagement-contracts"],
      run: () =>
        runCommand(
          "npm",
          [
            "run",
            "smoke",
            "-w",
            "web",
            "--",
            "tests/smoke/follow-through-login.spec.ts",
          ],
          { env: playwrightEnv },
        ),
    },
    publishedReturnBrowserStep({
      label: "Published Activity, private Inbox, preference, and mobile browser journey",
      dependsOn: [
        "secure-web-boundary",
        "identity-engagement-contracts",
        "archive-governance-contracts",
      ],
      env: playwrightEnv,
    }),
    {
      id: "admin-shell-browser",
      label: "Bounded React-admin shell, headers, mobile, keyboard, and WCAG",
      dependsOn: [
        "secure-web-boundary",
        "archive-governance-web-contracts",
        "admin-bundle-budget",
        "archive-governance-openapi",
      ],
      run: () =>
        runCommand("npm", ["run", "test:admin-shell", "-w", "web"], {
          env: playwrightEnv,
        }),
    },
  ];
}

function windowsCompatibilitySteps() {
  const browserEnvironment = {
    ...MAP_CLOSE_WEB_ENVIRONMENT,
    PLAYWRIGHT_WEB_SERVER_MODE: "production",
    PLAYWRIGHT_REUSE_EXISTING_SERVER: "0",
    PLAYWRIGHT_NEXT_DIST_DIR: ".next",
  };

  return [
    {
      id: "release-contracts",
      label: "Release orchestration contracts",
      run: () => runCommand("npm", ["run", "test:release-gate"]),
    },
    {
      id: "web-lint",
      label: "Windows Web lint and architecture guards",
      run: () => runCommand("npm", ["run", "lint:web"]),
    },
    {
      id: "web-typecheck",
      label: "Windows Web TypeScript",
      run: () => runCommand("npm", ["run", "typecheck:web"]),
    },
    {
      id: "web-build",
      label: "Windows Web production build",
      dependsOn: ["web-lint", "web-typecheck"],
      run: () => runCommand("npm", ["run", "build:web"], { env: MAP_CLOSE_WEB_ENVIRONMENT }),
    },
    {
      id: "api-sync",
      label: "Windows locked FastAPI environment",
      run: () =>
        runCommand("uv", ["sync", "--directory", apiDir, "--frozen", "--extra", "dev"], {
          env: apiReleaseEnv,
        }),
    },
    {
      id: "api-lint",
      label: "Windows FastAPI lint",
      dependsOn: ["api-sync"],
      run: () =>
        runCommand("uv", [...uvRunPrefix, "ruff", "check", "app", "tests", "scripts"], {
          cwd: apiDir,
          env: apiReleaseEnv,
        }),
    },
    {
      id: "api-tests",
      label: "Windows FastAPI regression tests",
      dependsOn: ["api-sync"],
      run: () =>
        runCommand("uv", [...uvRunPrefix, "pytest", "-q"], {
          cwd: apiDir,
          env: apiReleaseEnv,
        }),
    },
    publishedReturnBrowserStep({
      label: "Windows private Inbox and notification preference browser journey",
      dependsOn: ["web-build"],
      env: browserEnvironment,
    }),
  ];
}

function validatePlan(plan) {
  const ids = new Set();
  for (const step of plan.steps) {
    if (!step.id || ids.has(step.id)) {
      throw new Error(`Map-close certification step IDs must be unique: ${step.id}`);
    }
    ids.add(step.id);
  }
  for (const step of plan.steps) {
    for (const dependency of step.dependsOn ?? []) {
      if (!ids.has(dependency)) {
        throw new Error(
          `Map-close certification step ${step.id} references missing dependency ${dependency}`,
        );
      }
    }
  }
  return plan;
}

export function createMapCloseCertificationPlan({ profile, playwrightEnv = {} } = {}) {
  if (profile === MAP_CLOSE_PROFILE.AUTHORITATIVE) {
    return validatePlan({
      profile,
      gate: "map-close",
      steps: authoritativeSteps(playwrightEnv),
    });
  }
  if (profile === MAP_CLOSE_PROFILE.WINDOWS_COMPATIBILITY) {
    return validatePlan({
      profile,
      gate: "windows-map-close-compatibility",
      steps: windowsCompatibilitySteps(),
    });
  }
  throw new Error(`Unknown map-close certification profile: ${profile ?? "undefined"}`);
}

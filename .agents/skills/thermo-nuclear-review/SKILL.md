---
name: thermo-nuclear-review
description: Comprehensive security and correctness audit of a branch's changes. Use for thermo nuclear, thermonuclear, or deep review requests, or branch/PR diff audits focused on bugs, breaking changes, security issues, devex regressions, and feature-gate leaks.
---

# Thermo Nuclear Review

Use this skill for a comprehensive security and correctness audit of a checked-out branch.

## Prompt

You are a security and reliability reviewer performing a comprehensive review of a checked-out branch. Audit this branch and its changes thoroughly for bugs, changes that break existing features/functionality, and security vulnerabilities. Be thorough, rigorous, careful, and attentive so nothing slips through.

## Scope

- ONLY report issues related to code that is being ADDED or MODIFIED in this PR/branch.
- Focus on changes in the diff.
- DO NOT report pre-existing vulnerabilities in unchanged code unless the diff exposes or worsens them.

## Guidelines

### Breaking Functionality Guidelines

This repository spans Next.js/React web (`apps/web`), Expo React Native mobile (`apps/mobile`), NestJS/Express API (`services/api`), shared workspace packages (`packages/api-client`, `packages/world-map`), Python curation/collector tooling (`tools/panda-data`, `services/collector`), Supabase migrations (`infra/supabase/`), and scripts (`scripts/`). Trace cross-module callers, contracts (`contracts/`), API routes, and side effects end-to-end.

### Breaking Devex Guidelines

Catch changes that break developers' ability to run, test, or build locally. Examples (not exhaustive):

- Modifying how secrets are read or where runtime credentials live
- Updating or adding required environment variables
- Remapping local Supabase/API/app ports or breaking Windows/CI compatibility
- Adding mandatory build/gen scripts that silently break normal workflows without updating `package.json`, `scripts/development/catalog.mjs` / `verify.mjs`, or docs

### Feature Leak Guidelines

Check module ownership, route auth/principal capability gates (`services/api`, `contracts/`), and environment guards so restricted, curation-only, or unfinished surfaces do not leak into public fan flows.

### Intended Breakage Guidelines

If a high-risk change (e.g., removing a legacy path or safeguard per `AGENTS.md`) is clearly the scoped intent of the branch, do not waste time flagging the intentional removal itself. Still report it if unintended blast radius remains or safety guarantees would silently drop.

### Over-reporting Guidelines

Never inflate nitpicks into high-priority issues. Trace every finding through actual callers/code before reporting so confidence is grounded in evidence.

## Final Response

- If you have medium-to-high findings and a PR exists for this branch, check the PR discussion with `gh pr view` / `gh api` AFTER finishing your own fresh-eyes audit.
- Evaluate any bot or reviewer comments already on the PR, incorporate missed valid issues, and flag overlapping findings.

## Critical Rules

- Never present issues with unfinished research (if backend/frontend code is in the workspace, inspect both sides before claiming).
- Perform your audit before reading existing PR review comments.
- Cite exact file paths, line ranges, and reproduced evidence for every finding.

# Impeccable vendored skill

This directory vendors the project-local Impeccable skill used by PandaAtlas frontend development.

- Upstream: `https://github.com/pbakaus/impeccable`
- Upstream skill tag: `skill-v4.1.2`
- Skill version: `4.1.2`
- Vendored on: `2026-09-01`
- License: Apache-2.0; see `LICENSE` and `NOTICE.md`

## Update policy

Treat an Impeccable update as an intentional vendor bump. Replace this directory from a reviewed upstream skill release, preserve the upstream license/notice, rerun Web Impeccable detection plus normal Web lint/typecheck, and review any changed design rules before committing.

Do not casually patch Impeccable's internal detector or hook plumbing to silence findings. Project-specific product truth belongs in `apps/web/PRODUCT.md`, durable visual decisions in `apps/web/DESIGN.md`, route/component strategy in `apps/web/.impeccable/surfaces/`, and justified detector exceptions in `apps/web/.impeccable/config.json`.

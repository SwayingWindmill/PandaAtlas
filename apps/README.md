# Application boundary

`apps/` contains user-facing application runtimes. The current application is [`web`](web/), a private npm workspace.

Application code may consume published contracts and service APIs, but it must not become an authoritative database write path or a home for crawler, release, recovery or research execution. Runtime status is defined in the [deployment status page](../docs/deployment/runtime-status.md); the npm workspaces are listed in [Monorepo structure](../docs/monorepo-structure.md).

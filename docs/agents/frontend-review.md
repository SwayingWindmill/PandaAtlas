# Frontend UX/UI review

Read this when designing, restyling or accepting a Web UI change.

- Read the user-global `jakubkrehel/skills` under `~/.agents/skills/`. Use `better-interface` with its six domain skills (`better-accessibility`, `better-layout`, `better-writing`, `better-typography`, `better-colors`, `better-ui`) when designing or auditing a complete operator flow.
- For a visual change, run the `interface-review` skill as its own change-scoped review alongside Matt's Standards/Spec code review.
- These skills are a developer-workstation prerequisite, not an app dependency: they stay user-global and add no build or runtime dependency.
- Product facts, security and capabilities, existing PandaAtlas design contracts and accessibility take precedence over aesthetic suggestions.
- Visual sign-off is a look at the rendered desktop page with real-data semantics, in its loading, empty and error states. A passing automated test is not visual sign-off.

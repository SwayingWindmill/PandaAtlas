# CodeGraph development integration

PandaAtlas uses CodeGraph as an optional local code-intelligence layer for AI coding agents. The repository pins `@colbymchenry/codegraph` so every contributor indexes the same parser and graph behavior.

CodeGraph is a development tool only. Its SQLite index stays under `.codegraph/`, is ignored by Git, and is not required by production builds or CI.

## Initialize the project graph

From the repository root:

```bash
npm ci
npm run codegraph:init
npm run codegraph:status
```

`codegraph:init` creates the local `.codegraph/` directory and performs the initial full index. The MCP server watches source changes and incrementally synchronizes the graph. Run `npm run codegraph:sync` only when the watcher is unavailable or before a scripted query.

The repository wrapper sets `CODEGRAPH_TELEMETRY=0` unless the caller explicitly supplies another value.

## Connect an AI coding agent

CodeGraph's agent installer is machine-level configuration and is intentionally not committed. Install the pinned CLI globally, then connect the agents used on that workstation:

```bash
npm install --global @colbymchenry/codegraph@1.5.0
codegraph telemetry off
codegraph install
```

For a non-interactive Codex setup:

```bash
codegraph install --target=codex --location=global --yes
```

Restart the agent after changing its MCP configuration. The MCP server command is:

```text
codegraph serve --mcp
```

To use the repository-pinned package instead of a global binary, configure the agent to run `node scripts/codegraph.mjs serve --mcp` with the repository root as its working directory. Invoke the wrapper directly for MCP stdio so package-manager status text cannot precede the JSON-RPC stream.

## Repository commands

| Command | Purpose |
| --- | --- |
| `npm run codegraph:init` | Create the project index and perform the first full build |
| `npm run codegraph:index` | Rebuild the full index |
| `npm run codegraph:sync` | Apply an explicit incremental update |
| `npm run codegraph:status` | Show indexed files, symbols, relationships, and pending changes |
| `npm run codegraph:query -- <term>` | Query indexed symbols from the CLI |

## Index scope

`codegraph.json` excludes generated TypeScript projections, immutable public-release data, reviewed batch payloads, and static design prototypes. Those files are either generated or evidence artifacts and would add noise to structural and impact queries.

The graph continues to include:

- Next.js routes, components, libraries, and tests under `apps/web`;
- FastAPI routes, services, schemas, scripts, and tests under `services/api`;
- the Cloudflare Worker implementation under `services/worker-api`;
- release, curation, and repository tooling under `scripts`;
- database migrations and other supported source files under `infra`.

## Agent usage policy

When CodeGraph MCP is available, use it first for repository architecture, symbol relationships, callers, callees, route ownership, and change-impact questions. Use normal file reads for exact live content when CodeGraph reports pending synchronization, and continue to use the repository's normal tests, linters, type checks, and release gates as the authority for correctness.

Do not commit `.codegraph/` or treat the graph database as release evidence.

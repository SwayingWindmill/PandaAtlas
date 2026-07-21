# Scrapy and Scrapling controlled acquisition PoC

Issue: #87

## Decision

PandaAtlas uses a hybrid acquisition boundary:

- **Scrapy is the primary orchestrator** for source scheduling, duplicate filtering, robots enforcement, rate limiting, retry policy, persistent jobs, and deterministic extraction.
- **Scrapling is a specialized adapter** for browser-rendered sources, browser-consistent HTTP/TLS identity, authorized session persistence, and evidence-only adaptive selector suggestions.
- Both engines emit the same candidate and evidence schema. Neither engine writes to PostgreSQL, Public Release, D1, R2, or the public frontend.
- Every acquired record remains a candidate until a curator reviews the source, facts, relationships, media rights, attribution, and bilingual content.

This decision is not based on repository popularity. It follows the existing Python 3.11+ review pipeline, the measured selector behavior below, dependency isolation, and the operational difference between deterministic scheduling and browser-oriented acquisition.

## Dependency boundary

The locked dependencies live in the `crawler-poc` optional extra:

- `scrapy==2.17.0`
- `scrapling[fetchers]==0.4.8`

They are not API production dependencies. The default FastAPI and Release Gate dependency sync continues to install only the existing runtime and `dev` extras. A dedicated Linux/Windows workflow installs the PoC extra and browser runtimes.

## Shared evidence contract

Each engine records:

- engine name and exact installed version;
- requested and final URL;
- HTTP status and normalized response headers;
- body byte count and SHA-256;
- selected capability mode;
- deterministic selector mode;
- block classification;
- candidate fields, only when all deterministic selectors pass;
- adaptive suggestion metadata, when requested;
- parse timings.

The current candidate fixture contains only an individual name in Chinese and English and an institution. This is intentionally not a production panda schema. The PoC proves transport, evidence, failure, and review boundaries before real source adapters are selected.

## Capability modes

| Mode | Intended use | Required behavior |
|---|---|---|
| `public-http` | Public API or HTML source | robots, allowlist, domain delay, deterministic parser |
| `authorized-session` | Account PandaAtlas is authorized to automate | credential reference outside reports, persistent cookies, no MFA bypass |
| `browser-rendered` | JavaScript-required public source | Playwright-rendered session and browser evidence |
| `approved-proxy` | Stable approved egress or regional access | one configured proxy, no automatic rotation after blocking |
| `stealth-lab` | PandaAtlas-owned loopback experiment only | no external host, no challenge solving, no Canvas hiding |

## Anti-detection evaluation

Anti-detection is a first-class evaluation dimension rather than an implicit bypass switch. The controlled lab measures:

- browser-consistent User-Agent and request headers;
- Chrome TLS/HTTP impersonation through Scrapling's static fetcher;
- cookie and authorized-session persistence;
- JavaScript execution through `DynamicFetcher`;
- navigator and request fingerprints through `StealthyFetcher`;
- behavior after a controlled 403 human challenge.

The local static experiment produced a Chrome 146-style User-Agent, browser Accept and language headers, `sec-ch-ua`, `sec-fetch-site`, and a browser referer. The same fetcher session reused the loopback authorization cookie. The controlled challenge remained a terminal `stop-and-review` state and did not trigger identity switching.

The local WSL browser experiment may report `environment-blocked` when Chromium system libraries are missing. This is not treated as a passed browser result. The dedicated CI workflow installs browser dependencies and runs `--require-browser-lab`, where either browser fetcher being unavailable fails the job.

## Selector drift result

The unchanged fixture was extracted identically by Scrapy and Scrapling.

After the fixture structure changed:

- both deterministic parsers returned no candidate;
- Scrapling's adaptive lookup found no result at the 70% high-confidence threshold;
- its measured top score was approximately 26.19%;
- a second 25% analysis pass produced a **low-confidence, evidence-only suggestion**;
- that suggestion did not populate any candidate or trusted field.

The low threshold exists only to expose the possible relocation to a curator. It is not a fallback extraction threshold.

## Blocking and identity policy

The following responses terminate automatic extraction:

- authorization required;
- CAPTCHA, Turnstile, or equivalent human challenge;
- HTTP 429 rate limit;
- HTTP 403 or 451 block.

After one of these states, the adapter saves evidence and stops. It does not:

- rotate proxy identity;
- switch accounts or sessions;
- solve a challenge;
- lower selector confidence to publish data;
- continue through an unapproved endpoint.

Scrapling's broader proxy and challenge-related capabilities are documented in the capability profile so the architecture does not pretend they do not exist. They remain disabled in production plans. A future source-specific exception would require explicit authorization, threat review, a dedicated issue, and a separate non-default adapter.

## Commands

Offline deterministic comparison and non-strict local browser lab:

```bash
npm run crawler:poc
```

Strict controlled browser lab:

```bash
npm run crawler:poc:strict
```

Acquisition tests and Ruff:

```bash
npm run test:crawler-poc
npm run lint:crawler-poc
```

Reports are written to:

```text
.release-gate/crawler-poc/report.json
```

## Next implementation slice

Do not start a broad web crawl from this PoC. The next slice should select three individually reviewed source adapters:

1. one official JSON or MediaWiki-style API;
2. one public institution HTML page with deterministic selectors;
3. one public institution page that genuinely requires JavaScript.

For each source, review its terms, robots policy, authentication requirements, media-license implications, expected request volume, and evidence retention before enabling network access.

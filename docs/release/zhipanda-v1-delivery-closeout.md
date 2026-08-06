# ZhiPanda V1 Delivery Closeout

Issue #201 owns the single final staging and production-readiness decision for ZhiPanda V1. It starts after the map-close tickets and Issue #200 operational-readiness implementation are merged.

## Current baseline

The closeout baseline is master commit `38fa34e0f7287dd592249a34c7c1a27934bac349`, which merged PR #285 and closed Issue #200.

Repository-authoritative evidence already passed for that baseline:

- Delivery Contract
- seedless Supabase migrations `0001` through `0033`
- real Moderation, Privacy, and Audit recovery drills
- Linux authoritative map-close
- Windows map-close compatibility
- published-return recovery for Engagement, Activity, Feed, Inbox, queues, Archive, identity restore, and immutable evidence sealing

The machine-readable state is `contracts/zhipanda-v1-delivery-closeout.v1.json`. Validate it with:

```bash
node scripts/release/check-zhipanda-v1-delivery-closeout.mjs
node --test scripts/release/tests/zhipanda-v1-delivery-closeout.test.mjs
```

The release-test glob automatically includes the closeout tests. No independent certification system is introduced.

## Necessary remaining evidence

Only the following external evidence may advance the contract from `in-progress`:

1. Run the existing Extended gate against approved staging services using repository or environment secrets. Do not copy credentials, URLs containing credentials, user payloads, ciphertext, or signed references into evidence.
2. Obtain final Web and API Vercel Preview results after the provider account build-rate limit clears.
3. Record an accountable GO or NO-GO decision with owner, UTC decision time, candidate version, candidate commit SHA, immutable evidence SHA-256 identity, reason, rollback-switch inventory, and the 30-day effective-follow-return measurement owner.

These requirements are necessary for Issue #201. They are not required to merge Issue #200 and must not be represented as already complete.

## Decision procedure

Before recording `go`:

- change every closed-loop domain status to `passed` only after production-like staging evidence covers that domain;
- change every final gate status to `passed` and reference its artifact or GitHub Actions run without embedding secrets;
- change every external requirement status to `passed`;
- populate every launch-decision field;
- retain the complete rollback-switch inventory;
- set the contract status to `complete`;
- rerun the default, Extended, Linux, Windows, browser/mobile/WCAG, published-return, migration, security, privacy, and immutable-evidence checks from a clean candidate.

A `no-go` decision also requires an owner, UTC time, version, candidate SHA, immutable evidence identity, and reason. A NO-GO does not authorize production mutation and must preserve the evidence and rollback plan for the next candidate.

## Safety boundary

The repository closeout contract records evidence and a decision. It does not deploy production, change DNS, modify secrets, write production databases, activate queues or email, or alter public release pointers. Those actions require the approved launch procedure and explicit authority outside this implementation PR.

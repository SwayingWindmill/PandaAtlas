---
version: 2
slug: "app-locale-prototype-fan-v07-review-page-tsx"
primary_target: "app/[locale]/prototype/fan-v07-review/page.tsx"
related_targets: ["app/[locale]/prototype/fan-v07-review/pandas/page.tsx","app/[locale]/prototype/fan-v07-review/families/page.tsx","app/[locale]/prototype/fan-v07-review/moments/page.tsx","app/[locale]/prototype/fan-v07-review/me/page.tsx","app/[locale]/prototype/fan-v07-review/review-shell.tsx","app/[locale]/prototype/fan-v07-review/review.module.css"]
---

# Fan V0.7 recovered subpage review

## Scope and mode

Visitor mode: **Design review / historical comparison**.

This surface restores the last recoverable V0.7 fan-facing subpage concepts into a current Next.js implementation so they can be visually compared before V8 redesign work begins.

## Audience and job

The immediate audience is the product/design reviewer, not production visitors. The job is to answer: which V0.7 information structures still deserve to survive into V8?

## Preserved V0.7 theses

- Panda Directory: photography and a Spotlight panda stay more important than filter chrome.
- Families: story and family photography introduce relationships before a precise lineage tool.
- Moments: domain events become a browseable year/month chronology.
- My Pandas: favorites, sightings, visits, notifications and games converge into one private return space.

## Constraints

- Do not restore retired V1 adapters or obsolete animation/map dependencies.
- Current public data determines counts and factual content.
- Historical open-license image fixtures may restore composition only and remain isolated from production PublicRead.
- Never substitute another panda's photo for a panda without review media.
- My Pandas review must not imply real account state; personal-number areas use visual placeholders.
- This review should remain visibly distinct from the V8 home so reviewers can judge the old structures before redesign.

## Next decision

After review, promote only the useful information architecture into dedicated V8 surfaces and apply the current typography, photography direction, Motion rules and Impeccable polish there rather than continuously polishing this historical review.

# Local Panda Research Vault

This directory is the local-first research layer for Panda Atlas. It is intentionally broader than the current website and publication contracts. Records may be incomplete, conflicting, anecdotal, historic, or unsuitable for public release. Nothing in this directory is automatically promoted to production.

## Purpose

Capture as much traceable giant-panda information as practical before deciding what the future product should expose. The vault accepts:

- identity, aliases, name meanings, transliterations, and external identifiers;
- birth, death, sex, parentage, offspring, siblings, and other relationships;
- institutions, current and historic locations, transfers, returns, quarantine, and public debuts;
- health, veterinary care, reproduction, growth measurements, and husbandry training;
- personality, habits, preferences, keeper observations, enrichment, vocalisations, and other anecdotes;
- appearance and distinguishing features useful for individual identification;
- research, conservation, diplomacy, cultural context, public events, and notable milestones;
- photographs, video, livestream, archive, and rights leads without assuming reuse permission;
- unresolved claims, contradictions, secondary leads, and material that needs a primary source.

## Files

- `sources.jsonl` — one source page or dataset per line.
- `records/*.jsonl` — append-only research assertions and leads.
- `collection-plan.json` — coverage goals and collection priorities.

## Record rules

1. Every record must point to a source in `sources.jsonl`.
2. Preserve the source language and write a concise factual summary instead of copying long prose.
3. Use `evidence_level=direct` only when the source explicitly supports the assertion.
4. Use `evidence_level=secondary_lead` for news reports, enthusiast databases, search results, or other material that should later be reconciled with a primary source.
5. Set `publication_status=local_only` for every record in this vault.
6. Conflicting assertions are stored separately; do not overwrite either claim.
7. A media URL is only a discovery lead until its licence or authorization is reviewed.
8. Do not store copyrighted media bytes in Git.
9. Do not store sensitive wild-panda coordinates or current movement information.
10. Automated collection must respect robots rules, terms, rate limits, authentication, and technical blocking.

## Validation

```bash
npm run check:local-panda-research
npm run test:local-panda-research
```

The validator checks JSONL syntax, IDs, source references, timestamps, local-only publication status, and the controlled vocabularies used by the initial vault contract.

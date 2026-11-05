# 场馆动态 curation

`venue-news.json` is the editable source for 场馆动态. CI validates it on every
pull request; after merge the `curation.content` batch writes it into the
database ([content entry](../../../docs/runbooks/content-entry.md)). It ships
empty: add nothing that is not in an institution's own announcement.

```json
{
  "id": "2026-11-05-example-enclosure",
  "status": "draft",
  "institutionSlug": "<from data/curation/institutions>",
  "kind": "enclosure | schedule | closure | arrival | departure | event | other",
  "headline": "<the announcement's own headline, verbatim>",
  "pandaSlugs": ["<panda slug>"],
  "sourceUrl": "https://<the institution's announcement page>",
  "sourcePublisher": "<the institution or its official account>",
  "publishedOn": "YYYY-MM-DD",
  "updatedAt": "YYYY-MM-DDTHH:MM:SS+08:00"
}
```

Rules:
- Official sources only (the institution's site or verified official account). No fan posts, media reports or reposts.
- `headline` is the source's own wording. No commentary, no paraphrase that adds judgment.
- `updatedAt` is when the entry was last checked against the source.
- Set `status` to `published` after you have opened `sourceUrl` and it matches. One person checking is enough.
- Give the file a new `version` whenever its content changes.

```
python3 scripts/curation/validate_venue_news.py
```

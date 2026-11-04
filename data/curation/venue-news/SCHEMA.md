# 场馆动态 curation

`venue-news.json` is the editable source for 场馆动态. Production has no admin
back office, so editing this file and generating a migration is how entries are
added. It ships empty: add nothing that is not in an institution's own
announcement.

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
- Set `status` to `published` only after a second person has opened `sourceUrl`.

Generate the migration with:

```
python3 scripts/curation/build_venue_news_migration.py 00NN
```

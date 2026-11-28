# 海外大熊猫状态 curation (归国熊猫)

`overseas-status.json` is the editable source for the 归国熊猫 page. CI validates
it on every pull request; after merge the `curation.content` batch writes it into
the database ([content entry](../../../docs/runbooks/content-entry.md)). It ships
empty: add nothing that is not in an official announcement.

```json
{
  "status": "draft",
  "pandaSlug": "<panda slug>",
  "stage": "abroad | return_announced | in_transit | quarantine | returned",
  "institutionSlug": "<where the panda is now: overseas home, or quarantine base once back>",
  "expectedReturn": { "on": "YYYY | YYYY-MM | YYYY-MM-DD", "precision": "year | month | day" },
  "returnedOn": "YYYY-MM-DD",
  "sourceUrl": "https://<the announcement>",
  "sourcePublisher": "<publisher>",
  "updatedAt": "YYYY-MM-DDTHH:MM:SS+08:00"
}
```

Rules:
- One entry per panda. `expectedReturn` is optional and only as precise as the announcement.
- `returnedOn` is required for `returned`, allowed for `quarantine`, forbidden otherwise.
- Sources: 中国大熊猫保护研究中心, 国家林草局, the overseas zoo, or a verified official account. No fan posts or reposts.
- `updatedAt` is when the entry was last checked against the source.
- Set `status` to `published` after you have opened `sourceUrl` and it matches. One person checking is enough.
- Give the file a new `version` whenever its content changes.

```
python3 scripts/curation/validate_overseas_status.py
```

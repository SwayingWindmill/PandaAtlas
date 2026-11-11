# 比一比 curation

`comparisons.json` is the editable source for 比一比 on 发现: pairs of pandas we publish side by side,
each with a title and one line on what to look at. Fans do not pick the pair. CI validates the file on
every pull request; after merge the `curation.content` batch writes it into the database
([content entry](../../../docs/runbooks/content-entry.md)). It ships empty.

```json
{
  "id": "2026-11-11-he-hua-he-ye",
  "status": "draft",
  "title": "<what the pair is, 16 characters or fewer>",
  "dek": "<one line on what tells them apart, 30 characters or fewer>",
  "pandaSlugs": ["<panda slug>", "<panda slug>"],
  "updatedAt": "YYYY-MM-DDTHH:MM:SS+08:00"
}
```

Rules:
- Exactly two pandas, both published, and not the same panda.
- `title` and `dek` state only what the 比一比 page shows from published records (birth, family, place, features with their sources). No rumour and no ranking of which panda is nicer.
- `updatedAt` is when the entry was last checked against the two pandas' pages.
- Set `status` to `published` after you have opened the comparison in the app and it reads true. One person checking is enough.
- The newest entries come first on 发现. Give the file a new `version` whenever its content changes.

```
python3 scripts/curation/validate_comparisons.py
```

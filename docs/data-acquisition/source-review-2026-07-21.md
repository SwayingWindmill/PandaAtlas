# Reviewed acquisition sources — 2026-07-21

Issue: #89

## Wikimedia Commons Action API

Decision: `approved`

- API endpoint: `https://commons.wikimedia.org/w/api.php`
- Allowed path: `/w/api.php`
- Intended operation: exact-title `prop=imageinfo` lookup with a filtered `extmetadata` field list.
- User-Agent: descriptive `PandaAtlasBot` identifier with a repository contact URL. Browser User-Agent impersonation is prohibited for this source.
- Concurrency: one request at a time.
- Rate: at most six requests per minute for this adapter.
- On 429 or a throttling instruction: stop and apply backoff; do not distribute requests across identities.
- Media reuse: determined from each file's own metadata. API availability does not imply that a file is reusable.
- Original media bytes are not downloaded by the metadata adapter.

Reviewed policy material:

- `https://foundation.wikimedia.org/wiki/Policy:Wikimedia_Foundation_User-Agent_Policy/en`
- `https://foundation.wikimedia.org/wiki/Policy:Wikimedia_Foundation_API_Usage_Guidelines/en`
- `https://www.mediawiki.org/wiki/API:Imageinfo`
- `https://www.mediawiki.org/wiki/Extension:CommonsMetadata/en`
- `https://commons.wikimedia.org/robots.txt`

Review expires: 2027-01-21, or earlier if Wikimedia changes the applicable API policies.

## Zoo Atlanta public pages

Decision: `permission-required`

Zoo Atlanta's current Terms of Use state that users may not frame, mirror, scrape, or otherwise copy any portion of the site without express prior written authorization. PandaAtlas may retain existing manually reviewed citations, but no live automated adapter may fetch Zoo Atlanta pages unless written authorization is recorded in a future source-specific review.

Reviewed material:

- `https://zooatlanta.org/privacy-policy/` (contains the current Terms of Use)
- `https://zooatlanta.org/robots.txt`

Media reuse: prohibited unless the individual asset has a separate reusable license or Zoo Atlanta supplies written permission.

Review expires: 2027-01-21, or earlier if the Terms of Use change.

## Fu Bao current-location research

Decision: `manual-review-required`

The existing curation row needs a current official residency source and a fresh verification date. Search results and news reports are discovery leads only. No automated adapter is approved until PandaAtlas identifies a primary institutional or government source, reviews its terms and robots policy, and records the exact current-location assertion.

Live fetch: disabled.

Review expires: 2026-10-21.

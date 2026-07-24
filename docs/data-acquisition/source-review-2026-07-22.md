# Reviewed acquisition sources — 2026-07-22

Issues: #89, #98

This document supersedes `source-review-2026-07-21.md` as the review document bound by `data/acquisition-sources/registry.json`. Earlier decisions are retained below, followed by the first official institutional panda-profile cohort review.

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

Zoo Atlanta's Terms of Use reviewed on 2026-07-21 state that users may not frame, mirror, scrape, or otherwise copy any portion of the site without express prior written authorization. PandaAtlas may retain existing manually reviewed citations, but no live automated adapter may fetch Zoo Atlanta pages unless written authorization is recorded in a future source-specific review.

Reviewed material:

- `https://zooatlanta.org/privacy-policy/` (contains the Terms of Use reviewed for this decision)
- `https://zooatlanta.org/robots.txt`

Media reuse: prohibited unless the individual asset has a separate reusable license or Zoo Atlanta supplies written permission.

Review expires: 2027-01-21, or earlier if the Terms of Use change.

## Fu Bao current-location research

Decision: `manual-review-required`

The existing curation row needs a current official residency source and a fresh verification date. Search results and news reports are discovery leads only. No automated adapter is approved until PandaAtlas identifies a primary institutional or government source, reviews its terms and robots policy, and records the exact current-location assertion.

Live fetch: disabled.

Review expires: 2026-10-21.

## Smithsonian National Zoo panda pages

Reviewed: 2026-07-22

Decision: `approved`

### Why this is the first institutional cohort

The Smithsonian National Zoo cohort already overlaps 13 records in the current 809-row inventory:

- Bao Li
- Qing Bao
- An An
- Qing Qing
- Jia Mei
- Tian Tian
- Mei Xiang
- Tai Shan
- Bao Bao
- Bei Bei
- Xiao Qi Ji
- Ling Ling (Smithsonian)
- Hsing Hsing

The approved pages provide a small, coherent institutional batch rather than a broad site crawl. They contain current-pair identity and parentage facts plus a bounded historical timeline for the Smithsonian panda program.

### Allowed URLs

Only exact HTTPS GET requests to these paths are approved:

- `https://nationalzoo.si.edu/animals/giant-panda-faqs`
- `https://nationalzoo.si.edu/animals/history-giant-pandas-zoo`
- `https://nationalzoo.si.edu/animals/giant-panda`

Query-string discovery, site search, news archive crawling, sitemap crawling, media endpoints, webcams, forms, ticketing, donation, account, and API paths are outside the review.

### Terms and content-use boundary

The Smithsonian Terms of Use apply to Smithsonian museum and program websites. Content not marked CC0 is limited to personal, educational, and other non-commercial uses consistent with fair-use principles, requires source citation and linking when possible, and cannot be used commercially without permission.

PandaAtlas approval is therefore narrower than copying Smithsonian content:

- Extract explicitly stated factual values into field-level candidates.
- Preserve the exact source URL and evidence hash.
- Cite and link to the Smithsonian page in any accepted curation result.
- Do not reproduce article prose, page structure, images, video, logos, or other expressive content.
- Do not imply Smithsonian endorsement.
- Do not use fetched content for model training or fine-tuning.
- Do not use the source as generative-AI input; the adapter must be a deterministic parser that emits reference candidates only.
- Do not download media bytes. Media remains governed by asset-specific rights and is outside this source approval.

### Robots and content signals

A descriptive `PandaAtlasBot` request to `https://nationalzoo.si.edu/robots.txt` returned HTTP 200 on 2026-07-22 with no redirect. The current general-user-agent section:

- allows `/` except for listed administrative, account, search, archive, oEmbed, API, and query-pattern exclusions;
- declares `search=yes`;
- declares `ai-train=no`;
- declares `use=reference`;
- separately blocks named third-party crawler identities including GPTBot and several other AI or indexing bots.

The three approved `/animals/` paths are not disallowed. PandaAtlas must identify itself as `PandaAtlasBot`; it must not present itself as GPTBot, a browser, or another crawler identity. Any change that disallows the approved paths, disallows PandaAtlasBot, changes `use=reference`, or broadens the no-use signals immediately suspends live acquisition pending a new review.

### Access behavior observed on 2026-07-22

Using the descriptive policy-review User-Agent, each approved page returned HTTP 200, remained on the requested URL, and returned `text/html; charset=UTF-8`:

| Path | Bytes | Body SHA-256 |
| --- | ---: | --- |
| `/animals/giant-panda-faqs` | 157,153 | `f2dd362d69cbad2c36ab3dd64a406625dcc14be83b6141efaff3a3c897eca816` |
| `/animals/history-giant-pandas-zoo` | 131,786 | `d6b5141b91c40c3c02e865a2319a4b86af57464762a87098bc2868519b0d82d8` |
| `/animals/giant-panda` | 151,165 | `1ca7a6faf4439ff9540ae9370bccca6e8682ea1c37719db9c541b4e8df9ddaf9` |

Identity and timeline facts were present in the returned HTML. Authentication, cookies, a browser-rendered session, and JavaScript execution were not required to read the reviewed facts.

These hashes are review observations, not immutable expected production hashes. A changed body must create a new evidence snapshot and field diff rather than failing solely because the review hash changed.

### Explicitly supported candidate fields

The first adapter may emit only facts explicitly stated by the approved pages:

- official English display name;
- sex when explicitly stated;
- birth date and its stated precision;
- named father and mother;
- stated birth institution or origin base;
- stated arrival, departure, return, birth, death, naming, and public-debut events;
- stated Smithsonian habitat or Smithsonian residency interval;
- explicitly stated relationships among Smithsonian pandas.

The source may support, among other reviewed examples:

- Bao Li and Qing Bao names, birth dates, parents, source bases, and current Smithsonian habitat;
- Mei Xiang, Tian Tian, Tai Shan, Bao Bao, Bei Bei, and Xiao Qi Ji program events;
- Ling Ling and Hsing Hsing arrival and death events;
- the 2023 departure of Mei Xiang, Tian Tian, and Xiao Qi Ji;
- the 2024 arrival and 2025 public debut of Bao Li and Qing Bao.

### Facts that must remain unknown or separately sourced

The adapter must not infer or fill:

- Chinese characters from English romanization or English name meanings;
- a current Chinese facility after departure unless the page explicitly identifies the facility and effective date;
- parent identity from existing curation fields when the page does not state the relationship;
- exact birth time when only a date is stated;
- current life status from the absence of a death statement;
- current residency from historical arrival or departure language alone;
- media identity, authorship, license, or reuse rights from page images;
- facts found only in embedded social media, video captions, third-party links, or client-side requests outside the approved paths.

Conflicts with current trusted values remain contradictions for curator review and never overwrite trusted data.

### Request policy

- Engine: deterministic public-HTTP adapter; no browser rendering.
- Method: HTTPS GET only.
- User-Agent: `PandaAtlasBot/0.1 (https://github.com/SwayingWindmill/PandaAtlas; official-source evidence)` or a later descriptive version retaining the repository contact URL.
- Accept: `text/html`.
- Authentication and cookies: none.
- Browser impersonation: prohibited.
- Concurrency: one request per host.
- Rate: at most two requests per minute.
- Timeout: 30 seconds.
- Redirects: at most one same-host redirect; cross-host redirect stops the run.
- Successful response: HTTP 200 and an HTML content type.
- 429: stop the run and honor `Retry-After`; do not retry in the same run.
- 401, 403, 404, 407, 409, 451, CAPTCHA, challenge page, consent wall, or authentication prompt: stop and require source review.
- 500–599: at most one retry after 60 seconds, then stop.
- Parser drift, missing page title, missing expected reviewed section, unexpected content type, or body-size collapse: preserve evidence, emit no facts, and require review.
- Do not rotate proxies, accounts, cookies, User-Agents, or source identities.

### Review material

- `https://www.si.edu/termsofuse`
- `https://nationalzoo.si.edu/robots.txt`
- `https://nationalzoo.si.edu/animals/giant-panda-faqs`
- `https://nationalzoo.si.edu/animals/history-giant-pandas-zoo`
- `https://nationalzoo.si.edu/animals/giant-panda`
- `https://nationalzoo.si.edu/about/contact-us`

Review expires: 2026-10-22, or immediately if the terms, robots content signals, host, approved paths, or access behavior changes.

## Tokyo Zoo Net panda pages — fallback review

Reviewed: 2026-07-22

Decision: `manual-review-required`

Tokyo Zoo Net is a strong official factual fallback for Ueno panda history. Its official pages explicitly cover identities, sex, births, parentage, returns, deaths, and Ueno program history, including Ri Ri, Shin Shin, Xiang Xiang, Xiao Xiao, Lei Lei, and earlier Ueno pandas.

However, this source is not approved for live automated acquisition in this review:

- `https://www.tokyo-zoo.net/robots.txt` returned HTTP 404 during the review, so there is no current root robots policy to bind an automated adapter.
- The site's published policy prohibits unauthorized reproduction of copyrighted material except where copyright law permits uses such as personal reproduction, quotation, school use, or other lawful exceptions.
- The policy does not explicitly authorize deterministic automated collection.
- The English pages are machine-translated and contain romanization inconsistencies, so identity matching requires additional curator attention.

Existing manually reviewed citations may remain. Future approval requires either a clearer automated-access policy or written permission, plus a new robots and access review. Until then:

- live fetch: disabled;
- allowed paths: none;
- request rate: zero;
- browser rendering and impersonation: prohibited;
- media reuse: not reviewed and not permitted by this source record.

Reviewed material:

- `https://www.tokyo-zoo.net/en/policy/index.html`
- `https://www.tokyo-zoo.net/en/privacy/index.html`
- `https://www.tokyo-zoo.net/robots.txt` (HTTP 404 on 2026-07-22)
- `https://www.tokyo-zoo.net/en/ueno/panda/history/index.html`
- `https://www.tokyo-zoo.net/en/topics/news/ueno/355_28750_2024-09-29.html`

Review expires: 2026-10-22, or earlier if Tokyo Zoological Park Society publishes a robots or automated-access policy.

## Chengdu Panda Base bounded bilingual fact pages — bounded approval

Reviewed: 2026-07-23

Decision: `approved`

The Chengdu Research Base of Giant Panda Breeding publishes matching Chinese and English international-cooperation pages, matching Chinese and English 2021 and 2017 newborn profile pages, and matching Chinese and English 2019 Denmark handover pages with a bounded set of named-panda facts. The reviewed pages state official Chinese and English names, aliases, pedigree numbers, exact or year-level birth facts, explicit sex and parent names, and dated breeding or transfer events. The pages are public, require no login, cookies, query parameters, browser execution, or form submission.

The root `robots.txt` returned HTTP 404 during review. No site terms page or automated-access prohibition was located. The site footer asserts copyright ownership. Approval therefore applies only to deterministic factual reference candidates from the eight exact pages below. It does not authorize copying prose, images, layout, video, downloadable files, search results, pagination, site indexes, mini-program endpoints, or unrelated news pages.

Approved source boundary:

- source ID: `chengdu-panda-base-international-cooperation`;
- adapter IDs: `chengdu-international-cooperation`, `chengdu-newborns-2021`, `chengdu-denmark-handover-2019`, and `chengdu-newborns-2017`;
- exact paths: `/cn/cooperate/international/`, `/en/cooperate/international/`, `/cn/culture/activities/2023-07-07/6594.html`, `/en/culture/activities/2023-09-19/8165.html`, `/cn/culture/activities/2023-07-07/6593.html`, `/en/culture/activities/2023-08-24/8081.html`, `/cn/culture/activities/2023-08-23/8079.html`, and `/en/culture/activities/2023-08-24/8080.html`;
- method: GET only;
- query strings: prohibited;
- authentication and cookies: prohibited;
- browser impersonation: prohibited;
- user agent: `PandaAtlasBot/0.1 (https://github.com/SwayingWindmill/PandaAtlas; official-source evidence)`;
- rate: at most one request per minute, with a source-specific minimum interval of 90 seconds, sequentially;
- redirects: at most one same-host redirect;
- content use: field-level identity, relationship, and event evidence only;
- media reuse: not approved from these pages;
- transport compatibility: only this source may use the reviewed curl HTTP/2 transport with a fresh connection per request; the command is an argument list without a shell, redirects remain disabled, certificate verification remains enabled, and HTTP status, content length, body-size, content-type, and semantic checks remain required.

Stop conditions:

- HTTP 401, 403, 404, 407, 409, 429, or 451;
- cross-host redirect, authentication request, consent wall, CAPTCHA, or challenge page;
- a new robots or terms policy that disallows the reviewed paths or PandaAtlasBot;
- missing bilingual headings, missing reviewed paragraphs, semantic disagreement between Chinese and English pages, non-HTML content, or body-size collapse.

Reviewed material:

- `https://www.panda.org.cn/cn/cooperate/international/`
- `https://www.panda.org.cn/en/cooperate/international/`
- `https://www.panda.org.cn/cn/culture/activities/2023-07-07/6594.html`
- `https://www.panda.org.cn/en/culture/activities/2023-09-19/8165.html`
- `https://www.panda.org.cn/cn/culture/activities/2023-07-07/6593.html`
- `https://www.panda.org.cn/en/culture/activities/2023-08-24/8081.html`
- `https://www.panda.org.cn/cn/culture/activities/2023-08-23/8079.html`
- `https://www.panda.org.cn/en/culture/activities/2023-08-24/8080.html`
- `https://www.panda.org.cn/robots.txt` (HTTP 404 on 2026-07-23)
- `https://www.panda.org.cn/cn/about/`
- `https://www.panda.org.cn/cn/service/ontact/`

Review expires: 2026-10-23, or immediately if access behavior, policy signals, host, paths, or page semantics change.

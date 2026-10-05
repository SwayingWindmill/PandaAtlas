# ZhiPanda public brand and copy contract

- **Status:** Current public brand and copy reference; the one-time migration inventory and checker are retired
- **Parent map:** #215
- **Applies to:** public Web surfaces, shared public communication, public metadata, and user-visible product identity

## 1. Brand boundary

The sole public product brand is:

- Chinese: **吱熊猫**
- English: **ZhiPanda**

`PandaAtlas` and `Panda Atlas` are retired public product names. They must not appear in public navigation, page titles, metadata, authentication and account journeys, Follow, Feed, Inbox, email identity, sharing identity, or primary public feature copy.

The repository may retain legacy identifiers when changing them would break a current compatibility contract or rewrite immutable history. Typical retained categories include:

- repository URLs and the current GitHub repository name;
- API and email compatibility headers;
- database, package, file, and internal namespace identifiers;
- crawler and worker User-Agent identities already covered by source review;
- immutable releases, reviewed batches, evidence, and historical decision records.

Retention is not approval for new use. Do not add a new legacy-brand identifier unless a current compatibility contract or immutable historical record requires it.

## 2. Audience and register

ZhiPanda is designed first for panda enthusiasts. Public copy should help people discover a panda, understand family and life history, see places and updates, follow a panda, and continue exploring.

The public register is:

- **warm:** friendly without becoming sentimental or promotional;
- **lively:** active verbs and clear invitations to explore;
- **curious:** supports discovery and understandable context;
- **concise:** puts the panda or user task before implementation detail;
- **non-childish:** no baby-talk, excessive cuteness, mascot narration, or decorative emoji language;
- **evidence-honest:** never invents personality, stories, counts, locations, certainty, or media.

Trust remains visible, but technical mechanisms belong in secondary source, method, data, or status areas. Primary public UI should not lead with projection, provider, delivery, schema, immutable-release, or internal workflow terminology.

## 3. Controlled bilingual vocabulary

Use the machine-readable terms as the default vocabulary when the underlying domain meaning matches.

| Concept | Chinese | English | Notes |
|---|---|---|---|
| product brand | 吱熊猫 | ZhiPanda | Never translate or respell the English brand |
| panda profile | 熊猫资料 | Panda profile | “档案” may remain in evidence-heavy or revision contexts |
| panda family | 熊猫家族 | Panda family | Use for public relationship exploration |
| journey | 生活足迹 | Life journey | Do not imply a precise transport route |
| place | 生活过的地方 | Places lived | Use when describing panda residency history |
| institution | 熊猫机构 | Panda institution | A public umbrella label; entity pages may use the institution’s formal type |
| follow | 关注 | Follow | Follow is the account relationship; do not reintroduce Saved Panda |
| activity | 熊猫动态 | Panda updates | Public activity generated from authorized published facts |
| source | 资料来源 | Sources | Keep specific source links and attribution available |
| verification | 最近核实 | Last checked | Means ZhiPanda checked the source and current interpretation on that date |
| partial data | 部分资料可用 | Some information available | State the missing scope where useful |
| unavailable data | 暂无可用资料 | Information unavailable | Do not silently substitute fixture or generated content |
| correction | 提交纠错 | Submit a correction | A contribution does not directly change published facts |

Context can require more precise domain terms. Precision wins over friendliness when the friendlier term would change meaning.

## 4. Primary-public-UI language to retire

The following expressions are implementation-facing or archive-console language and must not be introduced as primary headings, calls to action, or navigation labels:

- `PandaAtlas` / `Panda Atlas` as a product name;
- “structured result”, “structured task”, or “current task scope”;
- “optional visual layer” or “visualization enhancement”;
- “provider contract” as a primary user task;
- “public projection”, “delivery state”, “release identity”, or schema terminology outside data/method status areas;
- generic “trusted archive” positioning that makes archive operations the main public value proposition.

Existing feature-level occurrences are migration work for #219. This contract identifies the direction but does not redesign those pages.

## 5. Truth and safety constraints

Friendlier copy must not:

- invent a panda’s personality, preferences, emotions, story, or relationships;
- imply real-time location when the fact is only the last verified published record;
- turn a sequence of residences into a claimed transport route;
- hide tentative, disputed, superseded, partial, unavailable, or privacy-reduced data;
- replace source, verification, licensing, attribution, or correction access;
- use unreviewed, generated, unrelated, or placeholder panda media.

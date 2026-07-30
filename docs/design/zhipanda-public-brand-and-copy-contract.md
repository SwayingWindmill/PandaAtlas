# ZhiPanda public brand and copy contract

- **Status:** Accepted public-brand migration contract for #217
- **Parent map:** #215
- **Applies to:** public Web surfaces, shared public communication, public metadata, and user-visible product identity
- **Machine-readable contract:** `contracts/zhipanda-brand-migration.v1.json`

## 1. Brand boundary

The sole public product brand is:

- Chinese: **吱熊猫**
- English: **ZhiPanda**

`PandaAtlas` and `Panda Atlas` are retired public product names. They must not appear in public navigation, page titles, metadata, authentication and account journeys, Follow, Feed, Inbox, email identity, sharing identity, or primary public feature copy.

The repository may retain legacy identifiers when changing them would break a compatibility contract or rewrite immutable history. Every retained reference must be classified in the machine-readable inventory. Typical retained categories include:

- repository URLs and the current GitHub repository name;
- API and email compatibility headers;
- database, package, file, and internal namespace identifiers;
- crawler and worker User-Agent identities already covered by source review;
- immutable releases, reviewed batches, evidence, and historical decision records.

Retention is not approval for new use. A new legacy-brand reference is prohibited unless the inventory is deliberately updated with an owner, visibility classification, action, and rationale.

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

## 6. Inventory categories

Every repository legacy-name reference is classified as one of:

- `public-visible`: user-facing text that must migrate to ZhiPanda;
- `technical-compatible`: an active internal or external compatibility identifier retained deliberately;
- `historical`: immutable evidence, releases, reviewed records, or historical decisions that must not be rewritten;
- `undecided`: temporary triage only and forbidden in an accepted #217 inventory.

The inventory also records user visibility, migration owner, expected action, exact legacy-term counts, and rationale. Counts are intentional: adding or removing a reference makes the inventory stale and forces an explicit review.

## 7. Enforcement

Run:

```bash
npm run check:zhipanda-brand
```

The checker fails when:

- a repository text file contains a legacy term but has no inventory entry;
- an inventoried file gains or loses a legacy reference without an inventory update;
- an inventory entry is duplicated, malformed, missing from the repository, or classified as `undecided`;
- a public source path exposes `PandaAtlas`, `Panda Atlas`, or the retired `panda atlas` label outside an explicit non-public exclusion;
- required brand, tone, and controlled-vocabulary fields are removed from the contract.

The checker intentionally excludes its own source and the inventory file because both must name the legacy terms they enforce.

When #218 or #219 removes already-classified references, maintainers may run `node scripts/brand/check-zhipanda-brand.mjs --refresh-inventory`. Refresh updates counts and removes completed entries, but refuses every newly referenced file; new references require an explicit reviewed classification.

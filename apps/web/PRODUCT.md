# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

The primary public user is an ordinary panda fan browsing on desktop or mobile. They usually arrive because they care about a particular panda, want to recognize it, learn what is happening in its life, see family relationships and places, or discover another panda worth following.

Editors, reviewers and administrators exist as professional users, but their workflows belong to the admin product and must not determine the tone or hierarchy of the public experience.

## Product Purpose

ZhiPanda gives panda fans a trustworthy, continuously explorable world of named individual giant pandas. A fan should be able to start with one panda and naturally continue through its life moments, family, places, related pandas and personal collection.

Success means the public site is enjoyable enough to browse and revisit while remaining honest about what is known, uncertain, historical, stale or not yet published.

## Positioning

ZhiPanda is individual-first rather than article-first or institution-first: the named panda is the main unit of discovery. The public experience connects each individual to structured family, life-history, place and source information without making professional evidence machinery the main interface.

## Operating Context

- Bilingual public experience: Simplified Chinese and English.
- Public routes are served by the Next.js Web app.
- Authoritative public data comes from the active V2 Publication/PublicRead release.
- Search, Pandas, Families, Map, Moments and My Pandas are the main continuation surfaces.
- The same panda can have incomplete, historical or no-image public records; those are normal product states.

## Capabilities and Constraints

- Public pages must use active V2 PublicRead data for factual claims and published counts.
- Research/acquisition records are not public until curated and published.
- A panda image must belong to that panda and must be publishable under the current media state; never substitute another panda.
- Current, historical and last-known/stale locations must remain distinguishable.
- Confirmed, tentative, disputed and superseded relationships must not be visually collapsed into one certainty level.
- Date precision may be day, month, year or unknown; the UI must preserve that precision rather than invent dates.
- Sensitive wild-panda locations must not be exposed as precise coordinates.
- Partial profiles must remain useful without filling the page with empty-field rows.
- Public pages must work across keyboard, touch, reduced motion, narrow mobile screens and zoomed desktop use.

## Brand Commitments

- Product name: 吱熊猫 / ZhiPanda.
- Fan-first, panda-first, individual-first.
- Public copy is warm, concrete and concise rather than institutional or database-like.
- Real panda photography is a major part of the public identity when legitimate media is available.
- Trust is a product capability: sources and evidence remain reachable, but they do not compete with the panda for first attention.

## Evidence on Hand

- Current product requirements: `docs/product/panda-atlas-public-beta-prd.md`.
- Fan-first V0.7 design history: `docs/design/zhipanda-public-experience-v0.7.md`.
- Current V0.8 Home direction: `docs/design/zhipanda-public-experience-v0.8-home.md`.
- Recovered V0.7 prototype source: `docs/prototypes/fan-v07-recovered/`.
- Current V0.8 review prototype: `app/[locale]/prototype/fan-v08/`.
- Active UI tokens and styles: `styles/tokens.css`, `styles/typography.css`, `styles/registers.css` and related public styles.

Do not invent popularity rankings, visitor counts, real-time status, testimonials, media rights or completeness claims that the active release does not support.

## Product Principles

1. Start with a panda, not a database.
2. Make continuation effortless: panda → moment → family → place → another panda.
3. Incomplete truth is better than decorative completeness.
4. Trust must be reachable without dominating the fan experience.
5. Give fans a reason to return through moments, birthdays, updates and My Pandas.

## Accessibility & Inclusion

The public Web experience must preserve semantic heading order, visible focus, keyboard operation, useful alternative text, sufficient contrast, reduced-motion behavior, structured equivalents for spatial/relationship views, 200% zoom usability and a 320 CSS-pixel core journey.
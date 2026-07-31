# Panda Moments information architecture and interaction specification

Status: accepted design proposal for Wayfinder issue #232
Parent map: #230
Depends on: Panda Profile V2 design in #231
Implementation owner: #234

## 1. Decision

Panda Moments becomes ZhiPanda's public time-exploration surface for reviewed panda events and explicitly derived anniversaries.

It is not a news feed, social activity stream, real-time tracker, or editorial blog. It is a versioned, source-aware time navigator that lets a visitor:

1. discover what happened on a date or within a period;
2. browse events by panda, family, institution, place, region, event type, and state;
3. understand whether a date is exact, approximate, ranged, disputed, or unknown;
4. distinguish an event date from an announcement date, source publication date, and last verification date;
5. follow an event into Panda Profile V2, Family Stories, Lineage, Map, institution, place, and source pages;
6. share and return to the same view through stable URL state;
7. complete every core task without JavaScript or motion.

Working concept: **Panda Almanac / 熊猫年鉴**.

The interface combines an almanac's pleasure of date discovery with a research timeline's precision. It should feel lively and rewarding while refusing the common failure modes of calendar dashboards: tiny event dots with no context, repeated generic cards, hidden filters, and motion that obscures chronology.

## 2. Design inputs and pinned versions

Reviewed on 2026-07-31:

- Impeccable: `pbakaus/impeccable@32930818a109fafa87199babe92fa8e530cff5d3`
- Taste Skill: `Leonxlnx/taste-skill@e988add20dab0fa97d7a76781c48961c8184288e`

Impeccable passes used:

- `shape`: task hierarchy, view roles, event ownership, URL state, and source/date separation;
- `craft`: calendar, timeline, state-lab, desktop, and mobile prototypes;
- `critique`: anti-dashboard, anti-news-feed, duplicate-event, and date-honesty review;
- `adapt`: narrow screens, bilingual labels, long participant lists, dense months, and no-JavaScript forms;
- `harden`: no results, partial coverage, planned, cancelled, disputed, superseded, approximate, unknown-date, and delivery-error states;
- `audit`: accessibility, responsive overflow, motion, source visibility, and derived-anniversary review;
- `animate`: only chronology, view transitions, and selected-date orientation;
- `polish`: typographic rhythm, event markers, filter language, source copy, and implementation handoff.

Taste Skill design read:

> A bilingual natural-history almanac crossed with a trustworthy temporal search tool. It may be expressive in the date and chronology layers, but evidence, filters, and state language remain calm, explicit, and inspectable.

Selected design dials:

- `DESIGN_VARIANCE: 8`
- `MOTION_INTENSITY: 5`
- `VISUAL_DENSITY: 7`

Rationale:

- Variance 8 permits a memorable date stage, time ribbon, calendar rhythm, and non-repeating event compositions while keeping the query model conventional.
- Motion 5 permits purposeful transitions between month, period, and selected event. It does not permit scroll hijacking, animated clocks, parallax, or continuously moving timelines.
- Density 7 is necessary because date precision, event state, participants, place, and evidence often need to appear together. Density is concentrated in filters and evidence, not spread across every surface.

## 3. Current public-data audit

The reviewed release inspected for this design is `2026.07.24.2`, public schema `1.2.0`.

The release manifest contains 43 events. The current panda-centric API exposes 60 event references because shared events are repeated inside each participant's panda record.

### 3.1 Canonical event requirement

Panda Moments must operate on unique event IDs, not flattened panda event arrays.

Observed baseline:

- 43 unique events;
- 60 panda-to-event references;
- 29 birth event references;
- 14 transfer references;
- 8 public-debut references;
- 6 arrival references;
- 2 naming references;
- 1 observation reference;
- 57 completed references;
- 3 announced references;
- current public dates are all day precision.

Shared-event examples include:

- the 2024 Zoo Atlanta return with four participants;
- the 2023 Smithsonian departure with three participants;
- the 2020 Smithsonian return announcement with three participants;
- Ueno pair and twin events with two participants;
- Chengdu twin or paired birth events with two participants.

The public projection must emit one canonical moment per event ID with participant membership, rather than four indistinguishable cards for one four-panda transfer.

Event-ID deduplication is necessary but not permission to merge separate event IDs. The current release represents 喜伦 and 雅伦's 2016 births and public debuts as separate event records with the same date and sources. Panda Moments may present them inside a related date cluster, but they remain distinct events unless the reviewed public projection supplies an explicit `eventGroupId` or replacement canonical event. Same date, type, place, source, or family context is not sufficient evidence for automatic merging.

### 3.2 Source-date coverage

Eighteen public sources support the current event set. Nine include a source publication date and nine do not.

The interface must therefore treat source publication date as optional and must never copy the event date into the publication-date field.

### 3.3 Current contract limitations

The current public event contract provides:

- event ID;
- controlled event type;
- event status;
- event date and day/month/year precision;
- participant IDs;
- from/to facility or coarse location;
- source IDs;
- current-residency-change flag.

Panda Moments requires additional capabilities:

- canonical event collection independent of panda records;
- explicit reviewed event grouping for related but distinct event IDs;
- explicit announcement date;
- date ranges, approximate dates, and unknown dates;
- separate occurrence status and conclusion state;
- supersession links;
- localized reviewed summaries;
- institution/place normalization;
- family-story membership;
- anniversary projection metadata;
- event-level revision and coverage state.

## 4. Experience principles

### 4.1 Time is the primary navigation

The first question is not “Which content card should I open?” It is:

- What happened today?
- What happened in this month?
- What happened during this period?
- What happened to this panda, family, institution, or place?

Date and period controls remain the dominant orientation layer.

### 4.2 Calendar, timeline, and list have different jobs

The three views are not cosmetic tabs over the same layout.

- Calendar answers **when within a month or day**.
- Timeline answers **what changed across a longer period**.
- List answers **what exactly matches this query**, supports dense evidence, pagination, assistive technology, and no-JavaScript use.

All three consume the same canonical query and event set.

### 4.3 One event, many participants; related events remain distinct

A shared event ID appears once.

Participant display rules:

- show up to four named participants directly;
- summarize additional participants with an explicit count;
- provide a structured participant list in the event detail;
- link each participant to Panda Profile V2;
- retain participant order from the public projection when editorially meaningful, otherwise use a deterministic stable sort;
- never infer family membership from co-participation.

Related-event rules:

- separate event IDs remain separate records;
- an explicit reviewed event-group ID may cluster related records under one date or narrative heading;
- a cluster reports both the number of event records and the number of participants;
- calendar day counts use event records unless the UI explicitly labels a group count;
- same date, source, type, participant relationship, or place never triggers heuristic merging;
- supersession replaces through an explicit event link, not similarity matching.

### 4.4 Dates have separate meanings

Every date belongs to one explicit role:

- event occurrence date or range;
- announcement date;
- source publication date;
- last verification date;
- anniversary occurrence date generated from an original event.

The interface never labels these collectively as “date”.

### 4.5 Anniversaries are derived, not sourced events

A birthday reminder is not a new event record.

An anniversary occurrence must expose:

- `occurrenceKind = anniversary`;
- the original event ID;
- the anniversary year;
- the derived age when the original year is precise and undisputed;
- the derivation rule;
- the original event state and date precision;
- a link to the original birth event and sources.

Rules:

- day-precision confirmed births may create exact birthday reminders;
- month-precision births may create a birthday-month reminder, not a specific day;
- year-precision births do not create a day or month reminder;
- approximate or disputed dates do not create an exact age without explicit uncertainty language;
- a superseded birth conclusion cannot remain the active anniversary source;
- leap-day handling must be documented by the public projection and visible in metadata;
- anniversary reminders never increment event counts.

### 4.6 Evidence appears at the point of uncertainty

Routine completed events use concise date, type, status, participant, and place signals.

Planned, cancelled, disputed, approximate, superseded, restricted, or source-changed records expose additional explanation adjacent to the affected field and in a native evidence disclosure.

### 4.7 Visual overview is optional

A decade ribbon, event-density strip, or year distribution may assist orientation.

It is optional and must not become the only way to discover a period. The structured timeline and list remain complete.

## 5. Canonical route and view roles

The proposed localized route is:

- `/{locale}/moments`

### 5.1 Default landing state

Default behavior uses the viewer's current calendar month only as a presentation default, not as persisted personal data.

The landing state includes:

- current date stage;
- reviewed events or derived anniversaries for the selected day;
- month calendar;
- this-month event summary;
- quick routes to timeline and list;
- public release and coverage summary.

When the current month has no published events or anniversaries, the page still provides period navigation and recent reviewed moments.

### 5.2 Calendar view

Purpose:

- browse one month;
- select a day;
- distinguish source events from derived anniversaries;
- see dense-day counts without duplicate participant cards;
- move to previous/next month;
- jump to a date.

Desktop:

- month title and navigation sit above a full month field;
- eventful days have text labels or meaningful markers, not color-only dots;
- selected day opens a persistent day rail beside or below the calendar;
- days with many moments display a count and first meaningful label;
- anniversaries use a distinct textual marker.

Mobile:

- do not compress a seven-column calendar into unreadable cells;
- show a compact month strip and an ordered list of eventful days;
- retain previous/next month and date jump;
- selected-day content follows immediately after the selected date;
- no horizontal swipe is required.

No-JavaScript:

- month and day controls are GET forms or links;
- selected day is server rendered;
- browser history and share URLs work without enhancement.

### 5.3 Timeline view

Purpose:

- understand change over years or decades;
- compare event clusters and quiet periods;
- follow institution, family, panda, or place history;
- see announced plans versus completed outcomes.

Desktop:

- optional year-density ribbon provides orientation;
- event sequence is a semantic ordered list;
- large year markers form the chronological spine;
- multi-participant events form one grouped moment;
- place transitions may use a route line, but the structured from/to text is primary.

Mobile:

- strict single-column ordered list;
- year markers remain in normal flow;
- participant links wrap naturally;
- evidence disclosures do not create nested cards;
- timeline never relies on sticky columns.

### 5.4 List view

Purpose:

- exhaustive result inspection;
- keyboard and screen-reader efficiency;
- dense evidence comparison;
- no-JavaScript fallback;
- pagination and export-compatible query semantics.

The list presents one row or article per canonical event with:

- date or range and precision;
- event type;
- occurrence status;
- conclusion state;
- participants;
- place or movement;
- source count;
- last verified date;
- event detail link.

The list is not a compressed copy of the calendar.

### 5.5 Selected-event detail

A selected event may appear as:

- an anchored server-rendered section on narrow screens and no JavaScript;
- an enhanced side sheet on larger screens;
- a future canonical event-detail route when #234 determines that indexing or deep linking requires it.

Core detail includes:

- stable event ID;
- localized reviewed title and summary when available;
- event date or range and precision;
- announcement date when applicable;
- occurrence status;
- conclusion state;
- participants;
- from/to entity links;
- related family story or profile links;
- source list and publication dates;
- last verification date;
- supersession or dispute information;
- release and schema version.

The URL must identify the selected event even when a side sheet is used.

## 6. Filter and query model

### 6.1 Primary filters

- event type;
- panda;
- family story or family collection;
- institution;
- place;
- region;
- period or selected date;
- occurrence status;
- conclusion state;
- date precision;
- source access state where useful.

### 6.2 Filter behavior

- filters use controlled identifiers, not localized labels;
- visible labels are localized;
- multi-select filters serialize deterministically;
- applying filters is an explicit action in no-JavaScript mode;
- enhanced clients may apply immediately only when browser history and focus behavior remain predictable;
- filter counts reflect unique events, not panda-event references;
- anniversaries can be included, excluded, or isolated through an explicit occurrence-kind filter;
- clearing filters preserves the chosen view and period when possible;
- empty results never silently broaden the query.

### 6.3 Search

Optional text search covers reviewed public fields only:

- localized event titles and summaries;
- panda names and aliases;
- institution and place names;
- controlled event labels.

It does not search unpublished review notes, local research, or private metadata.

## 7. Stable URL contract

Canonical query parameters proposed for #234:

- `view=calendar|timeline|list`
- `date=YYYY-MM-DD`
- `month=YYYY-MM`
- `from=YYYY-MM-DD`
- `to=YYYY-MM-DD`
- `event=<stable-event-id>`
- `event_type=<controlled-code>[,<controlled-code>...]`
- `panda=<stable-id-or-canonical-public-id>`
- `family=<stable-family-story-id>`
- `institution=<stable-institution-id>`
- `place=<stable-place-id>`
- `region=<controlled-region-code>`
- `occurrence_status=<controlled-code>[,...]`
- `conclusion_state=<controlled-code>[,...]`
- `precision=<controlled-code>[,...]`
- `occurrence_kind=event|anniversary|all`
- `sort=asc|desc`
- `cursor=<opaque-cursor>` for paginated list reads
- `q=<normalized-public-search>`

### 7.1 Parameter precedence

- `date` selects one day and implies calendar view unless `view` is explicit;
- `month` selects a month;
- `from` and `to` select a period and are primary for timeline/list;
- invalid combinations produce typed validation feedback and a recoverable form, not silent rewriting;
- event selection never removes active filters or period context;
- locale switching preserves all stable IDs and compatible query parameters;
- canonical URLs normalize parameter order and remove defaults.

### 7.2 Browser history

Use `pushState` for explicit user decisions:

- changing view;
- selecting a date;
- applying or clearing filters;
- selecting an event;
- changing month or period.

Use `replaceState` only for non-semantic normalization such as canonical parameter order.

Hover, focus preview, or transient animation state never enters browser history.

### 7.3 Return context

Links into Profile V2, Family Stories, institution, place, Lineage, and Map may include a compact return URL or a first-party context token when existing navigation policy permits it.

The destination must remain useful without that context.

## 8. Event taxonomy

### 8.1 Current controlled types

Current public codes:

- `birth`
- `arrival`
- `transfer`
- `return`
- `naming`
- `public_debut`
- `selection`
- `announcement`
- `observation`
- `death`

### 8.2 Display families

The UI groups types without replacing atomic codes:

- **Life**: birth, death;
- **Movement**: arrival, transfer, return;
- **Identity and public life**: naming, selection, public_debut, announcement;
- **Observation and research**: observation;
- future reviewed codes may cover growth, veterinary care, reproduction, maternal care, research milestones, or husbandry, but only through a versioned controlled public taxonomy.

Uncontrolled local-research category strings cannot become filters or public event codes directly.

### 8.3 Taxonomy metadata

Each public event type requires:

- stable code;
- localized short label;
- localized explanatory label;
- display family;
- icon or marker role when used;
- allowed location roles;
- allowed participant roles;
- whether it can change residency;
- whether anniversary projection is permitted;
- taxonomy version;
- deprecation and replacement metadata.

## 9. Date and precision model

### 9.1 Date roles

- `eventStart`
- `eventEnd`
- `announcementDate`
- `sourcePublishedAt`
- `lastVerifiedAt`
- `derivedOccurrenceDate`

Each role remains distinct in data and copy.

### 9.2 Precision vocabulary

Required public precision codes:

- `day`
- `month`
- `year`
- `approximate_day`
- `approximate_month`
- `approximate_year`
- `range_day`
- `range_month`
- `range_year`
- `unknown`

Implementation may normalize this into base precision plus approximation/range fields, but the rendered language must support all cases.

### 9.3 Rendering rules

- day: localized full date;
- month: localized month and year without invented day;
- year: year only;
- approximate: include explicit `约 / circa / approximately` wording;
- range: display both boundaries and each boundary precision;
- unknown: group under `日期未确定 / Date not determined`, never a fake epoch or placeholder date;
- source publication date remains absent when unavailable;
- machine-readable `<time>` is used only when the encoded value does not imply false precision.

### 9.4 Sorting rules

- exact and bounded dates sort by normalized start boundary;
- approximate dates use their public sort key but retain uncertainty labels;
- unknown-date events form an explicit final or separate group;
- superseded records are excluded from the default current view and available through state filters or event history;
- deterministic tie-breaking uses event ID after curated display order.

## 10. Event state model

The design rejects one overloaded status field.

### 10.1 Occurrence status

Describes what happened operationally:

- `planned`
- `completed`
- `cancelled`
- `unknown`

### 10.2 Publication or announcement state

Describes public communication:

- announcement date present or absent;
- a plan may be publicly announced without being completed;
- announcement is not a substitute for occurrence status.

### 10.3 Conclusion state

Describes evidence confidence and revision:

- `confirmed`
- `provisional`
- `disputed`
- `superseded`

### 10.4 Temporal relation

Derived relative to the selected or current date:

- `future`
- `today`
- `past`
- `historical`

`historical` may be a product grouping based on age or archive policy; it is not evidence confidence.

### 10.5 Compatibility mapping

The existing public status codes map provisionally as follows:

- `completed` -> occurrence completed, conclusion confirmed unless another conclusion state exists;
- `cancelled` -> occurrence cancelled;
- `disputed` -> conclusion disputed, occurrence unknown unless separately known;
- `announced` -> announcement exists; occurrence remains planned or unknown until explicit completion/cancellation is published.

#234 owns the migration and compatibility contract.

## 11. Information architecture

### 11.1 Date stage

The first viewport provides:

- selected date or period;
- concise coverage label;
- number of unique moments;
- number of anniversary reminders when included;
- active filter summary;
- calendar/timeline/list switch;
- primary previous/next period navigation.

The stage uses large date typography rather than a marketing hero image.

### 11.2 Filter field

Filters are visually integrated as a field or rail, not a dashboard card.

Desktop:

- primary filters visible;
- advanced filters in a native disclosure;
- active filters shown as removable text controls;
- result count and coverage state adjacent.

Mobile:

- a compact `筛选 / Filters` disclosure;
- selected filters summarized outside the disclosure;
- apply and clear actions remain reachable;
- opening filters does not trap focus in a client-only sheet in no-JavaScript mode.

### 11.3 Time ribbon

Optional orientation layer for timeline view:

- year or decade marks;
- event-density bars or ticks;
- selected period indicator;
- textual summary for screen readers;
- no hover-only values;
- no animated autoplay.

### 11.4 Moment composition

A moment contains:

- date and precision;
- event type;
- occurrence status;
- conclusion state when not confirmed;
- reviewed title or deterministic controlled fallback;
- participant links;
- place or movement summary;
- source count;
- event-detail action.

Composition varies by event kind:

- life events emphasize date and participants;
- movement events emphasize from/to path;
- naming and public-debut events emphasize public-life context;
- observations emphasize source and place;
- planned/cancelled/disputed events emphasize state and evidence.

Variation is structural, not random decoration.

### 11.5 Evidence and release center

The page footer or result summary includes:

- release ID;
- schema and taxonomy version;
- last successful delivery time;
- coverage scope;
- total unique event count;
- anniversary derivation policy link;
- source access explanation;
- revision/withdrawal behavior.

Each selected event retains its own source and revision detail.

## 12. Cross-surface journeys

### 12.1 Panda Profile V2

- event participants link to profile routes;
- profile timeline links back with `panda` and event/period state;
- selected event remains identifiable after return;
- anniversary reminders link to the original birth event in the profile or event detail.

### 12.2 Family Stories

- event detail may link to a reviewed family story when the event is explicitly a member of that story;
- co-participation alone does not create a family link;
- family filters use stable collection IDs.

### 12.3 Lineage

- birth and family-context events may offer `查看家族关系 / Explore lineage` when published relationship assertions exist;
- the event page does not infer parentage from participants;
- focused Lineage state uses stable panda IDs.

### 12.4 Map, place, and institution

- movement and place events link to normalized entities;
- coarse locations remain textual when no normalized public entity exists;
- Map links respect published coordinate precision;
- no exact location is inferred from an institution or source text;
- institution pages may link back to a filtered institutional timeline.

## 13. State designs

### 13.1 Complete

- query is fully served for its declared release scope;
- result count, release, and filters are visible;
- no claim of global historical completeness unless the release explicitly guarantees it.

### 13.2 Partial coverage

- results render normally;
- a persistent coverage statement explains the published subset;
- missing years or event families are not represented as zero activity;
- timeline density visualizations distinguish `no published records` from `confirmed no events` when possible.

### 13.3 Empty collection

Used when the release contains no public events for the requested surface.

- explain that no reviewed public events are available;
- preserve period navigation and source/release context;
- do not silently use local research or fixtures;
- provide links to profiles or entities only when supported by the query.

### 13.4 No results

Used when events exist globally but filters match none.

- show the active filter summary;
- identify the strictest filters where possible;
- offer explicit clear or edit actions;
- never broaden automatically;
- retain the requested URL.

### 13.5 Planned or announced

- show announcement date separately;
- label operational state as planned or unknown;
- do not write future movement as completed residence;
- source and last verification remain adjacent;
- when later completed or cancelled, explicit links connect the records or revisions.

### 13.6 Cancelled

- retain the announced plan as historical public record when publication policy allows;
- display cancellation date and source when available;
- do not let cancelled movement alter current residency;
- separate the planned destination from actual location.

### 13.7 Disputed

- mark the affected date, participant, place, or event conclusion directly;
- provide candidate values or assertions in evidence detail;
- exclude disputed anniversaries from exact birthday reminders by default;
- do not select a visually clean candidate without policy.

### 13.8 Superseded

- exclude from default current results;
- retain in event history and revision views;
- link to the replacing event or conclusion;
- derived anniversaries use only the active source event.

### 13.9 Approximate or unknown date

- approximate events may appear in timeline periods with explicit wording;
- unknown-date events live in an explicit separate group;
- exact calendar cells never contain unknown or year-only events;
- no fake machine-readable date is emitted.

### 13.10 Missing translation

- retain reviewed source-language title or controlled application label according to publication policy;
- show language state;
- never generate a translated summary;
- locale switching preserves filters and selected event.

### 13.11 Delivery unavailable or error

- distinguish no results from delivery failure;
- preserve the user's query in the retry URL;
- show last successful release when available;
- do not fall back silently to fixtures, stale local arrays, or local research;
- cached public release behavior follows the existing Public Content Envelope policy.

## 14. Visual direction

### 14.1 Relationship to Profile V2

Panda Moments shares the `Living Panda Passport` foundation:

- warm paper canvas;
- deep botanical ink;
- bamboo action color;
- persimmon chronology color;
- mineral blue for places;
- restrained plum for dispute and revision;
- expressive editorial display type plus bilingual sans body type;
- flat evidence disclosures and minimal nested surfaces.

It extends that foundation into a time-specific register called **Panda Almanac**.

### 14.2 Date typography

- selected day may use very large tabular or editorial numerals;
- month and year remain text, not decorative abbreviations only;
- dates must remain readable in Chinese and English;
- weekday labels never carry meaning alone;
- exact, approximate, range, and anniversary markers use text.

### 14.3 Calendar language

- calendar cells or date rows use one border system, not individual cards;
- eventful dates use short labels and counts;
- anniversary reminders use a ring or repeated-date motif plus text;
- planned/disputed states use semantic labels, not decorative dots;
- dense days open into a structured day list.

### 14.4 Timeline language

- large year markers;
- one chronological rule or path;
- movement events may span from/to columns;
- life events use a concentrated date mark;
- evidence appears below the moment, not in a detached right-hand audit card;
- no repeated rounded container around every event.

### 14.5 Anti-slop review

Rejected:

- generic dashboard KPI cards;
- a full-screen date picker as the product identity;
- seven tiny columns on mobile;
- event dots without labels;
- duplicated shared-event cards;
- card-inside-card event details;
- decorative clock hands, countdowns, or auto-scrolling chronology;
- purple-blue gradients unrelated to ZhiPanda semantics;
- unreadable glass panels;
- icons as the only event-type or state signal;
- a news-card grid ordered by publication date instead of event date;
- hiding dates or sources to make the page feel editorial;
- pretending missing historical coverage is a quiet period.

## 15. Motion direction

With `MOTION_INTENSITY: 5`, motion may explain chronology and state.

Allowed:

- 160 to 260 ms month/view transitions after explicit navigation;
- selected-day indicator movement;
- event-detail sheet entrance while preserving anchored content;
- time-ribbon selection movement;
- participant and filter-state confirmation;
- one-time timeline reveal when it does not change reading order.

Not allowed:

- autoplay through years or months;
- real-time ticking clocks;
- parallax date numerals;
- scroll-jacked horizontal timelines;
- continuous React state updates from scroll position;
- animated counts that imply live data;
- motion that conceals cancelled, disputed, or superseded state;
- required drag or swipe navigation.

Reduced-motion mode removes automatic movement and keeps instant view/date changes with optional minimal opacity.

## 16. Responsive rules

### 16.1 Under 768 px

- date stage becomes a single-column header;
- month grid becomes an ordered list of eventful dates plus explicit month navigation;
- filters use native disclosure;
- view switch remains fully labelled;
- event date precedes title and participant list;
- no sticky year column;
- no side sheet is required;
- selected-event detail appears inline;
- long participant and place names wrap;
- no horizontal overflow at 320 px.

### 16.2 768 to 1199 px

- calendar may retain seven columns if date labels remain readable;
- day detail moves below the calendar when width is insufficient;
- timeline uses a two-column date/content spine;
- filter field may wrap into two rows;
- time ribbon remains optional.

### 16.3 1200 px and above

- date stage may use an asymmetric 12-column composition;
- calendar and selected-day rail may appear side by side;
- timeline can use a fixed date column and wide event content;
- list measure remains bounded for readability;
- empty space is preferred over decorative panels.

### 16.4 Bilingual and long-content rules

- no fixed-height event titles or participant rows;
- Chinese and English month labels may have distinct type sizing;
- filters size to content and wrap;
- source titles and place names wrap safely;
- control text is not abbreviated without an accessible full label;
- locale switching keeps canonical IDs and selected period.

## 17. Representative prototype scenarios

Prototype files live under `docs/prototypes/panda-moments/`.

### 17.1 Calendar: July 2026 anniversary view

Uses reviewed birth events from public release `2026.07.24.2` to demonstrate derived birthday reminders.

The selected date is 2026-07-31 and highlights 雅颂 / Ya Song's fifth birthday reminder derived from the confirmed 2021-07-31 birth event.

The prototype also includes reviewed July birth dates for 真真, 晶亮, 珍喜, 奇珍, 妮可, 妮娜, 小馨, 小丫头, 二巧, 青青, 噗噗, 金宵, and 轮辉.

The 2026 reminders are explicitly labelled as derived anniversaries. They are not added to event counts.

### 17.2 Timeline: Zoo Atlanta family and institution history

Uses reviewed public events for:

- 伦伦's 1997 birth;
- 洋洋's 1997 birth;
- their shared 1999 arrival at Zoo Atlanta;
- 喜伦's and 雅伦's two separate 2016 birth event IDs, presented as one explicitly labelled same-day cluster;
- 喜伦's and 雅伦's two separate 2016 public-debut event IDs, presented as one explicitly labelled same-day cluster;
- the single four-participant 2024 transfer involving 伦伦, 洋洋, 喜伦, and 雅伦.

The cohort contains eight unique event IDs and twelve panda-to-event references. The prototype demonstrates event-ID deduplication, explicit related-event clustering without heuristic merging, participant grouping, movement paths, and profile/institution links.

### 17.3 State laboratory

Uses clearly labelled design fixtures for:

- a publicly announced future plan;
- a cancelled plan;
- a disputed event date;
- a superseded event;
- an approximate year;
- an unknown-date event;
- no results;
- partial coverage;
- delivery error.

Fixtures must never enter production public data.

## 18. Proposed public contract

The implementation should introduce a canonical event collection rather than construct Moments by joining panda detail arrays in the browser.

### 18.1 Top-level envelope

```ts
interface PublicMomentsRecord {
  query: PublicMomentsQuery;
  coverage: PublicMomentsCoverage;
  events: PublicMoment[];
  anniversaries: PublicAnniversaryOccurrence[];
  facets: PublicMomentFacets;
  taxonomy: PublicMomentTaxonomy;
  relatedEntities: PublicMomentEntityRegistry;
  pagination: PublicCursorPage;
}
```

The exact schema name and version are owned by #234.

### 18.2 Canonical moment

Required fields:

- stable event ID;
- optional reviewed event-group ID and related-event IDs;
- event type code and taxonomy version;
- occurrence status;
- conclusion state;
- start date, end date, and precision model;
- announcement date when applicable;
- participant IDs and optional public roles;
- from/to facility, institution, place, or coarse location;
- current-residency-change flag;
- localized reviewed title and summary state;
- source IDs;
- last verified date;
- supersedes/superseded-by event IDs;
- conflict IDs;
- revision ID;
- family-story membership IDs;
- public omission or restriction reason when applicable.

### 18.3 Anniversary occurrence

Required fields:

- stable derived occurrence key;
- occurrence kind `anniversary`;
- source event ID;
- source event type;
- participant IDs;
- derived date;
- anniversary year;
- derived age or null;
- derivation rule version;
- source date precision;
- source conclusion state;
- localized label;
- eligibility or suppression reason;
- no independent source IDs beyond the source event relationship.

### 18.4 Facets

Server-projected unique-event counts for:

- event type;
- panda;
- family;
- institution;
- place;
- region;
- occurrence status;
- conclusion state;
- precision;
- occurrence kind;
- year or bounded period.

Counts must not double count multi-participant events.

### 18.5 Entity registry

The response should include bounded localized summaries for referenced:

- pandas;
- family stories;
- institutions;
- places;
- facilities where publicly exposed;
- regions.

This avoids per-row client waterfalls while retaining stable canonical links.

### 18.6 Coverage

Coverage requires:

- state: complete, partial, none, or unavailable;
- declared scope;
- earliest and latest published event boundaries;
- included event families;
- anniversary policy version;
- release ID;
- public schema version;
- event taxonomy version;
- last successful projection time;
- optional localized coverage explanation.

## 19. Backend and query requirements

### 19.1 Primary read

Recommended route shape:

`GET /v1/public/moments`

Query parameters mirror the stable public URL contract.

Requirements:

- canonical unique-event collection;
- server-side filtering and deterministic sorting;
- cursor pagination for list and long timelines;
- bounded calendar-month responses;
- precomputed facets where practical;
- release-bound ETag and immutable caching;
- locale-aware labels without locale-dependent identifiers;
- no local-research fallback;
- no N+1 source, participant, or place reads;
- withdrawn event and media behavior follows existing policy.

### 19.2 Calendar read

A month read should return:

- eventful dates only or a bounded day index;
- selected-day moments;
- anniversary occurrences when requested;
- counts by date;
- month coverage;
- previous/next published period hints when useful.

The frontend renders empty calendar days locally from the requested month; the backend does not need to emit 28 to 31 empty records.

### 19.3 Timeline read

A timeline read should return:

- bounded period;
- deterministic ascending or descending event sequence;
- optional year-density buckets;
- selected event;
- facets and coverage;
- next cursor.

Density buckets are derived from unique canonical events.

### 19.4 Event detail read

When the main response does not contain full evidence, a bounded event-detail read may provide:

- complete participant registry;
- complete sources;
- conflicts;
- supersession chain;
- revision summary;
- related journeys.

The initial server response must still contain enough information to understand each visible event.

### 19.5 Caching and freshness

- public release data uses immutable release-bound caching;
- current canonical route may use short revalidation or release-pointer caching;
- source access and last verification are release data, not live checks during page rendering;
- anniversary occurrence keys include derivation policy version and year;
- no real-time polling;
- no client clock that changes historical data state after hydration;
- date defaults resolve server-side using the product timezone policy.

### 19.6 Timezone policy

Panda events in the current contract are civil dates without time-of-day.

#234 must document:

- the timezone used to select the default current date;
- whether the public product uses user locale, a fixed project timezone, or a request-derived timezone;
- how cached pages avoid switching dates incorrectly;
- that civil event dates are not converted across timezones;
- how future timestamped announcements would differ from date-only events.

## 20. Frontend ownership

### 20.1 Moments-owned modules

- `MomentsDateStage`
- `MomentsViewSwitch`
- `MomentsFilterField`
- `MomentsCalendar`
- `MomentsMobileMonthList`
- `MomentsDayRail`
- `MomentsTimeRibbon`
- `MomentsTimeline`
- `MomentsResultList`
- `MomentComposition`
- `MomentParticipantList`
- `MomentMovementPath`
- `MomentEvidenceDisclosure`
- `MomentsCoverageSummary`
- `MomentsStateNotice`

### 20.2 Shared patterns after two real callers

- `DatePrecisionLabel`
- `ConclusionSignal`
- `EvidenceDisclosure`
- `SourceReferenceList`
- `RelatedJourneyLink`
- `PublicReleaseSummary`
- `EntityLinkList`
- `NoResultsRecovery`

Shared patterns own semantics and interaction mechanics. Moments owns chronology and query composition.

### 20.3 Server/client boundary

Server Components own:

- parsed and validated query state;
- date and coverage stage;
- filter forms;
- calendar content;
- timeline/list events;
- selected event fallback;
- source and state text;
- pagination links;
- metadata and structured data;
- no-JavaScript journeys.

Narrow client islands may own:

- active selected-day indication;
- enhanced month/view transitions;
- optional event side sheet;
- filter disclosure enhancement;
- time-ribbon focus synchronization;
- non-essential motion.

The event dataset is not downloaded wholesale for client filtering.

## 21. Accessibility acceptance criteria

- one `h1` naming the page and selected period;
- logical heading hierarchy independent of visual date size;
- skip link and stable main target;
- view switch exposes current view through text and `aria-current`;
- filters use labelled native controls and fieldsets;
- selected filters are announced and keyboard removable;
- calendar dates include full accessible labels;
- mobile does not require a seven-column grid;
- timeline and day results are semantic ordered lists;
- participant links are individually reachable;
- multi-participant events are announced once, not duplicated;
- status, conclusion, precision, and anniversary state use text, not color alone;
- approximate dates do not encode false exact `<time>` values;
- source, revision, and conflict details are keyboard reachable through native disclosures;
- reduced motion removes automatic movement;
- no drag, swipe, hover, or pointer precision is required;
- 200% zoom and 320 px retain filters, period navigation, result reading, and source access;
- no-JavaScript mode retains all core calendar, timeline, list, event, and evidence tasks;
- focus returns predictably when an enhanced event sheet closes;
- error and no-result states move focus only after explicit submission when appropriate.

## 22. Performance acceptance criteria

- server-first initial render;
- no client-only event shell;
- no full-corpus event payload for a month or bounded period;
- unique-event deduplication happens in the public projection or server read model;
- calendar response is bounded to the selected month/day;
- list and long timeline use cursor pagination;
- facets are server projected;
- optional density ribbon uses compact buckets, not full event objects;
- motion uses transform and opacity only;
- no continuous scroll state in React;
- no third-party calendar or timeline dependency without bundle, accessibility, localization, maintenance, and exit-cost review;
- no external map library on the Moments route;
- font and icon additions require bundle and licensing review;
- route performance budget is explicitly added by #234 and should align with the existing minimal public-route budgets.

## 23. Localization acceptance criteria

- all application copy exists in Chinese and English;
- month, weekday, date, range, and precision language uses locale-aware formatting;
- event titles and summaries carry field-level translation state;
- controlled fallback labels remain localized;
- locale switching preserves period, filters, selected event, and canonical IDs;
- missing translation never generates copy;
- source language remains visible;
- participant names preserve reviewed language state;
- filter labels and values fit without forced abbreviation;
- anniversary age grammar is reviewed in both languages;
- current-date defaults do not alter civil event dates.

## 24. Data-honesty acceptance criteria

- one canonical event ID renders once per query result;
- distinct event IDs remain distinct unless an explicit reviewed event-group or supersession contract says otherwise;
- participant count does not inflate event count;
- event date, announcement date, source publication date, and last verification date remain distinct;
- birthday reminders are labelled derived anniversaries and link to the source birth event;
- anniversary reminders do not increment event counts;
- announced movement is not shown as completed residence;
- cancelled movement does not alter current place;
- disputed and superseded records remain inspectable;
- exact calendar cells contain only appropriately precise dates;
- unknown dates are never assigned fake values;
- partial coverage is not represented as confirmed inactivity;
- source publication date remains absent when missing;
- local research and design fixtures never enter public responses;
- no co-participant relationship or family inference;
- no exact coordinates inferred from institutions or coarse locations;
- no popularity, sentiment, or trending ranking;
- release, schema, taxonomy, and derivation-policy versions remain visible.

## 25. Impeccable critique and hardening record

### 25.1 Shape result

Primary task hierarchy:

1. orient to date or period;
2. understand unique reviewed moments;
3. narrow by entity or event type;
4. inspect event state and evidence;
5. continue to profile, family, institution, place, lineage, or map.

A publication-date news feed hierarchy is rejected.

### 25.2 Critique result

Risks and resolutions:

- **Shared events duplicate:** canonical unique-event read model and participant grouping.
- **Birthday reminders become fake events:** derived occurrence contract and separate counts.
- **Calendar becomes unreadable on mobile:** eventful-date list replaces compressed grid.
- **Event status is overloaded:** occurrence, announcement, conclusion, and temporal relation become separate axes.
- **Quiet years imply no history:** persistent coverage statement and partial-density language.
- **Filters become a dashboard wall:** primary filters remain visible, advanced filters use disclosure.
- **Timeline becomes decorative:** semantic ordered list is primary; ribbon is optional.
- **Evidence disappears behind editorial design:** state text remains next to the affected event and full detail remains server rendered.
- **Future plans read as facts:** announcement date and operational state are separate.
- **Source dates are guessed:** optional source publication date remains blank when absent.

### 25.3 Adapt result

- desktop calendar becomes an eventful-date list on mobile;
- selected-day rail becomes inline detail;
- long participant groups wrap and retain one event identity;
- filter controls remain native and labelled;
- month, period, and view state remain URL-addressable;
- no-JavaScript forms and pagination remain complete;
- approximate and unknown dates avoid false machine values.

### 25.4 Harden result

The design explicitly covers:

- unique event deduplication;
- shared participant events;
- exact, month, year, approximate, range, and unknown precision;
- planned, announced, completed, cancelled, disputed, and superseded states;
- derived anniversaries;
- no results;
- empty collection;
- partial coverage;
- missing translation;
- source publication date missing;
- changed or restricted sources;
- delivery unavailable;
- long participant and place names;
- 320 px and 200% zoom;
- reduced motion and no JavaScript.

### 25.5 Audit result

The design does not require:

- a news CMS;
- a social activity feed;
- a client-side full dataset;
- exact coordinates;
- a hero photograph;
- a third-party calendar library;
- continuous animation;
- real-time updates;
- local research;
- generated event summaries;
- duplicate panda-event cards.

### 25.6 Animate result

Motion is limited to explicit navigation and orientation. Chronology remains readable before and after all transitions. Reduced-motion output is structurally identical.

### 25.7 Polish result

- date typography is expressive but always labelled;
- calendar markers include text;
- movement uses clear from/to language;
- anniversaries use `周年提示 / Anniversary reminder` wording;
- planned and disputed labels are never icon-only;
- event detail and evidence remain flat and readable;
- view names are `日历 / Calendar`, `时间线 / Timeline`, and `列表 / List`;
- active filter summaries use human-readable labels, not raw query strings.

## 26. Implementation handoff for #234

Recommended sequence:

1. Define a canonical unique-event public schema and migration from panda-centric event arrays.
2. Separate occurrence status, announcement data, conclusion state, date precision, and supersession.
3. Define controlled taxonomy, versioning, and anniversary derivation policy.
4. Build release projection for canonical events, participants, entities, facets, coverage, sources, and revisions.
5. Add approved event fixtures/tests for shared events, missing publication dates, announced plans, completed movement, and current release compatibility.
6. Implement server-side query parsing and canonical URL normalization.
7. Implement list view first as the complete structured journey.
8. Implement calendar and mobile eventful-date list against the same query model.
9. Implement timeline and optional density ribbon.
10. Add selected-event detail and cross-surface links.
11. Add only narrow client enhancements for selected date, filters, view transition, and event sheet.
12. Run targeted contract and web checks during development.
13. Defer broad browser, accessibility, performance, release, staging, rollback, and withdrawal evidence to #234 as the map-closing issue.

Required first-cohort scenarios:

- current-month calendar with reviewed anniversaries;
- one multi-participant event rendered once;
- institution-filtered long timeline;
- announced future plan;
- completed movement;
- cancelled fixture/test;
- disputed date fixture/test;
- superseded event fixture/test;
- approximate and unknown dates;
- no results;
- partial coverage;
- missing source publication date;
- missing translation;
- delivery error.

## 27. Acceptance decision

Panda Moments is ready for implementation when:

- calendar, timeline, and list roles are distinct and consume one query model;
- the page renders 43 current unique events rather than 60 participant references;
- derived anniversaries cannot be mistaken for source events;
- event, announcement, source publication, verification, and derived dates remain separate;
- status is modelled across occurrence, conclusion, and temporal axes;
- URL state supports sharing, locale switching, history, and return context;
- desktop and mobile prototypes preserve the same product identity and core tasks;
- partial, no-result, future, cancelled, disputed, superseded, approximate, unknown-date, and error states are implementable;
- public-contract and backend requirements cover every rendered state;
- no production behavior depends on local research or design fixtures;
- #234 can implement the page without reopening the primary IA, query, or event-model decisions.

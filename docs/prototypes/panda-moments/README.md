# Panda Moments responsive prototypes

These prototypes support Wayfinder issue #232 and the specification in `docs/design/panda-moments-specification.md`.

They are decision artifacts, not production code. Do not copy their fixture content, CSS, or markup directly into the application.

## Scenarios

- `calendar.html`: July 2026 calendar and selected-day view. Birthday reminders are derived from reviewed birth events in public release `2026.07.24.2` and are explicitly labelled as anniversaries, not new events.
- `timeline.html`: Zoo Atlanta-related timeline using reviewed public events. The shared arrival and four-panda transfer render once; 喜伦 and 雅伦's separate same-day birth and public-debut event IDs remain distinct inside explicit date clusters.
- `states.html`: explicit design fixtures for announced/planned, cancelled, disputed, superseded, approximate, unknown-date, no-results, partial-coverage, and delivery-error states.

## Review widths

Open each file directly in a browser and review at:

- 1440 x 1000 desktop;
- 1024 x 900 tablet;
- 390 x 844 mobile;
- 320 x 720 narrow mobile;
- 200% browser zoom.

The prototypes contain no required JavaScript. View switching, month/period navigation, filters, selected event detail, evidence disclosures, and recovery actions use links, forms, and native HTML.

Rendered evidence is stored in `screenshots/`:

- `calendar-desktop.png` and `calendar-mobile.png`;
- `timeline-desktop.png` and `timeline-mobile.png`;
- `states-desktop.png` and `states-mobile.png`.

## Design parameters

- `DESIGN_VARIANCE: 8`
- `MOTION_INTENSITY: 5`
- `VISUAL_DENSITY: 7`

Pinned inputs:

- `pbakaus/impeccable@32930818a109fafa87199babe92fa8e530cff5d3`
- `Leonxlnx/taste-skill@e988add20dab0fa97d7a76781c48961c8184288e`

## Data rules demonstrated

1. One stable event ID renders once even when several pandas participate.
2. Separate event IDs remain separate; an explicit date cluster may group them without changing event counts.
3. Anniversary reminders are derived occurrences and do not increase source-event counts.
4. Event date, announcement date, source publication date, and last verification date remain separate.
5. Announced movement is not represented as completed residence.
6. Approximate and unknown dates never receive false exact machine dates.
7. Mobile uses an eventful-date list instead of an unreadable seven-column calendar.
8. Partial coverage is not presented as confirmed inactivity.
9. Design fixtures are visibly marked and cannot be confused with published public data.

## Review questions

1. Can a visitor orient to date or period before encountering filters or evidence?
2. Are calendar, timeline, and list roles meaningfully different?
3. Can a shared event be understood as one event with several participants?
4. Can an anniversary reminder be mistaken for a new sourced event?
5. Does the mobile experience retain period navigation and selected-day detail without horizontal scrolling?
6. Are planned, cancelled, disputed, superseded, approximate, and unknown-date states legible without color or motion?
7. Does the page remain useful with partial coverage or delivery failure?

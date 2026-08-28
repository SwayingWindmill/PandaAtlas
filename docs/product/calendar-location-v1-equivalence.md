# Calendar and Location V1 equivalence

- Status: **Closed by current V2 product surfaces**
- Date: 2026-08-28
- Tracking issue: #307
- V2 architecture authority: [`docs/architecture/zhipanda-v2-architecture-baseline.md`](../architecture/zhipanda-v2-architecture-baseline.md)

## Requirement matrix

| V1 requirement | Current surface | Resolution |
|---|---|---|
| Calendar/list views for birthdays and anniversaries | `/{locale}/moments` timeline plus `?view=calendar` | Superseded by Panda Moments. Confirmed birth events can produce explicitly derived birthday anniversaries without creating a second calendar dataset. |
| Calendar/list views for moves, arrivals, departures, and other life events | `/{locale}/moments` | Superseded by Panda Moments. V2 public life events are the source; shared events are deduplicated by event identity. |
| Filter by date | `/{locale}/moments?year=...&month=...` | Implemented. Timeline filters are URL-addressable and the calendar has explicit year/month navigation. |
| Filter by event type | `/{locale}/moments?type=...` | Implemented on the timeline view. |
| Filter by location | `/{locale}/moments?location=...` | Implemented against the V2 event's published from/to facility or coarse location. The selector uses published place names where a V2 place identity is available. |
| Stable location detail | `/{locale}/places/{slug}` | Implemented as the canonical place route with stable-reference normalization. |
| Current pandas at a location | Place detail | Implemented from current V2 residency state. |
| Historical pandas / residency history | Place detail | Implemented from V2 residency history. |
| Arrivals and departures for a location | Place detail | Implemented from V2 life events that reference the place as a from/to facility. |
| Map context | Place detail → `/{locale}/map` | Implemented with a direct map continuation link. |
| Outbound evidence links | Place detail → Public sources | Implemented with external source links and last-verified metadata. |
| Chinese / English public routes | Moments and Place detail | Implemented through the existing `zh` / `en` public locale contract. |

## Product decision

Do not recreate legacy `/calendar` or `/location` route names merely for naming parity. Panda Moments is the Calendar-equivalent experience, and canonical Place detail is the Location-equivalent experience.

Calendar data remains derived from the same V2 public life-event truth used by the timeline. Location pages remain place-centric rather than treating an institution name as an exact physical residence.

## Remaining scope

No separate V1 Calendar or Location product gap remains after the location filter is available on Panda Moments. Future enhancements to Moments, Map, institutions, or place storytelling should be filed as product improvements rather than V1-equivalence work.

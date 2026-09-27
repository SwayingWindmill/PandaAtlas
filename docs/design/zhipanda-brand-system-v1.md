# ZhiPanda Brand System V1

> Status: active brand foundation for public fan surfaces.
>
> This system is intentionally distinct from Chester Zoo. Chester is a quality and interaction reference; ZhiPanda owns its own mark, typography, panda-specific semantics, palette, data and community model.

## 1. Brand idea

**Know the panda. Keep following the panda.**

ZhiPanda is not a generic wildlife publication and not a database dressed as a website. The brand connects three ideas:

1. **Panda gaze** — the unmistakable eye patches of a giant panda.
2. **吱 / chatter** — the name ZhiPanda implies a small voice, conversation and fan connection.
3. **A living path** — every panda connects to family, places, moments and a personal return loop.

The visual identity should feel optimistic, contemporary and animal-first rather than archival or luxury-editorial.

## 2. Logo architecture

### Primary mark

The primary symbol is a **speech field containing two panda-eye forms**.

- The outer field references a rounded conversation bubble.
- Two mirrored eye-patch cuts make the panda reference legible without drawing a cartoon face.
- The small acid-yellow dot is the only two-color accent and represents a live moment / new discovery.
- The mark must remain readable at 24 CSS px.
- Avoid adding ears, paws, bamboo stalks, noses or mascot facial expressions to the core mark.

Implementation: `components/brand/zhipanda-logo.tsx`.

### Wordmark

Primary lockup:

**吱熊猫  ZHIPANDA**

- Chinese name leads on Chinese public surfaces.
- ZHIPANDA is supporting identification, not a tiny legal line.
- English surfaces may keep the same bilingual lockup for global brand recognition.
- Do not typeset the wordmark in serif fonts.
- Do not stretch or outline the wordmark.

### Logo variants

1. Primary: deep teal mark on warm ivory, acid dot.
2. Inverse: warm ivory mark on deep teal, acid dot.
3. One-color: deep teal or white only, for monochrome contexts.
4. Mark-only: app icon, social avatar, compact mobile action.

## 3. Typography

Fonts are bundled in the app, not assumed to exist on the operating system.

### Brand/display Latin

`Archivo Variable`

Use for:
- ZHIPANDA Latin wordmark;
- English hero/display headlines;
- numeric moments, years and short navigation labels where a compact branded voice helps.

Typical weight: 720–900.

### Brand/display Chinese

`Noto Sans SC Variable`

Use for:
- Chinese hero/display headlines;
- panda names;
- section titles.

Typical weight: 720–900 with controlled negative tracking. Do not substitute serif display type on fan surfaces.

### Body/UI

`Noto Sans SC Variable`

Use for:
- Chinese and bilingual body copy;
- metadata;
- buttons and utility labels;
- accessible form controls.

Latin-only micro labels may use Archivo when it improves brand cohesion.

### Type behavior

- Hero may use one large zoo-entrance statement.
- Later sections return to product scale.
- Chinese line height must not be copied mechanically from Latin.
- Avoid ultra-light weights over photography.
- Avoid all-caps for Chinese; English all-caps is reserved for very short brand labels.

## 4. Core colors

| Role | Token | Value |
|---|---|---|
| Deep brand field | `--zp-brand-deep` | `#003e40` |
| Brand ink | `--zp-brand-ink` | `#002526` |
| Warm ivory | `--zp-brand-ivory` | `#fffff2` |
| Signature acid | `--zp-brand-acid` | `#fbff36` |
| Living leaf | `--zp-brand-leaf` | `#65b878` |
| Water/support | `--zp-brand-water` | `#66c8cb` |

Acid yellow is a signature, not a page background. Use it for one primary action, active moments, tiny brand punctuation and My Pandas return cues.

## 5. Graphic language

### Panda patches

The two eye-patch lozenges from the logo are the core graphic motif.

Allowed uses:
- crop masks for small decorative media accents;
- navigation active indicator;
- loading/empty-state motion;
- two-item comparison or paired family moments.

Do not scatter them as random decoration.

### Conversation field

The rounded speech field informs:
- floating Home navigation;
- compact callout containers;
- My Pandas return actions.

It should never turn every section into a rounded bubble.

### Live dot

The acid dot represents a current moment, update, or active path.

Use for:
- new/recent content;
- current active route;
- subtle carousel position feedback.

Never use it as fake online presence.

### Curves and corners

- Action pills: fully rounded.
- Entity/media cards: 16–24 px radius.
- Large scenes: 24–32 px only when framed; full-bleed scenes may have no radius.
- Ordinary content surfaces should not all be rounded.

## 6. Photography and video

### Photography

- Correct panda identity is mandatory.
- Crop around face/posture first, container second.
- Avoid darkening every image. Use local overlays only when text sits over media.
- Real environment is valuable; do not crop every photo into a headshot.

### Hero video

Hero media is atmospheric, not evidence of the featured CTA panda unless explicitly identified.

Required:
- use a Chester-inspired short-shot montage rather than one long background clip;
- use official zoo/broadcaster footage for the primary Home montage and keep source attribution reachable;
- accept only shots where the panda is the visual subject; exclude people-led footage, intros, title cards, empty scenes, tiny panda appearances and duplicate uploads;
- detect the source video's own edit boundaries first. Hero switches must align to source cuts; never create an artificial cut inside a long source shot just to hit a fixed duration;
- target roughly 3–8 seconds per Hero range. Very short adjacent accepted source shots may be grouped only when their original cut remains intact; source shots longer than 8 seconds without an internal source cut are not used in the automatic Hero montage;
- use explicit `startAt` / `endAt` boundaries, then apply small head/tail safety trims that account for the temporal resolution of automatic cut detection; never allow a visible frame to pass the effective end boundary;
- use frame-level boundary monitoring (`requestVideoFrameCallback` where available) rather than relying on coarse `timeupdate` events;
- a standby clip is eligible to become visible only after its seek to the effective start point has completed;
- use a two-layer double buffer: the active clip remains visible until the standby clip has reached a playable, correctly-seeked state; the poster is initial fallback only and must never appear between clips;
- load the current and next source only, rather than preloading the entire pool;
- desktop uses muted inline video; mobile and reduced-motion use a reviewed poster image;
- keep video color natural: no full-frame brand-color tint; use only minimal neutral local contrast treatment when text needs it;
- no audio autoplay;
- preserve named-panda identity when established and keep unidentified ambient footage unbound to a named profile.

Current prototype pool:
- 9 deduplicated official video sources from Smithsonian's National Zoo, San Diego Zoo and iPanda / CCTV.com;
- 58 source shots passed panda-subject and dense person filtering;
- 40 cut-aligned Hero-ready ranges are generated from those source shots;
- local prototype media is 1920×1080 and the Home player consumes the same pool shown in the internal audition surface.

## 7. Mature component policy

### Adopted mature primitives

- shadcn/Radix Dialog, Sheet, Command and Slot primitives;
- Vaul Drawer;
- Animate UI Tabs and Accordion;
- React Photo Album;
- Yet Another React Lightbox;
- Motion for controlled state transitions;
- Lucide icons.

These own interaction mechanics. ZhiPanda owns styling and domain semantics.

### ZhiPanda domain blocks

The following are brand-owned reusable blocks and must not regress into page-local one-offs:

- `ZhiPandaLogo`;
- `LicensedHeroVideo`;
- `PandaHeroRail`.

Each must:
- expose a stable prop/data interface;
- own keyboard/touch/reduced-motion behavior where relevant;
- use global brand tokens;
- remain usable outside the Home route.

### Prototype-only / do not treat as mature

- old marketing magazine block;
- changelog timeline Home block;
- archive masonry Home block;
- previous V9/V10/V11 Home section implementations;
- one-off decorative bento or spotlight experiments.

## 8. Motion

Motion should suggest a living zoo, not a motion demo.

- Video provides the main first-view motion.
- Card hover scale remains subtle.
- Rail movement is user-controlled.
- No autoplay carousels.
- No bounce/elastic easing.
- Reduced motion removes nonessential transforms while preserving video fallback and navigation.

## 9. Brand quality bar

Before a new public surface ships, verify:

- Does the page visibly belong to ZhiPanda even with the logo hidden?
- Are Archivo / Noto Sans SC Variable actually loaded rather than merely named in CSS?
- Is the acid color used deliberately rather than everywhere?
- Is panda identity correct for every image/video?
- Does each interactive pattern come from a mature primitive or a documented ZhiPanda block?
- Would removing large typography still leave a strong product structure?
- Is attribution reachable for licensed media?
- Does 320 px remain a first-class layout?

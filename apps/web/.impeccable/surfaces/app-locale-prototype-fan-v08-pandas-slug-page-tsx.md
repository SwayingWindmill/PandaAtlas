---
version: 2
slug: "app-locale-prototype-fan-v08-pandas-slug-page-tsx"
primary_target: "app/[locale]/prototype/fan-v08/pandas/[slug]/page.tsx"
related_targets: ["app/[locale]/prototype/fan-v08/pandas/[slug]/detail.module.css","app/[locale]/prototype/fan-v08/pandas/[slug]/detail-motion.tsx","app/[locale]/prototype/fan-v08/pandas/portrait-transition-link.tsx","app/[locale]/prototype/fan-v08/pandas/directory-explorer.tsx","app/[locale]/prototype/fan-v08/pandas/research-catalog.ts"]
---

# Fan V8.5 Panda Detail

## Scope and mode

Visitor mode: **Experience + Explore**. The page continues the Digital Panda Portrait Library into an individual panda story. It is not a public data inspector and it must not inherit the legacy TrustedProfilePage card-heavy hierarchy.

## Audience and job

A panda fan has just chosen one panda from the portrait library. The next page should preserve spatial continuity, make the selected panda emotionally dominant, then reveal life story, family, places, imagery and sources only when real data exists.

## Primary action

Stay with the selected panda long enough to understand who it is, then continue naturally into family, moments, another panda or a source.

## Chosen direction

**Forest Atlas — an image-led animal world, not a document page.** The current review target is desktop at roughly 1440–1728px. Chester Zoo’s current animal catalogue and Red Panda detail experience remain the primary **visual-world** reference: real photography, floating navigation, deep forest/teal grounds and a few large story beats. Monterey Bay Aquarium’s current Blacktip Reef Shark page is the **first-viewport information-architecture** reference: the main animal image and the durable identity/profile facts form one opening scene instead of a Hero followed by a second Overview block.

The first viewport is therefore one combined identity Hero. On desktop, the correct individual photograph (or intentional no-photo state) owns the larger left field and a deep-forest profile panel owns the smaller right field; the target proportion is roughly 59/41 rather than two equal cards. The name, alternate name and stable facts — profile type, sex, birth, birthplace when known, current/last-known place, life status, family summary, and rescue/release dates when relevant — live in that right-hand scene. There is no second Profile Overview section below the Hero. When several verified photographs exist, the Chester-inspired draggable carousel remains anchored inside the bottom of the **media side** of this same Hero, excluding the selected Hero image and preferring varied sources/batches before filling remaining slots. On narrow screens the media and profile panel stack in DOM reading order; the profile facts remain readable without placing text over the panda’s face. The combined scene must still work when there is no photograph: the left side becomes an explicit no-photo field while the right side retains the complete identity summary.

Every panda still receives a real “关于{name} / About {name}” introduction assembled deterministically from qualified facts, but fact order is editorial rather than database order: when available, a memorable nickname, recognition trait or personality observation leads; birth/current-residence biography follows. After About, a reusable **Panda Facts** chapter may render 2–6 high-value display facts selected from semantic slots (identity, birth, personality/daily life, family, place, life event, significance). It is not a database field grid: one fact per semantic slot, no forced minimum beyond two useful cards, no single-card chapter, and no empty placeholders. Acquisition/editorial mechanics such as Subject IDs, slugs, media discovery notes, source metadata and capture language are filtered before UI selection. Administrative fallbacks such as sex, deceased status or studbook number are used only when a sparse record lacks enough stronger facts. Card copy is derived deterministically from supported facts, remains concise, and never invents missing detail. The chapter uses the deep-teal animal-world ground with a restrained natural palette rather than the old lime image-plus-dl panel or Chester’s candy colors.

The palette is deliberately smaller than earlier V8.5 iterations. Deep forest carries recognition/profile and gallery scenes; pale leaf supports family; lime is reserved for chronology or a genuinely singular accent where it earns the attention; warm-light neutral carries the long-form story. Panda Facts use several closely related, desaturated natural tints on one deep-teal ground rather than a rainbow. Do not create a new full-width color field for each category. Coral/sun are not automatic significance colors. Beige is not a default page canvas, but a controlled warm-light reading ground is allowed where it improves the photographic rhythm.

The detail page contains no repeated module badges, spreadsheet rows, publication/review vocabulary or document-style chapter rail. Missing sections are omitted. Sparse records remain intentional rather than padded.

The template is progressive across the current generated frontend research catalogue (1288 canonical detail subjects as of 2026-09-15; do not treat this count as a permanent product constant). Layer 1 (combined Hero/Profile scene / carousel when possible / About / Panda Facts when 2+ useful display facts exist) is the normal core. Recognition, personality, family, life stories, places, recent moments and photo archive are conditional enrichment, not required slots. Current data coverage and thresholds are documented in `docs/product/panda-detail-template-v2.md`; the design must never pad low-coverage chapters just to preserve a fixed page length. Dedicated recognition/personality/story chapters consume additional facts beyond the quick Facts card so the same single fact is not repeated at full-screen scale. Recent Moments is limited to living pandas with a dated moment inside an 18-month window.

Template context is derived on two orthogonal axes rather than one visual “panda type”: era (`living` / `historical` / `unknown`) and life journey (`managed`, `wild_native`, wild-rescue in care/released, rewilding training/released, generic released-to-wild, or `unknown`). This classification is evidence-derived presentation metadata, not a decorative badge and not a substitute for source facts. A historical panda may still have any journey type. Use the journey only to choose relevant story emphasis and conditional chapters; do not give each type a different visual design system.

Below the introduction and fact chapter, one stable profile template uses a few large visual chapters rather than thin separators:

- Name/identity and the strongest recognition/daily-life observations are folded into **About {name} / 关于{name}** as readable story paragraphs. A dedicated **How to recognize** or **Personality** scene appears only when additional qualified facts remain after About/quick Facts; those deeper scenes use large photography and prose, never another field panel or card grid.
- Family is one pale-leaf photographic composition and a second visual climax, not an equal-card grid. The current panda owns one large anchor portrait; up to four representative relatives form an **asymmetric** photographic wall. One relative becomes the supporting visual anchor while the remaining relatives stack beside it, so 1/2/3/4-relative states change composition rather than leaving empty slots or reverting to a 2×2 dashboard grid. Relationship role and name live inside each image. The full lineage remains available through the dedicated family route instead of stretching the detail page indefinitely.
- Reproduction, rescue/wild life, growth/care and historical significance are consolidated into one **Life stories / 人生故事** chapter. The highest-value story leads as a large two-column statement; later story groups stagger across the reading field rather than forming equal cards. Rescue/release, wild follow-up, conservation/diplomacy, major milestones and meaningful parenting/reproduction outrank measurements and ordinary snapshots. Low-value age/weight/photo-capture facts may support a stronger story but cannot create a standalone story chapter. Each category may remain a semantic subheading and anchor, but it must not automatically become another full-width colored section.
- Life events use the custom horizontal **Life Track** on a vivid lime chapter. Residence ranges become substantial rounded bands; the chronological path is a visible route rather than a 1px hairline. Nodes show year and event type only. Full event prose lives in one large selected-story panel below.
- Places remain a separate dark spatial-history chapter only when the record merits it. Do not render a generic bordered row for every location fact.
- Living pandas with recent dated evidence may receive a dark-forest **Recent Moments / 最近怎么样** chapter with up to three newest items and a link into the Moments surface. Historical/deceased/stale profiles omit it entirely.
- Additional verified imagery uses the shared `PhotoGallery` and lightbox as a dark-gallery chapter. Photography must dominate the gallery surface.
- Sources are a quiet final reference layer: compact, low-contrast and clearly secondary. They must not become large cards or a visual climax.
- When a confirmed related panda has a usable destination, the page ends with one full-width photographic continuation scene — for example “继续认识它的家人” — so the emotional ending returns to a panda rather than a bibliography.

Shared UI components are infrastructure, not the visual thesis. Photo, color, type and spatial rhythm define this surface. The intended feeling is closer to Chester Zoo’s current “Forest Mode” digital ecosystem than to an editorial magazine, white-paper encyclopedia or component showcase.

## Transition language

The directory and detail page use the approved React Bits + GSAP + Motion interaction stack with explicit ownership. GSAP owns the portrait-to-hero spatial morph and its single authoritative timeline; Motion owns the detail-copy reveal and ordinary React micro-interactions.

1. The clicked portrait is reconstructed as a fixed **mask frame** at the exact visible 4:5 geometry.
2. The mask frame animates its position, width, height and corner radius toward the exact full-bleed detail Hero geometry on one isolated fixed element. The target dimensions must track the real responsive Hero CSS, including the layout viewport width rather than `window.innerWidth`, so a visible scrollbar cannot create a last-frame width jump.
3. The image inside that mask remains `object-fit: cover` at all times. The panda bitmap is never given independent `scaleX` and `scaleY`, preventing face/body distortion.
4. The deep-forest route veil and route navigation are placed on the same GSAP timeline so phases cannot drift apart.
5. The destination waits for the morph end time, then the overlay and veil fade away to reveal the already-mounted identical Hero. The transition supports the profile and must never dictate the profile layout.

Do not restore `Flip.from(..., { scale: true })` directly on the panda image when source and target aspect ratios differ; that produces perceptible non-uniform scaling. Modified-click behavior, normal href fallback and reduced-motion users bypass the cinematic layer and retain standard navigation. Playwright must verify that the overlay geometry actually changes during the transition, not merely that an overlay exists and navigation succeeds.

## Data boundary

The V8.5 prototype reads the current generated canonical research catalogue plus a generated research-detail projection inside the prototype route so visual review can use the project's broader research source layer without turning raw research records into UI. The 2026-09-15 projection contains 1288 frontend detail subjects, but this number must be regenerated as collection grows rather than baked into the template. Projection schema v2 keeps the compact compatibility fields and adds a broader `facts` collection (up to 80 qualified facts per panda), with conflict/review filtering, identity merges, structured relationship extraction and public-copy cleanup upstream of the page. Production public routes remain unchanged. The V2 public atlas remains opportunistic enrichment; if it is temporarily unavailable, research-backed profiles still render instead of returning an error.

## Constraints

- Every photograph must belong to the individual panda shown.
- Never invent story, family, location, timeline or image data to fill a visual module.
- At 320 CSS px there must be no page-level horizontal overflow.
- The mobile hero must not place text over the panda face.
- Keyboard, touch and modified-click navigation remain valid.
- Reduced motion skips the shared-element animation.
- Trust/evidence stays reachable but visually secondary.

## Success criteria

A directory click should feel like the selected portrait grows into the next scene rather than a generic page load. The first viewport must make the panda unmistakably dominant, while richer published records naturally unfold into story, life, family, places, media and sources. Sparse research records must still look intentional and beautiful rather than incomplete or administrative.

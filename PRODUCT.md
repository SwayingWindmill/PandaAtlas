# Product

<!-- impeccable:product-schema 1 -->

<!--
Inferred record. This session had no structured question tool and no one
answering a decision page. Facts below come from the owner's brief for this
redesign and from the repository. Lines marked (inferred) were not separately
confirmed in an interview.
-->

## Platform

adaptive

## Users

Chinese-reading panda fans. They open 吱熊猫 to look up one animal, a place that keeps pandas, or how to tell two faces apart. (The audience and the Chinese-first UI are from the owner's brief. The lookup job is inferred from the shipped atlas, map, and profile screens.)

## Product Purpose

吱熊猫 (PandaAtlas) is a giant-panda atlas. A fan can find an individual panda, the institution that keeps them, their place on a map, and short 科普: knowledge cards, topics, terms, a face guide, and a face quiz. Success is that a fan leaves knowing which panda they were looking at, and that unpublished draft copy never appears in the public catalog.

## Positioning

The atlas is organized around named individual pandas and the institutions that keep them, with face-recognition notes tied to those animals' published photographs. A general encyclopedia page about "the giant panda" cannot make that claim. (Inferred from the data model: panda slugs, institution curation, and learning entries that point at those slugs.)

## Operating Context

Fans use the Expo app on a phone, in Chinese. Writers draft 科普 in `data/curation/learning/learning.json`. Only entries with `status: published` are returned by `GET /api/v2/learning`. Drafts stay in the document for owner review and are visible in development builds. The public app shows an empty catalog as 「科普还在写」.

## Capabilities and Constraints

- Shipped surfaces: individual pandas, institutions, a map, and the six learning screens (home, knowledge card, topic, term, face guide, face challenge).
- Learning copy is Chinese-first. English fields exist in the catalog and are not the UI.
- Face tips use the keys `shape`, `leftRight`, `eyePatches`, `ears`. The shape label is 「脸型」. A tip whose body is empty is not shown.
- The face quiz asks which photo is a named panda when that panda has only one published photo. Choice photos show no names until the answer. A second, different published photo may be used as the question image. The writer's tip text is unchanged.
- The app is one design language on iOS and Android (Expo, Uniwind). It does not restyle per operating system. A web export exists for review. (Platform value `adaptive` is the schema's closest fit; the language is shared, not per-OS.)
- Do not invent panda facts. Draft learning text is the writer's, kept as draft until the owner publishes it.
- Node, the design tokens, and the four type sizes are shared with the rest of the app. Learning screens must not restyle other screens.

## Brand Commitments

- The product name in the interface is 吱熊猫.
- Voice: plain Chinese for panda fans. Short labels. No explanatory paragraphs about the interface. No 「·」 as a separator.
- Color is Radix olive for neutrals, jade only as a rare small accent, amber for warnings, red for errors. Recorded in `docs/design/zhipanda-design-system.md` and `apps/mobile/src/global.css`.
- Type is Noto Sans SC for Chinese, four sizes only: 32, 20, 16, and 12.
- Lines are 0.5px. Lists use hairlines. Shadows are only for layers that actually float.

## Evidence on Hand

- Draft catalog: `data/curation/learning/learning.json` (version 2026.10.29.1). Every entry is `status: draft`.
- Writer brief: `docs/learning-content-brief.md`.
- Published panda photographs already in the media catalog. The quiz and face guides use those URLs. Do not generate substitute pandas.
- Design rules: `docs/design/zhipanda-design-system.md`.

## Product Principles

- Name the panda. The animal and the institution are the subject, not a generic species article.
- Show the photograph you can stand behind. Unpublished drafts and unsourced claims stay out of the public app.
- Chinese first. English is a field in the data, not a second interface.
- One atlas. Learning reads with the same type, color, and list structure as the rest of the app.
- A fan can finish the job: open a card, a face, or a quiz, and get back to that panda's profile.

## Accessibility & Inclusion

Touch targets stay at least 44pt. Text meets WCAG AA against the olive surfaces. Dark mode is a first-class appearance of the same tokens. (Inferred from the design system and the existing app, not from a separate accessibility brief.)

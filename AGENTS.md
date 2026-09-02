- Do not preserve backward compatibility. Remove obsolete paths instead of
  adding compatibility layers, fallbacks, or migrations.
- Choose the simplest implementation that fully meets the current
  requirements. Avoid speculative abstractions, configuration, and
  indirection.
- Grow the system in layers. Start from the smallest version that works end
  to end, and add each new capability on top of a product that already
  works. Never trade a working product for unfinished complexity.
- Keep components modular and concerns clearly separated.
- Prefer established, well-maintained libraries when they reduce overall
  complexity or improve reliability. Do not reimplement common
  functionality without a clear reason.
- Lean on the dependencies already in the project before writing your own
  implementation or adding packages. Do not assume a library lacks a
  capability without checking its documentation and types.
- Make architectural decisions for the long term. Do not accept a stopgap
  that only works for now and is meant to be replaced later.
- On this Windows-hosted repository, run Node.js/npm/NestJS/Vitest/ESLint/build
  commands with the Windows toolchain against the native `E:\` workspace
  (for example via `cmd.exe /d /s /c`). Do not run Node/npm through WSL against
  `/mnt/e`, because mixed Windows/WSL `node_modules`, permissions, native
  binaries, and small-file I/O make installs and verification unreliable.
  Use WSL only for tooling that genuinely requires Linux.
- Impeccable is the default design workflow for user-visible Web frontend work.
  Do not wait for the user to request it explicitly. Before changing a public
  UI/UX surface under `apps/web`, load `.agents/skills/impeccable/SKILL.md`, run
  its context setup for the concrete target, and use `apps/web/PRODUCT.md`,
  `apps/web/DESIGN.md`, plus the nearest persisted surface brief as design
  authority. Use the relevant Impeccable critique/shape/layout/typeset/adapt/
  audit/polish passes for the scope instead of treating the skill as an
  optional final review.
- For Web code changes, run `npm run check:impeccable -w web` (or the normal
  Web lint command, which includes it) before considering the work complete.
  Fix real detector findings rather than adding broad ignores. Only exclude
  generated code, third-party code, fixtures, or intentionally retired design
  prototypes. Admin/operator surfaces may use their own operational visual
  language; do not force the public panda-fan aesthetic onto admin screens, but
  the Impeccable detector and accessibility/craft checks still apply.
- The approved frontend interaction stack for `apps/web` is React Bits + GSAP +
  Motion + Lenis, used deliberately rather than stacked indiscriminately. These
  are available tools for achieving a premium, modern, photographic experience;
  the agent does not need to ask the user for permission each time they are the
  appropriate implementation choice.
- React Bits is the default source of expressive public-facing interaction and
  visual component patterns. Prefer official React Bits components/source when a
  suitable pattern exists instead of building a loose imitation. Use it for
  things such as animated content, masked/split headings, spotlight/glare/tilt
  treatments, pill or editorial navigation, image-led galleries, cursors and
  other reusable experiential primitives. Adapt styling to ZhiPanda's design
  system rather than copying demo aesthetics verbatim, and preserve keyboard,
  touch and reduced-motion behavior.
- Motion (`motion/react`) is the default React-native animation layer for local
  component state, entrance/reveal choreography, layout continuity, hover/tap
  feedback and small reusable interactions. Keep these animations restrained and
  composable. Do not use Motion to hand-build a complex spatial transition when
  GSAP/Flip is a clearer and more reliable fit.
- GSAP is approved for complex cinematic choreography and performance-sensitive
  spatial animation. Prefer GSAP Flip for shared-element/layout morphs such as a
  panda directory portrait expanding into the detail-page hero, and GSAP
  timelines when several animation phases must share one authoritative clock.
  Favor `transform`/`opacity` animation over repeatedly animating layout
  properties such as `left`, `top`, `width` and `height`. Do not run competing
  GSAP and Motion animations on the same property of the same element.
- Lenis is approved for premium long-page scrolling and scroll-linked experience
  when native scrolling feels insufficient. Use it for smooth reading journeys,
  galleries and other deliberate long-form surfaces, not as a substitute for
  route transitions. Integrate it only when the page benefits materially, keep
  native keyboard/touch semantics, and disable or simplify it for reduced-motion
  users when appropriate.
- Animation ownership should be explicit: React Bits supplies reusable visual
  patterns, Motion owns ordinary React micro-interactions, GSAP/Flip owns complex
  spatial morphs and coordinated timelines, and Lenis owns smooth-scroll feel.
  Prefer one owner per interaction. More libraries in one effect do not make the
  result more premium.
- For premium frontend work, motion quality is part of the craft floor: prefetch
  destinations before cinematic navigation where useful, align source and target
  geometry exactly, avoid layout-thrashing animation, keep a single transition
  timeline, and verify the real interaction in Playwright at desktop and narrow
  mobile widths. `prefers-reduced-motion` must always retain the full user journey.

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
- For public Web design and implementation, the newest approved prototype and
  its nearest persisted surface brief are the visual source of truth. Do not
  copy, restore, or preserve an older prototype merely because its code already
  exists. Older prototypes are historical reference only unless the current
  brief explicitly carries a pattern forward.
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
- shadcn/ui is the default source for generic Web UI primitives and controls.
  Before authoring a reusable button, input, select, dialog, sheet, drawer, tabs,
  popover, tooltip, accordion, command surface, form control, table primitive,
  badge, card shell or similar UI, check shadcn/ui first. The configured shadcn
  registries are the next source of reusable code: Animate UI, React Bits,
  Aceternity UI, KokonutUI and Magic UI. Prefer installing and adapting an
  established registry component over creating a parallel generic primitive.
  Review third-party registry source before adding it, keep ZhiPanda tokens and
  accessibility semantics authoritative, and avoid importing demo aesthetics
  wholesale.
- React Bits remains a preferred source for expressive public-facing interaction
  and visual patterns after the generic shadcn layer is exhausted. Use it for
  things such as animated content, masked/split headings, spotlight/glare/tilt
  treatments, image-led galleries, cursors and other reusable experiential
  primitives. Adapt styling to ZhiPanda's design system rather than copying demo
  aesthetics verbatim, and preserve keyboard, touch and reduced-motion behavior.
- Motion (`motion/react`) and GSAP are both approved for local state,
  entrance/reveal choreography, layout continuity, hover/tap feedback, scroll
  effects and cinematic spatial animation. Choose the implementation that best
  matches the selected component source, interaction quality, accessibility,
  maintainability and performance instead of assigning effects to a library by
  category. GSAP Flip remains a strong fit for shared-element/layout morphs such
  as a panda directory portrait expanding into the detail-page hero.
- Favor `transform`/`opacity` animation over repeatedly animating layout
  properties such as `left`, `top`, `width` and `height` when the same effect
  can be achieved cleanly. Do not run competing animation systems on the same
  property of the same element at the same time.
- Lenis is approved for premium long-page scrolling and scroll-linked experience
  when native scrolling feels insufficient. Use it only when the page benefits
  materially, keep native keyboard/touch semantics, and disable or simplify it
  for reduced-motion users when appropriate.
- Animation ownership should be explicit per interaction, but it is not tied to
  a fixed library taxonomy. React Bits, Motion, GSAP/Flip and Lenis may each own
  the interactions they implement best. More libraries in one effect do not
  make the result more premium.
- For premium frontend work, motion quality is part of the craft floor: prefetch
  destinations before cinematic navigation where useful, align source and target
  geometry exactly, avoid layout-thrashing animation, keep a single transition
  timeline, and verify the real interaction in Playwright at desktop and narrow
  mobile widths. `prefers-reduced-motion` must always retain the full user journey.

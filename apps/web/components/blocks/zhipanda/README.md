# ZhiPanda public blocks

Brand-owned public blocks live here only when generic UI primitives are not enough.

## Mature

- `PandaHeroRail` — named-panda horizontal discovery rail powered by Embla Carousel, with touch drag, snap behavior, control state and reduced-motion-safe styling.
- `LicensedHeroVideo` — licensed ambient hero media with desktop video selection, mobile poster fallback and visible source/license attribution.
- `ZhiPandaLogo` — scalable brand mark/wordmark component backed by the global ZhiPanda brand tokens.

## Rules

- Data interface must not depend on a specific page view model.
- Interaction behavior belongs in the block.
- Brand colors, type and radii come from global `--zp-*` tokens.
- Page files compose blocks; they should not reimplement rail/hero interaction.
- Prefer shadcn/Radix/Animate UI for generic primitives before adding a domain block.

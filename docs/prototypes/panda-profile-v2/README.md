# Panda Profile V2 responsive prototypes

These prototypes support Wayfinder issue #231 and the specification in `docs/design/panda-profile-v2-specification.md`.

They are decision artifacts, not production code. Do not copy their fixture content, CSS, or markup directly into the application.

## Scenarios

- `rich.html`: 喜伦 / Xi Lun using approved public release `2026.07.24.2` identity, events, residencies, family, media, and release metadata. Any future-capacity block is explicitly marked as a design fixture and makes no claim about the panda.
- `sparse.html`: 轮辉 / Lun Hui using an identity-first public record and an intentional no-media, low-module composition.
- `historic.html`: an explicitly fictional design fixture used only to validate deceased language, approximate dates, final-known place, restricted historic media, and revision treatment.

## Review widths

Open each file directly in a browser and review at:

- 1440 x 1000 desktop;
- 1024 x 900 tablet;
- 390 x 844 mobile;
- 320 x 720 narrow mobile;
- 200% browser zoom.

The prototypes contain no required JavaScript. Section navigation, evidence disclosures, timeline reading, and source access remain native HTML.

Rendered review evidence is stored in `screenshots/`:

- `rich-desktop.png` and `rich-mobile.png`;
- `sparse-desktop.png` and `sparse-mobile.png`;
- `historic-desktop.png` and `historic-mobile.png`.

The screenshots were rendered with local Chrome at 1440 × 1000 and 390 × 844. Automated layout checks also cover 320, 1024, and 1440 pixel widths.

## Design parameters

- `DESIGN_VARIANCE: 7`
- `MOTION_INTENSITY: 4`
- `VISUAL_DENSITY: 6`

Pinned inputs:

- `pbakaus/impeccable@32930818a109fafa87199babe92fa8e530cff5d3`
- `Leonxlnx/taste-skill@e988add20dab0fa97d7a76781c48961c8184288e`

## Review questions

1. Does the first viewport establish identity and current or final known state before audit metadata?
2. Does the page remain intentional without hosted media?
3. Are narrative and evidence clearly related without having equal visual weight everywhere?
4. Do empty modules disappear without making the record feel broken?
5. Can every fact, event, relation, place, media state, and revision still be understood without motion or JavaScript?
6. Does mobile preserve the name before tall media and avoid horizontal chapter scrolling?

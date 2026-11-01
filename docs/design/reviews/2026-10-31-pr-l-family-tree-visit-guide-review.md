# PR L skill review: 家谱与参观攻略 (2026-10-31)

A pre-merge review of PR L (page plan N2 家谱; N4 去基地前 folded into the institution page as 参观攻略), run with the skills in `.agents/skills` (impeccable, review-animations, break-ui, make-interfaces-feel-better, apple-design). Base: `f6dd99e` (main, after #762). Fixes land in the same branch.

**Surfaces:** 家族 `/pandas/[slug]/family`, institution `/institutions/[slug]`. Code changed in:
- `apps/mobile/src/features/family/lineage.ts` (new, pure): walks sourced parent links up to three generations up and down, names each relative by side (爷爷/奶奶/外公/外婆, 孙子/孙女/外孙/外孙女), counts missing ancestors, and groups living descendants by place.
- `apps/mobile/src/features/family/lineage-load.ts` (new): loads the links and the evidence records behind them; a source that fails to load is dropped, never filled in.
- `apps/mobile/src/features/family/family.ts`: the tree only draws links that have a source.
- `apps/mobile/src/app/pandas/[slug]/family.tsx`: summary tiles, “后代现在住在”, one list section per generation, and an 出处 section.
- `apps/mobile/src/features/institutions/institutions.ts`, `apps/mobile/src/features/engagement/seen.ts`, `apps/mobile/src/app/institutions/[slug].tsx`: 参观攻略 replaces the old 去之前 rows and the 官网 row.
- Data: none. Everything shown comes from published lineage links, evidence records and visit guides.

**How it was checked:** Expo web dev build against the local proxy, Playwright + Chrome, signed in (aal2). The Smithsonian visit guide in the proxy fixture is copied from `data/curation/institutions/institutions.json` (production has no institutions until release 2026.10.30.1 is published). Profiles: `base` 390×844 light and dark, `dt200`, `w320`, and the proxy's `worst` and `empty` modes. Pages: 宝力, 宝宝, 美香, Kouhin family pages, and 史密森国家动物园.

Screenshots: `/workspace/pr-l-shots/before/normal/`, `/after/normal/` and `/after/stress/` (local to the review box, not committed).

**References (from the page plan):** family trees on X (codyhunk/status/2071243717961531396, leoy_io/status/1939511027370000837, LazySpider3/status/1782758277434233200) read as one line per generation with a clear “you are here”; Merlin's “Likely birds here” and the All About Birds Merlin guide set the pattern for “这次去 · 还没见过”, a checklist of what you have not seen yet at this place; Seamgen's San Diego Zoo app puts the practical visit facts (hours, tickets, where the animals are) in one block before the content.

## impeccable

- **Fixed:** the first draft used “外孙子”; the standard term is 外孙. Tests cover side-by-side naming (`lineage.test.ts`).
- **Fixed:** “中国” (country-level place) was counted as a place in “分布”. It now counts toward “还有 N 只的具体住处暂无公开资料”.
- **Kept:** the great-grandparent row reads “暂无公开资料” when none are known. It says what is missing rather than hiding the generation.
- Deceased pandas follow `DECEASED_POLICY`: marked plainly 已离世, not counted in “后代现在住在”.

## review-animations

- No new motion. The rows use the existing `ListCell` press state; the tree keeps its existing behaviour. Nothing to gate behind Reduce Motion.

## break-ui

- **w320 / dt200:** the stat tiles stack in single-column mode; long Chinese and English values (address, 开放时间) wrap. **Fixed:** the stat labels were too long (“后代现在住在”) and wrapped at w320; they are now 上溯 / 后代 / 分布.
- **worst:** slow and partial responses show the skeleton, then the page; a failed evidence fetch leaves the 出处 section shorter, never with invented entries.
- **empty:** no residents means no “这次去” section; no guide and no website means no 参观攻略 at all; a website with no guide shows “这里还没有收录参观信息，出发前请看官网。”.
- **Horizontal scroll:** wide trees (美香, 宝宝) scroll sideways inside the tree card, as on main. The linear list below is the way to read them at large text.

## make-interfaces-feel-better

- **Fixed:** every row repeated “出处 nationalzoo.si.edu” when the whole page had one publisher. The per-row host now shows only when the page has more than one publisher; the 出处 section always lists them.
- Opening hours and tickets carry “以官方公布为准。核实于 …” once, at the top of the guide, not per row.
- Lucide icons mean something: Network (上溯), Users (后代), MapPin (分布 and 地址), Clock, Ticket, PawPrint, Globe, FileText.

## apple-design

- Grouped inset lists, v2 tokens only (`design:tokens:check` passes), one large title, section headers as footnote headings.
- Every relative is one row with a 44pt+ target and the hint “打开它的家谱”; the list reads in generation order for VoiceOver.
- 参观攻略 is a heading; the facility name is only a title when the institution has more than one facility.

## Open

- Lineage data is sparse (15 sourced links in production), so most pandas show a short family. The page says so honestly.
- 参观攻略 only appears in production after release 2026.10.30.1 is published.

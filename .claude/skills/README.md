# 仓库内嵌与镜像技能

本目录与 `.agents/skills/` 保持逐字节 1:1 镜像（LF 换行），由 `npm run check:repository-hygiene`（及 `npm run verify:dev`）自动校对。其中 `.agents/skills/` 供 Antigravity 加载，`.claude/skills/` 供 Claude Code 加载。

包含以下 **49 个镜像技能**：

1. **44 个 `pstack` 技能**（基于 `cursor/plugins/pstack` `0.15.48` 与 `michael-denyer/pstack-claude`，MIT 协议，授权文件见 `.agents/skills/PSTACK-LICENSE.txt`）：
   - **总控与规划（5 个）**：`poteto-mode`（内含 22 套剧本、`references/principles/` 24 条原则细则、`references/agy-tools.md` 工具映射、`worker.md` 与 `scripts/{resume,worktree-audit}.ts`）、`figure-it-out`、`architect`、`blast-radius`、`setup-pstack`
   - **实现、性能与状态建模（7 个）**：`tdd`、`swarm`、`arena`、`typescript-best-practices`、`correct`、`benchmark-checklist`、`statechart`
   - **理解、提问、汇总与写作（14 个）**：`reframe`、`how`、`why`、`teach`、`in-your-own-words`、`sharpen`、`recall`、`what-did-i-get-done`、`ketchup`、`ketchup-video`、`bro`、`deslop`、`unslop`、`technical-writing`
   - **对抗审查、决策审计与自进化（8 个）**：`interrogate`、`thermo-nuclear-review`、`thermo-nuclear-code-quality-review`、`thermos`、`no-comments`、`show-me-your-work`、`reflect`、`automate-me`
   - **验证工程化维护（4 个）**：`create-verification-skill`、`maintain-verification-skill`、`create-formal-verification-skill`、`maintain-formal-verification-skill`
   - **GitHub PR 协作与导航（6 个）**：`make-pr-easy-to-review`、`babysit`、`fix-ci`、`fix-merge-conflicts`、`get-pr-comments`、`poteto-help`
2. **5 个互补技能**（源自 `mattpocock/skills`，MIT 协议）：
   - `codebase-design`、`grilling`、`improve-codebase-architecture`、`to-questionnaire`、`wizard`

其他项目专属与外部技能保持原位，不放入本镜像目录：

- 移动端应用验证驱动技能保留在 `apps/mobile/.claude/skills/verify/`。
- 其余外部 UI 与动效技能（如 `emilkowalski/skills`、`make-interfaces-feel-better`）继续固定在 `skills-lock.json` 中由客户端插件提供。

# AGENTS.md

本文件规定 AI 编程助手在本项目中的工作方式。目标是：**理解现有实现、进行最小必要修改、保持代码简单、验证真实结果**。项目已有的规范、配置和测试要求优先；不要凭习惯替换现有技术方案。

## 1. 开始任务前

- 先阅读与任务相关的 README、项目配置、现有实现和测试；不要在不了解上下文时直接改代码。
- 优先沿用项目已经采用的目录结构、命名方式、依赖和设计模式。
- 确定修改范围和潜在影响；复杂任务先给出简短计划，再实施。
- 不要擅自扩大需求。发现无关问题时，说明问题而不是顺手重构。

## 2. 架构与修改范围

- 保持现有模块边界和依赖方向，不为图方便而跨层调用或引入循环依赖。
- 复杂功能先确定核心数据结构与模块边界，优先删除冗余逻辑，再进行最小实现。
- 优先最小、局部、可回滚的修改；避免与当前任务无关的格式化、重命名或文件搬迁。
- 需要修改生成代码时，先找到源定义和生成命令；不要直接编辑可再生的产物。
- 不引入新依赖或新框架，除非现有方案确实不足，并说明理由。

## 3. 开源调研与方案取舍

- 遇到不熟悉或复杂的功能，先查项目现有实现，再搜索 GitHub 等开源方案，避免重复造轮子。
- 参考项目同时关注 **Star 数和近期更新情况**，比较其适用场景、依赖、许可证及与当前需求的差异。
- 先说明选择复用、借鉴或自研的理由，不直接照搬；完成最小验证后再集成。

## 4. 代码风格

- 以可读性和简单性为先；避免过度设计、无意义的抽象和仅使用一次的包装函数。
- 尽量保持函数职责清晰；复杂逻辑可以拆分，但不要为了拆分而拆分。
- 优先使用清晰的命名、提前返回和不可变变量；仅在确有需要时使用可变状态。
- 删除无用代码、无用导入和调试输出；不要保留没有价值的兼容分支。
- 注释应解释**为什么**这样做以及重要约束，而不是重复代码表面含义。
- 对 TypeScript 项目：避免 `any`，优先利用类型推断；在公共接口和重要边界处明确类型。

## 5. 数据、错误与安全

- 在外部输入、网络响应、配置和持久化数据等信任边界进行必要验证；内部逻辑尽量复用已确认的约束，避免重复检查。
- 错误处理应具体、可理解；不要无故吞掉异常，也不要添加没有依据的复杂防御逻辑。
- 修复 Bug 先复现并定位根因，避免通过补丁、重试或额外判断掩盖问题。
- 不得在代码、日志或回答中暴露密钥、令牌、密码和其他敏感信息。
- 对删除数据、修改生产环境、执行迁移、覆盖用户文件等高影响操作，先说明影响并征得明确同意。

## 6. 测试与验证

- 优先验证真实行为，尽量减少与实际实现脱节的 Mock。
- 验证真实运行结果，而不只依赖编译和测试通过；重复出现的问题优先通过类型、Lint、测试或脚本固化约束。
- 修复 Bug 时，条件允许应增加能复现问题的回归测试；新增功能应覆盖关键路径和合理的边界情况。
- 先查看项目提供的测试、Lint、类型检查和构建命令，再使用对应命令；不要臆造脚本。
- 优先运行与修改范围直接相关的检查；必要时再扩大到完整项目。
- 不得声称未运行的测试已通过。受环境限制无法验证时，明确说明未验证的内容和原因。

## 7. Git 与交付

- 不要未经要求创建提交、推送分支、重写 Git 历史或修改远程仓库。
- 不覆盖用户已有的未提交修改；遇到冲突或不确定的修改来源时先说明情况。
- 提交信息应简洁、描述实际变更；如项目已有 Commit/PR 规范，优先遵守。
- 完成后简要说明：**修改了什么、为什么这样改、执行了哪些验证、还有哪些风险或限制**。

## 8. 决策原则

- **已有实现优先于个人偏好。**
- **简单、明确的方案优先于复杂、通用但暂时用不到的方案。**
- **真实验证优先于主观确信。**
- **用户明确要求的范围优先于顺带优化。**
- 如果存在多种合理方案，优先选择修改范围小、维护成本低、符合当前架构的方案。

## Matt Pocock 技能与 Issue 工作流

Matt Pocock skills are tracked under `.agents/skills/` as the synced release (v1.3.1) for agents without the plugin. The installed `mattpocock-skills` plugin of the same release is equivalent; use whichever your harness loads.

### Issue tracker

Work is tracked in GitHub Issues for `SwayingWindmill/PandaAtlas`. For project-status or next-work questions, use live `main` plus GitHub state as described in `docs/agents/issue-tracker.md`.

For issue implementation, create a branch in the existing `E:\Code\PandaAtlas` checkout. Create a worktree only when the user explicitly requests parallel work.

### Issue completion

When an issue is merged and closed, report it and its verification to the user. Start the next issue when the user asks to continue or has already named the order to work through. Run the repo-local `/retro` only when the user asks for one.

### Triage labels

Use the repository's five canonical triage roles. See `docs/agents/triage-labels.md`.

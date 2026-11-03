# 问问熊猫离线评测结果（2026-11-01，北京时间）

- 题集：`in-corpus.jsonl` 49 题（中 31 / 英 18），`out-of-corpus.jsonl` 32 题（24 题应拒答，4 题认脸、4 题不安全由守卫直接拦截，不调用模型）。
- 检索：AI Search 索引要等部署后的定时同步才会有内容，所以这次用 `ask-eval.spec.ts` 里的确定性模拟检索（期望片段 + 词面干扰片段，最多 6 段）。阈值和真实召回没有测到。
- 模型：Workers AI REST 直接调用（没有走 AI Gateway），先 `@cf/qwen/qwen3-30b-a3b-fp8`；引用校验失败（noCitation / unknownSource / quoteMismatch）时换 `@cf/zai-org/glm-4.7-flash`，和线上逻辑一致。
- 用量：本轮约 1,089 neurons（qwen 73 次约 923，glm 10 次约 166），在每天 10,000 免费额度内。

| 指标 | 结果 |
| --- | --- |
| 题库外问题拒答率 | 24/24 = 100%（守卫另拦截 8/8） |
| 题库内问题给出答案 | 46/49 = 93.9% |
| 给出的答案引用了期望来源 | 46/46 = 100% |
| 引用有效率（最终带引用的模型回答通过服务端原文校验） | 46/48 = 95.8% |
| 答案包含全部关键词 | 43/46（3 题是日期/地点换了写法，人工核对内容正确） |

未通过：
- in-en-11、in-en-16：两个模型都把中文片段译成英文当引用，被服务端校验拦下，最终给用户的是“没找到可靠资料”的拒答，没有展示错误内容。
- in-en-18（英文问野外数量）：对应文章只有中文正文，模型拒答。

复现：`ASK_EVAL_PROMPTS=prompts.jsonl npx vitest run test/ask-eval` 生成提示词；用模型跑完后每次尝试写一行 `{id, model, raw}` 到 outputs.jsonl，再 `ASK_EVAL_OUTPUTS=outputs.jsonl npx vitest run test/ask-eval` 打分。

> 说明：评测跑完之后，系统提示词和拒答文案里的品牌名从误写的「知熊猫」改成了「吱熊猫」，其余提示词不变。这个改动没有重新跑完整评测。

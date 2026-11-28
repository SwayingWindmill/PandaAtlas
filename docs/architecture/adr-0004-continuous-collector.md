# ADR 0004：持续运行的多平台采集系统

- 状态：已接受（2026-11-05）
- 取代：`docs/data-acquisition/` 下的受控采集体系（候选契约 v1、adapter runner v1、逐源审核登记表、Scrapy/Scrapling PoC）
- 修订：ADR-0002 对采集部分的约束（见"部署"）
- 被修订：第 4 层（智能处理层）和"部署"里采集结果进入 App 的方式，由 [ADR-0005](adr-0005-panda-news-and-fact-updates.md) 修订

## 背景

旧体系的出发点是"每个信源先审核、采集结果只能当候选、遇到拦截就停"。它保证了不越界，但三个月里只接入了 6 个信源，覆盖不到小红书、抖音、微博这些熊猫动态真正首发的地方。吱熊猫需要一套持续运行、能及时发现新内容、坏了能自己恢复的采集系统。

## 决定

按《熊猫信息聚合平台采集系统建设规划书》建设 `services/collector`：

1. **采集层**：每个平台一个适配器，各自调用专用采集器——RSS/官网（含 RSSHub 路由）、xiaohongshu-mcp、Douyin_TikTok_Download_API、weibo-crawler、MediaCrawler。适配器只负责"取一页、给出下一页游标"，不管调度。
2. **调度层**：PostgreSQL 里的 `targets` 表就是任务队列。每个目标有自己的间隔、游标、失败计数和下次运行时间；按平台分组并发，一个平台熔断不影响其他平台。
3. **数据层**：独立的 PostgreSQL 库保存原始内容（`items`）、每次内容变化的历史版本（`item_versions`）、每次运行记录（`runs`）和告警（`alerts`）。原始记录永不删除，AI 只打标。
4. **智能处理层**：采集到的内容经 outbox 推给 AIHOT 的 `POST /api/ingest/items`，由 AIHOT 做判重、精选、聚簇和热度。熊猫个体识别用 `data/curation/pandas/pandas.csv` 生成的名字和别名词库，先在采集器里打标，再一起推给 AIHOT。

旧的 `tools/panda-data` 采集运行时（`panda_data.acquisition`、`crawler` extra、`crawler-poc.yml`、`data/acquisition-sources/`）随本 ADR 删除。`tools/panda-data` 的策展校验、媒体处理和发布流水线不受影响。

## 部署

采集器要长期保持登录态和浏览器会话（小红书扫码登录、抖音身份池、微博 Cookie），这在 GitHub Actions 和 Cloudflare Workers 上都做不到。因此：

- **采集器运行在一台常驻主机上**（家用小主机或一台云主机均可），用 `infra/collector/compose.yml` 起 PostgreSQL、RSSHub、xiaohongshu-mcp；采集器本身和 weibo-crawler、MediaCrawler 在同一台主机上用 `uv` 运行。
- 线上 App、API、Supabase 仍按 ADR-0002 运行在托管服务上。采集器不直接写 Supabase；要把采集结果用到 App 里，走现有的内容录入流程（`docs/runbooks/content-entry.md`），或者以后单独加一个只读 API。

这是对 ADR-0002"不运行自管服务器"的明确例外，只适用于采集器。

## 已知风险（规划书里需要修正的地方）

| 问题 | 影响 | 本次的处理 |
|---|---|---|
| MediaCrawler 采用"非商业学习许可"，明确禁止商业使用和大规模爬取 | 吱熊猫若商业化，继续用它就违反许可 | 只作为第一阶段的对照采集器，默认关闭；最终选型不能是它。它还会把作者 ID 哈希、昵称打码，做不了"重点账号"监控 |
| weibo-crawler 没有许可证 | 默认保留所有权利，不能把它的代码放进仓库 | 只在主机上单独 clone 后用子进程调用，不复制代码 |
| Douyin_TikTok_Download_API 的身份池会在被风控后自动轮换身份 | 平台可能认定为规避风控，账号和 IP 风险由运营者承担 | 照常接入；告警里单独记录 `IDENTITY_POOL_EXHAUSTED`、`UPSTREAM_RISK_CONTROL` |
| 小红书、抖音、微博用户协议禁止未经授权的自动采集；评论和用户主页是个人信息 | 封号、律师函、个人信息保护法合规风险 | 评论采集默认关闭；只保存公开内容；媒体文件默认不下载，只存地址 |
| 规划书写"15 分钟"监控社交账号 | 登录态账号被限流、封禁的主要诱因 | 默认间隔：官方 RSS 15 分钟，社交账号 90 分钟，关键词 180 分钟，按测试结果再调 |
| AIHOT 是一整套网站（Node 24 + PostgreSQL 17 + Docker），不是库 | 要单独部署和维护一个 AIHOT 实例 | 通过它的推送接口接入，不改它的代码；熊猫词库、分类提示词放在 AIHOT 实例的 `industry/` 目录里定制 |
| xiaohongshu-mcp 访问用户主页需要该用户的 `xsec_token` | 重点账号清单里每个小红书账号都要带 token，token 过期要换 | 目标配置里带 `xsec_token`；失效时按"登录/凭据失效"告警 |
| 第七节指标里的"重复记录率 ≤1%" | 同一平台内用平台 ID 去重可以保证；跨平台重复要靠 AIHOT 聚簇，无法单独验收 | 报告里分开统计平台内重复和跨平台事件 |

## 后果

- 新增一个 Python 服务 `services/collector`，有自己的数据库和运行主机。
- 采集结果不再经过逐源审核和候选审批，内容质量由 AIHOT 精选和人工发布把关。
- 运营者需要维护各平台的登录态：扫码、Cookie、`xsec_token` 失效时会收到告警。

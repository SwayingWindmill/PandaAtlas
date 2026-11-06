# 采集器 `services/collector`

持续采集熊猫相关内容：动物园和机构官网、小红书、抖音、微博、B 站。设计和取舍见 [ADR 0004](../../docs/architecture/adr-0004-continuous-collector.md)。

```text
官网 RSS / RSSHub ─┐
xiaohongshu-mcp ───┤                                  ┌─> 告警（飞书 / 企业微信 webhook）
Douyin API (v5) ───┼─> 适配器 ─> 调度 ─> PostgreSQL ─┤
weibo-crawler ─────┤                                  └─> outbox ─> AIHOT /api/ingest/items
MediaCrawler ──────┘     （仅第一阶段对照）
```

## 组成

| 模块 | 作用 |
|---|---|
| `adapters/` | 每个平台一个适配器：取一页，给出下一次的游标 |
| `scheduler.py` | 到期目标按适配器分组运行；失败退避；登录失效、限流、验证码时整个适配器暂停并告警 |
| `store.py` + `schema.sql` | 目标即任务队列；原始内容、历史版本、运行记录、告警、outbox |
| `lexicon.py` | 用 `data/curation/pandas/pandas.csv` 和 `data/collector/aliases.yaml` 给内容标出提到的熊猫 |
| `aihot.py` | 把新内容和修订推给 AIHOT，一个采集目标对应 AIHOT 里的一个信源 |
| `report.py` | 第一阶段的采集器对比报告 |

## 采集策略

| 层级 `tier` | 内容 | 默认间隔 |
|---|---|---|
| `official` | 官网、官方 RSS | 15 分钟 |
| `key_account` | 动物园、机构、熊猫博主账号 | 90 分钟 |
| `keyword` | 熊猫名字、话题 | 180 分钟 |
| `backfill` | 历史补采 | 每天 |

目标在 [`data/collector/targets.yaml`](../../data/collector/targets.yaml) 里配置，可以逐个改 `interval_minutes`。

- **增量**：游标记住已存内容里最新的发布时间。账号类目标翻页到这个时间为止，最多 `max_pages` 页（默认 3）。
- **断点续采**：游标只在保存成功后更新。失败或暂停后，下一次从原游标继续，补上中间漏掉的内容。
- **平台隔离**：每个适配器有独立的并发名额和暂停状态。浏览器类采集器一次只跑一个目标。
- **去重与历史**：同一平台按平台 ID 去重。标题、正文或媒体类型变了，就记一个新版本，旧版本保留在 `item_versions`。跨平台的同一件事由 AIHOT 聚成事件。
- **异常监测**：登录失效、限流、验证码会暂停整个适配器并告警；同一目标连续失败 3 次告警；连续空结果超过阈值也告警（官方源 96 次，其他 8 次，可用 `params.empty_alert_after` 改）。同一个告警没解决前不会重复发送。

## 账号角色与登记表

账号类目标在 targets.yaml 里带两个字段，用来判断一条帖子的原作者是谁（设计见 [ADR 0005](../../docs/architecture/adr-0005-panda-news-and-fact-updates.md)）：

| 字段 | 说明 |
|---|---|
| `role` | `institution`（机构自己的账号）、`official`（其他官方频道，以及我们还没有机构 slug 的机构）、`media`、`fan`。写错会在加载时报错；关键词和补采目标不写 |
| `institution` | 知熊猫的机构 slug（`data/curation/institutions`）。`role: institution` 时必填 |

新增账号后运行 `uv run python scripts/assign_roles.py` 补上角色，再核对一遍结果；已有角色的目标不会被改。

`uv run collector registry --out <路径>` 从 targets.yaml 生成 JSON：`accounts` 是账号登记表（平台、账号 id、角色、机构），`sources` 是 AIHOT 的信源（`id` 与推送时的 `sourceId` 相同，分级 `institution`→`T1`、`official`→`T1_5`，其余→`T2`，`participation_mode` 为 `editorial`）。输出顺序固定，可以直接提交或比对。

推给 AIHOT 的每条内容除标题、链接和时间外，还带 `bodyText`、`excerpt`（正文前 200 字）、`media`（只收 http/https 的图片和视频），以及 `raw.externalId`（`<平台>:<平台内容 id>`）、`raw.author`。转发的帖子再带 `raw.originalAuthor`；目前只有微博（weibo-crawler 的 `retweet`）取得到原作者，其他平台不带这个字段。

## 在采集主机上部署

需要 Docker、[uv](https://docs.astral.sh/uv/) 和 Python 3.12。

**1. 起基础服务**（PostgreSQL、RSSHub、xiaohongshu-mcp）：

```bash
cp infra/collector/env.example infra/collector/.env   # 填好里面的值
docker compose -f infra/collector/compose.yml --env-file infra/collector/.env up -d
```

**2. 小红书扫码登录。** 第一次启动后，用 xiaohongshu-mcp 的登录工具扫码，cookie 会存在 `infra/collector/data/xhs`：

```bash
curl -s -H "Authorization: Bearer $XHS_MCP_TOKEN" http://localhost:18060/api/v1/login/qrcode
```

返回的 `img` 是 Base64 的二维码图片。

**3. 抖音 API。** 它有自己的 compose（API、worker、PostgreSQL、Redis），按它的文档单独部署，再在控制台建一个只读 API key：

```bash
git clone https://github.com/Evil0ctal/Douyin_TikTok_Download_API ~/collectors/dtk
cd ~/collectors/dtk && docker compose -p dtk -f docker/compose.yml up -d
```

**4. 微博。** clone 一份专给采集器用的 weibo-crawler（每次运行都会改写它的 `config.json`），装好依赖：

```bash
git clone https://github.com/dataabc/weibo-crawler ~/collectors/weibo-crawler
cd ~/collectors/weibo-crawler && python -m pip install -r requirements.txt
```

**5. MediaCrawler（可选，只用于第一阶段对照）。** 许可证禁止商业使用，不要长期开着：

```bash
git clone https://github.com/NanmiCoder/MediaCrawler ~/collectors/MediaCrawler
cd ~/collectors/MediaCrawler && uv sync && uv run playwright install chromium
```

**6. AIHOT。** 按 [AIHOT 的文档](https://github.com/KKKKhazix/AIHOT) 部署一个实例，在它的 `.env` 里设 `INGEST_TOKEN`（至少 16 位）。熊猫相关的分类和精选标准写在 AIHOT 实例的 `industry/` 目录里。

**7. 启动采集器。** 环境变量见下表，可以写进 `services/collector/.env` 后再 `set -a; . ./.env`：

```bash
cd services/collector
uv sync
uv run collector migrate
uv run collector sync
uv run collector run
```

| 变量 | 说明 |
|---|---|
| `COLLECTOR_DATABASE_URL` | 默认 `postgresql://collector:collector@localhost:55432/collector`，即 compose 里的库 |
| `RSSHUB_URL` | 例如 `http://localhost:1200`；`rsshub:/...` 形式的目标会接到这里 |
| `XHS_MCP_URL`、`XHS_MCP_TOKEN` | 例如 `http://localhost:18060`；token 与 compose 里的 `XHS_MCP_TOKEN` 相同 |
| `DOUYIN_API_URL`、`DOUYIN_API_KEY` | 例如 `http://localhost:8000` |
| `WEIBO_CRAWLER_DIR`、`WEIBO_COOKIE` | weibo-crawler 的目录和微博 Cookie；`WEIBO_CRAWLER_CMD` 默认 `python weibo.py` |
| `MEDIACRAWLER_DIR` | 设了才启用 MediaCrawler；`MEDIACRAWLER_CMD` 默认 `uv run main.py` |
| `AIHOT_URL`、`AIHOT_INGEST_TOKEN` | 两个都设了才推送 |
| `COLLECTOR_ALERT_WEBHOOK` | 群机器人 webhook；`COLLECTOR_ALERT_FORMAT` 取 `feishu`（默认）、`wecom` 或 `slack` |

没配置的适配器不会启用，它的目标留在库里，不算失败。

## 日常运维

```bash
uv run collector status                  # 暂停的适配器、失败和空结果的目标
uv run collector once --target <id>      # 立刻跑一个目标，调试用
uv run collector resume xhs_mcp          # 重新登录后解除暂停，并立刻补采
uv run collector report --days 14 --out report.md   # 第一阶段对比报告
uv run collector tag "福宝今天在吃竹笋"    # 看一段文字会被标成哪些熊猫
```

**收到"登录失效"告警**：重新扫码（小红书、MediaCrawler）、换 Cookie（微博，改 `WEIBO_COOKIE` 后重启），或在抖音 API 控制台导入新身份，然后运行 `collector resume <适配器>`。

**收到"连续空结果"告警**：先在浏览器里打开该账号，看它是不是真的没发新内容；如果有新内容，说明采集器拿到的是空页，多半是登录态或接口变了。

## 测试

```bash
uv run --extra dev pytest
uv run --extra dev ruff check src tests
```

存储和调度的测试连真实的 PostgreSQL：先 `docker compose -f infra/collector/compose.yml up -d postgres`。测试在同一服务器上自建 `collector_test` 库，不碰采集器的正式库；也可以用 `COLLECTOR_TEST_DATABASE_URL` 指向别的空库，测试会清空其中的表。

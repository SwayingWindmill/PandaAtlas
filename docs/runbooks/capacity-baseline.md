# 后端容量基线与压测指南 (`capacity-baseline.md`)

本文档记录 `zhipanda-v2-api` 的生产运行时连接约束、[load-test-api.mjs](../../scripts/development/load-test-api.mjs) 的安全压测方法、本机 NestJS 实测基线，以及上线前的缓存优化与 Supabase 扩容阈值。

## 1. 生产拓扑与连接约束（基于当前代码事实）

1. **Worker 地域固定与连接模式**（见 `services/api/cloudflare.config.ts`）：
   - Worker 名称为 `zhipanda-v2-api`，绑定域名 `api.zhipanda.com`，通过 `placement: { region: "aws:ap-northeast-1" }` 固定部署在东京区域（紧邻同区 Supabase Postgres）。
   - `DATABASE_CONNECTION_MODE` 为 `"hyperdrive"`，绑定 `HYPERDRIVE`，并每 15 分钟触发一次 `scheduled` 任务（`*/15 * * * *`）。
   - Cloudflare 限流绑定分为 3 个独立命名空间：`ASK_RATE_LIMIT`（每 60 秒 5 次）、`WRITE_RATE_LIMIT`（每 60 秒 60 次）与 `SENSITIVE_RATE_LIMIT`（每 60 秒 5 次）；`ASK_GLOBAL_DAILY_CAP` 为 `30`。
2. **每请求短池与 Hyperdrive 5 连接上限**（见 `services/api/worker/index.mjs` 与 `services/api/src/platform/database/database.service.ts`）：
   - `worker/index.mjs` 对每个 HTTP 请求调用 `database.withRequest(bindings.HYPERDRIVE.connectionString, ...)`。
   - `DatabaseService.withRequest()` 在 `AsyncLocalStorage` 中为该请求创建 `new pg.Pool(..., max = 1, min = 0)` 和 `Kysely` 实例，并在 `finally` 中执行 `await db.destroy()`；代码注释明确说明 Hyperdrive origin 上限为 **5 个连接**（单请求单连接，以容纳多请求并发重叠）。
   - `services/api/src/platform/config/app-config.ts` 默认数据库连接超时参数：`DB_POOL_MAX=1`（允许范围 1–10）、`DB_CONNECTION_TIMEOUT_MS=5000`、`DB_IDLE_TIMEOUT_MS=10000`、`DB_MAX_LIFETIME_SECONDS=300`、`DB_STATEMENT_TIMEOUT_MS=10000`、`DB_IDLE_TRANSACTION_TIMEOUT_MS=5000`。
   - 并发隔离行为由 `services/api/test/database-concurrency.spec.ts` 验证。
3. **`PublicReadCache` 命中路径 vs 直连 Postgres 路由**（见 `services/api/src/modules/public-read/infrastructure/public-read-cache.ts` 与 `services/api/src/modules/public-read/infrastructure/caching-public-read.repository.ts`）：
   - **实例内存代际缓存路由（热命中不占用 Postgres 连接）**：`/api/v2/release`、`/api/v2/pandas`、`/api/v2/pandas/:slug`、`/api/v2/panda-covers`、`/api/v2/places`、`/api/v2/places/:slug`、`/api/v2/institutions`、`/api/v2/institutions/:slug`、`/api/v2/lineage`、`/api/v2/residencies`、`/api/v2/life-events`、`/api/v2/evidence/:sourceId`、`/api/v2/stats`。上述读取通过代际键与同键单飞去重（`loads` Map）缓存；Kysely 在首次执行 SQL 前不会向 `pg.Pool` 借连接，因此缓存命中时不会消耗 Hyperdrive 的 5 连接配额。
   - **未进 `PublicReadCache`、每请求查库路由（主要容量瓶颈）**：
     - `PostgresJsonCatalogStore`（见 `services/api/src/modules/catalog/http/catalog.controllers.ts` 与 `services/api/src/modules/catalog/infrastructure/postgres-json-catalog.store.ts`）：`/api/v2/learning`、`/api/v2/comparisons`、`/api/v2/overseas-status`、`/api/v2/venue-news`。
     - `/api/v2/popular-pandas`（`PopularityApplication.popular()` 复用缓存的熊猫列表后，仍每次查 `engagement.favorites`）、`/api/v2/updates`、`/ready`、`/api/v2/games/*` 及所有需要鉴权的 `/api/v2/me/*` 路由。

## 2. 压测脚本用法与安全护栏 (`scripts/development/load-test-api.mjs`)

脚本默认仅允许针对回环地址（`127.0.0.1`、`localhost`、`::1`）运行。对非回环主机目标必须在明确授权后**同时**传入 `--allow-remote --confirm-host <exact-hostname>`，否则拒绝执行，防止误打线上生产环境。

```bash
# 查看参数说明
node scripts/development/load-test-api.mjs --help

# 1) 纯缓存命中场景（需先确保本地 API 已启动）
node scripts/development/load-test-api.mjs --base-url http://127.0.0.1:3001 --scenario public-cached --concurrency 1,5,10,20 --requests 100 --warmup 10 --format markdown

# 2) 纯直连 Postgres 场景（观测 >5 并发后的排队拐点）
node scripts/development/load-test-api.mjs --base-url http://127.0.0.1:3001 --scenario public-db-uncached --concurrency 1,5,10,20 --requests 100 --warmup 5 --format markdown

# 3) 上线混合流量场景（未传 token 时平滑交错 75% 缓存读 + 25% 查库读；传 --bearer-token 时按 70% / 20% / 10% 交错）
node scripts/development/load-test-api.mjs --base-url http://127.0.0.1:3001 --scenario mixed-launch --concurrency 1,5,10,20 --requests 100 --warmup 10 --format markdown

# 4) 已登录个人中心读取压测
node scripts/development/load-test-api.mjs --base-url http://127.0.0.1:3001 --scenario authenticated-read --bearer-token "<JWT>" --concurrency 1,5,10 --requests 50 --format markdown
```

## 3. 本机 NestJS 实测基线（回环模拟，非生产实测）

> **测试条件说明**：以下数据来自在开发机 Windows 回环端口运行完整编译版 `@zhipanda/api` NestJS 应用（`createApplication()` + `DatabaseService.withRequest()` + `PublicReadCache` + `Kysely`），但在数据库驱动边界使用 **5 槽位信号量**模拟 Hyperdrive 5 连接上限，并为每次 SQL 查询注入 `15ms` 延迟（受 Windows 默认约 `15.6ms` 定时器粒度影响，单次模拟查询实际落点约 `30ms`）。**本数据用于验证缓存旁路效应与 >5 并发排队拐点，不代表真实东京 Cloudflare Worker ↔ Supabase Postgres 的网络/磁盘 I/O 与生产吞吐。**

### 3.1 `public-cached`（先预热 10 次后，每档 100 请求）

- 实测总 DB 查询次数（不含预热）：**0 次**，峰值并发 DB 槽位占用：**0 / 5**。

| Concurrency | Requests | 2xx | 429 | 4xx | 5xx | Errors | RPS | p50 (ms) | p95 (ms) | p99 (ms) | Max (ms) |
|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 1 | 100 | 100 | 0 | 0 | 0 | 0 | 1585.85 | 0.54 | 0.94 | 1.28 | 4.18 |
| 5 | 100 | 100 | 0 | 0 | 0 | 0 | 1540.71 | 2.78 | 5.08 | 5.61 | 5.62 |
| 10 | 100 | 100 | 0 | 0 | 0 | 0 | 1639.83 | 5.29 | 10.52 | 12.38 | 12.77 |
| 20 | 100 | 100 | 0 | 0 | 0 | 0 | 1769.4 | 10.37 | 16.03 | 21.47 | 21.65 |

### 3.2 `public-db-uncached`（先预热 5 次后，每档 100 请求）

- 实测总 DB 查询次数（不含预热）：**400 次**，峰值并发 DB 槽位占用：**5 / 5**。
- 拐点观测：并发 1→5 时中位延迟保持在 `30.79ms -> 30.98ms`，吞吐近线性扩展至 `165.23 RPS`；超过 5 连接上限后，并发 10 的 p99 跳升至 `46.27ms`，并发 20 的 p50 升至 `61.87ms`（p95 达 `77ms`），RPS 在约 `293 RPS` 处见顶。

| Concurrency | Requests | 2xx | 429 | 4xx | 5xx | Errors | RPS | p50 (ms) | p95 (ms) | p99 (ms) | Max (ms) |
|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 1 | 100 | 100 | 0 | 0 | 0 | 0 | 34.84 | 30.79 | 31.86 | 32.28 | 34.46 |
| 5 | 100 | 100 | 0 | 0 | 0 | 0 | 165.23 | 30.98 | 32.24 | 32.53 | 32.57 |
| 10 | 100 | 100 | 0 | 0 | 0 | 0 | 281.01 | 31.3 | 45.82 | 46.27 | 46.27 |
| 20 | 100 | 100 | 0 | 0 | 0 | 0 | 293.48 | 61.87 | 77 | 77.36 | 77.37 |

### 3.3 `mixed-launch`（75% 缓存路由 + 25% 查库路由平滑交错，每档 100 请求）

- 实测总 DB 查询次数（不含预热）：**100 次**（精确对应 25% 的未缓存请求），峰值并发 DB 槽位占用：**5 / 5**。
- 在 `c=20` 的分路由统计中，6 个缓存读路由（`/api/v2/pandas/bao-li`、`/api/v2/pandas`、`/api/v2/places`、`/api/v2/institutions`、`/api/v2/release`、`/api/v2/stats`）p50 维持在 `3.34ms–3.45ms`，而 `/api/v2/popular-pandas`、`/api/v2/updates`、`/api/v2/venue-news`、`/api/v2/overseas-status`、`/api/v2/comparisons`、`/api/v2/learning` 与 `/ready` 的 p50 集中在 `24.96ms–56.46ms`、p95 达 `50.42ms–79.02ms`。

| Concurrency | Requests | 2xx | 429 | 4xx | 5xx | Errors | RPS | p50 (ms) | p95 (ms) | p99 (ms) | Max (ms) |
|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 1 | 100 | 100 | 0 | 0 | 0 | 0 | 128.65 | 0.53 | 30.11 | 30.52 | 30.92 |
| 5 | 100 | 100 | 0 | 0 | 0 | 0 | 644.89 | 1.19 | 29.71 | 30.57 | 31.25 |
| 10 | 100 | 100 | 0 | 0 | 0 | 0 | 1077.33 | 1.38 | 32.41 | 40.99 | 41.11 |
| 20 | 100 | 100 | 0 | 0 | 0 | 0 | 932.52 | 4.07 | 56.46 | 77.1 | 79.02 |

### 3.4 生产环境与本机实测的关键差异

- Cloudflare Workers 会拉起多个隔离实例（isolate），每个新冷启动或跨越发布代际的实例仍需各自预热 `PublicReadCache`，并同时争抢 Supabase 上的 **5 个 Hyperdrive origin 连接**。
- 面向终端用户的网页访问还会先经过 `zhipanda-v2-web` 的 Cloudflare Edge Cache 削峰，而移动端或客户端直连 `api.zhipanda.com` 的 `/api/v2/*` 不会走 Web Worker 页面缓存。

## 4. 低成本缓存优化与 Supabase Free → Pro 扩容阈值

1. **优先做零成本代码优化（比升级数据库更立竿见影）**：
   - 将 `PostgresJsonCatalogStore` 读取的 4 张高频只读 JSON 目录表（`learning.catalog`、`place.comparison_catalog`、`place.overseas_status_catalog`、`place.venue_news_catalog`）接入 `PublicReadCache` 或发布代际失效机制；这 4 个接口的内容只在内容批次或发布变更时变化，接入后可直接把首页/科普/对比/新闻页的常规流量从 5 连接池完全移出。
   - 对 `/api/v2/popular-pandas` 考虑增加短 TTL（例如 60 秒）隔离级汇总缓存，避免突发流量下每次请求都做 `engagement.favorites` 分组聚合。
2. **建议升级 Supabase Pro（与提升 Hyperdrive/连接池上限）的明确触发阈值**：
   - **并发排队阈值**：未缓存写库/用户态接口的稳态并发持续超过 **5**，导致生产接口 p95 排队延迟持续高于 **300ms**，或日志出现 `DB_CONNECTION_TIMEOUT_MS`（5000ms）连接超时 / Hyperdrive 池耗尽错误。
   - **Free 配额与运维红线**：接近 Supabase Free 方案额度（500 MB 数据库容量、5 GB 出站流量或 50,000 MAU），或进入公开商业推广期需要每日自动备份与时间点恢复（PITR）能力以保障用户与投稿数据安全。

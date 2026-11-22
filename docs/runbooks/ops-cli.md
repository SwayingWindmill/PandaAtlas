# 单人上线与运维 CLI 手册

本手册汇总三支无 Web 管理后台依赖的运维命令行工具：社区审核、死信排查重放与上线就绪体检。所有写操作默认处于 **dry-run** 模式，须显式传 `--apply` 才会真正落库或提交变更；任何时候都不会在终端回显凭据或数据库连接串。

## 1. 社区纠错审核 CLI (`ops-moderation.mjs`)

基于工作人员 Bearer Token 调用 `ReviewController` 接口（默认指向 `https://api.zhipanda.com`，可用 `PANDAATLAS_API_BASE_URL` 覆盖）。

所需环境变量：

```bash
export PANDAATLAS_STAFF_ACCESS_TOKEN="<staff-jwt-access-token>"
# 可选：覆盖 API 根地址，默认 https://api.zhipanda.com
export PANDAATLAS_API_BASE_URL="https://api.zhipanda.com"
```

常用命令（[ops-moderation.mjs](../../scripts/development/ops-moderation.mjs)）：

```bash
# 查看待审或已认领队列（只读）
node scripts/development/ops-moderation.mjs list --state new --limit 25

# 查看单条审核上下文（原始投稿 + 证据来源 + 断言）
node scripts/development/ops-moderation.mjs inspect --case-id "<REVIEW_CASE_UUID>"

# 认领审核任务（先 dry-run 检查目标 URL，再加 --apply 执行）
node scripts/development/ops-moderation.mjs claim --case-id "<REVIEW_CASE_UUID>"
node scripts/development/ops-moderation.mjs claim --case-id "<REVIEW_CASE_UUID>" --apply

# 核验或驳回投稿证据来源（verified 须同时提供规范证据 ID 与定位 URI）
node scripts/development/ops-moderation.mjs verify-source \
  --case-id "<REVIEW_CASE_UUID>" \
  --source-id "<SOURCE_UUID>" \
  --outcome verified \
  --canonical-source-id "<EVIDENCE_SOURCE_ID>" \
  --normalized-locator "https://www.panda.org.cn/cn/notice/example" \
  --reason "Confirmed against official institution notice" \
  --apply

# 下达最终审核决定（accepted 须提供 --assertions；duplicate 须提供 --duplicate-of）
node scripts/development/ops-moderation.mjs decide \
  --case-id "<REVIEW_CASE_UUID>" \
  --outcome accepted \
  --assertions "<ASSERTION_KEY>" \
  --explanation "Verified current institution transfer notice." \
  --apply
```

## 2. 异步死信排查与安全重放 CLI (`ops-dead-letters.mjs`)

按 [async-dead-letters.md](async-dead-letters.md) 的事务 SQL 流程收口为命令行工具（[ops-dead-letters.mjs](../../scripts/development/ops-dead-letters.mjs)）。连接远端数据库时强制要求提供 TLS CA 证书（`rejectUnauthorized: true`）。

所需环境变量：

```bash
export PANDAATLAS_OPS_DATABASE_URL="<postgres-connection-url>"
export PANDAATLAS_OPS_DATABASE_SSL_CA_CERT="<pem-ca-certificate>"
```

（若已设置 `PANDAATLAS_IAM_OPERATOR_DATABASE_URL` / `PANDAATLAS_IAM_DATABASE_SSL_CA_CERT`，脚本会自动复用；连本地 `127.0.0.1` / `localhost` 时也可直接读取 `TEST_DATABASE_URL`。）

常用命令：

```bash
# 列出死信摘要与明细（只读）
node scripts/development/ops-dead-letters.mjs list --limit 50

# 查看单条死信及对应的 integration.outbox_events 事件
node scripts/development/ops-dead-letters.mjs inspect --id "<DEAD_LETTER_UUID>"

# 事务内重放回 PGMQ 并删除死信记录（默认回滚 dry-run；确认后加 --apply）
node scripts/development/ops-dead-letters.mjs replay --id "<DEAD_LETTER_UUID>"
node scripts/development/ops-dead-letters.mjs replay --id "<DEAD_LETTER_UUID>" --apply

# 确认无需投递时，事务内丢弃死信记录（默认回滚 dry-run；确认后加 --apply）
node scripts/development/ops-dead-letters.mjs discard --id "<DEAD_LETTER_UUID>" --apply
```

## 3. 上线就绪一键体检 (`check-launch-readiness.mjs`)

纯只读巡检脚本（[check-launch-readiness.mjs](../../scripts/development/check-launch-readiness.mjs)），核对本地构建前置事实与线上健康状况：

- 本地法律文档草稿残留扫描：`apps/web/features/legal/documents.ts`
- 已发布照片 key 规范校验：`apps/web/worker/published-photo-keys.json`
- 仓库内科普目录版本号：`data/curation/learning/learning.json`
- 线上 `/ready`、`/health/async`、`/api/v2/learning` 与仓库版本差、`/api/v2/venue-news`、`/api/v2/overseas-status` 覆盖量，以及 `/zh`、`/zh/terms`、`/zh/privacy` 可访问性与线上草稿状态。

```bash
# 完整巡检（含线上只读探测）
node scripts/development/check-launch-readiness.mjs

# 离线检查本地仓库文件状态
node scripts/development/check-launch-readiness.mjs --offline

# 严格模式（任何 WARN 也以退出码 1 报错；支持 --json 输出）
node scripts/development/check-launch-readiness.mjs --strict --json
```

# 采集器 V1 最小化部署与运维手册

本文档说明如何以零外部 Cookie、零扫码登录的最小拓扑运行 `services/collector` V1。架构约束见 [ADR 0004](../architecture/adr-0004-continuous-collector.md)。

## V1 收敛范围

当前 [targets.yaml](../../data/collector/targets.yaml) 经关键词组展开后共 162 个采集目标：

- **V1 默认启用（49 个）**：`bjzoo`（2 个北京动物园官网源）与 `weibo_rsshub`（47 个微博访客路由账号）。两者只需本机 PostgreSQL 与 RSSHub，不依赖人工扫码或外部 Cookie。
- **阶段二按需扩展（113 个）**：`douyin_api`（75 个）、`xhs_mcp`（32 个）与 `mediacrawler`（6 个对照目标）在未配置对应环境变量时安全留在数据库中等待调度，不计为失败。

## 方案 A：Docker Compose 一键启动（推荐）

适用场景：单台 Linux 主机或本地 Docker 环境直接拉起 PostgreSQL 17、Redis、RSSHub 与容器化采集器。

1. 生成最小环境配置：

```bash
cp infra/collector/env.minimal.example infra/collector/.env.minimal
```

按需填写 `COLLECTOR_DB_PASSWORD`、`COLLECTOR_ALERT_WEBHOOK`（飞书或企业微信群机器人地址）以及可选的 `AIHOT_URL` / `AIHOT_INGEST_TOKEN`。

2. 构建并启动 V1 服务栈：

```bash
docker compose -f infra/collector/compose.minimal.yml --env-file infra/collector/.env.minimal up -d --build
```

3. 运行部署前检查与单次冒烟采集：

```bash
docker compose -f infra/collector/compose.minimal.yml --env-file infra/collector/.env.minimal exec collector collector doctor
docker compose -f infra/collector/compose.minimal.yml --env-file infra/collector/.env.minimal exec collector collector once --target bjzoo:account:activityNewsInsideOutsidePark
docker compose -f infra/collector/compose.minimal.yml --env-file infra/collector/.env.minimal exec collector collector status
```

## 方案 B：宿主机 `uv` + systemd 部署

适用场景：用 Docker Compose 运行基础依赖，并在 Linux 主机直接托管 Python 进程。

1. 启动基础服务（不启动 `collector` 容器）：

```bash
cp infra/collector/env.minimal.example infra/collector/.env.minimal
docker compose -f infra/collector/compose.minimal.yml --env-file infra/collector/.env.minimal up -d postgres redis rsshub
```

2. 同步依赖、初始化数据库并验证自检：

```bash
cd services/collector
uv sync --frozen --no-dev
set -a && . ../../infra/collector/.env.minimal && set +a
uv run collector migrate
uv run collector sync
uv run collector doctor
```

3. 安装 systemd 模板：参考 [zhipanda-collector.service.example](../../infra/collector/zhipanda-collector.service.example) 复制至 `/etc/systemd/system/zhipanda-collector.service`，替换目录与用户名后执行 `systemctl daemon-reload && systemctl enable --now zhipanda-collector`。

## 日常运维与故障处理

- **健康自检**：`collector doctor --offline --json` 可脱离数据库独立校验配置、词表与目标文件；在线 `collector doctor` 额外校验 PostgreSQL 连通性、Schema 就绪状态与 RSSHub HTTP 探针。
- **数据备份**：

```bash
docker compose -f infra/collector/compose.minimal.yml --env-file infra/collector/.env.minimal exec -T postgres pg_dump -U collector collector > collector-backup.sql
```

- **风控恢复**：若某个适配器因限流或风控暂停，处理后运行 `collector resume <adapter>` 解除暂停并恢复增量游标补采。
- **扩展至全平台**：需要接入抖音与小红书时，切换至 [compose.yml](../../infra/collector/compose.yml) 与 [services/collector README](../../services/collector/README.md) 所述完整环境配置。

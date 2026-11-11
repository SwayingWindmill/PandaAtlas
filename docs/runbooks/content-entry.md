# 内容录入（一人工作流）

内容和代码分开发布。内容放在 `data/curation/` 下的 JSON 文件里，靠 pull request 加 CI 校验来把关。合并后由维护者运行批处理写进数据库，不需要等代码部署，也不再为内容生成迁移。

全程一个人：写、自查、合并、发布都是维护者自己。CI 负责格式和引用检查，人只核对来源。

## 录什么、改哪个文件

| 内容 | 文件 | 字段说明 | 发布操作 |
|---|---|---|---|
| 场馆简介、地图点、参观指南（开放时间、票价、观猫时段、拍照点） | `data/curation/institutions/institutions.json` | 文件里的 `$comment` | `curation.content`，之后再跑 `release.publish` |
| 场馆动态 | `data/curation/venue-news/venue-news.json` | [SCHEMA.md](../../data/curation/venue-news/SCHEMA.md) | `curation.content` |
| 海外大熊猫状态（归国熊猫） | `data/curation/overseas-status/overseas-status.json` | [SCHEMA.md](../../data/curation/overseas-status/SCHEMA.md) | `curation.content` |
| 比一比（发现页） | `data/curation/comparisons/comparisons.json` | [SCHEMA.md](../../data/curation/comparisons/SCHEMA.md) | `curation.content` |
| 科普、认脸挑战、月度挑战主题 | `data/curation/learning/learning.json` | [ARTICLE_SCHEMA.md](../../data/curation/learning/ARTICLE_SCHEMA.md) | `curation.learning` |
| 熊猫档案、照片 | `data/curation/pandas/*.csv` | [README.md](../../data/curation/pandas/README.md) | 研究流水线和 `release.publish` |

## 一次录入

1. **开分支改文件。** 新条目先写成 `"status": "draft"`。
2. **本地自查。**
   ```bash
   npm run verify:dev
   ```
   它会跑改动涉及的校验，也可以只跑某一个，例如 `python scripts/curation/validate_venue_news.py`。
3. **核对来源。** 打开 `sourceUrl`，确认原文和条目一致，再把 `status` 改成 `published`，并把 `updatedAt` 或 `verifiedOn` 改成今天。一个人核对即可。
4. **改版本号。** `venue-news.json`、`overseas-status.json`、`comparisons.json` 和 `learning.json` 的内容变了就要换 `version`，例如 `2026.11.05.1`。内容变了但版本没换，批处理会拒绝写入。`institutions.json` 没有版本号。
5. **开 PR，CI 通过后合并。** 只改了内容的 PR 不触发代码部署。
6. **发布。** 在 GitHub Actions 打开 **Bounded Batch Operations**，在 `main` 上运行：
   - operation 选表格里的发布操作，manifest 填该文件路径
   - 勾选 **execute**，change reference 填这个 PR
   - 批准 `production-batch`

   运行摘要会列出写入了多少条已发布的条目。同样的内容再跑一次会显示 already current，不会重复写入。
7. **场馆内容要多一步。** App 读的是发布版本，所以写完场馆内容后还要运行 `release.publish`，见 [production-release.md](production-release.md)。

开发版 App 会直接读工作区里的 `learning.json`，草稿也会显示，方便发布前预览科普和月度挑战。

## 定期复核

每周一 **Content Review** 工作流会运行 `scripts/curation/review_due.py`，把到期要复查的内容汇总到一个带 `content-review` 标签的 issue 里，每周原地更新；没有到期内容时自动关闭。以下情况会被列出：

- 参观指南：超过 90 天没有核对。开放时间、票价和展区常随季节变化。
- 场馆简介：超过一年没有核对。
- 海外大熊猫：还没回国的条目，超过 30 天没有核对。
- 场馆动态：已发布超过 60 天的条目，要确认是否仍然有效，失效就改回 `draft`。
- 月度挑战：月底前 10 天，下个月还没有已发布的主题。不写也可以，App 会用默认清单。

逐条核对后改日期，再按上面的流程发布。要提前看清单，可以手动运行这个工作流，或在本地运行 `python scripts/curation/review_due.py`。

## 不做的事

- 不用 Supabase 后台或 SQL 直接改生产数据。数据库里的内容总能从 `data/curation/` 重新写出来。
- 不为内容写迁移。表结构才走迁移，见 [production-release.md](production-release.md#migration-rules)。以前的 `*_institution_content.sql` 保留为已应用的历史。
- 不录非官方来源：粉丝帖、媒体转载、二手截图都不算。

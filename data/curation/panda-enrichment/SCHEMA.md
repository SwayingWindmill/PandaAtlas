# 头部大熊猫档案补全（Panda Enrichment）

`data/curation/panda-enrichment/top-pandas.json` 用于把经过一手官方来源核验的核心大熊猫档案字段、当前主常驻场馆与确认血统批量写入数据库。CI 会通过 `scripts/curation/validate_panda_enrichment.py` 校验格式和引用；合并到 `main` 后按顺序执行批处理写入生产数据库。

## 结构说明

```json
{
  "version": "2026.11.22.1",
  "updatedAt": "2026-11-22T18:00:00+08:00",
  "sources": [
    {
      "key": "samsung-2025-birthday",
      "publisher": "Samsung C&T Newsroom",
      "title": "Bamboo, Cake, and Goodbyes: A Final Birthday Bash for Everland’s Twin Pandas",
      "url": "https://news.samsungcnt.com/en/features/resort/2025-07-bamboo-cake-and-goodbyes-a-final-birthday-bash-for-everlands-twin-pandas/",
      "publishedOn": "2025-07-15",
      "lastVerifiedOn": "2026-11-22",
      "languageTag": "en",
      "accessState": "accessible",
      "evidenceTier": "primary",
      "publicSummary": "确认瑞宝、辉宝生于 2023-07-07，爱宝生日为 7 月 13 日，福宝为 7 月 20 日，乐宝为 7 月 28 日。"
    }
  ],
  "items": [
    {
      "pandaSlug": "le-bao",
      "facts": [
        {
          "fieldKey": "birth_date",
          "value": "2012-07-28",
          "certainty": "confirmed",
          "lastVerifiedOn": "2026-11-22",
          "sourceKeys": ["samsung-2023-twins", "samsung-2025-birthday"]
        }
      ],
      "currentResidency": {
        "placeSlug": "everland",
        "startOn": "2016-01-01",
        "startPrecision": "year",
        "status": "confirmed",
        "lastVerifiedOn": "2026-11-22",
        "sourceKeys": ["samsung-2023-twins"]
      },
      "lineage": {
        "mother": {
          "parentSlug": "ai-bao",
          "status": "confirmed",
          "reviewedOn": "2026-11-22",
          "sourceKeys": ["samsung-2023-twins"]
        }
      }
    }
  ]
}
```

## 约束与来源规则

- `pandaSlug` 与 `lineage.*.parentSlug` 必须是已发布目录（`data/curation/learning/published-pandas.json`）中的规范 `slug`，且不能自指或父母相同。
- `currentResidency.placeSlug` 必须是 `data/curation/institutions/institutions.json` 中已策划的场馆（`facility`）`slug`。
- `facts[].fieldKey` 仅允许 `sex`、`birth_date`、`birth_date_precision`、`life_status`、`death_date`、`birthplace`。写入精确到日（`YYYY-MM-DD`）的 `birth_date` 且未显式指定 `birth_date_precision` 时，批处理会自动补齐 `birth_date_precision = "day"`。
- `currentResidency.startPrecision` 为 `unknown` 时，`startOn` 必须省略或为 `null`；其余精度下 `startOn` 必须为合法 `YYYY-MM-DD`。批处理写入前会自动结束或裁断同一只熊猫身上冲突的既有 `primary` 旅居记录，避免触发时间区间互斥约束。`life_status` 为 `deceased` 的条目不得设置开放式 `currentResidency`。
- **仅允许一手官方来源**：园方/繁育基地官网、国家林草局/熊猫中心官网、省市/特区政府公告、官方机构媒体室的 `https://` 直链。禁止维基百科、粉丝站、自媒体及搜索跳转链接。因 Cloudflare 防护返回 403 的官网页面（如 `zooatlanta.org`）需标注 `"accessState": "restricted"`。

## 生产发布顺序

1. 运行 `curation.content`（`data/curation/institutions/institutions.json`），确保所有目标场馆 `place.places` 已入库。
2. 运行 `curation.content`（`data/curation/panda-enrichment/top-pandas.json`），写入来源、核心事实、主常驻场馆与血统。
3. 运行 `release.publish`，生成并激活新的内容发布版本，刷新公开投影与 `listing_facts`。
4. 运行 `curation.guess-questions`，基于新发布版本重新生成包含 `"hard"` 难度的猜熊猫题库。

```bash
python scripts/curation/validate_panda_enrichment.py
```

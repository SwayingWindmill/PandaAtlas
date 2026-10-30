# 科普文章

科普首页读的是 `articles`。撰稿稿用这一套字段，程序按原样收，不改句子。正式版只返回 `status` 为 `published` 的文章。

改 `data/curation/learning/learning.json`。不要改 SQL。改完后由维护者运行：

`python scripts/curation/build_learning_content_migration.py --write`

## 一条文章

| 字段 | 说明 |
|---|---|
| `slug` | 网址短名。小写字母、数字、连字符。 |
| `status` | `draft` 或 `published`。 |
| `category` | `外形与识别`、`食性`、`繁殖与成长`、`保护` 之一。 |
| `title` / `dek` / `pullQuote` | `{ "zh": "…" }`。可以再加 `en`。`pullQuote` 可带 `drawnFromBody`。 |
| `body.sections` | 每节有 `heading` 和 `paragraphs`。每段有 `text` 和 `refs`（参考资料的 `id`）。 |
| `keyFacts` | `{ "text", "refs" }` 的列表。 |
| `images` | 见下。第一张角色必须是唯一的 `hero`。 |
| `references` | `id`、`title`、`publisher`、`url`、`citedOn`。`title` 和 `publisher` 是字符串。 |
| `relatedArticles` | 其他文章的 `slug`。 |
| `stats` | `bodyChars`、`bodyCjkChars`、`sectionCount`、`referenceCount`。 |
| `glossaryTerms` | 文中用到的名词：`slug`、`label`、`inLearningJson`。 |
| `sourceCardSlug` 或 `sourceTopicSlug` | 二选一，指回原来的知识卡或专题。 |

正文里的名词写成 `[[term-slug|显示文字]]`。页面只显示「显示文字」，点开对应的名词解释。`term-slug` 必须是 `terms` 里已有的。

中文标题最多 40 字，导语 160，小节标题 40，段落 2000，引语 240，图说 160，要点 120，参考资料标题 160。

## 图

`type` 为 `existing` 的图必须用 `data/curation/pandas/media.csv` 里 `review_status` 为 `approved` 的那一行：`pandaSlug`、`asset`、`sourcePage`、`credit`、`rights`、`caption`、`captionRefs`。`role` 是 `hero`、`inline` 或 `compare`。

不拍某只熊猫的图（新生幼仔、竹林、进食动作）可以把 `pandaSlug` 写成 `null`，这时图必须来自 Wikimedia Commons：`sourcePage` 是 `https://commons.wikimedia.org/wiki/File:` 开头的文件页，`asset` 用 Commons 的地址，`credit` 写作者，`rights` 写自由许可（如 `CC BY-SA 4.0`、`CC BY-SA 2.5 es`、`CC0 1.0`、`Public domain`）。只有亲自打开文件页核对过许可和描述的图才能用。

`type` 为 `wanted` 的图还没有可公开的照片。不要填 `asset`。`collection_only` 的图不能拿来顶上。正式包里不显示这一格，开发包里留一块「配图待补」，下面仍用撰稿人的 `caption`。

## 认脸挑战

`challenges` 的 `answerPandaSlug` 和三个 `decoyPandaSlugs` 必须是已发布熊猫的规范 slug，写在 `published-pandas.json` 里。缺一只，App 就会把整道题藏起来。新的熊猫版本发布后，运行 `python scripts/curation/refresh_published_pandas.py` 更新这个文件。

## 名词

新词写在 `terms` 里，字段和原来的名词一样。撰稿稿若只给了中文，`en` 可以先留空字符串。来源的 `title.zh` 用撰稿人写的题名，`en` 可以留空。

## 例子

见文件里的 `black-eye-patches`。封面是喜伦的已审核照片；新生幼仔那一张不拍某只熊猫，`pandaSlug` 为 `null`，用的是 Wikimedia Commons 上授权的成都基地新生幼仔照片。

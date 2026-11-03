# 科普审阅清单

给维护者。把 `data/curation/learning/learning.json` 里的草稿改成 `published` 之前，逐条核对。撰稿规范见 `docs/learning-content-brief.md`，字段说明见 `data/curation/learning/ARTICLE_SCHEMA.md`。

现在所有条目都是 `draft`。正式版只显示 `published`，开发版预览全部草稿。

## 每一条

- [ ] 句子只写来源里有的内容。打开 `references` 里的每个链接核对一次。
- [ ] 每个事实句的 `refs` 指向的来源确实说了这件事。
- [ ] 每条来源 `url` 以 `https://` 开头，`citedOn` 写成核对当天，例如 `2026-10-30`。
- [ ] 中英文说的是同一件事，没有多出或漏掉的内容。
- [ ] 句子里没有 `[草稿]`、`[draft]`。
- [ ] 认脸只写照片上能核对的特征，不写性格、轶事。

## 配图

- [ ] `pandaSlug` 不为空的图：用的是这只熊猫已发布的照片。
- [ ] `pandaSlug` 为空的图（Wikimedia Commons 图）：打开 `sourcePage`，核对作者、许可和画面。
  - `credit` 和 Commons 页面上的作者一致。
  - `rights` 和 Commons 页面上的许可一致，且是 CC BY、CC BY-SA、CC0 或公有领域。
  - 图说和画面一致。
- [ ] 本次新加的 Commons 图：

  | 文章 | 图 | 作者 | 许可 |
  |---|---|---|---|
  | black-eye-patches、cubs | [Chengdu-pandas-d18.jpg](https://commons.wikimedia.org/wiki/File:Chengdu-pandas-d18.jpg)（约一周大的幼仔，成都大熊猫繁育研究基地，2005） | Colegota | CC BY-SA 2.5 es |
  | what-pandas-eat | [Chengdu_pandas_eating.jpg](https://commons.wikimedia.org/wiki/File:Chengdu_pandas_eating.jpg)（用前爪握竹吃，成都大熊猫繁育研究基地，2009） | Hyjk2000 | CC BY-SA 3.0 |

- [ ] 还缺的图（`type: wanted`）：正式版不显示这一格，开发版显示「配图待补」。
  - `bamboo` 第 2 张：野外竹林或竹笋实景。
  - `telling-faces-apart` 第 6 张：青宝左臀胎记。现有青宝照片身份只是「疑似」，不能用。
- [ ] 已知问题：现在 App 只显示 `credit`，不显示 `rights`。CC BY-SA 图要求注明许可，发布前决定是否在图说里加上许可。

## 认脸挑战

- [ ] 正确答案和干扰项都在 `data/curation/learning/published-pandas.json` 里。生成迁移的脚本会检查这一点。
- [ ] 发布前刷新一次名单：

  `python3 scripts/curation/refresh_published_pandas.py`

  然后再运行生成迁移的命令。名单里没有的熊猫，挑战在 App 里不会出现。
- [ ] 提示里提到的熊猫也在选项里（例如伦伦的提示提到洋洋）。

## 已知的熊猫标识差异

- [ ] 文章配图里还用着整理库的标识 `ya-lun`（cubs 第 2 张、telling-faces-apart 第 3 张）和 `yang-yang`（telling-faces-apart 第 5 张）。正式接口里的标识可能不同，例如亚特兰大的洋洋是 `yang-yang-atlanta`。发布这几篇之前，确认这几张图在开发版里能显示。

## 发布

1. 审过的条目把 `status` 改成 `published`。
2. 把 `version` 改成当天的版本号，例如 `2026.10.30.1`。
3. 运行 `python3 scripts/curation/build_learning_content_migration.py --write`，再运行 `--check`。
4. 运行 `python3 -m unittest discover -s scripts/curation/tests -p test_build_learning_content_migration.py`。
5. 提交生成的迁移，随正式发布上线。上线后在正式版里打开每篇文章和认脸挑战看一遍。

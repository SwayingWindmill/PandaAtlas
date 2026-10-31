# 吱熊猫 名字整理提案（N7 第 1 批）

> **状态（2026-10-31）：display-only applied; curation fix pending release approval.** App 里已经按下面「已应用的显示层修正」改了显示（`apps/mobile/src/lib/panda.ts` 的 `displayChineseName`）。curation 数据没有改，也没有发布 release；数据层修正要等 release 获批后再做。

> 原始状态：**提案，等待确认**（2026-10-30）。这份文件没有改任何数据，也没有新起名字。下面的「建议显示」只用数据里已有的写法。确认之后，再决定是改 curation 数据（重新发布 release），还是只在 App 里做显示层的回退。

- 数据来源：公开 API `https://api.zhipanda.com/api/v2/pandas`，当前 release `2026.10.02.1-photo-only`，共 925 只（2026-10-30 读取）。
- 对照：仓库里的 curation 表 `data/curation/pandas/pandas.csv`（`name_zh`、`name_en`、`birth_date`）。按 slug 或英文名找候选行，再用出生日期核对是不是同一只。**出生日期不一致或缺失的候选，只能当线索，不能直接采用。**
- App 现在怎么选名字：`apps/mobile/src/lib/panda.ts` 的 `displayName`，先取 `zh-Hans` 的 primary 名，没有就用英文 primary 名，再没有就用 slug。所以下面这些熊猫在列表、图鉴、家谱里会显示「Kouhin / 幸浜」「娅光 (Ya Ya」或者英文名。

## 数量

| 类别 | 数量 | 现在显示 | 问题 |
|---|---|---|---|
| A. 中文 primary 是「罗马字 / 汉字」 | 29 | Kouhin / 幸浜 | 中文名里混了罗马字 |
| B. 中文 primary 只有拉丁字母 | 8 | Happy、Mei Lan | 标成中文，其实是英文名 |
| C. 中文 primary 被截断（导入时括号断开） | 6 | 娅光 (Ya Ya | 截断的字符串，另一半「娅娅 lineage)」成了一条别名 |
| D. 完全没有中文名 | 33 | Chia-Chia | 只有英文 |
| 合计 | 76 | | |

计划里写的是「45 只中文名混杂、33 只没有中文名」。按当前公开 release 重新数：A+B+C 共 43 只，D 共 33 只。差的 2 只可能来自 release 版本或计数口径的不同（PR H 当时用的统计方法没有记下来）。下面逐只列出。

## A. 「罗马字 / 汉字」（29 只）

建议显示：取「 / 」后面的汉字部分。数据里大多已经有同样写法的 zh-Hans 别名，curation 表的 `name_zh` 也是这个写法。

需要你决定的写法问题：
- 白浜（Adventure World）出生的熊猫，数据用的是日文新字体「浜、桜、楓、陽、優、結、愛」。简体会写成「滨、樱、枫、阳、优、结、爱」。数据里只有结浜/結浜、樱浜/桜浜、阳浜/陽浜三只同时有两种写法。**建议先照数据显示（浜），要不要换成简体字由你决定。**
- 台北的团团、圆圆、圆仔、圆宝，primary 里是繁体（團團、圓圓），别名和 curation 表里是简体。建议显示简体别名。

| slug | 现在的名字 | 数据里已有的中文写法 | curation 候选 | 建议显示 |
|---|---|---|---|---|
| `aihin-shirahama` | Aihin / 愛浜 | 愛浜 | `aihin`：愛浜（出生日期一致） | **愛浜** |
| `cai-tao-indonesia` | Cai Tao / 彩陶 | 彩陶 | `cai-tao`：彩陶（出生日期一致） | **彩陶** |
| `eihin-shirahama` | Eihin / 永浜 | 永浜 | `eihin`：永浜（出生日期一致） | **永浜** |
| `eimei-shirahama` | Eimei / 永明 | 永明 | `eimei`：永明（出生日期一致） | **永明** |
| `fuhin-shirahama` | Fuhin / 楓浜 | 楓浜 | `fuhin`：楓浜（出生日期一致） | **楓浜** |
| `hu-chun-indonesia` | Hu Chun / 湖春 | 只在 primary 里 | `hu-chun`：湖春（出生日期一致） | **湖春** |
| `jian-jian-macao` | Jian Jian / 健健 | 健健 | `jian-jian-macau`：健健（出生日期不一致或缺失，可能不是同一只） | **健健** |
| `kaihin-shirahama` | Kaihin / 海浜 | 海浜 | `kaihin`：海浜（出生日期一致） | **海浜** |
| `kang-kang-macao` | Kang Kang / 康康 | 康康 | `kang-kang-macau`：康康（出生日期不一致或缺失，可能不是同一只）；`kang-kang-ueno`：康康（出生日期不一致或缺失，可能不是同一只） | **康康** |
| `kouhin-shirahama` | Kouhin / 幸浜 | 幸浜 | `kouhin`：幸浜（出生日期一致） | **幸浜** |
| `meihin-female-2008-shirahama` | Meihin / 梅浜 | 梅浜 | `meihin-2006`：明浜（出生日期不一致或缺失，可能不是同一只）；`meihin-2008`：梅浜（出生日期一致） | **梅浜** |
| `meihin-male-2006-shirahama` | Meihin / 明浜 | 明浜 | `meihin-2006`：明浜（出生日期一致）；`meihin-2008`：梅浜（出生日期不一致或缺失，可能不是同一只） | **明浜** |
| `meimei-shirahama` | Meimei / 梅梅 | 梅梅 | `meimei`：梅梅（出生日期一致） | **梅梅** |
| `ouhin-shirahama` | Ouhin / 桜浜 | 桜浜、樱浜 | `ouhin`：桜浜（出生日期一致） | **桜浜** |
| `rauhin-shirahama` | Rauhin / 良浜 | 良浜 | `rauhin`：良浜（出生日期一致） | **良浜** |
| `ryuhin-shirahama` | Ryuhin / 隆浜 | 隆浜 | `ryuhin`：隆浜（出生日期一致） | **隆浜** |
| `saihin-shirahama` | Saihin / 彩浜 | 彩浜 | `saihin`：彩浜（出生日期一致） | **彩浜** |
| `shuhin-shirahama` | Shuhin / 秋浜 | 秋浜 | `shuhin`：秋浜（出生日期一致） | **秋浜** |
| `tang-tang-linhui-mother` | Tang Tang / 唐唐 | 只在 primary 里 | `tang-tang`：唐唐（出生日期不一致或缺失，可能不是同一只） | **唐唐** |
| `touhin-shirahama` | Touhin / 桃浜 | 桃浜 | `touhin`：桃浜（出生日期一致） | **桃浜** |
| `tuan-tuan-taipei` | Tuan Tuan / 團團 | 团团 | `tuan-tuan`：团团（出生日期一致） | **团团（简体别名；primary 是繁体 團團）** |
| `youhin-female-2010-shirahama` | Youhin / 陽浜 | 阳浜、陽浜 | `youhin-1992`：蓉浜（出生日期不一致或缺失，可能不是同一只）；`youhin-2010`：陽浜（出生日期一致） | **陽浜** |
| `youhin-founder-shirahama` | Youhin / 蓉浜 | 蓉浜 | `youhin-1992`：蓉浜（出生日期一致）；`youhin-2010`：陽浜（出生日期不一致或缺失，可能不是同一只） | **蓉浜** |
| `yuan-bao` | Yuan Bao / 圓寶 | 圆宝 | `yuan-bao`：圆宝（出生日期不一致或缺失，可能不是同一只） | **圆宝（简体别名；primary 是繁体 圓寶）** |
| `yuan-yuan-taipei` | Yuan Yuan / 圓圓 | 圆圆 | `yuan-yuan`：圆圆（出生日期一致）；`yuan-yuan-moscow`：圆圆（出生日期不一致或缺失，可能不是同一只）；`yuan-yuan-sandiego`：元元（出生日期不一致或缺失，可能不是同一只） | **圆圆（简体别名；primary 是繁体 圓圓）** |
| `yuan-zai` | Yuan Zai / 圓仔 | 圆仔 | `yuan-zai`：圆仔（出生日期不一致或缺失，可能不是同一只） | **圆仔（简体别名；primary 是繁体 圓仔）** |
| `yuhin-female-2012-shirahama` | Yuhin / 優浜 | 優浜 | `yuhin-2001`：雄浜（出生日期不一致或缺失，可能不是同一只）；`yuhin-2012`：優浜（出生日期一致） | **優浜** |
| `yuhin-male-2001-shirahama` | Yuhin / 雄浜 | 雄浜 | `yuhin-2001`：雄浜（出生日期一致）；`yuhin-2012`：優浜（出生日期不一致或缺失，可能不是同一只） | **雄浜** |
| `yuihin-shirahama` | Yuihin / 結浜 | 結浜、结浜 | `yuihin`：结浜（出生日期一致） | **結浜** |

## B. 中文 primary 只有拉丁字母（8 只）

这些熊猫的 `zh-Hans` primary 其实是英文名。数据里没有中文写法，**不建议在 App 里补名字**。建议：数据层把这条 zh-Hans primary 去掉（或改成 en），然后和 D 类一样处理。curation 候选只是同名线索，出生日期都对不上，不能用。

| slug | 现在的名字 | curation 候选 | 建议显示 |
|---|---|---|---|
| `happy-sichuan-london-stlouis-5` | Happy | 无 | Happy（按 D 类的方案） |
| `hsan-hsan-baoxing-beijing-guangzhou-59` | Hsan Hsan | 无 | Hsan Hsan（按 D 类的方案） |
| `mei-lan-sichuan-brookfield-10` | Mei Lan | `mei-lan`：美兰（出生日期不一致或缺失，可能不是同一只） | Mei Lan（按 D 类的方案） |
| `mei-mei-harkness-brookfield-1937` | Mei-Mei / Diana | `meimei`：梅梅（出生日期不一致或缺失，可能不是同一只） | Mei-Mei / Diana（按 D 类的方案） |
| `ming-ming-pingwu-214` | Ming Ming | 无 | Ming Ming（按 D 类的方案） |
| `pao-pei-sichuan-stlouis-12` | Pao Pei / Precious Jewel | 无 | Pao Pei / Precious Jewel（按 D 类的方案） |
| `sha-sha-taiyuan-220` | Sha Sha | 无 | Sha Sha（按 D 类的方案） |
| `xi-xi-chongqing-296` | Xi Xi | 无 | Xi Xi（按 D 类的方案） |

## C. 截断的中文 primary（6 只）

导入时，「娅光 (Ya Ya lineage)」这样的字段在括号处被拆开，primary 成了「娅光 (Ya Ya」，剩下的「娅娅 lineage)」成了一条别名。每只都另有一条干净的 zh-Hans 别名（例如「娅光」），建议数据层把干净的那条设为 primary，并删掉截断的两条。

| slug | 现在的名字 | 数据里干净的写法 | 建议显示 |
|---|---|---|---|
| `ya-guang-chengdu-lineage` | 娅光 (Ya Ya | 娅光 | **娅光** |
| `ya-lao-da-chengdu-lineage` | 娅老大 (Ya Ya | 娅老大 | **娅老大** |
| `ya-shuang-chengdu-lineage` | 娅双 (Ya Ya | 娅双 | **娅双** |
| `ya-xiang-chengdu-lineage` | 娅祥 (Ya Ya | 娅祥 | **娅祥** |
| `ya-yun-chengdu-lineage` | 娅韵 (Ya Ya | 娅韵 | **娅韵** |
| `ya-zai-chengdu-lineage` | 娅仔 (Ya Ya | 娅仔 | **娅仔** |

## D. 没有中文名（33 只）

公开数据里只有英文名（官方罗马字）。很多是 1930–80 年代送到海外的熊猫，当年的中文名可能从来没有可靠记录。**下面的 curation 候选只是线索**：只有标「出生日期一致」的才能考虑，而且也要回到原始出处核对后才能入库。

| slug | 英文名 | 出生日期（公开数据） | curation 候选 | 建议 |
|---|---|---|---|---|
| `bo-si-tiantian-offspring` | Bo Si | — | 无 | 显示英文名 |
| `cc-xiaoyatou-offspring-2023` | CC | 2023-05-28 | 无 | 显示英文名 |
| `chang-chang-madrid-1978` | Chang Chang | — | 无 | 显示英文名 |
| `chi-chi` | Chi Chi | — | 无 | 显示英文名 |
| `chia-chia-london-1974` | Chia-Chia | — | `chia-chia-mexico`：佳佳（出生日期不一致或缺失，可能不是同一只） | 显示英文名 |
| `ching-ching-london-1974` | Ching-Ching | — | 无 | 显示英文名 |
| `chu-lin-madrid-1982` | Chu Lin | 1982-09-04 | 无 | 显示英文名 |
| `da-di-beijing` | Da Di | 1992-09-22 | 无 | 显示英文名 |
| `happy-berlin-1936` | Happy | — | 无 | 显示英文名 |
| `jiu-jiu-madrid` | Jiu Jiu | 2021-09-06 | `jiu-jiu`：玖玖（出生日期一致）；`jiu-jiu-huamei`：玖玖（出生日期不一致或缺失，可能不是同一只） | 有出生日期一致的候选：核对出处后可以入库 |
| `li-li-paris-1973` | Li Li | — | 无 | 显示英文名 |
| `liang-liang-chapultepec-1983` | Liang Liang | 1983-06-22 | `liang-liang-mexico`：亮亮（出生日期一致）；`liang-liang-my`：靓靓（出生日期不一致或缺失，可能不是同一只） | 有出生日期一致的候选：核对出处后可以入库 |
| `mei-lun-atlanta-2013` | Mei Lun | 2013-07-15 | `mei-lun`：美轮（出生日期一致） | 有出生日期一致的候选：核对出处后可以入库 |
| `ming-london-1938` | Ming | — | 无 | 显示英文名 |
| `na-na-xinghui-mother` | Na Na | — | 无 | 显示英文名 |
| `pe-pe-chapultepec-1974` | Pe Pe | — | `pe-pe`：佩佩（出生日期不一致或缺失，可能不是同一只） | 显示英文名 |
| `po-atlanta-2010` | Po | 2010-11-03 | 无 | 显示英文名 |
| `po-madrid` | Po | 2010-09-07 | 无 | 显示英文名 |
| `qin-qin-xian-1989` | Qin Qin | 1989-08-23 | `qin-qin-qinling`：秦秦（出生日期不一致或缺失，可能不是同一只） | 显示英文名 |
| `shao-shao-madrid-1978` | Shao Shao | — | 无 | 显示英文名 |
| `shen-wei-tiantian-offspring` | Shen Wei | — | 无 | 显示英文名 |
| `shi-shi-sandiego-huamei-sire` | Shi Shi | — | `shi-shi`：石石（出生日期不一致或缺失，可能不是同一只） | 显示英文名 |
| `su-lin` | Su Lin | — | `su-lin-brookfield`：苏琳（出生日期不一致或缺失，可能不是同一只）；`su-lin-sandiego`：苏琳（出生日期不一致或缺失，可能不是同一只） | 显示英文名 |
| `tjen-tjen-berlin` | Tjen Tjen | — | 无 | 显示英文名 |
| `wu-gang-bifengxia-breeding-male` | Wu Gang | — | 无 | 显示英文名 |
| `xen-li-chapultepec-1980` | Xen Li | 1980-08-10 | `xen-li`：新丽（出生日期一致） | 有出生日期一致的候选：核对出处后可以入库 |
| `xi-meng-tiantian-mate` | Xi Meng | 1993-09-19 | 无 | 显示英文名 |
| `xing-xing-chengdu-1989` | Xing Xing | 1989-10-04 | `xing-xing-my`：兴兴（出生日期不一致或缺失，可能不是同一只） | 显示英文名 |
| `xiu-hua-chapultepec-1985` | Xiu Hua | 1985-06-25 | `xiu-hua`：秀华（出生日期一致） | 有出生日期一致的候选：核对出处后可以入库 |
| `ya-ya-memphis` | Ya Ya | 2000-08-03 | `ya-ya`：丫丫（出生日期一致） | 有出生日期一致的候选：核对出处后可以入库 |
| `yen-yen-paris-1973` | Yen-Yen | — | 无 | 显示英文名 |
| `ying-ying-chapultepec-1974` | Ying Ying | — | `ying-ying`：盈盈（出生日期不一致或缺失，可能不是同一只）；`ying-ying-beijing`：英英（出生日期不一致或缺失，可能不是同一只）；`ying-ying-mexico`：迎迎（出生日期不一致或缺失，可能不是同一只） | 显示英文名 |
| `yuan-yuan-vienna` | Yuan Yuan | 1999-08-23 | `yuan-yuan`：圆圆（出生日期不一致或缺失，可能不是同一只）；`yuan-yuan-moscow`：圆圆（出生日期一致）；`yuan-yuan-sandiego`：元元（出生日期不一致或缺失，可能不是同一只） | 有出生日期一致的候选：核对出处后可以入库 |

### D 类可选方案

1. **只显示英文名（推荐，也是现在的做法）**：例如「Chia-Chia」。不编名字，读屏按英文读。可以在资料页的名字下面加一行小字「暂无公开的中文名」，避免用户以为漏了。
2. **英文名 + 拼音近似**：不推荐。Chia-Chia、Tjen Tjen 这类旧式拼写对应哪几个汉字没法确定，写出来就是编的。
3. **留空，只显示编号或 slug**：不推荐，查不到。
4. **补齐中文名**：只对上表里「出生日期一致」的候选，并且由人工回到原始出处（基地或动物园公告、谱系登记）核对后，再走正常的 curation → release 流程。

## 规范建议（需要你确认）

- **以哪个来源为准**：谱系登记或基地、动物园官方 > 主流媒体 > 粉丝常用。数据里 `nameKind=official` 的才放进 primary。
- **一只熊猫一个 zh-Hans primary**：只写汉字，不混罗马字，不带括号说明。罗马字放到 `en` 或 `official_romanization`。
- **日本、台湾出生的熊猫**：primary 用简体还是原字形（浜、團），二选一，全库统一。
- **没有中文名**：显示英文名，不补。

## 已应用的显示层修正（2026-10-31，已确认）

确认的写法：保留数据里的「浜」，不改成「滨」；先在 App 里做显示层修正，不改 curation 数据，不发布 release。

规则（`displayChineseName`，只用这只熊猫自己名字里已有的写法）：

- **A**「罗马字 / 汉字」：显示只含汉字的那一边，照数据原样（浜 保持 浜）。
- **A，台北**：汉字部分（團團）本身不是别名，而这只熊猫正好有一条长度相同的纯汉字别名（团团）时，显示那条别名。
- **B** 中文 primary 不含汉字：当作没有中文名，显示英文名。这 8 只的英文名和原来显示的文字相同，所以画面上没有变化。
- **C** 截断在括号处：显示括号前的完整写法（娅光），它也是数据里已有的别名。
- **D** 没有中文名：照旧显示英文名，不采用 curation 候选。
- 其他名字不变。原始数据（`chineseName`）不变，搜索仍然匹配全部名字。

按 2026-10-30 读取的公开 release 逐只核对，显示有变化的共 36 只：

| slug | 原来显示 | 现在显示 | 类别 |
|---|---|---|---|
| `aihin-shirahama` | Aihin / 愛浜 | 愛浜 | A |
| `cai-tao-indonesia` | Cai Tao / 彩陶 | 彩陶 | A |
| `eihin-shirahama` | Eihin / 永浜 | 永浜 | A |
| `eimei-shirahama` | Eimei / 永明 | 永明 | A |
| `fuhin-shirahama` | Fuhin / 楓浜 | 楓浜 | A |
| `hu-chun-indonesia` | Hu Chun / 湖春 | 湖春 | A |
| `jian-jian-macao` | Jian Jian / 健健 | 健健 | A |
| `kaihin-shirahama` | Kaihin / 海浜 | 海浜 | A |
| `kang-kang-macao` | Kang Kang / 康康 | 康康 | A |
| `kouhin-shirahama` | Kouhin / 幸浜 | 幸浜 | A |
| `meihin-female-2008-shirahama` | Meihin / 梅浜 | 梅浜 | A |
| `meihin-male-2006-shirahama` | Meihin / 明浜 | 明浜 | A |
| `meimei-shirahama` | Meimei / 梅梅 | 梅梅 | A |
| `ninety-nine-xiaoyatou-offspring-2023` | 九九 / 99 | 九九 | A |
| `ouhin-shirahama` | Ouhin / 桜浜 | 桜浜 | A |
| `rauhin-shirahama` | Rauhin / 良浜 | 良浜 | A |
| `ryuhin-shirahama` | Ryuhin / 隆浜 | 隆浜 | A |
| `saihin-shirahama` | Saihin / 彩浜 | 彩浜 | A |
| `shuhin-shirahama` | Shuhin / 秋浜 | 秋浜 | A |
| `tang-tang-linhui-mother` | Tang Tang / 唐唐 | 唐唐 | A |
| `touhin-shirahama` | Touhin / 桃浜 | 桃浜 | A |
| `tuan-tuan-taipei` | Tuan Tuan / 團團 | 团团 | A（台北，用简体别名） |
| `ya-guang-chengdu-lineage` | 娅光 (Ya Ya | 娅光 | C |
| `ya-lao-da-chengdu-lineage` | 娅老大 (Ya Ya | 娅老大 | C |
| `ya-shuang-chengdu-lineage` | 娅双 (Ya Ya | 娅双 | C |
| `ya-xiang-chengdu-lineage` | 娅祥 (Ya Ya | 娅祥 | C |
| `ya-yun-chengdu-lineage` | 娅韵 (Ya Ya | 娅韵 | C |
| `ya-zai-chengdu-lineage` | 娅仔 (Ya Ya | 娅仔 | C |
| `youhin-female-2010-shirahama` | Youhin / 陽浜 | 陽浜 | A |
| `youhin-founder-shirahama` | Youhin / 蓉浜 | 蓉浜 | A |
| `yuan-bao` | Yuan Bao / 圓寶 | 圆宝 | A（台北，用简体别名） |
| `yuan-yuan-taipei` | Yuan Yuan / 圓圓 | 圆圆 | A（台北，用简体别名） |
| `yuan-zai` | Yuan Zai / 圓仔 | 圆仔 | A（台北，用简体别名） |
| `yuhin-female-2012-shirahama` | Yuhin / 優浜 | 優浜 | A |
| `yuhin-male-2001-shirahama` | Yuhin / 雄浜 | 雄浜 | A |
| `yuihin-shirahama` | Yuihin / 結浜 | 結浜 | A |

`ninety-nine-xiaoyatou-offspring-2023`（九九 / 99）不在上面的 A 表里：原来筛选时只找了拉丁字母，没有算阿拉伯数字。它的规则和 A 一样，「九九」是数据里已有的写法。

数量：A 29 只（其中台北 4 只用简体别名）+ 九九 1 只 + C 6 只 = 36 只显示变化；B 8 只改走英文名但文字不变；D 33 只不变。

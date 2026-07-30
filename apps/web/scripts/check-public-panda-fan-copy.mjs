import { readFile } from "node:fs/promises";

const retiredPublicBrand = ["Panda", "Atlas"].join("");

const checks = [
  {
    path: "features/home/editorial-home-view-model.ts",
    required: ["认识你关注的每一只熊猫", "今天认识哪只熊猫？", "从家庭和地点认识更多熊猫", "Discover the pandas you care about", "Which panda will you meet today?", "Discover more through family and place", "最后核实", "Last verified"],
    banned: ["档案控制台", "结构化入口", "Archive console", "structured entry point", retiredPublicBrand],
  },
  {
    path: "app/[locale]/pandas/page.tsx",
    required: ["熊猫图鉴", "寻找熊猫", "查看熊猫资料", "Panda guide", "Find a panda", "View panda profile"],
    banned: ["熊猫档案检索", "搜索与筛选公开档案", "打开可信档案", "Panda profile discovery", "versioned public archive", "Open trusted profile"],
  },
  {
    path: "features/profile/trusted-profile-page.tsx",
    required: ["熊猫资料", "熊猫简介", "生活时间线", "生活足迹", "Panda introduction", "Life timeline", "Life journey", "最后核实", "Last verified", "有争议", "Disputed"],
    banned: ["可信公开档案", "已审核档案摘要", "档案章节", "Trusted public archive", "Reviewed profile summary"],
  },
  {
    path: "features/lineage/structured-lineage-page.tsx",
    required: ["熊猫家族", "家族关系", "关系来源", "Panda families", "family relationships", "Relationship sources", "最后核实", "Last verified", "有争议", "Disputed"],
    banned: ["结构化熊猫谱系", "图形不是完成任务的前提", "打开可信档案", "Structured panda lineage", "A graph is not required to finish the task", "Open trusted profile"],
  },
  {
    path: "components/patterns/public-entity-page.tsx",
    required: ["熊猫机构", "熊猫生活地点", "现在生活在这里的熊猫", "在熊猫地图中查看", "Panda institution", "Pandas living here now", "View on the panda map", "最后核实", "Last verified"],
    banned: ["机构实体", "场所实体", "可信公开实体", "在结构化地图中查看", "Institution entity", "Place entity", "Trusted public entity", "Open in the structured map"],
  },
  {
    path: "features/map/structured-map-page.tsx",
    required: ["看看大熊猫生活在哪里", "熊猫在哪里", "熊猫旅行记", "野生家园", "探索结果", "See where giant pandas live", "Where pandas live", "Panda journeys", "Wild homes", "Explore results", "公开精度", "Published precision", "最后核实", "Last verified"],
    banned: ["STRUCTURED MAP", "结构化全球分布与足迹", "筛选结构化结果", "结构化结果", "地图 Provider 契约", "当前任务范围", "Structured global distribution and footprints", "Filter structured results", "Structured results", "Map provider contract", "Current task scope"],
  },
  {
    path: "features/map/visualization/map-visualization-enhancement.tsx",
    required: ["真实地图", "在真实地图上看看", "打开真实地图", "LIVE MAP", "See it on a live map", "Open live map", "公开", "published"],
    banned: ["OPTIONAL VISUAL LAYER", "启用地图可视增强", "结构化列表", "Activate map visualization", "structured list"],
  },
  {
    path: "features/feed/public-panda-activity.tsx",
    required: ["熊猫动态", "Panda updates", "更正", "撤回", "corrections", "retractions"],
    banned: ["Public Activity", "Archive releases", "Activity 投影", "projection service", "Archive profile"],
  },
  {
    path: "features/contribute/contribution-editor.tsx",
    required: ["分享熊猫资料", "提交纠错或有来源的新信息", "要更正或补充的内容", "来源", "私有证据", "Share panda information", "Information to correct or add", "Sources", "Private evidence"],
    banned: ["结构化贡献", "结构化断言", "添加断言", "Structured contribution", "Structured assertions", "Add assertion"],
  },
  {
    path: "features/contribute/submission-dashboard.tsx",
    required: ["分享熊猫资料", "提交新资料", "资料纠错", "Share panda information", "Share new information", "Information correction"],
    banned: ["账户贡献", "新建贡献", "结构化更正", "Account contributions", "New contribution", "structured correction"],
  },
];

const failures = [];
for (const check of checks) {
  const text = await readFile(new URL(`../${check.path}`, import.meta.url), "utf8");
  for (const phrase of check.required) {
    if (!text.includes(phrase)) failures.push(`${check.path}: missing required public phrase ${JSON.stringify(phrase)}`);
  }
  for (const phrase of check.banned) {
    if (text.includes(phrase)) failures.push(`${check.path}: retired public phrase remains ${JSON.stringify(phrase)}`);
  }
}

if (failures.length) {
  console.error("ZhiPanda panda-fan public copy check failed:\n");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  console.log(`ZhiPanda panda-fan public copy check passed (${checks.length} representative surfaces).`);
}

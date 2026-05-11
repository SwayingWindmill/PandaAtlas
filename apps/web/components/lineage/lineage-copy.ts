export const LINEAGE_COPY = {
  title: "熊猫谱系探索",
  subtitle: "拖动画布以平移，滚轮缩放，点选节点即可在当前谱系视图中查看个体关系与档案入口。",
  compare: "血缘对比",
  compareHints: [
    "请选择第一只熊猫",
    "请选择第二只熊猫",
    "已高亮对比路径与最近共同祖先"
  ],
  views: {
    tree: "树状",
    radial: "环状"
  },
  controls: {
    zoomOut: "缩小谱系视图",
    zoomIn: "放大谱系视图",
    zoomSlider: "调整谱系缩放比例",
    centerCurrent: "居中当前焦点",
    expandAncestors: "展开上代",
    expandDescendants: "展开后代"
  },
  drawer: {
    title: "个体档案",
    openProfile: "打开完整档案",
    birthDate: "出生日期",
    gender: "性别",
    location: "所在地点",
    parents: "父母记录",
    childrenCount: "子代数量",
    children: "子代",
    highlights: "观察标签",
    empty: "选择一个节点以查看完整档案信息。"
  },
  fallback: {
    unknown: "待补录",
    noPublicRecord: "暂无公开记录"
  }
} as const;

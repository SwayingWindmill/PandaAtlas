export const adminMenuSections = [
  {
    label: "概览",
    items: [{ to: "/", label: "概览" }],
  },
  {
    label: "内容",
    items: [
      { to: "/pandas", label: "熊猫" },
      { to: "/locations", label: "地点" },
      { to: "/relationships", label: "家谱关系" },
      { to: "/events", label: "事件" },
      { to: "/images", label: "图片" },
      { to: "/sources", label: "来源" },
    ],
  },
  {
    label: "互动",
    items: [{ to: "/games", label: "猜熊猫题库" }],
  },
  {
    label: "用户",
    items: [{ to: "/users", label: "用户管理" }],
  },
  {
    label: "系统",
    items: [{ to: "/audit-logs", label: "审计日志" }],
  },
] as const;

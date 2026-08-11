"use client";

import { Link } from "react-router-dom";

interface OperationLink {
  to: string;
  label: string;
  detail: string;
}

interface ProductDomainDefinition {
  title: string;
  eyebrow: string;
  description: string;
  authority: string;
  boundary: string;
  links: OperationLink[];
}

export type ProductAdminDomain =
  | "pandas"
  | "locations"
  | "relationships"
  | "events"
  | "images"
  | "sources"
  | "games"
  | "users";

const domains: Record<ProductAdminDomain, ProductDomainDefinition> = {
  pandas: {
    eyebrow: "Content operations",
    title: "熊猫资料运营",
    description: "处理熊猫身份、名称、状态、简介及会影响公开资料的修正与发布。",
    authority: "Panda 事实仍由 FastAPI + PostgreSQL Archive 权威层维护；公开站只消费审核后的发布版本。",
    boundary: "需要修改现有公开 Panda 时进入 Archive；新资料或证据先进入 Review，再由 Change Set 发布。",
    links: [
      { to: "/archive", label: "打开 Archive 工作台", detail: "检查 Panda Change Set、Diff、来源、公开影响并发布或修正。" },
      { to: "/reviews", label: "打开 Review 工作台", detail: "处理新 Panda 资料、来源补充和贡献审核。" },
      { to: "/audit", label: "查看 Audit", detail: "核查谁在何时对 Panda 资料执行过治理操作。" },
    ],
  },
  locations: {
    eyebrow: "Content operations",
    title: "地点与机构运营",
    description: "处理机构、物理地点、设施和熊猫居住记录。机构与物理地点继续保持分离。",
    authority: "Location/Institution/Residency 事实通过 Archive 发布，不从地图 UI 直接写数据库。",
    boundary: "现有定向活动通知只支持 Panda/Institution；Residency 和 Place 的变更应通过 Change Set/Review 发布，不能伪装成 Panda 修正。",
    links: [
      { to: "/archive", label: "打开 Archive 工作台", detail: "审阅地点、机构和 Residency 相关 Change Set 及发布影响。" },
      { to: "/reviews", label: "打开 Review 工作台", detail: "处理地点来源、迁居证据和机构资料贡献。" },
      { to: "/audit", label: "查看 Audit", detail: "追踪地点与机构治理记录。" },
    ],
  },
  relationships: {
    eyebrow: "Content operations",
    title: "家族关系运营",
    description: "管理父母、子女及其他谱系关系所依赖的 Parentage Assertion 与证据。",
    authority: "谱系关系必须来自经过审核的关系断言；不得根据 father_id/mother_id 或页面展示反推证据状态。",
    boundary: "关系修订先形成 Change Set 和 Review 决定，再由 Archive 发布；不提供绕过证据链的快捷 CRUD。",
    links: [
      { to: "/reviews", label: "打开 Review 工作台", detail: "审核关系断言、冲突来源和补充证据。" },
      { to: "/archive", label: "打开 Archive 工作台", detail: "检查关系 Change Set 的 Diff 与公开谱系影响。" },
      { to: "/audit", label: "查看 Audit", detail: "核查关系断言的治理轨迹。" },
    ],
  },
  events: {
    eyebrow: "Content operations",
    title: "熊猫事件运营",
    description: "处理出生、迁移、返回、命名、公开亮相等已定义 Panda Domain Event。",
    authority: "Calendar 与 Moments 都是同一 Event 真相的视图；事件日期和类型只在权威数据层维护一次。",
    boundary: "事件变更通过 Change Set/Review/Archive 发布。不要在 Calendar、Moments 或游戏中建立第二份事件记录。",
    links: [
      { to: "/reviews", label: "打开 Review 工作台", detail: "审核事件来源、参与熊猫和日期证据。" },
      { to: "/archive", label: "打开 Archive 工作台", detail: "检查事件 Change Set 与公开时间线影响。" },
      { to: "/audit", label: "查看 Audit", detail: "追踪事件治理和发布记录。" },
    ],
  },
  images: {
    eyebrow: "Content operations",
    title: "图片与媒体运营",
    description: "处理公开图片、授权、署名、替代文本和发布状态。",
    authority: "媒体文件由对象存储承载，媒体记录和审核状态由权威数据层管理；公开页面只引用已发布媒体。",
    boundary: "媒体权利和来源必须在 Review/Archive 中核查，不能通过页面上传绕过权利检查。",
    links: [
      { to: "/reviews", label: "打开 Review 工作台", detail: "检查媒体附件、授权、来源和补充请求。" },
      { to: "/archive", label: "打开 Archive 工作台", detail: "发布或撤回会影响公开资料的媒体 Change Set。" },
      { to: "/audit", label: "查看 Audit", detail: "查看媒体读取、审核和发布轨迹。" },
    ],
  },
  sources: {
    eyebrow: "Content operations",
    title: "来源与证据运营",
    description: "管理 Evidence Source、核实状态、可访问性和与事实/关系/事件的证据链接。",
    authority: "Source 是一等数据；公开事实必须保持到来源与断言的可追溯关系。",
    boundary: "来源更新先审核再发布。来源失效不应静默删除已有事实，而应通过显式修正或重新核实处理。",
    links: [
      { to: "/reviews", label: "打开 Review 工作台", detail: "审核来源、附件和证据充分性。" },
      { to: "/archive", label: "打开 Archive 工作台", detail: "检查来源变更对公开事实和发布版本的影响。" },
      { to: "/audit", label: "查看 Audit", detail: "追踪来源治理记录。" },
    ],
  },
  games: {
    eyebrow: "Product operations",
    title: "熊猫游戏运营",
    description: "Random Panda 与 Guess Panda 当前没有独立游戏内容库；它们直接使用已发布 Panda 与媒体。",
    authority: "游戏内容真相仍是 Panda + approved media。当前分数不持久化，也没有 GameAttempt 排行榜。",
    boundary: "要改变游戏可用熊猫或照片，应运营 Panda/图片，而不是维护另一套 GuessQuestion 内容。",
    links: [
      { to: "/pandas", label: "运营 Panda 资料", detail: "管理 Random/Guess 会消费的熊猫公开资料。" },
      { to: "/images", label: "运营公开图片", detail: "管理 Guess Panda 可使用的已发布媒体。" },
      { to: "/audit", label: "查看 Audit", detail: "核查相关内容发布和治理记录。" },
    ],
  },
  users: {
    eyebrow: "Identity operations",
    title: "用户与账号运营",
    description: "账号、处分、申诉、隐私请求和审计分别由现有身份治理能力处理。",
    authority: "用户账号不进入内容 Archive CRUD；身份、Moderation、Privacy 与 Audit 保持独立权限边界。",
    boundary: "Administrator 或 Archive Editor 不会因为内容权限自动获得处分或隐私操作权限。",
    links: [
      { to: "/moderation", label: "打开 Moderation", detail: "处理显式 scope 的处分、冻结和申诉。" },
      { to: "/privacy", label: "打开 Privacy", detail: "处理访问、导出、删除、Hold 和保留维护。" },
      { to: "/audit", label: "打开 Audit", detail: "查询账号相关的统一审计证据。" },
    ],
  },
};

export function ProductOperationsPage({ domain }: { domain: ProductAdminDomain }) {
  const definition = domains[domain];
  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8">
      <Link to="/" className="text-sm font-semibold text-stone-700 underline underline-offset-4">
        返回工作人员控制台
      </Link>
      <p className="mt-8 text-sm font-semibold uppercase tracking-wide text-stone-600">{definition.eyebrow}</p>
      <h1 className="mt-2 text-3xl font-bold text-stone-950">{definition.title}</h1>
      <p className="mt-4 max-w-3xl text-sm leading-7 text-stone-700">{definition.description}</p>

      <div className="mt-8 grid gap-5 md:grid-cols-2">
        <section className="rounded-xl border border-stone-300 bg-white p-5" aria-labelledby={`${domain}-authority`}>
          <h2 id={`${domain}-authority`} className="text-lg font-bold text-stone-950">权威数据边界</h2>
          <p className="mt-3 text-sm leading-6 text-stone-700">{definition.authority}</p>
        </section>
        <section className="rounded-xl border border-stone-300 bg-white p-5" aria-labelledby={`${domain}-boundary`}>
          <h2 id={`${domain}-boundary`} className="text-lg font-bold text-stone-950">操作规则</h2>
          <p className="mt-3 text-sm leading-6 text-stone-700">{definition.boundary}</p>
        </section>
      </div>

      <section className="mt-8" aria-labelledby={`${domain}-actions`}>
        <h2 id={`${domain}-actions`} className="text-xl font-bold text-stone-950">运营入口</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {definition.links.map((item) => (
            <Link key={item.to} to={item.to} className="rounded-xl border border-stone-300 bg-white p-5 hover:border-stone-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-950">
              <strong className="text-stone-950">{item.label}</strong>
              <span className="mt-2 block text-sm leading-6 text-stone-700">{item.detail}</span>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}

export const productAdminDomains = Object.keys(domains) as ProductAdminDomain[];

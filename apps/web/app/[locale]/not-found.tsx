import type { Route } from "next";
import Link from "next/link";

export default function PublicNotFoundState() {
  return (
    <main id="main-content" className="pa-public-register">
      <section className="pa-state-card">
        <p className="pa-eyebrow">Not published</p>
        <h1>当前公开版本中没有这份档案 / This profile is not in the current public release</h1>
        <p>
          这只表示当前发布范围内没有可公开记录，不代表现实中不存在该个体。
          This only describes the current publication scope; it does not claim that the panda does not exist.
        </p>
        <div className="flex flex-wrap gap-3">
          <Link href={"/zh/atlas" as Route}>返回中文档案搜索</Link>
          <Link href={"/en/atlas" as Route}>Open English profile search</Link>
        </div>
      </section>
    </main>
  );
}

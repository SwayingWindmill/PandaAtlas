import { ImportJobsConsole } from "@/components/admin/import-jobs-console";

export default function AdminImportsPage() {
  return (
    <main className="page-shell">
      <section className="hero">
        <h1>本地运维导入台</h1>
        <p>
          创建、执行并追踪导入任务状态。当前流程仅用于本地运维和受控导入验证，浏览器不会暴露后端
          Admin Token。
        </p>
      </section>

      <div className="mt-4 text-sm text-stone-700">
        默认可用 source_name: <code>0001_demo_seed.sql</code>
      </div>

      <section className="mt-6">
        <ImportJobsConsole />
      </section>
    </main>
  );
}

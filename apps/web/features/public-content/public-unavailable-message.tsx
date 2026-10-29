import type { ReactNode } from "react";

// The same state the segment error boundary already shows. It is page copy, not a new control:
// the message is specific to this publication, and the only action is retrying the current URL.
export function PublicUnavailableMessage({ action }: { action?: ReactNode }) {
  return (
    <main id="main-content" className="pa-public-register">
      <section className="pa-state-card" role="alert">
        <p className="pa-eyebrow">暂时无法加载 / Unavailable</p>
        <h1>熊猫资料暂时不可用 / Panda information is temporarily unavailable</h1>
        <p>吱熊猫不会用示例数据代替真实资料。可以重新尝试读取同一公开资料版本。</p>
        {action}
      </section>
    </main>
  );
}

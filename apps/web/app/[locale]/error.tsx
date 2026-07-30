"use client";

import { useEffect } from "react";

export default function PublicErrorState({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main id="main-content" className="pa-public-register">
      <section className="pa-state-card" role="alert">
        <p className="pa-eyebrow">暂时无法加载 / Unavailable</p>
        <h1>熊猫资料暂时不可用 / Panda information is temporarily unavailable</h1>
        <p>吱熊猫不会用示例数据代替真实资料。可以重新尝试读取同一公开资料版本。</p>
        <button type="button" onClick={reset}>重新尝试 / Try again</button>
      </section>
    </main>
  );
}

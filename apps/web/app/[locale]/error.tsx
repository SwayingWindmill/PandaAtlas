"use client";

import { useEffect } from "react";

export default function PublicErrorState({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main id="main-content" className="pa-public-register">
      <section className="pa-state-card" role="alert">
        <p className="pa-eyebrow">Unavailable</p>
        <h1>公开档案暂时不可用 / Public profiles are temporarily unavailable</h1>
        <p>页面不会用示例数据伪装成功。可以重新尝试读取同一公开发布版本。</p>
        <button type="button" onClick={reset}>重新尝试 / Try again</button>
      </section>
    </main>
  );
}

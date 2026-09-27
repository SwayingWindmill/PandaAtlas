import type { Route } from "next";
import Link from "next/link";

import styles from "./prototype.module.css";

export function PrototypeFooter({ locale, directory = false }: { locale: "zh" | "en"; directory?: boolean }) {
  const zh = locale === "zh";

  return (
    <footer className={styles.footer}>
      <div>
        <strong>吱熊猫 ZhiPanda</strong>
        <span>{zh ? "给熊猫爱好者的熊猫世界。" : "A panda world for panda fans."}</span>
      </div>
      <nav>
        {directory ? (
          <>
            <Link href={`/${locale}/prototype/fan-v08` as Route}>{zh ? "V8 首页" : "V8 Home"}</Link>
            <Link href={`/${locale}/pandas` as Route}>
              {zh ? "正式熊猫图鉴与完整筛选" : "Production directory and full filters"}
            </Link>
          </>
        ) : (
          <>
            <Link href={`/${locale}/contribute` as Route}>{zh ? "纠错与贡献" : "Contribute"}</Link>
            <Link href={`/${locale}/pandas` as Route}>
              {zh ? "数据来源在档案页继续查看" : "Sources remain available on profiles"}
            </Link>
          </>
        )}
      </nav>
    </footer>
  );
}

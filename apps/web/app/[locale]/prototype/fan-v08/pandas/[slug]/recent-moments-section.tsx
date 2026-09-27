import type { Route } from "next";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

import type { PandaMomentSource } from "./panda-detail-projection";
import styles from "./recent-moments-section.module.css";

function route(value: string): Route {
  return value as Route;
}

function momentDate(value: string, zh: boolean): string {
  const date = new Date(`${value.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(zh ? "zh-CN" : "en-US", {
    year: "numeric",
    month: zh ? "long" : "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(date);
}

export function RecentMomentsSection({
  displayName,
  locale,
  zh,
  moments,
  slug,
}: {
  displayName: string;
  locale: string;
  zh: boolean;
  moments: PandaMomentSource[];
  slug: string;
}) {
  if (!moments.length) return null;

  return (
    <section
      className={styles.section}
      id="recent-moments"
      aria-labelledby="panda-recent-moments-title"
      data-moment-count={moments.length}
    >
      <div className={styles.shell}>
        <div className={styles.heading}>
          <h2 id="panda-recent-moments-title">{zh ? `最近的${displayName}` : `${displayName}, lately`}</h2>
          <Link href={route(`/${locale}/moments?panda=${slug}`)}>
            {zh ? "查看全部动态" : "View all moments"}<ArrowUpRight aria-hidden="true" />
          </Link>
        </div>
        <ol className={styles.moments}>
          {moments.map((moment) => (
            <li key={moment.id}>
              <time dateTime={moment.date}>{momentDate(moment.date, zh)}</time>
              <p>{moment.text}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

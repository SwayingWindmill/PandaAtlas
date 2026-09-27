import { BlurFade } from "@/components/registry/magicui/blur-fade";
import { NumberTicker } from "@/components/registry/magicui/number-ticker";
import { ProgressiveBlur } from "@/components/registry/magicui/progressive-blur";

import styles from "./directory.module.css";

interface DirectoryMastheadProps {
  locale: "zh" | "en";
  count: number;
  researchMode?: boolean;
  hero: {
    image: string;
    alt: string;
    credit: string | null;
    rights: string | null;
  } | null;
}

export function DirectoryMasthead({
  locale,
  count,
  researchMode = false,
  hero,
}: DirectoryMastheadProps) {
  const zh = locale === "zh";

  return (
    <section className={styles.directoryMasthead} aria-labelledby="v8-directory-title">
      {hero?.image ? (
        <div className={styles.directoryHeroMedia}>
          <img src={hero.image} alt={hero.alt} loading="eager" fetchPriority="high" decoding="async" />
        </div>
      ) : null}
      <div className={styles.directoryHeroShade} aria-hidden="true" />
      <ProgressiveBlur className={styles.heroProgressiveBlur} direction="bottom" strength={14} layers={6} />

      <div className={styles.mastheadShell}>
        <div className={styles.mastheadCopy}>
          <BlurFade delay={0.04} duration={0.5} offset={12}>
            <h1 id="v8-directory-title">{zh ? "熊猫图鉴" : "Panda directory"}</h1>
          </BlurFade>
          <BlurFade delay={0.1} duration={0.48} offset={8}>
            <p>
              {zh
                ? "从照片、名字、家族与生活过的地方，继续认识每一只熊猫。"
                : "Meet individual pandas through their faces, names, families, and the places they have lived."}
            </p>
          </BlurFade>
          <BlurFade delay={0.15} duration={0.44} offset={6}>
            <span
              className={styles.directoryCount}
              data-testid={researchMode ? "fan-v08-research-count" : undefined}
            >
              <NumberTicker value={count} locale={zh ? "zh-CN" : "en-US"} />
              <span>{zh ? "只熊猫" : "pandas"}</span>
            </span>
          </BlurFade>
        </div>

        {hero?.image && (hero.credit || hero.rights) ? (
          <p className={styles.heroCredit}>
            {hero.credit ?? ""}
            {hero.credit && hero.rights ? " · " : ""}
            {hero.rights ?? ""}
          </p>
        ) : null}
      </div>
    </section>
  );
}

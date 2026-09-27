import {
  CalendarDays,
  Clock3,
  Leaf,
  MapPin,
  PawPrint,
  Sparkles,
  Trees,
  UsersRound,
  type LucideIcon,
} from "lucide-react";

import type { PandaDisplayFact, PandaFactKind } from "./panda-fact-selection";
import styles from "./panda-fact-grid.module.css";

interface Props {
  title: string;
  facts: PandaDisplayFact[];
  metadata?: Array<{ label: string; value: string }>;
}

const iconByKind: Record<PandaFactKind, LucideIcon> = {
  identity: PawPrint,
  birth: CalendarDays,
  personality: Leaf,
  family: UsersRound,
  place: MapPin,
  life: Trees,
  significance: Sparkles,
  status: Clock3,
};

export function PandaFactGrid({ title, facts, metadata = [] }: Props) {
  if (facts.length < 2) return null;

  return (
    <section className={styles.section} aria-labelledby="panda-quick-facts" data-fact-count={Math.min(facts.length, 6)}>
      <div className={styles.shell}>
        <h2 id="panda-quick-facts">{title}</h2>
        <div className={styles.grid} data-count={Math.min(facts.length, 6)}>
          {facts.map((fact) => {
            const Icon = iconByKind[fact.kind];
            return (
              <article key={fact.id} className={styles.card} data-kind={fact.kind}>
                <Icon className={styles.icon} aria-hidden="true" />
                <div className={styles.copy}>
                  <span className={styles.label}>{fact.label}</span>
                  <h3>{fact.headline}</h3>
                  {fact.description ? <p>{fact.description}</p> : null}
                </div>
              </article>
            );
          })}
        </div>
        {metadata.length ? (
          <dl className={styles.metadata}>
            {metadata.map((item) => (
              <div key={item.label}>
                <dt>{item.label}</dt>
                <dd>{item.value}</dd>
              </div>
            ))}
          </dl>
        ) : null}
      </div>
    </section>
  );
}

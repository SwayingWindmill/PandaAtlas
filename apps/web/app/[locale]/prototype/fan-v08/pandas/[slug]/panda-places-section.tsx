import type { PandaFactSource } from "./panda-fact-selection";
import styles from "./panda-places-section.module.css";

interface PlaceStop {
  id: string;
  label: string;
  startLabel: string;
  endLabel: string | null;
}

export function PandaPlacesSection({
  displayName,
  zh,
  stops,
  facts,
}: {
  displayName: string;
  zh: boolean;
  stops: PlaceStop[];
  facts: PandaFactSource[];
}) {
  const depth = stops.length + facts.length;
  if (depth < 2) return null;

  return (
    <section
      className={styles.section}
      id="footprint"
      aria-labelledby="panda-places-title"
      data-depth={Math.min(depth, 8)}
      data-has-stops={stops.length ? "true" : "false"}
    >
      <div className={styles.shell}>
        <div className={styles.heading}>
          <h2 id="panda-places-title">{zh ? "它去过的地方" : "Places along the way"}</h2>
          <p>{zh ? `这些地方，串起了${displayName}不同阶段的生活。` : `These places connect different chapters of ${displayName}'s life.`}</p>
        </div>

        {stops.length ? (
          <ol className={styles.route}>
            {stops.map((stop, index) => (
              <li key={stop.id}>
                <span className={styles.routeNode} aria-hidden="true" />
                <div className={styles.routeCopy}>
                  <strong>{stop.label}</strong>
                  <span>{stop.startLabel}{stop.endLabel ? ` — ${stop.endLabel}` : ""}</span>
                </div>
                {index < stops.length - 1 ? <span className={styles.routeLine} aria-hidden="true" /> : null}
              </li>
            ))}
          </ol>
        ) : null}

        {facts.length ? (
          <div className={styles.notes}>
            <p className={styles.featureNote}>{facts[0].text}</p>
            {facts.length > 1 ? (
              <div className={styles.noteGrid}>
                {facts.slice(1, 4).map((fact) => <p key={fact.id}>{fact.text}</p>)}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}

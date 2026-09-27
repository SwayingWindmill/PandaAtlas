/* eslint-disable @next/next/no-img-element */
import type { PandaFactSource } from "./panda-fact-selection";
import styles from "./panda-trait-scenes.module.css";

interface SceneMedia {
  url: string;
  alt: string;
  credit: string | null;
  rights: string | null;
}

interface Props {
  displayName: string;
  zh: boolean;
  recognitionFacts: PandaFactSource[];
  personalityFacts: PandaFactSource[];
  recognitionMedia?: SceneMedia | null;
  personalityMedia?: SceneMedia | null;
}

function creditLine(media: SceneMedia): string | null {
  return [media.credit, media.rights].filter(Boolean).join(" · ") || null;
}

export function PandaTraitScenes({
  displayName,
  zh,
  recognitionFacts,
  personalityFacts,
  recognitionMedia = null,
  personalityMedia = null,
}: Props) {
  if (!recognitionFacts.length && !personalityFacts.length) return null;

  return (
    <>
      {recognitionFacts.length ? (
        <section
          className={styles.recognition}
          id="recognition"
          aria-labelledby="panda-recognition-title"
          data-fact-count={recognitionFacts.length}
          data-has-media={recognitionMedia ? "true" : "false"}
        >
          <div className={styles.sceneShell}>
            {recognitionMedia ? (
              <figure className={styles.sceneMedia}>
                <img src={recognitionMedia.url} alt={recognitionMedia.alt} loading="lazy" />
                {creditLine(recognitionMedia) ? <figcaption>{creditLine(recognitionMedia)}</figcaption> : null}
              </figure>
            ) : null}
            <div className={styles.sceneCopy}>
              <h2 id="panda-recognition-title">{zh ? `一眼认出${displayName}` : `Recognizing ${displayName}`}</h2>
              <p className={styles.lead}>{recognitionFacts[0].text}</p>
              {recognitionFacts.slice(1).map((fact) => <p key={fact.id}>{fact.text}</p>)}
            </div>
          </div>
        </section>
      ) : null}

      {personalityFacts.length ? (
        <section
          className={styles.personality}
          id="personality"
          aria-labelledby="panda-personality-title"
          data-fact-count={personalityFacts.length}
          data-has-media={personalityMedia ? "true" : "false"}
        >
          <div className={styles.personalityShell}>
            <div className={styles.personalityCopy}>
              <h2 id="panda-personality-title">{zh ? `平时的${displayName}` : `${displayName}, day to day`}</h2>
              <p className={styles.personalityLead}>{personalityFacts[0].text}</p>
              <div className={styles.personalityNotes}>
                {personalityFacts.slice(1, 4).map((fact) => <p key={fact.id}>{fact.text}</p>)}
              </div>
            </div>
            {personalityMedia ? (
              <figure className={styles.personalityMedia}>
                <img src={personalityMedia.url} alt={personalityMedia.alt} loading="lazy" />
                {creditLine(personalityMedia) ? <figcaption>{creditLine(personalityMedia)}</figcaption> : null}
              </figure>
            ) : null}
          </div>
        </section>
      ) : null}
    </>
  );
}

import type { PandaStoryChapter } from "./panda-detail-projection";
import styles from "./life-stories-section.module.css";

export function LifeStoriesSection({
  displayName,
  zh,
  chapters,
}: {
  displayName: string;
  zh: boolean;
  chapters: PandaStoryChapter[];
}) {
  if (!chapters.length) return null;

  return (
    <section
      className={styles.section}
      id="life-stories"
      aria-labelledby="panda-life-stories-title"
      data-chapter-count={chapters.length}
    >
      <div className={styles.shell}>
        <h2 id="panda-life-stories-title">
          {zh ? `${displayName}经历过什么` : `What ${displayName} has lived through`}
        </h2>

        <div className={styles.stories}>
          {chapters.map((chapter, chapterIndex) => (
            <article
              key={chapter.id}
              id={chapter.id}
              className={chapterIndex === 0 ? styles.featureStory : styles.story}
            >
              <div className={styles.storyHeading}>
                <h3>{chapter.title}</h3>
              </div>
              <div className={styles.storyBody}>
                <p className={styles.lead}>{chapter.facts[0].text}</p>
                {chapter.facts.slice(1, 2).map((fact) => (
                  <p key={fact.id} className={styles.copy}>{fact.text}</p>
                ))}
                {chapter.facts.length > 2 ? (
                  <details className={styles.more}>
                    <summary>{zh ? "更多细节" : "More details"}</summary>
                    <div className={styles.moreCopy}>
                      {chapter.facts.slice(2).map((fact) => <p key={fact.id}>{fact.text}</p>)}
                    </div>
                  </details>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

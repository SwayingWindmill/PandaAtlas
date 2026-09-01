/* eslint-disable @next/next/no-img-element -- prototype renders current published external panda media directly. */

import type { Metadata, Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, CalendarDays, Heart, MapPin, ShieldCheck, UsersRound } from "lucide-react";

import { familyStoriesForPanda, localizedEditorial } from "@/features/public-experiences/data";
import { loadPublishedAtlasDataset, loadPublishedPandaProfile, resolvePublishedPandaReference } from "@/features/public-content/public-release";
import { buildTrustedProfilePageViewModel, type TrustedProfileFactViewModel } from "@/features/profile/profile-page-view-model";
import { parsePublicLocale } from "@/foundation/content/locales";

import { pandaName, pandaPhotoAlt, PrototypeShell } from "../../prototype-kit";
import styles from "../../subpages.module.css";

interface Props { params: Promise<{ locale: string; slug: string }> }

export const metadata: Metadata = {
  title: "ZhiPanda profile prototype V0.7",
  robots: { index: false, follow: false },
};

function eventLabel(value: string, zh: boolean): string {
  if (!zh) return value.replaceAll("_", " ");
  const labels: Record<string,string> = {
    residency:"生活地点", birth:"出生", arrival:"抵达", transfer:"迁居", return:"返回",
    naming:"命名", public_debut:"公开亮相", selection:"选择", announcement:"公开消息",
    observation:"记录", death:"去世",
  };
  return labels[value] ?? value;
}

function relationLabel(value: string, zh: boolean): string {
  if (value === "father") return zh ? "爸爸" : "Father";
  if (value === "mother") return zh ? "妈妈" : "Mother";
  if (value === "child") return zh ? "孩子" : "Child";
  if (value === "sibling") return zh ? "兄弟姐妹" : "Sibling";
  if (value === "grandparent") return zh ? "祖辈" : "Grandparent";
  return value;
}

function statusLabel(value: string, zh: boolean): string {
  if (value === "alive") return zh ? "存活" : "Alive";
  if (value === "deceased") return zh ? "已死亡" : "Deceased";
  return zh ? "未知" : "Unknown";
}

function genderLabel(value: string, zh: boolean): string {
  if (value === "female") return zh ? "雌性" : "Female";
  if (value === "male") return zh ? "雄性" : "Male";
  return zh ? "未知" : "Unknown";
}

function factStatusLabel(value: string, zh: boolean): string {
  if (value === "confirmed") return zh ? "已确认" : "Confirmed";
  if (value === "provisional" || value === "tentative") return zh ? "暂定" : "Tentative";
  if (value === "disputed") return zh ? "有争议" : "Disputed";
  if (value === "superseded") return zh ? "已替代" : "Superseded";
  return zh ? "未知" : "Unknown";
}

function factLabel(field: TrustedProfileFactViewModel["field"], zh: boolean): string {
  if (field === "life_status") return zh ? "生命状态" : "Life status";
  if (field === "birth_date") return zh ? "出生日期" : "Birth date";
  if (field === "sex") return zh ? "性别" : "Sex";
  return zh ? "当前公开地点" : "Current published place";
}

function factValue(fact: TrustedProfileFactViewModel, zh: boolean): string {
  if (fact.value === null || fact.value === undefined || fact.value === "") return zh ? "未公开" : "Not published";
  if (fact.field === "life_status") return statusLabel(String(fact.value), zh);
  if (fact.field === "sex") return genderLabel(String(fact.value), zh);
  if (Array.isArray(fact.value)) return fact.value.join(" · ");
  return String(fact.value);
}

function recordLabel(value: string | null, zh: boolean): string {
  if (value === "complete_first_pass") return zh ? "核心档案较完整" : "Core profile reviewed";
  if (value === "identity_first_pass") return zh ? "身份基础档案" : "Identity-first profile";
  if (value === "dependency_stub") return zh ? "依赖资料整理中" : "Dependency record";
  return zh ? "资料整理中" : "Record in progress";
}

function residencyTypeLabel(value: string, zh: boolean): string {
  const labels: Record<string, [string, string]> = {
    primary: ["主要居住", "Primary residence"], temporary: ["临时居住", "Temporary residence"],
    transit: ["转运", "Transit"], quarantine: ["检疫", "Quarantine"],
  };
  const result = labels[value];
  return result ? result[zh ? 0 : 1] : value;
}

function relationGroups<T extends { relation: string }>(items: T[], zh: boolean) {
  const order = ["father", "mother", "child", "sibling", "grandparent"];
  return order.flatMap((relation) => {
    const matches = items.filter((item) => item.relation === relation);
    return matches.length ? [{ relation, label: relationLabel(relation, zh), items: matches }] : [];
  });
}

export default async function FanV07Panda({ params }: Props) {
  const { locale: rawLocale, slug } = await params;
  const locale = parsePublicLocale(rawLocale);
  if (!locale) notFound();
  const zh = locale === "zh";
  const ref = resolvePublishedPandaReference(slug);
  if (!ref) notFound();
  const envelope = loadPublishedPandaProfile(ref.slug, locale);
  if (!envelope) notFound();

  const profile = buildTrustedProfilePageViewModel(envelope.data, locale);
  const panda = envelope.data.panda;
  const atlas = loadPublishedAtlasDataset(locale);
  const pandaById = new Map(atlas.data.pandas.map((item) => [item.id, item]));
  const relations = [...profile.family.parents, ...profile.family.children, ...profile.family.related].flatMap((relation) => {
    const related = pandaById.get(relation.id);
    return related ? [{ relation, panda: related }] : [];
  });
  const groupedRelations = relationGroups(relations.map((item) => ({ ...item, relation: item.relation.relation })), zh);
  const media = profile.media.items.filter((item) => Boolean(item.url)).slice(0, 10);
  const heroMedia = media.find((item) => item.url === panda.cover_image_url) ?? media[0] ?? null;
  const storyMedia = media.find((item) => item.id !== heroMedia?.id) ?? heroMedia;
  const familyStories = familyStoriesForPanda(profile.stableId);
  const featureFamilyStory = familyStories[0] ?? null;
  const featureFamilyCopy = featureFamilyStory ? localizedEditorial(featureFamilyStory.localized_content, locale) : null;
  const storyParagraphs = profile.story.state === "reviewed" && profile.story.paragraphs.length
    ? profile.story.paragraphs
    : [panda.intro ?? profile.summary].filter((value): value is string => Boolean(value));
  const other = locale === "zh" ? "en" : "zh";

  return (
    <PrototypeShell locale={locale} active="pandas" alternatePath={`/${other}/prototype/fan-v07/panda/${panda.slug}`}>
      <main className={styles.subPage}>
        <div className={styles.subShell}>
          <section className={styles.profileTop}>
            <div className={styles.profileHero}>
              <div className={styles.profileHeroMedia}>
                {heroMedia?.url ? <img src={heroMedia.url} alt={heroMedia.alt || pandaPhotoAlt(panda, locale)} /> : panda.cover_image_url ? <img src={panda.cover_image_url} alt={pandaPhotoAlt(panda, locale)} /> : null}
                {heroMedia?.credit ? <span className={styles.profileCredit}>{heroMedia.credit}</span> : null}
              </div>
              <div className={styles.profileHeroInfo}>
                <div className={styles.profileEyebrow}>{zh ? "Panda profile · 熊猫档案" : "Panda profile"}</div>
                <div className={styles.profileStatusRow}>
                  <span className={styles.profileStatus}>{statusLabel(panda.status, zh)}</span>
                  <span>{recordLabel(profile.recordTier, zh)}</span>
                </div>
                <h1>{profile.displayName}</h1>
                <p className={styles.profileAlt}>{[profile.alternateName, profile.pinyin].filter(Boolean).join(" · ")}</p>
                {profile.summary ? <p className={styles.profileSummary}>{profile.summary}</p> : null}
                <div className={styles.quickFacts}>
                  <div className={styles.quickFact}><span>{zh ? "性别" : "Sex"}</span><strong>{genderLabel(panda.gender, zh)}</strong></div>
                  <div className={styles.quickFact}><span>{zh ? "出生" : "Born"}</span><strong>{panda.birth_date?.slice(0,10) ?? (zh ? "未公开" : "Not published")}</strong></div>
                  <div className={styles.quickFact}><span>{zh ? "出生地" : "Birthplace"}</span><strong>{panda.birthplace ?? (zh ? "未公开" : "Not published")}</strong></div>
                  <div className={styles.quickFact}><span>{zh ? "当前公开地点" : "Published place"}</span><strong>{profile.currentPlace.label || (zh ? "未公开" : "Not published")}</strong></div>
                  <div className={styles.quickFact}><span>{zh ? "最近核实" : "Last verified"}</span><strong>{profile.lastVerifiedAt?.slice(0,10) ?? (zh ? "未公开" : "Not published")}</strong></div>
                  <div className={styles.quickFact}><span>{zh ? "公开来源" : "Public sources"}</span><strong>{profile.sources.length}</strong></div>
                </div>
                <div className={styles.profileActions}>
                  <Link href={`/${locale}/me` as Route}><Heart aria-hidden="true" />{zh ? "加入我的熊猫" : "Save panda"}</Link>
                  <Link href={`/${locale}/moments?panda=${profile.canonicalSlug}` as Route}><CalendarDays aria-hidden="true" />{zh ? "查看时光" : "View moments"}</Link>
                  <Link href={`/${locale}/prototype/fan-v07/lineage?focus=${profile.canonicalSlug}` as Route}><UsersRound aria-hidden="true" />{zh ? "查看谱系" : "View lineage"}</Link>
                </div>
              </div>
            </div>
          </section>

          <nav className={styles.profileSectionNav} aria-label={zh ? "熊猫档案章节" : "Profile sections"}>
            <a href="#about">{zh ? "关于" : "About"}</a>
            <a href="#identity">{zh ? "身份与事实" : "Identity"}</a>
            {relations.length ? <a href="#family">{zh ? "家族" : "Family"}</a> : null}
            {profile.timeline.items.length ? <a href="#timeline">{zh ? "时间线" : "Timeline"}</a> : null}
            {profile.footprint.stops.length ? <a href="#places">{zh ? "地点" : "Places"}</a> : null}
            {media.length ? <a href="#photos">{zh ? "照片" : "Photos"}</a> : null}
            <a href="#sources">{zh ? "来源" : "Sources"}</a>
          </nav>

          <div className={styles.profileBody}>
            <section className={styles.contentSection} id="about">
              <div className={styles.contentHeader}>
                <h2>{zh ? `关于${profile.displayName}` : `About ${profile.displayName}`}</h2>
                <p>{zh ? "先把这只熊猫当成一个真实个体来认识，再进入结构化资料。" : "Meet this panda as an individual first, then move into structured records."}</p>
              </div>
              <div className={styles.storyLead}>
                <div className={styles.storyLeadText}>
                  {storyParagraphs.length ? storyParagraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>) : <p>{zh ? "当前公开版本还没有更完整的介绍文字。" : "A longer introduction is not available in the current public release."}</p>}
                  {panda.tags.length ? <div className={styles.profileTags}>{panda.tags.slice(0,8).map((tag) => <span key={tag}>{tag}</span>)}</div> : null}
                </div>
                {storyMedia?.url ? <div className={styles.storyLeadMedia}><img src={storyMedia.url} alt={storyMedia.alt || pandaPhotoAlt(panda, locale)} loading="lazy" /></div> : null}
              </div>
            </section>

            <section className={styles.contentSection} id="identity">
              <div className={styles.contentHeader}>
                <h2>{zh ? "身份与事实" : "Identity & facts"}</h2>
                <p>{zh ? "名字、别名、事实结论和核实状态集中展示。确认、暂定或有争议的信息不再藏在资料底部。" : "Names, references, factual conclusions, and verification states are visible together instead of buried at the bottom."}</p>
              </div>
              <div className={styles.identityDossier}>
                <div className={styles.identityNamesPanel}>
                  <div className={styles.identityPrimary}>
                    <span>{zh ? "公开名称" : "Public name"}</span>
                    <strong>{profile.displayName}</strong>
                    <em>{[profile.alternateName, profile.pinyin].filter(Boolean).join(" · ") || (zh ? "暂无其他公开名称" : "No additional public name")}</em>
                  </div>
                  <dl className={styles.identityMetaList}>
                    <div><dt>{zh ? "Stable ID" : "Stable ID"}</dt><dd>{profile.stableId}</dd></div>
                    <div><dt>{zh ? "Canonical slug" : "Canonical slug"}</dt><dd>{profile.canonicalSlug}</dd></div>
                    <div><dt>{zh ? "档案状态" : "Record state"}</dt><dd>{recordLabel(profile.recordTier, zh)}</dd></div>
                    <div><dt>{zh ? "最近核实" : "Last verified"}</dt><dd>{profile.lastVerifiedAt?.slice(0,10) ?? "—"}</dd></div>
                  </dl>
                  {profile.identityReferences.length ? (
                    <div className={styles.identityAliases}>
                      <span>{zh ? "其他身份引用" : "Other identity references"}</span>
                      {profile.identityReferences.slice(0,10).map((reference) => <div key={`${reference.kind}-${reference.value}`}><strong>{reference.value}</strong><em>{reference.kind}</em></div>)}
                    </div>
                  ) : null}
                </div>
                <div className={styles.factConclusionList}>
                  {profile.facts.map((fact) => (
                    <div className={styles.factConclusion} key={fact.field}>
                      <div><span>{factLabel(fact.field, zh)}</span><strong>{factValue(fact, zh)}</strong></div>
                      <div className={styles.factConclusionMeta}>
                        <em data-state={fact.status}>{factStatusLabel(fact.status, zh)}</em>
                        <span>{fact.lastVerifiedAt ? `${zh ? "核实" : "Verified"} ${fact.lastVerifiedAt.slice(0,10)}` : (zh ? "暂无核实日期" : "No verification date")}</span>
                        <span>{zh ? `${fact.sourceIds.length} 个来源` : `${fact.sourceIds.length} sources`}</span>
                      </div>
                      {fact.candidateValues.length || fact.supersededValues.length ? (
                        <p>{zh ? "存在其他候选/历史值，正式资料页可继续查看证据。" : "Other candidate or superseded values exist; inspect the production profile for evidence."}</p>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>
            </section>

            {relations.length ? (
              <section className={styles.contentSection} id="family">
                <div className={styles.contentHeader}>
                  <h2>{zh ? "家族" : "Family"}</h2>
                  <p>{zh ? "父母、孩子、兄弟姐妹和祖辈分组展示；关系状态和证据仍然可以进入谱系工具核查。" : "Parents, children, siblings, and grandparents are grouped for quick reading, with relationship evidence available in lineage."}</p>
                </div>
                <div className={styles.familyGroups}>
                  {groupedRelations.map((group) => (
                    <div className={styles.familyGroup} key={group.relation}>
                      <h3>{group.label}</h3>
                      <div className={styles.familyGrid}>
                        {group.items.map((item) => {
                          const original = relations.find((candidate) => candidate.panda.id === item.panda.id && candidate.relation.relation === item.relation);
                          if (!original) return null;
                          return (
                            <Link className={styles.familyMember} key={`${item.relation}-${item.panda.id}`} href={`/${locale}/prototype/fan-v07/panda/${item.panda.slug}` as Route}>
                              <div className={styles.familyMemberPhoto}>{item.panda.cover_image_url ? <img src={item.panda.cover_image_url} alt={pandaPhotoAlt(item.panda, locale)} loading="lazy" /> : null}</div>
                              <strong>{pandaName(item.panda, locale)}</strong>
                              <span>{factStatusLabel(original.relation.status, zh)} · {original.relation.sourceIds.length} {zh ? "来源" : "sources"}</span>
                            </Link>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
                {featureFamilyStory && featureFamilyCopy ? (
                  <div className={styles.profileFamilyStory}>
                    <div><span>{zh ? "相关家族故事" : "Related family story"}</span><h3>{featureFamilyCopy.title}</h3><p>{featureFamilyCopy.summary}</p></div>
                    <Link href={`/${locale}/families/${featureFamilyStory.slug}` as Route}>{zh ? "阅读故事" : "Read story"}<ArrowRight aria-hidden="true" /></Link>
                  </div>
                ) : null}
                <Link className={styles.textAction} href={`/${locale}/prototype/fan-v07/lineage?focus=${panda.slug}` as Route}><UsersRound aria-hidden="true" />{zh ? "查看完整谱系" : "View full lineage"}<ArrowRight aria-hidden="true" /></Link>
              </section>
            ) : null}

            {profile.timeline.items.length ? (
              <section className={styles.contentSection} id="timeline">
                <div className={styles.contentHeader}>
                  <h2>{zh ? "生命时间线" : "Life timeline"}</h2>
                  <p>{zh ? "出生、迁居、返回、命名、公开亮相与其他已发布事件按时间排列，并保留事件状态与来源数量。" : "Birth, moves, returns, naming, public moments, and other published events are ordered by time with status and source counts."}</p>
                </div>
                <div className={styles.timelineList}>
                  {profile.timeline.items.slice(0,18).map((item) => (
                    <div className={styles.timelineRowRich} key={`${item.kind}-${item.id}`}>
                      <time dateTime={item.date}>{item.date.slice(0,10)}</time>
                      <div><strong>{eventLabel(item.kind, zh)}</strong><span>{item.status}</span></div>
                      <p>{item.fromLabel ? `${item.fromLabel} → ` : ""}{item.toLabel || (zh ? "公开记录" : "Published record")}{item.endDate ? ` · ${zh ? "至" : "to"} ${item.endDate}` : ""}</p>
                      <div className={styles.timelineEvidence}><span>{item.datePrecision}</span><span>{zh ? `${item.sourceIds.length} 来源` : `${item.sourceIds.length} sources`}</span>{item.changesCurrentResidency ? <em>{zh ? "改变当前居住记录" : "residency change"}</em> : null}</div>
                    </div>
                  ))}
                </div>
                <Link className={styles.textAction} href={`/${locale}/moments?panda=${panda.slug}` as Route}><CalendarDays aria-hidden="true" />{zh ? "在熊猫时光中查看" : "Open in Panda Moments"}<ArrowRight aria-hidden="true" /></Link>
              </section>
            ) : null}

            {profile.footprint.stops.length ? (
              <section className={styles.contentSection} id="places">
                <div className={styles.contentHeader}>
                  <h2>{zh ? "生活过的地方" : "Places lived"}</h2>
                  <p>{zh ? "这里展示的是公开 residency 记录，不是实时定位。每一站都保留居住类型、时间范围、状态和最近核实日期。" : "These are published residency records, not live tracking. Each stop keeps residency type, date range, status, and verification date."}</p>
                </div>
                <div className={styles.placeJourney}>
                  {profile.footprint.stops.slice(0,8).map((stop, index) => (
                    <div className={styles.placeJourneyStop} key={stop.id}>
                      <div className={styles.placeJourneyIndex}>{String(index + 1).padStart(2,"0")}</div>
                      <div><strong>{stop.label}</strong><span>{residencyTypeLabel(stop.residencyType, zh)} · {stop.status}</span></div>
                      <div><time>{stop.startDate}{stop.endDate ? ` — ${stop.endDate}` : " —"}</time><span>{stop.lastVerifiedAt ? `${zh ? "核实" : "Verified"} ${stop.lastVerifiedAt.slice(0,10)}` : ""}</span></div>
                      {stop.current ? <em>{zh ? "最近公开记录" : "Latest published record"}</em> : null}
                    </div>
                  ))}
                </div>
                <Link className={styles.textAction} href={`/${locale}/prototype/fan-v07/map` as Route}><MapPin aria-hidden="true" />{zh ? "在地图中继续" : "Continue on the map"}<ArrowRight aria-hidden="true" /></Link>
              </section>
            ) : null}

            {media.length ? (
              <section className={styles.contentSection} id="photos">
                <div className={styles.contentHeader}>
                  <h2>{zh ? "照片与媒体" : "Photos & media"}</h2>
                  <p>{zh ? "照片不仅展示熊猫，也保留署名、授权信息和原始来源。" : "Photography keeps credit, rights information, and original source context instead of acting as decoration only."}</p>
                </div>
                <div className={styles.galleryGridRich}>
                  {media.map((item) => (
                    <figure key={item.id} className={styles.galleryItem}>
                      <a href={item.sourceUrl ?? item.url ?? undefined} target="_blank" rel="noreferrer"><img src={item.url ?? ""} alt={item.alt} loading="lazy" /></a>
                      <figcaption><strong>{item.credit ?? (zh ? "署名未公开" : "Credit not published")}</strong><span>{item.rights ?? (zh ? "授权信息未公开" : "Rights not published")}</span></figcaption>
                    </figure>
                  ))}
                </div>
              </section>
            ) : null}

            <section className={styles.contentSection} id="sources">
              <div className={styles.contentHeader}>
                <h2>{zh ? "来源、核实与版本" : "Sources, verification & version"}</h2>
                <p>{zh ? "把可信度放在最后一段，但不是藏起来：来源可访问状态、核实日期和数据版本都可以追溯。" : "Trust details sit at the end without being hidden: access state, verification dates, and data versions remain traceable."}</p>
              </div>
              <div className={styles.verificationSummary}>
                <div><ShieldCheck aria-hidden="true" /><span>{zh ? "档案状态" : "Record state"}</span><strong>{recordLabel(profile.recordTier, zh)}</strong></div>
                <div><span>{zh ? "最近核实" : "Last verified"}</span><strong>{profile.lastVerifiedAt?.slice(0,10) ?? "—"}</strong></div>
                <div><span>{zh ? "数据版本" : "Data version"}</span><strong>{profile.revision.dataVersion ?? "—"}</strong></div>
                <div><span>{zh ? "公开结构版本" : "Public schema"}</span><strong>{profile.revision.publicSchemaVersion ?? "—"}</strong></div>
              </div>
              {profile.revision.summary ? <p className={styles.revisionSummary}>{profile.revision.summary}</p> : null}
              <details className={styles.sources} open>
                <summary>{zh ? `${profile.sources.length} 条公开来源` : `${profile.sources.length} public sources`}</summary>
                <div className={styles.sourceListRich}>{profile.sources.slice(0,18).map((source) => (
                  <a key={source.id} href={source.url} target="_blank" rel="noreferrer">
                    <div><strong>{source.publisher}</strong><span>{source.title}</span></div>
                    <div><span>{source.publishedAt ? `${zh ? "发布" : "Published"} ${source.publishedAt.slice(0,10)}` : (zh ? "发布日期未公开" : "Publication date unavailable")}</span><span>{zh ? `核实 ${source.lastVerifiedAt.slice(0,10)}` : `Verified ${source.lastVerifiedAt.slice(0,10)}`}</span><em>{source.accessState}</em></div>
                  </a>
                ))}</div>
              </details>
              <div className={styles.profileBottomActions}>
                <Link href={`/${locale}/pandas/${panda.slug}` as Route}>{zh ? "打开正式资料页" : "Open production profile"}<ArrowRight aria-hidden="true" /></Link>
                <Link href={`/${locale}/me` as Route}><Heart aria-hidden="true" />{zh ? "加入我的熊猫" : "Save to My Pandas"}</Link>
              </div>
            </section>
          </div>
        </div>
      </main>
    </PrototypeShell>
  );
}

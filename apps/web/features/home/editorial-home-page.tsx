import type { Route } from "next";
import Link from "next/link";
import {
  ArrowRight,
  Building2,
  MapPinned,
  Network,
  Search,
} from "lucide-react";
import { GlobalNavigation, publicShellClassName } from "@/components/patterns/global-navigation";
import { LicensedMediaFigure } from "@/components/patterns/licensed-media-figure";
import { PublicDeliveryNotice } from "@/components/patterns/public-delivery-notice";
import SphereImageGrid, { type ImageData } from "@/components/ui/img-sphere";
import type {
  PublicCoverage,
  PublicDelivery,
  PublicLocaleDelivery,
  PublicReleaseIdentity,
} from "@/features/public-content/public-release";
import type { PublicLocale } from "@/foundation/content/locales";
import type { EditorialHomeViewModel } from "./editorial-home-view-model";

interface EditorialHomePageProps {
  locale: PublicLocale;
  view: EditorialHomeViewModel;
  sphereImages: ImageData[];
  release: PublicReleaseIdentity;
  delivery: PublicDelivery;
  coverage: PublicCoverage;
  localeDelivery: PublicLocaleDelivery;
}

function route(value: string): Route {
  return value as Route;
}

export function EditorialHomePage({
  locale,
  view,
  sphereImages,
  release,
  delivery,
  coverage,
  localeDelivery,
}: EditorialHomePageProps) {
  return (
    <>
      <GlobalNavigation locale={locale} active="home" />
      <main id="main-content" className="pa-public-main pa-editorial-home" data-testid="editorial-home">
        <section className={`${publicShellClassName} pa-home-hero`} aria-labelledby="home-title">
          <div className="pa-home-hero-copy">
            <p className="pa-eyebrow">{view.hero.eyebrow}</p>
            <h1 id="home-title">{view.hero.title}</h1>
            <p className="pa-lede">{view.hero.description}</p>
            <form
              role="search"
              aria-label={view.hero.searchLabel}
              action={view.hero.searchAction}
              method="get"
              className="pa-search-form pa-home-search"
            >
              <label htmlFor="editorial-home-query">{view.hero.inputLabel}</label>
              <div className="pa-search-row">
                <span className="pa-search-icon" aria-hidden="true"><Search /></span>
                <input
                  id="editorial-home-query"
                  name="q"
                  type="search"
                  placeholder={view.hero.placeholder}
                  autoComplete="off"
                />
                <button type="submit">{view.hero.searchButton}</button>
              </div>
            </form>
            <div className="pa-home-quick-links" aria-label={locale === "zh" ? "快速搜索" : "Quick searches"}>
              {view.hero.quickLinks.map((link) => (
                <Link key={link.href} href={route(link.href)}>{link.label}</Link>
              ))}
            </div>
            <Link href={route(view.hero.atlasHref)} className="pa-text-link">
              {view.hero.atlasLabel}<ArrowRight aria-hidden="true" />
            </Link>
          </div>

          <div className="pa-home-hero-visual relative min-h-[25rem] overflow-hidden rounded-[2rem]" aria-label={view.hero.noMediaLabel}>
            {sphereImages.length >= 8 ? (
              <div className="absolute inset-0 z-10 overflow-hidden rounded-[2rem] border border-[var(--pa-color-line)] bg-[radial-gradient(circle_at_50%_45%,rgba(206,232,210,0.98),rgba(238,242,225,0.94)_38%,rgba(223,232,211,0.88)_68%,rgba(255,255,255,0.82)_100%)] shadow-[var(--pa-shadow-card)]">
                <SphereImageGrid
                  images={sphereImages}
                  sphereRadius={205}
                  baseImageScale={0.145}
                  autoRotateSpeed={0.1}
                  regionLabel={locale === "zh" ? "可拖动旋转的熊猫图片球" : "Draggable rotating panda image sphere"}
                />
                <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-between gap-3 bg-gradient-to-t from-[rgba(18,48,31,0.84)] to-transparent px-5 pb-4 pt-12 text-xs font-semibold text-white">
                  <span>{locale === "zh" ? "拖动旋转 · 点击照片认识熊猫" : "Drag to rotate · Select a panda"}</span>
                  <span aria-hidden="true">↔</span>
                </div>
              </div>
            ) : null}
            <LicensedMediaFigure
              locale={locale}
              variant="home"
              src={view.hero.media?.src ?? null}
              srcSet={view.hero.media?.srcSet}
              sizes="(min-width: 1024px) 48vw, 100vw"
              width={view.hero.media?.width}
              height={view.hero.media?.height}
              alt={view.hero.media?.alt ?? view.hero.noMediaTitle}
              credit={view.hero.media?.credit}
              rights={view.hero.media?.rights}
              sourceUrl={view.hero.media?.sourceUrl}
              profileHref={view.hero.media?.profileHref}
              profileLabel={view.hero.media?.profileLabel}
              fallbackTitle={view.hero.noMediaTitle}
              fallbackBody={view.hero.noMediaBody}
              priority
              testId="home-hero-media"
            />
          </div>
        </section>

        <section
          className={`${publicShellClassName} pa-home-section pa-home-selections`}
          aria-labelledby="home-selections-title"
          data-testid="editorial-selections"
        >
          <header className="pa-home-section-heading">
            <div>
              <p className="pa-eyebrow">{view.profiles.eyebrow}</p>
              <h2 id="home-selections-title">{view.profiles.title}</h2>
            </div>
            <p>{view.profiles.description}</p>
          </header>
          <p className="pa-home-disclosure">{view.profiles.selectionDisclosure}</p>

          <div className="pa-home-profile-stage">
            {view.profiles.items.map((profile) => (
              <article key={profile.id} className="pa-home-profile">
                <div className="pa-home-profile-media">
                  <LicensedMediaFigure
                    locale={locale}
                    variant="card"
                    src={profile.media?.src ?? null}
                    srcSet={profile.media?.srcSet}
                    sizes="(min-width: 1100px) 24vw, (min-width: 640px) 48vw, 100vw"
                    width={profile.media?.width}
                    height={profile.media?.height}
                    alt={profile.media?.alt ?? profile.name}
                    credit={profile.media?.credit}
                    rights={profile.media?.rights}
                    sourceUrl={profile.media?.sourceUrl}
                    fallbackTitle={locale === "zh" ? "暂无授权图片" : "No licensed image"}
                    fallbackBody={locale === "zh" ? "不会使用其他熊猫的照片替代。" : "Another panda is never used as a substitute."}
                    testId={`featured-panda-${profile.slug}`}
                  />
                </div>
                <div className="pa-home-profile-copy">
                  <p className="pa-home-profile-meta">{profile.birthLabel} · {profile.genderLabel}</p>
                  <h3><Link href={route(profile.href)}>{profile.name}</Link></h3>
                  {profile.alternateName ? <p className="pa-home-profile-alternate">{profile.alternateName}</p> : null}
                  <p className="pa-home-profile-place">{profile.currentPlace}</p>
                  <p className="pa-home-profile-summary">{profile.summary}</p>
                  <Link href={route(profile.href)} className="pa-home-profile-open" aria-label={`${view.hero.atlasLabel}: ${profile.name}`}>
                    {locale === "zh" ? "认识它" : "Meet this panda"}<ArrowRight aria-hidden="true" />
                  </Link>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section
          className="pa-home-exploration-band"
          aria-labelledby="home-exploration-title"
          data-testid="relationship-place-exploration"
        >
          <div className={`${publicShellClassName} pa-home-section`}>
            <header className="pa-home-section-heading pa-home-section-heading-light">
              <div>
                <p className="pa-eyebrow">{view.explorations.eyebrow}</p>
                <h2 id="home-exploration-title">{view.explorations.title}</h2>
              </div>
              <p>{view.explorations.description}</p>
            </header>

            <div className="pa-home-explorations">
              {view.explorations.items.map((item) => {
                const Icon = item.id === "relationships" ? Network : MapPinned;
                return (
                  <article key={item.id} className="pa-home-exploration">
                    <div className="pa-home-exploration-icon" aria-hidden="true"><Icon /></div>
                    <p className="pa-home-exploration-eyebrow">{item.eyebrow}</p>
                    <h3>{item.title}</h3>
                    <p>{item.body}</p>
                    {item.familyPreview?.length ? (
                      <div className="pa-home-family-preview" aria-label={locale === "zh" ? "美香家族三代预览" : "Three-generation Mei Xiang family preview"}>
                        {item.familyPreview.map((member, index) => (
                          <div key={member.href} className="pa-home-family-step">
                            {index ? <span className="pa-home-family-connector" aria-hidden="true">→</span> : null}
                            <Link href={route(member.href)}>
                              <strong>{member.name}</strong>
                              {member.alternateName ? <span>{member.alternateName}</span> : null}
                            </Link>
                          </div>
                        ))}
                      </div>
                    ) : null}
                    <Link href={route(item.primaryHref)} className="pa-home-primary-link">
                      {item.primaryLabel}<ArrowRight aria-hidden="true" />
                    </Link>
                    <div className="pa-home-secondary-links">
                      {item.secondaryLinks.map((link) => (
                        <Link key={link.href} href={route(link.href)}>
                          {item.id === "places" ? <Building2 aria-hidden="true" /> : null}
                          {link.label}
                        </Link>
                      ))}
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        <section
          className={`${publicShellClassName} pa-home-section pa-home-revisions`}
          aria-labelledby="home-revisions-title"
          data-testid="recent-archive-revisions"
        >
          <header className="pa-home-section-heading">
            <div>
              <p className="pa-eyebrow">{view.revisions.eyebrow}</p>
              <h2 id="home-revisions-title">{view.revisions.title}</h2>
            </div>
            <p>{view.revisions.description}</p>
          </header>

          {view.revisions.items.length ? (
            <ol className="pa-home-revision-list">
              {view.revisions.items.map((revision) => (
                <li key={revision.id}>
                  <div className="pa-home-revision-marker" aria-hidden="true" />
                  <article>
                    <div className="pa-home-revision-heading">
                      <h3><Link href={route(revision.href)}>{revision.pandaName}</Link></h3>
                      {revision.alternateName ? <span>{revision.alternateName}</span> : null}
                    </div>
                    <p>{revision.summary}</p>
                    <div className="pa-home-revision-meta">
                      <span>{revision.verifiedLabel}</span>
                    </div>
                  </article>
                </li>
              ))}
            </ol>
          ) : <p className="pa-home-empty">{view.revisions.empty}</p>}
        </section>

        <section
          className={`${publicShellClassName} pa-home-section pa-home-method`}
          aria-labelledby="home-method-title"
          data-testid="archive-method"
        >
          <div className="pa-home-method-intro">
            <p className="pa-eyebrow">{view.method.eyebrow}</p>
            <h2 id="home-method-title">{view.method.title}</h2>
            <p>{view.method.description}</p>
          </div>
          <details className="pa-home-release-details">
            <summary>{locale === "zh" ? "数据与版本信息" : "Data and release information"}</summary>
            <PublicDeliveryNotice
              locale={locale}
              release={release}
              delivery={delivery}
              coverage={coverage}
              localeDelivery={localeDelivery}
            />
          </details>
          <div className="pa-home-method-list">
            {view.method.items.map((item, index) => (
              <article key={item.title}>
                <span aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
                <div>
                  <h3>{item.title}</h3>
                  <p>{item.body}</p>
                </div>
              </article>
            ))}
          </div>
        </section>
      </main>
    </>
  );
}

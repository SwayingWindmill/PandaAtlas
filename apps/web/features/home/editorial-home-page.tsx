import type { Route } from "next";
import Link from "next/link";
import {
  ArrowRight,
  BookOpenCheck,
  Building2,
  CheckCircle2,
  MapPinned,
  Network,
  Search,
  ShieldCheck,
} from "lucide-react";
import { GlobalNavigation, publicShellClassName } from "@/components/patterns/global-navigation";
import { PublicDeliveryNotice } from "@/components/patterns/public-delivery-notice";
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
            <p className="pa-eyebrow"><ShieldCheck aria-hidden="true" />{view.hero.eyebrow}</p>
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
            <Link href={route(view.hero.atlasHref)} className="pa-text-link">
              {view.hero.atlasLabel}<ArrowRight aria-hidden="true" />
            </Link>
          </div>

          <aside className="pa-home-release-panel" aria-label={view.hero.noMediaLabel}>
            <div className="pa-home-release-mark" aria-hidden="true">
              <BookOpenCheck />
              <span>PANDA<br />ATLAS</span>
            </div>
            <div>
              <strong>{view.hero.noMediaTitle}</strong>
              <p>{view.hero.noMediaBody}</p>
            </div>
            <p className="pa-home-release-id">{view.hero.releaseLabel}</p>
          </aside>
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
          <p className="pa-home-disclosure"><CheckCircle2 aria-hidden="true" />{view.profiles.selectionDisclosure}</p>

          <div className="pa-home-profile-stage">
            {view.profiles.items.map((profile, index) => (
              <article key={profile.id} className="pa-home-profile" data-featured={index === 0 ? "primary" : "supporting"}>
                <div className="pa-home-profile-identity" aria-hidden="true">
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <strong>{profile.name.slice(0, 1)}</strong>
                </div>
                <div className="pa-home-profile-copy">
                  <p className="pa-home-profile-state">{profile.recordState} · {profile.mediaState}</p>
                  <h3><Link href={route(profile.href)}>{profile.name}</Link></h3>
                  {profile.alternateName ? <p className="pa-home-profile-alternate">{profile.alternateName}</p> : null}
                  <p>{profile.summary}</p>
                  <p className="pa-home-profile-reason">{profile.selectionReason}</p>
                  <div className="pa-home-profile-footer">
                    <span>{profile.currentPlace}</span>
                    <Link href={route(profile.href)} aria-label={`${view.hero.atlasLabel}: ${profile.name}`}>
                      <ArrowRight aria-hidden="true" />
                    </Link>
                  </div>
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
                      <span>{revision.releaseLabel}</span>
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
          <PublicDeliveryNotice
            locale={locale}
            release={release}
            delivery={delivery}
            coverage={coverage}
            localeDelivery={localeDelivery}
          />
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

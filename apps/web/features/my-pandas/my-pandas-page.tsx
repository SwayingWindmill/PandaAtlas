import type { Route } from "next";
import Link from "next/link";
import { ArrowRight, Database, ShieldCheck } from "lucide-react";
import { GlobalNavigation, publicShellClassName } from "@/components/patterns/global-navigation";
import { PublicDeliveryNotice } from "@/components/patterns/public-delivery-notice";
import { MyPandasIsland } from "@/features/my-pandas/my-pandas-island";
import type { MyPandasViewModel } from "@/features/my-pandas/my-pandas-view-model";
import type {
  PublicAtlasDataset,
  PublicContentEnvelope,
} from "@/features/public-content/public-release";
import type { PublicLocale } from "@/foundation/content/locales";

interface MyPandasPageProps {
  locale: PublicLocale;
  view: MyPandasViewModel;
  envelope: PublicContentEnvelope<PublicAtlasDataset>;
}

export function MyPandasPage({ locale, view, envelope }: MyPandasPageProps) {
  const { copy } = view;
  const alternateLocale = locale === "zh" ? "en" : "zh";

  return (
    <>
      <GlobalNavigation
        locale={locale}
        active="my-pandas"
        alternatePath={`/${alternateLocale}/my-pandas`}
      />
      <main id="main-content" className="my-pandas-page" data-testid="my-pandas-page">
        <section className={`${publicShellClassName} my-pandas-delivery`}>
          <PublicDeliveryNotice
            locale={locale}
            release={envelope.release}
            delivery={envelope.delivery}
            coverage={envelope.coverage}
            localeDelivery={envelope.locale}
          />
        </section>

        <section className="my-pandas-hero">
          <div className={`${publicShellClassName} my-pandas-hero-grid`}>
            <div>
              <p className="my-pandas-eyebrow">{copy.eyebrow}</p>
              <h1>{copy.title}</h1>
              <p className="my-pandas-hero-description">{copy.description}</p>
              <Link href={`/${locale}/atlas` as Route} className="my-pandas-hero-link">
                {copy.browseAtlas}
                <ArrowRight aria-hidden="true" />
              </Link>
            </div>
            <aside className="my-pandas-release-card" aria-label={copy.releaseLabel}>
              <Database aria-hidden="true" />
              <div>
                <strong>{copy.releaseLabel}</strong>
                <span>{envelope.release.id}</span>
                <small>Schema {envelope.release.schemaVersion}</small>
              </div>
            </aside>
          </div>
        </section>

        <section className={`${publicShellClassName} my-pandas-privacy`} aria-labelledby="my-pandas-privacy-title">
          <div className="my-pandas-privacy-heading">
            <ShieldCheck aria-hidden="true" />
            <div>
              <p className="my-pandas-eyebrow">{locale === "zh" ? "本地数据说明" : "Local data disclosure"}</p>
              <h2 id="my-pandas-privacy-title">{copy.localOnlyTitle}</h2>
            </div>
          </div>
          <p>{copy.localOnlyBody}</p>
          <ul>
            {copy.privacyPoints.map((point) => <li key={point}>{point}</li>)}
          </ul>
        </section>

        <div className={publicShellClassName}>
          <noscript>
            <section className="my-pandas-noscript" aria-labelledby="my-pandas-noscript-title">
              <h2 id="my-pandas-noscript-title">{copy.noJsTitle}</h2>
              <p>{copy.noJsBody}</p>
              <Link href={`/${locale}/atlas` as Route}>{copy.browseAtlas}<ArrowRight aria-hidden="true" /></Link>
            </section>
          </noscript>
          <MyPandasIsland locale={locale} profiles={view.profiles} copy={copy} />
        </div>
      </main>
    </>
  );
}

import type { Route } from "next";
import Link from "next/link";

import { publicShellClassName } from "@/components/patterns/public-shell";
import type { PublicLocale } from "@/foundation/content/locales";

import type { LegalDocument } from "./documents";

export function LegalDocumentPage({ locale, document }: { locale: PublicLocale; document: LegalDocument }) {
  return (
    <main id="main-content" className="text-[var(--pa-color-ink)]">
      <article className={`${publicShellClassName} py-10 sm:py-14`}>
        <div className="grid max-w-[42rem] gap-10">
          <header className="grid gap-5">
            <h1>{document.title}</h1>
            <p className="text-xs text-[var(--pa-color-ink-muted)]">{document.effective}</p>
            <aside
              aria-label={locale === "zh" ? "草稿说明" : "Draft notice"}
              className="grid gap-2 rounded-[var(--pa-radius-lg)] bg-[var(--amber-3)] p-4 text-[var(--amber-12)]"
              data-testid="legal-draft-banner"
            >
              <p className="font-bold">{document.bannerTitle}</p>
              <p>{document.bannerBody}</p>
            </aside>
          </header>
          {document.sections.map((section) => (
            <section key={section.id} aria-labelledby={section.id} className="grid gap-3">
              <h2 id={section.id}>{section.heading}</h2>
              {section.paragraphs.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
              {section.pending?.map((paragraph) => (
                <p key={paragraph} className="rounded-[var(--pa-radius-lg)] bg-[var(--amber-3)] p-4 text-[var(--amber-12)]">
                  {paragraph}
                </p>
              ))}
            </section>
          ))}
          <p>
            <Link
              href={`/${locale}${document.relatedPath}` as Route}
              className="font-bold hover:underline hover:underline-offset-[3px]"
            >
              {document.relatedLabel}
            </Link>
          </p>
        </div>
      </article>
    </main>
  );
}

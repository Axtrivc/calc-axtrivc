import Link from 'next/link';
import type { ReactNode } from 'react';
import { ChevronRight, Clock } from 'lucide-react';
import { calculators, siteConfig, type Calculator } from '@/lib/site';
import type { Guide } from '@/lib/guides';

/**
 * Shared shell for every /guides/<slug>/ page — the guides counterpart of
 * CalculatorPageShell. Renders the breadcrumb, the title and reading time,
 * the prose column the guide body renders into, and the closing
 * "Instruments used in this guide" panel resolved from the registry.
 *
 * Server-component safe: no hooks, no event handlers, no browser APIs —
 * a guide page is a static export that composes GuideShell with its article.
 *
 * Guide body contract: children render inside the shared `.prose-article`
 * column, so writers use bare h2/h3/p/ul/table markup (see the content
 * components in components/content/) and may open with ArticleToc from
 * components/Article.tsx — the shell already provides h1, so bodies start
 * at h2.
 */
export default function GuideShell({ guide, children }: { guide: Guide; children: ReactNode }) {
  // Resolve the registry's related slugs against the calculator catalog.
  // The registry check guarantees these exist; the filter only keeps the
  // type honest if a slug ever drifts.
  const instruments = guide.related
    .map((slug) => calculators.find((c) => c.slug === slug))
    .filter((c): c is Calculator => Boolean(c));

  // Breadcrumb structured data — mirrors the visible nav below.
  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: 'Guides',
        item: `${siteConfig.url}/guides/`,
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: guide.title,
        item: `${siteConfig.url}${guide.href}`,
      },
    ],
  };

  return (
    <div className="container-page pb-16 pt-8 sm:pt-10">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />

      <nav
        className="mb-5 flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400"
        aria-label="Breadcrumb"
      >
        <Link
          href="/guides/"
          className="focus-calm rounded-sm transition hover:text-indigo-600 dark:hover:text-indigo-300"
        >
          Guides
        </Link>
        <ChevronRight className="h-4 w-4 shrink-0" aria-hidden="true" />
        <span className="truncate text-slate-700 dark:text-slate-200">{guide.title}</span>
      </nav>

      {/* Guide header — title and reading time only; the description lives on
          the index card and in metadata, not repeated above the fold. */}
      <header className="animate-fade-in-up border-b border-slate-200 pb-8 dark:border-white/[0.07]">
        <h1 className="max-w-3xl text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl dark:text-white">
          {guide.title}
        </h1>
        <p className="mt-3 flex items-center gap-1.5 text-sm font-medium text-slate-500 dark:text-slate-400">
          <Clock className="h-4 w-4" aria-hidden="true" />
          <span>{guide.minutes} min read</span>
        </p>
      </header>

      {/* Body — one shared prose column per guide. Writers emit bare
          semantic markup; .prose-article (globals.css) supplies the type
          scale, spacing, and link treatment used across the site's long-form. */}
      <div className="prose-article pt-2">
        <article>{children}</article>

        {/* Closing hand-off: the instruments this guide leaned on, resolved
            from the registry. Visual language mirrors RelatedCalculators
            (components/Article.tsx) so guide pages and tool pages present
            calculator links identically. */}
        {instruments.length > 0 && (
          <section
            aria-label="Instruments used in this guide"
            className="mt-10 rounded-2xl border border-indigo-100 bg-indigo-50 p-6 dark:border-indigo-500/20 dark:bg-indigo-500/10"
          >
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
              Instruments used in this guide
            </h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {instruments.map((c) => (
                <Link
                  key={c.href}
                  href={c.href}
                  className="focus-calm inline-flex items-center gap-1.5 rounded-lg bg-white dark:bg-white/[0.05] px-3.5 py-2 text-sm font-semibold text-indigo-700 dark:text-indigo-300 ring-1 ring-inset ring-indigo-200 dark:ring-indigo-500/40 transition hover:bg-indigo-600 hover:text-white"
                >
                  {c.shortTitle ?? c.title}
                  <ChevronRight className="h-4 w-4" aria-hidden="true" />
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

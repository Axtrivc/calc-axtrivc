import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, BookOpen, Clock } from 'lucide-react';
import { guides } from '@/lib/guides';
import { calculators, siteConfig, type Calculator } from '@/lib/site';

const DESCRIPTION = `${guides.length} decision playbooks that turn CalcSuite's ${calculators.length} calculators into complete paths — price your work, bill and protect margin, structure the entity, pay yourself, and sustain the business.`;

export const metadata: Metadata = {
  title: 'Guides — Decision Playbooks for Business Finance',
  description: DESCRIPTION,
  keywords: [
    'business finance guides',
    'freelance pricing guide',
    'self employed tax guide',
    's corp decision guide',
    'startup equity guide',
    'runway management',
  ],
  alternates: { canonical: '/guides/' },
  openGraph: {
    title: 'Guides — Decision Playbooks for Business Finance',
    description: DESCRIPTION,
    url: `${siteConfig.url}/guides/`,
    type: 'website',
  },
};

/**
 * The /guides index. Guides are the connective tissue of the suite: each
 * playbook walks one decision across several instruments, so the index
 * card surfaces reading time and the instruments a guide ties together.
 */
export default function GuidesIndexPage() {
  // CollectionPage structured data — the index as an ItemList of its guides.
  const collectionJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'CalcSuite Guides',
    description: DESCRIPTION,
    url: `${siteConfig.url}/guides/`,
    isPartOf: { '@type': 'WebSite', name: siteConfig.name, url: siteConfig.url },
    mainEntity: {
      '@type': 'ItemList',
      itemListElement: guides.map((g, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        name: g.title,
        url: `${siteConfig.url}${g.href}`,
      })),
    },
  };

  return (
    <div className="container-page pb-16 pt-8 sm:pt-10">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(collectionJsonLd) }}
      />

      {/* ===== Index header ===== */}
      <header className="animate-fade-in-up max-w-3xl">
        <span className="chip bg-indigo-50 text-indigo-700 ring-1 ring-inset ring-indigo-200 dark:bg-indigo-500/15 dark:text-indigo-300 dark:ring-indigo-500/25">
          <BookOpen className="h-3.5 w-3.5" aria-hidden="true" />
          Knowledge base
        </span>
        <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl dark:text-white">
          Guides
        </h1>
        <p className="mt-4 text-base leading-relaxed text-slate-500 sm:text-lg dark:text-slate-400">
          The {calculators.length} instruments each answer one question precisely; a guide answers
          the decision those questions serve. Every playbook below walks one move — pricing your
          work, choosing an entity, defending margin, managing runway — end to end, then hands you
          to the calculators that run the numbers on your own figures. Read the guide, then make
          the call.
        </p>
      </header>

      {/* ===== Guide cards ===== */}
      <div className="mt-10 grid gap-6 sm:grid-cols-2">
        {guides.map((g) => {
          const instruments = g.related
            .map((slug) => calculators.find((c) => c.slug === slug))
            .filter((c): c is Calculator => Boolean(c));
          return (
            <article key={g.slug} className="card group relative flex h-full flex-col p-6">
              <div className="flex items-start justify-between gap-3">
                <h2 className="text-lg font-bold tracking-tight text-slate-900 dark:text-white">
                  <Link
                    href={g.href}
                    className="focus-calm rounded-md transition hover:text-indigo-600 dark:hover:text-indigo-300 after:absolute after:inset-0"
                  >
                    {g.title}
                  </Link>
                </h2>
                <span className="chip shrink-0 bg-slate-100 text-slate-600 dark:bg-white/[0.05] dark:text-slate-300">
                  <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                  {g.minutes} min
                </span>
              </div>

              <p className="mt-2 flex-1 text-sm leading-relaxed text-slate-500 dark:text-slate-400">
                {g.description}
              </p>

              <div className="relative mt-4 flex flex-wrap gap-1.5">
                {instruments.map((c) => (
                  <span
                    key={c.slug}
                    className="rounded-full border border-slate-200/60 bg-white/70 px-2.5 py-0.5 text-[11px] font-medium text-slate-600 backdrop-blur dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-slate-400"
                  >
                    {c.shortTitle ?? c.title}
                  </span>
                ))}
              </div>

              <div className="relative mt-5 flex items-center border-t border-slate-100 pt-4 dark:border-white/[0.07]">
                <Link
                  href={g.href}
                  className="focus-calm inline-flex items-center gap-1.5 rounded-md text-sm font-semibold text-indigo-600 transition hover:gap-2 dark:text-indigo-300"
                  aria-label={`Read ${g.title}`}
                >
                  Read guide
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
              </div>
            </article>
          );
        })}
      </div>

      {/* ===== Tie-back to the instruments ===== */}
      <p className="mt-12 text-center text-sm text-slate-500 dark:text-slate-400">
        Already know your decision?{' '}
        <Link
          href="/"
          className="focus-calm rounded-md font-semibold text-indigo-600 underline decoration-indigo-300 underline-offset-2 transition hover:text-indigo-700 dark:text-indigo-400 dark:decoration-indigo-500/40 dark:hover:text-indigo-300"
        >
          Browse all {calculators.length} calculators
        </Link>
      </p>
    </div>
  );
}

import Link from 'next/link';
import { ChevronRight, BookOpen } from 'lucide-react';

/**
 * Renders a Table of Contents sidebar/inline for the SEO article,
 * linking to #ids within the same page.
 */
export function ArticleToc({ items }: { items: { id: string; label: string }[] }) {
  if (!items.length) return null;
  return (
    <nav
      aria-label="On this page"
      className="mb-8 rounded-xl border border-slate-200 dark:border-white/[0.08] bg-slate-50/60 p-5 sm:p-6 dark:bg-white/[0.03]"
    >
      <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
        <BookOpen className="h-3.5 w-3.5" aria-hidden="true" />
        In this guide
      </h2>
      <ol className="mt-3 grid gap-1 sm:grid-cols-2">
        {items.map((it) => (
          <li key={it.id}>
            <a
              href={`#${it.id}`}
              className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm font-medium text-slate-700 dark:text-slate-200 transition hover:bg-white hover:text-indigo-600 dark:hover:bg-white/[0.06] dark:hover:text-indigo-300"
            >
              <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
              {it.label}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}

/** A compact CTA at the bottom of an article linking to related calculators. */
export function RelatedCalculators({ links }: { links: { href: string; label: string }[] }) {
  if (!links.length) return null;
  return (
    <div className="mt-10 rounded-2xl border border-indigo-100 bg-indigo-50 dark:bg-indigo-500/15/60 p-6 dark:bg-indigo-500/10">
      <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Related calculators</h2>
      <div className="mt-3 flex flex-wrap gap-2">
        {links.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className="inline-flex items-center gap-1.5 rounded-lg bg-white dark:bg-white/[0.05] px-3.5 py-2 text-sm font-semibold text-indigo-700 dark:text-indigo-300 ring-1 ring-inset ring-indigo-200 transition hover:bg-indigo-600 hover:text-white"
          >
            {l.label}
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        ))}
      </div>
    </div>
  );
}

import Link from 'next/link';
import { ChevronRight, BookOpen } from 'lucide-react';

/**
 * Renders a Table of Contents sidebar/inline for the SEO article,
 * linking to #ids within the same page. Styled as a HUD "Knowledge Base" panel.
 */
export function ArticleToc({ items }: { items: { id: string; label: string }[] }) {
  if (!items.length) return null;
  return (
    <nav
      aria-label="On this page"
      className="mb-8 rounded-2xl border border-slate-800 bg-base-700/50 p-5 backdrop-blur sm:p-6"
    >
      <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-cyan-400">
        <BookOpen className="h-3.5 w-3.5" aria-hidden="true" />
        In this guide
      </h2>
      <ol className="mt-3 grid gap-1 sm:grid-cols-2">
        {items.map((it) => (
          <li key={it.id}>
            <a
              href={`#${it.id}`}
              className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm font-medium text-slate-300 transition hover:bg-base-800/60 hover:text-cyan-300"
            >
              <ChevronRight className="h-4 w-4 shrink-0 text-cyan-500/60" aria-hidden="true" />
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
    <div className="mt-10 rounded-2xl border border-cyan-500/30 bg-cyan-500/5 p-6 backdrop-blur">
      <h2 className="text-lg font-bold text-white">Related calculators</h2>
      <div className="mt-3 flex flex-wrap gap-2">
        {links.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-base-700/60 px-3.5 py-2 text-sm font-semibold text-cyan-300 backdrop-blur transition hover:border-cyan-500/60 hover:bg-cyan-500/10 hover:text-cyan-200"
          >
            {l.label}
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        ))}
      </div>
    </div>
  );
}

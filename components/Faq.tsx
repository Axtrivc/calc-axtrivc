import type { ReactNode } from 'react';

export type FaqItem = { question: string; answer: ReactNode };

/**
 * Renders an accessible FAQ section (semantic <details>) and injects a
 * Schema.org FAQPage JSON-LD script for Google rich results.
 *
 * Because Next.js App Router supports embedding <script> with
 * dangerouslySetInnerHTML from a Server Component, this works in SSG.
 */
export default function Faq({ items, id = 'faq' }: { items: FaqItem[]; id?: string }) {
  // Plain-text version of each answer for the JSON-LD payload.
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((it) => ({
      '@type': 'Question',
      name: it.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: toText(it.answer),
      },
    })),
  };

  return (
    <section id={id} className="scroll-mt-24">
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <h2 className="mt-12 mb-4 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl dark:text-white">
        Frequently asked questions
      </h2>
      <div className="divide-y divide-slate-200 overflow-hidden rounded-2xl border border-slate-200 bg-white dark:divide-white/[0.07] dark:border-white/[0.08] dark:bg-slate-900/60">
        {items.map((it, i) => (
          <details key={i} className="group p-5 sm:p-6">
            <summary className="flex cursor-pointer list-none items-start justify-between gap-4 text-base font-semibold text-slate-900 marker:hidden dark:text-slate-100">
              <span>{it.question}</span>
              <span className="mt-0.5 shrink-0 text-slate-400 transition group-open:rotate-45 dark:text-slate-500" aria-hidden="true">
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M10 4v12M4 10h12" strokeLinecap="round" />
                </svg>
              </span>
            </summary>
            <div className="mt-3 leading-relaxed text-slate-600 [&_a]:font-medium [&_a]:text-indigo-600 [&_a]:underline [&_p]:mb-3 [&_p]:leading-relaxed dark:text-slate-300 dark:[&_a]:text-indigo-400">
              {it.answer}
            </div>
          </details>
        ))}
      </div>
    </section>
  );
}

function toText(node: ReactNode): string {
  if (node == null || node === false) return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(toText).join('');
  if (typeof node === 'object' && 'props' in node) {
    const props = (node as { props?: { children?: ReactNode } }).props;
    return toText(props?.children);
  }
  return '';
}

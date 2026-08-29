import Link from 'next/link';
import type { ReactNode } from 'react';
import {
  ArrowRight,
  Check,
  FlaskConical,
  ListChecks,
  ShieldCheck,
} from 'lucide-react';
import { calculators, siteConfig, type Calculator } from '@/lib/site';

type Accent = Calculator['accent'];

/**
 * Professional-grade building blocks shared by every tool page.
 *
 * These are intentionally Server Components (no 'use client'): the analytical
 * layer of a finance tool should be dense, precise, static HTML that renders
 * once at build time — the visual counterpart to the interactive workspaces,
 * not a copy of them. All scenario numbers are computed from the same math
 * libraries the calculators use, so nothing here is a hand-typed fake metric.
 */

const ACCENT_TEXT: Record<Accent, string> = {
  indigo: 'text-indigo-600 dark:text-indigo-300',
  emerald: 'text-emerald-600 dark:text-emerald-300',
  slate: 'text-sky-600 dark:text-sky-300',
  amber: 'text-amber-600 dark:text-amber-300',
};

const ACCENT_SOFT: Record<Accent, string> = {
  indigo: 'bg-indigo-50 text-indigo-700 ring-indigo-200 dark:bg-indigo-500/15 dark:text-indigo-300 dark:ring-indigo-500/25',
  emerald: 'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:ring-emerald-500/25',
  slate: 'bg-sky-50 text-sky-700 ring-sky-200 dark:bg-sky-500/15 dark:text-sky-300 dark:ring-sky-500/25',
  amber: 'bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:ring-amber-500/25',
};

/* ============================== Section frame ============================== */

/** Consistent analytical-section framing: eyebrow, title, intro, anchor target. */
export function SectionShell({
  id,
  eyebrow,
  title,
  intro,
  accent,
  children,
}: {
  id: string;
  eyebrow: string;
  title: string;
  intro?: string;
  accent: Accent;
  children: ReactNode;
}) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="scroll-mt-28">
      <header className="mb-7 max-w-3xl">
        <p
          className={`font-mono mb-3 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.2em] ${ACCENT_TEXT[accent]}`}
        >
          <span className={`inline-block h-3 w-0.5 rounded-full bg-current`} aria-hidden="true" />
          {eyebrow}
        </p>
        <h2 id={`${id}-title`} className="section-title">{title}</h2>
        {intro && <p className="mt-3 leading-relaxed text-slate-600 dark:text-slate-300">{intro}</p>}
      </header>
      {children}
    </section>
  );
}

/* ============================== Methodology ================================ */

export type FormulaItem = {
  label: string;
  /** Core equation — rendered verbatim in a monospace box. */
  expression: string;
  note?: string;
};

/**
 * Side-by-side "how this is computed" block: exact formulas on the left,
 * the model's stated assumptions on the right. Transparency is the product.
 */
export function MethodologyGrid({
  formulas,
  assumptions,
}: {
  formulas: FormulaItem[];
  assumptions: string[];
}) {
  return (
    <div className="grid gap-5 lg:grid-cols-5">
      <div className="grid content-start gap-4 sm:grid-cols-2 lg:col-span-3">
        {formulas.map((f) => (
          <figure key={f.label} className="panel m-0 p-4">
            <figcaption className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              {f.label}
            </figcaption>
            <div className="readout mt-2 overflow-x-auto rounded-lg bg-white px-3 py-2.5 text-sm font-semibold text-slate-900 ring-1 ring-inset ring-slate-200 dark:bg-white/[0.05] dark:text-slate-100 dark:ring-white/10">
              <code>{f.expression}</code>
            </div>
            {f.note && <p className="mt-2 text-xs leading-relaxed text-slate-500 dark:text-slate-400">{f.note}</p>}
          </figure>
        ))}
      </div>

      <aside className="lg:col-span-2">
        <div className="card h-full p-5 sm:p-6">
          <h3 className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-slate-100">
            <ListChecks className="h-4 w-4 text-slate-400" aria-hidden="true" />
            Stated assumptions
          </h3>
          <ul className="mt-4 space-y-3">
            {assumptions.map((a) => (
              <li key={a} className="flex gap-2.5 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                <Check
                  className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500 dark:text-emerald-400"
                  strokeWidth={2.5}
                  aria-hidden="true"
                />
                <span>{a}</span>
              </li>
            ))}
          </ul>
          <p className="mt-4 border-t border-slate-100 pt-3 text-xs leading-relaxed text-slate-400 dark:border-white/[0.07] dark:text-slate-500">
            Every number the tool returns follows from these statements alone — change one, and the
            output changes exactly as written.
          </p>
        </div>
      </aside>
    </div>
  );
}

/* ============================ Scenario analysis ============================ */

/**
 * Frames a build-time-computed reference table. Numbers passed as children are
 * expected to come from the page's own math library at render time.
 */
export function ScenarioPanel({
  title,
  description,
  columns,
  footnote,
  children,
}: {
  title: string;
  description?: string;
  /** Column headers; a trailing empty spacer keeps equal-width alignment clean. */
  columns: string[];
  footnote?: string;
  children: ReactNode;
}) {
  return (
    <div className="card overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 px-5 py-4 sm:px-6 dark:border-white/[0.07]">
        <div className="max-w-xl">
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">{title}</h3>
          {description && (
            <p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">{description}</p>
          )}
        </div>
        <span
          className="chip bg-emerald-50 font-mono text-[10px] uppercase tracking-wider text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"
          title="Generated from this page's own math library at build time — not hand-typed."
        >
          <FlaskConical className="h-3 w-3" aria-hidden="true" />
          Computed · reproducible
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="data-table min-w-full">
          <thead>
            <tr>
              {columns.map((c, i) => (
                <th key={c} scope="col" className={i === 0 ? '' : 'text-right'}>
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          {children}
        </table>
      </div>

      {footnote && (
        <p className="border-t border-slate-100 bg-slate-50/60 px-5 py-3 text-xs leading-relaxed text-slate-500 sm:px-6 dark:border-white/[0.06] dark:bg-white/[0.02] dark:text-slate-400">
          {footnote}
        </p>
      )}
    </div>
  );
}

/* ============================ Suite workflow chain ========================= */

/**
 * The CalcSuite positioning, made visible: four instruments, one business
 * finance workflow. Anchors each tool page to its neighbours instead of
 * dumping visitors back to a generic directory.
 */
export function WorkflowChain({ currentSlug }: { currentSlug: string }) {
  const ordered = [...calculators].sort((a, b) => a.stage - b.stage);

  return (
    <section id="workflow" aria-labelledby="workflow-title" className="scroll-mt-28">
      <header className="mb-7 max-w-3xl">
        <p className="font-mono mb-3 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">
          <span className="inline-block h-3 w-0.5 rounded-full bg-current" aria-hidden="true" />
          The CalcSuite workflow
        </p>
        <h2 id="workflow-title" className="section-title">
          One financial workflow, five instruments
        </h2>
        <p className="mt-3 leading-relaxed text-slate-600 dark:text-slate-300">
          Each tool answers one question in the life of an independent business. When you're done
          here, the next decision has a workspace waiting for it.
        </p>
      </header>

      <ol className="grid gap-3 md:grid-cols-3 lg:grid-cols-5">
        {ordered.map((c) => {
          const isCurrent = c.slug === currentSlug;
          return (
            <li key={c.slug}>
              {isCurrent ? (
                <div
                  aria-current="step"
                  className="relative flex h-full flex-col rounded-2xl border border-indigo-300 bg-white p-4 shadow-md ring-2 ring-indigo-500/20 dark:border-indigo-500/40 dark:bg-slate-900/70 dark:ring-indigo-500/30"
                >
                  <CurrentStepBody calc={c} />
                </div>
              ) : (
                <Link
                  href={c.href}
                  className="group flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-4 transition hover:-translate-y-0.5 hover:border-indigo-200 hover:shadow-md dark:border-white/[0.08] dark:bg-slate-900/60 dark:hover:border-indigo-500/30 dark:hover:shadow-black/40"
                >
                  <OtherStepBody calc={c} />
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function StageNumber({ n }: { n: Calculator['stage'] }) {
  return (
    <span className="readout text-[11px] font-bold tracking-widest text-slate-300 dark:text-slate-600">
      STAGE {String(n).padStart(2, '0')}
    </span>
  );
}

function CurrentStepBody({ calc }: { calc: Calculator }) {
  return (
    <>
      <div className="flex items-center justify-between">
        <StageNumber n={calc.stage} />
        <span className="chip bg-indigo-600 text-[10px] font-semibold uppercase tracking-wider text-white">
          You are here
        </span>
      </div>
      <h3 className="mt-2 text-sm font-bold text-slate-900 dark:text-slate-100">{calc.shortTitle ?? calc.title}</h3>
      <p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">{calc.tagline}</p>
      <p className="mt-auto pt-3 font-mono text-[11px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-300">
        {calc.stageLabel}
      </p>
    </>
  );
}

function OtherStepBody({ calc }: { calc: Calculator }) {
  return (
    <>
      <StageNumber n={calc.stage} />
      <h3 className="mt-2 text-sm font-bold text-slate-700 transition group-hover:text-indigo-700 dark:text-slate-300 dark:group-hover:text-indigo-300">
        {calc.shortTitle ?? calc.title}
      </h3>
      <p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">{calc.tagline}</p>
      <span className="mt-auto flex items-center gap-1 pt-3 text-xs font-semibold text-slate-400 transition group-hover:text-indigo-600 dark:text-slate-500 dark:group-hover:text-indigo-300">
        Open instrument
        <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" aria-hidden="true" />
      </span>
    </>
  );
}

/* ============================== Provenance ================================= */

export type SourceItem = { label: string; detail: string };

/**
 * Sources & methodology footer. A finance tool's credibility is a design
 * element: state what the outputs rest on, and state the limits.
 */
export function ProvenanceFooter({
  sources,
  disclaimer,
}: {
  sources: SourceItem[];
  disclaimer?: string;
}) {
  return (
    <section aria-label="Sources and methodology notes">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 dark:border-white/[0.08] dark:bg-slate-900/60">
        <h2 className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-slate-100">
          <ShieldCheck className="h-4 w-4 text-emerald-500 dark:text-emerald-400" aria-hidden="true" />
          Sources &amp; methodology
        </h2>
        <dl className="mt-4 grid gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
          {sources.map((s) => (
            <div key={s.label}>
              <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                {s.label}
              </dt>
              <dd className="mt-1 text-sm leading-relaxed text-slate-600 dark:text-slate-300">{s.detail}</dd>
            </div>
          ))}
        </dl>
        {disclaimer && (
          <p className="mt-5 rounded-lg bg-slate-50 px-4 py-3 text-xs leading-relaxed text-slate-500 dark:bg-white/[0.03] dark:text-slate-400">
            {disclaimer}
          </p>
        )}
      </div>
    </section>
  );
}

/* ============================== Structured data ============================ */

/** WebApplication JSON-LD so search engines index these as finance applications. */
export function AppJsonLd({ calc }: { calc: Calculator }) {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: calc.title,
    url: `${siteConfig.url}${calc.href}`,
    description: calc.description,
    applicationCategory: 'FinanceApplication',
    operatingSystem: 'Web (any modern browser)',
    featureList: [calc.category, ...calc.tags.slice(0, 4)],
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'USD',
    },
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}

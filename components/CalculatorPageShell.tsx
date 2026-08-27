import Link from 'next/link';
import type { ReactNode } from 'react';
import { ChevronRight, FunctionSquare, Laptop, ShieldCheck } from 'lucide-react';
import {
  CreditCard,
  Clock,
  TrendingUp,
  Building2,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { Calculator } from '@/lib/site';

const iconMap: Record<string, LucideIcon> = {
  CreditCard,
  Clock,
  TrendingUp,
  Building2,
};

const accentMap: Record<Calculator['accent'], { bg: string; text: string; soft: string }> = {
  indigo: { bg: 'bg-indigo-600', text: 'text-indigo-600', soft: 'bg-indigo-50 text-indigo-700' },
  emerald: { bg: 'bg-emerald-600', text: 'text-emerald-600', soft: 'bg-emerald-50 text-emerald-700' },
  slate: { bg: 'bg-sky-600', text: 'text-sky-600', soft: 'bg-sky-50 text-sky-700' },
  amber: { bg: 'bg-amber-600', text: 'text-amber-600', soft: 'bg-amber-50 text-amber-700' },
};

/**
 * Shared section anchors rendered by every tool page, wired into the sticky
 * sub-navigation so a tool page reads like an analysis document with chapters
 * rather than a blog post with a widget bolted on top.
 */
const PAGE_ANCHORS = [
  { href: '#calculator', label: 'Calculator' },
  { href: '#methodology', label: 'How it works' },
  { href: '#scenarios', label: 'Scenario analysis' },
  { href: '#guide', label: 'In-depth guide' },
  { href: '#faq', label: 'FAQ' },
];

/**
 * Tool-page shell — the professional layer of CalcSuite.
 *
 * Where the homepage is ambient and exploratory, a tool page asserts trust up
 * front: what the model computes, what data it rests on, and where your input
 * goes (nowhere). The hero carries a formula snapshot and data-basis strip;
 * the sticky chapter bar keeps the analytical sections navigable on long pages.
 */
export default function CalculatorPageShell({
  calc,
  children,
}: {
  calc: Calculator;
  children: ReactNode;
}) {
  const Icon = iconMap[calc.icon] ?? CreditCard;
  const a = accentMap[calc.accent];

  return (
    <div className="container-page pb-16 pt-8 sm:pt-10">
      <nav className="mb-5 flex items-center gap-1.5 text-sm text-slate-500" aria-label="Breadcrumb">
        <Link href="/" className="transition hover:text-indigo-600">Home</Link>
        <ChevronRight className="h-4 w-4" aria-hidden="true" />
        <span className="text-slate-700">{calc.title}</span>
      </nav>

      {/* ===== Professional header band ===== */}
      <header className="animate-fade-in-up relative overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-sm">
        {/* Blueprint grid fades out toward the bottom-left; a restrained accent pool sits top-right. */}
        <div
          aria-hidden="true"
          className="pro-grid pointer-events-none absolute inset-x-0 top-0 h-full"
          style={{
            WebkitMaskImage:
              'radial-gradient(130% 110% at 88% 0%, rgba(0,0,0,0.9) 0%, transparent 62%)',
            maskImage: 'radial-gradient(130% 110% at 88% 0%, rgba(0,0,0,0.9) 0%, transparent 62%)',
          }}
        />
        <div
          aria-hidden="true"
          className={`pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full blur-[90px] ${
            calc.accent === 'indigo'
              ? 'bg-indigo-200/40'
              : calc.accent === 'emerald'
                ? 'bg-emerald-200/40'
                : calc.accent === 'amber'
                  ? 'bg-amber-200/40'
                  : 'bg-sky-200/40'
          }`}
        />

        <div className="relative p-6 sm:p-8 lg:p-10">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${a.bg} text-white shadow-sm`}>
              <Icon className="h-6 w-6" aria-hidden="true" />
            </span>
            <span className={`chip ${a.soft}`}>{calc.category}</span>
            <span className="chip font-mono uppercase tracking-wider ring-1 ring-inset ring-slate-200">
              Stage {calc.stage} of 4 · {calc.stageLabel}
            </span>
          </div>

          <h1 className="mt-5 max-w-3xl text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
            {calc.title}
          </h1>
          <p className="mt-3 max-w-2xl text-base leading-relaxed text-slate-500 sm:text-lg">
            {calc.tagline}
          </p>

          {/* Fact strip: method / provenance / privacy — the three questions a
              finance professional asks before trusting any number. */}
          <dl className="mt-8 grid gap-x-6 gap-y-4 border-t border-slate-100 pt-6 sm:grid-cols-3">
            <div className="flex items-start gap-3">
              <FunctionSquare className={`mt-0.5 h-4 w-4 shrink-0 ${a.text}`} aria-hidden="true" />
              <div>
                <dt className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  Core formula
                </dt>
                <dd className="readout mt-1 text-sm font-semibold text-slate-800">
                  {calc.formulaSnapshot}
                </dd>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" aria-hidden="true" />
              <div>
                <dt className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  Data basis
                </dt>
                <dd className="mt-1 text-sm leading-snug text-slate-600">{calc.dataBasis}</dd>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Laptop className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
              <div>
                <dt className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  Privacy &amp; availability
                </dt>
                <dd className="mt-1 text-sm leading-snug text-slate-600">
                  All math runs locally in your browser — inputs never leave this page, no sign-up.
                </dd>
              </div>
            </div>
          </dl>
        </div>
      </header>

      {/* ===== Sticky chapter bar ===== */}
      <div className="sticky top-16 z-30 mx-0 mt-6">
        <nav
          aria-label="On this tool page"
          className="-mx-4 flex gap-1 overflow-x-auto border-b border-slate-200 bg-slate-100/80 px-4 backdrop-blur-md supports-[backdrop-filter]:bg-slate-100/70 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8"
        >
          {PAGE_ANCHORS.map((anchor) => (
            <a
              key={anchor.href}
              href={anchor.href}
              className="whitespace-nowrap border-b-2 border-transparent px-3 py-3 text-sm font-medium text-slate-500 transition hover:border-indigo-400 hover:text-indigo-600"
            >
              {anchor.label}
            </a>
          ))}
        </nav>
      </div>

      <div className="space-y-14 pt-10">{children}</div>
    </div>
  );
}

'use client';

import Link from 'next/link';
import { useMemo, useState, type ReactNode } from 'react';
import {
  CreditCard,
  Clock,
  TrendingUp,
  Building2,
  Search,
  ArrowRight,
  ShieldCheck,
  Zap,
  Command,
  type LucideIcon,
} from 'lucide-react';
import { calculators, type Calculator } from '@/lib/site';
import {
  StripeMiniWidget,
  FreelanceMiniWidget,
  RunwayMiniWidget,
  TaxMiniWidget,
} from '@/components/HomeWidgets';

const iconMap: Record<string, LucideIcon> = {
  CreditCard,
  Clock,
  TrendingUp,
  Building2,
};

// Clean workspace accent map: indigo / emerald / sky / amber.
const accentMap: Record<
  string,
  { ring: string; bg: string; chip: string; text: string }
> = {
  indigo: {
    ring: 'hover:ring-indigo-200',
    bg: 'bg-indigo-600',
    chip: 'bg-indigo-50 text-indigo-700',
    text: 'text-indigo-600',
  },
  emerald: {
    ring: 'hover:ring-emerald-200',
    bg: 'bg-emerald-600',
    chip: 'bg-emerald-50 text-emerald-700',
    text: 'text-emerald-600',
  },
  slate: {
    ring: 'hover:ring-sky-200',
    bg: 'bg-sky-600',
    chip: 'bg-sky-50 text-sky-700',
    text: 'text-sky-600',
  },
  amber: {
    ring: 'hover:ring-amber-200',
    bg: 'bg-amber-600',
    chip: 'bg-amber-50 text-amber-700',
    text: 'text-amber-600',
  },
};

const categories = ['All', 'Payments', 'Freelancing', 'Startups', 'Taxes'];

// Map calculator slug -> live mini widget
const widgetMap: Record<string, ReactNode> = {
  'stripe-fee-calculator': <StripeMiniWidget />,
  'freelance-hourly-rate-calculator': <FreelanceMiniWidget />,
  'saas-runway-calculator': <RunwayMiniWidget />,
  'llc-vs-ccorp-tax-calculator': <TaxMiniWidget />,
};

export default function HomePageClient() {
  const [query, setQuery] = useState('');
  const [activeCat, setActiveCat] = useState('All');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return calculators.filter((c) => {
      const matchCat = activeCat === 'All' || c.category === activeCat;
      if (!matchCat) return false;
      if (!q) return true;
      const haystack = [c.title, c.tagline, c.description, c.category, ...c.tags]
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [query, activeCat]);

  return (
    <>
      {/* ===== Hero / Workspace Header ===== */}
      <section className="border-b border-slate-200/80 bg-gradient-to-b from-white to-slate-50">
        <div className="container-page py-14 sm:py-20">
          <div className="mx-auto max-w-3xl text-center">
            <div className="mb-4 flex items-center justify-center">
              <span className="chip bg-indigo-50 text-indigo-700 ring-1 ring-inset ring-indigo-100">
                <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />
                Live Workspace · Local Compute
              </span>
            </div>
            <h1 className="animate-fade-in-up text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl">
              Personal Finance Suite for{' '}
              <span className="bg-gradient-to-r from-indigo-600 to-sky-500 bg-clip-text text-transparent">
                freelancers, startups & SMBs
              </span>
            </h1>
            <p className="mx-auto mt-5 max-w-2xl animate-fade-in-up text-lg text-slate-500">
              Stop guessing at Stripe fees, freelance rates, runway, and entity taxes. Get precise,
              instant answers — plus in-depth guides for every tool.
            </p>

            {/* Clean command-bar search */}
            <div className="mx-auto mt-8 max-w-xl animate-fade-in-up">
              <div className="group relative">
                <Search className="pointer-events-none absolute inset-y-0 left-0 my-auto h-5 w-5 pl-3.5 text-slate-400" aria-hidden="true" />
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search calculators…"
                  aria-label="Search calculators"
                  className="input-field focus:ring-indigo-500/20 pl-11 pr-20 text-base shadow-sm transition hover:shadow-md"
                />
                <kbd className="pointer-events-none absolute inset-y-0 right-3 my-auto hidden h-6 items-center gap-0.5 rounded-md border border-slate-200 bg-slate-50 px-1.5 font-mono text-[10px] font-medium text-slate-400 sm:flex">
                  <Command className="h-3 w-3" aria-hidden="true" />K
                </kbd>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===== Live Interactive Calculator Grid ===== */}
      <section className="container-page py-12 sm:py-16">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-bold text-slate-900 sm:text-2xl">All calculators</h2>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter by category">
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setActiveCat(cat)}
                className={`rounded-full px-3 py-1.5 text-sm font-medium transition ${
                  activeCat === cat
                    ? 'bg-slate-900 text-white'
                    : 'bg-white text-slate-600 ring-1 ring-inset ring-slate-200 hover:bg-slate-50'
                }`}
                aria-pressed={activeCat === cat}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
            <p className="text-slate-600">
              No calculators match <strong className="text-slate-900">&ldquo;{query}&rdquo;</strong>. Try a different term or category.
            </p>
            <button
              type="button"
              className="btn-ghost mt-4"
              onClick={() => {
                setQuery('');
                setActiveCat('All');
              }}
            >
              Reset filters
            </button>
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2">
            {filtered.map((c, i) => (
              <div key={c.slug} className="animate-fade-in-up" style={{ animationDelay: `${i * 70}ms` }}>
                <CalculatorCard c={c} widget={widgetMap[c.slug]} />
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ===== Benefits ===== */}
      <section className="border-t border-slate-200/80 bg-white">
        <div className="container-page py-14">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-2xl font-bold text-slate-900 sm:text-3xl">Why CalcSuite?</h2>
            <p className="mt-3 text-slate-500">
              Built by people who actually run businesses — not by ad networks. Every tool is free,
              private, and accurate.
            </p>
          </div>
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {benefits.map((b, i) => (
              <div
                key={b.title}
                className="animate-fade-in-up rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
                style={{ animationDelay: `${i * 70}ms` }}
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 ring-1 ring-inset ring-indigo-100">
                  <b.icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <h3 className="mt-4 text-base font-semibold text-slate-900">{b.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-slate-500">{b.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}

function CalculatorCard({ c, widget }: { c: Calculator; widget?: ReactNode }) {
  const Icon = iconMap[c.icon] ?? CreditCard;
  const a = accentMap[c.accent] ?? accentMap.indigo;
  return (
    <Link
      href={c.href}
      className={`group relative flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm ring-1 ring-transparent transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md ${a.ring}`}
    >
      <div className="flex items-start justify-between">
        <span className={`flex h-12 w-12 items-center justify-center rounded-xl ${a.bg} text-white shadow-sm`}>
          <Icon className="h-6 w-6" aria-hidden="true" />
        </span>
        <span className={`chip ${a.chip}`}>{c.category}</span>
      </div>
      <h3 className="mt-5 text-lg font-bold text-slate-900">{c.title}</h3>
      <p className="mt-2 flex-1 text-sm leading-relaxed text-slate-500">{c.tagline}</p>
      <div className="mt-4 flex flex-wrap gap-1.5">
        {c.tags.slice(0, 3).map((t) => (
          <span key={t} className="chip bg-slate-100 text-slate-600">
            {t}
          </span>
        ))}
      </div>

      {/* Live mini widget */}
      {widget && <div onClick={(e) => e.preventDefault()}>{widget}</div>}

      <div className={`mt-5 inline-flex items-center gap-1.5 text-sm font-semibold ${a.text}`}>
        Open calculator
        <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" aria-hidden="true" />
      </div>
    </Link>
  );
}

const benefits = [
  {
    title: 'Accurate to the cent',
    body: 'Formulas use current US rates (2024–2025) and are documented in each guide so you can verify every number.',
    icon: TrendingUp,
  },
  {
    title: '100% private',
    body: 'All calculations run in your browser. Nothing is sent to a server, stored, or tracked.',
    icon: ShieldCheck,
  },
  {
    title: 'No sign-up, ever',
    body: 'No accounts, no paywalls, no email gates. Bookmark a calculator and use it anytime.',
    icon: Zap,
  },
  {
    title: 'Built for businesses',
    body: 'Each tool ships with a deep-dive guide — strategies, examples, and FAQs — written for real operators.',
    icon: Building2,
  },
];

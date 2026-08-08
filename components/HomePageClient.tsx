'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import {
  CreditCard,
  Clock,
  TrendingUp,
  Building2,
  Search,
  ArrowRight,
  type LucideIcon,
} from 'lucide-react';
import { calculators, type Calculator } from '@/lib/site';

const iconMap: Record<string, LucideIcon> = {
  CreditCard,
  Clock,
  TrendingUp,
  Building2,
};

const accentMap: Record<string, { ring: string; bg: string; text: string; chip: string; bar: string }> = {
  indigo: { ring: 'hover:ring-indigo-300', bg: 'bg-indigo-600', text: 'text-indigo-600', chip: 'bg-indigo-50 text-indigo-700', bar: 'from-indigo-500 to-indigo-600' },
  emerald: { ring: 'hover:ring-emerald-300', bg: 'bg-emerald-600', text: 'text-emerald-600', chip: 'bg-emerald-50 text-emerald-700', bar: 'from-emerald-500 to-emerald-600' },
  slate: { ring: 'hover:ring-slate-300', bg: 'bg-slate-700', text: 'text-slate-700', chip: 'bg-slate-100 text-slate-700', bar: 'from-slate-500 to-slate-700' },
  amber: { ring: 'hover:ring-amber-300', bg: 'bg-amber-600', text: 'text-amber-600', chip: 'bg-amber-50 text-amber-700', bar: 'from-amber-500 to-amber-600' },
};

const categories = ['All', 'Payments', 'Freelancing', 'Startups', 'Taxes'];

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
      {/* Hero / search */}
      <section className="border-b border-slate-200 bg-gradient-to-b from-white to-slate-50">
        <div className="container-page py-14 sm:py-20">
          <div className="mx-auto max-w-3xl text-center">
            <span className="chip mb-4 bg-indigo-50 text-indigo-700 ring-1 ring-inset ring-indigo-100">
              <span className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Free · No sign-up · Accurate to the cent
            </span>
            <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl">
              Financial calculators for{' '}
              <span className="bg-gradient-to-r from-indigo-600 to-emerald-500 bg-clip-text text-transparent">
                freelancers, startups & SMBs
              </span>
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-lg text-slate-600">
              Stop guessing at Stripe fees, freelance rates, runway, and entity taxes. Get precise,
              instant answers — plus in-depth guides for every tool.
            </p>

            <div className="mx-auto mt-8 max-w-xl">
              <div className="relative">
                <Search className="pointer-events-none absolute inset-y-0 left-0 my-auto h-5 w-5 translate-y-0 pl-3.5 text-slate-400" aria-hidden="true" />
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search calculators — e.g. 'stripe', 'runway', 'taxes'…"
                  aria-label="Search calculators"
                  className="input-field pl-11 text-base"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Calculator grid */}
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
                    : 'bg-white text-slate-600 ring-1 ring-inset ring-slate-300 hover:bg-slate-50'
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
            {filtered.map((c) => (
              <CalculatorCard key={c.slug} c={c} />
            ))}
          </div>
        )}
      </section>

      {/* Benefits */}
      <section className="border-t border-slate-200 bg-white">
        <div className="container-page py-14">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-2xl font-bold text-slate-900 sm:text-3xl">Why CalcSuite?</h2>
            <p className="mt-3 text-slate-600">
              Built by people who actually run businesses — not by ad networks. Every tool is free,
              private, and accurate.
            </p>
          </div>
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {benefits.map((b) => (
              <div key={b.title} className="rounded-2xl border border-slate-200 bg-slate-50/60 p-6">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white text-indigo-600 ring-1 ring-inset ring-slate-200">
                  <b.icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <h3 className="mt-4 text-base font-semibold text-slate-900">{b.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{b.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}

function CalculatorCard({ c }: { c: Calculator }) {
  const Icon = iconMap[c.icon] ?? CreditCard;
  const a = accentMap[c.accent] ?? accentMap.indigo;
  return (
    <Link
      href={c.href}
      className={`group relative flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 shadow-sm ring-1 ring-transparent transition hover:-translate-y-0.5 hover:shadow-md ${a.ring}`}
    >
      <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${a.bar}`} />
      <div className="flex items-start justify-between">
        <span className={`flex h-12 w-12 items-center justify-center rounded-xl ${a.bg} text-white shadow-sm`}>
          <Icon className="h-6 w-6" aria-hidden="true" />
        </span>
        <span className={`chip ${a.chip}`}>{c.category}</span>
      </div>
      <h3 className="mt-5 text-lg font-bold text-slate-900">{c.title}</h3>
      <p className="mt-2 flex-1 text-sm leading-relaxed text-slate-600">{c.tagline}</p>
      <div className="mt-4 flex flex-wrap gap-1.5">
        {c.tags.slice(0, 3).map((t) => (
          <span key={t} className="chip bg-slate-100 text-slate-600">
            {t}
          </span>
        ))}
      </div>
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
    icon: CreditCard,
  },
  {
    title: 'No sign-up, ever',
    body: 'No accounts, no paywalls, no email gates. Bookmark a calculator and use it anytime.',
    icon: Clock,
  },
  {
    title: 'Built for businesses',
    body: 'Each tool ships with a deep-dive guide — strategies, examples, and FAQs — written for real operators.',
    icon: Building2,
  },
];

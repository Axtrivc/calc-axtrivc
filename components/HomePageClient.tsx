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
  ShieldCheck,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import { calculators, type Calculator } from '@/lib/site';

const iconMap: Record<string, LucideIcon> = {
  CreditCard,
  Clock,
  TrendingUp,
  Building2,
};

// Cyber accent map per calculator — matches CalculatorPageShell signatures.
const accentMap: Record<
  string,
  { glow: string; grad: string; chip: string; bar: string; text: string }
> = {
  indigo: {
    glow: 'group-hover:shadow-glow-cyan',
    grad: 'from-cyan-500 to-blue-600',
    chip: 'bg-cyan-500/10 text-cyan-300 ring-1 ring-inset ring-cyan-500/30',
    bar: 'from-cyan-500 to-blue-600',
    text: 'text-cyan-400',
  },
  emerald: {
    glow: 'group-hover:shadow-glow-green',
    grad: 'from-emerald-500 to-teal-500',
    chip: 'bg-emerald-500/10 text-emerald-300 ring-1 ring-inset ring-emerald-500/30',
    bar: 'from-emerald-500 to-teal-500',
    text: 'text-emerald-400',
  },
  slate: {
    glow: 'group-hover:shadow-glow-purple',
    grad: 'from-purple-500 to-fuchsia-600',
    chip: 'bg-purple-500/10 text-purple-300 ring-1 ring-inset ring-purple-500/30',
    bar: 'from-purple-500 to-fuchsia-600',
    text: 'text-purple-400',
  },
  amber: {
    glow: '',
    grad: 'from-amber-500 to-orange-600',
    chip: 'bg-amber-500/10 text-amber-300 ring-1 ring-inset ring-amber-500/30',
    bar: 'from-amber-500 to-orange-600',
    text: 'text-amber-400',
  },
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
      <section className="relative overflow-hidden border-b border-slate-800">
        {/* Glow orbs */}
        <div className="pointer-events-none absolute -top-24 left-1/2 h-72 w-[42rem] -translate-x-1/2 rounded-full bg-cyan-500/10 blur-3xl" aria-hidden="true" />
        <div className="pointer-events-none absolute -top-10 right-10 h-48 w-72 rounded-full bg-purple-500/10 blur-3xl" aria-hidden="true" />
        <div className="container-page relative py-14 sm:py-20">
          <div className="mx-auto max-w-3xl text-center">
            <span className="chip mb-4 animate-fade-in bg-cyan-500/10 text-cyan-300 ring-1 ring-inset ring-cyan-500/30">
              <span className="mr-1.5 inline-block h-1.5 w-1.5 animate-pulse-glow rounded-full bg-emerald-400" />
              Free · No sign-up · Accurate to the cent
            </span>
            <h1 className="animate-fade-in-up text-4xl font-extrabold tracking-tight text-white sm:text-5xl">
              Financial calculators for{' '}
              <span className="bg-gradient-to-r from-cyan-400 via-cyan-300 to-emerald-400 bg-clip-text text-transparent">
                freelancers, startups & SMBs
              </span>
            </h1>
            <p className="mx-auto mt-5 max-w-2xl animate-fade-in-up text-lg text-slate-400">
              Stop guessing at Stripe fees, freelance rates, runway, and entity taxes. Get precise,
              instant answers — plus in-depth guides for every tool.
            </p>

            <div className="mx-auto mt-8 max-w-xl animate-fade-in-up">
              <div className="relative">
                <Search
                  className="pointer-events-none absolute inset-y-0 left-0 my-auto h-5 w-5 translate-y-0 pl-3.5 text-slate-500"
                  aria-hidden="true"
                />
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
          <h2 className="text-xl font-bold text-white sm:text-2xl">All calculators</h2>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter by category">
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setActiveCat(cat)}
                className={`rounded-full px-3 py-1.5 text-sm font-medium transition ${
                  activeCat === cat
                    ? 'border border-cyan-500/60 bg-cyan-500/15 text-cyan-300 shadow-glow-cyan'
                    : 'border border-slate-700 bg-base-700/50 text-slate-400 hover:border-cyan-500/40 hover:text-cyan-300'
                }`}
                aria-pressed={activeCat === cat}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-700 bg-base-700/40 p-12 text-center">
            <p className="text-slate-400">
              No calculators match <strong className="text-slate-200">&ldquo;{query}&rdquo;</strong>. Try a different term or category.
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
                <CalculatorCard c={c} />
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Benefits */}
      <section className="border-t border-slate-800 bg-base-900/40">
        <div className="container-page py-14">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-2xl font-bold text-white sm:text-3xl">Why CalcSuite?</h2>
            <p className="mt-3 text-slate-400">
              Built by people who actually run businesses — not by ad networks. Every tool is free,
              private, and accurate.
            </p>
          </div>
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {benefits.map((b, i) => (
              <div
                key={b.title}
                className="animate-fade-in-up rounded-2xl border border-slate-800 bg-base-700/40 p-6 backdrop-blur transition hover:border-cyan-500/40 hover:shadow-glow-cyan"
                style={{ animationDelay: `${i * 70}ms` }}
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-slate-700 bg-base-800/60 text-cyan-400">
                  <b.icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <h3 className="mt-4 text-base font-semibold text-white">{b.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-slate-400">{b.body}</p>
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
      className={`group card relative flex h-full flex-col overflow-hidden p-6 ring-1 ring-transparent transition ${a.glow}`}
    >
      {/* Top neon bar */}
      <div className={`absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r ${a.bar}`} />
      <div className="flex items-start justify-between">
        <span
          className={`flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br ${a.grad} text-white shadow-lg`}
        >
          <Icon className="h-6 w-6" aria-hidden="true" />
        </span>
        <span className={`chip ${a.chip}`}>{c.category}</span>
      </div>
      <h3 className="mt-5 text-lg font-bold text-white">{c.title}</h3>
      <p className="mt-2 flex-1 text-sm leading-relaxed text-slate-400">{c.tagline}</p>
      <div className="mt-4 flex flex-wrap gap-1.5">
        {c.tags.slice(0, 3).map((t) => (
          <span
            key={t}
            className="chip border border-slate-700 bg-base-800/60 text-slate-400"
          >
            {t}
          </span>
        ))}
      </div>
      <div className={`mt-5 inline-flex items-center gap-1.5 text-sm font-semibold ${a.text}`}>
        Open calculator
        <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" aria-hidden="true" />
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

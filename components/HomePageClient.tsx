'use client';

import Link from 'next/link';
import { useMemo, useState, type ReactNode } from 'react';
import {
  CreditCard,
  Clock,
  TrendingUp,
  Building2,
  ArrowRight,
  ShieldCheck,
  Zap,
  Cpu,
  Activity,
  Wifi,
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

// Cyber accent map per calculator — matches CalculatorPageShell signatures.
const accentMap: Record<
  string,
  { glow: string; grad: string; chip: string; bar: string; text: string }
> = {
  indigo: {
    glow: 'group-hover:shadow-[0_0_25px_rgba(0,242,254,0.2)]',
    grad: 'from-cyan-500 to-blue-600',
    chip: 'border border-cyan-500/40 bg-cyan-500/10 text-cyan-300',
    bar: 'from-cyan-500 to-blue-600',
    text: 'text-cyan-400',
  },
  emerald: {
    glow: 'group-hover:shadow-[0_0_25px_rgba(16,185,129,0.2)]',
    grad: 'from-emerald-500 to-teal-500',
    chip: 'border border-emerald-500/40 bg-emerald-500/10 text-emerald-300',
    bar: 'from-emerald-500 to-teal-500',
    text: 'text-emerald-400',
  },
  slate: {
    glow: 'group-hover:shadow-[0_0_25px_rgba(139,92,246,0.2)]',
    grad: 'from-purple-500 to-fuchsia-600',
    chip: 'border border-purple-500/40 bg-purple-500/10 text-purple-300',
    bar: 'from-purple-500 to-fuchsia-600',
    text: 'text-purple-400',
  },
  amber: {
    glow: 'group-hover:shadow-[0_0_25px_rgba(245,158,11,0.2)]',
    grad: 'from-amber-500 to-orange-600',
    chip: 'border border-amber-500/40 bg-amber-500/10 text-amber-300',
    bar: 'from-amber-500 to-orange-600',
    text: 'text-amber-400',
  },
};

const categories = ['All', 'Payments', 'Freelancing', 'Startups', 'Taxes'];

// Map calculator slug -> live mini widget (or null if none)
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
      {/* ===== HUD System Status Bar ===== */}
      <SystemStatusBar />

      {/* ===== Hero / Terminal Search ===== */}
      <section className="relative overflow-hidden border-b border-slate-800">
        {/* glow orbs */}
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

            {/* Terminal-style command prompt search */}
            <div className="mx-auto mt-8 max-w-xl animate-fade-in-up">
              <TerminalSearch value={query} onChange={setQuery} />
            </div>
          </div>
        </div>
      </section>

      {/* ===== Live Interactive Calculator Grid ===== */}
      <section className="container-page py-12 sm:py-16">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 text-xl font-bold text-white sm:text-2xl">
            <Cpu className="h-5 w-5 text-cyan-400" aria-hidden="true" />
            Calculator engines
          </h2>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter by category">
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setActiveCat(cat)}
                className={`rounded-md px-3 py-1.5 font-mono text-xs font-medium uppercase tracking-wide transition ${
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
            <p className="font-mono text-slate-400">
              <span className="text-rose-400">ERR:</span> no engines match{' '}
              <strong className="text-slate-200">&ldquo;{query}&rdquo;</strong>. Try a different query.
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
                <LiveCalculatorCard c={c} widget={widgetMap[c.slug]} />
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ===== Benefits ===== */}
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

/* ---------------------------------------------------------------
   HUD System Status Bar
   --------------------------------------------------------------- */
function SystemStatusBar() {
  return (
    <div className="relative z-10 border-b border-slate-800 bg-base-900/60 backdrop-blur">
      <div className="container-page flex h-8 items-center justify-between font-mono text-[10px] uppercase tracking-wider text-slate-500">
        <div className="flex items-center gap-2 sm:gap-4">
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-1.5 w-1.5 animate-pulse-glow rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(16,185,129,0.9)]" />
            <span className="text-emerald-400">SYSTEM ONLINE</span>
          </span>
          <span className="hidden text-slate-600 sm:inline">|</span>
          <span className="hidden items-center gap-1.5 sm:flex">
            <Cpu className="h-3 w-3 text-cyan-500/70" aria-hidden="true" />
            <span>4 ENGINES LOADED</span>
          </span>
          <span className="hidden text-slate-600 md:inline">|</span>
          <span className="hidden items-center gap-1.5 md:flex">
            <Activity className="h-3 w-3 text-cyan-500/70" aria-hidden="true" />
            <span>LATENCY: 0ms</span>
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <Wifi className="h-3 w-3 text-cyan-500/70" aria-hidden="true" />
          <span className="hidden sm:inline">CLIENT-SIDE · </span>
          <span>v2.0</span>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------
   Terminal-style search input
   --------------------------------------------------------------- */
function TerminalSearch({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="hud-frame scanlines relative rounded-xl border border-cyan-500/30 bg-base-900/70 shadow-glow-cyan backdrop-blur">
      <label htmlFor="terminal-search" className="sr-only">
        Search calculators
      </label>
      <div className="flex items-center px-4 pt-2.5 font-mono text-[10px] uppercase tracking-wider text-slate-500">
        <span className="text-cyan-400">~/calcsuite</span>
        <span className="mx-1.5 text-slate-600">$</span>
        <span className="text-emerald-400">query</span>
        <span className="ml-auto text-slate-600">PRESS ENTER ↵</span>
      </div>
      <div className="flex items-center gap-2 px-4 pb-3 pt-1.5">
        <span className="font-mono text-lg font-bold text-cyan-400">&gt;_</span>
        <input
          id="terminal-search"
          type="search"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="SEARCH_ENGINE_INPUT… e.g. 'stripe', 'runway', 'taxes'"
          aria-label="Search calculators"
          className="w-full bg-transparent font-mono text-base text-cyan-100 placeholder:text-slate-600 focus:outline-none"
        />
        {value === '' && <span className="term-cursor" aria-hidden="true" />}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------
   Live Interactive Calculator Card
   --------------------------------------------------------------- */
function LiveCalculatorCard({ c, widget }: { c: Calculator; widget?: ReactNode }) {
  const Icon = iconMap[c.icon] ?? CreditCard;
  const a = accentMap[c.accent] ?? accentMap.indigo;
  return (
    <Link
      href={c.href}
      className={`group card relative flex h-full flex-col overflow-hidden p-6 ring-1 ring-transparent transition ${a.glow}`}
    >
      {/* Top neon bar */}
      <div className={`absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r ${a.bar}`} />
      {/* Sweep sheen on hover */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl">
        <div className="absolute -inset-y-4 -left-1/3 w-1/3 rotate-12 bg-gradient-to-r from-transparent via-white/5 to-transparent opacity-0 transition group-hover:animate-sweep" />
      </div>

      <div className="flex items-start justify-between">
        <span
          className={`flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br ${a.grad} text-white shadow-lg`}
        >
          <Icon className="h-6 w-6" aria-hidden="true" />
        </span>
        <span className={`chip font-mono text-[10px] uppercase tracking-wider ${a.chip}`}>
          [{c.category}]
        </span>
      </div>

      <h3 className="mt-5 text-lg font-bold text-white">{c.title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-slate-400">{c.tagline}</p>

      {/* Terminal-style tag badges */}
      <div className="mt-4 flex flex-wrap gap-1.5">
        {c.tags.slice(0, 3).map((t) => (
          <span
            key={t}
            className="chip border border-slate-700 bg-base-800/60 font-mono text-[10px] text-slate-500"
          >
            {t}
          </span>
        ))}
      </div>

      {/* LIVE mini widget */}
      {widget && <div onClick={(e) => e.preventDefault()}>{widget}</div>}

      <div className={`mt-5 inline-flex items-center gap-1.5 font-mono text-sm font-semibold ${a.text}`}>
        &gt; OPEN_ENGINE
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

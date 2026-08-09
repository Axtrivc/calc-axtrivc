'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  CreditCard,
  Clock,
  TrendingUp,
  Building2,
  Search,
  ArrowRight,
  ShieldCheck,
  Zap,
  Cpu,
  type LucideIcon,
} from 'lucide-react';
import { calculators, type Calculator } from '@/lib/site';
import {
  StripeMiniWidget,
  FreelanceMiniWidget,
  RunwayMiniWidget,
  TaxMiniWidget,
} from '@/components/HomeWidgets';
import { useToast } from '@/components/Toast';

const iconMap: Record<string, LucideIcon> = {
  CreditCard,
  Clock,
  TrendingUp,
  Building2,
};

// Workspace accent map: indigo / emerald / sky / amber.
const accentMap: Record<
  string,
  { glow: string; bg: string; chip: string; text: string; ring: string; bar: string }
> = {
  indigo: {
    glow: 'before:from-indigo-500/10',
    bg: 'bg-gradient-to-br from-indigo-500 to-indigo-600',
    chip: 'bg-indigo-50 text-indigo-700 ring-indigo-100',
    text: 'text-indigo-600',
    ring: 'hover:border-indigo-300',
    bar: 'from-indigo-500 to-violet-500',
  },
  emerald: {
    glow: 'before:from-emerald-500/10',
    bg: 'bg-gradient-to-br from-emerald-500 to-emerald-600',
    chip: 'bg-emerald-50 text-emerald-700 ring-emerald-100',
    text: 'text-emerald-600',
    ring: 'hover:border-emerald-300',
    bar: 'from-emerald-500 to-teal-500',
  },
  slate: {
    glow: 'before:from-sky-500/10',
    bg: 'bg-gradient-to-br from-sky-500 to-sky-600',
    chip: 'bg-sky-50 text-sky-700 ring-sky-100',
    text: 'text-sky-600',
    ring: 'hover:border-sky-300',
    bar: 'from-sky-500 to-cyan-500',
  },
  amber: {
    glow: 'before:from-amber-500/10',
    bg: 'bg-gradient-to-br from-amber-500 to-amber-600',
    chip: 'bg-amber-50 text-amber-700 ring-amber-100',
    text: 'text-amber-600',
    ring: 'hover:border-amber-300',
    bar: 'from-amber-500 to-orange-500',
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
  const { show } = useToast();
  const [query, setQuery] = useState('');
  const [activeCat, setActiveCat] = useState('All');
  const searchRef = useRef<HTMLInputElement>(null);

  // ⌘K / Ctrl+K focuses the command bar.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchRef.current?.focus();
        searchRef.current?.select();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

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
      {/* ===== Workspace command bar (top status strip) ===== */}
      <section className="border-b border-slate-200/70 bg-white/60 backdrop-blur-xl">
        <div className="container-page flex h-9 items-center justify-between text-[11px] font-medium text-slate-500">
          <div className="flex items-center gap-2">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
            </span>
            <span className="uppercase tracking-wider">Local compute engine · Zero-latency</span>
          </div>
          <span className="hidden font-mono uppercase tracking-wider text-slate-400 sm:block">
            Workspace / Personal Finance Suite
          </span>
        </div>
      </section>

      {/* ===== Hero ===== */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-200/60 via-slate-50 to-slate-100" />
        <div className="container-page relative py-14 sm:py-20">
          <div className="mx-auto max-w-3xl text-center">
            <motion.div
              className="mb-5 flex items-center justify-center"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
            >
              <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200/80 bg-white/80 px-3 py-1 text-xs font-medium text-slate-600 shadow-sm backdrop-blur">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
                </span>
                Live workspace · 100% client-side
              </span>
            </motion.div>

            <motion.h1
              className="text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl"
              style={{ letterSpacing: '-0.02em' }}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.05 }}
            >
              Personal finance suite for{' '}
              <span className="text-slate-900">freelancers, startups & SMBs</span>
            </motion.h1>
            <motion.p
              className="mx-auto mt-5 max-w-2xl text-lg text-slate-500"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.12 }}
            >
              Stop guessing at Stripe fees, freelance rates, runway, and entity taxes. Get precise,
              instant answers — plus in-depth guides for every tool.
            </motion.p>

            {/* Command-K style search */}
            <motion.div
              className="mx-auto mt-8 max-w-xl"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.18 }}
            >
              <div className="group relative">
                <Search
                  className="pointer-events-none absolute inset-y-0 left-0 my-auto h-5 w-5 pl-3.5 text-slate-400"
                  aria-hidden="true"
                />
                <input
                  ref={searchRef}
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search calculators…"
                  aria-label="Search calculators"
                  className="block w-full rounded-xl border border-slate-200/80 bg-white px-11 pr-24 py-3 text-base text-slate-900 shadow-[0_2px_8px_rgba(15,23,42,0.04)] transition focus-within:border-slate-400 focus-within:outline-none focus-within:ring-2 focus-within:ring-slate-900/5"
                />
                <kbd className="pointer-events-none absolute inset-y-0 right-3 my-auto hidden h-6 items-center gap-0.5 rounded-md border border-slate-200 bg-slate-50 px-1.5 font-mono text-[10px] font-medium text-slate-400 sm:flex">
                  ⌘K
                </kbd>
              </div>
            </motion.div>
          </div>

          {/* Hero dashboard summary bar */}
          <motion.div
            className="mx-auto mt-12 grid max-w-4xl grid-cols-1 gap-3 sm:grid-cols-3"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.24 }}
          >
            <SummaryStat icon={Cpu} value="4 active engines" sub="Ready for instant calculation" />
            <SummaryStat icon={ShieldCheck} value="100% private" sub="Zero server logs & no registration" />
            <SummaryStat icon={Zap} value="Local compute" sub="Instant client-side JavaScript execution" />
          </motion.div>
        </div>
      </section>

      {/* ===== Calculator grid ===== */}
      <section className="container-page py-12 sm:py-16">
        <div className="mb-7 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
              All calculators
            </h2>
            <p className="mt-0.5 text-sm text-slate-500">
              Drag, tweak, and preview — then open the full engine.
            </p>
          </div>
          {/* Sliding active-pill category filter */}
          <div
            className="flex flex-wrap gap-1 rounded-full border border-slate-200/70 bg-white p-1 shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
            role="group"
            aria-label="Filter by category"
          >
            {categories.map((cat) => {
              const isActive = activeCat === cat;
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setActiveCat(cat)}
                  className={`relative rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${
                    isActive ? 'text-white' : 'text-slate-600 hover:text-slate-900'
                  }`}
                  aria-pressed={isActive}
                >
                  {isActive && (
                    <motion.span
                      layoutId="activeTabPill"
                      className="absolute inset-0 -z-10 rounded-full bg-slate-900 shadow-sm"
                      transition={{ type: 'spring', stiffness: 400, damping: 32 }}
                    />
                  )}
                  {cat}
                </button>
              );
            })}
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
            <p className="text-slate-600">
              No calculators match <strong className="text-slate-900">&ldquo;{query}&rdquo;</strong>. Try a
              different term or category.
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
          <motion.div layout className="grid gap-6 sm:grid-cols-2">
            <AnimatePresence mode="popLayout">
              {filtered.map((c) => (
                <motion.div
                  key={c.slug}
                  layout
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.96 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                >
                  <CalculatorCard c={c} widget={widgetMap[c.slug]} onShare={() => show('Copied calculator link', 'success')} />
                </motion.div>
              ))}
            </AnimatePresence>
          </motion.div>
        )}
      </section>

      {/* ===== Benefits ===== */}
      <section className="border-t border-slate-200/70 bg-white/60 backdrop-blur-xl">
        <div className="container-page py-14">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              Why CalcSuite?
            </h2>
            <p className="mt-3 text-slate-500">
              Built by people who actually run businesses — not by ad networks. Every tool is free,
              private, and accurate.
            </p>
          </div>
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {benefits.map((b, i) => (
              <motion.div
                key={b.title}
                className="rounded-2xl border border-slate-200/70 bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_8px_16px_rgba(15,23,42,0.06)] hover:border-slate-300"
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-60px' }}
                transition={{ duration: 0.4, delay: i * 0.06 }}
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 text-slate-700 ring-1 ring-inset ring-slate-200/60">
                  <b.icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <h3 className="mt-4 text-base font-semibold tracking-tight text-slate-900">{b.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-slate-500">{b.body}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}

/* ---------- Summary stat tile ----------
 * Honest value propositions — no synthetic metrics. The value is the
 * headline (slate-900, mono), the sub line is a short, factual descriptor.
 * All tiles share one neutral icon treatment for a consistent, refined look.
 */
function SummaryStat({
  icon: Icon,
  value,
  sub,
}: {
  icon: LucideIcon;
  value: string;
  sub: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-slate-200/70 bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_8px_16px_rgba(15,23,42,0.06)] hover:border-slate-300">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-700 ring-1 ring-inset ring-slate-200/60">
        <Icon className="h-5 w-5" aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <div className="readout text-base font-semibold text-slate-900">{value}</div>
        <div className="mt-0.5 text-[12px] leading-snug text-slate-500">{sub}</div>
      </div>
    </div>
  );
}

/* ---------- Calculator card ----------
 *
 * CRITICAL: the card itself is a plain <article>, NOT a single <Link>.
 * Navigation is split into explicit zones (title link + "Open calculator"
 * button) that live OUTSIDE the interactive widget. The widget sits in its
 * own isolated region, so dragging a slider can never trigger navigation.
 */
function CalculatorCard({
  c,
  widget,
  onShare,
}: {
  c: Calculator;
  widget?: ReactNode;
  onShare?: () => void;
}) {
  const Icon = iconMap[c.icon] ?? CreditCard;
  const a = accentMap[c.accent] ?? accentMap.indigo;

  return (
    <article
      className={`group relative flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200/70 bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_8px_16px_rgba(15,23,42,0.06)] hover:border-slate-300`}
    >
      {/* accent glow */}
      <div
        className={`pointer-events-none absolute -top-16 right-0 h-40 w-40 rounded-full bg-gradient-to-br ${a.bar} opacity-0 blur-3xl transition-opacity duration-500 group-hover:opacity-10`}
        aria-hidden="true"
      />

      <div className="relative flex items-start justify-between">
        <span className={`flex h-12 w-12 items-center justify-center rounded-xl ${a.bg} text-white shadow-sm`}>
          <Icon className="h-6 w-6" aria-hidden="true" />
        </span>
        <span className="bg-slate-100 text-slate-600 text-[11px] font-medium border border-slate-200/50 rounded-full px-2.5 py-0.5">
          {c.category}
        </span>
      </div>

      {/* Title is the navigation affordance for the header region */}
      <h3 className="relative mt-5 text-lg font-bold tracking-tight text-slate-900">
        <Link href={c.href} className="transition hover:opacity-80 after:absolute after:inset-0">
          {c.title}
        </Link>
      </h3>
      <p className="relative mt-2 flex-1 text-sm leading-relaxed text-slate-500">{c.tagline}</p>
      <div className="relative mt-4 flex flex-wrap gap-1.5">
        {c.tags.slice(0, 3).map((t) => (
          <span
            key={t}
            className="bg-slate-100 text-slate-600 text-[11px] font-medium border border-slate-200/50 rounded-full px-2.5 py-0.5"
          >
            {t}
          </span>
        ))}
      </div>

      {/* Live interactive widget — fully isolated, never navigates */}
      {widget}

      {/* Explicit navigation + share zone, separate from the widget */}
      <div className="relative mt-5 flex items-center justify-between border-t border-slate-100 pt-4">
        <Link
          href={c.href}
          className={`inline-flex items-center gap-1.5 text-sm font-semibold ${a.text} transition hover:gap-2`}
        >
          Open calculator
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
        {onShare && (
          <button
            type="button"
            onClick={() => onShare()}
            className="rounded-md px-2 py-1 text-xs font-medium text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
            aria-label={`Share ${c.title}`}
          >
            Share
          </button>
        )}
      </div>
    </article>
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

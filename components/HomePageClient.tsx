'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  CreditCard,
  Clock,
  TrendingUp,
  Building2,
  Landmark,
  Search,
  ArrowRight,
  ShieldCheck,
  Zap,
  Cpu,
  Pin,
  History,
  Bookmark,
  Trash2,
  Sparkles,
  Workflow,
  type LucideIcon,
} from 'lucide-react';
import { calculators, siteConfig, type Calculator } from '@/lib/site';
import {
  StripeMiniWidget,
  FreelanceMiniWidget,
  RunwayMiniWidget,
  TaxMiniWidget,
  ScorpMiniWidget,
} from '@/components/HomeWidgets';
import { useToast } from '@/components/Toast';
import { copyText } from '@/lib/clipboard';
import {
  getPins,
  setPins,
  getRecents,
  getScenarios,
  removeScenario,
  relTime,
  type RecentEntry,
  type Scenario,
} from '@/lib/workbench';

const iconMap: Record<string, LucideIcon> = {
  CreditCard,
  Clock,
  TrendingUp,
  Building2,
  Landmark,
};

// Workspace accent map: indigo / emerald / sky / amber.
const accentMap: Record<
  string,
  { glow: string; bg: string; chip: string; text: string; ring: string; bar: string }
> = {
  indigo: {
    glow: 'before:from-indigo-500/10',
    bg: 'bg-gradient-to-br from-indigo-500 to-indigo-600',
    chip: 'bg-indigo-50 text-indigo-700 ring-indigo-100 dark:bg-indigo-500/15 dark:text-indigo-300 dark:ring-indigo-500/25',
    text: 'text-indigo-600 dark:text-indigo-300',
    ring: 'hover:border-indigo-300/80 dark:hover:border-indigo-500/40',
    bar: 'from-indigo-500 to-violet-500',
  },
  emerald: {
    glow: 'before:from-emerald-500/10',
    bg: 'bg-gradient-to-br from-emerald-500 to-emerald-600',
    chip: 'bg-emerald-50 text-emerald-700 ring-emerald-100 dark:bg-emerald-500/15 dark:text-emerald-300 dark:ring-emerald-500/25',
    text: 'text-emerald-600 dark:text-emerald-300',
    ring: 'hover:border-emerald-300/80 dark:hover:border-emerald-500/40',
    bar: 'from-emerald-500 to-teal-500',
  },
  slate: {
    glow: 'before:from-sky-500/10',
    bg: 'bg-gradient-to-br from-sky-500 to-sky-600',
    chip: 'bg-sky-50 text-sky-700 ring-sky-100 dark:bg-sky-500/15 dark:text-sky-300 dark:ring-sky-500/25',
    text: 'text-sky-600 dark:text-sky-300',
    ring: 'hover:border-sky-300/80 dark:hover:border-sky-500/40',
    bar: 'from-sky-500 to-cyan-500',
  },
  amber: {
    glow: 'before:from-amber-500/10',
    bg: 'bg-gradient-to-br from-amber-500 to-amber-600',
    chip: 'bg-amber-50 text-amber-700 ring-amber-100 dark:bg-amber-500/15 dark:text-amber-300 dark:ring-amber-500/25',
    text: 'text-amber-600 dark:text-amber-300',
    ring: 'hover:border-amber-300/80 dark:hover:border-amber-500/40',
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
  's-corp-tax-calculator': <ScorpMiniWidget />,
};

const bySlug = new Map(calculators.map((c) => [c.slug, c]));

/** Relative deep link that restores a saved scenario via query params. */
function scenarioHref(s: Scenario): string {
  const calc = bySlug.get(s.slug);
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(s.params)) {
    if (Number.isFinite(v)) sp.set(k, String(Number.isInteger(v) ? v : Number(v.toFixed(4))));
  }
  const qs = sp.toString();
  return `${calc?.href ?? '/'}${qs ? `?${qs}` : ''}`;
}

function scenarioSummary(s: Scenario): string {
  return Object.entries(s.params)
    .map(([k, v]) => {
      const clean = Number(v.toPrecision(12));
      return `${k}=${Number.isInteger(clean) ? clean.toLocaleString('en-US') : clean}`;
    })
    .join(' · ');
}

export default function HomePageClient() {
  const { show } = useToast();
  const [query, setQuery] = useState('');
  const [activeCat, setActiveCat] = useState('All');

  // Workbench memory — all client-side, loaded after mount (SSG-safe).
  const [mounted, setMounted] = useState(false);
  const [pins, setPinsState] = useState<string[]>([]);
  const [recents, setRecents] = useState<RecentEntry[]>([]);
  const [scenarios, setScenarios] = useState<Scenario[]>([]);

  useEffect(() => {
    setMounted(true);
    setPinsState(getPins());
    setRecents(getRecents());
    setScenarios(getScenarios());

    // The WebSite SearchAction JSON-LD points at /?q= — honor it.
    const q = new URLSearchParams(window.location.search).get('q');
    if (q) setQuery(q);
  }, []);

  // Keep ?q= in the URL in sync with the search box (shareable filter state).
  useEffect(() => {
    if (!mounted) return;
    const url = new URL(window.location.href);
    const q = query.trim();
    if (q) url.searchParams.set('q', q);
    else url.searchParams.delete('q');
    window.history.replaceState(null, '', url);
  }, [query, mounted]);

  // Cursor spotlight: write pointer coords to CSS vars on the page wrapper so
  // the ::before glow follows the mouse. Passive + rAF-throttled.
  useEffect(() => {
    let frame = 0;
    function onMove(e: PointerEvent) {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        document.documentElement.style.setProperty('--mouse-x', `${e.clientX}px`);
        document.documentElement.style.setProperty('--mouse-y', `${e.clientY}px`);
      });
    }
    window.addEventListener('pointermove', onMove, { passive: true });
    return () => {
      window.removeEventListener('pointermove', onMove);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = calculators.filter((c) => {
      const matchCat = activeCat === 'All' || c.category === activeCat;
      if (!matchCat) return false;
      if (!q) return true;
      const haystack = [c.title, c.tagline, c.description, c.category, ...c.tags]
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
    // Pinned tools float to the top of the grid.
    return [...list].sort(
      (a, b) => Number(pins.includes(b.slug)) - Number(pins.includes(a.slug))
    );
  }, [query, activeCat, pins]);

  function togglePin(slug: string) {
    const next = pins.includes(slug) ? pins.filter((p) => p !== slug) : [slug, ...pins];
    setPinsState(next);
    setPins(next);
    const calc = bySlug.get(slug);
    const name = calc?.shortTitle ?? calc?.title ?? 'Tool';
    show(next.includes(slug) ? `Pinned ${name} to your workbench` : `Unpinned ${name}`, 'info');
  }

  function handleDeleteScenario(id: string) {
    removeScenario(id);
    setScenarios(getScenarios());
    show('Scenario removed', 'info');
  }

  async function handleShare(c: Calculator) {
    const ok = await copyText(`${siteConfig.url}${c.href}`);
    show(ok ? 'Copied calculator link' : 'Copy failed', ok ? 'success' : 'info');
  }

  const hasWorkbenchData = pins.length > 0 || recents.length > 0 || scenarios.length > 0;
  const pinnedCalcs = pins.map((p) => bySlug.get(p)).filter(Boolean) as Calculator[];
  const recentCalcs = recents
    .map((r) => ({ ...r, calc: bySlug.get(r.slug) }))
    .filter((r) => r.calc);

  return (
    <div className="cursor-spotlight relative">
      {/* ===== Workspace command bar (top status strip) ===== */}
      <section className="bg-transparent">
        <div className="container-page flex h-9 items-center justify-between text-[11px] font-medium text-slate-500 dark:text-slate-500">
          <div className="flex items-center gap-2">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
            </span>
            <span className="uppercase tracking-wider">Local compute engine · Zero-latency</span>
          </div>
          <span className="hidden font-mono uppercase tracking-wider text-slate-400 sm:block dark:text-slate-600">
            Workspace / Personal Finance Suite
          </span>
        </div>
      </section>

      {/* ===== Hero ===== */}
      <section className="relative overflow-hidden bg-transparent">
        <div className="container-page relative py-12 sm:py-16">
          <div className="mx-auto max-w-3xl text-center">
            <motion.div
              className="mb-5 flex items-center justify-center"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
            >
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/80 bg-white/70 px-3 py-1 text-xs font-medium text-slate-600 shadow-[0_2px_10px_rgba(15,23,42,0.04)] backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.05] dark:text-slate-300 dark:shadow-none">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
                </span>
                Personal workbench · 100% client-side
              </span>
            </motion.div>

            <motion.h1
              className="text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl dark:text-white"
              style={{ letterSpacing: '-0.02em' }}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.05 }}
            >
              Your personal finance workbench
            </motion.h1>
            <motion.p
              className="mx-auto mt-5 max-w-2xl text-lg text-slate-500 dark:text-slate-400"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.12 }}
            >
              Pricing, payment fees, entity structure, owner compensation, runway — five
              instruments that remember your numbers, save your scenarios, and never send a single
              digit to a server.
            </motion.p>

            {/* Search */}
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
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search calculators…"
                  aria-label="Search calculators"
                  className="block w-full rounded-xl border border-white/80 bg-white/70 px-11 py-3 text-base text-slate-900 shadow-[0_4px_16px_rgba(15,23,42,0.05)] backdrop-blur-xl transition focus-within:border-indigo-300 focus-within:outline-none focus-within:ring-4 focus-within:ring-indigo-500/10 dark:border-white/10 dark:bg-white/[0.05] dark:text-slate-100 dark:shadow-none dark:focus-within:border-indigo-400/60 dark:focus-within:ring-indigo-400/15"
                />
              </div>
            </motion.div>
          </div>

          {/* Hero dashboard summary bar */}
          <motion.div
            className="mx-auto mt-10 grid max-w-4xl grid-cols-1 gap-3 sm:grid-cols-3"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.24 }}
          >
            <SummaryStat icon={Cpu} value="5 active engines" sub="Ready for instant calculation" />
            <SummaryStat icon={ShieldCheck} value="100% private" sub="Zero server logs & no registration" />
            {mounted && scenarios.length > 0 ? (
              <SummaryStat
                icon={Bookmark}
                value={`${scenarios.length} scenario${scenarios.length === 1 ? '' : 's'} saved`}
                sub="Restorable from your workbench"
              />
            ) : (
              <SummaryStat icon={Zap} value="Local compute" sub="Instant client-side JavaScript execution" />
            )}
          </motion.div>
        </div>
      </section>

      {/* ===== Workflow rail — the suite's positioning, made visible ===== */}
      <section className="container-page pb-2" aria-label="The CalcSuite workflow">
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-40px' }}
          transition={{ duration: 0.45 }}
          className="glass-card overflow-hidden p-5 sm:p-6"
        >
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 text-base font-bold tracking-tight text-slate-900 dark:text-white">
              <Workflow className="h-4 w-4 text-indigo-500 dark:text-indigo-300" aria-hidden="true" />
              One workflow, five instruments
            </h2>
            <span className="font-mono text-[11px] uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Price → Bill → Structure → Compensate → Sustain
            </span>
          </div>
          <ol className="grid gap-2.5 sm:grid-cols-3 lg:grid-cols-5">
            {[...calculators]
              .sort((a, b) => a.stage - b.stage)
              .map((c) => {
                const Icon = iconMap[c.icon] ?? CreditCard;
                const a = accentMap[c.accent] ?? accentMap.indigo;
                return (
                  <li key={c.slug}>
                    <Link
                      href={c.href}
                      className="group flex h-full flex-col rounded-xl border border-white/70 bg-white/50 p-3.5 backdrop-blur transition hover:-translate-y-0.5 hover:shadow-md dark:border-white/[0.07] dark:bg-white/[0.03] dark:hover:border-white/[0.12] dark:hover:shadow-black/30"
                    >
                      <div className="flex items-center justify-between">
                        <span className="readout text-[10px] font-bold tracking-widest text-slate-300 dark:text-slate-600">
                          {String(c.stage).padStart(2, '0')}
                        </span>
                        <Icon className={`h-4 w-4 ${a.text}`} aria-hidden="true" />
                      </div>
                      <span className="mt-2 font-mono text-[10px] font-bold uppercase tracking-widest text-slate-400 transition group-hover:text-slate-600 dark:text-slate-500 dark:group-hover:text-slate-300">
                        {c.stageLabel}
                      </span>
                      <span className="mt-0.5 text-sm font-semibold leading-snug text-slate-800 transition group-hover:text-slate-950 dark:text-slate-200 dark:group-hover:text-white">
                        {c.shortTitle ?? c.title}
                      </span>
                    </Link>
                  </li>
                );
              })}
          </ol>
        </motion.div>
      </section>

      {/* ===== My workbench ===== */}
      <section className="container-page pb-2 pt-4 sm:pb-4" aria-label="My workbench">
        <div className="glass-card overflow-hidden p-5 sm:p-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 text-base font-bold tracking-tight text-slate-900 dark:text-white">
              <Sparkles className="h-4 w-4 text-indigo-500 dark:text-indigo-300" aria-hidden="true" />
              My workbench
            </h2>
            <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
              Private — stored only in this browser
            </span>
          </div>

          {!mounted ? (
            <div className="h-16 animate-pulse rounded-xl bg-slate-100/70 dark:bg-white/[0.04]" aria-hidden="true" />
          ) : !hasWorkbenchData ? (
            <div className="rounded-xl border border-dashed border-slate-300/80 bg-white/40 px-5 py-6 text-center text-sm text-slate-500 dark:border-white/15 dark:bg-white/[0.02] dark:text-slate-400">
              Your workbench is empty. Pin a calculator with the{' '}
              <Pin className="inline h-3.5 w-3.5 text-indigo-500 dark:text-indigo-300" aria-hidden="true" /> icon on a
              card, or press <strong className="font-semibold text-slate-700 dark:text-slate-200">Save scenario</strong>{' '}
              inside any calculator — everything will show up here.
            </div>
          ) : (
            <div className="grid gap-4 lg:grid-cols-3">
              {/* Pinned */}
              <div className="rounded-xl border border-white/70 bg-white/50 p-4 backdrop-blur dark:border-white/[0.07] dark:bg-white/[0.03]">
                <h3 className="mb-2.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  <Pin className="h-3.5 w-3.5" aria-hidden="true" /> Pinned
                </h3>
                {pinnedCalcs.length === 0 ? (
                  <p className="text-xs text-slate-400 dark:text-slate-500">Nothing pinned yet.</p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {pinnedCalcs.map((c) => {
                      const a = accentMap[c.accent] ?? accentMap.indigo;
                      const Icon = iconMap[c.icon] ?? CreditCard;
                      return (
                        <Link
                          key={c.slug}
                          href={c.href}
                          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ring-1 ring-inset transition hover:-translate-y-0.5 ${a.chip}`}
                        >
                          <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                          {c.shortTitle ?? c.title}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Recent */}
              <div className="rounded-xl border border-white/70 bg-white/50 p-4 backdrop-blur dark:border-white/[0.07] dark:bg-white/[0.03]">
                <h3 className="mb-2.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  <History className="h-3.5 w-3.5" aria-hidden="true" /> Recent
                </h3>
                {recentCalcs.length === 0 ? (
                  <p className="text-xs text-slate-400 dark:text-slate-500">No recent activity yet.</p>
                ) : (
                  <ul className="space-y-1.5">
                    {recentCalcs.slice(0, 4).map((r) => (
                      <li key={r.slug} className="flex items-center justify-between gap-2">
                        <Link
                          href={r.calc!.href}
                          className="truncate text-sm font-medium text-slate-700 transition hover:text-indigo-600 dark:text-slate-300 dark:hover:text-indigo-300"
                        >
                          {r.calc!.shortTitle ?? r.calc!.title}
                        </Link>
                        <span className="shrink-0 font-mono text-[10px] text-slate-500 dark:text-slate-500">{relTime(r.ts)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Scenarios */}
              <div className="rounded-xl border border-white/70 bg-white/50 p-4 backdrop-blur dark:border-white/[0.07] dark:bg-white/[0.03]">
                <h3 className="mb-2.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  <Bookmark className="h-3.5 w-3.5" aria-hidden="true" /> Saved scenarios
                </h3>
                {scenarios.length === 0 ? (
                  <p className="text-xs text-slate-400 dark:text-slate-500">
                    Save a scenario inside any calculator to replay or share it later.
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {scenarios.slice(0, 4).map((s) => (
                      <li key={s.id} className="group flex items-center gap-2">
                        <Link href={scenarioHref(s)} className="min-w-0 flex-1" title={scenarioSummary(s)}>
                          <span className="block truncate text-sm font-medium text-slate-700 transition group-hover:text-indigo-600 dark:text-slate-300 dark:group-hover:text-indigo-300">
                            {s.name}
                          </span>
                          <span className="block truncate font-mono text-[10px] text-slate-500 dark:text-slate-500">
                            {scenarioSummary(s)}
                          </span>
                        </Link>
                        <button
                          type="button"
                          onClick={() => handleDeleteScenario(s.id)}
                          className="shrink-0 rounded-md p-1 text-slate-300 transition hover:bg-rose-50 hover:text-rose-500 dark:text-slate-600 dark:hover:bg-rose-500/10 dark:hover:text-rose-400"
                          aria-label={`Delete scenario ${s.name}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ===== Calculator grid ===== */}
      <section className="container-page py-10 sm:py-14">
        <div className="mb-7 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl dark:text-white">
              All calculators
            </h2>
            <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
              Drag, tweak, and preview — then open the full engine. Pin the ones you use daily.
            </p>
          </div>
          {/* Sliding active-pill category filter */}
          <div
            className="flex flex-wrap gap-1 rounded-full border border-white/80 bg-white/70 p-1 shadow-[0_4px_16px_rgba(15,23,42,0.05)] backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.05] dark:shadow-none"
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
                    isActive ? 'text-white' : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
                  }`}
                  aria-pressed={isActive}
                >
                  {isActive && (
                    <motion.span
                      layoutId="activeTabPill"
                      className="absolute inset-0 -z-10 rounded-full bg-gradient-to-r from-indigo-600 to-violet-600 shadow-[0_4px_12px_rgba(79,70,229,0.35)]"
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
          <div className="glass-card border-dashed border-slate-300/80 p-12 text-center dark:border-white/15">
            <p className="text-slate-600 dark:text-slate-300">
              No calculators match <strong className="text-slate-900 dark:text-white">&ldquo;{query}&rdquo;</strong>. Try a
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
          <motion.div layout className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            <AnimatePresence mode="popLayout">
              {filtered.map((c, i) => (
                <motion.div
                  key={c.slug}
                  layout
                  initial={{ opacity: 0, y: 20, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.96 }}
                  transition={{ type: 'spring', stiffness: 260, damping: 26, delay: i * 0.05 }}
                >
                  <CalculatorCard
                    c={c}
                    widget={widgetMap[c.slug]}
                    pinned={pins.includes(c.slug)}
                    onTogglePin={() => togglePin(c.slug)}
                    onShare={() => handleShare(c)}
                  />
                </motion.div>
              ))}
            </AnimatePresence>
          </motion.div>
        )}
      </section>

      {/* ===== Benefits ===== */}
      <section className="bg-transparent">
        <div className="container-page py-14">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl dark:text-white">
              Why CalcSuite?
            </h2>
            <p className="mt-3 text-slate-500 dark:text-slate-400">
              Built by people who actually run businesses — not by ad networks. Every tool is free,
              private, and accurate.
            </p>
          </div>
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {benefits.map((b, i) => (
              <motion.div
                key={b.title}
                className="glass-card p-5 transition-all duration-300 ease-out hover:-translate-y-1.5 hover:border-indigo-300/80 hover:shadow-[0_20px_40px_rgba(79,70,229,0.12)] dark:hover:border-indigo-400/30 dark:hover:shadow-[0_20px_40px_rgba(0,0,0,0.4)]"
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-60px' }}
                transition={{ duration: 0.4, delay: i * 0.06 }}
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500/10 to-violet-500/10 text-indigo-600 ring-1 ring-inset ring-indigo-200/60 dark:from-indigo-500/15 dark:to-violet-500/15 dark:text-indigo-300 dark:ring-indigo-500/25">
                  <b.icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <h3 className="mt-4 text-base font-semibold tracking-tight text-slate-900 dark:text-white">{b.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-slate-500 dark:text-slate-400">{b.body}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

/* ---------- Summary stat tile ---------- */
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
    <div className="glass-card flex items-center gap-3 p-5 transition-all duration-300 ease-out hover:-translate-y-1 hover:border-indigo-300/80 hover:shadow-[0_16px_32px_rgba(79,70,229,0.10)] dark:hover:border-indigo-400/30 dark:hover:shadow-[0_16px_32px_rgba(0,0,0,0.35)]">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500/10 to-violet-500/10 text-indigo-600 ring-1 ring-inset ring-indigo-200/60 dark:from-indigo-500/15 dark:to-violet-500/15 dark:text-indigo-300 dark:ring-indigo-500/25">
        <Icon className="h-5 w-5" aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <div className="readout text-base font-semibold text-slate-900 dark:text-white">{value}</div>
        <div className="mt-0.5 text-[12px] leading-snug text-slate-500 dark:text-slate-400">{sub}</div>
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
  pinned,
  onTogglePin,
  onShare,
}: {
  c: Calculator;
  widget?: ReactNode;
  pinned: boolean;
  onTogglePin: () => void;
  onShare?: () => void;
}) {
  const Icon = iconMap[c.icon] ?? CreditCard;
  const a = accentMap[c.accent] ?? accentMap.indigo;

  return (
    <article
      className={`group glass-card relative flex h-full flex-col overflow-hidden p-5 ${a.ring} transition-all duration-300 ease-out hover:-translate-y-1.5 hover:shadow-[0_20px_40px_rgba(79,70,229,0.12)] dark:hover:shadow-[0_20px_40px_rgba(0,0,0,0.45)]`}
    >
      {/* accent glow */}
      <div
        className={`pointer-events-none absolute -top-16 right-0 h-40 w-40 rounded-full bg-gradient-to-br ${a.bar} opacity-0 blur-3xl transition-opacity duration-500 group-hover:opacity-20 dark:group-hover:opacity-25`}
        aria-hidden="true"
      />

      <div className="relative flex items-start justify-between">
        <span className={`flex h-12 w-12 items-center justify-center rounded-xl ${a.bg} text-white shadow-[0_8px_20px_rgba(79,70,229,0.25)] transition-transform duration-300 group-hover:scale-105`}>
          <Icon className="h-6 w-6" aria-hidden="true" />
        </span>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={onTogglePin}
            className={`rounded-md p-1.5 transition ${
              pinned
                ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-300'
                : 'text-slate-300 hover:bg-slate-100 hover:text-slate-500 dark:text-slate-600 dark:hover:bg-white/[0.06] dark:hover:text-slate-400'
            }`}
            aria-label={pinned ? `Unpin ${c.title}` : `Pin ${c.title} to workbench`}
            aria-pressed={pinned}
          >
            <Pin className="h-4 w-4" aria-hidden="true" />
          </button>
          <span className={`text-[11px] font-medium rounded-full px-2.5 py-0.5 ring-1 ring-inset ${a.chip}`}>
            {c.category}
          </span>
        </div>
      </div>

      {/* Title is the navigation affordance for the header region */}
      <h3 className="relative mt-5 text-lg font-bold tracking-tight text-slate-900 dark:text-white">
        <Link href={c.href} className="transition hover:opacity-80 after:absolute after:inset-0">
          {c.title}
        </Link>
      </h3>
      <p className="relative mt-2 flex-1 text-sm leading-relaxed text-slate-500 dark:text-slate-400">{c.tagline}</p>
      <div className="relative mt-4 flex flex-wrap gap-1.5">
        {c.tags.slice(0, 3).map((t) => (
          <span
            key={t}
            className="bg-white/70 text-slate-600 text-[11px] font-medium border border-slate-200/60 rounded-full px-2.5 py-0.5 backdrop-blur dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-slate-400"
          >
            {t}
          </span>
        ))}
      </div>

      {/* Live interactive widget — fully isolated, never navigates */}
      {widget}

      {/* Explicit navigation + share zone, separate from the widget */}
      <div className="relative mt-5 flex items-center justify-between border-t border-white/60 pt-4 dark:border-white/[0.07]">
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
            className="rounded-md px-2 py-1 text-xs font-medium text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:text-slate-500 dark:hover:bg-white/[0.06] dark:hover:text-slate-300"
            aria-label={`Copy link to ${c.title}`}
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
    body: 'Formulas use current US rates (2025) and are documented on each page so you can verify every number.',
    icon: TrendingUp,
  },
  {
    title: '100% private',
    body: 'All calculations run in your browser. Nothing is sent to a server, stored, or tracked.',
    icon: ShieldCheck,
  },
  {
    title: 'Remembers your numbers',
    body: 'Pins, recent tools, saved inputs and scenarios live in your browser — your workbench picks up where you left off.',
    icon: Zap,
  },
  {
    title: 'Built for businesses',
    body: 'Each tool ships with a deep-dive guide — strategies, examples, and FAQs — written for real operators.',
    icon: Building2,
  },
];

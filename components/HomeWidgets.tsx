'use client';

import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { computeFee } from '@/lib/stripe';
import { computeFreelanceRate } from '@/lib/freelance';
import { computeRunway } from '@/lib/runway';
import { compareEntities } from '@/lib/tax';
import { usd, usdCompact, pct } from '@/lib/format';
import InteractiveSlider from '@/components/InteractiveSlider';
import AnimateNumber from '@/components/AnimateNumber';

/**
 * Live mini interactive widgets embedded in the homepage calculator cards.
 *
 * Each widget:
 *   - runs the REAL calculation library (the preview is always accurate),
 *   - is wrapped in InteractiveSlider so slider drags NEVER bubble up to the
 *     parent card's navigation link (the critical slider bug fix),
 *   - animates its numbers and bars with framer-motion springs so the whole
 *     card feels alive as you drag or click.
 *
 * Each widget container also stops pointer propagation at its root, giving a
 * double layer of protection against the parent `<Link>`.
 */

/** Shared wrapper that isolates pointer events from the parent card link. */
function WidgetShell({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="mt-5 rounded-xl border border-slate-200/80 bg-white/60 p-3.5 backdrop-blur-sm"
      onPointerDown={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      onTouchStart={(e) => e.stopPropagation()}
      onClick={(e) => {
        // Allow no click to reach the card link.
        e.stopPropagation();
        e.preventDefault();
      }}
    >
      {children}
    </div>
  );
}

/* ---------------------------------------------------------------
   1. STRIPE — live fee slider ($100 → $10,000)
   --------------------------------------------------------------- */
export function StripeMiniWidget() {
  const [amount, setAmount] = useState(1000);
  const r = useMemo(() => computeFee(amount, 'domestic'), [amount]);
  const netPct = r.charge > 0 ? (r.net / r.charge) * 100 : 0;
  const feePct = r.effectiveRate;

  return (
    <WidgetShell>
      <div className="mb-2.5 flex items-baseline justify-between">
        <span className="text-[10px] font-medium uppercase tracking-wider text-slate-400">
          Charge amount
        </span>
        <AnimateNumber
          value={amount}
          format={(n) => usd(n)}
          className="readout text-sm font-bold text-indigo-600"
        />
      </div>

      <InteractiveSlider
        value={amount}
        onChange={setAmount}
        min={100}
        max={10000}
        logarithmic
        ariaLabel="Stripe charge amount"
      />

      <div className="mt-3 grid grid-cols-2 gap-2">
        <div className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5">
          <div className="text-[9px] font-medium uppercase tracking-wider text-slate-400">Fee</div>
          <AnimateNumber
            value={r.fee}
            format={(n) => `−${usd(n)}`}
            className="readout block text-sm font-semibold text-rose-600"
          />
        </div>
        <div className="rounded-lg border border-emerald-200 bg-emerald-50/60 px-2.5 py-1.5">
          <div className="text-[9px] font-medium uppercase tracking-wider text-emerald-600">You net</div>
          <AnimateNumber
            value={r.net}
            format={(n) => usd(n)}
            className="readout block text-sm font-semibold text-emerald-700"
          />
        </div>
      </div>

      {/* Spring-animated net% bar */}
      <div className="mt-2.5 flex h-1.5 overflow-hidden rounded-full bg-slate-200">
        <motion.div
          className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-400"
          animate={{ width: `${netPct}%` }}
          transition={{ type: 'spring', stiffness: 140, damping: 22, mass: 0.6 }}
        />
      </div>
      <p className="mt-1.5 text-[10px] text-slate-400">
        Domestic · 2.9% + $0.30 · you keep{' '}
        <AnimateNumber value={netPct} format={(n) => pct(n)} className="readout font-medium text-emerald-600" />{' '}
        · fee{' '}
        <AnimateNumber value={feePct} format={(n) => pct(n)} className="readout font-medium text-rose-500" />
      </p>
    </WidgetShell>
  );
}

/* ---------------------------------------------------------------
   2. FREELANCE — preset profession pills w/ live breakdown
   --------------------------------------------------------------- */
const FREELANCE_PRESETS = [
  { id: 'dev', label: 'Dev', income: 120000 },
  { id: 'design', label: 'Design', income: 90000 },
  { id: 'consult', label: 'Consult', income: 180000 },
] as const;

export function FreelanceMiniWidget() {
  const [active, setActive] = useState<string>('dev');
  const income = FREELANCE_PRESETS.find((p) => p.id === active)?.income ?? 90000;

  const r = useMemo(
    () =>
      computeFreelanceRate({
        targetTakeHome: income,
        businessExpenses: 12000,
        taxRate: 30,
        vacationDays: 25,
        weeklyBillableHours: 25,
      }),
    [income]
  );

  return (
    <WidgetShell>
      <div className="mb-3 flex flex-wrap gap-1.5">
        {FREELANCE_PRESETS.map((p) => {
          const isActive = active === p.id;
          return (
            <button
              key={p.id}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                setActive(p.id);
              }}
              onPointerDown={(e) => e.stopPropagation()}
              className={`relative rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                isActive ? 'text-white' : 'text-slate-500 hover:text-emerald-700'
              }`}
              aria-pressed={isActive}
            >
              {isActive && (
                <motion.span
                  layoutId="freelance-active-pill"
                  className="absolute inset-0 -z-10 rounded-full bg-emerald-600 shadow-sm"
                  transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                />
              )}
              {p.label}
            </button>
          );
        })}
      </div>
      <div className="flex items-center gap-2 text-sm">
        <span className="readout rounded-lg border border-slate-200 bg-white px-2 py-1 text-slate-700">
          {usd(income, 0)}
        </span>
        <span className="text-slate-400">→</span>
        <span className="readout rounded-lg border border-emerald-200 bg-emerald-50/60 px-2 py-1 font-bold text-emerald-700">
          <AnimateNumber value={r.hourlyRate} format={(n) => `${usd(n, 0)}/hr`} />
        </span>
      </div>
      <p className="mt-2 text-[10px] text-slate-400">
        Day <span className="readout">{usd(r.dayRate, 0)}</span> · Month{' '}
        <span className="readout">{usd(r.monthlyRate, 0)}</span> · 30% tax · 25h/wk
      </p>
    </WidgetShell>
  );
}

/* ---------------------------------------------------------------
   3. RUNWAY — animated SVG area chart
   --------------------------------------------------------------- */
export function RunwayMiniWidget() {
  const [cash, setCash] = useState(500000);
  const r = useMemo(
    () => computeRunway({ cash, grossBurn: 50000, mrr: 10000, growthRate: 8 }),
    [cash]
  );
  const limit = r.months !== null ? Math.min(r.points.length, r.months + 1) : 18;
  const pts = r.points.slice(0, Math.max(2, limit));
  const maxCash = Math.max(...pts.map((p) => p.cash), 1);

  const W = 220;
  const H = 48;
  const pad = 3;
  const xStep = (W - pad * 2) / Math.max(1, pts.length - 1);
  const y = (c: number) => pad + (H - pad * 2) * (1 - Math.max(0, c) / maxCash);

  const linePath = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${pad + i * xStep} ${y(p.cash)}`).join(' ');
  const areaPath = `${linePath} L ${pad + (pts.length - 1) * xStep} ${H - pad} L ${pad} ${H - pad} Z`;

  const months = r.months;
  const tone = months === null ? 'emerald' : months >= 18 ? 'emerald' : months >= 12 ? 'amber' : 'rose';
  const toneColor = tone === 'emerald' ? '#10B981' : tone === 'amber' ? '#F59E0B' : '#F43F5E';

  return (
    <WidgetShell>
      <div className="mb-2 flex items-baseline justify-between">
        <span className="text-[10px] font-medium uppercase tracking-wider text-slate-400">Starting cash</span>
        <AnimateNumber
          value={cash}
          format={(n) => usdCompact(n)}
          className="readout text-sm font-bold text-sky-600"
        />
      </div>

      <InteractiveSlider
        value={cash}
        onChange={setCash}
        min={100000}
        max={2000000}
        step={50000}
        ariaLabel="Runway starting cash"
      />

      <div className="mt-3 mb-1.5 flex items-baseline justify-between">
        <span className="text-[10px] font-medium uppercase tracking-wider text-slate-400">Cash trajectory</span>
        <span className="readout text-sm font-bold" style={{ color: toneColor }}>
          {months === null ? '∞' : `${months}mo`}
        </span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-12 w-full" preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <linearGradient id="runway-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={toneColor} stopOpacity="0.28" />
            <stop offset="100%" stopColor={toneColor} stopOpacity="0" />
          </linearGradient>
        </defs>
        <motion.path
          d={areaPath}
          fill="url(#runway-fill)"
          animate={{ d: areaPath }}
          transition={{ type: 'spring', stiffness: 120, damping: 24, mass: 0.7 }}
        />
        <motion.path
          d={linePath}
          fill="none"
          stroke={toneColor}
          strokeWidth="1.8"
          strokeLinejoin="round"
          strokeLinecap="round"
          animate={{ d: linePath }}
          transition={{ type: 'spring', stiffness: 120, damping: 24, mass: 0.7 }}
        />
      </svg>
      <p className="mt-1.5 text-[10px] text-slate-400">
        <span className="readout">{usdCompact(cash)}</span> cash · $50k burn · $10k MRR · +8%/mo
      </p>
    </WidgetShell>
  );
}

/* ---------------------------------------------------------------
   4. LLC vs C-CORP — dual-color comparison bars
   --------------------------------------------------------------- */
export function TaxMiniWidget() {
  const [profit, setProfit] = useState(200000);
  const r = useMemo(() => compareEntities(profit), [profit]);
  const maxRate = 40;
  const llcW = Math.min(100, (r.llc.effectiveRate / maxRate) * 100);
  const ccW = Math.min(100, (r.ccorp.effectiveRate / maxRate) * 100);
  const presets = [100000, 200000, 500000];

  return (
    <WidgetShell>
      <div className="mb-3 flex flex-wrap gap-1.5">
        {presets.map((p) => {
          const isActive = profit === p;
          return (
            <button
              key={p}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                setProfit(p);
              }}
              onPointerDown={(e) => e.stopPropagation()}
              className={`relative rounded-full px-2 py-0.5 text-xs font-medium transition-colors ${
                isActive ? 'text-white' : 'text-slate-500 hover:text-amber-700'
              }`}
              aria-pressed={isActive}
            >
              {isActive && (
                <motion.span
                  layoutId="tax-active-pill"
                  className="absolute inset-0 -z-10 rounded-full bg-amber-600 shadow-sm"
                  transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                />
              )}
              {usdCompact(p)}
            </button>
          );
        })}
      </div>

      <div className="mb-2">
        <div className="mb-1 flex justify-between text-[10px] font-medium">
          <span className="text-emerald-600">LLC</span>
          <AnimateNumber
            value={r.llc.effectiveRate}
            format={(n) => pct(n, 1)}
            className="readout text-emerald-700"
          />
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-slate-200">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-400"
            animate={{ width: `${llcW}%` }}
            transition={{ type: 'spring', stiffness: 140, damping: 22, mass: 0.6 }}
          />
        </div>
      </div>
      <div>
        <div className="mb-1 flex justify-between text-[10px] font-medium">
          <span className="text-amber-600">C-Corp</span>
          <AnimateNumber
            value={r.ccorp.effectiveRate}
            format={(n) => pct(n, 1)}
            className="readout text-amber-700"
          />
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-slate-200">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-amber-500 to-orange-400"
            animate={{ width: `${ccW}%` }}
            transition={{ type: 'spring', stiffness: 140, damping: 22, mass: 0.6 }}
          />
        </div>
      </div>
      <p className="mt-2 text-[10px] text-slate-400">
        Federal tax · <span className="readout">{usd(r.delta, 0)}</span> delta · winner:{' '}
        <span
          className={
            r.winner === 'llc'
              ? 'font-medium text-emerald-600'
              : r.winner === 'ccorp'
                ? 'font-medium text-amber-600'
                : 'text-slate-500'
          }
        >
          {r.winner === 'tie' ? 'tie' : r.winner.toUpperCase()}
        </span>
      </p>
    </WidgetShell>
  );
}

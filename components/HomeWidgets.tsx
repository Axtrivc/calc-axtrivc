'use client';

import { useMemo, useState } from 'react';
import { computeFee } from '@/lib/stripe';
import { computeFreelanceRate } from '@/lib/freelance';
import { computeRunway } from '@/lib/runway';
import { compareEntities } from '@/lib/tax';
import { usd, usdCompact, pct } from '@/lib/format';

/**
 * Live mini interactive widgets embedded directly in the homepage calculator
 * cards. Each runs the *real* calculation library so the preview is accurate,
 * and each is its own self-contained client component (SSG-safe).
 *
 * Shared visual language: compact, mono-numeric, glowing.
 */

/* ---------------------------------------------------------------
   1. STRIPE — live fee slider ($100 → $10,000)
   --------------------------------------------------------------- */
export function StripeMiniWidget() {
  const [amount, setAmount] = useState(1000);
  const r = useMemo(() => computeFee(amount, 'domestic'), [amount]);

  // slider position 0..1000 -> log scale over $100..$10,000
  const SLIDER_MAX = 1000;
  const MIN = 100;
  const MAX = 10000;
  const toPos = (v: number) =>
    Math.round(((Math.log(Math.max(MIN, v)) - Math.log(MIN)) / (Math.log(MAX) - Math.log(MIN))) * SLIDER_MAX);
  const fromPos = (p: number) => Math.round(Math.exp(Math.log(MIN) + (p / SLIDER_MAX) * (Math.log(MAX) - Math.log(MIN))));
  const pos = toPos(amount);

  const netPct = r.charge > 0 ? (r.net / r.charge) * 100 : 0;

  return (
    <div className="mt-4 rounded-lg border border-slate-800 bg-base-900/50 p-3">
      <div className="mb-2 flex items-baseline justify-between">
        <span className="font-mono text-[10px] uppercase tracking-wider text-slate-500">charge</span>
        <span className="readout text-sm font-bold text-cyan-300">{usd(amount)}</span>
      </div>
      <input
        type="range"
        min={0}
        max={SLIDER_MAX}
        value={pos}
        onChange={(e) => setAmount(fromPos(Number(e.target.value)))}
        className="cyber-slider"
        style={{ ['--fill' as string]: `${(pos / SLIDER_MAX) * 100}%` }}
        aria-label="Stripe charge amount"
      />
      <div className="mt-3 grid grid-cols-2 gap-2">
        <div className="rounded-md border border-rose-500/20 bg-rose-500/5 px-2.5 py-1.5">
          <div className="font-mono text-[9px] uppercase tracking-wide text-rose-400/80">Fee</div>
          <div className="readout text-sm font-semibold text-rose-300">−{usd(r.fee)}</div>
        </div>
        <div className="rounded-md border border-emerald-500/20 bg-emerald-500/5 px-2.5 py-1.5">
          <div className="font-mono text-[9px] uppercase tracking-wide text-emerald-400/80">You net</div>
          <div className="readout text-sm font-semibold text-emerald-300">{usd(r.net)}</div>
        </div>
      </div>
      {/* mini net% bar */}
      <div className="mt-2 flex h-1.5 overflow-hidden rounded-full bg-base-800">
        <div
          className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-300"
          style={{ width: `${netPct}%` }}
        />
      </div>
      <p className="mt-1.5 font-mono text-[9px] text-slate-600">
        DOMESTIC · 2.9% + $0.30 · keep {pct(netPct)}
      </p>
    </div>
  );
}

/* ---------------------------------------------------------------
   2. FREELANCE — preset profession buttons w/ live breakdown
   --------------------------------------------------------------- */
const FREELANCE_PRESETS = [
  { id: 'dev', label: 'Dev', income: 120000 },
  { id: 'design', label: 'Design', income: 90000 },
  { id: 'consult', label: 'Consult', income: 180000 },
];

export function FreelanceMiniWidget() {
  const [active, setActive] = useState('dev');
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
    <div className="mt-4 rounded-lg border border-slate-800 bg-base-900/50 p-3">
      <div className="mb-2.5 flex flex-wrap gap-1.5">
        {FREELANCE_PRESETS.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setActive(p.id)}
            className={`rounded-md px-2.5 py-1 font-mono text-[11px] font-medium transition ${
              active === p.id
                ? 'border border-emerald-500/60 bg-emerald-500/15 text-emerald-300 shadow-[0_0_10px_rgba(16,185,129,0.3)]'
                : 'border border-slate-700 bg-base-800/50 text-slate-400 hover:border-emerald-500/40 hover:text-emerald-300'
            }`}
            aria-pressed={active === p.id}
          >
            {p.label}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-2 font-mono text-xs">
        <span className="readout rounded-md bg-base-800/70 px-2 py-1 text-slate-300">{usd(income, 0)}</span>
        <span className="text-slate-600">→</span>
        <span className="readout rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 font-bold text-emerald-300">
          {usd(r.hourlyRate, 0)}/hr
        </span>
      </div>
      <p className="mt-2 font-mono text-[9px] text-slate-600">
        DAY {usd(r.dayRate, 0)} · MO {usd(r.monthlyRate, 0)} · 25% TAX · 25H/WK
      </p>
    </div>
  );
}

/* ---------------------------------------------------------------
   3. RUNWAY — animated SVG sparkline
   --------------------------------------------------------------- */
export function RunwayMiniWidget() {
  const r = useMemo(
    () => computeRunway({ cash: 500000, grossBurn: 50000, mrr: 10000, growthRate: 8 }),
    []
  );
  // take first ~runway+1 or 18 months
  const limit = r.months !== null ? Math.min(r.points.length, r.months + 1) : 18;
  const pts = r.points.slice(0, Math.max(2, limit));
  const maxCash = Math.max(...pts.map((p) => p.cash), 1);
  const minCash = 0;

  // build sparkline path in a 200x44 viewBox
  const W = 200;
  const H = 44;
  const pad = 3;
  const xStep = (W - pad * 2) / Math.max(1, pts.length - 1);
  const y = (cash: number) =>
    pad + (H - pad * 2) * (1 - (Math.max(minCash, cash) - minCash) / (maxCash - minCash || 1));

  const linePath = pts
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${pad + i * xStep} ${y(p.cash)}`)
    .join(' ');
  const areaPath = `${linePath} L ${pad + (pts.length - 1) * xStep} ${H - pad} L ${pad} ${H - pad} Z`;

  const months = r.months;
  const tone = months === null ? 'emerald' : months >= 18 ? 'emerald' : months >= 12 ? 'amber' : 'rose';
  const toneColor = tone === 'emerald' ? '#10B981' : tone === 'amber' ? '#F59E0B' : '#F43F5E';

  return (
    <div className="mt-4 rounded-lg border border-slate-800 bg-base-900/50 p-3">
      <div className="mb-1.5 flex items-baseline justify-between">
        <span className="font-mono text-[10px] uppercase tracking-wider text-slate-500">cash trajectory</span>
        <span className="readout text-sm font-bold" style={{ color: toneColor }}>
          {months === null ? '∞' : `${months}mo`}
        </span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-11 w-full" preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <linearGradient id="runway-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={toneColor} stopOpacity="0.35" />
            <stop offset="100%" stopColor={toneColor} stopOpacity="0" />
          </linearGradient>
          <filter id="runway-glow">
            <feGaussianBlur stdDeviation="1.2" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <path d={areaPath} fill="url(#runway-fill)" />
        <path
          d={linePath}
          fill="none"
          stroke={toneColor}
          strokeWidth="1.6"
          strokeLinejoin="round"
          strokeLinecap="round"
          filter="url(#runway-glow)"
          className="sparkline-path"
        />
      </svg>
      <p className="mt-1.5 font-mono text-[9px] text-slate-600">
        $500K CASH · $50K BURN · $10K MRR · +8%/MO
      </p>
    </div>
  );
}

/* ---------------------------------------------------------------
   4. LLC vs C-CORP — dual-color energy bar
   --------------------------------------------------------------- */
export function TaxMiniWidget() {
  const [profit, setProfit] = useState(200000);
  const r = useMemo(() => compareEntities(profit), [profit]);
  const maxRate = 40;
  const llcW = Math.min(100, (r.llc.effectiveRate / maxRate) * 100);
  const ccW = Math.min(100, (r.ccorp.effectiveRate / maxRate) * 100);
  const presets = [100000, 200000, 500000];

  return (
    <div className="mt-4 rounded-lg border border-slate-800 bg-base-900/50 p-3">
      <div className="mb-2 flex flex-wrap gap-1.5">
        {presets.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => setProfit(p)}
            className={`rounded-md px-2 py-0.5 font-mono text-[10px] font-medium transition ${
              profit === p
                ? 'border border-amber-500/60 bg-amber-500/15 text-amber-300'
                : 'border border-slate-700 bg-base-800/50 text-slate-400 hover:border-amber-500/40 hover:text-amber-300'
            }`}
            aria-pressed={profit === p}
          >
            {usdCompact(p)}
          </button>
        ))}
      </div>
      {/* LLC bar */}
      <div className="mb-1.5">
        <div className="mb-0.5 flex justify-between font-mono text-[9px]">
          <span className="text-emerald-400/80">LLC</span>
          <span className="readout text-emerald-300">{pct(r.llc.effectiveRate, 1)}</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-base-800">
          <div
            className="h-full rounded-full bg-gradient-to-r from-emerald-600 to-teal-400 shadow-[0_0_8px_rgba(16,185,129,0.5)] transition-all duration-500"
            style={{ width: `${llcW}%` }}
          />
        </div>
      </div>
      {/* C-Corp bar */}
      <div>
        <div className="mb-0.5 flex justify-between font-mono text-[9px]">
          <span className="text-amber-400/80">C-CORP</span>
          <span className="readout text-amber-300">{pct(r.ccorp.effectiveRate, 1)}</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-base-800">
          <div
            className="h-full rounded-full bg-gradient-to-r from-amber-600 to-orange-400 shadow-[0_0_8px_rgba(245,158,11,0.45)] transition-all duration-500"
            style={{ width: `${ccW}%` }}
          />
        </div>
      </div>
      <p className="mt-2 font-mono text-[9px] text-slate-600">
        FED TAX · {usd(r.delta, 0)} DELTA · WINNER:{' '}
        <span className={r.winner === 'llc' ? 'text-emerald-400' : r.winner === 'ccorp' ? 'text-amber-400' : 'text-slate-400'}>
          {r.winner === 'tie' ? 'TIE' : r.winner.toUpperCase()}
        </span>
      </p>
    </div>
  );
}

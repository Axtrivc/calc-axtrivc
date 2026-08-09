'use client';

import { useMemo, useState } from 'react';
import { computeFee } from '@/lib/stripe';
import { computeFreelanceRate } from '@/lib/freelance';
import { computeRunway } from '@/lib/runway';
import { compareEntities } from '@/lib/tax';
import { usd, usdCompact, pct } from '@/lib/format';

/**
 * Live mini interactive widgets embedded in the homepage calculator cards.
 * Each runs the real calculation library so the preview is accurate.
 *
 * Slider fluidity: the Stripe mini uses a NATIVE log-scale range input whose
 * exact float value is passed straight up (no value rounding), so dragging is
 * smooth and the result updates in real time.
 */

/* ---------------------------------------------------------------
   1. STRIPE — live fee slider ($100 → $10,000)
   --------------------------------------------------------------- */
export function StripeMiniWidget() {
  const [amount, setAmount] = useState(1000);
  const r = useMemo(() => computeFee(amount, 'domestic'), [amount]);

  // Log-scale native slider over $100..$10,000. Position (0..1000) ↔ value.
  // The value is never rounded on change → the thumb never fights the cursor.
  const MIN = 100;
  const MAX = 10000;
  const POS_MAX = 1000;
  const lmin = Math.log(MIN);
  const lmax = Math.log(MAX);
  const toPos = (v: number) =>
    Math.round(((Math.log(Math.max(MIN, Math.min(MAX, v))) - lmin) / (lmax - lmin)) * POS_MAX);
  const fromPos = (p: number) => Math.exp(lmin + (p / POS_MAX) * (lmax - lmin));
  const pos = toPos(amount);

  const netPct = r.charge > 0 ? (r.net / r.charge) * 100 : 0;

  return (
    <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50/60 p-3">
      <div className="mb-2 flex items-baseline justify-between">
        <span className="text-[10px] font-medium uppercase tracking-wide text-slate-400">Charge</span>
        <span className="readout text-sm font-bold text-indigo-600">{usd(amount)}</span>
      </div>
      <input
        type="range"
        min={0}
        max={POS_MAX}
        step={1}
        value={pos}
        onChange={(e) => setAmount(fromPos(Number(e.target.value)))}
        className="ws-slider"
        style={{ ['--fill' as string]: `${(pos / POS_MAX) * 100}%` }}
        aria-label="Stripe charge amount"
      />
      <div className="mt-3 grid grid-cols-2 gap-2">
        <div className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5">
          <div className="text-[9px] font-medium uppercase tracking-wide text-slate-400">Fee</div>
          <div className="readout text-sm font-semibold text-rose-600">−{usd(r.fee)}</div>
        </div>
        <div className="rounded-lg border border-emerald-200 bg-emerald-50/60 px-2.5 py-1.5">
          <div className="text-[9px] font-medium uppercase tracking-wide text-emerald-600">You net</div>
          <div className="readout text-sm font-semibold text-emerald-700">{usd(r.net)}</div>
        </div>
      </div>
      <div className="mt-2 flex h-1.5 overflow-hidden rounded-full bg-slate-200">
        <div
          className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-150"
          style={{ width: `${netPct}%` }}
        />
      </div>
      <p className="mt-1.5 text-[10px] text-slate-400">
        Domestic · 2.9% + $0.30 · you keep {pct(netPct)}
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
    <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50/60 p-3">
      <div className="mb-2.5 flex flex-wrap gap-1.5">
        {FREELANCE_PRESETS.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setActive(p.id)}
            className={`rounded-full px-2.5 py-1 text-xs font-medium transition ${
              active === p.id
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'bg-white text-slate-500 ring-1 ring-inset ring-slate-200 hover:text-emerald-700'
            }`}
            aria-pressed={active === p.id}
          >
            {p.label}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-2 text-sm">
        <span className="readout rounded-lg border border-slate-200 bg-white px-2 py-1 text-slate-700">{usd(income, 0)}</span>
        <span className="text-slate-400">→</span>
        <span className="readout rounded-lg border border-emerald-200 bg-emerald-50/60 px-2 py-1 font-bold text-emerald-700">
          {usd(r.hourlyRate, 0)}/hr
        </span>
      </div>
      <p className="mt-2 text-[10px] text-slate-400">
        Day {usd(r.dayRate, 0)} · Month {usd(r.monthlyRate, 0)} · 30% tax · 25h/wk
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
  const limit = r.months !== null ? Math.min(r.points.length, r.months + 1) : 18;
  const pts = r.points.slice(0, Math.max(2, limit));
  const maxCash = Math.max(...pts.map((p) => p.cash), 1);

  const W = 200;
  const H = 44;
  const pad = 3;
  const xStep = (W - pad * 2) / Math.max(1, pts.length - 1);
  const y = (cash: number) => pad + (H - pad * 2) * (1 - Math.max(0, cash) / maxCash);

  const linePath = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${pad + i * xStep} ${y(p.cash)}`).join(' ');
  const areaPath = `${linePath} L ${pad + (pts.length - 1) * xStep} ${H - pad} L ${pad} ${H - pad} Z`;

  const months = r.months;
  const tone = months === null ? 'emerald' : months >= 18 ? 'emerald' : months >= 12 ? 'amber' : 'rose';
  const toneColor = tone === 'emerald' ? '#10B981' : tone === 'amber' ? '#F59E0B' : '#F43F5E';

  return (
    <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50/60 p-3">
      <div className="mb-1.5 flex items-baseline justify-between">
        <span className="text-[10px] font-medium uppercase tracking-wide text-slate-400">Cash trajectory</span>
        <span className="readout text-sm font-bold" style={{ color: toneColor }}>
          {months === null ? '∞' : `${months}mo`}
        </span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-11 w-full" preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <linearGradient id="runway-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={toneColor} stopOpacity="0.25" />
            <stop offset="100%" stopColor={toneColor} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={areaPath} fill="url(#runway-fill)" />
        <path
          d={linePath}
          fill="none"
          stroke={toneColor}
          strokeWidth="1.8"
          strokeLinejoin="round"
          strokeLinecap="round"
          className="sparkline-path"
        />
      </svg>
      <p className="mt-1.5 text-[10px] text-slate-400">
        $500k cash · $50k burn · $10k MRR · +8%/mo
      </p>
    </div>
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
    <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50/60 p-3">
      <div className="mb-2 flex flex-wrap gap-1.5">
        {presets.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => setProfit(p)}
            className={`rounded-full px-2 py-0.5 text-xs font-medium transition ${
              profit === p
                ? 'bg-amber-600 text-white shadow-sm'
                : 'bg-white text-slate-500 ring-1 ring-inset ring-slate-200 hover:text-amber-700'
            }`}
            aria-pressed={profit === p}
          >
            {usdCompact(p)}
          </button>
        ))}
      </div>
      <div className="mb-1.5">
        <div className="mb-0.5 flex justify-between text-[10px] font-medium">
          <span className="text-emerald-600">LLC</span>
          <span className="readout text-emerald-700">{pct(r.llc.effectiveRate, 1)}</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-slate-200">
          <div
            className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-300"
            style={{ width: `${llcW}%` }}
          />
        </div>
      </div>
      <div>
        <div className="mb-0.5 flex justify-between text-[10px] font-medium">
          <span className="text-amber-600">C-Corp</span>
          <span className="readout text-amber-700">{pct(r.ccorp.effectiveRate, 1)}</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-slate-200">
          <div
            className="h-full rounded-full bg-gradient-to-r from-amber-500 to-orange-400 transition-all duration-300"
            style={{ width: `${ccW}%` }}
          />
        </div>
      </div>
      <p className="mt-2 text-[10px] text-slate-400">
        Federal tax · {usd(r.delta, 0)} delta · winner:{' '}
        <span className={r.winner === 'llc' ? 'text-emerald-600' : r.winner === 'ccorp' ? 'text-amber-600' : 'text-slate-500'}>
          {r.winner === 'tie' ? 'tie' : r.winner.toUpperCase()}
        </span>
      </p>
    </div>
  );
}

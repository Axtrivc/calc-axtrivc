'use client';

import { useMemo, useState } from 'react';
import { motion, useMotionValue } from 'framer-motion';
import { computeFee } from '@/lib/stripe';
import { computeFreelanceRate } from '@/lib/freelance';
import { computeRunway } from '@/lib/runway';
import { compareEntities } from '@/lib/tax';
import { compareScorp } from '@/lib/scorp';
import { computeEstimatedTax, type SafeHarborKind } from '@/lib/estimated';
import { solo401kCapacity, sepCapacity, RETIREMENT_CONSTANTS } from '@/lib/retirement';
import { computeSeTax } from '@/lib/setax';
import { computeQbiDeduction, taxValueOfDeduction, QBI_CONSTANTS } from '@/lib/qbi';
import { compareHomeOffice } from '@/lib/homeoffice';
import { breakevenContractRate, breakevenMarkup, PAYTYPE_DEFAULTS, w2Hourly } from '@/lib/paytype';
import { computeBreakEven, BREAKEVEN_PRESETS } from '@/lib/breakeven';
import {
  simulateCapTable,
  finalStage,
  foundersPct,
  founderPct,
  CAP_TABLE_PRESETS,
  ROUND_NAMES,
} from '@/lib/captable';
import { computeDiscount, DISCOUNT_PRESETS } from '@/lib/discount';
import { compareHsa } from '@/lib/hsa';
import { computeLatePayment, TERM_PRESETS } from '@/lib/latefee';
import { computeLtvCac, LTV_CAC_PRESETS, RATIO_HEALTHY } from '@/lib/ltvcac';
import {
  compareMileage,
  neutralMileage,
  MILEAGE_CONSTANTS_2025,
} from '@/lib/mileage';
import { evaluateIncomePath } from '@/lib/rdcredit';
import { compareRoth } from '@/lib/roth';
import { convertSafeStack, SAFE_PRESETS } from '@/lib/safe';
import { usd, usdCompact, pct, numFmt } from '@/lib/format';
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
      className="mt-5 rounded-xl border border-white/70 bg-white/40 p-3.5 backdrop-blur-md dark:border-white/[0.07] dark:bg-white/[0.03]"
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
        <span className="text-[10px] font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
          Charge amount
        </span>
        <AnimateNumber
          value={amount}
          format={(n) => usd(n)}
          className="readout text-sm font-semibold text-slate-900 dark:text-white"
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
        <div className="rounded-lg border border-white/70 bg-white/50 px-2.5 py-1.5 backdrop-blur dark:border-white/[0.07] dark:bg-white/[0.03]">
          <div className="text-[10px] font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">Fee</div>
          <AnimateNumber
            value={r.fee}
            format={(n) => `−${usd(n)}`}
            className="readout block text-sm font-semibold text-rose-600 dark:text-rose-400"
          />
        </div>
        <div className="rounded-lg border border-white/70 bg-white/50 px-2.5 py-1.5 backdrop-blur dark:border-white/[0.07] dark:bg-white/[0.03]">
          <div className="text-[10px] font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">You net</div>
          <AnimateNumber
            value={r.net}
            format={(n) => usd(n)}
            className="readout block text-sm font-semibold text-slate-900 dark:text-white"
          />
        </div>
      </div>

      {/* Glowing dual-tone net-vs-fee meter.
          Emerald = the share you keep; Rose = the share Stripe takes.
          Both segments are spring-animated and carry a soft glow for energy. */}
      <div className="mt-2.5 flex h-2 overflow-hidden rounded-full bg-slate-200/70 ring-1 ring-inset ring-white/60 dark:bg-white/[0.08] dark:ring-white/[0.05]">
        <motion.div
          className="relative h-full overflow-hidden rounded-l-full bg-gradient-to-r from-emerald-500 to-teal-400 shadow-[0_0_8px_rgba(16,185,129,0.5)]"
          animate={{ width: `${netPct}%` }}
          transition={{ type: 'spring', stiffness: 140, damping: 22, mass: 0.6 }}
        >
          {/* moving sheen for life */}
          <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/40 to-transparent" />
        </motion.div>
        <motion.div
          className="h-full rounded-r-full bg-gradient-to-r from-rose-400 to-rose-500 shadow-[inset_-1px_0_0_rgba(255,255,255,0.5)]"
          animate={{ width: `${feePct}%` }}
          transition={{ type: 'spring', stiffness: 140, damping: 22, mass: 0.6 }}
        />
      </div>
      <p className="mt-1.5 text-[10px] text-slate-500 dark:text-slate-400">
        Domestic · 2.9% + $0.30 · you keep{' '}
        <AnimateNumber value={netPct} format={(n) => pct(n)} className="readout font-medium text-emerald-700 dark:text-emerald-400" />{' '}
        · fee{' '}
        <AnimateNumber value={feePct} format={(n) => pct(n)} className="readout font-medium text-rose-600 dark:text-rose-400" />
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
              className={`focus-calm relative rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                isActive ? 'text-white' : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
              }`}
              aria-pressed={isActive}
            >
              {isActive && (
                <motion.span
                  layoutId="freelance-active-pill"
                  className="absolute inset-0 -z-10 rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 shadow-[0_4px_12px_rgba(16,185,129,0.35)]"
                  transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                />
              )}
              {p.label}
            </button>
          );
        })}
      </div>
      <div className="flex items-center gap-2 text-sm">
        <span className="readout rounded-lg border border-white/70 bg-white/60 px-2 py-1 text-slate-700 backdrop-blur dark:border-white/[0.08] dark:bg-white/[0.05] dark:text-slate-200">
          {usd(income, 0)}
        </span>
        <span className="text-emerald-500">→</span>
        <span className="readout rounded-lg border border-emerald-200/70 bg-emerald-50/60 px-2 py-1 font-semibold text-emerald-700 shadow-[0_0_12px_rgba(16,185,129,0.18)] backdrop-blur">
          <AnimateNumber value={r.hourlyRate} format={(n) => `${usd(n, 0)}/hr`} />
        </span>
      </div>
      <p className="mt-2 text-[10px] text-slate-500 dark:text-slate-400">
        Day <span className="readout text-slate-600 dark:text-slate-300">{usd(r.dayRate, 0)}</span> · Month{' '}
        <span className="readout text-slate-600 dark:text-slate-300">{usd(r.monthlyRate, 0)}</span> · 30% tax · 25h/wk
      </p>
    </WidgetShell>
  );
}

/* ---------------------------------------------------------------
   3. RUNWAY — animated SVG area chart
   --------------------------------------------------------------- */
export function RunwayMiniWidget() {
  const [cash, setCash] = useState(500000);
  const [hover, setHover] = useState<number | null>(null);
  const r = useMemo(
    () => computeRunway({ cash, grossBurn: 50000, mrr: 10000, growthRate: 8 }),
    [cash]
  );
  const limit = r.months !== null ? Math.min(r.points.length, r.months + 1) : 18;
  const pts = r.points.slice(0, Math.max(2, limit));
  const maxCash = Math.max(...pts.map((p) => p.cash), 1);

  const W = 240;
  const H = 58;
  const pad = 4;
  const xStep = (W - pad * 2) / Math.max(1, pts.length - 1);
  const y = (c: number) => pad + (H - pad * 2) * (1 - Math.max(0, c) / maxCash);
  const px = (i: number) => pad + i * xStep;

  const linePath = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${px(i)} ${y(p.cash)}`).join(' ');
  const areaPath = `${linePath} L ${px(pts.length - 1)} ${H - pad} L ${px(0)} ${H - pad} Z`;

  // Seed `d` with motion values so framer-motion always has a valid string
  // for it. With a plain string prop, the animate pipeline creates the `d`
  // motion value lazily with `undefined` (getValue maps its null default to
  // undefined) and a frame can then write d="undefined" to the DOM — the
  // console error this fixes. animate={{ d }} still drives the same spring
  // between path strings on slider drags.
  const lineD = useMotionValue(linePath);
  const areaD = useMotionValue(areaPath);

  const months = r.months;
  const tone = months === null ? 'emerald' : months >= 18 ? 'emerald' : months >= 12 ? 'amber' : 'rose';
  const toneColor = tone === 'emerald' ? '#10B981' : tone === 'amber' ? '#F59E0B' : '#F43F5E';
  const toneColor2 = tone === 'emerald' ? '#34D399' : tone === 'amber' ? '#FBBF24' : '#FB7185';

  const activeIdx = hover !== null ? Math.min(hover, pts.length - 1) : null;
  const activePt = activeIdx !== null ? pts[activeIdx] : null;

  return (
    <WidgetShell>
      <div className="mb-2 flex items-baseline justify-between">
        <span className="text-[10px] font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">Starting cash</span>
        <AnimateNumber
          value={cash}
          format={(n) => usdCompact(n)}
          className="readout text-sm font-semibold text-slate-900 dark:text-white"
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
        <span className="text-[10px] font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">Cash trajectory</span>
        <span className="readout text-sm font-semibold" style={{ color: toneColor }}>
          {months === null ? '∞' : `${months}mo`}
        </span>
      </div>
      <div className="relative">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="h-14 w-full"
          preserveAspectRatio="none"
          role="img"
          aria-label={`Cash trajectory over ${pts.length} months`}
        >
          <defs>
            <linearGradient id="runway-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={toneColor} stopOpacity="0.38" />
              <stop offset="100%" stopColor={toneColor} stopOpacity="0" />
            </linearGradient>
            <linearGradient id="runway-line" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor={toneColor2} />
              <stop offset="100%" stopColor={toneColor} />
            </linearGradient>
            {/* Soft glow under the line for the "energy" look. */}
            <filter id="runway-glow" x="-20%" y="-50%" width="140%" height="200%">
              <feGaussianBlur stdDeviation="1.6" result="b" />
              <feMerge>
                <feMergeNode in="b" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          {/* Zero-cash baseline — grounds the area so the sparkline reads as an
              instrument, not a floating ribbon. Non-scaling stroke survives the
              preserveAspectRatio="none" stretch. */}
          <line
            x1={pad}
            y1={H - pad}
            x2={W - pad}
            y2={H - pad}
            stroke="rgba(148,163,184,0.30)"
            strokeWidth="1"
            vectorEffect="non-scaling-stroke"
          />
          <motion.path
            d={areaD}
            fill="url(#runway-fill)"
            animate={{ d: areaPath }}
            transition={{ type: 'spring', stiffness: 120, damping: 24, mass: 0.7 }}
          />
          <motion.path
            d={lineD}
            fill="none"
            stroke="url(#runway-line)"
            strokeWidth="2"
            strokeLinejoin="round"
            strokeLinecap="round"
            filter="url(#runway-glow)"
            animate={{ d: linePath }}
            transition={{ type: 'spring', stiffness: 120, damping: 24, mass: 0.7 }}
          />
          {/* Hover marker on the active month */}
          {activePt && activeIdx !== null && (
            <g>
              <line
                x1={px(activeIdx)}
                x2={px(activeIdx)}
                y1={pad}
                y2={H - pad}
                stroke={toneColor}
                strokeWidth="1"
                strokeDasharray="2 2"
                opacity="0.5"
              />
              <circle cx={px(activeIdx)} cy={y(activePt.cash)} r="3.2" fill="#fff" stroke={toneColor} strokeWidth="1.6" />
            </g>
          )}
          {/* Invisible hover columns — one per month — drive the tooltip.
              stopPropagation keeps it isolated from the parent card link. */}
          {pts.map((_, i) => (
            <rect
              key={i}
              x={px(i) - xStep / 2}
              y={0}
              width={xStep}
              height={H}
              fill="transparent"
              onPointerEnter={(e) => {
                e.stopPropagation();
                setHover(i);
              }}
              onPointerDown={(e) => e.stopPropagation()}
              onPointerLeave={(e) => {
                e.stopPropagation();
                setHover(null);
              }}
            />
          ))}
        </svg>
        {/* Floating tooltip readout for the hovered month */}
        {activePt && activeIdx !== null && (
          <div
            className="pointer-events-none absolute -top-1 z-10 -translate-x-1/2 -translate-y-full rounded-md border border-white/80 bg-white/90 px-2 py-1 text-[10px] shadow-[0_4px_12px_rgba(15,23,42,0.12)] backdrop-blur dark:border-white/10 dark:bg-slate-800/95 dark:shadow-[0_4px_12px_rgba(0,0,0,0.5)]"
            style={{ left: `${(px(activeIdx) / W) * 100}%` }}
          >
            <span className="readout font-semibold" style={{ color: toneColor }}>
              {usdCompact(Math.max(0, activePt.cash))}
            </span>
            <span className="ml-1 text-slate-500 dark:text-slate-400">mo {activeIdx}</span>
          </div>
        )}
      </div>
      <p className="mt-1.5 text-[10px] text-slate-500 dark:text-slate-400">
        <span className="readout">{usdCompact(cash)}</span> cash · $50k burn · $10k MRR · +8%/mo
      </p>
    </WidgetShell>
  );
}

/* ---------------------------------------------------------------
   4. LLC vs C-CORP — side-by-side energy gauges
   --------------------------------------------------------------- */

/**
 * EnergyGauge — a semi-circular gauge that sweeps up to `max` and fills with a
 * glowing gradient. The value arc uses an SVG strokeDasharray so framer-motion
 * can spring-animate the dash offset, giving a fluid "needle fill" motion.
 */
function EnergyGauge({
  value,
  max,
  label,
  gradientId,
  from,
  to,
  textColor,
  ariaLabel,
}: {
  value: number;
  max: number;
  label: string;
  gradientId: string;
  from: string;
  to: string;
  textColor: string;
  ariaLabel: string;
}) {
  const pctVal = Math.max(0, Math.min(1, value / max));
  // Half-circle geometry
  const size = 76;
  const stroke = 8;
  const r = (size - stroke) / 2;
  const cx = size / 2;
  const cy = size / 2;
  // A semicircle from left (180°) to right (0°) along the top.
  const circumference = Math.PI * r; // half circle
  const targetDash = circumference * pctVal;

  return (
    <div className="flex flex-1 flex-col items-center">
      <div className="relative" style={{ width: size, height: size / 2 + 6 }}>
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          style={{ overflow: 'visible' }}
          role="img"
          aria-label={ariaLabel}
        >
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor={from} />
              <stop offset="100%" stopColor={to} />
            </linearGradient>
            <filter id={`${gradientId}-glow`} x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="1.6" result="b" />
              <feMerge>
                <feMergeNode in="b" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          {/* Track */}
          <path
            d={`M ${stroke / 2} ${cy} A ${r} ${r} 0 0 1 ${size - stroke / 2} ${cy}`}
            fill="none"
            stroke="rgba(148,163,184,0.28)"
            strokeWidth={stroke}
            strokeLinecap="round"
          />
          {/* Value arc — spring-animated fill */}
          <motion.path
            d={`M ${stroke / 2} ${cy} A ${r} ${r} 0 0 1 ${size - stroke / 2} ${cy}`}
            fill="none"
            stroke={`url(#${gradientId})`}
            strokeWidth={stroke}
            strokeLinecap="round"
            filter={`url(#${gradientId}-glow)`}
            initial={{ strokeDasharray: `0 ${circumference}` }}
            animate={{ strokeDasharray: `${targetDash} ${circumference}` }}
            transition={{ type: 'spring', stiffness: 120, damping: 20, mass: 0.7 }}
          />
        </svg>
        {/* Center readout sitting over the gauge */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col items-center">
          <AnimateNumber
            value={value}
            format={(n) => pct(n, 1)}
            className={`readout text-base font-bold ${textColor}`}
          />
        </div>
      </div>
      <span className={`mt-1 text-[10px] font-semibold uppercase tracking-wider ${textColor}`}>{label}</span>
    </div>
  );
}

export function TaxMiniWidget() {
  const [profit, setProfit] = useState(200000);
  const r = useMemo(() => compareEntities(profit), [profit]);
  const maxRate = 40;
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
              className={`focus-calm relative rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                isActive ? 'text-white' : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
              }`}
              aria-pressed={isActive}
            >
              {isActive && (
                <motion.span
                  layoutId="tax-active-pill"
                  className="absolute inset-0 -z-10 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 shadow-[0_4px_12px_rgba(245,158,11,0.35)]"
                  transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                />
              )}
              {usdCompact(p)}
            </button>
          );
        })}
      </div>

      <div className="flex items-start justify-center gap-3">
        <EnergyGauge
          value={r.llc.effectiveRate}
          max={maxRate}
          label="LLC"
          gradientId="gauge-llc"
          from="#34D399"
          to="#14B8A6"
          textColor="text-emerald-700 dark:text-emerald-400"
          ariaLabel={`LLC effective tax rate ${pct(r.llc.effectiveRate, 1)}`}
        />
        <EnergyGauge
          value={r.ccorp.effectiveRate}
          max={maxRate}
          label="C-Corp"
          gradientId="gauge-ccorp"
          from="#FBBF24"
          to="#FB923C"
          textColor="text-amber-700 dark:text-amber-400"
          ariaLabel={`C-Corp effective tax rate ${pct(r.ccorp.effectiveRate, 1)}`}
        />
      </div>
      <p className="mt-2 text-[10px] text-slate-500 dark:text-slate-400">
        Federal tax · <span className="readout text-slate-600 dark:text-slate-300">{usd(r.delta, 0)}</span> delta · winner:{' '}
        <span
          className={
            r.winner === 'llc'
              ? 'font-medium text-emerald-700 dark:text-emerald-400'
                : r.winner === 'ccorp'
                  ? 'font-medium text-amber-700 dark:text-amber-400'
                  : 'text-slate-500 dark:text-slate-400'
          }
        >
          {r.winner === 'tie' ? 'tie' : r.winner.toUpperCase()}
        </span>
      </p>
    </WidgetShell>
  );
}

/* ---------------------------------------------------------------
   5. S-CORP — LLC vs S-Corp net-income bars at a 40% salary policy
   --------------------------------------------------------------- */
export function ScorpMiniWidget() {
  const [profit, setProfit] = useState(200000);
  // Salary policy fixed at 40% of profit for the preview — the full tool lets
  // you drag it; a card preview should show one honest, defensible scenario.
  const r = useMemo(() => compareScorp(profit, profit * 0.4, 1200), [profit]);
  const presets = [80000, 150000, 250000, 500000];
  const maxNet = Math.max(r.llc.afterTax, r.scorp.afterTax, 1);

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
              className={`focus-calm relative rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                isActive ? 'text-white' : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
              }`}
              aria-pressed={isActive}
            >
              {isActive && (
                <motion.span
                  layoutId="scorp-active-pill"
                  className="absolute inset-0 -z-10 rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 shadow-[0_4px_12px_rgba(16,185,129,0.35)]"
                  transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                />
              )}
              {usdCompact(p)}
            </button>
          );
        })}
      </div>

      <div className="space-y-2">
        <MiniBar
          label="LLC"
          value={r.llc.afterTax}
          max={maxNet}
          barClass="from-sky-500 to-cyan-400"
        />
        <MiniBar
          label="S-Corp"
          value={r.scorp.afterTax}
          max={maxNet}
          barClass="from-emerald-500 to-teal-400"
        />
      </div>

      <p className="mt-2 text-[10px] text-slate-500 dark:text-slate-400">
        You keep, after federal tax · salary = 40% of profit ·{' '}
        <span className={`readout font-semibold ${r.winner === 'scorp' ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-600 dark:text-slate-300'}`}>
          {r.winner === 'scorp' ? '+' : '−'}
          {usd(r.delta, 0)}/yr
        </span>{' '}
        for the S-Corp
      </p>
    </WidgetShell>
  );
}

/* ---------------------------------------------------------------
   6. QUARTERLY ESTIMATED TAX — the four installments under the
      binding safe harbor
   --------------------------------------------------------------- */
const EST_HARBOR_LABEL: Record<SafeHarborKind, string> = {
  prior100: '100% prior-year safe harbor',
  prior110: '110% prior-year safe harbor',
  current90: '90% current-year safe harbor',
};

export function EstimatedTaxMiniWidget() {
  const [netSE, setNetSE] = useState(100000);
  // The estimated-tax tool's default posture: single filer, no W-2
  // withholding, $19,500 prior-year tax → both harbors in play.
  const r = useMemo(
    () =>
      computeEstimatedTax({
        netSE,
        filingStatus: 'single',
        w2Withholding: 0,
        priorTax: 19500,
        priorAgiOver150k: false,
      }),
    [netSE],
  );

  return (
    <WidgetShell>
      <div className="mb-2.5 flex items-baseline justify-between">
        <span className="text-[10px] font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
          Net SE income
        </span>
        <AnimateNumber
          value={netSE}
          format={(n) => usdCompact(n)}
          className="readout text-sm font-semibold text-slate-900 dark:text-white"
        />
      </div>

      <InteractiveSlider
        value={netSE}
        onChange={setNetSE}
        min={30000}
        max={400000}
        step={5000}
        ariaLabel="Net self-employment income"
      />

      <div className="mt-3 grid grid-cols-4 gap-1.5">
        {r.quarterly.map((q) => (
          <div
            key={q.label}
            className="rounded-lg border border-white/70 bg-white/50 px-1.5 py-1.5 backdrop-blur dark:border-white/[0.07] dark:bg-white/[0.03]"
          >
            <div className="text-[10px] font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
              {q.label}
            </div>
            <AnimateNumber
              value={q.installment}
              format={(n) => usd(n, 0)}
              className="readout block text-[13px] font-semibold leading-tight text-slate-900 dark:text-white"
            />
          </div>
        ))}
      </div>

      <p className="mt-2 text-[10px] text-slate-500 dark:text-slate-400">
        Per quarter under the{' '}
        <span className="font-medium text-slate-600 dark:text-slate-300">{EST_HARBOR_LABEL[r.applicable]}</span> ·
        year&apos;s tax{' '}
        <AnimateNumber
          value={r.currentTotalTax}
          format={(n) => usd(n, 0)}
          className="readout font-medium text-slate-600 dark:text-slate-300"
        />{' '}
        · skip all four ≈{' '}
        <AnimateNumber
          value={r.penaltyEstimate}
          format={(n) => usd(n, 0)}
          className="readout font-medium text-rose-600 dark:text-rose-400"
        />{' '}
        penalty
      </p>
    </WidgetShell>
  );
}

/* ---------------------------------------------------------------
   7. SOLO 401(k) VS SEP-IRA — plan-capacity bars on Schedule C profit
   --------------------------------------------------------------- */
export function RetirementMiniWidget() {
  const [income, setIncome] = useState(200000);
  // Age 45 (no catch-up), deferring the full §402(g) limit, sole proprietor —
  // the retirement tool's default posture.
  const { solo, sep } = useMemo(
    () => ({
      solo: solo401kCapacity({
        mode: 'sole-prop',
        income,
        age: 45,
        plannedDeferral: RETIREMENT_CONSTANTS.employeeDeferralLimit,
      }),
      sep: sepCapacity('sole-prop', income),
    }),
    [income],
  );
  const maxCap = Math.max(solo.total, sep.contribution, 1);

  return (
    <WidgetShell>
      <div className="mb-2.5 flex items-baseline justify-between">
        <span className="text-[10px] font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
          Schedule C profit
        </span>
        <AnimateNumber
          value={income}
          format={(n) => usdCompact(n)}
          className="readout text-sm font-semibold text-slate-900 dark:text-white"
        />
      </div>

      <InteractiveSlider
        value={income}
        onChange={setIncome}
        min={50000}
        max={500000}
        step={5000}
        ariaLabel="Schedule C net profit"
      />

      <div className="mt-3 space-y-2">
        <MiniBar label="Solo 401(k)" value={solo.total} max={maxCap} barClass="from-emerald-500 to-teal-400" />
        <MiniBar label="SEP-IRA" value={sep.contribution} max={maxCap} barClass="from-sky-500 to-cyan-400" />
      </div>

      <p className="mt-2 text-[10px] text-slate-500 dark:text-slate-400">
        2025 limits · age 45 · sole proprietor ·{' '}
        <span className="readout font-semibold text-emerald-700 dark:text-emerald-400">
          +{usd(solo.total - sep.contribution, 0)}
        </span>{' '}
        more room in the Solo 401(k)
      </p>
    </WidgetShell>
  );
}

/* ---------------------------------------------------------------
   8. SELF-EMPLOYMENT TAX — layered SS / Medicare / 0.9% meter
   --------------------------------------------------------------- */
export function SeTaxMiniWidget() {
  const [profit, setProfit] = useState(120000);
  // Tax year 2026, single, no W-2 wages — the SE-tax tool's defaults.
  const r = useMemo(() => computeSeTax(profit, 0, 'single', 2026), [profit]);
  const total = Math.max(r.totalSeTax, 1e-9);
  const layers = [
    { key: 'ss', label: 'Social Security', value: r.ssPart, dot: 'bg-sky-500' },
    { key: 'medicare', label: 'Medicare', value: r.medicarePart, dot: 'bg-violet-500' },
    { key: 'addl', label: 'Additional Medicare', value: r.additionalPart, dot: 'bg-amber-400' },
  ];

  return (
    <WidgetShell>
      <div className="mb-2.5 flex items-baseline justify-between">
        <span className="text-[10px] font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
          Net Schedule C profit
        </span>
        <AnimateNumber
          value={profit}
          format={(n) => usdCompact(n)}
          className="readout text-sm font-semibold text-slate-900 dark:text-white"
        />
      </div>

      <InteractiveSlider
        value={profit}
        onChange={setProfit}
        min={10000}
        max={400000}
        logarithmic
        ariaLabel="Net Schedule C profit"
      />

      <div className="mt-3 mb-1.5 flex items-baseline justify-between">
        <span className="text-[10px] font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
          SE tax · 2026
        </span>
        <AnimateNumber
          value={r.totalSeTax}
          format={(n) => usd(n, 0)}
          className="readout text-sm font-semibold text-slate-900 dark:text-white"
        />
      </div>

      <div
        className="flex h-2 overflow-hidden rounded-full bg-slate-200/70 ring-1 ring-inset ring-white/60 dark:bg-white/[0.08] dark:ring-white/[0.05]"
        role="img"
        aria-label={`Self-employment tax layers: Social Security ${usd(r.ssPart, 0)}, Medicare ${usd(r.medicarePart, 0)}`}
      >
        {layers.map((l) => (
          <motion.div
            key={l.key}
            className={
              l.key === 'ss'
                ? 'h-full bg-gradient-to-r from-sky-500 to-cyan-400'
                : l.key === 'medicare'
                  ? 'h-full bg-gradient-to-r from-violet-500 to-purple-400'
                  : 'h-full bg-gradient-to-r from-amber-400 to-orange-500'
            }
            animate={{ width: `${Math.max(0, (l.value / total) * 100)}%` }}
            transition={{ type: 'spring', stiffness: 140, damping: 22, mass: 0.6 }}
          />
        ))}
      </div>

      <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-slate-500 dark:text-slate-400">
        {layers
          .filter((l) => l.value > 0.005)
          .map((l) => (
            <span key={l.key} className="inline-flex items-center gap-1">
              <span className={`inline-block h-1.5 w-1.5 rounded-full ${l.dot}`} aria-hidden="true" />
              {l.label}{' '}
              <span className="readout text-slate-600 dark:text-slate-300">{usd(l.value, 0)}</span>
            </span>
          ))}
      </div>
      <p className="mt-1 text-[10px] text-slate-500 dark:text-slate-400">
        Effective{' '}
        <AnimateNumber
          value={r.effectiveRateOnNet}
          format={(n) => pct(n)}
          className="readout font-medium text-slate-600 dark:text-slate-300"
        />{' '}
        of net · deductible half{' '}
        <AnimateNumber
          value={r.halfDeduction}
          format={(n) => usd(n, 0)}
          className="readout font-medium text-slate-600 dark:text-slate-300"
        />{' '}
        · SS cap {usdCompact(r.ssWageBase)}
      </p>
    </WidgetShell>
  );
}

/* ---------------------------------------------------------------
   9. QBI — the §199A deduction as taxable income sweeps the
      phase-out band, SSTB vs not
   --------------------------------------------------------------- */
const QBI_TOGGLE = [
  { id: 'non-sstb', label: 'Non-SSTB', sstb: false },
  { id: 'sstb', label: 'SSTB', sstb: true },
] as const;

export function QbiMiniWidget() {
  const [ti, setTi] = useState(220000);
  const [sstb, setSstb] = useState(false);
  // The QBI tool's defaults: $150k QBI, $40k W-2 wages, single filer — held
  // fixed while the card sweeps taxable income through the phase-out band.
  const r = useMemo(
    () =>
      computeQbiDeduction({
        qbi: 150000,
        taxableIncome: ti,
        w2Wages: 40000,
        ubia: 0,
        sstb,
        filingStatus: 'single',
      }),
    [ti, sstb],
  );
  const full = 150000 * QBI_CONSTANTS.qbiRate; // the no-limit 20% × QBI benchmark
  const barPct = Math.max(0, Math.min(100, (r.deduction / Math.max(full, 1e-9)) * 100));
  const taxValue = taxValueOfDeduction(ti, r.deduction, 'single');

  return (
    <WidgetShell>
      <div className="mb-3 flex flex-wrap gap-1.5">
        {QBI_TOGGLE.map((p) => {
          const isActive = sstb === p.sstb;
          return (
            <button
              key={p.id}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                setSstb(p.sstb);
              }}
              onPointerDown={(e) => e.stopPropagation()}
              className={`focus-calm relative rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                isActive ? 'text-white' : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
              }`}
              aria-pressed={isActive}
            >
              {isActive && (
                <motion.span
                  layoutId="qbi-active-pill"
                  className="absolute inset-0 -z-10 rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 shadow-[0_4px_12px_rgba(99,102,241,0.35)]"
                  transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                />
              )}
              {p.label}
            </button>
          );
        })}
      </div>

      <div className="mb-2.5 flex items-baseline justify-between">
        <span className="text-[10px] font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
          Taxable income
        </span>
        <AnimateNumber
          value={ti}
          format={(n) => usdCompact(n)}
          className="readout text-sm font-semibold text-slate-900 dark:text-white"
        />
      </div>

      <InteractiveSlider
        value={ti}
        onChange={setTi}
        min={150000}
        max={320000}
        step={1000}
        ariaLabel="Taxable income before the QBI deduction"
      />

      <div className="mt-3 mb-1.5 flex items-baseline justify-between">
        <span className="text-[10px] font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
          §199A deduction
        </span>
        <AnimateNumber
          value={r.deduction}
          format={(n) => usd(n, 0)}
          className="readout text-sm font-semibold text-slate-900 dark:text-white"
        />
      </div>

      <div
        className="h-2 overflow-hidden rounded-full bg-slate-200/70 ring-1 ring-inset ring-white/60 dark:bg-white/[0.08] dark:ring-white/[0.05]"
        role="img"
        aria-label={`Deduction ${usd(r.deduction, 0)} of the ${usd(full, 0)} wage-free benchmark`}
      >
        <motion.div
          className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-400 shadow-[0_0_8px_rgba(16,185,129,0.5)]"
          animate={{ width: `${barPct}%` }}
          transition={{ type: 'spring', stiffness: 140, damping: 22, mass: 0.6 }}
        />
      </div>
      <p className="mt-1.5 text-[10px] text-slate-500 dark:text-slate-400">
        Worth ≈{' '}
        <AnimateNumber
          value={taxValue}
          format={(n) => usd(n, 0)}
          className="readout font-medium text-emerald-700 dark:text-emerald-400"
        />{' '}
        in federal tax · QBI {usdCompact(150000)} · wages {usdCompact(40000)} · single
      </p>
    </WidgetShell>
  );
}

/* ---------------------------------------------------------------
   10. HOME OFFICE — simplified vs actual-method deduction bars
   --------------------------------------------------------------- */
export function HomeOfficeMiniWidget() {
  const [officeSqFt, setOfficeSqFt] = useState(200);
  // Renter profile matching the home-office tool's defaults: 1,800 sq ft home,
  // $1,800/mo rent, $3,800/yr operating costs, 24% bracket, SE layer on.
  const r = useMemo(
    () =>
      compareHomeOffice(
        {
          homeSqFt: 1800,
          officeSqFt,
          tenure: 'rent',
          rent: 21600,
          mortgageInterest: 0,
          propertyTax: 0,
          homeBasis: 0,
          utilities: 2400,
          insurance: 600,
          repairs: 800,
        },
        24,
        true,
      ),
    [officeSqFt],
  );
  const maxD = Math.max(r.simplified.deduction, r.actual.deduction, 1);

  return (
    <WidgetShell>
      <div className="mb-2.5 flex items-baseline justify-between">
        <span className="text-[10px] font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
          Office size
        </span>
        <AnimateNumber
          value={officeSqFt}
          format={(n) => `${numFmt(n)} sq ft`}
          className="readout text-sm font-semibold text-slate-900 dark:text-white"
        />
      </div>

      <InteractiveSlider
        value={officeSqFt}
        onChange={setOfficeSqFt}
        min={50}
        max={600}
        step={10}
        ariaLabel="Office square footage"
      />

      <div className="mt-3 space-y-2">
        <MiniBar label="Simple" value={r.simplified.deduction} max={maxD} barClass="from-sky-500 to-cyan-400" />
        <MiniBar label="Actual" value={r.actual.deduction} max={maxD} barClass="from-emerald-500 to-teal-400" />
      </div>

      <p className="mt-2 text-[10px] text-slate-500 dark:text-slate-400">
        Simplified $5/sq ft vs actual expenses · renter ·{' '}
        <span className="readout font-semibold text-emerald-700 dark:text-emerald-400">
          {r.winner === 'simplified' ? '−' : '+'}
          {usd(Math.abs(r.deductionDelta), 0)}
        </span>{' '}
        deduction,{' '}
        <span className="readout font-semibold text-emerald-700 dark:text-emerald-400">
          {r.winner === 'simplified' ? '−' : '+'}
          {usd(Math.abs(r.savingDelta), 0)}
        </span>{' '}
        tax at 24% incl. SE
      </p>
    </WidgetShell>
  );
}

/* ---------------------------------------------------------------
   11. 1099 vs W-2 — the breakeven contract rate for a salary
   --------------------------------------------------------------- */
const PAYTYPE_SALARIES = [75000, 100000, 150000];

export function PayTypeMiniWidget() {
  const [salary, setSalary] = useState(100000);
  // Everything else at the pay-type tool's defaults: $65/hr quote, 15 PTO
  // days, $7.5k health + $3k match + $500 other benefits, $2k expenses.
  const { rate, markup } = useMemo(() => {
    const inputs = { ...PAYTYPE_DEFAULTS, salary };
    const rate = breakevenContractRate(inputs);
    return { rate, markup: breakevenMarkup(salary, rate) };
  }, [salary]);
  const benefits =
    PAYTYPE_DEFAULTS.healthPremium + PAYTYPE_DEFAULTS.retirementMatch + PAYTYPE_DEFAULTS.otherBenefits;

  return (
    <WidgetShell>
      <div className="mb-3 flex flex-wrap gap-1.5">
        {PAYTYPE_SALARIES.map((p) => {
          const isActive = salary === p;
          return (
            <button
              key={p}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                setSalary(p);
              }}
              onPointerDown={(e) => e.stopPropagation()}
              className={`focus-calm relative rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                isActive ? 'text-white' : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
              }`}
              aria-pressed={isActive}
            >
              {isActive && (
                <motion.span
                  layoutId="paytype-active-pill"
                  className="absolute inset-0 -z-10 rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 shadow-[0_4px_12px_rgba(99,102,241,0.35)]"
                  transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                />
              )}
              {usdCompact(p)}
            </button>
          );
        })}
      </div>

      <div className="mb-1.5 flex items-baseline justify-between">
        <span className="text-[10px] font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
          Breakeven 1099 rate
        </span>
        {rate === null ? (
          <span className="readout text-sm font-semibold text-slate-900 dark:text-white">—</span>
        ) : (
          <AnimateNumber
            value={rate}
            format={(n) => `${usd(n)}/hr`}
            className="readout text-sm font-semibold text-slate-900 dark:text-white"
          />
        )}
      </div>
      <p className="text-[10px] text-slate-500 dark:text-slate-400">
        vs <span className="readout text-slate-600 dark:text-slate-300">{usd(w2Hourly(salary))}/hr</span> salaried
        {markup !== null && (
          <>
            {' '}
            · quote{' '}
            <span className="readout font-medium text-indigo-600 dark:text-indigo-400">+{pct(markup)}</span> or the
            contract loses
          </>
        )}
      </p>
      <p className="mt-1 text-[10px] text-slate-500 dark:text-slate-400">
        {usdCompact(benefits)} benefits at face · {PAYTYPE_DEFAULTS.ptoDays} PTO days unpaid on 1099
      </p>
    </WidgetShell>
  );
}

/* ---------------------------------------------------------------
   12. BREAK-EVEN — unit target per business archetype, with the
       loss wedge vs profit zone meter
   --------------------------------------------------------------- */
const BE_LABELS: Record<string, string> = { saas: 'SaaS', product: 'Product', service: 'Service' };

export function BreakEvenMiniWidget() {
  const [id, setId] = useState('saas');
  const preset = BREAKEVEN_PRESETS.find((p) => p.id === id) ?? BREAKEVEN_PRESETS[0];
  const r = useMemo(() => computeBreakEven(preset.inputs), [preset]);
  const be = r.breakEvenUnits;
  const current = preset.inputs.currentUnits;
  const lossShare = be === null || current <= 0 ? 100 : Math.min(100, (be / current) * 100);

  return (
    <WidgetShell>
      <div className="mb-3 flex flex-wrap gap-1.5">
        {BREAKEVEN_PRESETS.map((p) => {
          const isActive = p.id === id;
          return (
            <button
              key={p.id}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                setId(p.id);
              }}
              onPointerDown={(e) => e.stopPropagation()}
              className={`focus-calm relative rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                isActive ? 'text-white' : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
              }`}
              aria-pressed={isActive}
            >
              {isActive && (
                <motion.span
                  layoutId="breakeven-active-pill"
                  className="absolute inset-0 -z-10 rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 shadow-[0_4px_12px_rgba(99,102,241,0.35)]"
                  transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                />
              )}
              {BE_LABELS[p.id] ?? p.label}
            </button>
          );
        })}
      </div>

      <div className="mb-1.5 flex items-baseline justify-between">
        <span className="text-[10px] font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
          Break-even
        </span>
        <span className="readout text-sm font-semibold text-slate-900 dark:text-white">
          {be === null ? 'n/a' : <AnimateNumber value={be} format={(n) => `${numFmt(n, 0)} units`} />}
        </span>
      </div>

      <div
        className="flex h-2 overflow-hidden rounded-full bg-slate-200/70 ring-1 ring-inset ring-white/60 dark:bg-white/[0.08] dark:ring-white/[0.05]"
        role="img"
        aria-label={`Loss wedge ${lossShare.toFixed(0)}% of current volume; margin of safety ${
          r.marginOfSafetyPct === null ? 'n/a' : pct(r.marginOfSafetyPct)
        }`}
      >
        <motion.div
          className="h-full bg-gradient-to-r from-rose-400 to-rose-500"
          animate={{ width: `${lossShare}%` }}
          transition={{ type: 'spring', stiffness: 140, damping: 22, mass: 0.6 }}
        />
        <motion.div
          className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 shadow-[0_0_8px_rgba(16,185,129,0.5)]"
          animate={{ width: `${100 - lossShare}%` }}
          transition={{ type: 'spring', stiffness: 140, damping: 22, mass: 0.6 }}
        />
      </div>
      <p className="mt-1.5 text-[10px] text-slate-500 dark:text-slate-400">
        <span className="readout text-slate-600 dark:text-slate-300">{usd(r.contributionMargin)}</span> contribution
        per unit ({r.cmRatioPct === null ? '—' : pct(r.cmRatioPct)}) · {usdCompact(r.breakEvenRevenue ?? 0)} revenue
        · margin of safety{' '}
        <span
          className={`readout font-medium ${
            r.status === 'below-be' ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-700 dark:text-emerald-400'
          }`}
        >
          {r.marginOfSafetyPct === null ? '—' : pct(r.marginOfSafetyPct)}
        </span>
      </p>
    </WidgetShell>
  );
}

/* ---------------------------------------------------------------
   13. CAP TABLE — founder ownership surviving the round chain
   --------------------------------------------------------------- */
const CAP_LABELS: Record<string, string> = {
  standard: 'Standard',
  friendly: 'Friendly',
  heavy: 'Heavy',
  'seed-only': 'Seed only',
};

export function CapTableMiniWidget() {
  const [id, setId] = useState('standard');
  const preset = CAP_TABLE_PRESETS.find((p) => p.id === id) ?? CAP_TABLE_PRESETS[0];
  const sim = useMemo(() => {
    const founders = preset.founders.map((f, i) => ({
      name: i === 0 ? 'You' : `Cofounder ${i}`,
      shares: f.shares,
    }));
    const rounds = preset.rounds.map((r, i) => ({ ...r, name: ROUND_NAMES[i] }));
    return simulateCapTable(founders, rounds);
  }, [preset]);
  const last = finalStage(sim);
  const foundersFinal = Math.max(0, Math.min(100, last ? foundersPct(last) : 0));
  const raised = sim.stages.reduce((a, s) => a + (s.round?.investment ?? 0), 0);

  return (
    <WidgetShell>
      <div className="mb-3 flex flex-wrap gap-1.5">
        {CAP_TABLE_PRESETS.map((p) => {
          const isActive = p.id === id;
          return (
            <button
              key={p.id}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                setId(p.id);
              }}
              onPointerDown={(e) => e.stopPropagation()}
              className={`focus-calm relative rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                isActive ? 'text-white' : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
              }`}
              aria-pressed={isActive}
            >
              {isActive && (
                <motion.span
                  layoutId="captable-active-pill"
                  className="absolute inset-0 -z-10 rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 shadow-[0_4px_12px_rgba(99,102,241,0.35)]"
                  transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                />
              )}
              {CAP_LABELS[p.id] ?? p.label}
            </button>
          );
        })}
      </div>

      <div className="mb-1.5 flex items-baseline justify-between">
        <span className="text-[10px] font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
          Founders after dilution
        </span>
        <AnimateNumber
          value={foundersFinal}
          format={(n) => pct(n, 1)}
          className="readout text-sm font-semibold text-slate-900 dark:text-white"
        />
      </div>

      <div
        className="flex h-2 overflow-hidden rounded-full bg-slate-200/70 ring-1 ring-inset ring-white/60 dark:bg-white/[0.08] dark:ring-white/[0.05]"
        role="img"
        aria-label={`Founders hold ${pct(foundersFinal, 1)}; investors and pool hold ${pct(100 - foundersFinal, 1)}`}
      >
        <motion.div
          className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 shadow-[0_0_8px_rgba(16,185,129,0.5)]"
          animate={{ width: `${foundersFinal}%` }}
          transition={{ type: 'spring', stiffness: 140, damping: 22, mass: 0.6 }}
        />
        <motion.div
          className="h-full bg-gradient-to-r from-sky-500 to-indigo-400"
          animate={{ width: `${100 - foundersFinal}%` }}
          transition={{ type: 'spring', stiffness: 140, damping: 22, mass: 0.6 }}
        />
      </div>
      <p className="mt-1.5 text-[10px] text-slate-500 dark:text-slate-400">
        After {sim.modeledRounds} {sim.modeledRounds === 1 ? 'round' : 'rounds'} · {usdCompact(raised)} raised · You
        keep{' '}
        <span className="readout font-medium text-emerald-700 dark:text-emerald-400">
          {pct(last ? founderPct(last, 0) : 0, 1)}
        </span>
      </p>
    </WidgetShell>
  );
}

/* ---------------------------------------------------------------
   14. DISCOUNT IMPACT — the volume a price cut must buy: the
       revenue-neutral floor vs the profit-neutral requirement
   --------------------------------------------------------------- */
// The discount tool's default preset (the $89 gadget at $41 landed COGS,
// 300 units/mo) held fixed while the card sweeps the discount depth.
const DISCOUNT_FIXED = {
  price: DISCOUNT_PRESETS[1].inputs.price,
  unitCost: DISCOUNT_PRESETS[1].inputs.unitCost,
  volume: DISCOUNT_PRESETS[1].inputs.volume,
};

export function DiscountMiniWidget() {
  const [discountPct, setDiscountPct] = useState(20);
  const r = useMemo(() => computeDiscount({ ...DISCOUNT_FIXED, discountPct }), [discountPct]);
  // At the fixed 54% gross margin a 5–40% cut always stays recoverable
  // (d < gm), so the profit-neutral uplift is finite across the whole slider.
  const erosion = r.unitMarginErosionPct ?? 0;

  return (
    <WidgetShell>
      <div className="mb-2.5 flex items-baseline justify-between">
        <span className="text-[10px] font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
          Discount depth
        </span>
        <AnimateNumber
          value={discountPct}
          format={(n) => pct(n, 0)}
          className="readout text-sm font-semibold text-slate-900 dark:text-white"
        />
      </div>

      <InteractiveSlider
        value={discountPct}
        onChange={setDiscountPct}
        min={5}
        max={40}
        step={5}
        ariaLabel="Discount depth as a percentage of price"
      />

      <div className="mt-3 grid grid-cols-2 gap-2">
        <div className="rounded-lg border border-white/70 bg-white/50 px-2.5 py-1.5 backdrop-blur dark:border-white/[0.07] dark:bg-white/[0.03]">
          <div className="text-[10px] font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Revenue floor
          </div>
          <AnimateNumber
            value={r.revenueNeutralUpliftPct}
            format={(n) => `+${n.toFixed(0)}%`}
            className="readout block text-sm font-semibold text-sky-700 dark:text-sky-400"
          />
        </div>
        <div className="rounded-lg border border-white/70 bg-white/50 px-2.5 py-1.5 backdrop-blur dark:border-white/[0.07] dark:bg-white/[0.03]">
          <div className="text-[10px] font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
            To hold profit
          </div>
          <AnimateNumber
            value={r.profitNeutralUpliftPct ?? 0}
            format={(n) => `+${n.toFixed(0)}%`}
            className="readout block text-sm font-semibold text-amber-700 dark:text-amber-400"
          />
        </div>
      </div>

      {/* Margin-erosion meter: the share of the unit margin the discount eats. */}
      <div
        className="mt-2.5 h-2 overflow-hidden rounded-full bg-slate-200/70 ring-1 ring-inset ring-white/60 dark:bg-white/[0.08] dark:ring-white/[0.05]"
        role="img"
        aria-label={`The discount consumes ${erosion.toFixed(0)}% of the unit margin`}
      >
        <motion.div
          className="h-full rounded-full bg-gradient-to-r from-amber-400 to-orange-500"
          animate={{ width: `${Math.min(100, Math.max(0, erosion))}%` }}
          transition={{ type: 'spring', stiffness: 140, damping: 22, mass: 0.6 }}
        />
      </div>
      <p className="mt-1.5 text-[10px] text-slate-500 dark:text-slate-400">
        {usd(DISCOUNT_FIXED.price, 0)} price ·{' '}
        <span className="readout text-slate-600 dark:text-slate-300">
          {r.baseGrossMarginPct === null ? '—' : pct(r.baseGrossMarginPct, 0)}
        </span>{' '}
        margin · eats{' '}
        <AnimateNumber
          value={erosion}
          format={(n) => pct(n, 0)}
          className="readout font-medium text-amber-700 dark:text-amber-400"
        />{' '}
        of unit margin · needs{' '}
        <span className="readout text-slate-600 dark:text-slate-300">
          {r.breakEvenVolume === null ? '—' : `${numFmt(r.breakEvenVolume, 0)} units`}
        </span>{' '}
        vs {numFmt(DISCOUNT_FIXED.volume, 0)}/mo
      </p>
    </WidgetShell>
  );
}

/* ---------------------------------------------------------------
   15. HSA — the triple-tax-advantage edge over a taxable twin,
       as the marginal bracket sweeps the 2025 federal bands
   --------------------------------------------------------------- */
export function HsaMiniWidget() {
  const [rate, setRate] = useState(24);
  // The HSA tool's default posture: family coverage at the $8,550 limit, no
  // catch-up, 7% return over 25 years, 40% of each year's contribution spent
  // on current care and 25% of the balance assumed forfeited non-qualified.
  const r = useMemo(
    () =>
      compareHsa({
        contribution: 8550,
        coverage: 'family',
        age55: false,
        marginalRatePct: rate,
        returnRatePct: 7,
        years: 25,
        medicalSpendShare: 0.4,
        forfeitShare: 0.25,
      }),
    [rate],
  );
  const maxV = Math.max(r.mixed.value, r.mixed.taxableTwinBalance, 1);

  return (
    <WidgetShell>
      <div className="mb-2.5 flex items-baseline justify-between">
        <span className="text-[10px] font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
          Marginal bracket
        </span>
        <AnimateNumber
          value={rate}
          format={(n) => pct(n, 0)}
          className="readout text-sm font-semibold text-slate-900 dark:text-white"
        />
      </div>

      <InteractiveSlider
        value={rate}
        onChange={setRate}
        min={10}
        max={37}
        step={1}
        ariaLabel="Marginal income-tax bracket"
      />

      <div className="mt-3 space-y-2">
        <MiniBar label="HSA" value={r.mixed.value} max={maxV} barClass="from-emerald-500 to-teal-400" />
        <MiniBar label="Taxable" value={r.mixed.taxableTwinBalance} max={maxV} barClass="from-sky-500 to-cyan-400" />
      </div>

      <p className="mt-2 text-[10px] text-slate-500 dark:text-slate-400">
        Spendable at year 25 · family {usdCompact(8550)} · 7% · 40% spent · 25% forfeited ·{' '}
        <span className="readout font-semibold text-emerald-700 dark:text-emerald-400">
          +{usdCompact(r.mixed.advantage)}
        </span>{' '}
        vs the same dollars taxed first
      </p>
    </WidgetShell>
  );
}

/* ---------------------------------------------------------------
   16. LATE-PAYMENT COST — carrying + default cost of Net-N terms
   --------------------------------------------------------------- */
export function LateFeeMiniWidget() {
  const [netDays, setNetDays] = useState(30);
  // The late-payment tool's defaults: $10k invoice, 8% annual cost of
  // capital, 2% blended default risk — while the card walks the term length.
  const r = useMemo(
    () => computeLatePayment({ invoiceAmount: 10000, netDays, annualRatePct: 8, badDebtPct: 2 }),
    [netDays],
  );
  const total = Math.max(r.totalExpectedCost, 1e-9);
  const carryShare = Math.min(100, (r.carryingCost / total) * 100);

  return (
    <WidgetShell>
      <div className="mb-3 flex flex-wrap gap-1.5">
        {TERM_PRESETS.map((p) => {
          const isActive = netDays === p.netDays;
          return (
            <button
              key={p.id}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                setNetDays(p.netDays);
              }}
              onPointerDown={(e) => e.stopPropagation()}
              className={`focus-calm relative rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                isActive ? 'text-white' : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
              }`}
              aria-pressed={isActive}
            >
              {isActive && (
                <motion.span
                  layoutId="latefee-active-pill"
                  className="absolute inset-0 -z-10 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 shadow-[0_4px_12px_rgba(245,158,11,0.35)]"
                  transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                />
              )}
              {p.label}
            </button>
          );
        })}
      </div>

      <div className="mb-1.5 flex items-baseline justify-between">
        <span className="text-[10px] font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
          Cost of the terms
        </span>
        <AnimateNumber
          value={r.totalExpectedCost}
          format={(n) => usd(n, 0)}
          className="readout text-sm font-semibold text-rose-600 dark:text-rose-400"
        />
      </div>

      <div
        className="flex h-2 overflow-hidden rounded-full bg-slate-200/70 ring-1 ring-inset ring-white/60 dark:bg-white/[0.08] dark:ring-white/[0.05]"
        role="img"
        aria-label={`Carrying cost ${usd(r.carryingCost, 0)} and expected default ${usd(r.badDebtLoss, 0)} per invoice`}
      >
        <motion.div
          className="h-full bg-gradient-to-r from-amber-400 to-orange-500"
          animate={{ width: `${carryShare}%` }}
          transition={{ type: 'spring', stiffness: 140, damping: 22, mass: 0.6 }}
        />
        <motion.div
          className="h-full bg-gradient-to-r from-rose-400 to-rose-500"
          animate={{ width: `${100 - carryShare}%` }}
          transition={{ type: 'spring', stiffness: 140, damping: 22, mass: 0.6 }}
        />
      </div>

      <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-slate-500 dark:text-slate-400">
        <span className="inline-flex items-center gap-1">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-400" aria-hidden="true" />
          Carrying <span className="readout text-slate-600 dark:text-slate-300">{usd(r.carryingCost, 0)}</span>
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-rose-500" aria-hidden="true" />
          Default <span className="readout text-slate-600 dark:text-slate-300">{usd(r.badDebtLoss, 0)}</span>
        </span>
      </div>
      <p className="mt-1 text-[10px] text-slate-500 dark:text-slate-400">
        {usdCompact(10000)} invoice · 8% capital · {usd(r.dailyCarryingCost, 2)}/day waiting · quote{' '}
        <span className="readout font-medium text-amber-700 dark:text-amber-400">
          +{pct(r.priceUpliftPct ?? 0, 1)}
        </span>{' '}
        to stand still
      </p>
    </WidgetShell>
  );
}

/* ---------------------------------------------------------------
   17. LTV:CAC — unit economics down the churn hyperbola, with the
       3× healthy-floor marker
   --------------------------------------------------------------- */
// Meter denominator: the ratio bar saturates at 15× so the 3× rule-of-thumb
// marker sits at a readable position (20% of the track).
const LTV_RATIO_METER_MAX = 15;

export function LtvCacMiniWidget() {
  const [churn, setChurn] = useState(4);
  // The reference case held fixed except churn: $100 ARPU at 80% margin,
  // $24k/mo of blended S&M buying 120 customers ($200 CAC).
  const fixed = LTV_CAC_PRESETS[0].inputs;
  const r = useMemo(
    () =>
      computeLtvCac({
        arpu: fixed.arpu,
        grossMarginPct: fixed.grossMarginPct,
        churnPct: churn,
        smSpend: fixed.smSpend,
        newCustomers: fixed.newCustomers,
      }),
    [churn, fixed],
  );
  const ratio = r.ratio ?? 0;
  const fill = Math.min(100, (ratio / LTV_RATIO_METER_MAX) * 100);
  const markerLeft = (RATIO_HEALTHY / LTV_RATIO_METER_MAX) * 100;

  return (
    <WidgetShell>
      <div className="mb-2.5 flex items-baseline justify-between">
        <span className="text-[10px] font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
          Monthly churn
        </span>
        <AnimateNumber
          value={churn}
          format={(n) => `${n.toFixed(1)}%`}
          className="readout text-sm font-semibold text-slate-900 dark:text-white"
        />
      </div>

      <InteractiveSlider
        value={churn}
        onChange={setChurn}
        min={1}
        max={8}
        step={0.5}
        ariaLabel="Monthly logo churn"
      />

      <div className="mt-3 grid grid-cols-2 gap-2">
        <div className="rounded-lg border border-white/70 bg-white/50 px-2.5 py-1.5 backdrop-blur dark:border-white/[0.07] dark:bg-white/[0.03]">
          <div className="text-[10px] font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
            LTV (gross)
          </div>
          <AnimateNumber
            value={r.ltv ?? 0}
            format={(n) => usd(n, 0)}
            className="readout block text-sm font-semibold text-slate-900 dark:text-white"
          />
        </div>
        <div className="rounded-lg border border-white/70 bg-white/50 px-2.5 py-1.5 backdrop-blur dark:border-white/[0.07] dark:bg-white/[0.03]">
          <div className="text-[10px] font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
            LTV:CAC
          </div>
          <AnimateNumber
            value={ratio}
            format={(n) => `${n.toFixed(1)}×`}
            className="readout block text-sm font-semibold text-emerald-700 dark:text-emerald-400"
          />
        </div>
      </div>

      <div className="relative mt-2.5" role="img" aria-label={`LTV to CAC ratio ${ratio.toFixed(1)} versus the ${RATIO_HEALTHY}× healthy floor`}>
        <div className="h-2 overflow-hidden rounded-full bg-slate-200/70 ring-1 ring-inset ring-white/60 dark:bg-white/[0.08] dark:ring-white/[0.05]">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-400 shadow-[0_0_8px_rgba(16,185,129,0.5)]"
            animate={{ width: `${fill}%` }}
            transition={{ type: 'spring', stiffness: 140, damping: 22, mass: 0.6 }}
          />
        </div>
        {/* The 3× rule-of-thumb marker — an industry heuristic, not a law. */}
        <span
          className="pointer-events-none absolute inset-y-0 w-px bg-slate-500/70 dark:bg-slate-300/60"
          style={{ left: `${markerLeft}%` }}
          aria-hidden="true"
        />
      </div>
      <p className="mt-1.5 text-[10px] text-slate-500 dark:text-slate-400">
        CAC <span className="readout text-slate-600 dark:text-slate-300">{usd(r.cac ?? 0, 0)}</span> · payback{' '}
        <span className="readout text-slate-600 dark:text-slate-300">
          {r.paybackChurnAdjusted === null ? '—' : `${r.paybackChurnAdjusted.toFixed(1)} mo`}
        </span>{' '}
        churn-adj · lifetime {r.lifetimeMonths === null ? '—' : `${r.lifetimeMonths.toFixed(0)} mo`} ·{' '}
        {RATIO_HEALTHY}× is the healthy floor (rule of thumb)
      </p>
    </WidgetShell>
  );
}

/* ---------------------------------------------------------------
   18. MILEAGE DEDUCTION — 70¢/mi standard vs actual expenses as
       business mileage crosses the neutral point
   --------------------------------------------------------------- */
export function MileageMiniWidget() {
  const [miles, setMiles] = useState(9000);
  // The mileage tool's default vehicle: $9,600/yr of running costs at a 65%
  // business share, 24% bracket with the SE layer on — miles are the dial.
  const r = useMemo(
    () =>
      compareMileage(
        {
          businessMiles: miles,
          depreciation: 3600,
          fuelEnergy: 2600,
          insurance: 1900,
          maintenance: 1200,
          registration: 300,
          businessSharePct: 65,
        },
        24,
        true,
      ),
    [miles],
  );
  const maxD = Math.max(r.standard.deduction, r.actual.deduction, 1);
  // Neutral point is mileage-invariant here (costs & share fixed) — compute
  // once from the same input bundle the bars run on.
  const neutral = useMemo(
    () =>
      neutralMileage({
        businessMiles: miles,
        depreciation: 3600,
        fuelEnergy: 2600,
        insurance: 1900,
        maintenance: 1200,
        registration: 300,
        businessSharePct: 65,
      }),
    [miles],
  );

  return (
    <WidgetShell>
      <div className="mb-2.5 flex items-baseline justify-between">
        <span className="text-[10px] font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
          Business miles
        </span>
        <AnimateNumber
          value={miles}
          format={(n) => numFmt(n, 0)}
          className="readout text-sm font-semibold text-slate-900 dark:text-white"
        />
      </div>

      <InteractiveSlider
        value={miles}
        onChange={setMiles}
        min={1000}
        max={30000}
        step={500}
        ariaLabel="Annual business miles"
      />

      <div className="mt-3 space-y-2">
        <MiniBar label="Standard" value={r.standard.deduction} max={maxD} barClass="from-emerald-500 to-teal-400" />
        <MiniBar label="Actual" value={r.actual.deduction} max={maxD} barClass="from-sky-500 to-cyan-400" />
      </div>

      <p className="mt-2 text-[10px] text-slate-500 dark:text-slate-400">
        2025 rate{' '}
        <span className="readout text-slate-600 dark:text-slate-300">
          {usd(MILEAGE_CONSTANTS_2025.standardRatePerMile, 2)}/mi
        </span>{' '}
        · 65% share · $9.6k costs · crossover{' '}
        <span className="readout font-medium text-slate-600 dark:text-slate-300">
          {neutral.exactMiles === null ? '—' : `${numFmt(neutral.exactMiles, 0)} mi`}
        </span>{' '}
        ·{' '}
        <span
          className={`readout font-semibold ${
            r.winner === 'standard'
              ? 'text-emerald-700 dark:text-emerald-400'
              : r.winner === 'actual'
                ? 'text-sky-700 dark:text-sky-400'
                : 'text-slate-500 dark:text-slate-400'
          }`}
        >
          {r.winner === 'tie' ? 'tie' : `${r.winner} +${usd(Math.abs(r.deductionDelta), 0)}`}
        </span>
      </p>
    </WidgetShell>
  );
}

/* ---------------------------------------------------------------
   19. R&D TAX CREDIT — the §41 ASC as the prior-QRE base moves,
       against the §38(c) ceiling
   --------------------------------------------------------------- */
const RDC_BASES = [
  { avg: 0, label: 'Startup' },
  { avg: 100000, label: '$100k' },
  { avg: 200000, label: '$200k' },
  { avg: 400000, label: '$400k' },
];

export function RdCreditMiniWidget() {
  const [avg, setAvg] = useState(200000);
  // The R&D tool's defaults: $400k current-year QRE, $45k regular tax, 24%
  // bracket, §280C reduced-credit election on, nothing routed to payroll —
  // the card moves the 3-year prior-QRE average (0 = the 6% special rule).
  const r = useMemo(
    () =>
      evaluateIncomePath({
        qre: 400000,
        priorAvg3Qre: avg,
        regularTax: 45000,
        marginalRate: 0.24,
        elect280C: true,
      }),
    [avg],
  );
  const ceiling = Math.max(r.ceiling, 1);
  const usedShare = Math.min(100, (r.selected.used / ceiling) * 100);

  return (
    <WidgetShell>
      <div className="mb-3 flex flex-wrap gap-1.5">
        {RDC_BASES.map((p) => {
          const isActive = avg === p.avg;
          return (
            <button
              key={p.label}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                setAvg(p.avg);
              }}
              onPointerDown={(e) => e.stopPropagation()}
              className={`focus-calm relative rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                isActive ? 'text-white' : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
              }`}
              aria-pressed={isActive}
            >
              {isActive && (
                <motion.span
                  layoutId="rdc-active-pill"
                  className="absolute inset-0 -z-10 rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 shadow-[0_4px_12px_rgba(99,102,241,0.35)]"
                  transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                />
              )}
              {p.label}
            </button>
          );
        })}
      </div>

      <div className="mb-1.5 flex items-baseline justify-between">
        <span className="text-[10px] font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
          §41 credit · {r.method === 'asc-startup' ? '6% rule' : '14% ASC'}
        </span>
        <AnimateNumber
          value={r.grossCredit}
          format={(n) => usd(n, 0)}
          className="readout text-sm font-semibold text-slate-900 dark:text-white"
        />
      </div>

      <div
        className="h-2 overflow-hidden rounded-full bg-slate-200/70 ring-1 ring-inset ring-white/60 dark:bg-white/[0.08] dark:ring-white/[0.05]"
        role="img"
        aria-label={`${usd(r.selected.used, 0)} of the credit usable this year against the ${usd(r.ceiling, 0)} general-business-credit ceiling`}
      >
        <motion.div
          className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 shadow-[0_0_8px_rgba(99,102,241,0.5)]"
          animate={{ width: `${usedShare}%` }}
          transition={{ type: 'spring', stiffness: 140, damping: 22, mass: 0.6 }}
        />
      </div>
      <p className="mt-1.5 text-[10px] text-slate-500 dark:text-slate-400">
        $400k QRE · 24% bracket · §280C reduced credit · net this year{' '}
        <AnimateNumber
          value={r.selected.netBenefit}
          format={(n) => usd(n, 0)}
          className="readout font-medium text-emerald-700 dark:text-emerald-400"
        />{' '}
        · ceiling {usd(r.ceiling, 0)}
        {r.ceilingBinds ? ' binds' : ''}
      </p>
    </WidgetShell>
  );
}

/* ---------------------------------------------------------------
   20. ROTH VS TRADITIONAL — spendable at retirement as the
       withdrawal-rate dial crosses today's bracket
   --------------------------------------------------------------- */
export function RothMiniWidget() {
  const [retRate, setRetRate] = useState(12);
  // The Roth tool's defaults: $7,000 IRA, 30 years, 7% return, 24% bracket
  // today — the card sweeps the assumed retirement-rate dial.
  const r = useMemo(
    () =>
      compareRoth({
        currentRatePct: 24,
        retirementRatePct: retRate,
        annualContribution: 7000,
        years: 30,
        annualReturnPct: 7,
      }),
    [retRate],
  );
  const maxV = Math.max(r.rothSpendable, r.tradSpendable, 1);

  return (
    <WidgetShell>
      <div className="mb-2.5 flex items-baseline justify-between">
        <span className="text-[10px] font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
          Retirement rate
        </span>
        <AnimateNumber
          value={retRate}
          format={(n) => pct(n, 0)}
          className="readout text-sm font-semibold text-slate-900 dark:text-white"
        />
      </div>

      <InteractiveSlider
        value={retRate}
        onChange={setRetRate}
        min={0}
        max={40}
        step={1}
        ariaLabel="Assumed tax rate at withdrawal"
      />

      <div className="mt-3 space-y-2">
        <MiniBar label="Roth" value={r.rothSpendable} max={maxV} barClass="from-emerald-500 to-teal-400" />
        <MiniBar label="Trad." value={r.tradSpendable} max={maxV} barClass="from-sky-500 to-cyan-400" />
      </div>

      <p className="mt-2 text-[10px] text-slate-500 dark:text-slate-400">
        Spendable after tax at year 30 · break-even{' '}
        <span className="readout font-medium text-slate-600 dark:text-slate-300">
          {pct(r.breakevenRetirementRatePct, 0)}
        </span>{' '}
        (your rate today) · $7k/yr · 7% ·{' '}
        <span
          className={`readout font-semibold ${
            r.winner === 'roth'
              ? 'text-emerald-700 dark:text-emerald-400'
              : r.winner === 'traditional'
                ? 'text-sky-700 dark:text-sky-400'
                : 'text-slate-500 dark:text-slate-400'
          }`}
        >
          {r.winner === 'tie' ? 'tie' : `${r.winner === 'roth' ? 'Roth' : 'Trad.'} +${usdCompact(Math.abs(r.advantageRoth))}`}
        </span>
      </p>
    </WidgetShell>
  );
}

/* ---------------------------------------------------------------
   21. SAFE NOTE — who owns the company the moment the priced
       round closes: founders / SAFE stack / new investor
   --------------------------------------------------------------- */
const SAFE_LABELS: Record<string, string> = {
  'yc-standard': 'Standard',
  'discount-only': 'No cap',
  stacked: 'Two SAFEs',
  heavy: 'Cap-heavy',
};

export function SafeNoteMiniWidget() {
  const [id, setId] = useState('yc-standard');
  const preset = SAFE_PRESETS.find((p) => p.id === id) ?? SAFE_PRESETS[0];
  const sim = useMemo(() => convertSafeStack(preset.safes, preset.round, preset.shares), [preset]);
  const foundersPctAfter = Math.max(0, Math.min(100, sim.foundersPctAfter));
  const stackPctAfter = Math.max(0, Math.min(100, sim.stackPctAfter));
  const investorPctAfter = Math.max(0, Math.min(100, sim.investorPctAfter));

  return (
    <WidgetShell>
      <div className="mb-3 flex flex-wrap gap-1.5">
        {SAFE_PRESETS.map((p) => {
          const isActive = p.id === id;
          return (
            <button
              key={p.id}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                setId(p.id);
              }}
              onPointerDown={(e) => e.stopPropagation()}
              className={`focus-calm relative rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                isActive ? 'text-white' : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
              }`}
              aria-pressed={isActive}
            >
              {isActive && (
                <motion.span
                  layoutId="safe-active-pill"
                  className="absolute inset-0 -z-10 rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 shadow-[0_4px_12px_rgba(99,102,241,0.35)]"
                  transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                />
              )}
              {SAFE_LABELS[p.id] ?? p.label}
            </button>
          );
        })}
      </div>

      <div className="mb-1.5 flex items-baseline justify-between">
        <span className="text-[10px] font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
          Founders after the round
        </span>
        <AnimateNumber
          value={foundersPctAfter}
          format={(n) => pct(n, 1)}
          className="readout text-sm font-semibold text-slate-900 dark:text-white"
        />
      </div>

      <div
        className="flex h-2 overflow-hidden rounded-full bg-slate-200/70 ring-1 ring-inset ring-white/60 dark:bg-white/[0.08] dark:ring-white/[0.05]"
        role="img"
        aria-label={`Founders ${pct(foundersPctAfter, 1)}, SAFE stack ${pct(stackPctAfter, 1)}, new investor ${pct(investorPctAfter, 1)}`}
      >
        <motion.div
          className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 shadow-[0_0_8px_rgba(16,185,129,0.5)]"
          animate={{ width: `${foundersPctAfter}%` }}
          transition={{ type: 'spring', stiffness: 140, damping: 22, mass: 0.6 }}
        />
        <motion.div
          className="h-full bg-gradient-to-r from-indigo-500 to-violet-500"
          animate={{ width: `${stackPctAfter}%` }}
          transition={{ type: 'spring', stiffness: 140, damping: 22, mass: 0.6 }}
        />
        <motion.div
          className="h-full bg-gradient-to-r from-sky-500 to-cyan-400"
          animate={{ width: `${investorPctAfter}%` }}
          transition={{ type: 'spring', stiffness: 140, damping: 22, mass: 0.6 }}
        />
      </div>

      <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-slate-500 dark:text-slate-400">
        <span className="inline-flex items-center gap-1">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
          Founders <span className="readout text-slate-600 dark:text-slate-300">{pct(foundersPctAfter, 1)}</span>
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-indigo-500" aria-hidden="true" />
          SAFEs <span className="readout text-slate-600 dark:text-slate-300">{pct(stackPctAfter, 1)}</span>
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-sky-500" aria-hidden="true" />
          Investor <span className="readout text-slate-600 dark:text-slate-300">{pct(investorPctAfter, 1)}</span>
        </span>
      </div>
      <p className="mt-1 text-[10px] text-slate-500 dark:text-slate-400">
        {usd(sim.roundPrice, 2)}/share · stack costs{' '}
        <span className="readout font-medium text-indigo-600 dark:text-indigo-400">
          {pct(sim.foundersExtraDilutionPts, 1)}
        </span>{' '}
        more than a clean round ({pct(sim.foundersPctNoSafes, 1)} founders without SAFEs)
      </p>
    </WidgetShell>
  );
}

function MiniBar({
  label,
  value,
  max,
  barClass,
}: {
  label: string;
  value: number;
  max: number;
  barClass: string;
}) {
  const w = Math.max(2, (value / max) * 100);
  return (
    <div className="flex items-center gap-2">
      <span className="w-20 shrink-0 text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
        {label}
      </span>
      <div className="relative h-6 flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-white/[0.06]">
        <motion.div
          className={`absolute inset-y-0 left-0 rounded-full bg-gradient-to-r ${barClass}`}
          initial={false}
          animate={{ width: `${w}%` }}
          transition={{ type: 'spring', stiffness: 160, damping: 24 }}
        />
      </div>
      <AnimateNumber
        value={value}
        format={(n) => usdCompact(n)}
        className="readout w-14 shrink-0 text-right text-xs font-bold text-slate-700 dark:text-slate-200"
      />
    </div>
  );
}

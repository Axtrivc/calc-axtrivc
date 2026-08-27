'use client';

import { useMemo, useState } from 'react';
import { motion, useMotionValue } from 'framer-motion';
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
      className="mt-5 rounded-xl border border-white/70 bg-white/40 p-3.5 backdrop-blur-md"
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
        <span className="text-[10px] font-medium uppercase tracking-wider text-slate-500">
          Charge amount
        </span>
        <AnimateNumber
          value={amount}
          format={(n) => usd(n)}
          className="readout text-sm font-semibold text-slate-900"
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
        <div className="rounded-lg border border-white/70 bg-white/50 px-2.5 py-1.5 backdrop-blur">
          <div className="text-[9px] font-medium uppercase tracking-wider text-slate-500">Fee</div>
          <AnimateNumber
            value={r.fee}
            format={(n) => `−${usd(n)}`}
            className="readout block text-sm font-semibold text-rose-600"
          />
        </div>
        <div className="rounded-lg border border-white/70 bg-white/50 px-2.5 py-1.5 backdrop-blur">
          <div className="text-[9px] font-medium uppercase tracking-wider text-slate-500">You net</div>
          <AnimateNumber
            value={r.net}
            format={(n) => usd(n)}
            className="readout block text-sm font-semibold text-slate-900"
          />
        </div>
      </div>

      {/* Glowing dual-tone net-vs-fee meter.
          Emerald = the share you keep; Rose = the share Stripe takes.
          Both segments are spring-animated and carry a soft glow for energy. */}
      <div className="mt-2.5 flex h-2 overflow-hidden rounded-full bg-slate-200/70 ring-1 ring-inset ring-white/60">
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
      <p className="mt-1.5 text-[10px] text-slate-500">
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
                isActive ? 'text-white' : 'text-slate-500 hover:text-slate-900'
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
        <span className="readout rounded-lg border border-white/70 bg-white/60 px-2 py-1 text-slate-700 backdrop-blur">
          {usd(income, 0)}
        </span>
        <span className="text-emerald-500">→</span>
        <span className="readout rounded-lg border border-emerald-200/70 bg-emerald-50/60 px-2 py-1 font-semibold text-emerald-700 shadow-[0_0_12px_rgba(16,185,129,0.18)] backdrop-blur">
          <AnimateNumber value={r.hourlyRate} format={(n) => `${usd(n, 0)}/hr`} />
        </span>
      </div>
      <p className="mt-2 text-[10px] text-slate-500">
        Day <span className="readout text-slate-600">{usd(r.dayRate, 0)}</span> · Month{' '}
        <span className="readout text-slate-600">{usd(r.monthlyRate, 0)}</span> · 30% tax · 25h/wk
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
        <span className="text-[10px] font-medium uppercase tracking-wider text-slate-500">Starting cash</span>
        <AnimateNumber
          value={cash}
          format={(n) => usdCompact(n)}
          className="readout text-sm font-semibold text-slate-900"
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
        <span className="text-[10px] font-medium uppercase tracking-wider text-slate-500">Cash trajectory</span>
        <span className="readout text-sm font-bold" style={{ color: toneColor }}>
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
            className="pointer-events-none absolute -top-1 z-10 -translate-x-1/2 -translate-y-full rounded-md border border-white/80 bg-white/90 px-2 py-1 text-[10px] shadow-[0_4px_12px_rgba(15,23,42,0.12)] backdrop-blur"
            style={{ left: `${(px(activeIdx) / W) * 100}%` }}
          >
            <span className="readout font-semibold" style={{ color: toneColor }}>
              {usdCompact(Math.max(0, activePt.cash))}
            </span>
            <span className="ml-1 text-slate-400">mo {activeIdx}</span>
          </div>
        )}
      </div>
      <p className="mt-1.5 text-[10px] text-slate-500">
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
              className={`relative rounded-full px-2 py-0.5 text-xs font-medium transition-colors ${
                isActive ? 'text-white' : 'text-slate-500 hover:text-slate-900'
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
          textColor="text-emerald-600"
          ariaLabel={`LLC effective tax rate ${pct(r.llc.effectiveRate, 1)}`}
        />
        <EnergyGauge
          value={r.ccorp.effectiveRate}
          max={maxRate}
          label="C-Corp"
          gradientId="gauge-ccorp"
          from="#FBBF24"
          to="#FB923C"
          textColor="text-amber-600"
          ariaLabel={`C-Corp effective tax rate ${pct(r.ccorp.effectiveRate, 1)}`}
        />
      </div>
      <p className="mt-2 text-center text-[10px] text-slate-500">
        Federal tax · <span className="readout text-slate-600">{usd(r.delta, 0)}</span> delta · winner:{' '}
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

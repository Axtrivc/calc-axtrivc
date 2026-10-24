'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Info,
  PieChart,
  Plus,
  RotateCcw,
  Trash2,
  TrendingDown,
} from 'lucide-react';
import NumberInput, { AnimatedNumber, CopyButton, SliderControl } from '@/components/NumberInput';
import ScenarioButtons from '@/components/ScenarioButtons';
import ComparisonChart from '@/components/ComparisonChart';
import {
  DEFAULT_SAFE_INPUTS,
  MAX_SAFES,
  SAFE_PRESETS,
  classifySafeStack,
  convertSafeStack,
  crossoverPreMoney,
  safeCurve,
  type SafePreset,
  type SafeTerms,
} from '@/lib/safe';
import { numFmt, pct, usd, usdCompact } from '@/lib/format';
import { useWorkbenchInputs, recordRecent } from '@/lib/workbench';

const SLUG = 'safe-note-calculator';
const HREF = '/safe-note-calculator/';

/** Workbench defaults ship with the "Standard YC seed" preset (DEFAULT_SAFE_INPUTS). */
const DEFAULTS = DEFAULT_SAFE_INPUTS;

const CAP_PRESETS = [0, 5_000_000, 10_000_000, 15_000_000, 25_000_000];
const DISCOUNT_PRESETS = [0, 10, 15, 20, 30];

function safeTermsOf(v: Record<string, number>, i: number): SafeTerms {
  return {
    amount: v[`s${i + 1}Amt`] ?? 0,
    cap: v[`s${i + 1}Cap`] ?? 0,
    discountPct: v[`s${i + 1}Disc`] ?? 0,
  };
}

function matchesPreset(v: Record<string, number>, p: SafePreset): boolean {
  for (let i = 0; i < MAX_SAFES; i++) {
    const s = p.safes[i];
    if (
      v[`s${i + 1}Amt`] !== s.amount ||
      v[`s${i + 1}Cap`] !== s.cap ||
      v[`s${i + 1}Disc`] !== s.discountPct
    ) {
      return false;
    }
  }
  return v.roundInv === p.round.investment && v.roundPre === p.round.preMoney && v.shares === p.shares;
}

const BINDING_LABEL: Record<string, string> = {
  cap: 'Cap',
  discount: 'Discount',
  'round-price': 'Round price',
  inactive: '—',
};

/** Sensitivity sweep window: wide enough to show both regimes around any round. */
function curveWindow(preMoney: number): number[] {
  const lo = Math.max(500_000, Math.min(2_000_000, preMoney * 0.25));
  const hi = Math.max(60_000_000, preMoney * 1.8);
  const n = 57;
  return Array.from({ length: n }, (_, i) => lo + ((hi - lo) * i) / (n - 1));
}

export default function SafeNoteCalculator() {
  const { values, set, reset } = useWorkbenchInputs(SLUG, DEFAULTS);
  const [visible, setVisible] = useState(1);

  useEffect(() => {
    recordRecent(SLUG);
  }, []);

  // Reveal SAFE rows that carry amounts from a restored scenario / deep link.
  useEffect(() => {
    let highest = 0;
    for (let i = 0; i < MAX_SAFES; i++) {
      if ((values[`s${i + 1}Amt`] ?? 0) > 0) highest = i + 1;
    }
    setVisible((v) => Math.max(v, Math.min(MAX_SAFES, Math.max(1, highest))));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [values.s1Amt, values.s2Amt, values.s3Amt]);

  const safes = useMemo(
    () => Array.from({ length: MAX_SAFES }, (_, i) => safeTermsOf(values, i)),
    [values],
  );
  const round = useMemo(
    () => ({ investment: values.roundInv, preMoney: values.roundPre }),
    [values.roundInv, values.roundPre],
  );

  const status = useMemo(() => classifySafeStack(safes, round, values.shares), [safes, round, values.shares]);
  const result = useMemo(
    () => convertSafeStack(safes, round, values.shares),
    [safes, round, values.shares],
  );

  const curve = useMemo(
    () => safeCurve(safes, round.investment, values.shares, curveWindow(round.preMoney)),
    [safes, round.investment, values.shares, round.preMoney],
  );

  const activeCount = safes.filter((s) => s.amount > 0).length;
  const firstActiveIndex = safes.findIndex((s) => s.amount > 0);
  const firstActive = firstActiveIndex >= 0 ? safes[firstActiveIndex] : undefined;
  const kink = firstActive ? crossoverPreMoney(firstActive) : null;

  function applyPreset(p: SafePreset) {
    for (let i = 0; i < MAX_SAFES; i++) {
      const s = p.safes[i];
      set(`s${i + 1}Amt`, s.amount);
      set(`s${i + 1}Cap`, s.cap);
      set(`s${i + 1}Disc`, s.discountPct);
    }
    set('roundInv', p.round.investment);
    set('roundPre', p.round.preMoney);
    set('shares', p.shares);
    setVisible(Math.max(1, p.safes.filter((s) => s.amount > 0).length));
  }

  function resetAll() {
    reset();
    setVisible(1);
  }

  /** Per-row remove: clears the row and shifts the rows below it up, so any
      SAFE on the stack can be deleted with one click — not just the last. */
  function removeSafe(index: number) {
    if (visible <= 1) return;
    for (let i = index; i < visible - 1; i++) {
      set(`s${i + 1}Amt`, values[`s${i + 2}Amt`] ?? 0);
      set(`s${i + 1}Cap`, values[`s${i + 2}Cap`] ?? 0);
      set(`s${i + 1}Disc`, values[`s${i + 2}Disc`] ?? 0);
    }
    set(`s${visible}Amt`, 0);
    set(`s${visible}Cap`, 0);
    set(`s${visible}Disc`, 0);
    setVisible(visible - 1);
  }

  const copySummary = result.valid
    ? `Post-money SAFE stack at a ${usd(round.investment, 0)} Series A (${usd(round.preMoney, 0)} pre): SAFEs own ${pct(
        result.stackPctAfter,
        2,
      )} after the round (${pct(result.stackPctOfPreRound, 2)} of the pre-round table); existing holders ${pct(
        result.foundersPctAfter,
        2,
      )} vs ${pct(result.foundersPctNoSafes, 2)} without the stack — ${result.foundersExtraDilutionPts.toFixed(
        2,
      )} points of extra dilution. YC post-money SAFE conversion math.`
    : `SAFE conversion not modeled: ${result.reason}`;

  // Chart legs, honestly segmented: a point joins the cap leg only when EVERY
  // active SAFE binds on its cap at that valuation, the discount leg only when
  // all bind on their discounts — mixed stacks (different caps/discounts flip
  // at different valuations) get their own slate leg so no stretch of curve is
  // ever labeled with a term that does not bind for the whole stack.
  const plotPts = curve.filter((p) => Number.isFinite(p.stackPctAfter));
  const capLeg = plotPts.filter((p) => p.bindingMode === 'cap');
  const discountLeg = plotPts.filter((p) => p.bindingMode === 'discount');
  const roundLeg = plotPts.filter((p) => p.bindingMode === 'round-price');
  const mixedLeg = plotPts.filter((p) => p.bindingMode === 'mixed');
  const foundersPts = plotPts.map((p) => ({ x: p.x, y: p.foundersPctAfter }));

  // The focus SAFE number for chart labels: 1-based position of the first
  // active row ("SAFE 1" whenever the default order is used).
  const focusNo = firstActiveIndex >= 0 ? firstActiveIndex + 1 : 1;

  const chartSeries = [
    {
      label: 'SAFE stack — every SAFE under its valuation cap',
      color: '#6366f1',
      points: capLeg.map((p) => ({ x: p.x, y: p.stackPctAfter })),
      fillTo: 0,
    },
    {
      label: 'SAFE stack — every SAFE under its discount',
      color: '#f59e0b',
      points: discountLeg.map((p) => ({ x: p.x, y: p.stackPctAfter })),
    },
    {
      label: 'SAFE stack — SAFEs bind on different terms',
      color: '#64748b',
      points: mixedLeg.map((p) => ({ x: p.x, y: p.stackPctAfter })),
    },
    {
      label: 'SAFE stack — uncapped, at the round price',
      color: '#0ea5e9',
      dashed: true,
      points: roundLeg.map((p) => ({ x: p.x, y: p.stackPctAfter })),
    },
    {
      label: 'Existing holders after the round',
      color: '#10b981',
      dashed: true,
      points: foundersPts,
    },
  ].filter((s) => s.points.length > 0);

  // Kink marker only when it sits inside the plotted window.
  const kinkInWindow =
    kink !== null &&
    plotPts.length > 0 &&
    kink > plotPts[0].x &&
    kink < plotPts[plotPts.length - 1].x;

  const shareRows = result.safes.filter((o) => o.binding !== 'inactive');
  // A cap-only SAFE in a round priced below its cap converts ABOVE the round
  // price — the cap is a ceiling on the SAFE's price, not a floor.
  const overPriced = shareRows.filter((o) => o.effectiveDiscountPct < -1e-9);

  return (
    <div className="grid gap-6 lg:grid-cols-5">
      {/* ================= Inputs ================= */}
      <div className="card p-6 sm:p-8 lg:col-span-3">
        {/* Scenario presets */}
        <div>
          <div className="mb-2 flex items-baseline justify-between">
            <span className="label mb-0">Scenario presets</span>
            <span className="text-[11px] text-slate-500 dark:text-slate-400">
              full stacks, one click
            </span>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {SAFE_PRESETS.map((p) => {
              const active = matchesPreset(values, p);
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => applyPreset(p)}
                  aria-pressed={active}
                  className={`rounded-xl border p-3 text-left transition duration-150 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 dark:focus-visible:ring-indigo-400 dark:focus-visible:ring-offset-slate-950 ${
                    active
                      ? 'border-indigo-500 bg-indigo-50/80 ring-1 ring-indigo-500/25 dark:border-indigo-400 dark:bg-indigo-500/10 dark:ring-indigo-400/25'
                      : 'border-slate-200 bg-white hover:border-indigo-300 hover:shadow-sm dark:border-white/10 dark:bg-white/[0.03] dark:hover:border-indigo-400/40'
                  }`}
                >
                  <span
                    className={`block text-sm font-semibold ${
                      active ? 'text-indigo-700 dark:text-indigo-300' : 'text-slate-700 dark:text-slate-200'
                    }`}
                  >
                    {p.label}
                  </span>
                  <span className="mt-0.5 block text-xs leading-snug text-slate-500 dark:text-slate-400">
                    {p.description}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* SAFE stack */}
        <div className="mt-7">
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">The SAFE stack</h3>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            Post-money SAFEs (YC form). A purchase amount of $0 disables the row; a cap of $0 or a
            discount of 0% drops that term.
          </p>
          <div className="mt-3 space-y-3">
            {Array.from({ length: visible }, (_, i) => {
              const s = safes[i];
              const inactive = s.amount <= 0;
              return (
                <div key={i} className={`panel p-4 transition ${inactive ? 'opacity-70' : ''}`}>
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <span className="text-sm font-bold text-slate-800 dark:text-slate-100">
                      SAFE {i + 1}
                      {result.valid && !inactive && (
                        <span
                          className={`ml-2 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                            result.safes[i].binding === 'cap'
                              ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300'
                              : result.safes[i].binding === 'discount'
                                ? 'bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300'
                                : 'bg-sky-50 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300'
                          }`}
                        >
                          {BINDING_LABEL[result.safes[i].binding]}
                        </span>
                      )}
                    </span>
                    {visible > 1 && (
                      <button
                        type="button"
                        onClick={() => removeSafe(i)}
                        aria-label={`Remove SAFE row ${i + 1}`}
                        className="focus-calm btn-ghost px-2.5 py-1"
                      >
                        <Trash2 className="h-4 w-4 text-slate-400 dark:text-slate-500" aria-hidden="true" />
                      </button>
                    )}
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <NumberInput
                      id={`safe-amt-${i}`}
                      label="Purchase amount"
                      value={s.amount}
                      onChange={(n) => set(`s${i + 1}Amt`, n)}
                      min={0}
                      max={100_000_000}
                      prefix="$"
                      placeholder="500,000"
                      helpText="$0 disables this SAFE."
                    />
                    <NumberInput
                      id={`safe-cap-${i}`}
                      label="Post-money valuation cap"
                      value={s.cap}
                      onChange={(n) => set(`s${i + 1}Cap`, n)}
                      min={0}
                      max={1_000_000_000}
                      prefix="$"
                      placeholder="10,000,000"
                      helpText="$0 = no cap."
                    />
                    <div className="sm:col-span-2">
                      <SliderControl
                        id={`safe-disc-${i}`}
                        label="Discount"
                        ariaLabel={`SAFE ${i + 1} discount`}
                        value={s.discountPct}
                        onChange={(n) => set(`s${i + 1}Disc`, n)}
                        min={0}
                        max={50}
                        step={1}
                        suffix="% off"
                        presets={DISCOUNT_PRESETS}
                        formatValue={(n) => (n > 0 ? `${n}% off (pays ${100 - n}%)` : 'none')}
                        helpText="Percent off the Series A price. 0% = no discount."
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          {visible < MAX_SAFES && (
            <button type="button" onClick={() => setVisible(visible + 1)} className="btn-ghost mt-3">
              <Plus className="h-4 w-4 text-indigo-500 dark:text-indigo-300" aria-hidden="true" />
              Add SAFE
            </button>
          )}
        </div>

        {/* Priced round */}
        <div className="mt-7">
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
            The priced round that triggers conversion
          </h3>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            SAFEs convert immediately prior to this round; the pre-money is struck on the
            post-conversion table.
          </p>
          <div className="mt-3 space-y-4">
            <div>
              <NumberInput
                id="safe-round-inv"
                label="New money invested (Series A)"
                value={round.investment}
                onChange={(n) => set('roundInv', n)}
                min={0}
                max={1_000_000_000}
                prefix="$"
                placeholder="3,000,000"
              />
              <div className="mt-3">
                <SliderControl
                  id="safe-round-inv-slider"
                  label="Round size"
                  value={round.investment}
                  onChange={(n) => set('roundInv', n)}
                  min={100_000}
                  max={200_000_000}
                  logarithmic
                  prefix="$"
                  presets={[1_000_000, 3_000_000, 5_000_000, 10_000_000, 25_000_000]}
                  formatValue={(n) => usdCompact(n)}
                />
              </div>
            </div>
            <div>
              <NumberInput
                id="safe-round-pre"
                label="Pre-money valuation"
                value={round.preMoney}
                onChange={(n) => set('roundPre', n)}
                min={0}
                max={10_000_000_000}
                prefix="$"
                placeholder="15,000,000"
              />
              <div className="mt-3">
                <SliderControl
                  id="safe-round-pre-slider"
                  label="Pre-money"
                  value={round.preMoney}
                  onChange={(n) => set('roundPre', n)}
                  min={1_000_000}
                  max={1_000_000_000}
                  logarithmic
                  prefix="$"
                  presets={CAP_PRESETS.filter((p) => p > 0)}
                  formatValue={(n) => usdCompact(n)}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Existing shares */}
        <div className="mt-7">
          <NumberInput
            id="safe-shares"
            label="Existing fully diluted shares"
            value={values.shares}
            onChange={(n) => set('shares', n)}
            min={0}
            max={1_000_000_000}
            placeholder="10,000,000"
            helpText="Common + granted AND promised options (signed offers count) + the unallocated pool as it stands — the form’s Company Capitalization. A pool increase adopted with this round is excluded by the form and not simulated here."
          />
          <div className="mt-3">
            <SliderControl
              id="safe-shares-slider"
              label="Existing shares"
              value={values.shares}
              onChange={(n) => set('shares', n)}
              min={100_000}
              max={100_000_000}
              logarithmic
              presets={[1_000_000, 5_000_000, 10_000_000, 25_000_000, 50_000_000]}
              formatValue={(n) => numFmt(Math.round(n))}
            />
          </div>
        </div>

        <div className="mt-6 flex items-start gap-2 rounded-lg bg-slate-50 p-3 text-xs leading-relaxed text-slate-600 dark:bg-white/[0.03] dark:text-slate-300">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-slate-400 dark:text-slate-500" aria-hidden="true" />
          <p>
            YC post-money SAFE mechanics: each SAFE&apos;s price is the lower of{' '}
            <code className="font-mono">cap ÷ Company Capitalization</code> and{' '}
            <code className="font-mono">rate × round price</code>; Company Capitalization counts every
            converting SAFE. Pre-2018 pre-money SAFEs, exit conversions, and side letters are outside
            this model.
          </p>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" onClick={resetAll} className="btn-ghost">
            <RotateCcw className="h-4 w-4 text-indigo-500 dark:text-indigo-300" aria-hidden="true" />
            Reset
          </button>
          <CopyButton text={copySummary} label="Copy result" />
          <ScenarioButtons slug={SLUG} shortTitle="SAFE Notes" href={HREF} params={{ ...values }} />
        </div>
      </div>

      {/* ================= Results ================= */}
      <div className="space-y-4 lg:col-span-2">
        {result.valid ? (
          <>
            <div className="card p-6 sm:p-8">
              <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                <PieChart className="h-4 w-4" aria-hidden="true" />
                SAFE stack after the round
              </h2>
              <div className="mt-3">
                <AnimatedNumber
                  value={result.stackPctAfter}
                  format={(n) => pct(n, 2)}
                  className="readout mt-1 block text-4xl font-extrabold tracking-tight text-indigo-600 dark:text-indigo-300"
                />
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  of the post-round cap table — combined across{' '}
                  {activeCount === 1 ? '1 SAFE' : `${activeCount} SAFEs`} — versus{' '}
                  {pct(result.stackPctOfPreRound, 2)} of the pre-round table, before the Series A
                  diluted everyone.
                </p>
              </div>

              <dl className="mt-5 divide-y divide-slate-100 text-sm dark:divide-white/[0.06]">
                <div className="flex items-center justify-between gap-3 py-2.5">
                  <dt className="text-slate-600 dark:text-slate-300">Series A investor</dt>
                  <dd className="readout font-semibold text-slate-900 dark:text-slate-100">
                    {pct(result.investorPctAfter, 2)}
                    <span className="ml-1.5 text-xs font-normal text-slate-500 dark:text-slate-400">
                      = {usdCompact(round.investment)} ÷ {usdCompact(round.preMoney + round.investment)} post
                    </span>
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-3 py-2.5">
                  <dt className="text-slate-600 dark:text-slate-300">Existing holders after</dt>
                  <dd className="readout font-semibold text-slate-900 dark:text-slate-100">
                    {pct(result.foundersPctAfter, 2)}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-3 py-2.5">
                  <dt className="text-slate-600 dark:text-slate-300">
                    Same round, no SAFE stack
                  </dt>
                  <dd className="readout font-semibold text-slate-500 dark:text-slate-400">
                    {pct(result.foundersPctNoSafes, 2)}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-3 py-2.5">
                  <dt className="font-medium text-slate-700 dark:text-slate-200">
                    Extra dilution from the stack
                  </dt>
                  <dd className="readout text-lg font-bold text-rose-600 dark:text-rose-400">
                    {result.foundersExtraDilutionPts.toFixed(2)} points
                  </dd>
                </div>
              </dl>
              <p className="mt-3 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
                &ldquo;Points&rdquo; are percentage points of ownership. The stack&apos;s cost lands
                entirely on existing holders — post-money SAFEs dilute each other zero.
              </p>
            </div>

            {/* Per-SAFE ledger */}
            <div className="card p-6 sm:p-8">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Conversion ledger
              </h3>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                Company Capitalization {numFmt(Math.round(result.companyCapitalization))} shares ·
                round price {usd(result.roundPrice, 4)}/share.
              </p>
              <dl className="mt-3 divide-y divide-slate-100 text-sm dark:divide-white/[0.06]">
                {shareRows.map((o) => (
                  <div key={o.index} className="py-2.5">
                    <div className="flex items-center justify-between gap-3">
                      <dt className="min-w-0">
                        <span className="block font-medium text-slate-700 dark:text-slate-200">
                          SAFE {o.index + 1}
                          <span
                            className={`ml-2 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                              o.binding === 'cap'
                                ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300'
                                : o.binding === 'discount'
                                  ? 'bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300'
                                  : 'bg-sky-50 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300'
                            }`}
                          >
                            {BINDING_LABEL[o.binding]}
                          </span>
                        </span>
                        <span className="mt-0.5 block text-[11px] text-slate-500 dark:text-slate-400">
                          {usd(safes[o.index].amount, 0)} converts at {usd(o.safePrice, 4)}/share →{' '}
                          {pct(o.pctAfterRound, 2)} after the round
                        </span>
                      </dt>
                      <dd className="readout shrink-0 text-right font-semibold text-slate-900 dark:text-slate-100">
                        {numFmt(Math.round(o.shares))}
                        <span className="block text-[11px] font-normal text-slate-500 dark:text-slate-400">
                          shares
                        </span>
                      </dd>
                    </div>
                  </div>
                ))}
                <div className="flex items-center justify-between gap-3 py-2.5">
                  <dt className="text-slate-600 dark:text-slate-300">Series A new shares</dt>
                  <dd className="readout font-semibold text-slate-900 dark:text-slate-100">
                    {numFmt(Math.round(result.investorShares))}
                    <span className="ml-1.5 text-[11px] font-normal text-slate-500 dark:text-slate-400">
                      at {usd(result.roundPrice, 4)}
                    </span>
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-3 py-2.5">
                  <dt className="text-slate-600 dark:text-slate-300">Fully diluted after the round</dt>
                  <dd className="readout font-semibold text-slate-900 dark:text-slate-100">
                    {numFmt(Math.round(result.totalSharesAfter))}
                  </dd>
                </div>
              </dl>
              {overPriced.length > 0 && (
                <p className="mt-3 flex items-start gap-2 rounded-lg bg-amber-50 p-2.5 text-xs leading-relaxed text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500 dark:text-amber-400" aria-hidden="true" />
                  {overPriced.map((o) => `SAFE ${o.index + 1}`).join(', ')}{' '}
                  {overPriced.length === 1 ? 'converts' : 'convert'} <em>above</em> the round price — a
                  cap is a ceiling on the SAFE&apos;s price, not a floor. In a round priced below the
                  cap, a cap-only SAFE overpays relative to the new money; that is what the discount
                  term exists to fix.
                </p>
              )}
            </div>
          </>
        ) : (
          <div className="card p-6 sm:p-8">
            <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              <PieChart className="h-4 w-4" aria-hidden="true" />
              {status.state === 'empty' ? 'Nothing to convert yet' : 'These terms cannot close'}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
              {result.reason}
            </p>
            {status.state === 'invalid' && (
              <p className="mt-2 flex items-start gap-2 rounded-lg bg-amber-50 p-2.5 text-xs leading-relaxed text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500 dark:text-amber-400" aria-hidden="true" />
                Every active SAFE claims amount ÷ effective cap of the pre-round table, and those
                claims must sum below 100% before any priced round can close on top of them.
              </p>
            )}
          </div>
        )}
      </div>

      {/* ================= Sensitivity curve ================= */}
      {plotPts.length > 1 && (
        <div className="lg:col-span-5">
          <div className="card p-5 sm:p-6">
            <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
              <div>
                <h3 className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-slate-100">
                  <TrendingDown className="h-4 w-4 text-slate-400 dark:text-slate-500" aria-hidden="true" />
                  Next-round valuation → SAFE ownership
                </h3>
                <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                  The whole model recomputed at each valuation, {usdCompact(round.investment)} of new
                  money fixed. A colored segment means every active SAFE binds that way at that
                  price; slate stretches are stacks whose SAFEs bind on different terms.
                </p>
              </div>
              <span className="readout rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600 dark:bg-white/[0.05] dark:text-slate-300">
                now: {usdCompact(round.preMoney)} pre → SAFEs {result.valid ? pct(result.stackPctAfter, 2) : '—'}
              </span>
            </div>
            <ComparisonChart
              series={chartSeries}
              xLabel="Series A pre-money valuation"
              yLabel="Ownership after the round"
              xFormat={(n) => usdCompact(n)}
              yFormat={(n) => `${Math.round(n)}%`}
              height={300}
              marker={{ x: round.preMoney, label: 'your round' }}
              caption={
                kink !== null && kinkInWindow
                  ? `SAFE ${focusNo}'s protection switches terms at a pre-money of ${usdCompact(
                      kink,
                    )} (cap ÷ rate) — the valuation that separates the two regimes below. Under the discount side the SAFE pays a fixed share of an ever-cheaper round, so its slice shrinks as valuation rises; under the cap side its price is pinned and ownership climbs back toward the amount ÷ cap ceiling as round dilution thins.${
                      mixedLeg.length > 0
                        ? ' The slate stretch is where this stack’s SAFEs bind on different terms — each flips at its own cap ÷ rate crossover, and the stack’s combined kink is the blend of them.'
                        : ''
                    } The existing holders’ line (dashed green) mirrors the SAFE curve. Infeasible valuations (stack ≥ 100% of the pre-round table) are dropped, never clamped, and every point is the full conversion recomputed.`
                  : 'Every point is the full conversion recomputed, never an interpolation — SAFE stack ownership and existing holders\' stake at each candidate Series A valuation, segmented by how the stack binds. Infeasible valuations (stack ≥ 100% of the pre-round table) are dropped, not clamped.'
              }
            />
          </div>
        </div>
      )}
    </div>
  );
}

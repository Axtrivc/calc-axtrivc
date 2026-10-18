'use client';

import { useEffect, useMemo } from 'react';
import { AlertTriangle, Crosshair, Info, RotateCcw, TrendingUp } from 'lucide-react';
import NumberInput, { AnimatedNumber, CopyButton, SliderControl, StatCard } from '@/components/NumberInput';
import ScenarioButtons from '@/components/ScenarioButtons';
import ComparisonChart from '@/components/ComparisonChart';
import {
  BREAKEVEN_PRESETS,
  computeBreakEven,
  priceSweep,
  sensitivityGrid,
  type BreakEvenResult,
} from '@/lib/breakeven';
import { usd, usdCompact, numFmt, pct } from '@/lib/format';
import { useWorkbenchInputs, recordRecent } from '@/lib/workbench';

const SLUG = 'break-even-calculator';
const HREF = '/break-even-calculator/';
/** period: 0 = monthly, 1 = yearly. Presets are monthly, so preset clicks reset it to 0. */
const DEFAULTS = { ...BREAKEVEN_PRESETS[0].inputs, period: 0 };

export default function BreakEvenCalculator() {
  const { values, set, reset } = useWorkbenchInputs(SLUG, DEFAULTS);
  const { fixedCosts, price, unitVariableCost, currentUnits } = values;

  useEffect(() => {
    recordRecent(SLUG);
  }, []);

  // Period framing: the algebra is period-agnostic; the toggle exists so every
  // label matches the figures the visitor actually entered (monthly default).
  const monthly = values.period !== 1;
  const perLabel = monthly ? 'per month' : 'per year';
  const perShort = monthly ? '/mo' : '/yr';
  const perWord = monthly ? 'a month' : 'a year';
  const unitLabel = monthly ? 'units per month' : 'units per year';

  const result = useMemo(
    () => computeBreakEven({ fixedCosts, price, unitVariableCost, currentUnits }),
    [fixedCosts, price, unitVariableCost, currentUnits],
  );
  const sweep = useMemo(
    () => priceSweep(fixedCosts, price, unitVariableCost),
    [fixedCosts, price, unitVariableCost],
  );
  const sensitivity = useMemo(
    () => sensitivityGrid({ fixedCosts, price, unitVariableCost, currentUnits }),
    [fixedCosts, price, unitVariableCost, currentUnits],
  );

  const activePreset = BREAKEVEN_PRESETS.find(
    (p) =>
      Math.abs(p.inputs.fixedCosts - fixedCosts) < 0.01 &&
      Math.abs(p.inputs.price - price) < 0.01 &&
      Math.abs(p.inputs.unitVariableCost - unitVariableCost) < 0.01 &&
      Math.abs(p.inputs.currentUnits - currentUnits) < 0.01,
  );

  const impossible = result.status === 'impossible';
  const profitable = result.profitAtCurrent > 0.005;
  const zeroMargin = impossible && Math.abs(result.contributionMargin) < 0.005;

  const copySummary = impossible
    ? zeroMargin
      ? `No path to break-even: price ${usd(price)} equals variable cost ${usd(unitVariableCost)} — every sale contributes $0 toward ${usd(fixedCosts, 0)} of fixed costs.`
      : `No break-even point: price ${usd(price)} ≤ variable cost ${usd(unitVariableCost)} per unit — every sale loses ${usd(Math.abs(result.contributionMargin))}.`
    : `Break-even: ${numFmt(result.breakEvenUnits ?? 0, 1)} units ${perShort} (${usd(result.breakEvenRevenue ?? 0, 0)} revenue) at ${usd(price)} price, ${usd(unitVariableCost)} variable cost, ${usd(fixedCosts, 0)} fixed. CM ${result.cmRatioPct === null ? '—' : pct(result.cmRatioPct, 1)} · margin of safety ${result.marginOfSafetyPct === null ? '—' : pct(result.marginOfSafetyPct, 1)} at ${numFmt(currentUnits, 0)} units.`;

  const sweepPoints = sweep
    .filter((s) => s.breakEvenUnits !== null && Number.isFinite(s.breakEvenUnits))
    .map((s) => ({ x: s.price, y: s.breakEvenUnits as number }));
  const markerPrice =
    price > 0 && sweepPoints.length > 1
      ? Math.min(
          Math.max(price, sweepPoints[0].x),
          sweepPoints[sweepPoints.length - 1].x,
        )
      : null;

  return (
    <div className="grid gap-6 lg:grid-cols-5">
      {/* ================= Inputs ================= */}
      <div className="card p-6 sm:p-8 lg:col-span-2">
        <h2 className="mb-6 text-base font-semibold text-slate-900 dark:text-slate-100">
          Your unit economics
        </h2>

        {/* Period framing — every input label and every output below follows this. */}
        <div role="group" aria-label="Period for all inputs and outputs" className="mb-6">
          <p className="label mb-2">Period</p>
          <div className="flex flex-wrap gap-1.5">
            <PillButton
              active={monthly}
              onClick={() => set('period', 0)}
              ariaLabel="Use monthly figures for all inputs"
            >
              Monthly
            </PillButton>
            <PillButton
              active={!monthly}
              onClick={() => set('period', 1)}
              ariaLabel="Use yearly figures for all inputs"
            >
              Yearly
            </PillButton>
          </div>
          <p className="mt-2 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
            The math is period-agnostic — pick the period you budget in and enter figures for it;
            every label below follows. Ratios (CM %, margin of safety, leverage) are period-invariant
            either way.
          </p>
        </div>

        {/* Business-archetype presets */}
        <div role="group" aria-label="Business archetype presets" className="mb-6">
          <p className="label mb-2">Start from a business archetype</p>
          <div className="flex flex-wrap gap-1.5">
            {BREAKEVEN_PRESETS.map((p) => {
              const active = activePreset?.id === p.id;
              return (
                <PillButton
                  key={p.id}
                  active={active}
                  onClick={() => {
                    set('fixedCosts', p.inputs.fixedCosts);
                    set('price', p.inputs.price);
                    set('unitVariableCost', p.inputs.unitVariableCost);
                    set('currentUnits', p.inputs.currentUnits);
                    set('period', 0); // presets are stated per month
                  }}
                >
                  {p.label}
                </PillButton>
              );
            })}
          </div>
          <p className="mt-2 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
            {activePreset
              ? activePreset.description
              : 'Custom inputs — the math below is the same for any product, service, or subscription.'}
          </p>
        </div>

        <div className="space-y-6">
          <div>
            <NumberInput
              id="be-price"
              label="Price per unit"
              value={price}
              onChange={(n) => set('price', n)}
              min={0}
              max={100000}
              prefix="$"
              placeholder="79"
              helpText={`What one unit sells for. For subscriptions, the price of one account ${perLabel}.`}
            />
            <div className="mt-3">
              <SliderControl
                id="be-price-slider"
                label=""
                ariaLabel="Price per unit"
                value={price}
                onChange={(n) => set('price', n)}
                min={0}
                max={1000}
                step={1}
                prefix="$"
                presets={[19, 49, 79, 149]}
              />
            </div>
          </div>

          <div>
            <NumberInput
              id="be-vc"
              label="Variable cost per unit"
              value={unitVariableCost}
              onChange={(n) => set('unitVariableCost', n)}
              min={0}
              max={100000}
              prefix="$"
              placeholder="8"
              helpText="Costs that scale 1:1 with each sale: COGS, freight, payment fees, per-seat hosting, delivery labor."
            />
            <div className="mt-3">
              <SliderControl
                id="be-vc-slider"
                label=""
                ariaLabel="Variable cost per unit"
                value={unitVariableCost}
                onChange={(n) => set('unitVariableCost', n)}
                min={0}
                max={1000}
                step={1}
                prefix="$"
                presets={[5, 20, 41]}
              />
            </div>
          </div>

          <div>
            <NumberInput
              id="be-fixed"
              label={`Fixed costs (${perLabel})`}
              value={fixedCosts}
              onChange={(n) => set('fixedCosts', n)}
              min={0}
              max={10000000}
              prefix="$"
              placeholder="12,000"
              helpText="What you pay regardless of volume: salaries, rent, tools, insurance, minimum contracts."
            />
            <div className="mt-3">
              <SliderControl
                id="be-fixed-slider"
                label=""
                ariaLabel={`Fixed costs (${perLabel})`}
                value={fixedCosts}
                onChange={(n) => set('fixedCosts', n)}
                min={0}
                max={500000}
                step={500}
                prefix="$"
                logarithmic
                presets={[3000, 12000, 50000]}
              />
            </div>
          </div>

          <div>
            <NumberInput
              id="be-units"
              label={`Current volume (${unitLabel})`}
              value={currentUnits}
              onChange={(n) => set('currentUnits', n)}
              min={0}
              max={10000000}
              placeholder="400"
              helpText="What you sell (or forecast) today — anchors the margin of safety and profit readouts."
            />
            <div className="mt-3">
              <SliderControl
                id="be-units-slider"
                label=""
                ariaLabel={`Current volume (${unitLabel})`}
                value={currentUnits}
                onChange={(n) => set('currentUnits', n)}
                min={0}
                max={10000}
                step={10}
                presets={[100, 400, 1000]}
              />
            </div>
          </div>
        </div>

        <div className="mt-6 flex items-start gap-2 rounded-lg bg-slate-50 p-3 text-xs leading-relaxed text-slate-600 dark:bg-white/[0.03] dark:text-slate-300">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-slate-400 dark:text-slate-500" aria-hidden="true" />
          <p>
            Everything is stated {perLabel} and accrual-based: break-even means operating profit = 0
            for that period. Cash-out date is a different question — that is the{' '}
            <a href="/saas-runway-calculator/" className="font-medium text-indigo-600 underline dark:text-indigo-400">
              runway tool
            </a>
            &rsquo;s job.
          </p>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" onClick={reset} className="btn-ghost">
            <RotateCcw className="h-4 w-4 text-indigo-500 dark:text-indigo-300" aria-hidden="true" />
            Reset
          </button>
          <CopyButton text={copySummary} label="Copy result" />
          <ScenarioButtons
            slug={SLUG}
            shortTitle="Break-Even"
            href={HREF}
            params={{ fixedCosts, price, unitVariableCost, currentUnits }}
          />
        </div>
      </div>

      {/* ================= Results ================= */}
      <div className="space-y-4 lg:col-span-3">
        <div className="card p-6 sm:p-8">
          <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            <Crosshair className="h-4 w-4" aria-hidden="true" />
            Break-even point
          </h2>

          {impossible ? (
            <div className="mt-4 flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 dark:border-rose-500/30 dark:bg-rose-500/10">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-rose-600 dark:text-rose-400" aria-hidden="true" />
              <div>
                <p className="text-sm font-semibold text-rose-700 dark:text-rose-300">
                  {zeroMargin ? 'Price exactly equals variable cost' : 'No break-even exists at these prices'}
                </p>
                <p className="mt-1 text-sm leading-relaxed text-rose-700/90 dark:text-rose-300/90">
                  {zeroMargin ? (
                    <>
                      Each unit sells for {usd(price)} — exactly its variable cost — so every sale
                      contributes <strong className="readout">{usd(0)}</strong> toward{' '}
                      {usd(fixedCosts, 0)} of fixed costs. Volume neither deepens nor repairs the
                      loss; only a price above {usd(unitVariableCost)} (or a cost below it) opens a
                      path to break-even.
                    </>
                  ) : (
                    <>
                      Each unit sells for {usd(price)} but costs {usd(unitVariableCost)} in variable
                      costs alone — every sale loses{' '}
                      <strong className="readout">{usd(Math.abs(result.contributionMargin))}</strong>{' '}
                      before fixed costs. Volume makes it worse, not better. Fix the unit economics
                      first: raise price, cut per-unit cost, or stop selling this unit.
                    </>
                  )}
                </p>
              </div>
            </div>
          ) : (
            <>
              <div className="mt-3 flex flex-wrap items-end gap-x-6 gap-y-2">
                <div>
                  <AnimatedNumber
                    value={result.breakEvenUnits ?? 0}
                    format={(n) => numFmt(n, 0)}
                    className="readout block text-5xl font-extrabold tracking-tight text-slate-900 dark:text-white"
                  />
                  <span className="text-sm font-medium text-slate-500 dark:text-slate-400">
                    {unitLabel} to break even
                  </span>
                </div>
                <div className="pb-1">
                  <div className="readout text-2xl font-bold text-slate-700 dark:text-slate-200">
                    {usd(result.breakEvenRevenue ?? 0, 0)}
                  </div>
                  <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                    break-even revenue {perShort}
                  </span>
                </div>
              </div>
              {result.firstProfitableUnit !== null && result.breakEvenUnits !== null && result.breakEvenUnits > 0 && (
                <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                  Sale #{numFmt(result.firstProfitableUnit, 0)} is the first whole unit that turns
                  the period profitable — exactly {numFmt(result.breakEvenUnits, 1)} units is
                  the zero-profit point
                  {Number.isInteger(result.breakEvenUnits) ? ' (itself exactly flat, so the next unit counts)' : ''}.
                </p>
              )}
              {result.breakEvenUnits === 0 && (
                <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                  No fixed costs to cover — every sale is profitable from unit #1 at{' '}
                  {usd(result.contributionMargin)} of margin each.
                </p>
              )}
            </>
          )}

          {/* Verdict at current volume */}
          <div
            className={`mt-5 rounded-xl border p-4 ${
              impossible
                ? 'border-slate-200 bg-slate-50/60 dark:border-white/[0.08] dark:bg-white/[0.03]'
                : profitable
                  ? 'border-emerald-200 bg-emerald-50/60 dark:border-emerald-500/25 dark:bg-emerald-500/[0.08]'
                  : 'border-amber-200 bg-amber-50/60 dark:border-amber-500/25 dark:bg-amber-500/[0.08]'
            }`}
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span
                className={`text-xs font-semibold uppercase tracking-wide ${
                  impossible || profitable
                    ? 'text-slate-500 dark:text-slate-400'
                    : 'text-amber-700 dark:text-amber-300'
                }`}
              >
                {impossible
                  ? 'At your current volume'
                  : profitable
                    ? 'Profitable at current volume'
                    : result.status === 'at-be'
                      ? 'Exactly at break-even'
                      : 'Still below break-even'}
              </span>
              <span
                className={`readout text-lg font-bold ${
                  profitable
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : impossible
                      ? 'text-slate-700 dark:text-slate-200'
                      : 'text-amber-700 dark:text-amber-300'
                }`}
              >
                {profitable ? '+' : ''}
                {usd(result.profitAtCurrent, 0)}{perShort}
              </span>
            </div>
            <p className="mt-1.5 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
              {impossible
                ? zeroMargin
                  ? `Selling ${numFmt(currentUnits, 0)} units loses exactly ${usd(Math.abs(result.profitAtCurrent), 0)} ${perWord} regardless of volume — each sale contributes $0 toward fixed costs.`
                  : `Selling ${numFmt(currentUnits, 0)} units loses ${usd(Math.abs(result.profitAtCurrent), 0)} ${perWord} at this price/cost geometry — the loss scales linearly with volume.`
                : profitable
                  ? `At ${numFmt(currentUnits, 0)} units you clear break-even by ${numFmt(result.marginOfSafetyUnits ?? 0, 0)} units (${usd(result.marginOfSafetyRevenue ?? 0, 0)} of revenue). Volume can fall ${result.marginOfSafetyPct === null ? '—' : pct(result.marginOfSafetyPct, 1)} before profit hits zero.`
                  : `At ${numFmt(currentUnits, 0)} units you are ${numFmt(Math.abs(result.marginOfSafetyUnits ?? 0), 0)} units short of break-even — ${usd(Math.abs(result.marginOfSafetyRevenue ?? 0), 0)} of additional revenue to cover.`}
              {result.operatingLeverage !== null && (
                <>
                  {' '}Operating leverage{' '}
                  <strong className="readout">{numFmt(result.operatingLeverage, 2)}×</strong>: a
                  10% volume move swings profit by ~{pct(result.operatingLeverage * 10, 0)}.
                </>
              )}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <StatCard
            label="Contribution margin / unit"
            value={
              <span className={result.contributionMargin > 0 ? '' : 'text-rose-600 dark:text-rose-400'}>
                {usd(result.contributionMargin)}
              </span>
            }
            sublabel={`of each ${usd(price)} sale`}
          />
          <StatCard
            label="Contribution margin ratio"
            value={result.cmRatioPct === null ? '—' : pct(result.cmRatioPct, 1)}
            sublabel="of every revenue dollar"
          />
          <StatCard
            label="Margin of safety"
            value={result.marginOfSafetyPct === null ? '—' : pct(result.marginOfSafetyPct, 1)}
            sublabel="volume can fall this much"
            emphasis={result.marginOfSafetyPct !== null && result.marginOfSafetyPct >= 20}
          />
          <StatCard
            label="Profit at current volume"
            value={
              <span className={profitable ? 'text-emerald-600 dark:text-emerald-400' : result.profitAtCurrent < -0.005 ? 'text-rose-600 dark:text-rose-400' : ''}>
                {usd(result.profitAtCurrent, 0)}
              </span>
            }
            sublabel={`on ${usd(result.currentRevenue, 0)} revenue`}
          />
        </div>
      </div>

      {/* ================= CVP chart ================= */}
      <div className="lg:col-span-5">
        {impossible ? (
          <div className="card flex flex-wrap items-center justify-between gap-4 p-6">
            <div className="max-w-2xl">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Cost-volume-profit chart
              </h3>
              <p className="mt-1 text-sm leading-relaxed text-slate-500 dark:text-slate-400">
                With price at or below variable cost, the revenue line never crosses the cost line —
                there is no break-even point to draw. The chart appears once the price clears the
                per-unit variable cost of {usd(unitVariableCost)}.
              </p>
            </div>
            <span className="chip bg-rose-50 font-mono text-[10px] uppercase tracking-wider text-rose-700 dark:bg-rose-500/15 dark:text-rose-300">
              Q* undefined
            </span>
          </div>
        ) : (
          <CvpChart
            fixedCosts={fixedCosts}
            price={price}
            unitVariableCost={unitVariableCost}
            currentUnits={currentUnits}
            result={result}
            unitAxisLabel={unitLabel}
            moneyAxisLabel={monthly ? '$ per month' : '$ per year'}
            perLabel={perLabel}
          />
        )}
      </div>

      {/* ================= Price sweep + sensitivity ================= */}
      <div className="lg:col-span-3">
        {sweepPoints.length > 1 ? (
          <ComparisonChart
            series={[
              {
                label: 'Break-even units as price scans −40% to +60%',
                color: '#6366f1',
                points: sweepPoints,
                fillTo: 0,
              },
            ]}
            xLabel="Price per unit"
            yLabel={`Break-even units ${perShort}`}
            xFormat={(n) => usd(n, 0)}
            yFormat={(n) => numFmt(n, 0)}
            height={280}
            marker={markerPrice !== null ? { x: markerPrice, label: 'your price' } : undefined}
            caption="Every point re-solves fixed costs ÷ (price − variable cost) at that price. The curve is a hyperbola: price cuts near the variable-cost floor explode the break-even volume, while price rises at the top end buy less and less. Your price moves along this curve."
          />
        ) : (
          <div className="card p-6">
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              Break-even vs price
            </h3>
            <p className="mt-1 text-sm leading-relaxed text-slate-500 dark:text-slate-400">
              The scanned price band sits at or below the variable cost of {usd(unitVariableCost)}{' '}
              per unit, so no point on the curve has a defined break-even. Raise the price to see
              the curve.
            </p>
          </div>
        )}
      </div>

      <div className="lg:col-span-2">
        <div className="card h-full overflow-hidden">
          <div className="border-b border-slate-200 px-5 py-4 dark:border-white/[0.07]">
            <h3 className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-slate-100">
              <TrendingUp className="h-4 w-4 text-slate-400" aria-hidden="true" />
              Sensitivity: ±10% on each driver
            </h3>
            <p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
              Break-even units when one input moves 10%, all else fixed.{' '}
              {result.breakEvenUnits === null ? (
                <>
                  No break-even exists at current inputs — a green cell below is a driver move that{' '}
                  <strong className="readout">creates</strong> one.
                </>
              ) : (
                <>
                  Base: <strong className="readout">{numFmt(result.breakEvenUnits, 1)} units</strong>.
                </>
              )}
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="data-table min-w-full">
              <thead>
                <tr>
                  <th scope="col">Driver</th>
                  <th scope="col" className="text-right">−10%</th>
                  <th scope="col" className="text-right">+10%</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/[0.06]">
                {sensitivity.map((row) => (
                  <tr key={row.driver}>
                    <th scope="row" className="font-medium normal-case tracking-normal text-slate-700 dark:text-slate-300">
                      {row.label}
                    </th>
                    <td className="text-right">
                      <SensitivityCell value={row.down} base={result.breakEvenUnits} />
                    </td>
                    <td className="text-right">
                      <SensitivityCell value={row.up} base={result.breakEvenUnits} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="border-t border-slate-100 bg-slate-50/60 px-5 py-3 text-xs leading-relaxed text-slate-500 dark:border-white/[0.06] dark:bg-white/[0.02] dark:text-slate-400">
            Green = the break-even gets closer, rose = it recedes. A 10% price cut raises the
            break-even volume by more than 10% at <em>any</em> variable-cost share — 11.1% even with
            zero variable costs (1 ÷ 0.9 − 1), and the penalty climbs steeply as costs take a bigger
            share of price. That asymmetry is the mathematical argument against competing on price.
          </p>
        </div>
      </div>
    </div>
  );
}

function SensitivityCell({ value, base }: { value: number | null; base: number | null }) {
  if (value === null) {
    return <span className="readout text-slate-500 dark:text-slate-400">never</span>;
  }
  // No break-even at current inputs, but this driver move produces one — the
  // most actionable cell on the page (e.g. price ≤ VC today, +10% price
  // creates a break-even). Show the value, highlighted as an opening.
  if (base === null) {
    return (
      <span className="readout whitespace-nowrap font-semibold text-emerald-600 dark:text-emerald-400">
        {numFmt(value, 1)}
      </span>
    );
  }
  // A higher break-even volume is always worse, lower always better — for
  // every driver, whichever direction produces it.
  const better = value < base * 0.999;
  const worse = value > base * 1.001;
  return (
    <span
      className={`readout whitespace-nowrap font-semibold ${
        worse
          ? 'text-rose-600 dark:text-rose-400'
          : better
            ? 'text-emerald-600 dark:text-emerald-400'
            : 'text-slate-600 dark:text-slate-300'
      }`}
    >
      {numFmt(value, 1)}
    </span>
  );
}

/** Shared preset/period pill button — active and hover states pair light/dark. */
function PillButton({
  active,
  onClick,
  ariaLabel,
  children,
}: {
  active: boolean;
  onClick: () => void;
  ariaLabel?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      aria-label={ariaLabel}
      onClick={onClick}
      className={`rounded-full px-3 py-1.5 text-xs font-medium transition-all duration-150 focus-calm ${
        active
          ? 'border border-indigo-500 bg-indigo-50 text-indigo-700 dark:border-indigo-400 dark:bg-indigo-500/15 dark:text-indigo-300'
          : 'border border-slate-200 bg-white text-slate-500 hover:border-indigo-300 hover:text-indigo-600 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-400 dark:hover:border-indigo-400/50 dark:hover:text-indigo-300'
      }`}
    >
      {children}
    </button>
  );
}

/* ===================== Classic CVP chart (hand-drawn SVG) ===================== */

/** Round `x` up to a "nice" axis multiple (1/2/2.5/5 × 10^k) covering the data. */
function niceCeil(x: number): number {
  if (!Number.isFinite(x) || x <= 0) return 1;
  const mag = Math.pow(10, Math.floor(Math.log10(x)));
  const norm = x / mag;
  const step = (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10) * mag;
  return Math.ceil(x / step) * step;
}

/** Mirror of ComparisonChart's private tick picker — kept local so this chart
 *  reads with identical rhythm on the page. */
function niceTicks(min: number, max: number, count = 4): number[] {
  if (!Number.isFinite(min) || !Number.isFinite(max) || min === max) return [min];
  const span = max - min;
  const rawStep = span / count;
  const mag = Math.pow(10, Math.floor(Math.log10(rawStep)));
  const norm = rawStep / mag;
  const step = (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10) * mag;
  const ticks: number[] = [];
  for (let t = min; t <= max + step / 2; t += step) {
    ticks.push(Math.abs(t) < step / 1e6 ? 0 : t);
  }
  return ticks;
}

const CVP_W = 720;
const CVP_H = 340;
const CVP_M = { top: 18, right: 18, bottom: 40, left: 64 };

function CvpChart({
  fixedCosts,
  price,
  unitVariableCost,
  currentUnits,
  result,
  unitAxisLabel,
  moneyAxisLabel,
  perLabel,
}: {
  fixedCosts: number;
  price: number;
  unitVariableCost: number;
  currentUnits: number;
  result: BreakEvenResult;
  unitAxisLabel: string;
  moneyAxisLabel: string;
  perLabel: string;
}) {
  const iw = CVP_W - CVP_M.left - CVP_M.right;
  const ih = CVP_H - CVP_M.top - CVP_M.bottom;

  const be = result.breakEvenUnits ?? 0;
  // Give the chart air on both sides of the interesting points.
  const xMax = niceCeil(Math.max(be * 1.35, currentUnits * 1.15, 10));
  const revenueAt = (q: number) => q * price;
  const costAt = (q: number) => fixedCosts + q * unitVariableCost;
  const yMax = Math.max(revenueAt(xMax), costAt(xMax), 1) * 1.04;

  const sx = (q: number) => CVP_M.left + (q / xMax) * iw;
  const sy = (v: number) => CVP_M.top + ih - (v / yMax) * ih;

  const xTicks = niceTicks(0, xMax, 5);
  const yTicks = niceTicks(0, yMax, 4);

  const hasBe = result.breakEvenUnits !== null && be > 0 && be <= xMax;
  const beX = sx(be);
  const beY = sy(revenueAt(be));

  // Region labels only where the wedges have visible area.
  const showLossLabel = hasBe && be > xMax * 0.12;
  const showProfitLabel = hasBe && xMax - be > xMax * 0.12;
  const lossLabelX = sx(be * 0.28);
  const lossLabelY = sy((revenueAt(be * 0.28) + costAt(be * 0.28)) / 2);
  const profitMidQ = be + (xMax - be) * 0.55;
  const profitLabelX = sx(profitMidQ);
  const profitLabelY = sy((revenueAt(profitMidQ) + costAt(profitMidQ)) / 2);

  const showCurrent = currentUnits > xMax * 0.01 && Math.abs(currentUnits - be) > xMax * 0.02;

  return (
    <figure className="card m-0 overflow-hidden p-5 sm:p-6">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
            Cost-volume-profit chart
          </h3>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            Revenue and total cost as volume grows — the wedges are the loss and the profit.
          </p>
        </div>
        {hasBe && (
          <span className="readout rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600 dark:bg-white/[0.05] dark:text-slate-300">
            Q* = {numFmt(be, 1)} units · {usd(result.breakEvenRevenue ?? 0, 0)}
          </span>
        )}
      </div>

      <svg
        viewBox={`0 0 ${CVP_W} ${CVP_H}`}
        className="h-auto w-full"
        role="img"
        aria-label={`Cost-volume-profit chart: revenue ${perLabel} versus total cost ${perLabel} across unit volume. Break-even at ${numFmt(be, 1)} units (${usd(result.breakEvenRevenue ?? 0, 0)}). ${result.status === 'above-be' ? 'Current volume is past break-even.' : result.status === 'below-be' ? 'Current volume is below break-even.' : ''}`}
      >
        {/* Grid + y axis */}
        {yTicks.map((t) => (
          <g key={`y-${t}`}>
            <line
              x1={CVP_M.left}
              x2={CVP_W - CVP_M.right}
              y1={sy(t)}
              y2={sy(t)}
              stroke="currentColor"
              className="text-slate-200 dark:text-white/10"
              strokeWidth={1}
            />
            <text
              x={CVP_M.left - 8}
              y={sy(t) + 3.5}
              textAnchor="end"
              className="fill-slate-500 font-mono dark:fill-slate-400 print:fill-slate-600 dark:print:fill-slate-600"
              fontSize="10"
            >
              {usdCompact(t)}
            </text>
          </g>
        ))}
        {/* x axis ticks + baseline */}
        <line
          x1={CVP_M.left}
          x2={CVP_W - CVP_M.right}
          y1={CVP_M.top + ih}
          y2={CVP_M.top + ih}
          stroke="currentColor"
          className="text-slate-300 dark:text-white/20"
          strokeWidth={1}
        />
        {xTicks.map((t) => (
          <text
            key={`x-${t}`}
            x={sx(t)}
            y={CVP_H - CVP_M.bottom + 16}
            textAnchor="middle"
            className="fill-slate-500 font-mono dark:fill-slate-400 print:fill-slate-600 dark:print:fill-slate-600"
            fontSize="10"
          >
            {numFmt(t, 0)}
          </text>
        ))}
        {/* axis titles */}
        <text x={CVP_M.left} y={12} className="fill-slate-500 dark:fill-slate-400 print:fill-slate-600 dark:print:fill-slate-600" fontSize="9.5">
          {moneyAxisLabel}
        </text>
        <text
          x={CVP_W - CVP_M.right}
          y={CVP_H - 4}
          textAnchor="end"
          className="fill-slate-500 dark:fill-slate-400 print:fill-slate-600 dark:print:fill-slate-600"
          fontSize="9.5"
        >
          {unitAxisLabel}
        </text>

        {/* Loss wedge: origin → break-even → fixed-cost intercept */}
        {hasBe && (
          <path
            d={`M${sx(0).toFixed(1)},${sy(0).toFixed(1)} L${beX.toFixed(1)},${beY.toFixed(1)} L${sx(0).toFixed(1)},${sy(costAt(0)).toFixed(1)} Z`}
            fill="#f43f5e"
            opacity="0.14"
          />
        )}
        {/* Profit wedge: break-even → right edge, between the two lines */}
        {hasBe && (
          <path
            d={`M${beX.toFixed(1)},${beY.toFixed(1)} L${sx(xMax).toFixed(1)},${sy(revenueAt(xMax)).toFixed(1)} L${sx(xMax).toFixed(1)},${sy(costAt(xMax)).toFixed(1)} Z`}
            fill="#10b981"
            opacity="0.12"
          />
        )}

        {/* Total cost line: fixed intercept, slope = variable cost */}
        <path
          d={`M${sx(0).toFixed(1)},${sy(costAt(0)).toFixed(1)} L${sx(xMax).toFixed(1)},${sy(costAt(xMax)).toFixed(1)}`}
          fill="none"
          stroke="#0ea5e9"
          strokeWidth={2.5}
          strokeLinecap="round"
        />
        {/* Revenue line from the origin */}
        <path
          d={`M${sx(0).toFixed(1)},${sy(0).toFixed(1)} L${sx(xMax).toFixed(1)},${sy(revenueAt(xMax)).toFixed(1)}`}
          fill="none"
          stroke="#6366f1"
          strokeWidth={2.5}
          strokeLinecap="round"
        />

        {/* Break-even point + dashed guides to both axes */}
        {hasBe && (
          <g>
            <line
              x1={beX}
              x2={beX}
              y1={beY}
              y2={CVP_M.top + ih}
              stroke="#f59e0b"
              strokeWidth={1.5}
              strokeDasharray="5 4"
            />
            <line
              x1={CVP_M.left}
              x2={beX}
              y1={beY}
              y2={beY}
              stroke="#f59e0b"
              strokeWidth={1.5}
              strokeDasharray="5 4"
            />
            <circle cx={beX} cy={beY} r={5} fill="#f59e0b" stroke="#fff" strokeWidth={2} className="dark:stroke-[#0b1220]" />
            <text
              x={beX + 8}
              y={beY - 8}
              className="fill-amber-600 font-mono dark:fill-amber-400"
              fontSize="10"
              fontWeight={700}
            >
              break-even
            </text>
          </g>
        )}

        {/* Current-volume marker */}
        {showCurrent && (
          <g>
            <line
              x1={sx(currentUnits)}
              x2={sx(currentUnits)}
              y1={CVP_M.top}
              y2={CVP_M.top + ih}
              stroke="currentColor"
              className="text-slate-400 dark:text-slate-500"
              strokeWidth={1.5}
              strokeDasharray="3 4"
            />
            <text
              x={sx(currentUnits)}
              y={CVP_M.top + 10}
              textAnchor={sx(currentUnits) > CVP_W * 0.75 ? 'end' : 'start'}
              className="fill-slate-500 font-mono dark:fill-slate-400 print:fill-slate-600 dark:print:fill-slate-600"
              fontSize="9.5"
            >
              now: {numFmt(currentUnits, 0)}
            </text>
          </g>
        )}

        {/* Region labels */}
        {showLossLabel && (
          <text x={lossLabelX} y={lossLabelY} textAnchor="middle" className="fill-rose-500 dark:fill-rose-400" fontSize="10" fontWeight={700} letterSpacing="0.08em">
            LOSS
          </text>
        )}
        {showProfitLabel && (
          <text x={profitLabelX} y={profitLabelY} textAnchor="middle" className="fill-emerald-600 dark:fill-emerald-400" fontSize="10" fontWeight={700} letterSpacing="0.08em">
            PROFIT
          </text>
        )}
      </svg>

      <figcaption className="mt-4">
        <ul className="flex flex-wrap gap-x-5 gap-y-1.5">
          <li className="flex items-center gap-2 text-xs font-medium text-slate-600 dark:text-slate-300">
            <span aria-hidden="true" className="inline-block h-2 w-4 rounded-full bg-[#6366f1]" />
            Revenue = price × volume
          </li>
          <li className="flex items-center gap-2 text-xs font-medium text-slate-600 dark:text-slate-300">
            <span aria-hidden="true" className="inline-block h-2 w-4 rounded-full bg-[#0ea5e9]" />
            Total cost = fixed + variable × volume
          </li>
          <li className="flex items-center gap-2 text-xs font-medium text-slate-600 dark:text-slate-300">
            <span aria-hidden="true" className="inline-block h-2 w-4 rounded-full bg-[#f59e0b]" />
            Break-even: {numFmt(be, 1)} units
          </li>
        </ul>
        <p className="mt-2 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
          Left of the amber point every additional sale shrinks the loss by the contribution
          margin; right of it, every sale adds the same margin as profit. The wedges are exact —
          they are the two linear equations, not a sketch.
        </p>
      </figcaption>
    </figure>
  );
}

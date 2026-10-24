'use client';

import { useEffect, useMemo } from 'react';
import { AlertTriangle, Info, RotateCcw, Tags, TrendingDown } from 'lucide-react';
import NumberInput, { AnimatedNumber, CopyButton, SliderControl, StatCard } from '@/components/NumberInput';
import ScenarioButtons from '@/components/ScenarioButtons';
import ComparisonChart from '@/components/ComparisonChart';
import {
  DISCOUNT_PRESETS,
  computeDiscount,
  couponVsStraight,
  profitAtResponse,
  profitDeltaAtResponse,
  responseSweep,
  type DiscountInputs,
} from '@/lib/discount';
import { usd, usdCompact, numFmt, pct } from '@/lib/format';
import { useWorkbenchInputs, recordRecent } from '@/lib/workbench';

const SLUG = 'discount-impact-calculator';
const HREF = '/discount-impact-calculator/';
/** period: 0 = monthly, 1 = yearly. Presets are monthly, so preset clicks reset it to 0. */
const DEFAULTS = {
  ...DISCOUNT_PRESETS[1].inputs,
  upliftPct: DISCOUNT_PRESETS[1].expectedUpliftPct,
  couponThreshold: 100,
  couponOff: 15,
  basket: 250,
  period: 0,
};

export default function DiscountCalculator() {
  const { values, set, reset } = useWorkbenchInputs(SLUG, DEFAULTS);
  const { price, unitCost, volume, discountPct, upliftPct, couponThreshold, couponOff, basket } = values;

  useEffect(() => {
    recordRecent(SLUG);
  }, []);

  // Period framing: the algebra is period-agnostic; the toggle keeps every
  // label matched to the figures the visitor actually entered.
  const monthly = values.period !== 1;
  const perShort = monthly ? '/mo' : '/yr';
  const perWord = monthly ? 'a month' : 'a year';
  const perLabel = monthly ? 'per month' : 'per year';
  const unitLabel = monthly ? 'units per month' : 'units per year';

  const inputs: DiscountInputs = { price, unitCost, volume, discountPct };
  const result = useMemo(
    () => computeDiscount({ price, unitCost, volume, discountPct }),
    [price, unitCost, volume, discountPct],
  );
  const coupon = useMemo(
    () => couponVsStraight(couponThreshold, couponOff, basket, discountPct),
    [couponThreshold, couponOff, basket, discountPct],
  );

  // Sweep range: wide enough to always contain the profit-neutral crossing
  // when one exists — the marker must land strictly inside the x-axis, so the
  // range is sized from the crossing itself with no cap. Discounts that graze
  // the margin line have crossings far beyond 600%, and hiding the marker
  // there would hide the answer.
  const be = result.profitNeutralUpliftPct;
  const sweepMax = be === null ? 200 : Math.max(200, Math.ceil((be * 1.1) / 50) * 50);
  const sweep = useMemo(
    () => responseSweep({ price, unitCost, volume, discountPct }, sweepMax, 45),
    [price, unitCost, volume, discountPct, sweepMax],
  );

  const profitAtAssumed = profitAtResponse(inputs, upliftPct);
  const profitDelta = profitDeltaAtResponse(inputs, upliftPct);
  const newVolume = volume * (1 + upliftPct / 100);
  const gmFell =
    result.baseGrossMarginPct !== null &&
    result.discountedGrossMarginPct !== null &&
    result.discountedGrossMarginPct < result.baseGrossMarginPct;

  const activePreset = DISCOUNT_PRESETS.find(
    (p) =>
      Math.abs(p.inputs.price - price) < 0.01 &&
      Math.abs(p.inputs.unitCost - unitCost) < 0.01 &&
      Math.abs(p.inputs.volume - volume) < 0.01 &&
      Math.abs(p.inputs.discountPct - discountPct) < 0.01 &&
      Math.abs(p.expectedUpliftPct - upliftPct) < 0.01,
  );

  const viable = result.status === 'viable';
  const unrecoverable = result.status === 'unrecoverable';
  const underwater = result.status === 'underwater';
  const noDiscount = result.status === 'no-discount';
  const noPrice = result.status === 'no-price';

  // Headline severity tiers for the required-uplift readout.
  const headlineClass =
    !viable
      ? 'text-slate-700 dark:text-slate-200'
      : be !== null && be <= 25
        ? 'text-emerald-600 dark:text-emerald-400'
        : be !== null && be <= 60
          ? 'text-amber-600 dark:text-amber-400'
          : 'text-rose-600 dark:text-rose-400';

  const copySummary = noPrice
    ? 'No list price entered yet — the discount math needs a price to work from.'
    : underwater
      ? result.baseUnitMargin < -0.005
        ? `No margin to discount: price ${usd(price)} does not clear unit cost ${usd(unitCost)} — this product loses ${usd(Math.abs(result.baseUnitMargin))} per unit before any discount.`
        : `No margin to discount: price ${usd(price)} exactly equals unit cost ${usd(unitCost)} — every sale contributes $0 of margin, so no discount can be paid for at any volume.`
      : unrecoverable
        ? `A ${pct(discountPct, 1)} discount meets or exceeds the full ${result.baseGrossMarginPct === null ? '—' : pct(result.baseGrossMarginPct, 1)} gross margin — no volume increase can hold profit flat.`
        : noDiscount
          ? `No discount on trial (0% off). The assumed +${pct(upliftPct, 0)} response is plain baseline growth at the list price: profit changes ${profitDelta >= 0 ? '+' : '−'}${usd(Math.abs(profitDelta), 0)} ${perShort} with no promotion running.`
          : `${pct(discountPct, 1)} off at ${result.baseGrossMarginPct === null ? '—' : pct(result.baseGrossMarginPct, 1)} gross margin needs +${pct(be ?? 0, 1)} volume to hold profit flat (revenue-only floor: +${pct(result.revenueNeutralUpliftPct, 1)}). At your assumed +${pct(upliftPct, 0)} response, profit changes ${profitDelta >= 0 ? '+' : '−'}${usd(Math.abs(profitDelta), 0)} ${perShort}.`;

  return (
    <div className="grid gap-6 lg:grid-cols-5">
      {/* ================= Inputs ================= */}
      <div className="card p-6 sm:p-8 lg:col-span-3">
        <h2 className="mb-6 text-base font-semibold text-slate-900 dark:text-slate-100">
          The discount on trial
        </h2>

        {/* Period framing */}
        <div role="group" aria-label="Period for all inputs and outputs" className="mb-6">
          <p className="label mb-2">Period</p>
          <div className="flex flex-wrap gap-1.5">
            <PillButton active={monthly} onClick={() => set('period', 0)} ariaLabel="Use monthly figures for all inputs">
              Monthly
            </PillButton>
            <PillButton active={!monthly} onClick={() => set('period', 1)} ariaLabel="Use yearly figures for all inputs">
              Yearly
            </PillButton>
          </div>
          <p className="mt-2 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
            The math is period-agnostic — pick the period you budget in and enter figures for it;
            every label below follows. The uplift percentages are period-invariant either way.
          </p>
        </div>

        {/* Business-archetype presets */}
        <div role="group" aria-label="Business archetype presets" className="mb-6">
          <p className="label mb-2">Start from a business archetype</p>
          <div className="flex flex-wrap gap-1.5">
            {DISCOUNT_PRESETS.map((p) => {
              const active = activePreset?.id === p.id;
              return (
                <PillButton
                  key={p.id}
                  active={active}
                  onClick={() => {
                    set('price', p.inputs.price);
                    set('unitCost', p.inputs.unitCost);
                    set('volume', p.inputs.volume);
                    set('discountPct', p.inputs.discountPct);
                    set('upliftPct', p.expectedUpliftPct);
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
              id="disc-price"
              label="Original price per unit"
              value={price}
              onChange={(n) => set('price', n)}
              min={0}
              max={1000000}
              prefix="$"
              placeholder="89"
              helpText={`The list price — what the unit sells for before any promotion. Gross margin: ${
                result.baseGrossMarginPct === null ? '—' : pct(result.baseGrossMarginPct, 1)
              }.`}
            />
            <div className="mt-3">
              <SliderControl
                id="disc-price-slider"
                label=""
                ariaLabel="Original price per unit"
                value={price}
                onChange={(n) => set('price', n)}
                min={0}
                max={1000}
                step={1}
                prefix="$"
                presets={[19, 49, 79, 89, 149]}
              />
            </div>
          </div>

          <div>
            <NumberInput
              id="disc-cost"
              label="Variable cost per unit"
              value={unitCost}
              onChange={(n) => set('unitCost', n)}
              min={0}
              max={1000000}
              prefix="$"
              placeholder="41"
              helpText="Costs that scale 1:1 with each sale: COGS, freight, payment fees, per-seat hosting, delivery labor. Fixed costs cancel out of the hold-profit-flat math."
            />
            <div className="mt-3">
              <SliderControl
                id="disc-cost-slider"
                label=""
                ariaLabel="Variable cost per unit"
                value={unitCost}
                onChange={(n) => set('unitCost', n)}
                min={0}
                max={1000}
                step={1}
                prefix="$"
                presets={[8, 20, 41, 60]}
              />
            </div>
            {underwater && (
              <p className="mt-2 flex items-start gap-2 rounded-lg bg-rose-50 p-2.5 text-xs leading-relaxed text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-rose-500 dark:text-rose-400" aria-hidden="true" />
                {result.baseUnitMargin < -0.005 ? (
                  <>
                    Price does not clear unit cost — each unit already loses{' '}
                    <strong className="readout">{usd(Math.abs(result.baseUnitMargin))}</strong> before
                    any discount. Fix the unit economics first; volume makes this worse, not better.
                  </>
                ) : (
                  <>
                    Price exactly equals unit cost — every sale contributes{' '}
                    <strong className="readout">{usd(0)}</strong> of margin. There is nothing to
                    discount until the price clears the per-unit cost of {usd(unitCost)}.
                  </>
                )}
              </p>
            )}
          </div>

          <div>
            <NumberInput
              id="disc-volume"
              label={`Current volume (${unitLabel})`}
              value={volume}
              onChange={(n) => set('volume', n)}
              min={0}
              max={10000000}
              placeholder="300"
              helpText="What you sell (or forecast) at the list price — anchors the profit ledger below."
            />
            <div className="mt-3">
              <SliderControl
                id="disc-volume-slider"
                label=""
                ariaLabel={`Current volume (${unitLabel})`}
                value={volume}
                onChange={(n) => set('volume', n)}
                min={0}
                max={10000}
                step={10}
                presets={[100, 300, 1000]}
              />
            </div>
          </div>

          <div>
            <NumberInput
              id="disc-rate"
              label="Discount rate"
              value={discountPct}
              onChange={(n) => set('discountPct', n)}
              min={0}
              max={95}
              suffix="%"
              placeholder="20"
              helpText="Straight percentage off the list price — the coupon panel below compares it against a spend-threshold deal."
            />
            <div className="mt-3">
              <SliderControl
                id="disc-rate-slider"
                label=""
                ariaLabel="Discount rate"
                value={discountPct}
                onChange={(n) => set('discountPct', n)}
                min={0}
                max={50}
                step={0.5}
                suffix="% off"
                presets={[5, 10, 15, 20, 25, 30]}
              />
            </div>
            {unrecoverable && (
              <p className="mt-2 flex items-start gap-2 rounded-lg bg-rose-50 p-2.5 text-xs leading-relaxed text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-rose-500 dark:text-rose-400" aria-hidden="true" />
                {pct(discountPct, 1)} off consumes the entire{' '}
                {result.baseGrossMarginPct === null ? '—' : pct(result.baseGrossMarginPct, 1)} gross
                margin — the discounted unit margin is{' '}
                <strong className="readout">{usd(result.discountedUnitMargin)}</strong>. No volume
                increase can hold profit flat; more sales now add equal or worse gross profit.
              </p>
            )}
          </div>

          <div>
            <NumberInput
              id="disc-uplift"
              label="Volume response you expect"
              value={upliftPct}
              onChange={(n) => set('upliftPct', n)}
              min={0}
              max={1000}
              suffix="%"
              placeholder="25"
              helpText="How much extra volume the discount actually delivers (0 = nobody new buys). The verdict card scores this assumption against the requirement."
            />
            <div className="mt-3">
              <SliderControl
                id="disc-uplift-slider"
                label=""
                ariaLabel="Expected volume response"
                value={upliftPct}
                onChange={(n) => set('upliftPct', n)}
                min={0}
                max={300}
                step={5}
                suffix="% more units"
                presets={[10, 25, 50, 100]}
              />
            </div>
          </div>
        </div>

        <div className="mt-6 flex items-start gap-2 rounded-lg bg-slate-50 p-3 text-xs leading-relaxed text-slate-600 dark:bg-white/[0.03] dark:text-slate-300">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-slate-400 dark:text-slate-500" aria-hidden="true" />
          <p>
            Profit here means gross profit — (price − variable cost) × volume. Fixed costs do not
            change when a discount runs, so they cancel out of the hold-profit-flat condition; the
            volume needed to cover them is the{' '}
            <a href="/break-even-calculator/" className="font-medium text-indigo-600 underline dark:text-indigo-400">
              break-even tool
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
            shortTitle="Discount Impact"
            href={HREF}
            params={{ price, unitCost, volume, discountPct, upliftPct }}
          />
        </div>
      </div>

      {/* ================= Results ================= */}
      <div className="space-y-4 lg:col-span-2">
        {/* Headline: the required uplift */}
        <div className="card p-6 sm:p-8">
          <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            <TrendingDown className="h-4 w-4" aria-hidden="true" />
            Volume needed to hold profit flat
          </h2>

          {viable || noDiscount ? (
            <>
              <div className="mt-3">
                <AnimatedNumber
                  value={be ?? 0}
                  format={(n) => `+${pct(n, 1)}`}
                  className={`readout mt-1 block text-5xl font-extrabold tracking-tight ${headlineClass}`}
                />
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  more {activePreset?.unitNoun ?? 'units'} {perWord}, just to stand still
                  {be !== null && result.breakEvenVolume !== null && (
                    <> — {numFmt(result.breakEvenVolume, 0)} {monthly ? 'per month' : 'per year'} total</>
                  )}
                  .
                </p>
              </div>
              <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50/60 p-4 dark:border-white/[0.08] dark:bg-white/[0.03]">
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    The number everyone quotes
                  </span>
                  <span className="readout text-lg font-bold text-slate-700 dark:text-slate-200">
                    +{pct(result.revenueNeutralUpliftPct, 1)}
                  </span>
                </div>
                <p className="mt-1.5 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                  The revenue-only floor 1 ÷ (1 − d) − 1 — it preserves profit only when the unit
                  cost is zero. Your costs push the real requirement up by{' '}
                  <strong className="readout">
                    {be !== null && be > 0 ? `${numFmt(be / result.revenueNeutralUpliftPct, 2)}×` : '—'}
                  </strong>
                  .
                </p>
              </div>
            </>
          ) : noPrice ? (
            <div className="mt-4 flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50/60 p-4 dark:border-white/[0.08] dark:bg-white/[0.03]">
              <Info className="mt-0.5 h-5 w-5 shrink-0 text-slate-400 dark:text-slate-500" aria-hidden="true" />
              <div>
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                  Waiting for a list price
                </p>
                <p className="mt-1 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                  Enter a price above zero — the required-uplift math needs a price to cut, and every
                  other figure on this page follows from it.
                </p>
              </div>
            </div>
          ) : (
            <div className="mt-4 flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 dark:border-rose-500/30 dark:bg-rose-500/10">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-rose-600 dark:text-rose-400" aria-hidden="true" />
              <div>
                <p className="text-sm font-semibold text-rose-700 dark:text-rose-300">
                  {underwater ? 'No margin to discount' : 'No volume can save this discount'}
                </p>
                <p className="mt-1 text-sm leading-relaxed text-rose-700/90 dark:text-rose-300/90">
                  {underwater
                    ? result.baseUnitMargin < -0.005
                      ? `Each unit already loses ${usd(Math.abs(result.baseUnitMargin))} before any promotion — discounting deepens a per-unit loss that volume multiplies.`
                      : `Price exactly equals unit cost — every sale contributes ${usd(0)} of margin, and no volume multiplies zero back into profit. Only a price above ${usd(unitCost)} opens the question.`
                    : `The ${pct(discountPct, 1)} cut consumes the entire ${result.baseGrossMarginPct === null ? '—' : pct(result.baseGrossMarginPct, 1)} gross margin (discounted unit margin ${usd(result.discountedUnitMargin)}). Every candidate discount below the margin line has a finite answer — this one does not.`}
                </p>
              </div>
            </div>
          )}

          {/* Verdict at the assumed response */}
          <div
            className={`mt-5 rounded-xl border p-4 ${
              !viable
                ? 'border-slate-200 bg-slate-50/60 dark:border-white/[0.08] dark:bg-white/[0.03]'
                : profitDelta > 0.005
                  ? 'border-emerald-200 bg-emerald-50/60 dark:border-emerald-500/25 dark:bg-emerald-500/[0.08]'
                  : 'border-amber-200 bg-amber-50/60 dark:border-amber-500/25 dark:bg-amber-500/[0.08]'
            }`}
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span
                className={`text-xs font-semibold uppercase tracking-wide ${
                  viable && profitDelta <= 0.005 ? 'text-amber-700 dark:text-amber-300' : 'text-slate-500 dark:text-slate-400'
                }`}
              >
                {noPrice
                  ? 'Waiting for a price'
                  : noDiscount
                    ? 'No discount on trial'
                    : viable
                      ? profitDelta > 0.005
                        ? `Discount pays off at +${pct(upliftPct, 0)} response`
                        : `Discount loses money at +${pct(upliftPct, 0)} response`
                      : 'At your assumed response'}
              </span>
              <span
                className={`readout text-lg font-bold ${
                  noPrice || noDiscount
                    ? 'text-slate-700 dark:text-slate-200'
                    : profitDelta > 0.005
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : profitDelta < -0.005
                        ? 'text-rose-600 dark:text-rose-400'
                        : 'text-slate-700 dark:text-slate-200'
                }`}
              >
                {profitDelta > 0.005 ? '+' : profitDelta < -0.005 ? '−' : ''}
                {usd(Math.abs(profitDelta), 0)}
                {perShort}
              </span>
            </div>
            <p className="mt-1.5 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
              {noPrice ? (
                <>Enter a list price above zero — every figure in this ledger follows from it.</>
              ) : noDiscount ? (
                <>
                  The discount rate is 0% — there is no promotion on trial. The +{pct(upliftPct, 0)}{' '}
                  response is plain baseline growth at the list price; raise the discount rate to
                  analyze what a promotion would cost and require.
                </>
              ) : viable ? (
                <>
                  At {numFmt(newVolume, 0)} units the discount nets{' '}
                  {usd(profitAtAssumed, 0)} of gross profit {perShort} versus {usd(result.baseGrossProfit, 0)}{' '}
                  today{profitDelta <= 0.005 && be !== null ? <> — you would need at least +{pct(be, 1)} response to break even on the promotion</> : <> — {usd(Math.abs(profitDelta), 0)} better than holding the list price</>}.
                </>
              ) : (
                <>The gross-profit ledger below still runs at your assumed +{pct(upliftPct, 0)} — but no response level repairs a discount at or beyond the full margin.</>
              )}
            </p>
          </div>
        </div>

        {/* Unit-economics grid */}
        <div className="grid grid-cols-2 gap-4">
          <StatCard
            label="Gross margin"
            value={
              <>
                {result.baseGrossMarginPct === null ? '—' : pct(result.baseGrossMarginPct, 1)}
                <span className="mx-1 text-slate-400 dark:text-slate-500">→</span>
                <span className={gmFell ? 'text-rose-600 dark:text-rose-400' : ''}>
                  {result.discountedGrossMarginPct === null ? '—' : pct(result.discountedGrossMarginPct, 1)}
                </span>
              </>
            }
            sublabel="before → after the discount"
          />
          <StatCard
            label="Unit margin"
            value={
              <>
                {usd(result.baseUnitMargin)}
                <span className="mx-1 text-slate-400 dark:text-slate-500">→</span>
                <span className={result.discountedUnitMargin < result.baseUnitMargin ? (result.discountedUnitMargin < 0 ? 'text-rose-600 dark:text-rose-400' : 'text-amber-600 dark:text-amber-400') : ''}>
                  {usd(result.discountedUnitMargin)}
                </span>
              </>
            }
            sublabel={`per unit · price ${usd(result.discountedPrice)}`}
          />
          <StatCard
            label="Margin destroyed"
            value={result.unitMarginErosionPct === null ? '—' : pct(result.unitMarginErosionPct, 1)}
            sublabel="of each unit's margin, gone"
            emphasis={result.unitMarginErosionPct !== null && result.unitMarginErosionPct >= 50}
          />
          <StatCard
            label="Break-even volume"
            value={result.breakEvenVolume === null ? 'never' : numFmt(result.breakEvenVolume, 0)}
            sublabel={`holds profit flat ${perShort}`}
          />
        </div>

        {/* Ledger */}
        <div className="card p-6 sm:p-8">
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Gross-profit ledger</h3>
          <dl className="mt-3 divide-y divide-slate-100 text-sm dark:divide-white/[0.06]">
            <LedgerRow label="Revenue" before={usd(result.baseRevenue, 0)} after={usd(result.discountedPrice * newVolume, 0)} />
            <LedgerRow label="Units" before={numFmt(volume, 0)} after={numFmt(newVolume, 0)} />
            <LedgerRow label="Unit margin" before={usd(result.baseUnitMargin)} after={usd(result.discountedUnitMargin)} />
            <LedgerRow label="Gross profit" before={usd(result.baseGrossProfit, 0)} after={usd(profitAtAssumed, 0)} />
            <div className="flex items-center justify-between py-2.5">
              <dt className="font-medium text-slate-700 dark:text-slate-300">Difference</dt>
              <dd
                className={`readout text-sm font-bold ${
                  profitDelta > 0.005
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : profitDelta < -0.005
                      ? 'text-rose-600 dark:text-rose-400'
                      : 'text-slate-500 dark:text-slate-400'
                }`}
              >
                {profitDelta > 0.005 ? '+' : profitDelta < -0.005 ? '−' : ''}
                {usd(Math.abs(profitDelta), 0)} {perShort}
              </dd>
            </div>
          </dl>
          <p className="mt-2 text-right font-mono text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400">
            list price · at +{pct(upliftPct, 0)} response
          </p>
        </div>
      </div>

      {/* ================= Sensitivity: profit vs response ================= */}
      <div className="lg:col-span-5">
        <div className="card p-5 sm:p-6">
          <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Profit change vs the volume the discount actually buys
              </h3>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                {pct(discountPct, 1)} off at {usd(price)} list / {usd(unitCost)} cost, {numFmt(volume, 0)}{' '}
                units — the profit delta as the response sweeps 0 → {pct(sweepMax, 0)}.
              </p>
            </div>
            <span className="readout rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600 dark:bg-white/[0.05] dark:text-slate-300">
              now: +{pct(upliftPct, 0)} response →{' '}
              <span
                className={
                  profitDelta > 0.005
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : profitDelta < -0.005
                      ? 'text-rose-600 dark:text-rose-400'
                      : 'text-slate-500 dark:text-slate-400'
                }
              >
                {profitDelta > 0.005 ? '+' : profitDelta < -0.005 ? '−' : ''}
                {usd(Math.abs(profitDelta), 0)}
              </span>
            </span>
          </div>
          {be === null ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 dark:border-white/[0.08] dark:bg-white/[0.03]">
              <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                With the discount at or beyond the full gross margin, the line never reaches zero —
                every additional unit sold adds {usd(result.discountedUnitMargin)} of margin, so the
                curve is flat{' '}
                {result.discountedUnitMargin >= 0 ? 'at best' : 'and negative'}. No response level
                crosses into profit.
              </p>
            </div>
          ) : (
            <ComparisonChart
              series={[
                {
                  label: 'Gross-profit change vs list price',
                  color: '#6366f1',
                  points: sweep.map((s) => ({ x: s.upliftPct, y: s.profitDelta })),
                  fillTo: 0,
                },
              ]}
              xLabel="Volume response the discount achieves"
              yLabel={`Profit change ${perShort}`}
              xFormat={(n) => `+${pct(n, 0)}`}
              yFormat={(n) => usdCompact(n)}
              yMinMode="auto"
              height={280}
              marker={{ x: be, label: `break-even response +${pct(be, 0)}` }}
              caption="The line is exact: profit change = Q(1 + u) × (P(1 − d) − C) − Q × (P − C), linear in the response u. Left of the marker the promotion destroys profit; right of it, it adds. The marker is the profit-neutral uplift d ÷ (gm − d) — the minimum response that makes the discount worth running."
            />
          )}
        </div>
      </div>

      {/* ================= Coupon equivalence ================= */}
      <div className="lg:col-span-5">
        <div className="card p-5 sm:p-6">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div className="max-w-2xl">
              <h3 className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-slate-100">
                <Tags className="h-4 w-4 text-slate-400 dark:text-slate-500" aria-hidden="true" />
                &ldquo;Spend X, save Y&rdquo; coupon vs the straight {pct(discountPct, 1)} discount
              </h3>
              <p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                A threshold coupon is a straight discount of Y ÷ T only at a basket of exactly T —
                above that, its effective rate shrinks while a blanket percentage keeps scaling with
                the basket.
              </p>
            </div>
            {!coupon.sane && (
              <span className="chip bg-amber-50 font-mono text-[10px] uppercase tracking-wider text-amber-700 ring-1 ring-inset ring-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:ring-amber-500/25">
                amount ≥ threshold
              </span>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <NumberInput
              id="coupon-threshold"
              label="Spend threshold"
              value={couponThreshold}
              onChange={(n) => set('couponThreshold', n)}
              min={0}
              max={1000000}
              prefix="$"
              placeholder="100"
              helpText="The T in 'spend T, save Y'."
            />
            <NumberInput
              id="coupon-off"
              label="Amount off"
              value={couponOff}
              onChange={(n) => set('couponOff', n)}
              min={0}
              max={1000000}
              prefix="$"
              placeholder="15"
              helpText="The Y subtracted at checkout once the basket clears T."
            />
            <NumberInput
              id="coupon-basket"
              label="Customer's basket"
              value={basket}
              onChange={(n) => set('basket', n)}
              min={0}
              max={1000000}
              prefix="$"
              placeholder="250"
              helpText="The order the coupon is judged against."
            />
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Face rate"
              value={pct(coupon.faceRatePct, 1)}
              sublabel="Y ÷ T — the banner number"
            />
            <StatCard
              label="Effective rate here"
              value={coupon.triggered ? pct(coupon.effectiveRatePct, 1) : 'not triggered'}
              sublabel={
                coupon.triggered
                  ? `Y ÷ basket = ${usd(couponOff, 0)} ÷ ${usd(basket, 0)}`
                  : `add ${usd(coupon.gapToTrigger, 0)} to reach ${usd(couponThreshold, 0)}`
              }
              emphasis={coupon.triggered && coupon.effectiveRatePct >= 0.995 * Math.max(discountPct, 0.01)}
            />
            <StatCard
              label="Final price"
              value={
                <>
                  {usd(coupon.finalPriceCoupon, 0)}
                  <span className="mx-1 text-slate-400 dark:text-slate-500">/</span>
                  {usd(coupon.finalPriceStraight, 0)}
                </>
              }
              sublabel="with coupon / at straight discount"
            />
            <StatCard
              label="Crossover basket"
              value={coupon.crossOverBasket === null ? '—' : usd(coupon.crossOverBasket, 0)}
              sublabel={
                coupon.crossOverBasket === null
                  ? 'no blanket discount to cross'
                  : `above this, ${pct(discountPct, 1)} off costs you more`
              }
            />
          </div>

          <p className="mt-4 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
            {coupon.triggered ? (
              <>
                On a {usd(basket, 0)} basket the coupon takes{' '}
                {usd(Math.abs(coupon.savingsDifference), 0)}{' '}
                {coupon.savingsDifference >= 0
                  ? 'more off than the blanket discount — cheaper for the customer, costlier for you'
                  : 'less off than the blanket discount — the customer keeps paying more of the list price'}
                . The coupon&apos;s cost to you is capped at {usd(couponOff, 0)} no matter how large
                the basket grows; the blanket {pct(discountPct, 1)} keeps scaling. That cap is why
                thresholds also lift baskets toward {usd(couponThreshold, 0)} — the classic
                &ldquo;add one more item to unlock it&rdquo; mechanic.
              </>
            ) : (
              <>
                The basket is below the {usd(couponThreshold, 0)} threshold, so the coupon does
                nothing — the customer pays full price unless they add {usd(coupon.gapToTrigger, 0)}{' '}
                more. Thresholds convert &ldquo;everyone gets a discount&rdquo; into
                &ldquo;only baskets this big get one&rdquo;, which is exactly their point.
              </>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}

function LedgerRow({ label, before, after }: { label: string; before: string; after: string }) {
  return (
    <div className="flex items-center justify-between py-2.5">
      <dt className="text-slate-600 dark:text-slate-300">{label}</dt>
      <dd className="readout text-sm font-semibold text-slate-900 dark:text-slate-100">
        <span className="text-slate-500 dark:text-slate-400">{before}</span>
        <span className="mx-2 text-slate-300 dark:text-slate-500">/</span>
        {after}
      </dd>
    </div>
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
      className={`rounded-full px-3 py-1.5 text-xs font-medium transition-all duration-150 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 dark:focus-visible:ring-indigo-400 dark:focus-visible:ring-offset-slate-950 ${
        active
          ? 'border border-indigo-500 bg-indigo-50 text-indigo-700 dark:border-indigo-400 dark:bg-indigo-500/15 dark:text-indigo-300'
          : 'border border-slate-200 bg-white text-slate-500 hover:border-indigo-300 hover:text-indigo-600 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-400 dark:hover:border-indigo-400/50 dark:hover:text-indigo-300'
      }`}
    >
      {children}
    </button>
  );
}

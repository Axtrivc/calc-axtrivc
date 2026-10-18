'use client';

import { useEffect, useMemo } from 'react';
import { AlertTriangle, Car, Info, RotateCcw, Route, Scale } from 'lucide-react';
import NumberInput, { AnimatedNumber, CopyButton, SliderControl } from '@/components/NumberInput';
import ScenarioButtons from '@/components/ScenarioButtons';
import ComparisonChart from '@/components/ComparisonChart';
import {
  compareMileage,
  mileageSweep,
  neutralMileage,
  MILEAGE_CONSTANTS_2025 as MC,
  type MileageInputs,
} from '@/lib/mileage';
import { usd, usdCompact, pct, numFmt, clamp } from '@/lib/format';
import { useWorkbenchInputs, recordRecent } from '@/lib/workbench';

const SLUG = 'mileage-deduction-calculator';
const HREF = '/mileage-deduction-calculator/';

/** Workbench state is all-numeric so share links & storage stay simple. */
const DEFAULTS = {
  businessMiles: 9000,
  depreciation: 3600,
  fuelEnergy: 2600,
  insurance: 1900,
  maintenance: 1200,
  registration: 300,
  share: 65,
  marginalRate: 24,
  withSe: 1,
};

const MILE_PRESETS = [3000, 9000, 15000, 25000];
const SHARE_PRESETS = [25, 50, 65, 85];
const RATE_PRESETS = [12, 22, 24, 32, 35, 37];

/** Scenario presets express the real decision: cheap paid-off cars push the
 *  standard rate, expensive low-usage vehicles push actual — and heavy
 *  business mileage pushes standard almost regardless of the car. */
const SCENARIOS: { label: string; patch: Partial<typeof DEFAULTS> }[] = [
  {
    label: 'Rideshare, paid-off car',
    patch: {
      businessMiles: 28000, share: 85, depreciation: 2200, fuelEnergy: 4800,
      insurance: 2800, maintenance: 2400, registration: 250,
    },
  },
  {
    label: 'New EV, low miles',
    patch: {
      businessMiles: 4500, share: 40, depreciation: 8400, fuelEnergy: 700,
      insurance: 2600, maintenance: 400, registration: 600,
    },
  },
  {
    label: 'Contractor truck',
    patch: {
      businessMiles: 18000, share: 75, depreciation: 7000, fuelEnergy: 5500,
      insurance: 2400, maintenance: 2800, registration: 450,
    },
  },
  {
    label: 'Paid-off errand car',
    patch: {
      businessMiles: 6000, share: 35, depreciation: 0, fuelEnergy: 1600,
      insurance: 1400, maintenance: 900, registration: 200,
    },
  },
];

function toInputs(v: typeof DEFAULTS): MileageInputs {
  return {
    businessMiles: v.businessMiles,
    depreciation: v.depreciation,
    fuelEnergy: v.fuelEnergy,
    insurance: v.insurance,
    maintenance: v.maintenance,
    registration: v.registration,
    businessSharePct: v.share,
  };
}

export default function MileageCalculator() {
  const { values, set, reset } = useWorkbenchInputs(SLUG, DEFAULTS);
  const withSe = values.withSe === 1;

  useEffect(() => {
    recordRecent(SLUG);
  }, []);

  const inputs = useMemo(() => toInputs(values), [values]);
  const result = useMemo(
    () => compareMileage(inputs, values.marginalRate, withSe),
    [inputs, values.marginalRate, withSe],
  );
  const neutral = useMemo(() => neutralMileage(inputs), [inputs]);
  const sweep = useMemo(() => mileageSweep(inputs), [inputs]);

  const { standard, actual, winner } = result;
  const standardWins = winner === 'standard';
  const actualWins = winner === 'actual';
  const bestDeduction = Math.max(standard.deduction, actual.deduction);
  const b = actual.breakdown;

  // Boundary watch: if the share is measured in miles (the common case),
  // business miles ÷ share should land near the odometer's annual total.
  const impliedTotal = result.impliedTotalMiles;
  const impliedImplausible = impliedTotal !== null && impliedTotal > 40_000;

  function applyScenario(patch: Partial<typeof DEFAULTS>) {
    for (const [k, v] of Object.entries(patch)) {
      set(k as keyof typeof DEFAULTS, v as number);
    }
  }

  const copySummary = `Mileage deduction at ${numFmt(values.businessMiles)} business miles: standard ${usd(
    standard.deduction,
    0,
  )}/yr vs actual ${usd(actual.deduction, 0)}/yr (${pct(values.share, 0)} × ${usd(
    b.totalCost,
    0,
  )} of vehicle cost). ${
    actualWins ? 'Actual method' : standardWins ? 'Standard rate' : 'Both methods'
  } ${actualWins || standardWins ? 'deducts more' : 'tie'}${
    neutral.exactMiles !== null
      ? ` — neutral point ${numFmt(Math.round(neutral.exactMiles))} business miles/yr`
      : ''
  }. 2025 rate ${usd(MC.standardRatePerMile, 2)}/mi (IRS Notice 2025-5).`;

  return (
    <div className="grid gap-6 lg:grid-cols-5">
      {/* ================= Inputs ================= */}
      <div className="card p-6 sm:p-8 lg:col-span-3">
        <div className="space-y-6">
          {/* Business miles */}
          <div>
            <NumberInput
              id="mileage-business"
              label="Business miles this year"
              value={values.businessMiles}
              onChange={(n) => set('businessMiles', n)}
              min={0}
              max={100000}
              suffix="mi"
              placeholder="9,000"
              helpText="Qualifying miles only — client and supplier trips, between-worksite travel. Home-to-office commuting never counts (the guide explains the home-office exception)."
            />
            <div className="mt-3">
              <SliderControl
                id="mileage-business-slider"
                label="Business miles"
                value={values.businessMiles}
                onChange={(n) => set('businessMiles', n)}
                min={0}
                max={100000}
                logarithmic
                suffix=" mi"
                presets={MILE_PRESETS}
                formatValue={(n) => `${numFmt(Math.round(n))} mi · ${usd(n * MC.standardRatePerMile, 0)} standard`}
              />
            </div>
          </div>

          {/* Vehicle annual costs */}
          <div>
            <p className="label">Annual vehicle costs — the actual-method side</p>
            <div className="mt-2 grid gap-4 sm:grid-cols-3">
              <NumberInput
                id="mileage-depreciation"
                label="Depreciation or lease / yr"
                value={values.depreciation}
                onChange={(n) => set('depreciation', n)}
                min={0}
                max={200000}
                prefix="$"
                placeholder="3,600"
                helpText="MACRS on an owned car, or lease payments. Set 0 for a paid-off car."
              />
              <NumberInput
                id="mileage-fuel"
                label="Fuel & electricity / yr"
                value={values.fuelEnergy}
                onChange={(n) => set('fuelEnergy', n)}
                min={0}
                max={50000}
                prefix="$"
                placeholder="2,600"
                helpText="Whole-year cost — EV charging counts here."
              />
              <NumberInput
                id="mileage-insurance"
                label="Insurance / yr"
                value={values.insurance}
                onChange={(n) => set('insurance', n)}
                min={0}
                max={50000}
                prefix="$"
                placeholder="1,900"
              />
              <NumberInput
                id="mileage-maintenance"
                label="Maintenance & repairs / yr"
                value={values.maintenance}
                onChange={(n) => set('maintenance', n)}
                min={0}
                max={50000}
                prefix="$"
                placeholder="1,200"
                helpText="Oil, tires, brakes, service."
              />
              <NumberInput
                id="mileage-registration"
                label="Registration & fees / yr"
                value={values.registration}
                onChange={(n) => set('registration', n)}
                min={0}
                max={20000}
                prefix="$"
                placeholder="300"
                helpText="License, tags, inspection. Parking & tolls are 100% deductible on top of either method — leave them out here."
              />
            </div>
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
              Total: <span className="readout font-semibold text-slate-700 dark:text-slate-200">{usd(b.totalCost, 0)}/yr</span>{' '}
              to operate the vehicle — the actual method deducts {pct(values.share, 0)} of it.
            </p>
          </div>

          {/* Business-use share */}
          <div>
            <SliderControl
              id="mileage-share-slider"
              label="Business-use share of the vehicle"
              value={values.share}
              onChange={(n) => set('share', n)}
              min={0}
              max={100}
              step={1}
              suffix="%"
              presets={SHARE_PRESETS}
              helpText={
                impliedTotal !== null
                  ? `Allocates every actual-method cost. At this share and your mileage, the implied odometer total is ${numFmt(Math.round(impliedTotal))} mi/yr.`
                  : 'Allocates every actual-method cost — the standard method multiplies miles directly and never uses it.'
              }
            />
            {impliedImplausible && (
              <p className="mt-2 flex items-start gap-1.5 rounded-lg bg-amber-50 p-2.5 text-xs leading-relaxed text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500 dark:text-amber-400" aria-hidden="true" />
                {numFmt(values.businessMiles)} business miles at a {pct(values.share, 0)} share implies{' '}
                {numFmt(Math.round(impliedTotal ?? 0))} total miles/yr — above what almost any private
                vehicle logs. If your share is mile-based, business miles ÷ total miles should reproduce
                it; fix whichever number is off.
              </p>
            )}
          </div>

          {/* Tax context */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="label" id="mileage-se-label">Filing context</p>
              <div className="mt-2 grid grid-cols-1 gap-1.5" role="group" aria-labelledby="mileage-se-label">
                {[
                  { v: 1, label: 'Schedule C — also saves SE tax' },
                  { v: 0, label: 'Income tax only' },
                ].map((opt) => {
                  const active = (opt.v === 1) === withSe;
                  return (
                    <button
                      key={opt.v}
                      type="button"
                      aria-pressed={active}
                      onClick={() => set('withSe', opt.v)}
                      className={`focus-calm rounded-lg border px-3 py-2 text-left text-sm font-medium transition-all duration-150 ${
                        active
                          ? 'border-indigo-500 bg-indigo-50 text-indigo-700 dark:border-indigo-400 dark:bg-indigo-500/15 dark:text-indigo-300'
                          : 'border-slate-200 bg-white text-slate-500 hover:border-indigo-300 hover:text-indigo-600 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-400 dark:hover:border-indigo-400/50 dark:hover:text-indigo-300'
                      }`}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>
            <div>
              <SliderControl
                id="mileage-rate-slider"
                label="Marginal income-tax rate"
                value={values.marginalRate}
                onChange={(n) => set('marginalRate', n)}
                min={0}
                max={50}
                step={1}
                suffix="%"
                presets={RATE_PRESETS}
                helpText="Your federal bracket. If you also claim the QBI deduction below the phase-out, the effective rate on this deduction is ~80% of it."
              />
            </div>
          </div>

          {/* Scenario presets */}
          <div>
            <p className="label">Scenario presets</p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {SCENARIOS.map((s) => (
                <button
                  key={s.label}
                  type="button"
                  onClick={() => applyScenario(s.patch)}
                  className="focus-calm rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-500 transition-all duration-150 hover:border-indigo-300 hover:text-indigo-600 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-400 dark:hover:border-indigo-400/50 dark:hover:text-indigo-300"
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-6 flex items-start gap-2 rounded-lg bg-slate-50 p-3 text-xs leading-relaxed text-slate-600 dark:bg-white/[0.03] dark:text-slate-300">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-slate-400 dark:text-slate-500" aria-hidden="true" />
          <p>
            Tax year 2025, US federal. Standard rate {usd(MC.standardRatePerMile, 2)}/mile — it already
            bundles depreciation ({usd(MC.depreciationComponentPerMile, 2)}/mi of it), so a standard-rate
            year adds no separate MACRS or §179 deduction. Parking and tolls are fully deductible on top
            of either method and are not modeled here.
            {withSe
              ? ` SE-tax savings assume business earnings below the ${usd(MC.ssWageBase2025, 0)} Social Security base.`
              : ''}
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
            shortTitle="Mileage"
            href={HREF}
            params={values}
          />
        </div>
      </div>

      {/* ================= Results ================= */}
      <div className="space-y-4 lg:col-span-2">
        {/* Headline verdict */}
        <div className="card p-6 sm:p-8">
          <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            <Scale className="h-4 w-4" aria-hidden="true" />
            Verdict at these numbers
          </h2>
          <div className="mt-3">
            <div className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
              {actualWins
                ? 'Actual method deducts more'
                : standardWins
                  ? 'Standard mileage rate deducts more'
                  : 'Dead heat'}
            </div>
            <AnimatedNumber
              value={bestDeduction}
              format={(n) => usd(n)}
              className="readout mt-1 block text-4xl font-extrabold tracking-tight text-indigo-600 dark:text-indigo-300"
            />
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              per year of deduction —{' '}
              {winner === 'tie'
                ? 'the two methods are within a dollar.'
                : `${usd(Math.abs(result.deductionDelta), 0)} more than the ${
                    actualWins ? 'standard rate' : 'actual method'
                  }, worth ${usd(Math.abs(result.savingDelta))}/yr of tax at your ${pct(values.marginalRate, 0)} rate${
                    withSe ? ' + SE' : ''
                  }.`}
            </p>
          </div>

          {/* Side-by-side ledger */}
          <dl className="mt-5 divide-y divide-slate-100 text-sm dark:divide-white/[0.06]">
            <LedgerRow
              label="Deduction per year"
              standard={usd(standard.deduction)}
              actual={usd(actual.deduction)}
            />
            <LedgerRow
              label="Federal income tax saved"
              standard={usd(standard.saving.incomeTax)}
              actual={usd(actual.saving.incomeTax)}
            />
            <LedgerRow
              label="SE tax saved (Schedule C)"
              standard={withSe ? usd(standard.saving.seTax) : '—'}
              actual={withSe ? usd(actual.saving.seTax) : '—'}
            />
            <div className="flex items-center justify-between py-2.5">
              <dt className="font-medium text-slate-700 dark:text-slate-300">Total tax saved / yr</dt>
              <dd className="readout text-sm font-semibold text-slate-900 dark:text-slate-100">
                <span className="text-slate-500 dark:text-slate-400">{usd(standard.saving.total)}</span>
                <span className="mx-2 text-slate-300 dark:text-slate-600">/</span>
                {usd(actual.saving.total)}
              </dd>
            </div>
          </dl>
          <p className="mt-2 text-right font-mono text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Standard · Actual
          </p>
        </div>

        {/* Neutral mileage */}
        <div className="card p-6">
          <h3 className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-slate-100">
            <Route className="h-4 w-4 text-slate-400 dark:text-slate-500" aria-hidden="true" />
            The neutral mileage
          </h3>
          {neutral.exactMiles !== null ? (
            <>
              <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                At your costs, the two methods tie at{' '}
                <strong className="readout text-slate-900 dark:text-white">
                  {numFmt(Math.round(neutral.exactMiles))} business miles/yr
                </strong>{' '}
                <span className="text-slate-500 dark:text-slate-400">
                  (≈{numFmt(Math.round(neutral.exactMiles / 52))}/wk — {pct(values.share, 0)} ×{' '}
                  {usd(b.totalCost, 0)} ÷ {usd(MC.standardRatePerMile, 2)}).
                </span>
              </p>
              <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                {values.businessMiles > neutral.exactMiles + 0.5
                  ? `You drive ${numFmt(values.businessMiles)} — past the line, so every extra business mile pays ${usd(MC.standardRatePerMile, 2)} under the standard rate while the actual side does not move.`
                  : values.businessMiles < neutral.exactMiles - 0.5
                    ? `You drive ${numFmt(values.businessMiles)} — below the line, where the flat actual deduction (${usd(actual.deduction, 0)}) still outruns ${usd(MC.standardRatePerMile, 2)} × miles.`
                    : 'You sit almost exactly on the line — the methods agree to within rounding at this mileage.'}
              </p>
            </>
          ) : actual.deduction <= 0.5 ? (
            <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
              With nothing deductible on the actual side — zero vehicle costs or a zero business
              share — the standard rate leads from the first business mile, and there is no
              crossover to report.
            </p>
          ) : (
            <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
              At these costs the flat actual deduction ({usd(actual.deduction, 0)}/yr) sits so far
              above the {usd(MC.standardRatePerMile, 2)}-per-mile line that their crossing lies
              beyond the engine&apos;s 200,000-mile scan ceiling — the actual method leads at
              every realistic mileage.
            </p>
          )}
          {b.effectiveRatePerMile !== null && b.effectiveRatePerMile > 0 && (
            <p className="mt-3 border-t border-slate-100 pt-3 text-xs leading-relaxed text-slate-500 dark:border-white/[0.07] dark:text-slate-400">
              Another way to read it: at {numFmt(values.businessMiles)} miles your actual method deducts{' '}
              <span className="readout font-semibold">{usd(b.effectiveRatePerMile, 2)}/mile</span>{' '}
              versus the standard rate&apos;s flat {usd(MC.standardRatePerMile, 2)}. That single
              comparison — no crossover table needed — decides the year.
            </p>
          )}
        </div>

        {/* Boundary watch */}
        {b.totalCost <= 0 ? (
          <div className="card border-amber-200 p-4 dark:border-amber-500/30">
            <p className="flex items-start gap-2 text-sm leading-relaxed text-amber-700 dark:text-amber-400">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              Every vehicle cost is zero — the actual method has nothing to work with. Enter the
              year&apos;s real operating costs (fuel, insurance, depreciation or lease…) before
              trusting the comparison.
            </p>
          </div>
        ) : values.share <= 0 ? (
          <div className="card border-amber-200 p-4 dark:border-amber-500/30">
            <p className="flex items-start gap-2 text-sm leading-relaxed text-amber-700 dark:text-amber-400">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              The business-use share is 0% — the actual method deducts nothing at any mileage. Only a
              vehicle with genuine business use qualifies for either method.
            </p>
          </div>
        ) : (
          <div className="card p-4">
            <p className="flex items-start gap-2 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
              <Car className="mt-0.5 h-4 w-4 shrink-0 text-slate-400 dark:text-slate-500" aria-hidden="true" />
              The standard rate is off-limits if you operate five or more vehicles at once, or ever
              claimed §179/bonus/accelerated depreciation on this one — and a leased car, once on the
              standard rate, stays on it for the whole lease term. Switching rules and the 33¢/mi basis
              recovery are covered in the guide below.
            </p>
          </div>
        )}
      </div>

      {/* ================= Mileage sensitivity ================= */}
      <div className="lg:col-span-5">
        <div className="card p-5 sm:p-6">
          <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Both methods as business mileage grows
              </h3>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                At your current costs ({usd(b.totalCost, 0)}/yr) and {pct(values.share, 0)} business
                share, sweeping business miles from 0 to {numFmt(Math.round(sweep[sweep.length - 1]?.miles ?? 0))}.
              </p>
            </div>
            <span className="readout rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600 dark:bg-white/[0.05] dark:text-slate-300">
              now: {numFmt(values.businessMiles)} mi →{' '}
              <span className={actualWins ? 'text-emerald-600 dark:text-emerald-400' : standardWins ? 'text-sky-600 dark:text-sky-400' : 'text-slate-500 dark:text-slate-400'}>
                {usd(actualWins ? actual.deduction : standard.deduction, 0)}
              </span>
            </span>
          </div>
          <ComparisonChart
            series={[
              {
                label: `Standard rate (${usd(MC.standardRatePerMile, 2)}/mi × business miles)`,
                color: '#0ea5e9',
                points: sweep.map((s) => ({ x: s.miles, y: s.standardDeduction })),
              },
              {
                label: `Actual method (${pct(values.share, 0)} × ${usd(b.totalCost, 0)} — flat)`,
                color: '#6366f1',
                points: sweep.map((s) => ({ x: s.miles, y: s.actualDeduction })),
              },
            ]}
            xLabel="Business miles / yr"
            yLabel="Deduction / yr"
            xFormat={(n) => numFmt(n)}
            yFormat={(n) => usdCompact(n)}
            height={280}
            marker={
              neutral.exactMiles !== null && sweep.length > 1
                ? {
                    x: clamp(neutral.exactMiles, 1, sweep[sweep.length - 1].miles - 1),
                    label: `neutral ≈ ${numFmt(Math.round(neutral.exactMiles))} mi`,
                  }
                : undefined
            }
            caption="The standard line is a straight 70¢ per business mile; the actual line is flat — costs and the business share do not care how far you drive. Where they cross is the neutral mileage: left of it the actual method leads, right of it every extra mile pays 70¢ while the actual side stands still. Heavy-mileage drivers end up on the standard rate almost regardless of how expensive the car is."
          />
        </div>
      </div>
    </div>
  );
}

function LedgerRow({ label, standard, actual }: { label: string; standard: string; actual: string }) {
  return (
    <div className="flex items-center justify-between py-2.5">
      <dt className="text-slate-600 dark:text-slate-300">{label}</dt>
      <dd className="readout text-sm font-semibold text-slate-900 dark:text-slate-100">
        <span className="text-slate-500 dark:text-slate-400">{standard}</span>
        <span className="mx-2 text-slate-300 dark:text-slate-600">/</span>
        {actual}
      </dd>
    </div>
  );
}

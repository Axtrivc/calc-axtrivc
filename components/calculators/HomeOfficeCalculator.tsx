'use client';

import { useEffect, useMemo } from 'react';
import { AlertTriangle, Info, RotateCcw, Ruler, Scale } from 'lucide-react';
import NumberInput, { AnimatedNumber, CopyButton, SliderControl } from '@/components/NumberInput';
import ScenarioButtons from '@/components/ScenarioButtons';
import ComparisonChart from '@/components/ComparisonChart';
import {
  compareHomeOffice,
  officeAreaSweep,
  HOME_OFFICE_CONSTANTS,
  type HomeOfficeInputs,
} from '@/lib/homeoffice';
import { usd, usdCompact, pct, numFmt, clamp } from '@/lib/format';
import { useWorkbenchInputs, recordRecent } from '@/lib/workbench';

const SLUG = 'home-office-deduction-calculator';
const HREF = '/home-office-deduction-calculator/';

/** Workbench state is all-numeric so share links & storage stay simple. */
const DEFAULTS = {
  homeSqFt: 1800,
  officeSqFt: 200,
  isOwner: 0,
  rent: 21600,
  mortgageInterest: 14400,
  propertyTax: 5200,
  homeBasis: 380000,
  utilities: 2400,
  insurance: 600,
  repairs: 800,
  marginalRate: 24,
  withSe: 1,
};

const HOME_PRESETS = [800, 1500, 2500, 4000];
const OFFICE_PRESETS = [100, 150, 200, 300];
const RATE_PRESETS = [12, 22, 24, 32, 35, 37];

/** Scenario presets express the real decision: expensive homes push actual,
 *  cheap homes push simplified; owners add depreciation to the actual side. */
const SCENARIOS: { label: string; patch: Partial<typeof DEFAULTS> }[] = [
  {
    label: 'City rental',
    patch: {
      homeSqFt: 1800, officeSqFt: 200, isOwner: 0, rent: 21600,
      utilities: 2400, insurance: 600, repairs: 800,
    },
  },
  {
    label: 'Suburban homeowner',
    patch: {
      homeSqFt: 2400, officeSqFt: 240, isOwner: 1, mortgageInterest: 16800,
      propertyTax: 6200, homeBasis: 420000, utilities: 3600, insurance: 1500, repairs: 1000,
    },
  },
  {
    label: 'Low-cost area',
    patch: {
      homeSqFt: 3000, officeSqFt: 150, isOwner: 0, rent: 9600,
      utilities: 1500, insurance: 500, repairs: 200,
    },
  },
  {
    label: 'Compact apartment',
    patch: {
      homeSqFt: 750, officeSqFt: 90, isOwner: 0, rent: 19200,
      utilities: 1800, insurance: 400, repairs: 300,
    },
  },
];

function toInputs(v: typeof DEFAULTS): HomeOfficeInputs {
  return {
    homeSqFt: v.homeSqFt,
    officeSqFt: v.officeSqFt,
    tenure: v.isOwner === 1 ? 'own' : 'rent',
    rent: v.rent,
    mortgageInterest: v.mortgageInterest,
    propertyTax: v.propertyTax,
    homeBasis: v.homeBasis,
    utilities: v.utilities,
    insurance: v.insurance,
    repairs: v.repairs,
  };
}

export default function HomeOfficeCalculator() {
  const { values, set, reset } = useWorkbenchInputs(SLUG, DEFAULTS);
  const isOwner = values.isOwner === 1;
  const withSe = values.withSe === 1;

  useEffect(() => {
    recordRecent(SLUG);
  }, []);

  const inputs = useMemo(() => toInputs(values), [values]);
  const result = useMemo(
    () => compareHomeOffice(inputs, values.marginalRate, withSe),
    [inputs, values.marginalRate, withSe],
  );
  const sweep = useMemo(() => officeAreaSweep(inputs), [inputs]);

  // The office slider's ceiling is the home itself — the business share can
  // never exceed 100%.
  const officeMax = Math.max(100, values.homeSqFt);
  const officeShare = values.homeSqFt > 0 ? (values.officeSqFt / values.homeSqFt) * 100 : 0;

  const { simplified, actual, winner } = result;
  const actualWins = winner === 'actual';
  const simplifiedWins = winner === 'simplified';
  const bestDeduction = Math.max(simplified.deduction, actual.deduction);
  const b = actual.breakdown;

  function applyScenario(patch: Partial<typeof DEFAULTS>) {
    for (const [k, v] of Object.entries(patch)) {
      set(k as keyof typeof DEFAULTS, v as number);
    }
  }

  /**
   * Shrinking the home below the current office would strand the office above
   * its own max (and fire the office-≥-home warning the user never asked for)
   * — so the two inputs re-clamp together.
   */
  function setHome(n: number) {
    set('homeSqFt', n);
    if (values.officeSqFt > n) set('officeSqFt', n);
  }

  const copySummary = `Home office deduction (${isOwner ? 'homeowner' : 'renter'}, ${numFmt(
    values.officeSqFt,
  )} sq ft office in ${numFmt(values.homeSqFt)} sq ft home): simplified ${usd(
    simplified.deduction,
    0,
  )}/yr vs actual ${usd(actual.deduction, 0)}/yr. ${
    actualWins ? 'Actual method' : simplifiedWins ? 'Simplified method' : 'Both methods'
  } ${actualWins || simplifiedWins ? 'deducts more' : 'tie'} — best case saves ${usd(
    Math.max(simplified.saving.total, actual.saving.total),
    0,
  )}/yr at a ${pct(values.marginalRate, 0)} marginal rate${withSe ? ' incl. SE tax' : ''}.`;

  return (
    <div className="grid gap-6 lg:grid-cols-5">
      {/* ================= Inputs ================= */}
      <div className="card p-6 sm:p-8 lg:col-span-3">
        <div className="space-y-6">
          {/* Tenure */}
          <div>
            <p className="label" id="homeoffice-tenure-label">Housing tenure</p>
            <div className="mt-2 grid grid-cols-2 gap-1.5" role="group" aria-labelledby="homeoffice-tenure-label">
              {[
                { v: 0, label: 'I rent' },
                { v: 1, label: 'I own my home' },
              ].map((opt) => {
                const active = (opt.v === 1) === isOwner;
                return (
                  <button
                    key={opt.v}
                    type="button"
                    aria-pressed={active}
                    onClick={() => set('isOwner', opt.v)}
                    className={`focus-calm rounded-lg border px-3 py-2 text-sm font-medium transition-all duration-150 ${
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

          {/* Areas */}
          <div>
            <NumberInput
              id="homeoffice-home"
              label="Home size (square feet)"
              value={values.homeSqFt}
              onChange={setHome}
              min={100}
              max={20000}
              suffix="sq ft"
              placeholder="1,800"
              helpText="Total finished living area — the denominator of the business-use percentage."
            />
            <div className="mt-3">
              <SliderControl
                id="homeoffice-home-slider"
                label="Home size"
                value={values.homeSqFt}
                onChange={setHome}
                min={200}
                max={6000}
                step={10}
                suffix=" sq ft"
                presets={HOME_PRESETS}
              />
            </div>
          </div>

          <div>
            <NumberInput
              id="homeoffice-office"
              label="Office area used regularly & exclusively (square feet)"
              value={values.officeSqFt}
              onChange={(n) => set('officeSqFt', clamp(n, 0, officeMax))}
              min={0}
              max={officeMax}
              suffix="sq ft"
              placeholder="200"
              helpText={`Only space with no personal use counts. Business share: ${pct(officeShare, 1)} of the home.`}
            />
            <div className="mt-3">
              <SliderControl
                id="homeoffice-office-slider"
                label="Office area"
                value={clamp(values.officeSqFt, 0, officeMax)}
                onChange={(n) => set('officeSqFt', n)}
                min={0}
                max={officeMax}
                step={Math.max(5, Math.round(officeMax / 100 / 5) * 5)}
                suffix=" sq ft"
                presets={OFFICE_PRESETS}
                formatValue={(n) => `${numFmt(n)} sq ft${values.homeSqFt > 0 ? ` · ${pct((n / values.homeSqFt) * 100, 1)}` : ''}`}
              />
            </div>
            {values.officeSqFt > HOME_OFFICE_CONSTANTS.simplifiedMaxSqFt && (
              <p className="mt-2 flex items-start gap-1.5 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                The simplified method counts at most {HOME_OFFICE_CONSTANTS.simplifiedMaxSqFt} sq ft — a{' '}
                {numFmt(values.officeSqFt)} sq ft office still deducts{' '}
                {usd(HOME_OFFICE_CONSTANTS.simplifiedMaxDeduction, 0)} that way; the actual method has no square-foot cap.
              </p>
            )}
          </div>

          {/* Tenure-specific housing line */}
          {isOwner ? (
            <div className="grid gap-4 sm:grid-cols-3">
              <NumberInput
                id="homeoffice-mortgage"
                label="Mortgage interest / yr"
                value={values.mortgageInterest}
                onChange={(n) => set('mortgageInterest', n)}
                min={0}
                max={200000}
                prefix="$"
                placeholder="14,400"
              />
              <NumberInput
                id="homeoffice-proptax"
                label="Property taxes / yr"
                value={values.propertyTax}
                onChange={(n) => set('propertyTax', n)}
                min={0}
                max={100000}
                prefix="$"
                placeholder="5,200"
              />
              <NumberInput
                id="homeoffice-basis"
                label="Home basis (excl. land)"
                value={values.homeBasis}
                onChange={(n) => set('homeBasis', n)}
                min={0}
                max={10000000}
                prefix="$"
                placeholder="380,000"
                helpText="Depreciated at 1/39 ≈ 2.564%/yr. Set 0 to ignore depreciation."
              />
            </div>
          ) : (
            <div>
              <NumberInput
                id="homeoffice-rent"
                label="Annual rent paid"
                value={values.rent}
                onChange={(n) => set('rent', n)}
                min={0}
                max={300000}
                prefix="$"
                placeholder="21,600"
                helpText="Renters deduct the business share of rent itself — the main reason the actual method wins in pricey cities."
              />
            </div>
          )}

          {/* Shared indirect expenses */}
          <div className="grid gap-4 sm:grid-cols-3">
            <NumberInput
              id="homeoffice-utilities"
              label="Utilities / yr"
              value={values.utilities}
              onChange={(n) => set('utilities', n)}
              min={0}
              max={50000}
              prefix="$"
              placeholder="2,400"
              helpText="Electricity, gas, water, sewer & trash. Internet is not a Form 8829 utility — deduct its business share separately on Schedule C."
            />
            <NumberInput
              id="homeoffice-insurance"
              label="Home insurance / yr"
              value={values.insurance}
              onChange={(n) => set('insurance', n)}
              min={0}
              max={30000}
              prefix="$"
              placeholder="600"
            />
            <NumberInput
              id="homeoffice-repairs"
              label="Repairs & upkeep / yr"
              value={values.repairs}
              onChange={(n) => set('repairs', n)}
              min={0}
              max={50000}
              prefix="$"
              placeholder="800"
              helpText="Whole-home repairs are prorated; work on the office itself would be 100% — enter that separately with your tax pro."
            />
          </div>

          {/* Tax context */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="label" id="homeoffice-se-label">Filing context</p>
              <div className="mt-2 grid grid-cols-1 gap-1.5" role="group" aria-labelledby="homeoffice-se-label">
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
                id="homeoffice-rate-slider"
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
              {SCENARIOS.map((s) => {
                const active = Object.entries(s.patch).every(
                  ([k, v]) => Math.abs((values as Record<string, number>)[k] - v) < 0.5,
                );
                return (
                  <button
                    key={s.label}
                    type="button"
                    aria-pressed={active}
                    onClick={() => applyScenario(s.patch)}
                    className={`focus-calm rounded-full px-3 py-1.5 text-xs font-medium transition-all duration-150 ${
                      active
                        ? 'border border-indigo-500 bg-indigo-50 text-indigo-700 dark:border-indigo-400 dark:bg-indigo-500/15 dark:text-indigo-300'
                        : 'border border-slate-200 bg-white text-slate-500 hover:border-indigo-300 hover:text-indigo-600 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-400 dark:hover:border-indigo-400/50 dark:hover:text-indigo-300'
                    }`}
                  >
                    {s.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="mt-6 flex items-start gap-2 rounded-lg bg-slate-50 p-3 text-xs leading-relaxed text-slate-600 dark:bg-white/[0.03] dark:text-slate-300">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-slate-400 dark:text-slate-500" aria-hidden="true" />
          <p>
            Tax year 2025, US federal. The space must qualify (regular &amp; exclusive use) and the
            deduction is limited to business gross income minus other expenses — neither is modeled
            here; the guide below covers both.
            {withSe
              ? ` SE-tax savings assume business earnings below the ${usd(HOME_OFFICE_CONSTANTS.ssWageBase2025, 0)} Social Security base.`
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
            shortTitle="Home Office"
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
              {actualWins ? 'Actual method deducts more' : simplifiedWins ? 'Simplified method deducts more' : 'Dead heat'}
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
                    actualWins ? 'simplified option' : 'actual method'
                  }, worth ${usd(Math.abs(result.savingDelta))}/yr of tax at your ${pct(values.marginalRate, 0)} rate${
                    withSe ? ' + SE' : ''
                  }.`}
            </p>
          </div>

          {/* Side-by-side ledger */}
          <dl className="mt-5 divide-y divide-slate-100 text-sm dark:divide-white/[0.06]">
            <LedgerRow
              label="Deduction per year"
              simplified={usd(simplified.deduction)}
              actual={usd(actual.deduction)}
            />
            <LedgerRow
              label="Federal income tax saved"
              simplified={usd(simplified.saving.incomeTax)}
              actual={usd(actual.saving.incomeTax)}
            />
            <LedgerRow
              label="SE tax saved (Schedule C)"
              simplified={withSe ? usd(simplified.saving.seTax) : '—'}
              actual={withSe ? usd(actual.saving.seTax) : '—'}
            />
            <div className="flex items-center justify-between py-2.5">
              <dt className="font-medium text-slate-700 dark:text-slate-300">Total tax saved / yr</dt>
              <dd className="readout text-sm font-semibold text-slate-900 dark:text-slate-100">
                <span className="text-slate-500 dark:text-slate-400">{usd(simplified.saving.total)}</span>
                <span className="mx-2 text-slate-300 dark:text-slate-600">/</span>
                {usd(actual.saving.total)}
              </dd>
            </div>
          </dl>
          <p className="mt-2 text-right font-mono text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Simplified · Actual
          </p>
        </div>

        {/* Cost-per-sq-ft insight */}
        <div className="card p-6">
          <h3 className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-slate-100">
            <Ruler className="h-4 w-4 text-slate-400 dark:text-slate-500" aria-hidden="true" />
            The one number that decides it
          </h3>
          <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
            Your home costs{' '}
            <strong className="readout text-slate-900 dark:text-white">{usd(b.costPerSqFt, 2)}/sq ft/yr</strong>{' '}
            to run ({isOwner ? 'including depreciation' : 'rent included'}), versus the simplified
            method&apos;s flat{' '}
            <strong className="readout text-slate-900 dark:text-white">
              ${HOME_OFFICE_CONSTANTS.simplifiedRatePerSqFt}.00
            </strong>
            .
          </p>
          <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
            {Math.abs(b.costPerSqFt - HOME_OFFICE_CONSTANTS.simplifiedRatePerSqFt) < 0.005
              ? 'At exactly $5.00/sq ft the two methods deduct identically for any office up to 300 sq ft; past the cap, the actual method keeps climbing while the simplified method stays flat.'
              : b.costPerSqFt > HOME_OFFICE_CONSTANTS.simplifiedRatePerSqFt
                ? 'Above $5/sq ft, the actual method deducts more at every office size.'
                : 'Below $5/sq ft, the simplified method wins for any office up to 300 sq ft' +
                  (result.crossoverSqFt !== null
                    ? ` — the actual method only retakes the lead past ${numFmt(result.crossoverSqFt, 0)} sq ft, where its share catches the flat ${usd(HOME_OFFICE_CONSTANTS.simplifiedMaxDeduction, 0)}.`
                    : ' — and never catches up within this home.')}
          </p>
          <p className="mt-3 border-t border-slate-100 pt-3 text-xs leading-relaxed text-slate-500 dark:border-white/[0.07] dark:text-slate-400">
            Tie line for a {numFmt(values.homeSqFt)} sq ft home: {usd(b.breakevenAnnualHomeCost, 0)}/yr of
            total running cost — 5 × home sq ft. That line decides offices up to 300 sq ft; beyond the
            cap the simplified method is pinned at {usd(HOME_OFFICE_CONSTANTS.simplifiedMaxDeduction, 0)}{' '}
            while the actual method keeps scaling, so a large office can favor it even below the line.
          </p>
        </div>

        {/* Boundary warnings */}
        {b.shareClamped ? (
          <div className="card border-amber-200 p-4 dark:border-amber-500/30">
            <p className="flex items-start gap-2 text-sm leading-relaxed text-amber-700 dark:text-amber-400">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              The office area is at least as large as the whole home — the business share was capped
              at 100%. Fix the areas above before trusting any number here.
            </p>
          </div>
        ) : isOwner && b.scheduleATransfer > 0 ? (
          <div className="card p-4">
            <p className="flex items-start gap-2 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-slate-400 dark:text-slate-500" aria-hidden="true" />
              {usd(b.scheduleATransfer)} of the actual-method deduction is mortgage interest &amp;
              property tax moved onto Schedule C. For standard-deduction filers that slice is a
              genuinely new deduction; for itemizers the interest portion was already on Schedule A,
              but the property-tax portion escapes the $10,000 SALT cap here — and for Schedule C
              filers the whole slice also cuts SE tax.
            </p>
          </div>
        ) : null}
      </div>

      {/* ================= Office-size sensitivity ================= */}
      <div className="lg:col-span-5">
        <div className="card p-5 sm:p-6">
          <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Both methods as the office grows
              </h3>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                At your current expenses ({usd(b.housingCost + b.operatingCost + b.depreciation, 0)}/yr
                to run the home), sweeping the office from 0 to{' '}
                {numFmt(Math.min(values.homeSqFt, 600))} sq ft.
              </p>
            </div>
            <span className="readout rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600 dark:bg-white/[0.05] dark:text-slate-300">
              now: {numFmt(values.officeSqFt)} sq ft →{' '}
              <span className={actualWins ? 'text-emerald-600 dark:text-emerald-400' : simplifiedWins ? 'text-sky-600 dark:text-sky-400' : 'text-slate-500 dark:text-slate-400'}>
                {usd(actualWins ? actual.deduction : simplified.deduction, 0)}
              </span>
            </span>
          </div>
          <ComparisonChart
            series={[
              {
                label: `Simplified method ($5 × sq ft, capped at ${usd(HOME_OFFICE_CONSTANTS.simplifiedMaxDeduction, 0)})`,
                color: '#0ea5e9',
                points: sweep.map((s) => ({ x: s.sqft, y: s.simplifiedDeduction })),
              },
              {
                label: `Actual method (${usd(b.costPerSqFt, 2)}/sq ft × office area)`,
                color: '#6366f1',
                points: sweep.map((s) => ({ x: s.sqft, y: s.actualDeduction })),
              },
            ]}
            xLabel="Office area (sq ft)"
            yLabel="Deduction / yr"
            xFormat={(n) => numFmt(n)}
            yFormat={(n) => usdCompact(n)}
            height={280}
            marker={{
              x: clamp(values.officeSqFt, 1, sweep[sweep.length - 1].sqft - 1),
              label: 'your office',
            }}
            caption="The simplified line is straight at $5/sq ft until 300 sq ft, then flat at $1,500 forever — a large office gains nothing under it. The actual line is share × running cost: it keeps climbing to the walls of the house. Where the lines cross is exactly where your cost per square foot says they should."
          />
        </div>
      </div>
    </div>
  );
}

function LedgerRow({ label, simplified, actual }: { label: string; simplified: string; actual: string }) {
  return (
    <div className="flex items-center justify-between py-2.5">
      <dt className="text-slate-600 dark:text-slate-300">{label}</dt>
      <dd className="readout text-sm font-semibold text-slate-900 dark:text-slate-100">
        <span className="text-slate-500 dark:text-slate-400">{simplified}</span>
        <span className="mx-2 text-slate-300 dark:text-slate-600">/</span>
        {actual}
      </dd>
    </div>
  );
}

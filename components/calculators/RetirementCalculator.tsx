'use client';

import { useEffect, useMemo } from 'react';
import { CalendarClock, CircleDollarSign, Info, PiggyBank, RotateCcw } from 'lucide-react';
import NumberInput, { AnimatedNumber, CopyButton, SliderControl } from '@/components/NumberInput';
import ScenarioButtons from '@/components/ScenarioButtons';
import ComparisonChart from '@/components/ComparisonChart';
import {
  capacitySweep,
  catchUpForAge,
  compareRetirement,
  deferralLimitFor,
  RETIREMENT_CONSTANTS,
  type BusinessMode,
} from '@/lib/retirement';
import { usd, usdCompact, pct, clamp } from '@/lib/format';
import { useWorkbenchInputs, recordRecent } from '@/lib/workbench';

const SLUG = 'solo-401k-calculator';
const HREF = '/solo-401k-calculator/';
/** modeCode rides along as a number so saved scenarios & share links carry it. */
const DEFAULTS = { income: 200000, age: 45, plannedDeferral: 23500, marginalRate: 24, modeCode: 0 };

const SOLO_COLOR = '#6366f1';
const SEP_COLOR = '#0ea5e9';

/** Mode presets express how the same dollars reach the plan ledger. */
const INCOME_PRESETS: Record<BusinessMode, number[]> = {
  'sole-prop': [80_000, 150_000, 250_000, 400_000],
  scorp: [50_000, 80_000, 120_000, 200_000],
};

const BRACKET_PRESETS = [10, 12, 22, 24, 32, 35, 37];

export default function RetirementCalculator() {
  const { values, set, reset } = useWorkbenchInputs(SLUG, DEFAULTS);

  useEffect(() => {
    recordRecent(SLUG);
  }, []);

  /*
   * Sanitize restored inputs. The workbench hook persists and restores numbers
   * verbatim — neither URL params nor localStorage are clamped on the way in —
   * so a hand-edited share link like ?marginalRate=99 would otherwise put two
   * different rates on one card (the lib clamps to [0, 85], the UI read the
   * raw 99). Every readout below draws from this one normalized set, and the
   * write-back effect re-persists the clean values so saved scenarios and
   * share links stop carrying out-of-domain numbers. The rate domain is the
   * real 2025 federal brackets (10–37, the slider's own range); inside it the
   * lib's [0, 85] guard can never bind, so one rate prices everything.
   */
  const income = clamp(values.income, 0, 10_000_000);
  const age = Math.round(clamp(values.age, 18, 80));
  const deferralMax = deferralLimitFor(age);
  const plannedDeferral = clamp(values.plannedDeferral, 0, deferralMax);
  const marginalRate = clamp(values.marginalRate, 10, 37);
  const modeCode = values.modeCode === 1 ? 1 : 0;
  const mode: BusinessMode = modeCode === 1 ? 'scorp' : 'sole-prop';
  const catchUp = catchUpForAge(age);

  useEffect(() => {
    if (
      values.income !== income ||
      values.age !== age ||
      values.plannedDeferral !== plannedDeferral ||
      values.marginalRate !== marginalRate ||
      values.modeCode !== modeCode
    ) {
      set('income', income);
      set('age', age);
      set('plannedDeferral', plannedDeferral);
      set('marginalRate', marginalRate);
      set('modeCode', modeCode);
    }
  });

  const result = useMemo(
    () => compareRetirement({ mode, income, age, plannedDeferral }, marginalRate),
    [mode, income, age, plannedDeferral, marginalRate],
  );

  // Sweep range keyed to the mode. SSG and the first client render both start
  // from DEFAULTS (modeCode 0), so this stays hydration-stable; the workbench
  // effect swaps the mode afterwards and the sweep recomputes in the same pass.
  const sweepFrom = 30_000;
  const sweepTo = mode === 'sole-prop' ? 500_000 : 300_000;
  const sweep = useMemo(
    () => capacitySweep(mode, age, sweepFrom, sweepTo, 48),
    [mode, age, sweepTo],
  );
  // Only pin a marker inside the plotted window — pinning an out-of-range
  // income at the edge would draw it at the wrong income.
  const markerIncome = income > sweepFrom && income < sweepTo ? income : null;

  function resetAll() {
    reset();
  }

  const tie = result.winner === 'tie';
  const copySummary = `Solo 401(k) vs SEP-IRA at ${usd(income, 0)} ${
    mode === 'scorp' ? 'W-2 wages' : 'Schedule C net profit'
  } (age ${age}): Solo 401(k) capacity ${usd(result.solo.total, 0)} vs SEP-IRA ${usd(
    result.sep.contribution,
    0,
  )}${tie ? ' — identical capacity' : ` — Solo 401(k) holds ${usd(result.extraCapacity, 0)} more`}. Deduction value at ${pct(marginalRate, 0)}: ${usd(result.taxSavedSolo, 0)} vs ${usd(result.taxSavedSep, 0)}.`;

  const xLabel = mode === 'scorp' ? 'W-2 wages' : 'Schedule C net profit';

  return (
    <div className="grid gap-6 lg:grid-cols-5">
      {/* ================= Inputs ================= */}
      <div className="card p-6 sm:p-8 lg:col-span-3">
        <div className="space-y-6">
          {/* Entity mode: decides which base the employer % is applied to */}
          <div>
            <p className="label" id="retirement-mode-label">
              How you&apos;re paid
            </p>
            <div
              role="group"
              aria-labelledby="retirement-mode-label"
              className="mt-2 grid grid-cols-2 gap-2 rounded-xl bg-slate-100 p-1 dark:bg-white/[0.05]"
            >
              {(
                [
                  { code: 0, label: 'Sole proprietor', hint: 'Schedule C profit' },
                  { code: 1, label: 'S-Corp owner', hint: 'W-2 wages' },
                ] as const
              ).map((m) => {
                const active = modeCode === m.code;
                return (
                  <button
                    key={m.code}
                    type="button"
                    aria-pressed={active}
                    onClick={() => set('modeCode', m.code)}
                    className={`focus-calm rounded-lg px-3 py-2 text-sm font-semibold transition-all duration-150 ${
                      active
                        ? 'bg-white text-indigo-700 shadow-sm dark:bg-indigo-500/20 dark:text-indigo-300'
                        : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
                    }`}
                  >
                    {m.label}
                    <span className="mt-0.5 block font-mono text-[10px] font-normal uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      {m.hint}
                    </span>
                  </button>
                );
              })}
            </div>
            <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
              {mode === 'scorp'
                ? 'Employer side: 25% of W-2 wages — the salary itself is the ceiling.'
                : 'Employer side: 20% of (net profit − ½ SE tax) — the 25% plan rate solved on the self-employed base.'}
            </p>
          </div>

          <div>
            <NumberInput
              id="retirement-income"
              label={mode === 'scorp' ? 'Owner W-2 wages for the year' : 'Schedule C net profit'}
              value={income}
              onChange={(n) => set('income', clamp(n, 0, 10_000_000))}
              min={0}
              max={10000000}
              prefix="$"
              placeholder="200,000"
              helpText={
                mode === 'scorp'
                  ? 'Box 1 wages on your own W-2. Distributions do not count toward any plan.'
                  : 'Line 31 of Schedule C — after business expenses, before SE tax and contributions.'
              }
            />
            <div className="mt-3">
              <SliderControl
                id="retirement-income-slider"
                label={mode === 'scorp' ? 'W-2 wages' : 'Net profit'}
                value={income}
                onChange={(n) => set('income', n)}
                min={10000}
                max={2000000}
                step={5000}
                prefix="$"
                logarithmic
                presets={INCOME_PRESETS[mode]}
              />
            </div>
          </div>

          <div className="grid gap-6 sm:grid-cols-2">
            <div>
              <NumberInput
                id="retirement-age"
                label="Age at year end"
                value={age}
                onChange={(n) => set('age', Math.round(clamp(n, 18, 80)))}
                min={18}
                max={80}
                placeholder="45"
                helpText={
                  catchUp > 0
                    ? `Catch-up eligible: +${usd(catchUp, 0)} on top of the ${usd(
                        RETIREMENT_CONSTANTS.employeeDeferralLimit,
                        0,
                      )} deferral limit${catchUp > RETIREMENT_CONSTANTS.catchUpLimit ? ' (SECURE 2.0 enhanced, ages 60–63)' : ''}.`
                    : 'Catch-up deferrals unlock at 50 (enhanced $11,250 at 60–63).'
                }
              />
              <div className="mt-3">
              <SliderControl
                id="retirement-age-slider"
                label="Age"
                value={age}
                onChange={(n) => set('age', Math.round(n))}
                min={18}
                max={80}
                step={1}
                presets={[30, 45, 55, 62]}
              />
              </div>
            </div>

            <div>
              <NumberInput
                id="retirement-deferral"
                label="Planned employee deferral"
                value={plannedDeferral}
                onChange={(n) => set('plannedDeferral', clamp(n, 0, deferralMax))}
                min={0}
                max={deferralMax}
                prefix="$"
                placeholder="23,500"
                helpText={`Solo 401(k) only. 2025 ceiling at your age: ${usd(deferralMax, 0)}.`}
              />
              <div className="mt-3">
                <SliderControl
                  id="retirement-deferral-slider"
                  label="Deferral"
                  value={clamp(plannedDeferral, 0, deferralMax)}
                  onChange={(n) => set('plannedDeferral', n)}
                  min={0}
                  max={deferralMax}
                  step={500}
                  prefix="$"
                  presets={[0, 11750, deferralMax]}
                  formatValue={(n) =>
                    `${usdCompact(n)} · ${pct((n / (deferralMax || 1)) * 100, 0)} of limit`
                  }
                />
              </div>
            </div>
          </div>

          <div>
            <SliderControl
              id="retirement-rate-slider"
              label="Marginal federal income-tax rate"
              value={marginalRate}
              onChange={(n) => set('marginalRate', n)}
              min={10}
              max={37}
              step={1}
              suffix="%"
              presets={BRACKET_PRESETS}
              helpText="The bracket your last dollar of taxable income lands in — used only to price the deduction."
            />
          </div>
        </div>

        <div className="mt-6 flex items-start gap-2 rounded-lg bg-slate-50 p-3 text-xs leading-relaxed text-slate-600 dark:bg-white/[0.03] dark:text-slate-300">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-slate-400 dark:text-slate-500" aria-hidden="true" />
          <p>
            2025 federal limits: deferral {usd(RETIREMENT_CONSTANTS.employeeDeferralLimit, 0)} · catch-up{' '}
            {usd(RETIREMENT_CONSTANTS.catchUpLimit, 0)} at 50+ ({usd(RETIREMENT_CONSTANTS.enhancedCatchUpLimit, 0)}{' '}
            at 60–63) · employer 25% of comp (20% self-employed equivalent) · everything capped at{' '}
            {usd(RETIREMENT_CONSTANTS.totalAdditionsLimit, 0)} per plan, catch-ups excluded. Contributions cut
            income tax — never self-employment tax.
          </p>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" onClick={resetAll} className="btn-ghost">
            <RotateCcw className="h-4 w-4 text-indigo-500 dark:text-indigo-300" aria-hidden="true" />
            Reset
          </button>
          <CopyButton text={copySummary} label="Copy result" />
          <ScenarioButtons
            slug={SLUG}
            shortTitle="Solo 401(k)"
            href={HREF}
            params={{ income, age, plannedDeferral, marginalRate, modeCode }}
          />
        </div>
      </div>

      {/* ================= Results ================= */}
      <div className="space-y-4 lg:col-span-2">
        {/* Headline verdict */}
        <div className="card p-6 sm:p-8">
          <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            <PiggyBank className="h-4 w-4" aria-hidden="true" />
            Capacity at these numbers
          </h2>
          <div className="mt-3">
            <div className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
              {tie ? 'Both plans hold the same dollars' : 'Solo 401(k) holds more'}
            </div>
            <AnimatedNumber
              value={result.extraCapacity}
              format={(n) => usd(n, 0)}
              className={`readout mt-1 block text-4xl font-extrabold tracking-tight ${
                tie ? 'text-slate-500 dark:text-slate-400' : 'text-emerald-600 dark:text-emerald-400'
              }`}
            />
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              {tie
                ? income <= 0
                  ? 'no income to fund either plan here.'
                  : plannedDeferral < 0.5
                    ? 'you planned no deferral — the Solo 401(k)’s extra room IS the deferral bucket, so both plans hold the same employer-only dollars.'
                    : 'both plans sit at their ceilings here — choose on Roth, loans & deadlines instead.'
                : 'more contribution room per year than the SEP-IRA.'}
            </p>
          </div>

          {/* Side-by-side ledger */}
          <dl className="mt-5 divide-y divide-slate-100 text-sm dark:divide-white/[0.06]">
            <PlanRow
              label={`Employee deferral${result.solo.catchUp > 0 ? ` (incl. ${usd(result.solo.catchUp, 0)} catch-up)` : ''}`}
              solo={usd(result.solo.deferralTotal, 0)}
              sep={<span className="text-slate-400 dark:text-slate-500">—</span>}
            />
            <PlanRow
              label="Employer contribution"
              solo={usd(result.solo.employerContribution, 0)}
              sep={usd(result.sep.contribution, 0)}
            />
            <PlanRow
              label="Total annual capacity"
              solo={usd(result.solo.total, 0)}
              sep={usd(result.sep.contribution, 0)}
              strong
            />
          </dl>
          <p className="mt-2 text-right font-mono text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Solo 401(k) · SEP-IRA
          </p>
        </div>

        {/* Tax-deferral value */}
        <div className="card p-6">
          <h3 className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-slate-100">
            <CircleDollarSign className="h-4 w-4 text-emerald-500 dark:text-emerald-400" aria-hidden="true" />
            Deduction value at {pct(marginalRate, 0)}
          </h3>
          <dl className="mt-3 divide-y divide-slate-100 text-sm dark:divide-white/[0.06]">
            <PlanRow
              label="Federal income tax deferred"
              solo={usd(result.taxSavedSolo, 0)}
              sep={usd(result.taxSavedSep, 0)}
            />
            <PlanRow
              label="Extra deferral the 401(k) buys"
              solo={usd(result.extraTaxSaved, 0)}
              sep={<span className="text-slate-400 dark:text-slate-500">—</span>}
              strong
            />
          </dl>
          <p className="mt-3 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
            Assumes the pre-tax strategy. Retirement contributions never reduce self-employment
            tax — only income tax.
          </p>
        </div>

        {/* Roth dial */}
        <div className="card p-6">
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">The Roth dial</h3>
          <ul className="mt-3 space-y-2 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
            <li>
              <strong className="text-slate-800 dark:text-slate-100">Solo 401(k):</strong> the employee deferral
              can be designated Roth — no deduction now, tax-free later. The employer 25% share is always pre-tax.
            </li>
            <li>
              <strong className="text-slate-800 dark:text-slate-100">SEP-IRA:</strong> a Roth SEP has been
              allowed since SECURE 2.0 §601 (tax years beginning after 2022), but few custodians offer one —
              otherwise convert to a Roth IRA afterward and pay the tax then.
            </li>
            <li className="text-slate-500 dark:text-slate-400">
              At a {pct(marginalRate, 0)} marginal rate, Roth swaps this year&apos;s{' '}
              {usd(result.solo.deferralTotal * (marginalRate / 100), 0)} deduction on the deferral slice for a
              tax-free pot later.
            </li>
          </ul>
        </div>

        {/* Deadline reminder */}
        <div className="card p-6">
          <h3 className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-slate-100">
            <CalendarClock className="h-4 w-4 text-amber-500 dark:text-amber-400" aria-hidden="true" />
            Deadlines that decide for you
          </h3>
          <p className="mt-2 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
            A <strong className="text-slate-800 dark:text-slate-100">new Solo 401(k)</strong> generally must exist
            by <strong>December 31</strong> to credit deferrals for that year (employer share: up to the extended
            filing deadline). A <strong className="text-slate-800 dark:text-slate-100">SEP-IRA</strong> can be
            opened <em>and</em> funded as late as that filing deadline — even after the year closes.
          </p>
        </div>
      </div>

      {/* ================= Income sweep ================= */}
      <div className="lg:col-span-5">
        <div className="card p-5 sm:p-6">
          <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Contribution capacity vs income
              </h3>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                Maximum capacity at age {age} ({xLabel.toLowerCase()}), assuming you defer the full{' '}
                {usd(deferralMax, 0)} limit. Your income: {usd(income, 0)}
                {markerIncome === null ? ' — beyond the plotted window.' : '.'}
              </p>
            </div>
            <span className="readout rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600 dark:bg-white/[0.05] dark:text-slate-300">
              now: {tie ? 'tie' : `+${usd(result.extraCapacity, 0)}`} for the Solo 401(k)
            </span>
          </div>
          <ComparisonChart
            series={[
              {
                label: 'Solo 401(k) max capacity',
                color: SOLO_COLOR,
                points: sweep.map((s) => ({ x: s.income, y: s.solo })),
              },
              {
                label: 'SEP-IRA max capacity',
                color: SEP_COLOR,
                points: sweep.map((s) => ({ x: s.income, y: s.sep })),
              },
            ]}
            xLabel={xLabel}
            yLabel="Max annual contribution"
            xFormat={(n) => usdCompact(n)}
            yFormat={(n) => usdCompact(n)}
            height={300}
            marker={markerIncome !== null ? { x: markerIncome, label: 'your income' } : undefined}
            caption="Every point is the full 2025 limit stack recomputed — deferral, catch-up, employer percentage, the Pub 560 self-employed worksheet cap, and the $70,000 ceiling, all interacting. Through the middle band the lines run parallel (identical employer engines) and the vertical gap is the deferral bucket the SEP simply does not have; at the far left the worksheet claws part of that bucket back (the employer share cannot exceed ½ of net earnings after deferrals), and at the top the Solo 401(k) flattens at its ceiling."
          />
        </div>
      </div>
    </div>
  );
}

function PlanRow({
  label,
  solo,
  sep,
  strong = false,
}: {
  label: string;
  solo: React.ReactNode;
  sep: React.ReactNode;
  strong?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-2.5">
      <dt className={strong ? 'font-semibold text-slate-700 dark:text-slate-200' : 'text-slate-600 dark:text-slate-300'}>
        {label}
      </dt>
      <dd className={`readout whitespace-nowrap text-sm ${strong ? 'font-bold text-slate-900 dark:text-white' : 'font-semibold text-slate-900 dark:text-slate-100'}`}>
        <span className="text-slate-500 dark:text-slate-400">{solo}</span>
        <span className="mx-2 text-slate-300 dark:text-slate-600">/</span>
        {sep}
      </dd>
    </div>
  );
}

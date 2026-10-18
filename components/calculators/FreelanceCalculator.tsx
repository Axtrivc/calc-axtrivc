'use client';

import { useEffect, useMemo } from 'react';
import { Info, RotateCcw } from 'lucide-react';
import NumberInput, { AnimatedNumber, CopyButton, SliderControl, StatCard } from '@/components/NumberInput';
import ScenarioButtons from '@/components/ScenarioButtons';
import ComparisonChart from '@/components/ComparisonChart';
import { computeFreelanceRate } from '@/lib/freelance';
import { usd, numFmt, pct, usdCompact } from '@/lib/format';
import { useWorkbenchInputs, recordRecent } from '@/lib/workbench';

const SLUG = 'freelance-hourly-rate-calculator';
const DEFAULTS = { takeHome: 90000, expenses: 12000, taxRate: 30, vacation: 25, weeklyHours: 25 };

export default function FreelanceCalculator() {
  const { values, set, reset } = useWorkbenchInputs(SLUG, DEFAULTS);
  const { takeHome, expenses, taxRate, vacation, weeklyHours } = values;

  useEffect(() => {
    recordRecent(SLUG);
  }, []);

  const setTakeHome = (n: number) => set('takeHome', n);
  const setExpenses = (n: number) => set('expenses', n);
  const setTaxRate = (n: number) => set('taxRate', n);
  const setVacation = (n: number) => set('vacation', n);
  const setWeeklyHours = (n: number) => set('weeklyHours', n);

  /* Domain guard mirroring lib/freelance.ts clamps: deep-link params reach the
     state unclamped, so re-apply the same bounds before ANY consumer — the
     model, the readouts, and the share URL — sees the value. This keeps
     ?vacation=300 from silently computing with 120 while displaying 300. */
  const eff = {
    takeHome: Math.max(0, takeHome),
    expenses: Math.max(0, expenses),
    taxRate: Math.min(70, Math.max(0, taxRate)),
    vacation: Math.min(120, Math.max(0, vacation)),
    weeklyHours: Math.min(80, Math.max(1, weeklyHours)),
  };

  const r = useMemo(
    () =>
      computeFreelanceRate({
        targetTakeHome: eff.takeHome,
        businessExpenses: eff.expenses,
        taxRate: eff.taxRate,
        vacationDays: eff.vacation,
        weeklyBillableHours: eff.weeklyHours,
      }),
    [eff.takeHome, eff.expenses, eff.taxRate, eff.vacation, eff.weeklyHours]
  );

  const copyText = `Freelance rate: ${usd(r.hourlyRate, 0)}/hr · day rate ${usd(r.dayRate, 0)} · monthly gross ${usd(r.monthlyRate, 0)} (gross needed ${usd(r.grossNeeded, 0)}, ${numFmt(r.billableHours, 0)} billable hrs/yr)`;

  /* Capacity sensitivity sweep for the chart: recompute the whole model at
     each weekly-hours level with everything else held at the user's inputs.
     Window 5–60 h/wk keeps the hyperbola readable; inputs outside it get an
     explicit notice below the chart (never a silently clamped marker). */
  const SWEEP_MIN = 5;
  const SWEEP_MAX = 60;
  const sweep = useMemo(() => {
    const pts: { x: number; y: number }[] = [];
    for (let h = SWEEP_MIN; h <= SWEEP_MAX; h += 1) {
      pts.push({
        x: h,
        y: computeFreelanceRate({
          targetTakeHome: eff.takeHome,
          businessExpenses: eff.expenses,
          taxRate: eff.taxRate,
          vacationDays: eff.vacation,
          weeklyBillableHours: h,
        }).hourlyRate,
      });
    }
    return pts;
  }, [eff.takeHome, eff.expenses, eff.taxRate, eff.vacation]);
  /* ComparisonChart draws the marker only strictly inside (xMin, xMax) —
     mirror that exact predicate so the marker and the notice agree. */
  const capacityInWindow = eff.weeklyHours > SWEEP_MIN && eff.weeklyHours < SWEEP_MAX;

  /* Reality-check decomposition of the 2,080-hour FTE year: how much of the
     un-billed gap is PTO you chose vs. working time you can't invoice. */
  const FTE_HOURS = 2080;
  const ptoHours = Math.round(eff.vacation * 8);
  const unBilled = Math.max(0, FTE_HOURS - r.billableHours);
  const nonBillableWorkingHours = Math.max(0, unBilled - ptoHours);
  const workingHours = r.billableWeeks * 40; // capacity the user actually has
  /* One coherent band system, anchored to the methodology's ~60% note and the
     FAQ's >30 billed-hours caution — thresholds meet, no silent middle:
       impossible  utilization > 100%  (strictly more hours than the FTE year)
       sold out    zero hours left for sales/admin inside the working year
       thin        ≤ ~2 h/wk left for the business itself (≤5% of an FTE year)
       normal      split PTO vs. sales/admin; below 60% add capacity note */
  const overCapacity = r.utilization > 100;
  const soldOut = !overCapacity && nonBillableWorkingHours === 0;
  const thinPipeline = !overCapacity && !soldOut && nonBillableWorkingHours <= FTE_HOURS * 0.05;
  const capacityBound = r.utilization < 60; // methodology: below ~60%, capacity — not price — binds

  return (
    <div className="grid gap-6 lg:grid-cols-5">
      {/* Inputs */}
      <div className="card lg:col-span-3 p-6 sm:p-8">
        <h2 className="mb-1 text-base font-semibold text-slate-900 dark:text-slate-100">Your numbers</h2>
        <p className="mb-6 text-sm text-slate-500 dark:text-slate-400">All annual figures unless noted.</p>

        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <NumberInput
              id="take-home"
              label="Target annual take-home pay"
              value={eff.takeHome}
              onChange={setTakeHome}
              min={0}
              prefix="$"
              placeholder="90000"
              helpText="The net pay you want in your pocket after taxes & expenses."
            />
            <div className="mt-3">
              <SliderControl
                id="take-home-slider"
                label="" ariaLabel="Target annual take-home pay"
                value={eff.takeHome}
                onChange={setTakeHome}
                min={10000}
                max={500000}
                step={1000}
                prefix="$"
                logarithmic
                presets={[50000, 100000, 200000]}
              />
            </div>
          </div>
          <div>
            <NumberInput
              id="expenses"
              label="Annual business expenses"
              value={eff.expenses}
              onChange={setExpenses}
              min={0}
              prefix="$"
              placeholder="12000"
              helpText="Software, hardware, contractor help, co-working, etc."
            />
            <div className="mt-3">
              <SliderControl
                id="expenses-slider"
                label="" ariaLabel="Annual business expenses"
                value={eff.expenses}
                onChange={setExpenses}
                min={0}
                max={100000}
                step={500}
                prefix="$"
                logarithmic
                presets={[5000, 15000, 30000]}
              />
            </div>
          </div>
          <div>
            <NumberInput
              id="tax-rate"
              label="Effective tax rate"
              value={eff.taxRate}
              onChange={setTaxRate}
              min={0}
              max={70}
              step={0.5}
              suffix="%"
              placeholder="30"
              helpText="Effective combined rate, not a simple sum: half your SE tax is deductible and the 12.4% Social Security share caps at the annual wage base."
            />
            <div className="mt-3">
              <SliderControl
                id="tax-rate-slider"
                label="" ariaLabel="Effective tax rate"
                value={eff.taxRate}
                onChange={setTaxRate}
                min={0}
                max={70}
                step={0.5}
                suffix="%"
                presets={[20, 30, 40]}
              />
            </div>
          </div>
          <div>
            <NumberInput
              id="vacation"
              label="Vacation & public holidays"
              value={eff.vacation}
              onChange={setVacation}
              min={0}
              max={120}
              suffix="days"
              placeholder="25"
              helpText="Days/yr you won't work — PTO + holidays + sick."
            />
            <div className="mt-3">
              <SliderControl
                id="vacation-slider"
                label="" ariaLabel="Vacation and public holidays"
                value={eff.vacation}
                onChange={setVacation}
                min={0}
                max={120}
                step={1}
                suffix="d"
                presets={[15, 25, 40]}
              />
            </div>
          </div>
          <div className="sm:col-span-2">
            <NumberInput
              id="weekly-hours"
              label="Billable hours per week"
              value={eff.weeklyHours}
              onChange={setWeeklyHours}
              min={1}
              max={80}
              suffix="hrs"
              placeholder="25"
              helpText="Realistic hours actually billed to clients. 20–30 is common; the rest goes to sales/admin."
            />
            <div className="mt-3">
              <SliderControl
                id="weekly-hours-slider"
                label="" ariaLabel="Billable hours per week"
                value={eff.weeklyHours}
                onChange={setWeeklyHours}
                min={1}
                max={80}
                step={1}
                suffix="h"
                presets={[15, 25, 40]}
              />
            </div>
          </div>
        </div>

        <div className="mt-6 flex items-start gap-2 rounded-lg bg-slate-50 p-3 text-xs leading-relaxed text-slate-600 dark:bg-white/[0.03] dark:text-slate-300">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-slate-400 dark:text-slate-500" aria-hidden="true" />
          <p>
            The math: <code>hourly = (expenses + takeHome / (1 − tax%)) / (billable weeks × weekly hours)</code>.
            Expenses are deductible, so only your pay gets grossed up for tax.
          </p>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" onClick={reset} className="btn-ghost">
            <RotateCcw className="h-4 w-4 text-indigo-500 dark:text-indigo-300" aria-hidden="true" />
            Reset
          </button>
          <CopyButton text={copyText} label="Copy result" />
          <ScenarioButtons
            slug={SLUG}
            shortTitle="Hourly Rate"
            href="/freelance-hourly-rate-calculator/"
            params={{ takeHome: eff.takeHome, expenses: eff.expenses, taxRate: eff.taxRate, vacation: eff.vacation, weeklyHours: eff.weeklyHours }}
          />
        </div>
      </div>

      {/* Results */}
      <div className="lg:col-span-2 space-y-4">
        <div className="card p-6 sm:p-8">
          <span className="text-sm font-semibold uppercase tracking-wide text-emerald-600 dark:text-emerald-400">
            Your minimum rate
          </span>
          <div className="mt-2 text-4xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100">
            <AnimatedNumber value={r.hourlyRate} format={(n) => usd(n, 0)} className="readout text-emerald-600 dark:text-emerald-400" />
            <span className="ml-1 text-base font-medium text-slate-500 dark:text-slate-400">/hr</span>
          </div>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            The minimum rate that hits your take-home target. Below it the year ends short; each extra dollar billed above
            it keeps (1 − tax %) — the model&apos;s flat-tax approximation.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <StatCard
            label="Day rate (8h)"
            value={<AnimatedNumber value={r.dayRate} format={(n) => usd(n, 0)} />}
            sublabel="8 × hourly — a sold day consumes 8 h of capacity"
            emphasis
          />
          <StatCard
            label="Monthly gross"
            value={<AnimatedNumber value={r.monthlyRate} format={(n) => usd(n, 0)} />}
            sublabel="Revenue target"
          />
        </div>

        <div className="card p-6 sm:p-8">
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">The math behind your rate</h3>
          <dl className="mt-3 space-y-2.5 text-sm">
            <div className="flex justify-between">
              <dt className="text-slate-600 dark:text-slate-300">Take-home target</dt>
              <dd className="readout font-semibold text-slate-900 dark:text-slate-100">{usd(eff.takeHome, 0)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-600 dark:text-slate-300">Effective tax rate</dt>
              <dd className="readout font-semibold text-slate-900 dark:text-slate-100">{pct(eff.taxRate, 1)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-600 dark:text-slate-300">Take-home ÷ (1 − tax) = grossed-up pay</dt>
              <dd className="readout font-semibold text-slate-900 dark:text-slate-100">
                <AnimatedNumber value={eff.takeHome / (1 - eff.taxRate / 100)} format={(n) => usd(n, 0)} />
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-600 dark:text-slate-300">+ Business expenses (pre-tax)</dt>
              <dd className="readout font-semibold text-slate-900 dark:text-slate-100">{usd(eff.expenses, 0)}</dd>
            </div>
            <div className="flex justify-between border-t border-slate-200 dark:border-white/[0.08] pt-2.5">
              <dt className="font-medium text-slate-700 dark:text-slate-200">Gross revenue needed</dt>
              <dd className="readout font-bold text-indigo-600 dark:text-indigo-300">
                <AnimatedNumber value={r.grossNeeded} format={(n) => usd(n, 0)} />
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-600 dark:text-slate-300">Billable weeks/yr</dt>
              <dd className="readout font-semibold text-slate-900 dark:text-slate-100">
                <AnimatedNumber value={r.billableWeeks} format={(n) => numFmt(n, 1)} />
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-600 dark:text-slate-300">Billable hours/yr</dt>
              <dd className="readout font-semibold text-slate-900 dark:text-slate-100">
                <AnimatedNumber value={r.billableHours} format={(n) => numFmt(n, 0)} />
              </dd>
            </div>
            <div className="flex justify-between border-t border-slate-200 dark:border-white/[0.08] pt-2.5">
              <dt className="font-medium text-slate-700 dark:text-slate-200">Required hourly rate</dt>
              <dd className="readout font-bold text-emerald-600 dark:text-emerald-400">
                <AnimatedNumber value={r.hourlyRate} format={(n) => usd(n, 0)} />/hr
              </dd>
            </div>
          </dl>
        </div>

        {overCapacity ? (
          <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-300">
            <strong className="font-semibold">Capacity check:</strong> your inputs specify {numFmt(r.billableHours, 0)} billed
            hours — more than the {numFmt(FTE_HOURS, 0)}-hour FTE year even contains ({pct(r.utilization, 0)} utilization).
            A rate built on impossible hours is a rate you can&apos;t collect; verify the weekly billable input.
          </div>
        ) : soldOut ? (
          <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-300">
            <strong className="font-semibold">Capacity check:</strong> your plan bills {numFmt(r.billableHours, 0)} hours
            against a {numFmt(workingHours, 0)}-hour working year ({pct(r.utilization, 0)} of an FTE year) — nothing remains
            for sales, admin, or finding the next client. Rates built on a fully-billed year break the moment a contract
            pauses.
          </div>
        ) : (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-400/25 dark:bg-amber-400/10 dark:text-amber-300">
            <strong className="font-semibold">Reality check:</strong> only {numFmt(r.billableHours, 0)} of {numFmt(FTE_HOURS, 0)} FTE
            hours are billable ({pct(r.utilization, 0)}). Of the {numFmt(unBilled, 0)}-hour gap, {numFmt(ptoHours, 0)} is the time
            off you chose; the remaining {numFmt(nonBillableWorkingHours, 0)} goes to sales, admin, and unpaid work — which is
            exactly why your rate can&apos;t match a salaried employee&apos;s.
            {thinPipeline && (
              <>
                {' '}
                That is only ≈{numFmt(nonBillableWorkingHours / r.billableWeeks, 0)} h/week for the business itself — thin
                pipeline risk.
              </>
            )}
            {capacityBound && (
              <>
                {' '}
                At {pct(r.utilization, 0)} utilization, capacity — not price — is the binding constraint worth attacking first.
              </>
            )}
          </div>
        )}
      </div>

      {/* ================= Capacity sensitivity ================= */}
      <div className="lg:col-span-5">
        <div className="card p-5 sm:p-6">
          <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Required rate vs weekly billable capacity
              </h3>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                Your take-home ({usd(eff.takeHome, 0)}), expenses, tax, and PTO held fixed — only capacity moves (plotted{' '}
                {SWEEP_MIN}–{SWEEP_MAX} h/wk).
              </p>
            </div>
            <span className="readout rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600 dark:bg-white/[0.05] dark:text-slate-300">
              now: {numFmt(eff.weeklyHours, 0)} h/wk →{' '}
              <span className="text-emerald-600 dark:text-emerald-400">{usd(r.hourlyRate, 0)}/hr</span>
            </span>
          </div>
          <ComparisonChart
            series={[
              {
                label: 'Minimum hourly rate',
                color: '#10b981',
                points: sweep,
                fillTo: 0,
              },
            ]}
            xLabel="Billable hours per week"
            yLabel="Required rate / hr"
            xFormat={(n) => `${n} h`}
            yFormat={(n) => usdCompact(n)}
            height={280}
            marker={capacityInWindow ? { x: eff.weeklyHours, label: 'your capacity' } : undefined}
            caption="Every point is the full model recomputed, not a linear approximation. The curve only bends one way: rate × hours is pinned by your cost stack, so every billable hour you lose has to be repriced into the hours that remain."
          />
          {!capacityInWindow && (
            <p className="mt-3 flex items-start gap-2 text-xs leading-relaxed text-amber-700 dark:text-amber-400">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              Your {numFmt(eff.weeklyHours, 0)} h/wk capacity sits outside the plotted {SWEEP_MIN}–{SWEEP_MAX} h/wk window, so
              it is not marked on the curve. The law is unchanged — rate = gross ÷ (billable weeks × hours) — and at{' '}
              {numFmt(eff.weeklyHours, 0)} h/wk your floor is {usd(r.hourlyRate, 0)}/hr.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

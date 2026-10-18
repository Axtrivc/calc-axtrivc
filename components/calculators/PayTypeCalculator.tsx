'use client';

import { useEffect, useMemo } from 'react';
import { AlertTriangle, Briefcase, FileText, Info, RotateCcw, Scale } from 'lucide-react';
import NumberInput, { AnimatedNumber, CopyButton, SliderControl } from '@/components/NumberInput';
import ScenarioButtons from '@/components/ScenarioButtons';
import ComparisonChart from '@/components/ComparisonChart';
import {
  PAYTYPE_DEFAULTS,
  billableHours,
  breakevenContractRate,
  breakevenMarkup,
  comparePayType,
  equivalentW2Salary,
  markupSweep,
  w2Hourly,
  type PayTypeInputs,
} from '@/lib/paytype';
import { usd, usdCompact, pct, numFmt, clamp } from '@/lib/format';
import { useWorkbenchInputs, recordRecent } from '@/lib/workbench';

const SLUG = '1099-vs-w2-calculator';
const HREF = '/1099-vs-w2-calculator/';
const DEFAULTS: PayTypeInputs = PAYTYPE_DEFAULTS;

const SALARY_PRESETS = [60000, 85000, 110000, 150000];
const RATE_PRESETS = [50, 65, 85, 100, 150];

/**
 * Whole-scenario presets: each bundles a W-2 package with a plausible contract
 * quote, so the verdict card tells a complete story per role archetype.
 */
const SCENARIO_PRESETS: ({ key: string; label: string; hint: string } & PayTypeInputs)[] = [
  {
    key: 'corporate',
    label: 'Typical corporate',
    hint: '$100k · full benefits · 15 PTO days',
    salary: 100000,
    contractRate: 65,
    ptoDays: 15,
    healthPremium: 7500,
    retirementMatch: 3000,
    otherBenefits: 500,
    seExpenses: 2000,
  },
  {
    key: 'bigtech',
    label: 'Big-tech package',
    hint: '$150k · rich benefits · 20 PTO days',
    salary: 150000,
    contractRate: 100,
    ptoDays: 20,
    healthPremium: 9000,
    retirementMatch: 6000,
    otherBenefits: 1000,
    seExpenses: 3000,
  },
  {
    key: 'startup',
    label: 'Lean startup',
    hint: '$110k · stipend only · 10 PTO days',
    salary: 110000,
    contractRate: 75,
    ptoDays: 10,
    healthPremium: 3600,
    retirementMatch: 0,
    otherBenefits: 0,
    seExpenses: 2500,
  },
  {
    key: 'smb',
    label: 'SMB / trades',
    hint: '$65k · basic benefits · 10 PTO days',
    salary: 65000,
    contractRate: 50,
    ptoDays: 10,
    healthPremium: 6000,
    retirementMatch: 1500,
    otherBenefits: 0,
    seExpenses: 1500,
  },
];

export default function PayTypeCalculator() {
  const { values, set, reset } = useWorkbenchInputs(SLUG, DEFAULTS);
  const { salary, contractRate, ptoDays, healthPremium, retirementMatch, otherBenefits, seExpenses } = values;

  useEffect(() => {
    recordRecent(SLUG);
  }, []);

  const result = useMemo(() => comparePayType(values), [values]);
  const breakeven = useMemo(() => breakevenContractRate(values), [values]);
  const markup = useMemo(() => breakevenMarkup(salary, breakeven), [salary, breakeven]);
  const equivSalary = useMemo(() => equivalentW2Salary(values), [values]);
  const sweep = useMemo(() => markupSweep(values), [values]);

  const hours = billableHours(ptoDays);
  const ptoHours = ptoDays * 8;
  const hourly = w2Hourly(salary);
  const benefitsTotal = healthPremium + retirementMatch + otherBenefits;

  function isPresetActive(p: (typeof SCENARIO_PRESETS)[number]) {
    return (
      salary === p.salary &&
      contractRate === p.contractRate &&
      ptoDays === p.ptoDays &&
      healthPremium === p.healthPremium &&
      retirementMatch === p.retirementMatch &&
      otherBenefits === p.otherBenefits &&
      seExpenses === p.seExpenses
    );
  }

  function applyPreset(p: (typeof SCENARIO_PRESETS)[number]) {
    set('salary', p.salary);
    set('contractRate', p.contractRate);
    set('ptoDays', p.ptoDays);
    set('healthPremium', p.healthPremium);
    set('retirementMatch', p.retirementMatch);
    set('otherBenefits', p.otherBenefits);
    set('seExpenses', p.seExpenses);
  }

  const contractWins = result.winner === '1099';
  const tie = result.winner === 'tie';
  const copySummary =
    breakeven === null
      ? `1099 vs W-2 at ${usd(salary, 0)} salary + ${usd(benefitsTotal, 0)}/yr benefits: no breakeven found inside the modeled range.`
      : `1099 vs W-2: ${usd(salary, 0)} salary + ${usd(benefitsTotal, 0)}/yr benefits needs a contract rate of at least ${usd(breakeven)}/hr (${
          markup === null ? '—' : `+${pct(markup, 1)}`
        } over the W-2 hourly). At ${usd(contractRate)}/hr the contract is ${usd(Math.abs(result.deltaAnnual))}/yr ${
          tie ? 'level with' : contractWins ? 'ahead of' : 'behind'
        } the W-2 job${equivSalary === null || equivSalary === 0 ? '' : ` (worth a ${usdCompact(equivSalary)} W-2 salary)`}.`;

  return (
    <div className="grid gap-6 lg:grid-cols-5">
      {/* ================= Inputs ================= */}
      <div className="card p-6 sm:p-8 lg:col-span-3">
        {/* Scenario presets */}
        <div>
          <p className="label">Scenario presets</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {SCENARIO_PRESETS.map((p) => {
              const active = isPresetActive(p);
              return (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => applyPreset(p)}
                  aria-pressed={active}
                  title={p.hint}
                  className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition focus-calm ${
                    active
                      ? 'border-indigo-500 bg-indigo-50 text-indigo-700 dark:border-indigo-400 dark:bg-indigo-500/15 dark:text-indigo-300'
                      : 'border-slate-200 bg-white text-slate-500 hover:border-indigo-300 hover:text-indigo-600 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-400 dark:hover:border-indigo-400/50 dark:hover:text-indigo-300'
                  }`}
                >
                  {p.label}
                </button>
              );
            })}
          </div>
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
            Each preset bundles a full W-2 package with a plausible quote — adjust anything below.
          </p>
        </div>

        <div className="mt-6 space-y-6">
          {/* --- The W-2 offer --- */}
          <p className="flex items-center gap-2 font-mono text-[11px] font-bold uppercase tracking-[0.18em] text-sky-600 dark:text-sky-300">
            <Briefcase className="h-3.5 w-3.5" aria-hidden="true" />
            The W-2 offer
          </p>

          <div>
            <NumberInput
              id="paytype-salary"
              label="Annual salary"
              value={salary}
              onChange={(n) => set('salary', clamp(n, 0, 400000))}
              min={0}
              max={400000}
              prefix="$"
              placeholder="100,000"
              helpText={`The salaried job on the table. On the 2,080-hour paid basis this is ${usd(hourly)}/hr.`}
            />
            <div className="mt-3">
              <SliderControl
                id="paytype-salary-slider"
                label="Salary"
                value={clamp(salary, 0, 400000)}
                onChange={(n) => set('salary', n)}
                min={0}
                max={400000}
                step={2500}
                prefix="$"
                presets={SALARY_PRESETS}
                formatValue={(n) => usdCompact(n)}
              />
            </div>
          </div>

          <div>
            <NumberInput
              id="paytype-pto"
              label="Paid days off (PTO)"
              value={ptoDays}
              onChange={(n) => set('ptoDays', clamp(n, 0, 40))}
              min={0}
              max={40}
              suffix=" days"
              placeholder="15"
              helpText={`Already paid inside the salary (input and slider both cap at 40 days). On the contract those ${numFmt(ptoHours)} hours go unbilled — ${numFmt(hours)} billable hours remain.`}
            />
            <div className="mt-3">
              <SliderControl
                id="paytype-pto-slider"
                label="PTO days"
                value={clamp(ptoDays, 0, 40)}
                onChange={(n) => set('ptoDays', n)}
                min={0}
                max={40}
                step={1}
                suffix=" days"
                presets={[0, 10, 15, 20, 25]}
                formatValue={(n) => `${n} days`}
              />
            </div>
          </div>

          <NumberInput
            id="paytype-health"
            label="Health insurance the employer covers"
            value={healthPremium}
            onChange={(n) => set('healthPremium', clamp(n, 0, 100000))}
            min={0}
            max={100000}
            prefix="$"
            placeholder="7,500"
            helpText="Annual premium value the contract would have to self-buy. A typical employer single plan runs $7–9k/yr."
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <NumberInput
              id="paytype-match"
              label="401(k) match value"
              value={retirementMatch}
              onChange={(n) => set('retirementMatch', clamp(n, 0, 100000))}
              min={0}
              max={100000}
              prefix="$"
              placeholder="3,000"
              helpText="Employer match per year, counted at face value."
            />
            <NumberInput
              id="paytype-other"
              label="Other benefits value"
              value={otherBenefits}
              onChange={(n) => set('otherBenefits', clamp(n, 0, 100000))}
              min={0}
              max={100000}
              prefix="$"
              placeholder="500"
              helpText="HSA seed, life & disability, wellness stipends."
            />
          </div>

          {/* --- The 1099 offer --- */}
          <p className="flex items-center gap-2 pt-2 font-mono text-[11px] font-bold uppercase tracking-[0.18em] text-indigo-600 dark:text-indigo-300">
            <FileText className="h-3.5 w-3.5" aria-hidden="true" />
            The 1099 offer
          </p>

          <div>
            <NumberInput
              id="paytype-rate"
              label="Contract hourly rate"
              value={contractRate}
              onChange={(n) => set('contractRate', clamp(n, 0, 1000))}
              min={0}
              max={1000}
              prefix="$"
              suffix="/hr"
              placeholder="65"
              helpText={`The quote you're evaluating. At ${numFmt(hours)} billable hours that's ${usd(result.c1099.revenue, 0)} of annual revenue.`}
            />
            <div className="mt-3">
              <SliderControl
                id="paytype-rate-slider"
                label="Rate"
                value={contractRate}
                onChange={(n) => set('contractRate', n)}
                min={0}
                max={1000}
                logarithmic
                prefix="$"
                suffix="/hr"
                presets={RATE_PRESETS}
                formatValue={(n) => `${usd(n)}/hr`}
              />
            </div>
          </div>

          <NumberInput
            id="paytype-expenses"
            label="Contractor business expenses"
            value={seExpenses}
            onChange={(n) => set('seExpenses', clamp(n, 0, 100000))}
            min={0}
            max={100000}
            prefix="$"
            placeholder="2,000"
            helpText="Software, liability insurance, gear, home-office — deductible Schedule C costs."
          />
        </div>

        <div className="mt-6 flex items-start gap-2 rounded-lg bg-slate-50 p-3 text-xs leading-relaxed text-slate-600 dark:bg-white/[0.03] dark:text-slate-300">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-slate-400 dark:text-slate-500" aria-hidden="true" />
          <p>
            Federal-only, single filer, tax year 2025 — no state income tax or state insurance. Benefits are
            valued at face; the contract side buys the same health plan and keeps its above-the-line deduction.
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
            shortTitle="1099 vs W-2"
            href={HREF}
            params={{ salary, contractRate, ptoDays, healthPremium, retirementMatch, otherBenefits, seExpenses }}
          />
        </div>
      </div>

      {/* ================= Results ================= */}
      <div className="space-y-4 lg:col-span-2">
        {/* Breakeven rate */}
        <div className="card p-6 sm:p-8">
          <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            <Scale className="h-4 w-4" aria-hidden="true" />
            Charge at least
          </h2>
          {breakeven === null ? (
            <p className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
              No rate inside the modeled range matches this W-2 package — double-check the salary and benefits
              inputs.
            </p>
          ) : (
            <>
              <div className="mt-3">
                <AnimatedNumber
                  value={breakeven}
                  format={(n) => `${usd(n)}/hr`}
                  className="readout block text-4xl font-extrabold tracking-tight text-indigo-600 dark:text-indigo-300"
                />
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  {markup === null ? (
                    <>to match the W-2 package.</>
                  ) : (
                    <>
                      <strong className="text-slate-700 dark:text-slate-200">+{pct(markup, 1)}</strong> over the{' '}
                      {usd(hourly)}/hr salary equivalent.
                    </>
                  )}
                </p>
              </div>
              <p className="mt-3 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                ≈ {usd(breakeven * hours, 0)}/yr of contract revenue across {numFmt(hours)} billable hours — the
                floor where the two pay types tie in total value kept.
              </p>
            </>
          )}
        </div>

        {/* Verdict at the quote */}
        <div className="card p-6 sm:p-8">
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
            At your quoted {usd(contractRate)}/hr
          </h3>
          <div className="mt-3">
            <div className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
              {tie ? 'Dead heat — the two pay types tie' : contractWins ? 'Contract comes out ahead' : 'W-2 job comes out ahead'}
            </div>
            <AnimatedNumber
              value={result.deltaAnnual}
              format={(n) => (tie ? usd(Math.abs(n)) : `${n >= 0 ? '+' : '−'}${usd(Math.abs(n))}`)}
              className={`readout mt-1 block text-3xl font-extrabold tracking-tight ${
                tie
                  ? 'text-slate-500 dark:text-slate-400'
                  : contractWins
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-rose-600 dark:text-rose-400'
              }`}
            />
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              {tie ? (
                <>per year — effectively identical offers at these inputs.</>
              ) : (
                <>
                  per year in total value kept
                  {equivSalary === null
                    ? '.'
                    : equivSalary === 0
                      ? ' — the quote is worth less than the benefits package alone.'
                      : <> — worth a {usdCompact(equivSalary)} W-2 salary with the same benefits.</>}
                </>
              )}
            </p>
          </div>

          {/* Side-by-side ledger */}
          <div className="mt-5 flex items-center justify-between border-b border-slate-200 pb-2 dark:border-white/[0.07]">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Line
            </span>
            <span className="readout text-[10px] font-semibold uppercase tracking-wider">
              <span className="text-sky-600 dark:text-sky-300">W-2</span>
              <span className="mx-2 text-slate-300 dark:text-slate-600">/</span>
              <span className="text-indigo-600 dark:text-indigo-300">1099</span>
            </span>
          </div>
          <dl className="divide-y divide-slate-100 text-sm dark:divide-white/[0.06]">
            <LedgerRow
              label="Gross pay"
              left={usd(result.w2.salary, 0)}
              right={usd(result.c1099.revenue, 0)}
            />
            <LedgerRow
              label="Employee FICA / SE tax"
              left={usd(result.w2.fica)}
              right={usd(result.c1099.seTax)}
            />
            <LedgerRow
              label="Federal income tax"
              left={usd(result.w2.incomeTax)}
              right={usd(result.c1099.incomeTax)}
            />
            <LedgerRow label="Benefits at face value" left={usd(result.w2.benefits, 0)} right="—" />
            <div className="flex items-center justify-between py-2.5">
              <dt className="font-medium text-slate-700 dark:text-slate-300">Value kept</dt>
              <dd className="flex items-baseline gap-2">
                <span className="readout text-sm font-semibold text-slate-500 dark:text-slate-400">
                  {usd(result.w2.totalValue, 0)}
                </span>
                <span
                  className={`readout text-lg font-bold ${
                    contractWins ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-500 dark:text-slate-400'
                  }`}
                >
                  {usd(result.c1099.valueKept, 0)}
                </span>
              </dd>
            </div>
            <LedgerRow
              label="Value per hour (2,080 basis)"
              left={usd(result.w2.valuePerHour)}
              right={usd(result.c1099.valuePerHour)}
            />
          </dl>
        </div>

        {/* PTO + misclassification notes */}
        <div className="card p-6 sm:p-8">
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">What the quote must re-earn</h3>
          <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
            {numFmt(ptoDays)} PTO days = <strong className="text-slate-900 dark:text-white">{numFmt(ptoHours)} unpaid hours</strong>{' '}
            ≈ {usd(ptoHours * contractRate, 0)} of billings at your quote, plus {usd(benefitsTotal, 0)}/yr of
            benefits the contract replaces.
          </p>
          <div className="mt-3 flex items-start gap-2 rounded-lg bg-slate-50 p-2.5 text-xs leading-relaxed text-slate-500 dark:bg-white/[0.03] dark:text-slate-400">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500 dark:text-amber-400" aria-hidden="true" />
            Classification is a legal test, not a checkbox — the same working relationship may have to be W-2 no
            matter what either side prefers. See{' '}
            <a href="#misclassification" className="font-medium text-indigo-600 underline dark:text-indigo-400">
              where the boundary sits
            </a>
            .
          </div>
        </div>
      </div>

      {/* ================= Markup sensitivity ================= */}
      <div className="lg:col-span-5">
        <div className="card p-5 sm:p-6">
          <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Required markup vs the salary on the table
              </h3>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                Breakeven contract premium over the W-2 hourly, holding your current benefits, PTO and expenses —
                as the salary moves.
              </p>
            </div>
            <span className="readout rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600 dark:bg-white/[0.05] dark:text-slate-300">
              now: {usdCompact(salary)} salary →{' '}
              <span className="text-indigo-600 dark:text-indigo-300">
                {markup === null ? '—' : `+${pct(markup, 1)}`}
              </span>
            </span>
          </div>
          {sweep.length > 1 && (
          <ComparisonChart
            yMinMode="auto"
            series={[
              {
                label: 'Breakeven markup over the W-2 hourly rate',
                color: '#6366f1',
                points: sweep.map((s) => ({ x: s.salary, y: s.markupPct })),
                fillTo: 0,
              },
            ]}
            xLabel="W-2 salary"
            yLabel="Required markup (%)"
            xFormat={(n) => usdCompact(n)}
            yFormat={(n) => pct(n, 0)}
            height={280}
            marker={salary >= 50000 && salary <= 250000 ? { x: salary, label: 'your salary' } : undefined}
            caption="Every point is the full federal model recomputed — bisection included, not a linear approximation. The curve falls as salary rises because a fixed benefits package is a shrinking share of a bigger package; at zero benefits it converges on the pure tax gap (roughly the SE-tax drag minus the QBI claw-back)."
          />
          )}
          {!(salary >= 50000 && salary <= 250000) && (
            <p className="mt-3 flex items-start gap-2 text-xs leading-relaxed text-amber-700 dark:text-amber-400">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              Your {usdCompact(salary)} salary sits outside the plotted $50k–$250k window, so it is not marked on the
              curve. The shape is unchanged — required markup falls as salary rises — and at {usdCompact(salary)} your
              breakeven premium is {markup === null ? '—' : `+${pct(markup, 1)}`}.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function LedgerRow({ label, left, right }: { label: string; left: string; right: string }) {
  return (
    <div className="flex items-center justify-between py-2.5">
      <dt className="text-slate-600 dark:text-slate-300">{label}</dt>
      <dd className="readout text-sm font-semibold text-slate-900 dark:text-slate-100">
        <span className="text-slate-500 dark:text-slate-400">{left}</span>
        <span className="mx-2 text-slate-300 dark:text-slate-600">/</span>
        {right}
      </dd>
    </div>
  );
}

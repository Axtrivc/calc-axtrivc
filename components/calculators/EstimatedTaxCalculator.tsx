'use client';

import { useEffect, useMemo, type ReactNode } from 'react';
import {
  AlertTriangle,
  CalendarDays,
  Info,
  RotateCcw,
  ShieldCheck,
} from 'lucide-react';
import NumberInput, { AnimatedNumber, CopyButton, SliderControl } from '@/components/NumberInput';
import ScenarioButtons from '@/components/ScenarioButtons';
import ComparisonChart from '@/components/ComparisonChart';
import {
  computeEstimatedTax,
  safeHarborSweep,
  type FilingStatus,
} from '@/lib/estimated';
import { usd, usdCompact, pct, clamp } from '@/lib/format';
import { useWorkbenchInputs, recordRecent } from '@/lib/workbench';

const SLUG = 'quarterly-estimated-tax-calculator';
const HREF = '/quarterly-estimated-tax-calculator/';

/**
 * All inputs persist as numbers (the workbench hook stores Record<string, number>):
 * statusFlag 0 = single, 1 = MFJ; priorKnownFlag 1 = use the prior-year number,
 * 0 = "unknown" → only the 90% current-year harbor is available.
 */
const DEFAULTS = {
  netSE: 100000,
  w2Withholding: 0,
  priorTax: 19500,
  statusFlag: 0,
  highAgiFlag: 0,
  priorKnownFlag: 1,
};

const NET_SE_PRESETS = [60000, 120000, 200000, 400000];
const WITHHOLDING_PRESETS = [0, 6000, 12000];

type Persona = {
  name: string;
  netSE: number;
  status: FilingStatus;
  w2Withholding: number;
  priorTax: number;
  priorAgiOver150k: boolean;
  known: boolean;
};

/** Scenario presets — each sets the whole input stack, mirroring the build-time table below. */
const PERSONAS: Persona[] = [
  {
    name: 'Side hustle + W-2 job',
    netSE: 60000,
    status: 'single',
    w2Withholding: 9000,
    priorTax: 14200,
    priorAgiOver150k: false,
    known: true,
  },
  {
    name: 'Full-time freelancer',
    netSE: 120000,
    status: 'single',
    w2Withholding: 0,
    priorTax: 22000,
    priorAgiOver150k: false,
    known: true,
  },
  {
    name: 'High earner (AGI > $150k)',
    netSE: 300000,
    status: 'single',
    w2Withholding: 0,
    priorTax: 52000,
    priorAgiOver150k: true,
    known: true,
  },
  {
    name: 'First year in business',
    netSE: 95000,
    status: 'single',
    w2Withholding: 0,
    priorTax: 0,
    priorAgiOver150k: false,
    known: true,
  },
];

const HARBOR_LABELS: Record<string, string> = {
  current90: '90% of current-year tax',
  prior100: '100% of last year’s tax',
  prior110: '110% of last year’s tax',
};

export default function EstimatedTaxCalculator() {
  const { values, set, reset } = useWorkbenchInputs(SLUG, DEFAULTS);
  const { netSE, w2Withholding, priorTax, statusFlag, highAgiFlag, priorKnownFlag } = values;

  useEffect(() => {
    recordRecent(SLUG);
  }, []);

  const filingStatus: FilingStatus = statusFlag === 1 ? 'mfj' : 'single';
  const priorKnown = priorKnownFlag === 1;

  const result = useMemo(
    () =>
      computeEstimatedTax({
        netSE,
        filingStatus,
        w2Withholding,
        priorTax: priorKnown ? priorTax : null,
        priorAgiOver150k: highAgiFlag === 1,
      }),
    [netSE, filingStatus, w2Withholding, priorTax, priorKnown, highAgiFlag],
  );

  // Sensitivity sweep: how each safe-harbor line moves with income at these
  // filing-status / withholding / prior-tax settings.
  const sweep = useMemo(
    () =>
      safeHarborSweep(
        {
          filingStatus,
          w2Withholding,
          priorTax: priorKnown ? priorTax : null,
          priorAgiOver150k: highAgiFlag === 1,
        },
        20000,
        400000,
        25,
      ),
    [filingStatus, w2Withholding, priorTax, priorKnown, highAgiFlag],
  );

  function applyPersona(p: Persona) {
    set('netSE', p.netSE);
    set('w2Withholding', p.w2Withholding);
    set('priorTax', p.priorTax);
    set('statusFlag', p.status === 'mfj' ? 1 : 0);
    set('highAgiFlag', p.priorAgiOver150k ? 1 : 0);
    set('priorKnownFlag', p.known ? 1 : 0);
  }

  /** Presentational only: flags the persona whose whole input stack currently
      matches, so the preset row reads the same as Stripe's volume presets and
      PayType's scenario presets (pressed state + aria-pressed). */
  function isPersonaActive(p: Persona) {
    return (
      netSE === p.netSE &&
      w2Withholding === p.w2Withholding &&
      priorTax === p.priorTax &&
      statusFlag === (p.status === 'mfj' ? 1 : 0) &&
      highAgiFlag === (p.priorAgiOver150k ? 1 : 0) &&
      priorKnownFlag === (p.known ? 1 : 0)
    );
  }

  const covered = result.requiredAnnualPayment > 0 && result.netToPayByEstimates === 0;
  const copySummary = `1040-ES (2025): at ${usd(netSE, 0)} of self-employment income (${
    filingStatus === 'mfj' ? 'MFJ' : 'single'
  }), current-year federal tax ≈ ${usd(result.currentTotalTax, 0)}. Required annual payment ${usd(
    result.requiredAnnualPayment,
    0,
  )} under the ${HARBOR_LABELS[result.applicable]}; W-2 withholding ${usd(
    w2Withholding,
    0,
  )} → pay ${usd(result.perQuarter, 0)}/quarter (Apr 15 / Jun 16 / Sep 15 / Jan 15); ≈ ${usd(
    result.expectedAtFiling,
    0,
  )} expected with the Apr 2026 return. Skipping all installments ≈ ${usd(
    result.penaltyEstimate,
  )} penalty (estimate).`;

  return (
    <div className="grid gap-6 lg:grid-cols-5">
      {/* ================= Inputs ================= */}
      <div className="card p-6 sm:p-8 lg:col-span-3">
        <div className="space-y-6">
          {/* Persona presets */}
          <div>
            <p className="label" id="est-personas-label">
              Scenario presets
            </p>
            <div className="flex flex-wrap gap-1.5" role="group" aria-labelledby="est-personas-label">
              {PERSONAS.map((p) => {
                const active = isPersonaActive(p);
                return (
                  <button
                    key={p.name}
                    type="button"
                    onClick={() => applyPersona(p)}
                    aria-pressed={active}
                    className={`rounded-full border px-3 py-1.5 text-xs font-medium transition focus-calm ${
                      active
                        ? 'border-indigo-500 bg-indigo-50 text-indigo-700 dark:border-indigo-400 dark:bg-indigo-500/15 dark:text-indigo-300'
                        : 'border-slate-200 bg-white text-slate-500 hover:border-indigo-300 hover:text-indigo-600 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-400 dark:hover:border-indigo-400/50 dark:hover:text-indigo-300'
                    }`}
                  >
                    {p.name}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <NumberInput
              id="est-net-income"
              label="Net self-employment income (Schedule C profit)"
              value={netSE}
              onChange={(n) => set('netSE', n)}
              min={0}
              max={10000000}
              prefix="$"
              placeholder="100,000"
              helpText="Revenue minus ordinary business expenses, before self-employment tax — the number Schedule C bottoms out at."
            />
            <div className="mt-3">
              <SliderControl
                id="est-net-income-slider"
                label="Annual SE income"
                value={netSE}
                onChange={(n) => set('netSE', n)}
                min={0}
                max={1000000}
                step={5000}
                prefix="$"
                logarithmic
                presets={NET_SE_PRESETS}
              />
            </div>
          </div>

          {/* Filing status — real radios, styled */}
          <fieldset>
            <legend className="label">Filing status (2025 federal)</legend>
            <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Filing status">
              {(
                [
                  { key: 'single', label: 'Single' },
                  { key: 'mfj', label: 'Married filing jointly' },
                ] as const
              ).map((opt) => {
                const active = filingStatus === opt.key;
                return (
                  <label key={opt.key} className="cursor-pointer">
                    <input
                      type="radio"
                      name="est-filing-status"
                      value={opt.key}
                      checked={active}
                      onChange={() => set('statusFlag', opt.key === 'mfj' ? 1 : 0)}
                      className="peer sr-only"
                    />
                    <span
                      className={`block rounded-lg border px-3.5 py-2.5 text-sm font-semibold transition-all duration-150 peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-indigo-500 ${
                        active
                          ? 'border-indigo-500 bg-indigo-50 text-indigo-700 dark:border-indigo-400 dark:bg-indigo-500/15 dark:text-indigo-300'
                          : 'border-slate-200 bg-white text-slate-500 hover:border-indigo-300 hover:text-indigo-600 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-400 dark:hover:border-indigo-400/50 dark:hover:text-indigo-300'
                      }`}
                    >
                      {opt.label}
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>

          <div>
            <NumberInput
              id="est-withholding"
              label="W-2 withholding for the year (yours or a spouse's)"
              value={w2Withholding}
              onChange={(n) => set('w2Withholding', n)}
              min={0}
              max={500000}
              prefix="$"
              placeholder="0"
              helpText="Federal income tax expected to be withheld from paychecks. It counts as paid evenly through the year and offsets your installments dollar-for-dollar."
            />
            <div className="mt-3">
              <SliderControl
                id="est-withholding-slider"
                label="Withholding"
                value={w2Withholding}
                onChange={(n) => set('w2Withholding', n)}
                min={0}
                max={60000}
                step={250}
                prefix="$"
                presets={WITHHOLDING_PRESETS}
              />
            </div>
          </div>

          <div>
            <fieldset
              disabled={!priorKnown}
              className={`m-0 border-0 p-0 transition-opacity ${priorKnown ? '' : 'opacity-50'}`}
            >
              <NumberInput
                id="est-prior-tax"
                label="Last year's total tax (optional)"
                value={priorTax}
                onChange={(n) => set('priorTax', n)}
                min={0}
                max={5000000}
                prefix="$"
                placeholder="19,500"
                helpText={
                  priorKnown
                    ? 'Line 22–24 style total tax on your 2024 Form 1040. Enter 0 if last year’s tax was actually zero — that is its own exemption.'
                    : 'Disabled — the prior-year safe harbor is switched off and this number is ignored.'
                }
              />
            </fieldset>
            <div className="mt-3 space-y-2.5">
              <label className="flex cursor-pointer items-start gap-2.5 rounded-lg bg-slate-50 p-3 text-sm text-slate-600 transition hover:bg-slate-100 dark:bg-white/[0.03] dark:text-slate-300 dark:hover:bg-white/[0.05]">
                <input
                  type="checkbox"
                  checked={priorKnown}
                  onChange={(e) => set('priorKnownFlag', e.target.checked ? 1 : 0)}
                  className="mt-0.5 h-4 w-4 shrink-0 accent-indigo-600 dark:accent-indigo-400"
                />
                <span>
                  I know last year&apos;s total tax — use the prior-year safe harbor
                  <span className="mt-0.5 block text-xs text-slate-500 dark:text-slate-400">
                    Uncheck to price the 90%-of-current-year rule only.
                  </span>
                </span>
              </label>
              <label
                className={`flex items-start gap-2.5 rounded-lg bg-slate-50 p-3 text-sm text-slate-600 transition dark:bg-white/[0.03] dark:text-slate-300 ${
                  priorKnown ? 'cursor-pointer hover:bg-slate-100 dark:hover:bg-white/[0.05]' : 'opacity-50'
                }`}
              >
                <input
                  type="checkbox"
                  checked={highAgiFlag === 1}
                  disabled={!priorKnown}
                  onChange={(e) => set('highAgiFlag', e.target.checked ? 1 : 0)}
                  className="mt-0.5 h-4 w-4 shrink-0 accent-indigo-600 dark:accent-indigo-400"
                />
                <span>
                  Prior-year AGI was over $150,000
                  <span className="mt-0.5 block text-xs text-slate-500 dark:text-slate-400">
                    Switches the prior-year harbor from 100% to 110% of last year&apos;s tax.
                  </span>
                </span>
              </label>
            </div>
          </div>
        </div>

        <div className="mt-6 flex items-start gap-2 rounded-lg bg-slate-50 p-3 text-xs leading-relaxed text-slate-600 dark:bg-white/[0.03] dark:text-slate-300">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-slate-400 dark:text-slate-500" aria-hidden="true" />
          <p>
            Federal-only, tax year 2025. Withholding is modeled as a payment credit — the wages
            behind it are not added to income. Standard deduction $15,750 / $31,500 per P.L.
            119-21; the guide below covers every simplification.
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
            shortTitle="Quarterly Taxes"
            href={HREF}
            params={{
              netSE,
              w2Withholding,
              priorTax,
              statusFlag,
              highAgiFlag,
              priorKnownFlag,
            }}
          />
        </div>
      </div>

      {/* ================= Results ================= */}
      <div className="space-y-4 lg:col-span-2">
        {/* Headline installment */}
        <div className="card p-6 sm:p-8">
          <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            <CalendarDays className="h-4 w-4" aria-hidden="true" />
            Pay this each quarter
          </h2>
          <div className="mt-3">
            <div className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
              {HARBOR_LABELS[result.applicable]} applies
            </div>
            <AnimatedNumber
              value={result.perQuarter}
              format={(n) => usd(n, 0)}
              className={`readout mt-1 block text-4xl font-extrabold tracking-tight ${
                result.netToPayByEstimates > 0
                  ? 'text-slate-900 dark:text-white'
                  : 'text-emerald-600 dark:text-emerald-400'
              }`}
            />
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              per installment · {usd(result.netToPayByEstimates, 0)} over the year after{' '}
              {usd(w2Withholding, 0)} of withholding
            </p>
          </div>

          {/* Current-year ledger */}
          <dl className="mt-5 divide-y divide-slate-100 text-sm dark:divide-white/[0.06]">
            <Row label="Self-employment tax" value={usd(result.seTax)} />
            <Row label="Federal income tax" value={usd(result.incomeTax)} />
            <Row
              label="QBI deduction claimed"
              value={`−${usd(result.qbiDeduction)}`}
              note={
                result.qbiPhaseOutPct >= 1
                  ? 'fully phased out — §199A(b)(2) no-employee limit above $247.3k/$494.6k pre-QBI taxable'
                  : result.qbiPhaseOutPct > 0
                    ? `${pct(result.qbiPhaseOutPct * 100, 0)} phased out by the §199A(b)(2) no-employee limit`
                    : undefined
              }
            />
            <div className="flex items-center justify-between py-2.5">
              <dt className="font-medium text-slate-700 dark:text-slate-300">
                Current-year total tax
              </dt>
              <dd className="readout text-lg font-bold text-slate-900 dark:text-white">
                {usd(result.currentTotalTax)}
              </dd>
            </div>
            <div>
              <div className="flex items-center justify-between py-2.5">
                <dt className="font-medium text-indigo-700 dark:text-indigo-300">
                  Expected with your Apr 2026 return
                </dt>
                <dd className="readout text-lg font-bold text-indigo-700 dark:text-indigo-300">
                  {usd(result.expectedAtFiling)}
                </dd>
              </div>
              <p className="pb-2 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                The balloon left after withholding and the four installments above — paying the
                safe-harbor amount never makes this late, but plan the cash for it.
              </p>
            </div>
          </dl>
          <p className="mt-2 text-right font-mono text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400">
            effective rate {pct(result.effectiveRate, 1)} of SE income
          </p>
        </div>

        {/* Exemption / coverage status */}
        {w2Withholding > 0 ? (
          <StatusCard tone="amber" icon="alert">
            You entered W-2 withholding, so wages exist that this model does <strong>not</strong>{' '}
            tax — the 90% line above covers SE income only. Your true current-year tax (and real 90%
            line) is higher than shown, so the <strong>prior-year harbor is the safer target</strong>{' '}
            for two-income households; treat a &ldquo;90% binds&rdquo; verdict here with suspicion.
          </StatusCard>
        ) : null}
        {result.priorYearZeroExempt ? (
          <StatusCard tone="emerald" icon="check">
            Last year&apos;s tax was $0 — <strong>no penalty applies no matter when you pay</strong>{' '}
            (assuming last year was a 12-month year and you were a US citizen/resident). The 90%
            line ({usd(result.current90, 0)}/yr) is what you will owe at filing, not per quarter.
          </StatusCard>
        ) : result.deMinimisExempt ? (
          <StatusCard tone="emerald" icon="check">
            Current-year tax minus withholding is under $1,000 — the de-minimis exception applies.
            <strong> No estimated payments required.</strong>
          </StatusCard>
        ) : covered ? (
          <StatusCard tone="emerald" icon="check">
            Your W-2 withholding already covers the required annual payment of{' '}
            {usd(result.requiredAnnualPayment, 0)} — <strong>no estimated installments needed</strong>.
          </StatusCard>
        ) : !priorKnown ? (
          <StatusCard tone="amber" icon="alert">
            Prior-year safe harbor is off, so the 90% current-year line is the only harbor priced —
            usually the most conservative choice. Check the box above to compare the prior-year
            lines.
          </StatusCard>
        ) : null}
      </div>

      {/* ================= Schedule + safe-harbor comparison ================= */}
      <div className="lg:col-span-5">
        <div className="card p-5 sm:p-6">
          <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                2025 installment schedule
              </h3>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                Equal installments under the regular method — Q2 moved to Jun 16 because Jun 15
                fell on a Sunday.
              </p>
            </div>
            <span className="readout rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600 dark:bg-white/[0.05] dark:text-slate-300">
              required: {usd(result.requiredAnnualPayment, 0)}/yr
            </span>
          </div>

          <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {result.quarterly.map((q) => (
              <li key={q.label} className="panel p-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="chip bg-indigo-50 font-mono text-[10px] font-bold uppercase tracking-wider text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300">
                    {q.label}
                  </span>
                  <span className="font-mono text-[11px] text-slate-500 dark:text-slate-400">
                    {q.due}
                  </span>
                </div>
                <div className="readout mt-2.5 text-2xl font-bold text-slate-900 dark:text-white">
                  {usd(q.installment, 0)}
                </div>
                <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                  cumulative {usd(q.cumulative, 0)}
                </div>
              </li>
            ))}
          </ol>

          {/* Paid vs owed gap */}
          <div className="mt-5">
            <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2 text-sm">
              <span className="font-semibold text-slate-700 dark:text-slate-300">
                Withholding vs required payment
              </span>
              <span className="readout text-xs text-slate-500 dark:text-slate-400">
                {usd(w2Withholding, 0)} covered of {usd(result.requiredAnnualPayment, 0)} ·{' '}
                <span
                  className={
                    result.netToPayByEstimates > 0
                      ? 'text-indigo-600 dark:text-indigo-300'
                      : 'text-emerald-600 dark:text-emerald-400'
                  }
                >
                  gap {usd(result.netToPayByEstimates, 0)}
                </span>
              </span>
            </div>
            <div
              className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-white/[0.06]"
              role="progressbar"
              aria-label="Share of the required annual payment covered by W-2 withholding"
              aria-valuenow={Math.round(clamp(result.withholdingCoveragePct, 0, 100))}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <div
                className="h-2.5 rounded-full bg-emerald-500 transition-all duration-300 dark:bg-emerald-400"
                style={{ width: `${clamp(result.withholdingCoveragePct, 0, 100)}%` }}
              />
            </div>
          </div>
        </div>

        {/* Safe-harbor line comparison */}
        <div className="card mt-6 p-5 sm:p-6">
          <div className="mb-4">
            <h3 className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-slate-100">
              <ShieldCheck className="h-4 w-4 text-emerald-500 dark:text-emerald-400" aria-hidden="true" />
              Safe-harbor lines, side by side
            </h3>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              Gross annual amounts before withholding, and what each leaves per quarter after your{' '}
              {usd(w2Withholding, 0)} of withholding. The IRS requires the <em>lesser</em> of the
              applicable prior-year line and the 90% line.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="data-table min-w-full">
              <thead>
                <tr>
                  <th scope="col">Safe harbor</th>
                  <th scope="col" className="text-right">Gross / yr</th>
                  <th scope="col" className="text-right">Net of withholding</th>
                  <th scope="col" className="text-right">Per quarter</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/[0.06]">
                <HarborRow
                  label="90% of current-year tax"
                  gross={result.current90}
                  withholding={w2Withholding}
                  active={result.applicable === 'current90'}
                />
                <HarborRow
                  label="100% of last year’s tax"
                  gross={result.prior100}
                  withholding={w2Withholding}
                  active={result.applicable === 'prior100'}
                  unavailable={priorKnown && highAgiFlag === 1}
                />
                <HarborRow
                  label="110% of last year’s tax (AGI > $150k)"
                  gross={result.prior110}
                  withholding={w2Withholding}
                  active={result.applicable === 'prior110'}
                  unavailable={priorKnown && highAgiFlag !== 1}
                />
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
            Reading it: income rising vs last year usually makes the prior-year line cheaper; income
            falling makes the 90% line cheaper. Prior-year AGI over $150,000 forces the 110% line —
            the 100% row stops being available in that case.
          </p>
        </div>

        {/* Sensitivity chart */}
        <div className="card mt-6 p-5 sm:p-6">
          <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Which harbor binds, by income
              </h3>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                Net annual amounts at your withholding and prior-year settings, recomputed at every
                income level.
              </p>
            </div>
            <span className="readout rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600 dark:bg-white/[0.05] dark:text-slate-300">
              now: {usdCompact(netSE)} → {usd(result.netToPayByEstimates, 0)}/yr
            </span>
          </div>
          <ComparisonChart
            series={[
              {
                label: '90% of current-year tax (net)',
                color: '#6366f1',
                points: sweep.map((p) => ({ x: p.income, y: p.current90Net })),
              },
              ...(result.priorTaxKnown
                ? [
                    {
                      label: 'Prior-year safe harbor (net)',
                      color: '#0ea5e9',
                      dashed: true,
                      points: sweep.map((p) => ({ x: p.income, y: p.priorNet ?? 0 })),
                    },
                  ]
                : []),
            ]}
            xLabel="Net self-employment income"
            yLabel="Annual payment / yr"
            xFormat={(n) => usdCompact(n)}
            yFormat={(n) => usdCompact(n)}
            height={280}
            marker={{ x: clamp(netSE, 20000, 400000), label: 'your income' }}
            caption="Your required payment is the LOWER of the two lines at your income. Below the crossover the 90% line binds (income fell vs last year); above it the prior-year line caps what you must prepay no matter how much you earn."
          />
          {(netSE < 20000 || netSE > 400000) && (
            <p className="mt-3 flex items-start gap-2 text-xs leading-relaxed text-amber-700 dark:text-amber-400">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              Your {usdCompact(netSE)} of income sits outside the plotted $20k–$400k window, so the marker is pinned to
              the nearest edge rather than your actual income. The crossover logic is unchanged — at {usdCompact(netSE)}{' '}
              your required payment is {usd(result.netToPayByEstimates, 0)}/yr.
            </p>
          )}
        </div>

        {/* Penalty estimate */}
        <div className="card mt-6 border-amber-200/80 p-5 sm:p-6 dark:border-amber-500/20">
          <h3 className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-slate-100">
            <AlertTriangle className="h-4 w-4 text-amber-500 dark:text-amber-400" aria-hidden="true" />
            Cost of skipping the installments — estimate
          </h3>
          <div className="mt-3 grid items-baseline gap-2 sm:grid-cols-[auto_1fr] sm:gap-4">
            <div className="readout text-3xl font-extrabold text-amber-600 dark:text-amber-400">
              {usd(result.penaltyEstimate)}
            </div>
            <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">
              If you pay nothing during the year and settle everything with your 2025 return on
              Apr 15, 2026: each unpaid installment of {usd(result.perQuarter, 0)} accrues the 7%
              federal underpayment rate for its remaining days (365 / 303 / 212 / 90), with
              withholding credited evenly.
            </p>
          </div>
          <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">
            ESTIMATE ONLY — one flat rate, assumed payment timing. The real Form 2210 also computes
            simple interest (per IRM 20.1.3 the §6654 penalty is computed like interest but is NOT
            compounded daily); it differs here mainly by re-pricing each period at the quarterly
            published rate and using your actual payment dates. Treat this as an order-of-magnitude
            figure.
          </p>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="py-2.5">
      <div className="flex items-center justify-between">
        <dt className="text-slate-600 dark:text-slate-300">{label}</dt>
        <dd className="readout text-sm font-semibold text-slate-900 dark:text-slate-100">{value}</dd>
      </div>
      {note && (
        <p className="mt-1 text-xs leading-relaxed text-amber-600 dark:text-amber-400">{note}</p>
      )}
    </div>
  );
}

function HarborRow({
  label,
  gross,
  withholding,
  active,
  unavailable,
}: {
  label: string;
  gross: number | null;
  withholding: number;
  active: boolean;
  /** Line exists numerically but is not legally available (wrong AGI regime). */
  unavailable?: boolean;
}) {
  const net = gross === null ? null : Math.max(0, gross - withholding);
  return (
    <tr
      className={`${active ? 'bg-indigo-50/60 dark:bg-indigo-500/[0.07]' : ''} ${
        unavailable ? 'opacity-50' : ''
      }`}
    >
      <th scope="row" className="text-left">
        <span className="flex flex-wrap items-center gap-2">
          <span className="font-semibold normal-case tracking-normal text-slate-900 dark:text-slate-100">
            {label}
          </span>
          {active && (
            <span className="chip bg-indigo-600 text-[10px] font-bold uppercase tracking-wider text-white">
              your harbor
            </span>
          )}
          {unavailable && (
            <span className="chip bg-slate-100 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:bg-white/[0.06] dark:text-slate-400">
              unavailable
            </span>
          )}
        </span>
      </th>
      <td className="text-right">
        <span className="readout whitespace-nowrap font-semibold text-slate-900 dark:text-slate-100">
          {gross === null ? '—' : usd(gross, 0)}
        </span>
      </td>
      <td className="text-right">
        <span className="readout whitespace-nowrap text-slate-600 dark:text-slate-300">
          {net === null ? '—' : usd(net, 0)}
        </span>
      </td>
      <td className="text-right">
        {unavailable ? (
          <span className="readout whitespace-nowrap text-slate-500 dark:text-slate-400">N/A</span>
        ) : (
          <span
            className={`readout whitespace-nowrap font-semibold ${
              active
                ? 'text-indigo-700 dark:text-indigo-300'
                : 'text-slate-500 dark:text-slate-400'
            }`}
          >
            {net === null ? '—' : `${usd(net / 4, 0)}`}
          </span>
        )}
      </td>
    </tr>
  );
}

function StatusCard({
  tone,
  icon,
  children,
}: {
  tone: 'emerald' | 'amber';
  icon: 'check' | 'alert';
  children: ReactNode;
}) {
  const tones = {
    emerald:
      'border-emerald-200/80 bg-emerald-50/70 text-emerald-800 dark:border-emerald-500/25 dark:bg-emerald-500/10 dark:text-emerald-300',
    amber:
      'border-amber-200/80 bg-amber-50/70 text-amber-800 dark:border-amber-500/25 dark:bg-amber-500/10 dark:text-amber-300',
  } as const;
  return (
    <div className={`rounded-2xl border p-4 text-sm leading-relaxed shadow-sm ${tones[tone]}`}>
      {icon === 'check' ? (
        <ShieldCheck className="mb-2 h-4 w-4" aria-hidden="true" />
      ) : (
        <AlertTriangle className="mb-2 h-4 w-4" aria-hidden="true" />
      )}
      <p>{children}</p>
    </div>
  );
}

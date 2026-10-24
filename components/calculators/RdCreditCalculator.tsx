'use client';

import { useEffect, useMemo } from 'react';
import {
  AlertTriangle,
  FlaskConical,
  Info,
  Landmark,
  RotateCcw,
  Scale,
} from 'lucide-react';
import NumberInput, { AnimatedNumber, CopyButton, SliderControl } from '@/components/NumberInput';
import ScenarioButtons from '@/components/ScenarioButtons';
import ComparisonChart from '@/components/ComparisonChart';
import {
  evaluateIncomePath,
  evaluatePayrollPath,
  marginalRateSweep,
  qreSweep,
  RDC_CONSTANTS as C,
} from '@/lib/rdcredit';
import { usd, usdCompact, pct, clamp } from '@/lib/format';
import { useWorkbenchInputs, recordRecent } from '@/lib/workbench';

const SLUG = 'rd-tax-credit-calculator';
const HREF = '/rd-tax-credit-calculator/';

/** Toggles stored as 0/1 so the whole state stays Record<string, number>. */
const DEFAULTS = {
  qre: 400_000,
  priorAvg3: 200_000,
  regularTax: 45_000,
  marginalRate: 24,
  elect280C: 1,
  isQsb: 1,
  ficaWages: 300_000,
  payrollElected: 0,
};

const QRE_PRESETS = [100_000, 250_000, 500_000, 1_000_000];
const AVG_PRESETS = [0, 100_000, 200_000, 400_000];
const RATE_PRESETS = [10, 12, 22, 24, 32, 35, 37];

/** Whole-scenario presets — each is a full, hand-checkable situation. */
type Preset = { name: string; hint: string; values: typeof DEFAULTS };
const PRESETS: Preset[] = [
  {
    name: 'First-year startup',
    hint: 'No prior QRE · 6% rule · credit routed to payroll',
    values: { qre: 300_000, priorAvg3: 0, regularTax: 6_000, marginalRate: 12, elect280C: 1, isQsb: 1, ficaWages: 180_000, payrollElected: 18_000 },
  },
  {
    name: 'Year-2 SaaS',
    hint: 'Prior avg $100k · QSB · split between paths',
    values: { qre: 600_000, priorAvg3: 100_000, regularTax: 25_000, marginalRate: 24, elect280C: 1, isQsb: 1, ficaWages: 400_000, payrollElected: 30_600 },
  },
  {
    name: 'Profitable consultancy',
    hint: 'Established base · not a QSB · 32% bracket',
    values: { qre: 400_000, priorAvg3: 350_000, regularTax: 85_000, marginalRate: 32, elect280C: 1, isQsb: 0, ficaWages: 120_000, payrollElected: 0 },
  },
  {
    name: 'Pre-revenue biotech',
    hint: 'No tax liability · whole credit to payroll',
    values: { qre: 900_000, priorAvg3: 200_000, regularTax: 0, marginalRate: 35, elect280C: 1, isQsb: 1, ficaWages: 700_000, payrollElected: 112_000 },
  },
  {
    name: 'C-corp post-revenue',
    hint: 'Corporation · 21% rate · not a QSB',
    values: { qre: 800_000, priorAvg3: 600_000, regularTax: 120_000, marginalRate: 21, elect280C: 0, isQsb: 0, ficaWages: 200_000, payrollElected: 0 },
  },
];

export default function RdCreditCalculator() {
  const { values, set, reset } = useWorkbenchInputs(SLUG, DEFAULTS);
  const {
    qre, priorAvg3, regularTax, marginalRate, elect280C, isQsb, ficaWages, payrollElected,
  } = values;

  useEffect(() => {
    recordRecent(SLUG);
  }, []);

  const hasElection = elect280C === 1;
  const qsb = isQsb === 1;
  const rate = clamp(marginalRate, 0, 37) / 100;
  // The §41(h) election splits the credit: dollars elected toward employer
  // FICA cannot offset income tax or join the GBC carryforward (Form 3800
  // instructions), so both paths consume the SAME elected amount.
  const elected = qsb ? Math.min(Math.max(0, payrollElected), 500_000) : 0;

  const income = useMemo(
    () =>
      evaluateIncomePath({
        qre, priorAvg3Qre: priorAvg3, regularTax,
        marginalRate: rate, elect280C: hasElection, electedToPayroll: elected,
      }),
    [qre, priorAvg3, regularTax, rate, hasElection, elected],
  );

  const payroll = useMemo(
    () =>
      evaluatePayrollPath({
        qre, priorAvg3Qre: priorAvg3, ficaWages, marginalRate: rate, elected,
      }),
    [qre, priorAvg3, ficaWages, rate, elected],
  );

  // QRE sensitivity: the same research spend under the no-prior-QRE 6% rule
  // vs an established filer at the entered prior average. Crossover at
  // QRE = 7/4 × base.
  const qreMax = Math.max(1_000_000, qre * 1.5);
  const sweep = useMemo(
    () => qreSweep(priorAvg3, 0, qreMax, 81),
    [priorAvg3, qreMax],
  );
  const crossover = 1.75 * (0.5 * priorAvg3);

  // §280C branch comparison across marginal rates — the crossover is exactly
  // 21% whenever the §38(c) ceiling leaves both branches room.
  const rateSweep = useMemo(
    () =>
      marginalRateSweep(
        { qre, priorAvg3Qre: priorAvg3, regularTax, electedToPayroll: elected },
        0, 40, 81,
      ),
    [qre, priorAvg3, regularTax, elected],
  );

  const noPriorQre = income.method === 'asc-startup';
  const methodLabel = noPriorQre
    ? '6% special rule · §41(c)(4)(B)'
    : 'Simplified — 14% over base · §41(c)(4)(A)';

  // Display-only: the whole-scenario preset matching the current inputs, so the
  // pill row can surface its hint line — the same active-preset description the
  // sibling tools render under their preset pills.
  const activePreset = PRESETS.find((p) =>
    Object.entries(p.values).every(([k, v]) => Math.abs((values as Record<string, number>)[k] - v) < 0.5),
  );

  const electionRightCall =
    hasElection
      ? income.electionAdvantage >= -0.005
      : income.electionAdvantage <= 0.005;
  const electionSentence =
    income.ceiling < income.alternative.claimed - 1e-9 && income.ceiling < income.selected.claimed - 1e-9
      ? `Your §38(c) ceiling (${usd(income.ceiling, 0)}) caps both branches, so the election gives up nothing — take the reduced credit and keep the deduction.`
      : electionRightCall
        ? `Correct call: at a ${pct(rate * 100, 0)} marginal rate the ${hasElection ? 'reduced credit' : 'full credit'} is worth ${usd(Math.abs(income.electionAdvantage), 0)} more than the alternative.`
        : `At a ${pct(rate * 100, 0)} marginal rate you are on the wrong side of the 21% line: the ${hasElection ? 'full credit with a reduced deduction' : 'reduced credit with a full deduction'} would be worth ${usd(Math.abs(income.electionAdvantage), 0)} more.`;

  const copySummary = `§41 R&D credit (TY2025): ${noPriorQre ? 'no QRE in the prior 3 years — 6% special rule' : `ASC 14% over 50% × prior average`} · QRE ${usd(qre, 0)} · prior avg ${usd(priorAvg3, 0)} → gross credit ${usd(income.grossCredit, 0)}${elected > 0 ? ` · ${usd(elected, 0)} elected toward employer FICA (§41(h))` : ''} · income-tax share ${usd(income.incomeGross, 0)}${hasElection ? ' · §280C(c)(2) reduced credit' : ' · full credit, deduction reduced'} · ceiling ${usd(income.ceiling, 0)} (§38(c)).`;

  return (
    <div className="grid gap-6 lg:grid-cols-5">
      {/* ================= Inputs ================= */}
      <div className="card p-6 sm:p-8 lg:col-span-3">
        {/* Scenario presets */}
        <div className="mb-6">
          <p className="label">Scenario presets</p>
          <div className="flex flex-wrap gap-1.5">
            {PRESETS.map((p) => {
              const active = activePreset?.name === p.name;
              return (
                <button
                  key={p.name}
                  type="button"
                  title={p.hint}
                  aria-pressed={active}
                  onClick={() => {
                    (Object.keys(p.values) as (keyof typeof DEFAULTS)[]).forEach((k) =>
                      set(k, p.values[k]),
                    );
                  }}
                  className={`rounded-full px-3 py-1.5 text-xs font-medium transition-all duration-150 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 dark:focus-visible:ring-indigo-400 dark:focus-visible:ring-offset-slate-950 ${
                    active
                      ? 'border border-indigo-500 bg-indigo-50 text-indigo-700 dark:border-indigo-400 dark:bg-indigo-500/15 dark:text-indigo-300'
                      : 'border border-slate-200 bg-white text-slate-500 hover:border-indigo-300 hover:text-indigo-600 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-400 dark:hover:border-indigo-400/50 dark:hover:text-indigo-300'
                  }`}
                >
                  {p.name}
                </button>
              );
            })}
          </div>
          {activePreset && (
            <p className="mt-2 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
              {activePreset.hint}
            </p>
          )}
        </div>

        <div className="space-y-6">
          {/* Current-year QRE */}
          <div>
            <NumberInput
              id="rdc-qre"
              label="Qualified research expenses this year (QRE)"
              value={qre}
              onChange={(n) => set('qre', n)}
              min={0}
              max={5000000}
              prefix="$"
              placeholder="400,000"
              helpText="In-house researcher wages for qualified services, supplies consumed by that work, and 65% of qualifying contract research. Aggregate them here — the composition rules are in the guide."
            />
            <div className="mt-3">
              <SliderControl
                id="rdc-qre-slider"
                label="Current-year QRE"
                value={qre}
                onChange={(n) => set('qre', n)}
                min={10000}
                max={5000000}
                logarithmic
                prefix="$"
                presets={QRE_PRESETS}
                formatValue={usdCompact}
              />
            </div>
          </div>

          {/* Prior 3-year average */}
          <div>
            <NumberInput
              id="rdc-prior-avg"
              label="Average annual QRE, 3 prior tax years (sum ÷ 3)"
              value={priorAvg3}
              onChange={(n) => set('priorAvg3', n)}
              min={0}
              max={2000000}
              prefix="$"
              placeholder="200,000"
              helpText="Sum of the three preceding years ÷ 3, zeros included. The credit only applies to QRE above 50% of this average."
            />
            <div className="mt-3">
              <SliderControl
                id="rdc-prior-avg-slider"
                label="Prior 3-year average QRE"
                value={priorAvg3}
                onChange={(n) => set('priorAvg3', n)}
                min={0}
                max={2000000}
                step={5000}
                prefix="$"
                presets={AVG_PRESETS}
                formatValue={usdCompact}
              />
            </div>
            {noPriorQre && (
              <p className="mt-2 flex items-start gap-2 rounded-lg bg-indigo-50 p-2.5 text-xs leading-relaxed text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300">
                <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-indigo-500 dark:text-indigo-400" aria-hidden="true" />
                No QRE in any of the 3 preceding years (average = $0): the statute switches you to
                the flat <strong className="font-semibold">{pct(C.startupRate * 100, 0)} rate</strong>{' '}
                (§41(c)(4)(B)) — the same rule covers a first research year and a company returning
                to research after a multi-year gap. From your next year on, the average is simply
                the three-year sum ÷ 3 — one year of history over a three-year denominator.
              </p>
            )}
          </div>

          {/* Regular tax + marginal rate */}
          <div className="grid gap-6 sm:grid-cols-2">
            <NumberInput
              id="rdc-tax"
              label="Regular federal income tax (before credits)"
              value={regularTax}
              onChange={(n) => set('regularTax', n)}
              min={0}
              max={10000000}
              prefix="$"
              placeholder="45,000"
              helpText="The §38(c) general-business-credit ceiling is computed from this — 25% of the excess over $25,000 for corporations and individuals alike. Zero in a loss year: the payroll path below is built for exactly that."
            />
            <div>
              <SliderControl
                id="rdc-rate-slider"
                label="Top marginal ordinary rate"
                value={clamp(marginalRate, 10, 37)}
                onChange={(n) => set('marginalRate', Math.round(n))}
                min={10}
                max={37}
                step={1}
                suffix="%"
                presets={RATE_PRESETS}
                helpText="Prices the deduction you give up under §280C(c)(1) and the employer-FICA deduction the payroll offset replaces."
              />
            </div>
          </div>

          {/* §280C election */}
          <div>
            <span className="label" id="rdc-280c-label">
              §280C(c) choice
            </span>
            <div className="mt-2 flex gap-1.5" role="group" aria-labelledby="rdc-280c-label">
              {(
                [
                  { key: 1, label: `Reduced credit (keep 79%)` },
                  { key: 0, label: 'Full credit (reduce deduction)' },
                ] as const
              ).map((opt) => {
                const active = elect280C === opt.key;
                return (
                  <button
                    key={opt.key}
                    type="button"
                    aria-pressed={active}
                    onClick={() => set('elect280C', opt.key)}
                    className={`focus-calm flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-all duration-150 ${
                      active
                        ? 'border-emerald-500 bg-emerald-50 text-emerald-700 dark:border-emerald-400 dark:bg-emerald-500/15 dark:text-emerald-300'
                        : 'border-slate-200 bg-white text-slate-600 hover:border-emerald-300 hover:text-emerald-700 dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-300 dark:hover:border-emerald-400/50 dark:hover:text-emerald-300'
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
            <p className="mt-1.5 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
              Reduced credit: 79% of the income-tax share, deduction untouched (§280C(c)(2)). Full
              credit: 100%, but the §174A deduction falls by the credit allowed (§280C(c)(1)). The
              lines cross at a 21% marginal rate.
            </p>
          </div>

          {/* QSB */}
          <div>
            <span className="label" id="rdc-qsb-label">
              Qualified small business (§41(h)(3))?
            </span>
            <div className="mt-2 flex gap-1.5" role="group" aria-labelledby="rdc-qsb-label">
              {(
                [
                  { key: 1, label: 'Yes — payroll path open' },
                  { key: 0, label: 'No' },
                ] as const
              ).map((opt) => {
                const active = isQsb === opt.key;
                return (
                  <button
                    key={opt.key}
                    type="button"
                    aria-pressed={active}
                    onClick={() => set('isQsb', opt.key)}
                    className={`focus-calm flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-all duration-150 ${
                      active
                        ? 'border-amber-500 bg-amber-50 text-amber-700 dark:border-amber-400 dark:bg-amber-500/15 dark:text-amber-300'
                        : 'border-slate-200 bg-white text-slate-600 hover:border-amber-300 hover:text-amber-700 dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-300 dark:hover:border-amber-400/50 dark:hover:text-amber-300'
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
            <p className="mt-1.5 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
              Gross receipts ≤ $5M this year and none in any year before the 5-year period ending
              with it — roughly, five years old or younger. Electing to route credit to employer
              FICA removes those dollars from the income-tax path above.
            </p>
          </div>

          {/* FICA wages */}
          <div className={qsb ? '' : 'opacity-60'}>
            <NumberInput
              id="rdc-wages"
              label="Annual W-2 wages subject to employer FICA"
              value={ficaWages}
              onChange={(n) => set('ficaWages', n)}
              min={0}
              max={10000000}
              prefix="$"
              placeholder="300,000"
              helpText={`Only the §41(h) payroll path uses this${qsb ? '' : ' — not applicable while you are not a qualified small business'}. Drives the offset capacity (employer Social Security first, then Medicare); the 2025 per-employee SS wage base ($176,100) is not modeled.`}
            />
          </div>
        </div>

        <div className="mt-6 flex items-start gap-2 rounded-lg bg-slate-50 p-3 text-xs leading-relaxed text-slate-600 dark:bg-white/[0.03] dark:text-slate-300">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-slate-400 dark:text-slate-500" aria-hidden="true" />
          <p>
            Federal-only, tax year 2025, simplified credit method (§41(c)(4)) — the regular
            fixed-base method is not modeled and usually pays more for mature R&amp;D programs. AMT
            assumed away in the §38(c) ceiling; §174/§174A treatment (domestic expensing restored
            for tax years beginning after 12/31/2024) does not change any number here — see the
            guide.
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
            shortTitle="R&D Tax Credit"
            href={HREF}
            params={{ qre, priorAvg3, regularTax, marginalRate, elect280C, isQsb, ficaWages, payrollElected }}
          />
        </div>
      </div>

      {/* ================= Results ================= */}
      <div className="space-y-4 lg:col-span-2">
        {/* Headline credit */}
        <div className="card p-6 sm:p-8">
          <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            <FlaskConical className="h-4 w-4" aria-hidden="true" />
            Your §41 credit
          </h2>
          <div className="mt-3">
            <span
              className={`chip font-mono text-[10px] uppercase tracking-wider ${
                noPriorQre
                  ? 'bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300'
                  : 'bg-indigo-50 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300'
              }`}
            >
              {methodLabel}
            </span>
            <AnimatedNumber
              value={income.grossCredit}
              format={(n) => usd(n)}
              className="readout mt-2 block text-4xl font-extrabold tracking-tight text-indigo-600 dark:text-indigo-300"
            />
            <p className="mt-1 text-sm leading-relaxed text-slate-500 dark:text-slate-400">
              before the §41(h) split, §280C, and the income-tax ceiling
            </p>
          </div>

          {/* Determination ledger */}
          <dl className="mt-5 divide-y divide-slate-100 text-sm dark:divide-white/[0.06]">
            <LedgerRow label="Current-year QRE" value={usd(qre, 0)} />
            {noPriorQre ? (
              <LedgerRow label="Statutory rate — no prior-QRE years" value={`× ${pct(C.startupRate * 100, 0)}`} />
            ) : (
              <>
                <LedgerRow
                  label="Base — 50% of prior 3-yr average"
                  value={`− ${usd(income.base, 0)}`}
                  note={`average ${usd(priorAvg3, 0)}`}
                />
                <LedgerRow label="Increment × 14% credit rate" value={usd(income.increment, 0)} />
              </>
            )}
            {elected > 0 && (
              <LedgerRow
                label="Elected toward employer FICA (§41(h))"
                value={`− ${usd(elected, 0)}`}
                note="leaves the income-tax path entirely"
              />
            )}
            <LedgerRow
              label={hasElection ? 'Credit claimed (§280C(c)(2), 79%)' : 'Credit claimed (full)'}
              value={usd(income.selected.claimed, 0)}
            />
            <LedgerRow
              label="§38(c) income-tax ceiling"
              value={usd(income.ceiling, 0)}
              note="25% of the excess over $25,000 — corporations included"
            />
            <LedgerRow label="Applied against this year's tax" value={usd(income.selected.used, 0)} />
            {income.selected.carriedForward > 0.5 && (
              <LedgerRow
                label="Carried forward (§39: 1 yr back, 20 fwd)"
                value={usd(income.selected.carriedForward, 0)}
                muted
              />
            )}
            {income.selected.deductionReduction > 0.5 && (
              <LedgerRow
                label="§174A deduction reduced by credit allowed"
                value={`− ${usd(income.selected.deductionReduction, 0)}`}
                note="§280C(c)(1)"
              />
            )}
            <div className="flex items-center justify-between py-2.5">
              <dt className="font-medium text-slate-700 dark:text-slate-300">
                Net benefit this year (income path)
              </dt>
              <dd className="readout text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                {usd(income.selected.netBenefit, 0)}
              </dd>
            </div>
          </dl>
          <p className="mt-2 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
            Net = credit applied minus the {pct(rate * 100, 0)} marginal-rate value of any deduction
            the credit forced you to give up. Carryforwards are worth less than cash today — they
            are excluded from this figure on purpose.
          </p>
        </div>

        {/* 280C verdict */}
        <div className="card p-6 sm:p-8">
          <h3 className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-slate-100">
            <Scale className="h-4 w-4 text-slate-400 dark:text-slate-500" aria-hidden="true" />
            The §280C trade, at your numbers
          </h3>
          <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-lg border border-slate-200 p-3 dark:border-white/[0.08]">
              <div className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Reduced credit
              </div>
              <div className={`readout mt-1 text-xl font-bold ${hasElection ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-700 dark:text-slate-200'}`}>
                {usd(hasElection ? income.selected.netBenefit : income.alternative.netBenefit, 0)}
              </div>
              <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">79% kept, full deduction</div>
            </div>
            <div className="rounded-lg border border-slate-200 p-3 dark:border-white/[0.08]">
              <div className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Full credit
              </div>
              <div className={`readout mt-1 text-xl font-bold ${!hasElection ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-700 dark:text-slate-200'}`}>
                {usd(!hasElection ? income.selected.netBenefit : income.alternative.netBenefit, 0)}
              </div>
              <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">deduction cut by credit allowed</div>
            </div>
          </div>
          {electionSentence && (
            <p className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
              {electionSentence}
            </p>
          )}
          {income.ceilingBinds && (
            <p className="mt-3 flex items-start gap-2 rounded-lg bg-amber-50 p-2.5 text-xs leading-relaxed text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500 dark:text-amber-400" aria-hidden="true" />
              The ceiling caps your chosen branch at {usd(income.ceiling, 0)} — the rest carries
              forward as general business credit (§39), waiting for tax liability. If you qualify
              below, routing those dollars to payroll turns the waiting credit into cash now.
            </p>
          )}
        </div>

        {/* Payroll path */}
        <div className="card p-6 sm:p-8">
          <h3 className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-slate-100">
            <Landmark className="h-4 w-4 text-slate-400 dark:text-slate-500" aria-hidden="true" />
            §41(h) payroll-tax path
          </h3>
          {qsb ? (
            <>
              <div className="mt-4">
                <SliderControl
                  id="rdc-elected-slider"
                  label="Credit elected toward employer FICA"
                  value={clamp(elected, 0, payroll.electable)}
                  onChange={(n) => set('payrollElected', Math.round(n))}
                  min={0}
                  max={payroll.electable}
                  step={250}
                  prefix="$"
                  presets={[0, payroll.electable]}
                  formatValue={usdCompact}
                  helpText="A split, not a bonus: elected dollars cannot offset income tax or join the general-business-credit carryforward (Form 3800 instructions) — the income-path ledger above already excludes them."
                />
              </div>
              <dl className="mt-4 divide-y divide-slate-100 text-sm dark:divide-white/[0.06]">
                <LedgerRow
                  label="Election ceiling (≤ $500,000/yr)"
                  value={usd(payroll.electable, 0)}
                />
                <LedgerRow
                  label="Offset capacity — employer FICA on wages"
                  value={usd(payroll.offsetCapacity, 0)}
                  note={`6.2% ${usd(payroll.employerOasdiTax, 0)} + 1.45% ${usd(payroll.employerHiTax, 0)}`}
                />
                <LedgerRow label="Applied this year (Form 8974, quarterly)" value={usd(payroll.appliedThisYear, 0)} />
                {payroll.remainingElected > 0.5 && (
                  <LedgerRow
                    label="Carries to later employment-tax returns"
                    value={usd(payroll.remainingElected, 0)}
                    muted
                  />
                )}
                <div className="flex items-center justify-between py-2.5">
                  <dt className="font-medium text-slate-700 dark:text-slate-300">Net cash value</dt>
                  <dd className="readout text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                    {usd(payroll.netValue, 0)}
                  </dd>
                </div>
              </dl>
              <p className="mt-2 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                The offset is dollar-for-dollar, but employer FICA you no longer pay is also no
                longer deductible — the net figures that in at your {pct(rate * 100, 0)} rate. Cash
                starts the first quarter after you file the return claiming the election. Whether
                §280C also trims the §174A deduction for payroll-elected amounts is governed by
                current IRS guidance (Form 6765/8974 instructions) — this tool does not model that
                layer.
              </p>
            </>
          ) : (
            <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
              Not available here: the election requires gross receipts of{' '}
              {usdCompact(C.qsbReceiptsCap)} or less this year and none before the 5-year period
              ending with it (§41(h)(3)(B)). Companies past that window monetize the credit the
              slow way — against income tax, with §39 carryforwards bridging loss years.
            </p>
          )}
        </div>
      </div>

      {/* ================= QRE sensitivity ================= */}
      <div className="lg:col-span-5">
        <div className="card p-5 sm:p-6">
          <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                The credit as QRE grows
              </h3>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                The same research spend with no QRE in the prior 3 years (6% special rule) and as
                an established filer at your prior average ({usdCompact(priorAvg3)}).
              </p>
            </div>
            <span className="readout rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600 dark:bg-white/[0.05] dark:text-slate-300">
              now: QRE {usdCompact(qre)} →{' '}
              <span className="text-indigo-600 dark:text-indigo-300">{usd(income.grossCredit, 0)}</span>
            </span>
          </div>
          <ComparisonChart
            series={[
              {
                label: 'No QRE in prior 3 years — 6% flat',
                color: '#f59e0b',
                points: sweep.map((p) => ({ x: p.qre, y: p.noPriorQre })),
                fillTo: 0,
              },
              {
                label: 'Established — 14% over base',
                color: '#6366f1',
                points: sweep.map((p) => ({ x: p.qre, y: p.established })),
              },
            ]}
            xLabel="Current-year QRE"
            yLabel="§41 gross credit"
            xFormat={(n) => usdCompact(n)}
            yFormat={(n) => usdCompact(n)}
            height={280}
            marker={{
              x: clamp(qre, 0, qreMax),
              label: 'your QRE',
            }}
            caption={`The established line is zero until QRE clears the base (50% of the prior average), then climbs at 14¢ per incremental dollar; the no-prior-QRE line starts at 6¢ from the first dollar. They cross at QRE = 7/4 × base${priorAvg3 > 0 ? ` — ${usdCompact(crossover)} at your average` : ' (no average entered)'} — beyond it, an established filer with the same base earns more per dollar, which is why growing R&D budgets age well under §41(c)(4).`}
          />
        </div>
      </div>

      {/* ================= 280C branch comparison ================= */}
      <div className="lg:col-span-5">
        <div className="card p-5 sm:p-6">
          <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                §280C: full credit vs reduced credit, by marginal rate
              </h3>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                At your QRE ({usdCompact(qre)}) and tax liability ({usdCompact(regularTax)}) — every
                point is the full §38(c)-capped engine on the income-tax share ({usdCompact(income.incomeGross)}
                {elected > 0 ? ` after the ${usdCompact(elected)} payroll election` : ''}),
                recomputed.
              </p>
            </div>
            <span className="readout rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600 dark:bg-white/[0.05] dark:text-slate-300">
              your rate: {pct(rate * 100, 0)} →{' '}
              <span className={electionRightCall ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}>
                {hasElection ? 'reduced credit' : 'full credit'}{' '}
                {income.electionAdvantage >= -0.005 ? 'wins' : 'loses'}{' '}
                {usd(Math.abs(income.electionAdvantage), 0)}
              </span>
            </span>
          </div>
          <ComparisonChart
            series={[
              {
                label: 'Full credit — deduction reduced',
                color: '#0ea5e9',
                points: rateSweep.map((p) => ({ x: p.ratePct, y: p.netFullCredit })),
              },
              {
                label: 'Reduced credit — deduction intact',
                color: '#10b981',
                points: rateSweep.map((p) => ({ x: p.ratePct, y: p.netReducedCredit })),
              },
            ]}
            xLabel="Top marginal ordinary rate"
            yLabel="Net benefit this year"
            xFormat={(n) => `${Math.round(n)}%`}
            yFormat={(n) => usdCompact(n)}
            height={280}
            marker={{ x: 21, label: '21% — statutory crossover' }}
            markerColor="#f59e0b"
            caption="Left of 21% the full credit wins — the deduction you surrender is worth less than the 21% of credit the election costs. Right of 21% the reduced credit wins, and the gap widens one-for-one with the rate. Where the §38(c) ceiling bites, both lines bend toward the same cap and the election becomes strictly safer — it never gives up cash, only carryforward room."
          />
        </div>
      </div>
    </div>
  );
}

function LedgerRow({
  label,
  value,
  note,
  muted = false,
}: {
  label: string;
  value: string;
  note?: string;
  muted?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-3 py-2.5">
      <dt className="text-slate-600 dark:text-slate-300">
        {label}
        {note && (
          <span className="readout block text-[11px] font-normal text-slate-500 dark:text-slate-400">
            {note}
          </span>
        )}
      </dt>
      <dd
        className={`readout whitespace-nowrap text-sm font-semibold ${
          muted ? 'text-slate-500 dark:text-slate-400' : 'text-slate-900 dark:text-slate-100'
        }`}
      >
        {value}
      </dd>
    </div>
  );
}

'use client';

import { useEffect, useMemo } from 'react';
import { AlertTriangle, BadgeDollarSign, Info, RotateCcw, Users } from 'lucide-react';
import NumberInput, { AnimatedNumber, CopyButton, SliderControl } from '@/components/NumberInput';
import ScenarioButtons from '@/components/ScenarioButtons';
import ComparisonChart from '@/components/ComparisonChart';
import {
  computeQbiDeduction,
  phaseOutSweep,
  wageSweep,
  wagesNeededToUnlock,
  taxValueOfDeduction,
  type FilingStatus,
  type QbiInputs,
} from '@/lib/qbi';
import { usd, usdCompact, pct, clamp } from '@/lib/format';
import { useWorkbenchInputs, recordRecent } from '@/lib/workbench';

const SLUG = 'qbi-deduction-calculator';
const HREF = '/qbi-deduction-calculator/';

/** filing and sstb are stored as 0/1 so the whole state is Record<string, number>. */
const DEFAULTS = { qbi: 150000, taxableIncome: 220000, w2Wages: 40000, ubia: 0, filing: 0, sstb: 0 };

const QBI_PRESETS = [80000, 150000, 250000, 500000];
const WAGE_PRESETS = [0, 40000, 60000, 100000];

/** Whole-scenario presets — each is a full, hand-checkable situation. */
type Preset = { name: string; hint: string; values: typeof DEFAULTS };
const PRESETS: Preset[] = [
  {
    name: 'Consultant under threshold',
    hint: 'SSTB, single, TI $150k — clean 20%',
    values: { qbi: 120000, taxableIncome: 150000, w2Wages: 0, ubia: 0, filing: 0, sstb: 1 },
  },
  {
    name: 'Consultant in phase-out',
    hint: 'SSTB, single, TI $220k, no staff',
    values: { qbi: 150000, taxableIncome: 220000, w2Wages: 0, ubia: 0, filing: 0, sstb: 1 },
  },
  {
    name: 'Same, but S-Corp salary',
    hint: 'Owner salary counts as W-2 wages',
    values: { qbi: 150000, taxableIncome: 220000, w2Wages: 90000, ubia: 0, filing: 0, sstb: 1 },
  },
  {
    name: 'Product business',
    hint: 'Non-SSTB, staff + equipment, TI $350k',
    values: { qbi: 300000, taxableIncome: 350000, w2Wages: 80000, ubia: 400000, filing: 0, sstb: 0 },
  },
  {
    name: 'MFJ couple in range',
    hint: 'Non-SSTB, TI $450k, $60k wages',
    values: { qbi: 250000, taxableIncome: 450000, w2Wages: 60000, ubia: 0, filing: 1, sstb: 0 },
  },
];

export default function QbiCalculator() {
  const { values, set, reset } = useWorkbenchInputs(SLUG, DEFAULTS);
  const { qbi, taxableIncome, w2Wages, ubia, filing, sstb } = values;

  useEffect(() => {
    recordRecent(SLUG);
  }, []);

  const fs: FilingStatus = filing === 1 ? 'mfj' : 'single';
  const isSstb = sstb === 1;

  const inputs: QbiInputs = useMemo(
    () => ({ qbi, taxableIncome, w2Wages, ubia, sstb: isSstb, filingStatus: fs }),
    [qbi, taxableIncome, w2Wages, ubia, isSstb, fs],
  );

  const result = useMemo(() => computeQbiDeduction(inputs), [inputs]);
  const unlock = useMemo(() => wagesNeededToUnlock(inputs), [inputs]);
  const taxValue = useMemo(
    () => taxValueOfDeduction(taxableIncome, result.deduction, fs),
    [taxableIncome, result.deduction, fs],
  );

  // Phase-out curves: same business as SSTB vs non-SSTB, taxable income swept
  // from below the threshold to well above the phase-in range.
  const sweep = useMemo(
    () =>
      phaseOutSweep(
        { qbi, w2Wages, ubia, filingStatus: fs },
        Math.max(1000, result.threshold - 150000),
        result.threshold + 3 * result.phaseInRange,
        121,
      ),
    [qbi, w2Wages, ubia, fs, result.threshold, result.phaseInRange],
  );

  // Wage-rescue curve: deduction as W-2 wages grow, everything else fixed.
  const wageMax = Math.max(100000, w2Wages * 1.5, (unlock ?? 0) * 1.1);
  const wSweep = useMemo(() => wageSweep(inputs, 0, wageMax, 73), [inputs, wageMax]);

  const tiPresets = fs === 'single' ? [150000, 197300, 222300, 247300] : [300000, 394600, 444600, 494600];
  const tiMax = fs === 'single' ? 600000 : 1200000;

  const limiterSentence = result.sstbExcluded
    ? 'Your SSTB is excluded entirely — taxable income is above the top of the phase-out range, so the deduction is zero no matter the wage bill.'
    : result.qbiLoss
    ? 'No positive qualified business income here — a qualified loss carries forward to future years instead (not modeled).'
    : result.limiter === 'cap'
      ? 'Capped at 20% of taxable income — too little other income (or large deductions elsewhere) is holding the cap below the full 20% of QBI.'
      : result.limiter === 'wage'
        ? isSstb && result.applicablePct < 1
          ? 'The W-2/UBIA limit and the SSTB phase-out are both biting — see the guide for why they compound.'
          : result.inPhaseRange
            ? 'The W-2 wage / UBIA limit applies, partially phased in by the phase-in range.'
            : 'The W-2 wage / UBIA limit applies in full — wages or equipment basis are the binding constraint.'
        : 'The full 20% of qualified business income — no wage limit or phase-out is binding.';

  const copySummary = `§199A QBI deduction (2025): ${fs === 'mfj' ? 'married filing jointly' : 'single filer'} · QBI ${usd(qbi, 0)} · taxable income ${usd(taxableIncome, 0)} · ${isSstb ? 'SSTB' : 'non-SSTB'} → deduction ${usd(result.deduction)} (${limiterSentence.split(' — ')[0]}). W-2 wages ${usd(w2Wages, 0)}, UBIA ${usd(ubia, 0)}.`;

  // Marginal rescue slopes, per $1 of extra W-2 wages, while the limit still
  // binds and the same branch stays larger. Gross holds QBI fixed; net also
  // lets the wage dollar reduce QBI dollar-for-dollar (0.2 recovered at the
  // 20% layer). For an SSTB above the threshold, Schedule A multiplies its
  // wages by the applicable percentage BEFORE the wage limit — so both slopes
  // carry that factor too: gross = ap × share × pip; net = ap × ((share + 0.2)·pip − 0.2).
  const apFactor = isSstb && result.aboveThreshold ? result.applicablePct : 1;
  const marginalShare = result.wageLimit50 >= result.wageLimitAlt ? 0.5 : 0.25;
  const grossSlope = apFactor * marginalShare * result.phaseInPct;
  const netSlope = apFactor * ((marginalShare + 0.2) * result.phaseInPct - 0.2);
  const showRescueSlopes =
    result.aboveThreshold && !result.qbiLoss && !result.fullyUnlocked && !result.sstbExcluded;

  return (
    <div className="grid gap-6 lg:grid-cols-5">
      {/* ================= Inputs ================= */}
      <div className="card p-6 sm:p-8 lg:col-span-3">
        {/* Scenario presets */}
        <div className="mb-6">
          <p className="label">Scenario presets</p>
          <div className="flex flex-wrap gap-1.5">
            {PRESETS.map((p) => {
              const active = Object.entries(p.values).every(
                ([k, v]) => Math.abs((values as Record<string, number>)[k] - v) < 0.5,
              );
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
                  className={`focus-calm rounded-full px-3 py-1.5 text-xs font-semibold transition-all duration-150 ${
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
        </div>

        <div className="space-y-6">
          {/* Filing status */}
          <div>
            <span className="label" id="qbi-filing-label">
              Filing status (2025 thresholds)
            </span>
            <div className="mt-2 flex gap-1.5" role="group" aria-labelledby="qbi-filing-label">
              {(
                [
                  { key: 0, label: 'Single' },
                  { key: 1, label: 'Married filing jointly' },
                ] as const
              ).map((opt) => {
                const active = filing === opt.key;
                const th = opt.key === 1 ? 394600 : 197300;
                return (
                  <button
                    key={opt.key}
                    type="button"
                    aria-pressed={active}
                    onClick={() => set('filing', opt.key)}
                    className={`focus-calm flex-1 rounded-lg border px-3 py-2 text-left text-sm font-medium transition-all duration-150 ${
                      active
                        ? 'border-indigo-500 bg-indigo-50 text-indigo-700 dark:border-indigo-400 dark:bg-indigo-500/15 dark:text-indigo-300'
                        : 'border-slate-200 bg-white text-slate-500 hover:border-indigo-300 hover:text-indigo-600 dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-400 dark:hover:border-indigo-400/50 dark:hover:text-indigo-300'
                    }`}
                  >
                    {opt.label}
                    <span className="readout mt-0.5 block text-[11px] font-normal text-slate-500 dark:text-slate-400">
                      threshold {usdCompact(th)} · phase-out ends {usdCompact(th + (opt.key === 1 ? 100000 : 50000))}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* SSTB */}
          <div>
            <span className="label" id="qbi-sstb-label">
              Is the business a specified service trade or business (SSTB)?
            </span>
            <div className="mt-2 flex gap-1.5" role="group" aria-labelledby="qbi-sstb-label">
              {(
                [
                  { key: 0, label: 'No — regular business' },
                  { key: 1, label: 'Yes — SSTB' },
                ] as const
              ).map((opt) => {
                const active = sstb === opt.key;
                return (
                  <button
                    key={opt.key}
                    type="button"
                    aria-pressed={active}
                    onClick={() => set('sstb', opt.key)}
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
              Health, law, accounting, actuarial science, performing arts, consulting, athletics,
              financial &amp; brokerage services, investing, trading — the full list is in the guide
              below. Above the threshold an SSTB phases out entirely.
            </p>
          </div>

          <div>
            <NumberInput
              id="qbi-income"
              label="Qualified business income (QBI)"
              value={qbi}
              onChange={(n) => set('qbi', n)}
              min={0}
              max={10000000}
              prefix="$"
              placeholder="150,000"
              helpText="K-1 ordinary income from an S-corp/partnership, or Schedule C net profit minus ½ SE tax, self-employed health insurance (§162(l)) and retirement contributions (§404). Your own W-2 salary is NOT QBI."
            />
            <div className="mt-3">
              <SliderControl
                id="qbi-income-slider"
                label="QBI"
                value={qbi}
                onChange={(n) => set('qbi', n)}
                min={5000}
                max={2000000}
                logarithmic
                prefix="$"
                presets={QBI_PRESETS}
                formatValue={usdCompact}
              />
            </div>
          </div>

          <div>
            <NumberInput
              id="qbi-ti"
              label="Taxable income before the QBI deduction"
              value={taxableIncome}
              onChange={(n) => set('taxableIncome', n)}
              min={0}
              max={10000000}
              prefix="$"
              placeholder="220,000"
              helpText="Line 15 of your Form 1040 territory: income after the standard/itemized deduction but before §199A. Capital gains excluded here are subtracted from the cap in real life — we assume none."
            />
            <div className="mt-3">
              <SliderControl
                id="qbi-ti-slider"
                label="Taxable income"
                value={taxableIncome}
                onChange={(n) => set('taxableIncome', n)}
                min={0}
                max={tiMax}
                step={1000}
                prefix="$"
                presets={tiPresets}
                formatValue={(n) =>
                  `${usdCompact(n)}${
                    n === result.threshold
                      ? ' · threshold'
                      : n === result.threshold + result.phaseInRange
                        ? ' · phase-out ends'
                        : ''
                  }`
                }
              />
            </div>
          </div>

          <div>
            <NumberInput
              id="qbi-wages"
              label="W-2 wages paid by the business"
              value={w2Wages}
              onChange={(n) => set('w2Wages', n)}
              min={0}
              max={5000000}
              prefix="$"
              placeholder="40,000"
              helpText="Includes your own S-corp salary — it is not QBI, but it does count toward the wage limitation. Sole proprietors with no staff: 0."
            />
            <div className="mt-3">
              <SliderControl
                id="qbi-wages-slider"
                label="W-2 wages"
                value={w2Wages}
                onChange={(n) => set('w2Wages', n)}
                min={0}
                max={500000}
                step={1000}
                prefix="$"
                presets={WAGE_PRESETS}
                formatValue={usdCompact}
              />
            </div>
          </div>

          <NumberInput
            id="qbi-ubia"
            label="UBIA of qualified property"
            value={ubia}
            onChange={(n) => set('ubia', n)}
            min={0}
            max={10000000}
            prefix="$"
            placeholder="0"
            helpText="Original cost (not depreciated) of depreciable property held at year-end and used in the business — equipment, buildings, vehicles. Most service businesses: 0."
          />
        </div>

        <div className="mt-6 flex items-start gap-2 rounded-lg bg-slate-50 p-3 text-xs leading-relaxed text-slate-600 dark:bg-white/[0.03] dark:text-slate-300">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-slate-400 dark:text-slate-500" aria-hidden="true" />
          <p>
            Federal-only, tax year 2025. One trade or business; net capital gain assumed $0;
            qualified-loss carryforwards, aggregation and REIT/PTP income not modeled. The math
            mirrors IRS Form 8995-A line by line — see Methodology.
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
            shortTitle="QBI Deduction"
            href={HREF}
            params={{ qbi, taxableIncome, w2Wages, ubia, filing, sstb }}
          />
        </div>
      </div>

      {/* ================= Results ================= */}
      <div className="space-y-4 lg:col-span-2">
        <div className="card p-6 sm:p-8">
          <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            <BadgeDollarSign className="h-4 w-4" aria-hidden="true" />
            Your §199A deduction
          </h2>

          <div className="mt-3">
            <span
              className={`chip font-mono text-[10px] uppercase tracking-wider ${
                result.aboveThreshold
                  ? 'bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300'
                  : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300'
              }`}
            >
              {result.aboveThreshold ? 'Form 8995-A — limitation territory' : 'Form 8995 — simplified'}
            </span>
            <AnimatedNumber
              value={result.deduction}
              format={(n) => usd(n)}
              className="readout mt-2 block text-4xl font-extrabold tracking-tight text-indigo-600 dark:text-indigo-300"
            />
            <p className="mt-1 text-sm leading-relaxed text-slate-500 dark:text-slate-400">
              {limiterSentence}
            </p>
            {result.aboveThreshold && (
              <p className="readout mt-1 text-xs text-slate-500 dark:text-slate-400">
                applicable percentage {pct(result.applicablePct * 100, 1)} of SSTB income still
                counted
                {isSstb ? '' : ' (irrelevant for a non-SSTB)'} · phase-in reduction{' '}
                {pct(result.phaseInPct * 100, 1)}
              </p>
            )}
          </div>

          {/* Limitation ledger */}
          <dl className="mt-5 divide-y divide-slate-100 text-sm dark:divide-white/[0.06]">
            <LedgerRow
              label="20% of QBI (after SSTB reduction)"
              value={usd(result.tentativeDeduction)}
              muted={result.applicablePct < 1 && isSstb}
              note={
                isSstb && result.applicablePct < 1
                  ? `${usdCompact(result.qbiEffective)} of ${usdCompact(qbi)} counted`
                  : undefined
              }
            />
            <LedgerRow
              label="W-2 wage / UBIA limit"
              value={result.aboveThreshold ? usd(result.wageLimit) : 'not applied'}
              note={
                result.aboveThreshold && result.wageLimitBasis === '25-plus-ubia'
                  ? '25% wages + 2.5% UBIA branch won'
                  : result.aboveThreshold && result.wageLimitBasis === '50-percent'
                    ? '50% of W-2 wages branch won'
                    : undefined
              }
            />
            {result.phaseInReduction > 0.005 && (
              <LedgerRow
                label={`Phase-in reduction (${pct(result.phaseInPct * 100, 0)} of the excess)`}
                value={`−${usd(result.phaseInReduction)}`}
              />
            )}
            <LedgerRow label="20% of taxable income (the cap)" value={usd(result.incomeCap)} />
            <div className="flex items-center justify-between py-2.5">
              <dt className="font-medium text-slate-700 dark:text-slate-300">
                ≈ Federal income-tax value
              </dt>
              <dd className="readout text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                {usd(taxValue)}
              </dd>
            </div>
          </dl>
          <p className="mt-2 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
            Tax value = bracket tax at your taxable income minus the same tax with the deduction —
            2025 ordinary brackets for your filing status, capital-gain stacking ignored.
          </p>
        </div>

        {/* Wage rescue explainer */}
        <div className="card p-6">
          <h3 className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-slate-100">
            <Users className="h-4 w-4 text-slate-400 dark:text-slate-500" aria-hidden="true" />
            Can more W-2 wages rescue it?
          </h3>
          {!result.aboveThreshold ? (
            <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
              Not needed below the threshold — the wage limit does not apply at all, so your
              deduction is a clean 20% of QBI (capped by 20% of taxable income). Extra wages add
              nothing here; they only shrink QBI.
            </p>
          ) : result.sstbExcluded ? (
            <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
              No. Above {usdCompact(result.threshold + result.phaseInRange)} of taxable income an
              SSTB is excluded entirely — no wage level brings it back. Only taxable-income planning
              (or a non-SSTB business) does.
            </p>
          ) : result.qbiLoss ? (
            <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
              There is no positive QBI to rescue at these inputs — a qualified loss carries forward
              to future years instead.
            </p>
          ) : result.fullyUnlocked ? (
            <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
              Your wage limit ({usd(result.wageLimit, 0)}) already covers the full 20%
              ({usd(result.tentativeDeduction, 0)}) — the limit is not binding. Additional wages buy
              nothing and would reduce QBI dollar-for-dollar.
            </p>
          ) : (
            <>
              <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                Your wage limit covers{' '}
                <strong className="readout text-slate-900 dark:text-white">
                  {pct((result.wageLimit / result.tentativeDeduction) * 100, 0)}
                </strong>{' '}
                of the tentative 20%. Fully unlocking takes{' '}
                <strong className="readout text-slate-900 dark:text-white">
                  {usd(unlock ?? 0, 0)}
                </strong>{' '}
                of total W-2 wages — {usd(Math.max(0, (unlock ?? 0) - w2Wages), 0)} above your
                current {usd(w2Wages, 0)}.
              </p>
              {showRescueSlopes && (
                <p className="readout mt-2 rounded-lg bg-slate-50 p-2.5 text-xs leading-relaxed text-slate-600 dark:bg-white/[0.03] dark:text-slate-300">
                  Marginal arithmetic while the limit still binds: each extra wage dollar adds ≈
                  {pct(grossSlope * 100, 1)} of deduction holding QBI fixed; net of the QBI it
                  replaces, ≈{pct(netSlope * 100, 1)}. For an SSTB, wages count at the applicable
                  percentage ({pct(result.applicablePct * 100, 1)}), so both slopes are scaled down
                  accordingly. Wages also carry payroll tax —{' '}
                  <a
                    href="/s-corp-tax-calculator/"
                    className="font-medium text-indigo-600 underline dark:text-indigo-300"
                  >
                    the S-Corp tool
                  </a>{' '}
                  prices that layer.
                </p>
              )}
              <div className="mt-3 flex items-start gap-2 rounded-lg bg-slate-50 p-2.5 text-xs leading-relaxed text-slate-500 dark:bg-white/[0.03] dark:text-slate-400">
                <AlertTriangle
                  className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500 dark:text-amber-400"
                  aria-hidden="true"
                />
                Paying wages purely to unlock QBI is only break-even when the phase-in percentage
                clears ≈29% on the 50% branch — the guide explains the slope math.
              </div>
            </>
          )}
        </div>
      </div>

      {/* ================= Phase-out curve ================= */}
      <div className="lg:col-span-5">
        <div className="card p-5 sm:p-6">
          <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                The deduction vs taxable income
              </h3>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                Your business computed as an SSTB and as a non-SSTB at the same QBI
                ({usdCompact(qbi)}), wages ({usdCompact(w2Wages)}) and UBIA ({usdCompact(ubia)}).
              </p>
            </div>
            <span className="readout rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600 dark:bg-white/[0.05] dark:text-slate-300">
              now: {usdCompact(taxableIncome)} →{' '}
              <span className="text-indigo-600 dark:text-indigo-300">{usd(result.deduction, 0)}</span>
            </span>
          </div>
          <ComparisonChart
            series={[
              {
                label: 'Non-SSTB business',
                color: '#0ea5e9',
                points: sweep.map((p) => ({ x: p.ti, y: p.nonSstb })),
              },
              {
                label: 'SSTB (specified service)',
                color: '#e11d48',
                points: sweep.map((p) => ({ x: p.ti, y: p.sstb })),
              },
            ]}
            xLabel="Taxable income before QBI deduction"
            yLabel="QBI deduction"
            xFormat={(n) => usdCompact(n)}
            yFormat={(n) => usdCompact(n)}
            height={300}
            marker={{
              x: clamp(taxableIncome, sweep[0].ti, sweep[sweep.length - 1].ti),
              label: 'your income',
            }}
            caption="Both lines sit at the full 20% below the threshold. Inside the phase-in range the non-SSTB line sags toward its wage-limit floor while the SSTB line compounds both reductions and dies to zero at the top of the range — above it only the wage-limited non-SSTB floor survives. Recomputed point-by-point from the same Form 8995-A machinery as the headline number."
          />
        </div>
      </div>

      {/* ================= Wage rescue curve ================= */}
      <div className="lg:col-span-5">
        <div className="card p-5 sm:p-6">
          <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Payroll as a lever: deduction vs W-2 wages
              </h3>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                At your current taxable income ({usdCompact(taxableIncome)}) and QBI, holding both
                fixed — the pure effect of putting the business on payroll.
              </p>
            </div>
            {unlock !== null && (
              <span className="readout rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600 dark:bg-white/[0.05] dark:text-slate-300">
                unlock point: {usdCompact(unlock)} of wages
              </span>
            )}
          </div>
          <ComparisonChart
            series={[
              {
                label: '§199A deduction',
                color: '#6366f1',
                points: wSweep.map((p) => ({ x: p.wages, y: p.deduction })),
                fillTo: 0,
              },
            ]}
            xLabel="W-2 wages paid by the business"
            yLabel="QBI deduction"
            xFormat={(n) => usdCompact(n)}
            yFormat={(n) => usdCompact(n)}
            height={260}
            marker={{ x: clamp(w2Wages, 0, wageMax), label: 'your wages' }}
            caption="The curve rises at the wage-limit slope and flats out the moment the limit covers the full 20%: 50% of wages × the phase-in percentage inside the band, a clean 50% above it — and for an SSTB both slopes shrink again by the applicable percentage, because Schedule A trims its wages before the limit sees them. This holds QBI fixed; in reality every wage dollar also shrinks QBI, which is why the net slope is shallower still — and why wages only make sense alongside the payroll-tax cost the S-Corp calculator models."
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

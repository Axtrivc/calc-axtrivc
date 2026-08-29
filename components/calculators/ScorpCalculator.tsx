'use client';

import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Info, RotateCcw, Scale } from 'lucide-react';
import NumberInput, { AnimatedNumber, CopyButton, SliderControl } from '@/components/NumberInput';
import ScenarioButtons from '@/components/ScenarioButtons';
import ComparisonChart from '@/components/ComparisonChart';
import {
  compareScorp,
  breakevenPayrollCost,
  salarySweep,
  SCORP_CONSTANTS,
} from '@/lib/scorp';
import { usd, usdCompact, pct, clamp } from '@/lib/format';
import { useWorkbenchInputs, recordRecent } from '@/lib/workbench';

const SLUG = 's-corp-tax-calculator';
const HREF = '/s-corp-tax-calculator/';
const DEFAULTS = { profit: 200000, salary: 80000, payrollCost: SCORP_CONSTANTS.defaultPayrollCost };

const PROFIT_PRESETS = [80000, 150000, 250000, 500000];

/** Salary presets express the reasonable-salary decision as a share of profit. */
const SALARY_RATIOS = [0.3, 0.4, 0.5, 0.6] as const;

export default function ScorpCalculator() {
  const { values, set, reset } = useWorkbenchInputs(SLUG, DEFAULTS);
  const { profit, salary, payrollCost } = values;

  useEffect(() => {
    recordRecent(SLUG);
  }, []);

  const result = useMemo(() => compareScorp(profit, salary, payrollCost), [profit, salary, payrollCost]);
  const breakeven = useMemo(
    () => breakevenPayrollCost(profit, salary),
    [profit, salary],
  );
  const sweep = useMemo(() => salarySweep(profit, payrollCost), [profit, payrollCost]);

  // Keep the salary slider's ceiling glued to the profit level.
  const salaryMax = Math.max(10000, profit);
  const salaryPct = profit > 0 ? (salary / profit) * 100 : 0;

  function resetAll() {
    reset();
  }

  const scorpWins = result.winner === 'scorp';
  const copySummary = `S-Corp vs LLC at ${usd(profit, 0)} profit: ${
    scorpWins ? 'S-Corp' : 'LLC'
  } keeps ${usd(result.delta)} more per year (${scorpWins ? 'after' : 'before'} payroll costs of ${usd(payrollCost, 0)}/yr). Salary modeled: ${usd(salary, 0)}.`;

  return (
    <div className="grid gap-6 lg:grid-cols-5">
      {/* ================= Inputs ================= */}
      <div className="card p-6 sm:p-8 lg:col-span-3">
        <div className="space-y-6">
          <div>
            <NumberInput
              id="scorp-profit"
              label="Net business profit (before paying yourself)"
              value={profit}
              onChange={(n) => set('profit', n)}
              min={0}
              max={10000000}
              prefix="$"
              placeholder="200,000"
              helpText="What the business earns after ordinary operating expenses — the pool both structures split."
            />
            <div className="mt-3">
              <SliderControl
                id="scorp-profit-slider"
                label="Annual profit"
                value={profit}
                onChange={(n) => set('profit', n)}
                min={0}
                max={2000000}
                step={5000}
                prefix="$"
                logarithmic
                presets={PROFIT_PRESETS}
              />
            </div>
          </div>

          <div>
            <NumberInput
              id="scorp-salary"
              label="Reasonable W-2 salary (S-Corp side)"
              value={salary}
              onChange={(n) => set('salary', clamp(n, 0, Math.max(10000, profit)))}
              min={0}
              max={salaryMax}
              prefix="$"
              placeholder="80,000"
              helpText="What similar businesses pay for your role. The IRS requires this to be defensible — the guide below covers the factors."
            />
            <div className="mt-3">
              <SliderControl
                id="scorp-salary-slider"
                label="Salary"
                value={clamp(salary, 0, salaryMax)}
                onChange={(n) => set('salary', n)}
                min={0}
                max={salaryMax}
                step={Math.max(500, Math.round(salaryMax / 200 / 500) * 500)}
                prefix="$"
                presets={SALARY_RATIOS.map((r) => Math.round((profit * r) / 500) * 500)}
                formatValue={(n) => (profit > 0 ? `${usdCompact(n)} · ${pct((n / profit) * 100, 0)} of profit` : usdCompact(n))}
              />
            </div>
          </div>

          <div>
            <NumberInput
              id="scorp-payroll-cost"
              label="Annual payroll & compliance overhead"
              value={payrollCost}
              onChange={(n) => set('payrollCost', n)}
              min={0}
              max={100000}
              prefix="$"
              placeholder="1,200"
              helpText={`Payroll service, extra 1120-S filing, FUTA/SUTA. Default ${usd(SCORP_CONSTANTS.defaultPayrollCost, 0)} is a typical solo S-Corp baseline.`}
            />
          </div>
        </div>

        <div className="mt-6 flex items-start gap-2 rounded-lg bg-slate-50 p-3 text-xs leading-relaxed text-slate-600 dark:bg-white/[0.03] dark:text-slate-300">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-slate-400 dark:text-slate-500" aria-hidden="true" />
          <p>
            Federal-only, single filer, tax year 2025 — no state income tax or state unemployment.
            Distributions are the profit left after salary, employer FICA and overhead
            ({usd(result.scorp.k1Income, 0)} here).
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
            shortTitle="S-Corp Salary"
            href={HREF}
            params={{ profit, salary, payrollCost }}
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
              {scorpWins ? 'S-Corp keeps more' : result.winner === 'llc' ? 'LLC keeps more' : 'Dead heat'}
            </div>
            <AnimatedNumber
              value={result.delta}
              format={(n) => usd(n)}
              className={`readout mt-1 block text-4xl font-extrabold tracking-tight ${
                scorpWins ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
              }`}
            />
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              per year after all federal tax
              {scorpWins ? ' and payroll overhead' : ''}.
            </p>
          </div>

          {/* Side-by-side ledger */}
          <dl className="mt-5 divide-y divide-slate-100 text-sm dark:divide-white/[0.06]">
            <LedgerRow
              label="Payroll / SE tax"
              llc={usd(result.llc.seTax)}
              scorp={usd(result.scorp.payrollTax)}
            />
            <LedgerRow
              label="Federal income tax"
              llc={usd(result.llc.incomeTax)}
              scorp={usd(result.scorp.incomeTax)}
            />
            <LedgerRow
              label="Payroll overhead"
              llc={usd(0)}
              scorp={usd(result.scorp.payrollCost)}
            />
            <LedgerRow
              label="QBI deduction claimed"
              llc={usd(result.llc.qbiDeduction)}
              scorp={usd(result.scorp.qbiDeduction)}
            />
            <div className="flex items-center justify-between py-2.5">
              <dt className="font-medium text-slate-700 dark:text-slate-300">You keep</dt>
              <dd className="flex items-baseline gap-2">
                <span className="readout text-sm font-semibold text-slate-500 dark:text-slate-400">
                  {usd(result.llc.afterTax)}
                </span>
                <span
                  className={`readout text-lg font-bold ${
                    scorpWins ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400 dark:text-slate-500'
                  }`}
                >
                  {usd(result.scorp.afterTax)}
                </span>
              </dd>
            </div>
          </dl>
          <p className="mt-2 text-right font-mono text-[10px] uppercase tracking-wider text-slate-400 dark:text-slate-500">
            LLC · S-Corp
          </p>
        </div>

        {/* Breakeven overhead */}
        <div className="card p-6">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            How much overhead can the S-Corp carry?
          </h3>
          {breakeven !== null && scorpWins ? (
            <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
              The S-Corp stays ahead until payroll &amp; compliance overhead reaches{' '}
              <strong className="readout text-slate-900 dark:text-white">{usd(breakeven, 0)}/yr</strong>{' '}
              <span className="text-slate-500 dark:text-slate-400">
                ({usd(breakeven / 12, 0)}/mo) — about {pct((breakeven / profit) * 100, 1)} of profit.
              </span>
            </p>
          ) : scorpWins ? (
            <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
              The S-Corp stays ahead across the entire modeled overhead range (up to $100k/yr).
            </p>
          ) : (
            <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
              At this salary the payroll-tax savings never outrun the overhead — no breakeven exists.
            </p>
          )}
          <div className="mt-3 flex items-start gap-2 rounded-lg bg-slate-50 p-2.5 text-xs leading-relaxed text-slate-500 dark:bg-white/[0.03] dark:text-slate-400">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500 dark:text-amber-400" aria-hidden="true" />
            Salary below what the market pays for your role is not a real option — the IRS treats
            under-paid salaries as disguised distributions. Use the guide&apos;s factors, not the slider&apos;s
            left edge.
          </div>
        </div>
      </div>

      {/* ================= Salary sensitivity ================= */}
      <div className="lg:col-span-5">
        <div className="card p-5 sm:p-6">
          <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Advantage vs salary level
              </h3>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                After-tax edge of the S-Corp at {usd(profit, 0)} profit and {usd(payrollCost, 0)}/yr
                overhead, as the salary moves.
              </p>
            </div>
            <span className="readout rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600 dark:bg-white/[0.05] dark:text-slate-300">
              now: salary {pct(salaryPct, 0)} of profit →{' '}
              <span className={result.delta >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}>
                {result.winner === 'scorp' ? '+' : '−'}
                {usd(result.delta)}
              </span>
            </span>
          </div>
          <ComparisonChart
            series={[
              {
                label: 'S-Corp after-tax advantage (per year)',
                color: '#6366f1',
                points: sweep.map((s) => ({ x: s.salary, y: s.delta })),
                fillTo: 0,
              },
            ]}
            xLabel="Reasonable salary"
            yLabel="S-Corp advantage / yr"
            xFormat={(n) => usdCompact(n)}
            yFormat={(n) => usdCompact(n)}
            yMinMode="auto"
            height={280}
            marker={{ x: clamp(salary, sweep[0].salary, sweep[sweep.length - 1].salary), label: 'your salary' }}
            caption="Every point is the full comparison recomputed — not a linear approximation. Above the zero line the S-Corp wins; below it, the LLC does. The curve only slopes one way: the larger the defensible salary, the smaller the payroll-tax arbitrage."
          />
        </div>
      </div>
    </div>
  );
}

function LedgerRow({ label, llc, scorp }: { label: string; llc: string; scorp: string }) {
  return (
    <div className="flex items-center justify-between py-2.5">
      <dt className="text-slate-600 dark:text-slate-300">{label}</dt>
      <dd className="readout text-sm font-semibold text-slate-900 dark:text-slate-100">
        <span className="text-slate-500 dark:text-slate-400">{llc}</span>
        <span className="mx-2 text-slate-300 dark:text-slate-600">/</span>
        {scorp}
      </dd>
    </div>
  );
}

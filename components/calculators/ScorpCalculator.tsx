'use client';

import { useEffect, useMemo } from 'react';
import { AlertTriangle, Info, RotateCcw, Scale, SlidersHorizontal } from 'lucide-react';
import NumberInput, { AnimatedNumber, CopyButton, SliderControl } from '@/components/NumberInput';
import ScenarioButtons from '@/components/ScenarioButtons';
import ComparisonChart from '@/components/ComparisonChart';
import {
  compareScorpFull,
  breakevenPayrollCostFull,
  salarySweepFull,
  SCORP_FULL_CONSTANTS as SC,
} from '@/lib/scorpfull';
import { usd, usdCompact, pct, clamp } from '@/lib/format';
import { useWorkbenchInputs, recordRecent } from '@/lib/workbench';

const SLUG = 's-corp-tax-calculator';
const HREF = '/s-corp-tax-calculator/';
/** sstb is stored as 0/1 so the whole state stays Record<string, number>. */
const DEFAULTS = { profit: 200000, salary: 80000, payrollCost: SC.defaultPayrollCost, sstb: 0 };

const PROFIT_PRESETS = [50_000, 80_000, 150_000, 250_000, 500_000];

export default function ScorpCalculator() {
  const { values, set, reset } = useWorkbenchInputs(SLUG, DEFAULTS);
  const { profit, salary, payrollCost, sstb } = values;
  const isSstb = sstb === 1;

  useEffect(() => {
    recordRecent(SLUG);
  }, []);

  // Full TY2025 model: §199A via Form 8995-A (wage limit + SSTB phase-out),
  // $15,750 standard deduction, Additional Medicare on both columns.
  const result = useMemo(
    () => compareScorpFull(profit, salary, payrollCost, isSstb),
    [profit, salary, payrollCost, isSstb],
  );
  const breakeven = useMemo(
    () => breakevenPayrollCostFull(profit, salary, isSstb),
    [profit, salary, isSstb],
  );
  const sweep = useMemo(
    () => salarySweepFull(profit, payrollCost, isSstb),
    [profit, payrollCost, isSstb],
  );

  // Keep the salary slider's ceiling glued to the profit level. The model caps
  // salary at profit independently and reports it via `salaryCapped` below —
  // deep links and stored inputs can still arrive with salary > profit.
  const salaryMax = Math.max(10000, profit);
  const effectiveSalary = result.salaryEffective;
  const salaryPct = profit > 0 ? (effectiveSalary / profit) * 100 : 0;

  function resetAll() {
    reset();
  }

  const scorpWins = result.winner === 'scorp';
  const llcWins = result.winner === 'llc';
  // The delta is always net of every cost in each column (S-Corp: payroll tax,
  // income tax, overhead; LLC: SE tax, additional Medicare, income tax).
  const verdictSentence =
    result.winner === 'tie'
      ? `a dead heat — both structures keep the same amount (payroll overhead ${usd(payrollCost, 0)}/yr)`
      : `${result.winner === 'scorp' ? 'S-Corp' : 'LLC'} keeps ${usd(result.delta)} more per year after all federal tax and payroll overhead of ${usd(payrollCost, 0)}/yr`;
  const copySummary = `S-Corp vs LLC at ${usd(profit, 0)} profit: ${verdictSentence}. Salary modeled ${usd(effectiveSalary, 0)}${
    result.salaryCapped ? ' (entered salary capped at profit)' : ''
  }${isSstb ? ' · SSTB §199A treatment' : ''}. TY2025 federal model, §199A per Form 8995-A.`;

  // Sensitivity-chart marker: honest about being pinned at the edge when the
  // user's salary sits outside the 15–90% scan range.
  const sweepLo = sweep.length ? sweep[0].salary : 0;
  const sweepHi = sweep.length ? sweep[sweep.length - 1].salary : 0;
  const salaryOnScale = salary >= sweepLo - 1e-9 && salary <= sweepHi + 1e-9;

  return (
    <div className="grid gap-6 lg:grid-cols-5">
      {/* ================= Inputs ================= */}
      <div className="card p-6 sm:p-8 lg:col-span-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
          Model inputs
        </h2>
        <div className="mt-6 space-y-6">
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
                max={10000000}
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
                formatValue={(n) => (profit > 0 ? `${usdCompact(n)} · ${pct((n / profit) * 100, 0)} of profit` : usdCompact(n))}
                helpText="No percentage presets here on purpose: a defensible salary is set by market evidence for your role, not by a share of profit — the checklist in the guide below walks the factors."
              />
            </div>
            {result.salaryCapped && (
              <p className="mt-2 flex items-start gap-2 rounded-lg bg-amber-50 p-2.5 text-xs leading-relaxed text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500 dark:text-amber-400" aria-hidden="true" />
                Wages cannot exceed the profit being split — the model is running your{' '}
                {usd(salary, 0)} entry as <strong className="font-semibold">{usd(effectiveSalary, 0)}</strong>{' '}
                (capped at profit). Raise profit or lower the salary to model what you intend.
              </p>
            )}
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
              helpText={`Payroll service, extra 1120-S filing, FUTA/SUTA. Default ${usd(SC.defaultPayrollCost, 0)} is a typical solo S-Corp baseline.`}
            />
          </div>

          {/* SSTB — decides whether §199A phases the QBI deduction out entirely
              above $197,300 of taxable income (Form 8995-A Schedule A). */}
          <div>
            <span className="label" id="scorp-sstb-label">
              Is the business a specified service trade or business (SSTB)?
            </span>
            <div className="mt-2 flex gap-1.5" role="group" aria-labelledby="scorp-sstb-label">
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
                    className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition duration-150 focus-calm ${
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
              Health, law, accounting, consulting, financial services and similar fields phase the QBI
              deduction out above $197,300 of taxable income — for an SSTB the S-Corp&apos;s QBI dies too.
            </p>
          </div>
        </div>

        <div className="mt-6 flex items-start gap-2 rounded-lg bg-slate-50 p-3 text-xs leading-relaxed text-slate-600 dark:bg-white/[0.03] dark:text-slate-300">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-slate-400 dark:text-slate-500" aria-hidden="true" />
          <p>
            Federal-only, single filer, tax year 2025 — {usd(SC.stdDeduction, 0)} standard deduction
            (post-OBBBA), {usd(SC.ssWageBase, 0)} SS wage base, 0.9% Additional Medicare on both
            columns, §199A per Form 8995-A. Distributions are the profit left after salary, employer
            FICA and overhead ({usd(result.scorp.k1Income, 0)} here).
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
            params={{ profit, salary, payrollCost, sstb }}
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
              {scorpWins
                ? 'S-Corp keeps more'
                : llcWins
                  ? 'LLC keeps more'
                  : 'Dead heat — either structure'}
            </div>
            <AnimatedNumber
              value={result.delta}
              format={(n) => usd(n)}
              className={`readout mt-1 block text-4xl font-extrabold tracking-tight ${
                scorpWins
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : llcWins
                    ? 'text-rose-600 dark:text-rose-400'
                    : 'text-slate-700 dark:text-slate-200'
              }`}
            />
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              per year after federal tax and payroll overhead.
            </p>
          </div>

          {/* Side-by-side ledger */}
          <dl className="mt-5 divide-y divide-slate-100 text-sm dark:divide-white/[0.06]">
            <LedgerRow
              label="Payroll / SE tax (15.3% layer)"
              llc={usd(result.llc.seTax)}
              scorp={usd(result.scorp.payrollTax - result.scorp.addlMedicareTax)}
            />
            <LedgerRow
              label="Additional Medicare (0.9%)"
              llc={usd(result.llc.addlMedicareTax)}
              scorp={usd(result.scorp.addlMedicareTax)}
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
                    scorpWins ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-500 dark:text-slate-400'
                  }`}
                >
                  {usd(result.scorp.afterTax)}
                </span>
              </dd>
            </div>
          </dl>
          <p className="mt-2 text-right font-mono text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400">
            LLC · S-Corp
          </p>
          {result.llc.qbiLimiter === 'wage' && (
            <p className="mt-3 flex items-start gap-2 rounded-lg bg-amber-50 p-2.5 text-xs leading-relaxed text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500 dark:text-amber-400" aria-hidden="true" />
              §199A W-2 wage limit engaged: above $197,300 of taxable income the QBI deduction needs
              payroll. The wage-less LLC claims {usd(result.llc.qbiDeduction, 0)} here;{' '}
              {result.scorp.qbiLimiter === 'wage' ? (
                <>
                  the S-Corp&apos;s salary only partly covers the limit — its deduction is also
                  trimmed to {usd(result.scorp.qbiDeduction, 0)} of a full{' '}
                  {usd(result.scorp.qbiTentative, 0)} (more salary would buy more of it back, at a
                  FICA cost).
                </>
              ) : (
                <>
                  the S-Corp&apos;s salary fully covers the limit ({usd(result.scorp.qbiDeduction, 0)}{' '}
                  claimed).
                </>
              )}
            </p>
          )}
        </div>

        {/* Breakeven overhead */}
        <div className="card p-6 sm:p-8">
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
            How much overhead can the S-Corp carry?
          </h3>
          {scorpWins && breakeven !== null ? (
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
          ) : breakeven !== null ? (
            <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
              A breakeven <em>does</em> exist at{' '}
              <strong className="readout text-slate-900 dark:text-white">{usd(breakeven, 0)}/yr</strong>{' '}
              ({usd(breakeven / 12, 0)}/mo){' '}
              {payrollCost > breakeven + 1 ? (
                <>
                  — and your current overhead of {usd(payrollCost, 0)}/yr sits{' '}
                  <strong className="font-semibold">above</strong> it, which is exactly why the LLC
                  leads at these numbers. Below that line the S-Corp would be ahead.
                </>
              ) : (
                <>
                  — and your overhead of {usd(payrollCost, 0)}/yr sits right at it, which is why the
                  two columns are within noise of each other.
                </>
              )}
            </p>
          ) : (
            <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
              At this salary the payroll-tax savings never materialize — the S-Corp trails even with
              zero overhead. This happens when the salary consumes nearly all profit: there is no
              distribution slice left to arbitrage.
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
              <span
                className={
                  scorpWins
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : llcWins
                      ? 'text-rose-600 dark:text-rose-400'
                      : 'text-slate-500 dark:text-slate-400'
                }
              >
                {result.winner === 'tie' ? '±' : scorpWins ? '+' : '−'}
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
            marker={{
              x: clamp(salary, sweepLo, sweepHi),
              label: salaryOnScale
                ? 'your salary'
                : `your salary ${pct(salaryPct, 0)} — off scale`,
            }}
            caption="Every point is the full comparison recomputed — Form 8995-A included — not a linear approximation. Above the zero line the S-Corp wins; below it, the LLC does. At high profits the curve bends back upward through its middle: salary dollars cost FICA but also buy §199A wage-limit headroom above $197,300 of taxable income, so the deepest edge is not always at the lowest defensible salary."
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
        <span className="mx-2 text-slate-300 dark:text-slate-500">/</span>
        {scorp}
      </dd>
    </div>
  );
}

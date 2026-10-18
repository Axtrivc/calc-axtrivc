'use client';

import { useEffect, useMemo } from 'react';
import { AlertTriangle, CalendarClock, Info, Landmark, Percent, RotateCcw } from 'lucide-react';
import NumberInput, { AnimatedNumber, CopyButton, SliderControl } from '@/components/NumberInput';
import ScenarioButtons from '@/components/ScenarioButtons';
import ComparisonChart from '@/components/ComparisonChart';
import {
  SE_TAX_CONSTANTS,
  computeSeTax,
  ficaOnWages,
  marginalSeTaxOnNextDollar,
  normalizeSeYear,
  quarterlySeInstallment,
  sweepSeries,
  wageBaseFor,
  type SeFilingStatus,
  type SeTaxYear,
} from '@/lib/setax';
import { usd, usdCompact, pct, clamp } from '@/lib/format';
import { useWorkbenchInputs, recordRecent } from '@/lib/workbench';

const SLUG = 'self-employment-tax-calculator';
const HREF = '/self-employment-tax-calculator/';
const DEFAULTS = { profit: 120000, wages: 0, status: 0, year: 2026 };

const PROFIT_PRESETS = [50000, 120000, 250000, 500000];
const YEARS: SeTaxYear[] = [2026, 2025];

/** status is persisted as an index so workbench memory stays numeric. */
const STATUSES: { key: SeFilingStatus; label: string; short: string }[] = [
  { key: 'single', label: 'Single', short: 'Single · $200k' },
  { key: 'mfj', label: 'Married filing jointly', short: 'MFJ · $250k' },
  { key: 'mfs', label: 'Married filing separately', short: 'MFS · $125k' },
];

export default function SeTaxCalculator() {
  const { values, set, reset } = useWorkbenchInputs(SLUG, DEFAULTS);
  const { profit, wages } = values;
  const statusIdx = clamp(Math.round(values.status), 0, STATUSES.length - 1);
  const status = STATUSES[statusIdx];
  const year = normalizeSeYear(values.year);
  const wageBase = wageBaseFor(year);

  useEffect(() => {
    recordRecent(SLUG);
  }, []);

  const result = useMemo(
    () => computeSeTax(profit, wages, status.key, year),
    [profit, wages, status.key, year],
  );
  const marginal = useMemo(
    () => marginalSeTaxOnNextDollar(profit, wages, status.key, year),
    [profit, wages, status.key, year],
  );
  const fica = useMemo(() => ficaOnWages(profit, status.key, year), [profit, status.key, year]);
  const quarterly = useMemo(() => quarterlySeInstallment(result.totalSeTax), [result.totalSeTax]);

  // Sweep the whole income band around the current point, wide enough that the
  // Social Security bend stays visible even at low profit levels.
  const chartMax = useMemo(
    () => Math.max(400000, Math.ceil((Math.max(0, profit) * 1.25) / 50000) * 50000),
    [profit],
  );
  const sweep = useMemo(
    () => sweepSeries(0, chartMax, 81, Math.max(0, wages), status.key, year),
    [chartMax, wages, status.key, year],
  );

  const cents = (n: number) => `${(n * 100).toFixed(2)}¢`;
  const kink = result.capKinkNetProfit;
  const underFloor = result.base > 0 && !result.applies;
  // The $400 floor is a cliff: the crossing dollar carries the whole base
  // turning on (~$61), not a per-dollar rate. Flag it instead of looking
  // like a bug next to the "ceiling is 14.13¢" sentence.
  const atFloorCliff = marginal.total > 0.2;

  const copySummary = `Self-employment tax on ${usd(profit, 0)} of net profit (tax year ${year}, ${
    status.label
  }, ${wages > 0 ? `${usd(wages, 0)} W-2 wages, ` : ''}2025/2026 federal rules): ${usd(
    result.totalSeTax,
  )} — SS ${usd(result.ssPart)}, Medicare ${usd(result.medicarePart)}, Additional Medicare ${usd(
    result.additionalPart,
  )}. Deductible half: ${usd(result.halfDeduction)}. Quarterly SE layer ≈ ${usd(quarterly)}.`;

  return (
    <div className="grid gap-6 lg:grid-cols-5">
      {/* ================= Inputs ================= */}
      <div className="card p-6 sm:p-8 lg:col-span-3">
        <div className="space-y-6">
          <div>
            <NumberInput
              id="setax-profit"
              label="Net self-employment profit (Schedule C)"
              value={profit}
              onChange={(n) => set('profit', n)}
              min={0}
              max={10000000}
              prefix="$"
              placeholder="120,000"
              helpText="Business revenue minus ordinary expenses — before SE tax and before income tax."
            />
            <div className="mt-3">
              <SliderControl
                id="setax-profit-slider"
                label="Annual net profit"
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
              id="setax-wages"
              label="Your W-2 wages from a day job (optional)"
              value={wages}
              onChange={(n) => set('wages', n)}
              min={0}
              max={500000}
              prefix="$"
              placeholder="0"
              helpText={`Your own Social Security wages shrink the ${usdCompact(
                wageBase,
              )} wage-base room, and your Medicare wages count toward the 0.9% threshold. For MFJ, enter your wages only — a spouse's wages are not modeled (Form 8959 tests each spouse's own wages + SE income against the $250k threshold).`}
            />
            <div className="mt-3">
              <SliderControl
                id="setax-wages-slider"
                label="W-2 wages"
                value={wages}
                onChange={(n) => set('wages', n)}
                min={0}
                max={500000}
                step={1000}
                prefix="$"
                presets={[0, 50000, 100000, wageBase]}
                formatValue={(n) => usdCompact(n)}
              />
            </div>
          </div>

          <div>
            <span id="setax-status-label" className="label">
              Filing status — sets the 0.9% Additional Medicare threshold
            </span>
            <div
              className="mt-2 flex flex-wrap gap-2"
              role="group"
              aria-labelledby="setax-status-label"
            >
              {STATUSES.map((s, i) => {
                const active = i === statusIdx;
                return (
                  <button
                    key={s.key}
                    type="button"
                    aria-pressed={active}
                    onClick={() => set('status', i)}
                    className={`focus-calm rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all duration-150 ${
                      active
                        ? 'border border-indigo-500 bg-indigo-50 text-indigo-700 dark:border-indigo-400 dark:bg-indigo-500/15 dark:text-indigo-300'
                        : 'border border-slate-200 bg-white text-slate-500 hover:border-indigo-300 hover:text-indigo-600 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-400 dark:hover:border-indigo-400/50 dark:hover:text-indigo-300'
                    }`}
                  >
                    {s.short}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <span id="setax-year-label" className="label">
              Tax year — sets the Social Security wage base
            </span>
            <div
              className="mt-2 flex flex-wrap gap-2"
              role="group"
              aria-labelledby="setax-year-label"
            >
              {YEARS.map((y) => {
                const active = y === year;
                return (
                  <button
                    key={y}
                    type="button"
                    aria-pressed={active}
                    onClick={() => set('year', y)}
                    className={`focus-calm rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all duration-150 ${
                      active
                        ? 'border border-indigo-500 bg-indigo-50 text-indigo-700 dark:border-indigo-400 dark:bg-indigo-500/15 dark:text-indigo-300'
                        : 'border border-slate-200 bg-white text-slate-500 hover:border-indigo-300 hover:text-indigo-600 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-400 dark:hover:border-indigo-400/50 dark:hover:text-indigo-300'
                    }`}
                  >
                    {y} · {usdCompact(wageBaseFor(y))}
                  </button>
                );
              })}
            </div>
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
              The wage base is the only parameter that moved ($184,500 in 2026 vs $176,100 in 2025);
              the 0.9% thresholds are not inflation-indexed and are identical both years.
            </p>
          </div>
        </div>

        <div className="mt-6 flex items-start gap-2 rounded-lg bg-slate-50 p-3 text-xs leading-relaxed text-slate-600 dark:bg-white/[0.03] dark:text-slate-300">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-slate-400 dark:text-slate-500" aria-hidden="true" />
          <p>
            Federal SE tax layer only (Schedule SE + Form 8959), tax year {year} — income tax is a
            separate layer this tool deliberately does not mix in. Half of the result
            ({usd(result.halfDeduction)} here) deducts from income tax later.
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
            shortTitle="SE Tax"
            href={HREF}
            params={{ profit, wages, status: statusIdx, year }}
          />
        </div>
      </div>

      {/* ================= Results ================= */}
      <div className="space-y-4 lg:col-span-2">
        <div className="card p-6 sm:p-8">
          <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            <Landmark className="h-4 w-4" aria-hidden="true" />
            Self-employment tax
          </h2>
          <div className="mt-3">
            <AnimatedNumber
              value={result.totalSeTax}
              format={(n) => usd(n)}
              className="readout mt-1 block text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white"
            />
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              on {usd(profit, 0)} of net profit ({year}) — effective{' '}
              {pct(result.effectiveRateOnNet, 2)} of profit
            </p>
          </div>

          <dl className="mt-5 divide-y divide-slate-100 text-sm dark:divide-white/[0.06]">
            <Row
              label="SE tax base (92.35% × profit)"
              value={usd(result.base)}
              note={underFloor ? 'below the $400 floor' : undefined}
            />
            <Row
              label={`Social Security — 12.4% × min(base, ${usdCompact(result.ssRoom)} room)`}
              value={usd(result.ssPart)}
            />
            <Row label="Medicare — 2.9% × base (no cap)" value={usd(result.medicarePart)} />
            <Row
              label={`Additional Medicare — 0.9% over ${usdCompact(result.threshold)} (your wages + this income)`}
              value={usd(result.additionalPart)}
            />
            <div className="flex items-center justify-between py-2.5">
              <dt className="font-medium text-slate-700 dark:text-slate-300">Total SE tax</dt>
              <dd className="readout text-base font-bold text-slate-900 dark:text-white">
                {usd(result.totalSeTax)}
              </dd>
            </div>
            <Row label="Deductible half (§164(f))" value={`− ${usd(result.halfDeduction)}`} />
            <Row label="Quarterly installment (SE layer)" value={`≈ ${usd(quarterly)}`} />
          </dl>

          {/* Wage-base context */}
          <div className="mt-4 flex items-start gap-2 rounded-lg bg-slate-50 p-2.5 text-xs leading-relaxed text-slate-500 dark:bg-white/[0.03] dark:text-slate-400">
            <CalendarClock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-indigo-400 dark:text-indigo-300" aria-hidden="true" />
            <p>
              {wages > 0 && result.ssRoom <= 0 ? (
                <>
                  Your W-2 wages already cover the {usdCompact(wageBase)} wage base ({year}) — every
                  SE dollar carries Medicare only.
                </>
              ) : kink !== null ? (
                <>
                  Social Security caps out at{' '}
                  <strong className="text-slate-700 dark:text-slate-200">{usd(kink, 0)}</strong> of
                  net profit
                  {wages > 0 ? ` (your ${usd(wages, 0)} of W-2 wages leave only ${usd(result.ssRoom, 0)} of wage-base room)` : ''}
                  . Beyond that, extra profit carries Medicare only.
                </>
              ) : null}
              {underFloor && ' Net earnings are under $400 — no SE tax at all on this income.'}
            </p>
          </div>
        </div>

        {/* Per-dollar marginal view */}
        <div className="card p-6 sm:p-8">
          <h3 className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-slate-100">
            <Percent className="h-4 w-4 text-indigo-500 dark:text-indigo-300" aria-hidden="true" />
            The next $1 you earn costs
          </h3>
          <div className="mt-3 grid grid-cols-2 gap-2 text-center sm:grid-cols-4">
            <MarginalTile label="SS 12.4%" value={cents(marginal.ss)} />
            <MarginalTile label="Med 2.9%" value={cents(marginal.medicare)} />
            <MarginalTile label="0.9%" value={cents(marginal.additional)} />
            <MarginalTile label="Total" value={cents(marginal.total)} emphasize />
          </div>
          {atFloorCliff ? (
            <div className="mt-3 flex items-start gap-2 rounded-lg bg-amber-50 p-2.5 text-xs leading-relaxed text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <p>
                You are at the {usd(SE_TAX_CONSTANTS.minNetEarnings, 0)} net-earnings floor: this
                next dollar is the first taxed dollar, so it carries the entire base switching on
                ({usd(marginal.total)} of tax on $1). One dollar later the rate falls back to at
                most 14.13¢ per $1 — the floor is a statutory cliff, not a spike in your rates.
              </p>
            </div>
          ) : (
            <p className="mt-3 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
              Per $1 of net profit at these inputs — {pct(marginal.total * 100, 2)}. Under the
              Social Security room the ceiling is 14.13¢ ($1 × 92.35% × 15.3%); once only Medicare
              layers apply it drops to 2.68¢, or 3.51¢ where the 0.9% layer is live.
            </p>
          )}
        </div>

        {/* W-2 comparison */}
        <div className="card p-6 sm:p-8">
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
            Versus a W-2 job at the same gross
          </h3>
          <dl className="mt-3 divide-y divide-slate-100 text-sm dark:divide-white/[0.06]">
            <Row label="W-2 employee share (withheld)" value={usd(fica.employeeShare)} />
            <Row label="W-2 both halves (true employer cost)" value={usd(fica.combinedCost)} />
            <Row label="Self-employment tax" value={usd(result.totalSeTax)} />
          </dl>
          <p className="mt-3 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
            SE tax is{' '}
            <span className="font-semibold text-emerald-600 dark:text-emerald-400">
              {usd(fica.combinedCost - result.totalSeTax)} less
            </span>{' '}
            than both FICA halves on the same gross — the 92.35% base haircut at work (the 0.9%
            layer narrows the gap above the threshold but never erases it, because the SE side pays
            0.9% on a haircut base) — though {usd(result.totalSeTax - fica.employeeShare)} more than
            the half an employee sees withheld.
          </p>
        </div>
      </div>

      {/* ================= SE tax curve ================= */}
      <div className="lg:col-span-5">
        <div className="card p-5 sm:p-6">
          <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                The SE tax curve, and where it bends
              </h3>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                Total tax on net profit from $0 to {usdCompact(chartMax)} at your current W-2 wages
                ({usdCompact(wages)}), filing status ({status.label}), tax year {year}.
              </p>
            </div>
            <span className="readout rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600 dark:bg-white/[0.05] dark:text-slate-300">
              at {usd(profit, 0)}: <span className="text-indigo-600 dark:text-indigo-300">{usd(result.totalSeTax)}</span>
            </span>
          </div>
          <ComparisonChart
            series={[
              {
                label: 'Self-employment tax',
                color: '#6366f1',
                points: sweep.map((p) => ({ x: p.net, y: p.seTotal })),
                fillTo: 0,
              },
              {
                label: 'W-2 employee share (withheld)',
                color: '#0ea5e9',
                points: sweep.map((p) => ({ x: p.net, y: p.employeeShare })),
                dashed: true,
              },
              {
                label: 'W-2 both halves (employer cost)',
                color: '#10b981',
                points: sweep.map((p) => ({ x: p.net, y: p.combinedCost })),
                dashed: true,
              },
            ]}
            xLabel="Net self-employment profit"
            yLabel="Payroll tax / yr"
            xFormat={(n) => usdCompact(n)}
            yFormat={(n) => usdCompact(n)}
            height={300}
            marker={{
              x: clamp(profit, 0, chartMax),
              label: 'your profit',
            }}
            caption={
              kink !== null && result.ssRoom > 0
                ? `The indigo line bends at ${usd(kink, 0)} of net profit — where 92.35% of profit reaches the ${usdCompact(
                    wageBase,
                  )} Social Security cap for ${year}${
                    wages > 0 ? ` after your W-2 wages consumed part of the wage base` : ''
                  }. Below the bend the slope is 14.13¢/$1; above it, 2.68¢ (plus 0.9¢ where the Additional Medicare layer is live). The dashed W-2 lines bend earlier, at ${usdCompact(
                    wageBase,
                  )}, because the cap binds on gross wages with no 92.35% haircut.`
                : `With W-2 wages already covering the ${usdCompact(
                    wageBase,
                  )} wage base (${year}), the SE line never bends — every dollar carries Medicare layers only, and the gap to the dashed FICA lines keeps widening.`
            }
          />
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="flex items-start justify-between gap-3 py-2.5">
      <dt className="text-slate-600 dark:text-slate-300">
        {label}
        {note && <span className="ml-1 text-xs text-amber-700 dark:text-amber-400">({note})</span>}
      </dt>
      <dd className="readout whitespace-nowrap text-sm font-semibold text-slate-900 dark:text-slate-100">
        {value}
      </dd>
    </div>
  );
}

function MarginalTile({
  label,
  value,
  emphasize = false,
}: {
  label: string;
  value: string;
  emphasize?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border p-2.5 ${
        emphasize
          ? 'border-indigo-200 bg-indigo-50/60 dark:border-indigo-500/25 dark:bg-indigo-500/[0.08]'
          : 'border-slate-200 bg-slate-50/60 dark:border-white/[0.08] dark:bg-white/[0.03]'
      }`}
    >
      <div
        className={`text-[10px] font-semibold uppercase tracking-wide ${
          emphasize ? 'text-indigo-600 dark:text-indigo-300' : 'text-slate-500 dark:text-slate-400'
        }`}
      >
        {label}
      </div>
      <div
        className={`readout mt-0.5 text-sm font-bold ${
          emphasize ? 'text-indigo-700 dark:text-indigo-300' : 'text-slate-900 dark:text-slate-100'
        }`}
      >
        {value}
      </div>
    </div>
  );
}

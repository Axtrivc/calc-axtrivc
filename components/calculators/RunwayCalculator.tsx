'use client';

import { useEffect, useMemo } from 'react';
import { CalendarClock, Hourglass, Info, Layers, RotateCcw, TrendingDown, TrendingUp } from 'lucide-react';
import NumberInput, { AnimatedNumber, CopyButton, SliderControl, StatCard } from '@/components/NumberInput';
import ScenarioButtons from '@/components/ScenarioButtons';
import {
  breakevenGrowthThreshold,
  computeRunway,
  RUNWAY_PRESETS,
  type RunwayPreset,
  type RunwayResult,
} from '@/lib/runway';
import { usd, usdCompact, numFmt, pct } from '@/lib/format';
import { useWorkbenchInputs, recordRecent } from '@/lib/workbench';

const SLUG = 'saas-runway-calculator';

/** UI-level input shape (flat keys so every value persists + deep-links). */
type Values = { cash: number; burn: number; mrr: number; growth: number; margin: number; lag: number };

const presetValues = (p: RunwayPreset): Values => ({
  cash: p.inputs.cash,
  burn: p.inputs.grossBurn,
  mrr: p.inputs.mrr,
  growth: p.inputs.growthRate,
  margin: p.inputs.grossMargin,
  lag: p.inputs.collectionLag,
});

const DEFAULTS: Values = presetValues(RUNWAY_PRESETS[0]);

/**
 * Growth rate label: 0 decimals for whole rates, 1 for fractional steps
 * (the input steps by 0.5pp — (8.5).toFixed(0) would claim "9%").
 */
function fmtG(g: number): string {
  return Number.isInteger(g) ? pct(g, 0) : pct(g, 1);
}

/** One-line runway summary shared by the matrix and the stress test. */
function fmtRunway(r: RunwayResult): string {
  if (r.months !== null) return `${numFmt(r.monthsExact ?? r.months, 1)} mo`;
  return r.reachedProfitability ? 'Break-even' : '120+ mo';
}

export default function RunwayCalculator() {
  const { values, set, reset } = useWorkbenchInputs(SLUG, DEFAULTS);
  const { cash, burn, mrr, growth, margin, lag } = values;

  // Mark this tool as recently used for the workbench home panel.
  useEffect(() => {
    recordRecent(SLUG);
  }, []);

  // The collections stress test needs both variants regardless of the toggle.
  const onTime = useMemo(
    () => computeRunway({ cash, grossBurn: burn, mrr, growthRate: growth, grossMargin: margin, collectionLag: 0 }),
    [cash, burn, mrr, growth, margin]
  );
  const lagged = useMemo(
    () => computeRunway({ cash, grossBurn: burn, mrr, growthRate: growth, grossMargin: margin, collectionLag: 1 }),
    [cash, burn, mrr, growth, margin]
  );
  const r = lag === 1 ? lagged : onTime;

  // Month-1 cash drain on the model's own (collected) basis. Under a
  // collection lag month 1 collects nothing, so this — not initialNetBurn —
  // is the honest "are we burning cash right now?" figure. points[1] is
  // absent only in the out-of-cash-today early return, where
  // initialNetBurn > 0 by construction, so the fallback is safe.
  const firstNetBurn = r.points[1]?.netBurn ?? r.initialNetBurn;
  const cashFlowPositive = firstNetBurn <= 0;

  // Smallest growth rate at which break-even arrives before the cash does.
  const threshold = useMemo(
    () =>
      breakevenGrowthThreshold({
        cash,
        grossBurn: burn,
        mrr,
        growthRate: growth,
        grossMargin: margin,
        collectionLag: lag,
      }),
    [cash, burn, mrr, growth, margin, lag]
  );

  const setCash = (n: number) => set('cash', n);
  const setBurn = (n: number) => set('burn', n);
  const setMrr = (n: number) => set('mrr', n);
  const setGrowth = (n: number) => set('growth', n);
  const setMargin = (n: number) => set('margin', n);

  const activePreset = RUNWAY_PRESETS.find((p) => {
    const v = presetValues(p);
    return (
      v.cash === cash && v.burn === burn && v.mrr === mrr && v.growth === growth && v.margin === margin && v.lag === lag
    );
  });

  function applyPreset(p: RunwayPreset) {
    const v = presetValues(p);
    setCash(v.cash);
    setBurn(v.burn);
    setMrr(v.mrr);
    setGrowth(v.growth);
    setMargin(v.margin);
    set('lag', v.lag);
  }

  // Three distinct outcomes, not two: a finite countdown, break-even (the
  // countdown stops), and "120+ months of drift" (cash outlasts the horizon
  // without MRR ever covering burn — long, but not safe). Finite readouts show
  // the exact (interpolated) month count so they are directly comparable with
  // the naive division card — no rounding convention posing as economics.
  const isBreakeven = r.months === null && r.reachedProfitability;
  const isDrift = r.months === null && !r.reachedProfitability;
  const runwayLabel =
    r.months !== null
      ? numFmt(r.monthsExact ?? r.months, 1)
      : r.reachedProfitability
        ? '∞'
        : '120+';
  // Drift gets amber, not the break-even emerald: the caption itself warns
  // "not as safety", and the color must not contradict that warning.
  const runwayColor =
    r.months === null
      ? isDrift
        ? 'amber'
        : 'emerald'
      : (r.monthsExact ?? r.months) >= 18
        ? 'emerald'
        : (r.monthsExact ?? r.months) >= 12
          ? 'amber'
          : 'rose';

  const runwayTone =
    runwayColor === 'emerald'
      ? 'text-emerald-600 dark:text-emerald-400'
      : runwayColor === 'amber'
        ? 'text-amber-600 dark:text-amber-400'
        : 'text-rose-600 dark:text-rose-400';

  const beMrrText = Number.isFinite(r.breakevenMrr) ? usd(r.breakevenMrr, 0) : 'n/a at 0% margin';
  const gText = fmtG(growth);
  let copyText: string;
  if (r.months === null && !r.reachedProfitability) {
    copyText = `SaaS runway: 120+ months — cash outlasts the 120-month projection but MRR never covers burn, at ${gText}/mo growth · break-even MRR ${beMrrText}`;
  } else if (r.months === null) {
    const how =
      r.initialNetBurn <= 0 && lag === 0
        ? 'already cash-flow positive'
        : r.profitableAtMonth !== null
          ? `break-even at month ${r.profitableAtMonth}`
          : 'break-even within the projection';
    copyText = `SaaS runway: effectively infinite (${how}) at ${gText}/mo growth · break-even MRR ${beMrrText}`;
  } else {
    copyText = `SaaS runway: ${numFmt(r.monthsExact ?? r.months, 1)} months at ${gText}/mo growth · net burn ${usd(Math.max(0, firstNetBurn), 0)}/mo · break-even MRR ${beMrrText}`;
  }
  if (margin !== 100) copyText += ` · gross margin ${pct(margin, 0)}`;
  if (lag === 1) copyText += ' · collections lagged 1 month';

  const naiveRunway = firstNetBurn > 0 ? cash / firstNetBurn : null;

  return (
    <div className="grid gap-6 lg:grid-cols-5">
      {/* Inputs */}
      <div className="card lg:col-span-2 p-6 sm:p-8">
        <h2 className="mb-6 text-base font-semibold text-slate-900 dark:text-slate-100">Your runway inputs</h2>

        {/* Scenario presets */}
        <div role="group" aria-label="Scenario presets" className="mb-6">
          <p className="label mb-2">Start from a scenario</p>
          <div className="flex flex-wrap gap-1.5">
            {RUNWAY_PRESETS.map((p) => {
              const active = activePreset?.id === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => applyPreset(p)}
                  className={`rounded-full px-3 py-1.5 text-xs font-medium transition-all duration-150 focus-calm ${
                    active
                      ? 'border border-indigo-500 bg-indigo-50 text-indigo-700 dark:border-indigo-400 dark:bg-indigo-500/15 dark:text-indigo-300'
                      : 'border border-slate-200 bg-white text-slate-500 hover:border-indigo-300 hover:text-indigo-600 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-400 dark:hover:border-indigo-400/50 dark:hover:text-indigo-300'
                  }`}
                >
                  {p.label}
                </button>
              );
            })}
          </div>
          <p className="mt-2 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
            {activePreset
              ? activePreset.description
              : 'Custom inputs — the month-by-month math below is the same for any cash position.'}
          </p>
        </div>

        <div className="space-y-6">
          <div>
            <NumberInput
              id="cash"
              label="Cash balance"
              value={cash}
              onChange={setCash}
              min={0}
              prefix="$"
              placeholder="500000"
              helpText="Total cash + equivalents in the bank."
            />
            <div className="mt-3">
              <SliderControl
                id="cash-slider"
                label="" ariaLabel="Cash balance"
                value={cash}
                onChange={setCash}
                min={0}
                max={10000000}
                step={10000}
                prefix="$"
                logarithmic
                presets={[100000, 1000000, 5000000]}
              />
            </div>
          </div>
          <div>
            <NumberInput
              id="burn"
              label="Monthly gross burn"
              value={burn}
              onChange={setBurn}
              min={0}
              prefix="$"
              placeholder="50000"
              helpText="Total monthly cash operating expenses (salaries, infra, tools)."
            />
            <div className="mt-3">
              <SliderControl
                id="burn-slider"
                label="" ariaLabel="Monthly gross burn"
                value={burn}
                onChange={setBurn}
                min={0}
                max={1000000}
                step={1000}
                prefix="$"
                logarithmic
                presets={[25000, 100000, 250000]}
              />
            </div>
          </div>
          <div>
            <NumberInput
              id="mrr"
              label="Current MRR"
              value={mrr}
              onChange={setMrr}
              min={0}
              prefix="$"
              placeholder="10000"
              helpText="Monthly recurring revenue collected this month."
            />
            <div className="mt-3">
              <SliderControl
                id="mrr-slider"
                label="" ariaLabel="Current MRR"
                value={mrr}
                onChange={setMrr}
                min={0}
                max={500000}
                step={1000}
                prefix="$"
                logarithmic
                presets={[10000, 50000, 100000]}
              />
            </div>
          </div>
          <div>
            <NumberInput
              id="growth"
              label="Monthly MRR growth rate"
              value={growth}
              onChange={setGrowth}
              min={-20}
              max={50}
              step={0.5}
              suffix="%/mo"
              placeholder="8"
              helpText="How fast MRR compounds each month. 5–15% is strong early-stage; negative models net contraction (churn outrunning expansion)."
            />
            <div className="mt-3">
              <SliderControl
                id="growth-slider"
                label="" ariaLabel="Monthly MRR growth rate"
                value={growth}
                onChange={setGrowth}
                min={-20}
                max={50}
                step={0.5}
                suffix="%"
                presets={[-5, 5, 10, 20]}
              />
            </div>
          </div>
          <div>
            <NumberInput
              id="margin"
              label="Gross margin"
              value={margin}
              onChange={setMargin}
              min={0}
              max={100}
              step={1}
              suffix="%"
              placeholder="80"
              helpText="Share of each MRR dollar left after COGS (hosting, support, payment fees). 100% = zero COGS."
            />
            <div className="mt-3">
              <SliderControl
                id="margin-slider"
                label="" ariaLabel="Gross margin"
                value={margin}
                onChange={setMargin}
                min={0}
                max={100}
                step={5}
                suffix="%"
                presets={[60, 80, 100]}
              />
            </div>
          </div>
        </div>

        <div className="mt-6 flex items-start gap-2 rounded-lg bg-slate-50 p-3 text-xs leading-relaxed text-slate-600 dark:bg-white/[0.03] dark:text-slate-300">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-slate-400 dark:text-slate-500" aria-hidden="true" />
          <p>
            Net burn = gross burn − MRR × gross margin, so break-even MRR rises as margin falls:{' '}
            {Number.isFinite(r.breakevenMrr) ? (
              <>
                at {pct(margin, 0)} margin it takes{' '}
                <span className="readout">{usd(r.breakevenMrr, 0)}</span> of MRR to cover {usd(burn, 0)} of
                burn.
              </>
            ) : (
              'at 0% margin no amount of MRR covers burn.'
            )}{' '}
            As MRR grows, net burn shrinks — so real runway under growth is longer than the naive{' '}
            <code className="rounded bg-slate-200/70 px-1 py-0.5 font-mono text-[11px] text-indigo-700 dark:bg-white/[0.07] dark:text-indigo-300">
              cash ÷ net burn
            </code>
            estimate.
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
            shortTitle="Runway"
            href="/saas-runway-calculator/"
            params={{ cash, burn, mrr, growth, margin, lag }}
          />
        </div>
      </div>

      {/* Results + chart */}
      <div className="lg:col-span-3 space-y-4">
        <div className="card p-6 sm:p-8">
          <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            <Hourglass className="h-4 w-4" aria-hidden="true" />
            Runway remaining
            {lag === 1 && (
              <span className="ml-2 font-mono normal-case tracking-normal text-indigo-600 dark:text-indigo-300">
                · 1-mo collection lag
              </span>
            )}
          </h2>
          <div className={`mt-3 readout text-5xl font-extrabold tracking-tight ${runwayTone}`}>
            {runwayLabel}
            {(r.months !== null || isDrift) && (
              <span className="ml-2 text-xl font-semibold text-slate-500 dark:text-slate-400">months</span>
            )}
          </div>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            {r.months !== null
              ? r.months === 0
                ? 'At these inputs the cash is already gone — the runway is zero today.'
                : `Based on ${gText}/mo MRR growth, your cash runs out around month ${r.months} (the whole month at the end of the countdown; the exact figure above interpolates inside it).`
              : isBreakeven
                ? r.initialNetBurn <= 0 && lag === 0
                  ? 'You are already cash-flow positive — MRR (net of margin) covers your burn. Each month adds to your bank balance.'
                  : r.profitableAtMonth !== null
                    ? `You reach cash-flow break-even at month ${r.profitableAtMonth} as MRR overtakes burn — the countdown stops.`
                    : 'Cash-flow break-even is reached within the projection.'
                : 'Your cash outlasts the 120-month projection horizon, but MRR never covers burn either — read this as “120+ months of drift”, not as safety.'}
          </p>

          {r.months !== null && (
            <div className="mt-5">
              <div className="relative h-3 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-white/[0.06]">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${
                    runwayColor === 'emerald'
                      ? 'bg-gradient-to-r from-emerald-500 to-teal-400'
                      : runwayColor === 'amber'
                        ? 'bg-gradient-to-r from-amber-500 to-orange-400'
                        : 'bg-gradient-to-r from-rose-500 to-rose-400'
                  }`}
                  style={{ width: `${Math.min(100, ((r.monthsExact ?? r.months) / 36) * 100)}%` }}
                />
              </div>
              {/* Scale sits under the track, never on it — labels overlaid on the
                  fill bar were clipped by the track's overflow-hidden. */}
              <div className="mt-1 flex justify-between px-0.5 font-mono text-[10px] text-slate-500 dark:text-slate-400">
                <span>0</span>
                <span>12</span>
                <span>24</span>
                <span>36mo+</span>
              </div>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <StatCard
            label="Current net burn"
            value={<AnimatedNumber value={Math.max(0, firstNetBurn)} format={(n) => usd(n, 0)} />}
            sublabel={cashFlowPositive ? 'Positive cash flow!' : lag === 1 ? 'First lagged month' : 'Per month, today'}
            emphasis={cashFlowPositive}
          />
          <StatCard
            label="Break-even MRR"
            value={
              Number.isFinite(r.breakevenMrr) ? (
                <AnimatedNumber value={r.breakevenMrr} format={(n) => usd(n, 0)} />
              ) : (
                '—'
              )
            }
            sublabel={margin < 100 ? `At ${pct(margin, 0)} gross margin` : 'To cover gross burn'}
          />
          <StatCard
            label="Growth to break even"
            value={
              threshold === null
                ? '—'
                : threshold <= -20
                  ? '≤ −20%/mo'
                  : `${pct(threshold, 1)}/mo`
            }
            sublabel={
              threshold === null
                ? 'No growth rate reaches it'
                : 'Compounding that stops the countdown'
            }
          />
          <StatCard
            label="Naive runway"
            value={naiveRunway === null ? '∞' : `${numFmt(naiveRunway, 1)} mo`}
            sublabel={lag === 1 ? 'cash ÷ month-1 burn (lag on)' : 'cash ÷ net burn shortcut'}
          />
        </div>

        <CashChart r={r} />
      </div>

      {/* Combo matrix + collections stress test */}
      <div className="grid gap-4 lg:col-span-5 lg:grid-cols-5">
        <ComboMatrix cash={cash} burn={burn} mrr={mrr} growth={growth} margin={margin} lag={lag} />
        <CollectionsStress
          onTime={onTime}
          lagged={lagged}
          lag={lag}
          onToggle={() => set('lag', lag === 1 ? 0 : 1)}
          oneMonthCollections={mrr * (margin / 100)}
        />
      </div>
    </div>
  );
}

/* ===================== Combo matrix: burn cuts × growth pushes ===================== */

function ComboMatrix({
  cash,
  burn,
  mrr,
  growth,
  margin,
  lag,
}: {
  cash: number;
  burn: number;
  mrr: number;
  growth: number;
  margin: number;
  lag: number;
}) {
  const BURN_CUTS = [1, 0.9, 0.8];
  const GROWTH_PUSHES = [0, 2, 5];
  const rowLabels = ['Burn as-is', '−10% burn', '−20% burn'];

  const base = computeRunway({ cash, grossBurn: burn, mrr, growthRate: growth, grossMargin: margin, collectionLag: lag });
  const baseExact = base.monthsExact;

  return (
    <div className="card overflow-hidden lg:col-span-3">
      <div className="border-b border-slate-200 px-5 py-4 sm:px-6 dark:border-white/[0.07]">
        <h3 className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-slate-100">
          <Layers className="h-4 w-4 text-slate-400" aria-hidden="true" />
          Extend the clock: burn cuts × growth pushes
        </h3>
        <p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
          Runway months when you cut gross burn 10% / 20% (rows) or add +2 / +5pp of monthly growth
          (columns), starting from your current inputs. Deltas compare against today&rsquo;s position.
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="data-table min-w-full">
          <thead>
            <tr>
              <th scope="col">Scenario</th>
              <th scope="col" className="text-right">{fmtG(growth)} (today)</th>
              <th scope="col" className="text-right">+2pp → {fmtG(Math.min(50, growth + 2))}</th>
              <th scope="col" className="text-right">+5pp → {fmtG(Math.min(50, growth + 5))}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-white/[0.06]">
            {BURN_CUTS.map((cut, i) => (
              <tr key={cut}>
                <th scope="row" className="font-medium normal-case tracking-normal text-slate-700 dark:text-slate-300">
                  {rowLabels[i]}
                </th>
                {GROWTH_PUSHES.map((push) => {
                  const res = computeRunway({
                    cash,
                    grossBurn: burn * cut,
                    mrr,
                    growthRate: Math.min(50, growth + push),
                    grossMargin: margin,
                    collectionLag: lag,
                  });
                  return (
                    <td key={push} className="text-right">
                      <MatrixCell res={res} baseExact={baseExact} />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="border-t border-slate-100 bg-slate-50/60 px-5 py-3 text-xs leading-relaxed text-slate-500 sm:px-6 dark:border-white/[0.06] dark:bg-white/[0.02] dark:text-slate-400">
        Every cell re-runs the same month-by-month simulation. Cutting burn is linear and pays this
        month; growth compounds and back-loads its payoff — until it pushes you past break-even, where
        the countdown stops entirely.
      </p>
    </div>
  );
}

function MatrixCell({ res, baseExact }: { res: RunwayResult; baseExact: number | null }) {
  if (res.months !== null) {
    const exact = res.monthsExact ?? res.months;
    const delta = baseExact !== null ? exact - baseExact : null;
    return (
      <>
        <span className="readout block whitespace-nowrap font-semibold text-slate-800 dark:text-slate-200">
          {numFmt(exact, 1)} mo
        </span>
        {delta !== null && Math.abs(delta) >= 0.05 && (
          <span
            className={`readout block text-xs ${
              delta > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
            }`}
          >
            {delta > 0 ? '+' : ''}
            {numFmt(delta, 1)} mo
          </span>
        )}
      </>
    );
  }
  if (res.reachedProfitability) {
    return (
      <span className="chip bg-emerald-50 dark:bg-emerald-500/15 text-[11px] font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
        Break-even
      </span>
    );
  }
  return <span className="readout text-slate-500 dark:text-slate-400">120+</span>;
}

/* ===================== Collections stress test ===================== */

function CollectionsStress({
  onTime,
  lagged,
  lag,
  onToggle,
  oneMonthCollections,
}: {
  onTime: RunwayResult;
  lagged: RunwayResult;
  lag: number;
  onToggle: () => void;
  oneMonthCollections: number;
}) {
  // Cost of the lag, stated per outcome pair: months lost (exact basis), a
  // lost break-even, a drifted-away horizon, or — when both sides reach
  // break-even — how many months the lag pushes the crossing point out.
  const lagDelta =
    onTime.months !== null && lagged.months !== null && onTime.monthsExact !== null && lagged.monthsExact !== null
      ? lagged.monthsExact - onTime.monthsExact
      : null;
  let deltaText: string;
  let deltaHarm = false;
  if (lagDelta !== null) {
    deltaText = `${lagDelta > 0 ? '+' : ''}${numFmt(lagDelta, 1)} mo`;
    deltaHarm = lagDelta < -0.05;
  } else if (onTime.months === null && lagged.months !== null) {
    deltaText = onTime.reachedProfitability ? 'break-even lost' : 'drift ends';
    deltaHarm = true;
  } else if (
    onTime.months === null &&
    lagged.months === null &&
    onTime.reachedProfitability &&
    lagged.reachedProfitability &&
    onTime.profitableAtMonth !== null &&
    lagged.profitableAtMonth !== null
  ) {
    const delay = lagged.profitableAtMonth - onTime.profitableAtMonth;
    deltaText = delay > 0 ? `+${delay} mo to break-even` : '—';
    deltaHarm = delay > 0;
  } else {
    deltaText = '—';
  }

  return (
    <div className="card p-6 sm:p-8 lg:col-span-2">
      <h3 className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-slate-100">
        <CalendarClock className="h-4 w-4 text-slate-400" aria-hidden="true" />
        Collections stress test
      </h3>
      <p className="mt-2 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
        Net-30 terms, quarterly-billed annuals and enterprise payment runs mean revenue often lands a
        month after it bills. The toggle re-runs this exact simulation with every month&rsquo;s
        collections shifted one month later — nothing else changes.
      </p>
      <button
        type="button"
        aria-pressed={lag === 1}
        onClick={onToggle}
        className={`mt-4 flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition duration-150 focus-calm ${
          lag === 1
            ? 'border-indigo-500 bg-indigo-50 text-indigo-700 dark:border-indigo-400 dark:bg-indigo-500/15 dark:text-indigo-300'
            : 'border-slate-200 bg-white text-slate-600 hover:border-indigo-300 hover:text-indigo-600 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-300 dark:hover:border-indigo-400/50 dark:hover:text-indigo-300'
        }`}
      >
        <CalendarClock className="h-4 w-4" aria-hidden="true" />
        {lag === 1 ? 'Lag on — invoices land one month late' : 'Model a 1-month collection lag'}
      </button>

      <dl className="mt-4 space-y-2.5 text-sm">
        <div className="flex items-baseline justify-between gap-3">
          <dt className="text-slate-500 dark:text-slate-400">On-time collections</dt>
          <dd className="readout font-semibold text-slate-800 dark:text-slate-200">{fmtRunway(onTime)}</dd>
        </div>
        <div className="flex items-baseline justify-between gap-3">
          <dt className="text-slate-500 dark:text-slate-400">Every invoice one month late</dt>
          <dd className="readout font-semibold text-slate-800 dark:text-slate-200">{fmtRunway(lagged)}</dd>
        </div>
        <div className="flex items-baseline justify-between gap-3 border-t border-slate-100 pt-2.5 dark:border-white/[0.06]">
          <dt className="text-slate-500 dark:text-slate-400">Cost of the lag</dt>
          <dd
            className={`readout font-semibold ${
              deltaHarm ? 'text-rose-600 dark:text-rose-400' : 'text-slate-600 dark:text-slate-300'
            }`}
          >
            {deltaText}
          </dd>
        </div>
      </dl>
      <p className="mt-3 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
        The lag permanently delays one month of margin-weighted MRR — {usd(oneMonthCollections, 0)} at
        your inputs. It costs whole months only near a month boundary, but near break-even that
        single shift can flip the outcome; check your real DSO before trusting the on-time column.
      </p>
    </div>
  );
}

/* ===================== Cash trajectory chart ===================== */

function CashChart({ r }: { r: RunwayResult }) {
  const { points } = r;
  const runwayMonths = r.months;
  const turnMonth = r.profitableAtMonth;
  // Default window is 24 months — but when the break-even turn lands within a
  // still-readable span (≤ 60 bars, scrollable), extend the window so the
  // reader actually sees the trough the caption talks about instead of a
  // flat-looking 24-month slice.
  const displayMonths = runwayMonths !== null
    ? runwayMonths
    : turnMonth !== null && turnMonth + 2 <= 60 && turnMonth + 2 <= points.length - 1
      ? turnMonth + 2
      : Math.min(points.length - 1, 24);
  const visible = points.slice(0, Math.min(points.length, displayMonths + 1));
  // Scale from the VISIBLE bars only. Once the projection stops just past
  // break-even the tail has begun compounding upward; scaling against all
  // points (or a 10-year horizon) would flatten every visible bar into an
  // invisible sliver — exactly the failure mode growth-then-breakeven inputs
  // used to trigger.
  const maxCash = Math.max(...visible.map((p) => p.cash), 1);
  const minCash = Math.min(...visible.map((p) => p.cash));
  const last = visible[visible.length - 1];
  const maxBarHeight = 180; // px
  const stoppedEarly = r.months === null && r.reachedProfitability && points.length < 121;
  const turnedPositive =
    r.profitableAtMonth !== null && r.profitableAtMonth <= displayMonths && r.points[r.profitableAtMonth];

  const ariaLabel = `Monthly projected cash balance: ${usdCompact(visible[0].cash)} today, ${usdCompact(
    last.cash
  )} at month ${last.month}, low of ${usdCompact(minCash)}${
    turnedPositive ? `, turning cash-flow positive at month ${r.profitableAtMonth}` : ''
  }.`;

  return (
    <div className="card p-6 sm:p-8">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Cash trajectory</h3>
        <span className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
          <TrendingDown className="h-3.5 w-3.5 text-rose-500" aria-hidden="true" />
          Burn vs
          <TrendingUp className="ml-1 h-3.5 w-3.5 text-emerald-500" aria-hidden="true" />
          MRR growth
        </span>
      </div>

      {/* Bar visualization with hover/focus tooltips. role="group" (not "img"):
          the bars are focusable with their own labels, and an img role would
          mark them presentational to assistive tech. */}
      <div
        className="mt-5 flex h-[200px] items-end gap-1 overflow-x-auto pb-2"
        role="group"
        aria-label={`Cash trajectory chart. ${ariaLabel}`}
      >
        {visible.map((p) => {
          const h = Math.max(2, (p.cash / maxCash) * maxBarHeight);
          const isZero = p.cash <= 0.5;
          return (
            <div
              key={p.month}
              tabIndex={0}
              aria-label={`Month ${p.month}: cash ${usdCompact(p.cash)}, MRR ${usdCompact(
                p.mrr
              )}, net burn ${usdCompact(p.netBurn)}`}
              className="group relative flex min-w-[10px] flex-1 cursor-default flex-col items-center justify-end rounded-t outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:focus-visible:ring-indigo-400"
              style={{ height: '100%' }}
            >
              <div
                className={`w-full rounded-t transition-all duration-200 ${
                  isZero
                    ? 'bg-rose-200 dark:bg-rose-500/70'
                    : p.month === 0
                      ? 'bg-indigo-300 dark:bg-indigo-400/80'
                      : p.netBurn < 0
                        ? 'bg-emerald-500 group-hover:bg-emerald-600 dark:bg-emerald-400/90 dark:group-hover:bg-emerald-300'
                        : 'bg-emerald-400 group-hover:bg-emerald-500 dark:bg-emerald-500/80 dark:group-hover:bg-emerald-400'
                }`}
                style={{ height: `${(h / maxBarHeight) * 100}%` }}
              />
              {/* tooltip */}
              <div className="pointer-events-none absolute -top-2 left-1/2 z-10 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-md bg-slate-900 px-2 py-1 text-[10px] font-medium text-white opacity-0 shadow-lg ring-1 ring-slate-900/10 transition group-hover:opacity-100 group-focus-visible:opacity-100 dark:ring-white/20">
                Mo {p.month}: {usdCompact(p.cash)} · net {usdCompact(p.netBurn)}
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-1 flex justify-between font-mono text-[10px] text-slate-500 dark:text-slate-400">
        <span>Today</span>
        <span>Month {displayMonths}</span>
      </div>

      <p className="mt-4 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
        Each bar is one month of projected cash; darker bars are months where MRR (net of margin)
        already exceeds burn. The downward slope flattens as MRR grows — that flattening is the value
        of growth on runway. Hover or focus any bar for the exact balance.
        {stoppedEarly && turnMonth !== null && turnMonth <= displayMonths
          && ' The projection stops just past break-even — beyond that point, cash only compounds.'}
        {runwayMonths === null && turnMonth !== null && turnMonth > displayMonths
          && ` Cash-flow break-even arrives at month ${turnMonth} — past the right edge of this ${displayMonths}-month window.`}
      </p>
    </div>
  );
}

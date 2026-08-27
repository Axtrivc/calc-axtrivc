'use client';

import { useEffect, useMemo } from 'react';
import { Info, RotateCcw, TrendingDown, TrendingUp } from 'lucide-react';
import NumberInput, { AnimatedNumber, CopyButton, SliderControl, StatCard } from '@/components/NumberInput';
import ScenarioButtons from '@/components/ScenarioButtons';
import { computeRunway } from '@/lib/runway';
import { usd, usdCompact, numFmt, pct } from '@/lib/format';
import { useWorkbenchInputs, recordRecent } from '@/lib/workbench';

const SLUG = 'saas-runway-calculator';
const DEFAULTS = { cash: 500000, burn: 50000, mrr: 10000, growth: 8 };

export default function RunwayCalculator() {
  const { values, set, reset } = useWorkbenchInputs(SLUG, DEFAULTS);
  const { cash, burn, mrr, growth } = values;

  // Mark this tool as recently used for the workbench home panel.
  useEffect(() => {
    recordRecent(SLUG);
  }, []);

  const r = useMemo(
    () => computeRunway({ cash, grossBurn: burn, mrr, growthRate: growth }),
    [cash, burn, mrr, growth]
  );

  const setCash = (n: number) => set('cash', n);
  const setBurn = (n: number) => set('burn', n);
  const setMrr = (n: number) => set('mrr', n);
  const setGrowth = (n: number) => set('growth', n);

  const runwayLabel = r.months === null ? '∞' : numFmt(r.months, 0);
  const runwayColor =
    r.months === null ? 'emerald' : r.months >= 18 ? 'emerald' : r.months >= 12 ? 'amber' : 'rose';

  const runwayTone =
    runwayColor === 'emerald'
      ? 'text-emerald-600'
      : runwayColor === 'amber'
        ? 'text-amber-600'
        : 'text-rose-600';

  const copyText =
    r.months === null
      ? `SaaS runway: ∞ months (profitable) at ${pct(growth, 0)}/mo MRR growth · break-even MRR ${usd(r.breakevenMrr, 0)}`
      : `SaaS runway: ${numFmt(r.months, 0)} months at ${pct(growth, 0)}/mo MRR growth · net burn ${usd(Math.max(0, r.initialNetBurn), 0)}/mo · break-even MRR ${usd(r.breakevenMrr, 0)}`;

  return (
    <div className="grid gap-6 lg:grid-cols-5">
      {/* Inputs */}
      <div className="card lg:col-span-2 p-6 sm:p-8">
        <h2 className="mb-6 text-base font-semibold text-slate-900">Your runway inputs</h2>
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
              min={0}
              max={50}
              step={0.5}
              suffix="%/mo"
              placeholder="8"
              helpText="How fast MRR compounds each month. 5–15% is strong early-stage."
            />
            <div className="mt-3">
              <SliderControl
                id="growth-slider"
                label="" ariaLabel="Monthly MRR growth rate"
                value={growth}
                onChange={setGrowth}
                min={0}
                max={50}
                step={0.5}
                suffix="%"
                presets={[5, 10, 20]}
              />
            </div>
          </div>
        </div>

        <div className="mt-6 flex items-start gap-2 rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
          <p>
            Net burn = gross burn − MRR. As MRR grows each month, your net burn shrinks — so real
            runway under growth is longer than the naive <code>cash ÷ net burn</code> estimate.
          </p>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" onClick={reset} className="btn-ghost">
            <RotateCcw className="h-4 w-4 text-indigo-500" aria-hidden="true" />
            Reset
          </button>
          <CopyButton text={copyText} label="Copy result" />
          <ScenarioButtons
            slug={SLUG}
            shortTitle="Runway"
            href="/saas-runway-calculator/"
            params={{ cash, burn, mrr, growth }}
          />
        </div>
      </div>

      {/* Results + chart */}
      <div className="lg:col-span-3 space-y-4">
        <div className="card p-6 sm:p-8">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Runway remaining
          </span>
          <div className={`mt-1 readout text-6xl font-extrabold tracking-tight ${runwayTone}`}>
            {runwayLabel}
            {r.months !== null && (
              <span className="ml-2 text-xl font-semibold text-slate-400">months</span>
            )}
          </div>
          <p className="mt-2 text-sm text-slate-500">
            {r.months === null
              ? r.initialNetBurn <= 0
                ? 'You are already cash-flow positive — MRR covers your burn. Each month adds to your bank balance.'
                : `You reach cash-flow break-even at month ${r.profitableAtMonth} as MRR overtakes burn.`
              : `Based on ${pct(growth, 0)}/mo MRR growth, your cash runs out around month ${r.months}.`}
          </p>

          {r.months !== null && (
            <div className="mt-5">
              <div className="relative h-3 w-full overflow-hidden rounded-full bg-slate-100">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${
                    runwayColor === 'emerald'
                      ? 'bg-gradient-to-r from-emerald-500 to-teal-400'
                      : runwayColor === 'amber'
                        ? 'bg-gradient-to-r from-amber-500 to-orange-400'
                        : 'bg-gradient-to-r from-rose-500 to-rose-400'
                  }`}
                  style={{ width: `${Math.min(100, (r.months / 36) * 100)}%` }}
                />
                <div className="absolute inset-x-0 flex justify-between px-1 font-mono text-[10px] text-slate-400">
                  <span className="-mt-0.5">0</span>
                  <span className="-mt-0.5">12</span>
                  <span className="-mt-0.5">24</span>
                  <span className="-mt-0.5">36mo+</span>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <StatCard
            label="Current net burn"
            value={<AnimatedNumber value={Math.max(0, r.initialNetBurn)} format={(n) => usd(n, 0)} />}
            sublabel={r.initialNetBurn <= 0 ? 'Positive cash flow!' : 'Per month, today'}
            emphasis={r.initialNetBurn <= 0}
          />
          <StatCard
            label="Break-even MRR"
            value={<AnimatedNumber value={r.breakevenMrr} format={(n) => usd(n, 0)} />}
            sublabel="To cover gross burn"
          />
        </div>

        <CashChart points={r.points} runwayMonths={r.months} cashStart={cash} />
      </div>
    </div>
  );
}

function CashChart({
  points,
  runwayMonths,
  cashStart,
}: {
  points: { month: number; cash: number; mrr: number; netBurn: number }[];
  runwayMonths: number | null;
  cashStart: number;
}) {
  const maxCash = Math.max(cashStart, ...points.map((p) => p.cash), 1);
  const displayMonths = runwayMonths !== null ? runwayMonths : Math.min(points.length - 1, 24);
  const visible = points.slice(0, Math.min(points.length, displayMonths + 1));
  const maxBarHeight = 180; // px

  return (
    <div className="card p-6 sm:p-8">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-900">Cash trajectory</h3>
        <span className="flex items-center gap-1 text-xs text-slate-500">
          <TrendingDown className="h-3.5 w-3.5 text-rose-500" aria-hidden="true" />
          Burn vs
          <TrendingUp className="ml-1 h-3.5 w-3.5 text-emerald-500" aria-hidden="true" />
          MRR growth
        </span>
      </div>

      {/* Bar visualization with hover tooltips */}
      <div
        className="mt-5 flex h-[200px] items-end gap-1 overflow-x-auto pb-2"
        role="img"
        aria-label="Monthly cash balance over time"
      >
        {visible.map((p) => {
          const h = Math.max(2, (p.cash / maxCash) * maxBarHeight);
          const isZero = p.cash <= 0.5;
          return (
            <div
              key={p.month}
              className="group relative flex min-w-[10px] flex-1 flex-col items-center justify-end"
              style={{ height: '100%' }}
            >
              <div
                className={`w-full rounded-t transition-all duration-200 ${
                  isZero
                    ? 'bg-rose-200'
                    : p.month === 0
                      ? 'bg-indigo-300'
                      : 'bg-emerald-400 group-hover:bg-emerald-500'
                }`}
                style={{ height: `${(h / maxBarHeight) * 100}%` }}
              />
              {/* tooltip */}
              <div className="pointer-events-none absolute -top-2 left-1/2 z-10 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-md bg-slate-900 px-2 py-1 text-[10px] font-medium text-white opacity-0 shadow-lg transition group-hover:opacity-100">
                Mo {p.month}: {usdCompact(p.cash)} · MRR {usdCompact(p.mrr)}
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-1 flex justify-between font-mono text-[10px] text-slate-400">
        <span>Today</span>
        <span>Month {displayMonths}</span>
      </div>

      <p className="mt-4 text-xs leading-relaxed text-slate-500">
        Each bar is one month of projected cash. The downward slope flattens as MRR grows — that
        flattening is the value of growth on runway. Hover any bar for the exact balance.
      </p>
    </div>
  );
}

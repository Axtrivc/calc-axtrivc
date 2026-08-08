'use client';

import { useMemo, useState } from 'react';
import { Info, RotateCcw, TrendingDown, TrendingUp } from 'lucide-react';
import NumberInput, { StatCard } from '@/components/NumberInput';
import { computeRunway } from '@/lib/runway';
import { usd, usdCompact, numFmt, pct } from '@/lib/format';

export default function RunwayCalculator() {
  const [cash, setCash] = useState(500000);
  const [burn, setBurn] = useState(50000);
  const [mrr, setMrr] = useState(10000);
  const [growth, setGrowth] = useState(8);

  const r = useMemo(
    () => computeRunway({ cash, grossBurn: burn, mrr, growthRate: growth }),
    [cash, burn, mrr, growth]
  );

  function reset() {
    setCash(500000);
    setBurn(50000);
    setMrr(10000);
    setGrowth(8);
  }

  const runwayLabel = r.months === null ? '∞ (profitable)' : numFmt(r.months, 0);
  const runwayColor =
    r.months === null ? 'emerald' : r.months >= 18 ? 'emerald' : r.months >= 12 ? 'amber' : 'rose';

  const runwayTone =
    runwayColor === 'emerald'
      ? 'text-emerald-600'
      : runwayColor === 'amber'
        ? 'text-amber-600'
        : 'text-rose-600';

  return (
    <div className="grid gap-6 lg:grid-cols-5">
      {/* Inputs */}
      <div className="card lg:col-span-2 p-6 sm:p-8">
        <h2 className="mb-6 text-base font-semibold text-slate-900">Your runway inputs</h2>
        <div className="space-y-5">
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
        </div>

        <div className="mt-6 flex items-start gap-2 rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
          <p>
            Net burn = gross burn − MRR. As MRR grows each month, your net burn shrinks — so real
            runway under growth is longer than the naive <code>cash ÷ net burn</code> estimate.
          </p>
        </div>

        <button type="button" onClick={reset} className="btn-ghost mt-4">
          <RotateCcw className="h-4 w-4" aria-hidden="true" />
          Reset
        </button>
      </div>

      {/* Results + chart */}
      <div className="lg:col-span-3 space-y-4">
        <div className="card p-6 sm:p-8">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Runway remaining</span>
          <div className={`mt-1 text-6xl font-extrabold tracking-tight tabular-nums ${runwayTone}`}>
            {runwayLabel}
            {r.months !== null && <span className="ml-2 text-xl font-semibold text-slate-400">months</span>}
          </div>
          <p className="mt-2 text-sm text-slate-500">
            {r.months === null
              ? r.initialNetBurn <= 0
                ? 'You are already cash-flow positive — MRR covers your burn. Each month adds to your bank balance.'
                : `You reach cash-flow break-even at month ${r.profitableAtMonth} as MRR overtakes burn.`
              : `Based on ${pct(growth, 0)}/mo MRR growth, your cash runs out around month ${r.months}.`}
          </p>

          {/* Runway bar (red→amber→green zone) */}
          {r.months !== null && (
            <div className="mt-5">
              <div className="relative h-3 w-full overflow-hidden rounded-full bg-slate-100">
                <div
                  className={`h-full rounded-full ${
                    runwayColor === 'emerald' ? 'bg-emerald-500' : runwayColor === 'amber' ? 'bg-amber-500' : 'bg-rose-500'
                  }`}
                  style={{ width: `${Math.min(100, (r.months / 36) * 100)}%` }}
                />
                {/* scale ticks */}
                <div className="absolute inset-x-0 flex justify-between px-1 text-[10px] text-slate-400">
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
            value={usd(Math.max(0, r.initialNetBurn), 0)}
            sublabel={r.initialNetBurn <= 0 ? 'Positive cash flow!' : 'Per month, today'}
            emphasis={r.initialNetBurn <= 0}
          />
          <StatCard
            label="Break-even MRR"
            value={usd(r.breakevenMrr, 0)}
            sublabel="To cover gross burn"
          />
        </div>

        {/* Month-by-month cash trajectory chart */}
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
  // Show up to (runway+2) months or 24 if profitable — keep chart readable
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

      {/* Bar visualization */}
      <div className="mt-5 flex h-[200px] items-end gap-1 overflow-x-auto pb-2" role="img" aria-label="Monthly cash balance over time">
        {visible.map((p) => {
          const h = Math.max(2, (p.cash / maxCash) * maxBarHeight);
          const isZero = p.cash <= 0.5;
          return (
            <div key={p.month} className="group relative flex min-w-[10px] flex-1 flex-col items-center justify-end" style={{ height: '100%' }}>
              <div
                className={`w-full rounded-t transition-all ${
                  isZero
                    ? 'bg-rose-200'
                    : p.month === 0
                      ? 'bg-indigo-400'
                      : 'bg-emerald-400 group-hover:bg-emerald-500'
                }`}
                style={{ height: `${(h / maxBarHeight) * 100}%` }}
              />
              {/* tooltip */}
              <div className="pointer-events-none absolute -top-2 left-1/2 z-10 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-md bg-slate-900 px-2 py-1 text-[10px] font-medium text-white opacity-0 transition group-hover:opacity-100">
                Mo {p.month}: {usdCompact(p.cash)} · MRR {usdCompact(p.mrr)}
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-slate-400">
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

'use client';

import { useMemo, useState } from 'react';
import { Info, RotateCcw } from 'lucide-react';
import NumberInput, { AnimatedNumber, CopyButton, SliderControl, StatCard } from '@/components/NumberInput';
import { computeFreelanceRate } from '@/lib/freelance';
import { usd, numFmt, pct } from '@/lib/format';

export default function FreelanceCalculator() {
  const [takeHome, setTakeHome] = useState(90000);
  const [expenses, setExpenses] = useState(12000);
  const [taxRate, setTaxRate] = useState(30);
  const [vacation, setVacation] = useState(25);
  const [weeklyHours, setWeeklyHours] = useState(25);

  const r = useMemo(
    () =>
      computeFreelanceRate({
        targetTakeHome: takeHome,
        businessExpenses: expenses,
        taxRate,
        vacationDays: vacation,
        weeklyBillableHours: weeklyHours,
      }),
    [takeHome, expenses, taxRate, vacation, weeklyHours]
  );

  function reset() {
    setTakeHome(90000);
    setExpenses(12000);
    setTaxRate(30);
    setVacation(25);
    setWeeklyHours(25);
  }

  const copyText = `Freelance rate: ${usd(r.hourlyRate, 0)}/hr · day rate ${usd(r.dayRate, 0)} · monthly gross ${usd(r.monthlyRate, 0)} (gross needed ${usd(r.grossNeeded, 0)}, ${numFmt(r.billableHours, 0)} billable hrs/yr)`;

  return (
    <div className="grid gap-6 lg:grid-cols-5">
      {/* Inputs */}
      <div className="card lg:col-span-3 p-6 sm:p-8">
        <h2 className="mb-1 text-base font-semibold text-white">Your numbers</h2>
        <p className="mb-6 text-sm text-slate-400">All annual figures unless noted.</p>

        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <NumberInput
              id="take-home"
              label="Target annual take-home pay"
              value={takeHome}
              onChange={setTakeHome}
              min={0}
              prefix="$"
              placeholder="90000"
              helpText="The net pay you want in your pocket after taxes & expenses."
            />
            <div className="mt-3">
              <SliderControl
                id="take-home-slider"
                label=""
                value={takeHome}
                onChange={setTakeHome}
                min={10000}
                max={500000}
                step={1000}
                prefix="$"
                logarithmic
                presets={[50000, 100000, 200000]}
              />
            </div>
          </div>
          <div>
            <NumberInput
              id="expenses"
              label="Annual business expenses"
              value={expenses}
              onChange={setExpenses}
              min={0}
              prefix="$"
              placeholder="12000"
              helpText="Software, hardware, contractor help, co-working, etc."
            />
            <div className="mt-3">
              <SliderControl
                id="expenses-slider"
                label=""
                value={expenses}
                onChange={setExpenses}
                min={0}
                max={100000}
                step={500}
                prefix="$"
                logarithmic
                presets={[5000, 15000, 30000]}
              />
            </div>
          </div>
          <div>
            <NumberInput
              id="tax-rate"
              label="Effective tax rate"
              value={taxRate}
              onChange={setTaxRate}
              min={0}
              max={70}
              step={0.5}
              suffix="%"
              placeholder="30"
              helpText="Combined self-employment + income tax. 25–35% is typical."
            />
            <div className="mt-3">
              <SliderControl
                id="tax-rate-slider"
                label=""
                value={taxRate}
                onChange={setTaxRate}
                min={0}
                max={70}
                step={0.5}
                suffix="%"
                presets={[20, 30, 40]}
              />
            </div>
          </div>
          <div>
            <NumberInput
              id="vacation"
              label="Vacation & public holidays"
              value={vacation}
              onChange={setVacation}
              min={0}
              max={120}
              suffix="days"
              placeholder="25"
              helpText="Days/yr you won't work — PTO + holidays + sick."
            />
            <div className="mt-3">
              <SliderControl
                id="vacation-slider"
                label=""
                value={vacation}
                onChange={setVacation}
                min={0}
                max={60}
                step={1}
                suffix="d"
                presets={[15, 25, 40]}
              />
            </div>
          </div>
          <div className="sm:col-span-2">
            <NumberInput
              id="weekly-hours"
              label="Billable hours per week"
              value={weeklyHours}
              onChange={setWeeklyHours}
              min={1}
              max={80}
              suffix="hrs"
              placeholder="25"
              helpText="Realistic hours actually billed to clients. 20–30 is common; the rest goes to sales/admin."
            />
            <div className="mt-3">
              <SliderControl
                id="weekly-hours-slider"
                label=""
                value={weeklyHours}
                onChange={setWeeklyHours}
                min={1}
                max={60}
                step={1}
                suffix="h"
                presets={[15, 25, 40]}
              />
            </div>
          </div>
        </div>

        <div className="mt-6 flex items-start gap-2 rounded-lg border border-slate-800 bg-base-800/60 p-3 text-xs text-slate-400">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-cyan-500/70" aria-hidden="true" />
          <p>
            The math: <code>hourly = (takeHome + expenses) / (1 − tax%) / (billable weeks × weekly hours)</code>.
            {r.utilization < 50 && r.hourlyRate > 0 && (
              <> At {pct(r.utilization)} utilization your non-billable time is driving your rate up significantly.</>
            )}
          </p>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" onClick={reset} className="btn-ghost">
            <RotateCcw className="h-4 w-4 text-cyan-400" aria-hidden="true" />
            Reset
          </button>
          <CopyButton text={copyText} label="Copy result" />
        </div>
      </div>

      {/* Results */}
      <div className="lg:col-span-2 space-y-4">
        <div className="card p-6 sm:p-8">
          <span className="text-xs font-semibold uppercase tracking-wide text-emerald-400">
            Your minimum rate
          </span>
          <div className="mt-2 text-5xl font-extrabold tracking-tight text-white">
            <AnimatedNumber
              value={r.hourlyRate}
              format={(n) => usd(n, 0)}
              className="readout text-glow-green text-emerald-400"
            />
            <span className="ml-1 text-base font-medium text-slate-500">/hr</span>
          </div>
          <p className="mt-2 text-sm text-slate-400">
            Charge at least this much to hit your target. Most freelancers add a 15–25% margin on top.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <StatCard
            label="Day rate (8h)"
            value={<AnimatedNumber value={r.dayRate} format={(n) => usd(n, 0)} />}
            sublabel="Per project day"
            emphasis
          />
          <StatCard
            label="Monthly gross"
            value={<AnimatedNumber value={r.monthlyRate} format={(n) => usd(n, 0)} />}
            sublabel="Revenue target"
          />
        </div>

        <div className="card p-6 sm:p-8">
          <h3 className="text-sm font-semibold text-white">The math behind your rate</h3>
          <dl className="mt-3 space-y-2.5 text-sm">
            <div className="flex justify-between">
              <dt className="text-slate-400">Take-home target</dt>
              <dd className="readout font-semibold text-slate-100">{usd(takeHome, 0)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-400">+ Business expenses</dt>
              <dd className="readout font-semibold text-slate-100">{usd(expenses, 0)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-400">÷ (1 − tax rate)</dt>
              <dd className="readout font-semibold text-slate-100">{pct(taxRate, 0)}</dd>
            </div>
            <div className="flex justify-between border-t border-slate-800 pt-2.5">
              <dt className="font-medium text-slate-300">Gross revenue needed</dt>
              <dd className="readout font-bold text-cyan-400">
                <AnimatedNumber value={r.grossNeeded} format={(n) => usd(n, 0)} />
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-400">Billable weeks/yr</dt>
              <dd className="readout font-semibold text-slate-100">
                <AnimatedNumber value={r.billableWeeks} format={(n) => numFmt(n, 1)} />
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-400">Billable hours/yr</dt>
              <dd className="readout font-semibold text-slate-100">
                <AnimatedNumber value={r.billableHours} format={(n) => numFmt(n, 0)} />
              </dd>
            </div>
            <div className="flex justify-between border-t border-slate-800 pt-2.5">
              <dt className="font-medium text-slate-300">Required hourly rate</dt>
              <dd className="readout font-bold text-emerald-400">
                <AnimatedNumber value={r.hourlyRate} format={(n) => usd(n, 0)} />/hr
              </dd>
            </div>
          </dl>
        </div>

        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 text-sm text-amber-200/90 backdrop-blur">
          <strong className="font-semibold">Reality check:</strong> only {numFmt(r.billableHours, 0)} of 2,080 working hours are billable ({pct(r.utilization, 0)}). The other time goes to finding clients, admin, and unpaid revisions — and that's exactly why your rate can't match a salaried employee's.
        </div>
      </div>
    </div>
  );
}

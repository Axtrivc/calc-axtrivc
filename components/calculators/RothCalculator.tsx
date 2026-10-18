'use client';

import { useEffect, useMemo } from 'react';
import { AlertTriangle, Info, RotateCcw, Scale } from 'lucide-react';
import NumberInput, { AnimatedNumber, CopyButton, SliderControl } from '@/components/NumberInput';
import ScenarioButtons from '@/components/ScenarioButtons';
import ComparisonChart from '@/components/ComparisonChart';
import {
  balancePath,
  compareRoth,
  contributionLimit,
  retirementRateSweep,
  horizonSweep,
  ROTH_CONSTANTS as ROTH_LIMITS,
  type AccountType,
  type RothInput,
} from '@/lib/roth';
import { usd, usdCompact, pct, clamp } from '@/lib/format';
import { useWorkbenchInputs, recordRecent } from '@/lib/workbench';

const SLUG = 'roth-vs-traditional-calculator';
const HREF = '/roth-vs-traditional-calculator/';

/** account is stored as 0 (IRA) / 1 (401k) so the whole state stays Record<string, number>. */
const DEFAULTS = {
  account: 0,
  age: 35,
  currentRate: 24,
  retireRate: 12,
  contribution: 7_000,
  years: 30,
  ret: 7,
};

const RATE_PRESETS_NOW = [10, 12, 22, 24, 32, 35];
const RATE_PRESETS_RET = [0, 10, 12, 22, 24];

/* Full-input scenario presets — one click loads a coherent biography. */
const SCENARIOS: { label: string; detail: string; values: typeof DEFAULTS }[] = [
  {
    label: 'Early career',
    detail: '28 · 24% → 12% · $7k IRA · 37 yrs',
    values: { account: 0, age: 28, currentRate: 24, retireRate: 12, contribution: 7_000, years: 37, ret: 7 },
  },
  {
    label: 'Peak earning',
    detail: '45 · 32% → 22% · $23.5k 401(k) · 20 yrs',
    values: { account: 1, age: 45, currentRate: 32, retireRate: 22, contribution: 23_500, years: 20, ret: 7 },
  },
  {
    label: 'Catch-up years',
    detail: '55 · 24% → 22% · $8k IRA · 12 yrs',
    values: { account: 0, age: 55, currentRate: 24, retireRate: 22, contribution: 8_000, years: 12, ret: 6 },
  },
  {
    label: 'Low-income year',
    detail: '40 · 12% → 24% · $7k IRA · 25 yrs',
    values: { account: 0, age: 40, currentRate: 12, retireRate: 24, contribution: 7_000, years: 25, ret: 7 },
  },
];

export default function RothCalculator() {
  const { values, set, reset } = useWorkbenchInputs(SLUG, DEFAULTS);
  const { account, age, currentRate, retireRate, contribution, years, ret } = values;
  const accountType: AccountType = account === 1 ? '401k' : 'ira';

  useEffect(() => {
    recordRecent(SLUG);
  }, []);

  const input: RothInput = {
    currentRatePct: currentRate,
    retirementRatePct: retireRate,
    annualContribution: contribution,
    years,
    annualReturnPct: ret,
  };

  const result = useMemo(() => compareRoth(input), [currentRate, retireRate, contribution, years, ret]);
  const sweep = useMemo(
    () => retirementRateSweep(input, 0, 50, 50),
    [currentRate, retireRate, contribution, years, ret],
  );
  const horizons = useMemo(() => horizonSweep(input, [10, 20, 30, 40]), [currentRate, retireRate, contribution, ret]);

  const limit = contributionLimit(accountType, age);
  const overLimit = contribution > limit.total + 0.5;
  const yearsTooShort = result.effectiveYears < 1;
  const rothWins = result.winner === 'roth';
  const tradWins = result.winner === 'traditional';
  // Effective rates = what the engine actually computed with (clamped to
  // [0, 85]). Every verdict-context display uses these, never the raw state,
  // so a junk deep link (?currentRate=999) can never show "999%" beside math
  // that ran at 85%.
  const effNow = result.effectiveCurrentRatePct;
  const effRet = result.effectiveRetirementRatePct;
  const effReturn = clamp(ret, -20, 50);
  const effYears = Math.round(result.effectiveYears);
  const effContribution = Math.max(0, contribution);
  const gapPoints = effRet - effNow;
  const rateMismatch = currentRate !== effNow || retireRate !== effRet;
  // The scan spans the same 0–50% the rate inputs allow; a clamped rate above
  // that (only reachable via deep link) pins the marker at the edge, labeled
  // as off scale — same honesty convention as the S-Corp tool's salary sweep.
  const markerOnScale = effNow >= 0 && effNow <= 50;
  const inputMismatch =
    rateMismatch || ret !== effReturn || Math.round(years) !== effYears || contribution < 0;

  // Framing A balances for the cumulative chart: the Traditional account gets
  // the full pre-tax outlay; the Roth account gets what survives today's tax.
  const tradPath = useMemo(() => balancePath(contribution, ret, years), [contribution, ret, years]);
  const rothPath = useMemo(
    () => balancePath(contribution * (1 - clamp(currentRate, 0, 85) / 100), ret, years),
    [contribution, ret, years, currentRate],
  );

  const verdictSentence =
    result.winner === 'tie'
      ? 'a dead heat — at equal tax rates the two accounts are worth the same spendable dollars'
      : `${result.winner === 'roth' ? 'Roth' : 'Traditional'} ends up ${usd(Math.abs(result.advantageRoth), 0)} ahead in spendable value`;
  const copySummary = `Roth vs Traditional at ${pct(effNow, 0)} today vs ${pct(effRet, 0)} in retirement, ${usd(Math.max(0, contribution), 0)}/yr for ${effYears} yrs at ${pct(effReturn, 1)}: ${verdictSentence}. Break-even retirement rate ${pct(result.breakevenRetirementRatePct, 0)}; each rate point is worth ${usd(result.perPointSwing, 0)}. Equal-outlay framing, 2025 limits disclosed.`;

  return (
    <div className="grid gap-6 lg:grid-cols-5">
      {/* ================= Inputs ================= */}
      <div className="card p-6 sm:p-8 lg:col-span-3">
        {/* Account family — switches which 2025 limit governs the disclosure. */}
        <div>
          <span className="label" id="roth-account-label">
            Account family
          </span>
          <div className="mt-2 flex gap-1.5" role="group" aria-labelledby="roth-account-label">
            {(
              [
                { key: 0, label: 'IRA' },
                { key: 1, label: '401(k)' },
              ] as const
            ).map((opt) => {
              const active = account === opt.key;
              return (
                <button
                  key={opt.key}
                  type="button"
                  aria-pressed={active}
                  onClick={() => set('account', opt.key)}
                  className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 dark:focus-visible:ring-indigo-400 dark:focus-visible:ring-offset-slate-950 ${
                    active
                      ? 'border-indigo-500 bg-indigo-50 text-indigo-700 dark:border-indigo-400 dark:bg-indigo-500/15 dark:text-indigo-300'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-indigo-300 hover:text-indigo-700 dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-300 dark:hover:border-indigo-400/50 dark:hover:text-indigo-300'
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
          <p className="mt-1.5 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
            The math is identical for both — this switch changes which 2025 limit and eligibility rule
            the disclosure below references.
          </p>
        </div>

        {/* Scenario presets */}
        <div className="mt-6">
          <span className="label">Load a scenario</span>
          <div className="mt-2 grid gap-1.5 sm:grid-cols-2">
            {SCENARIOS.map((s) => (
              <button
                key={s.label}
                type="button"
                onClick={() => {
                  (Object.keys(s.values) as (keyof typeof DEFAULTS)[]).forEach((k) => set(k, s.values[k]));
                }}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-left transition duration-150 hover:border-indigo-300 hover:bg-indigo-50/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 dark:border-white/10 dark:bg-white/[0.03] dark:hover:border-indigo-400/50 dark:hover:bg-indigo-500/10 dark:focus-visible:ring-indigo-400 dark:focus-visible:ring-offset-slate-950"
              >
                <span className="block text-sm font-semibold text-slate-700 dark:text-slate-200">{s.label}</span>
                <span className="readout mt-0.5 block text-[11px] text-slate-500 dark:text-slate-400">{s.detail}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="mt-6 space-y-6">
          <div className="grid gap-6 sm:grid-cols-2">
            <div>
              <NumberInput
                id="roth-age"
                label="Current age"
                value={age}
                onChange={(n) => set('age', clamp(n, 18, 80))}
                min={18}
                max={80}
                placeholder="35"
                helpText={
                  limit.catchUp > 0
                    ? `Catch-up room at ${age}: +${usd(limit.catchUp, 0)} — the over-limit warning uses the ${usd(limit.total, 0)} total.`
                    : `No catch-up at ${age} — the ${accountType === 'ira' ? 'IRA' : '401(k)'} catch-up starts at 50.`
                }
              />
              <div className="mt-3">
                <SliderControl
                  id="roth-age-slider"
                  label="Age"
                  value={clamp(age, 18, 80)}
                  onChange={(n) => set('age', n)}
                  min={18}
                  max={80}
                  step={1}
                  formatValue={(n) => `${n} yrs old`}
                />
              </div>
            </div>

            <div>
              <NumberInput
                id="roth-years"
                label="Years until retirement"
                value={years}
                onChange={(n) => set('years', clamp(n, 1, 70))}
                min={1}
                max={70}
                placeholder="30"
                helpText="Also the contribution count and the withdrawal horizon."
              />
              <div className="mt-3">
                <SliderControl
                  id="roth-years-slider"
                  label="Horizon"
                  value={clamp(years, 1, 70)}
                  onChange={(n) => set('years', n)}
                  min={1}
                  max={70}
                  step={1}
                  presets={[10, 20, 30, 40]}
                  formatValue={(n) => `${n} yrs`}
                />
              </div>
            </div>
          </div>

          <div className="grid gap-6 sm:grid-cols-2">
            <div>
              <NumberInput
                id="roth-rate-now"
                label="Marginal tax rate today"
                value={currentRate}
                onChange={(n) => set('currentRate', clamp(n, 0, 50))}
                min={0}
                max={50}
                suffix="%"
                placeholder="24"
                helpText="Federal bracket the saved dollars sit in — the rate a Traditional deduction avoids."
              />
              <div className="mt-3">
                <SliderControl
                  id="roth-rate-now-slider"
                  label="Rate today"
                  value={clamp(currentRate, 0, 50)}
                  onChange={(n) => set('currentRate', n)}
                  min={0}
                  max={50}
                  step={1}
                  suffix="%"
                  presets={RATE_PRESETS_NOW}
                  formatValue={(n) => `${n}%`}
                />
              </div>
            </div>

            <div>
              <NumberInput
                id="roth-rate-ret"
                label="Expected tax rate in retirement"
                value={retireRate}
                onChange={(n) => set('retireRate', clamp(n, 0, 50))}
                min={0}
                max={50}
                suffix="%"
                placeholder="12"
                helpText="The flat rate assumed on Traditional withdrawals. Be honest: most retirees land lower than their peak bracket."
              />
              <div className="mt-3">
                <SliderControl
                  id="roth-rate-ret-slider"
                  label="Rate in retirement"
                  value={clamp(retireRate, 0, 50)}
                  onChange={(n) => set('retireRate', n)}
                  min={0}
                  max={50}
                  step={1}
                  suffix="%"
                  presets={RATE_PRESETS_RET}
                  formatValue={(n) => `${n}%`}
                />
              </div>
            </div>
          </div>

          <div>
            <NumberInput
              id="roth-contribution"
              label="Annual contribution (pre-tax outlay)"
              value={contribution}
              onChange={(n) => set('contribution', clamp(n, 0, 100_000))}
              min={0}
              max={100_000}
              prefix="$"
              placeholder="7,000"
              helpText={`What lands in the Traditional account. The Roth account receives ${usd(Math.max(0, contribution) * (1 - clamp(currentRate, 0, 85) / 100), 0)} after today's tax — same out-of-pocket cost.`}
            />
            <div className="mt-3">
              <SliderControl
                id="roth-contribution-slider"
                label="Contribution"
                value={clamp(contribution, 0, 100_000)}
                onChange={(n) => set('contribution', n)}
                min={0}
                max={100_000}
                step={100}
                prefix="$"
                logarithmic
                presets={accountType === 'ira' ? [7_000, 8_000] : [23_500, 31_000]}
                helpText="Log scale: the slider spans $1–$100k, so small amounts bunch at the left edge — type exact figures in the box above."
              />
            </div>
            {overLimit && (
              <p className="mt-2 flex items-start gap-2 rounded-lg bg-amber-50 p-2.5 text-xs leading-relaxed text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500 dark:text-amber-400" aria-hidden="true" />
                {usd(contribution, 0)} is above the 2025 {accountType === 'ira' ? 'IRA' : '401(k) employee-deferral'} limit
                of {usd(limit.total, 0)} at age {age}. The model keeps running — read the outputs as plan room, not as a
                legal contribution.
              </p>
            )}
          </div>

          <div>
            <NumberInput
              id="roth-return"
              label="Annual return (both accounts)"
              value={ret}
              onChange={(n) => set('ret', clamp(n, 0, 15))}
              min={0}
              max={15}
              step={0.5}
              suffix="%"
              placeholder="7"
              helpText="Investments inside either account grow untaxed while they stay in — the return never favors one flavor."
            />
            <div className="mt-3">
              <SliderControl
                id="roth-return-slider"
                label="Return"
                value={clamp(ret, 0, 15)}
                onChange={(n) => set('ret', n)}
                min={0}
                max={15}
                step={0.5}
                suffix="%"
                presets={[4, 5, 6, 7, 8]}
                formatValue={(n) => `${n}%`}
              />
            </div>
          </div>
        </div>

        {yearsTooShort && (
          <p className="mt-4 flex items-start gap-2 rounded-lg bg-amber-50 p-2.5 text-xs leading-relaxed text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500 dark:text-amber-400" aria-hidden="true" />
            The horizon needs at least one year — nothing has compounded yet at zero years.
          </p>
        )}
        {inputMismatch && (
          <p className="mt-4 flex items-start gap-2 rounded-lg bg-amber-50 p-2.5 text-xs leading-relaxed text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500 dark:text-amber-400" aria-hidden="true" />
            A shared or stored link carried an input outside its modeled range — the model is running your entries as{' '}
            <strong className="font-semibold">{pct(effNow, 0)}</strong> today,{' '}
            <strong className="font-semibold">{pct(effRet, 0)}</strong> in retirement,{' '}
            <strong className="font-semibold">{pct(effReturn, 1)}</strong> return,{' '}
            <strong className="font-semibold">{effYears} yrs</strong> and{' '}
            <strong className="font-semibold">{usd(effContribution, 0)}/yr</strong> contributed (each clamped to its
            nearest legal value), which is what every result below reflects.
          </p>
        )}
        {currentRate === 0 && (
          <p className="mt-4 flex items-start gap-2 rounded-lg bg-slate-50 p-2.5 text-xs leading-relaxed text-slate-600 dark:bg-white/[0.03] dark:text-slate-300">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400 dark:text-slate-500" aria-hidden="true" />
            At a 0% marginal rate the Traditional deduction is worth nothing — Roth can only tie or win.
            This is the standard low-income-year case for Roth.
          </p>
        )}

        {/* 2025 disclosure strip — switches with the account family. */}
        <div className="mt-4 flex items-start gap-2 rounded-lg bg-slate-50 p-3 text-xs leading-relaxed text-slate-600 dark:bg-white/[0.03] dark:text-slate-300">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-slate-400 dark:text-slate-500" aria-hidden="true" />
          {accountType === 'ira' ? (
            <p>
              2025 IRA limit {usd(ROTH_LIMITS.iraLimit, 0)} ({usd(ROTH_LIMITS.iraCatchUp, 0)} catch-up from age 50 —
              one shared bucket across all your Roth and Traditional IRAs). Roth IRA direct contributions phase out at
              $150k–$165k MAGI single / $236k–$246k MFJ (2025); above the band, only the backdoor route remains.
            </p>
          ) : (
            <p>
              2025 401(k) employee deferral limit {usd(ROTH_LIMITS.k401Limit, 0)}, catch-up {usd(ROTH_LIMITS.k401CatchUp, 0)}{' '}
              from age 50 ({usd(ROTH_LIMITS.k401EnhancedCatchUp, 0)} at 60–63). A Roth 401(k) has no income phase-out at any
              MAGI, and — unlike a Traditional 401(k) — no lifetime required distributions since 2024.
            </p>
          )}
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" onClick={reset} className="btn-ghost">
            <RotateCcw className="h-4 w-4 text-indigo-500 dark:text-indigo-300" aria-hidden="true" />
            Reset
          </button>
          <CopyButton text={copySummary} label="Copy result" />
          <ScenarioButtons
            slug={SLUG}
            shortTitle="Roth vs Traditional"
            href={HREF}
            params={{ account, age, currentRate, retireRate, contribution, years, ret }}
          />
        </div>
      </div>

      {/* ================= Results ================= */}
      <div className="space-y-4 lg:col-span-2">
        {/* Headline verdict — equal pre-tax outlay framing */}
        <div className="card p-6 sm:p-8">
          <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            <Scale className="h-4 w-4" aria-hidden="true" />
            Verdict at these rates
          </h2>
          <div className="mt-3">
            <div className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
              {rothWins ? 'Roth ends ahead' : tradWins ? 'Traditional ends ahead' : 'Dead heat — equal rates'}
            </div>
            <AnimatedNumber
              value={Math.abs(result.advantageRoth)}
              format={(n) => usd(n, 0)}
              className={`readout mt-1 block text-4xl font-extrabold tracking-tight ${
                rothWins
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : tradWins
                    ? 'text-rose-600 dark:text-rose-400'
                    : 'text-slate-700 dark:text-slate-200'
              }`}
            />
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              spendable at retirement, same pre-tax outlay — {result.winner === 'tie'
                ? 'the rate differential is zero'
                : `${pct(effNow, 0)} today vs ${pct(effRet, 0)} later is a ${Math.abs(gapPoints)}-point ${gapPoints > 0 ? 'rise' : 'drop'}`}.
            </p>
          </div>

          <dl className="mt-5 divide-y divide-slate-100 text-sm dark:divide-white/[0.06]">
            <LedgerRow
              label="Into the account / yr"
              left={`${usd(contribution, 0)} pre-tax`}
              right={`${usd(result.rothBalance / result.factor, 0)} after-tax`}
            />
            <LedgerRow
              label={`Balance at year ${Math.round(result.effectiveYears)}`}
              left={usd(result.tradBalance, 0)}
              right={usd(result.rothBalance, 0)}
            />
            <LedgerRow
              label="Tax on withdrawals"
              left={`−${usd(result.tradBalance - result.tradSpendable, 0)}`}
              right="none"
            />
            <div className="flex items-center justify-between py-2.5">
              <dt className="font-medium text-slate-700 dark:text-slate-300">Spendable</dt>
              <dd className="readout flex items-baseline gap-2">
                <span
                  className={`text-lg font-bold ${
                    tradWins ? 'text-rose-600 dark:text-rose-400' : 'text-slate-500 dark:text-slate-400'
                  }`}
                >
                  {usd(result.tradSpendable, 0)}
                </span>
                <span className="text-slate-300 dark:text-slate-500">/</span>
                <span
                  className={`text-lg font-bold ${
                    rothWins ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-500 dark:text-slate-400'
                  }`}
                >
                  {usd(result.rothSpendable, 0)}
                </span>
              </dd>
            </div>
          </dl>
          <p className="mt-2 text-right font-mono text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Traditional · Roth
          </p>
        </div>

        {/* Break-even analytics */}
        <div className="card p-6 sm:p-8">
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
            Break-even retirement rate
          </h3>
          <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
            <strong className="readout text-slate-900 dark:text-white">{pct(result.breakevenRetirementRatePct, 0)}</strong> — exactly your
            current marginal rate.{' '}
            {result.winner === 'tie' ? (
              <>You are standing on it: any move in either direction picks the winner.</>
            ) : (
              <>
                You expect {pct(effRet, 0)}, {Math.abs(gapPoints)} points{' '}
                {gapPoints < 0 ? 'below' : 'above'} the break-even — {tradWins ? 'Traditional' : 'Roth'} country.
              </>
            )}
          </p>
          <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
            Every point of that gap moves{' '}
            <strong className="readout text-slate-900 dark:text-white">{usd(result.perPointSwing, 0)}</strong> of
            spendable value at the horizon.
          </p>

          <table className="data-table mt-4 w-full text-sm">
            <thead>
              <tr>
                <th scope="col">Horizon</th>
                <th scope="col" className="text-right">Traditional</th>
                <th scope="col" className="text-right">Roth</th>
                <th scope="col" className="text-right">Edge</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-white/[0.06]">
              {horizons.map((h) => {
                const active = Math.round(h.years) === Math.round(result.effectiveYears);
                return (
                  <tr key={h.years} className={active ? 'bg-indigo-50/60 dark:bg-indigo-500/10' : undefined}>
                    <th scope="row" className="readout font-semibold normal-case tracking-normal text-slate-900 dark:text-slate-100">
                      {h.years} yrs{active ? ' · now' : ''}
                    </th>
                    <td className="text-right readout text-slate-600 dark:text-slate-300">{usd(h.tradSpendable, 0)}</td>
                    <td className="text-right readout text-slate-600 dark:text-slate-300">{usd(h.rothSpendable, 0)}</td>
                    <td className="text-right">
                      <span
                        className={`readout whitespace-nowrap font-semibold ${
                          h.advantageRoth > 0.5
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : h.advantageRoth < -0.5
                              ? 'text-rose-600 dark:text-rose-400'
                              : 'text-slate-500 dark:text-slate-400'
                        }`}
                      >
                        {h.advantageRoth > 0.5 ? '+' : h.advantageRoth < -0.5 ? '−' : '±'}
                        {usd(Math.abs(h.advantageRoth), 0)}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="mt-2 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
            Same rate decision, longer runways: the percentage edge never changes, but the dollars compound — the
            compounding-amplification view.
          </p>
        </div>

        {/* Framing B — the limit view */}
        <div className="card p-6 sm:p-8">
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
            The limit view — same {usd(Math.max(0, contribution), 0)} into each account
          </h3>
          <dl className="mt-3 divide-y divide-slate-100 text-sm dark:divide-white/[0.06]">
            <LedgerRow
              label="Roth spendable (full C grows)"
              left=""
              right={usd(result.rothSpendableLimitView, 0)}
            />
            <LedgerRow label="Traditional spendable" left="" right={usd(result.tradSpendable, 0)} />
          </dl>
          <p className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
            The Roth column reads{' '}
            <strong className="readout text-slate-900 dark:text-white">{usd(result.advantageRothLimitView, 0)}</strong>{' '}
            ahead here whenever your retirement rate is above zero — but this framing ignores that the Roth dollars cost{' '}
            {pct(effNow, 0)} up front to convert. Its one real meaning: limits are nominal, so at the cap a Roth
            slot shelters more spendable value than a Traditional slot. The guide unpacks exactly when that matters.
          </p>
        </div>
      </div>

      {/* ================= Cumulative growth ================= */}
      <div className="lg:col-span-5">
        <div className="card p-5 sm:p-6">
          <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Cumulative growth, equal pre-tax outlay
              </h3>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                {usd(Math.max(0, contribution), 0)}/yr into Traditional vs {usd(result.rothBalance / result.factor, 0)}/yr into Roth
                at {pct(effReturn, 1)} — the same burn on your paycheck either way.
              </p>
            </div>
            <span className="readout rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600 dark:bg-white/[0.05] dark:text-slate-300">
              year {Math.round(result.effectiveYears)}: {usdCompact(result.tradBalance)} vs{' '}
              {usdCompact(result.rothBalance)}
            </span>
          </div>
          <ComparisonChart
            series={[
              {
                label: 'Traditional — account balance',
                color: '#0ea5e9',
                points: tradPath.map((p) => ({ x: p.year, y: p.balance })),
              },
              {
                label: 'Roth — account balance',
                color: '#10b981',
                points: rothPath.map((p) => ({ x: p.year, y: p.balance })),
              },
            ]}
            xLabel="Years from today"
            yLabel="Account balance"
            xFormat={(n) => `${Math.round(n)}y`}
            yFormat={(n) => usdCompact(n)}
            height={280}
            marker={{ x: Math.max(1, result.effectiveYears), label: `retirement · year ${Math.round(result.effectiveYears)}` }}
            caption="The Traditional line rides higher because pre-tax dollars go in untouched; the Roth line is the smaller after-tax contribution compounding at the same rate. Neither line is spendable yet — the verdict comes from taxing the blue column at your retirement rate, which is what the break-even scan below does."
          />
        </div>
      </div>

      {/* ================= Break-even scan ================= */}
      <div className="lg:col-span-5">
        <div className="card p-5 sm:p-6">
          <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Break-even tax-rate scan
              </h3>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                Spendable value at retirement as the assumed retirement rate moves from 0% to 50% —
                the same range the inputs allow.
              </p>
            </div>
            <span className="readout rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600 dark:bg-white/[0.05] dark:text-slate-300">
              crossing at {pct(result.breakevenRetirementRatePct, 0)} · you expect {pct(effRet, 0)}
            </span>
          </div>
          <ComparisonChart
            series={[
              {
                label: 'Traditional — spendable at retirement',
                color: '#0ea5e9',
                points: sweep.map((s) => ({ x: s.retirementRatePct, y: s.tradSpendable })),
              },
              {
                label: 'Roth — spendable (rate-independent)',
                color: '#10b981',
                points: sweep.map((s) => ({ x: s.retirementRatePct, y: s.rothSpendable })),
              },
            ]}
            xLabel="Tax rate in retirement (%)"
            yLabel="Spendable at retirement"
            xFormat={(n) => `${Math.round(n)}%`}
            yFormat={(n) => usdCompact(n)}
            height={280}
            marker={{
              x: clamp(result.breakevenRetirementRatePct, 0, 50),
              label: markerOnScale
                ? `your rate today · ${pct(result.breakevenRetirementRatePct, 0)}`
                : `your rate today · ${pct(result.breakevenRetirementRatePct, 0)} — off scale`,
            }}
            caption="The green Roth line is flat — in the equal-outlay framing nothing about your retirement rate touches it. The blue Traditional line falls one-for-one as the retirement rate rises and crosses the Roth line exactly at your current marginal rate: left of the marker Traditional wins, right of it Roth does. This entire decision compresses into one question — which side of that marker will your withdrawals actually land on?"
          />
        </div>
      </div>
    </div>
  );
}

function LedgerRow({ label, left, right }: { label: string; left: string; right: string }) {
  return (
    <div className="flex items-center justify-between py-2.5">
      <dt className="text-slate-600 dark:text-slate-300">{label}</dt>
      <dd className="readout text-sm font-semibold text-slate-900 dark:text-slate-100">
        {left && <span className="mr-2 text-slate-500 dark:text-slate-400">{left}</span>}
        {right}
      </dd>
    </div>
  );
}

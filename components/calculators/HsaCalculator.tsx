'use client';

import { useEffect, useMemo } from 'react';
import { AlertTriangle, HeartPulse, Info, PiggyBank, RotateCcw, ShieldCheck } from 'lucide-react';
import NumberInput, { AnimatedNumber, CopyButton, SliderControl, StatCard } from '@/components/NumberInput';
import ScenarioButtons from '@/components/ScenarioButtons';
import ComparisonChart from '@/components/ComparisonChart';
import {
  compareHsa,
  hsaLimitFor,
  hsaRateSensitivity,
  HSA_CONSTANTS,
  nonQualifiedWithdrawal,
  type HsaCoverage,
} from '@/lib/hsa';
import { usd, usdCompact, pct, clamp } from '@/lib/format';
import { useWorkbenchInputs, recordRecent } from '@/lib/workbench';

const SLUG = 'hsa-calculator';
const HREF = '/hsa-calculator/';
/**
 * coverageCode (0 self / 1 family) and age55 (0/1) ride along as numbers so
 * saved scenarios and share links carry the whole state.
 */
const DEFAULTS = {
  contribution: 8_550,
  coverageCode: 1,
  age55: 0,
  marginalRate: 24,
  returnRate: 7,
  years: 25,
  medicalShare: 40,
  forfeitShare: 25,
};

const BRACKET_PRESETS = [10, 12, 22, 24, 32, 35, 37];

/** Signed advantage readout: "+$1,234" / "−$1,234" — never "+−$1,234". */
function signedUsd(n: number, digits = 0): string {
  const mag = usd(Math.abs(n), digits);
  return `${n < 0 ? '−' : '+'}${mag}`;
}

/** Site chart palette: emerald = the HSA line. */
const HSA_COLOR = '#059669';

export default function HsaCalculator() {
  const { values, set, reset } = useWorkbenchInputs(SLUG, DEFAULTS);

  useEffect(() => {
    recordRecent(SLUG);
  }, []);

  /*
   * Sanitize restored inputs (deep links / localStorage arrive unclamped) so
   * one normalized set feeds every readout, then write the clean values back —
   * the same convention as the suite's other instruments. The entered
   * contribution is deliberately preserved VERBATIM (only non-finite/negative
   * values normalize to 0): over-limit entries — typed, restored, or left over
   * after switching coverage tier — reach the model unchanged, and the lib
   * caps them and flags `contributionCapped` so the amber warning below is
   * reachable from every interaction path. Clamping here would silently
   * destroy the entry (8,550 → 4,300 on a tier switch) and dead-code the
   * warning. The rate domain [0, 50] spans zero-tax filers through combined
   * federal + state rates (the lib itself accepts up to 85).
   */
  const coverageCode = values.coverageCode === 1 ? 1 : 0;
  const coverage: HsaCoverage = coverageCode === 1 ? 'family' : 'self';
  const age55 = values.age55 === 1;
  const limit = hsaLimitFor(coverage, age55);
  const contribution = Math.max(0, Number.isFinite(values.contribution) ? values.contribution : 0);
  const marginalRate = clamp(values.marginalRate, 0, 50);
  const returnRate = clamp(values.returnRate, 0, 12);
  const years = Math.round(clamp(values.years, 1, 45));
  const medicalShare = clamp(values.medicalShare, 0, 100);
  const forfeitShare = clamp(values.forfeitShare, 0, 100);

  useEffect(() => {
    if (
      values.contribution !== contribution ||
      values.coverageCode !== coverageCode ||
      values.age55 !== (age55 ? 1 : 0) ||
      values.marginalRate !== marginalRate ||
      values.returnRate !== returnRate ||
      values.years !== years ||
      values.medicalShare !== medicalShare ||
      values.forfeitShare !== forfeitShare
    ) {
      set('contribution', contribution);
      set('coverageCode', coverageCode);
      set('age55', age55 ? 1 : 0);
      set('marginalRate', marginalRate);
      set('returnRate', returnRate);
      set('years', years);
      set('medicalShare', medicalShare);
      set('forfeitShare', forfeitShare);
    }
  });

  const result = useMemo(
    () =>
      compareHsa({
        contribution,
        coverage,
        age55,
        marginalRatePct: marginalRate,
        returnRatePct: returnRate,
        years,
        medicalSpendShare: medicalShare / 100,
        forfeitShare: forfeitShare / 100,
      }),
    [contribution, coverage, age55, marginalRate, returnRate, years, medicalShare, forfeitShare],
  );

  const sensitivity = useMemo(
    () => hsaRateSensitivity(
      {
        contribution,
        coverage,
        age55,
        marginalRatePct: marginalRate,
        returnRatePct: returnRate,
        years,
        medicalSpendShare: medicalShare / 100,
        forfeitShare: forfeitShare / 100,
      },
      0,
      50,
    ),
    [contribution, coverage, age55, returnRate, years, medicalShare, forfeitShare],
  );

  // A crisp 20%-penalty readout: cashing out one year's contribution.
  const penaltyDemo = nonQualifiedWithdrawal(result.contribution, marginalRate);

  function resetAll() {
    reset();
  }

  const copySummary = `HSA triple-tax advantage at ${usd(result.contribution, 0)}/yr${
    result.contributionCapped ? ' (entry capped at the statutory limit)' : ''
  } (${coverage === 'family' ? 'family' : 'self-only'} coverage${age55 ? ', 55+ catch-up' : ''}), ${pct(
    marginalRate,
    0,
  )} bracket, ${pct(returnRate, 0)} return, ${years} yrs, ${pct(
    medicalShare,
    0,
  )} spent on care, ${pct(forfeitShare, 0)} forfeited: mixed usage vs the taxable twin ${signedUsd(
    result.mixed.advantage,
  )} (save-to-retire: ${signedUsd(result.saveForLater.advantageDrag)}; spend-as-you-go shield ${usd(
    result.spendNow.taxShield,
    0,
  )}). TY2025 limits, nominal dollars.`;

  return (
    <div className="grid gap-6 lg:grid-cols-5">
      {/* ================= Inputs ================= */}
      <div className="card p-6 sm:p-8 lg:col-span-3">
        <div className="space-y-6">
          {/* Coverage tier: sets the statutory ceiling */}
          <div>
            <p className="label" id="hsa-coverage-label">
              HDHP coverage tier
            </p>
            <div
              role="group"
              aria-labelledby="hsa-coverage-label"
              className="mt-2 grid grid-cols-2 gap-2 rounded-xl bg-slate-100 p-1 dark:bg-white/[0.05]"
            >
              {(
                [
                  { code: 0, label: 'Self-only', hint: `${usd(HSA_CONSTANTS.selfLimit, 0)} limit` },
                  { code: 1, label: 'Family', hint: `${usd(HSA_CONSTANTS.familyLimit, 0)} limit` },
                ] as const
              ).map((opt) => {
                const active = coverageCode === opt.code;
                return (
                  <button
                    key={opt.code}
                    type="button"
                    aria-pressed={active}
                    onClick={() => set('coverageCode', opt.code)}
                    className={`focus-calm rounded-lg px-3 py-2 text-sm font-semibold transition-all duration-150 ${
                      active
                        ? 'bg-white text-emerald-700 shadow-sm dark:bg-emerald-500/20 dark:text-emerald-300'
                        : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
                    }`}
                  >
                    {opt.label}
                    <span className="mt-0.5 block font-mono text-[10px] font-normal uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      {opt.hint}
                    </span>
                  </button>
                );
              })}
            </div>
            <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
              2025 limits (IRS Rev. Proc. 2024-25). Family tier means family HDHP coverage — the limit
              is still per account holder.
            </p>
          </div>

          {/* Age-55 catch-up */}
          <div>
            <span className="label" id="hsa-age55-label">
              Eligible for the age-55 catch-up?
            </span>
            <div className="mt-2 flex gap-1.5" role="group" aria-labelledby="hsa-age55-label">
              {(
                [
                  { key: 0, label: 'No — under 55' },
                  { key: 1, label: 'Yes — 55 or older' },
                ] as const
              ).map((opt) => {
                const active = (age55 ? 1 : 0) === opt.key;
                return (
                  <button
                    key={opt.key}
                    type="button"
                    aria-pressed={active}
                    onClick={() => set('age55', opt.key)}
                    className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 dark:focus-visible:ring-emerald-400 dark:focus-visible:ring-offset-slate-950 ${
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
            <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
              +{usd(HSA_CONSTANTS.catchUp55, 0)} of limit from age 55 (IRC §223(b)(3), statutory) — a
              spouse needs their own HSA for a second catch-up.
            </p>
          </div>

          <div>
            <NumberInput
              id="hsa-contribution"
              label="Annual HSA contribution"
              value={contribution}
              onChange={(n) => set('contribution', Math.max(0, n))}
              min={0}
              prefix="$"
              placeholder="8,550"
              helpText={`Ceiling at your selections: ${usd(limit, 0)} for 2025 — enter more and the model runs the capped amount, flagged below.`}
            />
            <div className="mt-3">
              <SliderControl
                id="hsa-contribution-slider"
                label="Contribution"
                value={clamp(contribution, 0, limit)}
                onChange={(n) => set('contribution', n)}
                min={0}
                max={limit}
                step={50}
                prefix="$"
                presets={[1_000, Math.round(limit / 2), limit]}
                formatValue={(n) => `${usdCompact(n)} · ${pct((n / (limit || 1)) * 100, 0)} of limit`}
              />
            </div>
            {result.contributionCapped && (
              <p className="mt-2 flex items-start gap-2 rounded-lg bg-amber-50 p-2.5 text-xs leading-relaxed text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500 dark:text-amber-400" aria-hidden="true" />
                The statutory limit is the ceiling — the model is running your{' '}
                <strong className="font-semibold">{usd(contribution, 0)}</strong> entry as{' '}
                <strong className="font-semibold">{usd(result.contribution, 0)}</strong> (capped at{' '}
                {usd(limit, 0)}). Excess HSA contributions face a 6% excise tax per year they stay in.
              </p>
            )}
          </div>

          <div className="grid gap-6 sm:grid-cols-2">
            <SliderControl
              id="hsa-rate-slider"
              label="Marginal tax rate"
              value={marginalRate}
              onChange={(n) => set('marginalRate', n)}
              min={0}
              max={50}
              step={1}
              suffix="%"
              presets={BRACKET_PRESETS}
              helpText="Federal bracket your last dollar lands in — add your state rate on top if your state taxes HSA earnings (combined rates reach ≈49%)."
            />
            <SliderControl
              id="hsa-return-slider"
              label="Expected annual return"
              value={returnRate}
              onChange={(n) => set('returnRate', n)}
              min={0}
              max={12}
              step={0.25}
              suffix="%"
              presets={[3, 5, 7, 10]}
              helpText="Before tax, inside the account — the HSA keeps the full rate; the taxable twin keeps only what tax leaves."
            />
          </div>

          <div className="grid gap-6 sm:grid-cols-2">
            <SliderControl
              id="hsa-years-slider"
              label="Years until you draw it down"
              value={years}
              onChange={(n) => set('years', Math.round(n))}
              min={1}
              max={45}
              step={1}
              presets={[10, 20, 25, 40]}
              helpText="Horizon over which the unspent share compounds."
            />
            <SliderControl
              id="hsa-medical-slider"
              label="Share spent on care each year"
              value={medicalShare}
              onChange={(n) => set('medicalShare', n)}
              min={0}
              max={100}
              step={5}
              suffix="%"
              presets={[0, 25, 50, 75]}
              helpText="Of each year's contribution, withdrawn tax-free for that year's qualified medical bills."
            />
          </div>

          <SliderControl
            id="hsa-forfeit-slider"
            label="Share of the balance eventually cashed out non-medically"
            value={forfeitShare}
            onChange={(n) => set('forfeitShare', n)}
            min={0}
            max={100}
            step={5}
            suffix="%"
            presets={[0, 25, 50, 100]}
            helpText={`The "what if I need the money" haircut: that share is taxed as income plus the 20% additional tax (§223(f)(4)). After 65 the 20% goes away.`}
          />
        </div>

        <div className="mt-6 flex items-start gap-2 rounded-lg bg-slate-50 p-3 text-xs leading-relaxed text-slate-600 dark:bg-white/[0.03] dark:text-slate-300">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-slate-400 dark:text-slate-500" aria-hidden="true" />
          <p>
            Both sides of every comparison receive the <em>same pre-tax dollars</em>: the taxable twin
            pays tax first, buys the same care, and invests the rest — its growth is taxed annually at
            your rate (exact for interest-like assets; the article brackets the equity case). Nominal
            dollars, constant limits, no FICA layer — payroll-deducted contributions save an extra
            7.65% that this model never claims.
          </p>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" onClick={resetAll} className="btn-ghost">
            <RotateCcw className="h-4 w-4 text-emerald-600 dark:text-emerald-300" aria-hidden="true" />
            Reset
          </button>
          <CopyButton text={copySummary} label="Copy result" />
          <ScenarioButtons
            slug={SLUG}
            shortTitle="HSA Advantage"
            href={HREF}
            params={{ contribution, coverageCode, age55: age55 ? 1 : 0, marginalRate, returnRate, years, medicalShare, forfeitShare }}
          />
        </div>
      </div>

      {/* ================= Results ================= */}
      <div className="space-y-4 lg:col-span-2">
        {/* Headline verdict at the visitor's own usage mix */}
        <div className="card p-6 sm:p-8">
          <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            <PiggyBank className="h-4 w-4" aria-hidden="true" />
            At your numbers, {years} years out
          </h2>
          <div className="mt-3">
            <div className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
              {result.mixed.advantage >= 0
                ? 'HSA ends ahead of the taxable account by'
                : 'HSA trails the taxable account by'}
            </div>
            <AnimatedNumber
              value={result.mixed.advantage}
              format={(n) => usd(Math.abs(n), 0)}
              className={`readout mt-1 block text-4xl font-extrabold tracking-tight ${
                result.mixed.advantage >= 0
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-rose-600 dark:text-rose-400'
              }`}
            />
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              {pct(medicalShare, 0)} spent on care each year, {pct(forfeitShare, 0)} of the balance
              forfeited at the end.
            </p>
          </div>

          <dl className="mt-5 divide-y divide-slate-100 text-sm dark:divide-white/[0.06]">
            <LedgerRow label="HSA spendable value at year N" hsa={usd(result.mixed.value, 0)} twin={usd(result.mixed.taxableTwinBalance, 0)} />
            <LedgerRow
              label="— balance before the forfeit haircut"
              hsa={usd(result.mixed.balance, 0)}
              twin={<span className="text-slate-400 dark:text-slate-500">—</span>}
            />
            <LedgerRow
              label="— forfeit haircut (income tax + 20%)"
              hsa={`−${usd(result.mixed.forfeitTax + result.mixed.forfeitPenalty, 0)}`}
              twin={<span className="text-slate-400 dark:text-slate-500">—</span>}
            />
            <LedgerRow
              label="Tax never paid on medical spent"
              hsa={usd(result.years * result.mixed.annualMedical * result.rate, 0)}
              twin={<span className="text-slate-400 dark:text-slate-500">—</span>}
            />
          </dl>
          <p className="mt-2 text-right font-mono text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400">
            HSA · taxable twin
          </p>
          {result.mixed.twinBorrowing && (
            <p className="mt-3 flex items-start gap-2 rounded-lg bg-amber-50 p-2.5 text-xs leading-relaxed text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500 dark:text-amber-400" aria-hidden="true" />
              Care above {pct(100 - marginalRate, 0)} of the contribution is more than the taxable
              twin can buy after tax — the twin is modeled as borrowing{' '}
              {usd(Math.abs(result.mixed.twinAnnualInvestment), 0)}/yr to keep the same care. That is
              the spend-through-HSA benefit in its purest form.
            </p>
          )}
        </div>

        {/* The three usages as value tiles */}
        <div className="grid gap-3">
          <StatCard
            label="Spend as you go"
            value={usd(result.spendNow.taxShield, 0)}
            sublabel={`tax never paid on ${result.years} years of medical dollars, held as cash (${usd(
              result.spendNow.taxShieldCompounded,
              0,
            )} if the twin's borrowing compounded)`}
          />
          <StatCard
            label="Save to retire — HSA balance"
            value={usd(result.saveForLater.balance, 0)}
            sublabel={`tax-free for medical · ${usd(result.saveForLater.post65AnyUse, 0)} if used for anything after 65`}
            emphasis
          />
          <StatCard
            label="Save to retire — taxable twin"
            value={usd(result.saveForLater.taxableTwinDrag, 0)}
            sublabel={`growth taxed yearly · ${usd(result.saveForLater.taxableTwinNoDrag, 0)} even with zero drag — the HSA still wins both`}
          />
        </div>

        {/* The 20% caliber */}
        <div className="card p-6">
          <h3 className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-slate-100">
            <ShieldCheck className="h-4 w-4 text-amber-500 dark:text-amber-400" aria-hidden="true" />
            The non-medical exit, priced
          </h3>
          <p className="mt-2 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
            Cashing out one year&apos;s {usd(result.contribution, 0)} contribution for non-medical use
            before 65 costs {usd(penaltyDemo.incomeTax, 0)} of income tax plus{' '}
            {usd(penaltyDemo.additionalTax, 0)} of 20% additional tax —{' '}
            <strong className="text-slate-900 dark:text-white">{usd(penaltyDemo.net, 0)} survives</strong>.
            After 65 the 20% disappears (the income tax stays): the account becomes a traditional-IRA
            fallback with medical withdrawals still free.
          </p>
        </div>

        {/* Eligibility reminder */}
        <div className="card p-6">
          <h3 className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-slate-100">
            <HeartPulse className="h-4 w-4 text-emerald-500 dark:text-emerald-400" aria-hidden="true" />
            The eligibility gate
          </h3>
          <p className="mt-2 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
            Contributions require <strong className="text-slate-900 dark:text-white">you</strong> to be
            covered by an HDHP all month — the family tier means your own plan covers the family, not
            that any member&apos;s HDHP qualifies you: 2025 deductible ≥{' '}
            {usd(HSA_CONSTANTS.hdhpMinDeductibleSelf, 0)} self-only /{' '}
            {usd(HSA_CONSTANTS.hdhpMinDeductibleFamily, 0)} family, out-of-pocket cap ≤{' '}
            {usd(HSA_CONSTANTS.hdhpMaxOutOfPocketSelf, 0)} / {usd(HSA_CONSTANTS.hdhpMaxOutOfPocketFamily, 0)} —
            and no other non-HDHP medical coverage of yours (a general-purpose FSA blocks you).
            Medicare enrollment ends eligibility from its first month.
          </p>
        </div>
      </div>

      {/* ================= Three-usage comparison ================= */}
      <div className="lg:col-span-5">
        <div className="card p-5 sm:p-6">
          <div className="mb-5 flex flex-wrap items-baseline justify-between gap-2">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Three ways to use the same dollars
              </h3>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                Same take-home cost on every row — the taxable twin earmarks the identical pre-tax{' '}
                {usd(result.contribution, 0)} and buys the same care. Values at year {result.years}.
              </p>
            </div>
            <span className="readout rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600 dark:bg-white/[0.05] dark:text-slate-300">
              now: mixed usage {signedUsd(result.mixed.advantage)}
            </span>
          </div>

          <div className="space-y-6">
            <UsageRow
              title="Spend as you go"
              description={`Every contribution pays that year's medical bills tax-free. Value = the ${usd(
                result.spendNow.taxShield,
                0,
              )} of income tax never paid (uninvested; ${usd(result.spendNow.taxShieldCompounded, 0)} if compounded at the twin's rate).`}
              hsaValue={result.spendNow.taxShield}
              twinValue={0}
              note="The floor of the strategy: even with zero balance, the deduction alone pays."
            />
            <UsageRow
              title="Save to retire"
              description={`Nothing spent — the full ${usd(result.contribution, 0)} compounds at ${pct(
                returnRate,
                0,
              )} and medical bills ride in outside cash.`}
              hsaValue={result.saveForLater.balance}
              twinValue={result.saveForLater.taxableTwinDrag}
              twinAltValue={result.saveForLater.taxableTwinNoDrag}
              note={`HSA ${usd(result.saveForLater.balance, 0)} vs twin ${usd(
                result.saveForLater.taxableTwinDrag,
                0,
              )} (or ${usd(result.saveForLater.taxableTwinNoDrag, 0)} with zero drag) — the advantage survives both bounds: ${usd(
                result.saveForLater.advantageDrag,
                0,
              )} / ${usd(result.saveForLater.advantageNoDrag, 0)}.`}
              emphasis
            />
            <UsageRow
              title={`Mixed — your ${pct(medicalShare, 0)} / ${pct(forfeitShare, 0)} mix`}
              description={`${usd(result.mixed.annualMedical, 0)}/yr of care paid tax-free, the rest compounding; ${pct(
                forfeitShare,
                0,
              )} of the ending balance assumed cashed out non-medically (taxed + 20%).`}
              hsaValue={result.mixed.value}
              twinValue={result.mixed.taxableTwinBalance}
              note={
                result.mixed.twinBorrowing
                  ? `The twin cannot buy this care after tax — it borrows ${usd(
                      Math.abs(result.mixed.twinAnnualInvestment),
                      0,
                    )}/yr to keep up.`
                  : `Forfeit haircut: ${usd(result.mixed.forfeitTax + result.mixed.forfeitPenalty, 0)} (income tax + 20% additional tax).`
              }
            />
          </div>
        </div>
      </div>

      {/* ================= Rate sensitivity ================= */}
      <div className="lg:col-span-5">
        <div className="card p-5 sm:p-6">
          <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Advantage vs your marginal rate
              </h3>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                Everything else held at your inputs; 0–50% spans zero-tax filers through combined
                federal + state rates (federal brackets alone run 10–37%).
              </p>
            </div>
            <span className="readout rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600 dark:bg-white/[0.05] dark:text-slate-300">
              now: {pct(marginalRate, 0)} → {signedUsd(result.mixed.advantage)} mixed ·{' '}
              {signedUsd(result.saveForLater.advantageDrag)} saved
            </span>
          </div>
          <ComparisonChart
            series={[
              {
                label: `Mixed usage advantage (${pct(medicalShare, 0)} spent, ${pct(forfeitShare, 0)} forfeited)`,
                color: HSA_COLOR,
                points: sensitivity.map((s) => ({ x: s.rate, y: s.mixed })),
              },
              {
                label: 'Save-to-retire advantage',
                color: '#6366f1',
                dashed: true,
                points: sensitivity.map((s) => ({ x: s.rate, y: s.saveAll })),
              },
            ]}
            xLabel="Marginal tax rate (%)"
            yLabel="HSA advantage at year N"
            xFormat={(n) => `${Math.round(n)}%`}
            yFormat={(n) => usdCompact(n)}
            yMinMode="auto"
            height={280}
            marker={{ x: clamp(marginalRate, 0, 50), label: 'your rate' }}
            markerColor={HSA_COLOR}
            caption="Both lines rise with the bracket — the deduction is worth more, and the taxable twin's after-tax investment and growth both shrink. At a 0% rate there is no deduction to claim, so the mixed line starts below zero: the forfeited share still pays income-tax-plus-20%, and only the rising bracket digs the strategy out of that hole (with nothing forfeited, zero tax is a wash, not a loss). The dashed save-to-retire line runs above your mixed line to the extent you spend or forfeit dollars that would otherwise compound tax-free; the vertical gap between them is the price of not letting the whole balance ride. Every point is the full model recomputed, not a linear approximation."
          />
        </div>
      </div>
    </div>
  );
}

function LedgerRow({ label, hsa, twin }: { label: string; hsa: string; twin: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2.5">
      <dt className="text-slate-600 dark:text-slate-300">{label}</dt>
      <dd className="readout whitespace-nowrap text-sm font-semibold text-slate-900 dark:text-slate-100">
        <span className="text-slate-500 dark:text-slate-400">{hsa}</span>
        <span className="mx-2 text-slate-300 dark:text-slate-600">/</span>
        {twin}
      </dd>
    </div>
  );
}

/**
 * One usage row: two horizontal bars (HSA vs taxable twin) scaled to the
 * group's own maximum, with exact values as text so the bars are decoration,
 * never the data. Purely presentational — the numbers above are the source of
 * truth and remain fully visible in print.
 */
function UsageRow({
  title,
  description,
  note,
  hsaValue,
  twinValue,
  twinAltValue,
  emphasis = false,
}: {
  title: string;
  description: string;
  note: string;
  hsaValue: number;
  twinValue: number;
  /** Optional second twin bar (the zero-drag bound). */
  twinAltValue?: number;
  emphasis?: boolean;
}) {
  const scale = Math.max(hsaValue, Math.abs(twinValue), twinAltValue ?? 0, 1);
  const w = (v: number) => `${Math.max(0, (v / scale) * 100)}%`;
  return (
    <div
      className={`rounded-xl border p-4 ${
        emphasis
          ? 'border-emerald-200 bg-emerald-50/40 dark:border-emerald-500/25 dark:bg-emerald-500/[0.06]'
          : 'border-slate-200 bg-slate-50/40 dark:border-white/[0.08] dark:bg-white/[0.02]'
      }`}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h4 className={`text-sm font-bold ${emphasis ? 'text-emerald-800 dark:text-emerald-300' : 'text-slate-900 dark:text-slate-100'}`}>
          {title}
        </h4>
        <span
          className={`readout text-xs font-semibold ${
            hsaValue - twinValue >= 0
              ? 'text-emerald-700 dark:text-emerald-400'
              : 'text-rose-700 dark:text-rose-400'
          }`}
        >
          {signedUsd(hsaValue - twinValue)}{' '}
          <span className="font-normal text-slate-500 dark:text-slate-400">advantage</span>
        </span>
      </div>
      <p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">{description}</p>

      <div className="mt-3 space-y-2">
        <Bar label="HSA" value={hsaValue} width={w(hsaValue)} className="bg-emerald-500 dark:bg-emerald-400" />
        <Bar
          label="Taxable twin"
          value={twinValue}
          width={w(Math.max(0, twinValue))}
          className="bg-sky-500 dark:bg-sky-400"
          negative={twinValue < 0}
        />
        {twinAltValue !== undefined && (
          <Bar label="Twin, zero drag" value={twinAltValue} width={w(twinAltValue)} className="bg-sky-300 dark:bg-sky-500/60" />
        )}
      </div>

      <p className="mt-3 text-xs leading-relaxed text-slate-600 dark:text-slate-300">{note}</p>
    </div>
  );
}

function Bar({
  label,
  value,
  width,
  className,
  negative = false,
}: {
  label: string;
  value: number;
  width: string;
  className: string;
  negative?: boolean;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-24 shrink-0 text-right text-[11px] font-medium text-slate-500 dark:text-slate-400">{label}</span>
      <div className="h-4 flex-1 overflow-hidden rounded-full bg-slate-200/80 dark:bg-white/[0.06]" aria-hidden="true">
        <div className={`h-full rounded-full transition-all duration-500 ${className}`} style={{ width }} />
      </div>
      <span
        className={`readout w-28 shrink-0 text-right text-xs font-semibold ${
          negative ? 'text-rose-600 dark:text-rose-400' : 'text-slate-900 dark:text-slate-100'
        }`}
      >
        {negative ? '−' : ''}${Math.abs(Math.round(value)).toLocaleString('en-US')}
      </span>
    </div>
  );
}

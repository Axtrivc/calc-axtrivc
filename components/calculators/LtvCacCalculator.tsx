'use client';

import { useEffect, useMemo } from 'react';
import { AlertTriangle, Info, RotateCcw, Scale, TrendingDown } from 'lucide-react';
import NumberInput, { AnimatedNumber, CopyButton, SliderControl, StatCard } from '@/components/NumberInput';
import ScenarioButtons from '@/components/ScenarioButtons';
import {
  LTV_CAC_PRESETS,
  PAYBACK_HEALTHY_MONTHS,
  RATIO_HEALTHY,
  churnAtRatio,
  churnScan,
  churnSensitivity,
  computeLtvCac,
  discountedLtv,
  scanBand,
} from '@/lib/ltvcac';
import { numFmt, pct, usd } from '@/lib/format';
import { useWorkbenchInputs, recordRecent } from '@/lib/workbench';

const SLUG = 'ltv-cac-calculator';
const HREF = '/ltv-cac-calculator/';
/** discount = annual discount rate in % (0 = off). Kept numeric so state stays Record<string, number>. */
const DEFAULTS = { ...LTV_CAC_PRESETS[0].inputs, discount: 0 };
const DISCOUNT_CHOICES = [0, 8, 10, 12, 15, 20];

export default function LtvCacCalculator() {
  const { values, set, reset } = useWorkbenchInputs(SLUG, DEFAULTS);
  const { arpu, grossMarginPct, churnPct, smSpend, newCustomers, discount } = values;

  useEffect(() => {
    recordRecent(SLUG);
  }, []);

  const result = useMemo(
    () => computeLtvCac({ arpu, grossMarginPct, churnPct, smSpend, newCustomers }),
    [arpu, grossMarginPct, churnPct, smSpend, newCustomers],
  );
  const ltvDisc = useMemo(
    () => discountedLtv({ arpu, grossMarginPct, churnPct, smSpend, newCustomers }, discount),
    [arpu, grossMarginPct, churnPct, discount],
  );
  const sensitivity = useMemo(
    () => churnSensitivity({ arpu, grossMarginPct, churnPct, smSpend, newCustomers }),
    [arpu, grossMarginPct, churnPct, smSpend, newCustomers],
  );
  // Churn at which the ratio crosses the 3× rule of thumb — the retention
  // target implied by the acquisition cost (null when it cannot be crossed).
  const churnFor3x = useMemo(
    () => churnAtRatio({ arpu, grossMarginPct, churnPct, smSpend, newCustomers }, RATIO_HEALTHY),
    [arpu, grossMarginPct, smSpend, newCustomers],
  );
  // Scan band — widened when the 3× crossing sits just beyond the default
  // right edge (within 1.5× of it) so the caption's critical point is visible
  // ON the drawn curve instead of referenced out of band.
  const band = useMemo(() => {
    const b = scanBand(churnPct);
    if (churnFor3x !== null && churnFor3x > b.to && churnFor3x <= b.to * 1.5) {
      return { from: b.from, to: churnFor3x * 1.06 };
    }
    return b;
  }, [churnPct, churnFor3x]);
  const scan = useMemo(
    () => churnScan({ arpu, grossMarginPct, churnPct, smSpend, newCustomers }, band.from, band.to, 49),
    [arpu, grossMarginPct, churnPct, smSpend, newCustomers, band.from, band.to],
  );

  const activePreset = LTV_CAC_PRESETS.find(
    (p) =>
      Math.abs(p.inputs.arpu - arpu) < 0.01 &&
      Math.abs(p.inputs.grossMarginPct - grossMarginPct) < 0.01 &&
      Math.abs(p.inputs.churnPct - churnPct) < 0.01 &&
      Math.abs(p.inputs.smSpend - smSpend) < 0.01 &&
      Math.abs(p.inputs.newCustomers - newCustomers) < 0.01,
  );

  // ---- Verdict state machine ----
  const { cac, ratio, paybackChurnAdjusted, zeroChurn, zeroSpend, monthlyGrossProfit } = result;
  const cacDefined = cac !== null && cac > 0;
  const ratioHealthy = ratio !== null && ratio >= RATIO_HEALTHY;
  const paybackHealthy = paybackChurnAdjusted !== null && paybackChurnAdjusted <= PAYBACK_HEALTHY_MONTHS;
  const bothHealthy = ratioHealthy && paybackHealthy;
  const destroysValue = ratio !== null && ratio < 1;
  // At LTV = CAC exactly (ratio = 1) the churn-adjusted payback diverges just
  // as it does below 1 — the headline, the StatCard and the verdict all read
  // "never" there, never a mixed "—"/"never"/"never-completing".
  const neverRecovers = ratio !== null && ratio <= 1;

  const verdict =
    !cacDefined && newCustomers <= 0
      ? {
          tone: 'slate' as const,
          headline: 'CAC undefined — no new customers entered',
          detail: `With ${usd(smSpend, 0)}/mo of spend and no customers won, there is no acquisition cost to compare against. Enter the customer count that spend actually delivers.`,
        }
      : zeroSpend
        ? {
            tone: 'slate' as const,
            headline: 'No acquisition spend — CAC is $0',
            detail: 'Organic-only acquisition makes every ratio readout vacuous (LTV ÷ $0). The LTV figures below stand on their own; the ratio and payback views need a paid motion to meaning.',
          }
        : zeroChurn
          ? {
              tone: 'amber' as const,
              headline: 'Zero churn — the lifetime is unbounded',
              detail: `LTV of ${usd(monthlyGrossProfit)}/mo per customer with no attrition never stops accumulating, so no finite LTV exists${
                discount > 0
                  ? ` (a ${discount}%/yr discount rate bounds it at ${usd(ltvDisc ?? 0, 0)})`
                  : ' (a discount rate would bound it)'
              }. Enter a realistic churn rate — even excellent products lose customers.`,
            }
          : destroysValue
            ? {
                tone: 'rose' as const,
                headline: `Every acquisition destroys ${pct((1 - (ratio ?? 0)) * 100, 0)} of value`,
                detail: `LTV ${usd(result.ltv ?? 0, 0)} does not cover CAC ${usd(cac ?? 0, 0)}: in expectation, each customer bought for ${usd(cac ?? 0, 0)} returns only ${usd(result.ltv ?? 0, 0)} of lifetime gross profit. Fix retention, price, or spend before scaling this motion.`,
              }
            : bothHealthy
              ? {
                  tone: 'emerald' as const,
                  headline: `Healthy on both rules of thumb`,
                  detail: `LTV:CAC ${numFmt(ratio ?? 0, 1)}× clears the 3× bar and the churn-adjusted payback of ${numFmt(paybackChurnAdjusted ?? 0, 1)} months is inside 12 — acquisition is buying value faster than churn destroys it.`,
                }
              : ratioHealthy
                ? {
                    tone: 'amber' as const,
                    headline: 'Value per customer clears 3×, but payback is slow',
                    detail: `LTV:CAC ${numFmt(ratio ?? 0, 1)}× is healthy, yet the churn-adjusted payback of ${paybackChurnAdjusted === null ? '∞' : `${numFmt(paybackChurnAdjusted, 1)} months`} exceeds ${PAYBACK_HEALTHY_MONTHS} months — the classic sales-led trap: high LTV, slow cash. Cheaper acquisition or faster initial billing moves this leg.`,
                  }
                : paybackHealthy
                  ? {
                      tone: 'amber' as const,
                      headline: 'Fast payback, thin lifetime value',
                      detail: `Cash recovers in ${numFmt(paybackChurnAdjusted ?? 0, 1)} months, but LTV:CAC of ${numFmt(ratio ?? 0, 1)}× is under the 3× bar — churn is eating the lifetime faster than price and margin build it. The churn sensitivity below is the lever to pull.`,
                    }
                  : {
                      tone: 'amber' as const,
                      headline: 'Below both rules of thumb',
                      detail: `LTV:CAC ${numFmt(ratio ?? 0, 1)}× with a ${paybackChurnAdjusted === null ? 'never-completing' : `${numFmt(paybackChurnAdjusted, 1)}-month`} payback. The scan below shows where these numbers would have to move.`,
                    };

  const copySummary = `SaaS unit economics: ARPU ${usd(arpu, 0)}/mo at ${pct(grossMarginPct, 0)} gross margin, ${pct(churnPct, 1)}/mo churn (${pct(result.annualChurnPct, 1)}/yr) → LTV ${zeroChurn ? '∞' : usd(result.ltv ?? 0, 0)}${discount > 0 ? ` (${usd(ltvDisc ?? 0, 0)} discounted @ ${discount}%/yr)` : ''}. CAC ${cac === null ? 'undefined' : usd(cac, 0)} (${usd(smSpend, 0)}/mo ÷ ${numFmt(newCustomers, 0)} customers). LTV:CAC ${ratio === null ? '—' : `${numFmt(ratio, 1)}×`}, churn-adjusted payback ${zeroSpend ? 'n/a (no spend)' : paybackChurnAdjusted === null ? (zeroChurn ? 'n/a' : cac === null ? '—' : 'never') : `${numFmt(paybackChurnAdjusted, 1)} mo`}. 3× / 12-month bars are industry rules of thumb, not laws.`;

  // ---- Chart data (guarded — charts need a defined CAC to mean anything) ----
  const ratioPoints = scan.map((p) => ({ x: p.churnPct, y: p.ratio }));
  const paybackPoints = scan.map((p) => ({ x: p.churnPct, y: p.paybackChurnAdjusted }));
  // The churn at which expected LTV exactly equals CAC — payback diverges there.
  const divergeChurn = cacDefined && monthlyGrossProfit > 0 ? (monthlyGrossProfit / (cac as number)) * 100 : null;
  // Band-edge readouts so the chart captions state only what the drawn curve
  // actually shows — critical points beyond the band are called out as such,
  // never silently referenced off-graph.
  const ratioAtEdge = scan.length ? scan[scan.length - 1].ratio : null;
  const paybacksInBand = scan
    .map((p) => p.paybackChurnAdjusted)
    .filter((v): v is number => v !== null);
  const paybackBandLo = paybacksInBand.length ? Math.min(...paybacksInBand) : null;
  const paybackBandHi = paybacksInBand.length ? Math.max(...paybacksInBand) : null;
  const crossingInBand = churnFor3x !== null && churnFor3x >= band.from && churnFor3x <= band.to;
  const divergeInBand = divergeChurn !== null && divergeChurn > band.from && divergeChurn < band.to;

  const ratioTone =
    verdict.tone === 'emerald'
      ? 'text-emerald-600 dark:text-emerald-400'
      : verdict.tone === 'rose'
        ? 'text-rose-600 dark:text-rose-400'
        : 'text-slate-700 dark:text-slate-200';

  return (
    <div className="grid gap-6 lg:grid-cols-5">
      {/* ================= Inputs ================= */}
      <div className="card p-6 sm:p-8 lg:col-span-2">
        <h2 className="mb-6 text-base font-semibold text-slate-900 dark:text-slate-100">
          Your unit economics
        </h2>

        {/* Acquisition-motion presets */}
        <div role="group" aria-label="Acquisition motion presets" className="mb-6">
          <p className="label mb-2">Start from a motion</p>
          <div className="flex flex-wrap gap-1.5">
            {LTV_CAC_PRESETS.map((p) => {
              const active = activePreset?.id === p.id;
              return (
                <PillButton
                  key={p.id}
                  active={active}
                  onClick={() => {
                    set('arpu', p.inputs.arpu);
                    set('grossMarginPct', p.inputs.grossMarginPct);
                    set('churnPct', p.inputs.churnPct);
                    set('smSpend', p.inputs.smSpend);
                    set('newCustomers', p.inputs.newCustomers);
                  }}
                >
                  {p.label}
                </PillButton>
              );
            })}
          </div>
          <p className="mt-2 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
            {activePreset
              ? activePreset.description
              : 'Custom inputs — the model below is the same for any subscription business, B2B or B2C.'}
          </p>
        </div>

        <div className="space-y-6">
          <div>
            <NumberInput
              id="ltvcac-arpu"
              label="ARPU — revenue per customer / month"
              value={arpu}
              onChange={(n) => set('arpu', n)}
              min={0}
              max={100000}
              prefix="$"
              placeholder="100"
              helpText="Average monthly revenue per active customer. For a flat-rate product this is simply the monthly fee; for tiers, revenue ÷ active customers."
            />
            <div className="mt-3">
              <SliderControl
                id="ltvcac-arpu-slider"
                label=""
                ariaLabel="ARPU per month"
                value={arpu}
                onChange={(n) => set('arpu', n)}
                min={0}
                max={1000}
                step={1}
                prefix="$"
                presets={[19, 49, 99, 199]}
              />
            </div>
          </div>

          <div>
            <NumberInput
              id="ltvcac-margin"
              label="Gross margin"
              value={grossMarginPct}
              onChange={(n) => set('grossMarginPct', n)}
              min={0}
              max={100}
              suffix="%"
              placeholder="80"
              helpText="(Revenue − COGS) ÷ revenue. COGS = hosting, support, payment fees, third-party APIs — never S&M or R&D. SaaS typically runs 70–85%."
            />
            <div className="mt-3">
              <SliderControl
                id="ltvcac-margin-slider"
                label=""
                ariaLabel="Gross margin percent"
                value={grossMarginPct}
                onChange={(n) => set('grossMarginPct', n)}
                min={0}
                max={100}
                step={1}
                suffix="%"
                presets={[50, 70, 80, 90]}
              />
            </div>
          </div>

          <div>
            <NumberInput
              id="ltvcac-churn"
              label="Monthly logo churn"
              value={churnPct}
              onChange={(n) => set('churnPct', n)}
              min={0}
              max={100}
              step={0.1}
              suffix="%"
              placeholder="4"
              helpText={`Share of customers cancelling each month. Your entry compounds to ${pct(result.annualChurnPct, 1)}/yr — not ${pct(churnPct * 12, 0)}, because churn compounds.`}
            />
            <div className="mt-3">
              <SliderControl
                id="ltvcac-churn-slider"
                label=""
                ariaLabel="Monthly churn percent"
                value={churnPct}
                onChange={(n) => set('churnPct', n)}
                min={0}
                max={15}
                step={0.1}
                suffix="%"
                presets={[1, 2, 3, 5, 8]}
              />
            </div>
          </div>

          <div>
            <NumberInput
              id="ltvcac-spend"
              label="Sales & marketing spend / month"
              value={smSpend}
              onChange={(n) => set('smSpend', n)}
              min={0}
              max={10000000}
              prefix="$"
              placeholder="24,000"
              helpText="Everything that wins customers: ads, S&M salaries and commissions, agency fees, sales tools. Product and support costs belong to margin, not here."
            />
            <div className="mt-3">
              <SliderControl
                id="ltvcac-spend-slider"
                label=""
                ariaLabel="Sales and marketing spend per month"
                value={smSpend}
                onChange={(n) => set('smSpend', n)}
                min={0}
                max={500000}
                step={500}
                prefix="$"
                logarithmic
                presets={[5000, 18000, 60000, 120000]}
              />
            </div>
          </div>

          <div>
            <NumberInput
              id="ltvcac-new"
              label="New customers / month"
              value={newCustomers}
              onChange={(n) => set('newCustomers', n)}
              min={0}
              max={100000}
              placeholder="120"
              helpText="Customers actually won with that spend, blended across paid and organic channels (organic inflates the count — see the guide's blended-CAC caveat)."
            />
            <div className="mt-3">
              <SliderControl
                id="ltvcac-new-slider"
                label=""
                ariaLabel="New customers per month"
                value={newCustomers}
                onChange={(n) => set('newCustomers', n)}
                min={0}
                max={2000}
                step={5}
                presets={[25, 90, 120, 250]}
              />
            </div>
          </div>

          {/* Optional time-value-of-money on LTV */}
          <div>
            <span className="label" id="ltvcac-discount-label">
              Discount LTV at a cost of capital?
            </span>
            <div className="mt-2 flex flex-wrap gap-1.5" role="group" aria-labelledby="ltvcac-discount-label">
              {DISCOUNT_CHOICES.map((d) => {
                const active = discount === d;
                return (
                  <PillButton
                    key={d}
                    active={active}
                    onClick={() => set('discount', d)}
                    ariaLabel={d === 0 ? 'No discounting — undiscounted LTV' : `Discount LTV at ${d} percent per year`}
                  >
                    {d === 0 ? 'Off' : `${d}%/yr`}
                  </PillButton>
                );
              })}
            </div>
            <p className="mt-1.5 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
              A dollar of gross profit in year three is not worth a dollar today. With discounting on, the
              monthly rate simply adds to churn — 8–15%/yr is typical private-company practice; the 20%
              rung stresses it further.
            </p>
          </div>
        </div>

        <div className="mt-6 flex items-start gap-2 rounded-lg bg-slate-50 p-3 text-xs leading-relaxed text-slate-600 dark:bg-white/[0.03] dark:text-slate-300">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-slate-400 dark:text-slate-500" aria-hidden="true" />
          <p>
            All figures monthly and blended. LTV is computed on the <strong>gross-margin basis</strong> —
            each surviving month contributes {usd(result.monthlyGrossProfit)} of gross profit, not{' '}
            {usd(arpu)} of revenue. Constant ARPU and churn, no expansion revenue; the guide covers
            where those assumptions bend.
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
            shortTitle="LTV:CAC"
            href={HREF}
            params={{ arpu, grossMarginPct, churnPct, smSpend, newCustomers, discount }}
          />
        </div>
      </div>

      {/* ================= Results ================= */}
      <div className="space-y-4 lg:col-span-3">
        {/* Headline ratio + verdict */}
        <div className="card p-6 sm:p-8">
          <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            <Scale className="h-4 w-4" aria-hidden="true" />
            Verdict at these numbers
          </h2>
          <div className="mt-3 flex flex-wrap items-end gap-x-6 gap-y-2">
            <div>
              {zeroChurn || !cacDefined ? (
                <span className={`readout block text-5xl font-extrabold tracking-tight ${ratioTone}`}>
                  {zeroChurn ? '∞' : '—'}
                </span>
              ) : (
                <AnimatedNumber
                  value={ratio ?? 0}
                  format={(n) => `${numFmt(n, 1)}×`}
                  className={`readout block text-5xl font-extrabold tracking-tight ${ratioTone}`}
                />
              )}
              <span className="text-sm font-medium text-slate-500 dark:text-slate-400">
                LTV : CAC
                {result.ltv !== null && cac !== null && cac > 0 && (
                  <>
                    {' '}
                    — {usd(result.ltv, 0)} vs {usd(cac, 0)}
                  </>
                )}
              </span>
            </div>
            <div className="pb-1">
              <div className="readout text-2xl font-bold text-slate-700 dark:text-slate-200">
                {zeroChurn ? (
                  'unbounded'
                ) : zeroSpend ? (
                  'n/a'
                ) : paybackChurnAdjusted === null ? (
                  neverRecovers ? 'never' : '—'
                ) : (
                  `${numFmt(paybackChurnAdjusted, 1)} mo`
                )}
              </div>
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                churn-adjusted CAC payback{zeroSpend ? ' — no spend to recover' : ''}
              </span>
            </div>
          </div>
          <p className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
            <strong
              className={
                verdict.tone === 'emerald'
                  ? 'text-emerald-700 dark:text-emerald-300'
                  : verdict.tone === 'rose'
                    ? 'text-rose-700 dark:text-rose-300'
                    : 'text-slate-900 dark:text-slate-100'
              }
            >
              {verdict.headline}.
            </strong>{' '}
            {verdict.detail}
          </p>
          <div className="mt-4 flex items-start gap-2 rounded-lg bg-amber-50 p-2.5 text-xs leading-relaxed text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500 dark:text-amber-400" aria-hidden="true" />
            <p>
              The 3× and {PAYBACK_HEALTHY_MONTHS}-month bars are <strong>industry rules of thumb</strong>
              {' '}— operator heuristics from SaaS practice canon, not laws. A 2.8× ratio on an instant-payback
              self-serve motion can out-earn a 3.5× ratio on a slow enterprise one; treat the bars as
              tripwires for questions, not verdicts.
            </p>
          </div>
        </div>

        {/* Metric grid */}
        <div className="grid grid-cols-2 gap-4">
          <StatCard
            label="LTV — gross-margin basis"
            value={zeroChurn ? '∞' : usd(result.ltv ?? 0, 0)}
            sublabel={
              zeroChurn
                ? 'zero churn — lifetime unbounded'
                : `${usd(result.monthlyGrossProfit)}/mo of gross profit × ${numFmt(result.lifetimeMonths ?? 0, 1)}-mo expected lifetime`
            }
            emphasis
          />
          <StatCard
            label="Discounted LTV"
            value={
              discount === 0
                ? '—'
                : ltvDisc === null
                  ? zeroChurn
                    ? '∞'
                    : '—'
                  : usd(ltvDisc, 0)
            }
            sublabel={
              discount === 0
                ? 'discounting off — toggle a rate in the inputs'
                : `at ${discount}%/yr — monthly rate adds to churn`
            }
          />
          <StatCard
            label="Blended CAC"
            value={cac === null ? '—' : usd(cac, 0)}
            sublabel={
              cac === null
                ? 'no new customers entered'
                : `${usd(smSpend, 0)}/mo ÷ ${numFmt(newCustomers, 0)} customers`
            }
          />
          <StatCard
            label="CAC payback — churn-adjusted"
            value={
              zeroSpend
                ? '—'
                : paybackChurnAdjusted === null
                  ? zeroChurn
                    ? 'n/a'
                    : cac === null
                      ? '—'
                      : 'never'
                  : `${numFmt(paybackChurnAdjusted, 1)} mo`
            }
            sublabel={
              zeroSpend
                ? 'no acquisition spend — nothing to recover'
                : result.paybackMonths === null
                  ? 'no gross profit to amortize against'
                  : `${numFmt(result.paybackMonths, 1)}-mo simple payback, before churn losses`
            }
          />
        </div>

        {/* The wrong-formula contrast */}
        {result.revenueBasisOverstatementPct !== null && result.revenueBasisOverstatementPct > 0.5 && (
          <div className="rounded-xl border border-rose-200 bg-rose-50/60 p-4 dark:border-rose-500/25 dark:bg-rose-500/[0.07]">
            <h3 className="flex items-center gap-2 text-sm font-bold text-rose-700 dark:text-rose-300">
              <AlertTriangle className="h-4 w-4" aria-hidden="true" />
              What the revenue-basis shortcut would tell you
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-rose-700/90 dark:text-rose-300/90">
              LTV computed as ARPU ÷ churn — ignoring margin — reads{' '}
              <strong className="readout">{usd(result.ltvRevenueBasis ?? 0, 0)}</strong> instead of{' '}
              <strong className="readout">{usd(result.ltv ?? 0, 0)}</strong>: a{' '}
              <strong className="readout">{pct(result.revenueBasisOverstatementPct, 0)} overstatement</strong>
              {' '}(exactly 1 ÷ {pct(grossMarginPct, 0)} − 1). Every dollar of that gap is cost of
              serving the customer that the shortcut pretends is free.
            </p>
          </div>
        )}
      </div>

      {/* ================= LTV:CAC vs churn scan ================= */}
      <div className="lg:col-span-5">
        {cacDefined && !zeroChurn ? (
          <ScanChart
            id="ltvcac-scan-ratio"
            title="LTV : CAC vs monthly churn"
            subtitle={`Every point re-solves the full model at that churn — ARPU ${usd(arpu, 0)}, margin ${pct(grossMarginPct, 0)}, CAC ${usd(cac ?? 0, 0)} held fixed. Scan ${pct(band.from, 1)}–${pct(band.to, 1)}/mo.`}
            points={ratioPoints}
            xMarker={churnPct}
            markerLabel={`your churn ${pct(churnPct, 1)}`}
            threshold={RATIO_HEALTHY}
            healthySide="above"
            thresholdLabel={`healthy ≥ ${RATIO_HEALTHY}× (rule of thumb)`}
            yCap={Math.max(RATIO_HEALTHY * 4, (ratio ?? 0) * 2.2)}
            xLabel="Monthly logo churn"
            yLabel="LTV : CAC"
            xFormat={(n) => `${n.toFixed(n < 10 ? 1 : 0)}%`}
            yFormat={(n) => `${numFmt(n, n < 10 ? 1 : 0)}×`}
            color="#6366f1"
            legendLabel="LTV : CAC at each churn rate"
            ariaLabel={`LTV to CAC ratio versus monthly churn. Healthy region above ${RATIO_HEALTHY} times. Your churn ${pct(churnPct, 1)} per month gives ${ratio === null ? 'undefined' : `${numFmt(ratio, 1)} times`}.`}
            caption={`The curve is a hyperbola — LTV = ${usd(result.monthlyGrossProfit)}/mo ÷ churn, so halving churn doubles the ratio (exact in the model; the axis rounds for display). ${
              churnFor3x === null
                ? 'No churn rate clears the 3× bar at this acquisition cost — the fix has to come from price, margin, or CAC itself.'
                : churnFor3x > 100
                  ? `With a CAC this low, no churn rate in the possible range (up to 100%/mo) drops the ratio below the ${RATIO_HEALTHY}× bar — the crossing exists mathematically but sits outside the achievable domain, so the ratio is not churn-constrained at all.`
                  : churnPct <= churnFor3x
                    ? crossingInBand
                      ? `You sit left of the ${RATIO_HEALTHY}× crossing at ${pct(churnFor3x, 1)}/mo churn, where the curve passes through the green line: monthly churn could rise all the way to that level before the ratio drops below the bar.`
                      : `The ${RATIO_HEALTHY}× crossing sits at ${pct(churnFor3x, 1)}/mo churn — beyond this scan's right edge of ${pct(band.to, 1)}/mo, so it is out of view: within the drawn band the ratio never falls below ${ratioAtEdge === null ? '—' : `${numFmt(ratioAtEdge, 1)}×`} (its value at the right edge).`
                    : `The ${RATIO_HEALTHY}× crossing sits at ${pct(churnFor3x, 1)}/mo churn — churn has to fall ${pct(((churnPct - churnFor3x) / churnPct) * 100, 0)} (to ${pct(churnFor3x, 1)}) for the ratio to clear the bar at this CAC.`
            } Past the crossing the curve collapses toward 1× and below, where each customer bought never returns their acquisition cost in expectation.`}
          />
        ) : (
          <div className="card flex flex-wrap items-center justify-between gap-4 p-6">
            <div className="max-w-2xl">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">LTV : CAC vs monthly churn</h3>
              <p className="mt-1 text-sm leading-relaxed text-slate-500 dark:text-slate-400">
                {zeroChurn
                  ? 'The scan needs a positive churn rate to place your position on the curve — set a churn estimate above and the hyperbola appears.'
                  : 'The scan needs a defined acquisition cost — enter monthly new customers (and non-zero S&M spend) and the hyperbola appears.'}
              </p>
            </div>
            <span className="chip bg-slate-100 font-mono text-[10px] uppercase tracking-wider text-slate-600 dark:bg-white/[0.05] dark:text-slate-300">
              awaiting inputs
            </span>
          </div>
        )}
      </div>

      {/* ================= Payback scan + churn sensitivity ================= */}
      <div className="lg:col-span-3">
        {cacDefined && !zeroChurn && monthlyGrossProfit > 0 ? (
          <ScanChart
            id="ltvcac-scan-payback"
            title="Churn-adjusted payback vs monthly churn"
            subtitle={`Months for expected cumulative gross profit to repay the ${usd(cac ?? 0, 0)} CAC, with customers lost along the way priced in.`}
            points={paybackPoints}
            xMarker={churnPct}
            markerLabel={`your churn ${pct(churnPct, 1)}`}
            threshold={PAYBACK_HEALTHY_MONTHS}
            healthySide="below"
            thresholdLabel={`healthy < ${PAYBACK_HEALTHY_MONTHS} mo (rule of thumb)`}
            yCap={PAYBACK_HEALTHY_MONTHS * 2.5}
            xLabel="Monthly logo churn"
            yLabel="CAC payback"
            xFormat={(n) => `${n.toFixed(n < 10 ? 1 : 0)}%`}
            yFormat={(n) => `${numFmt(n, 0)} mo`}
            color="#0ea5e9"
            divergeAt={divergeChurn}
            divergeLabel="LTV = CAC — never pays back beyond"
            legendLabel="Churn-adjusted payback at each churn rate"
            ariaLabel={`Churn-adjusted CAC payback in months versus monthly churn. Healthy region below ${PAYBACK_HEALTHY_MONTHS} months. Your churn ${pct(churnPct, 1)} gives ${paybackChurnAdjusted === null ? 'a never-completing payback' : `${numFmt(paybackChurnAdjusted, 1)} months`}.`}
            caption={`At zero churn this converges to the simple payback of ${numFmt(result.paybackMonths ?? 0, 1)} months; churn pushes it out as customers leave before repaying. ${
              divergeInBand
                ? `The curve diverges entirely at ${pct(divergeChurn ?? 0, 1)}/mo churn — the rose line, where expected LTV falls to the CAC itself — and the climb steepens toward that cliff: modest churn increases are cheap, late ones are catastrophic.`
                : `The point where expected LTV falls to the CAC — payback diverging — lies at ${pct(divergeChurn ?? 0, 1)}/mo churn, beyond this scan's right edge of ${pct(band.to, 1)}/mo, so the cliff itself is out of view: within the drawn band payback moves only from ${paybackBandLo === null ? '—' : numFmt(paybackBandLo, 1)} to ${paybackBandHi === null ? '—' : numFmt(paybackBandHi, 1)} months. The divergence is real but distant at this CAC; it crowns the curve far off the right edge.`
            }`}
          />
        ) : (
          <div className="card h-full p-6">
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              Churn-adjusted payback vs monthly churn
            </h3>
            <p className="mt-1 text-sm leading-relaxed text-slate-500 dark:text-slate-400">
              {monthlyGrossProfit <= 0
                ? 'Payback needs positive gross profit per customer — at a 0% margin there is nothing to amortize the CAC against.'
                : zeroChurn
                  ? 'The scan needs a positive churn rate — at zero churn the payback is simply CAC ÷ monthly gross profit.'
                  : 'The scan needs a defined CAC — enter monthly new customers and spend above.'}
            </p>
          </div>
        )}
      </div>

      <div className="lg:col-span-2">
        <div className="card h-full overflow-hidden">
          <div className="border-b border-slate-200 px-5 py-4 dark:border-white/[0.07]">
            <h3 className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-slate-100">
              <TrendingDown className="h-4 w-4 text-slate-400 dark:text-slate-500" aria-hidden="true" />
              Churn sensitivity — the hyperbola
            </h3>
            <p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
              Everything re-solved at churn × each factor. Because LTV = gross profit ÷ churn, the ×0.5
              row&rsquo;s LTV is double the base row&rsquo;s — exact in the model; the whole-dollar
              display rounds the two columns independently, so a $1 gap can appear on screen.
            </p>
          </div>
          {churnPct > 0 ? (
            <div className="overflow-x-auto">
              <table className="data-table min-w-full">
                <thead>
                  <tr>
                    <th scope="col">Churn</th>
                    <th scope="col" className="text-right">LTV</th>
                    <th scope="col" className="text-right">LTV:CAC</th>
                    <th scope="col" className="text-right">Payback</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-white/[0.06]">
                  {sensitivity.map((row) => {
                    const isBase = Math.abs(row.multiplier - 1) < 1e-9;
                    const isHalf = Math.abs(row.multiplier - 0.5) < 1e-9;
                    return (
                      <tr key={row.multiplier} className={isHalf ? 'bg-indigo-50/50 dark:bg-indigo-500/[0.06]' : ''}>
                        <th scope="row" className="font-medium normal-case tracking-normal text-slate-700 dark:text-slate-300">
                          {pct(row.churnPct, 1)}
                          <span className="ml-1.5 font-mono text-[10px] uppercase tracking-wide text-slate-400 dark:text-slate-500">
                            {isBase ? 'base' : `×${row.multiplier}`}
                          </span>
                        </th>
                        <td className="text-right">
                          <span
                            className={`readout whitespace-nowrap font-semibold ${
                              isHalf
                                ? 'text-indigo-600 dark:text-indigo-300'
                                : isBase
                                  ? 'text-slate-900 dark:text-slate-100'
                                  : 'text-slate-600 dark:text-slate-300'
                            }`}
                          >
                            {row.ltv === null ? '—' : usd(row.ltv, 0)}
                          </span>
                        </td>
                        <td className="text-right">
                          <span
                            className={`readout whitespace-nowrap font-semibold ${
                              row.ratio === null
                                ? 'text-slate-500 dark:text-slate-400'
                                : row.ratio >= RATIO_HEALTHY
                                  ? 'text-emerald-600 dark:text-emerald-400'
                                  : row.ratio >= 1
                                    ? 'text-amber-700 dark:text-amber-300'
                                    : 'text-rose-600 dark:text-rose-400'
                            }`}
                          >
                            {row.ratio === null ? '—' : `${numFmt(row.ratio, 1)}×`}
                          </span>
                        </td>
                        <td className="text-right">
                          {zeroSpend ? (
                            <span className="readout whitespace-nowrap text-slate-500 dark:text-slate-400">—</span>
                          ) : (
                            <span
                              className={`readout whitespace-nowrap font-semibold ${
                                row.paybackChurnAdjusted === null
                                  ? 'text-rose-600 dark:text-rose-400'
                                  : row.paybackChurnAdjusted <= PAYBACK_HEALTHY_MONTHS
                                    ? 'text-emerald-600 dark:text-emerald-400'
                                    : 'text-amber-700 dark:text-amber-300'
                              }`}
                            >
                              {row.paybackChurnAdjusted === null ? 'never' : `${numFmt(row.paybackChurnAdjusted, 1)} mo`}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-5">
              <p className="text-sm leading-relaxed text-slate-500 dark:text-slate-400">
                Set a positive churn rate above to compare multipliers — at exactly zero churn every
                multiple is equally unbounded.
              </p>
            </div>
          )}
          <p className="border-t border-slate-100 bg-slate-50/60 px-5 py-3 text-xs leading-relaxed text-slate-500 dark:border-white/[0.06] dark:bg-white/[0.02] dark:text-slate-400">
            The ×2 row halves LTV and the ×0.5 row doubles it — exactly in the model, in every column
            that flows from LTV (the on-screen dollars round each column independently, so a $1 gap
            can appear). The payback column is the deliberate exception: as churn → 0 the
            churn-adjusted payback converges to the simple payback (CAC ÷ monthly gross profit), a
            floor churn cannot lower, so it improves far less than proportionally — at low churn it
            barely moves at all. That asymmetry is the finding: retention stretches the lifetime,
            while the payback clock is set by acquisition cost and margin. A point of churn saved
            pays every month of the lifetime it creates, forever; a price rise pays once.
          </p>
        </div>
      </div>
    </div>
  );
}

/** Shared pill button — active and hover states pair light/dark, focus ring always visible. */
function PillButton({
  active,
  onClick,
  ariaLabel,
  children,
}: {
  active: boolean;
  onClick: () => void;
  ariaLabel?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      aria-label={ariaLabel}
      onClick={onClick}
      className={`rounded-full px-3 py-1.5 text-xs font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 dark:focus-visible:ring-indigo-400 dark:focus-visible:ring-offset-slate-950 ${
        active
          ? 'border border-indigo-500 bg-indigo-50 text-indigo-700 dark:border-indigo-400 dark:bg-indigo-500/15 dark:text-indigo-300'
          : 'border border-slate-200 bg-white text-slate-500 hover:border-indigo-300 hover:text-indigo-600 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-400 dark:hover:border-indigo-400/50 dark:hover:text-indigo-300'
      }`}
    >
      {children}
    </button>
  );
}

/* ===================== Hand-drawn churn scan chart (SVG) ===================== */

/** Round `x` up to a "nice" axis multiple (1/2/2.5/5 × 10^k) covering the data. */
function niceCeil(x: number): number {
  if (!Number.isFinite(x) || x <= 0) return 1;
  const mag = Math.pow(10, Math.floor(Math.log10(x)));
  const norm = x / mag;
  const step = (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10) * mag;
  return Math.ceil(x / step) * step;
}

/** Tick picker mirroring ComparisonChart's rhythm — kept local so both charts read identically. */
function niceTicks(min: number, max: number, count = 4): number[] {
  if (!Number.isFinite(min) || !Number.isFinite(max) || min === max) return [min];
  const span = max - min;
  const rawStep = span / count;
  const mag = Math.pow(10, Math.floor(Math.log10(rawStep)));
  const norm = rawStep / mag;
  const step = (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10) * mag;
  const start = Math.floor(min / step) * step;
  const end = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let t = start; t <= end + step / 2; t += step) {
    ticks.push(Math.abs(t) < step / 1e6 ? 0 : t);
  }
  return ticks;
}

const SCAN_W = 720;
const SCAN_H = 320;
const SCAN_M = { top: 22, right: 18, bottom: 42, left: 64 };

/**
 * Churn-scan chart with a shaded healthy band — the one thing the shared
 * ComparisonChart cannot draw. Y-domain is capped (hyperbolas explode at the
 * left edge) and the curve is clipped to the plot area; the healthy threshold
 * is rendered as an emerald dashed line with the band tinted on the healthy
 * side, and an optional rose divergence line marks where the metric ceases to
 * exist (payback → ∞ at LTV = CAC).
 */
function ScanChart({
  id,
  title,
  subtitle,
  points,
  xMarker,
  markerLabel,
  threshold,
  healthySide,
  thresholdLabel,
  yCap,
  xLabel,
  yLabel,
  xFormat,
  yFormat,
  color,
  divergeAt,
  divergeLabel,
  legendLabel,
  ariaLabel,
  caption,
}: {
  id: string;
  title: string;
  subtitle: string;
  points: { x: number; y: number | null }[];
  xMarker: number;
  markerLabel: string;
  threshold: number;
  healthySide: 'above' | 'below';
  thresholdLabel: string;
  yCap: number;
  xLabel: string;
  yLabel: string;
  xFormat: (n: number) => string;
  yFormat: (n: number) => string;
  color: string;
  divergeAt?: number | null;
  divergeLabel?: string;
  legendLabel: string;
  ariaLabel: string;
  caption: string;
}) {
  const iw = SCAN_W - SCAN_M.left - SCAN_M.right;
  const ih = SCAN_H - SCAN_M.top - SCAN_M.bottom;

  const finite = points.filter((p) => p.y !== null && Number.isFinite(p.y)) as { x: number; y: number }[];
  const xMin = points.length ? points[0].x : 0;
  const xMax = points.length ? points[points.length - 1].x : 1;
  const maxFiniteY = finite.length ? Math.max(...finite.map((p) => p.y)) : threshold;
  // Cap the domain so the hyperbola's left edge doesn't flatten everything
  // else — but always leave the threshold line (and headroom) in view.
  const yMax = niceCeil(Math.max(Math.min(maxFiniteY, yCap), threshold * 1.3));

  const sx = (x: number) => SCAN_M.left + ((x - xMin) / (xMax - xMin || 1)) * iw;
  const sy = (y: number) => SCAN_M.top + ih - (y / yMax) * ih;

  const xTicks = niceTicks(xMin, xMax, 5);
  const yTicks = niceTicks(0, yMax, 4);

  const path = finite.map((p, i) => `${i === 0 ? 'M' : 'L'}${sx(p.x).toFixed(1)},${sy(p.y).toFixed(1)}`).join(' ');

  // The user's point on the curve — nearest scan point (null y = off the chart).
  // Epsilon-inclusive bounds: a churn sitting exactly on the band edge (e.g.
  // 0.1%/mo at scanBand's floor) still draws its marker line and dot instead
  // of silently vanishing.
  const markerInScale = xMarker >= xMin - 1e-9 && xMarker <= xMax + 1e-9;
  const nearest = markerInScale
    ? points.reduce((best, p) =>
        Math.abs(p.x - xMarker) < Math.abs(best.x - xMarker) ? p : best,
      )
    : null;
  const markerY = nearest && nearest.y !== null && (nearest.y as number) <= yMax ? sy(nearest.y) : null;

  const thresholdY = sy(threshold);
  const showDiverge = divergeAt !== undefined && divergeAt !== null && divergeAt > xMin && divergeAt < xMax;

  return (
    <figure className="card m-0 overflow-hidden p-5 sm:p-6">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">{title}</h3>
          <p className="mt-0.5 text-xs leading-relaxed text-slate-500 dark:text-slate-400">{subtitle}</p>
        </div>
      </div>

      <svg
        viewBox={`0 0 ${SCAN_W} ${SCAN_H}`}
        className="h-auto w-full"
        role="img"
        aria-label={ariaLabel}
      >
        <defs>
          <clipPath id={`${id}-clip`}>
            <rect x={SCAN_M.left} y={SCAN_M.top} width={iw} height={ih} />
          </clipPath>
        </defs>

        {/* Grid + y axis */}
        {yTicks.map((t) => (
          <g key={`y-${t}`}>
            <line
              x1={SCAN_M.left}
              x2={SCAN_W - SCAN_M.right}
              y1={sy(t)}
              y2={sy(t)}
              stroke="currentColor"
              className="text-slate-200 dark:text-white/10"
              strokeWidth={1}
            />
            <text
              x={SCAN_M.left - 8}
              y={sy(t) + 3.5}
              textAnchor="end"
              className="fill-slate-500 font-mono dark:fill-slate-400 print:fill-slate-600 dark:print:fill-slate-600"
              fontSize="10"
            >
              {yFormat(t)}
            </text>
          </g>
        ))}
        {/* x axis ticks + baseline */}
        <line
          x1={SCAN_M.left}
          x2={SCAN_W - SCAN_M.right}
          y1={SCAN_M.top + ih}
          y2={SCAN_M.top + ih}
          stroke="currentColor"
          className="text-slate-300 dark:text-white/20"
          strokeWidth={1}
        />
        {xTicks.map((t) => (
          <text
            key={`x-${t}`}
            x={sx(t)}
            y={SCAN_H - SCAN_M.bottom + 16}
            textAnchor="middle"
            className="fill-slate-500 font-mono dark:fill-slate-400 print:fill-slate-600 dark:print:fill-slate-600"
            fontSize="10"
          >
            {xFormat(t)}
          </text>
        ))}
        {/* axis titles */}
        <text x={SCAN_M.left} y={12} className="fill-slate-500 dark:fill-slate-400 print:fill-slate-600 dark:print:fill-slate-600" fontSize="9.5">
          {yLabel}
        </text>
        <text
          x={SCAN_W - SCAN_M.right}
          y={SCAN_H - 4}
          textAnchor="end"
          className="fill-slate-500 dark:fill-slate-400 print:fill-slate-600 dark:print:fill-slate-600"
          fontSize="9.5"
        >
          {xLabel}
        </text>

        {/* Healthy band — tinted region on the healthy side of the threshold */}
        <rect
          x={SCAN_M.left}
          y={healthySide === 'above' ? SCAN_M.top : thresholdY}
          width={iw}
          height={healthySide === 'above' ? Math.max(0, thresholdY - SCAN_M.top) : Math.max(0, SCAN_M.top + ih - thresholdY)}
          fill="#10b981"
          opacity="0.06"
        />
        <line
          x1={SCAN_M.left}
          x2={SCAN_W - SCAN_M.right}
          y1={thresholdY}
          y2={thresholdY}
          stroke="#10b981"
          strokeWidth={1.5}
          strokeDasharray="5 4"
        />
        <text
          x={SCAN_W - SCAN_M.right - 4}
          y={thresholdY + (healthySide === 'above' ? -5 : 13)}
          textAnchor="end"
          className="fill-emerald-600 font-mono dark:fill-emerald-400 print:fill-emerald-700 dark:print:fill-emerald-700"
          fontSize="9.5"
        >
          {thresholdLabel}
        </text>

        {/* The scan curve, clipped to the plot area */}
        <g clipPath={`url(#${id}-clip)`}>
          <path
            d={path}
            fill="none"
            stroke={color}
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </g>

        {/* Divergence: churn where the metric ceases to exist */}
        {showDiverge && (
          <g>
            <line
              x1={sx(divergeAt as number)}
              x2={sx(divergeAt as number)}
              y1={SCAN_M.top}
              y2={SCAN_M.top + ih}
              stroke="#f43f5e"
              strokeWidth={1.5}
              strokeDasharray="3 4"
            />
            <text
              x={sx(divergeAt as number) - 6}
              y={SCAN_M.top + 12}
              textAnchor="end"
              className="fill-rose-600 font-mono dark:fill-rose-400 print:fill-rose-700 dark:print:fill-rose-700"
              fontSize="9.5"
            >
              {divergeLabel}
            </text>
          </g>
        )}

        {/* The user's position */}
        {markerInScale && (
          <g>
            <line
              x1={sx(xMarker)}
              x2={sx(xMarker)}
              y1={SCAN_M.top}
              y2={SCAN_M.top + ih}
              stroke="currentColor"
              className="text-slate-400 dark:text-slate-500"
              strokeWidth={1.5}
              strokeDasharray="3 4"
            />
            {markerY !== null && (
              <circle cx={sx(xMarker)} cy={markerY} r={5} fill={color} stroke="#fff" strokeWidth={2} className="dark:stroke-[#0b1220]" />
            )}
            <text
              x={sx(xMarker) > SCAN_W * 0.75 ? sx(xMarker) - 6 : sx(xMarker) + 6}
              y={SCAN_M.top + 10}
              textAnchor={sx(xMarker) > SCAN_W * 0.75 ? 'end' : 'start'}
              className="fill-slate-500 font-mono dark:fill-slate-400 print:fill-slate-600 dark:print:fill-slate-600"
              fontSize="9.5"
            >
              {markerLabel}
            </text>
          </g>
        )}
      </svg>

      <figcaption className="mt-4">
        <ul className="flex flex-wrap gap-x-5 gap-y-1.5">
          <li className="flex items-center gap-2 text-xs font-medium text-slate-600 dark:text-slate-300">
            <span aria-hidden="true" className="inline-block h-2 w-4 rounded-full" style={{ background: color }} />
            {legendLabel}
          </li>
          <li className="flex items-center gap-2 text-xs font-medium text-slate-600 dark:text-slate-300">
            <span aria-hidden="true" className="inline-block h-2 w-4 rounded-full bg-emerald-500" />
            Healthy band ({healthySide === 'above' ? '≥' : '<'} threshold) — rule of thumb
          </li>
        </ul>
        <p className="mt-2 text-xs leading-relaxed text-slate-500 dark:text-slate-400">{caption}</p>
      </figcaption>
    </figure>
  );
}

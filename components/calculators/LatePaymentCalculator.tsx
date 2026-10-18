'use client';

import { useEffect, useMemo } from 'react';
import { AlertTriangle, CalendarClock, Info, RotateCcw, Percent } from 'lucide-react';
import NumberInput, { AnimatedNumber, CopyButton, SliderControl, StatCard } from '@/components/NumberInput';
import ScenarioButtons from '@/components/ScenarioButtons';
import ComparisonChart from '@/components/ComparisonChart';
import {
  LATEFEE_PRESETS,
  TERM_PRESETS,
  computeLatePayment,
  discountImpliedAnnualized,
  evaluateEarlyPayDiscount,
  termsCostSweep,
  type LatePaymentInputs,
} from '@/lib/latefee';
import { usd, numFmt, pct } from '@/lib/format';
import { useWorkbenchInputs, recordRecent } from '@/lib/workbench';

const SLUG = 'late-payment-cost-calculator';
const HREF = '/late-payment-cost-calculator/';
const DEFAULTS = { invoice: 10000, netDays: 30, capitalRate: 8, badDebt: 2, discountPct: 2, discountDays: 10 };

export default function LatePaymentCalculator() {
  const { values, set, reset } = useWorkbenchInputs(SLUG, DEFAULTS);
  const { invoice, netDays, capitalRate, badDebt, discountPct, discountDays } = values;

  useEffect(() => {
    recordRecent(SLUG);
  }, []);

  const inputs: LatePaymentInputs = useMemo(
    () => ({ invoiceAmount: invoice, netDays, annualRatePct: capitalRate, badDebtPct: badDebt }),
    [invoice, netDays, capitalRate, badDebt],
  );

  const result = useMemo(() => computeLatePayment(inputs), [inputs]);
  const sweep = useMemo(() => termsCostSweep(inputs, 0, 180, 25), [inputs]);
  const sweepRiskFree = useMemo(
    () => termsCostSweep({ ...inputs, badDebtPct: 0 }, 0, 180, 25),
    [inputs],
  );
  const offer = useMemo(
    () => evaluateEarlyPayDiscount(inputs, discountPct, discountDays),
    [inputs, discountPct, discountDays],
  );

  const activePreset = LATEFEE_PRESETS.find(
    (p) =>
      Math.abs(p.inputs.invoiceAmount - invoice) < 0.01 &&
      Math.abs(p.inputs.netDays - netDays) < 0.01 &&
      Math.abs(p.inputs.annualRatePct - capitalRate) < 0.01 &&
      Math.abs(p.inputs.badDebtPct - badDebt) < 0.01,
  );

  // Discount guards. Two URL-reachable states have no implied rate:
  //  - windowInverted: the early-pay window ends at/after the net term, so
  //    paying "early" accelerates nothing;
  //  - invalidDiscount: the discount itself is out of (0, 100)% — reachable
  //    only via deep links / stored scenarios (the slider's own domain is
  //    0.25–10), where discountImpliedAnnualized returns null.
  const windowInverted = discountDays >= netDays;
  const implied = offer.impliedAnnualizedPct;
  const implied360 = offer.impliedAnnualizedPct360;
  const invalidDiscount = !windowInverted && implied === null;
  const impliedBeatsCapital = implied !== null && implied > capitalRate;
  const sellerAdvantage = offer.netAdvantage;

  const copySummary = `Net-${numFmt(netDays, 0)} on ${usd(invoice, 0)}: carrying ${usd(result.carryingCost)} + expected bad debt ${usd(result.badDebtLoss)} = ${usd(result.totalExpectedCost)} per invoice (${result.totalCostPct === null ? '—' : pct(result.totalCostPct, 2)} of face)${
    windowInverted
      ? '. Discount window ends after the net term — implied rate undefined.'
      : implied === null
        ? '. Discount percent out of range (must be above 0 and below 100) — implied rate undefined.'
        : `. Early-pay ${numFmt(discountPct, 2)}/${numFmt(discountDays, 0)} net ${numFmt(netDays, 0)} implies ${pct(implied, 1)} annualized (365-day basis).`
  }`;

  return (
    <div className="grid gap-6 lg:grid-cols-5">
      {/* ================= Inputs ================= */}
      <div className="card p-6 sm:p-8 lg:col-span-3">
        <h2 className="mb-6 text-base font-semibold text-slate-900 dark:text-slate-100">
          The invoice and its terms
        </h2>

        {/* Billing-archetype presets */}
        <div role="group" aria-label="Billing archetype presets" className="mb-6">
          <p className="label mb-2">Start from a billing archetype</p>
          <div className="flex flex-wrap gap-1.5">
            {LATEFEE_PRESETS.map((p) => {
              const active = activePreset?.id === p.id;
              return (
                <PillButton
                  key={p.id}
                  active={active}
                  onClick={() => {
                    set('invoice', p.inputs.invoiceAmount);
                    set('netDays', p.inputs.netDays);
                    set('capitalRate', p.inputs.annualRatePct);
                    set('badDebt', p.inputs.badDebtPct);
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
              : 'Custom inputs — the math below is the same for any invoice, terms, and risk level.'}
          </p>
        </div>

        <div className="space-y-6">
          <div>
            <NumberInput
              id="lp-invoice"
              label="Invoice amount"
              value={invoice}
              onChange={(n) => set('invoice', n)}
              min={0}
              max={10000000}
              prefix="$"
              placeholder="10,000"
              helpText="The face value of one invoice (or your average invoice size across the book)."
            />
            <div className="mt-3">
              <SliderControl
                id="lp-invoice-slider"
                label=""
                ariaLabel="Invoice amount"
                value={invoice}
                onChange={(n) => set('invoice', n)}
                min={100}
                max={10000000}
                step={100}
                prefix="$"
                logarithmic
                presets={[2500, 10000, 50000, 250000]}
              />
            </div>
          </div>

          <div>
            <NumberInput
              id="lp-netdays"
              label="Payment terms (Net-N days)"
              value={netDays}
              onChange={(n) => set('netDays', n)}
              min={0}
              max={180}
              suffix="days"
              placeholder="30"
              helpText="Days the customer has to pay. Actual collections often run longer — the guide covers DSO drift."
            />
            <div className="mt-3">
              <SliderControl
                id="lp-netdays-slider"
                label=""
                ariaLabel="Payment terms in days"
                value={netDays}
                onChange={(n) => set('netDays', n)}
                min={0}
                max={180}
                step={1}
                suffix=" days"
                formatValue={(n) => `Net-${numFmt(n, 0)}`}
              />
            </div>
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {TERM_PRESETS.map((t) => {
                const active = Math.abs(t.netDays - netDays) < 0.5;
                return (
                  <PillButton
                    key={t.id}
                    active={active}
                    onClick={() => set('netDays', t.netDays)}
                    ariaLabel={`Set payment terms to ${t.label}`}
                  >
                    {t.label}
                  </PillButton>
                );
              })}
            </div>
          </div>

          <div>
            <NumberInput
              id="lp-rate"
              label="Annual cost of capital"
              value={capitalRate}
              onChange={(n) => set('capitalRate', n)}
              min={0}
              max={100}
              step={0.5}
              suffix="%"
              placeholder="8"
              helpText="What your cash actually costs: credit-line APR, factoring rate, or an opportunity cost of capital."
            />
            <div className="mt-3">
              <SliderControl
                id="lp-rate-slider"
                label=""
                ariaLabel="Annual cost of capital in percent"
                value={capitalRate}
                onChange={(n) => set('capitalRate', n)}
                min={0}
                max={100}
                step={0.5}
                suffix="%"
                presets={[6, 8, 12, 24]}
              />
            </div>
          </div>

          <div>
            <NumberInput
              id="lp-baddebt"
              label="Bad-debt probability per invoice"
              value={badDebt}
              onChange={(n) => set('badDebt', n)}
              min={0}
              max={100}
              step={0.5}
              suffix="%"
              placeholder="2"
              helpText="Chance an invoice is never collected, blended across the book — dollars written off ÷ dollars billed is the honest estimate."
            />
            <div className="mt-3">
              <SliderControl
                id="lp-baddebt-slider"
                label=""
                ariaLabel="Bad-debt probability in percent"
                value={badDebt}
                onChange={(n) => set('badDebt', n)}
                min={0}
                max={100}
                step={0.5}
                suffix="%"
                presets={[0.5, 2, 5, 10]}
              />
            </div>
          </div>
        </div>

        <div className="mt-6 flex items-start gap-2 rounded-lg bg-slate-50 p-3 text-xs leading-relaxed text-slate-600 dark:bg-white/[0.03] dark:text-slate-300">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-slate-400 dark:text-slate-500" aria-hidden="true" />
          <p>
            Simple interest on a 365-day year; carrying cost is charged on the outstanding face.
            Processing fees are a separate levy — price them with the{' '}
            <a href="/stripe-fee-calculator/" className="font-medium text-indigo-600 underline dark:text-indigo-400">
              Stripe fee calculator
            </a>
            .
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
            shortTitle="Late Payment Cost"
            href={HREF}
            params={{ invoice, netDays, capitalRate, badDebt, discountPct, discountDays }}
          />
        </div>
      </div>

      {/* ================= Results ================= */}
      <div className="space-y-4 lg:col-span-2">
        <div className="card p-6 sm:p-8">
          <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            <CalendarClock className="h-4 w-4" aria-hidden="true" />
            Real cost of these terms
          </h2>
          <div className="mt-3">
            <AnimatedNumber
              value={result.totalExpectedCost}
              format={(n) => usd(n)}
              className="readout block text-4xl font-extrabold tracking-tight text-rose-600 dark:text-rose-400"
            />
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              per {usd(result.invoiceAmount, 0)} invoice on Net-{numFmt(result.netDays, 0)} —{' '}
              <span className="font-semibold text-slate-700 dark:text-slate-200">
                {result.totalCostPct === null ? '—' : pct(result.totalCostPct, 2)}
              </span>{' '}
              of face.
            </p>
          </div>

          <dl className="mt-5 divide-y divide-slate-100 text-sm dark:divide-white/[0.06]">
            <LedgerRow
              label={`Carrying cost (${pct(capitalRate, 1)} × ${numFmt(result.netDays, 0)} days)`}
              value={usd(result.carryingCost)}
            />
            <LedgerRow
              label={`Expected bad debt (${pct(badDebt, 1)} of face)`}
              value={usd(result.badDebtLoss)}
            />
            <div className="flex items-center justify-between py-2.5">
              <dt className="font-medium text-slate-700 dark:text-slate-300">Expected receipt</dt>
              <dd className="readout text-sm font-semibold text-slate-900 dark:text-slate-100">
                {usd(result.expectedReceipt)}
              </dd>
            </div>
            <LedgerRow
              label="Price uplift to stay whole"
              value={result.priceUpliftPct === null ? '—' : `+${pct(result.priceUpliftPct, 2)}`}
            />
          </dl>
          <p className="mt-3 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
            {result.priceUpliftPct === null
              ? result.invoiceAmount <= 0
                ? 'Cost share is undefined at a zero invoice.'
                : 'The expected cost equals or exceeds the invoice face — at these inputs no markup can restore the value of a cash sale.'
              : `Quote every invoice ${pct(result.priceUpliftPct, 2)} higher and the expected value matches a same-amount cash sale — this is the markup your terms quietly require.`}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <StatCard
            label="Cost per day of waiting"
            value={usd(result.dailyCarryingCost)}
            sublabel={`at ${pct(capitalRate, 1)} cost of capital`}
          />
          <StatCard
            label="Expected terms cost"
            value={pct(result.expectedTermsCostPct, 2)}
            sublabel="of every invoice, per collection cycle"
          />
          <StatCard
            label="Cash locked per $100k billed"
            value={usd((100000 * result.netDays) / 365, 0)}
            sublabel="receivables outstanding at these terms"
          />
          <StatCard
            label="Risk share of terms cost"
            value={
              result.totalExpectedCost > 0
                ? pct((result.badDebtLoss / result.totalExpectedCost) * 100, 0)
                : '—'
            }
            sublabel="bad debt vs carrying cost"
          />
        </div>
      </div>

      {/* ================= Terms-cost curve ================= */}
      <div className="lg:col-span-5">
        <ComparisonChart
          series={[
            {
              label: `Total expected cost at your ${pct(badDebt, 1)} default risk`,
              color: '#6366f1',
              points: sweep.map((s) => ({ x: s.days, y: s.totalCost })),
              fillTo: 0,
            },
            {
              label: 'Carrying cost alone (risk-free)',
              color: '#0ea5e9',
              points: sweepRiskFree.map((s) => ({ x: s.days, y: s.totalCost })),
              dashed: true,
            },
          ]}
          xLabel="Payment terms (days)"
          yLabel="Expected cost per invoice"
          xFormat={(n) => numFmt(n, 0)}
          yFormat={(n) => usd(n, 0)}
          height={300}
          marker={netDays > 0 ? { x: netDays, label: `your Net-${numFmt(netDays, 0)}` } : undefined}
          caption="The full model re-solved at every day count: a straight line whose height at day zero is the expected bad-debt loss and whose slope is invoice × rate ÷ 365. The gap between the two lines is pure default risk — the part no amount of patience pays for. Your terms sit somewhere on the solid line."
        />
      </div>

      {/* ================= Early-payment discount decision ================= */}
      <div className="lg:col-span-5">
        <div className="card p-5 sm:p-6">
          <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
            <div>
              <h3 className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-slate-100">
                <Percent className="h-4 w-4 text-slate-400 dark:text-slate-500" aria-hidden="true" />
                The early-payment discount decision
              </h3>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                {numFmt(discountPct, 2)}/{numFmt(discountDays, 0)} net {numFmt(netDays, 0)} — the
                implied annualized rate of paying early, derived not quoted.
              </p>
            </div>
            {!windowInverted && implied !== null && (
              <span
                className={`readout rounded-full px-3 py-1 text-xs font-semibold ${
                  impliedBeatsCapital
                    ? 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300'
                    : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300'
                }`}
              >
                vs your {pct(capitalRate, 1)} capital: {impliedBeatsCapital ? 'rich' : 'cheap'}
              </span>
            )}
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            {/* Discount controls — always rendered so the guard state stays fixable */}
            <div className="space-y-5">
              <SliderControl
                id="lp-discount-slider"
                label="Early-pay discount"
                value={discountPct}
                onChange={(n) => set('discountPct', n)}
                min={0.25}
                max={10}
                step={0.25}
                suffix="%"
                presets={[1, 2, 3]}
                helpText="Percent off the face for paying inside the discount window (the “2” in 2/10 net 30)."
              />
              <SliderControl
                id="lp-discdays-slider"
                label="Discount window"
                value={discountDays}
                onChange={(n) => set('discountDays', n)}
                min={1}
                max={30}
                step={1}
                suffix=" days"
                presets={[7, 10, 15, 20]}
                helpText="Days the discount stays open (the “10”). Must end before the net term."
              />
              {!windowInverted && (
                <div className="rounded-lg bg-slate-50 p-3 text-xs leading-relaxed text-slate-500 dark:bg-white/[0.03] dark:text-slate-400">
                  Boundary at your {pct(capitalRate, 1)} cost of capital: a discount of{' '}
                  <strong className="readout font-semibold text-slate-700 dark:text-slate-200">
                    {offer.breakevenDiscountPct === null ? '—' : pct(offer.breakevenDiscountPct, 2)}
                  </strong>{' '}
                  prices this acceleration exactly at your financing cost — anything richer overpays
                  for the earlier cash.
                </div>
              )}
            </div>

            {windowInverted ? (
              <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 lg:col-span-2 dark:border-amber-500/30 dark:bg-amber-500/10">
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden="true" />
                <div>
                  <p className="text-sm font-semibold text-amber-700 dark:text-amber-300">
                    The discount window ends after the net term
                  </p>
                  <p className="mt-1 text-sm leading-relaxed text-amber-700/90 dark:text-amber-300/90">
                    Paying on day {numFmt(discountDays, 0)} of a Net-{numFmt(netDays, 0)} invoice
                    accelerates nothing — there is no implied rate to compute. Shorten the window or
                    lengthen the payment term to evaluate the offer.
                  </p>
                </div>
              </div>
            ) : invalidDiscount ? (
              <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 lg:col-span-2 dark:border-amber-500/30 dark:bg-amber-500/10">
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden="true" />
                <div>
                  <p className="text-sm font-semibold text-amber-700 dark:text-amber-300">
                    Discount percent is out of range
                  </p>
                  <p className="mt-1 text-sm leading-relaxed text-amber-700/90 dark:text-amber-300/90">
                    The implied rate needs a discount strictly between 0% and 100% of face; this view
                    arrived carrying {numFmt(discountPct, 2)}% (a shared link or stored scenario can
                    reach values the slider cannot). Drag the discount back into range to evaluate
                    the terms.
                  </p>
                </div>
              </div>
            ) : (
              <>
                {/* The classic derivation */}
                <div>
                  <div className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Implied annualized rate
                  </div>
                  <AnimatedNumber
                    value={implied ?? 0}
                    format={(n) => pct(n, 1)}
                    className="readout mt-1 block text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white"
                  />
                  <div className="readout mt-2 rounded-lg bg-white px-3 py-2 text-sm font-semibold text-slate-900 ring-1 ring-inset ring-slate-200 dark:bg-white/[0.05] dark:text-slate-100 dark:ring-white/10">
                    <code>
                      ({numFmt(discountPct, 2)} ÷ {numFmt(100 - discountPct, 2)}) × (365 ÷{' '}
                      {numFmt(offer.daysAccelerated ?? 0, 0)})
                    </code>
                  </div>
                  <p className="mt-2 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                    Give up {numFmt(discountPct, 2)} to keep {numFmt(100 - discountPct, 2)} working
                    for {numFmt(offer.daysAccelerated ?? 0, 0)} fewer days — that return, compounded
                    over a year, is the number above. On the 360-day banker&apos;s year it reads{' '}
                    <strong className="readout font-semibold text-slate-700 dark:text-slate-200">
                      {implied360 === null ? '—' : pct(implied360, 1)}
                    </strong>
                    , the figure most textbooks print.
                  </p>
                  <p className="mt-2 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                    {impliedBeatsCapital
                      ? `Above your ${pct(capitalRate, 1)} cost of capital: a customer taking it earns more than money costs you — and granting it buys cash at that same steep implicit rate.`
                      : `Below your ${pct(capitalRate, 1)} cost of capital — rare: the early cash would be cheaper than your own financing.`}
                  </p>
                </div>

                {/* Seller's expected value */}
                <div>
                  <div className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    If you offer these terms
                  </div>
                  <AnimatedNumber
                    value={sellerAdvantage}
                    format={(n) => `${n >= 0.005 ? '+' : ''}${usd(n)}`}
                    className={`readout mt-1 block text-3xl font-extrabold tracking-tight ${
                      sellerAdvantage > 0.005
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : sellerAdvantage < -0.005
                          ? 'text-rose-600 dark:text-rose-400'
                          : 'text-slate-700 dark:text-slate-200'
                    }`}
                  />
                  <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                    expected value per invoice, {pct(badDebt, 1)} default risk, risk accruing
                    uniformly over the window
                  </p>
                  <dl className="mt-3 divide-y divide-slate-100 text-sm dark:divide-white/[0.06]">
                    <LedgerRow label="Face surrendered" value={`−${usd(offer.faceGivenUp)}`} />
                    <LedgerRow label="Bad-debt relief" value={`+${usd(offer.riskRelief)}`} />
                    <LedgerRow label="Carrying relief" value={`+${usd(offer.carryingRelief)}`} />
                  </dl>
                  <p className="mt-2 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                    {sellerAdvantage > 0.005
                      ? 'Expected-positive at your risk numbers — the shortened exposure window pays for the discount.'
                      : sellerAdvantage < -0.005
                        ? `Expected-negative: the discount costs more than the risk and carrying it removes. A customer would need to be risky indeed — or your cash desperate — to justify it. Same arithmetic, other side of the table: a buyer paying early earns the ${pct(implied ?? 0, 1)} implied rate, so they will take it happily.`
                        : 'A wash at these numbers.'}
                  </p>
                </div>
              </>
            )}
          </div>

          {/* Acceptance boundary chart */}
          {!windowInverted && !invalidDiscount && (
            <div className="mt-6">
              <ComparisonChart
                series={[
                  {
                    label: `Implied annualized rate of ${numFmt(discountPct, 2)}/${numFmt(discountDays, 0)} net N`,
                    color: '#6366f1',
                    points: Array.from({ length: 34 }, (_, i) => {
                      const n = 15 + i * 5;
                      const r = discountImpliedAnnualized(discountPct, discountDays, n);
                      return { x: n, y: r ?? 0 };
                    }).filter((pt) => pt.y > 0),
                  },
                  {
                    label: `Your cost of capital (${pct(capitalRate, 1)})`,
                    color: '#f59e0b',
                    points: Array.from({ length: 34 }, (_, i) => ({ x: 15 + i * 5, y: capitalRate })),
                    dashed: true,
                  },
                ]}
                xLabel="Net term (days)"
                yLabel="Annualized rate"
                xFormat={(n) => numFmt(n, 0)}
                yFormat={(n) => pct(n, 0)}
                height={280}
                markerColor="#6366f1"
                marker={
                  netDays > 15 && netDays < 180
                    ? { x: netDays, label: `your Net-${numFmt(netDays, 0)}` }
                    : undefined
                }
                caption="The acceptance boundary, drawn: where the indigo curve crosses your capital-cost line, the discount prices its acceleration exactly at your financing rate. Left of the crossing the discount is rich (a buyer should always take it; a seller overpays for early cash); right of it, it is cheap. Stretch the net term and the same discount gets cheaper by the day."
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function LedgerRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-2.5">
      <dt className="text-slate-600 dark:text-slate-300">{label}</dt>
      <dd className="readout text-sm font-semibold text-slate-900 dark:text-slate-100">{value}</dd>
    </div>
  );
}

/** Shared preset pill button — active and hover states pair light/dark. */
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

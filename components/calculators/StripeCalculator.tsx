'use client';

import { useEffect, useMemo } from 'react';
import { Info, Receipt, RotateCcw, TrendingDown } from 'lucide-react';
import NumberInput, { AnimatedNumber, CopyButton, SliderControl } from '@/components/NumberInput';
import ScenarioButtons from '@/components/ScenarioButtons';
import { STRIPE_RATES, type StripeFeeType, type VolumeSummary, computeFee, monthlyVolume, reverseFromNet } from '@/lib/stripe';
import { usd, pct, round2 } from '@/lib/format';
import { useWorkbenchInputs, recordRecent } from '@/lib/workbench';

type Mode = 'forward' | 'reverse';

const feeTypes: { id: StripeFeeType; label: string; sub: string }[] = [
  { id: 'domestic', label: 'Domestic card', sub: '2.9% + $0.30' },
  { id: 'international', label: 'International card', sub: '4.4% + $0.30' },
  { id: 'ach', label: 'ACH transfer', sub: '0.8% · cap $5' },
];

/** Stable numeric encoding for enum-ish state stored in the workbench (numeric-only). */
const FEE_TYPE_ORDER: StripeFeeType[] = ['domestic', 'international', 'ach'];

const AMOUNT_PRESETS = [100, 1000, 10000, 50000];

const SLUG = 'stripe-fee-calculator';
/**
 * All persistent state is numeric (the workbench stores numbers only):
 * mode 0/1 = forward/reverse, feeType 0/1/2 = FEE_TYPE_ORDER index, and the
 * six monthly-volume-model fields below the main calculator.
 */
const DEFAULTS = {
  amount: 100,
  targetNet: 1000,
  mode: 0,
  feeType: 0,
  domCount: 40,
  domTicket: 85,
  intlCount: 5,
  intlTicket: 150,
  achCount: 3,
  achTicket: 1200,
};

/** Monthly-mix presets (deep-dive scenarios): micro tickets, global cards, ACH-heavy B2B. */
const VOLUME_PRESETS: { label: string; legs: [number, number, number, number, number, number] }[] = [
  { label: 'Micro-ticket seller', legs: [400, 6, 0, 12, 0, 500] },
  { label: 'Global card mix', legs: [120, 95, 8, 1200, 4, 900] },
  { label: 'ACH-heavy B2B', legs: [10, 350, 0, 150, 12, 3500] },
];

export default function StripeCalculator() {
  const { values, set, reset } = useWorkbenchInputs(SLUG, DEFAULTS);
  const { amount, targetNet } = values;

  // Decode enum-ish numeric state; unknown values (e.g. crafted URLs) fall back safely.
  const mode: Mode = values.mode === 1 ? 'reverse' : 'forward';
  const feeType = FEE_TYPE_ORDER[values.feeType] ?? 'domestic';

  useEffect(() => {
    recordRecent(SLUG);
  }, []);

  const setAmount = (n: number) => set('amount', n);
  const setTargetNet = (n: number) => set('targetNet', n);
  const setMode = (m: Mode) => set('mode', m === 'reverse' ? 1 : 0);
  const setFeeType = (t: StripeFeeType) => set('feeType', Math.max(0, FEE_TYPE_ORDER.indexOf(t)));

  const result = useMemo(() => {
    if (mode === 'forward') {
      return computeFee(amount, feeType);
    }
    return reverseFromNet(targetNet, feeType);
  }, [mode, feeType, amount, targetNet]);

  const isReverse = mode === 'reverse';
  const rate = STRIPE_RATES[feeType];

  /** Switching modes carries the current answer across, so Forward ⇄ Reverse
      stays one continuous exploration of the same invoice instead of jumping
      to a stale default on the other side. */
  function switchMode(next: Mode) {
    if (next === mode) return;
    if (next === 'reverse') set('targetNet', round2(result.net));
    else set('amount', round2(result.charge));
    setMode(next);
  }

  function resetAll() {
    reset();
  }

  /** Share links carry only the fields the current mode uses, plus the mode
      and fee type, so the recipient lands in the exact scenario shared. */
  const shareParams: Record<string, number> = isReverse
    ? { targetNet, mode: 1, feeType: values.feeType }
    : { amount, mode: 0, feeType: values.feeType };

  const netPct = result.charge > 0 ? (result.net / result.charge) * 100 : 0;
  const feePct = result.effectiveRate;
  const markupPct = result.net > 0 ? (result.fee / result.net) * 100 : 0;

  const copyText = isReverse
    ? `Stripe ${rate.label} (reverse): charge ${usd(result.charge)} to net ${usd(result.net)} (fee ${usd(result.fee)}, effective ${pct(result.effectiveRate, 2)})`
    : `Stripe ${rate.label}: charge ${usd(result.charge)} → net ${usd(result.net)} (fee ${usd(result.fee)}, effective ${pct(result.effectiveRate, 2)})`;

  return (
    <div>
      <div className="grid gap-6 lg:grid-cols-5">
        {/* Inputs */}
        <div className="card lg:col-span-3 p-6 sm:p-8">
          {/* Mode switch */}
          <div className="mb-6">
            <div className="grid grid-cols-2 gap-2 rounded-xl bg-slate-100 dark:bg-white/[0.06] p-1">
              <button
                type="button"
                onClick={() => switchMode('forward')}
                className={`rounded-lg px-3 py-2 text-sm font-semibold transition focus-calm ${
                  mode === 'forward' ? 'bg-white text-slate-900 shadow-sm dark:bg-white/[0.1] dark:text-white dark:shadow-none' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
                }`}
                aria-pressed={mode === 'forward'}
              >
                Forward — what will I net?
              </button>
              <button
                type="button"
                onClick={() => switchMode('reverse')}
                className={`rounded-lg px-3 py-2 text-sm font-semibold transition focus-calm ${
                  mode === 'reverse' ? 'bg-white text-slate-900 shadow-sm dark:bg-white/[0.1] dark:text-white dark:shadow-none' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
                }`}
                aria-pressed={mode === 'reverse'}
              >
                Reverse — what to charge?
              </button>
            </div>
          </div>

        {/* Fee type */}
        <fieldset className="mb-6">
          <legend className="label">Transaction type</legend>
          <div className="grid gap-2 sm:grid-cols-3">
            {feeTypes.map((ft) => (
              <button
                key={ft.id}
                type="button"
                onClick={() => setFeeType(ft.id)}
                className={`rounded-xl border p-3 text-left transition focus-calm ${
                  feeType === ft.id
                    ? 'border-indigo-500 bg-indigo-50 ring-1 ring-indigo-500 dark:border-indigo-400 dark:bg-indigo-500/15 dark:ring-indigo-400/60'
                    : 'border-slate-200 bg-white hover:border-slate-300 dark:border-white/10 dark:bg-white/[0.04] dark:hover:border-white/20'
                }`}
                aria-pressed={feeType === ft.id}
              >
                <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">{ft.label}</div>
                <div className="mt-0.5 font-mono text-xs text-slate-500 dark:text-slate-400">{ft.sub}</div>
              </button>
            ))}
          </div>
        </fieldset>

        {/* Primary amount input + slider */}
        <div className="mb-6">
          {isReverse ? (
            <div className="space-y-3">
              <NumberInput
                id="target-net"
                label="How much do you want to keep (net)?"
                value={targetNet}
                onChange={setTargetNet}
                min={0}
                prefix="$"
                placeholder="1000"
                helpText="We'll calculate the invoice total you should charge so you net this amount after Stripe's fee."
              />
              <SliderControl
                id="target-net-slider"
                label="Net target"
                value={targetNet}
                onChange={setTargetNet}
                min={0}
                max={100000}
                step={50}
                prefix="$"
                logarithmic
                presets={AMOUNT_PRESETS}
              />
            </div>
          ) : (
            <div className="space-y-3">
              <NumberInput
                id="charge-amount"
                label="Amount to charge customer"
                value={amount}
                onChange={setAmount}
                min={0}
                prefix="$"
                placeholder="100.00"
                helpText="The total you'll bill your customer."
              />
              <SliderControl
                id="charge-amount-slider"
                label="Charge amount"
                value={amount}
                onChange={setAmount}
                min={0}
                max={100000}
                step={50}
                prefix="$"
                logarithmic
                presets={AMOUNT_PRESETS}
              />
            </div>
          )}
        </div>

        <div className="flex items-start gap-2 rounded-lg bg-slate-50 p-3 text-xs leading-relaxed text-slate-600 dark:bg-white/[0.03] dark:text-slate-300">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-slate-400 dark:text-slate-500" aria-hidden="true" />
          <p>
            Using Stripe US published rates: <strong>{rate.label}</strong> ({rate.description}).
            Currency-conversion or card-refund fees are not included.
          </p>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" onClick={resetAll} className="btn-ghost">
            <RotateCcw className="h-4 w-4 text-indigo-500 dark:text-indigo-300" aria-hidden="true" />
            Reset
          </button>
          <CopyButton text={copyText} label="Copy result" />
          <ScenarioButtons
            slug={SLUG}
            shortTitle="Stripe Fees"
            href="/stripe-fee-calculator/"
            params={shareParams}
          />
        </div>
      </div>

      {/* Results */}
      <div className="lg:col-span-2 space-y-4">
        <div className="card p-6 sm:p-8" aria-live="polite">
          <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            <Receipt className="h-4 w-4" aria-hidden="true" />
            Result
          </h2>

          {isReverse ? (
            <div className="mt-3">
              <div className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Charge this much</div>
              <AnimatedNumber
                value={result.charge}
                format={(n) => usd(n)}
                className="readout mt-1 block text-4xl font-extrabold tracking-tight text-indigo-600 dark:text-indigo-300"
              />
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                to net <strong className="text-slate-700 dark:text-slate-200">{usd(result.net)}</strong> after a {usd(result.fee)} fee.
              </p>
              <p className="mt-2 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                The customer pays <strong className="text-slate-700 dark:text-slate-200">{usd(result.fee)}</strong> more than
                your net — a {pct(markupPct, 2)} markup that moves the fee to their side of the invoice.
              </p>
            </div>
          ) : (
            <div className="mt-3">
              <div className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">You receive</div>
              <AnimatedNumber
                value={result.net}
                format={(n) => usd(n)}
                className="readout mt-1 block text-4xl font-extrabold tracking-tight text-emerald-600 dark:text-emerald-400"
              />
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                from a <strong className="text-slate-700 dark:text-slate-200">{usd(result.charge)}</strong> charge.
              </p>
              <p className="mt-2 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                Keeping this exact amount would mean billing{' '}
                <strong className="text-slate-700 dark:text-slate-200">{usd(reverseFromNet(result.net, feeType).charge)}</strong>{' '}
                instead — Reverse mode solves that invoice for you.
              </p>
            </div>
          )}

          {/* Fee breakdown bar */}
          <FeeBreakdownBar netPct={netPct} feePct={feePct} net={result.net} fee={result.fee} />
        </div>

        <div className="card p-6 sm:p-8">
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Breakdown</h3>
          <dl className="mt-3 space-y-2.5 text-sm">
            <div className="flex justify-between">
              <dt className="text-slate-600 dark:text-slate-300">Charge amount</dt>
              <dd className="readout font-semibold text-slate-900 dark:text-slate-100">
                <AnimatedNumber value={result.charge} format={(n) => usd(n)} />
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-600 dark:text-slate-300">Stripe fee</dt>
              <dd className="readout font-semibold text-rose-600 dark:text-rose-400">
                −<AnimatedNumber value={result.fee} format={(n) => usd(n)} />
              </dd>
            </div>
            <div className="flex justify-between border-t border-slate-200 dark:border-white/[0.08] pt-2.5">
              <dt className="font-medium text-slate-700 dark:text-slate-200">Net received</dt>
              <dd className="readout font-bold text-emerald-600 dark:text-emerald-400">
                <AnimatedNumber value={result.net} format={(n) => usd(n)} />
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-600 dark:text-slate-300">Effective rate</dt>
              <dd className="readout font-semibold text-slate-900 dark:text-slate-100">
                <AnimatedNumber value={result.effectiveRate} format={(n) => pct(n, 2)} />
              </dd>
            </div>
          </dl>
        </div>

        <QuickCompare amount={isReverse ? targetNet : amount} isReverse={isReverse} />
      </div>
      </div>

      {/* Monthly volume model */}
      <VolumeModel values={values} set={set} />
    </div>
  );
}

/** Segmented breakdown bar showing Net vs Fee percentage. */
function FeeBreakdownBar({
  netPct,
  feePct,
  net,
  fee,
}: {
  netPct: number;
  feePct: number;
  net: number;
  fee: number;
}) {
  // net + fee always sums to the charge, so the two widths partition 100%.
  // A $0 charge (net = fee = 0) renders an empty track — a full-width fee bar
  // next to "0.00%" labels would visually assert a 100% cost that doesn't exist.
  const empty = net <= 0 && fee <= 0;
  const netW = empty ? 0 : Math.min(100, Math.max(0, netPct));
  const feeW = empty ? 0 : 100 - netW;

  return (
    <div className="mt-6">
      <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-white/[0.06]">
        <div
          className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-300"
          style={{ width: `${netW}%` }}
          title={`Net ${pct(netPct, 2)}`}
        />
        <div
          className="h-full bg-gradient-to-r from-rose-400 to-rose-500 transition-all duration-300"
          style={{ width: `${feeW}%` }}
          title={`Fee ${pct(feePct, 2)}`}
        />
      </div>
      <div className="mt-2 flex items-center justify-between text-xs">
        <span className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
          <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
          You keep <strong className="readout text-emerald-700 dark:text-emerald-400">{pct(netPct, 2)}</strong> · {usd(net)}
        </span>
        <span className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
          Fee <strong className="readout text-rose-600 dark:text-rose-400">{pct(feePct, 2)}</strong> · {usd(fee)}
          <span className="inline-block h-2 w-2 rounded-full bg-rose-500" />
        </span>
      </div>
    </div>
  );
}

function QuickCompare({ amount, isReverse }: { amount: number; isReverse: boolean }) {
  const rows = (Object.keys(STRIPE_RATES) as StripeFeeType[]).map((t) => {
    const r = isReverse ? reverseFromNet(amount, t) : computeFee(amount, t);
    return { t, ...r };
  });
  return (
    <div className="card overflow-hidden">
      <div className="border-b border-slate-200 dark:border-white/[0.08] px-5 py-3">
        <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">All types at this amount</h3>
        <p className="font-mono text-xs text-slate-500 dark:text-slate-400">
          {isReverse ? 'Net target' : 'Charge'} of {usd(amount)}
        </p>
      </div>
      <table className="w-full text-sm">
        <thead className="bg-slate-50 dark:bg-white/[0.03] text-left text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
          <tr>
            <th className="px-5 py-2 font-medium">Type</th>
            {isReverse ? (
              <>
                <th className="px-5 py-2 text-right font-medium">Invoice total</th>
                <th className="px-5 py-2 text-right font-medium">Fee</th>
              </>
            ) : (
              <>
                <th className="px-5 py-2 text-right font-medium">Fee</th>
                <th className="px-5 py-2 text-right font-medium">Net</th>
              </>
            )}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-white/[0.06]">
          {rows.map((r) => (
            <tr key={r.t} className="transition hover:bg-slate-50 dark:hover:bg-white/[0.04]">
              <td className="px-5 py-2.5 font-medium text-slate-700 dark:text-slate-200">{STRIPE_RATES[r.t].label}</td>
              {isReverse ? (
                // Reverse mode: net is the shared target by construction —
                // the useful comparison is the invoice total each type needs.
                <>
                  <td className="readout px-5 py-2.5 text-right font-semibold text-indigo-600 dark:text-indigo-300">{usd(r.charge)}</td>
                  <td className="readout px-5 py-2.5 text-right text-rose-600 dark:text-rose-400">{usd(r.fee)}</td>
                </>
              ) : (
                <>
                  <td className="readout px-5 py-2.5 text-right text-rose-600 dark:text-rose-400">{usd(r.fee)}</td>
                  <td className="readout px-5 py-2.5 text-right font-semibold text-slate-900 dark:text-slate-100">{usd(r.net)}</td>
                </>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Monthly volume model — blended cost across a payment mix            */
/* ------------------------------------------------------------------ */

type VolumeValues = typeof DEFAULTS;
type VolumeSet = (key: keyof VolumeValues & string, v: number) => void;

function VolumeModel({ values, set }: { values: VolumeValues; set: VolumeSet }) {
  const legs = [
    { key: 'dom' as const, type: 'domestic' as StripeFeeType, count: values.domCount, ticket: values.domTicket },
    { key: 'intl' as const, type: 'international' as StripeFeeType, count: values.intlCount, ticket: values.intlTicket },
    { key: 'ach' as const, type: 'ach' as StripeFeeType, count: values.achCount, ticket: values.achTicket },
  ];

  const summary: VolumeSummary = useMemo(
    () =>
      monthlyVolume(
        legs.map((l) => ({ type: l.type, count: l.count, averageTicket: l.ticket })),
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [values.domCount, values.domTicket, values.intlCount, values.intlTicket, values.achCount, values.achTicket],
  );

  const activePreset = VOLUME_PRESETS.findIndex(
    ({
      legs: [dc, dt, ic, it, ac, at],
    }) =>
      values.domCount === dc && values.domTicket === dt && values.intlCount === ic &&
      values.intlTicket === it && values.achCount === ac && values.achTicket === at,
  );

  function applyPreset(legs6: [number, number, number, number, number, number]) {
    const [dc, dt, ic, it, ac, at] = legs6;
    set('domCount', dc); set('domTicket', dt);
    set('intlCount', ic); set('intlTicket', it);
    set('achCount', ac); set('achTicket', at);
  }

  // Card transactions (domestic + international legs) — per the all-ACH
  // counterfactual in monthlyVolume, every one of them is cheaper as ACH at
  // any ticket size, not just those above the $625 cap.
  const cardCount = summary.legs.filter((l) => l.type !== 'ach').reduce((s, l) => s + l.count, 0);
  const isEmpty = summary.totalVolume <= 0;

  return (
    <div className="card mt-6 p-6 sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="max-w-xl">
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Monthly volume model</h3>
          <p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
            Blend the three payment types as they actually arrive — charges per month × average ticket each —
            to see your monthly fee bill and blended effective rate. The same forward math, applied per leg.
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {VOLUME_PRESETS.map((p, i) => (
            <button
              key={p.label}
              type="button"
              onClick={() => applyPreset(p.legs)}
              className={`rounded-full px-2.5 py-1 text-xs font-medium transition focus-calm ${
                activePreset === i
                  ? 'border border-indigo-500 bg-indigo-50 text-indigo-700 dark:border-indigo-400 dark:bg-indigo-500/15 dark:text-indigo-300'
                  : 'border border-slate-200 bg-white text-slate-500 hover:border-indigo-300 hover:text-indigo-600 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-400 dark:hover:border-indigo-400/50 dark:hover:text-indigo-300'
              }`}
              aria-pressed={activePreset === i}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-3">
        {legs.map((l) => {
          const res = summary.legs.find((r) => r.type === l.type)!;
          const meta = feeTypes.find((f) => f.id === l.type)!;
          return (
            <div key={l.key} className="rounded-xl border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-white/[0.03] p-4">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">{meta.label}</span>
                <span className="font-mono text-[11px] text-slate-500 dark:text-slate-400">{meta.sub}</span>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <NumberInput
                  id={`vol-${l.key}-count`}
                  label="Charges / mo"
                  value={l.count}
                  onChange={(n) => set(`${l.key}Count`, n)}
                  min={0}
                  placeholder="40"
                />
                <NumberInput
                  id={`vol-${l.key}-ticket`}
                  label="Avg ticket"
                  value={l.ticket}
                  onChange={(n) => set(`${l.key}Ticket`, n)}
                  min={0}
                  prefix="$"
                  placeholder="85"
                />
              </div>
              <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
                Volume <span className="readout font-medium text-slate-700 dark:text-slate-200">{usd(res.volume, 0)}</span>
                {' · '}fee <span className="readout font-medium text-rose-600 dark:text-rose-400">{usd(res.fee)}</span>
                {res.volume > 0 && (
                  <>
                    {' · '}<span className="readout font-medium text-slate-700 dark:text-slate-200">{pct(res.effectiveRate, 2)}</span>
                  </>
                )}
              </p>
            </div>
          );
        })}
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-live="polite">
        <VolumeStat label="Monthly processed volume" value={usd(summary.totalVolume, 0)} />
        <VolumeStat label="Total fees / mo" value={usd(summary.totalFee)} tone="fee" />
        <VolumeStat label="Net deposited / mo" value={usd(summary.totalNet)} tone="net" />
        <VolumeStat label="Blended effective rate" value={pct(summary.blendedRate, 2)} tone="hi" />
      </div>

      {isEmpty ? (
        <p className="mt-4 flex items-start gap-2 rounded-lg border border-dashed border-slate-200 p-3 text-xs leading-relaxed text-slate-500 dark:border-white/10 dark:text-slate-400">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-slate-400 dark:text-slate-500" aria-hidden="true" />
          Set a transaction count and an average ticket to model your month.
        </p>
      ) : summary.achFloorFee !== null && summary.achFloorSaving > 0 ? (
        <p className="mt-4 flex items-start gap-2 rounded-lg bg-emerald-50 p-3 text-xs leading-relaxed text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-300">
          <TrendingDown className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>
            ACH undercuts cards on every ticket — 0.8% with no fixed fee beats 2.9% + $0.30 at any
            amount. Collecting all <strong>{cardCount}</strong> card
            transaction{cardCount === 1 ? '' : 's'} as bank debit instead would drop monthly fees to{' '}
            <strong>{usd(summary.achFloorFee)}</strong> — saving <strong>{usd(summary.achFloorSaving)}/mo</strong>{' '}
            ({usd(summary.achFloorSaving * 12)}/yr). ACH pulls from US bank accounts only, settles slower,
            and carries return risk; how much of your volume can actually move is a business question,
            not arithmetic.
          </span>
        </p>
      ) : (
        <p className="mt-4 text-xs text-slate-500 dark:text-slate-400">
          Nothing left to move: this mix has no card fees to displace, so it already sits at the
          ACH payment-cost floor for published rates.
        </p>
      )}
    </div>
  );
}

function VolumeStat({
  label,
  value,
  tone = 'plain',
}: {
  label: string;
  value: string;
  tone?: 'plain' | 'fee' | 'net' | 'hi';
}) {
  const toneCls =
    tone === 'fee'
      ? 'text-rose-600 dark:text-rose-400'
      : tone === 'net'
        ? 'text-emerald-600 dark:text-emerald-400'
        : tone === 'hi'
          ? 'text-indigo-600 dark:text-indigo-300'
          : 'text-slate-900 dark:text-slate-100';
  return (
    <div className="rounded-xl border border-slate-200 dark:border-white/[0.08] bg-slate-50/60 dark:bg-white/[0.03] p-4">
      <div className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</div>
      <div className={`readout mt-1 text-xl font-bold ${toneCls}`}>{value}</div>
    </div>
  );
}

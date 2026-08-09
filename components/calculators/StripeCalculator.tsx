'use client';

import { useMemo, useState } from 'react';
import { Info, RotateCcw } from 'lucide-react';
import NumberInput, { AnimatedNumber, CopyButton, SliderControl } from '@/components/NumberInput';
import { STRIPE_RATES, type StripeFeeType, computeFee, reverseFromNet } from '@/lib/stripe';
import { usd, pct } from '@/lib/format';

type Mode = 'forward' | 'reverse';

const feeTypes: { id: StripeFeeType; label: string; sub: string }[] = [
  { id: 'domestic', label: 'Domestic card', sub: '2.9% + $0.30' },
  { id: 'international', label: 'International card', sub: '4.4% + $0.30' },
  { id: 'ach', label: 'ACH transfer', sub: '0.8% · cap $5' },
];

const AMOUNT_PRESETS = [100, 1000, 10000, 50000];

export default function StripeCalculator() {
  const [mode, setMode] = useState<Mode>('forward');
  const [feeType, setFeeType] = useState<StripeFeeType>('domestic');
  const [amount, setAmount] = useState<number>(100);
  const [targetNet, setTargetNet] = useState<number>(1000);

  const result = useMemo(() => {
    if (mode === 'forward') {
      return computeFee(amount, feeType);
    }
    return reverseFromNet(targetNet, feeType);
  }, [mode, feeType, amount, targetNet]);

  // In reverse mode, the "amount" the user enters is the net they want; the
  // computed charge is the suggested invoice total.
  const isReverse = mode === 'reverse';
  const rate = STRIPE_RATES[feeType];

  function reset() {
    setMode('forward');
    setFeeType('domestic');
    setAmount(100);
    setTargetNet(1000);
  }

  const netPct = result.charge > 0 ? (result.net / result.charge) * 100 : 0;
  const feePct = result.effectiveRate;

  const copyText = isReverse
    ? `Stripe ${rate.label} (reverse): charge ${usd(result.charge)} to net ${usd(result.net)} (fee ${usd(result.fee)}, effective ${pct(result.effectiveRate)})`
    : `Stripe ${rate.label}: charge ${usd(result.charge)} → net ${usd(result.net)} (fee ${usd(result.fee)}, effective ${pct(result.effectiveRate)})`;

  return (
    <div className="grid gap-6 lg:grid-cols-5">
      {/* Inputs */}
      <div className="card lg:col-span-3 p-6 sm:p-8">
        {/* Mode switch */}
        <div className="mb-6">
          <div className="grid grid-cols-2 gap-2 rounded-xl border border-slate-800 bg-base-800/60 p-1">
            <button
              type="button"
              onClick={() => setMode('forward')}
              className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${
                mode === 'forward'
                  ? 'border border-cyan-500/50 bg-cyan-500/10 text-cyan-300 shadow-glow-cyan'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              aria-pressed={mode === 'forward'}
            >
              Forward — what will I net?
            </button>
            <button
              type="button"
              onClick={() => setMode('reverse')}
              className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${
                mode === 'reverse'
                  ? 'border border-cyan-500/50 bg-cyan-500/10 text-cyan-300 shadow-glow-cyan'
                  : 'text-slate-400 hover:text-slate-200'
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
                className={`rounded-xl border p-3 text-left transition ${
                  feeType === ft.id
                    ? 'border-cyan-500/60 bg-cyan-500/10 shadow-glow-cyan'
                    : 'border-slate-700 bg-base-700/50 hover:border-cyan-500/40'
                }`}
                aria-pressed={feeType === ft.id}
              >
                <div className="text-sm font-semibold text-white">{ft.label}</div>
                <div className="mt-0.5 font-mono text-xs text-slate-400">{ft.sub}</div>
              </button>
            ))}
          </div>
        </fieldset>

        {/* Primary amount slider + presets */}
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

        <div className="flex items-start gap-2 rounded-lg border border-slate-800 bg-base-800/60 p-3 text-xs text-slate-400">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-cyan-500/70" aria-hidden="true" />
          <p>
            Using Stripe US published rates: <strong className="text-slate-200">{rate.label}</strong> ({rate.description}).
            Currency-conversion or card-refund fees are not included.
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
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Result</h2>

          {isReverse ? (
            <div className="mt-3 animate-fade-in-up">
              <div className="text-xs font-medium uppercase tracking-wide text-slate-500">Charge this much</div>
              <AnimatedNumber
                value={result.charge}
                format={(n) => usd(n)}
                className="readout mt-1 block text-4xl font-extrabold tracking-tight text-cyan-400 text-glow-cyan"
              />
              <p className="mt-1 text-sm text-slate-400">
                to net <strong className="text-slate-200">{usd(result.net)}</strong> after a {usd(result.fee)} fee.
              </p>
            </div>
          ) : (
            <div className="mt-3 animate-fade-in-up">
              <div className="text-xs font-medium uppercase tracking-wide text-slate-500">You receive</div>
              <AnimatedNumber
                value={result.net}
                format={(n) => usd(n)}
                className="readout mt-1 block text-4xl font-extrabold tracking-tight text-emerald-400 text-glow-green"
              />
              <p className="mt-1 text-sm text-slate-400">
                from a <strong className="text-slate-200">{usd(result.charge)}</strong> charge.
              </p>
            </div>
          )}

          {/* Fee breakdown donut / progress bar */}
          <FeeDonut netPct={netPct} feePct={feePct} net={result.net} fee={result.fee} />
        </div>

        <div className="card p-6 sm:p-8">
          <h3 className="text-sm font-semibold text-white">Breakdown</h3>
          <dl className="mt-3 space-y-2.5 text-sm">
            <div className="flex justify-between">
              <dt className="text-slate-400">Charge amount</dt>
              <dd className="readout font-semibold text-slate-100">
                <AnimatedNumber value={result.charge} format={(n) => usd(n)} />
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-400">Stripe fee</dt>
              <dd className="readout font-semibold text-rose-400">
                −<AnimatedNumber value={result.fee} format={(n) => usd(n)} />
              </dd>
            </div>
            <div className="flex justify-between border-t border-slate-800 pt-2.5">
              <dt className="font-medium text-slate-300">Net received</dt>
              <dd className="readout font-bold text-emerald-400">
                <AnimatedNumber value={result.net} format={(n) => usd(n)} />
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-400">Effective rate</dt>
              <dd className="readout font-semibold text-slate-100">
                <AnimatedNumber value={result.effectiveRate} format={(n) => pct(n)} />
              </dd>
            </div>
          </dl>
        </div>

        {/* Quick comparison of all 3 types for the same magnitude */}
        <QuickCompare amount={isReverse ? targetNet : amount} isReverse={isReverse} />
      </div>
    </div>
  );
}

/** Glowing horizontal donut/progress bar showing Net vs Fee percentage. */
function FeeDonut({
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
  const total = Math.max(0.0001, netPct + feePct);
  const netW = (netPct / total) * 100;
  const feeW = (feePct / total) * 100;

  return (
    <div className="mt-6">
      {/* Segmented bar */}
      <div className="flex h-3 w-full overflow-hidden rounded-full border border-slate-800 bg-base-900/60">
        <div
          className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 shadow-[0_0_12px_rgba(16,185,129,0.5)] transition-all duration-500"
          style={{ width: `${netW}%` }}
          title={`Net ${pct(netPct)}`}
        />
        <div
          className="h-full bg-gradient-to-r from-rose-500 to-rose-400 shadow-[0_0_12px_rgba(244,63,94,0.4)] transition-all duration-500"
          style={{ width: `${feeW}%` }}
          title={`Fee ${pct(feePct)}`}
        />
      </div>
      <div className="mt-2.5 flex items-center justify-between text-xs">
        <span className="flex items-center gap-1.5 text-slate-400">
          <span className="inline-block h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
          You keep <strong className="readout text-emerald-300">{pct(netPct)}</strong> · {usd(net)}
        </span>
        <span className="flex items-center gap-1.5 text-slate-400">
          Fee <strong className="readout text-rose-300">{pct(feePct)}</strong> · {usd(fee)}
          <span className="inline-block h-2 w-2 rounded-full bg-rose-400 shadow-[0_0_8px_rgba(244,63,94,0.8)]" />
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
      <div className="border-b border-slate-800 px-5 py-3">
        <h3 className="text-sm font-semibold text-white">All types at this amount</h3>
        <p className="font-mono text-xs text-slate-500">
          {isReverse ? 'Net target' : 'Charge'} of {usd(amount)}
        </p>
      </div>
      <table className="w-full text-sm">
        <thead className="bg-base-800/60 text-left text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-5 py-2 font-medium">Type</th>
            <th className="px-5 py-2 text-right font-medium">Fee</th>
            <th className="px-5 py-2 text-right font-medium">Net</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800">
          {rows.map((r) => (
            <tr key={r.t} className="transition hover:bg-base-700/40">
              <td className="px-5 py-2.5 font-medium text-slate-300">{STRIPE_RATES[r.t].label}</td>
              <td className="readout px-5 py-2.5 text-right text-rose-400">{usd(r.fee)}</td>
              <td className="readout px-5 py-2.5 text-right font-semibold text-slate-100">{usd(r.net)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

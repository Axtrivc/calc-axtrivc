'use client';

import { useMemo, useState } from 'react';
import { Info, RotateCcw } from 'lucide-react';
import NumberInput, { StatCard } from '@/components/NumberInput';
import { STRIPE_RATES, type StripeFeeType, computeFee, reverseFromNet } from '@/lib/stripe';
import { usd, pct } from '@/lib/format';

type Mode = 'forward' | 'reverse';

const feeTypes: { id: StripeFeeType; label: string; sub: string }[] = [
  { id: 'domestic', label: 'Domestic card', sub: '2.9% + $0.30' },
  { id: 'international', label: 'International card', sub: '4.4% + $0.30' },
  { id: 'ach', label: 'ACH transfer', sub: '0.8% · cap $5' },
];

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

  return (
    <div className="grid gap-6 lg:grid-cols-5">
      {/* Inputs */}
      <div className="card lg:col-span-3 p-6 sm:p-8">
        {/* Mode switch */}
        <div className="mb-6">
          <div className="grid grid-cols-2 gap-2 rounded-xl bg-slate-100 p-1">
            <button
              type="button"
              onClick={() => setMode('forward')}
              className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${
                mode === 'forward' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
              aria-pressed={mode === 'forward'}
            >
              Forward — what will I net?
            </button>
            <button
              type="button"
              onClick={() => setMode('reverse')}
              className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${
                mode === 'reverse' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
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
                    ? 'border-indigo-500 bg-indigo-50 ring-1 ring-indigo-500'
                    : 'border-slate-300 bg-white hover:border-slate-400'
                }`}
                aria-pressed={feeType === ft.id}
              >
                <div className="text-sm font-semibold text-slate-900">{ft.label}</div>
                <div className="mt-0.5 text-xs text-slate-500">{ft.sub}</div>
              </button>
            ))}
          </div>
        </fieldset>

        {/* Primary amount input */}
        <div className="mb-6">
          {isReverse ? (
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
          ) : (
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
          )}
        </div>

        <div className="flex items-start gap-2 rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
          <p>
            Using Stripe US published rates: <strong>{rate.label}</strong> ({rate.description}).
            Currency-conversion or card-refund fees are not included.
          </p>
        </div>

        <button type="button" onClick={reset} className="btn-ghost mt-4">
          <RotateCcw className="h-4 w-4" aria-hidden="true" />
          Reset
        </button>
      </div>

      {/* Results */}
      <div className="lg:col-span-2 space-y-4">
        <div className="card p-6 sm:p-8">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Result</h2>

          {isReverse ? (
            <>
              <div className="mt-3">
                <div className="text-xs font-medium uppercase tracking-wide text-slate-500">Charge this much</div>
                <div className="mt-1 text-4xl font-extrabold tracking-tight text-indigo-600 tabular-nums">
                  {usd(result.charge)}
                </div>
                <p className="mt-1 text-sm text-slate-500">
                  to net <strong className="text-slate-700">{usd(result.net)}</strong> after a {usd(result.fee)} fee.
                </p>
              </div>
            </>
          ) : (
            <>
              <div className="mt-3">
                <div className="text-xs font-medium uppercase tracking-wide text-slate-500">You receive</div>
                <div className="mt-1 text-4xl font-extrabold tracking-tight text-emerald-600 tabular-nums">
                  {usd(result.net)}
                </div>
                <p className="mt-1 text-sm text-slate-500">
                  from a <strong className="text-slate-700">{usd(result.charge)}</strong> charge.
                </p>
              </div>
            </>
          )}

          <div className="mt-5 h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full bg-emerald-500" style={{ width: `${result.charge > 0 ? (result.net / result.charge) * 100 : 0}%` }} />
          </div>
          <div className="mt-2 flex justify-between text-xs text-slate-500">
            <span>You keep {result.charge > 0 ? pct((result.net / result.charge) * 100) : '0.0%'}</span>
            <span>Fee {result.charge > 0 ? pct(result.effectiveRate) : '0.0%'}</span>
          </div>
        </div>

        <div className="card p-6 sm:p-8">
          <h3 className="text-sm font-semibold text-slate-900">Breakdown</h3>
          <dl className="mt-3 space-y-2.5 text-sm">
            <div className="flex justify-between">
              <dt className="text-slate-600">Charge amount</dt>
              <dd className="font-semibold tabular-nums text-slate-900">{usd(result.charge)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-600">Stripe fee</dt>
              <dd className="font-semibold tabular-nums text-rose-600">−{usd(result.fee)}</dd>
            </div>
            <div className="flex justify-between border-t border-slate-200 pt-2.5">
              <dt className="font-medium text-slate-700">Net received</dt>
              <dd className="font-bold tabular-nums text-emerald-600">{usd(result.net)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-600">Effective rate</dt>
              <dd className="font-semibold tabular-nums text-slate-900">{pct(result.effectiveRate)}</dd>
            </div>
          </dl>
        </div>

        {/* Quick comparison of all 3 types for the same magnitude */}
        <QuickCompare amount={isReverse ? targetNet : amount} isReverse={isReverse} />
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
      <div className="border-b border-slate-200 px-5 py-3">
        <h3 className="text-sm font-semibold text-slate-900">All types at this amount</h3>
        <p className="text-xs text-slate-500">{isReverse ? 'Net target' : 'Charge'} of {usd(amount)}</p>
      </div>
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-5 py-2 font-medium">Type</th>
            <th className="px-5 py-2 text-right font-medium">Fee</th>
            <th className="px-5 py-2 text-right font-medium">Net</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((r) => (
            <tr key={r.t}>
              <td className="px-5 py-2.5 font-medium text-slate-700">{STRIPE_RATES[r.t].label}</td>
              <td className="px-5 py-2.5 text-right tabular-nums text-rose-600">{usd(r.fee)}</td>
              <td className="px-5 py-2.5 text-right font-semibold tabular-nums text-slate-900">{usd(r.net)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

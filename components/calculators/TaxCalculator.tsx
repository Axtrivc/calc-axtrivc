'use client';

import { useMemo, useState } from 'react';
import { Info, RotateCcw, Trophy } from 'lucide-react';
import NumberInput from '@/components/NumberInput';
import { compareEntities, TAX_CONSTANTS } from '@/lib/tax';
import { usd, pct, numFmt } from '@/lib/format';

export default function TaxCalculator() {
  const [profit, setProfit] = useState(200000);

  const r = useMemo(() => compareEntities(profit), [profit]);
  const llcWins = r.winner === 'llc';
  const tie = r.winner === 'tie';

  function reset() {
    setProfit(200000);
  }

  // For the breakeven-style visualization: show effective rate bars
  const maxRate = 40; // scale for the bar visualization
  const llcBarW = Math.min(100, (r.llc.effectiveRate / maxRate) * 100);
  const ccBarW = Math.min(100, (r.ccorp.effectiveRate / maxRate) * 100);

  return (
    <div className="grid gap-6 lg:grid-cols-5">
      {/* Input */}
      <div className="card lg:col-span-2 p-6 sm:p-8">
        <h2 className="mb-6 text-base font-semibold text-slate-900">Business profit</h2>
        <NumberInput
          id="profit"
          label="Annual net business profit"
          value={profit}
          onChange={setProfit}
          min={0}
          prefix="$"
          placeholder="200000"
          helpText="Pre-tax profit after all business expenses, before owner compensation."
        />

        <div className="mt-6 rounded-lg bg-slate-50 p-4 text-xs leading-relaxed text-slate-600">
          <p className="font-semibold text-slate-700">Assumptions (2025, US federal, single filer):</p>
          <ul className="mt-2 space-y-1">
            <li>• Standard deduction ${numFmt(TAX_CONSTANTS.stdDeduction, 0)}</li>
            <li>• SE tax {pct(TAX_CONSTANTS.seRate * 100, 1)} up to ${numFmt(TAX_CONSTANTS.seCap, 0)}</li>
            <li>• QBI deduction {pct(TAX_CONSTANTS.qbiRate * 100, 0)} (LLC)</li>
            <li>• Corporate tax {pct(TAX_CONSTANTS.corporateRate * 100, 0)} flat (C-Corp)</li>
            <li>• Qualified dividends at LTCG rates (C-Corp)</li>
            <li>• No state tax · 100% of profit to one owner</li>
          </ul>
        </div>

        <button type="button" onClick={reset} className="btn-ghost mt-4">
          <RotateCcw className="h-4 w-4" aria-hidden="true" />
          Reset
        </button>
      </div>

      {/* Results */}
      <div className="lg:col-span-3 space-y-4">
        {/* Winner banner */}
        <div
          className={`card p-6 sm:p-8 ${
            tie ? 'border-slate-300' : llcWins ? 'border-emerald-200 bg-emerald-50/40' : 'border-amber-200 bg-amber-50/40'
          }`}
        >
          <div className="flex items-center gap-2">
            <Trophy
              className={`h-5 w-5 ${tie ? 'text-slate-400' : llcWins ? 'text-emerald-600' : 'text-amber-600'}`}
              aria-hidden="true"
            />
            <span className="text-sm font-semibold text-slate-700">
              {tie ? 'Roughly equal' : `${llcWins ? 'LLC' : 'C-Corp'} saves you more`}
            </span>
          </div>
          {!tie && (
            <p className="mt-2 text-lg text-slate-900">
              On <strong>${numFmt(profit, 0)}</strong> of profit, choosing{' '}
              <strong>{llcWins ? 'an LLC' : 'a C-Corp'}</strong> saves about{' '}
              <strong className={llcWins ? 'text-emerald-700' : 'text-amber-700'}>
                {usd(r.delta, 0)}
              </strong>{' '}
              in federal tax ({pct(Math.abs(r.llc.effectiveRate - r.ccorp.effectiveRate), 1)} pts lower).
            </p>
          )}
          {tie && (
            <p className="mt-2 text-slate-700">
              At this profit level the two structures are roughly equivalent in pure federal tax.
            </p>
          )}
        </div>

        {/* Effective rate comparison bars */}
        <div className="card p-6 sm:p-8">
          <h3 className="text-sm font-semibold text-slate-900">Effective federal tax rate</h3>
          <p className="text-xs text-slate-500">Total tax ÷ profit. Lower is better.</p>

          <div className="mt-5 space-y-5">
            <RateBar
              label="LLC"
              rate={r.llc.effectiveRate}
              width={llcBarW}
              color="bg-emerald-500"
              emphasize={llcWins}
              sub={`${usd(r.llc.totalTax, 0)} total tax`}
            />
            <RateBar
              label="C-Corp"
              rate={r.ccorp.effectiveRate}
              width={ccBarW}
              color="bg-amber-500"
              emphasize={!llcWins && !tie}
              sub={`${usd(r.ccorp.totalTax, 0)} total tax`}
            />
          </div>
        </div>

        {/* Side-by-side breakdown */}
        <div className="grid gap-4 sm:grid-cols-2">
          <BreakdownCard
            title="LLC (pass-through)"
            tone="emerald"
            rows={[
              { label: 'Self-employment tax', value: usd(r.llc.seTax, 0) },
              { label: 'QBI deduction', value: `−${usd(r.llc.qbiDeduction, 0)}`, muted: true },
              { label: 'Ordinary income tax', value: usd(r.llc.incomeTax, 0) },
            ]}
            totalLabel="Total federal tax"
            total={r.llc.totalTax}
            afterTax={r.llc.afterTax}
            effectiveRate={r.llc.effectiveRate}
          />
          <BreakdownCard
            title="C-Corp (double taxed)"
            tone="amber"
            rows={[
              { label: 'Corporate tax (21%)', value: usd(r.ccorp.corporateTax, 0) },
              { label: 'Dividends paid out', value: usd(r.ccorp.dividends, 0), muted: true },
              { label: 'Dividend tax (LTCG)', value: usd(r.ccorp.dividendTax, 0) },
            ]}
            totalLabel="Total federal tax"
            total={r.ccorp.totalTax}
            afterTax={r.ccorp.afterTax}
            effectiveRate={r.ccorp.effectiveRate}
          />
        </div>

        <div className="flex items-start gap-2 rounded-xl border border-slate-200 bg-slate-50/60 p-4 text-xs leading-relaxed text-slate-600">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
          <p>
            This is a <strong>simplified federal illustration</strong>, not tax advice. Real C-Corp
            owners usually pay themselves a W-2 salary (deductible to the corp) and only dividend
            surplus — which can lower the C-Corp bill. Conversely, real LLCs may elect S-Corp status
            to cut SE tax further. State taxes can add 0–13%. Always model your real situation with
            a CPA before choosing an entity.
          </p>
        </div>
      </div>
    </div>
  );
}

function RateBar({
  label,
  rate,
  width,
  color,
  emphasize,
  sub,
}: {
  label: string;
  rate: number;
  width: number;
  color: string;
  emphasize?: boolean;
  sub?: string;
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between">
        <span className={`text-sm font-semibold ${emphasize ? 'text-slate-900' : 'text-slate-600'}`}>
          {label}
          {emphasize && <span className="ml-2 chip bg-emerald-100 text-emerald-700">lowest</span>}
        </span>
        <span className="text-lg font-bold tabular-nums text-slate-900">{pct(rate, 1)}</span>
      </div>
      <div className="h-3 w-full overflow-hidden rounded-full bg-slate-100">
        <div className={`h-full rounded-full ${color} transition-all`} style={{ width: `${width}%` }} />
      </div>
      {sub && <p className="mt-1 text-xs text-slate-500">{sub}</p>}
    </div>
  );
}

function BreakdownCard({
  title,
  tone,
  rows,
  totalLabel,
  total,
  afterTax,
  effectiveRate,
}: {
  title: string;
  tone: 'emerald' | 'amber';
  rows: { label: string; value: string; muted?: boolean }[];
  totalLabel: string;
  total: number;
  afterTax: number;
  effectiveRate: number;
}) {
  const toneClasses =
    tone === 'emerald'
      ? { ring: 'border-emerald-200', accent: 'text-emerald-700', total: 'text-emerald-700' }
      : { ring: 'border-amber-200', accent: 'text-amber-700', total: 'text-amber-700' };
  return (
    <div className={`card overflow-hidden ${toneClasses.ring}`}>
      <div className="border-b border-slate-100 px-5 py-3">
        <h3 className={`text-sm font-bold ${toneClasses.accent}`}>{title}</h3>
      </div>
      <dl className="space-y-2 px-5 py-4 text-sm">
        {rows.map((row) => (
          <div key={row.label} className="flex justify-between">
            <dt className="text-slate-600">{row.label}</dt>
            <dd className={`tabular-nums ${row.muted ? 'text-slate-400' : 'font-medium text-slate-900'}`}>{row.value}</dd>
          </div>
        ))}
        <div className="mt-2 flex justify-between border-t border-slate-200 pt-2.5">
          <dt className="font-semibold text-slate-700">{totalLabel}</dt>
          <dd className={`font-bold tabular-nums ${toneClasses.total}`}>{usd(total, 0)}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-slate-600">After-tax income</dt>
          <dd className="font-semibold tabular-nums text-slate-900">{usd(afterTax, 0)}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-slate-600">Effective rate</dt>
          <dd className="font-semibold tabular-nums text-slate-900">{pct(effectiveRate, 1)}</dd>
        </div>
      </dl>
    </div>
  );
}

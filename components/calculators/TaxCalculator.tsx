'use client';

import { useMemo, useState } from 'react';
import { Info, RotateCcw, Trophy } from 'lucide-react';
import NumberInput, { AnimatedNumber, CopyButton, SliderControl } from '@/components/NumberInput';
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

  const copyText = !tie
    ? `LLC vs C-Corp @ ${usd(profit, 0)} profit: ${llcWins ? 'LLC' : 'C-Corp'} wins by ${usd(r.delta, 0)} — LLC ${pct(r.llc.effectiveRate, 1)} (${usd(r.llc.totalTax, 0)} tax) vs C-Corp ${pct(r.ccorp.effectiveRate, 1)} (${usd(r.ccorp.totalTax, 0)} tax)`
    : `LLC vs C-Corp @ ${usd(profit, 0)} profit: roughly equal — LLC ${pct(r.llc.effectiveRate, 1)} vs C-Corp ${pct(r.ccorp.effectiveRate, 1)}`;

  return (
    <div className="grid gap-6 lg:grid-cols-5">
      {/* Input */}
      <div className="card lg:col-span-2 p-6 sm:p-8">
        <h2 className="mb-6 text-base font-semibold text-white">Business profit</h2>
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
        <div className="mt-3">
          <SliderControl
            id="profit-slider"
            label=""
            value={profit}
            onChange={setProfit}
            min={10000}
            max={2000000}
            step={5000}
            prefix="$"
            logarithmic
            presets={[100000, 250000, 1000000]}
          />
        </div>

        <div className="mt-6 rounded-lg border border-slate-800 bg-base-800/60 p-4 text-xs leading-relaxed text-slate-400">
          <p className="font-semibold text-slate-300">Assumptions (2025, US federal, single filer):</p>
          <ul className="mt-2 space-y-1">
            <li>• Standard deduction ${numFmt(TAX_CONSTANTS.stdDeduction, 0)}</li>
            <li>• SE tax {pct(TAX_CONSTANTS.seRate * 100, 1)} up to ${numFmt(TAX_CONSTANTS.seCap, 0)}</li>
            <li>• QBI deduction {pct(TAX_CONSTANTS.qbiRate * 100, 0)} (LLC)</li>
            <li>• Corporate tax {pct(TAX_CONSTANTS.corporateRate * 100, 0)} flat (C-Corp)</li>
            <li>• Qualified dividends at LTCG rates (C-Corp)</li>
            <li>• No state tax · 100% of profit to one owner</li>
          </ul>
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
      <div className="lg:col-span-3 space-y-4">
        {/* Winner banner */}
        <div
          className={`card p-6 sm:p-8 ${
            tie
              ? 'border-slate-700'
              : llcWins
                ? 'border-emerald-500/40 shadow-glow-green'
                : 'border-amber-500/40'
          }`}
        >
          <div className="flex items-center gap-2">
            <Trophy
              className={`h-5 w-5 ${tie ? 'text-slate-500' : llcWins ? 'text-emerald-400' : 'text-amber-400'}`}
              aria-hidden="true"
            />
            <span className="text-sm font-semibold text-slate-300">
              {tie ? 'Roughly equal' : `${llcWins ? 'LLC' : 'C-Corp'} saves you more`}
            </span>
          </div>
          {!tie && (
            <p className="mt-2 text-lg text-slate-100">
              On <span className="readout">${numFmt(profit, 0)}</span> of profit, choosing{' '}
              <strong>{llcWins ? 'an LLC' : 'a C-Corp'}</strong> saves about{' '}
              <strong className={llcWins ? 'text-emerald-400' : 'text-amber-400'}>
                <AnimatedNumber value={r.delta} format={(n) => usd(n, 0)} />
              </strong>{' '}
              in federal tax ({pct(Math.abs(r.llc.effectiveRate - r.ccorp.effectiveRate), 1)} pts lower).
            </p>
          )}
          {tie && (
            <p className="mt-2 text-slate-300">
              At this profit level the two structures are roughly equivalent in pure federal tax.
            </p>
          )}
        </div>

        {/* Animated dual "Energy Bar" comparison */}
        <div className="card p-6 sm:p-8">
          <h3 className="text-sm font-semibold text-white">Effective federal tax rate</h3>
          <p className="text-xs text-slate-400">Total tax ÷ profit. Lower is better.</p>

          <div className="mt-5 space-y-6">
            <EnergyBar
              label="LLC"
              rate={r.llc.effectiveRate}
              width={llcBarW}
              tone="emerald"
              emphasize={llcWins}
              sub={`${usd(r.llc.totalTax, 0)} total tax`}
            />
            <EnergyBar
              label="C-Corp"
              rate={r.ccorp.effectiveRate}
              width={ccBarW}
              tone="amber"
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

        <div className="flex items-start gap-2 rounded-xl border border-slate-800 bg-base-800/60 p-4 text-xs leading-relaxed text-slate-400">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-cyan-500/70" aria-hidden="true" />
          <p>
            This is a <strong className="text-slate-200">simplified federal illustration</strong>, not tax advice. Real C-Corp
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

/** Animated dual "Energy Bar" with glowing fill + shimmer overlay. */
function EnergyBar({
  label,
  rate,
  width,
  tone,
  emphasize,
  sub,
}: {
  label: string;
  rate: number;
  width: number;
  tone: 'emerald' | 'amber';
  emphasize?: boolean;
  sub?: string;
}) {
  const toneClasses =
    tone === 'emerald'
      ? {
          fill: 'from-emerald-600 to-teal-400',
          glow: 'shadow-[0_0_14px_rgba(16,185,129,0.6)]',
          text: 'text-emerald-400',
          badge: 'border-emerald-500/50 bg-emerald-500/15 text-emerald-300',
        }
      : {
          fill: 'from-amber-600 to-orange-400',
          glow: 'shadow-[0_0_14px_rgba(245,158,11,0.55)]',
          text: 'text-amber-400',
          badge: 'border-amber-500/50 bg-amber-500/15 text-amber-300',
        };

  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between">
        <span className={`text-sm font-semibold ${emphasize ? 'text-white' : 'text-slate-400'}`}>
          {label}
          {emphasize && (
            <span className={`chip ml-2 ${toneClasses.badge}`}>
              <span className={`h-1.5 w-1.5 rounded-full bg-current ${toneClasses.text}`} />
              lowest
            </span>
          )}
        </span>
        <AnimatedNumber
          value={rate}
          format={(n) => pct(n, 1)}
          className={`readout text-lg font-bold ${toneClasses.text}`}
        />
      </div>
      {/* Energy bar track */}
      <div className="relative h-4 w-full overflow-hidden rounded-full border border-slate-800 bg-base-900/70">
        <div
          className={`relative h-full rounded-full bg-gradient-to-r ${toneClasses.fill} ${toneClasses.glow} transition-all duration-700 ease-out`}
          style={{ width: `${width}%` }}
        >
          {/* Shimmer sweep overlay */}
          <div
            className="absolute inset-0 opacity-40"
            style={{
              backgroundImage:
                'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.35) 50%, transparent 100%)',
              backgroundSize: '200% 100%',
              animation: 'shimmer 2.5s linear infinite',
            }}
          />
        </div>
      </div>
      {sub && <p className="mt-1 font-mono text-xs text-slate-500">{sub}</p>}
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
      ? { ring: 'border-emerald-500/30', accent: 'text-emerald-400', total: 'text-emerald-400' }
      : { ring: 'border-amber-500/30', accent: 'text-amber-400', total: 'text-amber-400' };
  return (
    <div className={`card overflow-hidden ${toneClasses.ring}`}>
      <div className="border-b border-slate-800 px-5 py-3">
        <h3 className={`text-sm font-bold ${toneClasses.accent}`}>{title}</h3>
      </div>
      <dl className="space-y-2 px-5 py-4 text-sm">
        {rows.map((row) => (
          <div key={row.label} className="flex justify-between">
            <dt className="text-slate-400">{row.label}</dt>
            <dd className={`readout ${row.muted ? 'text-slate-500' : 'font-medium text-slate-100'}`}>
              {row.value}
            </dd>
          </div>
        ))}
        <div className="mt-2 flex justify-between border-t border-slate-800 pt-2.5">
          <dt className="font-semibold text-slate-300">{totalLabel}</dt>
          <dd className={`readout font-bold ${toneClasses.total}`}>
            <AnimatedNumber value={total} format={(n) => usd(n, 0)} />
          </dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-slate-400">After-tax income</dt>
          <dd className="readout font-semibold text-slate-100">
            <AnimatedNumber value={afterTax} format={(n) => usd(n, 0)} />
          </dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-slate-400">Effective rate</dt>
          <dd className="readout font-semibold text-slate-100">
            <AnimatedNumber value={effectiveRate} format={(n) => pct(n, 1)} />
          </dd>
        </div>
      </dl>
    </div>
  );
}

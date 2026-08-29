'use client';

import { useEffect, useMemo } from 'react';
import { Info, RotateCcw, Trophy } from 'lucide-react';
import NumberInput, { AnimatedNumber, CopyButton, SliderControl } from '@/components/NumberInput';
import ScenarioButtons from '@/components/ScenarioButtons';
import { compareEntities, TAX_CONSTANTS } from '@/lib/tax';
import { usd, pct, numFmt } from '@/lib/format';
import { useWorkbenchInputs, recordRecent } from '@/lib/workbench';

const SLUG = 'llc-vs-ccorp-tax-calculator';
const DEFAULTS = { profit: 200000 };

export default function TaxCalculator() {
  const { values, set, reset } = useWorkbenchInputs(SLUG, DEFAULTS);
  const profit = values.profit;
  const setProfit = (n: number) => set('profit', n);

  useEffect(() => {
    recordRecent(SLUG);
  }, []);

  const r = useMemo(() => compareEntities(profit), [profit]);
  const llcWins = r.winner === 'llc';
  const tie = r.winner === 'tie';

  const maxRate = 40;
  const llcBarW = Math.min(100, (r.llc.effectiveRate / maxRate) * 100);
  const ccBarW = Math.min(100, (r.ccorp.effectiveRate / maxRate) * 100);

  const copyText = !tie
    ? `LLC vs C-Corp @ ${usd(profit, 0)} profit: ${llcWins ? 'LLC' : 'C-Corp'} wins by ${usd(r.delta, 0)} — LLC ${pct(r.llc.effectiveRate, 1)} (${usd(r.llc.totalTax, 0)} tax) vs C-Corp ${pct(r.ccorp.effectiveRate, 1)} (${usd(r.ccorp.totalTax, 0)} tax)`
    : `LLC vs C-Corp @ ${usd(profit, 0)} profit: roughly equal — LLC ${pct(r.llc.effectiveRate, 1)} vs C-Corp ${pct(r.ccorp.effectiveRate, 1)}`;

  return (
    <div className="grid gap-6 lg:grid-cols-5">
      {/* Input */}
      <div className="card lg:col-span-2 p-6 sm:p-8">
        <h2 className="mb-6 text-base font-semibold text-slate-900 dark:text-slate-100">Business profit</h2>
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
            label="" ariaLabel="Annual net business profit"
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

        <div className="mt-6 rounded-lg bg-slate-50 p-4 text-xs leading-relaxed text-slate-600 dark:bg-white/[0.03] dark:text-slate-300">
          <p className="font-semibold text-slate-700 dark:text-slate-200">Assumptions (2025, US federal, single filer):</p>
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
            <RotateCcw className="h-4 w-4 text-indigo-500 dark:text-indigo-300" aria-hidden="true" />
            Reset
          </button>
          <CopyButton text={copyText} label="Copy result" />
          <ScenarioButtons
            slug={SLUG}
            shortTitle="LLC vs C-Corp"
            href="/llc-vs-ccorp-tax-calculator/"
            params={{ profit }}
          />
        </div>
      </div>

      {/* Results */}
      <div className="lg:col-span-3 space-y-4">
        {/* Winner banner */}
        <div
          className={`card p-6 sm:p-8 ${
            tie ? 'border-slate-200 dark:border-white/[0.08]' : llcWins ? 'border-emerald-200 bg-emerald-50 dark:bg-emerald-500/15/40' : 'border-amber-200 bg-amber-50/40'
          }`}
        >
          <div className="flex items-center gap-2">
            <Trophy
              className={`h-5 w-5 ${tie ? 'text-slate-400' : llcWins ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}
              aria-hidden="true"
            />
            <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
              {tie ? 'Roughly equal' : `${llcWins ? 'LLC' : 'C-Corp'} saves you more`}
            </span>
          </div>
          {!tie && (
            <p className="mt-2 text-lg text-slate-900 dark:text-slate-100">
              On <strong>${numFmt(profit, 0)}</strong> of profit, choosing{' '}
              <strong>{llcWins ? 'an LLC' : 'a C-Corp'}</strong> saves about{' '}
              <strong className={llcWins ? 'text-emerald-700 dark:text-emerald-400' : 'text-amber-700'}>
                <AnimatedNumber value={r.delta} format={(n) => usd(n, 0)} />
              </strong>{' '}
              in federal tax ({pct(Math.abs(r.llc.effectiveRate - r.ccorp.effectiveRate), 1)} pts lower).
            </p>
          )}
          {tie && (
            <p className="mt-2 text-slate-700 dark:text-slate-200">
              At this profit level the two structures are roughly equivalent in pure federal tax.
            </p>
          )}
        </div>

        {/* Effective rate comparison bars */}
        <div className="card p-6 sm:p-8">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Effective federal tax rate</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">Total tax ÷ profit. Lower is better.</p>

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

        <div className="flex items-start gap-2 rounded-xl border border-slate-200 bg-slate-50/60 p-4 text-xs leading-relaxed text-slate-600 dark:border-white/[0.08] dark:bg-white/[0.03] dark:text-slate-300">
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
        <span className={`text-sm font-semibold ${emphasize ? 'text-slate-900 dark:text-slate-100' : 'text-slate-600 dark:text-slate-300'}`}>
          {label}
          {emphasize && <span className="chip ml-2 bg-emerald-100 text-emerald-700 dark:text-emerald-400">lowest</span>}
        </span>
        <span className="readout text-lg font-bold text-slate-900 dark:text-slate-100">{pct(rate, 1)}</span>
      </div>
      <div className="h-3 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-white/[0.06]">
        <div className={`h-full rounded-full ${color} transition-all duration-500`} style={{ width: `${width}%` }} />
      </div>
      {sub && <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{sub}</p>}
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
      ? { ring: 'border-emerald-200', accent: 'text-emerald-700 dark:text-emerald-400', total: 'text-emerald-700 dark:text-emerald-400' }
      : { ring: 'border-amber-200', accent: 'text-amber-700', total: 'text-amber-700' };
  return (
    <div className={`card overflow-hidden ${toneClasses.ring}`}>
      <div className="border-b border-slate-100 dark:border-white/[0.06] px-5 py-3">
        <h3 className={`text-sm font-bold ${toneClasses.accent}`}>{title}</h3>
      </div>
      <dl className="space-y-2 px-5 py-4 text-sm">
        {rows.map((row) => (
          <div key={row.label} className="flex justify-between">
            <dt className="text-slate-600 dark:text-slate-300">{row.label}</dt>
            <dd className={`readout ${row.muted ? 'text-slate-400' : 'font-medium text-slate-900 dark:text-slate-100'}`}>{row.value}</dd>
          </div>
        ))}
        <div className="mt-2 flex justify-between border-t border-slate-200 dark:border-white/[0.08] pt-2.5">
          <dt className="font-semibold text-slate-700 dark:text-slate-200">{totalLabel}</dt>
          <dd className={`readout font-bold ${toneClasses.total}`}>
            <AnimatedNumber value={total} format={(n) => usd(n, 0)} />
          </dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-slate-600 dark:text-slate-300">After-tax income</dt>
          <dd className="readout font-semibold text-slate-900 dark:text-slate-100">
            <AnimatedNumber value={afterTax} format={(n) => usd(n, 0)} />
          </dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-slate-600 dark:text-slate-300">Effective rate</dt>
          <dd className="readout font-semibold text-slate-900 dark:text-slate-100">
            <AnimatedNumber value={effectiveRate} format={(n) => pct(n, 1)} />
          </dd>
        </div>
      </dl>
    </div>
  );
}

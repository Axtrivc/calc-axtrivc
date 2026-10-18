import type { Metadata } from 'next';
import CalculatorPageShell from '@/components/CalculatorPageShell';
import TaxCalculator from '@/components/calculators/TaxCalculator';
import TaxArticle from '@/components/content/TaxArticle';
import {
  AppJsonLd,
  MethodologyGrid,
  ProvenanceFooter,
  ScenarioPanel,
  SectionShell,
  WorkflowChain,
} from '@/components/professional';
import ComparisonChart from '@/components/ComparisonChart';
import { calculators, siteConfig } from '@/lib/site';
import {
  compareEntities,
  computeCCorp,
  computeLlc,
  excludedAdditionalMedicare,
  excludedNiit,
  findCrossoverPayout,
  findCrossoverProfit,
  payoutThresholdShape,
} from '@/lib/llccorp';
import { pct, usd, usdCompact } from '@/lib/format';

const calc = calculators.find((c) => c.slug === 'llc-vs-ccorp-tax-calculator')!;

/* Profit ladder spanning the realistic solo/small-business range — wide enough
   to expose the structural crossover between pass-through and double taxation. */
const PROFIT_LADDER = [50_000, 100_000, 200_000, 400_000, 800_000];

/* Ladder extremes — computed once so the scenario footnote quotes no typed
   number (the "Computed · reproducible" badge on that panel must hold). */
const LADDER_FULL_PAYOUT = PROFIT_LADDER.map((p) => compareEntities(p, 1));
const LADDER_LLC_EFF = `${pct(Math.min(...LADDER_FULL_PAYOUT.map((r) => r.llc.effectiveRate)))} to ${pct(
  Math.max(...LADDER_FULL_PAYOUT.map((r) => r.llc.effectiveRate)),
)}`;
const LADDER_CC_EFF = `${pct(Math.min(...LADDER_FULL_PAYOUT.map((r) => r.ccorp.effectiveRate)))} to ${pct(
  Math.max(...LADDER_FULL_PAYOUT.map((r) => r.ccorp.effectiveRate)),
)}`;
/** 21% + 20% × 79% — the fully-distributed C-Corp asymptote (a derivation,
 *  computed here so even this number is not typed as a string). */
const CCORP_FULL_PAYOUT_ASYMPTOTE = pct((0.21 + 0.2 * 0.79) * 100);

/* Chart 1 — after-tax income under both structures at 100% payout, $50k → $1M.
   LLC wears emerald here and everywhere else on this page (bars, cards, banner);
   amber is the C-Corp identity across the whole instrument. */
const CHART1_PROFITS = Array.from({ length: 39 }, (_, i) => 50_000 + i * 25_000);
const CHART1_SERIES = [
  {
    label: 'LLC — after-tax income',
    color: '#10b981',
    points: CHART1_PROFITS.map((p) => ({ x: p, y: compareEntities(p, 1).llc.afterTax })),
  },
  {
    label: 'C-Corp — after-tax income (100% dividends)',
    color: '#f59e0b',
    points: CHART1_PROFITS.map((p) => ({ x: p, y: compareEntities(p, 1).ccorp.afterTax })),
  },
];

/* Chart 2 — effective federal rate, $25k → $2M. The dashed retention line
   (0% payout) is flat 21% and crosses under the LLC's progressive curve at the
   computed crossover profit. */
const CHART2_PROFITS = Array.from({ length: 80 }, (_, i) => 25_000 + i * 25_000);
const CROSSOVER_RETAIN_ALL = findCrossoverProfit(0) ?? 0;
const CHART2_SERIES = [
  {
    label: 'LLC — effective rate',
    color: '#10b981',
    points: CHART2_PROFITS.map((p) => ({ x: p, y: computeLlc(p).effectiveRate })),
  },
  {
    label: 'C-Corp — 100% distributed',
    color: '#f59e0b',
    points: CHART2_PROFITS.map((p) => ({ x: p, y: computeCCorp(p, 1).effectiveRate })),
  },
  {
    label: 'C-Corp — 0% distributed (retained)',
    color: '#f59e0b',
    dashed: true,
    points: CHART2_PROFITS.map((p) => ({ x: p, y: computeCCorp(p, 0).effectiveRate })),
  },
];

/* Chart 3 — the payout lever at $2M profit: how much of the after-tax 79% is
   distributed before the LLC wins back the race. */
const SWEEP_PROFIT = 2_000_000;
const PAYOUT_AXIS = Array.from({ length: 21 }, (_, i) => i * 5);
const PAYOUT_TIE_PCT = Math.round((findCrossoverPayout(SWEEP_PROFIT) ?? 0) * 100);
/* Computed shape of the threshold curve — the chart footnote's claims come
   from this scan, never from a typed number. */
const SHAPE = payoutThresholdShape();
const CHART3_SERIES = [
  {
    label: 'LLC — effective rate (payout-independent)',
    color: '#10b981',
    points: PAYOUT_AXIS.map((x) => ({ x, y: computeLlc(SWEEP_PROFIT).effectiveRate })),
  },
  {
    label: 'C-Corp — effective rate',
    color: '#f59e0b',
    points: PAYOUT_AXIS.map((x) => ({ x, y: computeCCorp(SWEEP_PROFIT, x / 100).effectiveRate })),
  },
];

export const metadata: Metadata = {
  title: 'LLC vs C-Corp Tax Calculator (2025) — Compare Federal Taxes',
  description:
    'Compare business tax liabilities between LLC and C-Corp entity structures. Calculate self-employment, corporate, and dividend taxes accurately.',
  keywords: [
    'llc vs c corp calculator',
    'llc vs c corp tax',
    'c corporation tax',
    'self employment tax',
    'qbi deduction',
    'double taxation',
    'business entity tax',
    'pass through taxation',
    'dividend payout ratio',
  ],
  alternates: { canonical: calc.href },
  openGraph: {
    title: 'LLC vs C-Corp Tax Calculator (2025) — Compare Federal Taxes',
    description:
      'See how much federal tax you would pay as an LLC vs a C-Corp at any profit level. Includes QBI deduction, SE tax, corporate tax, and dividend tax.',
    url: `${siteConfig.url}${calc.href}`,
    type: 'website',
  },
};

function LadderRow({ profit, payout }: { profit: number; payout: number }) {
  const r = compareEntities(profit, payout);
  return (
    <tr>
      <th scope="row" className="readout font-semibold normal-case tracking-normal text-slate-900 dark:text-slate-100">
        {usd(profit, 0)}
      </th>
      <td className="text-right">
        <span className="readout block whitespace-nowrap font-medium text-slate-800 dark:text-slate-200">{usd(r.llc.totalTax)}</span>
        <span className="readout block text-xs text-slate-500 dark:text-slate-400">{pct(r.llc.effectiveRate)}</span>
      </td>
      <td className="text-right">
        <span className="readout block whitespace-nowrap font-medium text-slate-800 dark:text-slate-200">{usd(r.ccorp.totalTax)}</span>
        <span className="readout block text-xs text-slate-500 dark:text-slate-400">{pct(r.ccorp.effectiveRate)}</span>
      </td>
      <td className="text-right">
        {r.winner === 'tie' ? (
          <span className="chip bg-slate-100 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:bg-white/[0.06] dark:text-slate-400">
            Even
          </span>
        ) : (
          <span
            className={`chip text-[11px] font-semibold uppercase tracking-wider ${
              r.winner === 'llc'
                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300'
                : 'bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300'
            }`}
          >
            {r.winner === 'llc' ? 'LLC' : 'C-Corp'} · saves {usd(r.delta, 0)}
          </span>
        )}
      </td>
    </tr>
  );
}

export default function LlcVsCcorpPage() {
  return (
    <>
      <AppJsonLd calc={calc} />
      <CalculatorPageShell calc={calc}>
        {/* Interactive tool */}
        <section id="calculator" aria-label="LLC vs C-Corp tax calculator tool" className="scroll-mt-28">
          <TaxCalculator />
        </section>

        {/* Methodology */}
        <div className="border-t border-slate-200 pt-12 dark:border-white/[0.07]">
          <SectionShell
            id="methodology"
            eyebrow="Methodology"
            title="Two structures, one dollar of profit"
            accent={calc.accent}
            intro="The comparison models both extremes on purpose: every dollar leaves an LLC through self-employment tax plus your personal brackets, and through 21% corporate tax plus dividend tax in a C-Corp. A second lever — the dividend payout share — moves the C-Corp between its double-taxed and retained extremes, which is where its only winning ground lives."
          >
            <MethodologyGrid
              formulas={[
                {
                  label: 'LLC — pass-through stack',
                  expression: 'SE 15.3% × 92.35% of profit (SS base ≤ $176,100), 2.9% above · income brackets − QBI 20%',
                  note: 'Per Schedule SE the tax applies to 92.35% of net earnings; half of SE tax is deductible against income; the 20% qualified business income deduction applies to what remains (capped at 20% of taxable income); the standard deduction ($15,750 single) reduces taxable income.',
                },
                {
                  label: 'C-Corp — double taxation',
                  expression: 'corporate 21% → after-tax profit → LTCG 15–20% on dividends',
                  note: 'The entity pays a flat 21% on all profit; distributed shares are then taxed again at qualified-dividend rates on their own bracket schedule.',
                },
                {
                  label: 'C-Corp — payout lever',
                  expression: 'dividends = payout × 79% × profit · remainder retained (deferred)',
                  note: 'The payout share (0–100%) is the widget’s second input. Distributed dollars pay the LTCG schedule on top of the 21% corporate layer; retained dollars pay no shareholder-level tax this year — their tax is deferred to the year of distribution.',
                },
                {
                  label: 'Comparison basis',
                  expression: 'cheaper = min(total tax LLC , total tax C-Corp)',
                  note: 'Both structures absorb the same pre-tax profit, so the absolute delta is the saving from choosing correctly before any other factor.',
                },
                {
                  label: 'Effective-rate check',
                  expression: 'effective % = total tax ÷ profit',
                  note: 'The single number to quote when the two stacks must be compared across profit levels — it exposes where each structure scales worse.',
                },
              ]}
              assumptions={[
                'Single owner — full draws under an LLC; in the C-Corp case an adjustable share (0–100%) of after-tax profit is distributed as qualified dividends, default 100%.',
                'Tax-year 2025 US federal parameters only: seven ordinary brackets ($11,925–$626,350 single), $15,750 single standard deduction (Rev. Proc. 2024-40 set $15,000; the One Big Beautiful Bill Act raised it for 2025), $176,100 Social Security wage base, 21% corporate rate.',
                'No W-2 salary inside the C-Corp. Real owners blend deductible salary with dividends — model that mix in the S-Corp Salary Calculator; the guide below works the other lever, the payout ratio.',
                'State income/franchise taxes, the 3.8% net investment income surtax, the 0.9% Additional Medicare Tax on SE income above the $200,000 single-filer threshold (≈$216,568 of profit), and payroll-related employer burdens are outside the model.',
                'Qualified dividends are taxed through the 2025 single-filer long-term capital gains brackets without applying the standard deduction; retained earnings carry no current shareholder-level tax (deferral).',
              ]}
            />
          </SectionShell>
        </div>

        {/* Scenario analysis */}
        <SectionShell
          id="scenarios"
          eyebrow="Scenario analysis"
          title="Where each structure wins — and what flips it"
          accent={calc.accent}
          intro="Computed here by the same functions behind the widget above, across a five-point profit ladder at both payout extremes. Distribute everything and pass-through wins every rung. Retain everything and the flat 21% undercuts the LLC's progressive stack above a computable crossover — the model says both parts out loud."
        >
          <ScenarioPanel
            title="Total federal tax — distribute everything (100% payout)"
            description="Total tax burden first line (LLC / C-Corp), effective rate second. The winning structure per rung is flagged with its absolute saving."
            columns={['Annual profit', 'LLC — pass-through', 'C-Corp — double tax', 'Cheaper structure']}
            footnote={`Pass-through wins every rung shown here, and keeps winning at every profit level once the payout share reaches the tie threshold for that level — ${pct(SHAPE.above500kMin * 100)} to ${pct(SHAPE.localPeak.payout * 100)} of after-tax profit above $500k; the low-profit region swings further, as the third chart and the guide's crossover section trace. Across the ladder the LLC's effective rate runs ${LADDER_LLC_EFF} while the fully-distributed C-Corp path climbs ${LADDER_CC_EFF}, heading toward the ${CCORP_FULL_PAYOUT_ASYMPTOTE} asymptote it cannot escape (21% + 20% × 79%). The size of the gap, not the winner, is the real story.`}
          >
            <tbody className="divide-y divide-slate-100 dark:divide-white/[0.06]">
              {PROFIT_LADDER.map((profit) => (
                <LadderRow key={profit} profit={profit} payout={1} />
              ))}
            </tbody>
          </ScenarioPanel>

          <div className="mt-6">
            <ComparisonChart
              series={CHART1_SERIES}
              xLabel="Net business profit"
              yLabel="After-tax income / yr"
              xFormat={(n) => usdCompact(n)}
              yFormat={(n) => usdCompact(n)}
              height={300}
              marker={{ x: 200000, label: '$200k example' }}
              caption="Both curves come from the full model at build time. The gap between the lines is the price of double taxation when every dollar is distributed — it widens with profit, which is exactly why the C-Corp case rests on the retention lever charted next."
            />
          </div>

          <div className="mt-6">
            <ScenarioPanel
              title="Total federal tax — retain everything (0% payout)"
              description="The C-Corp pays its single 21% layer and retains the rest inside the entity; the LLC still pays the full pass-through stack."
              columns={['Annual profit', 'LLC — pass-through', 'C-Corp — retained (21% flat)', 'Cheaper structure']}
              footnote={`Retention flips the answer above a computable crossover: below ${usd(CROSSOVER_RETAIN_ALL, 0)} of profit the LLC stack is still cheaper than a flat 21%; above it the single corporate layer undercuts the progressive pass-through — by ${usd(compareEntities(800_000, 0).delta, 0)} a year at $800k. The catch is timing: retained dollars face the LTCG toll whenever they are eventually distributed, so this is a deferral comparison, not a free lunch.`}
            >
              <tbody className="divide-y divide-slate-100 dark:divide-white/[0.06]">
                {PROFIT_LADDER.map((profit) => (
                  <LadderRow key={profit} profit={profit} payout={0} />
                ))}
              </tbody>
            </ScenarioPanel>
          </div>

          <div className="mt-6 grid gap-6">
            <ComparisonChart
              series={CHART2_SERIES}
              xLabel="Net business profit"
              yLabel="Effective federal rate"
              xFormat={(n) => usdCompact(n)}
              yFormat={(n) => `${Math.round(n)}%`}
              height={300}
              marker={{ x: CROSSOVER_RETAIN_ALL, label: `LLC = 21% · ${usdCompact(CROSSOVER_RETAIN_ALL)}` }}
              caption="Effective federal rate from the full model at build time. The dashed line is the retention extreme: a C-Corp that distributes nothing pays exactly 21%. It dips under the LLC's progressive curve at the crossover marker — the only region where the C-Corp wins on current-year federal tax in this model without mixing in salary."
            />
            <ComparisonChart
              series={CHART3_SERIES}
              xLabel="Dividends paid out (% of after-tax profit)"
              yLabel="Effective federal rate"
              xFormat={(n) => `${n}%`}
              yFormat={(n) => `${Math.round(n)}%`}
              height={300}
              marker={{ x: PAYOUT_TIE_PCT, label: `tie · distribute ≈${PAYOUT_TIE_PCT}%` }}
              caption={`At $${usdCompact(SWEEP_PROFIT)} of profit the dividend decision alone flips the winner: distributing less than about ${PAYOUT_TIE_PCT}% of after-tax profit keeps the C-Corp under the LLC's ${pct(computeLlc(SWEEP_PROFIT).effectiveRate)} effective rate. The threshold itself is not monotone across the profit range: it peaks at ${pct(SHAPE.peak.payout * 100, 1)} just below ${usd(SHAPE.seCapKinkProfit, 0)} — the profit at which Social Security tax caps out — falls to ${pct(SHAPE.trough.payout * 100, 1)} near ${usd(SHAPE.trough.profit, 0)}, recovers to a local peak of ${pct(SHAPE.localPeak.payout * 100, 1)} near ${usd(SHAPE.localPeak.profit, 0)}, then eases down to ${pct((SHAPE.at20M ?? 0) * 100, 0)} by $20M.`}
            />
          </div>
        </SectionShell>

        {/* Deep-dive guide */}
        <div className="border-t border-slate-200 pt-12 dark:border-white/[0.07]">
          <section id="guide" aria-label="LLC vs C-Corp tax guide" className="scroll-mt-28">
            <TaxArticle />
          </section>
        </div>

        <WorkflowChain currentSlug={calc.slug} />

        <ProvenanceFooter
          sources={[
            {
              label: 'Federal parameters (2025)',
              detail:
                'Rev. Proc. 2024-40 tax-year 2025 amounts: ordinary brackets 10–37% spanning $11,925–$626,350 (single), 0/15/20% LTCG breakpoints at $48,350 and $533,400, §199A threshold $197,300 single / $394,600 MFJ; Social Security wage base $176,100 per the SSA 2025 COLA fact sheet.',
            },
            {
              label: '2025 standard deduction',
              detail:
                '$15,750 single. Rev. Proc. 2024-40 originally set $15,000 for 2025; the One Big Beautiful Bill Act (P.L. 119-21, enacted July 4, 2025) raised it, formalized in Rev. Proc. 2025-32. This instrument runs its own corrected constant set — its earlier revision cited $14,600, the 2024 amount.',
            },
            {
              label: 'Statutory anchors',
              detail:
                'Corporate rate from IRC §11 (21%); QBI pass-through deduction from IRC §199A (20%, phase-out not modeled — disclosed); self-employment tax from IRC §1401 (15.3% with the wage-base split modeled as Schedule SE applies it); retained earnings carry no shareholder-level tax until distributed.',
            },
            {
              label: 'What would change the answer',
              detail: `State-level income or franchise taxes, a blended W-2 salary/dividend mix (modeled in the S-Corp Salary Calculator), QBI wage-limitation phase-outs, and the timing value of deferring tax on retained earnings are intentionally outside this simplified model — as are two surtaxes that run in opposite directions: the 3.8% NIIT on the C-Corp's dividends (excluded, so the C-Corp looks about ${usd(excludedNiit(1_000_000, 1), 0)} cheaper at $1M with full payout) and the 0.9% Additional Medicare Tax on SE income above the $200,000 threshold (excluded, understating the LLC by about ${usd(excludedAdditionalMedicare(1_000_000), 0)} at $1M).`,
            },
          ]}
          disclaimer="This comparison is an educational model of federal structure differences at the payout extremes, not tax advice. Entity selection interacts with ownership plans, exit strategy, and state law — take real numbers to a CPA before incorporating."
        />
      </CalculatorPageShell>
    </>
  );
}

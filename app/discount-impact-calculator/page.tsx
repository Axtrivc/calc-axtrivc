import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import CalculatorPageShell from '@/components/CalculatorPageShell';
import DiscountCalculator from '@/components/calculators/DiscountCalculator';
import DiscountArticle from '@/components/content/DiscountArticle';
import ComparisonChart from '@/components/ComparisonChart';
import {
  AppJsonLd,
  MethodologyGrid,
  ProvenanceFooter,
  ScenarioPanel,
  SectionShell,
} from '@/components/professional';
import { calculators, siteConfig, type Calculator } from '@/lib/site';
import {
  DISCOUNT_PRESETS,
  computeDiscount,
  upliftCurve,
  marginTierMatrix,
} from '@/lib/discount';
import { numFmt, pct } from '@/lib/format';

/**
 * Registration note: this instrument hardcodes its own metadata object because
 * lib/site.ts is wired by the suite-integration step. Stage 1 of the workflow
 * ("Price") — the margin consequences of cutting the price you just set.
 */
const calc: Calculator = {
  slug: 'discount-impact-calculator',
  href: '/discount-impact-calculator/',
  title: 'Discount Impact Calculator',
  shortTitle: 'Discount Impact',
  tagline: 'How much extra volume must a discount buy before it stops costing you money?',
  description:
    'Compute the volume increase a discount needs to hold profit flat — the famous 1/(1−d) table plus the margin-stratified truth, profit change at any volume response, and coupon vs straight-discount equivalence. Free, client-side.',
  icon: 'TrendingUp',
  category: 'Startups',
  tags: [
    'discount impact calculator',
    'discount effect on profit',
    'price discount volume increase',
    'margin erosion calculator',
    'coupon vs discount',
    'promotion roi calculator',
    'pricing calculator',
    'gross margin',
    'sales discount analysis',
  ],
  accent: 'amber',
  stage: 1,
  stageLabel: 'Price',
  dataBasis:
    'Classical price-volume trade-off algebra (Marn & Rosiello, HBR 1992) — every formula documented on-page',
  formulaSnapshot: 'uplift = d ÷ (gm − d)',
};

/* Build-time scenario rows: the three business archetypes from the tool, plus
   two stress cases — a deepened cut, and a discount beyond the entire margin
   (the state where no volume can rescue the promotion). */
type ScenarioRow = { label: string; description: string; presetIndex: number; discountPct: number };
const STRESS_ROWS: ScenarioRow[] = [
  {
    label: 'Service — rate cut deepened to 25%',
    description: 'Everything held except the discount: 10 → 25',
    presetIndex: 2,
    discountPct: 25,
  },
  {
    label: 'Product — 60% off (beyond the margin)',
    description: 'A clearance fantasy: the cut exceeds the 53.9% gross margin itself',
    presetIndex: 1,
    discountPct: 60,
  },
];
const SCENARIO_ROWS: ScenarioRow[] = [
  ...DISCOUNT_PRESETS.map((p, i) => ({
    label: p.label,
    description: p.description,
    presetIndex: i,
    discountPct: p.inputs.discountPct,
  })),
  ...STRESS_ROWS,
];

/* Chart series: the required-uplift hyperbola u(d) = d ÷ (gm − d), one line
   per gross-margin tier. Points past the +300% reading are truncated so the
   y-axis stays legible; each line simply ends before its asymptote at d = gm. */
const TIER_COLORS = ['#10b981', '#0ea5e9', '#6366f1', '#f59e0b', '#f43f5e'];
const TIER_MARGINS = [70, 60, 50, 40, 30];
const CURVE_CAP_PCT = 300;
const CHART_SERIES = TIER_MARGINS.map((gm, i) => ({
  label: `${gm}% gross margin`,
  color: TIER_COLORS[i],
  points: upliftCurve(gm, 2.5, 45, 35)
    .filter((p) => p.upliftPct !== null && p.upliftPct <= CURVE_CAP_PCT)
    .map((p) => ({ x: p.discountPct, y: p.upliftPct as number })),
}));

/* Footnote support: the classic single-cell comparisons. */
const TIERS = marginTierMatrix([70, 60, 50, 40, 30, 20], [5, 10, 15, 20, 25, 30]);
const CELL_40_20 = TIERS.find((r) => r.gmPct === 40)?.uplifts[3] ?? null;
const CELL_50_20 = TIERS.find((r) => r.gmPct === 50)?.uplifts[3] ?? null;
const PRODUCT_EX = computeDiscount(DISCOUNT_PRESETS[1].inputs);
const FLOOR_20 = PRODUCT_EX.revenueNeutralUpliftPct;

/**
 * Self-contained workflow chain for this page. Until the suite-integration
 * step registers this slug in lib/site.ts, the shared WorkflowChain cannot
 * highlight "You are here" (it maps over the registry). This rendition marks
 * the current instrument explicitly and pulls one representative per
 * workflow stage from the registry for the rest — correct today, and still
 * correct after registration.
 */
const STAGE_REPS = [2, 3, 4, 5]
  .map((stage) => calculators.find((c) => c.stage === stage))
  .filter((c): c is Calculator => Boolean(c));

function SisterInstruments({ current }: { current: Calculator }) {
  return (
    <section id="workflow" aria-labelledby="workflow-title" className="scroll-mt-28">
      <header className="mb-7 max-w-3xl">
        <p className="font-mono mb-3 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
          <span className="inline-block h-3 w-0.5 rounded-full bg-current" aria-hidden="true" />
          The CalcSuite workflow
        </p>
        <h2 id="workflow-title" className="section-title">
          One business question per stage
        </h2>
        <p className="mt-3 leading-relaxed text-slate-600 dark:text-slate-300">
          This instrument answers the pricing question — stage 1 of the workflow. When you&apos;re
          done here, the next decision has a workspace waiting for it.
        </p>
      </header>

      <ol className="grid gap-3 md:grid-cols-3 lg:grid-cols-5">
        <li>
          <div
            aria-current="step"
            className="relative flex h-full flex-col rounded-2xl border border-indigo-300 bg-white p-4 shadow-md ring-2 ring-indigo-500/20 dark:border-indigo-500/40 dark:bg-slate-900/70 dark:ring-indigo-500/30"
          >
            <div className="flex items-center justify-between">
              <span className="readout text-[11px] font-bold tracking-widest text-slate-500 dark:text-slate-400">
                STAGE {String(current.stage).padStart(2, '0')}
              </span>
              <span className="chip bg-indigo-600 text-[10px] font-semibold uppercase tracking-wider text-white">
                You are here
              </span>
            </div>
            <h3 className="mt-2 text-sm font-bold text-slate-900 dark:text-slate-100">
              {current.shortTitle ?? current.title}
            </h3>
            <p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
              {current.tagline}
            </p>
            <p className="mt-auto pt-3 font-mono text-[11px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-300">
              {current.stageLabel}
            </p>
          </div>
        </li>
        {STAGE_REPS.map((c) => (
          <li key={c.slug}>
            <Link
              href={c.href}
              className="focus-calm group flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-4 transition duration-200 hover:-translate-y-0.5 hover:border-indigo-200 hover:shadow-md dark:border-white/[0.08] dark:bg-slate-900/60 dark:hover:border-indigo-500/30 dark:hover:shadow-black/40"
            >
              <span className="readout text-[11px] font-bold tracking-widest text-slate-500 dark:text-slate-400">
                STAGE {String(c.stage).padStart(2, '0')}
              </span>
              <h3 className="mt-2 text-sm font-bold text-slate-700 transition group-hover:text-indigo-700 dark:text-slate-300 dark:group-hover:text-indigo-300">
                {c.shortTitle ?? c.title}
              </h3>
              <p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                {c.tagline}
              </p>
              <span className="mt-auto flex items-center gap-1 pt-3 text-xs font-semibold text-slate-500 transition group-hover:text-indigo-600 dark:text-slate-400 dark:group-hover:text-indigo-300">
                Open instrument
                <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" aria-hidden="true" />
              </span>
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}

export const metadata: Metadata = {
  title: 'Discount Impact Calculator — The Volume a Price Cut Must Buy',
  description:
    'How much extra volume does a discount need before it stops costing money? The famous 1/(1−d)−1 table (20% off → +25%), the margin-stratified truth d/(gm−d), profit at any volume response, and coupon-vs-discount equivalence.',
  keywords: [
    'discount impact calculator',
    'discount effect on profit calculator',
    'how much volume to make up for discount',
    'price discount analysis',
    'margin erosion',
    'coupon vs percentage discount',
    'promotion profitability',
    'sale pricing calculator',
    'gross margin discount',
  ],
  alternates: { canonical: calc.href },
  openGraph: {
    title: 'Discount Impact Calculator — The Volume a Price Cut Must Buy',
    description:
      '20% off needs +25% volume to hold revenue — and more to hold profit. Compute the true requirement at your own gross margin, score any volume response, and compare coupons against blanket discounts.',
    url: `${siteConfig.url}${calc.href}`,
    type: 'website',
  },
};

export default function DiscountImpactCalculatorPage() {
  return (
    <>
      <AppJsonLd calc={calc} />
      <CalculatorPageShell calc={calc}>
        {/* Interactive tool */}
        <section id="calculator" aria-label="Discount impact calculator tool" className="scroll-mt-28">
          <DiscountCalculator />
        </section>

        {/* Methodology */}
        <div className="border-t border-slate-200 pt-12 dark:border-white/[0.07]">
          <SectionShell
            id="methodology"
            eyebrow="Methodology"
            title="The model, stated exactly"
            accent={calc.accent}
            intro="Two one-line derivations govern everything: one on revenue (the number everyone quotes) and one on margin (the number that decides). Between them sits the coupon algebra, which is the same idea with a threshold bolted on. No year-specific parameter enters any of it."
          >
            <MethodologyGrid
              formulas={[
                {
                  label: 'Revenue-neutral uplift',
                  expression: 'u = 1 ÷ (1 − d) − 1 = d ÷ (1 − d)',
                  note: 'Holds revenue flat: Q₂·P(1 − d) = Q·P. The famous table — 20% off → +25%, 25% off → +33.3%. Preserves profit only when unit cost is zero; reported as the floor, never the answer.',
                },
                {
                  label: 'Profit-neutral uplift',
                  expression: 'u = d ÷ (gm − d),  gm = (P − C) ÷ P',
                  note: 'Holds gross profit flat. The discounted unit margin is P(gm − d) — the cut comes out of margin, not out of cost. The classic Marn–Rosiello price-cut/volume table; always ≥ the revenue floor, undefined (null) at d ≥ gm.',
                },
                {
                  label: 'Break-even volume',
                  expression: 'Q* = Q × gm ÷ (gm − d)',
                  note: 'Q × (1 + d/(gm − d)) simplified — the unit count at which the promotion ties with the list price. Null exactly when the uplift formula is.',
                },
                {
                  label: 'Profit at a volume response',
                  expression: 'π(u) = Q(1 + u) × (P(1 − d) − C)',
                  note: 'Linear in the response u: every extra unit adds the same discounted margin. At u = d/(gm − d) this equals Q × (P − C) exactly — the definition of the profit-neutral uplift, and the identity the sensitivity chart crosses zero on.',
                },
                {
                  label: 'Unit-margin erosion',
                  expression: 'erosion = d ÷ gm',
                  note: 'The share of each unit\'s margin the discount destroys — 100% at d = gm. The margin-before/after pair in the tool is (P − C) → P(gm − d) in dollars.',
                },
                {
                  label: 'Coupon face vs effective rate',
                  expression: 'face = Y ÷ T · effective = Y ÷ B · B* = Y ÷ d',
                  note: 'A "spend T save Y" coupon equals a straight discount of Y ÷ T only at a basket of exactly T. B* = Y ÷ d is the crossover basket: among triggered baskets (B ≥ T) the coupon gives the buyer more off below B*, while the blanket d% costs the seller more above it — true even below T, where the coupon is inert and the blanket still gives d%.',
                },
                {
                  label: 'Margin-tier grid',
                  expression: 'cell(gm, d) = d ÷ (gm − d)',
                  note: 'The scenario table evaluates each cell on a $100 price basis (C = 100 − gm), so tier arithmetic is exact and can never disagree with the widget — same function, same inputs.',
                },
              ]}
              assumptions={[
                'Profit means gross profit: (price − variable unit cost) × volume. Fixed costs are identical with and without the discount, so they cancel out of every hold-flat condition on this page — the break-even instrument covers that layer.',
                'One price and one per-unit variable cost across the volume range; no tiered pricing, and the volume response enters as a single achieved percentage.',
                'The discount moves price only — unit cost, fees, and the cost structure are unchanged. Percentage-based processing fees actually shrink with price; fold a fee-inclusive cost in via the Stripe fee tool if fees are material.',
                'A discount at or beyond the full gross margin (d ≥ gm) returns null, not a number: the discounted unit margin is ≤ 0 and no volume multiplies it back into profit.',
                'Demand response is treated as achieved fact, not modeled: cannibalization of full-price buyers, competitor reaction, and reference-price damage are framed in the guide, not parameterized.',
                'No year-specific statutory parameters (IRS/SSA/inflation) enter the model — the algebra is time-invariant by construction.',
              ]}
            />
          </SectionShell>
        </div>

        {/* Scenario analysis */}
        <SectionShell
          id="scenarios"
          eyebrow="Scenario analysis"
          title="One cut, five businesses, five different bills"
          accent={calc.accent}
          intro="Computed at build time by the same functions that power the widget. Each row runs the full readout for a real business geometry — then two stress cases show what happens as the cut deepens toward, and past, the margin line."
        >
          <ScenarioPanel
            title="Required volume increase by business archetype"
            description="The three presets from the tool plus two stress cases. The floor is the famous revenue-only number; the true requirement is d ÷ (gm − d) at each row's own gross margin."
            columns={['Scenario', 'GM %', 'Discount', 'Revenue-only floor', 'True requirement', 'Margin destroyed', 'Break-even volume / mo']}
            footnote={`Pattern 1 — the floor understates by a multiple, and the multiple is the cost share: the SaaS archetype (89.9% margin) pays almost the quoted price for a promotion, while the product archetype pays ${numFmt((PRODUCT_EX.profitNeutralUpliftPct ?? 0) / FLOOR_20, 1)}× the floor. Pattern 2 — the requirement is convex in the depth: at a 40% margin, deepening a 20% cut to 25% moves the requirement from +${pct(CELL_40_20 ?? 0, 0)} to +${pct(TIERS.find((r) => r.gmPct === 40)?.uplifts[4] ?? 0, 0)}. Pattern 3 — the clearance-fantasy row has no answer at all: 60% off exceeds the product's entire 53.9% margin, so the tool reports it rather than inventing an infinity. And the single most quoted cell in pricing: at a 50% margin a 20% cut already needs +${pct(CELL_50_20 ?? 0, 0)}.`}
          >
            <tbody className="divide-y divide-slate-100 dark:divide-white/[0.06]">
              {SCENARIO_ROWS.map((row) => {
                const preset = DISCOUNT_PRESETS[row.presetIndex];
                const r = computeDiscount({ ...preset.inputs, discountPct: row.discountPct });
                const isStress = STRESS_ROWS.some((s) => s.label === row.label);
                return (
                  <tr key={row.label}>
                    <th scope="row" className="max-w-[16rem]">
                      <span className={`readout font-semibold normal-case tracking-normal ${isStress ? 'text-amber-700 dark:text-amber-300' : 'text-slate-900 dark:text-slate-100'}`}>
                        {row.label}
                      </span>
                      <span className="mt-0.5 block text-xs font-normal leading-snug text-slate-500 dark:text-slate-400">
                        {row.description}
                      </span>
                    </th>
                    <td className="text-right">
                      <span className="readout whitespace-nowrap text-slate-600 dark:text-slate-300">
                        {r.baseGrossMarginPct === null ? '—' : pct(r.baseGrossMarginPct, 1)}
                      </span>
                    </td>
                    <td className="text-right">
                      <span className="readout whitespace-nowrap font-semibold text-slate-900 dark:text-slate-100">
                        {pct(row.discountPct, 0)}
                      </span>
                    </td>
                    <td className="text-right">
                      <span className="readout whitespace-nowrap text-slate-500 dark:text-slate-400">
                        +{pct(r.revenueNeutralUpliftPct, 1)}
                      </span>
                    </td>
                    <td className="text-right">
                      <span
                        className={`readout whitespace-nowrap font-semibold ${
                          r.profitNeutralUpliftPct === null
                            ? 'text-rose-600 dark:text-rose-400'
                            : r.profitNeutralUpliftPct > 2 * r.revenueNeutralUpliftPct
                              ? 'text-amber-600 dark:text-amber-400'
                              : 'text-slate-900 dark:text-slate-100'
                        }`}
                      >
                        {r.profitNeutralUpliftPct === null ? 'no volume' : `+${pct(r.profitNeutralUpliftPct, 1)}`}
                      </span>
                    </td>
                    <td className="text-right">
                      <span className={`readout whitespace-nowrap ${r.unitMarginErosionPct !== null && r.unitMarginErosionPct >= 60 ? 'font-semibold text-rose-600 dark:text-rose-400' : 'text-slate-600 dark:text-slate-300'}`}>
                        {r.unitMarginErosionPct === null ? '—' : pct(r.unitMarginErosionPct, 1)}
                      </span>
                    </td>
                    <td className="text-right">
                      <span className="readout whitespace-nowrap font-medium text-slate-600 dark:text-slate-300">
                        {r.breakEvenVolume === null ? '—' : numFmt(r.breakEvenVolume, 0)}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </ScenarioPanel>

          <div className="mt-6">
            <ComparisonChart
              series={CHART_SERIES}
              xLabel="Discount depth"
              yLabel="Volume increase needed to hold profit"
              xFormat={(n) => `${numFmt(n, 0)}%`}
              yFormat={(n) => `+${numFmt(n, 0)}%`}
              height={320}
              marker={{ x: 20, label: '20% off' }}
              caption={`The required-uplift hyperbola u(d) = d ÷ (gm − d), one line per gross-margin tier. Each line ends before its vertical asymptote at d = gm — where the tier's entire margin is consumed and no volume can help — and the plot truncates above +${pct(CURVE_CAP_PCT, 0)} to keep the axis honest. The green 70%-margin line hugs the famous revenue-only curve (dotted in spirit: at 100% margin they coincide); the rose 30%-margin line leaves the chart before a 25% cut. Reading at the marker: a blanket 20% off costs +${pct(TIERS.find((r) => r.gmPct === 70)?.uplifts[3] ?? 0, 0)} volume at a 70% margin but +${pct(CELL_40_20 ?? 0, 0)} at 40% — the same discount, ${numFmt((CELL_40_20 ?? 0) / (TIERS.find((r) => r.gmPct === 70)?.uplifts[3] ?? 1), 1)}× the bill.`}
            />
          </div>
        </SectionShell>

        {/* Deep-dive guide */}
        <div className="border-t border-slate-200 pt-12 dark:border-white/[0.07]">
          <section id="guide" aria-label="Discount psychology and pricing guide" className="scroll-mt-28">
            <DiscountArticle />
          </section>
        </div>

        <SisterInstruments current={calc} />

        <ProvenanceFooter
          sources={[
            {
              label: 'Model basis',
              detail:
                'The price-cut/volume table of managerial pricing — Marn & Rosiello, "Managing Price, Gaining Profit", Harvard Business Review (Sept–Oct 1992) — and the standard CVP treatment in managerial-accounting texts (Garrison, Noreen & Brewer). Same algebra family as the Break-Even instrument.',
            },
            {
              label: 'Behavioral citations',
              detail:
                'The guide\'s psychology section cites published academic literature, not parameters: Kahneman & Tversky, prospect theory (Econometrica, 1979); Thaler, mental accounting (Marketing Science, 1985); Winer, reference-price models (Journal of Consumer Research, 1986).',
            },
            {
              label: 'Conventions',
              detail:
                'All inputs and outputs share one period (monthly presets with a monthly/yearly label switch); profit means gross profit over variable unit cost; discounts are stated as a percentage off list; coupons as (spend threshold, amount off, basket).',
            },
            {
              label: 'Out of scope',
              detail:
                'Fixed-cost coverage (Break-Even instrument), fee-inclusive unit costs (Stripe Fee tool), customer lifetime value and acquisition-cost modeling, cannibalization timing, and competitor response — the guide frames each but the algebra does not parameterize them.',
            },
          ]}
          disclaimer="This is an illustrative planning model, not pricing advice. The outputs are exactly as honest as the price, cost, and volume-response figures you feed it — a discount judged against an optimistic response is profitable only on paper. Nothing here prices brand damage or competitor reaction; both are real and both compound."
        />
      </CalculatorPageShell>
    </>
  );
}

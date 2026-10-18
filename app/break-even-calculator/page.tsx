import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import CalculatorPageShell from '@/components/CalculatorPageShell';
import BreakEvenCalculator from '@/components/calculators/BreakEvenCalculator';
import BreakEvenArticle from '@/components/content/BreakEvenArticle';
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
  BREAKEVEN_PRESETS,
  computeBreakEven,
  priceSweep,
  sensitivityGrid,
  type BreakEvenInputs,
} from '@/lib/breakeven';
import { usd, usdCompact, numFmt, pct } from '@/lib/format';

/**
 * Registration note: this instrument hardcodes its own metadata object because
 * lib/site.ts is wired by the suite-integration step. Stage 1 of the workflow
 * ("Price") — pricing the unit before billing, structuring, or paying yourself.
 */
const calc: Calculator = {
  slug: 'break-even-calculator',
  href: '/break-even-calculator/',
  title: 'Break-Even Calculator',
  shortTitle: 'Break-Even',
  tagline: 'At what volume does each unit start paying for the business?',
  description:
    'Compute your break-even point in units and revenue from fixed costs, price, and per-unit variable cost. Classic CVP chart, contribution margin, margin of safety, operating leverage, and price sensitivity — all client-side, free.',
  icon: 'TrendingUp',
  category: 'Startups',
  tags: [
    'break even calculator',
    'break even point',
    'cvp analysis',
    'contribution margin',
    'margin of safety',
    'unit economics',
    'fixed costs',
    'variable costs',
    'pricing',
  ],
  accent: 'indigo',
  stage: 1,
  stageLabel: 'Price',
  dataBasis: 'Classical cost-volume-profit (CVP) algebra — every formula documented on-page',
  formulaSnapshot: 'Q* = fixed costs ÷ (price − variable cost)',
};

/* Build-time scenario rows: the three business archetypes, plus two stress
   cases that expose the asymmetry of the levers. */
type ScenarioRow = { label: string; description: string; inputs: BreakEvenInputs };
const STRESS_ROWS: ScenarioRow[] = [
  {
    label: 'SaaS — price cut 20%',
    description: 'Everything held except price: 79 → 63.2',
    inputs: { ...BREAKEVEN_PRESETS[0].inputs, price: 79 * 0.8 },
  },
  {
    label: 'Product — COGS +20%',
    description: 'Variable cost 41 → 49.2 (freight & materials spike)',
    inputs: { ...BREAKEVEN_PRESETS[1].inputs, unitVariableCost: 41 * 1.2 },
  },
];
const SCENARIO_ROWS: ScenarioRow[] = [
  ...BREAKEVEN_PRESETS.map((p) => ({
    label: p.label,
    description: p.description,
    inputs: p.inputs,
  })),
  ...STRESS_ROWS,
];

/* Chart series: the break-even-vs-price curve at the SaaS baseline. */
const SAAS = BREAKEVEN_PRESETS[0].inputs;
const SWEEP_POINTS = priceSweep(SAAS.fixedCosts, SAAS.price, SAAS.unitVariableCost)
  .filter((s) => s.breakEvenUnits !== null && Number.isFinite(s.breakEvenUnits))
  .map((s) => ({ x: s.price, y: s.breakEvenUnits as number }));

/* Sensitivity row for the footnote: how far a 10% price cut moves break-even. */
const SAAS_SENSITIVITY = sensitivityGrid(SAAS);
const saasBe = computeBreakEven(SAAS).breakEvenUnits ?? 0;

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
        <p className="font-mono mb-3 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">
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
              <span className="readout text-[11px] font-bold tracking-widest text-slate-300 dark:text-slate-500">
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
              className="focus-calm group flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-4 transition hover:-translate-y-0.5 hover:border-indigo-200 hover:shadow-md dark:border-white/[0.08] dark:bg-slate-900/60 dark:hover:border-indigo-500/30 dark:hover:shadow-black/40"
            >
              <span className="readout text-[11px] font-bold tracking-widest text-slate-300 dark:text-slate-500">
                STAGE {String(c.stage).padStart(2, '0')}
              </span>
              <h3 className="mt-2 text-sm font-bold text-slate-700 transition group-hover:text-indigo-700 dark:text-slate-300 dark:group-hover:text-indigo-300">
                {c.shortTitle ?? c.title}
              </h3>
              <p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                {c.tagline}
              </p>
              <span className="mt-auto flex items-center gap-1 pt-3 text-xs font-semibold text-slate-400 transition group-hover:text-indigo-600 dark:text-slate-500 dark:group-hover:text-indigo-300">
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
  title: 'Break-Even Calculator (CVP Analysis) — Units, Revenue & Margin of Safety',
  description:
    'Find your break-even point in units and revenue from fixed costs, price, and per-unit variable cost. Classic CVP chart with loss and profit regions, contribution margin ratio, margin of safety, operating leverage, and a price-sensitivity curve.',
  keywords: [
    'break even calculator',
    'break even point calculator',
    'cvp analysis',
    'cost volume profit',
    'contribution margin calculator',
    'margin of safety',
    'unit economics',
    'break even units',
    'break even revenue',
    'fixed and variable costs',
  ],
  alternates: { canonical: calc.href },
  openGraph: {
    title: 'Break-Even Calculator (CVP Analysis) — Units, Revenue & Margin of Safety',
    description:
      'The volume where profit starts: break-even units and revenue, contribution margin, margin of safety, and the price-sensitivity curve — with the full CVP methodology documented.',
    url: `${siteConfig.url}${calc.href}`,
    type: 'website',
  },
};

export default function BreakEvenCalculatorPage() {
  return (
    <>
      <AppJsonLd calc={calc} />
      <CalculatorPageShell calc={calc}>
        {/* Interactive tool */}
        <section id="calculator" aria-label="Break-even calculator tool" className="scroll-mt-28">
          <BreakEvenCalculator />
        </section>

        {/* Methodology */}
        <div className="border-t border-slate-200 pt-12 dark:border-white/[0.07]">
          <SectionShell
            id="methodology"
            eyebrow="Methodology"
            title="The model, stated exactly"
            accent={calc.accent}
            intro="Cost-volume-profit analysis with every card on the table: two cost families, two straight lines, one intersection. No year-specific parameter enters this algebra — the model is as valid for a 1975 factory as for a 2025 SaaS."
          >
            <MethodologyGrid
              formulas={[
                {
                  label: 'Break-even volume',
                  expression: 'Q* = F ÷ (P − V)',
                  note: 'Fixed costs per period divided by contribution margin per unit. Undefined (null) when price ≤ variable cost: every sale then adds loss, and volume cannot rescue the model.',
                },
                {
                  label: 'Break-even revenue',
                  expression: 'R* = F ÷ ((P − V) ÷ P) = Q* × P',
                  note: 'Fixed costs divided by the contribution-margin ratio. Two businesses with identical fixed costs need very different revenue when their margin ratios differ.',
                },
                {
                  label: 'Contribution margin',
                  expression: 'CM = P − V · CM% = (P − V) ÷ P',
                  note: 'What each sale contributes toward the fixed hole, in dollars and as a share of price. The single most quoted unit-economics number for good reason.',
                },
                {
                  label: 'CVP profit equation',
                  expression: 'π(Q) = Q × (P − V) − F',
                  note: 'Operating profit at any volume — the line the two wedges in the chart are made of. Accrual profit, before tax and financing.',
                },
                {
                  label: 'Margin of safety',
                  expression: 'MoS% = (Q − Q*) ÷ Q × 100',
                  note: 'How far volume can fall from its current level before profit hits zero. Undefined at zero volume; negative below break-even (a finding, not an error).',
                },
                {
                  label: 'Operating leverage',
                  expression: 'DOL = Q(P−V) ÷ π(Q) = 1 ÷ MoS',
                  note: 'Percent change in profit per 1% change in volume. Exactly the inverse of margin of safety — reported only when profit is positive.',
                },
                {
                  label: 'Price-rise tolerance',
                  expression: 'e* = 1 − (P−V) ÷ (P(1+r) − V)',
                  note: 'The volume share a price rise can lose while leaving profit unchanged — the decision boundary between raising price and cutting cost, derived in the guide.',
                },
                {
                  label: 'Price sweep',
                  expression: 'Q*(p) = F ÷ (p − V)',
                  note: 'Break-even re-solved as price scans a band — a hyperbola with the vertical asymptote at p = V. Price moves near the variable-cost floor move break-even violently.',
                },
              ]}
              assumptions={[
                'Revenue and variable cost are linear in volume; one price applies across the scanned range (no volume discounts or tiered pricing).',
                'Fixed costs are fixed across the relevant range — step costs (the next hire, the bigger warehouse) are modeled by re-running at each plateau, not averaged away.',
                'All inputs and outputs share one period; the tool defaults to monthly presets and carries a monthly/yearly switch so every label matches the figures entered.',
                'Single product, or a blended average unit for multi-product businesses (weighted-average treatment derived in the guide).',
                'Break-even means accrual operating profit = 0. Cash-out date is a separate question, measured by the SaaS Runway instrument.',
                'No year-specific tax, wage-base, or inflation parameter enters the model — CVP algebra is time-invariant by construction.',
              ]}
            />
          </SectionShell>
        </div>

        {/* Scenario analysis */}
        <SectionShell
          id="scenarios"
          eyebrow="Scenario analysis"
          title="Three archetypes, one equation"
          accent={calc.accent}
          intro="Computed at build time by the same functions that power the widget. Each row is the full CVP readout for a real business geometry — a subscription, a physical product, a service — plus two stress cases that show what the levers actually do."
        >
          <ScenarioPanel
            title="Break-even by business archetype"
            description="The three presets from the tool, plus a 20% price cut and a 20% variable-cost spike. Margin of safety and profit are evaluated at each preset's current volume."
            columns={['Scenario', 'CM / unit', 'CM %', 'BE units', 'BE revenue / mo', 'MoS @ volume', 'Profit @ volume']}
            footnote={`Pattern 1 — the contribution-margin ratio, not the fixed-cost size, dominates the geometry: the product preset carries barely half the fixed costs of the SaaS preset yet breaks even at a similar revenue level, because only ${pct(computeBreakEven(BREAKEVEN_PRESETS[1].inputs).cmRatioPct ?? 0, 0)} of each revenue dollar survives variable costs. Pattern 2 — the levers are asymmetric: a 20% price cut lifts the SaaS break-even from ${numFmt(saasBe, 0)} to ${numFmt(computeBreakEven(STRESS_ROWS[0].inputs).breakEvenUnits ?? 0, 0)} accounts, while a 20% variable-cost spike moves the product preset from ${numFmt(computeBreakEven(BREAKEVEN_PRESETS[1].inputs).breakEvenUnits ?? 0, 0)} to ${numFmt(computeBreakEven(STRESS_ROWS[1].inputs).breakEvenUnits ?? 0, 0)} units — compare those percentage moves to the 20% that caused them.`}
          >
            <tbody className="divide-y divide-slate-100 dark:divide-white/[0.06]">
              {SCENARIO_ROWS.map((row) => {
                const r = computeBreakEven(row.inputs);
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
                      <span className={`readout whitespace-nowrap font-semibold ${r.contributionMargin > 0 ? 'text-slate-700 dark:text-slate-200' : 'text-rose-600 dark:text-rose-400'}`}>
                        {usd(r.contributionMargin)}
                      </span>
                    </td>
                    <td className="text-right">
                      <span className="readout whitespace-nowrap text-slate-600 dark:text-slate-300">
                        {r.cmRatioPct === null ? '—' : pct(r.cmRatioPct, 1)}
                      </span>
                    </td>
                    <td className="text-right">
                      <span className="readout whitespace-nowrap font-semibold text-slate-900 dark:text-slate-100">
                        {r.breakEvenUnits === null ? 'never' : numFmt(r.breakEvenUnits, 1)}
                      </span>
                    </td>
                    <td className="text-right">
                      <span className="readout whitespace-nowrap text-slate-600 dark:text-slate-300">
                        {r.breakEvenRevenue === null ? '—' : usd(r.breakEvenRevenue, 0)}
                      </span>
                    </td>
                    <td className="text-right">
                      <span
                        className={`readout whitespace-nowrap font-semibold ${
                          r.marginOfSafetyPct === null
                            ? 'text-slate-400 dark:text-slate-500'
                            : r.marginOfSafetyPct >= 20
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : r.marginOfSafetyPct >= 0
                                ? 'text-amber-600 dark:text-amber-400'
                                : 'text-rose-600 dark:text-rose-400'
                        }`}
                      >
                        {r.marginOfSafetyPct === null ? '—' : pct(r.marginOfSafetyPct, 1)}
                      </span>
                    </td>
                    <td className="text-right">
                      <span
                        className={`readout whitespace-nowrap font-semibold ${
                          r.profitAtCurrent > 0.005
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : r.profitAtCurrent < -0.005
                              ? 'text-rose-600 dark:text-rose-400'
                              : 'text-slate-500 dark:text-slate-400'
                        }`}
                      >
                        {r.profitAtCurrent > 0.005 ? '+' : ''}
                        {usd(r.profitAtCurrent, 0)}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </ScenarioPanel>

          <div className="mt-6">
            <ComparisonChart
              series={[
                {
                  label: 'Break-even units as price scans −40% to +60% (SaaS preset)',
                  color: '#6366f1',
                  points: SWEEP_POINTS,
                  fillTo: 0,
                },
              ]}
              xLabel="Price per unit"
              yLabel="Break-even units / mo"
              xFormat={(n) => usd(n, 0)}
              yFormat={(n) => numFmt(n, 0)}
              height={300}
              marker={{ x: SAAS.price, label: 'preset price' }}
              caption={`The static evidence behind the interactive version: break-even re-solved at every price from ${usd(SWEEP_POINTS[0].x, 0)} to ${usdCompact(SWEEP_POINTS[SWEEP_POINTS.length - 1].x)}. The curve steepens toward the variable-cost floor (${usd(SAAS.unitVariableCost)}), where the denominator P − V collapses — the mathematics of why price wars are fatal to thin-margin businesses. A 10% price cut at the preset pushes break-even up ${pct(Math.abs(((SAAS_SENSITIVITY[0].down ?? 0) / saasBe - 1) * 100), 1)}; a 10% rise pulls it down ${pct(Math.abs(((SAAS_SENSITIVITY[0].up ?? 0) / saasBe - 1) * 100), 1)}.`}
            />
          </div>
        </SectionShell>

        {/* Deep-dive guide */}
        <div className="border-t border-slate-200 pt-12 dark:border-white/[0.07]">
          <section id="guide" aria-label="Break-even and CVP guide" className="scroll-mt-28">
            <BreakEvenArticle />
          </section>
        </div>

        <SisterInstruments current={calc} />

        <ProvenanceFooter
          sources={[
            {
              label: 'Model basis',
              detail:
                'Classical cost-volume-profit / direct-costing analysis: revenue and total cost as linear functions of volume, break-even as their intersection (NAA "Direct Costing" research, 1953; Garrison, Noreen & Brewer, Managerial Accounting).',
            },
            {
              label: 'Conventions',
              detail:
                'All inputs and outputs are stated for the same period (monthly presets); one price across the scanned range; fixed costs held constant across the relevant range; single product or a blended average unit.',
            },
            {
              label: 'Out of scope',
              detail:
                'Step fixed costs and capacity cliffs, semi-variable cost splitting (e.g. the high-low method), multi-product mix shifts, taxes, debt service, and cash timing — cash-out date belongs to the SaaS Runway instrument.',
            },
          ]}
          disclaimer="This is an illustrative planning model, not accounting or pricing advice. The outputs are exactly as honest as the fixed/variable split of your real cost structure — classify a cost into the wrong family and every number on this page moves with it. Re-run the model whenever pricing, cost structure, or capacity steps change, and validate against your actual statements."
        />
      </CalculatorPageShell>
    </>
  );
}

import type { Metadata } from 'next';
import CalculatorPageShell from '@/components/CalculatorPageShell';
import LtvCacCalculator from '@/components/calculators/LtvCacCalculator';
import LtvCacArticle from '@/components/content/LtvCacArticle';
import ComparisonChart from '@/components/ComparisonChart';
import {
  AppJsonLd,
  MethodologyGrid,
  ProvenanceFooter,
  ScenarioPanel,
  SectionShell,
  WorkflowChain,
} from '@/components/professional';
import { siteConfig, type Calculator } from '@/lib/site';
import {
  LTV_CAC_PRESETS,
  PAYBACK_HEALTHY_MONTHS,
  RATIO_HEALTHY,
  churnScan,
  computeLtvCac,
} from '@/lib/ltvcac';
import { numFmt, pct, usd, usdCompact } from '@/lib/format';

/* Tool identity — pre-integration registration stub. This instrument is
   registered in lib/site.ts by the integration pass at the end of the wave;
   until that lands, this local stub is the single identity the page renders
   from (hero, JSON-LD, metadata). It must match the catalog entry verbatim
   once integrated: stage 5 'Sustain', Startups, indigo. */
const calc: Calculator = {
  slug: 'ltv-cac-calculator',
  href: '/ltv-cac-calculator/',
  title: 'LTV:CAC Calculator',
  shortTitle: 'LTV:CAC',
  tagline: 'SaaS unit economics — what a customer is worth vs what they cost.',
  description:
    'Compute SaaS LTV on the gross-margin basis, blended CAC, the LTV:CAC ratio, and churn-adjusted CAC payback — with the churn hyperbola scan, an optional discount rate, and the 3× / 12-month health bars stated as rules of thumb.',
  icon: 'TrendingUp',
  category: 'Startups',
  tags: [
    'ltv cac calculator',
    'ltv calculator',
    'cac calculator',
    'saas unit economics',
    'customer lifetime value',
    'cac payback',
    'ltv cac ratio',
    'churn',
    'saas metrics',
    'arpu',
  ],
  accent: 'indigo',
  stage: 5,
  stageLabel: 'Sustain',
  dataBasis: 'Geometric-survival unit-economics model — SaaS metrics practice canon, no year-specific parameters',
  formulaSnapshot: 'LTV = ARPU × gross margin ÷ churn',
};

/* ItemPage + BreadcrumbList structured data — the visible breadcrumb lives in
   the shell; the embedded copy keeps this block self-describing. */
const itemJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'ItemPage',
  name: calc.title,
  description: calc.description,
  url: `${siteConfig.url}${calc.href}`,
  breadcrumb: {
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: siteConfig.url },
      {
        '@type': 'ListItem',
        position: 2,
        name: calc.title,
        item: `${siteConfig.url}${calc.href}`,
      },
    ],
  },
  mainEntity: {
    '@type': 'WebApplication',
    name: calc.title,
    url: `${siteConfig.url}${calc.href}`,
    applicationCategory: 'FinanceApplication',
    operatingSystem: 'Web (any modern browser)',
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
  },
};

/* Build-time scenario grid — the calculator's own presets, each re-solved by
   the same engine the widget runs, plus the churn-halved LTV column that
   demonstrates the hyperbola identity on every row. */
const SCENARIO_ROWS = LTV_CAC_PRESETS.map((p) => {
  const r = computeLtvCac(p.inputs);
  const halved = computeLtvCac({ ...p.inputs, churnPct: p.inputs.churnPct / 2 });
  return { preset: p, r, halved };
});

/* Chart series: the churn hyperbola for the reference preset — correct
   (gross-margin) LTV against the revenue-basis shortcut that overstates it
   by exactly 1 ÷ margin − 1. */
const REFERENCE = LTV_CAC_PRESETS[0].inputs;
const CHART_SCAN = churnScan(REFERENCE, 0.5, 10, 39);
const CHART_SERIES = [
  {
    label: 'LTV — gross-margin basis (correct)',
    color: '#6366f1',
    points: CHART_SCAN.map((p) => ({ x: p.churnPct, y: p.ltv ?? 0 })),
  },
  {
    label: 'LTV — revenue basis (the overstatement)',
    color: '#0ea5e9',
    dashed: true,
    points: CHART_SCAN.map((p) => ({ x: p.churnPct, y: (p.ltv ?? 0) / (REFERENCE.grossMarginPct / 100) })),
  },
];

export const metadata: Metadata = {
  title: 'LTV:CAC Calculator (SaaS Unit Economics) — LTV, CAC, Payback & Churn Sensitivity',
  description:
    'Compute SaaS unit economics: LTV on the gross-margin basis, blended CAC, the LTV:CAC ratio, and churn-adjusted CAC payback — plus the churn hyperbola scan, an optional discount rate, and the 3× / 12-month health bars as stated rules of thumb.',
  keywords: [
    'ltv cac calculator',
    'ltv calculator',
    'cac calculator',
    'saas unit economics',
    'customer lifetime value',
    'cac payback period',
    'ltv cac ratio',
    'churn rate',
    'saas metrics',
    'arpu',
  ],
  alternates: { canonical: calc.href },
  openGraph: {
    title: 'LTV:CAC Calculator (SaaS Unit Economics) — LTV, CAC, Payback & Churn Sensitivity',
    description:
      'Does a customer pay for themselves? Gross-margin LTV, blended CAC, the ratio, and churn-adjusted payback — with churn scanned across its full hyperbola so you can see which lever actually moves the number.',
    url: `${siteConfig.url}${calc.href}`,
    type: 'website',
  },
};

export default function LtvCacCalculatorPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(itemJsonLd) }}
      />
      <AppJsonLd calc={calc} />
      <CalculatorPageShell calc={calc}>
        {/* Interactive tool */}
        <section id="calculator" aria-label="LTV:CAC calculator tool" className="scroll-mt-28">
          <LtvCacCalculator />
        </section>

        {/* Methodology */}
        <div className="border-t border-slate-200 pt-12 dark:border-white/[0.07]">
          <SectionShell
            id="methodology"
            eyebrow="Methodology"
            title="The model, stated exactly"
            accent={calc.accent}
            intro="Four inputs, one geometric survival model, zero year-specific parameters. Every readout — ratio, both paybacks, the scan, the sensitivity strip — is derived from the statements below and nothing else."
          >
            <MethodologyGrid
              formulas={[
                {
                  label: 'LTV — gross-margin basis',
                  expression: 'LTV = ARPU × gross margin ÷ monthly churn',
                  note: 'Geometric survival: each customer sticks with probability (1−c) per month, so the expected lifetime is 1/c months and each surviving month contributes ARPU × margin of gross profit. SaaS metrics practice canon (managerial finance), not statute.',
                },
                {
                  label: 'Discounted LTV (optional)',
                  expression: 'LTV_d = ARPU × margin ÷ (churn + d),  d = (1+r)^(1/12) − 1',
                  note: 'End-of-month payment convention: the series Σ A(1−c)^(k−1)/(1+d)^k sums to A/(c+d), so the discount rate simply adds to churn. Reduces exactly to the undiscounted LTV at r = 0; at churn = 0 it degenerates to the perpetuity A/d.',
                },
                {
                  label: 'CAC — blended',
                  expression: 'CAC = S&M spend ÷ new customers won',
                  note: 'All customer-winning cost (ads, S&M salaries and commissions, agency fees, sales tools) divided by all new customers, organic included. Paid-only CAC runs higher — the guide covers the split.',
                },
                {
                  label: 'Ratio & simple payback',
                  expression: 'LTV:CAC = LTV ÷ CAC · payback = CAC ÷ (ARPU × margin)',
                  note: 'The ratio prices total value per acquisition dollar; simple payback prices cash timing and is deliberately churn-blind — the churn-aware variant below exists because customers leave mid-repayment.',
                },
                {
                  label: 'Churn-adjusted payback',
                  expression: 'A(1 − (1−c)ⁿ) ÷ c = CAC  →  n = ln(1 − CAC·c/A) ÷ ln(1−c)',
                  note: 'Solves for the month where cumulative expected gross profit first repays the CAC, with churned-before-repayment customers priced in. Always ≥ the simple payback; diverges to "never" exactly where LTV falls to CAC (the 1× cliff).',
                },
                {
                  label: 'Churn needed for a target ratio',
                  expression: 'c* = (ARPU × margin) ÷ (target × CAC)',
                  note: 'The inverted ratio — used to place the 3× crossing on the scan chart and to turn "fix retention" into a number: the churn a motion must reach for the ratio to clear the bar at its current CAC.',
                },
              ]}
              assumptions={[
                'Constant ARPU and constant churn across each customer\'s whole life — no expansion revenue, no cohort drift (NRR = 100% by construction; businesses above it are understated, conservatively).',
                'Gross margin is marginal (COGS only: hosting, support, payment fees, APIs). S&M and R&D never enter margin here — S&M lives in CAC, R&D below the line entirely.',
                'CAC is blended across paid and organic acquisition; the organic share flatters it relative to paid-only CAC (flagged in the guide).',
                'Payments land at month end for the discounted variant; the undiscounted formula is its exact r = 0 limit.',
                'The 3× ratio and 12-month payback bars are INDUSTRY RULES OF THUMB from SaaS operating practice (practitioner canon — David Skok\'s forEntrepreneurs metrics tradition — not regulation). No IRS/SSA/statutory source applies to this model, and none is cited.',
                'Churn compounds: monthly figures annualize as 1 − (1−c)¹², so 3%/mo reads 30.6%/yr, not 36%. Zero churn returns null LTV (unbounded lifetime) rather than an invented number.',
              ]}
            />
          </SectionShell>
        </div>

        {/* Scenario analysis */}
        <SectionShell
          id="scenarios"
          eyebrow="Scenario analysis"
          title="Four motions, same arithmetic"
          accent={calc.accent}
          intro="Computed at build time by the same functions that power the widget — every row is the full model, and the last column re-solves each motion at half its churn to show the hyperbola identity on real profiles."
        >
          <ScenarioPanel
            title="Unit economics by acquisition motion"
            description="Green clears the 3× rule of thumb, amber sits between 1× and 3×, rose destroys value. Payback is the churn-adjusted figure; the halved-churn column holds everything but churn fixed."
            columns={['Motion', 'ARPU/mo', 'Margin', 'Churn/mo', 'CAC', 'LTV', 'LTV:CAC', 'Payback', 'LTV @ churn ÷ 2']}
            footnote="Pattern 1 — the two rules of thumb disagree in both directions here: the sales-led mid-market row clears 3× (3.2) while its payback runs 31.0 months, and the leaky bucket pays back in 7.3 months while sitting under the bar at 2.8×. Value and cash-timing are different failures; read both columns. Pattern 2 — the last column is double the LTV column on every row: halve the divisor, double the quotient — exact in the model, with both columns rounded to whole dollars independently for display (a $1 on-screen gap can appear). That reciprocity is the whole strategic case for retention work: the leaky bucket alone crosses 3× on halved churn. Pattern 3 — mid-market's 3× crossing sits at 1.28%/mo churn, just above its actual 1.2%: enormous value headroom, while its payback leg is what financing has to solve."
          >
            <tbody className="divide-y divide-slate-100 dark:divide-white/[0.06]">
              {SCENARIO_ROWS.map(({ preset, r, halved }) => {
                const ratioTone =
                  r.ratio === null
                    ? 'bg-slate-100 text-slate-600 dark:bg-white/[0.05] dark:text-slate-300'
                    : r.ratio >= RATIO_HEALTHY
                      ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400'
                      : r.ratio >= 1
                        ? 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300'
                        : 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400';
                const paybackTone =
                  r.paybackChurnAdjusted === null
                    ? 'text-rose-600 dark:text-rose-400'
                    : r.paybackChurnAdjusted <= PAYBACK_HEALTHY_MONTHS
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-amber-700 dark:text-amber-300';
                return (
                  <tr key={preset.id}>
                    <th scope="row" className="readout font-semibold normal-case tracking-normal text-slate-900 dark:text-slate-100">
                      {preset.label}
                    </th>
                    <td className="text-right">
                      <span className="readout whitespace-nowrap text-slate-600 dark:text-slate-300">{usd(preset.inputs.arpu, 0)}</span>
                    </td>
                    <td className="text-right">
                      <span className="readout whitespace-nowrap text-slate-600 dark:text-slate-300">{pct(preset.inputs.grossMarginPct, 0)}</span>
                    </td>
                    <td className="text-right">
                      <span className="readout whitespace-nowrap text-slate-600 dark:text-slate-300">{pct(preset.inputs.churnPct, 1)}</span>
                    </td>
                    <td className="text-right">
                      <span className="readout whitespace-nowrap text-slate-600 dark:text-slate-300">{usd(r.cac ?? 0, 0)}</span>
                    </td>
                    <td className="text-right">
                      <span className="readout whitespace-nowrap font-semibold text-slate-900 dark:text-slate-100">{usd(r.ltv ?? 0, 0)}</span>
                    </td>
                    <td className="text-right">
                      <span className={`readout inline-block whitespace-nowrap rounded-full px-2 py-0.5 font-semibold ${ratioTone}`}>
                        {r.ratio === null ? '—' : `${numFmt(r.ratio, 1)}×`}
                      </span>
                    </td>
                    <td className="text-right">
                      <span className={`readout whitespace-nowrap font-semibold ${paybackTone}`}>
                        {r.paybackChurnAdjusted === null ? 'never' : `${numFmt(r.paybackChurnAdjusted, 1)} mo`}
                      </span>
                    </td>
                    <td className="text-right">
                      <span className="readout whitespace-nowrap font-semibold text-indigo-600 dark:text-indigo-300">
                        {usd(halved.ltv ?? 0, 0)}
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
              xLabel="Monthly logo churn"
              yLabel="Lifetime value"
              xFormat={(n) => `${n.toFixed(n < 10 ? 1 : 0)}%`}
              yFormat={(n) => usdCompact(n)}
              height={300}
              marker={{ x: REFERENCE.churnPct, label: 'reference churn 4.0%' }}
              caption={`The churn hyperbola for the reference profile ($100 ARPU, 80% margin, CAC held at $200): halving churn exactly doubles LTV — $2,000 at 4%/mo becomes $4,000 at 2%/mo — while every point move matters more as you approach the origin. The dashed revenue-basis curve is the wrong formula: it runs ${pct((1 / (REFERENCE.grossMarginPct / 100) - 1) * 100, 0)} above the correct one at every churn rate (exactly 1 ÷ margin − 1), the gap widening in dollar terms exactly where low churn makes LTV biggest and the mistakes most expensive.`}
            />
          </div>
        </SectionShell>

        {/* Deep-dive guide */}
        <div className="border-t border-slate-200 pt-12 dark:border-white/[0.07]">
          <section id="guide" aria-label="SaaS unit economics guide" className="scroll-mt-28">
            <LtvCacArticle />
          </section>
        </div>

        <WorkflowChain currentSlug={calc.slug} />

        <ProvenanceFooter
          sources={[
            {
              label: 'Formula provenance',
              detail:
                'Geometric-series customer lifetime value on the gross-margin basis — the standard treatment in SaaS metrics practice canon, popularized by David Skok\'s forEntrepreneurs "SaaS Metrics" writing and the operator/VC tradition that adopted it. Managerial-finance canon, not statute: no IRS, SSA, or legislative source governs any constant in this model.',
            },
            {
              label: 'Health benchmarks',
              detail:
                'LTV:CAC > 3× and CAC payback < 12 months are industry rules of thumb from the same practice canon (the "recover CAC within a year" guideline). Heuristics, not laws — surfaced as such in the tool, the methodology, and the guide, including the cases where the two rules disagree.',
            },
            {
              label: 'Survival model',
              detail:
                'Constant-hazard (geometric) survival: expected lifetime 1 ÷ churn months — the distribution mean, not the median (ln 2 ÷ churn ≈ 0.693 ÷ churn). Churn annualizes compounding: 1 − (1−c)¹². The discounted variant assumes end-of-month payments, reducing to the undiscounted formula at a zero rate.',
            },
            {
              label: 'Parameter posture',
              detail:
                'No year-specific constants: ARPU, margin, churn, spend, and the optional discount rate are all operator inputs, so the model is time-invariant and needs no tax-year pinning. The discount-rate ladder uses common private-company cost-of-capital practice (8–15%/yr) as orientation, not authority.',
            },
            {
              label: 'Out of scope',
              detail:
                'Expansion revenue and NRR above 100% (modeled conservatively at flat), cohort-varying and front-loaded churn curves, the paid-vs-organic CAC split (covered qualitatively), usage-based revenue dispersion, taxes, and the financing decision a slow payback implies — that last one belongs to the runway instrument.',
            },
          ]}
          disclaimer="This is an illustrative unit-economics model for planning, not investment, accounting, or tax advice. The 3× and 12-month bars are industry heuristics, not thresholds with legal or regulatory force; cohort-level analysis should confirm any churn figure before it drives spend decisions. LTV inputs rest on averages that hide dispersion — sanity-check against your own cohorts before acting."
        />
      </CalculatorPageShell>
    </>
  );
}

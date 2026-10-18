import type { Metadata } from 'next';
import CalculatorPageShell from '@/components/CalculatorPageShell';
import RothCalculator from '@/components/calculators/RothCalculator';
import RothArticle from '@/components/content/RothArticle';
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
import { compareRoth, gapMagnitude, ROTH_CONSTANTS as RC } from '@/lib/roth';
import { usd, usdCompact } from '@/lib/format';

/**
 * Registration in lib/site.ts is handled by the suite's integration pass — the
 * page carries its own metadata object (typed against the same contract) so it
 * is fully renderable before that step.
 */
const calc: Calculator = {
  slug: 'roth-vs-traditional-calculator',
  href: '/roth-vs-traditional-calculator/',
  title: 'Roth vs Traditional Calculator',
  shortTitle: 'Roth vs Traditional',
  tagline: 'IRA & 401(k): one tax-rate dial decides it — see where yours lands.',
  description:
    'Compare Roth and Traditional IRA / 401(k) outcomes at your tax rates: balances, after-tax spendable value under both comparison framings, the break-even retirement tax rate, and how contribution years compound the gap. 2025 limits and Roth MAGI phase-outs disclosed.',
  icon: 'Landmark',
  category: 'Taxes',
  tags: [
    'roth vs traditional',
    'roth ira calculator',
    'traditional ira',
    'roth 401k',
    'retirement calculator',
    'break even tax rate',
    'ira contribution limit',
    'roth conversion ladder',
    'magi phase out',
    'tax planning',
  ],
  accent: 'indigo',
  stage: 4,
  stageLabel: 'Compensate',
  dataBasis: 'Tax-year 2025 IRS limits (IR-2024-285, Notice 2024-80); annuity-due compounding model',
  formulaSnapshot: 'Δ = C × G × (t_ret − t_now) → break-even t_ret = t_now',
};

/* Build-time scenario grid: the current-rate × retirement-rate plane where the
   decision lives, computed at the IRA default ($7,000/yr, 30 years, 7%). */
const SCENARIO_NOW = [12, 22, 24, 32, 35];
const SCENARIO_RET = [0, 12, 22, 32];
const SCENARIO_BASE = {
  annualContribution: RC.iraLimit,
  years: 30,
  annualReturnPct: 7,
};
const scenarioCell = (now: number, ret: number) =>
  compareRoth({ currentRatePct: now, retirementRatePct: ret, ...SCENARIO_BASE });

/* Footnote anchors, computed not typed: the biggest Traditional cell on the
   grid and the per-point swing (constant across the grid — same C and G). */
const BIGGEST_TRAD = scenarioCell(35, 0);
const UNIT = scenarioCell(24, 24);
const SWING = UNIT.perPointSwing;

/* Chart series: the dollar magnitude of equally-sized rate decisions as the
   horizon stretches — four gaps, one contribution, one return rate. */
const CHART_YEARS = Array.from({ length: 45 }, (_, i) => i + 1);
const CHART_GAPS = [
  { gap: 2, label: '2-point rate gap', color: '#94a3b8' },
  { gap: 6, label: '6-point rate gap', color: '#0ea5e9' },
  { gap: 12, label: '12-point rate gap', color: '#f59e0b' },
  { gap: 20, label: '20-point rate gap', color: '#6366f1' },
];
const CHART_SERIES = CHART_GAPS.map((g) => ({
  label: g.label,
  color: g.color,
  points: CHART_YEARS.map((y) => ({ x: y, y: gapMagnitude(RC.iraLimit, g.gap, 7, y) })),
}));

export const metadata: Metadata = {
  title: 'Roth vs Traditional Calculator (2025) — IRA & 401(k) Break-Even Rate',
  description:
    'Compare Roth and Traditional IRA / 401(k) accounts at your tax rates: projected balances, after-tax spendable value under equal-outlay and equal-limit framings, the exact break-even retirement tax rate, and the compounding-amplification view. 2025 limits ($7,000 IRA, $23,500 401(k)) and Roth MAGI phase-outs disclosed.',
  keywords: [
    'roth vs traditional',
    'roth ira calculator',
    'traditional ira calculator',
    'roth 401k calculator',
    'break even tax rate',
    'retirement tax calculator',
    'ira contribution limit 2025',
    'roth conversion ladder',
    'backdoor roth',
    'magi phase out',
  ],
  alternates: { canonical: calc.href },
  openGraph: {
    title: 'Roth vs Traditional Calculator (2025) — IRA & 401(k) Break-Even Rate',
    description:
      'One dial decides it: the rate you avoid today versus the rate you pay later. Two comparison framings, the break-even retirement rate, and how contribution years compound the gap — 2025 federal limits disclosed.',
    url: `${siteConfig.url}${calc.href}`,
    type: 'website',
  },
};

export default function RothVsTraditionalPage() {
  return (
    <>
      <AppJsonLd calc={calc} />
      <CalculatorPageShell calc={calc}>
        {/* Interactive tool */}
        <section id="calculator" aria-label="Roth vs Traditional calculator tool" className="scroll-mt-28">
          <RothCalculator />
        </section>

        {/* Methodology */}
        <div className="border-t border-slate-200 pt-12 dark:border-white/[0.07]">
          <SectionShell
            id="methodology"
            eyebrow="Methodology"
            title="The model, stated exactly"
            accent={calc.accent}
            intro="Both accounts compound identically on the inside — the only difference is which end of the growth the tax touches. Every output reduces to one annuity factor and the two rates; here is the full algebra, including the second comparison framing and its caveat."
          >
            <MethodologyGrid
              formulas={[
                {
                  label: 'Growth factor (both accounts)',
                  expression: 'G = ((1 + r)^n − 1) / r × (1 + r)',
                  note: 'Annuity-due: each year\u2019s contribution goes in at the START of its year and compounds — this year\u2019s dollar earns all n years. At r = 0 the factor degenerates to n.',
                },
                {
                  label: 'Framing A — equal pre-tax outlay',
                  expression: 'trad = C·G·(1 − t_ret);   roth = C·(1 − t_now)·G',
                  note: 'The decision framing: both strategies consume the same pre-tax income. C lands in the Traditional account untouched; only C·(1 − t_now) survives today\u2019s tax into the Roth.',
                },
                {
                  label: 'Advantage & break-even',
                  expression: 'Δ = C·G·(t_ret − t_now) → t_ret* = t_now',
                  note: 'Roth wins iff the retirement rate exceeds today\u2019s marginal rate. Under flat rates the break-even is exact — the entire decision is one rate forecast.',
                },
                {
                  label: 'Sensitivity per rate point',
                  expression: '∂Δ/∂t_ret = C·G / 100',
                  note: 'Each percentage point of retirement-rate error moves the outcome by C·G/100 — the number the verdict card prices your uncertainty at.',
                },
                {
                  label: 'Framing B — equal nominal contribution',
                  expression: 'Δ_limit = C·G·t_ret',
                  note: 'The limit view: same nominal C into each account. The Roth edge it shows is produced by the framing (the up-front tax sits outside the account); its one real use is that nominal limits make Roth room shelter more spendable value at the cap.',
                },
                {
                  label: 'Roth MAGI phase-out (disclosure)',
                  expression: 'f = (end − MAGI) / (end − start)',
                  note: '2025 bands: single $150k–$165k, MFJ $236k–$246k (IRS News Release IR-2024-285); MFS $0–$10k (IRC §408A(c)(3), unindexed). Disclosure only — the comparison never uses it.',
                },
                {
                  label: 'Age-based limit',
                  expression: 'limit(age) = base + catchUp(age)',
                  note: `IRA: ${usd(RC.iraLimit, 0)} + ${usd(RC.iraCatchUp, 0)} at 50+. 401(k): ${usd(RC.k401Limit, 0)} + ${usd(RC.k401CatchUp, 0)} at 50+, or ${usd(RC.k401EnhancedCatchUp, 0)} at 60–63 (SECURE 2.0 §109 — replaces, never stacks).`,
                },
              ]}
              assumptions={[
                'Contributions land at the start of each year and the return is constant — no sequence-of-returns volatility anywhere in the model.',
                't_now is the marginal rate on the saved dollars; t_ret is ONE flat rate on the entire Traditional balance. Real withdrawals stack on the standard deduction and fill brackets bottom-up, so true average rates usually run lower — flagged in the guide rather than modeled.',
                'No RMDs (Traditional forces distributions from 73/75; Roths never or, for 401(k)s, not since 2024), no state income tax, no Medicare IRMAA interaction, no saver\u2019s credit, no Traditional-IRA deductibility phase-in.',
                'Contribution limits and the Roth MAGI phase-out are disclosed, never enforced — the tool flags an over-limit entry instead of blocking it.',
                'Both framings are computed from the same engine; the verdict card and the break-even scan always use Framing A (equal pre-tax outlay), the decision-relevant lens.',
                'Rate inputs are clamped to [0, 85]%, the horizon to [0, 70] years, and non-finite junk (a malformed deep link) sanitizes to zero rather than a rail.',
              ]}
            />
          </SectionShell>
        </div>

        {/* Scenario analysis */}
        <SectionShell
          id="scenarios"
          eyebrow="Scenario analysis"
          title="The rate plane, priced in dollars"
          accent={calc.accent}
          intro="Computed at build time by the same functions that power the widget, at the IRA default: $7,000 a year for 30 years at 7%. Every cell is the Framing-A spendable difference at retirement — the entire surface is one plane, because the model is linear in both rates."
        >
          <ScenarioPanel
            title="Roth advantage at retirement, by today's rate and the retirement rate"
            description="Positive (green) = Roth ends ahead; negative (red) = Traditional does. Rows: current marginal rate. Columns: assumed retirement rate."
            columns={['Rate today', 'Retire at 0%', 'Retire at 12%', 'Retire at 22%', 'Retire at 32%']}
            footnote={`Pattern 1 — the ±$0 cells sit exactly where row rate equals column rate (the break-even identity t_ret = t_now): on this grid that is (12%, 12%), (22%, 22%) and (32%, 32%) — the diagonal of the underlying plane, though rows 24 and 35 have no matching column to show it. Everything on the higher-rate side of that identity is Roth country; the lower-rate side is Traditional\u2019s. Pattern 2 — the whole grid moves at ${usd(SWING, 0)} per rate point in either direction: a ${usd(RC.iraLimit, 0)}/yr, 30-year, 7% habit puts that price on every point of forecast error, which is why honest rate assumptions matter more than account vocabulary. Pattern 3 — the corners price the extremes: the 35%-now saver expecting the 0% shelf (standard deduction fully absorbing withdrawals) keeps the table\u2019s largest Traditional win at ${usd(-BIGGEST_TRAD.advantageRoth, 0)}, while any cell above the diagonal flips sign at exactly the same dollar-per-point rate — the model has no favorite, only arithmetic.`}
          >
            <tbody className="divide-y divide-slate-100 dark:divide-white/[0.06]">
              {SCENARIO_NOW.map((now) => (
                <tr key={now}>
                  <th scope="row" className="readout font-semibold normal-case tracking-normal text-slate-900 dark:text-slate-100">
                    {now}%
                  </th>
                  {SCENARIO_RET.map((ret) => {
                    const c = scenarioCell(now, ret);
                    return (
                      <td key={ret} className="text-right">
                        <span
                          className={`readout inline-block whitespace-nowrap rounded-full px-2 py-0.5 font-semibold ${
                            c.winner === 'roth'
                              ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400'
                              : c.winner === 'traditional'
                                ? 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400'
                                : 'bg-slate-100 text-slate-600 dark:bg-white/[0.05] dark:text-slate-300'
                          }`}
                        >
                          {c.winner === 'traditional' ? '−' : c.winner === 'roth' ? '+' : '±'}
                          {usd(Math.abs(c.advantageRoth), 0)}
                        </span>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </ScenarioPanel>

          <div className="mt-6">
            <ComparisonChart
              series={CHART_SERIES}
              xLabel="Years of contributions"
              yLabel="Spendable gap at retirement"
              xFormat={(n) => `${Math.round(n)}y`}
              yFormat={(n) => usdCompact(n)}
              height={300}
              marker={{ x: 30, label: '30-year horizon' }}
              caption="Four equally-sized rate decisions (2, 6, 12 and 20 points), one $7,000-a-year habit at 7%: the dollar stakes of the identical decision as the runway stretches. A 2-point call is a rounding error at ten years and nearly $43k at forty-five; a 20-point call is life-changing at any horizon past twenty. Compounding never changes WHICH account wins — the sign is set by the rate gap alone — it relentlessly enlarges what being right (or wrong) is worth."
            />
          </div>
        </SectionShell>

        {/* Deep-dive guide */}
        <div className="border-t border-slate-200 pt-12 dark:border-white/[0.07]">
          <section id="guide" aria-label="Roth vs Traditional guide" className="scroll-mt-28">
            <RothArticle />
          </section>
        </div>

        <WorkflowChain currentSlug={calc.slug} />

        <ProvenanceFooter
          sources={[
            {
              label: '2025 IRA parameters',
              detail:
                'Contribution limit $7,000, unchanged, with the $1,000 age-50 catch-up — IRS Cost-of-Living-Adjusted amounts announced in News Release IR-2024-285 (Nov 1, 2024); the catch-up figure is statutory (IRC §219(b)(5)(B)). The limit is one aggregate bucket across all of a person\u2019s Roth and Traditional IRAs.',
            },
            {
              label: '2025 Roth IRA MAGI phase-out',
              detail:
                'Single/head-of-household $150,000–$165,000; married filing jointly $236,000–$246,000 (IRS News Release IR-2024-285). The married-filing-separately band of $0–$10,000 and the linear phase-out shape itself are statutory (IRC §408A(c)(3)) and not inflation-indexed.',
            },
            {
              label: '2025 401(k) parameters',
              detail:
                'Employee deferral limit $23,500 (IRS Notice 2024-80, §402(g)); age-50 catch-up $7,500 (IRC §414(v)); SECURE 2.0 §109 enhanced catch-up of $11,250 for ages 60–63 — a statutory 150% × $7,500 that replaces, not stacks with, the regular catch-up. Roth 401(k)s carry no income test.',
            },
            {
              label: 'Growth model',
              detail:
                'Annuity-due compounding with a constant annual return — the same convention stated in the methodology formulas above. Withdrawals are taxed at one flat rate (t_ret) on the entire Traditional balance; no bracket stacking, no RMD schedule, no sequence-of-returns effects.',
            },
            {
              label: 'Out of scope',
              detail:
                'RMD start ages (73/75 under SECURE 2.0 §107), state income tax and state arbitrage, Medicare IRMAA cliffs, the saver\u2019s credit, Traditional-IRA deductibility phase-outs (roughly $79k–$89k single when covered by a workplace plan, 2025), backdoor-Roth pro-rata mechanics (Form 8606), and inherited-account rules.',
            },
          ]}
          disclaimer="This is an illustrative federal model, not tax advice. The rate you expect in retirement is a forecast, and this page prices — but cannot reduce — that uncertainty. Confirm limits, eligibility, and phase-outs against current IRS publications or a qualified professional before acting."
        />
      </CalculatorPageShell>
    </>
  );
}

import type { Metadata } from 'next';
import CalculatorPageShell from '@/components/CalculatorPageShell';
import RdCreditCalculator from '@/components/calculators/RdCreditCalculator';
import RdCreditArticle from '@/components/content/RdCreditArticle';
import ComparisonChart from '@/components/ComparisonChart';
import {
  AppJsonLd,
  MethodologyGrid,
  ProvenanceFooter,
  ScenarioPanel,
  SectionShell,
  WorkflowChain,
} from '@/components/professional';
import { calculators, siteConfig, type Calculator } from '@/lib/site';
import { computeGrossCredit, qreSweep } from '@/lib/rdcredit';
import { usd, usdCompact } from '@/lib/format';

/**
 * Page-local instrument record — an exact mirror of this slug's registry entry
 * the integration pass adds to lib/site.ts. Hardcoded to stage 3 — Structure —
 * alongside the other tax-structure instruments it belongs with.
 */
const calc: Calculator = {
  slug: 'rd-tax-credit-calculator',
  href: '/rd-tax-credit-calculator/',
  title: 'R&D Tax Credit Calculator',
  shortTitle: 'R&D Credit',
  tagline: '§41 simplified credit: your QRE increment, the §280C trade, and the startup payroll path.',
  description:
    'Compute the §41 R&D tax credit with the Alternative Simplified Credit method (14% of QRE above your prior 3-year base, 6% in the first year). Compare §280C reduced-credit branches and the §41(h) payroll-tax offset for qualified small businesses.',
  icon: 'Landmark',
  category: 'Taxes',
  tags: [
    'rd tax credit',
    'research tax credit',
    'section 41',
    'qre',
    'form 6765',
    'form 8974',
    'payroll tax credit',
    'startup tax credits',
    '280c election',
  ],
  accent: 'indigo',
  stage: 3,
  stageLabel: 'Structure',
  dataBasis:
    'IRC §41(c)(4) simplified credit & §41(h) payroll election, §280C(c) & §38(c) as filed on IRS Forms 6765/8974',
  formulaSnapshot: 'credit = 14% × (QRE − 50% × prior 3-yr avg)',
};

/**
 * Registration probe: the shared WorkflowChain maps over the suite registry in
 * lib/site.ts, so render it only once this slug is present there — before
 * that, the chain would have no "You are here" step for this page.
 */
const REGISTERED = calculators.some((c) => c.slug === 'rd-tax-credit-calculator');

/* Build-time scenario grid: one research budget ($600k QRE) seen against
   every base-period position, from the first year ever through a base larger
   than current spend. The last column applies the §280C(c)(2) election. */
const SCENARIO_AVGS: { label: string; avg: number }[] = [
  { label: 'no QRE in prior 3 yrs', avg: 0 },
  { label: '$100k (year-2 ÷3)', avg: 100_000 },
  { label: '$300k', avg: 300_000 },
  { label: '$600k (steady state)', avg: 600_000 },
  { label: '$900k (shrinking)', avg: 900_000 },
];
const SCENARIO_QRES = [300_000, 600_000, 1_200_000];

const SCENARIO_ROWS = SCENARIO_QRES.map((qre) => ({
  qre,
  cells: SCENARIO_AVGS.map((s) => ({
    gross: computeGrossCredit({ qre, priorAvg3Qre: s.avg }).grossCredit,
    noPrior: s.avg <= 0,
  })),
}));

/* Chart series: credit vs QRE for the startup 6% rule vs an established
   $300k-average filer. Crossover at QRE = 7/4 × base = 0.875 × avg = $262.5k. */
const SWEEP = qreSweep(300_000, 0, 1_200_000, 49);
const CHART_SERIES = [
  {
    label: 'No QRE in prior 3 years — 6% flat (§41(c)(4)(B))',
    color: '#f59e0b',
    points: SWEEP.map((p) => ({ x: p.qre, y: p.noPriorQre })),
  },
  {
    label: 'Established — 14% over $150k base (§41(c)(4)(A))',
    color: '#6366f1',
    points: SWEEP.map((p) => ({ x: p.qre, y: p.established })),
  },
];

/* The startup story in one pair: zero tax liability, credit through payroll. */

export const metadata: Metadata = {
  title: 'R&D Tax Credit Calculator (2025) — §41 QRE Credit, §280C & Payroll Offset',
  description:
    'Estimate the §41 R&D tax credit with the simplified method: 14% of qualified research expenses above your prior 3-year base (6% in the first year). Price the §280C(c)(2) reduced-credit election and the §41(h) payroll-tax offset for qualified small businesses.',
  keywords: [
    'rd tax credit calculator',
    'research tax credit',
    'section 41 calculator',
    'qre calculator',
    'form 6765',
    'form 8974',
    'payroll tax credit startup',
    '280c reduced credit',
    'alternative simplified credit',
    'rd credit software development',
  ],
  alternates: { canonical: calc.href },
  openGraph: {
    title: 'R&D Tax Credit Calculator (2025) — §41 QRE Credit, §280C & Payroll Offset',
    description:
      'The simplified-credit model: your QRE increment at 14%, the 6% first-year rule, the §280C full-vs-reduced trade, and the $500k/year §41(h) payroll path for qualified small businesses.',
    url: `${siteConfig.url}${calc.href}`,
    type: 'website',
  },
};

export default function RdTaxCreditCalculatorPage() {
  return (
    <>
      <AppJsonLd calc={calc} />
      <CalculatorPageShell calc={calc}>
        {/* Interactive tool */}
        <section id="calculator" aria-label="R&D tax credit calculator tool" className="scroll-mt-28">
          <RdCreditCalculator />
        </section>

        {/* Methodology */}
        <div className="border-t border-slate-200 pt-12 dark:border-white/[0.07]">
          <SectionShell
            id="methodology"
            eyebrow="Methodology"
            title="The §41 computation, stated exactly"
            accent={calc.accent}
            intro="Everything below mirrors how IRS Form 6765 Section C determines the simplified credit, then how §280C(c) and §38(c) price it and §41(h) monetizes it. Each formula carries its statutory citation; where the law is genuinely unsettled, the model says so instead of guessing."
          >
            <MethodologyGrid
              formulas={[
                {
                  label: 'Simplified credit (§41(c)(4)(A))',
                  expression: 'credit = 14% × max(0, QRE − 50% × avgQRE₃)',
                  note: 'avgQRE₃ is the sum of QRE over the 3 preceding tax years ÷ 3, zeros included once they are post-startup years. The increment floors at zero — it never goes negative.',
                },
                {
                  label: 'First-year / returning 6% rate (§41(c)(4)(B))',
                  expression: 'credit = 6% × QRE   (no QRE in any of the 3 preceding years)',
                  note: 'The special rule turns on a zero prior 3-year average — it covers a taxpayer\u2019s first research year and a company returning to research after a gap of three or more years alike. From the next year on, the average is simply the three-year sum ÷ 3, zeros included.',
                },
                {
                  label: '§280C(c) branches',
                  expression: 'full: claim C, deduct R&D − C · reduced: claim 0.79 × C, deduct R&D',
                  note: 'Without the election the research deduction falls by the credit allowed (§280C(c)(1), as rewritten by OBBBA §70302); with it, the credit is cut by the 21% maximum corporate rate (§11(b)) and the deduction is untouched. Net values cross at a 21% marginal rate.',
                },
                {
                  label: 'Income-tax ceiling (§38(c))',
                  expression: 'ceiling = tax − max(0, 25% × (tax − $25,000))',
                  note: 'The research credit is a general business credit: §38(c)(1)(B) caps it at net income tax over the greater of tentative minimum tax or 25% of net regular tax liability above $25,000 — corporations face the same 25%-over-$25,000 cap via §38(c)(6)(E) (Form 3800 instructions), so no entity branch is modeled with AMT assumed zero (stated in the tool). Excess carries back 1 year, forward 20 (§39).',
                },
                {
                  label: 'Payroll election (§41(h))',
                  expression: 'elected ≤ min(credit, $500,000) · capacity = 7.65% × wages',
                  note: 'Qualified small businesses (≤ $5M receipts, none before the 5-year period ending with the year) elect part of the credit against employer FICA — Social Security first (≤ $250k/quarter), then Medicare — quarterly on Form 8974 from the first quarter after the income-tax return is filed. A split, not a bonus: elected dollars cannot offset income tax or join the GBC carryforward (Form 3800 instructions), so the income path runs on the remainder. Net value accounts for the employer-FICA deduction the offset replaces.',
                },
                {
                  label: 'Net benefit, both paths',
                  expression: 'income: used − rate × deduction lost · payroll: applied × (1 − rate)',
                  note: 'Deliberately conservative: carryforwards and later-year credit value are excluded from the headline; the marginal rate entered is the honest price of every deduction each path gives up.',
                },
              ]}
              assumptions={[
                'Federal only, tax year 2025, one trade or business; the §41(c)(1) regular (fixed-base) method is not modeled and can pay more for mature programs.',
                'QRE is a single aggregate input — the contract-research blend (65% under §41(b)(3)(A); 75% for qualified research consortium payments; 100% only for qualified energy research performed by an eligible small business, college, or federal laboratory), wage-time allocation, and supplies qualification happen before entry.',
                'The §41(h) election splits the credit: elected dollars are removed from the income-tax path per the Form 3800 instructions, and the two paths always consume the same elected amount.',
                'AMT is assumed away inside the §38(c) ceiling — which applies its 25%-over-$25,000 reduction to corporations and individuals alike under current §38(c)(1)(B)/(6)(E); GBC carryback/carryforward is flagged, not valued.',
                'Employer FICA capacity uses 7.65% of aggregate wages; the 2025 per-employee Social Security wage base ($176,100) is not modeled — top-heavy payrolls overstate it slightly.',
                'Whether §280C(c) interacts with payroll-elected amounts is governed by current IRS guidance (Form 6765/8974 instructions); this model does not reduce the payroll offset for it.',
                '§174/§174A: domestic research expensing is restored for tax years beginning after 12/31/2024 (OBBBA §70302); 2022–2024 tax years remain under TCJA capitalization. Neither changes any credit number here — current IRS guidance governs.',
              ]}
            />
          </SectionShell>
        </div>

        {/* Scenario analysis */}
        <SectionShell
          id="scenarios"
          eyebrow="Scenario analysis"
          title="One budget, every base-period position"
          accent={calc.accent}
          intro="Computed at build time by this page's own library: a $600k QRE budget against every prior-average position — from a first-ever QRE year to a base so large the credit dies — with the §280C(c)(2) reduced credit (79%) alongside."
        >
          <ScenarioPanel
            title="Gross §41 credit by QRE and prior 3-year average"
            description="Rows sweep current-year QRE; columns sweep the base period. The no-prior-QRE column is the statutory 6% special rule — triggered whenever none of the 3 preceding years had QRE — not a zero base under 14%."
            columns={['QRE', 'No prior QRE (6%)', 'Avg $100k', 'Avg $300k', 'Avg $600k', 'Avg $900k', 'Reduced (79%) · avg $300k']}
            footnote="Pattern 1 — the no-prior-QRE column is 6% of every QRE row: the special rule for filers with no QRE in any of the 3 preceding years (§41(c)(4)(B)), which covers first research years and returns after multi-year gaps alike — the best rate on marginal dollars such a filer will see. Pattern 2 — at a $300k average the $600k row earns 14% × $450k of increment; at $600k (the flat-budget steady state) exactly half of spend is increment and the effective rate settles at 7%. Pattern 3 — at a $900k average only growth earns: $0 on $300k of spend, $21,000 on $600k (3.5% effective), and the credit only scales again on the $1.2M row. The credit rewards spending above your own trailing history, and a shrinking research program earns little or nothing. The last column shows what the §280C(c)(2) election costs at face value — the deduction it preserves is usually worth more."
          >
            <tbody className="divide-y divide-slate-100 dark:divide-white/[0.06]">
              {SCENARIO_ROWS.map((row) => (
                <tr key={row.qre}>
                  <th
                    scope="row"
                    className="readout font-semibold normal-case tracking-normal text-slate-900 dark:text-slate-100"
                  >
                    {usd(row.qre, 0)}
                  </th>
                  {row.cells.map((c, i) => (
                    <td key={i} className="text-right">
                      <span
                        className={`readout inline-block whitespace-nowrap rounded-full px-2 py-0.5 font-semibold ${
                          c.gross <= 0.005
                            ? 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400'
                            : i === 0
                              ? 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300'
                              : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400'
                        }`}
                      >
                        {c.gross <= 0.005 ? '—' : usd(c.gross, 0)}
                      </span>
                    </td>
                  ))}
                  <td className="text-right">
                    <span className="readout whitespace-nowrap font-medium text-slate-600 dark:text-slate-300">
                      {usd(0.79 * computeGrossCredit({ qre: row.qre, priorAvg3Qre: 300_000 }).grossCredit, 0)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </ScenarioPanel>

          <div className="mt-6">
            <ComparisonChart
              series={CHART_SERIES}
              xLabel="Current-year QRE"
              yLabel="Gross §41 credit"
              xFormat={(n) => usdCompact(n)}
              yFormat={(n) => usdCompact(n)}
              height={300}
              marker={{ x: 262_500, label: 'crossover $262.5k' }}
              markerColor="#6366f1"
              caption="The established line (prior average $300k, so a $150k base) is zero until QRE clears the base, then climbs at 14¢ per incremental dollar; the startup line earns 6¢ from dollar one. They cross where 6% × QRE = 14% × (QRE − base) — QRE = 7/4 × base = 0.875 × the prior average, $262.5k here. Beyond it, an established filer out-earns a first-year filer on the same spend; below it, the startup rule wins. This is the quiet reason growing R&D budgets age well under §41(c)(4): the trailing average chases you at one-third speed."
            />
          </div>
        </SectionShell>

        {/* Deep-dive guide */}
        <div className="border-t border-slate-200 pt-12 dark:border-white/[0.07]">
          <section id="guide" aria-label="R&D tax credit guide" className="scroll-mt-28">
            <RdCreditArticle />
          </section>
        </div>

        {/* Rendered only once the slug is registered in lib/site.ts —
            see REGISTERED above. */}
        {REGISTERED && <WorkflowChain currentSlug={calc.slug} />}

        <ProvenanceFooter
          sources={[
            {
              label: 'Credit computation',
              detail:
                'IRC §41(c)(4) as computed on IRS Form 6765: 14% of QRE above 50% of the prior 3-year average (§41(c)(4)(A)); a flat 6% whenever there was no QRE in any of the 3 preceding taxable years (§41(c)(4)(B)) — first research year or return after a multi-year gap alike. QRE composition per §41(b): contract research at 65% (§41(b)(3)(A)); 75% only for payments to a qualified research consortium (§41(b)(3)(C)); 100% only for qualified energy research performed by an eligible small business (≤500 employees, unrelated to the payor), college, or federal laboratory (§41(b)(3)(D)).',
            },
            {
              label: '§280C & §38 limits',
              detail:
                '§280C(c)(1) reduces the research deduction by the credit allowed (text as amended by OBBBA P.L. 119-21 §70302); §280C(c)(2) reduces the credit by the 21% maximum §11(b) rate — 79% kept — with the election made on Form 6765 by the return due date. §38(c) supplies the general-business-credit ceiling: net income tax less the greater of tentative minimum tax or 25% of net regular tax liability above $25,000 (§38(c)(1)(B), current text — the formerly cited §38(c)(3) was repealed by P.L. 115-141), with the same 25%-over-$25,000 cap applied to corporations via §38(c)(6)(E) per the IRS Form 3800 instructions; §39 provides the 1-year carryback / 20-year carryforward.',
            },
            {
              label: 'Payroll election',
              detail:
                'IRC §41(h) as administered on Form 8974: qualified small businesses (gross receipts ≤ $5M, none before the 5-year period ending with the credit year) elect up to $500,000 per tax year (post-2022 amount, IRA §13902) against employer FICA — Social Security first (≤ $250k per quarter), then employer Medicare — starting the first quarter after the income-tax return is filed, with unused elected amounts carrying forward (IRS, Qualified small business payroll tax credit for increasing research activities). The election splits the credit: per the IRS Form 3800 instructions, no amount elected as a payroll tax credit can offset the current-year income tax or enter the GBC carryforward or carryback.',
            },
            {
              label: '§174 / §174A context',
              detail:
                'TCJA §13206 required capitalization/amortization of research expenditures for tax years beginning after 12/31/2021 (domestic 5-year, foreign 15-year); OBBBA §70302 created §174A restoring permanent domestic expensing for tax years beginning after 12/31/2024, with a statutory catch-up election under §174A(c) for previously capitalized balances, administered as an automatic accounting-method change through Rev. Proc. 2025-28. The current IRS Forms 6765/8974 instructions and §174/§174A guidance govern — this tool\u2019s numbers are unaffected by the timing change.',
            },
            {
              label: 'Verification basis',
              detail:
                `Cross-checked end to end: the 6% first-year credit, the 50% base share, the 79% §280C reduction at a 21% corporate rate, the §38(c) individual ceiling formula, the $500k per-year §41(h) cap and the 7.65% employer-FICA capacity each reproduce by hand against the statutory text (see Methodology). Build-time scenario table and charts are generated by this page\u2019s own library, the same functions the widget runs.`,
            },
            {
              label: 'Out of scope',
              detail:
                'The §41(c)(1) regular method, state R&D credits and state §280C analogues, AMT in the ceiling, controlled-group allocation, wage-allocation methods, the per-employee Social Security wage base in payroll capacity, and any determination that specific activities constitute qualified research.',
            },
          ]}
          disclaimer="This is an illustrative federal model, not tax advice. Qualifying research is a facts-and-circumstances judgment the IRS litigates; both elections (§280C(c)(2), §41(h)) are irrevocable per-year choices made on the return. Confirm current-year parameters, §174A positions, and eligibility with a qualified professional before filing Form 6765."
        />
      </CalculatorPageShell>
    </>
  );
}

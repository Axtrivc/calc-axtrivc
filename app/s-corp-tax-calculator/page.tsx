import type { Metadata } from 'next';
import CalculatorPageShell from '@/components/CalculatorPageShell';
import ScorpCalculator from '@/components/calculators/ScorpCalculator';
import ScorpArticle from '@/components/content/ScorpArticle';
import ComparisonChart from '@/components/ComparisonChart';
import {
  AppJsonLd,
  MethodologyGrid,
  ProvenanceFooter,
  ScenarioPanel,
  SectionShell,
  WorkflowChain,
} from '@/components/professional';
import { calculators, siteConfig } from '@/lib/site';
import {
  compareScorpFull,
  breakevenPayrollCostFull,
  computeScorpFull,
  computeLlcFull,
  SCORP_FULL_CONSTANTS as SC,
} from '@/lib/scorpfull';
import { usd, usdCompact, numFmt } from '@/lib/format';

const calc = calculators.find((c) => c.slug === 's-corp-tax-calculator')!;

/* Build-time scenario grid: the profit band where the decision actually lives.
   The low end ($40k) shows where overhead starts eating the win; the high end
   ($300k+) shows the §199A wage-limit flip, where the wage-less LLC column
   loses its QBI deduction and the S-Corp's edge jumps an order of magnitude. */
const SCENARIO_PROFITS = [40_000, 60_000, 80_000, 100_000, 150_000, 200_000, 300_000, 500_000, 650_000];
const SALARY_RATIOS = [0.3, 0.4, 0.5, 0.7] as const;
const OVERHEAD = SC.defaultPayrollCost;

/* Chart series: after-tax income under both structures at two salary policies. */
const CHART_PROFITS = Array.from({ length: 25 }, (_, i) => 50_000 + i * 25_000);
const CHART_SERIES = [
  {
    label: 'LLC — after-tax income',
    color: '#0ea5e9',
    points: CHART_PROFITS.map((p) => ({ x: p, y: computeLlcFull(p).afterTax })),
  },
  {
    label: 'S-Corp — after-tax income (salary = 40% of profit)',
    color: '#6366f1',
    points: CHART_PROFITS.map((p) => ({ x: p, y: computeScorpFull(p, p * 0.4, OVERHEAD).afterTax })),
  },
  {
    label: 'S-Corp — salary = 70% of profit',
    color: '#f59e0b',
    dashed: true,
    points: CHART_PROFITS.map((p) => ({ x: p, y: computeScorpFull(p, p * 0.7, OVERHEAD).afterTax })),
  },
];

const BE_200K = breakevenPayrollCostFull(200_000, 80_000);

export const metadata: Metadata = {
  title: 'S-Corp Salary Calculator (2025) — SE Tax Savings vs Payroll Costs',
  description:
    'Compare LLC self-employment tax versus S-Corp salary + distributions. Real annual savings, breakeven payroll overhead, and the salary sensitivity curve — 2025 federal rules with the full §199A (Form 8995-A) interaction.',
  keywords: [
    's corp calculator',
    's corp salary calculator',
    's corp vs llc taxes',
    'self employment tax calculator',
    'reasonable salary s corp',
    's corp tax savings',
    'payroll tax calculator owner',
    'form 2553 savings',
  ],
  alternates: { canonical: calc.href },
  openGraph: {
    title: 'S-Corp Salary Calculator (2025) — SE Tax Savings vs Payroll Costs',
    description:
      'Is the S election worth it at your numbers? Full federal model: FICA on salary, tax-free distributions, §199A wage-limit interaction per Form 8995-A, and breakeven payroll overhead.',
    url: `${siteConfig.url}${calc.href}`,
    type: 'website',
  },
};

export default function ScorpCalculatorPage() {
  return (
    <>
      <AppJsonLd calc={calc} />
      <CalculatorPageShell calc={calc}>
        {/* Interactive tool */}
        <section id="calculator" aria-label="S-Corp salary calculator tool" className="scroll-mt-28">
          <ScorpCalculator />
        </section>

        {/* Methodology */}
        <div className="border-t border-slate-200 pt-12 dark:border-white/[0.07]">
          <SectionShell
            id="methodology"
            eyebrow="Methodology"
            title="The model, stated exactly"
            accent={calc.accent}
            intro="Both columns come from the same federal machinery: 2025 single-filer brackets, the $15,750 standard deduction, and §199A computed line-by-line on Form 8995-A. The only difference is how profit enters the tax code — as self-employment income, or as salary plus K-1 distributions."
          >
            <MethodologyGrid
              formulas={[
                {
                  label: 'LLC: self-employment tax',
                  expression: 'SE = 15.3% × min(92.35% × profit, $176,100) + 2.9% × rest',
                  note: 'Schedule SE: the base is 92.35% of net earnings; the 15.3% rate applies up to the $176,100 wage base, 2.9% Medicare above it. Half of SE tax becomes an income-tax deduction.',
                },
                {
                  label: 'S-Corp: payroll tax',
                  expression: 'FICA = 2 × (6.2% × min(salary, $176,100) + 1.45% × salary) + 0.9% × max(0, salary − $200k)',
                  note: 'Employee + employer halves on W-2 wages only. The employee-side Additional Medicare Tax (0.9% above $200k of wages) has no employer match.',
                },
                {
                  label: 'Additional Medicare (both sides)',
                  expression: '0.9% × max(0, base − $200k) · base = wages or 92.35% × profit',
                  note: 'Form 8959: the S-Corp owner-employee pays it on wages; the sole proprietor on the same 92.35% base used for SE tax. Many comparisons quietly charge only the wage side — both columns pay it here.',
                },
                {
                  label: 'S-Corp: pass-through income',
                  expression: 'K-1 = profit − salary − employer FICA − payroll overhead',
                  note: 'Distributions carry no payroll tax. Employer FICA and admin cost are deductible business expenses that shrink K-1 dollar-for-dollar.',
                },
                {
                  label: 'QBI on each side (Form 8995-A)',
                  expression: 'min(20% × QBI, 20% × TI); above $197,300 TI also ≤ max(50% × W-2, 25% × W-2 + 2.5% × UBIA)',
                  note: '§199A: the 20%-of-taxable-income cap applies at every income level (it is what binds at low profits); above $197,300 of taxable income the W-2 limitation phases in over $50k as well. Owner wages are excluded from QBI but count as the business\'s W-2 wages for that limit — a wage-less sole proprietor above the threshold loses the deduction; the S-Corp\'s salary keeps it. SSTB phase-outs are modeled (toggle in the tool).',
                },
                {
                  label: 'Income tax (both)',
                  expression: 'tax = brackets(ordinary income − $15,750 − QBI)',
                  note: `Ordinary income is profit-derived on both sides: LLC (profit − ½SE) vs S-Corp (salary + K-1). Standard deduction ${usd(SC.stdDeduction, 0)} (post-OBBBA); 2025 single-filer brackets.`,
                },
                {
                  label: 'Breakeven overhead',
                  expression: 'solve: scorp.net(cost) = llc.net',
                  note: 'Found by bisection — the point where annual payroll & compliance overhead exactly consumes the election\'s advantage at your salary.',
                },
              ]}
              assumptions={[
                'Single owner taking 100% of profit; the salary entered is treated as defensible (the tool evaluates a salary, it never suggests one).',
                'Tax-year 2025 federal parameters: $15,750 single standard deduction (post-OBBBA, per the IRS — not 2024\u2019s $14,600), $176,100 Social Security wage base, 0.9% Additional Medicare above $200k on wages and on the SE base.',
                '§199A runs on the full Form 8995-A chain — $197,300 threshold, $50,000 phase-in, W-2/UBIA wage limitation, SSTB exclusion — the same engine as the QBI Deduction tool.',
                'Tax-year 2026 parameters are already published ($16,100 standard deduction, $184,500 wage base); this tool stays pinned to 2025.',
                'Salary above profit is capped at profit and flagged in the tool — wages cannot exceed the pool being split.',
                'No state income tax, state unemployment, or franchise taxes; a single annual overhead input stands in for all of them.',
              ]}
            />
          </SectionShell>
        </div>

        {/* Scenario analysis */}
        <SectionShell
          id="scenarios"
          eyebrow="Scenario analysis"
          title="Where the election pays, and where it dies"
          accent={calc.accent}
          intro="Computed at build time by the same functions that power the widget, at four salary policies per profit level. Every cell is the full model — FICA, the §199A wage limit, both sides of the Additional Medicare Tax, income tax, and $1,200/yr overhead included."
        >
          <ScenarioPanel
            title="S-Corp after-tax advantage per year, by profit and salary policy"
            description="Positive (green) = the election wins at that salary ratio; negative (red) = the plain LLC keeps more. Overhead modeled at $1,200/yr throughout."
            columns={[`Profit`, `Salary = 30%`, `Salary = 40%`, `Salary = 50%`, `Salary = 70%`, `Breakeven overhead @40%`]}
            footnote={`Pattern 1 — within the 30–70% salary band shown, a lower ratio means a bigger win, but only down to a point: at $300k+ of profit the edge peaks near a 28% salary (the sensitivity chart's mid-range bump — below that, salary stops covering the §199A wage limit) and every step down weakens the reasonable-compensation position anyway. Pattern 2 — breakeven overhead as a share of profit dips from 8.4% at $40k to 6.5% at $200k (it grows slower than profit through that range), jumps to 9.8% at $300k as the wage limit starts stripping the LLC's QBI deduction, then settles near 8% again${
              BE_200K !== null
                ? `: at $200k/40% salary the election survives up to ${usd(BE_200K, 0)}/yr of payroll and compliance cost, roughly ${numFmt((BE_200K / 200_000) * 100, 1)}% of profit — a real-world quote below your row's breakeven means the election is in the money`
                : ''
            }. Pattern 3 — the high-income flip has two landmarks: the wage-less LLC's QBI deduction starts being stripped just past $230k of profit and is gone entirely by ≈$278k, while the S-Corp keeps 20% of K-1 — which is why the advantage jumps from four figures to five between the $200k and $300k rows, even as the 70% column shows the edge thinning whenever salary eats most of the profit.`}
          >
            <tbody className="divide-y divide-slate-100 dark:divide-white/[0.06]">
              {SCENARIO_PROFITS.map((profit) => {
                const cells = SALARY_RATIOS.map((r) => compareScorpFull(profit, profit * r, OVERHEAD));
                const be = breakevenPayrollCostFull(profit, profit * 0.4);
                return (
                  <tr key={profit}>
                    <th scope="row" className="readout font-semibold normal-case tracking-normal text-slate-900 dark:text-slate-100">
                      {usd(profit, 0)}
                    </th>
                    {cells.map((c, i) => (
                      <td key={i} className="text-right">
                        <span
                          className={`readout inline-block whitespace-nowrap rounded-full px-2 py-0.5 font-semibold ${
                            c.winner === 'scorp'
                              ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400'
                              : c.winner === 'llc'
                                ? 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400'
                                : 'bg-slate-100 text-slate-600 dark:bg-white/[0.05] dark:text-slate-300'
                          }`}
                        >
                          {c.winner === 'llc' ? '−' : '+'}
                          {usd(c.delta, 0)}
                        </span>
                      </td>
                    ))}
                    <td className="text-right">
                      <span className="readout whitespace-nowrap font-medium text-slate-600 dark:text-slate-300">
                        {be === null ? '—' : `${usd(be, 0)}/yr`}
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
              xLabel="Net business profit"
              yLabel="After-tax income / yr"
              xFormat={(n) => usdCompact(n)}
              yFormat={(n) => usdCompact(n)}
              height={300}
              marker={{ x: 200000, label: '$200k example' }}
              caption="The vertical gap between a salary line and the LLC line is the election's payoff at that salary policy. Between roughly $230k and $278k of profit the LLC line bends downward: the §199A W-2 wage limit strips its QBI deduction linearly to zero (it is fully gone past $278k), while the S-Corp's salary keeps 20% of K-1 alive — the gap widens sharply exactly where the flat “S-Corps save 15.3%” story says it should grow only slowly. The dashed 70% line shows a salary that already consumes most of the profit: at moderate levels the edge thins to zero or below, but at the high end it survives for the same QBI reason. All curves are the complete federal model, not marginal approximations."
            />
          </div>
        </SectionShell>

        {/* Deep-dive guide */}
        <div className="border-t border-slate-200 pt-12 dark:border-white/[0.07]">
          <section id="guide" aria-label="S-Corp election guide" className="scroll-mt-28">
            <ScorpArticle />
          </section>
        </div>

        <WorkflowChain currentSlug={calc.slug} />

        <ProvenanceFooter
          sources={[
            {
              label: 'Federal parameters',
              detail:
                'Tax year 2025: standard deduction $15,750 single — set by the One Big Beautiful Bill Act (P.L. 119-21) and confirmed by the IRS ("New and enhanced deductions for individuals"), superseding the pre-act $15,000 of Rev. Proc. 2024-40; Social Security wage base $176,100 (SSA); Additional Medicare Tax 0.9% above $200,000 on wages and on the 92.35% SE base (Form 8959); federal brackets 10%–37% (Rev. Proc. 2024-40).',
            },
            {
              label: '§199A engine',
              detail:
                'QBI computed on the Form 8995-A (2025) line chain via the shared §199A library — the same engine as the QBI Deduction tool: $197,300 single threshold (Rev. Proc. 2024-40), $50,000 statutory phase-in (IRC §199A(e)(2)(B)(ii)), W-2/UBIA limitation (§199A(b)(1)(B)), SSTB exclusion (§199A(d)(2)).',
            },
            {
              label: 'Payroll mechanics',
              detail:
                'FICA modeled as employee + employer halves (6.2% + 1.45% each) on W-2 wages; the owner-employee\'s salary is a business deduction and employer FICA reduces K-1 income, per normal S-corp treatment.',
            },
            {
              label: 'Next year\u2019s parameters',
              detail:
                'Tax year 2026 is already published: standard deduction $16,100 single (Rev. Proc. 2025-32), Social Security wage base $184,500 (SSA). This tool is pinned to 2025; both shifts are small relative to the structural comparison it draws.',
            },
            {
              label: 'Out of scope',
              detail:
                'State income tax, state unemployment insurance, franchise taxes (e.g. CA 1.5%), retirement-plan interactions, and health-insurance rules for >2% shareholders.',
            },
          ]}
          disclaimer="This is an illustrative federal model, not tax advice. Reasonable compensation is a facts-and-circumstances legal requirement — the calculator evaluates the salary you enter; it does not certify it. Confirm wage bases, thresholds, and state rules with a qualified professional before filing Form 2553."
        />
      </CalculatorPageShell>
    </>
  );
}

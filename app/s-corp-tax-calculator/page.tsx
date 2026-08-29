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
import { compareScorp, breakevenPayrollCost, computeScorp, SCORP_CONSTANTS } from '@/lib/scorp';
import { computeLlc } from '@/lib/tax';
import { usd, usdCompact, numFmt } from '@/lib/format';

const calc = calculators.find((c) => c.slug === 's-corp-tax-calculator')!;

/* Build-time scenario grid: the profit band where the decision actually lives. */
const SCENARIO_PROFITS = [60_000, 80_000, 100_000, 150_000, 200_000, 300_000, 500_000];
const SALARY_RATIOS = [0.3, 0.4, 0.5] as const;
const OVERHEAD = SCORP_CONSTANTS.defaultPayrollCost;

/* Chart series: after-tax income under both structures at a 40% salary. */
const CHART_PROFITS = Array.from({ length: 25 }, (_, i) => 50_000 + i * 25_000);
const CHART_SERIES = [
  {
    label: 'LLC — after-tax income',
    color: '#0ea5e9',
    points: CHART_PROFITS.map((p) => ({ x: p, y: computeLlc(p).afterTax })),
  },
  {
    label: 'S-Corp — after-tax income (salary = 40% of profit)',
    color: '#6366f1',
    points: CHART_PROFITS.map((p) => ({ x: p, y: computeScorp(p, p * 0.4, OVERHEAD).afterTax })),
  },
];

export const metadata: Metadata = {
  title: 'S-Corp Salary Calculator (2025) — SE Tax Savings vs Payroll Costs',
  description:
    'Compare LLC self-employment tax versus S-Corp salary + distributions. See your real annual savings, breakeven payroll overhead, and the salary sensitivity curve — 2025 federal rules.',
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
      'Is the S-Corp election worth it at your numbers? Full federal model: FICA on salary, tax-free distributions, QBI interaction, and breakeven payroll overhead.',
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
            intro="Both columns come from the same federal machinery: 2025 single-filer brackets, the standard deduction, and §199A QBI. The only difference is how profit enters the tax code — as self-employment income, or as salary plus K-1 distributions."
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
                  label: 'S-Corp: pass-through income',
                  expression: 'K-1 = profit − salary − employer FICA − payroll overhead',
                  note: 'Distributions carry no payroll tax. Employer FICA and admin cost are deductible business expenses that shrink K-1 dollar-for-dollar.',
                },
                {
                  label: 'QBI on each side',
                  expression: 'QBI = 20% × (LLC: profit − ½SE · S-Corp: K-1 only), capped at 20% of taxable income',
                  note: 'Owner W-2 wages are excluded from QBI by statute — so the S-Corp\'s deduction is usually smaller, which claws back part of the payroll-tax saving at the income-tax layer.',
                },
                {
                  label: 'Income tax (both)',
                  expression: 'tax = brackets(ordinary income − std deduction − QBI)',
                  note: `Ordinary income is profit-derived on both sides: LLC (profit − ½SE) vs S-Corp (salary + K-1). Standard deduction ${usd(SCORP_CONSTANTS.stdDeduction, 0)}; 2025 single-filer brackets.`,
                },
                {
                  label: 'Breakeven overhead',
                  expression: 'solve: scorp.net(cost) = llc.net',
                  note: 'Found by bisection — the point where annual payroll & compliance overhead exactly consumes the election\'s advantage at your salary.',
                },
              ]}
              assumptions={[
                'Single owner taking 100% of profit; the salary entered is treated as defensible (the tool evaluates a salary, it never suggests one).',
                'Tax-year 2025 federal parameters: $14,600 standard deduction, $176,100 Social Security wage base, 0.9% Additional Medicare above $200k wages.',
                'SSTB QBI phase-outs (above $197,300 taxable income) are not modeled — see caveats in the guide.',
                'No state income tax, state unemployment, or franchise taxes; a single annual overhead input stands in for all of them.',
                'Salary is capped at profit; a salary above profit is truncated, since wages cannot exceed the pool being split.',
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
          intro="Computed at build time by the same functions that power the widget, at three salary policies per profit level. Every cell is the full model — FICA, QBI interaction, income tax, and $1,200/yr overhead included."
        >
          <ScenarioPanel
            title="S-Corp after-tax advantage per year, by profit and salary policy"
            description="Positive (green) = the election wins at that salary ratio; negative (red) = the plain LLC keeps more. Overhead modeled at $1,200/yr throughout."
            columns={[`Profit`, `Salary = 30%`, `Salary = 40%`, `Salary = 50%`, `Breakeven overhead @40%`]}
            footnote={`Pattern 1 — the advantage scales with the distribution slice: at every profit level, a lower salary ratio means a bigger win, but also a weaker reasonable-compensation position. Pattern 2 — breakeven overhead is large once profit clears six figures: at $200k/40% salary the election survives up to ${usd(breakevenPayrollCost(200_000, 80_000) ?? 0, 0)}/yr of payroll and compliance cost, roughly ${numFmt(((breakevenPayrollCost(200_000, 80_000) ?? 0) / 200_000) * 100, 1)}% of revenue. If your real-world quote is below that line, the election is in the money.`}
          >
            <tbody className="divide-y divide-slate-100 dark:divide-white/[0.06]">
              {SCENARIO_PROFITS.map((profit) => {
                const cells = SALARY_RATIOS.map((r) => compareScorp(profit, profit * r, OVERHEAD));
                const be = breakevenPayrollCost(profit, profit * 0.4);
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
              caption="The vertical gap between the lines is the election's payoff at a 40% salary policy. It widens with profit because the distribution slice — the part that escapes payroll tax — grows faster than the salary's FICA cost. Both curves are the complete federal model, not marginal approximations."
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
                'Tax year 2025: standard deduction $14,600 (single); Social Security wage base $176,100; Additional Medicare Tax 0.9% above $200,000 of wages; federal brackets 10%–37% as published.',
            },
            {
              label: 'Payroll mechanics',
              detail:
                'FICA modeled as employee + employer halves (6.2% + 1.45% each) on W-2 wages; the owner-employee\'s salary is a business deduction and employer FICA reduces K-1 income, per normal S-corp treatment.',
            },
            {
              label: 'Out of scope',
              detail:
                'State income tax, state unemployment insurance, franchise taxes (e.g. CA 1.5%), retirement-plan interactions, health-insurance rules for >2% shareholders, and SSTB QBI phase-outs.',
            },
          ]}
          disclaimer="This is an illustrative federal model, not tax advice. Reasonable compensation is a facts-and-circumstances legal requirement — the calculator evaluates the salary you enter; it does not certify it. Confirm wage bases, thresholds, and state rules with a qualified professional before filing Form 2553."
        />
      </CalculatorPageShell>
    </>
  );
}

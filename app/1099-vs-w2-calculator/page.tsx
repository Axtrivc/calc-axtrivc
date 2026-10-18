import type { Metadata } from 'next';
import CalculatorPageShell from '@/components/CalculatorPageShell';
import PayTypeCalculator from '@/components/calculators/PayTypeCalculator';
import PayTypeArticle from '@/components/content/PayTypeArticle';
import ComparisonChart from '@/components/ComparisonChart';
import {
  AppJsonLd,
  MethodologyGrid,
  ProvenanceFooter,
  ScenarioPanel,
  SectionShell,
} from '@/components/professional';
import { calculators, siteConfig } from '@/lib/site';
import {
  PAYTYPE_CONSTANTS,
  PAYTYPE_DEFAULTS,
  breakevenContractRate,
  breakevenMarkup,
  markupSweep,
  type PayTypeInputs,
} from '@/lib/paytype';
import { usd, usdCompact, pct } from '@/lib/format';

/* Single source of truth: the suite catalog in lib/site.ts. The former
   hardcoded registration stub (pre-integration) matched this entry verbatim
   and has been removed to keep the hero, WorkflowChain and CommandPalette
   reading one identity. */
const calc = calculators.find((c) => c.slug === '1099-vs-w2-calculator')!;

/* Build-time benefit packages for the scenario grid — the axis the required
   markup actually responds to. */
const BENEFIT_PACKAGES: { key: string; label: string; overrides: Partial<PayTypeInputs> }[] = [
  {
    key: 'none',
    label: 'No benefits',
    overrides: { ptoDays: 0, healthPremium: 0, retirementMatch: 0, otherBenefits: 0, seExpenses: 2000 },
  },
  { key: 'typical', label: 'Typical package', overrides: {} },
  {
    key: 'rich',
    label: 'Rich package',
    overrides: { ptoDays: 20, healthPremium: 9000, retirementMatch: 6000, otherBenefits: 1000, seExpenses: 3000 },
  },
];

const SCENARIO_SALARIES = [60_000, 80_000, 100_000, 125_000, 150_000, 200_000];

function scenarioCell(salary: number, overrides: Partial<PayTypeInputs>) {
  const rate = breakevenContractRate({ ...PAYTYPE_DEFAULTS, ...overrides, salary });
  return { rate, markup: rate === null ? null : breakevenMarkup(salary, rate) };
}

/* Chart series: required markup vs salary for each benefit package. */
const CHART_SERIES = [
  {
    label: 'No benefits',
    color: '#0ea5e9',
    points: markupSweep({ ...PAYTYPE_DEFAULTS, ...BENEFIT_PACKAGES[0].overrides }).map((p) => ({
      x: p.salary,
      y: p.markupPct,
    })),
  },
  {
    label: 'Typical package',
    color: '#6366f1',
    points: markupSweep(PAYTYPE_DEFAULTS).map((p) => ({ x: p.salary, y: p.markupPct })),
  },
  {
    label: 'Rich package',
    color: '#f59e0b',
    points: markupSweep({ ...PAYTYPE_DEFAULTS, ...BENEFIT_PACKAGES[2].overrides }).map((p) => ({
      x: p.salary,
      y: p.markupPct,
    })),
  },
];

/* Footnote anchors, computed from the same functions. */
const TYPICAL_AT_60K = scenarioCell(60_000, {});
const TYPICAL_AT_200K = scenarioCell(200_000, {});
const NONE_AT_100K = scenarioCell(100_000, BENEFIT_PACKAGES[0].overrides);
const RICH_AT_100K = scenarioCell(100_000, BENEFIT_PACKAGES[2].overrides);
const RICH_AT_60K = scenarioCell(60_000, BENEFIT_PACKAGES[2].overrides);

/* No-benefits sweep shape — the caption quotes these instead of hand-typed
   values (the curve is non-monotonic and crosses zero near the top). */
const NONE_SWEEP = markupSweep({ ...PAYTYPE_DEFAULTS, ...BENEFIT_PACKAGES[0].overrides });
const NONE_START = NONE_SWEEP[0];
const NONE_NEG_IDX = NONE_SWEEP.findIndex((p) => p.markupPct < 0);
const NONE_CROSS_RANGE =
  NONE_NEG_IDX > 0
    ? `${usdCompact(NONE_SWEEP[NONE_NEG_IDX - 1].salary)} and ${usdCompact(NONE_SWEEP[NONE_NEG_IDX].salary)}`
    : null;

export const metadata: Metadata = {
  title: '1099 vs W-2 Calculator (2025) — Real Take-Home Difference & Breakeven Rate',
  description:
    'Compare a 1099 contract against a W-2 salary with benefits: SE tax vs FICA, benefits at face value, unpaid PTO hours, and the exact breakeven hourly rate and markup — 2025 federal rules.',
  keywords: [
    '1099 vs w2',
    '1099 vs w2 calculator',
    'w2 vs contractor calculator',
    'self employment tax calculator',
    '1099 hourly rate calculator',
    'breakeven contract rate',
    'equivalent salary calculator',
    'misclassification',
    'contractor markup',
  ],
  alternates: { canonical: calc.href },
  openGraph: {
    title: '1099 vs W-2 Calculator (2025) — Real Take-Home Difference & Breakeven Rate',
    description:
      'What must a 1099 contract pay to beat your W-2 package? Full 2025 federal model: both FICA halves, QBI, benefits at face value, unpaid PTO — plus the breakeven markup and negotiation anchors.',
    url: `${siteConfig.url}${calc.href}`,
    type: 'website',
  },
};

export default function PayTypeCalculatorPage() {
  return (
    <>
      <AppJsonLd calc={calc} />
      <CalculatorPageShell calc={calc}>
        {/* Interactive tool */}
        <section id="calculator" aria-label="1099 vs W-2 calculator tool" className="scroll-mt-28">
          <PayTypeCalculator />
        </section>

        {/* Methodology */}
        <div className="border-t border-slate-200 pt-12 dark:border-white/[0.07]">
          <SectionShell
            id="methodology"
            eyebrow="Methodology"
            title="The model, stated exactly"
            accent={calc.accent}
            intro="Both pay types run through the same 2025 single-filer federal machinery. The comparison axis is total value kept per year — after-tax cash plus benefits at face — and the headline output is the contract rate that ties the job."
          >
            <MethodologyGrid
              formulas={[
                {
                  label: 'W-2: value kept',
                  expression: `value = salary − FICA_employee − brackets(salary − ${usd(PAYTYPE_CONSTANTS.stdDeduction, 0)}) + benefits`,
                  note: 'Only the employee half of FICA (6.2% to the wage base + 1.45% + 0.9% above $200k) reaches take-home. Benefits enter at face value: employer-paid premiums are tax-free and a 401(k) match is your own money.',
                },
                {
                  label: 'Contractor: SE tax',
                  expression: 'SE = 15.3% × min(92.35% × (revenue − expenses), $176,100) + 2.9% × rest + 0.9% × max(0, SE base − $200,000)',
                  note: 'Schedule SE plus Form 8959 Part III: the base is 92.35% of net business income; both FICA halves combined; the 0.9% Additional Medicare surcharge applies on the base above $200k — the same threshold the W-2 side applies to wages — and is NOT part of the deductible half (§164(f) covers §1401(a) only).',
                },
                {
                  label: 'Contractor: income tax',
                  expression: `tax = brackets(net − ½SE − SEHI − QBI − ${usd(PAYTYPE_CONSTANTS.stdDeduction, 0)})`,
                  note: 'SEHI is the self-employed health insurance deduction, capped at 92.35% × net − ½SE (§162(l)). QBI = 20% × (net − ½SE − SEHI) per §199A(c)(1), capped at 20% of taxable income before the deduction — the deduction most flat-markup rules forget.',
                },
                {
                  label: 'Billable hours',
                  expression: 'billable = 2,080 − 8 × PTO days',
                  note: 'The salary pays for a 2,080-hour year including vacation; the contract only sells the hours that remain. 15 PTO days leave 1,960 billable hours.',
                },
                {
                  label: 'Breakeven rate',
                  expression: 'solve R: value₁₀₉₉(R × billable hours) = value_W-2',
                  note: 'Found by bisection — value₁₀₉₉ rises monotonically with the rate, so the crossing is unique. The same bisection, run on the salary axis, yields the quote\'s equivalent W-2 salary.',
                },
                {
                  label: 'Required markup',
                  expression: 'markup = R* ÷ (salary ÷ 2,080) − 1',
                  note: 'The breakeven rate expressed as a premium over the salary\'s hourly equivalent — the number to quote from, before any risk margin.',
                },
              ]}
              assumptions={[
                'The same person works the same 2,080-hour year; only pay type, benefits, PTO and expenses differ.',
                `Tax-year 2025 federal parameters: $15,750 single standard deduction ($15,000 as originally issued by Rev. Proc. 2024-40, raised by the July 2025 budget act, P.L. 119-21 — bracket thresholds unchanged), $176,100 Social Security wage base, 0.9% Additional Medicare above $200k of wages; single filer.`,
                'Benefits are valued at face (employer-paid premiums are tax-free; a match is tax-deferred). The contractor buys the identical health plan and keeps the SEHI deduction.',
                'QBI applies to 1099 net business income (20%, capped); W-2 wages have no QBI. SSTB phase-outs above $197,300 are not modeled.',
                'Every non-PTO hour is assumed billable — bench, sales and admin time are priced by the Freelance Hourly Rate Calculator, not here.',
                'No state income tax, state disability or unemployment insurance, HSA interactions, or payroll-service fees on either side.',
              ]}
            />
          </SectionShell>
        </div>

        {/* Scenario analysis */}
        <SectionShell
          id="scenarios"
          eyebrow="Scenario analysis"
          title="What the required markup responds to"
          accent={calc.accent}
          intro="Computed at build time by the same functions that power the widget: the breakeven markup at six salary levels and three benefit packages. Every cell is the full federal model — SE tax, QBI, SEHI, PTO hours and expenses included."
        >
          <ScenarioPanel
            title="Breakeven markup over the W-2 hourly, by salary and benefits package"
            description="Each cell is how much a 1099 rate must exceed the salary's hourly equivalent to tie in total value kept. Higher = the W-2 package is harder to beat."
            columns={['W-2 salary', 'No benefits', 'Typical package', 'Rich package', 'Breakeven rate (typical)']}
            footnote={`Pattern 1 — the package drives the markup more than salary does: at $100k, stripping all benefits drops the requirement to ${pct(
              NONE_AT_100K.markup ?? 0,
              1,
            )} while a rich one lifts it to ${pct(RICH_AT_100K.markup ?? 0, 1)}. Pattern 2 — the requirement falls as salary rises, because fixed benefits are a shrinking share: ${pct(
              TYPICAL_AT_60K.markup ?? 0,
              1,
            )} at $60k down to ${pct(TYPICAL_AT_200K.markup ?? 0, 1)} at $200k. Pattern 3 — the folk 1.3–1.5× is a band whose edges both miss: at $60k under the rich package the requirement is ${pct(
              RICH_AT_60K.markup ?? 0,
              1,
            )} — past even 1.5× — while toward the top of the table it fades toward zero. Salary level and benefits package together set the number, which is why this tool computes it.`}
          >
            <tbody className="divide-y divide-slate-100 dark:divide-white/[0.06]">
              {SCENARIO_SALARIES.map((salary) => {
                const cells = BENEFIT_PACKAGES.map((p) => scenarioCell(salary, p.overrides));
                const typicalRate = cells[1].rate;
                return (
                  <tr key={salary}>
                    <th
                      scope="row"
                      className="readout font-semibold normal-case tracking-normal text-slate-900 dark:text-slate-100"
                    >
                      {usd(salary, 0)}
                    </th>
                    {cells.map((c, i) => (
                      <td key={i} className="text-right">
                        <span className="readout inline-block whitespace-nowrap rounded-full bg-slate-100 px-2 py-0.5 font-semibold text-slate-700 dark:bg-white/[0.05] dark:text-slate-300">
                          {c.markup === null ? '—' : `+${pct(c.markup, 1)}`}
                        </span>
                      </td>
                    ))}
                    <td className="text-right">
                      <span className="readout whitespace-nowrap font-medium text-slate-600 dark:text-slate-300">
                        {typicalRate === null ? '—' : `${usd(typicalRate)}/hr`}
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
              xLabel="W-2 salary"
              yLabel="Required markup (%)"
              xFormat={(n) => usdCompact(n)}
              yFormat={(n) => pct(n, 0)}
              height={300}
              yMinMode="auto"
              marker={{ x: 100000, label: '$100k example' }}
              caption={`The vertical spread between the lines is what a benefits package is really worth in your quoting rate. The typical and rich curves fall steadily as salary rises — fixed benefits are a shrinking share of a bigger package. The no-benefits floor behaves differently: it drifts down from ${pct(
                NONE_START.markupPct,
                1,
              )} at ${usdCompact(NONE_START.salary)}, wiggles around 2–3% through the $150–200k band, then crosses below zero between ${NONE_CROSS_RANGE} — past the Social Security wage base the contract's only payroll drag is Medicare (2.9% plus the 0.9% Additional Medicare surcharge above $200k of SE income) while the 20% QBI deduction keeps clawing back income tax, so at the very top a 1099 can match the pay at a slightly LOWER hourly. A negative markup there is the shape of the tax code, not an error.`}
            />
          </div>
        </SectionShell>

        {/* Deep-dive guide */}
        <div className="border-t border-slate-200 pt-12 dark:border-white/[0.07]">
          <section id="guide" aria-label="1099 vs W-2 in-depth guide" className="scroll-mt-28">
            <PayTypeArticle />
          </section>
        </div>

        <ProvenanceFooter
          sources={[
            {
              label: 'Federal parameters',
              detail:
                'Tax year 2025: standard deduction $15,750 for single filers ($15,000 as originally published in Rev. Proc. 2024-40, increased by OBBBA, P.L. 119-21, effective July 2025); Social Security wage base $176,100; Additional Medicare Tax 0.9% above $200,000 of wages (W-2) or of the 92.35% self-employment base (Form 8959 Part III) — modeled on both sides, and excluded from the deductible half of SE tax; Schedule SE base factor 92.35%; federal brackets 10%–37% as published for 2025.',
            },
            {
              label: 'Benefits valuation',
              detail:
                'Employer-paid health premiums, retirement match and other benefits enter at face value — premiums are excluded from taxable income under current law. Typical employer single-coverage premiums run roughly $7–9k/yr (KFF employer survey scale); the default uses $7,500.',
            },
            {
              label: 'Classification tests',
              detail:
                'IRS common-law categories (behavioral, financial, relationship); DOL wage-and-hour framework in flux — the 2024 six-factor rule was announced as non-enforced in May 2025 with rescission proposed, so verify the current federal rule; strict ABC tests apply in several states (CA, NJ, MA). Forms SS-8 and 8919 govern worker-side determinations; IRC Section 530 provides the business-side safe harbor.',
            },
            {
              label: 'Out of scope',
              detail:
                'State and local income taxes, state disability/unemployment, HSA interactions, SSTB QBI phase-outs above $197,300 of taxable income, non-billable bench time, and elective retirement deferrals.',
            },
          ]}
          disclaimer="This is an illustrative federal model, not tax or legal advice. Worker classification is a facts-and-circumstances legal determination — the calculator prices a contract against a salary; it cannot certify that a 1099 arrangement is lawful for your working relationship. Confirm rates, thresholds and state rules with a qualified professional."
        />
      </CalculatorPageShell>
    </>
  );
}

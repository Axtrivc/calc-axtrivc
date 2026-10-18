import type { Metadata } from 'next';
import CalculatorPageShell from '@/components/CalculatorPageShell';
import SeTaxCalculator from '@/components/calculators/SeTaxCalculator';
import SeTaxArticle from '@/components/content/SeTaxArticle';
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
  SE_TAX_CONSTANTS,
  computeSeTax,
  ficaOnWages,
  marginalFicaOnNextDollar,
  marginalSeTaxOnNextDollar,
  ssKinkNetProfit,
  wageBaseFor,
} from '@/lib/setax';
import { usd, usdCompact, pct } from '@/lib/format';

/**
 * Tool identity for this page. Registration in lib/site.ts happens in a later
 * integration step; until it does, this page is absent from the site index
 * and the WorkflowChain strip below renders the registered instruments
 * WITHOUT a "you are here" marker for this tool (it highlights by
 * slug === currentSlug against lib/site.ts's registry). Every other element —
 * hero, chapter bar, calculator, article, structured data — is complete.
 */
const calc: Calculator = {
  slug: 'self-employment-tax-calculator',
  href: '/self-employment-tax-calculator/',
  title: 'Self-Employment Tax Calculator',
  shortTitle: 'SE Tax',
  tagline: 'The exact SECA bill on your net profit — and what each extra dollar costs.',
  description:
    'Compute self-employment tax (SECA) on any net profit for tax years 2026 and 2025: the 92.35% base, the Social Security cap ($184,500 in 2026), the 0.9% Additional Medicare layer, W-2 wage coordination, and your true marginal rate per dollar.',
  icon: 'Landmark',
  category: 'Taxes',
  tags: [
    'self employment tax',
    'seca',
    'schedule se',
    'self employed',
    'additional medicare tax',
    'quarterly estimated taxes',
    'side hustle',
    'fica',
  ],
  accent: 'indigo',
  stage: 4,
  stageLabel: 'Compensate',
  dataBasis: 'Tax-year 2026 & 2025 federal parameters — Schedule SE, SS wage base $184,500/$176,100, Form 8959 thresholds',
  formulaSnapshot: 'SE = 15.3% × min(92.35% × net, SS cap) + 2.9% × rest',
};

/* Build-time reference numbers, from this page's own math library.
 * The analytical layer is computed for tax year 2026 (the current year);
 * the interactive tool above computes the same functions for 2025 too. */
const YEAR = 2026 as const;
const WAGE_BASE = wageBaseFor(YEAR); // $184,500
const KINK_SS_NET = ssKinkNetProfit(0, YEAR) as number; // $199,783.43 of net profit
const KINK_SS_ROW = Math.round(KINK_SS_NET);

/* Scenario grid 1: the full Schedule SE ledger at each profit level (single, no W-2). */
const SCENARIO_PROFITS = [30000, 50000, 80000, 100000, 150000, KINK_SS_ROW, 250000, 400000, 1000000];

/* Scenario grid 2: SE tax versus W-2 FICA on the same gross income. */
const COMPARISON_GROSS = [50000, 100000, 150000, WAGE_BASE, KINK_SS_ROW, 250000, 500000];

/* Chart band: wide enough to show every kink with room to breathe. */
const CHART_MAX = 600000;
const CHART_XS = Array.from({ length: 121 }, (_, i) => (CHART_MAX * i) / 120);

/* Chart 1 — effective SE rate on profit: flat 14.13% until the cap, then falling toward ~3.51%. */
const EFF_RATE_SERIES = [
  {
    label: `Effective SE tax rate on net profit (single, no W-2, ${YEAR})`,
    color: '#6366f1',
    points: CHART_XS.map((x) => ({ x, y: computeSeTax(x, 0, 'single', YEAR).effectiveRateOnNet })),
  },
];

/* Chart 2 — the true cost of the next $1: SE marginal vs both W-2 cuts. */
const MARGINAL_SERIES = [
  {
    label: 'Self-employed — marginal SE tax',
    color: '#6366f1',
    points: CHART_XS.map((x) => ({
      x,
      y: marginalSeTaxOnNextDollar(x, 0, 'single', YEAR).total * 100,
    })),
  },
  {
    label: 'W-2 — employee share withheld',
    color: '#0ea5e9',
    dashed: true,
    points: CHART_XS.map((x) => ({ x, y: marginalFicaOnNextDollar(x, 'single', YEAR).employee * 100 })),
  },
  {
    label: 'W-2 — both halves (employer cost)',
    color: '#10b981',
    dashed: true,
    points: CHART_XS.map((x) => ({ x, y: marginalFicaOnNextDollar(x, 'single', YEAR).combined * 100 })),
  },
];

export const metadata: Metadata = {
  title: 'Self-Employment Tax Calculator (2026) — SECA Rate, Schedule SE & FICA Comparison',
  description:
    'Compute 2026 self-employment tax (SECA) on any net profit — the 92.35% base, the $184,500 Social Security cap, the 0.9% Additional Medicare layer, quarterly estimates, and your true marginal rate per dollar. 2025 parameters selectable.',
  keywords: [
    'self employment tax calculator',
    'self employment tax 2026',
    'seca tax calculator',
    'schedule se',
    'self employed tax rate',
    'fica vs self employment tax',
    'additional medicare tax',
    'quarterly estimated taxes freelancer',
    'side hustle tax',
  ],
  alternates: { canonical: calc.href },
  openGraph: {
    title: 'Self-Employment Tax Calculator (2026) — SECA Rate, Schedule SE & FICA Comparison',
    description:
      'One instrument, one tax: the exact Schedule SE bill on your net profit, the three kinks in the curve, W-2 wage coordination, and the honest FICA comparison. 2026 federal rules, 2025 selectable.',
    url: `${siteConfig.url}${calc.href}`,
    type: 'website',
  },
};

export default function SeTaxCalculatorPage() {
  return (
    <>
      <AppJsonLd calc={calc} />
      <CalculatorPageShell calc={calc}>
        {/* Interactive tool */}
        <section id="calculator" aria-label="Self-employment tax calculator tool" className="scroll-mt-28">
          <SeTaxCalculator />
        </section>

        {/* Methodology */}
        <div className="border-t border-slate-200 pt-12 dark:border-white/[0.07]">
          <SectionShell
            id="methodology"
            eyebrow="Methodology"
            title="The model, stated exactly"
            accent={calc.accent}
            intro="Every number this page shows comes from Schedule SE and Form 8959 as they apply in tax years 2026 and 2025 — the same machinery an accountant would run, with each intermediate line exposed rather than hidden behind a single total."
          >
            <MethodologyGrid
              formulas={[
                {
                  label: 'SE tax base',
                  expression: 'base = 92.35% × net profit',
                  note: 'Schedule SE line 4a / §1402(a)(2). A flat statutory factor standing in for the employer-half FICA deduction a W-2 worker\'s company gets (1 − 7.65%). No SE tax at all when base < $400 — the floor sits at $433.13 of profit.',
                },
                {
                  label: 'SE tax, total',
                  expression: 'SE = 12.4% × min(base, room) + 2.9% × base + 0.9% × min(base, (wages + base − T)₊)',
                  note: `room = max(0, WB − min(wages, WB)) with WB = $184,500 (2026) / $176,100 (2025): W-2 social-security wages shrink the SE Social Security base (Schedule SE lines 8a–11). T = $200k single / $250k MFJ / $125k MFS — not inflation-indexed, identical both years; Medicare layers never cap.`,
                },
                {
                  label: 'Half-of-SE deduction',
                  expression: 'deduction = ½ × SE tax (0.9% layer included)',
                  note: '§164(f): an above-the-line income-tax adjustment (Schedule 1, line 15). Form 8959 line 25 confirms the Additional Medicare piece is half-deductible too. It reduces income tax — never the SE tax itself.',
                },
                {
                  label: 'W-2 FICA comparison',
                  expression: 'employee = 6.2% × min(w, WB) + 1.45% × w + 0.9% × (w − T)₊ · employer = same − 0.9%',
                  note: 'The pay-stub view (employee share) versus the true cost of employing someone (both halves). On identical gross income, SE tax under the cap beats both halves by exactly 7.65% × 15.3% = 1.17% of gross.',
                },
                {
                  label: 'Marginal cost per $1',
                  expression: 'dSE = 92.35% × (12.4% + 2.9% [+ 0.9%])',
                  note: '14.13¢ per dollar under the wage-base room; 2.68¢ once only Medicare applies; 3.51¢ where the 0.9% layer is live. Kinks at $433.13 (floor), $199,783.43 (SS cap, 2026; $190,687.60 in 2025) and $216,567.41 (0.9%, single) of net profit.',
                },
                {
                  label: 'Quarterly installment',
                  expression: 'installment = (SE tax + income tax) ÷ 4',
                  note: 'Form 1040-ES equal-installment default. The tool\'s figure is the SE-tax component only; safe harbors (90% of current year, or 100%/110% of prior year) set the legally required amount.',
                },
              ]}
              assumptions={[
                'Tax-year 2026 by default with 2025 selectable: the Social Security wage base is $184,500 in 2026 (SSA-announced taxable maximum) and $176,100 in 2025 — the only parameter that differs. The 0.9% thresholds ($200k/$250k/$125k), rates, 92.35% factor and $400 floor are statutorily fixed and identical both years.',
                'This instrument prices the SE tax layer alone — federal income tax, QBI, and state taxes interact with it but are deliberately out of scope.',
                'Any W-2 wages entered are treated as both social-security wages (capped at the year\'s wage base) and Medicare wages (uncapped) from a single employer.',
                'For married filing jointly, only the taxpayer\'s own wages are modeled: Form 8959 tests each spouse\'s own Medicare wages + SE income against the joint $250k threshold (§1401(b)(2)(B)(i)), and a spouse\'s wages never affect the taxpayer\'s Social Security wage-base room.',
                'The $400 net-earnings floor is modeled as the cliff the statute sets: at $400+ of net earnings the whole base is taxed, not just the excess.',
                'Employer withholding of the 0.9% layer technically starts at $200k of wages regardless of filing status; the tool applies the status threshold (real bills reconcile on Form 8959).',
                'Net losses, optional farm/fishing methods, statutory-employee and notary rules are not modeled.',
              ]}
            />
          </SectionShell>
        </div>

        {/* Scenario analysis */}
        <SectionShell
          id="scenarios"
          eyebrow="Scenario analysis"
          title="Every line of the ledger, at every income"
          accent={calc.accent}
          intro={`Computed at build time by the same pure functions that power the widget — single filer, no W-2 wages, tax year ${YEAR}. The tool above recomputes the same model for 2025 and for any wage/filing-status combination.`}
        >
          <ScenarioPanel
            title="The Schedule SE ledger by net profit"
            description="How the 92.35% base, the wage-base cap and the 0.9% layer carve up each dollar — and what the next dollar costs at that income."
            columns={[
              'Net profit',
              'SE base (92.35%)',
              'Social Security 12.4%',
              'Medicare 2.9%',
              'Addl Medicare 0.9%',
              'Total SE tax',
              '½ deduction',
              'Eff. rate',
              'Next $1',
            ]}
            footnote={`Tax year ${YEAR}. The ${usd(KINK_SS_ROW, 0)} row is the curve's bend: it is where 92.35% of profit reaches the ${usdCompact(
              WAGE_BASE,
            )} cap — ${usd(KINK_SS_NET - WAGE_BASE, 0)} higher than the commonly quoted number, because the cap binds on the base, not on profit. Past it, the effective rate keeps falling toward the Medicare-only asymptote (0.9235 × 3.8% = 3.51%) while the next-dollar cost drops from 14.13¢ to 2.68¢, then 3.51¢ above ${usd(216567, 0)} where the 0.9% layer turns on. For 2025, switch the year selector above: the cap drops to ${usdCompact(
              SE_TAX_CONSTANTS.ssWageBaseByYear[2025],
            )} and the bend to ${usd(ssKinkNetProfit(0, 2025) ?? 0, 0)}.`}
          >
            <tbody className="divide-y divide-slate-100 dark:divide-white/[0.06]">
              {SCENARIO_PROFITS.map((p) => {
                const r = computeSeTax(p, 0, 'single', YEAR);
                const m = marginalSeTaxOnNextDollar(p, 0, 'single', YEAR);
                const isKink = p === KINK_SS_ROW;
                return (
                  <tr key={p}>
                    <th
                      scope="row"
                      className="readout font-semibold normal-case tracking-normal text-slate-900 dark:text-slate-100"
                    >
                      {usd(p, 0)}
                      {isKink && <span className="text-indigo-600 dark:text-indigo-300"> · cap</span>}
                    </th>
                    <td className="readout text-right">{usd(r.base, 0)}</td>
                    <td className="readout text-right">{usd(r.ssPart, 0)}</td>
                    <td className="readout text-right">{usd(r.medicarePart, 0)}</td>
                    <td className="readout text-right">{usd(r.additionalPart, 0)}</td>
                    <td className="readout text-right font-semibold text-slate-900 dark:text-slate-100">
                      {usd(r.totalSeTax, 0)}
                    </td>
                    <td className="readout text-right">{usd(r.halfDeduction, 0)}</td>
                    <td className="readout text-right">{pct(r.effectiveRateOnNet, 2)}</td>
                    <td className="readout text-right">{(m.total * 100).toFixed(2)}¢</td>
                  </tr>
                );
              })}
            </tbody>
          </ScenarioPanel>

          <div className="mt-6">
            <ComparisonChart
              series={EFF_RATE_SERIES}
              xLabel="Net self-employment profit"
              yLabel="Effective SE rate"
              xFormat={(n) => usdCompact(n)}
              yFormat={(n) => pct(n, 1)}
              height={300}
              marker={{ x: KINK_SS_NET, label: 'SS cap → $199,783 net' }}
              caption={`Average, not marginal: the effective SE rate on profit holds at 14.13% until net profit reaches ${usd(KINK_SS_ROW, 0)} (${YEAR}), then declines toward a floor of 3.51% (0.9235 × 3.8%, the two Medicare layers) rather than toward zero — 7.02% at $600k. Past the cap, only the uncapped Medicare layers keep growing with income, so the average rate a high biller pays keeps falling toward that floor: a consultant billing $600k pays 7.02%, not the 14.13% of one billing $150k.`}
            />
          </div>

          <div className="mt-6">
            <ScenarioPanel
              title={`SE tax versus W-2 FICA on the same gross income (${YEAR})`}
              description="Single filer. The pay-stub view (employee share) against the true employer cost (both halves) — the honest benchmark for 'would a salaried job pay less payroll tax?'"
              columns={['Gross income', 'SE tax total', 'W-2 employee share', 'W-2 both halves', 'SE − both halves']}
              footnote="Negative (green) = the self-employed pay less than the full payroll cost of the same salaried income — always, at every income: while both sides sit under the cap the gap is exactly 1.17% of gross (7.65% × 15.3%, the 92.35% base haircut); above the caps it narrows to the Medicare-only difference of 0.22% and the uncapped 0.9% layer claws a little more back, but the SE side's own 0.9% is also haircut, so the gap never closes."
            >
              <tbody className="divide-y divide-slate-100 dark:divide-white/[0.06]">
                {COMPARISON_GROSS.map((g) => {
                  const se = computeSeTax(g, 0, 'single', YEAR);
                  const w2 = ficaOnWages(g, 'single', YEAR);
                  const delta = se.totalSeTax - w2.combinedCost;
                  return (
                    <tr key={g}>
                      <th
                        scope="row"
                        className="readout font-semibold normal-case tracking-normal text-slate-900 dark:text-slate-100"
                      >
                        {usd(g, 0)}
                        {g === KINK_SS_ROW && <span className="text-indigo-600 dark:text-indigo-300"> · SE cap</span>}
                        {g === WAGE_BASE && <span className="text-indigo-600 dark:text-indigo-300"> · W-2 cap</span>}
                      </th>
                      <td className="readout text-right">{usd(se.totalSeTax, 0)}</td>
                      <td className="readout text-right">{usd(w2.employeeShare, 0)}</td>
                      <td className="readout text-right">{usd(w2.combinedCost, 0)}</td>
                      <td className="text-right">
                        <span
                          className={`readout inline-block whitespace-nowrap rounded-full px-2 py-0.5 font-semibold ${
                            delta < -0.005
                              ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400'
                              : delta > 0.005
                                ? 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400'
                                : 'bg-slate-100 text-slate-600 dark:bg-white/[0.05] dark:text-slate-300'
                          }`}
                        >
                          {delta > 0 ? '+' : '−'}
                          {usd(Math.abs(delta), 0)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </ScenarioPanel>
          </div>

          <div className="mt-6">
            <ComparisonChart
              series={MARGINAL_SERIES}
              xLabel="Income (net profit / wages)"
              yLabel="Tax on the next $1"
              xFormat={(n) => usdCompact(n)}
              yFormat={(n) => pct(n, 1)}
              yMinMode="auto"
              height={300}
              marker={{ x: KINK_SS_NET, label: 'SE cap → $199,783' }}
              caption={`The true price of one more dollar (${YEAR}). The indigo SE line runs at 14.13% — below the 15.3% both-halves line because of the 92.35% base, but far above the 7.65% employees see withheld — and bends later (${usd(
                KINK_SS_ROW,
                0,
              )} vs ${usdCompact(WAGE_BASE)}), because the cap binds on the base. Above ${usd(216567, 0)} the SE line steps up to 3.51% (0.9% layer on), the W-2 employee line likewise steps up to 2.35% (from 1.45%), and the both-halves line to 3.8% (2.9% Medicare + the employee-only 0.9%). Each point is the differenced full model, not a stylized step function.`}
            />
          </div>
        </SectionShell>

        {/* Deep-dive guide */}
        <div className="border-t border-slate-200 pt-12 dark:border-white/[0.07]">
          <section id="guide" aria-label="Self-employment tax guide" className="scroll-mt-28">
            <SeTaxArticle />
          </section>
        </div>

        <WorkflowChain currentSlug={calc.slug} />

        <ProvenanceFooter
          sources={[
            {
              label: 'Federal parameters',
              detail:
                'Tax years 2026 & 2025: SE base factor 92.35%; 12.4% Social Security up to the wage base — $184,500 in 2026 (SSA-announced taxable maximum, ssa.gov/oact/cola) and $176,100 in 2025; 2.9% Medicare uncapped; 0.9% Additional Medicare above $200,000 single / $250,000 MFJ / $125,000 MFS (statutorily not inflation-indexed); $400 net-earnings floor.',
            },
            {
              label: 'Schedule SE mechanics',
              detail:
                'Wage-base coordination with W-2 social-security wages and the §164(f) one-half deduction follow Schedule SE lines 4a–14; the SE-side 0.9% follows §1401(b)(2) via Form 8959 (0.9% × min(base, the taxpayer\'s own wages + base over threshold)), with its deductible half on Form 8959 line 25. A spouse\'s wages are not part of the taxpayer\'s computation and are not modeled.',
            },
            {
              label: 'Out of scope',
              detail:
                "Federal income tax and QBI interactions, state taxes, statutory-employee and church-income rules, optional farm/fishing methods, net-loss years, spouse-side wages and withholding timing, and the S-corp election's salary/distribution split (covered by the S-Corp Salary Calculator).",
            },
          ]}
          disclaimer="This is an illustrative federal model, not tax advice. The 2026 wage base reflects SSA's announced taxable maximum and the 0.9% thresholds are statutorily fixed — confirm final IRS publications for the year you are modeling, plus your state's rules, with a qualified professional before relying on any number here."
        />
      </CalculatorPageShell>
    </>
  );
}

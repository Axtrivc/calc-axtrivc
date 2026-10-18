import type { Metadata } from 'next';
import CalculatorPageShell from '@/components/CalculatorPageShell';
import EstimatedTaxCalculator from '@/components/calculators/EstimatedTaxCalculator';
import EstimatedTaxArticle from '@/components/content/EstimatedTaxArticle';
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
import { computeEstimatedTax, safeHarborSweep, EST_CONSTANTS } from '@/lib/estimated';
import { usd, usdCompact } from '@/lib/format';

/* Tool identity — single source of truth: the suite catalog in lib/site.ts.
   The former hardcoded registration stub (pre-integration) matched this entry
   verbatim and has been removed so the hero, WorkflowChain and CommandPalette
   read one identity. */
const calc = calculators.find((c) => c.slug === 'quarterly-estimated-tax-calculator')!;

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

/* Build-time personas — same scenarios the interactive presets load. */
const SCENARIOS = [
  {
    name: 'Side hustle $60k + $9k withheld',
    inputs: { netSE: 60000, filingStatus: 'single' as const, w2Withholding: 9000, priorTax: 14200, priorAgiOver150k: false },
  },
  {
    name: 'Full-time freelancer $120k',
    inputs: { netSE: 120000, filingStatus: 'single' as const, w2Withholding: 0, priorTax: 22000, priorAgiOver150k: false },
  },
  {
    name: 'Married $180k, $6k spouse withholding',
    inputs: { netSE: 180000, filingStatus: 'mfj' as const, w2Withholding: 6000, priorTax: 31000, priorAgiOver150k: true },
  },
  {
    name: 'High earner $300k (AGI > $150k)',
    inputs: { netSE: 300000, filingStatus: 'single' as const, w2Withholding: 0, priorTax: 52000, priorAgiOver150k: true },
  },
  {
    name: 'First year $95k (no prior tax)',
    inputs: { netSE: 95000, filingStatus: 'single' as const, w2Withholding: 0, priorTax: 0, priorAgiOver150k: false },
  },
];

/* Chart series at the default scenario: which safe harbor binds, by income. */
const CHART_SWEEP = safeHarborSweep(
  { filingStatus: 'single', w2Withholding: 0, priorTax: 19500, priorAgiOver150k: false },
  20000,
  400000,
  39,
);

export const metadata: Metadata = {
  title: 'Quarterly Estimated Tax Calculator (1040-ES, 2025) — Safe Harbors & Installments',
  description:
    'Compute 2025 quarterly estimated taxes for self-employment income: SE tax, QBI-adjusted federal tax, the 90% / 100% / 110% safe harbors, a four-installment schedule, and an underpayment penalty estimate.',
  keywords: [
    'estimated tax calculator',
    '1040-es',
    'quarterly tax calculator',
    'safe harbor',
    'self employed taxes',
    'underpayment penalty',
    'form 2210',
    'irs quarterly payments',
  ],
  alternates: { canonical: calc.href },
  openGraph: {
    title: 'Quarterly Estimated Tax Calculator (1040-ES, 2025) — Safe Harbors & Installments',
    description:
      'How much per quarter to avoid the penalty: the three 1040-ES safe harbors priced exactly, a due-date installment schedule, withholding coverage, and the cost of skipping.',
    url: `${siteConfig.url}${calc.href}`,
    type: 'website',
  },
};

export default function QuarterlyEstimatedTaxPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(itemJsonLd) }}
      />
      <AppJsonLd calc={calc} />
      <CalculatorPageShell calc={calc}>
        {/* Interactive tool */}
        <section id="calculator" aria-label="Quarterly estimated tax calculator tool" className="scroll-mt-28">
          <EstimatedTaxCalculator />
        </section>

        {/* Methodology */}
        <div className="border-t border-slate-200 pt-12 dark:border-white/[0.07]">
          <SectionShell
            id="methodology"
            eyebrow="Methodology"
            title="The model, stated exactly"
            accent={calc.accent}
            intro="One walk down the 1040-ES worksheet: Schedule SE on your net profit, the standard deduction and §199A QBI, the brackets, then the §6654 safe-harbor comparison — nothing else touches the numbers."
          >
            <MethodologyGrid
              formulas={[
                {
                  label: 'Self-employment tax (Sch SE)',
                  expression: 'SE = 15.3% × min(92.35% × net, $176,100) + 2.9% × rest',
                  note: 'The base is 92.35% of net earnings (the 7.65% employee-equivalent haircut); 12.4% Social Security stops at the $176,100 wage base, 2.9% Medicare never stops. No SE tax below a $400 base; half of SE tax is an above-the-line deduction.',
                },
                {
                  label: 'Current-year income tax',
                  expression: 'tax = brackets(net − ½SE − QBI − std) where std = $15,750 / $31,500',
                  note: '2025 standard deduction per P.L. 119-21 §70103 (July 4, 2025, retroactive to 2025), which raised the $15,000/$30,000 Rev. Proc. 2024-40 had published for 2025. 2025 brackets: 10–37%, single breakpoints $11,925 … $626,350, MFJ $23,850 … $751,600.',
                },
                {
                  label: 'QBI deduction (§199A)',
                  expression: 'ded = min(20% × AGI × (1 − ap), 20% × (AGI − std));  ap = (TI−$197.3k)÷$50k, capped at 1',
                  note: 'Two limits stack. The 20%-of-taxable cap binds at mid incomes; above $197,300 single / $394,600 MFJ of pre-QBI taxable income the §199A(b)(2) W-2 wage / UBIA limitation phases in over $50,000/$100,000 — evaluated here at the model\'s world (no employees, UBIA $0), where it fully zeroes the deduction. A wage- or property-owning business deducts MORE than modeled; an SSTB inside the phase-in range LESS.',
                },
                {
                  label: 'Required annual payment (§6654(d))',
                  expression: 'required = min(priorTax × (100% or 110%), 90% × current tax)',
                  note: 'The 110% multiplier applies when prior-year AGI exceeded $150,000 — then the 100% line does not exist. Prior-year harbor requires a 12-month prior year and US citizen/resident status.',
                },
                {
                  label: 'Installments (regular method)',
                  expression: 'per quarter = max(0, required − withholding) ÷ 4',
                  note: 'Withholding (yours or a spouse\'s) counts toward the requirement and is deemed paid ratably across the four periods under §6654(g) — timing within the year does not matter.',
                },
                {
                  label: 'Penalty for skipping (ESTIMATE)',
                  expression: '≈ unpaid÷4 × 7% × (365 + 303 + 212 + 90) ÷ 365',
                  note: 'Assumes zero estimated payments, settlement on Apr 15, 2026, simple interest at the 7% rate the IRS charged every quarter of 2025. The real Form 2210 is also simple interest (IRM 20.1.3: computed like interest, NOT compounded daily) — it differs by re-pricing per period at quarterly rates and using actual payment dates. Labeled an estimate everywhere it appears.',
                },
              ]}
              assumptions={[
                'Tax year 2025 federal parameters; the standard deduction reflects P.L. 119-21 §70103 ($15,750 single / $31,500 MFJ, retroactively raised from Rev. Proc. 2024-40\'s $15,000/$30,000) — the suite\'s earlier tools price 2025 at $14,600/$29,200 (the 2024 tax-year amounts) and read higher at the same income.',
                'Income is net Schedule C profit only. The withholding input acts purely as a payment credit — the W-2 wages behind it never enter the tax computation, so for two-income households the 90% line understates the true requirement and the prior-year harbor is the safer target (flagged in the tool when withholding is entered).',
                'Filing statuses single and MFJ; no state estimated tax, no credits, no Form 8959 Additional Medicare Tax on SE income.',
                '§199A(b)(2) is modeled at the no-employee case (W-2 wages paid = $0, UBIA = $0): above $197,300/$394,600 of pre-QBI taxable income the deduction phases out over $50k/$100k to $0. Businesses paying W-2 wages or holding qualified property can deduct more than modeled (conservative); SSTBs in the phase-in range get less.',
                `Exemptions honored: no installments when current tax minus withholding is under $1,000 (§6654(e)(1)); no penalty at all when the prior year's tax was $0 with a 12-month prior year (§6654(e)(2)).`,
                `Installment dates are the published 2025 due dates — Q2 is Jun 16, 2025 because Jun 15 fell on a Sunday.`,
                'The penalty figure is a flat-rate simplification shown for magnitude only; Form 2210 governs the filed number.',
              ]}
            />
          </SectionShell>
        </div>

        {/* Scenario analysis */}
        <SectionShell
          id="scenarios"
          eyebrow="Scenario analysis"
          title="Five common situations, priced"
          accent={calc.accent}
          intro="Computed at build time by the same functions that power the widget. Every row is the full model — SE tax, QBI, brackets, safe-harbor election, withholding credit — for a persona you can load into the tool above."
        >
          <ScenarioPanel
            title="Required payments by persona (tax year 2025)"
            description="Prior harbor shows the applicable line (110% where prior AGI exceeded $150k). Per quarter is net of withholding and assumes the prior-year harbor is elected where lower."
            columns={['Scenario', 'Current tax', '90% line', 'Prior harbor', 'Required / yr', 'Per quarter']}
            footnote="Pattern 1 — rows 2–4 saw income rise versus last year, so the prior-year harbor binds and prepayments stop at last year's level; the balance rides to April 15 penalty-free (row 4's 90% line now reflects the §199A(b)(2) no-employee phase-out: its QBI deduction is $0 above $247.3k of pre-QBI taxable income). Pattern 2 — row 1 shows the model's limit: its 90% line taxes SE income only, so the wages behind that $9k of withholding are missing from the comparison — for two-income households the prior-year line is the safer harbor even when the SE-only 90% line reads lower. Row 5 is the first-year exemption: no prior-year tax means no penalty exposure at all — installments are zero even though the 90% line sits at $18,993."
          >
            <tbody className="divide-y divide-slate-100 dark:divide-white/[0.06]">
              {SCENARIOS.map((s) => {
                const r = computeEstimatedTax(s.inputs);
                const priorHarbor = s.inputs.priorAgiOver150k ? r.prior110 : r.prior100;
                return (
                  <tr key={s.name}>
                    <th scope="row" className="readout font-semibold normal-case tracking-normal text-slate-900 dark:text-slate-100">
                      {s.name}
                    </th>
                    <td className="text-right">
                      <span className="readout whitespace-nowrap text-slate-600 dark:text-slate-300">
                        {usd(r.currentTotalTax, 0)}
                      </span>
                    </td>
                    <td className="text-right">
                      <span className="readout whitespace-nowrap text-slate-600 dark:text-slate-300">
                        {usd(r.current90, 0)}
                      </span>
                    </td>
                    <td className="text-right">
                      <span
                        className={`readout whitespace-nowrap font-semibold ${
                          r.applicable === 'prior100' || r.applicable === 'prior110'
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-slate-500 dark:text-slate-400'
                        }`}
                      >
                        {priorHarbor === null ? '—' : usd(priorHarbor, 0)}
                      </span>
                    </td>
                    <td className="text-right">
                      <span className="readout whitespace-nowrap font-semibold text-slate-900 dark:text-slate-100">
                        {r.requiredAnnualPayment === 0 ? (
                          <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400">
                            $0 · exempt
                          </span>
                        ) : (
                          usd(r.requiredAnnualPayment, 0)
                        )}
                      </span>
                    </td>
                    <td className="text-right">
                      <span
                        className={`readout whitespace-nowrap font-semibold ${
                          r.perQuarter > 0
                            ? 'text-indigo-600 dark:text-indigo-300'
                            : 'text-emerald-600 dark:text-emerald-400'
                        }`}
                      >
                        {usd(r.perQuarter, 0)}
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
                  label: '90% of current-year tax (net)',
                  color: '#6366f1',
                  points: CHART_SWEEP.map((p) => ({ x: p.income, y: p.current90Net })),
                },
                {
                  label: 'Prior-year safe harbor (net)',
                  color: '#0ea5e9',
                  dashed: true,
                  points: CHART_SWEEP.map((p) => ({ x: p.income, y: p.priorNet ?? 0 })),
                },
              ]}
              xLabel="Net self-employment income"
              yLabel="Annual payment / yr"
              xFormat={(n) => usdCompact(n)}
              yFormat={(n) => usdCompact(n)}
              height={300}
              marker={{ x: 100000, label: '$100k example' }}
              caption="Single filer, no withholding, $19,500 prior-year tax at 100% — the default scenario. The required payment is the lower envelope: below the crossover (~$96k) the 90% line binds; above it the prior-year harbor flatlines at $19,500 no matter how much is earned — the interest-free deferral rising-income filers live on. The slope steepens above ~$227k as the §199A(b)(2) no-employee phase-out begins erasing the QBI deduction (fully $0 by ~$278k)."
            />
          </div>
        </SectionShell>

        {/* Deep-dive guide */}
        <div className="border-t border-slate-200 pt-12 dark:border-white/[0.07]">
          <section id="guide" aria-label="Quarterly estimated tax guide" className="scroll-mt-28">
            <EstimatedTaxArticle />
          </section>
        </div>

        <WorkflowChain currentSlug={calc.slug} />

        <ProvenanceFooter
          sources={[
            {
              label: '2025 federal parameters',
              detail:
                'Standard deduction $15,750 single / $31,500 MFJ per P.L. 119-21 §70103 (July 4, 2025, retroactive — it raised Rev. Proc. 2024-40\'s published 2025 figures of $15,000/$30,000); 2025 ordinary brackets 10–37% per Rev. Proc. 2024-40; Social Security wage base $176,100; QBI 20% under §199A.',
            },
            {
              label: 'Safe harbors & penalty mechanics',
              detail:
                'IRC §6654: required annual payment is the lesser of 90% of current-year tax or 100%/110% of prior-year tax (110% when prior AGI exceeded $150,000); $1,000 de-minimis exception; withholding deemed paid ratably under §6654(g). Underpayment rate 7% in every quarter of 2025 (IRS quarterly interest-rate releases).',
            },
            {
              label: 'Installment due dates',
              detail:
                'Tax-year 2025 installments due Apr 15, 2025; Jun 16, 2025 (Jun 15 was a Sunday); Sep 15, 2025; Jan 15, 2026 — per the IRS estimated-tax calendar. Penalty day counts to an Apr 15, 2026 settlement: 365 / 303 / 212 / 90.',
            },
            {
              label: 'Out of scope',
              detail:
                'State estimated taxes; Form 8959 Additional Medicare Tax on SE income; §6654(d)(3) installment-income ordering for partners; the annualized income installment method (Form 2210 Schedule AI — covered qualitatively in the guide); W-2 wages as income. §199A(b)(2) is priced only at the no-employee case (wages $0, UBIA $0) — wage-paying or property-owning businesses deduct more above the threshold, SSTBs less.',
            },
          ]}
          disclaimer="This is an illustrative federal model for tax year 2025, not tax advice. The penalty figure is a labeled estimate; your filed number is computed on Form 2210 at quarterly rates with your actual payment dates. Confirm thresholds, due dates, and state rules with a qualified professional before making payments."
        />
      </CalculatorPageShell>
    </>
  );
}

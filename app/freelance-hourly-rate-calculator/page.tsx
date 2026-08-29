import type { Metadata } from 'next';
import CalculatorPageShell from '@/components/CalculatorPageShell';
import FreelanceCalculator from '@/components/calculators/FreelanceCalculator';
import FreelanceArticle from '@/components/content/FreelanceArticle';
import {
  AppJsonLd,
  MethodologyGrid,
  ProvenanceFooter,
  ScenarioPanel,
  SectionShell,
  WorkflowChain,
} from '@/components/professional';
import { calculators, siteConfig } from '@/lib/site';
import { computeFreelanceRate } from '@/lib/freelance';
import { usd } from '@/lib/format';

const calc = calculators.find((c) => c.slug === 'freelance-hourly-rate-calculator')!;

/* Rate matrix levers: the two variables a freelancer actually controls are
   annual take-home target and weekly billable capacity. Baseline parameters
   are pinned (and disclosed below) so every cell is reproducible. */
const TAKE_HOME_TARGETS = [40_000, 60_000, 80_000, 100_000, 150_000];
const WEEKLY_HOURS = [15, 20, 25, 30];
const BASELINE = {
  businessExpenses: 12_000,
  taxRate: 30,
  vacationDays: 25,
};

export const metadata: Metadata = {
  title: 'Freelance Hourly Rate Calculator — Find Your Ideal Rate (2025)',
  description:
    'Calculate your ideal freelance hourly and day rate based on target annual income, business expenses, tax obligations, and billable work hours.',
  keywords: [
    'freelance hourly rate calculator',
    'freelance rate',
    'day rate calculator',
    'consulting rate',
    'how much to charge freelance',
    'self employed rate calculator',
    'contractor hourly rate',
  ],
  alternates: { canonical: calc.href },
  openGraph: {
    title: 'Freelance Hourly Rate Calculator — Find Your Ideal Rate (2025)',
    description:
      'Set a freelance rate that actually covers taxes, expenses, and PTO. Get your ideal hourly and day rate in seconds.',
    url: `${siteConfig.url}${calc.href}`,
    type: 'website',
  },
};

export default function FreelanceHourlyRatePage() {
  return (
    <>
      <AppJsonLd calc={calc} />
      <CalculatorPageShell calc={calc}>
        {/* Interactive tool */}
        <section id="calculator" aria-label="Freelance hourly rate calculator tool" className="scroll-mt-28">
          <FreelanceCalculator />
        </section>

        {/* Methodology */}
        <div className="border-t border-slate-200 dark:border-white/[0.08] pt-12 dark:border-white/[0.07]">
          <SectionShell
            id="methodology"
            eyebrow="Methodology"
            title="A billable rate is four costs stacked"
            accent={calc.accent}
            intro="The salary mindset prices time; this model prices outcomes. A sustainable rate must simultaneously cover the take-home you want, the business you run, the taxes you owe, and all the hours you can't bill."
          >
            <MethodologyGrid
              formulas={[
                {
                  label: 'Gross revenue required',
                  expression: 'gross = (take-home + expenses) ÷ (1 − tax %)',
                  note: 'Solves for pre-tax revenue where gross × (1 − tax) exactly funds both your pay and the business’s running costs.',
                },
                {
                  label: 'Annual billable capacity',
                  expression: 'hours = (52 − vacationDays ÷ 5) × weekly hours',
                  note: 'Five-day weeks: each PTO day consumes one fifth of a week. A month off at 25 billed hours/week deletes ~130 hours of supply.',
                },
                {
                  label: 'Rate derivation',
                  expression: 'hourly = gross ÷ hours · day = hourly × 8',
                  note: 'The day rate assumes eight working hours regardless of how many of them are billable — matching how clients buy blocks of attention.',
                },
                {
                  label: 'Utilization check',
                  expression: 'utilization = billable hours ÷ 2080',
                  note: 'Your billed share against a 40-hour FTE year. Below ~60%, capacity — not price — is usually the binding constraint worth attacking first.',
                },
              ]}
              assumptions={[
                'The tax input is your effective combined rate (self-employment + federal/state income) — you set it, and it scales the whole model linearly.',
                'Business expenses are pre-tax cash costs paid out of revenue before your draw.',
                'Vacation, holidays, admin, and sales time reduce capacity one-for-one; no seasonal smoothing is applied.',
                'Bad debt and slow payment are excluded — pair the output with deposit terms rather than padding the rate blindly.',
              ]}
            />
          </SectionShell>
        </div>

        {/* Scenario analysis */}
        <SectionShell
          id="scenarios"
          eyebrow="Scenario analysis"
          title="What capacity does to price"
          accent={calc.accent}
          intro={`Every cell below is computed by the same function as the widget above under one pinned baseline: ${usd(BASELINE.businessExpenses, 0)} annual business expenses, a ${BASELINE.taxRate}% effective combined tax rate, ${BASELINE.vacationDays} PTO days.`}
        >
          <ScenarioPanel
            title="Required hourly rate — take-home target × weekly billable hours"
            description="Read down any column to see what protecting fewer, better-scoped engagements demands of your rate."
            columns={['Target take-home', ...WEEKLY_HOURS.map((h) => `${h} h / wk`)]}
            footnote="The elasticity is the lesson: halving capacity from 30 to 15 weekly hours roughly doubles the required rate. Underpricing stems from comparing against salaried dollars instead of dividing a real cost stack by scarce billable hours."
          >
            <tbody className="divide-y divide-slate-100 dark:divide-white/[0.06]">
              {TAKE_HOME_TARGETS.map((target) => (
                <tr key={target}>
                  <th scope="row" className="readout font-semibold normal-case tracking-normal text-slate-900 dark:text-slate-100">
                    {usd(target, 0)}
                  </th>
                  {WEEKLY_HOURS.map((hrs) => {
                    const r = computeFreelanceRate({
                      targetTakeHome: target,
                      weeklyBillableHours: hrs,
                      ...BASELINE,
                    });
                    return (
                      <td key={hrs} className="text-right">
                        <span className="readout block whitespace-nowrap font-semibold text-slate-800 dark:text-slate-200">
                          {usd(r.hourlyRate, 0)}
                        </span>
                        <span className="readout block text-xs text-slate-400">
                          {Math.round(r.utilization)}% util.
                        </span>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </ScenarioPanel>
        </SectionShell>

        {/* Deep-dive guide */}
        <div className="border-t border-slate-200 dark:border-white/[0.08] pt-12 dark:border-white/[0.07]">
          <section id="guide" aria-label="Freelance pricing guide" className="scroll-mt-28">
            <FreelanceArticle />
          </section>
        </div>

        <WorkflowChain currentSlug={calc.slug} />

        <ProvenanceFooter
          sources={[
            {
              label: 'Model definition',
              detail:
                'This tool ships no statistics and no market estimates — the formulas above are the entire model, deterministic algebra over inputs you control.',
            },
            {
              label: 'Tax-rate selection',
              detail:
                'The effective combined rate varies materially by state, filing status, and deductions. Set it deliberately: oversetting it pads your rate, undersetting it quietly strips your take-home.',
            },
            {
              label: 'Day-rate convention',
              detail:
                'Day rates follow the standard consulting convention of 8 paid hours per day, including non-billable ones — never 8 × your unbilled hour count.',
            },
          ]}
          disclaimer="Outputs are planning-grade estimates for a solo independent operator, not financial or tax advice. Re-run the model whenever expenses, tax posture, or availability change materially."
        />
      </CalculatorPageShell>
    </>
  );
}

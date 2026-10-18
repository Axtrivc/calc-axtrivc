import type { Metadata } from 'next';
import CalculatorPageShell from '@/components/CalculatorPageShell';
import ComparisonChart from '@/components/ComparisonChart';
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
import { usd, usdCompact } from '@/lib/format';

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
/* Iso-line chart: same pinned baseline, take-home target on each curve,
   capacity sweeping 10–40 h/wk. Every point is computeFreelanceRate(). */
const ISO_LINE_TARGETS = [60_000, 90_000, 120_000];
const ISO_LINE_COLORS = ['#6366f1', '#10b981', '#f59e0b'];

export const metadata: Metadata = {
  title: 'Freelance Hourly Rate Calculator — Find Your Ideal Rate',
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
    title: 'Freelance Hourly Rate Calculator — Find Your Ideal Rate',
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
        <div className="border-t border-slate-200 pt-12 dark:border-white/[0.07]">
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
                  expression: 'gross = expenses + take-home ÷ (1 − tax %)',
                  note: 'Expenses are deductible pre-tax costs — paid out of revenue before your draw — so only the take-home is grossed up. The shortcut (take-home + expenses) ÷ (1 − tax) taxes your expenses too and overstates revenue by E·t/(1−t).',
                },
                {
                  label: 'Annual billable capacity',
                  expression: 'hours = (52 − vacationDays ÷ 5) × weekly hours',
                  note: 'Five-day weeks: each PTO day consumes one fifth of a week. At 25 billed hours/week a full 25-day allowance deletes 125 hours of supply; a calendar month off (~22 working days) deletes ~110.',
                },
                {
                  label: 'Rate derivation',
                  expression: 'hourly = gross ÷ hours · day = hourly × 8',
                  note: 'A quoting conversion, not a capacity claim: the hourly already amortizes your non-billable time, so a sold day is quoted at 8 × hourly — but it consumes 8 real hours of capacity. At 25 billed hours/week, one week holds about three day-rate days.',
                },
                {
                  label: 'Utilization check',
                  expression: 'utilization = billable hours ÷ 2080',
                  note: 'Your billed share against a 40-hour FTE year. Below ~60%, capacity — not price — is usually the binding constraint worth attacking first.',
                },
              ]}
              assumptions={[
                'The tax input is your effective combined rate (self-employment + federal/state income) — you set it, and it scales the required revenue through the gross-up.',
                'Business expenses are deductible pre-tax cash costs: they are added after grossing up your pay, never multiplied by the tax factor.',
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
            description="Read across any row (right to left) to see what protecting fewer, better-scoped engagements demands of your rate; read down a column to see how the rate scales with your income target at fixed capacity."
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
                        <span className="readout block text-xs text-slate-500 dark:text-slate-400">
                          {Math.round(r.utilization)}% util.
                        </span>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </ScenarioPanel>

          {/* Capacity × target iso-lines: the two-way scan behind the table.
              Each curve is one take-home target swept across weekly capacity
              under the pinned baseline; the dashed marker is the section's
              25 h/wk reference point. */}
          <div className="mt-6">
            <ComparisonChart
              series={ISO_LINE_TARGETS.map((target, i) => ({
                label: `${usd(target, 0)} take-home`,
                color: ISO_LINE_COLORS[i],
                points: Array.from({ length: 31 }, (_, k) => {
                  const h = 10 + k; // 10..40 h/wk
                  return {
                    x: h,
                    y: computeFreelanceRate({
                      targetTakeHome: target,
                      weeklyBillableHours: h,
                      ...BASELINE,
                    }).hourlyRate,
                  };
                }),
              }))}
              xLabel="Billable hours per week"
              yLabel="Required rate / hr"
              xFormat={(n) => `${n} h`}
              yFormat={(n) => usdCompact(n)}
              height={320}
              marker={{ x: 25, label: '25 h/wk' }}
              caption={`Same pinned baseline as the table (${usd(BASELINE.businessExpenses, 0)} expenses, ${BASELINE.taxRate}% tax, ${BASELINE.vacationDays} PTO days) — every curve is the model itself, swept. The hyperbola is the lesson: rate × hours is fixed by your cost stack, so halving capacity roughly doubles the rate.`}
            />
          </div>
        </SectionShell>

        {/* Deep-dive guide */}
        <div className="border-t border-slate-200 pt-12 dark:border-white/[0.07]">
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
                'The computation itself is deterministic algebra over inputs you control — no statistics enter any number this tool returns. The formulas above are the entire model.',
            },
            {
              label: 'Illustrative ranges',
              detail:
                'The guide below includes an illustrative rate-range table for orientation only. It is clearly labeled as such, is not collected market data, and plays no role in the calculation — calibrate against your own quotes and win rates.',
            },
            {
              label: 'Tax-rate selection',
              detail:
                'The effective combined rate varies materially by state, filing status, and deductions. Set it deliberately: oversetting it pads your rate, undersetting it quietly strips your take-home.',
            },
            {
              label: 'Day-rate convention',
              detail:
                'Day rate = hourly × 8 — a unit conversion for quoting, never a capacity statement. The hourly already carries your non-billable amortization, while a sold day consumes 8 full hours: at 25 billed hours/week your capacity is about three sold days, not five.',
            },
          ]}
          disclaimer="Outputs are planning-grade estimates for a solo independent operator, not financial or tax advice. Re-run the model whenever expenses, tax posture, or availability change materially."
        />
      </CalculatorPageShell>
    </>
  );
}

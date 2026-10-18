import type { Metadata } from 'next';
import CalculatorPageShell from '@/components/CalculatorPageShell';
import HomeOfficeCalculator from '@/components/calculators/HomeOfficeCalculator';
import HomeOfficeArticle from '@/components/content/HomeOfficeArticle';
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
  compareHomeOffice,
  officeAreaSweep,
  HOME_OFFICE_CONSTANTS,
  type HomeOfficeInputs,
} from '@/lib/homeoffice';
import { usd, numFmt } from '@/lib/format';

/**
 * Tool registration for this page — hard-coded here (Stage 5 · Sustain) while
 * the suite registry in lib/site.ts is wired up by the integration pass; the
 * shell only consumes these display fields.
 */
const calc: Calculator = {
  slug: 'home-office-deduction-calculator',
  href: '/home-office-deduction-calculator/',
  title: 'Home Office Deduction Calculator',
  shortTitle: 'Home Office',
  tagline: 'Simplified $5/sq ft vs actual expenses — which method wins in 2025?',
  description:
    'Compare the simplified home office deduction ($5 per square foot, 300 sq ft cap) against the actual-expense method — rent, utilities, insurance, repairs, depreciation. See the deduction, the tax saved at your marginal rate, and the office-size sensitivity chart. 2025 rules.',
  icon: 'Building2',
  category: 'Taxes',
  tags: [
    'home office deduction',
    'simplified method',
    'actual expense method',
    'form 8829',
    'schedule c',
    'self employed',
    'home business',
  ],
  accent: 'indigo',
  stage: 5,
  stageLabel: 'Sustain',
  dataBasis: 'IRS simplified option (Rev. Proc. 2013-13) & Pub 587 actual method, tax year 2025',
  formulaSnapshot: '$5 × sq ft (≤300) vs expenses × office %',
};

/* Build-time scenario grid: a 2,000 sq ft home with a 200 sq ft office (10%
   share) as the annual cost of running the home sweeps across the tie line. */
const SCENARIO_HOME = 2000;
const SCENARIO_OFFICE = 200;
const SCENARIO_COSTS = [8000, 12000, 16000, 20000, 24000, 30000, 36000];

function renterAtCost(cost: number): HomeOfficeInputs {
  return {
    homeSqFt: SCENARIO_HOME,
    officeSqFt: SCENARIO_OFFICE,
    tenure: 'rent',
    rent: cost,
    mortgageInterest: 0,
    propertyTax: 0,
    homeBasis: 0,
    utilities: 0,
    insurance: 0,
    repairs: 0,
  };
}

/* Chart series: both methods as the office grows, for a cheap and an
   expensive 2,000 sq ft home ($4.50 vs $13.50 per sq ft per year). */
const SWEEP_CHEAP = officeAreaSweep(renterAtCost(9000));
const SWEEP_COSTLY = officeAreaSweep(renterAtCost(27000));
const CHEAP_CROSS_SQFT = HOME_OFFICE_CONSTANTS.simplifiedMaxDeduction / (9000 / SCENARIO_HOME);

export const metadata: Metadata = {
  title: 'Home Office Deduction Calculator (2025) — Simplified vs Actual Method',
  description:
    'Compare the simplified home office deduction ($5/sq ft, 300 sq ft cap) against the actual-expense method — rent, utilities, insurance, repairs, depreciation. See the deduction, the tax saved at your marginal rate, and the office-size sensitivity — 2025 rules.',
  keywords: [
    'home office deduction calculator',
    'simplified method home office',
    'actual expense method',
    'form 8829',
    'home office tax deduction 2025',
    'schedule c deduction',
    'self employed home office',
  ],
  alternates: { canonical: calc.href },
  openGraph: {
    title: 'Home Office Deduction Calculator (2025) — Simplified vs Actual Method',
    description:
      'Which method wins at your numbers? Simplified $5/sq ft vs actual expenses with depreciation — full comparison, marginal-rate tax savings, and the cost-per-square-foot tie line.',
    url: `${siteConfig.url}${calc.href}`,
    type: 'website',
  },
};

export default function HomeOfficeCalculatorPage() {
  return (
    <>
      <AppJsonLd calc={calc} />
      <CalculatorPageShell calc={calc}>
        {/* Interactive tool */}
        <section id="calculator" aria-label="Home office deduction calculator tool" className="scroll-mt-28">
          <HomeOfficeCalculator />
        </section>

        {/* Methodology */}
        <div className="border-t border-slate-200 pt-12 dark:border-white/[0.07]">
          <SectionShell
            id="methodology"
            eyebrow="Methodology"
            title="The model, stated exactly"
            accent={calc.accent}
            intro="Both methods price the same qualified space with different arithmetic. Everything below is 2025 federal law: the simplified option as fixed by Rev. Proc. 2013-13, the actual method per Pub 587 and Form 8829."
          >
            <MethodologyGrid
              formulas={[
                {
                  label: 'Simplified option',
                  expression: 'deduction = $5 × min(office sq ft, 300)',
                  note: `A statutory shortcut: linear to 300 sq ft, then flat at ${usd(HOME_OFFICE_CONSTANTS.simplifiedMaxDeduction, 0)}/yr forever. No depreciation, no expense allocation, no carryover of anything the gross-income limit clips.`,
                },
                {
                  label: 'Actual: business share',
                  expression: 'share = office sq ft ÷ home sq ft  (capped at 100%)',
                  note: 'The whole actual method hangs on this ratio of finished areas. An office at least as large as the home is flagged and capped — that is a data error, not a deduction strategy.',
                },
                {
                  label: 'Actual: deduction',
                  expression: 'deduction = share × (housing + utilities + insurance + repairs + depreciation)',
                  note: 'Housing = annual rent for renters; mortgage interest + property taxes for owners. Whole-home expenses are prorated by the share — only work performed on the office itself would be 100% deductible.',
                },
                {
                  label: 'Depreciation (owners only)',
                  expression: 'dep = home basis excluding land × 1/39 × share',
                  note: 'The office share of a home is 39-year nonresidential real property: straight-line, mid-month convention — 2.5641% per full year (Pub 946 Table A-7a). The first year is month-prorated and runs lower. Each actual-method year of depreciation is recaptured at sale (up to 25%); simplified years depreciate nothing.',
                },
                {
                  label: 'Tax saved, Schedule C filer',
                  expression: 'S = 0.9235×15.3%×D + r×(D − 0.9235×15.3%×D ÷ 2)',
                  note: 'The deduction cuts both income tax (r×D) and self-employment tax (92.35%×15.3% per dollar of net SE earnings). The ÷2 clawback: half of the SE tax saved was itself an income-tax deduction, which now shrinks. Income-tax-only filers get simply r×D.',
                },
                {
                  label: 'The tie line',
                  expression: 'methods tie ⇔ home cost per sq ft = $5  (breakeven = 5 × home sq ft)',
                  note: 'Within 300 sq ft the methods differ only in rate per square foot ($5 vs your cost/sq ft), so one number decides them. Below $5 simplified wins up to the cap; the actual method retakes the lead where share×cost catches the flat $1,500, at 1,500 ÷ (cost/sq ft) sq ft.',
                },
              ]}
              assumptions={[
                'Self-employed (Schedule C) filer — W-2 employees cannot claim a home office for 2025 under the TCJA suspension of unreimbursed employee expenses.',
                'The space is assumed to pass the regular-and-exclusive-use test; the tool prices a space you assert qualifies.',
                'The gross-income limitation is not applied: in reality both methods stop at business gross income minus other expenses. Simplified loses the excess permanently; the actual method carries forward disallowed operating expenses and depreciation only (Form 8829, Part IV) — limited mortgage interest and property taxes return to Schedule A for itemizers instead.',
                'Depreciation uses the full-year 1/39 rate; a home placed in service this year deducts a month-prorated, smaller amount.',
                'SE-tax savings assume 2025 self-employment earnings below the $176,100 Social Security base; above it the marginal SE layer is 2.9%, not 15.3%.',
                'The marginal income-tax rate is user-supplied. For §199A/QBI filers below the phase-out, each $1 of deduction reduces qualified business income by $1, shrinking the §199A deduction itself by up to 20¢ — an effective rate near 80% of bracket.',
                'Exactly one method per tax year; the election is switchable annually but never both at once. Federal only — no state conformity is modeled.',
              ]}
            />
          </SectionShell>
        </div>

        {/* Scenario analysis */}
        <SectionShell
          id="scenarios"
          eyebrow="Scenario analysis"
          title="Where each method wins"
          accent={calc.accent}
          intro="Computed at build time by the same functions that power the widget: a 2,000 sq ft home with a 200 sq ft office (10% share), as the annual cost of running the home sweeps across the tie line."
        >
          <ScenarioPanel
            title="Deduction by annual home running cost — 200 sq ft office in a 2,000 sq ft home"
            description="Renter case, tax savings shown at a 24% marginal income-tax rate. Positive (green) = the actual method deducts more; negative (red) = the simplified option wins."
            columns={['Home cost / yr', 'Per sq ft', 'Simplified', 'Actual', 'Winner', 'Tax edge @24%']}
            footnote={`Pattern 1 — the tie line sits exactly at $5.00/sq ft: ${usd(5 * SCENARIO_HOME, 0)}/yr of running cost for a ${numFmt(SCENARIO_HOME)} sq ft home ($5 × home sq ft). Pattern 2 — every dollar of home cost above it lands ×10% in the actual column while the simplified column never moves: at ${usd(36000, 0)}/yr the actual method deducts ${usd(3600, 0)} — more than double the statutory ceiling. Owners shift the actual column up further still: depreciation alone adds 2.564% of the ex-land basis × share every year.`}
          >
            <tbody className="divide-y divide-slate-100 dark:divide-white/[0.06]">
              {SCENARIO_COSTS.map((cost) => {
                const cmp = compareHomeOffice(renterAtCost(cost), 24, false);
                const actualWins = cmp.winner === 'actual';
                return (
                  <tr key={cost}>
                    <th scope="row" className="readout font-semibold normal-case tracking-normal text-slate-900 dark:text-slate-100">
                      {usd(cost, 0)}
                    </th>
                    <td className="text-right">
                      <span className="readout whitespace-nowrap font-medium text-slate-600 dark:text-slate-300">
                        {usd(cost / SCENARIO_HOME, 2)}
                      </span>
                    </td>
                    <td className="text-right">
                      <span className="readout whitespace-nowrap font-medium text-slate-600 dark:text-slate-300">
                        {usd(cmp.simplified.deduction, 0)}
                      </span>
                    </td>
                    <td className="text-right">
                      <span className="readout whitespace-nowrap font-medium text-slate-600 dark:text-slate-300">
                        {usd(cmp.actual.deduction, 0)}
                      </span>
                    </td>
                    <td className="text-right">
                      <span
                        className={`readout inline-block whitespace-nowrap rounded-full px-2 py-0.5 font-semibold ${
                          actualWins
                            ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400'
                            : cmp.winner === 'simplified'
                              ? 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400'
                              : 'bg-slate-100 text-slate-600 dark:bg-white/[0.05] dark:text-slate-300'
                        }`}
                      >
                        {actualWins ? 'Actual' : cmp.winner === 'simplified' ? 'Simplified' : 'Tie'}
                      </span>
                    </td>
                    <td className="text-right">
                      <span
                        className={`readout whitespace-nowrap font-semibold ${
                          actualWins
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : cmp.winner === 'simplified'
                              ? 'text-rose-600 dark:text-rose-400'
                              : 'text-slate-500 dark:text-slate-400'
                        }`}
                      >
                        {cmp.winner === 'tie' ? '—' : `${actualWins ? '+' : '−'}${usd(Math.abs(cmp.savingDelta), 0)}`}
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
                  label: `Simplified method ($5/sq ft, flat ${usd(HOME_OFFICE_CONSTANTS.simplifiedMaxDeduction, 0)} past 300)`,
                  color: '#0ea5e9',
                  points: SWEEP_CHEAP.map((s) => ({ x: s.sqft, y: s.simplifiedDeduction })),
                },
                {
                  label: `Actual — cheap home ($9,000/yr = $4.50/sq ft)`,
                  color: '#f59e0b',
                  dashed: true,
                  points: SWEEP_CHEAP.map((s) => ({ x: s.sqft, y: s.actualDeduction })),
                },
                {
                  label: 'Actual — expensive home ($27,000/yr = $13.50/sq ft)',
                  color: '#6366f1',
                  points: SWEEP_COSTLY.map((s) => ({ x: s.sqft, y: s.actualDeduction })),
                },
              ]}
              xLabel="Office area (sq ft)"
              yLabel="Deduction / yr"
              xFormat={(n) => numFmt(n)}
              yFormat={(n) => usd(n, 0)}
              height={300}
              marker={{ x: HOME_OFFICE_CONSTANTS.simplifiedMaxSqFt, label: '300 sq ft cap' }}
              caption={`Same 2,000 sq ft home, two price tags. The cheap home's actual line ($4.50/sq ft) runs under the simplified line until 300 sq ft — then the simplified line goes flat at ${usd(HOME_OFFICE_CONSTANTS.simplifiedMaxDeduction, 0)} and actual catches it at ≈${numFmt(CHEAP_CROSS_SQFT, 0)} sq ft (${usd(HOME_OFFICE_CONSTANTS.simplifiedMaxDeduction, 0)} ÷ $4.50). The expensive home leads from the first square foot because $13.50 > $5. Every point is the full model recomputed, not a linear approximation.`}
            />
          </div>
        </SectionShell>

        {/* Deep-dive guide */}
        <div className="border-t border-slate-200 pt-12 dark:border-white/[0.07]">
          <section id="guide" aria-label="Home office deduction guide" className="scroll-mt-28">
            <HomeOfficeArticle />
          </section>
        </div>

        <WorkflowChain currentSlug={calc.slug} />

        <ProvenanceFooter
          sources={[
            {
              label: 'Simplified option',
              detail:
                'IRS simplified option for the home office deduction (Rev. Proc. 2013-13), unchanged for tax year 2025: $5 per square foot of qualifying business use, 300 sq ft maximum, $1,500 annual ceiling; no depreciation and no carryover of gross-income-limited amounts.',
            },
            {
              label: 'Actual method & depreciation',
              detail:
                'Pub 587 (2025) / Form 8829 mechanics: business share × indirect home expenses, owners adding depreciation per Pub 946 Table A-7a — 39-year nonresidential real property, straight-line, mid-month convention, 2.5641% per full year on the ex-land basis.',
            },
            {
              label: 'SE-tax interaction',
              detail:
                'For Schedule C filers the deduction reduces net self-employment earnings: modeled as 92.35% × 15.3% per dollar below the $176,100 Social Security wage base (2025), net of the half-SE-tax deduction clawback. Recapture at sale: unrecaptured §1250 gain, up to 25%.',
            },
            {
              label: 'Out of scope',
              detail:
                'The gross-income limitation and carryforwards are stated, not applied; QBI interplay (each $1 of deduction cuts qualified business income by $1, so the §199A deduction shrinks by up to 20¢); first-year depreciation proration; the Schedule A interaction of the mortgage-interest/property-tax slice (genuinely new for standard-deduction filers, and the property-tax portion escapes the $10,000 SALT cap for itemizers); accountable-plan mechanics for S-corp owner-employees; W-2 employee use (suspended through 2025); state conformity.',
            },
          ]}
          disclaimer="This is an illustrative federal model for tax year 2025, not tax advice. The regular-and-exclusive-use qualification is a facts-and-circumstances legal test this tool cannot evaluate — it prices a space you assert qualifies. Confirm method eligibility, gross-income limits, depreciation basis, and your state's rules with a qualified professional before filing."
        />
      </CalculatorPageShell>
    </>
  );
}

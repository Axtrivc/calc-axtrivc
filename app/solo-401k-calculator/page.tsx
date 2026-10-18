import type { Metadata } from 'next';
import CalculatorPageShell from '@/components/CalculatorPageShell';
import RetirementCalculator from '@/components/calculators/RetirementCalculator';
import RetirementArticle from '@/components/content/RetirementArticle';
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
  deferralLimitFor,
  incomeToMaxSep,
  incomeToMaxSolo,
  RETIREMENT_CONSTANTS,
  sepCapacity,
  solo401kCapacity,
  type BusinessMode,
} from '@/lib/retirement';
import { usd, usdCompact, numFmt } from '@/lib/format';

/**
 * Registration in lib/site.ts is handled by the suite's integration pass — the
 * page carries its own metadata object (typed against the same contract) so it
 * is fully renderable before that step.
 */
const calc: Calculator = {
  slug: 'solo-401k-calculator',
  href: '/solo-401k-calculator/',
  title: 'Solo 401(k) vs SEP-IRA Calculator',
  shortTitle: 'Solo 401(k)',
  tagline: 'How much each plan can legally hold in 2025 — side by side.',
  description:
    'Compare 2025 Solo 401(k) and SEP-IRA contribution limits and tax savings for self-employed and S-corp owners: employee deferral, employer 25% vs the 20% self-employed equivalent, age catch-ups, and the $70,000 cap.',
  icon: 'Landmark',
  category: 'Taxes',
  tags: [
    'solo 401k',
    'sep ira',
    'retirement calculator',
    'contribution limit',
    'self employed retirement',
    'catch-up contribution',
    'roth 401k',
    'tax deferral',
  ],
  accent: 'indigo',
  stage: 4,
  stageLabel: 'Compensate',
  dataBasis: 'Tax-year 2025 IRS limits (Notice 2024-80) & Pub 560 self-employed rate table',
  formulaSnapshot: 'solo 401(k) = deferral + min(25% comp, $70k) · sep = min(25% comp, $70k)',
};

/* Build-time helpers: max capacity of each plan at a given income & age. */
function soloMax(mode: BusinessMode, income: number, age: number): number {
  return solo401kCapacity({ mode, income, age, plannedDeferral: deferralLimitFor(age) }).total;
}

const SCENARIO_PROFITS = [31_400, 50_000, 100_000, 150_000, 200_000, 250_000, 300_000, 400_000];
const SCENARIO_WAGES = [50_000, 80_000, 100_000, 150_000, 200_000, 280_000];

/* Chart series: contribution capacity across the sole-prop income band. */
const CHART_INCOMES = Array.from({ length: 48 }, (_, i) => 30_000 + (470_000 * i) / 47);
const CHART_SERIES = [
  {
    label: 'Solo 401(k) max · age 40',
    color: '#6366f1',
    points: CHART_INCOMES.map((x) => ({ x, y: soloMax('sole-prop', x, 40) })),
  },
  {
    label: 'Solo 401(k) max · age 62 (enhanced catch-up)',
    color: '#f59e0b',
    dashed: true,
    points: CHART_INCOMES.map((x) => ({ x, y: soloMax('sole-prop', x, 62) })),
  },
  {
    label: 'SEP-IRA max',
    color: '#0ea5e9',
    points: CHART_INCOMES.map((x) => ({ x, y: sepCapacity('sole-prop', x).contribution })),
  },
];

const SOLO_CAP_40 = incomeToMaxSolo('sole-prop', 40);
const SOLO_CAP_62 = incomeToMaxSolo('sole-prop', 62);
const SEP_CAP = incomeToMaxSep('sole-prop');

export const metadata: Metadata = {
  title: 'Solo 401(k) vs SEP-IRA Calculator (2025) — Contribution Limits & Tax Savings',
  description:
    'Compare Solo 401(k) and SEP-IRA contribution limits for 2025: the $23,500 employee deferral, 25% employer contribution (20% self-employed equivalent), age-50 and 60–63 catch-ups, the $70,000 cap, and the tax each plan defers.',
  keywords: [
    'solo 401k calculator',
    'sep ira calculator',
    'solo 401k vs sep ira',
    'contribution limit 2025',
    'self employed retirement',
    'catch up contribution',
    'roth solo 401k',
    'employer contribution 25',
  ],
  alternates: { canonical: calc.href },
  openGraph: {
    title: 'Solo 401(k) vs SEP-IRA Calculator (2025) — Contribution Limits & Tax Savings',
    description:
      'How much can each plan legally hold? Employee deferral, employer 25% vs 20% self-employed equivalent, catch-ups, and the $70,000 ceiling — computed, not quoted.',
    url: `${siteConfig.url}${calc.href}`,
    type: 'website',
  },
};

export default function RetirementCalculatorPage() {
  // ItemPage structured data (the BreadcrumbList lives in CalculatorPageShell).
  const itemJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemPage',
    name: calc.title,
    description: calc.description,
    url: `${siteConfig.url}${calc.href}`,
    mainEntity: {
      '@type': 'WebApplication',
      name: calc.title,
      applicationCategory: 'FinanceApplication',
      url: `${siteConfig.url}${calc.href}`,
    },
  };

  return (
    <>
      <AppJsonLd calc={calc} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(itemJsonLd) }}
      />
      <CalculatorPageShell calc={calc}>
        {/* Interactive tool */}
        <section id="calculator" aria-label="Solo 401(k) vs SEP-IRA calculator tool" className="scroll-mt-28">
          <RetirementCalculator />
        </section>

        {/* Methodology */}
        <div className="border-t border-slate-200 pt-12 dark:border-white/[0.07]">
          <SectionShell
            id="methodology"
            eyebrow="Methodology"
            title="The limit stack, stated exactly"
            accent={calc.accent}
            intro="Both plans are built from the same 2025 federal machinery — a deferral layer that only a 401(k) has, an employer layer keyed to compensation, and a shared $70,000 ceiling. The only structural difference between the two instruments is the first layer."
          >
            <MethodologyGrid
              formulas={[
                {
                  label: 'Self-employment tax',
                  expression: 'SE = 15.3% × min(92.35% × profit, $176,100) + 2.9% × rest',
                  note: 'Schedule SE via the exact engine from lib/tax.ts (LLC vs C-Corp tool) — one suite, one baseline. Contributions never change this number.',
                },
                {
                  label: 'Sole-prop plan base',
                  expression: 'base = net profit − ½ × SE tax',
                  note: 'Publication 560 Deduction Worksheet line 3: the ½-SE deduction is fixed before contributions, so the base is not circular.',
                },
                {
                  label: 'Employer contribution',
                  expression:
                    'employer = min(25% × W-2 [S-corp] | 20% × base [sole prop], $70,000 − deferral, W-2 − deferral [S-corp] | ½ × (base − deferral) [sole prop])',
                  note: '25% is the statutory plan rate; 20% is its self-employed equivalent (25%/1.25, Pub 560 Rate Table) because the contribution shrinks its own base. Trailing caps: the §415(c) headroom, then 100% of pay (S-corp) or the Pub 560 Deduction Worksheet step 12 — the employer deduction may not exceed ½ of net earnings after deferrals (sole prop), which binds below ≈$42k of profit.',
                },
                {
                  label: 'Employee deferral (Solo 401(k) only)',
                  expression:
                    'deferral = min(planned, $23,500, comp) + min(catch-up, planned − $23,500, comp − deferral − employer)',
                  note: 'Catch-up: +$7,500 at 50+, +$11,250 at 60–63 (SECURE 2.0 §109, 2025). Every term is capped by compensation — you cannot defer wages you did not pay yourself — and catch-ups are further limited to net earnings remaining after the other plan deductions (worksheet steps 16–18).',
                },
                {
                  label: '§415(c) ceiling',
                  expression: 'annual additions ≤ $70,000 (catch-up deferrals excluded)',
                  note: 'The $70,000 cap counts deferral + employer only. A 62-year-old can therefore reach $70,000 + $11,250 = $81,250 in 2025.',
                },
                {
                  label: 'SEP-IRA',
                  expression: 'SEP = min(25% × W-2 | 20% × base, $70,000)',
                  note: 'One lever only: no deferral, no catch-up at any age (a Roth SEP is permitted since SECURE 2.0 §601 but rarely offered by custodians). Its engine matches the Solo 401(k) employer side; only the 401(k)\u2019s deferral-linked worksheet cap can pull its employer share below the SEP\u2019s at low income.',
                },
                {
                  label: 'Deduction value',
                  expression: 'tax deferred = marginal rate × pre-tax contribution',
                  note: 'Income tax only, at the bracket you enter — never self-employment tax, and never state tax in this model.',
                },
              ]}
              assumptions={[
                'Single owner, no employees. Hiring W-2 staff voids the comparison: a SEP must cover eligible staff (21+, 3 of 5 years, $750 of 2025 pay) and a 401(k) stops being "solo".',
                'Tax-year 2025 limits: $23,500 deferral, $7,500 catch-up (50+), $11,250 enhanced catch-up (60–63), $70,000 §415(c) and SEP caps.',
                'Sole-prop employer share follows the Pub 560 deduction worksheet (20% of profit − ½ SE); S-corp is a true 25% of W-2 wages. Distributions never count as plan compensation.',
                'Elective deferrals are capped at 100% of pay. In S-corp mode, employer + deferral may not exceed wages; in sole-prop mode the Pub 560 worksheet caps the employer deduction at ½ of net earnings after deferrals, and catch-ups at the net earnings remaining after other plan deductions — the limits that bind at low incomes.',
                `The §401(a)(17) compensation cap (${usd(RETIREMENT_CONSTANTS.compensationCap, 0)} for 2025), state tax, defined-benefit plans, and the 2026 Roth catch-up mandate are not modeled.`,
                '"Tax saved" is a one-year deferral estimate at the entered marginal rate — not a lifetime projection.',
              ]}
            />
          </SectionShell>
        </div>

        {/* Scenario analysis */}
        <SectionShell
          id="scenarios"
          eyebrow="Scenario analysis"
          title="Where the plans diverge, and where they merge"
          accent={calc.accent}
          intro="Computed at build time by the same functions that power the widget — maximum capacity assumes the owner defers the full age-based limit. Every cell is the complete limit stack, not a percentage shortcut."
        >
          <ScenarioPanel
            title="Maximum annual contribution by Schedule C profit"
            description="Sole-proprietor mode. The two Solo columns differ only by catch-up ($0 at 40, $11,250 at 62 — the worksheet clawback trims the difference at the lowest row); the SEP column is flat by law."
            columns={['Net profit', 'Solo 401(k) · age 40', 'Solo 401(k) · age 62', 'SEP-IRA', 'Solo edge @40']}
            footnote={`The lines run parallel through the middle band — identical employer engines — then flatten in order: the Solo 401(k) reaches ${usd(
              RETIREMENT_CONSTANTS.totalAdditionsLimit,
              0,
            )} near ${SOLO_CAP_40 === null ? '—' : usd(SOLO_CAP_40, 0)} of profit (age 40; ${SOLO_CAP_62 === null ? '—' : usd(SOLO_CAP_62, 0)} at 62), while the SEP keeps climbing to ${usd(
              RETIREMENT_CONSTANTS.sepLimit,
              0,
            )} at ${SEP_CAP === null ? '—' : usd(SEP_CAP, 0)}. Above that, capacity is a tie and only catch-ups or Roth/loan features separate the plans.`}
          >
            <tbody className="divide-y divide-slate-100 dark:divide-white/[0.06]">
              {SCENARIO_PROFITS.map((profit) => {
                const s40 = soloMax('sole-prop', profit, 40);
                const s62 = soloMax('sole-prop', profit, 62);
                const sep = sepCapacity('sole-prop', profit).contribution;
                const edge = s40 - sep;
                return (
                  <tr key={profit}>
                    <th scope="row" className="readout font-semibold normal-case tracking-normal text-slate-900 dark:text-slate-100">
                      {usd(profit, 0)}
                    </th>
                    <td className="text-right">
                      <span className="readout whitespace-nowrap font-semibold text-indigo-700 dark:text-indigo-300">
                        {usd(s40, 0)}
                      </span>
                    </td>
                    <td className="text-right">
                      <span className="readout whitespace-nowrap font-semibold text-amber-700 dark:text-amber-300">
                        {usd(s62, 0)}
                      </span>
                    </td>
                    <td className="text-right">
                      <span className="readout whitespace-nowrap font-semibold text-sky-700 dark:text-sky-300">
                        {usd(sep, 0)}
                      </span>
                    </td>
                    <td className="text-right">
                      <span
                        className={`readout inline-block whitespace-nowrap rounded-full px-2 py-0.5 font-semibold ${
                          edge > 500
                            ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400'
                            : 'bg-slate-100 text-slate-600 dark:bg-white/[0.05] dark:text-slate-300'
                        }`}
                      >
                        {edge > 500 ? `+${usd(edge, 0)}` : 'tie'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </ScenarioPanel>

          <div className="mt-6">
            <ScenarioPanel
              title="The S-Corp case: capacity follows the W-2, not the profit"
              description="S-corp owner-employee mode, age 45, deferring the maximum. The business may earn anything — only the W-2 line feeds either plan."
              columns={['W-2 wages', 'Solo 401(k) · age 45', 'SEP-IRA', 'Solo edge']}
              footnote="Employer columns are identical by construction — 25% of wages either way — so the whole gap is the flat deferral bucket. The edge stays at the $23,500 limit until wages reach $186,000 (where 25% × wages exhausts the Solo 401(k)'s remaining $46,500 of §415(c) room); from there the SEP keeps climbing until it too caps at $280,000 of wages, and the comparison collapses to a tie."
            >
              <tbody className="divide-y divide-slate-100 dark:divide-white/[0.06]">
                {SCENARIO_WAGES.map((wages) => {
                  const solo = soloMax('scorp', wages, 45);
                  const sep = sepCapacity('scorp', wages).contribution;
                  const edge = solo - sep;
                  return (
                    <tr key={wages}>
                      <th scope="row" className="readout font-semibold normal-case tracking-normal text-slate-900 dark:text-slate-100">
                        {usd(wages, 0)}
                      </th>
                      <td className="text-right">
                        <span className="readout whitespace-nowrap font-semibold text-indigo-700 dark:text-indigo-300">
                          {usd(solo, 0)}
                        </span>
                      </td>
                      <td className="text-right">
                        <span className="readout whitespace-nowrap font-semibold text-sky-700 dark:text-sky-300">
                          {usd(sep, 0)}
                        </span>
                      </td>
                      <td className="text-right">
                      <span
                          className={`readout inline-block whitespace-nowrap rounded-full px-2 py-0.5 font-semibold ${
                            edge > 500
                              ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400'
                              : 'bg-slate-100 text-slate-600 dark:bg-white/[0.05] dark:text-slate-300'
                          }`}
                        >
                          {edge > 500 ? `+${usd(edge, 0)}` : 'tie'}
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
              series={CHART_SERIES}
              xLabel="Schedule C net profit"
              yLabel="Max annual contribution"
              xFormat={(n) => usdCompact(n)}
              yFormat={(n) => usdCompact(n)}
              height={320}
              marker={
                SOLO_CAP_40 !== null
                  ? { x: SOLO_CAP_40, label: 'Solo 401(k) caps' }
                  : undefined
              }
              caption={`Capacity curves, sole-proprietor mode, maximum deferral assumed. The dashed age-62 line rides ${usd(
                RETIREMENT_CONSTANTS.enhancedCatchUpLimit,
                0,
              )} higher (the 60–63 catch-up) and flattens at ${usd(
                RETIREMENT_CONSTANTS.totalAdditionsLimit + RETIREMENT_CONSTANTS.enhancedCatchUpLimit,
                0,
              )}; both SEP and the age-40 Solo flatten at ${usd(
                RETIREMENT_CONSTANTS.totalAdditionsLimit,
                0,
              )}. Below roughly ${numFmt(42_000)} of profit the Pub 560 self-employed worksheet visibly bites — the employer deduction is capped at ½ of net earnings after deferrals, clipping the Solo 401(k) lines relative to the full deferral + 20% stack that takes over above it.`}
            />
          </div>
        </SectionShell>

        {/* Deep-dive guide */}
        <div className="border-t border-slate-200 pt-12 dark:border-white/[0.07]">
          <section id="guide" aria-label="Solo 401(k) vs SEP-IRA guide" className="scroll-mt-28">
            <RetirementArticle />
          </section>
        </div>

        <WorkflowChain currentSlug={calc.slug} />

        <ProvenanceFooter
          sources={[
            {
              label: '2025 federal limits',
              detail:
                'IRS Notice 2024-80 COLA: elective deferral $23,500; age-50 catch-up $7,500; SECURE 2.0 §109 enhanced catch-up $11,250 (ages 60–63); §415(c) annual additions $70,000; SEP contribution cap $70,000.',
            },
            {
              label: 'Self-employed geometry',
              detail:
                'Publication 560 Deduction Worksheet & Rate Table: the 25% plan rate equals a 20% deduction rate applied to (net profit − ½ SE tax); the worksheet also caps the employer deduction at ½ of net earnings after elective deferrals (step 12) and limits catch-ups to the net earnings remaining after other plan deductions (steps 16–18). Schedule SE itself is computed by the shared engine in lib/tax.ts (92.35% base, $176,100 Social Security wage base).',
            },
            {
              label: 'Out of scope',
              detail: `State income tax, the §401(a)(17) compensation cap (${usd(
                RETIREMENT_CONSTANTS.compensationCap,
                0,
              )} for 2025 — at the self-employed 20% rate it exactly meets the $70,000 cap, and on W-2 pay it binds only above $280,000 of wages), defined-benefit / cash-balance plans, the 2026 Roth catch-up mandate, employee-coverage and nondiscrimination rules, and custodian pricing.`,
            },
          ]}
          disclaimer="This is an illustrative federal model for a single owner with no employees — not tax, legal, or investment advice. Contribution limits are 2025 values and change annually; a Solo 401(k) must generally be established by December 31 to credit deferrals. Confirm current-year limits and your custodian's plan document with a qualified professional."
        />
      </CalculatorPageShell>
    </>
  );
}

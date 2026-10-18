import type { Metadata } from 'next';
import CalculatorPageShell from '@/components/CalculatorPageShell';
import MileageCalculator from '@/components/calculators/MileageCalculator';
import MileageArticle from '@/components/content/MileageArticle';
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
  boundaryScans,
  compareMileage,
  mileageSweep,
  neutralMileage,
  MILEAGE_CONSTANTS_2025,
  type MileageInputs,
} from '@/lib/mileage';
import { usd, numFmt } from '@/lib/format';

/**
 * Tool registration for this page — hard-coded here (Stage 5 · Sustain) while
 * the suite registry in lib/site.ts is wired up by the integration pass; the
 * shell only consumes these display fields.
 */
const calc: Calculator = {
  slug: 'mileage-deduction-calculator',
  href: '/mileage-deduction-calculator/',
  title: 'Mileage Deduction Calculator',
  shortTitle: 'Mileage',
  tagline: 'Standard 70¢/mile vs actual costs — and the neutral mileage where they tie.',
  description:
    'Compare the 2025 standard mileage rate (70¢/mile, IRS Notice 2025-5) against the actual-expense method — depreciation, fuel, insurance, maintenance, registration, times your business-use share. See both deductions, the crossover mileage, and the mileage sensitivity chart.',
  icon: 'TrendingUp',
  category: 'Taxes',
  tags: [
    'mileage deduction',
    'standard mileage rate',
    'actual expense method',
    'business miles',
    'vehicle deduction',
    'mileage log',
    'self employed',
    'irs mileage rate 2025',
  ],
  accent: 'indigo',
  stage: 5,
  stageLabel: 'Sustain',
  dataBasis: 'IRS Notice 2025-5 (2025 standard mileage rate, 70¢/mi) & Pub 463 actual-expense method',
  formulaSnapshot: '$0.70 × business mi vs share × vehicle costs',
};

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

/* The default profile shared by the widget, the scenario grid and the chart:
   9,000 business miles, 65% business share, $9,600/yr of vehicle cost. */
const PROFILE: MileageInputs = {
  businessMiles: 9000,
  depreciation: 3600,
  fuelEnergy: 2600,
  insurance: 1900,
  maintenance: 1200,
  registration: 300,
  businessSharePct: 65,
};
const SHARE = PROFILE.businessSharePct / 100;
const MILES = PROFILE.businessMiles;

/* Build-time scenario grid: the vehicle's annual running cost sweeps across
   the tie while miles and share stay put. The tie cost is $6,300 ÷ 65% =
   $9,692 — between the $9,000 and $10,000 rows. */
const SCENARIO_COSTS = [4000, 6000, 8000, 9000, 10000, 12000, 15000, 18000, 24000];

/* Chart series: both methods as business mileage grows, default costs. */
const SWEEP = mileageSweep(PROFILE, 20000, 41);
const NEUTRAL = neutralMileage(PROFILE);
/* Decision-boundary flips, computed from the engine (never hand-typed). */
const SCANS = boundaryScans(PROFILE);

export const metadata: Metadata = {
  title: 'Mileage Deduction Calculator (2025) — Standard Rate vs Actual Expenses',
  description:
    'Compare the 2025 standard mileage rate (70¢ per mile) against the actual-expense method: depreciation, fuel, insurance, maintenance and registration times your business-use share. Both deductions, the neutral mileage where they tie, and the mileage sensitivity chart.',
  keywords: [
    'mileage deduction calculator',
    'standard mileage rate 2025',
    'irs mileage rate',
    'actual expense method',
    'business mileage',
    'vehicle tax deduction',
    'mileage log',
    'self employed car deduction',
  ],
  alternates: { canonical: calc.href },
  openGraph: {
    title: 'Mileage Deduction Calculator (2025) — Standard Rate vs Actual Expenses',
    description:
      '70¢ per mile or a share of real costs? Both columns priced exactly, the crossover mileage that separates them, and the record rules that keep either one alive.',
    url: `${siteConfig.url}${calc.href}`,
    type: 'website',
  },
};

export default function MileageCalculatorPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(itemJsonLd) }}
      />
      <AppJsonLd calc={calc} />
      <CalculatorPageShell calc={calc}>
        {/* Interactive tool */}
        <section id="calculator" aria-label="Mileage deduction calculator tool" className="scroll-mt-28">
          <MileageCalculator />
        </section>

        {/* Methodology */}
        <div className="border-t border-slate-200 pt-12 dark:border-white/[0.07]">
          <SectionShell
            id="methodology"
            eyebrow="Methodology"
            title="The model, stated exactly"
            accent={calc.accent}
            intro="Both columns price the same qualifying miles with different arithmetic. Everything below is 2025 federal practice: the standard rate as fixed by IRS Notice 2025-5, the actual method per Pub 463."
          >
            <MethodologyGrid
              formulas={[
                {
                  label: 'Standard mileage rate',
                  expression: 'deduction = $0.70 × business miles',
                  note: `The 2025 optional rate (Notice 2025-5, announced Dec 2024 via IR-2024-312), up from ${usd(MILEAGE_CONSTANTS_2025.standardRate2024PerMile, 2)} in 2024. It bundles fuel, maintenance, insurance, registration and depreciation — of it ${usd(MILEAGE_CONSTANTS_2025.depreciationComponentPerMile, 2)}/mile is depreciation, so a standard-rate year allows no separate MACRS/§179/bonus on the vehicle and reduces its basis mile by mile.`,
                },
                {
                  label: 'Actual-expense method',
                  expression: 'deduction = business share × (depreciation + fuel + insurance + maintenance + registration)',
                  note: 'Pub 463: the year\'s real operating costs, prorated by the share of the vehicle\'s use that is business. Parking and tolls are NOT inside either formula — they are separately 100% deductible under both methods.',
                },
                {
                  label: 'Neutral mileage (the crossover)',
                  expression: 'm* = share × total cost ÷ $0.70',
                  note: 'The standard line has slope 70¢; the actual line is flat. Below m* the actual method deducts more, above it the rate pulls away forever. The engine returns both the closed form and the first whole mile at which its winner flips (the winner comparison carries a $0.50 tie tolerance).',
                },
                {
                  label: 'Effective rate per mile',
                  expression: 'actual rate = share × total cost ÷ business miles',
                  note: 'The one-number summary: set it against the flat $0.70. Above 70¢ the actual method wins this year; below it, the standard rate does. Rate-invariant at any bracket, because both deductions scale identically with the marginal rate.',
                },
                {
                  label: 'Tax saved, Schedule C filer',
                  expression: 'S = 0.9235×15.3%×D + r×(D − 0.9235×15.3%×D ÷ 2)',
                  note: 'The deduction cuts both income tax (r×D) and self-employment tax (92.35%×15.3% per dollar of net SE earnings below the $176,100 SS base). The ÷2 clawback: half of the SE tax saved was itself an income-tax deduction, which now shrinks. Income-tax-only filers get simply r×D.',
                },
                {
                  label: 'Commuting boundary',
                  expression: 'business miles = qualifying trips only (home ↔ regular office excluded)',
                  note: 'Commuting is personal under either method. Trips between work locations count; with a qualifying principal-place home office, home → other work locations count too (that qualification is priced by the Home Office tool, not here).',
                },
              ]}
              assumptions={[
                'Tax year 2025, US federal only. Standard rate $0.70/mile with a $0.33/mile depreciation component (IRS Notice 2025-5); the rate is re-announced every December.',
                'Exactly one method per vehicle per tax year — the tool prices both columns and reports which deducts more; it never files both.',
                'Business miles are qualifying miles after the commuting exclusion; the tool trusts the entered count and discloses the classification rules.',
                'Parking and tolls (100% deductible regardless of method) and the business share of vehicle-loan interest (an actual-method line) are excluded from both columns.',
                'The business-use share is user-supplied — usually business miles ÷ total miles; the tool surfaces the implied total mileage so a share that disagrees with the odometer shows itself.',
                'The actual method consumes the year\'s depreciation allowance as an input: §280F luxury-automobile caps, lease inclusion amounts and FAVR allowances are not applied.',
                'SE-tax savings assume 2025 self-employment earnings below the $176,100 Social Security base; above it the marginal SE layer is 2.9%, not 15.3%.',
                'Vehicle expenses are ordinary §162 costs with no home-office-style gross-income cap — either method can create or deepen a Schedule C loss. The downstream at-risk/passive-loss rules and the §179 business-income limit inside the actual method are stated, not computed; so is the §199A/QBI interplay (each $1 of deduction shrinks QBI by $1, trimming the §199A deduction by up to 20¢).',
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
          intro="Computed at build time by the same functions that power the widget: 9,000 business miles at a 65% business share, as the vehicle's annual running cost sweeps across the tie line."
        >
          <ScenarioPanel
            title="Deduction by annual vehicle running cost — 9,000 business miles, 65% share"
            description="The standard column never moves (it ignores costs); every dollar of running cost lands ×65% in the actual column. Positive (green) = the actual method deducts more; negative (red) = the standard rate wins. Tax savings at a 24% marginal rate including the SE layer."
            columns={['Vehicle cost / yr', 'Actual @65%', 'Standard @9,000 mi', 'Winner', 'Neutral mileage']}
            footnote={`Pattern 1 — the tie sits exactly where 65% × cost = ${usd(MILES * MILEAGE_CONSTANTS_2025.standardRatePerMile, 0)}: a running cost of ${usd((MILES * MILEAGE_CONSTANTS_2025.standardRatePerMile) / SHARE, 0)}/yr, between the $9,000 and $10,000 rows (the engine's $0.50 tolerance moves the strict flip to ${usd(SCANS.costFlip ?? 0, 0)}). Pattern 2 — the neutral mileage column moves one-for-one with cost: each extra $1,000/yr of running cost pushes the crossover ${numFmt(Math.round((1000 * SHARE) / MILEAGE_CONSTANTS_2025.standardRatePerMile))} miles further out. Pattern 3 — past the tie, the actual method's lead grows ×65¢ per cost dollar while the standard column stands still, so expensive vehicles can win by four figures at these miles.`}
          >
            <tbody className="divide-y divide-slate-100 dark:divide-white/[0.06]">
              {SCENARIO_COSTS.map((cost) => {
                const inputs: MileageInputs = {
                  ...PROFILE,
                  depreciation: cost,
                  fuelEnergy: 0,
                  insurance: 0,
                  maintenance: 0,
                  registration: 0,
                };
                const cmp = compareMileage(inputs, 24, true);
                const actualWins = cmp.winner === 'actual';
                const neutral = neutralMileage(inputs);
                return (
                  <tr key={cost}>
                    <th scope="row" className="readout font-semibold normal-case tracking-normal text-slate-900 dark:text-slate-100">
                      {usd(cost, 0)}
                    </th>
                    <td className="text-right">
                      <span className="readout whitespace-nowrap font-medium text-slate-600 dark:text-slate-300">
                        {usd(cmp.actual.deduction, 0)}
                      </span>
                    </td>
                    <td className="text-right">
                      <span className="readout whitespace-nowrap font-medium text-slate-600 dark:text-slate-300">
                        {usd(cmp.standard.deduction, 0)}
                      </span>
                    </td>
                    <td className="text-right">
                      <span
                        className={`readout inline-block whitespace-nowrap rounded-full px-2 py-0.5 font-semibold ${
                          actualWins
                            ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400'
                            : cmp.winner === 'standard'
                              ? 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400'
                              : 'bg-slate-100 text-slate-600 dark:bg-white/[0.05] dark:text-slate-300'
                        }`}
                      >
                        {actualWins ? 'Actual' : cmp.winner === 'standard' ? 'Standard' : 'Tie'}
                      </span>
                    </td>
                    <td className="text-right">
                      <span className="readout whitespace-nowrap font-medium text-slate-600 dark:text-slate-300">
                        {neutral.exactMiles !== null ? `${numFmt(Math.round(neutral.exactMiles))} mi` : '—'}
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
                  label: `Standard rate (${usd(MILEAGE_CONSTANTS_2025.standardRatePerMile, 2)}/mi × business miles)`,
                  color: '#0ea5e9',
                  points: SWEEP.map((s) => ({ x: s.miles, y: s.standardDeduction })),
                },
                {
                  label: `Actual method (65% × ${usd(9600, 0)} — flat)`,
                  color: '#6366f1',
                  points: SWEEP.map((s) => ({ x: s.miles, y: s.actualDeduction })),
                },
              ]}
              xLabel="Business miles / yr"
              yLabel="Deduction / yr"
              xFormat={(n) => numFmt(n)}
              yFormat={(n) => usd(n, 0)}
              height={300}
              marker={
                NEUTRAL.exactMiles !== null
                  ? { x: NEUTRAL.exactMiles, label: `neutral ≈ ${numFmt(Math.round(NEUTRAL.exactMiles))} mi` }
                  : undefined
              }
              caption={`The standard line climbs at ${usd(MILEAGE_CONSTANTS_2025.standardRatePerMile, 2)} per business mile; the actual line is flat at 65% of ${usd(9600, 0)} — vehicle costs do not care how far you drive. They cross at the neutral mileage ≈${numFmt(Math.round(NEUTRAL.exactMiles ?? 0))} mi: left of it the actual method leads, right of it every additional business mile pays ${usd(MILEAGE_CONSTANTS_2025.standardRatePerMile, 2)} while the actual side stands still. Every point is the full model recomputed, not a linear approximation.`}
            />
          </div>
        </SectionShell>

        {/* Deep-dive guide */}
        <div className="border-t border-slate-200 pt-12 dark:border-white/[0.07]">
          <section id="guide" aria-label="Mileage deduction guide" className="scroll-mt-28">
            <MileageArticle />
          </section>
        </div>

        <WorkflowChain currentSlug={calc.slug} />

        <ProvenanceFooter
          sources={[
            {
              label: 'Standard mileage rate',
              detail:
                'Tax year 2025: 70¢/mile for business use, of which 33¢/mile is the depreciation component — IRS Notice 2025-5, announced December 2024 (news release IR-2024-312); 2024 ran 67¢ (IR-2023-239). The rate bundles gas, oil, repairs, tires, insurance, license, registration and depreciation, and is re-announced each December.',
            },
            {
              label: 'Actual method & eligibility fences',
              detail:
                'Pub 463 mechanics: business-use share × annual operating costs; parking and tolls separately 100% deductible; §274(d) adequate-records substantiation for listed property; the five-or-more-vehicles fleet bar, the lease-term lock for standard-rate lessees, and the first-year election that keeps (or forever closes) the standard rate after actual + accelerated depreciation.',
            },
            {
              label: 'Switching & basis recovery',
              detail:
                'Standard-rate years reduce the vehicle\'s adjusted basis by the depreciation component (33¢/mile for 2025, per Notice 2025-5) — the amount a later switch to actual, or a sale, must account for. A first standard-rate year preserves the option to switch to actual later with straight-line depreciation only.',
            },
            {
              label: 'SE-tax interaction',
              detail:
                'For Schedule C filers the deduction reduces net self-employment earnings: modeled as 92.35% × 15.3% per dollar below the $176,100 Social Security wage base (2025), net of the half-SE-tax deduction clawback — the same shape as the Home Office instrument.',
            },
            {
              label: 'Next year\u2019s rates',
              detail:
                'Tax year 2026 is already published: 72.5¢/mile for January–June (news release IR-2025-128), raised mid-year to 76¢ for July–December via Internal Revenue Bulletin 2026-29 (IRB 2026-29) — the first mid-year change since 2022; earlier mid-year changes came in 2011 and 2005. This tool stays pinned to 2025\u2019s 70¢; the neutral mileage moves inversely with the rate.',
            },
            {
              label: 'Out of scope',
              detail:
                '§280F luxury-automobile depreciation caps, lease inclusion amounts, FAVR allowances, the business share of vehicle-loan interest, the §179 business-income limit and its carryover, at-risk/passive-loss treatment of Schedule C losses, §199A interplay, and state mileage rules.',
            },
          ]}
          disclaimer="This is an illustrative federal model for tax year 2025, not tax advice. The classification of miles as business (including the commuting exclusion and the home-office exception) is a facts-and-circumstances determination this tool cannot audit — it prices the count you enter. Confirm the current-year rate, method eligibility, and your state's rules with a qualified professional before filing."
        />
      </CalculatorPageShell>
    </>
  );
}

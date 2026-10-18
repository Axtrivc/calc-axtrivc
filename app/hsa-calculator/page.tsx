import type { Metadata } from 'next';
import CalculatorPageShell from '@/components/CalculatorPageShell';
import HsaCalculator from '@/components/calculators/HsaCalculator';
import HsaArticle from '@/components/content/HsaArticle';
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
import { compareHsa, hsaHorizonSweep, hsaLimitFor, HSA_CONSTANTS } from '@/lib/hsa';
import { usd, usdCompact, pct } from '@/lib/format';

/**
 * Registration in lib/site.ts is handled by the suite's integration pass — the
 * page carries its own metadata object (typed against the same contract) so it
 * is fully renderable before that step. Stage 4, "Compensate yourself": the
 * HSA sits with the salary and retirement-plan instruments.
 */
const calc: Calculator = {
  slug: 'hsa-calculator',
  href: '/hsa-calculator/',
  title: 'HSA Triple Tax Advantage Calculator',
  shortTitle: 'HSA Advantage',
  tagline: 'Deduct it, grow it tax-free, spend it tax-free — quantified against a taxable account.',
  description:
    'Quantify the triple tax advantage of a Health Savings Account: the 2025 limits ($4,300 / $8,550 + $1,000 at 55+), the deduction shield, tax-free compounding vs a taxable twin, the 20% non-qualified withdrawal penalty, and three usage strategies side by side.',
  icon: 'Landmark',
  category: 'Taxes',
  tags: [
    'hsa',
    'hsa calculator',
    'health savings account',
    'triple tax advantage',
    'hdhp',
    'hsa vs taxable account',
    'hsa contribution limit 2025',
    'hsa investment growth',
    'save receipts strategy',
    'stealth retirement account',
  ],
  accent: 'emerald',
  stage: 4,
  stageLabel: 'Compensate',
  dataBasis: 'Tax-year 2025 IRS limits (Rev. Proc. 2024-25) & IRC §223 mechanics',
  formulaSnapshot: 'advantage = FV(hsa) − FV(taxable twin)',
};

/* Build-time reference inputs: the widget's own defaults, mirrored. */
const BASE = {
  contribution: HSA_CONSTANTS.familyLimit,
  coverage: 'family' as const,
  age55: false,
  marginalRatePct: 24,
  returnRatePct: 7,
  years: 25,
  medicalSpendShare: 0.4,
  forfeitShare: 0.25,
};

const SCENARIO_RATES = [10, 12, 22, 24, 32, 35, 37];
const SCENARIO_HORIZONS = [10, 20, 30, 40];

/* Chart series: save-to-retire terminal balances by horizon — three lines
   bracketing the taxable account's true result between the two drag
   conventions. */
const HORIZON = hsaHorizonSweep(BASE, 40);
const CHART_SERIES = [
  {
    label: 'HSA — grows untaxed',
    color: '#059669',
    points: HORIZON.map((h) => ({ x: h.years, y: h.hsa })),
  },
  {
    label: 'Taxable twin — growth taxed yearly',
    color: '#0ea5e9',
    points: HORIZON.map((h) => ({ x: h.years, y: h.taxableDrag })),
  },
  {
    label: 'Taxable twin — zero drag (bound)',
    color: '#94a3b8',
    dashed: true,
    points: HORIZON.map((h) => ({ x: h.years, y: h.taxableNoDrag })),
  },
];

/* Inline anchors for the scenario footnotes — computed, not quoted. */
const AT_25 = compareHsa(BASE);
const AT_30 = HORIZON[29];
const SHIELD_PER_RATE_POINT = (BASE.years * BASE.contribution) / 100; // $ per bracket point
const CATCH_UP_LIMIT = hsaLimitFor('family', true);
const CATCH_UP_CASE = compareHsa({ ...BASE, age55: true, contribution: CATCH_UP_LIMIT });
/* Bracket-endpoint anchors for the rate footnote — the ratios below are read
   off the engine, so the prose can never drift from the model. */
const ADV_DRAG_12 = compareHsa({ ...BASE, marginalRatePct: 12 }).saveForLater.advantageDrag;
const ADV_DRAG_37 = compareHsa({ ...BASE, marginalRatePct: 37 }).saveForLater.advantageDrag;
const ADV_MIX_12 = compareHsa({ ...BASE, marginalRatePct: 12 }).mixed.advantage;
const ADV_MIX_37 = compareHsa({ ...BASE, marginalRatePct: 37 }).mixed.advantage;

export const metadata: Metadata = {
  title: 'HSA Triple Tax Advantage Calculator (2025) — HSA vs Taxable Account',
  description:
    'Quantify the three stacked tax breaks of a Health Savings Account: 2025 contribution limits ($4,300 self / $8,550 family, +$1,000 at 55+), the deduction shield, tax-free compounding against a taxable account, and the 20% non-qualified withdrawal penalty — across three usage strategies.',
  keywords: [
    'hsa calculator',
    'hsa triple tax advantage',
    'hsa vs taxable account',
    'hsa contribution limits 2025',
    'hsa investment growth calculator',
    'hdhp calculator',
    'hsa penalty 20',
    'save receipts strategy hsa',
    'stealth retirement account',
    'hsa vs 401k',
  ],
  alternates: { canonical: calc.href },
  openGraph: {
    title: 'HSA Triple Tax Advantage Calculator (2025) — HSA vs Taxable Account',
    description:
      'The only account with three tax breaks, priced: deduction shield, tax-free compounding vs a taxable twin, and the 20% non-medical exit — under three usage strategies at your bracket.',
    url: `${siteConfig.url}${calc.href}`,
    type: 'website',
  },
};

export default function HsaCalculatorPage() {
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
        <section id="calculator" aria-label="HSA triple tax advantage calculator tool" className="scroll-mt-28">
          <HsaCalculator />
        </section>

        {/* Methodology */}
        <div className="border-t border-slate-200 pt-12 dark:border-white/[0.07]">
          <SectionShell
            id="methodology"
            eyebrow="Methodology"
            title="The model, stated exactly"
            accent={calc.accent}
            intro="One formula underlies all three usage views — they differ only in how much is spent on care (m) and how much of the ending balance is forfeited non-medically (p). Every number is an advantage over a taxable twin that receives the same pre-tax earnings, so nothing here is a stand-alone projection."
          >
            <MethodologyGrid
              formulas={[
                {
                  label: 'Contribution ceiling (2025)',
                  expression: 'limit = $4,300 (self) | $8,550 (family) + $1,000 if 55+',
                  note: 'IRS Rev. Proc. 2024-25 for the COLA limits; IRC §223(b)(3) for the statutory catch-up (it never indexes). Entered contributions above the ceiling are capped and flagged — over-limit dollars earn a 6% excise tax per year they remain.',
                },
                {
                  label: 'Deduction shield',
                  expression: 'shield = N × C × t',
                  note: 'IRC §223(a): contributions are deductible above the line even when made personally. Income tax only — the deduction never touches FICA or Schedule SE, and this model claims no payroll saving.',
                },
                {
                  label: 'HSA balance (save-to-retire)',
                  expression: 'FV = C × [((1+r)^N − 1) / r] × (1+r)',
                  note: 'Annuity-due: contributions land at the start of each year, matching lump-sum or payroll funding. The same factor prices the taxable twin — only the rate differs.',
                },
                {
                  label: 'Taxable twin',
                  expression: 'FV = C × (1 − t − m) × AF(r·(1−t), N)',
                  note: 'Same pre-tax dollars: tax first, buy the same care, invest the rest. Growth is taxed annually at the entered rate (exact for interest-like assets) — so the twin compounds at r·(1−t). When care exceeds the after-tax pool (m > 1−t) the investable share goes negative: the twin borrows at its own rate. A zero-drag bound (growth never taxed) is computed alongside, bracketing the true taxable result between the two.',
                },
                {
                  label: 'Mixed value at year N',
                  expression: 'value = (1−m)·C·AF(r,N) × [1 − p·(t + 20%)]',
                  note: 'The current-care share m leaves the account tax-free each year; of the ending balance, the forfeited share p is cashed out non-medically — income tax plus the 20% additional tax stack on the gross amount (IRC §223(f)(4)).',
                },
                {
                  label: 'Non-qualified withdrawal',
                  expression: 'net = W × (1 − t − 20%)',
                  note: 'Before 65: ordinary income (§223(f)(1)) plus the 20% additional tax — 44¢ total on the dollar at a 24% bracket. After 65, disability, or death the 20% disappears and only income tax remains.',
                },
                {
                  label: 'Post-65 any-use value',
                  expression: 'balance × (1 − t)',
                  note: 'The stealth-retirement fallback: after 65 the account behaves like a traditional IRA for non-medical money, with medical withdrawals still fully tax-free.',
                },
              ]}
              assumptions={[
                'Both sides of every comparison receive the same pre-tax earnings; the taxable twin pays tax on the way in, buys the same medical care, and invests what remains — borrowing at its own growth rate when care exceeds its after-tax pool.',
                'Taxable-account drag is the entered marginal rate applied annually (interest-like convention), with the zero-drag bound shown alongside; a long-held equity portfolio lands between the two.',
                'Nominal dollars, constant contribution: limits actually index (2026 announced at $4,400 / $8,750), returns are level every year, and sequence risk is not modeled.',
                'Federal income tax only, at the marginal rate entered: no state tax (CA and NJ tax HSA earnings), no FICA layer (the cafeteria-plan 7.65% employee saving is real but never claimed here, and >2% S-corp shareholders cannot use salary reduction anyway).',
                'Eligibility is asserted, not computed: HDHP coverage with no disqualifying other coverage, month by month. The model prices behavior once you qualify.',
                'Qualified-expense status follows IRC §223(d)(2) / Publication 502; insurance premiums are generally not qualified (COBRA, Medicare B/D/MA and LTC premiums are the exceptions).',
              ]}
            />
          </SectionShell>
        </div>

        {/* Scenario analysis */}
        <SectionShell
          id="scenarios"
          eyebrow="Scenario analysis"
          title="The advantage, by bracket and by horizon"
          accent={calc.accent}
          intro="Computed at build time by the same functions that power the widget — family limit, 7% return, and the widget's default usage mix (40% of each year's contribution spent on care, 25% of the ending balance forfeited) unless a row says otherwise."
        >
          <ScenarioPanel
            title="HSA advantage by marginal rate, 25-year horizon"
            description="Columns are the three usage strategies; every cell is the advantage over the taxable twin, not a stand-alone balance."
            columns={['Bracket', 'Spend-as-you-go shield', 'Save-to-retire (drag twin)', 'Save-to-retire (zero-drag twin)', 'Mixed 40% / 25%']}
              footnote={`Every column rises with the bracket, and where the formula is linear it says so: the spend-as-you-go shield is exactly ${usd(
                SHIELD_PER_RATE_POINT,
                0,
              )} per bracket point (${BASE.years} years × ${usd(BASE.contribution, 0)} × 1%), and the zero-drag column is linear too — its advantage is C × AF(r) × t, the deduction alone, so it scales at exactly 37/12 = ${(37 / 12).toFixed(2)}× across those rows. The two drag-carrying columns more than double over the same span — save-to-retire ${usd(
                ADV_DRAG_12,
                0,
              )} → ${usd(ADV_DRAG_37, 0)} (${(ADV_DRAG_37 / ADV_DRAG_12).toFixed(2)}×), mixed ${usd(
                ADV_MIX_12,
                0,
              )} → ${usd(ADV_MIX_37, 0)} (${(ADV_MIX_37 / ADV_MIX_12).toFixed(2)}×) — but a little more slowly than in step with the bracket: the deduction side grows with t while the twin's shrinkage saturates, so each bracket point buys somewhat less edge than the last. The zero-drag column remains the honest floor: even granting the taxable account a perfect tax-free growth rate, the HSA's edge at every bracket survives on the deduction alone.`}
          >
            <tbody className="divide-y divide-slate-100 dark:divide-white/[0.06]">
              {SCENARIO_RATES.map((rate) => {
                const c = compareHsa({ ...BASE, marginalRatePct: rate });
                return (
                  <tr key={rate}>
                    <th scope="row" className="readout font-semibold normal-case tracking-normal text-slate-900 dark:text-slate-100">
                      {pct(rate, 0)}
                    </th>
                    <td className="text-right">
                      <span className="readout whitespace-nowrap font-semibold text-emerald-700 dark:text-emerald-300">
                        {usd(c.spendNow.taxShield, 0)}
                      </span>
                    </td>
                    <td className="text-right">
                      <span className="readout whitespace-nowrap font-semibold text-indigo-700 dark:text-indigo-300">
                        {usd(c.saveForLater.advantageDrag, 0)}
                      </span>
                    </td>
                    <td className="text-right">
                      <span className="readout whitespace-nowrap font-semibold text-sky-700 dark:text-sky-300">
                        {usd(c.saveForLater.advantageNoDrag, 0)}
                      </span>
                    </td>
                    <td className="text-right">
                      <span
                        className={`readout inline-block whitespace-nowrap rounded-full px-2 py-0.5 font-semibold ${
                          c.mixed.advantage > 0
                            ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400'
                            : 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400'
                        }`}
                      >
                        {usd(c.mixed.advantage, 0)}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </ScenarioPanel>

          <div className="mt-6">
            <ScenarioPanel
              title="Save-to-retire balances by horizon, 24% bracket"
              description="The compounding view: nothing spent, no forfeiture — the widest the gap ever gets at these inputs."
              columns={['Years', 'HSA balance', 'Taxable twin (drag)', 'Twin (zero drag)', 'Advantage']}
              footnote={`Exponential at ${pct(BASE.returnRatePct, 0)} on the HSA side, at ${pct(
                (BASE.returnRatePct / 100) * (1 - BASE.marginalRatePct / 100) * 100,
                2,
              )} on the twin's: the gap compounds because the twin loses the deduction immediately (it starts each year at ${(1 - BASE.marginalRatePct / 100).toFixed(2)}× the contribution) and loses ${pct(
                BASE.marginalRatePct,
                0,
              )} of its growth every year after. At 30 years the HSA holds ${usd(AT_30.hsa, 0)} against the twin's ${usd(
                AT_30.taxableDrag,
                0,
              )} — the zero-drag bound ${usd(AT_30.taxableNoDrag, 0)} still trails by ${usd(AT_30.hsa - AT_30.taxableNoDrag, 0)}.`}
            >
              <tbody className="divide-y divide-slate-100 dark:divide-white/[0.06]">
                {SCENARIO_HORIZONS.map((n) => {
                  const h = HORIZON[n - 1];
                  return (
                    <tr key={n}>
                      <th scope="row" className="readout font-semibold normal-case tracking-normal text-slate-900 dark:text-slate-100">
                        {n}
                      </th>
                      <td className="text-right">
                        <span className="readout whitespace-nowrap font-semibold text-emerald-700 dark:text-emerald-300">
                          {usd(h.hsa, 0)}
                        </span>
                      </td>
                      <td className="text-right">
                        <span className="readout whitespace-nowrap font-semibold text-sky-700 dark:text-sky-300">
                          {usd(h.taxableDrag, 0)}
                        </span>
                      </td>
                      <td className="text-right">
                        <span className="readout whitespace-nowrap text-slate-600 dark:text-slate-300">
                          {usd(h.taxableNoDrag, 0)}
                        </span>
                      </td>
                      <td className="text-right">
                        <span className="readout whitespace-nowrap rounded-full bg-emerald-50 px-2 py-0.5 font-semibold text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400">
                          +{usd(h.hsa - h.taxableDrag, 0)}
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
              xLabel="Years of contributions"
              yLabel="Balance (save-to-retire usage)"
              xFormat={(n) => `${Math.round(n)}y`}
              yFormat={(n) => usdCompact(n)}
              height={320}
              marker={{ x: 25, label: '25-year reference' }}
              markerColor="#059669"
              caption={`The full horizon, ${usd(BASE.contribution, 0)}/yr at ${pct(
                BASE.returnRatePct,
                0,
              )}, ${pct(BASE.marginalRatePct, 0)} bracket. The emerald line is the HSA — untaxed in and untaxed out. The solid sky line is the taxable twin under the annual-drag convention; the dashed grey line grants it perfectly tax-free growth, the most the taxable side could ever hope for. The true taxable result lies between the two, so the vertical gap from either line to the HSA brackets the advantage honestly: at the 25-year marker, ${usd(
                AT_25.saveForLater.advantageDrag,
                0,
              )} under annual drag and ${usd(AT_25.saveForLater.advantageNoDrag, 0)} even with none.`}
            />
          </div>

          <div className="mt-6">
            <ScenarioPanel
              title="The catch-up compounding at 55+"
              description="Same saver, one change: the statutory $1,000 catch-up lifts the family ceiling."
              columns={['', 'Limit', 'Balance at 25y', 'Extra vs no catch-up']}
              footnote={`The catch-up is ${usd(HSA_CONSTANTS.catchUp55, 0)} of extra room per year — ${pct(
                (HSA_CONSTANTS.catchUp55 / CATCH_UP_LIMIT) * 100,
                1,
              )} of the ${usd(CATCH_UP_LIMIT, 0)} ceiling — and it rides the full compounding: ${usd(
                HSA_CONSTANTS.catchUp55 * 25,
                0,
              )} of extra catch-up dollars contributed over the horizon become ${usd(
                CATCH_UP_CASE.saveForLater.balance - AT_25.saveForLater.balance,
                0,
              )} of extra balance, ${numMultiple(
                (CATCH_UP_CASE.saveForLater.balance - AT_25.saveForLater.balance) / (HSA_CONSTANTS.catchUp55 * 25),
              )}× the cash that went in. Starting it the year you turn 55, not 57, is the entire game.`}
            >
              <tbody className="divide-y divide-slate-100 dark:divide-white/[0.06]">
                <tr>
                  <th scope="row" className="text-left font-semibold normal-case tracking-normal text-slate-900 dark:text-slate-100">
                    Family, under 55
                  </th>
                  <td className="text-right">
                    <span className="readout whitespace-nowrap font-semibold text-slate-700 dark:text-slate-300">
                      {usd(HSA_CONSTANTS.familyLimit, 0)}
                    </span>
                  </td>
                  <td className="text-right">
                    <span className="readout whitespace-nowrap text-slate-600 dark:text-slate-300">
                      {usd(AT_25.saveForLater.balance, 0)}
                    </span>
                  </td>
                  <td className="text-right">
                    <span className="readout whitespace-nowrap text-slate-400 dark:text-slate-500">—</span>
                  </td>
                </tr>
                <tr>
                  <th scope="row" className="text-left font-semibold normal-case tracking-normal text-slate-900 dark:text-slate-100">
                    Family, 55+
                  </th>
                  <td className="text-right">
                    <span className="readout whitespace-nowrap font-semibold text-emerald-700 dark:text-emerald-300">
                      {usd(CATCH_UP_LIMIT, 0)}
                    </span>
                  </td>
                  <td className="text-right">
                    <span className="readout whitespace-nowrap font-semibold text-emerald-700 dark:text-emerald-300">
                      {usd(CATCH_UP_CASE.saveForLater.balance, 0)}
                    </span>
                  </td>
                  <td className="text-right">
                    <span className="readout whitespace-nowrap rounded-full bg-emerald-50 px-2 py-0.5 font-semibold text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400">
                      +{usd(CATCH_UP_CASE.saveForLater.balance - AT_25.saveForLater.balance, 0)}
                    </span>
                  </td>
                </tr>
              </tbody>
            </ScenarioPanel>
          </div>
        </SectionShell>

        {/* Deep-dive guide */}
        <div className="border-t border-slate-200 pt-12 dark:border-white/[0.07]">
          <section id="guide" aria-label="HSA triple tax advantage guide" className="scroll-mt-28">
            <HsaArticle />
          </section>
        </div>

        <WorkflowChain currentSlug={calc.slug} />

        <ProvenanceFooter
          sources={[
            {
              label: '2025 federal limits',
              detail:
                'IRS Rev. Proc. 2024-25: HSA contribution limits $4,300 self-only / $8,550 family; HDHP minimum annual deductibles $1,650 / $3,300; HDHP maximum annual out-of-pocket $8,300 / $16,600.',
            },
            {
              label: 'Statutory mechanics',
              detail:
                'IRC §223(a) above-the-line deduction; §223(b)(3) statutory $1,000 catch-up from age 55 (per account holder, not indexed); §223(e) tax-free growth; §223(f)(1) ordinary-income treatment of non-qualified distributions; §223(f)(4) the 20% additional tax, not applying to distributions after age 65, disability, or death (ACA §9004); §223(d)(2) / Publication 502 qualified-expense definitions; §125 cafeteria-plan FICA treatment (discussed, never modeled).',
            },
            {
              label: 'Next year’s parameters',
              detail:
                'Tax year 2026 is already announced (Rev. Proc. 2025-19): $4,400 self-only / $8,750 family, catch-up unchanged at $1,000, HDHP minimums $1,700 / $3,400 and out-of-pocket maxima $8,500 / $17,000. This tool is pinned to 2025 and holds contributions constant in nominal dollars.',
            },
            {
              label: 'Comparison convention',
              detail:
                'The taxable twin receives identical pre-tax earnings, pays tax on the way in, buys identical care, and invests the remainder — borrowing at its own growth rate when care exceeds the after-tax pool. Growth drag is modeled two ways (annual taxation at the entered rate; zero drag) so every advantage is a bracketed range rather than a point estimate.',
            },
            {
              label: 'Out of scope',
              detail:
                'State income tax (California and New Jersey tax HSA earnings; other states vary), FICA and cafeteria-plan payroll mechanics, custodian fees and investment menus, eligibility testing (HDHP status, last-month rule), excess-contribution excise mechanics beyond the cap warning, and any investment advice.',
            },
          ]}
          disclaimer="This is an illustrative federal model, not tax or investment advice. Eligibility is governed by HDHP coverage rules the calculator does not evaluate; contribution limits are 2025 values and change annually. Confirm your coverage situation, current-year limits, and qualified-expense treatment with a qualified professional."
        />
      </CalculatorPageShell>
    </>
  );
}

/** Small local helper: "2.4×" style multiplier for the catch-up footnote. */
function numMultiple(x: number): string {
  return `${x.toFixed(1)}×`;
}

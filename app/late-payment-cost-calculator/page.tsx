import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import CalculatorPageShell from '@/components/CalculatorPageShell';
import LatePaymentCalculator from '@/components/calculators/LatePaymentCalculator';
import LatePaymentArticle from '@/components/content/LatePaymentArticle';
import ComparisonChart from '@/components/ComparisonChart';
import {
  AppJsonLd,
  MethodologyGrid,
  ProvenanceFooter,
  ScenarioPanel,
  SectionShell,
} from '@/components/professional';
import { calculators, siteConfig, type Calculator } from '@/lib/site';
import {
  LATEFEE_PRESETS,
  breakevenDiscount,
  computeLatePayment,
  discountImpliedAnnualized,
  evaluateEarlyPayDiscount,
  expectedTermsCostPct,
} from '@/lib/latefee';
import { usd, numFmt, pct } from '@/lib/format';

/**
 * Registration note: this instrument hardcodes its own metadata object because
 * lib/site.ts is wired by the suite-integration step. Stage 2 of the workflow
 * ("Bill") — the invoice is priced (stage 1) and now the cost of collecting it
 * comes due, before structuring, compensation, or sustaining the business.
 */
const calc: Calculator = {
  slug: 'late-payment-cost-calculator',
  href: '/late-payment-cost-calculator/',
  title: 'Late Payment Cost Calculator',
  shortTitle: 'Late Payment Cost',
  tagline: 'What Net-30 really costs — carrying, bad debt, and the 2/10 net 30 decision.',
  description:
    'Compute the real cost of payment terms: per-invoice carrying cost at your cost of capital, expected bad-debt loss, the terms-cost curve from Net-15 to Net-90, and whether to offer or take an early-payment discount — with the classic 2/10 net 30 arithmetic derived, not quoted.',
  icon: 'Clock',
  category: 'Payments',
  tags: [
    'late payment calculator',
    'net 30 calculator',
    'cost of capital',
    'carrying cost',
    'accounts receivable',
    'early payment discount',
    '2/10 net 30',
    'dso',
    'bad debt',
    'invoice financing',
    'trade credit terms',
    'working capital',
  ],
  accent: 'slate',
  stage: 2,
  stageLabel: 'Bill',
  dataBasis:
    'Standard trade-credit arithmetic (time value of money, uniform default-risk accrual) — no statutory parameter; rates are user inputs',
  formulaSnapshot: 'cost = A × r × days ÷ 365 + A × P(default)',
};

/* Build-time scenario rows: the three billing archetypes from the tool, plus
   two stress cases — terms stretched to Net-90, and default risk spiking. */
type ScenarioRow = { label: string; description: string; inputs: Parameters<typeof computeLatePayment>[0] };
const STRESS_ROWS: ScenarioRow[] = [
  {
    label: 'B2B milestone — stretched to Net-90',
    description: 'Same invoice, terms slip 30 → 90 days',
    inputs: { ...LATEFEE_PRESETS[1].inputs, netDays: 90 },
  },
  {
    label: 'Enterprise — default risk spikes to 8%',
    description: 'The buyer weakens; exposure unchanged',
    inputs: { ...LATEFEE_PRESETS[2].inputs, badDebtPct: 8 },
  },
];
const SCENARIO_ROWS: ScenarioRow[] = [
  ...LATEFEE_PRESETS.map((p) => ({
    label: p.label,
    description: p.description,
    inputs: p.inputs,
  })),
  ...STRESS_ROWS,
];

/* Chart 1 — the terms-cost curve at three capital/risk geometries. */
const TERMS_DAYS = Array.from({ length: 25 }, (_, i) => i * 5); // 0..120
const TERMS_SERIES = [
  {
    label: '8% capital · 1% default risk',
    color: '#0ea5e9',
    points: TERMS_DAYS.map((d) => ({ x: d, y: expectedTermsCostPct(d, 8, 1) })),
  },
  {
    label: '12% capital · 3% default risk',
    color: '#6366f1',
    points: TERMS_DAYS.map((d) => ({ x: d, y: expectedTermsCostPct(d, 12, 3) })),
  },
  {
    label: '18% capital · 6% default risk (credit-line funded)',
    color: '#f59e0b',
    dashed: true,
    points: TERMS_DAYS.map((d) => ({ x: d, y: expectedTermsCostPct(d, 18, 6) })),
  },
];

/* Chart 2 — the discount acceptance boundary: implied rate of 2/10 net N vs
   a 12% cost of capital. Crossing at N ≈ 10 + (2/98) × 365/0.12. */
const BOUNDARY_NETS = Array.from({ length: 22 }, (_, i) => 15 + i * 5); // 15..120
const BOUNDARY_SERIES = [
  {
    label: 'Implied annualized rate of 2/10 net N',
    color: '#6366f1',
    points: BOUNDARY_NETS.map((n) => ({
      x: n,
      y: discountImpliedAnnualized(2, 10, n) ?? 0,
    })).filter((pt) => pt.y > 0),
  },
  {
    label: 'Cost of capital (12%)',
    color: '#f59e0b',
    dashed: true,
    points: BOUNDARY_NETS.map((n) => ({ x: n, y: 12 })),
  },
];
const CROSSING_12 = 10 + (2 / 98) * (365 / 0.12);
const CROSSING_8 = 10 + (2 / 98) * (365 / 0.08);

/* Footnote anchors: the stress deltas, quoted from the engine. */
const b2bBase = computeLatePayment(LATEFEE_PRESETS[1].inputs);
const b2bStress = computeLatePayment(STRESS_ROWS[0].inputs);
const entBase = computeLatePayment(LATEFEE_PRESETS[2].inputs);
const entStress = computeLatePayment(STRESS_ROWS[1].inputs);

/**
 * Self-contained workflow chain for this page. Until the suite-integration
 * step registers this slug in lib/site.ts, the shared WorkflowChain cannot
 * highlight "You are here" (it maps over the registry). This rendition marks
 * the current instrument explicitly and pulls one representative per stage
 * from the registry for the rest — including the stage-2 sibling (the Stripe
 * fee calculator), so the billing chapter shows both of its instruments and
 * the tool this page links to three times finally appears in its own workflow
 * map. The current slug is excluded BY NAME, which keeps the selection
 * correct both before and after registration.
 */
const STAGE_REPS = [1, 2, 3, 4, 5]
  .map((stage) => calculators.find((c) => c.stage === stage && c.slug !== calc.slug))
  .filter((c): c is Calculator => Boolean(c));

function SisterInstruments({ current }: { current: Calculator }) {
  return (
    <section id="workflow" aria-labelledby="workflow-title" className="scroll-mt-28">
      <header className="mb-7 max-w-3xl">
        <p className="font-mono mb-3 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">
          <span className="inline-block h-3 w-0.5 rounded-full bg-current" aria-hidden="true" />
          The CalcSuite workflow
        </p>
        <h2 id="workflow-title" className="section-title">
          One business question per stage
        </h2>
        <p className="mt-3 leading-relaxed text-slate-600 dark:text-slate-300">
          This instrument answers the billing question — stage 2 of the workflow, the chapter it
          shares with the Stripe fee calculator, this page&apos;s sibling for the other half of the
          cost of getting paid. When you&apos;re done here, the next decision has a workspace
          waiting for it.
        </p>
      </header>

      <ol className="grid gap-3 md:grid-cols-3 lg:grid-cols-5">
        <li>
          <div
            aria-current="step"
            className="relative flex h-full flex-col rounded-2xl border border-indigo-300 bg-white p-4 shadow-md ring-2 ring-indigo-500/20 dark:border-indigo-500/40 dark:bg-slate-900/70 dark:ring-indigo-500/30"
          >
            <div className="flex items-center justify-between">
              <span className="readout text-[11px] font-bold tracking-widest text-slate-300 dark:text-slate-500">
                STAGE {String(current.stage).padStart(2, '0')}
              </span>
              <span className="chip bg-indigo-600 text-[10px] font-semibold uppercase tracking-wider text-white">
                You are here
              </span>
            </div>
            <h3 className="mt-2 text-sm font-bold text-slate-900 dark:text-slate-100">
              {current.shortTitle ?? current.title}
            </h3>
            <p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
              {current.tagline}
            </p>
            <p className="mt-auto pt-3 font-mono text-[11px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-300">
              {current.stageLabel}
            </p>
          </div>
        </li>
        {STAGE_REPS.map((c) => (
          <li key={c.slug}>
            <Link
              href={c.href}
              className="focus-calm group flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-4 transition hover:-translate-y-0.5 hover:border-indigo-200 hover:shadow-md dark:border-white/[0.08] dark:bg-slate-900/60 dark:hover:border-indigo-500/30 dark:hover:shadow-black/40"
            >
              <span className="readout text-[11px] font-bold tracking-widest text-slate-300 dark:text-slate-500">
                STAGE {String(c.stage).padStart(2, '0')}
              </span>
              <h3 className="mt-2 text-sm font-bold text-slate-700 transition group-hover:text-indigo-700 dark:text-slate-300 dark:group-hover:text-indigo-300">
                {c.shortTitle ?? c.title}
              </h3>
              <p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                {c.tagline}
              </p>
              <span className="mt-auto flex items-center gap-1 pt-3 text-xs font-semibold text-slate-400 transition group-hover:text-indigo-600 dark:text-slate-500 dark:group-hover:text-indigo-300">
                Open instrument
                <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" aria-hidden="true" />
              </span>
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}

export const metadata: Metadata = {
  title: 'Late Payment Cost Calculator — Net-30 Carrying Cost, Bad Debt & 2/10 net 30',
  description:
    'Compute what payment terms really cost: per-invoice carrying cost at your cost of capital, expected bad-debt loss, the terms-cost curve from Net-15 to Net-90, and the early-payment discount decision — with the classic 2/10 net 30 implied rate (37.2% on 365, 36.7% on 360) derived step by step.',
  keywords: [
    'late payment cost calculator',
    'net 30 calculator',
    'payment terms cost',
    'carrying cost calculator',
    'accounts receivable cost',
    'early payment discount calculator',
    '2/10 net 30',
    'implied annual interest rate trade credit',
    'dso calculator',
    'bad debt expected loss',
    'invoice financing cost',
    'cost of capital receivables',
  ],
  alternates: { canonical: calc.href },
  openGraph: {
    title: 'Late Payment Cost Calculator — Net-30 Carrying Cost, Bad Debt & 2/10 net 30',
    description:
      'The invisible price of waiting: carrying cost, expected bad debt, the terms-cost curve, and whether to offer or take an early-pay discount — every formula stated, every number computed.',
    url: `${siteConfig.url}${calc.href}`,
    type: 'website',
  },
};

export default function LatePaymentCostCalculatorPage() {
  return (
    <>
      <AppJsonLd calc={calc} />
      <CalculatorPageShell calc={calc}>
        {/* Interactive tool */}
        <section id="calculator" aria-label="Late payment cost calculator tool" className="scroll-mt-28">
          <LatePaymentCalculator />
        </section>

        {/* Methodology */}
        <div className="border-t border-slate-200 pt-12 dark:border-white/[0.07]">
          <SectionShell
            id="methodology"
            eyebrow="Methodology"
            title="The model, stated exactly"
            accent={calc.accent}
            intro="Two costs — the time value of the wait and the expectation of default — plus one derived rate for the discount decision. No year-specific statutory constant enters this model: trade terms are contractual conventions, and the interest rate and default probability are yours to supply."
          >
            <MethodologyGrid
              formulas={[
                {
                  label: 'Carrying cost',
                  expression: 'carry = A × r × days ÷ 365',
                  note: 'The face you are owed, financed at your annual cost of capital for the payment window. Simple interest, charged on the outstanding face — a conservative first-order convention; leap years are ignored (a 0.27% effect).',
                },
                {
                  label: 'Expected bad-debt loss',
                  expression: 'E[loss] = A × P(default) · E[A] = A × (1 − P)',
                  note: 'Probability-weighted: the per-invoice default rate blended across the book (write-offs ÷ billings). This is the intercept of the terms-cost curve — even a same-day sale carries it.',
                },
                {
                  label: 'Terms cost & price uplift',
                  expression: 'cost% = days/365 × r + P(default) · uplift = cost% ÷ (1 − cost%)',
                  note: 'The full expected cost as a share of face, and the markup that restores the expected value of a cash sale — the number your quoted prices should already contain.',
                },
                {
                  label: 'Implied discount rate (the classic)',
                  expression: 'i = (d ÷ (1 − d)) × (365 ÷ (N − D))',
                  note: 'For 2/10 net 30: (2 ÷ 98) × (365 ÷ 20) = 37.24%. The 36.7% in most textbooks is the same expression on the 360-day banker\'s year — a day-count convention, not a different formula. Buyer: a return earned. Seller: a price paid for early cash.',
                },
                {
                  label: 'Discount boundaries',
                  expression: 'd* = q ÷ (1 + q), q = r × (N − D) ÷ 365 · N* = D + d/(1−d) × 365 ÷ r',
                  note: 'The discount priced exactly at your cost of capital, and the net term at which a given discount becomes fair. At 8% capital, 2/10 is fairly priced only at Net-103.',
                },
                {
                  label: 'Early-pay expected value',
                  expression: 'ΔE = −A·d + risk relief + carrying relief',
                  note: 'The seller\'s full comparison: face surrendered, minus the default expectation removed by the shorter window (P scaling by D ÷ N — uniform risk accrual, a stated assumption), minus the carrying removed. The identity holds to the cent.',
                },
                {
                  label: 'Working capital locked',
                  expression: 'AR = annual billings × DSO ÷ 365',
                  note: 'The steady-state receivables the terms deploy — the runway connection. Net-45 on $600k/yr parks $73,973 of your own money in customer accounts at all times.',
                },
                {
                  label: 'Late-fee clause, annualized',
                  expression: 'simple: 12 × m · compounded: (1 + m)^12 − 1',
                  note: 'The market-standard 1.5%/month reads 18.0% simple, 19.6% compounded — contractual convention, useful mainly as a deterrent.',
                },
              ]}
              assumptions={[
                'One collection cycle at the stated terms, paid on the due date: no DSO distribution, no compounding inside a cycle. For lumpy reality, enter your effective days (DSO), not the contractual term.',
                'Simple interest on a 365-day year; the 360-day banker\'s variant is quoted alongside wherever the classic textbook figure differs.',
                'Carrying cost is charged on the outstanding face — the full invoice without a discount, the discounted face with one.',
                'Bad-debt probability is per-invoice and blended across the book; it accrues uniformly over the exposure window, so paying at day D of a Net-N term carries P × (D ÷ N) of the risk.',
                'Discount uptake is all-or-none: either the customer takes the early-pay terms or pays at the net date; no adverse selection is modeled.',
                'No statutory parameter exists for trade terms — Net-30 and 2/10 net 30 are contractual conventions, not law, and the rate and default probability are user inputs. Statutory late-payment regimes (EU Late Payment Directive, US Prompt Payment Act) are not modeled.',
              ]}
            />
          </SectionShell>
        </div>

        {/* Scenario analysis */}
        <SectionShell
          id="scenarios"
          eyebrow="Scenario analysis"
          title="Three billing books, two stress cases"
          accent={calc.accent}
          intro="Computed at build time by the same functions that power the widget. Each row is the full model — carrying at that book's cost of capital, expected default at its blended risk — plus the expected value of offering a 2/10 early-pay discount on that invoice."
        >
          <ScenarioPanel
            title="Cost of terms by billing archetype"
            description="The three presets from the tool, plus terms stretched to Net-90 and a default-risk spike. The last column is the expected value of offering 2/10 net terms on that invoice (risk accruing uniformly over the window)."
            columns={['Scenario', 'Terms', 'Carrying', 'Expected bad debt', 'Total / invoice', '% of face', 'Offer 2/10 → ΔE']}
            footnote={`Pattern 1 — default risk, not capital, dominates at ordinary spreads: the B2B row's ${usd(b2bBase.badDebtLoss, 0)} of expected bad debt is ${(b2bBase.badDebtLoss / b2bBase.carryingCost).toFixed(1)}× its ${usd(b2bBase.carryingCost, 0)} carrying cost. Pattern 2 — the levers differ in kind: stretching the B2B milestone from Net-30 to Net-90 adds ${usd(b2bStress.totalExpectedCost - b2bBase.totalExpectedCost, 0)} (+${pct(((b2bStress.totalCostPct ?? 0) - (b2bBase.totalCostPct ?? 0)), 2)} of face), all of it carrying; spiking the enterprise default rate from 2% to 8% adds ${usd(entStress.badDebtLoss - entBase.badDebtLoss, 0)} — same invoice, different disease, and only the second one a deposit can cure. Pattern 3 — the 2/10 column flips sign where risk lives: strongly negative on the low-risk Net-15 retainer, positive on the riskier books, which is the entire argument for granting rich discounts selectively rather than uniformly.`}
          >
            <tbody className="divide-y divide-slate-100 dark:divide-white/[0.06]">
              {SCENARIO_ROWS.map((row) => {
                const r = computeLatePayment(row.inputs);
                const offer = evaluateEarlyPayDiscount(row.inputs, 2, 10);
                const isStress = STRESS_ROWS.some((s) => s.label === row.label);
                return (
                  <tr key={row.label}>
                    <th scope="row" className="max-w-[16rem]">
                      <span className={`readout font-semibold normal-case tracking-normal ${isStress ? 'text-amber-700 dark:text-amber-300' : 'text-slate-900 dark:text-slate-100'}`}>
                        {row.label}
                      </span>
                      <span className="mt-0.5 block text-xs font-normal leading-snug text-slate-500 dark:text-slate-400">
                        {row.description}
                      </span>
                    </th>
                    <td className="text-right">
                      <span className="readout whitespace-nowrap font-semibold text-slate-700 dark:text-slate-200">
                        Net-{numFmt(row.inputs.netDays, 0)}
                      </span>
                    </td>
                    <td className="text-right">
                      <span className="readout whitespace-nowrap text-slate-600 dark:text-slate-300">
                        {usd(r.carryingCost)}
                      </span>
                    </td>
                    <td className="text-right">
                      <span className="readout whitespace-nowrap text-slate-600 dark:text-slate-300">
                        {usd(r.badDebtLoss, 0)}
                      </span>
                    </td>
                    <td className="text-right">
                      <span className="readout whitespace-nowrap font-semibold text-rose-600 dark:text-rose-400">
                        {usd(r.totalExpectedCost, 0)}
                      </span>
                    </td>
                    <td className="text-right">
                      <span className="readout whitespace-nowrap font-semibold text-slate-900 dark:text-slate-100">
                        {r.totalCostPct === null ? '—' : pct(r.totalCostPct, 2)}
                      </span>
                    </td>
                    <td className="text-right">
                      <span
                        className={`readout inline-block whitespace-nowrap rounded-full px-2 py-0.5 font-semibold ${
                          offer.netAdvantage > 0.005
                            ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400'
                            : offer.netAdvantage < -0.005
                              ? 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400'
                              : 'bg-slate-100 text-slate-600 dark:bg-white/[0.05] dark:text-slate-300'
                        }`}
                      >
                        {offer.netAdvantage > 0.005 ? '+' : ''}
                        {usd(offer.netAdvantage, 0)}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </ScenarioPanel>

          <div className="mt-6">
            <ComparisonChart
              series={TERMS_SERIES}
              xLabel="Payment terms (days)"
              yLabel="Expected cost · % of invoice face"
              xFormat={(n) => numFmt(n, 0)}
              yFormat={(n) => pct(n, 1)}
              height={300}
              marker={{ x: 30, label: 'Net-30' }}
              caption="The terms-cost curve for three capital/risk geometries: straight lines whose intercepts are the default expectation and whose slopes are the capital rate ÷ 365. The distance between any two lines of similar color family is what a credit-line-funded business pays its bank for the privilege of its customers' terms. Note the intercepts — even at day zero, the 6%-risk line already costs 6% of face; only the slope is negotiable by shortening terms."
            />
          </div>

          <div className="mt-6">
            <ComparisonChart
              series={BOUNDARY_SERIES}
              xLabel="Net term (days)"
              yLabel="Annualized rate"
              xFormat={(n) => numFmt(n, 0)}
              yFormat={(n) => pct(n, 0)}
              height={300}
              marker={{ x: 30, label: '2/10 net 30 · 37.2%' }}
              markerColor="#6366f1"
              caption={`The acceptance boundary, drawn for the classic terms: the implied annualized rate of 2/10 net N falls as the net term stretches — ${pct(discountImpliedAnnualized(2, 10, 15) ?? 0, 1)} at Net-15 down to ${pct(discountImpliedAnnualized(2, 10, 120) ?? 0, 1)} at Net-120. Where the curve crosses a cost-of-capital line (12% here, at Net-${numFmt(CROSSING_12, 0)}; 8% would cross at Net-${numFmt(CROSSING_8, 0)}), the discount prices its acceleration exactly at that financing rate. Left of a crossing the discount is rich — buyers should take it, sellers overpay; right of it, cheap. Every point re-solves (2 ÷ 98) × (365 ÷ (N − 10)).`}
            />
          </div>
        </SectionShell>

        {/* Deep-dive guide */}
        <div className="border-t border-slate-200 pt-12 dark:border-white/[0.07]">
          <section id="guide" aria-label="Late payment cost guide" className="scroll-mt-28">
            <LatePaymentArticle />
          </section>
        </div>

        <SisterInstruments current={calc} />

        <ProvenanceFooter
          sources={[
            {
              label: 'Model basis',
              detail:
                'Standard trade-credit / working-capital treatment: the time value of financing receivables (A × r × days ÷ 365) and the cost of forgoing purchase discounts, i = (d ÷ (1−d)) × (365 ÷ (N−D)) — the corporate-finance canon (e.g., Higgins, "Analysis for Financial Management"; Brealey–Myers–Allen, trade credit chapter). Textbook market practice, not regulation.',
            },
            {
              label: 'Conventions',
              detail:
                '365-day year (360-day banker\'s variant quoted alongside — 2/10 net 30 reads 37.24% vs the textbooks\' 36.73%); simple interest; carrying on the outstanding face; default risk accruing uniformly over the exposure window; all-or-none discount uptake.',
            },
            {
              label: 'Parameter posture',
              detail:
                'No year-specific statutory constant enters this model — unlike the tax instruments in this suite, there is no IRS/SSA parameter for trade terms. Net-30 and 2/10 net 30 are contractual market conventions; the interest rate and default probability are user inputs.',
            },
            {
              label: 'Out of scope',
              detail:
                'DSO distributions and late-payer tails, compounding within a cycle, factoring pricing and recourse terms, the tax treatment of bad debts, and statutory late-payment regimes (EU Late Payment Directive 2011/7/EU, US Prompt Payment Act) — real, but contractual and jurisdiction-specific rather than modeled here.',
            },
          ]}
          disclaimer="This is an illustrative planning model, not credit, legal, or collections advice. The expected-value outputs are exactly as honest as the rate and default probability you supply — a blended default estimate smooths over the concentration that actually sinks businesses. Statutory interest and terms, where they apply to your contracts, override anything computed here."
        />
      </CalculatorPageShell>
    </>
  );
}

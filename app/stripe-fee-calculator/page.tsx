import type { Metadata } from 'next';
import CalculatorPageShell from '@/components/CalculatorPageShell';
import StripeCalculator from '@/components/calculators/StripeCalculator';
import StripeArticle from '@/components/content/StripeArticle';
import {
  AppJsonLd,
  MethodologyGrid,
  ProvenanceFooter,
  ScenarioPanel,
  SectionShell,
  WorkflowChain,
} from '@/components/professional';
import { calculators, siteConfig } from '@/lib/site';
import { STRIPE_RATES, computeFee, type StripeFeeType } from '@/lib/stripe';
import { pct, usd } from '@/lib/format';

const calc = calculators.find((c) => c.slug === 'stripe-fee-calculator')!;

/* Scenario grid amounts — small tickets where the $0.30 dominates, the ACH
   crossover at $625, and enterprise invoices where the cap wins outright. */
const SCENARIO_AMOUNTS = [10, 50, 100, 250, 500, 625, 1_000, 5_000, 20_000];
const FEE_TYPES: StripeFeeType[] = ['domestic', 'international', 'ach'];

export const metadata: Metadata = {
  title: 'Stripe Fee Calculator (2025) — Domestic, International & ACH + Reverse',
  description:
    'Calculate Stripe processing fees for credit card, international, and ACH payments. Reverse-calculate invoice amounts to ensure exact net payouts.',
  keywords: [
    'stripe fee calculator',
    'stripe processing fee',
    'stripe international fee',
    'stripe ach fee',
    'reverse stripe calculator',
    'how much does stripe charge',
    'stripe fee reverse',
  ],
  alternates: { canonical: calc.href },
  openGraph: {
    title: 'Stripe Fee Calculator (2025) — Domestic, International & ACH + Reverse',
    description:
      'Calculate Stripe fees for any amount. Domestic, international, ACH, plus a reverse calculator to find what to charge to net your target.',
    url: `${siteConfig.url}${calc.href}`,
    type: 'website',
  },
};

export default function StripeFeeCalculatorPage() {
  return (
    <>
      <AppJsonLd calc={calc} />
      <CalculatorPageShell calc={calc}>
        {/* Interactive tool */}
        <section id="calculator" aria-label="Stripe fee calculator tool" className="scroll-mt-28">
          <StripeCalculator />
        </section>

        {/* Methodology */}
        <div className="border-t border-slate-200 pt-12">
          <SectionShell
            id="methodology"
            eyebrow="Methodology"
            title="The arithmetic this tool runs"
            accent={calc.accent}
            intro="No black box: every output is produced by the same four expressions published here, applied exactly as written."
          >
            <MethodologyGrid
              formulas={[
                {
                  label: 'Card processing fee',
                  expression: 'fee = charge × rate + $0.30',
                  note: `Domestic cards use ${STRIPE_RATES.domestic.description}; international cards stack the 1.5% cross-border surcharge (${STRIPE_RATES.international.description}).`,
                },
                {
                  label: 'ACH processing fee',
                  expression: 'fee = min(charge × 0.8%, $5.00)',
                  note: 'The $5 cap engages for any amount over $625 ($5.00 ÷ 0.8%), which flips the economics on large invoices.',
                },
                {
                  label: 'Effective rate',
                  expression: 'effective % = fee ÷ charge × 100',
                  note: 'Rises sharply on micro-transactions — a $3 sale loses far more than 2.9% once the fixed component lands.',
                },
                {
                  label: 'Reverse invoice total',
                  expression: 'charge = (target net + $0.30) ÷ (1 − rate)',
                  note: 'For ACH, solved separately on each side of the $625 cap boundary so reverse invoices net to the penny.',
                },
              ]}
              assumptions={[
                'US merchant account on Stripe’s standard published pricing — negotiated or volume discounts are excluded.',
                'Successful charges only: refund-returned fees, disputes, and certain failed-payment fees are out of scope.',
                'Currency conversion (~+1%) on non-USD settlement is not modeled.',
                'Fees are rounded to the cent; effective rates shown to two decimals.',
              ]}
            />
          </SectionShell>
        </div>

        {/* Scenario analysis */}
        <SectionShell
          id="scenarios"
          eyebrow="Scenario analysis"
          title="Fee behavior across invoice sizes"
          accent={calc.accent}
          intro="Computed at build time by the same functions that power the widget above, so the table and the tool can never disagree. Two structural patterns matter more than any single row."
        >
          <ScenarioPanel
            title="Processing cost by method, $10 – $20,000"
            description="Fee and effective rate under each transaction type, plus the cash ACH puts back versus taking the identical charge on a US card."
            columns={['Charge amount', 'Domestic card', 'International card', 'ACH transfer', 'ACH edge vs card']}
            footnote="Pattern 1 — the fixed component dominates small tickets: the effective rate on a $10 domestic-card sale is 5.9%, nearly double the headline 2.9%. Pattern 2 — the ACH cap rewrites large invoices: above $625 every extra dollar rides free, which is why high-ticket B2B billing should default to bank transfers. Note that ACH settles slower and carries return-transfer risk not priced here — one reason cards still win below a few hundred dollars regardless of the raw arithmetic."
          >
            <tbody className="divide-y divide-slate-100">
              {SCENARIO_AMOUNTS.map((amount) => {
                const rows = FEE_TYPES.map((t) => ({ t, ...computeFee(amount, t) }));
                const domestic = rows.find((r) => r.t === 'domestic')!;
                const ach = rows.find((r) => r.t === 'ach')!;
                const saving = domestic.fee - ach.fee;
                return (
                  <tr key={amount}>
                    <th scope="row" className="readout font-semibold normal-case tracking-normal text-slate-900">
                      {usd(amount, 0)}
                    </th>
                    {rows.map((r) => (
                      <td key={r.t} className="text-right">
                        <span className="readout block whitespace-nowrap font-medium text-rose-600">
                          −{usd(r.fee)}
                        </span>
                        <span className="readout block text-xs text-slate-400">{pct(r.effectiveRate)}</span>
                      </td>
                    ))}
                    <td className="text-right">
                      <span className="readout inline-block whitespace-nowrap rounded-full bg-emerald-50 px-2 py-0.5 font-semibold text-emerald-700">
                        +{usd(saving)}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </ScenarioPanel>
        </SectionShell>

        {/* Deep-dive guide */}
        <div className="border-t border-slate-200 pt-12">
          <section id="guide" aria-label="Stripe fee guide" className="scroll-mt-28">
            <StripeArticle />
          </section>
        </div>

        <WorkflowChain currentSlug={calc.slug} />

        <ProvenanceFooter
          sources={[
            {
              label: 'Rate schedule',
              detail:
                'Standard published US pricing: domestic cards 2.9% + $0.30; international cards add a 1.5% cross-border surcharge to 4.4% + $0.30; ACH direct debit 0.8%, capped at $5.00.',
            },
            {
              label: 'Out of scope',
              detail:
                'Currency conversion (~+1%), chargeback/dispute fees, Radar fraud-tool surcharges, and Stripe Invoicing product fees are excluded from all figures.',
            },
            {
              label: 'Reverse-mode verification',
              detail:
                'Reverse formulas are the closed-form inverse of the forward equations above; both regimes of the ACH cap ($625 boundary) are validated against the forward path on every run.',
            },
          ]}
          disclaimer="Published pricing varies by country and account agreement — confirm your exact schedule in the Stripe Dashboard before quoting client-facing numbers. Estimates are illustrative, not financial advice."
        />
      </CalculatorPageShell>
    </>
  );
}

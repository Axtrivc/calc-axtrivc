import type { Metadata } from 'next';
import CalculatorPageShell from '@/components/CalculatorPageShell';
import StripeCalculator from '@/components/calculators/StripeCalculator';
import StripeArticle from '@/components/content/StripeArticle';
import { calculators, siteConfig } from '@/lib/site';

const calc = calculators.find((c) => c.slug === 'stripe-fee-calculator')!;

export const metadata: Metadata = {
  title: 'Stripe Fee Calculator (2025) — Domestic, International & ACH + Reverse',
  description:
    'Free Stripe fee calculator. See domestic (2.9% + $0.30), international (+1.5%), and ACH (0.8% capped at $5) fees, plus a reverse calculator to find the invoice total to charge.',
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
      <CalculatorPageShell
        title={calc.title}
        tagline={calc.tagline}
        category={calc.category}
        icon={calc.icon}
        accent={calc.accent}
      >
        {/* Tool on top */}
        <section aria-label="Stripe fee calculator tool" className="mb-16">
          <StripeCalculator />
        </section>

        {/* Deep SEO content below */}
        <section aria-label="Stripe fee guide" className="border-t border-slate-200 pt-12">
          <StripeArticle />
        </section>
      </CalculatorPageShell>
    </>
  );
}

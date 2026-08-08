import type { Metadata } from 'next';
import CalculatorPageShell from '@/components/CalculatorPageShell';
import FreelanceCalculator from '@/components/calculators/FreelanceCalculator';
import FreelanceArticle from '@/components/content/FreelanceArticle';
import { calculators, siteConfig } from '@/lib/site';

const calc = calculators.find((c) => c.slug === 'freelance-hourly-rate-calculator')!;

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
    <CalculatorPageShell
      title={calc.title}
      tagline={calc.tagline}
      category={calc.category}
      icon={calc.icon}
      accent={calc.accent}
    >
      <section aria-label="Freelance hourly rate calculator tool" className="mb-16">
        <FreelanceCalculator />
      </section>

      <section aria-label="Freelance pricing guide" className="border-t border-slate-200 pt-12">
        <FreelanceArticle />
      </section>
    </CalculatorPageShell>
  );
}

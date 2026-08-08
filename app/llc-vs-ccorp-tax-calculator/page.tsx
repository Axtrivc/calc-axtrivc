import type { Metadata } from 'next';
import CalculatorPageShell from '@/components/CalculatorPageShell';
import TaxCalculator from '@/components/calculators/TaxCalculator';
import TaxArticle from '@/components/content/TaxArticle';
import { calculators, siteConfig } from '@/lib/site';

const calc = calculators.find((c) => c.slug === 'llc-vs-ccorp-tax-calculator')!;

export const metadata: Metadata = {
  title: 'LLC vs C-Corp Tax Calculator (2025) — Compare Federal Taxes',
  description:
    'Compare LLC (self-employment + income tax with QBI deduction) vs C-Corp (21% corporate tax + dividend tax) at any profit level. Free, accurate 2025 federal model. Not tax advice.',
  keywords: [
    'llc vs c corp calculator',
    'llc vs c corp tax',
    'c corporation tax',
    'self employment tax',
    'qbi deduction',
    'double taxation',
    'business entity tax',
    'pass through taxation',
  ],
  alternates: { canonical: calc.href },
  openGraph: {
    title: 'LLC vs C-Corp Tax Calculator (2025) — Compare Federal Taxes',
    description:
      'See how much federal tax you would pay as an LLC vs a C-Corp at any profit level. Includes QBI deduction, SE tax, corporate tax, and dividend tax.',
    url: `${siteConfig.url}${calc.href}`,
    type: 'website',
  },
};

export default function LlcVsCcorpPage() {
  return (
    <CalculatorPageShell
      title={calc.title}
      tagline={calc.tagline}
      category={calc.category}
      icon={calc.icon}
      accent={calc.accent}
    >
      <section aria-label="LLC vs C-Corp tax calculator tool" className="mb-16">
        <TaxCalculator />
      </section>

      <section aria-label="LLC vs C-Corp tax guide" className="border-t border-slate-200 pt-12">
        <TaxArticle />
      </section>
    </CalculatorPageShell>
  );
}

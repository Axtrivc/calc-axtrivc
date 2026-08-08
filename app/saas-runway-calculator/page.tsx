import type { Metadata } from 'next';
import CalculatorPageShell from '@/components/CalculatorPageShell';
import RunwayCalculator from '@/components/calculators/RunwayCalculator';
import RunwayArticle from '@/components/content/RunwayArticle';
import { calculators, siteConfig } from '@/lib/site';

const calc = calculators.find((c) => c.slug === 'saas-runway-calculator')!;

export const metadata: Metadata = {
  title: 'SaaS Runway Calculator — Cash Burn, MRR & Months Left (2025)',
  description:
    'Free SaaS runway calculator. Enter cash balance, gross burn, MRR, and growth rate to see exactly how many months of runway you have left, with a month-by-month cash chart.',
  keywords: [
    'saas runway calculator',
    'startup runway',
    'burn rate calculator',
    'cash runway',
    'net burn',
    'gross burn',
    'mrr calculator',
    'break even mrr',
  ],
  alternates: { canonical: calc.href },
  openGraph: {
    title: 'SaaS Runway Calculator — Cash Burn, MRR & Months Left (2025)',
    description:
      'Calculate your startup runway in months. Cash balance, gross burn, MRR, and growth rate — with a month-by-month visual breakdown.',
    url: `${siteConfig.url}${calc.href}`,
    type: 'website',
  },
};

export default function SaasRunwayPage() {
  return (
    <CalculatorPageShell
      title={calc.title}
      tagline={calc.tagline}
      category={calc.category}
      icon={calc.icon}
      accent={calc.accent}
    >
      <section aria-label="SaaS runway calculator tool" className="mb-16">
        <RunwayCalculator />
      </section>

      <section aria-label="SaaS runway guide" className="border-t border-slate-200 pt-12">
        <RunwayArticle />
      </section>
    </CalculatorPageShell>
  );
}

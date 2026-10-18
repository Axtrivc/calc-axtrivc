import type { Metadata } from 'next';
import GuideShell from '@/components/GuideShell';
import CashFlowOnVariableIncomeGuide from '@/components/guides/cash-flow-on-variable-income';
import { guides, type Guide } from '@/lib/guides';
import { siteConfig } from '@/lib/site';

// The registry (lib/guides.ts) is the single source of truth for title,
// description, reading time, and related instruments — the page mirrors it
// rather than restating it. This wave's integration agent owns that file, so
// the entry may land after this page does; until it does, a local fallback
// keeps the module from crashing the static build in the window between the
// two commits. The registry wins the moment its entry exists — this object
// then becomes dead code — and its fields are exactly the ones the wave brief
// fixed (slug, title, 14 minutes, the three instruments in decision order).
// Do not let the two diverge.
const FALLBACK_GUIDE: Guide = {
  slug: 'cash-flow-on-variable-income',
  href: '/guides/cash-flow-on-variable-income/',
  title: 'Cash Flow on Variable Income',
  description:
    'Lumpy income fails as a schedule, not an income: this guide splits every deposit across operating, tax, and owner-pay accounts, sets a fixed salary from the target-income method, sizes the buffer in months of the must-pay floor and thickens it for slow collection terms, reserves tax at the current-year line while remitting on the smallest §6654 safe harbor, and orders the bad-month levers — collect, cut, then draw.',
  minutes: 14,
  related: [
    'freelance-hourly-rate-calculator',
    'late-payment-cost-calculator',
    'quarterly-estimated-tax-calculator',
  ],
};
const guide = guides.find((g) => g.slug === 'cash-flow-on-variable-income') ?? FALLBACK_GUIDE;

const TITLE = `${guide.title} — Owner Pay, Tax Reserves & the Buffer`;

export const metadata: Metadata = {
  title: TITLE,
  description: guide.description,
  keywords: [
    'cash flow on variable income',
    'profit first accounts',
    'pay yourself a salary freelancer',
    'self employed emergency fund',
    'tax reserve variable income',
    'quarterly taxes safe harbor',
  ],
  alternates: { canonical: guide.href },
  openGraph: {
    title: TITLE,
    description: guide.description,
    url: `${siteConfig.url}${guide.href}`,
    type: 'article',
  },
};

/**
 * /guides/cash-flow-on-variable-income/ — the variable-income cash-flow
 * playbook: the three-account split (operating / tax / owner pay), the salary
 * set by the target-income method, the tax reserve ladder across the three
 * §6654 safe harbors, the buffer sized in floor-months and thickened by
 * collection terms, and the collect-cut-draw order for bad months. The page
 * owns metadata and the Article structured data; GuideShell owns the chrome
 * (breadcrumb, title, reading time, instrument panel); the body component
 * owns the prose and computes every figure at module scope from the same
 * engines the instruments run. `guide` is resolved from the registry — with a
 * transitional local fallback until the integration agent's entry lands — so
 * this page tracks the index card the moment that entry exists.
 */
export default function CashFlowOnVariableIncomePage() {
  // Article structured data — fields kept to what is verifiable: identity,
  // placement, authorship, and the registry's own reading time. No
  // publication date is invented (the registry carries none); search engines
  // treat it as optional for evergreen guides.
  const articleJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: guide.title,
    description: guide.description,
    inLanguage: 'en',
    mainEntityOfPage: `${siteConfig.url}${guide.href}`,
    url: `${siteConfig.url}${guide.href}`,
    image: `${siteConfig.url}${siteConfig.ogImage}`,
    timeRequired: `PT${guide.minutes}M`,
    author: { '@type': 'Organization', name: siteConfig.name, url: siteConfig.url },
    publisher: { '@type': 'Organization', name: siteConfig.name, url: siteConfig.url },
    isPartOf: { '@type': 'CollectionPage', name: 'CalcSuite Guides', url: `${siteConfig.url}/guides/` },
    about: { '@type': 'Thing', name: 'Managing cash flow on variable self-employment income' },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }}
      />
      <GuideShell guide={guide}>
        <CashFlowOnVariableIncomeGuide />
      </GuideShell>
    </>
  );
}

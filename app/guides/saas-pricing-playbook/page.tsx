import type { Metadata } from 'next';
import GuideShell from '@/components/GuideShell';
import SaasPricingPlaybookGuide from '@/components/guides/saas-pricing-playbook';
import { guides } from '@/lib/guides';
import { siteConfig } from '@/lib/site';

const guide = guides.find((g) => g.slug === 'saas-pricing-playbook')!;

const TITLE = `${guide.title} — How to Price Subscription Software`;

export const metadata: Metadata = {
  title: TITLE,
  description: guide.description,
  keywords: [
    'saas pricing guide',
    'how to price a saas product',
    'saas pricing strategy',
    'annual vs monthly billing',
    'saas discount strategy',
    'ltv cac ratio',
    'saas price increase',
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
 * /guides/saas-pricing-playbook/ — the SaaS pricing decision playbook: cost
 * floor, value ceiling, and competitor anchor; the billing-term and discount
 * decisions priced as financing and volume contracts; raise mechanics; and the
 * LTV:CAC band that closes the loop. The page owns metadata and the Article
 * structured data; GuideShell owns the chrome (breadcrumb, title, reading
 * time, instrument panel) and the body component owns the prose. `guide` is
 * resolved from the registry so this page can never drift from the index
 * card's title, description, or href.
 */
export default function SaasPricingPlaybookPage() {
  // Article structured data — fields kept to what is verifiable: identity,
  // placement, and authorship. No publication date is invented (the registry
  // carries none); search engines treat it as optional for evergreen guides.
  const articleJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: guide.title,
    description: guide.description,
    inLanguage: 'en',
    mainEntityOfPage: `${siteConfig.url}${guide.href}`,
    url: `${siteConfig.url}${guide.href}`,
    image: `${siteConfig.url}${siteConfig.ogImage}`,
    author: { '@type': 'Organization', name: siteConfig.name, url: siteConfig.url },
    publisher: { '@type': 'Organization', name: siteConfig.name, url: siteConfig.url },
    isPartOf: { '@type': 'WebSite', name: siteConfig.name, url: siteConfig.url },
    about: { '@type': 'Thing', name: 'SaaS pricing' },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }}
      />
      <GuideShell guide={guide}>
        <SaasPricingPlaybookGuide />
      </GuideShell>
    </>
  );
}

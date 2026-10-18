import type { Metadata } from 'next';
import GuideShell from '@/components/GuideShell';
import PricingFreelanceWorkGuide from '@/components/guides/pricing-freelance-work';
import { guides } from '@/lib/guides';
import { siteConfig } from '@/lib/site';

const guide = guides.find((g) => g.slug === 'pricing-freelance-work')!;

const TITLE = `${guide.title} — How to Set Your Freelance Rate`;

export const metadata: Metadata = {
  title: TITLE,
  description: guide.description,
  keywords: [
    'freelance pricing guide',
    'how to price freelance work',
    'freelance hourly rate',
    'day rate pricing',
    'discount cost calculator',
    '1099 vs w2 negotiation',
    'freelance rate floor',
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
 * /guides/pricing-freelance-work/ — the Price-stage decision playbook. The
 * page owns metadata and the Article structured data; GuideShell owns the
 * chrome (breadcrumb, title, reading time, instrument panel) and the body
 * component owns the prose. `guide` is resolved from the registry so this
 * page can never drift from the index card's title, description, or href.
 */
export default function PricingFreelanceWorkPage() {
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
    about: { '@type': 'Thing', name: 'Freelance pricing' },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }}
      />
      <GuideShell guide={guide}>
        <PricingFreelanceWorkGuide />
      </GuideShell>
    </>
  );
}

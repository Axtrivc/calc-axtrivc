import type { Metadata } from 'next';
import GuideShell from '@/components/GuideShell';
import ManagingYourRunwayGuide from '@/components/guides/managing-your-runway';
import { guides, type Guide } from '@/lib/guides';
import { siteConfig } from '@/lib/site';

// Registry-driven: metadata mirrors lib/guides.ts exactly — the registry is the
// single source of truth for title, slug, reading time, and related instruments.
const guide = guides.find((g) => g.slug === 'managing-your-runway') as Guide;

const TITLE = `${guide.title} — Burn, Months Left & the Levers That Move Them`;
const KEYWORDS = [
  'runway management',
  'burn rate',
  'net burn vs gross burn',
  'cash runway calculator',
  'cost cutting',
  'payment terms cost',
  'ltv cac ratio',
  'startup cash flow',
];

export const metadata: Metadata = {
  title: TITLE,
  description: guide.description,
  keywords: KEYWORDS,
  alternates: { canonical: guide.href },
  openGraph: {
    title: TITLE,
    description: guide.description,
    url: `${siteConfig.url}${guide.href}`,
    type: 'article',
    siteName: siteConfig.name,
  },
};

/**
 * The "Managing Your Runway" guide page. Static export: an RSC that composes
 * GuideShell (breadcrumb, header, prose column, closing instrument panel)
 * with the guide body. Article JSON-LD carries the registry's reading time
 * (timeRequired) and ties the article back to the /guides collection.
 */
export default function ManagingYourRunwayPage() {
  const articleJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: guide.title,
    description: guide.description,
    inLanguage: 'en',
    url: `${siteConfig.url}${guide.href}`,
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': `${siteConfig.url}${guide.href}`,
    },
    author: { '@type': 'Organization', name: siteConfig.name, url: siteConfig.url },
    publisher: { '@type': 'Organization', name: siteConfig.name, url: siteConfig.url },
    timeRequired: `PT${guide.minutes}M`,
    about: { '@type': 'Thing', name: 'Startup runway and burn-rate management' },
    isPartOf: {
      '@type': 'CollectionPage',
      name: 'CalcSuite Guides',
      url: `${siteConfig.url}/guides/`,
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }}
      />
      <GuideShell guide={guide}>
        <ManagingYourRunwayGuide />
      </GuideShell>
    </>
  );
}

import type { Metadata } from 'next';
import GuideShell from '@/components/GuideShell';
import GettingPaidWithoutLosingMargin from '@/components/guides/getting-paid-without-losing-margin';
import { guides } from '@/lib/guides';
import { siteConfig } from '@/lib/site';

/* Registry lookup — the single source of truth for title/description/href, so
   this page's metadata can never drift from the /guides index card. */
const guide = guides.find((g) => g.slug === 'getting-paid-without-losing-margin')!;

export const metadata: Metadata = {
  title: `${guide.title} — Fees, Float & Bad Debt`,
  description: guide.description,
  keywords: [
    'payment processing fees',
    'invoice payment terms',
    'early payment discount',
    'ach vs credit card fees',
    'bad debt expectation',
    'gross margin erosion',
    'cost of capital',
  ],
  alternates: { canonical: guide.href },
  openGraph: {
    title: guide.title,
    description: guide.description,
    url: `${siteConfig.url}${guide.href}`,
    type: 'article',
  },
};

export default function GettingPaidWithoutLosingMarginPage() {
  // Article structured data — headline/description mirror the registry entry.
  const articleJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: guide.title,
    description: guide.description,
    url: `${siteConfig.url}${guide.href}`,
    mainEntityOfPage: { '@type': 'WebPage', '@id': `${siteConfig.url}${guide.href}` },
    datePublished: '2026-10-18',
    dateModified: '2026-10-18',
    inLanguage: 'en',
    articleSection: 'Payments & Margin',
    author: { '@type': 'Organization', name: siteConfig.name, url: siteConfig.url },
    publisher: {
      '@type': 'Organization',
      name: siteConfig.name,
      url: siteConfig.url,
      logo: { '@type': 'ImageObject', url: `${siteConfig.url}${siteConfig.ogImage}` },
    },
    image: `${siteConfig.url}${siteConfig.ogImage}`,
    isPartOf: { '@type': 'WebSite', name: siteConfig.name, url: siteConfig.url },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }}
      />
      <GuideShell guide={guide}>
        <GettingPaidWithoutLosingMargin />
      </GuideShell>
    </>
  );
}

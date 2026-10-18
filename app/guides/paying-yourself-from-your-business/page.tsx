import type { Metadata } from 'next';
import GuideShell from '@/components/GuideShell';
import PayingYourselfFromYourBusinessGuide from '@/components/guides/paying-yourself-from-your-business';
import { guides } from '@/lib/guides';
import { siteConfig } from '@/lib/site';

// The registry (lib/guides.ts) is the single source of truth for title,
// description, reading time, and related instruments — the page mirrors it
// rather than restating it.
const guide = guides.find((g) => g.slug === 'paying-yourself-from-your-business')!;

export const metadata: Metadata = {
  title: `${guide.title} — Owner Pay, Salary & Distributions`,
  description: guide.description,
  keywords: [
    'paying yourself from your business',
    'owners draw vs salary',
    'reasonable salary s corp',
    's corp distributions',
    'solo 401k employer contribution s corp',
    'roth vs traditional self employed',
  ],
  alternates: { canonical: guide.href },
  openGraph: {
    title: `${guide.title} — Owner Pay, Salary & Distributions`,
    description: guide.description,
    url: `${siteConfig.url}${guide.href}`,
    type: 'article',
  },
};

/**
 * The guide page: metadata + Article structured data + the shared GuideShell
 * (breadcrumb, h1, reading time, prose column, closing instruments panel).
 * All arithmetic lives in the body component, computed at build time by the
 * same engines the instruments run.
 */
export default function PayingYourselfFromYourBusinessPage() {
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
    timeRequired: `PT${guide.minutes}M`,
    author: { '@type': 'Organization', name: siteConfig.name, url: siteConfig.url },
    publisher: { '@type': 'Organization', name: siteConfig.name, url: siteConfig.url },
    isPartOf: { '@type': 'CollectionPage', name: 'CalcSuite Guides', url: `${siteConfig.url}/guides/` },
  };

  return (
    <GuideShell guide={guide}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }}
      />
      <PayingYourselfFromYourBusinessGuide />
    </GuideShell>
  );
}

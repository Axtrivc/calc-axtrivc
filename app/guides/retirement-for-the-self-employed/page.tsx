import type { Metadata } from 'next';
import GuideShell from '@/components/GuideShell';
import RetirementForTheSelfEmployedGuide from '@/components/guides/retirement-for-the-self-employed';
import { guides } from '@/lib/guides';
import { calculators, siteConfig } from '@/lib/site';

/** Registry entry is the single source of truth — title, slug, reading time
 *  and related instruments all come from lib/guides.ts, never from here. */
const guide = guides.find((g) => g.slug === 'retirement-for-the-self-employed')!;

export const metadata: Metadata = {
  title: `${guide.title} — Decision Guide`,
  description: guide.description,
  keywords: [
    'self employed retirement guide',
    'solo 401k vs sep ira',
    'self employed retirement plan',
    '415c annual additions limit',
    'roth vs traditional 401k',
    'hsa stealth retirement account',
    'catch-up contributions',
    'contribution order',
  ],
  alternates: { canonical: guide.href },
  openGraph: {
    title: `${guide.title} — Decision Guide`,
    description: guide.description,
    url: `${siteConfig.url}${guide.href}`,
    type: 'article',
  },
};

/**
 * The self-employed retirement guide page. GuideShell renders the shared
 * chrome — breadcrumb (+ its BreadcrumbList JSON-LD), h1, reading time, the
 * prose column, and the closing "Instruments used in this guide" panel
 * resolved from the registry's related slugs — so this page only contributes
 * the Article structured data and the guide body itself.
 */
export default function RetirementForTheSelfEmployedPage() {
  // Article structured data — headline and description mirror the registry;
  // `about` resolves the related instruments so search engines see the same
  // hand-off the reader sees at the bottom of the page.
  const articleJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: guide.title,
    description: guide.description,
    inLanguage: 'en-US',
    url: `${siteConfig.url}${guide.href}`,
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': `${siteConfig.url}${guide.href}`,
    },
    isPartOf: { '@type': 'WebSite', name: siteConfig.name, url: siteConfig.url },
    author: { '@type': 'Organization', name: siteConfig.name, url: siteConfig.url },
    publisher: { '@type': 'Organization', name: siteConfig.name, url: siteConfig.url },
    articleSection: 'Business Finance Guides',
    about: guide.related
      .map((slug) => calculators.find((c) => c.slug === slug))
      .filter((c): c is NonNullable<typeof c> => Boolean(c))
      .map((c) => ({
        '@type': 'SoftwareApplication',
        name: c.title,
        url: `${siteConfig.url}${c.href}`,
        applicationCategory: 'FinanceApplication',
      })),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }}
      />
      <GuideShell guide={guide}>
        <RetirementForTheSelfEmployedGuide />
      </GuideShell>
    </>
  );
}

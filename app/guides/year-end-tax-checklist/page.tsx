import type { Metadata } from 'next';
import GuideShell from '@/components/GuideShell';
import YearEndTaxChecklist from '@/components/guides/year-end-tax-checklist';
import { guides } from '@/lib/guides';
import { siteConfig } from '@/lib/site';

/* Registry identity — single source of truth: lib/guides.ts. The page's
   metadata and JSON-LD read from the registry entry so title, description,
   reading time, and href can never drift from the index card. */
const guide = guides.find((g) => g.slug === 'year-end-tax-checklist')!;

export const metadata: Metadata = {
  title: guide.title,
  description: guide.description,
  keywords: [
    'year end tax checklist',
    'q4 estimated tax',
    'safe harbor rule',
    'solo 401k deadline',
    'section 179 deadline',
    'qbi w-2 wage limit',
    'mileage log requirement',
    'home office deduction',
    'tax year close',
  ],
  alternates: { canonical: guide.href },
  openGraph: {
    title: guide.title,
    description: guide.description,
    url: `${siteConfig.url}${guide.href}`,
    type: 'article',
  },
};

/* Article structured data — reading time is the registry's own figure,
   expressed as an ISO 8601 duration. No publication date is invented (the
   registry carries none). */
const articleJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Article',
  headline: guide.title,
  description: guide.description,
  url: `${siteConfig.url}${guide.href}`,
  mainEntityOfPage: `${siteConfig.url}${guide.href}`,
  inLanguage: 'en',
  timeRequired: `PT${guide.minutes}M`,
  author: { '@type': 'Organization', name: siteConfig.name, url: siteConfig.url },
  publisher: { '@type': 'Organization', name: siteConfig.name, url: siteConfig.url },
  about: [
    { '@type': 'Thing', name: 'Year-end tax planning' },
    { '@type': 'Thing', name: 'Quarterly estimated tax' },
    { '@type': 'Thing', name: 'Section 179 deduction' },
    { '@type': 'Thing', name: 'Qualified business income deduction' },
  ],
};

export default function YearEndTaxChecklistPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }}
      />
      <GuideShell guide={guide}>
        <YearEndTaxChecklist />
      </GuideShell>
    </>
  );
}

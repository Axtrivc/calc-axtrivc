import type { Metadata } from 'next';
import GuideShell from '@/components/GuideShell';
import SelfEmployedTaxCalendar from '@/components/guides/self-employed-tax-calendar';
import { guides } from '@/lib/guides';
import { siteConfig } from '@/lib/site';

/* Registry identity — single source of truth: lib/guides.ts. The page's
   metadata and JSON-LD read from the registry entry so title, description,
   reading time, and href can never drift from the index card. */
const guide = guides.find((g) => g.slug === 'self-employed-tax-calendar')!;

export const metadata: Metadata = {
  title: guide.title,
  description: guide.description,
  keywords: [
    'self employed tax calendar',
    'quarterly estimated taxes',
    'estimated tax due dates',
    'safe harbor rule',
    'irs 1040-es',
    'solo 401k deadline',
    'sep ira deadline',
    'underpayment penalty',
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
    { '@type': 'Thing', name: 'Quarterly estimated tax' },
    { '@type': 'Thing', name: 'IRS Form 1040-ES' },
    { '@type': 'Thing', name: 'Self-employment tax' },
    { '@type': 'Thing', name: 'Solo 401(k)' },
  ],
};

export default function SelfEmployedTaxCalendarPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }}
      />
      <GuideShell guide={guide}>
        <SelfEmployedTaxCalendar />
      </GuideShell>
    </>
  );
}

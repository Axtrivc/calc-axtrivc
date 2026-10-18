import type { Metadata } from 'next';
import GuideShell from '@/components/GuideShell';
import ReadingYourCapTableGuide from '@/components/guides/reading-your-cap-table';
import { guides } from '@/lib/guides';
import { siteConfig } from '@/lib/site';

/**
 * /guides/reading-your-cap-table/ — the cap-table reading playbook.
 *
 * The registry (lib/guides.ts) is the single source of truth for title, slug,
 * reading time, and related instruments; this page resolves its entry by slug
 * so metadata and the rendered shell can never drift apart. The page supplies
 * the Article JSON-LD; GuideShell adds the BreadcrumbList and renders the
 * closing instrument panel from the registry's `related` slugs.
 */
const guide = guides.find((g) => g.slug === 'reading-your-cap-table')!;

const TITLE = `${guide.title} — Dilution, Option Pools & SAFEs, Read in Points`;

export const metadata: Metadata = {
  title: TITLE,
  description: guide.description,
  keywords: [
    'cap table guide',
    'reading a cap table',
    'dilution playbook',
    'option pool shuffle',
    'pre-money vs post-money',
    'safe conversion',
    'post-money safe',
    'founder dilution',
    'founder majority',
    'term sheet negotiation',
  ],
  alternates: { canonical: guide.href },
  openGraph: {
    title: TITLE,
    description: guide.description,
    url: `${siteConfig.url}${guide.href}`,
    type: 'article',
  },
};

/** Article structured data — headline, reading time, and publisher only;
 *  every figure inside the body is engine-computed, so nothing numeric is
 *  frozen into this blob to go stale. */
const articleJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Article',
  headline: guide.title,
  description: guide.description,
  url: `${siteConfig.url}${guide.href}`,
  mainEntityOfPage: `${siteConfig.url}${guide.href}`,
  timeRequired: `PT${guide.minutes}M`,
  inLanguage: 'en',
  isPartOf: { '@type': 'CollectionPage', name: 'CalcSuite Guides', url: `${siteConfig.url}/guides/` },
  author: { '@type': 'Organization', name: siteConfig.name, url: siteConfig.url },
  publisher: {
    '@type': 'Organization',
    name: siteConfig.name,
    url: siteConfig.url,
    logo: { '@type': 'ImageObject', url: `${siteConfig.url}${siteConfig.ogImage}` },
  },
};

export default function ReadingYourCapTablePage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }}
      />
      <GuideShell guide={guide}>
        <ReadingYourCapTableGuide />
      </GuideShell>
    </>
  );
}

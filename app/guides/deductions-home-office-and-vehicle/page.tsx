import type { Metadata } from 'next';
import GuideShell from '@/components/GuideShell';
import DeductionsHomeOfficeAndVehicleGuide from '@/components/guides/deductions-home-office-and-vehicle';
import { guides, type Guide } from '@/lib/guides';
import { siteConfig } from '@/lib/site';

/** Registry entry — the single source of truth for title/description/related. */
const GUIDE: Guide = guides.find(
  (g) => g.slug === 'deductions-home-office-and-vehicle',
)!;

const TITLE = `${GUIDE.title} — Method Math, Crossover Points & Records`;

export const metadata: Metadata = {
  title: TITLE,
  description: GUIDE.description,
  keywords: [
    'home office deduction',
    'simplified vs actual method home office',
    'standard mileage rate 2025',
    'mileage deduction',
    'business vehicle deduction',
    'self employed deductions',
    'form 8829',
    'mileage log',
  ],
  alternates: { canonical: GUIDE.href },
  openGraph: {
    title: TITLE,
    description: GUIDE.description,
    url: `${siteConfig.url}${GUIDE.href}`,
    type: 'article',
  },
};

/**
 * /guides/deductions-home-office-and-vehicle/ — static export. The page is a
 * thin composition layer: metadata above (kept in sync with lib/guides.ts by
 * reading the registry entry), an Article JSON-LD block, and the guide body
 * wrapped in GuideShell, which renders the breadcrumb, the h1, the prose
 * column, and the closing instruments panel resolved from `related`.
 */
export default function DeductionsGuidePage() {
  // Article structured data. No publication date is invented — the registry
  // carries reading time, not dates — so timeRequired stands in for the
  // guide's length signal instead.
  const articleJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: GUIDE.title,
    description: GUIDE.description,
    inLanguage: 'en',
    url: `${siteConfig.url}${GUIDE.href}`,
    mainEntityOfPage: { '@type': 'WebPage', '@id': `${siteConfig.url}${GUIDE.href}` },
    author: { '@type': 'Organization', name: siteConfig.name, url: siteConfig.url },
    publisher: { '@type': 'Organization', name: siteConfig.name, url: siteConfig.url },
    articleSection: 'Business Finance Guides',
    timeRequired: `PT${GUIDE.minutes}M`,
    about: [
      { '@type': 'Thing', name: 'Home office deduction' },
      { '@type': 'Thing', name: 'Mileage deduction' },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }}
      />
      <GuideShell guide={GUIDE}>
        <DeductionsHomeOfficeAndVehicleGuide />
      </GuideShell>
    </>
  );
}

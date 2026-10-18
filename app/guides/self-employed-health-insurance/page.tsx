import type { Metadata } from 'next';
import GuideShell from '@/components/GuideShell';
import SelfEmployedHealthInsuranceGuide from '@/components/guides/self-employed-health-insurance';
import { guides } from '@/lib/guides';
import { siteConfig } from '@/lib/site';

const guide = guides.find((g) => g.slug === 'self-employed-health-insurance')!;

const TITLE = `${guide.title} — The §162(l) Deduction, Month by Month`;

export const metadata: Metadata = {
  title: TITLE,
  description: guide.description,
  keywords: [
    'self-employed health insurance deduction',
    'section 162(l)',
    'sehi deduction rules',
    'self-employed health insurance cap',
    'health insurance qbi interaction',
    '2% shareholder s-corp health insurance',
    'hsa vs health insurance premium',
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
 * /guides/self-employed-health-insurance/ — the health-coverage decision
 * playbook. The page owns metadata and the Article structured data; GuideShell
 * owns the chrome (breadcrumb, title, reading time, instrument panel) and the
 * body component owns the prose. `guide` is resolved from the registry so this
 * page can never drift from the index card's title, description, or href.
 */
export default function SelfEmployedHealthInsurancePage() {
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
    about: { '@type': 'Thing', name: 'Self-employed health insurance (IRC §162(l))' },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }}
      />
      <GuideShell guide={guide}>
        <SelfEmployedHealthInsuranceGuide />
      </GuideShell>
    </>
  );
}

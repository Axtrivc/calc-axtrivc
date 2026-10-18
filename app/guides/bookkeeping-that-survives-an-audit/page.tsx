import type { Metadata } from 'next';
import GuideShell from '@/components/GuideShell';
import BookkeepingThatSurvivesAnAuditGuide from '@/components/guides/bookkeeping-that-survives-an-audit';
import { guides } from '@/lib/guides';
import { siteConfig } from '@/lib/site';

const guide = guides.find((g) => g.slug === 'bookkeeping-that-survives-an-audit')!;

const TITLE = `${guide.title} — Records That Defend a Deduction`;

export const metadata: Metadata = {
  title: TITLE,
  description: guide.description,
  keywords: [
    'audit proof bookkeeping',
    'small business record keeping',
    'irs record retention rules',
    'mileage log requirements',
    'substantiation section 274d',
    'home office deduction records',
    'section 179 documentation',
    'business expense receipts',
    'separate business bank account',
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
 * /guides/bookkeeping-that-survives-an-audit/ — the evidence-side companion to
 * the deductions playbook. The page owns metadata and the Article structured
 * data; GuideShell owns the chrome (breadcrumb, title, reading time,
 * instrument panel) and the body component owns the prose. `guide` is resolved
 * from the registry so this page can never drift from the index card's title,
 * description, or href.
 */
export default function BookkeepingThatSurvivesAnAuditPage() {
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
    about: { '@type': 'Thing', name: 'Small-business bookkeeping and tax records' },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }}
      />
      <GuideShell guide={guide}>
        <BookkeepingThatSurvivesAnAuditGuide />
      </GuideShell>
    </>
  );
}

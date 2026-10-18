import type { Metadata } from 'next';
import GuideShell from '@/components/GuideShell';
import HiringYourFirstEmployeeGuide from '@/components/guides/hiring-your-first-employee';
import { guides } from '@/lib/guides';
import { siteConfig } from '@/lib/site';

const guide = guides.find((g) => g.slug === 'hiring-your-first-employee')!;

const TITLE = `${guide.title} — The True Cost of a W-2 Salary`;

export const metadata: Metadata = {
  title: TITLE,
  description: guide.description,
  keywords: [
    'hiring first employee guide',
    'true cost of an employee',
    'employer payroll taxes',
    'employer fica calculator',
    'futa suta wage base',
    'employee vs contractor cost',
    'fully loaded salary cost',
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
 * /guides/hiring-your-first-employee/ — the hire-stage decision playbook. The
 * page owns metadata and the Article structured data; GuideShell owns the
 * chrome (breadcrumb, title, reading time, instrument panel) and the body
 * component owns the prose. `guide` is resolved from the registry so this
 * page can never drift from the index card's title, description, or href.
 */
export default function HiringYourFirstEmployeePage() {
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
    about: { '@type': 'Thing', name: 'Payroll and hiring costs' },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }}
      />
      <GuideShell guide={guide}>
        <HiringYourFirstEmployeeGuide />
      </GuideShell>
    </>
  );
}

import type { Metadata } from 'next';
import GuideShell from '@/components/GuideShell';
import FounderEquitySplitsGuide from '@/components/guides/founder-equity-splits';
import { guides, type Guide } from '@/lib/guides';
import { siteConfig } from '@/lib/site';

/**
 * /guides/founder-equity-splits/ — the co-founder equity split playbook.
 *
 * The registry (lib/guides.ts) is the single source of truth for title, slug,
 * reading time, and related instruments; this page resolves its entry by slug
 * so metadata and the rendered shell can never drift apart. The entry
 * (slug founder-equity-splits, 15 min, related cap-table-dilution-calculator
 * and safe-note-calculator) is registered by the integration step. Until that
 * entry lands, a bare non-null assertion would make this module THROW at
 * prerender — find returns undefined, and `!` is a type-level claim, not a
 * runtime guard — so the page falls back to an inline entry mirroring the
 * registry contract (same slug, title, reading time, related instruments, and
 * derived href) and renders standalone. Once the registry entry exists, the
 * find wins and the registry is what renders; the fallback serves only the
 * interim build. The page supplies the Article JSON-LD; GuideShell adds the
 * BreadcrumbList and renders the closing instrument panel from `related`.
 */
const FALLBACK_GUIDE: Guide = {
  slug: 'founder-equity-splits',
  href: '/guides/founder-equity-splits/',
  title: 'Splitting Equity With Co-founders',
  description:
    'The co-founder split decided the way investors expect it decided: a four-ledger contribution method with an adjustment window, four-year vesting with a one-year cliff and the buyback that backs it, the five clauses that go in the founders\u2019 agreement — including the 83(b) election and its unforgiving 30-day window — and a dilution rehearsal that runs today\u2019s split through the real financing path, engine-computed end to end.',
  minutes: 15,
  related: ['cap-table-dilution-calculator', 'safe-note-calculator'],
};
const guide = guides.find((g) => g.slug === 'founder-equity-splits') ?? FALLBACK_GUIDE;

const TITLE = `${guide.title} — Ledgers, Vesting & the 83(b) Window`;

export const metadata: Metadata = {
  title: TITLE,
  description: guide.description,
  keywords: [
    'founder equity split',
    'co-founder equity',
    'contribution ledger',
    'founders agreement',
    'vesting schedule',
    'one-year cliff',
    'restricted stock buyback',
    '83(b) election',
    'founder dilution',
    'equity renegotiation',
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

export default function FounderEquitySplitsPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }}
      />
      <GuideShell guide={guide}>
        <FounderEquitySplitsGuide />
      </GuideShell>
    </>
  );
}

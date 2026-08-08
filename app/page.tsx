import type { Metadata } from 'next';
import HomePageClient from '@/components/HomePageClient';
import { calculators, siteConfig } from '@/lib/site';

export const metadata: Metadata = {
  title: 'Free Financial & Business Calculators',
  description: siteConfig.description,
  alternates: { canonical: '/' },
};

export default function Home() {
  const itemListJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    itemListElement: calculators.map((c, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: c.title,
      url: `${siteConfig.url}${c.href}`,
    })),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListJsonLd) }}
      />
      <HomePageClient />
    </>
  );
}

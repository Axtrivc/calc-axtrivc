import type { Metadata } from 'next';
import { JetBrains_Mono } from 'next/font/google';
import './globals.css';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import MotionProvider from '@/components/MotionProvider';
import PrintExpander from '@/components/PrintExpander';
import { ToastProvider } from '@/components/Toast';
import { siteConfig, THEME_KEY } from '@/lib/site';

// Self-hosted via next/font: preloaded, no render-blocking third-party
// stylesheet, automatic display:swap.
const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-jetbrains-mono',
  weight: ['400', '500', '600', '700'],
});

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.url),
  title: {
    default: `${siteConfig.name} — Free Financial & Business Calculators`,
    template: `%s | ${siteConfig.name}`,
  },
  description: siteConfig.description,
  applicationName: siteConfig.name,
  keywords: [
    'financial calculator',
    'business calculator',
    'stripe fee calculator',
    'freelance rate calculator',
    'saas runway calculator',
    'llc vs c corp calculator',
    's corp salary calculator',
    'self employment tax calculator',
    'freelancer tools',
    'startup tools',
  ],
  authors: [{ name: siteConfig.name }],
  creator: siteConfig.name,
  publisher: siteConfig.name,
  alternates: {
    canonical: '/',
  },
  manifest: '/site.webmanifest',
  icons: {
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
    ],
    shortcut: ['/favicon.ico', '/favicon.svg'],
    apple: [
      { url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
    other: [
      { rel: 'mask-icon', url: '/favicon.svg', color: '#4F46E5' },
    ],
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: siteConfig.url,
    siteName: siteConfig.name,
    title: `${siteConfig.name} — Free Financial & Business Calculators`,
    description: siteConfig.description,
    images: [
      {
        url: siteConfig.ogImage,
        width: 1823,
        height: 863,
        alt: `${siteConfig.name} — free financial & business calculators`,
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: `${siteConfig.name} — Free Financial & Business Calculators`,
    description: siteConfig.description,
    creator: siteConfig.twitter,
    images: [siteConfig.ogImage],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
      'max-video-preview': -1,
    },
  },
  category: 'finance',
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#EEF2FF' },
    { media: '(prefers-color-scheme: dark)', color: '#0B1220' },
  ],
};

/**
 * Pre-paint theme resolution — must run before first paint to avoid a flash
 * of the wrong theme. Priority: stored choice > OS preference. Also sets
 * `color-scheme` so native form controls & scrollbars follow the theme.
 */
const themeInitScript = `(function(){try{var t=localStorage.getItem('${THEME_KEY}');var d=t?t==='dark':window.matchMedia('(prefers-color-scheme: dark)').matches;var c=d?'dark':'light';if(d)document.documentElement.classList.add('dark');document.documentElement.style.colorScheme=c;}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const orgJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: siteConfig.name,
    url: siteConfig.url,
    description: siteConfig.description,
    potentialAction: {
      '@type': 'SearchAction',
      target: `${siteConfig.url}/?q={search_term_string}`,
      'query-input': 'required name=search_term_string',
    },
  };

  return (
    <html lang="en" className={`h-full ${jetbrainsMono.variable}`} suppressHydrationWarning>
      <head>
        {/* Theme resolution must precede first paint — inline, blocking, tiny. */}
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(orgJsonLd) }}
        />
      </head>
      <body className="relative flex min-h-full flex-col font-sans">
        {/* ===== Ambient breathing light layer =====
            Two large, slow-pulsing color pools fixed behind everything. They give
            the page a sense of living atmosphere instead of a flat fill — and in
            dark mode they become low lanterns glowing out of a deep-space canvas.
            Purely decorative: aria-hidden + pointer-events-none. */}
        <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden" aria-hidden="true">
          <div className="animate-breathe-indigo absolute -left-40 -top-40 h-[500px] w-[500px] rounded-full bg-indigo-400/20 blur-[180px] dark:bg-indigo-500/[0.07] dark:blur-[200px]" />
          <div className="animate-breathe-emerald absolute -bottom-52 -right-40 h-[600px] w-[600px] rounded-full bg-emerald-400/15 blur-[180px] dark:bg-emerald-500/[0.06] dark:blur-[200px]" />
        </div>
        <MotionProvider>
          <ToastProvider>
            <Header />
            <main className="relative flex-1">{children}</main>
            <Footer />
            <PrintExpander />
          </ToastProvider>
        </MotionProvider>
      </body>
    </html>
  );
}

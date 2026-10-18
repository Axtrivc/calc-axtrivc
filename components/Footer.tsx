import Link from 'next/link';
import { Calculator } from 'lucide-react';
import { calculators, siteConfig } from '@/lib/site';
import { guides } from '@/lib/guides';
import FooterYear from '@/components/FooterYear';

export default function Footer() {
  return (
    <footer className="no-print mt-20 border-t border-slate-200/80 bg-white dark:border-white/[0.07] dark:bg-[#0a101d]">
      <div className="container-page py-12">
        {/* Brand (2 cols) + Calculators + Guides + Resources — the registry
            (lib/guides.ts) is the source of truth, so footer links can never
            drift from the index cards. */}
        <div className="grid gap-10 md:grid-cols-5">
          <div className="md:col-span-2">
            <Link href="/" className="focus-calm flex items-center gap-2 rounded-lg font-bold text-slate-900 dark:text-white">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-600 to-sky-500 text-white shadow-sm">
                <Calculator className="h-5 w-5" aria-hidden="true" />
              </span>
              <span className="text-lg tracking-tight">CalcSuite</span>
            </Link>
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-slate-600 dark:text-slate-400">
              Free, accurate financial and business calculators for freelancers, startups, and small
              businesses. No sign-up, no ads in the tools — just the numbers you need.
            </p>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-200">Calculators</h3>
            <ul className="mt-4 space-y-2.5 text-sm">
              {calculators.map((c) => (
                <li key={c.slug}>
                  <Link href={c.href} className="focus-calm rounded-sm text-slate-600 transition hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-300">
                    {c.title}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-200">Guides</h3>
            <ul className="mt-4 space-y-2.5 text-sm">
              {guides.map((g) => (
                <li key={g.slug}>
                  <Link href={g.href} className="focus-calm rounded-sm text-slate-600 transition hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-300">
                    {g.title}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-200">Resources</h3>
            <ul className="mt-4 space-y-2.5 text-sm">
              <li>
                <Link href="/" className="focus-calm rounded-sm text-slate-600 transition hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-300">
                  All calculators
                </Link>
              </li>
              <li>
                <Link href="/guides/" className="focus-calm rounded-sm text-slate-600 transition hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-300">
                  All guides
                </Link>
              </li>
              <li>
                <a href="/sitemap.xml" className="focus-calm rounded-sm text-slate-600 transition hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-300">
                  Sitemap
                </a>
              </li>
              <li>
                <a href="/robots.txt" className="focus-calm rounded-sm text-slate-600 transition hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-300">
                  Robots
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-10 border-t border-slate-200 pt-6 dark:border-white/[0.07]">
          <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400">
            <strong className="font-semibold text-slate-600 dark:text-slate-400">Disclaimer:</strong> CalcSuite provides
            general estimation tools for informational purposes only and does not constitute legal,
            tax, accounting, or financial advice. Tax laws, payment processor fees, and financial
            regulations change frequently and vary by jurisdiction. Always consult a qualified
            professional before making business or tax decisions.
          </p>
          <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">
            &copy; <FooterYear /> {siteConfig.name}. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}

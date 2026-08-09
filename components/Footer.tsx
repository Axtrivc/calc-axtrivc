import Link from 'next/link';
import { Calculator } from 'lucide-react';
import { calculators, siteConfig } from '@/lib/site';

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="mt-20 border-t border-slate-200/80 bg-white">
      <div className="container-page py-12">
        <div className="grid gap-10 md:grid-cols-4">
          <div className="md:col-span-2">
            <Link href="/" className="flex items-center gap-2 font-bold text-slate-900">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-600 to-sky-500 text-white shadow-sm">
                <Calculator className="h-5 w-5" aria-hidden="true" />
              </span>
              <span className="text-lg tracking-tight">CalcSuite</span>
            </Link>
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-slate-600">
              Free, accurate financial and business calculators for freelancers, startups, and small
              businesses. No sign-up, no ads in the tools — just the numbers you need.
            </p>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-slate-900">Calculators</h3>
            <ul className="mt-4 space-y-2.5 text-sm">
              {calculators.map((c) => (
                <li key={c.slug}>
                  <Link href={c.href} className="text-slate-600 transition hover:text-indigo-600">
                    {c.title}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-slate-900">Resources</h3>
            <ul className="mt-4 space-y-2.5 text-sm">
              <li>
                <Link href="/" className="text-slate-600 transition hover:text-indigo-600">
                  All calculators
                </Link>
              </li>
              <li>
                <a href="/sitemap.xml" className="text-slate-600 transition hover:text-indigo-600">
                  Sitemap
                </a>
              </li>
              <li>
                <a href="/robots.txt" className="text-slate-600 transition hover:text-indigo-600">
                  Robots
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-10 border-t border-slate-200 pt-6">
          <p className="text-xs leading-relaxed text-slate-500">
            <strong className="font-semibold text-slate-600">Disclaimer:</strong> CalcSuite provides
            general estimation tools for informational purposes only and does not constitute legal,
            tax, accounting, or financial advice. Tax laws, payment processor fees, and financial
            regulations change frequently and vary by jurisdiction. Always consult a qualified
            professional before making business or tax decisions.
          </p>
          <p className="mt-4 text-sm text-slate-500">
            &copy; {year} {siteConfig.name}. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}

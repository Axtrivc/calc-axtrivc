import Link from 'next/link';
import { Calculator } from 'lucide-react';
import { calculators, siteConfig } from '@/lib/site';

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="relative z-10 mt-20 border-t border-slate-800 bg-base-900/60 backdrop-blur-xl">
      <div className="h-px w-full bg-gradient-to-r from-transparent via-cyan-500/30 to-transparent" />
      <div className="container-page py-12">
        <div className="grid gap-10 md:grid-cols-4">
          <div className="md:col-span-2">
            <Link href="/" className="flex items-center gap-2 font-bold text-white">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-cyan-500 to-purple-500 text-base-900 shadow-glow-cyan">
                <Calculator className="h-5 w-5" aria-hidden="true" />
              </span>
              <span className="text-lg tracking-tight">
                Calc<span className="text-cyan-400">Suite</span>
              </span>
            </Link>
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-slate-400">
              Free, accurate financial and business calculators for freelancers, startups, and small
              businesses. No sign-up, no ads in the tools — just the numbers you need.
            </p>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-white">Calculators</h3>
            <ul className="mt-4 space-y-2.5 text-sm">
              {calculators.map((c) => (
                <li key={c.slug}>
                  <Link href={c.href} className="text-slate-400 transition hover:text-cyan-300">
                    {c.title}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-white">Resources</h3>
            <ul className="mt-4 space-y-2.5 text-sm">
              <li>
                <Link href="/" className="text-slate-400 transition hover:text-cyan-300">
                  All calculators
                </Link>
              </li>
              <li>
                <a href="/sitemap.xml" className="text-slate-400 transition hover:text-cyan-300">
                  Sitemap
                </a>
              </li>
              <li>
                <a href="/robots.txt" className="text-slate-400 transition hover:text-cyan-300">
                  Robots
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-10 border-t border-slate-800 pt-6">
          <p className="text-xs leading-relaxed text-slate-500">
            <strong className="font-semibold text-slate-400">Disclaimer:</strong> CalcSuite provides
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

'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Calculator, Menu, X } from 'lucide-react';
import { calculators } from '@/lib/site';

export default function Header() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-slate-800 bg-base-800/70 backdrop-blur-xl supports-[backdrop-filter]:bg-base-800/60">
      {/* Top neon accent line */}
      <div className="h-px w-full bg-gradient-to-r from-transparent via-cyan-500/50 to-transparent" />
      <nav className="container-page flex h-16 items-center justify-between" aria-label="Main">
        <Link href="/" className="group flex items-center gap-2 font-bold text-white">
          <span className="relative flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-cyan-500 to-purple-500 text-base-900 shadow-glow-cyan transition group-hover:shadow-glow-cyan-lg">
            <Calculator className="h-5 w-5" aria-hidden="true" />
          </span>
          <span className="text-lg tracking-tight">
            Calc<span className="text-cyan-400">Suite</span>
          </span>
        </Link>

        <div className="hidden items-center gap-1 md:flex">
          {calculators.map((c) => (
            <Link
              key={c.slug}
              href={c.href}
              className="rounded-md px-3 py-2 text-sm font-medium text-slate-400 transition hover:bg-slate-800/60 hover:text-cyan-300"
            >
              {c.shortTitle ?? c.title}
            </Link>
          ))}
        </div>

        <button
          type="button"
          className="inline-flex items-center justify-center rounded-md border border-slate-700 bg-base-700/60 p-2 text-slate-300 transition hover:border-cyan-500/40 hover:text-cyan-300 md:hidden"
          aria-expanded={open}
          aria-controls="mobile-menu"
          onClick={() => setOpen((v) => !v)}
        >
          <span className="sr-only">{open ? 'Close menu' : 'Open menu'}</span>
          {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </nav>

      {open && (
        <div id="mobile-menu" className="border-t border-slate-800 bg-base-800/95 backdrop-blur-xl md:hidden">
          <div className="container-page space-y-1 py-3">
            {calculators.map((c) => (
              <Link
                key={c.slug}
                href={c.href}
                className="block rounded-md px-3 py-2 text-base font-medium text-slate-300 transition hover:bg-slate-800/60 hover:text-cyan-300"
                onClick={() => setOpen(false)}
              >
                {c.title}
              </Link>
            ))}
          </div>
        </div>
      )}
    </header>
  );
}

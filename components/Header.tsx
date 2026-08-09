'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Calculator, Menu, X } from 'lucide-react';
import { calculators } from '@/lib/site';

export default function Header() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/80 backdrop-blur-md supports-[backdrop-filter]:bg-white/70">
      <nav className="container-page flex h-16 items-center justify-between" aria-label="Main">
        <Link href="/" className="flex items-center gap-2 font-bold text-slate-900">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-600 to-sky-500 text-white shadow-sm">
            <Calculator className="h-5 w-5" aria-hidden="true" />
          </span>
          <span className="text-lg tracking-tight">CalcSuite</span>
        </Link>

        <div className="hidden items-center gap-1 md:flex">
          {calculators.map((c) => (
            <Link
              key={c.slug}
              href={c.href}
              className="rounded-md px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
            >
              {c.shortTitle ?? c.title}
            </Link>
          ))}
        </div>

        <button
          type="button"
          className="inline-flex items-center justify-center rounded-md border border-slate-200 bg-white p-2 text-slate-600 transition hover:bg-slate-50 hover:text-slate-900 md:hidden"
          aria-expanded={open}
          aria-controls="mobile-menu"
          onClick={() => setOpen((v) => !v)}
        >
          <span className="sr-only">{open ? 'Close menu' : 'Open menu'}</span>
          {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </nav>

      {open && (
        <div id="mobile-menu" className="border-t border-slate-200 bg-white md:hidden">
          <div className="container-page space-y-1 py-3">
            {calculators.map((c) => (
              <Link
                key={c.slug}
                href={c.href}
                className="block rounded-md px-3 py-2 text-base font-medium text-slate-700 transition hover:bg-slate-100"
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

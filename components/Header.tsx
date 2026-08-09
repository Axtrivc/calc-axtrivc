'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Calculator, Menu, X, Search } from 'lucide-react';
import { calculators } from '@/lib/site';
import CommandPalette from '@/components/CommandPalette';

export default function Header() {
  const [open, setOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const pathname = usePathname();

  // Normalize trailing slashes so "/stripe-fee-calculator/" matches its link.
  const norm = (p: string) => (p.length > 1 ? p.replace(/\/+$/, '') : p);
  const current = norm(pathname ?? '/');

  // Global ⌘K / Ctrl+K opens the command palette on any page.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/80 backdrop-blur-md supports-[backdrop-filter]:bg-white/70">
        <nav className="container-page flex h-16 items-center justify-between" aria-label="Main">
          <Link href="/" className="flex items-center gap-2 font-bold text-slate-900">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-600 to-sky-500 text-white shadow-sm">
              <Calculator className="h-5 w-5" aria-hidden="true" />
            </span>
            <span className="text-lg tracking-tight">CalcSuite</span>
          </Link>

          <div className="hidden items-center gap-1 md:flex">
            {calculators.map((c) => {
              const isActive = current === norm(c.href);
              return (
                <Link
                  key={c.slug}
                  href={c.href}
                  aria-current={isActive ? 'page' : undefined}
                  className={`rounded-md px-3 py-2 text-sm font-medium transition ${
                    isActive
                      ? 'bg-indigo-50 text-indigo-700'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  {c.shortTitle ?? c.title}
                </Link>
              );
            })}

            {/* ⌘K launcher */}
            <button
              type="button"
              onClick={() => setPaletteOpen(true)}
              className="ml-2 inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-500 transition hover:border-indigo-300 hover:text-indigo-600"
              aria-label="Open command palette (Ctrl+K)"
            >
              <Search className="h-3.5 w-3.5" aria-hidden="true" />
              <kbd className="font-mono text-[10px]">Ctrl K</kbd>
            </button>
          </div>

          <div className="flex items-center gap-2 md:hidden">
            <button
              type="button"
              onClick={() => setPaletteOpen(true)}
              className="inline-flex items-center justify-center rounded-md border border-slate-200 bg-white p-2 text-slate-600 transition hover:bg-slate-50"
              aria-label="Open command palette"
            >
              <Search className="h-5 w-5" />
            </button>
            <button
              type="button"
              className="inline-flex items-center justify-center rounded-md border border-slate-200 bg-white p-2 text-slate-600 transition hover:bg-slate-50 hover:text-slate-900"
              aria-expanded={open}
              aria-controls="mobile-menu"
              onClick={() => setOpen((v) => !v)}
            >
              <span className="sr-only">{open ? 'Close menu' : 'Open menu'}</span>
              {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </nav>

        {open && (
          <div id="mobile-menu" className="border-t border-slate-200 bg-white md:hidden">
            <div className="container-page space-y-1 py-3">
              {calculators.map((c) => {
                const isActive = current === norm(c.href);
                return (
                  <Link
                    key={c.slug}
                    href={c.href}
                    onClick={() => setOpen(false)}
                    aria-current={isActive ? 'page' : undefined}
                    className={`block rounded-md px-3 py-2 text-base font-medium transition ${
                      isActive ? 'bg-indigo-50 text-indigo-700' : 'text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    {c.title}
                  </Link>
                );
              })}
            </div>
          </div>
        )}
      </header>

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </>
  );
}

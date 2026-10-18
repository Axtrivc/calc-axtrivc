'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Calculator,
  Menu,
  X,
  Search,
  ChevronDown,
  CreditCard,
  Clock,
  TrendingUp,
  Building2,
  Landmark,
  type LucideIcon,
} from 'lucide-react';
import { calculators } from '@/lib/site';
import CommandPalette from '@/components/CommandPalette';
import ThemeToggle from '@/components/ThemeToggle';

const iconMap: Record<string, LucideIcon> = {
  CreditCard,
  Clock,
  TrendingUp,
  Building2,
  Landmark,
};

/** Workflow order — the desktop menu mirrors the suite's five-stage narrative. */
const orderedCalculators = [...calculators].sort((a, b) => a.stage - b.stage);

export default function Header() {
  const [open, setOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const pathname = usePathname();
  const menuRef = useRef<HTMLDivElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  // Normalize trailing slashes so "/stripe-fee-calculator/" matches its link.
  const norm = (p: string) => (p.length > 1 ? p.replace(/\/+$/, '') : p);
  const current = norm(pathname ?? '/');
  const onToolPage = calculators.some((c) => current === norm(c.href));

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

  // Route change always dismisses the instruments menu.
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  // Outside pointer press + Escape close the menu; Escape returns focus to the
  // trigger so keyboard users are never dropped onto <body>.
  useEffect(() => {
    if (!menuOpen) return;
    function onPointerDown(e: PointerEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setMenuOpen(false);
        menuButtonRef.current?.focus();
      }
    }
    window.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  return (
    <>
      <header className="no-print sticky top-0 z-40 border-b border-slate-200/80 bg-white/80 backdrop-blur-md supports-[backdrop-filter]:bg-white/70 dark:border-white/[0.07] dark:bg-[#0b1220]/80 dark:supports-[backdrop-filter]:bg-[#0b1220]/65">
        <nav className="container-page flex h-16 items-center justify-between" aria-label="Main">
          <Link
            href="/"
            className="focus-calm flex items-center gap-2 rounded-lg font-bold text-slate-900 dark:text-white"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-600 to-sky-500 text-white shadow-sm">
              <Calculator className="h-5 w-5" aria-hidden="true" />
            </span>
            <span className="text-lg tracking-tight">CalcSuite</span>
          </Link>

          <div className="hidden items-center gap-1 md:flex">
            {/* Instruments menu — with twenty-one tools a flat link bar overflows
                the container; one stage-ordered dropdown keeps the bar quiet and
                the whole suite navigable (⌘K covers direct jumps). The panel is
                height-capped and scrolls, like the mobile menu, so the full list
                stays reachable on short viewports. */}
            <div
              ref={menuRef}
              className="relative"
              onBlur={(e) => {
                // Keyboard focus leaving the menu closes it. Pointer presses
                // are handled by the outside-pointerdown listener above.
                if (e.relatedTarget && !menuRef.current?.contains(e.relatedTarget as Node)) {
                  setMenuOpen(false);
                }
              }}
            >
              <button
                ref={menuButtonRef}
                type="button"
                onClick={() => setMenuOpen((v) => !v)}
                aria-expanded={menuOpen}
                aria-haspopup="true"
                aria-controls="calculators-menu"
                className={`focus-calm inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition ${
                  menuOpen || onToolPage
                    ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-white/[0.06] dark:hover:text-slate-100'
                }`}
              >
                Calculators
                <ChevronDown
                  className={`h-4 w-4 transition-transform duration-200 ${menuOpen ? 'rotate-180' : ''}`}
                  aria-hidden="true"
                />
              </button>

              <AnimatePresence>
                {menuOpen && (
                  <motion.div
                    id="calculators-menu"
                    initial={{ opacity: 0, y: 6, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 4, scale: 0.98 }}
                    transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                    className="absolute right-0 top-full z-50 mt-2 max-h-[calc(100dvh-6rem)] w-[min(36rem,calc(100vw-2rem))] overflow-y-auto overscroll-contain rounded-2xl border border-white/80 bg-white/95 shadow-[0_24px_60px_rgba(15,23,42,0.18)] backdrop-blur-xl dark:border-white/10 dark:bg-[#101a2e]/95 dark:shadow-[0_24px_60px_rgba(0,0,0,0.6)]"
                  >
                    <div className="grid gap-1 p-2 sm:grid-cols-2">
                      {orderedCalculators.map((c) => {
                        const isActive = current === norm(c.href);
                        const Icon = iconMap[c.icon] ?? Calculator;
                        return (
                          <Link
                            key={c.slug}
                            href={c.href}
                            onClick={() => setMenuOpen(false)}
                            aria-current={isActive ? 'page' : undefined}
                            className={`focus-calm flex items-center gap-2.5 rounded-xl px-2.5 py-2 transition ${
                              isActive
                                ? 'bg-indigo-50 dark:bg-indigo-500/15'
                                : 'hover:bg-slate-50 dark:hover:bg-white/[0.05]'
                            }`}
                          >
                            <span className="readout w-6 shrink-0 text-[10px] font-bold tracking-widest text-slate-300 dark:text-slate-500">
                              {String(c.stage).padStart(2, '0')}
                            </span>
                            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500 dark:bg-white/[0.07] dark:text-slate-400">
                              <Icon className="h-4 w-4" aria-hidden="true" />
                            </span>
                            <span className="min-w-0">
                              <span className="block truncate text-sm font-semibold text-slate-800 dark:text-slate-200">
                                {c.shortTitle ?? c.title}
                              </span>
                              <span className="block truncate font-mono text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400">
                                {c.stageLabel}
                              </span>
                            </span>
                          </Link>
                        );
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* ⌘K launcher */}
            <button
              type="button"
              onClick={() => setPaletteOpen(true)}
              className="focus-calm ml-1.5 inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-500 transition hover:border-indigo-300 hover:text-indigo-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-400 dark:hover:border-indigo-400/50 dark:hover:text-indigo-300"
              aria-label="Open command palette (Ctrl+K)"
            >
              <Search className="h-3.5 w-3.5" aria-hidden="true" />
              <kbd className="font-mono text-[10px]">Ctrl K</kbd>
            </button>
            <div className="ml-1.5">
              <ThemeToggle />
            </div>
          </div>

          <div className="flex items-center gap-2 md:hidden">
            <ThemeToggle />
            <button
              type="button"
              onClick={() => setPaletteOpen(true)}
              className="focus-calm inline-flex items-center justify-center rounded-md border border-slate-200 bg-white p-2 text-slate-600 transition hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-400 dark:hover:bg-white/[0.08]"
              aria-label="Open command palette"
            >
              <Search className="h-5 w-5" />
            </button>
            <button
              type="button"
              className="focus-calm inline-flex items-center justify-center rounded-md border border-slate-200 bg-white p-2 text-slate-600 transition hover:bg-slate-50 hover:text-slate-900 dark:border-white/10 dark:bg-white/5 dark:text-slate-400 dark:hover:bg-white/[0.08] dark:hover:text-white"
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
          <div
            id="mobile-menu"
            className="max-h-[calc(100dvh-4rem)] overflow-y-auto border-t border-slate-200 bg-white md:hidden dark:border-white/[0.07] dark:bg-[#0e1628]"
          >
            <div className="container-page space-y-1 py-3">
              {orderedCalculators.map((c) => {
                const isActive = current === norm(c.href);
                return (
                  <Link
                    key={c.slug}
                    href={c.href}
                    onClick={() => setOpen(false)}
                    aria-current={isActive ? 'page' : undefined}
                    className={`focus-calm block rounded-md px-3 py-2 text-base font-medium transition ${
                      isActive
                        ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300'
                        : 'text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/[0.06]'
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

'use client';

import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';
import { THEME_KEY } from '@/lib/workbench';

type Theme = 'light' | 'dark';

/**
 * Ambient theme toggle — the only piece of theme state that lives in React.
 *
 * The class itself is applied pre-paint by an inline script in app/layout.tsx
 * (no flash of wrong theme), and this component merely:
 *   - mirrors the current theme for its icon,
 *   - flips the class + `color-scheme` on <html>,
 *   - persists the choice (localStorage, workbench namespace),
 *   - keeps <meta name="theme-color"> in sync so the browser chrome follows.
 *
 * Until mount it renders a neutral placeholder so SSR and first client paint
 * always agree regardless of the active theme.
 */
export function applyTheme(theme: Theme) {
  const root = document.documentElement;
  root.classList.toggle('dark', theme === 'dark');
  root.style.colorScheme = theme;
  try {
    window.localStorage.setItem(THEME_KEY, theme);
  } catch {
    /* storage blocked — theme still applies for this visit */
  }
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', theme === 'dark' ? '#0b1220' : '#eef2ff');
}

export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme | null>(null);

  // Read the class the pre-paint script already applied — the DOM is the
  // single source of truth, so this can never disagree with what rendered.
  useEffect(() => {
    setTheme(document.documentElement.classList.contains('dark') ? 'dark' : 'light');
  }, []);

  // While no explicit choice is stored, track the OS preference live so the
  // site follows system theme changes without a reload.
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    function onChange(e: MediaQueryListEvent) {
      let stored: string | null = null;
      try {
        stored = window.localStorage.getItem(THEME_KEY);
      } catch {
        /* ignore */
      }
      if (!stored) {
        applyTheme(e.matches ? 'dark' : 'light');
        setTheme(e.matches ? 'dark' : 'light');
      }
    }
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  function toggle() {
    const next: Theme = theme === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    setTheme(next);
  }

  return (
    <button
      type="button"
      onClick={toggle}
      className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition hover:border-indigo-300 hover:text-indigo-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-400 dark:hover:border-indigo-400/50 dark:hover:text-indigo-300"
      aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
      title={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
    >
      {theme === null ? (
        // Pre-hydration placeholder: same footprint, no icon mismatch.
        <span className="h-[18px] w-[18px]" aria-hidden="true" />
      ) : theme === 'dark' ? (
        <Sun className="h-[18px] w-[18px]" aria-hidden="true" />
      ) : (
        <Moon className="h-[18px] w-[18px]" aria-hidden="true" />
      )}
    </button>
  );
}

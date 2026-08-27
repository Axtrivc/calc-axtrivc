'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Calculator,
  Clock,
  TrendingUp,
  Building2,
  CreditCard,
  Search,
  Trash2,
  Home,
  CornerDownLeft,
  type LucideIcon,
} from 'lucide-react';
import { calculators } from '@/lib/site';
import { clearWorkbench } from '@/lib/workbench';
import { useToast } from '@/components/Toast';

const iconMap: Record<string, LucideIcon> = {
  CreditCard,
  Clock,
  TrendingUp,
  Building2,
};

type PaletteItem = {
  id: string;
  kind: 'calculator' | 'action';
  title: string;
  subtitle: string;
  icon: LucideIcon;
  keywords: string;
  run: () => void;
};

/**
 * ⌘K command palette — the workbench's quick launcher.
 *
 * Lists every calculator plus a few workspace actions; arrow keys + Enter
 * navigate, Esc closes. Mounted once in the Header so it works on any page.
 */
export default function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const { show } = useToast();
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  // Where focus was before the palette opened — restored on close so keyboard
  // users are never dropped onto <body>.
  const restoreFocusRef = useRef<HTMLElement | null>(null);

  const items = useMemo<PaletteItem[]>(() => {
    const calcItems: PaletteItem[] = calculators.map((c) => ({
      id: c.slug,
      kind: 'calculator',
      title: c.title,
      subtitle: c.tagline,
      icon: iconMap[c.icon] ?? Calculator,
      keywords: [c.title, c.category, c.tagline, ...c.tags].join(' ').toLowerCase(),
      run: () => {
        onClose();
        router.push(c.href);
      },
    }));
    const actions: PaletteItem[] = [
      {
        id: 'action-home',
        kind: 'action',
        title: 'Go to workbench home',
        subtitle: 'All calculators, pins & saved scenarios',
        icon: Home,
        keywords: 'home dashboard workbench overview',
        run: () => {
          onClose();
          router.push('/');
        },
      },
      {
        id: 'action-clear',
        kind: 'action',
        title: 'Clear workbench data',
        subtitle: 'Forget pins, recents, saved inputs & scenarios',
        icon: Trash2,
        keywords: 'clear reset wipe privacy local storage',
        run: () => {
          clearWorkbench();
          onClose();
          show('Workbench data cleared', 'info');
          window.setTimeout(() => window.location.reload(), 350);
        },
      },
    ];
    return [...calcItems, ...actions];
  }, [onClose, router, show]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((it) => it.keywords.includes(q) || it.title.toLowerCase().includes(q));
  }, [items, query]);

  // Reset query + selection each time the palette opens: focus the input, lock
  // body scroll, and remember where to return focus when it closes.
  useEffect(() => {
    if (!open) return;
    restoreFocusRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setQuery('');
    setActive(0);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const t = window.setTimeout(() => inputRef.current?.focus(), 10);
    return () => {
      window.clearTimeout(t);
      document.body.style.overflow = prevOverflow;
      restoreFocusRef.current?.focus?.();
    };
  }, [open]);

  useEffect(() => {
    setActive(0);
  }, [query]);

  // Key handling lives on the dialog container so it works no matter which
  // child currently holds focus (events bubble up from the input).
  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      filtered[active]?.run();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    } else if (e.key === 'Tab') {
      // Focus trap: the input is the only tabbable control (options are
      // navigated with arrows + aria-activedescendant), so keep Tab inside.
      e.preventDefault();
      inputRef.current?.focus();
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[90] flex items-start justify-center bg-slate-900/25 px-4 pt-[12vh] backdrop-blur-[2px]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) onClose();
          }}
          onKeyDown={onKeyDown}
          role="dialog"
          aria-modal="true"
          aria-label="Command palette"
        >
          <motion.div
            className="w-full max-w-xl overflow-hidden rounded-2xl border border-white/80 bg-white/95 shadow-[0_24px_60px_rgba(15,23,42,0.22)] backdrop-blur-xl"
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 380, damping: 30 }}
          >
            {/* Search field */}
            <div className="flex items-center gap-3 border-b border-slate-100 px-4 py-3.5">
              <Search className="h-5 w-5 shrink-0 text-slate-400" aria-hidden="true" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Jump to a calculator or run a command…"
                aria-label="Command palette search"
                role="combobox"
                aria-expanded="true"
                aria-controls="command-palette-results"
                aria-activedescendant={filtered[active] ? `command-option-${filtered[active].id}` : undefined}
                autoComplete="off"
                className="w-full bg-transparent text-base text-slate-900 placeholder:text-slate-400 focus:outline-none"
              />
              <kbd className="hidden shrink-0 rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0.5 font-mono text-[10px] font-medium text-slate-500 sm:block">
                ESC
              </kbd>
            </div>

            {/* Results */}
            <div id="command-palette-results" role="listbox" aria-label="Commands" className="max-h-[46vh] overflow-y-auto p-2">
              {filtered.length === 0 ? (
                <p className="px-3 py-8 text-center text-sm text-slate-500">
                  Nothing matches &ldquo;{query}&rdquo;.
                </p>
              ) : (
                filtered.map((it, i) => {
                  const isActive = i === active;
                  const Icon = it.icon;
                  return (
                    <button
                      key={it.id}
                      id={`command-option-${it.id}`}
                      type="button"
                      role="option"
                      aria-selected={isActive}
                      tabIndex={-1}
                      onClick={() => it.run()}
                      onMouseEnter={() => setActive(i)}
                      className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors ${
                        isActive ? 'bg-indigo-50' : 'hover:bg-slate-50'
                      }`}
                    >
                      <span
                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                          it.kind === 'action'
                            ? 'bg-slate-100 text-slate-500'
                            : 'bg-indigo-100/70 text-indigo-600'
                        }`}
                      >
                        <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-slate-800">{it.title}</span>
                        <span className="block truncate text-xs text-slate-500">{it.subtitle}</span>
                      </span>
                      {isActive && (
                        <CornerDownLeft className="h-4 w-4 shrink-0 text-indigo-400" aria-hidden="true" />
                      )}
                    </button>
                  );
                })
              )}
            </div>

            <div className="flex items-center gap-3 border-t border-slate-100 bg-slate-50/60 px-4 py-2 text-[11px] text-slate-500">
              <span className="flex items-center gap-1">
                <kbd className="rounded border border-slate-200 bg-white px-1 font-mono">↑↓</kbd> navigate
              </span>
              <span className="flex items-center gap-1">
                <kbd className="rounded border border-slate-200 bg-white px-1 font-mono">↵</kbd> open
              </span>
              <span className="ml-auto">Everything stays on this device</span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

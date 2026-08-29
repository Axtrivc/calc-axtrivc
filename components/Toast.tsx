'use client';

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, Info } from 'lucide-react';

/**
 * Minimal HUD toast system.
 *
 * Usage:
 *   const toast = useToast();
 *   toast.show('Copied to clipboard');
 *
 * Wrap the tree in <ToastProvider>. SSG-safe: the portal-less overlay only
 * renders on the client after mount. Toasts animate in/out with framer-motion.
 */

type ToastItem = { id: number; message: string; tone: 'success' | 'info' };

const ToastContext = createContext<(message: string, tone?: 'success' | 'info') => void>(() => {});

export function useToast() {
  const show = useContext(ToastContext);
  return { show };
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const show = useCallback((message: string, tone: 'success' | 'info' = 'success') => {
    const id = Date.now() + Math.random();
    setItems((prev) => [...prev, { id, message, tone }]);
    // auto-dismiss after 2.2s
    window.setTimeout(() => {
      setItems((prev) => prev.filter((it) => it.id !== id));
    }, 2200);
  }, []);

  return (
    <ToastContext.Provider value={show}>
      {children}
      {mounted && (
        <div
          aria-live="polite"
          aria-atomic="true"
          className="pointer-events-none fixed bottom-6 right-6 z-[100] flex flex-col items-end gap-2"
        >
          <AnimatePresence>
            {items.map((it) => (
              <motion.div
                key={it.id}
                layout
                initial={{ opacity: 0, y: 16, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.96 }}
                transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                className="pointer-events-auto flex items-center gap-2.5 rounded-xl border border-slate-200/80 bg-white/90 px-4 py-3 shadow-[0_8px_24px_rgba(15,23,42,0.12)] backdrop-blur-xl dark:border-white/10 dark:bg-slate-900/90 dark:shadow-[0_8px_24px_rgba(0,0,0,0.5)]"
                role="status"
              >
                {it.tone === 'success' ? (
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-500/15">
                    <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
                  </span>
                ) : (
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-indigo-100 dark:bg-indigo-500/15">
                    <Info className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" aria-hidden="true" />
                  </span>
                )}
                <span className="text-sm font-medium text-slate-700 dark:text-slate-200">{it.message}</span>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </ToastContext.Provider>
  );
}

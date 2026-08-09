'use client';

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { Check, Info } from 'lucide-react';

/**
 * Minimal HUD toast system.
 *
 * Usage:
 *   const toast = useToast();
 *   toast.show('Copied to clipboard');
 *
 * Wrap the tree in <ToastProvider>. SSG-safe: the portal-less overlay only
 * renders on the client after mount.
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
          {items.map((it) => (
            <div
              key={it.id}
              className="animate-slide-in-right pointer-events-auto flex items-center gap-2.5 rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-lg"
              role="status"
            >
              {it.tone === 'success' ? (
                <Check className="h-4 w-4 text-indigo-600" aria-hidden="true" />
              ) : (
                <Info className="h-4 w-4 text-indigo-600" aria-hidden="true" />
              )}
              <span className="text-sm font-medium text-slate-700">{it.message}</span>
            </div>
          ))}
        </div>
      )}
    </ToastContext.Provider>
  );
}

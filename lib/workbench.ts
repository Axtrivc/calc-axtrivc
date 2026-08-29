/**
 * Workbench local memory — everything a "personal workbench" needs, stored
 * entirely in the browser via localStorage.
 *
 * Design rules:
 *  - 100% client-side & SSG-safe: every read/write is guarded by
 *    `typeof window !== 'undefined'` and wrapped in try/catch, so private
 *    mode / blocked storage degrades gracefully to "no memory".
 *  - One namespace prefix (`calcws:v1:`) for every key — easy to audit,
 *    easy to wipe from the command palette.
 *  - No PII by design: only calculator inputs, timestamps, and slugs.
 */

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export const WS_PREFIX = 'calcws:v1:';
const KEY_PINS = `${WS_PREFIX}pins`;
const KEY_RECENT = `${WS_PREFIX}recent`;
const KEY_SCENARIOS = `${WS_PREFIX}scenarios`;
export const inputKey = (slug: string) => `${WS_PREFIX}inputs:${slug}`;
/** Theme choice ('light' | 'dark') — no stored value means "follow the OS". Re-exported from lib/site. */
export { THEME_KEY } from '@/lib/site';

/* ------------------------------------------------------------------ */
/* Safe storage primitives                                            */
/* ------------------------------------------------------------------ */

export function readJSON<T>(key: string): T | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export function writeJSON(key: string, value: unknown): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage full / blocked — workbench memory is best-effort */
  }
}

export function removeKey(key: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

/** Remove every workbench key (used by the "clear workbench" command). */
export function clearWorkbench(): void {
  if (typeof window === 'undefined') return;
  try {
    const doomed: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (k && k.startsWith(WS_PREFIX)) doomed.push(k);
    }
    doomed.forEach((k) => window.localStorage.removeItem(k));
  } catch {
    /* ignore */
  }
}

/* ------------------------------------------------------------------ */
/* Pins (favorite calculators)                                        */
/* ------------------------------------------------------------------ */

export function getPins(): string[] {
  const pins = readJSON<string[]>(KEY_PINS);
  return Array.isArray(pins) ? pins.filter((p) => typeof p === 'string') : [];
}

export function setPins(pins: string[]): void {
  writeJSON(KEY_PINS, pins);
}

/* ------------------------------------------------------------------ */
/* Recent usage                                                       */
/* ------------------------------------------------------------------ */

export type RecentEntry = { slug: string; ts: number };

export function getRecents(): RecentEntry[] {
  const list = readJSON<RecentEntry[]>(KEY_RECENT);
  return Array.isArray(list) ? list.filter((e) => e && typeof e.slug === 'string') : [];
}

export function recordRecent(slug: string): void {
  const next = [{ slug, ts: Date.now() }, ...getRecents().filter((e) => e.slug !== slug)].slice(0, 8);
  writeJSON(KEY_RECENT, next);
}

/* ------------------------------------------------------------------ */
/* Saved scenarios                                                    */
/* ------------------------------------------------------------------ */

export type Scenario = {
  id: string;
  slug: string;
  name: string;
  params: Record<string, number>;
  ts: number;
};

export function getScenarios(): Scenario[] {
  const list = readJSON<Scenario[]>(KEY_SCENARIOS);
  return Array.isArray(list) ? list.filter((s) => s && typeof s.slug === 'string') : [];
}

export function addScenario(slug: string, name: string, params: Record<string, number>): Scenario {
  const scenario: Scenario = {
    id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    slug,
    name,
    params,
    ts: Date.now(),
  };
  writeJSON(KEY_SCENARIOS, [scenario, ...getScenarios()].slice(0, 12));
  return scenario;
}

export function removeScenario(id: string): void {
  writeJSON(KEY_SCENARIOS, getScenarios().filter((s) => s.id !== id));
}

/* ------------------------------------------------------------------ */
/* URL deep-link helpers (shareable scenarios)                        */
/* ------------------------------------------------------------------ */

/** Parse numeric query params from the current URL ({} during SSR). */
export function readUrlNumbers(): Record<string, number> {
  if (typeof window === 'undefined') return {};
  const out: Record<string, number> = {};
  try {
    const sp = new URLSearchParams(window.location.search);
    sp.forEach((v, k) => {
      // Skip empty values (?cash=) — Number('') is 0 and would silently
      // override stored inputs with a zero.
      if (v.trim() === '') return;
      const n = Number(v);
      if (Number.isFinite(n)) out[k] = n;
    });
  } catch {
    /* ignore malformed URLs */
  }
  return out;
}

/** Build an absolute share URL that restores the given inputs via query params. */
export function buildShareUrl(href: string, params: Record<string, number>): string {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (Number.isFinite(v)) {
      // Trim float noise: 0.30000000000000004 -> 0.3
      const clean = Number.isInteger(v) ? v : Number(v.toFixed(4));
      sp.set(k, String(clean));
    }
  }
  const qs = sp.toString();
  return `${origin}${href}${qs ? `?${qs}` : ''}`;
}

/* ------------------------------------------------------------------ */
/* Persisted calculator inputs (the hook calculators use)             */
/* ------------------------------------------------------------------ */

/**
 * Drop-in state for a calculator's numeric inputs with workbench memory:
 *
 *  - on mount: restores `{ ...defaults, ...storedInputs, ...urlParams }`
 *    (a shared deep link wins over locally stored values);
 *  - on every change: writes the inputs back to localStorage;
 *  - `reset()` returns to defaults AND clears the stored copy.
 *
 * The restore happens in an effect (not the useState initializer) so SSG
 * output and first client render always match — no hydration mismatches.
 */
export function useWorkbenchInputs<T extends Record<string, number>>(slug: string, defaults: T) {
  const [values, setValues] = useState<T>(defaults);
  const hydrated = useRef(false);

  // Restore stored inputs, then let URL params override (shareable scenarios).
  useEffect(() => {
    const stored = readJSON<Partial<Record<string, number>>>(inputKey(slug)) ?? {};
    const fromUrl = readUrlNumbers();
    const merged: Record<string, number> = { ...defaults };
    for (const k of Object.keys(defaults)) {
      const s = stored[k];
      if (typeof s === 'number' && Number.isFinite(s)) merged[k] = s;
      const u = fromUrl[k];
      if (typeof u === 'number' && Number.isFinite(u)) merged[k] = u;
    }
    hydrated.current = true;
    setValues(merged as T);
    // A deep link "promotes" its params into local memory so a refresh
    // without the query string keeps the same scenario.
    if (Object.keys(fromUrl).length > 0) writeJSON(inputKey(slug), merged);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  // Write-through persistence once hydration has happened.
  useEffect(() => {
    if (!hydrated.current) return;
    writeJSON(inputKey(slug), values);
  }, [slug, values]);

  const set = useCallback((key: keyof T & string, v: number) => {
    setValues((prev) => ({ ...prev, [key]: v }));
  }, []);

  const reset = useCallback(() => {
    setValues(defaults);
    removeKey(inputKey(slug));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  return { values, set, reset };
}

/* ------------------------------------------------------------------ */
/* Misc UI helpers                                                    */
/* ------------------------------------------------------------------ */

/** Human relative time for the workbench panels ("3h ago", "just now"). */
export function relTime(ts: number): string {
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

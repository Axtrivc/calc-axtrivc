'use client';

/**
 * Thin, infinite-scrolling HUD data ticker rendered globally just below the
 * header. Pure CSS marquee (translateX of a duplicated track) for smooth,
 * GPU-friendly looping. Pauses on hover.
 *
 * SSG-safe: the static markup renders identical content both server- and
 * client-side; motion is CSS-driven only.
 */
const TICKER_ITEMS: { tag: string; tagColor: string; text: string }[] = [
  { tag: 'SYS_OK', tagColor: 'text-emerald-400', text: 'Stripe Engine v2.4 Active' },
  { tag: 'ENCRYPTION', tagColor: 'text-cyan-400', text: '100% Client-Side Local Compute' },
  { tag: 'TAX_MODEL', tagColor: 'text-amber-400', text: '2025/2026 US Federal Brackets Loaded' },
  { tag: 'STATUS', tagColor: 'text-purple-400', text: 'Zero Data Retention' },
  { tag: 'RUNTIME', tagColor: 'text-emerald-400', text: 'No External API Calls' },
  { tag: 'PRECISION', tagColor: 'text-cyan-400', text: 'Cent-Level Accuracy' },
];

export default function HudTicker() {
  // duplicate the list so the marquee can translate -50% seamlessly
  const items = [...TICKER_ITEMS, ...TICKER_ITEMS];

  return (
    <div className="relative z-10 overflow-hidden border-b border-slate-800 bg-base-900/70 backdrop-blur">
      <div className="flex items-center">
        <span className="hidden shrink-0 items-center gap-1.5 border-r border-slate-800 px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider text-slate-500 sm:flex">
          <span className="inline-block h-1.5 w-1.5 animate-pulse-glow rounded-full bg-cyan-400 shadow-[0_0_6px_rgba(0,242,254,0.9)]" />
          LIVE
        </span>
        <div className="relative flex-1 overflow-hidden">
          <div className="marquee-track py-1.5">
            {items.map((it, i) => (
              <span key={i} className="mx-5 inline-flex items-center gap-2 font-mono text-[11px]">
                <span className={it.tagColor}>[{it.tag}]</span>
                <span className="text-slate-400">{it.text}</span>
                <span className="text-slate-700">·</span>
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

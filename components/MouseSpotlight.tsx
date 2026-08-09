'use client';

import { useEffect, useRef } from 'react';

/**
 * Global mouse-following spotlight.
 *
 * A fixed, full-viewport overlay (pointer-events-none, below content) that
 * positions a soft radial glow at the cursor via a single CSS custom property.
 * Uses rAF + target/lerp so pointermove stays cheap even on fast moves.
 *
 * SSG-safe: no-op on the server; listeners attach after mount. Disabled under
 * prefers-reduced-motion.
 */
export default function MouseSpotlight() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Skip entirely if the user prefers reduced motion or no fine pointer.
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const finePointer = window.matchMedia('(pointer: fine)').matches;
    if (prefersReduced || !finePointer) return;

    let targetX = window.innerWidth / 2;
    let targetY = window.innerHeight / 2;
    let curX = targetX;
    let curY = targetY;
    let raf = 0;
    let visible = false;

    const render = () => {
      // ease toward target (smooth lag)
      curX += (targetX - curX) * 0.18;
      curY += (targetY - curY) * 0.18;
      el.style.setProperty('--mx', `${curX.toFixed(1)}px`);
      el.style.setProperty('--my', `${curY.toFixed(1)}px`);
      const dist = Math.hypot(targetX - curX, targetY - curY);
      if (dist < 0.5) {
        raf = 0; // stop when settled
      } else {
        raf = requestAnimationFrame(render);
      }
    };

    const kick = () => {
      if (!raf) raf = requestAnimationFrame(render);
    };

    const onMove = (e: PointerEvent) => {
      targetX = e.clientX;
      targetY = e.clientY;
      if (!visible) {
        el.style.opacity = '1';
        visible = true;
      }
      kick();
    };

    const onLeave = () => {
      el.style.opacity = '0';
      visible = false;
    };

    window.addEventListener('pointermove', onMove, { passive: true });
    document.addEventListener('pointerleave', onLeave);
    el.style.opacity = '0';

    return () => {
      window.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerleave', onLeave);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div
      ref={ref}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-[1] transition-opacity duration-500"
      style={{
        background:
          'radial-gradient(420px circle at var(--mx, 50vw) var(--my, 50vh), rgba(0, 242, 254, 0.06), rgba(139, 92, 246, 0.04) 45%, transparent 70%)',
      }}
    />
  );
}

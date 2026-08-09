'use client';

import { useEffect, useRef } from 'react';

/**
 * Lightweight 3D tilt: tilts an element toward the cursor on hover using a
 * direct DOM transform (no React re-render per frame). GPU-accelerated and
 * automatically disabled under prefers-reduced-motion or coarse pointers.
 *
 * Usage:
 *   const ref = useTilt<HTMLDivElement>({ max: 8 });
 *   return <div ref={ref} className="tilt-3d">…</div>;
 *
 * Apply `.tilt-3d` on the element for the smooth transition + preserve-3d.
 */
export function useTilt<T extends HTMLElement = HTMLElement>(opts?: { max?: number; scale?: number }) {
  const max = opts?.max ?? 7; // max degrees
  const scale = opts?.scale ?? 1.01;
  const ref = useRef<T>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const finePointer = window.matchMedia('(pointer: fine)').matches;
    if (prefersReduced || !finePointer) return;

    let raf = 0;
    const reset = () => {
      cancelAnimationFrame(raf);
      el.style.transform = 'perspective(900px) rotateX(0deg) rotateY(0deg) scale(1)';
    };

    const onMove = (e: PointerEvent) => {
      const rect = el.getBoundingClientRect();
      const px = (e.clientX - rect.left) / rect.width; // 0..1
      const py = (e.clientY - rect.top) / rect.height; // 0..1
      const rotY = (px - 0.5) * 2 * max; // left/right
      const rotX = -(py - 0.5) * 2 * max; // up/down (inverted)
      if (raf) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        el.style.transform = `perspective(900px) rotateX(${rotX.toFixed(2)}deg) rotateY(${rotY.toFixed(2)}deg) scale(${scale})`;
      });
    };

    el.addEventListener('pointermove', onMove, { passive: true });
    el.addEventListener('pointerleave', reset, { passive: true });

    return () => {
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerleave', reset);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [max, scale]);

  return ref;
}

'use client';

import { useCallback } from 'react';

/**
 * InteractiveSlider — an isolated range slider designed to live safely inside
 * cards that also contain navigation links or click handlers.
 *
 * THE PROBLEM IT SOLVES:
 *   When a range input is nested inside a `<Link>` / `<a>` or a clickable card,
 *   pointer events (mousedown / touchstart / pointerdown) bubble up to the link.
 *   On many browsers the link then "captures" the drag and either navigates the
 *   page or freezes the thumb mid-drag. `onClick={e.preventDefault()}` alone is
 *   NOT enough, because the drag never reaches the click phase — it is
 *   intercepted at the pointer-down phase.
 *
 * THE FIX:
 *   1. Stop propagation on EVERY relevant pointer phase: onPointerDown,
 *      onMouseDown, onTouchStart, AND onClick. This guarantees the parent link
 *      never sees the interaction regardless of browser event routing.
 *   2. Use a native `<input type="range">` so the browser owns pointer capture
 *      and thumb tracking — no JS position remap that could "fight" the cursor
 *      on linear sliders.
 *   3. For logarithmic ranges (huge spans like $100 → $10M), remap a 0..1000
 *      position to value space but NEVER round the value, so dragging stays
 *      continuous and the thumb never snaps away from the cursor.
 *
 * The fill track is driven purely by a CSS variable (`--fill`) updated each
 * render; this keeps repaints cheap during continuous drags.
 */

type InteractiveSliderProps = {
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step?: number;
  /** Remap a 0..1000 position through log scale (use for very wide ranges). */
  logarithmic?: boolean;
  /** Accessible label. */
  ariaLabel?: string;
  /** Extra class on the input element. */
  className?: string;
};

const POS_MAX = 1000;

export default function InteractiveSlider({
  value,
  onChange,
  min,
  max,
  step = 1,
  logarithmic = false,
  ariaLabel,
  className = '',
}: InteractiveSliderProps) {
  // ---- Stop propagation on every pointer phase so parent links never fire ----
  const swallow = useCallback(
    (e: React.SyntheticEvent) => {
      e.stopPropagation();
      // preventDefault on click/mousedown stops <a> navigation if a synthetic
      // click is ever synthesized after a drag. We do NOT preventDefault on the
      // input itself (pointerdown) because that would block the native drag.
      if (e.type === 'click') e.preventDefault();
    },
    []
  );

  if (logarithmic && min > 0 && max > min) {
    return (
      <LogSlider
        value={value}
        onChange={onChange}
        min={min}
        max={max}
        ariaLabel={ariaLabel}
        className={className}
        swallow={swallow}
      />
    );
  }

  const clamped = Math.min(max, Math.max(min, value));
  const fillPct = ((clamped - min) / (max - min)) * 100;

  return (
    <div
      onPointerDown={swallow}
      onMouseDown={swallow}
      onTouchStart={swallow}
      onClick={swallow}
    >
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={clamped}
        onChange={(e) => onChange(Number(e.target.value))}
        onPointerDown={swallow}
        onMouseDown={swallow}
        onTouchStart={swallow}
        onClick={swallow}
        className={`ws-slider ${className}`}
        style={{ ['--fill' as string]: `${fillPct}%` }}
        aria-label={ariaLabel}
      />
    </div>
  );
}

/**
 * Logarithmic variant: position (0..1000) ↔ value via log scale.
 * The value is NEVER rounded on change → the thumb never fights the cursor.
 */
function LogSlider({
  value,
  onChange,
  min,
  max,
  ariaLabel,
  className,
  swallow,
}: {
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  ariaLabel?: string;
  className?: string;
  swallow: (e: React.SyntheticEvent) => void;
}) {
  const lmin = Math.log(min);
  const lmax = Math.log(max);

  const toPos = (v: number) => {
    const c = Math.min(max, Math.max(min, v));
    return Math.round(((Math.log(Math.max(min, c)) - lmin) / (lmax - lmin)) * POS_MAX);
  };
  const fromPos = (p: number) => Math.exp(lmin + (p / POS_MAX) * (lmax - lmin));

  const pos = toPos(value);

  return (
    <div
      onPointerDown={swallow}
      onMouseDown={swallow}
      onTouchStart={swallow}
      onClick={swallow}
    >
      <input
        type="range"
        min={0}
        max={POS_MAX}
        step={1}
        value={pos}
        onChange={(e) => {
          // Pass the EXACT float up — never round, or the thumb fights the cursor.
          onChange(fromPos(Number(e.target.value)));
        }}
        onPointerDown={swallow}
        onMouseDown={swallow}
        onTouchStart={swallow}
        onClick={swallow}
        className={`ws-slider ${className}`}
        style={{ ['--fill' as string]: `${(pos / POS_MAX) * 100}%` }}
        aria-label={ariaLabel}
      />
    </div>
  );
}

'use client';

import { useEffect, useRef, useState } from 'react';
import {
  motion,
  useMotionValue,
  useSpring,
  useTransform,
  type MotionValue,
} from 'framer-motion';

/**
 * AnimateNumber — spring-physics animated numeric readout.
 *
 * Whenever `value` changes, the displayed number eases toward the new value
 * using a spring (not a fixed-duration tween), which feels far more fluid and
 * "alive" — exactly the feel Linear/Vercel dashboards use for counters.
 *
 * Works for both big jumps (preset button clicks) and tiny continuous changes
 * (slider drags): during a drag the spring just trails the cursor slightly,
 * producing a smooth trailing number without lagging behind.
 */
export default function AnimateNumber({
  value,
  format,
  springConfig = { stiffness: 140, damping: 22, mass: 0.6 },
  className,
}: {
  value: number;
  format: (n: number) => string;
  springConfig?: { stiffness: number; damping: number; mass: number };
  className?: string;
}) {
  const mv = useMotionValue(value);
  const spring = useSpring(mv, springConfig);
  const displayRef = useRef<HTMLSpanElement>(null);

  // Keep the source motion value in sync with the prop.
  useEffect(() => {
    mv.set(value);
  }, [value, mv]);

  useEffect(() => {
    // Subscribe to spring updates and write the formatted string to the DOM.
    // Writing directly avoids a React re-render on every animation frame.
    const update = (latest: number) => {
      if (displayRef.current) {
        displayRef.current.textContent = format(latest);
      }
    };
    const unsub = spring.on('change', update);
    // Set initial.
    update(spring.get());
    return () => unsub();
  }, [spring, format]);

  return (
    <span ref={displayRef} className={className}>
      {format(value)}
    </span>
  );
}

/**
 * A non-animated transform helper kept for callers that already render a
 * MotionValue themselves. Not used by default but exported for parity.
 */
export { useMotionValue, useSpring, useTransform };
export type { MotionValue };

'use client';

import { MotionConfig } from 'framer-motion';

/**
 * App-wide framer-motion configuration. `reducedMotion="user"` makes every
 * spring/transition in the tree respect the OS "reduce motion" preference
 * (paired with the CSS media query in globals.css).
 */
export default function MotionProvider({ children }: { children: React.ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}

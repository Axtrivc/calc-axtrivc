'use client';

import { useEffect, useState } from 'react';

/**
 * Current year for the footer copyright. Static export freezes server-rendered
 * dates at build time, so the year is resolved on the client after hydration.
 */
export default function FooterYear() {
  const [year, setYear] = useState<number | null>(null);

  useEffect(() => {
    setYear(new Date().getFullYear());
  }, []);

  return <>{year ?? ''}</>;
}

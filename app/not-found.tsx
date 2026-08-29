import Link from 'next/link';
import { Home, Search } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="container-page flex min-h-[60vh] flex-col items-center justify-center py-20 text-center">
      <p className="readout text-7xl font-extrabold tracking-tight text-indigo-600 dark:text-indigo-300 sm:text-8xl">404</p>
      <h1 className="mt-4 text-2xl font-bold text-slate-900 dark:text-slate-100 sm:text-3xl">Page not found</h1>
      <p className="mt-3 max-w-md text-slate-600 dark:text-slate-300">
        The calculator or page you&rsquo;re looking for doesn&rsquo;t exist. It may have been moved or
        renamed.
      </p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <Link href="/" className="btn-primary">
          <Home className="h-4 w-4" aria-hidden="true" />
          Back to all calculators
        </Link>
        <Link href="/stripe-fee-calculator" className="btn-ghost">
          <Search className="h-4 w-4 text-indigo-500 dark:text-indigo-300" aria-hidden="true" />
          Try the Stripe calculator
        </Link>
      </div>
    </div>
  );
}

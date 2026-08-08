import Link from 'next/link';
import { ChevronRight, type LucideIcon } from 'lucide-react';
import {
  CreditCard,
  Clock,
  TrendingUp,
  Building2,
} from 'lucide-react';
import type { ReactNode } from 'react';

const iconMap: Record<string, LucideIcon> = {
  CreditCard,
  Clock,
  TrendingUp,
  Building2,
};

const accentMap: Record<string, { bg: string; text: string; ring: string; soft: string }> = {
  indigo: { bg: 'bg-indigo-600', text: 'text-indigo-600', ring: 'ring-indigo-100', soft: 'bg-indigo-50 text-indigo-700' },
  emerald: { bg: 'bg-emerald-600', text: 'text-emerald-600', ring: 'ring-emerald-100', soft: 'bg-emerald-50 text-emerald-700' },
  slate: { bg: 'bg-slate-700', text: 'text-slate-700', ring: 'ring-slate-100', soft: 'bg-slate-100 text-slate-700' },
  amber: { bg: 'bg-amber-600', text: 'text-amber-600', ring: 'ring-amber-100', soft: 'bg-amber-50 text-amber-700' },
};

export default function CalculatorPageShell({
  title,
  tagline,
  category,
  icon,
  accent = 'indigo',
  children,
}: {
  title: string;
  tagline: string;
  category: string;
  icon: string;
  accent?: 'indigo' | 'emerald' | 'slate' | 'amber';
  children: ReactNode;
}) {
  const Icon = iconMap[icon] ?? CreditCard;
  const a = accentMap[accent] ?? accentMap.indigo;

  return (
    <div className="container-page py-8 sm:py-12">
      <nav className="mb-6 flex items-center gap-1.5 text-sm text-slate-500" aria-label="Breadcrumb">
        <Link href="/" className="hover:text-indigo-600">Home</Link>
        <ChevronRight className="h-4 w-4" aria-hidden="true" />
        <span className="text-slate-700">{title}</span>
      </nav>

      <header className="mb-8 flex items-start gap-4">
        <span className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl ${a.bg} text-white shadow-sm`}>
          <Icon className="h-7 w-7" aria-hidden="true" />
        </span>
        <div>
          <div className={`chip mb-2 ${a.soft}`}>{category}</div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">{title}</h1>
          <p className="mt-2 max-w-2xl text-base text-slate-600 sm:text-lg">{tagline}</p>
        </div>
      </header>

      {children}
    </div>
  );
}

export { accentMap };

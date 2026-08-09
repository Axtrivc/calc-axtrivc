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

// Cyber accent map: each calculator gets its own neon signature.
const accentMap: Record<
  string,
  { grad: string; ring: string; chip: string; glow: string; text: string }
> = {
  indigo: {
    grad: 'from-cyan-500 to-blue-600',
    ring: 'shadow-glow-cyan',
    chip: 'bg-cyan-500/10 text-cyan-300 ring-1 ring-inset ring-cyan-500/30',
    glow: 'shadow-glow-cyan',
    text: 'text-cyan-400',
  },
  emerald: {
    grad: 'from-emerald-500 to-teal-500',
    ring: 'shadow-glow-green',
    chip: 'bg-emerald-500/10 text-emerald-300 ring-1 ring-inset ring-emerald-500/30',
    glow: 'shadow-glow-green',
    text: 'text-emerald-400',
  },
  slate: {
    grad: 'from-purple-500 to-fuchsia-600',
    ring: 'shadow-glow-purple',
    chip: 'bg-purple-500/10 text-purple-300 ring-1 ring-inset ring-purple-500/30',
    glow: 'shadow-glow-purple',
    text: 'text-purple-400',
  },
  amber: {
    grad: 'from-amber-500 to-orange-600',
    ring: 'shadow-glow-cyan',
    chip: 'bg-amber-500/10 text-amber-300 ring-1 ring-inset ring-amber-500/30',
    glow: '',
    text: 'text-amber-400',
  },
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
      <nav
        className="mb-6 flex items-center gap-1.5 text-sm text-slate-500"
        aria-label="Breadcrumb"
      >
        <Link href="/" className="transition hover:text-cyan-300">
          Home
        </Link>
        <ChevronRight className="h-4 w-4" aria-hidden="true" />
        <span className="text-slate-300">{title}</span>
      </nav>

      <header className="mb-8 flex animate-fade-in-up items-start gap-4">
        <span
          className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${a.grad} text-white ${a.glow}`}
        >
          <Icon className="h-7 w-7" aria-hidden="true" />
        </span>
        <div>
          <div className={`chip mb-2 ${a.chip}`}>{category}</div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
            {title}
          </h1>
          <p className="mt-2 max-w-2xl text-base text-slate-400 sm:text-lg">{tagline}</p>
        </div>
      </header>

      {children}
    </div>
  );
}

export { accentMap };

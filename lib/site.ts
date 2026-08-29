export const siteConfig = {
  name: 'CalcSuite',
  shortName: 'CalcSuite',
  domain: 'calc.axtrivc.com',
  url: 'https://calc.axtrivc.com',
  description:
    'Free financial & business calculators for freelancers, startups, and SMBs. Instantly estimate Stripe fees, hourly rates, runway, S-Corp savings, and tax comparisons.',
  ogImage: '/og-image.png',
  twitter: '@calc_axtrivc',
};

/**
 * localStorage key holding the visitor's theme choice ('light' | 'dark').
 * Lives here (not in workbench.ts) so the server-rendered pre-paint script
 * in app/layout.tsx can inline it without pulling client hooks into the RSC graph.
 */
export const THEME_KEY = 'calcws:v1:theme';

export type Calculator = {
  slug: string;
  href: string;
  title: string;
  shortTitle?: string;
  tagline: string;
  description: string;
  icon: 'CreditCard' | 'Clock' | 'TrendingUp' | 'Building2' | 'Landmark';
  category: 'Payments' | 'Freelancing' | 'Startups' | 'Taxes';
  tags: string[];
  accent: 'emerald' | 'indigo' | 'slate' | 'amber';
  /**
   * Professional positioning layer.
   *
   * CalcSuite is deliberately NOT a general toolhub: every instrument sits at
   * one stage of a single business-finance workflow —
   *   Price your work -> Bill and protect margin -> Structure the entity ->
   *   Compensate yourself -> Sustain the business.
   * The fields below surface that positioning on each tool page:
   *
   *  - stage/stageLabel — where this tool sits in the workflow.
   *  - dataBasis        — what the output numbers are built on (provenance).
   *  - formulaSnapshot  — the core equation, rendered in the page header so
   *                       visitors see the method before they use the tool.
   */
  stage: 1 | 2 | 3 | 4 | 5;
  stageLabel: 'Price' | 'Bill' | 'Structure' | 'Compensate' | 'Sustain';
  dataBasis: string;
  formulaSnapshot: string;
};

export const calculators: Calculator[] = [
  {
    slug: 'stripe-fee-calculator',
    href: '/stripe-fee-calculator/',
    title: 'Stripe Fee Calculator',
    shortTitle: 'Stripe Fees',
    tagline: 'Domestic, international & ACH fees — plus reverse pricing.',
    description:
      'Calculate Stripe processing fees for domestic cards, international cards, and ACH transfers. Use reverse mode to find the invoice total you should charge to net a target amount.',
    icon: 'CreditCard',
    category: 'Payments',
    tags: ['stripe', 'payment processing', 'merchant fees', 'credit card', 'ach', 'reverse calculator'],
    accent: 'indigo',
    stage: 2,
    stageLabel: 'Bill',
    dataBasis: "Stripe's standard US card & ACH published pricing",
    formulaSnapshot: 'fee = charge × rate + fixed',
  },
  {
    slug: 'freelance-hourly-rate-calculator',
    href: '/freelance-hourly-rate-calculator/',
    title: 'Freelance Hourly Rate Calculator',
    shortTitle: 'Hourly Rate',
    tagline: 'Set a rate that actually covers taxes, expenses & PTO.',
    description:
      'Find your ideal freelance hourly and day rate based on target income, business expenses, tax rate, vacation days, and weekly billable hours.',
    icon: 'Clock',
    category: 'Freelancing',
    tags: ['freelance', 'hourly rate', 'day rate', 'pricing', 'consulting', 'self-employed'],
    accent: 'emerald',
    stage: 1,
    stageLabel: 'Price',
    dataBasis: 'Transparent on-page model — every formula is documented below',
    formulaSnapshot: 'rate = gross needed ÷ billable hours',
  },
  {
    slug: 'saas-runway-calculator',
    href: '/saas-runway-calculator/',
    title: 'SaaS Runway Calculator',
    shortTitle: 'SaaS Runway',
    tagline: 'How many months of cash do you really have left?',
    description:
      'Estimate your startup runway in months based on cash balance, gross burn, MRR, and monthly growth rate, with a month-by-month visual breakdown.',
    icon: 'TrendingUp',
    category: 'Startups',
    tags: ['saas', 'runway', 'burn rate', 'cash flow', 'startup', 'mrr'],
    accent: 'slate',
    stage: 5,
    stageLabel: 'Sustain',
    dataBasis: 'Deterministic month-by-month cash simulation (120-month cap)',
    formulaSnapshot: 'runway = months until cash ≤ $0',
  },
  {
    slug: 'llc-vs-ccorp-tax-calculator',
    href: '/llc-vs-ccorp-tax-calculator/',
    title: 'LLC vs C-Corp Tax Calculator',
    shortTitle: 'LLC vs C-Corp',
    tagline: 'Compare pass-through vs double taxation side by side.',
    description:
      'Compare estimated tax liability for an LLC (self-employment + income tax) versus a C-Corp (corporate tax + dividend tax) at any profit level.',
    icon: 'Building2',
    category: 'Taxes',
    tags: ['llc', 'c-corp', 'corporation', 'tax', 'entity', 'pass-through', 'double taxation'],
    accent: 'amber',
    stage: 3,
    stageLabel: 'Structure',
    dataBasis: 'Tax-year 2025 US federal parameters (IRS brackets, SE cap, QBI)',
    formulaSnapshot: 'after-tax: pass-through vs double taxation',
  },
  {
    slug: 's-corp-tax-calculator',
    href: '/s-corp-tax-calculator/',
    title: 'S-Corp Salary Calculator',
    shortTitle: 'S-Corp Salary',
    tagline: 'Is the S election worth it? Salary + distributions vs SE tax.',
    description:
      'Compare LLC self-employment tax against S-Corp salary + distributions. Full 2025 federal model: FICA, QBI interaction, breakeven payroll overhead, and salary sensitivity.',
    icon: 'Landmark',
    category: 'Taxes',
    tags: [
      's corp',
      's corp salary',
      'self employment tax',
      'reasonable salary',
      'form 2553',
      's corp vs llc',
      'payroll tax',
      'distributions',
    ],
    accent: 'emerald',
    stage: 4,
    stageLabel: 'Compensate',
    dataBasis: 'Tax-year 2025 US federal parameters (FICA, SS wage base, QBI, 1120-S geometry)',
    formulaSnapshot: 'advantage = payroll tax saved − tax drift − overhead',
  },
];

export const allTags = Array.from(
  new Set(calculators.flatMap((c) => [c.category, ...c.tags]))
).sort();

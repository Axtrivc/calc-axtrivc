export const siteConfig = {
  name: 'CalcSuite',
  shortName: 'CalcSuite',
  domain: 'calc.axtrivc.com',
  url: 'https://calc.axtrivc.com',
  description:
    'Free, accurate financial and business calculators for freelancers, startups, and SMBs. Calculate Stripe fees, freelance hourly rates, SaaS runway, and LLC vs C-Corp taxes in seconds.',
  ogImage: '/og-image.png',
  twitter: '@calc_axtrivc',
};

export type Calculator = {
  slug: string;
  href: string;
  title: string;
  shortTitle?: string;
  tagline: string;
  description: string;
  icon: 'CreditCard' | 'Clock' | 'TrendingUp' | 'Building2';
  category: 'Payments' | 'Freelancing' | 'Startups' | 'Taxes';
  tags: string[];
  accent: 'emerald' | 'indigo' | 'slate' | 'amber';
};

export const calculators: Calculator[] = [
  {
    slug: 'stripe-fee-calculator',
    href: '/stripe-fee-calculator',
    title: 'Stripe Fee Calculator',
    shortTitle: 'Stripe Fees',
    tagline: 'Domestic, international & ACH fees — plus reverse pricing.',
    description:
      'Calculate Stripe processing fees for domestic cards, international cards, and ACH transfers. Use reverse mode to find the invoice total you should charge to net a target amount.',
    icon: 'CreditCard',
    category: 'Payments',
    tags: ['stripe', 'payment processing', 'merchant fees', 'credit card', 'ach', 'reverse calculator'],
    accent: 'indigo',
  },
  {
    slug: 'freelance-hourly-rate-calculator',
    href: '/freelance-hourly-rate-calculator',
    title: 'Freelance Hourly Rate Calculator',
    shortTitle: 'Hourly Rate',
    tagline: 'Set a rate that actually covers taxes, expenses & PTO.',
    description:
      'Find your ideal freelance hourly and day rate based on target income, business expenses, tax rate, vacation days, and weekly billable hours.',
    icon: 'Clock',
    category: 'Freelancing',
    tags: ['freelance', 'hourly rate', 'day rate', 'pricing', 'consulting', 'self-employed'],
    accent: 'emerald',
  },
  {
    slug: 'saas-runway-calculator',
    href: '/saas-runway-calculator',
    title: 'SaaS Runway Calculator',
    tagline: 'How many months of cash do you really have left?',
    description:
      'Estimate your startup runway in months based on cash balance, gross burn, MRR, and monthly growth rate, with a month-by-month visual breakdown.',
    icon: 'TrendingUp',
    category: 'Startups',
    tags: ['saas', 'runway', 'burn rate', 'cash flow', 'startup', 'mrr'],
    accent: 'slate',
  },
  {
    slug: 'llc-vs-ccorp-tax-calculator',
    href: '/llc-vs-ccorp-tax-calculator',
    title: 'LLC vs C-Corp Tax Calculator',
    shortTitle: 'LLC vs C-Corp',
    tagline: 'Compare pass-through vs double taxation side by side.',
    description:
      'Compare estimated tax liability for an LLC (self-employment + income tax) versus a C-Corp (corporate tax + dividend tax) at any profit level.',
    icon: 'Building2',
    category: 'Taxes',
    tags: ['llc', 'c-corp', 'corporation', 'tax', 'entity', 'pass-through', 'double taxation'],
    accent: 'amber',
  },
];

export const allTags = Array.from(
  new Set(calculators.flatMap((c) => [c.category, ...c.tags]))
).sort();

/**
 * Registry for the /guides knowledge base.
 *
 * Guides are decision-oriented long-form playbooks: each one walks a single
 * business decision end to end — price the work, choose an entity, defend
 * margin, manage runway — and hands off to the instruments (the calculators
 * registered in lib/site.ts) that run the arithmetic on the reader's own
 * numbers. A guide is written to end in a decision, not to restate tool docs.
 *
 * This registry is the single source of truth shared by:
 *   - app/guides/page.tsx         the index (card grid + CollectionPage JSON-LD)
 *   - app/guides/<slug>/page.tsx  guide pages, rendered through GuideShell
 *   - components/GuideShell.tsx   resolves `related` to instrument links
 *
 * Adding a guide: append an entry below (slug / title / description /
 * minutes / related), then create its page with GuideShell. `related` slugs
 * MUST exist in `calculators` (lib/site.ts) — the shell resolves them at
 * render time and drops unknown slugs, and the workflow's registry check
 * fails the build on any typo. `href` is derived here (never hand-written)
 * so every guide link carries the site-wide trailing slash.
 */
export type Guide = {
  slug: string;
  /** In-site path with trailing slash — derived: `/guides/<slug>/`. */
  href: string;
  title: string;
  description: string;
  /** Reading time in minutes, shown on the index card and the guide header. */
  minutes: number;
  /** Slugs of the calculators (lib/site.ts) this guide leans on, in the order
   *  they appear in the decision path. */
  related: string[];
};

const GUIDE_ENTRIES: Omit<Guide, 'href'>[] = [
  {
    slug: 'self-employed-tax-calendar',
    title: 'The Self-Employed Tax Calendar',
    description:
      'Nobody withholds for you: sole proprietors settle federal tax four times a year whether or not a bill arrives. This guide maps the calendar — which deadlines bind, what each installment has to cover, and the safe harbors that keep a lumpy income year out of penalty territory.',
    minutes: 14,
    related: [
      'quarterly-estimated-tax-calculator',
      'self-employment-tax-calculator',
      'solo-401k-calculator',
    ],
  },
  {
    slug: 'pricing-freelance-work',
    title: 'Pricing Freelance Work',
    description:
      'A pricing framework that works backward from the income you need: target salary, realistic billable hours, taxes, and business expenses — and the hourly floor below which taking on more clients just means more work for less money.',
    minutes: 16,
    related: [
      'freelance-hourly-rate-calculator',
      'discount-impact-calculator',
      '1099-vs-w2-calculator',
    ],
  },
  {
    slug: 'choosing-your-business-entity',
    title: 'Choosing Your Business Entity',
    description:
      'Sole proprietorship, LLC, S corporation, or C corporation — a decision path through liability, tax posture, and administrative overhead, including the profit levels where an S election begins to pay for its own payroll and where double taxation is worth the price.',
    minutes: 18,
    related: ['llc-vs-ccorp-tax-calculator', 's-corp-tax-calculator', 'qbi-deduction-calculator'],
  },
  {
    slug: 'paying-yourself-from-your-business',
    title: 'Paying Yourself From Your Business',
    description:
      "Owner's draw, reasonable salary, or salary plus distributions — how to move money out of your own company without paying avoidable tax, what each method demands you document, and when the structure itself decides the answer.",
    minutes: 15,
    related: ['s-corp-tax-calculator', 'solo-401k-calculator', 'roth-vs-traditional-calculator'],
  },
  {
    slug: 'reading-your-cap-table',
    title: 'Reading Your Cap Table',
    description:
      'Founder ownership never sits still: SAFEs convert, option pools get carved, rounds get priced. Learn to read a cap table line by line, forecast dilution before signing the term sheet, and spot the terms that cost more than they appear to.',
    minutes: 17,
    related: ['cap-table-dilution-calculator', 'safe-note-calculator'],
  },
  {
    slug: 'managing-your-runway',
    title: 'Managing Your Runway',
    description:
      'A cash balance and a burn rate only matter as decisions: how many months you actually have, which lever to pull first — revenue, cost, or payment terms — and how unit economics set the ceiling on how far each dollar of runway stretches.',
    minutes: 15,
    related: ['saas-runway-calculator', 'ltv-cac-calculator', 'late-payment-cost-calculator'],
  },
  {
    slug: 'deductions-home-office-and-vehicle',
    title: 'Deductions Playbook: Home Office & Vehicle',
    description:
      'The two deductions self-employed filers most often get wrong. Simplified versus actual methods for the home office and the business vehicle, the records each one demands, and how to pick the method that wins on your numbers instead of the one that is merely easier.',
    minutes: 13,
    related: ['home-office-deduction-calculator', 'mileage-deduction-calculator'],
  },
  {
    slug: 'getting-paid-without-losing-margin',
    title: 'Getting Paid Without Losing Margin',
    description:
      'Processing fees, payment terms, and goodwill discounts quietly reprice every invoice. This guide sets a payment-rail policy by invoice size, prices slow payment honestly as a cost of capital, and draws the line on discounting before it erodes profit.',
    minutes: 14,
    related: ['stripe-fee-calculator', 'late-payment-cost-calculator', 'discount-impact-calculator'],
  },
  {
    slug: 'retirement-for-the-self-employed',
    title: 'Retirement for the Self-Employed',
    description:
      'With no employer plan, retirement is something you build for yourself. Solo 401(k), SEP-IRA, Roth, and the HSA compared as one coordinated stack — what each vehicle can hold, how the limits interact, and the order to fund them.',
    minutes: 18,
    related: ['solo-401k-calculator', 'roth-vs-traditional-calculator', 'hsa-calculator'],
  },
  {
    slug: 'year-end-tax-checklist',
    title: 'Year-End Tax Checklist',
    description:
      'A closing sequence for the tax year: the deductions, elections, and retirement moves that still count before the year ends, the ones that must wait until the next one starts, and a verification pass that catches surprises before the IRS does.',
    minutes: 12,
    related: [
      'quarterly-estimated-tax-calculator',
      'qbi-deduction-calculator',
      'home-office-deduction-calculator',
      'mileage-deduction-calculator',
    ],
  },
  {
    slug: 'tax-audit-red-flags',
    title: 'Tax Audit Red Flags',
    description:
      'Ranked by selection probability times preparation cost: the seven flags that move a small-business return into examination — loss streaks, home-office shares, round-number mileage, cash books, 1099 mismatches, SSTB labels, owner salary — the records that close each one, and the process from the first letter to appeal.',
    minutes: 13,
    related: [
      'home-office-deduction-calculator',
      'mileage-deduction-calculator',
      'qbi-deduction-calculator',
    ],
  },
  {
    slug: 'hiring-your-first-employee',
    title: 'Hiring Your First Employee',
    description:
      'The first W-2 hire converts a variable contractor line into a fixed cost stack: employer FICA, FUTA and SUTA, benefits, workers\u2019 comp. This guide loads a salary with every employer-side layer, converts any contractor rate into the salary it is worth, and recomputes your own quarterly estimates on the smaller net.',
    minutes: 16,
    related: [
      '1099-vs-w2-calculator',
      'self-employment-tax-calculator',
      'quarterly-estimated-tax-calculator',
    ],
  },
  {
    slug: 'self-employed-health-insurance',
    title: 'Self-Employed Health Insurance',
    description:
      'Health coverage is usually a freelancer\u2019s second-largest fixed cost, and \u00A7162(l) is the only above-the-line break for it. This guide walks the self-employed health insurance deduction end to end: the three ceilings that can take it away, the month-by-month eligibility ledger for mid-year exits, the 20% QBI give-back, the >2% S-corp shareholder\u2019s FICA-excluded W-2 channel, and where the HSA fits beside the premium.',
    minutes: 14,
    related: ['qbi-deduction-calculator', 's-corp-tax-calculator', 'hsa-calculator'],
  },
  {
    slug: 'bookkeeping-that-survives-an-audit',
    title: 'Bookkeeping That Survives an Audit',
    description:
      'A deduction survives an audit only if its records do. This guide separates business and personal money first, then meets the evidence standard each deduction actually demands — contemporaneous mileage logs, home-office measurement, Section 179 cost records — sets the retention clock, and assembles the minimum digital setup that makes the routine survivable.',
    minutes: 13,
    related: ['home-office-deduction-calculator', 'mileage-deduction-calculator'],
  },
  {
    slug: 'saas-pricing-playbook',
    title: 'Pricing a SaaS Product',
    description:
      'Price subscription software in three layers — a cost floor you compute, a value ceiling you argue, and competitor prices that only sanity-check the result — then treat every remaining choice as a separately priced decision: the billing term as financing, the discount ladder as 1 ÷ (1 − d), the raise as mechanics that hold the base, closed by the LTV:CAC band.',
    minutes: 15,
    related: ['ltv-cac-calculator', 'break-even-calculator', 'discount-impact-calculator'],
  },
];

/** href is derived, never hand-written — the trailing slash is guaranteed. */
export const guides: Guide[] = GUIDE_ENTRIES.map((g) => ({
  ...g,
  href: `/guides/${g.slug}/`,
}));

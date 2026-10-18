import type { Metadata } from 'next';
import CalculatorPageShell from '@/components/CalculatorPageShell';
import SafeNoteCalculator from '@/components/calculators/SafeNoteCalculator';
import SafeNoteArticle from '@/components/content/SafeNoteArticle';
import ComparisonChart from '@/components/ComparisonChart';
import {
  AppJsonLd,
  MethodologyGrid,
  ProvenanceFooter,
  ScenarioPanel,
  SectionShell,
  WorkflowChain,
} from '@/components/professional';
import { calculators, siteConfig, type Calculator } from '@/lib/site';
import { SAFE_PRESETS, convertSafeStack, safeCurve } from '@/lib/safe';
import { pct, usdCompact } from '@/lib/format';

/**
 * Page-local instrument record.
 *
 * The suite registry (lib/site.ts) is owned by the integration pass; until this
 * slug is registered there, the page carries its own metadata object typed
 * exactly like a registry entry so the shell renders identically. Hardcoded
 * positioning: stage 3 of the workflow — Structure, beside the cap table tool
 * (that one walks registered shares; this one prices the convertibles that
 * land on the round).
 */
const calc: Calculator = {
  slug: 'safe-note-calculator',
  href: '/safe-note-calculator/',
  title: 'SAFE Note Calculator',
  shortTitle: 'SAFE Notes',
  tagline: 'What the post-money SAFE stack takes when the priced round lands.',
  description:
    'Model YC post-money SAFE conversion at your priced round: which term binds (cap or discount), the SAFE price per share, SAFE ownership after the round, how much extra dilution founders bear versus a clean round, and stacked SAFEs — with a next-round valuation sensitivity curve.',
  icon: 'TrendingUp',
  category: 'Startups',
  tags: [
    'safe calculator',
    'post-money safe',
    'safe note',
    'safe conversion',
    'valuation cap',
    'safe discount',
    'safe dilution',
    'safe stack',
    'series a dilution',
    'yc safe',
    'mfn safe',
  ],
  accent: 'indigo',
  stage: 3,
  stageLabel: 'Structure',
  dataBasis:
    'YC standard Post-Money SAFE form (2018 revision) — conversion mechanics per the form’s defined terms',
  formulaSnapshot: 'SAFE price = min( cap ÷ Company Capitalization , rate × round price )',
};

/* ItemPage + BreadcrumbList structured data — the visible breadcrumb lives in
   the shell; the embedded copy keeps this block self-describing. */
const itemJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'ItemPage',
  name: calc.title,
  description: calc.description,
  url: `${siteConfig.url}${calc.href}`,
  breadcrumb: {
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: siteConfig.url },
      {
        '@type': 'ListItem',
        position: 2,
        name: calc.title,
        item: `${siteConfig.url}${calc.href}`,
      },
    ],
  },
  mainEntity: {
    '@type': 'WebApplication',
    name: calc.title,
    url: `${siteConfig.url}${calc.href}`,
    applicationCategory: 'FinanceApplication',
    operatingSystem: 'Web (any modern browser)',
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
  },
};

/* ------------------------------------------------------------------ */
/* Build-time scenario grid — every preset, full model, same engine.   */
/* ------------------------------------------------------------------ */

type PresetRow = {
  label: string;
  description: string;
  stackPre: number;
  stackAfter: number;
  investor: number;
  founders: number;
  foundersNo: number;
  extraPts: number;
  preMoney: number;
  investment: number;
};

const PRESET_ROWS: PresetRow[] = SAFE_PRESETS.map((p) => {
  const r = convertSafeStack(p.safes, p.round, p.shares);
  return {
    label: p.label,
    description: p.description,
    stackPre: r.stackPctOfPreRound,
    stackAfter: r.stackPctAfter,
    investor: r.investorPctAfter,
    founders: r.foundersPctAfter,
    foundersNo: r.foundersPctNoSafes,
    extraPts: r.foundersExtraDilutionPts,
    preMoney: p.round.preMoney,
    investment: p.round.investment,
  };
});

/** Ownership deltas are percentage POINTS, never "%" or "% points". */
const pts = (v: number, d = 2) => `${v.toFixed(d)} points`;

/* Chart: the same $500k SAFE under three term sets, x = Series A pre-money,
   y = SAFE ownership after the round. The both-terms curve is the pointwise
   upper envelope of the other two — the election, made visible. */
const CANON_XS = Array.from({ length: 46 }, (_, i) => 5_000_000 + i * 1_000_000);
const CURVE_OF = (cap: number, disc: number) =>
  safeCurve(
    [{ amount: 500_000, cap, discountPct: disc }, { amount: 0, cap: 0, discountPct: 0 }, { amount: 0, cap: 0, discountPct: 0 }],
    3_000_000,
    10_000_000,
    CANON_XS,
  );
const CHART_SERIES = [
  {
    label: 'Cap only — $10M post-money cap',
    color: '#0ea5e9',
    points: CURVE_OF(10_000_000, 0).map((p) => ({ x: p.x, y: p.stackPctAfter })),
  },
  {
    label: 'Discount only — 20% off',
    color: '#f43f5e',
    points: CURVE_OF(0, 20).map((p) => ({ x: p.x, y: p.stackPctAfter })),
  },
  {
    label: 'Both terms — elects the lower price',
    color: '#6366f1',
    points: CURVE_OF(10_000_000, 20).map((p) => ({ x: p.x, y: p.stackPctAfter })),
  },
];

const stdRow = PRESET_ROWS[0];
const discRow = PRESET_ROWS[1];
const stackedRow = PRESET_ROWS[2];
const heavyRow = PRESET_ROWS[3];
/* The identity the footnote leans on: extra dilution = stack's pre-round claim
   × pre ÷ post — exact on every row by construction. */
const identityResidual = Math.abs(
  heavyRow.extraPts - heavyRow.stackPre * (heavyRow.preMoney / (heavyRow.preMoney + heavyRow.investment)),
);

/**
 * Registration probe: this slug is added to the suite registry by the
 * integration pass. Until then the shared WorkflowChain would render a
 * chain this page is absent from (no "You are here"), which is worse for a
 * visitor than no chain at all — so render it only once registered.
 */
const REGISTERED = calculators.some((c) => c.slug === 'safe-note-calculator');

export const metadata: Metadata = {
  title: 'SAFE Note Calculator (Post-Money) — Conversion & Dilution at Your Series A',
  description:
    'Model YC post-money SAFE conversion at the priced round: cap vs discount — which binds and where they tie, the SAFE price per share, SAFE ownership after the round, founder extra dilution versus a clean round, and stacked SAFEs.',
  keywords: [
    'safe calculator',
    'safe note calculator',
    'post-money safe',
    'safe conversion calculator',
    'valuation cap',
    'safe discount rate',
    'safe dilution',
    'safe stack',
    'series a dilution',
    'yc safe',
    'mfn safe',
    'convertible equity',
  ],
  alternates: { canonical: calc.href },
  openGraph: {
    title: 'SAFE Note Calculator (Post-Money) — Conversion & Dilution at Your Series A',
    description:
      'What does the SAFE stack take when the round lands? YC post-money conversion math: effective caps, SAFE price, post-round ownership, founder extra dilution, and the valuation curve with its cap/discount crossover.',
    url: `${siteConfig.url}${calc.href}`,
    type: 'website',
  },
};

export default function SafeNoteCalculatorPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(itemJsonLd) }}
      />
      <AppJsonLd calc={calc} />
      <CalculatorPageShell calc={calc}>
        {/* Interactive tool */}
        <section id="calculator" aria-label="SAFE note conversion calculator tool" className="scroll-mt-28">
          <SafeNoteCalculator />
        </section>

        {/* Methodology */}
        <div className="border-t border-slate-200 pt-12 dark:border-white/[0.07]">
          <SectionShell
            id="methodology"
            eyebrow="Methodology"
            title="The model, stated exactly"
            accent={calc.accent}
            intro="Every number the tool returns follows from six statements — the defined-term arithmetic of the YC post-money SAFE form, with its one circular definition solved in closed form. Post-money caps only; the assumptions state what that excludes."
          >
            <MethodologyGrid
              formulas={[
                {
                  label: 'Effective cap (which term binds)',
                  expression: 'm = min( cap , rate × pre-money ) · rate = (100 − discount%) ÷ 100',
                  note: 'A “20% discount” is a Discount Rate of 0.80 — the share of the round price PAID, per the form. Both candidate prices have the form m ÷ Company Capitalization, so the holder’s election of the lower price is simply the smaller m. They tie at pre-money = cap ÷ rate.',
                },
                {
                  label: 'Company Capitalization',
                  expression: 'CC = n ÷ ( 1 − Σᵢ amountᵢ ÷ mᵢ )',
                  note: 'The form’s circular definition — CC includes the shares every SAFE is about to receive — solved exactly: each capped SAFE contributes a fixed claim amountᵢ ÷ mᵢ, and the existing shares n fill the remainder.',
                },
                {
                  label: 'SAFE conversion',
                  expression: 'priceᵢ = mᵢ ÷ CC · sharesᵢ = amountᵢ ÷ priceᵢ · %of CC = amountᵢ ÷ mᵢ',
                  note: 'A capped post-money SAFE owns amount ÷ cap of the pre-round table — fixed on the day it is signed, whatever the round later prices at. Share counts are exact fractions; closings round per the documents.',
                },
                {
                  label: 'Round pricing',
                  expression: 'P = pre-money ÷ CC · investor shares = investment ÷ P · investor % = investment ÷ post',
                  note: 'SAFEs convert immediately prior to the financing, so the negotiated price is struck over the post-conversion table — the standard reading of the form. The investor’s post-round stake reduces to investment ÷ post-money, untouched by anything the SAFEs did.',
                },
                {
                  label: 'Post-round stakes',
                  expression: "total = CC × (pre + inv) ÷ pre · every CC-holder's % × pre ÷ (pre + inv)",
                  note: 'After conversion the round dilutes everyone in the pre-round table pro-rata — SAFEs included. That is why a SAFE’s signed percentage (of CC) is always larger than its post-round percentage.',
                },
                {
                  label: 'Cost to existing holders',
                  expression: 'Δ points = ( Σᵢ amountᵢ ÷ mᵢ ) × pre ÷ ( pre + inv ) × 100',
                  note: 'The stack’s entire pre-round claim lands on existing holders — post-money SAFEs dilute each other zero — then shrinks by the same round factor everyone bears. Verified as an identity on every scenario row.',
                },
              ]}
              assumptions={[
                'Post-money SAFEs on the YC standard form (2018 revision). Pre-money SAFEs (the pre-2018 form) exclude other converting securities from their denominator and are not modeled.',
                'The priced round’s pre-money is struck on the post-conversion table (SAFEs sit inside the pre-money). Term sheets quoting pre-money “before the SAFEs” produce different splits from identical documents.',
                'Existing shares = the full pre-round fully diluted count as the form defines it: common, granted AND promised options (signed offers count), and the current unallocated pool. A pool increase adopted in connection with the round is excluded from Company Capitalization by the form itself — enter the pool as it stands; the model does not simulate that later pool step diluting everyone after conversion.',
                'A SAFE carrying both terms converts at the lower of the two prices; ties resolve to the cap label (the prices are identical at a tie).',
                'Conversion at the priced round only — the form’s term is “Equity Financing”, and per YC’s documents-page FAQ there is no threshold amount that must be raised to trigger it. Dissolution, change-of-control, and IPO conversions follow waterfall logic this model does not attempt.',
                'No side letters (pro-rata, MFN amendments), no convertible notes, no share rounding, no exit waterfall or tax treatment.',
                'Stacks whose claims sum to ≥ 100% of the pre-round table are rejected with a reason — never silently clamped.',
              ]}
            />
          </SectionShell>
        </div>

        {/* Scenario analysis */}
        <SectionShell
          id="scenarios"
          eyebrow="Scenario analysis"
          title="What the same cap table gives up, stack by stack"
          accent={calc.accent}
          intro="Computed at build time by the same functions that power the widget: 10M fully diluted shares, four SAFE stacks at their priced rounds. Every cell is the full conversion — effective caps, the closed-form capitalization solve, and the round on top."
        >
          <ScenarioPanel
            title="SAFE stack vs founder ownership, by scenario preset"
            description="“Stack, pre-round” is the claim fixed at signing (Σ amountᵢ ÷ mᵢ); “after round” is what survives the round’s pro-rata dilution. Points = percentage points."
            columns={['Scenario', 'Stack, pre-round', 'Stack, after round', 'Series A investor', 'Founders after', 'Founders, no stack', 'Extra dilution']}
            footnote={`Four patterns. Fixed claims: every capped stack’s pre-round claim is locked at signing — the heavy preset’s ${pct(heavyRow.stackPre, 1)} is already gone before its $8M round prices, which is why founders negotiate with ${pct(100 - heavyRow.stackPre, 2)} of the table, not 100%. Not everything is fixed: the discount-only preset’s ${pct(discRow.stackPre, 2)} claim is a function of the ${usdCompact(discRow.preMoney)} valuation it converts at — move the round and the claim moves with it, which is exactly what the chart below shows. The identity: extra dilution equals the pre-round claim × pre ÷ post exactly — ${pct(heavyRow.stackPre, 2)} × 30 ÷ 38 = ${pts(heavyRow.extraPts, 2)} on the heavy row (residual ${identityResidual.toExponential(1)} points), and the same check passes on every row. Election behavior: the standard preset’s SAFE binds on its cap while the stacked preset’s second SAFE binds on its discount at the same ${usdCompact(stackedRow.preMoney)} valuation — same round, different terms doing the work, which is what the chart below makes visible.`}
          >
            <tbody className="divide-y divide-slate-100 dark:divide-white/[0.06]">
              {PRESET_ROWS.map((row) => (
                <tr key={row.label}>
                  <th scope="row" className="readout font-semibold normal-case tracking-normal text-slate-900 dark:text-slate-100">
                    {row.label}
                    <span className="mt-0.5 block font-sans text-[11px] font-normal text-slate-500 dark:text-slate-400">
                      {usdCompact(row.investment)} at {usdCompact(row.preMoney)} pre
                    </span>
                  </th>
                  <td className="text-right">
                    <span className="readout whitespace-nowrap font-medium text-slate-700 dark:text-slate-200">
                      {pct(row.stackPre, 2)}
                    </span>
                  </td>
                  <td className="text-right">
                    <span className="readout inline-block whitespace-nowrap rounded-full bg-indigo-50 px-2 py-0.5 font-semibold text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300">
                      {pct(row.stackAfter, 2)}
                    </span>
                  </td>
                  <td className="text-right">
                    <span className="readout whitespace-nowrap font-medium text-slate-600 dark:text-slate-300">
                      {pct(row.investor, 2)}
                    </span>
                  </td>
                  <td className="text-right">
                    <span className="readout whitespace-nowrap font-medium text-slate-700 dark:text-slate-200">
                      {pct(row.founders, 2)}
                    </span>
                  </td>
                  <td className="text-right">
                    <span className="readout whitespace-nowrap font-medium text-slate-500 dark:text-slate-400">
                      {pct(row.foundersNo, 2)}
                    </span>
                  </td>
                  <td className="text-right">
                    <span className="readout inline-block whitespace-nowrap rounded-full bg-rose-50 px-2 py-0.5 font-semibold text-rose-700 dark:bg-rose-500/10 dark:text-rose-400">
                      {pts(row.extraPts, 2)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </ScenarioPanel>

          <div className="mt-6">
            <ComparisonChart
              series={CHART_SERIES}
              xLabel="Series A pre-money valuation ($3M round)"
              yLabel="SAFE ownership after the round"
              xFormat={(n) => usdCompact(n)}
              yFormat={(n) => `${Math.round(n)}%`}
              height={300}
              marker={{ x: 15_000_000, label: 'default scenario' }}
              caption={`One $500k SAFE, three term sets, re-converted at every valuation. The indigo “both terms” curve is the pointwise upper envelope of the other two — that is the holder’s election, made visible: below the $12.5M crossover it rides the discount line (pays 80% of a cheap round), above it the cap line (price pinned at cap ÷ Company Capitalization). Note the shapes: the cap-only line rises with valuation toward its 5% ceiling, the discount-only line falls without limit, and the both-terms line bottoms out exactly at the crossover — the SAFE holder’s worst round is neither a down round nor a hot one, but one priced precisely at cap ÷ rate.`}
            />
          </div>
        </SectionShell>

        {/* Deep-dive guide */}
        <div className="border-t border-slate-200 pt-12 dark:border-white/[0.07]">
          <section id="guide" aria-label="Post-money SAFE conversion guide" className="scroll-mt-28">
            <SafeNoteArticle />
          </section>
        </div>

        {/* Rendered only once the integration pass registers this slug in
            lib/site.ts — before that the shared chain would show a workflow
            this page is missing from (see REGISTERED above). */}
        {REGISTERED && <WorkflowChain currentSlug={calc.slug} />}

        <ProvenanceFooter
          sources={[
            {
              label: 'Instrument mechanics',
              detail:
                'Y Combinator standard Post-Money SAFE form (2018 revision, ycombinator.com/documents) — a contractual template, not statute. Conversion implemented per the form’s defined terms: Company Capitalization (pre-round fully diluted count including granted and promised options, the existing unallocated pool, and all converting securities; excluding the new round and, per the form, any option-pool increase adopted in connection with it), Safe Price (cap ÷ Company Capitalization), and Discount Price (Discount Rate × round price).',
            },
            {
              label: 'Term-sheet convention',
              detail:
                'The pre-money is struck on the post-conversion table — SAFEs convert immediately prior to the financing (the standard reading, per YC’s published Safe Primer walkthroughs). The model states this openly because term sheets quoting pre-money “before the SAFEs” exist and produce different splits.',
            },
            {
              label: 'Discount-rate convention',
              detail:
                'The form’s Discount Rate is the share of the round price PAID — a “20% discount” is a rate of 0.80. The tool’s inputs are percent-off and the library enforces the conversion everywhere, because conflating the two inflates a SAFE’s claim 4× (0.80 ÷ 0.20).',
            },
            {
              label: 'Checks run on this page',
              detail:
                'Scenario cells, the footnote identity (extra dilution = pre-round claim × pre ÷ post), and every chart point are computed at build time from the same lib/safe.ts the widget imports — nothing hand-typed.',
            },
            {
              label: 'Out of scope',
              detail:
                'Pre-money SAFEs (pre-2018 form), convertible notes (interest, maturity), conversion at dissolution/change-of-control/IPO, option pools created with the round, side letters and pro-rata, share rounding, liquidation waterfalls, and all tax treatment.',
            },
          ]}
          disclaimer="This is an illustrative model of post-money SAFE conversion, not legal, tax, or investment advice. Side letters and amendments change the arithmetic; real closings round share counts per the documents. Work actual financings with qualified counsel."
        />
      </CalculatorPageShell>
    </>
  );
}

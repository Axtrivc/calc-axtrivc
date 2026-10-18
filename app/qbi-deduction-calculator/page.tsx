import type { Metadata } from 'next';
import CalculatorPageShell from '@/components/CalculatorPageShell';
import QbiCalculator from '@/components/calculators/QbiCalculator';
import QbiArticle from '@/components/content/QbiArticle';
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
import { computeQbiDeduction, QBI_CONSTANTS } from '@/lib/qbi';
import { usd, usdCompact } from '@/lib/format';

/**
 * Page-local instrument record — an exact mirror of this slug's registry entry
 * in lib/site.ts. Hardcoded to stage 3 — Structure — alongside the
 * entity-choice instruments it belongs with.
 */
const calc: Calculator = {
  slug: 'qbi-deduction-calculator',
  href: '/qbi-deduction-calculator/',
  title: 'QBI Deduction Calculator',
  shortTitle: 'QBI Deduction',
  tagline: '§199A at 2025 thresholds: SSTB phase-outs, W-2 wage limits, the 20% cap.',
  description:
    'Compute the §199A qualified business income deduction with 2025 thresholds ($197,300 single / $394,600 MFJ). See the SSTB phase-out curve, the 50%-wages vs 25%+2.5%-UBIA limitation, and whether payroll can rescue your deduction.',
  icon: 'Landmark',
  category: 'Taxes',
  tags: [
    'qbi',
    'section 199a',
    '199a deduction',
    'sstb',
    'pass-through deduction',
    'form 8995',
    'w-2 wage limitation',
    'ubia',
  ],
  accent: 'indigo',
  stage: 3,
  stageLabel: 'Structure',
  dataBasis: 'IRC §199A as computed line-by-line on IRS Form 8995/8995-A; 2025 parameters per Rev. Proc. 2024-40',
  formulaSnapshot: 'min( 20%×QBI , wage/UBIA limit , 20%×taxable income )',
};

/* Build-time scenario grid: one business ($150k QBI, single filer) seen
   through every §199A regime — below threshold, mid-band, and above it — with
   and without payroll. The $60k wage column is exactly 40% of QBI, the level
   at which the 50% branch fully unlocks the deduction. */
const TH = QBI_CONSTANTS.threshold.single;
const RANGE = QBI_CONSTANTS.phaseInRange.single;
const TI_GRID = [150000, TH, 220000, TH + RANGE, 350000];
const WAGES_GRID = [0, 60000];

const SCENARIO_ROWS = TI_GRID.map((ti) => ({
  ti,
  // Cell order must mirror the table header below exactly: SSTB at $0 then
  // $60k of wages, then non-SSTB at $0 then $60k — i.e. SSTB-MAJOR iteration.
  // (A wages-major flatMap would silently swap the middle two columns under
  // any parameter set where SSTB·$60k ≠ non-SSTB·$0; at the shipped defaults
  // those two happen to coincide because $60k = 40% × QBI.)
  cells: ([true, false] as const).flatMap((sstb) =>
    WAGES_GRID.map((w) =>
      computeQbiDeduction({
        qbi: 150000,
        taxableIncome: ti,
        w2Wages: w,
        ubia: 0,
        sstb,
        filingStatus: 'single',
      }).deduction,
    ),
  ),
}));

/* Chart series: the phase-out at $60k of wages — payroll holds the non-SSTB
   line flat while the SSTB line still dies at the top of the band. The grid
   starts at the QBI level ($150k): below it the 20%-of-taxable-income cap,
   not the business limits, would pull both lines down. */
const CHART_TI = Array.from({ length: 50 }, (_, i) => 150000 + i * 5000);
const CHART_SERIES = [
  {
    label: 'Non-SSTB, $60k wages',
    color: '#0ea5e9',
    points: CHART_TI.map((ti) => ({
      x: ti,
      y: computeQbiDeduction({ qbi: 150000, taxableIncome: ti, w2Wages: 60000, ubia: 0, sstb: false, filingStatus: 'single' }).deduction,
    })),
  },
  {
    label: 'SSTB, $60k wages',
    color: '#e11d48',
    points: CHART_TI.map((ti) => ({
      x: ti,
      y: computeQbiDeduction({ qbi: 150000, taxableIncome: ti, w2Wages: 60000, ubia: 0, sstb: true, filingStatus: 'single' }).deduction,
    })),
  },
];

/**
 * Registration probe: the shared WorkflowChain maps over the suite registry in
 * lib/site.ts, so render it only once this slug is present there — before
 * that, the chain would have no "You are here" step for this page.
 */
const REGISTERED = calculators.some((c) => c.slug === 'qbi-deduction-calculator');

export const metadata: Metadata = {
  title: 'QBI Deduction Calculator (2025) — §199A SSTB Phase-Out & W-2 Wage Limits',
  description:
    'Compute your §199A QBI deduction with 2025 thresholds ($197,300 single / $394,600 MFJ). See the SSTB phase-out curve, the 50%-wages vs 25%+2.5%-UBIA limit, and whether more payroll can rescue your deduction.',
  keywords: [
    'qbi deduction calculator',
    '199a calculator',
    'section 199a',
    'qbi',
    'sstb',
    'specified service trade or business',
    'pass-through deduction',
    'form 8995',
    'w-2 wage limitation',
    'ubia',
    's corp qbi',
  ],
  alternates: { canonical: calc.href },
  openGraph: {
    title: 'QBI Deduction Calculator (2025) — §199A SSTB Phase-Out & W-2 Wage Limits',
    description:
      'The full §199A model: applicable percentage, SSTB exclusion, the greater-of wage/UBIA limit, and the 20%-of-taxable-income cap — with the phase-out chart for your numbers.',
    url: `${siteConfig.url}${calc.href}`,
    type: 'website',
  },
};

export default function QbiDeductionCalculatorPage() {
  return (
    <>
      <AppJsonLd calc={calc} />
      <CalculatorPageShell calc={calc}>
        {/* Interactive tool */}
        <section id="calculator" aria-label="QBI deduction calculator tool" className="scroll-mt-28">
          <QbiCalculator />
        </section>

        {/* Methodology */}
        <div className="border-t border-slate-200 pt-12 dark:border-white/[0.07]">
          <SectionShell
            id="methodology"
            eyebrow="Methodology"
            title="The §199A computation, stated exactly"
            accent={calc.accent}
            intro="Everything below mirrors IRS Form 8995-A (2025) line by line — the same order the form applies the limits in, which matters because the SSTB reduction and the wage-limit phase-in compound rather than run in parallel."
          >
            <MethodologyGrid
              formulas={[
                {
                  label: 'Applicable percentage',
                  expression: 'ap = 1 − clamp((TI − $197,300) / $50,000, 0, 1)',
                  note: 'Schedule A line 10. MFJ: $394,600 threshold over a $100,000 statutory range (IRC §199A(e)(2)(B)(ii), not inflation-indexed). ap = 1 at or below the threshold, 0 at the top of the range.',
                },
                {
                  label: 'SSTB reduction',
                  expression: 'Q_e, W_e, U_e = ap × (QBI, W-2 wages, UBIA)',
                  note: 'Schedule A lines 11–13 feed the reduced amounts into form lines 2/4/7 — QBI, wages AND property basis are all cut to the applicable percentage before anything else happens. Non-SSTB amounts enter unreduced.',
                },
                {
                  label: 'Tentative deduction & wage limit',
                  expression: 'T = 20% × Q_e ; L = max(50% × W_e, 25% × W_e + 2.5% × U_e)',
                  note: 'Form lines 3–10. The greater-of test is per trade or business; W-2 wages include an S-corp owner’s own salary. Below the threshold the wage limit is statutorily off (§199A(b)(3)(A)).',
                },
                {
                  label: 'Phase-in of the wage limit',
                  expression: 'component = max( min(T, L), T − max(0, T − L) × pip )',
                  note: 'Line 13 = the greater of line 11 (min of T and L) and line 26 (T minus the phased-in excess), with pip = 1 − ap. Below the threshold: component = T. This sequencing is what makes a wage-less SSTB mid-band land at 20% × QBI × ap².',
                },
                {
                  label: 'Overall cap',
                  expression: 'deduction = min(component, 20% × (TI − net capital gain))',
                  note: 'Form lines 35–37. Net capital gain and qualified dividends are subtracted from the cap in real life; this tool assumes $0 and says so wherever the cap binds.',
                },
                {
                  label: 'Wage-unlock solve',
                  expression: 'W_unlock = min(T / 50%, (T − 2.5%·U_e) / 25%) / ap',
                  note: 'The smallest W-2 wage bill at which the greater-of limit covers the full tentative deduction — whichever branch reaches T first, converted back to full wages (SSTB wages are ap-reduced first).',
                },
              ]}
              assumptions={[
                'Tax year 2025: $197,300 single / $394,600 MFJ thresholds (Rev. Proc. 2024-40) with the statutory $50,000 / $100,000 phase-in ranges.',
                'One qualified trade or business; no aggregation, no qualified-loss carryforwards, no REIT/PTP component, no cooperative patron reduction.',
                'Net capital gain and qualified dividends are assumed $0 — with capital gains in the mix the real 20% cap is lower than shown.',
                'Owner W-2 wages are excluded from QBI by statute but count in the business’s wage limitation — the S-corp reality.',
                'The wage-limit excess phases in per Form 8995-A Part III, after Schedule A reduces SSTB amounts — the two reductions compound for SSTBs inside the band.',
                'W-2 wages for the limitation are wages allocable to QBI; the IRS’s three box-methods are not distinguished.',
              ]}
            />
          </SectionShell>
        </div>

        {/* Scenario analysis */}
        <SectionShell
          id="scenarios"
          eyebrow="Scenario analysis"
          title="One business, every §199A regime"
          accent={calc.accent}
          intro="A $150,000-QBI single-filer business computed at build time by this page's own library — below the threshold, mid-phase-out, and above it, with and without payroll. The $60k wage column is exactly 40% of QBI: the point where the 50% branch fully unlocks the deduction."
        >
          <ScenarioPanel
            title="Annual §199A deduction by taxable income, SSTB status and payroll"
            description="Rows sweep taxable income; columns pair SSTB / non-SSTB against $0 vs $60,000 of W-2 wages. Same QBI ($150,000) in every cell."
            columns={['Taxable income', 'SSTB · $0 wages', 'SSTB · $60k wages', 'Non-SSTB · $0 wages', 'Non-SSTB · $60k wages', '']}
            footnote={`Regime map: at ${usd(TH, 0)} and below (and at the threshold itself) every column pays the clean 20%. Mid-band (${usd(220000, 0)}), payroll is worth ${usd(16380, 0)} − ${usd(8943.48, 0)} = ${usd(7436.52, 0)} to the SSTB — the two reductions compound without wages. Past ${usd(TH + RANGE, 0)}, the SSTB is gone at any wage level while the non-SSTB keeps a floor equal to its wage limit (50% of wages), and a wage-less non-SSTB keeps nothing.`}
          >
            <tbody className="divide-y divide-slate-100 dark:divide-white/[0.06]">
              {SCENARIO_ROWS.map((row) => (
                <tr key={row.ti}>
                  <th
                    scope="row"
                    className="readout font-semibold normal-case tracking-normal text-slate-900 dark:text-slate-100"
                  >
                    {usd(row.ti, 0)}
                    <span className="block text-[11px] font-normal text-slate-500 dark:text-slate-400">
                      {row.ti === TH
                        ? 'threshold'
                        : row.ti === TH + RANGE
                          ? 'phase-out ends'
                          : row.ti === 220000
                            ? 'mid-band (ap 54.6%)'
                            : row.ti < TH
                              ? 'below threshold'
                              : 'above range'}
                    </span>
                  </th>
                  {row.cells.map((ded, i) => (
                    <td key={i} className="text-right">
                      <span
                        className={`readout inline-block whitespace-nowrap rounded-full px-2 py-0.5 font-semibold ${
                          ded <= 0.005
                            ? 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400'
                            : ded >= 29999
                              ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400'
                              : 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300'
                        }`}
                      >
                        {ded <= 0.005 ? '—' : usd(ded, 0)}
                      </span>
                    </td>
                  ))}
                  <td aria-hidden="true" />
                </tr>
              ))}
            </tbody>
          </ScenarioPanel>

          <div className="mt-6">
            <ComparisonChart
              series={CHART_SERIES}
              xLabel="Taxable income before QBI deduction"
              yLabel="QBI deduction / yr"
              xFormat={(n) => usdCompact(n)}
              yFormat={(n) => usdCompact(n)}
              height={300}
              marker={{ x: 220000, label: 'mid-band example' }}
              caption="With $60,000 of wages (40% of QBI), the non-SSTB line never dips — its wage limit equals the full 20% at every income level. The SSTB line still collapses to zero at $247,300 because the applicable percentage kills the QBI base itself; no wage level prevents that. This is the structural difference the tool lets you probe with your own numbers."
            />
          </div>
        </SectionShell>

        {/* Deep-dive guide */}
        <div className="border-t border-slate-200 pt-12 dark:border-white/[0.07]">
          <section id="guide" aria-label="QBI deduction guide" className="scroll-mt-28">
            <QbiArticle />
          </section>
        </div>

        {/* Rendered only once the slug is registered in lib/site.ts —
            see REGISTERED above. */}
        {REGISTERED && <WorkflowChain currentSlug={calc.slug} />}

        <ProvenanceFooter
          sources={[
            {
              label: 'Computation authority',
              detail:
                'The deduction chain reproduces IRS Form 8995 / Form 8995-A (2025) line by line, including Schedule A (SSTB applicable-percentage reduction) and Part III (phase-in of the wage-limit excess), per the IRS instructions for those forms.',
            },
            {
              label: '2025 parameters',
              detail:
                'Thresholds $197,300 single / $394,600 MFJ from Rev. Proc. 2024-40; phase-in ranges $50,000 / $100,000 fixed by IRC §199A(e)(2)(B)(ii) (not indexed). W-2/UBIA limitation per §199A(b)(1)(B); overall cap per §199A(a)(2).',
            },
            {
              label: 'Verification basis',
              detail:
                'Mid-band mechanics cross-checked against the AICPA Tax Adviser’s published worked examples (March 2020, “Optimal choice of entity for the QBI deduction”), reproduced to the dollar by this page’s library; SSTB field list from the Form 8995-A instructions.',
            },
            {
              label: 'Out of scope',
              detail:
                'State income tax, NIIT, multiple businesses and aggregation, qualified-loss netting and carryforwards, capital gains against the cap, REIT/PTP income, and the OBBBA parameter changes that begin in 2026.',
            },
          ]}
          disclaimer="This is an illustrative federal model, not tax advice. §199A turns on facts — SSTB classification, wage allocation methods, and aggregation elections are all judgment calls the IRS litigates. Confirm thresholds for your filing year and run material decisions past a qualified professional."
        />
      </CalculatorPageShell>
    </>
  );
}

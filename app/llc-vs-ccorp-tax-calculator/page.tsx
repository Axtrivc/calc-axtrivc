import type { Metadata } from 'next';
import CalculatorPageShell from '@/components/CalculatorPageShell';
import TaxCalculator from '@/components/calculators/TaxCalculator';
import TaxArticle from '@/components/content/TaxArticle';
import {
  AppJsonLd,
  MethodologyGrid,
  ProvenanceFooter,
  ScenarioPanel,
  SectionShell,
  WorkflowChain,
} from '@/components/professional';
import { calculators, siteConfig } from '@/lib/site';
import { compareEntities } from '@/lib/tax';
import { pct, usd } from '@/lib/format';

const calc = calculators.find((c) => c.slug === 'llc-vs-ccorp-tax-calculator')!;

/* Profit ladder spanning the realistic solo/small-business range — wide enough
   to expose the structural crossover between pass-through and double taxation. */
const PROFIT_LADDER = [50_000, 100_000, 200_000, 400_000, 800_000];

export const metadata: Metadata = {
  title: 'LLC vs C-Corp Tax Calculator (2025) — Compare Federal Taxes',
  description:
    'Compare business tax liabilities between LLC and C-Corp entity structures. Calculate self-employment, corporate, and dividend taxes accurately.',
  keywords: [
    'llc vs c corp calculator',
    'llc vs c corp tax',
    'c corporation tax',
    'self employment tax',
    'qbi deduction',
    'double taxation',
    'business entity tax',
    'pass through taxation',
  ],
  alternates: { canonical: calc.href },
  openGraph: {
    title: 'LLC vs C-Corp Tax Calculator (2025) — Compare Federal Taxes',
    description:
      'See how much federal tax you would pay as an LLC vs a C-Corp at any profit level. Includes QBI deduction, SE tax, corporate tax, and dividend tax.',
    url: `${siteConfig.url}${calc.href}`,
    type: 'website',
  },
};

export default function LlcVsCcorpPage() {
  return (
    <>
      <AppJsonLd calc={calc} />
      <CalculatorPageShell calc={calc}>
        {/* Interactive tool */}
        <section id="calculator" aria-label="LLC vs C-Corp tax calculator tool" className="scroll-mt-28">
          <TaxCalculator />
        </section>

        {/* Methodology */}
        <div className="border-t border-slate-200 pt-12">
          <SectionShell
            id="methodology"
            eyebrow="Methodology"
            title="Two structures, one dollar of profit"
            accent={calc.accent}
            intro="The comparison deliberately models both extremes: every dollar leaves an LLC through self-employment tax plus your personal brackets, and through 21% corporate tax plus dividend tax in a C-Corp. Isolating the extremes makes the structural trade-off visible before real-world salary mixing complicates it."
          >
            <MethodologyGrid
              formulas={[
                {
                  label: 'LLC — pass-through stack',
                  expression: 'SE 15.3% (≤ $176,100), 2.9% above · income brackets − QBI 20%',
                  note: 'Half of SE tax is deductible against income; the 20% qualified business income deduction applies to what remains; the standard deduction ($14,600, single) reduces taxable income.',
                },
                {
                  label: 'C-Corp — double taxation',
                  expression: 'corporate 21% → after-tax profit → LTCG 15–20% on dividends',
                  note: 'The entity pays a flat 21% on all profit; distributions are then taxed again at qualified-dividend rates on top of their own bracket schedule.',
                },
                {
                  label: 'Comparison basis',
                  expression: 'cheaper = min(total tax LLC , total tax C-Corp)',
                  note: 'Both structures absorb the same pre-tax profit, so the absolute delta is the saving from choosing correctly before any other factor.',
                },
                {
                  label: 'Effective-rate check',
                  expression: 'effective % = total tax ÷ profit',
                  note: 'The single number to quote when the two stacks must be compared across profit levels — it exposes where each structure scales worse.',
                },
              ]}
              assumptions={[
                'Single owner who distributes 100% of profit — full draws under an LLC, full dividends in the C-Corp case.',
                'Tax-year 2025 US federal parameters only: seven ordinary brackets, $14,600 single standard deduction, $176,100 Social Security wage base, 21% corporate rate.',
                'No W-2 salary inside the C-Corp. Real owners blend deductible salary with dividends — the guide below works that intermediate zone.',
                'State income/franchise taxes, the 3.8% net investment income surtax, and payroll-related employer burdens are outside the model.',
                'Qualified dividends are taxed through the 2025 single-filer long-term capital gains brackets without applying the standard deduction.',
              ]}
            />
          </SectionShell>
        </div>

        {/* Scenario analysis */}
        <SectionShell
          id="scenarios"
          eyebrow="Scenario analysis"
          title="Where each structure wins"
          accent={calc.accent}
          intro="Computed here by the same function behind the widget above across a five-point profit ladder — and the model says the quiet part out loud: under this all-distributed federal comparison the answer is unambiguous at every level. The size of the gap, not the winner, is the real story."
        >
          <ScenarioPanel
            title="Total federal tax — LLC vs C-Corp by annual profit"
            description="Total tax burden first line (LLC / C-Corp), effective rate second. The winning structure per rung is flagged with its absolute saving."
            columns={['Annual profit', 'LLC — pass-through', 'C-Corp — double tax', 'Cheaper structure']}
            footnote="Pass-through wins every rung shown, and keeps winning through the range real businesses inhabit: progressive brackets drag the LLC's effective rate from 20.2% to 28.4% across the ladder, but the C-Corp path is structurally heavier — its 21% corporate charge plus the 15–20% dividend toll on the remaining 79% climbs from 21% toward a ~36.8% asymptote it cannot escape while profits are distributed. The genuine C-Corp arguments are structural rather than distributional: retaining earnings inside the entity at 21%, blended W-2 salary strategies, and equity mechanics — all covered in the guide below."
          >
            <tbody className="divide-y divide-slate-100">
              {PROFIT_LADDER.map((profit) => {
                const r = compareEntities(profit);
                return (
                  <tr key={profit}>
                    <th scope="row" className="readout font-semibold normal-case tracking-normal text-slate-900">
                      {usd(profit, 0)}
                    </th>
                    <td className="text-right">
                      <span className="readout block whitespace-nowrap font-medium text-slate-800">{usd(r.llc.totalTax)}</span>
                      <span className="readout block text-xs text-slate-400">{pct(r.llc.effectiveRate)}</span>
                    </td>
                    <td className="text-right">
                      <span className="readout block whitespace-nowrap font-medium text-slate-800">{usd(r.ccorp.totalTax)}</span>
                      <span className="readout block text-xs text-slate-400">{pct(r.ccorp.effectiveRate)}</span>
                    </td>
                    <td className="text-right">
                      {r.winner === 'tie' ? (
                        <span className="chip bg-slate-100 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                          Even
                        </span>
                      ) : (
                        <span
                          className={`chip text-[11px] font-semibold uppercase tracking-wider ${
                            r.winner === 'llc'
                              ? 'bg-emerald-50 text-emerald-700'
                              : 'bg-indigo-50 text-indigo-700'
                          }`}
                        >
                          {r.winner === 'llc' ? 'LLC' : 'C-Corp'} · saves {usd(r.delta, 0)}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </ScenarioPanel>
        </SectionShell>

        {/* Deep-dive guide */}
        <div className="border-t border-slate-200 pt-12">
          <section id="guide" aria-label="LLC vs C-Corp tax guide" className="scroll-mt-28">
            <TaxArticle />
          </section>
        </div>

        <WorkflowChain currentSlug={calc.slug} />

        <ProvenanceFooter
          sources={[
            {
              label: 'Federal parameters',
              detail:
                'Tax-year 2025 inflation-adjusted US federal values: standard deduction $14,600 (single), Social Security wage base $176,100, ordinary brackets 10–37%, qualified dividends via the 0/15/20% LTCG schedule.',
            },
            {
              label: 'Statutory anchors',
              detail:
                'Corporate rate from IRC §11 (21%, TCJA); QBI passthrough deduction from IRC §199A (20%); self-employment tax from IRC §1401 (15.3% with the wage-base split modeled as the code applies it).',
            },
            {
              label: 'What would change the answer',
              detail:
                'State-level income or franchise taxes, a blended W-2 salary/dividend mix, retained earnings held inside a C-Corp, QBI wage-limitation thresholds, and the NIIT — every one is intentionally out of this simplified model.',
            },
          ]}
          disclaimer="This comparison is an educational model of federal structure differences at the extremes, not tax advice. Entity selection interacts with ownership plans, exit strategy, and state law — take real numbers to a CPA before incorporating."
        />
      </CalculatorPageShell>
    </>
  );
}

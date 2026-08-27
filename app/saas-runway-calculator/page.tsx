import type { Metadata } from 'next';
import CalculatorPageShell from '@/components/CalculatorPageShell';
import RunwayCalculator from '@/components/calculators/RunwayCalculator';
import RunwayArticle from '@/components/content/RunwayArticle';
import {
  AppJsonLd,
  MethodologyGrid,
  ProvenanceFooter,
  ScenarioPanel,
  SectionShell,
  WorkflowChain,
} from '@/components/professional';
import { calculators, siteConfig } from '@/lib/site';
import { computeRunway } from '@/lib/runway';

const calc = calculators.find((c) => c.slug === 'saas-runway-calculator')!;

/* Worked example held constant across the matrix (fully disclosed below):
   an early-stage SaaS spending $80k/month against $30k MRR — $50k initial
   net burn. Rows stress the cash position; columns stress compounding. */
const CASH_BALANCES = [250_000, 500_000, 1_000_000, 2_000_000];
const GROWTH_RATES = [0, 2, 5, 10];
const PROFILE = { grossBurn: 80_000, mrr: 30_000 };

export const metadata: Metadata = {
  title: 'SaaS Runway Calculator — Cash Burn, MRR & Months Left (2025)',
  description:
    'Project your startup cash runway and burn rate in months. Model revenue growth, monthly expenses, and break-even MRR with interactive charts.',
  keywords: [
    'saas runway calculator',
    'startup runway',
    'burn rate calculator',
    'cash runway',
    'net burn',
    'gross burn',
    'mrr calculator',
    'break even mrr',
  ],
  alternates: { canonical: calc.href },
  openGraph: {
    title: 'SaaS Runway Calculator — Cash Burn, MRR & Months Left (2025)',
    description:
      'Calculate your startup runway in months. Cash balance, gross burn, MRR, and growth rate — with a month-by-month visual breakdown.',
    url: `${siteConfig.url}${calc.href}`,
    type: 'website',
  },
};

export default function SaasRunwayPage() {
  return (
    <>
      <AppJsonLd calc={calc} />
      <CalculatorPageShell calc={calc}>
        {/* Interactive tool */}
        <section id="calculator" aria-label="SaaS runway calculator tool" className="scroll-mt-28">
          <RunwayCalculator />
        </section>

        {/* Methodology */}
        <div className="border-t border-slate-200 pt-12">
          <SectionShell
            id="methodology"
            eyebrow="Methodology"
            title="Runway is a simulation, not a division"
            accent={calc.accent}
            intro="The popular shortcut — divide cash by burn — quietly assumes your business stands still. When MRR compounds each month, net burn shrinks month after month and the true runway is longer than the shortcut suggests."
          >
            <MethodologyGrid
              formulas={[
                {
                  label: 'Net burn (this month)',
                  expression: 'net burn = gross burn − MRR',
                  note: 'Gross burn is total monthly operating spend; MRR offsets it directly. Negative net burn means the machine sustains itself.',
                },
                {
                  label: 'Break-even revenue',
                  expression: 'break-even MRR = gross burn',
                  note: 'The level at which net burn reaches zero. Every dollar of recurring revenue below it consumes runway; every dollar above it buys expansion.',
                },
                {
                  label: 'Monthly simulation step',
                  expression: 'cashₜ₊₁ = cashₜ − net burnₜ · MRRₜ₊₁ = MRRₜ × (1 + g)',
                  note: 'Applied repeatedly until cash ≤ 0 or the 120-month horizon. Non-linear by construction — this is where the division shortcut fails.',
                },
                {
                  label: 'Flat-burn shortcut',
                  expression: 'runway ≈ cash ÷ net burn',
                  note: 'Exact only when growth = 0%. Kept visible as the sanity check: how far ahead of naive division does compounding actually put you?',
                },
              ]}
              assumptions={[
                'Growth compounds on current MRR every month at the rate you set; the rate itself stays constant (no acceleration or churn waves).',
                'Gross burn is held flat — hiring rounds and pricing changes reset the clock and belong in a fresh projection.',
                'Revenue is treated as collected cash in-month: no receivables lag, seasonality, or deferred-revenue timing.',
                'A fundraise is not modeled: new capital changes the starting balance, never the slope.',
                'The simulation caps at 120 months; profitability usually ends the exercise well before.',
              ]}
            />
          </SectionShell>
        </div>

        {/* Scenario analysis */}
        <SectionShell
          id="scenarios"
          eyebrow="Scenario analysis"
          title="Compounding vs. capital: what actually buys months"
          accent={calc.accent}
          intro={`One worked example runs through the whole grid: ${'$' + PROFILE.grossBurn.toLocaleString('en-US')} monthly gross burn against ${'$' + PROFILE.mrr.toLocaleString('en-US')} MRR — ${"$" + ((PROFILE.grossBurn - PROFILE.mrr)).toLocaleString("en-US")} initial net burn. Rows raise the cash pile; columns raise the monthly compounding rate.`}
        >
          <ScenarioPanel
            title="Projected runway in months — cash balance × MRR growth"
            description="Each cell replays the month-by-month simulation from Methodology. “Breakeven” marks cells where MRR overtakes gross burn before cash depletes; deltas (+N mo) compare against the same row's flat-burn column."
            columns={['Cash balance', ...GROWTH_RATES.map((g) => `+${g}% MRR / mo`)]}
            footnote="Read the grid left to right. With MRR at $30k against $80k of burn, mild growth only stretches the clock by one to four months — the payoff is a cliff, not a slope: past the growth rate where MRR overtakes gross burn before the cash depletes (by +5% monthly at $1M, but not until +10% at $500k), the 'Breakeven' cells mean runway stops being a countdown entirely. The left-hand column is exactly the naive cash ÷ burn division most teams quote in board decks."
          >
            <tbody className="divide-y divide-slate-100">
              {CASH_BALANCES.map((cash) => {
                const baseMonths = computeRunway({ cash, ...PROFILE, growthRate: 0 }).months;
                return (
                  <tr key={cash}>
                    <th scope="row" className="readout font-semibold normal-case tracking-normal text-slate-900">
                      ${new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(cash)}
                    </th>
                    {GROWTH_RATES.map((g) => {
                      const r = computeRunway({ cash, ...PROFILE, growthRate: g });
                      const delta =
                        r.months !== null && baseMonths !== null ? Math.round(r.months - baseMonths) : null;
                      return (
                        <td key={g} className="text-right">
                          {r.months !== null ? (
                            <>
                              <span className="readout block whitespace-nowrap font-semibold text-slate-800">
                                {Math.floor(r.months)} mo
                              </span>
                              {delta !== null && delta > 0 && (
                                <span className="readout block text-xs text-emerald-600">+{delta} mo</span>
                              )}
                            </>
                          ) : (
                            <span className="chip bg-emerald-50 text-[11px] font-semibold uppercase tracking-wider text-emerald-700">
                              Breakeven
                            </span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </ScenarioPanel>
        </SectionShell>

        {/* Deep-dive guide */}
        <div className="border-t border-slate-200 pt-12">
          <section id="guide" aria-label="SaaS runway guide" className="scroll-mt-28">
            <RunwayArticle />
          </section>
        </div>

        <WorkflowChain currentSlug={calc.slug} />

        <ProvenanceFooter
          sources={[
            {
              label: 'Simulation semantics',
              detail:
                'Deterministic month-stepping with a 120-month cap: identical inputs always reproduce identical trajectories — no sampling, no confidence intervals dressed up as certainty.',
            },
            {
              label: 'Definitions in force',
              detail:
                'Gross burn = total monthly cash operating expenses. MRR enters as collected cash in the month it bills. Break-even MRR equals gross burn exactly.',
            },
            {
              label: 'Deliberately excluded',
              detail:
                'Fundraising events, hiring ramps, annual-prepay distortions, and one-time windfalls — model them by editing inputs between scenarios, not inside one projection.',
            },
          ]}
          disclaimer="Projections are planning-grade instruments, not forecasts of what will happen. Reconcile the cash input against your bank balance monthly; stale balances make precise-looking outputs worthless."
        />
      </CalculatorPageShell>
    </>
  );
}

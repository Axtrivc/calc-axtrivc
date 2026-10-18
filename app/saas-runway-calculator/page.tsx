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
  title: 'SaaS Runway Calculator — Cash Burn, MRR & Months Left (2026)',
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
    title: 'SaaS Runway Calculator — Cash Burn, MRR & Months Left (2026)',
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
        <div className="border-t border-slate-200 pt-12 dark:border-white/[0.07]">
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
                  expression: 'net burn = gross burn − MRR × gross margin',
                  note: 'Gross burn is total monthly operating spend; MRR offsets it only to the extent revenue survives COGS. The margin input defaults to 80% in the tool — set 100% for the zero-COGS textbook case. Negative net burn means the machine sustains itself.',
                },
                {
                  label: 'Break-even revenue',
                  expression: 'break-even MRR = gross burn ÷ gross margin',
                  note: 'The MRR level at which net burn reaches zero: $50k of burn at 80% margin needs $62.5k of MRR, not $50k. At 0% margin no revenue amount closes the gap. Every dollar of margin-weighted recurring revenue below break-even consumes runway; every dollar above it buys expansion.',
                },
                {
                  label: 'Monthly simulation step',
                  expression: 'cashₜ₊₁ = cashₜ − net burnₜ;  MRRₜ₊₁ = MRRₜ × (1 + g)',
                  note: 'Applied repeatedly until cash ≤ 0, break-even (plus two months of upturn), or the 120-month horizon. Non-linear by construction — this is where the division shortcut fails.',
                },
                {
                  label: 'Break-even growth rate',
                  expression: 'smallest g where cash never hits zero',
                  note: 'Found by bisection over the simulation (±0.001pp): below this growth rate you are counting months down; at or above it the countdown stops. Reported in the tool as “growth to break even”.',
                },
                {
                  label: 'Collections stress variant',
                  expression: 'collectedₜ = gross margin × MRRₜ₋₁  (lag = 1)',
                  note: 'One toggle in the tool pays every month\u2019s revenue one month later — month 1 collects nothing. Everything else stays identical; the delta is the price of slow payers.',
                },
                {
                  label: 'Flat-burn shortcut',
                  expression: 'runway ≈ cash ÷ net burn',
                  note: 'Exact only when growth = 0% — and then the simulation reproduces it to the decimal. Runway figures interpolate linearly inside the final month; counting only completed whole months (this engine\u2019s month index) yields the ceiling of those figures — a $500 pile against $50k of burn is 0.01 months, not 1.',
                },
              ]}
              assumptions={[
                'Growth compounds on current MRR every month at a constant rate — negative rates are allowed (down to −20%/mo) to model contraction where churn outruns expansion; churn waves and acceleration belong in fresh projections.',
                'Gross burn is held flat — hiring rounds and pricing changes reset the clock and belong in a fresh projection.',
                'MRR offsets burn only up to the gross-margin input; the scenario grid below holds margin at 100% for readability.',
                'Revenue is treated as collected cash in-month unless the collections toggle shifts every payment one month later; no seasonality or deferred-revenue timing.',
                'A fundraise is not modeled: new capital changes the starting balance, never the slope.',
                'The simulation caps at 120 months, and stops shortly after break-even — compounding a profitable SaaS ten years out produces noise, not insight.',
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
          intro={`One worked example runs through the whole grid: ${'$' + PROFILE.grossBurn.toLocaleString('en-US')} monthly gross burn against ${'$' + PROFILE.mrr.toLocaleString('en-US')} MRR — ${"$" + ((PROFILE.grossBurn - PROFILE.mrr)).toLocaleString("en-US")} initial net burn at a 100% gross margin. Rows raise the cash pile; columns raise the monthly compounding rate.`}
        >
          <ScenarioPanel
            title="Projected runway in months — cash balance × MRR growth"
            description="Each cell replays the month-by-month simulation from Methodology. “Breakeven” marks cells where MRR overtakes gross burn before cash depletes; deltas (+N mo) compare against the same row's flat-burn column."
            columns={['Cash balance', ...GROWTH_RATES.map((g) => `+${g}% MRR / mo`)]}
            footnote="Read the grid left to right. With MRR at $30k against $80k of burn, mild growth only stretches the clock by a month or two — the payoff is a cliff, not a slope: past the growth rate where MRR overtakes gross burn before the cash depletes (by +5% monthly at $1M, but not until +10% at $500k), the 'Breakeven' cells mean runway stops being a countdown entirely. Figures show the exact month the balance crosses zero (interpolated inside the final month), so the left-hand column reproduces the naive cash ÷ net-burn division — $50k net of the $80k gross burn — to the decimal; whole-month readouts would show its ceiling (5, 10, 20, 40 here)."
          >
            <tbody className="divide-y divide-slate-100 dark:divide-white/[0.06]">
              {CASH_BALANCES.map((cash) => {
                const baseExact = computeRunway({ cash, ...PROFILE, growthRate: 0 }).monthsExact;
                return (
                  <tr key={cash}>
                    <th scope="row" className="readout font-semibold normal-case tracking-normal text-slate-900 dark:text-slate-100">
                      ${new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(cash)}
                    </th>
                    {GROWTH_RATES.map((g) => {
                      const r = computeRunway({ cash, ...PROFILE, growthRate: g });
                      const delta =
                        r.monthsExact !== null && baseExact !== null ? r.monthsExact - baseExact : null;
                      return (
                        <td key={g} className="text-right">
                          {r.months !== null ? (
                            <>
                              <span className="readout block whitespace-nowrap font-semibold text-slate-800 dark:text-slate-200">
                                {(r.monthsExact ?? 0).toFixed(1)} mo
                              </span>
                              {delta !== null && delta > 0.05 && (
                                <span className="readout block text-xs text-emerald-600 dark:text-emerald-400">+{delta.toFixed(1)} mo</span>
                              )}
                            </>
                          ) : (
                            <span className="chip bg-emerald-50 dark:bg-emerald-500/15 text-[11px] font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
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
        <div className="border-t border-slate-200 pt-12 dark:border-white/[0.07]">
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
                'Deterministic month-stepping with a 120-month cap (and an early stop just past break-even): identical inputs always reproduce identical trajectories — no sampling, no confidence intervals dressed up as certainty.',
            },
            {
              label: 'Definitions in force',
              detail:
                'Gross burn = total monthly cash operating expenses. MRR enters as collected cash in the month it bills, scaled by the gross-margin input (100% in the grid above). Break-even MRR = gross burn ÷ gross margin. Growth may be negative, down to −20%/mo, for contraction scenarios.',
            },
            {
              label: 'Deliberately excluded',
              detail:
                'Fundraising events, hiring ramps, annual-prepay distortions, churn waves, and one-time windfalls — model them by editing inputs between scenarios, not inside one projection.',
            },
          ]}
          disclaimer="Projections are planning-grade instruments, not forecasts of what will happen. Reconcile the cash input against your bank balance monthly; stale balances make precise-looking outputs worthless."
        />
      </CalculatorPageShell>
    </>
  );
}

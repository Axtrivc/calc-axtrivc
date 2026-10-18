import type { Metadata } from 'next';
import CalculatorPageShell from '@/components/CalculatorPageShell';
import CapTableCalculator from '@/components/calculators/CapTableCalculator';
import CapTableArticle from '@/components/content/CapTableArticle';
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
import {
  CAP_TABLE_PRESETS,
  ROUND_NAMES,
  founderPct,
  foundersPct,
  finalStage,
  simulateCapTable,
} from '@/lib/captable';
import { pct, usd, usdCompact } from '@/lib/format';

/**
 * Page-local instrument record.
 *
 * The suite registry (lib/site.ts) is owned by the integration pass; until this
 * slug is registered there, the page carries its own metadata object typed
 * exactly like a registry entry so the shell renders identically. Hardcoded
 * positioning: stage 3 of the workflow — Structure.
 */
const calc: Calculator = {
  slug: 'cap-table-dilution-calculator',
  href: '/cap-table-dilution-calculator/',
  title: 'Cap Table & Dilution Calculator',
  shortTitle: 'Cap Table',
  tagline: 'Walk founder ownership through four priced rounds — pools included.',
  description:
    'Model startup dilution round by round: enter founding shares, each round\u2019s investment, post-money valuation and option pool target, and see every shareholder\u2019s stake after Seed through Series C — plus what survives at exit.',
  icon: 'TrendingUp',
  category: 'Startups',
  tags: [
    'cap table',
    'dilution calculator',
    'option pool',
    'option pool shuffle',
    'founder ownership',
    'equity dilution',
    'seed round',
    'series a',
    'pre-money vs post-money',
    'esop',
  ],
  accent: 'indigo',
  stage: 3,
  stageLabel: 'Structure',
  dataBasis:
    'Standard US priced-round mechanics (NVCA-style): post-money inputs, pool carved from the pre-money',
  formulaSnapshot: 'new % = old shares ÷ (old + investor + pool shares)',
};

/* ------------------------------------------------------------------ */
/* Build-time scenario grid — every preset, full path, same engine.   */
/* ------------------------------------------------------------------ */

type PresetRow = {
  label: string;
  description: string;
  /** Founders-combined % after each stage; null when the path stopped earlier. */
  stages: (number | null)[];
  youFinal: number;
  foundersFinal: number;
  raised: number;
};

const PRESET_ROWS: PresetRow[] = CAP_TABLE_PRESETS.map((p) => {
  const founders = [
    { name: 'You', shares: p.founders[0].shares },
    { name: 'Cofounder', shares: p.founders[1].shares },
  ];
  const sim = simulateCapTable(
    founders,
    p.rounds.map((r, i) => ({ name: ROUND_NAMES[i], ...r })),
  );
  const final = finalStage(sim)!;
  return {
    label: p.label,
    description: p.description,
    stages: [0, 1, 2, 3].map((i) =>
      sim.stages[i + 1] ? foundersPct(sim.stages[i + 1]) : null,
    ),
    youFinal: founderPct(final, 0),
    foundersFinal: foundersPct(final),
    raised: p.rounds.reduce((a, r) => a + r.investment, 0),
  };
});

/* Pool-policy variants of the standard path for the chart: same rounds,
   three pool disciplines. x = cumulative capital raised (incl. $0 at founding). */
const STD = CAP_TABLE_PRESETS[0];
const STD_FOUNDERS = [
  { name: 'You', shares: STD.founders[0].shares },
  { name: 'Cofounder', shares: STD.founders[1].shares },
];
const cumulativeX = (() => {
  const out = [0];
  let acc = 0;
  for (const r of STD.rounds) {
    acc += r.investment;
    out.push(acc);
  }
  return out;
})();

function youTrajectory(poolDelta: number): { x: number; y: number }[] {
  const rounds = STD.rounds.map((r, i) => ({
    name: ROUND_NAMES[i],
    ...r,
    poolPct: Math.max(0, r.poolPct + poolDelta),
  }));
  const sim = simulateCapTable(STD_FOUNDERS, rounds);
  return sim.stages.map((s, i) => ({ x: cumulativeX[i], y: founderPct(s, 0) }));
}

const CHART_SERIES = [
  { label: 'No option pools (money only)', color: '#10b981', points: youTrajectory(-100) },
  { label: 'Standard pool targets (10/12/8/5%)', color: '#6366f1', points: youTrajectory(0) },
  { label: 'Every pool +4 points', color: '#f43f5e', points: youTrajectory(4) },
];

const stdRow = PRESET_ROWS[0];
const noPoolSim = simulateCapTable(
  STD_FOUNDERS,
  STD.rounds.map((r, i) => ({ name: ROUND_NAMES[i], ...r, poolPct: 0 })),
);
const noPoolFinal = foundersPct(finalStage(noPoolSim)!);
const noPoolYou = founderPct(finalStage(noPoolSim)!, 0);
const poolCostOfPath = noPoolFinal - stdRow.foundersFinal;
const poolCostOfYou = noPoolYou - stdRow.youFinal;

/* Honest decomposition of the friendly-vs-standard gap for the footnote:
   friendly ends 18.09 points higher; ~16.7 of that comes from raising $17.5M
   less at higher B/C prices, only ~1.4 from leaner pools. */
const friendlyRow = PRESET_ROWS[1];
const friendlyNoPool = foundersPct(
  finalStage(
    simulateCapTable(
      STD_FOUNDERS,
      CAP_TABLE_PRESETS[1].rounds.map((r, i) => ({ name: ROUND_NAMES[i], ...r, poolPct: 0 })),
    ),
  )!,
);
const friendlyGap = friendlyRow.foundersFinal - stdRow.foundersFinal;
const gapFromMoneyAndPricing = friendlyNoPool - noPoolFinal;
const gapFromPools = friendlyGap - gapFromMoneyAndPricing;

/** Ownership deltas are percentage POINTS, never "%" or "% points". */
const pts = (v: number, d = 1) => `${v.toFixed(d)} points`;

/**
 * Registration probe: this slug is added to the suite registry by the
 * integration pass. Until then the shared WorkflowChain would render a
 * five-tool chain this page is absent from (no "You are here"), which is worse
 * for a visitor than no chain at all — so render it only once registered.
 */
const REGISTERED = calculators.some((c) => c.slug === 'cap-table-dilution-calculator');

export const metadata: Metadata = {
  title: 'Cap Table & Dilution Calculator (2025) — Founder Ownership Through Series C',
  description:
    'Model startup dilution round by round: founding shares, investment, post-money valuation and option pool target for up to four rounds. See every shareholder after each round, the dilution waterfall, and what the founder keeps at exit.',
  keywords: [
    'cap table calculator',
    'dilution calculator',
    'equity dilution',
    'option pool shuffle',
    'founder ownership',
    'fundraising dilution',
    'seed round calculator',
    'series a dilution',
    'pre-money post-money',
    'esop calculator',
  ],
  alternates: { canonical: calc.href },
  openGraph: {
    title: 'Cap Table & Dilution Calculator (2025) — Founder Ownership Through Series C',
    description:
      'How much of the company do you still own after Seed, A, B and C? Post-money round math with option pool targets, top-up semantics, waterfall view and pool sensitivity.',
    url: `${siteConfig.url}${calc.href}`,
    type: 'website',
  },
};

export default function CapTableDilutionCalculatorPage() {
  return (
    <>
      <AppJsonLd calc={calc} />
      <CalculatorPageShell calc={calc}>
        {/* Interactive tool */}
        <section id="calculator" aria-label="Cap table dilution calculator tool" className="scroll-mt-28">
          <CapTableCalculator />
        </section>

        {/* Methodology */}
        <div className="border-t border-slate-200 pt-12 dark:border-white/[0.07]">
          <SectionShell
            id="methodology"
            eyebrow="Methodology"
            title="The model, stated exactly"
            accent={calc.accent}
            intro="Every cell in the tool follows from six statements. The convention is standard US priced-round arithmetic: the new money fixes the investor's slice of the post-round table, and the option pool is carved out of the pre-money before the price is struck."
          >
            <MethodologyGrid
              formulas={[
                {
                  label: 'Investor stake (post-money basis)',
                  expression: 'f = investment ÷ post-money',
                  note: 'The defining identity of a priced round on post-money input: the investor owns that fraction of the company immediately after close, regardless of anything else in the round.',
                },
                {
                  label: 'Post-round fully diluted shares',
                  expression: "FD' = (FD − unallocated pool) ÷ (1 − f − pool%)",
                  note: "Solved so the investor holds f·FD' and the unallocated pool holds pool%·FD'. Existing unallocated shares count toward the pool target — only the shortfall is newly created.",
                },
                {
                  label: 'Pool top-up',
                  expression: "top-up = max(0, pool% × FD' − unallocated pool)",
                  note: 'Board-style "top up to target": if the carried-over pool has only diluted to, say, 10% and the target is 8%, this round adds zero pool shares — the tool shows that instead of silently re-diluting you.',
                },
                {
                  label: 'Price per share',
                  expression: 'PPS = (post-money − investment) ÷ (FD + top-up)',
                  note: 'The top-up sits in the pre-money denominator — the option pool shuffle. At $2M/$10M post with a 10% pool, this prices at $0.70 instead of $0.80; identical to "$8M pre with the pool created first".',
                },
                {
                  label: 'Dilution of an existing holder',
                  expression: "%' = shares ÷ FD'",
                  note: 'Nobody ever takes shares from you. Rounds only grow the denominator — which is why the waterfall shows your band narrowing while its share count stays frozen.',
                },
                {
                  label: 'Stake value at exit',
                  expression: 'V = exit valuation × %final',
                  note: 'A deliberately optimistic ceiling: no liquidation preferences, no participation, no debt, no taxes. Percentage is not proceeds — see the guide.',
                },
              ]}
              assumptions={[
                'Each round is entered as investment + post-money valuation; pre-money is derived as post-money − investment.',
                'Option pool targets are % of the post-round fully diluted cap table, created inside the pre-money (the US term-sheet convention); top-ups only occur when the existing unallocated pool has diluted below target.',
                'Priced rounds only — SAFEs, convertible notes, and warrants are outside the model (the guide shows the standard approximation).',
                'Rounds are modeled strictly in order; the chain stops at the first round without an investment, and rounds where investment ≥ post-money or f + pool% ≥ 100% are rejected with a reason.',
                'No anti-dilution adjustments, secondary sales, option grants between rounds, or repurchase; share counts are frozen after issuance.',
                'Exit value multiplies your final percentage by the exit valuation and nothing else — an upper bound by construction.',
              ]}
            />
          </SectionShell>
        </div>

        {/* Scenario analysis */}
        <SectionShell
          id="scenarios"
          eyebrow="Scenario analysis"
          title="What the same founders keep, path by path"
          accent={calc.accent}
          intro="Computed at build time by the same functions that power the widget. Two founders, 6M + 4M shares at incorporation — only the rounds and pool discipline change."
        >
          <ScenarioPanel
            title="Founders-combined ownership after each round, by scenario preset"
            description="Each cell is the full model — investor stakes, pool top-ups and carry-over included. An em-dash means the path raised no further rounds."
            columns={['Scenario', 'Founding', 'After Seed', 'After Series A', 'After Series B', 'After Series C', 'You, final']}
            footnote={`Two patterns dominate. Money vs pools: on the standard path the ${usd(stdRow.raised, 0)} of capital alone takes founders from 100% to ${pct(noPoolFinal, 1)} (${pts(100 - noPoolFinal, 2)}), and the pools negotiated along the way take another ${pts(poolCostOfPath, 2)}. Attribution honesty: the friendly path ends ${pts(friendlyGap, 2)} above standard, but it also raises ${usd(stdRow.raised - friendlyRow.raised, 0)} less at higher Series B/C valuations — that lighter, pricier path accounts for roughly ${pts(gapFromMoneyAndPricing, 1)} of the gap, its leaner pools only about ${pts(gapFromPools, 1)}. Pool discipline in isolation is worth about ${pts(poolCostOfPath, 1)} on the standard path — that is the sensitivity table's job, not the presets'.`}
          >
            <tbody className="divide-y divide-slate-100 dark:divide-white/[0.06]">
              {PRESET_ROWS.map((row) => (
                <tr key={row.label}>
                  <th scope="row" className="readout font-semibold normal-case tracking-normal text-slate-900 dark:text-slate-100">
                    {row.label}
                    <span className="mt-0.5 block font-sans text-[11px] font-normal text-slate-500 dark:text-slate-400">
                      {usdCompact(row.raised)} raised
                    </span>
                  </th>
                  <td className="readout text-right text-slate-600 dark:text-slate-300">100.0%</td>
                  {row.stages.map((v, i) => (
                    <td key={i} className="text-right">
                      {v === null ? (
                        <span className="text-slate-500 dark:text-slate-400">—</span>
                      ) : (
                        <span className="readout font-medium text-slate-700 dark:text-slate-200">
                          {pct(v, 1)}
                        </span>
                      )}
                    </td>
                  ))}
                  <td className="text-right">
                    <span className="readout inline-block whitespace-nowrap rounded-full bg-indigo-50 px-2 py-0.5 font-semibold text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300">
                      {pct(row.youFinal, 1)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </ScenarioPanel>

          <div className="mt-6">
            <ComparisonChart
              series={CHART_SERIES}
              xLabel="Cumulative capital raised (standard path)"
              yLabel="Founder slot 1 ownership"
              xFormat={(n) => usdCompact(n)}
              yFormat={(n) => `${Math.round(n)}%`}
              height={300}
              caption={`Same four rounds (${usdCompact(STD.rounds.reduce((a, r) => a + r.investment, 0))} total), three pool disciplines. The vertical gap between the green and purple lines is what option pools cost the founder slot across the whole path — about ${poolCostOfYou.toFixed(2)} percentage points for this cap table (${poolCostOfPath.toFixed(2)} across all founders). Every point on every line is the full simulation recomputed, not an interpolation.`}
            />
          </div>
        </SectionShell>

        {/* Deep-dive guide */}
        <div className="border-t border-slate-200 pt-12 dark:border-white/[0.07]">
          <section id="guide" aria-label="Cap table and dilution guide" className="scroll-mt-28">
            <CapTableArticle />
          </section>
        </div>

        {/* Rendered only once the integration pass registers this slug in
            lib/site.ts — before that the shared chain would show a five-tool
            workflow this page is missing from (see REGISTERED above). */}
        {REGISTERED && <WorkflowChain currentSlug={calc.slug} />}

        <ProvenanceFooter
          sources={[
            {
              label: 'Round mechanics',
              detail:
                'NVCA-style priced-round arithmetic. A post-money input with a pool target is algebraically identical to a fixed pre-money with the pool created before pricing — the guide works the equivalence on a $2M/$10M example ($0.70 vs $0.80 per share).',
            },
            {
              label: 'Option pool convention',
              detail:
                'Pool targets are expressed on post-round fully diluted shares (the term-sheet standard), with top-up-to-target semantics: existing unallocated shares count toward the target, so rounds add pool shares only below it.',
            },
            {
              label: 'Out of scope',
              detail:
                'SAFEs and convertible notes, liquidation preferences and participation, anti-dilution ratchets, vesting and 83(b), secondary sales, and all tax treatment (QSBS, ISO/NSO). Exit values are stake × valuation ceilings.',
            },
          ]}
          disclaimer="This is an illustrative model of priced-round dilution, not legal, tax, or investment advice. Ownership percentage is not proceeds once preferences exist, and real cap tables carry instruments this model intentionally omits. Work term sheets with qualified counsel."
        />
      </CalculatorPageShell>
    </>
  );
}

import type { ReactNode } from 'react';
import Faq from '@/components/Faq';
import { ArticleToc, RelatedCalculators } from '@/components/Article';
import {
  CAP_TABLE_PRESETS,
  DEFAULT_EXIT_VALUATION,
  MAX_ROUNDS,
  ROUND_NAMES,
  classifyRound,
  founderPct,
  foundersPct,
  finalStage,
  postMoneyPoolRound,
  simulateCapTable,
  stakePct,
} from '@/lib/captable';
import { numFmt, pct, usd, usdCompact } from '@/lib/format';

/** Ownership deltas are percentage POINTS, never "%": 0.82pp ≠ 0.82%. */
const pts = (v: number, d = 2) => `${v.toFixed(d)} points`;

/* All prose numbers below are computed at build time by the same library that
   powers the widget — nothing is hand-typed, so the guide can never drift from
   the calculator. */

// The canonical option-pool-shuffle example: 10M founder shares, $2M at $10M post.
const SHUFFLE = simulateCapTable(
  [{ name: 'Founders', shares: 10_000_000 }],
  [{ name: 'Seed', investment: 2_000_000, postMoney: 10_000_000, poolPct: 10 }],
);
const NO_POOL = simulateCapTable(
  [{ name: 'Founders', shares: 10_000_000 }],
  [{ name: 'Seed', investment: 2_000_000, postMoney: 10_000_000, poolPct: 0 }],
);
const shufStage = SHUFFLE.stages[1];
const noPoolStage = NO_POOL.stages[1];
const shuf = shufStage.round!;
const noPool = noPoolStage.round!;
const shufPoolShares = shufStage.stakes.find((s) => s.kind === 'pool')?.shares ?? 0;
const shufFoundersPct = foundersPct(shufStage); // 70.0 — pool created in the pre-money
const noPoolFoundersPct = foundersPct(noPoolStage); // 80.0 — no pool at all
// The pro-founder variant: the round closes first, then the pool is carved out
// of the CLOSED table so every holder (investor included) dilutes pro-rata.
const POST_POOL = postMoneyPoolRound(10_000_000, 2_000_000, 10_000_000, 10)!;
const postPoolFoundersPct = POST_POOL.foundersPct; // 72.0
const postPoolInvestorPct = POST_POOL.investorPct; // 18.0
const postPoolShares = POST_POOL.sharesFinal; // 13,888,888.89
// Two different gaps that lazy writing conflates:
const preVsPostGap = postPoolFoundersPct - shufFoundersPct; // 2.0 pts: moving the SAME pool across the price
const noPoolGap = noPoolFoundersPct - shufFoundersPct; // 10.0 pts: having the pool at all vs none

// The default path (the tool's first preset), with and without its pools.
const STANDARD_FOUNDERS = [
  { name: 'You', shares: CAP_TABLE_PRESETS[0].founders[0].shares },
  { name: 'Cofounder', shares: CAP_TABLE_PRESETS[0].founders[1].shares },
];
const STANDARD_ROUNDS = CAP_TABLE_PRESETS[0].rounds.map((r, i) => ({
  name: ROUND_NAMES[i],
  ...r,
}));
const STANDARD = simulateCapTable(STANDARD_FOUNDERS, STANDARD_ROUNDS);
const STANDARD_NO_POOL = simulateCapTable(
  STANDARD_FOUNDERS,
  STANDARD_ROUNDS.map((r) => ({ ...r, poolPct: 0 })),
);
const stdFinal = finalStage(STANDARD)!;
const stdNoPoolFinal = finalStage(STANDARD_NO_POOL)!;
const stdYou = founderPct(stdFinal, 0);
const stdFounders = foundersPct(stdFinal);
const stdNoPoolFounders = foundersPct(stdNoPoolFinal);
const stdRoundsOnlyCost = 100 - stdNoPoolFounders; // dilution from money alone
const stdPoolCost = stdNoPoolFounders - stdFounders; // extra dilution from pools
const stdRaised = STANDARD_ROUNDS.reduce((a, r) => a + r.investment, 0);
const modeledCount = STANDARD_ROUNDS.filter((r) => r.investment > 0).length;

// Pool percentage AROUND Series B (no top-up happens there — target is 8%):
// entering the round (after Series A) vs after its new money diluted it.
const stdAfterA = STANDARD.stages[2];
const stdPoolPctEnteringB = stakePct(
  stdAfterA.stakes.find((s) => s.kind === 'pool')?.shares ?? 0,
  stdAfterA.shares,
); // 12.0
const stdAfterB = STANDARD.stages[3];
const stdPoolPctAfterB = stakePct(
  stdAfterB.stakes.find((s) => s.kind === 'pool')?.shares ?? 0,
  stdAfterB.shares,
); // 10.0
const stdPoolTargetB = STANDARD_ROUNDS[2].poolPct; // 8

// Isolated valuation-vs-pool pair for negotiation point 4: same company, same
// $10M raised — X prices BOTH rounds strictly higher but demands 30% pools;
// Y prices lower with lean 5% pools. Engine-verified: founders 35.71% vs 44.05%.
const VAL_X = simulateCapTable(STANDARD_FOUNDERS, [
  { name: 'Seed', investment: 2_000_000, postMoney: 10_000_000, poolPct: 30 },
  { name: 'Series A', investment: 8_000_000, postMoney: 40_000_000, poolPct: 30 },
]);
const VAL_Y = simulateCapTable(STANDARD_FOUNDERS, [
  { name: 'Seed', investment: 2_000_000, postMoney: 7_000_000, poolPct: 5 },
  { name: 'Series A', investment: 8_000_000, postMoney: 25_000_000, poolPct: 5 },
]);
const valXFounders = foundersPct(finalStage(VAL_X)!); // 35.71
const valYFounders = foundersPct(finalStage(VAL_Y)!); // 44.05

// Neighbour presets for context in prose.
const HEAVY = simulateCapTable(
  STANDARD_FOUNDERS,
  CAP_TABLE_PRESETS[2].rounds.map((r, i) => ({ name: ROUND_NAMES[i], ...r })),
);
const heavyYou = founderPct(finalStage(HEAVY)!, 0);
const heavyFounders = foundersPct(finalStage(HEAVY)!);
const FRIENDLY = simulateCapTable(
  STANDARD_FOUNDERS,
  CAP_TABLE_PRESETS[1].rounds.map((r, i) => ({ name: ROUND_NAMES[i], ...r })),
);
const friendlyFounders = foundersPct(finalStage(FRIENDLY)!);

// Pool knob sensitivity: cost of +2 points on every round for the "you" slot.
const STD_PLUS_2 = simulateCapTable(
  STANDARD_FOUNDERS,
  STANDARD_ROUNDS.map((r) => ({ ...r, poolPct: r.poolPct + 2 })),
);
const poolCostPerTwo = stdYou - founderPct(finalStage(STD_PLUS_2)!, 0);

/* ------------------------------------------------------------------ */
/* Worked examples, FAQ support numbers, decision-boundary scans.      */
/* Everything below is computed by the same engine the widget runs —  */
/* the prose never hand-types a value.                                 */
/* ------------------------------------------------------------------ */

// Worked example 1 — the "single seed round" preset: You 6M + Cofounder 4M
// shares, $1.5M at $8M post, 12% pool target, plus its no-pool counterfactual.
const WE1 = simulateCapTable(STANDARD_FOUNDERS, [
  { name: 'Seed', investment: 1_500_000, postMoney: 8_000_000, poolPct: 12 },
]);
const WE1_NO_POOL = simulateCapTable(STANDARD_FOUNDERS, [
  { name: 'Seed', investment: 1_500_000, postMoney: 8_000_000, poolPct: 0 },
]);
const we1Stage = WE1.stages[1];
const we1Round = we1Stage.round!;
const we1PoolShares = we1Stage.stakes.find((s) => s.kind === 'pool')?.shares ?? 0;
const we1Founders = foundersPct(we1Stage); // 69.25 = 100 − 18.75 − 12
const we1You = founderPct(we1Stage, 0);
const we1Cofounder = founderPct(we1Stage, 1);
const we1Denom = 1 - we1Round.investorPct - 0.12; // 0.6925
const we1NonPoolBefore = STANDARD_FOUNDERS[0].shares + STANDARD_FOUNDERS[1].shares;
const we1Pre = we1Round.preMoney;
const we1YouExit = (we1You / 100) * DEFAULT_EXIT_VALUATION;
const we1NoPoolFounders = foundersPct(WE1_NO_POOL.stages[1]); // 81.25

// Worked example 2 — the same seed, then $6M at $30M post under two pool
// targets: 8% (lean) versus 12% (fat). Isolates the top-up mechanic.
const WE2_SEED = { name: 'Seed', investment: 1_500_000, postMoney: 8_000_000, poolPct: 12 };
const WE2_LEAN = simulateCapTable(STANDARD_FOUNDERS, [
  WE2_SEED,
  { name: 'Series A', investment: 6_000_000, postMoney: 30_000_000, poolPct: 8 },
]);
const WE2_FAT = simulateCapTable(STANDARD_FOUNDERS, [
  WE2_SEED,
  { name: 'Series A', investment: 6_000_000, postMoney: 30_000_000, poolPct: 12 },
]);
const we2SeedStage = WE2_LEAN.stages[1];
const we2LeanStage = WE2_LEAN.stages[2];
const we2FatStage = WE2_FAT.stages[2];
const we2LeanRound = we2LeanStage.round!;
const we2FatRound = we2FatStage.round!;
const poolSharesOf = (stage: typeof we2LeanStage) =>
  stage.stakes.find((s) => s.kind === 'pool')?.shares ?? 0;
const we2PoolEnteringA = stakePct(poolSharesOf(we2SeedStage), we2SeedStage.shares); // 12.0
const we2LeanPoolAfter = stakePct(poolSharesOf(we2LeanStage), we2LeanStage.shares); // 9.6
const we2FatPoolAfter = stakePct(poolSharesOf(we2FatStage), we2FatStage.shares); // 12.0
const we2LeanFounders = foundersPct(we2LeanStage); // 55.40
const we2FatFounders = foundersPct(we2FatStage); // 53.51
const we2Gap = we2LeanFounders - we2FatFounders; // 1.89 points
const we2NonPoolEnteringA = we2SeedStage.shares - poolSharesOf(we2SeedStage);

// FAQ support numbers.
const shufRelativeDrop = ((noPoolFoundersPct - shufFoundersPct) / noPoolFoundersPct) * 100; // 12.5
const youBlockShareFounding =
  (founderPct(STANDARD.stages[0], 0) / foundersPct(STANDARD.stages[0])) * 100; // 60.0
const youBlockShareFinal = (founderPct(stdFinal, 0) / foundersPct(stdFinal)) * 100; // 60.0
const FLAT = simulateCapTable([{ name: 'Founders', shares: 10_000_000 }], [
  { name: 'Series B', investment: 5_000_000, postMoney: 30_000_000, poolPct: 0 },
]);
const flatFPct = FLAT.stages[1].round!.investorPct * 100; // 16.67
const flatFounders = foundersPct(FLAT.stages[1]); // 83.33
const POOL20 = simulateCapTable([{ name: 'Founders', shares: 10_000_000 }], [
  { name: 'Seed', investment: 2_000_000, postMoney: 10_000_000, poolPct: 20 },
]);
const pool20Founders = foundersPct(POOL20.stages[1]); // 60.0
const DOWN = simulateCapTable([{ name: 'Founders', shares: 10_000_000 }], [
  { name: 'Series B', investment: 3_000_000, postMoney: 15_000_000, poolPct: 10 },
]);
const downFounders = foundersPct(DOWN.stages[1]); // 70.0
const INVALID_MONEY = classifyRound({
  name: 'X',
  investment: 10_000_000,
  postMoney: 10_000_000,
  poolPct: 10,
});
const INVALID_STACK = classifyRound({
  name: 'X',
  investment: 2_000_000,
  postMoney: 2_400_000,
  poolPct: 25,
});
const invalidStackF = (2_000_000 / 2_400_000) * 100; // 83.33
const HALTED = simulateCapTable(
  STANDARD_FOUNDERS,
  STANDARD_ROUNDS.map((r, i) => (i === 1 ? { ...r, investment: 0 } : r)),
);
const stdYouExitCeiling = (stdYou / 100) * DEFAULT_EXIT_VALUATION;
const presetSeedPools = CAP_TABLE_PRESETS.map((p) => p.rounds[0].poolPct);
const presetSeedPoolMin = Math.min(...presetSeedPools); // 8
const presetSeedPoolMax = Math.max(...presetSeedPools); // 15

// Decision-boundary scan 1 — the largest pool target a round can carry before
// investor stake + pool claim the whole post-round table. Grid: 100 → 0 in
// half-point steps; first 'modeled' classification wins.
function largestModeledPool(investment: number, postMoney: number): number {
  for (let p = 100; p >= 0; p -= 0.5) {
    if (classifyRound({ name: 'R', investment, postMoney, poolPct: p }).state === 'modeled')
      return p;
  }
  return 0;
}
const scanF20 = shuf.investorPct * 100; // 20 — the canonical round
const scanF25 = (STANDARD_ROUNDS[0].investment / STANDARD_ROUNDS[0].postMoney) * 100; // 25
const scanF60 = (6_000_000 / 10_000_000) * 100; // 60
const ceilAt20 = largestModeledPool(2_000_000, 10_000_000); // 79.5 — 80.0 cannot close
const ceilAt25 = largestModeledPool(1_500_000, 6_000_000); // 74.5
const ceilAt60 = largestModeledPool(6_000_000, 10_000_000); // 39.5

// Decision-boundary scan 2 — where each preset path crosses the 50% majority
// line (founders' combined ownership evaluated at every stage).
const stdMajorityTrail = STANDARD.stages.map((s) => foundersPct(s));
const friendlyMajorityTrail = FRIENDLY.stages.map((s) => foundersPct(s));
const heavyMajorityTrail = HEAVY.stages.map((s) => foundersPct(s));
const stdMajorityLostAt = STANDARD.stages.find((s) => foundersPct(s) <= 50)?.label ?? null;
const stdPctAtMajorityLoss = foundersPct(STANDARD.stages[2]); // 49.11 at Series A
const heavySeedPct = foundersPct(HEAVY.stages[1]); // 51.67 — the last stop above water

// Decision-boundary scan 2b — with the seed pool fixed at 10%, the largest
// Series A target (half-point grid, 0–20) that keeps founders above 50% at the
// Series A close.
function foundersAfterSeriesA(poolPct: number): number {
  const sim = simulateCapTable(STANDARD_FOUNDERS, [
    { name: 'Seed', investment: 1_500_000, postMoney: 6_000_000, poolPct: 10 },
    { name: 'Series A', investment: 6_000_000, postMoney: 30_000_000, poolPct },
  ]);
  return foundersPct(sim.stages[2]);
}
let aPoolThreshold = 0;
for (let p = 0; p <= 20; p += 0.5) if (foundersAfterSeriesA(p) > 50) aPoolThreshold = p;
const aPoolThresholdKeep = foundersAfterSeriesA(aPoolThreshold); // 50.19
const aPoolThresholdLose = foundersAfterSeriesA(aPoolThreshold + 0.5); // 49.83

// Decision-boundary scan 3 — the Series A post-money that offsets +5 points of
// Series A pool target on the standard path. Bisection over
// [postMoney, 2 × postMoney], 60 halvings; monotonicity verified on a $5M grid.
const SCAN3_STEP = 5;
function finalFoundersWithSeriesA(poolPct: number, postMoney: number): number {
  const sim = simulateCapTable(
    STANDARD_FOUNDERS,
    STANDARD_ROUNDS.map((r, i) => (i === 1 ? { ...r, poolPct, postMoney } : r)),
  );
  return foundersPct(finalStage(sim)!);
}
const scan3Pool = STANDARD_ROUNDS[1].poolPct + SCAN3_STEP; // 17
const scan3FatFinal = finalFoundersWithSeriesA(scan3Pool, STANDARD_ROUNDS[1].postMoney);
const scan3Cost = stdFounders - scan3FatFinal; // 2.65 points
let scan3MonoViolations = 0;
for (
  let post = STANDARD_ROUNDS[1].postMoney;
  post < 2 * STANDARD_ROUNDS[1].postMoney;
  post += 5_000_000
) {
  if (
    finalFoundersWithSeriesA(scan3Pool, post + 5_000_000) <=
    finalFoundersWithSeriesA(scan3Pool, post)
  )
    scan3MonoViolations++;
}
let scan3Lo = STANDARD_ROUNDS[1].postMoney;
let scan3Hi = 2 * scan3Lo;
while (finalFoundersWithSeriesA(scan3Pool, scan3Hi) <= stdFounders) scan3Hi *= 2;
for (let i = 0; i < 60; i++) {
  const mid = (scan3Lo + scan3Hi) / 2;
  if (finalFoundersWithSeriesA(scan3Pool, mid) < stdFounders) scan3Lo = mid;
  else scan3Hi = mid;
}
const scan3OffsetPost = (scan3Lo + scan3Hi) / 2; // $40.0M
const scan3Markup = scan3OffsetPost / STANDARD_ROUNDS[1].postMoney - 1; // 33.3%
const scan3Residual = Math.abs(
  finalFoundersWithSeriesA(scan3Pool, scan3OffsetPost) - stdFounders,
); // ~7e-15 points

// Glossary — first-pass definitions; every figure comes from the consts above.
const GLOSSARY: [string, ReactNode][] = [
  [
    'Cap table',
    <>The ledger of who owns the company&rsquo;s shares — founders, employee options, investors — and in what amounts. Everything this tool does is arithmetic on that ledger, one row at a time.</>,
  ],
  [
    'Fully diluted shares',
    <>
      Every share that exists if all outstanding instruments convert: founder stock, granted options, the unallocated pool, investor shares. Example 1&rsquo;s seed round closes at{' '}
      {numFmt(Math.round(we1Stage.shares))} of them.
    </>,
  ],
  [
    'Priced round',
    <>A financing where new shares are sold at an explicit valuation — unlike a SAFE, which defers pricing to the next round. This model handles priced rounds only.</>,
  ],
  [
    'Pre-money valuation',
    <>
      What the company is agreed to be worth before the new money lands: post-money minus the investment ({usd(shuf.preMoney, 0)} in the canonical deal). The option pool is created inside it — that is the shuffle.
    </>,
  ],
  [
    'Post-money valuation',
    <>
      Pre-money plus investment ({usd(shuf.postMoney, 0)} canonical). The investor&rsquo;s stake is investment ÷ post-money — {pct(shuf.investorPct * 100, 0)} here — fixed by the money itself.
    </>,
  ],
  [
    'Dilution',
    <>
      Your ownership falling because the share denominator grew — not because anyone took shares from you. Mind the units: dropping from {pct(noPoolFoundersPct, 0)} to {pct(shufFoundersPct, 0)} is 10 <em>points</em>, which is {pct(shufRelativeDrop, 1)} of what you held.
    </>,
  ],
  [
    'Option pool (ESOP)',
    <>
      Shares reserved for future employee equity, authorized before they are granted. Modeled here as unallocated reserve — Example 1&rsquo;s pool is {pct(12, 0)} of the post-round table.
    </>,
  ],
  [
    'Option pool shuffle',
    <>
      Creating the pool inside the pre-money so the incoming price is struck over existing shares <em>plus</em> the pool. The investor&rsquo;s stake is untouched; existing holders pay — {pct(noPoolFoundersPct, 0)} → {pct(shufFoundersPct, 0)} in the canonical deal.
    </>,
  ],
  [
    'Pool top-up',
    <>
      Shares added to the pool at a round to restore it to target. Only the shortfall is topped up: Example 2&rsquo;s fat Series A adds {numFmt(Math.round(we2FatRound.poolTopUp))} shares because the carried pool had fallen below {pct(12, 0)}.
    </>,
  ],
  [
    'Pro-rata rights',
    <>An investor&rsquo;s right to buy into the next round to maintain their percentage. Outside this model, but it is how seed funds stay whole through later dilution.</>,
  ],
  [
    'Liquidation preference',
    <>Money senior to common stock at exit — typically a multiple of the investment, paid before founders see anything. The reason &ldquo;stake × exit valuation&rdquo; is a ceiling, not a quote.</>,
  ],
  [
    'SAFE',
    <>Simple Agreement for Future Equity: money now, shares later, priced at the next priced round. Not modeled here — approximate a SAFE stack as a pseudo-round and treat the result as a bracket.</>,
  ],
];

export default function CapTableArticle() {
  const toc = [
    { id: 'mechanics', label: 'How dilution actually works' },
    { id: 'pool-shuffle', label: 'The option pool shuffle' },
    { id: 'pre-vs-post', label: 'Pre-money vs post-money' },
    { id: 'worked', label: 'Worked examples' },
    { id: 'negotiation', label: 'Term-sheet negotiation points' },
    { id: 'limits', label: 'What this model leaves out' },
    { id: 'boundaries', label: 'Decision boundaries' },
    { id: 'caveats', label: 'Important caveats' },
    { id: 'glossary', label: 'Glossary' },
    { id: 'faq', label: 'FAQ' },
  ];

  return (
    <article className="prose-article">
      <ArticleToc items={toc} />

      <h2 id="mechanics">How dilution actually works</h2>
      <p>
        Dilution is not a tax someone takes from you — it is a denominator growing. When an investor
        puts <strong>{usdCompact(shuf.investment)}</strong> into a company valued at{' '}
        <strong>{usdCompact(shuf.postMoney)} post-money</strong>, they own{' '}
        <code>{usdCompact(shuf.investment)} ÷ {usdCompact(shuf.postMoney)}</code> ={' '}
        <strong>{pct(shuf.investorPct * 100, 0)}</strong> of the company the moment the round
        closes. Nobody touched your shares; the company simply issued enough new shares that the
        investor&apos;s block lands at that fraction. Your percentage is your share count divided by
        a bigger total.
      </p>
      <p>
        That single mechanism compounds. Run the default scenario in the calculator —{' '}
        {numFmt(STANDARD_FOUNDERS[0].shares + STANDARD_FOUNDERS[1].shares)} founder shares through{' '}
        {modeledCount} rounds raising {usd(stdRaised, 0)} — and the money alone takes founders from
        100% to <strong>{pct(stdNoPoolFounders, 1)}</strong>, a{' '}
        {pts(100 - stdNoPoolFounders, 2)} haircut. The option pools negotiated along the
        way take another <strong>{pts(stdPoolCost, 2)}</strong>, leaving all founders at{' '}
        <strong>{pct(stdFounders, 1)}</strong> and slot one (&ldquo;you&rdquo;) at{' '}
        <strong>{pct(stdYou, 1)}</strong>. The pool slice is the part founders routinely
        underestimate — and the most negotiable. That is the next section.
      </p>

      <h2 id="pool-shuffle">The option pool shuffle, exactly</h2>
      <p>
        Investors want an option pool created <strong>before</strong> their money prices the round.
        The pool is real — employees must be hired with equity — but its placement decides who pays
        for it. Here is the canonical case, computed by this page&apos;s own engine: founders hold{' '}
        {numFmt(10_000_000)} shares. An investor puts in {usd(shuf.investment, 0)} at a{' '}
        {usd(shuf.postMoney, 0)} post-money, and requires a 10% option pool.
      </p>
      <table>
        <thead>
          <tr>
            <th>Line</th>
            <th>No pool</th>
            <th>10% pool (in pre-money)</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Post-round fully diluted shares</td>
            <td>{numFmt(Math.round(noPoolStage.shares))}</td>
            <td>{numFmt(Math.round(shufStage.shares))}</td>
          </tr>
          <tr>
            <td>Price per share</td>
            <td>{usd(noPool.pricePerShare, 2)}</td>
            <td>{usd(shuf.pricePerShare, 2)}</td>
          </tr>
          <tr>
            <td>New investor shares</td>
            <td>{numFmt(Math.round(noPool.investorShares))}</td>
            <td>{numFmt(Math.round(shuf.investorShares))}</td>
          </tr>
          <tr>
            <td>New unallocated pool shares</td>
            <td>—</td>
            <td>{numFmt(Math.round(shufPoolShares))}</td>
          </tr>
          <tr>
            <td><strong>Founders own</strong></td>
            <td><strong>{pct(noPoolFoundersPct, 0)}</strong></td>
            <td><strong>{pct(shufFoundersPct, 0)}</strong></td>
          </tr>
          <tr>
            <td>Investor owns</td>
            <td>{pct(noPool.investorPct * 100, 0)}</td>
            <td>{pct(shuf.investorPct * 100, 0)}</td>
          </tr>
        </tbody>
      </table>
      <p>
        Read the last two rows together: the investor gets{' '}
        {pct(shuf.investorPct * 100, 0)} either way, but founders drop from{' '}
        {pct(noPoolFoundersPct, 0)} to {pct(shufFoundersPct, 0)} when the pool is created. The
        entire {pct(stakePct(shufPoolShares, shufStage.shares), 0)} pool came out of the{' '}
        <em>existing</em> holders, none out of the investor. That asymmetry is the
        &ldquo;option pool shuffle.&rdquo; It is not hidden — the price per share simply falls from{' '}
        {usd(noPool.pricePerShare, 2)} to {usd(shuf.pricePerShare, 2)} because the{' '}
        {usd(shuf.preMoney, 0)} pre-money is now spread over existing shares <em>plus</em> the new
        pool.
      </p>
      <p>
        The calculator models the standard convention and labels it honestly: the pool target is a{' '}
        <strong>percentage of the post-round cap table</strong>, created inside the pre-money, and
        existing unallocated shares count toward the target — so a round only adds pool shares when
        the old pool has diluted below it (a board-style &ldquo;top-up&rdquo;). In the default
        scenario, Series B&apos;s {pct(stdPoolTargetB, 0)} target adds <em>zero</em> shares: the
        pool carried over from earlier rounds entered that round at{' '}
        {pct(stdPoolPctEnteringB, 1)}, and even after Series B&apos;s new money diluted it to{' '}
        {pct(stdPoolPctAfterB, 1)} it was still above target — the price ladder marks the round
        &ldquo;pool {pct(stdPoolPctAfterB, 1)} ≥ {pct(stdPoolTargetB, 1)} target — no
        top-up&rdquo; instead of silently re-diluting you.
      </p>

      <h2 id="pre-vs-post">Pre-money vs post-money — and which pool basis</h2>
      <p>
        Two numbers define a round: pre-money + investment = post-money. &ldquo;$2M at $8M pre&rdquo;
        and &ldquo;$2M at $10M post&rdquo; are the same deal <em>without</em> a pool. With one, the
        phrasing splits into two genuinely different deals:
      </p>
      <ul>
        <li>
          <strong>Pool of pre-money</strong> (the convention this tool models, and the US market
          default): the pool is created first, then the price is struck over existing shares plus
          the pool. The {usd(shuf.preMoney, 0)} pre / {usd(shuf.postMoney, 0)} post deal above with
          a 10% pool prices at {usd(shuf.pricePerShare, 2)} per share. Founders pay for the pool:
          they keep {pct(shufFoundersPct, 1)}, the investor {pct(shuf.investorPct * 100, 1)}.
        </li>
        <li>
          <strong>Pool of post-money</strong> (the pro-founder variant): the round closes first at
          the same {usd(noPool.pricePerShare, 2)} per share — {pct(noPoolFoundersPct, 1)} founders,{' '}
          {pct(noPool.investorPct * 100, 1)} investor — and only then is the pool carved out of the
          closed table, so every holder <em>including the new investor</em> dilutes by the same
          pro-rata 10%: founders {pct(postPoolFoundersPct, 1)}, investor{' '}
          {pct(postPoolInvestorPct, 1)}, pool 10.0% of {numFmt(Math.round(postPoolShares))} fully
          diluted shares.
        </li>
      </ul>
      <p>
        Same term sheet, same headline valuation — and two different gaps lazy writing loves to
        conflate. The moving-pool gap is not an accident of these numbers: it is exactly{' '}
        <code>f × pool</code> — {pct(shuf.investorPct * 100, 0)} × {pct(10, 0)} ={' '}
        {pts(preVsPostGap, 1)}. Moving the <em>same</em> pool across the price is worth{' '}
        <strong>{pts(preVsPostGap, 1)}</strong> of founder ownership here ({pct(shufFoundersPct, 1)}{' '}
        → {pct(postPoolFoundersPct, 1)}). Eliminating the pool entirely is worth{' '}
        <strong>{pts(noPoolGap - preVsPostGap, 1)}</strong> more on top of that ({pct(postPoolFoundersPct, 1)}{' '}
        → {pct(noPoolFoundersPct, 1)}) — but &ldquo;no option pool&rdquo; is not a real term sheet;
        it is the ceiling for what pool-size negotiations can recover. When you negotiate
        &ldquo;the pool,&rdquo; you are really negotiating (a) its size, (b) which side of the price
        it sits on, and (c) what it is justified against.
      </p>

      <h2 id="worked">Worked examples, line by line</h2>
      <p>
        The table above is one slice of one round. These two examples walk complete inputs
        through the engine without collapsing a step — the same arithmetic the calculator
        performs, at a pace you can check by hand. Both start from the standard founding
        pair: {numFmt(STANDARD_FOUNDERS[0].shares)} shares to &ldquo;you&rdquo; and{' '}
        {numFmt(STANDARD_FOUNDERS[1].shares)} to a cofounder — {numFmt(we1NonPoolBefore)}{' '}
        fully diluted shares at incorporation.
      </p>

      <h3>Example 1 — one seed round, derived in full</h3>
      <p>
        <strong>Inputs.</strong> {numFmt(we1NonPoolBefore)} founder shares; one round of{' '}
        {usd(we1Round.investment, 0)} at a {usd(we1Round.postMoney, 0)} post-money with a{' '}
        {pct(12, 0)} option pool target. (This is the calculator&rsquo;s &ldquo;Single seed
        round&rdquo; preset, unchanged.)
      </p>
      <ol>
        <li>
          <strong>Fix the investor&rsquo;s fraction.</strong>{' '}
          <code>{usdCompact(we1Round.investment)} ÷ {usdCompact(we1Round.postMoney)}</code> ={' '}
          <strong>{pct(we1Round.investorPct * 100, 2)}</strong>. Whatever else the round
          does, the investor owns that share of the post-round table.
        </li>
        <li>
          <strong>Reserve the pool.</strong> The {pct(12, 0)} target also comes out of the
          post-round table, so everything that exists today must fit into{' '}
          <code>1 − {pct(we1Round.investorPct * 100, 2)} − {pct(12, 0)}</code> ={' '}
          <strong>{pct(we1Denom * 100, 2)}</strong> of it.
        </li>
        <li>
          <strong>Solve for the new total.</strong>{' '}
          <code>{numFmt(we1NonPoolBefore)} ÷ {we1Denom.toFixed(4)}</code> ={' '}
          <strong>{numFmt(Math.round(we1Round.sharesAfter))} fully diluted shares</strong>{' '}
          after the round. No pool exists yet, so all {numFmt(we1NonPoolBefore)} founding
          shares count as existing capitalization.
        </li>
        <li>
          <strong>Allocate it.</strong> The pool takes {pct(12, 0)} of the new total —{' '}
          {numFmt(Math.round(we1PoolShares))} shares — and the investor{' '}
          {pct(we1Round.investorPct * 100, 2)} of it —{' '}
          {numFmt(Math.round(we1Round.investorShares))} shares.
        </li>
        <li>
          <strong>Strike the price.</strong> Pre-money over existing shares plus the
          top-up:{' '}
          <code>
            {usd(we1Pre, 0)} ÷ {numFmt(Math.round(we1NonPoolBefore + we1PoolShares))}
          </code>{' '}
          = <strong>{usd(we1Round.pricePerShare, 3)}</strong> per share. The pool sitting
          in the denominator <em>is</em> the shuffle, numerically.
        </li>
      </ol>
      <table>
        <thead>
          <tr>
            <th scope="col">Shareholder</th>
            <th scope="col" className="text-right">
              Shares
            </th>
            <th scope="col" className="text-right">
              Ownership
            </th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>You</td>
            <td className="text-right">{numFmt(STANDARD_FOUNDERS[0].shares)}</td>
            <td className="text-right">{pct(we1You, 2)}</td>
          </tr>
          <tr>
            <td>Cofounder</td>
            <td className="text-right">{numFmt(STANDARD_FOUNDERS[1].shares)}</td>
            <td className="text-right">{pct(we1Cofounder, 2)}</td>
          </tr>
          <tr>
            <td>Employees &amp; option pool</td>
            <td className="text-right">{numFmt(Math.round(we1PoolShares))}</td>
            <td className="text-right">{pct(stakePct(we1PoolShares, we1Stage.shares), 2)}</td>
          </tr>
          <tr>
            <td>Seed investor</td>
            <td className="text-right">{numFmt(Math.round(we1Round.investorShares))}</td>
            <td className="text-right">{pct(we1Round.investorPct * 100, 2)}</td>
          </tr>
          <tr>
            <td>
              <strong>Fully diluted total</strong>
            </td>
            <td className="text-right">
              <strong>{numFmt(Math.round(we1Stage.shares))}</strong>
            </td>
            <td className="text-right">
              <strong>100%</strong>
            </td>
          </tr>
        </tbody>
      </table>
      <p>
        <strong>Conclusion.</strong> Founders keep <strong>{pct(we1Founders, 2)}</strong> —
        exactly the {pct(we1Denom * 100, 2)} solved for in step 2 — with &ldquo;you&rdquo;
        at {pct(we1You, 2)} and the cofounder at {pct(we1Cofounder, 2)}. At the default{' '}
        {usdCompact(DEFAULT_EXIT_VALUATION)} exit valuation that stake is worth about{' '}
        {usd(we1YouExit, 0)} to you — a ceiling, before preferences and taxes. Delete the
        pool (target 0%) and the identical round leaves founders at{' '}
        {pct(we1NoPoolFounders, 2)}: the entire {pct(12, 0)} came out of the
        founders&rsquo; side, none out of the investor&rsquo;s.
      </p>

      <h3>Example 2 — the same seed, two Series A pool targets</h3>
      <p>
        <strong>Inputs.</strong> Keep Example 1&rsquo;s seed exactly as it closed. Series A
        brings {usd(we2LeanRound.investment, 0)} at a {usd(we2LeanRound.postMoney, 0)}{' '}
        post-money — an investor fraction of {pct(we2LeanRound.investorPct * 100, 0)}. Two
        term sheets, identical except the pool target: <strong>{pct(8, 0)}</strong> (lean)
        versus <strong>{pct(12, 0)}</strong> (fat).
      </p>
      <ol>
        <li>
          <strong>Where the pool stands.</strong> The seed left it exactly on target:{' '}
          {pct(we2PoolEnteringA, 1)} — {numFmt(Math.round(poolSharesOf(we2SeedStage)))}{' '}
          unallocated shares out of {numFmt(Math.round(we2SeedStage.shares))} — all of
          which counts toward the next round&rsquo;s target.
        </li>
        <li>
          <strong>Lean target: no top-up.</strong> Series A&rsquo;s money alone grows the
          total to {numFmt(Math.round(we2LeanRound.sharesAfter))} and dilutes the pool to{' '}
          {pct(we2LeanPoolAfter, 1)} — still above the {pct(8, 0)} target, so the round
          adds zero pool shares and prices at {usd(we2LeanRound.pricePerShare, 3)}.
        </li>
        <li>
          <strong>Fat target: top-up.</strong> A {pct(12, 0)} target is not covered, so the
          round must mint shares until the pool is back on target:{' '}
          <code>
            {numFmt(Math.round(we2NonPoolEnteringA))} ÷ (1 −{' '}
            {pct(we2LeanRound.investorPct * 100, 0)} − {pct(12, 0)})
          </code>{' '}
          = <strong>{numFmt(Math.round(we2FatRound.sharesAfter))}</strong> fully diluted
          shares — {numFmt(Math.round(we2FatRound.poolTopUp))} of them new pool shares,{' '}
          {numFmt(Math.round(we2FatRound.investorShares))} to the investor.
        </li>
        <li>
          <strong>Price falls.</strong> The extra{' '}
          {numFmt(Math.round(we2FatRound.poolTopUp))} shares sit in the pre-money
          denominator, so the same {usd(we2LeanRound.investment, 0)} buys in at{' '}
          {usd(we2FatRound.pricePerShare, 3)} instead of {usd(we2LeanRound.pricePerShare, 3)}.
        </li>
      </ol>
      <table>
        <thead>
          <tr>
            <th scope="col">Series A outcome</th>
            <th scope="col" className="text-right">
              Lean — {pct(8, 0)} target
            </th>
            <th scope="col" className="text-right">
              Fat — {pct(12, 0)} target
            </th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Pool shares added</td>
            <td className="text-right">0 (target covered)</td>
            <td className="text-right">{numFmt(Math.round(we2FatRound.poolTopUp))}</td>
          </tr>
          <tr>
            <td>Fully diluted shares after</td>
            <td className="text-right">{numFmt(Math.round(we2LeanRound.sharesAfter))}</td>
            <td className="text-right">{numFmt(Math.round(we2FatRound.sharesAfter))}</td>
          </tr>
          <tr>
            <td>Pool after the round</td>
            <td className="text-right">{pct(we2LeanPoolAfter, 1)}</td>
            <td className="text-right">{pct(we2FatPoolAfter, 1)}</td>
          </tr>
          <tr>
            <td>Price per share</td>
            <td className="text-right">{usd(we2LeanRound.pricePerShare, 3)}</td>
            <td className="text-right">{usd(we2FatRound.pricePerShare, 3)}</td>
          </tr>
          <tr>
            <td>
              <strong>Founders after the round</strong>
            </td>
            <td className="text-right">
              <strong>{pct(we2LeanFounders, 2)}</strong>
            </td>
            <td className="text-right">
              <strong>{pct(we2FatFounders, 2)}</strong>
            </td>
          </tr>
        </tbody>
      </table>
      <p>
        <strong>Conclusion.</strong> Same money, same headline valuation, same investor
        stake — but the fat target costs founders <strong>{pts(we2Gap, 2)}</strong> because
        it forces {numFmt(Math.round(we2FatRound.poolTopUp))} new shares into the
        pre-money. The target, in other words, does not say &ldquo;the pool shall be this
        big&rdquo;; it says &ldquo;the carried pool may fall this far below target before
        the round re-ups it.&rdquo; That is why the identical {pct(12, 0)} target cost
        founders the full {pct(12, 0)} at the seed (nothing to carry over) and only{' '}
        {pts(we2Gap, 2)} here.
      </p>

      <h2 id="negotiation">Reading the term sheet: negotiation points</h2>
      <ol>
        <li>
          <strong>Ask for the pool&apos;s hiring plan.</strong> A pool should map to named roles and
          levels for the next 18–24 months. If the investor asks for 15% with no plan, run this tool
          with 15 versus what a real hiring plan supports — the sensitivity table converts an
          abstract debate into ownership points: on the default path, every +2 points of pool target
          costs the founder slot about <strong>{pts(poolCostPerTwo, 2)}</strong> of ownership.
        </li>
        <li>
          <strong>Push the pool into the post-money</strong> — or equivalently, negotiate the
          pre-money <em>including</em> the pool. The section above prices that move exactly;
          as a term-sheet line it is one sentence, and it is worth making even when the answer
          is no — the response tells you where the pool cost was always going to land.
        </li>
        <li>
          <strong>Size the pool to the round, not to the decade.</strong> A fresh top-up at every
          round sounds small (10%, then 12%…) but the default scenario&apos;s pools cost founders{' '}
          {pts(stdPoolCost, 2)} on top of the {pts(stdRoundsOnlyCost, 2)} the money itself took.
          Unallocated pool at close is your ownership parked in future hires — negotiate it down and
          re-up at the next round, when you have leverage again.
        </li>
        <li>
          <strong>Trade valuation for structure only with the cap table in hand.</strong> Same
          company, same {usd(10_000_000, 0)} raised, two term sheets: X prices both rounds strictly
          higher ({usdCompact(10_000_000)} and {usdCompact(40_000_000)} post) but demands 30% pools;
          Y prices lower ({usdCompact(7_000_000)} and {usdCompact(25_000_000)} post) with lean 5%
          pools. X&apos;s founders finish at <strong>{pct(valXFounders, 1)}</strong> against
          Y&apos;s <strong>{pct(valYFounders, 1)}</strong> — the fatter pools more than eat a
          strictly better valuation. (Whole-path presets change several variables at once; this
          pair isolates the trade. On the full paths, the same founders end at{' '}
          {pct(friendlyFounders, 1)} friendly, {pct(stdFounders, 1)} standard, and the founder slot
          at just {pct(heavyYou, 1)} ({pct(heavyFounders, 1)} all founders) under heavy dilution.)
        </li>
        <li>
          <strong>Pro-rata rights and secondaries</strong> are how founders and seed investors
          partially opt back in later. Out of scope for this model, but on the table in real
          negotiations.
        </li>
      </ol>

      <h2 id="limits">What this model deliberately leaves out</h2>
      <p>
        This instrument does priced-round arithmetic and nothing else. Conspicuously absent, on
        purpose:
      </p>
      <ul>
        <li>
          <strong>SAFEs and convertible notes.</strong> These convert <em>at</em> the next priced
          round and dilute it. A common approximation: treat the convertible stack as an extra
          &ldquo;round&rdquo; whose investment equals the money raised on SAFEs and whose post-money
          is your estimate of the round they land in. The tool gives you the machinery to model that
          by hand, but does not pretend to price a SAFE.
        </li>
        <li>
          <strong>Liquidation preferences, participation, and dividends.</strong> Ownership
          percentage is not proceeds. With a 1x non-participating preference, the &ldquo;worth{' '}
          ~{usd((stdYou / 100) * 100_000_000, 0)} at a $100M exit&rdquo; headline is a ceiling, not
          a quote. In a flat or down exit, preference stacks can take most of the value while
          leaving every percentage unchanged.
        </li>
        <li>
          <strong>Anti-dilution protection, board seats, and protective provisions.</strong> These
          change who <em>controls</em> dilution later, which often matters more than today&apos;s
          split — the tool flags where founders lose majority, and stops there.
        </li>
        <li>
          <strong>Grants against the pool, vesting, and 83(b).</strong> The pool is modeled as
          unallocated reserve; individual option grants (and their vesting cliffs) do not change
          anyone else&apos;s percentages, so the founder trajectory is unaffected — but your{' '}
          <em>personal</em> row should account for your own unvested shares.
        </li>
        <li>
          <strong>Dynamic ESOP re-pricing.</strong> Pools are set at each round, not continuously
          re-solved against a hiring model. That limitation is deliberate: the tool shows the
          arithmetic of what was negotiated, not a forecast of what hiring will consume.
        </li>
      </ul>

      <h2 id="boundaries">Decision boundaries</h2>
      <p>
        This instrument answers one question — <em>who owns what after a sequence of priced
        rounds</em> — and it is worth being precise about where that answer is trustworthy
        and where it is not an answer at all.
      </p>
      <h3>When this model applies</h3>
      <ul>
        <li>
          <strong>Before signing a priced term sheet.</strong> Translating valuation, new
          money, and pool target into the only currency that matters at close: post-round
          ownership. Example 1 is the five-minute version of that check.
        </li>
        <li>
          <strong>Negotiating an option pool.</strong> Size, placement (which side of the
          price it sits on), and what each point costs — the three scans below put numbers
          on all of it.
        </li>
        <li>
          <strong>Budgeting dilution across a raise path.</strong> Majority planning, pool
          re-up timing, valuation-versus-structure trades — run before there is a lead
          investor across the table.
        </li>
        <li>
          <strong>Bracketing a convertible stack.</strong> Model the SAFE dollars as a
          pseudo-round at the post-money you expect them to convert into; a rough bracket
          by design, since caps and discounts move the real number.
        </li>
      </ul>
      <h3>When to use something else</h3>
      <p>
        Exit waterfalls and control questions — preferences, participation, board seats,
        protective provisions — are catalogued in <em>What this model deliberately leaves
        out</em> above and are not restated here. Two boundaries remain worth naming
        because they change the <em>inputs</em>, not just the output:
      </p>
      <ul>
        <li>
          <strong>Grant pacing.</strong> Pools here are negotiated reserves, not hiring
          forecasts — nothing consumes them between rounds, so &ldquo;when does the pool
          run out&rdquo; needs a hiring model, not a cap table walk.
        </li>
        <li>
          <strong>Non-US conventions.</strong> Priced NVCA-style rounds throughout;
          markets that size ESOPs differently need different inputs, not just different
          defaults.
        </li>
      </ul>
      <h3>Three thresholds, scanned from the engine</h3>
      <p>
        None of the critical values below is typed by hand: each is a scan over the same
        library the calculator runs, stated so you can reproduce it.
      </p>
      <ol>
        <li>
          <strong>
            Feasibility ceiling — investor stake + pool &lt; 100% of the post-round table.
          </strong>{' '}
          Scan: pool target stepped from 100 down in half points, the round classified at
          each. At a {pct(scanF20, 0)} stake ({usdCompact(shuf.investment)} on{' '}
          {usdCompact(shuf.postMoney)} post) the last feasible target is{' '}
          <strong>{pct(ceilAt20, 1)}</strong>; {pct(ceilAt20 + 0.5, 1)} cannot close. At a{' '}
          {pct(scanF25, 0)} stake ({usdCompact(STANDARD_ROUNDS[0].investment)} on{' '}
          {usdCompact(STANDARD_ROUNDS[0].postMoney)} post) the ceiling drops to{' '}
          {pct(ceilAt25, 1)}, and at a {pct(scanF60, 0)} stake to {pct(ceilAt60, 1)}. Rounds
          near these bounds are a different conversation — the model&rsquo;s job is to
          name the boundary rather than print nonsense.
        </li>
        <li>
          <strong>The 50% majority line.</strong> Scan: founders&rsquo; combined ownership
          evaluated at every stage of each preset; the first stage at or below 50% is the
          crossing.
          <table>
            <thead>
              <tr>
                <th scope="col">Founders combined</th>
                {STANDARD.stages.map((s) => (
                  <th key={s.label} scope="col" className="text-right">
                    {s.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(
                [
                  ['Friendly', friendlyMajorityTrail],
                  ['Standard', stdMajorityTrail],
                  ['Heavy', heavyMajorityTrail],
                ] as const
              ).map(([label, trail]) => (
                <tr key={label}>
                  <th scope="row">{label}</th>
                  {trail.map((v, i) => (
                    <td key={i} className="text-right">
                      {pct(v, 1)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          The friendly path never crosses ({pct(friendlyFounders, 1)} after Series C); the
          standard path crosses at <strong>{stdMajorityLostAt}</strong> ({' '}
          {pct(stdPctAtMajorityLoss, 1)}), and heavy dilution survives only the seed ({' '}
          {pct(heavySeedPct, 1)}) before falling to {pct(heavyFounders, 1)} final. Majority
          is not recoverable through pool negotiation alone on the standard path — zero out
          every pool and the four rounds&rsquo; money still ends founders at{' '}
          {pct(stdNoPoolFounders, 1)}. Refine on the Series A target alone (seed pool fixed
          at {pct(10, 0)}, targets stepped 0–{pct(20, 0)} in half points): through{' '}
          <strong>{pct(aPoolThreshold, 1)}</strong> founders stay above water at the Series
          A close ({pct(aPoolThresholdKeep, 2)}); at {pct(aPoolThreshold + 0.5, 1)} they
          dip under ({pct(aPoolThresholdLose, 2)}). The standard preset&rsquo;s {pct(12, 0)}{' '}
          target sits past the line.
        </li>
        <li>
          <strong>The valuation price of a pool point.</strong> Scan: add{' '}
          {pct(SCAN3_STEP, 0)} points to the standard path&rsquo;s Series A target ({' '}
          {pct(12, 0)} → {pct(scan3Pool, 0)}) and final founders&rsquo; ownership falls
          from {pct(stdFounders, 2)} to {pct(scan3FatFinal, 2)} — {pts(scan3Cost, 2)}.
          Bisecting the Series A post-money that buys it back (monotone: {' '}
          {scan3MonoViolations} violations on a $5M grid; 60 halvings from{' '}
          {usdCompact(STANDARD_ROUNDS[1].postMoney)}) lands on{' '}
          <strong>{usdCompact(scan3OffsetPost)}</strong> — a {pct(scan3Markup * 100, 1)}{' '}
          markup — restoring the baseline to within {scan3Residual.toExponential(1)}{' '}
          points. Pool points and valuation points are the same currency; this is the
          exchange rate.
        </li>
      </ol>

      <h2 id="caveats">Important caveats</h2>
      <ul>
        <li>
          Inputs are a post-money valuation per round; pre-money is derived as post-money −
          investment. If your term sheet quotes pre-money instead, add the investment before typing.
        </li>
        <li>
          Rounds are modeled strictly in order and the chain stops at the first empty or invalid
          round — the tool will not invent a Series B without a Series A.
        </li>
        <li>
          Pool top-ups count existing unallocated shares toward the target. If your real cap table
          tracks granted versus unallocated options separately, fold granted options into a
          founder-style row named &ldquo;Employees&rdquo; — everyone else&apos;s percentages work
          out identically.
        </li>
        <li>
          US venture conventions (NVCA-style priced rounds) throughout; other markets size pools
          differently — 10–15% ESOP at seed is not unusual in Europe.
        </li>
        <li>
          Nothing here is legal, tax, or investment advice. Real cap tables live in your
          counsel&apos;s records; this is a negotiation instrument, not a system of record.
        </li>
      </ul>

      <h2 id="glossary">Glossary</h2>
      <p>Twelve terms this guide leans on, defined for a first pass through the subject.</p>
      <dl className="divide-y divide-slate-200 dark:divide-white/[0.07]">
        {GLOSSARY.map(([term, def]) => (
          <div key={term} className="py-4 first:pt-0 last:pb-0">
            <dt className="font-semibold text-slate-900 dark:text-slate-100">{term}</dt>
            <dd className="mt-1 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
              {def}
            </dd>
          </div>
        ))}
      </dl>

      <Faq
        items={[
          {
            question: 'How much dilution should I expect by Series C?',
            answer: (
              <p>
                With mainstream pricing and pools, the modeled standard path (raising{' '}
                {usdCompact(stdRaised)} total) leaves all founders at {pct(stdFounders, 1)} and the
                first founder slot at {pct(stdYou, 1)}. A friendly path keeps founders near{' '}
                {pct(friendlyFounders, 0)}; a punishing one ends near {pct(heavyFounders, 0)}. The
                spread between those outcomes is mostly pool size and round pricing — both
                negotiable.
              </p>
            ),
          },
          {
            question: 'What exactly is the option pool shuffle?',
            answer: (
              <p>
                Creating the option pool inside the pre-money so the new investor&apos;s price is
                struck over existing shares <em>plus</em> the pool. The investor still gets their
                agreed percentage; the pool comes entirely out of existing holders. In the canonical
                example above, founders go from {pct(noPoolFoundersPct, 0)} to{' '}
                {pct(shufFoundersPct, 0)} while the investor&apos;s stake is unchanged at{' '}
                {pct(shuf.investorPct * 100, 0)}.
              </p>
            ),
          },
          {
            question: 'Pre-money pool or post-money pool — which should I push for?',
            answer: (
              <p>
                Post-money. If the pool is created after the round closes, everyone — including the
                new investor — dilutes pro-rata into it. Same headline valuation,{' '}
                {pts(preVsPostGap, 1)} better for founders in the canonical example ({pct(shufFoundersPct, 1)}{' '}
                → {pct(postPoolFoundersPct, 1)}), and up to {pts(noPoolGap - preVsPostGap, 1)} more
                if the pool itself shrinks toward nothing. Investors usually resist; a middle path
                is keeping the pool in the pre-money but shrinking it with a concrete hiring plan.
              </p>
            ),
          },
          {
            question: 'Does the option pool dilute my investors too?',
            answer: (
              <p>
                Only pools created after their round do. In the standard pre-money shuffle, the
                incoming investor&apos;s percentage is fixed by the money (
                <code>investment ÷ post-money</code>) and is untouched by the pool created in that
                same round. Earlier investors do dilute in later rounds — everyone&apos;s share
                counts stay constant while the denominator grows.
              </p>
            ),
          },
          {
            question: 'Where do my SAFEs or convertible notes fit?',
            answer: (
              <p>
                They don&rsquo;t — priced rounds only, deliberately, and that includes the cap
                and the discount: nothing here prices a SAFE. To approximate a convertible
                stack, model it as an extra round — investment = the money sitting on SAFEs,
                post-money = your estimate of the priced round those SAFEs convert into.
                Caps and discounts shift the real conversion, so treat the result as a rough
                but honest bracket, not a quote.
              </p>
            ),
          },
          {
            question: 'My cap table already has granted options. Where do they go?',
            answer: (
              <p>
                Add them as a founder-style row named &ldquo;Employees.&rdquo; Granted options are
                just shares in the denominator — the math treats every outstanding share
                identically, and the model&apos;s &ldquo;Employees &amp; option pool&rdquo; line
                covers the unallocated reserve. Mixing granted and unallocated in one row changes
                no one else&apos;s percentages.
              </p>
            ),
          },
          {
            question: 'I hold more shares than my cofounder — am I diluted less?',
            answer: (
              <p>
                No. Every round scales all existing blocks by the same factor, so relative
                splits never move: on the standard path &ldquo;you&rdquo; holds{' '}
                {pct(youBlockShareFounding, 1)} of the founders&rsquo; block at founding and{' '}
                {pct(youBlockShareFinal, 1)} of it after Series C. Negotiate the size of the
                founders&rsquo; block; how you split it is immune to dilution.
              </p>
            ),
          },
          {
            question: 'A flat round — same valuation as last time — doesn’t dilute me, right?',
            answer: (
              <p>
                Wrong. Each round&rsquo;s dilution depends on exactly one thing: new money ÷
                post-money. A {usd(FLAT.stages[1].round!.investment, 0)} check at a{' '}
                {usd(FLAT.stages[1].round!.postMoney, 0)} post-money takes{' '}
                {pts(flatFPct, 2)} from every existing holder — the engine puts founders at{' '}
                {pct(flatFounders, 2)} — whether that valuation is a markup, a flat, or a
                cut.
              </p>
            ),
          },
          {
            question: 'Isn’t a higher valuation always better for founders?',
            answer: (
              <p>
                Not when structure rides along. In the isolated pair above, investor X
                prices both rounds strictly higher yet leaves founders at {pct(valXFounders, 1)}{' '}
                against {pct(valYFounders, 1)} for the cheaper term sheet with lean pools.
                Read valuation and pool size as one number, not two.
              </p>
            ),
          },
          {
            question: 'How much does each extra point of option pool cost me?',
            answer: (
              <p>
                In a single round with a top-up, exactly one ownership point per pool point:
                the canonical {usd(shuf.investment, 0)} round leaves founders at{' '}
                {pct(shufFoundersPct, 1)} with a {pct(10, 0)} pool and {pct(pool20Founders, 1)}{' '}
                with a {pct(20, 0)} pool. Across a path the costs compound — every +2 points
                of target on all four standard rounds costs the first founder slot about{' '}
                {pts(poolCostPerTwo, 2)}.
              </p>
            ),
          },
          {
            question: 'Why did founders lose more than the investors bought?',
            answer: (
              <p>
                The difference is the pools. On the standard path, {usd(stdRaised, 0)} of
                money across four rounds takes {pts(stdRoundsOnlyCost, 2)} of ownership; the
                option pools negotiated alongside take another {pts(stdPoolCost, 2)},
                leaving founders at {pct(stdFounders, 1)}. Both are negotiable, but only
                one appears in the headline valuation.
              </p>
            ),
          },
          {
            question: 'What is the largest option pool a round can demand?',
            answer: (
              <p>
                Investor stake and pool must stay under 100% of the post-round table
                together. At a {pct(scanF20, 0)} stake the last feasible target on a
                half-point grid is {pct(ceilAt20, 1)} — {pct(ceilAt20 + 0.5, 1)} cannot
                close; at a {pct(scanF25, 0)} stake the ceiling is {pct(ceilAt25, 1)}.
                Anything near these numbers is a different deal, not a negotiation.
              </p>
            ),
          },
          {
            question: 'What happens if I enter an investment larger than the post-money?',
            answer: (
              <p>
                The round is flagged invalid and the chain stops there.{' '}
                {usd(10_000_000, 0)} invested at a {usd(10_000_000, 0)} post-money returns
                &ldquo;{INVALID_MONEY.reason}&rdquo;; {usd(2_000_000, 0)} at{' '}
                {usd(2_400_000, 0)} post with a {pct(25, 0)} pool returns
                &ldquo;{INVALID_STACK.reason}&rdquo; — the stake alone is{' '}
                {pct(invalidStackF, 2)}. Later rounds become input-only until it is fixed.
              </p>
            ),
          },
          {
            question: 'Can I model a down round?',
            answer: (
              <p>
                Arithmetically, yes: {usd(DOWN.stages[1].round!.investment, 0)} raised at a{' '}
                {usd(DOWN.stages[1].round!.postMoney, 0)} post with a {pct(10, 0)} pool
                simply leaves founders at {pct(downFounders, 1)}, because the engine only
                sees investment over post-money. What it will not do is apply the
                anti-dilution adjustments a real down round triggers on earlier preferred
                stock — those live in the documents, not the percentages.
              </p>
            ),
          },
          {
            question: 'Why did my later round add zero pool shares?',
            answer: (
              <p>
                Because the carried-over pool already covers the target. On the standard
                path the pool enters Series B at {pct(stdPoolPctEnteringB, 1)}, and even
                after the new money dilutes it to {pct(stdPoolPctAfterB, 1)} it stays above
                the {pct(stdPoolTargetB, 0)} target — so Series B tops up nothing rather
                than re-diluting you.
              </p>
            ),
          },
          {
            question: 'I’m granting an employee options — does that dilute me?',
            answer: (
              <p>
                No. Grants come out of the unallocated pool, and those shares are already in
                the denominator; a grant relabels a share from &ldquo;pool&rdquo; to
                &ldquo;employee&rdquo; and moves no one else&rsquo;s percentage. That is
                exactly why the model does not distinguish granted from unallocated options.
              </p>
            ),
          },
          {
            question: 'How many rounds can I model, and in what order?',
            answer: (
              <p>
                {MAX_ROUNDS} rounds, strictly in sequence. Zero out the Series A investment
                on the standard path and the engine models only the seed, reporting
                &ldquo;{HALTED.haltReason}&rdquo; — a Series B cannot exist without the
                round before it.
              </p>
            ),
          },
          {
            question: 'Is my ownership percentage what I would be paid at exit?',
            answer: (
              <p>
                Only in the best case. &ldquo;You&rdquo; at {pct(stdYou, 1)} of a{' '}
                {usdCompact(DEFAULT_EXIT_VALUATION)} exit is about{' '}
                {usdCompact(stdYouExitCeiling)} — stake times valuation, ignoring
                liquidation preferences, participation, debt, and taxes. In a flat or down
                exit, preference stacks can take most of the value while every percentage
                stays unchanged.
              </p>
            ),
          },
          {
            question: 'When do founders lose majority?',
            answer: (
              <p>
                It is a function of the path, not a constant: the friendly preset holds{' '}
                {pct(friendlyFounders, 1)} through Series C, the standard path crosses
                under 50% at Series A ({pct(stdPctAtMajorityLoss, 1)}), and heavy dilution
                ends at {pct(heavyFounders, 1)}. Even with every pool zeroed, the standard
                path&rsquo;s money alone leaves founders at {pct(stdNoPoolFounders, 1)} —
                majority is priced into the rounds, not just the pools.
              </p>
            ),
          },
          {
            question: 'Is a 10% seed pool normal?',
            answer: (
              <p>
                The presets bracket common US practice at {pct(presetSeedPoolMin, 0)}–
                {pct(presetSeedPoolMax, 0)}: lean on the friendly path,{' '}
                {pct(CAP_TABLE_PRESETS[3].rounds[0].poolPct, 0)} in the single-round
                preset, and {pct(CAP_TABLE_PRESETS[2].rounds[0].poolPct, 0)} under heavy
                dilution. &ldquo;Normal&rdquo; matters less than &ldquo;justified&rdquo; —
                a pool should map to a hiring plan for the next 18–24 months.
              </p>
            ),
          },
          {
            question: 'What happens when a founder leaves?',
            answer: (
              <p>
                Vesting and share repurchase are outside this model — enter each
                founder&rsquo;s vested share count in their row and treat unvested shares
                as a document-level question (typically they return to the pool). The
                engine only ever sees the share counts you give it; it has no opinion on
                who earned them.
              </p>
            ),
          },
        ]}
      />

      <RelatedCalculators
        links={[
          { href: '/llc-vs-ccorp-tax-calculator/', label: 'LLC vs C-Corp Tax Calculator' },
          { href: '/saas-runway-calculator/', label: 'SaaS Runway Calculator' },
          { href: '/s-corp-tax-calculator/', label: 'S-Corp Salary Calculator' },
        ]}
      />
    </article>
  );
}

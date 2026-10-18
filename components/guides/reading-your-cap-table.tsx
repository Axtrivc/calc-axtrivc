import { ArticleToc } from '@/components/Article';
import {
  CAP_TABLE_PRESETS,
  ROUND_NAMES,
  founderPct,
  foundersPct,
  finalStage,
  postMoneyPoolRound,
  simulateCapTable,
  stakePct,
} from '@/lib/captable';
import { SAFE_PRESETS, convertSafeStack, crossoverPreMoney, effectiveCap } from '@/lib/safe';
import { numFmt, pct, usd, usdCompact } from '@/lib/format';

/**
 * "Reading Your Cap Table" — the guides-knowledge-base body for
 * /guides/reading-your-cap-table/. Rendered through GuideShell, which supplies
 * the h1, breadcrumb, prose column, and the closing instrument panel; this
 * component starts at h2 and emits bare semantic markup (same contract as the
 * components/content/ articles, minus their self-wrapped <article>).
 *
 * Every figure in the prose is computed at module scope by the same libraries
 * that power the two instruments this guide leans on (lib/captable,
 * lib/safe) — nothing below is hand-typed, so the guide cannot drift from the
 * calculators. Values cross-checked against a 80-assertion engine run during
 * authoring (see the workflow's mathChecks record).
 */

/** Ownership deltas are percentage POINTS, never a bare "%". */
const pts = (v: number, d = 2) => `${v.toFixed(d)} points`;

/* ------------------------------------------------------------------ */
/* Pass 1 — the standard four-round path (lib/captable preset 0).      */
/* ------------------------------------------------------------------ */
const STD_FOUNDERS = [
  { name: 'You', shares: CAP_TABLE_PRESETS[0].founders[0].shares },
  { name: 'Cofounder', shares: CAP_TABLE_PRESETS[0].founders[1].shares },
];
const STD_ROUNDS = CAP_TABLE_PRESETS[0].rounds.map((r, i) => ({ name: ROUND_NAMES[i], ...r }));
const STD = simulateCapTable(STD_FOUNDERS, STD_ROUNDS);
const STD_NO_POOL = simulateCapTable(STD_FOUNDERS, STD_ROUNDS.map((r) => ({ ...r, poolPct: 0 })));
const stdFinal = finalStage(STD)!;
const stdNoPoolFinal = finalStage(STD_NO_POOL)!;
const stdTrail = STD.stages.map((s) => foundersPct(s)); // 100 → 65.00 → 49.11 → 40.93 → 36.01
const stdFoundersFinal = foundersPct(stdFinal); // 36.015 (3 dp)
const stdYouFinal = founderPct(stdFinal, 0); // 21.61
const stdYouTrail = STD.stages.map((s) => founderPct(s, 0));
const stdRaised = STD_ROUNDS.reduce((a, r) => a + r.investment, 0); // $52.5M
const stdSeed = STD.stages[1].round!;
const stdMoneyCost = 100 - foundersPct(stdNoPoolFinal); // 56.00
const stdPoolCost = foundersPct(stdNoPoolFinal) - stdFoundersFinal; // 7.99

/* ------------------------------------------------------------------ */
/* Pass 2a — the pool trap trio: 10M founder shares, $2M at $10M post. */
/* ------------------------------------------------------------------ */
const TRIO_FOUNDERS = [{ name: 'Founders', shares: 10_000_000 }];
const TRIO_NO_POOL = simulateCapTable(TRIO_FOUNDERS, [
  { name: 'Seed', investment: 2_000_000, postMoney: 10_000_000, poolPct: 0 },
]);
const TRIO_SHUFFLE = simulateCapTable(TRIO_FOUNDERS, [
  { name: 'Seed', investment: 2_000_000, postMoney: 10_000_000, poolPct: 10 },
]);
const noPoolStage = TRIO_NO_POOL.stages[1];
const shufStage = TRIO_SHUFFLE.stages[1];
const shufPoolShares = shufStage.stakes.find((s) => s.kind === 'pool')?.shares ?? 0;
const noPoolFounders = foundersPct(noPoolStage); // 80.0
const shufFounders = foundersPct(shufStage); // 70.0
const POST_POOL = postMoneyPoolRound(10_000_000, 2_000_000, 10_000_000, 10)!;
const postPoolFounders = POST_POOL.foundersPct; // 72.0
const movingPoolGap = postPoolFounders - shufFounders; // 2.0 = f × pool
const shrinkPoolGap = noPoolFounders - postPoolFounders; // 8.0

/* Top-up mechanics: one seed ($1.5M at $8M post, 12% pool), two A targets. */
const TOPUP_SEED = { name: 'Seed', investment: 1_500_000, postMoney: 8_000_000, poolPct: 12 };
const TOPUP_LEAN = simulateCapTable(STD_FOUNDERS, [
  TOPUP_SEED,
  { name: 'Series A', investment: 6_000_000, postMoney: 30_000_000, poolPct: 8 },
]);
const TOPUP_FAT = simulateCapTable(STD_FOUNDERS, [
  TOPUP_SEED,
  { name: 'Series A', investment: 6_000_000, postMoney: 30_000_000, poolPct: 12 },
]);
const poolSharesOf = (s: ReturnType<typeof finalStage>) =>
  s!.stakes.filter((x) => x.kind === 'pool').reduce((a, x) => a + x.shares, 0);
const seedStage = TOPUP_LEAN.stages[1];
const leanStage = TOPUP_LEAN.stages[2];
const fatStage = TOPUP_FAT.stages[2];
const poolEnteringA = stakePct(poolSharesOf(seedStage), seedStage.shares); // 12.0
const leanPoolAfter = stakePct(poolSharesOf(leanStage), leanStage.shares); // 9.6
const leanFounders = foundersPct(leanStage); // 55.40
const fatTopUp = fatStage.round!.poolTopUp; // 509,662
const fatFounders = foundersPct(fatStage); // 53.51
const fatGap = leanFounders - fatFounders; // 1.89
// The standard path's own top-up trail (audit-corrected): the seed CREATES the
// pool (1,538,462 shares), Series A tops it up once (904,977 — its 12% target
// over a pool carried at 10% that A's money alone would dilute to 8%), and
// B/C add zero. The pool entering B at 12.0% is the product of A's top-up.
const stdAfterSeed = STD.stages[1];
const stdPoolEnteringA = stakePct(poolSharesOf(stdAfterSeed), stdAfterSeed.shares); // 10.0
const stdSeedTopUp = stdAfterSeed.round!.poolTopUp; // 1,538,462 — creation
const stdATopUp = STD.stages[2].round!.poolTopUp; // 904,977 — the one later firing
const stdAfterA = STD.stages[2];
const stdAfterB = STD.stages[3];
const stdAfterC = STD.stages[4];
const stdPoolEnteringB = stakePct(poolSharesOf(stdAfterA), stdAfterA.shares); // 12.0 — post top-up
const stdPoolAfterB = stakePct(poolSharesOf(stdAfterB), stdAfterB.shares); // 10.0 — clears the target
const stdPoolTargetB = STD_ROUNDS[2].poolPct; // 8
const stdPoolAfterC = stakePct(poolSharesOf(stdAfterC), stdAfterC.shares); // 8.8
const stdPoolTargetC = STD_ROUNDS[3].poolPct; // 5
// Counterfactual: cut the A target to 8% (covered by the carried pool) and A
// tops up nothing — the pool it leaves behind is what B would otherwise see.
const STD_NO_A_TOPUP = simulateCapTable(
  STD_FOUNDERS,
  STD_ROUNDS.map((r, i) => (i === 1 ? { ...r, poolPct: 8 } : r)),
);
const poolAfterAWithoutTopUp = stakePct(
  poolSharesOf(STD_NO_A_TOPUP.stages[2]),
  STD_NO_A_TOPUP.stages[2].shares,
); // 8.0
// Composition of the final pool: creation at seed vs Series A top-up.
const finalPoolShares = poolSharesOf(stdFinal); // 2,443,439
const seedPoolSharePct = (stdSeedTopUp / finalPoolShares) * 100; // 62.96 → 63%
const aTopUpSharePct = (stdATopUp / finalPoolShares) * 100; // 37.04 → 37%

/* ------------------------------------------------------------------ */
/* Pass 2b — the SAFE stack (lib/safe).                                */
/* ------------------------------------------------------------------ */
const Z = { amount: 0, cap: 0, discountPct: 0 } as const;
const CANON_SAFE = { amount: 500_000, cap: 10_000_000, discountPct: 20 };
const CANON_ROUND = { investment: 3_000_000, preMoney: 15_000_000 };
const CANON = convertSafeStack([CANON_SAFE, { ...Z }], CANON_ROUND, 10_000_000);
const canon = CANON.safes[0];
const canonPctPre = canon.pctOfPreRound; // 5.00 — amount ÷ cap, fixed at signing
const KINK = crossoverPreMoney(CANON_SAFE)!; // $12.5M = cap ÷ 0.80
const LADDER = [8_000_000, 11_000_000, KINK, 15_000_000, 30_000_000].map((pre) => {
  const r = convertSafeStack([CANON_SAFE, { ...Z }], { investment: 3_000_000, preMoney: pre }, 10_000_000);
  return {
    pre,
    binding: r.safes[0].binding,
    pctPre: r.safes[0].pctOfPreRound,
    after: r.stackPctAfter,
    founders: r.foundersPctAfter,
  };
});
const valley = Math.min(...LADDER.map((l) => l.after)); // 4.03 at the kink

/* Mixed stack — the two-SAFE preset: different terms flip at different valuations. */
const MIXED = convertSafeStack(SAFE_PRESETS[2].safes, SAFE_PRESETS[2].round, SAFE_PRESETS[2].shares);
const m1 = MIXED.safes[0];
const m2 = MIXED.safes[1];

/* ------------------------------------------------------------------ */
/* Pass 3 — control lines.                                             */
/* ------------------------------------------------------------------ */
const FRIENDLY = simulateCapTable(
  STD_FOUNDERS,
  CAP_TABLE_PRESETS[1].rounds.map((r, i) => ({ name: ROUND_NAMES[i], ...r })),
);
const HEAVY = simulateCapTable(
  STD_FOUNDERS,
  CAP_TABLE_PRESETS[2].rounds.map((r, i) => ({ name: ROUND_NAMES[i], ...r })),
);
const stdCrossing = STD.stages.find((s) => foundersPct(s) <= 50)!; // Series A close
const stdAtCrossing = foundersPct(stdCrossing); // 49.11
const friendlyFinal = foundersPct(finalStage(FRIENDLY)!); // 54.11 — never crosses
const heavySeed = foundersPct(HEAVY.stages[1]); // 51.67 — last stop above water
const heavyFinal = foundersPct(finalStage(HEAVY)!); // 10.49
// Largest Series A pool target (seed pool fixed at 10%) that keeps founders
// above 50% at the A close — half-point grid scan over 0–20%.
function foundersAfterSeriesA(poolPct: number): number {
  const sim = simulateCapTable(STD_FOUNDERS, [
    { name: 'Seed', investment: 1_500_000, postMoney: 6_000_000, poolPct: 10 },
    { name: 'Series A', investment: 6_000_000, postMoney: 30_000_000, poolPct },
  ]);
  return foundersPct(sim.stages[2]);
}
let aTargetKeep = 0;
for (let p = 0; p <= 20; p += 0.5) if (foundersAfterSeriesA(p) > 50) aTargetKeep = p; // 10.5
const aKeepPct = foundersAfterSeriesA(aTargetKeep); // 50.19
const aLosePct = foundersAfterSeriesA(aTargetKeep + 0.5); // 49.83
// SAFE-side majority: k × ($500k at $8M cap, 20% off) on the canonical round.
function foundersAfterKSafes(k: number): number {
  return convertSafeStack(
    Array.from({ length: k }, () => ({ amount: 500_000, cap: 8_000_000, discountPct: 20 })),
    CANON_ROUND,
    10_000_000,
  ).foundersPctAfter;
}
const kLastAbove = foundersAfterKSafes(6); // 52.08
const kCross = foundersAfterKSafes(7); // 46.88
const kEachPct = convertSafeStack(
  [{ ...CANON_SAFE, cap: 8_000_000 }, { ...Z }],
  CANON_ROUND,
  10_000_000,
).safes[0].pctOfPreRound; // 6.25 = 500k ÷ 8M

/* ------------------------------------------------------------------ */
/* The valuation-versus-structure pair for the closing protocol.       */
/* ------------------------------------------------------------------ */
const VAL_X = simulateCapTable(STD_FOUNDERS, [
  { name: 'Seed', investment: 2_000_000, postMoney: 10_000_000, poolPct: 30 },
  { name: 'Series A', investment: 8_000_000, postMoney: 40_000_000, poolPct: 30 },
]);
const VAL_Y = simulateCapTable(STD_FOUNDERS, [
  { name: 'Seed', investment: 2_000_000, postMoney: 7_000_000, poolPct: 5 },
  { name: 'Series A', investment: 8_000_000, postMoney: 25_000_000, poolPct: 5 },
]);
const valXFounders = foundersPct(finalStage(VAL_X)!); // 35.71
const valYFounders = foundersPct(finalStage(VAL_Y)!); // 44.05

/* ------------------------------------------------------------------ */

export default function ReadingYourCapTableGuide() {
  const toc = [
    { id: 'the-table', label: 'Start from the table' },
    { id: 'pool', label: 'The option pool trap' },
    { id: 'top-up', label: 'Top-up triggers' },
    { id: 'safes', label: 'SAFEs: dilution deferred' },
    { id: 'control', label: 'Majority & control' },
    { id: 'protocol', label: 'The five-check protocol' },
  ];

  return (
    <>
      <ArticleToc items={toc} />

      <p>
        <strong>Read every cap table in three passes, and negotiate in points, not valuations.</strong>{' '}
        Pass one: what is <em>priced</em> — the rounds already closed, where each investor&rsquo;s stake
        was fixed the moment their money moved, by arithmetic no one revisits. Pass two: what is{' '}
        <em>promised but unpriced</em> — the option pool reserved for hires and the SAFE notes waiting
        to convert, both of which are dilution already sold, just not yet visible in the share counts.
        Pass three: <em>where control sits</em> — the 50% line, and what actually crosses it. Every
        structural term in a term sheet (pool size, pool placement, caps, discounts) has a price in
        ownership points, and that price is computable before you sign. This guide walks one
        four-round cap table through all three passes with the same engines that power the{' '}
        <a href="/cap-table-dilution-calculator/">
          cap table calculator
        </a>{' '}
        and the{' '}
        <a href="/safe-note-calculator/">
          SAFE note calculator
        </a>
        — so every number you read here is a number you can reproduce on your own figures.
      </p>

      <div className="my-8 rounded-xl border border-slate-200 bg-slate-50/60 p-5 sm:p-6 dark:border-white/[0.08] dark:bg-white/[0.03]">
        <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          The three-pass read
        </div>
        <ol className="grid list-decimal gap-2 pl-5 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
          <li>
            <strong className="font-semibold text-slate-900 dark:text-slate-100">Priced:</strong> closed
            rounds — each investor owns investment ÷ post-money, forever fixed by the money itself.
          </li>
          <li>
            <strong className="font-semibold text-slate-900 dark:text-slate-100">Promised:</strong> the
            unallocated pool and the SAFE stack — ownership already committed, landing in the
            denominator later.
          </li>
          <li>
            <strong className="font-semibold text-slate-900 dark:text-slate-100">Control:</strong> where
            founders cross 50%, and which rights (board, vetoes) live in the documents rather than the
            percentages.
          </li>
        </ol>
      </div>

      <h2 id="the-table">Start from the table: four rounds, one sentence of arithmetic</h2>
      <p>
        A cap table is a ledger with one rule. In a priced round the investor&rsquo;s stake is set by
        the money: <code>investor % = investment ÷ post-money</code>, and pre-money is simply{' '}
        <code>post-money − investment</code>. &ldquo;$1.5M at a $6M post&rdquo; means the seed fund
        owns <code>{usdCompact(STD_ROUNDS[0].investment)} ÷ {usdCompact(STD_ROUNDS[0].postMoney)}</code>{' '}
        = <strong>{pct(STD_ROUNDS[0].investment / STD_ROUNDS[0].postMoney * 100, 0)}</strong> of the
        company the moment the round closes — whatever the price per share turns out to be, the company
        issues enough shares to make that fraction true. Nobody takes shares from you; the denominator
        grows. That is the whole mechanism, and it compounds.
      </p>
      <p>
        Here is the standard path the calculator ships with — two founders holding{' '}
        {numFmt(STD_FOUNDERS[0].shares)} and {numFmt(STD_FOUNDERS[1].shares)} shares, then a seed and
        three follow-ons raising {usd(stdRaised, 0)} in total, with mainstream pool targets (
        {STD_ROUNDS.map((r) => pct(r.poolPct, 0)).join(' / ')}). Every cell below is the engine walking
        the rounds in sequence:
      </p>
      <table>
        <thead>
          <tr>
            <th scope="col">Founders combined</th>
            {STD.stages.map((s) => (
              <th key={s.label} scope="col" className="text-right">
                {s.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr>
            <th scope="row">All founders</th>
            {stdTrail.map((v, i) => (
              <td key={i} className="text-right">
                {pct(v, i === 0 ? 0 : 2)}
              </td>
            ))}
          </tr>
          <tr>
            <th scope="row">&ldquo;You&rdquo; slot</th>
            {stdYouTrail.map((v, i) => (
              <td key={i} className="text-right">
                {pct(v, i === 0 ? 0 : 2)}
              </td>
            ))}
          </tr>
          <tr>
            <th scope="row">New investor in the round</th>
            <td className="text-right">—</td>
            {STD.stages.slice(1).map((s, i) => (
              <td key={i} className="text-right">
                {pct(s.round!.investorPct * 100, 2)}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
      <p>
        The endpoint is the number to sit with: after four ordinary rounds — no down rounds, no
        punitive terms — the founders hold <strong>{stdFoundersFinal.toFixed(3)}%</strong>, and the
        first founder slot holds <strong>{pct(stdYouFinal, 2)}</strong>. The seed priced at{' '}
        {usd(stdSeed.pricePerShare, 2)} per share; by Series C the same founders&rsquo; block is a
        much smaller share of a much larger denominator. Dilution of this shape is not a negotiation
        failure; it is what raising {usdCompact(stdRaised)} costs. What <em>is</em> negotiable is the
        gap between the money&rsquo;s price and the total price: zero out every option pool on this
        path and the same money leaves founders at{' '}
        <strong>{pct(foundersPct(stdNoPoolFinal), 2)}</strong>. So the rounds themselves take{' '}
        {pts(stdMoneyCost)} and the pools negotiated alongside take another{' '}
        <strong>{pts(stdPoolCost)}</strong>. Only one of those appears in the headline valuation —
        which is why the pool deserves its own pass.
      </p>

      <h2 id="pool">The option pool trap: 2.0 points vs 8.0 points</h2>
      <p>
        &ldquo;We need a 10% option pool&rdquo; is one sentence hiding two separate negotiations:
        how <em>big</em> the pool is, and which <em>side of the price</em> it sits on. Investors
        want the pool created <strong>before</strong> their money prices the round — inside the
        pre-money — so the incoming price is struck over existing shares <em>plus</em> the pool.
        The pro-founder alternative closes the round first and carves the pool out of the closed
        table, so everyone (the new investor included) dilutes into it pro-rata. Same headline
        valuation, different founders&rsquo; line. Canonical case, run through the engine: founders
        hold 10,000,000 shares; an investor puts {usd(2_000_000, 0)} in at a{' '}
        {usd(10_000_000, 0)} post-money; a 10% pool is required.
      </p>
      <table>
        <thead>
          <tr>
            <th scope="col">Same round, three structures</th>
            <th scope="col" className="text-right">No pool</th>
            <th scope="col" className="text-right">Pool in pre-money (market default)</th>
            <th scope="col" className="text-right">Pool in post-money (pro-founder)</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Price per share</td>
            <td className="text-right">{usd(noPoolStage.round!.pricePerShare, 2)}</td>
            <td className="text-right">{usd(shufStage.round!.pricePerShare, 2)}</td>
            <td className="text-right">{usd(noPoolStage.round!.pricePerShare, 2)}</td>
          </tr>
          <tr>
            <td>Fully diluted shares after</td>
            <td className="text-right">{numFmt(Math.round(noPoolStage.shares))}</td>
            <td className="text-right">{numFmt(Math.round(shufStage.shares))}</td>
            <td className="text-right">{numFmt(Math.round(POST_POOL.sharesFinal))}</td>
          </tr>
          <tr>
            <td>New pool shares</td>
            <td className="text-right">—</td>
            <td className="text-right">{numFmt(Math.round(shufPoolShares))}</td>
            <td className="text-right">{numFmt(Math.round(POST_POOL.sharesFinal - POST_POOL.sharesAfterClose))}</td>
          </tr>
          <tr>
            <td><strong>Founders own</strong></td>
            <td className="text-right"><strong>{pct(noPoolFounders, 1)}</strong></td>
            <td className="text-right"><strong>{pct(shufFounders, 1)}</strong></td>
            <td className="text-right"><strong>{pct(postPoolFounders, 1)}</strong></td>
          </tr>
          <tr>
            <td>Investor owns</td>
            <td className="text-right">{pct(noPoolStage.round!.investorPct * 100, 1)}</td>
            <td className="text-right">{pct(shufStage.round!.investorPct * 100, 1)}</td>
            <td className="text-right">{pct(POST_POOL.investorPct, 1)}</td>
          </tr>
        </tbody>
      </table>
      <p>
        Now the two gaps lazy reading conflates. Moving the <em>same</em> 10% pool across the price —
        from the pre-money to the post-money side — is worth{' '}
        <strong>{pts(movingPoolGap, 1)}</strong> of founder ownership here ({pct(shufFounders, 1)} →{' '}
        {pct(postPoolFounders, 1)}). That number is not an accident of this example: the investor&rsquo;s{' '}
        {pct(20, 0)} stake is contractually protected, so the pool&rsquo;s cost shifts entirely, and the
        residual is exactly <code>f × pool</code> — {pct(20, 0)} × {pct(10, 0)} = {pts(movingPoolGap, 1)}.
        Shrinking the pool itself — from 10% down to nothing, measured from the post-money basis — is
        worth a separate <strong>{pts(shrinkPoolGap, 1)}</strong> ({pct(postPoolFounders, 1)} →{' '}
        {pct(noPoolFounders, 1)}). Two different levers, two different arguments: size is fought with a
        hiring plan (which named roles, which levels, next 18–24 months), placement is fought with one
        sentence at the term sheet. When an investor says &ldquo;the pool costs you 10 points,&rdquo;
        they have merged a {pts(movingPoolGap, 1)} negotiation into a{' '}
        {pts(movingPoolGap + shrinkPoolGap, 1)} one.
      </p>

      <h2 id="top-up">Top-up triggers: the target is a floor, not a creation</h2>
      <p>
        The pool line of a term sheet does not say &ldquo;the pool shall be this big.&rdquo; It says:
        <em> if the pool you are carrying has diluted below this, the round mints the shortfall before
        pricing.</em> Existing unallocated shares count toward the target, so a round only adds pool
        shares when the carried pool has fallen under it. Watch the mechanic isolate cleanly: take the
        seed from the single-round preset ({usd(1_500_000, 0)} at {usd(8_000_000, 0)} post,{' '}
        {pct(12, 0)} pool — it closes exactly on target), then bring a Series A of{' '}
        {usd(6_000_000, 0)} at {usd(30_000_000, 0)} post under two targets.
      </p>
      <ul>
        <li>
          <strong>Lean {pct(8, 0)} target — no top-up.</strong> The pool enters the round at{' '}
          {pct(poolEnteringA, 1)}; the new money alone dilutes it to{' '}
          {pct(leanPoolAfter, 1)} — still above target — so the round adds zero pool shares and
          founders finish at <strong>{pct(leanFounders, 2)}</strong>.
        </li>
        <li>
          <strong>Fat {pct(12, 0)} target — top-up.</strong> The carried pool cannot cover it, so the
          round mints {numFmt(Math.round(fatTopUp))} new pool shares into the pre-money denominator.
          The price per share falls, and founders finish at <strong>{pct(fatFounders, 2)}</strong> —{' '}
          <strong>{pts(fatGap, 2)}</strong> worse than the lean sheet on identical money and
          valuation.
        </li>
      </ul>
      <p>
        The standard path runs this trigger&rsquo;s full range. The seed&rsquo;s{' '}
        {numFmt(Math.round(stdSeedTopUp))} shares are the maximal case — an empty pool created
        straight to target, which is why the pool enters Series A at{' '}
        {pct(stdPoolEnteringA, 1)}. The trigger then fires exactly once more: Series A&rsquo;s{' '}
        {pct(STD_ROUNDS[1].poolPct, 0)} target meets a carried pool that A&rsquo;s money alone would
        dilute to {pct(poolAfterAWithoutTopUp, 1)} — under target — so the round mints{' '}
        {numFmt(Math.round(stdATopUp))} new pool shares into the pre-money. That top-up is exactly
        why the pool enters Series B at {pct(stdPoolEnteringB, 1)}: had A not topped up, Series B
        would be looking at {pct(poolAfterAWithoutTopUp, 1)}. From there the trigger goes quiet —
        Series B&rsquo;s money dilutes the pool to {pct(stdPoolAfterB, 1)}, clearing its{' '}
        {pct(stdPoolTargetB, 0)} target, and Series C leaves it at {pct(stdPoolAfterC, 1)} against
        a {pct(stdPoolTargetC, 0)} target: zero new shares both times. Of the{' '}
        {numFmt(Math.round(finalPoolShares))} pool shares on the final table,{' '}
        {pct(seedPoolSharePct, 0)} were created at the seed and only {pct(aTopUpSharePct, 0)}{' '}
        arrived with the Series A top-up — so the {pts(stdPoolCost, 2)} the pools cost on this path
        is the whole program, initial creations included, not the top-ups alone. The reading
        discipline: when you see a pool target, ask what is <em>unallocated today</em>. A{' '}
        {pct(12, 0)} target over a pool already carrying {pct(11, 0)} is nearly free; the same
        target over an empty pool costs founders roughly the full {pct(12, 0)}.
      </p>

      <h2 id="safes">The SAFE stack: dilution deferred is dilution signed</h2>
      <p>
        A SAFE defers the <em>price</em>, not the <em>dilution</em>. The YC post-money form fixes a
        capped SAFE&rsquo;s share of the pre-round capitalization on the day it is signed:{' '}
        <code>SAFE % = amount ÷ cap</code>. Sign {usdCompact(500_000)} on a{' '}
        {usdCompact(10_000_000)} cap and you have sold {pct(canonPctPre, 2)} of the company&apos;s
        pre-round table, in writing, months before anyone prices a share. When the Series A lands —{' '}
        {usdCompact(CANON_ROUND.investment)} at {usdCompact(CANON_ROUND.preMoney)} pre, on{' '}
        {numFmt(10_000_000)} existing shares — the conversion runs on that promise: the SAFE&apos;s
        dollars divide against its {usdCompact(10_000_000)} effective cap, the round&apos;s dollars
        against the {usdCompact(CANON_ROUND.preMoney)} pre-money, and the two prices reconcile on a
        Company Capitalization of {numFmt(Math.round(CANON.companyCapitalization))} shares.
      </p>
      <p>
        The trap is the intuition that the SAFE is free until it converts. Run the round both ways:
        without the SAFE, existing holders keep{' '}
        <strong>{pct(CANON.foundersPctNoSafes, 2)}</strong> of the post-round table; with it, they
        keep <strong>{pct(CANON.foundersPctAfter, 2)}</strong> — the stack costs{' '}
        <strong>{pts(CANON.foundersExtraDilutionPts, 2)}</strong>, and every point of it was
        committed the day the money arrived in the bank. The {usdCompact(500_000)} was spent either
        way; the cap decides who pays for it later.
      </p>
      <h3>Which term binds — and the valley between them</h3>
      <p>
        A SAFE carrying both a cap and a discount converts at whichever term produces the{' '}
        <em>lower</em> price. The two regimes meet where <code>cap = 0.80 × pre-money</code>, i.e. at
        a pre-money of <strong>{usdCompact(KINK)}</strong> for this note — below it the discount
        binds (the SAFE pays a fixed 80% of an ever-cheaper round price); above it the cap binds (the
        SAFE&rsquo;s price is pinned no matter how rich the round). Same note, five round valuations:
      </p>
      <table>
        <thead>
          <tr>
            <th scope="col">Series A pre-money</th>
            <th scope="col">Binding term</th>
            <th scope="col" className="text-right">SAFE % of pre-round table</th>
            <th scope="col" className="text-right">SAFE % after the round</th>
            <th scope="col" className="text-right">Founders after the round</th>
          </tr>
        </thead>
        <tbody>
          {LADDER.map((l) => (
            <tr key={l.pre}>
              <td>{usdCompact(l.pre)}{l.pre === KINK ? ' (the tie)' : ''}</td>
              <td>
                {l.binding === 'discount'
                  ? `Discount (pays 80% — effective cap ${usdCompact(effectiveCap(CANON_SAFE, l.pre))})`
                  : l.binding === 'cap'
                    ? `Cap (pinned at ${usdCompact(10_000_000)})`
                    : 'Round price'}
              </td>
              <td className="text-right">{pct(l.pctPre, 2)}</td>
              <td className="text-right">{pct(l.after, 2)}</td>
              <td className="text-right">{pct(l.founders, 2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p>
        Two facts fall out of the table. First, at the {usdCompact(CANON_ROUND.preMoney)} round the
        SAFE converted at {usd(canon.safePrice, 2)} against a {usd(CANON.roundPrice, 3)} round price
        — an <em>effective</em> discount of {pct(canon.effectiveDiscountPct, 2)}, not the 20% on the
        front of the note, because the cap was doing the work. Second, the SAFE holder&rsquo;s
        worst-case row is not the cheap round: the stack&rsquo;s post-round take bottoms at{' '}
        {pct(valley, 2)} exactly at the {usdCompact(KINK)} crossover and rises in{' '}
        <em>both</em> directions — back up to {pct(LADDER[4].after, 2)} at a{' '}
        {usdCompact(30_000_000)} round above the tie, {pct(LADDER[0].after, 2)} at{' '}
        {usdCompact(8_000_000)} below it. Past the crossover the cap pins the SAFE&rsquo;s price, so
        a richer round stops shrinking what the stack takes and starts handing it back.
      </p>
      <p>
        Keep the two lines separate, because they do not peak together. The stack&rsquo;s minimum at
        the crossover is the <em>holder&rsquo;s</em> low point, not the founders&rsquo; high point:
        the founders&rsquo; column rises monotonically with the round&rsquo;s valuation —{' '}
        {pct(LADDER[0].founders, 2)} at an {usdCompact(8_000_000)} round,{' '}
        {pct(LADDER[3].founders, 2)} at {usdCompact(15_000_000)},{' '}
        {pct(LADDER[4].founders, 2)} at {usdCompact(30_000_000)} — because the new investor&rsquo;s
        slice (<code>investment ÷ post-money</code>) shrinks as the round prices up. What the
        crossover actually marks is where the SAFE stops helping: below it, every extra dollar of
        valuation shrinks the investor&rsquo;s slice <em>and</em> the SAFE&rsquo;s bite; above it
        the bite is pinned and climbs back ({pct(LADDER[3].after, 2)} → {pct(LADDER[4].after, 2)}{' '}
        from {usdCompact(15_000_000)} to {usdCompact(30_000_000)}), so the whole marginal benefit of
        a richer round comes from the investor&rsquo;s smaller slice alone. &ldquo;We&apos;ll
        dilute less if the Series A is huge&rdquo; stays true for the founders&rsquo; line — but
        past {usdCompact(KINK)} it is true despite the capped stack, not because of it.
      </p>
      <h3>Mixed stacks: read every note, not the average</h3>
      <p>
        Real seed rounds stack SAFEs with different terms, and the terms do not flip together. Take
        the calculator&rsquo;s two-SAFE stack — {usdCompact(500_000)} at an {usdCompact(8_000_000)}{' '}
        cap and {usdCompact(1_000_000)} at a {usdCompact(16_000_000)} cap, both 15% off — converting
        at the same {usdCompact(CANON_ROUND.preMoney)} pre: the tight note binds on its{' '}
        <strong>cap</strong> (effective cap {usdCompact(m1.effectiveCap)}, claiming{' '}
        {pct(m1.pctOfPreRound, 2)} of the pre-round table), while the loose note binds on its{' '}
        <strong>discount</strong> (effective cap{' '}
        {`$${(m2.effectiveCap / 1_000_000).toFixed(2)}M`} = 0.85 ×{' '}
        {usdCompact(CANON_ROUND.preMoney)}, claiming {pct(m2.pctOfPreRound, 2)}). Together the stack
        owns {pct(MIXED.stackPctOfPreRound, 2)} of the pre-round table and costs existing holders{' '}
        <strong>{pts(MIXED.foundersExtraDilutionPts, 2)}</strong> at the close. A single
        &ldquo;blended&rdquo; cap quoted in a summary memo hides which term is paying on which note
        — and therefore which valuations each note is sensitive to.
      </p>

      <h2 id="control">Majority is a line, not a vibe</h2>
      <p>
        The 50% line is where ordinary shareholder votes stop being a formality, and it crosses
        earlier than founders expect. On the standard path above, founders start the Series A at{' '}
        {pct(stdTrail[1], 2)} and <em>close</em> it at <strong>{pct(stdAtCrossing, 2)}</strong> — the
        crossing happens at the first institutional round, not after a decade of dilution. The
        presets bracket the outcomes: the founder-friendly path ({usdCompact(35_000_000)} raised,
        lean pools) never crosses and finishes at <strong>{pct(friendlyFinal, 2)}</strong>; the heavy
        path survives exactly one round ({pct(heavySeed, 2)} after the seed) and finishes at{' '}
        <strong>{pct(heavyFinal, 2)}</strong>. And majority cannot be rescued by pool negotiation
        alone on a normal path: zero out every pool on the standard path and the money alone still
        ends founders at {pct(foundersPct(stdNoPoolFinal), 2)}. Majority is priced into the rounds.
      </p>
      <p>
        Two engine scans put numbers on the lever you do control. With the seed pool fixed at{' '}
        {pct(10, 0)}, Series A pool targets through <strong>{pct(aTargetKeep, 1)}</strong> keep
        founders above water at the A close ({pct(aKeepPct, 2)}); at {pct(aTargetKeep + 0.5, 1)} they
        dip under ({pct(aLosePct, 2)}). And on the SAFE side, each {usdCompact(500_000)} note at an{' '}
        {usdCompact(8_000_000)} cap with 20% off claims {pct(kEachPct, 2)} of the pre-round table
        ({usdCompact(500_000)} ÷ {usdCompact(8_000_000)}): six of them ({usdCompact(3_000_000)} on
        SAFEs) leave founders at {pct(kLastAbove, 2)}; the seventh crosses to{' '}
        {pct(kCross, 2)}. A seed stack can erase majority before any priced round exists.
      </p>
      <p>
        Be precise about what the line buys. This model tracks share percentages, and 50% of shares
        governs ordinary matters; but board composition, protective provisions, and class-vote
        vetoes live in the charter and the documents, not in the percentages — a founder majority
        with a three-seat board controlled by investors is a different company than the cap table
        implies. The instruments flag where the vote crosses; what the votes control is a question
        for counsel, and worth asking at every term sheet rather than once.
      </p>

      <h2 id="protocol">The five-check protocol</h2>
      <p>
        Before signing any financing document, run the same five checks. Each takes minutes with the
        two instruments and converts a narrative into a number.
      </p>
      <ol>
        <li>
          <strong>Translate the term sheet into points.</strong> Headline valuations are not
          comparable across structures. Same company, same {usdCompact(10_000_000)} raised: one sheet
          prices both rounds strictly higher ({usdCompact(10_000_000)} and {usdCompact(40_000_000)}{' '}
          post) but demands {pct(30, 0)} pools — founders finish at{' '}
          <strong>{pct(valXFounders, 2)}</strong>; the other prices lower ({usdCompact(7_000_000)} and{' '}
          {usdCompact(25_000_000)} post) with {pct(5, 0)} pools — founders finish at{' '}
          <strong>{pct(valYFounders, 2)}</strong>. The &ldquo;worse&rdquo; valuation is{' '}
          {pts(valYFounders - valXFounders, 1)} better. Points are the currency; the exchange rate is
          computable.
        </li>
        <li>
          <strong>Split the pool negotiation in two.</strong> Placement (which side of the price) is
          worth {pts(movingPoolGap, 1)} on its own in the canonical deal; size is worth{' '}
          {pts(shrinkPoolGap, 1)} more on the way to zero. Ask for both separately — a hiring plan
          justifies size, one sentence moves placement.
        </li>
        <li>
          <strong>Check top-up exposure.</strong> A pool target over an empty pool costs founders
          roughly the full target; over a pool already carrying most of it, nearly nothing. Enter
          what is unallocated <em>today</em> and let the engine say whether the round mints shares.
        </li>
        <li>
          <strong>Sum the SAFE ledger as pre-sold ownership.</strong> Each capped note is{' '}
          <code>amount ÷ cap</code> of the pre-round table, already sold. Read it note by note —
          which term binds at your expected Series A, where each note&rsquo;s crossover sits — and
          re-check the total every time the stack grows.
        </li>
        <li>
          <strong>Map the control crossings.</strong> Where does the founders&rsquo; line cross 50%
          — this round, this SAFE, this pool top-up? Then ask the documents question the math cannot
          answer: what do the board seats and veto rights say about who decides, at every stage of
          the plan.
        </li>
      </ol>
      <p>
        Two honest limits to carry out of this guide. The model prices ownership, not proceeds:
        liquidation preferences, participation, and debt sit between your percentage and your payout,
        especially in a flat or down exit — treat &ldquo;stake × valuation&rdquo; as a ceiling. And
        the SAFE engine covers the YC post-money form; pre-money SAFEs (pre-2018 paper) and
        convertible notes compute their percentages against different denominators and need
        document-level math. Neither limit changes the reading discipline: three passes, five
        checks, and every term priced in points before the signature.
      </p>
    </>
  );
}

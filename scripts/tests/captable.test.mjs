// captable.test.mjs — regression matrix for lib/captable.ts (cap table &
// dilution engine).
//
// RUN PREREQUISITE (the unified runner compiles; this file never compiles):
//   npx tsc lib/captable.ts \
//     --outDir scripts/tests/.build --module commonjs --target es2020 \
//     --skipLibCheck
//   then: node scripts/tests/captable.test.mjs
// The compiled engine is resolved from the first existing candidate —
// <testsDir>/.build/lib/captable.js (rootDir-projected layout) or
// <testsDir>/.build/captable.js (flat layout, when several lib files share
// lib/ as their common root) — matching the sibling tests in this directory.
// Override the build dir with the CALC_TEST_BUILD env var (absolute, or
// relative to this file's directory).
//
// Assertion policy: every expected value below was (1) hand-derived from the
// exact per-round formulas in lib/captable.ts:159-177 — f = inv/post,
// T_topup = nonPool/(1 - f - pool), investor shares = f*T, price =
// pre/(sharesBefore + topUp) — and (2) confirmed against the compiled engine
// before being written in. Closed forms are asserted as the expression; any
// mismatch throws with input / expected / actual and a non-zero exit code.

import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const TESTS_DIR = path.dirname(fileURLToPath(import.meta.url));
const BUILD_DIR = process.env.CALC_TEST_BUILD
  ? path.resolve(TESTS_DIR, process.env.CALC_TEST_BUILD)
  : path.join(TESTS_DIR, '.build');

async function loadLib(name) {
  const candidates = [
    path.join(BUILD_DIR, 'lib', `${name}.js`), // rootDir-projected layout
    path.join(BUILD_DIR, `${name}.js`), // flat layout (common root = lib/)
  ];
  const file = candidates.find((f) => existsSync(f)) ?? candidates[0];
  if (!existsSync(file)) {
    throw new Error(`Compiled lib not found at ${file} — run the tsc step in this file's header first.`);
  }
  try {
    const mod = await import(pathToFileURL(file).href);
    const names = Object.keys(mod).filter((k) => k !== 'default');
    if (names.length > 0) return mod; // ESM output, or CJS with statically-named exports
    if (mod.default && typeof mod.default === 'object') return mod.default;
    return mod;
  } catch {
    return createRequire(import.meta.url)(file); // plain CJS fallback
  }
}

const {
  MAX_FOUNDERS,
  MAX_ROUNDS,
  DEFAULT_EXIT_VALUATION,
  ROUND_NAMES,
  classifyRound,
  simulateCapTable,
  stakePct,
  foundersPct,
  founderPct,
  finalStage,
  poolSensitivity,
  postMoneyPoolRound,
  CAP_TABLE_PRESETS,
  DEFAULT_FOUNDERS,
  DEFAULT_ROUNDS,
} = await loadLib('captable');

let passed = 0;
const show = (v) => (typeof v === 'number' ? String(v) : JSON.stringify(v));

function assertEq(input, actual, expected) {
  if (actual !== expected) {
    throw new Error(
      `assertion failed\n  input:    ${input}\n  expected: ${show(expected)}\n  actual:   ${show(actual)}`,
    );
  }
  passed += 1;
}

function assertClose(input, actual, expected, tol) {
  if (typeof actual !== 'number' || !Number.isFinite(actual) || Math.abs(actual - expected) > tol) {
    throw new Error(
      `assertion failed (tolerance ${tol})\n  input:    ${input}\n  expected: ${show(expected)}\n  actual:   ${show(actual)}`,
    );
  }
  passed += 1;
}

const FOUNDERS_10M = [{ name: 'You', shares: 6_000_000 }, { name: 'Cofounder', shares: 4_000_000 }];

// ---------------------------------------------------------------------------
// 1. Module constants the UI depends on (lib/captable.ts:39-46, 500-510).
// ---------------------------------------------------------------------------
assertEq('MAX_FOUNDERS', MAX_FOUNDERS, 5);
assertEq('MAX_ROUNDS', MAX_ROUNDS, 4);
assertEq('DEFAULT_EXIT_VALUATION', DEFAULT_EXIT_VALUATION, 100_000_000);
assertEq('ROUND_NAMES', JSON.stringify(ROUND_NAMES), JSON.stringify(['Seed', 'Series A', 'Series B', 'Series C']));
assertEq('DEFAULT_FOUNDERS = standard preset 6M/4M', JSON.stringify(DEFAULT_FOUNDERS.map((f) => f.shares)), JSON.stringify([6_000_000, 4_000_000]));
assertEq('DEFAULT_ROUNDS investment chain', JSON.stringify(DEFAULT_ROUNDS.map((r) => r.investment)), JSON.stringify([1_500_000, 6_000_000, 15_000_000, 30_000_000]));

// ---------------------------------------------------------------------------
// 2. classifyRound — every branch (lib/captable.ts:139-157).
// ---------------------------------------------------------------------------
assertEq('classify: investment 0 -> empty', classifyRound({ name: 'X', investment: 0, postMoney: 0, poolPct: 0 }).state, 'empty');
assertEq('classify: negative investment -> empty', classifyRound({ name: 'X', investment: -5, postMoney: 10, poolPct: 0 }).state, 'empty');
assertEq('classify: postMoney <= investment -> invalid', classifyRound({ name: 'X', investment: 12, postMoney: 10, poolPct: 0 }).state, 'invalid');
assertEq('classify: f + pool >= 1 -> invalid (0.6 + 0.4)', classifyRound({ name: 'X', investment: 60, postMoney: 100, poolPct: 40 }).state, 'invalid');
assertEq('classify: f + pool < 1 -> modeled (0.6 + 0.3)', classifyRound({ name: 'X', investment: 60, postMoney: 100, poolPct: 30 }).state, 'modeled');
assertEq('classify: no pool -> modeled (f = 0.25)', classifyRound({ name: 'X', investment: 25, postMoney: 100, poolPct: 0 }).state, 'modeled');

// ---------------------------------------------------------------------------
// 3. One priced round with the option-pool shuffle (seed-only preset shape,
//    lib/captable.ts:495). Hand: f = 1.5M/8M = 0.1875, pool 12% ->
//    T = 10M/(1 - 0.1875 - 0.12) = 10M/0.6925 = 14,440,433.213;
//    topUp = 0.12*T = 1,732,851.986; investor = 0.1875*T = 2,707,581.227;
//    price = 6.5M/(10M + topUp) = 0.554; founders end at exactly the
//    residual 1 - f - pool = 69.25% (You 41.55, cofounder 27.70).
// ---------------------------------------------------------------------------
{
  const sim = simulateCapTable(FOUNDERS_10M, [
    { name: 'Seed', investment: 1_500_000, postMoney: 8_000_000, poolPct: 12 },
  ]);
  assertEq('seed round: valid', sim.valid, true);
  assertEq('seed round: 2 stages', sim.stages.length, 2);
  assertEq('seed round: modeledRounds 1', sim.modeledRounds, 1);
  assertEq('seed round: no halt', sim.haltedAt, null);
  assertEq('founding stage: 10M shares', sim.stages[0].shares, 10_000_000);
  assertEq('founding stage: founders 100%', foundersPct(sim.stages[0]), 100);

  const st = sim.stages[1];
  const T = 10_000_000 / 0.6925;
  assertClose('seed round: sharesAfter = 10M/0.6925', st.shares, T, 1e-6);
  assertClose('seed round: investorPct = 1.5/8', st.round.investorPct, 0.1875, 1e-15);
  assertClose('seed round: poolPctAfter = 0.12', st.round.poolPctAfter, 0.12, 1e-12);
  assertEq('seed round: topUpApplied', st.round.topUpApplied, true);
  assertClose('seed round: poolTopUp = 0.12*T', st.round.poolTopUp, 0.12 * T, 1e-6);
  assertClose('seed round: investorShares = 0.1875*T', st.round.investorShares, 0.1875 * T, 1e-6);
  assertEq('seed round: preMoney = 6.5M', st.round.preMoney, 6_500_000);
  assertClose('seed round: pricePerShare = 6.5M/(10M + topUp)', st.round.pricePerShare, 6_500_000 / (10_000_000 + 0.12 * T), 1e-12);
  assertClose('seed round: foundersPct = 69.25 (residual)', foundersPct(st), 69.25, 1e-9);
  assertClose('seed round: You 6M -> 41.55%', founderPct(st, 0), 41.55, 1e-9);
  assertClose('seed round: cofounder 4M -> 27.70%', founderPct(st, 1), 27.7, 1e-9);
  assertEq('finalStage returns the last stage', finalStage(sim) === st, true);
}

// ---------------------------------------------------------------------------
// 4. No-top-up branch — an existing pool diluted above target stays put
//    (lib/captable.ts:239-253). Hand: after round 1 the pool is 12%; round 2
//    (f = 0.01, target 5%) would leave the diluted pool at 0.12*0.99 = 11.88%
//    > 5%, so no shares are added and T2 = T1/0.99, price = 99M/T1, founders
//    = 69.25*0.99 = 68.5575%.
// ---------------------------------------------------------------------------
{
  const sim = simulateCapTable(FOUNDERS_10M, [
    { name: 'Seed', investment: 1_500_000, postMoney: 8_000_000, poolPct: 12 },
    { name: 'A', investment: 1_000_000, postMoney: 100_000_000, poolPct: 5 },
  ]);
  const T1 = 10_000_000 / 0.6925;
  const st = sim.stages[2];
  assertEq('no-top-up: topUpApplied false', st.round.topUpApplied, false);
  assertEq('no-top-up: poolTopUp 0', st.round.poolTopUp, 0);
  assertClose('no-top-up: sharesAfter = T1/0.99', st.shares, T1 / 0.99, 1e-6);
  assertClose('no-top-up: poolPctAfter = 0.12*0.99', st.round.poolPctAfter, 0.1188, 1e-9);
  assertClose('no-top-up: investorShares = 0.01*T2', st.round.investorShares, 0.01 * (T1 / 0.99), 1e-6);
  assertClose('no-top-up: pricePerShare = 99M/T1', st.round.pricePerShare, 99_000_000 / T1, 1e-12);
  assertClose('no-top-up: foundersPct = 68.5575', foundersPct(st), 68.5575, 1e-9);
  assertEq('no-top-up: 3 stages / 2 rounds', sim.stages.length === 3 && sim.modeledRounds === 2, true);
}

// ---------------------------------------------------------------------------
// 5. Chain halts. First empty or invalid round stops the walk; later rounds
//    are ignored (lib/captable.ts:211-221).
// ---------------------------------------------------------------------------
{
  const invalid = simulateCapTable(FOUNDERS_10M, [
    { name: 'Seed', investment: 5, postMoney: 10, poolPct: 0 },
    { name: 'A', investment: 12, postMoney: 10, poolPct: 0 }, // post <= inv -> invalid
    { name: 'B', investment: 1, postMoney: 10, poolPct: 0 },
  ]);
  assertEq('halt: haltedAt = 1', invalid.haltedAt, 1);
  assertEq('halt: stages stop at 2', invalid.stages.length, 2);
  assertEq('halt: modeledRounds 1', invalid.modeledRounds, 1);
  assertEq('halt: reason cites post-money', invalid.haltReason.includes('Post-money must exceed'), true);
  assertClose('halt: round 1 investor 50%', invalid.stages[1].round.investorPct, 0.5, 1e-15);

  const empty = simulateCapTable(FOUNDERS_10M, [
    { name: 'Seed', investment: 2, postMoney: 10, poolPct: 0 },
    { name: 'A', investment: 0, postMoney: 0, poolPct: 0 }, // no money -> empty
    { name: 'B', investment: 1, postMoney: 10, poolPct: 0 },
  ]);
  assertEq('halt: empty round halts at index 1', empty.haltedAt, 1);
  assertEq('halt: empty-round reason', empty.haltReason.includes('no investment entered'), true);
}

// ---------------------------------------------------------------------------
// 6. Degenerate founder tables (lib/captable.ts:190-198, 180-188): no
//    positive-share founder -> invalid simulation; zero/negative share rows
//    are dropped; a blank name defaults to "Founder <slot>".
// ---------------------------------------------------------------------------
{
  const sim = simulateCapTable([], DEFAULT_ROUNDS);
  assertEq('no founders: valid false', sim.valid, false);
  assertEq('no founders: no stages', sim.stages.length, 0);
  assertEq('no founders: modeledRounds 0', sim.modeledRounds, 0);
  assertEq('no founders: finalStage null', finalStage(sim), null);

  const sim2 = simulateCapTable(
    [{ name: 'A', shares: 6_000_000 }, { name: 'B', shares: 0 }, { name: 'C', shares: -5 }],
    [],
  );
  assertEq('filtered: zero/negative rows dropped', sim2.stages[0].stakes.length, 1);
  assertEq('filtered: shares sum', sim2.stages[0].shares, 6_000_000);

  const sim3 = simulateCapTable([{ name: '   ', shares: 6_000_000 }, { name: 'B', shares: 4_000_000 }], []);
  assertEq('blank name -> "Founder 1"', sim3.stages[0].stakes[0].name, 'Founder 1');
  assertEq('named founder preserved', sim3.stages[0].stakes[1].name, 'B');
}

// ---------------------------------------------------------------------------
// 7. stakePct (lib/captable.ts:317-319).
// ---------------------------------------------------------------------------
assertEq('stakePct(25, 200) = 12.5', stakePct(25, 200), 12.5);
assertEq('stakePct(x, 0) = 0', stakePct(10, 0), 0);

// ---------------------------------------------------------------------------
// 8. The guide's worked 70% vs 72% example (lib/captable.ts:404 JSDoc,
//    CapTableArticle.tsx:40-41). Default (pre-money pool) model: one round
//    2M @ 10M post, 10% pool on 10M shares -> T = 10M/0.7, price exactly
//    0.70, founders 70%. Pro-founder post-money pool: close first, then
//    carve -> founders 72%. The 2-point gap IS the option-pool shuffle.
// ---------------------------------------------------------------------------
{
  const sim = simulateCapTable([{ name: 'You', shares: 10_000_000 }], [
    { name: 'Seed', investment: 2_000_000, postMoney: 10_000_000, poolPct: 10 },
  ]);
  const st = sim.stages[1];
  assertClose('shuffle: T = 10M/0.7', st.shares, 10_000_000 / 0.7, 1e-6);
  assertClose('shuffle: foundersPct = 70', foundersPct(st), 70, 1e-9);
  assertClose('shuffle: investorPct = 0.2', st.round.investorPct, 0.2, 1e-15);
  assertClose('shuffle: poolPctAfter = 0.1', st.round.poolPctAfter, 0.1, 1e-12);
  assertClose('shuffle: pricePerShare = 0.70 exact', st.round.pricePerShare, 0.7, 1e-12);
  assertClose('shuffle: sole founder 70%', founderPct(st, 0), 70, 1e-9);

  const post = postMoneyPoolRound(10_000_000, 2_000_000, 10_000_000, 10);
  assertClose('post-pool: sharesAfterClose = 10M/0.8', post.sharesAfterClose, 12_500_000, 1e-9);
  assertClose('post-pool: sharesFinal = 12.5M/0.9', post.sharesFinal, 12_500_000 / 0.9, 1e-6);
  assertClose('post-pool: foundersPct = 72 (article anchor)', post.foundersPct, 72, 1e-9);
  assertClose('post-pool: investorPct = 18', post.investorPct, 18, 1e-9);
  assertClose('post-pool: poolPct = 10', post.poolPct, 10, 1e-12);
  assertEq('post-pool costs founders less than the shuffle (72 > 70)', post.foundersPct > foundersPct(st), true);
  assertEq('post-pool: null on zero shares', postMoneyPoolRound(0, 2, 10, 10), null);
  assertEq('post-pool: null when post <= investment', postMoneyPoolRound(10, 5, 4, 10), null);
  assertEq('post-pool: null on zero investment', postMoneyPoolRound(10, 0, 10, 10), null);
}

// ---------------------------------------------------------------------------
// 9. UI-default regression anchor — the full "Standard path" preset walked
//    through 4 rounds (lib/captable.ts:459-464). Hand chain:
//    Seed  f=.25 pool .10: T0 = 10M/0.65 = 15,384,615.38, price = 4.5M/11.538M = 0.39
//    A     f=.20 pool .12: top-up fires, T1 = 13.846M/0.68 = 20,361,990.95
//    B     f=1/6 pool .08: diluted pool 12%*(5/6) = 10% > 8% -> flat, T2 = T1*1.2
//    C     f=.12 pool .05: pool 10%*0.88 = 8.8% > 5% -> flat, T3 = T2/0.88
//    Founders end at 10M/27,766,351.30 = 36.0148% (You 21.6089, cofounder 14.4059).
// ---------------------------------------------------------------------------
{
  const sim = simulateCapTable(DEFAULT_FOUNDERS, DEFAULT_ROUNDS);
  assertEq('standard: valid', sim.valid, true);
  assertEq('standard: 5 stages (founding + 4 rounds)', sim.stages.length, 5);
  assertEq('standard: modeledRounds 4', sim.modeledRounds, 4);
  assertEq('standard: haltedAt null', sim.haltedAt, null);

  const r0 = sim.stages[1].round;
  assertClose('standard: Seed sharesAfter = 10M/0.65', r0.sharesAfter, 10_000_000 / 0.65, 1e-6);
  assertClose('standard: Seed pricePerShare = 0.39', r0.pricePerShare, 0.39, 1e-12);
  assertClose('standard: Seed investorPct = 0.25', r0.investorPct, 0.25, 1e-15);
  assertClose('standard: Seed poolPctAfter = 0.10', r0.poolPctAfter, 0.1, 1e-12);

  const r1 = sim.stages[2].round;
  const T1 = (10_000_000 / 0.65 - (10_000_000 / 0.65) * 0.1) / 0.68; // nonPool/denom
  assertEq('standard: A tops the pool up', r1.topUpApplied, true);
  assertClose('standard: A sharesAfter', r1.sharesAfter, T1, 1e-4);
  assertClose('standard: A poolPctAfter back at 0.12', r1.poolPctAfter, 0.12, 1e-12);

  const r2 = sim.stages[3].round;
  assertEq('standard: B needs no top-up (10% > 8%)', r2.topUpApplied, false);
  assertClose('standard: B sharesAfter = T1*6/5', r2.sharesAfter, T1 * 1.2, 1e-4);
  assertClose('standard: B poolPctAfter = 0.10', r2.poolPctAfter, 0.1, 1e-9);

  const r3 = sim.stages[4].round;
  assertEq('standard: C needs no top-up (8.8% > 5%)', r3.topUpApplied, false);
  assertClose('standard: C sharesAfter = T2/0.88', r3.sharesAfter, (T1 * 1.2) / 0.88, 1e-4);

  const final = finalStage(sim);
  assertClose('standard: final founders 36.0148%', foundersPct(final), 36.01481481481482, 1e-9);
  assertClose('standard: final You 21.6089%', founderPct(final, 0), 21.608888888888888, 1e-9);
  assertClose('standard: final cofounder 14.4059%', founderPct(final, 1), 14.405925925925924, 1e-9);
  assertClose('standard: You + cofounder = founders', founderPct(final, 0) + founderPct(final, 1), foundersPct(final), 1e-9);
}

// ---------------------------------------------------------------------------
// 10. poolSensitivity — the negotiation lever (lib/captable.ts:371-388).
//     Default shifts [-4,-2,0,2,4]; the 0-shift row equals the unshifted
//     final ownership; founder ownership falls monotonically as the pool
//     target rises. A shift that pushes f + pool >= 100% marks the row
//     infeasible with NaN instead of a pre-halt snapshot.
// ---------------------------------------------------------------------------
{
  const rows = poolSensitivity(DEFAULT_FOUNDERS, DEFAULT_ROUNDS);
  assertEq('sensitivity: 5 default rows', rows.length, 5);
  assertEq('sensitivity: shift ladder', JSON.stringify(rows.map((r) => r.shiftPct)), JSON.stringify([-4, -2, 0, 2, 4]));
  assertEq('sensitivity: standard path always feasible', rows.some((r) => r.infeasible), false);
  assertClose('sensitivity: shift 0 row == final founders 36.0148', rows[2].foundersPct, 36.01481481481482, 1e-6);
  assertEq('sensitivity: leaner pool -> more founder', rows[0].foundersPct > rows[2].foundersPct, true);
  assertEq('sensitivity: fatter pool -> less founder', rows[2].foundersPct > rows[4].foundersPct, true);

  const infeasibleRows = poolSensitivity(
    [{ name: 'You', shares: 10_000_000 }],
    [{ name: 'Seed', investment: 85, postMoney: 100, poolPct: 12 }],
    [0, 4],
  );
  assertEq('sensitivity: 0-shift feasible', infeasibleRows[0].infeasible, false);
  assertClose('sensitivity: f=.85 pool=.12 -> founders 3%', infeasibleRows[0].foundersPct, 3, 1e-9);
  assertClose('sensitivity: sole founder you = 3%', infeasibleRows[0].youPct, 3, 1e-9);
  assertEq('sensitivity: +4 shift (0.85 + 0.16 >= 1) infeasible', infeasibleRows[1].infeasible, true);
  assertEq('sensitivity: infeasible foundersPct is NaN', Number.isNaN(infeasibleRows[1].foundersPct), true);
  assertEq('sensitivity: infeasible youPct is NaN', Number.isNaN(infeasibleRows[1].youPct), true);
}

// ---------------------------------------------------------------------------
// 11. MAX_ROUNDS cap — a fifth round is ignored even when valid
//     (rounds.slice(0, MAX_ROUNDS), lib/captable.ts:211).
// ---------------------------------------------------------------------------
{
  const five = [1, 2, 3, 4, 5].map((i) => ({ name: `R${i}`, investment: 1, postMoney: 100, poolPct: 0 }));
  const sim = simulateCapTable([{ name: 'You', shares: 1_000_000 }], five);
  assertEq('cap: 4 rounds modeled from 5 supplied', sim.modeledRounds, 4);
  assertEq('cap: 5 stages', sim.stages.length, 5);
  assertEq('cap: no halt recorded', sim.haltedAt, null);
}

// ---------------------------------------------------------------------------
// 12. Preset shape invariants (lib/captable.ts:453-497).
// ---------------------------------------------------------------------------
assertEq('presets: 4 archetypes', CAP_TABLE_PRESETS.length, 4);
assertEq('presets: rounds always padded to MAX_ROUNDS', CAP_TABLE_PRESETS[3].rounds.length, MAX_ROUNDS);
assertEq('presets: standard path raises $52.5M total', CAP_TABLE_PRESETS[0].rounds.reduce((a, r) => a + r.investment, 0), 52_500_000);
assertEq('presets: standard pools 10/12/8/5', JSON.stringify(CAP_TABLE_PRESETS[0].rounds.map((r) => r.poolPct)), JSON.stringify([10, 12, 8, 5]));

console.log(`captable.test: ${passed} assertions passed`);

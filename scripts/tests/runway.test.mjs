// runway.test.mjs — regression matrix for lib/runway.ts (SaaS runway engine).
//
// RUN PREREQUISITE (the unified runner compiles; this file never compiles):
//   npx tsc lib/runway.ts \
//     --outDir scripts/tests/.build --module commonjs --target es2020 \
//     --skipLibCheck
//   then: node scripts/tests/runway.test.mjs
// The compiled engine is resolved from the first existing candidate —
// <testsDir>/.build/lib/runway.js (rootDir-projected layout) or
// <testsDir>/.build/runway.js (flat layout, when several lib files share
// lib/ as their common root) — matching the sibling tests in this directory.
// Override the build dir with the CALC_TEST_BUILD env var (absolute, or
// relative to this file's directory).
//
// Assertion policy: every expected value below was (1) hand-derived from the
// closed-form model documented in lib/runway.ts — cash(M) recursions solved
// analytically — and (2) confirmed against the compiled engine before being
// written in. Engine-exact literals (compounding paths) are locked at 1e-9;
// values with a closed form are asserted as that form. Any mismatch throws
// with input / expected / actual and a non-zero exit code.

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

const { computeRunway, breakevenGrowthThreshold, RUNWAY_PRESETS } = await loadLib('runway');

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

// ---------------------------------------------------------------------------
// 1. Flat textbook case — RunwayArticle PROFILE (components/content/
//    RunwayArticle.tsx:11). No growth, 100% margin: monthsExact must equal
//    the naive cash / net-burn division (JSDoc contract, lib/runway.ts:57).
//    Hand: burn 40k/mo from 500k -> zero crossing at 12.5 months; the whole
//    month whose end first hits <= 0 is month 13.
// ---------------------------------------------------------------------------
{
  const r = computeRunway({ cash: 500_000, grossBurn: 50_000, mrr: 10_000, growthRate: 0, grossMargin: 100 });
  assertEq('flat: initialNetBurn = 50k - 10k*1.0', r.initialNetBurn, 40_000);
  assertEq('flat: breakevenMrr = 50k/1.0', r.breakevenMrr, 50_000);
  assertEq('flat: months (whole-month ceiling)', r.months, 13);
  assertClose('flat: monthsExact = 12.5', r.monthsExact, 12.5, 1e-9);
  assertClose('flat: monthsExact == naive 500k/40k (JSDoc contract)', r.monthsExact, 500_000 / 40_000, 1e-12);
  assertEq('flat: points.length = months + 1', r.points.length, 14);
  assertEq('flat: points[12].cash (20k left entering month 13)', r.points[12].cash, 20_000);
  assertEq('flat: points[13].cash clamped at 0', r.points[13].cash, 0);
  assertEq('flat: points[13].netBurn constant', r.points[13].netBurn, 40_000);
  assertEq('flat: points[13].mrr (no growth)', r.points[13].mrr, 10_000);
  assertEq('flat: never profitable', r.reachedProfitability, false);
  assertEq('flat: profitableAtMonth null', r.profitableAtMonth, null);
  assertEq('flat: finalCash 0', r.finalCash, 0);
}

// ---------------------------------------------------------------------------
// 2. UI-default regression anchor — RUNWAY_PRESETS[0] "Seed baseline"
//    (lib/runway.ts:231; the calculator's DEFAULTS). Hand: netBurn_m =
//    50k - 8k*1.08^(m-1); cash(M) = 500k - 50k*M + 100k*(1.08^M - 1);
//    cash(13) = +21,962.37 > 0, cash(14) = -6,280.63 <= 0 -> dies month 14,
//    monthsExact = 13 + 21962.37/28243.01 = 13.7776.
// ---------------------------------------------------------------------------
{
  const r = computeRunway(RUNWAY_PRESETS[0].inputs);
  assertEq('seed: initialNetBurn = 50k - 0.8*10k', r.initialNetBurn, 42_000);
  assertEq('seed: breakevenMrr = 50k/0.8 (JSDoc 62.5k anchor)', r.breakevenMrr, 62_500);
  assertEq('seed: months = 14', r.months, 14);
  assertClose('seed: monthsExact = 13.7776', r.monthsExact, 13.777621523632567, 1e-9);
  assertEq('seed: points[1].cash = 500k - 42k', r.points[1].cash, 458_000);
  assertEq('seed: points[1].netBurn', r.points[1].netBurn, 42_000);
  assertClose('seed: points[2].mrr = 10k*1.08 (MRR during month 2)', r.points[2].mrr, 10_800, 1e-9);
  assertEq('seed: dies before break-even', r.reachedProfitability, false);
  assertEq('seed: profitableAtMonth null', r.profitableAtMonth, null);
}

// ---------------------------------------------------------------------------
// 3. Boundary — out of cash today (lib/runway.ts:103 early return).
// ---------------------------------------------------------------------------
{
  const r = computeRunway({ cash: 0, grossBurn: 10_000, mrr: 0, growthRate: 5 });
  assertEq('zero-cash: months = 0 (not 1)', r.months, 0);
  assertEq('zero-cash: monthsExact = 0', r.monthsExact, 0);
  assertEq('zero-cash: single point', r.points.length, 1);
  assertEq('zero-cash: finalCash 0', r.finalCash, 0);
  assertEq('zero-cash: breakevenMrr', r.breakevenMrr, 10_000);
  assertEq('zero-cash: initialNetBurn', r.initialNetBurn, 10_000);
  assertEq('zero-cash: profitableAtMonth null', r.profitableAtMonth, null);
}

// ---------------------------------------------------------------------------
// 4. Break-even reached in month 1 + projection tail stop (BREAKEVEN_TAIL = 2,
//    lib/runway.ts:70). Hand: netBurn = -10k every month; loop records months
//    1..3 then breaks -> 4 points, finalCash = 100k + 3*10k.
// ---------------------------------------------------------------------------
{
  const r = computeRunway({ cash: 100_000, grossBurn: 50_000, mrr: 60_000, growthRate: 0, grossMargin: 100 });
  assertEq('profitable: initialNetBurn negative', r.initialNetBurn, -10_000);
  assertEq('profitable: reachedProfitability', r.reachedProfitability, true);
  assertEq('profitable: profitableAtMonth = 1', r.profitableAtMonth, 1);
  assertEq('profitable: months null (countdown stops)', r.months, null);
  assertEq('profitable: monthsExact null', r.monthsExact, null);
  assertEq('profitable: points stop at month 3 (tail)', r.points.length, 4);
  assertEq('profitable: points[3].cash = 130k', r.points[3].cash, 130_000);
  assertEq('profitable: finalCash = 130k', r.finalCash, 130_000);
}

// ---------------------------------------------------------------------------
// 5. Collection-lag stress — RUNWAY_PRESETS[3] "Pre-raise", lag 0 vs lag 1.
//    Hand (lag 0): cash(M) = 1.2M*1.04^M - 140k*M -> cash(16) = +7,577.50,
//    cash(17) = -42,519.90 -> months 17, exact = 16 + 7577.5/50096.90.
//    Hand (lag 1): month 1 collects nothing (full 140k burn); for m >= 2
//    netBurn_m = 140k - 48k*1.04^(m-2); cash(M) = 1.2M*1.04^(M-1) - 140k*M
//    -> cash(14) = +38,087.75, cash(15) = -21,988.76 -> months 15,
//    exact = 14 + 38087.75/60076.49 = 14.6340.
// ---------------------------------------------------------------------------
{
  const PRE = RUNWAY_PRESETS[3].inputs;
  const onTime = computeRunway({ ...PRE, collectionLag: 0 });
  assertEq('pre lag0: months = 17', onTime.months, 17);
  assertClose('pre lag0: monthsExact', onTime.monthsExact, 16.15125676122892, 1e-9);
  assertEq('pre lag0: points[1].netBurn = 140k - 0.8*60k', onTime.points[1].netBurn, 92_000);
  assertEq('pre lag0: points[1].cash', onTime.points[1].cash, 1_108_000);

  const lagged = computeRunway({ ...PRE, collectionLag: 1 });
  assertEq('pre lag1: months = 15', lagged.months, 15);
  assertClose('pre lag1: monthsExact', lagged.monthsExact, 14.633995434933897, 1e-9);
  assertEq('pre lag1: month 1 collects nothing (full burn)', lagged.points[1].netBurn, 140_000);
  assertEq('pre lag1: points[1].cash = 1.2M - 140k', lagged.points[1].cash, 1_060_000);
  assertEq('pre lag1: month 2 bills month-1 MRR', lagged.points[2].netBurn, 92_000);
  assertEq('pre lag1: points[2].cash', lagged.points[2].cash, 968_000);
  assertEq('pre lag1: lag shortens runway', lagged.monthsExact < onTime.monthsExact, true);
  assertClose('pre lag1: lag cost ~1.517 months', Math.abs(lagged.monthsExact - onTime.monthsExact), 1.5172613262950243, 1e-6);
}

// ---------------------------------------------------------------------------
// 6. Input clamps — growth [-20, 50] (lib/runway.ts:77). Hand (g = -20):
//    cash(M) = 125k - 10k*M - 25k*0.8^M -> cash(12) = +3,282.01,
//    cash(13) = -6,374.39 -> months 13, exact = 12 + 3282.01/9656.40.
//    Hand (g = +50, clean powers of 1.5): break-even month 7 (1.5^6 = 11.390625
//    >= 10x MRR multiple), finalCash = 848,867.1875 (exact binary arithmetic).
// ---------------------------------------------------------------------------
{
  const below = computeRunway({ cash: 100_000, grossBurn: 10_000, mrr: 5_000, growthRate: -90, grossMargin: 100 });
  const atFloor = computeRunway({ cash: 100_000, grossBurn: 10_000, mrr: 5_000, growthRate: -20, grossMargin: 100 });
  assertEq('clamp: growthRate -90 clamps to -20 (identical output)', JSON.stringify(below), JSON.stringify(atFloor));
  assertEq('clamp floor: months = 13', atFloor.months, 13);
  assertClose('clamp floor: monthsExact = 12.3399', atFloor.monthsExact, 12.339879478104317, 1e-9);

  const above = computeRunway({ cash: 1_000_000, grossBurn: 100_000, mrr: 10_000, growthRate: 500, grossMargin: 100 });
  const atCap = computeRunway({ cash: 1_000_000, grossBurn: 100_000, mrr: 10_000, growthRate: 50, grossMargin: 100 });
  assertEq('clamp: growthRate 500 clamps to 50 (identical output)', JSON.stringify(above), JSON.stringify(atCap));
  assertEq('clamp cap: profitableAtMonth = 7', atCap.profitableAtMonth, 7);
  assertEq('clamp cap: survives (months null)', atCap.months, null);
  assertClose('clamp cap: finalCash = 848,867.1875', atCap.finalCash, 848_867.1875, 1e-6);
  assertEq('clamp cap: tail stops projection at month 9', atCap.points.length, 10);
}

// ---------------------------------------------------------------------------
// 7. Boundary — 0% gross margin: breakevenMrr = Infinity (lib/runway.ts:81)
//    and growth can never save the company. Hand: margin 0 -> collected money
//    contributes nothing -> flat 10k/mo burn, cash 100k dies exactly at the
//    END of month 10 (balance touches 0 -> "out of cash", not "one to go").
// ---------------------------------------------------------------------------
{
  const r = computeRunway({ cash: 100_000, grossBurn: 10_000, mrr: 5_000, growthRate: 0, grossMargin: 0 });
  assertEq('margin0: breakevenMrr = Infinity', Number.isFinite(r.breakevenMrr), false);
  assertEq('margin0: dies at exact month-10 zero crossing', r.months, 10);
  assertClose('margin0: monthsExact = 10.0', r.monthsExact, 10, 1e-9);
  assertEq(
    'margin0: breakevenGrowthThreshold null (no growth rate helps)',
    breakevenGrowthThreshold({ cash: 100_000, grossBurn: 10_000, mrr: 5_000, growthRate: 0, grossMargin: 0 }),
    null,
  );
  assertEq(
    'mrr0: threshold null (0 * anything stays 0)',
    breakevenGrowthThreshold({ cash: 100_000, grossBurn: 10_000, mrr: 0, growthRate: 0, grossMargin: 100 }),
    null,
  );
}

// ---------------------------------------------------------------------------
// 8. breakevenGrowthThreshold short-circuit at the floor: with $10M banked,
//    the company is profitable in month 1 and outlasts the horizon even while
//    shrinking 20%/mo -> returns the -20 clamp itself (lib/runway.ts:200).
// ---------------------------------------------------------------------------
{
  const inputs = { cash: 10_000_000, grossBurn: 50_000, mrr: 60_000, growthRate: -20, grossMargin: 100 };
  assertEq('threshold: survives at floor -> -20', breakevenGrowthThreshold(inputs), -20);
  const r = computeRunway(inputs);
  assertEq('threshold case: profitableAtMonth = 1', r.profitableAtMonth, 1);
  assertEq('threshold case: months null (outlasts)', r.months, null);
}

// ---------------------------------------------------------------------------
// 9. Threshold bracket on the article PROFILE. Hand: at g = 8% cash(20) is
//    -42.4k (dies); at g = 9% cash bottoms at ~+10.2k in month 19 and
//    profitableAtMonth = 20 (1.09^19 = 5.1417 >= 5x) -> the cliff sits in
//    (8, 9). Engine bisection: 8.795852661132812.
// ---------------------------------------------------------------------------
{
  const P = { cash: 500_000, grossBurn: 50_000, mrr: 10_000, growthRate: 0, grossMargin: 100 };
  const cliff = breakevenGrowthThreshold(P);
  assertClose('cliff: bisection value', cliff, 8.795852661132812, 0.01);
  assertEq('cliff: inside hand bracket (8, 9)', cliff > 8 && cliff < 9, true);
  assertEq('cliff: at 8% the company dies', computeRunway({ ...P, growthRate: 8 }).months !== null, true);
  const atNine = computeRunway({ ...P, growthRate: 9 });
  assertEq('cliff: at 9% it survives & is profitable', atNine.months === null && atNine.reachedProfitability, true);
  assertEq('cliff: at 9% profitableAtMonth = 20', atNine.profitableAtMonth, 20);
  const justBelow = computeRunway({ ...P, growthRate: cliff - 0.01 });
  const justAbove = computeRunway({ ...P, growthRate: cliff + 0.01 });
  assertEq('cliff: threshold - 0.01 still dies', justBelow.months !== null, true);
  assertEq('cliff: threshold + 0.01 survives', justAbove.months === null && justAbove.reachedProfitability, true);
}

// ---------------------------------------------------------------------------
// 10. UI regression anchor — RUNWAY_PRESETS[2] "Long winter". Hand:
//     cash(M) = 700k - 45k*M + 562.5k*(1 - 0.98^M) -> cash(19) = +24,290,
//     cash(20) = -20,710 -> months 20; naive 700k/33.75k = 20.7407 is the
//     number contraction-beats (RunwayArticle.tsx:26 anchor).
// ---------------------------------------------------------------------------
{
  const W = RUNWAY_PRESETS[2].inputs;
  const r = computeRunway(W);
  assertEq('winter: initialNetBurn = 45k - 0.75*15k', r.initialNetBurn, 33_750);
  assertEq('winter: breakevenMrr = 45k/0.75', r.breakevenMrr, 60_000);
  assertEq('winter: months = 20', r.months, 20);
  assertClose('winter: monthsExact', r.monthsExact, 19.651022131291366, 1e-9);
  assertClose('winter: naive division = 20.7407', W.cash / r.initialNetBurn, 20.74074074074074, 1e-9);
  assertEq('winter: exact < naive (contraction costs runway)', r.monthsExact < W.cash / r.initialNetBurn, true);
  assertEq('winter: never profitable', r.reachedProfitability, false);
}

// ---------------------------------------------------------------------------
// 11. Degenerate inputs — burn <= 0 clamps to zero: netBurn = 0 counts as
//     profitability in month 1 (netBurn <= 0 branch, lib/runway.ts:133).
// ---------------------------------------------------------------------------
{
  const r = computeRunway({ cash: 1_000, grossBurn: -100, mrr: 0, growthRate: 0 });
  assertEq('no-burn: months null', r.months, null);
  assertEq('no-burn: profitableAtMonth = 1 (netBurn 0)', r.profitableAtMonth, 1);
  assertEq('no-burn: breakevenMrr = 0/1', r.breakevenMrr, 0);

  const negativeCash = computeRunway({ cash: -5, grossBurn: 10_000, mrr: 0, growthRate: 5 });
  assertEq('negative cash clamps to the out-of-cash-today return', negativeCash.months, 0);
}

console.log(`runway.test: ${passed} assertions passed`);

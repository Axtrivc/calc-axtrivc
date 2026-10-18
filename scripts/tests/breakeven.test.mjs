// breakeven.test.mjs — regression matrix for lib/breakeven.ts (CVP engine).
//
// RUN PREREQUISITE (the unified runner compiles; this file never compiles):
//   npx tsc lib/breakeven.ts \
//     --outDir scripts/tests/.build --module commonjs --target es2020 \
//     --skipLibCheck
//   then: node scripts/tests/breakeven.test.mjs
// The compiled engine is resolved from the first existing candidate —
// <testsDir>/.build/lib/breakeven.js (rootDir-projected layout) or
// <testsDir>/.build/breakeven.js (flat layout, when several lib files share
// lib/ as their common root) — matching the sibling tests in this directory.
// Override the build dir with the CALC_TEST_BUILD env var (absolute, or
// relative to this file's directory).
//
// Assertion policy: every expected value below was (1) hand-derived from the
// CVP formulas in the lib's JSDoc (CM = P - V, Q* = F / CM, R* = Q* x P,
// pi(Q) = Q*CM - F, DOL = Q*CM / pi) and (2) confirmed against the compiled
// engine before being written in. Closed forms are asserted as the arithmetic
// expression itself; any mismatch throws with input / expected / actual and
// a non-zero exit code.

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
  contributionMargin,
  cmRatio,
  breakEvenUnits,
  breakEvenRevenue,
  profitAt,
  computeBreakEven,
  priceSweep,
  sensitivityGrid,
  priceRiseTolerance,
  BREAKEVEN_PRESETS,
} = await loadLib('breakeven');

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
// 1. Primitives. CM keeps its sign (a finding, not an error); negative price
//    or cost clamps to 0 (lib/breakeven.ts:32-34); cmRatio is null when price
//    is 0 (undefined ratio, lib/breakeven.ts:57-61).
// ---------------------------------------------------------------------------
assertEq('CM(79, 8) = 71', contributionMargin(79, 8), 71);
assertEq('CM(-50, 20): price clamps to 0 -> -20', contributionMargin(-50, 20), -20);
assertClose('cmRatio(79, 8) = 71/79', cmRatio(79, 8), 71 / 79, 1e-15);
assertEq('cmRatio(0, 20) = null (price 0)', cmRatio(0, 20), null);
assertEq('cmRatio(-5, 3) = null (price clamps to 0)', cmRatio(-5, 3), null);

// ---------------------------------------------------------------------------
// 2. Break-even units / revenue. null whenever CM <= 0 (no volume saves a
//    product that loses money per sale — file-header contract); F = 0 with
//    positive margin breaks even at 0 units; negative F clamps to 0.
//    Revenue is computed from Q* so the two can never disagree.
// ---------------------------------------------------------------------------
assertClose('Q*(12000, 79, 8) = 12000/71', breakEvenUnits(12_000, 79, 8), 12_000 / 71, 1e-12);
assertEq('Q* null at CM = 0 (P == V)', breakEvenUnits(1000, 5, 5), null);
assertEq('Q* null at CM < 0 (P < V)', breakEvenUnits(1000, 5, 8), null);
assertEq('Q*(F=0) = 0 (first sale already profitable)', breakEvenUnits(0, 79, 8), 0);
assertEq('Q*(F<0 clamps to 0) = 0', breakEvenUnits(-5, 79, 8), 0);
assertClose('R*(12000, 79, 8) = 12000*79/71', breakEvenRevenue(12_000, 79, 8), 948_000 / 71, 1e-9);
assertEq('R* null when CM < 0', breakEvenRevenue(1000, 5, 8), null);
assertClose('R* = Q* x P identity (saas)', breakEvenRevenue(12_000, 79, 8), breakEvenUnits(12_000, 79, 8) * 79, 1e-9);

// ---------------------------------------------------------------------------
// 3. CVP profit equation with clamps: units and fixed costs clamp to >= 0.
// ---------------------------------------------------------------------------
assertEq('pi(400; 12000, 79, 8) = 400*71 - 12000 = 16400', profitAt(400, 12_000, 79, 8), 16_400);
assertEq('pi(-100 units clamp to 0) = -12000', profitAt(-100, 12_000, 79, 8), -12_000);
assertEq('pi(10; F=-100 clamps to 0) = 710', profitAt(10, -100, 79, 8), 710);

// ---------------------------------------------------------------------------
// 4. UI-default regression anchor — BREAKEVEN_PRESETS[0] "SaaS subscription"
//    (lib/breakeven.ts:345; the calculator's DEFAULTS). Hand: CM = 71,
//    Q* = 12000/71 = 169.0141, R* = 13352.1127, profit(400) = 16400,
//    MoS% = (400 - 169.0141)/400 = 57.7465%, DOL = 28400/16400 = 1.73171.
// ---------------------------------------------------------------------------
{
  const r = computeBreakEven(BREAKEVEN_PRESETS[0].inputs);
  assertEq('saas: contributionMargin', r.contributionMargin, 71);
  assertClose('saas: cmRatioPct = 7100/79', r.cmRatioPct, 7100 / 79, 1e-12);
  assertClose('saas: breakEvenUnits', r.breakEvenUnits, 12_000 / 71, 1e-12);
  assertClose('saas: breakEvenRevenue', r.breakEvenRevenue, 948_000 / 71, 1e-9);
  assertEq('saas: firstProfitableUnit = floor(169.01) + 1', r.firstProfitableUnit, 170);
  assertEq('saas: currentRevenue = 400*79', r.currentRevenue, 31_600);
  assertEq('saas: profitAtCurrent = 16400', r.profitAtCurrent, 16_400);
  assertClose('saas: marginOfSafetyUnits = 400 - 12000/71', r.marginOfSafetyUnits, 400 - 12_000 / 71, 1e-12);
  assertClose('saas: marginOfSafetyRevenue', r.marginOfSafetyRevenue, 31_600 - 948_000 / 71, 1e-9);
  assertClose('saas: marginOfSafetyPct = 57.7465', r.marginOfSafetyPct, 57.74647887323943, 1e-9);
  assertClose('saas: operatingLeverage = 28400/16400', r.operatingLeverage, 28400 / 16400, 1e-12);
  assertEq('saas: status above-be', r.status, 'above-be');
}

// ---------------------------------------------------------------------------
// 5. Exactly-at-break-even — the JSDoc worked example (lib/breakeven.ts:149):
//    F=100, P=10, V=5 -> Q* = 20; at volume 20 profit is exactly 0 ('at-be'),
//    and the first strictly PROFITABLE unit is #21 (floor + 1, not ceil).
//    DOL is null through zero profit (lib/breakeven.ts:171).
// ---------------------------------------------------------------------------
{
  const r = computeBreakEven({ fixedCosts: 100, price: 10, unitVariableCost: 5, currentUnits: 20 });
  assertEq('at-be: Q* = 20', r.breakEvenUnits, 20);
  assertEq('at-be: firstProfitableUnit = 21 (JSDoc anchor)', r.firstProfitableUnit, 21);
  assertEq('at-be: profit exactly 0', r.profitAtCurrent, 0);
  assertEq('at-be: status', r.status, 'at-be');
  assertEq('at-be: marginOfSafetyUnits 0', r.marginOfSafetyUnits, 0);
  assertEq('at-be: marginOfSafetyPct 0', r.marginOfSafetyPct, 0);
  assertEq('at-be: operatingLeverage null', r.operatingLeverage, null);
}

// ---------------------------------------------------------------------------
// 6. F = 0 corners. With volume 10 the MoS is the whole business (100%);
//    with volume 0 the MoS% is null (division by 0 volume) and profit 0
//    reads 'at-be' (lib/breakeven.ts:196-197, 204).
// ---------------------------------------------------------------------------
{
  const r = computeBreakEven({ fixedCosts: 0, price: 79, unitVariableCost: 8, currentUnits: 10 });
  assertEq('F0: breakEvenUnits 0', r.breakEvenUnits, 0);
  assertEq('F0: firstProfitableUnit 1', r.firstProfitableUnit, 1);
  assertEq('F0: marginOfSafetyPct 100', r.marginOfSafetyPct, 100);
  assertEq('F0: profit 710', r.profitAtCurrent, 710);
  assertEq('F0: status above-be', r.status, 'above-be');

  const z = computeBreakEven({ fixedCosts: 0, price: 79, unitVariableCost: 8, currentUnits: 0 });
  assertEq('F0@0 units: marginOfSafetyPct null', z.marginOfSafetyPct, null);
  assertEq('F0@0 units: status at-be (profit 0)', z.status, 'at-be');
  assertEq('F0@0 units: operatingLeverage null', z.operatingLeverage, null);
}

// ---------------------------------------------------------------------------
// 7. Impossible regime — price below variable cost. Every field that depends
//    on a break-even is null; profit keeps deepening with volume.
//    Hand: pi(100) = 100*(5-8) - 5000 = -300 - 5000 = -5300.
// ---------------------------------------------------------------------------
{
  const r = computeBreakEven({ fixedCosts: 5_000, price: 5, unitVariableCost: 8, currentUnits: 100 });
  assertEq('impossible: CM = -3', r.contributionMargin, -3);
  assertEq('impossible: breakEvenUnits null', r.breakEvenUnits, null);
  assertEq('impossible: breakEvenRevenue null', r.breakEvenRevenue, null);
  assertEq('impossible: firstProfitableUnit null', r.firstProfitableUnit, null);
  assertEq('impossible: marginOfSafetyUnits null', r.marginOfSafetyUnits, null);
  assertEq('impossible: marginOfSafetyPct null', r.marginOfSafetyPct, null);
  assertEq('impossible: operatingLeverage null', r.operatingLeverage, null);
  assertEq('impossible: profitAtCurrent = -5300', r.profitAtCurrent, -5_300);
  assertEq('impossible: status', r.status, 'impossible');
}

// ---------------------------------------------------------------------------
// 8. Below break-even: negative MoS (still inside the loss wedge), DOL null
//    through a loss. Hand: pi(10) = 50 - 100 = -50; MoS% = -10/10 = -100%.
// ---------------------------------------------------------------------------
{
  const r = computeBreakEven({ fixedCosts: 100, price: 10, unitVariableCost: 5, currentUnits: 10 });
  assertEq('below-be: profit -50', r.profitAtCurrent, -50);
  assertEq('below-be: status', r.status, 'below-be');
  assertClose('below-be: marginOfSafetyPct -100', r.marginOfSafetyPct, -100, 1e-12);
  assertEq('below-be: operatingLeverage null on loss', r.operatingLeverage, null);
}

// ---------------------------------------------------------------------------
// 9. Article anchor — BREAKEVEN_PRESETS[1] "Physical product" (used by
//    BreakEvenArticle.tsx:13). Hand: CM = 48, Q* = 6500/48 = 135.4167,
//    R* = 6500*89/48 = 12052.0833, pi(300) = 14400 - 6500 = 7900,
//    DOL = 14400/7900 = 1.82278, MoS% = 164.5833/300 = 54.8611%.
// ---------------------------------------------------------------------------
{
  const r = computeBreakEven(BREAKEVEN_PRESETS[1].inputs);
  assertEq('product: CM 48', r.contributionMargin, 48);
  assertClose('product: cmRatioPct = 4800/89', r.cmRatioPct, 4800 / 89, 1e-12);
  assertClose('product: Q* = 6500/48', r.breakEvenUnits, 6500 / 48, 1e-12);
  assertClose('product: R* = 6500*89/48', r.breakEvenRevenue, (6500 * 89) / 48, 1e-9);
  assertEq('product: firstProfitableUnit 136', r.firstProfitableUnit, 136);
  assertEq('product: currentRevenue 26700', r.currentRevenue, 26_700);
  assertEq('product: profit 7900', r.profitAtCurrent, 7_900);
  assertClose('product: DOL = 14400/7900', r.operatingLeverage, 14400 / 7900, 1e-12);
  assertClose('product: MoS% = 54.8611', r.marginOfSafetyPct, 54.861111111111114, 1e-9);
  assertEq('product: status above-be', r.status, 'above-be');
}

// ---------------------------------------------------------------------------
// 10. Article anchor — BREAKEVEN_PRESETS[2] "Service delivery".
//     Hand: CM = 115, Q* = 9000/115 = 78.2609, R* = 1350000/115 = 11739.13,
//     pi(160) = 18400 - 9000 = 9400, DOL = 18400/9400 = 1.95745.
// ---------------------------------------------------------------------------
{
  const r = computeBreakEven(BREAKEVEN_PRESETS[2].inputs);
  assertClose('service: Q* = 9000/115', r.breakEvenUnits, 9000 / 115, 1e-12);
  assertClose('service: R* = 1350000/115', r.breakEvenRevenue, 1_350_000 / 115, 1e-9);
  assertEq('service: profit 9400', r.profitAtCurrent, 9_400);
  assertEq('service: currentRevenue 24000', r.currentRevenue, 24_000);
  assertClose('service: DOL = 18400/9400', r.operatingLeverage, 18400 / 9400, 1e-12);
  assertClose('service: MoS units = 160 - 9000/115', r.marginOfSafetyUnits, 160 - 9000 / 115, 1e-12);
  assertEq('service: status above-be', r.status, 'above-be');
}

// ---------------------------------------------------------------------------
// 11. Price sweep — the default 0.6..1.6 band, 25 points. Hand: first point
//     p = 47.4 (CM 39.4, Q* = 12000/39.4 = 304.5685, R* = 568800/39.4);
//     last point p = 126.4 (CM 118.4, Q* = 101.3514). Below variable cost the
//     point is null (priceSweep(F=1000, P=10, V=8): point i=4 has price
//     7.6667 < 8 -> null; point i=5 has price 8.0833 -> Q* ~ 12000).
//     Degenerate: basePrice <= 0 or steps < 2 -> [].
// ---------------------------------------------------------------------------
{
  const s = priceSweep(12_000, 79, 8);
  assertEq('sweep: 25 points', s.length, 25);
  assertClose('sweep: first price 79*0.6', s[0].price, 47.4, 1e-12);
  assertClose('sweep: first CM 39.4', s[0].cm, 39.4, 1e-12);
  assertClose('sweep: first Q* = 12000/39.4', s[0].breakEvenUnits, 12_000 / 39.4, 1e-9);
  assertClose('sweep: first R* = 568800/39.4', s[0].breakEvenRevenue, 568_800 / 39.4, 1e-9);
  assertClose('sweep: last price 79*1.6', s[24].price, 126.4, 1e-12);
  assertClose('sweep: last CM 118.4', s[24].cm, 118.4, 1e-12);
  assertClose('sweep: last Q* = 12000/118.4', s[24].breakEvenUnits, 12_000 / 118.4, 1e-12);
  assertClose('sweep: last R* = 1516800/118.4', s[24].breakEvenRevenue, 1_516_800 / 118.4, 1e-9);

  const t = priceSweep(1000, 10, 8);
  assertEq('sweep: price below VC -> null (i=4, p=7.667)', t[4].breakEvenUnits, null);
  assertClose('sweep: price above VC (i=5, p=8.083) -> Q* ~ 12000', t[5].breakEvenUnits, 12_000, 0.01);
  assertEq('sweep: basePrice 0 -> []', priceSweep(1000, 0, 8).length, 0);
  assertEq('sweep: steps < 2 -> []', priceSweep(1000, 10, 8, 0.6, 1.6, 1).length, 0);
}

// ---------------------------------------------------------------------------
// 12. +-10% sensitivity tornado (saas inputs). Hand: every cell re-solves
//     F/(P-V) with one driver moved: price 71.1/86.9 -> 190.1743/152.0913;
//     VC 7.2/8.8 -> 167.1309/170.9402; F 10800/13200 -> 152.1127/185.9155.
//     Price is the sharpest lever (widest spread) — the tornado's headline.
// ---------------------------------------------------------------------------
{
  const g = sensitivityGrid(BREAKEVEN_PRESETS[0].inputs);
  assertEq('sensitivity: 3 rows', g.length, 3);
  assertClose('sensitivity: price -10% -> 12000/63.1', g[0].down, 12_000 / 63.1, 1e-12);
  assertClose('sensitivity: price +10% -> 12000/78.9', g[0].up, 12_000 / 78.9, 1e-12);
  assertClose('sensitivity: VC -10% -> 12000/71.8', g[1].down, 12_000 / 71.8, 1e-12);
  assertClose('sensitivity: VC +10% -> 12000/70.2', g[1].up, 12_000 / 70.2, 1e-12);
  assertClose('sensitivity: F -10% -> 10800/71', g[2].down, 10_800 / 71, 1e-12);
  assertClose('sensitivity: F +10% -> 13200/71', g[2].up, 13_200 / 71, 1e-12);
  const priceSpread = g[0].up - g[0].down;
  const vcSpread = g[1].up - g[1].down;
  const fSpread = g[2].up - g[2].down;
  assertEq('sensitivity: price spread dominates VC spread', Math.abs(priceSpread) > Math.abs(vcSpread), true);
  assertEq('sensitivity: price spread dominates F spread', Math.abs(priceSpread) > Math.abs(fSpread), true);
}

// ---------------------------------------------------------------------------
// 13. Price-rise volume tolerance. Hand (saas, +10%): e* = 1 - 71/78.9
//     = 7.9/78.9 = 10.0127% of volume can walk away and profit still holds.
//     A 0% rise tolerates exactly 0%; CM <= 0 has no answer (null);
//     service preset: 1 - 115/130 = 11.5385%.
// ---------------------------------------------------------------------------
assertClose('tolerance(79, 8, +10%) = 790/78.9', priceRiseTolerance(79, 8, 10), 790 / 78.9, 1e-9);
assertClose('tolerance(79, 8, 0%) = 0', priceRiseTolerance(79, 8, 0), 0, 1e-12);
assertEq('tolerance(5, 8, 10%) null (CM < 0)', priceRiseTolerance(5, 8, 10), null);
assertClose('tolerance(150, 35, +10%) = 15/130', priceRiseTolerance(150, 35, 10), (1 - 115 / 130) * 100, 1e-12);

console.log(`breakeven.test: ${passed} assertions passed`);

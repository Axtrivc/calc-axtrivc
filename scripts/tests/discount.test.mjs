// discount.test.mjs — regression matrix for lib/discount.ts (discount-erosion
// engine of the "Price" stage: Marn–Rosiello price-cut/volume algebra plus the
// spend-threshold coupon comparator).
//
// RUN PREREQUISITE (the unified runner compiles; this file never compiles):
//   npx tsc lib/discount.ts \
//     --outDir scripts/tests/.build --module commonjs --target es2020 \
//     --skipLibCheck
//   then: node scripts/tests/discount.test.mjs
// The compiled engine is resolved from the first existing candidate —
// <testsDir>/.build/lib/discount.js (rootDir-projected layout) or
// <testsDir>/.build/discount.js (flat layout, when several lib files share
// lib/ as their common root) — matching the sibling tests in this directory
// (breakeven/captable). Override the build dir with the CALC_TEST_BUILD env
// var (absolute, or relative to this file's directory). lib/discount.ts has
// no '@/lib/*' imports, so the alias-redirect loader variant used by the
// paytype/scorp family is not needed here; this loader is the same one the
// alias-free siblings use.
//
// Assertion policy: every expected value below was (1) hand-derived from the
// formulas in the lib's JSDoc (gm% = (P−C)/P×100; revenue-neutral uplift
// u = d/(1−d); profit-neutral uplift u = d/(gm−d) — the Marn–Rosiello
// price-cut/volume table; coupon crossover B* = Y/d) and (2) confirmed
// against the compiled engine (tsc → node, temp build dir, since removed)
// before being written in. Closed forms are asserted as the arithmetic
// expression itself; any mismatch throws with input / expected / actual and
// a non-zero exit code. No year-specific statutory constant enters this
// model — every formula is time-invariant arithmetic on operator inputs.

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
  grossMarginPct,
  revenueNeutralUpliftPct,
  profitNeutralUpliftPct,
  computeDiscount,
  profitAtResponse,
  profitDeltaAtResponse,
  responseSweep,
  upliftCurve,
  marginTierMatrix,
  couponVsStraight,
  DISCOUNT_PRESETS,
} = await loadLib('discount');

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
// 1. grossMarginPct — gm% = (P − C)/P × 100 (lib/discount.ts:46-50). Sign is
//    kept (a negative gm is a finding, not an error); price ≤ 0 (incl. the
//    nn() clamp of negatives, lib/discount.ts:35-37) is null — ratio undefined.
//    Hand: (79−8)/79 = 71/79; (89−41)/89 = 48/89; (50−60)/50 = −0.2.
// ---------------------------------------------------------------------------
assertClose('gm(79, 8) = 7100/79', grossMarginPct(79, 8), 7100 / 79, 1e-12);
assertEq('gm(100, 60) = 40', grossMarginPct(100, 60), 40);
assertEq('gm(50, 60) = -20 (sign kept)', grossMarginPct(50, 60), -20);
assertEq('gm(50, 50) = 0 (at water)', grossMarginPct(50, 50), 0);
assertEq('gm(0, 20) = null (no price)', grossMarginPct(0, 20), null);
assertEq('gm(-5, 3) = null (price clamps to 0)', grossMarginPct(-5, 3), null);
assertClose('gm(89, 41) = 4800/89', grossMarginPct(89, 41), 4800 / 89, 1e-12);

// ---------------------------------------------------------------------------
// 2. revenueNeutralUpliftPct — u = d/(1−d) (lib/discount.ts:68-71). The famous
//    "law of discounts": 20% off needs +25%, 25% off +33⅓%. d clamps to
//    [0, 95]; at the 95 cap the engine float 0.95/0.05 lands at
//    1899.9999999999982 (verified), so the cap is asserted with tolerance.
// ---------------------------------------------------------------------------
assertEq('rUplift(0) = 0', revenueNeutralUpliftPct(0), 0);
assertClose('rUplift(10) = 100/9', revenueNeutralUpliftPct(10), 100 / 9, 1e-12);
assertEq('rUplift(20) = 25 (law of discounts)', revenueNeutralUpliftPct(20), 25);
assertClose('rUplift(25) = 100/3', revenueNeutralUpliftPct(25), 100 / 3, 1e-12);
assertEq('rUplift(50) = 100', revenueNeutralUpliftPct(50), 100);
assertClose('rUplift(95 cap) = 1900', revenueNeutralUpliftPct(95), 1900, 1e-9);
assertClose('rUplift(120) clamps to 95 -> 1900', revenueNeutralUpliftPct(120), 1900, 1e-9);
assertEq('rUplift(-10) clamps to 0', revenueNeutralUpliftPct(-10), 0);

// ---------------------------------------------------------------------------
// 3. profitNeutralUpliftPct — u = d/(gm − d) (lib/discount.ts:95-105), the
//    Marn–Rosiello governing number. Hand anchors:
//    (79, 8, 20): gm = 7100/79; u = 20·79/(7100−1580)·100 = 1975/69.
//    (100, 60, 20): 20/(40−20) = 100% — the canonical HBR table cell.
//    (150, 35, 10): gm = 230/3; u = 10/(200/3)·100 = 15 exactly.
//    null regime: gm ≤ 0 (nothing to preserve) or d ≥ gm (margin consumed).
// ---------------------------------------------------------------------------
assertClose('pUplift(79, 8, 20) = 1975/69', profitNeutralUpliftPct(79, 8, 20), 1975 / 69, 1e-12);
assertEq('pUplift(100, 60, 20) = 100 (Marn-Rosiello)', profitNeutralUpliftPct(100, 60, 20), 100);
assertClose('pUplift(100, 60, 10) = 100/3', profitNeutralUpliftPct(100, 60, 10), 100 / 3, 1e-12);
assertEq('pUplift(150, 35, 10) = 15 exactly', profitNeutralUpliftPct(150, 35, 10), 15);
assertClose('pUplift(100, 25, 30) = 200/3', profitNeutralUpliftPct(100, 25, 30), 200 / 3, 1e-12);
assertEq('pUplift(79, 8, 0) = 0', profitNeutralUpliftPct(79, 8, 0), 0);
assertEq('pUplift(100, 60, 40) = null (d = gm)', profitNeutralUpliftPct(100, 60, 40), null);
assertEq('pUplift(100, 60, 50) = null (d > gm)', profitNeutralUpliftPct(100, 60, 50), null);
assertEq('pUplift(50, 50, 10) = null (gm = 0)', profitNeutralUpliftPct(50, 50, 10), null);
assertEq('pUplift(50, 60, 10) = null (gm < 0)', profitNeutralUpliftPct(50, 60, 10), null);
assertEq('pUplift(0, 5, 10) = null (no price)', profitNeutralUpliftPct(0, 5, 10), null);
assertEq('pUplift(79, 8, 150) = null (d clamps 95 >= gm)', profitNeutralUpliftPct(79, 8, 150), null);

// ---------------------------------------------------------------------------
// 4. computeDiscount — UI-default regression anchor, DISCOUNT_PRESETS[0]
//    "SaaS subscription" (lib/discount.ts:395). Hand: P=79, C=8, Q=400, d=20.
//    discounted price 79×0.8 = 63.2; unit margins 71 → 55.2; gm = 7100/79;
//    gmAfter = 55.2/63.2 = 69/79 ×100 = 6900/79; erosion = d/gm = 1580/71;
//    revenue 31600; gross profit 28400; rUplift 25 < pUplift 1975/69 (the gap
//    is the COGS the revenue-neutral number ignores); break-even volume
//    400×(1+1975/6900) = 400×355/276 = 142000/276.
// ---------------------------------------------------------------------------
{
  const r = computeDiscount(DISCOUNT_PRESETS[0].inputs);
  assertEq('saas: status viable', r.status, 'viable');
  assertClose('saas: discountedPrice 63.2', r.discountedPrice, 63.2, 1e-9);
  assertEq('saas: baseUnitMargin 71', r.baseUnitMargin, 71);
  assertClose('saas: discountedUnitMargin 55.2', r.discountedUnitMargin, 55.2, 1e-9);
  assertClose('saas: baseGrossMarginPct = 7100/79', r.baseGrossMarginPct, 7100 / 79, 1e-12);
  assertClose('saas: discountedGrossMarginPct = 6900/79', r.discountedGrossMarginPct, 6900 / 79, 1e-12);
  assertClose('saas: unitMarginErosionPct = 1580/71', r.unitMarginErosionPct, 1580 / 71, 1e-12);
  assertEq('saas: baseRevenue 31600', r.baseRevenue, 31600);
  assertEq('saas: baseGrossProfit 28400', r.baseGrossProfit, 28400);
  assertEq('saas: revenueNeutralUpliftPct 25', r.revenueNeutralUpliftPct, 25);
  assertClose('saas: profitNeutralUpliftPct = 1975/69', r.profitNeutralUpliftPct, 1975 / 69, 1e-12);
  assertClose('saas: breakEvenVolume = 142000/276', r.breakEvenVolume, 142000 / 276, 1e-9);
  assertEq('saas: pUplift exceeds rUplift (COGS gap)', r.profitNeutralUpliftPct > r.revenueNeutralUpliftPct, true);
}

// ---------------------------------------------------------------------------
// 5. 'no-price' corner (price ≤ 0). Diagnosis order: a missing price must not
//    be misread as a margin problem (lib/discount.ts:180). The revenue-neutral
//    floor stays 25 — it does not depend on price at all. Hand: unit margin
//    −8 × 100 units = −800 baseline gross "profit".
// ---------------------------------------------------------------------------
{
  const r = computeDiscount({ price: 0, unitCost: 8, volume: 100, discountPct: 20 });
  assertEq('no-price: status', r.status, 'no-price');
  assertEq('no-price: discountedPrice 0', r.discountedPrice, 0);
  assertEq('no-price: baseUnitMargin -8', r.baseUnitMargin, -8);
  assertEq('no-price: baseGrossMarginPct null', r.baseGrossMarginPct, null);
  assertEq('no-price: discountedGrossMarginPct null', r.discountedGrossMarginPct, null);
  assertEq('no-price: unitMarginErosionPct null', r.unitMarginErosionPct, null);
  assertEq('no-price: baseRevenue 0', r.baseRevenue, 0);
  assertEq('no-price: baseGrossProfit -800', r.baseGrossProfit, -800);
  assertEq('no-price: revenueNeutralUpliftPct still 25', r.revenueNeutralUpliftPct, 25);
  assertEq('no-price: profitNeutralUpliftPct null', r.profitNeutralUpliftPct, null);
  assertEq('no-price: breakEvenVolume null', r.breakEvenVolume, null);
}

// ---------------------------------------------------------------------------
// 6. 'underwater' corner (gm ≤ 0) — and the diagnosis-order regression: even a
//    ZERO discount reads 'underwater', not 'no-discount' (lib/discount.ts:181
//    precedes :182). Hand: 5−8 = −3 per unit; 10 units → −30.
// ---------------------------------------------------------------------------
{
  const r = computeDiscount({ price: 5, unitCost: 8, volume: 10, discountPct: 0 });
  assertEq('underwater: status beats no-discount at d=0', r.status, 'underwater');
  assertEq('underwater: discountedUnitMargin -3', r.discountedUnitMargin, -3);
  assertEq('underwater: unitMarginErosionPct null (gm <= 0)', r.unitMarginErosionPct, null);
  assertEq('underwater: revenueNeutralUpliftPct 0', r.revenueNeutralUpliftPct, 0);
  assertEq('underwater: baseGrossProfit -30', r.baseGrossProfit, -30);
}

// ---------------------------------------------------------------------------
// 7. 'no-discount' corner — d < 0.05 is not a promotion on trial
//    (lib/discount.ts:182). At d = 0.04: u = 0.04/(7100/79 − 0.04) (tiny but
//    finite); at exactly d = 0 the uplift is 0 and break-even volume equals
//    the current volume. A negative entry clamps to 0 → same state.
// ---------------------------------------------------------------------------
{
  const r = computeDiscount({ price: 79, unitCost: 8, volume: 400, discountPct: 0.04 });
  assertEq('no-discount: status at d=0.04', r.status, 'no-discount');
  assertClose(
    'no-discount: pUplift = 0.04/(7100/79 - 0.04)',
    r.profitNeutralUpliftPct,
    (0.04 / (7100 / 79 - 0.04)) * 100,
    1e-12,
  );
  assertClose(
    'no-discount: breakEvenVolume = 400 x (1 + u)',
    r.breakEvenVolume,
    400 * (1 + 0.04 / (7100 / 79 - 0.04)),
    1e-9,
  );

  const z = computeDiscount({ price: 79, unitCost: 8, volume: 400, discountPct: 0 });
  assertEq('d=0: status no-discount', z.status, 'no-discount');
  assertEq('d=0: profitNeutralUpliftPct 0', z.profitNeutralUpliftPct, 0);
  assertEq('d=0: breakEvenVolume = current volume', z.breakEvenVolume, 400);

  const n = computeDiscount({ price: 79, unitCost: 8, volume: 400, discountPct: -30 });
  assertEq('d<0 clamps to 0: status no-discount', n.status, 'no-discount');
}

// ---------------------------------------------------------------------------
// 8. 'unrecoverable' — d >= gm: no volume holds profit flat. Hand anchor 1
//    (100, 60, 40): the discount lands the price exactly on cost —
//    discountedUnitMargin 0, gmAfter 0, erosion = d/gm = 100 (the whole
//    margin). Hand anchor 2 (100, 80, 25): gm = 20 < d = 25 — every sale now
//    LOSES $5; more volume means worse, which is why the answer is null.
// ---------------------------------------------------------------------------
{
  const r = computeDiscount({ price: 100, unitCost: 60, volume: 50, discountPct: 40 });
  assertEq('unrecoverable: status', r.status, 'unrecoverable');
  assertEq('unrecoverable: discountedUnitMargin 0', r.discountedUnitMargin, 0);
  assertEq('unrecoverable: discountedGrossMarginPct 0', r.discountedGrossMarginPct, 0);
  assertEq('unrecoverable: erosion 100 (whole margin)', r.unitMarginErosionPct, 100);
  assertClose('unrecoverable: revenueNeutralUpliftPct 200/3', r.revenueNeutralUpliftPct, 200 / 3, 1e-12);
  assertEq('unrecoverable: profitNeutralUpliftPct null', r.profitNeutralUpliftPct, null);
  assertEq('unrecoverable: breakEvenVolume null', r.breakEvenVolume, null);

  const l = computeDiscount({ price: 100, unitCost: 80, volume: 50, discountPct: 25 });
  assertEq('unrecoverable-at-loss: status', l.status, 'unrecoverable');
  assertEq('unrecoverable-at-loss: discountedUnitMargin -5', l.discountedUnitMargin, -5);
}

// ---------------------------------------------------------------------------
// 9. Service preset (lib/discount.ts:408) — the all-integer anchor. Hand:
//    P=150, C=35, d=10: price 135, margins 115 → 100, gm = 230/3, gmAfter =
//    100/135 = 2000/27, erosion = 300/23, revenue 24000, gross profit 18400,
//    pUplift = 10/(230/3 − 10) = 15 exactly, break-even volume 160×1.15 = 184.
// ---------------------------------------------------------------------------
{
  const r = computeDiscount(DISCOUNT_PRESETS[2].inputs);
  assertEq('service: status viable', r.status, 'viable');
  assertEq('service: discountedPrice 135', r.discountedPrice, 135);
  assertEq('service: baseUnitMargin 115', r.baseUnitMargin, 115);
  assertEq('service: discountedUnitMargin 100', r.discountedUnitMargin, 100);
  assertClose('service: gm = 230/3', r.baseGrossMarginPct, 230 / 3, 1e-12);
  assertClose('service: gmAfter = 2000/27', r.discountedGrossMarginPct, 2000 / 27, 1e-12);
  assertClose('service: erosion = 300/23', r.unitMarginErosionPct, 300 / 23, 1e-12);
  assertEq('service: baseRevenue 24000', r.baseRevenue, 24000);
  assertEq('service: baseGrossProfit 18400', r.baseGrossProfit, 18400);
  assertClose('service: revenueNeutralUpliftPct 100/9', r.revenueNeutralUpliftPct, 100 / 9, 1e-12);
  assertEq('service: profitNeutralUpliftPct 15', r.profitNeutralUpliftPct, 15);
  assertEq('service: breakEvenVolume 184', r.breakEvenVolume, 184);
}

// ---------------------------------------------------------------------------
// 10. Product preset margin anchor (lib/discount.ts:401). Hand: gm = 48/89;
//     u = 20·89/(4800−1780)·100 = 8900/151.
// ---------------------------------------------------------------------------
assertClose('product: pUplift = 8900/151', profitNeutralUpliftPct(89, 41, 20), 8900 / 151, 1e-12);

// ---------------------------------------------------------------------------
// 11. profitAtResponse / profitDeltaAtResponse — pi = Q(1+u)·(P(1−d) − C)
//     (lib/discount.ts:211-224). SaaS hand: discounted margin 55.2 →
//     u=0: 400×55.2 = 22080 (pure loss 6320 = 400×15.8);
//     u=25 (the preset's believed response): 500×55.2 = 27600 — STILL 800
//     short, because 25% is only revenue-neutral;
//     u=1975/69: exactly the baseline 28400 (the defining identity);
//     u=50: 600×55.2 = 33120 (+4720). Negative/NaN responses clamp to 0.
//     Service hand: u=15 → 184×100 = 18400 = baseline; u=0 → 16000 (−2400).
// ---------------------------------------------------------------------------
{
  const inputs = DISCOUNT_PRESETS[0].inputs;
  assertClose('profitAt(saas, 0) = 22080', profitAtResponse(inputs, 0), 22080, 1e-9);
  assertClose('delta(saas, 0) = -6320', profitDeltaAtResponse(inputs, 0), -6320, 1e-9);
  assertClose('profitAt(saas, 25) = 27600', profitAtResponse(inputs, 25), 27600, 1e-9);
  assertClose('delta(saas, 25) = -800 (revenue-neutral is not enough)', profitDeltaAtResponse(inputs, 25), -800, 1e-9);
  assertClose('profitAt(saas, u*) = 28400 (identity)', profitAtResponse(inputs, 1975 / 69), 28400, 1e-9);
  assertClose('delta(saas, u*) = 0', profitDeltaAtResponse(inputs, 1975 / 69), 0, 1e-8);
  assertClose('profitAt(saas, 50) = 33120', profitAtResponse(inputs, 50), 33120, 1e-9);
  assertClose('delta(saas, 50) = 4720', profitDeltaAtResponse(inputs, 50), 4720, 1e-9);
  assertClose('profitAt(saas, -50) clamps to u=0', profitAtResponse(inputs, -50), 22080, 1e-9);
  assertClose('profitAt(saas, NaN) clamps to u=0', profitAtResponse(inputs, NaN), 22080, 1e-9);

  const svc = DISCOUNT_PRESETS[2].inputs;
  assertEq('profitAt(service, 15) = 18400', profitAtResponse(svc, 15), 18400);
  assertEq('delta(service, 15) = 0', profitDeltaAtResponse(svc, 15), 0);
  assertEq('profitAt(service, 0) = 16000', profitAtResponse(svc, 0), 16000);
  assertEq('delta(service, 0) = -2400', profitDeltaAtResponse(svc, 0), -2400);
}

// ---------------------------------------------------------------------------
// 12. responseSweep — the chart's straight line in u (lib/discount.ts:238-246).
//     Default 0→200%, 41 points: u_k = 200k/40; deltas 400(1+u)55.2 − 28400.
//     The zero crossing falls between u=25 (delta −800) and u=30 (delta +304)
//     — bracketing the profit-neutral uplift 28.6232. Degenerate guards.
// ---------------------------------------------------------------------------
{
  const s = responseSweep(DISCOUNT_PRESETS[0].inputs);
  assertEq('sweep: 41 points', s.length, 41);
  assertEq('sweep[0]: upliftPct 0', s[0].upliftPct, 0);
  assertClose('sweep[0]: profitDelta -6320', s[0].profitDelta, -6320, 1e-9);
  assertEq('sweep[40]: upliftPct 200', s[40].upliftPct, 200);
  assertClose('sweep[40]: profitDelta 37840', s[40].profitDelta, 37840, 1e-9);
  assertClose('sweep[5]: upliftPct 25', s[5].upliftPct, 25, 1e-12);
  assertClose('sweep[5]: profitDelta -800', s[5].profitDelta, -800, 1e-9);
  assertClose('sweep[6]: upliftPct 30', s[6].upliftPct, 30, 1e-12);
  assertClose('sweep[6]: profitDelta 304', s[6].profitDelta, 304, 1e-9);
  assertEq('sweep: zero crossing between i=5 and i=6', s[5].profitDelta < 0 && s[6].profitDelta > 0, true);
  assertEq('sweep: steps < 2 -> []', responseSweep(DISCOUNT_PRESETS[0].inputs, 200, 1).length, 0);
  assertEq('sweep: maxUplift <= 0 -> []', responseSweep(DISCOUNT_PRESETS[0].inputs, 0).length, 0);
}

// ---------------------------------------------------------------------------
// 13. upliftCurve — the hyperbola u(d) = d/(gm − d) with its null branch at
//     d >= gm (lib/discount.ts:263-275). Default band 2.5→45 step 2.5: d=40
//     lands exactly ON gm=40 → null (the asymptote), d=37.5 → 37.5/2.5 = 1500.
//     Custom band (gm=30, 5→25, 3 pts): 20 / 100 / 500. Guards.
// ---------------------------------------------------------------------------
{
  const c = upliftCurve(40);
  assertEq('curve: 18 points', c.length, 18);
  assertClose('curve[0]: discountPct 2.5', c[0].discountPct, 2.5, 1e-12);
  assertClose('curve[0]: uplift = 20/3', c[0].upliftPct, 20 / 3, 1e-12);
  assertEq('curve[15]: d=40 = gm -> null (asymptote)', c[15].upliftPct, null);
  assertEq('curve[17]: d=45 > gm -> null', c[17].upliftPct, null);
  assertClose('curve[14]: d=37.5 -> 1500', c[14].upliftPct, 1500, 1e-9);

  const t = upliftCurve(30, 5, 25, 3);
  assertClose('curve(30,5,25,3)[0]: 20', t[0].upliftPct, 20, 1e-12);
  assertEq('curve(30,5,25,3)[1]: 100', t[1].upliftPct, 100);
  assertEq('curve(30,5,25,3)[2]: 500', t[2].upliftPct, 500);
  assertEq('curve: gm <= 0 -> []', upliftCurve(0).length, 0);
  assertEq('curve: steps < 2 -> []', upliftCurve(40, 2.5, 45, 1).length, 0);
  assertEq('curve: to <= from -> []', upliftCurve(40, 45, 45).length, 0);
}

// ---------------------------------------------------------------------------
// 14. marginTierMatrix — the classic price-cut/volume grid, each cell
//     d/(gm − d)×100 (lib/discount.ts:290-302). Hand for margins [60,40,30] ×
//     discounts [5,10,20]: 60: 1/11, 20, 50; 40: 1/7, 100/3, 100; 30: 20, 50,
//     200. The 40/20 cell is the canonical Marn–Rosiello 100%. d = gm → null.
// ---------------------------------------------------------------------------
{
  const m = marginTierMatrix([60, 40, 30], [5, 10, 20]);
  assertClose('tier 60 / 5% = 100/11', m[0].uplifts[0], 100 / 11, 1e-12);
  assertEq('tier 60 / 10% = 20', m[0].uplifts[1], 20);
  assertEq('tier 60 / 20% = 50', m[0].uplifts[2], 50);
  assertClose('tier 40 / 5% = 100/7', m[1].uplifts[0], 100 / 7, 1e-12);
  assertClose('tier 40 / 10% = 100/3', m[1].uplifts[1], 100 / 3, 1e-12);
  assertEq('tier 40 / 20% = 100 (canonical)', m[1].uplifts[2], 100);
  assertEq('tier 30 / 5% = 20', m[2].uplifts[0], 20);
  assertEq('tier 30 / 10% = 50', m[2].uplifts[1], 50);
  assertEq('tier 30 / 20% = 200', m[2].uplifts[2], 200);
  assertEq('tier 20 / 20% = null (d = gm)', marginTierMatrix([20], [20])[0].uplifts[0], null);
  assertEq('tier rows keep their gmPct header', m[1].gmPct, 40);
}

// ---------------------------------------------------------------------------
// 15. couponVsStraight — face-rate equivalence of a spend-threshold coupon
//     (lib/discount.ts:345-371). Case A ($10 off $50, basket 60, vs 15%):
//     face 20%, effective 10/60 = 16.67% (< face — the rate shrinks as the
//     basket grows), coupon price 50 vs straight 51, crossover Y/d = 200/3.
//     Case B (basket 40 < T): not triggered, gap 10, effective 0.
// ---------------------------------------------------------------------------
{
  const c = couponVsStraight(50, 10, 60, 15);
  assertEq('coupon A: faceRatePct 20', c.faceRatePct, 20);
  assertEq('coupon A: triggered', c.triggered, true);
  assertEq('coupon A: gapToTrigger 0', c.gapToTrigger, 0);
  assertClose('coupon A: effectiveRatePct 50/3', c.effectiveRatePct, 50 / 3, 1e-12);
  assertEq('coupon A: finalPriceCoupon 50', c.finalPriceCoupon, 50);
  assertClose('coupon A: finalPriceStraight 51', c.finalPriceStraight, 51, 1e-9);
  assertClose('coupon A: savingsDifference 1', c.savingsDifference, 1, 1e-9);
  assertClose('coupon A: crossOverBasket 200/3', c.crossOverBasket, 200 / 3, 1e-12);
  assertEq('coupon A: sane', c.sane, true);

  const b = couponVsStraight(50, 10, 40, 15);
  assertEq('coupon B: below threshold not triggered', b.triggered, false);
  assertEq('coupon B: gapToTrigger 10', b.gapToTrigger, 10);
  assertEq('coupon B: effectiveRatePct 0', b.effectiveRatePct, 0);
  assertEq('coupon B: finalPriceCoupon 40 (basket itself)', b.finalPriceCoupon, 40);
  assertClose('coupon B: finalPriceStraight 34', b.finalPriceStraight, 34, 1e-9);
  assertClose('coupon B: savingsDifference -6', b.savingsDifference, -6, 1e-9);
}

// ---------------------------------------------------------------------------
// 16. Coupon boundaries. At basket = T exactly: effective rate = face rate.
//     The crossover identity: at basket = Y/d the two discounts are equal —
//     pinned with (50, 10, 50, 20): crossover 10/0.2 = 50 = basket, so
//     savingsDifference = 0. d = 0 -> crossover at infinity (null). A coupon
//     with Y >= T pays the customer to check out (sane = false); threshold 0
//     or amount 0 degenerate the instrument.
// ---------------------------------------------------------------------------
{
  const t = couponVsStraight(50, 10, 50, 20);
  assertEq('at-threshold: triggered', t.triggered, true);
  assertEq('at-threshold: effectiveRate = faceRate = 20', t.effectiveRatePct, 20);
  assertClose('at-threshold: finalPriceStraight 40', t.finalPriceStraight, 40, 1e-9);
  assertClose('at-threshold: crossOverBasket = Y/d = 50', t.crossOverBasket, 50, 1e-12);
  assertClose('at-threshold: savingsDifference 0 (crossover identity)', t.savingsDifference, 0, 1e-9);

  const z = couponVsStraight(50, 10, 60, 0);
  assertEq('d=0: crossOverBasket null (infinity)', z.crossOverBasket, null);
  assertEq('d=0: finalPriceStraight = basket', z.finalPriceStraight, 60);
  assertClose('d=0: savingsDifference 10', z.savingsDifference, 10, 1e-9);

  const i = couponVsStraight(50, 60, 100, 10);
  assertEq('insane: Y >= T flagged', i.sane, false);
  assertEq('insane: faceRatePct 120', i.faceRatePct, 120);
  assertEq('insane: effectiveRatePct 60', i.effectiveRatePct, 60);
  assertEq('insane: finalPriceCoupon 40', i.finalPriceCoupon, 40);
  assertClose('insane: finalPriceStraight 90', i.finalPriceStraight, 90, 1e-9);
  assertClose('insane: savingsDifference 50 (60 - 10)', i.savingsDifference, 50, 1e-9);

  const t0 = couponVsStraight(0, 10, 60, 15);
  assertEq('T=0: faceRatePct 0', t0.faceRatePct, 0);
  assertEq('T=0: triggered false', t0.triggered, false);
  assertEq('T=0: sane false', t0.sane, false);
  const y0 = couponVsStraight(50, 0, 60, 15);
  assertEq('Y=0: triggered false', y0.triggered, false);
  assertEq('Y=0: crossOverBasket null', y0.crossOverBasket, null);
}

// ---------------------------------------------------------------------------
// 17. Preset registry — the calculator's scenario buttons (lib/discount.ts:389-414).
// ---------------------------------------------------------------------------
assertEq('presets: 3 archetypes', DISCOUNT_PRESETS.length, 3);
assertEq('presets: ids', DISCOUNT_PRESETS.map((p) => p.id).join(','), 'saas,product,service');
assertEq('saas preset: price 79', DISCOUNT_PRESETS[0].inputs.price, 79);
assertEq('saas preset: unitCost 8', DISCOUNT_PRESETS[0].inputs.unitCost, 8);
assertEq('saas preset: volume 400', DISCOUNT_PRESETS[0].inputs.volume, 400);
assertEq('saas preset: discountPct 20', DISCOUNT_PRESETS[0].inputs.discountPct, 20);
assertEq('saas preset: expectedUpliftPct 25', DISCOUNT_PRESETS[0].expectedUpliftPct, 25);
assertEq('product preset: expectedUpliftPct 25', DISCOUNT_PRESETS[1].expectedUpliftPct, 25);
assertEq('service preset: expectedUpliftPct 10', DISCOUNT_PRESETS[2].expectedUpliftPct, 10);

console.log(`discount.test: ${passed} assertions passed`);

// latefee.test.mjs — permanent regression matrix for lib/latefee.ts
// (late-payment cost of trade terms: carrying cost, expected bad debt, the
// "2/10 net 30" discount arithmetic, and the monthly late-fee convention).
//
// Pure node assertions, no test framework, no dependencies. Every expected
// value below was (a) hand-derived from the documented formulas
// (carry = A × r% × days ÷ 365; E[loss] = A × P(default); terms cost % =
// (days ÷ 365) × r + P(default); AR = billings × DSO ÷ 365; implied rate =
// (d ÷ (1−d)) × (365 ÷ (N−D)); boundary discount q ÷ (1+q) with q =
// r% × (N−D) ÷ 365; boundary net days D + (d ÷ (1−d)) × 365 ÷ r; late fee
// 12 × m simple, (1+m)^12 − 1 compounded) and (b) confirmed against the
// compiled engine before being written in. There is NO statutory parameter
// in this model — Net-N terms and late-fee percentages are contractual
// market conventions (textbook corporate finance: Higgins; Brealey–Myers–
// Allen), and the only dated convention is the 365-day year (site standard,
// with the 360-day banker's year quoted alongside where the classic
// textbook figure differs: 2/10 net 30 ⇒ 37.24% on 365, 36.73% on 360).
//
// RUN PREREQUISITE — provided by the unified test runner, NOT by this file:
//   1. Compile the pure libs to CommonJS into scripts/tests/.build/ — e.g.
//        node scripts/run-math-tests.mjs
//      which generates a paths-mapped tsconfig (rootDir = repo root) and
//      projects lib/ → scripts/tests/.build/lib/. The compiled module is
//      resolved from the first existing candidate, overridable with
//      $CALC_TEST_BUILD:
//        1. $CALC_TEST_BUILD/lib/latefee.js (rootDir-projected layout)
//        2. $CALC_TEST_BUILD/latefee.js     (flat, --rootDir lib layout)
//   2. Run:  node scripts/tests/latefee.test.mjs
// The compiled emit keeps any '@/lib/*' import specifier verbatim from the
// TypeScript source (tsc never rewrites path aliases); the preamble below
// installs a Module._resolveFilename hook that maps '@/lib/<x>' to the
// compiled sibling, so no post-emit rewriting is needed. (latefee.js itself
// has no aliased imports; the hook is kept uniform across the directory
// because qbi.js needs it.)

import fs from 'node:fs';
import { createRequire } from 'node:module';
import Module from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const BUILD = path.resolve(process.env.CALC_TEST_BUILD || path.join(HERE, '.build'));

function buildModule(name) {
  const candidates = [path.join(BUILD, 'lib', `${name}.js`), path.join(BUILD, `${name}.js`)];
  for (const file of candidates) if (fs.existsSync(file)) return file;
  throw new Error(
    `compiled lib/${name}.ts not found — compile first (see header comment)\n` +
      `  tried:     ${candidates.join('\n  tried:     ')}\n` +
      `  build dir: ${BUILD} (override with CALC_TEST_BUILD)`,
  );
}

const origResolve = Module._resolveFilename;
Module._resolveFilename = function (request, ...rest) {
  if (typeof request === 'string' && request.startsWith('@/lib/')) {
    return buildModule(request.slice('@/lib/'.length));
  }
  return origResolve.call(this, request, ...rest);
};

const require = createRequire(import.meta.url);
const {
  carryingCost,
  badDebtLoss,
  expectedReceipt,
  expectedTermsCostPct,
  cashLockedByTerms,
  discountImpliedAnnualized,
  breakevenDiscount,
  breakevenNetDays,
  lateFeeAnnualized,
  computeLatePayment,
  evaluateEarlyPayDiscount,
  termsCostSweep,
  TERM_PRESETS,
  LATEFEE_PRESETS,
} = require(buildModule('latefee'));

let total = 0;
const failures = [];
/** Numeric assertion. Default tolerance absorbs float-op-order noise only. */
function close(name, actual, expected, eps) {
  total++;
  const tol = eps ?? Math.max(1e-6, Math.abs(expected) * 1e-9);
  if (!(Math.abs(actual - expected) <= tol)) {
    failures.push(`输入 ${name} → 期望 ${expected} → 实际 ${actual}`);
  }
}
/** Exact assertion (numbers that must be bit-exact, strings, booleans, null). */
function is(name, actual, expected) {
  total++;
  if (actual !== expected) {
    failures.push(`输入 ${name} → 期望 ${JSON.stringify(expected)} → 实际 ${JSON.stringify(actual)}`);
  }
}

// Personas mirror the calculator's scenario presets exactly.
// Agency retainer preset — LATEFEE_PRESETS[0].
const AGENCY = LATEFEE_PRESETS[0].inputs; // {8500, Net-15, 9%, 1%}
// B2B milestone preset — LATEFEE_PRESETS[1].
const B2B = LATEFEE_PRESETS[1].inputs; // {24000, Net-30, 10%, 3%}

/* ---- Late-fee convention anchors: 1.5%/month ---- */
close('L1 lateFeeAnnualized(1.5) — 12 × 1.5 simple', lateFeeAnnualized(1.5), 18);
close('L2 lateFeeAnnualized(1.5, true) — (1.015^12 − 1)', lateFeeAnnualized(1.5, true), (1.015 ** 12 - 1) * 100);
close('L3 lateFeeAnnualized(0)', lateFeeAnnualized(0), 0);
close('L4 lateFeeAnnualized(-2) — negative clamped', lateFeeAnnualized(-2), 0);

/* ---- Discount-implied annualized rate: the classic 2/10 net 30 ---- */
// Hand: (2 ÷ 98) × (365 ÷ 20) = 37.244897959…% — day-count choice, not statute.
close('L5 discountImpliedAnnualized(2,10,30) on 365', discountImpliedAnnualized(2, 10, 30), (2 / 98) * (365 / 20) * 100);
close('L6 discountImpliedAnnualized(2,10,30) on 360 — banker\'s year', discountImpliedAnnualized(2, 10, 30, 360), (2 / 98) * 18 * 100);
is('L7 discountImpliedAnnualized(0,10,30) — no discount → null', discountImpliedAnnualized(0, 10, 30), null);
is('L8 discountImpliedAnnualized(100,10,30) — whole face → null', discountImpliedAnnualized(100, 10, 30), null);
is('L9 discountImpliedAnnualized(2,30,30) — zero acceleration → null', discountImpliedAnnualized(2, 30, 30), null);
is('L10 discountImpliedAnnualized(2,40,30) — inverted window → null', discountImpliedAnnualized(2, 40, 30), null);

/* ---- Carrying cost: A × r% × days ÷ 365 ---- */
close('L11 carryingCost(10000,12,30) = 36000/365', carryingCost(10000, 12, 30), 36000 / 365);
close('L12 carryingCost(8500,9,15) — agency preset = 11475/365', carryingCost(8500, 9, 15), 11475 / 365);
close('L13 carryingCost(10000,12,0) — zero window', carryingCost(10000, 12, 0), 0);
close('L14 carryingCost(-1000,12,30) — negative face clamped', carryingCost(-1000, 12, 30), 0);

/* ---- Bad debt & realizable value ---- */
close('L15 badDebtLoss(24000,3) = 720', badDebtLoss(24000, 3), 720);
close('L16 badDebtLoss(10000,150) — probability clamped at 100%', badDebtLoss(10000, 150), 10000);
close('L17 badDebtLoss(10000,-5) — negative probability clamped', badDebtLoss(10000, -5), 0);
close('L18 expectedReceipt(24000,3) = 23280', expectedReceipt(24000, 3), 23280);
close('L19 expectedReceipt(10000,100) — certain default → 0', expectedReceipt(10000, 100), 0);

/* ---- Per-cycle terms cost & working capital ---- */
close('L20 expectedTermsCostPct(30,10,3) = 3 + 300/365', expectedTermsCostPct(30, 10, 3), 3 + 300 / 365);
close('L21 expectedTermsCostPct(0,0,0)', expectedTermsCostPct(0, 0, 0), 0);
close('L22 cashLockedByTerms(600000,45) = 27000000/365', cashLockedByTerms(600000, 45), 27000000 / 365);

/* ---- Break-even boundaries (the "打平点" of the discount arithmetic) ---- */
// Hand: q = 8% × 20/365 = 1.6/365 → d* = q/(1+q) = 800/1833 % ≈ 0.436443.
close('L23 breakevenDiscount(8,10,30) = 800/1833', breakevenDiscount(8, 10, 30), 800 / 1833);
// Hand: q = 10% × 20/365 = 2/365 → d* = q/(1+q) = 200/367 % ≈ 0.544959.
close('L24 breakevenDiscount(10,10,30) = 200/367', breakevenDiscount(10, 10, 30), 200 / 367);
is('L25 breakevenDiscount(8,30,30) — inverted window → null', breakevenDiscount(8, 30, 30), null);
// Hand: N* = 10 + (1/49) × (365/0.08) = 10 + 4562.5/49 ≈ 103.11 days.
close('L26 breakevenNetDays(2,10,8) = 10 + 4562.5/49', breakevenNetDays(2, 10, 8), 10 + 4562.5 / 49);
is('L27 breakevenNetDays(2,10,0) — zero capital rate → null', breakevenNetDays(2, 10, 0), null);

/* ---- Aggregate readout: agency-retainer preset (typical values) ---- */
{
  const r = computeLatePayment(AGENCY);
  close('L30 agency.carryingCost = 11475/365', r.carryingCost, 11475 / 365);
  close('L31 agency.badDebtLoss = 1% × 8500', r.badDebtLoss, 85);
  close('L32 agency.expectedReceipt = 8415', r.expectedReceipt, 8415);
  close('L33 agency.totalExpectedCost = 85 + 11475/365', r.totalExpectedCost, 85 + 11475 / 365);
  // c = (85 + 11475/365)/8500 = 1/73 exactly → pct = 100/73.
  close('L34 agency.totalCostPct = 100/73', r.totalCostPct, 100 / 73);
  // uplift = c/(1−c) = (1/73)/(72/73) = 1/72 → 100/72 %.
  close('L35 agency.priceUpliftPct = 100/72', r.priceUpliftPct, 100 / 72);
  close('L36 agency.dailyCarryingCost = 765/365', r.dailyCarryingCost, 765 / 365);
  close('L37 agency.expectedTermsCostPct = 1 + 135/365', r.expectedTermsCostPct, 1 + 135 / 365);
  close('L38 agency.totalCostPct ≡ expectedTermsCostPct (identity)', r.totalCostPct, r.expectedTermsCostPct);
}

/* ---- Aggregate readout boundaries ---- */
{
  const z = computeLatePayment({ invoiceAmount: 0, netDays: 30, annualRatePct: 10, badDebtPct: 3 });
  is('L40 zero face → totalCostPct null', z.totalCostPct, null);
  is('L41 zero face → priceUpliftPct null', z.priceUpliftPct, null);
  close('L42 zero face → all dollar legs 0', z.totalExpectedCost, 0);
  // The percent-of-terms curve is face-independent: still 3 + 300/365.
  close('L43 zero face → expectedTermsCostPct survives', z.expectedTermsCostPct, 3 + 300 / 365);
  const u = computeLatePayment({ invoiceAmount: 1000, netDays: 0, annualRatePct: 0, badDebtPct: 100 });
  close('L44 certain default → totalCostPct = 100', u.totalCostPct, 100);
  is('L45 cost share ≥ 1 → priceUpliftPct null (no finite uplift)', u.priceUpliftPct, null);
}

/* ---- Early-pay discount evaluation: B2B milestone with 2/10 net 30 ---- */
{
  const e = evaluateEarlyPayDiscount(B2B, 2, 10);
  close('L50 daysAccelerated = 20', e.daysAccelerated, 20);
  close('L51 impliedAnnualizedPct = 37.2448…', e.impliedAnnualizedPct, (2 / 98) * (365 / 20) * 100);
  close('L52 impliedAnnualizedPct360 = 36.7346…', e.impliedAnnualizedPct360, (2 / 98) * 18 * 100);
  close('L53 baseline.expectedReceipt = 0.97 × 24000', e.baseline.expectedReceipt, 23280);
  close('L54 baseline.carryingCost = 72000/365', e.baseline.carryingCost, 72000 / 365);
  close('L55 discounted.face = 0.98 × 24000', e.discounted.face, 23520);
  // Uniform risk accrual: 3% × (10/30) = 1% over the shortened window.
  close('L56 discounted.effectiveBadDebtPct = 1', e.discounted.effectiveBadDebtPct, 1);
  close('L57 discounted.expectedReceipt = 23520 × 0.99', e.discounted.expectedReceipt, 23284.8);
  close('L58 discounted.carryingCost = 23520/365', e.discounted.carryingCost, 23520 / 365);
  close('L59 faceGivenUp = 2% × 24000', e.faceGivenUp, 480);
  close('L60 riskRelief = 720 − 235.2', e.riskRelief, 484.8);
  close('L61 carryingRelief = (72000 − 23520)/365', e.carryingRelief, (72000 - 23520) / 365);
  // Hand: 23284.8 − 23520/365 − 23280 + 72000/365 = 137.621917808…
  close('L62 netAdvantage (direct)', e.netAdvantage, 23284.8 - 23520 / 365 - 23280 + 72000 / 365);
  // Accounting identity to the cent: netAdvantage = −faceGivenUp + riskRelief + carryingRelief.
  close('L63 netAdvantage identity holds', e.netAdvantage - (-e.faceGivenUp + e.riskRelief + e.carryingRelief), 0);
  close('L64 breakevenDiscountPct = 200/367', e.breakevenDiscountPct, 200 / 367);
  close('L65 breakevenNetDays = 10 + 3650/49', e.breakevenNetDays, 10 + 3650 / 49);
}

/* ---- Degenerate window D = N: full risk accrues, accelerations vanish ---- */
{
  const e = evaluateEarlyPayDiscount({ invoiceAmount: 10000, netDays: 30, annualRatePct: 8, badDebtPct: 5 }, 2, 30);
  is('L70 D=N → daysAccelerated null', e.daysAccelerated, null);
  is('L71 D=N → impliedAnnualizedPct null', e.impliedAnnualizedPct, null);
  is('L72 D=N → impliedAnnualizedPct360 null', e.impliedAnnualizedPct360, null);
  close('L73 D=N → discounted risk stays at full 5%', e.discounted.effectiveBadDebtPct, 5);
  close('L74 D=N → discounted.expectedReceipt = 9800 × 0.95', e.discounted.expectedReceipt, 9310);
  is('L75 D=N → breakevenDiscountPct null', e.breakevenDiscountPct, null);
  close('L76 D=N → breakevenNetDays = 30 + 4562.5/49', e.breakevenNetDays, 30 + 4562.5 / 49);
}

/* ---- Terms-cost curve (sweep) on the B2B preset ---- */
{
  const s = termsCostSweep(B2B); // 0..120 days, 25 points → 5-day grid
  is('L80 sweep.length = 25', s.length, 25);
  close('L81 sweep[6].days = 30', s[6].days, 30);
  close('L82 sweep[6].carryingCost = 72000/365', s[6].carryingCost, 72000 / 365);
  close('L83 sweep[6].badDebtLoss — flat 720 across the band', s[6].badDebtLoss, 720);
  close('L84 sweep[6].totalCost', s[6].totalCost, 720 + 72000 / 365);
  close('L85 sweep[6].totalCostPct', s[6].totalCostPct, 3 + 300 / 365);
  close('L86 sweep[0].totalCost — day-zero intercept = A × P(default)', s[0].totalCost, 720);
  close('L87 sweep[24].days = 120', s[24].days, 120);
  close('L88 sweep[24].carryingCost = 288000/365', s[24].carryingCost, 288000 / 365);
  is('L89 steps=1 clamped to 2 points', termsCostSweep(B2B, 0, 50, 1).length, 2);
  close('L90 clamped sweep spans 0..50', termsCostSweep(B2B, 0, 50, 1)[1].days, 50);
  is('L91 zero-face sweep → totalCostPct null', termsCostSweep({ invoiceAmount: 0, netDays: 30, annualRatePct: 10, badDebtPct: 3 })[0].totalCostPct, null);
}

/* ---- Preset anchors (regression: silent preset edits move the UI defaults) ---- */
is('L95 TERM_PRESETS.length = 4', TERM_PRESETS.length, 4);
is('L96 TERM_PRESETS[2] is Net-60', TERM_PRESETS[2].netDays, 60);
is(
  'L97 LATEFEE_PRESETS[1].inputs anchor',
  JSON.stringify(LATEFEE_PRESETS[1].inputs),
  '{"invoiceAmount":24000,"netDays":30,"annualRatePct":10,"badDebtPct":3}',
);

if (failures.length > 0) {
  console.error(`latefee.test.mjs: ${failures.length}/${total} assertions FAILED:`);
  for (const f of failures) console.error('  ' + f);
  throw new Error(`latefee.test.mjs failed: ${failures.length} of ${total} assertions mismatched`);
}
console.log(`latefee.test.mjs: ${total}/${total} assertions passed`);

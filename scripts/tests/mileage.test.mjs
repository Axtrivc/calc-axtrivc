// mileage.test.mjs — permanent regression matrix for lib/mileage.ts
// (vehicle mileage deduction: 2025 standard mileage rate vs actual-expense
// method, IRS Notice 2025-5 / Pub 463 mechanics).
//
// Pure node assertions, no test framework, no dependencies. Every expected
// value below was (a) hand-derived from the documented parameters (2025
// standard rate 70¢/mi with a 33¢/mi depreciation component — IRS Notice
// 2025-5, announced via IR-2024-312; actual method = business share ×
// [depreciation + fuel/energy + insurance + maintenance + registration];
// crossover m* = share × cost ÷ rate; SE-tax layer 0.9235 × 15.3% with the
// half-SE clawback, 2025 SS wage base $176,100) and (b) confirmed against
// the compiled engine before being written in.
//
// RUN PREREQUISITE — provided by the unified test runner, NOT by this file:
//   1. Compile the pure libs to CommonJS into scripts/tests/.build/ — e.g.
//        node scripts/run-math-tests.mjs
//      which generates a paths-mapped tsconfig (rootDir = repo root) and
//      projects lib/ → scripts/tests/.build/lib/. The compiled module is
//      resolved from the first existing candidate, overridable with
//      $CALC_TEST_BUILD:
//        1. $CALC_TEST_BUILD/lib/mileage.js (rootDir-projected layout)
//        2. $CALC_TEST_BUILD/mileage.js     (flat, --rootDir lib layout)
//   2. Run:  node scripts/tests/mileage.test.mjs
// The compiled emit keeps any '@/lib/*' import specifier verbatim from the
// TypeScript source (tsc never rewrites path aliases); the preamble below
// installs a Module._resolveFilename hook that maps '@/lib/<x>' to the
// compiled sibling, so no post-emit rewriting is needed. (mileage.js itself
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
  MILEAGE_CONSTANTS_2025,
  standardMethod,
  actualMethod,
  marginalSaving,
  compareMileage,
  neutralMileage,
  mileageSweep,
  boundaryScans,
} = require(buildModule('mileage'));

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

// Personas. PERSONA mirrors the calculator's default inputs; TIE and CROSS
// are contrived to land exactly on / around the method crossover.
// PERSONA: 10,000 business miles, $10,600 annual cost, 75% business share.
const PERSONA = {
  businessMiles: 10000, depreciation: 4000, fuelEnergy: 3200, insurance: 1800,
  maintenance: 1200, registration: 400, businessSharePct: 75,
};
// TIE: 50% × $14,000 = $7,000 = 70¢ × 10,000 — both methods deduct exactly $7,000.
const TIE = {
  businessMiles: 10000, depreciation: 6000, fuelEnergy: 3000, insurance: 2000,
  maintenance: 2000, registration: 1000, businessSharePct: 50,
};
// CROSS: 60% × $5,000 = $3,000 → standard wins at 10,000 mi; crossover at 30000/7 mi.
const CROSS = {
  businessMiles: 10000, depreciation: 2500, fuelEnergy: 1200, insurance: 800,
  maintenance: 300, registration: 200, businessSharePct: 60,
};

/* ---- Statutory / notice parameters (regression anchors) ---- */
is('M1 standardRatePerMile = 0.70 (Notice 2025-5)', MILEAGE_CONSTANTS_2025.standardRatePerMile, 0.7);
is('M2 depreciationComponentPerMile = 0.33 (Notice 2025-5)', MILEAGE_CONSTANTS_2025.depreciationComponentPerMile, 0.33);
is('M3 standardRate2024PerMile = 0.67 (IR-2023-239)', MILEAGE_CONSTANTS_2025.standardRate2024PerMile, 0.67);
is('M4 standardRate2026H1PerMile = 0.725 (IR-2025-128)', MILEAGE_CONSTANTS_2025.standardRate2026H1PerMile, 0.725);
is('M5 standardRate2026H2PerMile = 0.76 (IRB 2026-29)', MILEAGE_CONSTANTS_2025.standardRate2026H2PerMile, 0.76);
is('M6 seBaseFactor = 0.9235', MILEAGE_CONSTANTS_2025.seBaseFactor, 0.9235);
is('M7 seRate = 0.153', MILEAGE_CONSTANTS_2025.seRate, 0.153);
is('M8 ssWageBase2025 = 176100', MILEAGE_CONSTANTS_2025.ssWageBase2025, 176100);

/* ---- Standard method: linear at 70¢, 33¢ of it depreciation ---- */
close('M10 standardMethod(10000).deduction = 7,000', standardMethod(10000).deduction, 7000);
close('M11 standardMethod(10000).embeddedDepreciation = 3,300', standardMethod(10000).embeddedDepreciation, 3300);
close('M12 standardMethod(1234).deduction = 863.80', standardMethod(1234).deduction, 863.8);
close('M13 standardMethod(1234).embeddedDepreciation = 407.22', standardMethod(1234).embeddedDepreciation, 407.22);
close('M14 standardMethod(-5).deduction — negative miles clamped', standardMethod(-5).deduction, 0);
is('M15 standardMethod rate label is the 2025 rate', standardMethod(0).rate, 0.7);

/* ---- Actual method: business share × total cost ---- */
{
  const a = actualMethod(PERSONA);
  close('M20 actual.share = 0.75', a.share, 0.75);
  close('M21 actual.totalCost = 4,000+3,200+1,800+1,200+400', a.totalCost, 10600);
  close('M22 actual.deduction = 0.75 × 10,600', a.deduction, 7950);
  close('M23 actual.deductibleDepreciation', a.deductibleDepreciation, 3000);
  close('M24 actual.deductibleFuelEnergy', a.deductibleFuelEnergy, 2400);
  close('M25 actual.deductibleInsurance', a.deductibleInsurance, 1350);
  close('M26 actual.deductibleMaintenance', a.deductibleMaintenance, 900);
  close('M27 actual.deductibleRegistration', a.deductibleRegistration, 300);
  close('M28 actual.effectiveRatePerMile = 7,950 ÷ 10,000', a.effectiveRatePerMile, 0.795);
  close('M29 share > 100% clamped to 1 → full cost deducted', actualMethod({ ...PERSONA, businessSharePct: 150 }).deduction, 10600);
  close('M30 negative cost lines clamped to 0', actualMethod({ ...PERSONA, depreciation: -9999, fuelEnergy: -1, insurance: 0, maintenance: 0, registration: 0 }).totalCost, 0);
  is('M31 zero miles → effectiveRatePerMile null', actualMethod({ ...PERSONA, businessMiles: 0 }).effectiveRatePerMile, null);
}

/* ---- Marginal saving mechanics ---- */
{
  const s = marginalSaving(7950, 24, true);
  close('M40 saving.seTax = 7,950 × 0.9235 × 0.153', s.seTax, 1123.299225);
  close('M41 saving.halfSeClawback = 24% × 561.6496125', s.halfSeClawback, 134.795907);
  close('M42 saving.incomeTax = 1,908 − 134.795907', s.incomeTax, 1773.204093);
  close('M43 saving.total', s.total, 2896.503318);
  const p = marginalSaving(1000, 24, false);
  close('M44 no-SE.incomeTax = 24% × 1,000', p.incomeTax, 240);
  close('M45 no-SE.seTax = 0', p.seTax, 0);
  close('M46 no-SE.total = 240', p.total, 240);
  const cl = marginalSaving(1000, 150, true); // rate clamped to 100%
  close('M47 rate-clamped.seTax = 141.2955', cl.seTax, 141.2955);
  close('M48 rate-clamped.halfSeClawback = 70.64775', cl.halfSeClawback, 70.64775);
  close('M49 rate-clamped.incomeTax = 929.35225', cl.incomeTax, 929.35225);
  close('M50 rate-clamped.total = 1,070.64775', cl.total, 1070.64775);
  close('M51 negative deduction → total 0', marginalSaving(-100, 24, true).total, 0);
}

/* ---- Full comparison: persona (actual deducts more) ---- */
{
  const c = compareMileage(PERSONA, 24, true);
  is('M60 persona.winner — actual deducts more', c.winner, 'actual');
  close('M61 persona.deductionDelta = 7,950 − 7,000', c.deductionDelta, 950);
  // Saving scales linearly at 0.36434004 per deduction dollar (SE-on, 24%).
  close('M62 persona.savingDelta = 950 × 0.36434004', c.savingDelta, 346.123038);
  close('M63 persona.impliedTotalMiles = 10,000 ÷ 0.75 = 40,000/3', c.impliedTotalMiles, 40000 / 3);
  is('M64 share = 0 → impliedTotalMiles null', compareMileage({ ...PERSONA, businessSharePct: 0 }, 24, true).impliedTotalMiles, null);
}

/* ---- Tie point: both methods deduct exactly $7,000 ---- */
{
  const c = compareMileage(TIE, 24, true);
  is('M70 tie.winner', c.winner, 'tie');
  close('M71 tie.deductionDelta = 0', c.deductionDelta, 0);
  close('M72 tie.savingDelta = 0', c.savingDelta, 0);
}

/* ---- Crossover (neutral mileage): the phase boundary ---- */
{
  const c = compareMileage(CROSS, 24, true);
  is('M80 cross.winner — standard deducts more at 10,000 mi', c.winner, 'standard');
  close('M81 cross.deductionDelta = 3,000 − 7,000', c.deductionDelta, -4000);
  const nm = neutralMileage(CROSS);
  // Closed form: 0.6 × 5,000 ÷ 0.70 = 30,000/7 ≈ 4,285.71 mi.
  close('M82 cross.exactMiles = 30,000/7', nm.exactMiles, 30000 / 7);
  // Scan: first whole mile with 0.70·m > 3,000.50 → 0.70 × 4,287 = 3,000.90.
  is('M83 cross.engineFlipMiles = 4,287', nm.engineFlipMiles, 4287);
  is('M84 winner at 4,286 = tie (0.70 × 4,286 = 3,000.20 within $0.50)', compareMileage({ ...CROSS, businessMiles: 4286 }, 0, false).winner, 'tie');
  is('M85 winner at 4,287 = standard', compareMileage({ ...CROSS, businessMiles: 4287 }, 0, false).winner, 'standard');
  // Reporting floor: an actual side ≤ $0.50 puts the crossing below mile one.
  is('M86 floor — actual $0.30 → nulls', JSON.stringify(neutralMileage({ ...CROSS, businessSharePct: 0.01 })), '{"exactMiles":null,"engineFlipMiles":null}');
  is('M87 zero actual side → nulls', JSON.stringify(neutralMileage({ ...CROSS, businessSharePct: 0, depreciation: 0, fuelEnergy: 0, insurance: 0, maintenance: 0, registration: 0 })), '{"exactMiles":null,"engineFlipMiles":null}');
  // Scan-bounded branches: flip lies beyond the scan window.
  is('M88 scanMax 4,000 < exact → nulls', JSON.stringify(neutralMileage(CROSS, 4000)), '{"exactMiles":null,"engineFlipMiles":null}');
  close('M89 scanMax 4,286 ≥ exact → closed form kept', neutralMileage(CROSS, 4286).exactMiles, 30000 / 7);
  is('M90 scanMax 4,286 → engineFlipMiles null (no whole-mile flip in window)', neutralMileage(CROSS, 4286).engineFlipMiles, null);
}

/* ---- Mileage sweep (chart series) ---- */
{
  const s = mileageSweep(CROSS, 1000, 5); // explicit band 0..1,000, 5 points
  is('M95 sweep.length = 5', s.length, 5);
  close('M96 sweep[2].miles = 500', s[2].miles, 500);
  close('M97 sweep[2].standardDeduction = 0.70 × 500', s[2].standardDeduction, 350);
  close('M98 sweep[4].miles = 1,000', s[4].miles, 1000);
  close('M99 sweep[4].standardDeduction = 700', s[4].standardDeduction, 700);
  close('M100 sweep[0].actualDeduction — flat at 3,000', s[0].actualDeduction, 3000);
  close('M101 sweep[4].actualDeduction — flat at 3,000', s[4].actualDeduction, 3000);
  const d = mileageSweep(PERSONA); // default top = max(16,000; 11,357.14×1.3; 1,000) = 16,000
  is('M102 default sweep length = 61', d.length, 61);
  close('M103 default[60].miles = 16,000', d[60].miles, 16000);
  close('M104 default[60].standardDeduction = 11,200', d[60].standardDeduction, 11200);
  close('M105 default[60].actualDeduction — flat at 7,950', d[60].actualDeduction, 7950);
  close('M106 default[30].miles = 8,000', d[30].miles, 8000);
  close('M107 default[30].standardDeduction = 5,600', d[30].standardDeduction, 5600);
}

/* ---- Decision-boundary scans (guide / scenario footnote anchors) ---- */
{
  const b = boundaryScans(PERSONA);
  // 0.70 × 11,358 = 7,950.60 > 7,950.50; 0.70 × 11,357 = 7,949.90 falls short.
  is('M110 mileageFlip = 11,358', b.mileageFlip, 11358);
  // 0.75 × 9,334 = 7,000.50 exactly → tie; 0.75 × 9,335 = 7,001.25 flips to actual.
  is('M111 costFlip = 9,335', b.costFlip, 9335);
  // 106 × 66 = 6,996 < 7,000.50; 106 × 67 = 7,102.00 flips to actual.
  is('M112 shareFlip = 67%', b.shareFlip, 67);
}

if (failures.length > 0) {
  console.error(`mileage.test.mjs: ${failures.length}/${total} assertions FAILED:`);
  for (const f of failures) console.error('  ' + f);
  throw new Error(`mileage.test.mjs failed: ${failures.length} of ${total} assertions mismatched`);
}
console.log(`mileage.test.mjs: ${total}/${total} assertions passed`);

// homeoffice.test.mjs — permanent regression matrix for lib/homeoffice.ts
// (home-office deduction: simplified option vs actual-expense method, tax
// year 2025 — Rev. Proc. 2013-13 / Form 8829 mechanics).
//
// Pure node assertions, no test framework, no dependencies. Every expected
// value below was (a) hand-derived from the documented parameters ($5/sq ft
// up to 300 sq ft → $1,500 ceiling; share = office ÷ home capped at 100%;
// 39-year straight-line depreciation = 1/39 of ex-land basis; SE-tax layer
// 0.9235 × 15.3% with the half-SE clawback) and (b) confirmed against the
// compiled engine before being written in.
//
// RUN PREREQUISITE — provided by the unified test runner, NOT by this file:
//   1. Compile the pure libs to CommonJS into scripts/tests/.build/ — e.g.
//        npx tsc -p scripts/tests/tsconfig.build.json
//      or the direct equivalent:
//        npx tsc lib/setax.ts lib/estimated.ts lib/qbi.ts lib/homeoffice.ts lib/tax.ts \
//          --outDir scripts/tests/.build --rootDir lib \
//          --module commonjs --target es2020 --esModuleInterop --skipLibCheck
//      IMPORTANT: use --module commonjs (the payment-group tests in this
//      directory accept it too). The compiled module is resolved from the
//      first existing candidate, overridable with $CALC_TEST_BUILD:
//        1. $CALC_TEST_BUILD/lib/homeoffice.js (rootDir-projected layout)
//        2. $CALC_TEST_BUILD/homeoffice.js     (flat layout, command above)
//   2. Run:  node scripts/tests/homeoffice.test.mjs
// The compiled emit keeps any '@/lib/*' import specifier verbatim from the
// TypeScript source (tsc never rewrites path aliases); the preamble below
// installs a Module._resolveFilename hook that maps '@/lib/<x>' to the
// compiled sibling, so no post-emit rewriting is needed. (homeoffice.js
// itself has no aliased imports; the hook is kept uniform across the
// directory because qbi.js needs it.)

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
  HOME_OFFICE_CONSTANTS,
  simplifiedDeduction,
  businessShare,
  annualDepreciation,
  actualMethod,
  marginalSaving,
  compareHomeOffice,
  officeAreaSweep,
} = require(buildModule('homeoffice'));

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

// Personas mirror the calculator defaults / scenario presets exactly.
// City rental = HomeOfficeCalculator DEFAULTS (renter, 24%, SE layer on).
const RENTER = {
  homeSqFt: 1800, officeSqFt: 200, tenure: 'rent',
  rent: 21600, mortgageInterest: 0, propertyTax: 0, homeBasis: 0,
  utilities: 2400, insurance: 600, repairs: 800,
};
// Suburban homeowner scenario preset (owner).
const OWNER = {
  homeSqFt: 2400, officeSqFt: 240, tenure: 'own',
  rent: 0, mortgageInterest: 16800, propertyTax: 6200, homeBasis: 420000,
  utilities: 3600, insurance: 1500, repairs: 1000,
};
// Low-cost-area scenario preset (renter).
const LOWCOST = {
  homeSqFt: 3000, officeSqFt: 150, tenure: 'rent',
  rent: 9600, mortgageInterest: 0, propertyTax: 0, homeBasis: 0,
  utilities: 1500, insurance: 500, repairs: 200,
};
// Contrived tie: home cost such that share × C = $5 × office = $1,000.
const TIE = {
  homeSqFt: 1800, officeSqFt: 200, tenure: 'rent',
  rent: 6200, mortgageInterest: 0, propertyTax: 0, homeBasis: 0,
  utilities: 1800, insurance: 600, repairs: 400,
};

/* ---- Statutory parameters ---- */
is('H1 simplifiedRatePerSqFt', HOME_OFFICE_CONSTANTS.simplifiedRatePerSqFt, 5);
is('H2 simplifiedMaxSqFt', HOME_OFFICE_CONSTANTS.simplifiedMaxSqFt, 300);
is('H3 simplifiedMaxDeduction', HOME_OFFICE_CONSTANTS.simplifiedMaxDeduction, 1500);
is('H4 depreciationAnnualRate = 1/39', HOME_OFFICE_CONSTANTS.depreciationAnnualRate, 1 / 39);

/* ---- Simplified option: linear to 300 sq ft, flat ceiling beyond ---- */
close('H10 simplifiedDeduction(200) = 5 × 200', simplifiedDeduction(200), 1000);
close('H11 simplifiedDeduction(300) — statutory ceiling point', simplifiedDeduction(300), 1500);
close('H12 simplifiedDeduction(500) — capped at $1,500', simplifiedDeduction(500), 1500);
close('H13 simplifiedDeduction(0)', simplifiedDeduction(0), 0);
close('H14 simplifiedDeduction(-10) — negative area clamped', simplifiedDeduction(-10), 0);

/* ---- Business-use share ---- */
close('H20 businessShare(200, 1800).fraction = 1/9', businessShare(200, 1800).fraction, 1 / 9);
is('H21 businessShare(200, 1800).clamped', businessShare(200, 1800).clamped, false);
close('H22 businessShare(1800, 1800).fraction — office fills home', businessShare(1800, 1800).fraction, 1);
close('H23 businessShare(2000, 1800).fraction capped at 1', businessShare(2000, 1800).fraction, 1);
is('H24 businessShare(2000, 1800).clamped — flagged data error', businessShare(2000, 1800).clamped, true);
is('H25 businessShare(100, 0) — zero home → {0, true}', JSON.stringify(businessShare(100, 0)), '{"fraction":0,"clamped":true}');
is('H26 businessShare(0, 100) → {0, false}', JSON.stringify(businessShare(0, 100)), '{"fraction":0,"clamped":false}');

/* ---- Depreciation (owners only, ex-land basis, full-year 1/39) ---- */
close('H30 annualDepreciation(380000) = 380000/39', annualDepreciation(380000), 380000 / 39);
close('H31 annualDepreciation(-5) — negative basis clamped', annualDepreciation(-5), 0);

/* ---- Actual method: city-rental default persona ---- */
{
  const r = actualMethod(RENTER);
  close('H40 renter.share = 200/1800', r.share, 1 / 9);
  close('H41 renter.housingCost = rent only', r.housingCost, 21600);
  close('H42 renter.operatingCost = 2400 + 600 + 800', r.operatingCost, 3800);
  close('H43 renter.depreciation — renters never depreciate', r.depreciation, 0);
  close('H44 renter.deduction = (1/9) × 25400', r.deduction, 25400 / 9);
  close('H45 renter.costPerSqFt = 25400/1800', r.costPerSqFt, 25400 / 1800);
  close('H46 renter.scheduleATransfer — 0 for renters', r.scheduleATransfer, 0);
  close('H47 renter.breakevenAnnualHomeCost = 5 × 1800', r.breakevenAnnualHomeCost, 9000);
  is('H48 renter.shareClamped', r.shareClamped, false);
}

/* ---- Actual method: suburban homeowner scenario ---- */
{
  const r = actualMethod(OWNER);
  close('H50 owner.share = 240/2400', r.share, 0.1);
  close('H51 owner.depreciation = 420000/39', r.depreciation, 420000 / 39);
  // total = 23000 + 6100 + 10769.230769 = 39869.230769 → 10%.
  close('H52 owner.deduction = 0.1 × 39869.230769', r.deduction, 3986.923076923077);
  close('H53 owner.scheduleATransfer = 0.1 × (16800 + 6200)', r.scheduleATransfer, 2300);
  close('H54 owner.costPerSqFt = 39869.230769/2400', r.costPerSqFt, 39869.23076923077 / 2400);
}

/* ---- Marginal saving mechanics ---- */
{
  const s = marginalSaving(1000, 24, false);
  close('H60 saving(income-tax only).incomeTax = 24% × 1000', s.incomeTax, 240);
  close('H61 saving(income-tax only).seTax = 0', s.seTax, 0);
  close('H62 saving(income-tax only).total', s.total, 240);
}
{
  const s = marginalSaving(1000, 24, true);
  close('H70 saving(Schedule C).seTax = 0.9235 × 15.3% × 1000', s.seTax, 141.2955);
  close('H71 saving(Schedule C).halfSeClawback = 24% × 70.64775', s.halfSeClawback, 16.95546);
  close('H72 saving(Schedule C).incomeTax = 240 − 16.95546', s.incomeTax, 223.04454);
  close('H73 saving(Schedule C).total = 141.2955 + 223.04454', s.total, 364.34004);
}
{
  const s = marginalSaving(1000, 150, true); // rate clamped to 100%
  close('H80 saving(rate 150 clamped).total = 141.2955 + (1000 − 70.64775)', s.total, 1070.64775);
  close('H81 saving(negative deduction).total = 0', marginalSaving(-50, 24, true).total, 0);
}

/* ---- Full comparison: default persona (city rental, 24%, SE on) ---- */
{
  const c = compareHomeOffice(RENTER, 24, true);
  close('H90 default.simplified.deduction = 5 × 200', c.simplified.deduction, 1000);
  close('H91 default.actual.deduction = 25400/9', c.actual.deduction, 25400 / 9);
  is('H92 default.winner — actual deducts more', c.winner, 'actual');
  close('H93 default.deductionDelta = 2822.2222 − 1000', c.deductionDelta, 25400 / 9 - 1000);
  // Both savings scale linearly at 0.36434004 per deduction dollar.
  close('H94 default.savingDelta = 0.36434004 × 1822.2222', c.savingDelta, 663.9085173333334);
  is('H95 default.crossoverSqFt — null when cost/sqft > $5', c.crossoverSqFt, null);
}

/* ---- Low-cost area: simplified wins, crossover exists ---- */
{
  const c = compareHomeOffice(LOWCOST, 24, true);
  close('H100 lowcost.actual.deduction = 0.05 × 11800', c.actual.deduction, 590);
  close('H101 lowcost.costPerSqFt = 11800/3000 < $5', c.actual.breakdown.costPerSqFt, 11800 / 3000);
  is('H102 lowcost.winner — simplified deducts more', c.winner, 'simplified');
  close('H103 lowcost.deductionDelta = 590 − 750', c.deductionDelta, -160);
  // x = 1500 ÷ (11800/3000) = 4,500,000/11,800.
  close('H104 lowcost.crossoverSqFt = 1500 ÷ costPerSqFt', c.crossoverSqFt, 4500000 / 11800);
}

/* ---- Tie within the 0.5-dollar tolerance ---- */
{
  const c = compareHomeOffice(TIE, 24, true);
  close('H110 tie.actual.deduction = (1/9) × 9000 = 1000', c.actual.deduction, 1000);
  is('H111 tie.winner', c.winner, 'tie');
  close('H112 tie.deductionDelta = 0', c.deductionDelta, 0);
}

/* ---- Office-area sweep (chart series) ---- */
{
  const s = officeAreaSweep(RENTER, 600, 61);
  is('H120 officeAreaSweep(…, 61).length', s.length, 61);
  close('H121 sweep[0].sqft — starts at zero', s[0].sqft, 0);
  close('H122 sweep[30].sqft — 10-sqft grid hits the 300 kink', s[30].sqft, 300);
  close('H123 sweep[30].simplifiedDeduction — flat at the ceiling', s[30].simplifiedDeduction, 1500);
  close('H124 sweep[30].actualDeduction = (300/1800) × 25400', s[30].actualDeduction, 25400 / 6);
  close('H125 sweep[60].sqft = min(home, maxSqFt)', s[60].sqft, 600);
  close('H126 sweep[60].actualDeduction = (600/1800) × 25400', s[60].actualDeduction, 25400 / 3);
}

if (failures.length > 0) {
  console.error(`homeoffice.test.mjs: ${failures.length}/${total} assertions FAILED:`);
  for (const f of failures) console.error('  ' + f);
  throw new Error(`homeoffice.test.mjs failed: ${failures.length} of ${total} assertions mismatched`);
}
console.log(`homeoffice.test.mjs: ${total}/${total} assertions passed`);

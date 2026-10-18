// estimated.test.mjs — permanent regression matrix for lib/estimated.ts
// (quarterly estimated tax / Form 1040-ES engine, tax year 2025).
//
// Pure node assertions, no test framework, no dependencies. Every expected
// value below was (a) hand-derived from the 2025 parameters named in
// EST_CONSTANTS (P.L. 119-21 §70103 standard deduction $15,750/$31,500;
// Rev. Proc. 2024-40 brackets; $176,100 SS wage base; §6654 safe harbors;
// 7% flat penalty rate) and (b) confirmed against the compiled engine
// before being written in.
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
//        1. $CALC_TEST_BUILD/lib/estimated.js  (rootDir-projected layout)
//        2. $CALC_TEST_BUILD/estimated.js      (flat layout, command above)
//   2. Run:  node scripts/tests/estimated.test.mjs
// The compiled emit keeps any '@/lib/*' import specifier verbatim from the
// TypeScript source (tsc never rewrites path aliases); the preamble below
// installs a Module._resolveFilename hook that maps '@/lib/<x>' to the
// compiled sibling, so no post-emit rewriting is needed. (estimated.js
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
  FED_BRACKETS_2025,
  EST_CONSTANTS,
  QUARTERS_2025,
  taxFromBrackets,
  stdDeductionFor,
  seTaxOf,
  currentYearTaxAt,
  computeEstimatedTax,
  skipPenaltyEstimate,
  safeHarborSweep,
} = require(buildModule('estimated'));

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

/* ---- 2025 parameters (P.L. 119-21 / Rev. Proc. 2024-40 / §6654) ---- */
is('E1 stdDeductionFor(single) — §70103 raised amount', stdDeductionFor('single'), 15750);
is('E2 stdDeductionFor(mfj)', stdDeductionFor('mfj'), 31500);
is('E3 EST_CONSTANTS.stdDeductionSingle', EST_CONSTANTS.stdDeductionSingle, 15750);
is('E4 QUARTERS_2025 installment count', QUARTERS_2025.length, 4);
is('E5 QUARTERS_2025 days to Apr-15-2026 filing sum to 970', QUARTERS_2025.reduce((s, q) => s + q.daysToApr15Filing, 0), 970);
is('E6 QUARTERS_2025[1].due — Q2 shifted off Sunday Jun 15', QUARTERS_2025[1].due, 'Jun 16, 2025');

/* ---- Bracket walker (hand-summed slices, single) ---- */
// 10%×11925 + 12%×36550 + 22%×54875 + 24%×46650 = 1192.50+4386+12072.50+11196.
close('E7 taxFromBrackets(150000, single 2025)', taxFromBrackets(150000, FED_BRACKETS_2025.single), 28847);
close('E8 taxFromBrackets(11925) — exact 10% bracket top', taxFromBrackets(11925, FED_BRACKETS_2025.single), 1192.5);
close('E9 taxFromBrackets(0)', taxFromBrackets(0, FED_BRACKETS_2025.single), 0);
close('E10 taxFromBrackets(-100) — negative income walks no brackets', taxFromBrackets(-100, FED_BRACKETS_2025.single), 0);

/* ---- Schedule SE layer ---- */
{
  const s = seTaxOf(100000);
  close('E11 seTaxOf(100000).seBase = 0.9235 × 100000', s.seBase, 92350);
  close('E12 seTaxOf(100000).seTax = 0.153 × 92350', s.seTax, 14129.55);
  close('E13 seTaxOf(100000).halfSe', s.halfSe, 7064.775);
}
{
  const s = seTaxOf(300000);
  // 0.153 × 176100 + 0.029 × 100950 = 26943.30 + 2927.55.
  close('E14 seTaxOf(300000).seTax above the wage base', s.seTax, 29870.85);
  close('E15 seTaxOf(300000).halfSe', s.halfSe, 14935.425);
}
close('E16 seTaxOf(400).seTax — base 369.40 < $400 floor', seTaxOf(400).seTax, 0);
close('E17 seTaxOf(433).seTax — base 399.8755 still under floor', seTaxOf(433).seTax, 0);
close('E18 seTaxOf(434).seTax — cliff: 0.153 × 400.799', seTaxOf(434).seTax, 61.322247);

/* ---- Current-year chain: flagship worked example (100k single) ---- */
{
  const t = currentYearTaxAt(100000, 'single');
  close('E19 cy(100k).agi = 100000 − 7064.775', t.agi, 92935.225);
  // 20% cap on taxable income binds: min(18587.045, 15437.045).
  close('E20 cy(100k).qbiDeduction = 20% × 77185.225', t.qbiDeduction, 15437.045);
  close('E21 cy(100k).taxableIncome', t.taxableIncome, 61748.18);
  // 1192.50 + 4386 + 22% × 13273.18 = 8498.5996.
  close('E22 cy(100k).incomeTax', t.incomeTax, 8498.5996);
  close('E23 cy(100k).totalTax = 14129.55 + 8498.5996', t.totalTax, 22628.1496);
  close('E24 cy(100k).qbiPhaseOutPct — far below $197,300 threshold', t.qbiPhaseOutPct, 0);
}
close('E25 cy(20000).totalTax — low earner: SE 2825.91 + 10% bracket', currentYearTaxAt(20000, 'single').totalTax, 3052.8736);
{
  const t = currentYearTaxAt(300000, 'single');
  close('E26 cy(300k).qbiPhaseOutPct = min(1, 72014.575/50000) → fully phased out', t.qbiPhaseOutPct, 1);
  close('E27 cy(300k).qbiDeduction = 0 (no-employee world)', t.qbiDeduction, 0);
  close('E28 cy(300k).taxableIncome = 285064.575 − 15750', t.taxableIncome, 269314.575);
  // 57231 (cum. to 250525) + 35% × 18789.575 = 63807.35125.
  close('E29 cy(300k).incomeTax', t.incomeTax, 63807.35125);
  close('E30 cy(300k).totalTax = 29870.85 + 63807.35125', t.totalTax, 93678.20125);
}
{
  const t = currentYearTaxAt(230000, 'single');
  // tibq 200251.9275 → (200251.9275 − 197300)/50000.
  close('E31 cy(230k).qbiPhaseOutPct inside the band = 2951.9275/50000', t.qbiPhaseOutPct, 0.05903855);
  close('E32 cy(230k).qbiDeduction = 20% × tibq cap binds', t.qbiDeduction, 40050.3855);
}

/* ---- Full 1040-ES: default persona (100k single, prior tax 19,500) ---- */
{
  const r = computeEstimatedTax({ netSE: 100000, filingStatus: 'single', w2Withholding: 0, priorTax: 19500, priorAgiOver150k: false });
  close('E40 default.current90 = 0.9 × 22628.1496', r.current90, 20365.33464);
  close('E41 default.prior100 = 19500', r.prior100, 19500);
  close('E42 default.prior110 (not applicable, AGI ≤ 150k flag off but computed) = 21450', r.prior110, 21450);
  is('E43 default.applicable — prior-year harbor binds', r.applicable, 'prior100');
  close('E44 default.harborBasis = min(19500, 20365.33464)', r.harborBasis, 19500);
  close('E45 default.requiredAnnualPayment', r.requiredAnnualPayment, 19500);
  close('E46 default.perQuarter = 19500 ÷ 4', r.perQuarter, 4875);
  close('E47 default.quarterly[3].cumulative', r.quarterly[3].cumulative, 19500);
  // 4875 × 7% × (970/365) = 906.883561643836.
  close('E48 default.penaltyEstimate — skip-all-four simple interest', r.penaltyEstimate, 906.883561643836);
  close('E49 default.expectedAtFiling = 22628.1496 − 19500', r.expectedAtFiling, 3128.1496);
  close('E50 default.effectiveRate = 22.6281496%', r.effectiveRate, 22.6281496);
  is('E51 default.deMinimisExempt — 22628 ≥ 1000', r.deMinimisExempt, false);
  close('E52 default.withholdingCoveragePct — no withholding', r.withholdingCoveragePct, 0);
}

/* ---- §6654(e) exemptions ---- */
{
  const r = computeEstimatedTax({ netSE: 7000, filingStatus: 'single', w2Withholding: 0, priorTax: 19500, priorAgiOver150k: false });
  close('E60 deMinimis: cy(7000).totalTax = 0.153 × 6464.5 = 989.0685 < 1000', r.currentTotalTax, 989.0685);
  is('E61 deMinimis exemption applies', r.deMinimisExempt, true);
  close('E62 deMinimis: required payment zeroed', r.requiredAnnualPayment, 0);
  close('E63 deMinimis: penalty estimate zeroed', r.penaltyEstimate, 0);
  close('E64 deMinimis: whole tax due at filing', r.expectedAtFiling, 989.0685);
}
{
  const r = computeEstimatedTax({ netSE: 100000, filingStatus: 'single', w2Withholding: 0, priorTax: 0, priorAgiOver150k: false });
  is('E65 prior-year-zero exemption (§6654(e)(2))', r.priorYearZeroExempt, true);
  close('E66 prior-zero: required payment zeroed', r.requiredAnnualPayment, 0);
  close('E67 prior-zero: balloon = full 22628.1496', r.expectedAtFiling, 22628.1496);
}

/* ---- Harbor selection branches ---- */
{
  const r = computeEstimatedTax({ netSE: 100000, filingStatus: 'single', w2Withholding: 0, priorTax: 10000, priorAgiOver150k: true });
  is('E70 110% prior harbor selected (AGI > 150k)', r.applicable, 'prior110');
  close('E71 110%: required = 1.1 × 10000', r.requiredAnnualPayment, 11000);
  close('E72 110%: perQuarter = 2750', r.perQuarter, 2750);
}
{
  const r = computeEstimatedTax({ netSE: 100000, filingStatus: 'single', w2Withholding: 0, priorTax: 30000, priorAgiOver150k: false });
  is('E73 90% current harbor binds when prior tax exceeds it', r.applicable, 'current90');
  close('E74 current90: required = 20365.33464', r.requiredAnnualPayment, 20365.33464);
  close('E75 current90: perQuarter = 5091.33366', r.perQuarter, 5091.33366);
}
{
  const r = computeEstimatedTax({ netSE: 100000, filingStatus: 'single', w2Withholding: 0, priorTax: null, priorAgiOver150k: false });
  is('E76 prior tax unknown → prior100 is null', r.prior100, null);
  is('E77 prior tax unknown → priorTaxKnown false', r.priorTaxKnown, false);
  is('E78 prior tax unknown → only the 90% harbor', r.applicable, 'current90');
}

/* ---- Penalty estimate closed form & sweep ---- */
close('E80 skipPenaltyEstimate(10000, 0) = 2500 × 7% × 970/365', skipPenaltyEstimate(10000, 0), 465.068493150685);
close('E81 skipPenaltyEstimate(10000, 10000) — fully covered', skipPenaltyEstimate(10000, 10000), 0);
{
  const s = safeHarborSweep({ filingStatus: 'single', w2Withholding: 0, priorTax: 19500, priorAgiOver150k: false }, 20000, 400000, 5);
  is('E82 safeHarborSweep(…, 5).length', s.length, 5);
  close('E83 sweep[0].income — inclusive start', s[0].income, 20000);
  close('E84 sweep[0].current90Net = 0.9 × 3052.8736', s[0].current90Net, 2747.58624);
  close('E85 sweep[0].priorNet — flat 19500 line', s[0].priorNet, 19500);
  close('E86 sweep[0].requiredNet = min of the two harbors', s[0].requiredNet, 2747.58624);
  close('E87 sweep[2].income — midpoint of 20000..400000', s[2].income, 210000);
}

if (failures.length > 0) {
  console.error(`estimated.test.mjs: ${failures.length}/${total} assertions FAILED:`);
  for (const f of failures) console.error('  ' + f);
  throw new Error(`estimated.test.mjs failed: ${failures.length} of ${total} assertions mismatched`);
}
console.log(`estimated.test.mjs: ${total}/${total} assertions passed`);

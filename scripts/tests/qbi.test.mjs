// qbi.test.mjs — permanent regression matrix for lib/qbi.ts
// (§199A Qualified Business Income deduction, Form 8995 / 8995-A, tax year 2025).
//
// Pure node assertions, no test framework, no dependencies. Every expected
// value below was (a) hand-derived from the 2025 parameters (Rev. Proc.
// 2024-40 thresholds $197,300/$394,600; statutory $50,000/$100,000 phase-in
// ranges; 20% rate; 50%-of-wages vs 25%-of-wages + 2.5%-of-UBIA limit) and
// (b) confirmed against the compiled engine before being written in.
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
//        1. $CALC_TEST_BUILD/lib/qbi.js       (rootDir-projected layout)
//        2. $CALC_TEST_BUILD/qbi.js           (flat layout, command above)
//   2. Run:  node scripts/tests/qbi.test.mjs
// NOTE: qbi.ts is the one lib in this group whose source imports through the
// '@/lib/tax' path alias; tsc leaves that specifier verbatim in the emit
// (and, without a paths-mapped tsconfig, reports a non-fatal TS2307 while
// still emitting correct JS). The preamble below installs a
// Module._resolveFilename hook mapping '@/lib/<x>' to the compiled sibling
// in the build dir — no post-emit rewriting is needed.

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
  QBI_CONSTANTS,
  applicablePercentage,
  computeQbiDeduction,
  phaseOutSweep,
  wageSweep,
  wagesNeededToUnlock,
  taxValueOfDeduction,
} = require(buildModule('qbi'));

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

const D = (qbi, taxableIncome, w2Wages, ubia, sstb, filingStatus) =>
  computeQbiDeduction({ qbi, taxableIncome, w2Wages, ubia, sstb, filingStatus });

/* ---- 2025 parameters (Rev. Proc. 2024-40 / IRC §199A(e)(2)) ---- */
is('Q1 threshold single', QBI_CONSTANTS.threshold.single, 197300);
is('Q2 threshold mfj', QBI_CONSTANTS.threshold.mfj, 394600);
is('Q3 phase-in range single', QBI_CONSTANTS.phaseInRange.single, 50000);
is('Q4 phase-in range mfj', QBI_CONSTANTS.phaseInRange.mfj, 100000);

/* ---- Applicable percentage (clamps and mid-band linearity) ---- */
close('Q10 ap(210000, single) = 1 − 12700/50000', applicablePercentage(210000, 'single'), 0.746);
close('Q11 ap(150000, single) clamps to 1 below threshold', applicablePercentage(150000, 'single'), 1);
close('Q12 ap(300000, single) clamps to 0 above the band', applicablePercentage(300000, 'single'), 0);
close('Q13 ap(494600, mfj) = 0 at band top', applicablePercentage(494600, 'mfj'), 0);
close('Q14 ap(394600, mfj) = 1 at threshold', applicablePercentage(394600, 'mfj'), 1);
close('Q15 ap(414600, mfj) = 0.8 (AICPA Ex.6 pip = 20%)', applicablePercentage(414600, 'mfj'), 0.8);

/* ---- Below threshold: wage limit does not apply (§199A(b)(3)(A)) ---- */
{
  const r = D(120000, 150000, 0, 0, false, 'single');
  is('Q20 below-threshold.aboveThreshold', r.aboveThreshold, false);
  close('Q21 below-threshold.tentativeDeduction = 20% × 120000', r.tentativeDeduction, 24000);
  is('Q22 below-threshold.wageLimitBasis — no wages, limit waived', r.wageLimitBasis, 'none');
  close('Q23 below-threshold.deduction = full 24000 despite L = 0', r.deduction, 24000);
  is('Q24 below-threshold.limiter', r.limiter, 'qbi');
}

/* ---- Flagship default (QbiCalculator DEFAULTS: 150k QBI, 220k TI, 40k wages, non-SSTB, single) ---- */
{
  const r = D(150000, 220000, 40000, 0, false, 'single');
  is('Q30 default.aboveThreshold (220000 > 197300)', r.aboveThreshold, true);
  is('Q31 default.inPhaseRange (≤ 247300)', r.inPhaseRange, true);
  close('Q32 default.applicablePct = 1 − 22700/50000', r.applicablePct, 0.546);
  // Non-SSTB: Schedule A reduction does not touch QBI/wages.
  close('Q33 default.tentativeDeduction = 20% × 150000', r.tentativeDeduction, 30000);
  close('Q34 default.wageLimit50 = 50% × 40000', r.wageLimit50, 20000);
  close('Q35 default.wageLimitAlt = 25% × 40000 + 2.5% × 0', r.wageLimitAlt, 10000);
  close('Q36 default.wageLimit = greater branch', r.wageLimit, 20000);
  is('Q37 default.wageLimitBasis', r.wageLimitBasis, '50-percent');
  close('Q38 default.excess = T − L = 10000', r.excess, 10000);
  close('Q39 default.phaseInReduction = 10000 × 0.454', r.phaseInReduction, 4540);
  // line 13 = greater of min(T,L)=20000 and T − excess×pip = 25460.
  close('Q40 default.component = 30000 − 4540', r.component, 25460);
  close('Q41 default.incomeCap = 20% × 220000', r.incomeCap, 44000);
  close('Q42 default.deduction', r.deduction, 25460);
  is('Q43 default.limiter — wage-limited, not capped', r.limiter, 'wage');
  is('Q44 default.fullyUnlocked false', r.fullyUnlocked, false);
}

/* ---- SSTB mid-band: the ap² mechanic (Schedule A reduction + Part III phase-in) ---- */
{
  const r = D(150000, 220000, 0, 0, true, 'single');
  close('Q50 sstbMid.qbiEffective = 150000 × 0.546', r.qbiEffective, 81900);
  close('Q51 sstbMid.tentativeDeduction = 20% × 81900', r.tentativeDeduction, 16380);
  // Deduction = 16380 × (1 − 0.454) = 20% × 150000 × 0.546².
  close('Q52 sstbMid.deduction = 20% × QBI × ap² (mid-band subtlety)', r.deduction, 8943.48);
}

/* ---- Regression anchor: AICPA Tax Adviser worked example 6 (JSDoc) ---- */
// SSTB, no wages, MFJ, taxable income $20,000 over the threshold → pip = 20%:
// T = 20% × 225000 × 0.8 = 36000; component = 36000 − 36000 × 0.2 = 28800.
{
  const r = D(225000, 414600, 0, 0, true, 'mfj');
  close('Q60 AICPA Ex.6.tentativeDeduction = 36000', r.tentativeDeduction, 36000);
  close('Q61 AICPA Ex.6.deduction = 20% × 225000 × 0.8² = 28800', r.deduction, 28800);
}

/* ---- SSTB above the band: excluded outright (§199A(d)) ---- */
{
  const r = D(150000, 260000, 0, 0, true, 'single');
  is('Q70 sstbAbove.sstbExcluded (260000 > 247300)', r.sstbExcluded, true);
  close('Q71 sstbAbove.applicablePct = 0', r.applicablePct, 0);
  close('Q72 sstbAbove.deduction = 0', r.deduction, 0);
}

/* ---- Wage limit satisfied / alt branch / income cap / losses ---- */
{
  const r = D(150000, 220000, 300000, 0, false, 'single');
  is('Q80 bigWages.fullyUnlocked (L ≥ T)', r.fullyUnlocked, true);
  close('Q81 bigWages.deduction = full 30000', r.deduction, 30000);
}
{
  const r = D(100000, 220000, 40000, 600000, false, 'single');
  // alt = 25% × 40000 + 2.5% × 600000 = 10000 + 15000 = 25000 > 20000.
  close('Q90 ubiaBranch.wageLimitAlt', r.wageLimitAlt, 25000);
  is('Q91 ubiaBranch.wageLimitBasis', r.wageLimitBasis, '25-plus-ubia');
  close('Q92 ubiaBranch.deduction = 20% × 100000 (excess 0)', r.deduction, 20000);
}
{
  const r = D(500000, 100000, 0, 0, false, 'single');
  close('Q100 capCase.component = 20% × 500000', r.component, 100000);
  close('Q101 capCase.incomeCap = 20% × 100000', r.incomeCap, 20000);
  close('Q102 capCase.deduction = cap', r.deduction, 20000);
  is('Q103 capCase.limiter', r.limiter, 'cap');
}
is('Q110 qbiLoss flag on zero QBI', D(0, 150000, 0, 0, false, 'single').qbiLoss, true);
close('Q111 qbiLoss.deduction = 0', D(0, 150000, 0, 0, false, 'single').deduction, 0);
close('Q112 negative inputs sanitized (qbi −5000 → loss)', D(-5000, 150000, -100, -100, false, 'single').deduction, 0);

/* ---- wagesNeededToUnlock (inverse of the wage limit) ---- */
{
  const base = { qbi: 150000, taxableIncome: 220000, w2Wages: 40000, ubia: 0, sstb: false, filingStatus: 'single' };
  // T = 30000 → 50% branch needs W_e = 60000; non-SSTB → full wages 60000.
  close('Q120 wagesNeeded(default persona) = 30000 ÷ 0.5', wagesNeededToUnlock(base), 60000);
  // SSTB mid-band: W_e needed = 16380 ÷ 0.5 = 32760, divided by ap 0.546.
  close('Q121 wagesNeeded(sstb mid-band) = 32760 ÷ 0.546', wagesNeededToUnlock({ ...base, w2Wages: 0, sstb: true }), 60000);
  is('Q122 wagesNeeded(below threshold) — limit never applies', wagesNeededToUnlock({ ...base, taxableIncome: 150000, qbi: 120000 }), null);
  is('Q123 wagesNeeded(already unlocked)', wagesNeededToUnlock({ ...base, w2Wages: 300000 }), null);
  is('Q124 wagesNeeded(qbi loss)', wagesNeededToUnlock({ ...base, qbi: 0 }), null);
}

/* ---- Sweeps (chart series) ---- */
{
  const s = phaseOutSweep({ qbi: 150000, w2Wages: 0, ubia: 0, filingStatus: 'single' }, 197300, 247300, 3);
  is('Q130 phaseOutSweep(…, 3).length', s.length, 3);
  close('Q131 sweep ti = 197300 (at threshold: not above it)', s[0].ti, 197300);
  close('Q132 sweep[0].sstb — at threshold, no reduction yet', s[0].sstb, 30000);
  close('Q133 sweep[0].nonSstb', s[0].nonSstb, 30000);
  close('Q134 sweep[1].ti — band midpoint', s[1].ti, 222300);
  close('Q135 sweep[1].sstb = 30000 × 0.5²', s[1].sstb, 7500);
  close('Q136 sweep[1].nonSstb = 30000 × 0.5 (single reduction)', s[1].nonSstb, 15000);
  close('Q137 sweep[2].sstb — zero at band top', s[2].sstb, 0);
  close('Q138 sweep[2].nonSstb — wage-less business also zeroed by pip = 1', s[2].nonSstb, 0);
}
{
  const w = wageSweep({ qbi: 150000, taxableIncome: 220000, w2Wages: 0, ubia: 0, sstb: false, filingStatus: 'single' }, 0, 60000, 3);
  close('Q140 wageSweep[0].deduction — no wages: 30000 × 0.546', w[0].deduction, 16380);
  close('Q141 wageSweep[1].deduction at 30000 wages: 30000 − 15000×0.454', w[1].deduction, 23190);
  close('Q142 wageSweep[2].deduction at 60000 wages: fully unlocked', w[2].deduction, 30000);
}

/* ---- Approximate tax value of the deduction (2025 brackets) ---- */
// Single @220000 = 47463; @194540 = 39536.60 → difference 7926.40.
close('Q150 taxValueOfDeduction(220000, 25460, single)', taxValueOfDeduction(220000, 25460, 'single'), 7926.4);
// MFJ @300000 = 57694; @282000 = 53374 → 4320 (all inside the 24% bracket).
close('Q151 taxValueOfDeduction(300000, 18000, mfj)', taxValueOfDeduction(300000, 18000, 'mfj'), 4320);

if (failures.length > 0) {
  console.error(`qbi.test.mjs: ${failures.length}/${total} assertions FAILED:`);
  for (const f of failures) console.error('  ' + f);
  throw new Error(`qbi.test.mjs failed: ${failures.length} of ${total} assertions mismatched`);
}
console.log(`qbi.test.mjs: ${total}/${total} assertions passed`);

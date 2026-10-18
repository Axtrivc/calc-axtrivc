// Permanent regression matrix for the /guides/self-employed-health-insurance/
// playbook's worked numbers (tax year 2025) — pure-Node assertions, no test
// framework, no dependencies beyond node itself.
//
// RUN PREREQUISITE (owned by the unified test runner, NOT by this file): the
// engine libs must already be compiled to CommonJS under scripts/tests/.build/
// preserving the lib/ layout (rootDir = repo root), resolvable as either
//   1. $CALC_TEST_BUILD/lib/<name>.js  (rootDir-projected layout)
//   2. $CALC_TEST_BUILD/<name>.js      (flat layout)
// The loader hook below also redirects '@/lib/*' alias imports (paytype, qbi
// and estimated import '@/lib/tax') at the build dir. Then:
//   node scripts/tests/self-employed-health-insurance-guide.test.mjs
//
// Scope: the guide interpolates every figure from module-scope engine calls —
// this file pins those exact values so a lib change that moves one breaks the
// build instead of silently shipping a wrong number. Engines exercised:
//   lib/paytype (seTaxOnNet, addlMedicareSE, PAYTYPE_CONSTANTS)
//   lib/qbi     (computeQbiDeduction, QBI_CONSTANTS)
//   lib/hsa     (hsaLimitFor, HSA_CONSTANTS)
//   lib/tax     (taxFromBrackets, FED_BRACKETS_2025)
//   lib/estimated (EST_CONSTANTS.stdDeductionSingle)
// The S-corp W-2 and month-ledger arithmetic is plain math on the engines' own
// constants (PAYTYPE_CONSTANTS rates), exactly as the component computes it.
// Every expected value was hand-derived from the documented 2025 parameters
// and confirmed against the compiled engines before being written in. Any
// mismatch throws with input → expected → actual.

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
const { seTaxOnNet, addlMedicareSE, PAYTYPE_CONSTANTS } = require(buildModule('paytype'));
const { computeQbiDeduction, QBI_CONSTANTS } = require(buildModule('qbi'));
const { hsaLimitFor, HSA_CONSTANTS } = require(buildModule('hsa'));
const { taxFromBrackets, FED_BRACKETS_2025 } = require(buildModule('tax'));
const { EST_CONSTANTS } = require(buildModule('estimated'));

/* ------------------------------- harness ---------------------------------- */

let passed = 0;
const failures = [];

function close(actual, expected, label) {
  const ok = Math.abs(actual - expected) <= 1e-6;
  if (ok) passed += 1;
  else failures.push(`${label}: expected ${expected} → actual ${actual}`);
}
function same(actual, expected, label) {
  const ok = actual === expected;
  if (ok) passed += 1;
  else failures.push(`${label}: expected ${expected} → actual ${actual}`);
}

/* ------------------ the guide's module-scope math, verbatim ---------------- */

const NET = 96_000;
const MONTHLY = 1_320;
const PREMIUM = MONTHLY * 12;
const SE_BASE = PAYTYPE_CONSTANTS.seBaseFactor; // 92.35%, §1402(a)
const STD = EST_CONSTANTS.stdDeductionSingle; // $15,750, P.L. 119-21 §70103

const SE_TAX = seTaxOnNet(NET);
const HALF_SE = (SE_TAX - addlMedicareSE(NET)) / 2; // §164(f)
const SEHI_CAP = Math.max(0, NET * SE_BASE - HALF_SE); // §162(l)(2)(A) cap
const SEHI = Math.min(PREMIUM, SEHI_CAP);

const SE_IF_EXPENSE = seTaxOnNet(NET - PREMIUM);
const SE_TAX_UNTOUCHED = SE_TAX - SE_IF_EXPENSE;

const QBI_COMMON = { w2Wages: 0, ubia: 0, sstb: true, filingStatus: 'single' };
const QBI_WITH_SEHI = computeQbiDeduction({
  ...QBI_COMMON,
  qbi: NET - HALF_SE - SEHI,
  taxableIncome: Math.max(0, NET - HALF_SE - SEHI - STD),
});
const QBI_NO_SEHI = computeQbiDeduction({
  ...QBI_COMMON,
  qbi: NET - HALF_SE,
  taxableIncome: Math.max(0, NET - HALF_SE - STD),
});
const TI_WITH = Math.max(0, NET - HALF_SE - SEHI - STD - QBI_WITH_SEHI.deduction);
const TI_WITHOUT = Math.max(0, NET - HALF_SE - STD - QBI_NO_SEHI.deduction);
const TAX_WITH = taxFromBrackets(TI_WITH, FED_BRACKETS_2025);
const TAX_WITHOUT = taxFromBrackets(TI_WITHOUT, FED_BRACKETS_2025);
const TAX_SAVED = TAX_WITHOUT - TAX_WITH;
const TAX_SAVED_PCT = (TAX_SAVED / SEHI) * 100;
const QBI_GIVEN_BACK = QBI_NO_SEHI.deduction - QBI_WITH_SEHI.deduction;

const EXIT = { profit: 58_000, eligibleMonths: 7, paidMonths: 8 };
const SE_EXIT = seTaxOnNet(EXIT.profit);
const HALF_SE_EXIT = (SE_EXIT - addlMedicareSE(EXIT.profit)) / 2;
const CAP_EXIT = Math.max(0, EXIT.profit * SE_BASE - HALF_SE_EXIT);
const ALLOWED_EXIT = EXIT.eligibleMonths * MONTHLY;
const SEHI_EXIT = Math.min(ALLOWED_EXIT, CAP_EXIT);
const OVERLAP_EXCLUDED = (EXIT.paidMonths - EXIT.eligibleMonths) * MONTHLY;
const MONTHS_FOREGONE = PREMIUM - SEHI_EXIT;

const THIN_NET = 9_600;
const SE_THIN = seTaxOnNet(THIN_NET);
const HALF_SE_THIN = (SE_THIN - addlMedicareSE(THIN_NET)) / 2;
const CAP_THIN = Math.max(0, THIN_NET * SE_BASE - HALF_SE_THIN);
const SEHI_THIN = Math.min(PREMIUM, CAP_THIN);
const EXCESS_THIN = PREMIUM - SEHI_THIN;

const SCORP = { salary: 70_000, monthly: 650 };
const SC_PREMIUM = SCORP.monthly * 12;
const BOX1 = SCORP.salary + SC_PREMIUM;
const FICA_RATE = PAYTYPE_CONSTANTS.ssRate + PAYTYPE_CONSTANTS.medicareRate;
const FICA_SAVED_EE = SC_PREMIUM * FICA_RATE;
const FICA_SAVED_BOTH = 2 * FICA_SAVED_EE;
const FICA_PAIR_RATE = 2 * FICA_RATE;
const FICA_AT_PERSONA = PREMIUM * FICA_PAIR_RATE;

/* ------------------------------- assertions -------------------------------- */

/* Full-year persona. */
close(SE_TAX, 13_564.368, 'seTaxOnNet(96,000)');
close(HALF_SE, 6_782.184, '½ SE tax, §164(f)');
close(SEHI_CAP, 81_873.816, '§162(l) earned-income cap at 96,000 net');
same(SEHI, 15_840, 'SEHI = min(premium, cap) at 96,000 net');

/* SE-tax indifference to the above-the-line deduction. */
close(SE_IF_EXPENSE, 11_326.24728, 'seTaxOnNet(80,160) — hypothetical Schedule C expense');
close(SE_TAX_UNTOUCHED, 2_238.12072, 'SE tax the §162(l) structure leaves in place');

/* QBI interaction, with and without the SEHI deduction. */
close(NET - HALF_SE - SEHI, 73_377.816, 'QBI base with SEHI (§199A(c)(1))');
close(Math.max(0, NET - HALF_SE - SEHI - STD), 57_627.816, 'TI before QBI with SEHI');
close(QBI_WITH_SEHI.tentativeDeduction, 14_675.5632, 'T = 20% × QBI, with SEHI');
close(QBI_WITH_SEHI.incomeCap, 11_525.5632, '20% × TI cap, with SEHI');
close(QBI_WITH_SEHI.deduction, 11_525.5632, '§199A deduction, with SEHI');
same(QBI_WITH_SEHI.limiter, 'cap', 'limiter with SEHI');
close(NET - HALF_SE, 89_217.816, 'QBI base without SEHI');
close(QBI_NO_SEHI.tentativeDeduction, 17_843.5632, 'T = 20% × QBI, without SEHI');
close(QBI_NO_SEHI.incomeCap, 14_693.5632, '20% × TI cap, without SEHI');
close(QBI_NO_SEHI.deduction, 14_693.5632, '§199A deduction, without SEHI');
close(QBI_GIVEN_BACK, QBI_CONSTANTS.qbiRate * PREMIUM, 'ΔQBI = 20% × premium');
close(QBI_GIVEN_BACK, 3_168.0, 'ΔQBI dollar value');
close(TI_WITH, 46_102.2528, 'final TI with SEHI');
close(TI_WITHOUT, 58_774.2528, 'final TI without SEHI');
close(TAX_WITH, 5_293.770336, 'federal income tax with SEHI');
close(TAX_WITHOUT, 7_844.335616, 'federal income tax without SEHI');
close(TAX_SAVED, 2_550.56528, 'income tax saved by the SEHI deduction');
close(TAX_SAVED_PCT, (2_550.56528 / 15_840) * 100, 'saving as % of premium face');
same(QBI_WITH_SEHI.aboveThreshold, false, 'persona below the §199A threshold');

/* Mid-year exit month ledger. */
close(SE_EXIT, 8_195.139, 'seTaxOnNet(58,000) — exit-year profit');
close(HALF_SE_EXIT, 4_097.5695, '½ SE tax on exit-year profit');
close(CAP_EXIT, 49_465.4305, '§162(l) cap on exit-year profit');
same(ALLOWED_EXIT, 9_240, 'eligible-month premium, 7 × $1,320');
same(SEHI_EXIT, 9_240, 'exit-year SEHI');
same(OVERLAP_EXCLUDED, 1_320, 'overlap month excluded under §162(l)(2)(B)');
same(MONTHS_FOREGONE, 6_600, 'months not deductible vs a full year');

/* Thin-profit year: the cap binds. */
close(SE_THIN, 1_356.4368, 'seTaxOnNet(9,600)');
close(CAP_THIN, 8_187.3816, '§162(l) cap, thin year');
same(SEHI_THIN, 8_187.3816 < PREMIUM ? CAP_THIN : PREMIUM, 'thin-year SEHI (capped)');
close(EXCESS_THIN, 7_652.6184, 'premium with no above-the-line home, thin year');

/* >2% S-corp shareholder W-2 arithmetic. */
close(FICA_RATE, 0.0765, 'per-half FICA rate 6.2% + 1.45%');
close(FICA_PAIR_RATE, 0.153, 'both-halves FICA rate');
same(BOX1, 77_800, 'W-2 Box 1 = salary + premium');
same(SC_PREMIUM, 7_800, 'group-plan premium, 12 × $650');
close(FICA_SAVED_EE, 596.7, 'employee FICA not paid on the premium');
close(FICA_SAVED_BOTH, 1_193.4, 'both FICA halves not paid on the premium');
close(FICA_AT_PERSONA, 2_423.52, 'FICA pair at the persona premium rate');

/* HSA limits (2025, Rev. Proc. 2024-25) and threshold sanity. */
same(hsaLimitFor('self', false), HSA_CONSTANTS.selfLimit, 'HSA self limit');
same(hsaLimitFor('family', false), HSA_CONSTANTS.familyLimit, 'HSA family limit');
same(hsaLimitFor('family', true), HSA_CONSTANTS.familyLimit + HSA_CONSTANTS.catchUp55, 'HSA family 55+ limit');
same(HSA_CONSTANTS.selfLimit, 4_300, 'HSA self limit 2025 value');
same(HSA_CONSTANTS.familyLimit, 8_550, 'HSA family limit 2025 value');
same(HSA_CONSTANTS.catchUp55, 1_000, 'HSA catch-up statutory value');
same(QBI_CONSTANTS.threshold.single, 197_300, '§199A single threshold 2025');

/* --------------------------------- report ---------------------------------- */

if (failures.length > 0) {
  console.error(`self-employed-health-insurance-guide: ${failures.length} FAILED assertion(s):`);
  for (const f of failures) console.error(`  ✗ ${f}`);
  process.exit(1);
}
console.log(`self-employed-health-insurance-guide.test.mjs: ${passed}/${passed} assertions passed`);

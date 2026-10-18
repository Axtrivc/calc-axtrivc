// hsa.test.mjs — permanent regression matrix for lib/hsa.ts
// (Health Savings Account triple-tax-advantage model, tax year 2025).
//
// Pure node assertions, no test framework, no dependencies. Every expected
// value below was (a) hand-derived from the 2025 parameters and equations in
// the lib header (limits $4,300/$8,550 + $1,000 age-55 catch-up per Rev.
// Proc. 2024-25 and IRC §223(b)(3); 20% non-qualified additional tax per
// §223(f)(4); annuity-due factor AF(r,N) = ((1+r)^N − 1)/r × (1+r); taxable
// twin grows at g = r·(1−t); HSA value = (1−m)·C·AF(r,N) − p·(1−m)·C·AF(r,N)·
// (t + 20%); twin value = C·(1−t−m)·AF(g,N)) and (b) confirmed against the
// compiled engine (tsc → node) before being written in. Hand power chains
// (1.07^25 = 5.427433, 1.0532^25 = 3.654023, 1.063^25 = 4.606081) were
// carried to 7 significant digits and reconciled against engine output.
//
// RUN PREREQUISITE — provided by the unified test runner, NOT by this file:
//   1. Compile the pure libs to CommonJS into scripts/tests/.build/ with the
//      rootDir-projected layout (lib/*.js). The compiled module is resolved
//      from the first existing candidate, overridable with $CALC_TEST_BUILD:
//        1. $CALC_TEST_BUILD/lib/hsa.js   (rootDir-projected layout)
//        2. $CALC_TEST_BUILD/hsa.js       (flat layout)
//   2. Run:  node scripts/tests/hsa.test.mjs
// The Module._resolveFilename hook below maps '@/lib/<x>' to the compiled
// sibling in the build dir, matching the suite's other test files.

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
  HSA_CONSTANTS,
  hsaLimitFor,
  annuityDueFactor,
  nonQualifiedWithdrawal,
  compareHsa,
  hsaRateSensitivity,
  hsaHorizonSweep,
} = require(buildModule('hsa'));

let total = 0;
const failures = [];
/** Numeric assertion. Default tolerance absorbs float-op-order noise only. */
function close(name, actual, expected, eps) {
  total++;
  const tol = eps ?? 1e-6;
  if (!(Math.abs(actual - expected) <= tol)) {
    failures.push(`输入 ${name} → 期望 ${expected} → 实际 ${actual}`);
  }
}
/** Exact assertion (integers that must be exact, strings, booleans). */
function is(name, actual, expected) {
  total++;
  if (actual !== expected) {
    failures.push(`输入 ${name} → 期望 ${JSON.stringify(expected)} → 实际 ${JSON.stringify(actual)}`);
  }
}

/* ---- 2025 parameters (Rev. Proc. 2024-25 / IRC §223) ---- */
is('H1 self-only limit', HSA_CONSTANTS.selfLimit, 4300);
is('H2 family limit', HSA_CONSTANTS.familyLimit, 8550);
is('H3 age-55 catch-up (§223(b)(3), statutory)', HSA_CONSTANTS.catchUp55, 1000);
is('H4 catch-up minimum age', HSA_CONSTANTS.catchUpMinAge, 55);
is('H5 non-qualified additional-tax rate (§223(f)(4))', HSA_CONSTANTS.nonQualifiedPenaltyRate, 0.2);
is('H6 HDHP min deductible, self', HSA_CONSTANTS.hdhpMinDeductibleSelf, 1650);
is('H7 HDHP min deductible, family', HSA_CONSTANTS.hdhpMinDeductibleFamily, 3300);
is('H8 HDHP max out-of-pocket, self', HSA_CONSTANTS.hdhpMaxOutOfPocketSelf, 8300);
is('H9 HDHP max out-of-pocket, family', HSA_CONSTANTS.hdhpMaxOutOfPocketFamily, 16600);

/* ---- hsaLimitFor (limit + catch-up ladder) ---- */
is('H20 limit(self, no catch-up)', hsaLimitFor('self', false), 4300);
is('H21 limit(family, no catch-up)', hsaLimitFor('family', false), 8550);
is('H22 limit(self, 55+) = 4,300 + 1,000', hsaLimitFor('self', true), 5300);
is('H23 limit(family, 55+) = 8,550 + 1,000', hsaLimitFor('family', true), 9550);

/* ---- annuityDueFactor (HSA flavor: rate as fraction, n ≥ 1) ---- */
close('H30 AF(0.07, 10) = 13.81644796 × 1.07', annuityDueFactor(0.07, 10), 14.7835993185691);
close('H31 AF(0, 10) = 10 (zero-rate branch)', annuityDueFactor(0, 10), 10);
close('H32 AF(0.07, 0.4) — years clamp to 1 → 1.07', annuityDueFactor(0.07, 0.4), 1.07);
// Hand: 1.07^60 = 57.946426; (56.946426/0.07) × 1.07 = 813.518 × 1.07.
close('H33 AF(0.07, 70) — years clamp to 60', annuityDueFactor(0.07, 70), 870.466810185015);
// Hand: 1.5^10 = 57.6650390625; (56.6650390625/0.5) × 1.5.
close('H34 AF(0.5, 10) — high growth rail', annuityDueFactor(0.5, 10), 169.9951171875);
// Hand: ((0.1^10 − 1)/(−0.9)) × 0.1 = 1.1111111100 × 0.1.
close('H35 AF(−1, 10) — rate clamps to −0.9', annuityDueFactor(-1, 10), 0.1111111111, 1e-9);

/* ---- nonQualifiedWithdrawal (§223(f)(1) + §223(f)(4) stack) ---- */
{
  const w = nonQualifiedWithdrawal(10000, 24);
  close('H40 incomeTax = 10,000 × 0.24', w.incomeTax, 2400);
  close('H41 additionalTax = 10,000 × 20%', w.additionalTax, 2000);
  close('H42 totalTax stacks both', w.totalTax, 4400);
  close('H43 net = 10,000 × (1 − 0.24 − 0.20)', w.net, 5600);
  close('H44 gross passes through', w.gross, 10000);
}
close('H50 zero-bracket withdrawal still pays the 20% surtax', nonQualifiedWithdrawal(5000, 0).net, 4000);
// Hand: 10,000 × (1 − 0.85 − 0.20) = −500 — the clamped 85% bracket plus the
// 20% additional tax exceeds 100% of the distribution.
close('H51 rate 99 clamps to 85 → net −500', nonQualifiedWithdrawal(10000, 99).net, -500);
close('H60 NaN gross sanitizes to 0', nonQualifiedWithdrawal(NaN, 24).gross, 0);

/* ---- Flagship — HsaCalculator DEFAULTS ---- */
// $8,550 family, no catch-up, 24% marginal, 7% return, 25y, m = 0.4, p = 0.25.
// Hand: AF(0.07, 25) = 63.2490377 × 1.07 = 67.6764704; twin growth
// g = 0.07 × 0.76 = 0.0532; 1.0532^25 = 3.654023 → AF(g, 25) = 52.541667.
{
  const c = compareHsa({
    contribution: 8550,
    coverage: 'family',
    age55: false,
    marginalRatePct: 24,
    returnRatePct: 7,
    years: 25,
    medicalSpendShare: 0.4,
    forfeitShare: 0.25,
  });
  const inp = '$8,550 family, 24%, 7%, 25y, m 0.4, p 0.25';
  is('H70 limit', c.limit, 8550);
  is('H71 contribution (at limit, not capped)', c.contribution, 8550);
  is('H72 contributionCapped false at the limit', c.contributionCapped, false);
  close('H80 spendNow.taxShield = 25 × 8,550 × 0.24', c.spendNow.taxShield, 51300);
  close('H81 taxShieldCompounded = 2,052 × AF(5.32%, 25)', c.spendNow.taxShieldCompounded, 107815.508363155);
  close('H82 save.balance = 8,550 × AF(7%, 25)', c.saveForLater.balance, 578633.821545205);
  close('H83 post65AnyUse = balance × (1 − 0.24)', c.saveForLater.post65AnyUse, 439761.704374355);
  close('H84 taxableTwinDrag = 6,498 × 52.541667', c.saveForLater.taxableTwinDrag, 341415.776483323);
  close('H85 taxableTwinNoDrag = 6,498 × 67.6764704', c.saveForLater.taxableTwinNoDrag, 439761.704374356);
  close('H86 advantageDrag = balance − twinDrag', c.saveForLater.advantageDrag, 237218.045061881);
  close('H87 advantageNoDrag = balance − twinNoDrag', c.saveForLater.advantageNoDrag, 138872.117170849);
  close('H90 post65AnyUse ≡ taxableTwinNoDrag (same formula)', c.saveForLater.post65AnyUse - c.saveForLater.taxableTwinNoDrag, 0, 1e-6);
  close('H100 mixed.annualMedical = 0.4 × 8,550', c.mixed.annualMedical, 3420);
  close('H101 mixed.balance = 0.6 × 8,550 × AF', c.mixed.balance, 347180.292927123);
  close('H102 forfeitTax = 0.25 × balance × 0.24', c.mixed.forfeitTax, 20830.8175756274);
  close('H103 forfeitPenalty = 0.25 × balance × 20%', c.mixed.forfeitPenalty, 17359.0146463561);
  close('H104 mixed.value = balance × (1 − 0.25 × 0.44)', c.mixed.value, 308990.460705139);
  close('H105 twinAnnualInvestment = 8,550 × (0.76 − 0.40)', c.mixed.twinAnnualInvestment, 3078);
  is('H106 twinBorrowing false at m < 1 − t', c.mixed.twinBorrowing, false);
  close('H107 taxableTwinBalance = 3,078 × 52.541667', c.mixed.taxableTwinBalance, 161723.262544732);
  close('H108 mixed.advantage = value − twinBalance', c.mixed.advantage, 147267.198160407);
}

/* ---- Secondary persona: $4,300 self, 24%, 7%, 20y, m 0.3, p 0.1 ---- */
// Hand: AF(0.07, 20) = 40.9954923 × 1.07 = 43.8651768; AF(0.0532, 20) = 36.0264.
{
  const c = compareHsa({
    contribution: 4300,
    coverage: 'self',
    age55: false,
    marginalRatePct: 24,
    returnRatePct: 7,
    years: 20,
    medicalSpendShare: 0.3,
    forfeitShare: 0.1,
  });
  close('H120 balance = 4,300 × 43.8651768', c.saveForLater.balance, 188620.260169985);
  close('H121 twinDrag = 3,268 × 36.0264', c.saveForLater.taxableTwinDrag, 117734.275645602);
  close('H122 advantageDrag = 188,620.26 − 117,734.28', c.saveForLater.advantageDrag, 70885.9845243823);
  close('H123 mixed.value = 3,010 × 43.8651768 × 0.956', c.mixed.value, 126224.678105754);
  close('H124 twinAnnualInvestment = 4,300 × 0.46', c.mixed.twinAnnualInvestment, 1978);
}

/* ---- Usage-pattern poles: m = 1 (spend-as-you-go), m = 0 (save-to-retire) ---- */
{
  const c = compareHsa({
    contribution: 4300,
    coverage: 'self',
    age55: false,
    marginalRatePct: 24,
    returnRatePct: 7,
    years: 10,
    medicalSpendShare: 1,
    forfeitShare: 0,
  });
  close('H130 m=1: mixed.balance = 0 (everything spent)', c.mixed.balance, 0);
  close('H131 m=1: annualMedical = full contribution', c.mixed.annualMedical, 4300);
  close('H132 m=1: twin invests −C·t = 4,300 × (0.76 − 1)', c.mixed.twinAnnualInvestment, -1032);
  is('H133 m=1: twinBorrowing true (care exceeds after-tax pool)', c.mixed.twinBorrowing, true);
  close('H134 m=1: taxableTwinBalance = −C·t·AF(g)', c.mixed.taxableTwinBalance, -13876.8732392485);
  close('H135 m=1: twin debt ≡ compounded tax shield (sign-flipped)', c.mixed.taxableTwinBalance + c.spendNow.taxShieldCompounded, 0, 1e-6);
  close('H136 m=1: cash shield = 10 × 4,300 × 0.24', c.spendNow.taxShield, 10320);
  close('H137 m=1: advantage = the compounded shield itself', c.mixed.advantage, 13876.8732392485);
}
{
  const c = compareHsa({
    contribution: 4300,
    coverage: 'self',
    age55: false,
    marginalRatePct: 24,
    returnRatePct: 7,
    years: 10,
    medicalSpendShare: 0,
    forfeitShare: 0,
  });
  close('H140 m=0,p=0: mixed.balance ≡ save.balance', c.mixed.balance, c.saveForLater.balance);
  close('H141 m=0,p=0: mixed.value ≡ save.balance (nothing forfeited)', c.mixed.value, c.saveForLater.balance);
  close('H142 m=0,p=0: mixed.advantage ≡ advantageDrag', c.mixed.advantage, c.saveForLater.advantageDrag);
  close('H143 m=0,p=0: shared pole value', c.saveForLater.balance, 63569.4770698471);
  close('H144 m=0,p=0: twin invests C·(1−t) = 3,268', c.mixed.twinAnnualInvestment, 3268);
  close('H145 m=0,p=0: advantage = 19,626.05', c.mixed.advantage, 19626.0451455601);
}

/* ---- Forfeit pole: p = 1, m = 0 (whole balance cashed non-qualified) ---- */
{
  const c = compareHsa({
    contribution: 4300,
    coverage: 'self',
    age55: false,
    marginalRatePct: 24,
    returnRatePct: 7,
    years: 10,
    medicalSpendShare: 0,
    forfeitShare: 1,
  });
  close('H150 p=1: value = balance × (1 − 0.24 − 0.20) = 63,569.477 × 0.56', c.mixed.value, 35598.9071591144);
  // The mixed pole at p=1 must agree cent-for-cent with nonQualifiedWithdrawal.
  close('H151 p=1: value ≡ nonQualifiedWithdrawal(balance).net', c.mixed.value, nonQualifiedWithdrawal(c.mixed.balance, 24).net, 1e-6);
}

/* ---- Contribution cap & input clamps ---- */
{
  const c = compareHsa({
    contribution: 12000,
    coverage: 'self',
    age55: false,
    marginalRatePct: 24,
    returnRatePct: 7,
    years: 10,
    medicalSpendShare: 0.3,
    forfeitShare: 0.1,
  });
  is('H160 over-limit entry capped to the self limit', c.contribution, 4300);
  is('H161 contributionCapped flag set', c.contributionCapped, true);
}
{
  const c = compareHsa({
    contribution: 9550,
    coverage: 'family',
    age55: true,
    marginalRatePct: 24,
    returnRatePct: 7,
    years: 10,
    medicalSpendShare: 0.3,
    forfeitShare: 0.1,
  });
  is('H170 family + 55 catch-up room admits 9,550', c.contribution, 9550);
  is('H171 exactly at limit: capped flag false', c.contributionCapped, false);
}
{
  const base = {
    contribution: 4300,
    coverage: 'self',
    age55: false,
    marginalRatePct: 24,
    returnRatePct: 7,
    years: 10,
    medicalSpendShare: 0.3,
    forfeitShare: 0.1,
  };
  close('H180 rate 99 clamps to 0.85', compareHsa({ ...base, marginalRatePct: 99 }).rate, 0.85);
  close('H181 return 60 clamps to 0.50', compareHsa({ ...base, returnRatePct: 60 }).growth, 0.5);
  close('H182 years 0.2 clamps to 1', compareHsa({ ...base, years: 0.2 }).years, 1);
  close('H183 years 99 clamps to 60', compareHsa({ ...base, years: 99 }).years, 60);
  close('H190 NaN contribution sanitizes to 0', compareHsa({ ...base, contribution: NaN }).contribution, 0);
  close('H191 negative contribution sanitizes to 0', compareHsa({ ...base, contribution: -500 }).contribution, 0);
  const shares = compareHsa({ ...base, medicalSpendShare: 1.5, forfeitShare: -0.2 });
  close('H192 m clamps to 1', shares.medicalSpendShare, 1);
  close('H193 p clamps to 0', shares.forfeitShare, 0);
}

/* ---- hsaRateSensitivity (bracket scan 10–37) ---- */
{
  const s = hsaRateSensitivity({
    contribution: 8550,
    coverage: 'family',
    age55: false,
    marginalRatePct: 24,
    returnRatePct: 7,
    years: 25,
    medicalSpendShare: 0.4,
    forfeitShare: 0.25,
  });
  is('H200 28 bracket points (10..37 inclusive)', s.length, 28);
  close('H201 first rate 10', s[0].rate, 10);
  close('H202 last rate 37', s[s.length - 1].rate, 37);
  // Hand (rate 10): g = 0.063; 1.063^25 = 4.606081 → AF = 60.8455; twin
  // invests 8,550 × 0.5 = 4,275 → 260,114; HSA value = 347,180.29 × 0.925
  // = 321,141.8 → advantage ≈ 61,027.
  close('H203 mixed advantage @10% bracket', s[0].mixed, 61027.3888853427);
  close('H204 mixed advantage @37% bracket', s[s.length - 1].mixed, 207319.280426411);
  close('H205 saveAll @24 ≡ flagship advantageDrag', s.find((q) => q.rate === 24).saveAll, 237218.045061881);
  is('H206 mixed advantage monotone in the marginal rate', s.every((q, i) => i === 0 || q.mixed >= s[i - 1].mixed - 1e-6), true);
}

/* ---- hsaHorizonSweep (build-time chart series) ---- */
{
  const inputs = {
    contribution: 4300,
    coverage: 'self',
    age55: false,
    marginalRatePct: 24,
    returnRatePct: 7,
    years: 25,
    medicalSpendShare: 0.4,
    forfeitShare: 0.25,
  };
  const s = hsaHorizonSweep(inputs, 3);
  is('H210 sweep to 3 has 3 points', s.length, 3);
  close('H211 year 1: hsa = 4,300 × 1.07', s[0].hsa, 4601);
  close('H212 year 1: taxableDrag = 3,268 × 1.0532', s[0].taxableDrag, 3441.8576);
  close('H213 year 1: taxableNoDrag = 3,268 × 1.07', s[0].taxableNoDrag, 3496.76);
  close('H214 year 3: hsa = 4,300 × 3.439943', s[2].hsa, 14791.7549);
  is('H220 default sweep runs to 40 years', hsaHorizonSweep(inputs).length, 40);
}

if (failures.length > 0) {
  console.error(`hsa.test.mjs: ${failures.length}/${total} assertions FAILED:`);
  for (const f of failures) console.error('  ' + f);
  throw new Error(`hsa.test.mjs failed: ${failures.length} of ${total} assertions mismatched`);
}
console.log(`hsa.test.mjs: ${total}/${total} assertions passed`);

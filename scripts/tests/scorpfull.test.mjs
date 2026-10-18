// Permanent regression matrix for lib/scorpfull.ts (full-fidelity S-corp vs
// LLC model, tax year 2025 — the engine behind the S-Corp Salary Calculator)
// — pure-Node assertions, no test framework, no dependencies beyond node.
//
// RUN PREREQUISITE (owned by the unified test runner, NOT by this file): the
// engine libs must already be compiled to CommonJS under scripts/tests/.build/
// preserving the lib/ layout, i.e. these files exist:
//   scripts/tests/.build/lib/scorpfull.js
//   (+ its @/lib/* closure: scorp.js, qbi.js, tax.js)
// A minimal tsconfig that produces exactly that (verified against this repo):
//   {
//     "compilerOptions": {
//       "target": "ES2020", "module": "CommonJS", "strict": true,
//       "skipLibCheck": true, "noEmit": false, "incremental": false,
//       "baseUrl": "../..", "paths": { "@/*": ["./*"] },
//       "outDir": "scripts/tests/.build", "rootDir": "../.."
//     },
//     "files": ["lib/scorpfull.ts"]
//   }
// tsc pulls lib/scorp.ts, lib/qbi.ts and lib/tax.ts in through the @/ alias
// on its own. The compiled files keep their '@/lib/*' specifiers — the loader
// patch below resolves those against the same .build directory, so the runner
// needs no alias handling of its own. Then:
//   node scripts/tests/scorpfull.test.mjs
//
// Every expected value was derived by hand from the 2025 parameters in the
// lib headers ($15,750 OBBBA standard deduction, $176,100 SS wage base,
// Schedule SE + Form 8959 0.9% on both columns, the full Form 8995-A §199A
// chain with $197,300 threshold / $50k phase-in, 2025 single brackets) and
// then confirmed against the compiled engine (tsc → node) before being
// written in. Any mismatch throws with input → expected → actual.

import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const Module = require('node:module');

// Resolve the '@/lib/x' specifiers the compiled CommonJS output keeps.
const BUILD = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '.build');
const origResolveFilename = Module._resolveFilename;
Module._resolveFilename = function (request, ...rest) {
  if (request.startsWith('@/')) return path.join(BUILD, request.slice(2) + '.js');
  return origResolveFilename.call(this, request, ...rest);
};

const {
  SCORP_FULL_CONSTANTS,
  computeLlcFull,
  computeScorpFull,
  compareScorpFull,
  breakevenPayrollCostFull,
  salarySweepFull,
} = require('./.build/lib/scorpfull.js');

let pass = 0;
function eq(name, input, expected, actual, tol = 1e-6) {
  const ok =
    typeof expected === 'number' && typeof actual === 'number'
      ? Math.abs(actual - expected) <= tol
      : actual === expected;
  if (!ok) {
    throw new Error(
      `[scorpfull.test] ${name}\n  input →    ${input}\n  expected → ${expected}` +
        (tol !== 1e-6 ? ` (±${tol})` : '') +
        `\n  actual →   ${actual}`,
    );
  }
  pass++;
  console.log(`PASS  ${name}  [${actual}]`);
}

/* ============ 1. Parameter set ============ */
eq('SS wage base 2025', 'constant', 176100, SCORP_FULL_CONSTANTS.ssWageBase);
eq('std deduction 2025 (post-OBBBA)', 'constant', 15750, SCORP_FULL_CONSTANTS.stdDeduction);
eq('SE base factor', 'constant', 0.9235, SCORP_FULL_CONSTANTS.seBaseFactor);
eq('SE rate', 'constant', 0.153, SCORP_FULL_CONSTANTS.seRate);
eq('SE Medicare rate above the cap', 'constant', 0.029, SCORP_FULL_CONSTANTS.seMedicareRate);
eq('Additional Medicare rate', 'constant', 0.009, SCORP_FULL_CONSTANTS.addlMedicareRate);
eq('Additional Medicare threshold', 'constant', 200000, SCORP_FULL_CONSTANTS.addlMedicareThreshold);
eq('default payroll cost', 'constant', 1200, SCORP_FULL_CONSTANTS.defaultPayrollCost);
eq('TY2026 std deduction (drift note)', 'constant', 16100, SCORP_FULL_CONSTANTS.ty2026.stdDeduction);
eq('TY2026 SS wage base (drift note)', 'constant', 184500, SCORP_FULL_CONSTANTS.ty2026.ssWageBase);

/* ============ 2. LLC column ============ */
{
  // Regression anchor: the instrument's default profit (ScorpCalculator
  // DEFAULTS profit $200k, non-SSTB).
  const r = computeLlcFull(200000, false);
  const inp = 'profit $200k, non-SSTB';
  eq('llcFull(200k): seBase 92.35% × 200k', inp, 184700, r.seBase);
  eq('llcFull(200k): seTax 26,943.30 + 249.40', inp, 27192.7, r.seTax);
  eq('llcFull(200k): halfSeTax', inp, 13596.35, r.halfSeTax);
  eq('llcFull(200k): addlMedicare 0 (base < $200k)', inp, 0, r.addlMedicareTax);
  eq('llcFull(200k): qbiBase', inp, 186403.65, r.qbiBase);
  eq('llcFull(200k): qbiTentative 20% × qbiBase', inp, 37280.73, r.qbiTentative);
  eq('llcFull(200k): qbiDeduction (taxable-income cap binds)', inp, 34130.73, r.qbiDeduction);
  eq('llcFull(200k): qbiLimiter', inp, 'cap', r.qbiLimiter);
  eq('llcFull(200k): taxableIncome', inp, 136522.92, r.taxableIncome);
  eq('llcFull(200k): incomeTax', inp, 25612.5008, r.incomeTax, 1e-5);
  eq('llcFull(200k): totalOutlay', inp, 52805.2008, r.totalOutlay, 1e-5);
  eq('llcFull(200k): afterTax', inp, 147194.7992, r.afterTax, 1e-5);
}
{
  // SSTB mid-phase-out band: TI $210,118.02 → ap = 0.7436396, and with no
  // wages the deduction collapses to 20% × QBI × ap² (the AICPA-verified
  // double reduction), not 20% × QBI × ap.
  const r = computeLlcFull(240000, true);
  const inp = 'profit $240k, SSTB (TI inside the $50k phase-in band)';
  eq('llcFull(240k,SSTB): addlMedicare 0.9% × (221,640 − 200k)', inp, 194.76, r.addlMedicareTax);
  eq('llcFull(240k,SSTB): qbiTentative 20% × QBI × ap', inp, 33592.880809, r.qbiTentative);
  eq('llcFull(240k,SSTB): qbiDeduction 20% × QBI × ap²', inp, 24980.996448, r.qbiDeduction, 1e-5);
  eq('llcFull(240k,SSTB): qbiLimiter', inp, 'wage', r.qbiLimiter);
  eq('llcFull(240k,SSTB): taxableIncome', inp, 185137.023552, r.taxableIncome, 1e-5);
  eq('llcFull(240k,SSTB): totalOutlay', inp, 65738.605653, r.totalOutlay, 1e-5);
  eq('llcFull(240k,SSTB): afterTax', inp, 174261.394347, r.afterTax, 1e-5);
}
{
  // SSTB above the whole band: deduction erased entirely, 0.9% surcharge on.
  const r = computeLlcFull(300000, true);
  const inp = 'profit $300k, SSTB (TI $269,314.575 > $247,300)';
  eq('llcFull(300k,SSTB): seTax 26,943.30 + 0.029 × 100,950', inp, 29870.85, r.seTax);
  eq('llcFull(300k,SSTB): addlMedicare 0.9% × 77,050', inp, 693.45, r.addlMedicareTax);
  eq('llcFull(300k,SSTB): qbiDeduction erased', inp, 0, r.qbiDeduction);
  eq('llcFull(300k,SSTB): qbiLimiter', inp, 'qbi', r.qbiLimiter);
  eq('llcFull(300k,SSTB): taxableIncome', inp, 269314.575, r.taxableIncome);
  eq('llcFull(300k,SSTB): incomeTax (into the 35% bracket)', inp, 63807.35125, r.incomeTax);
  eq('llcFull(300k,SSTB): totalOutlay', inp, 94371.65125, r.totalOutlay);
  eq('llcFull(300k,SSTB): afterTax', inp, 205628.34875, r.afterTax);
}
{
  const r = computeLlcFull(0, false);
  eq('llcFull(0): totalOutlay', 'profit $0', 0, r.totalOutlay);
  eq('llcFull(0): afterTax', 'profit $0', 0, r.afterTax);
}

/* ============ 3. S-Corp column ============ */
{
  // Regression anchor: the instrument's exact default state (profit $200k,
  // salary $80k, payroll cost $1,200, non-SSTB).
  const r = computeScorpFull(200000, 80000, 1200, false);
  const inp = 'profit $200k, salary $80k, cost $1,200, non-SSTB (default)';
  eq('scorpFull(default): wages effective', inp, 80000, r.salaryEffective);
  eq('scorpFull(default): salaryCapped', inp, false, r.salaryCapped);
  eq('scorpFull(default): employeeFica 7.65% × 80k', inp, 6120, r.employeeFica);
  eq('scorpFull(default): employerFica', inp, 6120, r.employerFica);
  eq('scorpFull(default): payrollTax', inp, 12240, r.payrollTax);
  eq('scorpFull(default): k1Income 200k − 80k − 6,120 − 1,200', inp, 112680, r.k1Income);
  eq('scorpFull(default): qbiTentative 20% × k1', inp, 22536, r.qbiTentative);
  eq('scorpFull(default): qbiDeduction (below threshold, no wage limit)', inp, 22536, r.qbiDeduction);
  eq('scorpFull(default): qbiLimiter', inp, 'qbi', r.qbiLimiter);
  eq('scorpFull(default): taxableIncome', inp, 154394, r.taxableIncome);
  eq('scorpFull(default): incomeTax', inp, 29901.56, r.incomeTax);
  eq('scorpFull(default): totalOutlay', inp, 43341.56, r.totalOutlay, 1e-5);
  eq('scorpFull(default): afterTax', inp, 156658.44, r.afterTax, 1e-5);
}
{
  // Wages cannot exceed the pool being split.
  const r = computeScorpFull(50000, 80000, 1200, false);
  const inp = 'profit $50k, salary $80k → truncated';
  eq('scorpFull(50k/80k): salaryCapped', inp, true, r.salaryCapped);
  eq('scorpFull(50k/80k): salaryEffective = profit', inp, 50000, r.salaryEffective);
  eq('scorpFull(50k/80k): k1Income floored at 0', inp, 0, r.k1Income);
  eq('scorpFull(50k/80k): taxableIncome', inp, 34250, r.taxableIncome);
  eq('scorpFull(50k/80k): incomeTax', inp, 3871.5, r.incomeTax);
  eq('scorpFull(50k/80k): afterTax', inp, 37278.5, r.afterTax);
}
{
  // Above the $197,300 threshold the owner salary IS the business's W-2 wages:
  // the 50%-of-wages limit binds at 50,000 < tentative 98,230.
  const r = computeScorpFull(600000, 100000, 1200, false);
  const inp = 'profit $600k, salary $100k, non-SSTB';
  eq('scorpFull(600k/100k): qbiTentative 20% × 491,150', inp, 98230, r.qbiTentative);
  eq('scorpFull(600k/100k): qbiDeduction = 50% × wages', inp, 50000, r.qbiDeduction);
  eq('scorpFull(600k/100k): qbiLimiter', inp, 'wage', r.qbiLimiter);
  eq('scorpFull(600k/100k): taxableIncome', inp, 525400, r.taxableIncome);
  eq('scorpFull(600k/100k): incomeTax', inp, 153437.25, r.incomeTax);
  eq('scorpFull(600k/100k): afterTax', inp, 430062.75, r.afterTax);
}
{
  // Wages above both the $176,100 SS base and the $200k Additional Medicare
  // threshold — the full FICA stack with all three kinks.
  const r = computeScorpFull(600000, 250000, 1200, false);
  const inp = 'profit $600k, salary $250k, non-SSTB';
  eq('scorpFull(600k/250k): employeeFica 10,918.20 + 3,625 + 450', inp, 14993.2, r.employeeFica);
  eq('scorpFull(600k/250k): employerFica 10,918.20 + 3,625', inp, 14543.2, r.employerFica);
  eq('scorpFull(600k/250k): addlMedicareTax field = 450', inp, 450, r.addlMedicareTax);
  eq('scorpFull(600k/250k): k1Income', inp, 334256.8, r.k1Income);
  eq('scorpFull(600k/250k): qbiDeduction (wages unlock the full 20%)', inp, 66851.36, r.qbiDeduction);
  eq('scorpFull(600k/250k): afterTax', inp, 424136.946, r.afterTax, 1e-5);
}
{
  // SSTB mid-band WITH wages: ap-reduced wages still cover the tentative
  // deduction, so the S-corp keeps a QBI deduction the sole prop loses —
  // the module's headline "wages rescue the SSTB" case. Taxable income
  // crosses the $197,300 bracket boundary, so the top slice is 32%.
  const r = computeScorpFull(240000, 80000, 1200, true);
  const inp = 'profit $240k, salary $80k, SSTB (TI inside the band)';
  eq('scorpFull(240k/SSTB): k1Income', inp, 152680, r.k1Income);
  eq('scorpFull(240k/SSTB): qbiTentative 20% × 152,680 × ap(0.6074)', inp, 18547.5664, r.qbiTentative);
  eq('scorpFull(240k/SSTB): qbiDeduction (wage limit 24,296 ≥ tentative)', inp, 18547.5664, r.qbiDeduction);
  eq('scorpFull(240k/SSTB): taxableIncome', inp, 198382.4336, r.taxableIncome, 1e-5);
  eq('scorpFull(240k/SSTB): incomeTax (32% slice above $197,300)', inp, 40545.378752, r.incomeTax, 1e-5);
  eq('scorpFull(240k/SSTB): afterTax', inp, 186014.621248, r.afterTax, 1e-5);
}
{
  // SSTB above the whole band: ap = 0 kills QBI on BOTH columns — wages
  // cannot rescue what the phase-out erased.
  const r = computeScorpFull(300000, 80000, 1200, true);
  const inp = 'profit $300k, salary $80k, SSTB (above the band)';
  eq('scorpFull(300k/SSTB): qbiDeduction', inp, 0, r.qbiDeduction);
  eq('scorpFull(300k/SSTB): taxableIncome', inp, 276930, r.taxableIncome);
  eq('scorpFull(300k/SSTB): incomeTax', inp, 66472.75, r.incomeTax);
  eq('scorpFull(300k/SSTB): afterTax', inp, 220087.25, r.afterTax);
}

/* ============ 4. Head-to-head ============ */
{
  const r = compareScorpFull(200000, 80000, 1200, false);
  eq('compareScorpFull(default): winner', 'profit $200k, salary $80k, cost $1,200', 'scorp', r.winner);
  eq('compareScorpFull(default): delta', 'profit $200k, salary $80k, cost $1,200', 9463.6408, r.delta, 1e-4);
}
{
  // Flagship SSTB case: at $240k the S-corp wins by MORE than it does below
  // the threshold, because the LLC column loses its QBI deduction to the
  // phase-out while the salary keeps the S-corp's alive.
  const r = compareScorpFull(240000, 80000, 1200, true);
  eq('compareScorpFull(240k, SSTB): winner', 'profit $240k, salary $80k, cost $1,200', 'scorp', r.winner);
  eq('compareScorpFull(240k, SSTB): delta', '186,014.621248 − 174,261.394347', 11753.226901, r.delta, 1e-4);
}

/* ============ 5. Breakeven payroll overhead (bisection) ============ */
{
  // Hand-derived on the linear segment: afterTax(cost) = 157,628.04 − 0.808×cost
  // crossing the LLC's 147,194.7992 at cost = 10,433.2408 / 0.808.
  const bep = breakevenPayrollCostFull(200000, 80000);
  eq('breakevenPayrollCostFull(200k, 80k)', '157,628.04 − 0.808c = 147,194.7992', 12912.426733, bep, 0.01);
  const llcNet = computeLlcFull(200000, false).afterTax;
  eq('bep construction: still ahead at bep', `cost ${bep}`, true, computeScorpFull(200000, 80000, bep, false).afterTax > llcNet);
  eq('bep construction: behind at bep + $1', `cost ${bep + 1}`, true, computeScorpFull(200000, 80000, bep + 1, false).afterTax < llcNet);
}
// S-corp behind even at zero overhead → no crossing anywhere.
eq('breakevenPayrollCostFull(50k, 80k) = null', 'scorp afterTax 37,278.50 < llc 40,224.83 at cost 0', null, breakevenPayrollCostFull(50000, 80000));

/* ============ 6. Salary sweep ============ */
{
  const pts = salarySweepFull(200000, 1200, false);
  eq('salarySweep: 31 points', 'ratios 0.15 → 0.90', 31, pts.length);
  eq('salarySweep: first ratio', 'default range', 0.15, pts[0].ratio);
  eq('salarySweep: first salary', '0.15 × 200k', 30000, pts[0].salary);
  eq('salarySweep: delta at 15% salary', 'scorp afterTax 165,974.04 − llc 147,194.80', 18779.2408, pts[0].delta, 1e-4);
  eq('salarySweep: last ratio', 'default range', 0.9, pts[pts.length - 1].ratio);
  eq('salarySweep: last salary', '0.90 × 200k', 180000, pts[pts.length - 1].salary);
  // Hand-checked: FICA on $180k wages stops SS at $176,100
  // (2 × (10,918.20 + 2,610) = 27,056.40), so the LLC wins at the top end.
  eq('salarySweep: delta at 90% salary (LLC ahead)', 'scorp afterTax 138,464.4144 − llc 147,194.80', -8730.3848, pts[pts.length - 1].delta, 1e-4);
  let argmax = 0;
  for (let i = 1; i < pts.length; i++) if (pts[i].delta > pts[argmax].delta) argmax = i;
  eq('salarySweep: advantage peaks at the lowest salary share', 'at $200k profit the FICA drag dominates', 0, argmax);
}

console.log(`\nscorpfull.test.mjs: ${pass} assertions passed.`);

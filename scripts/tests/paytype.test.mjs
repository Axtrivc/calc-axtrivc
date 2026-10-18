// Permanent regression matrix for lib/paytype.ts (1099 vs W-2 pay-type
// comparison, tax year 2025) — pure-Node assertions, no test framework, no
// dependencies beyond node itself.
//
// RUN PREREQUISITE (owned by the unified test runner, NOT by this file): the
// engine libs must already be compiled to CommonJS under scripts/tests/.build/
// preserving the lib/ layout, i.e. these files exist:
//   scripts/tests/.build/lib/paytype.js  (+ its @/lib/* closure: tax.js)
// A minimal tsconfig that produces exactly that (verified against this repo):
//   {
//     "compilerOptions": {
//       "target": "ES2020", "module": "CommonJS", "strict": true,
//       "skipLibCheck": true, "noEmit": false, "incremental": false,
//       "baseUrl": "../..", "paths": { "@/*": ["./*"] },
//       "outDir": "scripts/tests/.build", "rootDir": "../.."
//     },
//     "files": ["lib/paytype.ts"]
//   }
// tsc pulls lib/tax.ts in through the @/ alias on its own. The compiled files
// keep their '@/lib/*' specifiers — the loader patch below resolves those
// against the same .build directory, so the runner needs no alias handling of
// its own. Then:
//   node scripts/tests/paytype.test.mjs
//
// Every expected value was derived by hand from the 2025 parameters in the
// lib header (brackets from shared lib/tax.ts, $15,750 OBBBA standard
// deduction, $176,100 SS wage base, Schedule SE / Form 8959 / §199A / §162(l)
// mechanics) and then confirmed against the compiled engine (tsc → node)
// before being written in. Bisection outputs (breakeven / equivalent salary)
// are pinned by their defining fixed-point property plus the engine value.
// Any mismatch throws with input → expected → actual.

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
  PAYTYPE_DEFAULTS,
  PAYTYPE_CONSTANTS,
  billableHours,
  w2Hourly,
  employeeFicaW2,
  addlMedicareSE,
  seTaxOnNet,
  computeW2Side,
  computeContractorSide,
  comparePayType,
  breakevenContractRate,
  breakevenMarkup,
  equivalentW2Salary,
  markupSweep,
} = require('./.build/lib/paytype.js');

let pass = 0;
function eq(name, input, expected, actual, tol = 1e-6) {
  const ok =
    typeof expected === 'number' && typeof actual === 'number'
      ? Math.abs(actual - expected) <= tol
      : actual === expected;
  if (!ok) {
    throw new Error(
      `[paytype.test] ${name}\n  input →    ${input}\n  expected → ${expected}` +
        (tol !== 1e-6 ? ` (±${tol})` : '') +
        `\n  actual →   ${actual}`,
    );
  }
  pass++;
  console.log(`PASS  ${name}  [${actual}]`);
}

/* ============ 1. Default state & constants (regression anchors) ============ */
eq('PAYTYPE_DEFAULTS.salary', 'defaults object', 100000, PAYTYPE_DEFAULTS.salary);
eq('PAYTYPE_DEFAULTS.contractRate', 'defaults object', 65, PAYTYPE_DEFAULTS.contractRate);
eq('PAYTYPE_DEFAULTS.ptoDays', 'defaults object', 15, PAYTYPE_DEFAULTS.ptoDays);
eq('PAYTYPE_DEFAULTS.healthPremium', 'defaults object', 7500, PAYTYPE_DEFAULTS.healthPremium);
eq('PAYTYPE_DEFAULTS.retirementMatch', 'defaults object', 3000, PAYTYPE_DEFAULTS.retirementMatch);
eq('PAYTYPE_DEFAULTS.otherBenefits', 'defaults object', 500, PAYTYPE_DEFAULTS.otherBenefits);
eq('PAYTYPE_DEFAULTS.seExpenses', 'defaults object', 2000, PAYTYPE_DEFAULTS.seExpenses);
eq('2025 SS wage base', 'constant', 176100, PAYTYPE_CONSTANTS.ssWageBase);
eq('2025 std deduction (OBBBA $15,750)', 'constant', 15750, PAYTYPE_CONSTANTS.stdDeduction);
eq('hours per year', 'constant', 2080, PAYTYPE_CONSTANTS.hoursPerYear);
eq('PTO hours per day', 'constant', 8, PAYTYPE_CONSTANTS.ptoHoursPerDay);
eq('QBI rate', 'constant', 0.2, PAYTYPE_CONSTANTS.qbiRate);

/* ============ 2. Hours & rate primitives ============ */
eq('billableHours(0)', 'no PTO', 2080, billableHours(0));
eq('billableHours(15)', '15 PTO days (doc anchor)', 1960, billableHours(15));
eq('billableHours(25)', '25 PTO days', 1880, billableHours(25));
eq('billableHours(260)', '260 PTO days = whole year gone', 0, billableHours(260));
eq('billableHours(300)', 'beyond a year, floored at 0', 0, billableHours(300));
eq('w2Hourly(100000)', '$100k ÷ 2,080', 48.076923, w2Hourly(100000));
eq('w2Hourly(0)', 'zero salary', 0, w2Hourly(0));

/* ============ 3. Payroll-tax primitives (boundaries) ============ */
eq('employeeFicaW2(0)', 'wages $0', 0, employeeFicaW2(0));
eq('employeeFicaW2(100000)', '$100k → 6,200 + 1,450 (doc anchor)', 7650, employeeFicaW2(100000));
eq('employeeFicaW2(176100)', 'at the SS wage base: 10,918.20 + 2,553.45', 13471.65, employeeFicaW2(176100));
eq('employeeFicaW2(200000)', 'Additional Medicare threshold: +0', 13818.2, employeeFicaW2(200000));
eq('employeeFicaW2(250000)', 'over: 10,918.20 + 3,625 + 450', 14993.2, employeeFicaW2(250000));
eq('addlMedicareSE(0)', 'net $0', 0, addlMedicareSE(0));
eq('addlMedicareSE(200000)', 'SE base 184,700 < $200k → 0', 0, addlMedicareSE(200000));
eq('addlMedicareSE(400000)', '0.9% × (369,400 − 200,000) (doc anchor)', 1524.6, addlMedicareSE(400000));
eq('seTaxOnNet(0)', 'net $0', 0, seTaxOnNet(0));
eq('seTaxOnNet(433)', 'SE base $399.8755 < $400 floor → 0', 0, seTaxOnNet(433));
eq('seTaxOnNet(500)', '15.3% × 461.75', 70.64775, seTaxOnNet(500));
eq('seTaxOnNet(125400)', '15.3% × 115,806.90 (doc anchor)', 17718.4557, seTaxOnNet(125400));
eq('seTaxOnNet(400000)', '26,943.30 + 5,605.70 + 1,524.60 (doc anchor)', 34073.6, seTaxOnNet(400000));

/* ============ 4. W-2 side of the ledger ============ */
{
  const r = computeW2Side(100000, 11000);
  const inp = 'salary $100k, benefits $11k';
  eq('w2: fica', inp, 7650, r.fica);
  eq('w2: taxableIncome (100k − 15,750)', inp, 84250, r.taxableIncome);
  eq('w2: incomeTax (brackets to $84,250)', inp, 13449, r.incomeTax, 1e-4);
  eq('w2: cashAfterTax', inp, 78901, r.cashAfterTax, 1e-4);
  eq('w2: totalValue (cash + face-value benefits)', inp, 89901, r.totalValue, 1e-4);
  eq('w2: valuePerHour', inp, 43.221635, r.valuePerHour);
}
{
  const r = computeW2Side(0, 5000);
  eq('w2 zero salary: totalValue = benefits only', 'salary $0, benefits $5k', 5000, r.totalValue);
  eq('w2 zero salary: incomeTax', 'salary $0, benefits $5k', 0, r.incomeTax);
}

/* ============ 5. 1099 side of the ledger (default inputs) ============ */
{
  const r = computeContractorSide(PAYTYPE_DEFAULTS);
  const inp = 'defaults: $65/hr, 15 PTO days, $7.5k health, $2k expenses';
  eq('1099: billable hours', inp, 1960, r.hours);
  eq('1099: revenue 65 × 1,960', inp, 127400, r.revenue);
  eq('1099: netSE', inp, 125400, r.netSE);
  eq('1099: seTax', inp, 17718.4557, r.seTax);
  eq('1099: halfSeTax (§164(f))', inp, 8859.22785, r.halfSeTax);
  eq('1099: sehiDeduction (§162(l) — premium under the cap)', inp, 7500, r.sehiDeduction);
  eq('1099: qbiDeduction (20% of taxable-before-QBI cap binds)', inp, 18658.15443, r.qbiDeduction);
  eq('1099: taxableIncome', inp, 74632.61772, r.taxableIncome);
  eq('1099: incomeTax', inp, 11333.175898, r.incomeTax, 1e-5);
  eq('1099: valueKept', inp, 96348.368402, r.valueKept, 1e-5);
  eq('1099: valuePerBillableHour', inp, 49.157331, r.valuePerBillableHour);
}

/* ============ 6. Head-to-head verdict ============ */
{
  const r = comparePayType(PAYTYPE_DEFAULTS);
  eq('compare defaults: deltaAnnual', 'defaults', 6447.368402, r.deltaAnnual, 1e-5);
  eq('compare defaults: winner', 'defaults', '1099', r.winner);
}

/* ============ 7. Breakeven rate (bisection) ============ */
{
  const be = breakevenContractRate(PAYTYPE_DEFAULTS);
  const w2Value = computeW2Side(100000, 11000).totalValue;
  // Hand side: local slope ≈ $1,362/hr of rate puts the crossing near
  // 65 − 6,447/1,362 ≈ 60.3; engine pins it exactly.
  eq('breakevenContractRate(defaults)', 'defaults (fixed point: valueKept(r) = $89,901)', 60.267887, be, 1e-4);
  eq('breakeven fixed point: valueKept(be) = W-2 value', `rate ${be}`, 89901, computeContractorSide({ ...PAYTYPE_DEFAULTS, contractRate: be }).valueKept, 0.01);
  eq('breakeven direction: below is behind', `rate ${be - 0.25}`, true, computeContractorSide({ ...PAYTYPE_DEFAULTS, contractRate: be - 0.25 }).valueKept < w2Value);
  eq('breakeven unreachable under a $50 cap', 'defaults, cap $50/hr (valueKept(50) = 75,910 < 89,901)', null, breakevenContractRate(PAYTYPE_DEFAULTS, 50));
}
{
  // Degenerate case from the doc: zero-value W-2 package, $2,000 expenses —
  // the rate that just covers the expenses: 2,000 ÷ 2,080.
  const degen = { salary: 0, contractRate: 65, ptoDays: 0, healthPremium: 0, retirementMatch: 0, otherBenefits: 0, seExpenses: 2000 };
  eq('breakeven degenerate (no benefits, $2k expenses)', '2,000 ÷ 2,080', 0.9615384615384619, breakevenContractRate(degen), 1e-9);
}
{
  const be = breakevenContractRate(PAYTYPE_DEFAULTS);
  eq('breakevenMarkup($100k, be)', '(60.267887 − 48.076923) ÷ 48.076923', 25.357206, breakevenMarkup(100000, be), 1e-4);
  eq('breakevenMarkup(0, be) = null', 'zero salary has no hourly base', null, breakevenMarkup(0, be));
  eq('breakevenMarkup(100k, null) = null', 'undefined rate', null, breakevenMarkup(100000, null));
}

/* ============ 8. Inverse direction: equivalent W-2 salary ============ */
{
  const eqs = equivalentW2Salary(PAYTYPE_DEFAULTS);
  const target = computeContractorSide(PAYTYPE_DEFAULTS).valueKept;
  eq('equivalentW2Salary(defaults)', 'salary whose value = $96,348.37 quote value', 109164.702774, eqs, 0.01);
  eq('equivalent fixed point: W-2 value at it = 1099 valueKept', `salary ${eqs}`, target, computeW2Side(eqs, 11000).totalValue, 0.01);
}

/* ============ 9. Sensitivity sweep ============ */
{
  const pts = markupSweep(PAYTYPE_DEFAULTS);
  eq('markupSweep: 21 points', 'salary 50k → 250k', 21, pts.length);
  eq('markupSweep: first salary', 'default range', 50000, pts[0].salary);
  eq('markupSweep: last salary', 'default range', 250000, pts[pts.length - 1].salary);
  eq('markupSweep: breakeven @ $50k salary', 'salary $50k', 34.72496, pts[0].breakevenRate, 1e-4);
  eq('markupSweep: breakeven @ $250k salary', 'salary $250k', 132.806736, pts[pts[20].salary === 250000 ? 20 : pts.length - 1].breakevenRate, 1e-4);
  let increasing = true;
  for (let i = 1; i < pts.length; i++) if (pts[i].breakevenRate <= pts[i - 1].breakevenRate) increasing = false;
  eq('markupSweep: breakeven strictly increasing in salary', 'all 21 points', true, increasing);
}

console.log(`\npaytype.test.mjs: ${pass} assertions passed.`);

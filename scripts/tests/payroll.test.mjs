// Permanent regression matrix for lib/payroll.ts (employer-side cost of a
// W-2 hire, tax year 2025) — pure-Node assertions, no test framework, no
// dependencies beyond node itself.
//
// RUN PREREQUISITE (owned by the unified test runner, NOT by this file): the
// engine libs must already be compiled to CommonJS under scripts/tests/.build/
// preserving the lib/ layout (rootDir = repo root), resolvable as either
//   1. $CALC_TEST_BUILD/lib/payroll.js  (rootDir-projected layout)
//   2. $CALC_TEST_BUILD/payroll.js      (flat layout)
// lib/payroll.ts has no '@/lib/*' imports, but the loader hook below is kept
// uniform with the rest of the directory. Then:
//   node scripts/tests/payroll.test.mjs
//
// Every expected value was hand-derived from the 2025 parameters documented
// in the lib header (§3111(a) 6.2% to the $176,100 SSA wage base; §3111(b)
// 1.45% uncapped with NO employer-side 0.9% surcharge; §3301/§3306(b)(1)/
// §3302(a) FUTA 6.0% on the first $7,000 with up to a 5.4% credit; SUTA and
// benefits purely as inputs) and then confirmed against the compiled engine
// (tsc → node) before being written in. Any mismatch throws with
// input → expected → actual.

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
  PAYROLL_CONSTANTS,
  PAYROLL_DEFAULTS,
  employerFica,
  futaTax,
  sutaTax,
  computeEmployerCost,
  loadedCostSweep,
  revenueToCover,
} = require(buildModule('payroll'));

let pass = 0;
function eq(name, input, expected, actual, tol = 1e-6) {
  // Finite numbers compare by |diff| ≤ tol; non-finite sentinels (Infinity)
  // compare by identity — Math.abs(Inf − Inf) is NaN and would always fail.
  const ok =
    typeof expected === 'number' && typeof actual === 'number'
      ? Number.isFinite(expected) || Number.isFinite(actual)
        ? Math.abs(actual - expected) <= tol
        : Object.is(actual, expected)
      : actual === expected;
  if (!ok) {
    throw new Error(
      `[payroll.test] ${name}\n  input →    ${input}\n  expected → ${expected}` +
        (tol !== 1e-6 ? ` (±${tol})` : '') +
        `\n  actual →   ${actual}`,
    );
  }
  pass++;
  console.log(`PASS  ${name}  [${actual}]`);
}

/* ============ 1. Defaults & constants (regression anchors) ============ */
eq('PAYROLL_DEFAULTS.salary', 'defaults object', 60000, PAYROLL_DEFAULTS.salary);
eq('PAYROLL_DEFAULTS.futaRate (common 0.6% effective)', 'defaults object', 0.006, PAYROLL_DEFAULTS.futaRate);
eq('PAYROLL_DEFAULTS.sutaRate (illustrative)', 'defaults object', 0.03, PAYROLL_DEFAULTS.sutaRate);
eq('PAYROLL_DEFAULTS.sutaWageBase (illustrative)', 'defaults object', 10000, PAYROLL_DEFAULTS.sutaWageBase);
eq('PAYROLL_DEFAULTS.benefitsAnnual (mirrors paytype stack)', 'defaults object', 11000, PAYROLL_DEFAULTS.benefitsAnnual);
eq('PAYROLL_DEFAULTS.workersCompAnnual (illustrative)', 'defaults object', 900, PAYROLL_DEFAULTS.workersCompAnnual);
eq('2025 SS wage base', 'constant', 176100, PAYROLL_CONSTANTS.ssWageBase);
eq('employer SS rate (§3111(a))', 'constant', 0.062, PAYROLL_CONSTANTS.erSsRate);
eq('employer Medicare rate (§3111(b))', 'constant', 0.0145, PAYROLL_CONSTANTS.erMedicareRate);
eq('FUTA wage base per employee (§3306(b)(1))', 'constant', 7000, PAYROLL_CONSTANTS.futaWageBase);
eq('FUTA standard rate (§3301)', 'constant', 0.06, PAYROLL_CONSTANTS.futaStandardRate);
eq('FUTA max §3302(a) credit', 'constant', 0.054, PAYROLL_CONSTANTS.futaMaxCreditRate);
eq('FUTA common effective rate (6.0% − 5.4%)', 'constant', 0.006, PAYROLL_CONSTANTS.futaEffectiveDefault);
eq('hours per year (capacity basis)', 'constant', 2080, PAYROLL_CONSTANTS.hoursPerYear);

/* ============ 2. Employer FICA — the mirror half, no 0.9% ============ */
eq('employerFica(0)', 'wages $0', 0, employerFica(0));
eq('employerFica(60000)', '$60k → 3,720 + 870 (doc anchor)', 4590, employerFica(60000));
eq('employerFica(176100)', 'at the SS base: 10,918.20 + 2,553.45', 13471.65, employerFica(176100));
eq('employerFica(200000)', 'above $200k: no 0.9% at the threshold', 13818.2, employerFica(200000));
// The 0.9% asymmetry anchor: at $250k the EMPLOYEE also pays 0.9% × 50,000 =
// $450 (pinned at 14,993.20 in paytype.test.mjs) — the employer never matches
// the surcharge, so employerFica(250k) = 14,993.20 − 450.
eq('employerFica(250000)', '10,918.20 + 3,625; never the 0.9% surcharge', 14543.2, employerFica(250000));
eq('employer FICA is exactly the employee half below the cap', 'both halves on $60k', 9180,
  employerFica(60000) + (60000 * 0.0765));

/* ============ 3. FUTA & SUTA primitives (inputs honored) ============ */
eq('futaTax(5000, 0.006)', 'wages under the base: 0.6% × 5,000', 30, futaTax(5000, 0.006));
eq('futaTax(60000, 0.006)', 'only the first $7,000: 0.6% × 7,000', 42, futaTax(60000, 0.006));
eq('futaTax(60000) default rate', 'default effective rate 0.6%', 42, futaTax(60000));
eq('futaTax(60000, 0.06)', 'full §3301 rate, no state credit', 420, futaTax(60000, 0.06));
eq('futaTax(0, 0.006)', 'wages $0', 0, futaTax(0, 0.006));
eq('sutaTax(60000, 0.03, 10000)', '3% × first $10,000 (doc anchor)', 300, sutaTax(60000, 0.03, 10000));
eq('sutaTax(8000, 0.03, 10000)', 'wages under the state base', 240, sutaTax(8000, 0.03, 10000));
eq('sutaTax(60000, 0.027, 7000)', 'a federal-minimum-base state: 2.7% × 7,000', 189, sutaTax(60000, 0.027, 7000));
eq('sutaTax(0, 0.03, 10000)', 'wages $0', 0, sutaTax(0, 0.03, 10000));

/* ============ 4. The full stack on the defaults ============ */
{
  const r = computeEmployerCost(PAYROLL_DEFAULTS);
  const inp = 'defaults: $60k salary, 0.6% FUTA, 3% × $10k SUTA, $11k benefits, $900 comp';
  eq('stack: salary', inp, 60000, r.salary);
  eq('stack: employerFica', inp, 4590, r.employerFica);
  eq('stack: futa', inp, 42, r.futa);
  eq('stack: suta', inp, 300, r.suta);
  eq('stack: benefits', inp, 11000, r.benefits);
  eq('stack: workersComp', inp, 900, r.workersComp);
  eq('stack: employerPayrollTaxes (FICA+FUTA+SUTA)', inp, 4932, r.employerPayrollTaxes);
  eq('stack: loadedCost (doc anchor)', inp, 76832, r.loadedCost);
  eq('stack: burdenOverSalary', inp, 16832, r.burdenOverSalary);
  eq('stack: burdenRatePct', inp, 28.053333, r.burdenRatePct, 1e-5);
  eq('stack: loadedMultiple', inp, 1.280533, r.loadedMultiple, 1e-5);
  eq('stack: costPerHour (÷ 2,080)', inp, 36.938462, r.costPerHour, 1e-5);
}

/* ============ 5. Guards — clamping and degenerate inputs ============ */
{
  const r = computeEmployerCost({ ...PAYROLL_DEFAULTS, salary: -10000 });
  eq('negative salary clamps to 0: salary', 'salary −$10k', 0, r.salary);
  eq('negative salary clamps to 0: employerFica', 'salary −$10k', 0, r.employerFica);
  eq('negative salary clamps to 0: futa', 'salary −$10k', 0, r.futa);
  eq('negative salary clamps to 0: suta', 'salary −$10k', 0, r.suta);
  // Benefits and comp are premiums, not wage-linked — they survive a zero salary.
  eq('zero salary keeps premium layers: loadedCost', 'salary −$10k → benefits + comp', 11900, r.loadedCost);
  eq('zero salary: burdenRatePct is 0-safe', 'salary −$10k', 0, r.burdenRatePct);
  const z = computeEmployerCost({ ...PAYROLL_DEFAULTS, salary: 0 });
  eq('salary 0 with premiums: loadedMultiple is Infinity (surfaced, not clamped)', 'salary $0', Infinity, z.loadedMultiple);
}

/* ============ 6. Sensitivity ladder — fixed layers amortize ============ */
{
  const base = {
    futaRate: PAYROLL_DEFAULTS.futaRate,
    sutaRate: PAYROLL_DEFAULTS.sutaRate,
    sutaWageBase: PAYROLL_DEFAULTS.sutaWageBase,
    benefitsAnnual: PAYROLL_DEFAULTS.benefitsAnnual,
    workersCompAnnual: PAYROLL_DEFAULTS.workersCompAnnual,
  };
  const pts = loadedCostSweep(base, [40000, 60000, 80000, 100000, 120000, 180000]);
  eq('ladder: point count', 'six salaries', 6, pts.length);
  eq('ladder: loaded @ $40k', 'benefits amortize over less salary', 55302, pts[0].loadedCost);
  eq('ladder: burden% @ $40k', '38.255% — heaviest rate in the ladder', 38.255, pts[0].burdenRatePct, 1e-4);
  eq('ladder: loaded @ $120k', 'under the SS base all the way', 141422, pts[4].loadedCost);
  eq('ladder: burden% @ $120k', '17.8517%', 17.851667, pts[4].burdenRatePct, 1e-4);
  // Above the $176,100 SS base the 6.2% layer stops: marginal employer FICA
  // on the next dollar is Medicare-only. Direct check on a fully-above-base
  // step: $180k → $200k adds exactly 20,000 × 1.45%.
  eq('marginal employer FICA above the SS base is 1.45% only', 'employerFica(200k) − employerFica(180k)', 290,
    employerFica(200000) - employerFica(180000));
  let loadedIncreasing = true;
  let burdenDecreasing = true;
  for (let i = 1; i < pts.length; i++) {
    if (pts[i].loadedCost <= pts[i - 1].loadedCost) loadedIncreasing = false;
    if (pts[i].burdenRatePct >= pts[i - 1].burdenRatePct) burdenDecreasing = false;
  }
  eq('ladder: loadedCost strictly increasing in salary', 'all six points', true, loadedIncreasing);
  eq('ladder: burdenRatePct strictly decreasing (fixed layers amortize)', 'all six points', true, burdenDecreasing);
}

/* ============ 7. Revenue coverage at a gross margin ============ */
eq('revenueToCover(76832, 50)', '$1 of cost needs $2 of revenue at 50% GM', 153664, revenueToCover(76832, 50));
eq('revenueToCover(76832, 35)', 'thin margin multiplies the requirement', 219520, revenueToCover(76832, 35));
eq('revenueToCover(76832, 100)', 'full margin covers at face', 76832, revenueToCover(76832, 100));
eq('revenueToCover(76832, 0)', 'zero margin never covers — Infinity surfaced', Infinity, revenueToCover(76832, 0));

console.log(`\npayroll.test.mjs: ${pass} assertions passed.`);

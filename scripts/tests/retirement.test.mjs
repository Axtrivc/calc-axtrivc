// Permanent regression matrix for lib/retirement.ts (Solo 401(k) vs SEP-IRA,
// tax year 2025) — pure-Node assertions, no test framework, no dependencies
// beyond node itself.
//
// RUN PREREQUISITE (owned by the unified test runner, NOT by this file): the
// engine libs must already be compiled to CommonJS under scripts/tests/.build/
// preserving the lib/ layout, i.e. these files exist:
//   scripts/tests/.build/lib/retirement.js  (+ its @/lib/* closure: tax.js)
// A minimal tsconfig that produces exactly that (verified against this repo):
//   {
//     "compilerOptions": {
//       "target": "ES2020", "module": "CommonJS", "strict": true,
//       "skipLibCheck": true, "noEmit": false, "incremental": false,
//       "baseUrl": "../..", "paths": { "@/*": ["./*"] },
//       "outDir": "scripts/tests/.build", "rootDir": "../.."
//     },
//     "files": ["lib/retirement.ts"]
//   }
// tsc pulls lib/tax.ts in through the @/ alias on its own. The compiled files
// keep their '@/lib/*' specifiers — the loader patch below resolves those
// against the same .build directory, so the runner needs no alias handling of
// its own. Then:
//   node scripts/tests/retirement.test.mjs
//
// Every expected value was derived by hand from the 2025 parameters in the
// lib header (IRS Notice 2024-80, Pub 560) and then confirmed against the
// compiled engine (tsc → node) before being written in. Bisection-derived
// values (incomeToMax*) are pinned to the analytic crossing ± the engine's
// documented $0.50 tolerance, noted per assertion. Any mismatch throws with
// input → expected → actual.

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
  RETIREMENT_CONSTANTS,
  catchUpForAge,
  deferralLimitFor,
  scheduleSETax,
  solePropPlanBase,
  solo401kCapacity,
  sepCapacity,
  compareRetirement,
  capacitySweep,
  incomeToMaxSolo,
  incomeToMaxSep,
} = require('./.build/lib/retirement.js');

let pass = 0;
function eq(name, input, expected, actual, tol = 1e-6) {
  const ok =
    typeof expected === 'number' && typeof actual === 'number'
      ? Math.abs(actual - expected) <= tol
      : actual === expected;
  if (!ok) {
    throw new Error(
      `[retirement.test] ${name}\n  input →    ${input}\n  expected → ${expected}` +
        (tol !== 1e-6 ? ` (±${tol})` : '') +
        `\n  actual →   ${actual}`,
    );
  }
  pass++;
  console.log(`PASS  ${name}  [${actual}]`);
}

/* ============ 1. 2025 catch-up ladder (age boundaries) ============ */
// 60–63 enhanced catch-up = 150% × $7,500; 50+ standard; 64 falls back.
eq('catchUpForAge(49)', 'age 49', 0, catchUpForAge(49));
eq('catchUpForAge(50)', 'age 50 (first eligible)', 7500, catchUpForAge(50));
eq('catchUpForAge(59)', 'age 59 (last standard year)', 7500, catchUpForAge(59));
eq('catchUpForAge(60)', 'age 60 (first enhanced year)', 11250, catchUpForAge(60));
eq('catchUpForAge(63)', 'age 63 (last enhanced year)', 11250, catchUpForAge(63));
eq('catchUpForAge(64)', 'age 64 (back to standard)', 7500, catchUpForAge(64));
eq('deferralLimitFor(45)', 'age 45', 23500, deferralLimitFor(45));
eq('deferralLimitFor(62)', 'age 62 ($23,500 + $11,250)', 34750, deferralLimitFor(62));

/* ============ 2. Statutory constants ============ */
eq('§402(g) deferral limit', 'constant', 23500, RETIREMENT_CONSTANTS.employeeDeferralLimit);
eq('standard catch-up', 'constant', 7500, RETIREMENT_CONSTANTS.catchUpLimit);
eq('SECURE 2.0 §109 enhanced catch-up', 'constant', 11250, RETIREMENT_CONSTANTS.enhancedCatchUpLimit);
eq('§415(c) annual additions cap', 'constant', 70000, RETIREMENT_CONSTANTS.totalAdditionsLimit);
eq('SEP-IRA cap', 'constant', 70000, RETIREMENT_CONSTANTS.sepLimit);
eq('statutory employer rate (S-corp)', 'constant', 0.25, RETIREMENT_CONSTANTS.employerRate);
eq('self-employed deduction-rate equivalent', '0.25 / 1.25', 0.2, RETIREMENT_CONSTANTS.employerRateSelfEmployed);

/* ============ 3. Schedule SE plumbing (delegates to lib/tax.ts) ============ */
eq('scheduleSETax(0)', 'profit $0', 0, scheduleSETax(0));
// $400-of-SE-base floor: 433 × 92.35% = $399.8755 < $400 → no SE tax.
eq('scheduleSETax(433)', 'profit $433 → SE base $399.8755 < $400 floor', 0, scheduleSETax(433));
// One dollar over: 434 × 92.35% = $400.799 → 15.3% × $400.799.
eq('scheduleSETax(434)', 'profit $434 → 15.3% × $400.799', 61.322247, scheduleSETax(434));
eq('scheduleSETax(100000)', 'profit $100k (all under SS cap)', 14129.55, scheduleSETax(100000));
// $200k crosses the cap: 15.3% × $176,100 + 2.9% × $8,600.
eq('scheduleSETax(200000)', 'profit $200k → 26,943.30 + 249.40', 27192.7, scheduleSETax(200000));
// Pub 560 worksheet line 3: base = profit − ½ SE tax.
eq('solePropPlanBase(100000)', '100,000 − 7,064.775', 92935.225, solePropPlanBase(100000));
eq('solePropPlanBase(200000)', '200,000 − 13,596.35', 186403.65, solePropPlanBase(200000));

/* ============ 4. Solo 401(k) capacity ============ */
// Regression anchor: the instrument's default state (sole-prop, $200k profit,
// age 45, full $23,500 deferral — RetirementCalculator DEFAULTS).
{
  const r = solo401kCapacity({ mode: 'sole-prop', income: 200000, age: 45, plannedDeferral: 23500 });
  const inp = 'sole-prop, $200k, age 45, deferral $23,500';
  eq('solo default: compensationBase', inp, 186403.65, r.compensationBase);
  eq('solo default: halfSeTax', inp, 13596.35, r.halfSeTax);
  eq('solo default: deferralCore', inp, 23500, r.deferralCore);
  eq('solo default: employer 20% × base', inp, 37280.73, r.employerContribution);
  eq('solo default: total', inp, 60780.73, r.total);
  eq('solo default: cappedBy415c', inp, false, r.cappedBy415c);
}
{
  const r = solo401kCapacity({ mode: 'scorp', income: 120000, age: 45, plannedDeferral: 23500 });
  eq('solo scorp $120k wages: employer 25% × wages', 'scorp, $120k, age 45, $23,500', 30000, r.employerContribution);
  eq('solo scorp $120k wages: total', 'scorp, $120k, age 45, $23,500', 53500, r.total);
}
{
  // §415(c) boundary: 25% × $400k = $100k of employer room, but only
  // $70,000 − $23,500 = $46,500 of headroom remains.
  const r = solo401kCapacity({ mode: 'scorp', income: 400000, age: 45, plannedDeferral: 23500 });
  const inp = 'scorp, $400k, age 45, $23,500';
  eq('solo capped by §415(c): employer', inp, 46500, r.employerContribution);
  eq('solo capped by §415(c): total', inp, 70000, r.total);
  eq('solo capped by §415(c): flag', inp, true, r.cappedBy415c);
}
{
  // Enhanced catch-up rides on TOP of the capped $70,000 (§415(c) excludes
  // catch-ups) and is earnings-limited only in the tighter direction.
  const r = solo401kCapacity({ mode: 'scorp', income: 400000, age: 62, plannedDeferral: 40000 });
  const inp = 'scorp, $400k, age 62, deferral $40,000';
  eq('solo age 62: catchUp', inp, 11250, r.catchUp);
  eq('solo age 62: employer still §415(c)-capped', inp, 46500, r.employerContribution);
  eq('solo age 62: total $70,000 + $11,250', inp, 81250, r.total);
}
{
  // Pub 560 Deduction Worksheet low-income clawback (step 12 + steps 16–18):
  // at $30k of profit the employer share AND the catch-up are both pinned to
  // ½ × (base − deferral), and the whole plan absorbs exactly the base.
  const r = solo401kCapacity({ mode: 'sole-prop', income: 30000, age: 62, plannedDeferral: 30000 });
  const inp = 'sole-prop, $30k, age 62, deferral $30,000';
  eq('solo clawback: base', inp, 27880.5675, r.compensationBase);
  eq('solo clawback: employer ½ × (base − deferral)', inp, 2190.28375, r.employerContribution);
  eq('solo clawback: catchUp = same remaining-earnings bound', inp, 2190.28375, r.catchUp);
  eq('solo clawback: total = whole compensation base', inp, 27880.5675, r.total);
}
{
  const r = solo401kCapacity({ mode: 'sole-prop', income: 30000, age: 45, plannedDeferral: 23500 });
  eq('solo $30k age 45: employer (step-12 cap binds)', 'sole-prop, $30k, age 45, $23,500', 2190.28375, r.employerContribution);
  eq('solo $30k age 45: total', 'sole-prop, $30k, age 45, $23,500', 25690.28375, r.total);
}
{
  // 100%-of-compensation guard: deferral alone consumes $20k of wages,
  // leaving the employer share nothing to sit on.
  const r = solo401kCapacity({ mode: 'scorp', income: 20000, age: 45, plannedDeferral: 23500 });
  const inp = 'scorp, $20k wages, age 45, $23,500';
  eq('solo 100%-of-pay: deferralCore = wages', inp, 20000, r.deferralCore);
  eq('solo 100%-of-pay: employer = 0', inp, 0, r.employerContribution);
  eq('solo 100%-of-pay: total = wages', inp, 20000, r.total);
}
{
  const r = solo401kCapacity({ mode: 'sole-prop', income: 0, age: 50, plannedDeferral: 5000 });
  eq('solo zero income: total', 'sole-prop, $0, age 50, $5,000', 0, r.total);
  eq('solo zero income: deferral', 'sole-prop, $0, age 50, $5,000', 0, r.deferralTotal);
}

/* ============ 5. SEP-IRA capacity ============ */
eq('sep sole-prop $200k: contribution 20% × base', 'sole-prop, $200k', 37280.73, sepCapacity('sole-prop', 200000).contribution);
eq('sep sole-prop $200k: base', 'sole-prop, $200k', 186403.65, sepCapacity('sole-prop', 200000).contributionBase);
eq('sep sole-prop $200k: rate', 'sole-prop, $200k', 0.2, sepCapacity('sole-prop', 200000).effectiveRate);
eq('sep sole-prop $30k: contribution (no worksheet cap for SEPs)', 'sole-prop, $30k', 5576.1135, sepCapacity('sole-prop', 30000).contribution);
eq('sep scorp $120k: contribution 25% × wages', 'scorp, $120k', 30000, sepCapacity('scorp', 120000).contribution);
{
  // Exactly at the cap: 25% × $280,000 = $70,000 — capped flag still false
  // (the flag means the cap, not income, did the limiting).
  const r = sepCapacity('scorp', 280000);
  eq('sep at $70k exactly: contribution', 'scorp, $280k wages', 70000, r.contribution);
  eq('sep at $70k exactly: capped flag', 'scorp, $280k wages', false, r.capped);
}
eq('sep above cap: contribution', 'scorp, $1M wages', 70000, sepCapacity('scorp', 1000000).contribution);
eq('sep above cap: capped flag', 'scorp, $1M wages', true, sepCapacity('scorp', 1000000).capped);
eq('sep sole-prop $3M: capped', 'sole-prop, $3M (20% × base = $589,781.91)', true, sepCapacity('sole-prop', 3000000).capped);

/* ============ 6. Head-to-head comparison ============ */
{
  const r = compareRetirement({ mode: 'sole-prop', income: 200000, age: 45, plannedDeferral: 23500 }, 24);
  const inp = 'sole-prop, $200k, age 45, $23,500 @ 24% marginal';
  eq('compare default: extraCapacity = the deferral bucket', inp, 23500, r.extraCapacity);
  eq('compare default: taxSavedSolo', inp, 14587.3752, r.taxSavedSolo);
  eq('compare default: taxSavedSep', inp, 8947.3752, r.taxSavedSep);
  eq('compare default: extraTaxSaved', inp, 5640, r.extraTaxSaved);
  eq('compare default: winner', inp, 'solo401k', r.winner);
}
{
  // Both plans saturated at $70,000 with no catch-up → tie by construction.
  const r = compareRetirement({ mode: 'scorp', income: 1000000, age: 45, plannedDeferral: 23500 }, 22);
  const inp = 'scorp, $1M, age 45 @ 22% marginal';
  eq('compare both maxed: extraCapacity', inp, 0, r.extraCapacity);
  eq('compare both maxed: taxSavedSolo = 22% × $70,000', inp, 15400, r.taxSavedSolo);
  eq('compare both maxed: winner', inp, 'tie', r.winner);
}
{
  const r = compareRetirement({ mode: 'scorp', income: 0, age: 45, plannedDeferral: 23500 }, 24);
  eq('compare zero income: winner', 'scorp, $0 @ 24%', 'tie', r.winner);
}
{
  // Marginal rate is clamped to [0, 85] — 99 prices at 85%.
  const r = compareRetirement({ mode: 'scorp', income: 120000, age: 45, plannedDeferral: 23500 }, 99);
  eq('compare rate clamp 99 → 85', 'scorp, $120k @ 99% (clamped to 85%)', 45475, r.taxSavedSolo, 1e-4);
}

/* ============ 7. Saturation incomes (bisection) ============ */
// Analytic crossing $186,000; the engine accepts capacity ≥ target − $0.50,
// i.e. 0.25 × wages ≥ $46,499.50 → $185,998.
eq('incomeToMaxSolo(scorp, 45)', 'wages where 23,500 + 25%×w = 70,000', 185998, incomeToMaxSolo('scorp', 45), 2);
// Hand-derived: base = 0.98660925p − 10,918.20 must reach $232,497.50.
eq('incomeToMaxSolo(sole-prop, 45)', 'profit where 20%×(p − ½SE) headroom fills §415(c)', 246719.45859, incomeToMaxSolo('sole-prop', 45), 2);
// The catch-up rides above the §415(c) ceiling, so it cannot move the
// saturation income — 62-year-old and 45-year-old cross at the same profit.
eq(
  'incomeToMaxSolo(sole-prop, 62) = age-45 crossing',
  'catch-up sits outside §415(c)',
  incomeToMaxSolo('sole-prop', 45),
  incomeToMaxSolo('sole-prop', 62),
  1e-6,
);
eq('incomeToMaxSep(scorp)', 'wages where 25%×w = $70,000 (analytic $280,000)', 279998, incomeToMaxSep('scorp'), 2);
eq('incomeToMaxSep(sole-prop)', 'profit where 20%×base = $69,999.50', 365814.226858, incomeToMaxSep('sole-prop'), 2);

/* ============ 8. Capacity sweep ============ */
{
  const pts = capacitySweep('scorp', 45, 30000, 50000, 3);
  eq('sweep 3-step: n', 'scorp, age 45, 30k→50k, 3 steps', 3, pts.length);
  eq('sweep 3-step: solo @30k (= wages; comp guard binds)', 'income $30k', 30000, pts[0].solo);
  eq('sweep 3-step: sep @30k', 'income $30k', 7500, pts[0].sep);
  eq('sweep 3-step: solo @40k', 'income $40k', 33500, pts[1].solo);
  eq('sweep 3-step: solo @50k', 'income $50k', 36000, pts[2].solo);
  eq('sweep 3-step: sep @50k', 'income $50k', 12500, pts[2].sep);
  const def = capacitySweep('scorp', 45);
  eq('sweep default: 48 points', 'default args', 48, def.length);
  eq('sweep default: first income $30k', 'default args', 30000, def[0].income);
  eq('sweep default: last income $500k', 'default args', 500000, def[def.length - 1].income);
}

console.log(`\nretirement.test.mjs: ${pass} assertions passed.`);

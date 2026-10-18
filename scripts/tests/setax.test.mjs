// setax.test.mjs — permanent regression matrix for lib/setax.ts
// (self-employment tax / SECA engine, tax years 2025 | 2026).
//
// Pure node assertions, no test framework, no dependencies. Every expected
// value below was (a) hand-derived from the documented statutory parameters
// (92.35% base factor, 12.4%/2.9%/0.9% layers, $400 floor, $176,100 /
// $184,500 wage bases, $200k/$250k/$125k Additional Medicare thresholds) and
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
//        1. $CALC_TEST_BUILD/lib/setax.js   (rootDir-projected layout)
//        2. $CALC_TEST_BUILD/setax.js       (flat layout, command above)
//   2. Run:  node scripts/tests/setax.test.mjs
// The compiled emit keeps any '@/lib/*' import specifier verbatim from the
// TypeScript source (tsc never rewrites path aliases); the preamble below
// installs a Module._resolveFilename hook that maps '@/lib/<x>' to the
// compiled sibling, so no post-emit rewriting is needed. (setax.js itself
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
  SE_TAX_CONSTANTS,
  wageBaseFor,
  normalizeSeYear,
  seTaxBase,
  ssWageBaseRoom,
  ssKinkNetProfit,
  computeSeTax,
  ficaOnWages,
  seVsFica,
  marginalSeTaxOnNextDollar,
  sweepSeries,
  quarterlySeInstallment,
} = require(buildModule('setax'));

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

/* ---- Parameters (SSA taxable maximum; statutory, non-indexed layers) ---- */
is('S1 wageBaseFor(2025) — SSA wage base', wageBaseFor(2025), 176100);
is('S2 wageBaseFor(2026) — SSA announced taxable maximum', wageBaseFor(2026), 184500);
is('S3 normalizeSeYear(1999) coerces to current year', normalizeSeYear(1999), 2026);
is('S4 normalizeSeYear(2025) preserved', normalizeSeYear(2025), 2025);
is('S5 SE_TAX_CONSTANTS.seBaseFactor (Sch SE line 4a)', SE_TAX_CONSTANTS.seBaseFactor, 0.9235);
is('S6 SE_TAX_CONSTANTS.minNetEarnings ($400 floor)', SE_TAX_CONSTANTS.minNetEarnings, 400);

/* ---- SE base & wage-base room ---- */
close('S7 seTaxBase(100000) = 0.9235 × 100000', seTaxBase(100000), 92350);
close('S8 seTaxBase(-5000) clamps negative profit to 0', seTaxBase(-5000), 0);
close('S9 ssWageBaseRoom(200000, 2026) — wages ≥ cap leave no SS room', ssWageBaseRoom(200000, 2026), 0);
close('S10 ssWageBaseRoom(-5000) — negative wages clamped', ssWageBaseRoom(-5000, 2026), 184500);
close('S11 ssWageBaseRoom(100000, 2025) = 176100 − 100000', ssWageBaseRoom(100000, 2025), 76100);

/* ---- Flagship default (SeTaxCalculator DEFAULTS: 120k profit, no W-2, single, 2026) ---- */
{
  const r = computeSeTax(120000, 0, 'single', 2026);
  close('S12 r(120k).base = 0.9235 × 120000', r.base, 110820);
  close('S13 r(120k).ssPart = 0.124 × 110820', r.ssPart, 13741.68);
  close('S14 r(120k).medicarePart = 0.029 × 110820', r.medicarePart, 3213.78);
  close('S15 r(120k).additionalPart = 0 (base < 200k threshold)', r.additionalPart, 0);
  close('S16 r(120k).totalSeTax = 13741.68 + 3213.78', r.totalSeTax, 16955.46);
  close('S17 r(120k).halfDeduction = 16955.46 ÷ 2 (§164(f))', r.halfDeduction, 8477.73);
  close('S18 r(120k).effectiveRateOnNet = 16955.46 / 120000 × 100', r.effectiveRateOnNet, 14.12955);
  is('S19 r(120k).applies', r.applies, true);
  close('S20 quarterlySeInstallment(16955.46) = ÷ 4 (1040-ES default)', quarterlySeInstallment(r.totalSeTax), 4238.865);
  close('S21 quarterlySeInstallment(-100) clamps to 0', quarterlySeInstallment(-100), 0);
}

/* ---- $400 net-earnings cliff (Schedule SE stopping rule) ---- */
is('S22 computeSeTax(433).applies — base 399.8755 < 400', computeSeTax(433, 0, 'single', 2026).applies, false);
close('S23 computeSeTax(433).totalSeTax = 0 below the floor', computeSeTax(433, 0, 'single', 2026).totalSeTax, 0);
is('S24 computeSeTax(434).applies — base 400.799 ≥ 400', computeSeTax(434, 0, 'single', 2026).applies, true);
// Hand: 434 × 0.9235 = 400.799; 0.153 × 400.799 = 61.322247 (whole base taxed, not the excess).
close('S25 computeSeTax(434).totalSeTax — cliff jump ≈ $61.32 (JSDoc anchor)', computeSeTax(434, 0, 'single', 2026).totalSeTax, 61.322247);

/* ---- Cap kink anchors (JSDoc: cap binds on 92.35% of profit, not the wage base) ---- */
close('S26 ssKinkNetProfit(0, 2026) = 184500 ÷ 0.9235', ssKinkNetProfit(0, 2026), 199783.432593395);
close('S27 ssKinkNetProfit(0, 2025) = 176100 ÷ 0.9235', ssKinkNetProfit(0, 2025), 190687.601515972);
is('S28 ssKinkNetProfit(184500, 2026) — exhausted room → null', ssKinkNetProfit(184500, 2026), null);

/* ---- Above-cap, above-threshold stack (250k single 2026) ---- */
{
  const r = computeSeTax(250000, 0, 'single', 2026);
  close('S29 r(250k).ssPart = 0.124 × 184500 (capped)', r.ssPart, 22878);
  close('S30 r(250k).medicarePart = 0.029 × 230875 (uncapped)', r.medicarePart, 6695.375);
  // 0.9% on min(base, base + 0 − 200000) = 0.009 × 30875.
  close('S31 r(250k).additionalPart = 0.009 × 30875', r.additionalPart, 277.875);
  close('S32 r(250k).totalSeTax', r.totalSeTax, 29851.25);
  close('S33 r(250k).halfDeduction (includes 0.9% layer)', r.halfDeduction, 14925.625);
}

/* ---- W-2 day-job coordination (60k profit + 160k W-2 wages, 2026) ---- */
{
  const r = computeSeTax(60000, 160000, 'single', 2026);
  close('S34 r(60k+160k W-2).ssRoom = 184500 − 160000', r.ssRoom, 24500);
  close('S35 r(60k+160k W-2).ssPart = 0.124 × 24500', r.ssPart, 3038);
  close('S36 r(60k+160k W-2).medicarePart = 0.029 × 55410', r.medicarePart, 1606.89);
  close('S37 r(60k+160k W-2).additionalPart = 0.009 × 15410', r.additionalPart, 138.69);
  close('S38 r(60k+160k W-2).totalSeTax', r.totalSeTax, 4783.58);
}

/* ---- MFS threshold ($125k — lowest of the three) ---- */
{
  const r = computeSeTax(150000, 0, 'mfs', 2026);
  is('S39 r(150k mfs).threshold', r.threshold, 125000);
  close('S40 r(150k mfs).additionalPart = 0.009 × 13525', r.additionalPart, 121.725);
  close('S41 r(150k mfs).totalSeTax = 17177.1 + 4017.225 + 121.725', r.totalSeTax, 21316.05);
}

/* ---- W-2 FICA comparison view ---- */
{
  const f = ficaOnWages(100000, 'single', 2026);
  close('S42 ficaOnWages(100000).employeeShare = 7.65% × 100000', f.employeeShare, 7650);
  close('S43 ficaOnWages(100000).employerShare', f.employerShare, 7650);
  close('S44 ficaOnWages(100000).combinedCost = 15.3%', f.combinedCost, 15300);
  const g = ficaOnWages(250000, 'single', 2026);
  close('S45 ficaOnWages(250000).employeeShare = 11439 + 3625 + 450', g.employeeShare, 15514);
  close('S46 ficaOnWages(250000).employerShare (no 0.9% match)', g.employerShare, 15064);
  close('S47 ficaOnWages(250000).combinedCost', g.combinedCost, 30578);
}

/* ---- Marginal per-dollar layers ---- */
{
  const m = marginalSeTaxOnNextDollar(120000, 0, 'single', 2026);
  close('S48 marginal(120k).ss = 0.9235 × 12.4¢', m.ss, 0.114514);
  close('S49 marginal(120k).medicare = 0.9235 × 2.9¢', m.medicare, 0.0267815);
  close('S50 marginal(120k).additional = 0', m.additional, 0);
  close('S51 marginal(120k).total = 14.13¢ (JSDoc anchor)', m.total, 0.1412955);
  const n = marginalSeTaxOnNextDollar(250000, 0, 'single', 2026);
  close('S52 marginal(250k).ss = 0 (cap exhausted)', n.ss, 0);
  close('S53 marginal(250k).total = 0.9235 × 3.8¢ = 3.5093¢ (JSDoc anchor)', n.total, 0.035093);
}

/* ---- Same-gross SE vs FICA ---- */
{
  const v = seVsFica(100000, 0, 'single', 2026);
  close('S54 seVsFica(100k).seMinusCombinedCost = 14129.55 − 15300', v.seMinusCombinedCost, -1170.45);
  close('S55 seVsFica(100k).seMinusEmployeeShare = 14129.55 − 7650', v.seMinusEmployeeShare, 6479.55);
}

/* ---- Chart sweep shape ---- */
{
  const s = sweepSeries(0, 100, 5, 0, 'single', 2026);
  is('S56 sweepSeries(0, 100, 5).length', s.length, 5);
  close('S57 sweepSeries[0].net — inclusive endpoints', s[0].net, 0);
  close('S58 sweepSeries[4].net', s[4].net, 100);
}

if (failures.length > 0) {
  console.error(`setax.test.mjs: ${failures.length}/${total} assertions FAILED:`);
  for (const f of failures) console.error('  ' + f);
  throw new Error(`setax.test.mjs failed: ${failures.length} of ${total} assertions mismatched`);
}
console.log(`setax.test.mjs: ${total}/${total} assertions passed`);

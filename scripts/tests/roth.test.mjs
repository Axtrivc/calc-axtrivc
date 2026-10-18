// roth.test.mjs — permanent regression matrix for lib/roth.ts
// (Roth vs Traditional retirement accounts, tax year 2025).
//
// Pure node assertions, no test framework, no dependencies. Every expected
// value below was (a) hand-derived from the 2025 parameters and equations in
// the lib header (IRA limit $7,000 per IRS News Release IR-2024-285; 401(k)
// §402(g) limit $23,500 per Notice 2024-80; SECURE 2.0 §109 enhanced catch-up
// $11,250 = 150% × $7,500 for ages 60–63; MAGI phase-out bands single
// $150k–$165k / MFJ $236k–$246k per IR-2024-285, MFS $0–$10k statutory
// §408A(c)(3); annuity-due factor G = ((1+r)^n − 1)/r × (1+r); framing-A
// advantage Δ = C·G·(t_ret − t_now)) and (b) confirmed against the compiled
// engine (tsc → node) before being written in. Hand chains were carried to
// 7+ significant digits and reconciled against the engine output.
//
// RUN PREREQUISITE — provided by the unified test runner, NOT by this file:
//   1. Compile the pure libs to CommonJS into scripts/tests/.build/ with the
//      rootDir-projected layout (lib/*.js). The compiled module is resolved
//      from the first existing candidate, overridable with $CALC_TEST_BUILD:
//        1. $CALC_TEST_BUILD/lib/roth.js   (rootDir-projected layout)
//        2. $CALC_TEST_BUILD/roth.js       (flat layout)
//   2. Run:  node scripts/tests/roth.test.mjs
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
  ROTH_CONSTANTS,
  catchUpFor,
  contributionLimit,
  rothPhaseOutFraction,
  annuityDueFactor,
  balancePath,
  compareRoth,
  retirementRateSweep,
  horizonSweep,
  gapMagnitude,
} = require(buildModule('roth'));

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

/* ---- 2025 parameters (IR-2024-285 / Notice 2024-80 / SECURE 2.0 §109) ---- */
is('R1 IRA limit', ROTH_CONSTANTS.iraLimit, 7000);
is('R2 IRA age-50 catch-up (§219(b)(5)(B))', ROTH_CONSTANTS.iraCatchUp, 1000);
is('R3 401(k) §402(g) limit', ROTH_CONSTANTS.k401Limit, 23500);
is('R4 401(k) 50+ catch-up (§414(v))', ROTH_CONSTANTS.k401CatchUp, 7500);
is('R5 enhanced catch-up 60–63 (150% × $7,500)', ROTH_CONSTANTS.k401EnhancedCatchUp, 11250);
is('R6 single phase-out start', ROTH_CONSTANTS.rothMagiPhaseOut.single.start, 150000);
is('R7 single phase-out end', ROTH_CONSTANTS.rothMagiPhaseOut.single.end, 165000);
is('R8 MFJ phase-out start', ROTH_CONSTANTS.rothMagiPhaseOut.mfj.start, 236000);
is('R9 MFJ phase-out end', ROTH_CONSTANTS.rothMagiPhaseOut.mfj.end, 246000);
is('R10 MFS phase-out end (§408A(c)(3), unindexed)', ROTH_CONSTANTS.rothMagiPhaseOut.mfs.end, 10000);

/* ---- Catch-up ladder (age phase breakpoints) ---- */
is('R20 catchUpFor(ira, 49)', catchUpFor('ira', 49), 0);
is('R21 catchUpFor(ira, 50) — first eligible', catchUpFor('ira', 50), 1000);
is('R22 catchUpFor(ira, 74) — no enhanced tier for IRAs', catchUpFor('ira', 74), 1000);
is('R23 catchUpFor(401k, 49)', catchUpFor('401k', 49), 0);
is('R24 catchUpFor(401k, 50)', catchUpFor('401k', 50), 7500);
is('R25 catchUpFor(401k, 59) — last standard year', catchUpFor('401k', 59), 7500);
is('R26 catchUpFor(401k, 60) — first enhanced year', catchUpFor('401k', 60), 11250);
is('R27 catchUpFor(401k, 63) — last enhanced year', catchUpFor('401k', 63), 11250);
is('R28 catchUpFor(401k, 64) — back to standard', catchUpFor('401k', 64), 7500);
is('R30 contributionLimit(ira, 35).total', contributionLimit('ira', 35).total, 7000);
is('R31 contributionLimit(ira, 55).total = 7,000 + 1,000', contributionLimit('ira', 55).total, 8000);
is('R32 contributionLimit(401k, 62).total = 23,500 + 11,250', contributionLimit('401k', 62).total, 34750);
is('R33 contributionLimit(401k, 49).total', contributionLimit('401k', 49).total, 23500);

/* ---- Roth IRA MAGI phase-out fraction (IRC §408A(c)(3) shape) ---- */
close('R40 frac(single, 150,000) = 1 at band start', rothPhaseOutFraction(150000, 'single'), 1);
close('R41 frac(single, 157,500) = 15k/30k = 0.5 mid-band', rothPhaseOutFraction(157500, 'single'), 0.5);
close('R42 frac(single, 165,000) = 0 at band end', rothPhaseOutFraction(165000, 'single'), 0);
close('R43 frac(single, 180,000) = 0 above band', rothPhaseOutFraction(180000, 'single'), 0);
close('R44 frac(mfj, 236,000) = 1 at band start', rothPhaseOutFraction(236000, 'mfj'), 1);
close('R45 frac(mfj, 241,000) = 5k/10k = 0.5 mid-band', rothPhaseOutFraction(241000, 'mfj'), 0.5);
close('R46 frac(mfs, 0) = 1 at band start', rothPhaseOutFraction(0, 'mfs'), 1);
close('R47 frac(mfs, 5,000) = 5k/10k = 0.5 mid-band', rothPhaseOutFraction(5000, 'mfs'), 0.5);
close('R48 frac(mfs, 10,000) = 0 at band end', rothPhaseOutFraction(10000, 'mfs'), 0);

/* ---- Annuity-due factor G = ((1+r)^n − 1)/r × (1+r) ---- */
// Hand: 1.07^10 = 1.9671513573; (0.9671513573/0.07) × 1.07 = 13.81644796 × 1.07.
close('R60 G(7%, 10) = 13.81644796 × 1.07', annuityDueFactor(7, 10), 14.7835993185691);
close('R61 G(0%, 30) = 30 (zero-rate branch)', annuityDueFactor(0, 30), 30);
close('R62 G(5%, 1) = 1.05 (single start-of-year dollar)', annuityDueFactor(5, 1), 1.05);
close('R63 G(7%, 0) = 0 (nothing contributed yet)', annuityDueFactor(7, 0), 0);
// Hand: 1.5^10 = 57.6650390625; (56.6650390625/0.5) × 1.5 = 113.330078125 × 1.5.
close('R64 G(60%, 10) clamps r to 50%', annuityDueFactor(60, 10), 169.9951171875);
// Hand: 0.95^4 = 0.81450625; (0.18549375/0.05) × 0.95 = 3.709875 × 0.95.
close('R65 G(−5%, 4) — negative return compounds down', annuityDueFactor(-5, 4), 3.52438125);

/* ---- balancePath (cumulative-growth view) ---- */
{
  const bp = balancePath(1000, 7, 3);
  is('R70 balancePath(1000, 7%, 3).length = n + 1', bp.length, 4);
  close('R71 balancePath[0] = 0 before any contribution', bp[0].balance, 0);
  close('R72 balancePath[1] = 1,000 × 1.07', bp[1].balance, 1070);
  close('R73 balancePath[2] = 1,000 × 2.2149', bp[2].balance, 2214.9);
  // Hand: 1.07^3 = 1.225043; (0.225043/0.07) × 1.07 = 3.2149 × 1.07.
  close('R74 balancePath[3] = 1,000 × 3.439943', bp[3].balance, 3439.943);
}

/* ---- Flagship comparison — RothCalculator DEFAULTS ---- */
// 24% → 12%, $7,000/yr, 30 years, 7% return.
// Hand: 1.07^30 = 7.612255043; G = (6.612255043/0.07) × 1.07 = 101.0730414.
{
  const r = compareRoth({
    currentRatePct: 24,
    retirementRatePct: 12,
    annualContribution: 7000,
    years: 30,
    annualReturnPct: 7,
  });
  const inp = '24%→12%, $7,000, 30y, 7%';
  close('R80 factor = ((1.07^30 − 1)/0.07) × 1.07', r.factor, 101.073041366405);
  close('R81 tradBalance = 7,000 × G', r.tradBalance, 707511.289564838);
  close('R82 rothBalance = 7,000 × 0.76 × G', r.rothBalance, 537708.580069277);
  close('R83 tradSpendable = balance × (1 − 0.12)', r.tradSpendable, 622609.934817058);
  close('R84 rothSpendable = whole balance', r.rothSpendable, 537708.580069277);
  // Hand: Δ = C·G·(t_ret − t_now) = 7,000 × 101.0730414 × (−0.12).
  close('R85 advantageRoth = C·G·(t_ret − t_now)', r.advantageRoth, -84901.3547477806);
  is('R86 winner — lower retirement rate favors Traditional', r.winner, 'traditional');
  close('R87 breakeven = the clamped t_now', r.breakevenRetirementRatePct, 24);
  close('R88 perPointSwing = C·G/100', r.perPointSwing, 7075.11289564838);
  close('R89 rothSpendableLimitView = C·G (full nominal C)', r.rothSpendableLimitView, 707511.289564838);
  close('R90 advantageRothLimitView = C·G·t_ret', r.advantageRothLimitView, 84901.3547477806);
  is('R91 effectiveYears unchanged', r.effectiveYears, 30);
}

/* ---- Break-even: flat-rate model ties exactly at t_ret = t_now ---- */
{
  const r = compareRoth({
    currentRatePct: 24,
    retirementRatePct: 24,
    annualContribution: 7000,
    years: 30,
    annualReturnPct: 7,
  });
  close('R100 tie: advantageRoth = 0 at t_ret = t_now', r.advantageRoth, 0);
  is('R101 tie: winner', r.winner, 'tie');
}
{
  // "Low-income year" scenario (12% → 24%, 25y): Hand 1.07^25 = 5.427432642;
  // G = 63.2490377 × 1.07 = 67.6764704; Δ = 7,000 × 67.6764704 × 0.12.
  const r = compareRoth({
    currentRatePct: 12,
    retirementRatePct: 24,
    annualContribution: 7000,
    years: 25,
    annualReturnPct: 7,
  });
  close('R110 roth-wins factor = G(7%, 25)', r.factor, 67.6764703561643);
  close('R111 roth-wins advantageRoth', r.advantageRoth, 56848.235099178);
  is('R112 roth-wins winner', r.winner, 'roth');
}

/* ---- Input clamps (deep-link sanitation) ---- */
{
  const r = compareRoth({
    currentRatePct: 999,
    retirementRatePct: 50,
    annualContribution: 7000,
    years: 30,
    annualReturnPct: 7,
  });
  close('R120 currentRate 999 clamps to 85', r.effectiveCurrentRatePct, 85);
  close('R121 breakeven reports the clamped rate', r.breakevenRetirementRatePct, 85);
}
{
  const r = compareRoth({
    currentRatePct: 24,
    retirementRatePct: -5,
    annualContribution: 7000,
    years: 30,
    annualReturnPct: 7,
  });
  close('R130 retirementRate −5 clamps to 0', r.effectiveRetirementRatePct, 0);
  close('R131 0% retirement rate → fully spendable Trad', r.tradSpendable, 707511.289564838);
}
{
  const r = compareRoth({
    currentRatePct: 24,
    retirementRatePct: 12,
    annualContribution: 7000,
    years: 100,
    annualReturnPct: 7,
  });
  close('R140 years 100 clamps to 70', r.effectiveYears, 70);
}
{
  const r = compareRoth({
    currentRatePct: 24,
    retirementRatePct: 12,
    annualContribution: 7000,
    years: 0,
    annualReturnPct: 7,
  });
  close('R150 zero horizon: tradBalance = 0', r.tradBalance, 0);
  close('R151 zero horizon: advantageRoth = 0', r.advantageRoth, 0);
  is('R152 zero horizon: winner tie', r.winner, 'tie');
}
{
  const r = compareRoth({
    currentRatePct: NaN,
    retirementRatePct: 12,
    annualContribution: 7000,
    years: 30,
    annualReturnPct: 7,
  });
  close('R160 NaN rate sanitizes to 0 (not a rail)', r.effectiveCurrentRatePct, 0);
}
{
  const r = compareRoth({
    currentRatePct: 24,
    retirementRatePct: 12,
    annualContribution: NaN,
    years: 30,
    annualReturnPct: 7,
  });
  close('R170 NaN contribution sanitizes to 0', r.tradBalance, 0);
}

/* ---- retirementRateSweep (break-even scan) ---- */
// C $6,000, t_now 22%, 5%, 10y. Hand: G(5%, 10) = 12.57789254 × 1.05 =
// 13.20678716; tradBalance = 79,240.723; rothSpendable = 4,680 × 13.20678716.
{
  const input = {
    currentRatePct: 22,
    retirementRatePct: 0,
    annualContribution: 6000,
    years: 10,
    annualReturnPct: 5,
  };
  const s = retirementRateSweep(input, 0, 44, 44);
  is('R180 sweep 0→44/44 steps: n = steps + 1', s.length, 45);
  close('R181 sweep[0].retirementRatePct = 0', s[0].retirementRatePct, 0);
  close('R182 sweep[0].tradSpendable = full C·G at 0%', s[0].tradSpendable, 79240.7229739577);
  close('R183 sweep[0].rothSpendable = 4,680 × G', s[0].rothSpendable, 61807.763919687);
  // Crossing: at rate 22 (= t_now) the two columns tie — Δ = C·G·(0.22−0.22) = 0.
  close('R184 sweep crosses exactly at t_now (index 22)', s[22].rothSpendable - s[22].tradSpendable, 0, 1e-6);
  close('R185 sweep[44].tradSpendable = C·G × (1 − 0.44)', s[44].tradSpendable, 44374.8048654163);
  // Framing A: t_ret never touches the Roth column — it is flat across the scan.
  is('R186 roth column flat across the sweep', s.every((q) => Math.abs(q.rothSpendable - s[0].rothSpendable) < 1e-9), true);
  const d = retirementRateSweep(input);
  is('R187 default sweep: 46 points (0→45, 45 steps)', d.length, 46);
  close('R188 default sweep ends at 45%', d[d.length - 1].retirementRatePct, 45);
}

/* ---- horizonSweep (compounding amplifies the gap) ---- */
// C $5,000, 24% → 30%, 6%: Δ(n) = 5,000 × G(6%, n) × 0.06 = 300 × G(6%, n).
{
  const input = {
    currentRatePct: 24,
    retirementRatePct: 30,
    annualContribution: 5000,
    years: 30,
    annualReturnPct: 6,
  };
  const hs = horizonSweep(input);
  is('R190 default horizons: 8 points', hs.length, 8);
  // Hand: 1.06^10 = 1.790847697; G = (0.790847697/0.06) × 1.06 = 13.97164267;
  // Δ(10) = 300 × 13.97164267.
  close('R191 horizon 10y advantageRoth = 300 × G(6%,10)', hs.find((q) => q.years === 10).advantageRoth, 4191.49279167713);
  close('R192 horizon 40y advantageRoth compounds to', hs.find((q) => q.years === 40).advantageRoth, 49214.3050667675);
  const custom = horizonSweep(input, [1, 2]);
  is('R193 custom horizon list length', custom.length, 2);
  close('R194 1y horizon: 5,000 × 1.06 × 0.06', custom[0].advantageRoth, 318);
}

/* ---- gapMagnitude (chart helper) ---- */
// Hand: 7,000 × 101.0730414 × 0.06 = 42,450.68 — equals the flagship Δ at
// t_ret = 30, an independent route to the same number.
close('R200 gapMagnitude(7,000, 6pts, 7%, 30y)', gapMagnitude(7000, 6, 7, 30), 42450.6773738903);
close('R201 gapMagnitude sign-symmetric (−6 pts)', gapMagnitude(7000, -6, 7, 30), 42450.6773738903);
close('R202 gapMagnitude clamps gap at 85pts: 7,000 × G × 0.85', gapMagnitude(7000, 200, 7, 30), 601384.596130113);

if (failures.length > 0) {
  console.error(`roth.test.mjs: ${failures.length}/${total} assertions FAILED:`);
  for (const f of failures) console.error('  ' + f);
  throw new Error(`roth.test.mjs failed: ${failures.length} of ${total} assertions mismatched`);
}
console.log(`roth.test.mjs: ${total}/${total} assertions passed`);

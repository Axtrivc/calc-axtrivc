// rdcredit.test.mjs — permanent regression matrix for lib/rdcredit.ts
// (§41 R&D credit, Alternative Simplified Credit branch, tax year 2025).
//
// Pure node assertions, no test framework, no dependencies. Every expected
// value below was (a) hand-derived from the 2025 parameters cited inline in
// RDC_CONSTANTS — IRC §41(c)(4) ASC 14%-over-half-prior-average and the 6%
// no-prior-QRE special rule; §280C(c)(2)(B) reduced credit = credit × (1 −
// 21% §11(b) rate); §38(c)(1)(B) GBC ceiling = tax − max(0, 25% × (tax −
// $25,000)); §41(h)(2)(B) $500,000 payroll-election cap (IRA §13902); §3111
// employer FICA 6.2% + 1.45% — and (b) confirmed against the compiled engine
// (tsc → temp build dir → node, dump compared value-by-value) before being
// written in.
//
// RUN PREREQUISITE — provided by the unified test runner, NOT by this file:
//   1. Compile the pure libs to CommonJS into scripts/tests/.build/ — e.g.
//        npx tsc lib/safe.ts lib/rdcredit.ts \
//          --outDir scripts/tests/.build --module commonjs --target es2020 \
//          --esModuleInterop --skipLibCheck
//      The compiled module is resolved from the first existing candidate,
//      overridable with $CALC_TEST_BUILD:
//        1. $CALC_TEST_BUILD/lib/rdcredit.js   (rootDir-projected layout)
//        2. $CALC_TEST_BUILD/rdcredit.js       (flat layout, command above)
//   2. Run:  node scripts/tests/rdcredit.test.mjs
// The compiled emit keeps any '@/lib/*' import specifier verbatim from the
// TypeScript source (tsc never rewrites path aliases); the preamble below
// installs a Module._resolveFilename hook that maps '@/lib/<x>' to the
// compiled sibling, so no post-emit rewriting is needed. (rdcredit.js itself
// has no aliased imports; the hook is kept uniform across the directory.)

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
  RDC_CONSTANTS,
  computeGrossCredit,
  gbcCeiling,
  evaluateIncomePath,
  evaluatePayrollPath,
  qreSweep,
  marginalRateSweep,
} = require(buildModule('rdcredit'));

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

/* ---- 2025 statutory parameters (anchors against silent constant drift) ---- */
is('R1 ascRate — §41(c)(4)(A) 14%', RDC_CONSTANTS.ascRate, 0.14);
is('R2 startupRate — §41(c)(4)(B) 6%', RDC_CONSTANTS.startupRate, 0.06);
is('R3 baseShare — §41(c)(4)(A) half the prior average', RDC_CONSTANTS.baseShare, 0.5);
is('R4 corpMaxRate — §280C(c)(2)(B) 21% since 2018', RDC_CONSTANTS.corpMaxRate, 0.21);
is('R5 gbcRate — §38(c)(1)(B) 25% haircut', RDC_CONSTANTS.gbcRate, 0.25);
is('R6 gbcFloor — §38(c)(1)(B) $25,000', RDC_CONSTANTS.gbcFloor, 25000);
is('R7 qsbPayrollCap — §41(h)(2)(B) $500,000 (IRA §13902)', RDC_CONSTANTS.qsbPayrollCap, 500000);
is('R8 qsbReceiptsCap — §41(h)(3)(B)(i) $5M gross receipts', RDC_CONSTANTS.qsbReceiptsCap, 5000000);
is('R9 employerOasdi — §3111(a) 6.2%', RDC_CONSTANTS.employerOasdi, 0.062);
is('R10 employerHi — §3111(b) 1.45%', RDC_CONSTANTS.employerHi, 0.0145);

/* ---- computeGrossCredit (§41(c)(4)) ---- */
{
  const g = computeGrossCredit({ qre: 200000, priorAvg3Qre: 0 });
  is('R20 startup method (avg = 0)', g.method, 'asc-startup');
  close('R21 startup base = 0', g.base, 0);
  close('R22 startup increment = full QRE', g.increment, 200000);
  close('R23 startup credit = 6% × 200k', g.grossCredit, 12000);
}
{
  const g = computeGrossCredit({ qre: 500000, priorAvg3Qre: 300000 });
  is('R24 established method', g.method, 'asc');
  close('R25 base = 50% × 300k', g.base, 150000);
  close('R26 increment = 500k − 150k', g.increment, 350000);
  close('R27 credit = 14% × 350k', g.grossCredit, 49000);
}
{
  const g = computeGrossCredit({ qre: 100000, priorAvg3Qre: 300000 });
  close('R28 QRE below base → increment floors at 0', g.increment, 0);
  close('R29 QRE below base → credit 0, never negative', g.grossCredit, 0);
}
is('R30 zero QRE, zero avg → method still the 6% rule', computeGrossCredit({ qre: 0, priorAvg3Qre: 0 }).method, 'asc-startup');
close('R31 zero QRE → credit 0', computeGrossCredit({ qre: 0, priorAvg3Qre: 0 }).grossCredit, 0);
close('R32 negative QRE sanitized → credit 0', computeGrossCredit({ qre: -50000, priorAvg3Qre: 0 }).grossCredit, 0);
// The two regimes cross at QRE* = 7/4 × base = 0.875 × prior average:
// 6% × 350k = 21,000 and 14% × (350k − 200k) = 21,000.
close('R33 crossover Q*: 6% × 350k', computeGrossCredit({ qre: 350000, priorAvg3Qre: 0 }).grossCredit, 21000);
close('R34 crossover Q*: 14% × 150k — identical', computeGrossCredit({ qre: 350000, priorAvg3Qre: 400000 }).grossCredit, 21000);

/* ---- gbcCeiling (§38(c)) ---- */
close('R40 tax 100k: 100000 − 25% × 75000', gbcCeiling(100000), 81250);
close('R41 tax 30k: 30000 − 25% × 5000', gbcCeiling(30000), 28750);
close('R42 tax 25k — AT the floor, no haircut yet', gbcCeiling(25000), 25000);
close('R43 tax 26k — first dollar above the floor is haircut', gbcCeiling(26000), 25750);
close('R44 tax 10k — below floor, untouched', gbcCeiling(10000), 10000);
close('R45 tax 0 → 0', gbcCeiling(0), 0);
close('R46 negative tax sanitized → 0', gbcCeiling(-5), 0);
close('R47 tax 500k: 500000 − 25% × 475000', gbcCeiling(500000), 381250);

/* ---- evaluateIncomePath, ceiling slack (QRE 500k, avg 300k, tax 500k, 24%) ---- */
// gross 49000; ceiling 381250 (slack); full-credit branch nets 49000 × 0.76.
{
  const r = evaluateIncomePath({ qre: 500000, priorAvg3Qre: 300000, regularTax: 500000, marginalRate: 0.24, elect280C: false });
  close('R50 grossCredit', r.grossCredit, 49000);
  close('R51 incomeGross — no payroll election', r.incomeGross, 49000);
  close('R52 ceiling', r.ceiling, 381250);
  is('R53 ceilingBinds false', r.ceilingBinds, false);
  close('R54 selected.claimed — full credit', r.selected.claimed, 49000);
  close('R55 selected.used — all applied this year', r.selected.used, 49000);
  close('R56 selected.carriedForward = 0', r.selected.carriedForward, 0);
  close('R57 selected.deductionReduction = credit allowed (§280C(c)(1))', r.selected.deductionReduction, 49000);
  close('R58 selected.netBenefit = 49000 × (1 − 0.24)', r.selected.netBenefit, 37240);
  close('R59 alternative.netBenefit = 49000 × 0.79', r.alternative.netBenefit, 38710);
  close('R60 electionAdvantage = 49000 × (0.24 − 0.21)', r.electionAdvantage, -1470);
}
{
  const r = evaluateIncomePath({ qre: 500000, priorAvg3Qre: 300000, regularTax: 500000, marginalRate: 0.24, elect280C: true });
  close('R61 election branch: claimed = 49000 × 0.79', r.selected.claimed, 38710);
  close('R62 election branch: netBenefit = claimed', r.selected.netBenefit, 38710);
  close('R63 election branch: deductionReduction = 0', r.selected.deductionReduction, 0);
  close('R64 electionAdvantage flips sign when elected', r.electionAdvantage, 1470);
}

/* ---- evaluateIncomePath, ceiling binds (QRE 2M startup, tax 100k, 35%) ---- */
// gross 120000; ceiling 81250 → 38750 carries; deduction falls by the ALLOWED
// credit (81250), so netBenefit = 81250 × 0.65.
{
  const r = evaluateIncomePath({ qre: 2000000, priorAvg3Qre: 0, regularTax: 100000, marginalRate: 0.35, elect280C: false });
  is('R70 method under the 6% special rule', r.method, 'asc-startup');
  close('R71 grossCredit = 6% × 2M', r.grossCredit, 120000);
  close('R72 ceiling at 100k tax', r.ceiling, 81250);
  is('R73 ceilingBinds true', r.ceilingBinds, true);
  close('R74 selected.claimed — full credit still claimed', r.selected.claimed, 120000);
  close('R75 selected.used — capped at the ceiling', r.selected.used, 81250);
  close('R76 selected.carriedForward = 120000 − 81250', r.selected.carriedForward, 38750);
  close('R77 selected.deductionReduction = USED amount, not claimed', r.selected.deductionReduction, 81250);
  close('R78 selected.netBenefit = 81250 × 0.65', r.selected.netBenefit, 52812.5);
  close('R79 alternative.claimed = 120000 × 0.79', r.alternative.claimed, 94800);
  close('R80 alternative.carriedForward = 94800 − 81250', r.alternative.carriedForward, 13550);
  close('R81 electionAdvantage = 52812.5 − 81250', r.electionAdvantage, -28437.5);
}

/* ---- §41(h) payroll split happens FIRST on the income path ---- */
{
  const r = evaluateIncomePath({ qre: 500000, priorAvg3Qre: 300000, regularTax: 500000, marginalRate: 0.24, elect280C: false, electedToPayroll: 20000 });
  close('R90 electedToPayroll echo', r.electedToPayroll, 20000);
  close('R91 incomeGross = 49000 − 20000', r.incomeGross, 29000);
  close('R92 selected.netBenefit = 29000 × 0.76', r.selected.netBenefit, 22040);
  close('R93 alternative.netBenefit = 29000 × 0.79', r.alternative.netBenefit, 22910);
  close('R94 electionAdvantage = 29000 × (0.24 − 0.21)', r.electionAdvantage, -870);
}
{
  const hi = evaluateIncomePath({ qre: 500000, priorAvg3Qre: 300000, regularTax: 500000, marginalRate: 0.24, elect280C: false, electedToPayroll: 99999 });
  close('R95 election clamped to the gross credit', hi.electedToPayroll, 49000);
  close('R96 incomeGross → 0', hi.incomeGross, 0);
  const neg = evaluateIncomePath({ qre: 500000, priorAvg3Qre: 300000, regularTax: 500000, marginalRate: 0.24, elect280C: false, electedToPayroll: -1000 });
  close('R97 negative election clamped to 0', neg.electedToPayroll, 0);
  close('R98 negative election → same as no election', neg.selected.netBenefit, 37240);
}

/* ---- §280C break-even at the 21% corporate rate ---- */
{
  const r = evaluateIncomePath({ qre: 500000, priorAvg3Qre: 300000, regularTax: 500000, marginalRate: 0.21, elect280C: false });
  close('R100 full-credit branch at 21%: 49000 × 0.79', r.selected.netBenefit, 38710);
  close('R101 reduced-credit branch at 21%: 49000 × 0.79', r.alternative.netBenefit, 38710);
  close('R102 electionAdvantage = 0 exactly at the 21% crossover', r.electionAdvantage, 0);
}

/* ---- qreSweep: the 6% line vs the established 14% line ---- */
{
  const s = qreSweep(400000, 0, 700000, 5);
  is('R110 sweep length', s.length, 5);
  close('R111 sweep[0].qre', s[0].qre, 0);
  close('R112 sweep[2].qre = 350000 (7/4 × base)', s[2].qre, 350000);
  close('R113 sweep[2].noPriorQre = 6% × 350k', s[2].noPriorQre, 21000);
  close('R114 sweep[2].established = 14% × 150k — lines cross here', s[2].established, 21000);
  close('R115 sweep[4].noPriorQre = 6% × 700k', s[4].noPriorQre, 42000);
  close('R116 sweep[4].established = 14% × 500k', s[4].established, 70000);
  close('R117 sweep[1].established still 0 (below the 200k base)', s[1].established, 0);
}

/* ---- marginalRateSweep: §280C crossover pinned at 21% ---- */
{
  const s = marginalRateSweep({ qre: 500000, priorAvg3Qre: 300000, regularTax: 500000 }, 0, 40, 81);
  is('R120 sweep length', s.length, 81);
  close('R121 sweep[0].ratePct', s[0].ratePct, 0);
  close('R122 @0%: full credit nets the whole 49000', s[0].netFullCredit, 49000);
  close('R123 @0%: reduced branch 38710', s[0].netReducedCredit, 38710);
  close('R124 sweep[42].ratePct = 21 exactly', s[42].ratePct, 21);
  close('R125 @21%: both branches 38710 (crossover)', s[42].netFullCredit - s[42].netReducedCredit, 0, 1e-9);
  close('R126 @40%: full branch 49000 × 0.6', s[80].netFullCredit, 29400);
  close('R127 @40%: reduced branch still 38710', s[80].netReducedCredit, 38710);
}

/* ---- evaluatePayrollPath (§41(h)) ---- */
{
  // Startup: 6% × 200k = 12000 credit, $400k FICA wages, 24% marginal.
  const p = evaluatePayrollPath({ qre: 200000, priorAvg3Qre: 0, ficaWages: 400000, marginalRate: 0.24 });
  is('R130 method', p.method, 'asc-startup');
  close('R131 electable = min(12000, 500000)', p.electable, 12000);
  close('R132 omitted election → elect the maximum', p.elected, 12000);
  close('R133 employerOasdiTax = 6.2% × 400k (§3111(a))', p.employerOasdiTax, 24800);
  close('R134 employerHiTax = 1.45% × 400k (§3111(b))', p.employerHiTax, 5800);
  close('R135 offsetCapacity = 7.65% × 400k', p.offsetCapacity, 30600);
  close('R136 appliedThisYear — fully absorbed by FICA', p.appliedThisYear, 12000);
  close('R137 remainingElected = 0', p.remainingElected, 0);
  close('R138 netValue = 12000 × (1 − 0.24)', p.netValue, 9120);
}
{
  // Credit 120000 vs capacity 30600: the offset is capacity-bound.
  const p = evaluatePayrollPath({ qre: 2000000, priorAvg3Qre: 0, ficaWages: 400000, marginalRate: 0.24 });
  close('R140 electable = 120000', p.electable, 120000);
  close('R141 appliedThisYear capped at capacity', p.appliedThisYear, 30600);
  close('R142 remainingElected carries to later employment-tax returns', p.remainingElected, 89400);
  close('R143 netValue = 30600 × 0.76', p.netValue, 23256);
}
{
  // $10M QRE → 600000 credit, above the $500,000 §41(h)(2)(B) cap.
  const p = evaluatePayrollPath({ qre: 10000000, priorAvg3Qre: 0, ficaWages: 8000000, marginalRate: 0.35 });
  close('R150 grossCredit = 6% × 10M', p.grossCredit, 600000);
  close('R151 electable = the $500,000 cap', p.electable, 500000);
  close('R152 omitted election → the capped max', p.elected, 500000);
  close('R153 offsetCapacity = 7.65% × 8M', p.offsetCapacity, 612000);
  close('R154 appliedThisYear = full election (capacity slack)', p.appliedThisYear, 500000);
  close('R155 netValue = 500000 × (1 − 0.35)', p.netValue, 325000);
}
{
  const e = evaluatePayrollPath({ qre: 10000000, priorAvg3Qre: 0, ficaWages: 8000000, marginalRate: 0.35, elected: 100000 });
  close('R160 explicit election honored', e.elected, 100000);
  close('R161 appliedThisYear = the explicit amount', e.appliedThisYear, 100000);
  close('R162 netValue = 100000 × 0.65', e.netValue, 65000);
  const c = evaluatePayrollPath({ qre: 10000000, priorAvg3Qre: 0, ficaWages: 8000000, marginalRate: 0.35, elected: 600000 });
  close('R163 election clamped to the $500k cap', c.elected, 500000);
}
{
  const z = evaluatePayrollPath({ qre: 200000, priorAvg3Qre: 0, ficaWages: 0, marginalRate: 0.24 });
  close('R164 zero wages → capacity 0', z.offsetCapacity, 0);
  close('R165 zero wages → nothing applied this year', z.appliedThisYear, 0);
  close('R166 full election carries', z.remainingElected, 12000);
  close('R167 netValue = 0', z.netValue, 0);
}

if (failures.length > 0) {
  console.error(`rdcredit.test.mjs: ${failures.length}/${total} assertions FAILED:`);
  for (const f of failures) console.error('  ' + f);
  throw new Error(`rdcredit.test.mjs failed: ${failures.length} of ${total} assertions mismatched`);
}
console.log(`rdcredit.test.mjs: ${total}/${total} assertions passed`);

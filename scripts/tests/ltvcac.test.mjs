// ltvcac.test.mjs — regression matrix for lib/ltvcac.ts (SaaS unit-economics
// engine of the "Sustain" stage: gross-margin LTV, blended CAC, churn-adjusted
// payback, and the churn inversions).
//
// RUN PREREQUISITE (the unified runner compiles; this file never compiles):
//   npx tsc lib/ltvcac.ts \
//     --outDir scripts/tests/.build --module commonjs --target es2020 \
//     --skipLibCheck
//   then: node scripts/tests/ltvcac.test.mjs
// The compiled engine is resolved from the first existing candidate —
// <testsDir>/.build/lib/ltvcac.js (rootDir-projected layout) or
// <testsDir>/.build/ltvcac.js (flat layout, when several lib files share
// lib/ as their common root) — matching the sibling tests in this directory
// (breakeven/captable). Override the build dir with the CALC_TEST_BUILD env
// var (absolute, or relative to this file's directory). lib/ltvcac.ts has
// no '@/lib/*' imports, so the alias-redirect loader variant used by the
// paytype/scorp family is not needed here; this loader is the same one the
// alias-free siblings use.
//
// Assertion policy: every expected value below was (1) hand-derived from the
// geometric-series formulas in the lib's JSDoc (LTV = ARPU·margin ÷ churn;
// discounted LTV = ARPU·margin ÷ (churn + d) with d = (1+r)^(1/12) − 1;
// churn-adjusted payback n solving A(1 − (1−c)^n)/c = CAC, i.e.
// n = ln(1 − CAC·c/A)/ln(1−c); churn-at-ratio c* = A/(target·CAC)) and
// (2) confirmed against the compiled engine (tsc → node, temp build dir,
// since removed) before being written in. Bisection outputs (churnAtPayback)
// are pinned BOTH by hand anchors and by their defining fixed-point property.
// Any mismatch throws with input / expected / actual and a non-zero exit
// code.
//
// Provenance: MANAGERIAL FINANCE CANON, not statute — no IRS/SSA constant
// enters this model. The two "healthy" thresholds (ratio > 3, payback < 12
// months) are industry rules of thumb and are asserted only as the exported
// literal constants the UI quotes (lib/ltvcac.ts:54-56).

import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const TESTS_DIR = path.dirname(fileURLToPath(import.meta.url));
const BUILD_DIR = process.env.CALC_TEST_BUILD
  ? path.resolve(TESTS_DIR, process.env.CALC_TEST_BUILD)
  : path.join(TESTS_DIR, '.build');

async function loadLib(name) {
  const candidates = [
    path.join(BUILD_DIR, 'lib', `${name}.js`), // rootDir-projected layout
    path.join(BUILD_DIR, `${name}.js`), // flat layout (common root = lib/)
  ];
  const file = candidates.find((f) => existsSync(f)) ?? candidates[0];
  if (!existsSync(file)) {
    throw new Error(`Compiled lib not found at ${file} — run the tsc step in this file's header first.`);
  }
  try {
    const mod = await import(pathToFileURL(file).href);
    const names = Object.keys(mod).filter((k) => k !== 'default');
    if (names.length > 0) return mod; // ESM output, or CJS with statically-named exports
    if (mod.default && typeof mod.default === 'object') return mod.default;
    return mod;
  } catch {
    return createRequire(import.meta.url)(file); // plain CJS fallback
  }
}

const {
  RATIO_HEALTHY,
  PAYBACK_HEALTHY_MONTHS,
  monthlyGrossProfitPerCustomer,
  monthlyDiscountRate,
  annualizedChurn,
  computeLtvCac,
  discountedLtv,
  churnAtRatio,
  churnAtPayback,
  churnSensitivity,
  churnScan,
  scanBand,
  LTV_CAC_PRESETS,
} = await loadLib('ltvcac');

let passed = 0;
const show = (v) => (typeof v === 'number' ? String(v) : JSON.stringify(v));

function assertEq(input, actual, expected) {
  if (actual !== expected) {
    throw new Error(
      `assertion failed\n  input:    ${input}\n  expected: ${show(expected)}\n  actual:   ${show(actual)}`,
    );
  }
  passed += 1;
}

function assertClose(input, actual, expected, tol) {
  if (typeof actual !== 'number' || !Number.isFinite(actual) || Math.abs(actual - expected) > tol) {
    throw new Error(
      `assertion failed (tolerance ${tol})\n  input:    ${input}\n  expected: ${show(expected)}\n  actual:   ${show(actual)}`,
    );
  }
  passed += 1;
}

const REF = { arpu: 100, grossMarginPct: 80, churnPct: 4, smSpend: 24000, newCustomers: 120 };
const SMB = { arpu: 79, grossMarginPct: 82, churnPct: 3.2, smSpend: 18000, newCustomers: 90 };
const MM = { arpu: 240, grossMarginPct: 80, churnPct: 1.2, smSpend: 120000, newCustomers: 24 };
const LEAKY = { arpu: 59, grossMarginPct: 70, churnPct: 6, smSpend: 25000, newCustomers: 100 };

// ---------------------------------------------------------------------------
// 1. Exported rule-of-thumb constants (lib/ltvcac.ts:54-56) — the literals the
//    UI quotes; asserted so a drive-by edit cannot silently move them.
// ---------------------------------------------------------------------------
assertEq('RATIO_HEALTHY = 3', RATIO_HEALTHY, 3);
assertEq('PAYBACK_HEALTHY_MONTHS = 12', PAYBACK_HEALTHY_MONTHS, 12);

// ---------------------------------------------------------------------------
// 2. monthlyGrossProfitPerCustomer — A = ARPU × margin/100
//    (lib/ltvcac.ts:111-113). Margin clamps to [0,1] (a 120% entry reads as
//    100%); negatives/NaN clamp to 0 via nn(). Hand: 79×0.82 = 64.78;
//    59×0.70 = 41.3; 240×0.80 = 192.
// ---------------------------------------------------------------------------
assertEq('A(100, 80) = 80', monthlyGrossProfitPerCustomer(100, 80), 80);
assertClose('A(79, 82) = 64.78', monthlyGrossProfitPerCustomer(79, 82), 64.78, 1e-12);
assertClose('A(59, 70) = 41.3', monthlyGrossProfitPerCustomer(59, 70), 41.3, 1e-12);
assertEq('A(240, 80) = 192', monthlyGrossProfitPerCustomer(240, 80), 192);
assertEq('A(50, 150) = 50 (margin clamps to 1)', monthlyGrossProfitPerCustomer(50, 150), 50);
assertEq('A(50, -10) = 0', monthlyGrossProfitPerCustomer(50, -10), 0);
assertEq('A(50, 0) = 0', monthlyGrossProfitPerCustomer(50, 0), 0);
assertEq('A(0, 80) = 0', monthlyGrossProfitPerCustomer(0, 80), 0);

// ---------------------------------------------------------------------------
// 3. monthlyDiscountRate — d = (1+r)^(1/12) − 1, compound convention
//    (lib/ltvcac.ts:122-126). Hand: 12%/yr → 0.0094888/mo (the JSDoc anchor);
//    100%/yr → 2^(1/12) − 1 = 0.0594631. Zero/invalid annual rate → 0.
// ---------------------------------------------------------------------------
assertEq('d(0) = 0', monthlyDiscountRate(0), 0);
assertEq('d(-5) = 0', monthlyDiscountRate(-5), 0);
assertClose('d(12) = 1.12^(1/12) - 1', monthlyDiscountRate(12), Math.pow(1.12, 1 / 12) - 1, 0);
assertClose('d(12) hand = 0.0094888', monthlyDiscountRate(12), 0.0094888, 1e-6);
assertClose('d(100) = 2^(1/12) - 1', monthlyDiscountRate(100), Math.pow(2, 1 / 12) - 1, 0);

// ---------------------------------------------------------------------------
// 4. annualizedChurn — (1 − (1−c)^12) × 100 (lib/ltvcac.ts:135-139). Churn
//    compounds: the JSDoc anchor "3%/mo is ≈30.6%/yr, not 36%". Hand chains:
//    0.97^12 = 0.693842 → 30.6158; 0.96^12 = 0.612710 → 38.7290;
//    0.988^12 = 0.865134 → 13.4866. Above 100% clamps to 100.
// ---------------------------------------------------------------------------
assertEq('annualizedChurn(0) = 0', annualizedChurn(0), 0);
assertClose('annualizedChurn(3) = (1 - 0.97^12) x 100', annualizedChurn(3), (1 - Math.pow(0.97, 12)) * 100, 0);
assertClose('annualizedChurn(3) hand = 30.6158 (JSDoc anchor)', annualizedChurn(3), 30.6158, 1e-3);
assertClose('annualizedChurn(4) = (1 - 0.96^12) x 100', annualizedChurn(4), (1 - Math.pow(0.96, 12)) * 100, 0);
assertClose('annualizedChurn(4) hand = 38.7290', annualizedChurn(4), 38.729, 1e-3);
assertClose('annualizedChurn(1.2) hand = 13.4866', annualizedChurn(1.2), 13.4866, 1e-3);
assertEq('annualizedChurn(100) = 100', annualizedChurn(100), 100);
assertEq('annualizedChurn(150) clamps to 100', annualizedChurn(150), 100);

// ---------------------------------------------------------------------------
// 5. computeLtvCac — Reference preset (lib/ltvcac.ts:368), the clean-numbers
//    profile used throughout the guide. Hand: A = 80; lifetime 1/0.04 = 25;
//    LTV = 80/0.04 = 2000; CAC = 24000/120 = 200; ratio 10; simple payback
//    200/80 = 2.5; churn-adjusted n = ln(1 − 200·0.04/80)/ln(0.96) =
//    ln(0.9)/ln(0.96) = 2.580974; revenue-basis LTV 100/0.04 = 2500
//    overstates by exactly (1/0.8 − 1) = 25%.
// ---------------------------------------------------------------------------
{
  const r = computeLtvCac(REF);
  assertEq('ref: monthlyGrossProfit 80', r.monthlyGrossProfit, 80);
  assertEq('ref: lifetimeMonths 25', r.lifetimeMonths, 25);
  assertEq('ref: ltv 2000', r.ltv, 2000);
  assertEq('ref: cac 200', r.cac, 200);
  assertEq('ref: ratio 10', r.ratio, 10);
  assertEq('ref: paybackMonths 2.5', r.paybackMonths, 2.5);
  assertClose('ref: paybackChurnAdjusted = ln(0.9)/ln(0.96)', r.paybackChurnAdjusted, Math.log(0.9) / Math.log(0.96), 1e-12);
  assertClose(
    'ref: churnAdj fixed-point A(1-(1-c)^n)/c = CAC',
    (80 * (1 - Math.pow(0.96, r.paybackChurnAdjusted))) / 0.04,
    200,
    1e-8,
  );
  assertEq('ref: churnAdj >= simple payback', r.paybackChurnAdjusted >= r.paybackMonths, true);
  assertEq('ref: ltvRevenueBasis 2500', r.ltvRevenueBasis, 2500);
  assertEq('ref: revenueBasisOverstatementPct 25', r.revenueBasisOverstatementPct, 25);
  assertClose('ref: annualChurnPct = (1 - 0.96^12) x 100', r.annualChurnPct, (1 - Math.pow(0.96, 12)) * 100, 0);
  assertEq('ref: zeroSpend false', r.zeroSpend, false);
  assertEq('ref: zeroChurn false', r.zeroChurn, false);
}

// ---------------------------------------------------------------------------
// 6. computeLtvCac — SMB preset (lib/ltvcac.ts:375). Hand: A = 64.78;
//    lifetime 1/0.032 = 31.25; LTV = 64.78/0.032 = 2024.375; CAC 200; ratio
//    10.121875; payback 200/64.78; revenue basis 79/0.032 = 2468.75
//    overstates by (1/0.82 − 1) = 21.9512%.
// ---------------------------------------------------------------------------
{
  const r = computeLtvCac(SMB);
  assertClose('smb: monthlyGrossProfit 64.78', r.monthlyGrossProfit, 64.78, 1e-12);
  assertEq('smb: lifetimeMonths 31.25', r.lifetimeMonths, 31.25);
  assertClose('smb: ltv 2024.375', r.ltv, 2024.375, 1e-9);
  assertEq('smb: cac 200', r.cac, 200);
  assertClose('smb: ratio 10.121875', r.ratio, 10.121875, 1e-12);
  assertClose('smb: paybackMonths = 200/64.78', r.paybackMonths, 200 / 64.78, 1e-12);
  assertClose(
    'smb: churnAdj fixed-point',
    (64.78 * (1 - Math.pow(1 - 0.032, r.paybackChurnAdjusted))) / 0.032,
    200,
    1e-8,
  );
  assertClose('smb: ltvRevenueBasis 2468.75', r.ltvRevenueBasis, 2468.75, 1e-9);
  assertClose('smb: overstatement (1/0.82 - 1) x 100', r.revenueBasisOverstatementPct, (1 / 0.82 - 1) * 100, 1e-12);
}

// ---------------------------------------------------------------------------
// 7. computeLtvCac — Mid-market preset (lib/ltvcac.ts:382). Hand: A = 192;
//    LTV = 192/0.012 = 16000; CAC = 120000/24 = 5000; ratio 3.2 (clears the
//    >3 rule of thumb) but simple payback 5000/192 = 26.04 (fails the <12
//    rule) — expensive but sticky, the guide's contrast case. Churn-adjusted
//    n = ln(1 − 60/192)/ln(0.988) = ln(0.6875)/ln(0.988).
// ---------------------------------------------------------------------------
{
  const r = computeLtvCac(MM);
  assertEq('mm: monthlyGrossProfit 192', r.monthlyGrossProfit, 192);
  assertClose('mm: lifetimeMonths 250/3', r.lifetimeMonths, 250 / 3, 1e-12);
  assertEq('mm: ltv 16000', r.ltv, 16000);
  assertEq('mm: cac 5000', r.cac, 5000);
  assertClose('mm: ratio 3.2', r.ratio, 3.2, 1e-12);
  assertClose('mm: paybackMonths = 5000/192', r.paybackMonths, 5000 / 192, 1e-12);
  assertClose('mm: churnAdj = ln(0.6875)/ln(0.988)', r.paybackChurnAdjusted, Math.log(0.6875) / Math.log(0.988), 1e-12);
  assertEq('mm: ratio clears 3 while payback fails 12', r.ratio > RATIO_HEALTHY && r.paybackMonths > PAYBACK_HEALTHY_MONTHS, true);
}

// ---------------------------------------------------------------------------
// 8. computeLtvCac — Leaky-bucket preset (lib/ltvcac.ts:389). Hand: A = 41.3;
//    LTV = 41.3/0.06 = 2065/3; CAC 250; ratio 2.7533 (BELOW the 3 rule of
//    thumb — retention quietly undoes acquisition); payback 250/41.3;
//    revenue basis 59/0.06 overstates by (1/0.7 − 1) = 42.857%.
// ---------------------------------------------------------------------------
{
  const r = computeLtvCac(LEAKY);
  assertClose('leaky: monthlyGrossProfit 41.3', r.monthlyGrossProfit, 41.3, 1e-12);
  assertClose('leaky: lifetimeMonths 50/3', r.lifetimeMonths, 50 / 3, 1e-12);
  assertClose('leaky: ltv 2065/3', r.ltv, 2065 / 3, 1e-9);
  assertEq('leaky: cac 250', r.cac, 250);
  assertClose('leaky: ratio (2065/3)/250', r.ratio, (2065 / 3) / 250, 1e-12);
  assertClose('leaky: paybackMonths = 250/41.3', r.paybackMonths, 250 / 41.3, 1e-12);
  assertClose(
    'leaky: churnAdj fixed-point',
    (41.3 * (1 - Math.pow(0.94, r.paybackChurnAdjusted))) / 0.06,
    250,
    1e-8,
  );
  assertClose('leaky: ltvRevenueBasis 983.3333', r.ltvRevenueBasis, 59 / 0.06, 1e-9);
  assertClose('leaky: overstatement (1/0.7 - 1) x 100', r.revenueBasisOverstatementPct, (1 / 0.7 - 1) * 100, 1e-12);
  assertEq('leaky: ratio below the 3 rule of thumb', r.ratio < RATIO_HEALTHY, true);
}

// ---------------------------------------------------------------------------
// 9. Degenerate corners. Zero churn: lifetime/LTV/ratio are null (infinite,
//    never a silent zero — file-header contract) while the SIMPLE payback
//    stays 2.5 (churn-independent, lib/ltvcac.ts:162). Zero spend: CAC = 0,
//    ratio vacuous-null, payback 0. No new customers: CAC undefined-null.
//    Zero margin: LTV collapses to 0 (not null) but lifetime is still 25 —
//    the customer stays, they just contribute nothing.
// ---------------------------------------------------------------------------
{
  const z = computeLtvCac({ ...REF, churnPct: 0 });
  assertEq('zero-churn: lifetimeMonths null', z.lifetimeMonths, null);
  assertEq('zero-churn: ltv null', z.ltv, null);
  assertEq('zero-churn: ratio null', z.ratio, null);
  assertEq('zero-churn: flag true', z.zeroChurn, true);
  assertEq('zero-churn: annualChurnPct 0', z.annualChurnPct, 0);
  assertEq('zero-churn: paybackMonths still 2.5', z.paybackMonths, 2.5);
  assertEq('zero-churn: paybackChurnAdjusted null', z.paybackChurnAdjusted, null);
  assertEq('zero-churn: ltvRevenueBasis null', z.ltvRevenueBasis, null);
  assertEq('zero-churn: overstatement null', z.revenueBasisOverstatementPct, null);

  const s = computeLtvCac({ ...REF, smSpend: 0 });
  assertEq('zero-spend: cac 0', s.cac, 0);
  assertEq('zero-spend: ratio null (vacuous)', s.ratio, null);
  assertEq('zero-spend: paybackMonths 0', s.paybackMonths, 0);
  assertEq('zero-spend: flag true', s.zeroSpend, true);
  assertEq('zero-spend: ltv still 2000', s.ltv, 2000);

  const n = computeLtvCac({ ...REF, newCustomers: 0 });
  assertEq('no-customers: cac null', n.cac, null);
  assertEq('no-customers: ratio null', n.ratio, null);
  assertEq('no-customers: paybackMonths null', n.paybackMonths, null);
  assertEq('no-customers: paybackChurnAdjusted null', n.paybackChurnAdjusted, null);

  const m = computeLtvCac({ ...REF, grossMarginPct: 0 });
  assertEq('zero-margin: monthlyGrossProfit 0', m.monthlyGrossProfit, 0);
  assertEq('zero-margin: ltv 0 (not null)', m.ltv, 0);
  assertEq('zero-margin: lifetimeMonths still 25', m.lifetimeMonths, 25);
  assertEq('zero-margin: ratio 0', m.ratio, 0);
  assertEq('zero-margin: paybackMonths null (A <= 0)', m.paybackMonths, null);
  assertEq('zero-margin: paybackChurnAdjusted null', m.paybackChurnAdjusted, null);
  assertEq('zero-margin: ltvRevenueBasis 2500', m.ltvRevenueBasis, 2500);
  assertEq('zero-margin: overstatement null', m.revenueBasisOverstatementPct, null);
}

// ---------------------------------------------------------------------------
// 10. discountedLtv — LTV_d = A/(c + d), d = (1+r)^(1/12) − 1
//     (lib/ltvcac.ts:208-213). At r = 0 it reduces EXACTLY to the
//     undiscounted 2000; at 12%/yr, denominator 0.04 + 0.0094888 → 1616.5276
//     < 2000. At churn 0 with r > 0 it degenerates to the perpetuity A/d;
//     churn 0 AND r 0 → null (nothing discounts an infinite stream).
// ---------------------------------------------------------------------------
assertClose('dLtv(ref, 0) = undiscounted 2000', discountedLtv(REF, 0), 2000, 1e-12);
assertClose(
  'dLtv(ref, 12) = 80/(0.04 + 1.12^(1/12) - 1)',
  discountedLtv(REF, 12),
  80 / (0.04 + (Math.pow(1.12, 1 / 12) - 1)),
  1e-9,
);
assertClose('dLtv(ref, 12) hand 1616.5276', discountedLtv(REF, 12), 1616.5276, 1e-3);
assertEq('dLtv(ref, 12) < ltv (time value)', discountedLtv(REF, 12) < computeLtvCac(REF).ltv, true);
assertClose(
  'dLtv(zero-churn, 10) = perpetuity 80/d',
  discountedLtv({ ...REF, churnPct: 0 }, 10),
  80 / (Math.pow(1.1, 1 / 12) - 1),
  1e-9,
);
assertEq('dLtv(zero-churn, 0) = null', discountedLtv({ ...REF, churnPct: 0 }, 0), null);

// ---------------------------------------------------------------------------
// 11. churnAtRatio — c* = A/(target·CAC) × 100, unclamped (lib/ltvcac.ts:232-238).
//     Hand: ref@3 → 80/600 = 13.33%; ref@10 → 4% (exactly the input churn —
//     the inversion fixed point, since the base ratio IS 10); mid-market@3 →
//     192/15000 = 1.28% (base ratio 3.2 straddles the target). Cheap-CAC
//     domain warning: A = 100, CAC = 0.1, target 3 → 33333% — far above any
//     achievable churn, callers must read that as "no churn drops below".
//     Undefined: target 0, no customers, zero spend (CAC 0), zero margin.
// ---------------------------------------------------------------------------
assertClose('churnAtRatio(ref, 3) = 40/3', churnAtRatio(REF, 3), 40 / 3, 1e-12);
assertClose('churnAtRatio(ref, 10) = 4 (fixed point)', churnAtRatio(REF, 10), 4, 1e-12);
assertClose('churnAtRatio(mm, 3) = 1.28', churnAtRatio(MM, 3), 1.28, 1e-12);
assertClose(
  'churnAtRatio cheap-CAC unclamped = 100000/3 pct',
  churnAtRatio({ arpu: 100, grossMarginPct: 100, churnPct: 4, smSpend: 10, newCustomers: 100 }, 3),
  100000 / 3,
  1e-9,
);
assertEq('churnAtRatio(ref, 0) = null', churnAtRatio(REF, 0), null);
assertEq('churnAtRatio(no customers) = null', churnAtRatio({ ...REF, newCustomers: 0 }, 3), null);
assertEq('churnAtRatio(zero spend) = null', churnAtRatio({ ...REF, smSpend: 0 }, 3), null);
assertEq('churnAtRatio(zero margin) = null', churnAtRatio({ ...REF, grossMarginPct: 0 }, 3), null);

// ---------------------------------------------------------------------------
// 12. churnAtPayback — bisection on the strictly-increasing adjusted payback
//     (lib/ltvcac.ts:251-272). Ref@12: solves ln(1 − 2.5c)/ln(1−c) = 12;
//     hand-bracketed to 0.39911 → 39.911%, pinned by the fixed point
//     paybackChurnAdjusted(c*) = 12. No crossing when the simple payback
//     already >= the target (2.5 → null), or when inputs are undefined.
//     Leaky@12: hand 13.701% (simple payback 6.05 < 12, so a crossing exists).
// ---------------------------------------------------------------------------
{
  const c = churnAtPayback(REF, 12);
  assertClose('churnAtPayback(ref, 12) hand = 39.911', c, 39.911, 0.005);
  assertClose(
    'churnAtPayback(ref, 12) fixed-point: adjusted payback = 12',
    computeLtvCac({ ...REF, churnPct: c }).paybackChurnAdjusted,
    12,
    1e-6,
  );
}
assertEq('churnAtPayback(ref, 2.5) = null (simple payback = target)', churnAtPayback(REF, 2.5), null);
assertEq('churnAtPayback(ref, 2) = null (payback already worse)', churnAtPayback(REF, 2), null);
assertEq('churnAtPayback(mm, 12) = null (26.04 >= 12)', churnAtPayback(MM, 12), null);
{
  const c = churnAtPayback(LEAKY, 12);
  assertClose('churnAtPayback(leaky, 12) hand = 13.7012', c, 13.7012, 0.005);
  assertClose(
    'churnAtPayback(leaky, 12) fixed-point = 12',
    computeLtvCac({ ...LEAKY, churnPct: c }).paybackChurnAdjusted,
    12,
    1e-6,
  );
}

// ---------------------------------------------------------------------------
// 13. churnSensitivity — the hyperbola made visible (lib/ltvcac.ts:293-302).
//     Default multipliers [0.5, 0.75, 1, 1.5, 2] on ref churn 4% → 2/3/4/6/8.
//     LTV = A/c scales as exactly 1/m (halve churn, double LTV — the identity
//     the table demonstrates); the payback column does NOT: it is floored by
//     the simple payback 2.5 and converges to it (2% → ln(0.95)/ln(0.98) =
//     2.5389). Churn × multiplier clamps below 100%.
// ---------------------------------------------------------------------------
{
  const rows = churnSensitivity(REF);
  assertEq('sens: 5 default rows', rows.length, 5);
  assertClose('sens: churnPct 2', rows[0].churnPct, 2, 1e-12);
  assertClose('sens: churnPct 3', rows[1].churnPct, 3, 1e-12);
  assertClose('sens: churnPct 4 (base)', rows[2].churnPct, 4, 1e-12);
  assertClose('sens: churnPct 6', rows[3].churnPct, 6, 1e-12);
  assertClose('sens: churnPct 8', rows[4].churnPct, 8, 1e-12);
  assertClose('sens: ltv[0.5x] 4000', rows[0].ltv, 4000, 1e-9);
  assertClose('sens: ltv[0.75x] 8000/3', rows[1].ltv, 8000 / 3, 1e-9);
  assertClose('sens: ltv[1x] 2000', rows[2].ltv, 2000, 1e-9);
  assertClose('sens: ltv[1.5x] 4000/3', rows[3].ltv, 4000 / 3, 1e-9);
  assertClose('sens: ltv[2x] 1000', rows[4].ltv, 1000, 1e-9);
  assertClose('sens: ratio[0.5x] 20', rows[0].ratio, 20, 1e-9);
  assertClose('sens: ratio[2x] 5', rows[4].ratio, 5, 1e-9);
  assertClose('sens: ltv x multiplier = base ltv (1/m identity)', rows[3].ltv * 1.5, 2000, 1e-9);
  assertClose('sens: paybackAdj@2% = ln(0.95)/ln(0.98)', rows[0].paybackChurnAdjusted, Math.log(0.95) / Math.log(0.98), 1e-12);
  assertEq('sens: every payback >= simple floor 2.5', rows.every((row) => row.paybackChurnAdjusted >= 2.5 - 1e-12), true);

  const clamped = churnSensitivity({ ...LEAKY, churnPct: 60 }, [1, 2]);
  assertEq('sens: churn clamps at 99.9999', clamped[1].churnPct, 99.9999);
}

// ---------------------------------------------------------------------------
// 14. churnScan — full re-solve across a band (lib/ltvcac.ts:317-337). Ref
//     2→8 in 7 steps: churns 2..8, LTV = 80/c → 4000 … 1000, ratios /200.
//     Guards: from floored at 0.01; to floored at lo + 0.01 when inverted.
// ---------------------------------------------------------------------------
{
  const s = churnScan(REF, 2, 8, 7);
  assertEq('scan: 7 points', s.length, 7);
  assertClose('scan[0]: churnPct 2', s[0].churnPct, 2, 1e-12);
  assertClose('scan[6]: churnPct 8', s[6].churnPct, 8, 1e-12);
  assertClose('scan[0]: ltv 4000', s[0].ltv, 4000, 1e-9);
  assertClose('scan[2]: ltv 2000', s[2].ltv, 2000, 1e-9);
  assertClose('scan[3]: ltv 1600', s[3].ltv, 1600, 1e-9);
  assertClose('scan[5]: ltv 8000/7', s[5].ltv, 8000 / 7, 1e-9);
  assertClose('scan[6]: ltv 1000', s[6].ltv, 1000, 1e-9);
  assertClose('scan[3]: ratio 8', s[3].ratio, 8, 1e-9);
  assertClose('scan[5]: ratio 40/7', s[5].ratio, 40 / 7, 1e-9);

  const t = churnScan(REF, 4, 2, 5);
  assertEq('scan: inverted band still yields steps', t.length, 5);
  assertClose('scan: inverted lo 4', t[0].churnPct, 4, 1e-12);
  assertClose('scan: inverted hi floored to 4.01', t[4].churnPct, 4.01, 1e-12);

  const f = churnScan(REF, 0, 8, 3);
  assertClose('scan: from floored at 0.01', f[0].churnPct, 0.01, 1e-12);
}

// ---------------------------------------------------------------------------
// 15. scanBand — the default chart band (lib/ltvcac.ts:345-350). Hand:
//     4% → [c/4, 3c] = [1, 12]; 0.5% → from max(0.1, 0.125) = 0.125,
//     to max(1.5, 5.025) = 5.025 (minimum 4.9pp span); 0 clamps to [0.1, 5];
//     100% → [25, 300].
// ---------------------------------------------------------------------------
assertEq('band(4).from = 1', scanBand(4).from, 1);
assertEq('band(4).to = 12', scanBand(4).to, 12);
assertEq('band(0.5).from = 0.125', scanBand(0.5).from, 0.125);
assertEq('band(0.5).to = 5.025', scanBand(0.5).to, 5.025);
assertEq('band(0).from = 0.1', scanBand(0).from, 0.1);
assertEq('band(0).to = 5', scanBand(0).to, 5);
assertEq('band(100).from = 25', scanBand(100).from, 25);
assertEq('band(100).to = 300', scanBand(100).to, 300);

// ---------------------------------------------------------------------------
// 16. Preset registry — the calculator's scenario buttons (lib/ltvcac.ts:362-391).
// ---------------------------------------------------------------------------
assertEq('presets: 4 archetypes', LTV_CAC_PRESETS.length, 4);
assertEq('presets: ids', LTV_CAC_PRESETS.map((p) => p.id).join(','), 'reference,smb,midmarket,leaky');
assertEq('ref preset: arpu 100', LTV_CAC_PRESETS[0].inputs.arpu, 100);
assertEq('ref preset: grossMarginPct 80', LTV_CAC_PRESETS[0].inputs.grossMarginPct, 80);
assertEq('ref preset: churnPct 4', LTV_CAC_PRESETS[0].inputs.churnPct, 4);
assertEq('ref preset: smSpend 24000', LTV_CAC_PRESETS[0].inputs.smSpend, 24000);
assertEq('ref preset: newCustomers 120', LTV_CAC_PRESETS[0].inputs.newCustomers, 120);

console.log(`ltvcac.test: ${passed} assertions passed`);

// Stripe fee engine — permanent regression matrix for lib/stripe.ts.
//
// RUN PREREQUISITE (owned by the unified test runner, NOT by this file):
//   lib/stripe.ts must be compiled to JS before this file is executed, e.g.
//
//     npx tsc lib/stripe.ts lib/freelance.ts \
//       --outDir scripts/tests/.build \
//       --module es2022 --target es2022 --moduleResolution node \
//       --strict --skipLibCheck
//
//   (with both lib files as inputs their common root is lib/, so tsc writes a
//   flat layout: scripts/tests/.build/stripe.js + freelance.js — verified.)
//
//   The compiled module is resolved from the first existing candidate:
//     1. $CALC_TEST_BUILD/lib/stripe.js   (rootDir-projected layout)
//     2. $CALC_TEST_BUILD/stripe.js       (flat layout, command above)
//   The build dir defaults to <this file's dir>/.build and can be overridden
//   with the CALC_TEST_BUILD environment variable. (Compiling with
//   --module commonjs also loads fine and silences node's
//   MODULE_TYPELESS_PACKAGE_JSON reparse warning.)
//
// Every expected value below is double-confirmed: hand-derived from the
// published-rate formulas documented in lib/stripe.ts (derivation noted per
// assertion) and re-computed by the compiled engine (tsc → node) before being
// written in. Anchors marked [article] reproduce flagship numbers printed in
// components/content/StripeArticle.tsx; anchors marked [default] reproduce
// the calculator defaults in components/calculators/StripeCalculator.tsx.
//
// Note: reverseFromNet carries a dev-only round-trip invariant that is ACTIVE
// under plain `node` (NODE_ENV unset), so every reverse assertion below also
// exercises that internal invariant as a side effect.
//
// Style: plain node assertions — no test framework, no new dependencies.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const BUILD = process.env.CALC_TEST_BUILD || path.join(HERE, '.build');

async function loadLib(name) {
  const candidates = [
    path.join(BUILD, 'lib', `${name}.js`),
    path.join(BUILD, `${name}.js`),
  ];
  for (const file of candidates) {
    if (fs.existsSync(file)) return import(pathToFileURL(file).href);
  }
  throw new Error(
    `compiled lib/${name}.ts not found — compile first (see header comment)\n` +
      `  tried:   ${candidates.join('\n  tried:   ')}\n` +
      `  build dir: ${BUILD} (override with CALC_TEST_BUILD)`,
  );
}

const { STRIPE_RATES, ACH_CAP_THRESHOLD, computeFee, reverseFromNet, monthlyVolume } =
  await loadLib('stripe');

let passed = 0;

/** Numeric assertion: |actual − expected| ≤ tol, else throw input → expected → actual. */
function close(label, input, expected, actual, tol = 1e-9) {
  if (!(Math.abs(actual - expected) <= tol)) {
    throw new Error(
      `FAIL [${label}]\n  input    : ${input}\n  expected : ${expected}\n  actual   : ${actual}`,
    );
  }
  passed += 1;
}

/** Strict-identity assertion (numbers-as-literals, null, …). */
function same(label, input, expected, actual) {
  if (actual !== expected) {
    throw new Error(
      `FAIL [${label}]\n  input    : ${input}\n  expected : ${expected}\n  actual   : ${actual}`,
    );
  }
  passed += 1;
}

/* ------------------------------------------------------------------ */
/* Published rate constants (exported API; cited throughout the article) */
/* ------------------------------------------------------------------ */

// US published pricing per lib/stripe.ts header (verified 2026-10).
same('domestic rate literal', 'STRIPE_RATES.domestic.rate', 0.029, STRIPE_RATES.domestic.rate);
same('domestic fixed literal', 'STRIPE_RATES.domestic.fixed', 0.3, STRIPE_RATES.domestic.fixed);
same('intl rate literal', 'STRIPE_RATES.international.rate', 0.044, STRIPE_RATES.international.rate);
same('intl fixed literal', 'STRIPE_RATES.international.fixed', 0.3, STRIPE_RATES.international.fixed);
same('ach rate literal', 'STRIPE_RATES.ach.rate', 0.008, STRIPE_RATES.ach.rate);
same('ach fixed literal', 'STRIPE_RATES.ach.fixed', 0, STRIPE_RATES.ach.fixed);
same('ach cap literal', 'STRIPE_RATES.ach.cap', 5, STRIPE_RATES.ach.cap);

// Cap threshold: $5.00 ÷ 0.8% = 625 exactly (float division lands on 625).
close('ACH cap threshold', 'ACH_CAP_THRESHOLD', 625, ACH_CAP_THRESHOLD);

/* ------------------------------------------------------------------ */
/* Forward: computeFee — typical values                                */
/* ------------------------------------------------------------------ */

// [article Ex.1] $100 domestic: 100×2.9% + $0.30 = $3.20; net 96.80; eff 3.20%.
{
  const r = computeFee(100, 'domestic');
  close('fwd $100 dom fee', 'computeFee(100, domestic)', 3.2, r.fee);
  close('fwd $100 dom net', 'computeFee(100, domestic)', 96.8, r.net);
  close('fwd $100 dom eff%', 'computeFee(100, domestic)', 3.2, r.effectiveRate);
}

// [article Ex.2] $1,000 international: 1000×4.4% + $0.30 = $44.30; net 955.70; eff 4.43%.
{
  const r = computeFee(1000, 'international');
  close('fwd $1000 intl fee', 'computeFee(1000, international)', 44.3, r.fee);
  close('fwd $1000 intl net', 'computeFee(1000, international)', 955.7, r.net);
  close('fwd $1000 intl eff%', 'computeFee(1000, international)', 4.43, r.effectiveRate);
}

// [article Ex.3 comparison] $5,000 domestic: 5000×2.9% + 0.30 = $145.30.
close('fwd $5000 dom fee', 'computeFee(5000, domestic)', 145.3, computeFee(5000, 'domestic').fee);

// [article "$20,000 saves $575"] $20,000 domestic = $580.30 vs ACH $5.00 → saving $575.30.
{
  const dom20k = computeFee(20000, 'domestic');
  close('fwd $20000 dom fee', 'computeFee(20000, domestic)', 580.3, dom20k.fee);
  close('$20k dom-vs-ach saving', 'computeFee(20000,domestic).fee − computeFee(20000,ach).fee', 575.3,
    dom20k.fee - computeFee(20000, 'ach').fee);
}

/* ------------------------------------------------------------------ */
/* Forward: ACH cap phase boundary                                     */
/* ------------------------------------------------------------------ */

// At exactly $625: 625×0.8% = $5.00 = cap → fee 5, net 620, eff 0.8%.
{
  const r = computeFee(625, 'ach');
  close('fwd $625 ach fee (cap engages)', 'computeFee(625, ach)', 5, r.fee);
  close('fwd $625 ach net', 'computeFee(625, ach)', 620, r.net);
  close('fwd $625 ach eff%', 'computeFee(625, ach)', 0.8, r.effectiveRate);
}

// One cent below: 624.99×0.8% = $4.99992 (uncapped); net 619.99008.
{
  const r = computeFee(624.99, 'ach');
  close('fwd $624.99 ach fee', 'computeFee(624.99, ach)', 4.99992, r.fee);
  close('fwd $624.99 ach net', 'computeFee(624.99, ach)', 619.99008, r.net);
  close('fwd $624.99 ach eff%', 'computeFee(624.99, ach)', 0.8, r.effectiveRate);
}

// [article Ex.3] $5,000 ACH: uncapped $40 → capped at $5; net 4,995; eff 0.10%.
{
  const r = computeFee(5000, 'ach');
  close('fwd $5000 ach fee', 'computeFee(5000, ach)', 5, r.fee);
  close('fwd $5000 ach net', 'computeFee(5000, ach)', 4995, r.net);
  close('fwd $5000 ach eff%', 'computeFee(5000, ach)', 0.1, r.effectiveRate);
}

/* ------------------------------------------------------------------ */
/* Forward: micro tickets & the fixed-fee breakeven clamp              */
/* ------------------------------------------------------------------ */

// [article intro] $5 domestic: 0.145 + 0.30 = $0.445; net 4.555; eff 8.9%.
{
  const r = computeFee(5, 'domestic');
  close('fwd $5 dom fee', 'computeFee(5, domestic)', 0.445, r.fee);
  close('fwd $5 dom net', 'computeFee(5, domestic)', 4.555, r.net);
  close('fwd $5 dom eff%', 'computeFee(5, domestic)', 8.9, r.effectiveRate);
}

// [article Ex.4] $6 domestic: 0.174 + 0.30 = $0.474; eff 7.9%. $600 → $17.70, 2.95%.
close('fwd $6 dom fee', 'computeFee(6, domestic)', 0.474, computeFee(6, 'domestic').fee);
close('fwd $6 dom eff%', 'computeFee(6, domestic)', 7.9, computeFee(6, 'domestic').effectiveRate);
close('fwd $600 dom fee', 'computeFee(600, domestic)', 17.7, computeFee(600, 'domestic').fee);
close('fwd $600 dom eff%', 'computeFee(600, domestic)', 2.95, computeFee(600, 'domestic').effectiveRate);

// Zero / negative boundary: charge clamps to 0, fee/net/eff all 0.
{
  const r0 = computeFee(0, 'domestic');
  same('fwd $0 dom fee', 'computeFee(0, domestic)', 0, r0.fee);
  same('fwd $0 dom net', 'computeFee(0, domestic)', 0, r0.net);
  same('fwd $0 dom eff%', 'computeFee(0, domestic)', 0, r0.effectiveRate);
  const rn = computeFee(-50, 'domestic');
  same('fwd −$50 clamps charge', 'computeFee(−50, domestic)', 0, rn.charge);
  same('fwd −$50 clamps fee', 'computeFee(−50, domestic)', 0, rn.fee);
}

// Fee>charge breakeven at fixed÷(1−rate) = 0.30/0.971 = $0.30896…:
// $0.30 sits below → fee clamped to the charge itself; net 0; eff 100%.
{
  const r = computeFee(0.3, 'domestic');
  close('fwd $0.30 dom fee clamped to charge', 'computeFee(0.30, domestic)', 0.3, r.fee);
  same('fwd $0.30 dom net 0', 'computeFee(0.30, domestic)', 0, r.net);
  same('fwd $0.30 dom eff% 100', 'computeFee(0.30, domestic)', 100, r.effectiveRate);
}
// $0.31 sits just above breakeven → fee unclamped: 0.31×2.9% + 0.30 = $0.30899; net $0.00101.
{
  const r = computeFee(0.31, 'domestic');
  close('fwd $0.31 dom fee', 'computeFee(0.31, domestic)', 0.30899, r.fee);
  close('fwd $0.31 dom net', 'computeFee(0.31, domestic)', 0.00101, r.net);
}

/* ------------------------------------------------------------------ */
/* Reverse: reverseFromNet — gross-up formulas                         */
/* ------------------------------------------------------------------ */

// [default targetNet] net $1,000 domestic: charge = 1000.30/0.971 = $1,030.1750772400.
{
  const r = reverseFromNet(1000, 'domestic');
  close('rev net $1000 dom charge', 'reverseFromNet(1000, domestic)', 1030.1750772399587, r.charge);
  close('rev net $1000 dom fee', 'reverseFromNet(1000, domestic)', 30.1750772399588, r.fee);
  close('rev net $1000 dom round-trip', 'reverseFromNet(1000, domestic).net → 1000', 1000, r.net, 1e-6);
}

// [article Ex.5] net $3,500 domestic: charge = 3500.30/0.971 = $3,604.8403707518; fee $104.84.
{
  const r = reverseFromNet(3500, 'domestic');
  close('rev net $3500 dom charge', 'reverseFromNet(3500, domestic)', 3604.8403707518028, r.charge);
  close('rev net $3500 dom fee', 'reverseFromNet(3500, domestic)', 104.8403707518023, r.fee);
  close('rev net $3500 dom round-trip', 'reverseFromNet(3500, domestic).net → 3500', 3500, r.net, 1e-6);
}

// [article worked example] net $2,000 domestic: charge = 2000.30/0.971 = $2,060.0411946447.
{
  const r = reverseFromNet(2000, 'domestic');
  close('rev net $2000 dom charge', 'reverseFromNet(2000, domestic)', 2060.041194644696, r.charge);
  close('rev net $2000 dom fee', 'reverseFromNet(2000, domestic)', 60.0411946446962, r.fee);
  close('rev net $2000 dom round-trip', 'reverseFromNet(2000, domestic).net → 2000', 2000, r.net, 1e-6);
}

// net $1,000 international: charge = 1000.30/0.956 = $1,046.3389121339.
{
  const r = reverseFromNet(1000, 'international');
  close('rev net $1000 intl charge', 'reverseFromNet(1000, international)', 1046.3389121338912, r.charge);
  close('rev net $1000 intl fee', 'reverseFromNet(1000, international)', 46.3389121338912, r.fee);
  close('rev net $1000 intl round-trip', 'reverseFromNet(1000, international).net → 1000', 1000, r.net, 1e-6);
}

// [article Ex.5 ACH] net $3,500 ACH: capped branch (3505 ≥ 625) → charge 3505, fee 5;
// eff = 5/3505×100 = 0.14265335235378…% (1/701 as a percentage).
{
  const r = reverseFromNet(3500, 'ach');
  close('rev net $3500 ach charge', 'reverseFromNet(3500, ach)', 3505, r.charge);
  close('rev net $3500 ach fee', 'reverseFromNet(3500, ach)', 5, r.fee);
  close('rev net $3500 ach round-trip', 'reverseFromNet(3500, ach).net → 3500', 3500, r.net, 1e-6);
  close('rev net $3500 ach eff%', 'reverseFromNet(3500, ach)', 0.14265335235378032, r.effectiveRate);
}

// Phase boundary exactly at net $620 (= 625 − 5): capped branch taken → charge 625, fee 5.
{
  const r = reverseFromNet(620, 'ach');
  close('rev net $620 ach charge (boundary, capped)', 'reverseFromNet(620, ach)', 625, r.charge);
  close('rev net $620 ach fee', 'reverseFromNet(620, ach)', 5, r.fee);
  close('rev net $620 ach round-trip', 'reverseFromNet(620, ach).net → 620', 620, r.net, 1e-6);
}

// One cent below the boundary: uncapped branch → charge = 619.99/0.992 = 624.9899193548.
{
  const r = reverseFromNet(619.99, 'ach');
  close('rev net $619.99 ach charge (uncapped)', 'reverseFromNet(619.99, ach)', 624.9899193548388, r.charge);
  close('rev net $619.99 ach fee', 'reverseFromNet(619.99, ach)', 4.9999193548387, r.fee);
  close('rev net $619.99 ach round-trip', 'reverseFromNet(619.99, ach).net → 619.99', 619.99, r.net, 1e-6);
}

// net $0 domestic: charge = 0.30/0.971 = $0.3089598352 — the whole charge is the fee; net 0.
{
  const r = reverseFromNet(0, 'domestic');
  close('rev net $0 dom charge', 'reverseFromNet(0, domestic)', 0.3089598352214212, r.charge);
  close('rev net $0 dom fee equals charge', 'reverseFromNet(0, domestic)', 0.3089598352214212, r.fee);
  close('rev net $0 dom round-trip', 'reverseFromNet(0, domestic).net → 0', 0, r.net, 1e-6);
}

// Negative net clamps to 0 → same solution as net $0.
close('rev net −$5 clamps to net $0', 'reverseFromNet(−5, domestic)', 0.3089598352214212,
  reverseFromNet(-5, 'domestic').charge);

/* ------------------------------------------------------------------ */
/* Monthly volume model — blended cost across a payment mix            */
/* ------------------------------------------------------------------ */

// [default mix, article monthly example] 40×$85 dom + 5×$150 intl + 3×$1,200 ACH.
// Legs: dom 40×(85×2.9%+0.30)=40×2.765=$110.60; intl 5×6.90=$34.50;
//       ach 3×min(9.60, 5)=$15.00. Totals: $7,750 / $160.10 / $7,589.90;
// blended 160.10/7750 = 2.0658064516%; ACH floor 40×0.68+5×1.20+3×5 = $48.20;
// saving $111.90.
{
  const s = monthlyVolume([
    { type: 'domestic', count: 40, averageTicket: 85 },
    { type: 'international', count: 5, averageTicket: 150 },
    { type: 'ach', count: 3, averageTicket: 1200 },
  ]);
  same('mix default txn count', 'monthlyVolume(40×85 dom, 5×150 intl, 3×1200 ach)', 48, s.transactionCount);
  close('mix default volume', 'monthlyVolume(40×85 dom, 5×150 intl, 3×1200 ach)', 7750, s.totalVolume);
  close('mix default fee', 'monthlyVolume(40×85 dom, 5×150 intl, 3×1200 ach)', 160.1, s.totalFee);
  close('mix default net', 'monthlyVolume(40×85 dom, 5×150 intl, 3×1200 ach)', 7589.9, s.totalNet);
  close('mix default blended%', 'monthlyVolume(40×85 dom, 5×150 intl, 3×1200 ach)', 2.0658064516129038, s.blendedRate);
  close('mix default dom leg fee', 'monthlyVolume leg[domestic]', 110.6, s.legs[0].fee);
  close('mix default intl leg fee', 'monthlyVolume leg[international]', 34.5, s.legs[1].fee);
  close('mix default ach leg fee', 'monthlyVolume leg[ach]', 15, s.legs[2].fee);
  close('mix default ach floor', 'monthlyVolume(40×85 dom, 5×150 intl, 3×1200 ach)', 48.2, s.achFloorFee);
  close('mix default ach saving', 'monthlyVolume(40×85 dom, 5×150 intl, 3×1200 ach)', 111.9, s.achFloorSaving);
}

// [preset "Micro-ticket seller"] 400×$6 dom, others 0:
// fee 400×0.474 = $189.60 on $2,400 → 7.9% blended; floor 400×0.048 = $19.20; saving $170.40.
{
  const s = monthlyVolume([
    { type: 'domestic', count: 400, averageTicket: 6 },
    { type: 'international', count: 0, averageTicket: 12 },
    { type: 'ach', count: 0, averageTicket: 500 },
  ]);
  close('micro volume', 'monthlyVolume(400×6 dom)', 2400, s.totalVolume);
  close('micro fee', 'monthlyVolume(400×6 dom)', 189.6, s.totalFee);
  close('micro blended%', 'monthlyVolume(400×6 dom)', 7.9, s.blendedRate);
  close('micro ach floor', 'monthlyVolume(400×6 dom)', 19.2, s.achFloorFee);
  close('micro ach saving', 'monthlyVolume(400×6 dom)', 170.4, s.achFloorSaving);
}

// [preset "Global card mix"] 120×$95 dom + 8×$1,200 intl + 4×$900 ach:
// fees 366.60 + 424.80 + 20 = $811.40 on $24,600 → 3.2983739837% blended;
// floor 120×0.76 + 8×5 + 4×5 = $151.20; saving $660.20.
{
  const s = monthlyVolume([
    { type: 'domestic', count: 120, averageTicket: 95 },
    { type: 'international', count: 8, averageTicket: 1200 },
    { type: 'ach', count: 4, averageTicket: 900 },
  ]);
  close('global volume', 'monthlyVolume(120×95, 8×1200, 4×900)', 24600, s.totalVolume);
  close('global fee', 'monthlyVolume(120×95, 8×1200, 4×900)', 811.4, s.totalFee);
  close('global blended%', 'monthlyVolume(120×95, 8×1200, 4×900)', 3.298373983739837, s.blendedRate);
  close('global ach floor', 'monthlyVolume(120×95, 8×1200, 4×900)', 151.2, s.achFloorFee);
  close('global ach saving', 'monthlyVolume(120×95, 8×1200, 4×900)', 660.2, s.achFloorSaving);
}

// [preset "ACH-heavy B2B"] 10×$350 dom + 12×$3,500 ach:
// fees 104.50 + 60 = $164.50 on $45,500 → 0.3615384615% blended;
// floor 10×2.80 + 12×5 = $88; saving $76.50.
{
  const s = monthlyVolume([
    { type: 'domestic', count: 10, averageTicket: 350 },
    { type: 'international', count: 0, averageTicket: 150 },
    { type: 'ach', count: 12, averageTicket: 3500 },
  ]);
  close('b2b volume', 'monthlyVolume(10×350 dom, 12×3500 ach)', 45500, s.totalVolume);
  close('b2b fee', 'monthlyVolume(10×350 dom, 12×3500 ach)', 164.5, s.totalFee);
  close('b2b blended%', 'monthlyVolume(10×350 dom, 12×3500 ach)', 0.36153846153846153, s.blendedRate);
  close('b2b ach floor', 'monthlyVolume(10×350 dom, 12×3500 ach)', 88, s.achFloorFee);
  close('b2b ach saving', 'monthlyVolume(10×350 dom, 12×3500 ach)', 76.5, s.achFloorSaving);
}

// All-ACH mix: no card legs → achFloorFee is null (already at the floor), saving 0.
{
  const s = monthlyVolume([{ type: 'ach', count: 10, averageTicket: 1000 }]);
  close('ach-only volume', 'monthlyVolume(10×1000 ach)', 10000, s.totalVolume);
  close('ach-only fee', 'monthlyVolume(10×1000 ach)', 50, s.totalFee);
  close('ach-only blended%', 'monthlyVolume(10×1000 ach)', 0.5, s.blendedRate);
  same('ach-only floor is null', 'monthlyVolume(10×1000 ach)', null, s.achFloorFee);
  same('ach-only saving 0', 'monthlyVolume(10×1000 ach)', 0, s.achFloorSaving);
}

// Empty mix and negative inputs: everything clamps to zero, floor null.
{
  const e = monthlyVolume([]);
  same('empty mix volume', 'monthlyVolume([])', 0, e.totalVolume);
  same('empty mix fee', 'monthlyVolume([])', 0, e.totalFee);
  same('empty mix blended%', 'monthlyVolume([])', 0, e.blendedRate);
  same('empty mix floor null', 'monthlyVolume([])', null, e.achFloorFee);
  const n = monthlyVolume([{ type: 'domestic', count: -5, averageTicket: -100 }]);
  same('negative inputs volume', 'monthlyVolume(dom −5 × −100)', 0, n.totalVolume);
  same('negative inputs fee', 'monthlyVolume(dom −5 × −100)', 0, n.totalFee);
  same('negative inputs floor null', 'monthlyVolume(dom −5 × −100)', null, n.achFloorFee);
}

console.log(`PASS stripe.test.mjs — ${passed} assertions`);

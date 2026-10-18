// safe.test.mjs — permanent regression matrix for lib/safe.ts
// (YC post-money SAFE stack conversion at the priced round).
//
// Pure node assertions, no test framework, no dependencies. Every expected
// value below was (a) hand-derived from the closed-form mechanics in the
// lib/safe.ts JSDoc — the Y Combinator "Post-Money Safe" form (2018 revision,
// a contractual template, not statute):
//
//     m_i  = effectiveCap = min(cap, rate × preMoney)   rate = share PAID
//     CC   = existingShares ÷ (1 − Σ_i Amount_i ÷ m_i)  (the circular solve)
//     P    = preMoney ÷ CC                              investor price/share
//     shares_i = Amount_i × CC ÷ m_i                     SAFE shares
//     total    = CC × (pre + inv) ÷ pre
//
// and (b) confirmed against the compiled engine (tsc → temp build dir →
// node, dump compared value-by-value) before being written in.
//
// RUN PREREQUISITE — provided by the unified test runner, NOT by this file:
//   1. Compile the pure libs to CommonJS into scripts/tests/.build/ — e.g.
//        npx tsc lib/safe.ts lib/rdcredit.ts \
//          --outDir scripts/tests/.build --module commonjs --target es2020 \
//          --esModuleInterop --skipLibCheck
//      The compiled module is resolved from the first existing candidate,
//      overridable with $CALC_TEST_BUILD:
//        1. $CALC_TEST_BUILD/lib/safe.js       (rootDir-projected layout)
//        2. $CALC_TEST_BUILD/safe.js           (flat layout, command above)
//   2. Run:  node scripts/tests/safe.test.mjs
// The compiled emit keeps any '@/lib/*' import specifier verbatim from the
// TypeScript source (tsc never rewrites path aliases); the preamble below
// installs a Module._resolveFilename hook that maps '@/lib/<x>' to the
// compiled sibling, so no post-emit rewriting is needed. (safe.js itself has
// no aliased imports; the hook is kept uniform across the directory.)

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
  MAX_SAFES,
  SAFE_PRESETS,
  DEFAULT_SAFE_INPUTS,
  effectiveCap,
  bindingOf,
  crossoverPreMoney,
  classifySafeStack,
  convertSafeStack,
  safeCurve,
} = require(buildModule('safe'));

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

/* ---- Structure: presets & default UI state ---- */
is('S1 MAX_SAFES', MAX_SAFES, 3);
is('S2 preset ids', SAFE_PRESETS.map((p) => p.id).join('|'), 'yc-standard|discount-only|stacked|heavy');
is('S3 every preset pads safes to MAX_SAFES', SAFE_PRESETS.map((p) => p.safes.length).join(','), '3,3,3,3');
is('S4 DEFAULT roundInv', DEFAULT_SAFE_INPUTS.roundInv, 3000000);
is('S5 DEFAULT roundPre', DEFAULT_SAFE_INPUTS.roundPre, 15000000);
is('S6 DEFAULT shares', DEFAULT_SAFE_INPUTS.shares, 10000000);
is('S7 DEFAULT s1Amt', DEFAULT_SAFE_INPUTS.s1Amt, 500000);
is('S8 DEFAULT s1Cap', DEFAULT_SAFE_INPUTS.s1Cap, 10000000);
is('S9 DEFAULT s1Disc (percent OFF)', DEFAULT_SAFE_INPUTS.s1Disc, 20);
is('S10 DEFAULT s2Amt — padded inactive row', DEFAULT_SAFE_INPUTS.s2Amt, 0);
is('S11 DEFAULT s3Amt — padded inactive row', DEFAULT_SAFE_INPUTS.s3Amt, 0);

/* ---- effectiveCap m_i = min(cap, rate × preMoney) ---- */
close('S20 both terms, cap binds: min(10M, 0.8×15M)', effectiveCap({ amount: 500000, cap: 10000000, discountPct: 20 }, 15000000), 10000000);
close('S21 both terms, discount binds: min(16M, 0.85×15M)', effectiveCap({ amount: 1000000, cap: 16000000, discountPct: 15 }, 15000000), 12750000);
close('S22 cap only: m = cap regardless of pre', effectiveCap({ amount: 1000000, cap: 6000000, discountPct: 0 }, 30000000), 6000000);
close('S23 discount only: m = 0.8 × 15M', effectiveCap({ amount: 750000, cap: 0, discountPct: 20 }, 15000000), 12000000);
close('S24 neither term: m = preMoney (converts at round price)', effectiveCap({ amount: 500000, cap: 0, discountPct: 0 }, 15000000), 15000000);
close('S25 discount clamped to 90% off: rate 0.10 × 10M', effectiveCap({ amount: 1, cap: 0, discountPct: 95 }, 10000000), 1000000);
close('S26 negative discount clamps to 0% off: rate 1 → no discount', effectiveCap({ amount: 1, cap: 0, discountPct: -5 }, 10000000), 10000000);
close('S27 cap above pre-money, no discount: m = 20M cap', effectiveCap({ amount: 500000, cap: 20000000, discountPct: 0 }, 15000000), 20000000);

/* ---- bindingOf (which term produced m_i) ---- */
is('S30 cap binds at 15M pre', bindingOf({ amount: 500000, cap: 10000000, discountPct: 20 }, 15000000), 'cap');
is('S31 discount binds at 15M pre', bindingOf({ amount: 1000000, cap: 16000000, discountPct: 15 }, 15000000), 'discount');
is('S32 round-price when neither term exists', bindingOf({ amount: 500000, cap: 0, discountPct: 0 }, 15000000), 'round-price');
is('S33 amount ≤ 0 → inactive', bindingOf({ amount: 0, cap: 5000000, discountPct: 10 }, 15000000), 'inactive');
is('S34 tie at crossover (cap = rate×pre) counts as cap', bindingOf({ amount: 500000, cap: 10000000, discountPct: 20 }, 12500000), 'cap');
is('S35 just below crossover → discount', bindingOf({ amount: 500000, cap: 10000000, discountPct: 20 }, 12499999), 'discount');

/* ---- crossoverPreMoney = cap ÷ rate ---- */
close('S40 $10M cap, 20% off flips at 10M ÷ 0.80 = $12.5M', crossoverPreMoney({ amount: 500000, cap: 10000000, discountPct: 20 }), 12500000);
is('S41 cap-only SAFE has no crossover', crossoverPreMoney({ amount: 1, cap: 8000000, discountPct: 0 }), null);
is('S42 discount-only SAFE has no crossover', crossoverPreMoney({ amount: 1, cap: 0, discountPct: 20 }), null);
is('S43 term-less SAFE has no crossover', crossoverPreMoney({ amount: 1, cap: 0, discountPct: 0 }), null);

/* ---- classifySafeStack (empty / invalid / modeled) ---- */
is('S50 no funded SAFE → empty', classifySafeStack([{ amount: 0, cap: 0, discountPct: 0 }], { investment: 3000000, preMoney: 15000000 }, 10000000).state, 'empty');
is('S51 zero existing shares → invalid', classifySafeStack([{ amount: 500000, cap: 10000000, discountPct: 20 }], { investment: 3000000, preMoney: 15000000 }, 0).state, 'invalid');
is('S52 zero-shares reason', classifySafeStack([{ amount: 500000, cap: 10000000, discountPct: 20 }], { investment: 3000000, preMoney: 15000000 }, 0).reason, 'Existing fully diluted shares must be above zero.');
is('S53 zero investment → invalid', classifySafeStack([{ amount: 500000, cap: 10000000, discountPct: 20 }], { investment: 0, preMoney: 15000000 }, 10000000).state, 'invalid');
is('S54 zero pre-money → invalid', classifySafeStack([{ amount: 500000, cap: 10000000, discountPct: 20 }], { investment: 3000000, preMoney: 0 }, 10000000).state, 'invalid');
// $10M on a $10M cap: Σ amount/m = 1.0 exactly — the stack alone claims 100%.
is('S55 stack fraction = 100% → invalid (boundary)', classifySafeStack([{ amount: 10000000, cap: 10000000, discountPct: 0 }], { investment: 3000000, preMoney: 15000000 }, 10000000).state, 'invalid');
is('S56 100%-stack carries a reason', classifySafeStack([{ amount: 10000000, cap: 10000000, discountPct: 0 }], { investment: 3000000, preMoney: 15000000 }, 10000000).reason.length > 0, true);
is('S57 standard case → modeled', classifySafeStack([{ amount: 500000, cap: 10000000, discountPct: 20 }], { investment: 3000000, preMoney: 15000000 }, 10000000).state, 'modeled');

/* ---- Preset 1 "Standard YC seed": $500k @ $10M cap / 20% off, $3M A at $15M pre ---- */
// Hand: rate 0.80 → m = min(10M, 12M) = 10M; Σ = 0.05; CC = 10M/0.95;
// P = 1.425; safePrice = 0.95; ratio = 0.95/1.425 = 2/3.
{
  const p = SAFE_PRESETS[0];
  const c = convertSafeStack(p.safes, p.round, p.shares);
  is('S60 yc-standard.valid', c.valid, true);
  close('S61 CC = 10M ÷ (1 − 0.05)', c.companyCapitalization, 10526315.7894736842);
  close('S62 roundPrice = 15M ÷ CC', c.roundPrice, 1.425);
  close('S63 investorShares = 3M ÷ 1.425', c.investorShares, 2105263.1578947368);
  close('S64 totalSharesAfter = CC × 18/15', c.totalSharesAfter, 12631578.947368421);
  close('S65 investorPctAfter = 3/18 identity', c.investorPctAfter, 100 / 6);
  close('S66 foundersPctAfter = 19/24', c.foundersPctAfter, 79.16666666666667);
  close('S67 foundersPctNoSafes = 15/18', c.foundersPctNoSafes, 250 / 3);
  close('S68 foundersExtraDilutionPts = stack pts here', c.foundersExtraDilutionPts, 4.166666666666667);
  is('S69 safes[0].binding — cap protects more at 15M', c.safes[0].binding, 'cap');
  close('S70 safes[0].effectiveCap = the cap exactly', c.safes[0].effectiveCap, 10000000);
  close('S71 safes[0].safePrice = 10M ÷ CC', c.safes[0].safePrice, 0.95);
  close('S72 safes[0].priceRatio = 0.95/1.425 = 2/3', c.safes[0].priceRatio, 2 / 3);
  close('S73 safes[0].effectiveDiscountPct = 100/3', c.safes[0].effectiveDiscountPct, 100 / 3);
  close('S74 safes[0].shares = 500k ÷ 0.95', c.safes[0].shares, 526315.7894736842);
  close('S75 safes[0].pctOfPreRound — YC property: amount/cap = 5%', c.safes[0].pctOfPreRound, 5);
  close('S76 safes[0].pctAfterRound = 1/24', c.safes[0].pctAfterRound, 100 / 24);
  close('S77 stackPctAfter = 1/24 of the post-round table', c.stackPctAfter, 100 / 24);
  close('S78 stackPctOfPreRound = 5% of CC', c.stackPctOfPreRound, 5);
  is('S79 padded rows stay inactive', c.safes[1].binding, 'inactive');
  is('S80 padded rows carry zero shares', c.safes[2].shares, 0);
}

/* ---- Preset 2 "Discount only": $750k, no cap, 20% off ---- */
// Hand: m = 0.8 × 15M = 12M; Σ = 0.0625; CC = 10M/0.9375; safePrice = 1.125.
{
  const p = SAFE_PRESETS[1];
  const c = convertSafeStack(p.safes, p.round, p.shares);
  is('S90 discount-only.binding', c.safes[0].binding, 'discount');
  close('S91 CC = 10M ÷ 0.9375', c.companyCapitalization, 10666666.6666666667);
  close('S92 safePrice = 0.8 × 1.40625', c.safes[0].safePrice, 1.125);
  close('S93 priceRatio = the 0.80 rate exactly', c.safes[0].priceRatio, 0.8);
  close('S94 effectiveDiscountPct = the input 20%', c.safes[0].effectiveDiscountPct, 20);
  close('S95 shares = 750k ÷ 1.125', c.safes[0].shares, 666666.6666666667);
  close('S96 pctOfPreRound = 750k ÷ 12M', c.safes[0].pctOfPreRound, 6.25);
  close('S97 foundersPctAfter = 10M ÷ 12.8M', c.foundersPctAfter, 78.125);
  close('S98 stackPctAfter = 125/24', c.stackPctAfter, 125 / 24);
}

/* ---- Preset 3 "Two-SAFE stack": $500k @ $8M/15% + $1M @ $16M/15%, 15M pre ---- */
// Hand: m1 = 8M (cap), m2 = 12.75M (discount); Σ = 1/16 + 4/51 = 7.1875/51;
// CC = 10M × 51/43.8125 = 8.16e9/701; P = 701/544.
{
  const p = SAFE_PRESETS[2];
  const c = convertSafeStack(p.safes, p.round, p.shares);
  is('S100 SAFE1 binding — $8M cap under 0.85×15M', c.safes[0].binding, 'cap');
  close('S101 SAFE1 effectiveCap = 8M', c.safes[0].effectiveCap, 8000000);
  is('S102 SAFE2 binding — 0.85×15M under $16M cap', c.safes[1].binding, 'discount');
  close('S103 SAFE2 effectiveCap = 12.75M', c.safes[1].effectiveCap, 12750000);
  close('S104 CC = 10M ÷ (1 − 7.1875/51)', c.companyCapitalization, 11640513.552068474);
  close('S105 roundPrice = 701/544', c.roundPrice, 1.2886029411764706);
  close('S106 SAFE1 safePrice = 8M ÷ CC', c.safes[0].safePrice, 0.6872549019607843);
  close('S107 SAFE2 safePrice = 0.85 × roundPrice', c.safes[1].safePrice, 1.0953125);
  close('S108 SAFE1 priceRatio = 8/15', c.safes[0].priceRatio, 8 / 15);
  close('S109 SAFE1 effectiveDiscountPct = 140/3', c.safes[0].effectiveDiscountPct, 140 / 3);
  close('S110 SAFE2 priceRatio = 0.85 (discount binding)', c.safes[1].priceRatio, 0.85);
  close('S111 SAFE2 effectiveDiscountPct = 15', c.safes[1].effectiveDiscountPct, 15);
  close('S112 SAFE1 shares = 500k × CC ÷ 8M', c.safes[0].shares, 727532.0970042796);
  close('S113 SAFE2 shares = 1M ÷ 1.0953125', c.safes[1].shares, 912981.455064194);
  close('S114 foundersPctAfter = 701000/9792', c.foundersPctAfter, 71.5890522875817);
  close('S115 foundersExtraDilutionPts = 57500/4896', c.foundersExtraDilutionPts, 11.744281045751634);
  close('S116 stackPctAfter — extra dilution lands on the stack', c.stackPctAfter, 11.744281045751634);
  close('S117 identity: extraDilution − stackPct = 0', c.foundersExtraDilutionPts - c.stackPctAfter, 0, 1e-9);
  close('S118 stackPctOfPreRound = Σ amount/m = 14.0931…%', c.stackPctOfPreRound, 14.093137254901961);
}

/* ---- Preset 4 "Cap-heavy": $4.5M across 6M/10M/14M caps, $8M A at $30M pre ---- */
// Hand: all caps bind; Σ = 1/6 + 1/5 + 3/28 = 199/420; CC = 10M×420/221.
{
  const p = SAFE_PRESETS[3];
  const c = convertSafeStack(p.safes, p.round, p.shares);
  close('S120 CC = 10M × 420/221', c.companyCapitalization, 19004524.886877828);
  close('S121 roundPrice = 221/140', c.roundPrice, 1.5785714285714286);
  close('S122 investorShares = 8M ÷ P', c.investorShares, 5067873.3031674208);
  close('S123 totalSharesAfter = CC × 38/30', c.totalSharesAfter, 24072398.190045249);
  close('S124 investorPctAfter = 8/38 identity', c.investorPctAfter, 400 / 19);
  close('S125 foundersPctAfter = 221/532', c.foundersPctAfter, 41.5413533834586);
  close('S126 foundersPctNoSafes = 30/38', c.foundersPctNoSafes, 1500 / 19);
  close('S127 stackPctOfPreRound = 199/420', c.stackPctOfPreRound, 19900 / 420);
  close('S128 stackPctAfter = 199/532', c.stackPctAfter, 19900 / 532);
  close('S129 SAFE1 shares = 1M × 700/221', c.safes[0].shares, 3167420.814479638);
  close('S130 SAFE2 pctOfPreRound = 2M ÷ 10M', c.safes[1].pctOfPreRound, 20);
  close('S131 SAFE3 pctOfPreRound = 1.5M ÷ 14M', c.safes[2].pctOfPreRound, 10.714285714285714);
}

/* ---- Degenerate SAFEs: round-price and cap-above-pre-money ---- */
{
  const c = convertSafeStack([{ amount: 500000, cap: 0, discountPct: 0 }], { investment: 3000000, preMoney: 15000000 }, 10000000);
  is('S140 uncapped/no-discount binding', c.safes[0].binding, 'round-price');
  close('S141 CC = 10M ÷ (1 − 1/30)', c.companyCapitalization, 10344827.586206897);
  close('S142 safePrice = roundPrice = 1.45', c.safes[0].safePrice, 1.45);
  close('S143 priceRatio = 1', c.safes[0].priceRatio, 1);
  close('S144 effectiveDiscountPct = 0', c.safes[0].effectiveDiscountPct, 0);
  close('S145 shares = 500k ÷ 1.45', c.safes[0].shares, 344827.5862068966);
  close('S146 stackPctOfPreRound = 1/30', c.stackPctOfPreRound, 10 / 3);
}
{
  // $20M cap over a $15M pre with no discount: converts ABOVE the round price.
  const c = convertSafeStack([{ amount: 500000, cap: 20000000, discountPct: 0 }], { investment: 3000000, preMoney: 15000000 }, 10000000);
  is('S150 cap-above-pre binding', c.safes[0].binding, 'cap');
  close('S151 safePrice = 20M ÷ CC', c.safes[0].safePrice, 1.95);
  close('S152 priceRatio = 4/3 — above the round price', c.safes[0].priceRatio, 4 / 3);
  close('S153 effectiveDiscountPct = −100/3 (negative)', c.safes[0].effectiveDiscountPct, -100 / 3);
  close('S154 pctOfPreRound = 500k ÷ 20M', c.safes[0].pctOfPreRound, 2.5);
  close('S155 stackPctAfter = 0.025/1.2', c.stackPctAfter, 2.083333333333333);
}

/* ---- Inactive row between active rows is skipped, not modeled ---- */
{
  const c = convertSafeStack(
    [
      { amount: 500000, cap: 10000000, discountPct: 20 },
      { amount: 0, cap: 5000000, discountPct: 10 },
    ],
    { investment: 3000000, preMoney: 15000000 },
    10000000,
  );
  is('S160 middle inactive row binding', c.safes[1].binding, 'inactive');
  is('S161 middle inactive row shares', c.safes[1].shares, 0);
  close('S162 CC unaffected by the inactive row (= preset 1)', c.companyCapitalization, 10526315.7894736842);
}

/* ---- Invalid conversion still reports the round identities ---- */
{
  const c = convertSafeStack([{ amount: 500000, cap: 10000000, discountPct: 20 }], { investment: 3000000, preMoney: 15000000 }, 0);
  is('S170 valid flag on zero shares', c.valid, false);
  is('S171 reason echoes the classifier', c.reason, 'Existing fully diluted shares must be above zero.');
  close('S172 companyCapitalization zeroed', c.companyCapitalization, 0);
  close('S173 investorPctAfter still 3/18 (counterfactual)', c.investorPctAfter, 100 / 6);
  close('S174 foundersPctNoSafes still 15/18', c.foundersPctNoSafes, 250 / 3);
}

/* ---- safeCurve: the valuation valley of the standard YC SAFE ---- */
// Stack % after the round at pre = 10M / 12.5M / 15M / 20M:
//   Σ/m = 0.0625 / 0.05 / 0.05 / 0.05; stack% = (Σ/m) ÷ (1 + inv/pre).
{
  const pts = safeCurve(SAFE_PRESETS[0].safes, 3000000, 10000000, [10000000, 12500000, 15000000, 20000000]);
  is('S180 curve length', pts.length, 4);
  close('S181 stack% @10M pre (discount binds) = 0.0625/1.3', pts[0].stackPctAfter, 4.807692307692308);
  is('S182 bindingMode @10M', pts[0].bindingMode, 'discount');
  close('S183 stack% @12.5M (crossover) = 0.05/1.24', pts[1].stackPctAfter, 4.032258064516129);
  is('S184 bindingMode @12.5M — tie reads as cap', pts[1].bindingMode, 'cap');
  close('S185 stack% @15M = 0.05/1.2', pts[2].stackPctAfter, 4.166666666666667);
  close('S186 stack% @20M = 0.05/1.15', pts[3].stackPctAfter, 4.3478260869565216);
  close('S187 founders% @12.5M = 0.95/1.24', pts[1].foundersPctAfter, 76.61290322580645);
  is('S188 valley: minimum at the crossover, below @10M', pts[1].stackPctAfter < pts[0].stackPctAfter, true);
  is('S189 valley: below @15M', pts[1].stackPctAfter < pts[2].stackPctAfter, true);
  is('S190 valley: below @20M', pts[1].stackPctAfter < pts[3].stackPctAfter, true);
}

/* ---- safeCurve: mixed stack flips to all-cap at rich valuations ---- */
{
  const pts = safeCurve(SAFE_PRESETS[2].safes, 3000000, 10000000, [10000000, 15000000, 100000000]);
  is('S200 mixed @10M (SAFE1 cap, SAFE2 discount)', pts[0].bindingMode, 'mixed');
  close('S201 stack% @10M = (1/16 + 2/17)/1.3', pts[0].stackPctAfter, 13.857466063348417);
  is('S202 mixed @15M', pts[1].bindingMode, 'mixed');
  close('S203 stack% @15M matches the direct conversion', pts[1].stackPctAfter, 11.744281045751634);
  is('S204 all-cap @100M', pts[2].bindingMode, 'cap');
  close('S205 stack% @100M = 0.125/1.03', pts[2].stackPctAfter, 12.135922330097087);
}

/* ---- safeCurve: infeasible points carry NaN, never clamped ---- */
// $8M uncapped with 20% off: Σ/m = 8M/(0.8×pre) = 10M/pre → 1.0 at $10M pre.
{
  const pts = safeCurve([{ amount: 8000000, cap: 0, discountPct: 20 }], 3000000, 10000000, [10000000, 12500000, 20000000]);
  is('S210 stack% NaN where the stack claims 100%', Number.isNaN(pts[0].stackPctAfter), true);
  is('S211 founders% NaN at the same point', Number.isNaN(pts[0].foundersPctAfter), true);
  is('S212 bindingMode still reported at the infeasible x', pts[0].bindingMode, 'discount');
  close('S213 stack% @12.5M = 0.8/1.24', pts[1].stackPctAfter, 64.51612903225806);
  close('S214 founders% @12.5M = 0.2/1.24', pts[1].foundersPctAfter, 16.129032258064516);
  close('S215 stack% @20M = 0.5/1.15', pts[2].stackPctAfter, 43.478260869565216);
  close('S216 founders% @20M equals stack% (10M shares each side)', pts[2].foundersPctAfter - pts[2].stackPctAfter, 0, 1e-9);
}

if (failures.length > 0) {
  console.error(`safe.test.mjs: ${failures.length}/${total} assertions FAILED:`);
  for (const f of failures) console.error('  ' + f);
  throw new Error(`safe.test.mjs failed: ${failures.length} of ${total} assertions mismatched`);
}
console.log(`safe.test.mjs: ${total}/${total} assertions passed`);

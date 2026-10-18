// Permanent regression matrix for lib/llccorp.ts (LLC vs C-Corp with a
// dividend-payout dial, tax year 2025) — pure-Node assertions, no test
// framework, no dependencies beyond node itself.
//
// RUN PREREQUISITE (owned by the unified test runner, NOT by this file): the
// engine libs must already be compiled to CommonJS under scripts/tests/.build/
// preserving the lib/ layout, i.e. these files exist:
//   scripts/tests/.build/lib/llccorp.js  (self-contained — no @/ imports)
// A minimal tsconfig that produces exactly that (verified against this repo):
//   {
//     "compilerOptions": {
//       "target": "ES2020", "module": "CommonJS", "strict": true,
//       "skipLibCheck": true, "noEmit": false, "incremental": false,
//       "baseUrl": "../..", "paths": { "@/*": ["./*"] },
//       "outDir": "scripts/tests/.build", "rootDir": "../.."
//     },
//     "files": ["lib/llccorp.ts"]
//   }
// The compiled output keeps its layout under .build/lib/. Then:
//   node scripts/tests/llccorp.test.mjs
//
// Every expected value was derived by hand from the 2025 parameters in the
// lib header (Rev. Proc. 2024-40 brackets, $15,750 OBBBA standard deduction —
// the deliberate divergence from shared lib/tax.ts's $14,600 — LTCG
// breakpoints, $176,100 SE cap, flat 21% corporate rate) and then confirmed
// against the compiled engine (tsc → node) before being written in.
// Crossover payouts are pinned to the hand-solved linear-bracket crossing
// ± the engine's 1e-6 bisection window. Any mismatch throws with
// input → expected → actual.

import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const Module = require('node:module');

// Resolve '@/lib/x' specifiers for any compiled dependency (none today, but
// the patch keeps this file's import mechanics identical to its siblings).
const BUILD = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '.build');
const origResolveFilename = Module._resolveFilename;
Module._resolveFilename = function (request, ...rest) {
  if (request.startsWith('@/')) return path.join(BUILD, request.slice(2) + '.js');
  return origResolveFilename.call(this, request, ...rest);
};

const {
  TAX_CONSTANTS,
  computeLlc,
  computeCCorp,
  compareEntities,
  findCrossoverProfit,
  findCrossoverPayout,
  payoutThresholdShape,
  excludedAdditionalMedicare,
  excludedNiit,
  ccorpWinCount,
} = require('./.build/lib/llccorp.js');

let pass = 0;
function eq(name, input, expected, actual, tol = 1e-6) {
  const ok =
    typeof expected === 'number' && typeof actual === 'number'
      ? Math.abs(actual - expected) <= tol
      : actual === expected;
  if (!ok) {
    throw new Error(
      `[llccorp.test] ${name}\n  input →    ${input}\n  expected → ${expected}` +
        (tol !== 1e-6 ? ` (±${tol})` : '') +
        `\n  actual →   ${actual}`,
    );
  }
  pass++;
  console.log(`PASS  ${name}  [${actual}]`);
}

/* ============ 1. Parameter set (the tool's corrected 2025 constants) ============ */
eq('std deduction $15,750 (OBBBA, not tax.ts\'s $14,600)', 'constant', 15750, TAX_CONSTANTS.stdDeduction);
eq('SE cap', 'constant', 176100, TAX_CONSTANTS.seCap);
eq('corporate rate', 'constant', 0.21, TAX_CONSTANTS.corporateRate);
eq('QBI rate', 'constant', 0.2, TAX_CONSTANTS.qbiRate);
eq('SE rate', 'constant', 0.153, TAX_CONSTANTS.seRate);
eq('LTCG 15% breakpoint', 'constant', 48350, TAX_CONSTANTS.ltcg15Breakpoint);
eq('LTCG 20% breakpoint', 'constant', 533400, TAX_CONSTANTS.ltcg20Breakpoint);

/* ============ 2. LLC pass-through stack ============ */
{
  const r = computeLlc(0);
  eq('llc(0): totalTax', 'profit $0', 0, r.totalTax);
  eq('llc(0): effectiveRate', 'profit $0', 0, r.effectiveRate);
}
// $400-of-SE-base floor: 433 × 92.35% = $399.8755 → no SE tax at all.
eq('llc(433): seTax below the $400 floor', 'profit $433', 0, computeLlc(433).seTax);
// One dollar over: 434 × 92.35% = $400.799 → 15.3% × 400.799; taxable income
// stays $0 (below the $15,750 deduction), so SE tax is the whole outlay.
eq('llc(434): seTax = 15.3% × 400.799', 'profit $434', 61.322247, computeLlc(434).seTax);
eq('llc(434): totalTax = seTax alone', 'profit $434', 61.322247, computeLlc(434).totalTax);
{
  const r = computeLlc(100000);
  const inp = 'profit $100k';
  eq('llc(100k): seTax 15.3% × 92,350', inp, 14129.55, r.seTax);
  eq('llc(100k): qbiDeduction (20%-of-taxable cap binds)', inp, 15437.045, r.qbiDeduction);
  eq('llc(100k): taxableIncome', inp, 61748.18, r.taxableIncome);
  eq('llc(100k): incomeTax', inp, 8498.5996, r.incomeTax, 1e-5);
  eq('llc(100k): totalTax', inp, 22628.1496, r.totalTax, 1e-5);
  eq('llc(100k): afterTax', inp, 77371.8504, r.afterTax, 1e-5);
}
{
  // Regression anchor: the instrument's default state (TaxCalculator DEFAULTS
  // profit $200k — LLC side of the head-to-head).
  const r = computeLlc(200000);
  const inp = 'profit $200k (default)';
  eq('llc(200k): seTax 26,943.30 + 249.40', inp, 27192.7, r.seTax);
  eq('llc(200k): qbiDeduction (cap binds: 0.2 × 170,653.65)', inp, 34130.73, r.qbiDeduction);
  eq('llc(200k): taxableIncome', inp, 136522.92, r.taxableIncome);
  eq('llc(200k): incomeTax', inp, 25612.5008, r.incomeTax, 1e-5);
  eq('llc(200k): totalTax', inp, 52805.2008, r.totalTax, 1e-5);
  eq('llc(200k): afterTax', inp, 147194.7992, r.afterTax, 1e-5);
  eq('llc(200k): effectiveRate %', inp, 26.4026, r.effectiveRate);
}
eq('llc(600k): totalTax (feeds the $600k crossover below)', 'profit $600k', 165735.808, computeLlc(600000).totalTax, 1e-4);
eq('llc(1M): totalTax', 'profit $1M', 289780.7008, computeLlc(1000000).totalTax, 1e-4);

/* ============ 3. C-Corp double-taxation stack ============ */
{
  // Regression anchor: default profit at 100% payout.
  const r = computeCCorp(200000, 1);
  const inp = 'profit $200k, payout 100% (default)';
  eq('ccorp(200k,100%): corporateTax', inp, 42000, r.corporateTax);
  eq('ccorp(200k,100%): dividends = 79% × 200k', inp, 158000, r.dividends);
  eq('ccorp(200k,100%): retained', inp, 0, r.retained);
  eq('ccorp(200k,100%): dividendTax 15% × (158k − 48,350)', inp, 16447.5, r.dividendTax);
  eq('ccorp(200k,100%): totalTax', inp, 58447.5, r.totalTax);
  eq('ccorp(200k,100%): afterTax', inp, 141552.5, r.afterTax);
  eq('ccorp(200k,100%): effectiveRate %', inp, 29.22375, r.effectiveRate);
}
{
  const r = computeCCorp(200000, 0.5);
  const inp = 'profit $200k, payout 50%';
  eq('ccorp(200k,50%): dividends', inp, 79000, r.dividends);
  eq('ccorp(200k,50%): retained', inp, 79000, r.retained);
  eq('ccorp(200k,50%): dividendTax 15% × (79k − 48,350)', inp, 4597.5, r.dividendTax);
  eq('ccorp(200k,50%): totalTax', inp, 46597.5, r.totalTax);
}
{
  const r = computeCCorp(1000000, 0);
  const inp = 'profit $1M, payout 0% (pure deferral)';
  eq('ccorp(1M,0%): totalTax = 21% layer only', inp, 210000, r.totalTax);
  eq('ccorp(1M,0%): retained', inp, 790000, r.retained);
  eq('ccorp(1M,0%): effectiveRate %', inp, 21, r.effectiveRate);
}
{
  // 20% LTCG bracket: 15% × 485,050 + 20% × (790,000 − 533,400).
  const r = computeCCorp(1000000, 1);
  const inp = 'profit $1M, payout 100%';
  eq('ccorp(1M,100%): dividendTax 72,757.50 + 51,320', inp, 124077.5, r.dividendTax);
  eq('ccorp(1M,100%): totalTax', inp, 334077.5, r.totalTax);
}
// Payout clamped into [0, 1].
eq('ccorp payout clamp high: 5 behaves as 1', 'profit $100k, payout 5', 79000, computeCCorp(100000, 5).dividends);
eq('ccorp payout clamp low: −1 behaves as 0', 'profit $100k, payout −1', 79000, computeCCorp(100000, -1).retained);
{
  const r = computeCCorp(0, 1);
  eq('ccorp(0,100%): totalTax', 'profit $0', 0, r.totalTax);
}

/* ============ 4. Head-to-head ============ */
{
  const r = compareEntities(200000, 1);
  eq('compare default: winner', 'profit $200k, payout 100%', 'llc', r.winner);
  eq('compare default: delta', 'profit $200k, payout 100%', 5642.2992, r.delta, 1e-4);
}
{
  const r = compareEntities(0, 1);
  eq('compare(0): tie', 'profit $0', 'tie', r.winner);
  eq('compare(0): delta', 'profit $0', 0, r.delta);
}
{
  // Retention flips the verdict: 21% beats the LLC's ~29% at $1M.
  const r = compareEntities(1000000, 0);
  eq('compare(1M, 0%): winner', 'profit $1M, payout 0%', 'ccorp', r.winner);
  eq('compare(1M, 0%): delta', 'profit $1M, payout 0%', 79780.7008, r.delta, 1e-4);
}

/* ============ 5. Payout crossovers (bisection) ============ */
// Hand-solved at $200k: 42,000 + 0.15 × (158,000x − 48,350) = 52,805.2008
// → x = 18,057.7008 / 23,700 = 0.7619283.
eq('findCrossoverPayout(200000)', '34,747.50 + 23,700x = 52,805.2008', 0.7619283, findCrossoverPayout(200000), 2e-6);
{
  // Hand-solved at $600k: 118,747.50 + 71,100x = 165,735.808 → x = 0.660876;
  // verified by construction — both stacks tie at the returned payout.
  const x = findCrossoverPayout(600000);
  eq('findCrossoverPayout(600000)', '118,747.50 + 71,100x = 165,735.808', 0.660876, x, 2e-6);
  eq('crossover(600k) is a true tie', `payout ${x}`, computeLlc(600000).totalTax, computeCCorp(600000, x).totalTax, 0.05);
}
// Hand-solved at $1M (20% LTCG zone): 176,077.50 + 158,000x = 289,780.7008
// → x = 113,703.2008 / 158,000 = 0.7196405.
eq('findCrossoverPayout(1000000)', '176,077.50 + 158,000x = 289,780.7008', 0.7196405, findCrossoverPayout(1000000), 2e-6);
// At $50k the C-Corp's 21% floor ($10,500) already exceeds the LLC's $9,775.17
// at EVERY payout — no crossing exists.
eq('findCrossoverPayout(50000) = null', 'llc total 9,775.17 < ccorp-at-zero-payout 10,500', null, findCrossoverPayout(50000));

/* ============ 6. Whole-range scan (article's headline claim) ============ */
eq('findCrossoverProfit(1) = null', 'LLC cheaper at 100% payout through $5M', null, findCrossoverProfit(1));
eq('ccorpWinCount(1) = 0', '0 → $5M in $25k rungs, C-Corp never once ahead', 0, ccorpWinCount(1));

/* ============ 7. Disclosed exclusions (quantified, not modeled) ============ */
eq('excludedAdditionalMedicare(200k) = 0', 'SE base 184,700 < $200k', 0, excludedAdditionalMedicare(200000));
eq('excludedAdditionalMedicare(500k)', '0.9% × (461,750 − 200,000) ≈ $2,356 (doc anchor)', 2355.75, excludedAdditionalMedicare(500000));
eq('excludedAdditionalMedicare(1M)', '0.9% × (923,500 − 200,000) ≈ $6,512 (doc anchor)', 6511.5, excludedAdditionalMedicare(1000000));
eq('excludedNiit(1M, 1)', '3.8% × 790,000 of dividends', 30020, excludedNiit(1000000, 1));

/* ============ 8. Shape of the tie threshold (chart + article backbone) ============ */
{
  // Deterministic scan — pins the "peaks just below the SE-cap kink, troughs
  // just after it, 64–72% above $500k" narrative to computed numbers.
  const s = payoutThresholdShape();
  eq('shape: seCapKinkProfit = 176,100 ÷ 0.9235', 'kink where SE marginal rate drops', 190687.601516, s.seCapKinkProfit, 1e-4);
  eq('shape: peak.profit', 'max tie threshold, 83k–20M scan', 190650, s.peak.profit);
  eq('shape: peak.payout', 'max tie threshold, 83k–20M scan', 0.7965527, s.peak.payout);
  eq('shape: trough.profit', 'min tie threshold, 83k–20M scan', 277050, s.trough.profit);
  eq('shape: trough.payout', 'min tie threshold, 83k–20M scan', 0.5646954, s.trough.payout);
  eq('shape: localPeak.profit', 'high-profit shoulder local max', 935500, s.localPeak.profit);
  eq('shape: localPeak.payout', 'high-profit shoulder local max', 0.7217722, s.localPeak.payout);
  eq('shape: above500kMin', 'min tie threshold for profits ≥ $500k', 0.636035, s.above500kMin);
  eq('shape: at20M', 'far end of the scanned range', 0.6902657, s.at20M);
  // Structural ordering: peak sits just below the SE-cap kink, trough after it.
  eq('shape: peak below the SE-cap kink', 'peak.profit < kink', true, s.peak.profit < s.seCapKinkProfit);
  eq('shape: kink below the trough', 'kink < trough.profit', true, s.seCapKinkProfit < s.trough.profit);
  eq('shape: above500kMin inside the 64–72% band', '0.64 ≤ x ≤ 0.72 (rounded claim)', true, s.above500kMin >= 0.635 && s.above500kMin <= 0.72);
}

console.log(`\nllccorp.test.mjs: ${pass} assertions passed.`);

// LLC vs C-Corp tax model — tool-owned engine for the llc-vs-ccorp-tax-calculator.
//
// lib/tax.ts is the suite's shared baseline and stays read-only for this tool;
// this module is the instrument's own model with (a) a corrected tax-year-2025
// constant set and (b) the dividend-payout dimension the shared engine does not
// model. All functions are pure; the widget, the article tables, and the
// build-time charts all call the same ones, so no surface can drift.
//
// ── Tax-year 2025 parameter provenance (single filer) ──
//   • Ordinary brackets 10/12/22/24/32/35/37% with cumulative caps
//     $11,925 / $48,475 / $103,350 / $197,300 / $250,525 / $626,350 —
//     Rev. Proc. 2024-40 §3.01.
//   • Standard deduction $15,750 single — Rev. Proc. 2024-40 §3.03 originally
//     set $15,000 for 2025; the One Big Beautiful Bill Act (P.L. 119-21,
//     enacted July 4, 2025) raised it for tax year 2025, formalized in
//     Rev. Proc. 2025-32. This is the deliberate divergence from lib/tax.ts,
//     which still carries the 2024 amount ($14,600).
//   • LTCG breakpoints: 0% up to $48,350, 15% up to $533,400, 20% above —
//     Rev. Proc. 2024-40 §3.16.
//   • Social Security wage base $176,100 — SSA 2025 COLA fact sheet.
//   • Corporate rate 21% — IRC §11. QBI deduction 20% — IRC §199A (2025
//     thresholds $197,300 single / $394,600 MFJ; the phase-out itself is NOT
//     modeled — disclosed in the UI).
//   • SE tax 15.3% on 92.35% of net earnings (Schedule SE), 2.9% Medicare
//     above the wage base, half of SE tax deductible — IRC §1401 / §164(f).
//     NOT modeled (disclosed on the page, in the widget assumptions, and in
//     the article): the 0.9% Additional Medicare Tax (IRC §1401(b)(2), Form
//     8959) that applies once the SE Medicare base — 92.35% × profit —
//     crosses $200,000 single, i.e. profit above ≈$216,568. The model
//     understates the LLC stack by 0.009 × (0.9235 × profit − 200,000):
//     ≈$2,356 at $500k, ≈$6,512 at $1M. This matches the shared lib/tax.ts
//     baseline (an intentional simplification, not an implementation bug).
//
// ── Formulas ──
// LLC (pass-through — same structure as lib/tax.ts, corrected constants):
//   seBase    = 0.9235 × profit                          (Schedule SE)
//   seTax     = 0 if seBase < $400
//               else 0.153 × min(seBase, $176,100) + 0.029 × max(0, seBase − $176,100)
//               (the 0.9% Additional Medicare Tax on the portion of seBase above
//               $200,000 is deliberately excluded — see the header disclosure)
//   qbiDed    = min(0.2 × (profit − seTax/2),
//                   0.2 × max(0, profit − seTax/2 − $15,750))   (§199A 20%-of-taxable cap)
//   incomeTax = brackets(profit − seTax/2 − qbiDed − $15,750)
//   totalTax  = seTax + incomeTax
// C-Corp (double taxation with an adjustable payout share):
//   corpTax   = 0.21 × profit
//   dividends = payout × (1 − 0.21) × profit             payout ∈ [0, 1]
//   retained  = (1 − payout) × (1 − 0.21) × profit       (no current shareholder tax — deferral)
//   divTax    = ltcgBrackets(dividends)                  (std deduction does NOT apply)
//   totalTax  = corpTax + divTax

/** Marginal-bracket walker — mirrors lib/tax.ts's taxFromBrackets verbatim. */
function taxFromBrackets(taxableIncome: number, brackets: { rate: number; upTo: number }[]): number {
  let tax = 0;
  let prevCap = 0;
  for (const b of brackets) {
    if (taxableIncome <= prevCap) break;
    const slice = Math.min(taxableIncome, b.upTo) - prevCap;
    if (slice > 0) tax += slice * b.rate;
    prevCap = b.upTo;
  }
  return tax;
}

const STD_DEDUCTION_2025 = 15750; // single filer — OBBBA-raised 2025 amount
const SE_CAP_2025 = 176100; // 2025 Social Security wage base
const CORPORATE_RATE = 0.21; // IRC §11, flat
const QBI_RATE = 0.2; // IRC §199A
const SE_RATE = 0.153; // 12.4% SS + 2.9% Medicare
const MEDICARE_RATE = 0.029; // employee-side Medicare above the SS cap
const SE_BASE_FACTOR = 0.9235; // Schedule SE base factor
const SE_MIN_BASE = 400; // no SE tax below $400 of net earnings

const FED_BRACKETS_2025_SINGLE = [
  { rate: 0.1, upTo: 11925 },
  { rate: 0.12, upTo: 48475 },
  { rate: 0.22, upTo: 103350 },
  { rate: 0.24, upTo: 197300 },
  { rate: 0.32, upTo: 250525 },
  { rate: 0.35, upTo: 626350 },
  { rate: 0.37, upTo: Infinity },
];

const LTCG_BRACKETS_2025_SINGLE = [
  { rate: 0, upTo: 48350 },
  { rate: 0.15, upTo: 533400 },
  { rate: 0.2, upTo: Infinity },
];

export type LlcResult = {
  seTax: number;
  incomeTax: number;
  qbiDeduction: number;
  taxableIncome: number;
  totalTax: number;
  afterTax: number;
  effectiveRate: number;
};

export type CCorpResult = {
  corporateTax: number;
  dividends: number;
  retained: number;
  dividendTax: number;
  totalTax: number;
  afterTax: number;
  effectiveRate: number;
};

/**
 * LLC / sole proprietorship pass-through stack (2025 single filer).
 * Identical to lib/tax.ts's computeLlc except the corrected $15,750 standard
 * deduction — see the module header for the full formula and provenance.
 */
export function computeLlc(profit: number): LlcResult {
  const netSE = profit;
  const seBase = netSE * SE_BASE_FACTOR;
  const seTax =
    seBase < SE_MIN_BASE
      ? 0
      : Math.min(seBase, SE_CAP_2025) * SE_RATE + Math.max(0, seBase - SE_CAP_2025) * MEDICARE_RATE;
  const halfSeTax = seTax / 2;

  // QBI = net business income minus half of SE tax; the deduction is also
  // capped at 20% of taxable income before the deduction itself (§199A).
  const qbi = Math.max(0, netSE - halfSeTax);
  const taxableBeforeQbi = Math.max(0, netSE - halfSeTax - STD_DEDUCTION_2025);
  const qbiDeduction = Math.min(qbi * QBI_RATE, taxableBeforeQbi * QBI_RATE);

  const taxableIncome = Math.max(0, netSE - halfSeTax - qbiDeduction - STD_DEDUCTION_2025);
  const incomeTax = taxFromBrackets(taxableIncome, FED_BRACKETS_2025_SINGLE);

  const totalTax = seTax + incomeTax;
  const afterTax = profit - totalTax;
  const effectiveRate = profit > 0 ? (totalTax / profit) * 100 : 0;

  return { seTax, incomeTax, qbiDeduction, taxableIncome, totalTax, afterTax, effectiveRate };
}

/**
 * C-Corp double-taxation stack with an adjustable dividend payout share.
 *
 * `payout` is the share (0–1) of after-tax (79%) profit distributed as
 * qualified dividends in the current year. The retained remainder carries no
 * shareholder-level tax now — it is taxed at LTCG rates whenever it is
 * eventually distributed, which is exactly the deferral lever the article's
 * crossover analysis works.
 */
export function computeCCorp(profit: number, payout = 1): CCorpResult {
  const p = Math.min(1, Math.max(0, payout));
  const corporateTax = profit * CORPORATE_RATE;
  const afterCorporate = profit - corporateTax;
  const dividends = afterCorporate * p;
  const retained = afterCorporate * (1 - p);

  const dividendTax = taxFromBrackets(dividends, LTCG_BRACKETS_2025_SINGLE);

  const totalTax = corporateTax + dividendTax;
  const afterTax = profit - totalTax; // = retained + (dividends − dividendTax)
  const effectiveRate = profit > 0 ? (totalTax / profit) * 100 : 0;

  return { corporateTax, dividends, retained, dividendTax, totalTax, afterTax, effectiveRate };
}

export type EntityComparison = {
  profit: number;
  payout: number;
  llc: LlcResult;
  ccorp: CCorpResult;
  winner: 'llc' | 'ccorp' | 'tie';
  delta: number; // absolute tax advantage of the winner (>= 0)
};

/** Head-to-head at a profit level and C-Corp payout share (0–1, default 100%). */
export function compareEntities(profit: number, payout = 1): EntityComparison {
  const p = Math.max(0, profit);
  const llc = computeLlc(p);
  const ccorp = computeCCorp(p, payout);
  const delta = Math.abs(llc.totalTax - ccorp.totalTax);
  let winner: EntityComparison['winner'] = 'tie';
  if (llc.totalTax < ccorp.totalTax - 0.5) winner = 'llc';
  else if (ccorp.totalTax < llc.totalTax - 0.5) winner = 'ccorp';
  return { profit: p, payout, llc, ccorp, winner, delta };
}

/** Bisection on a continuous sign-changing f over [lo, hi]; integer-dollar root. */
function bisectRoot(f: (x: number) => number, lo: number, hi: number): number {
  while (hi - lo > 0.5) {
    const mid = (lo + hi) / 2;
    if ((f(lo) <= 0) !== (f(mid) <= 0)) hi = mid;
    else lo = mid;
  }
  return Math.round((lo + hi) / 2);
}

/**
 * Smallest profit (whole dollars) at which the C-Corp undercuts the LLC at the
 * given payout share, or null when the LLC stays cheaper through `maxProfit`.
 *
 * Both totals are continuous piecewise-linear in profit, so once a grid scan
 * detects the sign flip, bisection pins the crossing to the dollar.
 */
export function findCrossoverProfit(payout = 1, maxProfit = 5_000_000, step = 5_000): number | null {
  const p = Math.min(1, Math.max(0, payout));
  const diff = (x: number) => computeLlc(x).totalTax - computeCCorp(x, p).totalTax; // > 0 → C-Corp cheaper
  if (diff(step) > 0) return bisectRoot(diff, 0, step);
  for (let x = 2 * step; x <= maxProfit; x += step) {
    if (diff(x) > 0) return bisectRoot(diff, x - step, x);
  }
  return null;
}

/**
 * Dividend-payout share (0–1) at which the two structures tie for a given
 * profit: below it the C-Corp is cheaper (retention), above it the LLC is.
 * Null when one side wins at every payout (the usual case at 100% payout
 * comparisons and at low profits).
 */
export function findCrossoverPayout(profit: number): number | null {
  const llcTotal = computeLlc(profit).totalTax;
  const f = (x: number) => computeCCorp(profit, x).totalTax - llcTotal; // < 0 → C-Corp cheaper
  if (f(0) >= 0 || f(1) <= 0) return null;
  let lo = 0;
  let hi = 1;
  while (hi - lo > 1e-6) {
    const mid = (lo + hi) / 2;
    if (f(mid) <= 0) lo = mid;
    else hi = mid;
  }
  return lo;
}

export type ThresholdPoint = { profit: number; payout: number };

export type ThresholdShape = {
  /** Global maximum of the tie threshold over the scanned range. */
  peak: ThresholdPoint;
  /** Global minimum of the tie threshold over the scanned range. */
  trough: ThresholdPoint;
  /** Local maximum on the high-profit shoulder (after the trough), found by
   *  scan — not sampled at a round profit level. */
  localPeak: ThresholdPoint;
  /** Minimum tie threshold for profits ≥ $500k (@25k scan) — the range the
   *  body copy's "64–72%" claim refers to. */
  above500kMin: number;
  /** Far end of the scanned range, showing the slow decline. */
  at20M: number | null;
  /** 176,100 ÷ 0.9235 ≈ $190,688 — profit at which the SE base hits the SS
   *  cap. The SE marginal rate drops from 15.3% to 2.9% here, which is why the
   *  threshold peaks just below this kink and falls sharply after it. */
  seCapKinkProfit: number;
};

/**
 * Shape of the payout-tie threshold (findCrossoverPayout) across the modeled
 * profit range — so the chart footnote and the article's boundary claims are
 * computed, not hand-typed. Coarse scan (83k–400k @$1k, 400k–5M @$25k,
 * 5M–20M @$100k) plus $50 refinement around each extreme and around the
 * high-profit shoulder's local maximum.
 */
export function payoutThresholdShape(): ThresholdShape {
  let peak: ThresholdPoint = { profit: 0, payout: 0 };
  let trough: ThresholdPoint = { profit: 0, payout: 1 };
  let localPeak: ThresholdPoint = { profit: 0, payout: 0 };
  let above500kMin = 1;
  const scanAll = (from: number, to: number, step: number) => {
    for (let p = from; p <= to; p += step) {
      const x = findCrossoverPayout(p);
      if (x === null) continue;
      if (x > peak.payout) peak = { profit: p, payout: x };
      if (x < trough.payout) trough = { profit: p, payout: x };
    }
  };
  scanAll(83_000, 400_000, 1_000);
  scanAll(425_000, 5_000_000, 25_000);
  scanAll(5_100_000, 20_000_000, 100_000);
  scanAll(Math.max(83_000, peak.profit - 2_000), peak.profit + 2_000, 50);
  scanAll(Math.max(83_000, trough.profit - 2_000), trough.profit + 2_000, 50);
  // High-profit shoulder local max (after the trough), then refine.
  for (let p = trough.profit + 1_000; p <= 5_000_000; p += 1_000) {
    const x = findCrossoverPayout(p);
    if (x !== null && x > localPeak.payout) localPeak = { profit: p, payout: x };
  }
  for (let p = Math.max(trough.profit + 1_000, localPeak.profit - 2_000); p <= localPeak.profit + 2_000; p += 50) {
    const x = findCrossoverPayout(p);
    if (x !== null && x > localPeak.payout) localPeak = { profit: p, payout: x };
  }
  for (let p = 500_000; p <= 5_000_000; p += 25_000) {
    const x = findCrossoverPayout(p);
    if (x !== null && x < above500kMin) above500kMin = x;
  }
  return {
    peak,
    trough,
    localPeak,
    above500kMin,
    at20M: findCrossoverPayout(20_000_000),
    seCapKinkProfit: SE_CAP_2025 / SE_BASE_FACTOR,
  };
}

/**
 * 0.9% Additional Medicare Tax on SE income (IRC §1401(b)(2), Form 8959) —
 * NOT included in computeLlc; exported so the page and article can quantify
 * the exclusion symmetrically with the NIIT figure below. Applies once the SE
 * Medicare base (92.35% × profit) exceeds $200,000 single.
 */
export function excludedAdditionalMedicare(profit: number): number {
  return 0.009 * Math.max(0, profit * SE_BASE_FACTOR - 200_000);
}

/**
 * 3.8% Net Investment Income Tax on the C-Corp's qualified dividends
 * (IRC §1411) — NOT included in computeCCorp. Active self-employment income
 * is NIIT-exempt, so this exclusion runs in the OPPOSITE direction from the
 * 0.9% item: leaving it out flatters the C-Corp. Assumes income high enough
 * that the full dividend base is exposed (the disclosure use-case).
 */
export function excludedNiit(profit: number, payout = 1): number {
  return 0.038 * computeCCorp(profit, payout).dividends;
}

/**
 * Count of profit rungs ($0 → maxProfit inclusive, `step` apart) where the
 * C-Corp is strictly cheaper at the given payout — lets the article's
 * "we scanned … never once ahead" claim be a build-time computation.
 */
export function ccorpWinCount(payout = 1, maxProfit = 5_000_000, step = 25_000): number {
  let n = 0;
  for (let p = 0; p <= maxProfit; p += step) {
    if (compareEntities(p, payout).winner === 'ccorp') n++;
  }
  return n;
}

export const TAX_CONSTANTS = {
  stdDeduction: STD_DEDUCTION_2025,
  seCap: SE_CAP_2025,
  corporateRate: CORPORATE_RATE,
  qbiRate: QBI_RATE,
  seRate: SE_RATE,
  ltcg15Breakpoint: 48350,
  ltcg20Breakpoint: 533400,
};

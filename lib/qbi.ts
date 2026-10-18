// §199A Qualified Business Income (QBI) deduction model — tax year 2025.
//
// This library reproduces, line for line, the computation the IRS prescribes on
// Form 8995 / Form 8995-A (2025) for a single qualified trade or business held
// by an individual, with these 2025 parameters:
//
//   - Threshold amount (Rev. Proc. 2024-40, §3.37–3.38, taxable years
//     beginning in 2025): $197,300 single / $394,600 married filing jointly.
//   - Phase-in range (IRC §199A(e)(2)(B)(ii) — fixed by statute, NOT indexed):
//     $50,000 single / $100,000 MFJ, so the SSTB exclusion and the full W-2
//     wage limit begin to bite above the threshold and complete at
//     $247,300 single / $494,600 MFJ.
//
// Computation chain (single business, no REIT/PTP income, no cooperative
// patron reduction, net capital gain assumed $0):
//
//   ap  = applicable percentage            = 1 − min(1, max(0, (TI − threshold) / range))
//   pip = phase-in percentage (= 1 − ap)   = min(1, max(0, (TI − threshold) / range))
//   Q_e = QBI        × ap   if SSTB and TI > threshold, else QBI   (Sch. A line 11 → line 2)
//   W_e = W-2 wages  × ap   if SSTB and TI > threshold, else W-2   (Sch. A line 12 → line 4)
//   U_e = UBIA       × ap   if SSTB and TI > threshold, else UBIA  (Sch. A line 13 → line 7)
//   T   = 20% × Q_e                        (line 3)
//   L   = max(50% × W_e, 25% × W_e + 2.5% × U_e)                    (lines 5–10)
//   component = TI ≤ threshold ? T                                 (skip lines 4–12)
//               : max( min(T, L), T − max(0, T − L) × pip )         (line 13 = greater of 11 and 26)
//   cap = 20% × max(0, TI − net capital gain)                       (lines 35–36)
//   deduction = min(component, cap)                                 (line 37)
//
// The mid-range subtlety this captures (and most simplified explainers miss):
// for an SSTB inside the phase-out band the applicable-percentage reduction of
// QBI, W-2 wages and UBIA happens FIRST (Schedule A), and the wage-limit excess
// is then ALSO phased in (Part III). A wage-less SSTB mid-band therefore gets
// 20% × QBI × ap², not 20% × QBI × ap — verified against the AICPA Tax Adviser
// (March 2020, "Optimal choice of entity for the QBI deduction") worked
// examples 5, 6 and 10:
//   Ex. 6 (SSTB, no wages, 2019 MFJ params — taxable income $20,000 above the
//        $321,400 Rev. Proc. 2018-57 threshold, so pip = 20%): T = $36,000,
//        excess × 20% = $7,200 → deduction $28,800 = 20% × $225,000 × 0.8².
//   Ex. 5 (SSTB S-corp, wages large enough): excess $0 → full 20% × (QBI × ap).
//   Ex. 10 (non-SSTB, no wages): deduction = 20% × QBI × ap (single reduction).
//
// Illustrative model, NOT tax advice: one trade or business, no loss netting or
// carryforwards, no aggregation, net capital gain assumed zero (stated in the
// UI). QBI here is what the business reports as qualified business income —
// per §199A(c)(1), Schedule C net profit reduced by ½ SE tax, the §162(l)
// self-employed health-insurance deduction and §404 retirement contributions,
// or K-1 ordinary income; owner W-2 wages are
// NOT QBI but DO count as the business's W-2 wages for the limitation.

import { taxFromBrackets, FED_BRACKETS_2025 } from '@/lib/tax';

export type FilingStatus = 'single' | 'mfj';

export const QBI_CONSTANTS = {
  /** §199A(a): 20% deduction rate on QBI and on the taxable-income cap. */
  qbiRate: 0.2,
  /** Rev. Proc. 2024-40 (tax years beginning 2025). */
  threshold: { single: 197300, mfj: 394600 } as Record<FilingStatus, number>,
  /** IRC §199A(e)(2)(B)(ii) — fixed amounts, not inflation-indexed. */
  phaseInRange: { single: 50000, mfj: 100000 } as Record<FilingStatus, number>,
  /** §199A(b)(1)(B)(i). */
  wageShare: 0.5,
  /** §199A(b)(1)(B)(ii): 25% of wages + 2.5% of UBIA. */
  wageShareAlt: 0.25,
  ubiaShare: 0.025,
};

/**
 * 2025 federal ordinary-income brackets, married filing jointly (Rev. Proc.
 * 2024-40), used only to translate the deduction into an approximate federal
 * tax value. Single-filer brackets are imported from lib/tax.ts.
 */
const FED_BRACKETS_2025_MFJ = [
  { rate: 0.1, upTo: 23850 },
  { rate: 0.12, upTo: 96950 },
  { rate: 0.22, upTo: 206700 },
  { rate: 0.24, upTo: 394600 },
  { rate: 0.32, upTo: 501050 },
  { rate: 0.35, upTo: 751600 },
  { rate: 0.37, upTo: Infinity },
];

export type QbiInputs = {
  /**
   * Qualified business income of the trade or business. Per §199A(c)(1), a
   * sole proprietor's QBI is Schedule C net profit reduced by ½ SE tax, the
   * §162(l) self-employed health-insurance deduction and §404 retirement
   * contributions; an owner's K-1 ordinary income is entered as reported.
   */
  qbi: number;
  /** Taxable income BEFORE the QBI deduction, AFTER the standard/itemized deduction. */
  taxableIncome: number;
  /** Total W-2 wages paid by the business (includes an S-corp owner's own salary). */
  w2Wages: number;
  /** UBIA (unadjusted basis immediately after acquisition) of qualified property. */
  ubia: number;
  /** Is the business a specified service trade or business (§199A(d)(2))? */
  sstb: boolean;
  filingStatus: FilingStatus;
};

export type QbiResult = {
  threshold: number;
  phaseInRange: number;
  /** ap — share of SSTB QBI/wages/UBIA still counted (1 at/below threshold). */
  applicablePct: number;
  /** pip = 1 − ap — share of the wage-limit excess that is disallowed. */
  phaseInPct: number;
  aboveThreshold: boolean;
  inPhaseRange: boolean;
  /** QBI after the SSTB applicable-percentage reduction (Schedule A line 11). */
  qbiEffective: number;
  w2Effective: number;
  ubiaEffective: number;
  /** T = 20% × qbiEffective (Form 8995-A line 3). */
  tentativeDeduction: number;
  wageLimit50: number;
  wageLimitAlt: number;
  /** L = greater of the two wage-limit branches (line 10). */
  wageLimit: number;
  wageLimitBasis: '50-percent' | '25-plus-ubia' | 'none';
  /** max(0, T − L) — the wage-limit excess (line 19). */
  excess: number;
  /** excess × pip — the disallowed portion (line 25). */
  phaseInReduction: number;
  /** QBI component after all limitations (line 13 / line 27). */
  component: number;
  /** 20% × (taxable income − net capital gain), net capital gain assumed 0 (line 36). */
  incomeCap: number;
  /** The §199A deduction (line 37). */
  deduction: number;
  limiter: 'qbi' | 'wage' | 'cap';
  fullyUnlocked: boolean;
  /**
   * True when an SSTB's taxable income is above the threshold + phase-in
   * range: the business is excluded entirely (§199A(d)) — positive QBI that
   * the phase-out erased, NOT a qualified loss. Distinct from qbiLoss.
   */
  sstbExcluded: boolean;
  /** True when the entered QBI is zero/negative — a genuine qualified loss. */
  qbiLoss: boolean;
};

/**
 * Applicable percentage (Schedule A line 10 / Part III line 24 complement):
 *
 *   ap = 1 − clamp((TI − threshold) / phaseInRange, 0, 1)
 *
 * ap = 1 at or below the threshold, declines linearly through the phase-in
 * range, and is 0 above it (SSTB fully excluded there).
 */
export function applicablePercentage(taxableIncome: number, filingStatus: FilingStatus): number {
  const th = QBI_CONSTANTS.threshold[filingStatus];
  const range = QBI_CONSTANTS.phaseInRange[filingStatus];
  const over = Math.min(Math.max(taxableIncome - th, 0), range);
  return 1 - over / range;
}

/**
 * The full §199A deduction chain for one trade or business, exactly as
 * Form 8995-A (2025) computes it. See the module header for the formula map
 * and the sources for each constant.
 */
export function computeQbiDeduction(inputs: QbiInputs): QbiResult {
  // Sanitize: dollars are non-negative; losses are handled via qbiLoss below.
  const qbi = Math.max(0, inputs.qbi);
  const ti = Math.max(0, inputs.taxableIncome);
  const w2 = Math.max(0, inputs.w2Wages);
  const ubia = Math.max(0, inputs.ubia);
  const fs = inputs.filingStatus;
  const threshold = QBI_CONSTANTS.threshold[fs];
  const range = QBI_CONSTANTS.phaseInRange[fs];
  const aboveThreshold = ti > threshold;
  const inPhaseRange = aboveThreshold && ti <= threshold + range;

  const ap = aboveThreshold ? applicablePercentage(ti, fs) : 1;
  const pip = 1 - ap;

  // Schedule A (SSTB above threshold): QBI, wages and UBIA each × ap.
  const sstbFactor = inputs.sstb && aboveThreshold ? ap : 1;
  const qbiEffective = qbi * sstbFactor;
  const w2Effective = w2 * sstbFactor;
  const ubiaEffective = ubia * sstbFactor;

  const r = QBI_CONSTANTS.qbiRate;
  const T = qbiEffective * r; // line 3
  const wageLimit50 = w2Effective * QBI_CONSTANTS.wageShare; // line 5
  const wageLimitAlt =
    w2Effective * QBI_CONSTANTS.wageShareAlt + ubiaEffective * QBI_CONSTANTS.ubiaShare; // line 9
  const L = Math.max(wageLimit50, wageLimitAlt); // line 10
  const wageLimitBasis: QbiResult['wageLimitBasis'] =
    L <= 0 ? 'none' : wageLimit50 >= wageLimitAlt ? '50-percent' : '25-plus-ubia';

  const qbiLoss = qbi <= 0;
  // An SSTB above the top of the phase-in range is excluded outright — its
  // QBI/wages/UBIA all scale to zero via ap. Report that as sstbExcluded, not
  // as a "loss": the business has positive QBI that the phase-out erased.
  const sstbExcluded = inputs.sstb && aboveThreshold && ap === 0;

  let component: number;
  if (!aboveThreshold) {
    // §199A(b)(3)(A): below the threshold the wage limit does not apply at all.
    component = Math.max(0, T);
  } else if (qbiLoss) {
    // Qualified loss: no current-year deduction; the loss carries forward
    // (Schedule C) — conservatively modeled as zero here.
    component = 0;
  } else {
    // Line 11 = min(T, L);  line 26 = T − (T − L)×pip;  line 13 = greater of the two.
    const excess = Math.max(0, T - L);
    component = Math.max(Math.min(T, L), T - excess * pip);
  }

  const incomeCap = Math.max(0, ti) * r; // line 36 (net capital gain assumed 0)
  const deduction = Math.min(component, Math.max(0, incomeCap)); // line 37

  const excess = Math.max(0, T - L);
  const limiter: QbiResult['limiter'] =
    incomeCap < component - 1e-9 ? 'cap' : component < T - 1e-9 ? 'wage' : 'qbi';

  return {
    threshold,
    phaseInRange: range,
    applicablePct: ap,
    phaseInPct: pip,
    aboveThreshold,
    inPhaseRange,
    qbiEffective,
    w2Effective,
    ubiaEffective,
    tentativeDeduction: T,
    wageLimit50,
    wageLimitAlt,
    wageLimit: L,
    wageLimitBasis,
    excess,
    phaseInReduction: excess * pip,
    component,
    incomeCap,
    deduction,
    limiter,
    fullyUnlocked: L >= T - 1e-9,
    sstbExcluded,
    qbiLoss,
  };
}

/**
 * Deduction as taxable income sweeps through the phase-out band, for the SAME
 * business as both an SSTB and a non-SSTB (the two lines on the tool's chart).
 */
export function phaseOutSweep(
  base: Omit<QbiInputs, 'sstb' | 'taxableIncome'>,
  fromTi: number,
  toTi: number,
  steps = 121,
): { ti: number; sstb: number; nonSstb: number }[] {
  const out: { ti: number; sstb: number; nonSstb: number }[] = [];
  for (let i = 0; i < steps; i++) {
    const ti = fromTi + ((toTi - fromTi) * i) / (steps - 1);
    out.push({
      ti,
      sstb: computeQbiDeduction({ ...base, taxableIncome: ti, sstb: true }).deduction,
      nonSstb: computeQbiDeduction({ ...base, taxableIncome: ti, sstb: false }).deduction,
    });
  }
  return out;
}

/**
 * Deduction as the business's W-2 wages grow, holding QBI, UBIA and taxable
 * income fixed — the "can wages rescue the deduction" curve. (In reality every
 * wage dollar also reduces QBI dollar-for-dollar; the caption in the tool
 * states this and the article quantifies it.)
 */
export function wageSweep(
  inputs: QbiInputs,
  fromWages: number,
  toWages: number,
  steps = 61,
): { wages: number; deduction: number }[] {
  const out: { wages: number; deduction: number }[] = [];
  for (let i = 0; i < steps; i++) {
    const w = fromWages + ((toWages - fromWages) * i) / (steps - 1);
    out.push({ wages: w, deduction: computeQbiDeduction({ ...inputs, w2Wages: w }).deduction });
  }
  return out;
}

/**
 * The total W-2 wages at which the wage/UBIA limit exactly covers the full 20%
 * of effective QBI — the smallest W with max(50%·W_e, 25%·W_e + 2.5%·U_e) ≥ T.
 *
 *   branch 1: W_e = T / 0.5              (50% branch)
 *   branch 2: W_e = (T − 2.5%·U_e) / 0.25 (25% + UBIA branch)
 *   answer = min(branch1, max(0, branch2)), expressed back in FULL wages
 *   (for an SSTB, divided by ap because Schedule A reduces wages by ap too).
 *
 * Returns null when there is nothing to unlock: no positive QBI, taxable
 * income at/below the threshold (wage limit never applies), or the limit
 * already covering the tentative deduction.
 */
export function wagesNeededToUnlock(inputs: QbiInputs): number | null {
  const r = computeQbiDeduction(inputs);
  if (r.qbiLoss) return null;
  if (!r.aboveThreshold) return null;
  if (r.fullyUnlocked) return null;
  const T = r.tentativeDeduction;
  const branch1 = T / QBI_CONSTANTS.wageShare;
  const branch2 = Math.max(0, (T - r.ubiaEffective * QBI_CONSTANTS.ubiaShare) / QBI_CONSTANTS.wageShareAlt);
  const wNeededEffective = Math.min(branch1, branch2);
  // Convert effective wages back to full wages (SSTB: W_e = W × ap).
  const factor = inputs.sstb ? r.applicablePct : 1;
  return factor > 0 ? wNeededEffective / factor : wNeededEffective;
}

/**
 * Approximate federal income-tax value of the deduction: the bracket-tax
 * difference at (TI) versus (TI − deduction), using 2025 ordinary brackets for
 * the filing status. Capital-gain stacking and credits are ignored — a
 * deliberately conservative, clearly-labeled estimate.
 */
export function taxValueOfDeduction(
  taxableIncome: number,
  deduction: number,
  filingStatus: FilingStatus,
): number {
  const brackets = filingStatus === 'single' ? FED_BRACKETS_2025 : FED_BRACKETS_2025_MFJ;
  const ti = Math.max(0, taxableIncome);
  return Math.max(0, taxFromBrackets(ti, brackets) - taxFromBrackets(Math.max(0, ti - deduction), brackets));
}

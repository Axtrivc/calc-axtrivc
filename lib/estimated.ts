// Quarterly estimated tax model for self-employed filers — IRS Form 1040-ES,
// tax year 2025. Pure functions only: every 2025 parameter is a named constant
// below so the numbers can be audited against the 1040-ES Estimated Tax
// Worksheet, Schedule SE, and IRC §6654 line by line.
//
// This is a simplified, illustrative US federal model — NOT tax advice.
// The instrument answers one question: "How much do I need to pay per quarter
// to avoid the underpayment penalty, and roughly what does skipping cost?"
//
// Documented assumptions (surfaced in the on-page methodology + article):
//  - Income is self-employment (Schedule C) net profit only. W-2 wages are NOT
//    modeled as income — the "W-2 withholding" input enters purely as a tax
//    payment credit, treated as paid ratably over the year per §6654(g)(2).
//  - Tax year 2025 federal parameters (see EST_CONSTANTS). The 2025 standard
//    deduction is $15,750 single / $31,500 MFJ: P.L. 119-21 §70103 (enacted
//    July 4, 2025, retroactive to 2025) raised the $15,000/$30,000 that
//    Rev. Proc. 2024-40 had published for 2025. ($14,600/$29,200 is the 2024
//    tax-year amount, not a 2025 figure at any point.)
//  - SE tax per Schedule SE: 15.3% (12.4% SS + 2.9% Medicare) on 92.35% of net
//    earnings up to the $176,100 SS wage base, 2.9% above it; no SE tax below
//    a $400 base. Form 8959's 0.9% Additional Medicare Tax on SE income above
//    $200k/$250k is NOT modeled (consistent with the suite's other tax tools).
//  - QBI (§199A): 20% of (net SE income − ½ SE tax), capped at 20% of taxable
//    income before the deduction, AND subject to the §199A(b)(2) limitation
//    above the threshold — modeled at this model's own world: a no-employee
//    sole proprietor (W-2 wages paid = $0, UBIA of qualified property = $0),
//    so above $197,300 single / $394,600 MFJ of pre-QBI taxable income the
//    deduction phases out linearly over $50,000/$100,000 and reaches $0. A
//    business paying W-2 wages or holding qualified property can deduct MORE
//    than modeled here (conservative direction for safe-harbor sizing); an
//    SSTB inside the phase-in range gets LESS than this non-SSTB formula.
//  - Required annual payment per §6654(d)(1): the LESSER of 90% of current-
//    year tax or the prior-year harbor (100% of prior-year tax, or 110% when
//    prior-year AGI exceeded $150,000). Exemptions honored: (a) no penalty
//    when current-year tax minus withholding is under $1,000; (b) no penalty
//    when the prior year's tax was $0 (assuming a 12-month prior year and a
//    US citizen/resident — stated in the article, not re-tested here).
//  - Filing statuses modeled: single and married filing jointly only.
//  - No state estimated tax, no household-employment or other credits.

export type FilingStatus = 'single' | 'mfj';

/* ============================ 2025 parameters ============================= */

/**
 * Federal ordinary-income brackets, tax year 2025 (Rev. Proc. 2024-40;
 * unchanged by P.L. 119-21). `upTo` is the top of each bracket for the given
 * filing status; the last bracket is open-ended.
 */
export const FED_BRACKETS_2025: Record<FilingStatus, { rate: number; upTo: number }[]> = {
  single: [
    { rate: 0.1, upTo: 11925 },
    { rate: 0.12, upTo: 48475 },
    { rate: 0.22, upTo: 103350 },
    { rate: 0.24, upTo: 197300 },
    { rate: 0.32, upTo: 250525 },
    { rate: 0.35, upTo: 626350 },
    { rate: 0.37, upTo: Infinity },
  ],
  mfj: [
    { rate: 0.1, upTo: 23850 },
    { rate: 0.12, upTo: 96950 },
    { rate: 0.22, upTo: 206700 },
    { rate: 0.24, upTo: 394600 },
    { rate: 0.32, upTo: 501050 },
    { rate: 0.35, upTo: 751600 },
    { rate: 0.37, upTo: Infinity },
  ],
};

/**
 * Every named 2025 constant the model uses. Sources: IRS Form 1040-ES (2025)
 * Estimated Tax Worksheet; Schedule SE; IRC §6654; IRS quarterly interest-rate
 * releases; P.L. 119-21 §70103 (July 4, 2025) for the standard deduction.
 */
export const EST_CONSTANTS = {
  /** 2025 standard deduction, single — P.L. 119-21 §70103 raised Rev. Proc. 2024-40's $15,000. */
  stdDeductionSingle: 15750,
  /** 2025 standard deduction, married filing jointly — §70103 raised Rev. Proc. 2024-40's $30,000. */
  stdDeductionMfj: 31500,
  /** 2025 Social Security wage base — caps the 12.4% layer of SE tax. */
  ssWageBase: 176100,
  /** SE tax rate below the wage base: 12.4% SS + 2.9% Medicare. */
  seRate: 0.153,
  /** Medicare-only rate on the SE base above the wage base. */
  medicareRate: 0.029,
  /** Schedule SE: SE tax applies to 92.35% of net earnings (7.65% haircut). */
  seBaseFactor: 0.9235,
  /** No SE tax at all when the SE base is under $400. */
  seMinBase: 400,
  /** §199A Qualified Business Income deduction rate. */
  qbiRate: 0.2,
  /**
   * §199A(b)(2) threshold for tax year 2025: pre-QBI taxable income above
   * which the W-2 wage / UBIA limitation begins to apply ($197,300 single /
   * $394,600 MFJ, per the 2025 Form 8995-A instructions).
   */
  qbiThresholdSingle: 197300,
  qbiThresholdMfj: 394600,
  /** Phase-in range of the §199A(b)(2) limitation: $50,000 single / $100,000 MFJ. */
  qbiPhaseInRangeSingle: 50000,
  qbiPhaseInRangeMfj: 100000,
  /** §6654(d)(1)(A): current-year safe harbor is 90% of this year's tax. */
  safeHarborCurrentRate: 0.9,
  /** §6654(d)(1)(B): prior-year safe harbor is 100% of last year's tax. */
  safeHarborPriorRate: 1.0,
  /** …or 110% when prior-year AGI exceeded $150,000. */
  safeHarborPriorHighRate: 1.1,
  /** AGI threshold (any filing status except MFS) that triggers the 110% harbor. */
  highIncomeAgiThreshold: 150000,
  /** §6654(e)(1): no penalty when current tax minus withholding is under $1,000. */
  deMinimisThreshold: 1000,
  /**
   * Federal underpayment rate used by the simplified penalty estimate. The
   * published rate (federal short-term + 3pp) was 7% in every quarter of 2025;
   * the estimate applies it as one flat annual rate, simple interest.
   */
  penaltyRate: 0.07,
} as const;

/**
 * The four 2025 installment periods. `daysToApr15Filing` is the hand-counted
 * number of days from each due date to an April 15, 2026 lump-sum settlement
 * (2025/2026 are not leap years) — used only by the simplified penalty
 * estimate. Q2 2025 moved to Jun 16 because Jun 15 fell on a Sunday.
 */
export const QUARTERS_2025 = [
  { label: 'Q1', due: 'Apr 15, 2025', daysToApr15Filing: 365 },
  { label: 'Q2', due: 'Jun 16, 2025', daysToApr15Filing: 303 },
  { label: 'Q3', due: 'Sep 15, 2025', daysToApr15Filing: 212 },
  { label: 'Q4', due: 'Jan 15, 2026', daysToApr15Filing: 90 },
] as const;

/* ============================ Current-year tax ============================= */

/** Marginal-bracket walker: tax on `income` under a `{rate, upTo}[]` schedule. */
export function taxFromBrackets(income: number, brackets: { rate: number; upTo: number }[]): number {
  let tax = 0;
  let prevCap = 0;
  for (const b of brackets) {
    if (income <= prevCap) break;
    const slice = Math.min(income, b.upTo) - prevCap;
    if (slice > 0) tax += slice * b.rate;
    prevCap = b.upTo;
  }
  return tax;
}

/** 2025 standard deduction for a filing status. */
export function stdDeductionFor(status: FilingStatus): number {
  return status === 'mfj' ? EST_CONSTANTS.stdDeductionMfj : EST_CONSTANTS.stdDeductionSingle;
}

/**
 * Schedule SE (simplified), on net self-employment earnings:
 *
 *   base  = 92.35% × netSE
 *   seTax = 0            if base < $400
 *         = 15.3% × min(base, $176,100) + 2.9% × max(0, base − $176,100)
 *   halfSe = seTax / 2   (above-the-line deduction, Schedule 1)
 *
 * The 0.9% Additional Medicare Tax (Form 8959) on SE income above
 * $200k/$250k is not modeled — stated limitation.
 */
export function seTaxOf(netSE: number): { seBase: number; seTax: number; halfSe: number } {
  const seBase = Math.max(0, netSE) * EST_CONSTANTS.seBaseFactor;
  const seTax =
    seBase < EST_CONSTANTS.seMinBase
      ? 0
      : Math.min(seBase, EST_CONSTANTS.ssWageBase) * EST_CONSTANTS.seRate +
        Math.max(0, seBase - EST_CONSTANTS.ssWageBase) * EST_CONSTANTS.medicareRate;
  return { seBase, seTax, halfSe: seTax / 2 };
}

/**
 * One year of federal tax on nothing but net SE earnings, for a filing status:
 *
 *   agi    = netSE − ½ SE tax
 *   tibq   = max(0, agi − std deduction)          [pre-QBI taxable income]
 *   ap     = 0                                     if tibq ≤ threshold
 *          = min(1, (tibq − threshold) ÷ range)   otherwise
 *   qbiDed = min(20% × agi × (1 − ap), 20% × tibq)
 *   incomeTax = brackets(agi − qbiDed − std deduction)
 *   totalTax  = SE tax + incomeTax
 *
 * The (1 − ap) factor is the §199A(b)(2) limitation evaluated at this model's
 * world — a business paying no W-2 wages and holding no qualified property
 * (UBIA $0): per Form 8995-A Part III the QBI component surviving the
 * limitation is (1 − ap)×QBI + ap×min(QBI, wage limit), and a $0 wage limit
 * collapses that to (1 − ap)×QBI. Thresholds are 2025: $197,300 single /
 * $394,600 MFJ over a $50,000/$100,000 phase-in. `qbiPhaseOutPct` returns ap
 * so the UI can surface how much of the deduction the limitation removed.
 */
export function currentYearTaxAt(netSE: number, status: FilingStatus) {
  const { seTax, halfSe } = seTaxOf(netSE);
  const agi = Math.max(0, netSE) - halfSe;
  const std = stdDeductionFor(status);
  const taxableBeforeQbi = Math.max(0, agi - std);
  const threshold = status === 'mfj' ? EST_CONSTANTS.qbiThresholdMfj : EST_CONSTANTS.qbiThresholdSingle;
  const range = status === 'mfj' ? EST_CONSTANTS.qbiPhaseInRangeMfj : EST_CONSTANTS.qbiPhaseInRangeSingle;
  const qbiPhaseOutPct = taxableBeforeQbi <= threshold ? 0 : Math.min(1, (taxableBeforeQbi - threshold) / range);
  const qbiDeduction = Math.min(
    agi * EST_CONSTANTS.qbiRate * (1 - qbiPhaseOutPct),
    taxableBeforeQbi * EST_CONSTANTS.qbiRate,
  );
  const taxableIncome = Math.max(0, agi - qbiDeduction - std);
  const incomeTax = taxFromBrackets(taxableIncome, FED_BRACKETS_2025[status]);
  return {
    seTax,
    halfSe,
    agi,
    qbiDeduction,
    qbiPhaseOutPct,
    taxableIncome,
    incomeTax,
    totalTax: seTax + incomeTax,
  };
}

/* ========================== Safe harbors & schedule ======================== */

export type EstimatedTaxInputs = {
  /** Net self-employment income for the year (Schedule C profit). */
  netSE: number;
  filingStatus: FilingStatus;
  /** Federal income tax expected to be withheld during the year (W-2 jobs). */
  w2Withholding: number;
  /**
   * Last year's total tax (1040 "total tax" line), if known.
   * `null` = unknown/ignored → only the 90% current-year harbor is available.
   * `0` = last year's tax was actually zero → §6654(e)(2) exemption applies.
   */
  priorTax: number | null;
  /** Was prior-year AGI over $150,000? (→ 110% prior-year harbor.) */
  priorAgiOver150k: boolean;
};

/** Which safe harbor sets the required annual payment. */
export type SafeHarborKind = 'prior100' | 'prior110' | 'current90';

export type QuarterlyInstallment = {
  label: string;
  due: string;
  /** Equal installment under the regular method (§6654(d)(1)(A)). */
  installment: number;
  cumulative: number;
};

export type EstimatedTaxResult = {
  // Current-year tax detail
  seTax: number;
  halfSe: number;
  agi: number;
  qbiDeduction: number;
  taxableIncome: number;
  incomeTax: number;
  currentTotalTax: number;
  effectiveRate: number;
  // Safe-harbor comparison (gross amounts, before withholding)
  current90: number;
  prior100: number | null;
  prior110: number | null;
  applicable: SafeHarborKind;
  /** The §6654(d)(1) required annual payment BEFORE exemptions (>= 0). */
  harborBasis: number;
  // Exemptions
  deMinimisExempt: boolean;
  priorYearZeroExempt: boolean;
  // Schedule
  requiredAnnualPayment: number;
  netToPayByEstimates: number;
  perQuarter: number;
  quarterly: QuarterlyInstallment[];
  /** Withholding as a share of the required payment (0–100+, NaN-safe 0). */
  withholdingCoveragePct: number;
  /** Simplified penalty estimate for skipping all four installments. */
  penaltyEstimate: number;
  /**
   * Balloon payment expected with the 2025 return (Apr 2026):
   * max(0, currentTotalTax − withholding − netToPayByEstimates) — the balance
   * left after withholding and the four suggested installments, i.e. the
   * penalty-free deferral the prior-year harbor creates when income rose.
   */
  expectedAtFiling: number;
  /** §199A(b)(2) phase-out fraction applied to the QBI deduction (0–1, no-employee basis). */
  qbiPhaseOutPct: number;
  priorTaxKnown: boolean;
};

/**
 * Full 1040-ES computation for one set of inputs.
 *
 *   currentTotalTax = SE tax + income tax            (see currentYearTaxAt)
 *   prior harbor    = 100% or 110% × priorTax        (110% iff prior AGI > $150k)
 *   harborBasis     = min(prior harbor, 90% × currentTotalTax)   [§6654(d)(1)]
 *   required        = 0 if (currentTotalTax − withholding < $1,000)   [§6654(e)(1)]
 *                     0 if priorTax === 0 (12-month prior year assumed) [§6654(e)(2)]
 *                     else harborBasis
 *   netToPay        = max(0, required − withholding)   [withholding counts as
 *                       paid ratably, §6654(g); it offsets the annual total]
 *   perQuarter      = netToPay ÷ 4                     [regular method]
 */
export function computeEstimatedTax(inputs: EstimatedTaxInputs): EstimatedTaxResult {
  const netSE = Math.max(0, inputs.netSE);
  const withholding = Math.max(0, inputs.w2Withholding);
  const priorTax = inputs.priorTax === null ? null : Math.max(0, inputs.priorTax);
  const priorKnown = priorTax !== null;

  const t = currentYearTaxAt(netSE, inputs.filingStatus);

  const current90 = t.totalTax * EST_CONSTANTS.safeHarborCurrentRate;
  const prior100 = priorKnown ? priorTax * EST_CONSTANTS.safeHarborPriorRate : null;
  const prior110 = priorKnown ? priorTax * EST_CONSTANTS.safeHarborPriorHighRate : null;
  const applicablePrior = inputs.priorAgiOver150k ? prior110 : prior100;

  let applicable: SafeHarborKind;
  let harborBasis: number;
  if (applicablePrior !== null && applicablePrior <= current90) {
    applicable = inputs.priorAgiOver150k ? 'prior110' : 'prior100';
    harborBasis = applicablePrior;
  } else {
    applicable = 'current90';
    harborBasis = current90;
  }

  const deMinimisExempt = t.totalTax - withholding < EST_CONSTANTS.deMinimisThreshold;
  const priorYearZeroExempt = priorKnown && priorTax === 0;
  const requiredAnnualPayment = deMinimisExempt || priorYearZeroExempt ? 0 : harborBasis;

  const netToPayByEstimates = Math.max(0, requiredAnnualPayment - withholding);
  const perQuarter = netToPayByEstimates / 4;

  const quarterly: QuarterlyInstallment[] = QUARTERS_2025.map((q, i) => ({
    label: q.label,
    due: q.due,
    installment: perQuarter,
    cumulative: perQuarter * (i + 1),
  }));

  return {
    seTax: t.seTax,
    halfSe: t.halfSe,
    agi: t.agi,
    qbiDeduction: t.qbiDeduction,
    taxableIncome: t.taxableIncome,
    incomeTax: t.incomeTax,
    currentTotalTax: t.totalTax,
    effectiveRate: netSE > 0 ? (t.totalTax / netSE) * 100 : 0,
    current90,
    prior100,
    prior110,
    applicable,
    harborBasis,
    deMinimisExempt,
    priorYearZeroExempt,
    requiredAnnualPayment,
    netToPayByEstimates,
    perQuarter,
    quarterly,
    withholdingCoveragePct:
      requiredAnnualPayment > 0 ? Math.min(100, (withholding / requiredAnnualPayment) * 100) : 0,
    penaltyEstimate: skipPenaltyEstimate(requiredAnnualPayment, withholding),
    expectedAtFiling: Math.max(0, t.totalTax - withholding - netToPayByEstimates),
    qbiPhaseOutPct: t.qbiPhaseOutPct,
    priorTaxKnown: priorKnown,
  };
}

/**
 * Simplified underpayment-penalty ESTIMATE (clearly labeled in the UI):
 * assumes NO estimated payments are made and the whole tax is settled with the
 * April 15, 2026 filing, with W-2 withholding credited ratably (§6654(g)).
 *
 *   u       = max(0, required − withholding) ÷ 4        (unpaid installment)
 *   penalty ≈ Σ over quarters of u × 7% × daysToApr15Filing ÷ 365
 *
 * Days from each 2025 due date to Apr 15, 2026: 365 / 303 / 212 / 90
 * (Σ = 970), so the whole expression reduces to
 * u × 7% × 2.6575. The real Form 2210 computation differs mainly in that it
 * re-prices each period at the quarterly published rate and uses actual
 * payment dates — like this estimate it is SIMPLE interest: per IRM 20.1.3
 * the §6654 penalty "is computed in the same manner as interest, except it
 * is NOT compounded daily." Treat this as an order-of-magnitude figure, not
 * a filing number.
 */
export function skipPenaltyEstimate(requiredAnnualPayment: number, w2Withholding: number): number {
  const underpayment = Math.max(0, Math.max(0, requiredAnnualPayment) - Math.max(0, w2Withholding)) / 4;
  return QUARTERS_2025.reduce(
    (sum, q) => sum + underpayment * EST_CONSTANTS.penaltyRate * (q.daysToApr15Filing / 365),
    0,
  );
}

/* ============================== Sensitivity =============================== */

export type SweepPoint = {
  income: number;
  /** Net annual amount owed under the 90%-of-current-tax harbor (net of withholding). */
  current90Net: number;
  /** Net annual amount under the applicable prior-year harbor; null when prior tax unknown. */
  priorNet: number | null;
  /** The binding line: min of the two harbors, net of withholding. */
  requiredNet: number;
};

/**
 * Sweep of net SE income → safe-harbor lines (for the sensitivity chart).
 * Holds filing status, withholding, and the prior-year harbor fixed and
 * recomputes the 90% line at each income level. Exemptions (de minimis,
 * prior-year-zero) are intentionally NOT applied here so the lines stay
 * comparable across the whole range — the interactive result applies them.
 */
export function safeHarborSweep(
  base: Omit<EstimatedTaxInputs, 'netSE'>,
  from = 20000,
  to = 400000,
  steps = 25,
): SweepPoint[] {
  const withholding = Math.max(0, base.w2Withholding);
  const priorTax = base.priorTax === null ? null : Math.max(0, base.priorTax);
  const applicablePrior = base.priorAgiOver150k
    ? priorTax === null
      ? null
      : priorTax * EST_CONSTANTS.safeHarborPriorHighRate
    : priorTax === null
      ? null
      : priorTax * EST_CONSTANTS.safeHarborPriorRate;

  const out: SweepPoint[] = [];
  for (let i = 0; i < steps; i++) {
    const income = from + ((to - from) * i) / (steps - 1);
    const current90 = currentYearTaxAt(income, base.filingStatus).totalTax * EST_CONSTANTS.safeHarborCurrentRate;
    const requiredGross = applicablePrior === null ? current90 : Math.min(applicablePrior, current90);
    out.push({
      income,
      current90Net: Math.max(0, current90 - withholding),
      priorNet: applicablePrior === null ? null : Math.max(0, applicablePrior - withholding),
      requiredNet: Math.max(0, requiredGross - withholding),
    });
  }
  return out;
}

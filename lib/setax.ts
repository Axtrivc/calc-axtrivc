// Self-employment tax (SECA) model — the math library behind the
// Self-Employment Tax Calculator page.
//
// This module isolates ONE tax and computes it the way Schedule SE does,
// including the interactions a side-business owner with a day job actually
// faces: Social Security wage-base coordination with W-2 wages, and the
// filing-status thresholds of the 0.9% Additional Medicare Tax.
//
// Simplified, illustrative US federal model — NOT tax advice.
//
// TAX YEARS: every function takes an optional `year` (2025 | 2026, default
// 2026 — the current tax year). The ONLY parameter that differs between the
// two years is the Social Security wage base ($176,100 in 2025; $184,500 in
// 2026 per SSA's announced taxable maximum). The 0.9% Additional Medicare
// thresholds ($200k/$250k/$125k), the 92.35% base factor, the 12.4%/2.9%
// rates and the $400 floor are statutory and unchanged across both years.
//
// Documented assumptions:
//  - "Net profit" = Schedule C net profit (revenue minus ordinary business
//    expenses), before SE tax and before income tax.
//  - SE tax base ("net earnings from self-employment") = 92.35% of net profit.
//    The factor is statutory (IRC §1402(a)(2)): it substitutes for the
//    employer-half FICA deduction a W-2 worker's company gets —
//    1 − 7.65% = 92.35% (Schedule SE line 4a). It is a flat statutory factor,
//    not an itemized cost computation.
//  - No SE tax at all when net earnings are below $400 (Schedule SE stopping
//    rule; note it is a cliff — at $400+ of net earnings the WHOLE base is
//    taxed, not just the excess).
//  - Social Security part = 12.4% × min(SE base, wage-base room), where the
//    room is the year's wage base minus W-2 social-security wages, floored at
//    0 (Schedule SE lines 8a–11). W-2 SS wages are themselves capped at the
//    wage base, so an entered wage figure above the cap still leaves zero room.
//  - Medicare part = 2.9% × the ENTIRE SE base — no cap (Schedule SE line 12).
//  - Additional Medicare Tax (IRC §1401(b)(2), Form 8959): employee-side 0.9%
//    on SE income above the filing-status threshold ($200,000 single /
//    $250,000 married filing jointly / $125,000 married filing separately):
//      0.9% × min(SE base, max(0, wages + SE base − threshold)).
//    The sum is the TAXPAYER'S OWN Medicare wages plus net earnings from
//    self-employment (§1401(b)(2)(B)(i)); a spouse's wages are NOT added —
//    for joint filers the $250k threshold itself is the marital adjustment.
//    Spouse-side income is therefore not modeled (disclosed in the UI).
//  - One-half of SE tax is deductible against income tax (§164(f)); the
//    deductible half INCLUDES the Additional Medicare piece (Form 8959
//    line 25 computes a 50% deduction for the SE-side amount).
//  - The W-2 comparison (ficaOnWages) treats the entered wages as both SS
//    wages (capped at the year's wage base) and Medicare wages (uncapped),
//    and applies the filing-status threshold to the 0.9% layer. Real-world
//    employer withholding on wages starts at $200,000 regardless of status
//    and is reconciled on Form 8959 — an approximation noted for
//    transparency.
//  - Federal only: no state taxes, no self-employed health-insurance or
//    retirement-plan interactions, and income tax itself is out of scope
//    (this instrument prices the SE tax layer alone).

export type SeFilingStatus = 'single' | 'mfj' | 'mfs';
export type SeTaxYear = 2025 | 2026;

/** 2026 wage base per SSA's announced taxable maximum (ssa.gov/oact/cola). */
const SS_WAGE_BASE_BY_YEAR: Record<SeTaxYear, number> = {
  2025: 176100,
  2026: 184500,
};

/** Federal parameters for the self-employment tax layer, by tax year. */
export const SE_TAX_CONSTANTS = {
  /** Schedule SE line 4a factor: 1 − 7.65% employer-half equivalent. */
  seBaseFactor: 0.9235,
  /** Social Security rate on the SE base (employee + employer halves). */
  ssRate: 0.124,
  /** Medicare rate on the SE base (employee + employer halves, uncapped). */
  medicareRate: 0.029,
  /** Additional Medicare Tax rate (employee side only). */
  additionalMedicareRate: 0.009,
  /** Social Security wage base (OASDI cap) by tax year. */
  ssWageBaseByYear: SS_WAGE_BASE_BY_YEAR,
  /** Net earnings below this owe no SE tax at all (Schedule SE rule). */
  minNetEarnings: 400,
  /**
   * 0.9% Additional Medicare thresholds by filing status. Statutorily NOT
   * inflation-indexed — identical in 2025 and 2026.
   */
  additionalMedicareThreshold: {
    single: 200000,
    mfj: 250000,
    mfs: 125000,
  } as Record<SeFilingStatus, number>,
} as const;

/** The Social Security wage base for a tax year ($184,500 in 2026). */
export function wageBaseFor(year: SeTaxYear): number {
  return SS_WAGE_BASE_BY_YEAR[year] ?? SS_WAGE_BASE_BY_YEAR[2026];
}

/** Coerce any number (workbench/URL input) to a valid model year. */
export function normalizeSeYear(year: number): SeTaxYear {
  return year === 2025 ? 2025 : 2026;
}

export type SeTaxResult = {
  netProfit: number;
  w2Wages: number;
  status: SeFilingStatus;
  year: SeTaxYear;
  /** The year's Social Security wage base used for the cap. */
  ssWageBase: number;
  /** 92.35% × net profit — the Schedule SE tax base. */
  base: number;
  /** Whether the $400 net-earnings floor is met (below it, no SE tax). */
  applies: boolean;
  /** 12.4% × min(base, wage-base room left after W-2 SS wages). */
  ssPart: number;
  /** 2.9% × base (entire base, no cap). */
  medicarePart: number;
  /** 0.9% × min(base, max(0, own wages + base − threshold)). */
  additionalPart: number;
  /** ssPart + medicarePart + additionalPart. */
  totalSeTax: number;
  /** One-half of total SE tax, deductible against income tax (§164(f)). */
  halfDeduction: number;
  /** Year wage base − min(w2Wages, wage base), floored at 0 — SS room. */
  ssRoom: number;
  /**
   * Net profit at which the SE base exactly fills the remaining SS room:
   * room ÷ 0.9235. Null when the room is exhausted (only Medicare applies).
   * With zero W-2 wages the kink sits at $199,783.43 in 2026 (and
   * $190,687.60 in 2025) — NOT the wage base itself — because the cap binds
   * on 92.35% of profit.
   */
  capKinkNetProfit: number | null;
  /** Filing-status threshold for the 0.9% Additional Medicare Tax. */
  threshold: number;
  /** totalSeTax ÷ net profit × 100 (0 when net profit is 0). */
  effectiveRateOnNet: number;
};

/**
 * SE tax base: 92.35% of net profit (IRC §1402(a)(2), Schedule SE line 4a).
 * `seTaxBase(net) = 0.9235 × max(0, net)`
 */
export function seTaxBase(netProfit: number): number {
  return Math.max(0, netProfit) * SE_TAX_CONSTANTS.seBaseFactor;
}

/**
 * Social Security room left for SE income after W-2 social-security wages:
 * `max(0, wageBase(year) − min(w2Wages, wageBase(year)))`
 * (Schedule SE lines 8a–9). W-2 SS wages are themselves capped at the wage
 * base, so wages at or above it leave zero room and SE income carries only
 * the Medicare layers. A spouse's wages never enter this computation.
 */
export function ssWageBaseRoom(w2Wages: number, year: SeTaxYear = 2026): number {
  const cap = wageBaseFor(year);
  return Math.max(0, cap - Math.min(Math.max(0, w2Wages), cap));
}

/**
 * Net profit at which the SE base hits the remaining SS wage-base room:
 * `ssWageBaseRoom(w2, year) ÷ 0.9235`, or null when the room is exhausted.
 * Zero W-2 wages → $184,500 ÷ 0.9235 = $199,783.43 (2026);
 * $176,100 ÷ 0.9235 = $190,687.60 (2025).
 */
export function ssKinkNetProfit(w2Wages: number, year: SeTaxYear = 2026): number | null {
  const room = ssWageBaseRoom(w2Wages, year);
  if (room <= 0) return null;
  return room / SE_TAX_CONSTANTS.seBaseFactor;
}

/**
 * Full self-employment tax on a net Schedule C profit.
 *
 * Formula (Schedule SE + Form 8959):
 * ```
 * base      = 0.9235 × netProfit                    (§1402(a)(2))
 * applies   = base ≥ 400                            (Schedule SE rule)
 * ssPart    = applies ? 0.124 × min(base, max(0, WB − min(w2, WB))) : 0
 * medPart   = applies ? 0.029 × base                                  : 0
 * addlPart  = applies ? 0.009 × min(base, max(0, w2 + base − T))      : 0
 *   where WB = $184,500 (2026) / $176,100 (2025)
 *         T  = 200,000 (single) / 250,000 (MFJ) / 125,000 (MFS)
 * total     = ssPart + medPart + addlPart
 * halfDed   = total / 2                             (§164(f); incl. 0.9% layer)
 * ```
 * Returns every intermediate line so the UI can show the ledger, not just
 * the total.
 */
export function computeSeTax(
  netProfit: number,
  w2Wages = 0,
  status: SeFilingStatus = 'single',
  year: SeTaxYear = 2026,
): SeTaxResult {
  const net = Math.max(0, netProfit);
  const w2 = Math.max(0, w2Wages);
  const threshold = SE_TAX_CONSTANTS.additionalMedicareThreshold[status];
  const cap = wageBaseFor(year);

  const base = net * SE_TAX_CONSTANTS.seBaseFactor;
  const applies = base >= SE_TAX_CONSTANTS.minNetEarnings;

  const room = ssWageBaseRoom(w2, year);
  const ssPart = applies ? Math.min(base, room) * SE_TAX_CONSTANTS.ssRate : 0;
  const medicarePart = applies ? base * SE_TAX_CONSTANTS.medicareRate : 0;
  // §1401(b)(2): the 0.9% hits the smaller of the SE base and the excess of
  // the taxpayer's OWN wages + SE base over the filing-status threshold.
  const additionalPart = applies
    ? Math.min(base, Math.max(0, w2 + base - threshold)) *
      SE_TAX_CONSTANTS.additionalMedicareRate
    : 0;

  const totalSeTax = ssPart + medicarePart + additionalPart;

  return {
    netProfit: net,
    w2Wages: w2,
    status,
    year,
    ssWageBase: cap,
    base,
    applies,
    ssPart,
    medicarePart,
    additionalPart,
    totalSeTax,
    halfDeduction: totalSeTax / 2,
    ssRoom: room,
    capKinkNetProfit: ssKinkNetProfit(w2, year),
    threshold,
    effectiveRateOnNet: net > 0 ? (totalSeTax / net) * 100 : 0,
  };
}

export type FicaResult = {
  wages: number;
  /** Employee-side FICA: 6.2% × min(w, WB) + 1.45% × w + 0.9% × max(0, w − T). */
  employeeShare: number;
  /** Employer-side FICA: 6.2% × min(w, WB) + 1.45% × w (no 0.9% match). */
  employerShare: number;
  /** employeeShare + employerShare — the full payroll-tax cost of the wage. */
  combinedCost: number;
};

/**
 * W-2 FICA on a wage for the comparison view:
 * ```
 * employee = 0.062 × min(w, WB) + 0.0145 × w + 0.009 × max(0, w − T)
 * employer = 0.062 × min(w, WB) + 0.0145 × w
 * combined = employee + employer
 * ```
 * The employee side carries the Additional Medicare Tax alone (no employer
 * match); T is the filing-status threshold, as in computeSeTax; WB is the
 * year's wage base.
 */
export function ficaOnWages(
  wages: number,
  status: SeFilingStatus = 'single',
  year: SeTaxYear = 2026,
): FicaResult {
  const w = Math.max(0, wages);
  const threshold = SE_TAX_CONSTANTS.additionalMedicareThreshold[status];
  const ssWage = Math.min(w, wageBaseFor(year)) * 0.062;
  const medicareWage = w * 0.0145;
  const employerShare = ssWage + medicareWage;
  const employeeShare =
    employerShare + Math.max(0, w - threshold) * SE_TAX_CONSTANTS.additionalMedicareRate;
  return { wages: w, employeeShare, employerShare, combinedCost: employeeShare + employerShare };
}

/**
 * SE tax versus W-2 FICA on the SAME gross income — the honest comparison
 * for a worker choosing between a contract and a salary:
 *   - employeeShare is what a W-2 worker sees withheld;
 *   - combinedCost is what employing them actually costs (both halves);
 *   - seMinusCombined is how much LESS the self-employed pay on the same
 *     gross, courtesy of the 7.65% haircut on the SE base. It is negative
 *     for every positive income (the 0.9% layer narrows the gap but never
 *     erases it, because the SE side pays 0.9% on a haircut base against a
 *     later-binding threshold).
 */
export function seVsFica(
  netProfit: number,
  w2Wages = 0,
  status: SeFilingStatus = 'single',
  year: SeTaxYear = 2026,
) {
  const se = computeSeTax(netProfit, w2Wages, status, year);
  const w2 = ficaOnWages(netProfit, status, year);
  return {
    se,
    w2,
    seMinusEmployeeShare: se.totalSeTax - w2.employeeShare,
    seMinusCombinedCost: se.totalSeTax - w2.combinedCost,
  };
}

/**
 * True marginal cost of the NEXT $1 of net profit, split by layer.
 * Computed as the exact difference computeSeTax(p+1) − computeSeTax(p), so
 * the $400 cliff is represented honestly (just below the floor the marginal
 * jumps from $0 to the full tax on the entire base — about $61.32 at the
 * $433 crossing — before returning to the per-dollar rates).
 * Under the SS cap: 0.9235 × 15.3% = 14.13¢ per $1. Above the cap:
 * 0.9235 × 2.9% = 2.68¢, or 0.9235 × 3.8% = 3.51¢ once the 0.9% layer
 * (or exhausted SS room) applies.
 */
export function marginalSeTaxOnNextDollar(
  netProfit: number,
  w2Wages = 0,
  status: SeFilingStatus = 'single',
  year: SeTaxYear = 2026,
): { ss: number; medicare: number; additional: number; total: number } {
  const at = computeSeTax(netProfit, w2Wages, status, year);
  const next = computeSeTax(netProfit + 1, w2Wages, status, year);
  return {
    ss: next.ssPart - at.ssPart,
    medicare: next.medicarePart - at.medicarePart,
    additional: next.additionalPart - at.additionalPart,
    total: next.totalSeTax - at.totalSeTax,
  };
}

/**
 * Marginal W-2 FICA on the next $1 of wages, for the per-dollar comparison
 * view: computed as ficaOnWages(w+1) − ficaOnWages(w). Under the wage base
 * the employee share costs 7.65¢ and both halves 15.3¢; above it, 1.45¢ and
 * 2.9¢ — plus 0.9¢ on the employee side once wages pass the threshold
 * (stepping the employee line UP to 2.35¢, never down).
 */
export function marginalFicaOnNextDollar(
  wages: number,
  status: SeFilingStatus = 'single',
  year: SeTaxYear = 2026,
): { employee: number; combined: number } {
  const at = ficaOnWages(wages, status, year);
  const next = ficaOnWages(wages + 1, status, year);
  return {
    employee: next.employeeShare - at.employeeShare,
    combined: next.combinedCost - at.combinedCost,
  };
}

/**
 * One chart pass: SE total, W-2 employee share and W-2 combined FICA cost at
 * each net-profit point on [from, to] (inclusive, `steps` samples). The same
 * W-2 wages input, filing status and tax year drive all three series so the
 * lines are directly comparable.
 */
export function sweepSeries(
  from: number,
  to: number,
  steps: number,
  w2Wages = 0,
  status: SeFilingStatus = 'single',
  year: SeTaxYear = 2026,
): { net: number; seTotal: number; employeeShare: number; combinedCost: number }[] {
  const out: { net: number; seTotal: number; employeeShare: number; combinedCost: number }[] = [];
  const n = Math.max(2, Math.floor(steps));
  for (let i = 0; i < n; i++) {
    const net = from + ((to - from) * i) / (n - 1);
    const se = computeSeTax(net, w2Wages, status, year);
    const fica = ficaOnWages(net, status, year);
    out.push({ net, seTotal: se.totalSeTax, employeeShare: fica.employeeShare, combinedCost: fica.combinedCost });
  }
  return out;
}

/**
 * Default quarterly installment for the SE tax layer alone:
 * total SE tax ÷ 4 (the equal-installment default of Form 1040-ES).
 * The full required installment also includes income tax — this figure is the
 * SE-tax component only, and safe-harbor tests (90% / 100% / 110% of prior
 * year) are out of scope.
 */
export function quarterlySeInstallment(totalSeTax: number): number {
  return Math.max(0, totalSeTax) / 4;
}

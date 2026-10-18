// §41 Credit for Increasing Research Activities — self-employed / startup
// model, tax year 2025, deliberately conservative.
//
// This library computes the Alternative Simplified Credit (ASC) branch of
// IRC §41(c)(4) — the method an overwhelming majority of small taxpayers file
// on Form 6765 Section C — together with the two downstream decisions that
// decide what the credit is actually worth:
//
//   1. The §280C(c) choice — full credit with a reduced §174A deduction, or a
//      reduced credit with a full deduction.
//   2. The §41(h) payroll-tax election — qualified small businesses may apply
//      part of the credit against the employer share of FICA instead of
//      income tax. Dollars elected there leave the income-tax path entirely
//      (see evaluateIncomePath).
//
// Every statutory constant is cited inline. The §174/§174A context (2022–2024
// mandatory capitalization, restored domestic expensing from tax years
// beginning after 12/31/2024 under OBBBA §70302) does not change any number
// below — the credit formula itself is unaffected — so it is disclosed in the
// UI and the article rather than modeled.
//
// Illustrative model, NOT tax advice: one trade or business, federal only,
// no state credits, no AMT (stated), no controlled-group allocation, and the
// aggregate QRE is a single input (wages / supplies / contract-research
// composition is not distinguished — contract research enters QRE at 65%
// under §41(b)(3)(A); 75% applies only to payments to a qualified research
// consortium under §41(b)(3)(C), and 100% only to qualified ENERGY research
// performed by an eligible small business (≤500 employees, unrelated to the
// payor — §41(b)(3)(D), a different definition from the §41(h) qualified
// small business), a college, or a federal laboratory).

/* ============================== Parameters ================================ */

export const RDC_CONSTANTS = {
  /**
   * §41(c)(4)(A): the simplified credit equals 14% of current-year QRE in
   * excess of 50% of the average QRE for the 3 preceding taxable years
   * (attributable to the trade or business). Mirrors Form 6765 Section C.
   */
  ascRate: 0.14,
  /**
   * §41(c)(4)(B) — "Special rule in case of no qualified research expenses
   * in any of 3 preceding taxable years": the credit is a flat 6% of
   * current-year QRE. The trigger is NO QRE in any of the 3 preceding years —
   * which is exactly a zero prior-3-year average — and it covers both
   * first-time filers and companies returning to research after a multi-year
   * gap. (The 3-year average itself is simply the sum of the preceding three
   * years ÷ 3, zeros included.)
   */
  startupRate: 0.06,
  /** §41(c)(4)(A): the 3-year base is half the prior average. */
  baseShare: 0.5,
  /**
   * §280C(c)(2)(B) (post-TCJA): the reduced credit is the §41(a) credit
   * minus credit × the maximum §11(b) corporate rate — 21% since 2018 — so
   * the taxpayer keeps 79% of the credit and gives up nothing in deduction.
   * (Pre-TCJA at a 35% top rate the kept share was 65%.)
   */
  corpMaxRate: 0.21,
  /**
   * §38(c)(1)(B) (current text — the 25%/$25,000 language formerly cited at
   * §38(c)(3) moved here; that paragraph was repealed by P.L. 115-141):
   * the general-business-credit ceiling is net income tax over the greater
   * of the tentative minimum tax or 25% of net regular tax liability above
   * $25,000. §38(c)(6)(E) applies the same 25%-over-$25,000 cap to
   * corporations (they just skip the tentative-minimum-tax prong) — per the
   * IRS Form 3800 instructions, corporations are allowed a general business
   * credit equal to 25% of the excess of net income tax over $25,000. With
   * AMT assumed away (this model's stated assumption) the formula is
   * identical for every entity type.
   */
  gbcRate: 0.25,
  /** §38(c)(1)(B): the 25% haircut applies to net regular tax above $25,000. */
  gbcFloor: 25_000,
  /**
   * §41(h)(2)(B): a qualified small business may elect at most $500,000 of
   * the credit per tax year against employer FICA (raised from $250,000 for
   * tax years beginning after 12/31/2022 by IRA §13902). Per the IRS QSB
   * payroll-credit page, amounts not absorbed carry forward to later
   * employment-tax returns.
   */
  qsbPayrollCap: 500_000,
  /** §41(h)(3)(B)(i): QSB gross-receipts ceiling for the credit year. */
  qsbReceiptsCap: 5_000_000,
  /** §3111(a): employer old-age, survivors and disability insurance share. */
  employerOasdi: 0.062,
  /** §3111(b): employer Medicare (hospital insurance) share. */
  employerHi: 0.0145,
} as const;

/* ========================== Gross credit (§41(c)(4)) ====================== */

export type GrossCreditInputs = {
  /** Qualified research expenses for the current tax year (aggregate §41(b) QRE). */
  qre: number;
  /**
   * Average ANNUAL QRE over the 3 taxable years preceding the credit year
   * (sum ÷ 3, zeros included). An average of exactly zero — no QRE in any of
   * the 3 preceding years — triggers the §41(c)(4)(B) 6% special rule,
   * whether this is the taxpayer's first research year ever or a return to
   * research after a multi-year gap.
   */
  priorAvg3Qre: number;
};

export type GrossCreditResult = {
  method: 'asc-startup' | 'asc';
  /** 50% × priorAvg3Qre — the increment threshold (0 under the 6% special rule). */
  base: number;
  /** max(0, QRE − base) — the portion the 14% rate multiplies (QRE itself under the 6% rule). */
  increment: number;
  /** The §41(a) credit before §280C, before the §41(h) split, and before the §38 ceiling. */
  grossCredit: number;
};

/**
 * The Alternative Simplified Credit (§41(c)(4)), exactly as Form 6765
 * Section C determines it:
 *
 *   no QRE in any of the 3 preceding years (avg = 0):
 *       credit = 6% × QRE                          (§41(c)(4)(B))
 *   otherwise:
 *       credit = 14% × max(0, QRE − 50% × avgQRE₃) (§41(c)(4)(A))
 *
 * The increment floors at zero — QRE below the base produces no credit, never
 * a negative one. Contract research enters QRE at 65% (§41(b)(3)(A)); this
 * aggregate model leaves that blending to the input.
 */
export function computeGrossCredit(inputs: GrossCreditInputs): GrossCreditResult {
  const qre = Math.max(0, inputs.qre);
  const avg = Math.max(0, inputs.priorAvg3Qre);
  if (avg <= 0) {
    return {
      method: 'asc-startup',
      base: 0,
      increment: qre,
      grossCredit: qre * RDC_CONSTANTS.startupRate,
    };
  }
  const base = avg * RDC_CONSTANTS.baseShare;
  const increment = Math.max(0, qre - base);
  return {
    method: 'asc',
    base,
    increment,
    grossCredit: increment * RDC_CONSTANTS.ascRate,
  };
}

/* ===================== §38(c) income-tax ceiling ========================== */

/**
 * Tentative general-business-credit limitation, §38(c): the §41 credit (as
 * part of the §38 GBC) cannot exceed net income tax minus the GREATER of the
 * tentative minimum tax or 25% of net regular tax liability above $25,000
 * (§38(c)(1)(B)). For corporations, §38(c)(6)(E) applies the same
 * 25%-over-$25,000 cap (skipping only the minimum-tax prong) — the IRS Form
 * 3800 instructions state it verbatim for corporations, so there is no
 * entity-type branch here. With the regular income-tax liability entered and
 * AMT assumed away (stated in the UI):
 *
 *   ceiling = tax − max(0, 25% × (tax − $25,000))
 *
 * Credit above the ceiling is not lost — it carries back 1 year and forward
 * 20 as a GBC carryover (§39(a)) — but it is not cash this year, which is the
 * whole reason §41(h)'s payroll election exists for startups.
 */
export function gbcCeiling(regularTax: number): number {
  const tax = Math.max(0, regularTax);
  return tax - Math.max(0, (tax - RDC_CONSTANTS.gbcFloor) * RDC_CONSTANTS.gbcRate);
}

/* ========================= Income-tax path (§280C) ======================== */

export type IncomePathInputs = GrossCreditInputs & {
  /** Current-year regular federal income-tax liability (before credits). */
  regularTax: number;
  /** Top marginal ordinary rate as a decimal (e.g. 0.24) — prices the lost deduction. */
  marginalRate: number;
  /** §280C(c)(2) reduced-credit election made? */
  elect280C: boolean;
  /**
   * Credit elected toward employer FICA under §41(h) this year. Elected
   * dollars cannot offset income tax or enter the GBC carryforward (IRS
   * Form 3800 instructions), so the income-tax path below runs on
   * gross − elected. Clamped to [0, gross].
   */
  electedToPayroll?: number;
};

export type IncomePath280CBranch = {
  /** Credit claimed under this branch, before the §38(c) ceiling. */
  claimed: number;
  /** Credit actually applied against this year's tax. */
  used: number;
  /** GBC carryover to future years (§39(a)) — 1-year back, 20-year forward. */
  carriedForward: number;
  /** §174A deduction reduction this branch forces (§280C(c)(1)). */
  deductionReduction: number;
  /** This-year federal cash effect: used − marginalRate × deductionReduction. */
  netBenefit: number;
};

export type IncomePathResult = GrossCreditResult & {
  /** The §41(a) credit after the §41(h) payroll-election split. */
  incomeGross: number;
  /** Echo of the elected amount actually applied (clamped). */
  electedToPayroll: number;
  ceiling: number;
  /** Does the §38(c) ceiling leave part of the claimed credit unused this year? */
  ceilingBinds: boolean;
  /** The branch the election toggle selected. */
  selected: IncomePath280CBranch;
  /** The other branch, for the head-to-head display. */
  alternative: IncomePath280CBranch;
  /**
   * selected.netBenefit − alternative.netBenefit. Positive → the selected
   * election choice is the right one at this marginal rate; ≈ incomeGross ×
   * (rate − 21%) when the ceiling does not bind.
   */
  electionAdvantage: number;
};

/**
 * The income-tax share of the §41 credit through both §280C(c) branches.
 * The §41(h) payroll split happens FIRST: incomeGross = gross − elected
 * (elected amounts are barred from the income tax and its carryforwards per
 * the Form 3800 instructions). Then:
 *
 *   Full credit (no election):  claim incomeGross; §174A deduction reduced by
 *     the credit allowed (§280C(c)(1), as rewritten by OBBBA §70302(b)(2)(B) —
 *     the pre-OBBBA text said "determined"; the difference only matters when
 *     the ceiling binds, and this model reduces by the allowed amount).
 *   Reduced credit (election): claim incomeGross × (1 − 21%); deduction
 *     untouched (§280C(c)(2)).
 *
 * Both branches are then capped by the §38(c) ceiling; excess carries forward
 * (§39). Net benefit nets the cash credit against the deduction's tax value
 * at the entered marginal rate and ignores carryover value — deliberately
 * conservative for the branch comparison.
 */
export function evaluateIncomePath(inputs: IncomePathInputs): IncomePathResult {
  const gross = computeGrossCredit(inputs);
  const electedToPayroll = Math.min(Math.max(0, inputs.electedToPayroll ?? 0), gross.grossCredit);
  const incomeGross = gross.grossCredit - electedToPayroll;
  const ceiling = gbcCeiling(inputs.regularTax);
  const r = Math.min(Math.max(inputs.marginalRate, 0), 1);

  const branch = (elect: boolean): IncomePath280CBranch => {
    const claimed = elect ? incomeGross * (1 - RDC_CONSTANTS.corpMaxRate) : incomeGross;
    const used = Math.min(claimed, ceiling);
    const carriedForward = Math.max(0, claimed - ceiling);
    // §280C(c)(1): without the election the deduction falls by the credit
    // allowed; with it, by nothing.
    const deductionReduction = elect ? 0 : used;
    return { claimed, used, carriedForward, deductionReduction, netBenefit: used - r * deductionReduction };
  };

  const election = branch(true);
  const noElection = branch(false);
  const selected = inputs.elect280C ? election : noElection;
  const alternative = inputs.elect280C ? noElection : election;

  return {
    ...gross,
    incomeGross,
    electedToPayroll,
    ceiling,
    ceilingBinds: ceiling < selected.claimed - 1e-9,
    selected,
    alternative,
    electionAdvantage: selected.netBenefit - alternative.netBenefit,
  };
}

/* ========================= Payroll path (§41(h)) ========================== */

export type PayrollPathInputs = GrossCreditInputs & {
  /** Annual W-2 wages subject to employer FICA (drives the offset capacity). */
  ficaWages: number;
  /** Top marginal ordinary rate as a decimal — prices the lost FICA deduction. */
  marginalRate: number;
  /**
   * The §41(h) election amount for the year (≤ min(credit, $500,000)).
   * Omit to elect the maximum. The same dollars are removed from the
   * income-tax path — pass the identical value to evaluateIncomePath.
   */
  elected?: number;
};

export type PayrollPathResult = GrossCreditResult & {
  /** min(gross credit, $500,000) — the §41(h)(2)(B) election ceiling. */
  electable: number;
  /** The election amount in force (clamped into [0, electable]). */
  elected: number;
  /** Employer OASDI (6.2%) on the entered wages (§3111(a)). */
  employerOasdiTax: number;
  /** Employer Medicare (1.45%) on the entered wages (§3111(b)). */
  employerHiTax: number;
  /** Total employer FICA the credit can absorb this year. */
  offsetCapacity: number;
  /** Elected credit applied against payroll tax this year (Form 8974, quarterly). */
  appliedThisYear: number;
  /** Elected amount left after this year's FICA — carries to later employment-tax returns. */
  remainingElected: number;
  /**
   * Net cash value of appliedThisYear: the offset is dollar-for-dollar, but
   * employer FICA not paid is also not deductible — net of the entered
   * marginal rate. The separate §280C §174A-deduction question for payroll
   * amounts is flagged in the UI, not modeled (see module header).
   */
  netValue: number;
};

/**
 * The §41(h) payroll-tax election for qualified small businesses (gross
 * receipts ≤ $5M in the credit year and none before the 5-taxable-year period
 * ending with it — §41(h)(3)(B)):
 *
 *   electable      = min(§41 credit, $500,000)              (§41(h)(2)(B))
 *   offset applies to employer SS tax first (up to $250,000 per quarter),
 *   then employer Medicare tax (from tax years beginning after 12/31/2022,
 *   per the IRS QSB payroll-credit page); unused elected amounts carry
 *   forward across employment-tax returns (Form 8974 each quarter, starting
 *   the first quarter after the income-tax return reporting the election is
 *   filed).
 *
 * Per the IRS Form 3800 instructions, no amount elected as a payroll tax
 * credit can offset the current-year income tax or enter the GBC
 * carryforward/carryback — the election SPLITS the credit, which is why the
 * companion income-path call must be given the same `elected` amount.
 *
 * The aggregate annual capacity is employer FICA on the year's wages: 6.2% +
 * 1.45% = 7.65%. The per-employee Social Security wage base ($176,100 for
 * 2025, SSA) is NOT modeled — top-heavy payrolls overstate capacity slightly,
 * which the UI states.
 */
export function evaluatePayrollPath(inputs: PayrollPathInputs): PayrollPathResult {
  const gross = computeGrossCredit(inputs);
  const wages = Math.max(0, inputs.ficaWages);
  const r = Math.min(Math.max(inputs.marginalRate, 0), 1);

  const electable = Math.min(gross.grossCredit, RDC_CONSTANTS.qsbPayrollCap);
  const elected = Math.min(Math.max(0, inputs.elected ?? electable), electable);
  const employerOasdiTax = wages * RDC_CONSTANTS.employerOasdi;
  const employerHiTax = wages * RDC_CONSTANTS.employerHi;
  const offsetCapacity = employerOasdiTax + employerHiTax;
  const appliedThisYear = Math.min(elected, offsetCapacity);

  return {
    ...gross,
    electable,
    elected,
    employerOasdiTax,
    employerHiTax,
    offsetCapacity,
    appliedThisYear,
    remainingElected: Math.max(0, elected - appliedThisYear),
    netValue: appliedThisYear * (1 - r),
  };
}

/* ============================== Sweeps ==================================== */

/**
 * Credit as current-year QRE grows, computed twice for the same base: under
 * the 6% special rule (§41(c)(4)(B) — no QRE in any of the 3 preceding years,
 * which is what a zero prior average means) and under the established
 * 14%-over-base formula (§41(c)(4)(A)) at the entered prior average. The two
 * lines cross where 6%·Q = 14%·(Q − base) ⇔ Q = 7/4 × base = 0.875 × the
 * prior 3-year average — the chart's structural landmark.
 */
export function qreSweep(
  priorAvg3Qre: number,
  fromQre: number,
  toQre: number,
  steps = 81,
): { qre: number; noPriorQre: number; established: number }[] {
  const out: { qre: number; noPriorQre: number; established: number }[] = [];
  for (let i = 0; i < steps; i++) {
    const qre = fromQre + ((toQre - fromQre) * i) / (steps - 1);
    out.push({
      qre,
      noPriorQre: computeGrossCredit({ qre, priorAvg3Qre: 0 }).grossCredit,
      established: computeGrossCredit({ qre, priorAvg3Qre: Math.max(0, priorAvg3Qre) }).grossCredit,
    });
  }
  return out;
}

/**
 * The §280C decision as a function of the top marginal ordinary rate (0–40%):
 * net this-year benefit of the full-credit branch (deduction reduced) vs the
 * reduced-credit branch (79% kept). When the §38(c) ceiling leaves both
 * branches room, the lines cross exactly at the 21% corporate rate — above it
 * the election wins, below it the full credit does. With a binding ceiling
 * the curves come from the full engine, and the crossover moves or vanishes.
 */
export function marginalRateSweep(
  inputs: Omit<IncomePathInputs, 'marginalRate' | 'elect280C'>,
  fromPct = 0,
  toPct = 40,
  steps = 81,
): { ratePct: number; netFullCredit: number; netReducedCredit: number }[] {
  const out: { ratePct: number; netFullCredit: number; netReducedCredit: number }[] = [];
  for (let i = 0; i < steps; i++) {
    const ratePct = fromPct + ((toPct - fromPct) * i) / (steps - 1);
    const full = evaluateIncomePath({ ...inputs, marginalRate: ratePct / 100, elect280C: false });
    const reduced = evaluateIncomePath({ ...inputs, marginalRate: ratePct / 100, elect280C: true });
    out.push({ ratePct, netFullCredit: full.selected.netBenefit, netReducedCredit: reduced.selected.netBenefit });
  }
  return out;
}

// Late-payment cost of trade terms — the "Bill" stage instrument for what an
// invoice's payment window actually costs the business that issued it.
//
// Three costs hide inside "we'll pay you in 30 days":
//   1. Carrying cost  — the time value of the cash you are owed but cannot
//      use: invoice × annual cost of capital × days ÷ 365.
//   2. Bad debt       — the probability-weighted expected loss on invoices
//      that are never collected: invoice × P(default).
//   3. Discount cost  — what an early-payment discount implicitly charges
//      for accelerating the cash (the classic "2/10 net 30" arithmetic).
//
// Provenance & parameter posture — stated deliberately:
//  - NO year-specific statutory constant enters this model. There is no IRS /
//    SSA / statutory parameter for trade terms: "Net-30", "2/10 net 30" and
//    late-fee percentages are CONTRACTUAL market conventions, not law, and
//    the interest rate and default probability are user inputs. The only
//    dated conventions here are day-count choices:
//      · 365-day year (this site's convention, matching the rest of the
//        suite); leap years are ignored — a 0.27% effect, far below the
//        noise in any default-probability estimate.
//      · The 360-day banker's year is quoted alongside wherever the classic
//        textbook figure differs (2/10 net 30 ⇒ 37.2% on 365, 36.7% on 360 —
//        same arithmetic, different day count; see `discountImpliedAnnualized`).
//  - The trade-credit formulas are the standard corporate-finance treatment
//    of the cost of forgoing purchase discounts (e.g., Higgins, "Analysis for
//    Financial Management"; Brealey–Myers–Allen, trade credit chapter). This
//    is textbook market practice, NOT a regulation.
//
// Documented modeling conventions (surfaced on the page's methodology section):
//  - Simple interest, one collection cycle at the stated terms: no
//    compounding of the carrying rate inside a single invoice's life.
//  - Carrying cost is charged on the OUTSTANDING face (the full invoice face
//    when no discount applies; the discounted face when one does) — a
//    deliberately conservative, first-order approximation.
//  - Bad-debt probability accrues UNIFORMLY over the exposure window: paying
//    on day 10 instead of day 30 carries p × (10 ÷ 30) of the default risk.
//    This is a modeling assumption, not an empirical law; the guide states
//    it and the limits section repeats it.
//  - Discount uptake is all-or-none: either the customer takes the early-pay
//    terms or pays at the net term (no partial-uptake blending).

/** Clamp to the non-negative reals — the model has no meaningful negatives. */
function nn(n: number): number {
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/** Clamp a percent into [0, 100] before it becomes a probability. */
function clampPct(pctValue: number): number {
  if (!Number.isFinite(pctValue)) return 0;
  return Math.min(Math.max(pctValue, 0), 100);
}

/**
 * Carrying cost of one invoice — the time-value price of waiting.
 *
 * Formula: `carry = A × r × days ÷ 365`
 *
 * A is the outstanding face, r the annual cost of capital (percent — a
 * credit-line APR, a factoring rate, or an opportunity cost of capital),
 * days the payment window. Simple interest, charged on the face (see the
 * file-header convention). Basis: standard time-value-of-money arithmetic —
 * market convention, not statute.
 */
export function carryingCost(invoiceAmount: number, annualRatePct: number, days: number): number {
  return nn(invoiceAmount) * (nn(annualRatePct) / 100) * (nn(days) / 365);
}

/**
 * Expected bad-debt loss on one invoice.
 *
 * Formula: `E[loss] = A × P(default)`
 *
 * The probability is the blended per-invoice default rate across the book —
 * historically, dollars written off ÷ dollars billed. Clamped to [0, 100]%.
 */
export function badDebtLoss(invoiceAmount: number, badDebtPct: number): number {
  return nn(invoiceAmount) * (clampPct(badDebtPct) / 100);
}

/**
 * Expected realizable value of one invoice — face net of expected default.
 *
 * Formula: `E[A] = A × (1 − P(default))`
 */
export function expectedReceipt(invoiceAmount: number, badDebtPct: number): number {
  return nn(invoiceAmount) - badDebtLoss(invoiceAmount, badDebtPct);
}

/**
 * Expected cost of the payment terms, as a percent of invoice face — a
 * PER-CYCLE figure, not an annualized rate:
 *
 * Formula: `cost% = (days ÷ 365) × r + P(default)`
 *
 * Two components added on the same "per invoice, per collection cycle" basis:
 * the carrying drag (proportional to the window and the capital rate) and the
 * default expectation (a flat per-invoice charge). Read it as "cents per
 * dollar of face, per collection cycle": a book that bills continuously puts
 * each sales dollar through exactly one cycle, so this is also the share of
 * ANNUAL SALES the terms consume — but it is not an APR, and must not be
 * multiplied by cycles per year to manufacture one (a sales dollar bears this
 * cost once, not 365 ÷ N times).
 */
export function expectedTermsCostPct(netDays: number, annualRatePct: number, badDebtPct: number): number {
  return (nn(netDays) / 365) * nn(annualRatePct) + clampPct(badDebtPct);
}

/**
 * Average receivables outstanding at steady state — the working capital the
 * terms permanently deploy.
 *
 * Formula: `AR = annual billings × DSO ÷ 365`
 *
 * At Net-45 terms, a business billing $600k/yr carries ≈ $74k of its own
 * money parked in customer receivables at all times. (DSO = days sales
 * outstanding, proxied here by the contractual net days.)
 */
export function cashLockedByTerms(annualBillings: number, netDays: number): number {
  return nn(annualBillings) * (nn(netDays) / 365);
}

/**
 * Implied annualized rate of an early-payment discount — the classic
 * "2/10 net 30" arithmetic, derived rather than quoted.
 *
 * Paying `(1 − d) × A` on day D instead of `A` on day N means giving up
 * `d × A` to accelerate `(1 − d) × A` by `(N − D)` days. The per-period
 * return is `d ÷ (1 − d)`; annualized on a 365-day year:
 *
 * Formula: `i = (d ÷ (1 − d)) × (365 ÷ (N − D))`
 *
 * For 2/10 net 30: (2 ÷ 98) × (365 ÷ 20) = 37.24% a year. The 36.7% figure
 * quoted in most textbooks is the SAME arithmetic on the 360-day banker's
 * year — (2 ÷ 98) × (360 ÷ 20) = 36.73% — a day-count choice, nothing more.
 * Both readings are returned by the tool; neither is a statutory rate.
 *
 * @param discountPct    discount as a percent of face (e.g. 2 for "2/10")
 * @param discountDays   days within which the discount applies (e.g. 10)
 * @param netDays        full payment term (e.g. 30)
 * @param yearDays       day-count basis, 365 (site convention) or 360
 * @returns annualized rate in percent; `null` when d ≤ 0, d ≥ 1, or the
 * discount window does not end before the net term (N − D ≤ 0).
 */
export function discountImpliedAnnualized(
  discountPct: number,
  discountDays: number,
  netDays: number,
  yearDays = 365,
): number | null {
  const d = clampPct(discountPct) / 100;
  if (d <= 0 || d >= 1) return null;
  const accelerated = netDays - discountDays;
  if (!(accelerated > 0)) return null;
  return (d / (1 - d)) * (yearDays / accelerated) * 100;
}

/**
 * Boundary discount — the early-pay discount priced EXACTLY at the user's
 * cost of capital for these terms. Solves `discountImpliedAnnualized = r`
 * for the discount:
 *
 * `q = r × (N − D) ÷ 365` → `d* = q ÷ (1 + q)`
 *
 * Offering less than d* accelerates cash more cheaply than the business's
 * own financing; offering more pays an implicit rate above it.
 *
 * @returns discount in percent of face; `null` when the window is inverted.
 */
export function breakevenDiscount(annualRatePct: number, discountDays: number, netDays: number): number | null {
  const span = netDays - discountDays;
  if (!(span > 0)) return null;
  const q = (nn(annualRatePct) / 100) * (span / 365);
  return (q / (1 + q)) * 100;
}

/**
 * Boundary net term — how long the full term can stretch before this
 * discount's implied annualized rate falls to the user's cost of capital.
 * Solves `discountImpliedAnnualized = r` for N:
 *
 * `N* = D + (d ÷ (1 − d)) × 365 ÷ r`
 *
 * For 2/10 at an 8% cost of capital, N* ≈ 103 days: "2/10 net 103" would be
 * exactly fair priced at 8% — which is why 2/10 net 30, at 37%, is such an
 * expensive trade for the party granting it.
 *
 * @returns net days; `null` when d ≤ 0, d ≥ 1, or r ≤ 0 (at r = 0 any
 * positive discount is over-priced — the boundary is infinite).
 */
export function breakevenNetDays(discountPct: number, discountDays: number, annualRatePct: number): number | null {
  const d = clampPct(discountPct) / 100;
  if (d <= 0 || d >= 1) return null;
  const r = nn(annualRatePct) / 100;
  if (!(r > 0)) return null;
  return discountDays + (d / (1 - d)) * (365 / r);
}

/**
 * Annualized equivalent of a monthly late-fee clause.
 *
 * Formula: simple — `12 × m`; compounded — `(1 + m)^12 − 1`.
 *
 * The market-standard "1.5% per month" is 18.0% simple, 19.6% compounded —
 * contractual convention (common in commercial terms), not a statutory rate.
 */
export function lateFeeAnnualized(monthlyFeePct: number, compound = false): number {
  const m = nn(monthlyFeePct) / 100;
  return compound ? ((1 + m) ** 12 - 1) * 100 : m * 12 * 100;
}

/** Full input bundle for the aggregate readout. */
export type LatePaymentInputs = {
  /** Invoice face amount, dollars. */
  invoiceAmount: number;
  /** Contractual payment window (Net-N), days. */
  netDays: number;
  /** Annual cost of capital, percent (credit line APR, factoring rate, or opportunity cost). */
  annualRatePct: number;
  /** Probability the invoice is never collected, percent — blended across the book. */
  badDebtPct: number;
};

export type LatePaymentResult = {
  /** Invoice face as entered (clamped ≥ 0). */
  invoiceAmount: number;
  /** Net term as entered (clamped ≥ 0). */
  netDays: number;
  /** A × r × days ÷ 365 — the time-value price of waiting. */
  carryingCost: number;
  /** A × P(default) — expected uncollectible dollars. */
  badDebtLoss: number;
  /** A × (1 − P(default)) — probability-weighted realizable value. */
  expectedReceipt: number;
  /** carryingCost + badDebtLoss — the full expected cost of these terms per invoice. */
  totalExpectedCost: number;
  /** totalExpectedCost as a percent of face; `null` when face = 0. */
  totalCostPct: number | null;
  /**
   * Price uplift that restores the expected value: `c ÷ (1 − c)` where c is
   * the cost share. The percent by which the QUOTED price must rise so the
   * expected net equals a same-amount cash sale. `null` when c ≥ 1 (cost
   * swallows the invoice) or face = 0.
   */
  priceUpliftPct: number | null;
  /** A × r ÷ 365 — what each additional day of waiting costs. */
  dailyCarryingCost: number;
  /** (days ÷ 365) × r + P(default) — expected cost per invoice, % of face. */
  expectedTermsCostPct: number;
};

/** Aggregate readout from one input bundle — everything the results card shows. */
export function computeLatePayment(inputs: LatePaymentInputs): LatePaymentResult {
  const A = nn(inputs.invoiceAmount);
  const netDays = nn(inputs.netDays);
  const r = nn(inputs.annualRatePct);
  const p = clampPct(inputs.badDebtPct);

  const carry = carryingCost(A, r, netDays);
  const bd = badDebtLoss(A, p);
  const receipt = expectedReceipt(A, p);
  const total = carry + bd;

  const c = A > 0 ? total / A : null;

  return {
    invoiceAmount: A,
    netDays,
    carryingCost: carry,
    badDebtLoss: bd,
    expectedReceipt: receipt,
    totalExpectedCost: total,
    totalCostPct: c === null ? null : c * 100,
    priceUpliftPct: c === null || c >= 1 ? null : (c / (1 - c)) * 100,
    dailyCarryingCost: A * (r / 100) / 365,
    expectedTermsCostPct: expectedTermsCostPct(netDays, r, p),
  };
}

/** One leg of the discount comparison (with or without the early-pay terms). */
export type DiscountLeg = {
  /** Dollars outstanding on this leg: full face, or the discounted face. */
  face: number;
  /** Effective default probability over THIS leg's exposure window, percent. */
  effectiveBadDebtPct: number;
  expectedReceipt: number;
  carryingCost: number;
  /** expectedReceipt − carryingCost — the leg's expected net value. */
  netExpectedValue: number;
};

export type DiscountEvaluation = {
  discountPct: number;
  discountDays: number;
  netDays: number;
  /** Days of waiting removed when the discount is taken (N − D); `null` if the window is inverted. */
  daysAccelerated: number | null;
  /** Implied annualized rate on the 365-day basis, percent; `null` when undefined. */
  impliedAnnualizedPct: number | null;
  /** Same rate on the 360-day banker's basis — the textbook's 36.7% for 2/10 net 30. */
  impliedAnnualizedPct360: number | null;
  /** Terms as offered, paid at the net date (full face, full exposure window). */
  baseline: DiscountLeg;
  /** Early-pay terms taken: discounted face, shortened exposure window. */
  discounted: DiscountLeg;
  /** Expected value of OFFERING the discount (discounted − baseline), dollars per invoice. */
  netAdvantage: number;
  /** Dollars of face surrendered when the discount is taken (A × d). */
  faceGivenUp: number;
  /** Bad-debt expectation removed by the shorter window (baseline loss − discounted loss). */
  riskRelief: number;
  /** Carrying cost removed by the shorter window (baseline carry − discounted carry). */
  carryingRelief: number;
  /** Discount % priced exactly at the user's cost of capital for these terms. */
  breakevenDiscountPct: number | null;
  /** Net days at which this discount's implied rate equals the user's cost of capital. */
  breakevenNetDays: number | null;
};

/**
 * Should the business offer (or take) an early-payment discount? Full
 * expected-value comparison of the two collection paths for one invoice:
 *
 *   baseline    — face A received at day N, default probability p, carrying
 *                 at the user's annual rate over N days on A;
 *   discounted  — face A(1−d) received at day D, default probability
 *                 p × (D ÷ N) (uniform risk accrual — a stated assumption),
 *                 carrying over D days on the discounted face.
 *
 * Accounting identity (holds to the cent): `netAdvantage = −faceGivenUp +
 * riskRelief + carryingRelief`. A positive netAdvantage means OFFERING the
 * discount is expected-positive at these numbers; negative means the 2%
 * give-back outweighs the risk and carrying relief.
 *
 * The BUYER's question ("should I take 2/10 net 30?") reads the same implied
 * rate from the other side: taking it earns the implied annualized rate on
 * cash spent 20 days early.
 */
export function evaluateEarlyPayDiscount(
  inputs: LatePaymentInputs,
  discountPct: number,
  discountDays: number,
): DiscountEvaluation {
  const A = nn(inputs.invoiceAmount);
  const N = nn(inputs.netDays);
  const r = nn(inputs.annualRatePct);
  const p = clampPct(inputs.badDebtPct) / 100;
  const d = clampPct(discountPct) / 100;
  const D = nn(discountDays);

  // Uniform risk accrual over the exposure window; the whole risk when the
  // window is degenerate (N = 0 or D ≥ N — the guard state callers flag).
  const earlyP = N > 0 && D < N ? p * (D / N) : p;

  const baselineReceipt = A * (1 - p);
  const baselineCarry = carryingCost(A, r, N);
  const baseline: DiscountLeg = {
    face: A,
    effectiveBadDebtPct: p * 100,
    expectedReceipt: baselineReceipt,
    carryingCost: baselineCarry,
    netExpectedValue: baselineReceipt - baselineCarry,
  };

  const discFace = A * (1 - d);
  const discReceipt = discFace * (1 - earlyP);
  const discCarry = carryingCost(discFace, r, D);
  const discounted: DiscountLeg = {
    face: discFace,
    effectiveBadDebtPct: earlyP * 100,
    expectedReceipt: discReceipt,
    carryingCost: discCarry,
    netExpectedValue: discReceipt - discCarry,
  };

  return {
    discountPct: d * 100,
    discountDays: D,
    netDays: N,
    daysAccelerated: N - D > 0 ? N - D : null,
    impliedAnnualizedPct: discountImpliedAnnualized(d * 100, D, N, 365),
    impliedAnnualizedPct360: discountImpliedAnnualized(d * 100, D, N, 360),
    baseline,
    discounted,
    netAdvantage: discounted.netExpectedValue - baseline.netExpectedValue,
    faceGivenUp: A * d,
    riskRelief: A * p - discFace * earlyP,
    carryingRelief: baseline.carryingCost - discounted.carryingCost,
    breakevenDiscountPct: breakevenDiscount(r, D, N),
    breakevenNetDays: breakevenNetDays(d * 100, D, r),
  };
}

/** One point of the terms-cost curve. */
export type TermsCostPoint = {
  days: number;
  carryingCost: number;
  badDebtLoss: number;
  totalCost: number;
  /** totalCost as % of face; `null` when face = 0. */
  totalCostPct: number | null;
};

/**
 * Expected cost of the terms as the payment window scans a band — the
 * terms-cost curve. Each point re-solves the full model (carrying + expected
 * default) at that day count; the curve is a straight line in days with
 * slope A × r ÷ 365 and an intercept of A × P(default) at day zero.
 *
 * @param fromDays band start (default 0)
 * @param toDays   band end (default 120)
 * @param steps    evenly spaced points (default 25, min 2)
 */
export function termsCostSweep(
  inputs: LatePaymentInputs,
  fromDays = 0,
  toDays = 120,
  steps = 25,
): TermsCostPoint[] {
  const A = nn(inputs.invoiceAmount);
  const r = nn(inputs.annualRatePct);
  const p = clampPct(inputs.badDebtPct);
  const lo = nn(fromDays);
  const hi = Math.max(nn(toDays), lo);
  const n = Math.max(2, Math.floor(steps));
  const out: TermsCostPoint[] = [];
  for (let i = 0; i < n; i++) {
    const days = lo + ((hi - lo) * i) / (n - 1);
    const carry = carryingCost(A, r, days);
    const bd = badDebtLoss(A, p);
    out.push({
      days,
      carryingCost: carry,
      badDebtLoss: bd,
      totalCost: carry + bd,
      totalCostPct: A > 0 ? ((carry + bd) / A) * 100 : null,
    });
  }
  return out;
}

/** Standard term presets — the segmented control in the tool. */
export const TERM_PRESETS = [
  { id: 'net15', label: 'Net-15', netDays: 15 },
  { id: 'net30', label: 'Net-30', netDays: 30 },
  { id: 'net60', label: 'Net-60', netDays: 60 },
  { id: 'net90', label: 'Net-90', netDays: 90 },
] as const;

/** Scenario presets: one per billing archetype. */
export type LateFeePreset = {
  id: string;
  /** Short button label. */
  label: string;
  /** What the archetype is (rendered as the preset's hint). */
  description: string;
  inputs: LatePaymentInputs;
};

export const LATEFEE_PRESETS: LateFeePreset[] = [
  {
    id: 'agency',
    label: 'Agency retainer',
    description: '$8,500 monthly retainer on Net-15; 9% credit-line rate; 1% historical write-off rate.',
    inputs: { invoiceAmount: 8500, netDays: 15, annualRatePct: 9, badDebtPct: 1 },
  },
  {
    id: 'b2b',
    label: 'B2B milestone',
    description: '$24,000 project milestone on Net-30; 10% cost of capital; 3% blended default risk.',
    inputs: { invoiceAmount: 24000, netDays: 30, annualRatePct: 10, badDebtPct: 3 },
  },
  {
    id: 'enterprise',
    label: 'Enterprise · Net-60',
    description: '$60,000 software contract on Net-60; 7% opportunity cost of capital; 2% default risk.',
    inputs: { invoiceAmount: 60000, netDays: 60, annualRatePct: 7, badDebtPct: 2 },
  },
];

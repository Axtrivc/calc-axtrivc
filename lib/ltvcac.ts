// SaaS unit economics — the LTV : CAC instrument of the "Sustain" stage:
// what a customer is worth (gross-profit lifetime value), what they cost to
// acquire (blended CAC), whether the two clear the operating benchmarks, and
// how the whole picture bends as churn moves.
//
// Provenance posture — stated deliberately: this is MANAGERIAL FINANCE
// CANON, not statute. There is no IRS/SSA/IRC source for any constant here.
// The formulas are the standard geometric-series treatment of customer
// lifetime value used across SaaS operating practice (popularized by David
// Skok's forEntrepreneurs "SaaS Metrics" series and echoed in Bessemer's
// cloud benchmark work — practitioner canon, not regulation). The two
// "healthy" thresholds (LTV:CAC > 3, payback < 12 months) are INDUSTRY
// RULES OF THUMB, surfaced as such everywhere they appear; they are not
// laws, and the on-page copy says so.
//
// No year-specific parameters enter this model — ARPU, margin, churn and
// spend are all operator inputs, and the only optional dated convention is
// the discount rate (a cost-of-capital choice, defaulted off).
//
// Model semantics (surfaced on the page's methodology section):
//  - LTV is computed on the GROSS-MARGIN basis: each surviving month
//    contributes ARPU × gross margin, not ARPU. A revenue-basis LTV (ARPU ÷
//    churn) overstates value by exactly 1/margin − 1 (25% at an 80% margin)
//    because it ignores the cost of serving the customer. Both are returned
//    so the tool can show the size of that overstatement.
//  - Survival is geometric with constant monthly churn c: a customer
//    beginning month k with probability (1−c)^(k−1). Expected lifetime is
//    1/c months; expected number of paying months is 1/c. Constant ARPU and
//    constant churn across the whole life — no expansion revenue, no cohort
//    drift, no seasonal churn (NRR = 100% by construction).
//  - Payments are modeled at month END. With a monthly discount rate d, the
//    discounted LTV collapses to ARPU×margin ÷ (c + d) — the discount rate
//    simply adds to churn. At d = 0 this reduces exactly to the
//    undiscounted formula.
//  - CAC is blended: total monthly S&M spend ÷ new customers won that
//    month, organic included. Paid-only CAC is a different (larger) number
//    and is discussed in the guide, not modeled.
//  - Churn of exactly 0 gives an infinite expected lifetime: the model
//    returns null for LTV there rather than inventing a number (the
//    discounted variant stays finite: ARPU×margin ÷ d, a perpetuity).

/** Clamp to the non-negative reals — the model has no meaningful negatives. */
function nn(n: number): number {
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/** Percent → fraction, clamped to [0, 1] (a 120% entry is read as 100%). */
function pctFrac(p: number): number {
  const v = nn(p) / 100;
  return Math.min(1, v);
}

/** Industry rule of thumb for a healthy LTV:CAC ratio — NOT a law. */
export const RATIO_HEALTHY = 3;
/** Industry rule of thumb for a healthy CAC payback, in months — NOT a law. */
export const PAYBACK_HEALTHY_MONTHS = 12;

/** Full input bundle — every figure stated per month. */
export type LtvCacInputs = {
  /** Average revenue per user per month ($/mo). For flat-rate products this is simply the monthly fee. */
  arpu: number;
  /** Gross margin as a percentage (0–100): (revenue − COGS) ÷ revenue. */
  grossMarginPct: number;
  /** Monthly logo churn as a percentage (0–100): share of customers cancelling each month. */
  churnPct: number;
  /** Sales & marketing spend per month ($/mo) — blended across paid and organic. */
  smSpend: number;
  /** New customers acquired per month with that spend. */
  newCustomers: number;
};

export type LtvCacResult = {
  /** Monthly gross profit per customer: ARPU × margin. The unit of LTV accumulation. */
  monthlyGrossProfit: number;
  /** Expected customer lifetime 1/c in months; null when churn is 0 (unbounded). */
  lifetimeMonths: number | null;
  /** LTV on the gross-margin basis: ARPU × margin ÷ churn. null when churn is 0. */
  ltv: number | null;
  /** Blended CAC: S&M spend ÷ new customers. null when new customers ≤ 0 (undefined). */
  cac: number | null;
  /** LTV:CAC ratio; null when either side is undefined or CAC is 0 (nothing spent). */
  ratio: number | null;
  /** Simple CAC payback in months: CAC ÷ monthly gross profit. Churn-independent; null when gross profit ≤ 0. */
  paybackMonths: number | null;
  /**
   * Churn-adjusted CAC payback in months: solves
   * A × (1 − (1−c)^n) ÷ c = CAC for n, so customers lost before payback are
   * priced in. Always ≥ the simple payback; null when the math never
   * recovers the CAC in expectation (CAC × churn ≥ gross profit, i.e. LTV
   * ≤ CAC) or when inputs are undefined.
   */
  paybackChurnAdjusted: number | null;
  /** LTV on the WRONG (revenue) basis: ARPU ÷ churn. Returned to quantify the overstatement. */
  ltvRevenueBasis: number | null;
  /** How much the revenue basis overstates the gross basis: (1/margin − 1) × 100. null when margin or churn is 0. */
  revenueBasisOverstatementPct: number | null;
  /** Churn annualized: (1 − (1−c)^12) × 100. 0 when monthly churn is 0. */
  annualChurnPct: number;
  /** True when S&M spend is 0 — CAC is trivially 0 and every ratio readout is vacuous. */
  zeroSpend: boolean;
  /** True when monthly churn is 0 — lifetime is unbounded and LTV is undefined (infinite). */
  zeroChurn: boolean;
};

/**
 * Monthly gross profit per customer — the amount each surviving month
 * contributes to LTV.
 *
 * Formula: `A = ARPU × (margin ÷ 100)`
 */
export function monthlyGrossProfitPerCustomer(arpu: number, grossMarginPct: number): number {
  return nn(arpu) * pctFrac(grossMarginPct);
}

/**
 * Monthly discount rate from an annual rate — compound convention.
 *
 * Formula: `d = (1 + r)^(1/12) − 1`
 *
 * E.g. 12%/yr → ≈0.949%/mo. Returns 0 for a 0 (or invalid) annual rate.
 */
export function monthlyDiscountRate(annualPct: number): number {
  const r = nn(annualPct) / 100;
  if (r <= 0) return 0;
  return Math.pow(1 + r, 1 / 12) - 1;
}

/**
 * Churn annualized — what a monthly logo-churn rate compounds to over a year.
 *
 * Formula: `annual = (1 − (1 − c)^12) × 100`
 *
 * (3%/mo is ≈30.6%/yr, not 36% — churn compounds.)
 */
export function annualizedChurn(churnPct: number): number {
  const c = pctFrac(churnPct);
  if (c <= 0) return 0;
  return (1 - Math.pow(1 - c, 12)) * 100;
}

/**
 * The full unit-economics readout from one input bundle — everything the UI
 * shows. All formulas per the file header; null means "undefined here", never
 * a silent zero.
 */
export function computeLtvCac(inputs: LtvCacInputs): LtvCacResult {
  const arpu = nn(inputs.arpu);
  const margin = pctFrac(inputs.grossMarginPct);
  const churn = pctFrac(inputs.churnPct);
  const spend = nn(inputs.smSpend);
  const news = nn(inputs.newCustomers);

  const a = arpu * margin;
  const zeroChurn = churn <= 0;
  const zeroSpend = spend <= 0;

  const lifetimeMonths = zeroChurn ? null : 1 / churn;
  const ltv = zeroChurn ? null : a / churn;
  const cac = news > 0 ? spend / news : null;

  const ratio = ltv !== null && cac !== null && cac > 0 ? ltv / cac : null;
  const paybackMonths = cac !== null && a > 0 ? cac / a : null;

  // Churn-adjusted payback: A(1 − (1−c)^n)/c = CAC → n = ln(1 − CAC·c/A) / ln(1−c).
  // Requires CAC·c < A (strictly) — at CAC·c = A the customer pool's expected
  // gross profit saturates exactly AT the CAC (LTV = CAC) and payback diverges.
  let paybackChurnAdjusted: number | null = null;
  if (cac !== null && a > 0 && !zeroChurn) {
    const k = (cac * churn) / a;
    if (k < 1 - 1e-12) {
      paybackChurnAdjusted = Math.log(1 - k) / Math.log(1 - churn);
    }
  }

  const ltvRevenueBasis = zeroChurn ? null : arpu / churn;
  const revenueBasisOverstatementPct =
    zeroChurn || margin <= 0 ? null : (1 / margin - 1) * 100;

  return {
    monthlyGrossProfit: a,
    lifetimeMonths,
    ltv,
    cac,
    ratio,
    paybackMonths,
    paybackChurnAdjusted,
    ltvRevenueBasis,
    revenueBasisOverstatementPct,
    annualChurnPct: annualizedChurn(inputs.churnPct),
    zeroSpend,
    zeroChurn,
  };
}

/**
 * Discounted LTV — the gross-margin LTV with time value of money, at an
 * annual discount rate (cost of capital; WACC-ish 8–15% is typical practice).
 *
 * Formula: `LTV_d = ARPU × margin ÷ (churn + d)`, with `d = (1+r)^(1/12) − 1`
 *
 * Derivation: end-of-month payments, geometric survival — the series
 * Σ A(1−c)^(k−1)/(1+d)^k sums to A/(c+d). At r = 0 this is exactly the
 * undiscounted LTV; at churn = 0 it degenerates to the perpetuity A/d.
 *
 * @returns discounted LTV in dollars; null when churn and d are both 0
 * (nothing ever discounts an infinite stream).
 */
export function discountedLtv(inputs: LtvCacInputs, annualDiscountPct: number): number | null {
  const a = monthlyGrossProfitPerCustomer(inputs.arpu, inputs.grossMarginPct);
  const denom = pctFrac(inputs.churnPct) + monthlyDiscountRate(annualDiscountPct);
  if (denom <= 0) return null;
  return a / denom;
}

/**
 * The churn at which LTV:CAC crosses a target ratio — inverted closed form.
 *
 * From `A/(c·CAC) = target` → `c* = A ÷ (target × CAC)`
 *
 * The "how good can churn get us" boundary: below c* the ratio clears the
 * target, above it, it does not.
 *
 * DOMAIN WARNING: the raw inversion is returned unclamped — with a very cheap
 * CAC it can exceed 100%/mo, which is not an achievable churn rate. A return
 * above 100 means the ratio stays above the target at EVERY possible churn;
 * callers must present that case as "no churn rate drops below the target",
 * never as a reachable threshold.
 *
 * @returns churn in percent (unclamped — see domain warning); null when gross
 * profit or CAC is undefined/zero.
 */
export function churnAtRatio(inputs: LtvCacInputs, targetRatio: number): number | null {
  const a = monthlyGrossProfitPerCustomer(inputs.arpu, inputs.grossMarginPct);
  const cac = nn(inputs.newCustomers) > 0 ? nn(inputs.smSpend) / nn(inputs.newCustomers) : null;
  const t = nn(targetRatio);
  if (a <= 0 || cac === null || cac <= 0 || t <= 0) return null;
  return (a / (t * cac)) * 100;
}

/**
 * The churn at which churn-adjusted payback crosses `months` months — found
 * by bisection on the payback function, which is strictly increasing in churn.
 *
 * Payback rises from its c → 0 limit CAC/A (the simple payback, in months)
 * and is unbounded above: as churn → A/CAC the adjusted payback diverges
 * (LTV → CAC). A crossing exists iff the SIMPLE payback is below `months`.
 *
 * @returns churn in percent; null when no crossing exists (payback is already
 * ≥ months at any churn, or inputs are undefined).
 */
export function churnAtPayback(inputs: LtvCacInputs, months: number): number | null {
  const base = computeLtvCac(inputs);
  if (base.paybackMonths === null || base.cac === null || base.monthlyGrossProfit <= 0) return null;
  if (base.paybackMonths >= months) return null;

  const paybackAt = (churnPct: number) =>
    computeLtvCac({ ...inputs, churnPct }).paybackChurnAdjusted;

  // Bracket: payback rises from the simple payback (c→0) toward +∞ at the
  // LTV=CAC churn. Bisect on that monotone gap.
  let lo = 1e-6;
  let hi = Math.min(99.9999, (base.monthlyGrossProfit / base.cac) * 100 * 0.999999);
  const pHi = paybackAt(hi);
  if (pHi === null || pHi < months) return null;
  for (let i = 0; i < 80; i++) {
    const mid = (lo + hi) / 2;
    const p = paybackAt(mid);
    if (p === null || p >= months) hi = mid;
    else lo = mid;
  }
  return (lo + hi) / 2;
}

/** One row of the churn-sensitivity strip: everything re-solved at churn × multiplier. */
export type ChurnSensitivityRow = {
  multiplier: number;
  /** The churn actually modeled, in percent (clamped below 100). */
  churnPct: number;
  ltv: number | null;
  ratio: number | null;
  paybackChurnAdjusted: number | null;
};

/**
 * Churn sensitivity — the hyperbola made visible. Re-solves the full model at
 * churn × each multiplier, everything else fixed. Because LTV = A/c, the LTV
 * and ratio columns at multiplier m are exactly 1/m × their base values (halve
 * churn, double LTV) — the table demonstrates that identity rather than merely
 * claiming it. The payback column does NOT scale that way: churn-adjusted
 * payback is bounded below by the simple payback CAC/A and converges to it as
 * churn → 0, so halving churn improves it only slightly at low churn.
 */
export function churnSensitivity(
  inputs: LtvCacInputs,
  multipliers: readonly number[] = [0.5, 0.75, 1, 1.5, 2],
): ChurnSensitivityRow[] {
  return multipliers.map((m) => {
    const churnPct = Math.min(inputs.churnPct * m, 99.9999);
    const r = computeLtvCac({ ...inputs, churnPct });
    return { multiplier: m, churnPct, ltv: r.ltv, ratio: r.ratio, paybackChurnAdjusted: r.paybackChurnAdjusted };
  });
}

/** One point of the churn scan that drives the charts. */
export type ChurnScanPoint = {
  churnPct: number;
  ltv: number | null;
  ratio: number | null;
  paybackChurnAdjusted: number | null;
};

/**
 * Scan the model across a churn band (in percent) — the data behind both the
 * LTV:CAC-vs-churn and payback-vs-churn charts. Each point is a full
 * `computeLtvCac` re-solve, not an approximation.
 */
export function churnScan(
  inputs: LtvCacInputs,
  fromPct: number,
  toPct: number,
  steps = 49,
): ChurnScanPoint[] {
  const lo = Math.max(0.01, nn(fromPct));
  const hi = Math.max(lo + 0.01, nn(toPct));
  const out: ChurnScanPoint[] = [];
  for (let i = 0; i < steps; i++) {
    const churnPct = lo + ((hi - lo) * i) / (steps - 1);
    const r = computeLtvCac({ ...inputs, churnPct });
    out.push({
      churnPct,
      ltv: r.ltv,
      ratio: r.ratio,
      paybackChurnAdjusted: r.paybackChurnAdjusted,
    });
  }
  return out;
}

/**
 * Default scan band around a churn level: wide enough to show the hyperbola's
 * shape AND to contain the "halved churn" comparison point — from ¼ of the
 * current churn (floored at 0.1%) to 3× it, with a minimum 4.9pp span so tiny
 * churn rates still get a readable curve.
 */
export function scanBand(churnPct: number): { from: number; to: number } {
  const c = nn(churnPct);
  const from = Math.max(0.1, c * 0.25);
  const to = Math.max(c * 3, from + 4.9);
  return { from, to };
}

/** Scenario presets: one per acquisition motion, stated per month. */
export type LtvCacPreset = {
  id: string;
  /** Short button label. */
  label: string;
  /** What the archetype is (rendered as the preset's hint). */
  description: string;
  inputs: LtvCacInputs;
};

export const LTV_CAC_PRESETS: LtvCacPreset[] = [
  {
    id: 'reference',
    label: 'Reference case',
    description:
      'The clean-numbers profile used throughout the guide: $100 ARPU, 80% margin, 4%/mo churn, $24k S&M buying 120 customers/mo.',
    inputs: { arpu: 100, grossMarginPct: 80, churnPct: 4, smSpend: 24000, newCustomers: 120 },
  },
  {
    id: 'smb',
    label: 'Self-serve SMB SaaS',
    description:
      '$79 self-serve plan, 82% margin, 3.2%/mo logo churn; $18k/mo of mostly product-led spend winning 90 customers.',
    inputs: { arpu: 79, grossMarginPct: 82, churnPct: 3.2, smSpend: 18000, newCustomers: 90 },
  },
  {
    id: 'midmarket',
    label: 'Sales-led mid-market',
    description:
      '$240/mo seats (~$2.9k ACV), 80% margin, 1.2%/mo churn; $120k/mo of sales capacity winning 24 accounts — expensive but sticky.',
    inputs: { arpu: 240, grossMarginPct: 80, churnPct: 1.2, smSpend: 120000, newCustomers: 24 },
  },
  {
    id: 'leaky',
    label: 'Leaky bucket',
    description:
      '$59 prosumer plan, 70% margin, 6%/mo churn; $25k/mo winning 100 customers — acquisition works, retention quietly undoes it.',
    inputs: { arpu: 59, grossMarginPct: 70, churnPct: 6, smSpend: 25000, newCustomers: 100 },
  },
];

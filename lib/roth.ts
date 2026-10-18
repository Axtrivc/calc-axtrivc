// Roth vs Traditional retirement-account model — tax year 2025.
//
// Stage 4 of the suite workflow ("Compensate yourself"): the retirement-account
// twin of the "which vehicle" question. One dial decides it — the tax rate you
// avoid today versus the rate you pay at withdrawal — and this module computes
// everything that dial implies under two explicitly separated framings:
//
//   Framing A — EQUAL PRE-TAX OUTLAY (the decision-relevant comparison).
//     Both strategies consume the same pre-tax income each year. A Traditional
//     contribution of C is pre-tax, so it costs C of pre-tax income. To spend
//     the same pre-tax income, the Roth contributor pays tax first and only
//     C·(1 − t_now) lands in the account:
//       tradSpendable = C · G · (1 − t_ret)
//       rothSpendable = C · (1 − t_now) · G          …G = annuity-due factor
//       Δ = C · G · (t_ret − t_now)                  …Roth wins iff t_ret > t_now
//     Under flat rates the break-even is exactly t_ret = t_now.
//
//   Framing B — EQUAL NOMINAL CONTRIBUTION (the contribution-limit view).
//     Both accounts receive the same nominal C (this is how limits actually
//     bind: the 2025 IRA limit is $7,000 of either flavor):
//       tradSpendable = C · G · (1 − t_ret)   (same account as framing A)
//       rothSpendable = C · G                 (all of it spendable)
//       Δ_limit = C · G · t_ret > 0 whenever t_ret > 0
//     IMPORTANT: this framing ignores that the Roth dollars cost 1/(1 − t_now)
//     more pre-tax income — the edge it shows is produced by the framing, not
//     the investment. Its one legitimate use: limits are nominal, so at the
//     limit a Roth slot shelters more spendable value than a Traditional slot
//     (see the article's "equal rates" section for the full mechanism).
//
// 2025 federal parameters (source & nature stated per constant):
//   - IRA contribution limit ................ $7,000 (IRS COLA notice —
//     News Release IR-2024-285, Nov 1 2024; unchanged from 2024). The limit is
//     aggregate across ALL of a person's Roth + Traditional IRAs.
//   - IRA age-50 catch-up ................... $1,000 (statutory: IRC
//     §219(b)(5)(B); not inflation-indexed in $100 steps — has stayed $1,000).
//   - 401(k) §402(g) deferral limit ......... $23,500 (IRS Notice 2024-80).
//   - 401(k) catch-up, 50+ .................. $7,500 (IRC §414(v); COLA per
//     Notice 2024-80).
//   - 401(k) enhanced catch-up, ages 60–63 .. $11,250 (statutory: SECURE 2.0
//     §109, 150% × $7,500; replaces, does not stack with, the 50+ catch-up).
//   - Roth IRA direct-contribution MAGI phase-out (2025, IRS News Release
//     IR-2024-285): single/HoH $150k–$165k, MFJ $236k–$246k. MFS
//     (living together) $0–$10k is statutory (IRC §408A(c)(3)) and not
//     indexed. A Roth 401(k) has NO income phase-out at any MAGI.
//
// Simplified, illustrative model — NOT tax advice:
//   - Constant annual return, contributions at the START of each year
//     (annuity-due; this year's dollar compounds all n years).
//   - t_now is the MARGINAL rate on the dollars in question; t_ret is ONE flat
//     rate applied to the ENTIRE Traditional balance at withdrawal. Real
//     withdrawals stack on the standard deduction and fill brackets bottom-up,
//     so the true average rate is usually below the retiree's top bracket —
//     the guide flags this asymmetry rather than modeling brackets here.
//   - No RMDs (Traditional forces distributions from age 73/75; Roth IRAs
//     never, Roth 401(k)s not since 2024), no state tax, no Early-withdrawal
//     penalties, no saver's credit, no Traditional-IRA deductibility phase-in.
//   - Rate inputs are percentages (24 → 0.24) and are clamped to [0, 85].

/* ========================= 2025 federal parameters ======================== */

export const ROTH_CONSTANTS = {
  /** IRA contribution limit, 2025 (IRS News Release IR-2024-285). Aggregate Roth + Trad. */
  iraLimit: 7_000,
  /** IRA catch-up from age 50 (IRC §219(b)(5)(B); not indexed). */
  iraCatchUp: 1_000,
  /** 401(k) employee deferral limit, 2025 (IRS Notice 2024-80). */
  k401Limit: 23_500,
  /** 401(k) catch-up from age 50 (IRC §414(v); 2025 amount per Notice 2024-80). */
  k401CatchUp: 7_500,
  /** SECURE 2.0 §109 enhanced catch-up, ages 60–63 (statutory 150% × $7,500). */
  k401EnhancedCatchUp: 11_250,
  /** Youngest age eligible for any catch-up. */
  catchUpMinAge: 50,
  /** Age window for the SECURE 2.0 enhanced catch-up (inclusive). */
  enhancedCatchUpMinAge: 60,
  enhancedCatchUpMaxAge: 63,
  /**
   * Roth IRA direct-contribution MAGI phase-out ranges, 2025 (IRS News
   * Release IR-2024-285; MFS band is unindexed IRC §408A(c)(3)).
   * Disclosure-only in this tool — the comparison math never uses them.
   */
  rothMagiPhaseOut: {
    single: { start: 150_000, end: 165_000 },
    mfj: { start: 236_000, end: 246_000 },
    mfs: { start: 0, end: 10_000 },
  },
} as const;

export type AccountType = 'ira' | '401k';
export type FilingStatus = 'single' | 'mfj' | 'mfs';

/* ============================== Rate guards =============================== */

/**
 * Clamp a percentage into [lo, hi]. Non-finite input (NaN / ±Infinity — e.g.
 * a junk deep link) sanitizes to 0 rather than a rail, so garbage never turns
 * into a −20% return or an 85% bracket by accident.
 */
function clampPct(v: number, lo: number, hi: number): number {
  if (!Number.isFinite(v)) return 0;
  return Math.min(hi, Math.max(lo, v));
}

/* ========================== Limits & eligibility ========================== */

/**
 * Catch-up deferral available at `age` (2025):
 *   IRA      50+   → $1,000 (there is no enhanced IRA catch-up)
 *   401(k)   60–63 → $11,250 (SECURE 2.0 §109 — replaces, not adds to, the
 *                     50+ catch-up, which is the greater-of the two)
 *   401(k)   50+   → $7,500
 */
export function catchUpFor(account: AccountType, age: number): number {
  const a = Number.isFinite(age) ? age : 0;
  if (account === 'ira') {
    return a >= ROTH_CONSTANTS.catchUpMinAge ? ROTH_CONSTANTS.iraCatchUp : 0;
  }
  if (
    a >= ROTH_CONSTANTS.enhancedCatchUpMinAge &&
    a <= ROTH_CONSTANTS.enhancedCatchUpMaxAge
  ) {
    return ROTH_CONSTANTS.k401EnhancedCatchUp;
  }
  return a >= ROTH_CONSTANTS.catchUpMinAge ? ROTH_CONSTANTS.k401CatchUp : 0;
}

/**
 * Total employee contribution room at `age` (2025): base limit + catch-up.
 * IRA: $7,000 (+$1,000 at 50+). 401(k): $23,500 (+$7,500 at 50+ / +$11,250 at
 * 60–63). The IRA limit is one bucket shared by Roth and Traditional IRAs
 * together (IRC §219(c)(2)); the 401(k) deferral limit is likewise one bucket
 * shared by Roth and pre-tax deferrals (IRC §402(g)).
 */
export function contributionLimit(
  account: AccountType,
  age: number,
): { base: number; catchUp: number; total: number } {
  const base = account === 'ira' ? ROTH_CONSTANTS.iraLimit : ROTH_CONSTANTS.k401Limit;
  const catchUp = catchUpFor(account, age);
  return { base, catchUp, total: base + catchUp };
}

/**
 * Fraction of the Roth IRA contribution limit still allowed at a given MAGI
 * (2025 phase-out bands): 1 at or below the start, 0 at or above the end,
 * linear (end − MAGI)/(end − start) in between — the shape IRC §408A(c)(3)
 * prescribes and IRS Pub 590-A Worksheet 2-1 computes. This helper returns the
 * un-rounded fraction; the IRS worksheet rounds the final contribution to the
 * nearest $10. A Roth 401(k) is never phased out — callers treat '401k' as
 * always-allowed and do not use this function.
 */
export function rothPhaseOutFraction(magi: number, filing: FilingStatus): number {
  const band = ROTH_CONSTANTS.rothMagiPhaseOut[filing];
  const m = Number.isFinite(magi) ? magi : 0;
  if (m <= band.start) return 1;
  if (m >= band.end) return 0;
  return (band.end - m) / (band.end - band.start);
}

/* ============================ Growth engine =============================== */

/**
 * Annuity-due compound factor: the future value at horizon n of $1 contributed
 * at the START of each of n years, at a constant annual return r —
 *
 *   G = ((1 + r)^n − 1) / r × (1 + r),   and G(r = 0, n) = n
 *
 * (the trailing (1 + r) is the one extra year of compounding every payment
 * gets by going in at the start of its year rather than the end).
 */
export function annuityDueFactor(annualReturnPct: number, years: number): number {
  const r = clampPct(annualReturnPct, -20, 50) / 100;
  const n = Math.min(70, Math.max(0, Number.isFinite(years) ? years : 0));
  if (Math.abs(r) < 1e-9) return n;
  return (((1 + r) ** n - 1) / r) * (1 + r);
}

/**
 * Year-by-year account balance for the cumulative-growth view:
 * balance[k] = C × G(k), k = 0…n (balance[0] = 0 — nothing has gone in yet).
 */
export function balancePath(
  contribution: number,
  annualReturnPct: number,
  years: number,
): { year: number; balance: number }[] {
  const c = Math.max(0, Number.isFinite(contribution) ? contribution : 0);
  const n = Math.min(70, Math.max(0, Math.round(Number.isFinite(years) ? years : 0)));
  const out: { year: number; balance: number }[] = [];
  for (let k = 0; k <= n; k++) {
    out.push({ year: k, balance: c * annuityDueFactor(annualReturnPct, k) });
  }
  return out;
}

/* ============================ Core comparison ============================= */

export type RothInput = {
  /** Marginal tax rate on the dollars being saved, TODAY, in percent (24 → 24%). */
  currentRatePct: number;
  /** The single flat rate assumed to apply to Traditional withdrawals, in percent. */
  retirementRatePct: number;
  /**
   * Annual contribution. Framing A reads this as the pre-tax outlay (what
   * lands in the Traditional account); the Roth account receives
   * (1 − t_now) × it. Framing B puts this same nominal amount in both.
   */
  annualContribution: number;
  /** Years of contributions (also the withdrawal horizon). Clamped to [0, 70]. */
  years: number;
  /** Constant annual return before any tax, in percent. Clamped to [−20, 50]. */
  annualReturnPct: number;
};

export type RothComparison = {
  /** Annuity-due factor G at the given return and horizon. */
  factor: number;
  /** Years actually used after clamping (flags zero/negative deep-link input). */
  effectiveYears: number;

  /* Framing A — equal pre-tax outlay */
  /** Traditional balance at retirement: C × G (never taxed while inside). */
  tradBalance: number;
  /** Roth balance at retirement: C × (1 − t_now) × G. */
  rothBalance: number;
  /** Traditional spendable: balance × (1 − t_ret). */
  tradSpendable: number;
  /** Roth spendable: the whole balance — withdrawals are tax-free. */
  rothSpendable: number;
  /** rothSpendable − tradSpendable = C × G × (t_ret − t_now). */
  advantageRoth: number;
  winner: 'roth' | 'traditional' | 'tie';

  /* Rates actually used & break-even analytics (framing A) */
  /** Current rate after clamping to [0, 85] — out-of-range deep-link input never leaks into outputs. */
  effectiveCurrentRatePct: number;
  /** Retirement rate after clamping to [0, 85]. */
  effectiveRetirementRatePct: number;
  /**
   * Retirement rate at which the two columns tie — exactly the CLAMPED t_now,
   * so a displayed break-even always matches the rate the verdict was computed
   * at (a ?currentRate=999 deep link computes at 85% and reports 85%, not 999%).
   */
  breakevenRetirementRatePct: number;
  /** Dollars of spendable value that move per 1-point move in t_ret: C × G / 100. */
  perPointSwing: number;

  /* Framing B — equal nominal contribution (the limit view) */
  /** Roth spendable when the account receives the full nominal C: C × G. */
  rothSpendableLimitView: number;
  /** C × G × t_ret — the framing-B edge; see the module header's caveat. */
  advantageRothLimitView: number;
};

/**
 * Full two-framing comparison (see module header for the exact equations):
 *
 *   G            = ((1+r)^n − 1)/r × (1+r)
 *   tradBalance  = C·G                rothBalance = C·(1−t_now)·G
 *   tradSpend.   = C·G·(1−t_ret)      rothSpend.  = C·(1−t_now)·G
 *   Δ            = C·G·(t_ret − t_now)            → break-even t_ret = t_now
 *   perPoint     = C·G/100
 *   Δ_limit      = C·G·t_ret           (framing B, Roth receives full C)
 *
 * Winner uses a ±$0.50 tie band, matching the suite's other comparison
 * engines. Rates are clamped to [0, 85]%; the return to [−20, 50]%; the
 * horizon to [0, 70] years; the contribution to ≥ 0. Every reported rate —
 * including breakevenRetirementRatePct — is the clamped value actually used,
 * never the raw input.
 */
export function compareRoth(input: RothInput): RothComparison {
  const tNow = clampPct(input.currentRatePct, 0, 85) / 100;
  const tRet = clampPct(input.retirementRatePct, 0, 85) / 100;
  const c = Math.max(0, Number.isFinite(input.annualContribution) ? input.annualContribution : 0);
  const nRaw = Number.isFinite(input.years) ? input.years : 0;
  const years = Math.min(70, Math.max(0, nRaw));
  const r = clampPct(input.annualReturnPct, -20, 50);

  const g = annuityDueFactor(r, years);

  const tradBalance = c * g;
  const rothBalance = c * (1 - tNow) * g;
  const tradSpendable = tradBalance * (1 - tRet);
  const rothSpendable = rothBalance;
  const advantageRoth = rothSpendable - tradSpendable;

  return {
    factor: g,
    effectiveYears: years,
    tradBalance,
    rothBalance,
    tradSpendable,
    rothSpendable,
    advantageRoth,
    winner: advantageRoth > 0.5 ? 'roth' : advantageRoth < -0.5 ? 'traditional' : 'tie',
    effectiveCurrentRatePct: tNow * 100,
    effectiveRetirementRatePct: tRet * 100,
    breakevenRetirementRatePct: tNow * 100,
    perPointSwing: (c * g) / 100,
    rothSpendableLimitView: tradBalance, // C·G — the account value with the full nominal C
    advantageRothLimitView: tradBalance * tRet,
  };
}

/* =============================== Sweeps =================================== */

export type RateSweepPoint = {
  retirementRatePct: number;
  /** Framing-A spendable at this retirement rate. */
  tradSpendable: number;
  rothSpendable: number;
};

/**
 * Break-even scan: both spendable columns across retirement rates from
 * `from` to `to` (inclusive), holding everything else at `input`. The Roth
 * column is flat (t_ret never touches it in framing A); the Traditional
 * column falls linearly, crossing the Roth line exactly at t_now.
 */
export function retirementRateSweep(
  input: RothInput,
  from = 0,
  to = 45,
  steps = 45,
): RateSweepPoint[] {
  const lo = Math.max(0, Math.min(from, to));
  const hi = Math.min(85, Math.max(from, to));
  const n = Math.max(1, Math.min(200, Math.round(steps)));
  const out: RateSweepPoint[] = [];
  for (let i = 0; i <= n; i++) {
    const rate = lo + ((hi - lo) * i) / n;
    const r = compareRoth({ ...input, retirementRatePct: rate });
    out.push({
      retirementRatePct: rate,
      tradSpendable: r.tradSpendable,
      rothSpendable: r.rothSpendable,
    });
  }
  return out;
}

export type HorizonPoint = {
  years: number;
  tradSpendable: number;
  rothSpendable: number;
  /** Framing-A Roth advantage at this horizon. */
  advantageRoth: number;
};

/**
 * Horizon sweep: the same rate decision recomputed at several contribution
 * horizons. The PERCENTAGE edge is rate-driven alone (Δ/C·G = t_ret − t_now,
 * independent of n); the DOLLARS at stake grow with the annuity factor —
 * this sweep is the "compounding amplifies the gap" view.
 */
export function horizonSweep(
  input: RothInput,
  horizons: number[] = [5, 10, 15, 20, 25, 30, 35, 40],
): HorizonPoint[] {
  return horizons
    .filter((h) => Number.isFinite(h) && h >= 0)
    .map((h) => {
      const r = compareRoth({ ...input, years: h });
      return {
        years: r.effectiveYears,
        tradSpendable: r.tradSpendable,
        rothSpendable: r.rothSpendable,
        advantageRoth: r.advantageRoth,
      };
    });
}

/**
 * Dollar magnitude of a rate gap of `gapPct` points at a given horizon and
 * contribution — |Δ| = C × G(n) × gap/100. Used by the page-level chart to
 * show horizons compounding several equally-sized rate decisions.
 */
export function gapMagnitude(
  annualContribution: number,
  gapPct: number,
  annualReturnPct: number,
  years: number,
): number {
  const c = Math.max(0, annualContribution);
  const gap = Math.abs(clampPct(gapPct, -85, 85));
  return c * annuityDueFactor(annualReturnPct, years) * (gap / 100);
}

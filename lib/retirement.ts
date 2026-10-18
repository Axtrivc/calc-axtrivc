// Retirement plan capacity model: Solo 401(k) versus SEP-IRA — tax year 2025.
//
// Stage 4 of the suite workflow ("Compensate yourself"): once the entity and
// salary questions are settled, the next lever is how much income can legally
// move into a tax-advantaged retirement plan. This module computes the maximum
// contribution capacity of the two owner-only plans under 2025 federal limits,
// for the two ways a solo owner can be paid:
//
//   sole-prop — Schedule C net profit (sole proprietor / single-member LLC
//               without an S election). The owner is not on payroll.
//   scorp     — owner-employee W-2 wages. Employer contributions are keyed to
//               the compensation actually on the W-2.
//
// 2025 federal parameters (IRS Notice 2024-80 COLA + Publication 560):
//   - §402(g) employee deferral limit .............. $23,500
//   - Age-50 catch-up (50+) ....................... $7,500
//   - Enhanced catch-up (SECURE 2.0 §109, 60–63) .. $11,250 = 150% × $7,500
//   - §415(c) annual additions cap .................. $70,000
//     (catch-up deferrals are EXCLUDED from this cap)
//   - SEP-IRA contribution cap ..................... $70,000
//     (a SEP has NO catch-up of any kind)
//   - Employer rate ................................ 25% of plan compensation.
//     For the self-employed the 25% plan rate solves against a base that the
//     contribution itself shrinks, so it equals 20% of (net profit − ½ SE tax)
//     — Publication 560's Deduction Worksheet & Rate Table for Self-Employed.
//
// Simplified, illustrative US federal model — NOT tax advice:
//  - Single owner, no employees. Hiring W-2 staff voids the "solo" premise
//    (coverage & nondiscrimination testing apply) and changes everything.
//  - "Tax saved" = marginal income-tax rate × pre-tax contributions. Plan
//    contributions NEVER reduce self-employment tax: they are adjustments to
//    gross income, not Schedule SE items.
//  - Sole-prop employer deduction follows the Pub 560 (2025) Deduction
//    Worksheet for the Self-Employed: besides the 20% rate (Rate Table) and
//    the §415(c) $70,000 headroom, the deduction may not exceed ½ of net
//    earnings after elective deferrals (worksheet step 12) — the low-income
//    clawback — and catch-up deferrals are limited to net earnings remaining
//    after the other plan deductions (worksheet steps 16–18). The elective
//    deferral entering these limits is the §402(g) deferral, catch-ups
//    excluded, consistent with the general catch-up rule in Pub 560 chs. 3–4.
//  - No state income tax; the §401(a)(17) compensation cap ($350,000 for
//    2025, per Pub 560 "What's New") is not modeled: at the self-employed
//    20% rate it exactly meets the $70,000 plan cap, and on W-2 pay it binds
//    only above $280,000 of wages (25% × $280,000 = $70,000) — so it never
//    changes an answer at or below the caps; no defined-benefit (cash
//    balance) layer; Roth SEP/loan mechanics are discussed qualitatively in
//    the article only.

import { computeLlc } from '@/lib/tax';

/* ========================= 2025 federal parameters ======================== */

export const RETIREMENT_CONSTANTS = {
  /** §402(g) elective deferral limit (2025). */
  employeeDeferralLimit: 23_500,
  /** Standard catch-up from age 50 (2025). */
  catchUpLimit: 7_500,
  /** SECURE 2.0 §109 enhanced catch-up, ages 60–63 (2025: 150% × $7,500). */
  enhancedCatchUpLimit: 11_250,
  /** Youngest age eligible for any catch-up. */
  catchUpMinAge: 50,
  /** Age window for the SECURE 2.0 enhanced catch-up (inclusive). */
  enhancedCatchUpMinAge: 60,
  enhancedCatchUpMaxAge: 63,
  /** §415(c) annual additions cap (2025); catch-ups sit on top of it. */
  totalAdditionsLimit: 70_000,
  /** SEP-IRA contribution cap (2025). No catch-up exists for SEPs. */
  sepLimit: 70_000,
  /** Statutory employer rate: 25% of plan compensation (S-corp / common-law employees). */
  employerRate: 0.25,
  /** Self-employed deduction-rate equivalent of the 25% plan rate (0.25 / 1.25). */
  employerRateSelfEmployed: 0.2,
  /**
   * Pub 560 (2025) Deduction Worksheet for the Self-Employed, step 12: the
   * employer deduction may not exceed ½ × (net earnings − elective deferrals).
   * Binds only at low incomes (net earnings below 5/3 of the deferral, i.e.
   * roughly $42k of profit at the 2025 $23,500 limit).
   */
  selfEmployedDeductionCapFactor: 0.5,
  /** §401(a)(17) compensation cap for 2025 (docs only — see header note). */
  compensationCap: 350_000,
  /** Schedule SE factor (92.35% of net profit becomes the SE-tax base) — docs only;
   *  the SE engine itself lives in lib/tax.ts. */
  seBaseFactor: 0.9235,
} as const;

export type BusinessMode = 'sole-prop' | 'scorp';

export type PlanInputs = {
  mode: BusinessMode;
  /**
   * sole-prop: Schedule C net profit (line 31) — before ½ SE tax and before
   * any plan contribution. scorp: owner W-2 wages (Box 1) for the year.
   */
  income: number;
  /** Age at end of the plan year (drives catch-up eligibility). */
  age: number;
  /** Employee elective deferral the owner plans to put into the Solo 401(k). */
  plannedDeferral: number;
};

/* ============================ SE-tax plumbing ============================= */

/**
 * Full Schedule SE tax on a year of Schedule C net profit — the exact engine
 * from lib/tax.ts that powers the suite's other tax tools, so every instrument
 * shares one baseline:
 *
 *   SE = 15.3% × min(92.35% × profit, $176,100)
 *        + 2.9% × max(0, 92.35% × profit − $176,100)
 *
 * (no SE tax below $400 of SE base). Retirement contributions do not enter
 * this formula at any point.
 */
export function scheduleSETax(netProfit: number): number {
  return computeLlc(Math.max(0, netProfit)).seTax;
}

/**
 * Plan compensation base for a sole proprietor — Publication 560 Deduction
 * Worksheet for the Self-Employed, line 3:
 *
 *   base = net profit − ½ × SE tax
 *
 * The ½-SE deduction is fixed before contributions (SE tax is unaffected by
 * plan contributions), so unlike the statutory wording there is no circularity
 * left to solve here — the 20% deduction rate below absorbs it.
 */
export function solePropPlanBase(netProfit: number): number {
  const p = Math.max(0, netProfit);
  return Math.max(0, p - scheduleSETax(p) / 2);
}

/* ============================ Age-based limits ============================ */

/**
 * Catch-up deferral available at `age` (2025):
 *   60–63 → $11,250 (SECURE 2.0 §109 enhanced catch-up, 150% × $7,500)
 *   50+   → $7,500
 *   <50   → $0
 */
export function catchUpForAge(age: number): number {
  if (age >= RETIREMENT_CONSTANTS.enhancedCatchUpMinAge && age <= RETIREMENT_CONSTANTS.enhancedCatchUpMaxAge) {
    return RETIREMENT_CONSTANTS.enhancedCatchUpLimit;
  }
  if (age >= RETIREMENT_CONSTANTS.catchUpMinAge) return RETIREMENT_CONSTANTS.catchUpLimit;
  return 0;
}

/** Total employee-deferral headroom at `age`: $23,500 + catch-up (2025). */
export function deferralLimitFor(age: number): number {
  return RETIREMENT_CONSTANTS.employeeDeferralLimit + catchUpForAge(age);
}

/* =========================== Solo 401(k) engine =========================== */

export type SoloCapacity = {
  mode: BusinessMode;
  income: number;
  /** Compensation the employer % is applied to: W-2 wages, or (profit − ½ SE). */
  compensationBase: number;
  /** ½ SE tax folded out of the sole-prop base (0 in S-corp mode). */
  halfSeTax: number;
  /** Deferral inside the §402(g) limit ($23,500 in 2025). */
  deferralCore: number;
  /** Catch-up on top of §402(g), excluded from the §415(c) cap. */
  catchUp: number;
  deferralTotal: number;
  employerContribution: number;
  total: number;
  /** True when the $70,000 §415(c) cap — not the income — limits employer dollars. */
  cappedBy415c: boolean;
};

/**
 * Maximum Solo 401(k) contribution for one owner and one plan year (2025):
 *
 *   deferral  = min(planned, $23,500, comp)                 … §402(g) + 100% of pay
 *   employer  = min(25% × comp (S-corp) | 20% × (profit − ½ SE) (sole prop),
 *                   $70,000 − deferral,
 *                   comp − deferral (S-corp)                … 100% of pay guard
 *                   ½ × (comp − deferral) (sole prop))      … Pub 560 worksheet step 12
 *   catch-up  = min(age catch-up, planned − $23,500, comp − deferral − employer)
 *               … the general rule (Pub 560 chs. 3–4) tightened by worksheet
 *               steps 16–18: catch-ups may not exceed net earnings remaining
 *               after the other plan deductions
 *   total     = deferral + employer + catch-up
 *
 * The sole-prop employer deduction carries the Pub 560 Deduction Worksheet's
 * step-12 cap — ½ of net earnings after elective deferrals — which claws the
 * employer share back at low incomes (it binds while net earnings stay below
 * 5/3 of the deferral, ≈ $42k of profit at the 2025 $23,500 limit). S-corp
 * mode has no such circularity: employer + deferral simply may not exceed
 * W-2 wages. The $70,000 headroom excludes catch-ups, as §415(c) does.
 * Employer rate by mode: S-corp = 25% of W-2 wages; sole proprietor = the
 * 20% deduction-rate equivalent of the statutory 25% (Pub 560 Rate Table).
 */
export function solo401kCapacity(inputs: PlanInputs): SoloCapacity {
  const income = Math.max(0, inputs.income);
  const age = Number.isFinite(inputs.age) ? inputs.age : 0;
  const mode = inputs.mode;
  const planned = Math.max(0, inputs.plannedDeferral);

  const halfSe = mode === 'sole-prop' ? scheduleSETax(income) / 2 : 0;
  const base = mode === 'sole-prop' ? Math.max(0, income - halfSe) : income;

  const coreCap = RETIREMENT_CONSTANTS.employeeDeferralLimit;
  const catchUpCap = catchUpForAge(age);

  const deferralCore = Math.min(planned, coreCap, base);

  const grossEmployer =
    (mode === 'scorp' ? RETIREMENT_CONSTANTS.employerRate : RETIREMENT_CONSTANTS.employerRateSelfEmployed) *
    base;
  // §415(c) headroom after the non-catch-up deferral, then the compensation guard:
  // S-corp — plain 100% of pay (employer + deferral ≤ wages); sole prop — the
  // Pub 560 Deduction Worksheet step 12 cap, ½ of net earnings after deferrals.
  const headroom415 = RETIREMENT_CONSTANTS.totalAdditionsLimit - deferralCore;
  const headroomComp =
    mode === 'scorp'
      ? Math.max(0, base - deferralCore)
      : Math.max(0, (base - deferralCore) * RETIREMENT_CONSTANTS.selfEmployedDeductionCapFactor);
  const employer = Math.min(grossEmployer, headroom415, headroomComp);

  // Catch-ups: general rule (compensation − non-catch-up deferrals), further
  // tightened by the worksheet's steps 16–18 — never past net earnings left
  // after the other plan deductions.
  const catchUp = Math.min(
    catchUpCap,
    Math.max(0, planned - coreCap),
    Math.max(0, base - deferralCore - employer),
  );

  const deferralTotal = deferralCore + catchUp;

  return {
    mode,
    income,
    compensationBase: base,
    halfSeTax: halfSe,
    deferralCore,
    catchUp,
    deferralTotal,
    employerContribution: employer,
    total: deferralTotal + employer,
    cappedBy415c: headroom415 < grossEmployer - 0.5 && headroom415 <= headroomComp + 0.5,
  };
}

/* ============================= SEP-IRA engine ============================= */

export type SepCapacity = {
  mode: BusinessMode;
  income: number;
  /** Base the percentage is applied to (same convention as the Solo 401(k)). */
  contributionBase: number;
  /** Rate applied: 25% (S-corp W-2) or the 20% self-employed equivalent. */
  effectiveRate: number;
  contribution: number;
  /** True when the $70,000 SEP cap — not income — limits the contribution. */
  capped: boolean;
};

/**
 * Maximum SEP-IRA contribution (2025). A SEP has exactly one lever:
 *
 *   SEP = min(25% × W-2 wages (S-corp), $70,000)
 *   SEP = min(20% × (net profit − ½ SE tax) (sole prop), $70,000)
 *
 * No employee deferral, no catch-up at any age. The employer engine matches
 * the Solo 401(k)'s (same rate, base, and $70,000 cap) — the deferral bucket
 * is the only structural difference between the plans. (A Roth SEP is
 * permitted under SECURE 2.0 §601 for tax years beginning after 2022; see the
 * article. Because a SEP takes no deferrals, the worksheet's ½-of-net-earnings
 * deduction cap can never bind: ½ × base always exceeds 20% × base.)
 */
export function sepCapacity(mode: BusinessMode, income: number): SepCapacity {
  const inc = Math.max(0, income);
  const base = mode === 'sole-prop' ? solePropPlanBase(inc) : inc;
  const rate =
    mode === 'scorp' ? RETIREMENT_CONSTANTS.employerRate : RETIREMENT_CONSTANTS.employerRateSelfEmployed;
  const gross = base * rate;
  const contribution = Math.min(gross, RETIREMENT_CONSTANTS.sepLimit);
  return {
    mode,
    income: inc,
    contributionBase: base,
    effectiveRate: rate,
    contribution,
    capped: gross > RETIREMENT_CONSTANTS.sepLimit + 0.5,
  };
}

/* ============================== Comparison ================================ */

export type RetirementComparison = {
  inputs: PlanInputs;
  solo: SoloCapacity;
  sep: SepCapacity;
  /**
   * solo.total − sep.contribution. ≥ 0 at every income: the employer engines
   * match above the worksheet clawback zone, and below it the Solo 401(k)'s
   * ½×(base−deferral) employer cap is always more than covered by the
   * deferral bucket it rides with (½×(base+D) − 20%×base > 0).
   */
  extraCapacity: number;
  /** Federal income tax deferred this year at the given marginal rate (pre-tax strategy). */
  taxSavedSolo: number;
  taxSavedSep: number;
  extraTaxSaved: number;
  /** 'solo401k' unless both plans hold the same dollars (both maxed / zero income). */
  winner: 'solo401k' | 'tie';
};

/**
 * Both plans at the same inputs plus the tax-deferral value of each:
 *
 *   taxSaved = marginalRate × pre-tax contribution
 *
 * Marginal rate is passed as a percentage (24 → 0.24) and clamped to [0, 85].
 * This is income-tax deferral only — contributions never reduce SE tax.
 */
export function compareRetirement(inputs: PlanInputs, marginalRatePct: number): RetirementComparison {
  const rate = Math.min(85, Math.max(0, Number.isFinite(marginalRatePct) ? marginalRatePct : 0)) / 100;
  const solo = solo401kCapacity(inputs);
  const sep = sepCapacity(inputs.mode, inputs.income);
  const extraCapacity = solo.total - sep.contribution;
  return {
    inputs,
    solo,
    sep,
    extraCapacity,
    taxSavedSolo: solo.total * rate,
    taxSavedSep: sep.contribution * rate,
    extraTaxSaved: extraCapacity * rate,
    winner: extraCapacity > 0.5 ? 'solo401k' : 'tie',
  };
}

/* =============================== Sweeps =================================== */

export type SweepPoint = { income: number; solo: number; sep: number };

/**
 * Contribution-capacity sweep across income levels, assuming the owner defers
 * the FULL age-based limit (maximum-capacity view — the "how much could this
 * plan possibly hold" curve). One point per income for each plan.
 */
export function capacitySweep(
  mode: BusinessMode,
  age: number,
  from = 30_000,
  to = 500_000,
  steps = 48,
): SweepPoint[] {
  const n = Math.max(2, Math.floor(steps));
  const deferral = deferralLimitFor(age);
  const out: SweepPoint[] = [];
  for (let i = 0; i < n; i++) {
    const income = from + ((to - from) * i) / (n - 1);
    const solo = solo401kCapacity({ mode, income, age, plannedDeferral: deferral });
    out.push({ income, solo: solo.total, sep: sepCapacity(mode, income).contribution });
  }
  return out;
}

/**
 * Lowest income at which the Solo 401(k) reaches its full §415(c) ceiling
 * ($70,000 + any catch-up) — above it, extra income adds no more Solo-401(k)
 * room. Monotone capacity → bisection, mirroring lib/scorp.ts conventions.
 * Returns null if the ceiling is not reached within [0, cap].
 */
export function incomeToMaxSolo(mode: BusinessMode, age: number, cap = 2_000_000): number | null {
  const target = RETIREMENT_CONSTANTS.totalAdditionsLimit + catchUpForAge(age);
  const capacity = (income: number) =>
    solo401kCapacity({ mode, income, age, plannedDeferral: deferralLimitFor(age) }).total;
  if (capacity(cap) < target - 0.5) return null;
  let lo = 0;
  let hi = cap;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (capacity(mid) >= target - 0.5) hi = mid;
    else lo = mid;
  }
  return hi;
}

/**
 * Lowest income at which the SEP-IRA hits its $70,000 cap — above it, the SEP
 * and the Solo 401(k) employer side are both saturated and the only remaining
 * difference between the plans is the deferral bucket. Returns null if the cap
 * is not reached within [0, cap].
 */
export function incomeToMaxSep(mode: BusinessMode, cap = 2_000_000): number | null {
  const target = RETIREMENT_CONSTANTS.sepLimit;
  const contribution = (income: number) => sepCapacity(mode, income).contribution;
  if (contribution(cap) < target - 0.5) return null;
  let lo = 0;
  let hi = cap;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (contribution(mid) >= target - 0.5) hi = mid;
    else lo = mid;
  }
  return hi;
}

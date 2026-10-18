// SAFE note conversion model — YC post-money SAFE mechanics at the priced round.
//
// This is the stage-3 "Structure" instrument's convertible side: the cap table
// tool walks registered shares through priced rounds; this one prices what a
// stack of post-money SAFEs does to that round the moment it closes.
//
// SOURCE OF THE MECHANICS (nature: contractual template, not statute):
// The model implements the conversion math of Y Combinator's standard
// "Post-Money Safe" form (the 2018 revision sold at ycombinator.com/documents;
// explanatory walkthrough in YC's published Safe Primer). Key defined terms
// from that form, restated exactly as this library applies them:
//
//  - "Company Capitalization" (CC) — the fully diluted share count immediately
//    prior to the priced round, EXCLUDING the new investor's shares, but
//    INCLUDING: outstanding stock, granted AND promised options (signed offers
//    count), the reserved-but-unallocated pool as it stands, and every
//    converting security — i.e. all SAFEs being converted. Per the form, CC
//    does NOT include any option-pool increase adopted in connection with the
//    financing: the cap is "post" the existing pool, "pre" the round's new one
//    (YC's documents-page FAQ states this expressly).
//  - "Safe Price" per SAFE — the conversion price:
//      • cap-only SAFE:      cap ÷ CC
//      • discount-only SAFE: Discount Rate × price paid by the new investor
//                            (Rate = share of the price PAID: 20% off → 0.80)
//      • both terms:         the holder elects the LOWER price of the two
//      • neither (MFN-style): the round price itself
//  - The priced round is quoted pre-money on the POST-conversion table: SAFEs
//    convert "immediately prior to" the financing, so the negotiated price per
//    share P satisfies pre-money = P × CC (the standard reading of the form —
//    see assumptions on the page for the term-sheet nuance).
//
// WHY IT SOLVES IN CLOSED FORM:
// Both candidate prices scale as 1/CC, so each SAFE reduces to an "effective
// cap" m_i and a fixed claim on CC (r_i = Discount Rate, the share of the
// round price the SAFE pays):
//
//      m_i = min(cap_i, r_i × PreMoney)           (whichever term protects more)
//      CC  = n + Σ_i Amount_i × CC / m_i          (SAFE shares are part of CC)
//         = n / (1 − Σ_i Amount_i / m_i)
//
// The YC form's famous property falls straight out: a capped post-money SAFE
// owns exactly Amount_i / cap_i of the pre-round table — fixed on the day it
// is signed — and the whole stack then dilutes pro-rata when the round closes.
//
// Simplified, illustrative model — NOT legal or financial advice. Deliberate
// limitations (documented on the page):
//  - Post-money SAFEs only. Pre-money SAFEs (pre-2018 form) computed their
//    percentage against capitalization EXCLUDING other converting securities;
//    a mixed stack needs document-level math this model does not attempt.
//  - Conversion at the priced round only — the form's term is "Equity
//    Financing" and, per YC's documents-page FAQ, there is NO threshold amount
//    that must be raised to trigger it. Dissolution, change-of-control and IPO
//    conversions follow different waterfall logic and are not modeled.
//  - Option-pool increases adopted in connection with the round are excluded
//    from Company Capitalization by the form itself — enter the pool as it
//    stands today inside `existingShares`. After conversion such an increase
//    dilutes everyone (SAFEs included) instead of growing the SAFE
//    denominators; that later step is outside the model.
//  - Share numbers are unrounded fractional shares; real closings round to
//    whole shares per the documents.
//  - No side letters, pro-rata side letters, MFN amendments after signing, or
//    revert-to-MFN mechanics.
//
// The library is deliberately dependency-free so every number it returns is
// reproducible by hand from the JSDoc formulas.

/** Maximum SAFE rows the UI offers. */
export const MAX_SAFES = 3;

/** One SAFE on the stack. A row with amount <= 0 is inactive. */
export type SafeTerms = {
  /** Purchase amount, dollars. > 0 required to convert. */
  amount: number;
  /** Post-money valuation cap, dollars. 0 = no cap. */
  cap: number;
  /** Discount, PERCENT OFF the round price (20 = the SAFE pays 80% of it). 0 = no discount. */
  discountPct: number;
};

/** The priced round that triggers conversion. */
export type RoundTerms = {
  /** New money invested in the priced round, dollars. > 0 required. */
  investment: number;
  /** Pre-money valuation of the priced round, struck AFTER SAFE conversion, dollars. */
  preMoney: number;
};

/** Which SAFE term produced the conversion price for this SAFE. */
export type SafeBinding = 'cap' | 'discount' | 'round-price' | 'inactive';

export type SafeOutcome = {
  index: number;
  /** Which term produced the price ('inactive' when amount <= 0). */
  binding: SafeBinding;
  /**
   * Effective cap m_i, dollars: min(cap, discount × pre-money) with the
   * obvious collapses when only one term exists. Equals the valuation cap
   * exactly when 'cap' binds, and the discount price × CC when 'discount'
   * binds. For an uncapped, no-discount SAFE it equals the pre-money.
   */
  effectiveCap: number;
  /** Conversion price per share, dollars = effectiveCap ÷ CC. */
  safePrice: number;
  /** Price per share paid by the new investor = preMoney ÷ CC. */
  roundPrice: number;
  /** SAFE price as a fraction of the round price (0.8 → 20% off). Can exceed 1. */
  priceRatio: number;
  /** Discount vs the round price in percent (20 = converted 20% below; negative = above). */
  effectiveDiscountPct: number;
  /** (Unrounded) shares the SAFE converts into. */
  shares: number;
  /** Ownership as % of the pre-round capitalization CC (amount ÷ effectiveCap × 100). */
  pctOfPreRound: number;
  /** Ownership as % of the post-round cap table. */
  pctAfterRound: number;
};

export type SafeConversion = {
  /** False when the inputs cannot close a round; see `reason`. */
  valid: boolean;
  /** Human-readable reason for an invalid/empty state ('' when valid). */
  reason: string;
  /** Fully diluted shares immediately prior to the round, SAFEs included (CC). */
  companyCapitalization: number;
  /** Price per share paid by the Series A investor = preMoney ÷ CC. */
  roundPrice: number;
  /** New shares issued to the priced-round investor. */
  investorShares: number;
  /** Fully diluted shares after the round = CC × post ÷ pre. */
  totalSharesAfter: number;
  /** Investor ownership after the round, % (= investment ÷ post-money × 100). */
  investorPctAfter: number;
  /** Existing holders' ownership after the round, %. */
  foundersPctAfter: number;
  /** Counterfactual: same round with no SAFE stack — existing holders' %, %. */
  foundersPctNoSafes: number;
  /** How many percentage points of ownership the SAFE stack costs existing holders. */
  foundersExtraDilutionPts: number;
  /** Per-SAFE outcomes, one row per input SAFE (inactive rows included). */
  safes: SafeOutcome[];
  /** Combined SAFE stack ownership after the round, %. */
  stackPctAfter: number;
  /** Combined SAFE stack share of the pre-round capitalization CC, %. */
  stackPctOfPreRound: number;
};

export type SafeStackStatus = {
  state: 'empty' | 'modeled' | 'invalid';
  reason?: string;
};

/**
 * The multiplier the SAFE pays against the round price, as a fraction.
 *
 * CONVENTION (a classic trap, stated once and enforced everywhere): inputs use
 * "percent OFF" (20 = a 20% discount), while the YC form's "Discount Rate" is
 * the share of the price PAID — so a 20% discount is a Discount Rate of 0.80
 * and Discount Price = 0.80 × round price. Clamped to [0%, 90%] off; a 100%
 * discount would be free shares and cannot close.
 */
function discountRate(safe: SafeTerms): number {
  const off = Math.min(Math.max(safe.discountPct, 0), 90);
  return (100 - off) / 100;
}

/**
 * The effective cap m_i of one SAFE at a given round pre-money:
 *
 *      m = min(cap, rate × preMoney)          both terms
 *        = cap                                 cap only
 *        = rate × preMoney                     discount only
 *        = preMoney                            neither (converts at the round price)
 *
 * m is "the number the SAFE's dollars divide against": SAFE % of CC = amount ÷ m.
 * The holder elects the LOWER of the two candidate PRICES; since both prices
 * have the form m ÷ CC, the lower price is simply the smaller m — i.e. the
 * term that protects more at this valuation is the one that binds.
 */
export function effectiveCap(safe: SafeTerms, preMoney: number): number {
  const hasCap = safe.cap > 0;
  const rate = discountRate(safe);
  const hasDiscount = rate < 1;
  if (hasCap && hasDiscount) return Math.min(safe.cap, rate * preMoney);
  if (hasCap) return safe.cap;
  if (hasDiscount) return rate * preMoney;
  return preMoney;
}

/** Which term of a SAFE produced its effective cap at this pre-money. */
export function bindingOf(safe: SafeTerms, preMoney: number): SafeBinding {
  if (safe.amount <= 0) return 'inactive';
  const hasCap = safe.cap > 0;
  const rate = discountRate(safe);
  const hasDiscount = rate < 1;
  if (hasCap && hasDiscount) return safe.cap <= rate * preMoney ? 'cap' : 'discount';
  if (hasCap) return 'cap';
  if (hasDiscount) return 'discount';
  return 'round-price';
}

/**
 * Classify a full SAFE-stack conversion.
 *
 *  - 'empty'   — no SAFE carries a purchase amount (nothing to convert);
 *  - 'invalid' — the round cannot close: no existing shares, no investment or
 *                pre-money, or Σ amountᵢ ÷ mᵢ ≥ 100% — the SAFE stack alone
 *                would claim the entire pre-round capitalization;
 *  - 'modeled' — otherwise.
 */
export function classifySafeStack(
  safes: SafeTerms[],
  round: RoundTerms,
  existingShares: number,
): SafeStackStatus {
  const active = safes.filter((s) => s.amount > 0);
  if (active.length === 0) return { state: 'empty', reason: 'Enter at least one SAFE with a purchase amount.' };
  if (existingShares <= 0) {
    return { state: 'invalid', reason: 'Existing fully diluted shares must be above zero.' };
  }
  if (round.investment <= 0) {
    return { state: 'invalid', reason: 'The priced round needs a positive investment to trigger conversion.' };
  }
  if (round.preMoney <= 0) {
    return { state: 'invalid', reason: 'The priced round needs a positive pre-money valuation.' };
  }
  const stackFraction = active.reduce((a, s) => a + s.amount / effectiveCap(s, round.preMoney), 0);
  if (stackFraction >= 1 - 1e-9) {
    return {
      state: 'invalid',
      reason: 'The SAFE stack alone would claim 100% or more of the pre-round capitalization — no priced round can close under these terms.',
    };
  }
  return { state: 'modeled' };
}

/**
 * Convert a SAFE stack at a priced round — the model's core.
 *
 * Exact sequence (all formulas closed-form; every displayed output traces to
 * one of these lines):
 *
 *      mᵢ        = effectiveCap(safeᵢ, preMoney)          per active SAFE
 *      CC        = n ÷ (1 − Σᵢ Amountᵢ ÷ mᵢ)              n = existingShares
 *      safePriceᵢ = mᵢ ÷ CC
 *      sharesᵢ    = Amountᵢ ÷ safePriceᵢ = Amountᵢ × CC ÷ mᵢ
 *      P          = preMoney ÷ CC                          investor price/share
 *      investorShares = investment ÷ P = investment × CC ÷ preMoney
 *      total      = CC + investorShares = CC × (pre + inv) ÷ pre
 *
 * Identities that hold by construction (used by the page's checks):
 *      investor % after = investment ÷ (pre + inv)
 *      founders % without SAFEs = pre ÷ (pre + inv)
 *      founders extra dilution (points) = (Σᵢ Amountᵢ ÷ mᵢ) × pre ÷ (pre + inv) × 100
 */
export function convertSafeStack(
  safes: SafeTerms[],
  round: RoundTerms,
  existingShares: number,
): SafeConversion {
  const status = classifySafeStack(safes, round, existingShares);

  const outcomes: SafeOutcome[] = safes.map((s, i) => ({
    index: i,
    binding: bindingOf(s, round.preMoney),
    effectiveCap: 0,
    safePrice: 0,
    roundPrice: 0,
    priceRatio: 0,
    effectiveDiscountPct: 0,
    shares: 0,
    pctOfPreRound: 0,
    pctAfterRound: 0,
  }));

  const post = round.preMoney + round.investment;
  const fail: SafeConversion = {
    valid: false,
    reason: status.state === 'modeled' ? '' : status.reason ?? 'Conversion not modeled.',
    companyCapitalization: 0,
    roundPrice: 0,
    investorShares: 0,
    totalSharesAfter: 0,
    investorPctAfter: post > 0 ? (round.investment / post) * 100 : 0,
    foundersPctAfter: 0,
    foundersPctNoSafes: post > 0 ? (round.preMoney / post) * 100 : 0,
    foundersExtraDilutionPts: 0,
    safes: outcomes,
    stackPctAfter: 0,
    stackPctOfPreRound: 0,
  };
  if (status.state !== 'modeled') return fail;

  const active = safes.filter((s) => s.amount > 0);
  const stackFraction = active.reduce((a, s) => a + s.amount / effectiveCap(s, round.preMoney), 0);

  // The one circular definition in the SAFE form, solved in one line.
  const cc = existingShares / (1 - stackFraction);
  const price = round.preMoney / cc;
  const investorShares = round.investment / price;
  const total = cc + investorShares;

  safes.forEach((s, i) => {
    if (s.amount <= 0) return;
    const m = effectiveCap(s, round.preMoney);
    const safePrice = m / cc;
    const shares = s.amount / safePrice;
    outcomes[i] = {
      index: i,
      binding: bindingOf(s, round.preMoney),
      effectiveCap: m,
      safePrice,
      roundPrice: price,
      priceRatio: safePrice / price,
      effectiveDiscountPct: (1 - safePrice / price) * 100,
      shares,
      pctOfPreRound: (shares / cc) * 100,
      pctAfterRound: (shares / total) * 100,
    };
  });

  const safeShares = outcomes.reduce((a, o) => a + o.shares, 0);

  return {
    valid: true,
    reason: '',
    companyCapitalization: cc,
    roundPrice: price,
    investorShares,
    totalSharesAfter: total,
    investorPctAfter: (investorShares / total) * 100,
    foundersPctAfter: (existingShares / total) * 100,
    foundersPctNoSafes: (round.preMoney / post) * 100,
    foundersExtraDilutionPts: (round.preMoney / post) * 100 - (existingShares / total) * 100,
    safes: outcomes,
    stackPctAfter: (safeShares / total) * 100,
    stackPctOfPreRound: (safeShares / cc) * 100,
  };
}

export type SafeCurvePoint = {
  x: number;
  /** Combined SAFE stack ownership after the round, % (NaN when infeasible at this x). */
  stackPctAfter: number;
  /** Existing holders' ownership after the round, % (NaN when infeasible). */
  foundersPctAfter: number;
  /**
   * How the stack binds at this x: the shared term when EVERY active SAFE
   * binds the same way, 'mixed' when they do not (a stack whose SAFEs carry
   * different caps/discounts flips terms at different valuations), and
   * 'round-price' when all are uncapped with no discount. 'inactive' never
   * occurs for feasible points of a stack with at least one active SAFE.
   */
  bindingMode: SafeBinding | 'mixed';
};

/**
 * Sensitivity sweep: the same stack re-converted at each candidate round
 * pre-money. This is the "next-round valuation → SAFE ownership" curve. Each
 * point is the full model recomputed — never an interpolation.
 *
 * Infeasible points (stack ≥ 100% of CC at that valuation) carry NaN so the
 * chart layer can drop them instead of silently clamping.
 */
export function safeCurve(
  safes: SafeTerms[],
  investment: number,
  existingShares: number,
  preMoneyValues: number[],
): SafeCurvePoint[] {
  const active = safes.filter((s) => s.amount > 0);
  return preMoneyValues.map((pre) => {
    const res = convertSafeStack(safes, { investment, preMoney: pre }, existingShares);
    const bindings = new Set(active.map((s) => bindingOf(s, pre)));
    const bindingMode: SafeCurvePoint['bindingMode'] =
      bindings.size === 1 ? (bindings.values().next().value as SafeBinding) : 'mixed';
    return {
      x: pre,
      stackPctAfter: res.valid ? res.stackPctAfter : NaN,
      foundersPctAfter: res.valid ? res.foundersPctAfter : NaN,
      bindingMode: active.length === 0 ? 'inactive' : bindingMode,
    };
  });
}

/**
 * The pre-money at which a SAFE's protection switches terms: the valuation
 * where cap = rate × pre-money, i.e. pre* = cap ÷ rate (a $10M cap with 20%
 * off flips at $10M ÷ 0.80 = $12.5M). BELOW it the discount binds — the SAFE
 * pays a fixed share of an ever-cheaper round price; ABOVE it the cap binds —
 * the SAFE's price is pinned by the cap no matter how rich the round. At the
 * crossover the SAFE holder's post-round ownership is at its MINIMUM: the two
 * regimes meet at the bottom of a valley, not a peak.
 * null when the SAFE does not carry both terms.
 */
export function crossoverPreMoney(safe: SafeTerms): number | null {
  const rate = discountRate(safe);
  if (safe.cap <= 0 || rate >= 1) return null;
  return safe.cap / rate;
}

/* ------------------------------------------------------------------ */
/* Scenario presets (numeric inputs only)                              */
/* ------------------------------------------------------------------ */

export type SafePreset = {
  id: string;
  label: string;
  description: string;
  /** Always MAX_SAFES entries; inactive rows carry amount = 0. */
  safes: { amount: number; cap: number; discountPct: number }[];
  round: { investment: number; preMoney: number };
  /** Existing fully diluted shares (common + granted/promised options + current pool). */
  shares: number;
};

const zeroSafe = () => ({ amount: 0, cap: 0, discountPct: 0 });

function padSafes(
  safes: { amount: number; cap: number; discountPct: number }[],
): SafePreset['safes'] {
  return Array.from({ length: MAX_SAFES }, (_, i) => safes[i] ?? zeroSafe());
}

export const SAFE_PRESETS: SafePreset[] = [
  {
    id: 'yc-standard',
    label: 'Standard YC seed',
    description: '$500k on a $10M post-money cap with a 20% discount; $3M Series A at $15M pre.',
    safes: padSafes([{ amount: 500_000, cap: 10_000_000, discountPct: 20 }]),
    round: { investment: 3_000_000, preMoney: 15_000_000 },
    shares: 10_000_000,
  },
  {
    id: 'discount-only',
    label: 'Discount only',
    description: '$750k with a 20% discount and no cap — no ceiling, so its slice shrinks as the round prices up.',
    safes: padSafes([{ amount: 750_000, cap: 0, discountPct: 20 }]),
    round: { investment: 3_000_000, preMoney: 15_000_000 },
    shares: 10_000_000,
  },
  {
    id: 'stacked',
    label: 'Two-SAFE stack',
    description: '$500k at an $8M cap plus $1M at a $16M cap, both with 15% discounts.',
    safes: padSafes([
      { amount: 500_000, cap: 8_000_000, discountPct: 15 },
      { amount: 1_000_000, cap: 16_000_000, discountPct: 15 },
    ]),
    round: { investment: 3_000_000, preMoney: 15_000_000 },
    shares: 10_000_000,
  },
  {
    id: 'heavy',
    label: 'Cap-heavy stack',
    description: '$4.5M across three SAFEs at $6M / $10M / $14M caps; $8M Series A at $30M pre.',
    safes: padSafes([
      { amount: 1_000_000, cap: 6_000_000, discountPct: 0 },
      { amount: 2_000_000, cap: 10_000_000, discountPct: 0 },
      { amount: 1_500_000, cap: 14_000_000, discountPct: 0 },
    ]),
    round: { investment: 8_000_000, preMoney: 30_000_000 },
    shares: 10_000_000,
  },
];

/** Default UI state = the "Standard YC seed" preset. */
export const DEFAULT_SAFE_INPUTS = (() => {
  const p = SAFE_PRESETS[0];
  const d: Record<string, number> = { roundInv: p.round.investment, roundPre: p.round.preMoney, shares: p.shares };
  for (let i = 0; i < MAX_SAFES; i++) {
    d[`s${i + 1}Amt`] = p.safes[i].amount;
    d[`s${i + 1}Cap`] = p.safes[i].cap;
    d[`s${i + 1}Disc`] = p.safes[i].discountPct;
  }
  return d;
})();

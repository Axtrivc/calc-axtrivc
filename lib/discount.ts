// Discount-erosion model — the margin instrument of the "Price" stage: given
// what a unit sells for, what it costs to deliver, and how deep the discount
// cuts, how much extra volume must the discount buy just to stand still?
//
// The algebra is the classical price-volume trade-off of managerial pricing
// (Marn & Rosiello, "Managing Price, Gaining Profit", Harvard Business Review,
// Sept–Oct 1992 — the canonical published statement of the price-cut/volume
// table; the same algebra runs through standard managerial-accounting texts
// such as Garrison, Noreen & Brewer). It is the CVP canon of `lib/breakeven.ts`
// re-solved for a price shock instead of a volume target.
//
// Parameter posture — stated deliberately: NO year-specific statutory
// constants (IRS, SSA, or inflation parameters) enter this model. Every
// formula below is time-invariant arithmetic on the user's own price and cost
// inputs. The only dated claims on the page live in the article's behavioral
// citations, which are named there as literature, not as parameters.
//
// Documented assumptions (surfaced on the page's methodology section):
//  - "Profit" means gross profit / contribution: (price − variable unit cost)
//    × volume. Fixed costs do not change when a discount is run, so they cancel
//    out of the "hold profit flat" condition; the break-even instrument covers
//    the fixed-cost layer.
//  - One price and one per-unit variable cost across the volume range; no
//    tiered pricing or volume-tier COGS effects inside a scenario.
//  - Volume response is the only channel modeled: a discount changes margin
//    per unit and (through demand) units sold. Cannibalization at the old
//    price, competitor response, and reference-price damage are discussed on
//    the page but are not parameters of the algebra.
//  - A discount at or above the full gross margin (d ≥ gm) cannot be rescued
//    by volume: the discounted unit margin is ≤ 0, so more sales mean equal or
//    worse gross profit. The model returns `null` there instead of inventing
//    a number.

/** Clamp to the non-negative reals — the model has no meaningful negatives. */
function nn(n: number): number {
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/**
 * Gross margin as a percentage of price.
 *
 * Formula: `gm% = (price − unit cost) ÷ price × 100`
 *
 * @returns percentage in (−∞, 100]; `null` when price ≤ 0 (ratio undefined).
 */
export function grossMarginPct(price: number, unitCost: number): number | null {
  const p = nn(price);
  if (p <= 0) return null;
  return ((p - nn(unitCost)) / p) * 100;
}

/**
 * Revenue-neutral volume uplift — the number everyone quotes.
 *
 * Solves `Q₂ · P(1 − d) = Q · P` (revenue held flat) for the volume increase:
 *
 *   1 + u = 1 ÷ (1 − d)  →  u = d ÷ (1 − d)
 *
 * So 20% off needs +25% units and 25% off needs +33.3% — the famous "law of
 * discounts". It preserves PROFIT (not just revenue) only in the zero-cost
 * corner gm = 100%, which is why `profitNeutralUpliftPct` is the number this
 * tool headlines; this one is reported alongside as the best case.
 *
 * @param discountPct discount as a percentage of price (e.g. 20 = 20% off),
 *        clamped to [0, 95] so the denominator stays positive.
 * @returns required uplift as a percentage of current volume (25 → +25%).
 */
export function revenueNeutralUpliftPct(discountPct: number): number {
  const d = Math.min(95, Math.max(0, nn(discountPct))) / 100;
  return (d / (1 - d)) * 100;
}

/**
 * Profit-neutral volume uplift — the number that actually governs the decision.
 *
 * Solves `Q₂ · (P(1 − d) − C) = Q · (P − C)` (gross profit held flat):
 *
 *   1 + u = (P − C) ÷ (P(1 − d) − C)
 *
 * Substitute the gross margin gm = (P − C) ÷ P (so C = P(1 − gm) and the
 * discounted unit margin is P(gm − d)):
 *
 *   u = d ÷ (gm − d)
 *
 * This is the classic Marn–Rosiello price-cut/volume table: at 40% gross
 * margin a 20% price cut needs +100% volume to hold gross profit. It exceeds
 * the revenue-neutral floor by `d(1 − gm) ÷ ((gm − d)(1 − d))` ≥ 0 — equal
 * only when the product is costless (gm = 100%).
 *
 * @param discountPct discount as a percentage of price (e.g. 20 = 20% off).
 * @returns required uplift as a percentage of current volume; `null` when the
 * baseline margin is ≤ 0 (nothing to preserve) or `discountPct ≥ gm` — the
 * discount consumes the entire margin and no volume can restore it.
 */
export function profitNeutralUpliftPct(
  price: number,
  unitCost: number,
  discountPct: number,
): number | null {
  const gm = grossMarginPct(price, unitCost);
  if (gm === null || gm <= 0) return null;
  const d = Math.min(95, Math.max(0, nn(discountPct)));
  if (d >= gm) return null;
  return (d / (gm - d)) * 100;
}

/** Full input bundle for the aggregate result below. Period-consistent (monthly in the UI). */
export type DiscountInputs = {
  /** List price per unit, before the discount. */
  price: number;
  /** Variable cost per unit (COGS, fees, delivery — the costs that scale 1:1 with a sale). */
  unitCost: number;
  /** Units sold per period at the list price. */
  volume: number;
  /** Discount as a percentage of price (20 = "20% off"). */
  discountPct: number;
};

export type DiscountResult = {
  /**
   * State machine, in diagnosis order:
   *  - 'no-price'      — no list price entered yet (price ≤ 0); nothing to compute.
   *  - 'underwater'    — price ≤ unit cost (gm ≤ 0): the unit is already at or
   *                      below water before any discount.
   *  - 'no-discount'   — discount ≈ 0 (< 0.05%): there is no promotion on trial.
   *  - 'unrecoverable' — gm > 0 but d ≥ gm: the discount consumes the entire
   *                      margin and no volume can hold profit flat.
   *  - 'viable'        — d < gm: a finite required uplift exists.
   */
  status: 'no-price' | 'no-discount' | 'viable' | 'unrecoverable' | 'underwater';
  /** Price per unit after the discount: P(1 − d). */
  discountedPrice: number;
  /** Unit margin before: P − C. */
  baseUnitMargin: number;
  /** Unit margin after: P(1 − d) − C. Negative means each sale now loses money. */
  discountedUnitMargin: number;
  /** Gross margin % before the discount; `null` when price ≤ 0. */
  baseGrossMarginPct: number | null;
  /** Gross margin % after the discount; `null` when discounted price ≤ 0. */
  discountedGrossMarginPct: number | null;
  /** Share of the unit margin the discount destroys: d ÷ gm × 100 (100 = the whole margin); `null` when gm ≤ 0. */
  unitMarginErosionPct: number | null;
  /** Revenue at the current volume and list price. */
  baseRevenue: number;
  /** Gross profit at the current volume and list price: Q(P − C). */
  baseGrossProfit: number;
  /** The famous floor: revenue-neutral uplift (equals the profit-neutral number only at gm = 100%). */
  revenueNeutralUpliftPct: number;
  /** The governing number: profit-neutral uplift; `null` when no volume can hold profit flat. */
  profitNeutralUpliftPct: number | null;
  /** Volume that holds gross profit flat: Q × (1 + u); `null` when unrecoverable. */
  breakEvenVolume: number | null;
};

/**
 * Aggregate discount readout from one input bundle — everything the UI shows.
 *
 * Every field follows from the two uplift formulas plus the unit economics;
 * fixed costs cancel by construction (they are identical with and without the
 * discount, so they cannot affect the hold-profit-flat condition).
 */
export function computeDiscount(inputs: DiscountInputs): DiscountResult {
  const price = nn(inputs.price);
  const cost = nn(inputs.unitCost);
  const volume = nn(inputs.volume);
  const d = Math.min(95, Math.max(0, nn(inputs.discountPct)));

  const discountedPrice = price * (1 - d / 100);
  const baseUnitMargin = price - cost;
  const discountedUnitMargin = discountedPrice - cost;
  const gm = grossMarginPct(price, cost);
  const gmAfter = discountedPrice > 0 ? ((discountedPrice - cost) / discountedPrice) * 100 : null;

  const rUplift = revenueNeutralUpliftPct(d);
  const pUplift = profitNeutralUpliftPct(price, cost, d);

  let status: DiscountResult['status'];
  // Diagnosis order matters: a missing price must not be misread as a margin
  // problem, and a zero discount is not a promotion that "cannot be saved".
  if (price <= 0) status = 'no-price';
  else if (gm !== null && gm <= 0) status = 'underwater';
  else if (d < 0.05) status = 'no-discount';
  else if (pUplift === null) status = 'unrecoverable';
  else status = 'viable';

  return {
    status,
    discountedPrice,
    baseUnitMargin,
    discountedUnitMargin,
    baseGrossMarginPct: gm,
    discountedGrossMarginPct: gmAfter,
    unitMarginErosionPct: gm !== null && gm > 0 ? (d / gm) * 100 : null,
    baseRevenue: price * volume,
    baseGrossProfit: baseUnitMargin * volume,
    revenueNeutralUpliftPct: rUplift,
    profitNeutralUpliftPct: pUplift,
    breakEvenVolume: pUplift === null ? null : volume * (1 + pUplift / 100),
  };
}

/**
 * Gross profit if the discount achieves a volume response of `upliftPct`.
 *
 * Formula: `π = Q(1 + u) × (P(1 − d) − C)`
 *
 * At `upliftPct = 0` this is the discount run with zero response (pure loss);
 * at `upliftPct = profitNeutralUpliftPct` it equals the baseline gross profit
 * exactly — that identity is the definition of the profit-neutral uplift.
 */
export function profitAtResponse(inputs: DiscountInputs, upliftPct: number): number {
  const { price, unitCost, volume, discountPct } = inputs;
  const d = Math.min(95, Math.max(0, nn(discountPct))) / 100;
  // A negative "response" is not a meaningful state for this model — clamp to 0.
  const u = Math.max(0, Number.isFinite(upliftPct) ? upliftPct : 0) / 100;
  return nn(volume) * (1 + u) * (nn(price) * (1 - d) - nn(unitCost));
}

/** Profit change versus the no-discount baseline at a given volume response. */
export function profitDeltaAtResponse(inputs: DiscountInputs, upliftPct: number): number {
  const { price, unitCost, volume } = inputs;
  const base = nn(volume) * (nn(price) - nn(unitCost));
  return profitAtResponse(inputs, upliftPct) - base;
}

export type ResponsePoint = {
  upliftPct: number;
  /** Profit change vs the no-discount baseline at this volume response. */
  profitDelta: number;
};

/**
 * Profit-delta curve as the achieved volume response scans 0 → `maxUpliftPct`.
 * The curve is a straight line in u (one margin per extra unit); its zero
 * crossing is the profit-neutral uplift — the interactive chart draws exactly
 * that crossing and marks it.
 */
export function responseSweep(inputs: DiscountInputs, maxUpliftPct = 200, steps = 41): ResponsePoint[] {
  if (steps < 2 || maxUpliftPct <= 0) return [];
  const out: ResponsePoint[] = [];
  for (let i = 0; i < steps; i++) {
    const upliftPct = (maxUpliftPct * i) / (steps - 1);
    out.push({ upliftPct, profitDelta: profitDeltaAtResponse(inputs, upliftPct) });
  }
  return out;
}

export type UpliftCurvePoint = {
  discountPct: number;
  /** Profit-neutral uplift at this discount; `null` when discount ≥ gross margin. */
  upliftPct: number | null;
};

/**
 * Required-uplift curve for a fixed gross margin as the discount deepens —
 * `u(d) = d ÷ (gm − d)`, a hyperbola with its vertical asymptote at d = gm.
 *
 * @param gmPct gross margin as a percentage (e.g. 50 for 50%).
 * @param fromPct first discount on the scan (default 2.5).
 * @param toPct last discount on the scan (default 45).
 * @param steps number of evenly spaced discount points (default 18).
 */
export function upliftCurve(gmPct: number, fromPct = 2.5, toPct = 45, steps = 18): UpliftCurvePoint[] {
  const gm = nn(gmPct);
  if (gm <= 0 || steps < 2 || toPct <= fromPct) return [];
  const out: UpliftCurvePoint[] = [];
  for (let i = 0; i < steps; i++) {
    const discountPct = fromPct + ((toPct - fromPct) * i) / (steps - 1);
    out.push({
      discountPct,
      upliftPct: discountPct >= gm ? null : (discountPct / (gm - discountPct)) * 100,
    });
  }
  return out;
}

export type MarginTierRow = {
  /** Gross margin tier as a percentage (row header). */
  gmPct: number;
  /** Required uplift per discount column; `null` where discount ≥ margin (volume cannot save it). */
  uplifts: (number | null)[];
};

/**
 * The classic price-cut/volume grid: rows are gross-margin tiers, columns are
 * discount depths, each cell is `d ÷ (gm − d) × 100`. Computed from
 * `profitNeutralUpliftPct` scaled to whole-margin inputs, so the table and the
 * widget can never disagree.
 */
export function marginTierMatrix(
  marginsPct: number[],
  discountsPct: number[],
): MarginTierRow[] {
  return marginsPct.map((gm) => ({
    gmPct: gm,
    uplifts: discountsPct.map((d) => {
      // Margin expressed on a $100 price so the tier arithmetic is exact:
      // profitNeutralUpliftPct(100, 100 − gm, d) === d / (gm − d) × 100.
      return profitNeutralUpliftPct(100, 100 - gm, d);
    }),
  }));
}

/* ===================== Coupon ("spend X, save Y") vs straight discount ====== */

export type CouponResult = {
  /** Face rate: Y ÷ T × 100 — the number marketing puts on the banner. */
  faceRatePct: number;
  /** True when the basket clears the spend threshold (the coupon applies). */
  triggered: boolean;
  /** How much more the customer must spend to trigger: max(0, T − basket). */
  gapToTrigger: number;
  /** Effective rate at this basket: Y ÷ basket × 100 (0 when untriggered). */
  effectiveRatePct: number;
  /** Final price paying with the coupon: basket − Y (basket itself when untriggered). */
  finalPriceCoupon: number;
  /** Final price under the straight discount: basket × (1 − d). */
  finalPriceStraight: number;
  /** Coupon discount − straight discount, positive = the coupon takes more off. */
  savingsDifference: number;
  /**
   * Crossover basket: Y ÷ d. Below it the coupon (once triggered) gives more
   * off than the blanket d% discount; above it the blanket costs the seller
   * more. `null` when the straight discount is 0 (crossover at infinity).
   */
  crossOverBasket: number | null;
  /** False when amount-off ≥ threshold — a coupon that pays the customer to check out. */
  sane: boolean;
};

/**
 * Face-value equivalence of a spend-threshold coupon and a blanket discount.
 *
 * A "$Y off when you spend $T" coupon is a straight discount of `Y ÷ T` ONLY
 * at a basket of exactly T. At basket B ≥ T the effective rate is `Y ÷ B`,
 * which shrinks as the basket grows — the seller's cost is capped at Y while a
 * blanket d% keeps scaling. Setting the two final prices equal,
 * `B − Y = B(1 − d)`, gives the crossover basket `B* = Y ÷ d`.
 *
 * @param threshold spend threshold T (must trigger the coupon).
 * @param off amount Y subtracted at checkout.
 * @param basket the customer's actual basket size B.
 * @param straightPct the blanket discount d (%) the coupon is compared against.
 */
export function couponVsStraight(
  threshold: number,
  off: number,
  basket: number,
  straightPct: number,
): CouponResult {
  const t = nn(threshold);
  const y = nn(off);
  const b = nn(basket);
  const d = Math.min(95, Math.max(0, nn(straightPct))) / 100;

  const triggered = t > 0 && b >= t && y > 0;
  const couponSavings = triggered ? y : 0;
  const straightSavings = b * d;

  return {
    faceRatePct: t > 0 ? (y / t) * 100 : 0,
    triggered,
    gapToTrigger: t > 0 && b < t ? t - b : 0,
    effectiveRatePct: triggered && b > 0 ? (y / b) * 100 : 0,
    finalPriceCoupon: b - couponSavings,
    finalPriceStraight: b - straightSavings,
    savingsDifference: couponSavings - straightSavings,
    crossOverBasket: d > 0 && y > 0 ? y / d : null,
    sane: t > 0 && y < t,
  };
}

/* ============================== Presets ==================================== */

/** Scenario presets: one per business archetype, stated per month. */
export type DiscountPreset = {
  id: string;
  /** Short button label. */
  label: string;
  /** What the archetype is (rendered as the preset's hint). */
  description: string;
  /** Noun for the unit being counted — used in copy only. */
  unitNoun: string;
  inputs: DiscountInputs;
  /** The volume response the archetype's team realistically believes in. */
  expectedUpliftPct: number;
};

export const DISCOUNT_PRESETS: DiscountPreset[] = [
  {
    id: 'saas',
    label: 'SaaS subscription',
    description: 'Accounts on a $79/mo plan; hosting & support run ~$8/account. The 20%-off annual promo.',
    unitNoun: 'subscriber accounts',
    inputs: { price: 79, unitCost: 8, volume: 400, discountPct: 20 },
    expectedUpliftPct: 25,
  },
  {
    id: 'product',
    label: 'Physical product',
    description: 'An $89 gadget; $41 landed COGS per unit. The classic 20%-off sitewide sale.',
    unitNoun: 'units sold',
    inputs: { price: 89, unitCost: 41, volume: 300, discountPct: 20 },
    expectedUpliftPct: 25,
  },
  {
    id: 'service',
    label: 'Service delivery',
    description: 'Consulting at $150/billed hour; $35/hour delivery cost. The 10% "client loyalty" rate.',
    unitNoun: 'billed hours',
    inputs: { price: 150, unitCost: 35, volume: 160, discountPct: 10 },
    expectedUpliftPct: 10,
  },
];

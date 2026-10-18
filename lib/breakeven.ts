// Break-even / CVP (cost-volume-profit) model — the unit-economics instrument
// of the "Price" stage: given what a unit sells for, what it costs to deliver,
// and the overhead that lands regardless of volume, at what volume does the
// business stop losing money?
//
// The algebra is the classical cost-volume-profit canon (NAA "Direct Costing"
// research, 1953; Garrison, Noreen & Brewer, Managerial Accounting): revenue
// and total cost are straight lines in volume, and the break-even point is
// their intersection.
//
// 2025 parameter posture — stated deliberately: NO year-specific constants
// (tax rates, wage bases, inflation) enter this model. CVP algebra is
// time-invariant; the only conventions with a date are:
//  - Every input and every output is stated for the SAME period (the UI
//    defaults to monthly and carries a monthly/yearly label switch — annual
//    users flip the switch and enter annual figures; the ratio outputs are
//    period-invariant either way).
//  - Price is constant across the scanned range (no volume discounts), and
//    variable cost is strictly proportional to volume.
//  - Fixed costs are truly fixed across the relevant range (no step costs).
//
// Documented assumptions (surfaced on the page's methodology section):
//  - Single product, or a blended "average unit" for multi-product businesses
//    (the weighted-average treatment is covered in the on-page guide).
//  - Accrual profit semantics: break-even is "operating profit = 0", not
//    "cash = 0" — cash-out-date is the SaaS Runway tool's job.
//  - Selling below variable cost (price ≤ variable cost) has no break-even
//    volume: every unit sold deepens the loss. The model returns `null`
//    there instead of inventing a number.

/** Clamp to the non-negative reals — the model has no meaningful negatives. */
function nn(n: number): number {
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/**
 * Contribution margin per unit — what each sale contributes toward covering
 * fixed costs and, beyond break-even, profit.
 *
 * Formula: `CM = price − variable cost per unit`
 *
 * Returns the raw difference (may be ≤ 0 — that state is a finding, not an
 * error; callers surface it as "no break-even exists").
 */
export function contributionMargin(price: number, unitVariableCost: number): number {
  return nn(price) - nn(unitVariableCost);
}

/**
 * Contribution-margin ratio — the share of every revenue dollar that survives
 * after variable costs. Drives the revenue-denominated break-even.
 *
 * Formula: `CM% = (price − variable cost) ÷ price`
 *
 * @returns fraction in [−∞, 1]; `null` when price ≤ 0 (ratio undefined).
 */
export function cmRatio(price: number, unitVariableCost: number): number | null {
  const p = nn(price);
  if (p <= 0) return null;
  return (p - nn(unitVariableCost)) / p;
}

/**
 * Break-even volume in units — the quantity where operating profit is exactly
 * zero: total revenue = fixed costs + total variable cost.
 *
 * Formula: `Q* = fixed costs ÷ (price − variable cost per unit)`
 *
 * @returns units (0 when fixed costs are 0 and the margin is positive — the
 * first sale is already profitable); `null` whenever the contribution margin
 * is ≤ 0. With cm < 0 every unit sold deepens the loss; with cm = 0 no volume
 * ever turns profit positive. "Selling nothing" (Q = 0 when F = 0) is not a
 * business breaking even, so the F = 0 corner does NOT carve out a 0 — the
 * tool must never advertise a 0-unit target for a product that loses money
 * on every sale (the file-header contract).
 */
export function breakEvenUnits(
  fixedCosts: number,
  price: number,
  unitVariableCost: number,
): number | null {
  const cm = contributionMargin(price, unitVariableCost);
  const fc = nn(fixedCosts);
  if (cm <= 0) return null;
  return fc / cm;
}

/**
 * Break-even revenue — the sales level where operating profit is zero.
 *
 * Formula: `R* = Q* × price = fixed costs ÷ CM ratio`
 *
 * Equivalent to `fixed costs × price ÷ (price − variable cost)`; computed from
 * the unit break-even so the two outputs can never disagree.
 *
 * @returns revenue in currency units; `null` under the same conditions as
 * `breakEvenUnits`, or when price ≤ 0.
 */
export function breakEvenRevenue(
  fixedCosts: number,
  price: number,
  unitVariableCost: number,
): number | null {
  const q = breakEvenUnits(fixedCosts, price, unitVariableCost);
  if (q === null) return null;
  return q * nn(price);
}

/**
 * Operating profit at a volume — the CVP profit equation.
 *
 * Formula: `π(Q) = Q × (price − variable cost) − fixed costs`
 *
 * Returns the raw value (negative = loss); volume is clamped to ≥ 0.
 */
export function profitAt(
  units: number,
  fixedCosts: number,
  price: number,
  unitVariableCost: number,
): number {
  return nn(units) * contributionMargin(price, unitVariableCost) - nn(fixedCosts);
}

/** Full input bundle for the aggregate result below. Period-consistent (monthly in the UI). */
export type BreakEvenInputs = {
  /** Costs that land regardless of volume, per period (rent, salaries, tools). */
  fixedCosts: number;
  /** Price charged per unit, per period basis for subscriptions. */
  price: number;
  /** Cost that scales 1:1 with each unit sold (COGS, hosting, fees, delivery). */
  unitVariableCost: number;
  /** Volume actually sold (or forecast) per period — anchors margin of safety. */
  currentUnits: number;
};

export type BreakEvenResult = {
  /** Contribution margin per unit (currency). May be ≤ 0 — see `status`. */
  contributionMargin: number;
  /** CM ratio as a percentage (e.g. 89.9); `null` when price ≤ 0. */
  cmRatioPct: number | null;
  breakEvenUnits: number | null;
  breakEvenRevenue: number | null;
  /**
   * First whole unit whose sale turns profit strictly positive:
   * `floor(Q*) + 1`. At an exactly integral Q* the zero-profit unit itself
   * does not qualify (its profit is 0, not positive), which is why this is
   * floor+1 rather than ceil — ceil(Q*) would return the flat unit when Q*
   * lands on an integer (e.g. F=100, P=10, V=5 → Q*=20, first profitable
   * unit #21). `null` when no break-even exists.
   */
  firstProfitableUnit: number | null;
  /** Revenue at the current volume. */
  currentRevenue: number;
  /** Operating profit at the current volume. */
  profitAtCurrent: number;
  /** Current volume minus break-even volume (negative = still in the loss wedge). */
  marginOfSafetyUnits: number | null;
  /** Same gap denominated in revenue. */
  marginOfSafetyRevenue: number | null;
  /**
   * Margin-of-safety percentage: `(current − Q*) ÷ current × 100`.
   * How much volume can fall before profit hits zero. `null` when the current
   * volume is 0 or no break-even exists.
   */
  marginOfSafetyPct: number | null;
  /**
   * Degree of operating leverage at the current volume:
   * `DOL = total contribution margin ÷ operating profit = Q·CM ÷ π(Q)`.
   * A DOL of 2 means ±10% volume moves profit ±20%. `null` when profit ≤ 0
   * (leverage through a loss is not a meaningful number).
   */
  operatingLeverage: number | null;
  status: 'above-be' | 'below-be' | 'at-be' | 'impossible';
};

/** Aggregate CVP readout from one input bundle — everything the UI shows. */
export function computeBreakEven(inputs: BreakEvenInputs): BreakEvenResult {
  const { fixedCosts, price, unitVariableCost, currentUnits } = {
    fixedCosts: nn(inputs.fixedCosts),
    price: nn(inputs.price),
    unitVariableCost: nn(inputs.unitVariableCost),
    currentUnits: nn(inputs.currentUnits),
  };

  const cm = price - unitVariableCost;
  const ratio = cmRatio(price, unitVariableCost);
  const beUnits = breakEvenUnits(fixedCosts, price, unitVariableCost);
  const beRevenue = breakEvenRevenue(fixedCosts, price, unitVariableCost);

  const currentRevenue = currentUnits * price;
  const profit = profitAt(currentUnits, fixedCosts, price, unitVariableCost);

  const mosUnits = beUnits === null ? null : currentUnits - beUnits;
  const mosRevenue = beRevenue === null ? null : currentRevenue - beRevenue;
  const mosPct =
    beUnits === null || currentUnits <= 0 ? null : ((currentUnits - beUnits) / currentUnits) * 100;

  const totalCm = currentUnits * cm;
  const dol = profit > 0 && cm > 0 ? totalCm / profit : null;

  let status: BreakEvenResult['status'];
  if (beUnits === null) status = 'impossible';
  else if (Math.abs(profit) < 0.005) status = 'at-be';
  else status = profit > 0 ? 'above-be' : 'below-be';

  return {
    contributionMargin: cm,
    cmRatioPct: ratio === null ? null : ratio * 100,
    breakEvenUnits: beUnits,
    breakEvenRevenue: beRevenue,
    firstProfitableUnit: beUnits !== null ? Math.floor(beUnits) + 1 : null,
    currentRevenue,
    profitAtCurrent: profit,
    marginOfSafetyUnits: mosUnits,
    marginOfSafetyRevenue: mosRevenue,
    marginOfSafetyPct: mosPct,
    operatingLeverage: dol,
    status,
  };
}

/** One point of the break-even-vs-price curve. `breakEvenUnits` is `null` where price ≤ variable cost. */
export type SweepPoint = {
  price: number;
  /** Contribution margin at this price. */
  cm: number;
  breakEvenUnits: number | null;
  breakEvenRevenue: number | null;
};

/**
 * Break-even point as price scans across a band around the current price —
 * the price-setting curve. Each point re-solves `Q*(p) = F ÷ (p − V)`.
 *
 * @param fromRatio band start as a share of `basePrice` (default 0.6)
 * @param toRatio   band end as a share of `basePrice` (default 1.6)
 * @param steps     number of evenly spaced price points (default 25)
 * @returns points sorted by price; `[]` when `basePrice ≤ 0`.
 */
export function priceSweep(
  fixedCosts: number,
  basePrice: number,
  unitVariableCost: number,
  fromRatio = 0.6,
  toRatio = 1.6,
  steps = 25,
): SweepPoint[] {
  const base = nn(basePrice);
  if (base <= 0 || steps < 2) return [];
  const out: SweepPoint[] = [];
  for (let i = 0; i < steps; i++) {
    const price = base * (fromRatio + ((toRatio - fromRatio) * i) / (steps - 1));
    out.push({
      price,
      cm: contributionMargin(price, unitVariableCost),
      breakEvenUnits: breakEvenUnits(fixedCosts, price, unitVariableCost),
      breakEvenRevenue: breakEvenRevenue(fixedCosts, price, unitVariableCost),
    });
  }
  return out;
}

export type SensitivityRow = {
  driver: 'price' | 'unitVariableCost' | 'fixedCosts';
  label: string;
  /** Break-even units with the driver lowered 10% (`null` = no break-even there). */
  down: number | null;
  /** Break-even units with the driver raised 10% (`null` = no break-even there). */
  up: number | null;
};

/**
 * ±10% sensitivity of the break-even volume to each driver — the tornado
 * behind "raise price vs cut cost". Each cell re-solves the full
 * `F ÷ (P − V)` with one driver perturbed, everything else held fixed.
 */
export function sensitivityGrid(inputs: BreakEvenInputs): SensitivityRow[] {
  const f = nn(inputs.fixedCosts);
  const p = nn(inputs.price);
  const v = nn(inputs.unitVariableCost);
  return [
    {
      driver: 'price',
      label: 'Price per unit',
      down: breakEvenUnits(f, p * 0.9, v),
      up: breakEvenUnits(f, p * 1.1, v),
    },
    {
      driver: 'unitVariableCost',
      label: 'Variable cost per unit',
      down: breakEvenUnits(f, p, v * 0.9),
      up: breakEvenUnits(f, p, v * 1.1),
    },
    {
      driver: 'fixedCosts',
      label: 'Fixed costs',
      down: breakEvenUnits(f * 0.9, p, v),
      up: breakEvenUnits(f * 1.1, p, v),
    },
  ];
}

/**
 * Price-rise volume tolerance — the decision-boundary number for "raise the
 * price or cut the cost?". Solves for the customer-loss share `e` at which a
 * `risePct` price increase leaves operating profit exactly unchanged:
 *
 * `(1 − e) × (P(1 + r) − V) = P − V` → `e* = 1 − (P − V) ÷ (P(1 + r) − V)`
 *
 * Lose a smaller share of volume than `e*` and the price rise is pure gain;
 * lose more and it was the wrong lever. Symmetric logic (with VC in place of
 * price) governs a variable-cost cut.
 *
 * @returns tolerance as a percentage of current volume (e.g. 10.0), or `null`
 * when the current contribution margin is ≤ 0.
 */
export function priceRiseTolerance(price: number, unitVariableCost: number, risePct = 10): number | null {
  const p = nn(price);
  const v = nn(unitVariableCost);
  const cm = p - v;
  if (cm <= 0) return null;
  const newCm = p * (1 + risePct / 100) - v;
  return (1 - cm / newCm) * 100;
}

/** Scenario presets: one per business archetype, stated per month. */
export type BreakEvenPreset = {
  id: string;
  /** Short button label. */
  label: string;
  /** What the archetype is (rendered as the preset's hint). */
  description: string;
  /** Noun for the unit being counted — used in copy only. */
  unitNoun: string;
  inputs: BreakEvenInputs;
};

export const BREAKEVEN_PRESETS: BreakEvenPreset[] = [
  {
    id: 'saas',
    label: 'SaaS subscription',
    description: 'Accounts on a $79/mo plan; hosting & support run ~$8/account; team + infra overhead $12k/mo.',
    unitNoun: 'subscriber accounts',
    inputs: { fixedCosts: 12000, price: 79, unitVariableCost: 8, currentUnits: 400 },
  },
  {
    id: 'product',
    label: 'Physical product',
    description: 'An $89 gadget; $41 landed COGS per unit (manufacture, freight, fees); $6.5k/mo operating base.',
    unitNoun: 'units sold',
    inputs: { fixedCosts: 6500, price: 89, unitVariableCost: 41, currentUnits: 300 },
  },
  {
    id: 'service',
    label: 'Service delivery',
    description: 'Consulting at $150/billed hour; $35/hour delivery cost (subcontractor + tooling); $9k/mo base.',
    unitNoun: 'billed hours',
    inputs: { fixedCosts: 9000, price: 150, unitVariableCost: 35, currentUnits: 160 },
  },
];

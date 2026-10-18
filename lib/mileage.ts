// Vehicle mileage deduction model — standard mileage rate vs the
// actual-expense method, US federal, tax year 2025.
//
// A Sustain-stage companion to lib/homeoffice.ts: after the entity is
// structured and the owner paid, this prices the other deduction that moves
// with how you actually run the business — the business use of a vehicle.
//
// Simplified, illustrative model — NOT tax advice.
//
// Method parameters (tax year 2025):
//
//   Standard mileage rate (IRS — the annual rate is set by notice, not by a
//   revenue procedure; for 2025 it is Notice 2025-5, announced December 2024
//   via news release IR-2024-312):
//     deduction = $0.70 × business miles
//   The rate bundles gas, oil, repairs, tires, insurance, license,
//   registration and depreciation. It therefore INCLUDES a depreciation
//   component of $0.33/mile for 2025 (Notice 2025-5) — a standard-rate filer
//   may not separately depreciate the vehicle, §179 it, or claim bonus
//   depreciation on it. Parking and tolls are NOT in the rate: they are 100%
//   deductible under either method and simply not modeled here.
//
//   Actual-expense method (Pub 463):
//     deduction = business-use share × total annual operating cost
//   where share is the share of the vehicle's use that is business — most
//   commonly measured in miles (business ÷ total), which is why this model
//   also exposes the implied total mileage of the entered inputs. The cost
//   lines modeled: depreciation (or lease payments), fuel & electricity,
//   insurance, maintenance & repairs, registration & fees. Self-employed
//   filers may also include the business share of vehicle-loan interest;
//   that line is not modeled (stated in assumptions).
//
//   Eligibility fences on the standard rate (stated, not computed): a taxpayer
//   who operates five or more vehicles at the same time may not use it; a
//   taxpayer who claimed §179/bonus/accelerated MACRS depreciation on the
//   vehicle may never use it; a lessee who uses it must use it for the whole
//   lease term. Using the standard rate in the vehicle's FIRST year preserves
//   the right to switch to actual later (depreciation then straight-line only).
//
// Commuting (the口径 this tool asserts): daily travel between home and a
//   regular place of work is PERSONAL — commuting miles are never business
//   miles under either method. Trips between two business locations in a day
//   are business miles. If a home office is the taxpayer's principal place of
//   business, trips from home to other work locations are business miles too
//   (that qualification is priced by lib/homeoffice.ts, not here). The
//   business-miles input is the count AFTER applying these rules.
//
// Neutral mileage (the crossover this page centers on):
//     standard(m) = r × m   is linear in miles;  actual is flat at share × C.
//     They tie at  m* = share × C ÷ r      (closed form, miles)
//   The engine also finds the crossover by SCANNING at 1-mile resolution and
//   reporting the first whole mile at which the comparison winner flips to
//   'standard'; because the winner comparison carries a $0.50 tie tolerance,
//   the scan value sits up to ~2 whole miles above the closed form. Both are
//   surfaced; they are cross-checks on each other.
//
// Tax-saving mechanics (marginalSaving — same shape as lib/homeoffice.ts):
//     Income-tax layer : r_user × D
//     Schedule C layer : 0.9235 × 15.3% × D of SE tax while SE earnings stay
//                        below the 2025 Social Security wage base ($176,100);
//                        half of the SE tax saved was itself an income-tax
//                        deduction, clawing back r_user × (SE saved ÷ 2).
//
// NOT modeled (surfaced as stated assumptions in the UI and guide):
//   - Parking and tolls (100% deductible either way, outside both formulas).
//   - Vehicle-loan interest's business share (actual method, self-employed).
//   - §280F luxury-automobile depreciation caps and lease inclusion amounts.
//   - §199A/QBI interplay (each $1 of deduction shrinks QBI by $1, trimming
//     the §199A deduction by up to 20¢). Note: unlike the home-office
//     deduction, vehicle expenses carry NO §280A(c)(5) gross-income cap —
//     both methods are ordinary §162 costs that can create or deepen a
//     Schedule C loss; the only income-limited slice is §179 expensing
//     inside the actual method (active business-income limit, carryover).
//     Downstream at-risk / passive-loss treatment of any loss is not modeled.
//   - State mileage rates and FAVR allowances.
//   - Basis recovery on switching methods / selling the vehicle — priced in
//     the guide as 33¢/mile of standard-rate deductions (Notice 2025-5), not
//     computed per user input.

export const MILEAGE_CONSTANTS_2025 = {
  /** Business standard mileage rate, 2025: 70¢/mi (IRS Notice 2025-5). */
  standardRatePerMile: 0.7,
  /** Depreciation component inside the 2025 rate: 33¢/mi (Notice 2025-5). */
  depreciationComponentPerMile: 0.33,
  /** Business standard mileage rate, 2024: 67¢/mi (IR-2023-239). */
  standardRate2024PerMile: 0.67,
  /** Business standard mileage rate, 2026 H1: 72.5¢/mi (IR-2025-128). */
  standardRate2026H1PerMile: 0.725,
  /** Business standard mileage rate, 2026 H2: 76¢/mi (IRB 2026-29, mid-year raise). */
  standardRate2026H2PerMile: 0.76,
  /** Schedule SE: SE tax applies to 92.35% of net self-employment earnings. */
  seBaseFactor: 0.9235,
  /** 12.4% Social Security + 2.9% Medicare — both halves. */
  seRate: 0.153,
  /** 2025 Social Security wage base; the 15.3% SE slice applies below it. */
  ssWageBase2025: 176100,
} as const;

export type MileageInputs = {
  /** Annual qualifying BUSINESS miles (commuting excluded by definition). */
  businessMiles: number;
  /** Annual depreciation on the vehicle (or lease payments), actual method. */
  depreciation: number;
  /** Annual fuel and/or electricity cost. */
  fuelEnergy: number;
  /** Annual insurance. */
  insurance: number;
  /** Annual maintenance, repairs, tires, oil. */
  maintenance: number;
  /** Annual license, registration and fees. */
  registration: number;
  /**
   * Business-use share of the vehicle, percent (0–100). Drives the actual
   * method only; the standard method multiplies miles directly.
   */
  businessSharePct: number;
};

export type StandardMethod = {
  /** Business miles used (floored at 0). */
  miles: number;
  /** 2025 rate applied ($0.70/mi). */
  rate: number;
  /** rate × miles. */
  deduction: number;
  /**
   * Depreciation embedded in the deduction — 33¢/mi for 2025 — i.e. the
   * amount that reduces the vehicle's basis and cannot be double-counted by
   * claiming MACRS/§179 on the same car (Notice 2025-5).
   */
  embeddedDepreciation: number;
};

/**
 * Standard mileage method.
 *
 * Formula (2025): deduction = $0.70 × max(0, businessMiles), of which
 * $0.33/mile is treated as depreciation (basis must be reduced by it).
 * Source nature: IRS administrative notice (Notice 2025-5), statutory hook
 * §62(b)(1) / Rev. Proc. ancestry; announced annually in December.
 */
export function standardMethod(businessMiles: number): StandardMethod {
  const miles = Math.max(0, businessMiles);
  const { standardRatePerMile: rate, depreciationComponentPerMile: dep } = MILEAGE_CONSTANTS_2025;
  return {
    miles,
    rate,
    deduction: miles * rate,
    embeddedDepreciation: miles * dep,
  };
}

export type ActualMethodBreakdown = {
  /** Business-use share as a fraction in [0, 1] (percent input clamped). */
  share: number;
  /** depreciation + fuelEnergy + insurance + maintenance + registration. */
  totalCost: number;
  /** share × each cost line. */
  deductibleDepreciation: number;
  deductibleFuelEnergy: number;
  deductibleInsurance: number;
  deductibleMaintenance: number;
  deductibleRegistration: number;
  /** share × totalCost. */
  deduction: number;
  /**
   * The actual method's implied rate at the entered business miles:
   * deduction ÷ miles — compare directly to the 70¢ standard rate.
   */
  effectiveRatePerMile: number | null;
};

/**
 * Actual-expense method (Pub 463): business share × total annual cost.
 *
 * Formula (2025): deduction = share × (depreciation + fuel & energy +
 * insurance + maintenance + registration). The share is user-supplied (in
 * practice usually business miles ÷ total miles); parking and tolls are
 * separately 100% deductible and deliberately excluded from both methods.
 */
export function actualMethod(inputs: MileageInputs): ActualMethodBreakdown {
  const share = Math.min(Math.max(inputs.businessSharePct, 0), 100) / 100;
  const dep = Math.max(0, inputs.depreciation);
  const fuel = Math.max(0, inputs.fuelEnergy);
  const ins = Math.max(0, inputs.insurance);
  const maint = Math.max(0, inputs.maintenance);
  const reg = Math.max(0, inputs.registration);
  const totalCost = dep + fuel + ins + maint + reg;
  const miles = Math.max(0, inputs.businessMiles);

  return {
    share,
    totalCost,
    deductibleDepreciation: share * dep,
    deductibleFuelEnergy: share * fuel,
    deductibleInsurance: share * ins,
    deductibleMaintenance: share * maint,
    deductibleRegistration: share * reg,
    deduction: share * totalCost,
    effectiveRatePerMile: miles > 0 ? (share * totalCost) / miles : null,
  };
}

export type MarginalSaving = {
  /** r × D — income tax saved at the marginal rate r. */
  incomeTax: number;
  /** Schedule C only: 0.9235 × 15.3% × D of SE tax saved (0 when excluded). */
  seTax: number;
  /** r × (seTax ÷ 2) — income-tax cost of the smaller half-SE deduction. */
  halfSeClawback: number;
  /** seTax + incomeTax. */
  total: number;
};

/**
 * Tax saved by one dollar-amount of deduction at a marginal rate.
 *
 * Formulas (2025):
 *   Income tax only : total = r × D
 *   Schedule C      : S_se  = 0.9235 × 15.3% × D  (SE tax reduction, valid
 *                     below the $176,100 SS wage base)
 *                     total = S_se + r × (D − S_se ÷ 2)
 * The clawback: saving SE tax also shrinks the deduct-half-of-SE-tax
 * adjustment, raising income tax by r × S_se ÷ 2.
 */
export function marginalSaving(
  deduction: number,
  marginalRatePct: number,
  includeSeTax: boolean,
): MarginalSaving {
  const d = Math.max(0, deduction);
  const r = Math.min(Math.max(0, marginalRatePct), 100) / 100;
  const seTax = includeSeTax
    ? d * MILEAGE_CONSTANTS_2025.seBaseFactor * MILEAGE_CONSTANTS_2025.seRate
    : 0;
  const halfSeClawback = r * (seTax / 2);
  const incomeTax = r * d - halfSeClawback;
  return { incomeTax, seTax, halfSeClawback, total: seTax + incomeTax };
}

export type MethodOutcome = {
  deduction: number;
  saving: MarginalSaving;
};

export type MileageComparison = {
  standard: MethodOutcome & { breakdown: StandardMethod };
  actual: MethodOutcome & { breakdown: ActualMethodBreakdown };
  /** Which method deducts more (0.5-dollar tolerance for float noise). */
  winner: 'standard' | 'actual' | 'tie';
  /** actual − standard (positive = actual deducts more). */
  deductionDelta: number;
  /** actual.saving.total − standard.saving.total (same sign as above). */
  savingDelta: number;
  /**
   * Total annual miles implied when the business share is measured in miles:
   * businessMiles ÷ share. Null when share ≤ 0. A sanity anchor, not an
   * input — if it reads implausibly high the share and mileage disagree.
   */
  impliedTotalMiles: number | null;
};

/**
 * Full standard-vs-actual comparison at one set of inputs.
 *
 * The winner compares DEDUCTIONS — marginalSaving is strictly increasing in
 * the deduction, so at a fixed marginal rate the saving ordering is identical
 * and the ranking is rate-invariant.
 */
export function compareMileage(
  inputs: MileageInputs,
  marginalRatePct: number,
  includeSeTax: boolean,
): MileageComparison {
  const std = standardMethod(inputs.businessMiles);
  const act = actualMethod(inputs);
  const standard: MileageComparison['standard'] = {
    deduction: std.deduction,
    saving: marginalSaving(std.deduction, marginalRatePct, includeSeTax),
    breakdown: std,
  };
  const actual: MileageComparison['actual'] = {
    deduction: act.deduction,
    saving: marginalSaving(act.deduction, marginalRatePct, includeSeTax),
    breakdown: act,
  };
  let winner: MileageComparison['winner'] = 'tie';
  if (actual.deduction > standard.deduction + 0.5) winner = 'actual';
  else if (standard.deduction > actual.deduction + 0.5) winner = 'standard';

  return {
    standard,
    actual,
    winner,
    deductionDelta: actual.deduction - standard.deduction,
    savingDelta: actual.saving.total - standard.saving.total,
    impliedTotalMiles: act.share > 0 ? Math.max(0, inputs.businessMiles) / act.share : null,
  };
}

export type NeutralPoint = {
  /**
   * Closed-form crossover: share × totalCost ÷ rate (exact float miles).
   * Null when the actual deduction is at or below the comparison's own $0.50
   * tie tolerance — a deliberate reporting floor for a degenerate regime, not
   * a claim that no crossing exists. The curves still cross for any positive
   * actual side, but a crossover at ≤ $0.50 ÷ $0.70 ≈ 0.71 mi sits below the
   * first whole mile: with rate $0.70, winner='standard' needs 0.70×m > act +
   * 0.50, so for act < $0.20 the standard rate already wins at m = 1, and for
   * act ∈ [$0.20, $0.50] m = 1 is a tie with the first 'standard' mile at
   * m = 2. Either way the flip is an artifact of the tolerance band at
   * sub-mile scale, and is reported as null rather than as a crossover.
   */
  exactMiles: number | null;
  /**
   * First WHOLE mile at which the engine's winner flips to 'standard',
   * found by scanning mileage upward at 1-mile resolution (coarse 50-mile
   * bracket, then a 1-mile refine). Null when no flip occurs within
   * scanMaxMiles. Sits up to ~2 miles above exactMiles because the winner
   * comparison carries the $0.50 tolerance.
   */
  engineFlipMiles: number | null;
};

/**
 * The neutral mileage — where the two methods tie.
 *
 * Definition: standard(m) = rate × m grows linearly while actual stays flat
 * at share × totalCost, so exactly one crossing exists whenever the actual
 * side is positive — but crossings with an actual side of $0.50 or less are
 * deliberately NOT reported (see NeutralPoint.exactMiles for the band math).
 * This function returns BOTH cross-checks:
 *
 *   - exactMiles: the closed form share × C ÷ rate, and
 *   - engineFlipMiles: the scan result — the first whole business-mile count
 *     at which compareMileage (with its $0.50 tie tolerance) reports
 *     'standard' as the winner.
 *
 * Below the neutral mileage the flat actual line is above the standard line;
 * above it, every additional business mile pays 70¢ under the standard rate
 * while the actual side does not move.
 */
export function neutralMileage(inputs: MileageInputs, scanMaxMiles = 200_000): NeutralPoint {
  const { deduction: actualDeduction } = actualMethod(inputs);
  const rate = MILEAGE_CONSTANTS_2025.standardRatePerMile;
  // Reporting floor, aligned with the winner comparison's own tolerance: an
  // actual side ≤ $0.50 puts the closed-form crossing under ~0.71 mi. The
  // regime is not "standard from mile one" everywhere — act < $0.20 does flip
  // at m = 1, but act ∈ [$0.20, $0.50] ties at m = 1 and first flips at m = 2
  // (0.70×2 = 1.40 > act + 0.50). Those sub-mile flips are tolerance-band
  // artifacts; report null instead. Band math: NeutralPoint.exactMiles above.
  if (actualDeduction <= 0.5 || rate <= 0) return { exactMiles: null, engineFlipMiles: null };

  const exact = actualDeduction / rate;

  // Coarse bracket: 50-mile steps until the engine's winner is 'standard'.
  const winnerAt = (m: number) =>
    compareMileage({ ...inputs, businessMiles: m }, 0, false).winner;
  const step = 50;
  let lo = 0;
  let hi = -1;
  for (let m = 0; m <= scanMaxMiles; m += step) {
    if (winnerAt(m) === 'standard') {
      hi = m;
      break;
    }
    lo = m;
  }
  if (hi < 0) return { exactMiles: exact > scanMaxMiles ? null : exact, engineFlipMiles: null };

  // Refine to 1-mile resolution inside the bracket.
  for (let m = Math.max(1, lo + 1); m <= hi; m++) {
    if (winnerAt(m) === 'standard') return { exactMiles: exact, engineFlipMiles: m };
  }
  return { exactMiles: exact, engineFlipMiles: hi };
}

/**
 * Mileage sweep for the sensitivity chart: both methods' deductions as
 * business miles grow, costs and share held fixed. The standard series is a
 * straight line of slope $0.70; the actual series is flat.
 */
export function mileageSweep(
  inputs: MileageInputs,
  maxMiles?: number,
  steps = 61,
): { miles: number; standardDeduction: number; actualDeduction: number }[] {
  const base = neutralMileage(inputs);
  const top =
    maxMiles ??
    Math.max(
      Math.max(0, inputs.businessMiles) * 1.6,
      base.exactMiles !== null ? base.exactMiles * 1.3 : 0,
      1000,
    );
  const to = Math.max(100, top);
  const n = Math.max(2, steps);
  const out: { miles: number; standardDeduction: number; actualDeduction: number }[] = [];
  for (let i = 0; i < n; i++) {
    const miles = (to * i) / (n - 1);
    out.push({
      miles,
      standardDeduction: standardMethod(miles).deduction,
      actualDeduction: actualMethod({ ...inputs, businessMiles: miles }).deduction,
    });
  }
  return out;
}

export type BoundaryFlips = {
  /** First whole business mile where the winner flips to 'standard'. */
  mileageFlip: number | null;
  /** First whole-dollar annual cost where the winner flips to 'actual'. */
  costFlip: number | null;
  /** First whole-percent business share where the winner flips to 'actual'. */
  shareFlip: number | null;
};

/**
 * Canonical decision-boundary scans shared by the deep-dive guide and the
 * scenario footnote: (a) business mileage at 1-mile resolution — the same
 * flip neutralMileage reports; (b) annual vehicle cost at $1 resolution
 * (applied to the depreciation line, other lines zeroed); (c) business-use
 * share at whole-percent resolution. Each reports the FIRST input at which
 * compareMileage's winner — with its $0.50 tie tolerance — flips.
 *
 * These run at render/build time against this same engine, so every
 * published flip value is computed rather than hand-typed and cannot drift
 * from the arithmetic the widget runs (the closed forms — deduction ÷ share
 * for cost, share × cost ÷ rate for mileage — remain the cross-checks).
 */
export function boundaryScans(base: MileageInputs): BoundaryFlips {
  const winnerAt = (patch: Partial<MileageInputs>) =>
    compareMileage({ ...base, ...patch }, 0, false).winner;

  const mileageFlip = neutralMileage(base).engineFlipMiles;

  let costFlip: number | null = null;
  for (let c = 0; c <= 20000; c++) {
    if (
      winnerAt({ depreciation: c, fuelEnergy: 0, insurance: 0, maintenance: 0, registration: 0 }) ===
      'actual'
    ) {
      costFlip = c;
      break;
    }
  }

  let shareFlip: number | null = null;
  for (let s = 0; s <= 100; s++) {
    if (winnerAt({ businessSharePct: s }) === 'actual') {
      shareFlip = s;
      break;
    }
  }

  return { mileageFlip, costFlip, shareFlip };
}

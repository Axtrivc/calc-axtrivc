// Home-office deduction model — the simplified option vs the actual-expense
// method, US federal, tax year 2025.
//
// A companion instrument to lib/scorp.ts at the Sustain stage of the suite:
// once the business is structured (stage 3) and the owner is paid (stage 4),
// this prices the most commonly missed Schedule C deduction — the business
// use of the home.
//
// Simplified, illustrative model — NOT tax advice.
//
// Method parameters (tax year 2025; the simplified option is unchanged since
// Rev. Proc. 2013-13):
//
//   Simplified option:
//     deduction = $5 × min(business-use sq ft, 300)     → hard cap $1,500/yr
//     No depreciation, no expense allocation records, and any amount lost to
//     the gross-income limit CANNOT be carried to a later year.
//
//   Actual method (Form 8829):
//     business share = office sq ft ÷ home sq ft        (capped at 100%)
//     deduction      = share × (annual indirect home expenses + depreciation)
//     Renters: rent + utilities + insurance + repairs.
//     Owners:   mortgage interest + property taxes + utilities + insurance +
//               repairs + depreciation. Excess over the gross-income limit
//               carries forward to later years.
//
//   Depreciation (owners only):
//     The office share of the home's cost basis (EXCLUDING land) is
//     depreciated straight-line over 39 years, mid-month convention:
//     full-year rate = 1/39 ≈ 2.5641%/yr (Pub 946 Table A-7a). The FIRST tax
//     year is prorated by month placed in service and runs lower (e.g.
//     2.461% for January); this model uses the full-year rate and says so.
//
//   Election rules: exactly ONE method per tax year (never both in the same
//     year), freely switchable from year to year.
//
// Tax-saving mechanics (marginalSaving):
//     Income-tax layer : r × D, where r is the user's marginal income-tax
//                        rate and D the deduction.
//     Schedule C layer : for sole proprietors the deduction also reduces net
//                        self-employment income, saving SE tax of
//                        0.9235 × 15.3% × D — valid while SE earnings stay
//                        below the 2025 Social Security wage base of
//                        $176,100; above it only the 2.9% Medicare layer
//                        applies (not modeled). Half of the SE tax saved is
//                        simultaneously a lost "half of SE tax" income-tax
//                        deduction, clawing back r × (SE saving ÷ 2).
//
// NOT modeled (surfaced as stated assumptions in the UI and guide):
//   - The gross-income limitation (there is no business-profit input): in
//     reality both methods are limited to business gross income minus other
//     business expenses; simplified loses the excess, actual carries it.
//   - QBI interaction: for §199A filers below the phase-out, each $1 of
//     deduction reduces qualified business income by $1, which shrinks the
//     §199A deduction itself by up to 20¢ — so the effective income-tax
//     rate on the deduction is ~80% of the bracket rate the user enters.
//   - State taxes, first-year depreciation proration, and depreciation
//     recapture on sale (unrecaptured §1250 gain, up to 25%).

export const HOME_OFFICE_CONSTANTS = {
  simplifiedRatePerSqFt: 5,
  simplifiedMaxSqFt: 300,
  simplifiedMaxDeduction: 1500,
  depreciationLifeYears: 39,
  /** Full-year MACRS rate for 39-year nonresidential real property (straight-line, mid-month). */
  depreciationAnnualRate: 1 / 39,
  /** Schedule SE: SE tax applies to 92.35% of net self-employment earnings. */
  seBaseFactor: 0.9235,
  /** 12.4% Social Security + 2.9% Medicare — both halves. */
  seRate: 0.153,
  /** 2025 Social Security wage base; the 15.3% SE slice applies below it. */
  ssWageBase2025: 176100,
};

export type Tenure = 'rent' | 'own';

export type HomeOfficeInputs = {
  homeSqFt: number;
  officeSqFt: number;
  tenure: Tenure;
  /** Annual rent — renters only. */
  rent: number;
  /** Annual mortgage interest — owners only. */
  mortgageInterest: number;
  /** Annual property taxes — owners only. */
  propertyTax: number;
  /** Home cost basis EXCLUDING land, for depreciation — owners only. */
  homeBasis: number;
  /** Annual utilities (whole home). */
  utilities: number;
  /** Annual homeowner's / renter's insurance (whole home). */
  insurance: number;
  /** Annual repairs & maintenance (whole home). */
  repairs: number;
};

/**
 * Simplified-option deduction.
 *
 * Formula (2025): deduction = $5 × min(max(0, officeSqFt), 300)
 *   → linear to 300 sq ft, flat at the $1,500 statutory ceiling beyond it.
 */
export function simplifiedDeduction(officeSqFt: number): number {
  const sqft = Math.min(Math.max(0, officeSqFt), HOME_OFFICE_CONSTANTS.simplifiedMaxSqFt);
  return sqft * HOME_OFFICE_CONSTANTS.simplifiedRatePerSqFt;
}

export type BusinessShare = {
  /** office ÷ home, in [0, 1]; 0 when the home size is 0. */
  fraction: number;
  /** True when officeSqFt > homeSqFt (a data error — fraction capped at 1). */
  clamped: boolean;
};

/**
 * Business-use share of the home.
 *
 * Formula (2025): share = office sq ft ÷ home sq ft, capped at 100%.
 * An office larger than the home is invalid input; the flag lets the UI warn
 * rather than silently computing a >100% share.
 */
export function businessShare(officeSqFt: number, homeSqFt: number): BusinessShare {
  const home = Math.max(0, homeSqFt);
  const office = Math.max(0, officeSqFt);
  if (home <= 0) return { fraction: 0, clamped: office > 0 };
  if (office > home) return { fraction: 1, clamped: true };
  return { fraction: office / home, clamped: false };
}

/**
 * Annual full-year depreciation of the home's depreciable basis.
 *
 * Formula (2025): depreciation = basis × 1/39 (≈ 2.5641%/yr) — 39-year
 * nonresidential real property, straight-line, mid-month convention, after
 * the first (month-prorated) year. Land is excluded from basis by statute.
 * Renters never have this line.
 */
export function annualDepreciation(homeBasis: number): number {
  return Math.max(0, homeBasis) * HOME_OFFICE_CONSTANTS.depreciationAnnualRate;
}

export type ActualMethodBreakdown = {
  /** office ÷ home (≤ 1). */
  share: number;
  /** Office area exceeded the home — inputs need fixing. */
  shareClamped: boolean;
  /** Tenure-specific line: rent, or mortgage interest + property taxes. */
  housingCost: number;
  /** Utilities + insurance + repairs. */
  operatingCost: number;
  /** Owners only; 0 for renters. */
  depreciation: number;
  /** share × housingCost. */
  deductibleHousing: number;
  /** share × operatingCost. */
  deductibleOperating: number;
  /** share × depreciation. */
  deductibleDepreciation: number;
  /** share × (housingCost + operatingCost + depreciation). */
  deduction: number;
  /**
   * share × (mortgage interest + property taxes), owners only. This slice was
   * already deductible on Schedule A for itemizers — claiming it as a home
   * office moves it to Schedule C (the new money is the SE-tax cut and any
   * rate/benefit arbitrage), it does not create a fresh deduction.
   */
  scheduleATransfer: number;
  /** (housingCost + operatingCost + depreciation) ÷ homeSqFt — compare to $5. */
  costPerSqFt: number;
  /**
   * Annual home running cost at which both methods tie for any office up to
   * 300 sq ft: derived from share·C = $5·office ⟺ C = $5 × homeSqFt.
   */
  breakevenAnnualHomeCost: number;
};

/**
 * Actual-expense method (Form 8829), broken into its components.
 *
 * Formula (2025):
 *   deduction = (office ÷ home) × (housing + operating + depreciation)
 * where renters' housing = rent and owners' housing = mortgage interest +
 * property taxes + depreciation (1/39 of ex-land basis).
 */
export function actualMethod(inputs: HomeOfficeInputs): ActualMethodBreakdown {
  const { fraction, clamped } = businessShare(inputs.officeSqFt, inputs.homeSqFt);
  const own = inputs.tenure === 'own';
  const housing = own
    ? Math.max(0, inputs.mortgageInterest) + Math.max(0, inputs.propertyTax)
    : Math.max(0, inputs.rent);
  const operating =
    Math.max(0, inputs.utilities) + Math.max(0, inputs.insurance) + Math.max(0, inputs.repairs);
  const depreciation = own ? annualDepreciation(inputs.homeBasis) : 0;
  const home = Math.max(0, inputs.homeSqFt);
  const total = housing + operating + depreciation;

  return {
    share: fraction,
    shareClamped: clamped,
    housingCost: housing,
    operatingCost: operating,
    depreciation,
    deductibleHousing: fraction * housing,
    deductibleOperating: fraction * operating,
    deductibleDepreciation: fraction * depreciation,
    deduction: fraction * total,
    scheduleATransfer: own ? fraction * housing : 0,
    costPerSqFt: home > 0 ? total / home : 0,
    breakevenAnnualHomeCost: HOME_OFFICE_CONSTANTS.simplifiedRatePerSqFt * home,
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
 *   Schedule C      : S_se  = 0.9235 × 15.3% × D   (SE tax reduction, below
 *                     the $176,100 SS base)
 *                     total = S_se + r × (D − S_se ÷ 2)
 * The second term's subtraction is the clawback: saving SE tax also shrinks
 * the deduct-half-of-SE-tax adjustment, raising income tax by r × S_se ÷ 2.
 */
export function marginalSaving(
  deduction: number,
  marginalRatePct: number,
  includeSeTax: boolean,
): MarginalSaving {
  const d = Math.max(0, deduction);
  const r = Math.min(Math.max(0, marginalRatePct), 100) / 100;
  const seTax = includeSeTax
    ? d * HOME_OFFICE_CONSTANTS.seBaseFactor * HOME_OFFICE_CONSTANTS.seRate
    : 0;
  const halfSeClawback = r * (seTax / 2);
  const incomeTax = r * d - halfSeClawback;
  return { incomeTax, seTax, halfSeClawback, total: seTax + incomeTax };
}

export type MethodOutcome = {
  deduction: number;
  saving: MarginalSaving;
};

export type HomeOfficeComparison = {
  simplified: MethodOutcome;
  actual: MethodOutcome & { breakdown: ActualMethodBreakdown };
  /** Which method deducts more (0.5-dollar tolerance for float noise). */
  winner: 'simplified' | 'actual' | 'tie';
  /** actual − simplified (positive = actual deducts more). */
  deductionDelta: number;
  /** actual.saving.total − simplified.saving.total (same sign as above). */
  savingDelta: number;
  /**
   * Office size beyond the 300-sq-ft cap where the actual method retakes the
   * lead when costPerSqFt < $5: share·C·x = $1,500 ⟹ x = 1,500 ÷ C.
   * Null when the actual method already leads within 300 sq ft (C ≥ $5), C
   * is 0, or the crossing falls outside the home.
   */
  crossoverSqFt: number | null;
};

/**
 * Full simplified-vs-actual comparison at one set of inputs.
 *
 * The winner compares DEDUCTIONS (not savings) — at a fixed marginal rate the
 * saving ordering is identical because marginalSaving is strictly increasing
 * in the deduction.
 */
export function compareHomeOffice(
  inputs: HomeOfficeInputs,
  marginalRatePct: number,
  includeSeTax: boolean,
): HomeOfficeComparison {
  const breakdown = actualMethod(inputs);
  const simplifiedD = simplifiedDeduction(inputs.officeSqFt);
  const simplified: MethodOutcome = {
    deduction: simplifiedD,
    saving: marginalSaving(simplifiedD, marginalRatePct, includeSeTax),
  };
  const actual: HomeOfficeComparison['actual'] = {
    deduction: breakdown.deduction,
    saving: marginalSaving(breakdown.deduction, marginalRatePct, includeSeTax),
    breakdown,
  };
  let winner: HomeOfficeComparison['winner'] = 'tie';
  if (actual.deduction > simplified.deduction + 0.5) winner = 'actual';
  else if (simplified.deduction > actual.deduction + 0.5) winner = 'simplified';

  const c = breakdown.costPerSqFt;
  let crossoverSqFt: number | null = null;
  if (c > 0 && c < HOME_OFFICE_CONSTANTS.simplifiedRatePerSqFt) {
    const x = HOME_OFFICE_CONSTANTS.simplifiedMaxDeduction / c;
    if (x <= Math.max(0, inputs.homeSqFt)) crossoverSqFt = x;
  }

  return {
    simplified,
    actual,
    winner,
    deductionDelta: actual.deduction - simplified.deduction,
    savingDelta: actual.saving.total - simplified.saving.total,
    crossoverSqFt,
  };
}

/**
 * Office-size sweep: both methods' deductions as the office grows, everything
 * else held fixed. Simplified kinks flat at 300 sq ft ($1,500); the actual
 * method is linear (share × total home cost) until the office fills the home.
 */
export function officeAreaSweep(
  inputs: HomeOfficeInputs,
  maxSqFt = 600,
  steps = 61,
): { sqft: number; simplifiedDeduction: number; actualDeduction: number }[] {
  const to = Math.max(50, Math.min(Math.max(0, inputs.homeSqFt), Math.max(1, maxSqFt)));
  const out: { sqft: number; simplifiedDeduction: number; actualDeduction: number }[] = [];
  const n = Math.max(2, steps);
  for (let i = 0; i < n; i++) {
    const sqft = (to * i) / (n - 1);
    out.push({
      sqft,
      simplifiedDeduction: simplifiedDeduction(sqft),
      actualDeduction: actualMethod({ ...inputs, officeSqFt: sqft }).deduction,
    });
  }
  return out;
}

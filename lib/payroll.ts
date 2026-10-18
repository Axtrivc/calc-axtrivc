// Employer-side cost of the first W-2 hire — the "fully loaded" payroll stack.
//
// The question this engine answers: a business (typically a sole proprietor
// upgrading from contractors) is about to pay its first W-2 salary. Federal
// law attaches employer-side taxes to every payroll dollar — and benefits and
// insurance ride on top. What does the hire actually cost per year, per hour
// of capacity, and as a burden rate over the nominal salary?
//
// This is the employer's chair. The employee's own ledger (employee-half FICA,
// income tax, value of benefits) lives in lib/paytype.ts; the owner-as-employee
// S-corp case lives in lib/scorp.ts; the quarterly-installment consequences of
// the now-smaller Schedule C profit live in lib/estimated.ts. This module owns
// only the stack the EMPLOYER pays to keep a W-2 employee on payroll.
//
// Simplified, illustrative US federal model for tax year 2025 — NOT tax
// advice. Documented assumptions and sources:
//  - Employer Social Security: 6.2% (§3111(a)) on wages up to the $176,100
//    2025 Social Security wage base (SSA, Oct 2024 COLA fact sheet).
//  - Employer Medicare: 1.45% (§3111(b)) on ALL wages — no wage cap, and NO
//    0.9% Additional Medicare Tax on the employer side: §3101(b) withholds
//    that surcharge from the EMPLOYEE above $200,000 of wages; the employer
//    matches only 1.45%, and not the surcharge.
//  - FUTA (federal unemployment): 6.0% (§3301) on the FIRST $7,000 of wages
//    per EMPLOYEE per year (§3306(b)(1)). §3302(a) credits up to 5.4%
//    against timely-paid state unemployment contributions, leaving the
//    common effective rate of 0.6% — but credit-reduction states pay more,
//    so the effective rate is an INPUT (default 0.6%) the user must confirm
//    for their state. FUTA is charged per employee: two $60k hires each owe
//    it on their own first $7,000.
//  - SUTA (state unemployment): entirely an INPUT — rate AND wage base vary
//    by state and by the employer's claims history (experience rating). A
//    new account's rate is set by state formula; nothing about it is
//    modeled, only multiplied.
//  - Benefits (health premium, retirement match, other) at face value, and
//    workers'-compensation premium as an annual quote — both INPUTS; workers'
//    comp is quoted per $100 of payroll by state and job class code.
//  - NOT modeled: payroll-service fees, state disability/paid-leave
//    programs, local payroll taxes, hiring costs, equipment, or the
//    employer-side tax treatment of each layer (deductibility is discussed
//    qualitatively in the guide, not computed here).

/** Named 2025 parameters every function in this module shares. */
export const PAYROLL_CONSTANTS = {
  /** 2025 Social Security wage base — caps the 6.2% employer layer (SSA). */
  ssWageBase: 176100,
  /** Employer Social Security rate, §3111(a). */
  erSsRate: 0.062,
  /** Employer Medicare rate, §3111(b) — all wages, no cap. */
  erMedicareRate: 0.0145,
  /** FUTA wage base per employee, §3306(b)(1). */
  futaWageBase: 7000,
  /** FUTA standard rate, §3301. */
  futaStandardRate: 0.06,
  /** Maximum §3302(a) credit for timely-paid state UI contributions. */
  futaMaxCreditRate: 0.054,
  /**
   * The common effective FUTA rate: 6.0% − 5.4% credit = 0.6%. Exposed as a
   * named constant because credit-reduction states pay more — the guide and
   * the instrument make the effective rate an explicit user input.
   */
  futaEffectiveDefault: 0.006,
  /** Shared capacity basis: 40 h × 52 wk — the hours a full-time hire pays out. */
  hoursPerYear: 2080,
} as const;

/**
 * Inputs for the employer-cost stack. Everything statutory is either a named
 * constant above or computed; everything state-specific or elective is an
 * input the user supplies (all annual $ unless a rate/base).
 */
export type PayrollCostInputs = {
  /** Annual gross salary on the offer. */
  salary: number;
  /**
   * Effective FUTA rate AFTER the §3302 credit — 0.006 in most states,
   * higher in credit-reduction states. User input, defaulted to the common 0.6%.
   */
  futaRate: number;
  /** State unemployment-insurance rate for this account (decimal, e.g. 0.03). */
  sutaRate: number;
  /** State UI taxable wage base per employee, in $ (varies widely by state). */
  sutaWageBase: number;
  /** Annual benefits at face value: health premium + retirement match + other. */
  benefitsAnnual: number;
  /** Annual workers'-compensation premium, as quoted (typically per $100 of payroll). */
  workersCompAnnual: number;
};

/**
 * The guide's worked example: a $60,000 salary, 0.6% effective FUTA, a 3.0%
 * illustrative SUTA rate on a $10,000 illustrative base, the paytype
 * calculator's $11,000 benefits stack, and a $900 illustrative workers'-comp
 * premium. Every state-varying number is an illustrative default, not a
 * quoted state rate — the guide says so where each appears.
 */
export const PAYROLL_DEFAULTS: PayrollCostInputs = {
  salary: 60000,
  futaRate: PAYROLL_CONSTANTS.futaEffectiveDefault,
  sutaRate: 0.03,
  sutaWageBase: 10000,
  benefitsAnnual: 11000,
  workersCompAnnual: 900,
};

/**
 * Employer-side FICA on W-2 wages (2025):
 * `6.2% × min(wages, $176,100) + 1.45% × wages`
 * The employer pays NO 0.9% Additional Medicare Tax — that surcharge
 * (§3101(b)) is withheld from the employee above $200k and is not matched.
 * Example: $60,000 wages → $3,720 + $870 = $4,590 (exactly half of the
 * $9,180 combined FICA on those wages).
 */
export function employerFica(wages: number): number {
  const w = Math.max(0, wages);
  return (
    Math.min(w, PAYROLL_CONSTANTS.ssWageBase) * PAYROLL_CONSTANTS.erSsRate +
    w * PAYROLL_CONSTANTS.erMedicareRate
  );
}

/**
 * FUTA for one employee: `effectiveRate × min(wages, $7,000)`.
 * The rate is the AFTER-credit rate (commonly 6.0% − 5.4% = 0.6%); the base
 * is per-employee, so a $60,000 salary owes it on the first $7,000 only.
 * Example: $60,000 at 0.6% → $42; the same wages at the full §3301 6.0%
 * (no state credit) → $420.
 */
export function futaTax(
  wages: number,
  effectiveRate: number = PAYROLL_CONSTANTS.futaEffectiveDefault,
): number {
  return Math.max(0, wages) > 0 ? Math.min(wages, PAYROLL_CONSTANTS.futaWageBase) * Math.max(0, effectiveRate) : 0;
}

/**
 * State unemployment insurance for one employee:
 * `rate × min(wages, wageBase)`. Both arguments are user inputs — nothing
 * about SUTA is federally fixed. Example: $60,000 at 3.0% on a $10,000
 * base → $300.
 */
export function sutaTax(wages: number, rate: number, wageBase: number): number {
  const w = Math.max(0, wages);
  return Math.min(w, Math.max(0, wageBase)) * Math.max(0, rate);
}

export type EmployerCostBreakdown = {
  salary: number;
  employerFica: number;
  futa: number;
  suta: number;
  /** health/retirement/other benefits at face value, as entered. */
  benefits: number;
  workersComp: number;
  /** employerFica + futa + suta — the statutory employer payroll taxes. */
  employerPayrollTaxes: number;
  /** salary + employerPayrollTaxes + benefits + workersComp. */
  loadedCost: number;
  /** loadedCost − salary: the burden layer over the nominal salary. */
  burdenOverSalary: number;
  /** burdenOverSalary ÷ salary × 100 (0 when salary is 0). */
  burdenRatePct: number;
  /** loadedCost ÷ salary (1 when salary is 0 and cost is 0; 0-safe otherwise). */
  loadedMultiple: number;
  /** loadedCost ÷ 2,080 — the hourly cost of one full-time hire's capacity. */
  costPerHour: number;
};

/**
 * The full employer-side stack for one employee, in ledger order:
 * `loaded = salary + employerFICA(salary) + FUTA + SUTA + benefits + workersComp`
 * Negative inputs clamp to 0 per layer; benefits and workers'-comp enter at
 * face value even when salary is 0 (they are premiums, not wage-linked).
 * Example: PAYROLL_DEFAULTS → $76,832 loaded on a $60,000 salary — a 28.1%
 * burden rate, $36.94 per one of the 2,080 paid hours.
 */
export function computeEmployerCost(inputs: PayrollCostInputs): EmployerCostBreakdown {
  const salary = Math.max(0, inputs.salary);
  const fica = employerFica(salary);
  const futa = futaTax(salary, inputs.futaRate);
  const suta = sutaTax(salary, inputs.sutaRate, inputs.sutaWageBase);
  const benefits = Math.max(0, inputs.benefitsAnnual);
  const workersComp = Math.max(0, inputs.workersCompAnnual);
  const employerPayrollTaxes = fica + futa + suta;
  const loadedCost = salary + employerPayrollTaxes + benefits + workersComp;
  return {
    salary,
    employerFica: fica,
    futa,
    suta,
    benefits,
    workersComp,
    employerPayrollTaxes,
    loadedCost,
    burdenOverSalary: loadedCost - salary,
    burdenRatePct: salary > 0 ? ((loadedCost - salary) / salary) * 100 : 0,
    loadedMultiple: salary > 0 ? loadedCost / salary : loadedCost > 0 ? Infinity : 0,
    costPerHour: loadedCost / PAYROLL_CONSTANTS.hoursPerYear,
  };
}

export type LoadedCostPoint = {
  salary: number;
  loadedCost: number;
  burdenRatePct: number;
};

/**
 * Sensitivity ladder: recompute the full stack at each salary in `salaries`,
 * holding benefits, workers' comp, and every tax input fixed. Fixed layers
 * amortize as salary rises, so burdenRatePct falls monotonically while the
 * salary stays under the Social Security wage base — the structural reason a
 * $40,000 hire carries a heavier burden rate than a $120,000 one.
 */
export function loadedCostSweep(
  base: Omit<PayrollCostInputs, 'salary'>,
  salaries: number[],
): LoadedCostPoint[] {
  return salaries.map((s) => {
    const r = computeEmployerCost({ ...base, salary: s });
    return { salary: s, loadedCost: r.loadedCost, burdenRatePct: r.burdenRatePct };
  });
}

/**
 * Revenue the hire must support at a given gross margin for the margin to
 * pay for the hire: `cost ÷ (margin% ÷ 100)`. At a 50% margin, every dollar
 * of loaded cost needs two dollars of revenue. A margin of 0 or less returns
 * Infinity (the hire can never be covered) — surfaced, not silently clamped.
 */
export function revenueToCover(loadedCost: number, grossMarginPct: number): number {
  const margin = grossMarginPct / 100;
  if (margin <= 0) return Infinity;
  return Math.max(0, loadedCost) / margin;
}

// 1099 contractor vs W-2 employee pay-type comparison model.
//
// The question this instrument answers: the SAME person is offered the same
// work under two pay types — a W-2 salary with a benefits package, or a 1099
// contract at an hourly rate. What hourly rate must the contract pay before
// the freelancer is, in total value kept, no worse off than the employee?
//
// This is stage 1 ("Price") math: it prices a contract against a salaried
// alternative. It is deliberately NOT an entity-structure model — for S-corp
// election economics see lib/scorp.ts (stage 4), and for billable-ratio
// pricing see lib/freelance.ts.
//
// Simplified, illustrative US federal model for tax year 2025 — NOT tax
// advice. Documented assumptions:
//  - 2025 federal single-filer brackets (the thresholds in shared lib/tax.ts
//    are the correct 2025 values) and a $15,750 single standard deduction:
//    $15,000 as originally issued by Rev. Proc. 2024-40, raised to $15,750
//    for tax year 2025 by the One Big Beautiful Bill Act (P.L. 119-21,
//    effective July 2025), which left the 2025 bracket thresholds untouched.
//    NOTE: this deliberately diverges from the stale $14,600 (the 2024
//    amount) still carried by shared lib/tax.ts / lib/scorp.ts, which this
//    instrument is not permitted to modify.
//  - W-2 side: the EMPLOYEE half of FICA only — 6.2% Social Security up to
//    the $176,100 wage base + 1.45% Medicare on all wages + 0.9% Additional
//    Medicare above $200k of wages. The employer half never touches the
//    employee's take-home, so it is excluded from the value-kept ledger
//    (it re-enters only as a negotiation anchor, in the guide).
//  - 1099 side: Schedule SE — the SE-tax base is 92.35% of net business
//    income (revenue − business expenses); 15.3% applies up to the $176,100
//    base, 2.9% Medicare above it, plus the 0.9% Additional Medicare Tax on
//    the base above $200k (Form 8959 Part III, §1401(b)) — the same
//    surcharge the W-2 side pays on wages above $200k. Only half of the
//    §1401(a) tax (excluding the 0.9% component) is deductible under §164(f).
//    No SE tax below $400 of SE base.
//  - Health insurance, kept symmetric: on the W-2 side the employer-paid
//    premium counts as benefits value at face (employer-paid premiums are
//    excluded from taxable income, so face ≈ after-tax value). On the 1099
//    side the contractor pays the same premium in cash — a cash outflow that
//    returns as value (the policy received) — so the only net tax effect is
//    the self-employed health insurance (SEHI) above-the-line deduction,
//    limited per §162(l)(2)(B) to net earnings from self-employment
//    (92.35% of net profit, §1402(a)) minus half of SE tax.
//  - QBI (§199A) applies to 1099 net business income: 20% of
//    (net − half of SE tax − SEHI deduction), capped at 20% of taxable
//    income before the deduction. Owner wages have no QBI on the W-2 side.
//    SSTB phase-outs above $197,300 of taxable income are NOT modeled.
//  - Hours basis: 2,080 paid hours/yr (40 h × 52 wk) on the W-2 side, and
//    the W-2 salary already includes paid time off. The 1099 side can bill
//    only 2,080 − 8 × PTO-days hours: every PTO day is an unpaid day there.
//    Bench/marketing time is NOT modeled here (lib/freelance.ts owns that).
//  - Retirement: the employer match is counted at face value; the 1099
//    side's own SEP/solo-401k contributions are not modeled — cash the
//    freelancer funds out of the contract either way.
//  - No state income tax, no state disability/unemployment insurance, no
//    HSA, no payroll-service fees on either side.

import { taxFromBrackets, FED_BRACKETS_2025 } from '@/lib/tax';

const SS_RATE = 0.062; // Social Security, employee side
const MEDICARE_RATE = 0.0145; // Medicare, employee side
const ADDL_MEDICARE_RATE = 0.009; // employee-only Additional Medicare Tax
const ADDL_MEDICARE_WAGE_THRESHOLD = 200000; // 2025 single filer
const SS_WAGE_BASE_2025 = 176100; // 2025 Social Security wage base
// 2025 single standard deduction: $15,000 per Rev. Proc. 2024-40, raised to
// $15,750 for tax year 2025 by OBBBA (P.L. 119-21, effective July 2025).
const STD_DEDUCTION_2025 = 15750;
const SE_RATE = 0.153; // 12.4% SS + 2.9% Medicare, both halves
const SE_MEDICARE_RATE = 0.029; // Medicare share above the SS cap
const SE_BASE_FACTOR = 0.9235; // Schedule SE: SE tax applies to 92.35% of net
const SE_MIN_BASE = 400; // no SE tax below $400 of SE base
const QBI_RATE = 0.2; // §199A Qualified Business Income deduction rate
const HOURS_PER_YEAR = 2080; // 40 h × 52 wk — the shared capacity basis
const PTO_HOURS_PER_DAY = 8; // one PTO day = 8 billable hours foregone

/** Inputs shared by every function in this module (all annual $ unless noted). */
export type PayTypeInputs = {
  /** Annual W-2 salary on the table. */
  salary: number;
  /** Offered 1099 hourly rate ($/hr). */
  contractRate: number;
  /** Paid days off included in the W-2 salary (unpaid on the 1099 side). */
  ptoDays: number;
  /** Annual health-insurance premium the employer covers (the 1099 must self-buy). */
  healthPremium: number;
  /** Annual employer retirement match, at face value. */
  retirementMatch: number;
  /** Annual value of other benefits (HSA seed, life/disability, stipends). */
  otherBenefits: number;
  /** Annual 1099-side business expenses (software, insurance, equipment). */
  seExpenses: number;
};

export const PAYTYPE_DEFAULTS: PayTypeInputs = {
  salary: 100000,
  contractRate: 65,
  ptoDays: 15,
  healthPremium: 7500,
  retirementMatch: 3000,
  otherBenefits: 500,
  seExpenses: 2000,
};

export const PAYTYPE_CONSTANTS = {
  ssWageBase: SS_WAGE_BASE_2025,
  stdDeduction: STD_DEDUCTION_2025,
  ssRate: SS_RATE,
  medicareRate: MEDICARE_RATE,
  addlMedicareRate: ADDL_MEDICARE_RATE,
  addlMedicareThreshold: ADDL_MEDICARE_WAGE_THRESHOLD,
  seRate: SE_RATE,
  seBaseFactor: SE_BASE_FACTOR,
  qbiRate: QBI_RATE,
  hoursPerYear: HOURS_PER_YEAR,
  ptoHoursPerDay: PTO_HOURS_PER_DAY,
};

/**
 * Billable hours a 1099 contractor can sell in the same year a W-2 employee
 * is paid for 2,080: `billable = 2080 − 8 × ptoDays`, floored at 0.
 * Example: 15 PTO days → 2080 − 120 = 1,960 billable hours.
 */
export function billableHours(ptoDays: number): number {
  return Math.max(0, HOURS_PER_YEAR - PTO_HOURS_PER_DAY * Math.max(0, ptoDays));
}

/**
 * The W-2 salary expressed as an hourly rate on the 2,080-hour paid basis:
 * `w2Hourly = salary ÷ 2080`. Example: $100,000 → $48.0769/hr.
 */
export function w2Hourly(salary: number): number {
  return salary > 0 ? salary / HOURS_PER_YEAR : 0;
}

/**
 * Employee-side FICA on W-2 wages (2025):
 * `fica = 6.2% × min(wages, $176,100) + 1.45% × wages + 0.9% × max(0, wages − $200,000)`
 * The employer's matching half is deliberately excluded — it never reaches
 * the employee's take-home. Example: $100,000 wages → $6,200 + $1,450 = $7,650.
 */
export function employeeFicaW2(wages: number): number {
  const w = Math.max(0, wages);
  return (
    Math.min(w, SS_WAGE_BASE_2025) * SS_RATE +
    w * MEDICARE_RATE +
    Math.max(0, w - ADDL_MEDICARE_WAGE_THRESHOLD) * ADDL_MEDICARE_RATE
  );
}

/**
 * Additional Medicare Tax on self-employment income (Form 8959 Part III,
 * §1401(b), 2025): `0.9% × max(0, 92.35% × net − $200,000)` — the same
 * threshold the W-2 side applies to wages. NOT part of the deductible half
 * of SE tax (§164(f) covers §1401(a) only).
 * Example: net $400,000 → base $369,400 → $1,524.60.
 */
export function addlMedicareSE(netSE: number): number {
  const base = Math.max(0, netSE) * SE_BASE_FACTOR;
  return Math.max(0, base - ADDL_MEDICARE_WAGE_THRESHOLD) * ADDL_MEDICARE_RATE;
}

/**
 * Self-employment tax on net business income (Schedule SE + Form 8959, 2025):
 * `base = 92.35% × net; SE = 15.3% × min(base, $176,100) + 2.9% × max(0, base − $176,100)
 *  + 0.9% × max(0, base − $200,000)`, zero below $400 of base.
 * Example: net $125,400 → base $115,806.90 → SE $17,718.46 (below every surtax zone).
 * Net $400,000 → base $369,400 → SE $34,073.60 (incl. $1,524.60 Additional Medicare).
 */
export function seTaxOnNet(netSE: number): number {
  const base = Math.max(0, netSE) * SE_BASE_FACTOR;
  if (base < SE_MIN_BASE) return 0;
  return (
    Math.min(base, SS_WAGE_BASE_2025) * SE_RATE +
    Math.max(0, base - SS_WAGE_BASE_2025) * SE_MEDICARE_RATE +
    addlMedicareSE(netSE)
  );
}

export type W2Side = {
  salary: number;
  /** Employee-side FICA. */
  fica: number;
  taxableIncome: number;
  incomeTax: number;
  /** Salary minus employee FICA and income tax. */
  cashAfterTax: number;
  /** healthPremium + retirementMatch + otherBenefits, at face value. */
  benefits: number;
  /** cashAfterTax + benefits — the all-in annual value of the job. */
  totalValue: number;
  /** totalValue ÷ 2080 — value kept per hour of shared capacity. */
  valuePerHour: number;
};

/**
 * W-2 side of the ledger:
 * `cash = salary − employeeFICA(salary) − brackets(salary − $15,750)`
 * `value = cash + benefits (face value, tax-free by convention)`
 * Benefits enter untaxed because employer-paid health premiums are excluded
 * from income and a 401(k) match is the employee's own money, tax-deferred.
 */
export function computeW2Side(salary: number, benefitsTotal: number): W2Side {
  const s = Math.max(0, salary);
  const fica = employeeFicaW2(s);
  const taxableIncome = Math.max(0, s - STD_DEDUCTION_2025);
  const incomeTax = taxFromBrackets(taxableIncome, FED_BRACKETS_2025);
  const cashAfterTax = s - fica - incomeTax;
  const benefits = Math.max(0, benefitsTotal);
  const totalValue = cashAfterTax + benefits;
  return {
    salary: s,
    fica,
    taxableIncome,
    incomeTax,
    cashAfterTax,
    benefits,
    totalValue,
    valuePerHour: totalValue / HOURS_PER_YEAR,
  };
}

export type ContractorSide = {
  rate: number;
  /** Billable hours: 2080 − 8 × ptoDays. */
  hours: number;
  revenue: number;
  expenses: number;
  /** Schedule C net: revenue − expenses (floored at 0). */
  netSE: number;
  seTax: number;
  halfSeTax: number;
  /** Self-employed health insurance deduction, ≤ 92.35% × netSE − ½SE. */
  sehiDeduction: number;
  qbiDeduction: number;
  taxableIncome: number;
  incomeTax: number;
  /** The health premium actually paid in cash (returns as value held). */
  healthPremiumPaid: number;
  /**
   * All-in annual value kept:
   * `value = revenue − expenses − SE tax − income tax`
   * The health premium is paid out but returns as the policy's value, so it
   * nets to zero except for its SEHI deduction, already inside income tax.
   */
  valueKept: number;
  /** valueKept ÷ 2080 — value kept per hour of shared capacity (W-2 basis). */
  valuePerHour: number;
  /** valueKept ÷ billable hours — what each billed hour actually delivers. */
  valuePerBillableHour: number;
};

/**
 * 1099 side of the ledger, in evaluation order:
 *  1. `revenue = rate × (2080 − 8 × ptoDays)`; `net = max(0, revenue − expenses)`
 *  2. `SE = seTaxOnNet(net)` (incl. 0.9% Additional Medicare above $200k of
 *     base); `half = (SE − 0.9% part) ÷ 2` — §164(f) excludes the §1401(b)
 *     surcharge from the half deduction
 *  3. `SEHI = min(healthPremium, max(0, 92.35% × net − half))` (§162(l)(2)(B))
 *  4. `QBI = 20% × max(0, net − half − SEHI)` (§199A(c)(1)), capped at 20% of
 *     taxable income before the deduction (taxable = net − half − SEHI − $15,750)
 *  5. `incomeTax = brackets(net − half − SEHI − QBI − $15,750)`
 *  6. `valueKept = revenue − expenses − SE − incomeTax`
 */
export function computeContractorSide(inputs: PayTypeInputs): ContractorSide {
  const hours = billableHours(inputs.ptoDays);
  const rate = Math.max(0, inputs.contractRate);
  const expenses = Math.max(0, inputs.seExpenses);
  const health = Math.max(0, inputs.healthPremium);

  const revenue = rate * hours;
  const netSE = Math.max(0, revenue - expenses);

  const seTax = seTaxOnNet(netSE); // §1401(a) + §1401(b) Additional Medicare
  // §164(f): only half of the §1401(a) tax is deductible — the 0.9%
  // Additional Medicare component (Form 8959 Part III) gets no half deduction.
  const halfSeTax = (seTax - addlMedicareSE(netSE)) / 2;

  // Self-employed health insurance deduction (§162(l)(2)(B)): capped at net
  // earnings from self-employment (92.35% of net profit, §1402(a)) minus
  // half of SE tax — the statutory earned-income limitation.
  const sehiDeduction = Math.min(health, Math.max(0, netSE * SE_BASE_FACTOR - halfSeTax));

  // §199A(c)(1): the QBI base is reduced by the half-SE deduction and by the
  // SEHI deduction, then the deduction itself is capped at 20% of taxable
  // income before the deduction.
  const qbiBase = Math.max(0, netSE - halfSeTax - sehiDeduction);
  const taxableBeforeQbi = Math.max(0, netSE - halfSeTax - sehiDeduction - STD_DEDUCTION_2025);
  const qbiDeduction = Math.min(qbiBase * QBI_RATE, taxableBeforeQbi * QBI_RATE);

  const taxableIncome = Math.max(0, taxableBeforeQbi - qbiDeduction);
  const incomeTax = taxFromBrackets(taxableIncome, FED_BRACKETS_2025);

  const valueKept = revenue - expenses - seTax - incomeTax;

  return {
    rate,
    hours,
    revenue,
    expenses,
    netSE,
    seTax,
    halfSeTax,
    sehiDeduction,
    qbiDeduction,
    taxableIncome,
    incomeTax,
    healthPremiumPaid: health,
    valueKept,
    valuePerHour: valueKept / HOURS_PER_YEAR,
    valuePerBillableHour: hours > 0 ? valueKept / hours : 0,
  };
}

export type PayTypeComparison = {
  w2: W2Side;
  c1099: ContractorSide;
  /** c1099.valueKept − w2.totalValue: positive = the contract is ahead. */
  deltaAnnual: number;
  winner: '1099' | 'w2' | 'tie';
};

/** Both sides of the ledger for one set of inputs, plus the verdict. */
export function comparePayType(inputs: PayTypeInputs): PayTypeComparison {
  const benefits = Math.max(0, inputs.healthPremium) +
    Math.max(0, inputs.retirementMatch) +
    Math.max(0, inputs.otherBenefits);
  const w2 = computeW2Side(inputs.salary, benefits);
  const c1099 = computeContractorSide(inputs);
  const deltaAnnual = c1099.valueKept - w2.totalValue;
  let winner: PayTypeComparison['winner'] = 'tie';
  if (deltaAnnual > 0.5) winner = '1099';
  else if (deltaAnnual < -0.5) winner = 'w2';
  return { w2, c1099, deltaAnnual, winner };
}

/**
 * The hourly contract rate at which the two pay types tie in value kept —
 * the "charge at least this" number. Found by bisection on
 * `value₁₀₉₉(rate) = value_W2` (value₁₀₉₉ is strictly increasing in rate).
 * Returns null when even `cap` $/hr cannot match the W-2 package. (The
 * `ahead(0)` early return is a defensive guard only: with non-negative
 * inputs value₁₀₉₉(0) = −expenses ≤ 0 ≤ value_W2, so it is never taken —
 * a zero-value W-2 package simply yields the small rate that covers the
 * expenses, e.g. $2,000 of expenses with no benefits resolves to
 * 2000 ÷ 2080 = $0.96/hr.)
 */
export function breakevenContractRate(inputs: PayTypeInputs, cap = 1000): number | null {
  const w2Value = computeW2Side(
    inputs.salary,
    Math.max(0, inputs.healthPremium) + Math.max(0, inputs.retirementMatch) + Math.max(0, inputs.otherBenefits),
  ).totalValue;
  const ahead = (rate: number) => computeContractorSide({ ...inputs, contractRate: rate }).valueKept > w2Value;

  if (ahead(0)) return 0; // degenerate: nothing to match
  if (!ahead(cap)) return null; // no crossing within the modeled range
  // value₁₀₉₉ is increasing in rate, so "ahead" flips false→true at the
  // crossing: shrink hi while ahead, grow lo while behind.
  let lo = 0;
  let hi = cap;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (ahead(mid)) hi = mid;
    else lo = mid;
  }
  return (lo + hi) / 2;
}

/**
 * The breakeven rate expressed as a premium over the salary's hourly
 * equivalent: `markup % = (rate − salary ÷ 2080) ÷ (salary ÷ 2080) × 100`.
 * Returns null when the salary is zero or the rate is undefined.
 */
export function breakevenMarkup(salary: number, breakevenRate: number | null): number | null {
  if (breakevenRate === null || salary <= 0) return null;
  const base = salary / HOURS_PER_YEAR;
  if (base <= 0) return null;
  return ((breakevenRate - base) / base) * 100;
}

/**
 * The W-2 salary (keeping the SAME benefits inputs) that is worth exactly as
 * much as the quoted contract rate — the inverse of breakevenContractRate,
 * bisected on `value_W2(salary) = value₁₀₉₉(inputs.contractRate)`.
 * Returns null when no salary in [0, cap] matches (quote below the value of
 * the benefits alone, or above a $1M salary — both pathological).
 */
export function equivalentW2Salary(inputs: PayTypeInputs, cap = 1_000_000): number | null {
  const benefits = Math.max(0, inputs.healthPremium) +
    Math.max(0, inputs.retirementMatch) +
    Math.max(0, inputs.otherBenefits);
  const target = computeContractorSide(inputs).valueKept;
  const ahead = (s: number) => computeW2Side(s, benefits).totalValue > target;

  if (ahead(0)) return 0; // quote is worth less than the benefits alone
  if (!ahead(cap)) return null; // quote out-runs even a $1M salary
  // W-2 value is increasing in salary, so "ahead" flips false→true at the
  // crossing: shrink hi while ahead, grow lo while behind.
  let lo = 0;
  let hi = cap;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (ahead(mid)) hi = mid;
    else lo = mid;
  }
  return (lo + hi) / 2;
}

export type SweepPoint = {
  salary: number;
  breakevenRate: number;
  markupPct: number;
};

/**
 * Sensitivity sweep: the breakeven rate and markup as the W-2 salary moves,
 * holding every other input fixed. Each point is the full model recomputed
 * (bisection included) — not a linear approximation.
 */
export function markupSweep(
  inputs: PayTypeInputs,
  from = 50_000,
  to = 250_000,
  steps = 21,
): SweepPoint[] {
  const out: SweepPoint[] = [];
  for (let i = 0; i < steps; i++) {
    const salary = from + ((to - from) * i) / (steps - 1);
    const rate = breakevenContractRate({ ...inputs, salary });
    if (rate === null) continue;
    const markup = breakevenMarkup(salary, rate);
    if (markup === null) continue;
    out.push({ salary, breakevenRate: rate, markupPct: markup });
  }
  return out;
}

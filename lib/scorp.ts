// S-Corp election model: sole-owner LLC (all profit subject to SE tax) versus
// the same business after a Subchapter S election (reasonable W-2 salary +
// FICA-free distributions).
//
// This is the natural sequel to lib/tax.ts: once an owner has chosen a
// pass-through entity (stage 3), the next lever is HOW profits are extracted.
// The S-corp splits extraction into salary (payroll-taxed) and distributions
// (not payroll-taxed), trading a slice of payroll tax for admin overhead.
//
// Simplified, illustrative US federal model for tax year 2025 — NOT tax advice.
// The S-corp side models the owner-employee; the LLC side reuses the exact
// pass-through math from lib/tax.ts so both instruments share one baseline.
//
// Documented assumptions:
//  - Single owner, no other employees; salary is W-2 and "reasonable" (the
//    IRS requirement — see the on-page guide; the tool never suggests a salary,
//    it evaluates one you enter).
//  - 2025 federal brackets, standard deduction, SS wage base $176,100.
//  - Payroll taxes: 6.2% SS on wages up to the wage base + 1.45% Medicare on
//    all wages, paid twice (employee + employer); the employee alone owes the
//    0.9% Additional Medicare Tax above $200k of wages.
//  - Employer FICA and payroll admin cost are deductible business expenses
//    that reduce K-1 pass-through income dollar-for-dollar.
//  - QBI (§199A): 20% of qualified business income, which for the S-corp is
//    K-1 income only (owner W-2 wages are excluded), capped at 20% of taxable
//    income before the deduction. SSTB phase-outs above $197,300 are NOT
//    modeled (consistent with the LLC vs C-Corp tool).
//  - Payroll admin/FUTA/SUTA baseline is a single annual dollar input
//    (default $1,200: typical solo S-corp payroll service + federal
//    unemployment on the first $7,000 of wages).
//  - No state income tax, no state unemployment beyond the input above.

import { computeLlc, taxFromBrackets } from '@/lib/tax';

const SS_RATE = 0.062; // Social Security, employee or employer side
const MEDICARE_RATE = 0.0145; // Medicare, employee or employer side
const ADDL_MEDICARE_RATE = 0.009; // employee-only Additional Medicare Tax
const ADDL_MEDICARE_WAGE_THRESHOLD = 200000; // 2025 single filer
const SS_WAGE_BASE_2025 = 176100; // shared with lib/tax.ts SE cap
const STD_DEDUCTION_2025 = 14600;
const QBI_RATE = 0.2;

const FED_BRACKETS_2025_SINGLE = [
  { rate: 0.1, upTo: 11925 },
  { rate: 0.12, upTo: 48475 },
  { rate: 0.22, upTo: 103350 },
  { rate: 0.24, upTo: 197300 },
  { rate: 0.32, upTo: 250525 },
  { rate: 0.35, upTo: 626350 },
  { rate: 0.37, upTo: Infinity },
];

/** Employee-side payroll tax on W-2 wages (includes Additional Medicare). */
export function employeeFica(wages: number): number {
  const w = Math.max(0, wages);
  return (
    Math.min(w, SS_WAGE_BASE_2025) * SS_RATE +
    w * MEDICARE_RATE +
    Math.max(0, w - ADDL_MEDICARE_WAGE_THRESHOLD) * ADDL_MEDICARE_RATE
  );
}

/** Employer-side payroll tax on W-2 wages (no Additional Medicare). */
export function employerFica(wages: number): number {
  const w = Math.max(0, wages);
  return Math.min(w, SS_WAGE_BASE_2025) * SS_RATE + w * MEDICARE_RATE;
}

export type ScorpSide = {
  employeeFica: number;
  employerFica: number;
  payrollTax: number; // employeeFica + employerFica
  k1Income: number; // pass-through income after salary, employer FICA & admin
  qbiDeduction: number;
  taxableIncome: number;
  incomeTax: number;
  payrollCost: number; // annual admin/unemployment overhead, as entered
  totalOutlay: number; // all federal tax + payroll overhead
  afterTax: number;
  effectiveRate: number; // totalOutlay / profit * 100
};

/** S-corp (owner-employee) federal model for one profit/salary/cost combo. */
export function computeScorp(profit: number, salary: number, payrollCost: number): ScorpSide {
  const p = Math.max(0, profit);
  const wages = Math.max(0, Math.min(salary, p)); // salary cannot exceed profit

  const emp = employeeFica(wages);
  const er = employerFica(wages);
  const payrollTax = emp + er;

  // Business deduction: salary + employer FICA + admin reduce pass-through income.
  const k1 = Math.max(0, p - wages - er - Math.max(0, payrollCost));

  const ordinaryIncome = wages + k1;
  const taxableBeforeQbi = Math.max(0, ordinaryIncome - STD_DEDUCTION_2025);
  const qbiDeduction = Math.min(k1 * QBI_RATE, taxableBeforeQbi * QBI_RATE);

  const taxableIncome = Math.max(0, ordinaryIncome - STD_DEDUCTION_2025 - qbiDeduction);
  const incomeTax = taxFromBrackets(taxableIncome, FED_BRACKETS_2025_SINGLE);

  const cost = Math.max(0, payrollCost);
  const totalOutlay = payrollTax + incomeTax + cost;
  const afterTax = p - totalOutlay;

  return {
    employeeFica: emp,
    employerFica: er,
    payrollTax,
    k1Income: k1,
    qbiDeduction,
    taxableIncome,
    incomeTax,
    payrollCost: cost,
    totalOutlay,
    afterTax,
    effectiveRate: p > 0 ? (totalOutlay / p) * 100 : 0,
  };
}

export type ScorpComparison = {
  profit: number;
  salary: number;
  payrollCost: number;
  llc: ReturnType<typeof computeLlc>;
  scorp: ScorpSide;
  winner: 'llc' | 'scorp' | 'tie';
  /** After-tax advantage of the winner (>= 0). */
  delta: number;
};

export function compareScorp(profit: number, salary: number, payrollCost: number): ScorpComparison {
  const llc = computeLlc(Math.max(0, profit));
  const scorp = computeScorp(profit, salary, payrollCost);
  let winner: ScorpComparison['winner'] = 'tie';
  if (scorp.afterTax > llc.afterTax + 0.5) winner = 'scorp';
  else if (llc.afterTax > scorp.afterTax + 0.5) winner = 'llc';
  return {
    profit: Math.max(0, profit),
    salary: Math.max(0, salary),
    payrollCost: Math.max(0, payrollCost),
    llc,
    scorp,
    winner,
    delta: Math.abs(llc.afterTax - scorp.afterTax),
  };
}

/**
 * The annual payroll overhead at which the S-corp advantage dies — i.e. the
 * dollar of admin cost where after-tax outcomes tie. Returns null when the
 * S-corp stays ahead for any cost up to `cap` (or never catches up at all):
 * callers surface both cases honestly.
 */
export function breakevenPayrollCost(
  profit: number,
  salary: number,
  cap = 100000,
): number | null {
  const llcNet = computeLlc(Math.max(0, profit)).afterTax;
  const ahead = (cost: number) => computeScorp(profit, salary, cost).afterTax > llcNet;

  if (ahead(0) === ahead(cap)) return null; // never crosses within the range
  let lo = 0;
  let hi = cap;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (ahead(mid)) lo = mid;
    else hi = mid;
  }
  return lo;
}

/** After-tax advantage of the S-corp (positive) or LLC (negative) at each salary. */
export function salarySweep(
  profit: number,
  payrollCost: number,
  fromRatio = 0.15,
  toRatio = 0.9,
  steps = 31,
): { salary: number; ratio: number; delta: number }[] {
  const out: { salary: number; ratio: number; delta: number }[] = [];
  const llcNet = computeLlc(Math.max(0, profit)).afterTax;
  for (let i = 0; i < steps; i++) {
    const ratio = fromRatio + ((toRatio - fromRatio) * i) / (steps - 1);
    const salary = Math.max(0, profit) * ratio;
    out.push({
      salary,
      ratio,
      delta: computeScorp(profit, salary, payrollCost).afterTax - llcNet,
    });
  }
  return out;
}

export const SCORP_CONSTANTS = {
  ssWageBase: SS_WAGE_BASE_2025,
  stdDeduction: STD_DEDUCTION_2025,
  ssRate: SS_RATE,
  medicareRate: MEDICARE_RATE,
  addlMedicareRate: ADDL_MEDICARE_RATE,
  addlMedicareThreshold: ADDL_MEDICARE_WAGE_THRESHOLD,
  qbiRate: QBI_RATE,
  defaultPayrollCost: 1200,
};

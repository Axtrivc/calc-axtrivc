// Full-fidelity S-Corp-vs-LLC comparison model — tax year 2025.
//
// This is the engine behind the S-Corp Salary Calculator page.
// lib/scorp.ts (the original simplified comparison) stays frozen and
// importable; this module is its audited successor, differing in exactly
// three ways, each forced by the tool's own declared scope ("single owner,
// no other employees" — lib/scorp.ts:15-16):
//
//  1. §199A runs through lib/qbi.ts's line-for-line Form 8995-A model
//     instead of a bare min(20%×QBI, 20%×TI). Above $197,300 of taxable
//     income (single filer, Rev. Proc. 2024-40) the deduction is limited by
//     the W-2 wages the business pays — greater of 50%×W-2 or 25%×W-2 +
//     2.5%×UBIA (§199A(b)(1)(B)) — phased in over the statutory $50,000
//     band. With no employees, a sole proprietorship above the threshold
//     loses the deduction entirely, while the S-corp's owner salary counts
//     as the business's W-2 wages and keeps it alive. SSTB phase-outs
//     (§199A(d)(2)) are modeled too, exposed as an input so the tool agrees
//     with the QBI Deduction instrument that shares this engine.
//  2. The standard deduction is $15,750 — the tax-year 2025 single-filer
//     amount after the One Big Beautiful Bill Act (P.L. 119-21), confirmed
//     by the IRS ("New and enhanced deductions for individuals"), not the
//     pre-act $15,000 of Rev. Proc. 2024-40 and not 2024's $14,600 that the
//     shared libs still carry. (Tax year 2026: $16,100, Rev. Proc. 2025-32;
//     SS wage base $184,500, SSA — surfaced on the page as a "parameters
//     move" note, not silently applied.)
//  3. Additional Medicare Tax (0.9%, Form 8959) is modeled on BOTH columns:
//     on W-2 wages above $200k (S-corp owner-employee) and on
//     self-employment income above $200k measured on the same 92.35% base
//     used for SE tax. The old model charged only the wage side.
//
// Everything else — FICA mechanics, the K-1 deduction geometry, bracket
// taxation, the bisection breakeven — is byte-for-byte the same arithmetic
// as lib/scorp.ts, whose header documents the shared assumptions. The FICA
// helpers themselves are imported from lib/scorp.ts rather than redeclared
// (one source of truth per constant), and the 2025 bracket table comes from
// lib/tax.ts.
//
// Simplified, illustrative US federal model — NOT tax advice.

import { employeeFica, employerFica } from '@/lib/scorp';
import { computeQbiDeduction } from '@/lib/qbi';
import { taxFromBrackets, FED_BRACKETS_2025 } from '@/lib/tax';

const SS_WAGE_BASE_2025 = 176100; // SSA contribution & benefit base, 2025
const STD_DEDUCTION_2025 = 15750; // single filer, TY2025, post-OBBBA (IRS)
const SE_BASE_FACTOR = 0.9235; // Schedule SE: 1 − employer-half 7.65%
const SE_RATE = 0.153; // 12.4% SS + 2.9% Medicare, below the SE cap
const SE_MEDICARE_RATE = 0.029; // employee+employer Medicare above the cap
const SE_MIN_BASE = 400; // no SE tax below $400 of net earnings
const ADDL_MEDICARE_RATE = 0.009; // Form 8959
const ADDL_MEDICARE_THRESHOLD = 200000; // 2025 single filer

export const SCORP_FULL_CONSTANTS = {
  ssWageBase: SS_WAGE_BASE_2025,
  stdDeduction: STD_DEDUCTION_2025,
  seBaseFactor: SE_BASE_FACTOR,
  seRate: SE_RATE,
  seMedicareRate: SE_MEDICARE_RATE,
  addlMedicareRate: ADDL_MEDICARE_RATE,
  addlMedicareThreshold: ADDL_MEDICARE_THRESHOLD,
  defaultPayrollCost: 1200,
  /** Published tax-year 2026 parameters — for the on-page drift note only. */
  ty2026: { stdDeduction: 16100, ssWageBase: 184500 },
};

/* ============================== LLC column ============================== */

export type LlcSideFull = {
  seBase: number; // 92.35% × net profit — what Schedule SE taxes
  seTax: number; // Schedule SE tax: 15.3%/2.9% only (excludes the 0.9%)
  halfSeTax: number; // §164(f) above-the-line deduction = ½ × SE tax
  addlMedicareTax: number; // Form 8959 Part III: 0.9% on the SE base > $200k
  qbiBase: number; // §199A QBI = net profit − ½ SE tax
  qbiTentative: number; // 20% × QBI base before any limitation (8995-A line 3)
  taxableBeforeQbi: number; // ordinary income − standard deduction (cap base)
  qbiDeduction: number; // after the full Form 8995-A limitation chain
  qbiLimiter: 'qbi' | 'wage' | 'cap'; // which 8995-A line bound the deduction
  taxableIncome: number;
  incomeTax: number;
  totalOutlay: number; // SE tax + additional Medicare + income tax
  afterTax: number;
};

/**
 * Sole-proprietor LLC column for tax year 2025 (single filer).
 *
 *  1. SE base  = 92.35% × net profit (Schedule SE).
 *  2. SE tax   = 15.3% × min(base, $176,100) + 2.9% × rest, none below $400.
 *  3. Addl Medicare = 0.9% × max(0, base − $200,000) — Form 8959 Part III;
 *     NOT part of the ½-SE-tax deduction (it is excluded from Sch. SE).
 *  4. QBI      = profit − ½ SE tax, deduction via lib/qbi.ts (Form 8995-A:
 *     $197,300 threshold, $50k phase-in, W-2/UBIA limit, SSTB exclusion).
 *  5. Income tax = brackets(profit − ½SE − QBI − $15,750).
 */
export function computeLlcFull(profit: number, sstb = false): LlcSideFull {
  const p = Math.max(0, profit);
  const seBase = p * SE_BASE_FACTOR;
  const seTax =
    seBase < SE_MIN_BASE
      ? 0
      : Math.min(seBase, SS_WAGE_BASE_2025) * SE_RATE +
        Math.max(0, seBase - SS_WAGE_BASE_2025) * SE_MEDICARE_RATE;
  const halfSeTax = seTax / 2;
  const addlMedicareTax = ADDL_MEDICARE_RATE * Math.max(0, seBase - ADDL_MEDICARE_THRESHOLD);

  const ordinary = p - halfSeTax;
  const qbiBase = Math.max(0, ordinary);
  const taxableBeforeQbi = Math.max(0, ordinary - STD_DEDUCTION_2025);
  const q = computeQbiDeduction({
    qbi: qbiBase,
    taxableIncome: taxableBeforeQbi,
    w2Wages: 0, // sole owner, no employees — the tool's declared scope
    ubia: 0,
    sstb,
    filingStatus: 'single',
  });

  const taxableIncome = Math.max(0, ordinary - STD_DEDUCTION_2025 - q.deduction);
  const incomeTax = taxFromBrackets(taxableIncome, FED_BRACKETS_2025);
  const totalOutlay = seTax + addlMedicareTax + incomeTax;

  return {
    seBase,
    seTax,
    halfSeTax,
    addlMedicareTax,
    qbiBase,
    qbiTentative: q.tentativeDeduction,
    taxableBeforeQbi,
    qbiDeduction: q.deduction,
    qbiLimiter: q.limiter,
    taxableIncome,
    incomeTax,
    totalOutlay,
    afterTax: p - totalOutlay,
  };
}

/* ============================= S-Corp column ============================= */

export type ScorpSideFull = {
  salaryEffective: number; // after the profit cap (wages ≤ profit)
  salaryCapped: boolean; // true when the entered salary exceeded profit
  employeeFica: number; // includes the 0.9% Additional Medicare on wages
  employerFica: number;
  payrollTax: number; // employeeFica + employerFica
  addlMedicareTax: number; // 0.9% × max(0, salary − $200k), employee-only
  k1Income: number; // profit − salary − employer FICA − admin cost
  qbiTentative: number; // 20% × K-1 before any limitation (8995-A line 3)
  qbiDeduction: number;
  qbiLimiter: 'qbi' | 'wage' | 'cap';
  taxableIncome: number;
  incomeTax: number;
  payrollCost: number; // annual admin/unemployment overhead, as entered
  totalOutlay: number; // all payroll tax + income tax + overhead
  afterTax: number;
};

/**
 * S-corp (owner-employee) column for tax year 2025 (single filer).
 *
 *  1. Wages   = min(salary, profit) — wages cannot exceed the pool being
 *     split; `salaryCapped` reports the truncation so the UI can say so.
 *  2. FICA    = employeeFica(wages) + employerFica(wages) (lib/scorp.ts:
 *     6.2% SS to $176,100 + 1.45% Medicare, twice; +0.9% employee-only
 *     above $200k of wages).
 *  3. K-1     = profit − wages − employer FICA − payroll cost (each a
 *     deductible business expense).
 *  4. QBI     = 20% of K-1 only (owner wages are excluded by statute), via
 *     the full Form 8995-A chain — the owner's own salary IS the business's
 *     W-2 wages for the §199A(b)(1)(B) limitation above $197,300 TI.
 *  5. Income tax = brackets(wages + K-1 − $15,750 − QBI).
 */
export function computeScorpFull(
  profit: number,
  salary: number,
  payrollCost: number,
  sstb = false,
): ScorpSideFull {
  const p = Math.max(0, profit);
  const requested = Math.max(0, salary);
  const wages = Math.min(requested, p);
  const salaryCapped = requested > p;

  const emp = employeeFica(wages);
  const er = employerFica(wages);
  const cost = Math.max(0, payrollCost);
  const addlMedicareTax = ADDL_MEDICARE_RATE * Math.max(0, wages - ADDL_MEDICARE_THRESHOLD);

  const k1 = Math.max(0, p - wages - er - cost);
  const ordinary = wages + k1;
  const taxableBeforeQbi = Math.max(0, ordinary - STD_DEDUCTION_2025);
  const q = computeQbiDeduction({
    qbi: k1,
    taxableIncome: taxableBeforeQbi,
    w2Wages: wages,
    ubia: 0,
    sstb,
    filingStatus: 'single',
  });

  const taxableIncome = Math.max(0, ordinary - STD_DEDUCTION_2025 - q.deduction);
  const incomeTax = taxFromBrackets(taxableIncome, FED_BRACKETS_2025);
  const payrollTax = emp + er;
  const totalOutlay = payrollTax + incomeTax + cost;

  return {
    salaryEffective: wages,
    salaryCapped,
    employeeFica: emp,
    employerFica: er,
    payrollTax,
    addlMedicareTax,
    k1Income: k1,
    qbiTentative: q.tentativeDeduction,
    qbiDeduction: q.deduction,
    qbiLimiter: q.limiter,
    taxableIncome,
    incomeTax,
    payrollCost: cost,
    totalOutlay,
    afterTax: p - totalOutlay,
  };
}

/* ============================== Comparison =============================== */

export type ScorpFullComparison = {
  profit: number;
  salary: number; // as entered (>= 0)
  salaryEffective: number; // after the profit cap
  salaryCapped: boolean;
  payrollCost: number;
  sstb: boolean;
  llc: LlcSideFull;
  scorp: ScorpSideFull;
  winner: 'llc' | 'scorp' | 'tie';
  /** After-tax advantage of the winner (>= 0; ties within ±$0.50). */
  delta: number;
};

export function compareScorpFull(
  profit: number,
  salary: number,
  payrollCost: number,
  sstb = false,
): ScorpFullComparison {
  const llc = computeLlcFull(Math.max(0, profit), sstb);
  const scorp = computeScorpFull(profit, salary, payrollCost, sstb);
  let winner: ScorpFullComparison['winner'] = 'tie';
  if (scorp.afterTax > llc.afterTax + 0.5) winner = 'scorp';
  else if (llc.afterTax > scorp.afterTax + 0.5) winner = 'llc';
  return {
    profit: Math.max(0, profit),
    salary: Math.max(0, salary),
    salaryEffective: scorp.salaryEffective,
    salaryCapped: scorp.salaryCapped,
    payrollCost: Math.max(0, payrollCost),
    sstb,
    llc,
    scorp,
    winner,
    delta: Math.abs(llc.afterTax - scorp.afterTax),
  };
}

/**
 * The annual payroll overhead at which the S-corp advantage dies — the
 * dollar of admin cost where after-tax outcomes tie — by bisection over
 * [0, cap]. After-tax is strictly decreasing in cost (each dollar either
 * shrinks K-1 or adds to outlay), so the crossing is unique.
 *
 * Returns null when the S-corp is ahead at BOTH ends (its edge survives any
 * overhead up to `cap`) or at NEITHER (the election loses even with zero
 * overhead). Callers distinguish the two by checking who currently wins.
 */
export function breakevenPayrollCostFull(
  profit: number,
  salary: number,
  sstb = false,
  cap = 100000,
): number | null {
  const llcNet = computeLlcFull(Math.max(0, profit), sstb).afterTax;
  const ahead = (cost: number) =>
    computeScorpFull(profit, salary, cost, sstb).afterTax > llcNet;
  if (ahead(0) === ahead(cap)) return null;
  let lo = 0;
  let hi = cap;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (ahead(mid)) lo = mid;
    else hi = mid;
  }
  return lo;
}

/**
 * Signed after-tax advantage of the S-corp (positive) or LLC (negative) at
 * each salary share of profit. With the full §199A chain this curve is NOT
 * monotone at high profits: each salary dollar costs FICA but also buys
 * W-2 wage-limit headroom, so the optimum can sit mid-range.
 */
export function salarySweepFull(
  profit: number,
  payrollCost: number,
  sstb = false,
  fromRatio = 0.15,
  toRatio = 0.9,
  steps = 31,
): { salary: number; ratio: number; delta: number }[] {
  const out: { salary: number; ratio: number; delta: number }[] = [];
  const llcNet = computeLlcFull(Math.max(0, profit), sstb).afterTax;
  for (let i = 0; i < steps; i++) {
    const ratio = fromRatio + ((toRatio - fromRatio) * i) / (steps - 1);
    const salary = Math.max(0, profit) * ratio;
    out.push({
      salary,
      ratio,
      delta: computeScorpFull(profit, salary, payrollCost, sstb).afterTax - llcNet,
    });
  }
  return out;
}

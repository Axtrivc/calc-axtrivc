// LLC vs C-Corp tax comparison model.
//
// This is a simplified, illustrative US federal model — NOT tax advice.
// The point is to show the *structural* difference between pass-through
// taxation (LLC/S-corp-style) and the classic C-corp "double taxation."
//
// Assumptions (clearly surfaced in the UI + article):
//  - Single owner who takes 100% of profit (LLC) or 100% as dividends (C-Corp).
//  - 2025 federal brackets, std deduction, and the QBI deduction for LLCs.
//  - Self-employment tax: 15.3% on the first ~$176,100 of the SE base
//    (92.35% of net SE income, per Schedule SE; 2.9% Medicare on the rest),
//    with half of SE tax deducted from ordinary income.
//  - Corporate tax: flat 21%.
//  - Qualified dividends: taxed at LTCG rates (0/15/20%), here using the
//    2025 single-filer LTCG brackets.
//  - No state tax, no extra Medicare surtax, no salary in the C-Corp case
//    (we model the all-dividend extreme; a real C-Corp owner usually mixes
//    a deductible W-2 salary with dividends, which we discuss in the article).

const STD_DEDUCTION_2025 = 14600; // single filer
const SE_CAP_2025 = 176100; // SS wage base for self-employment tax

const FED_BRACKETS_2025_SINGLE = [
  { rate: 0.1, upTo: 11925 },
  { rate: 0.12, upTo: 48475 },
  { rate: 0.22, upTo: 103350 },
  { rate: 0.24, upTo: 197300 },
  { rate: 0.32, upTo: 250525 },
  { rate: 0.35, upTo: 626350 },
  { rate: 0.37, upTo: Infinity },
];

const LTCG_BRACKETS_2025_SINGLE = [
  { rate: 0, upTo: 48350 },
  { rate: 0.15, upTo: 533400 },
  { rate: 0.2, upTo: Infinity },
];

const CORPORATE_RATE = 0.21;
const QBI_RATE = 0.2; // 20% Qualified Business Income deduction
const SE_RATE = 0.153; // 12.4% SS + 2.9% Medicare
const MEDICARE_RATE = 0.029; // employee-side Medicare on amount above SS cap
const SE_BASE_FACTOR = 0.9235; // Schedule SE: SE tax applies to 92.35% of net earnings
const SE_MIN_BASE = 400; // no SE tax below $400 of net earnings

function taxFromBrackets(taxableIncome: number, brackets: { rate: number; upTo: number }[]): number {
  let tax = 0;
  let prevCap = 0;
  for (const b of brackets) {
    if (taxableIncome <= prevCap) break;
    const slice = Math.min(taxableIncome, b.upTo) - prevCap;
    if (slice > 0) tax += slice * b.rate;
    prevCap = b.upTo;
  }
  return tax;
}

/**
 * LLC / sole proprietorship pass-through model.
 *
 *  1. SE tax base = 92.35% of net business income (Schedule SE); tax is 15.3%
 *     on the first SE_CAP of that base + 2.9% on the rest (none below $400).
 *  2. Half of SE tax is deductible against income.
 *  3. QBI deduction = 20% of (net business income − 1/2 SE tax), additionally
 *     capped at 20% of taxable income (there are no capital gains here, so
 *     the cap is just 20% of ordinary taxable income before the QBI deduction).
 *  4. Ordinary income tax applies to (net income − 1/2 SE tax − QBI deduction − std deduction).
 */
function computeLlc(profit: number) {
  const netSE = profit; // net business income subject to SE tax
  const seBase = netSE * SE_BASE_FACTOR;
  const seTaxOnPortion =
    seBase < SE_MIN_BASE
      ? 0
      : Math.min(seBase, SE_CAP_2025) * SE_RATE + Math.max(0, seBase - SE_CAP_2025) * MEDICARE_RATE;
  const halfSeTax = seTaxOnPortion / 2;

  // QBI = net business income minus half of SE tax; the deduction is also
  // limited to 20% of taxable income before the deduction itself (§199A).
  const qbi = Math.max(0, netSE - halfSeTax);
  const taxableBeforeQbi = Math.max(0, netSE - halfSeTax - STD_DEDUCTION_2025);
  const qbiDeduction = Math.min(qbi * QBI_RATE, taxableBeforeQbi * QBI_RATE);

  const taxableIncome = Math.max(0, netSE - halfSeTax - qbiDeduction - STD_DEDUCTION_2025);
  const incomeTax = taxFromBrackets(taxableIncome, FED_BRACKETS_2025_SINGLE);

  const totalTax = seTaxOnPortion + incomeTax;
  const afterTax = profit - totalTax;
  const effectiveRate = profit > 0 ? (totalTax / profit) * 100 : 0;

  return {
    seTax: seTaxOnPortion,
    incomeTax,
    qbiDeduction,
    taxableIncome,
    totalTax,
    afterTax,
    effectiveRate,
  };
}

/**
 * C-Corp double-taxation model.
 *
 *  1. Corporate income tax = 21% flat on profit.
 *  2. After-tax profit is distributed as qualified dividends.
 *  3. Dividends taxed at LTCG rates, less the std deduction (which does NOT
 *     apply to qualified dividends — only ordinary income; we model that
 *     correctly by taxing dividends via the LTCG brackets directly).
 */
function computeCCorp(profit: number) {
  const corporateTax = profit * CORPORATE_RATE;
  const afterCorporate = profit - corporateTax;
  const dividends = afterCorporate; // assume 100% paid out

  const dividendTax = taxFromBrackets(dividends, LTCG_BRACKETS_2025_SINGLE);

  const totalTax = corporateTax + dividendTax;
  const afterTax = profit - totalTax;
  const effectiveRate = profit > 0 ? (totalTax / profit) * 100 : 0;

  return {
    corporateTax,
    dividends,
    dividendTax,
    totalTax,
    afterTax,
    effectiveRate,
  };
}

export type EntityComparison = {
  profit: number;
  llc: ReturnType<typeof computeLlc>;
  ccorp: ReturnType<typeof computeCCorp>;
  winner: 'llc' | 'ccorp' | 'tie';
  delta: number; // absolute tax savings for the winner (>=0)
};

export function compareEntities(profit: number): EntityComparison {
  const p = Math.max(0, profit);
  const llc = computeLlc(p);
  const ccorp = computeCCorp(p);
  const delta = Math.abs(llc.totalTax - ccorp.totalTax);
  let winner: EntityComparison['winner'] = 'tie';
  if (llc.totalTax < ccorp.totalTax - 0.5) winner = 'llc';
  else if (ccorp.totalTax < llc.totalTax - 0.5) winner = 'ccorp';
  return { profit: p, llc, ccorp, winner, delta };
}

export const TAX_CONSTANTS = {
  stdDeduction: STD_DEDUCTION_2025,
  seCap: SE_CAP_2025,
  corporateRate: CORPORATE_RATE,
  qbiRate: QBI_RATE,
  seRate: SE_RATE,
};

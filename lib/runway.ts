// SaaS runway model.
//
// Runway = how many months a company can keep operating before it runs out
// of cash, factoring in MRR growth. As MRR grows it offsets gross burn, so
// net burn shrinks each month and runway stretches.
//
// We project month-by-month: cash -= (grossBurn - mrr); mrr *= (1 + growth).
// This captures the non-linear nature of runway under growth.

export type RunwayInputs = {
  cash: number; // current cash balance
  grossBurn: number; // monthly operating expenses (cash out)
  mrr: number; // current monthly recurring revenue
  growthRate: number; // MRR monthly growth rate, %
};

export type MonthPoint = {
  month: number; // 0 = today, 1 = after month 1, etc.
  cash: number; // cash balance at end of month
  mrr: number; // MRR during that month
  netBurn: number; // grossBurn - mrr (negative = profitable)
};

export type RunwayResult = {
  months: number | null; // runway in months (null = profitable / > 120 months)
  reachedProfitability: boolean; // MRR overtakes gross burn within 10 yrs
  breakevenMrr: number; // MRR needed to cover gross burn
  initialNetBurn: number; // grossBurn - current mrr
  points: MonthPoint[]; // month-by-month cash trajectory
  profitableAtMonth: number | null; // month index when net burn goes negative
  finalCash: number | null; // cash left at end of projection
};

const MAX_MONTHS = 120; // 10-year cap on projection

export function computeRunway(input: RunwayInputs): RunwayResult {
  const cash = Math.max(0, input.cash);
  const grossBurn = Math.max(0, input.grossBurn);
  const mrr = Math.max(0, input.mrr);
  const growth = Math.max(0, Math.min(50, input.growthRate)) / 100;

  const breakevenMrr = grossBurn;
  const initialNetBurn = grossBurn - mrr;
  const points: MonthPoint[] = [
    { month: 0, cash, mrr, netBurn: initialNetBurn },
  ];

  let curCash = cash;
  let curMrr = mrr;
  let runwayMonths: number | null = null;
  let reachedProfitability = false;
  let profitableAtMonth: number | null = null;

  // If already profitable, runway is effectively infinite.
  if (initialNetBurn <= 0) {
    reachedProfitability = true;
    profitableAtMonth = 0;
  }

  for (let m = 1; m <= MAX_MONTHS; m++) {
    const netBurn = grossBurn - curMrr; // cash consumed this month
    curCash = curCash - netBurn;
    // grow MRR for next month
    curMrr = curMrr * (1 + growth);

    if (netBurn <= 0 && !reachedProfitability) {
      reachedProfitability = true;
      profitableAtMonth = m;
    }

    const cashClamped = Math.max(0, curCash);
    points.push({ month: m, cash: cashClamped, mrr: curMrr, netBurn });

    if (curCash <= 0 && runwayMonths === null) {
      runwayMonths = m;
      break;
    }
  }

  const finalCash = curCash > 0 ? curCash : 0;

  return {
    months: runwayMonths,
    reachedProfitability,
    breakevenMrr,
    initialNetBurn,
    points,
    profitableAtMonth,
    finalCash,
  };
}

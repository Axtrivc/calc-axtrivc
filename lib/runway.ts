// SaaS runway model.
//
// Runway = how many months a company can keep operating before it runs out
// of cash, factoring in MRR growth. As MRR grows it offsets gross burn (net
// of gross margin), so net burn shrinks each month and runway stretches.
//
// We project month-by-month:
//   cash    -= grossBurn - grossMargin * collectedMrr
//   mrr     *= 1 + growth          (growth may be negative: contraction)
//   collectedMrr = MRR of month (m - collectionLag), or 0 before billing starts
// This captures the non-linear nature of runway under growth.
//
// Parameter conventions (there are no hidden constants — every number below is
// a caller input; anything not provided defaults to the textbook case):
//   - grossMargin is a percentage of MRR that survives COGS (hosting, support,
//     payment fees). Default 100 = the zero-COGS textbook model. Break-even
//     MRR is grossBurn ÷ grossMargin, NOT grossBurn: at 80% margin, $50k of
//     burn needs $62.5k of MRR.
//   - collectionLag 1 shifts every month's collections one month later (the
//     accounts-receivable stress test); 0 collects in-month.
//   - growthRate is clamped to [-20, 50] %/mo. Negative growth models net
//     contraction (churn outrunning expansion) — a first-class scenario for a
//     runway tool, not an error.

export type RunwayInputs = {
  cash: number; // current cash balance
  grossBurn: number; // monthly operating expenses (cash out)
  mrr: number; // current monthly recurring revenue
  /** MRR monthly growth rate, %. Negative = net contraction. Clamped to [-20, 50]. */
  growthRate: number;
  /** Gross margin, % — share of each MRR dollar left after COGS. Clamped to [0, 100]. Default 100 (zero COGS). */
  grossMargin?: number;
  /** Collection lag in whole months: 0 = MRR collected in-month (default), 1 = every month's revenue lands one month later. */
  collectionLag?: number;
};

export type MonthPoint = {
  month: number; // 0 = today, 1 = after month 1, etc.
  cash: number; // cash balance at end of month (clamped at 0)
  mrr: number; // MRR during that month (recognition basis)
  // grossBurn − grossMargin × collectedMrr; negative = the month adds cash.
  // With collectionLag = 1, collectedMrr is the PRIOR month's MRR (0 in month 1).
  netBurn: number;
};

export type RunwayResult = {
  // Month index whose END first leaves cash ≤ 0 — a whole-month CEILING of
  // the true runway (the balance actually goes negative partway through that
  // month; a $500 pile against $50k of burn reports 1, not 0.01). null =
  // never within the projection: either break-even was reached (see
  // reachedProfitability — the simulation stops just past it) or the
  // 120-month horizon was outlasted while still burning ("120+ months of
  // drift", NOT profitability).
  months: number | null;
  // Exact runway in months, linearly interpolated inside the final month:
  // (months − 1) + cash-at-the-start-of-that-month ÷ its net burn. Equal to
  // the naive cash ÷ net burn division whenever growth = 0 — use this for any
  // side-by-side comparison against the shortcut so rounding conventions
  // never masquerade as economics. null when months is null; 0 in the
  // out-of-cash-today early return.
  monthsExact: number | null;
  reachedProfitability: boolean; // collected revenue overtakes gross burn
  breakevenMrr: number; // MRR at which margin × MRR covers gross burn = grossBurn ÷ grossMargin (Infinity at 0% margin)
  initialNetBurn: number; // grossBurn − grossMargin × mrr (today's run-rate, pre-lag — recognition basis, NOT the lagged month-1 cash drain)
  points: MonthPoint[]; // month-by-month cash trajectory
  profitableAtMonth: number | null; // first month (≥ 1) when COLLECTED revenue covers burn; null if never. Under lag=1 this cannot fire before month 2 — month 1 collects nothing.
  finalCash: number | null; // cash at the end of the projection (break-even stop point or horizon)
};

const MAX_MONTHS = 120; // 10-year cap on projection
const BREAKEVEN_TAIL = 2; // months of upturn recorded past break-even before stopping

export function computeRunway(input: RunwayInputs): RunwayResult {
  const cash = Math.max(0, input.cash);
  const grossBurn = Math.max(0, input.grossBurn);
  const mrr = Math.max(0, input.mrr);
  const growth = Math.max(-20, Math.min(50, input.growthRate)) / 100;
  const margin = Math.min(100, Math.max(0, input.grossMargin ?? 100)) / 100;
  const lag = Math.min(1, Math.max(0, Math.round(input.collectionLag ?? 0)));

  const breakevenMrr = margin > 0 ? grossBurn / margin : Infinity;
  const initialNetBurn = grossBurn - mrr * margin;
  const points: MonthPoint[] = [
    { month: 0, cash, mrr, netBurn: initialNetBurn },
  ];

  let curCash = cash;
  let curMrr = mrr;
  let runwayMonths: number | null = null;
  let runwayMonthsExact: number | null = null;
  let reachedProfitability = false;
  let profitableAtMonth: number | null = null;

  // Profitability is declared ONLY on the collected basis inside the loop
  // (first month whose collected revenue covers burn). Pre-setting it from
  // initialNetBurn would be a recognition-basis claim and can contradict the
  // cash path: with collectionLag = 1, month 1 collects nothing, so a thin
  // cash pile can die in month 1 while "profitable since month 0" — the two
  // statements can't both be true.

  // Already out of cash while still burning — the runway is gone today, not
  // "one more month" (month 0 already satisfies cash <= 0).
  if (cash <= 0 && initialNetBurn > 0) {
    return {
      months: 0,
      monthsExact: 0,
      reachedProfitability,
      breakevenMrr,
      initialNetBurn,
      points: [{ month: 0, cash: 0, mrr, netBurn: initialNetBurn }],
      profitableAtMonth,
      finalCash: 0,
    };
  }

  // MRR during month k lives at index k-1 (index 0 = month 1). Kept so the
  // collection-lag variant can bill a prior month's MRR.
  const mrrByMonth: number[] = [];
  let profitableTail = 0;

  for (let m = 1; m <= MAX_MONTHS; m++) {
    mrrByMonth.push(curMrr); // MRR during month m

    // With a collection lag, month m collects the MRR of month m − lag;
    // the first `lag` months burn at full gross burn (nothing has landed yet).
    const collectedIdx = m - 1 - lag;
    const collected = collectedIdx >= 0 ? mrrByMonth[collectedIdx] : 0;
    const netBurn = grossBurn - collected * margin; // cash consumed this month

    const cashBefore = curCash; // balance at the start of month m
    curCash = curCash - netBurn;

    if (netBurn <= 0 && !reachedProfitability) {
      reachedProfitability = true;
      profitableAtMonth = m;
    }

    // Record the month with the MRR that applied DURING it, so the documented
    // invariant between the fields holds for every point.
    points.push({ month: m, cash: Math.max(0, curCash), mrr: curMrr, netBurn });

    // grow MRR for next month
    curMrr = curMrr * (1 + growth);

    if (curCash <= 0 && runwayMonths === null) {
      runwayMonths = m;
      // Exact runway: cash declines linearly through the month by netBurn, so
      // the zero crossing sits (m − 1) + cashBefore/netBurn of the way in.
      // netBurn > 0 holds in any death month — with netBurn ≤ 0 the balance
      // cannot fall — but guard anyway rather than trust the invariant.
      runwayMonthsExact = netBurn > 0 ? (m - 1) + cashBefore / netBurn : m;
      break;
    }

    // Early stop: once collected revenue covers burn and growth ≥ 0, the MRR
    // path is non-decreasing, so cash can only rise from here. Record a
    // couple of months of the upturn (so the chart shows the trough), then
    // stop — compounding a profitable SaaS ten years out produces noise in
    // the trillions, not insight. With negative growth this never fires:
    // MRR shrinks, so "profitable now" does not imply "profitable later".
    if (netBurn <= 0 && growth >= 0) {
      profitableTail += 1;
      if (profitableTail > BREAKEVEN_TAIL) break;
    }
  }

  const finalCash = curCash > 0 ? curCash : 0;

  return {
    months: runwayMonths,
    monthsExact: runwayMonthsExact,
    reachedProfitability,
    breakevenMrr,
    initialNetBurn,
    points,
    profitableAtMonth,
    finalCash,
  };
}

/**
 * Smallest monthly MRR growth rate (%, within the model's [-20, 50] clamp) at
 * which the company reaches cash-flow break-even BEFORE the cash runs out —
 * i.e. where "counting months down" flips to "the countdown stops".
 *
 * Method: bisection over the predicate P(g) = computeRunway(g) survives with
 * profitability. P is monotone in g (a higher growth rate pointwise raises the
 * cash path and pulls the break-even month earlier), so ~15 iterations bound
 * the flip point to ±0.001pp.
 *
 * Returns null when no growth rate up to +50%/mo can get there (e.g. gross
 * margin 0, or the cash simply cannot last), and −20 when the company
 * outlasts the horizon even while shrinking 20%/mo.
 */
export function breakevenGrowthThreshold(input: RunwayInputs): number | null {
  const survives = (g: number) => {
    const r = computeRunway({ ...input, growthRate: g });
    return r.months === null && r.reachedProfitability;
  };
  if (survives(-20)) return -20;
  if (!survives(50)) return null;
  let lo = -20;
  let hi = 50;
  while (hi - lo > 0.002) {
    const mid = (lo + hi) / 2;
    if (survives(mid)) hi = mid;
    else lo = mid;
  }
  return (lo + hi) / 2;
}

/** A scenario preset for the calculator: label + full input set. */
export type RunwayPreset = {
  id: string;
  label: string;
  description: string;
  inputs: Required<RunwayInputs>;
};

/**
 * Archetype scenarios for the runway workbench. Numbers are chosen so each
 * preset tells a different story (verified against computeRunway):
 * break-even reached, deep-freeze contraction, and a raise-window squeeze.
 */
export const RUNWAY_PRESETS: RunwayPreset[] = [
  {
    id: 'seed',
    label: 'Seed baseline',
    description:
      '$500k banked against $50k burn and $10k MRR compounding 8%/mo at 80% margin — the canonical seed-stage setup.',
    inputs: { cash: 500_000, grossBurn: 50_000, mrr: 10_000, growthRate: 8, grossMargin: 80, collectionLag: 0 },
  },
  {
    id: 'breakeven-in-sight',
    label: 'Break-even in sight',
    description:
      'Revenue already covers most of the burn — the question is whether growth carries you over the line before the cash thins out.',
    inputs: { cash: 400_000, grossBurn: 60_000, mrr: 45_000, growthRate: 5, grossMargin: 80, collectionLag: 0 },
  },
  {
    id: 'winter',
    label: 'Long winter',
    description:
      'Growth has stalled into slow contraction — the pile has to outlast the freeze on burn discipline alone.',
    inputs: { cash: 700_000, grossBurn: 45_000, mrr: 15_000, growthRate: -2, grossMargin: 75, collectionLag: 0 },
  },
  {
    id: 'pre-raise',
    label: 'Pre-raise',
    description:
      'Post-raise burn with real revenue behind it: does the cash outlast the 18-month raise-and-close window at only +4%/mo?',
    inputs: { cash: 1_200_000, grossBurn: 140_000, mrr: 60_000, growthRate: 4, grossMargin: 80, collectionLag: 0 },
  },
];

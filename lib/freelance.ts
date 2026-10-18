// Freelance hourly-rate model.
//
// The core idea: a freelancer's billable rate must cover four things the
// salaried employee doesn't directly pay for — (1) the income they actually
// want to take home, (2) business expenses, (3) taxes, and (4) the hours
// they can't bill (vacation, holidays, admin, non-billable work).

export type FreelanceInputs = {
  targetTakeHome: number; // desired annual take-home pay (after tax, after expenses)
  businessExpenses: number; // annual business costs (software, equipment, etc.)
  taxRate: number; // effective combined tax rate, % (self-employment + income)
  vacationDays: number; // paid time off + public holidays (non-working days)
  weeklyBillableHours: number; // hours per week actually billed to clients
};

export type FreelanceResult = {
  grossNeeded: number; // pre-tax revenue required
  billableWeeks: number; // working weeks after vacation/holidays
  billableHours: number; // total annual billable hours
  hourlyRate: number; // required hourly rate
  dayRate: number; // hourly * 8
  monthlyRate: number; // annual gross / 12
  /** Billable hours as a PERCENTAGE of the 2,080-hour (52 × 40) FTE year.
   *  Can exceed 100% when the inputs specify overtime-level capacity
   *  (e.g. 80 billed hours/week) — the caller should treat that as an
   *  over-capacity signal, not a healthy score. */
  utilization: number;
};

const FULL_TIME_WEEKS = 52;
const WORK_DAYS_PER_WEEK = 5;
const HOURS_PER_DAY = 8;
/** Input domains, kept in lockstep with the calculator's UI limits so URL
 *  deep-links can't bypass them: vacation beyond 120 days would silently
 *  collapse billable weeks and explode the rate. */
const MAX_VACATION_DAYS = 120;
const MAX_WEEKLY_HOURS = 80;
const MAX_TAX_RATE = 70;

/**
 * Compute the hourly rate required to hit a target take-home pay.
 *
 * grossNeeded = expenses + takeHome / (1 − taxRate/100)
 *
 *   Tax asymmetry — the whole model in one line: expenses are deductible
 *   pre-tax cash costs (paid out of revenue before your draw), so revenue
 *   spent on them is never taxed; only the take-home must survive taxation:
 *       (gross − expenses) × (1 − t) = takeHome
 *   solved for gross:
 *       gross = expenses + takeHome / (1 − t)
 *   The tempting shortcut (takeHome + expenses)/(1 − t) instead satisfies
 *   gross × (1 − t) − expenses = takeHome — it runs the expenses through
 *   the tax factor too, inflating revenue by exactly E·t/(1−t) ($5,143/yr
 *   on $12,000 of expenses at a 30% rate).
 *
 * billableWeeks = 52 − (vacationDays / 5)     [floored at half a week]
 * billableHours = billableWeeks × weeklyBillableHours   [≥ 1, never 0]
 * hourlyRate    = grossNeeded / billableHours
 * dayRate       = hourlyRate × 8 · monthlyRate = grossNeeded / 12
 */
export function computeFreelanceRate(input: FreelanceInputs): FreelanceResult {
  const takeHome = Math.max(0, input.targetTakeHome);
  const expenses = Math.max(0, input.businessExpenses);
  const taxRate = Math.min(MAX_TAX_RATE, Math.max(0, input.taxRate));
  const vacationDays = Math.min(MAX_VACATION_DAYS, Math.max(0, input.vacationDays));
  const weeklyHours = Math.min(MAX_WEEKLY_HOURS, Math.max(1, input.weeklyBillableHours));

  const grossNeeded = expenses + takeHome / (1 - taxRate / 100);
  const billableWeeks = Math.max(0.5, FULL_TIME_WEEKS - vacationDays / WORK_DAYS_PER_WEEK);
  const billableHours = Math.max(1, billableWeeks * weeklyHours);
  const hourlyRate = grossNeeded / billableHours;
  const dayRate = hourlyRate * HOURS_PER_DAY;
  const monthlyRate = grossNeeded / 12;
  const utilization = (billableHours / (FULL_TIME_WEEKS * HOURS_PER_DAY * WORK_DAYS_PER_WEEK)) * 100;

  return {
    grossNeeded,
    billableWeeks,
    billableHours,
    hourlyRate,
    dayRate,
    monthlyRate,
    utilization,
  };
}

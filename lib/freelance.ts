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
  utilization: number; // billableHours / 2080 — efficiency vs a 40h FTE
};

const FULL_TIME_WEEKS = 52;
const WORK_DAYS_PER_WEEK = 5;
const HOURS_PER_DAY = 8;

/**
 * Compute the hourly rate required to hit a target take-home pay.
 *
 * grossNeeded = (takeHome + expenses) / (1 − taxRate/100)
 *   ...because gross * (1 − tax) = takeHome + expenses
 *
 * billableWeeks = 52 − (vacationDays / 5)
 * billableHours = billableWeeks * weeklyBillableHours
 * hourlyRate = grossNeeded / billableHours
 */
export function computeFreelanceRate(input: FreelanceInputs): FreelanceResult {
  const takeHome = Math.max(0, input.targetTakeHome);
  const expenses = Math.max(0, input.businessExpenses);
  const taxRate = Math.min(70, Math.max(0, input.taxRate)); // clamp sanity 0–70%
  const vacationDays = Math.max(0, input.vacationDays);
  const weeklyHours = Math.min(80, Math.max(1, input.weeklyBillableHours));

  const grossNeeded = (takeHome + expenses) / (1 - taxRate / 100);
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

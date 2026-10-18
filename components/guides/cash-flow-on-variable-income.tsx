import { ArticleToc } from '@/components/Article';
import { computeFreelanceRate } from '@/lib/freelance';
import {
  computeEstimatedTax,
  currentYearTaxAt,
  skipPenaltyEstimate,
  EST_CONSTANTS as EC,
  QUARTERS_2025,
} from '@/lib/estimated';
import {
  cashLockedByTerms,
  carryingCost,
  computeLatePayment,
  expectedTermsCostPct,
  TERM_PRESETS,
} from '@/lib/latefee';
import { numFmt, pct, usd } from '@/lib/format';

/**
 * Guide body: "Cash Flow on Variable Income" — the three-account system
 * (operating / tax / owner pay), the buffer sized in months, the tax reserve
 * ladder, and the bad-month decision tree.
 *
 * Every dollar figure in the prose and tables below is computed at module
 * scope by the same engines that power the instruments this guide hands off
 * to (lib/freelance, lib/estimated, lib/latefee) — nothing is hand-typed.
 * The worked case is constant throughout: a single filer in tax year 2025
 * targeting $84,000 of after-tax owner pay ($7,000/mo) on $12,000/yr of
 * business essentials, 25 vacation days, 30 billable hours a week, a
 * $18,000 prior-year total tax, a 9% annual cost of capital, a 1% historical
 * write-off rate, and Net-30 terms. The 30% tax-reserve rule is an input to
 * the target-income engine and is then audited against the estimated-tax
 * engine's own federal number (it over-reserves — deliberately; see the
 * ladder section and the limits section).
 *
 * Rendered through GuideShell (which supplies h1, the prose column, and the
 * closing instruments panel), so this body starts at h2.
 */

/* ---- The worked case ------------------------------------------------------ */
const CASE = {
  takeHome: 84_000, // after-tax owner pay target: $7,000/mo
  expenses: 12_000, // business essentials: $1,000/mo
  taxRatePct: 30, // the reserve rule, audited against lib/estimated below
  vacationDays: 25,
  weeklyHours: 30,
  floorMonthly: 8_000, // owner pay 7,000 + essentials 1,000 = the must-pay floor
  priorTax: 18_000, // last year's 1040 total tax (prior AGI under $150k)
  capitalRatePct: 9, // credit-line cost of capital
  badDebtPct: 1, // historical dollars written off ÷ dollars billed
} as const;

/* ---- Engine 1: the target-income method (lib/freelance) ------------------- */
const RATE = computeFreelanceRate({
  targetTakeHome: CASE.takeHome,
  businessExpenses: CASE.expenses,
  taxRate: CASE.taxRatePct,
  vacationDays: CASE.vacationDays,
  weeklyBillableHours: CASE.weeklyHours,
});
// The monthly split the target implies: expenses, tax reserve, owner pay.
const OPS_MO = CASE.expenses / 12;
const OWNER_MO = CASE.takeHome / 12;
const TAX_MO = ((RATE.grossNeeded - CASE.expenses) * (CASE.taxRatePct / 100)) / 12;
const OPS_SHARE = (OPS_MO / RATE.monthlyRate) * 100;
const TAX_SHARE = (TAX_MO / RATE.monthlyRate) * 100;
const OWNER_SHARE = (OWNER_MO / RATE.monthlyRate) * 100;
// The tempting shortcut (takeHome + expenses both run through the tax factor)
// overstates required revenue by E·t ÷ (1 − t) — the lib/freelance docstring's
// own worked number.
const SHORTCUT_OVERSTATEMENT = (CASE.expenses * (CASE.taxRatePct / 100)) / (1 - CASE.taxRatePct / 100);
// The FTE denominator behind the utilization figure (52 × 40 hours).
const FTE_HOURS = Math.round(RATE.billableHours / (RATE.utilization / 100));
// What a salary computed on the FTE denominator overstates, measured against
// the billable one: 2,080 ÷ 1,410 − 1 = 47.5% (the unbilled ~third of the
// year becomes nearly half again when the denominator shrinks).
const SALARY_OVERSTATE_PCT = (FTE_HOURS / RATE.billableHours - 1) * 100;
// A fat month (2× target) and a drought month ($3,000 of receipts), swept
// under the same split: tax stays proportional, owner pay stays fixed.
const FAT_RECEIPTS = RATE.monthlyRate * 2;
const FAT_SURPLUS = FAT_RECEIPTS - FAT_RECEIPTS * (TAX_MO / RATE.monthlyRate) - OWNER_MO - OPS_MO;
const DROUGHT_RECEIPTS = 3_000;
const DROUGHT_TAX_SWEEP = DROUGHT_RECEIPTS * (TAX_MO / RATE.monthlyRate);
const DROUGHT_NET = DROUGHT_RECEIPTS - DROUGHT_TAX_SWEEP - CASE.floorMonthly;

/* ---- Engine 2: the tax reserve ladder (lib/estimated) --------------------- */
// Schedule C net profit = the revenue target minus business essentials.
const NET_SE = RATE.grossNeeded - CASE.expenses;
const T_AT_TARGET = currentYearTaxAt(NET_SE, 'single');
const EFF_RATE_PCT = (T_AT_TARGET.totalTax / NET_SE) * 100;
const FEDERAL_MO = T_AT_TARGET.totalTax / 12;
const CURRENT90 = T_AT_TARGET.totalTax * EC.safeHarborCurrentRate;
const esBase = {
  filingStatus: 'single' as const,
  w2Withholding: 0,
  priorTax: CASE.priorTax as number | null,
  priorAgiOver150k: false,
};
const LADDER_PRIOR100 = computeEstimatedTax({ ...esBase, netSE: NET_SE });
const LADDER_PRIOR110 = computeEstimatedTax({ ...esBase, netSE: NET_SE, priorAgiOver150k: true });
const LADDER_CURRENT90 = computeEstimatedTax({ ...esBase, netSE: NET_SE, priorTax: null });
const BALLOON = LADDER_PRIOR100.expectedAtFiling;
const RESERVE_RULE_ANNUAL = (CASE.taxRatePct / 100) * NET_SE;
const RESERVE_SLACK = RESERVE_RULE_ANNUAL - T_AT_TARGET.totalTax;
const SKIP_PENALTY = skipPenaltyEstimate(CASE.priorTax, 0);
// The falling year: same prior tax, profit collapses to $60k — the engine's
// applicable harbor flips to 90%-of-current on its own.
const FALL_NET_SE = 60_000;
const FALL_TAX = currentYearTaxAt(FALL_NET_SE, 'single');
const FALL = computeEstimatedTax({ ...esBase, netSE: FALL_NET_SE });

/* ---- Engine 3: terms, lockup, and the buffer (lib/latefee) ---------------- */
// Steady-state receivables lockup at each standard term, expressed both in
// dollars and in months of the must-pay floor.
const LOCKUP = TERM_PRESETS.map((p) => {
  const locked = cashLockedByTerms(RATE.grossNeeded, p.netDays);
  return { ...p, locked, floorMonths: locked / CASE.floorMonthly };
});
// One average invoice (the monthly revenue target) on Net-30 terms.
const INVOICE = computeLatePayment({
  invoiceAmount: RATE.monthlyRate,
  netDays: 30,
  annualRatePct: CASE.capitalRatePct,
  badDebtPct: CASE.badDebtPct,
});
const CARRY_60 = carryingCost(RATE.monthlyRate, CASE.capitalRatePct, 60);
const ANNUAL_TERMS_DRAG =
  (expectedTermsCostPct(30, CASE.capitalRatePct, CASE.badDebtPct) / 100) * RATE.grossNeeded;
const INVOICE_FLOOR_MONTHS = RATE.monthlyRate / CASE.floorMonthly;
const BUFFER_LOW = CASE.floorMonthly * 3;
const BUFFER_HIGH = CASE.floorMonthly * 6;
const DROUGHTS_SURVIVED = BUFFER_LOW / Math.abs(DROUGHT_NET);

const toc = [
  { id: 'verdict', label: 'The system in five rules' },
  { id: 'why-average-lies', label: 'Why the average lies' },
  { id: 'three-accounts', label: 'Three accounts, one plumbing job' },
  { id: 'salary', label: 'Set the salary from the target, not the month' },
  { id: 'tax-ladder', label: 'The tax reserve ladder in a variable year' },
  { id: 'buffer', label: 'Size the buffer in months' },
  { id: 'bad-month', label: 'The bad-month decision tree' },
  { id: 'rhythm', label: 'The rhythm that holds it together' },
  { id: 'limits', label: 'What this model does not cover' },
];

export default function CashFlowOnVariableIncomeGuide() {
  return (
    <>
      <ArticleToc items={toc} />

      <h2 id="verdict">The system in five rules</h2>
      <p>
        Variable income does not fail as an income — it fails as a schedule. Most months are fine;
        the damage concentrates in the two or three months a year when a client pays late, a project
        slips, and a quarterly tax installment lands in the same window. The fix is not a stricter
        budget. It is plumbing: a fixed set of accounts and transfer rules that converts a volatile
        stream of receipts into a steady stream of outflows, so that the volatility is absorbed by a
        structure instead of by your household.
      </p>
      <p>
        Five rules do all the work, and the rest of this guide is the arithmetic behind each of
        them:
      </p>
      <div className="my-8 rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 dark:border-white/[0.08] dark:bg-slate-900/60">
        <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          The five rules
        </div>
        <ol className="mt-3">
          <li>
            <strong>Split every deposit the day it lands</strong> — a fixed percentage to tax, a
            fixed salary to you, the rest stays in operating. The percentages come from a target
            income, not from how the month felt.
          </li>
          <li>
            <strong>Pay yourself a salary, not a share of the month.</strong> The same transfer
            leaves in a {usd(FAT_RECEIPTS, 0)} month and a {usd(DROUGHT_RECEIPTS, 0)} month. Your
            income is the average; the average is what you live on.
          </li>
          <li>
            <strong>The tax account is not your money.</strong> Reserve at the current-year line,
            remit on the smallest safe harbor you qualify for, and let the difference sit for
            April.
          </li>
          <li>
            <strong>Denominate the buffer in months, not dollars</strong> — 3–6
            months of the must-pay floor, pushed toward the top of the band the slower your
            clients pay.
          </li>
          <li>
            <strong>In a bad month, work the levers in order:</strong> collect, then cut, then draw
            — and never from the tax account.
          </li>
        </ol>
      </div>
      <p>
        Every number below comes from one worked case, computed by the same engines that power the{' '}
        <a href="/freelance-hourly-rate-calculator/">Freelance Hourly Rate Calculator</a>, the{' '}
        <a href="/quarterly-estimated-tax-calculator/">Quarterly Estimated Tax Calculator</a>, and
        the <a href="/late-payment-cost-calculator/">Late Payment Cost Calculator</a>: a single
        filer in tax year 2025 who needs {usd(CASE.takeHome, 0)} of after-tax owner pay, runs{' '}
        {usd(CASE.expenses, 0)} a year of business essentials, takes {CASE.vacationDays} days off,
        bills {CASE.weeklyHours} hours a week, paid {usd(CASE.priorTax, 0)} of total tax last year,
        carries capital at {CASE.capitalRatePct}% a year, writes off{' '}
        {CASE.badDebtPct}% of billings, and sells on Net-30 terms. Substitute your own inputs at
        each step — the engines recompute everything.
      </p>

      <h2 id="why-average-lies">Why the average lies</h2>
      <p>
        The target-income engine says this practice must bill {usd(RATE.monthlyRate, 0)} a month —{' '}
        {usd(RATE.grossNeeded, 0)} a year — to fund the life described above. Two facts about that
        number make budgeting against it dangerous. First, no month is the average: a{' '}
        {usd(FAT_RECEIPTS, 0)} month followed by a {usd(DROUGHT_RECEIPTS, 0)} month averages out
        fine on a spreadsheet and is a completely different survival event in a checking account.
        Second, revenue is not cash: on Net-30 terms, money earned this month arrives next month,
        so the bank balance is always a lagging, seasonally distorted reading of how the business
        is actually doing. A system that treats the bank balance as the signal will feel rich in
        fat months and poor in lean ones, and will be wrong both times.
      </p>
      <p>
        The three-account method in the next section replaces that signal with two cleaner ones:
        an <em>operating balance</em> measured against a floor line, and a <em>tax balance</em>{' '}
        measured against the next installment. Both are leading indicators — they move the day a
        deposit lands or slips, not thirty days later.
      </p>

      <h2 id="three-accounts">Three accounts, one plumbing job</h2>
      <p>
        Three accounts, three jobs, no overlap. <strong>Operating</strong> is where every receipt
        lands and every business bill is paid; the buffer lives here as a floor line — a target
        minimum balance, not a separate pile of cash. <strong>Tax</strong> receives its percentage
        of each deposit the same day and pays exactly one counterparty. <strong>Owner pay</strong>{' '}
        is a personal account that receives one fixed monthly transfer and is otherwise untouched
        by the business. The target-income method sets the ratios once, and from then on the split
        is mechanical:
      </p>
      <table>
        <thead>
          <tr>
            <th>Account</th>
            <th>Share of each receipt</th>
            <th>Flows out</th>
            <th>The rule</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Operating</td>
            <td>{pct(OPS_SHARE, 1)} + everything the other two leave</td>
            <td>Business essentials ({usd(OPS_MO, 0)}/mo) and the buffer</td>
            <td>Balance never crosses the floor without a decision</td>
          </tr>
          <tr>
            <td>Tax</td>
            <td>{pct(TAX_SHARE, 1)}</td>
            <td>Four federal installments a year</td>
            <td>Not your money; never borrowed from</td>
          </tr>
          <tr>
            <td>Owner pay</td>
            <td>{pct(OWNER_SHARE, 1)}</td>
            <td>One fixed transfer of {usd(OWNER_MO, 0)}/mo</td>
            <td>Same amount every month, fat or thin</td>
          </tr>
        </tbody>
      </table>
      <p>
        Watch the two months from the introduction move through the plumbing. The{' '}
        {usd(FAT_RECEIPTS, 0)} month sweeps {usd(FAT_RECEIPTS * (TAX_MO / RATE.monthlyRate), 0)} to
        tax, pays the fixed {usd(OWNER_MO, 0)} salary and {usd(OPS_MO, 0)} of essentials, and
        leaves {usd(FAT_SURPLUS, 0)} sitting in operating — a full month of the floor rebuilt
        without anyone deciding anything. The {usd(DROUGHT_RECEIPTS, 0)} month still sweeps{' '}
        {usd(DROUGHT_TAX_SWEEP, 0)} to tax (tax is proportional to income, so it shrinks on its
        own), still pays the {usd(OWNER_MO, 0)} salary, and nets{' '}
        {usd(DROUGHT_NET, 0)} for the month — which is the buffer&apos;s job, not yours. The
        variance stays in operating where a number watches it; your household never sees it.
      </p>

      <h2 id="salary">Set the salary from the target, not the month</h2>
      <p>
        The salary number cannot come from last month&apos;s receipts or it will whipsaw. It comes
        from the <a href="/guides/pricing-freelance-work/">target-income method</a>: start from the
        annual take-home your life actually costs, gross it up for taxes, add the business
        essentials, and divide by the hours you can genuinely bill. The{' '}
        <a href="/freelance-hourly-rate-calculator/">Freelance Hourly Rate Calculator</a> engine
        runs exactly that chain on the worked case:
      </p>
      <table>
        <thead>
          <tr>
            <th>Target-income output</th>
            <th>Engine value</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Revenue required (gross)</td>
            <td>{usd(RATE.grossNeeded, 0)}/yr · {usd(RATE.monthlyRate, 0)}/mo</td>
          </tr>
          <tr>
            <td>Billable capacity</td>
            <td>
              {numFmt(RATE.billableWeeks, 0)} weeks × {CASE.weeklyHours} h ={' '}
              {numFmt(RATE.billableHours, 0)} hours
            </td>
          </tr>
          <tr>
            <td>Required rate</td>
            <td>{usd(RATE.hourlyRate, 2)}/hr · {usd(RATE.dayRate, 0)}/day</td>
          </tr>
          <tr>
            <td>Utilization against a {numFmt(FTE_HOURS, 0)}-hour year</td>
            <td>{pct(RATE.utilization, 1)}</td>
          </tr>
        </tbody>
      </table>
      <p>
        Two lessons hide in that table. The denominator lesson: {CASE.weeklyHours} billed hours a
        week is {pct(RATE.utilization, 1)} of a full-time year — the other third is sales, admin,
        and the vacation the model priced in, and a salary computed against{' '}
        {numFmt(FTE_HOURS, 0)} hours instead of {numFmt(RATE.billableHours, 0)} is quietly{' '}
        {pct(SALARY_OVERSTATE_PCT, 1)} too rich — the unbilled third of the year, measured
        against the smaller denominator. The tax lesson: business essentials are deductible cash costs, paid
        out of revenue before your draw, so only the take-home survives the tax gross-up. Running
        the expenses through the tax factor too — the tempting shortcut — inflates the revenue
        target by {usd(SHORTCUT_OVERSTATEMENT, 0)} a year on these inputs, pure phantom.
      </p>
      <p>
        Then divide the take-home by twelve and stop: the salary is {usd(OWNER_MO, 0)} a month.
        Not a bonus in fat months, not a sacrifice in thin ones — the fixed transfer is what makes
        every other number in the system readable. (If the business grows into an S corporation,
        &quot;paying yourself&quot; becomes a formal payroll question with its own rules — the{' '}
        <a href="/guides/paying-yourself-from-your-business/">Paying Yourself From Your
        Business</a> guide covers that regime.)
      </p>

      <h2 id="tax-ladder">The tax reserve ladder in a variable year</h2>
      <p>
        Nobody withholds for you, and the federal calendar does not care that your income is
        lumpy: four installments fall due on{' '}
        {QUARTERS_2025.map((q) => q.due).join(', ')}. What each installment has to cover is set by
        IRC §6654(d)(1) — the <strong>lesser</strong> of {pct(EC.safeHarborCurrentRate * 100, 0)}{' '}
        of this year&apos;s tax, or {pct(EC.safeHarborPriorRate * 100, 0)} of last year&apos;s tax
        ({pct(EC.safeHarborPriorHighRate * 100, 0)} if last year&apos;s AGI topped{' '}
        {usd(EC.highIncomeAgiThreshold, 0)}). The{' '}
        <a href="/quarterly-estimated-tax-calculator/">Quarterly Estimated Tax Calculator</a>{' '}
        engine prices all three readings on the worked case, where the {usd(RATE.grossNeeded, 0)}{' '}
        revenue target nets to {usd(NET_SE, 0)} of Schedule C profit:
      </p>
      <table>
        <thead>
          <tr>
            <th>Safe-harbor reading</th>
            <th>Required annual payment</th>
            <th>Per quarter</th>
            <th>Verdict on the worked case</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>{pct(EC.safeHarborCurrentRate * 100, 0)} of current-year tax</td>
            <td>{usd(CURRENT90, 0)}</td>
            <td>{usd(LADDER_CURRENT90.perQuarter, 0)}</td>
            <td>Correct but expensive — the full current-year line</td>
          </tr>
          <tr>
            <td>{pct(EC.safeHarborPriorRate * 100, 0)} of prior-year tax</td>
            <td>{usd(LADDER_PRIOR100.prior100 ?? 0, 0)}</td>
            <td>{usd(LADDER_PRIOR100.perQuarter, 0)}</td>
            <td>
              <strong>Binding</strong> — the smallest qualifying line
            </td>
          </tr>
          <tr>
            <td>
              {pct(EC.safeHarborPriorHighRate * 100, 0)} of prior-year tax (prior AGI &gt;{' '}
              {usd(EC.highIncomeAgiThreshold, 0)})
            </td>
            <td>{usd(LADDER_PRIOR110.prior110 ?? 0, 0)}</td>
            <td>{usd(LADDER_PRIOR110.perQuarter, 0)}</td>
            <td>The high-income version of the same harbor</td>
          </tr>
        </tbody>
      </table>
      <p>
        The engine&apos;s full-year arithmetic behind those readings: {usd(T_AT_TARGET.seTax, 0)}{' '}
        of self-employment tax plus {usd(T_AT_TARGET.incomeTax, 0)} of income tax — the QBI
        deduction softens it to an effective federal rate of {pct(EFF_RATE_PCT, 1)}, or{' '}
        {usd(FEDERAL_MO, 0)} a month. And here is the trap the ladder exists to prevent: remitting
        on the prior-year harbor ({usd(LADDER_PRIOR100.perQuarter, 0)} a quarter here) is perfectly
        legal and penalty-free, but it settles only {usd(CASE.priorTax, 0)} of a{' '}
        {usd(T_AT_TARGET.totalTax, 0)} bill. The remaining {usd(BALLOON, 0)} arrives as a balloon
        with the April return — penalty-free, but cash all the same. A variable-income practice
        that &quot;pays its taxes&quot; quarterly on the small harbor and spends the difference
        has simply moved the crisis from June to April.
      </p>
      <p>
        So split the verb. <strong>Reserve</strong> at the current-year line —{' '}
        {usd(FEDERAL_MO, 0)} a month, or the {pct(CASE.taxRatePct, 0)} rule&apos;s{' '}
        {usd(TAX_MO, 0)} a month, which over-reserves federal by {usd(RESERVE_SLACK, 0)} a year on
        this case and is the right amount of deliberate slack for state tax and bracket drift
        (this engine models federal only). <strong>Remit</strong> on the smallest harbor you
        qualify for. The difference accumulates in the tax account and pays the April balloon
        without touching the buffer. The ladder also self-corrects in a falling year: collapse the
        worked case to {usd(FALL_NET_SE, 0)} of profit and the engine flips the applicable harbor
        to {pct(EC.safeHarborCurrentRate * 100, 0)}-of-current on its own —{' '}
        {usd(FALL.perQuarter, 0)} a quarter against a {usd(FALL_TAX.totalTax, 0)} total bill,
        because {usd(CASE.priorTax, 0)} of prior tax no longer beats the current-year line.
      </p>
      <p>
        One number closes the section, because it prices the temptation: funding a bad month by
        skipping the four installments costs an estimated {usd(SKIP_PENALTY, 0)} at the
        engine&apos;s {pct(EC.penaltyRate * 100, 0)} federal underpayment rate. Be honest about
        what the rate comparison shows, because the engine&apos;s own numbers show it:{' '}
        {pct(EC.penaltyRate * 100, 0)} simple is a cheaper price than the {CASE.capitalRatePct}%
        credit line. But the two are not substitutes, and the price is the smaller difference. A
        credit line is optional credit — drawn when needed, repaid on your schedule. The §6654
        addition is a certain, non-negotiable charge on money that was already earmarked: skipping
        the installments creates no liquidity, it defers a liability whose April date you do not
        control. The buffer exists precisely so you never have to make that trade, and the tax
        account is the one account in the system with no bad-month exception. (Edge cases the
        engine honors: no penalty at all when the year&apos;s shortfall is under{' '}
        {usd(EC.deMinimisThreshold, 0)}, or when last year&apos;s tax was zero — the{' '}
        <a href="/guides/self-employed-tax-calendar/">Self-Employed Tax Calendar</a> guide walks
        the calendar and its exceptions in full.)
      </p>

      <h2 id="buffer">Size the buffer in months — then let your terms vote</h2>
      <p>
        A buffer stated in dollars goes stale the moment rent changes; stated in months it
        self-maintains. The denominator is the <strong>must-pay floor</strong>: the owner salary
        plus the business essentials — {usd(OWNER_MO, 0)} plus {usd(OPS_MO, 0)}, or{' '}
        {usd(CASE.floorMonthly, 0)} a month on the worked case. Tax is deliberately excluded: it
        is already earmarked dollar-for-dollar in its own account and is not a contingency. The
        working band is 3–6 months of floor —{' '}
        {usd(BUFFER_LOW, 0)} to {usd(BUFFER_HIGH, 0)} here — with three months covering one
        bad quarter and six covering a client loss plus the search that follows. Where you
        sit inside the band is not a feeling; it is a function of how fast you collect.
      </p>
      <p>
        The <a href="/late-payment-cost-calculator/">Late Payment Cost Calculator</a> engine holds
        the steady-state arithmetic: at any given terms, your own money permanently parked in
        customer receivables is annual billings × days ÷ 365. On the {usd(RATE.grossNeeded, 0)}{' '}
        billing target:
      </p>
      <table>
        <thead>
          <tr>
            <th>Your terms</th>
            <th>Cash locked in receivables</th>
            <th>In months of the {usd(CASE.floorMonthly, 0)} floor</th>
          </tr>
        </thead>
        <tbody>
          {LOCKUP.map((row) => (
            <tr key={row.id}>
              <td>{row.label}</td>
              <td>{usd(row.locked, 0)}</td>
              <td>{numFmt(row.floorMonths, 1)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p>
        Read the third column as a buffer surcharge — with the accounting kept straight. The
        lockup is a stock of your own cash parked in customer receivables; it does not draw the
        buffer down month by month. What it sets is the size of the gap the buffer must bridge:
        every thirty days of added terms locks another{' '}
        {usd(LOCKUP[2].locked - LOCKUP[1].locked, 0)} —{' '}
        {numFmt(LOCKUP[2].floorMonths - LOCKUP[1].floorMonths, 1)} months of floor — of cash you
        have earned but cannot yet spend. On Net-15 the lockup is a rounding error; on Net-90 the
        terms alone put {numFmt(LOCKUP[3].floorMonths, 1)} months of floor into waiting — more
        lag than an entire three-month buffer exists to absorb, before the first genuinely bad
        month even arrives. That is why the band slides: fast collectors live at three months,
        Net-60 shops need five, Net-90 enterprises need the full six plus a credit line.
      </p>
      <p>
        Slow payment also taxes the buffer&apos;s growth. One average invoice —{' '}
        {usd(RATE.monthlyRate, 0)} — on Net-30 costs {usd(INVOICE.totalExpectedCost, 0)} in
        expectation: {usd(INVOICE.carryingCost, 0)} of carrying at a {CASE.capitalRatePct}% cost of
        capital plus {usd(INVOICE.badDebtLoss, 0)} of probability-weighted write-off, about{' '}
        {pct(INVOICE.totalCostPct ?? 0, 1)} of face per collection cycle. Across a year of
        billings that is {usd(ANNUAL_TERMS_DRAG, 0)} — money that would otherwise be buffer —
        spent purely on waiting. The countermeasures are terms policy, not thrift: the{' '}
        <a href="/guides/getting-paid-without-losing-margin/">Getting Paid Without Losing
        Margin</a> guide prices deposits, milestones, and early-payment discounts as the
        cash-flow instruments they are.
      </p>

      <h2 id="bad-month">The bad-month decision tree</h2>
      <p>
        Define the bad month before it arrives, or the definition will be written by panic. The
        trigger used here: the projected operating balance — what is in the account plus what is
        scheduled to land — falls below <strong>one month of floor</strong> before the next
        monthly sweep. When it trips, work three levers in strict order:
      </p>
      <div className="my-8 rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 dark:border-white/[0.08] dark:bg-slate-900/60">
        <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          The three levers, in order
        </div>
        <ol className="mt-3">
          <li>
            <strong>Collect first.</strong> The receivable is your own money at{' '}
            {numFmt(100 - CASE.badDebtPct, 0)} cents expected recovery — the cheapest capital in
            the system. One average invoice is {numFmt(INVOICE_FLOOR_MONTHS, 1)} months of floor;
            letting it age from thirty days to sixty costs {usd(CARRY_60 - INVOICE.carryingCost, 0)}{' '}
            of carrying and every further day costs {usd(INVOICE.dailyCarryingCost, 2)}. A
            collection call beats a credit-line draw at {CASE.capitalRatePct}% every time it
            works, and it usually works.
          </li>
          <li>
            <strong>Cut discretionary operating spend second.</strong> Software seats, ads,
            travel, anything cancellable inside a month. These cuts are reversible within weeks
            and touch nobody&apos;s rent. They are also finite — which is why they are second, not
            a strategy.
          </li>
          <li>
            <strong>Draw from the buffer last, and only the floor.</strong> Letting the operating
            balance cross the floor line is the draw — visible, dated, and sized in months: a{' '}
            {usd(DROUGHT_RECEIPTS, 0)}-receipt month costs the buffer {usd(Math.abs(DROUGHT_NET), 0)}{' '}
            once tax and salary are honored. If the drought runs deeper, cut the salary by a
            stated fraction with a written restore rule rather than silently draining the
            buffer to zero — a {usd(BUFFER_LOW, 0)} fund survives{' '}
            {numFmt(DROUGHTS_SURVIVED, 1)} consecutive drought months, which is a horizon, not an
            eternity.
          </li>
        </ol>
      </div>
      <p>
        Two hard rules bracket the tree. The tax account is untouchable — the{' '}
        {usd(SKIP_PENALTY, 0)} skip penalty is the floor of what raiding it costs, and an unfunded
        April balloon is the ceiling. And the replenishment rule is part of
        the tree, not an afterthought: the first {usd(FAT_SURPLUS, 0)} of the next fat month
        rebuilds the buffer before any discretionary spending returns, because a buffer that only
        ever drains is a countdown. Sequence matters in both directions.
      </p>

      <h2 id="rhythm">The rhythm that holds it together</h2>
      <p>
        The system runs on four clocks. <strong>Per deposit</strong> (or as a twice-monthly sweep
        if you prefer batch transfers — pick one and automate it): split tax, pay essentials,
        leave the rest in operating. <strong>Monthly</strong>: the fixed owner transfer on the same
        date every month; reconcile operating against the floor line and watch the trend, not the
        balance. <strong>Quarterly</strong>: remit on the four installment dates the engine
        lists, from the tax account, at the harbor the ladder selected — a five-minute job when
        the money is already segregated. <strong>Annually</strong>: settle the return, pay or
        reclaim the balloon, then re-run the whole stack — if the target, the expenses, or the
        tax picture moved, the split and the buffer re-derive from the same engines in minutes.
        The annual pass is also when you re-vote the buffer on your actual collection experience:
        if real DSO crept from thirty days toward sixty, the band&apos;s answer moved with it.
      </p>
      <p>
        The instruments divide the annual work cleanly. The{' '}
        <a href="/freelance-hourly-rate-calculator/">Freelance Hourly Rate Calculator</a> sets the
        revenue target and the salary. The{' '}
        <a href="/quarterly-estimated-tax-calculator/">Quarterly Estimated Tax Calculator</a> sets
        the reserve line and the installment amounts. The{' '}
        <a href="/late-payment-cost-calculator/">Late Payment Cost Calculator</a> prices the terms
        that decide where in the buffer band you live. Run them in that order, once a year or
        whenever the facts move.
      </p>

      <h2 id="limits">What this model does not cover</h2>
      <p>
        The arithmetic above is federal-only and single-filer for tax year 2025: no state income
        or state estimated tax, which is precisely why the {pct(CASE.taxRatePct, 0)} reserve rule
        deliberately over-reserves the federal line by {usd(RESERVE_SLACK, 0)} a year on the
        worked case rather than matching it. The 3–6 month band is a
        practitioner heuristic, not a theorem — it assumes the floor itself is honest and that
        your droughts look like quarters, not years. The lockup figures treat contractual net days
        as your real DSO, which flatters businesses whose clients pay late; substitute observed
        collection days. The skip-penalty figure is the engine&apos;s simplified estimate — flat{' '}
        {pct(EC.penaltyRate * 100, 0)}, simple interest — and the real Form 2210 computation
        re-prices each period. Entity form changes the plumbing: an S corporation replaces the
        owner-pay transfer with formal payroll and its own reasonableness rules. This is a
        decision framework with illustrative engine arithmetic, not tax or financial advice —
        every parameter here moves, which is exactly why each section hands you the instrument
        that recomputes it on your own numbers.
      </p>
    </>
  );
}

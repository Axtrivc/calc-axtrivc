import { ArticleToc } from '@/components/Article';
import { computeFreelanceRate } from '@/lib/freelance';
import { computeDiscount, profitNeutralUpliftPct, revenueNeutralUpliftPct } from '@/lib/discount';
import {
  PAYTYPE_CONSTANTS,
  PAYTYPE_DEFAULTS,
  breakevenContractRate,
  breakevenMarkup,
  computeContractorSide,
  computeW2Side,
  equivalentW2Salary,
  w2Hourly,
} from '@/lib/paytype';
import { numFmt, pct, usd } from '@/lib/format';

/* Every number in this guide is computed at build time by the same engines the
   instruments run (lib/freelance, lib/discount, lib/paytype) — nothing is
   hand-typed. The rate section pins the rate calculator's own baseline inputs
   so a reader can reproduce every figure in the instrument in one load. */

/* ---- The floor: the rate calculator's own baseline ------------------------ */
const RATE_BASE = {
  targetTakeHome: 90_000,
  businessExpenses: 12_000,
  taxRate: 30,
  vacationDays: 25,
  weeklyBillableHours: 25,
};
const FLOOR = computeFreelanceRate(RATE_BASE);
const GROSSED_UP_PAY = RATE_BASE.targetTakeHome / (1 - RATE_BASE.taxRate / 100);
const FTE_HOURS = (FLOOR.billableHours / FLOOR.utilization) * 100; // the 2,080-h year
const NAIVE_RATE = w2Hourly(RATE_BASE.targetTakeHome); // salary-implied $/hr
const TAX_LAYER = 1 / (1 - RATE_BASE.taxRate / 100);
const EXPENSE_LAYER = FLOOR.grossNeeded / GROSSED_UP_PAY;
const HOURS_LAYER = FTE_HOURS / FLOOR.billableHours;
const RATE_MULTIPLE = FLOOR.hourlyRate / NAIVE_RATE;
const OVERHEAD_FROM_MISTAXED_EXPENSES =
  (RATE_BASE.businessExpenses * (RATE_BASE.taxRate / 100)) / (1 - RATE_BASE.taxRate / 100);
/* Sensitivity scenarios: the two capacity plans named in the prose. */
const H20_HOURS = 20;
const H30_HOURS = 30;
const H20 = computeFreelanceRate({ ...RATE_BASE, weeklyBillableHours: H20_HOURS });
const H30 = computeFreelanceRate({ ...RATE_BASE, weeklyBillableHours: H30_HOURS });
const T35 = computeFreelanceRate({ ...RATE_BASE, taxRate: 35 });
const H20_PCT = (H20.hourlyRate / FLOOR.hourlyRate - 1) * 100;
const H30_PCT = (1 - H30.hourlyRate / FLOOR.hourlyRate) * 100;
const T35_PCT = ((T35.hourlyRate - FLOOR.hourlyRate) / FLOOR.hourlyRate) * 100;
const SOLD_DAYS_PER_WEEK = FLOOR.billableHours / FLOOR.billableWeeks / 8;

/* ---- The discount ladder (lib/discount) ------------------------------------ */
const DISCOUNTS = [5, 10, 15, 20, 25, 30];
const LADDER = DISCOUNTS.map((d) => ({ d, uplift: revenueNeutralUpliftPct(d) }));
const TWENTY_OFF = revenueNeutralUpliftPct(20); // the famous +25%
// gm = 100% and gm = 66.7% both exceed the 20%/10% discounts, so the null
// branch (discount consumes the whole margin) is unreachable on these inputs.
const SOLO_UPLIFT = profitNeutralUpliftPct(FLOOR.hourlyRate, 0, 20) ?? 0;
const RAISE_TOLERANCE = (1 - 1 / 1.2) * 100; // +20% price tolerates this volume loss
const HOURS_AT_120_FOR_150 = 150 / 1.2; // 1.2× the rate: hours that still pay what 150 did
/* Subcontracted delivery corner: $150/hr sold, $50/hr delivered, 160 h/month.
   Keys follow DiscountInputs (unitCost) so computeDiscount sees the cost. */
const SUB_RATE = { price: 150, unitCost: 50, volume: 160 };
const SUB20 = profitNeutralUpliftPct(SUB_RATE.price, SUB_RATE.unitCost, 20) ?? 0;
const SUB10 = profitNeutralUpliftPct(SUB_RATE.price, SUB_RATE.unitCost, 10) ?? 0;
const SUB_AGG = computeDiscount({ ...SUB_RATE, discountPct: 20 });
/* The guide's own floor discounted 20%: what the year then demands. */
const SOLO_AGG = computeDiscount({
  price: FLOOR.hourlyRate,
  unitCost: 0,
  volume: FLOOR.billableHours,
  discountPct: 20,
});
const HOLD_HOURS = FLOOR.grossNeeded / SOLO_AGG.discountedPrice;
const HOLD_WEEKLY = HOLD_HOURS / FLOOR.billableWeeks;
const HOLD_WEEKLY_DELTA = HOLD_WEEKLY - RATE_BASE.weeklyBillableHours;

/* ---- The 1099 ledger (lib/paytype, 2025 federal model) ---------------------- */
const BENEFITS_TOTAL =
  PAYTYPE_DEFAULTS.healthPremium + PAYTYPE_DEFAULTS.retirementMatch + PAYTYPE_DEFAULTS.otherBenefits;
const W2 = computeW2Side(PAYTYPE_DEFAULTS.salary, BENEFITS_TOTAL);
const CON = computeContractorSide(PAYTYPE_DEFAULTS);
const LEDGER_DELTA = CON.valueKept - W2.totalValue;
const SALARY_HOURLY = w2Hourly(PAYTYPE_DEFAULTS.salary);
const BE_RATE = breakevenContractRate(PAYTYPE_DEFAULTS) ?? 0;
const BE_MARKUP = breakevenMarkup(PAYTYPE_DEFAULTS.salary, BE_RATE) ?? 0;
const EQ_SALARY = equivalentW2Salary(PAYTYPE_DEFAULTS) ?? 0;
const EQ_SALARY_ROUNDED = Math.round(EQ_SALARY / 1000) * 1000;
const PTO_HOURS = PAYTYPE_CONSTANTS.hoursPerYear - CON.hours;
const PTO_COST = PTO_HOURS * BE_RATE;

/**
 * Guide body for /guides/pricing-freelance-work/ — the decision playbook that
 * threads the "Price" instruments into one path: derive a floor from your own
 * cost stack (lib/freelance), quote it in the unit the client buys, understand
 * what a discount actually costs (lib/discount), and convert any 1099 offer
 * into an equivalent W-2 salary before negotiating (lib/paytype).
 *
 * Rendering contract (GuideShell): the shell supplies h1, the reading time,
 * the prose column, and the closing instrument panel — this component starts
 * at plain paragraphs and h2 and renders through the shared .prose-article
 * tokens. Server-component safe: no hooks, no event handlers.
 */
export default function PricingFreelanceWorkGuide() {
  const toc = [
    { id: 'floor', label: 'Derive your floor from the income you need' },
    { id: 'day-rates', label: 'Day rates are unit conversion, not repricing' },
    { id: 'raising', label: 'Raising prices and the cost of switching' },
    { id: 'discount-cost', label: 'The real cost of a discount: 1 ÷ (1 − d)' },
    { id: 'offer-1099', label: 'Judging a 1099 offer against a W-2 salary' },
    { id: 'boundaries', label: 'Where the framework ends — and the checklist' },
  ];

  return (
    <>
      <p>
        <strong>
          Price from your own numbers outward, in this order: derive a floor from the take-home you
          need, quote it in whatever unit the client buys, refuse discounts you cannot pay for in
          volume, and convert every 1099 offer into an equivalent salary before you negotiate.
        </strong>{' '}
        The floor comes from three multiplications most first-time freelancers skip — tax, expenses,
        and the hours you cannot bill — and at a realistic cost stack it lands near{' '}
        <strong>{RATE_MULTIPLE.toFixed(1)}×</strong> the naive salary-divided-by-
        {numFmt(FTE_HOURS)} figure. A
        20% discount requires <strong>{Math.round(TWENTY_OFF)}% more sold work</strong> to stand
        still. And a {usd(PAYTYPE_DEFAULTS.contractRate, 0)}/hr contract is worth roughly a{' '}
        <strong>{usd(EQ_SALARY_ROUNDED, 0)} salary</strong> once taxes and benefits are normalized.
        This guide walks each of those decisions with the suite&apos;s engines doing the
        arithmetic, so you can reproduce every number on your own inputs.
      </p>

      <ArticleToc items={toc} />

      {/* ================================================================== */}
      <h2 id="floor">Derive your floor from the income you need</h2>
      {/* ================================================================== */}
      <p>
        A freelance rate is not a feeling about your worth; it is the last line of a subtraction
        problem that starts with the cash you want to deposit. Work backward. You want a take-home.
        Revenue must also cover business expenses, taxes take their share before cash reaches you,
        and only some of your working hours can ever be billed. The{' '}
        <a href="/freelance-hourly-rate-calculator/">freelance hourly rate calculator</a> compresses
        that chain into one formula:
      </p>
      <blockquote>
        <p>
          <code>hourly = (expenses + takeHome ÷ (1 − tax%)) ÷ (billable weeks × billed hours/week)</code>
        </p>
      </blockquote>
      <p>
        Run it on the calculator&apos;s own baseline — a designer targeting{' '}
        <strong>{usd(RATE_BASE.targetTakeHome, 0)} of take-home</strong>, with{' '}
        <strong>{usd(RATE_BASE.businessExpenses, 0)}</strong> of annual business expenses, a{' '}
        <strong>{RATE_BASE.taxRate}%</strong> effective combined tax rate,{' '}
        <strong>{RATE_BASE.vacationDays} days</strong> off a year, and{' '}
        <strong>{RATE_BASE.weeklyBillableHours} billable hours</strong> a week:
      </p>
      <ul>
        <li>
          Gross-up: {usd(RATE_BASE.targetTakeHome, 0)} ÷ (1 − 0.30) ={' '}
          <strong>{usd(GROSSED_UP_PAY, 0)}</strong> of pre-tax pay must be earned
        </li>
        <li>
          Plus expenses: {usd(GROSSED_UP_PAY, 0)} + {usd(RATE_BASE.businessExpenses, 0)} ={' '}
          <strong>{usd(FLOOR.grossNeeded, 0)}</strong> of gross revenue — the year&apos;s sales
          target, about <strong>{usd(FLOOR.monthlyRate, 0)} a month</strong>
        </li>
        <li>
          Capacity: 52 weeks − ({RATE_BASE.vacationDays} ÷ 5) ={' '}
          <strong>{FLOOR.billableWeeks} working weeks</strong> × {RATE_BASE.weeklyBillableHours}{' '}
          hours = <strong>{numFmt(FLOOR.billableHours)} billable hours</strong>
        </li>
        <li>
          Floor: {usd(FLOOR.grossNeeded, 0)} ÷ {numFmt(FLOOR.billableHours)} ={' '}
          <strong>{usd(FLOOR.hourlyRate)}/hr</strong> — a{' '}
          <strong>{usd(FLOOR.dayRate, 0)} day rate</strong> at the 8-hour convention
        </li>
      </ul>
      <p>
        The naive alternative — {usd(RATE_BASE.targetTakeHome, 0)} ÷ {numFmt(FTE_HOURS)}, the
        salary-implied{' '}
        {usd(NAIVE_RATE)}/hr — is not a rounding error away; it is less than half the honest number.
        The gap decomposes exactly into three layers, each of which the engine applies in sequence:
      </p>
      <table>
        <thead>
          <tr>
            <th>Layer</th>
            <th>What it covers</th>
            <th>Multiplier</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Tax gross-up</td>
            <td>
              Self-employment plus income tax on your pay: 1 ÷ (1 −{' '}
              {RATE_BASE.taxRate / 100})
            </td>
            <td>× {TAX_LAYER.toFixed(2)}</td>
          </tr>
          <tr>
            <td>Business expenses</td>
            <td>Software, hardware, insurance, CPA — pre-tax cash costs</td>
            <td>× {EXPENSE_LAYER.toFixed(2)}</td>
          </tr>
          <tr>
            <td>Non-billable time</td>
            <td>
              {numFmt(FTE_HOURS)} FTE hours ÷ {numFmt(FLOOR.billableHours)} billable hours (
              {pct(FLOOR.utilization)} utilization)
            </td>
            <td>× {HOURS_LAYER.toFixed(2)}</td>
          </tr>
          <tr>
            <td><strong>Combined</strong></td>
            <td>
              <strong>
                {usd(NAIVE_RATE)} carried through all three layers = {usd(FLOOR.hourlyRate)}
              </strong>
            </td>
            <td><strong>× {RATE_MULTIPLE.toFixed(2)}</strong></td>
          </tr>
        </tbody>
      </table>
      <p>
        The order of that table matters more than its contents. Capacity — the third layer — is the
        one you control most and estimate worst. Re-run the same cost stack at {H20_HOURS} billed
        hours a week and the floor climbs {pct(H20_PCT, 0)} to{' '}
        <strong>{usd(H20.hourlyRate)}</strong>; at {H30_HOURS} hours it drops {pct(H30_PCT, 0)} to{' '}
        <strong>{usd(H30.hourlyRate)}</strong>. A five-hour weekly swing moves your price by a
        quarter, while a five-point tax swing (30% → 35%) moves it only {pct(T35_PCT, 0)}, from{' '}
        {usd(FLOOR.hourlyRate)} to <strong>{usd(T35.hourlyRate)}</strong>. Before you conclude your
        rate is too high for the market, audit whether the hours behind it are real: a floor built
        on capacity you do not have is a price you cannot collect.
      </p>
      <p>
        One subtlety the engine encodes and most hand calculations get wrong: expenses are{' '}
        <em>added after</em> the tax gross-up, not run through it. Deductible costs are paid from
        pre-tax revenue and never taxed; grossing them up anyway would inflate the revenue target by
        exactly E·t ÷ (1 − t) — about {usd(OVERHEAD_FROM_MISTAXED_EXPENSES, 0)} a year on{' '}
        {usd(RATE_BASE.businessExpenses, 0)} of expenses at a {RATE_BASE.taxRate}% rate.
      </p>

      {/* ================================================================== */}
      <h2 id="day-rates">Day rates are unit conversion, not repricing</h2>
      {/* ================================================================== */}
      <p>
        A day rate is your hourly multiplied by eight — the engine computes {usd(FLOOR.hourlyRate)} ×
        8 = <strong>{usd(FLOOR.dayRate)}</strong> — and a monthly figure is the annual gross
        divided by twelve ({usd(FLOOR.monthlyRate, 0)}). That is all they are: the same floor
        expressed in the unit the client finds easier to buy. No repricing happens in the
        conversion, and none should: rounding <em>down</em> a day rate is just an hourly discount
        wearing better clothes.
      </p>
      <p>
        The unit you quote does carry psychological weight, and it is legitimate to use it. A day
        rate frames the purchase as a block of focused work rather than a meter running; a weekly
        or sprint rate frames it as a seat. Bigger units also amortize your non-billable layer
        invisibly — the client never sees the sales-and-admin hours itemized, because they are
        already inside the number. Quote the unit the client&apos;s procurement process understands,
        then hold the arithmetic fixed behind it.
      </p>
      <p>
        The one honest caution is capacity, not price: a sold day consumes eight real hours, and a
        plan built on {RATE_BASE.weeklyBillableHours} billable hours a week holds{' '}
        <strong>{SOLD_DAYS_PER_WEEK.toFixed(3)} sold days</strong>, not five. Sell four-day weeks
        before your utilization supports them and you have quietly built the over-capacity plan the
        calculator&apos;s utilization readout exists to flag. Unit conversion changes how the work
        is quoted; it never changes how many hours exist.
      </p>

      {/* ================================================================== */}
      <h2 id="raising">Raising prices and the cost of switching</h2>
      {/* ================================================================== */}
      <p>
        The hardest pricing decision is not the first number — it is the second. Raising rates
        risks watching clients walk, so most freelancers hold a price long after their cost stack
        has moved. The arithmetic says that fear is expensive in both directions, and asymmetric in
        your favor.
      </p>
      <p>
        Cut your price 20% and you must sell <strong>{Math.round(TWENTY_OFF)}% more</strong> just
        to stand still — that is the 1 ÷ (1 − d) law the next section computes. Raise your price
        20% and you can lose <strong>{RAISE_TOLERANCE.toFixed(1)}% of your clients</strong> — one
        in six — and still collect the same revenue. The same equation, solved the other way:{' '}
        {numFmt(HOURS_AT_120_FOR_150)} sold hours at 1.2× the rate pay what 150 did. Downside risk
        compounds (each discount needs more than its face in new work); upside risk discounts (each
        premium tolerates less than its face in lost work).
      </p>
      <p>
        Switching costs are why the tolerance is real. A client who knows your work carries search
        costs, onboarding costs, and delivery risk a replacement cannot quote away; a 20% premium on
        a known-good freelancer is usually cheaper than the alternative even at face. You carry
        switching costs too — which is the argument for raising rates where switching is cheapest
        first:
      </p>
      <ol>
        <li>
          <strong>New clients pay the new rate immediately.</strong> They have no anchor to your old
          price; the market, not your history, prices them.
        </li>
        <li>
          <strong>Existing clients get an annual, dated increase</strong> — with notice, and with
          the option to re-scope down rather than walk. A 10% annual raise compounds quietly; the
          utilization math above says the alternative is discovering the shortfall in December.
        </li>
        <li>
          <strong>Re-price the bottom of your book first.</strong> The clients consuming the most
          unbilled hours are the ones your floor has drifted farthest from.
        </li>
      </ol>

      {/* ================================================================== */}
      <h2 id="discount-cost">The real cost of a discount: 1 ÷ (1 − d)</h2>
      {/* ================================================================== */}
      <p>
        Every freelancer eventually hears some version of &ldquo;we&apos;d love to work with you at
        20% less.&rdquo; The <a href="/discount-impact-calculator/">discount impact calculator</a>{' '}
        prices what that sentence actually costs. Hold revenue flat and the required volume
        increase is a function of the discount alone:
      </p>
      <blockquote>
        <p>
          <code>1 + u = 1 ÷ (1 − d)  →  u = d ÷ (1 − d)</code>
        </p>
      </blockquote>
      <p>
        That is the classical price–volume trade-off (Marn &amp; Rosiello, &ldquo;Managing Price,
        Gaining Profit,&rdquo; Harvard Business Review, 1992), and every entry in the ladder below
        is the engine&apos;s output:
      </p>
      <table>
        <thead>
          <tr>
            <th>Discount</th>
            <th>Extra volume to hold revenue flat</th>
          </tr>
        </thead>
        <tbody>
          {LADDER.map((row) => (
            <tr key={row.d}>
              <td>{row.d}% off</td>
              <td>+{row.uplift.toFixed(1)}%</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p>
        For a solo freelancer this revenue-flat floor is also the <em>profit</em>-flat number,
        because your unit cost of delivery is roughly zero — the engine confirms it: at a{' '}
        {usd(FLOOR.hourlyRate)} rate with no delivery cost (100% gross margin), the profit-neutral
        uplift at 20% off is exactly +{SOLO_UPLIFT.toFixed(0)}%. The moment delivery has a cost,
        the true requirement is worse. Subcontract at ${SUB_RATE.unitCost}/hr on a $
        {SUB_RATE.price}
        /hr rate (a {pct(SUB_AGG.baseGrossMarginPct ?? 0)} gross margin) and a 20% discount needs{' '}
        <strong>+{SUB20.toFixed(1)}%</strong> more sold hours — the margin falls from{' '}
        {usd(SUB_AGG.baseUnitMargin, 0)} to {usd(SUB_AGG.discountedUnitMargin, 0)} per hour, a{' '}
        {pct(SUB_AGG.unitMarginErosionPct ?? 0, 0)} erosion, and {numFmt(SUB_RATE.volume)} delivered
        hours a month become {numFmt(SUB_AGG.breakEvenVolume ?? 0, 1)} just to break even. A 10%
        &ldquo;loyalty&rdquo; rate, which sounds harmless, needs +{SUB10.toFixed(1)}% at that same
        margin.
      </p>
      <p>
        Now translate the ladder back into your own year. Your floor was computed on{' '}
        {numFmt(FLOOR.billableHours)} hours at {usd(FLOOR.hourlyRate)}. Grant 20% off and the
        effective rate is <strong>{usd(SOLO_AGG.discountedPrice)}</strong>; holding the same{' '}
        {usd(FLOOR.grossNeeded, 0)} gross now takes{' '}
        <strong>{numFmt(HOLD_HOURS, 0)} hours — {HOLD_WEEKLY.toFixed(2)} billed hours a
        week</strong>, up from {RATE_BASE.weeklyBillableHours}. The discount did not cost 20% of
        your rate; it cost {HOLD_WEEKLY_DELTA.toFixed(2)} billable hours a week you had already
        budgeted for sales, admin, and rest. When you cannot buy the volume — and a solo calendar
        usually cannot — the discount converts directly into take-home.
      </p>
      <p>
        This is not a ban on flexibility; it is a rule for its shape. Idle capacity can be priced
        at margin rather than at average cost — a slow month may rationally accept work above the
        marginal cost of delivering it. But a standing &ldquo;friendly&rdquo; rate is not marginal
        pricing; it is a permanent repricing of your best hours. Cheaper concessions than a blanket
        rate cut: reduce scope to fit the budget (same rate, fewer hours), trade the discount for
        something priced — a longer engagement, a case study, faster payment terms — or simply hold
        the number. The suite&apos;s{' '}
        <a href="/guides/getting-paid-without-losing-margin/">getting-paid guide</a> works the
        payment-rail side of the same margin.
      </p>

      {/* ================================================================== */}
      <h2 id="offer-1099">Judging a 1099 offer against a W-2 salary</h2>
      {/* ================================================================== */}
      <p>
        The floor tells you what to charge; an offer arrives and you must judge someone else&apos;s
        number. The instinctive comparison — contract hourly versus salary ÷{' '}
        {numFmt(PAYTYPE_CONSTANTS.hoursPerYear)} — fails in both directions, because the two pay
        types are taxed differently, carry different benefits, and pay for different hours. The{' '}
        <a href="/1099-vs-w2-calculator/">1099 vs W-2 calculator</a> runs both sides of that ledger
        on a 2025 federal single-filer model: the {usd(PAYTYPE_CONSTANTS.stdDeduction, 0)} standard
        deduction (Rev. Proc. 2024-40 as raised for 2025 by P.L. 119-21), the{' '}
        {usd(PAYTYPE_CONSTANTS.ssWageBase, 0)} Social Security wage base, self-employment tax on{' '}
        {pct(PAYTYPE_CONSTANTS.seBaseFactor * 100, 2)} of net profit (§1402(a)) with half of it
        deductible (§164(f)), the self-employed health-insurance deduction (§162(l)), and the{' '}
        {pct(PAYTYPE_CONSTANTS.qbiRate * 100, 0)} qualified-business-income deduction (§199A). No
        state income tax is modeled — with one, the contract&apos;s breakeven moves, not the method.
      </p>
      <p>
        On the calculator&apos;s default scenario — a{' '}
        <strong>{usd(PAYTYPE_DEFAULTS.salary, 0)} salary</strong> with{' '}
        {usd(PAYTYPE_DEFAULTS.healthPremium, 0)} of employer-paid health premium, a{' '}
        {usd(PAYTYPE_DEFAULTS.retirementMatch, 0)} retirement match, and{' '}
        {usd(PAYTYPE_DEFAULTS.otherBenefits, 0)} of other benefits, against a{' '}
        <strong>{usd(PAYTYPE_DEFAULTS.contractRate, 0)}/hr</strong> contract with{' '}
        {PAYTYPE_DEFAULTS.ptoDays} PTO days and {usd(PAYTYPE_DEFAULTS.seExpenses, 0)} of business
        expenses — the two ledgers read:
      </p>
      <table>
        <thead>
          <tr>
            <th>Line</th>
            <th>W-2 job</th>
            <th>1099 at {usd(PAYTYPE_DEFAULTS.contractRate, 0)}/hr</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Hours paid / billable</td>
            <td>{numFmt(PAYTYPE_CONSTANTS.hoursPerYear)} (PTO included)</td>
            <td>{numFmt(CON.hours)} ({PAYTYPE_DEFAULTS.ptoDays} PTO days unpaid)</td>
          </tr>
          <tr>
            <td>Gross</td>
            <td>{usd(PAYTYPE_DEFAULTS.salary, 0)} salary</td>
            <td>
              {usd(CON.revenue, 0)} revenue − {usd(CON.expenses, 0)} expenses
            </td>
          </tr>
          <tr>
            <td>Payroll tax</td>
            <td>{usd(W2.fica, 0)} employee FICA</td>
            <td>{usd(CON.seTax, 0)} SE tax (both halves)</td>
          </tr>
          <tr>
            <td>Federal income tax</td>
            <td>{usd(W2.incomeTax, 0)}</td>
            <td>
              {usd(CON.incomeTax, 0)} (after ½-SE, SEHI, {usd(CON.qbiDeduction, 0)} QBI)
            </td>
          </tr>
          <tr>
            <td>Benefits, at face</td>
            <td>{usd(BENEFITS_TOTAL, 0)}</td>
            <td>— (self-funded inside expenses)</td>
          </tr>
          <tr>
            <td><strong>Annual value kept</strong></td>
            <td><strong>{usd(W2.totalValue, 0)}</strong></td>
            <td><strong>{usd(CON.valueKept, 0)}</strong></td>
          </tr>
        </tbody>
      </table>
      <p>
        The contract wins this scenario by <strong>{usd(LEDGER_DELTA, 0)}</strong> — but notice
        everything the {usd(SALARY_HOURLY)}/hr versus{' '}
        {usd(PAYTYPE_DEFAULTS.contractRate, 0)}/hr comparison hid: both halves of SE tax,{' '}
        {numFmt(PTO_HOURS)} unpaid PTO hours (worth <strong>{usd(PTO_COST, 0)}</strong> of billable
        time at the breakeven rate), benefits you must now buy, and deductions (QBI, SEHI) that
        quietly pull it back. The right way to hold the two sides together is with the engine&apos;s
        two conversion functions:
      </p>
      <ul>
        <li>
          <strong>The breakeven rate</strong> — the hourly at which the contract ties the package —
          is <strong>{usd(BE_RATE)}/hr</strong> here, a{' '}
          <strong>{BE_MARKUP.toFixed(1)}% markup</strong> on the {usd(SALARY_HOURLY)} salary-implied
          rate. That is the floor for the negotiation, not the opening.
        </li>
        <li>
          <strong>The equivalent W-2 salary</strong> — what the{' '}
          {usd(PAYTYPE_DEFAULTS.contractRate, 0)}/hr quote is worth as a job with the same benefits
          — is <strong>{usd(EQ_SALARY, 0)}</strong>. This is the number to negotiate with, because
          everyone at the table speaks salary: &ldquo;this contract pays me like a{' '}
          {usd(EQ_SALARY_ROUNDED, 0)} employee&rdquo; is a sentence a hiring manager can act on.
        </li>
      </ul>
      <p>
        If the offered rate sits below breakeven, the honest move is to name the breakeven and show
        the ledger — the employer half of FICA (another{' '}
        {pct((PAYTYPE_CONSTANTS.ssRate + PAYTYPE_CONSTANTS.medicareRate) * 100, 2)} the company
        saves on you) is a fair
        anchor to point at. If it sits above, you are not done either: every assumption in the
        table is negotiable leverage. Fewer PTO days lowers the breakeven rate; a thinner benefits
        package raises it; unpaid bench time between contracts, which this model deliberately
        excludes, raises it further (the{' '}
        <a href="/freelance-hourly-rate-calculator/">rate calculator</a> owns that layer).
      </p>

      {/* ================================================================== */}
      <h2 id="boundaries">Where the framework ends — and the checklist</h2>
      {/* ================================================================== */}
      <p>
        Three boundaries keep this framework honest. First, the floor is a cost-side number; the
        market sets the ceiling, and a specialist can — and should — price well above the floor
        where the value of the work supports it. Second, the flat effective-tax input stops
        describing you once you elect S-corp taxation and split pay into salary and distributions —
        at that point the <a href="/s-corp-tax-calculator/">S-Corp tax calculator</a> owns the
        arithmetic. Third, the pay-type model is a simplified 2025 federal illustration, not tax
        advice; state taxes, unemployment insurance, and payroll friction all move real numbers.
      </p>
      <p>The decision sequence, compressed:</p>
      <ol>
        <li>
          Fix the target: the take-home you actually need, from last year&apos;s net deposits
          adjusted honestly.
        </li>
        <li>
          Compute the floor with conservative capacity — billable hours you have evidence for, not
          ambition. Re-run it with last year&apos;s real hours before quoting anything.
        </li>
        <li>
          Quote in the client&apos;s unit (hour, day, sprint) at one price derived from the floor;
          never convert units and round down.
        </li>
        <li>
          Price any requested discount at 1 ÷ (1 − d) — at 20% off that is +
          {Math.round(TWENTY_OFF)}% volume — and concede scope or terms before rate.
        </li>
        <li>
          Raise new-client rates immediately and existing-client rates annually; you can lose one
          client in six to a 20% premium and still stand still.
        </li>
        <li>
          Judge every offer through the pay-type ledger: breakeven rate as your floor, equivalent
          salary as your negotiating language.
        </li>
      </ol>
      <p>
        The instruments below run each step on your numbers. The framework is the order; the
        arithmetic is theirs.
      </p>
    </>
  );
}

import { ArticleToc } from '@/components/Article';
import {
  PAYTYPE_CONSTANTS,
  PAYTYPE_DEFAULTS,
  billableHours,
  breakevenContractRate,
  computeContractorSide,
  equivalentW2Salary,
} from '@/lib/paytype';
import {
  PAYROLL_CONSTANTS,
  PAYROLL_DEFAULTS,
  computeEmployerCost,
  employerFica,
  loadedCostSweep,
  revenueToCover,
} from '@/lib/payroll';
import type { PayrollCostInputs } from '@/lib/payroll';
import { computeEstimatedTax } from '@/lib/estimated';
import { numFmt, pct, usd } from '@/lib/format';

/* Every number in this guide is computed at build time by the suite's engines
   — lib/paytype (the pay-type ledger, backed by the 1099-vs-W-2 instrument),
   the new lib/payroll (the employer-side cost stack; formulas are stated in
   the guide because no dedicated instrument exists for it yet), and
   lib/estimated (quarterly installments, backed by the estimated-tax
   instrument). Nothing is hand-typed; state-varying inputs (FUTA credit
   position, SUTA rate and base, benefits, workers'-comp premium) are the
   illustrative defaults PAYROLL_DEFAULTS itself carries, and the prose says
   so wherever one appears. */

/* ---- The employer-side stack on the worked example (lib/payroll) --------- */
const STACK = computeEmployerCost(PAYROLL_DEFAULTS);
const SS_PART = STACK.salary * PAYROLL_CONSTANTS.erSsRate; // the 6.2% layer
const MED_PART = STACK.salary * PAYROLL_CONSTANTS.erMedicareRate; // the 1.45% layer
const COMBINED_FICA = STACK.employerFica * 2; // employer mirror + employee half
const FICA_AT_CAP = employerFica(PAYROLL_CONSTANTS.ssWageBase);
const SURCHARGE_GAP =
  (250000 - PAYTYPE_CONSTANTS.addlMedicareThreshold) * PAYTYPE_CONSTANTS.addlMedicareRate; // $450 never matched
const FUTA_NO_CREDIT =
  PAYROLL_CONSTANTS.futaWageBase * PAYROLL_CONSTANTS.futaStandardRate; // 6.0% with no §3302 credit

/* ---- The salary ladder and the revenue a hire must carry ----------------- */
const LADDER_BASE: Omit<PayrollCostInputs, 'salary'> = {
  futaRate: PAYROLL_DEFAULTS.futaRate,
  sutaRate: PAYROLL_DEFAULTS.sutaRate,
  sutaWageBase: PAYROLL_DEFAULTS.sutaWageBase,
  benefitsAnnual: PAYROLL_DEFAULTS.benefitsAnnual,
  workersCompAnnual: PAYROLL_DEFAULTS.workersCompAnnual,
};
const LADDER = loadedCostSweep(LADDER_BASE, [40000, 60000, 80000, 100000, 120000]);
const COVER_50 = revenueToCover(STACK.loadedCost, 50);
const COVER_35 = revenueToCover(STACK.loadedCost, 35);
const CAP_STEP_MEDICARE_ONLY = employerFica(200000) - employerFica(180000); // 290 = 20k × 1.45%

/* ---- The contractor cross-walk (lib/paytype, from the employer's chair) -- */
const CON = computeContractorSide(PAYTYPE_DEFAULTS);
const CONTRACTOR_SPEND = CON.revenue; // what you pay the 1099 today
const CONTRACTOR_HOURLY = CON.revenue / CON.hours; // spend per billed (delivered) hour
const BE_RATE = breakevenContractRate(PAYTYPE_DEFAULTS) ?? 0;
const EQ_SALARY = equivalentW2Salary(PAYTYPE_DEFAULTS) ?? 0;
const EMP_AT_EQ = computeEmployerCost({ ...PAYROLL_DEFAULTS, salary: EQ_SALARY });
const CASH_DELTA = EMP_AT_EQ.loadedCost - CONTRACTOR_SPEND; // employee costs MORE in cash
const CASH_DELTA_PCT = (CASH_DELTA / CONTRACTOR_SPEND) * 100; // ≈ +1.9%
/* Denominator discipline: compare on MATCHED hours. The person works the same
   1,960 delivered hours either way (billableHours(15) = 2,080 − 8×15); the
   employee's 2,080 PAID hours include 120 hours of vacation. Both bases are
   computed below so no sentence mixes them. */
const DELIVERED_HOURS = billableHours(PAYTYPE_DEFAULTS.ptoDays); // 1,960 either way
const PTO_HOURS = PAYTYPE_CONSTANTS.hoursPerYear - DELIVERED_HOURS; // paid, not delivered
const EMP_DELIVERED_HOURLY = EMP_AT_EQ.loadedCost / DELIVERED_HOURS; // ≈ $66.20
const DELIVERED_PREMIUM = EMP_DELIVERED_HOURLY - CONTRACTOR_HOURLY; // ≈ +$1.20/hr
const CONTRACTOR_PAID_BASIS = CONTRACTOR_SPEND / PAYTYPE_CONSTANTS.hoursPerYear; // ≈ $61.25
const STACK_DELIVERED_HOURLY = STACK.loadedCost / DELIVERED_HOURS; // $60k example per delivered hr

/* ---- What the hire does to the owner's quarterly estimates (lib/estimated) */
const OWNER_NETSE = 150000;
const EST_INPUTS = {
  filingStatus: 'single',
  w2Withholding: 0,
  priorTax: null,
  priorAgiOver150k: false,
} as const;
const EST_BEFORE = computeEstimatedTax({ ...EST_INPUTS, netSE: OWNER_NETSE });
const NETSE_AFTER = OWNER_NETSE - STACK.loadedCost;
const EST_AFTER = computeEstimatedTax({ ...EST_INPUTS, netSE: NETSE_AFTER });
const TAX_SAVED = EST_BEFORE.currentTotalTax - EST_AFTER.currentTotalTax;
const QTR_DROP = EST_BEFORE.perQuarter - EST_AFTER.perQuarter;
const SHIELD_PCT = (TAX_SAVED / STACK.loadedCost) * 100;
const AFTER_TAX_COST = STACK.loadedCost - TAX_SAVED;

/**
 * Guide body for /guides/hiring-your-first-employee/ — the decision playbook
 * for the jump from contractors to a first W-2 hire: convert the contractor's
 * rate into the salary it is worth to them (lib/paytype), load that salary
 * with every employer-side layer (lib/payroll), and recompute the owner's own
 * quarterly installments on the smaller net (lib/estimated).
 *
 * Rendering contract (GuideShell): the shell supplies h1, the reading time,
 * the prose column, and the closing instrument panel — this component starts
 * at plain paragraphs and h2 and renders through the shared .prose-article
 * tokens. Server-component safe: no hooks, no event handlers.
 */
export default function HiringYourFirstEmployeeGuide() {
  const toc = [
    { id: 'contractor-or-employee', label: 'Employee or contractor: price the package, not the rate' },
    { id: 'true-cost', label: 'The employer-side stack: what a salary really costs' },
    { id: 'sensitivity', label: 'What moves the number — and the revenue it must carry' },
    { id: 'estimates', label: 'What the hire does to your quarterly estimates' },
    { id: 'boundaries', label: 'Where the framework ends — and the checklist' },
  ];

  return (
    <>
      <ArticleToc items={toc} />

      <p>
        <strong>
          Decide the first hire with three engine-run numbers, in this order: what the contractor&rsquo;s
          rate is worth as a salary, what that salary costs once every employer-side layer is loaded
          on, and what the hire does to your own quarterly installments.
        </strong>{' '}
        On this suite&rsquo;s baseline, a {usd(PAYTYPE_DEFAULTS.contractRate, 0)}/hr contractor is
        worth roughly a <strong>{usd(EQ_SALARY, 0)} salary</strong> to the worker; employing at
        that salary with the same benefits costs{' '}
        <strong>{usd(EMP_AT_EQ.loadedCost, 0)}</strong> a year — {usd(CASH_DELTA, 0)} more cash
        (+{CASH_DELTA_PCT.toFixed(1)}%), and on matched delivered hours a{' '}
        {usd(DELIVERED_PREMIUM)}/hr premium, not a discount: the conversion is close to
        price-neutral, and what it actually changes is cost structure. The employer side of a
        typical stack adds <strong>{pct(STACK.burdenRatePct, 1)}</strong> over the nominal salary,
        so budget <strong>{usd(STACK.loadedCost, 0)}</strong> for a{' '}
        {usd(STACK.salary, 0)} hire — and because every layer of that stack is a deductible
        business expense, the modeled owner&rsquo;s after-tax cost is{' '}
        <strong>{usd(AFTER_TAX_COST, 0)}</strong>. This guide walks each step with the
        suite&rsquo;s engines doing the arithmetic, and every formula and input is stated so you
        can carry your own state rates and benefits through it.
      </p>

      {/* ================================================================== */}
      <h2 id="contractor-or-employee">Employee or contractor: price the package, not the rate</h2>
      {/* ================================================================== */}
      <p>
        The instinctive comparison — contractor hourly versus salary ÷{' '}
        {numFmt(PAYTYPE_CONSTANTS.hoursPerYear)} — fails from the employer&rsquo;s chair for the
        same reason it fails from the worker&rsquo;s: the two pay types carry different taxes,
        different benefits, and different hours. The{' '}
        <a href="/1099-vs-w2-calculator/">1099 vs W-2 calculator</a> runs that ledger from the
        worker&rsquo;s side on a 2025 federal model, and its two conversion functions are exactly
        the anchors a hiring business needs. On the calculator&rsquo;s default scenario — a{' '}
        {usd(PAYTYPE_DEFAULTS.contractRate, 0)}/hr contract, {PAYTYPE_DEFAULTS.ptoDays} unpaid PTO
        days, {usd(PAYTYPE_DEFAULTS.healthPremium, 0)} of employer-paid health premium, a{' '}
        {usd(PAYTYPE_DEFAULTS.retirementMatch, 0)} retirement match, and{' '}
        {usd(PAYTYPE_DEFAULTS.otherBenefits, 0)} of other benefits:
      </p>
      <ul>
        <li>
          <strong>The breakeven rate is {usd(BE_RATE)}/hr.</strong> Below it, the contract pays the
          worker less than the job would — which is why a contractor quoting under{' '}
          {usd(BE_RATE)} for comparable work is either pricing desperation or forgetting their own
          half of FICA (the{' '}
          <a href="/guides/pricing-freelance-work/">pricing guide</a> owns that side).
        </li>
        <li>
          <strong>The {usd(PAYTYPE_DEFAULTS.contractRate, 0)}/hr quote is worth a{' '}
          {usd(EQ_SALARY, 0)} salary</strong> with the same benefits. That is the number at which
          the worker is indifferent between the two deals — your benchmark offer level, not the
          market rate for the role.
        </li>
      </ul>
      <p>
        Now sit in the employer&rsquo;s chair and price the conversion. You currently spend{' '}
        <strong>{usd(CONTRACTOR_SPEND, 0)}</strong> a year on that contractor —{' '}
        {usd(PAYTYPE_DEFAULTS.contractRate, 0)} × {numFmt(CON.hours)} billable hours, or{' '}
        <strong>{usd(CONTRACTOR_HOURLY)}/hr</strong>. Hire the same person at the equivalent
        salary with the same benefits and the payroll engine prices the loaded cost at{' '}
        <strong>{usd(EMP_AT_EQ.loadedCost, 0)}</strong> — {usd(CASH_DELTA, 0)} <em>more</em> in
        cash out the door, about +{CASH_DELTA_PCT.toFixed(1)}%. To compare per hour, divide both
        sides by the <em>same</em> hours — the two packages pay for different baskets. The{' '}
        {numFmt(PAYTYPE_CONSTANTS.hoursPerYear)} paid hours you buy as an employer include{' '}
        {numFmt(PTO_HOURS)} hours of vacation (the model&rsquo;s {PAYTYPE_DEFAULTS.ptoDays} PTO
        days: paid, but not work delivered), while the contract&rsquo;s{' '}
        {numFmt(DELIVERED_HOURS)} billable hours are exactly the hours that work. On those
        delivered hours the hire costs <strong>{usd(EMP_DELIVERED_HOURLY)}</strong> against the
        contractor&rsquo;s <strong>{usd(CONTRACTOR_HOURLY)}</strong> — a{' '}
        {usd(DELIVERED_PREMIUM)}/hr premium, not a discount. On the paid-hour basis instead it is{' '}
        {usd(EMP_AT_EQ.costPerHour)} against {usd(CONTRACTOR_PAID_BASIS)} — the contract again.
        On <em>any</em> consistent basis the conversion is roughly price-neutral, and price is
        not what this decision changes; structure is.
      </p>
      <p>
        If the price is a wash, the structure is not. The
        contractor is a variable cost — you pay {usd(PAYTYPE_DEFAULTS.contractRate, 0)} exactly
        when there is work to invoice and nothing when there is not. The employee is a fixed
        stack — you buy {numFmt(PAYTYPE_CONSTANTS.hoursPerYear)} paid hours at a
        schedule the calendar sets, whether sales arrive or not, and the{' '}
        {usd(DELIVERED_PREMIUM)}/hr premium buys scheduling certainty, not extra work: the same{' '}
        {numFmt(DELIVERED_HOURS)} hours of it are inside. That is why the hire decision
        ends in a utilization question, and why the revenue coverage test in the third section
        gates it. Two cautions belong here too. First, the contractor self-funds layers you will
        now buy — their own health insurance is inside their rate, their equipment is theirs, and
        in most states their own working arrangement carries none of your workers&rsquo;-comp
        obligation; the stack in the next section is what those layers cost when they move onto
        your books. Second, classification is a facts-and-circumstances legal test — behavioral
        control, financial control, the substance of the relationship — not the label on the
        invoice. If the IRS later recharacterizes a contractor as an employee, the business owes
        back employer FICA for the misclassified period plus interest and penalties. This guide
        prices a genuine conversion, not a re-labeling of the same arrangement.
      </p>

      {/* ================================================================== */}
      <h2 id="true-cost">The employer-side stack: what a salary really costs</h2>
      {/* ================================================================== */}
      <p>
        A salary is the first line of the cost stack, not the stack. Federal law attaches
        employer-side taxes to every payroll dollar, and the benefits and insurance you are about
        to buy ride on top. The suite&rsquo;s payroll engine — the pure functions every number in
        this section runs on — computes the whole ledger in one pass:
      </p>
      <blockquote>
        <p>
          <code>loaded = salary + employerFICA + FUTA + SUTA + benefits + workers&rsquo; comp</code>
        </p>
      </blockquote>
      <p>
        Run it on the worked example this guide carries throughout — a{' '}
        <strong>{usd(STACK.salary, 0)} salary</strong>, the common {pct(PAYROLL_CONSTANTS.futaEffectiveDefault * 100, 1)} effective
        FUTA rate, an illustrative {pct(PAYROLL_DEFAULTS.sutaRate * 100, 1)} SUTA rate on an
        illustrative {usd(PAYROLL_DEFAULTS.sutaWageBase, 0)} state wage base, the 1099-vs-W-2
        calculator&rsquo;s {usd(PAYROLL_DEFAULTS.benefitsAnnual, 0)} benefits stack, and an
        illustrative {usd(PAYROLL_DEFAULTS.workersCompAnnual, 0)} workers&rsquo;-comp premium:
      </p>
      <table>
        <thead>
          <tr>
            <th>Layer</th>
            <th>Basis (2025)</th>
            <th>At a {usd(STACK.salary, 0)} salary</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Employer Social Security</td>
            <td>
              {pct(PAYROLL_CONSTANTS.erSsRate * 100, 1)} of wages up to the{' '}
              {usd(PAYROLL_CONSTANTS.ssWageBase, 0)} wage base (§3111(a); SSA 2025 amount)
            </td>
            <td>{usd(SS_PART, 0)}</td>
          </tr>
          <tr>
            <td>Employer Medicare</td>
            <td>
              {pct(PAYROLL_CONSTANTS.erMedicareRate * 100, 2)} of all wages, no cap (§3111(b))
            </td>
            <td>{usd(MED_PART, 0)}</td>
          </tr>
          <tr>
            <td>FUTA</td>
            <td>
              {pct(PAYROLL_CONSTANTS.futaStandardRate * 100, 1)} of the first{' '}
              {usd(PAYROLL_CONSTANTS.futaWageBase, 0)} per employee (§3301, §3306(b)(1)), less up
              to a {pct(PAYROLL_CONSTANTS.futaMaxCreditRate * 100, 1)} credit for state
              unemployment taxes paid on time (§3302(a)) — effective rate entered by you
            </td>
            <td>{usd(STACK.futa, 0)}</td>
          </tr>
          <tr>
            <td>SUTA</td>
            <td>
              Your state&rsquo;s rate × your state&rsquo;s wage base — input; illustrated at{' '}
              {pct(PAYROLL_DEFAULTS.sutaRate * 100, 1)} × {usd(PAYROLL_DEFAULTS.sutaWageBase, 0)}
            </td>
            <td>{usd(STACK.suta, 0)}</td>
          </tr>
          <tr>
            <td>Benefits</td>
            <td>
              Health premium + retirement match + other, at face — input (
              {usd(PAYTYPE_DEFAULTS.healthPremium, 0)} + {usd(PAYTYPE_DEFAULTS.retirementMatch, 0)}{' '}
              + {usd(PAYTYPE_DEFAULTS.otherBenefits, 0)} here)
            </td>
            <td>{usd(STACK.benefits, 0)}</td>
          </tr>
          <tr>
            <td>Workers&rsquo; comp</td>
            <td>
              Quoted per $100 of payroll by state and job class — input; illustrated at{' '}
              {usd(PAYROLL_DEFAULTS.workersCompAnnual, 0)}/yr
            </td>
            <td>{usd(STACK.workersComp, 0)}</td>
          </tr>
          <tr>
            <td><strong>Loaded cost</strong></td>
            <td>
              <strong>
                {STACK.loadedMultiple.toFixed(2)}× the salary — a{' '}
                {pct(STACK.burdenRatePct, 1)} burden rate
              </strong>
            </td>
            <td><strong>{usd(STACK.loadedCost, 0)}</strong></td>
          </tr>
        </tbody>
      </table>
      <p>
        Read the statutory layers the way the engine encodes them. <strong>Employer FICA is the
        exact mirror of what the paycheck withholds</strong>: {usd(STACK.employerFica, 0)} from you
        and {usd(STACK.employerFica, 0)} from the employee makes {usd(COMBINED_FICA, 0)} of FICA on
        a {usd(STACK.salary, 0)} salary, and the engine holds that symmetry all the way to the{' '}
        {usd(PAYROLL_CONSTANTS.ssWageBase, 0)} wage base — {usd(FICA_AT_CAP)} per side at the cap.
        One asymmetry is worth memorizing because it cuts in your favor: the{' '}
        {pct(PAYTYPE_CONSTANTS.addlMedicareRate * 100, 1)} Additional Medicare Tax above{' '}
        {usd(PAYTYPE_CONSTANTS.addlMedicareThreshold, 0)} of wages is <em>withheld from the
        employee only</em> (§3101(b)). The employer matches Medicare at{' '}
        {pct(PAYROLL_CONSTANTS.erMedicareRate * 100, 2)} and never matches the surcharge — a{' '}
        {usd(SURCHARGE_GAP, 0)} gap on a {usd(250000, 0)} salary, and the reason expensive hires
        cost slightly less on the employer side than the employee&rsquo;s paycheck suggests.
      </p>
      <p>
        <strong>FUTA is a fixed toll, not a rate on the salary.</strong> It applies to the first{' '}
        {usd(PAYROLL_CONSTANTS.futaWageBase, 0)} of wages <em>per employee</em>, so on this example
        it is {usd(STACK.futa, 0)} at the common effective {pct(PAYROLL_CONSTANTS.futaEffectiveDefault * 100, 1)} —
        and it would be {usd(FUTA_NO_CREDIT, 0)} at the full{' '}
        {pct(PAYROLL_CONSTANTS.futaStandardRate * 100, 1)}
        standard rate if your state contributions earned no credit. Credit-reduction states pay
        more than the default; your effective FUTA rate is an explicit input to the stack
        precisely because &ldquo;most states&rdquo; is not all of them. Every additional hire
        adds another{' '}
        {usd(PAYROLL_CONSTANTS.futaWageBase, 0)}-based toll of their own. <strong>SUTA deserves
        more respect than the {usd(STACK.suta, 0)} line suggests</strong>: the rate and the wage
        base are set by your state and by your account&rsquo;s claims history — a new account gets
        a state-formula starting rate that experience-rating then moves up or down, and state wage
        bases run from the {usd(PAYROLL_CONSTANTS.futaWageBase, 0)} federal floor to well above{' '}
        {usd(50000, 0)} in a handful of states. The illustration is a placeholder; find your two
        numbers before deciding anything.
      </p>
      <p>
        Below the statutory lines sit the layers you choose. Benefits enter at face value — and
        they are flat, not proportional: the {usd(STACK.benefits, 0)} family premium costs the
        same whether the salary is {usd(40000, 0)} or {usd(120000, 0)}, which is the single
        biggest reason cheap hires carry the heaviest burden <em>rates</em>. Workers&rsquo; comp
        is quoted per $100 of payroll by state and job classification; the{' '}
        {usd(STACK.workersComp, 0)} here is an illustration, and an office-vs-roofing
        difference in class code can move it by an order of magnitude. The engine deliberately
        stops here: payroll-service fees, state disability and paid-leave programs, and local
        payroll taxes are not modeled — they exist, they only add, and the honest move is to
        price your own before committing.
      </p>
      <p>
        The stack&rsquo;s total is the number to budget: <strong>{usd(STACK.loadedCost, 0)}</strong>{' '}
        a year, <strong>{usd(STACK.costPerHour)} per paid hour</strong> of the{' '}
        {numFmt(PAYTYPE_CONSTANTS.hoursPerYear)}-hour year. When you set that against a contractor
        rate, divide by delivered hours, not paid hours — subtract the{' '}
        {numFmt(PTO_HOURS)} PTO hours again — which puts this example at{' '}
        <strong>{usd(STACK_DELIVERED_HOURLY)} per delivered hour</strong>. Never quote a hire
        budget in salary, and never compare it to a rate across different baskets of hours.
      </p>

      {/* ================================================================== */}
      <h2 id="sensitivity">What moves the number — and the revenue it must carry</h2>
      {/* ================================================================== */}
      <p>
        Re-run the same stack at different salaries and the shape of the decision appears. Fixed
        layers amortize as salary rises, so the burden rate falls monotonically while the salary
        stays under the Social Security base:
      </p>
      <table>
        <thead>
          <tr>
            <th>Salary</th>
            <th>Loaded cost</th>
            <th>Burden rate</th>
          </tr>
        </thead>
        <tbody>
          {LADDER.map((row) => (
            <tr key={row.salary}>
              <td>{usd(row.salary, 0)}</td>
              <td>{usd(row.loadedCost, 0)}</td>
              <td>{pct(row.burdenRatePct, 1)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p>
        Three structural facts sit in that table. First, the {usd(40000, 0)} hire carries a{' '}
        {pct(LADDER[0].burdenRatePct, 1)} burden rate against {pct(LADDER[4].burdenRatePct, 1)} at{' '}
        {usd(120000, 0)} — the flat benefits layer dominates small salaries, so hiring part-time
        or junior first does not scale as cheaply as the salary alone suggests. Second, above the{' '}
        {usd(PAYROLL_CONSTANTS.ssWageBase, 0)} Social Security base the{' '}
        {pct(PAYROLL_CONSTANTS.erSsRate * 100, 1)} layer stops: the engine computes a{' '}
        {usd(180000, 0)} → {usd(200000, 0)} salary step as exactly{' '}
        {usd(CAP_STEP_MEDICARE_ONLY, 2)} of employer FICA — pure{' '}
        {pct(PAYROLL_CONSTANTS.erMedicareRate * 100, 2)} Medicare, nothing else — so marginal
        employer cost actually <em>falls</em> for expensive hires. Third, SUTA and FUTA are done
        after {usd(PAYROLL_DEFAULTS.sutaWageBase, 0)} and{' '}
        {usd(PAYROLL_CONSTANTS.futaWageBase, 0)} respectively; they never grow with the salary at
        all.
      </p>
      <p>
        Now the gating test. A loaded cost is a commitment to a revenue level, because the hire
        must be paid out of gross margin, not out of revenue. At a{' '}
        {pct(50, 0)} gross margin, every dollar of cost needs two dollars of revenue — the
        engine&rsquo;s coverage function prices this example at{' '}
        <strong>{usd(COVER_50, 0)}</strong> of revenue the hire must support. Thin the margin to{' '}
        {pct(35, 0)} and the requirement climbs to <strong>{usd(COVER_35, 0)}</strong>. If the
        incremental work you are hiring to capture is smaller than that — or less certain — the
        variable-cost contractor remains the right answer regardless of the price parity in the
        first section. The fixed stack only wins above real, contractible
        utilization.
      </p>

      {/* ================================================================== */}
      <h2 id="estimates">What the hire does to your quarterly installments</h2>
      {/* ================================================================== */}
      <p>
        For a sole proprietor, the hire is also a tax event — a deductible one. Wages are a §162
        business expense, and the employer-side taxes and premiums in the stack are deductible
        costs of carrying them, so Schedule C profit falls roughly dollar-for-dollar by the loaded
        cost. Your own{' '}
        <a href="/quarterly-estimated-tax-calculator/">quarterly estimated taxes</a> recompute on
        the smaller base — that calculator runs the engine used below, so the after-hire figure
        is one net-income input away. Model a single owner whose
        business nets {usd(OWNER_NETSE, 0)} before the hire, no W-2 withholding, sizing
        installments against the 90%-of-current-tax harbor:
      </p>
      <ul>
        <li>
          Before: {usd(OWNER_NETSE, 0)} of net self-employment income → total federal tax{' '}
          <strong>{usd(EST_BEFORE.currentTotalTax, 0)}</strong> →{' '}
          <strong>{usd(EST_BEFORE.perQuarter, 0)} per quarter</strong>
        </li>
        <li>
          After: {usd(NETSE_AFTER, 0)} of net income (the{' '}
          {usd(STACK.loadedCost, 0)} stack is now a deduction) → total federal tax{' '}
          <strong>{usd(EST_AFTER.currentTotalTax, 0)}</strong> →{' '}
          <strong>{usd(EST_AFTER.perQuarter, 0)} per quarter</strong>
        </li>
        <li>
          The installments drop <strong>{usd(QTR_DROP, 0)} a quarter</strong>; total tax falls{' '}
          <strong>{usd(TAX_SAVED, 0)}</strong> — a {pct(SHIELD_PCT, 1)} marginal shield on the
          loaded cost
        </li>
      </ul>
      <p>
        That shield is the decision-relevant number: the hire&rsquo;s true cost is not{' '}
        {usd(STACK.loadedCost, 0)} but <strong>{usd(AFTER_TAX_COST, 0)}</strong> after the federal
        tax it saves — and the shield would be larger still in a state with an income tax. Two
        honest caveats attach. The estimated-tax engine models a business with no W-2 wages: above
        the §199A threshold it computes the QBI limitation as if the wage limit were zero, and
        paying actual wages can only <em>raise</em> that deduction — so the after-hire tax shown
        here is an upper bound, conservative in the right direction. And if you size installments
        by the prior-year safe harbor instead, the drop does not appear per quarter; it appears as
        a smaller balance due at filing, while the installments keep matching last year&rsquo;s
        number.
      </p>
      <p>
        One cash-flow inversion deserves its own line: the employee&rsquo;s federal withholding
        plus the matching employer FICA moves on a deposit schedule of its own (Form 941) —
        monthly or semiweekly for most small employers — while a contractor invoice waits to be
        paid from collected revenue. Payroll is the first recurring federal obligation your
        business will have that does not care whether the client has paid you. Build the operating
        buffer before the start date, not after the first deposit notice.
      </p>

      {/* ================================================================== */}
      <h2 id="boundaries">Where the framework ends — and the checklist</h2>
      {/* ================================================================== */}
      <p>
        Four boundaries keep this playbook honest. First, the models are simplified 2025 federal
        illustrations: state unemployment, disability, and local payroll taxes are inputs or
        absent, and the SUTA and workers&rsquo;-comp figures shown are placeholders — replace
        both with your own before any decision. Second, the pay-type ledger is
        the worker&rsquo;s; once <em>you</em> elect S-corp taxation and become your own W-2
        employee, the <a href="/s-corp-tax-calculator/">S-Corp calculator</a> owns that arithmetic,
        including reasonable-salary constraints. Third, benefits are priced at face — pre-tax
        cafeteria effects and plan mechanics are not modeled. Fourth, worker classification is a
        legal conclusion, not an arithmetic one; when the relationship looks like employment,
        price it as employment before the IRS does.
      </p>
      <p>The decision sequence, compressed:</p>
      <ol>
        <li>
          Convert the contractor&rsquo;s rate into its equivalent salary with the pay-type engine
          — {usd(PAYTYPE_DEFAULTS.contractRate, 0)}/hr ≈ a {usd(EQ_SALARY, 0)} salary here — and
          anchor the offer there, not on salary/2,080 folklore.
        </li>
        <li>
          Load the offer with the full employer stack before you quote or accept a budget:{' '}
          {usd(STACK.loadedCost, 0)} on a {usd(STACK.salary, 0)} salary at this stack, a{' '}
          {pct(STACK.burdenRatePct, 1)} burden.
        </li>
        <li>
          Compare per hour on one consistent basis — at the equivalent salary,{' '}
          {usd(EMP_DELIVERED_HOURLY)} per delivered hour as the hire against{' '}
          {usd(CONTRACTOR_HOURLY)} as the contract: near parity. Let structure, not price, make
          the decision.
        </li>
        <li>
          Divide the loaded cost by your gross margin: at {pct(50, 0)} margin this hire must carry{' '}
          {usd(COVER_50, 0)} of revenue. If contractible demand is below that, keep the variable
          cost.
        </li>
        <li>
          Recompute your own quarterly estimates on the smaller net — the after-tax cost of this
          hire is {usd(AFTER_TAX_COST, 0)}, not the gross stack — and check whether your safe
          harbor defers the relief to April.
        </li>
        <li>
          Enter your real state numbers (FUTA credit position, SUTA rate and base,
          workers&rsquo;-comp class rate) and work the stack again before the offer letter; the
          defaults here are illustrations.
        </li>
        <li>
          Fund the payroll buffer for Form 941 deposits and the first benefits premiums; the stack
          runs on a calendar the client&rsquo;s payment terms do not respect.
        </li>
      </ol>
      <p>
        The instruments below run the pay-type and estimated-tax steps on your numbers — the
        conversions in the first section and the installment drop in the fourth. The employer
        stack between them has no dedicated instrument yet: every layer, rate, and wage base is
        stated above, and the numbers it needs from you are published by your state and your
        broker. The framework is the order; the arithmetic is reproducible.
      </p>
    </>
  );
}

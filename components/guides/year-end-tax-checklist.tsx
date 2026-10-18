import Link from 'next/link';
import { AlertTriangle, CalendarDays, CheckCircle2, Flag, ListChecks } from 'lucide-react';
import { ArticleToc } from '@/components/Article';
import {
  computeEstimatedTax,
  EST_CONSTANTS,
  QUARTERS_2025,
} from '@/lib/estimated';
import { solo401kCapacity, sepCapacity, RETIREMENT_CONSTANTS } from '@/lib/retirement';
import {
  compareHomeOffice,
  marginalSaving,
  HOME_OFFICE_CONSTANTS,
} from '@/lib/homeoffice';
import { standardMethod, marginalSaving as mileageMarginalSaving, MILEAGE_CONSTANTS_2025 } from '@/lib/mileage';
import {
  computeQbiDeduction,
  wagesNeededToUnlock,
  taxValueOfDeduction,
  QBI_CONSTANTS,
} from '@/lib/qbi';
import { usd } from '@/lib/format';

/**
 * "Year-End Tax Checklist" — guide body for /guides/year-end-tax-checklist/.
 *
 * Renders inside GuideShell's .prose-article column (the shell supplies the h1
 * and the closing instrument panel), so this component starts at h2 and uses
 * bare semantic markup plus the site's callout-card vocabulary.
 *
 * Every dollar figure is computed at module scope by the same engines that
 * power the instruments (lib/estimated.ts, lib/retirement.ts,
 * lib/homeoffice.ts, lib/mileage.ts, lib/qbi.ts) — nothing is hand-typed.
 *
 * Two worked personas, both tax year 2025:
 *   A (items 1–5): $150,000 forecast net Schedule C profit, single filer, no
 *      W-2 withholding, prior-year total tax $30,000 (AGI ≤ $150k), 22%
 *      marginal bracket, renter with a 260 sq ft office in an 1,800 sq ft
 *      home, 8,200 business miles.
 *   B (item 6): single, non-SSTB product business, $150,000 QBI, $220,000
 *      taxable income — the profile where the §199A wage/UBIA limit binds.
 * The same inputs were verified offline against these engines (tsc-compiled,
 * node-run): 34 assertions, all passing.
 */

/* ===== Persona A — the forecast, the prior-year harbor, the landed numbers ===== */
const FORECAST = computeEstimatedTax({
  netSE: 150000,
  filingStatus: 'single',
  w2Withholding: 0,
  priorTax: 30000,
  priorAgiOver150k: false,
});
const LANDED_LOW = computeEstimatedTax({
  netSE: 130000,
  filingStatus: 'single',
  w2Withholding: 0,
  priorTax: 30000,
  priorAgiOver150k: false,
});
const LANDED_HIGH = computeEstimatedTax({
  netSE: 165000,
  filingStatus: 'single',
  w2Withholding: 0,
  priorTax: 30000,
  priorAgiOver150k: false,
});

/* Q4 arithmetic: three installments of the forecast's $7,500 already paid. */
const PAID_THROUGH_Q3 = FORECAST.perQuarter * 3;
const Q4_TRUEDOWN = LANDED_LOW.current90 - PAID_THROUGH_Q3;

/* The persona's marginal income-tax bracket: taxable income $98,922 sits in
 * the 22% single bracket ($48,475–$103,350, Rev. Proc. 2024-40) — an input to
 * the marginal-saving engines below, not an engine output itself. */
const MARGINAL_RATE = 22;

/* Pre-QBI taxable income — the §199A threshold test for persona A. */
const PRE_QBI_TAXABLE_A = FORECAST.agi - EST_CONSTANTS.stdDeductionSingle;

/* ===== Item 2 — retirement capacity at persona A (2025 limits, sole-prop) ===== */
const SOLO = solo401kCapacity({ mode: 'sole-prop', income: 150000, age: 42, plannedDeferral: 23500 });
const SEP = sepCapacity('sole-prop', 150000);

/* ===== Item 3 — equipment: the generic Schedule-C marginal saving per $1,000 =====
 * The same function the home-office engine runs: SE layer 0.9235 × 15.3% plus
 * income tax at the bracket, net of the half-SE clawback. */
const EQUIP = marginalSaving(1000, MARGINAL_RATE, true);

/* ===== Item 4 — home office re-measure (persona A's home) ===== */
const HOME = {
  homeSqFt: 1800,
  officeSqFt: 260,
  tenure: 'rent' as const,
  rent: 26400,
  mortgageInterest: 0,
  propertyTax: 0,
  homeBasis: 0,
  utilities: 3000,
  insurance: 350,
  repairs: 600,
};
const OFFICE = compareHomeOffice(HOME, MARGINAL_RATE, true);

/* ===== Item 5 — mileage log rebuild ===== */
const MILES = 8200;
const MILEAGE_STD = standardMethod(MILES);
const MILEAGE_SAVING = mileageMarginalSaving(MILEAGE_STD.deduction, MARGINAL_RATE, true);
const CENTS_PER_MILE_SAVED = Math.round((MILEAGE_SAVING.total / MILES) * 1000) / 10;

/* ===== Item 6 — persona B: the §199A wage/UBIA adjustment space ===== */
const QBI_B = { qbi: 150000, taxableIncome: 220000, ubia: 0, sstb: false, filingStatus: 'single' as const };

/* ===== §199A interaction — the engines' own documented approximation =====
 * (lib/homeoffice.ts and lib/mileage.ts headers): below the phase-out, each $1
 * of Schedule C deduction — or §404 retirement contribution — reduces QBI by
 * $1 and the §199A deduction by up to 20¢, so the income-tax layer of a
 * marginal saving lands at ~80% of the bracket rate. SE-tax layers are
 * untouched. Verified: min(20%×(a−D), 20%×(b−D)) = min(20%×a, 20%×b) − 0.2D. */
const QBI_INCOME_FACTOR = 1 - EST_CONSTANTS.qbiRate;
const netOfQbi = (s: { seTax: number; incomeTax: number }) =>
  s.seTax + s.incomeTax * QBI_INCOME_FACTOR;

/* Retirement deferral: exact first-year value (the contribution lowers AGI and
 * the §199A base by the same dollar, so both sides of the engine's min() fall). */
const DEFERRAL_GROSS = RETIREMENT_CONSTANTS.employeeDeferralLimit * (MARGINAL_RATE / 100);
const DEFERRAL_NET = DEFERRAL_GROSS * QBI_INCOME_FACTOR;
const DEFERRAL_QBI_GIVEBACK = RETIREMENT_CONSTANTS.employeeDeferralLimit * EST_CONSTANTS.qbiRate;

/* Marginal-saving figures net of the same interaction. */
const MILEAGE_NET = netOfQbi(MILEAGE_SAVING);
const OFFICE_NET_DELTA =
  OFFICE.actual.saving.seTax -
  OFFICE.simplified.saving.seTax +
  (OFFICE.actual.saving.incomeTax - OFFICE.simplified.saving.incomeTax) * QBI_INCOME_FACTOR;
const EQUIP_NET = netOfQbi(EQUIP);
const HEADLINE_NET = MILEAGE_NET + OFFICE_NET_DELTA + DEFERRAL_NET;

/* After the high year, prior-year AGI clears $150k → next year's harbor is the
 * 110% line (§6654(d)(1); the engine's high-income threshold constant). */
const NEXT_YEAR_110 = LANDED_HIGH.currentTotalTax * EST_CONSTANTS.safeHarborPriorHighRate;
const LOCKED = computeQbiDeduction({ ...QBI_B, w2Wages: 0 });
const UNLOCK_WAGES = wagesNeededToUnlock({ ...QBI_B, w2Wages: 0 });
/* The engine returns null when there is nothing to unlock (no QBI, below the
 * threshold, or the limit already covering the tentative deduction). At
 * persona B the wage limit binds mid-band — verified against the engine — so
 * the value is defined; the ?? 0 only satisfies the null-able return type. */
const UNLOCK = UNLOCK_WAGES ?? 0;
const UNLOCKED = computeQbiDeduction({ ...QBI_B, w2Wages: 60000 });
const UNLOCK_DELTA = UNLOCKED.deduction - LOCKED.deduction;
const UNLOCK_TAX_VALUE = taxValueOfDeduction(220000, UNLOCK_DELTA, 'single');
/* The funded version: wages come out of the same profit, so QBI falls too. */
const FUNDED = computeQbiDeduction({ ...QBI_B, qbi: 90000, w2Wages: 60000 });
const FUNDED_DELTA = FUNDED.deduction - LOCKED.deduction;
const FUNDED_TAX_VALUE = taxValueOfDeduction(220000, FUNDED_DELTA, 'single');
const EMPLOYER_FICA_ON_UNLOCK = 60000 * 0.0765;
/* The UBIA leg: the same $40,000 equipment purchase from item 3. */
const WITH_UBIA = computeQbiDeduction({ ...QBI_B, w2Wages: 0, ubia: 40000 });
const UBIA_DELTA = WITH_UBIA.deduction - LOCKED.deduction;

/* Q4 due date from the engine's 2025 schedule. */
const Q4 = QUARTERS_2025[3];

export default function YearEndTaxChecklist() {
  const toc = [
    { id: 'framework', label: 'The decision, stated first' },
    { id: 'dates', label: 'The dates that bind' },
    { id: 'q4-calibration', label: '1. Calibrate the Q4 installment' },
    { id: 'retirement', label: '2. Work the retirement window' },
    { id: 'equipment', label: '3. Equipment and §179' },
    { id: 'home-office', label: '4. Re-measure the home office' },
    { id: 'mileage', label: '5. Rebuild the mileage log' },
    { id: 'qbi', label: '6. QBI: wages and UBIA room' },
    { id: 'verification', label: 'The January verification pass' },
    { id: 'scope', label: 'Scope & caveats' },
  ];

  return (
    <>
      <ArticleToc items={toc} />

      {/* ============================ Framework ============================ */}
      <h2 id="framework">The decision, stated first</h2>
      <p>
        The last six weeks of the tax year are not a pile of chores — they are one ranked list.
        Rank the moves by <strong>tax saved per hour of effort</strong>, and let the calendar break
        ties: anything that dies on December 31 outranks anything that survives into spring, however
        large the spring number is. Executed in that order, the close of the year is six decisions:
      </p>
      <ol>
        <li>
          <strong>Calibrate the Q4 installment</strong> ({Q4.due}) against the year you actually
          had, not the year you forecast — the safe harbor may have switched lines on you.
        </li>
        <li>
          <strong>Work the retirement window.</strong> The solo 401(k) deferral bucket (
          {usd(RETIREMENT_CONSTANTS.employeeDeferralLimit, 0)} in 2025) exists only if elected by
          December 31; the employer side and the whole SEP wait until the filing deadline.
        </li>
        <li>
          <strong>Decide the equipment purchase</strong> on placed-in-service, not on purchase
          date — §179 and bonus depreciation both require the gear to be working for you by
          December 31.
        </li>
        <li>
          <strong>Re-measure the home office</strong> and re-elect the method: the simplified vs
          actual choice is made per year, and a tape measure in December picks the winner.
        </li>
        <li>
          <strong>Rebuild the mileage log</strong> while the year is still reconstructible — the
          log is not evidence for the deduction, it <em>is</em> the deduction.
        </li>
        <li>
          <strong>Check the QBI wage/UBIA room</strong> — above the §199A threshold, wages paid
          and property placed in service by December 31 are the only levers left.
        </li>
      </ol>
      <p>
        One pass through the list at the worked example below defers or saves roughly{' '}
        {usd(HEADLINE_NET, 0)} of first-year federal tax — quoted net of the §199A interaction
        that trims every Schedule C deduction&apos;s income-tax layer to roughly 80% of the
        bracket rate (each deducted dollar also shrinks the §199A deduction by up to 20¢; the
        retirement section prices the mechanism exactly). And the single most expensive failure
        mode is not a missed deduction but a missed <em>deadline</em>: the moves that expire are
        worth less than the moves that do not, but they cannot be recovered in April, and the
        April ones can.
      </p>
      <div className="my-8 rounded-2xl border border-indigo-100 bg-indigo-50 p-6 dark:border-indigo-500/20 dark:bg-indigo-500/10">
        <div className="flex items-start gap-2.5 text-sm leading-relaxed text-slate-700 dark:text-slate-200">
          <Flag
            className="mt-0.5 h-4 w-4 shrink-0 text-indigo-600 dark:text-indigo-300"
            aria-hidden="true"
          />
          <span>
            The running example is one person throughout: {usd(150000, 0)} of forecast net Schedule
            C profit, single filer, no W-2 withholding, prior-year total tax {usd(30000, 0)},
            renting an {HOME.homeSqFt} sq ft home with a {HOME.officeSqFt} sq ft office,{' '}
            {MILES.toLocaleString('en-US')} business miles, tax year 2025. Every dollar figure
            below is computed by the engines behind the{' '}
            <Link
              href="/quarterly-estimated-tax-calculator/"
            >
              quarterly estimated tax calculator
            </Link>
            , the{' '}
            <Link
              href="/home-office-deduction-calculator/"
            >
              home office deduction calculator
            </Link>
            , the{' '}
            <Link
              href="/mileage-deduction-calculator/"
            >
              mileage deduction calculator
            </Link>{' '}
            and the{' '}
            <Link
              href="/qbi-deduction-calculator/"
            >
              QBI deduction calculator
            </Link>{' '}
            — re-run each one on your own numbers before you act.
          </span>
        </div>
      </div>

      {/* ============================ Dates ============================ */}
      <h2 id="dates">The dates that bind</h2>
      <p>
        Five dates run the close, in descending order of bite. The first three below are the
        closing sequence itself — they decide what the year was. The last two are the ordinary
        filing calendar, generous in one specific way: prior-year employer retirement and SEP
        dollars survive all the way into them:
      </p>
      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>What it closes</th>
            <th>What survives it</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              <strong>Dec 31</strong>
            </td>
            <td>
              Solo 401(k) plan existence + deferral election; equipment <em>placed in service</em>
              (§179(a)); home-office and mileage facts for the year; W-2 wages counted for the
              §199A wage limit; the cash-method year itself
            </td>
            <td>Nothing — no cure, no extension</td>
          </tr>
          <tr>
            <td>
              <strong>{Q4.due}</strong>
            </td>
            <td>The fourth estimated installment ({Q4.label} of the tax year)</td>
            <td>
              Accrued §6654 interest keeps running until paid; and the Jan 31 cure below can erase
              this one entirely
            </td>
          </tr>
          <tr>
            <td>
              <strong>Jan 31</strong>
            </td>
            <td>
              File the return and pay the full balance by this date and the January 15 installment
              is not required (Form 1040-ES instructions)
            </td>
            <td>Only for filers ready to close early</td>
          </tr>
          <tr>
            <td>
              <strong>Apr 15</strong>
            </td>
            <td>The return and the remaining balance; next year&apos;s Q1 installment, same day</td>
            <td>
              SEP-IRA and solo 401(k) employer contributions still count for the prior year
            </td>
          </tr>
          <tr>
            <td>
              <strong>Oct 15</strong>
            </td>
            <td>Extended filing deadline — the last date to fund prior-year employer/SEP dollars</td>
            <td>Filing only; the tax itself was due April 15</td>
          </tr>
        </tbody>
      </table>
      <p>
        The pattern to internalize: <strong>December 31 is irrevocable, January 15 is
        mechanical, and everything after that is paperwork.</strong> The{' '}
        <a href="/guides/self-employed-tax-calendar/">tax calendar guide</a> walks the full year;
        this guide works the six weeks where the decisions are still open.
      </p>

      {/* ============================ Item 1: Q4 ============================ */}
      <h2 id="q4-calibration">1. Calibrate the Q4 installment</h2>
      <p>
        By mid-December the year&apos;s profit is mostly knowable, and the January 15 installment
        is the last payment you control. The calibration question is one lookup: <strong>which
        safe harbor binds now?</strong> The required annual payment is the lesser of 90% of this
        year&apos;s tax or the prior-year floor ({usd(30000, 0)} here, since prior-year AGI was
        under {usd(EST_CONSTANTS.highIncomeAgiThreshold, 0)} — §6654(d)(1)) — and the answer can{' '}
        <em>change</em> between April and December. The engine prices the three ways the year can
        land, after three installments of {usd(FORECAST.perQuarter, 0)} were already paid:
      </p>
      <table>
        <thead>
          <tr>
            <th>Where the year landed</th>
            <th>Current-year tax</th>
            <th>90% line</th>
            <th>Binding harbor</th>
            <th>Right Q4 payment</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>On the {usd(150000, 0)} forecast</td>
            <td>{usd(FORECAST.currentTotalTax)}</td>
            <td>{usd(FORECAST.current90)}</td>
            <td>Prior-year ({usd(30000, 0)})</td>
            <td>{usd(FORECAST.perQuarter, 0)}</td>
          </tr>
          <tr>
            <td>Low — {usd(130000, 0)}</td>
            <td>{usd(LANDED_LOW.currentTotalTax)}</td>
            <td>{usd(LANDED_LOW.current90)}</td>
            <td>
              <strong>flips to the 90% line</strong>
            </td>
            <td>{usd(Q4_TRUEDOWN)}</td>
          </tr>
          <tr>
            <td>High — {usd(165000, 0)}</td>
            <td>{usd(LANDED_HIGH.currentTotalTax)}</td>
            <td>{usd(LANDED_HIGH.current90)}</td>
            <td>Prior-year ({usd(30000, 0)}) still</td>
            <td>{usd(LANDED_HIGH.perQuarter, 0)}</td>
          </tr>
        </tbody>
      </table>
      <p>
        Read the middle row — it is the one people miss. Income fell, so the 90% line fell to{' '}
        {usd(LANDED_LOW.current90)} — <em>below</em> the {usd(30000, 0)} prior-year floor — and the
        required annual payment switched to the lower number. The three installments already sent
        total {usd(PAID_THROUGH_Q3, 0)}, so the correct January payment is not{' '}
        {usd(FORECAST.perQuarter, 0)} but{' '}
        {usd(LANDED_LOW.current90)} − {usd(PAID_THROUGH_Q3, 0)} = <strong>{usd(Q4_TRUEDOWN)}</strong>.
        Overpaying the last installment here is an interest-free loan to the IRS that comes back as
        a refund months later; underpaying it, in the high row, is impossible while the prior-year
        harbor binds — the extra {usd(LANDED_HIGH.expectedAtFiling)} rides to April penalty-free
        ({usd(LANDED_HIGH.currentTotalTax)} of true tax against {usd(30000, 0)} prepaid). The
        catch is that the deferral is a one-year device with a stinger: the landed year&apos;s AGI
        of {usd(LANDED_HIGH.agi, 0)} clears the{' '}
        {usd(EST_CONSTANTS.highIncomeAgiThreshold, 0)} line, so next year&apos;s prior-year
        harbor is <strong>110%</strong> of this year&apos;s{' '}
        {usd(LANDED_HIGH.currentTotalTax)} bill — {usd(NEXT_YEAR_110, 0)}, not the{' '}
        {usd(LANDED_HIGH.currentTotalTax, 0)} just deferred (§6654(d)(1); the 110% test keys off
        prior-year AGI, exactly as the verification card below reminds you).
      </p>
      <div className="my-8 rounded-2xl border border-slate-200 bg-white p-6 dark:border-white/[0.08] dark:bg-slate-900/60">
        <p className="flex items-start gap-2.5 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
          <AlertTriangle
            className="mt-0.5 h-4 w-4 shrink-0 text-amber-500 dark:text-amber-400"
            aria-hidden="true"
          />
          <span>
            A larger January payment cannot cure a year of underpayment — §6654 prices each
            installment from its own due date, so paying more on {Q4.due} stops the meter from
            January 15 but does not refund the interest accrued on Q1–Q3. And if the paperwork is
            ready early, the <strong>January 31 cure</strong> beats the installment entirely: file
            and pay in full by January 31 and the {Q4.due} payment is not required at all.
          </span>
        </p>
      </div>

      {/* ============================ Item 2: Retirement ============================ */}
      <h2 id="retirement">2. Work the retirement window</h2>
      <p>
        Retirement is the only item on the list whose deadline splits in two, and the split is the
        whole decision. The <strong>employee deferral</strong> —{' '}
        {usd(RETIREMENT_CONSTANTS.employeeDeferralLimit, 0)} for 2025 under §402(g) (
        {usd(RETIREMENT_CONSTANTS.catchUpLimit, 0)} more from age 50,{' '}
        {usd(RETIREMENT_CONSTANTS.enhancedCatchUpLimit, 0)} at ages 60–63 under SECURE 2.0 §109) —
        must be <em>elected before the plan year closes</em>, and under IRS Pub 560 guidance a sole
        proprietor generally cannot retroactively create the plan or the election. The{' '}
        <strong>employer side and the SEP</strong> are the opposite: both compute from the same
        base and both can be funded as late as the extended filing deadline. At the example:
      </p>
      <table>
        <thead>
          <tr>
            <th>Vehicle</th>
            <th>Deferral (dies Dec 31)</th>
            <th>Employer / SEP (to Apr 15, or Oct 15)</th>
            <th>Total 2025 capacity</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Solo 401(k), elected by Dec 31</td>
            <td>{usd(SOLO.deferralTotal, 0)}</td>
            <td>{usd(SOLO.employerContribution, 0)}</td>
            <td>
              <strong>{usd(SOLO.total, 0)}</strong>
            </td>
          </tr>
          <tr>
            <td>SEP-IRA, opened any time to the deadline</td>
            <td>no such bucket</td>
            <td>{usd(SEP.contribution, 0)}</td>
            <td>{usd(SEP.contribution, 0)}</td>
          </tr>
        </tbody>
      </table>
      <p>
        The two employer-side numbers match to the dollar — both are 20% of net profit after the
        half-SE adjustment — so the solo 401(k)&apos;s entire advantage <em>is</em> the deferral
        bucket, and that bucket is a December 31 asset. What a deferral is worth: each dollar
        postpones {MARGINAL_RATE}¢ of bracket-rate income tax (taxable income{' '}
        {usd(FORECAST.taxableIncome, 0)} sits in the 22% band), but two interactions trim that
        before it is banked. Contributions cut income tax only — the {usd(FORECAST.seTax, 0)}
        SE-tax bill is computed before any plan deduction. And the §199A interaction bites in
        full, not partially: a contribution lowers AGI and the §199A base by the same dollar, and
        the deduction is the lesser of 20% of each — so whichever side of that minimum binds,{' '}
        <em>both</em> sides fall together and the §199A deduction gives back exactly 20¢ per
        contributed dollar (min(a − x, b − x) = min(a, b) − x). On the full{' '}
        {usd(RETIREMENT_CONSTANTS.employeeDeferralLimit, 0)} that is{' '}
        {usd(DEFERRAL_QBI_GIVEBACK, 0)} of §199A deduction surrendered —{' '}
        {usd((DEFERRAL_QBI_GIVEBACK * MARGINAL_RATE) / 100)} of tax at {MARGINAL_RATE}% — putting
        the first-year value at <strong>{usd(DEFERRAL_NET, 0)}</strong>, about{' '}
        {Math.round((DEFERRAL_NET / RETIREMENT_CONSTANTS.employeeDeferralLimit) * 1000) / 10}¢
        per deferred dollar rather than the {usd(DEFERRAL_GROSS, 0)} the bracket rate alone
        suggests. The{' '}
        <a href="/guides/retirement-for-the-self-employed/">retirement guide</a> works the full
        vehicle stack; the{' '}
        <Link
          href="/solo-401k-calculator/"
          >
          solo 401(k) calculator
        </Link>{' '}
        prices your own capacity.
      </p>

      {/* ============================ Item 3: Equipment ============================ */}
      <h2 id="equipment">3. Equipment and §179: the placed-in-service decision</h2>
      <p>
        The year-end equipment decision is not &quot;§179 or not&quot; — it is{' '}
        <strong>&quot;in service by December 31, or next year.&quot;</strong> §179 property must
        be acquired by purchase for use in the active conduct of a trade or business (§179(d)(1)),
        and the cost is deductible <em>in the taxable year the property is placed in
        service</em> (§179(a)): ordered, paid for, and sitting in a crate on December 30 is not
        enough. Two limits decide whether the election itself works. The ceiling — for 2025,{' '}
        {usd(2500000, 0)} with the phase-down beginning at {usd(4000000, 0)} of qualifying
        additions (P.L. 119-21 §70415, per the 2025 Form 4562 instructions) — sits orders of
        magnitude above a solo equipment year. The business-income limit (§179(b)(3)) is the one
        that can actually bind: the deduction cannot exceed the year&apos;s aggregate taxable
        income from active business, with the excess carrying forward.
      </p>
      <p>
        What a dollar of expensing is actually worth, from the same marginal-saving engine the
        home-office instrument runs — the SE layer (0.9235 × 15.3%) plus income tax at the
        persona&apos;s {MARGINAL_RATE}% bracket, net of the half-SE clawback, valid while earnings
        stay under the {usd(EST_CONSTANTS.ssWageBase, 0)} wage base:
      </p>
      <ul>
        <li>
          Each {usd(1000, 0)} of §179-expensed equipment:{' '}
          <strong>{usd(EQUIP.total)}</strong> of combined bracket-rate tax ({usd(EQUIP.seTax)} SE
          + {usd(EQUIP.incomeTax)} income), or {usd(EQUIP_NET)} net of the §199A interaction
          described in item 2.
        </li>
        <li>
          That is roughly 30–35¢ recovered per dollar spent — which is the anti-decision rule:
          never buy equipment for the deduction. The deduction returns a fraction of the dollar,
          not the dollar.
        </li>
        <li>
          Bonus depreciation lowers the §179 stakes: current law (P.L. 119-21) restored and made
          permanent 100% bonus depreciation for property acquired after January 19, 2025 — so
          equipment that misses the §179 income limit can still fully expense. What no relief
          valve fixes is the calendar: placed in service after December 31 belongs to next year,
          full stop.
        </li>
        <li>
          One forward link: the same purchase also lifts the §199A UBIA limit at zero extra cost —
          item 6 prices that bonus.
        </li>
      </ul>

      {/* ============================ Item 4: Home office ============================ */}
      <h2 id="home-office">4. Re-measure the home office</h2>
      <p>
        The home-office deduction is the one whose facts decay: you know the rent, but the office
        measurement was done when you moved in and the furniture has moved since. The method
        election is made per year — exactly one of simplified or actual, freely switchable year to
        year — so December is when a tape measure picks the method. At the example&apos;s home (
        {HOME.officeSqFt} sq ft office in an {HOME.homeSqFt} sq ft rental, {usd(HOME.rent, 0)} of
        rent plus {usd(HOME.utilities + HOME.insurance + HOME.repairs, 0)} of utilities, insurance
        and repairs):
      </p>
      <table>
        <thead>
          <tr>
            <th>Method</th>
            <th>Deduction</th>
            <th>Tax saved (22% bracket + SE)</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Simplified — $5 × {HOME.officeSqFt} sq ft</td>
            <td>{usd(OFFICE.simplified.deduction, 0)}</td>
            <td>{usd(OFFICE.simplified.saving.total)}</td>
          </tr>
          <tr>
            <td>
              Actual — {Math.round(OFFICE.actual.breakdown.share * 10000) / 100}% of{' '}
              {usd(HOME.rent + HOME.utilities + HOME.insurance + HOME.repairs, 0)}
            </td>
            <td>{usd(OFFICE.actual.deduction)}</td>
            <td>{usd(OFFICE.actual.saving.total)}</td>
          </tr>
          <tr>
            <td>
              <strong>Swing</strong>
            </td>
            <td>
              <strong>{usd(OFFICE.deductionDelta)}</strong>
            </td>
            <td>
              <strong>{usd(OFFICE.savingDelta)}</strong>
            </td>
          </tr>
        </tbody>
      </table>
      <p>
        {usd(OFFICE.savingDelta)} of bracket-rate tax — {usd(OFFICE_NET_DELTA)} net of the
        §199A interaction — is the value of an hour&apos;s measuring and a Form 8829: the
        ranking logic of this entire guide in one line. The general rule the engine states: the
        actual method wins whenever the home costs more than{' '}
        {usd(HOME_OFFICE_CONSTANTS.simplifiedRatePerSqFt, 0)} per square foot to run (that rate ×
        the home&apos;s area is the breakeven —{' '}
        {usd(OFFICE.actual.breakdown.breakevenAnnualHomeCost, 0)} here against an actual{' '}
        {usd(HOME.rent + HOME.utilities + HOME.insurance + HOME.repairs, 0)}), which is nearly
        always true of a rented apartment. Three boundaries keep the re-measure honest: the space
        must be used exclusively and regularly for business (§280A(c)(1)) — a desk in the living
        room fails; the simplified option forfeits any amount lost to the gross-income limit while
        the actual method carries it forward; and owners claiming actual depreciation are electing{' '}
        {Math.round(HOME_OFFICE_CONSTANTS.depreciationAnnualRate * 10000) / 100}%-a-year recapture
        exposure on sale (unrecaptured §1250 gain, up to 25%). The{' '}
        <a href="/guides/deductions-home-office-and-vehicle/">deductions playbook</a> runs the
        full comparison; the{' '}
        <Link
          href="/home-office-deduction-calculator/"
          >
          home office deduction calculator
        </Link>{' '}
        prices your home.
      </p>

      {/* ============================ Item 5: Mileage ============================ */}
      <h2 id="mileage">5. Rebuild the mileage log</h2>
      <p>
        Vehicle expenses live under §274(d) strict substantiation: no estimates, no
        reasonable-approximation relief — without adequate records the deduction is nominally
        zero, however real the driving was. Each entry needs the distance, the date, and the
        business purpose. December is the last month the year is reconstructible: the calendar
        still shows the client meetings, the invoices still carry the addresses, the memory of
        which trips were personal is still fresh. The engine prices the persona&apos;s{' '}
        {MILES.toLocaleString('en-US')} business miles at the 2025 standard rate of{' '}
        {usd(MILEAGE_CONSTANTS_2025.standardRatePerMile, 2)}/mile (IRS Notice 2025-5):
      </p>
      <ul>
        <li>
          Deduction: {MILES.toLocaleString('en-US')} mi ×{' '}
          {usd(MILEAGE_CONSTANTS_2025.standardRatePerMile, 2)} ={' '}
          <strong>{usd(MILEAGE_STD.deduction, 0)}</strong>.
        </li>
        <li>
          Tax saved at the {MARGINAL_RATE}% bracket with the SE layer:{' '}
          <strong>{usd(MILEAGE_SAVING.total)}</strong> ({usd(MILEAGE_SAVING.seTax)} SE +{' '}
          {usd(MILEAGE_SAVING.incomeTax)} income) — about {CENTS_PER_MILE_SAVED}¢ of bracket-rate
          tax per business mile, {Math.round((MILEAGE_NET / MILES) * 1000) / 10}¢ net of the
          §199A interaction.
        </li>
        <li>
          Of the deduction, {usd(MILEAGE_STD.embeddedDepreciation, 0)} is depreciation-equivalent
          (33¢/mile inside the rate) — it reduces the vehicle&apos;s basis and bars §179 or
          regular depreciation on the same car.
        </li>
        <li>
          Method lock to remember for the new year: using the standard rate in the vehicle&apos;s
          first year preserves the right to switch to actual later; starting with actual (with
          §179 or bonus) closes the standard rate for that vehicle for good.
        </li>
      </ul>
      <p>
        The forward-looking note the engine&apos;s rate table makes concrete: the standard rate
        moves — {Math.round(MILEAGE_CONSTANTS_2025.standardRate2026H1PerMile * 1000) / 10}
        ¢/mile in the first half of 2026, raised mid-year to{' '}
        {Math.round(MILEAGE_CONSTANTS_2025.standardRate2026H2PerMile * 1000) / 10}¢ — so the log
        you build for one year is also the baseline habit for every rate that follows. The{' '}
        <Link
          href="/mileage-deduction-calculator/"
          >
          mileage deduction calculator
        </Link>{' '}
        compares the standard rate against your actual costs and finds the neutral mileage where
        the methods tie.
      </p>

      {/* ============================ Item 6: QBI ============================ */}
      <h2 id="qbi">6. QBI: the wage and UBIA room above the threshold</h2>
      <p>
        First, the no-op gate: the §199A W-2 wage / UBIA limitation only applies above{' '}
        {usd(QBI_CONSTANTS.threshold.single, 0)} of taxable income (
        {usd(QBI_CONSTANTS.threshold.mfj, 0)} married filing jointly — Rev. Proc. 2024-40). The
        example persona&apos;s pre-QBI taxable income is {usd(PRE_QBI_TAXABLE_A, 0)}, far below
        it, so there is nothing to adjust — check the gate before spending an hour here. The
        adjustment space belongs to a second persona: single, a non-SSTB product business with{' '}
        {usd(150000, 0)} of QBI and {usd(220000, 0)} of taxable income — inside the{' '}
        {usd(QBI_CONSTANTS.phaseInRange.single, 0)} phase-in band,{' '}
        {Math.round(LOCKED.phaseInPct * 1000) / 10}% of the way through it.
      </p>
      <table>
        <thead>
          <tr>
            <th>Scenario (engine-computed)</th>
            <th>Wage limit L</th>
            <th>§199A deduction</th>
            <th>vs. no wages</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>No W-2 wages — deduction survives at {Math.round(LOCKED.applicablePct * 1000) / 10}% of 20% × QBI</td>
            <td>{usd(LOCKED.wageLimit, 0)}</td>
            <td>{usd(LOCKED.deduction, 0)}</td>
            <td>—</td>
          </tr>
          <tr>
            <td>
              <strong>{usd(UNLOCK, 0)} of wages — the unlock point</strong> (50% of wages
              covers 20% of QBI)
            </td>
            <td>{usd(UNLOCKED.wageLimit, 0)}</td>
            <td>
              <strong>{usd(UNLOCKED.deduction, 0)}</strong>
            </td>
            <td>+{usd(UNLOCK_DELTA, 0)}</td>
          </tr>
          <tr>
            <td>The funded version — wages paid out of the same profit, QBI falls to {usd(90000, 0)}</td>
            <td>{usd(FUNDED.wageLimit, 0)}</td>
            <td>{usd(FUNDED.deduction, 0)}</td>
            <td>+{usd(FUNDED_DELTA, 0)}</td>
          </tr>
        </tbody>
      </table>
      <p>
        The engine&apos;s headline: <strong>{usd(UNLOCK, 0)} of W-2 wages is the unlock
        point</strong> — at that payroll, the 50%-of-wages limit exactly covers 20% of QBI and the
        deduction rises from {usd(LOCKED.deduction, 0)} to the full {usd(UNLOCKED.deduction, 0)},
        worth {usd(UNLOCK_DELTA, 0)} of deduction or <strong>{usd(UNLOCK_TAX_VALUE)}</strong> of
        federal tax at the 32% bracket. The third row is why this is a decision and not a
        windfall: wages come out of the same profit, so QBI falls dollar-for-dollar — re-run with
        QBI at {usd(90000, 0)}, the deduction is {usd(FUNDED.deduction, 0)}, only{' '}
        {usd(FUNDED_DELTA, 0)} better than doing nothing ({usd(FUNDED_TAX_VALUE)} of tax), while
        the employer side of FICA on {usd(UNLOCK, 0)} of payroll costs{' '}
        {usd(EMPLOYER_FICA_ON_UNLOCK, 0)}. <strong>Paying wages purely to unlock QBI loses money
        at this profile.</strong> The unlock arithmetic pays when the wages were coming anyway — a
        planned December hire, or an S corporation owner whose reasonable salary already has to
        exist (the{' '}
        <a href="/guides/paying-yourself-from-your-business/">paying-yourself guide</a> covers
        that constraint) — in which case each wage dollar up to the unlock point carries real
        marginal value.
      </p>
      <p>
        The cheap lever is UBIA, and it connects back to item 3. The alternative wage limit is 25%
        of wages <em>plus 2.5% of UBIA</em> — the unadjusted basis of qualified property
        immediately after acquisition (§199A(b)(6)), counted at original cost <em>even when the
        property was §179-expensed</em>. The same {usd(40000, 0)} equipment purchase from item 3
        lifts the wage-limit line by 2.5% × {usd(40000, 0)} = {usd(WITH_UBIA.wageLimit, 0)}, which
        mid-band turns into {usd(UBIA_DELTA)} more deduction. Pennies per dollar — never a reason
        to buy equipment, always a reason to record it. The deadlines are the same as everywhere
        in this guide: wages must be <em>paid</em> and property <em>placed in service</em> by
        December 31 to count in the year&apos;s limitation — after the close, this lever is gone.
        The{' '}
        <Link
          href="/qbi-deduction-calculator/"
          >
          QBI deduction calculator
        </Link>{' '}
        runs your own numbers through both limitations and reports the unlock wage directly.
      </p>

      {/* ============================ Verification ============================ */}
      <h2 id="verification">The January verification pass</h2>
      <p>
        The last item on the checklist is the one that catches everything the first six missed —
        a reconciliation pass in January, before the IRS runs its own:
      </p>
      <div className="my-8 grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 dark:border-emerald-500/20 dark:bg-emerald-500/10">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
            <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
            Match the paper to the books
          </div>
          <div className="mt-2 text-sm leading-relaxed text-emerald-900 dark:text-emerald-100">
            Reconcile every 1099-NEC and 1099-K against invoiced revenue. The IRS matches these
            forms by TIN; a gap between gross receipts and the 1099s is the most common
            correspondence-audit trigger — and platforms report gross, before your fees.
          </div>
        </div>
        <div className="rounded-2xl border border-sky-200 bg-sky-50 p-5 dark:border-sky-500/20 dark:bg-sky-500/10">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-sky-700 dark:text-sky-300">
            <CalendarDays className="h-4 w-4" aria-hidden="true" />
            Verify the payment record
          </div>
          <div className="mt-2 text-sm leading-relaxed text-sky-900 dark:text-sky-100">
            Confirm all four estimated payments posted (dates and amounts — Direct Pay selects the
            year and reason; a misposted payment lands in the wrong year&apos;s bucket), then
            choose: the {Q4.due} installment, or file-and-pay in full by January 31 and skip it.
          </div>
        </div>
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 dark:border-amber-500/20 dark:bg-amber-500/10">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-300">
            <ListChecks className="h-4 w-4" aria-hidden="true" />
            Assemble the substantiation set
          </div>
          <div className="mt-2 text-sm leading-relaxed text-amber-900 dark:text-amber-100">
            Mileage log, office measurement and photos, placed-in-service invoices for equipment,
            the plan-adoption paperwork for the solo 401(k). The deduction is only as good as the
            file that proves it.
          </div>
        </div>
        <div className="rounded-2xl border border-indigo-200 bg-indigo-50 p-5 dark:border-indigo-500/20 dark:bg-indigo-500/10">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-indigo-700 dark:text-indigo-300">
            <Flag className="h-4 w-4" aria-hidden="true" />
            Feed next year&apos;s harbor
          </div>
          <div className="mt-2 text-sm leading-relaxed text-indigo-900 dark:text-indigo-100">
            This year&apos;s total-tax line becomes next year&apos;s prior-year safe harbor — and
            next year&apos;s 110% test keys off this year&apos;s AGI. The close of one year sets
            the first decision of the next.
          </div>
        </div>
      </div>

      {/* ============================ Scope ============================ */}
      <h2 id="scope">Scope &amp; caveats</h2>
      <p>
        All parameters are tax-year 2025 federal figures — the year these engines model (standard
        deduction {usd(EST_CONSTANTS.stdDeductionSingle, 0)} per P.L. 119-21 §70103; wage base{' '}
        {usd(EST_CONSTANTS.ssWageBase, 0)}; §199A thresholds per Rev. Proc. 2024-40; retirement
        limits per IRS Notice 2024-80; mileage rate per Notice 2025-5). The engines model Schedule
        C income only, single and MFJ statuses, no state tax, no Additional Medicare Tax, and a
        simplified §6654 penalty (flat 7% simple interest — Form 2210 computes the filed number).
        The §179 ceiling and the bonus-depreciation cut-in date in item 3 are per P.L. 119-21
        §70415 and the 2025 Form 4562 instructions — confirm the figures for the year you
        actually file. Dates shown are
        the 2025 calendar and shift with weekends and holidays; the sequence itself recurs every
        year, and the parameters move — the 2026 mileage rate already differs from 2025&apos;s.
        Every dollar figure is the engines&apos; output at the stated personas, not an estimate
        for your facts: this is an illustrative model, not tax advice.
      </p>
    </>
  );
}

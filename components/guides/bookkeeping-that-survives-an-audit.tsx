import { ArticleToc } from '@/components/Article';
import {
  HOME_OFFICE_CONSTANTS,
  actualMethod,
  marginalSaving,
  simplifiedDeduction,
  type HomeOfficeInputs,
} from '@/lib/homeoffice';
import {
  MILEAGE_CONSTANTS_2025,
  compareMileage,
  marginalSaving as vehicleMarginalSaving,
  neutralMileage,
  standardMethod,
  type MileageInputs,
} from '@/lib/mileage';
import { numFmt, pct, usd } from '@/lib/format';

/**
 * Guide body for /guides/bookkeeping-that-survives-an-audit/ — rendered through
 * GuideShell, which supplies the h1, the reading time, the prose column, and
 * the closing instruments panel. This component emits the article itself,
 * starting at h2 (the shell owns h1).
 *
 * Every instrument-math number below is computed at build time by the same
 * engines the calculators run (lib/homeoffice.ts, lib/mileage.ts) — module
 * scope, no hand-typed results — so the published figures cannot drift from
 * the tools. The evidence-law citations (§274(d), §280A(c), Rev. Proc.
 * 2013-13, §6501) are stated as law, conservative where the codebase's model
 * ends; nothing legal is derived from the engines.
 */

/* ---- Home office — the calculator's default renter preset, verbatim ------- */
const HO_AUDIT: HomeOfficeInputs = {
  homeSqFt: 1800,
  officeSqFt: 200,
  tenure: 'rent',
  rent: 21600,
  mortgageInterest: 0,
  propertyTax: 0,
  homeBasis: 0,
  utilities: 2400,
  insurance: 600,
  repairs: 800,
};
const HO_ACTUAL = actualMethod(HO_AUDIT);
const HO_SIMPLIFIED = simplifiedDeduction(HO_AUDIT.officeSqFt); // $1,000 at 200 sq ft
const HO_SIMPLIFIED_AT_CAP = simplifiedDeduction(HOME_OFFICE_CONSTANTS.simplifiedMaxSqFt); // $1,500
/** An office larger than the 300-sq-ft cap: the simplified option stops climbing. */
const OVERSIZED_OFFICE_SQFT = 450;
const HO_SIMPLIFIED_PAST_CAP = simplifiedDeduction(OVERSIZED_OFFICE_SQFT); // still $1,500
const HO_SHARE = HO_AUDIT.officeSqFt / HO_AUDIT.homeSqFt; // 1/9 = 11.1%
const HO_OPERATING = HO_AUDIT.utilities + HO_AUDIT.insurance + HO_AUDIT.repairs; // $3,800
const HO_TIE_ANNUAL_COST = HO_ACTUAL.breakevenAnnualHomeCost; // $5 × 1,800 = $9,000
/** Annual tax the actual-method claim carries on this profile: 24% + SE layer. */
const HO_STAKES = marginalSaving(HO_ACTUAL.deduction, 24, true).total;
/** Annual tax at the simplified $1,500 ceiling on the same terms. */
const HO_CAP_STAKES = marginalSaving(HO_SIMPLIFIED_AT_CAP, 24, true).total;

/* ---- Vehicle — the mileage calculator's default preset, verbatim ---------- */
const MI_AUDIT: MileageInputs = {
  businessMiles: 9000,
  depreciation: 3600,
  fuelEnergy: 2600,
  insurance: 1900,
  maintenance: 1200,
  registration: 300,
  businessSharePct: 65,
};
const MI_CMP = compareMileage(MI_AUDIT, 24, true);
const MI_ACTUAL_FLAT = MI_CMP.actual.deduction; // 65% × $9,600 = $6,240
const MI_STD = MI_CMP.standard.deduction; // 0.70 × 9,000 = $6,300
const MI_STD_BASIS = MI_CMP.standard.breakdown.embeddedDepreciation; // 0.33 × 9,000
const MI_NEUTRAL = neutralMileage(MI_AUDIT); // exact + whole-mile engine flip
const MI_IMPLIED_TOTAL = MI_CMP.impliedTotalMiles ?? 0; // 9,000 ÷ 0.65
/** What 1,000 logged business miles are worth at the 2025 rate. */
const PER_1000_MILES = standardMethod(1000).deduction;
/** An audit-log gap: 4,000 of the 9,000 miles unprovable. */
const LOG_GAP_MILES = 4000;
const LOG_GAP_DEDUCTION = standardMethod(LOG_GAP_MILES).deduction;
const LOG_GAP_TAX = vehicleMarginalSaving(LOG_GAP_DEDUCTION, 24, true).total;
/** The 2025 standard rate, cited as the per-mile anchor throughout. */
const STD_RATE = MILEAGE_CONSTANTS_2025.standardRatePerMile;

export default function BookkeepingThatSurvivesAnAuditGuide() {
  const toc = [
    { id: 'verdict', label: 'What an audit actually tests' },
    { id: 'separation', label: 'Priority one: separate the money' },
    { id: 'five-standards', label: 'Five deductions, five evidence standards' },
    { id: 'retention', label: 'How long to keep it' },
    { id: 'system', label: 'The minimum viable digital setup' },
    { id: 'playbook', label: 'The order it runs in' },
    { id: 'boundaries', label: 'Where this guide stops' },
  ];

  return (
    <>
      <ArticleToc items={toc} />

      {/* ===== Decision card — the whole framework in three rules =====
          All-div content (no p/h3): .prose-article's tag selectors would
          outrank the utilities used here, so the card carries its own type
          scale on divs — the site's established convention for card chrome. */}
      <div className="mb-4 mt-8 rounded-2xl border border-indigo-100 bg-indigo-50/70 p-6 dark:border-indigo-500/20 dark:bg-indigo-500/10">
        <div className="text-lg font-bold text-slate-900 dark:text-slate-100">
          The audit-readiness rule
        </div>
        <div className="mt-3 grid gap-4 sm:grid-cols-3">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-indigo-700 dark:text-indigo-300">
              1. Separate the money
            </div>
            <div className="mt-1.5 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
              One business checking account, one business card, and every business dollar through
              them — before any deduction arithmetic. Commingled accounts are the single fastest
              way to make honest expenses unprovable.
            </div>
          </div>
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-indigo-700 dark:text-indigo-300">
              2. Capture at the time
            </div>
            <div className="mt-1.5 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
              Receipt photographed or logged the same day, mileage recorded at or near the drive.
              For the strict-substantiation categories, a record made later is a weakened record.
            </div>
          </div>
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-indigo-700 dark:text-indigo-300">
              3. Keep it long enough
            </div>
            <div className="mt-1.5 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
              Three years as the floor, seven for bad-debt claims and aggressive positions, as long
              as you own the asset for property — because basis and recapture outlive the return.
            </div>
          </div>
        </div>
        <div className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
          Run those three rules and an audit becomes what it should be: a request for documents you
          already have, not a reconstruction project. The{' '}
          <a href="/home-office-deduction-calculator/">home office calculator</a> and the{' '}
          <a href="/mileage-deduction-calculator/">mileage calculator</a> price what the records
          defend.
        </div>
      </div>

      {/* ================================================================== */}
      <h2 id="verdict">What an audit actually tests</h2>
      {/* ================================================================== */}
      <p>
        An examination almost never opens with arithmetic. The forms check the math mechanically;
        what an examiner tests is <strong>evidence</strong> — four questions asked of every
        line: does the expense exist, was it for the business, in what amount, and when. Federal law
        asks you to be able to answer them in advance: §6001 requires records sufficient to
        establish the items reported on a return, and for the highest-friction categories — travel,
        meals, gifts, and vehicles — §274(d) replaces the general standard with{' '}
        <strong>strict substantiation</strong>: no deduction without proof of each statutory
        element, regardless of how clearly the expense once happened.
      </p>
      <p>
        That is the reframe this guide is built on. Bookkeeping is not the chore of entering
        numbers; it is the <strong>production system for evidence</strong>, run at the moment the
        evidence is cheap to produce — the day of the expense, the week of the drive — instead of
        the moment it is expensive: a notice arriving two years later. The economics are lopsided.
        A photo of a receipt takes seconds. Reconstructing a year of receipts from bank lines,
        memory, and vendor calls takes days, and for the §274(d) categories it is not even allowed
        to work: the courts&apos; <em>Cohan</em> doctrine (1932) lets judges estimate some
        poorly documented expenses, but Congress carved the strict-substantiation categories out of
        it. There, partial records buy partial disallowance, not estimation.
      </p>
      <p>
        The framework, then, in one sentence: <strong>separate the money so the evidence chain is
        never contaminated, capture the record while the fact is fresh, and keep it exactly as long
        as the law can still reach it.</strong> The rest of this guide prices that sentence — the
        evidence standard each high-risk deduction must meet, with the suite&apos;s engines
        computing what the records defend on the calculators&apos; default scenarios.
      </p>

      {/* ================================================================== */}
      <h2 id="separation">Priority one: separate the money</h2>
      {/* ================================================================== */}
      <p>
        Before any log, receipt, or rate table: a business bank account and a business card that
        carry <em>every</em> business dollar. This is the first priority not because a rule commands
        it for sole proprietors (no statute forces an unincorporated freelancer to keep separate
        accounts), but because of what commingling destroys. Three failure modes, in order of
        severity:
      </p>
      <ul>
        <li>
          <strong>It converts honest expenses into suspicious ones.</strong> When business and
          personal charges share a card, an examiner cannot tell which is which — so the burden
          falls on you, transaction by transaction, months or years later. A grocery run on the
          business card and a software subscription on the personal card do the same damage from
          opposite directions: both make the ledger&apos;s business character an assertion instead
          of an observable fact.
        </li>
        <li>
          <strong>It weakens the entity you paid to have.</strong> For LLC and corporation owners,
          commingled accounts are the classic fact pattern behind veil-piercing claims — the
          argument that the entity and its owner are the same pocket, so the owner should be the
          same defendant. The corporate formalities that matter most are the boring ones: separate
          money, documented transfers, no personal spending from business funds. The{' '}
          <a href="/guides/choosing-your-business-entity/">entity guide</a> covers what the
          structure buys; this is what keeps it bought.
        </li>
        <li>
          <strong>It makes owner pay invisible.</strong> Money moved from business to personal
          should be a labeled event — a draw, a distribution, a payroll run — not an ambient
          dribble. When the accounts are separated, every transfer is a row you can explain; the{' '}
          <a href="/guides/paying-yourself-from-your-business/">paying-yourself guide</a> turns
          those rows into a policy.
        </li>
      </ul>
      <p>
        The decision costs about an hour once. Keep it clean afterwards with one rule each way:
        business expenses never go on the personal card, and personal expenses never go on the
        business card — including the &ldquo;I&apos;ll sort it out at reconcile&rdquo; ones. If a
        personal expense must be paid from the business account (a genuine emergency), record it
        immediately as an owner draw, not an expense, so the ledger stays honest. Cash businesses
        face the same rule one level down: a business account plus receipts for cash out.
      </p>

      {/* ================================================================== */}
      <h2 id="five-standards">Five deductions, five evidence standards</h2>
      {/* ================================================================== */}
      <p>
        Not all deductions carry the same burden of proof. The five below are the ones
        self-employed filers claim most and document least, and each has its own decisive
        evidence. The table is the standard; the subsections price what it defends.
      </p>
      <table>
        <thead>
          <tr>
            <th>Deduction</th>
            <th>The evidence that decides it</th>
            <th>The standard it must meet</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Home office — the numbers</td>
            <td>Measurements of office and home, the year&apos;s bills, the ratio computed</td>
            <td>Regular <em>and</em> exclusive use — §280A(c)(1)</td>
          </tr>
          <tr>
            <td>Vehicle mileage</td>
            <td>A contemporaneous log plus odometer readings at year start and end</td>
            <td>§274(d) adequate records, made at or near the time</td>
          </tr>
          <tr>
            <td>Equipment and §179</td>
            <td>Invoice, payment proof, placed-in-service date, business-use share</td>
            <td>Predominantly business use (&gt;50%), or recapture — §179, §280F</td>
          </tr>
          <tr>
            <td>Travel and meals</td>
            <td>Receipt (or log entry) with amount, date, place, purpose, relationship</td>
            <td>§274(d) five elements; lodging always receipted</td>
          </tr>
          <tr>
            <td>The room, over time</td>
            <td>An annual photo and a dated floor plan, stored with each return</td>
            <td>Re-prove the same facts for every year claimed</td>
          </tr>
        </tbody>
      </table>

      <h3>The home office: the numbers and the use</h3>
      <p>
        The home-office deduction fails audits at the qualification, not the arithmetic: the space
        must be used <strong>regularly and exclusively</strong> for business (§280A(c)(1)), and
        exclusivity — the room does nothing else, ever — is the element only your records can
        speak to. Two kinds of numbers anchor the file:
      </p>
      <ul>
        <li>
          <strong>Area, measured and dated.</strong> Office square footage and finished home area,
          recorded once and re-measured when anything changes. On the calculator&apos;s default
          profile — a {numFmt(HO_AUDIT.officeSqFt)} sq ft spare room in a{' '}
          {numFmt(HO_AUDIT.homeSqFt)} sq ft rental — the business share is{' '}
          {pct(HO_SHARE * 100, 1)}, the single fraction the entire actual method hangs on.
        </li>
        <li>
          <strong>The year&apos;s bills, whole.</strong> Under the actual method (Form 8829) you
          deduct the share of what the home cost to run: on this profile{' '}
          {usd(HO_AUDIT.rent, 0)} rent + {usd(HO_OPERATING, 0)} of utilities, insurance, and
          repairs = {usd(HO_ACTUAL.costPerSqFt * HO_AUDIT.homeSqFt, 0)} of annual cost,{' '}
          {usd(HO_ACTUAL.costPerSqFt, 2)} per square foot. The bills prove the total; the floor
          plan proves the ratio.
        </li>
      </ul>
      <p>
        The engine prices what this file defends. Actual method:{' '}
        {pct(HO_SHARE * 100, 1)} × {usd(HO_ACTUAL.costPerSqFt * HO_AUDIT.homeSqFt, 0)} ={' '}
        <strong>{usd(HO_ACTUAL.deduction, 0)}</strong>. Simplified option:{' '}
        {usd(HOME_OFFICE_CONSTANTS.simplifiedRatePerSqFt, 0)} ×{' '}
        {numFmt(HO_AUDIT.officeSqFt)} sq ft = <strong>{usd(HO_SIMPLIFIED, 0)}</strong> (Rev. Proc.
        2013-13). At a 24% bracket with the self-employment layer on, the actual-method claim is
        worth <strong>{usd(HO_STAKES, 0)} of tax a year</strong> — and because the method election
        is locked on a timely-filed original return, a claim that dies for want of records is not
        re-filed as simplified. It is worth zero. That is the number to remember when the
        record-keeping habit feels optional.
      </p>
      <p>
        The simplified option&apos;s cap shapes the proof problem, not the qualification. The
        option pays {usd(HOME_OFFICE_CONSTANTS.simplifiedRatePerSqFt, 0)} per square foot only up
        to {HOME_OFFICE_CONSTANTS.simplifiedMaxSqFt} sq ft —{' '}
        {usd(HOME_OFFICE_CONSTANTS.simplifiedMaxDeduction, 0)} a year at the ceiling, worth{' '}
        {usd(HO_CAP_STAKES, 0)} of tax on the same terms — and the engine confirms the claim stops
        climbing there: a {numFmt(OVERSIZED_OFFICE_SQFT)} sq ft office still deducts{' '}
        {usd(HO_SIMPLIFIED_PAST_CAP, 0)}. But the exclusivity test applies identically to both
        methods, and the area you <em>claim</em> must still be proven exclusively business. The
        simplified option is an arithmetic shortcut, not an audit shield — a distinction the{' '}
        <a href="/guides/deductions-home-office-and-vehicle/">deductions playbook</a> prices in
        full, including the {usd(HO_TIE_ANNUAL_COST, 0)} annual-cost tie line it computes for this
        home.
      </p>

      <h3>The mileage log: contemporaneous or weakened</h3>
      <p>
        Vehicle expense runs through §274(d) strict substantiation, and the applicable regulations
        ask for <strong>adequate records made at or near the time of the use</strong> (Temp. Reg.
        §1.274-5T(c)) — a log, app, or notebook entry recording <strong>date, destination,
        business purpose, and miles</strong> for each trip, plus the odometer at the start and end
        of the year. A log reconstructed after a notice — the classic January spreadsheet built
        from memory and round numbers — is exactly the artifact the standard exists to discount.
        Courts routinely disallow reconstructed logs in whole or in part.
      </p>
      <p>
        The engine prices both the unit and the gap. Each qualifying business mile is worth{' '}
        <strong>{usd(STD_RATE, 2)}</strong> in 2025 (IRS Notice 2025-5):{' '}
        {numFmt(1000)} logged miles = {usd(PER_1000_MILES, 0)} of deduction. Now the failure
        case: the default profile drives {numFmt(MI_AUDIT.businessMiles)} qualifying miles, but an
        examiner accepts only {numFmt(MI_AUDIT.businessMiles - LOG_GAP_MILES)} of them as logged.
        The unprovable {numFmt(LOG_GAP_MILES)} miles cost{' '}
        <strong>{usd(LOG_GAP_DEDUCTION, 0)} of deduction</strong> —{' '}
        {usd(LOG_GAP_TAX, 0)} of actual tax at 24% with the SE layer on — before interest and
        penalties. A log app that costs a few dollars a month defends the {usd(MI_STD, 0)}{' '}
        deduction the engine just priced.
      </p>
      <p>
        Two facts make the log non-optional whichever method you file. First,{' '}
        <strong>the actual method needs it too</strong>: the business-use share it multiplies by is
        measured in miles — on the default profile, {pct(MI_AUDIT.businessSharePct, 0)} business
        use implies {numFmt(MI_IMPLIED_TOTAL)} total miles, and the share is only as provable as
        the counts behind it. Second, the method choice is often a coin flip the log decides:{' '}
        the engine puts the two methods <strong>{usd(Math.abs(MI_CMP.deductionDelta), 0)} apart
        </strong> on this profile ({usd(MI_STD, 0)} standard vs {usd(MI_ACTUAL_FLAT, 0)} actual)
        with the neutral mileage at <strong>{numFmt(MI_NEUTRAL.exactMiles ?? 0, 0)} miles</strong>{' '}
        (closed form; the engine&apos;s whole-mile scan flips at{' '}
        {numFmt(MI_NEUTRAL.engineFlipMiles ?? 0)}). Nobody optimizes their way across a $60 gap —
        but whichever side you claim, the examiner asks for the same document.
      </p>
      <p>
        One more bookkeeping debt the easy method creates: of the {usd(STD_RATE, 2)} rate,{' '}
        {usd(MILEAGE_CONSTANTS_2025.depreciationComponentPerMile, 2)} per mile is depreciation
        (Notice 2025-5), so a standard-rate year at {numFmt(MI_AUDIT.businessMiles)} miles books{' '}
        <strong>{usd(MI_STD_BASIS, 0)}</strong> of basis reduction — a figure you must track for
        the year you sell the car or switch methods. The no-receipts method still produces a
        record obligation.
      </p>

      <h3>Equipment and §179: the invoice is the asset</h3>
      <p>
        Equipment claims live or die on four documents per purchase, gathered at purchase time:{' '}
        <strong>the invoice</strong> (what it cost — this is the cost basis every later
        depreciation, §179, or gain computation starts from), <strong>payment proof</strong>
        (statement line matching the invoice), <strong>the placed-in-service date</strong> (when it
        started working for the business — the year of the deduction follows this date, not the
        purchase date), and <strong>the business-use share</strong> for anything that also serves
        personal purposes. Section 179 expensing requires predominantly business use — more than
        50% — and use that later falls below the threshold triggers recapture; listed-property
        rules (§280F) apply the §274(d) substantiation standard to mixed-use assets — cameras and
        vehicles remain listed property (computers were removed from the definition for assets
        placed in service after 2017, TCJA §13305, though a laptop&apos;s business-use share must
        still be provable to deduct it honestly). Keep the usage record alongside the invoice for
        anything that is not obviously 100% business.
      </p>
      <p>
        The habit that fails here is the &ldquo;big purchase&rdquo; habit: saving the receipt
        carefully <em>because</em> the number is large. The audit question is rarely whether you
        bought the laptop — the bank shows that. It is whether the date, the basis, and the
        business share support the deduction and the depreciation schedule built on it, and those
        four facts must come from your file, not your memory, for every year the asset lives.
        Which is the retention rule this guide returns to below: property records outlive the
        return that claimed them.
      </p>

      <h3>Travel and meals: five elements, every time</h3>
      <p>
        Travel and meals are strict-substantiation territory (§274(d)), and the standard is
        element-wise: <strong>amount, time and date, place, business purpose, and the business
        relationship</strong> of the person entertained or met. A credit-card line proves amount,
        date, and place — it proves nothing about purpose or relationship, which is why the
        meal-with-a-client receipt needs its one-line companion note written at the time
        (&ldquo;lunch with J. Doe — scope of the March redesign&rdquo;). Lodging requires a receipt
        regardless of amount while traveling away from home; other expenses get a practical
        exception for amounts under $75 (Temp. Reg. §1.274-5T(c)(2)(iii)) — but the exception waives the{' '}
        <em>documentary</em> evidence only, never the other elements, which is why the same-day log
        entry stays mandatory.
      </p>
      <p>
        Two rate rules shape the file, not the record-keeping. Business meals are limited to{' '}
        50% (§274(n)(1)); the temporary 100% rule for restaurant meals ran through 2022 and was
        not revived, so plan on half. And entertainment — the game tickets, the show, the
        outing — is <strong>not deductible at all</strong> under current law (§274(a)): keep
        entertainment receipts out of the business file entirely, because a folder of
        disallowed-looking items colors the ones beside them.
      </p>

      <h3>The room, over time: photos and floor plans</h3>
      <p>
        Exclusivity is a claim about behavior across an entire year — the room did nothing else —
        and no testimony improves on a dated photograph. The ritual costs ten minutes a year:
        <strong>one photograph</strong> of the space showing desk, equipment, and nothing personal
        in frame (the guest bed that is &ldquo;basically never used&rdquo; still breaks
        exclusivity — keep it out of the room or out of the claim);{' '}
        <strong>one dated floor plan</strong> carrying both measurements and the arithmetic of the
        percentage claimed ({numFmt(HO_AUDIT.officeSqFt)} ÷ {numFmt(HO_AUDIT.homeSqFt)} ={' '}
        {pct(HO_SHARE * 100, 1)} on the default profile); both stored with that year&apos;s return
        folder. Repeat annually — the year-stamped sequence is itself evidence of consistency —
        and re-shoot, re-measure, and recompute the share the week you move or repurpose any
        space.
      </p>
      <p>
        The photo also protects more than the office deduction. If the room qualifies as your
        principal place of business, trips from home to clients become business miles — the
        single largest interaction between the two instruments, priced in the{' '}
        <a href="/guides/deductions-home-office-and-vehicle/">deductions playbook</a> — so the
        ten-minute ritual defends a corner of the mileage claim too.
      </p>

      {/* ================================================================== */}
      <h2 id="retention">How long to keep it</h2>
      {/* ================================================================== */}
      <p>
        Retention follows one question: <strong>how long can the law still reach this year?</strong>
        The assessment clock generally starts when the return is filed, and the refund clock runs
        from the same point — so the supporting evidence lives at least as long as either. The
        default and its exceptions:
      </p>
      <table>
        <thead>
          <tr>
            <th>Record</th>
            <th>Keep it for</th>
            <th>Why — the rule that reaches it</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Returns and their supporting evidence (the default)</td>
            <td>
              <strong>3 years</strong> from filing
            </td>
            <td>
              The general assessment window — §6501(a); refund claims generally run to the later
              of 3 years from filing or 2 years from payment (§6511(a))
            </td>
          </tr>
          <tr>
            <td>Years with more than 25% of gross income omitted</td>
            <td>
              <strong>6 years</strong> (keep 7)
            </td>
            <td>The extended assessment window — §6501(e)</td>
          </tr>
          <tr>
            <td>Bad-debt deductions and worthless-security losses</td>
            <td>
              <strong>7 years</strong>
            </td>
            <td>Refund-claim lookback for these items — §6511(d)</td>
          </tr>
          <tr>
            <td>
              Property: home purchase and improvements, vehicle basis, depreciation and §179
              schedules
            </td>
            <td>
              <strong>Ownership lifetime</strong> + the assessment window after disposal
            </td>
            <td>
              Basis (§1012, §1016) and recapture on sale — home-office depreciation returns as
              unrecaptured §1250 gain at up to 25%; §179 use drops trigger recapture
            </td>
          </tr>
          <tr>
            <td>Employment-tax records (once you have payroll)</td>
            <td>
              <strong>At least 4 years</strong> after the return&apos;s due date or payment
            </td>
            <td>IRS employment-tax record rules</td>
          </tr>
          <tr>
            <td>Unfiled, late-filed, or fraudulent years</td>
            <td>Indefinitely</td>
            <td>No assessment limit applies — §6501(c)</td>
          </tr>
        </tbody>
      </table>
      <p>
        Two practical readings. First, the floor is a floor: three years is the{' '}
        <em>minimum</em>, and the six- and seven-year rows quietly convert it — the practical rule
        most practitioners give is <strong>seven years for everything</strong>, plus property
        files kept for ownership. Storage is effectively free; the marginal cost of the longer
        clock is one folder. Second, the property row is the one people learn too late: the
        depreciation schedule for a home office claimed in 2020 is evidence in the year you{' '}
        <em>sell</em> that home, possibly decades later — recapture taxes depreciation that was
        allowed or allowable whether or not you claimed it. Keep basis records as long as you own
        the asset, and several years past the sale.
      </p>

      {/* ================================================================== */}
      <h2 id="system">The minimum viable digital setup</h2>
      {/* ================================================================== */}
      <p>
        Everything above collapses into five habits — a system small enough to survive contact
        with a busy quarter, and complete enough that no audit request arrives empty-handed:
      </p>
      <ol>
        <li>
          <strong>Separate, once.</strong> Business checking plus a business card; every business
          dollar flows through them. One-time setup, then it defends you passively.
        </li>
        <li>
          <strong>Capture same-day.</strong> Photograph the receipt or log the expense the day it
          happens; record each business drive at or near the time. This is the only habit with a
          deadline attached — the strict-substantiation standard rewards records made &ldquo;at or
          near the time,&rdquo; and no other habit can repair it later.
        </li>
        <li>
          <strong>Triage weekly.</strong> Ten to fifteen minutes: drag the week&apos;s receipts
          and entries onto the right category, flag the ambiguous ones while context is fresh.
          Catch-up bookkeeping is where miscategorization — and the personal-looking expense on
          the business card — goes unnoticed.
        </li>
        <li>
          <strong>Close monthly.</strong> Download statements (PDF and CSV), reconcile against the
          ledger, and export the month&apos;s evidence bundle with receipts attached to entries.
          The monthly close is also where the home-office bills and the mileage log&apos;s month
          land in the file.
        </li>
        <li>
          <strong>Archive annually, in two places.</strong> One folder per tax year — the return,
          the ledger, the statements, the evidence bundles, the mileage log with its odometer
          bookends, the office photo and floor plan — backed up to one cloud location and one
          local export. The seven-year clock then runs on autopilot: delete nothing early, and
          retire whole years only on schedule.
        </li>
      </ol>
      <p>
        The system feeds the calendar naturally: the quarterly close is the input to each
        estimated-tax installment (the{' '}
        <a href="/guides/self-employed-tax-calendar/">tax calendar guide</a>), and the annual
        archive is the verification pass the{' '}
        <a href="/guides/year-end-tax-checklist/">year-end checklist</a> walks. The software
        choice matters less than the two non-negotiables: capture at the time, and export
        everything on a schedule — a ledger that lives only inside a SaaS app you might cancel is
        not an archive.
      </p>
      <blockquote>
        <p>
          The test of the system is not how it looks in a good month. It is whether a request for
          &ldquo;the 2024 mileage log and the office measurement&rdquo; is answered in minutes,
          from files that already exist, by someone who is not you.
        </p>
      </blockquote>

      {/* ================================================================== */}
      <h2 id="playbook">The order it runs in</h2>
      {/* ================================================================== */}
      <p>The five habits above say what to do; this is when each one runs:</p>
      <ol>
        <li>
          <strong>Week one:</strong> the separate accounts open and the next business expense
          already on them — every later step assumes this one.
        </li>
        <li>
          <strong>Same day, from today:</strong> capture the receipt, the entry, and the
          one-line purpose note at or near the time — the only step with a legal deadline
          attached.
        </li>
        <li>
          <strong>At every depreciable purchase:</strong> the four facts filed with the asset —
          invoice, payment proof, placed-in-service date, business-use share.
        </li>
        <li>
          <strong>Each month:</strong> statements down, ledger reconciled, evidence bundle
          exported; each quarter&apos;s close feeds the installment worksheet.
        </li>
        <li>
          <strong>Each December:</strong> re-run both method comparisons before the new mileage
          rate lands — the neutral mileage moves with the rate, and a method kept by inertia is
          a method chosen by the wrong year.
        </li>
        <li>
          <strong>Once a year, dated:</strong> photograph the room, redraw the floor plan,
          recompute the share, and file both with the return.
        </li>
        <li>
          <strong>Never early:</strong> three years minimum, six to seven for omissions and
          bad-debt positions, ownership lifetime for property, indefinitely for unfiled years.
        </li>
      </ol>
      <p>
        The instruments carry the arithmetic this system defends — the{' '}
        <a href="/home-office-deduction-calculator/">home office comparison</a> and the{' '}
        <a href="/mileage-deduction-calculator/">vehicle comparison</a> whose boundary numbers
        anchor this guide; the method-choice math behind them is the{' '}
        <a href="/guides/deductions-home-office-and-vehicle/">deductions playbook</a>&apos;s
        subject.
      </p>

      {/* ================================================================== */}
      <h2 id="boundaries">Where this guide stops</h2>
      {/* ================================================================== */}
      <p>
        Three boundaries. The tax figures here are federal illustrations computed by the
        suite&apos;s engines on the calculators&apos; default scenarios at a 24% bracket with the
        self-employment layer on — your bracket, state conformity, and the engines&apos; stated
        simplifications (no gross-income limitation on the home office, no §199A interaction, no
        §280F caps) all move real numbers; the{' '}
        <a href="/guides/deductions-home-office-and-vehicle/">deductions playbook</a> states the
        scope in full. The retention windows are the general federal clocks, not a limit on a
        state&apos;s or a lawsuit&apos;s longer memory. And audit outcomes are fact-specific:
        nothing here is tax advice — a qualified professional who can see your actual records
        outranks any guide, including this one.
      </p>
    </>
  );
}

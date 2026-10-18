import { AlertTriangle, CalendarClock, FileSearch, FolderCheck, Landmark } from 'lucide-react';
import { ArticleToc } from '@/components/Article';
import {
  HOME_OFFICE_CONSTANTS,
  actualMethod,
  businessShare,
  marginalSaving,
  simplifiedDeduction,
} from '@/lib/homeoffice';
import { MILEAGE_CONSTANTS_2025, standardMethod } from '@/lib/mileage';
import { QBI_CONSTANTS, computeQbiDeduction, taxValueOfDeduction } from '@/lib/qbi';
import { numFmt, pct, usd } from '@/lib/format';

/* Every instrument figure in this guide is computed at module scope by the same
   engines the instruments run (lib/homeoffice, lib/mileage, lib/qbi) — nothing
   is hand-typed. The same inputs were verified offline against tsc-compiled
   engine output (node-run, 28 assertions, all passing), so each published
   number matches the arithmetic the tool page would show. */

/* ---- The running renter example (lib/homeoffice) ---------------------------
   1,500 sq ft rented home, 300 sq ft exclusive office; rent $28,800/yr,
   utilities $3,600, insurance $360, repairs $600. Marginal bracket 22%,
   Schedule C filer (SE-tax layer on). */
const RENTER = {
  homeSqFt: 1500,
  officeSqFt: 300,
  tenure: 'rent' as const,
  rent: 28_800,
  mortgageInterest: 0,
  propertyTax: 0,
  homeBasis: 0,
  utilities: 3600,
  insurance: 360,
  repairs: 600,
};
const OFFICE_SHARE = businessShare(RENTER.officeSqFt, RENTER.homeSqFt);
const SIMPLIFIED_CAP = simplifiedDeduction(HOME_OFFICE_CONSTANTS.simplifiedMaxSqFt);
const ACT = actualMethod(RENTER);
const HOME_COST = ACT.housingCost + ACT.operatingCost;
const HO_SAVING = marginalSaving(ACT.deduction, 22, true);

/* ---- The round-thousand pattern (lib/mileage) ------------------------------ */
const PER_THOUSAND = standardMethod(1000);
const M_ROUND = standardMethod(5000);
const M_LOGGED = standardMethod(4718);

/* ---- The SSTB label gap (lib/qbi) -------------------------------------------
   Single filer, $150,000 QBI, no W-2 wages, no UBIA, taxable income $222,300
   — $25,000 into the $50,000 phase-in range, so the applicable percentage is
   exactly 50%. The same facts are run twice: labeled SSTB (correct) and
   labeled non-SSTB (the misclassification under examination). */
const QBI_BASE = {
  qbi: 150_000,
  taxableIncome: 222_300,
  w2Wages: 0,
  ubia: 0,
  filingStatus: 'single' as const,
};
const SSTB = computeQbiDeduction({ ...QBI_BASE, sstb: true });
const SSTB_MISLABELED = computeQbiDeduction({ ...QBI_BASE, sstb: false });
const SSTB_EXCLUDED = computeQbiDeduction({ ...QBI_BASE, taxableIncome: 260_000, sstb: true });
/** The wage level that fully unlocks the non-SSTB side at $260k of TI — an input, not an output. */
const RESCUE_WAGES = 100_000;
const NONSSTB_RESCUED = computeQbiDeduction({
  ...QBI_BASE,
  taxableIncome: 260_000,
  w2Wages: RESCUE_WAGES,
  sstb: false,
});
/* The caveat lib/qbi's wage sweep documents (and the tool caption states): wages
   come out of the same profit, so they also shrink QBI. Paying $100k of W-2
   wages out of $150k of income leaves $50k of QBI — the realistic rescue. */
const RESCUE_QBI = QBI_BASE.qbi - RESCUE_WAGES;
const RESCUE_REALISTIC = computeQbiDeduction({
  ...QBI_BASE,
  taxableIncome: 260_000,
  qbi: RESCUE_QBI,
  w2Wages: RESCUE_WAGES,
  sstb: false,
});
const LABEL_GAP = SSTB_MISLABELED.deduction - SSTB.deduction;
const SSTB_TAX_VALUE = taxValueOfDeduction(QBI_BASE.taxableIncome, SSTB.deduction, 'single');
const MISTAX_TAX_VALUE = taxValueOfDeduction(QBI_BASE.taxableIncome, SSTB_MISLABELED.deduction, 'single');
const QBI_TOP = QBI_CONSTANTS.threshold.single + QBI_CONSTANTS.phaseInRange.single;

/**
 * Guide body for /guides/tax-audit-red-flags/ — the audit-risk playbook. It
 * ranks the flags that actually move a small-business return into examination
 * by selection probability times preparation cost, pairs each with the records
 * that close it, and walks the fact process (correspondence proposal →
 * examination → appeal) with the decision points for bringing in a
 * representative.
 *
 * Rendering contract (GuideShell): the shell supplies h1, reading time, the
 * prose column, and the closing instrument panel — this component starts at
 * plain paragraphs and h2 and renders through the shared .prose-article
 * tokens. Server-component safe: no hooks, no event handlers.
 */
export default function TaxAuditRedFlagsGuide() {
  const toc = [
    { id: 'selection-model', label: 'What actually selects a return' },
    { id: 'hobby-loss', label: 'Consecutive losses: the §183 line' },
    { id: 'home-office', label: 'The home-office share that does not add up' },
    { id: 'mileage', label: 'Mileage in round thousands' },
    { id: 'cash-records', label: 'All-cash books the bank cannot corroborate' },
    { id: 'cp2000', label: 'Schedule C versus the 1099 stack (CP2000)' },
    { id: 'sstb', label: 'QBI: calling an SSTB something else' },
    { id: 'reasonable-salary', label: 'Reasonable compensation at both ends' },
    { id: 'selected', label: 'If you are selected: the process and the hand-offs' },
    { id: 'boundaries', label: 'Where this framework ends' },
  ];

  return (
    <>
      <ArticleToc items={toc} />

      <p>
        <strong>
          Treat audit exposure as a filing-season decision, not a mailing-season problem: almost
          everything that moves a small-business return into examination is visible on the face of
          the return itself, every one of those flags is closed by records rather than arguments,
          and none of them is a reason to skip a deduction you are genuinely entitled to.
        </strong>{' '}
        Roughly four in a thousand individual returns were examined in FY2023 (IRS Data Book), the
        rate rises with Schedule C gross receipts but stays low in absolute terms, and the large
        majority of small-business exams are handled by mail. The rational posture is therefore not
        avoidance — it is ranking: know which flags your own return carries, know what each one
        costs to defend, and hold the file that closes it. This guide ranks the seven flags that
        matter by selection probability times preparation cost, shows the arithmetic the IRS&apos;s
        own matching programs run, and walks the process from the first letter to appeal.
      </p>

      <div className="my-8 rounded-2xl border border-indigo-100 bg-indigo-50 p-6 dark:border-indigo-500/20 dark:bg-indigo-500/10">
        <div className="flex items-start gap-2.5 text-sm leading-relaxed text-slate-700 dark:text-slate-200">
          <AlertTriangle
            className="mt-0.5 h-4 w-4 shrink-0 text-indigo-600 dark:text-indigo-300"
            aria-hidden="true"
          />
          <span>
            The running examples are one consultant in two income positions: the base case is a
            Schedule C filer, single, in a 22% marginal bracket, renting a{' '}
            {numFmt(RENTER.homeSqFt)} sq ft home with a {numFmt(RENTER.officeSqFt)} sq ft exclusive
            office and a vehicle carrying {numFmt(M_ROUND.miles)} claimed business miles. The QBI
            section steps the same person up to {usd(QBI_BASE.taxableIncome, 0)} of taxable income
            — the 32% bracket — because the §199A phase-out only exists above{' '}
            {usd(QBI_CONSTANTS.threshold.single, 0)}, and the flag is invisible below it. Every
            dollar figure is computed by the engines behind the{' '}
            <a href="/home-office-deduction-calculator/">home office deduction calculator</a>, the{' '}
            <a href="/mileage-deduction-calculator/">mileage deduction calculator</a>, and the{' '}
            <a href="/qbi-deduction-calculator/">QBI deduction calculator</a> — tax year 2025
            federal parameters throughout, no state tax modeled. Conservative reading rule: where
            the law is facts-and-circumstances, this guide says so instead of quoting a bright
            line that does not exist.
          </span>
        </div>
      </div>

      {/* ================================================================== */}
      <h2 id="selection-model">What actually selects a return</h2>
      {/* ================================================================== */}
      <p>
        Two different machines touch your return before any human does. Scoring filters rank
        returns by how far each line sits from what similar returns report — the descendants of
        the Discriminant Function — DIF — scores the IRS has used for decades. Separately, the
        Automated Underreporter (AUR) program matches the information returns filed under your
        TIN — every 1099-NEC, 1099-K, 1099-MISC — against the income your return reports, with
        no judgment involved at all. A human examiner appears only after one of those filters
        raises its hand, which is why the flags below sort into three postures:
      </p>
      <ol>
        <li>
          <strong>Arithmetic flags</strong> — the CP2000 family. A machine found a gap between two
          numbers and proposed an adjustment. Preparation cost is nearly zero if your books
          reconcile; the flag fires on its own otherwise.
        </li>
        <li>
          <strong>Pattern flags</strong> — round numbers, loss streaks, ratios outside the band
          for your industry and size. These select the return for a human; the defense is the
          record set, assembled while the year was happening.
        </li>
        <li>
          <strong>Label flags</strong> — SSTB status, reasonable compensation. The return&apos;s
          own labels invite the question; the defense is documentation of the underlying facts.
        </li>
      </ol>
      <p>The ledger, ranked by selection probability × preparation cost:</p>
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>Flag</th>
            <th>Why it selects</th>
            <th>What closes it</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>1</td>
            <td>Schedule C receipts below the 1099 stack</td>
            <td>AUR matching by TIN — pure arithmetic</td>
            <td>A receipts-to-1099 reconciliation you can produce in an hour</td>
          </tr>
          <tr>
            <td>2</td>
            <td>Mileage in exact round thousands</td>
            <td>Round numbers read as estimates; estimates fail substantiation</td>
            <td>A contemporaneous log with real mile counts</td>
          </tr>
          <tr>
            <td>3</td>
            <td>Home-office share that does not fit the home</td>
            <td>Square footage and share sit outside plausible bands</td>
            <td>Floor plan, photos, and a measurement that repeats year to year</td>
          </tr>
          <tr>
            <td>4</td>
            <td>Consecutive Schedule C losses</td>
            <td>§183 profiling — hobby-loss screen</td>
            <td>Businesslike books and a profitability story the records corroborate</td>
          </tr>
          <tr>
            <td>5</td>
            <td>All-cash receipts and expenses</td>
            <td>No bank corroboration for either side of the ledger</td>
            <td>Daily cash sheets and a deposits-to-receipts reconciliation</td>
          </tr>
          <tr>
            <td>6</td>
            <td>QBI claimed on a mislabeled SSTB</td>
            <td>The label contradicts the business described elsewhere</td>
            <td>A documented business model — what is sold and whose labor delivers it</td>
          </tr>
          <tr>
            <td>7</td>
            <td>Owner salary at either extreme</td>
            <td>Salary near zero (S corp) or far above market (C corp)</td>
            <td>Comparable-pay data and a documented compensation decision</td>
          </tr>
        </tbody>
      </table>
      <p>
        Read the ranking as a budget, not a fear list. Items 1–3 cost an evening each to close in
        January; item 4 is a habit, not a document; items 5–7 are structural and worth a
        conversation with the preparer before filing, not after a letter arrives.
      </p>

      {/* ================================================================== */}
      <h2 id="hobby-loss">Consecutive losses: the §183 line</h2>
      {/* ================================================================== */}
      <p>
        The most consequential pattern flag for a young business is also the most misunderstood.
        Losses are not disallowed because they repeat — businesses legitimately lose money for
        years. §183 denies <em>loss-style</em> deductions only when the activity is not engaged in
        for profit at all, and when that happens the deduction regime collapses: expenses are
        limited to the activity&apos;s gross income, and the ordering rules change (§183(b)). What
        selects the return is the shape of the history: a Schedule C that loses money in year
        after year, at volumes that never come close to turning, on an activity that looks like a
        hobby with invoices.
      </p>
      <p>
        The statute hands you one bright line and one open standard. The bright line is the
        presumption in §183(d): show a profit in 3 of 5 consecutive years (2 of 7 for certain
        horse activities) and the burden shifts to the IRS to prove the activity is not for
        profit. The open standard is everything else — when the presumption does not apply, profit
        motive is judged on facts and circumstances, and the nine factors the Treasury Regulations
        name (Treas. Reg. §1.183-2(b)) are the checklist an examiner will actually walk:
      </p>
      <table>
        <thead>
          <tr>
            <th>Factor (Treas. Reg. §1.183-2(b))</th>
            <th>What the records should show</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>1. Manner of carrying on the activity</td>
            <td>Complete books, a separate bank account, written contracts and change orders</td>
          </tr>
          <tr>
            <td>2. Expertise of the taxpayer and advisers</td>
            <td>Study of the market, trade publications, a paid consultant or mentor</td>
          </tr>
          <tr>
            <td>3. Time and effort expended</td>
            <td>Documented hours; withdrawal from another occupation to work on this one</td>
          </tr>
          <tr>
            <td>4. Expectation that assets appreciate</td>
            <td>Purchased assets whose gain, not operations, is the profit thesis</td>
          </tr>
          <tr>
            <td>5. Success in other activities</td>
            <td>A track record of converting similar ventures to profit</td>
          </tr>
          <tr>
            <td>6. History of income or losses</td>
            <td>Losses confined to startup (or explainable) years, then narrowing</td>
          </tr>
          <tr>
            <td>7. Amount of occasional profits</td>
            <td>Profitable years that are meaningful relative to the investment</td>
          </tr>
          <tr>
            <td>8. Financial status</td>
            <td>You do not have other large income sources absorbing the losses</td>
          </tr>
          <tr>
            <td>9. Personal pleasure or recreation</td>
            <td>The activity has no sizable amusement or recreational element</td>
          </tr>
        </tbody>
      </table>
      <p>
        No factor decides alone, and the list is not a scoring rubric — courts weigh them
        together. What closes the flag in practice is simpler than litigation: businesslike books
        from day one, a business account the activity never leaves, and visible attempts to make
        the thing profitable (price changes, cost cuts, a written plan with dates). If the fifth
        year arrives without the §183(d) pattern, the honest options are to restructure the
        activity until it can plausibly turn a profit or to plan around the limitation — not to
        keep filing the same loss and hope the pattern goes unnoticed.
      </p>

      {/* ================================================================== */}
      <h2 id="home-office">The home-office share that does not add up</h2>
      {/* ================================================================== */}
      <p>
        The home-office deduction flags a return when its numbers stop describing a plausible
        apartment. The qualifying test is statutory and strict — <strong>exclusive and regular</strong>{' '}
        business use of a space that is either the principal place of the business, a place used
        regularly and exclusively to meet with clients or patients, or a separate unattached
        structure (§280A(c)(1)(A)–(C); the running consultant qualifies under the first branch) —
        but what selects the return is arithmetic around the edges: an office area that grows to
        exactly the simplified-option cap, a business-use share inconsistent with the
        home&apos;s size, or an office that equals half the residence. The engines put hard
        boundaries on the plausible range, and examiners know them:
      </p>
      <ul>
        <li>
          The simplified option pays{' '}
          <strong>
            {usd(HOME_OFFICE_CONSTANTS.simplifiedRatePerSqFt)}/sq ft up to{' '}
            {numFmt(HOME_OFFICE_CONSTANTS.simplifiedMaxSqFt)} sq ft
          </strong>{' '}
          — a ceiling of <strong>{usd(SIMPLIFIED_CAP, 0)}</strong> that no office size can exceed
          (Rev. Proc. 2013-13). Exactly-one-method-per-year applies; you cannot split the two.
        </li>
        <li>
          The actual method deducts the business share of real costs:{' '}
          <strong>share = office ÷ home</strong>. Our running renter — a{' '}
          {numFmt(RENTER.officeSqFt)} sq ft office in a {numFmt(RENTER.homeSqFt)} sq ft apartment —
          has a share of{' '}
          <strong>{pct(OFFICE_SHARE.fraction * 100, 0)}</strong> ({numFmt(RENTER.officeSqFt)} ÷{' '}
          {numFmt(RENTER.homeSqFt)}, capped at 100% by the engine).
        </li>
        <li>
          On real numbers that share is worth real money:{' '}
          {usd(RENTER.rent, 0)} rent + {usd(HOME_COST - RENTER.rent, 0)} operating ={' '}
          {usd(HOME_COST, 0)} of annual home cost, × {pct(OFFICE_SHARE.fraction * 100, 0)} ={' '}
          <strong>{usd(ACT.deduction, 0)}</strong> under the actual method — against the{' '}
          {usd(SIMPLIFIED_CAP, 0)} ceiling. At {usd(ACT.costPerSqFt)}/sq ft this home runs far
          above the {usd(HOME_OFFICE_CONSTANTS.simplifiedRatePerSqFt)}/sq ft simplified rate; the
          engine&apos;s indifference point is{' '}
          <strong>{usd(ACT.breakevenAnnualHomeCost, 0)}</strong> of annual home cost for this
          apartment.
        </li>
        <li>
          The stakes for the exam: that {usd(ACT.deduction, 0)} deduction is worth about{' '}
          <strong>{usd(HO_SAVING.total, 0)}</strong> of combined tax at a 22% bracket with the SE
          layer on — <strong>{usd(HO_SAVING.seTax, 0)}</strong> of it in self-employment tax
          alone. That is why the substantiation gets read closely.
        </li>
      </ul>
      <p>
        What closes the flag: a floor plan or sketch with measurements, photographs of the room
        as actually used, a square-footage figure that reconciles to the lease or listing, and a
        share that behaves consistently across years. Two boundaries keep the claim honest even
        when it survives: the deduction cannot exceed the gross-income limit of §280A(c)(5) — and
        where the simplified option loses excess to that limit it is gone for good, while the
        actual method carries it forward — and the exclusive-use test fails for any room that
        doubles as a guest room or dining table. The{' '}
        <a href="/guides/deductions-home-office-and-vehicle/">deductions playbook</a> works the
        full method comparison; here the audit point is only that the numbers on the form should
        describe a room that exists.
      </p>

      {/* ================================================================== */}
      <h2 id="mileage">Mileage in round thousands</h2>
      {/* ================================================================== */}
      <p>
        A mileage deduction of exactly {numFmt(M_ROUND.miles)} miles is the pattern flag that
        closes hardest. The arithmetic is linear —{' '}
        {usd(MILEAGE_CONSTANTS_2025.standardRatePerMile)}/business-mile for 2025 (IRS Notice
        2025-5) — so each additional thousand claimed miles is exactly{' '}
        <strong>{usd(PER_THOUSAND.deduction, 0)}</strong>, and a round 5,000 is exactly{' '}
        <strong>{usd(M_ROUND.deduction, 0)}</strong>. Real driving does not produce round
        thousands; real logs produce numbers like{' '}
        <strong>{numFmt(M_LOGGED.miles)}</strong>, worth{' '}
        <strong>{usd(M_LOGGED.deduction)}</strong> at the same rate. A whole-round figure tells
        the examiner the number was estimated after the fact, and an estimate is not
        substantiation: the adequate-records standard requires documentation of each trip&apos;s
        amount, time, place, and business purpose, made at or near the time of use (Treas. Reg.
        §1.274-5T(c)).
      </p>
      <p>
        The records that close the flag are unglamorous: a contemporaneous log (an app export
        with odometer readings beats any reconstruction), the business purpose of each trip tied
        to a client or engagement, and a total that coheres with the vehicle&apos;s overall use —
        commuting is never business mileage, and a home office treated as the principal place of
        business is what makes home-to-client trips count (the qualification the{' '}
        <a href="/home-office-deduction-calculator/">office calculator</a> prices). One
        boundary worth knowing even off-exam: the standard rate already contains{' '}
        {usd(MILEAGE_CONSTANTS_2025.depreciationComponentPerMile)}/mile of depreciation —{' '}
        <strong>{usd(M_ROUND.embeddedDepreciation, 0)}</strong> of basis reduction on{' '}
        {numFmt(M_ROUND.miles)} miles — so the same vehicle cannot also be depreciated, §179&apos;d,
        or bonus-depreciated. The <a href="/mileage-deduction-calculator/">mileage calculator</a>{' '}
        runs both methods and flags the crossover; the audit point is that whichever side of that
        crossover you file, the miles behind it should be countable, not round.
      </p>

      {/* ================================================================== */}
      <h2 id="cash-records">All-cash books the bank cannot corroborate</h2>
      {/* ================================================================== */}
      <p>
        A business that takes and spends largely in cash carries two flags at once: reported
        income no third party can verify, and claimed expenses no canceled check or card
        statement can corroborate. Examiners handle this with a bank-deposit analysis — every
        deposit into every account, plus observed spending, reconciled against reported gross
        receipts; unexplained deposits are treated as unreported income. The defense is not
        verbosity, it is reconciliation: a daily cash sheet (register tape, invoice stubs, the
        Z-report from the till), deposits that tie to the sheets, and expenses supported by the
        same receipts any filer keeps. Cash businesses are not examined because cash is
        suspicious; they are examined when the deposits and the return tell different stories.
        The habit that closes this flag costs minutes a day and nothing else.
      </p>

      {/* ================================================================== */}
      <h2 id="cp2000">Schedule C versus the 1099 stack (CP2000)</h2>
      {/* ================================================================== */}
      <p>
        The highest-probability, lowest-drama flag: your Schedule C gross receipts sit below the
        sum of the information returns filed under your TIN. AUR matches them by number, and a
        gap produces a CP2000 — a proposed adjustment, not an examination, delivered as a letter
        with a computation, extra tax, and a response deadline stated on the notice (typically 30
        days from its date). The matching is blind to context, which cuts both ways: the program
        cannot see that some 1099 income was returned, refunded, or reported on a different line,
        and it also cannot be argued with by phone — it is answered by a reconciliation.
      </p>
      <p>
        Three situations produce most CP2000s on small-business returns. First,{' '}
        <strong>real omission</strong>: client A&apos;s 1099-NEC that never made the books — the
        letter is correct, and the response is an agreement and payment (or a payment plan).{' '}
        Second, <strong>gross-versus-net</strong>: platform 1099-Ks report gross transaction
        value before the platform&apos;s fees, while the books record net deposits; the
        reconciliation shows the fee expense moving to its own line, and the letter closes
        without adjustment. Third, <strong>double-counting risk</strong>: the same income
        arriving on both a 1099-K and a 1099-NEC, or income you correctly reported but the
        matcher misallocated. What closes all three is the same artifact — a schedule tying each
        1099 box, by payer, to a line in the books — which is why this is the one flag whose
        entire preparation cost is a January habit. The{' '}
        <a href="/guides/year-end-tax-checklist/">year-end checklist</a> makes it the closing
        pass of the tax year.
      </p>

      {/* ================================================================== */}
      <h2 id="sstb">QBI: calling an SSTB something else</h2>
      {/* ================================================================== */}
      <p>
        The §199A deduction gives a specified service trade or business (SSTB) a phase-out, and
        gives everything else a wage limit — and the two regimes are different enough that the
        label is worth defending honestly. An SSTB is a business whose principal value is the
        skill or reputation of its owners or employees in fields like health, law, accounting,
        consulting, financial services, or the performing arts (§199A(d)(2)). For a single
        filer the numbers are fixed: the threshold is{' '}
        <strong>{usd(QBI_CONSTANTS.threshold.single, 0)}</strong> of taxable income (Rev. Proc.
        2024-40), the phase-in range is{' '}
        <strong>{usd(QBI_CONSTANTS.phaseInRange.single, 0)}</strong> (§199A(e)(2)(B)(ii), not
        indexed), and above <strong>{usd(QBI_TOP, 0)}</strong> an SSTB&apos;s QBI deduction is
        zero — not limited, zero.
      </p>
      <p>
        The engine prices exactly what the label is worth mid-band. Our consultant —{' '}
        {usd(QBI_BASE.qbi, 0)} of QBI, no W-2 wages, taxable income{' '}
        {usd(QBI_BASE.taxableIncome, 0)}, which is {usd(QBI_BASE.taxableIncome - QBI_CONSTANTS.threshold.single, 0)}{' '}
        into the range for an applicable percentage of{' '}
        <strong>{pct(SSTB.applicablePct * 100, 0)}</strong>:
      </p>
      <table>
        <thead>
          <tr>
            <th>Same facts, different label</th>
            <th>§199A deduction</th>
            <th>Approximate federal tax value (32% bracket)</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Filed as SSTB (correct for a solo consultant)</td>
            <td>
              <strong>{usd(SSTB.deduction, 0)}</strong>
            </td>
            <td>{usd(SSTB_TAX_VALUE, 0)}</td>
          </tr>
          <tr>
            <td>Filed as non-SSTB (the misclassification)</td>
            <td>
              <strong>{usd(SSTB_MISLABELED.deduction, 0)}</strong>
            </td>
            <td>{usd(MISTAX_TAX_VALUE, 0)}</td>
          </tr>
          <tr>
            <td><strong>The label gap</strong></td>
            <td>
              <strong>{usd(LABEL_GAP, 0)}</strong>
            </td>
            <td>
              <strong>{usd(MISTAX_TAX_VALUE - SSTB_TAX_VALUE, 0)}</strong>
            </td>
          </tr>
        </tbody>
      </table>
      <p>
        The mechanics are asymmetric in a way worth internalizing. Below{' '}
        {usd(QBI_CONSTANTS.threshold.single, 0)} the SSTB label costs nothing — the wage limit
        does not apply and the deduction is the full 20% either way. Inside the band the SSTB
        side is reduced twice (QBI scaled by the applicable percentage, then the wage-limit
        excess phased back in — the engine computes both layers, which is why the correct SSTB
        figure is {usd(SSTB.deduction, 0)} and not a single-scaled number). Above{' '}
        {usd(QBI_TOP, 0)} the gap becomes absolute: the engine shows the SSTB at{' '}
        <strong>{usd(SSTB_EXCLUDED.deduction, 0)}</strong> (excluded outright), while an
        otherwise identical non-SSTB paying {usd(RESCUE_WAGES, 0)}{' '}
        of W-2 wages recovers the full <strong>{usd(NONSSTB_RESCUED.deduction, 0)}</strong> — the
        wage limit can be engineered around, the SSTB exclusion cannot. One model boundary
        belongs on that sentence itself: it holds QBI fixed while wages grow, exactly as the
        engine&apos;s wage sweep does. In reality the wages come out of the same profit — pay{' '}
        {usd(RESCUE_WAGES, 0)} of the {usd(QBI_BASE.qbi, 0)} as W-2 and the business has{' '}
        {usd(RESCUE_QBI, 0)} of QBI left, for a deduction of{' '}
        <strong>{usd(RESCUE_REALISTIC.deduction, 0)}</strong>. The direction survives the caveat —
        wages can lift the non-SSTB side, and nothing lifts the SSTB exclusion — but
        &ldquo;recovers the full 20%&rdquo; is a ceteris-paribus figure, not a planning promise.
      </p>
      <p>
        This is why the misclassification gets examined, and why the honest reading is narrower
        than it looks. Calling a solo practice &ldquo;consulting&rdquo; an SSTB is not optional;
        but the definition turns on what is actually sold — a consultant billing personal time
        is an SSTB, while a firm that productizes others&apos; consulting labor, sells
        deliverables at scale, or holds meaningful depreciable assets may genuinely not be. What
        closes the flag is a documented business model: engagement contracts showing who performs
        the work, payroll records, and a Schedule C description consistent with the 8995-A
        position. What opens it is the reverse — a return whose activity description and QBI
        checkbox contradict each other. The{' '}
        <a href="/qbi-deduction-calculator/">QBI calculator</a> runs both regimes side by side;
        run your facts both ways, then file the one your records can carry.
      </p>

      {/* ================================================================== */}
      <h2 id="reasonable-salary">Reasonable compensation at both ends</h2>
      {/* ================================================================== */}
      <p>
        Owner salary is the flag with two failure directions, and the direction depends on the
        entity. An S corporation that pays its working owner a token salary and takes the rest as
        distributions invites recharacterization: the IRS can treat part of the distributions as
        unpaid wages, with back employment taxes, interest, and penalties. A C corporation that
        pays a working owner far above market has the mirror problem — the excess is not
        &ldquo;reasonable&rdquo; under §162(a)(1) and can be disallowed as a disguised
        distribution (a dividend in substance). The same standard polices both ends: compensation
        is deductible in fact and amount only to the extent a comparable business would pay
        comparable work (Treas. Reg. §1.162-7).
      </p>
      <p>
        There is no formula, and the honest documentation is the defense. What carries weight:
        survey or market data for the role (industry compensation studies, job postings for
        comparable positions), the owner&apos;s duties and hours, the company&apos;s profits
        relative to the pay, and — for corporations — a contemporaneous record of how the number
        was set: board minutes, a compensation review, a memo applying the comparables. Paying
        &ldquo;what we always paid&rdquo; with no file behind it is the fact pattern that loses;
        paying a defensible number with a dated analysis is the fact pattern that never becomes
        a dispute. The <a href="/guides/paying-yourself-from-your-business/">paying-yourself
        guide</a> covers the salary-versus-draw decision itself; here the point is only that
        whichever number you set, set it on paper before the year it covers, not after the
        letter arrives.
      </p>

      {/* ================================================================== */}
      <h2 id="selected">If you are selected: the process and the hand-offs</h2>
      {/* ================================================================== */}
      <p>
        An examination is a document process with deadlines, and almost every bad outcome traces
        to a missed date rather than a weak file. The small-business reality is the
        correspondence track: a letter stating the issues, an Information Document Request
        (Form 4564) listing what to send, and a window to respond. Office and field examinations
        exist but are rare at Schedule C scale. The arc, and the decisions in it:
      </p>
      <ol>
        <li>
          <strong>Notice received.</strong> Read the letter for what it actually is — a CP2000
          proposes an adjustment by matching; an examination letter asks for records — and find
          the response deadline before anything else (the CP2000&apos;s is typically 30 days from
          the notice date). Missing it converts a proposal into an assessment you then have to
          unwind.
        </li>
        <li>
          <strong>Records assembled.</strong> Send documents, not narratives: the reconciliation,
          the log, the floor plan. Every assertion in your file should be an attachment.
        </li>
        <li>
          <strong>Disagreement after the exam</strong> — the 30-day letter proposes changes; a
          written protest takes it to the IRS Independent Office of Appeals, an administrative
          venue where most disputes settle without court. After a statutory notice of deficiency
          (the 90-day letter), petitioning the United States Tax Court is the path that does not
          require paying first (§6213).
        </li>
      </ol>
      <div className="my-8 grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-white/[0.08] dark:bg-slate-900/60">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            <CalendarClock className="h-4 w-4 text-indigo-600 dark:text-indigo-300" aria-hidden="true" />
            When to bring a representative
          </div>
          <div className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
            Bring in a CPA, enrolled agent, or attorney (Form 2848, power of attorney) when the
            letter is an examination rather than a matching proposal, when income reconstruction
            (bank-deposit analysis) is on the table, or when you find yourself explaining instead
            of documenting. A matching letter with a clean reconciliation rarely needs one.
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-white/[0.08] dark:bg-slate-900/60">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            <FileSearch className="h-4 w-4 text-indigo-600 dark:text-indigo-300" aria-hidden="true" />
            What the representative changes
          </div>
          <div className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
            Conversations route through them, scope discipline improves (requests get answered,
            not expanded), and penalty positions get made properly. What does not change: the
            records still have to exist. Representation argues about the file; it cannot replace
            it.
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-white/[0.08] dark:bg-slate-900/60">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            <FolderCheck className="h-4 w-4 text-indigo-600 dark:text-indigo-300" aria-hidden="true" />
            The January file, per flag
          </div>
          <div className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
            One folder per flag above: the 1099 reconciliation, the mileage log export, the
            office floor plan and photos, the profit-motive file, the cash sheets, the
            compensation memo. An exam you can answer from a folder is a non-event.
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-white/[0.08] dark:bg-slate-900/60">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            <Landmark className="h-4 w-4 text-indigo-600 dark:text-indigo-300" aria-hidden="true" />
            Appeals is not court
          </div>
          <div className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
            The Independent Office of Appeals is administrative, earlier, and settles most cases
            it receives on hazards-of-litigation grounds. Escalating there costs a protest letter,
            not a filing fee — a cheaper decision than signing an agreement you disagree with.
          </div>
        </div>
      </div>

      {/* ================================================================== */}
      <h2 id="boundaries">Where this framework ends</h2>
      {/* ================================================================== */}
      <p>
        Three boundaries. First, the engines model tax-year 2025 federal parameters only — no
        state tax — and state the limits they do not model: the home-office gross-income cap of
        §280A(c)(5) is a stated assumption, the §199A chain assumes a single trade or business
        with no net capital gain, and its wage sweep holds QBI fixed while wages grow — in
        reality each wage dollar paid out of the business&apos;s profit also reduces its QBI, so
        &ldquo;pay wages to unlock the limit&rdquo; buys less than the sweep line implies (the
        SSTB section prices that haircut at the point of use). Second, the legal boundaries here are deliberately
        conservative paraphrases: §183&apos;s nine factors are weighed, not scored; reasonable
        compensation has no safe-harbor formula; SSTB status turns on facts. Where your facts sit
        near a line, the record — not this guide — is the defense, and a CPA or attorney who has
        seen the records is the right reader of the gray areas. Third, and most important: none
        of the seven flags argues for under-claiming. The home-office deduction, the standard
        mileage rate, and the §199A deduction are all worth claiming in full when the facts
        support them — the entire playbook above exists so that they survive being claimed.
      </p>
      <p>
        The instruments below run the arithmetic on your own numbers — the same engines that
        produced every figure in this guide. File from them, keep the file that closes each flag,
        and the exam question becomes the January question it should have been all along.
      </p>
    </>
  );
}

import { Building2, CalendarCheck, Layers, Scale } from 'lucide-react';
import { ArticleToc } from '@/components/Article';
import { addlMedicareSE, PAYTYPE_CONSTANTS, seTaxOnNet } from '@/lib/paytype';
import { computeQbiDeduction, QBI_CONSTANTS } from '@/lib/qbi';
import { hsaLimitFor, HSA_CONSTANTS } from '@/lib/hsa';
import { taxFromBrackets, FED_BRACKETS_2025 } from '@/lib/tax';
import { EST_CONSTANTS } from '@/lib/estimated';
import { numFmt, pct, usd } from '@/lib/format';

/* Every dollar figure in this guide is computed at build time by the same
   engines the instruments run — Schedule SE and the §162(l) cap from
   lib/paytype (the 1099-vs-W-2 calculator's model), the §199A chain from
   lib/qbi, the 2025 HSA limits from lib/hsa, the 2025 brackets from lib/tax.
   The S-corp W-2 arithmetic is plain module-scope math on the engine's own
   constants. Nothing below is hand-typed.

   Worked persona (tax year 2025): a solo consultant — single filer, SSTB, no
   employees, family marketplace plan at $1,320/month against $96,000 of
   Schedule C net profit. The same inputs are pinned in
   scripts/tests/self-employed-health-insurance-guide.test.mjs — 50 assertions
   inside the site's unified math matrix (node scripts/run-math-tests.mjs). */

/* ---- The persona: full-year self-employment -------------------------------- */
const NET = 96_000;
const MONTHLY = 1_320;
const PREMIUM = MONTHLY * 12;
const SE_BASE = PAYTYPE_CONSTANTS.seBaseFactor; // 92.35%, §1402(a)
const STD = EST_CONSTANTS.stdDeductionSingle; // $15,750, P.L. 119-21 §70103

const SE_TAX = seTaxOnNet(NET);
const HALF_SE = (SE_TAX - addlMedicareSE(NET)) / 2; // §164(f)
/* §162(l)(2)(A) earned-income cap, computed exactly as lib/paytype does
   (the 1099-vs-W-2 engine's §162(l) branch): 92.35% of net profit minus the
   deductible half of SE tax — measured BEFORE the SEHI deduction itself. */
const SEHI_CAP = Math.max(0, NET * SE_BASE - HALF_SE);
const SEHI = Math.min(PREMIUM, SEHI_CAP);

/* What the deduction would do if it were a Schedule C expense — it is not:
   the premium stays inside the SE-tax base (the point of the S-corp section). */
const SE_IF_EXPENSE = seTaxOnNet(NET - PREMIUM);
const SE_TAX_UNTOUCHED = SE_TAX - SE_IF_EXPENSE;

/* ---- The QBI interaction (lib/qbi, §199A(c)(1)) ---------------------------- */
const QBI_COMMON = { w2Wages: 0, ubia: 0, sstb: true, filingStatus: 'single' as const };
const QBI_WITH_SEHI = computeQbiDeduction({
  ...QBI_COMMON,
  qbi: NET - HALF_SE - SEHI,
  taxableIncome: Math.max(0, NET - HALF_SE - SEHI - STD),
});
const QBI_NO_SEHI = computeQbiDeduction({
  ...QBI_COMMON,
  qbi: NET - HALF_SE,
  taxableIncome: Math.max(0, NET - HALF_SE - STD),
});
const TI_WITH = Math.max(0, NET - HALF_SE - SEHI - STD - QBI_WITH_SEHI.deduction);
const TI_WITHOUT = Math.max(0, NET - HALF_SE - STD - QBI_NO_SEHI.deduction);
const TAX_WITH = taxFromBrackets(TI_WITH, FED_BRACKETS_2025);
const TAX_WITHOUT = taxFromBrackets(TI_WITHOUT, FED_BRACKETS_2025);
const TAX_SAVED = TAX_WITHOUT - TAX_WITH;
const TAX_SAVED_PCT = (TAX_SAVED / SEHI) * 100;
const QBI_GIVEN_BACK = QBI_NO_SEHI.deduction - QBI_WITH_SEHI.deduction;

/* ---- The month ledger: mid-year exit ---------------------------------------- */
/* Same person, alternate year: they fold the practice August 1 and join a firm
   whose subsidized plan they are eligible for from day one. They paid the
   marketplace premium through August (8 payments) before cancelling. */
const EXIT = { profit: 58_000, eligibleMonths: 7, paidMonths: 8 };
const SE_EXIT = seTaxOnNet(EXIT.profit);
const HALF_SE_EXIT = (SE_EXIT - addlMedicareSE(EXIT.profit)) / 2;
const CAP_EXIT = Math.max(0, EXIT.profit * SE_BASE - HALF_SE_EXIT);
const ALLOWED_EXIT = EXIT.eligibleMonths * MONTHLY;
const SEHI_EXIT = Math.min(ALLOWED_EXIT, CAP_EXIT);
const OVERLAP_EXCLUDED = (EXIT.paidMonths - EXIT.eligibleMonths) * MONTHLY;
const MONTHS_FOREGONE = PREMIUM - SEHI_EXIT;
/* The ledger rows the prose walks. */
const LEDGER = [
  { stretch: 'Jan – Jul', months: EXIT.eligibleMonths, paid: EXIT.eligibleMonths * MONTHLY, eligible: true },
  { stretch: 'Aug', months: 1, paid: MONTHLY, eligible: false },
  { stretch: 'Sep – Dec', months: 4, paid: 0, eligible: false },
];

/* ---- The thin-profit year: the cap binds ------------------------------------ */
const THIN_NET = 9_600;
const SE_THIN = seTaxOnNet(THIN_NET);
const HALF_SE_THIN = (SE_THIN - addlMedicareSE(THIN_NET)) / 2;
const CAP_THIN = Math.max(0, THIN_NET * SE_BASE - HALF_SE_THIN);
const SEHI_THIN = Math.min(PREMIUM, CAP_THIN);
const EXCESS_THIN = PREMIUM - SEHI_THIN;

/* ---- The >2% S-corp shareholder channel (W-2 arithmetic) -------------------- */
const SCORP = { salary: 70_000, monthly: 650 };
const SC_PREMIUM = SCORP.monthly * 12;
const BOX1 = SCORP.salary + SC_PREMIUM;
const FICA_RATE = PAYTYPE_CONSTANTS.ssRate + PAYTYPE_CONSTANTS.medicareRate; // 7.65%
const FICA_SAVED_EE = SC_PREMIUM * FICA_RATE;
const FICA_SAVED_BOTH = 2 * FICA_SAVED_EE;
const FICA_PAIR_RATE = 2 * FICA_RATE; // both halves of FICA: 15.3%
const FICA_AT_PERSONA = PREMIUM * FICA_PAIR_RATE; // FICA pair on the persona's own premium

/* ---- The HSA stack (2025 limits, Rev. Proc. 2024-25) ------------------------ */
const HSA_SELF = hsaLimitFor('self', false);
const HSA_FAMILY = hsaLimitFor('family', false);
const HSA_FAMILY_55 = hsaLimitFor('family', true);

/**
 * Guide body for /guides/self-employed-health-insurance/ — the decision
 * playbook for buying coverage as a self-employed filer: what §162(l) allows
 * above the line, the three ceilings that can take it away (net earnings, the
 * month-eligibility ledger, coverage scope), the 20% QBI give-back the
 * deduction triggers, the >2% S-corp shareholder's FICA-excluded W-2 channel,
 * and where the HSA fits beside the premium.
 *
 * Rendering contract (GuideShell): the shell supplies h1, reading time, the
 * prose column, and the closing instrument panel — this component starts at
 * plain paragraphs and h2 and renders through the shared .prose-article
 * tokens. Server-component safe: no hooks, no event handlers.
 */
export default function SelfEmployedHealthInsuranceGuide() {
  const toc = [
    { id: 'mechanics', label: 'What §162(l) actually gives you' },
    { id: 'ceilings', label: 'The three ceilings' },
    { id: 'month-ledger', label: 'The month ledger: leaving mid-year' },
    { id: 'qbi-give-back', label: 'The QBI give-back: 20 cents on the dollar' },
    { id: 'two-percent', label: 'The >2% S-corp shareholder channel' },
    { id: 'hsa', label: "Where the HSA fits (and where it doesn't)" },
    { id: 'decision', label: 'The decision sequence' },
  ];

  return (
    <>
      <ArticleToc items={toc} />

      <p>
        <strong>
          Buy the coverage, then defend the deduction: the self-employed health
          insurance deduction under §162(l) is worth full marginal-rate money
          against your income tax — but it stops at the business&apos;s net earnings,
          at the last month you were eligible for any employer&apos;s subsidized plan,
          and at the people the statute will insure. And every dollar you deduct
          hands twenty cents back through the QBI deduction.
        </strong>{' '}
        On this guide&apos;s worked persona — a solo consultant with{' '}
        {usd(NET, 0)} of Schedule C net profit and a family plan at{' '}
        {usd(MONTHLY, 0)} a month — the premium of{' '}
        <strong>{usd(PREMIUM, 0)}</strong> clears the earned-income ceiling of{' '}
        {usd(SEHI_CAP, 0)} easily and deducts in full, yet saves only{' '}
        <strong>{usd(TAX_SAVED)} of federal income tax</strong> —{' '}
        {pct(TAX_SAVED_PCT, 1)} of the face — because{' '}
        <strong>{usd(QBI_GIVEN_BACK, 0)} of §199A deduction</strong> disappears
        with it. Fold the practice in August and the same year deducts just{' '}
        <strong>{usd(SEHI_EXIT, 0)}</strong> of the premiums actually paid. Route
        coverage behind a &gt;2% S-corp shareholder&apos;s W-2 and{' '}
        {pct(FICA_PAIR_RATE * 100, 1)} of the premium the corporation reports
        comes back as FICA never paid — <strong>{usd(FICA_SAVED_BOTH)} a
        year</strong> on the {usd(SCORP.monthly, 0)}-a-month group plan the
        S-corp section prices, {usd(FICA_AT_PERSONA)} at the persona&apos;s
        individual-market rate. Every number
        in this guide is computed by the suite&apos;s engines on stated inputs; the
        decisions are yours.
      </p>

      {/* ================================================================== */}
      <h2 id="mechanics">What §162(l) actually gives you</h2>
      {/* ================================================================== */}
      <p>
        Employees never see health premiums in taxable income — §106 excludes
        them. The self-employed have no employer to exclude anything, so §162(l)
        does the next best thing: it lets a sole proprietor, partner, or LLC
        member deduct {pct(100, 0)} of qualifying medical-insurance premiums{' '}
        <em>above the line</em> — on Schedule 1 of Form 1040 (line 17 in recent
        years), before adjusted gross income, whether or not you itemize. Full
        deductibility arrived in two steps: the statutory applicable-percentage
        ramp — 40% of premiums in 1997, rising to 100% from 2007 — and then the
        Health Care and Education Reconciliation Act of 2010 (P.L. 111-152),
        which restated the rule as a flat deduction for the full amount paid and
        widened the insured pool. Above the line is the valuable half of the
        mechanism: it reduces AGI for every AGI-keyed rule that follows, not
        just the tax bracket.
      </p>
      <p>
        What counts as qualifying insurance is broader than most people quote
        and narrower than most people assume. Medical, dental, and vision
        premiums all qualify — they are medical care under §213(d). Medicare
        Part B and Part D premiums you pay while still self-employed qualify.
        COBRA premiums paid at the full, unsubsidized rate generally qualify for
        the months you were self-employed.
        Long-term-<em>care</em> premiums qualify, but only up to the age-banded
        eligible-premium caps of §213(d)(10), which are small and adjust
        annually by revenue procedure — an LTC policy is not a way to deduct
        unlimited premium. And the deduction covers only the premium you
        actually paid: a marketplace advance premium tax credit is not a premium
        you paid, so the deductible amount is the net figure on your Form 1095-A.
      </p>
      <p>
        The scope of <em>who</em> is insured matters as much as what is insured.
        §162(l)(1) covers the taxpayer, the taxpayer&apos;s spouse, and dependents;
        a child who is under 27 at the end of the year counts even if they are
        no longer a dependent under §152 (§162(l)(1)(D)). Premiums for a parent,
        or for an adult child past 27, do not enter §162(l) at all — if you pay
        those, the only route is Schedule A, where medical expenses must clear
        the 7.5%-of-AGI floor.
      </p>
      <p>
        One structural fact decides most of what follows: the §162(l) deduction
        happens <strong>after</strong> self-employment tax, not before. It is not
        a Schedule C business expense, so the premium never reduces the SE-tax
        base. The engines make the size of that structural choice explicit: on{' '}
        {usd(NET, 0)} of net profit the persona&apos;s SE tax is{' '}
        {usd(SE_TAX)} (Schedule SE: {pct(SE_BASE * 100, 2)} of net × 15.3% under
        the {usd(PAYTYPE_CONSTANTS.ssWageBase, 0)} wage base). If the{' '}
        {usd(PREMIUM, 0)} premium <em>were</em> a Schedule C expense, that same
        engine would compute {usd(SE_IF_EXPENSE)} — a difference of{' '}
        <strong>{usd(SE_TAX_UNTOUCHED)}</strong> of SE tax the above-the-line
        structure leaves in place. Keep that number in mind; it is the same
        structural money the S-corp channel in a later section recovers.
      </p>

      {/* ================================================================== */}
      <h2 id="ceilings">The three ceilings</h2>
      {/* ================================================================== */}
      <p>
        §162(l) is generous in rate and strict in limits. Three separate
        ceilings can take the deduction away, and they compound — the allowed
        amount is the premium after the scope and month tests, capped at the
        earned-income ceiling:
      </p>
      <table>
        <thead>
          <tr>
            <th>Ceiling</th>
            <th>Authority</th>
            <th>What it cuts</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Net earnings from the business</td>
            <td>§162(l)(2)(A), via §1402(a)</td>
            <td>
              The whole deduction, to {pct(SE_BASE * 100, 2)} of net profit
              minus the deductible half of SE tax
            </td>
          </tr>
          <tr>
            <td>Any month eligible for a subsidized employer plan — yours or your spouse&apos;s</td>
            <td>§162(l)(2)(B)</td>
            <td>
              That month&apos;s premiums, month by month, even if you never enrolled
            </td>
          </tr>
          <tr>
            <td>Whose coverage the premium buys</td>
            <td>§162(l)(1); §213(d)(10) for LTC</td>
            <td>
              Premiums for non-dependents, and LTC premiums above the age bands
            </td>
          </tr>
        </tbody>
      </table>
      <p>
        The first ceiling is arithmetic, and the suite already runs it: the
        1099-vs-W-2 calculator applies the same{' '}
        <code>min(premium, 92.35% × net − ½ SE tax)</code> cap the IRS worksheet
        prescribes. On the persona it is not close — the cap computes to{' '}
        <strong>{usd(SEHI_CAP)}</strong> against a {usd(PREMIUM, 0)} premium, so
        the full premium deducts. Note the non-circularity the formula encodes:
        the cap is measured <em>before</em> subtracting the SEHI deduction
        itself, and the deduction can never create or increase a net operating
        loss (IRS Publication 535). What the cap <em>does</em> bind on is the
        launch year or a bad year — the same person with only{' '}
        {usd(THIN_NET, 0)} of net profit has a SE tax of {usd(SE_THIN)}, a
        ceiling of <strong>{usd(CAP_THIN)}</strong>, and deducts{' '}
        {usd(SEHI_THIN)} — leaving {usd(EXCESS_THIN)} of premium with no
        above-the-line home. That excess does not vanish: it can be carried to
        Schedule A as a §213 medical expense, where the 7.5%-of-AGI floor
        usually eats most of it. In a thin year, the honest planning answer is
        not a deduction trick but a smaller premium or a marketplace subsidy
        recalculated at the real income.
      </p>
      <p>
        The second ceiling is the one filers actually trip on, and it is
        calendar-shaped — the next section gives it a full worked example. The
        third is preventive: before you put a family member on your plan and
        call it a business deduction, confirm they are a spouse, a dependent, or
        an under-27 child, and confirm any LTC component sits inside the
        §213(d)(10) age band for the insured&apos;s age at year end.
      </p>

      {/* ================================================================== */}
      <h2 id="month-ledger">The month ledger: leaving mid-year</h2>
      {/* ================================================================== */}
      <p>
        §162(l)(2)(B) does not ask whether you <em>enrolled</em> in an
        employer&apos;s plan; it asks whether you were <em>eligible</em> to
        participate in a subsidized one — maintained by an employer of yours or
        of your spouse — in a given month. Any month the answer is yes, that
        month&apos;s premium is out. (The American Rescue Plan Act suspended this
        rule for 2021 and 2022 only; it applies again from 2023 on.) Run the
        persona through a mid-year exit — the practice folds August 1, the new
        employer&apos;s subsidized plan covers them from day one, and the
        marketplace premium was paid through August before the cancellation
        landed:
      </p>
      <table>
        <thead>
          <tr>
            <th>Stretch</th>
            <th>Months</th>
            <th>Premium paid</th>
            <th>§162(l) status</th>
            <th>Counts</th>
          </tr>
        </thead>
        <tbody>
          {LEDGER.map((row) => (
            <tr key={row.stretch}>
              <td>{row.stretch}</td>
              <td>{row.months}</td>
              <td>{usd(row.paid, 0)}</td>
              <td>
                {row.eligible
                  ? 'Eligible — self-employed, no subsidized plan available'
                  : 'Ineligible — eligible for the employer\u2019s subsidized plan (§162(l)(2)(B))'}
              </td>
              <td>{row.eligible ? usd(row.paid, 0) : usd(0, 0)}</td>
            </tr>
          ))}
          <tr>
            <td><strong>Year</strong></td>
            <td><strong>12</strong></td>
            <td><strong>{usd(EXIT.paidMonths * MONTHLY, 0)}</strong></td>
            <td>—</td>
            <td><strong>{usd(SEHI_EXIT, 0)}</strong></td>
          </tr>
        </tbody>
      </table>
      <p>
        The engine side of that ledger: the Schedule C profit earned while
        actually practicing was {usd(EXIT.profit, 0)}, SE tax on it computes to{' '}
        {usd(SE_EXIT)}, and the earned-income ceiling is therefore{' '}
        {usd(CAP_EXIT)} — far above the {usd(ALLOWED_EXIT, 0)} of eligible-month
        premium, so the cap does not bind and the allowed deduction is exactly
        the seven eligible months. Two numbers in that table are decisions, not
        arithmetic. The <strong>{usd(OVERLAP_EXCLUDED, 0)} August premium</strong>{' '}
        was paid and is not deductible — eligibility started on the 1st, so the
        month is gone even though the coverage overlapped. And against a
        full-employment year&apos;s {usd(PREMIUM, 0)}, the exit removes{' '}
        {usd(MONTHS_FOREGONE, 0)} of deduction — money that belongs to the
        coordination calendar, not the tax return: a spouse&apos;s open-enrollment
        window and your own hire dates are the inputs, and the substantiation is
        a dated offer letter or eligibility notice, not a memory of when the
        employer plan started.
      </p>

      {/* ================================================================== */}
      <h2 id="qbi-give-back">The QBI give-back: 20 cents on the dollar</h2>
      {/* ================================================================== */}
      <p>
        Most explainers stop at &ldquo;premiums are above the line.&rdquo; For a
        pass-through owner they are also inside the §199A machinery: qualified
        business income is reduced by exactly three owner-level items — half of
        SE tax, the §162(l) health deduction, and §404 retirement contributions
        (§199A(c)(1); the suite&apos;s QBI engine documents and applies the same
        list). So the SEHI deduction buys income-tax relief with one hand and
        gives back QBI deduction with the other. The{' '}
        <a href="/qbi-deduction-calculator/">QBI deduction calculator</a>&apos;s
        engine, run both ways on the persona:
      </p>
      <table>
        <thead>
          <tr>
            <th>Line</th>
            <th>Premium deducted (§162(l))</th>
            <th>No premium deduction</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>QBI base (net − ½ SE − SEHI)</td>
            <td>{usd(NET - HALF_SE - SEHI)}</td>
            <td>{usd(NET - HALF_SE)}</td>
          </tr>
          <tr>
            <td>20% tentative deduction</td>
            <td>{usd(QBI_WITH_SEHI.tentativeDeduction)}</td>
            <td>{usd(QBI_NO_SEHI.tentativeDeduction)}</td>
          </tr>
          <tr>
            <td>Taxable-income cap (20% × TI)</td>
            <td>{usd(QBI_WITH_SEHI.incomeCap)}</td>
            <td>{usd(QBI_NO_SEHI.incomeCap)}</td>
          </tr>
          <tr>
            <td><strong>§199A deduction</strong></td>
            <td><strong>{usd(QBI_WITH_SEHI.deduction)}</strong></td>
            <td><strong>{usd(QBI_NO_SEHI.deduction)}</strong></td>
          </tr>
          <tr>
            <td>Federal income tax after all deductions</td>
            <td>{usd(TAX_WITH)}</td>
            <td>{usd(TAX_WITHOUT)}</td>
          </tr>
        </tbody>
      </table>
      <p>
        Read the deltas, not the rows. The QBI deduction falls by{' '}
        <strong>{usd(QBI_GIVEN_BACK)} — precisely {pct(QBI_CONSTANTS.qbiRate * 100, 0)} of the{' '}
        {usd(PREMIUM, 0)} premium</strong> (both limits drop in lockstep because
        the SEHI amount enters the base and the cap together, so the engine
        shows the same {usd(QBI_GIVEN_BACK)} whichever side binds). Federal
        income tax falls by <strong>{usd(TAX_SAVED)}</strong> — the bracket
        blend of the deduction, minus the QBI clawback — which is{' '}
        {pct(TAX_SAVED_PCT, 1)} of the premium&apos;s face. Below the{' '}
        {usd(QBI_CONSTANTS.threshold.single, 0)} single-filer threshold the rule of thumb is exact and
        portable: <strong>every dollar of SEHI costs 20 cents of §199A
        deduction</strong>, so the deduction is worth about 80% of your marginal
        bracket, not 100% of it. At a 24% bracket that is 19.2 cents on the
        dollar, not 24. This does not make the deduction optional — you pay the
        premium either way — but it does matter at the margin: it is the reason
        an HSA dollar (the HSA section below) is a strictly cleaner deduction
        than a premium dollar, and the reason a full-size premium in a thin
        year buys less deduction than its face suggests.
      </p>

      {/* ================================================================== */}
      <h2 id="two-percent">The &gt;2% S-corp shareholder channel</h2>
      {/* ================================================================== */}
      <p>
        Everything above describes sole proprietors and partners. An S
        corporation owner holding more than 2% of the stock is neither — §1372(b)
        treats them as a partner for fringe-benefit purposes, and that re-routing
        creates a different, better pipe for the same premium. When the
        corporation pays or reimburses the shareholder&apos;s health premiums, the
        amount is added to their W-2 as wages (Rev. Rul. 91-26; Notice 2008-1) —
        <strong> but not as FICA wages</strong>: it goes in Box 1 and is excluded
        from Boxes 3 and 5, so it never touches Social Security or Medicare tax.
        The shareholder then claims the same §162(l) above-the-line deduction on
        the 1040, with the earned-income ceiling measured from the S
        corporation&apos;s wages and pass-through income.
      </p>
      <p>
        Reprice the persona&apos;s family coverage on the small-group market —{' '}
        {usd(SCORP.monthly, 0)} a month, against the {usd(MONTHLY, 0)} the
        individual market charges — and put it behind a &gt;2%
        shareholder&apos;s W-2 with a {usd(SCORP.salary, 0)} salary:
      </p>
      <ul>
        <li>
          W-2 Box 1: {usd(SCORP.salary, 0)} salary + {usd(SC_PREMIUM, 0)} premium
          = <strong>{usd(BOX1, 0)}</strong> of taxable wages
        </li>
        <li>
          FICA wages (Boxes 3/5): <strong>{usd(SCORP.salary, 0)}</strong> — the
          premium is excluded (Notice 2008-1)
        </li>
        <li>
          FICA not paid on the premium: {usd(FICA_SAVED_EE)} employee half +{' '}
          {usd(FICA_SAVED_EE)} employer match ={' '}
          <strong>{usd(FICA_SAVED_BOTH)} a year</strong> at the{' '}
          {pct(FICA_RATE * 100, 2)} combined rate
        </li>
        <li>
          §162(l) deduction on the 1040: the full {usd(SC_PREMIUM, 0)}, far under
          the {usd(SCORP.salary, 0)} of wages that measure the ceiling
        </li>
      </ul>
      <p>
        The recovery scales with whatever premium the corporation reports —{' '}
        {pct(FICA_PAIR_RATE * 100, 1)} of it, {usd(FICA_SAVED_BOTH)} on the{' '}
        {usd(SC_PREMIUM, 0)} group plan here, {usd(FICA_AT_PERSONA)} at the
        persona&apos;s individual-market rate. That FICA recovery is the same{' '}
        {usd(SE_TAX_UNTOUCHED, 0)}-scale money a sole proprietor cannot reach —
        the SE-tax base keeps the whole premium no matter what §162(l) does. The channel has hard edges, and
        they are documentation edges: the <em>corporation</em> must pay or
        reimburse the premiums and report them on the W-2; a shareholder who
        pays the policy personally and is never reimbursed gets none of this —
        those premiums fall to Schedule A and its 7.5% floor. And &gt;2%
        shareholders cannot run premiums or HSA contributions through a §125
        cafeteria-plan salary reduction; the W-2 route is the only pre-tax
        route. The <a href="/s-corp-tax-calculator/">S-Corp tax calculator</a>{' '}
        owns the full salary-versus-distribution arithmetic this channel sits
        inside, and the{' '}
        <a href="/guides/paying-yourself-from-your-business/">paying-yourself
        guide</a> covers the reasonable-salary constraint that gates it.
      </p>

      {/* ================================================================== */}
      <h2 id="hsa">Where the HSA fits (and where it doesn&apos;t)</h2>
      {/* ================================================================== */}
      <p>
        A high-deductible plan and a Health Savings Account are two purchases
        that touch at exactly one point: the HDHP makes you HSA-eligible. The
        premium and the contribution are otherwise separate deductions with
        separate rules. The HDHP premium goes through §162(l) exactly as any
        other medical premium — deduct it above the line, month by month, under
        the three ceilings. The HSA contribution goes through §223: its own
        above-the-line deduction, its own limits — for 2025,{' '}
        <strong>{usd(HSA_SELF, 0)} self-only, {usd(HSA_FAMILY, 0)} family, plus
        the statutory {usd(HSA_CONSTANTS.catchUp55, 0)} catch-up from age 55</strong> ({numFmt(HSA_FAMILY_55)}{' '}
        for a 55+ family-coverage holder, the engine&apos;s own limit function).
        One does not consume the other: funding the HSA does not reduce the
        premium deduction, and paying the premium does not reduce the HSA limit.
      </p>
      <p>
        Two asymmetries decide the funding order. First, HSA dollars generally
        cannot buy the premium: §223(d)(2) treats insurance premiums as
        non-qualified except in four narrow cases — eligible long-term-care
        premiums within the same §213(d)(10) age bands, COBRA continuation
        coverage, health coverage bought during unemployment-compensation
        weeks, and post-65 non-Medicare retiree coverage. Pay the premium with
        taxable cash; keep HSA dollars for care. Second, the QBI treatment
        differs: §199A(c)(1) reduces QBI by the §162(l) deduction but not by
        §223 contributions — so an HSA dollar keeps its full income-tax
        deduction while a premium dollar hands back 20 cents, as the section
        above computed. Together they make the order obvious: deduct the premium
        you must pay anyway, then fill the {usd(HSA_FAMILY, 0)} family limit
        before any other optional dollar. The{' '}
        <a href="/hsa-calculator/">HSA calculator</a> prices the account itself;
        the{' '}
        <a href="/guides/retirement-for-the-self-employed/">retirement guide</a>{' '}
        places it in the full contribution stack. One edge case repeats from
        the S-corp section: a &gt;2% shareholder cannot use salary reduction to
        fund the HSA — contribute personally and deduct under §223 instead.
      </p>

      {/* ================================================================== */}
      <h2 id="decision">The decision sequence</h2>
      {/* ================================================================== */}
      <p>
        The framework, compressed into the order the decisions actually arrive:
      </p>
      <div className="my-8 grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-indigo-200 bg-indigo-50 p-5 dark:border-indigo-500/20 dark:bg-indigo-500/10">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-indigo-700 dark:text-indigo-300">
            <CalendarCheck className="h-4 w-4" aria-hidden="true" />
            Build the month ledger first
          </div>
          <div className="mt-2 text-sm leading-relaxed text-indigo-900 dark:text-indigo-100">
            Before paying January&apos;s premium, map all twelve months against your
            and your spouse&apos;s employer-plan eligibility. The ledger above is the
            format; the offer letters are the evidence. A month you were merely
            eligible is a month already gone.
          </div>
        </div>
        <div className="rounded-2xl border border-sky-200 bg-sky-50 p-5 dark:border-sky-500/20 dark:bg-sky-500/10">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-sky-700 dark:text-sky-300">
            <Building2 className="h-4 w-4" aria-hidden="true" />
            Route the payment through the right entity
          </div>
          <div className="mt-2 text-sm leading-relaxed text-sky-900 dark:text-sky-100">
            Sole proprietor: any account, keep the statements. &gt;2% S-corp
            shareholder: the corporation pays or reimburses and reports the
            premium on the W-2 — Box 1 in, FICA out. Personally-paid,
            unreimbursed premiums get the worst of both worlds.
          </div>
        </div>
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 dark:border-emerald-500/20 dark:bg-emerald-500/10">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
            <Layers className="h-4 w-4" aria-hidden="true" />
            Stack the above-the-line items in order
          </div>
          <div className="mt-2 text-sm leading-relaxed text-emerald-900 dark:text-emerald-100">
            Premium under §162(l), HSA under §223, retirement under §404 — three
            separate deductions, all above the line, all reducing QBI except the
            HSA. The premium is forced spending, so deduct it as incurred; when
            cash is short, the optional dollar goes to the HSA first — the only
            one of the three whose deduction §199A leaves whole.
          </div>
        </div>
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 dark:border-amber-500/20 dark:bg-amber-500/10">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-300">
            <Scale className="h-4 w-4" aria-hidden="true" />
            Re-test the ceiling when profit is thin
          </div>
          <div className="mt-2 text-sm leading-relaxed text-amber-900 dark:text-amber-100">
            The cap is {pct(SE_BASE * 100, 2)} of net minus ½ SE tax — on{' '}
            {usd(THIN_NET, 0)} of net it held the deduction to {usd(CAP_THIN)}{' '}
            against a {usd(PREMIUM, 0)} premium. In a thin year the fix is a
            smaller premium or a recalculated subsidy, not a Schedule A hope.
          </div>
        </div>
      </div>
      <p>
        Boundaries, stated plainly. All parameters are tax-year 2025 federal
        figures — the {usd(STD, 0)} standard deduction per P.L. 119-21 §70103,
        the {usd(PAYTYPE_CONSTANTS.ssWageBase, 0)} wage base, the §199A
        thresholds per Rev. Proc. 2024-40, HSA limits per Rev. Proc. 2024-25.
        The persona is a single filer with one business and no other income; a
        second job, a spouse&apos;s income, or multiple trades change the month
        ledger and the QBI arithmetic in kind, not in method. No state income
        tax, no premium-tax-credit clawback modeling, no Additional Medicare
        layer is priced into the worked numbers. This is an illustrative
        decision framework built on the same engines the instruments run —
        verify your own year&apos;s figures against the current forms before you
        file, and treat the boundary cases (LTC bands, subsidy clawbacks,
        mid-year marriages and hires) as questions for the return itself.
      </p>
    </>
  );
}

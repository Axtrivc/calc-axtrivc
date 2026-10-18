import Faq from '@/components/Faq';
import { ArticleToc, RelatedCalculators } from '@/components/Article';
import { computeEstimatedTax, seTaxOf, EST_CONSTANTS, QUARTERS_2025 } from '@/lib/estimated';
import { numFmt, pct, usd } from '@/lib/format';

/** Worked-example scenario — identical to the calculator's defaults. */
const EXAMPLE = computeEstimatedTax({
  netSE: 100000,
  filingStatus: 'single',
  w2Withholding: 0,
  priorTax: 19500,
  priorAgiOver150k: false,
});

/** Worked example B — high earner under the 110% prior-year harbor (the calculator's "High earner" preset). */
const EXAMPLE_HIGH = computeEstimatedTax({
  netSE: 300000,
  filingStatus: 'single',
  w2Withholding: 0,
  priorTax: 52000,
  priorAgiOver150k: true,
});
/** SE base (92.35% × $300k) for example B's table row. */
const EXAMPLE_HIGH_SE_BASE = seTaxOf(300000).seBase;
/** Example B's binding harbor: 110% × $52,000 (prior tax known, so not null in practice). */
const EXAMPLE_HIGH_PRIOR110 = EXAMPLE_HIGH.prior110 ?? 0;

/** Worked example C — side-hustle income against W-2 withholding (the "Side hustle + W-2 job" preset). */
const EXAMPLE_SIDE = computeEstimatedTax({
  netSE: 60000,
  filingStatus: 'single',
  w2Withholding: 9000,
  priorTax: 14200,
  priorAgiOver150k: false,
});

/** FAQ scenarios: prior-year tax unknown; first year with zero prior tax; MFJ on the default income. */
const UNKNOWN_PRIOR = computeEstimatedTax({
  netSE: 100000,
  filingStatus: 'single',
  w2Withholding: 0,
  priorTax: null,
  priorAgiOver150k: false,
});
const FIRST_YEAR = computeEstimatedTax({
  netSE: 95000,
  filingStatus: 'single',
  w2Withholding: 0,
  priorTax: 0,
  priorAgiOver150k: false,
});
const MFJ_SAME_INCOME = computeEstimatedTax({
  netSE: 100000,
  filingStatus: 'mfj',
  w2Withholding: 0,
  priorTax: 19500,
  priorAgiOver150k: false,
});

/** Marginal SE-tax cents per dollar of net profit, below and above the SS wage base. */
const SE_CENTS_BELOW = EST_CONSTANTS.seRate * EST_CONSTANTS.seBaseFactor * 100;
const SE_CENTS_ABOVE = EST_CONSTANTS.medicareRate * EST_CONSTANTS.seBaseFactor * 100;

/**
 * Flip points from a $1-step scan of net SE income through this page's engine
 * (lib/estimated.ts, compiled and run offline): each value is the FIRST income
 * at which the new condition holds — the dollar after the last income where the
 * old one still did. Method documented in "Decision boundaries" below.
 */
const SCAN = {
  seFloorNetSE: 434,
  deMinimisNetSE: 7078,
  wageBaseNetSE: 190688,
  qbiStartSingle: 227009,
  qbiEndSingle: 277687,
  qbiStartMfj: 442950,
  qbiEndMfj: 544307,
  priorBinds19500: 96847,
  priorBinds57200: 240178,
} as const;

export default function EstimatedTaxArticle() {
  const toc = [
    { id: 'workflow', label: 'The 1040-ES workflow' },
    { id: 'safe-harbors', label: 'The three safe harbors, exactly' },
    { id: 'worked-example', label: 'Worked example at $100k' },
    { id: 'worked-example-high', label: 'A second example at $300k' },
    { id: 'worked-example-withholding', label: 'A third example with withholding' },
    { id: 'annualized', label: 'The annualized income method' },
    { id: 'boundaries', label: 'Decision boundaries' },
    { id: 'mistakes', label: 'Common mistakes' },
    { id: 'penalty', label: 'How the penalty actually works' },
    { id: 'glossary', label: 'Glossary' },
    { id: 'caveats', label: 'Caveats & scope' },
    { id: 'faq', label: 'FAQ' },
  ];

  return (
    <article className="prose-article">
      <ArticleToc items={toc} />

      <h2 id="workflow">The 1040-ES workflow</h2>
      <p>
        The US income tax is a pay-as-you-go system. Employees satisfy it through withholding;
        everyone else — sole proprietors, freelancers, partners, S-corp owners on their K-1 slice —
        satisfies it through <strong>estimated tax</strong>, paid in four installments on{' '}
        <strong>April 15, June 15, September 15, and January 15</strong> of the following year (for
        2025: Apr 15 / Jun 16 / Sep 15, 2025 and Jan 15, 2026 — Q2 shifted because June 15 fell on
        a Sunday). IRS <strong>Form 1040-ES</strong> is the worksheet and payment voucher set that
        sizes those installments.
      </p>
      <p>The worksheet itself is a straight line of arithmetic:</p>
      <ol>
        <li>
          <strong>Forecast this year&apos;s tax.</strong> Start from expected net self-employment
          profit. Compute SE tax on 92.35% of it ({pct(EST_CONSTANTS.seRate * 100, 1)} up to the{' '}
          {numFmt(EST_CONSTANTS.ssWageBase, 0)} wage base,{' '}
          {pct(EST_CONSTANTS.medicareRate * 100, 1)} above), deduct half of SE tax, then the
          standard deduction, then the {pct(EST_CONSTANTS.qbiRate * 100, 0)} QBI deduction, and run
          what&apos;s left through the brackets. SE tax + income tax = this year&apos;s total.
        </li>
        <li>
          <strong>Pick a safe harbor.</strong> You must prepay the <em>lesser</em> of 90% of this
          year&apos;s number or a floor based on <em>last</em> year&apos;s tax (the three-line menu
          in the next section). Pay either one in full and there is no penalty — even if you
          massively under-withheld relative to what you finally owe on April 15.
        </li>
        <li>
          <strong>Subtract withholding.</strong> W-2 withholding (yours or a spouse&apos;s on a
          joint return) counts toward the requirement, and it counts as paid <em>evenly</em> across
          the year regardless of when it was actually withheld.
        </li>
        <li>
          <strong>Divide by four.</strong> What remains is four equal installments. Pay by check,
          IRS Direct Pay, or EFTPS — with Direct Pay, select &ldquo;Estimated Tax&nbsp;1040-ES&rdquo;
          as the reason, not &ldquo;Balance Due,&rdquo; or the payment posts to the wrong bucket.
        </li>
      </ol>
      <p>
        Two exits exist before any of this matters: if you expect to owe less than $1,000 for the
        year after withholding, no installments are required at all; and if last year was a 12-month
        tax year in which you were a US citizen/resident with <strong>zero</strong> tax, no penalty
        can apply this year no matter what you prepay.
      </p>

      <h2 id="safe-harbors">The three safe harbors, exactly</h2>
      <p>
        &ldquo;Safe harbor&rdquo; is IRC §6654(d) language: prepay this much, in four timely
        installments, and the underpayment penalty cannot touch you. There are three lines:
      </p>
      <ul>
        <li>
          <strong>90% of the current year&apos;s tax.</strong> The precise-but-fragile option: it
          always exactly covers what you owe, but it requires forecasting income you
          don&apos;t fully know yet.
        </li>
        <li>
          <strong>100% of last year&apos;s tax.</strong> The lazy-but-bulletproof option: copy one
          number off your prior Form 1040. It only works if the prior year was a 12-month year and
          you were a US citizen or resident for all of it.
        </li>
        <li>
          <strong>110% of last year&apos;s tax</strong> — replaces the 100% line when your{' '}
          <em>prior-year</em> AGI exceeded $150,000. Not a choice: above that AGI the 100% line
          simply stops being available. ($75,000 is the threshold for married-filing-separately,
          which this tool does not model.)
        </li>
      </ul>
      <p>
        The required annual payment is the <strong>lesser</strong> of the applicable prior-year
        line and the 90% line. That &ldquo;lesser&rdquo; is where the planning lives:
      </p>
      <ul>
        <li>
          <strong>Income rising?</strong> 90% of this year is more than 100%/110% of the smaller
          last year — the prior-year harbor lets you prepay less and settle the rest on April 15,
          penalty-free. At high incomes this is essentially interest-free deferral of 10%+ of a
          growing tax bill.
        </li>
        <li>
          <strong>Income falling?</strong> 90% of the smaller current year beats the prior-year
          floor — switch to the 90% line rather than mailing the IRS an interest-free loan.
        </li>
        <li>
          <strong>Withholding is a wildcard.</strong> Because it is deemed paid ratably, a
          spouse&apos;s job with heavy withholding can cover the entire requirement, zeroing out
          every installment — even if the withholding all landed in December.
        </li>
      </ul>
      <p>
        One trap worth naming — narrower than it first looks: the prior-year harbor uses the tax
        as it stood on last year&apos;s return as filed by the deadline. If you amended that
        return upward <em>in time</em> — on or before the original due date, extensions included
        — the amended, higher number becomes the harbor. Amend it <em>after</em> the deadline and
        the original figure still governs: per Rev. Rul. 83-36, only a timely amended return
        replaces the original for §6654 purposes, so the most common kind of upward amendment (a
        late one) never raises the harbor at all.
      </p>

      <h2 id="worked-example">Worked example at $100,000 (the calculator&apos;s defaults)</h2>
      <p>
        Single filer, {usd(100000, 0)} of Schedule C net profit, no W-2 withholding, last
        year&apos;s total tax {usd(19500, 0)}, prior-year AGI under $150,000 — tax year 2025
        federal rules:
      </p>
      <table>
        <thead>
          <tr>
            <th>Line</th>
            <th>Amount</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>SE tax — 15.3% × min(92.35% × $100k, $176,100)</td>
            <td>{usd(EXAMPLE.seTax)}</td>
          </tr>
          <tr>
            <td>AGI after ½ SE deduction</td>
            <td>{usd(EXAMPLE.agi)}</td>
          </tr>
          <tr>
            <td>QBI deduction (20%, taxable-income capped)</td>
            <td>−{usd(EXAMPLE.qbiDeduction)}</td>
          </tr>
          <tr>
            <td>Federal income tax on {usd(EXAMPLE.taxableIncome, 0)} taxable</td>
            <td>{usd(EXAMPLE.incomeTax)}</td>
          </tr>
          <tr>
            <td><strong>Current-year total tax</strong></td>
            <td><strong>{usd(EXAMPLE.currentTotalTax)}</strong></td>
          </tr>
          <tr>
            <td>90% line</td>
            <td>{usd(EXAMPLE.current90)}</td>
          </tr>
          <tr>
            <td>100% prior-year line (binding — it is lower)</td>
            <td>{usd(19500, 0)}</td>
          </tr>
          <tr>
            <td><strong>Required per installment</strong> ({usd(19500, 0)} ÷ 4)</td>
            <td><strong>{usd(EXAMPLE.perQuarter, 0)}</strong></td>
          </tr>
        </tbody>
      </table>
      <p>
        Notice the result: income rose versus last year, so the prior-year harbor binds and the
        four payments total {usd(19500, 0)} — even though the true bill will be{' '}
        {usd(EXAMPLE.currentTotalTax, 0)}. The remaining{' '}
        {usd(EXAMPLE.currentTotalTax - 19500, 0)} is paid with the return, penalty-free. Skipping
        all four installments instead would cost roughly{' '}
        <strong>{usd(EXAMPLE.penaltyEstimate)}</strong> in estimated penalties — see the penalty
        section for why that number is an estimate.
      </p>

      <h2 id="worked-example-high">
        A second worked example at $300,000 — the 110% harbor, the wage base, and lost QBI
      </h2>
      <p>
        The same mechanics change shape at the top of the range. Single filer, {usd(300000, 0)} of
        Schedule C net profit, no withholding, last year&apos;s total tax {usd(52000, 0)},
        prior-year AGI over $150,000 — the calculator&apos;s &ldquo;High earner&rdquo; preset:
      </p>
      <table>
        <thead>
          <tr>
            <th>Line</th>
            <th>Amount</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>SE base — 92.35% × $300,000</td>
            <td>{usd(EXAMPLE_HIGH_SE_BASE, 0)}</td>
          </tr>
          <tr>
            <td>
              SE tax — 15.3% to the {usd(EST_CONSTANTS.ssWageBase, 0)} base, then 2.9% on the{' '}
              {usd(EXAMPLE_HIGH_SE_BASE - EST_CONSTANTS.ssWageBase, 0)} above it
            </td>
            <td>{usd(EXAMPLE_HIGH.seTax)}</td>
          </tr>
          <tr>
            <td>AGI after ½ SE deduction</td>
            <td>{usd(EXAMPLE_HIGH.agi)}</td>
          </tr>
          <tr>
            <td>QBI deduction — fully phased out (§199A(b)(2), no W-2 wages, no qualified property)</td>
            <td>−{usd(EXAMPLE_HIGH.qbiDeduction, 0)}</td>
          </tr>
          <tr>
            <td>Federal income tax on {usd(EXAMPLE_HIGH.taxableIncome, 0)} taxable</td>
            <td>{usd(EXAMPLE_HIGH.incomeTax)}</td>
          </tr>
          <tr>
            <td><strong>Current-year total tax</strong></td>
            <td><strong>{usd(EXAMPLE_HIGH.currentTotalTax)}</strong></td>
          </tr>
          <tr>
            <td>90% line</td>
            <td>{usd(EXAMPLE_HIGH.current90)}</td>
          </tr>
          <tr>
            <td>110% prior-year line (binding — it is lower; prior AGI &gt; $150k)</td>
            <td>{usd(EXAMPLE_HIGH_PRIOR110, 0)}</td>
          </tr>
          <tr>
            <td><strong>Required per installment</strong> ({usd(EXAMPLE_HIGH_PRIOR110, 0)} ÷ 4)</td>
            <td><strong>{usd(EXAMPLE_HIGH.perQuarter, 0)}</strong></td>
          </tr>
        </tbody>
      </table>
      <p>
        Three things change shape at this income. The SE base ({usd(EXAMPLE_HIGH_SE_BASE, 0)}) has
        blown through the {usd(EST_CONSTANTS.ssWageBase, 0)} wage base, so the last dollars of
        profit carry only {numFmt(SE_CENTS_ABOVE, 2)}¢ of SE tax each instead of{' '}
        {numFmt(SE_CENTS_BELOW, 2)}¢. The QBI deduction is gone — {usd(EXAMPLE_HIGH.agi, 0)} of AGI
        puts pre-deduction taxable income past the single threshold (
        {numFmt(EST_CONSTANTS.qbiThresholdSingle, 0)}) plus its{' '}
        {numFmt(EST_CONSTANTS.qbiPhaseInRangeSingle, 0)} phase-in range, and with no W-2 wages or
        qualified property the §199A(b)(2) limitation leaves nothing to deduct. And because
        prior-year AGI exceeded $150,000, the 100% line is not on the menu: the harbor is 110% ×{' '}
        {usd(52000, 0)} = {usd(EXAMPLE_HIGH_PRIOR110, 0)}, a switch that by itself costs{' '}
        {usd(((EXAMPLE_HIGH.prior110 ?? 0) - (EXAMPLE_HIGH.prior100 ?? 0)) / 4, 0)} per
        installment ({usd((EXAMPLE_HIGH.prior110 ?? 0) - (EXAMPLE_HIGH.prior100 ?? 0), 0)} a
        year) over the unavailable 100% line. The balloon at filing is the largest in this guide —{' '}
        {usd(EXAMPLE_HIGH.expectedAtFiling, 0)} deferred, penalty-free, to April 15, 2026 — and
        skipping the four installments instead would run roughly{' '}
        <strong>{usd(EXAMPLE_HIGH.penaltyEstimate)}</strong> in estimated penalties.
      </p>

      <h2 id="worked-example-withholding">
        A third worked example: $60,000 of side income against a W-2 paycheck
      </h2>
      <p>
        Single filer with a day job, {usd(60000, 0)} of Schedule C profit, {usd(9000, 0)} of
        federal tax expected to be withheld from the paycheck, last year&apos;s total tax{' '}
        {usd(14200, 0)} — the calculator&apos;s &ldquo;Side hustle + W-2 job&rdquo; preset:
      </p>
      <table>
        <thead>
          <tr>
            <th>Line</th>
            <th>Amount</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>SE tax — 15.3% × min(92.35% × $60k, {usd(EST_CONSTANTS.ssWageBase, 0)})</td>
            <td>{usd(EXAMPLE_SIDE.seTax)}</td>
          </tr>
          <tr>
            <td>AGI after ½ SE deduction</td>
            <td>{usd(EXAMPLE_SIDE.agi)}</td>
          </tr>
          <tr>
            <td>QBI deduction (20%, taxable-income capped)</td>
            <td>−{usd(EXAMPLE_SIDE.qbiDeduction)}</td>
          </tr>
          <tr>
            <td>Federal income tax on {usd(EXAMPLE_SIDE.taxableIncome, 0)} taxable</td>
            <td>{usd(EXAMPLE_SIDE.incomeTax)}</td>
          </tr>
          <tr>
            <td><strong>Current-year total tax</strong></td>
            <td><strong>{usd(EXAMPLE_SIDE.currentTotalTax)}</strong></td>
          </tr>
          <tr>
            <td>90% line (binding — income fell versus last year)</td>
            <td>{usd(EXAMPLE_SIDE.current90)}</td>
          </tr>
          <tr>
            <td>100% prior-year line (not binding)</td>
            <td>{usd(14200, 0)}</td>
          </tr>
          <tr>
            <td>W-2 withholding, credited ratably (§6654(g))</td>
            <td>−{usd(9000, 0)}</td>
          </tr>
          <tr>
            <td><strong>Net to prepay via estimates</strong></td>
            <td><strong>{usd(EXAMPLE_SIDE.netToPayByEstimates)}</strong></td>
          </tr>
          <tr>
            <td><strong>Required per installment</strong> ({usd(EXAMPLE_SIDE.netToPayByEstimates, 0)} ÷ 4)</td>
            <td><strong>{usd(EXAMPLE_SIDE.perQuarter, 0)}</strong></td>
          </tr>
        </tbody>
      </table>
      <p>
        Here the year went the other way: last year&apos;s total tax ({usd(14200, 0)}, mostly from
        the W-2 job) exceeds 90% of this year&apos;s bill, so the lesser-of test hands the win to
        the 90% line — mailing four checks of {usd(14200 / 4, 0)} would have overpaid the
        requirement by {usd((EXAMPLE_SIDE.prior100 ?? 0) - EXAMPLE_SIDE.current90, 0)}. The{' '}
        {usd(9000, 0)} of paycheck withholding then absorbs{' '}
        {pct(EXAMPLE_SIDE.withholdingCoveragePct, 1)} of the requirement, leaving four token
        installments of {usd(EXAMPLE_SIDE.perQuarter, 0)}; cover the full{' '}
        {usd(EXAMPLE_SIDE.requiredAnnualPayment, 0)} from the paycheck and the installments
        disappear altogether. One modeled caveat, mirrored by the amber flag in the tool: the wages
        behind that withholding are not part of the 90% line&apos;s income, so for a true
        two-income household the prior-year harbor ({usd(14200, 0)} here) is the safer target.
      </p>

      <h2 id="annualized">The annualized income method</h2>
      <p>
        The four-equal-installments schedule is the <strong>regular method</strong>, and it quietly
        assumes your income arrives evenly. When it doesn&apos;t — a consultant whose entire year
        lands in Q4, a landscaper earning April–October, a founder who sold a business in June —
        equal installments demand tax in April for income not earned until fall. The fix is the{' '}
        <strong>annualized income installment method</strong>, computed on Schedule AI of Form 2210:
      </p>
      <ol>
        <li>
          The year is cut into four <em>accrual periods</em>: Jan–Mar, Jan–May, Jan–Aug, Jan–Dec —
          each cumulative window closes on Mar 31, May 31, Aug 31, and Dec 31, roughly two weeks{' '}
          <em>before</em> the matching installment date. That gap is the method&apos;s point: your
          April 15 payment only has to cover income earned through March 31.
        </li>
        <li>
          Income for each window is <strong>annualized</strong>: the cumulative total is scaled by
          the year&apos;s shape (×4, ×2.4, ×1.5, ×1 — i.e., 12/3, 12/5, 12/8, 12/12).
        </li>
        <li>
          Tax is computed on each annualized figure; each installment then owes 90% of{' '}
          <em>that period&apos;s</em> annualized tax <em>minus tax already covered</em> by earlier
          installments and ratable withholding.
        </li>
      </ol>
      <p>
        The result: a seasonal business can legitimately pay little or nothing in Q1 and catch up
        in Q3/Q4. The cost is real, though — Schedule AI is the most laborious schedule most
        individuals ever attach to a 1040, and it must be <em>attached</em>: the IRS computes your
        penalty with the regular method unless you elect annualization. This tool prices the regular
        method only; if your income is lumpy, treat its numbers as the ceiling and read Schedule
        AI&apos;s instructions before filing.
      </p>

      <h2 id="boundaries">Decision boundaries</h2>
      <p>
        This instrument fits one shape of problem: US federal tax year 2025, single or
        married-filing-jointly, income dominated by Schedule C profit that arrives roughly evenly
        through the year, and a prior-year total tax you either know or know was zero. It is the
        wrong instrument when income is lumpy (Schedule AI prices that; see above), when wages
        dominate (a W-4 withholding bump is the cheaper lever than installments), for
        married-filing-separately, for state estimated taxes (most states run their own installment
        calendars with different harbors), and for any year other than 2025 — every threshold in
        this section moves annually.
      </p>
      <p>
        The critical values below were produced by scanning the engine behind this page (
        <code>lib/estimated.ts</code>, compiled and run offline) across net SE income in $1 steps:
        for each boundary the scan reports the last income at which the old condition still holds,
        and the table shows the next dollar — the flip point. All assume a single Schedule C income
        and no withholding.
      </p>
      <table>
        <thead>
          <tr>
            <th>Boundary</th>
            <th>Net SE income</th>
            <th>What flips</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>SE tax exists at all</td>
            <td>{numFmt(SCAN.seFloorNetSE, 0)}</td>
            <td>
              92.35% × profit stays under the {usd(EST_CONSTANTS.seMinBase, 0)} SE floor, so
              Schedule C profit carries no SE tax at all — and income this small is wiped out by
              the standard deduction, which is why the installment question only wakes up at the
              next row.
            </td>
          </tr>
          <tr>
            <td>Installments required at all</td>
            <td>{numFmt(SCAN.deMinimisNetSE, 0)}</td>
            <td>
              First income whose total tax reaches the {usd(EST_CONSTANTS.deMinimisThreshold, 0)}{' '}
              de-minimis line — single and MFJ alike, because below both standard deductions SE tax
              alone sets the bill.
            </td>
          </tr>
          <tr>
            <td>Marginal SE rate drops</td>
            <td>{numFmt(SCAN.wageBaseNetSE, 0)}</td>
            <td>
              The SE base reaches the {usd(EST_CONSTANTS.ssWageBase, 0)} wage base; further dollars
              cost {numFmt(SE_CENTS_ABOVE, 2)}¢ of SE tax each instead of {numFmt(SE_CENTS_BELOW, 2)}¢.
            </td>
          </tr>
          <tr>
            <td>QBI phase-out begins</td>
            <td>
              {numFmt(SCAN.qbiStartSingle, 0)} single / {numFmt(SCAN.qbiStartMfj, 0)} MFJ
            </td>
            <td>
              Pre-QBI taxable income crosses {numFmt(EST_CONSTANTS.qbiThresholdSingle, 0)} /{' '}
              {numFmt(EST_CONSTANTS.qbiThresholdMfj, 0)}; the no-employee §199A(b)(2) limitation
              starts eroding the 20% deduction.
            </td>
          </tr>
          <tr>
            <td>QBI deduction reaches zero</td>
            <td>
              {numFmt(SCAN.qbiEndSingle, 0)} single / {numFmt(SCAN.qbiEndMfj, 0)} MFJ
            </td>
            <td>The phase-in range is exhausted; the deduction is gone (see the $300k example).</td>
          </tr>
          <tr>
            <td>Withholding alone suffices</td>
            <td>—</td>
            <td>
              Not an income boundary: withholding at or above the required annual payment zeroes
              every installment — {usd(EXAMPLE_SIDE.requiredAnnualPayment, 0)} does it in the $60k
              example above.
            </td>
          </tr>
        </tbody>
      </table>
      <p>
        The harbor choice has its own boundary, and it is pure arithmetic: the prior-year line
        stops being the cheaper option once current-year total tax exceeds the applicable prior
        line ÷ {pct(EST_CONSTANTS.safeHarborCurrentRate * 100, 0)} — that is,{' '}
        {pct((EST_CONSTANTS.safeHarborPriorRate / EST_CONSTANTS.safeHarborCurrentRate) * 100, 1)}{' '}
        of last year&apos;s tax under the 100% harbor,{' '}
        {pct((EST_CONSTANTS.safeHarborPriorHighRate / EST_CONSTANTS.safeHarborCurrentRate) * 100, 1)}{' '}
        under the 110% harbor. In dollars, from the same scan: with last year&apos;s tax at{' '}
        {usd(19500, 0)}, the prior-year harbor is the cheaper line from{' '}
        {numFmt(SCAN.priorBinds19500, 0)} of net profit upward; with last year&apos;s tax at{' '}
        {usd(52000, 0)} and prior AGI over $150,000, the 110% line takes over from{' '}
        {numFmt(SCAN.priorBinds57200, 0)}. Near those points the binding line flips on a single
        dollar of income — which is the point of the lesser-of test: the required payment is a
        moving floor, not a commitment.
      </p>

      <h2 id="mistakes">Common mistakes</h2>
      <ul>
        <li>
          <strong>Forgetting the January 15 payment.</strong> The Q4 installment for the tax year
          just ended is due <em>in the following January</em> — it feels like last year&apos;s
          problem, but skipping it is the single most common penalty trigger.
        </li>
        <li>
          <strong>Applying the 100% rule when only 110% is available.</strong> Above $150k of
          prior-year AGI the 100% line does not exist. Assuming it does leaves you 10% short of the
          harbor every quarter.
        </li>
        <li>
          <strong>Using stale 2025 deduction figures.</strong> P.L. 119-21 (July 4, 2025) set the
          2025 standard deduction at $15,750 single / $31,500 MFJ. The $15,000/$30,000 that
          Rev. Proc. 2024-40 had published for 2025 — and the $14,600/$29,200 that belongs to tax
          year 2024 — both understate the deduction and therefore overstate 2025 tax.
        </li>
        <li>
          <strong>Ignoring a spouse&apos;s withholding.</strong> On a joint return it counts toward
          your safe harbor and is deemed paid evenly — many two-income couples owe no estimates at
          all and never realize it.
        </li>
        <li>
          <strong>Not re-forecast after a big swing.</strong> Safe harbors based on last year are
          prepayment floors, not bills. A large raise in income means the deferred balance sitting
          on April 15 grows — technically penalty-free, but a cash-flow event worth planning for
          (the IRS will happily take bigger optional payments).
        </li>
        <li>
          <strong>Confusing the $1,000 rule with the $400 SE rule.</strong> SE tax itself
          doesn&apos;t exist below a $400 SE base — that is a different, much smaller threshold
          than the $1,000 de-minimis exemption from estimated payments.
        </li>
        <li>
          <strong>Paying the wrong bucket.</strong> A Direct Pay/IRS Online Account payment
          mis-coded as a &ldquo;balance due&rdquo; or applied to the wrong tax year will not show
          up against your 1040-ES installments and can generate a bogus penalty notice that takes
          months to unwind.
        </li>
      </ul>

      <h2 id="penalty">How the penalty actually works</h2>
      <p>
        The &ldquo;penalty&rdquo; is not a fine — it is <strong>interest</strong>, computed
        separately for each of the four installment periods on Form 2210: the underpaid amount for
        that period × the federal underpayment rate (federal short-term rate + 3 points —{' '}
        <strong>7% for every quarter of 2025</strong>) × days unpaid ÷ 365. It is{' '}
        <strong>simple</strong> interest: per IRM 20.1.3, the §6654 penalty &ldquo;is computed in
        the same manner as interest, except it is NOT compounded daily.&rdquo; Because each period
        is its own calculation, overpaying Q4 does not retroactively cure an underpaid Q1 — the Q1
        interest has already accrued. Withholding, uniquely, is presumed paid ratably across all
        four periods, which is why it is so effective at mopping up small underpayments.
      </p>
      <p>
        This calculator&apos;s penalty figure is close in method but cruder in inputs: it assumes
        you pay <em>nothing</em> during the year, settle on April 15, 2026, and accrue simple
        interest at a single flat 7% from each due date — which collapses to{' '}
        <code>installment × 7% × 970/365</code> since the day counts are 365 + 303 + 212 + 90 = 970.
        The real differences are the quarterly re-pricing of the rate and your actual payment
        dates, not compounding. Good enough to see what skipping costs; not a number to file
        against.
      </p>

      <h2 id="glossary">Glossary</h2>
      <p>
        The working vocabulary of Form 1040-ES, defined the way this guide and the form&apos;s own
        instructions use the terms — for a reader meeting estimated tax for the first time.
      </p>
      <dl className="mb-4">
        <dt className="mt-5 font-semibold text-slate-900 dark:text-slate-100">Estimated tax</dt>
        <dd className="mt-1 leading-relaxed text-slate-600 dark:text-slate-300">
          Prepayment of income and self-employment tax by anyone whose income carries no employer
          withholding — sole proprietors, freelancers, partners, S-corp owners on their K-1 slice.
          Paid in four installments a year rather than one check in April.
        </dd>
        <dt className="mt-5 font-semibold text-slate-900 dark:text-slate-100">Installment period</dt>
        <dd className="mt-1 leading-relaxed text-slate-600 dark:text-slate-300">
          One of the four payment windows, closing on{' '}
          {QUARTERS_2025.map((q) => q.due.replace(', 2025', '').replace(', 2026', '')).join(' / ')}.
          Not calendar quarters: the gaps between due dates are three, two, three, and four months,
          which is why the penalty accrues at different speeds per period.
        </dd>
        <dt className="mt-5 font-semibold text-slate-900 dark:text-slate-100">Required annual payment</dt>
        <dd className="mt-1 leading-relaxed text-slate-600 dark:text-slate-300">
          The §6654(d)(1) number you must prepay across the year: the lesser of 90% of this
          year&apos;s tax or the applicable prior-year line. Divide by four and you have each
          installment under the regular method.
        </dd>
        <dt className="mt-5 font-semibold text-slate-900 dark:text-slate-100">Safe harbor</dt>
        <dd className="mt-1 leading-relaxed text-slate-600 dark:text-slate-300">
          The prepayment level that makes the underpayment penalty legally impossible, however much
          you ultimately owe on April 15. Three lines exist; the applicable ones are 90% of current
          tax and 100% (or 110% above $150k prior AGI) of last year&apos;s tax.
        </dd>
        <dt className="mt-5 font-semibold text-slate-900 dark:text-slate-100">Self-employment (SE) tax</dt>
        <dd className="mt-1 leading-relaxed text-slate-600 dark:text-slate-300">
          The freelancer&apos;s version of FICA, computed on Schedule SE:{' '}
          {pct(EST_CONSTANTS.seRate * 100, 1)} on {pct(EST_CONSTANTS.seBaseFactor * 100, 2)} of net
          earnings, with the 12.4% Social Security layer capped at the wage base and the 2.9%
          Medicare layer uncapped.
        </dd>
        <dt className="mt-5 font-semibold text-slate-900 dark:text-slate-100">One-half SE tax deduction</dt>
        <dd className="mt-1 leading-relaxed text-slate-600 dark:text-slate-300">
          An above-the-line deduction for half of the SE tax — employees&apos; FICA share is
          employer-paid, so the mirror half of yours is subtracted before AGI. It lowers income tax;
          it never lowers SE tax itself.
        </dd>
        <dt className="mt-5 font-semibold text-slate-900 dark:text-slate-100">Social Security wage base</dt>
        <dd className="mt-1 leading-relaxed text-slate-600 dark:text-slate-300">
          The {usd(EST_CONSTANTS.ssWageBase, 0)} ceiling (2025) on the 12.4% layer of SE tax and of
          FICA alike. Beyond it, marginal payroll cost drops to Medicare only.
        </dd>
        <dt className="mt-5 font-semibold text-slate-900 dark:text-slate-100">QBI deduction (§199A)</dt>
        <dd className="mt-1 leading-relaxed text-slate-600 dark:text-slate-300">
          20% of qualified business income, capped at 20% of taxable income before the deduction.
          For an owner paying no W-2 wages and holding no qualified property, it erodes above{' '}
          {numFmt(EST_CONSTANTS.qbiThresholdSingle, 0)} / {numFmt(EST_CONSTANTS.qbiThresholdMfj, 0)}{' '}
          of taxable income and reaches zero.
        </dd>
        <dt className="mt-5 font-semibold text-slate-900 dark:text-slate-100">Annualized income installment method</dt>
        <dd className="mt-1 leading-relaxed text-slate-600 dark:text-slate-300">
          The Schedule AI alternative that sizes each installment on income actually earned to
          date rather than one quarter of a forecast. Built for seasonal and back-loaded income;
          it must be attached to the return to count.
        </dd>
        <dt className="mt-5 font-semibold text-slate-900 dark:text-slate-100">Underpayment penalty</dt>
        <dd className="mt-1 leading-relaxed text-slate-600 dark:text-slate-300">
          The §6654 charge for missing an installment. Interest rather than a fine, computed
          separately for each period at the federal underpayment rate, simple (not compounded),
          and capped by the safe harbors above.
        </dd>
        <dt className="mt-5 font-semibold text-slate-900 dark:text-slate-100">De minimis exception</dt>
        <dd className="mt-1 leading-relaxed text-slate-600 dark:text-slate-300">
          No installments are required at all when the year&apos;s tax minus withholding comes in
          under {usd(EST_CONSTANTS.deMinimisThreshold, 0)} — an exemption about residual{' '}
          <em>tax</em>, not about income.
        </dd>
        <dt className="mt-5 font-semibold text-slate-900 dark:text-slate-100">Ratable withholding credit</dt>
        <dd className="mt-1 leading-relaxed text-slate-600 dark:text-slate-300">
          §6654(g): withholding counts toward the required payment as if paid evenly across all
          four periods, no matter when it was actually taken. A December bonus paycheck can
          retroactively cure an April shortfall that estimates cannot.
        </dd>
      </dl>

      <h2 id="caveats">Caveats &amp; scope</h2>
      <ul>
        <li>
          Federal-only, tax year 2025, single and married-filing-jointly only. State estimated
          taxes (most states run their own four-installment system with different harbors) are out
          of scope.
        </li>
        <li>
          2025 standard deduction modeled at $15,750 single / $31,500 MFJ per P.L. 119-21 §70102
          (enacted July 4, 2025, retroactive to 2025), which raised the $15,000/$30,000 that
          Rev. Proc. 2024-40 had published for 2025. Some sibling tools on this site price 2025 at
          $14,600/$29,200 — amounts that actually belong to tax year 2024 — so their 2025 figures
          read higher than this tool&apos;s for the same income.
        </li>
        <li>
          Income is modeled as Schedule C net profit only. If you also have W-2 wages, the wages
          themselves are not added to income here — only the withholding entered is credited, so
          for two-income households the 90% line understates the true requirement and the
          prior-year harbor is the safer target (the tool flags this when withholding is entered).
          Investors, landlords, and multi-member partners have additional §6654(d)(3) rules
          (installment income targeting) this tool does not price.
        </li>
        <li>
          The QBI deduction carries the §199A(b)(2) limitation priced at the no-employee case
          (W-2 wages paid $0, UBIA $0): above $197,300/$394,600 of pre-QBI taxable income it
          phases out over $50k/$100k and reaches $0 — a sole proprietor with no staff genuinely
          loses the deduction at that point. A business paying W-2 wages or holding qualified
          property can deduct <em>more</em> than modeled here; an SSTB inside the phase-in range
          gets <em>less</em> than this non-SSTB formula.
        </li>
        <li>
          Form 8959&apos;s 0.9% Additional Medicare Tax on SE income above $200,000/$250,000,
          credits, and the annualized method are not modeled — the last is discussed qualitatively
          above.
        </li>
        <li>
          The prior-year harbor assumes the prior year was a 12-month tax year and you were a US
          citizen/resident throughout; short tax years (first year of residency, etc.) void it.
        </li>
        <li>Nothing here is tax advice. Verify thresholds and rates for your filing year with a qualified professional.</li>
      </ul>

      <Faq
        items={[
          {
            question: 'Do I have to pay quarterly estimated taxes at all?',
            answer: (
              <p>
                Only if you expect to owe at least $1,000 of federal tax for the year after
                subtracting withholding. With SE income only, SE tax alone runs ≈14.1% of net
                profit (92.35% × 15.3%), so with no W-2 withholding the $1,000 line is crossed at{' '}
                {numFmt(SCAN.deMinimisNetSE, 0)} of net profit — high four figures, not $10k+.
                Below that line the de-minimis exception makes the whole question moot.
              </p>
            ),
          },
          {
            question: 'Which safe harbor should I choose?',
            answer: (
              <p>
                You do not choose one and stick to it — the law requires the lesser of the
                applicable prior-year line and 90% of the current year, so the only real decision is
                which number to send each quarter. If income is up versus last year, the prior-year
                line is lower and defers the difference to April. If income is down, the 90% line is
                lower and stops you overpaying. The chart in the tool shows the crossover for your
                own numbers.
              </p>
            ),
          },
          {
            question: "My income is seasonal — do I still owe four equal payments?",
            answer: (
              <p>
                Under the regular method, yes. But Form 2210 Schedule AI lets you annualize each
                cumulative period and pay tax as income actually arrives — the annualized income
                method covered in the guide above. It is paperwork-heavy and must be attached to
                your return to count.
              </p>
            ),
          },
          {
            question: 'What happens if I miss one quarterly payment?',
            answer: (
              <p>
                Not a fine — interest. Each installment period is scored separately, so an underpaid
                Q1 accrues the federal underpayment rate (7% during 2025) from its due date even if
                you triple-pay Q4. If the shortfall was small the penalty may not be worth the
                Form 2210 effort; leave the form off and the IRS computes the charge from the
                return itself and bills it by notice.
              </p>
            ),
          },
          {
            question: "Does my spouse's W-2 job count toward my safe harbor?",
            answer: (
              <p>
                Yes — on a joint return all withholding counts toward the required payment, and it
                is deemed paid ratably across the four quarters no matter when it was actually
                withheld. Many freelancers whose spouse has a salaried job owe zero installments;
                the coverage bar in the tool shows exactly this.
              </p>
            ),
          },
          {
            question: 'Why does this tool use a $15,750 standard deduction for 2025?',
            answer: (
              <p>
                Because that is what 2025 actually allows: the One Big Beautiful Bill Act (P.L.
                119-21, signed July 4, 2025) raised the 2025 standard deduction from the
                $15,000/$30,000 Rev. Proc. 2024-40 had published to $15,750 single / $31,500 MFJ.
                Any calculator still showing $15,000 — or $14,600, which is the 2024 tax-year
                amount — understates the deduction and overstates 2025 tax.
              </p>
            ),
          },
          {
            question: "What if I don't know last year's total tax?",
            answer: (
              <p>
                Then only the 90% current-year line is available — the prior-year harbor requires
                the actual number. At the default $100,000 scenario that line is{' '}
                {usd(UNKNOWN_PRIOR.requiredAnnualPayment, 0)} a year:{' '}
                {usd((UNKNOWN_PRIOR.requiredAnnualPayment - EXAMPLE.requiredAnnualPayment) / 4, 0)}{' '}
                more per installment and{' '}
                {usd(UNKNOWN_PRIOR.requiredAnnualPayment - EXAMPLE.requiredAnnualPayment, 0)} for
                the year than the prior-year harbor would have required. If last year&apos;s 1040
                is findable, it is usually worth finding.
              </p>
            ),
          },
          {
            question: 'Why 110% above $150,000 — and which year decides?',
            answer: (
              <p>
                The statute doubles the prior-year cushion once your AGI grows: above{' '}
                {usd(EST_CONSTANTS.highIncomeAgiThreshold, 0)} the 100% line stops existing and
                110% replaces it. The test is on <em>prior-year</em> AGI, not this year&apos;s —
                in the $300k example above, the switch costs{' '}
                {usd((EXAMPLE_HIGH.prior110 ?? 0) - (EXAMPLE_HIGH.prior100 ?? 0), 0)} a year (
                {usd(((EXAMPLE_HIGH.prior110 ?? 0) - (EXAMPLE_HIGH.prior100 ?? 0)) / 4, 0)} per
                installment) versus the 100% line a sub-$150k AGI would have allowed.
              </p>
            ),
          },
          {
            question: 'My income dropped this year. Do I still pay based on last year?',
            answer: (
              <p>
                No — the required payment is the <em>lesser</em> of the two lines, and falling
                income flips the winner. In the $60k example above, 90% of the current-year bill (
                {usd(EXAMPLE_SIDE.current90, 0)}) undercuts the prior-year line ({usd(14200, 0)});
                paying last year&apos;s number would have handed the IRS{' '}
                {usd((EXAMPLE_SIDE.prior100 ?? 0) - EXAMPLE_SIDE.current90, 0)} interest-free.
              </p>
            ),
          },
          {
            question: 'Can I switch safe harbors mid-year?',
            answer: (
              <p>
                Yes. The §6654 test is annual: each installment is scored against 25% of whatever
                required annual payment you ultimately satisfy, not against the line you were
                aiming at in April. Recompute after each quarter&apos;s actuals and pay the new
                difference — the calculators on this page exist for exactly that re-aim.
              </p>
            ),
          },
          {
            question: 'What happens if I overpay?',
            answer: (
              <p>
                The excess is refunded after you file — an interest-free loan to the Treasury and
                nothing worse; there is no penalty for overpaying estimates. Voluntary payments
                above the safe harbor simply shrink the April balloon, which the{' '}
                &ldquo;expected at filing&rdquo; readout makes visible.
              </p>
            ),
          },
          {
            question: 'Is the underpayment penalty tax-deductible?',
            answer: (
              <p>
                No. The §6654 charge is personal interest, and §163(h) makes personal interest
                nondeductible — it does not reduce income tax and does not belong among the
                business deductions on Schedule C. Only its cousin, business interest expense on
                actual borrowing, is deductible.
              </p>
            ),
          },
          {
            question: 'Do I file Form 1040-ES with my return?',
            answer: (
              <p>
                You never file it — 1040-ES is a worksheet plus payment vouchers; the payments
                themselves post to your account by date and reason code. Form 2210 is the one that
                attaches to the 1040, and only when a penalty must be computed, limited, or
                disputed (for instance to elect the annualized method).
              </p>
            ),
          },
          {
            question: 'This is my first year. What do I owe per quarter?',
            answer: (
              <p>
                Nothing. With last year&apos;s tax at zero, §6654(e)(2) bars the penalty outright
                (assuming a 12-month prior year as a US citizen or resident). The bill still
                exists — at {usd(95000, 0)} of net profit the model prices the year at{' '}
                {usd(FIRST_YEAR.currentTotalTax, 0)}, all of it due with the April 2026 return —
                it simply cannot accrue a penalty on the way.
              </p>
            ),
          },
          {
            question: 'I also have a W-2 job. Does the tool still work for me?',
            answer: (
              <p>
                Partially. The engine taxes Schedule C profit only — W-2 wages are absent from the
                income side, and only the withholding you enter is credited as payment. Your true
                current-year tax (and real 90% line) is therefore higher than shown, which is why
                the tool flags entered withholding and points two-income households at the
                prior-year harbor instead.
              </p>
            ),
          },
          {
            question: 'Where does the 15.3% SE tax stop being 15.3%?',
            answer: (
              <p>
                15.3% blends 12.4% Social Security — which stops at the{' '}
                {usd(EST_CONSTANTS.ssWageBase, 0)} SE base — with 2.9% Medicare, which never
                stops. The base is 92.35% of profit, so the kink lands at{' '}
                {numFmt(SCAN.wageBaseNetSE, 0)} of net profit: below it each extra dollar costs{' '}
                {numFmt(SE_CENTS_BELOW, 2)}¢ of SE tax, above it {numFmt(SE_CENTS_ABOVE, 2)}¢.
              </p>
            ),
          },
          {
            question: 'Why is the second payment due June 16?',
            answer: (
              <p>
                Because June 15, 2025 fell on a Sunday, and installment due dates roll forward to
                the next business day. Q1, Q3 and Q4 kept their dates — the shift is statutory
                mechanics, not a grace period, and the penalty clock starts on June 16 all the
                same.
              </p>
            ),
          },
          {
            question: 'What does missing only the January 15 payment cost?',
            answer: (
              <p>
                The smallest of the four misses: at the default scenario&apos;s{' '}
                {usd(EXAMPLE.perQuarter, 0)} installment,{' '}
                {usd(
                  EXAMPLE.perQuarter *
                    EST_CONSTANTS.penaltyRate *
                    (QUARTERS_2025[3].daysToApr15Filing / 365),
                  0,
                )}{' '}
                — {QUARTERS_2025[3].daysToApr15Filing} days at{' '}
                {pct(EST_CONSTANTS.penaltyRate * 100, 0)}. Skipping Q1 instead accrues a full
                year (
                {usd(
                  EXAMPLE.perQuarter *
                    EST_CONSTANTS.penaltyRate *
                    (QUARTERS_2025[0].daysToApr15Filing / 365),
                  0,
                )}
                ), and all four together about {usd(EXAMPLE.penaltyEstimate, 0)}.
              </p>
            ),
          },
          {
            question: 'Does marriage change the estimate?',
            answer: (
              <p>
                Yes, twice over. On the same {usd(100000, 0)} of SE profit, the MFJ model totals{' '}
                {usd(MFJ_SAME_INCOME.currentTotalTax, 0)} versus{' '}
                {usd(EXAMPLE.currentTotalTax, 0)} single —{' '}
                {usd(EXAMPLE.currentTotalTax - MFJ_SAME_INCOME.currentTotalTax, 0)} less, from the
                larger standard deduction and wider brackets. And with the same {usd(19500, 0)}{' '}
                prior tax, the binding harbor flips: 90% of the MFJ bill (
                {usd(MFJ_SAME_INCOME.current90, 0)}) undercuts the prior-year line, dropping the
                installment to {usd(MFJ_SAME_INCOME.perQuarter, 0)}.
              </p>
            ),
          },
          {
            question: 'Are state estimated taxes included?',
            answer: (
              <p>
                No — this instrument is federal-only. Most states that tax income run their own
                installment calendar with different safe harbors, different thresholds, and
                occasionally different due dates, so a clean federal result can still leave a
                state underpayment accruing. Check your state&apos;s scheme separately.
              </p>
            ),
          },
          {
            question: 'Can I pay more than the required installment?',
            answer: (
              <p>
                Always — voluntary extra payments are allowed at any time and simply reduce the
                balance due at filing. Paying the safe-harbor minimum in the default scenario
                leaves a {usd(EXAMPLE.expectedAtFiling, 0)} balloon; paying the 90% line instead (
                {usd(UNKNOWN_PRIOR.requiredAnnualPayment, 0)}) shrinks it to{' '}
                {usd(UNKNOWN_PRIOR.expectedAtFiling, 0)}.
              </p>
            ),
          },
        ]}
      />

      <RelatedCalculators
        links={[
          { href: '/s-corp-tax-calculator/', label: 'S-Corp Salary Calculator' },
          { href: '/llc-vs-ccorp-tax-calculator/', label: 'LLC vs C-Corp Tax Calculator' },
          { href: '/freelance-hourly-rate-calculator/', label: 'Freelance Hourly Rate' },
        ]}
      />
    </article>
  );
}

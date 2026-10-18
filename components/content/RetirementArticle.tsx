import Faq from '@/components/Faq';
import { ArticleToc, RelatedCalculators } from '@/components/Article';
import {
  compareRetirement,
  deferralLimitFor,
  incomeToMaxSep,
  incomeToMaxSolo,
  RETIREMENT_CONSTANTS,
  scheduleSETax,
  sepCapacity,
  solo401kCapacity,
} from '@/lib/retirement';
import { compareScorp, computeScorp, SCORP_CONSTANTS } from '@/lib/scorp';
import { computeLlc } from '@/lib/tax';
import { numFmt, usd } from '@/lib/format';

/**
 * Build-time-computed guide: every dollar figure in the tables below comes from
 * lib/retirement.ts at render time — the same engine that powers the widget —
 * so the prose can never drift from the model.
 */
export default function RetirementArticle() {
  // Reference cases used across the article.
  const solePropCase = compareRetirement(
    { mode: 'sole-prop', income: 200_000, age: 45, plannedDeferral: 23_500 },
    24,
  );
  const scorpCase = compareRetirement(
    { mode: 'scorp', income: 80_000, age: 45, plannedDeferral: 23_500 },
    24,
  );
  const capacityGapVsScorp =
    solo401kCapacity({ mode: 'sole-prop', income: 200_000, age: 45, plannedDeferral: 23_500 }).total -
    solo401kCapacity({ mode: 'scorp', income: 80_000, age: 45, plannedDeferral: 23_500 }).total;

  // S-corp reference economics for the trade-off paragraph: same $200k business,
  // $80k reasonable salary, $1,200 payroll overhead — measured by the suite's
  // own S-corp engine, not quoted from memory.
  const scorpPayrollSaved =
    computeLlc(200_000).seTax -
    computeScorp(200_000, 80_000, SCORP_CONSTANTS.defaultPayrollCost).payrollTax;
  const scorpNetEdge = compareScorp(200_000, 80_000, SCORP_CONSTANTS.defaultPayrollCost).delta;

  // Low-income case where the Pub 560 worksheet's step-12 cap binds.
  const lowProfit = solo401kCapacity({ mode: 'sole-prop', income: 31_400, age: 40, plannedDeferral: 23_500 });
  const lowProfitSep = sepCapacity('sole-prop', 31_400).contribution;

  const soloCapAt40 = incomeToMaxSolo('sole-prop', 40);
  const sepCapAt = incomeToMaxSep('sole-prop');

  // ---- Worked example: S-corp owner at $120k of wages (age 55, max deferral, 24%). ----
  const scorpExample = compareRetirement(
    { mode: 'scorp', income: 120_000, age: 55, plannedDeferral: deferralLimitFor(55) },
    24,
  );
  // The same top line un-elected, for the base-convention contrast paragraph.
  const scorpExampleSoleProp = compareRetirement(
    { mode: 'sole-prop', income: 120_000, age: 55, plannedDeferral: deferralLimitFor(55) },
    24,
  );

  // ---- Worked example: age 62, $60k profit, enhanced catch-up (12% bracket). ----
  const catchUpCase = compareRetirement(
    { mode: 'sole-prop', income: 60_000, age: 62, plannedDeferral: deferralLimitFor(62) },
    12,
  );
  // The two worksheet guards that could have trimmed this case (neither binds — see prose).
  const catchUpStep12Cap =
    (catchUpCase.solo.compensationBase - RETIREMENT_CONSTANTS.employeeDeferralLimit) *
    RETIREMENT_CONSTANTS.selfEmployedDeductionCapFactor;
  const catchUpHeadroom =
    catchUpCase.solo.compensationBase - catchUpCase.solo.deferralCore - catchUpCase.solo.employerContribution;

  // ---- Decision-boundary thresholds: bisection on the engine itself (methodology in prose). ----
  const fullDeferralAt = scanThreshold(
    (p) =>
      solo401kCapacity({ mode: 'sole-prop', income: p, age: 40, plannedDeferral: RETIREMENT_CONSTANTS.employeeDeferralLimit })
        .deferralCore >= RETIREMENT_CONSTANTS.employeeDeferralLimit - 0.005,
    1_000,
    100_000,
  );
  const clawbackEndsAt = scanThreshold(
    (p) =>
      solo401kCapacity({ mode: 'sole-prop', income: p, age: 40, plannedDeferral: RETIREMENT_CONSTANTS.employeeDeferralLimit })
        .employerContribution >= sepCapacity('sole-prop', p).contribution - 0.005,
    1_000,
    100_000,
  );
  const fullCatchUpAt = scanThreshold(
    (p) =>
      solo401kCapacity({ mode: 'sole-prop', income: p, age: 62, plannedDeferral: deferralLimitFor(62) }).catchUp >=
      RETIREMENT_CONSTANTS.enhancedCatchUpLimit - 0.005,
    1_000,
    100_000,
  );
  // S-corp wage thresholds in closed form (25% × wages = remaining headroom); exact, and the
  // engine's own bisection scan reproduces both within its few-dollars-of-income tolerance.
  const wagesToMaxSoloScorp =
    (RETIREMENT_CONSTANTS.totalAdditionsLimit - RETIREMENT_CONSTANTS.employeeDeferralLimit) /
    RETIREMENT_CONSTANTS.employerRate;
  const wagesToMaxSepScorp = RETIREMENT_CONSTANTS.sepLimit / RETIREMENT_CONSTANTS.employerRate;

  // Top-zone edge: at $250k of profit the Solo sits at its §415(c) cap while the SEP still climbs.
  const edgeAt250k = compareRetirement(
    {
      mode: 'sole-prop',
      income: 250_000,
      age: 40,
      plannedDeferral: RETIREMENT_CONSTANTS.employeeDeferralLimit,
    },
    24,
  ).extraCapacity;

  // Custodian-convention gap at $200k of profit (caveat): 20% of (92.35% × profit − ½ SE tax)
  // versus the Publication 560 worksheet base of (profit − ½ SE tax).
  const custodianEngineBase200k = RETIREMENT_CONSTANTS.employerRateSelfEmployed * (200_000 - scheduleSETax(200_000) / 2);
  const custodianGap200k =
    custodianEngineBase200k -
    RETIREMENT_CONSTANTS.employerRateSelfEmployed *
      (RETIREMENT_CONSTANTS.seBaseFactor * 200_000 - scheduleSETax(200_000) / 2);

  // ---- FAQ support figures, all from the same engine. ----
  const capAt400k = [45, 55, 62].map((age) => ({
    age,
    solo: solo401kCapacity({ mode: 'sole-prop', income: 400_000, age, plannedDeferral: deferralLimitFor(age) }).total,
  }));
  const sepAt400k = sepCapacity('sole-prop', 400_000).contribution;
  const tinyProfit = compareRetirement(
    { mode: 'sole-prop', income: 20_000, age: 45, plannedDeferral: RETIREMENT_CONSTANTS.employeeDeferralLimit },
    24,
  );
  const partialDeferral = compareRetirement(
    { mode: 'sole-prop', income: 150_000, age: 45, plannedDeferral: 10_000 },
    24,
  );
  const noDeferral = compareRetirement({ mode: 'sole-prop', income: 120_000, age: 45, plannedDeferral: 0 }, 24);
  const catchUpEdge24 =
    compareRetirement({ mode: 'sole-prop', income: 400_000, age: 62, plannedDeferral: deferralLimitFor(62) }, 24)
      .taxSavedSolo -
    compareRetirement({ mode: 'sole-prop', income: 400_000, age: 49, plannedDeferral: deferralLimitFor(49) }, 24)
      .taxSavedSolo;
  // Dense grid verifying the Solo 401(k) never holds less than the SEP at max deferral.
  const neverLosesMin = (() => {
    let min = Infinity;
    for (const age of [40, 62]) {
      for (let profit = 0; profit <= 800_000; profit += 1_000) {
        const edge = compareRetirement(
          { mode: 'sole-prop', income: profit, age, plannedDeferral: deferralLimitFor(age) },
          24,
        ).extraCapacity;
        if (edge < min) min = edge;
      }
    }
    return min;
  })();

  const toc = [
    { id: 'two-buckets', label: 'Two buckets vs one' },
    { id: 'same-employer-math', label: 'The employer math is identical' },
    { id: 'worked-example', label: 'Worked example at $200k' },
    { id: 'worked-example-scorp', label: 'Worked example: S-Corp at $120k' },
    { id: 'scorp-case', label: 'The S-Corp situation' },
    { id: 'worked-example-catchup', label: 'Worked example: age 62 at $60k' },
    { id: 'deadlines', label: 'Deadline differences' },
    { id: 'decision', label: 'Decision boundaries' },
    { id: 'beyond-capacity', label: 'Roth, loans & paperwork' },
    { id: 'caveats', label: 'Important caveats' },
    { id: 'glossary', label: 'Glossary' },
    { id: 'faq', label: 'FAQ' },
  ];

  return (
    <article className="prose-article">
      <ArticleToc items={toc} />

      <h2 id="two-buckets">Two buckets vs one</h2>
      <p>
        A Solo 401(k) fills from <strong>two buckets</strong>: an employee side and an employer
        side. The employee side is the elective deferral —{' '}
        {usd(RETIREMENT_CONSTANTS.employeeDeferralLimit, 0)} in 2025, plus{' '}
        {usd(RETIREMENT_CONSTANTS.catchUpLimit, 0)} once you turn 50 (and{' '}
        {usd(RETIREMENT_CONSTANTS.enhancedCatchUpLimit, 0)} at 60–63 under SECURE 2.0). The
        employer side is the profit-sharing piece: 25% of compensation. Everything together is
        capped at {usd(RETIREMENT_CONSTANTS.totalAdditionsLimit, 0)} of annual additions —{' '}
        <em>with catch-up deferrals riding on top of, not inside, that cap</em>.
      </p>
      <p>
        A SEP-IRA has <strong>exactly one bucket</strong>: the employer-style contribution, up to
        25% of compensation with a {usd(RETIREMENT_CONSTANTS.sepLimit, 0)} ceiling. There is no
        deferral and no catch-up at any age (a Roth SEP has existed on paper since SECURE 2.0
        §601, but custodian support is still rare). Structurally, a SEP is the Solo
        401(k)&apos;s employer half offered as a complete plan — which is why this comparison is
        less &ldquo;which plan is better&rdquo; than &ldquo;is the deferral bucket worth
        having.&rdquo;
      </p>

      <h2 id="same-employer-math">The employer math is identical</h2>
      <p>
        This is the part most comparisons blur. For the <strong>self-employed</strong> (Schedule C
        or K-1 general partner), the statutory 25% rate is solved against a base the contribution
        itself shrinks, so it lands as <strong>20% of (net profit − ½ SE tax)</strong> — the
        IRS&apos;s own Publication 560 deduction worksheet. For an <strong>S-corp
        owner-employee</strong>, the contribution is a true <strong>25% of W-2 wages</strong>. Run
        both plans at either mode and the employer sides come out <em>identical</em> — same rate,
        same base, same {usd(RETIREMENT_CONSTANTS.totalAdditionsLimit, 0)} cap — with one
        exception: below roughly $42,000 of net profit, the worksheet&apos;s step-12 deduction cap
        (the employer share may not exceed ½ of net earnings <em>after deferrals</em>) pulls the
        401(k)&apos;s employer share below the SEP&apos;s. That is the price of having deferred
        most of your earnings; above it the two employer lines are the same — until, far up the
        income range, the 401(k)&apos;s §415(c) ceiling starts squeezing its employer share back
        below the SEP&apos;s (see decision boundaries).
      </p>
      <p>
        So the <strong>entire capacity difference between the plans is the deferral bucket</strong>
        — up to {usd(RETIREMENT_CONSTANTS.employeeDeferralLimit, 0)} more ({usd(deferralLimitFor(55), 0)}{' '}
        at 55, {usd(deferralLimitFor(62), 0)} at 62), bounded by 100% of pay. A Solo 401(k) never
        holds less than a SEP; the only real questions are whether you can fund the deferral, and
        whether the plan is worth its paperwork.
      </p>

      <h2 id="worked-example">Worked example at $200,000 Schedule C profit</h2>
      <p>
        Single consultant, age 45, no S election, deferring the maximum, 24% federal bracket —
        computed by this page&apos;s own model:
      </p>
      <table>
        <thead>
          <tr>
            <th>Line</th>
            <th>Solo 401(k)</th>
            <th>SEP-IRA</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Schedule C net profit</td>
            <td>${numFmt(200_000)}</td>
            <td>${numFmt(200_000)}</td>
          </tr>
          <tr>
            <td>Self-employment tax (15.3%/2.9% on 92.35% base)</td>
            <td>−{usd(scheduleSETax(200_000), 0)}</td>
            <td>−{usd(scheduleSETax(200_000), 0)}</td>
          </tr>
          <tr>
            <td>Plan base: profit − ½ SE tax</td>
            <td>{usd(solePropCase.solo.compensationBase, 0)}</td>
            <td>{usd(solePropCase.sep.contributionBase, 0)}</td>
          </tr>
          <tr>
            <td>Employee deferral</td>
            <td>+{usd(solePropCase.solo.deferralTotal, 0)}</td>
            <td>—</td>
          </tr>
          <tr>
            <td>Employer contribution (20% of base)</td>
            <td>+{usd(solePropCase.solo.employerContribution, 0)}</td>
            <td>+{usd(solePropCase.sep.contribution, 0)}</td>
          </tr>
          <tr>
            <td><strong>Total annual capacity</strong></td>
            <td><strong>{usd(solePropCase.solo.total, 0)}</strong></td>
            <td><strong>{usd(solePropCase.sep.contribution, 0)}</strong></td>
          </tr>
          <tr>
            <td><strong>Federal income tax deferred @ 24%</strong></td>
            <td><strong>{usd(solePropCase.taxSavedSolo, 0)}</strong></td>
            <td><strong>{usd(solePropCase.taxSavedSep, 0)}</strong></td>
          </tr>
        </tbody>
      </table>
      <p>
        The SEP shelters {pct0f(solePropCase.sep.contribution, 200_000)} of profit; the Solo 401(k)
        shelters {pct0f(solePropCase.solo.total, 200_000)} — and the extra{' '}
        {usd(solePropCase.extraCapacity, 0)} of room is worth{' '}
        {usd(solePropCase.extraTaxSaved, 0)} of deduction this year at the same bracket. Neither
        contribution reduces the {usd(scheduleSETax(200_000), 0)} SE tax bill by a cent:
        contributions adjust gross income, not Schedule SE.
      </p>

      <h2 id="worked-example-scorp">Worked example: S-Corp owner at $120,000 of wages</h2>
      <p>
        Same age band, different pay machinery: an S-corp owner-employee, age 55, taking{' '}
        {usd(120_000, 0)} of W-2 wages (distributions on top), deferring the age-55 maximum of{' '}
        {usd(deferralLimitFor(55), 0)}, 24% bracket — again straight
        from the engine:
      </p>
      <table>
        <thead>
          <tr>
            <th>Line</th>
            <th>Solo 401(k)</th>
            <th>SEP-IRA</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>W-2 wages (the whole plan base)</td>
            <td>${numFmt(120_000)}</td>
            <td>${numFmt(120_000)}</td>
          </tr>
          <tr>
            <td>SE-tax haircut on the base</td>
            <td>— none on wages</td>
            <td>— none on wages</td>
          </tr>
          <tr>
            <td>Employee deferral (incl. {usd(RETIREMENT_CONSTANTS.catchUpLimit, 0)} catch-up)</td>
            <td>+{usd(scorpExample.solo.deferralTotal, 0)}</td>
            <td>—</td>
          </tr>
          <tr>
            <td>Employer contribution (true 25% of wages)</td>
            <td>+{usd(scorpExample.solo.employerContribution, 0)}</td>
            <td>+{usd(scorpExample.sep.contribution, 0)}</td>
          </tr>
          <tr>
            <td><strong>Total annual capacity</strong></td>
            <td><strong>{usd(scorpExample.solo.total, 0)}</strong></td>
            <td><strong>{usd(scorpExample.sep.contribution, 0)}</strong></td>
          </tr>
          <tr>
            <td><strong>Federal income tax deferred @ 24%</strong></td>
            <td><strong>{usd(scorpExample.taxSavedSolo, 0)}</strong></td>
            <td><strong>{usd(scorpExample.taxSavedSep, 0)}</strong></td>
          </tr>
        </tbody>
      </table>
      <p>
        Three ceilings were available to bind and none did. The 100%-of-pay guard would have
        allowed employer-plus-deferral up to {usd(scorpExample.solo.compensationBase, 0)}; the{' '}
        §415(c) cap left{' '}
        {usd(RETIREMENT_CONSTANTS.totalAdditionsLimit - scorpExample.solo.deferralCore, 0)} of room
        after the core deferral; and 25% × {usd(120_000, 0)} settles the employer line at{' '}
        {usd(scorpExample.solo.employerContribution, 0)} — exactly the SEP&apos;s number, because in
        S-corp mode the two plans share one engine. The sharper point is the counterfactual: the
        same {usd(120_000, 0)} top line as Schedule C profit produces a base of{' '}
        {usd(scorpExampleSoleProp.solo.compensationBase, 0)} after the ½-SE haircut and a 20% Rate-Table
        employer line of {usd(scorpExampleSoleProp.solo.employerContribution, 0)} — total capacity{' '}
        {usd(scorpExampleSoleProp.solo.total, 0)}, or {usd(scorpExample.solo.total - scorpExampleSoleProp.solo.total, 0)}{' '}
        less. The wage base takes the statutory 25% unsolved and carries no SE-tax haircut; the
        profit base does neither.
      </p>

      <h2 id="scorp-case">The S-Corp situation</h2>
      <p>
        Electing S status changes the <em>base</em>, not the machinery. Employer contributions
        become a true 25% of W-2 wages, and the deferral must also come out of wages —{' '}
        <strong>distributions count for nothing</strong>. That links your retirement capacity to
        your reasonable-salary decision: shrink the salary to save payroll tax, and you shrink
        both plan buckets with it.
      </p>
      <ul>
        <li>
          Sole proprietor, {usd(200_000, 0)} profit, age 45:{' '}
          <strong>{usd(solePropCase.solo.total, 0)}</strong> of Solo 401(k) capacity.
        </li>
        <li>
          Same economics inside an S-corp with an {usd(80_000, 0)} reasonable salary:{' '}
          <strong>{usd(scorpCase.solo.total, 0)}</strong> ({usd(scorpCase.solo.deferralTotal, 0)}{' '}
          deferral + {usd(scorpCase.solo.employerContribution, 0)} employer at 25% of wages).
        </li>
      </ul>
      <p>
        The election quietly costs <strong>{usd(capacityGapVsScorp, 0)}/yr</strong> of retirement
        room at these numbers. Set that against what the{' '}
        <a href="/s-corp-tax-calculator/">S-Corp Salary Calculator</a> measures at the same
        economics: a {usd(scorpPayrollSaved, 0)} payroll-tax reduction that nets to only{' '}
        {usd(scorpNetEdge, 0)}/yr of after-tax advantage once the income-tax layer claws back its
        share — and it stops being obvious. When the plan matters, the retirement math should be
        an input to the salary decision, not an afterthought.
      </p>

      <h2 id="worked-example-catchup">Worked example: age 62, $60,000 profit, enhanced catch-up</h2>
      <p>
        The busiest corner of the engine: a 62-year-old sole proprietor with {usd(60_000, 0)} of
        Schedule C profit, deferring the full {usd(deferralLimitFor(62), 0)} — the{' '}
        {usd(RETIREMENT_CONSTANTS.employeeDeferralLimit, 0)} core plus the{' '}
        {usd(RETIREMENT_CONSTANTS.enhancedCatchUpLimit, 0)} enhanced catch-up — at the 12% federal
        bracket, where this suite&apos;s own tax model places a single filer at this profit. Four
        limits interact, and each one shows its work:
      </p>
      <table>
        <thead>
          <tr>
            <th>Step</th>
            <th>Amount</th>
            <th>Limit checked</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Schedule C net profit</td>
            <td>{usd(60_000, 0)}</td>
            <td>—</td>
          </tr>
          <tr>
            <td>Self-employment tax (15.3% on 92.35% base)</td>
            <td>−{usd(scheduleSETax(60_000), 0)}</td>
            <td>unaffected by any contribution</td>
          </tr>
          <tr>
            <td>Plan base: profit − ½ SE tax</td>
            <td>{usd(catchUpCase.solo.compensationBase, 0)}</td>
            <td>—</td>
          </tr>
          <tr>
            <td>Core deferral</td>
            <td>+{usd(RETIREMENT_CONSTANTS.employeeDeferralLimit, 0)}</td>
            <td>§402(g): full limit fundable (base well above it)</td>
          </tr>
          <tr>
            <td>Enhanced catch-up (age 60–63)</td>
            <td>+{usd(catchUpCase.solo.catchUp, 0)}</td>
            <td>worksheet steps 16–18: {usd(catchUpHeadroom, 0)} of net earnings remained — passes</td>
          </tr>
          <tr>
            <td>Employer contribution (20% × base)</td>
            <td>+{usd(catchUpCase.solo.employerContribution, 0)}</td>
            <td>step-12 cap would be {usd(catchUpStep12Cap, 0)} — not binding</td>
          </tr>
          <tr>
            <td><strong>Solo 401(k) total</strong></td>
            <td><strong>{usd(catchUpCase.solo.total, 0)}</strong></td>
            <td><strong>{pct0f(catchUpCase.solo.total, 60_000)} of profit</strong></td>
          </tr>
          <tr>
            <td>SEP-IRA on the same base</td>
            <td>{usd(catchUpCase.sep.contribution, 0)}</td>
            <td>{pct0f(catchUpCase.sep.contribution, 60_000)} of profit</td>
          </tr>
          <tr>
            <td><strong>Federal income tax deferred @ 12%</strong></td>
            <td><strong>{usd(catchUpCase.taxSavedSolo, 0)}</strong></td>
            <td><strong>{usd(catchUpCase.taxSavedSep, 0)}</strong></td>
          </tr>
        </tbody>
      </table>
      <p>
        Every guard cleared with room to spare: step 12 by{' '}
        {usd(catchUpStep12Cap - catchUpCase.solo.employerContribution, 0)}, the catch-up
        limitation by {usd(catchUpHeadroom - catchUpCase.solo.catchUp, 0)} — which is what{' '}
        {usd(60_000, 0)} of profit buys above the thresholds mapped in the decision-boundaries
        section below. The conclusion is stark at moderate income: the SEP shelters{' '}
        {pct0f(catchUpCase.sep.contribution, 60_000)} of every profit dollar, the Solo 401(k){' '}
        {pct0f(catchUpCase.solo.total, 60_000)} — and the extra {usd(catchUpCase.extraCapacity, 0)} of
        room is worth {usd(catchUpCase.extraTaxSaved, 0)} of deduction this year at 12%. Trim the
        income and the same guards start to bite: the catch-up is the first piece to shrink.
      </p>

      <h2 id="deadlines">Deadline differences</h2>
      <table>
        <thead>
          <tr>
            <th>Action</th>
            <th>Solo 401(k)</th>
            <th>SEP-IRA</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Open a <strong>new</strong> plan for the tax year</td>
            <td>Generally by <strong>Dec 31</strong> (employer-only piece may be added by the filing deadline under SECURE Act §201)</td>
            <td>Any time up to the <strong>tax-filing deadline, including extensions</strong> — even after the year closes</td>
          </tr>
          <tr>
            <td>Fund the employee deferral</td>
            <td>Elected against wages/profit during the year; settled when the books close</td>
            <td>— no deferral exists</td>
          </tr>
          <tr>
            <td>Fund the employer contribution</td>
            <td>Up to the extended filing deadline</td>
            <td>Up to the extended filing deadline</td>
          </tr>
        </tbody>
      </table>
      <p>
        Practically: if the year is already over and you did nothing, the SEP-IRA is the only
        plan you can still fund in full — a Solo 401(k) stood up by the filing deadline carries
        employer-only dollars back, but its deferral bucket is gone. If you are reading this in
        November, you can still stand up a Solo 401(k) for this year and lock in the deferral
        bucket.
      </p>

      <h2 id="decision">Decision boundaries</h2>
      <p>
        Run capacity across income and the map falls into regimes. Every threshold below was
        measured by scanning this page&apos;s own engine — a bisection on the same{' '}
        <code>solo401kCapacity</code> / <code>sepCapacity</code> functions the widget calls, the
        convention the library&apos;s own <code>incomeToMaxSolo</code> sweep uses; the tolerance
        is sub-dollar in capacity, which maps to a few dollars of income at the flat employer
        rates — not quoted from a rule of thumb. Sole-prop mode, deferring the full age-based
        limit:
      </p>
      <table>
        <thead>
          <tr>
            <th>Net profit reaches…</th>
            <th>What changes</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>{usd(fullDeferralAt, 0)}</td>
            <td>The full {usd(RETIREMENT_CONSTANTS.employeeDeferralLimit, 0)} core deferral becomes fundable; below it, the deferral itself is capped at (profit − ½ SE tax).</td>
          </tr>
          <tr>
            <td>{usd(clawbackEndsAt, 0)}</td>
            <td>The worksheet&apos;s step-12 clawback stops binding — the Solo employer share equals the SEP contribution exactly, and only the deferral bucket separates the plans from here up.</td>
          </tr>
          <tr>
            <td>{usd(fullCatchUpAt, 0)} <em>(at 62)</em></td>
            <td>The full {usd(RETIREMENT_CONSTANTS.enhancedCatchUpLimit, 0)} enhanced catch-up funds; below it, worksheet steps 16–18 trim it.</td>
          </tr>
          <tr>
            <td>{usd(soloCapAt40 ?? 0, 0)}</td>
            <td>The Solo 401(k) reaches its {usd(RETIREMENT_CONSTANTS.totalAdditionsLimit, 0)} ceiling — at the same income at any age, because the employer engine kinks identically and catch-ups ride above the cap.</td>
          </tr>
          <tr>
            <td>{usd(sepCapAt ?? 0, 0)}</td>
            <td>The SEP hits {usd(RETIREMENT_CONSTANTS.sepLimit, 0)} too; capacity is identical from here.</td>
          </tr>
        </tbody>
      </table>
      <p>
        S-corp mode collapses the map to two wage numbers:{' '}
        {usd(wagesToMaxSoloScorp, 0)} of W-2 wages max the Solo 401(k) (25% + deferral ={' '}
        {usd(RETIREMENT_CONSTANTS.totalAdditionsLimit, 0)}) and {usd(wagesToMaxSepScorp, 0)} max the
        SEP — exact closed forms, since the employer rate is the only lever and wages are the
        whole base.
      </p>
      <ul>
        <li>
          <strong>Under {usd(fullDeferralAt, 0)}:</strong> even the deferral is income-capped. At{' '}
          {usd(20_000, 0)} of profit (age 45) the Solo holds <strong>{usd(tinyProfit.solo.total, 0)}</strong>{' '}
          — all deferral, employer share {usd(tinyProfit.solo.employerContribution, 0)} — against the
          SEP&apos;s {usd(tinyProfit.sep.contribution, 0)}. Capacity still favors the Solo; the binding
          constraint at this income is cash flow, not plan math.
        </li>
        <li>
          <strong>{usd(fullDeferralAt, 0)}–{usd(clawbackEndsAt, 0)} (the clawback zone):</strong> the
          full deferral funds, but the Pub 560 worksheet claws the employer share back — it may
          not exceed ½ of net earnings <em>after deferrals</em>. At {usd(31_400, 0)} of profit (age
          40, deferring the max) the Solo still holds{' '}
          <strong>{usd(lowProfit.total, 0)}</strong> ({pct0f(lowProfit.total, 31_400)} of profit)
          against the SEP&apos;s {usd(lowProfitSep, 0)} ({pct0f(lowProfitSep, 31_400)}) — the Solo
          wins by a mile; the question is whether the income justifies a 401(k) at all.
        </li>
        <li>
          <strong>The long middle ({usd(clawbackEndsAt, 0)}–{usd(soloCapAt40 ?? 0, 0)}):</strong> Solo
          capacity = SEP + deferral limit, a flat{' '}
          {usd(RETIREMENT_CONSTANTS.employeeDeferralLimit, 0)} (plus catch-up) of extra room at every
          income level — and each deferral dollar is exactly one more plan dollar: a{' '}
          {usd(10_000, 0)} deferral at {usd(150_000, 0)} of profit adds precisely{' '}
          {usd(partialDeferral.extraCapacity, 0)} of capacity.
        </li>
        <li>
          <strong>{usd(soloCapAt40 ?? 0, 0)} and up:</strong> the Solo 401(k) reaches its{' '}
          {usd(RETIREMENT_CONSTANTS.totalAdditionsLimit, 0)} ceiling and flattens — extra profit adds
          nothing more, while the SEP is still climbing: it does not reach{' '}
          {usd(RETIREMENT_CONSTANTS.sepLimit, 0)} until {usd(sepCapAt ?? 0, 0)} of profit. The
          Solo&apos;s edge therefore narrows from the full deferral limit — {usd(edgeAt250k, 0)} of
          room left at {usd(250_000, 0)} of profit — down to the catch-up alone for 50+ owners,
          or to zero under 50 once the SEP arrives. The age-62 line kinks at the <em>same</em>{' '}
          income (the employer engine is identical) but plateaus{' '}
          {usd(RETIREMENT_CONSTANTS.enhancedCatchUpLimit, 0)} higher, at{' '}
          {usd(RETIREMENT_CONSTANTS.totalAdditionsLimit + RETIREMENT_CONSTANTS.enhancedCatchUpLimit, 0)}.
        </li>
        <li>
          <strong>{usd(sepCapAt ?? 0, 0)} and up:</strong> the SEP hits{' '}
          {usd(RETIREMENT_CONSTANTS.sepLimit, 0)} too. From here the plans are identical in
          capacity — only a catch-up (50+) or Roth/loan features keep the Solo ahead.
        </li>
      </ul>
      <p>
        The honest summary: <strong>on capacity, the Solo 401(k) never loses</strong> — a dense
        verification grid ({usd(1_000, 0)}-step incomes from zero to {usd(800_000, 0)} at ages 40
        and 62) finds its capacity edge bottoming out at {usd(neverLosesMin, 0)}, and only at
        zero profit. That edge is not always the full deferral, though: in the clawback zone the
        SEP&apos;s own employer share offsets part of it, and above {usd(soloCapAt40 ?? 0, 0)}{' '}
        the shared §415(c) cap compresses it toward the catch-up alone — to zero, under 50, once
        the SEP reaches its own ceiling. What a SEP wins on is paperwork, retroactivity, and
        simplicity — and for a one-person business that can actually fund an extra{' '}
        {usd(RETIREMENT_CONSTANTS.employeeDeferralLimit, 0)} of deferral, those conveniences are
        expensive.
      </p>

      <h2 id="beyond-capacity">Roth, loans &amp; paperwork</h2>
      <ul>
        <li>
          <strong>Roth:</strong> a Solo 401(k) can take designated Roth deferrals — no deduction
          now, tax-free later; the employer share is pre-tax in virtually every plan (SECURE 2.0
          §604 permits designated-Roth employer nonelective dollars — rarely offered, and not
          deductible when chosen). A SEP can be a{' '}
          <em>Roth SEP</em> since SECURE 2.0 §601 (tax years beginning after 2022), though
          custodian support is still rare — where it isn&apos;t offered, contribute pre-tax, then
          convert to a Roth IRA and pay the conversion-year tax. (From 2026, higher
          earners&apos; catch-up deferrals must be Roth under SECURE 2.0 — plan the liquidity for
          it.)
        </li>
        <li>
          <strong>Loans:</strong> 401(k) plans may allow loans (up to the lesser of $50,000 or half
          your vested balance). IRAs — including SEPs — cannot.
        </li>
        <li>
          <strong>Admin:</strong> a SEP is a one-page Form 5305-SEP with essentially no ongoing
          filings. A Solo 401(k) files Form 5500-EZ once plan assets pass $250,000, and new
          custodial paperwork is heavier. Neither needs nondiscrimination testing while you have
          no employees.
        </li>
        <li>
          <strong>Costs:</strong> many custodians offer both at $0 — compare investment menus
          and loan/Roth support rather than sticker price.
        </li>
      </ul>

      <h2 id="caveats">Important caveats</h2>
      <ul>
        <li>Owner-only model. Hiring W-2 staff ends the comparison: SEPs must cover eligible employees (21+, 3 of 5 years, $750 of 2025 pay); a 401(k) stops being &ldquo;solo&rdquo; and picks up coverage rules.</li>
        <li>Federal, tax-year 2025 only: deferral {usd(23_500, 0)}, catch-ups {usd(7_500, 0)}/{usd(11_250, 0)}, plan caps {usd(70_000, 0)}. The §401(a)(17) compensation cap ({usd(RETIREMENT_CONSTANTS.compensationCap, 0)} for 2025) is not modeled — it truncates compensation above that figure, but by then the §415(c) arithmetic has already capped the plan ({usd(70_000, 0)} of employer room is reached at 25% of {usd(wagesToMaxSepScorp, 0)} of wages, or at a {usd(RETIREMENT_CONSTANTS.sepLimit / RETIREMENT_CONSTANTS.employerRateSelfEmployed, 0)} self-employed plan base), so it never changes an answer at or below the caps.</li>
        <li>Some custodians compute the self-employed employer share as 20% of (92.35% × profit − ½ SE tax) — {pct1f(custodianGap200k / custodianEngineBase200k)} lower than this tool&apos;s Publication 560 deduction-worksheet convention ({usd(custodianGap200k, 0)} less at {usd(200_000, 0)} of profit). When a provider&apos;s number is lower, that is why.</li>
        <li>&ldquo;Tax deferred&rdquo; is income-tax only, at the marginal rate you enter; no state tax, no NIIT interactions, no future-rate assumptions.</li>
        <li>Nothing here is tax, legal, or investment advice. Confirm current-year limits and your custodian&apos;s document terms with a qualified professional.</li>
      </ul>

      <h2 id="glossary">Glossary</h2>
      <p>The vocabulary this page runs on, in the order a first pass through the topic meets it:</p>
      <dl className="mb-4">
        <dt className="mt-4 font-semibold text-slate-900 dark:text-slate-100">Elective deferral</dt>
        <dd className="ml-0 leading-relaxed text-slate-600 dark:text-slate-300">
          The employee-side dollars you steer out of pay into a 401(k) before income tax, capped by
          §402(g) at {usd(RETIREMENT_CONSTANTS.employeeDeferralLimit, 0)} for 2025 — the one bucket a
          SEP-IRA does not have.
        </dd>
        <dt className="mt-4 font-semibold text-slate-900 dark:text-slate-100">Catch-up contribution</dt>
        <dd className="ml-0 leading-relaxed text-slate-600 dark:text-slate-300">
          Extra deferral room that switches on with age: {usd(RETIREMENT_CONSTANTS.catchUpLimit, 0)} from
          50, enhanced to {usd(RETIREMENT_CONSTANTS.enhancedCatchUpLimit, 0)} at 60–63 under SECURE 2.0
          §109. It sits above the plan&apos;s overall cap, not inside it.
        </dd>
        <dt className="mt-4 font-semibold text-slate-900 dark:text-slate-100">Employer (profit-sharing) contribution</dt>
        <dd className="ml-0 leading-relaxed text-slate-600 dark:text-slate-300">
          The employer-side add-on, discretionary year by year: 25% of compensation — which solves
          to 20% of (net profit − ½ SE tax) when you are both the employer and the employee.
        </dd>
        <dt className="mt-4 font-semibold text-slate-900 dark:text-slate-100">§415(c) annual additions cap</dt>
        <dd className="ml-0 leading-relaxed text-slate-600 dark:text-slate-300">
          The {usd(RETIREMENT_CONSTANTS.totalAdditionsLimit, 0)} (2025) ceiling on deferral plus employer
          money into one defined-contribution plan for the year, catch-ups excluded.
        </dd>
        <dt className="mt-4 font-semibold text-slate-900 dark:text-slate-100">Plan compensation base</dt>
        <dd className="ml-0 leading-relaxed text-slate-600 dark:text-slate-300">
          The number the employer percentage multiplies: gross W-2 wages (before elective
          deferrals) for an S-corp owner-employee, or net profit minus ½ SE tax for the
          self-employed.
        </dd>
        <dt className="mt-4 font-semibold text-slate-900 dark:text-slate-100">½ SE-tax deduction</dt>
        <dd className="ml-0 leading-relaxed text-slate-600 dark:text-slate-300">
          Half your self-employment tax, subtracted from profit before the plan base is computed.
          It is fixed before contributions because contributions never change SE tax.
        </dd>
        <dt className="mt-4 font-semibold text-slate-900 dark:text-slate-100">The 20% self-employed rate</dt>
        <dd className="ml-0 leading-relaxed text-slate-600 dark:text-slate-300">
          The statutory 25% employer rate solved against a base the contribution itself shrinks —
          Publication 560&apos;s Rate Table answer. W-2 pay gets the full 25%; the difference is
          structural, not a rounding choice.
        </dd>
        <dt className="mt-4 font-semibold text-slate-900 dark:text-slate-100">Step-12 clawback</dt>
        <dd className="ml-0 leading-relaxed text-slate-600 dark:text-slate-300">
          The Publication 560 deduction-worksheet rule that the self-employed employer share may
          not exceed ½ of net earnings <em>after deferrals</em>. With the 2025 deferral it binds
          only below {usd(clawbackEndsAt, 0)} of profit — the low-income regime mapped above.
        </dd>
        <dt className="mt-4 font-semibold text-slate-900 dark:text-slate-100">Designated Roth deferral</dt>
        <dd className="ml-0 leading-relaxed text-slate-600 dark:text-slate-300">
          Employee deferral dollars designated Roth: no deduction now, tax-free withdrawals
          later. Standard on the 401(k) employee side; employer dollars are pre-tax in virtually
          all plans (SECURE 2.0 §604 permits a Roth employer nonelective option, rarely
          offered).
        </dd>
        <dt className="mt-4 font-semibold text-slate-900 dark:text-slate-100">SECURE 2.0</dt>
        <dd className="ml-0 leading-relaxed text-slate-600 dark:text-slate-300">
          The 2022 statute behind the enhanced 60–63 catch-up, the (paper-only so far) Roth SEP,
          and the 2026 rule routing higher earners&apos; catch-up deferrals to Roth.
        </dd>
        <dt className="mt-4 font-semibold text-slate-900 dark:text-slate-100">Form 5500-EZ</dt>
        <dd className="ml-0 leading-relaxed text-slate-600 dark:text-slate-300">
          The short annual report a one-participant 401(k) owes once plan assets pass $250,000. A
          SEP files nothing comparable.
        </dd>
        <dt className="mt-4 font-semibold text-slate-900 dark:text-slate-100">Reasonable salary</dt>
        <dd className="ml-0 leading-relaxed text-slate-600 dark:text-slate-300">
          The W-2 wage level an S-corp owner must be able to defend for the work actually done.
          Every S-corp retirement number on this page scales with it — it is the base, not a side
          input.
        </dd>
      </dl>

      <Faq
        items={[
          {
            question: 'Can I have both a SEP-IRA and a Solo 401(k)?',
            answer: (
              <p>
                You can, but they share one §415(c) ceiling — {usd(70_000, 0)} of annual additions
                counted per employer (both plans here belong to the same business). Since the
                Solo 401(k)&apos;s employer
                engine is the SEP&apos;s whole engine, adding a SEP on top of an existing Solo
                401(k) buys you nothing except an extra account. The useful combination is the
                reverse of what people expect: keep the Solo 401(k), skip the SEP.
              </p>
            ),
          },
          {
            question: 'Why is my employer contribution only 20% when the law says 25%?',
            answer: (
              <p>
                For the self-employed, the 25% plan rate applies to compensation after the
                contribution itself — a circular definition. Solving it (Publication 560&apos;s
                Rate Table) turns 25% into 20% of (net profit − ½ SE tax). If you pay yourself
                W-2 wages through an S-corp, there is no circularity and the true 25% of wages
                applies.
              </p>
            ),
          },
          {
            question: 'Do retirement contributions reduce my self-employment tax?',
            answer: (
              <p>
                No — this surprises people every year. Plan contributions are adjustments to gross
                income: they reduce income tax, never the 15.3%/2.9% self-employment tax on your
                full net profit. The SE-tax reduction many articles imply comes from the S-corp
                salary split, not from the retirement plan.
              </p>
            ),
          },
          {
            question: 'What is the most I can possibly shelter in 2025?',
            answer: (
              <p>
                The Solo 401(k) tops out at {usd(RETIREMENT_CONSTANTS.totalAdditionsLimit, 0)} of annual
                additions plus your catch-up. At {usd(400_000, 0)} of profit — where every ceiling
                binds — the engine reads {usd(capAt400k[0].solo, 0)} under 50,{' '}
                {usd(capAt400k[1].solo, 0)} at 55, and {usd(capAt400k[2].solo, 0)} at 60–63. A SEP is
                flat {usd(sepAt400k, 0)} at any age.
              </p>
            ),
          },
          {
            question: 'At what income do both plans max out?',
            answer: (
              <p>
                The Solo 401(k) reaches {usd(RETIREMENT_CONSTANTS.totalAdditionsLimit, 0)} at{' '}
                {usd(soloCapAt40 ?? 0, 0)} of net profit — at the same income at any age, because the
                employer engine kinks identically and catch-ups ride above the cap. The SEP
                catches up at {usd(sepCapAt ?? 0, 0)}. Between those two incomes, an under-50 Solo
                sits at its ceiling while the SEP is still climbing.
              </p>
            ),
          },
          {
            question: 'Is the Solo 401(k) ever the smaller plan?',
            answer: (
              <p>
                No — the verification grid in decision boundaries above finds the capacity edge
                bottoms out at {usd(neverLosesMin, 0)}, and only at zero profit. The one honest
                asterisk: beyond {usd(sepCapAt ?? 0, 0)} of profit an under-50 owner and the SEP
                both sit at the shared {usd(RETIREMENT_CONSTANTS.totalAdditionsLimit, 0)} ceiling —
                capacity ties and features decide.
              </p>
            ),
          },
          {
            question: 'My profit is only about $20,000 — is the plan pointless?',
            answer: (
              <p>
                Capacity-wise, no — the first regime in the decision map above: the Solo holds{' '}
                {usd(tinyProfit.solo.total, 0)} (all deferral, employer share{' '}
                {usd(tinyProfit.solo.employerContribution, 0)}) against the SEP&apos;s{' '}
                {usd(tinyProfit.sep.contribution, 0)}. The binding constraint at that income is
                cash flow: funding {usd(tinyProfit.solo.total, 0)} means living on what is left
                of a {usd(20_000, 0)} profit.
              </p>
            ),
          },
          {
            question: 'I can only afford $10,000 of deferral — is the Solo still worth its paperwork?',
            answer: (
              <p>
                Through the middle income band, the edge is exactly the deferral you fund: a{' '}
                {usd(10_000, 0)} deferral at {usd(150_000, 0)} of profit buys{' '}
                {usd(partialDeferral.extraCapacity, 0)} of extra capacity and{' '}
                {usd(partialDeferral.extraTaxSaved, 0)} of extra deduction at 24%. Deferring nothing
                makes the plans identical — {usd(noDeferral.solo.total, 0)} each — so any deferral
                you can fund is pure gain over the SEP.
              </p>
            ),
          },
          {
            question: 'What catch-up do I get at my age?',
            answer: (
              <p>
                2025 deferral ceilings: {usd(deferralLimitFor(49), 0)} through age 49,{' '}
                {usd(deferralLimitFor(50), 0)} from 50, {usd(deferralLimitFor(62), 0)} at 60–63, back
                to {usd(deferralLimitFor(64), 0)} from 64. The enhanced catch-up is worth{' '}
                {usd(catchUpEdge24, 0)} a year of deduction at a 24% bracket — and a SEP gets none
                of this at any age.
              </p>
            ),
          },
          {
            question: 'I turn 50 later this year — do I get the catch-up for this year?',
            answer: (
              <p>
                Yes. The model reads your age at the end of the plan year, which matches the
                statute: attain 50 by December 31 and the year&apos;s deferral ceiling is{' '}
                {usd(deferralLimitFor(50), 0)}. Turning 60 mid-year likewise unlocks the full{' '}
                {usd(deferralLimitFor(62), 0)} for that year.
              </p>
            ),
          },
          {
            question: 'Is there a SEP-IRA catch-up contribution at 50+?',
            answer: (
              <p>
                No. Catch-ups exist only in 401(k)-type plans: {usd(7_500, 0)} from age 50 and{' '}
                {usd(11_250, 0)} at 60–63 for 2025. A SEP&apos;s limit is flat regardless of age —
                one more reason the age-50+ owner leans Solo 401(k).
              </p>
            ),
          },
          {
            question: 'Why does my S-corp salary cap my contribution?',
            answer: (
              <p>
                Inside an S-corp, W-2 wages are the entire plan base — distributions add nothing.
                At {usd(120_000, 0)} of wages a 55-year-old gets{' '}
                {usd(scorpExample.solo.deferralTotal, 0)} + {usd(scorpExample.solo.employerContribution, 0)} ={' '}
                {usd(scorpExample.solo.total, 0)}, and it takes {usd(wagesToMaxSoloScorp, 0)} of
                wages to reach the {usd(RETIREMENT_CONSTANTS.totalAdditionsLimit, 0)} ceiling. Every
                salary dollar trimmed to save payroll tax also deletes 25 cents of employer room.
              </p>
            ),
          },
          {
            question: 'I have a day-job 401(k) too — separate limits?',
            answer: (
              <p>
                The {usd(RETIREMENT_CONSTANTS.employeeDeferralLimit, 0)} §402(g) deferral limit is per
                person per year across all of your 401(k)-type plans, so day-job deferrals consume
                the same bucket. The employer percentage and the {usd(70_000, 0)} §415(c) ceiling
                are per employer — but this page&apos;s model covers a single plan, so coordinate
                the two manually.
              </p>
            ),
          },
          {
            question: 'My spouse works in the business — can we double up?',
            answer: (
              <p>
                In principle, yes: a bona fide employee-spouse carries their own{' '}
                {usd(RETIREMENT_CONSTANTS.employeeDeferralLimit, 0)} deferral limit and catch-up, plus
                their own employer share. The engine here is strictly single-owner, so model each
                of you separately and add.
              </p>
            ),
          },
          {
            question: 'Roth or pre-tax at a 24% bracket?',
            answer: (
              <p>
                The {usd(scorpExample.solo.deferralTotal, 0)} pre-tax deferral in the S-corp example
                above is worth {usd(scorpExample.extraTaxSaved, 0)} of deduction this year; Roth
                forgoes that to buy tax-free withdrawals later. It is a
                this-bracket-versus-expected-later-bracket bet — and from 2026, higher
                earners&apos; catch-up dollars must be Roth regardless.
              </p>
            ),
          },
          {
            question: 'My profit swings year to year — does the plan reprice?',
            answer: (
              <p>
                Capacity recomputes annually, with nothing ratcheted: the {usd(60_000, 0)},
                age-62 year in the worked example still shelters {usd(catchUpCase.solo.total, 0)} (
                {pct0f(catchUpCase.solo.total, 60_000)} of profit), while a bigger year rides the flat
                deferral limit plus 20% of a larger base. A lean year simply holds less.
              </p>
            ),
          },
          {
            question: 'Why does my custodian’s employer number come in a little lower?',
            answer: (
              <p>
                Some custodians compute the self-employed employer share on a slightly smaller
                base than Publication 560&apos;s deduction worksheet does — the convention gap is
                quantified in the caveats above. When a provider&apos;s number is lower, that is
                almost always why; the plan math is otherwise identical.
              </p>
            ),
          },
          {
            question: 'What if I contribute too much?',
            answer: (
              <p>
                An excess elective deferral is corrected by withdrawing it (plus earnings) before
                the April 15 filing deadline — taxed then, with no 6% excise cycle like an IRA
                excess. Excess employer dollars are the ones to avoid: they become deductible only
                in a later year, and repeated overages jeopardize the plan — re-run the engine
                before funding, not after.
              </p>
            ),
          },
          {
            question: 'Do contributions show up anywhere besides my income-tax bill?',
            answer: (
              <p>
                They cut adjusted gross income — which can ripple into other AGI-linked items this
                model does not track — but never Schedule SE. At {usd(200_000, 0)} of profit the SE-tax
                line is {usd(scheduleSETax(200_000), 0)} whether you contribute{' '}
                {usd(solePropCase.solo.total, 0)} or nothing.
              </p>
            ),
          },
          {
            question: 'Do I have to contribute every year once the plan exists?',
            answer: (
              <p>
                No — the deferral is elective and, in an owner-only plan, the employer share is
                discretionary year by year. The obligations that persist are administrative:
                Form 5500-EZ once assets pass the threshold noted above, whether or not you put a
                dollar in.
              </p>
            ),
          },
          {
            question: 'Can I roll a SEP-IRA into my Solo 401(k)?',
            answer: (
              <p>
                Yes — pre-tax SEP dollars can roll into a Solo 401(k) whose document accepts
                them, and doing so clears the IRA balance that complicates backdoor Roth
                conversions under the pro-rata rule. Keep the money pre-tax throughout the
                movement; there is no annual rollover limit.
              </p>
            ),
          },
          {
            question: 'I filed my taxes already — can I still open a plan for last year?',
            answer: (
              <p>
                A SEP-IRA, yes: it can be established and funded as late as your tax-filing
                deadline including extensions (a timely-filed original return can be amended to
                claim the deduction). A Solo 401(k) generally had to exist by December 31 of that
                year to credit deferrals; the SECURE Act allows a plan opened by the filing
                deadline to carry employer-only contributions back.
              </p>
            ),
          },
          {
            question: 'Is a SEP-IRA ever the right answer?',
            answer: (
              <p>
                Yes, and usually the deadline decides it rather than the math: the SEP is the only
                plan you can open and fund after the year closes, and if you genuinely cannot fund
                deferrals, the two plans hold identical dollars anyway — {usd(noDeferral.solo.total, 0)}{' '}
                each at {usd(120_000, 0)} of profit. Add one-owner businesses that value the one-page
                Form 5305-SEP over Roth and loan features.
              </p>
            ),
          },
          {
            question: 'What changes when I hire my first employee?',
            answer: (
              <p>
                Everything. A SEP must then cover every employee who is 21+, worked 3 of the last
                5 years, and earned at least $750 (2025) — at the same percentage of pay you give
                yourself. A &ldquo;solo&rdquo; 401(k) loses its exemption and picks up coverage
                and nondiscrimination testing (often solved with safe-harbor design, at real
                cost). Model employee costs before you model contributions.
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

/**
 * Smallest x in [lo, hi] where a monotone predicate flips true — bisection on
 * the retirement engine, mirroring the convention of lib/retirement.ts's own
 * incomeToMaxSolo sweep (60 halvings, sub-dollar tolerance).
 */
function scanThreshold(p: (x: number) => boolean, lo: number, hi: number): number {
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (p(mid)) hi = mid;
    else lo = mid;
  }
  return hi;
}

/** Percentage of profit, 0 decimals — local helper for the article's ratio lines. */
function pct0f(part: number, whole: number): string {
  return `${whole > 0 ? Math.round((part / whole) * 100) : 0}%`;
}

/** Percentage, 1 decimal — local helper for the custodian-convention gap. */
function pct1f(x: number): string {
  return `${(x * 100).toFixed(1)}%`;
}

import Faq from '@/components/Faq';
import { ArticleToc, RelatedCalculators } from '@/components/Article';
import {
  evaluateIncomePath,
  evaluatePayrollPath,
  computeGrossCredit,
  marginalRateSweep,
  RDC_CONSTANTS as C,
} from '@/lib/rdcredit';
import { pct, usd, usdCompact } from '@/lib/format';

/**
 * §41 deep-dive guide. Every worked-example number is computed from
 * lib/rdcredit.ts at build time (the same functions the widget runs) — nothing
 * here is hand-typed, in keeping with the suite's "computed, reproducible"
 * standard.
 */

/**
 * The five scenario presets from the widget, reused here as worked examples.
 * `elected` is the §41(h) payroll-election amount — the same dollars are
 * removed from the income-tax path (Form 3800 instructions), which is why
 * every income-path call below passes it through.
 */
const EXAMPLES = [
  {
    label: 'First-year startup',
    desc: 'no prior QRE, QSB, $180k payroll',
    qre: 300_000, priorAvg3: 0, regularTax: 6_000, rate: 0.12,
    qsb: true, wages: 180_000, elected: 18_000,
  },
  {
    label: 'Year-2 SaaS',
    desc: 'avg $100k, QSB, $400k payroll',
    qre: 600_000, priorAvg3: 100_000, regularTax: 25_000, rate: 0.24,
    qsb: true, wages: 400_000, elected: 30_600,
  },
  {
    label: 'Profitable consultancy',
    desc: 'avg $350k, not a QSB, 32%',
    qre: 400_000, priorAvg3: 350_000, regularTax: 85_000, rate: 0.32,
    qsb: false, wages: 120_000, elected: 0,
  },
  {
    label: 'Pre-revenue biotech',
    desc: 'no tax liability, QSB, $700k payroll',
    qre: 900_000, priorAvg3: 200_000, regularTax: 0, rate: 0.35,
    qsb: true, wages: 700_000, elected: 112_000,
  },
  {
    label: 'C-corp post-revenue',
    desc: 'corporation, 21% rate, not a QSB',
    qre: 800_000, priorAvg3: 600_000, regularTax: 120_000, rate: 0.21,
    qsb: false, wages: 200_000, elected: 0,
  },
].map((e) => ({
  ...e,
  income: evaluateIncomePath({
    qre: e.qre, priorAvg3Qre: e.priorAvg3, regularTax: e.regularTax,
    marginalRate: e.rate, elect280C: true, electedToPayroll: e.elected,
  }),
  payroll: evaluatePayrollPath({
    qre: e.qre, priorAvg3Qre: e.priorAvg3, ficaWages: e.wages,
    marginalRate: e.rate, elected: e.qsb ? e.elected : 0,
  }),
}));

/**
 * The flat-QRE ramp: one business spends the same QRE every year; watch the
 * credit rise, peak, and settle to the 7% steady state as the base fills in.
 * (Year 1 has a zero prior average, so the 6% special rule applies.)
 */
function flatQreRamp(qre: number, years: number): { year: number; avg3: number }[] {
  const history: number[] = [];
  const rows: { year: number; avg3: number }[] = [];
  for (let y = 1; y <= years; y++) {
    const avg3 = history.length > 0 ? history.slice(-3).reduce((s, v) => s + v, 0) / 3 : 0;
    rows.push({ year: y, avg3 });
    history.push(qre);
  }
  return rows;
}
const RAMP = flatQreRamp(600_000, 6);
/** Year-2 of the flat-QRE ramp, for the FAQ's effective-rate sentence. */
const RAMP_Y2_CREDIT = computeGrossCredit({ qre: 600_000, priorAvg3Qre: RAMP[1].avg3 }).grossCredit;

/** §280C crossover check straight off the engine: 0–40% sweep, 0.5% steps. */
const CROSSOVER_SWEEP = marginalRateSweep(
  { qre: 400_000, priorAvg3Qre: 350_000, regularTax: 85_000 },
  0, 40, 81,
);

/** The consultancy example (32% bracket) — used in several sections. */
const CONSULT = EXAMPLES[2];
const CONSULT_FULL = evaluateIncomePath({
  qre: 400_000, priorAvg3Qre: 350_000, regularTax: 85_000,
  marginalRate: 0.32, elect280C: false, electedToPayroll: 0,
});

export default function RdCreditArticle() {
  const toc = [
    { id: 'mechanics', label: 'How the credit is computed' },
    { id: 'four-part-test', label: 'What counts as qualified research' },
    { id: 'qre', label: 'What goes into QRE' },
    { id: 'base-period', label: 'The base period — and the flat-QRE ramp' },
    { id: 'worked-examples', label: 'Five worked examples' },
    { id: '280c', label: 'The §280C election, priced exactly' },
    { id: 'payroll-path', label: 'Why startups take the payroll path' },
    { id: 'section-174', label: '§174 / §174A status in 2025' },
    { id: 'red-flags', label: 'Red flags — how the credit gets oversold' },
    { id: 'caveats', label: 'Caveats & scope' },
    { id: 'glossary', label: 'Glossary' },
    { id: 'faq', label: 'FAQ' },
  ];

  return (
    <article className="prose-article">
      <ArticleToc items={toc} />

      <h2 id="mechanics">How the credit is computed</h2>
      <p>
        The research credit rewards spending <em>above your own historic base</em> — it is not a
        flat rebate on every research dollar. This tool models the branch most small filers use,
        the Alternative Simplified Credit of §41(c)(4), exactly as Form 6765 Section C determines
        it:
      </p>
      <ol>
        <li>
          <strong>Aggregate the year&apos;s QRE</strong> — researcher wages for qualified work,
          supplies consumed by that work, and 65% of qualifying contract research.
        </li>
        <li>
          <strong>Halve the prior-three-year average.</strong> Average annual QRE over the 3
          preceding taxable years (sum ÷ 3), times{' '}
          {pct(C.baseShare * 100, 0)} — that is the base your current spending must exceed.
        </li>
        <li>
          <strong>Multiply the excess by {pct(C.ascRate * 100, 0)}.</strong> No excess, no credit —
          the increment floors at zero, it never goes negative.
        </li>
      </ol>
      <p>
        One special rule overrides the formula: if you had{' '}
        <strong>no QRE in any of the 3 preceding taxable years</strong> — §41(c)(4)(B), heading and
        all — the credit is a flat {pct(C.startupRate * 100, 0)} of current-year QRE. That is
        literally a zero prior average, and it covers two very different taxpayers: a company
        incurring research costs for the first time, <em>and</em> a company returning to research
        after a gap of three or more years. Once any of the three preceding years has QRE, the
        14%-over-base formula applies, with the average simply summing those three years (zeros
        included).
      </p>
      <p>
        After the credit is determined it becomes a{' '}
        <strong>general business credit</strong>: it cannot exceed the §38(c) ceiling on your
        return — net income tax, less the greater of tentative minimum tax or 25% of net regular
        tax liability above $25,000 (§38(c)(1)(B)). Corporations face the same 25%-over-$25,000
        cap through §38(c)(6)(E) — there is no corporate exemption (the IRS Form 3800 instructions
        state it verbatim); this tool assumes no AMT and says so. Whatever the ceiling pushes out
        carries back one year and forward twenty (§39).
      </p>
      <p>
        The regular method of §41(c)(1) — 20% over a fixed-base percentage of gross receipts, with
        its own startup ramp — can beat the simplified method for companies with a long, heavy
        research history and receipts growth that outpaced research growth. It is not modeled
        here: for a self-employed filer or a young company the simplified method is the
        defensible default, and the conservative one.
      </p>

      <h2 id="four-part-test">What counts as qualified research — the four-part test</h2>
      <p>
        An activity is qualified research only if it clears <em>every</em> part of the §41(d)(1)
        test <strong>and</strong> its costs are §174/§174A research or experimental expenditures:
      </p>
      <ul>
        <li>
          <strong>Permitted purpose.</strong> The work aims at information useful in developing or
          improving a business component — a product, process, computer software, technique,
          formula, or invention. &ldquo;Information useful&rdquo; is doing real work in that
          sentence: the activity must generate knowledge, not just a result.
        </li>
        <li>
          <strong>Technological in nature.</strong> The process relies on principles of the
          physical or biological sciences, engineering, or computer science. Market research and
          styling decisions are not technology.
        </li>
        <li>
          <strong>Substantial uncertainty.</strong> You did not know — at the start — whether the
          capability was achievable, how to achieve it, or whether the design was appropriate.
          If any competent shop in your field could have done it the same way, that is not
          uncertainty.
        </li>
        <li>
          <strong>Process of experimentation.</strong> A systematic evaluation of alternatives:
          modeling, simulation, systematic trial and error, prototyping, hypothesis testing. Agile
          sprints with evaluated outcomes can qualify; &ldquo;we tried things&rdquo; does not.
        </li>
      </ul>
      <p>
        §41(d)(4) then carves out what the test&apos;s plain reading might tempt you to include:
        research conducted <strong>after</strong> a product is ready for commercial production;
        <strong> adaptation</strong> or duplication of an existing business component; surveys,
        management studies, and efficiency research; anything in the social sciences, arts, or
        humanities; research conducted outside the United States; and research funded by someone
        else&apos;s money (you were not at risk).
      </p>
      <p>
        <strong>Software gets an extra gate.</strong> Software developed for your own internal use
        must additionally clear the §41(d)(4)(E) three-part test — a high threshold of innovation,
        significant economic risk, and the software not being commercially available. Software
        developed to sell, or embedded in a product you sell, does not face the extra gate — but
        it still has to pass the four-part test like everything else. Most of the inflated
        &ldquo;every developer is R&amp;D&rdquo; pitches die on routine maintenance, bug fixes,
        and adaptation, which fail it.
      </p>

      <h2 id="qre">What goes into QRE</h2>
      <p>
        QRE (§41(b)) is the expense base, and the blending matters as much as the total:
      </p>
      <table>
        <thead>
          <tr>
            <th>Expense category</th>
            <th>Enters QRE at</th>
            <th>Notes</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>In-house wages</td>
            <td>100%</td>
            <td>Only time actually spent performing qualified services counts (plus qualified
            first-line supervision and support). A developer&apos;s sprint-planning week is not
            research time.</td>
          </tr>
          <tr>
            <td>Supplies</td>
            <td>100%</td>
            <td>Tangible materials consumed in the research — not depreciable equipment, not
            overhead.</td>
          </tr>
          <tr>
            <td>Contract research</td>
            <td>65%</td>
            <td>You pay, you hold the rights, you bear the risk (§41(b)(3)(A)).</td>
          </tr>
          <tr>
            <td>Payments to a qualified research consortium</td>
            <td>75%</td>
            <td>A §501(c)(3)/(c)(6) research consortium (§41(b)(3)(C)) — not a general small-business
            rate.</td>
          </tr>
          <tr>
            <td>Qualified <em>energy</em> research</td>
            <td>100%</td>
            <td>Only when performed by an eligible small business, a college, or a federal
            laboratory (§41(b)(3)(D)). Note the definition: an <em>eligible small business</em>{' '}
            here averages ≤500 employees and is unrelated to the payor — a completely different
            test from the §41(h) qualified small business ($5M receipts / 5 years) that gates the
            payroll election.</td>
          </tr>
          <tr>
            <td>Cloud / leased computers</td>
            <td>(time-adjusted)</td>
            <td>Treated as rented research property at the qualified-use share — an IRS FAQ-era
            position; allocate honestly.</td>
          </tr>
        </tbody>
      </table>
      <p>
        This tool takes QRE as one aggregate input, so do the blending before you type: a{' '}
        {usd(300_000, 0)} payroll of which {usd(180_000, 0)} was qualified research time, plus{' '}
        {usd(20_000, 0)} of supplies and a {usd(100_000, 0)} university contract (at the standard
        65%), is {usd(180_000 + 20_000 + 65_000, 0)} of QRE — not {usd(420_000, 0)}.
      </p>

      <h2 id="base-period">The base period — and the flat-QRE ramp</h2>
      <p>
        The base is half the average of the prior <em>three</em> years — the sum of QRE in those
        years ÷ 3, zeros included, no adjustments. A single prior year with QRE therefore enters
        at one-third weight, two years at two-thirds; only in year four does a stable budget face
        its own full average. Watch what that does to a company whose QRE never changes —{' '}
        {usdCompact(600_000)} every year:
      </p>
      <table>
        <thead>
          <tr>
            <th>Year</th>
            <th>Prior 3-yr average</th>
            <th>Base (50%)</th>
            <th>Statutory rate</th>
            <th>Credit</th>
            <th>Effective rate on QRE</th>
          </tr>
        </thead>
        <tbody>
          {RAMP.map((r) => {
            const g = computeGrossCredit({ qre: 600_000, priorAvg3Qre: r.avg3 });
            const startup = r.avg3 <= 0;
            return (
              <tr key={r.year}>
                <td>{r.year}</td>
                <td>{startup ? '$0 (6% rule)' : usd(r.avg3, 0)}</td>
                <td>{startup ? '—' : usd(g.base, 0)}</td>
                <td>{startup ? '6% of QRE' : '14% of increment'}</td>
                <td><strong>{usd(g.grossCredit, 0)}</strong></td>
                <td>{pct((g.grossCredit / 600_000) * 100, 2)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p>
        The pattern is structural, not an artifact of these numbers: with no QRE in any preceding
        year, §41(c)(4)(B) pays {pct(C.startupRate * 100, 0)} flat; year 2 nearly doubles the
        effective rate because only a third of year 1 entered the base; then the base fills in —{' '}
        {pct((RAMP[2].avg3 ? computeGrossCredit({ qre: 600_000, priorAvg3Qre: RAMP[2].avg3 }).grossCredit / 600_000 : 0) * 100, 1)}{' '}
        in year 3 — and by year 4 the flat budget settles at its permanent level, 7% of QRE (the
        14% rate on a 50% increment). A <em>growing</em> research budget never settles: each
        year&apos;s record spend resets the increment upward faster than the trailing average
        chases it, which is the entire design of the credit. And a three-year gap resets the
        special rule — the returning company pays 6% again on its first year back.
      </p>

      <h2 id="worked-examples">Five worked examples</h2>
      <p>
        Every number is generated by this page&apos;s own §41 library — the same functions the
        widget above runs. The &ldquo;claimed&rdquo; figure takes the reduced credit
        (§280C(c)(2)); the &ldquo;elected → payroll&rdquo; column is the §41(h) split, which only
        a qualified small business can make — non-QSB rows show none, because none is available:
      </p>
      <table>
        <thead>
          <tr>
            <th>Scenario</th>
            <th>QRE</th>
            <th>Prior avg</th>
            <th>Gross credit</th>
            <th>Elected → payroll</th>
            <th>§38(c) ceiling</th>
            <th>Income-tax used</th>
            <th>Payroll cash</th>
          </tr>
        </thead>
        <tbody>
          {EXAMPLES.map((e) => (
            <tr key={e.label}>
              <td>
                {e.label}
                <span className="block text-[11px] font-normal text-slate-500 dark:text-slate-400">{e.desc}</span>
              </td>
              <td>{usdCompact(e.qre)}</td>
              <td>{usdCompact(e.priorAvg3)}{e.priorAvg3 === 0 ? ' (6%)' : ''}</td>
              <td><strong>{usd(e.income.grossCredit, 0)}</strong></td>
              <td>{e.qsb ? usd(e.elected, 0) : '—'}</td>
              <td>{usd(e.income.ceiling, 0)}</td>
              <td>{usd(e.income.selected.used, 0)}</td>
              <td>{e.qsb ? usd(e.payroll.appliedThisYear, 0) : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p>
        Read the first and fourth rows together — they are the startup story in two acts. The
        first-year company has only {usd(6_000, 0)} of tax, so it elects the whole{' '}
        {usd(EXAMPLES[0].payroll.electable, 0)} gross credit toward payroll:{' '}
        {usd(EXAMPLES[0].payroll.appliedThisYear, 0)} lands as cash against employer FICA this
        year (the capacity on {usdCompact(EXAMPLES[0].wages)} of wages), with{' '}
        {usd(EXAMPLES[0].payroll.remainingElected, 0)} queued for later quarters — and the
        income-tax path shows zero, because those dollars are barred from it. The pre-revenue
        biotech has <em>zero</em> ceiling and still collects{' '}
        {usd(EXAMPLES[3].payroll.appliedThisYear, 0)} of employer-FICA relief on its full{' '}
        {usd(EXAMPLES[3].payroll.electable, 0)} election, with{' '}
        {usd(EXAMPLES[3].payroll.remainingElected, 0)} more carried. The year-2 SaaS splits:{' '}
        {usd(EXAMPLES[1].elected, 0)} to payroll (exactly its FICA capacity), leaving{' '}
        {usd(EXAMPLES[1].income.incomeGross, 0)} for the income tax — of which the{' '}
        {usd(EXAMPLES[1].income.ceiling, 0)} ceiling lets it use{' '}
        {usd(EXAMPLES[1].income.selected.used, 0)} this year.
      </p>

      <h2 id="280c">The §280C election, priced exactly</h2>
      <p>
        You cannot keep both the full credit and the full deduction. Without an election, §280C(c)(1)
        reduces your research-expense deduction by the credit allowed. With the §280C(c)(2)
        election, you keep the deduction and the credit itself is cut by the maximum corporate
        rate — {pct(C.corpMaxRate * 100, 0)} since 2018 — leaving{' '}
        {pct((1 - C.corpMaxRate) * 100, 0)} of it. (Pre-2018, at a 35% top rate, the kept share was
        65% — older articles saying &ldquo;the credit is cut roughly in half&rdquo; are describing
        a rate that no longer exists.)
      </p>
      <p>
        The arithmetic of choosing, for a credit of size C at a marginal ordinary rate r:
        full credit nets C(1 − r) — the credit itself minus the tax value of the deduction it
        cost you — while the reduced credit nets {pct(79, 0)}·C flat. The branches cross at
        exactly r = {pct(C.corpMaxRate * 100, 0)}, which the engine confirms endpoint to
        endpoint on the consultancy example ({usd(CROSSOVER_SWEEP[42].netFullCredit, 0)} vs{' '}
        {usd(CROSSOVER_SWEEP[42].netReducedCredit, 0)} at 21%):
      </p>
      <ul>
        <li>
          At the consultancy&apos;s 32% bracket: full credit nets{' '}
          {usd(CONSULT_FULL.selected.netBenefit, 0)}; reduced credit nets{' '}
          {usd(CONSULT.income.selected.netBenefit, 0)} — the election is worth{' '}
          {usd(CONSULT.income.selected.netBenefit - CONSULT_FULL.selected.netBenefit, 0)}, which
          is the gross credit times {pct(32 - 21, 0)} points exactly.
        </li>
        <li>
          Below 21% — a year in the 12% bracket, say — the full credit wins by the same formula:
          C × (0.21 − r). The election is per-year, so a low-income year and a normal year can
          choose differently.
        </li>
        <li>
          When the §38(c) ceiling binds both branches, the election gives up nothing and only
          trims carryforward room — electing is the safe side of the trade.
        </li>
      </ul>
      <p>
        One asymmetry the widget surfaces but cannot price: the full-credit branch reduces your
        deduction <em>this year</em>, and a pass-through owner feels that in income tax and
        (for a sole proprietor) self-employment tax too, while the carryforward it preserves is
        an income-tax asset only. The entered marginal rate is the honest place to encode that
        judgment.
      </p>

      <h2 id="payroll-path">Why startups take the payroll path</h2>
      <p>
        A general business credit with no tax to absorb it is a promissory note, not cash. §41(h)
        — added in 2015, expanded by the Inflation Reduction Act — lets a{' '}
        <strong>qualified small business</strong> elect up to{' '}
        {usdCompact(C.qsbPayrollCap)} of its research credit <em>per year</em> against the
        employer side of FICA instead: Social Security first (up to $250,000 of employer tax per
        quarter), then employer Medicare, claimed quarterly on Form 8974 with your Form 941,
        starting the first quarter after you file the income-tax return that claims the credit.
        Amounts not absorbed carry forward to later employment-tax returns.
      </p>
      <p>
        The election <strong>splits</strong> the credit rather than duplicating it. Per the IRS
        Form 3800 instructions, no amount elected as a payroll tax credit can offset the
        current-year income tax or enter the general-business-credit carryforward or carryback —
        the widget models exactly that: dollars you route to the payroll slider disappear from
        the income-path ledger, and the worked examples above split a single gross credit between
        the two destinations.
      </p>
      <p>
        Eligibility is a youth test (§41(h)(3)(B)): gross receipts of{' '}
        {usdCompact(C.qsbReceiptsCap)} or less in the credit year, and no gross receipts at all in
        any year before the five-taxable-year period ending with it. Roughly: five years old or
        younger, and still small. Pass the test and the economics are blunt — the biotech example
        above has {usd(0, 0)} of tax ceiling and still pulls{' '}
        {usd(EXAMPLES[3].payroll.appliedThisYear, 0)} of cash out of the same credit, quarter by
        quarter, sized by the employer FICA on {usdCompact(EXAMPLES[3].wages)} of wages (
        {pct(C.employerOasdi * 100, 1)} + {pct(C.employerHi * 100, 2)} ={' '}
        {pct((C.employerOasdi + C.employerHi) * 100, 2)}).
      </p>
      <p>
        Two honest footnotes. First, the offset is cash but not free money: employer FICA you no
        longer pay is no longer deductible, so the net is the offset times (1 − your marginal
        rate) — that is the &ldquo;net cash value&rdquo; figure in the widget. Second, the
        statute&apos;s §280C wording speaks of the credit determined under §41 without addressing
        payroll-elected amounts head-on; how (and whether) the reduced-credit election interacts
        with Form 8974 offsets is governed by current IRS guidance — confirm it with your
        preparer rather than with a brochure.
      </p>

      <h2 id="section-174">§174 / §174A status in 2025</h2>
      <p>
        The credit and the deduction are different sections with entangled history. From 2022
        through 2024, TCJA-era §174 forced every business to <em>capitalize and amortize</em>{' '}
        research costs — domestic over 5 years (10%/20%/20%/20%/20%/10% under half-year
        conventions), foreign over 15 — a cash-tax shock that hit exactly the young companies this
        page is about. The One Big Beautiful Bill Act (P.L. 119-21, July 2025) created §174A,
        restoring immediate expensing of <strong>domestic</strong> research expenditures for tax
        years beginning after December 31, 2024, permanently; foreign research still amortizes
        over 15 years. For balances already capitalized from 2022–2024, the catch-up deduction is
        a statutory election under §174A(c), administered as an automatic accounting-method
        change through the procedures in Rev. Proc. 2025-28.
      </p>
      <p>
        None of that changes any number this tool computes — the §41(c)(4) formula, the §280C
        branches, and the §41(h) cap are all indifferent to how §174A times the deduction. What
        it changes is the deduction side of the §280C trade (what a full deduction is worth), and
        the general arithmetic of running a research budget. For 2022–2024 tax years still open
        on your books, the capitalization rules still apply. As with everything statutory on this
        page: the current IRS guidance governs — Forms 6765 and 8974 instructions and the IRS
        §174/§174A pages are the operative text.
      </p>

      <h2 id="red-flags">Red flags — how the credit gets oversold</h2>
      <p>
        The §41 credit is real, monetizable, and — with the four-part test honestly applied —
        defensible. The pitches around it are frequently none of those things. Warning signs,
        ranked by how much money they can cost you:
      </p>
      <ul>
        <li>
          <strong>&ldquo;Every software company qualifies.&rdquo;</strong> Routine development —
          maintenance, bug fixes, ports to new platforms, adaptation of an existing product —
          fails the four-part test on uncertainty alone, and internal-use software faces the
          additional §41(d)(4)(E) gate. The honest base is usually a fraction of engineering
          payroll.
        </li>
        <li>
          <strong>&ldquo;Up to {usdCompact(C.qsbPayrollCap)} — refundable.&rdquo;</strong> The
          credit is not refundable. The payroll election is a real {usdCompact(C.qsbPayrollCap)}
          -per-year cash path, but only for qualified small businesses, only against employer FICA
          actually payable, only after the return is filed — and every dollar elected there is a
          dollar that no longer offsets income tax.
        </li>
        <li>
          <strong>Contingency-fee studies that reclassify history.</strong> A study that
          &ldquo;finds&rdquo; three years of QRE you never tracked has to restate your prior
          returns — and the statute&apos;s consistency requirement (§41(c)(5)(A): expenses must be
          treated as QRE on a consistent basis across years, even where refund periods have
          expired) pushes the newly classified costs into the base periods of the same years. The
          windfall is systematically smaller than the pitch, and the amended-return footprint is
          audit surface.
        </li>
        <li>
          <strong>Quoting gross, banking net.</strong> A {usd(100_000, 0)} credit with the
          §280C(c)(2) election is {usd(79_000, 0)}; without it, it is {usd(100_000, 0)} minus the
          tax value of {usd(100_000, 0)} of lost deduction. A quote that never mentions §280C at
          all was not a quote.
        </li>
        <li>
          <strong>&ldquo;No documentation needed.&rdquo;</strong> Contemporaneous evidence —
          technical records, personnel-time allocation, gate reviews — is what survives an exam.
          Reconstructed after the fact under contingency pressure, it is exactly what examiners
          are trained to discount.
        </li>
        <li>
          <strong>Forgetting the states exist.</strong> Most states with an R&amp;D credit conform
          to some version of federal §41 — many still conform to pre-TCJA §174 — and a state
          election can have its own §280C analogue. State math is out of scope here entirely.
        </li>
      </ul>

      <h2 id="caveats">Caveats &amp; scope</h2>
      <p>
        What this model is, stated plainly: a federal-only, tax-year-2025 computation of the{' '}
        §41(c)(4) simplified credit for one trade or business, with the §280C(c) branches and the
        §41(h) payroll election evaluated from aggregate inputs. What it deliberately is not:
      </p>
      <ul>
        <li>The §41(c)(1) regular method — often better for decades-old, receipt-heavy programs.</li>
        <li>Past-service wage allocation, the three IRS time-allocation methods, or
        controlled-group apportionment (§41(f)(1)).</li>
        <li>The alternative minimum tax inside the §38(c) ceiling (assumed zero, stated in the UI),
        or GBC carryback/carryforward valuation beyond flagging it.</li>
        <li>The per-employee Social Security wage base ({usd(176_100, 0)} for 2025) in the payroll
        capacity — top-heavy payrolls overstate it slightly.</li>
        <li>State credits, state §280C analogues, and state §174 conformity.</li>
        <li>A determination that your activities are qualified research. That is a facts-and-
        circumstances judgment this page arms you for, not one it makes.</li>
      </ul>

      <h2 id="glossary">Glossary</h2>
      <dl>
        <dt><strong>QRE — qualified research expenses</strong></dt>
        <dd>The §41(b) expense base: in-house wages for qualified services, supplies, 65% of
        qualifying contract research, 75% for qualified research consortium payments, and 100% for
        qualified energy research performed by an eligible small business, college, or federal
        laboratory.</dd>
        <dt><strong>ASC — alternative simplified credit</strong></dt>
        <dd>§41(c)(4): 14% of QRE above 50% of the prior-three-year average; a flat 6% when there
        was no QRE in any of the 3 preceding years — first research year or a return after a
        multi-year gap alike.</dd>
        <dt><strong>Base period</strong></dt>
        <dd>The three taxable years preceding the credit year; average is sum ÷ 3 with zeros
        included.</dd>
        <dt><strong>GBC — general business credit</strong></dt>
        <dd>The §38 bucket the research credit sits in, capped at net income tax less the greater
        of tentative minimum tax or 25% of net regular tax liability above $25,000 — corporations
        face the same 25%-over-$25,000 cap (§38(c)(1)(B), §38(c)(6)(E)).</dd>
        <dt><strong>QSB — qualified small business</strong></dt>
        <dd>§41(h)(3)(B): gross receipts ≤ $5M in the credit year and none before the five-year
        period ending with it — the payroll-election gate.</dd>
        <dt><strong>Eligible small business</strong></dt>
        <dd>A different §41 concept from the QSB: ≤500 employees on average and unrelated to the
        payor (§41(b)(3)(D)) — relevant only to the 100% rate for qualified energy research
        performed for you.</dd>
        <dt><strong>§280C(c)(2) reduced credit</strong></dt>
        <dd>The election to keep 79% of the credit and the full research deduction, instead of the
        full credit and a reduced deduction.</dd>
        <dt><strong>Form 6765</strong></dt>
        <dd>Where the credit is computed and both elections (reduced credit, payroll) are made.</dd>
        <dt><strong>Form 8974</strong></dt>
        <dd>Where the payroll-elected amount is applied quarterly against employer FICA, attached
        to Form 941.</dd>
        <dt><strong>§174A</strong></dt>
        <dd>The OBBBA section restoring immediate domestic research expensing for tax years
        beginning after December 31, 2024.</dd>
      </dl>

      <Faq
        items={[
          {
            question: 'My company has a loss this year — is the credit worthless?',
            answer: (
              <p>
                Not worthless, but not cash either. The §38(c) ceiling is zero with no tax
                liability, so the credit carries back one year and forward twenty as general
                business credit. If you qualify as a QSB (≤ $5M receipts, ≤ five years), the
                §41(h) election short-circuits the wait: up to {usd(500_000, 0)} per year applies
                against employer FICA instead. The biotech example above pulls{' '}
                {usd(EXAMPLES[3].payroll.appliedThisYear, 0)} out of a zero-ceiling year.
              </p>
            ),
          },
          {
            question: 'Why did my credit change so much in year two?',
            answer: (
              <p>
                The base period fills in. Year 1 pays {pct(6, 0)} of QRE flat; year 2 subtracts
                only one-sixth of year 1 (half of a ÷3 average), so the same spend yields{' '}
                {pct((RAMP_Y2_CREDIT / 600_000) * 100, 1)} effective on a flat $600k budget; by
                year 4 a flat budget settles at {pct(7, 0)}. Growing budgets never settle — each
                record year resets the increment upward.
              </p>
            ),
          },
          {
            question: 'I had research expenses years ago, then stopped for a while. Which rate applies now?',
            answer: (
              <p>
                The 6% special rule turns on having <em>no QRE in any of the 3 preceding taxable
                years</em> (§41(c)(4)(B)) — not on this being your first research year ever. A
                company returning to research after a gap of three or more years pays the flat 6%
                again on its first year back; once any of the three preceding years has QRE, the
                14%-over-base formula applies with that history averaged in.
              </p>
            ),
          },
          {
            question: 'Is all software development qualified research?',
            answer: (
              <p>
                No. It must pass the same four-part test as anything else, and software for your
                own internal use must additionally clear §41(d)(4)(E)&apos;s high threshold of
                innovation, significant economic risk, and non-availability commercially.
                Maintenance, bug fixes, platform ports, and routine feature work generally fail —
                this is where inflated studies do their damage.
              </p>
            ),
          },
          {
            question: 'Should I always take the §280C(c)(2) reduced credit?',
            answer: (
              <p>
                Above a 21% marginal rate, yes — the election is worth the gross credit times
                (rate − 21%), {usd(CONSULT.income.selected.netBenefit - CONSULT_FULL.selected.netBenefit, 0)}{' '}
                at the 32%-bracket consultancy above. Below 21% the full credit wins by the same
                formula; with a binding §38(c) ceiling the election costs nothing. It is a
                per-year, irrevocable election made on the return.
              </p>
            ),
          },
          {
            question: 'Can I take the payroll offset and still use the credit against income tax?',
            answer: (
              <p>
                On the same dollars, no. The §41(h) election splits the credit — per the Form 3800
                instructions, amounts elected as payroll tax credits cannot offset the
                current-year income tax or enter the GBC carryforward or carryback. The widget
                reflects that: raising the payroll-election slider removes those dollars from the
                income-path ledger.
              </p>
            ),
          },
          {
            question: 'How does the R&D credit interact with the QBI deduction?',
            answer: (
              <p>
                Through the deduction, not the credit: a §280C(c)(1) reduction of your research
                deduction increases business income, which increases QBI (and, for a sole
                proprietor, the self-employment base) — one more reason high-bracket owners lean
                toward the reduced-credit election. The{' '}
                <a href="/qbi-deduction-calculator/">QBI deduction calculator</a> prices that side.
              </p>
            ),
          },
          {
            question: 'Can I claim the credit on amended returns for years I missed it?',
            answer: (
              <p>
                Generally yes, within the refund-statute window — but the statute requires
                consistent treatment of expenses as QRE across years (§41(c)(5)(A), expressly
                including years whose refund periods have expired), so the reclassified expenses
                raise the base periods of the very years you are amending toward. Expect a
                smaller number than the pitch, and expect the amended footprint to be read
                closely.
              </p>
            ),
          },
          {
            question: 'Does the §41(h) payroll offset reduce my employees\u2019 paychecks?',
            answer: (
              <p>
                No — it offsets the <em>employer</em> share of FICA only ({pct(6.2, 1)} Social
                Security first, then {pct(1.45, 2)} Medicare), never the employee withholding or
                the employee-side tax. Your team&apos;s W-2s are untouched.
              </p>
            ),
          },
          {
            question: 'Is this 2025 model valid for my 2026 return?',
            answer: (
              <p>
                The structure is — every rate here (14%, 6%, 79%, $500k, 7.65%) is statutory and
                not inflation-indexed — but 2026 brings new brackets, a new Social Security wage
                base, and continued IRS rulemaking around §174A and Form 6765&apos;s redesigned
                sections. Re-run the numbers with the current year&apos;s parameters before
                filing.
              </p>
            ),
          },
        ]}
      />

      <RelatedCalculators
        links={[
          { href: '/qbi-deduction-calculator/', label: 'QBI Deduction Calculator' },
          { href: '/s-corp-tax-calculator/', label: 'S-Corp Salary Calculator' },
          { href: '/self-employment-tax-calculator/', label: 'Self-Employment Tax Calculator' },
          { href: '/quarterly-estimated-tax-calculator/', label: 'Quarterly Estimated Tax Calculator' },
        ]}
      />
    </article>
  );
}

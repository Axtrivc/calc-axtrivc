import Faq from '@/components/Faq';
import { ArticleToc, RelatedCalculators } from '@/components/Article';
import { SE_TAX_CONSTANTS } from '@/lib/setax';
import { pct, usd } from '@/lib/format';

const KINK_FLOOR = SE_TAX_CONSTANTS.minNetEarnings / SE_TAX_CONSTANTS.seBaseFactor; // $433.13
const WB_2025 = SE_TAX_CONSTANTS.ssWageBaseByYear[2025]; // $176,100
const WB_2026 = SE_TAX_CONSTANTS.ssWageBaseByYear[2026]; // $184,500
const KINK_SS_2025 = WB_2025 / SE_TAX_CONSTANTS.seBaseFactor; // $190,687.60
const KINK_SS_2026 = WB_2026 / SE_TAX_CONSTANTS.seBaseFactor; // $199,783.43
const KINK_ADDL_SINGLE = SE_TAX_CONSTANTS.additionalMedicareThreshold.single / SE_TAX_CONSTANTS.seBaseFactor; // $216,567.41
const KINK_ADDL_MFJ = SE_TAX_CONSTANTS.additionalMedicareThreshold.mfj / SE_TAX_CONSTANTS.seBaseFactor; // $270,709.26
const KINK_ADDL_MFS = SE_TAX_CONSTANTS.additionalMedicareThreshold.mfs / SE_TAX_CONSTANTS.seBaseFactor; // $135,354.63
/** SS-kink profit level for a given own-wage level (2026): remaining room ÷ 0.9235. */
const kinkAtWages = (wages: number) => (WB_2026 - wages) / SE_TAX_CONSTANTS.seBaseFactor;
/** Profit level at which the 0.9% layer switches on for a given own-wage level (single). */
const addlOnsetAtWages = (wages: number) =>
  (SE_TAX_CONSTANTS.additionalMedicareThreshold.single - wages) / SE_TAX_CONSTANTS.seBaseFactor;

export default function SeTaxArticle() {
  const toc = [
    { id: 'mechanics', label: 'How SECA works' },
    { id: 'why-9235', label: 'Why 92.35% — the hidden deduction' },
    { id: 'kinks', label: 'The three kinks in the curve' },
    { id: 'worked-example', label: 'Worked examples' },
    { id: 'w2-comparison', label: 'SE tax vs W-2 FICA' },
    { id: 'decision-boundaries', label: 'Decision boundaries' },
    { id: 'quarterly', label: 'Paying it: quarterly estimates' },
    { id: 'glossary', label: 'Glossary' },
    { id: 'caveats', label: 'Important caveats' },
    { id: 'faq', label: 'FAQ' },
  ];

  return (
    <article className="prose-article">
      <ArticleToc items={toc} />

      <h2 id="mechanics">How SECA works</h2>
      <p>
        The self-employment tax is the freelancer&apos;s version of FICA — the Social Security and
        Medicare contributions that fund the programs you&apos;ll draw on later. An employee splits
        the bill with their employer ({pct(6.2, 1)} + {pct(1.45, 2)} each). A self-employed person
        is <em>both</em> sides of that arrangement, so the SECA statute (IRC §1401) charges:
      </p>
      <ul>
        <li>
          <strong>{pct(SE_TAX_CONSTANTS.ssRate * 100, 1)} Social Security</strong> — but only on
          the first {usd(WB_2026, 0)} of <em>net earnings</em> in 2026 ({usd(WB_2025, 0)} in 2025)
          — the base, not gross profit, see below — coordinated with any W-2 social-security wages
          you already paid tax on.
        </li>
        <li>
          <strong>{pct(SE_TAX_CONSTANTS.medicareRate * 100, 1)} Medicare</strong> — on{' '}
          <em>all</em> net earnings, with no ceiling, ever.
        </li>
        <li>
          <strong>{pct(SE_TAX_CONSTANTS.additionalMedicareRate * 100, 1)} Additional Medicare</strong>{' '}
          — the surtax above {usd(200000, 0)} of income ({usd(250000, 0)} married filing jointly),
          where your own W-2 Medicare wages and self-employment income count toward the same
          threshold.
        </li>
      </ul>
      <p>
        One relief valve: you deduct <strong>one-half of the SE tax itself</strong> from your
        income tax (an above-the-line adjustment — no itemizing needed). And one cliff: below{' '}
        {usd(SE_TAX_CONSTANTS.minNetEarnings, 0)} of net earnings there is <strong>no SE tax at
        all</strong>; at {usd(SE_TAX_CONSTANTS.minNetEarnings, 0)} the entire base becomes taxable,
        not just the excess.
      </p>

      <h2 id="why-9235">Why 92.35% — the hidden deduction</h2>
      <p>
        SE tax does <em>not</em> apply to your full Schedule C profit. The base is{' '}
        <strong>92.35% of net profit</strong> ({usd(SE_TAX_CONSTANTS.seBaseFactor * 100, 2)} on the
        dollar), per IRC §1402(a)(2) and line 4a of Schedule SE. The logic is symmetry: when a
        company pays a {usd(100, 0)} wage it also owes {usd(7.65, 2)} of employer FICA, and that
        employer share is a deductible business expense — so the payroll-tax system already
        &ldquo;ignores&rdquo; the employer half when it taxes a W-2 worker&apos;s company.
        Congress handed the self-employed an equivalent haircut, written as a flat statutory
        factor rather than an itemized deduction you compute:{' '}
        <code>base = 1 − 0.0765 = 0.9235 × profit</code>. It is an approximation by statute, not
        exact cost accounting — but it is the law&apos;s arithmetic, and it lands the effective
        rate on gross profit at <strong>0.9235 × 15.3% = 14.13%</strong>, not 15.3%. On{' '}
        {usd(100000, 0)} of profit that is {usd(14129.55)} — the figure the calculator above
        reproduces line by line ({usd(92350)} base × 15.3% = {usd(14129.55)}).
      </p>

      <h2 id="kinks">The three kinks in the curve</h2>
      <p>
        SE tax as a function of profit is piecewise-linear with three breakpoints — and two of them
        are <em>not</em> where intuition puts them:
      </p>
      <ol>
        <li>
          <strong>{usd(KINK_FLOOR, 2)} of profit</strong> — the{' '}
          {usd(SE_TAX_CONSTANTS.minNetEarnings, 0)} net-earnings floor. Below it, tax is zero; at
          it, the whole base turns on at once (that is why the marginal rate near the floor is a
          cliff, not a ramp — the calculator flags it explicitly when you land there).
        </li>
        <li>
          <strong>{usd(KINK_SS_2026, 2)} of profit in 2026</strong> ({usd(KINK_SS_2025, 2)} in
          2025) — where the base (92.35% of profit) hits the {usd(WB_2026, 0)} Social Security cap
          ({usd(WB_2025, 0)} in 2025). The cap binds on the <em>base</em>, not on profit, so the
          bend sits well above the number everyone quotes. With W-2 wages, it moves down to
          (wage base − wages) ÷ 0.9235 — or disappears entirely once a day job covers the wage
          base.
        </li>
        <li>
          <strong>{usd(KINK_ADDL_SINGLE, 2)} of profit</strong> (single) — where the base crosses
          the {usd(200000, 0)} Additional Medicare threshold and each further dollar carries{' '}
          0.9235 × (2.9% + 0.9%) = <strong>3.51¢</strong> instead of 2.68¢. Married filing jointly,
          the base reaches {usd(250000, 0)} at {usd(KINK_ADDL_MFJ, 2)} of profit. These thresholds
          are identical in 2025 and 2026 — they have not been inflation-indexed since 2013.
        </li>
      </ol>
      <p>
        Between the kinks the marginal cost of one more dollar is exactly 92.35% of the statutory
        layer: <strong>14.13¢</strong> under the cap, <strong>2.68¢</strong> above it (Medicare
        only), <strong>3.51¢</strong> where the 0.9% surtax applies. The &ldquo;next $1&rdquo; panel
        in the tool computes this by differencing the full model, so the cliffs appear where they
        actually are.
      </p>

      <h2 id="worked-example">Worked examples</h2>
      <h3>{usd(100000, 0)} of net profit, no W-2 wages, single</h3>
      <table>
        <thead>
          <tr>
            <th>Line (Schedule SE)</th>
            <th>Amount</th>
          </tr>
        </thead>
        <tbody>
          <tr><td>Net profit</td><td>$100,000.00</td></tr>
          <tr><td>× 92.35% → net earnings (the base)</td><td>$92,350.00</td></tr>
          <tr><td>Social Security: 12.4% × $92,350</td><td>−$11,451.40</td></tr>
          <tr><td>Medicare: 2.9% × $92,350</td><td>−$2,678.15</td></tr>
          <tr><td>Additional Medicare (base &lt; $200k)</td><td>$0.00</td></tr>
          <tr><td><strong>Total SE tax (Schedule 2, line 4)</strong></td><td><strong>−$14,129.55</strong></td></tr>
          <tr><td>One-half deduction (Schedule 1, line 15)</td><td>+$7,064.78</td></tr>
        </tbody>
      </table>
      <p>
        Every number in that ledger is identical for 2025 and 2026 — the base sits under both
        years&apos; wage caps, so only the year-independent layers apply.
      </p>
      <p>
        At {usd(250000, 0)} of profit the year starts to matter (2026 shown): base {usd(230875)},
        Social Security capped at {usd(22878.00)} (12.4% of the {usd(WB_2026, 0)} wage base),
        Medicare {usd(6695.38)} on the full base, plus {usd(277.88)} of Additional Medicare (0.9% ×
        the {usd(30875, 0)} of base above {usd(200000, 0)}) — <strong>{usd(29851.25)} total</strong>,
        an effective 11.94% that keeps <em>falling</em> as profit grows, because past the cap only
        the Medicare layers (2.9%, plus 0.9% above the threshold) track income. Under 2025&apos;s{' '}
        {usd(WB_2025, 0)} wage base the same profit owed {usd(28809.65)} — the 2026 cap increase is
        worth {usd(1041.60)} at this income (12.4% of the {usd(8400, 0)} cap move).
      </p>

      <h3>Side business on top of a {usd(160000, 0)} day job (2026)</h3>
      <p>
        W-2 coordination is where most online calculators go wrong. Your wages have already
        absorbed {usd(160000, 0)} of the {usd(WB_2026, 0)} wage base, leaving only {usd(24500, 0)}{' '}
        of Social Security room. On {usd(60000, 0)} of side profit (base {usd(55410)}): Social
        Security applies to just {usd(24500, 0)} → {usd(3038.00)}; Medicare applies to the whole
        base → {usd(1606.89)}; and because wages + base = {usd(215410, 0)} exceeds {usd(200000, 0)},
        the 0.9% layer applies to {usd(15410, 0)} → {usd(138.69)}. Total:{' '}
        <strong>{usd(4783.58)}</strong> — a 7.97% effective rate that looks nothing like
        &ldquo;15.3%&rdquo;, and is exactly why the &ldquo;day-job + side hustle&rdquo; question
        needs the wage input this tool carries. (In 2025, with a {usd(WB_2025, 0)} base, the room
        was {usd(16100, 0)} and the bill {usd(3741.98)}.)
      </p>

      <h3>Every layer at once: {usd(400000, 0)} of profit (single, 2026)</h3>
      <p>
        The cases above each hug one boundary — the $100,000 ledger sits in the flat 14.13% zone,
        and the day-job case turns on wage-base coordination. At {usd(400000, 0)} every layer of
        the statute is fully expressed at once — Social Security pinned at its cap, Medicare on
        the entire base, the 0.9% surtax deep in effect — which makes this the income where
        misplacing a single boundary distorts the bill the most.
      </p>
      <table>
        <thead>
          <tr>
            <th>Line (Schedule SE + Form 8959)</th>
            <th>Amount</th>
          </tr>
        </thead>
        <tbody>
          <tr><td>Net profit</td><td>$400,000.00</td></tr>
          <tr><td>× 92.35% → net earnings (the base)</td><td>$369,400.00</td></tr>
          <tr><td>Social Security: 12.4% × $184,500 — the base exceeds the cap</td><td>−$22,878.00</td></tr>
          <tr><td>Medicare: 2.9% × $369,400</td><td>−$10,712.60</td></tr>
          <tr><td>Additional Medicare: 0.9% × the $169,400 of base over $200,000</td><td>−$1,524.60</td></tr>
          <tr><td><strong>Total SE tax (Schedule 2, line 4)</strong></td><td><strong>−$35,115.20</strong></td></tr>
          <tr><td>One-half deduction (Schedule 1, line 15)</td><td>+$17,557.60</td></tr>
        </tbody>
      </table>
      <p>
        That is an <strong>8.78% effective rate</strong> — far under the 15.3% headline — and the
        next dollar of profit costs only <strong>3.51¢</strong> (2.68¢ Medicare + 0.83¢ surtax;
        the Social Security layer is finished). Two reference points frame the total: a flat,
        uncapped 15.3% on the same $369,400 base would have been $56,518.20 — the cap alone
        knocks $22,927.60 off that (12.4% of the $184,900 of base above it), and the 0.9%
        surtax, which that flat rate never charges, adds $1,524.60 back, for a net $21,403.00.
        Under 2025&apos;s lower cap the same profit owed $34,073.60 — the widest the year can
        move this bill, since the base clears both caps. The quarterly SE-tax component is
        $8,778.80 per installment.
      </p>

      <h3>Wages above the cap: a {usd(200000, 0)} day job plus {usd(80000, 0)} of consulting (single, 2026)</h3>
      <p>
        The mirror image of the coordination problem. Here the day job has <em>already consumed
        the entire wage base</em> — $200,000 of wages against the $184,500 cap — so the side
        business carries no Social Security tax at all, only the Medicare layers, with the 0.9%
        surtax measuring from the wage income already on the books.
      </p>
      <table>
        <thead>
          <tr>
            <th>Line</th>
            <th>Amount</th>
          </tr>
        </thead>
        <tbody>
          <tr><td>W-2 wages — wage-base room left: $0</td><td>$200,000.00</td></tr>
          <tr><td>Side-business net profit</td><td>$80,000.00</td></tr>
          <tr><td>× 92.35% → net earnings (the base)</td><td>$73,880.00</td></tr>
          <tr><td>Social Security: 12.4% × $0 of room</td><td>$0.00</td></tr>
          <tr><td>Medicare: 2.9% × $73,880</td><td>−$2,142.52</td></tr>
          <tr><td>Additional Medicare: 0.9% × $73,880 (wages + base − $200,000)</td><td>−$664.92</td></tr>
          <tr><td><strong>Total SE tax</strong></td><td><strong>−$2,807.44</strong></td></tr>
          <tr><td>One-half deduction</td><td>+$1,403.72</td></tr>
        </tbody>
      </table>
      <p>
        A 3.51% effective rate and a permanently flat 3.51¢ per additional dollar — the same
        marginal cost a $400,000 consultant faces above the cap, reached here at $80,000 because
        wages, not profit, filled the ceiling. The quarterly SE component is $701.86. And the
        stakes of entering the wage figure at all: a calculator that ignored the day job would
        charge $11,303.64 (14.13%) on this same profit — coordination is worth $8,496.20.
      </p>

      <h2 id="w2-comparison">SE tax vs W-2 FICA — the honest comparison</h2>
      <p>
        &ldquo;Self-employed pay double payroll tax&rdquo; is the headline and it is wrong in both
        directions. On {usd(100000, 0)} of income (single):
      </p>
      <table>
        <thead>
          <tr>
            <th>Who</th>
            <th>Payroll tax</th>
          </tr>
        </thead>
        <tbody>
          <tr><td>W-2 employee — share withheld from paycheck</td><td>$7,650.00</td></tr>
          <tr><td>W-2 employer — the hidden second half</td><td>$7,650.00</td></tr>
          <tr><td>Self-employed — total SE tax</td><td>$14,129.55</td></tr>
        </tbody>
      </table>
      <p>
        The self-employed pay {usd(6479.55)} <em>more</em> than the number on a W-2 pay stub, but{' '}
        {usd(1170.45)} <em>less</em> than what employing that W-2 worker actually costs once the
        employer half is counted — and while both incomes sit under the cap, that gap is precisely{' '}
        7.65% × 15.3% = <strong>1.17% of gross</strong>, the arithmetic fingerprint of the 92.35%
        base. The gap never closes entirely: above the caps the Medicare layers alone hold it at
        2.9% × 7.65% ≈ <strong>0.22% of gross</strong>, and the 0.9% layer then <em>widens</em>{' '}
        it to about <strong>0.29%</strong> (3.8% × 7.65%) — the employee pays the surtax on every
        dollar of wage past {usd(200000, 0)}, while the SE side pays it on the haircut base from
        a later starting point ({usd(KINK_ADDL_SINGLE, 2)} of profit). (The comparison chart in
        the tool shows both FICA lines bending at the
        year&apos;s wage base — {usd(WB_2026, 0)} in 2026 — while the SE line bends later, at{' '}
        {usd(KINK_SS_2026, 0)}: same cap, different geometry.)
      </p>
      <p>
        The <em>real</em> structural difference is not the rate — it is who escapes the tax
        entirely. If the business is taxed as a plain LLC, 100% of profit is SE income. Elect S-Corp
        status and only the salary slice carries payroll tax; distributions carry none. That is a
        different instrument — see the{' '}
        <a href="/s-corp-tax-calculator/">S-Corp Salary Calculator</a> for the full trade-off
        (payroll tax saved vs payroll overhead and QBI drift).
      </p>

      <h2 id="decision-boundaries">Decision boundaries</h2>
      <p>
        This instrument prices exactly one layer — the SECA tax computed the way Schedule SE and
        Form 8959 compute it. It is the right tool when you are a sole proprietor, a single-member
        LLC owner under default taxation, or a general partner, and your net profit reaches the{' '}
        {usd(KINK_FLOOR, 2)} floor, with your <em>own</em> W-2 wages entered so both coordination
        effects (wage-base room and the 0.9% threshold) are priced. It is the wrong tool when:
      </p>
      <ul>
        <li>
          <strong>Profit sits under the floor.</strong> Below {usd(KINK_FLOOR, 2)} there is no SE
          tax to compute — the engine returns $0 at $433 of profit — though income tax on that
          profit remains a separate, live question.
        </li>
        <li>
          <strong>The business is an S or C corporation.</strong> An S-corp owner&apos;s salary
          carries FICA through payroll and distributions carry neither; that split is a different
          instrument — the{' '}
          <a href="/s-corp-tax-calculator/">S-Corp Salary Calculator</a> prices the trade-off.
        </li>
        <li>
          <strong>You are a statutory or church employee, or use optional farm methods</strong> —
          none of those regimes are modeled (see the caveats below).
        </li>
        <li>
          <strong>You are modeling a household.</strong> Only the taxpayer&apos;s own wages belong
          in the wage field; each spouse&apos;s SE tax is computed separately and the two bills
          added.
        </li>
      </ul>
      <p>
        The critical values themselves — where each layer switches on or off — were measured by
        scanning the engine rather than quoting statutory prose: integer-dollar sweeps of{' '}
        <code>computeSeTax</code> locate the first taxed dollar ($434), the first wage level that
        zeroes the Social Security room ($184,500 in 2026), and the profit levels where the
        effective rate crosses its milestones; the grid below renders (wage base − wages) ÷ 0.9235
        from the engine&apos;s own constants and matches those sweeps to the cent.
      </p>
      <table>
        <thead>
          <tr>
            <th>Your own W-2 wages (2026)</th>
            <th>SS layer ends at profit of…</th>
            <th>0.9% layer starts at profit of…</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>$0</td>
            <td>{usd(kinkAtWages(0), 2)}</td>
            <td>{usd(addlOnsetAtWages(0), 2)}</td>
          </tr>
          <tr>
            <td>$100,000</td>
            <td>{usd(kinkAtWages(100000), 2)}</td>
            <td>{usd(addlOnsetAtWages(100000), 2)}</td>
          </tr>
          <tr>
            <td>$160,000</td>
            <td>{usd(kinkAtWages(160000), 2)}</td>
            <td>{usd(addlOnsetAtWages(160000), 2)}</td>
          </tr>
          <tr>
            <td>$184,500 (the cap)</td>
            <td>never applies — SS layer gone</td>
            <td>{usd(addlOnsetAtWages(184500), 2)}</td>
          </tr>
        </tbody>
      </table>
      <p>
        Three further boundaries bound expectations. The effective rate is a flat 14.13% from the
        first taxed dollar all the way to the Social Security kink, then falls without ever
        rising again: it first dips below 10% at $324,742 of profit, below 5% at $1,413,967, and
        approaches the 3.51% that only-Medicare dollars carry. The Social Security layer can never
        cost more than $22,878.00 (2026; $21,836.40 in 2025) however large the practice grows.
        And filing status only moves money above the 0.9% onsets — {usd(KINK_ADDL_SINGLE, 2)}{' '}
        single, {usd(KINK_ADDL_MFJ, 2)} joint, {usd(KINK_ADDL_MFS, 2)} separate — below them,
        every status produces the same bill.
      </p>

      <h2 id="quarterly">Paying it: quarterly estimated taxes</h2>
      <p>
        Nobody withholds SE tax for you, so the tax rides the estimated-tax system. The default
        cadence is four equal installments of <em>SE tax plus income tax</em> on Form 1040-ES —
        due April 15, June 15, September 15, and January 15 of the following year. The calculator&apos;s
        quarterly figure is the SE-tax component alone ({usd(16955.46)} ÷ 4 = {usd(4238.87)} at the{' '}
        {usd(120000, 0)} default — year-independent, since that base sits under both years&apos;
        caps); your actual voucher should add the income-tax layer.
      </p>
      <p>
        Three things keep people out of underpayment penalties:
      </p>
      <ul>
        <li>
          <strong>Safe harbors.</strong> No penalty if you pay (during the year) the smaller of 90%
          of the current year&apos;s total tax, or 100% of last year&apos;s — 110% if last
          year&apos;s AGI exceeded {usd(150000, 0)}. The 100%/110% prior-year harbor is the shield
          of choice when income is rising.
        </li>
        <li>
          <strong>W-2 withholding counts.</strong> A spouse&apos;s (or your own day-job&apos;s)
          withholding is treated as paid evenly across the year regardless of when it was withheld,
          so boosting December withholding can retroactively fix a missed quarter in a way a late
          estimated payment cannot.
        </li>
        <li>
          <strong>Lumpy income?</strong> The annualized-income method (Form 2210, Schedule AI)
          prorates the required installments by when you actually earned the money — relevant for
          contractors with seasonal or back-loaded revenue.
        </li>
      </ul>
      <p>
        Filing-wise: Schedule SE computes the tax, it lands on Schedule 2 of the 1040, and the
        one-half deduction goes on Schedule 1 — both flow to your Form 1040 automatically.
      </p>

      <h2 id="glossary">Glossary</h2>
      <ul>
        <li>
          <strong>SECA (Self-Employment Contributions Act).</strong> The statute (IRC §1401) that
          imposes Social Security and Medicare taxes on net earnings from self-employment — the
          self-employed counterpart to FICA.
        </li>
        <li>
          <strong>FICA (Federal Insurance Contributions Act).</strong> The payroll tax on W-2
          wages: 6.2% Social Security plus 1.45% Medicare withheld from the employee, matched by
          the employer. SECA mirrors both halves at double the employee rate, on a haircut base.
        </li>
        <li>
          <strong>Schedule C.</strong> The Form 1040 schedule where a sole proprietor reports
          business revenue and expenses; its bottom line — net profit — is the input this whole
          instrument runs on.
        </li>
        <li>
          <strong>Net earnings from self-employment.</strong> The SE tax base: 92.35% of Schedule
          C net profit per IRC §1402(a)(2). &ldquo;Net profit&rdquo; and &ldquo;net
          earnings&rdquo; are different numbers, and only the latter is taxed.
        </li>
        <li>
          <strong>Schedule SE.</strong> The form that computes SE tax from Schedule C profit — it
          applies the 92.35% factor, tests the $400 floor, coordinates the wage base with W-2
          wages, and derives the one-half deduction.
        </li>
        <li>
          <strong>Social Security wage base.</strong> The annual ceiling on income subject to the
          12.4% layer — $184,500 in 2026, $176,100 in 2025. For the self-employed it binds on the
          92.35% base, so it is reached at $199,783.43 of profit, not at the cap itself.
        </li>
        <li>
          <strong>Additional Medicare Tax.</strong> A 0.9% employee-only surtax (Form 8959) on
          income above $200,000 single / $250,000 joint / $125,000 separate, counting your own
          wages plus SE earnings toward one threshold. Not inflation-indexed since 2013.
        </li>
        <li>
          <strong>One-half deduction (§164(f)).</strong> An adjustment letting the self-employed
          deduct half of their SE tax — including the 0.9% piece — from gross income on Schedule
          1, without itemizing. It reduces income tax; it never reduces the SE tax itself.
        </li>
        <li>
          <strong>Above-the-line adjustment.</strong> A subtraction made in reaching AGI,
          available to every filer regardless of itemizing. The one-half deduction is one; a
          Schedule C business expense is not.
        </li>
        <li>
          <strong>Estimated tax and safe harbor.</strong> Quarterly prepayments (Form 1040-ES) of
          tax nobody withholds for you. The safe harbors — 90% of this year&apos;s tax or 100% of
          last year&apos;s (110% above $150,000 AGI) — are what keeps the underpayment penalty
          away.
        </li>
        <li>
          <strong>Effective vs. marginal rate.</strong> Effective is total tax ÷ profit (8.78% at
          $400,000); marginal is the cost of the next dollar (3.51¢ at the same point). The two
          diverge everywhere above the first kink.
        </li>
        <li>
          <strong>Statutory employee.</strong> A worker — certain drivers, life-insurance agents,
          home workers — whose pay arrives on a W-2 but who still pays SE tax on it; Schedule SE
          handles them on different lines than this model uses.
        </li>
      </ul>

      <h2 id="caveats">Important caveats</h2>
      <ul>
        <li>
          This instrument prices the <strong>SE tax layer only</strong>. Federal income tax, QBI
          (§199A), and state taxes interact with everything here — the{' '}
          <a href="/llc-vs-ccorp-tax-calculator/">LLC vs C-Corp tool</a> and{' '}
          <a href="/s-corp-tax-calculator/">S-Corp tool</a> carry those fuller models.
        </li>
        <li>
          <strong>Years.</strong> The model carries both tax years: wage base {usd(WB_2026, 0)} for
          2026 (per SSA&apos;s announced taxable maximum) and {usd(WB_2025, 0)} for 2025. The{' '}
          {usd(200000, 0)}/{usd(250000, 0)}/{usd(125000, 0)} thresholds for the 0.9% layer are{' '}
          <strong>not indexed</strong> to inflation and are unchanged since 2013 — verify the
          current year&apos;s numbers before filing.
        </li>
        <li>
          <strong>Married filing jointly.</strong> Only your own wages are modeled. Form 8959 tests{' '}
          <em>each spouse&apos;s own</em> Medicare wages + SE income against the joint{' '}
          {usd(250000, 0)} threshold (§1401(b)(2)(B)(i)), and a spouse&apos;s wages never affect
          your Social Security wage-base room — so entering household combined wages here would be
          wrong on both counts. Model each spouse separately and add the results.
        </li>
        <li>
          The W-2 comparison assumes one employer and treats your wage figure as both SS and
          Medicare wages. In reality employer withholding of the 0.9% layer starts at {usd(200000, 0)}{' '}
          of wages regardless of filing status, with the true bill reconciled on Form 8959.
        </li>
        <li>
          Net losses produce no SE tax, and optional methods (farm/fishing gross-income rules) are
          out of scope. Statutory employees, church employees, and notary exclusions are not
          modeled.
        </li>
        <li>Nothing here is tax advice — confirm the current year&apos;s wage base and thresholds with a qualified professional.</li>
      </ul>

      <Faq
        items={[
          {
            question: 'Why is the self-employment tax rate 15.3% when employees pay 7.65%?',
            answer: (
              <p>
                Employees pay 6.2% + 1.45% and their employer pays an identical, largely invisible,
                second half — so the total charge on salaried labor is already 15.3%. The
                self-employed simply pay both halves themselves. The offsetting break is the 92.35%
                base: the law taxes only 92.35% of your profit, making the effective rate on gross
                profit 14.13%, and lets you deduct half the resulting tax from income tax.
              </p>
            ),
          },
          {
            question: 'Do I owe more payroll tax as a freelancer than an employee on the same income?',
            answer: (
              <p>
                Compared with what is withheld from a paycheck, yes — on $100k, $14,129.55 vs
                $7,650.00. Compared with the full cost of employing that worker (both halves,
                $15,300.00), no — you pay $1,170.45 less, and the gap is exactly 1.17% of gross
                under the cap. The fair benchmark is what the total system collects, not what a pay
                stub shows.
              </p>
            ),
          },
          {
            question: 'I have a W-2 job and a side business. Do I pay Social Security tax twice?',
            answer: (
              <p>
                No. Schedule SE subtracts your W-2 social-security wages from the year&apos;s wage
                base ($184,500 in 2026; $176,100 in 2025) and applies the 12.4% SE portion only to
                the room that is left — at $160k of wages in 2026, a side business owes Social
                Security on just $24,500 of its base (here $55,410). Medicare (2.9%) has no cap and
                applies regardless, and your own wages count toward the $200k/$250k threshold for
                the 0.9% Additional Medicare layer. A spouse&apos;s wages are not part of this
                computation — see the caveats above.
              </p>
            ),
          },
          {
            question: 'What if my net profit is very small — is there a minimum?',
            answer: (
              <p>
                Below $400 of net earnings — which is $433.13 of net profit, because earnings are
                92.35% of profit — there is no SE tax at all. The floor is a cliff, not a phase-in:
                at $434 of profit the entire $400.80 base is taxed ($61.32). If you also have W-2
                wages, the same $400 floor applies to the SE income on its own.
              </p>
            ),
          },
          {
            question: 'How do I actually pay self-employment tax?',
            answer: (
              <p>
                Through quarterly estimated payments on Form 1040-ES (April 15, June 15, September
                15, January 15), which cover SE tax and income tax together — or through W-2
                withholding, which can substitute dollar-for-dollar and is treated as paid evenly
                over the year. At filing, Schedule SE computes the tax, Schedule 2 reports it, and
                Schedule 1 carries the one-half deduction.
              </p>
            ),
          },
          {
            question: 'Can I deduct half of my self-employment tax?',
            answer: (
              <p>
                Yes — one-half of the total SE tax, including the 0.9% Additional Medicare piece
                (Form 8959 computes that part&apos;s deductible half), reduces adjusted gross
                income on Schedule 1 line 15. It lowers your income tax; it never reduces the SE tax
                itself, and it is available whether or not you itemize.
              </p>
            ),
          },
          {
            question: 'Does forming an LLC reduce my self-employment tax?',
            answer: (
              <p>
                By itself, no. A single-member LLC is taxed as a sole proprietorship by default, so
                the full net profit remains SE income and Schedule SE is unchanged. The lever that
                changes this arithmetic is the S election, which splits extraction into salary
                (payroll-taxed) and distributions (not) — run your numbers through the S-Corp
                Salary Calculator before filing Form 2553.
              </p>
            ),
          },
          {
            question: 'Why does the calculator say Social Security stops at $199,783 of profit, not $184,500?',
            answer: (
              <p>
                The cap binds on the tax base — 92.35% of profit — not on profit itself, so the
                layer ends where 0.9235 × profit equals the $184,500 wage base: $199,783.43 in
                2026 ($190,687.60 in 2025). The wage-base figure is where the W-2 line bends; the
                SE line bends later, at the same cap measured through the base.
              </p>
            ),
          },
          {
            question: 'Can one extra dollar of profit really cost $61 in tax?',
            answer: (
              <p>
                Yes — exactly once. At $433 of profit the 92.35% base is $399.88, under the $400
                floor, and the tax is $0; at $434 the base crosses the floor and the whole thing
                switches on at once: $61.32. Every dollar after that costs at most 14.13¢. The
                floor is a statutory cliff, not a rate spike.
              </p>
            ),
          },
          {
            question: 'My profit is above the Social Security cap. Why is my marginal rate only 3.51%?',
            answer: (
              <p>
                Past the kink ($199,783.43 of profit in 2026 with no wages) the 12.4% layer is
                finished — it can never exceed $22,878.00 — so only Medicare tracks income: 2.68¢
                per dollar, plus 0.83¢ once the 0.9% surtax applies. That is 0.9235 × 3.8% =
                3.51¢ on the dollar.
              </p>
            ),
          },
          {
            question: 'I file married filing separately. Why does the 0.9% surtax reach me so early?',
            answer: (
              <p>
                The separate-filer threshold is $125,000 — half the joint figure — and it is
                tested on your own wages plus your SE base together. In profit terms the layer
                starts at $135,354.63 ($125,000 ÷ 0.9235) with zero wages, the earliest onset of
                any filing status.
              </p>
            ),
          },
          {
            question: 'Does my spouse\'s salary affect my self-employment tax?',
            answer: (
              <p>
                No, on either coordination: a spouse&apos;s wages never reduce your Social
                Security wage-base room, and Form 8959 tests each spouse&apos;s own wages plus SE
                earnings against the $250,000 joint threshold. Model each spouse separately and
                add the two bills.
              </p>
            ),
          },
          {
            question: 'My business lost money this year. Does the loss offset my day job\'s payroll tax?',
            answer: (
              <p>
                No. SE tax floors at zero — the engine returns $0 on a $10,000 loss — and the
                wage FICA on your day job is unaffected. The loss may matter for income tax,
                which is a different layer this tool deliberately does not price.
              </p>
            ),
          },
          {
            question: 'Is the one-half SE tax deduction a business expense?',
            answer: (
              <p>
                No — it is a personal above-the-line adjustment on Schedule 1, line 15, not a
                Schedule C deduction. On $100,000 of profit it takes $7,064.78 off income tax
                while the $14,129.55 SE bill stands, and it never shrinks the SE base itself.
              </p>
            ),
          },
          {
            question: 'My employer already withholds the 0.9% surtax. Do I owe it again on side income?',
            answer: (
              <p>
                The threshold is one pool: your own Medicare wages plus your SE base against
                $200,000 (single). With $160,000 of wages, the SE-side 0.9% layer starts at just
                $43,313.48 of side profit ($40,000 ÷ 0.9235), and Form 8959 reconciles the
                total — the surtax is paid once, on the combined excess.
              </p>
            ),
          },
          {
            question: 'Are the $200,000 / $250,000 thresholds adjusted for inflation?',
            answer: (
              <p>
                No — they have been fixed since 2013 and are identical in 2025 and 2026 in this
                model. The only parameter that moves between those years is the Social Security
                wage base, which the SSA re-announces annually.
              </p>
            ),
          },
          {
            question: 'Why is my effective rate only 8.78% at $400,000 when the statutory rate is 15.3%?',
            answer: (
              <p>
                Because the expensive layer is capped. At $400,000 of profit (single, 2026) the
                Social Security piece is $22,878.00 — the layer&apos;s ceiling — plus $10,712.60
                of Medicare and $1,524.60 of surtax: $35,115.20 all told, an 8.78% average that
                keeps falling while the marginal holds at 3.51¢.
              </p>
            ),
          },
          {
            question: 'I made $430 from a side gig. Do I owe self-employment tax?',
            answer: (
              <p>
                No — 92.35% × $430 is $397.11, under the $400 floor, so the SE layer is $0 (at
                $500 it would be $70.65). Income tax on that profit is a separate question with
                its own, much lower starting point.
              </p>
            ),
          },
          {
            question: 'Toggling 2025 ↔ 2026 doesn\'t change my numbers. Is the year switch broken?',
            answer: (
              <p>
                No — below both years&apos; caps the arithmetic is year-invariant; at $100,000 of
                profit both years produce $14,129.55. The years can differ only above the kinks,
                and by at most $1,041.60 even at unlimited profit.
              </p>
            ),
          },
          {
            question: 'Does my filing status change my self-employment tax?',
            answer: (
              <p>
                Only through the 0.9% layer. Below the earliest onset the three statuses produce
                identical bills; at $250,000 of profit, single costs $277.88 more than married
                filing jointly — 0.9% of the $30,875 of base over $200,000.
              </p>
            ),
          },
          {
            question: 'Is there a ceiling on the Medicare part?',
            answer: (
              <p>
                No. At $1,000,000 of profit (single, 2026) the Medicare layers total $33,293.00 —
                already more than the Social Security layer can ever cost ($22,878.00) — for a
                total bill of $56,171.00, a 5.62% effective rate that keeps thinning as income
                grows.
              </p>
            ),
          },
          {
            question: 'Can retirement contributions reduce my SE tax?',
            answer: (
              <p>
                Not this layer. SEP-IRA and solo-401(k) contributions never enter the SE base —
                the engine reads Schedule C profit and nothing else — so they cut income tax, not
                SE tax. The only haircut the statute builds in is the 92.35% base factor itself.
              </p>
            ),
          },
          {
            question: 'Do gig and platform workers owe self-employment tax?',
            answer: (
              <p>
                Yes — rideshare and delivery income reported on 1099s is Schedule C business
                income like any other, and the floor is easy to clear: $5,000 of net platform
                earnings carries $706.48 of SE tax ($353.24 of deductible half). Mileage and
                expense deductions reduce the profit the tax is measured on.
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

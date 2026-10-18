import Faq from '@/components/Faq';
import { ArticleToc, RelatedCalculators } from '@/components/Article';
import {
  LTV_CAC_PRESETS,
  PAYBACK_HEALTHY_MONTHS,
  RATIO_HEALTHY,
  annualizedChurn,
  churnAtPayback,
  churnAtRatio,
  computeLtvCac,
  discountedLtv,
  monthlyDiscountRate,
} from '@/lib/ltvcac';
import { numFmt, pct, usd } from '@/lib/format';

/* Worked-example profiles — the calculator's own presets, run through the
   same engine the tool uses. Every number quoted in this guide is computed
   here at build time, so guide and calculator cannot drift apart. */

/* Reference case: $100 ARPU, 80% margin, 4%/mo churn, $24k S&M → 120 customers. */
const REF = LTV_CAC_PRESETS[0].inputs;
const R = computeLtvCac(REF);
const half = computeLtvCac({ ...REF, churnPct: REF.churnPct / 2 });
const onePp = computeLtvCac({ ...REF, churnPct: REF.churnPct - 1 });
const dblChurn = computeLtvCac({ ...REF, churnPct: REF.churnPct * 2 });
const priceUp = computeLtvCac({ ...REF, arpu: REF.arpu * 1.1 });
const marginUp = computeLtvCac({ ...REF, grossMarginPct: REF.grossMarginPct + 10 });
const cacDown = computeLtvCac({ ...REF, smSpend: REF.smSpend * 0.9 });
/* The price-rise trap: +10% price that lifts churn 10% *in relative terms*
   (4% → 4.4%) leaves LTV exactly where it started. */
const priceUpChurnUp = computeLtvCac({ ...REF, arpu: REF.arpu * 1.1, churnPct: REF.churnPct * 1.1 });

const SMB = LTV_CAC_PRESETS[1];
const MID = LTV_CAC_PRESETS[2];
const LEAKY = LTV_CAC_PRESETS[3];
const smbR = computeLtvCac(SMB.inputs);
const midR = computeLtvCac(MID.inputs);
const leakyR = computeLtvCac(LEAKY.inputs);
/* Where the leaky bucket's bars sit: churn needed for 3×; churn at which its
   churn-adjusted payback crosses 12 months. */
const leakyChurn3x = churnAtRatio(LEAKY.inputs, RATIO_HEALTHY);
const leakyChurn12mo = churnAtPayback(LEAKY.inputs, PAYBACK_HEALTHY_MONTHS);
/* And the mid-market motion, where the slow leg is payback, not value. */
const midChurn3x = churnAtRatio(MID.inputs, RATIO_HEALTHY);

/* Margin table for the overstatement math: revenue-basis LTV vs gross-basis. */
const MARGIN_ROWS = [60, 70, 80, 90].map((m) => {
  const r = computeLtvCac({ ...REF, grossMarginPct: m });
  return { m, ltv: r.ltv ?? 0, rev: r.ltvRevenueBasis ?? 0, over: r.revenueBasisOverstatementPct ?? 0 };
});

/* Churn annualization ladder at reference ARPU/margin. */
const CHURN_ROWS = [1, 2, 3, 4, 5, 6, 8].map((c) => {
  const r = computeLtvCac({ ...REF, churnPct: c });
  return { c, ann: annualizedChurn(c), life: r.lifetimeMonths ?? 0, ltv: r.ltv ?? 0 };
});

/* Discount-rate ladder on the reference profile. */
const DISC_ROWS = [8, 10, 12, 15, 20].map((rate) => {
  const ltvD = discountedLtv(REF, rate) ?? 0;
  return { rate, d: monthlyDiscountRate(rate) * 100, ltvD, haircut: (1 - ltvD / (R.ltv ?? 1)) * 100 };
});

const xFmt = (n: number) => `${numFmt(n, 1)}×`;

export default function LtvCacArticle() {
  const toc = [
    { id: 'how-it-works', label: 'What LTV:CAC measures' },
    { id: 'gross-margin', label: 'Why gross margin belongs in LTV' },
    { id: 'examples', label: 'Worked examples' },
    { id: 'churn-first', label: 'Churn beats price' },
    { id: 'benchmarks', label: 'The health bars & their limits' },
    { id: 'discounting', label: 'Discounting LTV' },
    { id: 'boundaries', label: 'Decision boundaries' },
    { id: 'glossary', label: 'Glossary' },
    { id: 'faq', label: 'FAQ' },
  ];

  return (
    <article className="prose-article">
      <ArticleToc items={toc} />

      <h2 id="how-it-works">What LTV:CAC actually measures</h2>
      <p>
        Unit economics answers one question before any other matters:{' '}
        <strong>does a customer pay for themselves?</strong> Lifetime value (LTV) is what an average
        customer is worth in gross profit; customer acquisition cost (CAC) is what you spend to win
        them. The ratio between the two is the simplest honest test of whether growth is building
        value or just buying revenue.
      </p>
      <p>The model this calculator runs is four lines:</p>
      <blockquote>
        <code>LTV = ARPU × gross margin ÷ monthly churn</code>
        <br />
        <code>CAC = S&amp;M spend ÷ new customers won</code>
        <br />
        <code>LTV:CAC = LTV ÷ CAC</code>
        <br />
        <code>payback (simple) = CAC ÷ (ARPU × gross margin)</code>
      </blockquote>
      <p>
        The engine behind them is a geometric survival model: each month, every customer sticks with
        probability <code>(1 − churn)</code>, so the expected lifetime is <code>1 ÷ churn</code>{' '}
        months and each surviving month contributes{' '}
        <code>ARPU × gross margin</code> of gross profit. Multiply the two and churn lands where it
        belongs — in the denominator, where its power lives.
      </p>
      <p>
        One number, four levers. Price and margin set the numerator; churn divides it; acquisition
        efficiency sets the comparison. The rest of this guide is about which lever to pull first —
        and about the two ways people quietly get this math wrong.
      </p>

      <h2 id="gross-margin">Why gross margin belongs in LTV (and the shortcut that doesn&rsquo;t)</h2>
      <p>
        The most common LTV mistake is computing it on <strong>revenue</strong>:{' '}
        <code>ARPU ÷ churn</code>. It looks harmless. It is not. A customer is not worth the revenue
        they generate — they are worth the <em>gross profit</em>, because serving them costs money
        every single month they stay: hosting, support, payment fees, third-party APIs. The
        revenue-basis formula pretends that serving cost is zero.
      </p>
      <p>
        The overstatement is exact, and it is <code>1 ÷ margin − 1</code>. At the reference profile
        ($100 ARPU, 4% churn), the two formulas disagree by a quarter of the entire LTV:
      </p>
      <table>
        <thead>
          <tr>
            <th>Gross margin</th>
            <th>LTV — correct (gross basis)</th>
            <th>LTV — revenue shortcut</th>
            <th>Overstatement</th>
          </tr>
        </thead>
        <tbody>
          {MARGIN_ROWS.map((row) => (
            <tr key={row.m}>
              <td>{row.m}%</td>
              <td><strong>{usd(row.ltv, 0)}</strong></td>
              <td>{usd(row.rev, 0)}</td>
              <td>{pct(row.over, 0)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p>
        The gap widens exactly where it hurts most: low-margin businesses. At a 60% margin the
        shortcut inflates LTV by {pct(MARGIN_ROWS[0].over, 0)} — enough to turn a failing ratio into
        a passing one on paper. A board deck with a revenue-basis LTV is comparing what customers
        <em> generate</em> against what they <em>cost to acquire</em>, while quietly forgetting what
        they <em>cost to serve</em>. Gross margin is not a refinement of LTV; it is the difference
        between the right number and a flattering one.
      </p>
      <p>
        The same discipline runs through CAC. Sales &amp; marketing spend belongs in the denominator
        — ads, S&amp;M salaries and commissions, agency fees, the sales tools stack. Engineering and
        support do <em>not</em>: those either sit in COGS (support, hosting) or are fixed overhead,
        and double-counting them inflates CAC while the margin input already charges for service
        costs on the LTV side.
      </p>

      <h2 id="examples">Step-by-step examples</h2>
      <p>
        Three acquisition motions from the calculator&rsquo;s presets, run through the same engine.
        Load any of them in the tool above and every figure below appears in its readouts.
      </p>

      <h3>Example 1 — the reference case (self-serve, healthy)</h3>
      <p>
        $100 ARPU at an 80% margin, 4% monthly churn, $24,000/mo of S&amp;M winning 120 customers.
      </p>
      <ol>
        <li>
          <strong>Monthly gross profit per customer:</strong> $100 × 0.80 ={' '}
          <strong>{usd(R.monthlyGrossProfit)}/mo</strong>. This is the unit of LTV accumulation.
        </li>
        <li>
          <strong>Expected lifetime:</strong> 1 ÷ 0.04 = <strong>{numFmt(R.lifetimeMonths ?? 0, 0)} months</strong>.
        </li>
        <li>
          <strong>LTV:</strong> {usd(R.monthlyGrossProfit)} × {numFmt(R.lifetimeMonths ?? 0, 0)} ={' '}
          <strong>{usd(R.ltv ?? 0, 0)}</strong>. (The revenue shortcut would say{' '}
          {usd(R.ltvRevenueBasis ?? 0, 0)} — {pct(R.revenueBasisOverstatementPct ?? 0, 0)} too high.)
        </li>
        <li>
          <strong>CAC:</strong> $24,000 ÷ 120 = <strong>{usd(R.cac ?? 0, 0)}</strong> (blended).
        </li>
        <li>
          <strong>LTV:CAC:</strong> {usd(R.ltv ?? 0, 0)} ÷ {usd(R.cac ?? 0, 0)} ={' '}
          <strong>{xFmt(R.ratio ?? 0)}</strong> — well past the {RATIO_HEALTHY}× bar.
        </li>
        <li>
          <strong>Payback:</strong> simple is {usd(R.cac ?? 0, 0)} ÷ {usd(R.monthlyGrossProfit)} ={' '}
          {numFmt(R.paybackMonths ?? 0, 1)} months. Churn-adjusted solves{' '}
          <code>{usd(R.monthlyGrossProfit, 0)} × (1 − 0.96ⁿ) ÷ 0.04 = {usd(R.cac ?? 0, 0)}</code>,
          giving <strong>{numFmt(R.paybackChurnAdjusted ?? 0, 1)} months</strong> — the customers
          who cancel before repaying push the breakeven out by about{' '}
          {numFmt((R.paybackChurnAdjusted ?? 0) - (R.paybackMonths ?? 0), 1)} months.
        </li>
      </ol>

      <h3>Example 2 — the leaky bucket (fast payback, thin value)</h3>
      <p>
        {LEAKY.description} The numbers: LTV <strong>{usd(leakyR.ltv ?? 0, 0)}</strong>, CAC{' '}
        <strong>{usd(leakyR.cac ?? 0, 0)}</strong>, ratio{' '}
        <strong>{xFmt(leakyR.ratio ?? 0)}</strong> — under the {RATIO_HEALTHY}× bar. And yet the
        churn-adjusted payback is <strong>{numFmt(leakyR.paybackChurnAdjusted ?? 0, 1)} months</strong>,
        comfortably inside 12. The two rules of thumb disagree, and the disagreement is the finding:
        this business recovers its acquisition cash quickly, then fails to accumulate much value
        because churn keeps cutting lives short at {numFmt(leakyR.lifetimeMonths ?? 0, 0)} months.
      </p>
      <p>
        Where are its levers? Inversion says churn must fall to{' '}
        <strong>{pct(leakyChurn3x ?? 0, 1)}/mo</strong> (from {pct(LEAKY.inputs.churnPct, 1)}) for
        the ratio to clear {RATIO_HEALTHY}× at this CAC — while payback would not cross 12 months
        until churn reached <strong>{pct(leakyChurn12mo ?? 0, 1)}/mo</strong>. The binding
        constraint is value, not cash timing: retention is the lever, and the churn-sensitivity
        table quantifies exactly what each point of it is worth.
      </p>

      <h3>Example 3 — sales-led mid-market (high value, slow cash)</h3>
      <p>
        {MID.description} Here the roles flip: LTV <strong>{usd(midR.ltv ?? 0, 0)}</strong> against
        CAC <strong>{usd(midR.cac ?? 0, 0)}</strong> — a ratio of{' '}
        <strong>{xFmt(midR.ratio ?? 0)}</strong>, just over the bar — but the churn-adjusted payback
        runs <strong>{numFmt(midR.paybackChurnAdjusted ?? 0, 1)} months</strong>, more than twice
        the 12-month rule. Every account bought is a good bet on a{' '}
        {numFmt(midR.lifetimeMonths ?? 0, 0)}-month expected lifetime; the problem is that the cash
        to buy the next one is locked up behind that {numFmt(midR.paybackChurnAdjusted ?? 0, 0)}-month
        payback. Motions like this live
        or die on the <a href="/saas-runway-calculator/">runway</a> their payback speed leaves them —
        the ratio alone would never surface it. (Its 3× crossing sits at{' '}
        {pct(midChurn3x ?? 0, 2)}/mo churn: enormous headroom, because value was never the weak leg.)
      </p>

      <h2 id="churn-first">Churn beats price: the arithmetic of the hyperbola</h2>
      <p>
        LTV = <code>gross profit ÷ churn</code> is a hyperbola in churn, and that shape has a
        strategy hiding in it. Halve the denominator and you double the whole number — exactly, not
        approximately. Move any other lever and LTV moves only proportionally. On the reference
        profile, with everything else fixed:
      </p>
      <table>
        <thead>
          <tr>
            <th>Lever</th>
            <th>Move</th>
            <th>New LTV</th>
            <th>Effect</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><strong>Churn (halved)</strong></td>
            <td>4% → 2%/mo</td>
            <td><strong>{usd(half.ltv ?? 0, 0)}</strong></td>
            <td>×{( (half.ltv ?? 1) / (R.ltv ?? 1) ).toFixed(2)} — doubled, exactly</td>
          </tr>
          <tr>
            <td>Churn (−1 point)</td>
            <td>4% → 3%/mo</td>
            <td>{usd(onePp.ltv ?? 0, 0)}</td>
            <td>×{((onePp.ltv ?? 1) / (R.ltv ?? 1)).toFixed(3)}</td>
          </tr>
          <tr>
            <td>Churn (doubled)</td>
            <td>4% → 8%/mo</td>
            <td>{usd(dblChurn.ltv ?? 0, 0)}</td>
            <td>×{((dblChurn.ltv ?? 1) / (R.ltv ?? 1)).toFixed(2)} — the downside of the same curve</td>
          </tr>
          <tr>
            <td>Price +10%</td>
            <td>$100 → $110</td>
            <td>{usd(priceUp.ltv ?? 0, 0)}</td>
            <td>×{((priceUp.ltv ?? 1) / (R.ltv ?? 1)).toFixed(2)} — proportional only</td>
          </tr>
          <tr>
            <td>Margin +10pp</td>
            <td>80% → 90%</td>
            <td>{usd(marginUp.ltv ?? 0, 0)}</td>
            <td>×{((marginUp.ltv ?? 1) / (R.ltv ?? 1)).toFixed(3)}</td>
          </tr>
          <tr>
            <td>CAC −10%</td>
            <td>spend $24k → $21.6k</td>
            <td>{usd(cacDown.ltv ?? 0, 0)}</td>
            <td>LTV unchanged; ratio {xFmt(cacDown.ratio ?? 0)} vs {xFmt(R.ratio ?? 0)}</td>
          </tr>
        </tbody>
      </table>
      <p>
        No other lever doubles anything. And churn interacts with price in a way the table&rsquo;s
        fixed rows cannot show: price rises are rarely churn-free. A 10% price increase that lifts
        churn by 10% <em>in relative terms</em> (4% → 4.4%/mo) leaves LTV at{' '}
        <strong>{usd(priceUpChurnUp.ltv ?? 0, 0)}</strong> — <em>exactly</em> where it started,
        because the 1.10 in the numerator cancels the 1.10 in the denominator. That is the breakeven
        elasticity of a price rise: if churn responds proportionally more than the price did, the
        rise destroyed value. Retention work has no such cliff — a point of churn saved keeps paying
        every month for the life of every cohort that ever enters.
      </p>
      <p>
        This is also why the churn axis is the one worth scanning: the calculator&rsquo;s main chart
        is the hyperbola itself, with your position marked and the {RATIO_HEALTHY}× crossing
        labeled. Steep curves near the crossing are where retention investments have the highest
        payoff; flat sections far to the left are where extra retention effort buys almost nothing.
      </p>

      <h2 id="benchmarks">The health bars — and their limits</h2>
      <p>Two numbers function as the industry&rsquo;s working definition of healthy unit economics:</p>
      <table>
        <thead>
          <tr>
            <th>Rule of thumb</th>
            <th>Reading</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><strong>LTV:CAC &gt; {RATIO_HEALTHY}×</strong></td>
            <td>Each acquisition returns more than {RATIO_HEALTHY} dollars of lifetime gross profit per dollar spent — enough headroom to absorb G&amp;A, R&amp;D, and mistakes, and still compound.</td>
          </tr>
          <tr>
            <td><strong>CAC payback &lt; {PAYBACK_HEALTHY_MONTHS} months</strong></td>
            <td>Acquisition capital recycles fast enough that growth does not starve operations — popularized in operator practice as a &ldquo;recover CAC in under a year&rdquo; guideline.</td>
          </tr>
        </tbody>
      </table>
      <p>
        <strong>Both are heuristics, not laws.</strong> They come from SaaS operating practice canon
        (notably David Skok&rsquo;s forEntrepreneurs metrics writing and the venture community that
        adopted it) — practitioner rules of thumb, not statutes or accounting standards. Their real
        use is as tripwires: a reading below them is a question (&ldquo;why?&rdquo;), not a verdict.
        Three limits to keep in mind:
      </p>
      <ol>
        <li>
          <strong>The two rules measure different things and can disagree.</strong> The ratio
          measures total value per dollar; payback measures cash timing. The leaky bucket above
          passes payback ({numFmt(leakyR.paybackChurnAdjusted ?? 0, 1)} mo) while failing the ratio
          ({xFmt(leakyR.ratio ?? 0)}); the mid-market motion passes the ratio ({xFmt(midR.ratio ?? 0)})
          while failing payback ({numFmt(midR.paybackChurnAdjusted ?? 0, 1)} mo). Passing either
          alone is not health.
        </li>
        <li>
          <strong>Blended CAC flatters mixed motions.</strong> Organic and word-of-mouth customers
          ride along at $0 marginal cost and drag the blended average down. If organic is half your
          signups, your <em>paid</em> CAC is roughly double the blended number the tool computes —
          and paid is the CAC you actually control with spend.
        </li>
        <li>
          <strong>A high ratio on a slow motion is not the same asset as a high ratio on a fast
          one.</strong> Value locked behind a {numFmt(midR.paybackChurnAdjusted ?? 0, 0)}-month
          payback needs financing to be useful; value arriving in{' '}
          {numFmt(smbR.paybackChurnAdjusted ?? 0, 1)} months funds itself. The ratio cannot see the
          difference — the payback leg can.
        </li>
      </ol>

      <h2 id="discounting">Discounting LTV — optional, and smaller than churn</h2>
      <p>
        A dollar of gross profit arriving in year three is not worth a dollar today. Adding a
        cost-of-capital discount is the conservative fix, and with the end-of-month payment
        convention the formula stays one line: the monthly discount rate simply{' '}
        <em>adds to churn</em> in the denominator. At the reference profile:
      </p>
      <table>
        <thead>
          <tr>
            <th>Annual discount rate</th>
            <th>Monthly rate</th>
            <th>Discounted LTV</th>
            <th>Haircut vs undiscounted</th>
          </tr>
        </thead>
        <tbody>
          {DISC_ROWS.map((row) => (
            <tr key={row.rate}>
              <td>{row.rate}%/yr</td>
              <td>{pct(row.d, 3)}</td>
              <td><strong>{usd(row.ltvD, 0)}</strong></td>
              <td>−{pct(row.haircut, 1)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p>
        Note the scale: a {pct(DISC_ROWS[2].haircut, 0)} haircut at a 12% cost of capital is the
        entire effect of discounting — while cutting churn from {REF.churnPct}% to{' '}
        {REF.churnPct / 2}% doubles LTV (+100%, from {usd(R.ltv ?? 0, 0)} to{' '}
        {usd(half.ltv ?? 0, 0)}). If someone&rsquo;s LTV looks wildly wrong, the
        suspect is churn or margin, not the discount rate. Use your real weighted average cost of
        capital if you know it; 8–15% covers most private-company practice, and venture investors
        with concentrated portfolios lean toward the top of that band.
      </p>

      <h2 id="boundaries">Decision boundaries</h2>
      <p>
        A model earns trust by stating where it stops working. These are the lines for this one —
        and the critical values below were produced by the same engine the calculator runs, never
        typed by hand.
      </p>

      <h3>When this model is the right instrument</h3>
      <ul>
        <li>
          <strong>Revenue is subscription-like and roughly flat per customer</strong> — a stable
          ARPU with logo churn as the main decay force.
        </li>
        <li>
          <strong>Churn is roughly constant across the customer&rsquo;s life</strong>, or you enter
          the steady-state rate mature cohorts show (see below).
        </li>
        <li>
          <strong>You want the blended picture</strong>: is this acquisition motion, on average,
          creating or destroying value?
        </li>
      </ul>

      <h3>When to set it aside</h3>
      <ul>
        <li>
          <strong>Expansion revenue is material (NRR &gt; 100%).</strong> The model assumes a
          customer&rsquo;s monthly gross profit never grows — net-revenue-churn variants exist for
          that world, and this tool will <em>understate</em> your LTV. That direction is at least
          conservative.
        </li>
        <li>
          <strong>Churn is steeply front-loaded.</strong> Young cohorts churn harder than the
          steady state; using early-cohort churn on the whole lifetime overcorrects, and using
          mature-cohort churn on brand-new customers flatters. Segment if the gap is wide.
        </li>
        <li>
          <strong>Usage-based or hybrid pricing.</strong> ARPU becomes a forecast, not a fact — the
          formula still runs, but its honest input is the expected average, and the dispersion
          around it is doing work the tool cannot see.
        </li>
        <li>
          <strong>The ratio is below 1.</strong> Then the payback readout stops existing entirely:
          expected lifetime gross profit never reaches the CAC, and every incremental dollar of
          spend compounds the loss. The only questions left are retention, price, margin, or stop.
        </li>
        <li>
          <strong>You need volume or break-even answers.</strong> How many customers must exist for
          the business to cover fixed costs is a different instrument — the{' '}
          <a href="/break-even-calculator/">break-even calculator</a>, with contribution margin
          doing the work ARPU does here.
        </li>
      </ul>

      <h3>The critical values, and how to read them</h3>
      <p>
        Churn compounds, so annualize before benchmarking it — a monthly figure hides its annual
        weight, and the LTV column shows what each step costs at the guide&rsquo;s margin profile:
      </p>
      <table>
        <thead>
          <tr>
            <th>Monthly churn</th>
            <th>Annualized</th>
            <th>Expected lifetime</th>
            <th>LTV (at {usd(REF.arpu, 0)} / {REF.grossMarginPct}% margin)</th>
          </tr>
        </thead>
        <tbody>
          {CHURN_ROWS.map((row) => (
            <tr key={row.c}>
              <td>{row.c}%</td>
              <td>{pct(row.ann, 1)}</td>
              <td>{numFmt(row.life, 0)} mo</td>
              <td>{usd(row.ltv, 0)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <ul className="mt-4">
        <li>
          <strong>6%/mo is not &ldquo;twice as bad&rdquo; as 3%/mo on an annual view.</strong> It
          is {pct((CHURN_ROWS[4].ann / CHURN_ROWS[2].ann - 1) * 100, 0)} worse annualized — and it
          halves LTV, from {usd(CHURN_ROWS[2].ltv, 0)} to {usd(CHURN_ROWS[4].ltv, 0)}.
        </li>
        <li>
          <strong>The 1× line is a cliff, not a threshold.</strong> At LTV:CAC = 1, expected
          lifetime gross profit exactly equals CAC and churn-adjusted payback diverges to infinity —
          at the reference CAC of {usd(R.cac ?? 0, 0)} and margin-weighted profit of{' '}
          {usd(R.monthlyGrossProfit)}/mo, that cliff sits at{' '}
          {pct(((R.monthlyGrossProfit ?? 0) / (R.cac ?? 1)) * 100, 0)} monthly churn. Left of it
          payback merely slows; right of it, payback never happens at all.
        </li>
        <li>
          <strong>The {RATIO_HEALTHY}× crossing is computable, so make it a target.</strong> Invert
          the ratio — churn must come down to <code>gross profit ÷ ({RATIO_HEALTHY} × CAC)</code>.
          Reference profile: {pct(((R.monthlyGrossProfit ?? 0) / (RATIO_HEALTHY * (R.cac ?? 1))) * 100, 1)}
          /mo. Leaky bucket: {pct(leakyChurn3x ?? 0, 1)}/mo versus its actual{' '}
          {pct(LEAKY.inputs.churnPct, 1)} — a{' '}
          {(1 - (leakyChurn3x ?? 0) / LEAKY.inputs.churnPct) * 100 > 0 ? pct((1 - (leakyChurn3x ?? 0) / LEAKY.inputs.churnPct) * 100, 0) : '0'}{' '}
          relative reduction, which is what &ldquo;fix retention&rdquo; concretely means there.
        </li>
      </ul>

      <h2 id="glossary">Glossary</h2>
      <dl className="mt-2 space-y-5">
        <div>
          <dt className="font-semibold text-slate-900 dark:text-slate-100">ARPU</dt>
          <dd className="mt-0.5 leading-relaxed text-slate-600 dark:text-slate-300">
            Average revenue per user per month: total recurring revenue ÷ active customers. For a
            flat-rate product, simply the monthly fee.
          </dd>
        </div>
        <div>
          <dt className="font-semibold text-slate-900 dark:text-slate-100">Gross margin</dt>
          <dd className="mt-0.5 leading-relaxed text-slate-600 dark:text-slate-300">
            (Revenue − COGS) ÷ revenue, where COGS is the cost of serving: hosting, support, payment
            fees, third-party APIs. Never includes S&amp;M or R&amp;D — those are below the line
            this model needs.
          </dd>
        </div>
        <div>
          <dt className="font-semibold text-slate-900 dark:text-slate-100">Logo churn</dt>
          <dd className="mt-0.5 leading-relaxed text-slate-600 dark:text-slate-300">
            The share of <em>customers</em> cancelling per month. Distinct from revenue churn, which
            also nets in downgrades, upgrades, and seat changes; logo churn is what the lifetime
            1 ÷ churn arithmetic actually consumes.
          </dd>
        </div>
        <div>
          <dt className="font-semibold text-slate-900 dark:text-slate-100">LTV (lifetime value)</dt>
          <dd className="mt-0.5 leading-relaxed text-slate-600 dark:text-slate-300">
            Expected lifetime gross profit from one customer: ARPU × margin ÷ churn on this model.
            The gross-margin basis is the point — revenue-basis LTV overstates by exactly
            1 ÷ margin − 1.
          </dd>
        </div>
        <div>
          <dt className="font-semibold text-slate-900 dark:text-slate-100">CAC (customer acquisition cost)</dt>
          <dd className="mt-0.5 leading-relaxed text-slate-600 dark:text-slate-300">
            Blended: total S&amp;M spend ÷ new customers in the period, organic included. Paid CAC
            excludes organic signups and runs higher; the blended figure is what the whole
            funnel economics actually cost.
          </dd>
        </div>
        <div>
          <dt className="font-semibold text-slate-900 dark:text-slate-100">LTV:CAC ratio</dt>
          <dd className="mt-0.5 leading-relaxed text-slate-600 dark:text-slate-300">
            Lifetime gross profit per dollar of acquisition. Above {RATIO_HEALTHY}× is the working
            rule of thumb for &ldquo;worth scaling&rdquo;; below 1× is value destruction by
            definition.
          </dd>
        </div>
        <div>
          <dt className="font-semibold text-slate-900 dark:text-slate-100">CAC payback period</dt>
          <dd className="mt-0.5 leading-relaxed text-slate-600 dark:text-slate-300">
            Months of gross profit needed to repay the CAC. Simple payback ignores churn;
            churn-adjusted payback counts only the gross profit the average customer actually
            delivers before leaving, and is always the larger (more honest) number.
          </dd>
        </div>
        <div>
          <dt className="font-semibold text-slate-900 dark:text-slate-100">Expected lifetime</dt>
          <dd className="mt-0.5 leading-relaxed text-slate-600 dark:text-slate-300">
            1 ÷ monthly churn, in months — the mean of the geometric survival distribution. At 4%/mo
            that is 25 months; the median (ln 2 ÷ churn ≈ 17.3) is shorter, and LTV arithmetic uses
            the mean.
          </dd>
        </div>
        <div>
          <dt className="font-semibold text-slate-900 dark:text-slate-100">NRR (net revenue retention)</dt>
          <dd className="mt-0.5 leading-relaxed text-slate-600 dark:text-slate-300">
            Revenue from a cohort one year later ÷ starting revenue, including expansion and
            contraction. This model assumes 100%; above it, LTV here is a conservative floor.
          </dd>
        </div>
        <div>
          <dt className="font-semibold text-slate-900 dark:text-slate-100">Cohort</dt>
          <dd className="mt-0.5 leading-relaxed text-slate-600 dark:text-slate-300">
            The set of customers acquired in a given period. Cohort-level churn curves — not the
            blended average — reveal whether attrition is front-loaded or steady, which decides
            which churn number belongs in this model.
          </dd>
        </div>
      </dl>

      <Faq
        items={[
          {
            question: 'What is a good LTV:CAC ratio?',
            answer: `The working industry rule of thumb is 3× or better — each customer should return at least three dollars of lifetime gross profit per dollar of acquisition cost, leaving headroom for R&D, G&A, and operating mistakes. It is a heuristic from SaaS operating practice, not a law: a 2.8× ratio on a self-serve motion with instant payback can out-earn a 3.5× ratio on a slow enterprise one. Treat 3× as a tripwire that earns a question, and read it alongside payback — the two measure different failures.`,
          },
          {
            question: 'Why does the LTV formula include gross margin?',
            answer: `Because a customer costs money to serve every month they stay — hosting, support, payment fees, APIs — and those costs scale with the customer, not with your headcount. LTV on the gross-margin basis (ARPU × margin ÷ churn) counts only what the customer actually contributes; the revenue-basis shortcut (ARPU ÷ churn) overstates value by exactly 1 ÷ margin − 1: ${pct(R.revenueBasisOverstatementPct ?? 0, 0)} at the guide's 80%-margin example and ${pct(MARGIN_ROWS[0].over, 0)} at a 60% margin. The shortcut turns failing unit economics into passing ones on paper.`,
          },
          {
            question: 'How do you calculate CAC?',
            answer: `Blended CAC is total sales & marketing spend in a period divided by the new customers won in that period: ads, S&M salaries and commissions, agency fees, and sales tools — not engineering, support, or hosting (support and hosting belong to gross margin; charging them to CAC double-counts). The calculator's reference case: $24,000 of monthly S&M ÷ 120 new customers = ${usd(R.cac ?? 0, 0)}. If a meaningful share of signups is organic, compute paid CAC separately by excluding organic customers from the denominator — it will be higher, and it is the number spend decisions actually move.`,
          },
          {
            question: "What's a good CAC payback period?",
            answer: `Under 12 months is the common operator guideline — acquisition capital should recycle within a year so growth funds itself rather than starving operations. This tool reports the churn-adjusted version, which counts only gross profit the average customer actually delivers before leaving: on the reference case the simple payback is ${numFmt(R.paybackMonths ?? 0, 1)} months and the churn-adjusted is ${numFmt(R.paybackChurnAdjusted ?? 0, 1)}. Sales-led motions routinely run past 12 (the mid-market example sits at ${numFmt(midR.paybackChurnAdjusted ?? 0, 1)}); that is not automatically fatal — it converts the question into a financing one, which is what runway is for.`,
          },
          {
            question: 'Why exactly does halving churn double LTV?',
            answer: `Because LTV = ARPU × margin ÷ churn is a hyperbola in churn — the churn term is the only divisor. Halve the divisor, double the quotient, with no approximation anywhere: the reference case moves from ${usd(R.ltv ?? 0, 0)} at 4%/mo churn to ${usd(half.ltv ?? 0, 0)} at 2%/mo. No other lever has this property: price and margin act on the numerator and move LTV only proportionally. The same hyperbola runs in reverse — doubling churn to 8%/mo halves LTV to ${usd(dblChurn.ltv ?? 0, 0)}.`,
          },
          {
            question: 'Should I discount LTV? What rate should I use?',
            answer: `If you are comparing LTV to cash going out today, yes — a dollar of gross profit in year three is not worth a dollar now. With the model's end-of-month payment convention the discounted LTV is ARPU × margin ÷ (churn + monthly discount rate), so the rate simply adds to churn. At a 12%/yr cost of capital the reference LTV falls ${pct(DISC_ROWS[2].haircut, 1)} to ${usd(DISC_ROWS[2].ltvD, 0)} — modest next to churn's leverage. Use your actual WACC if you know it; 8–15%/yr covers most private-company practice, and if you don't know it, leave discounting off and let churn conservativeness do the work.`,
          },
          {
            question: "What's the difference between simple and churn-adjusted CAC payback?",
            answer: `Simple payback is CAC ÷ monthly gross profit — it implicitly assumes the customer stays forever while repaying. Churn-adjusted payback solves for the month n where cumulative EXPECTED gross profit (monthly gross profit × (1 − (1−churn)ⁿ) ÷ churn) first equals CAC, so the customers who cancel mid-repayment are priced in. It is always the larger number: ${numFmt(R.paybackChurnAdjusted ?? 0, 1)} versus ${numFmt(R.paybackMonths ?? 0, 1)} months on the reference case. When churn-adjusted payback is "never", expected LTV has fallen to or below CAC — the 1× cliff.`,
          },
          {
            question: 'My LTV:CAC is above 3 but payback is over 12 months — which one do I trust?',
            answer: `Both — they flag different diseases. The ratio says each customer is ultimately worth much more than they cost; the slow payback says your cash is locked up for years while that happens. That is the mid-market profile in the guide: ratio ${xFmt(midR.ratio ?? 0)}, payback ${numFmt(midR.paybackChurnAdjusted ?? 0, 1)} months. The cure is not "stop selling" but financing the gap — raise (or extend runway) so the motion can run to scale, or shorten the cash cycle with annual prepay. The mirror case (fast payback, ratio under 3) is the leaky bucket: cash recycles, but churn keeps the lifetime too thin to matter. Ratio without payback is value without timing; payback without ratio is timing without value.`,
          },
          {
            question: 'What monthly churn rate is considered good for SaaS?',
            answer: `Rough bands from operating practice: under 1%/mo is excellent (mostly enterprise), 1–2% is very good, 2–4% is typical for SMB SaaS, and above 5%/mo the business has a retention problem worth fixing before anything else. Annualize before comparing — churn compounds, so 3%/mo is ${pct(CHURN_ROWS[2].ann, 1)}/yr, not 36%. And 6%/mo is ${pct((CHURN_ROWS[4].ann / CHURN_ROWS[2].ann - 1) * 100, 0)} worse than 3%/mo on the annual view while halving LTV from ${usd(CHURN_ROWS[2].ltv, 0)} to ${usd(CHURN_ROWS[4].ltv, 0)} at the guide's margin profile.`,
          },
          {
            question: 'Should I raise prices or reduce churn?',
            answer: `The arithmetic favors churn, and not by a little. LTV moves proportionally with price (a 10% rise = ×1.10) but reciprocally with churn (a 10% relative cut = ×1.11 — and a halving = ×2). Worse, price rises often CAUSE churn: at the reference profile a 10% price increase that lifts churn 10% in relative terms (4% → 4.4%/mo) leaves LTV exactly unchanged at ${usd(priceUpChurnUp.ltv ?? 0, 0)} — the two effects cancel to the decimal. Unless you have evidence your demand is price-inelastic relative to churn, retention is the lever that compounds; price is the lever that trades against it.`,
          },
          {
            question: 'Does this work for usage-based or hybrid pricing?',
            answer: `As an approximation, yes — enter the expected average ARPU. But usage-based revenue has dispersion this model cannot see: the mean customer is not the median, and heavy users often carry disproportionate value while churning differently. Run it with an average ARPU for the blended picture, then sanity-check the answer against your top-quartile cohort before making pricing decisions on it. The formula is honest; its inputs stop being facts in a usage-based world.`,
          },
          {
            question: 'What does an LTV:CAC below 1 actually mean?',
            answer: `Value destruction, mechanically: the average customer's expected lifetime gross profit is smaller than what you paid to acquire them, so every dollar of S&M spend returns less than a dollar — and scaling spend scales the loss. It also means the churn-adjusted payback never completes (the tool reports "never"): at the point where LTV = CAC exactly, payback diverges to infinity. The fixes are the model's own levers — retention, price, margin, or cheaper acquisition — and the only wrong move is spending more to find out.`,
          },
          {
            question: 'How does LTV:CAC relate to runway?',
            answer: `They answer complementary questions on the same machine. LTV:CAC says whether growth creates value per customer; payback says when that value arrives as cash; runway says how long you can wait for it. A business past the health bars with a slow payback (the mid-market case: ${numFmt(midR.paybackChurnAdjusted ?? 0, 1)} months) needs enough runway for the flywheel to fund itself — run those numbers in the SaaS runway tool. And a business below 1× is burning runway buying losses, no matter how much of it is left.`,
          },
        ]}
      />

      <RelatedCalculators
        links={[
          { href: '/saas-runway-calculator/', label: 'SaaS Runway Calculator' },
          { href: '/break-even-calculator/', label: 'Break-Even Calculator' },
          { href: '/cap-table-dilution-calculator/', label: 'Cap Table & Dilution' },
        ]}
      />
    </article>
  );
}

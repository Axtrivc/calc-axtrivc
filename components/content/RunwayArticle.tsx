import Faq from '@/components/Faq';
import { ArticleToc, RelatedCalculators } from '@/components/Article';
import { breakevenGrowthThreshold, computeRunway, RUNWAY_PRESETS } from '@/lib/runway';
import { numFmt, usd } from '@/lib/format';

/* Worked example used throughout this guide: $500k cash, $50k gross burn,
   $10k MRR at 100% gross margin (the zero-COGS textbook case — the
   calculator's gross-margin input models real COGS). Every number in the
   table and the "cliff" prose below is computed from the same engine the
   tool runs, so guide and calculator cannot drift apart. */
const PROFILE = { cash: 500_000, grossBurn: 50_000, mrr: 10_000, growthRate: 0, grossMargin: 100 };
const GROWTH_ROWS = [0, 5, 8, 12, 15, 18];
const flatMonths = computeRunway({ ...PROFILE, growthRate: 0 }).months ?? 0;
const flatExact = computeRunway({ ...PROFILE, growthRate: 0 }).monthsExact ?? 0;
const rows = GROWTH_ROWS.map((g) => ({ g, r: computeRunway({ ...PROFILE, growthRate: g }) }));
// Smallest growth rate at which break-even arrives before the cash runs out.
const cliffGrowth = breakevenGrowthThreshold(PROFILE);
const atNine = computeRunway({ ...PROFILE, growthRate: 9 });
// Bank balance at the END of the break-even crossing month — NOT finalCash,
// which is the balance when the recorded projection stops two months later.
const atNineCrossCash = atNine.points[atNine.profitableAtMonth ?? 0].cash;
const atEight = computeRunway({ ...PROFILE, growthRate: 8 });

/* ---- Worked example: the long winter (RUNWAY_PRESETS[2], id 'winter') ----
   Contraction with real COGS — the mirror image of the quick example above.
   All figures below come straight off the engine's month-by-month points. */
const WINTER = RUNWAY_PRESETS[2].inputs;
const winterRun = computeRunway(WINTER);
const winterNaive = WINTER.cash / winterRun.initialNetBurn;
const winterCliff = breakevenGrowthThreshold(WINTER);
const WINTER_ROWS = [1, 3, 6, 9, 12, 15, 18, 19];
// Indexed by the engine's own months field rather than a hardcoded 20, so the
// row stays the death month if the preset's inputs ever change.
const winterDeath = winterRun.points[winterRun.months ?? 0];

/* ---- Worked example: the pre-raise collections squeeze (RUNWAY_PRESETS[3],
   id 'pre-raise') — identical inputs run twice, once per collection-lag
   setting. The lag's entire effect is visible in the side-by-side points. */
const PRE = RUNWAY_PRESETS[3].inputs;
const preOnTime = computeRunway({ ...PRE, collectionLag: 0 });
const preLagged = computeRunway({ ...PRE, collectionLag: 1 });
const preNaive = PRE.cash / preOnTime.initialNetBurn;
const preCliff = breakevenGrowthThreshold(PRE);
const lagCostMonths = Math.abs((preLagged.monthsExact ?? 0) - (preOnTime.monthsExact ?? 0));
const PRE_ROWS = [1, 6, 12];

/* ---- Decision-boundary scans. Every critical value quoted in the
   "Decision boundaries" section is produced here by scanning the engine —
   the methods are documented in the copy next to the numbers:
   - cliff by margin: the library's own bisection (breakevenGrowthThreshold);
   - naive-division adequacy: 0.5pp grid scan of simulated-minus-naive runway;
   - affordable burn for an 18-month runway: bisection on grossBurn to a
     ±$25 bracket (a null runway = break-even = "longer than 18"). */
const cliffByMargin = [100, 80, 60].map((margin) => {
  const beMrr = computeRunway({ ...PROFILE, grossMargin: margin }).breakevenMrr;
  return { margin, beMrr, g: breakevenGrowthThreshold({ ...PROFILE, grossMargin: margin }) };
});
const cliffWithLag = breakevenGrowthThreshold({ ...PROFILE, collectionLag: 1 });

const simMinusNaive = (g: number) => {
  const r = computeRunway({ ...PROFILE, growthRate: g });
  return r.months === null ? Infinity : (r.monthsExact ?? 0) - flatExact;
};
const firstGapAtLeast = (target: number) => {
  for (let g = 0.5; g <= 15.0001; g += 0.5) {
    if (simMinusNaive(g) >= target) return g;
  }
  return null;
};
const gapOneMonth = firstGapAtLeast(1);
const gapThreeMonths = firstGapAtLeast(3);

const burnFor18Months = (growth: number) => {
  const monthsAt = (burn: number) => {
    const r = computeRunway({ ...PROFILE, growthRate: growth, grossBurn: burn });
    return r.months === null ? Infinity : r.monthsExact ?? 0;
  };
  let lo = 25_000; // survives 18 months (or breaks even) at this burn…
  let hi = PROFILE.grossBurn; // …and does not at the current one
  while (hi - lo > 25) {
    const mid = (lo + hi) / 2;
    if (monthsAt(mid) >= 18) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
};
const tripwireBurnGrowing = burnFor18Months(8);
const tripwireBurnFlat = burnFor18Months(0);
const tripwireCutPct = (burn: number) => ((PROFILE.grossBurn - burn) / PROFILE.grossBurn) * 100;

/* ---- FAQ support scenarios (each answer quotes these engine outputs). */
const DRIFT = computeRunway({ cash: 2_000_000, grossBurn: 10_000, mrr: 0, growthRate: 0 });
const driftNaive = 2_000_000 / 10_000;
const POSITIVE = computeRunway({ cash: 300_000, grossBurn: 50_000, mrr: 60_000, growthRate: 0 });
const cut10 = computeRunway({ ...PROFILE, grossBurn: 45_000 });
const cut20 = computeRunway({ ...PROFILE, grossBurn: 40_000 });
const plus2pp = computeRunway({ ...PROFILE, growthRate: 2 });
const margin80 = computeRunway({ ...PROFILE, grossMargin: 80 });

export default function RunwayArticle() {
  const toc = [
    { id: 'how-it-works', label: 'How SaaS runway works' },
    { id: 'examples', label: 'Worked examples' },
    { id: 'growth', label: 'Why growth extends runway' },
    { id: 'benchmarks', label: 'Healthy runway benchmarks' },
    { id: 'strategies', label: 'How to extend your runway' },
    { id: 'boundaries', label: 'Decision boundaries' },
    { id: 'glossary', label: 'Glossary' },
    { id: 'faq', label: 'FAQ' },
  ];

  return (
    <article className="prose-article">
      <ArticleToc items={toc} />

      <h2 id="how-it-works">How SaaS runway works</h2>
      <p>
        Runway is the answer to a single, existential question: <strong>&ldquo;How many months
        until we run out of money?&rdquo;</strong> For a pre-profitability startup it is the most
        important number on the dashboard — more important than revenue, growth, or valuation,
        because it is the literal clock counting down to either break-even or a fundraise.
      </p>
      <p>
        The simplest version of the formula ignores growth:
      </p>
      <blockquote>
        <code>runway (months) = cash on hand / monthly net burn</code>
      </blockquote>
      <p>
        where <code>net burn = gross burn − revenue × gross margin</code> — at a 100% gross margin
        (no COGS) this is simply gross burn − revenue. If you have $500,000 in the bank and you burn
        a net $40,000 per month, you have <strong>12.5 months of runway</strong>.
      </p>
      <p>
        But that naive formula <em>understates</em> your runway when you are growing. Each month your
        MRR rises, your net burn shrinks, and the cash lasts longer than a flat-line projection
        would suggest. The calculator above runs a proper month-by-month simulation: it deducts that
        month's net burn, then grows MRR for the next month, and repeats. On a fast-growing
        business this can extend your reported runway by 30–100% versus the simple division.
      </p>

      <h2 id="examples">Step-by-step examples</h2>
      <p>A seed-stage SaaS with:</p>
      <ul>
        <li>Cash: <strong>$500,000</strong></li>
        <li>Monthly gross burn: <strong>$50,000</strong> (mostly salaries + infra)</li>
        <li>Current MRR: <strong>$10,000</strong></li>
        <li>MRR growth: <strong>8% per month</strong></li>
        <li>Gross margin: <strong>100%</strong> — no COGS modeled in this example, to keep the
          arithmetic clean. The calculator&rsquo;s gross-margin input handles real COGS.</li>
      </ul>
      <p>
        <strong>Naive estimate:</strong> net burn today is $50,000 − $10,000 = $40,000, so
        $500,000 / $40,000 = <strong>{numFmt(flatExact, 1)} months</strong>.
      </p>
      <p>
        <strong>With growth:</strong> the calculator simulates each month. By month 12 your MRR has
        compounded to ~{usd(atEight.points[12].mrr, 0)}, cutting net burn to ~{usd(atEight.points[12].netBurn, 0)}. The result:{' '}
        <strong>~{numFmt(atEight.monthsExact ?? 0, 1)} months of
        runway</strong> — about {(((atEight.monthsExact ?? 0) / flatExact - 1) * 100).toFixed(0)}% more than the flat-line math suggests. Those extra three-plus
        months are often the difference between closing a clean Series A and a desperate bridge
        round.
      </p>

      <h3 id="example-winter">Worked example: the long winter</h3>
      <p>
        The quick example above grows. This one shrinks — it is the calculator&rsquo;s{' '}
        <em>Long winter</em> preset, and a scenario every founder should rehearse before it
        arrives. Load the preset in the tool above and every figure below appears in
        its chart.
      </p>
      <p>Inputs, exactly as the preset ships them:</p>
      <ul>
        <li>Cash: <strong>{usd(WINTER.cash, 0)}</strong></li>
        <li>Monthly gross burn: <strong>{usd(WINTER.grossBurn, 0)}</strong></li>
        <li>Current MRR: <strong>{usd(WINTER.mrr, 0)}</strong></li>
        <li>MRR growth: <strong>−2% per month</strong> — net contraction, churn outrunning sales</li>
        <li>Gross margin: <strong>75%</strong> — real COGS on every dollar</li>
      </ul>
      <p>
        <strong>Step 1 — the two anchor numbers.</strong> Break-even MRR is gross burn ÷ margin:{' '}
        {usd(WINTER.grossBurn, 0)} ÷ 0.75 = <strong>{usd(winterRun.breakevenMrr, 0)}</strong>.
        Today&rsquo;s net burn is {usd(WINTER.grossBurn, 0)} − 0.75 × {usd(WINTER.mrr, 0)} ={' '}
        <strong>{usd(winterRun.initialNetBurn, 0)}</strong> per month.
      </p>
      <p>
        <strong>Step 2 — the naive division.</strong> {usd(WINTER.cash, 0)} ÷{' '}
        {usd(winterRun.initialNetBurn, 0)} = <strong>{numFmt(winterNaive, 1)} months</strong>.
        Under contraction this is an <em>over</em>estimate, and the next step shows by how much.
      </p>
      <p>
        <strong>Step 3 — the engine, month by month.</strong> MRR during month <code>m</code> is{' '}
        {usd(WINTER.mrr, 0)} × 0.98<sup>m−1</sup> (month 6: {usd(WINTER.mrr, 0)} × 0.98⁵ ={' '}
        {usd(winterRun.points[6].mrr, 0)}), so each month&rsquo;s net burn <em>rises</em> as that
        MRR decays:
      </p>
      <table>
        <thead>
          <tr>
            <th>Month</th>
            <th>MRR that month</th>
            <th>Net burn</th>
            <th>Cash at month-end</th>
          </tr>
        </thead>
        <tbody>
          {WINTER_ROWS.map((m) => {
            const p = winterRun.points[m];
            return (
              <tr key={m}>
                <td>{m}</td>
                <td>{usd(p.mrr, 0)}</td>
                <td>{usd(p.netBurn, 0)}</td>
                <td>{usd(p.cash, 0)}</td>
              </tr>
            );
          })}
          {winterRun.months !== null && (
            <tr>
              <td>{winterDeath.month}</td>
              <td>{usd(winterDeath.mrr, 0)}</td>
              <td>{usd(winterDeath.netBurn, 0)}</td>
              <td><strong>{usd(winterDeath.cash, 0)} — exhausted</strong></td>
            </tr>
          )}
        </tbody>
      </table>
      <p>
        <strong>Step 4 — the verdict.</strong> The balance crosses zero during month{' '}
        {winterRun.months}: <strong>{numFmt(winterRun.monthsExact ?? 0, 1)} months</strong> of
        exact runway against the naive {numFmt(winterNaive, 1)} — contraction cost{' '}
        {numFmt(winterNaive - (winterRun.monthsExact ?? 0), 1)} months, because the burn line
        climbs from {usd(winterRun.points[1].netBurn, 0)} to {usd(winterDeath.netBurn, 0)} instead
        of flattening. And the decision datum: this company&rsquo;s growth-to-break-even is{' '}
        <strong>≈{winterCliff === null ? '—' : winterCliff.toFixed(1)}%/mo</strong> — flipping net
        growth from −2% to above that line (all else equal) is what turns the countdown off
        before the cash does.
      </p>

      <h3 id="example-lag">Worked example: the pre-raise collections squeeze</h3>
      <p>
        The <em>Pre-raise</em> preset sits in the uncomfortable middle: post-raise burn, real
        revenue behind it, and a collections pattern about to slip. One input changes between the
        two runs — the one-month collection lag — and nothing else.
      </p>
      <ul>
        <li>Cash: <strong>{usd(PRE.cash, 0)}</strong></li>
        <li>Monthly gross burn: <strong>{usd(PRE.grossBurn, 0)}</strong></li>
        <li>Current MRR: <strong>{usd(PRE.mrr, 0)}</strong>, growing <strong>+4% per month</strong></li>
        <li>Gross margin: <strong>80%</strong></li>
      </ul>
      <p>
        <strong>Step 1 — anchors.</strong> Break-even MRR: {usd(PRE.grossBurn, 0)} ÷ 0.8 ={' '}
        <strong>{usd(preOnTime.breakevenMrr, 0)}</strong>. Today&rsquo;s net burn:{' '}
        {usd(PRE.grossBurn, 0)} − 0.8 × {usd(PRE.mrr, 0)} ={' '}
        <strong>{usd(preOnTime.initialNetBurn, 0)}</strong>; naive runway {usd(PRE.cash, 0)} ÷{' '}
        {usd(preOnTime.initialNetBurn, 0)} = <strong>{numFmt(preNaive, 1)} months</strong>.
      </p>
      <p>
        <strong>Step 2 — both simulations, side by side.</strong> On-time, month 1 banks 0.8 ×{' '}
        {usd(PRE.mrr, 0)} = {usd(PRE.mrr * 0.8, 0)} of collections and burns{' '}
        {usd(preOnTime.points[1].netBurn, 0)}. Lagged, month 1 collects <em>nothing</em> — the
        full {usd(preLagged.points[1].netBurn, 0)} walks out the door, and the deficit is never
        fully repaid: it is one month of margin-weighted MRR delayed forever.
      </p>
      <table>
        <thead>
          <tr>
            <th>Month</th>
            <th>Net burn · on-time</th>
            <th>Cash · on-time</th>
            <th>Net burn · lagged</th>
            <th>Cash · lagged</th>
          </tr>
        </thead>
        <tbody>
          {PRE_ROWS.map((m) => (
            <tr key={m}>
              <td>{m}</td>
              <td>{usd(preOnTime.points[m].netBurn, 0)}</td>
              <td>{usd(preOnTime.points[m].cash, 0)}</td>
              <td>{usd(preLagged.points[m].netBurn, 0)}</td>
              <td>{usd(preLagged.points[m].cash, 0)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p>
        <strong>Step 3 — the verdict.</strong> On-time:{' '}
        {numFmt(preOnTime.monthsExact ?? 0, 1)} months (ceiling {preOnTime.months}); lagged:{' '}
        {numFmt(preLagged.monthsExact ?? 0, 1)} months (ceiling {preLagged.months}) — the lag
        costs <strong>{numFmt(lagCostMonths, 1)} months</strong>. Note also what the growth buy is
        worth here: the simulation beats the naive division by{' '}
        {numFmt((preOnTime.monthsExact ?? 0) - preNaive, 1)} months at +4%/mo, yet neither run
        ever breaks even — MRR never reaches the {usd(preOnTime.breakevenMrr, 0)} line before the
        cash runs out. This profile&rsquo;s growth-to-break-even is{' '}
        ≈{preCliff === null ? '—' : preCliff.toFixed(1)}%/mo, a little over one point above what
        the plan assumes; collections discipline and burn are the levers it actually controls.
      </p>

      <h2 id="growth">Why growth is a runway multiplier</h2>
      <p>
        The compounding effect of MRR growth on runway is non-linear and easy to underestimate.
        Here&rsquo;s how runway changes with growth rate for the same $500k / $50k-burn / $10k-MRR
        business (computed live by the same engine that powers the calculator above):
      </p>
      <table>
        <thead>
          <tr>
            <th>Monthly growth</th>
            <th>Runway</th>
            <th>vs flat</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ g, r }) => (
            <tr key={g}>
              <td>{g === 0 ? '0% (flat)' : `${g}%`}</td>
              <td>
                {r.months !== null ? (
                  <strong>{(r.monthsExact ?? 0).toFixed(1)} months</strong>
                ) : r.reachedProfitability ? (
                  <strong>Break-even — profitable by month {r.profitableAtMonth}</strong>
                ) : (
                  <strong>120+ months (never covers burn)</strong>
                )}
              </td>
              <td>
                {r.months === null
                  ? '+∞'
                  : r.months === flatMonths
                    ? 'baseline'
                    : `+${((r.monthsExact ?? 0) - flatExact).toFixed(1)} mo`}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p>
        Figures are the <em>exact</em> month at which the balance crosses zero — interpolated
        linearly inside the final month — so the 0% row reproduces the naive 12.5-month division to
        the decimal. Tools that report only whole months count the month in which the balance
        dies — the ceiling of these numbers (13, 14, 17…); the calculator shows the interpolated
        value so it can be compared against the naive division without a rounding convention
        masquerading as economics.
      </p>
      <p>
        Notice the shape: each extra point of growth buys a few more months — and then the payoff
        turns into a cliff, not a slope. The exact edge for this company is{' '}
        <strong>≈{cliffGrowth === null ? '—' : cliffGrowth.toFixed(1)}%/mo</strong>: one notch below
        it you are counting months down, one notch above it the countdown stops entirely — at 9%/mo
        the same business turns cash-flow positive by month {atNine.profitableAtMonth} with cash
        still in the bank. That threshold (your company&rsquo;s own version of it, not this one) is
        the number every pre-profit founder should know by heart; the calculator reports it as
        &ldquo;growth to break even&rdquo;.
      </p>

      <h2 id="benchmarks">Healthy runway benchmarks</h2>
      <p>
        Investors and operators generally use these heuristics:
      </p>
      <table>
        <thead>
          <tr>
            <th>Runway</th>
            <th>What it means</th>
          </tr>
        </thead>
        <tbody>
          <tr><td><strong>&lt; 6 months</strong></td><td>Crisis mode. Cut burn or raise immediately.</td></tr>
          <tr><td><strong>6–12 months</strong></td><td>Active fundraising window. Begin the raise now.</td></tr>
          <tr><td><strong>12–18 months</strong></td><td>Thinner than the recommended buffer. Workable — but the next raise, or the burn plan that makes one unnecessary, should already be underway.</td></tr>
          <tr><td><strong>18–24 months</strong></td><td>Comfortable. The recommended post-raise target; most Series A/B land here.</td></tr>
          <tr><td><strong>24–36 months</strong></td><td>Strong buffer for weathering downturns.</td></tr>
          <tr><td><strong>&gt; 36 months</strong></td><td>Either a huge round or near-profitability. Some VCs will nudge you to deploy more aggressively.</td></tr>
        </tbody>
      </table>
      <p>
        The rule of thumb is simple: <strong>always keep enough runway to survive an 18-month
        fundraising process</strong>. In a tough market, raising takes 9–12 months, not 3.
      </p>

      <h3>Three tripwires: when the number forces a decision</h3>
      <p>
        A runway reading is not trivia — at certain levels it obligates action. Use these
        boundaries:
      </p>
      <ol>
        <li>
          <strong>Inside 18 months — open the raise window.</strong> Not panic; preparation. Begin
          the next raise, or the concrete burn-reduction plan that makes one unnecessary, this
          quarter — the 18–24 band in the table is the destination you are working toward, and a
          raise started here still closes with leverage.
        </li>
        <li>
          <strong>Below 12 months — act, don&rsquo;t plan.</strong> Cut a line item this month.
          Companies that start adjusting at 11 months meet the market with leverage; companies that
          start at 7 meet it with none.
        </li>
        <li>
          <strong>Below 6 months — crisis mode.</strong> Cut to the survival cost base immediately
          and treat any raise you cannot close inside 90 days as unavailable. Extend the clock
          first; strategy comes second.
        </li>
      </ol>

      <h2 id="strategies">How to extend your runway</h2>
      <ol>
        <li>
          <strong>Cut gross burn surgically.</strong> Runway is the lever you control most directly.
          Reduce headcount (the single biggest line), renegotiate SaaS contracts, and audit cloud
          spend. A 20% burn cut is often faster and cheaper than a 20% revenue increase — and once
          the leaner cost base is set, run it through the{' '}
          <a href="/break-even-calculator/">break-even calculator</a> to see how much revenue the
          smaller company still needs to cover it.
        </li>
        <li>
          <strong>Push annual prepay plans.</strong> Offering a 10–15% discount for annual contracts
          accelerates cash collection without hurting long-term revenue. $50k of MRR converted from
          monthly to annual puts ~$510–540k in the bank immediately — twelve months of MRR, less
          the discount you gave for it.
        </li>
        <li>
          <strong>Improve gross margin.</strong> If your COGS (hosting, support, third-party APIs)
          is high, every dollar of revenue buys less runway. Move to cheaper infra, automate
          support, and renegotiate vendor costs. The calculator&rsquo;s gross-margin input models
          this directly: at 80% margin, $50k of burn needs $62.5k of MRR to break even — 25% more
          revenue for the same finish line — which is why a 70% gross margin extends runway
          meaningfully more than a 50% one at the same MRR.
        </li>
        <li>
          <strong>Slow hiring, not firing.</strong> A hiring freeze for one quarter can add 3–6
          months of runway without the morale and legal cost of layoffs. Re-evaluate every open req
          against runway monthly.
        </li>
        <li>
          <strong>Layer in non-dilutive capital.</strong> Revenue-based financing, venture debt, or
          SaaS loans against signed ARR can extend runway 6–12 months without an equity round.
        </li>
      </ol>

      <h2 id="boundaries">Decision boundaries</h2>
      <p>
        A model earns trust by stating where it stops working. The lines below are drawn for the
        runway engine specifically — and every critical value in this section was produced by
        scanning the same engine the calculator runs, never typed by hand.
      </p>

      <h3>When this model is the right instrument</h3>
      <ul>
        <li>
          <strong>Revenue is predominantly recurring</strong> and can honestly be summarized as one
          net monthly compounding rate — new sales plus expansion minus churn.
        </li>
        <li>
          <strong>Burn is roughly steady</strong> month to month, or you deliberately enter the
          post-change run rate — the burn that applies once the planned hire lands or the cut has
          taken effect.
        </li>
        <li>
          <strong>You want the no-new-cash countdown</strong>: the literal clock to the next raise,
          unsoftened by hoped-for inflows.
        </li>
      </ul>

      <h3>When to set it aside</h3>
      <ul>
        <li>
          <strong>Lumpy or non-recurring revenue</strong> (enterprise one-offs, project work):
          compounding MRR will overstate. Enter only the recurring floor as MRR and book cleared
          project cash as a one-time addition to the starting balance.
        </li>
        <li>
          <strong>Burn is about to step</strong> — a raise closing, a hiring wave, a contract
          renewal. Enter the post-step burn, not today&rsquo;s, or the runway answers a question
          you no longer have.
        </li>
        <li>
          <strong>You need to model the fundraise itself.</strong> The tool intentionally assumes
          zero inflows; runway is the input to the raise decision, not its output.
        </li>
        <li>
          <strong>Collections are slower or lumpier than one month.</strong> Only a 0- or 1-month
          lag is modeled; annual prepayment collected up front belongs in today&rsquo;s cash
          balance, not in the growth rate.
        </li>
        <li>
          <strong>Inputs leave the engine&rsquo;s declared domain:</strong> growth is clamped to
          [−20, +50] %/mo and the projection horizon is 120 months. A &ldquo;120+&rdquo; reading is
          drift — long, not safe.
        </li>
      </ul>

      <h3>The critical values — and how they were found</h3>
      <p>
        Three scans, all run against the reference profile used throughout this guide ($500k
        cash / $50k gross burn / $10k MRR): the break-even cliff uses the library&rsquo;s own
        bisection over the survival predicate (midpoint bounded to ±0.001pp); the naive-division
        adequacy boundaries come from a 0.5pp grid scan of simulated-minus-naive runway; the
        affordable-burn figures come from a bisection on gross burn to a ±$25 bracket. Your
        company&rsquo;s versions of these numbers are different — rerun the calculator on your own
        inputs before acting on any of them.
      </p>
      <table>
        <thead>
          <tr>
            <th>Gross margin</th>
            <th>Break-even MRR</th>
            <th>Growth needed to break even first</th>
          </tr>
        </thead>
        <tbody>
          {cliffByMargin.map((row) => (
            <tr key={row.margin}>
              <td>{row.margin}%</td>
              <td>{usd(row.beMrr, 0)}</td>
              <td>≈{row.g === null ? '—' : row.g.toFixed(1)}%/mo</td>
            </tr>
          ))}
        </tbody>
      </table>
      <ul>
        <li>
          <strong>The collections boundary.</strong> The same profile with a one-month collection
          lag needs ≈{cliffWithLag === null ? '—' : cliffWithLag.toFixed(1)}%/mo instead of{' '}
          ≈{cliffGrowth === null ? '—' : cliffGrowth.toFixed(1)}%/mo — a receivables slip raises
          the survival bar by roughly a point of monthly growth.
        </li>
        <li>
          <strong>When the naive division is good enough.</strong> Below ≈
          {gapOneMonth === null ? '—' : gapOneMonth.toFixed(1)}%/mo growth it tracks the
          simulation within about a month; at ≈
          {gapThreeMonths === null ? '—' : gapThreeMonths.toFixed(1)}%/mo it is already three
          months short; beyond the cliff it is meaningless — the countdown has stopped.
        </li>
        <li>
          <strong>The 18-month tripwire, in burn terms.</strong> At 8%/mo growth the reference
          profile can carry at most ≈{usd(tripwireBurnGrowing, 0)} of gross burn — a{' '}
          {tripwireCutPct(tripwireBurnGrowing).toFixed(0)}% cut from the current $50,000. With
          flat growth the ceiling is ≈{usd(tripwireBurnFlat, 0)}, a{' '}
          {tripwireCutPct(tripwireBurnFlat).toFixed(0)}% cut: eight points of monthly compounding
          buy ≈{usd(tripwireBurnGrowing - tripwireBurnFlat, 0)} of monthly burn headroom at the
          same deadline.
        </li>
        <li>
          <strong>The margin floor.</strong> At 0% margin the break-even MRR is infinite — the
          readout states that no amount of MRR covers burn rather than inventing a number. At 60%
          margin, break-even MRR is {usd(cliffByMargin[2].beMrr, 0)} and the survival cliff sits
          five points of monthly growth higher than at 100%.
        </li>
        <li>
          <strong>The positivity line.</strong> The moment margin-weighted MRR ≥ gross burn
          (initial net burn ≤ 0), runway is effectively infinite: $60k of MRR against $50k of burn
          at 100% margin means +$10,000 every month from month one. Below the line, every point in
          this section applies; on it, the question stops being survival and becomes deployment.
        </li>
      </ul>

      <h2 id="glossary">Glossary</h2>
      <dl className="mt-2 space-y-5">
        <div>
          <dt className="font-semibold text-slate-900 dark:text-slate-100">Runway</dt>
          <dd className="mt-0.5 leading-relaxed text-slate-600 dark:text-slate-300">
            How many months the company keeps operating at its current inputs before cash reaches
            zero. The one number that converts every other metric into time.
          </dd>
        </div>
        <div>
          <dt className="font-semibold text-slate-900 dark:text-slate-100">Gross burn</dt>
          <dd className="mt-0.5 leading-relaxed text-slate-600 dark:text-slate-300">
            Total cash operating expenses per month — salaries, infrastructure, tools, rent —
            before any revenue offset.
          </dd>
        </div>
        <div>
          <dt className="font-semibold text-slate-900 dark:text-slate-100">Net burn</dt>
          <dd className="mt-0.5 leading-relaxed text-slate-600 dark:text-slate-300">
            Gross burn minus the gross-margin share of collected revenue: the actual monthly drain
            on the bank balance. Runway is always defined against net burn, never gross.
          </dd>
        </div>
        <div>
          <dt className="font-semibold text-slate-900 dark:text-slate-100">MRR</dt>
          <dd className="mt-0.5 leading-relaxed text-slate-600 dark:text-slate-300">
            Monthly recurring revenue — the subscription revenue that repeats every month, and the
            base the growth input compounds.
          </dd>
        </div>
        <div>
          <dt className="font-semibold text-slate-900 dark:text-slate-100">ARR</dt>
          <dd className="mt-0.5 leading-relaxed text-slate-600 dark:text-slate-300">
            Annualized recurring revenue: MRR × 12. The same quantity on the scale investors
            prefer.
          </dd>
        </div>
        <div>
          <dt className="font-semibold text-slate-900 dark:text-slate-100">Gross margin</dt>
          <dd className="mt-0.5 leading-relaxed text-slate-600 dark:text-slate-300">
            The share of each revenue dollar left after cost of goods sold. At 80% margin, a dollar
            of MRR offsets only 80 cents of burn — which is why break-even MRR rises as margin
            falls.
          </dd>
        </div>
        <div>
          <dt className="font-semibold text-slate-900 dark:text-slate-100">COGS</dt>
          <dd className="mt-0.5 leading-relaxed text-slate-600 dark:text-slate-300">
            Cost of goods sold — the direct costs of delivering the service (hosting, support,
            payment fees). Exactly what gross margin subtracts.
          </dd>
        </div>
        <div>
          <dt className="font-semibold text-slate-900 dark:text-slate-100">Break-even MRR</dt>
          <dd className="mt-0.5 leading-relaxed text-slate-600 dark:text-slate-300">
            The MRR whose margin-weighted value exactly covers gross burn: burn ÷ margin —{' '}
            {usd(margin80.breakevenMrr, 0)} on $50,000 of burn at 80% margin. Below it you burn
            cash; above it you accumulate.
          </dd>
        </div>
        <div>
          <dt className="font-semibold text-slate-900 dark:text-slate-100">Collection lag (DSO)</dt>
          <dd className="mt-0.5 leading-relaxed text-slate-600 dark:text-slate-300">
            How long after a month bills its revenue the cash actually lands. The calculator
            models a one-month lag as its receivables stress test.
          </dd>
        </div>
        <div>
          <dt className="font-semibold text-slate-900 dark:text-slate-100">Net contraction</dt>
          <dd className="mt-0.5 leading-relaxed text-slate-600 dark:text-slate-300">
            Negative growth: churn outrunning expansion, so MRR shrinks each month and every
            month&rsquo;s burn is worse than the last.
          </dd>
        </div>
        <div>
          <dt className="font-semibold text-slate-900 dark:text-slate-100">Naive runway</dt>
          <dd className="mt-0.5 leading-relaxed text-slate-600 dark:text-slate-300">
            The shortcut: cash ÷ today&rsquo;s net burn. Exact when growth is zero, and
            progressively wrong as growth compounds.
          </dd>
        </div>
        <div>
          <dt className="font-semibold text-slate-900 dark:text-slate-100">Drift</dt>
          <dd className="mt-0.5 leading-relaxed text-slate-600 dark:text-slate-300">
            The &ldquo;120+ months&rdquo; outcome: cash outlasts the projection horizon without
            MRR ever covering burn. Read it as long, not safe.
          </dd>
        </div>
      </dl>

      <Faq
        items={[
          {
            question: 'How is SaaS runway calculated?',
            answer:
              'Runway = cash on hand divided by monthly net burn, where net burn = gross cash expenses minus the gross-margin share of revenue. A more accurate method — which this calculator uses — projects month-by-month, growing MRR each month before deducting the next month\'s burn (optionally with a one-month collection lag to stress-test receivables). That captures the fact that a growing SaaS stretches its runway as revenue rises.',
          },
          {
            question: "What's the difference between gross burn and net burn?",
            answer:
              'Gross burn is the total cash you spend each month on operating expenses (salaries, infrastructure, tools, rent). Net burn is gross burn minus the gross-margin share of revenue — equal to revenue itself at a 100% margin. A company with $100k gross burn and $60k MRR has a $40k net burn at 100% gross margin, and $52k at 80% margin ($60k × 0.8 = $48k offset). Runway should always be calculated against net burn, not gross.',
          },
          {
            question: 'How much runway should a startup have?',
            answer:
              'Most operators and investors recommend 18–24 months after a fundraise — roughly a year of focused building plus the 9–12 months a raise can take in a tough market. Anything under 12 months should be treated as a fire alarm; under 6 months is a crisis requiring immediate burn reduction.',
          },
          {
            question: 'Does MRR growth really extend runway that much?',
            answer: `Yes — often dramatically. Because MRR compounds, the back half of your runway has materially lower net burn than the front half. For a business growing MRR 10%+/month, real runway can be 50–100% longer than the simple "cash ÷ today's net burn" calculation. The chart in the calculator visualizes this flattening burn curve. Past a certain growth rate (${
              cliffGrowth === null ? '—' : cliffGrowth.toFixed(1)
            }%/mo for the $500k/$50k/$10k example above), the countdown stops entirely: MRR overtakes burn before the cash runs out.`,
          },
          {
            question: 'What is break-even MRR?',
            answer:
              "Break-even MRR is the monthly recurring revenue whose gross-margin share exactly covers your gross burn — i.e., when net burn hits zero. At 100% margin that equals gross burn; at 80% margin it is gross burn ÷ 0.8, so $50k of burn needs $62.5k MRR. Below it you burn cash; above it you accumulate cash. Reaching break-even MRR is the single most important milestone for any pre-profit SaaS, because it converts your runway from finite to (effectively) infinite.",
          },
          {
            question: 'Should I include accounts receivable or only cash?',
            answer:
              'For a conservative runway number, use only liquid cash and equivalents in the bank. Signed contracts and accounts receivable that have not yet been collected should be excluded, because collection timing can slip and they are not spendable today. You can quantify exactly how much a one-month collection slip costs you with the calculator\u2019s collections stress test toggle.',
          },
          {
            question:
              'Why does the calculator show a longer runway than my cash ÷ net burn spreadsheet?',
            answer: `Your spreadsheet freezes today's net burn forever; the simulation compounds MRR month by month, so every later month drains less. On the reference profile above ($500k cash, $50k burn, $10k MRR at 100% margin) the shortcut says ${numFmt(
              flatExact,
              1,
            )} months while the engine says ${numFmt(
              atEight.monthsExact ?? 0,
              1,
            )} at 8%/mo growth. Whole-month-only tools add a further gap: they report the ceiling (${flatMonths} months where the exact figure is ${numFmt(
              flatExact,
              1,
            )}).`,
          },
          {
            question: 'What monthly growth rate makes runway effectively infinite?',
            answer: `There is a hard threshold: the smallest growth rate at which MRR overtakes burn before the cash runs out. For the reference profile it is ≈${
              cliffGrowth === null ? '—' : cliffGrowth.toFixed(1)
            }%/mo — at 9%/mo the same business crosses cash-flow break-even at month ${
              atNine.profitableAtMonth ?? '—'
            } with ${usd(
              atNineCrossCash,
              0,
            )} still in the bank at that month\u2019s end. The calculator reports your own version of this number as "Growth to break even".`,
          },
          {
            question: 'What happens when MRR is shrinking?',
            answer: `Contraction inverts the growth story: each month's burn is worse than the last, so the naive division now overstates runway. In the long-winter example above, −2%/mo at 75% margin turns a ${numFmt(
              winterNaive,
              1,
            )}-month naive figure into ${numFmt(
              winterRun.monthsExact ?? 0,
              1,
            )} months of real runway, with net burn rising from ${usd(
              winterRun.points[1].netBurn,
              0,
            )} to ${usd(
              winterRun.points[19].netBurn,
              0,
            )} by month 19. Negative growth is a first-class input here, not an error.`,
          },
          {
            question: 'How much does gross margin change the answer?',
            answer: `More than most founders expect, because break-even MRR is burn ÷ margin. On $50k of burn, 80% margin needs ${usd(
              margin80.breakevenMrr,
              0,
            )} of MRR to break even versus $50,000 at 100% — 25% more revenue for the same finish line — and the flat-profile runway falls from ${numFmt(
              flatExact,
              1,
            )} to ${numFmt(
              margin80.monthsExact ?? 0,
              1,
            )} months. Margin is a runway lever, not just a reporting metric.`,
          },
          {
            question: 'What does the "120+ months" reading mean — is it good news?',
            answer: `It means the cash outlasts the model's 120-month horizon without MRR ever covering burn — long, but not safe. Example: $2,000,000 against $10,000 of monthly burn with zero MRR ends the projection with ${usd(
              DRIFT.finalCash ?? 0,
              0,
            )} in the bank and still no break-even (${numFmt(
              driftNaive,
              0,
            )} months on the naive division). The readout is amber on purpose: read it as drift, then fix the burn or the revenue model.`,
          },
          {
            question: 'My MRR already covers my burn — what will the calculator show?',
            answer: `It reports break-even — effectively infinite runway — because margin-weighted MRR exceeds gross burn. Example: $60k MRR against $50k burn at 100% margin is +$10,000 of cash per month, so a $300k balance grows to ${usd(
              POSITIVE.finalCash ?? 0,
              0,
            )} within the recorded tail, profitable from month ${
              POSITIVE.profitableAtMonth ?? '—'
            }. At that point the dashboard question flips from "how long do we have?" to "where do we deploy the surplus?".`,
          },
          {
            question: 'Does the model count whole months or fractions of a month?',
            answer: `Both, deliberately: the whole-month figure is the ceiling (the first month-end at or below zero), and the exact figure interpolates linearly inside that final month. For the flat reference profile those are ${flatMonths} and ${numFmt(
              flatExact,
              1,
            )} months — the second matches the naive division to the decimal. Use the exact figure whenever you compare tools or track changes month over month.`,
          },
          {
            question: 'How much does a one-month collection lag really cost?',
            answer: `One full month of gross burn up front: under the lag, month 1 collects nothing, so the pre-raise example above drains ${usd(
              preLagged.points[1].netBurn,
              0,
            )} instead of ${usd(
              preOnTime.points[1].netBurn,
              0,
            )}. Runway falls from ${numFmt(
              preOnTime.monthsExact ?? 0,
              1,
            )} to ${numFmt(
              preLagged.monthsExact ?? 0,
              1,
            )} months — ${numFmt(
              lagCostMonths,
              1,
            )} months gone — and on the reference profile the growth needed to break even rises from ≈${
              cliffGrowth === null ? '—' : cliffGrowth.toFixed(1)
            }%/mo to ≈${
              cliffWithLag === null ? '—' : cliffWithLag.toFixed(1)
            }%/mo. Near the cliff, that shift can flip survival into a countdown.`,
          },
          {
            question: 'Is cutting burn or pushing growth the better runway lever?',
            answer: `Cuts pay this month — and more than linearly: with MRR fixed, runway = cash ÷ (burn − margin-weighted MRR) is convex in burn, so each further cut buys more months than the one before it. On the flat reference profile, a 10% burn cut buys +${numFmt(
              (cut10.monthsExact ?? 0) - flatExact,
              1,
            )} months (${numFmt(
              cut10.monthsExact ?? 0,
              1,
            )} total) and the second 10% buys another +${numFmt(
              (cut20.monthsExact ?? 0) - (cut10.monthsExact ?? 0),
              1,
            )}, while +2pp of monthly growth buys only +${numFmt(
              (plus2pp.monthsExact ?? 0) - flatExact,
              1,
            )}. Past the break-even cliff, of course, growth wins outright — the countdown stops.`,
          },
          {
            question: 'Should I model my upcoming fundraise into the projection?',
            answer:
              'No — the model is deliberately no-new-cash: runway is the time you have to make the raise (or the plan that replaces it) happen, and softening it with assumed inflows defeats the purpose. That is why the standard is 18–24 months of runway: even a raise that takes 9–12 months to close leaves real buffer. Treat the raise as a decision you make inside the runway, not an input to it.',
          },
          {
            question: 'Does churn affect the runway math?',
            answer: `It is already inside the growth input: the model compounds net growth — new sales plus expansion minus churn — so a business losing 2%/mo net is exactly the long-winter example (${numFmt(
              winterRun.monthsExact ?? 0,
              1,
            )} months of runway, not the naive ${numFmt(
              winterNaive,
              1,
            )}). There is no separate churn dial because net growth is the number that actually moves the cash path. When planning, decompose net growth into gross churn and expansion — but the runway arithmetic only consumes the net figure.`,
          },
          {
            question: 'Why is the growth input clamped to −20%..+50% per month?',
            answer:
              'Beyond that band a compounding projection stops being a plan and becomes extrapolation for its own sake — the model does not convert it into months of runway. The clamp is real: a −25%/mo input behaves identically to −20%/mo (verified against the engine\u2019s month-by-month output). If your honest forecast sits outside the band, model the step change in MRR directly instead of extrapolating the rate.',
          },
          {
            question: 'What if my gross margin is 0% or very low?',
            answer: `At 0% margin the break-even MRR is infinite — no amount of revenue covers burn, and the calculator says exactly that rather than inventing a number. At 60% margin on $50k of burn, break-even needs ${usd(
              cliffByMargin[2].beMrr,
              0,
            )} of MRR, and the growth required to reach break-even before cash-out rises to ≈${
              cliffByMargin[2].g === null ? '—' : cliffByMargin[2].g.toFixed(1)
            }%/mo versus ≈${
              cliffGrowth === null ? '—' : cliffGrowth.toFixed(1)
            }%/mo at 100%. Low-margin businesses must fix margin or burn; growth alone cannot outhustle broken unit economics.`,
          },
          {
            question: 'How do I model annual prepaid contracts?',
            answer:
              'Collect the cash up front: add the prepayment to today\u2019s cash balance, keep MRR at what you will actually collect monthly, and do not also count the same dollars as growth. Double-counting prepay as both cash-in-hand and rising MRR is the classic way to overstate runway by months. The model has no lumpy-inflow dial on purpose — lumpiness belongs in the starting balance, honestly labeled.',
          },
          {
            question:
              "What's the difference between cash-flow break-even and GAAP profitability?",
            answer:
              'This engine works on collected cash: break-even means the margin-weighted MRR actually banked that month covers burn. GAAP profitability recognizes revenue when earned, so a company can be profitable on paper and still run out of money on timing — that gap is precisely what the one-month collection-lag stress test isolates. For runway, trust the collected basis; the accrual version is for your accountant.',
          },
          {
            question: 'Can I use this for a services or agency business?',
            answer:
              'Only as a conservative floor: enter truly recurring retainers as MRR, treat signed project work as one-time cash when it clears, and set everything else to zero. Modeling project revenue as recurring MRR will overstate runway, because the model assumes every month\u2019s revenue repeats and grows. For project economics, the break-even calculator in this suite is the better instrument.',
          },
          {
            question: 'How much gross burn can I afford and still keep 18 months of runway?',
            answer: `On the reference profile: at most ≈${usd(
              tripwireBurnGrowing,
              0,
            )} of monthly gross burn at 8%/mo growth — only a ≈${tripwireCutPct(
              tripwireBurnGrowing,
            ).toFixed(0)}% cut from the current $50,000. The ceiling falls fast as growth flattens (the flat-growth figure and the bisection method behind both are in the decision-boundaries section above); the shape to remember is that growth buys burn headroom, so a company that cannot count on compounding has to buy its 18-month buffer with cuts.`,
          },
        ]}
      />

      <RelatedCalculators
        links={[
          { href: '/break-even-calculator/', label: 'Break-Even Calculator' },
          { href: '/stripe-fee-calculator', label: 'Stripe Fee Calculator' },
          { href: '/freelance-hourly-rate-calculator', label: 'Freelance Hourly Rate' },
          { href: '/llc-vs-ccorp-tax-calculator', label: 'LLC vs C-Corp Tax' },
        ]}
      />
    </article>
  );
}

import { ArticleToc } from '@/components/Article';
import { computeRunway } from '@/lib/runway';
import {
  carryingCost,
  cashLockedByTerms,
  expectedTermsCostPct,
} from '@/lib/latefee';
import {
  computeLtvCac,
  churnAtRatio,
  churnAtPayback,
  RATIO_HEALTHY,
  PAYBACK_HEALTHY_MONTHS,
} from '@/lib/ltvcac';
import { numFmt, usd } from '@/lib/format';

/* Every number this guide quotes is produced at module scope by the same
   engines the instruments run — the guide cannot drift from the tools.
   Reference company carried through all five sections: $600k banked,
   $60k/mo gross burn, $25k MRR compounding +4%/mo at 80% gross margin. */
const PROFILE = {
  cash: 600_000,
  grossBurn: 60_000,
  mrr: 25_000,
  growthRate: 4,
  grossMargin: 80,
};

/* ---- §1 The measurement trap: net vs gross burn, the margin bite, drift ---- */
const flat = computeRunway({ ...PROFILE, growthRate: 0 });
const fullMargin = computeRunway({ ...PROFILE, growthRate: 0, grossMargin: 100 });
const base = computeRunway(PROFILE);
const grossDivision = PROFILE.cash / PROFILE.grossBurn; // the wrong denominator
const naiveNet = PROFILE.cash / flat.initialNetBurn; // engine net burn, hand division
const DRIFT = computeRunway({ cash: 2_400_000, grossBurn: 15_000, mrr: 0, growthRate: 0 });
const driftNaive = 2_400_000 / 15_000; // 160 — past the engine's 120-month horizon

/* ---- §2 The precise reading: ceiling vs interpolated month ---- */
const tiny = computeRunway({
  cash: 40_000,
  grossBurn: 60_000,
  mrr: 0,
  growthRate: 0,
  grossMargin: 80,
});

/* ---- §3 The convexity of cuts (flat growth: clean cash ÷ net-burn identity) ---- */
const CUTS = [0, 10, 20, 30, 40, 50];
const cutRows = CUTS.map((cut) => {
  const grossBurn = PROFILE.grossBurn * (1 - cut / 100);
  const r = computeRunway({ ...PROFILE, grossBurn, growthRate: 0 });
  return { cut, grossBurn, r };
});
// Months each step buys over the row above it (positive: runway rises as burn falls).
const cutMarginals = cutRows.map((row, i) =>
  i === 0 ? null : (row.r.monthsExact ?? 0) - (cutRows[i - 1].r.monthsExact ?? 0),
);
// The burn at which margin-weighted MRR exactly covers spend — the cut that
// stops the countdown. Verified: engine returns break-even at month 1 there.
const BE_BURN = PROFILE.mrr * (PROFILE.grossMargin / 100);
const breakevenBurn = computeRunway({ ...PROFILE, grossBurn: BE_BURN, growthRate: 0 });
const cut20Growing = computeRunway({ ...PROFILE, grossBurn: 48_000 });
const cut20Trough = Math.min(...cut20Growing.points.map((p) => p.cash));
// Burn ceiling for an 18-month runway: bisection on grossBurn (±$25 bracket),
// run once per growth plan. Brackets validated against the engine.
const burnFor18 = (growth: number, lo: number, hi: number) => {
  const monthsAt = (burn: number) => {
    const r = computeRunway({ ...PROFILE, grossBurn: burn, growthRate: growth });
    return r.months === null ? Infinity : r.monthsExact ?? 0;
  };
  while (hi - lo > 25) {
    const mid = (lo + hi) / 2;
    if (monthsAt(mid) >= 18) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
};
const burn18Flat = burnFor18(0, 20_000, 60_000);
const burn18Growing = burnFor18(4, 60_000, 70_000);

/* ---- §4 Terms: Net-30 vs Net-60 on the $300k/yr billing base, plus the
   runway engine's one-month collection-lag stress test ---- */
const ANNUAL_BILLINGS = PROFILE.mrr * 12;
const CAPITAL_RATE = 10; // % — annual cost of capital
const BAD_DEBT = 2; // % — blended default expectation
const ar30 = cashLockedByTerms(ANNUAL_BILLINGS, 30);
const ar60 = cashLockedByTerms(ANNUAL_BILLINGS, 60);
const carry30 = carryingCost(ANNUAL_BILLINGS, CAPITAL_RATE, 30);
const carry60 = carryingCost(ANNUAL_BILLINGS, CAPITAL_RATE, 60);
const pct30 = expectedTermsCostPct(30, CAPITAL_RATE, BAD_DEBT);
const pct60 = expectedTermsCostPct(60, CAPITAL_RATE, BAD_DEBT);
const lagged = computeRunway({ ...PROFILE, collectionLag: 1 });
const lagCostMonths = Math.abs((base.monthsExact ?? 0) - (lagged.monthsExact ?? 0));

/* ---- §5 Unit economics: the same $100-ARPU, 80%-margin product, two
   acquisition profiles sharing the $25k/mo S&M line ---- */
const SM_SPEND = 25_000;
const BAD_INPUTS = {
  arpu: 100,
  grossMarginPct: 80,
  churnPct: 8,
  smSpend: SM_SPEND,
  newCustomers: 20,
};
const UNHEALTHY = computeLtvCac(BAD_INPUTS);
const HEALTHY = computeLtvCac({
  arpu: 100,
  grossMarginPct: 80,
  churnPct: 2.5,
  smSpend: SM_SPEND,
  newCustomers: 25,
});
const churnHalf = computeLtvCac({
  arpu: 100,
  grossMarginPct: 80,
  churnPct: 4,
  smSpend: SM_SPEND,
  newCustomers: 20,
});
// §5 boundary probes (review fix): the churn at which the ratio would clear the
// 3× rule at this UNCHANGED CAC (inverted closed form), and whether ANY churn
// clears the 12-month payback norm. Verified: 2.13%/mo for the ratio bar; null
// for payback — the simple payback floor (CAC ÷ gross profit) is churn-free.
const ratioRescueChurn = churnAtRatio(BAD_INPUTS, RATIO_HEALTHY);
const paybackRescueChurn = churnAtPayback(BAD_INPUTS, PAYBACK_HEALTHY_MONTHS);
// Killing the value-destroying acquisition line: burn falls to $35k and the
// growth input honestly turns negative — no new customers, 8%/mo churn.
const killAcq = computeRunway({
  cash: 600_000,
  grossBurn: 35_000,
  mrr: 25_000,
  growthRate: -8,
  grossMargin: 80,
});

export default function ManagingYourRunwayGuide() {
  const toc = [
    { id: 'measurement', label: 'The measurement trap' },
    { id: 'exact', label: 'Reading the clock to the decimal' },
    { id: 'convexity', label: 'The convexity of cuts' },
    { id: 'terms', label: 'How terms eat runway' },
    { id: 'unit-economics', label: 'Unit economics set the ceiling' },
    { id: 'sequence', label: 'The decision sequence' },
    { id: 'limits', label: 'Where this model ends' },
  ];

  return (
    <>
      <ArticleToc items={toc} />

      <p>
        Runway management is not a calculation — it is a sequence of decisions, and
        the order is fixed: <strong>measure the burn correctly, cut before you try to
        grow, collect before you spend, and only then fund acquisition, and only if a
        customer is worth more than they cost to win.</strong> Every other ordering
        spends money the clock has already claimed. This guide walks that sequence
        once, end to end, on one reference company so the levers can be compared on
        the same scale: <strong>$600,000 banked, $60,000/month of gross burn, $25,000
        of MRR compounding 4%/month at an 80% gross margin</strong>. Every figure
        about this reference company is computed by the same engines behind the{' '}
        <a href="/saas-runway-calculator/">runway</a>,{' '}
        <a href="/late-payment-cost-calculator/">late-payment cost</a>, and{' '}
        <a href="/ltv-cac-calculator/">LTV:CAC</a> instruments; the handful of
        practitioner benchmarks quoted along the way — the 18–24-month buffer, the{' '}
        {RATIO_HEALTHY}× ratio and {PAYBACK_HEALTHY_MONTHS}-month payback norms —
        are industry rules of thumb, labeled as such where they appear. Rerun the
        engines on your own numbers before acting on any of this.
      </p>

      {/* ============================ §1 ============================ */}
      <h2 id="measurement">The measurement trap: gross burn, net burn, and margin</h2>
      <p>
        The same bank balance supports three different runway readings, and two of
        them are wrong in opposite directions. Divide cash by <em>gross</em> burn —
        total operating spend, ignoring revenue — and the reference company has{' '}
        <strong>{numFmt(grossDivision, 1)} months</strong>. Divide by <em>net</em>{' '}
        burn — gross burn minus the margin-weighted revenue actually collected — and
        the engine&rsquo;s answer is a monthly drain of{' '}
        <strong>{usd(flat.initialNetBurn, 0)}</strong>, or{' '}
        <strong>{numFmt(naiveNet, 1)} months</strong>. Neither number is a rounding
        error away from the other; the gross-burn division throws away{' '}
        {numFmt(naiveNet - grossDivision, 1)} months of runway the business already
        earns every month. Runway is <em>always</em> defined against net burn — the
        mistake survives in the wild because &ldquo;monthly burn&rdquo; is easier to
        say than &ldquo;monthly net burn at our gross margin.&rdquo;
      </p>
      <p>
        The margin input is where the second trap hides. Revenue offsets burn only to
        the extent it survives cost of goods sold, so the MRR needed to stop burning
        is gross burn <em>divided by</em> margin. For this company that is{' '}
        <strong>{usd(flat.breakevenMrr, 0)}</strong> of MRR at 80% margin —{' '}
        <strong>{numFmt((flat.breakevenMrr / fullMargin.breakevenMrr - 1) * 100, 0)}%
        more than the {usd(fullMargin.breakevenMrr, 0)} the burn figure
        suggests</strong>. A team that anchors on &ldquo;MRR = burn&rdquo; as the finish line
        will arrive at break-even still bleeding: at the same $25k MRR and 100%
        margin the flat runway would be {numFmt(fullMargin.monthsExact ?? 0, 1)}{' '}
        months, not the {numFmt(flat.monthsExact ?? 0, 1)} the 80% margin delivers.
        Margin is not a reporting metric here — it is the exchange rate between
        revenue and survival.
      </p>
      <p>
        The third misreading is the most seductive: <strong>&ldquo;120+ months.&rdquo;</strong>{' '}
        Park $2.4 million against $15,000 of burn with no revenue and the engine
        refuses the number — the projection runs out of horizon, not cash: the
        balance ends the 120-month cap at{' '}
        {usd(DRIFT.finalCash ?? 0, 0)} without revenue ever covering burn. That
        reading is <em>drift, not safety</em> — the naive division would claim{' '}
        {numFmt(driftNaive, 0)} months ({numFmt(driftNaive / 12, 0)} years), but
        &ldquo;long&rdquo; and &ldquo;safe&rdquo; are different claims. A drift
        reading obligates the same two fixes as any other: repair the burn line or
        repair the revenue model. The clock is quieter, not off.
      </p>

      {/* ============================ §2 ============================ */}
      <h2 id="exact">Reading the clock to the decimal</h2>
      <p>
        Whole-month runway figures have a systematic bias: they report the month in
        which the balance <em>dies</em>, not the moment it crosses zero. The engine
        reports both on purpose. A company holding $40,000 against $60,000 of burn
        has <strong>{numFmt(tiny.monthsExact ?? 0, 2)} months</strong> of true
        runway — the balance crosses zero two-thirds of the way through month{' '}
        {tiny.months ?? 1} — yet whole-month tools report &ldquo;{tiny.months ?? 1} month,&rdquo;
        a {numFmt(((tiny.months ?? 1) / (tiny.monthsExact ?? 1) - 1) * 100, 0)}%
        overstatement. The bias is worst exactly where it hurts most: near the end,
        where every reading drives a decision.
      </p>
      <p>
        The reference company&rsquo;s plan reads{' '}
        <strong>{numFmt(base.monthsExact ?? 0, 1)} months exact</strong> against a{' '}
        {base.months}-month ceiling — and the flat-profile exact figure{' '}
        ({numFmt(flat.monthsExact ?? 0, 1)}) reproduces the naive cash ÷ net-burn
        division to the decimal, which is the point: the interpolated figure is the
        one that can be compared across tools, across months, and against the
        shortcut without a rounding convention masquerading as economics. Two habits
        follow. Use the exact figure whenever runway feeds a decision or a
        month-over-month trend. And when growth is real, remember the shortcut
        errs <em>low</em> — compounding MRR stretches the back half of the runway,
        worth {numFmt((base.monthsExact ?? 0) - naiveNet, 1)} months on this plan.
        Under contraction the same shortcut errs <em>high</em>, which is far more
        dangerous: the long-winter case is the runway tool&rsquo;s own stress
        preset, not a corner case.
      </p>

      {/* ============================ §3 ============================ */}
      <h2 id="convexity">The convexity of cuts: why the second 10% is worth more than the first</h2>
      <p>
        With revenue held fixed, runway = cash ÷ (gross burn − margin-weighted MRR)
        — and that division is <strong>convex in burn</strong>: every cut shrinks
        the denominator, so the next identical cut buys strictly more months than
        the one before it. The matrix below runs the reference company flat (0%
        growth) so each cell is the clean cash ÷ net-burn identity, engine-solved:
      </p>
      <table>
        <thead>
          <tr>
            <th>Burn cut</th>
            <th>Gross burn</th>
            <th>Net burn</th>
            <th>Runway (exact)</th>
            <th>Months bought by this step</th>
          </tr>
        </thead>
        <tbody>
          {cutRows.map((row, i) => (
            <tr key={row.cut}>
              <td>{row.cut === 0 ? '— (today)' : `−${row.cut}%`}</td>
              <td>{usd(row.grossBurn, 0)}</td>
              <td>{usd(row.r.initialNetBurn, 0)}</td>
              <td>
                <strong>{numFmt(row.r.monthsExact ?? 0, 1)} mo</strong>
              </td>
              <td>
                {cutMarginals[i] === null
                  ? 'baseline'
                  : `+${numFmt(cutMarginals[i] ?? 0, 1)} mo`}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p>
        Read the last column downward: the first 10% cut buys{' '}
        {numFmt(cutMarginals[1] ?? 0, 1)} months, the second buys{' '}
        {numFmt(cutMarginals[2] ?? 0, 1)}, the third {numFmt(cutMarginals[3] ?? 0, 1)},
        and the fourth {numFmt(cutMarginals[4] ?? 0, 1)}. Each step is the same
        $6,000/month of burn removed — the months per dollar <em>rise</em>. This is
        the arithmetic behind the operational instinct that a shallow cut is barely
        worth the meeting that approves it: a 10% trim is a stay of execution, while
        a 40% cut is a different company with a {numFmt((cutRows[4].r.monthsExact ?? 0) / (cutRows[0].r.monthsExact ?? 1), 1)}× longer clock.
        And the matrix has an edge: at a burn of{' '}
        {usd(BE_BURN, 0)}{' '}
        — margin-weighted MRR exactly covering spend — the countdown stops
        altogether; the engine returns break-even in month{' '}
        {breakevenBurn.profitableAtMonth}, not a month count. Cuts approach
        infinity <em>convexly</em>, which is the strongest argument in finance for
        cutting once and cutting deep rather than rationing out 5% every quarter.
      </p>
      <p>
        Cuts also stack with the growth plan, and the stack is more than additive.
        Hold the +4%/mo compounding and take only the 20% cut: the engine no longer
        returns a month count at all — the company crosses cash-flow break-even at{' '}
        <strong>month {cut20Growing.profitableAtMonth}</strong> with{' '}
        {usd(cut20Trough, 0)} still in the bank at the trough. Without the cut, the
        same growth plan dies in month {base.months} having never broken even. One
        fifth of the burn is the difference between a countdown and a finish line.
      </p>
      <p>
        For planning in the other direction — how much burn can we afford? —
        bisect the engine on gross burn at a fixed runway target. Holding 18
        months: the flat company can carry at most{' '}
        <strong>{usd(burn18Flat, 0)}/month</strong> (an{' '}
        {numFmt(((PROFILE.grossBurn - burn18Flat) / PROFILE.grossBurn) * 100, 1)}%
        cut), while the +4% growth plan carries{' '}
        <strong>{usd(burn18Growing, 0)}</strong> — about{' '}
        {numFmt(((burn18Growing - PROFILE.grossBurn) / PROFILE.grossBurn) * 100, 1)}%
        of headroom <em>above</em> today&rsquo;s spend. Growth buys burn headroom;
        that is its real currency on the runway. But note which lever is certain:
        the cut lands this month regardless of the market, while the compounding is
        a plan, not a fact. Sequence accordingly — bank the cut, then let the
        growth spend what it saved.
      </p>

      {/* ============================ §4 ============================ */}
      <h2 id="terms">How payment terms quietly eat runway</h2>
      <p>
        A Net-60 term is a loan you make to your customers, and it is priced in
        runway. The receivables engine puts the reference company&rsquo;s{' '}
        {usd(ANNUAL_BILLINGS, 0)} annual billing base at{' '}
        <strong>{usd(ar30, 0)} of cash permanently locked at Net-30</strong> and{' '}
        <strong>{usd(ar60, 0)} at Net-60</strong> — the 30-day extension strands an
        extra {usd(ar60 - ar30, 0)} of working capital, roughly one full month of
        billings, forever. At a 10% cost of capital the carrying cost runs from{' '}
        {usd(carry30, 0)}/year to <strong>{usd(carry60, 0)}/year</strong>. Add a 2%
        blended default expectation and the full expected cost of the terms rises
        from {numFmt(pct30, 2)}% to <strong>{numFmt(pct60, 2)}% of every invoiced
        dollar</strong>, per collection cycle — contractual market convention, not a
        statutory rate, but real money all the same.
      </p>
      <p>
        The runway engine prices the same slip in months. Flipping its one-month
        collection-lag stress test models exactly the Net-30 → Net-60 slide on a
        monthly-billed book: month 1 collects nothing, so the full{' '}
        {usd(lagged.points[1].netBurn, 0)} of gross burn walks out the door instead
        of {usd(base.points[1].netBurn, 0)}, and the deficit is never fully repaid —
        one month of margin-weighted revenue is simply delayed forever. The plan&rsquo;s
        runway falls from {numFmt(base.monthsExact ?? 0, 1)} to{' '}
        {numFmt(lagged.monthsExact ?? 0, 1)} months:{' '}
        <strong>{numFmt(lagCostMonths, 1)} months of runway traded for nothing</strong>{' '}
        — no new revenue, no new customers, just slower cash. Two months of life is
        a plausible price for one enterprise logo; it is a terrible price for a
        payment-term habit nobody negotiated on purpose. Terms policy is a runway
        lever with the same standing as burn policy — the{' '}
        <a href="/guides/getting-paid-without-losing-margin/">payment-rails
        guide</a> works the invoice-level arithmetic in depth.
      </p>

      {/* ============================ §5 ============================ */}
      <h2 id="unit-economics">Unit economics set the ceiling on what runway is worth</h2>
      <p>
        When a customer costs more to acquire than they will ever return, extending
        runway is not management — it is life support. The unit-economics engine
        prices the same product ($100 ARPU, 80% margin, $25,000/month of sales
        spend) under two acquisition profiles:
      </p>
      <table>
        <thead>
          <tr>
            <th>Reading</th>
            <th>Profile A · value-destroying</th>
            <th>Profile B · value-creating</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Churn (monthly → annualized)</td>
            <td>8% → {numFmt(UNHEALTHY.annualChurnPct, 1)}%</td>
            <td>2.5% → {numFmt(HEALTHY.annualChurnPct, 1)}%</td>
          </tr>
          <tr>
            <td>CAC (blended)</td>
            <td>{usd(UNHEALTHY.cac ?? 0, 0)}</td>
            <td>{usd(HEALTHY.cac ?? 0, 0)}</td>
          </tr>
          <tr>
            <td>LTV, gross-margin basis</td>
            <td>{usd(UNHEALTHY.ltv ?? 0, 0)}</td>
            <td>{usd(HEALTHY.ltv ?? 0, 0)}</td>
          </tr>
          <tr>
            <td>LTV:CAC</td>
            <td>
              <strong>{numFmt(UNHEALTHY.ratio ?? 0, 1)}×</strong>
            </td>
            <td>
              <strong>{numFmt(HEALTHY.ratio ?? 0, 1)}×</strong>
            </td>
          </tr>
          <tr>
            <td>CAC payback · simple</td>
            <td>{numFmt(UNHEALTHY.paybackMonths ?? 0, 1)} mo</td>
            <td>{numFmt(HEALTHY.paybackMonths ?? 0, 1)} mo</td>
          </tr>
          <tr>
            <td>CAC payback · churn-adjusted</td>
            <td>
              <strong>never — customers die before repaying</strong>
            </td>
            <td>{numFmt(HEALTHY.paybackChurnAdjusted ?? 0, 1)} mo</td>
          </tr>
        </tbody>
      </table>
      <p>
        Profile A spends {usd(SM_SPEND, 0)} to win 20 customers at{' '}
        {usd(UNHEALTHY.cac ?? 0, 0)} each against a lifetime value of{' '}
        {usd(UNHEALTHY.ltv ?? 0, 0)} — a ratio of{' '}
        {numFmt(UNHEALTHY.ratio ?? 0, 1)}×, below 1: <strong>every acquisition
        destroys {usd((UNHEALTHY.cac ?? 0) - (UNHEALTHY.ltv ?? 0), 0)} of expected
        value</strong>, and the churn-adjusted payback is not slow but undefined —
        the engine returns null rather than inventing a number, because the cohort
        mathematically never repays its CAC. (Measure honestly here: the revenue-basis
        LTV of {usd(UNHEALTHY.ltvRevenueBasis ?? 0, 0)} dresses the same profile up
        {numFmt(UNHEALTHY.revenueBasisOverstatementPct ?? 0, 0)}% rosier than the
        gross-profit truth — margin is the exchange rate in unit economics too.)
        Growth spend in this state doesn&rsquo;t extend the runway it pretends to
        grow into; it consumes it. The engine makes the alternative concrete: kill
        the acquisition line, let burn fall to $35,000 and growth honestly reverse
        to −8%/mo (no new customers, churn unaddressed), and runway still stretches
        from {numFmt(flat.monthsExact ?? 0, 1)} to{' '}
        <strong>{numFmt(killAcq.monthsExact ?? 0, 1)} months</strong> — a shrinking
        company that keeps its cash outlives a growing one that burns it.
      </p>
      <p>
        Churn repair helps, but the engine is blunt about its limits: halve churn to
        4% and LTV doubles to {usd(churnHalf.ltv ?? 0, 0)} — the LTV = gross profit ÷
        churn identity — yet the ratio only reaches{' '}
        {numFmt(churnHalf.ratio ?? 0, 1)}×, just over half —{' '}
        {numFmt(((churnHalf.ratio ?? 0) / RATIO_HEALTHY) * 100, 0)}% of the{' '}
        {RATIO_HEALTHY}× industry rule of thumb. The engine can name the exact churn
        that would clear even the ratio bar at this unchanged CAC —{' '}
        {ratioRescueChurn === null
          ? 'no churn rate in the model\u2019s domain does it'
          : `below ≈${numFmt(ratioRescueChurn, 1)}%/mo`}{' '}
        — a{' '}
        {numFmt(BAD_INPUTS.churnPct / (ratioRescueChurn ?? BAD_INPUTS.churnPct), 1)}×
        churn improvement on 8%, best-in-class territory rather than a fix. The{' '}
        {PAYBACK_HEALTHY_MONTHS}-month payback norm is further away still —{' '}
        {paybackRescueChurn === null ? (
          <>
            no churn rate clears it, because the churn-independent floor — CAC ÷
            gross profit, {numFmt(UNHEALTHY.paybackMonths ?? 0, 1)} months — already
            sits above it. At this CAC, repair means the acquisition cost itself has
            to fall.
          </>
        ) : (
          <>it takes churn below ≈{numFmt(paybackRescueChurn, 1)}%/mo.</>
        )}{' '}
        Profile B
        shows the other edge of the same rules of thumb: it clears the{' '}
        {RATIO_HEALTHY}× ratio at {numFmt(HEALTHY.ratio ?? 0, 1)}× but breaches the{' '}
        {PAYBACK_HEALTHY_MONTHS}-month payback norm at{' '}
        {numFmt(HEALTHY.paybackChurnAdjusted ?? 0, 1)} months churn-adjusted. When
        the two benchmarks disagree, the tiebreaker is your runway: acquisition is a
        loan to the future, repaid at {usd(HEALTHY.monthlyGrossProfit, 0)}/month per
        customer, so <strong>never fund acquisition whose churn-adjusted payback
        approaches your months of runway</strong> — a company with{' '}
        {numFmt(base.monthsExact ?? 0, 1)} months of clock and a{' '}
        {numFmt(HEALTHY.paybackChurnAdjusted ?? 0, 1)}-month payback is financing
        cohorts it may not survive to collect. Both rules of thumb are practitioner
        canon, not law; your own margin, churn, and CAC decide.
      </p>

      {/* ============================ §6 ============================ */}
      <h2 id="sequence">The decision sequence</h2>
      <p>
        The five moves, in the order that protects the cash first — each one priced
        above on the reference company:
      </p>
      <ol>
        <li>
          <strong>Re-measure before you react.</strong> Net burn, not gross;{' '}
          {usd(flat.breakevenMrr, 0)} of break-even MRR, not{' '}
          {usd(fullMargin.breakevenMrr, 0)}; exact months, not whole-month ceilings.
          A decision made on a misread clock is wrong even when it happens to be
          dramatic enough.
        </li>
        <li>
          <strong>Cut once, deep enough to matter.</strong> Convexity pays: the
          second 10% out-buys the first{' '}
          ({numFmt(cutMarginals[2] ?? 0, 1)} vs {numFmt(cutMarginals[1] ?? 0, 1)}{' '}
          months), and a 20% cut stacked on the growth plan flips the whole
          projection to break-even by month {cut20Growing.profitableAtMonth}. Cut
          into the target, not toward it.
        </li>
        <li>
          <strong>Collect what you already earned.</strong> A Net-30 → Net-60 slide
          costs {numFmt(lagCostMonths, 1)} months on this plan and strands{' '}
          {usd(ar60 - ar30, 0)} of working capital. Terms policy is free runway
          until the day a customer makes it a negotiation — then price it with the{' '}
          <a href="/late-payment-cost-calculator/">late-payment cost instrument</a>{' '}
          instead of conceding it.
        </li>
        <li>
          <strong>Gate growth spend on unit economics.</strong> LTV:CAC at{' '}
          {numFmt(UNHEALTHY.ratio ?? 0, 1)}× means the growth budget is a burn line
          wearing a costume — cutting it <em>added</em>{' '}
          {numFmt((killAcq.monthsExact ?? 0) - (flat.monthsExact ?? 0), 1)} months
          even with revenue shrinking. Fund acquisition only above the line, and
          only when payback fits inside the clock.
        </li>
        <li>
          <strong>Raise inside the runway, never at the end of it.</strong> The
          18–24 month band is the standard post-raise buffer precisely because a
          raise can take 9–12 months to close; one started inside 12 months closes
          with leverage, one started inside 6 closes with none.
        </li>
      </ol>
      <p>
        Turn the reading into the obligation it carries:
      </p>
      <dl className="mt-2 space-y-5 rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 dark:border-white/[0.08] dark:bg-slate-900/60">
        <div>
          <dt className="font-semibold text-slate-900 dark:text-slate-100">
            Under 6 months — crisis
          </dt>
          <dd className="mt-0.5 leading-relaxed text-slate-600 dark:text-slate-300">
            Cut to the survival cost base this month; treat any raise that cannot
            close inside 90 days as unavailable. Extend the clock first; strategy
            comes second.
          </dd>
        </div>
        <div>
          <dt className="font-semibold text-slate-900 dark:text-slate-100">
            6–12 months — act, don&rsquo;t plan
          </dt>
          <dd className="mt-0.5 leading-relaxed text-slate-600 dark:text-slate-300">
            A line item dies this month, terms tighten this quarter, and the raise
            work starts now. Companies that adjust here meet the market with
            leverage.
          </dd>
        </div>
        <div>
          <dt className="font-semibold text-slate-900 dark:text-slate-100">
            12–18 months — open the window
          </dt>
          <dd className="mt-0.5 leading-relaxed text-slate-600 dark:text-slate-300">
            Begin the next raise or the burn plan that makes one unnecessary.
            Comfortable is not the same as done: at the reference burn, holding 18
            months flat costs an {numFmt(((PROFILE.grossBurn - burn18Flat) / PROFILE.grossBurn) * 100, 1)}% cut.
          </dd>
        </div>
        <div>
          <dt className="font-semibold text-slate-900 dark:text-slate-100">
            18–24 months — the working band
          </dt>
          <dd className="mt-0.5 leading-relaxed text-slate-600 dark:text-slate-300">
            A year of building plus the time a raise actually takes. This is the
            destination the other bands are routing you toward.
          </dd>
        </div>
        <div>
          <dt className="font-semibold text-slate-900 dark:text-slate-100">
            Past 24 months — allocation problem
          </dt>
          <dd className="mt-0.5 leading-relaxed text-slate-600 dark:text-slate-300">
            The question flips from survival to deployment — unless the reading is
            drift, in which case it is still a burn or revenue-model problem, just
            a quiet one.
          </dd>
        </div>
      </dl>

      {/* ============================ §7 ============================ */}
      <h2 id="limits">Where this model ends</h2>
      <p>
        Every figure above came from deterministic engines with stated domains, and
        the decisions they support inherit those limits. The projection is
        deliberately <strong>no-new-cash</strong>: a fundraise changes the starting
        balance, never the slope — runway is the time you have to make the raise
        happen, not an input to it. Burn is held flat between decisions: a hiring
        wave or a priced cut resets the clock and belongs in a fresh projection at
        the post-change run rate. Growth is clamped to [−20, +50]%/mo and the
        horizon to 120 months — the &ldquo;120+&rdquo; reading is drift, not a
        number. Collections are modeled as in-month or one month late; anything
        lumpier belongs in the starting balance, honestly labeled. And the model is
        a planning instrument, not a forecast: reconcile the cash input against the
        bank monthly, because a stale balance makes precise-looking outputs
        worthless. Within those bounds — measured right, cut deep, collected early,
        and spent only on customers worth more than they cost — the runway number
        stops being a countdown and becomes what it should have been all along: the
        schedule of your next decision.
      </p>
    </>
  );
}

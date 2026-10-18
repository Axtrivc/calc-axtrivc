import { ArticleToc } from '@/components/Article';
import {
  BREAKEVEN_PRESETS,
  breakEvenUnits,
  computeBreakEven,
  priceRiseTolerance,
} from '@/lib/breakeven';
import {
  computeDiscount,
  couponVsStraight,
  grossMarginPct,
  profitNeutralUpliftPct,
  revenueNeutralUpliftPct,
} from '@/lib/discount';
import { breakevenDiscount, carryingCost, discountImpliedAnnualized } from '@/lib/latefee';
import {
  LTV_CAC_PRESETS,
  PAYBACK_HEALTHY_MONTHS,
  RATIO_HEALTHY,
  annualizedChurn,
  churnAtPayback,
  churnAtRatio,
  computeLtvCac,
} from '@/lib/ltvcac';
import { numFmt, pct, usd } from '@/lib/format';

/* Every number in this guide is computed at module scope by the same engines
   the instruments run — lib/breakeven, lib/latefee, lib/discount, lib/ltvcac —
   so the prose cannot drift from the tools. The reference product is the SaaS
   preset the break-even and discount instruments ship ($79/mo, ~$8/account to
   serve): a reader can load that preset in either calculator and reproduce §1
   and §3 in one click. §5 loads the LTV:CAC calculator's own presets. */

/* ---- §1 The cost floor: the break-even engine's SaaS preset ---------------- */
const SAAS = BREAKEVEN_PRESETS.find((p) => p.id === 'saas')!.inputs;
const CVP = computeBreakEven(SAAS);
const NO_BE_AT_VARIABLE_COST = breakEvenUnits(
  SAAS.fixedCosts,
  SAAS.unitVariableCost,
  SAAS.unitVariableCost,
);
const SAAS_GM = grossMarginPct(SAAS.price, SAAS.unitVariableCost) ?? 0;
const BE_ACCOUNTS_ROUNDED = Math.round(CVP.breakEvenUnits ?? 0);

/* ---- §2 Annual vs monthly: the prepay discount as a financing rate --------- */
const MONTHLY = SAAS.price; // 79
const ANNUAL_PRICE = MONTHLY * 10; // "12 months for the price of 10"
const ANNUAL_LIST = MONTHLY * 12; // 948
const ANNUAL_DISCOUNT_PCT = (1 - ANNUAL_PRICE / ANNUAL_LIST) * 100; // 16.7
const COST_OF_CAPITAL = 10; // %/yr — a mid-range venture cost of funds
/* Carrying cost the vendor escapes by collecting the eleven deferred monthly
   payments on day zero — each leg priced by the late-payment engine. */
const DEFERRED_CARRY = Array.from({ length: 11 }, (_, k) =>
  carryingCost(MONTHLY, COST_OF_CAPITAL, 30 * (k + 1)),
).reduce((a, b) => a + b, 0);
const AVG_ACCEL_DAYS = 180; // mean of the eleven 30-day-interval deferrals
const FAIR_ANNUAL_DISCOUNT = breakevenDiscount(COST_OF_CAPITAL, 0, AVG_ACCEL_DAYS) ?? 0;
const FACE_ACCELERATED = MONTHLY * 11; // payments pulled to day zero
const FACE_NET_KEPT = ANNUAL_PRICE - MONTHLY; // cash kept beyond the month due now anyway
const CASH_SURRENDERED = ANNUAL_LIST - ANNUAL_PRICE; // face given up
/* Two stated bases for the implied prepay rate (they are NOT interchangeable):
   gross = surrender ÷ accelerated face; net = surrender ÷ cash kept after the
   discount. Both are simple interest over the average acceleration span. */
const PREPAY_IMPLIED_RATE = (CASH_SURRENDERED / FACE_ACCELERATED) * (365 / AVG_ACCEL_DAYS) * 100;
const PREPAY_IMPLIED_RATE_NET = (CASH_SURRENDERED / FACE_NET_KEPT) * (365 / AVG_ACCEL_DAYS) * 100;
/* The fair-discount pair on the same two bases: the engine's net-face boundary
   vs the carrying value read against the annual list. */
const FAIR_CARRY_PCT = (DEFERRED_CARRY / ANNUAL_LIST) * 100;
const CLASSIC_2_10_NET_30 = discountImpliedAnnualized(2, 10, 30) ?? 0; // net-face convention
/* Retention side: expected year-one revenue of a monthly account at 4%/mo
   churn vs the prepaid year. Survival from the engine's annualized churn. */
const REF_CHURN = 4;
const SURVIVE_12M = 1 - annualizedChurn(REF_CHURN) / 100;
const Y1_MONTHLY_EXPECTED = (MONTHLY * (1 - SURVIVE_12M)) / (REF_CHURN / 100);
const Y1_EDGE_ANNUAL = ANNUAL_PRICE - Y1_MONTHLY_EXPECTED;
/* The churn at which a prepaid year equals the monthly book's expected year —
   bisection on 79 × (1 − (1−c)^12) ÷ c = 790, the same geometric survival sum
   the LTV:CAC engine is built from. */
function annualSumMonths(c: number): number {
  return (1 - (1 - c) ** 12) / c;
}
const CHURN_WHERE_ANNUAL_WINS =
  (() => {
    let lo = 0.0001;
    let hi = 0.5;
    const target = ANNUAL_PRICE / MONTHLY;
    for (let i = 0; i < 200; i += 1) {
      const mid = (lo + hi) / 2;
      if (annualSumMonths(mid) < target) hi = mid;
      else lo = mid;
    }
    return (lo + hi) / 2;
  })() * 100; // ≈ 3.39%/mo

/* ---- §3 The discount ladder ------------------------------------------------ */
const LADDER = [5, 10, 15, 20, 25].map((d) => ({
  d,
  rev: revenueNeutralUpliftPct(d),
  prof: profitNeutralUpliftPct(SAAS.price, SAAS.unitVariableCost, d) ?? 0,
}));
const AGG20 = computeDiscount({
  price: SAAS.price,
  unitCost: SAAS.unitVariableCost,
  volume: SAAS.currentUnits,
  discountPct: 20,
});
/* The low-margin contrast from the discount calculator's own presets. */
const GADGET_GM = grossMarginPct(89, 41) ?? 0;
const GADGET_20OFF = profitNeutralUpliftPct(89, 41, 20) ?? 0;
/* A fenced credit vs a blanket percentage — the coupon engine's crossover. */
const COUPON_BASKET = 6000;
const COUPON = couponVsStraight(5000, 1000, COUPON_BASKET, 20);
const COUPON_SELLER_COST = COUPON_BASKET - COUPON.finalPriceCoupon; // 1,000
const BLANKET_SELLER_COST = COUPON_BASKET - COUPON.finalPriceStraight; // 1,200

/* ---- §4 Raising prices ------------------------------------------------------ */
const TOL_10 = priceRiseTolerance(SAAS.price, SAAS.unitVariableCost, 10) ?? 0;
const TOL_20 = priceRiseTolerance(SAAS.price, SAAS.unitVariableCost, 20) ?? 0;
const TOL_30 = priceRiseTolerance(SAAS.price, SAAS.unitVariableCost, 30) ?? 0;
const GADGET_TOL_10 = priceRiseTolerance(89, 41, 10) ?? 0;
const GF_LIST_IN_3Y = MONTHLY * 1.08 ** 3; // list at +8%/yr, three years on
const GF_SPREAD = (GF_LIST_IN_3Y / MONTHLY - 1) * 100;

/* ---- §5 The LTV:CAC loop: the calculator's own presets ---------------------- */
const REF = LTV_CAC_PRESETS.find((p) => p.id === 'reference')!.inputs;
const MMR = computeLtvCac(REF);
const REF_AFTER_20_OFF = computeLtvCac({ ...REF, arpu: REF.arpu * 0.8 });
const CHURN_AT_3 = churnAtRatio(REF, RATIO_HEALTHY) ?? 0;
const CHURN_AT_12MO_PAYBACK = churnAtPayback(REF, PAYBACK_HEALTHY_MONTHS) ?? 0;
const MM = LTV_CAC_PRESETS.find((p) => p.id === 'midmarket')!.inputs;
const MM_R = computeLtvCac(MM);
const MM_CHURN_AT_3 = churnAtRatio(MM, RATIO_HEALTHY) ?? 0;
const MM_PAYBACK_FIXABLE = churnAtPayback(MM, PAYBACK_HEALTHY_MONTHS); // null
const MM_ARPU_FOR_PAYBACK = ((MM_R.cac ?? 0) / PAYBACK_HEALTHY_MONTHS) / (MM.grossMarginPct / 100);
const MM_ARPU_MULTIPLE = MM_ARPU_FOR_PAYBACK / MM.arpu;
const MM_CAC_FOR_PAYBACK = (MM.grossMarginPct / 100) * MM.arpu * PAYBACK_HEALTHY_MONTHS;

/**
 * Guide body for /guides/saas-pricing-playbook/ — the decision playbook for
 * pricing subscription software. It threads three instruments into one path:
 * the cost floor from the break-even engine (lib/breakeven), the billing-term
 * and discount decisions from the trade-credit and discount engines
 * (lib/latefee, lib/discount), and the verdict on all of it from the LTV:CAC
 * engine's health band (lib/ltvcac).
 *
 * Rendering contract (GuideShell): the shell supplies h1, the reading time,
 * the prose column, and the closing instrument panel — this component starts
 * at plain paragraphs and h2 and renders through the shared .prose-article
 * tokens. Server-component safe: no hooks, no event handlers.
 */
export default function SaasPricingPlaybookGuide() {
  const toc = [
    { id: 'three-layers', label: 'Three layers: floor, ceiling, anchor' },
    { id: 'annual-vs-monthly', label: 'Annual vs monthly: a financing decision' },
    { id: 'discount-ladder', label: 'The discount ladder: 1 ÷ (1 − d)' },
    { id: 'raising', label: 'Raising prices: mechanics that hold the base' },
    { id: 'ltv-cac-loop', label: 'Closing the loop with LTV:CAC' },
    { id: 'boundaries', label: 'Where the framework ends — and the checklist' },
  ];

  return (
    <>
      <ArticleToc items={toc} />

      <p>
        <strong>
          Price subscription software in three layers — a cost floor you compute, a value ceiling
          you argue, and competitor prices that only sanity-check the result — and then treat every
          remaining pricing choice as a separately priced decision: the billing term is a financing
          decision, every discount is a volume contract, every raise is a churn bet, and the whole
          structure stands or falls on whether LTV:CAC holds above 3:1 with CAC paid back inside 12
          months.
        </strong>{' '}
        This guide runs each of those decisions through the suite&apos;s engines on one reference
        product — the{' '}
        <a href="/break-even-calculator/">break-even calculator&apos;s SaaS preset</a>: a{' '}
        {usd(MONTHLY, 0)}-a-month plan costing about {usd(SAAS.unitVariableCost, 0)} per account to
        serve, on a {usd(SAAS.fixedCosts, 0)} fixed base. The arithmetic that falls out: that
        product breaks even at <strong>{numFmt(BE_ACCOUNTS_ROUNDED)} accounts</strong>; a 20%
        discount obligates <strong>+{LADDER[3].prof.toFixed(1)}% more accounts</strong> to hold
        profit flat (not the famous +25%, which is only the no-cost best case); &ldquo;two months
        free&rdquo; on the annual plan is a {pct(ANNUAL_DISCOUNT_PCT, 0)} discount that pays an
        implied{' '}
        <strong>
          {PREPAY_IMPLIED_RATE.toFixed(1)}–{PREPAY_IMPLIED_RATE_NET.toFixed(1)}% annual rate
        </strong>{' '}
        for cash the business could finance at {COST_OF_CAPITAL}%; and a 10% price rise tolerates{' '}
        <strong>{TOL_10.toFixed(1)}% of the base walking</strong> before profit moves.
      </p>

      {/* ================================================================== */}
      <h2 id="three-layers">Three layers: floor, ceiling, anchor</h2>
      {/* ================================================================== */}
      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm dark:border-white/[0.08] dark:bg-slate-900/60">
          <div className="font-semibold text-slate-900 dark:text-slate-100">Floor — computed</div>
          <div className="mt-0.5 text-slate-500 dark:text-slate-400">
            Variable cost below the price; break-even above it
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm dark:border-white/[0.08] dark:bg-slate-900/60">
          <div className="font-semibold text-slate-900 dark:text-slate-100">Ceiling — argued</div>
          <div className="mt-0.5 text-slate-500 dark:text-slate-400">
            Value delivered, and the share of it you can capture
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm dark:border-white/[0.08] dark:bg-slate-900/60">
          <div className="font-semibold text-slate-900 dark:text-slate-100">Anchor — validated</div>
          <div className="mt-0.5 text-slate-500 dark:text-slate-400">
            Competitor prices check the answer; they do not set it
          </div>
        </div>
      </div>
      <p>
        <strong>Layer one: the cost floor.</strong> A subscription price sits above two floors, and
        confusing them is the classic mistake. The hard floor is variable cost — hosting, support,
        third-party fees, the per-account spend that scales one-to-one with usage. Price at the{' '}
        {usd(SAAS.unitVariableCost)} variable cost exactly and the break-even engine returns{' '}
        <code>{NO_BE_AT_VARIABLE_COST === null ? 'null' : 'a break-even'}</code>: no volume ever
        breaks even, because every account contributes nothing against the{' '}
        {usd(SAAS.fixedCosts, 0)} base. Price a dollar below it and every new account deepens the
        loss. The soft floor is full cost — break-even — and it is a volume question, not a price
        question. Run the preset through the engine:
      </p>
      <table>
        <thead>
          <tr>
            <th>Line</th>
            <th>Engine reading</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Contribution margin per account</td>
            <td>
              <strong>{usd(CVP.contributionMargin)}</strong> ({pct(CVP.cmRatioPct ?? 0)} of price) —
              each account throws {usd(CVP.contributionMargin, 0)} against the fixed base
            </td>
          </tr>
          <tr>
            <td>Break-even point</td>
            <td>
              <strong>{numFmt(BE_ACCOUNTS_ROUNDED)} accounts</strong> (
              {numFmt(CVP.breakEvenUnits ?? 0, 1)} exact) —{' '}
              {usd(CVP.breakEvenRevenue ?? 0, 0)}/mo of revenue
            </td>
          </tr>
          <tr>
            <td>First profitable account</td>
            <td>#{numFmt(CVP.firstProfitableUnit ?? 0)}</td>
          </tr>
          <tr>
            <td>At the current {SAAS.currentUnits} accounts</td>
            <td>
              {usd(CVP.currentRevenue, 0)} revenue,{' '}
              <strong>{usd(CVP.profitAtCurrent, 0)} operating profit</strong>
            </td>
          </tr>
          <tr>
            <td>Margin of safety</td>
            <td>
              {numFmt(CVP.marginOfSafetyUnits ?? 0)} accounts —{' '}
              <strong>{pct(CVP.marginOfSafetyPct ?? 0)}</strong> of volume could vanish before
              profit hits zero
            </td>
          </tr>
          <tr>
            <td>Operating leverage</td>
            <td>
              {(CVP.operatingLeverage ?? 0).toFixed(2)}× — ±10% volume swings profit{' '}
              ±{((CVP.operatingLeverage ?? 0) * 10).toFixed(1)}%
            </td>
          </tr>
        </tbody>
      </table>
      <p>
        That table prices the floor honestly: below break-even is not automatically mispricing —
        at {usd(MONTHLY, 0)} every account still contributes{' '}
        {usd(CVP.contributionMargin, 0)}, and most growing SaaS deliberately sit in that subsidy
        zone. The floor only becomes a verdict when <em>price</em> approaches variable cost, or
        when the margin of safety reads negative at a price the market will actually pay. One more
        readout matters for everything that follows: this product carries a{' '}
        <strong>{pct(SAAS_GM)}</strong> gross margin — high-margin and low-margin products obey
        the same pricing algebra very differently, and §3 and §4 both hinge on that number.
      </p>
      <p>
        <strong>Layer two: the value ceiling.</strong> The ceiling is what a customer gains per
        period — labor replaced, revenue added, risk removed — times the share of that gain you can
        actually capture. It is argued, not computed, but the argument has structure. Value that
        is measured survives negotiation; value that is asserted does not. The strongest ceilings
        sit on a <em>metric that grows with the customer&apos;s own usage or economics</em> —
        seats, tracked usage, transactions — because the ceiling then rises without repricing
        anything. A flat per-company price pins the ceiling at the smallest customer in the
        segment.
      </p>
      <p>
        You can raise prices without losing customers when delivered value has grown faster than
        price — usage deepened, more of the workflow absorbed, switching costs compounded — or
        when price is a small line in the customer&apos;s own P&amp;L. You cannot when customers
        buy on a comparison you do not control. If you cannot name a metric that tracks the
        customer&apos;s benefit, the ceiling is whatever the cheapest credible alternative charges
        plus your quantified difference — which is why the anchor layer exists.
      </p>
      <p>
        <strong>Layer three: the anchor.</strong> Competitor prices bound the explanation, never
        the number. A price far above the visible anchor set is not wrong; it simply cannot be
        sold on comparison — the value case has to carry it explicitly. Matching a competitor at
        a price below your variable-cost floor is still a subsidy (their cost structure and
        packaging are invisible to you). Use the anchor
        once, at the end: if the computed floor and the argued ceiling put you wildly outside the
        market&apos;s range, one of your three layers is wrong — find which. Never orbit the
        anchor: pricing at &ldquo;whatever they charge minus 10%&rdquo; outsources the two layers
        you can actually defend.
      </p>

      {/* ================================================================== */}
      <h2 id="annual-vs-monthly">Annual vs monthly: a financing decision</h2>
      {/* ================================================================== */}
      <p>
        The standard annual discount — twelve months for the price of ten — is three products sold
        as one: a <strong>financing transaction</strong> (the customer lends you eleven months of
        cash), a <strong>retention instrument</strong> (twelve churn decisions collapse into one
        renewal), and a <strong>price lock</strong> (list-price rises cannot touch the account for
        a year). Price the three separately or you will overpay for all of them.
      </p>
      <p>
        <strong>The financing leg.</strong> On the reference product, &ldquo;two months free&rdquo;
        prices a year at {usd(ANNUAL_PRICE, 0)} against a {usd(ANNUAL_LIST, 0)} monthly list — a{' '}
        {pct(ANNUAL_DISCOUNT_PCT)} discount. Run the cash-side arithmetic with the{' '}
        <a href="/late-payment-cost-calculator/">late-payment cost engine</a>&apos;s conventions
        (twelve {usd(MONTHLY, 0)} payments at 30-day starts, simple interest): the eleven deferred
        payments — {usd(FACE_ACCELERATED, 0)} in total — arrive on average {AVG_ACCEL_DAYS} days
        early, and at a {COST_OF_CAPITAL}% cost of capital that acceleration is worth only{' '}
        <strong>{usd(DEFERRED_CARRY)} per account-year</strong>. The discount actually surrenders{' '}
        {usd(CASH_SURRENDERED, 0)} of that stream. Annualized, the implied rate depends on the
        basis — and must be stated with it: against the {usd(FACE_ACCELERATED, 0)} accelerated
        face it is <strong>{PREPAY_IMPLIED_RATE.toFixed(1)}%</strong>; against the{' '}
        {usd(FACE_NET_KEPT, 0)} of net cash the vendor keeps beyond the month that was due now
        anyway, <strong>{PREPAY_IMPLIED_RATE_NET.toFixed(1)}%</strong>. The choice of basis moves
        the number; it cannot rescue it — every convention lands at multiples of the{' '}
        {COST_OF_CAPITAL}% cost of capital. The classic 2/10 net-30 trade terms, for comparison,
        price at {CLASSIC_2_10_NET_30.toFixed(1)}% on the engine&apos;s own net-face convention
        (<code>d ÷ (1 − d)</code>, annualized) — a sibling of this arithmetic, not the same
        formula: discounts granted to accelerate cash are expensive credit in both directions.
        Priced at fair value, a {COST_OF_CAPITAL}%-capital vendor should give up roughly{' '}
        <strong>
          {FAIR_CARRY_PCT.toFixed(1)}–{FAIR_ANNUAL_DISCOUNT.toFixed(1)}%
        </strong>{' '}
        for this acceleration by either basis — {FAIR_CARRY_PCT.toFixed(1)}% as the{' '}
        {usd(DEFERRED_CARRY)} carrying value read against the annual list,{' '}
        {FAIR_ANNUAL_DISCOUNT.toFixed(1)}% at the engine&apos;s net-face boundary — about two and a
        half weeks of the year, not two months.
      </p>
      <p>
        <strong>The retention leg.</strong> What justifies the rest of the discount is churn. At{' '}
        {REF_CHURN}% monthly logo churn the engine annualizes to {pct(annualizedChurn(REF_CHURN))}{' '}
        a year — only {pct(SURVIVE_12M * 100)} of a monthly cohort is still paying at month twelve
        — so a monthly book&apos;s expected year-one revenue is{' '}
        <strong>{usd(Y1_MONTHLY_EXPECTED)}</strong> per acquired account, against the{' '}
        {usd(ANNUAL_PRICE, 0)} the prepaid year banks on day one: the annual plan wins by{' '}
        {usd(Y1_EDGE_ANNUAL)} per account before financing. But that edge is churn-dependent.
        Bisect the survival sum for the break-even and it lands at{' '}
        <strong>{CHURN_WHERE_ANNUAL_WINS.toFixed(1)}% monthly churn</strong>: above it, the prepaid
        year collects more than the monthly book can expect to; below it, the product retains so
        well that &ldquo;two months free&rdquo; pays for retention it already had, and the
        discount is pure margin transfer. A 3%-churn product should sell a cheaper annual discount
        than a 6%-churn product — the convention of a flat two months rarely admits this.
      </p>
      <p>
        <strong>The decision.</strong> Keep monthly as the list price — it is the honest churn
        signal and the quoted reference — and price the annual plan as{' '}
        <em>fair financing plus a defensible retention premium</em>, not as a flat two months by
        convention. Two asymmetries discipline the choice: an annual base cannot be repriced for
        twelve months (the raise mechanics of §4 skip it by design — the discount already bought
        that lock), and a prepaid year concentrates refund and credit risk in a single
        counterparty. If cash is not the binding constraint, a shallower annual discount is
        usually the better trade; the <a href="/guides/managing-your-runway/">runway guide</a>{' '}
        covers when it is.
      </p>

      {/* ================================================================== */}
      <h2 id="discount-ladder">The discount ladder: 1 ÷ (1 − d)</h2>
      {/* ================================================================== */}
      <p>
        Every discount is a volume contract: the price falls, and the discount must buy back the
        margin in new accounts. Hold revenue flat and the required volume increase is{' '}
        <code>u = d ÷ (1 − d)</code> — the law of discounts. Hold <em>profit</em> flat, which is
        the condition that actually governs, and delivery cost enters:{' '}
        <code>u = d ÷ (gm − d)</code>. The{' '}
        <a href="/discount-impact-calculator/">discount impact calculator</a> runs both on the
        reference product&apos;s {pct(SAAS_GM)} margin:
      </p>
      <table>
        <thead>
          <tr>
            <th>Discount</th>
            <th>Revenue-neutral uplift</th>
            <th>Profit-neutral at {pct(SAAS_GM, 0)} margin</th>
          </tr>
        </thead>
        <tbody>
          {LADDER.map((row) => (
            <tr key={row.d}>
              <td>{row.d}% off</td>
              <td>+{row.rev.toFixed(1)}%</td>
              <td>+{row.prof.toFixed(1)}%</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p>
        The famous &ldquo;20% off needs +25% volume&rdquo; is the best case, reachable only by a
        costless product. At this product&apos;s margin the true requirement is{' '}
        <strong>+{LADDER[3].prof.toFixed(1)}%</strong> — from {SAAS.currentUnits} accounts to{' '}
        {numFmt(AGG20.breakEvenVolume ?? 0, 1)} — and the engine&apos;s full readout shows the
        damage on the way: price {usd(SAAS.price)} → {usd(AGG20.discountedPrice)}, unit margin{' '}
        {usd(AGG20.baseUnitMargin)} → {usd(AGG20.discountedUnitMargin)}, gross margin {pct(SAAS_GM)}{' '}
        → {pct(AGG20.discountedGrossMarginPct ?? 0)}. A {LADDER[3].d}% concession destroyed{' '}
        {pct(AGG20.unitMarginErosionPct ?? 0)} of each account&apos;s margin. And SaaS gets off
        lightly: the same 20% at the discount calculator&apos;s physical-product preset ({usd(89)}{' '}
        sold, {usd(41)} landed, a {pct(GADGET_GM)} margin) requires{' '}
        <strong>+{GADGET_20OFF.toFixed(0)}%</strong> — the lower the margin, the crueler the same
        discount. That is the Marn–Rosiello price–volume trade-off the engine implements.
      </p>
      <p>
        <strong>Design the ladder; do not grant the asks.</strong> A discount schedule should be
        fenced — attached to an eligibility condition that keeps it away from the reference price —
        or it silently becomes the reference price. Two fences the engines can price:
      </p>
      <ul>
        <li>
          <strong>Commitment length.</strong> The annual and multi-year discount is fenced by time
          — §2 priced exactly what a year of commitment is worth on both the cash and the churn
          leg. A 25%-for-two-years offer re-enters that arithmetic with a longer lock; it is a
          purchase of retention, and should be sized like one.
        </li>
        <li>
          <strong>Capped amounts, not percentages.</strong> A {usd(1000, 0)} credit on commitments
          above {usd(5000, 0)} reads as &ldquo;{pct(COUPON.faceRatePct, 0)} off&rdquo; but decays as
          accounts grow. The coupon engine on a {usd(COUPON_BASKET, 0)} commitment: the
          credit&apos;s effective rate is {pct(COUPON.effectiveRatePct)} — it costs the seller{' '}
          {usd(COUPON_SELLER_COST, 0)} where a blanket 20% would cost{' '}
          {usd(BLANKET_SELLER_COST, 0)}, a {usd(Math.abs(COUPON.savingsDifference), 0)} difference
          — and the crossover sits at {usd(COUPON.crossOverBasket ?? 0, 0)}. A percentage has no
          crossover: it scales with your largest customers, which is precisely the wrong place to
          give margin away.
        </li>
      </ul>
      <p>
        Nonprofit, education, and startup programs are the same idea — fences that segment without
        repricing everyone. The rule underneath all of them: an unfenced standing discount is not
        a discount; it is a price cut with worse analytics.
      </p>

      {/* ================================================================== */}
      <h2 id="raising">Raising prices: mechanics that hold the base</h2>
      {/* ================================================================== */}
      <p>
        The raise decision has the same shape as the discount decision solved the other way, and
        at SaaS margins it is dramatically forgiving. The break-even engine&apos;s tolerance
        function answers &ldquo;how many accounts can walk before the raise stops paying?&rdquo;
        — on the reference product: a 10% rise tolerates <strong>{TOL_10.toFixed(1)}%</strong> of
        the base leaving, a 20% rise tolerates <strong>{TOL_20.toFixed(1)}%</strong>, a 30% rise{' '}
        <strong>{TOL_30.toFixed(1)}%</strong>. At this {pct(SAAS_GM, 0)} margin nearly every price
        dollar lands on contribution, so the tolerance almost equals the rise itself; the same 10%
        rise at the physical preset&apos;s {pct(GADGET_GM, 0)} margin tolerates{' '}
        {GADGET_TOL_10.toFixed(1)}%. Downside risk compounds; upside risk
        discounts. The asymmetry is the argument for erring high.
      </p>
      <p>The mechanics, in the order they should be deployed:</p>
      <ol>
        <li>
          <strong>New customers pay the new price immediately.</strong> No anchor exists for them,
          churn exposure is zero, and the market — not your history — prices the product. This is
          the one raise you can execute the day you decide on it.
        </li>
        <li>
          <strong>Re-package before you re-price.</strong> Changing tiers, limits, or the value
          metric resets the comparison basis honestly: the old plan and the new plan are different
          products, not the same product costing more. Seat- and usage-based tiers let price rise
          with delivered value without a raise notice at all.
        </li>
        <li>
          <strong>Grandfather with a sunset.</strong> Permanent grandfathering is generous to a
          fault: at a modest 8%/yr list cadence, three years separate a grandfathered{' '}
          {usd(MONTHLY, 0)} account from a {usd(GF_LIST_IN_3Y)} new customer — a {pct(GF_SPREAD)}{' '}
          spread for identical service, which eventually reads as an injustice to newer customers
          and a discount you never priced. Sunset the legacy price (12–24 months) or migrate it
          with a credit toward the current plan.
        </li>
        <li>
          <strong>Annual plans reprice at renewal, by construction.</strong> The annual discount of
          §2 already paid for a twelve-month lock — do not stack grandfathering on top of it. The
          new list applies at renewal, with notice; the customer got the lock, and you got the
          cash.
        </li>
        <li>
          <strong>Notice, plus a downgrade path.</strong> Sixty days and a smaller tier turn a
          cancellation into a downgrade. A retained account at a lower price still contributes
          positively — every dollar of that price above the {usd(SAAS.unitVariableCost, 0)} service
          cost lands against the fixed base — while a lost one takes its whole LTV with it; §5
          puts a number on that difference.
        </li>
      </ol>
      <p>
        Cadence beats courage: a small annual raise on new customers compounds quietly and never
        makes news, while a decade of restraint followed by +40% makes churn. A raise sticks when
        the ceiling has demonstrably moved and fails when the market anchors you below it — raise
        because the value case moved, and say so in the notice.
      </p>

      {/* ================================================================== */}
      <h2 id="ltv-cac-loop">Closing the loop with LTV:CAC</h2>
      {/* ================================================================== */}
      <p>
        Every decision above eventually lands in one ratio. The{' '}
        <a href="/ltv-cac-calculator/">LTV:CAC calculator</a> computes customer lifetime value on
        the gross-margin basis — ARPU × margin ÷ churn, the geometric survival sum — and judges it
        against a health band the industry states as <strong>{RATIO_HEALTHY}:1</strong> with CAC
        paid back inside <strong>{PAYBACK_HEALTHY_MONTHS} months</strong>. Those are practitioner
        rules of thumb, not laws, but they are the band the engine enforces, and pricing decisions
        should be checked against them before shipping. Two of the calculator&apos;s own presets
        frame the two ways pricing fails:
      </p>
      <table>
        <thead>
          <tr>
            <th>Line</th>
            <th>Reference case (self-serve)</th>
            <th>Mid-market (sales-led)</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Inputs</td>
            <td>
              {usd(REF.arpu, 0)} ARPU, {REF.grossMarginPct}% margin, {REF.churnPct}%/mo churn;{' '}
              {usd(REF.smSpend, 0)} S&amp;M buying {REF.newCustomers}/mo
            </td>
            <td>
              {usd(MM.arpu, 0)}/mo seats, {MM.grossMarginPct}% margin, {MM.churnPct}%/mo churn;{' '}
              {usd(MM.smSpend, 0)} S&amp;M buying {MM.newCustomers} accounts
            </td>
          </tr>
          <tr>
            <td>Lifetime ÷ LTV</td>
            <td>
              {(MMR.lifetimeMonths ?? 0).toFixed(0)} months ÷{' '}
              <strong>{usd(MMR.ltv ?? 0, 0)}</strong>
            </td>
            <td>
              {(MM_R.lifetimeMonths ?? 0).toFixed(0)} months ÷{' '}
              <strong>{usd(MM_R.ltv ?? 0, 0)}</strong>
            </td>
          </tr>
          <tr>
            <td>CAC</td>
            <td>{usd(MMR.cac ?? 0, 0)}</td>
            <td>{usd(MM_R.cac ?? 0, 0)}</td>
          </tr>
          <tr>
            <td>LTV:CAC</td>
            <td>
              <strong>{(MMR.ratio ?? 0).toFixed(1)}</strong> — clears {RATIO_HEALTHY}:1 with room
            </td>
            <td>
              <strong>{(MM_R.ratio ?? 0).toFixed(1)}</strong> — clears it barely
            </td>
          </tr>
          <tr>
            <td>CAC payback (simple ÷ churn-adjusted)</td>
            <td>
              {(MMR.paybackMonths ?? 0).toFixed(1)} ÷ {(MMR.paybackChurnAdjusted ?? 0).toFixed(1)}{' '}
              months — passes
            </td>
            <td>
              <strong>
                {(MM_R.paybackMonths ?? 0).toFixed(1)} ÷{' '}
                {(MM_R.paybackChurnAdjusted ?? 0).toFixed(1)} months
              </strong>{' '}
              — fails {PAYBACK_HEALTHY_MONTHS}
            </td>
          </tr>
        </tbody>
      </table>
      <p>
        The reference case is healthy everywhere: LTV {usd(MMR.ltv ?? 0, 0)} against a{' '}
        {usd(MMR.cac ?? 0, 0)} CAC, payback in {(MMR.paybackMonths ?? 0).toFixed(1)} months, and
        pricing headroom to burn — the engine&apos;s inverted queries say the ratio only breaches{' '}
        {RATIO_HEALTHY}:1 above <strong>{CHURN_AT_3.toFixed(1)}% monthly churn</strong>, and the
        {PAYBACK_HEALTHY_MONTHS}-month payback floor only binds at{' '}
        <strong>{CHURN_AT_12MO_PAYBACK.toFixed(1)}% monthly churn</strong>, by which point the
        ratio has already collapsed to roughly 1:1. For cheap self-serve CAC the ratio test always
        binds first; churn is not this product&apos;s pricing problem.
      </p>
      <p>
        The mid-market preset is the instructive failure: it <em>passes</em> the ratio (
        {(MM_R.ratio ?? 0).toFixed(1)}) and <em>fails</em> payback (
        {(MM_R.paybackMonths ?? 0).toFixed(1)} months simple,{' '}
        {(MM_R.paybackChurnAdjusted ?? 0).toFixed(1)} churn-adjusted — the adjusted figure prices
        in the accounts that leave before repaying). The engine&apos;s diagnosis tools separate the
        levers cleanly. The ratio holds only while churn stays below{' '}
        <strong>{MM_CHURN_AT_3.toFixed(2)}%/month</strong> — actual churn sits at {MM.churnPct}%,
        less than a tenth of a point inside the boundary — so retention is barely holding the line. But ask the payback question and the engine returns{' '}
        <code>{MM_PAYBACK_FIXABLE === null ? 'null' : 'a crossing'}</code>:{' '}
        <strong>no churn rate fixes it</strong>, because the simple payback —{' '}
        {usd(MM_R.cac ?? 0, 0)} ÷ {usd(MM_R.monthlyGrossProfit ?? 0, 0)} of monthly gross profit —
        is already past {PAYBACK_HEALTHY_MONTHS} months before churn worsens it. Only price,
        margin, or CAC move it: a {PAYBACK_HEALTHY_MONTHS}-month simple payback at this CAC and
        margin needs <strong>{usd(MM_ARPU_FOR_PAYBACK, 0)}/mo</strong> —{' '}
        {MM_ARPU_MULTIPLE.toFixed(2)}× the current price — or CAC held under{' '}
        {usd(MM_CAC_FOR_PAYBACK, 0)}. That is the closed loop talking back: a sales motion that
        costs {usd(MM_R.cac ?? 0, 0)} per account cannot be priced at {usd(MM.arpu, 0)}; pricing
        is downstream of acquisition economics, and the payback test is where that dependency
        surfaces.
      </p>
      <p>The band reads as a decision table — which lever the engine says binds:</p>
      <dl className="mt-2 space-y-5 rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 dark:border-white/[0.08] dark:bg-slate-900/60">
        <div>
          <dt className="font-semibold text-slate-900 dark:text-slate-100">
            Ratio under {RATIO_HEALTHY}:1 — value leak
          </dt>
          <dd className="mt-0.5 leading-relaxed text-slate-600 dark:text-slate-300">
            Compare actual churn to the churn-at-{RATIO_HEALTHY}:1 boundary the engine computes
            from your gross profit and CAC. Actual churn far above the boundary: retention is the
            binding lever — closing that gap restores the ratio. Actual churn near the boundary:
            the ratio fails on price or CAC, and §1&apos;s floor and §3&apos;s ladder are the
            instruments.
          </dd>
        </div>
        <div>
          <dt className="font-semibold text-slate-900 dark:text-slate-100">
            Ratio above {RATIO_HEALTHY}:1, payback past {PAYBACK_HEALTHY_MONTHS} months —
            cash-starved growth
          </dt>
          <dd className="mt-0.5 leading-relaxed text-slate-600 dark:text-slate-300">
            The engine&apos;s payback inversion returns null: churn cannot rescue it. Raise price,
            raise margin, or cut CAC — and if none will move, the acquisition motion itself is
            mispriced, as in the mid-market preset above.
          </dd>
        </div>
        <div>
          <dt className="font-semibold text-slate-900 dark:text-slate-100">
            Both inside the band — pricing headroom
          </dt>
          <dd className="mt-0.5 leading-relaxed text-slate-600 dark:text-slate-300">
            This is the license for §4: test the raise on new customers, where the tolerance
            arithmetic puts the downside at a fraction of the upside. A comfortable band is not a
            reason to stop pricing; it is the evidence that price sits below the ceiling.
          </dd>
        </div>
      </dl>
      <p>
        Finally, the loop prices the guide&apos;s own decisions against each other. Price flows
        one-to-one into LTV: discount the whole reference book 20% and the engine recomputes the
        ratio from {(MMR.ratio ?? 0).toFixed(1)} to{' '}
        <strong>{(REF_AFTER_20_OFF.ratio ?? 0).toFixed(1)}</strong> — every point of discount
        leaves the ratio at full face value. An annual discount converts LTV timing into cash — §2
        said what that conversion should cost. A raise is the only lever that moves the ratio
        without spending anything. When the band is missed, the engine says which lever binds;
        when it is cleared, it says how much room the ceiling has. That round-trip — price, verify
        against the band, price again — is the pricing process.
      </p>

      {/* ================================================================== */}
      <h2 id="boundaries">Where the framework ends — and the checklist</h2>
      {/* ================================================================== */}
      <p>
        Four boundaries keep this framework honest. The LTV:CAC model assumes constant churn and
        ARPU per customer — no expansion revenue, no cohort drift, NRR at 100% by construction —
        and it prices <em>logo</em> churn; a product with strong expansion revenue can carry worse
        logo churn than the band suggests. The health thresholds ({RATIO_HEALTHY}:1,{' '}
        {PAYBACK_HEALTHY_MONTHS} months) are industry rules of thumb, widely used and enforced
        here as such — not laws of finance. The annual-prepay rate uses simple interest and
        30-day months — the late-payment engine&apos;s conventions, with an average{' '}
        {AVG_ACCEL_DAYS}-day acceleration; a treasury-grade answer compounds. Its implied-rate and
        fair-discount figures are stated with their bases (accelerated face, net cash kept, or the{' '}
        <code>d ÷ (1 − d)</code> convention) because the three are not interchangeable. And
        nothing here is
        tax advice or covers the VAT/sales-tax treatment of prepaid subscriptions, which varies by
        jurisdiction.
      </p>
      <p>The decision sequence, compressed:</p>
      <ol>
        <li>
          Compute the floor: variable cost is the hard <em>price</em> floor, break-even the soft{' '}
          <em>volume</em> floor — the preset puts the reference product at{' '}
          {numFmt(CVP.breakEvenUnits ?? 0, 1)} accounts or {usd(CVP.breakEvenRevenue ?? 0, 0)}/mo.
          A period with price above variable cost but volume below break-even is a deliberate
          subsidy of the fixed base; write down how long it runs.
        </li>
        <li>
          Argue the ceiling on a value metric that grows with the customer; price on that metric
          where one exists.
        </li>
        <li>
          Check the anchor once: sitting wildly outside the competitive range means one of your
          three layers is wrong. Never derive the price from it.
        </li>
        <li>
          Price the annual plan as financing plus retention: at a {COST_OF_CAPITAL}% cost of
          capital the fair acceleration discount is {FAIR_ANNUAL_DISCOUNT.toFixed(1)}%; everything
          beyond that is a retention purchase, and the{' '}
          {CHURN_WHERE_ANNUAL_WINS.toFixed(1)}%-churn boundary says whether retention needs buying.
        </li>
        <li>
          Price every discount at u = d ÷ (gm − d): 20% off needs +{LADDER[3].prof.toFixed(1)}%
          accounts at this margin. Fence it — commitment length or a capped amount — or it becomes
          the reference price.
        </li>
        <li>
          Raise in order: new customers now, re-package next, grandfather with a sunset, annual
          plans at renewal. A 10% rise tolerates {TOL_10.toFixed(1)}% attrition before profit
          moves.
        </li>
        <li>
          Verify against the band every cycle: LTV:CAC ≥ {RATIO_HEALTHY}:1, payback ≤{' '}
          {PAYBACK_HEALTHY_MONTHS} months. Let the engine&apos;s inversions name the binding lever
          — churn, price, or CAC — before you spend on any of them.
        </li>
      </ol>
      <p>
        The instruments below run each step on your numbers. The framework is the order; the
        arithmetic is theirs.
      </p>
    </>
  );
}

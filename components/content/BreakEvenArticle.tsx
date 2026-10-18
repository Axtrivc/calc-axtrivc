import Faq from '@/components/Faq';
import { ArticleToc, RelatedCalculators } from '@/components/Article';
import {
  BREAKEVEN_PRESETS,
  breakEvenRevenue,
  breakEvenUnits,
  computeBreakEven,
  contributionMargin,
  priceRiseTolerance,
  profitAt,
  sensitivityGrid,
} from '@/lib/breakeven';
import { numFmt, pct, usd } from '@/lib/format';

/* Every number in this guide is computed at build time by the same functions
   the widget runs — nothing is hand-typed. */
const [saas, product] = BREAKEVEN_PRESETS.map((p) => ({
  preset: p,
  r: computeBreakEven(p.inputs),
}));

const tol = (i: number) => priceRiseTolerance(BREAKEVEN_PRESETS[i].inputs.price, BREAKEVEN_PRESETS[i].inputs.unitVariableCost, 10) ?? 0;

/* Volume growth needed to stand still after a 10% price cut: (1+g)·CM′ = CM. */
function cutStandstillGrowth(i: number): number {
  const { price, unitVariableCost } = BREAKEVEN_PRESETS[i].inputs;
  const cm = contributionMargin(price, unitVariableCost);
  const cmAfterCut = contributionMargin(price * 0.9, unitVariableCost);
  if (cm <= 0 || cmAfterCut <= 0) return 0;
  return (cm / cmAfterCut - 1) * 100;
}

/* Multi-product example: 60/40 mix of the SaaS and product presets. */
const MIX = { saasShare: 0.6, productShare: 0.4 };
const blendedCm =
  MIX.saasShare * contributionMargin(BREAKEVEN_PRESETS[0].inputs.price, BREAKEVEN_PRESETS[0].inputs.unitVariableCost) +
  MIX.productShare * contributionMargin(BREAKEVEN_PRESETS[1].inputs.price, BREAKEVEN_PRESETS[1].inputs.unitVariableCost);
const blendedFixed =
  BREAKEVEN_PRESETS[0].inputs.fixedCosts + BREAKEVEN_PRESETS[1].inputs.fixedCosts;
const blendedBe = blendedFixed / blendedCm;

/* ---- Worked example: the unit that loses money on every sale. All figures
   come off the same engine; the rescue price is found by bisection on the
   engine's own breakEvenUnits, never typed by hand. ---- */
const RESCUE_INPUTS = { fixedCosts: 4000, price: 18, unitVariableCost: 21, currentUnits: 350 };
const rescueRun = computeBreakEven(RESCUE_INPUTS);
/* Price at which break-even lands exactly on the target volume: bisection on
   breakEvenUnits until the price bracket is under 1e-6. */
function priceForBreakEvenUnits(fixedCosts: number, vc: number, target: number): number {
  let lo = vc + 1e-9;
  let hi = vc + fixedCosts / target + 1; // Q*(hi) < target by construction
  while (hi - lo > 1e-6) {
    const mid = (lo + hi) / 2;
    const q = breakEvenUnits(fixedCosts, mid, vc);
    if (q !== null && q > target) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}
const RESCUE_PRICE =
  Math.round(priceForBreakEvenUnits(RESCUE_INPUTS.fixedCosts, RESCUE_INPUTS.unitVariableCost, 500) * 100) / 100;
const rescueAtPrice = computeBreakEven({ ...RESCUE_INPUTS, price: RESCUE_PRICE });

/* ---- Worked example: the re-engineering step. The product preset run twice,
   before and after a deal that moves both cost lines at once. ---- */
const STEP_BASE_INPUTS = BREAKEVEN_PRESETS[1].inputs;
const stepBase = computeBreakEven(STEP_BASE_INPUTS);
const STEP_DEAL_INPUTS = { fixedCosts: 8000, price: 89, unitVariableCost: 36, currentUnits: 300 };
const stepDeal = computeBreakEven(STEP_DEAL_INPUTS);
/* Indifference volume: first whole unit where the deal's profit matches the
   base's — a unit-step scan of the engine's profitAt. */
const stepCrossover = (() => {
  for (let q = 1; q <= 100000; q++) {
    if (
      profitAt(q, STEP_DEAL_INPUTS.fixedCosts, STEP_DEAL_INPUTS.price, STEP_DEAL_INPUTS.unitVariableCost) >=
      profitAt(q, STEP_BASE_INPUTS.fixedCosts, STEP_BASE_INPUTS.price, STEP_BASE_INPUTS.unitVariableCost)
    )
      return q;
  }
  return null;
})();
const stepGapAt400 =
  profitAt(400, STEP_DEAL_INPUTS.fixedCosts, STEP_DEAL_INPUTS.price, STEP_DEAL_INPUTS.unitVariableCost) -
  profitAt(400, STEP_BASE_INPUTS.fixedCosts, STEP_BASE_INPUTS.price, STEP_BASE_INPUTS.unitVariableCost);

/* ---- Decision-boundary scans. Every critical value quoted in the
   "Decision boundaries" section is produced here against the engine:
   - the price-cut table re-solves (1+g)·CM′ = CM via contributionMargin,
     price normalized to $100 per row;
   - the rise-tolerance balance point is a 0.5pp grid scan of
     priceRiseTolerance (the 1e-9 epsilon absorbs the float artifact at
     m = 90, where 100 × 1.1 lands on 110.00000000000001);
   - the mix boundary bisects the low-margin share until the blended
     break-even (fixed ÷ blended CM, both legs engine-computed) rises 10%
     over the 60/40 base. ---- */
const CUT_ROWS = [50, 60, 70, 80, 85, 90].map((m) => {
  const cm = contributionMargin(100, 100 - m);
  const cmAfterCut = contributionMargin(90, 100 - m);
  return { m, g: cm > 0 && cmAfterCut > 0 ? (cm / cmAfterCut - 1) * 100 : null };
});
const CUT_FLOOR_CM = contributionMargin(90, 90);
let balanceM: number | null = null;
for (let m = 0.5; m <= 100.0001; m += 0.5) {
  const t = priceRiseTolerance(100, 100 - m, 10);
  if (t !== null && t <= 10 + 1e-9) {
    balanceM = m;
    break;
  }
}
const cmA = contributionMargin(BREAKEVEN_PRESETS[0].inputs.price, BREAKEVEN_PRESETS[0].inputs.unitVariableCost);
const cmB = contributionMargin(BREAKEVEN_PRESETS[1].inputs.price, BREAKEVEN_PRESETS[1].inputs.unitVariableCost);
const mixBeAt = (s: number) => blendedFixed / ((1 - s) * cmA + s * cmB);
const mixBaseBe = mixBeAt(MIX.productShare);
const mixDriftShare = (() => {
  let lo = MIX.productShare;
  let hi = 0.95;
  while (hi - lo > 1e-6) {
    const mid = (lo + hi) / 2;
    if (mixBeAt(mid) < 1.1 * mixBaseBe) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
})();
/* MoS ↔ leverage identity anchor: at a 25.0% margin of safety, DOL is exactly 4×. */
const EQ = computeBreakEven({ fixedCosts: 10000, price: 100, unitVariableCost: 60, currentUnits: 1000 / 3 });

/* ---- FAQ support scenarios (each answer quotes these engine outputs). ---- */
const zeroFixed = computeBreakEven({ fixedCosts: 0, price: 79, unitVariableCost: 8, currentUnits: 400 });
const zeroMargin = computeBreakEven({ fixedCosts: 12000, price: 50, unitVariableCost: 50, currentUnits: 400 });
const STRIPE_FEE = 89 * 0.029 + 0.3;
const withFees = computeBreakEven({ ...BREAKEVEN_PRESETS[1].inputs, unitVariableCost: 41 + STRIPE_FEE });
const TARGET_PROFIT = 5000;
const tpRun = computeBreakEven({
  ...BREAKEVEN_PRESETS[0].inputs,
  fixedCosts: BREAKEVEN_PRESETS[0].inputs.fixedCosts + TARGET_PROFIT,
});
const thinBeRev = breakEvenRevenue(12000, 100, 85);
const vcDrift = computeBreakEven({ ...BREAKEVEN_PRESETS[0].inputs, unitVariableCost: 9 });
const annualBe = breakEvenUnits(BREAKEVEN_PRESETS[0].inputs.fixedCosts * 12, 79, 8);
const mktBe = breakEvenUnits(BREAKEVEN_PRESETS[0].inputs.fixedCosts + 2000, 79, 8);
const fixedStepBe = breakEvenUnits(BREAKEVEN_PRESETS[1].inputs.fixedCosts + 1500, 89, 41);
const sensProduct = sensitivityGrid(BREAKEVEN_PRESETS[1].inputs);

export default function BreakEvenArticle() {
  const toc = [
    { id: 'model', label: 'What CVP actually models' },
    { id: 'chart', label: 'Reading the chart' },
    { id: 'worked', label: 'Worked examples' },
    { id: 'raise-vs-cut', label: 'Raise price or cut cost?' },
    { id: 'leverage', label: 'Operating leverage' },
    { id: 'multi-product', label: 'Multi-product break-even' },
    { id: 'limits', label: 'Where the model lies' },
    { id: 'boundaries', label: 'Decision boundaries' },
    { id: 'glossary', label: 'Glossary' },
    { id: 'faq', label: 'FAQ' },
  ];

  return (
    <article className="prose-article">
      <ArticleToc items={toc} />

      <h2 id="model">What CVP actually models</h2>
      <p>
        Cost-volume-profit analysis rests on one idea: split every cost into two families by how it
        responds to volume. <strong>Variable costs</strong> (COGS, freight, payment fees, per-seat
        hosting, delivery labor) buy the act of selling — no sale, no cost. <strong>Fixed
        costs</strong> (rent, salaries, insurance, software, minimum contracts) arrive with the
        calendar whether you sell one unit or ten thousand. Between them sits the{' '}
        <strong>contribution margin</strong> — price minus variable cost — which is what each sale
        actually contributes toward the fixed pile.
      </p>
      <p>
        Break-even is then pure arithmetic: the volume at which the contributions have exactly
        filled the fixed-cost hole. At the SaaS preset numbers in the tool — a {usd(BREAKEVEN_PRESETS[0].inputs.price)}{' '}
        plan costing {usd(BREAKEVEN_PRESETS[0].inputs.unitVariableCost)} per account to serve — each account
        contributes{' '}
        <strong>{usd(saas.r.contributionMargin)}</strong> against{' '}
        {usd(BREAKEVEN_PRESETS[0].inputs.fixedCosts, 0)} of monthly fixed costs, so the business
        needs <strong>{numFmt(saas.r.breakEvenUnits ?? 0, 1)} accounts</strong> to fill the hole.
        Every account after that is {usd(saas.r.contributionMargin)} of operating profit.
      </p>
      <p>
        Three conventions make the arithmetic honest: everything is stated for the{' '}
        <em>same period</em> (the tool defaults to monthly and carries a monthly/yearly switch —
        pick your period, enter figures for it, and every label follows; the ratios never care); price is
        constant across the scanned range (no volume discounts); and fixed means fixed across the
        relevant range (a warehouse you rent when you pass 1,000 units is a step cost, not a fixed
        one). No year-specific tax or inflation parameter enters this algebra — CVP is
        time-invariant, which is exactly why it has survived seventy years of managerial
        accounting.
      </p>

      <h2 id="chart">Reading the chart</h2>
      <p>
        The CVP chart above draws two lines. Revenue starts at the origin and rises with slope
        equal to price. Total cost starts at the fixed-cost intercept — you owe that before the
        first sale — and rises with slope equal to variable cost. Because the revenue line is
        steeper (whenever price exceeds variable cost), the two must cross: that crossing is the
        break-even point, and the two wedges it creates are the whole story of the business.
      </p>
      <ul>
        <li>
          The <strong>red wedge</strong> is cumulative operating loss: its height at any volume is
          the gap between what you have spent and what you have earned. Its widest section is at
          zero volume, where it equals the entire fixed-cost base.
        </li>
        <li>
          The <strong>green wedge</strong> is cumulative operating profit, growing at the
          contribution margin per unit — {usd(saas.r.contributionMargin)} per account at the preset
          numbers.
        </li>
        <li>
          The vertical dashed line marks your current volume. Right of the crossing you are
          harvesting the green wedge; left of it you are still climbing out of the red one.
        </li>
      </ul>
      <p>
        One derived number deserves a seat at every pricing conversation:{' '}
        <strong>break-even revenue</strong> — {usd(saas.r.breakEvenRevenue ?? 0, 0)} at the preset
        numbers. It equals fixed costs divided by the contribution-margin ratio
        ({pct(saas.r.cmRatioPct ?? 0, 1)} here): in plain words,{' '}
        {pct(saas.r.cmRatioPct ?? 0, 1)} of every revenue dollar survives variable costs, so
        breaking even takes fixed costs ÷ that fraction, in revenue. This is why two businesses
        with identical fixed costs can have wildly different break-even revenue — the one with the
        thinner margin ratio must push far more dollars through the machine.
      </p>

      <h2 id="worked">Worked examples</h2>
      <h3>A {usd(BREAKEVEN_PRESETS[0].inputs.price, 0)} SaaS, end to end</h3>
      <p>
        The full readout at the tool&rsquo;s default scenario — {usd(BREAKEVEN_PRESETS[0].inputs.price)}/mo
        accounts, {usd(BREAKEVEN_PRESETS[0].inputs.unitVariableCost)} variable cost per account,{' '}
        {usd(BREAKEVEN_PRESETS[0].inputs.fixedCosts, 0)} fixed costs, {numFmt(BREAKEVEN_PRESETS[0].inputs.currentUnits, 0)}{' '}
        accounts on the book today:
      </p>
      <table>
        <thead>
          <tr>
            <th>Line</th>
            <th>Value</th>
            <th>Derived from</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Contribution margin / account</td>
            <td>{usd(saas.r.contributionMargin)}</td>
            <td>{usd(BREAKEVEN_PRESETS[0].inputs.price)} − {usd(BREAKEVEN_PRESETS[0].inputs.unitVariableCost)}</td>
          </tr>
          <tr>
            <td>Contribution-margin ratio</td>
            <td>{pct(saas.r.cmRatioPct ?? 0, 1)}</td>
            <td>{usd(saas.r.contributionMargin)} ÷ {usd(BREAKEVEN_PRESETS[0].inputs.price)}</td>
          </tr>
          <tr>
            <td>Break-even volume</td>
            <td>{numFmt(saas.r.breakEvenUnits ?? 0, 1)} accounts</td>
            <td>{usd(BREAKEVEN_PRESETS[0].inputs.fixedCosts, 0)} ÷ {usd(saas.r.contributionMargin)}</td>
          </tr>
          <tr>
            <td>Break-even revenue</td>
            <td>{usd(saas.r.breakEvenRevenue ?? 0, 0)}/mo</td>
            <td>{numFmt(saas.r.breakEvenUnits ?? 0, 1)} × {usd(BREAKEVEN_PRESETS[0].inputs.price)}</td>
          </tr>
          <tr>
            <td>Profit at {numFmt(BREAKEVEN_PRESETS[0].inputs.currentUnits, 0)} accounts</td>
            <td>{usd(saas.r.profitAtCurrent, 0)}/mo</td>
            <td>{numFmt(BREAKEVEN_PRESETS[0].inputs.currentUnits, 0)} × {usd(saas.r.contributionMargin)} − {usd(BREAKEVEN_PRESETS[0].inputs.fixedCosts, 0)}</td>
          </tr>
          <tr>
            <td>Margin of safety</td>
            <td>{pct(saas.r.marginOfSafetyPct ?? 0, 1)}</td>
            <td>({numFmt(BREAKEVEN_PRESETS[0].inputs.currentUnits, 0)} − {numFmt(saas.r.breakEvenUnits ?? 0, 1)}) ÷ {numFmt(BREAKEVEN_PRESETS[0].inputs.currentUnits, 0)}</td>
          </tr>
          <tr>
            <td>Operating leverage</td>
            <td>{numFmt(saas.r.operatingLeverage ?? 0, 2)}×</td>
            <td>({numFmt(BREAKEVEN_PRESETS[0].inputs.currentUnits, 0)} × {usd(saas.r.contributionMargin)}) ÷ {usd(saas.r.profitAtCurrent, 0)}</td>
          </tr>
        </tbody>
      </table>
      <p>
        Read the last two rows together: a {pct(saas.r.marginOfSafetyPct ?? 0, 1)} margin of safety
        means accounts could fall by {pct(saas.r.marginOfSafetyPct ?? 0, 0)} — churn a full {numFmt((saas.r.marginOfSafetyPct ?? 0) / 100 * BREAKEVEN_PRESETS[0].inputs.currentUnits, 0)}{' '}
        accounts — before profit hits zero. And because operating leverage is exactly the inverse
        of margin of safety ({numFmt(saas.r.operatingLeverage ?? 0, 2)} ≈ 1 ÷ {pct(saas.r.marginOfSafetyPct ?? 0, 1)}),
        each 1% of volume lost cuts profit by {numFmt(saas.r.operatingLeverage ?? 0, 2)}%. The
        closer you operate to break-even, the more violent profit&rsquo;s swings.
      </p>

      <h3 id="example-rescue">Worked example: the unit that loses money on every sale</h3>
      <p>
        Not every scenario has a break-even to find — and the way the tool says so is itself the
        answer. A maker sells an {usd(RESCUE_INPUTS.price)} accessory that costs{' '}
        {usd(RESCUE_INPUTS.unitVariableCost)} per unit in materials and fulfillment to deliver,
        against {usd(RESCUE_INPUTS.fixedCosts, 0)}/mo of workshop, tooling and insurance, at{' '}
        {numFmt(RESCUE_INPUTS.currentUnits, 0)} units/mo.
      </p>
      <p>
        <strong>Step 1 — the verdict.</strong> Contribution margin is{' '}
        {usd(RESCUE_INPUTS.price)} − {usd(RESCUE_INPUTS.unitVariableCost)} ={' '}
        <strong>{usd(rescueRun.contributionMargin)}</strong>: every unit sold deepens the loss by
        three dollars <em>before</em> fixed costs. The engine returns no break-even volume at all
        and flags the scenario <code>impossible</code>; at today&rsquo;s{' '}
        {numFmt(RESCUE_INPUTS.currentUnits, 0)} units the line loses{' '}
        <strong>{usd(Math.abs(rescueRun.profitAtCurrent), 0)}/mo</strong>. &ldquo;Making it up in volume&rdquo;
        has no mathematical meaning here — the tolerance machinery agrees, returning{' '}
        <code>null</code> rather than a number for a 10% price rise.
      </p>
      <p>
        <strong>Step 2 — the rescue price.</strong> Management believes {numFmt(500, 0)} units/mo
        is reachable within a year. What price puts break-even exactly on that target? Bisecting
        the engine&rsquo;s own <code>breakEvenUnits</code> until the price bracket closes under a
        thousandth of a dollar returns <strong>{usd(RESCUE_PRICE, 2)}</strong> — a{' '}
        {pct((RESCUE_PRICE / RESCUE_INPUTS.price - 1) * 100, 1)} increase. The engine confirms the
        landing: {usd(RESCUE_INPUTS.fixedCosts, 0)} ÷ ({usd(RESCUE_PRICE, 2)} −{' '}
        {usd(RESCUE_INPUTS.unitVariableCost)}) = {usd(rescueAtPrice.contributionMargin)} of margin,
        break-even at <strong>{numFmt(rescueAtPrice.breakEvenUnits ?? 0, 0)} units</strong> (
        {usd(rescueAtPrice.breakEvenRevenue ?? 0, 0)}/mo of revenue).
      </p>
      <p>
        <strong>Step 3 — what still remains.</strong> At today&rsquo;s{' '}
        {numFmt(RESCUE_INPUTS.currentUnits, 0)} units the repriced line still loses{' '}
        {usd(Math.abs(rescueAtPrice.profitAtCurrent), 0)}/mo and sits{' '}
        {numFmt(Math.abs(rescueAtPrice.marginOfSafetyUnits ?? 0), 0)} units (
        {pct(Math.abs(rescueAtPrice.marginOfSafetyPct ?? 0), 1)}) below break-even. The conclusion
        has two halves: volume is not a lever until price clears variable cost — and once it does,
        whether demand reaches {numFmt(rescueAtPrice.breakEvenUnits ?? 0, 0)} units at{' '}
        {usd(RESCUE_PRICE, 2)} is a market question the arithmetic can size but never answer.
      </p>

      <h3 id="example-step">Worked example: the re-engineering step</h3>
      <p>
        A cost change that moves both lines at once. The product preset — a {usd(89)} gadget,{' '}
        {usd(41)} landed COGS, {usd(6500, 0)}/mo operating base, {numFmt(300, 0)} units/mo — is
        offered a contract-manufacturing deal: landed COGS drops {usd(5)} to {usd(36)} per unit,
        but a {usd(1500, 0)}/mo minimum-order commitment becomes a new fixed cost. Both structures,
        run through the engine:
      </p>
      <table>
        <thead>
          <tr>
            <th>Line</th>
            <th>Current structure</th>
            <th>With the deal</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Contribution margin / unit</td>
            <td>{usd(stepBase.contributionMargin)}</td>
            <td>{usd(stepDeal.contributionMargin)}</td>
          </tr>
          <tr>
            <td>Fixed costs</td>
            <td>{usd(STEP_BASE_INPUTS.fixedCosts, 0)}/mo</td>
            <td>{usd(STEP_DEAL_INPUTS.fixedCosts, 0)}/mo</td>
          </tr>
          <tr>
            <td>Break-even volume</td>
            <td>{numFmt(stepBase.breakEvenUnits ?? 0, 1)} units</td>
            <td>{numFmt(stepDeal.breakEvenUnits ?? 0, 1)} units</td>
          </tr>
          <tr>
            <td>Profit at {numFmt(STEP_BASE_INPUTS.currentUnits, 0)} units</td>
            <td>{usd(stepBase.profitAtCurrent, 0)}/mo</td>
            <td>{usd(stepDeal.profitAtCurrent, 0)}/mo</td>
          </tr>
          <tr>
            <td>Margin of safety</td>
            <td>{pct(stepBase.marginOfSafetyPct ?? 0, 1)}</td>
            <td>{pct(stepDeal.marginOfSafetyPct ?? 0, 1)}</td>
          </tr>
        </tbody>
      </table>
      <p>
        <strong>Step 1 — every headline metric says reject.</strong> Break-even rises from{' '}
        {numFmt(stepBase.breakEvenUnits ?? 0, 1)} to {numFmt(stepDeal.breakEvenUnits ?? 0, 1)} units
        (+{numFmt((stepDeal.breakEvenUnits ?? 0) - (stepBase.breakEvenUnits ?? 0), 1)} units,{' '}
        {pct(((stepDeal.breakEvenUnits ?? 0) / (stepBase.breakEvenUnits ?? 1) - 1) * 100, 1)}), and
        the margin of safety thins from {pct(stepBase.marginOfSafetyPct ?? 0, 1)} to{' '}
        {pct(stepDeal.marginOfSafetyPct ?? 0, 1)}.
      </p>
      <p>
        <strong>Step 2 — the profit lines cross exactly here.</strong> At the current{' '}
        {numFmt(STEP_BASE_INPUTS.currentUnits, 0)} units both structures earn{' '}
        {usd(stepBase.profitAtCurrent, 0)}/mo — identical. A unit-step scan of the engine&rsquo;s{' '}
        <code>profitAt</code> finds the crossover at <strong>unit #{numFmt(stepCrossover ?? 0, 0)}</strong>,
        which is no coincidence: the indifference volume is always Δfixed ÷ Δmargin ={' '}
        {usd(STEP_DEAL_INPUTS.fixedCosts - STEP_BASE_INPUTS.fixedCosts, 0)} ÷{' '}
        {usd(stepDeal.contributionMargin - stepBase.contributionMargin)}.
      </p>
      <p>
        <strong>Step 3 — the decision.</strong> At {numFmt(400, 0)} units the deal is{' '}
        {usd(stepGapAt400, 0)}/mo better; at {numFmt(200, 0)} it is {usd(Math.abs(stepGapAt400), 0)}/mo
        worse (the gap moves {usd(stepDeal.contributionMargin - stepBase.contributionMargin)} per
        unit on either side of {numFmt(stepCrossover ?? 0, 0)}). Below the crossover, keep the
        current structure; above it, take the deal. And notice what break-even alone would have
        done: rejected a deal that is worth {usd(stepGapAt400, 0)}/mo at any volume you actually
        expect. Break-even ranks how fast a <em>single</em> structure recovers its fixed hole;
        choosing <em>between</em> two structures is a profit-at-forecast-volume question. The same
        discipline is how step costs should be handled generally — re-run the whole model at each
        capacity plateau rather than averaging the step into the fixed line.
      </p>

      <h2 id="raise-vs-cut">Raise price or cut cost? The decision boundary</h2>
      <p>
        When break-even is too high, there are exactly three levers, and they are{' '}
        <em>not</em> interchangeable. Cutting variable cost by a dollar and raising price by a
        dollar both add a dollar of contribution margin — identical arithmetic, completely
        different risk. Cutting fixed costs adds no margin at all, yet lowers break-even
        linearly. Choosing correctly is a matter of two boundary questions.
      </p>
      <p>
        <strong>Boundary one: what volume can a price rise afford to lose?</strong> A{' '}
        {pct(10, 0)} price increase leaves profit unchanged when the fraction of customers lost is
        <code> e* = 1 − CM ÷ CM′ </code>(CM′ = margin after the rise). At the preset numbers:
      </p>
      <ul>
        <li>
          <strong>SaaS preset</strong> ({pct(saas.r.cmRatioPct ?? 0, 0)} margin ratio): you can
          lose up to <strong>{pct(tol(0), 1)}</strong> of accounts before a 10% price rise stops
          paying.
        </li>
        <li>
          <strong>Product preset</strong> ({pct(product.r.cmRatioPct ?? 0, 0)} margin ratio — a
          typical e-commerce geometry): tolerance widens to <strong>{pct(tol(1), 1)}</strong>.
        </li>
        <li>
          <strong>Service preset</strong>: <strong>{pct(tol(2), 1)}</strong>.
        </li>
      </ul>
      <p>
        The pattern is the useful part: the <em>thinner</em> the contribution margin, the more
        volume a price rise can afford to lose, because 10% of price is a larger relative boost to
        a small margin.
      </p>
      <p>
        <strong>Boundary two: what must a price <em>cut</em> buy to be worth it?</strong> Run the
        same arithmetic downward. A 10% price cut at the SaaS numbers needs volume to grow{' '}
        <strong>{pct(cutStandstillGrowth(0), 1)}</strong> just to stand still; at the product
        preset &mdash; where the cut lands on a thinner margin &mdash; it needs{' '}
        <strong>{pct(cutStandstillGrowth(1), 1)}</strong>. That is the mathematical case against
        competing on price: the growth a 10% cut needs just to stand still is 10% ÷ (margin
        ratio − 10%), which grows without bound as the margin ratio approaches{' '}
        {pct(10, 0)} — the point where the cut price lands exactly on variable cost, and past
        which the engine stops returning a stand-still volume at all (the cut floor in the table
        in <a href="#boundaries">Decision boundaries</a>). The sweep chart&rsquo;s hyperbola —{' '}
        <code>Q* = F ÷ (p − v)</code> — is the same argument drawn in a different variable, and
        its asymptote accordingly sits where today&rsquo;s price, not the cut price, touches
        variable cost.
      </p>
      <p>Which leaves the decision rule:</p>
      <ol>
        <li>
          <strong>Raise price</strong> when volume sits above break-even and demand is inelastic —
          differentiated product, switching costs, weak price comparison. It lifts revenue per unit
          and contribution margin in a single move, with no re-engineering to execute; the cost of
          that convenience is demand risk, which the tolerance numbers above quantify before you
          commit.
        </li>
        <li>
          <strong>Cut variable cost</strong> when price is pinned by competition or an anchored
          market. Per dollar of contribution margin it is arithmetically equal to a price rise but
          carries no demand risk — the risk moves to execution: cheaper materials, tighter
          shipping, re-scoped service. Note that payment fees are a real variable cost; the{' '}
          <a href="/stripe-fee-calculator/">Stripe fee calculator</a> prices that slice exactly.
        </li>
        <li>
          <strong>Cut fixed costs</strong> when volume is far below break-even and cash is the
          binding constraint. Price and cost levers only pay per unit <em>sold</em> — if the units
          are not there yet, shrinking the fixed hole is the only lever that shortens the distance
          to break-even directly, and it slows the burn on the way (the{' '}
          <a href="/saas-runway-calculator/">runway calculator</a> measures that clock).
        </li>
      </ol>

      <h2 id="leverage">Operating leverage: the multiplier cuts both ways</h2>
      <p>
        High contribution margins are usually celebrated — and they do make the green wedge grow
        fast. But the same geometry that amplifies profit amplifies loss: at{' '}
        {numFmt(saas.r.operatingLeverage ?? 0, 2)}× leverage, a 10% revenue dip cuts profit by
        roughly {pct((saas.r.operatingLeverage ?? 0) * 10, 0)}. A software business with a 90%
        margin ratio and a large fixed base (salaries) can swing from comfortable profit to loss on
        a modest contraction — while a distributor&rsquo;s 15% margin ratio barely moves. When you
        evaluate a business model, read the margin ratio <em>and</em> the fixed base together:
        leverage is chosen at the moment you decide how much of your cost structure is salaries
        versus services paid per use.
      </p>

      <h2 id="multi-product">Multi-product break-even</h2>
      <p>
        The tool models one unit; most businesses sell several. The standard extension is the{' '}
        <strong>weighted-average contribution margin</strong> at the expected sales mix. Suppose
        60% of units are the preset SaaS accounts (CM {usd(saas.r.contributionMargin)}) and 40% are
        the preset gadgets (CM {usd(product.r.contributionMargin)}):
      </p>
      <p>
        <code>
          blended CM = 0.6 × {usd(saas.r.contributionMargin)} + 0.4 × {usd(product.r.contributionMargin)} = {usd(blendedCm)}
        </code>{' '}
        per composite unit, so with {usd(blendedFixed, 0)} of combined fixed costs the mix breaks
        even at <strong>{numFmt(blendedBe, 1)} composite units</strong> ({numFmt(blendedBe * MIX.saasShare, 0)}{' '}
        accounts + {numFmt(blendedBe * MIX.productShare, 0)} gadgets). The caveat that matters:
        the blend is only as stable as the mix. If the cheap-margin product grows faster than
        planned, break-even quietly rises even though every individual price and cost stayed the
        same.
      </p>

      <h2 id="limits">Where the model lies</h2>
      <ul>
        <li>
          <strong>Linearity is an assumption, not a law.</strong> Volume discounts, tiered pricing,
          overtime labor and shipping breakpoints all bend the lines. The model stays useful
          inside the relevant range — the volume band over which your cost behavior actually holds.
        </li>
        <li>
          <strong>Step fixed costs pretend to be fixed.</strong> The next support hire, the bigger
          warehouse, the enterprise plan you suddenly need — each is a cliff in the fixed line.
          Model the step explicitly (re-run the tool at each capacity plateau) rather than
          averaging it away.
        </li>
        <li>
          <strong>Semi-variable costs need splitting.</strong> A contractor with a monthly retainer
          plus a per-ticket fee is both families at once: retainer into fixed costs, per-ticket
          into variable. The high-low method (cost at the highest and lowest observed volume) does
          the split when the structure is murky.
        </li>
        <li>
          <strong>Break-even is accrual profit, not cash.</strong> A SaaS on annual prepay can be
          cash-positive while accrual-negative (you are spending next year&rsquo;s revenue), and
          the reverse for invoiced services. Profit break-even tells you the business works; only
          a cash projection tells you whether it survives long enough to get there —{' '}
          <a href="/saas-runway-calculator/">runway is that second instrument</a>.
        </li>
        <li>
          <strong>Taxes, financing and owner pay are outside.</strong> Owner salary is a fixed cost
          if you pay yourself one; distributions above it come after break-even. Debt service is
          typically held outside CVP and layered on separately.
        </li>
      </ul>

      <h2 id="boundaries">Decision boundaries</h2>
      <p>
        A model earns trust by stating where it stops working. The lines below are drawn for this
        CVP engine specifically; how each critical value was found is documented alongside the
        value itself.
      </p>

      <h3>When this model is the right instrument</h3>
      <ul>
        <li>
          <strong>One unit, or a stable blend.</strong> A single product at a constant price, or a
          multi-product business whose sales mix holds roughly steady across the planning horizon.
        </li>
        <li>
          <strong>Costs split honestly by behavior</strong>, and the relevant range — the volume
          band over which fixed is actually fixed and variable is actually proportional — covers
          the volumes you are deciding between.
        </li>
        <li>
          <strong>The question is a structure question:</strong> a pricing floor, a cost target,
          how far volume can fall, whether a capacity step pays. CVP answers all four in one
          arithmetic.
        </li>
      </ul>

      <h3>When to set it aside</h3>
      <ul>
        <li>
          <strong>Price sits at or below variable cost.</strong> The engine returns no break-even
          by design rather than inventing one; fix the unit economics first (the{' '}
          <a href="#example-rescue">rescue example above</a> walks that path).
        </li>
        <li>
          <strong>The planning band crosses a capacity step.</strong> A single-number break-even
          hides the cliff; re-run the model at each plateau and choose on profit at forecast
          volume, as the <a href="#example-step">re-engineering example</a> does.
        </li>
        <li>
          <strong>The question is cash timing or tax.</strong> Break-even is accrual operating
          profit per period; the cash-out clock is the{' '}
          <a href="/saas-runway-calculator/">runway tool&rsquo;s</a> job, and tax layers on after.
        </li>
        <li>
          <strong>The sales mix is drifting.</strong> The weighted-average blend is valid only at
          the mix it was computed for — see the mix boundary below for how much drift the number
          survives.
        </li>
        <li>
          <strong>Pricing is deeply non-linear</strong> (negotiated B2B, auctions, promotional
          ladders) and the realized average price is unstable period to period. The model degrades
          gracefully on a stable average and badly on a moving one.
        </li>
      </ul>

      <h3>The critical values — and how they were found</h3>
      <p>
        Four scans, all run against the same engine the calculator runs — never typed by hand:
        the price-cut table below re-solves{' '}
        <code>(1+g)·CM&prime; = CM</code> with the engine&rsquo;s <code>contributionMargin</code> at
        each margin ratio (price normalized to {usd(100, 0)} per row); the rise-tolerance balance
        point is a 0.5pp grid scan of <code>priceRiseTolerance</code>; the mix boundary bisects the
        low-margin share until the blended break-even — fixed costs ÷ blended CM, both legs
        engine-computed — rises 10% over its 60/40 base; the rescue price and indifference volume
        in the worked examples bisect and scan <code>breakEvenUnits</code> and{' '}
        <code>profitAt</code>. Your versions of these numbers are different — rerun the calculator
        on your own inputs before acting on any of them.
      </p>
      <table>
        <thead>
          <tr>
            <th>Contribution-margin ratio</th>
            <th>Growth a 10% price cut needs just to stand still</th>
          </tr>
        </thead>
        <tbody>
          {CUT_ROWS.map((row) => (
            <tr key={row.m}>
              <td>{pct(row.m, 0)}</td>
              <td>{row.g === null ? '— no volume survives the cut' : pct(row.g, 1)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <ul>
        <li>
          <strong>The cut floor.</strong> At a {pct(10, 0)} margin ratio a 10% price cut takes the
          contribution margin to exactly {usd(CUT_FLOOR_CM)} — the engine&rsquo;s signal that no
          stand-still volume exists. Below that ratio the cut is unsurvivable at any volume; this
          is the same hyperbola the sweep chart draws, stated as a number.
        </li>
        <li>
          <strong>The rise balance point: {pct(balanceM ?? 0, 1)} margin ratio.</strong> There, a
          10% price rise exactly tolerates a 10% customer loss (tolerance{' '}
          {pct(priceRiseTolerance(100, 100 - (balanceM ?? 0), 10) ?? 0, 1)}). Above it tolerance
          shrinks — {pct(priceRiseTolerance(100, 5, 10) ?? 0, 1)} at a {pct(95, 0)} ratio — and
          below it widens, {pct(priceRiseTolerance(100, 50, 10) ?? 0, 1)} at {pct(50, 0)}. Fat
          margins get less headroom from a rise, and need it less.
        </li>
        <li>
          <strong>The mix boundary.</strong> At the guide&rsquo;s 60/40 blend (break-even{' '}
          {numFmt(mixBaseBe, 1)} composite units), the low-margin gadget share can drift from{' '}
          {pct(MIX.productShare * 100, 0)} to {pct(mixDriftShare * 100, 1)} —{' '}
          {numFmt((mixDriftShare - MIX.productShare) * 100, 1)} points — before break-even rises
          even {pct(10, 0)}. Beyond that, mix drift alone is silently repricing the business.
        </li>
        <li>
          <strong>The safety/leverage identity.</strong> A {pct(EQ.marginOfSafetyPct ?? 0, 1)}{' '}
          margin of safety and {numFmt(EQ.operatingLeverage ?? 0, 2)}× operating leverage are the
          same line seen from two sides — which is why the &ldquo;sleep well&rdquo; threshold and
          the &ldquo;profit gets violent&rdquo; threshold arrive together, never separately.
        </li>
        <li>
          <strong>The zero-fixed corner.</strong> With fixed costs at zero the engine returns a
          break-even of {numFmt(zeroFixed.breakEvenUnits ?? 0, 0)} units, the first sale already
          profitable, a {pct(zeroFixed.marginOfSafetyPct ?? 0, 0)} margin of safety and leverage of
          exactly {numFmt(zeroFixed.operatingLeverage ?? 0, 2)}× — the model&rsquo;s least dramatic
          and most honest output, and a reminder that fixed costs are the entire reason
          break-even exists.
        </li>
      </ul>

      <h2 id="glossary">Glossary</h2>
      <dl className="mt-2 space-y-5">
        <div>
          <dt className="font-semibold text-slate-900 dark:text-slate-100">Contribution margin (per unit)</dt>
          <dd className="mt-0.5 leading-relaxed text-slate-600 dark:text-slate-300">
            Price minus variable cost per unit — the amount each sale contributes toward covering
            fixed costs. {usd(saas.r.contributionMargin)} per account at the SaaS preset numbers.
          </dd>
        </div>
        <div>
          <dt className="font-semibold text-slate-900 dark:text-slate-100">Contribution-margin ratio</dt>
          <dd className="mt-0.5 leading-relaxed text-slate-600 dark:text-slate-300">
            The same margin as a share of price: what fraction of every revenue dollar survives
            variable costs. {pct(saas.r.cmRatioPct ?? 0, 1)} at the preset; it drives the
            revenue-denominated break-even.
          </dd>
        </div>
        <div>
          <dt className="font-semibold text-slate-900 dark:text-slate-100">Fixed cost</dt>
          <dd className="mt-0.5 leading-relaxed text-slate-600 dark:text-slate-300">
            A cost that arrives with the calendar regardless of volume — rent, salaries,
            insurance, software. The hole that contribution margins must fill.
          </dd>
        </div>
        <div>
          <dt className="font-semibold text-slate-900 dark:text-slate-100">Variable cost</dt>
          <dd className="mt-0.5 leading-relaxed text-slate-600 dark:text-slate-300">
            A cost that scales one-to-one with each unit sold — COGS, freight, payment fees,
            delivery labor. No sale, no cost.
          </dd>
        </div>
        <div>
          <dt className="font-semibold text-slate-900 dark:text-slate-100">Semi-variable (mixed) cost</dt>
          <dd className="mt-0.5 leading-relaxed text-slate-600 dark:text-slate-300">
            A cost with both a fixed and a variable part, like a contractor retainer plus a
            per-ticket fee. Split it — retainer into fixed, per-ticket into variable — before
            entering anything in the tool.
          </dd>
        </div>
        <div>
          <dt className="font-semibold text-slate-900 dark:text-slate-100">Step cost</dt>
          <dd className="mt-0.5 leading-relaxed text-slate-600 dark:text-slate-300">
            A cost that is fixed within a volume band and jumps at its edge — the next support
            hire, the bigger warehouse. Model each plateau separately rather than averaging a step
            into the fixed line.
          </dd>
        </div>
        <div>
          <dt className="font-semibold text-slate-900 dark:text-slate-100">Relevant range</dt>
          <dd className="mt-0.5 leading-relaxed text-slate-600 dark:text-slate-300">
            The volume band over which the cost behavior you entered actually holds — fixed truly
            fixed, variable truly proportional, price truly constant. The model&rsquo;s answers are
            only valid inside it.
          </dd>
        </div>
        <div>
          <dt className="font-semibold text-slate-900 dark:text-slate-100">Break-even point</dt>
          <dd className="mt-0.5 leading-relaxed text-slate-600 dark:text-slate-300">
            The volume at which operating profit is exactly zero: fixed costs ÷ contribution
            margin. {numFmt(saas.r.breakEvenUnits ?? 0, 1)} accounts at the preset numbers — the
            boundary of the two wedges on the chart.
          </dd>
        </div>
        <div>
          <dt className="font-semibold text-slate-900 dark:text-slate-100">Break-even revenue</dt>
          <dd className="mt-0.5 leading-relaxed text-slate-600 dark:text-slate-300">
            The same crossing stated in dollars: fixed costs ÷ CM ratio —{' '}
            {usd(saas.r.breakEvenRevenue ?? 0, 0)} at the preset. Useful for market-sizing
            questions where units are not the natural currency.
          </dd>
        </div>
        <div>
          <dt className="font-semibold text-slate-900 dark:text-slate-100">Margin of safety</dt>
          <dd className="mt-0.5 leading-relaxed text-slate-600 dark:text-slate-300">
            How far current volume can fall before profit hits zero, as a percentage of current
            volume. {pct(saas.r.marginOfSafetyPct ?? 0, 1)} at the preset — the cushion between
            the business you have and the one that breaks.
          </dd>
        </div>
        <div>
          <dt className="font-semibold text-slate-900 dark:text-slate-100">Degree of operating leverage</dt>
          <dd className="mt-0.5 leading-relaxed text-slate-600 dark:text-slate-300">
            Total contribution margin ÷ operating profit: how many percent profit moves per percent
            of volume. {numFmt(saas.r.operatingLeverage ?? 0, 2)}× at the preset, and exactly the
            inverse of margin of safety.
          </dd>
        </div>
        <div>
          <dt className="font-semibold text-slate-900 dark:text-slate-100">Sales mix</dt>
          <dd className="mt-0.5 leading-relaxed text-slate-600 dark:text-slate-300">
            The proportion in which a multi-product business sells its units — 60/40 in the blend
            above. The weighted-average method is only as current as the mix it was computed at.
          </dd>
        </div>
      </dl>

      <Faq
        items={[
          {
            question: 'Does break-even include my own salary?',
            answer: (
              <p>
                If you pay yourself a fixed amount each month, yes — it is a fixed cost, and
                omitting it is the single most common way founders fool themselves with this
                tool. If part of your pay is a per-sale commission, that slice belongs in variable
                cost. Pre-profit founders taking no salary should run the tool twice: once as-is,
                and once with a market-rate salary added to fixed costs — the second number is
                the honest one.
              </p>
            ),
          },
          {
            question: 'What margin of safety should I aim for?',
            answer: (
              <p>
                As a rule of thumb, 20–30% is where most operators start sleeping well; below 10%
                a single bad quarter can put you under water. The right number scales with
                volatility: subscription revenue with 2% monthly churn tolerates a thinner cushion
                than project work that lands in lumps. Equivalently, watch operating leverage —
                it is the exact inverse of margin of safety, and above ~4× profit becomes
                violently sensitive to volume.
              </p>
            ),
          },
          {
            question: 'Why is break-even revenue different from fixed costs plus variable costs?',
            answer: (
              <p>
                It is not different — it is the same number from two directions. At break-even,
                revenue = fixed + variable costs exactly. Solving that equation gives revenue =
                fixed costs ÷ contribution-margin ratio, which is what the tool reports. Both
                derivations must agree; if yours do not, a cost is sitting in the wrong family.
              </p>
            ),
          },
          {
            question: 'How do I handle a price that varies — discounts, tiers, promotions?',
            answer: (
              <p>
                CVP assumes one constant price. With a handful of tiers, run each as its own unit
                economics and blend with the weighted-average method in the guide above. With
                truly messy pricing, use realized average price per unit over a recent period —
                the model degrades gracefully as long as the average is stable.
              </p>
            ),
          },
          {
            question: 'My break-even lands between two units — which one do I need?',
            answer: (
              <p>
                The fractional number (like the preset&rsquo;s{' '}
                {numFmt(saas.r.breakEvenUnits ?? 0, 1)} accounts) is the exact zero-profit point; the
                next whole unit (#{numFmt(saas.r.firstProfitableUnit ?? 0, 0)} at the preset numbers)
                is the first sale that makes the month profitable, which is why the tool surfaces
                it explicitly. At scale the distinction rarely matters; near break-even it is the
                difference between a flat month and a good one.
              </p>
            ),
          },
          {
            question: 'When should I give up on a product using this analysis?',
            answer: (
              <p>
                When price sits at or below variable cost — the tool&rsquo;s &ldquo;no break-even
                exists&rdquo; state — volume cannot save it; only repricing or re-engineering the
                unit can. The subtler failure is a reachable break-even the market will not
                deliver: if break-even volume is several multiples of your demonstrated demand and
                the margin ratio leaves no pricing headroom, the fixed base or the product itself
                is the problem — the analysis tells you which lever is left.
              </p>
            ),
          },
          {
            question: 'Does break-even include taxes?',
            answer: (
              <p>
                No — CVP stops at operating profit, before a cent of tax. The preset&rsquo;s{' '}
                {usd(saas.r.profitAtCurrent, 0)}/mo at {numFmt(BREAKEVEN_PRESETS[0].inputs.currentUnits, 0)}{' '}
                accounts is a pre-tax figure; layer your actual tax rate on afterward, once the
                structure question is settled.
              </p>
            ),
          },
          {
            question: 'Is the break-even point the same as my payback period?',
            answer: (
              <p>
                No — they are different clocks. Break-even is a steady state per period (the
                preset&rsquo;s {numFmt(saas.r.breakEvenUnits ?? 0, 1)} accounts ≈{' '}
                {usd(saas.r.breakEvenRevenue ?? 0, 0)}/mo); payback counts the months to recover a
                one-time outlay such as equipment or a campaign. A business can clear break-even
                every month and still carry a long payback on the investment that got it there.
              </p>
            ),
          },
          {
            question: 'What if my fixed costs are zero?',
            answer: (
              <p>
                Then the engine returns a break-even of {numFmt(zeroFixed.breakEvenUnits ?? 0, 0)}{' '}
                units — sale #1 is already profitable — with a{' '}
                {pct(zeroFixed.marginOfSafetyPct ?? 0, 0)} margin of safety and leverage of exactly{' '}
                {numFmt(zeroFixed.operatingLeverage ?? 0, 2)}×. The corner is rare in practice
                (even solos carry software and insurance), but it isolates what fixed costs do:
                they are the entire reason a break-even volume exists.
              </p>
            ),
          },
          {
            question: 'What happens when price exactly equals variable cost?',
            answer: (
              <p>
                The contribution margin is {usd(zeroMargin.contributionMargin)} and the engine
                returns no break-even: each sale contributes nothing toward the{' '}
                {usd(zeroMargin.profitAtCurrent * -1, 0)}/mo fixed hole in the scenario we ran, so
                the loss is the fixed costs exactly, at any volume. Volume neither deepens nor
                repairs it — only a price above variable cost opens a path.
              </p>
            ),
          },
          {
            question: 'Why does a 10% price cut hurt more than a 10% price rise helps?',
            answer: (
              <p>
                Because both act on the same denominator, price − variable cost, and moving a
                denominator multiplicatively is asymmetric. On the product preset the engine&rsquo;s
                sensitivity grid shows a 10% cut pushing break-even up to{' '}
                {numFmt(sensProduct[0].down ?? 0, 1)} units (+
                {pct(((sensProduct[0].down ?? 0) / (product.r.breakEvenUnits ?? 1) - 1) * 100, 1)})
                while a 10% rise only pulls it down to {numFmt(sensProduct[0].up ?? 0, 1)} units (−
                {pct(Math.abs(((sensProduct[0].up ?? 0) / (product.r.breakEvenUnits ?? 1) - 1) * 100), 1)}).
              </p>
            ),
          },
          {
            question: 'Should payment processing fees be in my variable cost?',
            answer: (
              <p>
                Yes — they scale one-to-one with sales. A 2.9% + {usd(0.3)} rate on the preset&rsquo;s{' '}
                {usd(89)} gadget is {usd(STRIPE_FEE)} per unit; entering{' '}
                {usd(41 + STRIPE_FEE)} as variable cost moves break-even from{' '}
                {numFmt(product.r.breakEvenUnits ?? 0, 1)} to{' '}
                {numFmt(withFees.breakEvenUnits ?? 0, 1)} units (
                +{pct(((withFees.breakEvenUnits ?? 0) / (product.r.breakEvenUnits ?? 1) - 1) * 100, 1)}).
                The <a href="/stripe-fee-calculator/">Stripe fee calculator</a> prices that slice
                exactly.
              </p>
            ),
          },
          {
            question: 'What is the difference between contribution margin and gross profit?',
            answer: (
              <p>
                Contribution margin is per-unit and stops before fixed costs; gross profit is a
                period total after all COGS. When every COGS line is variable the two agree in
                ratio — {pct(saas.r.cmRatioPct ?? 0, 1)} at the preset — but a monthly-billed
                server inside COGS breaks the equivalence, which is why the tool asks for cost
                behavior, not accounting categories.
              </p>
            ),
          },
          {
            question: 'How do I break even on a target profit instead of zero?',
            answer: (
              <p>
                Add the target to fixed costs and re-solve: treating a{' '}
                {usd(TARGET_PROFIT, 0)}/mo profit target as a fixed claim puts the preset&rsquo;s
                hurdle at {numFmt(tpRun.breakEvenUnits ?? 0, 1)} accounts (vs{' '}
                {numFmt(saas.r.breakEvenUnits ?? 0, 1)} for zero), and at{' '}
                {numFmt(BREAKEVEN_PRESETS[0].inputs.currentUnits, 0)} accounts the engine confirms
                exactly {usd(tpRun.profitAtCurrent, 0)}/mo. A profit target is a fixed cost of the
                business you intend to run — that is the whole trick.
              </p>
            ),
          },
          {
            question: 'Why does operating leverage show a dash instead of a number?',
            answer: (
              <p>
                The engine nulls leverage whenever operating profit is zero or negative — a
                percentage move of a loss has no meaningful size. Re-run at a volume above
                break-even and the number appears; through the loss wedge, sensitivity is better
                read directly in dollars per unit of volume.
              </p>
            ),
          },
          {
            question: 'Can I use this across products when the sales mix shifts?',
            answer: (
              <p>
                Only at the mix you entered. The guide&rsquo;s 60/40 blend breaks even at{' '}
                {numFmt(mixBaseBe, 1)} composite units, and the boundary scan shows the
                low-margin share drifting to {pct(mixDriftShare * 100, 1)} —{' '}
                {numFmt((mixDriftShare - MIX.productShare) * 100, 1)} points — already raises
                break-even by {pct(10, 0)} with no price or cost change. Re-blend whenever the mix
                moves; the blended figure is a snapshot, not a property.
              </p>
            ),
          },
          {
            question: 'Does seasonality break the model?',
            answer: (
              <p>
                No — the period switch handles it. Run December and March as separate problems with
                each month&rsquo;s own figures; the ratio outputs are period-invariant. Annualized,
                the preset&rsquo;s {numFmt(saas.r.breakEvenUnits ?? 0, 1)} accounts/mo becomes{' '}
                {numFmt(annualBe ?? 0, 0)} accounts/yr against{' '}
                {usd(BREAKEVEN_PRESETS[0].inputs.fixedCosts * 12, 0)} of fixed costs — the same
                crossing, stated yearly.
              </p>
            ),
          },
          {
            question: 'What counts as a good contribution-margin ratio?',
            answer: (
              <p>
                Nothing does on its own — the ratio only means something against the fixed base it
                must cover. {pct(saas.r.cmRatioPct ?? 0, 1)} with{' '}
                {usd(BREAKEVEN_PRESETS[0].inputs.fixedCosts, 0)}/mo of fixed costs means{' '}
                {usd(saas.r.breakEvenRevenue ?? 0, 0)}/mo of break-even revenue; the same fixed
                base on a thin {pct(15, 0)} ratio needs {usd(thinBeRev ?? 0, 0)}/mo. Judge the
                pair together — that pairing is the entire geometry of the business.
              </p>
            ),
          },
          {
            question: 'Hosting went up $1 per account — how much does break-even move?',
            answer: (
              <p>
                More than a dollar of drift suggests: at the preset, variable cost of{' '}
                {usd(BREAKEVEN_PRESETS[0].inputs.unitVariableCost + 1)} moves break-even from{' '}
                {numFmt(saas.r.breakEvenUnits ?? 0, 1)} to {numFmt(vcDrift.breakEvenUnits ?? 0, 1)}{' '}
                accounts (+{numFmt((vcDrift.breakEvenUnits ?? 0) - (saas.r.breakEvenUnits ?? 0), 1)}).
                The sensitivity is roughly fixed × ΔV ÷ (CM × CM&prime;) — which is exactly why thin
                margins feel every cost drift first.
              </p>
            ),
          },
          {
            question: 'Is marketing spend fixed or variable?',
            answer: (
              <p>
                By behavior, not by department. A {usd(2000, 0)}/mo retainer is a fixed cost —
                added to the preset it moves break-even from{' '}
                {numFmt(saas.r.breakEvenUnits ?? 0, 1)} to {numFmt(mktBe ?? 0, 1)} accounts —
                while cost-per-lead and commission-paid spend scale with sales and belong in
                variable cost. Filing performance marketing as fixed is a common way the margin of
                safety gets quietly overstated.
              </p>
            ),
          },
          {
            question: 'Break-even in units or in revenue — which should I track?',
            answer: (
              <p>
                Both, for different jobs. Units ({numFmt(saas.r.breakEvenUnits ?? 0, 1)} accounts at
                the preset) is the operational target your team can count toward; revenue (
                {usd(saas.r.breakEvenRevenue ?? 0, 0)}/mo) is the market-sizing number you can
                compare against addressable demand. The revenue form also survives mix changes
                better, as long as the margin ratio holds.
              </p>
            ),
          },
          {
            question: 'My break-even rose but no price or cost changed — what moved it?',
            answer: (
              <p>
                Either the mix drifted (see above) or a step cost landed. A{' '}
                {usd(1500, 0)}/mo commitment added to the product preset&rsquo;s fixed line moves
                break-even from {numFmt(product.r.breakEvenUnits ?? 0, 1)} to{' '}
                {numFmt(fixedStepBe ?? 0, 1)} units with no per-unit change at all. Audit the fixed
                line and the mix before touching price.
              </p>
            ),
          },
        ]}
      />

      <RelatedCalculators
        links={[
          { href: '/saas-runway-calculator/', label: 'SaaS Runway Calculator' },
          { href: '/stripe-fee-calculator/', label: 'Stripe Fee Calculator' },
          { href: '/freelance-hourly-rate-calculator/', label: 'Freelance Hourly Rate' },
        ]}
      />
    </article>
  );
}

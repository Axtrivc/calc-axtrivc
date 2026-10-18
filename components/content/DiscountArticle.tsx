import Faq from '@/components/Faq';
import { ArticleToc, RelatedCalculators } from '@/components/Article';
import {
  DISCOUNT_PRESETS,
  computeDiscount,
  couponVsStraight,
  marginTierMatrix,
  profitAtResponse,
  profitDeltaAtResponse,
  profitNeutralUpliftPct,
  revenueNeutralUpliftPct,
} from '@/lib/discount';
import { numFmt, pct, usd } from '@/lib/format';

/* Every number in the tables and vignettes below is computed at build time by
   the same engine the widget runs — nothing in this article is hand-typed. */

// The calculator's default scenario: the physical-product preset — $89 list,
// $41 landed COGS, 300 units/mo, 20% off.
const PRESET = DISCOUNT_PRESETS[1];
const EX = computeDiscount(PRESET.inputs);

// The same discount run at the famous +25% "rule" response — and at the
// break-even response the margin actually demands.
const AT_FAMOUS = profitAtResponse(PRESET.inputs, 25);
const AT_FAMOUS_DELTA = profitDeltaAtResponse(PRESET.inputs, 25);
const AT_BE = EX.profitNeutralUpliftPct === null ? null : profitAtResponse(PRESET.inputs, EX.profitNeutralUpliftPct);

// The famous table, straight from the formula: uplift = d ÷ (1 − d).
const FAMOUS_TABLE = [5, 10, 15, 20, 25, 30, 40].map((d) => ({
  d,
  uplift: revenueNeutralUpliftPct(d),
}));

// The margin-stratified truth: rows = gross margin, columns = discount depth.
const TIERS = marginTierMatrix([70, 60, 50, 40, 30, 20], [5, 10, 15, 20, 25, 30]);
const TIER_DISCOUNTS = [5, 10, 15, 20, 25, 30];

// SaaS archetype — the near-zero-cost world where the famous table is almost
// the whole truth (gm ≈ 89.9%).
const SAAS = DISCOUNT_PRESETS[0];
const SAAS_EX = computeDiscount(SAAS.inputs);
// "Annual plan = 2 months free": 12 months of service for 10 months of price.
const ANNUAL_D = (2 / 12) * 100; // 16.667% effective discount
const ANNUAL_FLOOR = revenueNeutralUpliftPct(ANNUAL_D);
const ANNUAL_REAL = profitNeutralUpliftPct(SAAS.inputs.price, SAAS.inputs.unitCost, ANNUAL_D);

// Service archetype — the 10% "client loyalty" rate.
const SVC = DISCOUNT_PRESETS[2];
const SVC_EX = computeDiscount(SVC.inputs);

// Acquisition arithmetic for the rational-discount section, both bookkeepings:
// the sitewide promo's total concession spread over its incremental units,
// versus a fenced first-order discount conceded only on genuinely new customers.
const ACQ_UNITS = PRESET.inputs.volume * (1 + PRESET.expectedUpliftPct / 100); // units sold at +25% response
const ACQ_PER_UNIT = (PRESET.inputs.discountPct / 100) * PRESET.inputs.price;  // concession per unit sold
const ACQ_TOTAL = ACQ_UNITS * ACQ_PER_UNIT;                                    // whole-promotion concession
const ACQ_PER_NEW = ACQ_TOTAL / (ACQ_UNITS - PRESET.inputs.volume);            // per incremental unit
const ACQ_UPFRONT = profitDeltaAtResponse(PRESET.inputs, 0); // one month of zero incremental response

// Coupon worked example: "spend $100 save $15" against a blanket 15% off,
// judged on a $250 basket (the calculator's defaults).
const COUPON = couponVsStraight(100, 15, 250, 15);
// The same coupon judged at exactly the threshold — where the two are equal.
const COUPON_AT_T = couponVsStraight(100, 15, 100, 15);
// A bigger basket: the coupon's advantage for the seller grows.
const COUPON_BIG = couponVsStraight(100, 15, 400, 15);

export default function DiscountArticle() {
  const toc = [
    { id: 'famous', label: 'The arithmetic everyone quotes' },
    { id: 'margin-layer', label: 'Why costs make it worse' },
    { id: 'worked-example', label: 'Worked example: 20% off, line by line' },
    { id: 'psychology', label: 'The psychology of discounting' },
    { id: 'rational', label: 'When a discount is rational' },
    { id: 'coupon-math', label: 'Coupon vs straight discount' },
    { id: 'guardrails', label: 'The pre-flight checklist' },
    { id: 'glossary', label: 'Glossary' },
    { id: 'faq', label: 'FAQ' },
  ];

  return (
    <article className="prose-article">
      <ArticleToc items={toc} />

      <h2 id="famous">The arithmetic everyone quotes</h2>
      <p>
        Cut your price by a fraction <em>d</em> and each sale now brings in{' '}
        <code>(1 − d)</code> of what it did. To keep revenue — or profit, in the costless world
        below — flat, volume must rise by exactly:
      </p>
      <p className="readout rounded-lg bg-white px-4 py-3 text-center text-base font-semibold text-slate-900 ring-1 ring-inset ring-slate-200 dark:bg-white/[0.05] dark:text-slate-100 dark:ring-white/10">
        required uplift = 1 ÷ (1 − d) − 1 = d ÷ (1 − d)
      </p>
      <p>
        Derivation: hold revenue flat, <code>Q₂ · P(1 − d) = Q · P</code>, divide both sides by{' '}
        <code>Q · P</code> to get <code>Q₂ ÷ Q = 1 ÷ (1 − d)</code>. One line of algebra, and it
        produces the most quoted table in retail:
      </p>
      <table>
        <thead>
          <tr>
            <th>Discount</th>
            <th>Volume needed to stand still</th>
          </tr>
        </thead>
        <tbody>
          {FAMOUS_TABLE.map((row) => (
            <tr key={row.d}>
              <td>{pct(row.d, 0)} off</td>
              <td>+{pct(row.uplift, 1)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p>
        Twenty percent off needs <strong>+25%</strong> more volume; twenty-five percent off needs{' '}
        <strong>+33.3%</strong>; thirty percent needs <strong>+{pct(FAMOUS_TABLE[5].uplift, 1)}</strong>.
        The numbers are not intuitive — discounts look like they cost 20% and actually demand a
        quarter again as many sales. This table is the article&apos;s anchor, and it is exactly what
        the calculator prints as the <em>revenue-only floor</em>.
      </p>
      <p>
        But read the derivation again: it holds <strong>revenue</strong> flat. It holds{' '}
        <strong>profit</strong> flat only when there is nothing inside the product — when the unit
        cost is zero and revenue <em>is</em> gross profit. The moment each unit carries a cost, the
        same one-line derivation run on margin instead of revenue gives a bigger number, and the gap
        between the two is the silent killer of promotions.
      </p>

      <h2 id="margin-layer">Why costs make it worse: the margin layer</h2>
      <p>
        Rederive the same condition on gross profit. Before the discount each unit contributes{' '}
        <code>P − C</code>; after a discount of <em>d</em> it contributes{' '}
        <code>P(1 − d) − C</code>. Write the gross margin as <code>gm = (P − C) ÷ P</code>, so that{' '}
        <code>C = P(1 − gm)</code>, and the discounted unit margin simplifies to{' '}
        <strong><code>P(gm − d)</code></strong> — the discount comes straight out of the margin,
        dollar for dollar, leaving the cost untouched. Hold profit flat:
      </p>
      <p className="readout rounded-lg bg-white px-4 py-3 text-center text-base font-semibold text-slate-900 ring-1 ring-inset ring-slate-200 dark:bg-white/[0.05] dark:text-slate-100 dark:ring-white/10">
        Q₂ · P(gm − d) = Q · P · gm&nbsp;&nbsp;→&nbsp;&nbsp;uplift = d ÷ (gm − d)
      </p>
      <p>
        This is the classic price-cut/volume table of managerial pricing (Marn &amp; Rosiello,{' '}
        <em>Managing Price, Gaining Profit</em>, Harvard Business Review, 1992). Two properties are
        worth committing to memory:
      </p>
      <ol>
        <li>
          <strong>It is always ≥ the famous table.</strong> The difference{' '}
          <code>d(1 − gm) ÷ ((gm − d)(1 − d))</code> is positive whenever the product costs anything
          to make — equal only at <code>gm = 100%</code>. At the default scenario the floor says
          +{pct(EX.revenueNeutralUpliftPct, 1)} and reality says{' '}
          <strong>+{pct(EX.profitNeutralUpliftPct ?? 0, 1)}</strong> —{' '}
          {numFmt((EX.profitNeutralUpliftPct ?? 0) / EX.revenueNeutralUpliftPct, 1)}× the quoted
          number.
        </li>
        <li>
          <strong>It explodes at <code>d = gm</code>.</strong> The denominator is the margin you
          have left. A discount equal to your full gross margin leaves a zero unit margin — every
          sale is free labor — and no volume multiplier multiplies zero back into profit. Deeper
          than that, each sale actively loses money. That vertical asymptote is why the margin
          column below fills with &ldquo;—&rdquo; toward the bottom-right: those cells have no
          answer at any volume.
        </li>
      </ol>
      <table>
        <thead>
          <tr>
            <th>Gross margin</th>
            {TIER_DISCOUNTS.map((d) => (
              <th key={d}>{pct(d, 0)} off</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {TIERS.map((row) => (
            <tr key={row.gmPct}>
              <td>{pct(row.gmPct, 0)}</td>
              {row.uplifts.map((u, i) => (
                <td key={i} className={u === null ? 'text-slate-400 dark:text-slate-500' : ''}>
                  {u === null ? 'no volume' : `+${pct(u, 0)}`}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-xs text-slate-500 dark:text-slate-400">
        Computed at build time by the same engine that powers the widget — each cell is{' '}
        <code>d ÷ (gm − d)</code> exactly. Read the 40%-margin row against a 20% cut: sales must
        double. That single cell explains more retail failures than any marketing theorem.
      </p>

      <h2 id="worked-example">Worked example: 20% off, line by line</h2>
      <p>
        The calculator&apos;s default scenario — a {usd(PRESET.inputs.price, 0)} product with{' '}
        {usd(PRESET.inputs.unitCost, 0)} of landed per-unit cost, {numFmt(PRESET.inputs.volume, 0)}{' '}
        units sold per month at list — with a {pct(PRESET.inputs.discountPct, 0)} discount applied.
        Gross margin: <strong>{pct(EX.baseGrossMarginPct ?? 0, 1)}</strong>.
      </p>
      <table>
        <thead>
          <tr>
            <th>Line</th>
            <th>List price</th>
            <th>20% off, +{pct(25, 0)} response</th>
            <th>20% off, +{pct(EX.profitNeutralUpliftPct ?? 0, 1)} response</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Price per unit</td>
            <td>{usd(PRESET.inputs.price)}</td>
            <td>{usd(EX.discountedPrice)}</td>
            <td>{usd(EX.discountedPrice)}</td>
          </tr>
          <tr>
            <td>Unit margin</td>
            <td>{usd(EX.baseUnitMargin)}</td>
            <td>{usd(EX.discountedUnitMargin)}</td>
            <td>{usd(EX.discountedUnitMargin)}</td>
          </tr>
          <tr>
            <td>Units / mo</td>
            <td>{numFmt(PRESET.inputs.volume, 0)}</td>
            <td>{numFmt(PRESET.inputs.volume * 1.25, 0)}</td>
            <td>{numFmt(EX.breakEvenVolume ?? 0, 1)}</td>
          </tr>
          <tr>
            <td>Revenue / mo</td>
            <td>{usd(EX.baseRevenue, 0)}</td>
            <td>{usd(EX.discountedPrice * PRESET.inputs.volume * 1.25, 0)}</td>
            <td>{usd(EX.discountedPrice * (EX.breakEvenVolume ?? 0), 0)}</td>
          </tr>
          <tr>
            <td><strong>Gross profit / mo</strong></td>
            <td><strong>{usd(EX.baseGrossProfit, 0)}</strong></td>
            <td><strong>{usd(AT_FAMOUS, 0)}</strong></td>
            <td><strong>{usd(AT_BE ?? 0, 0)}</strong></td>
          </tr>
          <tr>
            <td>Profit change</td>
            <td>—</td>
            <td className="text-rose-600 dark:text-rose-400">−{usd(Math.abs(AT_FAMOUS_DELTA), 0)}</td>
            <td>0 (by construction)</td>
          </tr>
        </tbody>
      </table>
      <p>
        The middle column is the trap. +25% is the famous-table answer for a 20% cut, and it still
        leaves the business <strong>{usd(Math.abs(AT_FAMOUS_DELTA), 0)}/month poorer</strong> —
        because {pct(EX.unitMarginErosionPct ?? 0, 1)} of each unit&apos;s margin was destroyed
        ({usd(EX.baseUnitMargin)} fell to {usd(EX.discountedUnitMargin)}), and a quarter again as
        many sales only recovered part of it. The right-hand column is what the promotion actually
        requires: <strong>+{pct(EX.profitNeutralUpliftPct ?? 0, 1)}%</strong> —{' '}
        {numFmt(EX.breakEvenVolume ?? 0, 1)} units a month, every month the discount runs, just to
        tie. Every point of response beyond that is the promotion&apos;s entire return.
      </p>
      <p>
        Fixed costs never entered the arithmetic, on purpose: they are identical with and without
        the discount, so they cancel out of the hold-profit-flat condition. Where they do not cancel
        is the question &ldquo;does this volume even cover the overhead&rdquo; — that is the{' '}
        <a href="/break-even-calculator/">break-even instrument</a>&apos;s job, and the two tools
        agree because they run the same unit economics.
      </p>

      <h2 id="psychology">The psychology of discounting</h2>
      <p>
        The arithmetic above is the cost side. The demand side has its own literature, and three
        findings from it shape every pricing decision:
      </p>
      <ul>
        <li>
          <strong>Prices become reference points.</strong> Behavioral pricing research models
          buyers as judging today&apos;s price against a <em>reference price</em> built from the
          prices they have seen (Winer, &ldquo;A Reference Price Model of Brand Choice&rdquo;,
          Journal of Consumer Research, 1986). A discount does not just cut this sale&apos;s margin
          — it enters the average the customer will judge every future price against. Run 20% off
          often enough and the list price reads as a 25% markup, not a price.
        </li>
        <li>
          <strong>Losses loom larger than gains.</strong> Prospect theory (Kahneman &amp; Tversky,
          <em>Econometrica</em>, 1979) found losses weigh roughly twice as much as equivalent gains.
          Ending a discount is priced by the customer as a loss, not as a return to normal — which
          is why &ldquo;temporary&rdquo; discounts are so hard to take back, and why the exit plan
          belongs in the launch plan.
        </li>
        <li>
          <strong>Buyers shop the deal, not just the product.</strong> Mental accounting
          (Thaler, <em>Marketing Science</em>, 1985) separates acquisition utility from transaction
          utility — the pleasure of the discount itself. It is real purchase motivation, and it is
          exactly why discounts work short-term while training customers to wait for them
          long-term: the deal-prone segment learns to time purchases to the promotion calendar.
        </li>
      </ul>
      <p>
        None of this says &ldquo;never discount.&rdquo; It says the sticker cost of a discount is
        only the down payment: add the arithmetic of the margin layer, plus the slow re-anchoring of
        the reference price, plus the timing shift of deal-waiters. The rational cases below are the
        ones where that full stack still clears.
      </p>

      <h2 id="rational">When a discount is the rational tool</h2>
      <p>
        Four situations survive the full-cost test. In each, the reason is structural, not
        hopeful — the math of the margin layer genuinely softens, or the discount buys something
        the list price cannot.
      </p>
      <ol>
        <li>
          <strong>Near-zero marginal cost with perishable capacity.</strong> Software seats, seats
          on a departing plane, tonight&apos;s hotel rooms: the {pct(100, 0)}-margin world where the
          famous table <em>is</em> the profit table. The SaaS archetype here runs at{' '}
          {pct(SAAS_EX.baseGrossMarginPct ?? 0, 1)} gross margin, so a {pct(SAAS.inputs.discountPct, 0)}{' '}
          cut needs &ldquo;only&rdquo; +{pct(SAAS_EX.profitNeutralUpliftPct ?? 0, 1)} volume —
          against +{pct(EX.profitNeutralUpliftPct ?? 0, 1)} for the {pct(EX.baseGrossMarginPct ?? 0, 1)}-margin
          product. And the unsold unit expires worthless tomorrow, so the alternative to a
          discounted sale is often no sale.
        </li>
        <li>
          <strong>Measured acquisition, priced like CAC.</strong> A discount that wins new customers
          is an acquisition cost — but the bookkeeping must match the fence. The default
          scenario&apos;s sitewide {pct(PRESET.inputs.discountPct, 0)} concedes {usd(ACQ_PER_UNIT)} on{' '}
          <em>every</em> unit — {usd(ACQ_TOTAL, 0)} in total across the {numFmt(ACQ_UNITS, 0)} units
          sold at the promoted price, existing customers included — which against its{' '}
          +{pct(PRESET.expectedUpliftPct, 0)} response works out to {usd(ACQ_PER_NEW, 0)} per
          incremental unit. A fenced first-order discount of the same{' '}
          {pct(PRESET.inputs.discountPct, 0)} concedes only {usd(ACQ_PER_UNIT, 0)} per genuinely new
          customer: the fence, not the percentage, is what turns a promotion into a CAC line item.
          Either way the discipline is identical — rational when the figure undercuts the channel it
          replaces and the customer&apos;s lifetime value carries it; book it as spend and compare,
          never call it revenue. Even the worst case is bounded: one month at zero incremental
          response costs {usd(Math.abs(ACQ_UPFRONT), 0)} (the full margin surrendered on existing
          volume), which is a budget line, not a catastrophe.
        </li>
        <li>
          <strong>Fenced price discrimination.</strong> Student pricing, new-customer coupons,
          quantity breaks, off-peak rates: charge the price-sensitive segment less{' '}
          <em>without republishing the price</em>. The fence keeps the list-price anchor intact for
          everyone else — the whole point of the coupon mechanics in the next section. An unfenced
          sitewide sale is the opposite: maximum re-anchoring for minimum segmentation.
        </li>
        <li>
          <strong>Clearing perishable or end-of-life stock.</strong> Once the unit is built (or the
          season is over), its cost is sunk; the comparison is not &ldquo;price versus cost&rdquo;
          but &ldquo;price versus what the inventory is worth on the shelf next quarter.&rdquo; Any
          clearing price above storage and scrap value beats holding — this is the one case where
          selling below full margin is the profit-maximizing move, and it is a liquidation decision,
          not a pricing strategy.
        </li>
      </ol>
      <p>
        The through-line: discount when the marginal cost of the discounted unit is near zero, or
        when the discount is explicitly buying something measurable (a customer, a fence, floor
        space) at a price you would pay in cash. Discount as a vague demand lever — &ldquo;let&apos;s
        run a sale and see&rdquo; — is the case the margin table exists to kill. And for a
        services business, the same erosion arithmetic applies to your own rate: the{' '}
        <a href="/freelance-hourly-rate-calculator/">hourly-rate instrument</a> exists to price
        your floor <em>before</em> a client asks for a &ldquo;small&rdquo; break.
      </p>

      <h2 id="coupon-math">&ldquo;Spend X, save Y&rdquo;: coupon vs straight discount</h2>
      <p>
        A threshold coupon looks like a percentage discount wearing a costume. &ldquo;$15 off when
        you spend $100&rdquo; is a {pct(COUPON.faceRatePct, 0)} discount —{' '}
        <em>at a basket of exactly $100</em>. Set the two final prices equal,
        <code> B − Y = B(1 − d)</code>, and the equivalence condition falls out:{' '}
        <strong><code>B* = Y ÷ d</code></strong> — the crossover basket. Below it the coupon (once
        triggered) gives the buyer more off; above it, the blanket percentage does.
      </p>
      <table>
        <thead>
          <tr>
            <th>On a basket of…</th>
            <th>Coupon: $15 off $100</th>
            <th>Blanket 15% off</th>
            <th>Who gives up more margin</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>{usd(100, 0)} (exactly at T)</td>
            <td>{pct(COUPON_AT_T.effectiveRatePct, 1)} effective</td>
            <td>{pct(15, 0)}</td>
            <td>tie — both {usd(15, 0)}</td>
          </tr>
          <tr>
            <td>{usd(250, 0)}</td>
            <td>{pct(COUPON.effectiveRatePct, 1)} effective</td>
            <td>{pct(15, 0)}</td>
            <td>blanket, by {usd(Math.abs(COUPON.savingsDifference), 0)}</td>
          </tr>
          <tr>
            <td>{usd(400, 0)}</td>
            <td>{pct(COUPON_BIG.effectiveRatePct, 1)} effective</td>
            <td>{pct(15, 0)}</td>
            <td>blanket, by {usd(Math.abs(COUPON_BIG.savingsDifference), 0)}</td>
          </tr>
        </tbody>
      </table>
      <p>
        The seller&apos;s exposure under the coupon is <strong>capped at {usd(15, 0)}</strong> per
        order no matter how large the basket grows, while the blanket {pct(15, 0)} keeps scaling —
        the crossover for this pair sits at {usd(COUPON.crossOverBasket ?? 0, 0)}, so every
        triggered basket above it makes the coupon the cheaper promotion to run. That cap is one
        half of why thresholds are the dominant promo format; the other half is on the demand side:
        the threshold is a fence that lifts baskets, because a {usd(85, 0)} cart is{' '}
        {usd(15, 0)} of merchandise away from saving {usd(15, 0)} — customers add the item to cross
        it. The calculator&apos;s coupon panel runs all of these numbers on your own threshold,
        amount, and basket.
      </p>
      <p>
        One discipline transfers directly from the margin layer: the face rate{' '}
        <code>Y ÷ T</code> is a straight discount of exactly that size at the threshold, so it must
        clear the same test — a &ldquo;{pct(COUPON.faceRatePct, 0)}&rdquo; coupon run by a business
        with {pct(15, 0)} gross margin is giving away the entire margin on threshold-sized baskets.
        Fences concentrate the damage; they do not repeal the arithmetic.
      </p>

      <h2 id="guardrails">The pre-flight checklist</h2>
      <p>
        Six checks, in order, before any discount goes live. The first three are arithmetic the
        calculator does for you; the last three are judgment it can only frame.
      </p>
      <ul className="mt-3 list-none space-y-2.5">
        {[
          `Compute the real requirement: d ÷ (gm − d) at your own margin — not the revenue floor. At the default scenario that is +${pct(EX.profitNeutralUpliftPct ?? 0, 1)} volume, not +${pct(EX.revenueNeutralUpliftPct, 0)}.`,
          'Sanity-check the response against evidence, not hope: can the channel plausibly deliver the required uplift for the whole promo window? A one-week spike that decays does not clear a standing requirement.',
          'Check the margin floor: keep d comfortably below gm, and remember the discounted unit margin P(gm − d) must still carry its share of fixed costs — re-run the break-even instrument at the discounted price if the promo is long-lived.',
          'Price the exit before the entry: how does the price return to list without registering as a loss? Fenced, dated, reason-based discounts (a launch, a clearance, a loyalty tier) exit cleanly; open-ended percentage-offs do not.',
          'Segment, don\'t blanket: every dollar of discount given to a customer who would have paid list is pure margin transfer. Coupons, thresholds, and new-customer fences confine the same face-value discount to the price-sensitive edge.',
          'Watch cannibalization: the model counts incremental units. If the +25% "response" is mostly existing buyers timing purchases they would have made anyway, the true uplift is lower and the ledger above turns redder accordingly.',
        ].map((item) => (
          <li key={item} className="flex items-start gap-2.5 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
            <span
              aria-hidden="true"
              className="mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded border border-slate-300 text-[10px] font-bold text-slate-400 dark:border-white/20 dark:text-slate-500"
            >
              ✓
            </span>
            <span>{item}</span>
          </li>
        ))}
      </ul>

      <h2 id="glossary">Glossary</h2>
      <dl className="mb-6 mt-2 space-y-5 rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 dark:border-white/[0.08] dark:bg-slate-900/60">
        <div>
          <dt className="font-semibold text-slate-900 dark:text-slate-100">Gross margin (gm)</dt>
          <dd className="mt-1 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
            (Price − variable unit cost) ÷ price — the share of each sale that is margin. The
            denominator of the required-uplift formula: the discount is subtracted from this, not
            from the price.
          </dd>
        </div>
        <div>
          <dt className="font-semibold text-slate-900 dark:text-slate-100">Revenue-neutral uplift</dt>
          <dd className="mt-1 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
            d ÷ (1 − d): the volume increase that holds revenue flat — 20% off needs +25%. Preserves
            profit only when unit cost is zero; the number marketing quotes.
          </dd>
        </div>
        <div>
          <dt className="font-semibold text-slate-900 dark:text-slate-100">Profit-neutral uplift</dt>
          <dd className="mt-1 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
            d ÷ (gm − d): the volume increase that holds gross profit flat. Always the larger of the
            two when the product has cost; undefined once d ≥ gm because no volume multiplies a
            zero margin back into profit.
          </dd>
        </div>
        <div>
          <dt className="font-semibold text-slate-900 dark:text-slate-100">Reference price</dt>
          <dd className="mt-1 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
            The price a buyer expects to pay, built from prices they have already seen. Discounts
            lower it, and a lowered reference makes the eventual return to list price feel like a
            price increase.
          </dd>
        </div>
        <div>
          <dt className="font-semibold text-slate-900 dark:text-slate-100">Fenced discount</dt>
          <dd className="mt-1 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
            A discount available only across a barrier — a coupon, a spend threshold, a customer
            segment, a time window. Fences let the price-sensitive segment pay less without
            republishing the price everyone else anchors on.
          </dd>
        </div>
        <div>
          <dt className="font-semibold text-slate-900 dark:text-slate-100">Face rate vs effective rate</dt>
          <dd className="mt-1 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
            For a &ldquo;spend T, save Y&rdquo; coupon: face = Y ÷ T (the banner number), effective
            = Y ÷ basket (what the buyer actually gets). Equal only at a basket of exactly T; the
            effective rate shrinks as the basket grows while the seller&apos;s cost stays capped at Y.
          </dd>
        </div>
      </dl>

      <Faq
        items={[
          {
            question: 'How much more volume does a 20% discount need to pay for itself?',
            answer: (
              <p>
                +{pct(revenueNeutralUpliftPct(20), 1)} to hold <em>revenue</em> flat — but holding{' '}
                <em>profit</em> flat takes d ÷ (gm − d) at your gross margin. At a{' '}
                {pct(EX.baseGrossMarginPct ?? 0, 1)} margin that is +{pct(EX.profitNeutralUpliftPct ?? 0, 1)};
                at a 40% margin it is +100% — sales must double. The calculator prints both numbers
                side by side for your own inputs.
              </p>
            ),
          },
          {
            question: 'Is there a discount that no amount of volume can rescue?',
            answer: (
              <p>
                Yes: any discount at or beyond your full gross margin. The discounted unit margin is
                P(gm − d) — zero when d = gm, negative beyond it — and the required-uplift formula&apos;s
                denominator (gm − d) hits zero. More sales then add zero or negative margin. The
                calculator marks this state explicitly rather than printing an infinity.
              </p>
            ),
          },
          {
            question: 'Why does the calculator ask for my unit cost when the "rule" doesn\'t need it?',
            answer: (
              <p>
                Because the rule is the costless special case. 1 ÷ (1 − d) − 1 assumes every revenue
                dollar was margin. Enter a unit cost of $0 and the tool&apos;s headline collapses to
                exactly the famous table; enter a real cost and the requirement jumps to d ÷ (gm − d)
                — {numFmt((EX.profitNeutralUpliftPct ?? 0) / EX.revenueNeutralUpliftPct, 1)}× the
                quoted number at the default scenario.
              </p>
            ),
          },
          {
            question: 'Is a "spend $100, save $15" coupon better than 15% off?',
            answer: (
              <p>
                For the seller, at any basket above the threshold — yes, strictly cheaper, because
                the coupon&apos;s cost is capped at $15 while 15% scales with the basket. At exactly
                $100 they tie; below it the coupon does nothing at all. The trade-off is psychology:
                a blanket discount is simpler and re-anchors your list price for everyone, while the
                threshold adds fence friction but nudges baskets toward the line.
              </p>
            ),
          },
          {
            question: 'How should I set the spend threshold on a coupon?',
            answer: (
              <p>
                Two constraints. Face discipline: Y ÷ T is a real discount of exactly that size at
                the threshold, so it must pass the same margin test as any straight cut (keep it
                well under gm). Basket design: set T above your typical order so the fence lifts
                baskets — but close enough that the add-one-more-item math feels like a win to the
                buyer. The coupon panel computes the effective rate and crossover basket for your
                own T, Y, and basket.
              </p>
            ),
          },
          {
            question: 'Do discounts permanently damage my pricing?',
            answer: (
              <p>
                They move the reference price — the anchor customers judge every future price
                against — and repeated promotions move it cumulatively. The practical consequence is
                not that discounting is forbidden but that its full cost includes the eventual
                climb back: promotions with a reason and an end date (launch, clearance, loyalty
                tier) re-anchor far less than open-ended sitewide percentages.
              </p>
            ),
          },
          {
            question: 'What about "get 2 months free" on an annual plan?',
            answer: (
              <p>
                Twelve months of service for ten months of price is a {pct(ANNUAL_D, 1)} effective
                discount — its revenue-only floor is +{pct(ANNUAL_FLOOR, 1)} volume (the
                famous-table answer for that depth), and at the SaaS archetype&apos;s{' '}
                {pct(SAAS_EX.baseGrossMarginPct ?? 0, 1)} margin the profit-neutral requirement is{' '}
                +{pct(ANNUAL_REAL ?? 0, 1)}. Two things soften it in practice: the customer is
                committing for twelve months (retention, not just response), and near-zero marginal
                cost means the famous table is nearly the true table — the one segment where the
                marketing number and the finance number almost agree.
              </p>
            ),
          },
          {
            question: 'Where do fixed costs and overhead come in?',
            answer: (
              <p>
                They cancel out of the hold-profit-flat comparison because they are the same with
                and without the discount. They matter for the follow-on question — does the
                discounted contribution still cover the overhead — which is exactly what the{' '}
                <a href="/break-even-calculator/">break-even calculator</a> answers: run it at the
                discounted price to see the volume the promotion really requires against your full
                cost structure.
              </p>
            ),
          },
          {
            question: 'Should a freelancer discount their hourly rate?',
            answer: (
              <p>
                The arithmetic is identical — your delivery cost per hour plays the role of unit
                cost, and a 10% rate cut at the service archetype&apos;s {pct(SVC_EX.baseGrossMarginPct ?? 0, 1)}{' '}
                margin needs +{pct(SVC_EX.profitNeutralUpliftPct ?? 0, 1)} billable hours to break
                even, not the +{pct(SVC_EX.revenueNeutralUpliftPct, 1)} the rule of thumb suggests.
                The added freelancer risk is anchoring: one client&apos;s &ldquo;special rate&rdquo;
                becomes the reference for every renewal. Price your floor first with the{' '}
                <a href="/freelance-hourly-rate-calculator/">hourly-rate calculator</a>, then decide
                what a discount is allowed to buy.
              </p>
            ),
          },
          {
            question: "Does a discount also reduce the payment processing fees I pay?",
            answer: (
              <p>
                Percentage-based fees shrink with the price, so the net erosion is a touch less than
                the face-value discount — but fixed per-transaction fees do not shrink at all, which
                cuts the other way on small orders. If fees are a meaningful share of your unit
                cost, the{' '}
                <a href="/stripe-fee-calculator/">Stripe fee calculator</a> prices both effects;
                feeding the fee-inclusive cost into this tool keeps the margin honest.
              </p>
            ),
          },
        ]}
      />

      <RelatedCalculators
        links={[
          { href: '/break-even-calculator/', label: 'Break-Even Calculator' },
          { href: '/freelance-hourly-rate-calculator/', label: 'Freelance Hourly Rate Calculator' },
          { href: '/stripe-fee-calculator/', label: 'Stripe Fee Calculator' },
        ]}
      />
    </article>
  );
}

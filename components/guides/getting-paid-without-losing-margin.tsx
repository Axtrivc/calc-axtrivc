import { ArticleToc } from '@/components/Article';
import { ACH_CAP_THRESHOLD, computeFee, monthlyVolume, reverseFromNet } from '@/lib/stripe';
import {
  breakevenDiscount,
  breakevenNetDays,
  carryingCost,
  cashLockedByTerms,
  computeLatePayment,
  discountImpliedAnnualized,
  evaluateEarlyPayDiscount,
  lateFeeAnnualized,
} from '@/lib/latefee';
import { profitNeutralUpliftPct } from '@/lib/discount';
import { pct, usd } from '@/lib/format';

/* Every number in this guide is computed at build time by the same engines the
   instruments run (lib/stripe, lib/latefee, lib/discount) — nothing is hand-typed. */

/* The running example: one $10,000 invoice on Net-30, a 10% cost of capital, a
   3% blended default rate, quoted and collected three different ways. */
const BASE = { invoiceAmount: 10000, netDays: 30, annualRatePct: 10, badDebtPct: 3 };
const base = computeLatePayment(BASE);

/* ---- Levy one: the payment rail ------------------------------------------ */
const MICRO = computeFee(10, 'domestic');
const HUNDRED = computeFee(100, 'domestic');
const THOUSAND = computeFee(1000, 'domestic');
const ACH_600 = computeFee(600, 'ach');
const ACH_AT_CAP = computeFee(ACH_CAP_THRESHOLD, 'ach');
const CARD_10K = computeFee(BASE.invoiceAmount, 'domestic');
const ACH_10K = computeFee(BASE.invoiceAmount, 'ach');
const RAIL_EDGE = CARD_10K.fee - ACH_10K.fee;
/* Small-ticket gaps — the friction-adjusted boundary discussion. */
const EDGE_200 = computeFee(200, 'domestic').fee - computeFee(200, 'ach').fee;
const EDGE_300 = computeFee(300, 'domestic').fee - computeFee(300, 'ach').fee;
const NET_10K_CARD = reverseFromNet(BASE.invoiceAmount, 'domestic');
const NET_10K_ACH = reverseFromNet(BASE.invoiceAmount, 'ach');

/* The volume model's default month: 40 card charges at $85, 5 international
   at $150, 3 ACH transfers at $1,200. */
const MIX = monthlyVolume([
  { type: 'domestic', count: 40, averageTicket: 85 },
  { type: 'international', count: 5, averageTicket: 150 },
  { type: 'ach', count: 3, averageTicket: 1200 },
]);
const MIX_OVER_FLOOR_SHARE = (MIX.achFloorSaving / MIX.totalFee) * 100;

/* ---- Levy two: the float -------------------------------------------------- */
const CARRY_15 = carryingCost(BASE.invoiceAmount, BASE.annualRatePct, 15);
const CARRY_60 = carryingCost(BASE.invoiceAmount, BASE.annualRatePct, 60);
const CARRY_90 = carryingCost(BASE.invoiceAmount, BASE.annualRatePct, 90);
const LOCKED_45 = cashLockedByTerms(600000, 45);
const LOCKED_60 = cashLockedByTerms(600000, 60);

/* ---- Levy three: the expected write-off ------------------------------------ */
const CASH_SALE = computeLatePayment({ ...BASE, netDays: 0 });

/* ---- Reverse pricing -------------------------------------------------------- */
const FACE_WHOLE = BASE.invoiceAmount * (1 + (base.priceUpliftPct ?? 0) / 100);
const CARD_QUOTE = reverseFromNet(FACE_WHOLE, 'domestic');
const ACH_QUOTE = reverseFromNet(FACE_WHOLE, 'ach');
const QUOTE_GAP = CARD_QUOTE.charge - ACH_QUOTE.charge;

/* ---- The 36.7% question ------------------------------------------------------ */
const CLASSIC365 = discountImpliedAnnualized(2, 10, 30);
const CLASSIC360 = discountImpliedAnnualized(2, 10, 30, 360);
const ONE_TEN = discountImpliedAnnualized(1, 10, 30);
const BE_DISC = breakevenDiscount(BASE.annualRatePct, 10, BASE.netDays);
const BE_DAYS = breakevenNetDays(2, 10, BASE.annualRatePct);
const OFFER_1 = evaluateEarlyPayDiscount({ ...BASE, badDebtPct: 1 }, 2, 10);
const OFFER_3 = evaluateEarlyPayDiscount(BASE, 2, 10);
const OFFER_5 = evaluateEarlyPayDiscount({ ...BASE, badDebtPct: 5 }, 2, 10);

/* ---- The stack-up ------------------------------------------------------------- */
/* Margin corner for the illustration: the $10,000 job costs $5,000 to deliver
   (50% gross margin). */
const GM = 50;
const GM_DOLLARS = BASE.invoiceAmount * (GM / 100);
const VOL_2 = profitNeutralUpliftPct(100, 100 - GM, 2);

const FEE_C = computeFee(OFFER_3.discounted.face, 'ach').fee;
const pathA = base.expectedReceipt - base.carryingCost - CARD_10K.fee;
const pathB = base.expectedReceipt - base.carryingCost - ACH_10K.fee;
const pathC = OFFER_3.discounted.expectedReceipt - OFFER_3.discounted.carryingCost - FEE_C;
const levyA = BASE.invoiceAmount - pathA;
const levyB = BASE.invoiceAmount - pathB;
const levyC = BASE.invoiceAmount - pathC;
const levyPctA = (levyA / BASE.invoiceAmount) * 100;
const levyPctB = (levyB / BASE.invoiceAmount) * 100;
const levyPctC = (levyC / BASE.invoiceAmount) * 100;
const gpShareA = (levyA / GM_DOLLARS) * 100;
const gpShareB = (levyB / GM_DOLLARS) * 100;
const gpShareC = (levyC / GM_DOLLARS) * 100;
const gmAfterA = GM * (1 - gpShareA / 100);
/* Every component of the levy scales with face, so the stack behaves exactly
   like a price cut of levy% — and the discount engine prices the volume each
   path must buy to stand still. */
const VOL_A = profitNeutralUpliftPct(100, 100 - GM, levyPctA);
const VOL_B = profitNeutralUpliftPct(100, 100 - GM, levyPctB);
const VOL_C = profitNeutralUpliftPct(100, 100 - GM, levyPctC);

/* ---- Policy clauses -------------------------------------------------------------- */
const LATE_SIMPLE = lateFeeAnnualized(1.5);
const LATE_COMPOUND = lateFeeAnnualized(1.5, true);

export default function GettingPaidWithoutLosingMargin() {
  const toc = [
    { id: 'three-levies', label: 'The three levies on an invoiced dollar' },
    { id: 'rail', label: 'Levy one: the payment rail' },
    { id: 'float', label: 'Levy two: the float' },
    { id: 'write-off', label: 'Levy three: the expected write-off' },
    { id: 'reverse', label: 'Reverse pricing: quoting the invoice whole' },
    { id: 'early-pay', label: 'The 36.7% question' },
    { id: 'stack', label: 'The stack-up: a true-margin template' },
    { id: 'policy', label: 'The payment policy on one page' },
    { id: 'limits', label: 'Where this model ends' },
  ];

  return (
    <>
      <ArticleToc items={toc} />

      <h2 id="three-levies">The three levies on an invoiced dollar</h2>
      <p>
        A dollar invoiced is not a dollar received. Between the invoice and your bank
        account sit three levies, each with its own arithmetic and its own lever: the{' '}
        <strong>rail fee</strong> (a function of ticket size and payment method), the{' '}
        <strong>float</strong> (a function of days outstanding and your cost of capital),
        and the <strong>expected write-off</strong> (a function of customer quality). On
        the example this guide runs end to end — a {usd(BASE.invoiceAmount, 0)} invoice
        on Net-{BASE.netDays}, a {pct(BASE.annualRatePct, 0)} cost of capital, a{' '}
        {pct(BASE.badDebtPct, 0)} blended default rate, paid by domestic card — the three
        levies total <strong>{usd(levyA)}</strong>, or {pct(levyPctA, 1)} of face:{' '}
        {usd(CARD_10K.fee)} to the processor, {usd(base.carryingCost)} of carrying cost,{' '}
        {usd(base.badDebtLoss, 0)} of expected default. The same invoice collected by
        bank debit, with a 2/10 early-pay term attached and taken, costs {usd(levyC)} —{' '}
        {pct(levyPctC, 1)}. The entire {usd(levyA - levyC)} difference is policy, not
        luck.
      </p>
      <p>
        The framework, stated once up front: <strong>(1)</strong> match the payment rail
        to the ticket — cards for small charges, bank debit by default on large ones,
        with an operational line set just under the {usd(ACH_CAP_THRESHOLD, 0)} arithmetic
        boundary where the debit cap engages;{' '}
        <strong>(2)</strong> price the payment window as what it is, an interest-free
        loan to your customer at your cost of capital; <strong>(3)</strong> treat default
        risk as a per-invoice expectation charged across the book, and manage it with
        screening rather than hope; <strong>(4)</strong> gross the whole stack up into
        the quoted price — or decide consciously not to, as a pricing decision. The rest
        of this guide is those four sentences with the arithmetic attached, and it ends
        with a one-page payment policy. The{' '}
        <a href="/stripe-fee-calculator/">Stripe fee calculator</a>,{' '}
        <a href="/late-payment-cost-calculator/">late-payment cost calculator</a>, and{' '}
        <a href="/discount-impact-calculator/">discount impact calculator</a> run each
        piece on your own numbers.
      </p>

      <h2 id="rail">Levy one: the payment rail</h2>
      <p>
        Processing fees have two components — a percentage of the charge and a fixed fee
        — and the fixed component makes the <em>effective</em> rate a curve rather than a
        number. At the standard US domestic-card rate of 2.9% + $0.30, a {usd(10, 0)}{' '}
        charge costs {usd(MICRO.fee)}: an effective rate of {pct(MICRO.effectiveRate, 2)},
        double the headline. At {usd(100, 0)} the rate is {pct(HUNDRED.effectiveRate, 2)};
        at {usd(1000, 0)}, {pct(THOUSAND.effectiveRate, 2)}. The fixed thirty cents decays
        like <code>$0.30 ÷ ticket</code>, so small tickets are structurally the worst
        business to collect on cards — which is why subscription companies bundle
        micro-charges into monthly invoices, and why a card-heavy small-ticket book
        bleeds margin it never sees itemized.
      </p>
      <p>
        The counterweight is the bank-debit rail. ACH direct debit prices at 0.8% with no
        fixed fee, capped at $5.00 — and the cap engages at exactly{' '}
        {usd(ACH_CAP_THRESHOLD, 0)} ({usd(5, 0)} ÷ 0.8%). Below the boundary a{' '}
        {usd(600, 0)} debit costs {usd(ACH_600.fee)} ({pct(ACH_600.effectiveRate, 2)}); at{' '}
        {usd(ACH_CAP_THRESHOLD, 0)} it costs exactly {usd(ACH_AT_CAP.fee)}; above it,
        every additional dollar of invoice rides free. On the{' '}
        {usd(BASE.invoiceAmount, 0)} running example the card costs {usd(CARD_10K.fee)}
        while the debit costs {usd(ACH_10K.fee)} — an effective rate of{' '}
        {pct(ACH_10K.effectiveRate, 2)}. The {usd(RAIL_EDGE)} difference is the cheapest
        margin recovery available anywhere in this guide, and it requires no negotiation
        with anyone: you change the payment link you send.
      </p>
      <p>
        Honesty about the boundary: bank debit is not strictly dominant. It settles
        slower than a card charge, it pulls from US bank accounts only, and a returned
        transfer is possible — costs the raw arithmetic does not price. The fee edge
        itself is real at any size — {usd(EDGE_200)} at a {usd(200, 0)} invoice,{' '}
        {usd(EDGE_300)} at {usd(300, 0)} — but at small tickets it rarely outweighs that
        friction, and the customer&apos;s card habit is worth more than the spread. The
        rule that survives contact with reality: <strong>card by default on small
        tickets, bank debit by default on large ones</strong> — put the debit link first
        on any invoice above roughly {usd(500, 0)}. That operational line sits
        deliberately below the {usd(ACH_CAP_THRESHOLD, 0)} arithmetic boundary, leaving
        a margin of safety for the settlement speed and return risk the fee table does
        not price; treat the card as the fallback on large invoices rather than the
        reverse.
      </p>
      <p>
        Two refinements make the rail policy operational. First, reverse pricing: to{' '}
        <em>net</em> {usd(BASE.invoiceAmount, 0)} after fees, a card charge must read{' '}
        {usd(NET_10K_CARD.charge)} (fee {usd(NET_10K_CARD.fee)}), while a bank debit
        needs only {usd(NET_10K_ACH.charge, 0)} — the cap holds its fee at {usd(5, 0)}.
        Whoever picks the rail picks who writes the smaller check, and quoting the
        net rather than the guess is what &ldquo;passing the fee along&rdquo; means
        arithmetically. Second, the monthly view: a month of 40 domestic card charges
        averaging {usd(85, 0)}, 5 international charges averaging {usd(150, 0)}, and 3
        bank debits averaging {usd(1200, 0)} runs {usd(MIX.totalVolume, 0)} across{' '}
        {MIX.transactionCount} payments for {usd(MIX.totalFee)} in fees — a blended rate
        of {pct(MIX.blendedRate, 2)}. The identical month collected entirely by bank
        debit would cost {usd(MIX.achFloorFee ?? 0)}, so this ordinary mix runs{' '}
        {usd(MIX.achFloorSaving)} a month over the floor: {usd(MIX.achFloorSaving * 12, 0)}{' '}
        a year, and {pct(MIX_OVER_FLOOR_SHARE, 1)} of the entire fee bill. No single
        transaction looks alarming; only the blend reveals the policy gap.
      </p>

      <h2 id="float">Levy two: the float</h2>
      <p>
        The second levy is the time value of cash you are owed but cannot use:{' '}
        <code>carry = A × r × days ÷ 365</code>. You are owed <em>A</em> for <em>days</em>;
        money costs you <em>r</em> a year; you are financing the customer for that
        fraction of a year. On the running invoice that is {usd(BASE.invoiceAmount, 0)} ×{' '}
        {pct(BASE.annualRatePct, 0)} × {BASE.netDays} ÷ 365 ={' '}
        <strong>{usd(base.carryingCost)}</strong> — or, in the more useful form,{' '}
        <strong>{usd(base.dailyCarryingCost)} per day</strong> of waiting. Every day a
        reminder email sits unsent has a price, and it is this one. The cost is linear in
        the window: the same invoice carries {usd(CARRY_15)} on Net-15, {usd(CARRY_60)} on
        Net-60, {usd(CARRY_90)} on Net-90.
      </p>
      <p>
        The input that deserves the most thought is <em>r</em>. The honest value is
        whatever your next marginal dollar actually costs: the APR on your credit line,
        the all-in factoring or merchant-advance rate if that is how you bridge, or, for
        a profitable and cash-rich business, an opportunity cost of capital. A business
        with no debt and idle cash still should not enter zero — idle cash has an
        opportunity price too, and the model is only as honest as the rate you feed it.
      </p>
      <p>
        The float also aggregates into a balance-sheet fact. At steady state, a business
        billing {usd(600000, 0)} a year on Net-45 has{' '}
        <strong>{usd(LOCKED_45, 0)}</strong> of its own money parked in receivables at
        all times; on Net-60, <strong>{usd(LOCKED_60, 0)}</strong>. When a customer asks
        to stretch terms by fifteen days, they are asking for an interest-free loan of{' '}
        {usd(LOCKED_60 - LOCKED_45, 0)} — a normal thing for businesses to ask of each
        other, and a normal thing to price. The lever runs in reverse too: shortening
        terms is one of the very few moves that releases cash without cutting an expense
        or raising a price.
      </p>

      <h2 id="write-off">Levy three: the expected write-off</h2>
      <p>
        The third levy is an expectation, not an interest charge:{' '}
        <code>E[loss] = A × P(default)</code>. At a {pct(BASE.badDebtPct, 0)} blended
        rate the running invoice carries {usd(base.badDebtLoss, 0)} of expected loss, and
        its expected realizable value is {usd(base.expectedReceipt, 0)}. The invoice you
        actually send either collects or it does not; the expectation is what the{' '}
        <em>book</em> pays to hold the average.
      </p>
      <p>
        Estimate the probability from your own ledger — dollars written off over a
        trailing year or two, divided by dollars billed in the same window — not from a
        feeling. A young book with zero write-offs has not proven zero risk; it has not
        lived long enough. And note the asymmetry that matters for policy: a{' '}
        {pct(BASE.badDebtPct, 0)} blend is typically 0% for most of the book and 100% for
        the one customer quietly failing. The expectation smooths that over; your credit
        decisions should not. Concentration — one name being a large share of open
        receivables — is the risk variable the per-invoice model deliberately leaves to
        you.
      </p>
      <p>
        One structural point, and it needs stating carefully, because the model reads
        default risk two ways depending on the question being asked. The blended
        probability you enter is measured <em>per invoice billed</em> — write-offs ÷
        billings — so the per-invoice readout charges the full{' '}
        {usd(base.badDebtLoss, 0)} at any payment window; on that reading, even a
        same-day sale still carries {usd(CASH_SALE.totalExpectedCost, 0)} of expected
        loss, because risk attaches to the customer and settling instantly does not make
        a failing customer good. But when the question is <em>marginal</em> — what does
        collecting on day 10 instead of day 30 actually buy? — the same probability is
        spread uniformly across the cycle, and the shorter window carries only its
        accrued share; the early-pay section prices that at{' '}
        {usd(OFFER_3.riskRelief, 0)} of relief on this invoice. The decision rule that
        survives both readings: <strong>speed discounts the risk; screening removes
        it</strong>. Acceleration sheds at most the unaccrued share of the expectation —
        {usd(OFFER_3.riskRelief, 0)} of the {usd(base.badDebtLoss, 0)} here — while the
        accrued share, and the whole line for that customer, moves only with who you
        bill: screening, credit checks, concentration caps, deposits. The next two
        sections are about speed and price; they stack on top of that selection, they do
        not substitute for it.
      </p>

      <h2 id="reverse">Reverse pricing: quoting the invoice whole</h2>
      <p>
        Once the levies are visible, the pricing question inverts: what should the
        invoice <em>say</em> so that its expected value equals the face you actually
        wanted? Work it in two steps, because the levies compound.
      </p>
      <p>
        <strong>Step one — gross up the terms.</strong> The running invoice&apos;s terms
        cost (float plus expected write-off) is {usd(base.totalExpectedCost)}, or{' '}
        {pct(base.totalCostPct ?? 0, 2)} of face. The uplift that restores expected value
        is <code>c ÷ (1 − c)</code> — not simply <em>c</em>, because the extra dollars
        you quote get clawed at the same cost share; solving{' '}
        <code>Q × (1 − c) = A</code> gives <strong>+{pct(base.priceUpliftPct ?? 0, 2)}</strong>.
        The face that is whole in expectation is therefore{' '}
        <strong>{usd(FACE_WHOLE)}</strong>.
      </p>
      <p>
        <strong>Step two — gross up the rail.</strong> If that face is collected on a
        card, the invoice must read <strong>{usd(CARD_QUOTE.charge)}</strong> to net the
        terms-whole face after {usd(CARD_QUOTE.fee)} of processing fees. The same
        collection by bank debit reads <strong>{usd(ACH_QUOTE.charge)}</strong> — the
        face plus the {usd(5, 0)} cap. The gap between the two quotes is{' '}
        {usd(QUOTE_GAP)}, and it is the price of the customer&apos;s card convenience,
        made visible. Where card surcharges are permitted — network rules and local law
        vary by jurisdiction, so confirm yours before baking one in — this is the
        arithmetic a surcharge must recover. Where they are not, send both payment
        links; the customer&apos;s choice reveals how much they value the card, and
        either way your net is the same.
      </p>
      <p>
        A caution before you gross everything up: an uplift is a price increase, and
        customers read prices. The disciplined use of step one is not to reprice every
        invoice to the fourth decimal — it is to know what Net-{BASE.netDays} at{' '}
        {pct(BASE.badDebtPct, 0)} risk actually costs you ({pct(base.totalCostPct ?? 0, 2)}{' '}
        of face, {usd(base.totalExpectedCost)} here), and then to decide per customer:
        absorb it for the strategic account, recover it from the transactional one.
        Subsidies you grant knowingly are pricing; subsidies you never priced are
        leakage.
      </p>

      <h2 id="early-pay">The 36.7% question</h2>
      <p>
        &ldquo;2/10 net 30&rdquo; means: take 2% off if you pay within 10 days, otherwise
        the full amount in 30. The number most textbooks print for these terms —{' '}
        <strong>{pct(CLASSIC360 ?? 0, 2)}</strong> annualized — is derived, not
        legislated. As the <strong>buyer</strong>, taking the terms means spending 98 to
        retire a 100 obligation twenty days early: the 2 you save is the return on the 98
        you parted with twenty days sooner. The per-period return is{' '}
        <code>2 ÷ 98 = {pct((2 / 98) * 100, 2)}</code>, and there are{' '}
        <code>365 ÷ 20 = 18.25</code> such periods in a year:
      </p>
      <p>
        <code>
          i = (2 ÷ 98) × (365 ÷ 20) = {pct(CLASSIC365 ?? 0, 2)} a year
        </code>
      </p>
      <p>
        The textbook&apos;s {pct(CLASSIC360 ?? 0, 1)} is the same arithmetic on the
        360-day banker&apos;s year — a day-count convention, nothing more. The buyer&apos;s
        rule follows immediately: a near-risk-free {pct(CLASSIC365 ?? 0, 1)} return beats
        every plausible cost of capital, so <strong>take the discount</strong> unless
        your cash is genuinely more expensive than that. The thinner 1/10 net 30 implies
        only {pct(ONE_TEN ?? 0, 1)} — take that one only if your capital costs more.
      </p>
      <p>
        The <strong>seller&apos;s</strong> question reads the same rate from the other
        side, and there the {pct(CLASSIC365 ?? 0, 1)} is a price you pay to accelerate
        cash. Priced at your own money: at a {pct(BASE.annualRatePct, 0)} cost of capital
        with a 10-day window on Net-{BASE.netDays}, the discount that is exactly fair is{' '}
        <strong>{pct(BE_DISC ?? 0, 2)}</strong> — call it 0.5/10 net 30. Run the boundary
        the other way and 2/10 becomes fair only when the net term stretches to{' '}
        Net-{Math.round(BE_DAYS ?? 0)}: on Net-30, you are paying a{' '}
        {pct(CLASSIC365 ?? 0, 1)} implied rate for money that costs you{' '}
        {pct(BASE.annualRatePct, 0)}. On pure financing grounds, nobody holding this
        guide&apos;s running example should offer 2/10.
      </p>
      <p>
        What justifies it instead is <em>risk</em>, and the expected-value comparison
        makes that precise. Offering 2/10 on the running invoice ({pct(3, 0)} default
        rate) surrenders {usd(OFFER_3.faceGivenUp, 0)} of face and buys back{' '}
        {usd(OFFER_3.riskRelief, 0)} of default expectation — the exposure window shrinks
        from 30 days to 10, with risk accruing uniformly over it — plus{' '}
        {usd(OFFER_3.carryingRelief)} of carrying cost. Net:{' '}
        <strong>+{usd(OFFER_3.netAdvantage)}</strong> per invoice. On a cleaner book the
        same offer loses {usd(Math.abs(OFFER_1.netAdvantage))} at a {pct(1, 0)} default
        rate; on a
        shakier one it wins {usd(OFFER_5.netAdvantage, 0)} at {pct(5, 0)}. The lesson is
        exact: a 2% early-pay discount is <strong>insurance priced by default risk</strong>,
        not a financing decision. Grant it deliberately on accounts where the write-off
        line is real; do not blanket the book with it.
      </p>
      <p>
        The margin instrument adds the volume frame: at a {pct(GM, 0)} gross margin, a
        2% give-back is a price cut that must buy{' '}
        <strong>+{pct(VOL_2 ?? 0, 2)} volume</strong> to hold profit flat. The relief the
        discount actually buys on this book — {usd(OFFER_3.netAdvantage)} against{' '}
        {usd(OFFER_3.faceGivenUp, 0)} of face surrendered — is smaller than the give-back
        until default risk is elevated, which is the same conclusion from a second
        direction: design discounts
        at the boundary ({pct(BE_DISC ?? 0, 2)}), reserve the rich ones for risky
        accounts, and never grant 2/10 because everyone else does.
      </p>

      <h2 id="stack">The stack-up: a true-margin template</h2>
      <p>
        The three levies stack on the same invoice, so the honest readout is one
        template — printed in two forms, because an early-pay discount changes what the
        invoice <em>is</em>, not just when it settles. For an invoice of face{' '}
        <em>A</em>, default probability <em>p</em>, annual capital rate <em>r</em>, net
        term <em>N</em> days, rail fee <code>fee(·, rail)</code>, and — where a
        discount <em>d</em> is on offer — discount window <em>D</em> days:
      </p>
      <p>
        <code>
          settled at the net term: realizable = A(1 − p) − A × r × N ÷ 365 − fee(A,
          rail)
        </code>
      </p>
      <p>
        <code>
          early-pay taken: realizable = A(1 − d)(1 − p × D ÷ N) − A(1 − d) × r × D ÷ 365
          − fee(A(1 − d), rail)
        </code>
      </p>
      <p>
        The second line is the first with the two substitutions the discount forces:
        billing, fees and carrying cost all move to the discounted face, and default
        accrues only over the shortened window (<code>p × D ÷ N</code> — the uniform
        convention from the write-off section). Rows A and B below follow the first
        line, row C the second, each to the cent.
      </p>
      <table>
        <thead>
          <tr>
            <th>Collection path</th>
            <th>Rail fee</th>
            <th>Discount given</th>
            <th>Carrying cost</th>
            <th>Expected write-off</th>
            <th>Realizable value</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><strong>A.</strong> Card on file, paid day 30</td>
            <td>{usd(CARD_10K.fee)}</td>
            <td>{usd(0, 0)}</td>
            <td>{usd(base.carryingCost)}</td>
            <td>{usd(base.badDebtLoss, 0)}</td>
            <td><strong>{usd(pathA)}</strong></td>
          </tr>
          <tr>
            <td><strong>B.</strong> Bank debit, paid day 30</td>
            <td>{usd(ACH_10K.fee)}</td>
            <td>{usd(0, 0)}</td>
            <td>{usd(base.carryingCost)}</td>
            <td>{usd(base.badDebtLoss, 0)}</td>
            <td><strong>{usd(pathB)}</strong></td>
          </tr>
          <tr>
            <td><strong>C.</strong> Bank debit, 2/10 taken day 10</td>
            <td>{usd(FEE_C)}</td>
            <td>{usd(OFFER_3.faceGivenUp, 0)}</td>
            <td>{usd(OFFER_3.discounted.carryingCost)}</td>
            <td>{usd(OFFER_3.discounted.face - OFFER_3.discounted.expectedReceipt)}</td>
            <td><strong>{usd(pathC)}</strong></td>
          </tr>
        </tbody>
      </table>
      <p>
        Each row&apos;s columns sum to the face, so the &ldquo;realizable value&rdquo;
        column is the invoice&apos;s true worth. The rail switch alone (A to B) recovers{' '}
        {usd(pathB - pathA)} per invoice; adding the risk-priced early-pay term (B to C)
        recovers another {usd(pathC - pathB)}. Note what path C does <em>not</em> fix: the
        write-off line falls from {usd(base.badDebtLoss, 0)} to{' '}
        {usd(OFFER_3.discounted.face - OFFER_3.discounted.expectedReceipt, 0)} because
        the exposure window shrank — but the rail fee and the discount are real costs
        paid for that reduction, and at a {pct(1, 0)} default rate the same move would
        have been a net loss, per the previous section.
      </p>
      <p>
        Now the margin view. Suppose the {usd(BASE.invoiceAmount, 0)} job costs{' '}
        {usd(GM_DOLLARS, 0)} to deliver — a {pct(GM, 0)} gross margin. Path A&apos;s levy
        of {usd(levyA)} eats <strong>{pct(gpShareA, 1)} of gross profit</strong>; the
        advertised 50% margin is really {pct(gmAfterA, 1)} of revenue. Path B eats{' '}
        {pct(gpShareB, 1)}; path C, {pct(gpShareC, 1)}. One more translation makes the
        stakes visceral: because every levy scales with face, the stack behaves exactly
        like a price cut you never decided to give — and the discount instrument prices
        what that cut must buy back. At {pct(GM, 0)} margin, path A is equivalent to a{' '}
        {pct(levyPctA, 1)} price cut, which would require{' '}
        <strong>+{pct(VOL_A ?? 0, 1)} volume</strong> to hold profit flat; path B,
        +{pct(VOL_B ?? 0, 1)}; path C, +{pct(VOL_C ?? 0, 1)}. The payment policy is worth
        roughly eight points of required volume before anyone sells a single extra unit —
        usually the largest &ldquo;discount&rdquo; a business runs, and the only one
        nobody approved.
      </p>

      <h2 id="policy">The payment policy on one page</h2>
      <ol>
        <li>
          <strong>Set rails by ticket size.</strong> Card by default below roughly{' '}
          {usd(500, 0)}; bank debit by default above it — the operational line sits just
          under the {usd(ACH_CAP_THRESHOLD, 0)} arithmetic boundary — with the debit link
          first on the invoice. Recheck the blend monthly — the difference between your
          blended rate and the all-debit floor ({usd(MIX.achFloorSaving)} in the sample
          month) is the policy&apos;s price tag.
        </li>
        <li>
          <strong>Quote nets, not guesses.</strong> When a price must survive fees, solve
          the charge from the net ({usd(NET_10K_CARD.charge)} to net{' '}
          {usd(BASE.invoiceAmount, 0)} on a card; {usd(NET_10K_ACH.charge, 0)} by debit).
        </li>
        <li>
          <strong>Price the terms you grant.</strong> Net-{BASE.netDays} at{' '}
          {pct(BASE.badDebtPct, 0)} risk costs {pct(base.totalCostPct ?? 0, 2)} of face;
          quoting +{pct(base.priceUpliftPct ?? 0, 2)} makes the invoice whole in
          expectation. Absorb the cost for accounts worth subsidizing — knowingly.
        </li>
        <li>
          <strong>Write the late fee in, as a deterrent.</strong> The market-standard
          1.5% per month is {pct(LATE_SIMPLE, 1)} a year simple,{' '}
          {pct(LATE_COMPOUND, 1)} compounded. It costs nothing to include and reliably
          reorders a slow payer&apos;s priorities; actually litigating it against a
          distressed customer usually collects less than the paperwork costs.
        </li>
        <li>
          <strong>Design early-pay discounts at the boundary.</strong> Fair-priced at a{' '}
          {pct(BASE.annualRatePct, 0)} capital cost is {pct(BE_DISC ?? 0, 2)} — 0.5/10,
          not 2/10. Grant 2/10 only where default risk makes the insurance worth buying
          (it is at {pct(3, 0)}; it is not at {pct(1, 0)}). As a buyer, take 2/10
          essentially always.
        </li>
        <li>
          <strong>Manage the write-off line directly.</strong> Screen the marginal large
          account, cap any single name&apos;s share of open receivables, and take
          deposits on big milestones — a 50% deposit halves both the financed face and
          the exposed face of the work not yet paid for. Remember which lever you are
          pulling: payment speed only sheds the unaccrued share of the risk —{' '}
          {usd(OFFER_3.riskRelief, 0)} of the {usd(base.badDebtLoss, 0)} expectation when
          day-10 settlement replaces day-30 on the running invoice — while the whole
          line for a customer moves only with who you bill.
        </li>
      </ol>

      <h2 id="limits">Where this model ends</h2>
      <p>
        The conventions are stated so you can judge them. Interest is simple, on a
        365-day year, charged on the outstanding face; a leap year or intra-cycle
        compounding moves the answer by cents. Default risk is read two ways, by design:
        the per-invoice readout charges the full blended probability at any window (a
        same-day sale keeps its whole expected loss — the conservative bound), while the
        discount comparison accrues that probability uniformly over the exposure window
        (the marginal bound used wherever payment speed is the question). Both are
        modeling assumptions, not empirical laws; where the truth sits between them,
        customer-by-customer credit judgment — not this arithmetic — decides. Discount
        uptake is all-or-none. Trade terms (&ldquo;Net-30&rdquo;, &ldquo;2/10 net
        30&rdquo;, late-fee percentages) are contractual market conventions, not
        statutory rates: no legal parameter enters this guide, and the{' '}
        {pct(CLASSIC360 ?? 0, 1)}-versus-{pct(CLASSIC365 ?? 0, 1)} pair is purely a
        day-count choice.
      </p>
      <p>
        The processor rates are Stripe&apos;s standard published US pricing, verified
        October 2026 (domestic card 2.9% + $0.30; international 4.4% + $0.30; ACH 0.8%
        capped at $5.00). Negotiated or volume schedules differ, in-person and keyed-entry
        rates are separate, and currency conversion is not modeled. The default
        probability is an estimate from your own ledger, and the model does not see
        concentration — one large failing customer is the risk this per-invoice arithmetic
        cannot price. Where any number here drives a real decision, run it through the
        instruments with your own inputs; that is what they are for.
      </p>
    </>
  );
}

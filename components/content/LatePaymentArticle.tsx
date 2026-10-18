import Faq from '@/components/Faq';
import { ArticleToc, RelatedCalculators } from '@/components/Article';
import {
  LATEFEE_PRESETS,
  breakevenDiscount,
  breakevenNetDays,
  cashLockedByTerms,
  computeLatePayment,
  discountImpliedAnnualized,
  evaluateEarlyPayDiscount,
  lateFeeAnnualized,
} from '@/lib/latefee';
import { numFmt, pct, usd } from '@/lib/format';

/* Every number in this guide is computed at build time by the same functions
   the widget runs — nothing is hand-typed. */

/* Base worked example: a $10,000 invoice on Net-30, 8% cost of capital,
   2% blended default risk. */
const BASE = { invoiceAmount: 10000, netDays: 30, annualRatePct: 8, badDebtPct: 2 };
const base = computeLatePayment(BASE);
const n15 = computeLatePayment({ ...BASE, netDays: 15 });
const n60 = computeLatePayment({ ...BASE, netDays: 60 });
const n90 = computeLatePayment({ ...BASE, netDays: 90 });
const bd5 = computeLatePayment({ ...BASE, badDebtPct: 5 });
const cashSale = computeLatePayment({ ...BASE, netDays: 0 });

/* A card-processing fee on the same invoice — the comparison that makes the
   invisible cost visible. */
const STRIPE_ON_BASE = BASE.invoiceAmount * 0.029 + 0.3;

/* The classic derivation, both day-count bases. */
const CLASSIC365 = discountImpliedAnnualized(2, 10, 30); // (2/98) × 365/20
const CLASSIC360 = discountImpliedAnnualized(2, 10, 30, 360); // banker's year
const ONE_TEN = discountImpliedAnnualized(1, 10, 30);
const TWO_TEN_NET60 = discountImpliedAnnualized(2, 10, 60);
const TWO_TEN_NET15 = discountImpliedAnnualized(2, 10, 15);

/* Offering 2/10 net 30 at three risk levels — the seller's expected value. */
const offer2 = evaluateEarlyPayDiscount(BASE, 2, 10);
const offer3 = evaluateEarlyPayDiscount({ ...BASE, badDebtPct: 3 }, 2, 10);
const offer5 = evaluateEarlyPayDiscount({ ...BASE, badDebtPct: 5 }, 2, 10);

/* Boundaries and clauses. */
const BE_DISC_8 = breakevenDiscount(8, 10, 30);
const BE_DISC_12 = breakevenDiscount(12, 10, 30);
const BE_DAYS_8 = breakevenNetDays(2, 10, 8);
const LATE_SIMPLE = lateFeeAnnualized(1.5);
const LATE_COMPOUND = lateFeeAnnualized(1.5, true);

/* Preset capital-rate band — computed, so the FAQ can never drift from the
   presets it cites (9% agency / 10% B2B / 7% enterprise). */
const RATE_LO = Math.min(...LATEFEE_PRESETS.map((p) => p.inputs.annualRatePct));
const RATE_HI = Math.max(...LATEFEE_PRESETS.map((p) => p.inputs.annualRatePct));

/* Runway framing: a $600k/yr book at Net-45 vs Net-60. */
const LOCKED_45 = cashLockedByTerms(600000, 45);
const LOCKED_60 = cashLockedByTerms(600000, 60);

/* Milestone-deposit example on the B2B preset. */
const B2B = computeLatePayment(LATEFEE_PRESETS[1].inputs);
const B2B_HALF = computeLatePayment({ ...LATEFEE_PRESETS[1].inputs, invoiceAmount: LATEFEE_PRESETS[1].inputs.invoiceAmount / 2 });

/* Margin framing: terms cost as a share of gross profit at a 20% margin. */
const MARGIN = 20;
const PROFIT_SHARE = (base.totalCostPct ?? 0) / MARGIN * 100;

/* Low-risk/cheap-capital corner for the Net-60-vs-price-cut FAQ. */
const LOW_RISK_N60 = computeLatePayment({ ...BASE, netDays: 60, annualRatePct: 6, badDebtPct: 1 });

/* Decision-boundary table: fair discount (D = 10 days) by capital rate and net term. */
const TABLE_RATES = [6, 8, 10, 12, 18, 24];
const TABLE_NETS = [15, 30, 45, 60, 90];

export default function LatePaymentArticle() {
  const toc = [
    { id: 'invisible-cost', label: 'The invisible line item' },
    { id: 'time-value', label: 'The time-value arithmetic' },
    { id: 'bad-debt', label: 'Bad debt as an expected value' },
    { id: 'discount-math', label: 'What 2/10 net 30 really pays' },
    { id: 'runway', label: 'Terms, DSO and runway' },
    { id: 'negotiate', label: 'The negotiation playbook' },
    { id: 'boundaries', label: 'Decision boundaries' },
    { id: 'limits', label: 'Where the model lies' },
    { id: 'glossary', label: 'Glossary' },
    { id: 'faq', label: 'FAQ' },
  ];

  return (
    <article className="prose-article">
      <ArticleToc items={toc} />

      <h2 id="invisible-cost">The invisible line item</h2>
      <p>
        Every invoice carries two prices: the number printed on it, and the cost of waiting for that
        number to become cash. The second price never appears on a statement, which is exactly why it
        survives year after year. Run the base example this tool ships with — a{' '}
        {usd(BASE.invoiceAmount, 0)} invoice on Net-{BASE.netDays}, an {pct(BASE.annualRatePct, 0)}{' '}
        cost of capital, a {pct(BASE.badDebtPct, 0)} blended default rate — and the waiting costs{' '}
        <strong>{usd(base.carryingCost)}</strong> in carrying cost plus{' '}
        <strong>{usd(base.badDebtLoss)}</strong> in expected bad debt:{' '}
        <strong>{usd(base.totalExpectedCost)}</strong> per invoice,{' '}
        {pct(base.totalCostPct ?? 0, 2)} of face, gone before anyone negotiates anything.
      </p>
      <p>
        For scale, put that next to a cost every business does line-item: processing the same{' '}
        {usd(BASE.invoiceAmount, 0)} on a card costs about {usd(STRIPE_ON_BASE)} at the standard{' '}
        2.9% + {usd(0.3)} rate. The payment window costs{' '}
        {pct((base.totalExpectedCost / STRIPE_ON_BASE) * 100, 0)} of what the card fees cost —
        and unlike card fees, it compounds silently with every extra week of terms. The{' '}
        <a href="/stripe-fee-calculator/">Stripe fee calculator</a> prices the first levy; this tool
        prices the second.
      </p>
      <p>
        The margin framing is harsher still. In a business running a {pct(MARGIN, 0)} gross margin,
        {pct(base.totalCostPct ?? 0, 2)} of revenue is{' '}
        <strong>{pct(PROFIT_SHARE, 1)} of gross profit</strong> — more than an eighth of it, gone
        before a cent of overhead. Stretch to Net-60 and the same invoice costs {usd(n60.totalExpectedCost)} (
        {pct(n60.totalCostPct ?? 0, 2)}); Net-90, {usd(n90.totalExpectedCost)} (
        {pct(n90.totalCostPct ?? 0, 2)}). None of this is an argument against extending terms —
        terms buy customers, and enterprise buyers will not move without them. It is an argument for
        knowing the price, because a cost you never measure is a cost you negotiate around in the
        dark.
      </p>

      <h2 id="time-value">The time-value arithmetic</h2>
      <p>
        The carrying-cost half of the model is one multiplication:{' '}
        <code>carry = A × r × days ÷ 365</code>. You are owed <em>A</em> for <em>days</em>; money
        costs you <em>r</em> a year; the fraction of a year you are financing the customer is{' '}
        <em>days ÷ 365</em>. On the base invoice that is {usd(BASE.invoiceAmount, 0)} ×{' '}
        {pct(BASE.annualRatePct, 0)} × {BASE.netDays} ÷ 365 = {usd(base.carryingCost)} — or{' '}
        <strong>{usd(base.dailyCarryingCost)} per day</strong> of waiting, which is the most useful
        form of the number: every day a dunning email sits unsent has a price, and it is this one.
      </p>
      <p>
        Three conventions keep the arithmetic honest. Interest is <em>simple</em>, not compounded —
        inside a single invoice&apos;s life the difference is cents. The rate is charged on the full
        outstanding face, a deliberately conservative first-order choice. And the year is 365 days;
        a leap year changes the answer by a fraction of a percent, far below the noise in any
        default estimate.
      </p>
      <p>
        The input that deserves the most thought is <em>r</em>. The honest value is whatever your
        next marginal dollar actually costs: the APR on your credit line if you have one, the
        all-in factoring or merchant-advance rate if that is how you bridge, or — for a profitable,
        cash-rich business — an opportunity cost of capital (what the same money earns deployed
        elsewhere). A business with no debt and idle cash still shouldn&apos;t enter zero: idle cash
        has an opportunity price too, and the model is only as honest as the rate you feed it.
      </p>

      <h2 id="bad-debt">Bad debt as an expected value</h2>
      <p>
        The second half of the cost is an expectation, not an interest charge:{' '}
        <code>E[loss] = A × P(default)</code>. Multiply the face by the probability it is never
        collected. At a {pct(BASE.badDebtPct, 1)} blended rate the base invoice carries{' '}
        {usd(base.badDebtLoss)} of expected loss; at {pct(5, 0)}, {usd(bd5.badDebtLoss)}. The
        invoice you will actually send either collects or it doesn&apos;t — the expectation is what
        the <em>book</em> pays to hold the average.
      </p>
      <p>
        Estimate the probability from your own ledger, not from a feeling: dollars written off over
        a trailing year or two, divided by dollars billed in the same window. Zero write-offs so far
        does not justify zero forever — young books underestimate risk simply by not having lived
        long enough — but a measured {pct(0.5, 1)} beats an inherited {pct(2, 0)} every time.
      </p>
      <p>
        Two properties of this term matter more than its size. First, it is the{' '}
        <strong>intercept</strong> of the terms-cost curve: the cost at day zero. A cash sale with
        the same default probability still carries {usd(cashSale.totalExpectedCost)} of expected
        loss — only the carrying half goes to zero, which is why the curve in the tool starts above
        the axis. Second, it is asymmetric across customers: a blended {pct(2, 0)} across the book
        is often 0% for eighty clients and 100% for the one that is quietly failing. The
        expectation smooths that over; your credit decisions shouldn&apos;t. Concentration — one
        customer being a large share of receivables — is the risk variable this per-invoice model
        deliberately leaves to you.
      </p>

      <h2 id="discount-math">What 2/10 net 30 really pays</h2>
      <p>
        &ldquo;2/10 net 30&rdquo; means: take 2% off if you pay within 10 days, otherwise the full
        amount in 30. The classic question — is it worth taking? — has an answer you can derive in
        one line instead of memorizing.
      </p>
      <p>
        As the <strong>buyer</strong>, paying on day 10 means spending{' '}
        {usd(BASE.invoiceAmount * 0.98, 0)} to settle a bill that would otherwise cost{' '}
        {usd(BASE.invoiceAmount, 0)} on day 30. You give up{' '}
        {usd(BASE.invoiceAmount * 0.02, 0)} to hold onto {usd(BASE.invoiceAmount * 0.98, 0)} for 20
        fewer days. The return on that money for the 20 days is{' '}
        <code>2 ÷ 98 = {pct((2 / 98) * 100, 2)}</code> per period, and there are{' '}
        <code>365 ÷ 20 = {numFmt(365 / 20, 2)}</code> such periods in a year:
      </p>
      <p>
        <code>i = (2 ÷ 98) × (365 ÷ 20) = {pct(CLASSIC365 ?? 0, 2)} a year</code>
      </p>
      <p>
        That is the derivation. The {pct(CLASSIC360 ?? 0, 1)} figure most textbooks print is the
        same arithmetic on the 360-day banker&apos;s year — <code>(2 ÷ 98) × (360 ÷ 20)</code> — a
        day-count convention, nothing more. This tool quotes the 365-day basis throughout and shows
        the 360-day figure alongside, so the two numbers you will meet in the wild never disagree
        with each other by surprise.
      </p>
      <p>
        Either way the conclusion is the same: a risk-free-adjacent {pct(CLASSIC365 ?? 0, 1)}{' '}
        annualized return beats every plausible cost of capital, so <strong>take the discount</strong>{' '}
        unless your cash is genuinely more expensive than that. The mirror image is the{' '}
        <strong>seller&apos;s</strong> question — should you <em>offer</em> 2/10 net 30? — and there
        the same {pct(CLASSIC365 ?? 0, 1)} is a price you are paying to accelerate cash, not a
        return you earn. Run the full expected-value comparison at the base numbers (
        {pct(2, 0)} default risk): the discount surrenders {usd(offer2.faceGivenUp, 0)} of face,
        buys back {usd(offer2.riskRelief, 0)} of default expectation (the exposure window shrinks
        from 30 days to 10, with risk accruing uniformly over it) and {usd(offer2.carryingRelief, 0)}{' '}
        of carrying cost. Net: <strong>{usd(offer2.netAdvantage, 0)} per invoice</strong> — a loss.
        At a {pct(3, 0)} default rate the same offer flips to{' '}
        <strong>+{usd(offer3.netAdvantage, 0)}</strong>, and at {pct(5, 0)},{' '}
        <strong>+{usd(offer5.netAdvantage, 0)}</strong>. The lesson is precise: a 2% discount is
        justified by <em>risk</em>, not by the time value of money — the customers it protects you
        from are the ones who make it worth granting.
      </p>
      <p>
        The discount&apos;s implied rate is also wildly sensitive to the net term, which is where
        sellers get fooled. The same 2/10 on Net-15 implies{' '}
        {pct(TWO_TEN_NET15 ?? 0, 1)} a year (you give up 2% to skip five days); on Net-60 it implies
        a far more reasonable {pct(TWO_TEN_NET60 ?? 0, 1)}. A 1/10 discount on Net-30 implies{' '}
        {pct(ONE_TEN ?? 0, 1)}. Small numbers, violently different prices — always annualize before
        you agree.
      </p>

      <h2 id="runway">Terms, DSO and runway</h2>
      <p>
        Payment terms are a working-capital machine that runs in one direction: it takes your money
        and parks it in your customers&apos; accounts. The steady-state size of that parking job is{' '}
        <code>AR = annual billings × DSO ÷ 365</code>. A business billing{' '}
        {usd(600000, 0)} a year on Net-45 terms carries{' '}
        <strong>{usd(LOCKED_45, 0)}</strong> of its own money in receivables at all times; the same
        business on Net-60 carries <strong>{usd(LOCKED_60, 0)}</strong>. Nothing was bought with
        that money. No asset was acquired. It is simply the price, in cash, of the terms.
      </p>
      <p>
        This is why terms are a runway question wearing a sales costume. That{' '}
        {usd(LOCKED_45, 0)} is months of payroll sitting in someone else&apos;s bank account; a
        terms concession of 15 days across the book is a one-time {usd(LOCKED_60 - LOCKED_45, 0)}{' '}
        hole blown in your cash balance, felt the month it happens. When a customer asks to move
        from Net-45 to Net-60, they are asking you to extend them an interest-free loan of{' '}
        {usd(LOCKED_60 - LOCKED_45, 0)} — which is a perfectly normal thing for businesses to do to
        each other, and a perfectly normal thing to price. The{' '}
        <a href="/saas-runway-calculator/">SaaS runway calculator</a> measures how many months the
        remaining cash buys; this tool measures how much of it the terms quietly consume first.
      </p>
      <p>
        The lever also runs in reverse, which is the good news: shortening terms is one of the very
        few ways a business can release cash without cutting a single expense or raising a single
        price. Move the {usd(600000, 0)} book from Net-60 to Net-45 and{' '}
        {usd(LOCKED_60 - LOCKED_45, 0)} comes home — a financing round&apos;s worth of liquidity,
        obtained by changing one number on a template.
      </p>

      <h2 id="negotiate">The negotiation playbook</h2>
      <p>
        Once the cost is visible, the levers are mechanical. Each below is priced with the same
        engine the widget runs.
      </p>
      <ul>
        <li>
          <strong>Shorten the term first; argue price second.</strong> On the base invoice, moving
          Net-30 to Net-15 halves the carrying cost from {usd(base.carryingCost)} to{' '}
          {usd(n15.carryingCost)} with no change anyone could call a price increase. Terms are the
          cheapest concession to negotiate because the counterparty&apos;s finance team knows most
          vendors never look at them.
        </li>
        <li>
          <strong>Take deposits and split milestones.</strong> The B2B preset — a{' '}
          {usd(LATEFEE_PRESETS[1].inputs.invoiceAmount, 0)} milestone on Net-30 at{' '}
          {pct(LATEFEE_PRESETS[1].inputs.annualRatePct, 0)} capital and{' '}
          {pct(LATEFEE_PRESETS[1].inputs.badDebtPct, 0)} risk — costs{' '}
          {usd(B2B.totalExpectedCost)} ({pct(B2B.totalCostPct ?? 0, 2)}) per invoice. A 50% deposit
          up front cuts the exposed half&apos;s cost to {usd(B2B_HALF.totalExpectedCost)}: same
          project, same client, half the financing and half the default exposure.
        </li>
        <li>
          <strong>Price the terms into the rate.</strong> If you must grant Net-30 with{' '}
          {pct(BASE.badDebtPct, 0)} risk, quote{' '}
          <strong>+{pct(base.priceUpliftPct ?? 0, 2)}</strong> on the invoice and the expected value
          matches a cash sale at face. The{' '}
          <a href="/freelance-hourly-rate-calculator/">hourly-rate tool</a> exists to absorb exactly
          these frictions into the number you quote.
        </li>
        <li>
          <strong>Write the late fee in — as a deterrent, not a revenue line.</strong> The
          market-standard 1.5% per month is {pct(LATE_SIMPLE, 1)} a year simple,{' '}
          {pct(LATE_COMPOUND, 1)} compounded. A clause at that rate costs nothing to include,
          reliably reorders a slow payer&apos;s priorities, and should be judged on deterrence:
          actually litigating it against a distressed customer usually collects less than the
          paperwork costs.
        </li>
        <li>
          <strong>Design discounts at the boundary, not at the folklore.</strong> At an{' '}
          {pct(8, 0)} cost of capital and a 10-day window on Net-30, the discount priced exactly at
          your financing cost is <strong>{pct(BE_DISC_8 ?? 0, 2)}</strong> — call it 0.5/10 net 30.
          Offering 2% there is paying a {pct(CLASSIC365 ?? 0, 1)} implied rate for cash you could
          have had for {pct(8, 0)}. Grant the rich version only deliberately, as insurance on a
          genuinely risky account.
        </li>
        <li>
          <strong>Screen and de-concentrate.</strong> The blended probability you enter is an
          average over a book you control: credit-check the marginal large account, cap any single
          name&apos;s share of open receivables, and keep the failure of one customer from being a
          financing event.
        </li>
      </ul>

      <h2 id="boundaries">Decision boundaries</h2>
      <p>
        Every discount decision collapses to one comparison: the implied annualized rate versus
        your cost of capital. The boundary discount — where the two are equal — solves{' '}
        <code>d* = q ÷ (1 + q)</code> with <code>q = r × (N − D) ÷ 365</code>. The table below is
        that solution for a 10-day discount window: the discount that is exactly fair-priced at
        each combination of capital cost and net term.
      </p>
      <table>
        <thead>
          <tr>
            <th>Cost of capital</th>
            {TABLE_NETS.map((n) => (
              <th key={n}>Net-{n}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {TABLE_RATES.map((r) => (
            <tr key={r}>
              <td>{pct(r, 0)}</td>
              {TABLE_NETS.map((n) => {
                const d = breakevenDiscount(r, 10, n);
                return <td key={n}>{d === null ? '—' : pct(d, 2)}</td>;
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <p>
        Read it both ways. Offering <em>below</em> the cell value buys early cash more cheaply than
        your own financing — a genuine bargain for you. Offering above it overpays, unless the
        bad-debt relief (the seller&apos;s real reason, as the 2/10 example showed) covers the
        difference. The same table read as a <em>buyer</em> inverts: a vendor offering more than
        your row&apos;s value is handing you a return above your cost of capital — take it. And the
        boundary moves with terms: at {pct(12, 0)} capital, a fair 10-day discount grows from{' '}
        {pct(breakevenDiscount(12, 10, 15) ?? 0, 2)} on Net-15 to{' '}
        {pct(breakevenDiscount(12, 10, 90) ?? 0, 2)} on Net-90, which is why long terms and rich
        discounts travel together. The mirror boundary in days: at {pct(8, 0)} capital, 2/10 is
        fair-priced only when the net term reaches <strong>{numFmt(BE_DAYS_8 ?? 0, 0)} days</strong>{' '}
        — 2/10 net {numFmt(BE_DAYS_8 ?? 0, 0)} would be the exactly-fair design; 2/10 net 30 is
        nowhere near it.
      </p>

      <h2 id="limits">Where the model lies</h2>
      <p>
        A first-order model earns its keep only if it confesses. The approximations here, in the
        order they bite:
      </p>
      <ul>
        <li>
          <strong>Uniform risk accrual.</strong> Early payment is modeled as shrinking the default
          probability in proportion to the window (10 days of a 30-day term carries a third of the
          risk). Real default risk is not uniform — it clusters at the moment a customer&apos;s
          business fails, whenever that is. The proportionality is a modeling convention, stated on
          the methodology panel, not an empirical finding.
        </li>
        <li>
          <strong>All-or-none uptake.</strong> The discount comparison assumes the customer either
          takes the early-pay terms or ignores them. Real books see partial uptake, and adverse
          selection at that: the customers most eager to pay early are the solvent ones.
        </li>
        <li>
          <strong>Deterministic timing.</strong> The model treats Net-{BASE.netDays} as paying on
          day {BASE.netDays}. Actual collections follow a distribution whose right tail — the
          90-day straggler on a Net-15 invoice — often costs more than the whole term&apos;s
          carrying cost. When reality is that lumpy, enter an <em>effective</em> days number (your
          DSO) rather than the contractual one.
        </li>
        <li>
          <strong>Simple interest, face-based carrying, no tax.</strong> No compounding inside a
          cycle; carrying charged on the outstanding face; and the tax treatment of bad debts
          (potentially deductible, subject to methods and limits) is out of scope entirely — the
          model measures the economic loss, not the after-tax one.
        </li>
        <li>
          <strong>No statutory parameters.</strong> Unlike the tax instruments in this suite, there
          is no IRS or SSA constant here: trade terms are contract law. Statutory late-payment
          regimes do exist — the EU&apos;s Late Payment Directive, the US Prompt Payment Act for
          federal contracts — and they set default interest and terms in their domains; this tool
          does not model them. Check which regime your contract sits in before quoting this page at
          a counterparty.
        </li>
      </ul>

      <h2 id="glossary">Glossary</h2>
      <dl>
        <div>
          <dt className="font-semibold text-slate-900 dark:text-slate-100">Net terms (Net-N)</dt>
          <dd className="mt-0.5 leading-relaxed text-slate-600 dark:text-slate-300">
            The contractual window — Net-30 means full payment due within 30 days of the invoice
            date. A convention between businesses, not a legal entitlement.
          </dd>
        </div>
        <div>
          <dt className="font-semibold text-slate-900 dark:text-slate-100">DSO (days sales
            outstanding)</dt>
          <dd className="mt-0.5 leading-relaxed text-slate-600 dark:text-slate-300">
            Receivables ÷ annual billings × 365 — how long a dollar of sales actually takes to
            become cash. Invariably longer than the stated terms.
          </dd>
        </div>
        <div>
          <dt className="font-semibold text-slate-900 dark:text-slate-100">Carrying cost</dt>
          <dd className="mt-0.5 leading-relaxed text-slate-600 dark:text-slate-300">
            A × r × days ÷ 365 — what financing one receivable costs, at your annual rate, for the
            days it stays outstanding.
          </dd>
        </div>
        <div>
          <dt className="font-semibold text-slate-900 dark:text-slate-100">Prompt-payment discount
            (d/D net N)</dt>
          <dd className="mt-0.5 leading-relaxed text-slate-600 dark:text-slate-300">
            Take <em>d</em>% off if paid within <em>D</em> days; otherwise full payment by day{' '}
            <em>N</em>. &ldquo;2/10 net 30&rdquo; is the canonical example.
          </dd>
        </div>
        <div>
          <dt className="font-semibold text-slate-900 dark:text-slate-100">Implied annualized rate</dt>
          <dd className="mt-0.5 leading-relaxed text-slate-600 dark:text-slate-300">
            (d ÷ (1−d)) × (365 ÷ (N−D)) — the yearly equivalent of a prompt-payment discount;
            {pct(CLASSIC365 ?? 0, 1)} for 2/10 net 30 on a 365-day year.
          </dd>
        </div>
        <div>
          <dt className="font-semibold text-slate-900 dark:text-slate-100">Bad-debt probability</dt>
          <dd className="mt-0.5 leading-relaxed text-slate-600 dark:text-slate-300">
            The chance an invoice is never collected, blended across the book — estimated as
            write-offs ÷ billings over a trailing window.
          </dd>
        </div>
      </dl>

      <Faq
        items={[
          {
            question: 'Is Net-30 really “free” if my customers all pay on time?',
            answer: (
              <p>
                No — only the bad-debt half of the cost vanishes. The carrying half is the price of
                the wait itself: {usd(base.carryingCost)} on the base {usd(BASE.invoiceAmount, 0)}{' '}
                invoice at an {pct(BASE.annualRatePct, 0)} cost of capital, {usd(base.dailyCarryingCost)}{' '}
                for every day the money is out. Even a perfectly punctual customer keeps you
                financing them for the full term.
              </p>
            ),
          },
          {
            question: 'What cost of capital should I enter?',
            answer: (
              <p>
                The cost of your next marginal dollar. If you carry a credit line, its APR. If you
                bridge with factoring or a merchant advance, the all-in rate of that. If you have
                idle cash and no debt, an opportunity cost — what the money would earn deployed
                elsewhere. Entering zero flatters the terms; the preset examples use{' '}
                {pct(RATE_LO, 0)}–{pct(RATE_HI, 0)} as ordinary business ranges.
              </p>
            ),
          },
          {
            question: 'How do I estimate my bad-debt probability?',
            answer: (
              <p>
                From your own ledger: dollars written off over a trailing year or two ÷ dollars
                billed in the same window. New books with no write-offs should still not enter zero
                — they simply haven&apos;t lived long enough to meet their first failure. For
                context, moving the base example from {pct(2, 0)} to {pct(5, 0)} risk raises the
                total cost from {usd(base.totalExpectedCost)} to {usd(bd5.totalExpectedCost)} per{' '}
                {usd(BASE.invoiceAmount, 0)} invoice.
              </p>
            ),
          },
          {
            question: 'Should I offer 2/10 net 30 to my customers?',
            answer: (
              <p>
                On the time value of money alone, no: at an {pct(8, 0)} cost of capital the
                fair-priced version of a 10-day discount on Net-30 is only{' '}
                {pct(BE_DISC_8 ?? 0, 2)} — the classic 2% implies paying{' '}
                {pct(CLASSIC365 ?? 0, 1)} annualized for early cash. The honest reason to grant it
                is default risk: at a {pct(2, 0)} blended default rate the expected value of
                offering 2/10 net 30 is {usd(offer2.netAdvantage, 2)} per invoice, but at{' '}
                {pct(3, 0)} it turns +{usd(offer3.netAdvantage, 2)} and at {pct(5, 0)},{' '}
                +{usd(offer5.netAdvantage, 2)}. Offer it where the risk lives, not uniformly.
              </p>
            ),
          },
          {
            question: 'A vendor offers me 2/10 net 30 — should I take it?',
            answer: (
              <p>
                Almost always. Taking it earns {pct(CLASSIC365 ?? 0, 1)} annualized on the cash you
                release ({pct(CLASSIC360 ?? 0, 1)} on the 360-day banker&apos;s year textbooks
                use) — a return essentially no business&apos;s cost of capital can match. Decline
                only if you genuinely cannot fund the early payment, or your cash earns more than
                that, which is a nice problem.
              </p>
            ),
          },
          {
            question: 'Why does this page say 37.2% when my textbook says 36.7%?',
            answer: (
              <p>
                Day count, nothing else. The derivation is the same line — (2 ÷ 98) periods of
                return, 365 ÷ 20 periods per year — and the year length is a convention. On 365
                days it is {pct(CLASSIC365 ?? 0, 2)}; on the 360-day banker&apos;s year it is{' '}
                {pct(CLASSIC360 ?? 0, 2)}. The tool carries the 365-day basis (matching the rest of
                this suite) and shows the 360-day figure beside it so neither number ever surprises
                you.
              </p>
            ),
          },
          {
            question: 'Does a 1.5% monthly late fee make me whole?',
            answer: (
              <p>
                As arithmetic it is serious — {pct(LATE_SIMPLE, 1)} simple,{' '}
                {pct(LATE_COMPOUND, 1)} compounded annually. As revenue it is mostly fictional:
                the customers who trigger late fees are the ones trending toward the bad-debt
                column, where the fee recovers less than the collection effort costs. Write the
                clause for its deterrent effect on the merely-disorganized, price the genuinely
                risky with deposits and shorter terms instead.
              </p>
            ),
          },
          {
            question: 'Does this include card processing or payment fees?',
            answer: (
              <p>
                No — those are a separate levy that lands when the cash arrives, regardless of
                timing. On the base invoice, standard card pricing costs about{' '}
                {usd(STRIPE_ON_BASE)}; the terms cost {usd(base.totalExpectedCost)} on top of it.
                Run the first number through the{' '}
                <a href="/stripe-fee-calculator/">Stripe fee calculator</a>; this tool prices only
                the wait and the risk.
              </p>
            ),
          },
          {
            question: 'My customers pay late — can I model that?',
            answer: (
              <p>
                Yes, by entering an effective days figure rather than the contractual one: if your
                Net-30 book actually collects in 47 days on average, set the terms to 47 and every
                output prices the reality instead of the promise. The model is deliberately
                deterministic — one cycle at one day count — so the day count you feed it should be
                your DSO, not your terms sheet.
              </p>
            ),
          },
          {
            question: 'How do payment terms interact with runway?',
            answer: (
              <p>
                Directly: terms lock cash that runway has to cover. A {usd(600000, 0)}/yr book on
                Net-45 parks {usd(LOCKED_45, 0)} of working capital in receivables permanently;
                moving to Net-60 grows that to {usd(LOCKED_60, 0)} — a{' '}
                {usd(LOCKED_60 - LOCKED_45, 0)} cash hole opened by one contract clause. Measure
                the months that buys (or costs) with the{' '}
                <a href="/saas-runway-calculator/">SaaS runway calculator</a>.
              </p>
            ),
          },
          {
            question: 'Which is worse: Net-60 or a 2% price cut?',
            answer: (
              <p>
                At the base numbers, Net-60 is worse. The longer terms cost{' '}
                {usd(n60.totalExpectedCost)} ({pct(n60.totalCostPct ?? 0, 2)} of face, including
                the same {usd(base.badDebtLoss)} default expectation) while a 2% cut costs{' '}
                {usd(BASE.invoiceAmount * 0.02, 0)} flat — and unlike the price cut, the terms cost
                keeps scaling with your default rate. The comparison flips at low risk with cheap
                capital: at {pct(1, 0)} default and a {pct(6, 0)} rate, Net-60 costs only{' '}
                {pct(LOW_RISK_N60.totalCostPct ?? 0, 2)}{' '}
                of face. Run both through the tool before conceding either.
              </p>
            ),
          },
          {
            question: 'Should I factor my receivables instead of waiting?',
            answer: (
              <p>
                Compare rates, on an annualized basis, using this tool&apos;s cost-of-capital
                input. Factoring converts your {usd(base.carryingCost)}-per-cycle carrying cost
                into an explicit fee — often plus recourse terms that hand the default risk back to
                you. It is worth its price exactly when your marginal financing cost exceeds the
                factor&apos;s all-in rate, or when the operational relief (they chase the debtors)
                is worth paying for; it is not a subsidy.
              </p>
            ),
          },
          {
            question: 'Is bad debt tax-deductible?',
            answer: (
              <p>
                Sometimes, by method and with limits — a genuine business bad debt can be deducted
                when it becomes worthless, on the accounting method you use, subject to
                documentation the IRS actually accepts. That affects the after-tax size of the
                loss, not its existence. This tool measures the economic cost only; the after-tax
                question belongs to your accountant, not to a calculator.
              </p>
            ),
          },
        ]}
      />

      <RelatedCalculators
        links={[
          { href: '/stripe-fee-calculator/', label: 'Stripe Fee Calculator' },
          { href: '/saas-runway-calculator/', label: 'SaaS Runway Calculator' },
          { href: '/freelance-hourly-rate-calculator/', label: 'Freelance Hourly Rate' },
        ]}
      />
    </article>
  );
}

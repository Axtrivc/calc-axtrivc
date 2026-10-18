import Faq from '@/components/Faq';
import { ArticleToc, RelatedCalculators } from '@/components/Article';
import { STRIPE_RATES } from '@/lib/stripe';

export default function StripeArticle() {
  const toc = [
    { id: 'how-it-works', label: 'How the Stripe fee calculator works' },
    { id: 'rates', label: 'Current Stripe processing rates' },
    { id: 'examples', label: 'Step-by-step examples' },
    { id: 'reverse', label: 'Reverse calculator explained' },
    { id: 'strategies', label: 'How to reduce Stripe fees' },
    { id: 'decision', label: 'Decision boundaries' },
    { id: 'comparison', label: 'Fee comparison table' },
    { id: 'glossary', label: 'Glossary' },
    { id: 'faq', label: 'FAQ' },
  ];

  return (
    <article className="prose-article">
      <ArticleToc items={toc} />

      <h2 id="how-it-works">How the Stripe fee calculator works</h2>
      <p>
        Stripe — like nearly every payment processor — charges a <strong>percentage of the
        transaction</strong> plus a <strong>small fixed fee</strong>. For a standard US domestic
        card payment that works out to <strong>2.9% + $0.30</strong>. The calculator above applies
        that exact formula in your browser, instantly, so you know precisely how much money will
        land in your bank account before you ever send an invoice.
      </p>
      <p>
        The forward calculation is straightforward: enter the amount you plan to charge a customer,
        pick the transaction type (domestic card, international card, or ACH bank transfer), and the
        tool returns three numbers — the fee, the net you&apos;ll receive, and the effective percentage
        rate you actually paid. The effective rate matters because on small transactions the fixed
        $0.30 dominates, so a $5 charge doesn&apos;t cost 2.9%, it costs closer to <strong>8.9%</strong>.
      </p>

      <h2 id="rates">Current Stripe processing rates (US)</h2>
      <p>
        Stripe occasionally adjusts its published pricing; the standard US rates below were last
        verified in October 2026. This tool uses the following schedule:
      </p>
      <table>
        <thead>
          <tr>
            <th>Transaction type</th>
            <th>Rate</th>
            <th>Best for</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><strong>Domestic card</strong> (online)</td>
            <td>{STRIPE_RATES.domestic.description}</td>
            <td>Everyday US customer payments</td>
          </tr>
          <tr>
            <td><strong>International card</strong></td>
            <td>{STRIPE_RATES.international.description}</td>
            <td>Customers outside the US</td>
          </tr>
          <tr>
            <td><strong>ACH transfer</strong></td>
            <td>{STRIPE_RATES.ach.description}</td>
            <td>Large US invoices over $625</td>
          </tr>
        </tbody>
      </table>
      <p>
        The international rate stacks the cross-border surcharge of <strong>+1.5%</strong> on top of
        the base domestic rate, which is why it lands at 4.4% + $0.30. If you sell to a global
        customer base, this is the number that quietly erodes margins — which is exactly why so many
        businesses move international clients to wire transfers (often free to receive at business
        banks) or a local payment method in the customer&apos;s region. ACH can&apos;t serve them:
        it only pulls from US bank accounts.
      </p>
      <p>
        Note that Stripe publishes <em>separate</em> rates for other collection methods this
        calculator does not model: in-person payments on Stripe Terminal run{' '}
        <strong>2.7% + 5¢</strong> — and Tap to Pay, with a phone standing in for the
        terminal and no reader at all, adds <strong>$0.10 per authorization</strong> (an
        optional P2PE add-on costs $0.05 more) — while manually keyed-in cards run{' '}
        <strong>3.4% + $0.30</strong>. Even with both Tap-to-Pay add-ons stacked, the
        in-person schedule stays below the 2.9% + $0.30 online rate on every charge; but
        if tap-to-pay is most of your volume, your real floor is 2.7% plus 15–20¢ per
        authorization — not the 2.9% + $0.30 used here.
      </p>

      <h2 id="examples">Step-by-step calculation examples</h2>
      <h3>Example 1 — $100 domestic card payment</h3>
      <ul>
        <li>Percentage fee: $100 × 2.9% = <strong>$2.90</strong></li>
        <li>Fixed fee: <strong>$0.30</strong></li>
        <li>Total fee: <strong>$3.20</strong></li>
        <li>You receive: $100 − $3.20 = <strong>$96.80</strong></li>
        <li>Effective rate: $3.20 ÷ $100 = <strong>3.20%</strong></li>
      </ul>

      <h3>Example 2 — $1,000 international card payment</h3>
      <ul>
        <li>Percentage fee: $1,000 × 4.4% = <strong>$44.00</strong></li>
        <li>Fixed fee: <strong>$0.30</strong></li>
        <li>Total fee: <strong>$44.30</strong></li>
        <li>You receive: <strong>$955.70</strong></li>
      </ul>

      <h3>Example 3 — $5,000 ACH transfer (capped)</h3>
      <ul>
        <li>Uncapped fee would be: $5,000 × 0.8% = $40.00</li>
        <li>But ACH is capped at <strong>$5.00</strong></li>
        <li>You receive: $5,000 − $5.00 = <strong>$4,995.00</strong></li>
        <li>Effective rate: <strong>0.10%</strong> — the same charge on a domestic card costs $145.30, nearly 30× more (29.1×)</li>
      </ul>
      <p>
        That last example is the single most important number on this page for any business that
        processes large invoices. On a $5,000 payment, choosing ACH over a domestic card saves you
        <strong> $140</strong>. On $20,000, it saves you <strong>$575</strong>.
      </p>

      <h3>Example 4 — the micro-ticket trap: one $6 sale vs one $600 invoice</h3>
      <ul>
        <li>A single $6 domestic sale: $6 × 2.9% + $0.30 = $0.174 + $0.30 = <strong>$0.47</strong> — an effective rate of <strong>7.9%</strong></li>
        <li>100 such sales a month: 100 × $0.474 = <strong>$47.40</strong> in fees on $600 of volume</li>
        <li>One $600 invoice instead: $600 × 2.9% + $0.30 = <strong>$17.70</strong></li>
        <li>Same revenue, <strong>$29.70/month</strong> ($356/year) back in your pocket</li>
      </ul>

      <h3>Example 5 — Reverse mode: pricing an invoice to net exactly $3,500</h3>
      <p>
        <strong>Input:</strong> desired net $3,500, domestic card, Reverse mode — the
        question a consultant asks before sending the invoice, not after the deposit lands.
      </p>
      <ul>
        <li>Charging $3,500 outright doesn&apos;t work: the fee is $101.80 and you deposit $3,398.20</li>
        <li>Gross-up: charge = ($3,500 + $0.30) ÷ (1 − 0.029) = $3,500.30 ÷ 0.971 = <strong>$3,604.84</strong></li>
        <li>Fee on that invoice: $3,604.84 × 2.9% + $0.30 = $104.54 + $0.30 = <strong>$104.84</strong></li>
        <li>Round-trip check (forward mode): $3,604.84 − $104.84 = <strong>$3,500.00</strong> — the target, to the penny</li>
        <li>Markup over your net: $104.84 ÷ $3,500 = <strong>3.0%</strong></li>
        <li>The same net by ACH: $3,500 + the $5 cap = <strong>$3,505.00</strong> — a 0.14% markup and a client invoice <strong>$99.84</strong> smaller, with the same $3,500 landing either way</li>
      </ul>
      <p>
        That last line is the fee-payer&apos;s paradox in one invoice: whoever picks the
        payment rail picks who writes the smaller check. Your client pays $99.84 less on
        the ACH option, and your deposit doesn&apos;t change by a cent.
      </p>

      <h3>Example 6 — a month of mixed payments: the blended rate</h3>
      <p>
        <strong>Inputs</strong> (the volume model&apos;s default month): 40 domestic card
        charges averaging $85, 5 international card charges averaging $150, and 3 ACH
        transfers averaging $1,200.
      </p>
      <ul>
        <li>Domestic leg: 40 × $85 = $3,400 of volume; each charge costs $85 × 2.9% + $0.30 = $2.765, so the leg costs <strong>$110.60</strong> (a 3.25% leg rate)</li>
        <li>International leg: 5 × $150 = $750; each charge costs $6.90, leg total <strong>$34.50</strong> (4.60%)</li>
        <li>ACH leg: 3 × $1,200 = $3,600; each transfer&apos;s uncapped fee would be $9.60, but the $5 cap binds, so the leg costs <strong>$15.00</strong> (0.42%)</li>
        <li>The month: $7,750 processed across 48 payments, <strong>$160.10</strong> in fees, <strong>$7,589.90</strong> deposited — a blended rate of <strong>2.07%</strong></li>
        <li>The floor: the same 48 payments collected as bank debit cost <strong>$48.20</strong>, so this month runs <strong>$111.90 over the floor</strong> — $1,342.80 a year, and 69.9% of the entire fee bill</li>
      </ul>
      <p>
        Note where the money leaks. International cards are 9.68% of this month&apos;s
        volume but 21.55% of its fee bill; re-routing that one leg does more for the
        bottom line than any rate concession you&apos;re likely to win at this size.
      </p>

      <h3>The decision boundaries, in one list</h3>
      <p>
        Because the effective rate on a domestic card is 2.9% + $0.30 ÷ ticket, a few exact
        thresholds are worth memorizing (the scenario chart above draws the same curve):
      </p>
      <ul>
        <li><strong>Below $14.29</strong> — the fixed fee pushes the effective rate <strong>above 5%</strong> ($0.30 ÷ $0.021 = $14.29)</li>
        <li><strong>$300</strong> — the effective rate is <strong>exactly 3.0%</strong>; from here on you are within 0.1 pt of the floor</li>
        <li><strong>$625</strong> — the ACH cap engages ($5.00 ÷ 0.8%): every additional dollar on an ACH invoice rides free, while each card dollar still costs 2.9¢</li>
        <li><strong>The asymptote is 2.9%</strong> — no domestic card charge, however large, ever gets cheaper than that</li>
      </ul>

      <h2 id="reverse">Reverse calculator: &ldquo;What should I charge to net X?&rdquo;</h2>
      <p>
        The forward calculator tells you what you&apos;ll receive for a given charge. The reverse
        calculator answers the question every freelancer and consultant actually asks: <em>&ldquo;I
        want to keep exactly $2,000 — what do I bill?&rdquo;</em>
      </p>
      <p>
        For percentage-plus-fixed types (domestic and international cards), the reverse formula is:
      </p>
      <blockquote>
        <code>charge = (target_net + $0.30) / (1 − 0.029)</code>
      </blockquote>
      <p>
        Worked through for a $2,000 net on a domestic card: charge = $2,000.30 ÷ 0.971 ={' '}
        <strong>$2,060.04</strong>. The fee is $60.04, your client pays a{' '}
        <strong>3.0% markup</strong> over your net, and you deposit exactly $2,000.00. For a $5,000
        net on ACH the answer is <strong>$5,005.00</strong> — the flat $5 cap means the markup is
        just 0.1%.
      </p>
      <p>
        Switch to <strong>&ldquo;Reverse&rdquo;</strong> mode above, enter your desired net, and the
        tool solves for the invoice total — switching modes carries your current number across, so
        the two views stay two sides of the same invoice. For ACH it handles both the capped and
        uncapped regimes automatically (the boundary sits at a $620 net / $625 charge), so your
        reverse invoice always nets out to the penny.
      </p>

      <h2 id="strategies">How to reduce Stripe fees</h2>
      <ol>
        <li>
          <strong>Use ACH for invoices over $625.</strong> The $5 cap makes ACH dramatically cheaper
          than cards on any meaningful amount. Stripe&apos;s own checkout, invoicing, and payment links
          all let you enable ACH as an option.
        </li>
        <li>
          <strong>Bake the fee into your pricing.</strong> If your effective processing cost is
          ~3.3%, raise list prices by 3.5% and stop subsidizing the card networks. The reverse
          calculator above shows the exact invoice total to charge.
        </li>
        <li>
          <strong>Offer a card-vs-ACH discount.</strong> Quote a standard card price and offer 1% off
          for ACH/wire. You keep more, and the client feels like they got a deal.
        </li>
        <li>
          <strong>Avoid international cards when possible.</strong> The +1.5% cross-border surcharge
          is the single most expensive line item. For recurring overseas clients, push them toward
          wire transfer (incoming domestic wires are often free at business banks) or a local
          Stripe alternative in their region.
        </li>
        <li>
          <strong>Batch small transactions.</strong> The $0.30 fixed fee is brutal on micro-charges.
          A $3 sale loses 12.9% to fees ($0.387 on $3.00); a $300 sale loses 3.0%. Where possible,
          group small orders into a single larger invoice — Example 4 above shows the same $600 of
          revenue costing $29.70 less per month when it arrives as one invoice instead of a hundred
          $6 charges.
        </li>
        <li>
          <strong>Model your whole month, not one charge.</strong> The monthly volume model under
          the calculator blends your real mix of card and ACH volume into one blended rate — and
          prices the floor: what the same month would cost if every payment arrived by ACH, which
          undercuts cards on any ticket because 0.8% with no fixed fee beats 2.9% + $0.30 everywhere.
        </li>
      </ol>

      <h2 id="decision">Decision boundaries: when to use what</h2>
      <p>
        The arithmetic produces hard boundaries; the business facts around each payment
        method produce softer ones. Worth keeping them separate — the numbers tell you
        what the rails cost, only your customer base tells you which rails you can use.
      </p>

      <h3>ACH wins on price at every ticket — the friction is the boundary</h3>
      <p>
        Sweeping every integer-cent charge from $0.01 to $10,000 through the same
        per-charge fee function this calculator runs — one million points — the ACH fee
        is strictly below the domestic card fee at <strong>all of them</strong>. 0.8% with
        no fixed fee beats 2.9% + $0.30 everywhere, not just above the $625 cap: the gap
        is $1.35 at a $50 ticket, $24.30 at $1,000, $140.30 at $5,000, and it first
        reaches $1.00 at a $33.34 ticket. Price is never the reason to choose a card.
      </p>
      <p>
        The real boundary is operational. ACH pulls from US bank accounts only, and where
        a card confirms in seconds, a bank debit can take up to four business days to
        confirm (both rails settle to your bank on a multi-day payout schedule) — and a
        returned debit takes the money back. On a $50 consumer purchase, $1.35 rarely
        justifies that friction; on a $5,000 B2B invoice, $140.30 is pure margin for
        asking one extra question at invoicing time.
      </p>

      <h3>When cards are still the right answer</h3>
      <ul>
        <li>
          <strong>Consumer checkout.</strong> Buyers reach for cards, and conversion is
          worth more than the 2.1-point spread (plus the fixed fee) you give up by not
          using bank debit.
        </li>
        <li>
          <strong>International customers.</strong> ACH can&apos;t pull from a non-US
          bank, so the modeled choice is an international card at 4.4% + $0.30 — where
          the cross-border premium costs $15.00 per $1,000 charged — or moving the client
          to a wire transfer.
        </li>
        <li>
          <strong>Subscriptions and micro-tickets the payer won&apos;t re-authenticate.</strong>{' '}
          Card-on-file autorenewal keeps revenue flowing that bank-debit friction would lose.
        </li>
      </ul>

      <h3>Where this calculator stops being the right instrument</h3>
      <p>
        The rates modeled here are Stripe&apos;s published US online rates. The instrument
        is the wrong shape when most volume runs in person on a Terminal or is keyed in
        by hand — both carry their own schedules, listed under Current rates above; when
        the charge settles in a foreign currency, which adds a conversion fee this model
        does not include; when the account is not US-based; or when you have negotiated
        custom volume pricing. In those cases treat the numbers here as a benchmark, not
        a quote.
      </p>

      <h3>The exact thresholds</h3>
      <p>
        Each boundary below was found by sweeping the engine one cent at a time and
        taking the first charge where the condition flips, then cross-checked against the
        closed form <code>fixed ÷ (target − rate)</code>:
      </p>
      <table>
        <thead>
          <tr>
            <th>Boundary</th>
            <th>Value</th>
            <th>Engine output on either side</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Domestic effective rate falls to 5%</td>
            <td><strong>$14.29</strong></td>
            <td>$14.28 pays 5.0008%; $14.29 pays 4.9994% (algebraic crossing $0.30 ÷ 2.1% = $14.2857)</td>
          </tr>
          <tr>
            <td>Domestic effective rate falls to 10%</td>
            <td><strong>$4.23</strong></td>
            <td>$4.22 pays 10.009%; $4.23 pays 9.992% — micro-charges live above this line</td>
          </tr>
          <tr>
            <td>Domestic effective rate hits 3.00% exactly</td>
            <td><strong>$300.00</strong></td>
            <td>fee $9.00 on $300; beyond this the fixed fee adds under a tenth of a point</td>
          </tr>
          <tr>
            <td>International effective rate falls to 5%</td>
            <td><strong>$50.00</strong></td>
            <td>$49.99 pays 5.0001%; $50.00 pays exactly 5.0000% ($2.50 fee)</td>
          </tr>
          <tr>
            <td>ACH $5 cap engages</td>
            <td><strong>$625.00</strong></td>
            <td>$624 costs $4.992; $625 costs $5.000; $626 would cost $5.008 uncapped, capped to $5.000</td>
          </tr>
          <tr>
            <td>Card fee stops exceeding the whole charge</td>
            <td><strong>$0.31</strong></td>
            <td>at $0.30 the fee is the entire charge (net $0); $0.31 nets $0.001 (crossing $0.30 ÷ 0.971 = $0.3090)</td>
          </tr>
          <tr>
            <td>Domestic asymptote</td>
            <td><strong>2.9%</strong></td>
            <td>2.93% at $1,000; 2.903% at $10,000; 2.9003% at $100,000</td>
          </tr>
        </tbody>
      </table>

      <h3>Scan method</h3>
      <p>
        The sweep runs the same forward fee function the calculator above executes,
        compiled out of the site&apos;s Stripe engine and stepped from one cent to
        $10,000 in one-cent increments — 1,000,000 evaluations per condition. A threshold
        is reported as the first cent where the predicate flips, and each is then
        confirmed against its closed-form crossing so a scan artifact can&apos;t
        masquerade as a boundary.
      </p>

      <h2 id="comparison">Stripe fee comparison table</h2>
      <p>Here&apos;s what a $1,000 payment looks like under each method:</p>
      <table>
        <thead>
          <tr>
            <th>Method</th>
            <th>Fee</th>
            <th>You net</th>
            <th>Effective rate</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Domestic card</td>
            <td>$29.30</td>
            <td>$970.70</td>
            <td>2.93%</td>
          </tr>
          <tr>
            <td>International card</td>
            <td>$44.30</td>
            <td>$955.70</td>
            <td>4.43%</td>
          </tr>
          <tr>
            <td>ACH (capped)</td>
            <td>$5.00</td>
            <td>$995.00</td>
            <td>0.50%</td>
          </tr>
        </tbody>
      </table>

      <h2 id="glossary">Glossary</h2>
      <p>
        The vocabulary this page — and Stripe&apos;s pricing page — runs on, in the order
        you&apos;re likely to meet it:
      </p>
      <dl className="mt-2 space-y-5">
        <div>
          <dt className="font-semibold text-slate-900 dark:text-slate-100">Processing fee</dt>
          <dd className="mt-1 leading-relaxed text-slate-600 dark:text-slate-300">
            The amount Stripe withholds from each successful charge: a percentage fee plus,
            for cards, a fixed fee. On a $100 domestic card charge that is $3.20, leaving
            $96.80 to deposit.
          </dd>
        </div>
        <div>
          <dt className="font-semibold text-slate-900 dark:text-slate-100">Percentage fee</dt>
          <dd className="mt-1 leading-relaxed text-slate-600 dark:text-slate-300">
            The variable slice of the fee — 2.9% domestic card, 4.4% international, 0.8% ACH —
            always computed on the gross charge. On a $1,000 domestic charge it is $29.00 of
            the $29.30 total.
          </dd>
        </div>
        <div>
          <dt className="font-semibold text-slate-900 dark:text-slate-100">Fixed fee</dt>
          <dd className="mt-1 leading-relaxed text-slate-600 dark:text-slate-300">
            The flat $0.30 every card transaction adds, regardless of size. It is why a $6
            sale pays an effective 7.9% while a $600 invoice pays 2.95%.
          </dd>
        </div>
        <div>
          <dt className="font-semibold text-slate-900 dark:text-slate-100">Effective rate</dt>
          <dd className="mt-1 leading-relaxed text-slate-600 dark:text-slate-300">
            Total fee ÷ charge × 100 — the single number to compare rails with, because it
            folds the fixed fee in. $3.20 on $100 is an effective rate of 3.20%.
          </dd>
        </div>
        <div>
          <dt className="font-semibold text-slate-900 dark:text-slate-100">Gross (charge amount)</dt>
          <dd className="mt-1 leading-relaxed text-slate-600 dark:text-slate-300">
            The full amount billed to the customer before any fee — including tax and
            shipping — and the base every percentage in this model is computed on.
          </dd>
        </div>
        <div>
          <dt className="font-semibold text-slate-900 dark:text-slate-100">Net</dt>
          <dd className="mt-1 leading-relaxed text-slate-600 dark:text-slate-300">
            What actually deposits: gross minus fee. $100 of gross becomes $96.80 of net on
            a domestic card.
          </dd>
        </div>
        <div>
          <dt className="font-semibold text-slate-900 dark:text-slate-100">Gross-up</dt>
          <dd className="mt-1 leading-relaxed text-slate-600 dark:text-slate-300">
            Solving for the invoice that nets a target after fees: charge = (net + fixed) ÷
            (1 − rate). A $3,500 target on a domestic card grosses up to a $3,604.84
            invoice.
          </dd>
        </div>
        <div>
          <dt className="font-semibold text-slate-900 dark:text-slate-100">Cross-border surcharge</dt>
          <dd className="mt-1 leading-relaxed text-slate-600 dark:text-slate-300">
            The +1.5% added when the customer&apos;s card was issued outside the US, taking
            the card rate from 2.9% to 4.4% — $15.00 more per $1,000 charged.
          </dd>
        </div>
        <div>
          <dt className="font-semibold text-slate-900 dark:text-slate-100">ACH direct debit</dt>
          <dd className="mt-1 leading-relaxed text-slate-600 dark:text-slate-300">
            A pull from a US bank account rather than a card network, priced at 0.8% with
            no fixed fee — $4.00 on a $500 debit. Slower to confirm than a card, and a
            failed debit can return.
          </dd>
        </div>
        <div>
          <dt className="font-semibold text-slate-900 dark:text-slate-100">Cap</dt>
          <dd className="mt-1 leading-relaxed text-slate-600 dark:text-slate-300">
            The $5.00 ceiling on an ACH fee, engaging at a $625 charge. Every dollar of an
            ACH invoice beyond $625 rides free.
          </dd>
        </div>
        <div>
          <dt className="font-semibold text-slate-900 dark:text-slate-100">Blended rate</dt>
          <dd className="mt-1 leading-relaxed text-slate-600 dark:text-slate-300">
            A month&apos;s total fees divided by total volume across every payment type —
            2.07% in Example 6&apos;s default month. The number your processor statement
            actually nets out to.
          </dd>
        </div>
        <div>
          <dt className="font-semibold text-slate-900 dark:text-slate-100">ACH floor</dt>
          <dd className="mt-1 leading-relaxed text-slate-600 dark:text-slate-300">
            The counterfactual cost of the same month if every payment arrived by bank
            debit — the cheapest bill the published rates allow ($48.20 against $160.10 in
            Example 6).
          </dd>
        </div>
      </dl>

      <Faq
        items={[
          {
            question: 'Does Stripe charge a fee to receive money?',
            answer:
              'Yes. Stripe charges the receiving merchant a processing fee on every successful card or bank charge. For standard US domestic cards that is 2.9% + $0.30. The person paying (your customer) is not charged an extra fee by Stripe on top of the amount you set — the fee comes out of what you receive.',
          },
          {
            question: 'What is the Stripe fee for a $100 transaction?',
            answer:
              'For a $100 US domestic card payment, the fee is $3.20 (2.9% × $100 = $2.90, plus the $0.30 fixed fee). You receive $96.80. For an international card the fee would be $4.40 + $0.30 = $4.70, leaving you $95.30.',
          },
          {
            question: 'Does Stripe charge less for in-person or keyed-in payments?',
            answer:
              'It charges differently, and this calculator does not model those rates. On Stripe Terminal, in-person US card payments run 2.7% + 5¢ per transaction — cheaper than the 2.9% + $0.30 online rate modeled here. Manually keyed-in cards run higher, at 3.4% + $0.30. If Terminal volume is a big share of your business, treat the numbers on this page as an upper bound for cards.',
          },
          {
            question: 'How is the Stripe ACH fee capped?',
            answer:
              'Stripe charges 0.8% for ACH transfers, capped at $5.00 per transaction. That means on any amount above $625 ($5 ÷ 0.8%), the fee is a flat $5. A $10,000 ACH transfer costs the same $5 fee as a $700 one — which is why ACH is the cheapest option for large invoices by a wide margin.',
          },
          {
            question: 'Are these rates the same in every country?',
            answer:
              'No. The rates in this calculator are for US-based Stripe accounts. Stripe publishes different pricing for each country and occasionally offers volume discounts or custom pricing for large merchants. Always confirm the exact rate on your Stripe Dashboard under "Pricing" before finalizing client invoices.',
          },
          {
            question: 'Does Stripe charge for refunds or failed payments?',
            answer:
              'Refunds cost you the original fee: per Stripe\'s refund documentation, "Stripe\'s processing fees from the original transaction aren\'t returned." The one exception is a reversal — a refund issued immediately after the charge that drops off the customer\'s statement as a cancellation, for which Stripe withholds no fees. Stripe also charges for some dispute (chargeback) cases and certain failed payment attempts. This calculator covers standard successful payment fees only.',
          },
          {
            question: 'Can I pass the Stripe fee on to my customer?',
            answer:
              'Yes, and the reverse calculator above is built for exactly that. Enter the amount you want to keep and it tells you what to charge so the fee is effectively paid by the customer — on a $2,000 net that is a $2,060.04 invoice, a 3.0% markup. Note that some US states have rules around explicit "credit card surcharges," so many businesses instead build the cost into their list price and offer a cash/ACH discount.',
          },
          {
            question: 'Why does a $5 charge cost almost 9% in fees?',
            answer:
              'The fee is $0.445 — $0.30 of it is the fixed fee, which doesn\'t shrink with the ticket — for an effective rate of 8.90%, versus 3.20% at $100. Small charges don\'t pay a higher rate; they pay the same $0.30 on less money to spread it over.',
          },
          {
            question: 'Is ACH cheaper than cards even on small charges?',
            answer:
              'Yes, at every ticket size — a one-cent sweep across $0.01–$10,000 finds no exception (see Decision boundaries for the scan). At a $50 ticket, ACH costs $0.40 versus $1.75 by card; whether slower confirmation and return risk are worth that saving on a small payment is a business call, not arithmetic.',
          },
          {
            question: 'At what charge does the fixed $0.30 stop mattering?',
            answer:
              'At $300 the domestic effective rate is exactly 3.00%, and by $1,000 it is down to 2.93% — within 0.03 points of the floor. Below $14.29 the fixed fee pushes the effective rate past 5%; the thresholds table under Decision boundaries shows that boundary to the cent.',
          },
          {
            question: 'What happens when the fee is bigger than the charge itself?',
            answer:
              'On any domestic card charge at or below $0.30, the formula\'s fee ($0.30 + 2.9%) meets or exceeds the whole charge, so the model clamps your net at $0 and the effective rate reads 100%; the first charge with any net at all is $0.31, which deposits $0.001. The practical reading is simpler: never take cards on amounts this small.',
          },
          {
            question: 'Should I send one $1,200 invoice or twelve $100 payments?',
            answer:
              'One invoice. Twelve $100 card payments cost 12 × $3.20 = $38.40 in fees; a single $1,200 charge costs $35.10 — $3.30 a month, or $39.60 a year, for nothing but billing shape. The fixed fee is a per-transaction tax; fewer transactions, less tax.',
          },
          {
            question: 'How much do I actually lose when a charge is refunded?',
            answer:
              'Per Stripe\'s refund policy the original processing fee isn\'t returned, so a refunded $500 domestic charge costs you its $14.80 fee outright. The exception is a reversal — a refund issued immediately after the charge — for which Stripe withholds no fees.',
          },
          {
            question: 'Does the fee apply to sales tax and shipping I pass through?',
            answer:
              'Yes — the percentage is computed on the full charge, tax and shipping included. A $100 invoice carrying $8 of tax costs $3.43 to collect, not $3.20; the $8 of tax alone costs $0.23. There is no passthrough discount.',
          },
          {
            question: 'Is the 2.9% charged on what I bill or what I receive?',
            answer:
              'On what you bill — the gross. A $100 charge pays $2.90 + $0.30 = $3.20; computed on the net instead it would be $3.11. The distinction compounds in reverse mode, which is why you can\'t recover a fee by taking 2.9% of what\'s left.',
          },
          {
            question: 'What does the international surcharge cost over a year?',
            answer:
              'For a client paying $1,000 a month by international card, fees run $531.60 a year versus $351.60 on the domestic schedule — a $180 annual cross-border premium. Moving that one client to a wire transfer or a local rail is often the cheapest fee reduction available to you.',
          },
          {
            question: 'What is the cheapest way to collect a $25,000 payment?',
            answer:
              'ACH, by a margin that is hard to overstate: the fee is the $5.00 cap — an effective rate of 0.02% — versus $725.30 on a domestic card and $1,100.30 on an international one. That is $720.30 saved on a single invoice for choosing the rail.',
          },
          {
            question: 'Why can\'t I just add 3% to my price to cover the fee?',
            answer:
              'Because the fee is charged on the larger, marked-up amount. 1.03 × $1,000 = $1,030, which nets $999.83 — 17 cents short. The exact gross-up is $1,030.18, which is what Reverse mode computes: (net + $0.30) ÷ (1 − 2.9%).',
          },
          {
            question: 'Do monthly subscriptions cost more to process than annual billing?',
            answer:
              'Yes, because each of the twelve charges carries its own $0.30. A $9 monthly plan costs $6.73 a year in fees (6.23% effective); billed annually at $108 it costs $3.43 (3.18%) — $3.30 per subscriber per year, almost half the processing cost recovered by changing the billing cadence alone.',
          },
          {
            question: 'Is there a volume discount on Stripe\'s published rates?',
            answer:
              'Not on the published schedule — it is flat from the first dollar, with custom pricing available only by negotiation at enterprise volumes. The lever you actually control is payment mix: in Example 6\'s default month, re-routing payments is worth $111.90 a month before any negotiation — the example works the full arithmetic.',
          },
        ]}
      />

      <RelatedCalculators
        links={[
          { href: '/freelance-hourly-rate-calculator/', label: 'Freelance Hourly Rate' },
          { href: '/llc-vs-ccorp-tax-calculator/', label: 'LLC vs C-Corp Tax' },
          { href: '/saas-runway-calculator/', label: 'SaaS Runway' },
        ]}
      />
    </article>
  );
}

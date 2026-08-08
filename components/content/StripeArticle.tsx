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
    { id: 'comparison', label: 'Fee comparison table' },
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
        tool returns three numbers — the fee, the net you'll receive, and the effective percentage
        rate you actually paid. The effective rate matters because on small transactions the fixed
        $0.30 dominates, so a $5 charge doesn't cost 2.9%, it costs closer to <strong>8.9%</strong>.
      </p>

      <h2 id="rates">Current Stripe processing rates (US)</h2>
      <p>
        Stripe occasionally adjusts its published pricing, but the standard rates for US merchants
        have been stable for years. This tool uses the following schedule:
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
            <td><strong>Domestic card</strong> (In-Person / Online)</td>
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
        businesses switch international clients to wire or ACH.
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
        <li>Effective rate: <strong>0.10%</strong> — over 30× cheaper than a card</li>
      </ul>
      <p>
        That last example is the single most important number on this page for any business that
        processes large invoices. On a $5,000 payment, choosing ACH over a domestic card saves you
        <strong> $140</strong>. On $20,000, it saves you <strong>$575</strong>.
      </p>

      <h2 id="reverse">Reverse calculator: &ldquo;What should I charge to net X?&rdquo;</h2>
      <p>
        The forward calculator tells you what you'll receive for a given charge. The reverse
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
        Switch to <strong>&ldquo;Reverse&rdquo;</strong> mode above, enter your desired net, and the
        tool solves for the invoice total. For ACH it handles both the capped and uncapped regimes
        automatically, so your reverse invoice always nets out to the penny.
      </p>

      <h2 id="strategies">How to reduce Stripe fees</h2>
      <ol>
        <li>
          <strong>Use ACH for invoices over $625.</strong> The $5 cap makes ACH dramatically cheaper
          than cards on any meaningful amount. Stripe's own checkout, invoicing, and payment links
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
          A $3 sale loses 12.3% to fees; a $300 sale loses 3.0%. Where possible, group small orders
          into a single larger invoice.
        </li>
      </ol>

      <h2 id="comparison">Stripe fee comparison table</h2>
      <p>Here's what a $1,000 payment looks like under each method:</p>
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
              'When you refund a customer, Stripe returns the original processing fee for card payments in most regions, so you are not double-charged. However, Stripe does charge a fee for some dispute (chargeback) cases and for certain failed payment attempts. This calculator covers standard successful payment fees only.',
          },
          {
            question: 'Can I pass the Stripe fee on to my customer?',
            answer:
              'Yes, and the reverse calculator above is built for exactly that. Enter the amount you want to keep and it tells you what to charge so the fee is effectively paid by the customer. Note that some US states have rules around explicit "credit card surcharges," so many businesses instead build the cost into their list price and offer a cash/ACH discount.',
          },
        ]}
      />

      <RelatedCalculators
        links={[
          { href: '/freelance-hourly-rate-calculator', label: 'Freelance Hourly Rate' },
          { href: '/llc-vs-ccorp-tax-calculator', label: 'LLC vs C-Corp Tax' },
          { href: '/saas-runway-calculator', label: 'SaaS Runway' },
        ]}
      />
    </article>
  );
}

import Faq from '@/components/Faq';
import { ArticleToc, RelatedCalculators } from '@/components/Article';

export default function RunwayArticle() {
  const toc = [
    { id: 'how-it-works', label: 'How SaaS runway works' },
    { id: 'examples', label: 'Step-by-step example' },
    { id: 'growth', label: 'Why growth extends runway' },
    { id: 'benchmarks', label: 'Healthy runway benchmarks' },
    { id: 'strategies', label: 'How to extend your runway' },
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
        where <code>net burn = gross burn − revenue</code>. If you have $500,000 in the bank and you
        burn a net $40,000 per month, you have <strong>12.5 months of runway</strong>.
      </p>
      <p>
        But that naive formula <em>understates</em> your runway when you are growing. Each month your
        MRR rises, your net burn shrinks, and the cash lasts longer than a flat-line projection
        would suggest. The calculator above runs a proper month-by-month simulation: it deducts that
        month's net burn, then grows MRR for the next month, and repeats. On a fast-growing
        business this can extend your reported runway by 30–100% versus the simple division.
      </p>

      <h2 id="examples">Step-by-step example</h2>
      <p>A seed-stage SaaS with:</p>
      <ul>
        <li>Cash: <strong>$500,000</strong></li>
        <li>Monthly gross burn: <strong>$50,000</strong> (mostly salaries + infra)</li>
        <li>Current MRR: <strong>$10,000</strong></li>
        <li>MRR growth: <strong>8% per month</strong></li>
      </ul>
      <p>
        <strong>Naive estimate:</strong> net burn today is $50,000 − $10,000 = $40,000, so
        $500,000 / $40,000 = <strong>12.5 months</strong>.
      </p>
      <p>
        <strong>With growth:</strong> the calculator simulates each month. By month 12 your MRR has
        compounded to ~$25,000, cutting net burn to $25,000. The result: <strong>~17 months of
        runway</strong> — about 35% more than the flat-line math suggests. That extra five months is
        often the difference between closing a clean Series A and a desperate bridge round.
      </p>

      <h2 id="growth">Why growth is a runway multiplier</h2>
      <p>
        The compounding effect of MRR growth on runway is non-linear and easy to underestimate.
        Here's how runway changes with growth rate for the same $500k / $50k-burn / $10k-MRR
        business:
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
          <tr><td>0% (flat)</td><td>13 months</td><td>baseline</td></tr>
          <tr><td>5%</td><td>14 months</td><td>+1 mo</td></tr>
          <tr><td>8%</td><td>17 months</td><td>+4 mo</td></tr>
          <tr><td>12%</td><td>22 months</td><td>+9 mo</td></tr>
          <tr><td>15%</td><td>27 months</td><td>+14 mo</td></tr>
          <tr><td>18% (reaches break-even)</td><td>∞ (profitable by ~mo 17)</td><td>+∞</td></tr>
        </tbody>
      </table>
      <p>
        Notice the inflection point: at <strong>~18%/mo growth</strong> this company actually
        reaches cash-flow break-even before running out of money. That is the magic threshold every
        pre-profit SaaS founder should know by heart.
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
          <tr><td><strong>12–18 months</strong></td><td>Standard post-raise target. Lets you build 12 months before the next raise takes 6.</td></tr>
          <tr><td><strong>18–24 months</strong></td><td>Comfortable. Most Series A/B targets.</td></tr>
          <tr><td><strong>24–36 months</strong></td><td>Strong buffer for weathering downturns.</td></tr>
          <tr><td><strong>&gt; 36 months</strong></td><td>Either a huge round or near-profitability. Some VCs will nudge you to deploy more aggressively.</td></tr>
        </tbody>
      </table>
      <p>
        The rule of thumb is simple: <strong>always keep enough runway to survive an 18-month
        fundraising process</strong>. In a tough market, raising takes 9–12 months, not 3.
      </p>

      <h2 id="strategies">How to extend your runway</h2>
      <ol>
        <li>
          <strong>Cut gross burn surgically.</strong> Runway is the lever you control most directly.
          Reduce headcount (the single biggest line), renegotiate SaaS contracts, and audit cloud
          spend. A 20% burn cut is often faster and cheaper than a 20% revenue increase.
        </li>
        <li>
          <strong>Push annual prepay plans.</strong> Offering a 10–15% discount for annual contracts
          accelerates cash collection without hurting long-term revenue. $50k of MRR converted from
          monthly to annual puts ~$600k in the bank immediately.
        </li>
        <li>
          <strong>Improve gross margin.</strong> If your COGS (hosting, support, third-party APIs)
          is high, every dollar of revenue buys less runway. Move to cheaper infra, automate
          support, and renegotiate vendor costs. A 70% gross margin extends runway meaningfully
          more than a 50% one at the same MRR.
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

      <Faq
        items={[
          {
            question: 'How is SaaS runway calculated?',
            answer:
              'Runway = cash on hand divided by monthly net burn, where net burn = gross cash expenses minus revenue. A more accurate method — which this calculator uses — projects month-by-month, growing MRR each month before deducting the next month\'s burn. That captures the fact that a growing SaaS stretches its runway as revenue rises.',
          },
          {
            question: "What's the difference between gross burn and net burn?",
            answer:
              'Gross burn is the total cash you spend each month on operating expenses (salaries, infrastructure, tools, rent). Net burn is gross burn minus revenue — the actual cash draining from your bank account. A company with $100k gross burn and $60k MRR has a $40k net burn. Runway should always be calculated against net burn, not gross.',
          },
          {
            question: 'How much runway should a startup have?',
            answer:
              'Most operators and investors recommend 18–24 months after a fundraise. That gives you ~12 months of focused building before you need to start the next raise, which itself can take 6 months. Anything under 12 months should be treated as a fire alarm; under 6 months is a crisis requiring immediate burn reduction.',
          },
          {
            question: 'Does MRR growth really extend runway that much?',
            answer:
              'Yes — often dramatically. Because MRR compounds, the back half of your runway has materially lower net burn than the front half. For a business growing MRR 10%+/month, real runway can be 50–100% longer than the simple "cash ÷ today\'s net burn" calculation. The chart in the calculator visualizes this flattening burn curve.',
          },
          {
            question: 'What is break-even MRR?',
            answer:
              "Break-even MRR is the monthly recurring revenue that exactly covers your gross burn — i.e., when net burn hits zero. Below it you burn cash; above it you accumulate cash. Reaching break-even MRR is the single most important milestone for any pre-profit SaaS, because it converts your runway from finite to (effectively) infinite.",
          },
          {
            question: 'Should I include accounts receivable or only cash?',
            answer:
              'For a conservative runway number, use only liquid cash and equivalents in the bank. Signed contracts and accounts receivable that have not yet been collected should be excluded, because collection timing can slip and they are not spendable today. You can run a second, optimistic scenario that includes signed-but-uncollected ARR for comparison.',
          },
        ]}
      />

      <RelatedCalculators
        links={[
          { href: '/stripe-fee-calculator', label: 'Stripe Fee Calculator' },
          { href: '/freelance-hourly-rate-calculator', label: 'Freelance Hourly Rate' },
          { href: '/llc-vs-ccorp-tax-calculator', label: 'LLC vs C-Corp Tax' },
        ]}
      />
    </article>
  );
}

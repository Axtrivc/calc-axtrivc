import Faq from '@/components/Faq';
import { ArticleToc, RelatedCalculators } from '@/components/Article';

export default function FreelanceArticle() {
  const toc = [
    { id: 'how-it-works', label: 'How the hourly rate formula works' },
    { id: 'examples', label: 'Worked example' },
    { id: 'utilization', label: 'The billable-hours trap' },
    { id: 'strategies', label: 'How to raise your rate (legitimately)' },
    { id: 'comparison', label: 'Rate benchmarks by profession' },
    { id: 'faq', label: 'FAQ' },
  ];

  return (
    <article className="prose-article">
      <ArticleToc items={toc} />

      <h2 id="how-it-works">How the freelance hourly rate formula works</h2>
      <p>
        New freelancers almost always underprice themselves — usually by copying the hourly rate
        they had as an employee. That number is wrong because an employee's salary already silently
        covers taxes, benefits, paid time off, equipment, and the 20–40% of work time that isn't
        billable to any client. When you go independent, every one of those costs lands on you.
      </p>
      <p>
        The formula this calculator uses is the industry-standard <strong>&ldquo;bottom-up&rdquo;</strong>
        rate. You start with what you want to <em>actually take home</em>, then add the layers the
        employee salary used to absorb:
      </p>
      <blockquote>
        <p>
          <code>hourly = (takeHome + expenses) / (1 − tax%) / (billable weeks × billable hours per week)</code>
        </p>
      </blockquote>
      <ol>
        <li>
          <strong>Add business expenses.</strong> Software subscriptions, hardware, contractor help,
          home-office, professional insurance, and co-working fees all need to be paid from your
          revenue, not your take-home.
        </li>
        <li>
          <strong>Gross up for taxes.</strong> As a self-employed person you owe both halves of
          self-employment tax (~15.3%) plus ordinary income tax. Dividing by <code>(1 − tax%)</code>
          converts your after-tax target into the pre-tax revenue you need to earn.
        </li>
        <li>
          <strong>Divide by realistic billable hours.</strong> A 40-hour employee might bill 1,800
          hours a year; a freelancer lucky to bill <strong>1,200–1,400</strong>. The rest goes to
          sales, admin, scope creep, and rework.
        </li>
      </ol>

      <h2 id="examples">A worked example</h2>
      <p>Imagine a designer who wants to take home $90,000 a year. They estimate:</p>
      <ul>
        <li>Target take-home: <strong>$90,000</strong></li>
        <li>Business expenses: <strong>$12,000</strong> (Adobe, Figma, new laptop, contractor help)</li>
        <li>Effective tax rate: <strong>30%</strong> (self-employment + income)</li>
        <li>Time off: <strong>25 days</strong> (vacation + holidays + sick)</li>
        <li>Billable hours: <strong>25/week</strong> (the other 15 go to sales, admin, prospecting)</li>
      </ul>
      <p>Plugging in:</p>
      <ul>
        <li>Gross needed = ($90,000 + $12,000) / (1 − 0.30) = <strong>$145,714</strong></li>
        <li>Billable weeks = 52 − (25/5) = <strong>47 weeks</strong></li>
        <li>Billable hours = 47 × 25 = <strong>1,175 hours</strong></li>
        <li>Hourly rate = $145,714 / 1,175 = <strong>$124/hr</strong></li>
        <li>Day rate (8h) = <strong>$992/day</strong></li>
      </ul>
      <p>
        Notice the gap: our designer wants to <em>take home</em> what looks like a comfortable
        mid-career salary, but to deliver that they need to bill <strong>$124/hour</strong> — roughly
        double the hourly equivalent of a $90k salary. This is not greed. This is math.
      </p>

      <h2 id="utilization">The billable-hours trap</h2>
      <p>
        The single biggest lever in this formula — and the one freelancers most consistently
        overestimate — is <strong>billable hours per week</strong>. If you think you'll bill 35 hours
        but actually bill 20, your real rate needs to be <strong>75% higher</strong> than your plan.
      </p>
      <p>Here's where the missing hours typically go:</p>
      <table>
        <thead>
          <tr>
            <th>Activity</th>
            <th>Typical hours/week</th>
          </tr>
        </thead>
        <tbody>
          <tr><td>Sales calls, proposals, follow-ups</td><td>6–10</td></tr>
          <tr><td>Admin, invoicing, bookkeeping</td><td>2–4</td></tr>
          <tr><td>Unpaid revisions / scope creep</td><td>3–6</td></tr>
          <tr><td>Learning, R&amp;D, portfolio</td><td>2–4</td></tr>
          <tr><td>Client comms (Slack, email)</td><td>3–5</td></tr>
        </tbody>
      </table>
      <p>
        Be honest in the calculator. If you set 25 billable hours and consistently bill 18, lower
        the input and re-run the numbers — your required rate will rise, and that's information you
        need before signing the next client.
      </p>

      <h2 id="strategies">How to raise your rate (legitimately)</h2>
      <ol>
        <li>
          <strong>Increase billable utilization.</strong> The fastest path to a higher effective
          rate isn't raising your number — it's spending less time on unpaid work. Productize your
          service, write templates for proposals, and fire low-margin clients who consume
          disproportionate admin time.
        </li>
        <li>
          <strong>Shift from hourly to value-based or retainer pricing.</strong> Hourly punishes you
          for being fast. A $5,000 fixed-price engagement that takes you 20 hours is a $250/hr rate,
          even if your published hourly is $120.
        </li>
        <li>
          <strong>Specialize.</strong> Generalists compete on price. A &ldquo;Stripe billing
          implementation specialist&rdquo; bills 2–3× what a &ldquo;full-stack developer&rdquo; does
          for the same hours.
        </li>
        <li>
          <strong>Bundle expenses into the rate.</strong> Don't itemize software or hardware as
          pass-throughs; roll them into your rate so clients see one clean number.
        </li>
        <li>
          <strong>Raise rates for new clients first, existing clients annually.</strong> A 10% bump
          on every new client compounds quickly and is far less disruptive than re-pricing your
          whole book at once.
        </li>
      </ol>

      <h2 id="comparison">Rate benchmarks by profession (US, 2025)</h2>
      <p>Ballpark ranges for experienced independents — your geography and niche will move these significantly:</p>
      <table>
        <thead>
          <tr>
            <th>Role</th>
            <th>Hourly range</th>
            <th>Day rate range</th>
          </tr>
        </thead>
        <tbody>
          <tr><td>Junior designer / writer</td><td>$40–$70</td><td>$320–$560</td></tr>
          <tr><td>Senior designer / copywriter</td><td>$90–$175</td><td>$720–$1,400</td></tr>
          <tr><td>Generalist software developer</td><td>$80–$150</td><td>$640–$1,200</td></tr>
          <tr><td>Specialist developer (AI, payments, infra)</td><td>$150–$300</td><td>$1,200–$2,400</td></tr>
          <tr><td>Fractional CMO / CFO / CTO</td><td>$200–$400</td><td>$1,600–$3,200</td></tr>
          <tr><td>Business / strategy consultant</td><td>$150–$350</td><td>$1,200–$2,800</td></tr>
        </tbody>
      </table>

      <Faq
        items={[
          {
            question: 'What hourly rate should I charge as a freelancer?',
            answer:
              'There is no universal number — it depends on your target take-home pay, expenses, tax rate, and billable hours. The calculator above computes your specific minimum. As a rough rule, most experienced US freelancers land between $75 and $200 per hour, while specialists (developers, designers, consultants) often exceed $200/hr.',
          },
          {
            question: 'How many billable hours can a freelancer really work in a week?',
            answer:
              'Most full-time independents bill 20–30 hours per week, not 40. The rest goes to sales, admin, client communication, unpaid revisions, and professional development. If you bill more than 30 hours you are either extremely efficient or under-investing in finding your next client. Use a realistic number in the calculator or you will underprice yourself.',
          },
          {
            question: 'Should I charge hourly or per project?',
            answer:
              'Hourly protects you against scope creep but punishes you for speed and expertise. Project-based (fixed price) pricing usually earns experienced freelancers more because clients pay for the outcome, not the hours. Many independents quote a project price based on a high internal hourly rate, then track actual hours to verify profitability.',
          },
          {
            question: 'How does self-employment tax affect my freelance rate?',
            answer:
              'As a self-employed person you pay both halves of Medicare and Social Security — about 15.3% — plus ordinary federal and state income tax. A combined effective rate of 25–35% is typical for a profitable solo business. The calculator divides your take-home target by (1 − tax%) to gross it up to the pre-tax revenue you need to earn.',
          },
          {
            question: 'Why is my freelance rate so much higher than an employee salary?',
            answer:
              'Because your rate has to cover things an employer used to pay: payroll taxes, benefits, paid time off, equipment, and — critically — the 40–60% of working time you cannot bill to any client. A $100k employee salary often translates to a $100+/hr freelance rate, not the $50/hr you might expect from a naive division.',
          },
          {
            question: "What's the difference between a day rate and an hourly rate?",
            answer:
              'A day rate is simply your hourly rate multiplied by 8 (a standard workday). Many clients prefer day rates for longer engagements because they are easier to budget. The calculator above shows both so you can quote in whichever format the client expects.',
          },
        ]}
      />

      <RelatedCalculators
        links={[
          { href: '/stripe-fee-calculator', label: 'Stripe Fee Calculator' },
          { href: '/llc-vs-ccorp-tax-calculator', label: 'LLC vs C-Corp Tax' },
          { href: '/saas-runway-calculator', label: 'SaaS Runway' },
        ]}
      />
    </article>
  );
}

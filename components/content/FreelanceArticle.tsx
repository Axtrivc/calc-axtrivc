import Faq from '@/components/Faq';
import { ArticleToc, RelatedCalculators } from '@/components/Article';

export default function FreelanceArticle() {
  const toc = [
    { id: 'how-it-works', label: 'How the hourly rate formula works' },
    { id: 'examples', label: 'Worked examples' },
    { id: 'scenarios', label: 'Three more scenarios' },
    { id: 'utilization', label: 'The billable-hours trap' },
    { id: 'strategies', label: 'How to raise your rate (legitimately)' },
    { id: 'comparison', label: 'Illustrative rate ranges' },
    { id: 'decision-boundaries', label: 'Decision boundaries' },
    { id: 'glossary', label: 'Glossary' },
    { id: 'faq', label: 'FAQ' },
  ];

  return (
    <article className="prose-article">
      <ArticleToc items={toc} />

      <h2 id="how-it-works">How the freelance hourly rate formula works</h2>
      <p>
        New freelancers almost always underprice themselves — usually by copying the hourly rate
        they had as an employee. That number is wrong because an employee&apos;s salary already silently
        covers taxes, benefits, paid time off, equipment, and the share of working time that
        isn&apos;t billable to any client — over a third of a 40-hour week at this model&apos;s default
        of 25 billed hours. When you go independent, every one of those costs lands on you.
      </p>
      <p>
        The formula this calculator uses is the industry-standard <strong>&ldquo;bottom-up&rdquo;</strong>
        rate. You start with what you want to <em>actually take home</em>, then add the layers the
        employee salary used to absorb:
      </p>
      <blockquote>
        <p>
          <code>hourly = (expenses + takeHome / (1 − tax%)) / (billable weeks × billable hours per week)</code>
        </p>
      </blockquote>
      <ol>
        <li>
          <strong>Set aside business expenses.</strong> Software subscriptions, hardware, contractor help,
          home-office, professional insurance, and co-working fees are deductible cash costs — paid
          from pre-tax revenue, not from your take-home.
        </li>
        <li>
          <strong>Gross up for taxes — your pay only.</strong> As a self-employed person you owe both halves
          of self-employment tax (~15.3%) plus ordinary income tax. Dividing your take-home by{' '}
          <code>(1 − tax%)</code> converts it into the pre-tax revenue that funds it. Expenses are{' '}
          <em>added after</em> the gross-up: money spent on deductible costs is never taxed, and
          taxing it would inflate your revenue target by exactly E·t/(1−t) — about $5,143/yr on
          $12,000 of expenses at a 30% rate.
        </li>
        <li>
          <strong>Divide by realistic billable hours.</strong> A 2,080-hour FTE year minus 25 PTO days
          leaves 1,880 working hours; at 25–30 billed hours per week that is{' '}
          <strong>1,175–1,410 billable hours</strong>. The rest goes to sales, admin, scope creep, and rework.
        </li>
      </ol>

      <h2 id="examples">Worked examples</h2>
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
        <li>Gross needed = $12,000 + $90,000 ÷ (1 − 0.30) = $12,000 + $128,571 = <strong>$140,571</strong></li>
        <li>Billable weeks = 52 − (25/5) = <strong>47 weeks</strong></li>
        <li>Billable hours = 47 × 25 = <strong>1,175 hours</strong></li>
        <li>Hourly rate = $140,571 / 1,175 = <strong>$119.64/hr</strong> (quote $120)</li>
        <li>Day rate (8h) = $119.64 × 8 = <strong>$957/day</strong></li>
      </ul>
      <p>
        Notice the gap: our designer wants to <em>take home</em> what looks like a comfortable
        mid-career salary, but to deliver that they need to bill <strong>$120/hour</strong> — 2.8×
        the $43.27/hr a $90,000 salary implies across 2,080 hours. This is not greed. This is math.
      </p>

      <h3>From salary to rate: repricing a $75,000 salary</h3>
      <p>
        A marketer leaves a $75,000 salaried job and — wanting a raise in net terms, not just gross
        — sets a <strong>$75,000 take-home</strong> target. Their estimated stack: $6,500 of annual
        expenses (software, laptop amortization, liability insurance), a 28% effective combined tax
        rate, 20 days off a year, and 22 billable hours a week while they are still building a
        pipeline. Step by step:
      </p>
      <ul>
        <li>Grossed-up pay = $75,000 ÷ (1 − 0.28) = $75,000 ÷ 0.72 = <strong>$104,167</strong></li>
        <li>Gross revenue = $6,500 + $104,167 = <strong>$110,667</strong></li>
        <li>Billable weeks = 52 − (20 ÷ 5) = <strong>48 weeks</strong></li>
        <li>Billable hours = 48 × 22 = <strong>1,056 hours</strong> (50.8% utilization)</li>
        <li>Hourly rate = $110,667 ÷ 1,056 = <strong>$104.80/hr</strong> · day rate <strong>$838</strong></li>
      </ul>
      <p>
        The salary-implied comparison is $75,000 ÷ 2,080 = <strong>$36.06/hr</strong> — the honest
        floor is 2.91× that. And note where the hours go: this plan works a 1,920-hour year
        (48 × 40) but bills only 1,056 of them; the other <strong>864 hours</strong> are selling,
        admin, and professional development that the salaried job used to absorb invisibly.
      </p>

      <h3>The year-one audit: planning at 25, living at 18</h3>
      <p>
        The most useful way to use this model is forensically — after the fact. A consultant
        planned year one around an $80,000 take-home, $10,000 of expenses, 30% tax, 20 days off,
        and 25 billable hours a week:
      </p>
      <ul>
        <li>Gross needed = $10,000 + $80,000 ÷ 0.70 = <strong>$124,286</strong></li>
        <li>Hours = 48 × 25 = <strong>1,200</strong> → floor = <strong>$103.57/hr</strong>; they quoted <strong>$105</strong></li>
      </ul>
      <p>
        The year delivered only <strong>18 billable hours a week</strong> — sales took longer than
        planned, and two clients dragged revisions. At $105/hr across the real 864 hours
        (48 × 18), revenue came to <strong>$90,720</strong>, which after $10,000 of expenses and 30%
        tax is <strong>$56,504 of take-home — $23,496 short</strong> of target. The honest floor at
        18 hours was <strong>$143.85/hr</strong> all along; equivalently, the $105 quote only works
        at 1,184 billed hours a year, i.e. <strong>24.7 hours a week</strong> — almost exactly the
        plan they missed. The audit&apos;s verdict: utilization (57.7% planned, 41.5% delivered) —
        not the quote — is what broke the year.
      </p>

      <h2 id="scenarios">Three more scenarios, one model</h2>
      <p>
        The same five inputs price very different working lives. Each line below is the exact
        arithmetic from the formula above — nothing hand-waved. Load any of them into the
        calculator and every number reproduces.
      </p>

      <h3>Part-time transition (keeping the day job)</h3>
      <p>
        A developer moonlighting 12 billed hours a week, targeting $24,000 of extra take-home,
        $3,000 of expenses (laptop amortization, software), a 22% effective combined rate, and 10
        non-working days:
      </p>
      <ul>
        <li>Gross = $3,000 + $24,000 ÷ 0.78 = <strong>$33,769</strong></li>
        <li>Hours = (52 − 2) × 12 = <strong>600 hours</strong> (28.8% of an FTE year)</li>
        <li>Rate = $33,769 ÷ 600 = <strong>$56.28/hr</strong> · day rate <strong>$450</strong></li>
      </ul>
      <p>
        The lesson: scarcity of hours, not the size of the target, dominates the rate. At 12 hours
        a week even a modest goal demands a senior-sounding number.
      </p>

      <h3>Agency to independent</h3>
      <p>
        A senior specialist leaving an agency, targeting $120,000 take-home, $18,000 of expenses
        (health insurance, gear, CPA, co-working), 32% combined tax, 30 days off, billing 30 hours
        a week:
      </p>
      <ul>
        <li>Gross = $18,000 + $120,000 ÷ 0.68 = <strong>$194,471</strong></li>
        <li>Hours = (52 − 6) × 30 = <strong>1,380 hours</strong> (66.3% utilization)</li>
        <li>Rate = $194,471 ÷ 1,380 = <strong>$140.92/hr</strong> · day rate <strong>$1,127</strong></li>
      </ul>
      <p>
        Note how little the agency &ldquo;hourly&rdquo; tells you: winning 1,380 billable hours a
        year while covering your own benefits is a different job than sitting inside someone
        else&apos;s pipeline.
      </p>

      <h3>The sabbatical year (work hard, then vanish)</h3>
      <p>
        A writer who compresses the year: 50 days off taken as one ten-week block, 32 billed hours
        a week while working, $70,000 take-home, $9,000 expenses, 28% tax:
      </p>
      <ul>
        <li>Gross = $9,000 + $70,000 ÷ 0.72 = <strong>$106,222</strong></li>
        <li>Hours = (52 − 10) × 32 = <strong>1,344 hours</strong> (64.6% utilization)</li>
        <li>Rate = $106,222 ÷ 1,344 = <strong>$79.03/hr</strong> · day rate <strong>$632</strong></li>
      </ul>
      <p>
        Ten weeks off costs less than intuition suggests when the working weeks are dense: the
        long break is mostly paid for by billing 32 instead of 25 hours — not by a scary rate.
      </p>

      <h2 id="utilization">The billable-hours trap</h2>
      <p>
        The single biggest lever in this formula — and the one freelancers most consistently
        overestimate — is <strong>billable hours per week</strong>. If you think you'll bill 35 hours
        but actually bill 20, your real rate needs to be <strong>75% higher</strong> than your plan.
      </p>
      <p>
        Here's where the missing hours typically go (illustrative planning ranges, not survey
        data — audit your own calendar for the real split):
      </p>
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
        The cleanest way to see how non-billable time amplifies a rate is the{' '}
        <strong>utilization multiplier</strong>: how many times bigger your required rate is than
        the naive division of the same revenue by 2,080 hours. Every row below is pure model
        arithmetic (25 PTO days pinned) — no market data involved:
      </p>
      <table>
        <thead>
          <tr>
            <th>Billed h/wk</th>
            <th>Billable hrs/yr</th>
            <th>Utilization vs 2,080</th>
            <th>Rate multiple vs ÷2,080</th>
          </tr>
        </thead>
        <tbody>
          <tr><td>40</td><td>1,880</td><td>90.4%</td><td>1.11×</td></tr>
          <tr><td>30</td><td>1,410</td><td>67.8%</td><td>1.48×</td></tr>
          <tr><td>25</td><td>1,175</td><td>56.5%</td><td>1.77×</td></tr>
          <tr><td>20</td><td>940</td><td>45.2%</td><td>2.21×</td></tr>
          <tr><td>15</td><td>705</td><td>33.9%</td><td>2.95×</td></tr>
        </tbody>
      </table>
      <p>
        The multiple is just 2,080 ÷ billable hours: at the default 25 billed hours you must earn
        1.77 years of &ldquo;employee-equivalent&rdquo; value in one, and at 15 hours nearly three.
        That is the entire, arithmetic reason freelance rates look &ldquo;expensive&rdquo; next to a
        salary divided by 2,080.
      </p>
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

      <h2 id="comparison">Illustrative rate ranges by profession</h2>
      <p>
        Order-of-magnitude orientation only — these are illustrative ranges, not survey data, and
        they play no role in the calculator above. Your niche, geography, sales skill, and the
        cost-stack math you just ran will move the real number more than any table can:
      </p>
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
      <p>
        Day rates are exactly 8 × the hourly figure, per the convention the model uses. Treat a
        range that contains your computed minimum as a sanity check, nothing more: if your
        bottom-up floor sits above these bands, the model is telling you your cost stack or
        capacity — not the market — is the problem to solve.
      </p>

      <h2 id="decision-boundaries">Decision boundaries: when this model applies</h2>
      <p>
        This calculator computes a <strong>floor</strong> — the lowest rate at which your year
        lands on target. Use it when you sell time (hourly, day rate, retainer) as a solo
        operator and can estimate your cost stack. Reach for a different tool when the question
        changes shape: comparing a specific 1099 offer to a W-2 salary is the{' '}
        <a href="/1099-vs-w2-calculator/">1099 vs W-2 calculator</a>&apos;s job; once you elect
        S-corp taxation and split pay into salary and distributions, the single flat tax input
        here stops describing your situation (see the{' '}
        <a href="/s-corp-tax-calculator/">S-Corp tax calculator</a>); and if you price pure
        value-based engagements, this floor still bounds your minimum — the ceiling comes from
        the client, not from this arithmetic.
      </p>
      <p>
        Within the model, three capacity thresholds mark where a plan stops being a plan. Every
        value in the table was produced by scanning the engine — recomputing the full model at
        every integer weekly-hours value from 1 to 80, separately at five PTO levels, with the
        money inputs pinned at the $90,000 / $12,000 / 30% baseline. Each threshold is the first
        crossing point of its condition (reproduce any row by setting weekly hours in the
        calculator and reading the utilization readout):
      </p>
      <table>
        <thead>
          <tr>
            <th>PTO days/yr</th>
            <th>Billable weeks</th>
            <th>Utilization reaches 60% at</th>
            <th>Working year fully billed at</th>
            <th>Exceeds the 2,080-h FTE year at</th>
          </tr>
        </thead>
        <tbody>
          <tr><td>0</td><td>52</td><td>24 h/wk</td><td>40 h/wk</td><td>41 h/wk</td></tr>
          <tr><td>15</td><td>49</td><td>26 h/wk</td><td>40 h/wk</td><td>43 h/wk</td></tr>
          <tr><td>25 (default)</td><td>47</td><td>27 h/wk</td><td>40 h/wk</td><td>45 h/wk</td></tr>
          <tr><td>40</td><td>44</td><td>29 h/wk</td><td>40 h/wk</td><td>48 h/wk</td></tr>
          <tr><td>60</td><td>40</td><td>32 h/wk</td><td>40 h/wk</td><td>53 h/wk</td></tr>
        </tbody>
      </table>
      <ul>
        <li>
          <strong>Below the 60% line, capacity — not price — is your problem.</strong> The model
          flags this zone because attacking utilization (sales process, scope control) moves the
          floor more than any repricing conversation can. At the default 25 PTO days, 26 h/wk
          gives 58.8% utilization and a $115.03 floor; one more weekly hour (27) crosses to 61.0%.
        </li>
        <li>
          <strong>40 h/wk is the sold-out line, whatever your PTO.</strong> Billed hours and the
          working year both scale with (52 − PTO÷5) weeks, so &ldquo;bill every working hour&rdquo;
          is reached at exactly 40 h/wk for every PTO level — the scan confirms zero slack hours
          at 40 and 47 slack at 39 (default PTO). A plan with no room for sales and admin is a
          plan that breaks the moment a contract pauses.
        </li>
        <li>
          <strong>Past the 100% line, the hours don&apos;t exist.</strong> At 45 h/wk and default
          PTO you have specified 2,115 billed hours inside a 2,080-hour year (101.7%
          &ldquo;utilization&rdquo;) — a rate built on those hours is a rate you cannot collect.
          More time off pushes the line further out (53 h/wk at 60 PTO days) only because the
          remaining weeks are denser.
        </li>
      </ul>
      <p>
        The same scan answers <em>which input to fix first</em>. Holding the others at the
        baseline and moving one input at a time, the floor responds in this order:
      </p>
      <table>
        <thead>
          <tr>
            <th>Input moved</th>
            <th>Floor at baseline ($119.64)</th>
            <th>Change</th>
          </tr>
        </thead>
        <tbody>
          <tr><td>Billable hours 25 → 20</td><td>$149.54</td><td>+25.0%</td></tr>
          <tr><td>Take-home 90k → 108k</td><td>$141.52</td><td>+18.3%</td></tr>
          <tr><td>Tax 30% → 36%</td><td>$129.89</td><td>+8.6%</td></tr>
          <tr><td>Tax 30% → 24%</td><td>$111.00</td><td>−7.2%</td></tr>
          <tr><td>Vacation 25 → 30 days</td><td>$122.24</td><td>+2.2%</td></tr>
          <tr><td>Expenses 12k → 14.4k</td><td>$121.68</td><td>+1.7%</td></tr>
        </tbody>
      </table>
      <p>
        Capacity dominates: losing a single weekly hour (25 → 24) lifts the floor by 4.2%
        ($119.64 → $124.62) — roughly a three-point tax-rate swing. And the
        marginal value of a recovered hour fades fast — moving from 15 to 16 h/wk cuts the floor
        by $12.46 (−6.3%, from $199.39 to $186.93), while 35 → 36 cuts it by only $2.37 (−2.8%).
        The first recoverable hour is worth roughly five of the last ones, which is why the model
        pushes low-utilization operators to fix pipeline before price.
      </p>

      <h2 id="glossary">Glossary</h2>
      <dl className="mt-2 space-y-5">
        <div>
          <dt className="font-semibold text-slate-900 dark:text-slate-100">Take-home target</dt>
          <dd className="mt-1 leading-relaxed text-slate-600 dark:text-slate-300">
            The net cash you want left after tax and business expenses — the number that pays your
            rent. At the baseline inputs, $90,000 of it requires $140,571 of gross revenue.
          </dd>
        </div>
        <div>
          <dt className="font-semibold text-slate-900 dark:text-slate-100">Effective combined tax rate</dt>
          <dd className="mt-1 leading-relaxed text-slate-600 dark:text-slate-300">
            Your self-employment plus income tax expressed as one flat percentage of pay. The model
            applies it only to your pay: at the 30% default, each dollar of take-home requires
            $1.43 of pre-tax revenue.
          </dd>
        </div>
        <div>
          <dt className="font-semibold text-slate-900 dark:text-slate-100">Self-employment tax</dt>
          <dd className="mt-1 leading-relaxed text-slate-600 dark:text-slate-300">
            The ~15.3% Social Security and Medicare contribution a self-employed person pays in
            full — both the employee and employer halves an employer would otherwise split.
          </dd>
        </div>
        <div>
          <dt className="font-semibold text-slate-900 dark:text-slate-100">Gross-up</dt>
          <dd className="mt-1 leading-relaxed text-slate-600 dark:text-slate-300">
            Dividing a net amount by (1 − tax rate) to find the pre-tax amount that funds it —
            the step that converts a take-home wish into a revenue target.
          </dd>
        </div>
        <div>
          <dt className="font-semibold text-slate-900 dark:text-slate-100">Gross revenue needed</dt>
          <dd className="mt-1 leading-relaxed text-slate-600 dark:text-slate-300">
            The full pre-tax amount your practice must invoice for the year: expenses plus grossed-up
            pay. The same figure divided by 12 is the monthly revenue target ($11,714 at the baseline).
          </dd>
        </div>
        <div>
          <dt className="font-semibold text-slate-900 dark:text-slate-100">Billable hours</dt>
          <dd className="mt-1 leading-relaxed text-slate-600 dark:text-slate-300">
            Hours you can actually invoice to clients — not hours worked. The 25/week default
            compounds to 1,175 hours a year after 25 days off; sales, admin, and learning are
            deliberately outside it.
          </dd>
        </div>
        <div>
          <dt className="font-semibold text-slate-900 dark:text-slate-100">Utilization</dt>
          <dd className="mt-1 leading-relaxed text-slate-600 dark:text-slate-300">
            Billable hours as a share of the 2,080-hour FTE year (56.5% at the baseline). Below
            ~60%, capacity rather than price is usually the binding constraint.
          </dd>
        </div>
        <div>
          <dt className="font-semibold text-slate-900 dark:text-slate-100">Day rate</dt>
          <dd className="mt-1 leading-relaxed text-slate-600 dark:text-slate-300">
            A quoting convention: hourly × 8. It is not a capacity claim — a sold day consumes 8
            real hours, so 25 billable hours a week hold about three sold days (3.13), not five.
          </dd>
        </div>
        <div>
          <dt className="font-semibold text-slate-900 dark:text-slate-100">Monthly gross</dt>
          <dd className="mt-1 leading-relaxed text-slate-600 dark:text-slate-300">
            Annual gross revenue ÷ 12 — a revenue target, not a salary. At the baseline it is
            $11,714 against $7,500 of monthly take-home; the difference is tax and expenses.
          </dd>
        </div>
        <div>
          <dt className="font-semibold text-slate-900 dark:text-slate-100">Scope creep</dt>
          <dd className="mt-1 leading-relaxed text-slate-600 dark:text-slate-300">
            Un-priced expansion of agreed work — extra revisions, &ldquo;quick&rdquo; calls, edge
            cases. It attacks utilization directly, which is why it raises your true floor even
            though your quoted rate never changes.
          </dd>
        </div>
        <div>
          <dt className="font-semibold text-slate-900 dark:text-slate-100">Bottom-up pricing</dt>
          <dd className="mt-1 leading-relaxed text-slate-600 dark:text-slate-300">
            Pricing from your own cost stack — take-home, expenses, tax, capacity — outward, as
            this model does. The alternative, copying market rates or an old salary, prices nothing
            and is how freelancers underprice themselves.
          </dd>
        </div>
        <div>
          <dt className="font-semibold text-slate-900 dark:text-slate-100">Value-based pricing</dt>
          <dd className="mt-1 leading-relaxed text-slate-600 dark:text-slate-300">
            Setting fees by the outcome&apos;s worth to the client rather than your hours. It sets
            the ceiling; a bottom-up floor still tells you the minimum at which the engagement is
            worth accepting at all.
          </dd>
        </div>
      </dl>

      <Faq
        items={[
          {
            question: 'What hourly rate should I charge as a freelancer?',
            answer:
              'There is no universal number — it depends on your target take-home pay, expenses, tax rate, and billable hours. The calculator above computes your specific minimum from those five inputs. The illustrative ranges earlier in this guide show how far specialization and seniority move what clients will pay, but your floor comes from your own cost stack, not from any market table.',
          },
          {
            question: 'How many billable hours can a freelancer really work in a week?',
            answer:
              'The model lets you decide — but be conservative. A 2,080-hour FTE year minus 25 days off leaves 1,880 working hours; at 25 billed hours a week that is 1,175 billable hours, and everything else goes to sales, admin, client communication, and professional development. If you bill more than 30 hours you are either extremely efficient or under-investing in finding your next client. Use a realistic number in the calculator or you will underprice yourself.',
          },
          {
            question: 'Should I charge hourly or per project?',
            answer:
              'Hourly protects you against scope creep but punishes you for speed and expertise. Project-based (fixed price) pricing usually earns experienced freelancers more because clients pay for the outcome, not the hours. Many independents quote a project price based on a high internal hourly rate, then track actual hours to verify profitability.',
          },
          {
            question: 'How does self-employment tax affect my freelance rate?',
            answer:
              'As a self-employed person you pay both halves of Medicare and Social Security — about 15.3% — plus ordinary federal and state income tax. Your exact combined rate depends on state, filing status, and deductions, which is why the calculator leaves it as an input: it divides your take-home target by (1 − tax%) to gross your pay up to pre-tax revenue, while your deductible business expenses are added after the gross-up.',
          },
          {
            question: 'Why is my freelance rate so much higher than an employee salary?',
            answer:
              'Because your rate has to cover things an employer used to pay: payroll taxes, benefits, paid time off, equipment, and — critically — the working time you cannot bill to any client (37.5% of a 40-hour week at the default 25 billed hours). Run the model on a $100,000 take-home target with its default settings and the required rate is about $132/hr, not the $48/hr of dividing $100,000 by 2,080 hours.',
          },
          {
            question: "What's the difference between a day rate and an hourly rate?",
            answer:
              'A day rate is your hourly rate multiplied by 8 (a standard workday) — a quoting conversion, since the hourly already amortizes your non-billable time. But note the capacity side: a sold day consumes 8 full hours, so at 25 billed hours a week you can deliver roughly three day-rate days, not five. The calculator above shows both so you can quote in whichever format the client expects.',
          },
          {
            question: 'What take-home target should I enter?',
            answer:
              'Start from the net pay your last salaried year actually deposited — after tax, before any freelance costs — then adjust for what you genuinely need. At the baseline inputs, a $90,000 target requires $140,571 of gross revenue, which is exactly the gap most first-time pricing misses.',
          },
          {
            question: 'Is the tax field my marginal bracket?',
            answer:
              'No — it is your effective combined rate: total tax divided by pay, blending self-employment and income tax in one flat percentage. The distinction is worth real money: at baseline capacity and expenses, moving the input from 30% to 35% lifts the required floor from $119.64 to $128.05/hr.',
          },
          {
            question: 'What happens if I set business expenses to zero?',
            answer:
              'At the baseline, zeroing the $12,000 of expenses drops the floor from $119.64 to $109.42/hr — but that saving is fictional if you actually buy software, insurance, or hardware. Enter your honest annual estimate; the model treats expenses as pre-tax cash costs either way.',
          },
          {
            question: 'How much time off can I afford before my rate explodes?',
            answer:
              'Less dramatically than you might fear: at baseline capacity the floor is $119.64/hr at 25 days off, $127.79 at 40 days, and $140.57 at 60 days — each extra week of vacation costs about $2.60/hr. The curve only turns serious for near-sabbatical plans (90 days off pushes it to $165.38).',
          },
          {
            question: 'I can bill 30 hours a week — is that too many?',
            answer:
              'It is aggressive but coherent: 30 billed hours is 67.8% utilization and lowers the baseline floor to $99.70/hr. The hard line is 40, where every working hour is billed and nothing remains for sales or admin — the scan in the decision-boundaries section shows that line is independent of how much vacation you take.',
          },
          {
            question: 'What if I can only bill 10 hours a week?',
            answer:
              'Then scarcity dominates: the baseline cost stack over just 470 annual hours demands $299.09/hr. At that utilization (22.6%) the model is telling you to either grow capacity, cut the take-home target, or treat the practice as part-time income rather than a full price floor.',
          },
          {
            question: 'Is $150/hour too much to charge?',
            answer:
              'No such thing exists in the abstract — only your floor versus what your market bears. For calibration: at baseline expenses, tax, and 25 h/wk capacity, $150/hr funds $114,975 of take-home, so it is a serious senior-specialist price, not an entry one.',
          },
          {
            question: 'How do I turn an hourly floor into a retainer?',
            answer:
              'Price the capacity you are reserving, not a vague relationship: 10 hours a week held across the 47 billable-week year prices out at $56,229 — about $4,686/month at the baseline floor. Structure the retainer so unused hours expire — you are selling guaranteed access, not a bank of hours.',
          },
          {
            question: 'How do I convert this rate into a fixed project price?',
            answer:
              'Estimate the hours the deliverable takes a practitioner of your speed, then multiply by your floor: 60 hours at $119.64/hr comes to about $7,178. Add an explicit buffer for revision rounds instead of hoping, and track actual hours against it — the ratio is your personal scope-creep constant.',
          },
          {
            question: "What's the difference between monthly gross and monthly take-home?",
            answer:
              'Monthly gross is your annual revenue target divided by 12 — $11,714 at the baseline — while take-home is what survives tax and expenses, $7,500 a month on the same inputs. Quoting clients the gross figure as if it were salary is the classic way to feel rich and stay broke.',
          },
          {
            question: 'Does the model account for retirement contributions?',
            answer:
              'Not separately — retirement savings must ride inside your inputs. Folding $20,000 of annual contributions into the take-home target raises the baseline floor from $119.64 to $143.95/hr; the Solo 401(k) calculator works out which vehicle and how much to contribute.',
          },
          {
            question: 'My expenses swing a lot during the year — does that break the model?',
            answer:
              'No: enter an annual estimate and re-run when the picture changes, because the sensitivity is modest — every $3,000 of annual expenses is $2.55/hr at baseline capacity. A mid-year equipment purchase does not need a reprice; a persistent change in your stack does.',
          },
          {
            question: 'How is this different from the 1099 vs W-2 calculator?',
            answer:
              "This tool sets your required rate from your own costs; the 1099 vs W-2 calculator converts a specific rate and a specific salary into an apples-to-apples comparison for offer evaluation. Use this one to name a number, that one to judge someone else's.",
          },
          {
            question: 'Should I raise my rate or my billable hours?',
            answer:
              'Below roughly 60% utilization, hours: the marginal recovered weekly hour cuts the baseline floor by 6.3% when you move from 15 to 16 hours, but only 2.8% moving from 35 to 36. Once utilization is healthy, further capacity buys little — that is when repricing conversations pay more.',
          },
          {
            question: 'Do I need to redo this calculation every year?',
            answer:
              "Yes, because the inputs drift: an effective tax rate that moves from 25% to 35% lifts the baseline floor from $112.34 to $128.05/hr, and target or expense creep compounds on top. Five minutes annually with last year's actuals beats discovering the shortfall in December.",
          },
          {
            question: 'Can I use this model if I still have a W-2 job?',
            answer:
              'Yes — it prices any slice of independent work. The moonlighting scenario in this guide (a $24,000 target, $3,000 of expenses, 22% tax, 10 days off, 12 billable hours a week) computes to $56.28/hr, showing how scarce part-time hours, not ambition, set the number.',
          },
        ]}
      />

      <RelatedCalculators
        links={[
          { href: '/1099-vs-w2-calculator/', label: '1099 vs W-2 Calculator' },
          { href: '/quarterly-estimated-tax-calculator/', label: 'Quarterly Estimated Tax Calculator' },
          { href: '/stripe-fee-calculator/', label: 'Stripe Fee Calculator' },
          { href: '/self-employment-tax-calculator/', label: 'Self-Employment Tax Calculator' },
          { href: '/solo-401k-calculator/', label: 'Solo 401(k) Calculator' },
          { href: '/s-corp-tax-calculator/', label: 'S-Corp Tax Calculator' },
        ]}
      />
    </article>
  );
}

import Faq from '@/components/Faq';
import { ArticleToc, RelatedCalculators } from '@/components/Article';
import { SCORP_CONSTANTS } from '@/lib/scorp';
import { TAX_CONSTANTS } from '@/lib/tax';
import { numFmt, pct, usd } from '@/lib/format';

export default function ScorpArticle() {
  const toc = [
    { id: 'mechanics', label: 'How the S-Corp split works' },
    { id: 'reasonable-salary', label: 'What makes a salary "reasonable"' },
    { id: 'worked-example', label: 'Worked example at $200k' },
    { id: 'decision', label: 'When the election actually pays' },
    { id: 'beyond-model', label: 'Costs beyond this model' },
    { id: 'process', label: 'How to elect (and unwind)' },
    { id: 'caveats', label: 'Important caveats' },
    { id: 'faq', label: 'FAQ' },
  ];

  return (
    <article className="prose-article">
      <ArticleToc items={toc} />

      <h2 id="mechanics">How the S-Corp split actually works</h2>
      <p>
        An S-Corp is not a different kind of company — it is a <strong>tax election</strong> layered
        on top of an LLC (or corporation). What changes is how profit reaches your pocket. Without
        the election, 100% of an LLC's net income is <strong>self-employment income</strong>: every
        dollar carries the full {pct(TAX_CONSTANTS.seRate * 100, 1)} SE tax (Social Security +
        Medicare, both halves) on top of income tax. With the election, your extraction splits into
        two streams that the tax law treats very differently:
      </p>
      <ol>
        <li>
          <strong>W-2 salary.</strong> You become an employee of your own company. The salary pays
          both halves of FICA — {pct(SCORP_CONSTANTS.ssRate * 100, 1)} Social Security (up to the
          {' ' + numFmt(SCORP_CONSTANTS.ssWageBase, 0)} wage base) + {pct(SCORP_CONSTANTS.medicareRate * 100, 2)} Medicare
          (uncapped), plus the {pct(SCORP_CONSTANTS.addlMedicareRate * 100, 1)} Additional Medicare
          Tax above {usd(SCORP_CONSTANTS.addlMedicareThreshold, 0)} of wages.
        </li>
        <li>
          <strong>Distributions.</strong> The profit left after salary and expenses passes through as
          K-1 income — <strong>no payroll tax of any kind</strong>, only ordinary income tax (with a
          QBI deduction still available on this slice).
        </li>
      </ol>
      <p>
        The entire game is arithmetic: every dollar moved from the "salary" column to the
        "distribution" column saves {pct(TAX_CONSTANTS.seRate * 100, 1)} of payroll tax —{' '}
        <em>if and only if</em> the salary you keep paying is defensible. That conditional is not a
        footnote; it is the whole deal.
      </p>

      <h3>Why the QBI deduction behaves differently</h3>
      <p>
        The {pct(SCORP_CONSTANTS.qbiRate * 100, 0)} Qualified Business Income deduction applies to
        K-1 pass-through income only — your own W-2 wages are excluded from QBI by statute. So an
        S-Corp owner's QBI deduction is usually <em>smaller</em> than a sole proprietor's (it covers
        distributions, not salary), which claws back part of the payroll-tax savings at the income-tax
        layer. The calculator models this interaction exactly rather than applying a flat "S-Corps
        save 15.3%" shortcut — which is precisely the oversimplification most online articles make.
      </p>

      <h2 id="reasonable-salary">What makes a salary &ldquo;reasonable&rdquo;</h2>
      <p>
        The IRS requires S-Corp owner-employees to pay themselves a salary before taking
        distributions, and that salary must be <strong>reasonable compensation for the services
        actually rendered</strong> — a facts-and-circumstances test the courts have litigated for
        decades. The factors that carry weight:
      </p>
      <ul>
        <li><strong>What comparable businesses pay</strong> for your role and duties — salary surveys, job postings for your exact function, Bureau of Labor Statistics data by metro.</li>
        <li><strong>Your role and time commitment</strong> — a founder working 50 hours/week delivering the service cannot credibly pay themselves $20k while distributing $180k.</li>
        <li><strong>Training, experience, and licensing</strong> — specialized professional services command documented market rates.</li>
        <li><strong>What the business would pay a stranger</strong> to do the same work — the cleanest framing of the test.</li>
        <li><strong>Consistency year over year</strong> — a salary that swings to track profits looks like a distribution in disguise.</li>
      </ul>
      <p>
        Red flags the IRS and tax courts have actually used: salaries far below industry norms,
        distributions many times the salary, salary set as a round percentage with no market
        support, and — the classic audit fact pattern — <strong>leaving salary at zero while the
        business profits</strong>. This calculator deliberately refuses to &ldquo;optimize&rdquo; your
        salary for that reason: enter a defensible number and it tells you what the election is
        worth <em>at that number</em>.
      </p>

      <h2 id="worked-example">Worked example at $200,000 profit</h2>
      <p>
        The calculator's default scenario — $200,000 net profit, an $80,000 salary (40% of profit),
        {usd(SCORP_CONSTANTS.defaultPayrollCost, 0)} of annual payroll/compliance overhead, single
        filer, 2025 federal rules, no state tax:
      </p>
      <table>
        <thead>
          <tr>
            <th>Line item</th>
            <th>LLC (no election)</th>
            <th>S-Corp</th>
          </tr>
        </thead>
        <tbody>
          <tr><td>Payroll / SE tax</td><td>−$27,193</td><td>−$12,240</td></tr>
          <tr><td>QBI deduction</td><td>$34,361</td><td>$22,536</td></tr>
          <tr><td>Federal income tax</td><td>−$25,833</td><td>−$30,178</td></tr>
          <tr><td>Payroll &amp; compliance overhead</td><td>—</td><td>−$1,200</td></tr>
          <tr><td><strong>Total federal outlay</strong></td><td><strong>~$53,026</strong></td><td><strong>~$43,618</strong></td></tr>
          <tr><td><strong>You keep</strong></td><td><strong>~$146,974</strong></td><td><strong>~$156,382</strong></td></tr>
        </tbody>
      </table>
      <p>
        The election is worth <strong>$9,408/year</strong> at a 40% salary ratio. Notice the
        structure of the win: payroll tax drops by $14,953, but income tax rises by $4,345 (smaller
        QBI deduction, no half-SE deduction) and overhead takes $1,200 — the net is what matters,
        and only a full model shows it.
      </p>

      <h2 id="decision">When the election actually pays</h2>
      <p>
        The savings are roughly <code>15.3% × (profit − salary)</code> minus income-tax side
        effects minus overhead. That formula makes the decision boundaries legible:
      </p>
      <ul>
        <li>
          <strong>Below roughly $40–50k of profit</strong>, there is usually not enough distribution
          mass for the payroll-tax savings to clear payroll service minimums, extra return
          preparation, and unemployment insurance. The math can still show a small win — the
          operational hassle usually isn't worth it.
        </li>
        <li>
          <strong>$80k–$400k of profit with a market-supported salary well under the SS wage
          base</strong> is the sweet spot. This is where the per-year delta routinely runs
          $5k–$15k.
        </li>
        <li>
          <strong>When your defensible salary approaches or exceeds the{' '}
          {numFmt(SCORP_CONSTANTS.ssWageBase, 0)} wage base</strong>, the arbitrage shrinks:
          dollars above the base only carried 2.9% Medicare anyway, so moving them to distributions
          saves little — and the Additional Medicare Tax adds a new cost on the salary side.
        </li>
        <li>
          <strong>If you plan to reinvest most profit and sell someday</strong>, the C-Corp
          analysis (QSBS, 21% retained) is the more relevant comparison — that is the{' '}
          <a href="/llc-vs-ccorp-tax-calculator/">LLC vs C-Corp tool</a>'s job.
        </li>
      </ul>

      <h2 id="beyond-model">Costs beyond this model</h2>
      <p>
        This tool is federal-only and deliberately narrow. Real elections carry moving parts it
        does not price — fold them into the overhead input:
      </p>
      <ul>
        <li><strong>Payroll service</strong> — $40–$150/month for a single-employee S-Corp.</li>
        <li><strong>Form 1120-S and state equivalents</strong> — often $500–$2,000/year more in preparation fees than a Schedule C.</li>
        <li><strong>FUTA + SUTA</strong> — federal unemployment is typically $42–$420/year on the first $7,000 of wages (with the credit); state unemployment varies widely and some states tax S-corp owner wages.</li>
        <li><strong>State franchise or S-corp-specific taxes</strong> — e.g. California's 1.5% franchise tax on S-corp net income ($800 minimum), Tennessee's excise tax. In those states the calculus changes materially.</li>
        <li><strong>Workers' compensation</strong> — some states require coverage even for officer-only companies.</li>
        <li><strong>Retirement plan geometry</strong> — a solo 401(k) can be fed by both salary deferral and profit-sharing under either structure; an S-corp's employer contribution is based on W-2 wages. Sometimes the retirement plan, not the payroll tax, should drive the salary level.</li>
      </ul>

      <h2 id="process">How to elect (and unwind)</h2>
      <ol>
        <li>Form or keep your LLC; ensure it's a single permissible shareholder structure (US citizens/residents, no entities as owners for S status).</li>
        <li>File <strong>IRS Form 2553</strong> — no later than March 15 (2 months &amp; 15 days after the start of the tax year) for the election to apply that year, with all shareholders consenting.</li>
        <li>Set up payroll before the first pay date: EIN withholding account, state withholding registration, unemployment accounts, and a payroll provider.</li>
        <li>Pay yourself on a regular schedule (bi-weekly or monthly) with withholding — not ad-hoc transfers, which courts read as distributions.</li>
        <li>Issue W-2 to yourself in January; the K-1 comes from the 1120-S filed by March 15.</li>
      </ol>
      <p>
        Unwinding is possible (voluntary revocation of S status) but has its own cost basis and
        timing rules — another reason to run the numbers <em>and</em> talk to a CPA before filing
        2553, not after.
      </p>

      <h2 id="caveats">Important caveats</h2>
      <ul>
        <li>Federal, single-filer, tax-year 2025 model. No state income tax, no state unemployment beyond your overhead input.</li>
        <li>SSTB QBI phase-outs above $197,300 of taxable income are not modeled — consultants, attorneys, and health professionals above that line face a reduced or zero QBI deduction in reality.</li>
        <li>The model assumes the salary you enter is defensible; it does not judge it. The savings at an indefensible salary are not savings — they are an assessment waiting to happen.</li>
        <li>Employee benefit discrimination rules (health insurance, HSA interactions with S-corp &gt;2% shareholders) are outside this model.</li>
        <li>Nothing here is tax advice. Verify the current year's wage base, thresholds, and your state's rules with a qualified professional.</li>
      </ul>

      <Faq
        items={[
          {
            question: 'How much should I pay myself from my S-Corp?',
            answer: (
              <p>
                There is no legal percentage. The test is what comparable businesses pay for your
                role. Common starting points are salary surveys for your title and metro, or the
                wage a replacement hire would command. Document how you arrived at the number —
                contemporaneous evidence is what holds up under review. What you should not do is
                pick the number that maximizes this (or any) calculator's output.
              </p>
            ),
          },
          {
            question: 'Is there a profit level where the S-Corp election stops being worth it?',
            answer: (
              <p>
                Below roughly $40–50k of net profit, overhead usually eats the savings. At the very
                top, once your defensible salary passes the $176,100 Social Security wage base, the
                payroll-tax arbitrage on additional dollars shrinks to the 2.9% Medicare layer. The
                sensitivity chart in the tool above shows exactly where your edge crosses zero for
                your own numbers.
              </p>
            ),
          },
          {
            question: 'What is the deadline to file Form 2553?',
            answer: (
              <p>
                March 15 — two months and 15 days after the beginning of the tax year the election
                is to take effect. Miss it and you generally wait for the following year (late-election
                relief under Rev. Proc. 2013-30 exists if you have reasonable cause).
              </p>
            ),
          },
          {
            question: 'Does an S-Corp pay self-employment tax on distributions?',
            answer: (
              <p>
                No. Distributions carry no SE tax and no FICA — that absence is the entire mechanism
                of the savings. They do remain subject to ordinary income tax, and they are not
                counted as Qualified Business Income-free: they are the K-1 income the QBI
                deduction applies to.
              </p>
            ),
          },
          {
            question: 'Can I switch back if it stops making sense?',
            answer: (
              <p>
                Yes — shareholders can voluntarily revoke S status by consent filing, effective
                prospectively. There are also involuntary terminations (excess passive income for
                three consecutive years, disqualifying shareholders). Revocation has basis and
                built-in-gains consequences worth modeling with a CPA first.
              </p>
            ),
          },
          {
            question: 'Does this work for partnerships or multi-member LLCs?',
            answer: (
              <p>
                The election mechanics are similar (Form 2553, all shareholders consent), and
                multi-owner S-corps face the same reasonable-salary test for each working owner.
                This tool models a single owner taking 100% of profit; for partnerships, the SE-tax
                baseline differs for limited vs general partners, so run the numbers with your
                accountant.
              </p>
            ),
          },
        ]}
      />

      <RelatedCalculators
        links={[
          { href: '/llc-vs-ccorp-tax-calculator/', label: 'LLC vs C-Corp Tax Calculator' },
          { href: '/freelance-hourly-rate-calculator/', label: 'Freelance Hourly Rate' },
          { href: '/saas-runway-calculator/', label: 'SaaS Runway' },
        ]}
      />
    </article>
  );
}

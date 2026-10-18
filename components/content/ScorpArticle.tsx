import type { ReactNode } from 'react';
import Faq from '@/components/Faq';
import { ArticleToc, RelatedCalculators } from '@/components/Article';
import { SCORP_CONSTANTS } from '@/lib/scorp';
import {
  breakevenPayrollCostFull,
  compareScorpFull,
  computeLlcFull,
  computeScorpFull,
  SCORP_FULL_CONSTANTS as SC,
} from '@/lib/scorpfull';
import { QBI_CONSTANTS } from '@/lib/qbi';
import { TAX_CONSTANTS } from '@/lib/tax';
import { numFmt, pct, usd } from '@/lib/format';

/* Every number in the tables and vignettes below is computed at build time by
   the same engine the widget runs — nothing in this article is hand-typed. */

// The calculator's default scenario: $200k profit, $80k salary (40%), $1,200
// overhead, single filer, non-SSTB.
const EX = compareScorpFull(200_000, 80_000, SC.defaultPayrollCost);

// The 92.35% worked example: $100k of net Schedule C profit.
const SE_EX = computeLlcFull(100_000);

// Decision vignettes (all at the default $1,200/yr overhead, non-SSTB):
const LOW = compareScorpFull(50_000, 20_000, SC.defaultPayrollCost); // low income, 40% salary
const HIGH = compareScorpFull(500_000, 200_000, SC.defaultPayrollCost); // high income, 40% salary
const PARTIAL = compareScorpFull(300_000, 150_000, SC.defaultPayrollCost); // already drawing 50%
const PARTIAL40 = compareScorpFull(300_000, 120_000, SC.defaultPayrollCost); // same business, 40%

// Second worked example — the mid-range case: $120k profit, $60k salary (50%).
const MID = compareScorpFull(120_000, 60_000, SC.defaultPayrollCost);

// Third worked example — the SSTB flip: $400k profit, $160k salary (40%),
// same numbers with the SSTB toggle on and off.
const FLIP = compareScorpFull(400_000, 160_000, SC.defaultPayrollCost, false);
const FLIP_SSTB = compareScorpFull(400_000, 160_000, SC.defaultPayrollCost, true);

// FAQ support scenarios (default $1,200/yr overhead unless noted):
const ZERO_SALARY = compareScorpFull(200_000, 0, SC.defaultPayrollCost); // the $0-salary ceiling
const LOSS_YEAR = compareScorpFull(0, 40_000, SC.defaultPayrollCost); // profit modeled at $0
const BASE_UNDER = compareScorpFull(300_000, 150_000, SC.defaultPayrollCost); // salary under the SS base
const BASE_OVER = compareScorpFull(300_000, 200_000, SC.defaultPayrollCost); // salary over the SS base

/* ---- Decision-boundary scans (same engine, build time) -------------------
   Method, documented for reproducibility (see the "Decision boundaries"
   section): the signed after-tax edge of the S-Corp is scorp.afterTax −
   llc.afterTax with salary pinned at ratio × profit, $1,200/yr overhead,
   non-SSTB, single filer.                                                    */
function signedEdge(profit: number, ratio: number): number {
  return (
    computeScorpFull(profit, profit * ratio, SC.defaultPayrollCost).afterTax -
    computeLlcFull(profit).afterTax
  );
}

// Profit floor: bisection on profit over [5k, 150k] (80 halvings). The edge
// rises monotonically through this region (verified by the grid points below).
function profitFloor(ratio: number): number {
  let lo = 5_000;
  let hi = 150_000;
  for (let i = 0; i < 80; i++) {
    const mid = (lo + hi) / 2;
    if (signedEdge(mid, ratio) < 0) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}
const FLOOR30 = profitFloor(0.3);
const FLOOR40 = profitFloor(0.4);
const FLOOR50 = profitFloor(0.5);
// Grid points bracketing the floor at a 40% salary (the bisection's premise):
const EDGE10K = signedEdge(10_000, 0.4);
const EDGE60K = signedEdge(60_000, 0.4);
const EDGE100K = signedEdge(100_000, 0.4);

// Sweet-spot anchors at a 40% salary, plus the profit levels where the edge
// crosses $5k and $15k (bisection over [20k, 400k]; the edge is verified
// strictly rising in profit across that whole range).
const EDGE80K = signedEdge(80_000, 0.4);
const EDGE300K = signedEdge(300_000, 0.4);
const EDGE400K = signedEdge(400_000, 0.4);
function profitAtEdge(target: number, lo = 20_000, hi = 400_000): number {
  let a = lo;
  let b = hi;
  for (let i = 0; i < 80; i++) {
    const mid = (a + b) / 2;
    if (signedEdge(mid, 0.4) < target) a = mid;
    else b = mid;
  }
  return (a + b) / 2;
}
const PROFIT_AT_5K = profitAtEdge(5_000);
const PROFIT_AT_15K = profitAtEdge(15_000);

// Salary ceiling: the edge recomputed at 151 salary shares (15% → 90% in
// half-point steps); "wins" = edge > the engine's ±$0.50 tie band.
function salaryScan(profit: number) {
  let ceiling = 0;
  let allWin = true;
  let at90 = 0;
  let best = { ratio: 0, edge: -Infinity };
  for (let i = 0; i <= 150; i++) {
    const ratio = 0.15 + (0.75 * i) / 150;
    const edge = signedEdge(profit, ratio);
    if (edge > 0.5) ceiling = ratio;
    else allWin = false;
    if (edge > best.edge) best = { ratio, edge };
    if (i === 150) at90 = edge;
  }
  return { ceiling, allWin, at90, best };
}
const SCAN80 = salaryScan(80_000);
const SCAN120 = salaryScan(120_000);
const SCAN250 = salaryScan(250_000);
const SCAN500 = salaryScan(500_000);

// Overhead ceiling: the engine's own breakevenPayrollCostFull bisection, at a
// 40% salary for each profit level.
const OVERHEAD_CEILING = [
  { profit: 80_000, salary: 32_000, be: breakevenPayrollCostFull(80_000, 32_000) },
  { profit: 120_000, salary: 48_000, be: breakevenPayrollCostFull(120_000, 48_000) },
  { profit: 200_000, salary: 80_000, be: breakevenPayrollCostFull(200_000, 80_000) },
  { profit: 500_000, salary: 200_000, be: breakevenPayrollCostFull(500_000, 200_000) },
];

/* Glossary for first-time readers — every rate, base and threshold below is
   pulled from the same lib constants the engine runs on. */
const GLOSSARY: [term: string, definition: ReactNode][] = [
  [
    'S election',
    <>
      A federal tax election under <em>Subchapter S</em> of the Internal Revenue Code, filed on an
      existing LLC or corporation. It changes how profit reaches your pocket (salary plus
      distributions instead of all self-employment income); it is not a business structure of its
      own.
    </>,
  ],
  [
    'Form 2553',
    <>The two-page IRS form that makes the election, signed by all shareholders. It must be filed within two months and 15 days of the start of the tax year for the election to take effect that year.</>,
  ],
  [
    'Reasonable compensation',
    <>The IRS requirement that an owner-employee&apos;s W-2 salary match what comparable businesses pay for the services actually rendered. Courts test it on facts — market data, duties, hours, consistency — never on a percentage of profit.</>,
  ],
  [
    'Self-employment (SE) tax',
    <>
      The sole proprietor&apos;s version of payroll tax: both halves at once, charged on{' '}
      {pct(SC.seBaseFactor * 100, 2)} of net profit — Schedule SE&apos;s shortcut for the deductible
      employer half — with only the Medicare slice continuing above the wage base.
    </>,
  ],
  [
    'FICA',
    <>
      The payroll tax on W-2 wages: {pct(SCORP_CONSTANTS.ssRate * 100, 1)} Social Security up to the
      wage base plus {pct(SCORP_CONSTANTS.medicareRate * 100, 2)} Medicare on everything, paid
      twice — once by the employee, once by the employer (the deductible half).
    </>,
  ],
  [
    'Social Security wage base',
    <>
      The annual ceiling on the 6.2% Social Security slice: {usd(SC.ssWageBase, 0)} in 2025,
      {' ' + usd(SC.ty2026.ssWageBase, 0)} in 2026. Dollars above it carry only Medicare, which is
      why the election&apos;s payroll-tax arbitrage shrinks as a defensible salary climbs past it.
    </>,
  ],
  [
    'Additional Medicare Tax',
    <>
      A {pct(SCORP_CONSTANTS.addlMedicareRate * 100, 1)} surtax (Form 8959) starting at{' '}
      {usd(SC.addlMedicareThreshold, 0)} of wages on the employee side and at the same threshold of
      self-employment income. The engine models it on both columns of the comparison.
    </>,
  ],
  [
    'K-1 income',
    <>The Schedule K-1 slice of an S-Corp: profit left after salary, employer FICA and overhead, passed through and taxed as ordinary income on your return. It is the only slice the §199A deduction can attach to.</>,
  ],
  [
    'Distribution',
    <>Cash taken out of the S-Corp beyond your salary. Free of payroll tax — the entire mechanism of the savings — but still ordinary income, and taking it before (or instead of) a defensible salary is the classic recharacterization fact pattern.</>,
  ],
  [
    'QBI deduction (§199A)',
    <>
      A {pct(SCORP_CONSTANTS.qbiRate * 100, 0)} deduction on qualified business income. Above{' '}
      {usd(QBI_CONSTANTS.threshold.single, 0)} of taxable income (single, 2025) it is limited by the
      business&apos;s W-2 wages — the quiet reason the election <em>strengthens</em> at high profits.
    </>,
  ],
  [
    'SSTB',
    <>
      Specified service trade or business — health, law, accounting, consulting, financial services
      and similar fields. Above the §199A threshold its deduction phases out over{' '}
      {usd(QBI_CONSTANTS.phaseInRange.single, 0)} of taxable income, and unlike a regular business,
      no amount of salary rescues it.
    </>,
  ],
  [
    'W-2 wage limitation',
    <>
      The §199A gate above the threshold: the deduction cannot exceed the greater of{' '}
      {pct(QBI_CONSTANTS.wageShare * 100, 0)} of the business&apos;s W-2 wages or{' '}
      {pct(QBI_CONSTANTS.wageShareAlt * 100, 0)} of wages plus{' '}
      {pct(QBI_CONSTANTS.ubiaShare * 100, 1)} of qualified-property basis. An S-Corp owner&apos;s
      own salary counts toward it; a sole proprietor&apos;s schedule C has nothing to offer.
    </>,
  ],
];

export default function ScorpArticle() {
  const toc = [
    { id: 'mechanics', label: 'How the S-Corp split works' },
    { id: 'se-factor', label: 'Why 92.35%: the SE-tax arithmetic' },
    { id: 'reasonable-salary', label: 'What makes a salary "reasonable"' },
    { id: 'worked-example', label: 'Worked example at $200k' },
    { id: 'worked-example-mid', label: 'Worked example: $120k, line by line' },
    { id: 'worked-example-sstb', label: 'Worked example: the SSTB flip at $400k' },
    { id: 'decision', label: 'When the election actually pays' },
    { id: 'decision-boundaries', label: 'Decision boundaries (scanned)' },
    { id: 'beyond-model', label: 'Costs beyond this model' },
    { id: 'process', label: 'How to elect (and unwind)' },
    { id: 'caveats', label: 'Important caveats' },
    { id: 'glossary', label: 'Glossary' },
    { id: 'faq', label: 'FAQ' },
  ];

  return (
    <article className="prose-article">
      <ArticleToc items={toc} />

      <h2 id="mechanics">How the S-Corp split actually works</h2>
      <p>
        An S-Corp is not a different kind of company — it is a <strong>tax election</strong> layered
        on top of an LLC (or corporation). What changes is how profit reaches your pocket. Without
        the election, 100% of an LLC&apos;s net income is <strong>self-employment income</strong>,
        and the full {pct(TAX_CONSTANTS.seRate * 100, 1)} SE-tax layer (Social Security + Medicare,
        both halves) applies to the {pct(SC.seBaseFactor * 100, 2)} Schedule SE base up to the{' '}
        {numFmt(SC.ssWageBase, 0)} wage base — about {numFmt(SC.ssWageBase / SC.seBaseFactor, 0)}{' '}
        of net profit, since the base is {pct(SC.seBaseFactor * 100, 2)} of it — with 2.9% Medicare
        above. With the election, your extraction splits into two streams that the tax law treats
        very differently:
      </p>
      <ol>
        <li>
          <strong>W-2 salary.</strong> You become an employee of your own company. The salary pays
          both halves of FICA — {pct(SCORP_CONSTANTS.ssRate * 100, 1)} Social Security (up to the
          {' ' + numFmt(SC.ssWageBase, 0)} wage base) + {pct(SCORP_CONSTANTS.medicareRate * 100, 2)} Medicare
          (uncapped), plus the {pct(SCORP_CONSTANTS.addlMedicareRate * 100, 1)} Additional Medicare
          Tax above {usd(SCORP_CONSTANTS.addlMedicareThreshold, 0)} of wages.
        </li>
        <li>
          <strong>Distributions.</strong> The profit left after salary and expenses passes through as
          K-1 income — <strong>no payroll tax of any kind</strong>, only ordinary income tax. A §199A
          deduction still applies to this slice, but above $197,300 of taxable income it survives
          only if the business pays enough W-2 wages — your salary is exactly that (see below).
        </li>
      </ol>
      <p>
        The entire game is arithmetic: every dollar moved from the &quot;salary&quot; column to the
        &quot;distribution&quot; column saves its full marginal payroll tax —{' '}
        {pct(TAX_CONSTANTS.seRate * 100, 1)} while the salary sits under the Social Security wage
        base, only 2.9% above it —{' '}
        <em>if and only if</em> the salary you keep paying is defensible. That conditional is not a
        footnote; it is the whole deal.
      </p>

      <h3>Why the QBI deduction behaves differently — and why it flips at the top</h3>
      <p>
        The {pct(SCORP_CONSTANTS.qbiRate * 100, 0)} Qualified Business Income deduction applies to
        K-1 pass-through income only — your own W-2 wages are excluded from QBI by statute. So an
        S-Corp owner&apos;s QBI deduction is usually <em>smaller</em> than a sole
        proprietor&apos;s (it covers distributions, not salary), which claws back part of the
        payroll-tax savings at the income-tax layer. Most online calculators stop the story there,
        with a flat 20% on both sides. The rest of the story is Form 8995-A&apos;s{' '}
        <strong>W-2 wage limitation</strong>, and for a one-person business it is decisive: above
        $197,300 of taxable income (single, 2025), the deduction cannot exceed the greater of 50% of
        the business&apos;s W-2 wages or 25% of wages plus 2.5% of qualified-property basis. A sole
        proprietor with no employees has zero wages — so the limitation, once fully phased in at
        $247,300, zeroes the deduction. The S-Corp&apos;s owner salary <em>is</em> the business&apos;s
        W-2 wages, so the election keeps the deduction alive.
      </p>
      <p>
        At {usd(300_000, 0)} of profit the difference is stark: the LLC column claims{' '}
        <strong>{usd(PARTIAL40.llc.qbiDeduction, 0)}</strong> of QBI deduction — the wage limit has
        taken all of it — while the same business as an S-Corp at a {usd(120_000, 0)} salary claims{' '}
        <strong>{usd(PARTIAL40.scorp.qbiDeduction, 0)}</strong>, which is 20% of its{' '}
        {usd(PARTIAL40.scorp.k1Income, 0)} K-1 and comfortably under the{' '}
        {usd(60_000, 0)} (50%-of-wages) ceiling. This is why the calculator&apos;s verdict{' '}
        <em>strengthens</em> at high profits, contra the old &quot;arbitrage shrinks above the wage
        base&quot; rule of thumb — both effects are real, and the full model nets them. The{' '}
        <a href="/qbi-deduction-calculator/">QBI Deduction calculator</a> runs the same Form 8995-A
        engine standalone if you want to isolate that layer.
      </p>

      <h2 id="se-factor">Why 92.35%: the SE-tax arithmetic, derived</h2>
      <p>
        An employee and their employer each pay 7.65% of wages into FICA (6.2% Social Security +
        1.45% Medicare). A sole proprietor is both parties at once — 15.3% in total — but the
        employer half is a deductible business expense. Rather than make you compute that deduction
        separately, Schedule SE folds it into the base: SE tax applies to{' '}
        <strong>net earnings × (1 − 7.65%) = 92.35%</strong> of profit. Here is the full arithmetic
        at {usd(100_000, 0)} of net profit, exactly as the LLC column computes it:
      </p>
      <table>
        <thead>
          <tr>
            <th>Line</th>
            <th>Computation</th>
            <th>Amount</th>
          </tr>
        </thead>
        <tbody>
          <tr><td>Net profit</td><td>given</td><td>{usd(100_000, 0)}</td></tr>
          <tr><td>SE base</td><td>92.35% × 100,000</td><td>{usd(SE_EX.seBase, 0)}</td></tr>
          <tr><td>SE tax</td><td>15.3% × 92,350 (below the {numFmt(SC.ssWageBase, 0)} cap)</td><td>−{usd(SE_EX.seTax)}</td></tr>
          <tr><td>Income-tax deduction</td><td>½ × SE tax</td><td>−{usd(SE_EX.halfSeTax)}</td></tr>
          <tr><td>Standard deduction</td><td>single filer, TY2025</td><td>−{usd(SC.stdDeduction, 0)}</td></tr>
          <tr><td>Taxable income before QBI</td><td>100,000 − 7,064.78 − 15,750</td><td>{usd(SE_EX.taxableBeforeQbi, 0)}</td></tr>
          <tr><td>Tentative QBI deduction</td><td>20% × (100,000 − ½SE)</td><td>{usd(SE_EX.qbiTentative, 0)}</td></tr>
          <tr><td>QBI cap</td><td>20% × taxable income before QBI</td><td>{usd(0.2 * SE_EX.taxableBeforeQbi, 0)}</td></tr>
          <tr><td>QBI deduction claimed</td><td>smaller of the two — the cap binds</td><td>−{usd(SE_EX.qbiDeduction, 0)}</td></tr>
          <tr><td><strong>Effective SE rate on gross profit</strong></td><td>14,129.55 ÷ 100,000</td><td><strong>{pct((SE_EX.seTax / 100_000) * 100, 2)}</strong></td></tr>
        </tbody>
      </table>
      <p>
        So the famous &quot;15.3% self-employment tax&quot; is really{' '}
        {pct((SE_EX.seTax / 100_000) * 100, 2)} cents on the dollar before the income-tax deduction
        — and it drops further above the Social Security wage base, where only the 2.9% Medicare
        layer (same 92.35% base) continues. Above {usd(SCORP_CONSTANTS.addlMedicareThreshold, 0)} of
        base the 0.9% Additional Medicare Tax layers on. The{' '}
        <a href="/self-employment-tax-calculator/">Self-Employment Tax calculator</a> explores that
        curve alone; this tool always uses the full version of it on the LLC side.
      </p>

      <h2 id="reasonable-salary">What makes a salary &ldquo;reasonable&rdquo;</h2>
      <p>
        The IRS requires S-Corp owner-employees to pay themselves a salary before taking
        distributions, and that salary must be <strong>reasonable compensation for the services
        actually rendered</strong> — a facts-and-circumstances test the courts have litigated for
        decades (IRS guidance since FS-2008-25 states the requirement plainly;{' '}
        <em>United States v. Watson</em> is the leading modern case, in which an owner&apos;s token
        salary against large distributions was raised by the court). No statute or ruling sets a
        required percentage — the test is evidence, and the checklist below assembles it.
      </p>

      <h3>The IRS-factor self-audit checklist</h3>
      <p>Before committing to a number, walk this list — each item is a factor an examiner or court can point to:</p>
      <ul className="mt-3 list-none space-y-2.5">
        {[
          'Replacement cost: could you hand a stranger your role description at this salary without flinching? That stranger\u2019s market rate is the anchor — the cleanest framing of the test.',
          'Third-party evidence on file: a dated salary survey, job postings, or BLS data for your role and metro — created when you set the salary, not after the audit letter.',
          'Duties, hours and credentials, not the P&L: the number tracks training, licensing and workload — a founder working 50 hours/week delivering the service cannot credibly pay themselves $20k while distributing $180k — not what the business earned that year.',
          'Internal consistency: if the business pays staff, owner pay sits credibly within the same pay scale for comparable work — and holds steady year over year, because a salary that swings to track profits looks like a distribution in disguise.',
          'Real payroll mechanics: regular pay dates with withholding and a W-2 — not ad-hoc December transfers, which courts read as distributions.',
          'Ratio sanity: you can say \u201c$X salary, $Y distributions\u201d out loud with a straight face, and you wrote down why when you chose it.',
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
        The calculator&apos;s default scenario — $200,000 net profit, an $80,000 salary (40% of profit),
        {usd(SC.defaultPayrollCost, 0)} of annual payroll/compliance overhead, single
        filer, 2025 federal rules ({usd(SC.stdDeduction, 0)} standard deduction), no state tax:
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
          <tr><td>Payroll / SE tax (15.3% layer)</td><td>−{usd(EX.llc.seTax, 0)}</td><td>−{usd(EX.scorp.payrollTax - EX.scorp.addlMedicareTax, 0)}</td></tr>
          <tr><td>Additional Medicare tax (0.9%)</td><td>−{usd(EX.llc.addlMedicareTax, 0)}</td><td>−{usd(EX.scorp.addlMedicareTax, 0)}</td></tr>
          <tr><td>QBI deduction</td><td>{usd(EX.llc.qbiDeduction, 0)}</td><td>{usd(EX.scorp.qbiDeduction, 0)}</td></tr>
          <tr><td>Federal income tax</td><td>−{usd(EX.llc.incomeTax, 0)}</td><td>−{usd(EX.scorp.incomeTax, 0)}</td></tr>
          <tr><td>Payroll &amp; compliance overhead</td><td>—</td><td>−{usd(EX.scorp.payrollCost, 0)}</td></tr>
          <tr><td><strong>Total federal outlay</strong></td><td><strong>~{usd(EX.llc.totalOutlay, 0)}</strong></td><td><strong>~{usd(EX.scorp.totalOutlay, 0)}</strong></td></tr>
          <tr><td><strong>You keep</strong></td><td><strong>~{usd(EX.llc.afterTax, 0)}</strong></td><td><strong>~{usd(EX.scorp.afterTax, 0)}</strong></td></tr>
        </tbody>
      </table>
      <p>
        The election is worth <strong>{usd(EX.delta, 0)}/year</strong> at a 40% salary ratio. Notice
        the structure of the win: payroll tax drops by{' '}
        {usd(EX.llc.seTax - EX.scorp.payrollTax, 0)}, but income tax rises by{' '}
        {usd(EX.scorp.incomeTax - EX.llc.incomeTax, 0)} (smaller QBI deduction, no half-SE
        deduction) and overhead takes {usd(EX.scorp.payrollCost, 0)} — the net is what matters, and
        only a full model shows it. (The 0.9% line is zero on both sides here: this example sits
        below the $200,000 threshold where it starts.)
      </p>
      <p className="text-xs text-slate-500 dark:text-slate-400">
        Computed at build time by the same engine that powers the widget — reproducible, not hand-typed.
      </p>

      <h2 id="worked-example-mid">Worked example: $120k profit, line by line</h2>
      <p>
        The $200k example above shows the shape of the win; this one walks every line, because the
        mid-range is where most owners actually decide. Inputs: {usd(120_000, 0)} net profit, a{' '}
        {usd(60_000, 0)} salary — exactly half — {usd(SC.defaultPayrollCost, 0)} of payroll and
        compliance overhead, single filer, non-SSTB, 2025 federal rules.
      </p>

      <h3>The LLC column, line by line</h3>
      <table>
        <thead>
          <tr>
            <th>Line</th>
            <th>Computation</th>
            <th>Amount</th>
          </tr>
        </thead>
        <tbody>
          <tr><td>Net profit</td><td>given</td><td>{usd(120_000, 0)}</td></tr>
          <tr>
            <td>SE base</td>
            <td>{pct(SC.seBaseFactor * 100, 2)} × {numFmt(120_000, 0)}</td>
            <td>{usd(MID.llc.seBase, 0)}</td>
          </tr>
          <tr>
            <td>SE tax</td>
            <td>{pct(TAX_CONSTANTS.seRate * 100, 1)} × {numFmt(MID.llc.seBase, 0)} — all under the {numFmt(SC.ssWageBase, 0)} cap</td>
            <td>−{usd(MID.llc.seTax, 2)}</td>
          </tr>
          <tr><td>Income-tax deduction</td><td>½ × SE tax</td><td>−{usd(MID.llc.halfSeTax, 2)}</td></tr>
          <tr>
            <td>Taxable income before QBI</td>
            <td>{numFmt(120_000, 0)} − {usd(MID.llc.halfSeTax, 2)} − {numFmt(SC.stdDeduction, 0)} std deduction</td>
            <td>{usd(MID.llc.taxableBeforeQbi, 2)}</td>
          </tr>
          <tr>
            <td>Tentative QBI deduction</td>
            <td>20% × {usd(MID.llc.qbiBase, 2)}</td>
            <td>{usd(MID.llc.qbiTentative, 2)}</td>
          </tr>
          <tr>
            <td>QBI cap</td>
            <td>20% × {usd(MID.llc.taxableBeforeQbi, 2)}</td>
            <td>{usd(0.2 * MID.llc.taxableBeforeQbi, 2)}</td>
          </tr>
          <tr>
            <td>QBI deduction claimed</td>
            <td>smaller of the two — the cap binds</td>
            <td>−{usd(MID.llc.qbiDeduction, 2)}</td>
          </tr>
          <tr>
            <td>Taxable income</td>
            <td>{usd(MID.llc.taxableBeforeQbi, 2)} − {usd(MID.llc.qbiDeduction, 2)}</td>
            <td>{usd(MID.llc.taxableIncome, 2)}</td>
          </tr>
          <tr><td>Federal income tax</td><td>2025 brackets</td><td>−{usd(MID.llc.incomeTax, 2)}</td></tr>
          <tr>
            <td>Total federal outlay</td>
            <td>{usd(MID.llc.seTax, 2)} + {usd(MID.llc.incomeTax, 2)}</td>
            <td>{usd(MID.llc.totalOutlay, 2)}</td>
          </tr>
          <tr><td><strong>You keep</strong></td><td></td><td><strong>{usd(MID.llc.afterTax, 2)}</strong></td></tr>
        </tbody>
      </table>

      <h3>The S-Corp column, line by line</h3>
      <table>
        <thead>
          <tr>
            <th>Line</th>
            <th>Computation</th>
            <th>Amount</th>
          </tr>
        </thead>
        <tbody>
          <tr><td>W-2 salary</td><td>given — 50% of profit</td><td>{usd(MID.scorp.salaryEffective, 0)}</td></tr>
          <tr>
            <td>Employee FICA</td>
            <td>{pct((SCORP_CONSTANTS.ssRate + SCORP_CONSTANTS.medicareRate) * 100, 2)} × {numFmt(MID.scorp.salaryEffective, 0)}</td>
            <td>−{usd(MID.scorp.employeeFica, 2)}</td>
          </tr>
          <tr>
            <td>Employer FICA (deductible)</td>
            <td>{pct((SCORP_CONSTANTS.ssRate + SCORP_CONSTANTS.medicareRate) * 100, 2)} × {numFmt(MID.scorp.salaryEffective, 0)}</td>
            <td>−{usd(MID.scorp.employerFica, 2)}</td>
          </tr>
          <tr>
            <td>K-1 income</td>
            <td>{numFmt(120_000, 0)} − {numFmt(MID.scorp.salaryEffective, 0)} − {usd(MID.scorp.employerFica, 0)} employer FICA − {usd(MID.scorp.payrollCost, 0)} overhead</td>
            <td>{usd(MID.scorp.k1Income, 0)}</td>
          </tr>
          <tr>
            <td>Taxable income before QBI</td>
            <td>({numFmt(MID.scorp.salaryEffective, 0)} + {usd(MID.scorp.k1Income, 0)}) − {numFmt(SC.stdDeduction, 0)}</td>
            <td>{usd(MID.scorp.taxableIncome + MID.scorp.qbiDeduction, 0)}</td>
          </tr>
          <tr>
            <td>Tentative QBI deduction</td>
            <td>20% × {usd(MID.scorp.k1Income, 0)} K-1 — owner wages are excluded</td>
            <td>{usd(MID.scorp.qbiTentative, 0)}</td>
          </tr>
          <tr>
            <td>QBI deduction claimed</td>
            <td>below the {numFmt(QBI_CONSTANTS.threshold.single, 0)} threshold the wage limit never applies; the 20%-of-income cap ({usd(0.2 * (MID.scorp.taxableIncome + MID.scorp.qbiDeduction), 0)}) doesn&apos;t bind</td>
            <td>−{usd(MID.scorp.qbiDeduction, 0)}</td>
          </tr>
          <tr>
            <td>Taxable income</td>
            <td>{usd(MID.scorp.taxableIncome + MID.scorp.qbiDeduction, 0)} − {usd(MID.scorp.qbiDeduction, 0)}</td>
            <td>{usd(MID.scorp.taxableIncome, 0)}</td>
          </tr>
          <tr><td>Federal income tax</td><td>2025 brackets</td><td>−{usd(MID.scorp.incomeTax, 2)}</td></tr>
          <tr><td>Payroll &amp; compliance overhead</td><td>given</td><td>−{usd(MID.scorp.payrollCost, 2)}</td></tr>
          <tr>
            <td>Total federal outlay</td>
            <td>{usd(MID.scorp.payrollTax, 2)} payroll tax + {usd(MID.scorp.incomeTax, 2)} income tax + {usd(MID.scorp.payrollCost, 2)} overhead</td>
            <td>{usd(MID.scorp.totalOutlay, 2)}</td>
          </tr>
          <tr><td><strong>You keep</strong></td><td></td><td><strong>{usd(MID.scorp.afterTax, 2)}</strong></td></tr>
        </tbody>
      </table>

      <p>
        <strong>Where the win comes from.</strong> Payroll tax falls by{' '}
        {usd(MID.llc.seTax - MID.scorp.payrollTax, 2)} ({usd(MID.llc.seTax, 0)} of SE tax vs{' '}
        {usd(MID.scorp.payrollTax, 0)} of FICA), income tax rises by{' '}
        {usd(MID.scorp.incomeTax - MID.llc.incomeTax, 2)} — the S-Corp claims only{' '}
        {usd(MID.scorp.qbiDeduction, 0)} of QBI against the LLC&apos;s {usd(MID.llc.qbiDeduction, 0)}{' '}
        and loses the half-SE deduction — and overhead takes {usd(MID.scorp.payrollCost, 0)}. Net:{' '}
        <strong>{usd(MID.delta, 2)}/yr for the election, about {usd(MID.delta / 12, 0)} a month</strong>{' '}
        ({usd(MID.scorp.afterTax, 0)} kept vs {usd(MID.llc.afterTax, 0)}). The three terms sum to the
        delta exactly, because they come from the same engine pass. Real, but not life-changing —
        and one recharacterized salary year would claw back more than the whole benefit.
      </p>

      <h2 id="worked-example-sstb">Worked example: the SSTB flip at $400k</h2>
      <p>
        Same exercise at the top of the range, where §199A does its strangest work. Inputs:{' '}
        {usd(400_000, 0)} net profit, a {usd(160_000, 0)} salary (40%), {usd(SC.defaultPayrollCost, 0)}{' '}
        overhead, single filer — run twice, once as a regular business and once as a specified
        service business (consulting, law, health, and similar):
      </p>
      <table>
        <thead>
          <tr>
            <th>Line item</th>
            <th>LLC</th>
            <th>S-Corp</th>
            <th>S-Corp (SSTB)</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>SE / payroll tax (15.3% layer)</td>
            <td>−{usd(FLIP.llc.seTax, 0)}</td>
            <td>−{usd(FLIP.scorp.payrollTax - FLIP.scorp.addlMedicareTax, 0)}</td>
            <td>−{usd(FLIP_SSTB.scorp.payrollTax - FLIP_SSTB.scorp.addlMedicareTax, 0)}</td>
          </tr>
          <tr>
            <td>Additional Medicare tax (0.9%)</td>
            <td>−{usd(FLIP.llc.addlMedicareTax, 0)}</td>
            <td>−{usd(FLIP.scorp.addlMedicareTax, 0)}</td>
            <td>−{usd(FLIP_SSTB.scorp.addlMedicareTax, 0)}</td>
          </tr>
          <tr>
            <td>QBI deduction</td>
            <td>{usd(FLIP.llc.qbiDeduction, 0)} — zeroed by the wage limit</td>
            <td>{usd(FLIP.scorp.qbiDeduction, 0)}</td>
            <td>{usd(FLIP_SSTB.scorp.qbiDeduction, 0)} — SSTB excluded</td>
          </tr>
          <tr>
            <td>Federal income tax</td>
            <td>−{usd(FLIP.llc.incomeTax, 0)}</td>
            <td>−{usd(FLIP.scorp.incomeTax, 0)}</td>
            <td>−{usd(FLIP_SSTB.scorp.incomeTax, 0)}</td>
          </tr>
          <tr>
            <td>Payroll &amp; compliance overhead</td>
            <td>—</td>
            <td>−{usd(FLIP.scorp.payrollCost, 0)}</td>
            <td>−{usd(FLIP_SSTB.scorp.payrollCost, 0)}</td>
          </tr>
          <tr>
            <td><strong>You keep</strong></td>
            <td><strong>{usd(FLIP.llc.afterTax, 0)}</strong></td>
            <td><strong>{usd(FLIP.scorp.afterTax, 0)}</strong></td>
            <td><strong>{usd(FLIP_SSTB.scorp.afterTax, 0)}</strong></td>
          </tr>
          <tr>
            <td><strong>Election is worth</strong></td>
            <td>—</td>
            <td><strong>+{usd(FLIP.delta, 0)}/yr</strong></td>
            <td><strong>+{usd(FLIP_SSTB.delta, 0)}/yr</strong></td>
          </tr>
        </tbody>
      </table>
      <p>
        Read the LLC&apos;s QBI line carefully: it is {usd(FLIP.llc.qbiDeduction, 0)} <em>not</em>{' '}
        because the business is unprofitable but because taxable income ({usd(FLIP.llc.taxableBeforeQbi, 0)})
        sits fully past the phase-in band, where a wage-less business&apos;s deduction cannot survive
        the {pct(QBI_CONSTANTS.wageShare * 100, 0)}-of-wages test. The S-Corp&apos;s salary is the
        business&apos;s W-2 wage base, so its {usd(FLIP.scorp.qbiTentative, 0)} tentative deduction
        ({pct(SCORP_CONSTANTS.qbiRate * 100, 0)} of its {usd(FLIP.scorp.k1Income, 0)} K-1) clears the{' '}
        {usd(FLIP.scorp.salaryEffective * QBI_CONSTANTS.wageShare, 0)} wage ceiling and is claimed in full.
      </p>
      <p>
        Now flip the SSTB toggle: taxable income lands above{' '}
        {numFmt(QBI_CONSTANTS.threshold.single + QBI_CONSTANTS.phaseInRange.single, 0)}, the exclusion
        takes the deduction to zero on <em>both</em> columns, and the election thins from{' '}
        {usd(FLIP.delta, 0)} to {usd(FLIP_SSTB.delta, 0)}/yr — a cost of{' '}
        {usd(FLIP.delta - FLIP_SSTB.delta, 0)}, exactly the lost{' '}
        {usd(FLIP.scorp.qbiDeduction, 0)} deduction valued at the marginal bracket it occupied. The
        conclusion is the part most summaries get wrong: <strong>SSTB status removes the QBI bonus,
        not the payroll-tax arbitrage</strong>. A consultancy with this P&amp;L still clears{' '}
        {usd(FLIP_SSTB.delta, 0)}/yr — roughly a third of what an identical software business would
        net from the same election.
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
          operational hassle usually isn&apos;t worth it.
        </li>
        <li>
          <strong>Roughly {usd(Math.round(PROFIT_AT_5K / 1000) * 1000, 0)}–{usd(Math.round(PROFIT_AT_15K / 1000) * 1000, 0)} of profit with a market-supported salary well under the SS wage base</strong> is where the per-year delta runs {usd(5_000, 0)}–{usd(15_000, 0)} at a 40% salary — the band edges are engine-scanned crossings, not folklore. Outside the band the edge does not fade, it compounds: {usd(EDGE80K, 0)}/yr at {usd(80_000, 0)} of profit, {usd(EDGE300K, 0)}/yr at {usd(300_000, 0)}, {usd(EDGE400K, 0)}/yr at {usd(400_000, 0)}, steepening sharply once the LLC&apos;s QBI deduction dies.
        </li>
        <li>
          <strong>When your defensible salary approaches or exceeds the{' '}
          {numFmt(SC.ssWageBase, 0)} wage base</strong>, the classic arbitrage shrinks: dollars
          above the base only carried 2.9% Medicare anyway. The modern wrinkle: above $197,300 of
          taxable income the §199A wage limit starts zeroing the LLC&apos;s QBI deduction, which
          pushes the other way — see the next section.
        </li>
        <li>
          <strong>If you plan to reinvest most profit and sell someday</strong>, the C-Corp
          analysis (QSBS, 21% retained) is the more relevant comparison — that is the{' '}
          <a href="/llc-vs-ccorp-tax-calculator/">LLC vs C-Corp tool</a>&apos;s job.
        </li>
      </ul>

      <h3>Three computed scenarios</h3>
      <p>
        All three run through the same engine at {usd(SC.defaultPayrollCost, 0)}/yr overhead,
        non-SSTB, single filer — the scenario grid in the tool above holds these vignettes at its
        other salary ratios, and the sensitivity chart sweeps the full salary range.
      </p>
      <ul>
        <li>
          <strong>Low income — {usd(50_000, 0)} profit, 40% salary.</strong> The model puts the
          S-Corp {LOW.winner === 'scorp' ? 'ahead by' : 'behind by'}{' '}
          {usd(LOW.delta, 0)}/yr — a real but thin win. The honest reason to skip the election here
          is operational, not arithmetic: state franchise minimums (California&apos;s $800),
          payroll-service minimums, and a second tax return scale down far more slowly than the tax
          saving does. At this level the hassle cost usually eats a {usd(LOW.delta, 0)} edge.
        </li>
        <li>
          <strong>High income — {usd(500_000, 0)} profit, 40% salary.</strong> The S-Corp wins by{' '}
          {usd(HIGH.delta, 0)}/yr — its strongest ground, and the opposite of the flat-15.3%
          intuition. Three forces compound: the LLC&apos;s QBI deduction is gone entirely
          ({usd(HIGH.llc.qbiDeduction, 0)} — no wages to support it), the S-Corp protects{' '}
          {usd(HIGH.scorp.qbiDeduction, 0)} of QBI with its own salary, and the LLC alone pays{' '}
          {usd(HIGH.llc.addlMedicareTax, 0)} of Additional Medicare Tax on the SE side.
        </li>
        <li>
          <strong>Already drawing a salary — {usd(300_000, 0)} profit, {usd(150_000, 0)} already on
          payroll (50%).</strong> The election still wins {usd(PARTIAL.delta, 0)}/yr, and at a 40%
          salary the same business wins {usd(PARTIAL40.delta, 0)}/yr. Be clear about which mechanism
          is doing what at this profit level: at both salary points the §199A wage limit is{' '}
          <em>not</em> the binding constraint (the deduction runs at the full 20% of K-1 either way —
          the 50%-of-salary ceiling comfortably exceeds it), so the 40%-vs-50% difference is the
          classic arbitrage: less salary, bigger distribution slice. The wage-limit headroom effect
          lives lower on the salary scale — the sensitivity chart&apos;s optimum near a 27–28%
          salary is where extra salary stops buying QBI protection faster than it costs FICA. The
          flip side sits below ~$250k of profit: there, a 70% salary ratio leaves almost no
          distribution slice and the LLC column wins (see the 70% column of the scenario table).
          Where you already are on the salary spectrum is exactly what the sensitivity chart above
          plots.
        </li>
      </ul>

      <h2 id="decision-boundaries">Decision boundaries: where the verdict flips</h2>
      <p>
        The ranges above are prose; these are measurements. All three scans run at build time through
        the same engine the widget runs, on the signed after-tax edge of the S-Corp (S-Corp
        after-tax minus LLC after-tax), federal-only, single filer, non-SSTB, at the default{' '}
        {usd(SC.defaultPayrollCost, 0)}/yr overhead — so they move when the parameters do:
      </p>
      <ol>
        <li>
          <strong>Profit floor</strong> — bisection on profit with salary pinned at a fixed share of
          it, halving a {usd(5_000, 0)}–{usd(150_000, 0)} bracket 80 times until the zero crossing
          is pinned to the dollar (the edge rises monotonically through the region; the grid points
          below bracket it).
        </li>
        <li>
          <strong>Salary ceiling</strong> — the same edge recomputed at 151 salary shares from 15% to
          90% of profit in half-point steps; the ceiling is the last share where the S-Corp clears
          the engine&apos;s ±$0.50 tie band.
        </li>
        <li>
          <strong>Overhead ceiling</strong> — the engine&apos;s own <code>breakevenPayrollCostFull</code>{' '}
          bisection: the annual overhead at which the two columns tie.
        </li>
      </ol>

      <h3>The profit floor</h3>
      <table>
        <thead>
          <tr>
            <th>Salary share of profit</th>
            <th>Election turns positive at</th>
          </tr>
        </thead>
        <tbody>
          <tr><td>30%</td><td>≈ {usd(FLOOR30, 0)}/yr of profit</td></tr>
          <tr><td>40%</td><td>≈ {usd(FLOOR40, 0)}/yr of profit</td></tr>
          <tr><td>50%</td><td>≈ {usd(FLOOR50, 0)}/yr of profit</td></tr>
        </tbody>
      </table>
      <p>
        At a 40% salary the arithmetic crosses zero near {usd(FLOOR40, 0)} of profit — about{' '}
        {usd(Math.abs(EDGE10K), 0)}/yr underwater at {usd(10_000, 0)}, {usd(EDGE60K, 0)}/yr ahead at{' '}
        {usd(60_000, 0)}, {usd(EDGE100K, 0)}/yr at {usd(100_000, 0)}. Notice how far below the
        practical {usd(40_000, 0)}–{usd(50_000, 0)} guidance of the previous section this sits: the
        engine only knows the {usd(SC.defaultPayrollCost, 0)} you type, not payroll-service minimums,
        franchise taxes and a second tax return. The scan gives the <em>arithmetic</em> floor; the
        operational floor sits meaningfully above it, and both should be cleared before filing 2553.
      </p>

      <h3>The overhead ceiling</h3>
      <table>
        <thead>
          <tr>
            <th>Profit (40% salary)</th>
            <th>Election survives overhead up to</th>
            <th>Per month</th>
          </tr>
        </thead>
        <tbody>
          {OVERHEAD_CEILING.map((row) => (
            row.be === null ? null : (
              <tr key={row.profit}>
                <td>{usd(row.profit, 0)}</td>
                <td>{usd(row.be, 0)}/yr</td>
                <td>{usd(row.be / 12, 0)}/mo</td>
              </tr>
            )
          ))}
        </tbody>
      </table>
      <p>
        Read a row as a budget: at {usd(200_000, 0)} of profit the election carries up to{' '}
        {usd(OVERHEAD_CEILING[2].be ?? 0, 0)}/yr — about {usd((OVERHEAD_CEILING[2].be ?? 0) / 12, 0)}/mo
        — of all-in overhead: payroll service, the 1120-S, FUTA/SUTA, any state franchise tax.
        Stack real costs above the ceiling and the LLC wins at those numbers even though the tax
        arithmetic in isolation still looks favorable. In franchise-tax states this is the table
        that decides it.
      </p>

      <h3>The salary ceiling</h3>
      <table>
        <thead>
          <tr>
            <th>Profit</th>
            <th>S-Corp wins for salary shares up to</th>
            <th>Edge at a 90% salary</th>
          </tr>
        </thead>
        <tbody>
          {(
            [
              { profit: 80_000, scan: SCAN80 },
              { profit: 120_000, scan: SCAN120 },
              { profit: 250_000, scan: SCAN250 },
              { profit: 500_000, scan: SCAN500 },
            ] as const
          ).map(({ profit, scan }) => (
            <tr key={profit}>
              <td>{usd(profit, 0)}</td>
              <td>{scan.allWin ? 'no ceiling inside 15–90%' : pct(scan.ceiling * 100, 1)}</td>
              <td>{usd(scan.at90, 0)}/yr</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p>
        At low and mid profits the election dies by starvation: push the salary past roughly
        two-thirds of profit and the distribution slice is too thin to fund the FICA on the salary,
        let alone the overhead. At {usd(500_000, 0)} the ceiling disappears inside the scan range —
        the §199A wage-limit protection keeps the edge positive even at a 90% salary, and the
        deepest edge sits near a {pct(SCAN500.best.ratio * 100, 1)} salary (+{usd(SCAN500.best.edge, 0)}/yr).
        Treat these as arithmetic boundaries, not safe harbors: the defensible-salary test is market
        evidence, and a scan cannot say which salaries survive it — only which ones pay.
      </p>

      <p>
        Read the three tables as one AND-condition: <strong>the election pays only when profit
        clears the floor, the all-in overhead stack stays under the ceiling, and the defensible
        salary sits inside the winning share band</strong> — adjusted, for specified-service
        businesses, by the SSTB flip in the worked example above. The one posture none of these
        tables prices is the reinvest-and-sell plan, which the C-Corp bullet earlier in this guide
        already routes to the other tool.
      </p>

      <h2 id="beyond-model">Costs beyond this model</h2>
      <p>
        This tool is federal-only and deliberately narrow. Real elections carry moving parts it
        does not price — fold them into the overhead input:
      </p>
      <ul>
        <li><strong>Payroll service</strong> — $40–$150/month for a single-employee S-Corp.</li>
        <li><strong>Form 1120-S and state equivalents</strong> — often $500–$2,000/year more in preparation fees than a Schedule C.</li>
        <li><strong>FUTA + SUTA</strong> — federal unemployment is typically $42–$420/year on the first $7,000 of wages (with the credit); state unemployment varies widely and some states tax S-corp owner wages.</li>
        <li><strong>State franchise or S-corp-specific taxes</strong> — e.g. California&apos;s 1.5% franchise tax on S-corp net income ($800 minimum), Tennessee&apos;s excise tax. In those states the calculus changes materially.</li>
        <li><strong>Workers&apos; compensation</strong> — some states require coverage even for officer-only companies.</li>
        <li><strong>Retirement plan geometry</strong> — a <a href="/solo-401k-calculator/">solo 401(k)</a> can be fed by both salary deferral and profit-sharing under either structure; an S-corp&apos;s employer contribution is based on W-2 wages. Sometimes the retirement plan, not the payroll tax, should drive the salary level.</li>
      </ul>

      <h2 id="process">How to elect (and unwind)</h2>
      <ol>
        <li>Form or keep your LLC; ensure it&apos;s a single permissible shareholder structure (US citizens/residents, no entities as owners for S status).</li>
        <li>File <strong>IRS Form 2553</strong> — no later than March 15 (2 months &amp; 15 days after the start of the tax year) for the election to apply that year, with all shareholders consenting.</li>
        <li>Set up payroll before the first pay date: EIN withholding account, state withholding registration, unemployment accounts, and a payroll provider.</li>
        <li>Pay yourself on a regular schedule (bi-weekly or monthly) with withholding — not ad-hoc transfers, which courts read as distributions.</li>
        <li>Issue W-2 to yourself in January; the K-1 comes from the 1120-S filed by March 15.</li>
      </ol>
      <p>
        One mechanical difference the election creates: payroll withholding covers the income tax on
        your salary, but the K-1 slice arrives with nothing withheld — it needs{' '}
        <a href="/quarterly-estimated-tax-calculator/">quarterly estimated payments</a>, which you
        can size with the estimated-tax tool.
      </p>
      <p>
        Unwinding is possible (voluntary revocation of S status) but has its own cost basis and
        timing rules — another reason to run the numbers <em>and</em> talk to a CPA before filing
        2553, not after.
      </p>

      <h2 id="caveats">Important caveats</h2>
      <ul>
        <li>Federal, single-filer, tax-year 2025 model ({usd(SC.stdDeduction, 0)} standard deduction). No state income tax, no state unemployment beyond your overhead input.</li>
        <li>SSTB phase-outs <strong>are</strong> modeled (the toggle in the tool): a specified service business loses its QBI deduction above $197,300 of taxable income over a $50,000 phase-out — and unlike a regular business, no salary rescues it. Consultants, attorneys, and health professionals should run both toggle positions.</li>
        <li>The model assumes the salary you enter is defensible; it does not judge it. The savings at an indefensible salary are not savings — they are an assessment waiting to happen.</li>
        <li>Employee benefit discrimination rules (health insurance, HSA interactions with S-corp &gt;2% shareholders) are outside this model.</li>
        <li>Tax-year 2026 shifts the parameters ($16,100 standard deduction, $184,500 SS wage base, inflation-adjusted §199A threshold). The structure of the comparison survives; the exact deltas do not.</li>
        <li>Nothing here is tax advice. Verify the current year&apos;s wage base, thresholds, and your state&apos;s rules with a qualified professional.</li>
      </ul>

      <h2 id="glossary">Glossary</h2>
      <p>
        Twelve terms this page leans on, defined for a first pass through the subject — every rate,
        base and threshold is pulled from the same constants the engine computes with.
      </p>
      <dl className="mb-6 mt-2 space-y-5 rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 dark:border-white/[0.08] dark:bg-slate-900/60">
        {GLOSSARY.map(([term, definition]) => (
          <div key={term}>
            <dt className="font-semibold text-slate-900 dark:text-slate-100">{term}</dt>
            <dd className="mt-1 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
              {definition}
            </dd>
          </div>
        ))}
      </dl>

      <Faq
        items={[
          {
            question: 'How much should I pay myself from my S-Corp?',
            answer: (
              <p>
                The working method is the self-audit checklist above: anchor on the wage a
                replacement hire would command, support it with dated market evidence, and write
                down how you arrived at the number — contemporaneous documentation is what holds
                up under review. What you should not do is pick the number that maximizes this (or
                any) calculator&apos;s output.
              </p>
            ),
          },
          {
            question: 'Is there a profit level where the S-Corp election stops being worth it?',
            answer: (
              <p>
                Below roughly $40–50k of net profit, overhead usually eats the savings. At the very
                top, once your defensible salary passes the $176,100 Social Security wage base, the
                payroll-tax arbitrage on additional dollars shrinks to the 2.9% Medicare layer —
                but with one modern wrinkle: above $197,300 of taxable income the wage-less LLC side
                starts losing its QBI deduction, so the full model often shows the election getting{' '}
                <em>stronger</em>, not weaker, at high profits. The sensitivity chart in the tool
                above shows exactly where your edge crosses zero for your own numbers.
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
            question: 'Can I switch back if it stops making sense?',
            answer: (
              <p>
                Yes — shareholders can voluntarily revoke S status by consent filing, effective
                prospectively. There are also involuntary terminations, but the best-known one —
                excess passive income — has two preconditions many summaries skip: it only applies
                to corporations that converted from C-Corp status and still carry accumulated
                earnings &amp; profits, and the test is passive income exceeding 25% of gross
                receipts for three consecutive years. An LLC that elected S status from inception
                cannot trigger it. Revocation, voluntary or not, has basis and built-in-gains
                consequences worth modeling with a CPA first.
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
          {
            question: 'Why does the edge grow when I drag the salary down — shouldn\'t the tool just pick the best salary?',
            answer: (
              <p>
                Every salary dollar moved to distributions escapes payroll tax, so the raw model at
                the default {usd(200_000, 0)} profit with a zero salary would print{' '}
                {usd(ZERO_SALARY.delta, 0)}/yr — against {usd(EX.delta, 0)} at the {usd(80_000, 0)}{' '}
                default. That bigger number is the ceiling of the audit bait, not a recommendation:
                a working owner paying no salary is the classic recharacterization fact pattern,
                which is why the tool evaluates the salary you defend and refuses to optimize it.
              </p>
            ),
          },
          {
            question: 'Why is the S-Corp\'s QBI deduction smaller than the LLC\'s?',
            answer: (
              <p>
                Owner W-2 wages are excluded from QBI by statute, so the deduction covers only the
                K-1 slice: {usd(EX.scorp.qbiDeduction, 0)} versus {usd(EX.llc.qbiDeduction, 0)} at
                the default scenario. That smaller deduction raises income tax and claws back part
                of the payroll saving — one reason the win is never simply 15.3% of the
                distribution slice.
              </p>
            ),
          },
          {
            question: 'What happens in a bad year — can the election actively lose money?',
            answer: (
              <p>
                Overhead does not scale with profit. Model a zero-profit year and the S-Corp column
                still carries the {usd(SC.defaultPayrollCost, 0)} of overhead, finishing{' '}
                {usd(LOSS_YEAR.delta, 0)} behind the LLC — and real payroll-service minimums and
                state franchise taxes behave the same way. Businesses with lumpy income should size
                the election against their weak years, not their best one.
              </p>
            ),
          },
          {
            question: 'Does it ever make sense to set salary above the Social Security wage base?',
            answer: (
              <p>
                Yes, when the market rate genuinely sits there — but know the price. At{' '}
                {usd(300_000, 0)} of profit, raising the salary from {usd(150_000, 0)} to{' '}
                {usd(200_000, 0)} — of which {numFmt(200_000 - SC.ssWageBase, 0)} clears the{' '}
                {numFmt(SC.ssWageBase, 0)} base, where only the 2.9% Medicare layer applies — costs{' '}
                {usd(BASE_UNDER.delta - BASE_OVER.delta, 0)}/yr of edge ({usd(BASE_UNDER.delta, 0)}{' '}
                falls to {usd(BASE_OVER.delta, 0)}). The election still wins; it just wins smaller.
              </p>
            ),
          },
          {
            question: 'I\'m a consultant — does SSTB status ruin the election?',
            answer: (
              <p>
                It removes the QBI bonus, not the arbitrage. At {usd(400_000, 0)} of profit the same
                election is worth {usd(FLIP.delta, 0)}/yr as a regular business and{' '}
                {usd(FLIP_SSTB.delta, 0)}/yr as an SSTB — still clearly positive, because the
                payroll-tax mechanics do not care about SSTB status. And SSTB only matters above{' '}
                {usd(QBI_CONSTANTS.threshold.single, 0)} of taxable income: at the default{' '}
                {usd(200_000, 0)}/{usd(80_000, 0)} scenario both columns sit under the threshold and
                the toggle changes nothing at all.
              </p>
            ),
          },
          {
            question: 'Is there a required salary percentage — a "60/40 rule"?',
            answer: (
              <p>
                The &quot;60/40 rule&quot; is internet folklore — no statute or ruling sets a
                required percentage, and salaries set as round percentages of profit are a
                documented red flag. The percentages that do exist on this page are arithmetic
                boundaries from the scan tables — at {usd(250_000, 0)} of profit the election
                stays ahead for salary shares up to {pct(SCAN250.ceiling * 100, 1)} — which say
                what the tax math pays, not what the law allows.
              </p>
            ),
          },
          {
            question: 'Why did the calculator cap my salary at my profit?',
            answer: (
              <p>
                Wages cannot exceed the pool being split, so the model runs min(salary, profit) and
                flags the truncation. If your intended salary really would exceed profit, there is
                no distribution slice left and nothing for the election to arbitrage — that posture
                is the numerical signature of a business that should not be an S-Corp that year.
              </p>
            ),
          },
          {
            question: 'Are distributions tax-free?',
            answer: (
              <p>
                No — free of payroll tax only, and that exemption is the entire mechanism of the
                savings. They remain ordinary income at your bracket, and as K-1 income they are
                exactly the slice the §199A deduction applies to. The K-1 slice also arrives with
                nothing withheld, so it needs the quarterly estimated payments the process section
                above already describes.
              </p>
            ),
          },
          {
            question: 'Does the election lower my income tax rate?',
            answer: (
              <p>
                No — both columns run the same 2025 brackets on nearly the same income; what changes
                is the base. At the default example the S-Corp actually pays{' '}
                {usd(EX.scorp.incomeTax - EX.llc.incomeTax, 0)} <em>more</em> income tax (a smaller
                QBI deduction and no half-SE deduction), and the election still comes out{' '}
                {usd(EX.delta, 0)} ahead on the payroll side.
              </p>
            ),
          },
          {
            question: 'I have a W-2 day job and a side business — can I still elect?',
            answer: (
              <p>
                The election itself does not care, but this model does not carry the interaction:
                wages from the day job consume the same Social Security wage base, changing both
                the FICA cost of an owner salary and the SE-tax baseline of the alternative. Treat
                the tool&apos;s verdict here as an upper bound and run the combined picture with a
                CPA.
              </p>
            ),
          },
          {
            question: 'Can I put my spouse on the payroll too?',
            answer: (
              <p>
                A second working owner needs their own defensible salary and adds real FICA on it —
                and this tool models a single owner taking 100% of profit, so its numbers do not
                answer that question. What the model does show is the direction: every salary
                dollar the market does not strictly require shrinks the edge, the same mechanism
                behind the salary-ceiling table above.
              </p>
            ),
          },
          {
            question: 'Does the S election change my liability protection?',
            answer: (
              <p>
                No. Liability protection comes from state LLC or corporation law; Subchapter S is a
                tax filing layered on top of the same entity. Electing changes where profit is
                taxed, not who can sue the business or you personally.
              </p>
            ),
          },
          {
            question: 'Why is there no state tax in my results?',
            answer: (
              <p>
                The model is federal-only by declared scope. State effects are real —
                California&apos;s 1.5% franchise tax with an $800 minimum, Tennessee&apos;s excise
                tax, state unemployment regimes — and belong in the overhead input where they apply.
                In franchise-tax states, the overhead-ceiling table above is the number to compare
                your stack against.
              </p>
            ),
          },
          {
            question: 'What happens if the IRS recharacterizes my distributions as salary?',
            answer: (
              <p>
                The recharacterized amount gets FICA and withholding applied retroactively, with
                interest and penalties on top — and the fact pattern courts keep citing is the one
                this guide warns about: little or no salary against large distributions. That
                downside is why a thin but defensible edge beats a fat but indefensible one; this
                model deliberately refuses to price courage.
              </p>
            ),
          },
          {
            question: 'How often do I have to actually run payroll?',
            answer: (
              <p>
                On a regular, published schedule — monthly or bi-weekly is typical — with real
                withholding and a W-2 each January; ad-hoc transfers read as distributions no
                matter what you call them. The frequency is an operational cost, but the regularity
                is evidence.
              </p>
            ),
          },
        ]}
      />

      <RelatedCalculators
        links={[
          { href: '/qbi-deduction-calculator/', label: 'QBI Deduction Calculator' },
          { href: '/solo-401k-calculator/', label: 'Solo 401(k) Calculator' },
          { href: '/quarterly-estimated-tax-calculator/', label: 'Quarterly Estimated Tax Calculator' },
          { href: '/llc-vs-ccorp-tax-calculator/', label: 'LLC vs C-Corp Tax Calculator' },
        ]}
      />
    </article>
  );
}

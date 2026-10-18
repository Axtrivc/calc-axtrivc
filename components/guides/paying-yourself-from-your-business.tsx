import { ArticleToc } from '@/components/Article';
import {
  compareScorpFull,
  computeLlcFull,
  computeScorpFull,
  salarySweepFull,
  SCORP_FULL_CONSTANTS as SC,
} from '@/lib/scorpfull';
import { compareRetirement, sepCapacity, RETIREMENT_CONSTANTS as RC } from '@/lib/retirement';
import { compareRoth, ROTH_CONSTANTS } from '@/lib/roth';
import { numFmt, pct, usd } from '@/lib/format';

/**
 * Guide body: "Paying Yourself From Your Business" — the three-layer order
 * (reasonable salary → retirement contributions → distributions).
 *
 * Every dollar figure in the prose and tables below is computed at build time
 * by the same engines that power the instruments this guide hands off to
 * (lib/scorpfull, lib/retirement, lib/roth) — nothing is hand-typed. The
 * scenario is constant throughout: $200,000 net profit, single filer, tax
 * year 2025, non-SSTB, $1,200/yr payroll overhead (the S-Corp engine's
 * default), owner age 45, and a 24% marginal income-tax rate wherever a
 * deferral's current-year value is needed.
 *
 * Rendered through GuideShell (which supplies h1, the prose column, and the
 * closing instruments panel), so this body starts at h2.
 */

/* ---- Layer 1: the salary sweep at $200k profit (lib/scorpfull) ------------ */
const SWEEP_200 = salarySweepFull(200_000, SC.defaultPayrollCost);
const sweepAt = (r: number) => SWEEP_200.find((p) => Math.abs(p.ratio - r) < 1e-9)!;
const SWEEP_ROWS = [0.15, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.9].map((r) => sweepAt(r));
// Observed gradient: the edge lost per $10k of added salary (uniform across
// the under-the-wage-base rows: 18,779.24 − 16,916.12 = 1,863.12).
const EDGE_PER_10K = sweepAt(0.15).delta - sweepAt(0.2).delta;

// Exact salary ceiling at $200k: the salary where the S-corp's after-tax
// outcome ties the LLC's (bisection on computeScorpFull; the sweep grid
// brackets it between 65% and 70% of profit, i.e. $130k–$135k).
function salaryCeiling(profit: number, lo: number, hi: number): number {
  const llcNet = computeLlcFull(profit).afterTax;
  let a = lo;
  let b = hi;
  for (let i = 0; i < 60; i++) {
    const mid = (a + b) / 2;
    if (computeScorpFull(profit, mid, SC.defaultPayrollCost).afterTax > llcNet) a = mid;
    else b = mid;
  }
  return (a + b) / 2;
}
const CEILING_200K = salaryCeiling(200_000, 130_000, 135_000);

// The profit-dependence check: at $300k the sweep is NOT monotone at the low
// end — a too-small salary loses §199A dollars to the W-2 wage limiter.
const SWEEP_300 = salarySweepFull(300_000, SC.defaultPayrollCost);
const PEAK_300 = SWEEP_300.reduce((m, p) => (p.delta > m.delta ? p : m));
const DELTA_300_15 = SWEEP_300.find((p) => Math.abs(p.ratio - 0.15) < 1e-9)!.delta;
const LOW_300 = computeScorpFull(300_000, 300_000 * 0.15, SC.defaultPayrollCost);

/* ---- The reference comparison at a 40% salary (lib/scorpfull) ------------- */
const CMP = compareScorpFull(200_000, 80_000, SC.defaultPayrollCost);
const CMP_120K = compareScorpFull(200_000, 120_000, SC.defaultPayrollCost);

/* ---- Layer 2: plan room under both pay modes (lib/retirement) ------------- */
const R_LLC = compareRetirement(
  { mode: 'sole-prop', income: 200_000, age: 45, plannedDeferral: RC.employeeDeferralLimit },
  24,
);
const R_SCORP = compareRetirement(
  { mode: 'scorp', income: 80_000, age: 45, plannedDeferral: RC.employeeDeferralLimit },
  24,
);
const R_120K = compareRetirement(
  { mode: 'scorp', income: 120_000, age: 45, plannedDeferral: RC.employeeDeferralLimit },
  24,
);

// The salary at which the S-corp's 25%-of-wages employer room equals the
// LLC's 20%-of-(profit − ½ SE tax) room — the "full room" salary.
const LLC_EMPLOYER_ROOM = sepCapacity('sole-prop', 200_000).contribution;
const MATCH_SALARY = LLC_EMPLOYER_ROOM / RC.employerRate;
const CMP_MATCH = compareScorpFull(200_000, MATCH_SALARY, SC.defaultPayrollCost);
const R_MATCH = compareRetirement(
  { mode: 'scorp', income: MATCH_SALARY, age: 45, plannedDeferral: RC.employeeDeferralLimit },
  24,
);

// The combined view: cash edge minus the deferral value given up this year
// (convention stated in the prose — first-year tax value at 24%, matching the
// retirement engine's own taxSaved definition). Edges are SIGNED (S-corp −
// LLC), the same convention salarySweepFull uses — compareScorpFull's own
// `delta` field is a magnitude (advantage of whichever side won) with the
// sign in `winner` — so every sign the tables print below is computed, never
// assumed, and stays honest if a future parameter change flips a winner.
const signedEdge = (c: ReturnType<typeof compareScorpFull>) => c.scorp.afterTax - c.llc.afterTax;
const EDGE_80 = signedEdge(CMP);
const EDGE_120 = signedEdge(CMP_120K);
const EDGE_MATCH = signedEdge(CMP_MATCH);

// Why the election loses at the full-room salary, decomposed on the engine's
// own columns (verified to the cent: −incomeCost + payrollSaving − overhead =
// signed edge, and the raw outlay columns close the same identity). Payroll
// tax is still CHEAPER for the S-corp there; the loss is §199A — salary is
// wages the deduction cannot attach to, so the QBI deduction collapses and
// the income-tax cost eats the payroll saving plus the overhead.
const MATCH_PAYROLL_ADVANTAGE = CMP_MATCH.llc.seTax - CMP_MATCH.scorp.payrollTax;
const MATCH_INCOME_COST = CMP_MATCH.scorp.incomeTax - CMP_MATCH.llc.incomeTax;

const VALUE_GAP_80 = R_LLC.taxSavedSolo - R_SCORP.taxSavedSolo;
const VALUE_GAP_120 = R_LLC.taxSavedSolo - R_120K.taxSavedSolo;
const NET_EDGE_80 = EDGE_80 - VALUE_GAP_80;
const NET_EDGE_120 = EDGE_120 - VALUE_GAP_120;

/* ---- The flavor decision under volatile income (lib/roth) ----------------- */
// One lean-year dollar (12% bracket today) and one fat-year dollar (32%),
// both judged against a 22% retirement rate, $23,500/yr, 6% return, 25 years.
const LEAN = compareRoth({
  currentRatePct: 12,
  retirementRatePct: 22,
  annualContribution: RC.employeeDeferralLimit,
  years: 25,
  annualReturnPct: 6,
});
const FAT = compareRoth({
  currentRatePct: 32,
  retirementRatePct: 22,
  annualContribution: RC.employeeDeferralLimit,
  years: 25,
  annualReturnPct: 6,
});

const toc = [
  { id: 'the-order', label: 'Three doors, one order' },
  { id: 'layer-one', label: "Layer 1: the salary floor" },
  { id: 'the-band', label: "The engine's salary band" },
  { id: 'layer-two', label: 'Layer 2: retirement is compensation' },
  { id: 'counting-employer', label: 'Count employer dollars before judging the S election' },
  { id: 'layer-three', label: 'Layer 3: distributions are a residual' },
  { id: 'roth-traditional', label: 'Roth or Traditional when income swings' },
  { id: 'sequence', label: 'The sequence, end to end' },
  { id: 'guardrails', label: 'What this model does not cover' },
];

export default function PayingYourselfFromYourBusinessGuide() {
  return (
    <>
      <ArticleToc items={toc} />

      <h2 id="the-order">Three doors, one order</h2>
      <p>
        Every dollar your business earns can leave it through exactly three doors: salary,
        retirement contributions, and distributions. The order in which you use them is not a
        preference — it is the decision. <strong>Set the salary your entity and the law require
        first; fill the statutory retirement room that salary and profit create second; treat
        everything left as a residual distribution, never as the default way to pay yourself.</strong>{' '}
        Two of the three doors change shape with your entity, so the framework resolves
        differently depending on how you are organized:
      </p>
      <ul>
        <li>
          <strong>Sole proprietor / single-member LLC (no S election):</strong> door one does not
          exist. The IRS does not treat a sole owner as an employee of their own business, so
          there is no salary to set — all net profit is self-employment income the moment it is
          earned, whether or not you withdraw a dollar. Your only structural lever is the
          retirement plan (Layer 2); draws are cash mechanics (Layer 3).
        </li>
        <li>
          <strong>S corporation:</strong> all three doors exist and the order is enforced. A
          defensible W-2 salary comes first as a matter of law, the employer retirement
          contribution is keyed to that salary, and only the remainder may travel payroll-tax-free
          as distributions.
        </li>
      </ul>
      <p>
        The rest of this guide walks the three layers in order on one worked business —{' '}
        {usd(200_000, 0)} of net profit, single filer, tax year 2025, {usd(SC.defaultPayrollCost, 0)}{' '}
        of assumed payroll overhead — with every number computed by the same engines that power the{' '}
        <a href="/s-corp-tax-calculator/">S-Corp Salary Calculator</a>, the{' '}
        <a href="/solo-401k-calculator/">Solo 401(k) Calculator</a>, and the{' '}
        <a href="/roth-vs-traditional-calculator/">Roth vs Traditional Calculator</a>. The order of
        the layers is also the order of the questions: a salary decision made without the
        retirement question is half a decision, and an entity decision made without both is a
        guess.
      </p>

      <div className="my-8 rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 dark:border-white/[0.08] dark:bg-slate-900/60">
        <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          The order of operations
        </div>
        <ol className="mt-3">
          <li>
            <strong>Reasonable salary — the floor.</strong> In an S-corp this is a legal
            requirement tested against what comparable businesses pay, not a tax dial you set to
            whatever number wins. Set it with market evidence; where the arithmetic stops paying
            is a separate question (see the band below).
          </li>
          <li>
            <strong>Retirement contributions — the second door.</strong> Plan room is created by
            your compensation ({pct(RC.employerRate * 100, 0)} of W-2 wages in an S-corp;{' '}
            {pct(RC.employerRateSelfEmployed * 100, 0)} of net profit reduced by half of SE tax as
            a sole proprietor, per IRS Publication 560), and contributions reduce income tax but
            never payroll or self-employment tax.
          </li>
          <li>
            <strong>Distributions and draws — the residual.</strong> What remains after the first
            two doors. Not a salary substitute: in an S-corp, taking this door first is the
            classic recharacterization fact pattern.
          </li>
        </ol>
      </div>

      <h2 id="layer-one">Layer 1: the salary floor</h2>
      <p>
        In an S corporation you are an employee of your own company, and the deduction for your
        compensation is allowed only to the extent it is <em>reasonable</em> — IRC §162(a)(1), with
        the test supplied by Treasury Regulation §1.162-7: what would ordinarily be paid for
        comparable services by comparable enterprises under comparable circumstances. The IRS and
        the courts weigh the facts from several directions — your training and experience, the
        duties you actually perform and the time you devote to them, what similarly situated
        businesses pay for those duties, how your pay compares year to year, and the overall
        relationship between salary and distributions. No percentage-of-profit formula has been
        endorsed; a consistent, documented methodology beats a clever one.
      </p>
      <p>
        The reason the floor is enforced so seriously is mechanical: every dollar of profit you
        label &quot;distribution&quot; instead of &quot;salary&quot; escapes the{' '}
        {pct(SC.seRate * 100, 1)} combined payroll-tax layer (Social Security up to the{' '}
        {usd(SC.ssWageBase, 0)} wage base, plus Medicare on everything, both halves). Paying
        yourself a token salary and taking the rest as distributions is the pattern courts have
        repeatedly rejected, and losing means back payroll tax, penalties, and interest. The
        defense is contemporaneous evidence: a compensation study or market data pull, minutes or
        a written resolution adopting the salary, and a review whenever your duties change.
      </p>

      <h2 id="the-band">The engine&apos;s salary band</h2>
      <p>
        Legality set aside, where does the arithmetic itself stop paying? The{' '}
        <a href="/s-corp-tax-calculator/">S-Corp Salary Calculator</a> engine sweeps salaries
        across a range of the profit and measures the signed after-tax edge of the election at
        each point. At {usd(200_000, 0)} of profit with {usd(SC.defaultPayrollCost, 0)} of payroll
        overhead (single filer, non-SSTB, 2025):
      </p>
      <table>
        <thead>
          <tr>
            <th>Salary share of profit</th>
            <th>W-2 salary</th>
            <th>After-tax edge of the S election</th>
            <th>Winner</th>
          </tr>
        </thead>
        <tbody>
          {SWEEP_ROWS.map((p) => (
            <tr key={p.ratio}>
              <td>{pct(p.ratio * 100, 0)}</td>
              <td>{usd(p.salary, 0)}</td>
              <td>
                {p.delta >= 0 ? '+' : '−'}
                {numFmt(Math.abs(p.delta), 0)}
              </td>
              <td>
                <strong>{p.delta > 0.5 ? 'S-Corp' : p.delta < -0.5 ? 'LLC' : 'Tie'}</strong>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p>
        Read the shape, not just the sign. Below the Social Security base, every {usd(10_000, 0)}{' '}
        of added salary costs {usd(EDGE_PER_10K, 0)} of edge at this profit — the{' '}
        {pct(SC.seRate * 100, 1)} FICA layer plus a small §199A adjustment — and the
        election&apos;s entire advantage is the FICA that salaries avoid. The election still wins
        through {pct((CEILING_200K / 200_000) * 100, 1)}{' '}
        of profit: a salary of {usd(CEILING_200K, 0)} is the exact break-even this engine finds,
        and above it the LLC wins outright — at a 90% salary you would give back{' '}
        {usd(Math.abs(sweepAt(0.9).delta), 0)} a year. So the tax arithmetic imposes a{' '}
        <strong>ceiling</strong>, not a floor: at this profit level, any defensible salary below{' '}
        {usd(CEILING_200K, 0)} leaves the election ahead. The <em>legal</em> floor sits
        independently, on the market evidence of Layer 1 — the band only tells you where the
        election stops paying.
      </p>
      <p>
        The band is profit-dependent, and at higher profits the low end bends too. Sweep the same
        engine at {usd(300_000, 0)} of profit and the curve is no longer monotone: the peak sits
        at {pct(PEAK_300.ratio * 100, 1)} with {usd(PEAK_300.delta, 0)} of edge, while the 15%
        point falls {usd(PEAK_300.delta - DELTA_300_15, 0)} behind it. The reason is §199A: at
        that income the deduction is limited by the business&apos;s W-2 wages, and a{' '}
        {usd(LOW_300.salaryEffective, 0)} salary caps the deduction at{' '}
        {usd(LOW_300.qbiDeduction, 0)} where the K-1 pass-through alone would have supported{' '}
        {usd(LOW_300.qbiTentative, 0)}. Too <em>small</em> a salary now costs real money. Run the
        sweep at your own profit before anchoring to anyone&apos;s percentage rule of thumb — the
        band moves, which is exactly why the instrument exists.
      </p>

      <h2 id="layer-two">Layer 2: retirement is compensation</h2>
      <p>
        The second door moves money out of the business and into a plan instead of your checking
        account — and because the room is keyed to your compensation, it is part of the pay
        decision, not something you decide afterwards. The geometry for tax year 2025 (IRS Notice
        2024-80 and Publication 560): an employee deferral up to {usd(RC.employeeDeferralLimit, 0)},
        plus an employer contribution of {pct(RC.employerRate * 100, 0)} of plan compensation in
        an S-corp (your W-2 wages) or, for the self-employed, the{' '}
        {pct(RC.employerRateSelfEmployed * 100, 0)} deduction-rate equivalent applied to net
        profit minus half of SE tax — all under the {usd(RC.totalAdditionsLimit, 0)} §415(c)
        ceiling, with age-based catch-ups layered on top of it.
      </p>
      <p>
        On the same {usd(80_000, 0)} salary, the{' '}
        <a href="/solo-401k-calculator/">Solo 401(k) Calculator</a> engine holds{' '}
        {usd(R_SCORP.solo.total, 0)} — a {usd(R_SCORP.solo.deferralCore, 0)} deferral plus{' '}
        {usd(R_SCORP.solo.employerContribution, 0)} of employer contribution — while a SEP-IRA
        holds {usd(R_SCORP.sep.contribution, 0)}, because a SEP has only the employer lever and no
        deferral bucket at any age. The {usd(R_SCORP.extraCapacity, 0)} difference is exactly that
        deferral bucket, worth {usd(R_SCORP.extraTaxSaved, 0)} of tax deferred at a 24% marginal
        rate this year. If the plan choice ever looked cosmetic, that is the entire difference
        between the two vehicles at owner scale — a bucket, not a rounding error.
      </p>

      <h2 id="counting-employer">Count employer dollars before judging the S election</h2>
      <p>
        Here is the step most one-page comparisons skip. The employer contribution is your money —
        deferred rather than delivered — so when you ask whether the S election &quot;pays,&quot;
        total compensation means salary <em>plus</em> employer contributions. At the same{' '}
        {usd(200_000, 0)} business, with the election question re-run at three salary policies:
      </p>
      <table>
        <thead>
          <tr>
            <th>Measure (2025, single filer)</th>
            <th>LLC, no election</th>
            <th>S-Corp, {usd(80_000, 0)} salary</th>
            <th>S-Corp, {usd(MATCH_SALARY, 0)} salary</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Base the employer % keys to</td>
            <td>{usd(R_LLC.solo.compensationBase, 0)} (profit − ½ SE tax)</td>
            <td>{usd(80_000, 0)} W-2 wages</td>
            <td>{usd(MATCH_SALARY, 0)} W-2 wages</td>
          </tr>
          <tr>
            <td>Solo 401(k) room this year</td>
            <td>{usd(R_LLC.solo.total, 0)}</td>
            <td>{usd(R_SCORP.solo.total, 0)}</td>
            <td>{usd(R_MATCH.solo.total, 0)}</td>
          </tr>
          <tr>
            <td>Tax deferred at 24% this year</td>
            <td>{usd(R_LLC.taxSavedSolo, 0)}</td>
            <td>{usd(R_SCORP.taxSavedSolo, 0)}</td>
            <td>{usd(R_MATCH.taxSavedSolo, 0)}</td>
          </tr>
          <tr>
            <td>After-tax cash edge of the election</td>
            <td>—</td>
            <td>
              {EDGE_80 >= 0 ? '+' : '−'}
              {numFmt(Math.abs(EDGE_80), 0)}
            </td>
            <td>
              {EDGE_MATCH >= 0 ? '+' : '−'}
              {numFmt(Math.abs(EDGE_MATCH), 0)}
            </td>
          </tr>
          <tr>
            <td>Cash edge net of retirement value given up</td>
            <td>—</td>
            <td>
              {NET_EDGE_80 >= 0 ? '+' : '−'}
              {numFmt(Math.abs(NET_EDGE_80), 0)}
            </td>
            <td>
              {EDGE_MATCH >= 0 ? '+' : '−'}
              {numFmt(Math.abs(EDGE_MATCH), 0)}
            </td>
          </tr>
        </tbody>
      </table>
      <p>
        Three facts fall out of the engines. First, the LLC&apos;s plan room at this profit is{' '}
        {usd(R_LLC.solo.total, 0)} — {pct(RC.employerRateSelfEmployed * 100, 0)} of a base the
        whole profit feeds — while the S-corp&apos;s employer room keys to wages alone, so a{' '}
        {usd(80_000, 0)} salary caps the plan at {usd(R_SCORP.solo.total, 0)}, and the missing{' '}
        {usd(R_LLC.solo.total - R_SCORP.solo.total, 0)} of room is worth{' '}
        {usd(VALUE_GAP_80, 0)} of deferral value at a 24% rate. Second, to match the LLC&apos;s
        employer room the S-corp salary must reach {usd(MATCH_SALARY, 0)} — and at that salary the
        election&apos;s cash edge is gone entirely: the engine finds the LLC ahead by{' '}
        {usd(Math.abs(EDGE_MATCH), 0)}. Not because of payroll tax — the S-corp still pays{' '}
        {usd(MATCH_PAYROLL_ADVANTAGE, 0)} <em>less</em> of it ({usd(CMP_MATCH.scorp.payrollTax, 0)}{' '}
        against the LLC&apos;s {usd(CMP_MATCH.llc.seTax, 0)} SE bill). The loss is §199A: owner
        wages can never carry the deduction, so shrinking K-1 to{' '}
        {usd(CMP_MATCH.scorp.k1Income, 0)} collapses it from the LLC&apos;s{' '}
        {usd(CMP_MATCH.llc.qbiDeduction, 0)} to {usd(CMP_MATCH.scorp.qbiDeduction, 0)} and adds{' '}
        {usd(MATCH_INCOME_COST, 0)} of income tax. The ledger, straight off the engine&apos;s
        columns: −{numFmt(MATCH_INCOME_COST, 0)} income tax + {numFmt(MATCH_PAYROLL_ADVANTAGE, 0)}{' '}
        payroll saving − {numFmt(SC.defaultPayrollCost, 0)} overhead ={' '}
        {EDGE_MATCH < 0 ? '−' : '+'}
        {numFmt(Math.abs(EDGE_MATCH), 0)}. The same §199A dial that bends the $300k sweep at its
        low end, running against you at the top of the salary dial. Third, the middle matters: at
        a {usd(120_000, 0)} salary the room recovers to {usd(R_120K.solo.total, 0)} while the
        cash edge shrinks to {usd(EDGE_120, 0)} — leaving a net {usd(NET_EDGE_120, 0)} for the
        election once the {usd(VALUE_GAP_120, 0)} of forgone deferral value is counted.
        Effectively a wash.
      </p>
      <blockquote>
        <p>
          Decision rule: run the election question at the salary you would actually set, including
          the plan you will actually fund. At {usd(200_000, 0)} of profit the election is clearly
          worth it at a {usd(80_000, 0)} salary — {usd(NET_EDGE_80, 0)} ahead even after the
          retirement gap — roughly neutral at {usd(120_000, 0)}, and negative at the full-room
          salary. The salary you pick for retirement reasons can quietly decide the entity
          question.
        </p>
      </blockquote>
      <p>
        Two mechanical notes the engines bake in. Elective deferrals generally require the plan to
        exist by December 31 of the year they are for, while employer dollars can be funded up to
        the return&apos;s due date. And no plan contribution — employee or employer — ever reduces
        payroll or self-employment tax; these are income-tax moves only. The{' '}
        <a href="/guides/retirement-for-the-self-employed/">Retirement for the Self-Employed</a>{' '}
        guide covers the full vehicle stack in depth.
      </p>

      <h2 id="layer-three">Layer 3: distributions are a residual</h2>
      <p>
        What is left after salary, employer contributions, and overhead passes through as K-1
        income — {usd(CMP.scorp.k1Income, 0)} in the worked case — and the cash you take against
        it is a <strong>distribution</strong>. Understand what it is not: within your stock basis
        it is not income at all, and it carries no payroll tax. The profit was already taxed to
        you when it passed through; the distribution is just the cash catching up. That is why
        the election saves payroll tax only on the slice between the salary you must pay and the
        profit you keep — the distribution door itself is not a tax event.
      </p>
      <p>
        The discipline is ordering and records. Run real payroll on the salary — calculated,
        withheld, deposited on schedule — before distributing anything: a business that pays
        distributions while its owner&apos;s salary is unpaid or token is the Layer 1
        recharacterization pattern wearing a different hat. Track stock basis each year, because
        income and contributions increase it while distributions and losses reduce it, and a
        distribution beyond basis triggers capital gain. And because neither salaries nor K-1
        income withhold enough on their own, layer estimated payments across all of it — the{' '}
        <a href="/guides/self-employed-tax-calendar/">Self-Employed Tax Calendar</a> guide maps
        those deadlines and safe harbors. In an un-elected LLC the same discipline applies under
        different names: draws reduce your capital account, and the profit was taxed whether or
        not you drew it.
      </p>

      <h2 id="roth-traditional">Roth or Traditional when income swings</h2>
      <p>
        Once the dollars are inside the plan door, one flavor choice remains: pre-tax or Roth. The{' '}
        <a href="/roth-vs-traditional-calculator/">Roth vs Traditional Calculator</a> engine
        reduces it to a single dial — the rate you avoid today versus the rate you pay at
        withdrawal — with a break-even that is exactly today&apos;s marginal rate. For an owner
        whose self-employment income swings, that dial is not one setting:{' '}
        <strong>each year&apos;s contribution carries its own today-rate</strong> and should be
        judged separately against the single rate you expect in retirement.
      </p>
      <p>
        Both rows below are the same engine at the same savings level — {usd(RC.employeeDeferralLimit, 0)}{' '}
        a year for 25 years at a 6% return, both judged against a 22% retirement rate — differing
        only in the kind of year the money is saved in:
      </p>
      <table>
        <thead>
          <tr>
            <th>The year you save it</th>
            <th>Today&apos;s rate</th>
            <th>Spendable at retirement</th>
            <th>Winner by</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Lean year</td>
            <td>12%</td>
            <td>
              {usd(LEAN.rothSpendable, 0)} Roth vs {usd(LEAN.tradSpendable, 0)} Traditional
            </td>
            <td>
              <strong>Roth</strong>, {usd(LEAN.advantageRoth, 0)}
            </td>
          </tr>
          <tr>
            <td>Fat year</td>
            <td>32%</td>
            <td>
              {usd(FAT.tradSpendable, 0)} Traditional vs {usd(FAT.rothSpendable, 0)} Roth
            </td>
            <td>
              <strong>Traditional</strong>, {usd(Math.abs(FAT.advantageRoth), 0)}
            </td>
          </tr>
        </tbody>
      </table>
      <p>
        The symmetry is the lesson: a 10-point rate gap in your favor is worth{' '}
        {usd(LEAN.advantageRoth, 0)} of spendable money over 25 years, and the same 10-point gap
        against you costs the identical amount — {usd(LEAN.perPointSwing, 0)} swings per point of
        rate, in either direction. So the volatile-income policy writes itself: fill the Roth
        bucket in lean years when your marginal rate is low, fill the pre-tax bucket in fat years
        when the deduction is expensive, and split a deferral across both flavors when a year
        straddles brackets. The engine&apos;s break-even line — 12% in the lean row, 32% in the
        fat one — is the whole decision compressed to one number per year.
      </p>
      <p>
        One boundary to know: direct Roth <em>IRA</em> contributions phase out between{' '}
        {usd(ROTH_CONSTANTS.rothMagiPhaseOut.single.start, 0)} and{' '}
        {usd(ROTH_CONSTANTS.rothMagiPhaseOut.single.end, 0)} of MAGI for single filers in 2025
        (IRS News Release IR-2024-285) — a range a fat year blows straight through. The Roth side
        of a solo 401(k) has no income limit at all, and the {usd(RC.employeeDeferralLimit, 0)}{' '}
        deferral limit is one shared bucket across both flavors, so you can divide it. That is
        the practical route in a high-earning year: pre-tax deferral for the deduction, Roth
        deferral for the lean-year dollars, no IRA phase-out in your way.
      </p>

      <h2 id="sequence">The sequence, end to end</h2>
      <p>Assembled, the pay decision is five steps, each with its own instrument:</p>
      <ol>
        <li>
          <strong>Fix the entity first</strong> — the entity decides which doors exist. The{' '}
          <a href="/guides/choosing-your-business-entity/">Choosing Your Business Entity</a> guide
          walks that decision; do not elect S status &quot;for the savings&quot; before the
          salary question below has an answer.
        </li>
        <li>
          <strong>Set the salary on evidence, then check the band.</strong> Document market data
          for your role, hours, and duties, and adopt the number in writing. Then run the{' '}
          <a href="/s-corp-tax-calculator/">S-Corp Salary Calculator</a> sweep at your profit to
          see where the arithmetic stops paying — {usd(CEILING_200K, 0)} of salary at{' '}
          {usd(200_000, 0)} of profit in the worked case.
        </li>
        <li>
          <strong>Size the plan against the compensation you just set.</strong> The{' '}
          <a href="/solo-401k-calculator/">Solo 401(k) Calculator</a> shows the room your salary
          or profit creates — {pct(RC.employerRate * 100, 0)} of W-2 wages versus{' '}
          {pct(RC.employerRateSelfEmployed * 100, 0)} of the self-employed base — and the table
          above shows why the salary and plan decisions are one decision.
        </li>
        <li>
          <strong>Re-run the election math at that combined salary.</strong> If the salary your
          plan wants erases the election&apos;s edge — as {usd(MATCH_SALARY, 0)} does here — you
          have learned something about the entity choice, not just the payroll register.
        </li>
        <li>
          <strong>Distribute the residual, and pick flavors per year.</strong> Keep basis records
          and payroll current before distributions, and run the{' '}
          <a href="/roth-vs-traditional-calculator/">Roth vs Traditional Calculator</a> each year
          at that year&apos;s marginal rate.
        </li>
      </ol>

      <h2 id="guardrails">What this model does not cover</h2>
      <p>
        Every figure above comes from the suite&apos;s 2025 federal engines, which model a single
        owner with no employees and no state income tax. The S-corp engine applies the{' '}
        {usd(SC.stdDeduction, 0)} standard deduction, the {usd(SC.ssWageBase, 0)} Social Security
        wage base, and the full Form 8995-A §199A chain; the retirement engine applies the{' '}
        {usd(RC.employeeDeferralLimit, 0)} / {usd(RC.totalAdditionsLimit, 0)} limits with
        age-based catch-ups excluded from the ceiling. The models deliberately omit state tax and
        the §401(a)(17) compensation cap, and Layer 2 is layered on top of the election comparison
        transparently — as a flat 24% first-year value of deferral — rather than inside the
        engines. Published 2026 parameters (standard deduction {usd(SC.ty2026.stdDeduction, 0)},
        wage base {usd(SC.ty2026.ssWageBase, 0)}) are surfaced on the calculator pages as drift
        notes. This is a decision framework with illustrative arithmetic, not tax advice; the
        parameters move, and so do your facts — which is exactly why each step hands you the
        instrument that recomputes it.
      </p>
    </>
  );
}

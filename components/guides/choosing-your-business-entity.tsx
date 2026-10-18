import { ArticleToc } from '@/components/Article';
import {
  compareEntities,
  computeLlc,
  ccorpWinCount,
  excludedAdditionalMedicare,
  excludedNiit,
  findCrossoverPayout,
  findCrossoverProfit,
  payoutThresholdShape,
  TAX_CONSTANTS as LC,
} from '@/lib/llccorp';
import {
  breakevenPayrollCostFull,
  compareScorpFull,
  computeLlcFull,
  computeScorpFull,
  SCORP_FULL_CONSTANTS as SC,
} from '@/lib/scorpfull';
import { QBI_CONSTANTS } from '@/lib/qbi';
import { numFmt, pct, usd } from '@/lib/format';

/* Every instrument-math number below is computed at build time by the same
   engines the calculators run — lib/llccorp for the pass-through vs C-Corp
   crossover and payout curve, lib/scorpfull for the S election's three
   breakeven conditions. Nothing in this guide is hand-typed. */

/* ---- Pass-through vs C-Corp (lib/llccorp) ------------------------------- */

/** Profit at which a retain-everything C-Corp (0% payout) undercuts the LLC —
 *  the only current-year region where the C-Corp wins on tax alone. */
const CROSSOVER_RETAIN = findCrossoverProfit(0) ?? 0;
/** At full payout the LLC wins everywhere — the engine returns no crossing. */
const CROSSOVER_FULL = findCrossoverProfit(1); // null by design
/** C-Corp winning rungs across a 0→$5M scan at $25k steps, 100% payout. */
const FULL_PAYOUT_RUNGS = Math.floor(5_000_000 / 25_000) + 1;
const FULL_PAYOUT_CCORP_WINS = ccorpWinCount(1);
/** 21% + 20% × 79% — the fully-distributed C-Corp asymptote, derived here. */
const CCORP_ASYMPTOTE = pct((0.21 + 0.2 * 0.79) * 100, 1);

const LADDER = [100_000, 200_000, 400_000];
const LADDER_FULL = LADDER.map((p) => compareEntities(p, 1));
const LADDER_RETAIN = LADDER.map((p) => compareEntities(p, 0));

/* Payout tie thresholds — the distribution share below which the C-Corp wins. */
const PT_100K = findCrossoverPayout(100_000);
const PT_400K = findCrossoverPayout(400_000);
const PT_1M = findCrossoverPayout(1_000_000);
const SHAPE = payoutThresholdShape();

/* Modest-profit anchor: at $50k the fully-distributed C-Corp loses outright. */
const LOWWIN = compareEntities(50_000, 1);

/* Surtax exclusions the llccorp engine deliberately omits (its own disclosure
   helpers) — quantified in the footnote under the crossover table. The 0.9%
   Additional Medicare Tax starts once the SE base passes $200k, i.e. at this
   much profit. */
const ADDL_MEDICARE_PROFIT_START = SC.addlMedicareThreshold / SC.seBaseFactor;

/* LLC effective-rate curve anchors — the shape claim under the crossover
   table ("stays well below" the C-Corp path at every scanned level). */
const LLC_1M_RATE = computeLlc(1_000_000).effectiveRate;
const LLC_5M_RATE = computeLlc(5_000_000).effectiveRate;

/* ---- S election (lib/scorpfull) ------------------------------------------ */

const OH = SC.defaultPayrollCost; // $1,200/yr payroll + compliance overhead
const EX = compareScorpFull(200_000, 80_000, OH); // the canonical worked example

/** Signed after-tax edge of the S-Corp (positive = election wins), with salary
 *  pinned at `ratio` × profit — the quantity all three condition scans bisect. */
function signedEdge(profit: number, ratio: number): number {
  return (
    computeScorpFull(profit, profit * ratio, OH).afterTax -
    computeLlcFull(profit).afterTax
  );
}

/* Condition 1 — profit floor: bisection on profit over [5k, 150k], the edge
   rising monotonically through the region (grid points below bracket it). */
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
const EDGE10K = signedEdge(10_000, 0.4);
const EDGE60K = signedEdge(60_000, 0.4);
const EDGE100K = signedEdge(100_000, 0.4);

/* Sweet-spot band: profit levels where the 40%-salary edge crosses $5k and
   $15k. PREMISE, verified rather than assumed: the edge is piecewise-kinked
   and NOT monotone in profit — a $250-step grid scan over [20k, 400k] finds
   local maxima near $76k and $191k with a dip after each (bracket and §199A
   thresholds create the kinks) — but each of these two targets has exactly
   ONE upward crossing in the window (EDGE_CROSSINGS below, recomputed at
   build time). The bisection therefore converges to the intended band edge;
   any new target must first re-verify crossings === 1 on the same grid, or
   the bisection can land on the wrong crossing. */
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
/** Upward-crossing count for each band target on a $250 grid over [20k, 400k]
 *  — the bisection's uniqueness premise, recomputed at build time (must be 1). */
const EDGE_CROSSINGS = (() => {
  const count = (target: number) => {
    let n = 0;
    let prev = signedEdge(20_000, 0.4);
    for (let p = 20_250; p <= 400_000; p += 250) {
      const e = signedEdge(p, 0.4);
      if (prev < target && e >= target) n++;
      prev = e;
    }
    return n;
  };
  return { at5k: count(5_000), at15k: count(15_000) };
})();
const PROFIT_AT_5K = profitAtEdge(5_000);
const PROFIT_AT_15K = profitAtEdge(15_000);
const EDGE300K = signedEdge(300_000, 0.4);
const EDGE400K = signedEdge(400_000, 0.4);

/* Condition 2 — overhead ceiling: the engine's own breakevenPayrollCostFull
   bisection at a 40% salary for each profit level. */
const OVERHEAD_CEILING = [
  { profit: 80_000, salary: 32_000, be: breakevenPayrollCostFull(80_000, 32_000) },
  { profit: 120_000, salary: 48_000, be: breakevenPayrollCostFull(120_000, 48_000) },
  { profit: 200_000, salary: 80_000, be: breakevenPayrollCostFull(200_000, 80_000) },
  { profit: 500_000, salary: 200_000, be: breakevenPayrollCostFull(500_000, 200_000) },
];

/* Condition 3 — salary band: the edge recomputed at 151 salary shares (15% →
   90% of profit); the ceiling is the last share that clears the ±$0.50 tie band. */
function salaryScan(profit: number) {
  let ceiling = 0;
  let allWin = true;
  let best = { ratio: 0, edge: -Infinity };
  for (let i = 0; i <= 150; i++) {
    const ratio = 0.15 + (0.75 * i) / 150;
    const edge = signedEdge(profit, ratio);
    if (edge > 0.5) ceiling = ratio;
    else allWin = false;
    if (edge > best.edge) best = { ratio, edge };
  }
  return { ceiling, allWin, best };
}
const SCAN80 = salaryScan(80_000);
const SCAN120 = salaryScan(120_000);
const SCAN250 = salaryScan(250_000);
const SCAN500 = salaryScan(500_000);

/* Fine 0.1%-step refinement of the $500k optimum — the 151-point grid reports
   its 27.5% node; this pins the continuous interior peak the table's "deepest
   edge" wording refers to, and marks the other rows' argmax as grid-floor. */
const FINE500 = (() => {
  let best = { ratio: 0, edge: -Infinity };
  for (let r = 0.15; r <= 0.9001; r += 0.001) {
    const edge = signedEdge(500_000, r);
    if (edge > best.edge) best = { ratio: r, edge };
  }
  return best;
})();
/** True when a salary scan's argmax sits on the 15% lower bound of the scan —
 *  the rendered value then means "the edge keeps improving below the scan",
 *  not "this is the optimal salary". */
const AT_SCAN_FLOOR = (best: { ratio: number }): boolean => best.ratio <= 0.15 + 1e-9;

/* The arithmetic-vs-operational floor anchor: even at $40k of profit the model
   shows a thin win — the engine only knows the overhead you type. */
const FORTY_K = compareScorpFull(40_000, 16_000, OH);

/* ---- SSTB × QBI flip (lib/scorpfull through lib/qbi) --------------------- */

const FLIP = compareScorpFull(400_000, 160_000, OH, false);
const FLIP_SSTB = compareScorpFull(400_000, 160_000, OH, true);

/* ---- The four quadrants --------------------------------------------------- */

const QUADRANTS = [
  {
    axis: 'Modest profit · no outside capital',
    verdict: 'Sole proprietorship or single-member LLC, default taxation',
    body: `Nothing clears the first bar: at ${usd(50_000, 0)} of profit a fully-distributed C-Corp loses by ${usd(LOWWIN.delta, 0)}, and the S election's arithmetic win is too thin to survive real-world overhead. Spend your effort on pricing and record-keeping, not on structure.`,
  },
  {
    axis: 'Substantial profit · no outside capital',
    verdict: 'LLC chassis + S election, once three conditions clear',
    body: `This is the arbitrage zone. Between roughly ${usd(PROFIT_AT_5K, 0)} and ${usd(PROFIT_AT_15K, 0)} of profit at a defensible 40% salary, the election is worth ${usd(5_000, 0)}–${usd(15_000, 0)} a year — check profit floor, overhead ceiling, and salary band before filing.`,
  },
  {
    axis: 'Any profit · institutional capital intended',
    verdict: 'C-Corp — the tax comparison is not the deciding input',
    body: `Venture funds cannot hold S-Corp stock, preferred stock needs a C-Corp, and the qualified small business stock exclusion (IRC §1202) only attaches to C-Corp shares. The crossover math still matters — for the salary you pay yourself, not for the choice.`,
  },
  {
    axis: 'High profit · no outside capital · mostly retained',
    verdict: 'C-Corp only below the payout threshold — a deferral, not a gift',
    body: `Distribute under about ${pct((SHAPE.above500kMin ?? 0) * 100, 0)}–${pct((SHAPE.localPeak.payout ?? 0) * 100, 0)} of after-tax profit above ${usd(500_000, 0)} and the flat 21% beats the pass-through stack in the current year. The moment you distribute past the threshold, the LLC wins again.`,
  },
] as const;

export default function ChoosingYourBusinessEntityArticle() {
  const toc = [
    { id: 'framework', label: 'Two questions, four answers' },
    { id: 'chassis', label: 'The chassis and the elections' },
    { id: 'pass-through-vs-double', label: 'Pass-through vs double tax' },
    { id: 's-election', label: 'The S election: three conditions' },
    { id: 'sstb-qbi', label: 'SSTB and QBI move the line' },
    { id: 'decision-path', label: 'The decision path, in order' },
    { id: 'limits', label: 'What this framework cannot decide' },
  ];

  return (
    <>
      <ArticleToc items={toc} />

      <p>
        The entity decision resolves into two questions: <strong>how much profit the
        business will actually clear</strong>, and <strong>who will own it</strong>. If
        you intend to raise institutional capital, form a C-Corp — the tax arithmetic
        in this guide becomes a footnote to that fact. If you will not, and profit is
        modest, stay a sole proprietorship or a default-taxed LLC and spend the effort
        on pricing instead. If you will not, and profit is substantial, keep the LLC
        chassis and add an S election once three engine-computed conditions clear: a
        profit floor, an overhead ceiling, and a defensible salary band. The C-Corp as
        a <em>tax</em> play wins only when you retain most profit inside the company —
        above {usd(CROSSOVER_RETAIN, 0)} of profit at zero distribution, and below a
        computable payout threshold everywhere else. The rest of this guide is those
        sentences with the arithmetic exposed.
      </p>

      {/* ================================================================== */}
      <h2 id="framework">Two questions, four answers</h2>
      <p>
        Cross the two axes — profit scale (what the business clears after expenses,
        not what it grosses) and financing intent (whether outside capital will ever
        buy a preferred seat) — and the decision collapses to four headline
        verdicts. They are not four mutually exclusive regions: financing intent
        dominates the profit axis outright, and the retention verdict refines the
        no-outside-capital branch by a third variable — how much profit you
        actually distribute. A {usd(600_000, 0)} owner who retains most profit
        lands on both the S-election and the retention cards; the order resolves
        it, and this guide works it in precedence order — answer the financing
        question first, the profit-scale question second, and treat retention as
        a refinement of the second, not a rival to it. The figures cited are
        computed by the same engines that power the instruments this guide hands
        off to.
      </p>
      <div className="my-6 grid gap-4 sm:grid-cols-2">
        {QUADRANTS.map((q) => (
          <div
            key={q.axis}
            className="panel p-5"
          >
            <span className="chip bg-indigo-50 text-indigo-700 ring-1 ring-inset ring-indigo-200 dark:bg-indigo-500/15 dark:text-indigo-300 dark:ring-indigo-500/25">
              {q.axis}
            </span>
            <h3 className="!mt-3 !text-base !font-bold !leading-snug text-slate-900 dark:text-slate-100">
              {q.verdict}
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
              {q.body}
            </p>
          </div>
        ))}
      </div>
      <p>
        Two scope notes before the math. First, this guide decides <strong>tax
        posture</strong> — the liability shield itself comes from state LLC or
        corporation law and exists the moment you form and maintain the entity
        properly; nothing in the federal analysis below weakens or strengthens it.
        Second, every dollar figure assumes tax year 2025, a single owner, single
        filer, US federal taxes only: the {usd(LC.stdDeduction, 0)} standard deduction
        (as raised for 2025 by the One Big Beautiful Bill Act, P.L. 119-21), the{' '}
        {usd(LC.seCap, 0)} Social Security wage base, and a flat {pct(LC.corporateRate * 100, 0)}{' '}
        corporate rate under IRC §11. State franchise taxes — California charges an
        $800 minimum regardless of profit — sit outside every number here and belong
        in your overhead estimate. And one disclosure the section headings do not
        carry: the two engines in this guide run at different fidelity. The
        pass-through vs C-Corp engine leaves out two surtaxes — the 0.9%
        Additional Medicare Tax (IRC §1401(b)(2)), which starts once wages or the
        SE base pass {usd(SC.addlMedicareThreshold, 0)} — about{' '}
        {usd(ADDL_MEDICARE_PROFIT_START, 0)} of profit — and the 3.8% net
        investment income tax on the C-Corp&apos;s dividends (IRC §1411) — while
        the S-election engine models the 0.9% on both of its columns. The
        footnote under the crossover table quantifies both exclusions and their
        direction; neither touches the crossover itself.
      </p>

      {/* ================================================================== */}
      <h2 id="chassis">The chassis and the elections</h2>
      <p>
        A business entity and its tax classification are two different choices that
        beginners are sold as one. The entity is the chassis: a sole proprietorship
        (no filing, no shield) or an LLC (one state filing, liability shield). The
        taxation is an election layered on the chassis. A single-member LLC starts
        life <em>disregarded</em> — taxed exactly like a sole proprietorship, all
        profit as self-employment income on Schedule SE. From there the IRS
        check-the-box rules (Treas. Reg. §301.7701-3, Form 8832) let it elect C-Corp
        taxation, or — far more commonly — Form 2553 elects S-Corp taxation under
        Subchapter S (IRC §1362), filed within two months and 15 days of the start of
        the tax year it is to apply.
      </p>
      <p>
        That layering is why the decision is reversible in a way incorporating is
        not: the LLC chassis stays put while the election changes how profit reaches
        your pocket — all of it as self-employment income (default), salary plus
        distributions (S election), or salary plus retained corporate earnings
        (C-Corp). It also explains the guide&apos;s structure: the next section
        compares the default against the C-Corp layer, the one after it examines the
        S layer, and the last combines them. The S election carries statutory
        constraints of its own — shareholders limited to individuals, estates, and
        certain trusts, no nonresident aliens, a 100-shareholder cap (IRC §1361) —
        which is one reason the financing quadrant never bothers with it.
      </p>

      {/* ================================================================== */}
      <h2 id="pass-through-vs-double">
        Pass-through vs double tax: where the crossover actually lives
      </h2>
      <p>
        Default LLC taxation sends every dollar of profit through
        self-employment tax ({pct(LC.seRate * 100, 1)} on the first{' '}
        {usd(LC.seCap, 0)} of the 92.35% Schedule SE base, 2.9% Medicare above it)
        and then your ordinary brackets, softened by the 20% qualified business
        income deduction (IRC §199A). C-Corp taxation takes a flat{' '}
        {pct(LC.corporateRate * 100, 0)} at the entity, then taxes whatever is paid
        out as qualified dividends at long-term capital gains rates — 0/15/20%
        through {usd(LC.ltcg15Breakpoint, 0)} and {usd(LC.ltcg20Breakpoint, 0)} for
        a single filer. Run both stacks at full distribution and pass-through wins
        at every profit level the engine can scan:
      </p>
      <table>
        <thead>
          <tr>
            <th>Annual profit</th>
            <th>LLC — total federal tax</th>
            <th>C-Corp — 100% distributed</th>
            <th>C-Corp — 0% distributed</th>
          </tr>
        </thead>
        <tbody>
          {LADDER.map((p, i) => (
            <tr key={p}>
              <td className="font-semibold text-slate-900 dark:text-slate-100">{usd(p, 0)}</td>
              <td>
                {usd(LADDER_FULL[i].llc.totalTax, 0)}{' '}
                <span className="text-slate-500 dark:text-slate-400">
                  ({pct(LADDER_FULL[i].llc.effectiveRate)})
                </span>
              </td>
              <td>
                {usd(LADDER_FULL[i].ccorp.totalTax, 0)}{' '}
                <span className="text-slate-500 dark:text-slate-400">
                  ({pct(LADDER_FULL[i].ccorp.effectiveRate)})
                </span>
              </td>
              <td>
                {usd(LADDER_RETAIN[i].ccorp.totalTax, 0)}{' '}
                <span className="text-slate-500 dark:text-slate-400">
                  (flat {pct(LC.corporateRate * 100, 0)})
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p>
        The engine scanned {numFmt(FULL_PAYOUT_RUNGS)} profit rungs
        from zero to $5M at 100% payout and the C-Corp won{' '}
        <strong>{FULL_PAYOUT_CCORP_WINS}</strong> of them — the fully-distributed
        corporate stack trends toward the {CCORP_ASYMPTOTE} asymptote (21% plus 20%
        of the remaining 79%), while the LLC&apos;s effective rate —{' '}
        {pct(computeLlc(400_000).effectiveRate)} at {usd(400_000, 0)},{' '}
        {pct(LLC_1M_RATE)} at {usd(1_000_000, 0)}, {pct(LLC_5M_RATE)} at{' '}
        {usd(5_000_000, 0)} — stays well below that path at every level the
        engine scans. No profit level fixes double taxation; only the{' '}
        <strong>payout share</strong> does. Retain everything and the comparison
        flips above <strong>{usd(CROSSOVER_RETAIN, 0)} of profit</strong> — below
        it the progressive pass-through stack stays under a flat 21%; above it
        the single corporate layer is cheaper <em>this year</em>, by{' '}
        {usd(compareEntities(400_000, 0).delta, 0)} at {usd(400_000, 0)}.
      </p>
      <div className="mb-4 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
        Disclosure, quantified by the engine&apos;s own exclusion helpers: at{' '}
        {usd(400_000, 0)} of profit the omitted 0.9% Additional Medicare Tax
        would add {usd(excludedAdditionalMedicare(400_000), 0)} to the LLC column
        and the omitted 3.8% NIIT would add {usd(excludedNiit(400_000, 1), 0)} to
        the fully-distributed C-Corp column; at {usd(1_000_000, 0)} those become{' '}
        {usd(excludedAdditionalMedicare(1_000_000), 0)} and{' '}
        {usd(excludedNiit(1_000_000, 1), 0)}. The two omissions run in opposite
        directions and net in the LLC&apos;s favor at full payout, so the verdict
        above is, if anything, understated. The {usd(CROSSOVER_RETAIN, 0)}{' '}
        retention crossover is untouched: it sits far below the{' '}
        {usd(ADDL_MEDICARE_PROFIT_START, 0)} of profit where the 0.9% begins, and
        NIIT only applies to dollars actually distributed.
      </div>
      <p>
        Between those extremes sits a computable tie threshold: the share of
        after-tax profit you must stay under for the C-Corp to keep winning. At{' '}
        {usd(100_000, 0)} it is {pct((PT_100K ?? 0) * 100, 1)}; by{' '}
        {usd(400_000, 0)} it has dipped to {pct((PT_400K ?? 0) * 100, 1)}; at{' '}
        {usd(1_000_000, 0)} it is back to {pct((PT_1M ?? 0) * 100, 1)}. The curve
        is not flat — it peaks at{' '}
        {pct(SHAPE.peak.payout * 100, 1)} just below {usd(SHAPE.seCapKinkProfit, 0)}{' '}
        of profit (where Social Security tax caps out and the LLC suddenly gets
        cheaper), sags to its {pct(SHAPE.trough.payout * 100, 1)} floor near{' '}
        {usd(SHAPE.trough.profit, 0)}, and settles in the{' '}
        {pct((SHAPE.above500kMin ?? 0) * 100, 1)}–{pct(SHAPE.localPeak.payout * 100, 1)}{' '}
        band above {usd(500_000, 0)}. Read the retention lever honestly, though:
        retained dollars face the capital-gains toll whenever they are eventually
        distributed, so the C-Corp&apos;s win is a deferral of tax, not an
        elimination — it only becomes real if you never distribute (or sell assets
        structured to convert the deferral). The{' '}
        <a href="/llc-vs-ccorp-tax-calculator/">LLC vs C-Corp instrument</a> runs
        the same engine on your own profit and payout numbers.
      </p>

      {/* ================================================================== */}
      <h2 id="s-election">The S election: three breakeven conditions</h2>
      <p>
        The S election&apos;s mechanism is payroll arithmetic: without it, 100% of
        LLC profit is self-employment income; with it, profit splits into W-2 salary
        (paying both halves of FICA) and K-1 distributions (paying no payroll tax at
        all). Every dollar moved from the salary column to the distribution column
        saves its marginal payroll tax — <em>if</em> the salary you keep paying is
        defensible as reasonable compensation, a facts-and-circumstances test the
        IRS polices and no percentage rule satisfies. The canonical worked example —{' '}
        {usd(200_000, 0)} profit, {usd(80_000, 0)} salary, {usd(OH, 0)} of payroll
        and compliance overhead — shows the net of all the cross-effects:
      </p>
      <table>
        <thead>
          <tr>
            <th>Line</th>
            <th>LLC (default)</th>
            <th>LLC + S election</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>SE / payroll tax</td>
            <td>−{usd(EX.llc.seTax, 0)}</td>
            <td>−{usd(EX.scorp.payrollTax, 0)}</td>
          </tr>
          <tr>
            <td>QBI deduction (§199A)</td>
            <td>{usd(EX.llc.qbiDeduction, 0)}</td>
            <td>{usd(EX.scorp.qbiDeduction, 0)}</td>
          </tr>
          <tr>
            <td>Federal income tax</td>
            <td>−{usd(EX.llc.incomeTax, 0)}</td>
            <td>−{usd(EX.scorp.incomeTax, 0)}</td>
          </tr>
          <tr>
            <td>Payroll &amp; compliance overhead</td>
            <td>—</td>
            <td>−{usd(EX.scorp.payrollCost, 0)}</td>
          </tr>
          <tr>
            <td><strong>You keep</strong></td>
            <td><strong>{usd(EX.llc.afterTax, 0)}</strong></td>
            <td><strong>{usd(EX.scorp.afterTax, 0)}</strong></td>
          </tr>
        </tbody>
      </table>
      <p>
        <strong>The election is worth {usd(EX.delta, 0)}/year</strong> at those
        inputs — payroll tax falls by {usd(EX.llc.seTax - EX.scorp.payrollTax, 0)},
        income tax rises by {usd(EX.scorp.incomeTax - EX.llc.incomeTax, 0)} (a
        smaller QBI base, no half-SE deduction), and overhead takes its cut. That
        delta is what the three conditions gate. All three scans run through the
        full-fidelity engine behind the{' '}
        <a href="/s-corp-tax-calculator/">S-Corp Salary instrument</a> — federal-only,
        single filer, {usd(OH, 0)}/yr overhead — so they move when the parameters do.
      </p>

      <h3>Condition 1 — the profit floor</h3>
      <p>
        Bisection on profit, salary pinned at a fixed share of it, until the
        election&apos;s after-tax edge crosses zero:
      </p>
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
        At a 40% salary the arithmetic crosses zero near {usd(FLOOR40, 0)} — about{' '}
        {usd(Math.abs(EDGE10K), 0)}/yr underwater at {usd(10_000, 0)},{' '}
        {usd(EDGE60K, 0)}/yr ahead at {usd(60_000, 0)}, {usd(EDGE100K, 0)}/yr at{' '}
        {usd(100_000, 0)}. Notice how far below the practical{' '}
        {usd(40_000, 0)}–{usd(50_000, 0)} guidance this sits: at {usd(40_000, 0)} of
        profit the engine still shows the election ahead by{' '}
        {usd(FORTY_K.delta, 0)}/yr — but the engine only knows the {usd(OH, 0)} of
        overhead you type. Payroll-service minimums, a second tax return, and state
        franchise minimums scale down far more slowly than the tax saving, and they
        are what actually eat a thin edge. The scan gives the arithmetic floor;
        treat roughly {usd(40_000, 0)}–{usd(50_000, 0)} of consistent profit as the
        operational one, and clear both before filing Form 2553.
      </p>

      <h3>Condition 2 — the overhead ceiling</h3>
      <p>
        The engine&apos;s own <code>breakevenPayrollCostFull</code> bisection: the
        annual all-in overhead at which the two columns tie, at a 40% salary:
      </p>
      <table>
        <thead>
          <tr>
            <th>Profit (40% salary)</th>
            <th>Election survives overhead up to</th>
            <th>Per month</th>
          </tr>
        </thead>
        <tbody>
          {OVERHEAD_CEILING.map((row) =>
            row.be === null ? null : (
              <tr key={row.profit}>
                <td>{usd(row.profit, 0)}</td>
                <td>{usd(row.be, 0)}/yr</td>
                <td>{usd(row.be / 12, 0)}/mo</td>
              </tr>
            ),
          )}
        </tbody>
      </table>
      <p>
        Read a row as a budget. At {usd(200_000, 0)} of profit the election carries
        up to {usd(OVERHEAD_CEILING[2].be ?? 0, 0)}/yr — about{' '}
        {usd((OVERHEAD_CEILING[2].be ?? 0) / 12, 0)}/mo — of payroll service, Form
        1120-S preparation, FUTA/SUTA, and any state franchise tax combined. Stack
        real costs above the ceiling and the LLC wins at those numbers even though
        the tax arithmetic in isolation still looks favorable. In franchise-tax
        states this is the table that decides it.
      </p>

      <h3>Condition 3 — the salary band</h3>
      <table>
        <thead>
          <tr>
            <th>Profit</th>
            <th>S-Corp wins for salary shares up to</th>
            <th>Deepest edge in the scan</th>
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
              <td>
                {scan.allWin
                  ? 'no ceiling inside 15–90%'
                  : pct(scan.ceiling * 100, 1)}
              </td>
              <td>
                {pct(scan.best.ratio * 100, 1)} salary (+{usd(scan.best.edge, 0)}/yr)
                {AT_SCAN_FLOOR(scan.best) ? ' — at the scan floor' : ''}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p>
        Read the last column carefully: at {usd(80_000, 0)}–{usd(250_000, 0)} the
        deepest edge sits on the scan&apos;s 15% floor — the edge keeps improving
        as the salary share falls below it, so at those profits the binding
        constraint is salary defensibility, not arithmetic. Only the{' '}
        {usd(500_000, 0)} row&apos;s {pct(SCAN500.best.ratio * 100, 1)} is a true
        interior optimum; a 0.1%-step refinement puts the continuous peak at{' '}
        {pct(FINE500.ratio * 100, 1)} (+{usd(FINE500.edge, 0)}/yr). Push the salary
        past roughly two-thirds of profit at low and mid incomes and
        the distribution slice is too thin to fund the FICA on the salary, let alone
        the overhead — the election dies by starvation. At {usd(500_000, 0)} the
        ceiling disappears inside the scan range, because above{' '}
        {usd(QBI_CONSTANTS.threshold.single, 0)} of taxable income the §199A wage
        limitation starts zeroing a wage-less LLC&apos;s QBI deduction while the
        S-Corp&apos;s own salary keeps its deduction alive — the modern reason the
        election strengthens at high profit instead of fading. The ceiling is an
        arithmetic boundary, not a safe harbor: the defensible-salary test is market
        evidence, and a scan can say which salaries pay, never which ones survive
        review.
      </p>
      <blockquote>
        <p>
          The three conditions are one AND-condition: profit clears the floor,
          overhead stays under the ceiling, and the salary sits inside the band. The
          sweet spot is legible — at a 40% salary the edge runs{' '}
          {usd(5_000, 0)}–{usd(15_000, 0)}/yr between about {usd(PROFIT_AT_5K, 0)} and{' '}
          {usd(PROFIT_AT_15K, 0)} of profit, and does not stop there:{' '}
          {usd(EDGE300K, 0)}/yr at {usd(300_000, 0)}, {usd(EDGE400K, 0)}/yr at{' '}
          {usd(400_000, 0)}.
        </p>
      </blockquote>
      <div className="text-xs leading-relaxed text-slate-500 dark:text-slate-400">
        The band edges come from a bisection whose premise is itself verified at
        build time: on a $250-step scan of the {usd(20_000, 0)}–{usd(400_000, 0)}{' '}
        range, the {usd(5_000, 0)} target shows {EDGE_CROSSINGS.at5k} upward
        crossing(s) and the {usd(15_000, 0)} target {EDGE_CROSSINGS.at15k} —
        exactly one each, so each endpoint is unambiguous. The edge is not
        monotone between them (bracket and §199A kinks create local humps); it
        merely stays inside the {usd(5_000, 0)}–{usd(15_000, 0)} band across the
        quoted range.
      </div>

      {/* ================================================================== */}
      <h2 id="sstb-qbi">SSTB and QBI: the exception that moves the line</h2>
      <p>
        One input changes the S-election arithmetic more than any other: whether the
        business is a <strong>specified service trade or business</strong> — health,
        law, accounting, consulting, financial services, and similar fields under
        §199A(d)(2). Below {usd(QBI_CONSTANTS.threshold.single, 0)} of taxable
        income (single, 2025 — Rev. Proc. 2024-40) the distinction is irrelevant.
        Above it, two things happen in sequence: the QBI deduction becomes limited by
        the business&apos;s W-2 wages ({pct(QBI_CONSTANTS.wageShare * 100, 0)} of
        wages, or {pct(QBI_CONSTANTS.wageShareAlt * 100, 0)} of wages plus{' '}
        {pct(QBI_CONSTANTS.ubiaShare * 100, 1)} of qualified-property basis), and an
        SSTB&apos;s deduction phases out entirely over the following{' '}
        {usd(QBI_CONSTANTS.phaseInRange.single, 0)} of income. A wage-less sole
        proprietorship loses the deduction completely once fully phased in; an
        S-Corp&apos;s owner salary is the business&apos;s W-2 wage base and keeps it
        alive — unless the business is an SSTB, where no salary rescues it.
      </p>
      <p>
        Run the same {usd(400_000, 0)}-profit, {usd(160_000, 0)}-salary business
        through the engine twice:
      </p>
      <table>
        <thead>
          <tr>
            <th>Line</th>
            <th>LLC</th>
            <th>S-Corp</th>
            <th>S-Corp (SSTB)</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>SE / payroll tax</td>
            <td>−{usd(FLIP.llc.seTax, 0)}</td>
            <td>−{usd(FLIP.scorp.payrollTax, 0)}</td>
            <td>−{usd(FLIP_SSTB.scorp.payrollTax, 0)}</td>
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
        The conclusion most summaries get wrong: <strong>SSTB status removes the QBI
        bonus, not the payroll-tax arbitrage</strong>. The election thins from{' '}
        {usd(FLIP.delta, 0)} to {usd(FLIP_SSTB.delta, 0)}/yr — a{' '}
        {usd(FLIP.delta - FLIP_SSTB.delta, 0)} cost, exactly the lost{' '}
        {usd(FLIP.scorp.qbiDeduction, 0)} deduction at its marginal bracket — but it
        stays clearly positive, because the distribution-slice mechanics do not care
        what field you are in. SSTB status also never pushes you toward a C-Corp on
        tax grounds: §199A never applied to C-Corp dividends in the first place, so
        the double-tax comparison is unchanged by it. The{' '}
        <a href="/qbi-deduction-calculator/">QBI instrument</a> isolates that layer
        — threshold, wage limit, and SSTB phase-out — on your own numbers.
      </p>

      {/* ================================================================== */}
      <h2 id="decision-path">The decision path, in order</h2>
      <p>
        The quadrants collapse into a sequence. Answer each question with a number,
        not a vibe — every instrument below runs the same engines this guide cited:
      </p>
      <ol>
        <li>
          <strong>Will outside capital buy in?</strong> If venture or institutional
          equity is on the table, form a C-Corp: S status bars entity and nonresident
          shareholders (IRC §1361), preferred stock needs it, and the §1202
          qualified-small-business-stock exclusion only attaches to C-Corp shares —
          conservative reading, since its benefit depends on holding periods and
          gain limits beyond this guide&apos;s scope. The{' '}
          <a href="/guides/reading-your-cap-table/">cap-table guide</a> picks the
          story up from there.
        </li>
        <li>
          <strong>If not, what does the business actually clear?</strong> Not gross —
          profit after expenses. The{' '}
          <a href="/guides/pricing-freelance-work/">pricing guide</a> is the honest
          way to raise that number; the entity decision waits for it to be real.
        </li>
        <li>
          <strong>Below the operational floor ({usd(40_000, 0)}–{usd(50_000, 0)} of
          consistent profit)?</strong> Default taxation. The arithmetic floor near{' '}
          {usd(FLOOR40, 0)} is real but thin — thinner than the overhead the engine
          cannot see.
        </li>
        <li>
          <strong>Above it?</strong> Run the three conditions: profit floor,{' '}
          <code>breakevenPayrollCostFull</code> overhead ceiling against your actual
          cost stack, and the salary band anchored on a market-defensible wage — the{' '}
          <a href="/guides/paying-yourself-from-your-business/">paying-yourself
          guide</a> covers what the number has to document.
        </li>
        <li>
          <strong>In a specified-service field with income above{' '}
          {usd(QBI_CONSTANTS.threshold.single, 0)}?</strong> Expect a thinner but
          still positive S-election edge, and ignore anyone whose answer is
          &quot;C-Corp for the tax&quot; — §199A never applied to its dividends.
        </li>
        <li>
          <strong>Retaining most profit inside the company?</strong> Only then does
          the C-Corp&apos;s flat {pct(LC.corporateRate * 100, 0)} compete — above{' '}
          {usd(CROSSOVER_RETAIN, 0)} of profit at zero payout, or under the payout
          threshold at higher profits. Model the eventual distribution honestly; the
          deferral has a maturity date.
        </li>
      </ol>

      {/* ================================================================== */}
      <h2 id="limits">What this framework cannot decide</h2>
      <ul>
        <li>
          <strong>Liability.</strong> The shield is state law, maintained by
          formalities and insurance — no federal election strengthens it.
        </li>
        <li>
          <strong>State taxes.</strong> Franchise minimums (California&apos;s $800),
          excise taxes, and state unemployment regimes sit outside every figure
          here; in franchise-tax states they belong in the overhead ceiling check.
        </li>
        <li>
          <strong>Your salary&apos;s defensibility.</strong> The engine evaluates the
          salary you give it; reasonable compensation is market evidence, and the
          savings at an indefensible salary are an assessment waiting to happen.
        </li>
        <li>
          <strong>Parameter drift.</strong> Every number assumes tax year 2025; 2026
          shifts the inputs ({usd(SC.ty2026.stdDeduction, 0)} standard deduction,{' '}
          {usd(SC.ty2026.ssWageBase, 0)} wage base). The structure of the decision
          survives; the deltas do not.
        </li>
        <li>
          <strong>Everything a CPA sees.</strong> This is an educational model of
          federal structure differences — multi-state operations, benefit plans,
          exit timing, and co-ownership all change the answer. Take real numbers to
          a professional before filing anything.
        </li>
      </ul>
    </>
  );
}

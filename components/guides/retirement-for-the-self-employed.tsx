import { ArticleToc } from '@/components/Article';
import {
  compareRetirement,
  sepCapacity,
  solo401kCapacity,
  incomeToMaxSolo,
  incomeToMaxSep,
  deferralLimitFor,
  catchUpForAge,
  RETIREMENT_CONSTANTS as RC,
} from '@/lib/retirement';
import { compareRoth, rothPhaseOutFraction, ROTH_CONSTANTS } from '@/lib/roth';
import { compareHsa, hsaLimitFor, nonQualifiedWithdrawal, HSA_CONSTANTS } from '@/lib/hsa';
import { usd, pct } from '@/lib/format';

/**
 * Guide body: "Retirement for the Self-Employed" — the three-layer benefits
 * stack (retirement ceiling → tax-structure flavor → HSA) and the order to
 * fund it.
 *
 * Every dollar figure in the prose and tables below is computed at build time
 * by the same engines that power the instruments this guide hands off to
 * (lib/retirement, lib/roth, lib/hsa) — nothing is hand-typed. The worked
 * owner is constant throughout: $120,000 of Schedule C net profit, sole
 * proprietor / single-member LLC (no S election), age 45, single filer, 24%
 * marginal income-tax bracket, tax year 2025.
 *
 * Rendered through GuideShell (which supplies h1, the prose column, and the
 * closing instruments panel), so this body starts at h2.
 */

/* ---- Layer 1: the capacity sweep (lib/retirement) -------------------------- */
const SWEEP_INCOMES = [40_000, 60_000, 80_000, 120_000, 160_000, 200_000, 250_000, 300_000, 400_000];
const SWEEP = SWEEP_INCOMES.map((income) =>
  compareRetirement(
    { mode: 'sole-prop', income, age: 45, plannedDeferral: RC.employeeDeferralLimit },
    24,
  ),
);

// Capacity thresholds: where the Solo 401(k) freezes at the §415(c) ceiling,
// and where the SEP catches up (both plans then hold the same $70,000).
const SOLO_CEILING_INCOME = incomeToMaxSolo('sole-prop', 45)!;
const CONVERGENCE_INCOME = incomeToMaxSep('sole-prop')!;

// The Pub 560 worksheet step-12 clawback, visible at the $40k sweep row.
const AT_40K = SWEEP[0];
const SEP_40K = sepCapacity('sole-prop', 40_000);
const CLAWBACK_40K = SEP_40K.contribution - AT_40K.solo.employerContribution;

// Exact profit where that clawback ends — where 20% of the plan base equals
// ½ of net earnings after the deferral (base = 5/3 of the deferral) — found
// by bisection on the engine itself rather than read off the sweep grid.
function clawbackEndProfit(): number {
  const binding = (p: number) => {
    const s = solo401kCapacity({
      mode: 'sole-prop',
      income: p,
      age: 45,
      plannedDeferral: RC.employeeDeferralLimit,
    });
    return 0.2 * s.compensationBase - (s.compensationBase - s.deferralCore) * 0.5;
  };
  let lo = 35_000;
  let hi = 50_000;
  for (let i = 0; i < 80; i++) {
    const mid = (lo + hi) / 2;
    if (binding(mid) > 0) lo = mid;
    else hi = mid;
  }
  return hi;
}
const CLAWBACK_END_PROFIT = clawbackEndProfit();

// Catch-up ladder at $400k of profit (above both thresholds).
const CATCH_ROWS = [45, 52, 62].map((age) => ({
  age,
  catchUp: catchUpForAge(age),
  solo: solo401kCapacity({
    mode: 'sole-prop',
    income: 400_000,
    age,
    plannedDeferral: deferralLimitFor(age),
  }),
  sep: sepCapacity('sole-prop', 400_000),
}));

/* ---- Layer 2: the flavor dial (lib/roth) ---------------------------------- */
const ROTH_BASE = {
  currentRatePct: 24,
  annualContribution: RC.employeeDeferralLimit,
  years: 25,
  annualReturnPct: 6,
};
const ROTH_EVEN = compareRoth({ ...ROTH_BASE, retirementRatePct: 24 });
const ROTH_ROWS = [12, 18, 22, 24, 28, 32].map((rr) => ({
  rr,
  c: compareRoth({ ...ROTH_BASE, retirementRatePct: rr }),
}));
// Mid-band MAGI example: $158,000 of MAGI inside the 2025 single phase-out.
const PHASE_MID = rothPhaseOutFraction(158_000, 'single');
const PHASE_MID_ALLOWED = ROTH_CONSTANTS.iraLimit * PHASE_MID;
// The equal-nominal-contribution view (limits are nominal — framing caveat in
// the prose; the engine itself flags that this edge comes from the framing).
const ROTH_22 = compareRoth({ ...ROTH_BASE, retirementRatePct: 22 });

/* ---- Layer 3: the HSA three usages (lib/hsa) ------------------------------- */
const HSA_BASE = {
  coverage: 'self' as const,
  age55: false,
  contribution: HSA_CONSTANTS.selfLimit,
  marginalRatePct: 24,
  returnRatePct: 7,
  years: 30,
};
const HSA_SPEND = compareHsa({ ...HSA_BASE, medicalSpendShare: 1, forfeitShare: 0 });
const HSA_SAVE = compareHsa({ ...HSA_BASE, medicalSpendShare: 0, forfeitShare: 0 });
const HSA_MIXED = compareHsa({ ...HSA_BASE, medicalSpendShare: 0.4, forfeitShare: 0.15 });
const NQ_10K = nonQualifiedWithdrawal(10_000, 24);

/* ---- The worked stack at $120k of profit ----------------------------------- */
const STACK = compareRetirement(
  { mode: 'sole-prop', income: 120_000, age: 45, plannedDeferral: RC.employeeDeferralLimit },
  24,
);
const STACK_TOTAL = STACK.solo.total + HSA_CONSTANTS.selfLimit;
const STACK_TAX_DEFERRED = STACK_TOTAL * 0.24;

const toc = [
  { id: 'the-answer', label: 'The answer, before the arithmetic' },
  { id: 'layer-one', label: 'Layer 1: the retirement ceiling' },
  { id: 'flavor', label: 'Layer 2: the flavor decision' },
  { id: 'hsa-layer', label: 'Layer 3: the HSA' },
  { id: 'order', label: 'The funding order and cash flow' },
  { id: 'guardrails', label: 'What the engines do not model' },
];

export default function RetirementForTheSelfEmployedGuide() {
  return (
    <>
      <ArticleToc items={toc} />

      <h2 id="the-answer">The answer, before the arithmetic</h2>
      <p>
        No employer withholds for you, matches you, or enrolls you in anything. What replaces all
        of that is a three-layer stack you build and fund yourself, and the funding order — not
        the vehicle names — is the decision. <strong>Fund the HSA first if an HDHP makes it
        available, then the Solo 401(k) employee deferral with its flavor chosen at this
        year&apos;s bracket, then the employer profit share; whatever remains goes to a taxable
        account.</strong> The retirement layer caps how much you can shelter at all ({usd(RC.totalAdditionsLimit, 0)}{' '}
        of plan dollars in 2025); the tax-structure layer decides whether those dollars are taxed
        on the way in or the way out; the medical layer is the smallest bucket in the stack and
        — spent on qualified care — the only one the tax code taxes zero times: not on the way
        in, not inside, not on the way out.
      </p>
      <p>
        The whole guide runs on one worked owner — {usd(120_000, 0)} of Schedule C net profit,
        sole proprietor, age 45, single filer, 24% marginal bracket, tax year 2025 — with every
        number computed by the same engines that power the{' '}
        <a href="/solo-401k-calculator/">Solo 401(k) Calculator</a>, the{' '}
        <a href="/roth-vs-traditional-calculator/">Roth vs Traditional Calculator</a>, and the{' '}
        <a href="/hsa-calculator/">HSA Advantage Calculator</a>. Your numbers differ; the shape of
        the decisions does not.
      </p>

      <div className="my-8 rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 dark:border-white/[0.08] dark:bg-slate-900/60">
        <h3 className="!mt-0">The stack, in funding order</h3>
        <ol className="!mb-0">
          <li>
            <strong>HSA — the annual expiring room.</strong> Deductible going in, never taxed
            inside, never taxed out for qualified care ({usd(HSA_CONSTANTS.selfLimit, 0)} self-only /{' '}
            {usd(hsaLimitFor('family', false), 0)} family in 2025, plus {usd(HSA_CONSTANTS.catchUp55, 0)}{' '}
            at 55). The only account in the code with all three breaks.
          </li>
          <li>
            <strong>Solo 401(k) employee deferral — up to {usd(RC.employeeDeferralLimit, 0)}.</strong>{' '}
            Your own compensation, Roth or pre-tax, decided year by year at the bracket you are
            actually in.
          </li>
          <li>
            <strong>Employer profit share — {pct(RC.employerRateSelfEmployed * 100, 0)} of (net
            profit − ½ SE tax).</strong> The flexible layer: sized and funded as late as the
            extended filing deadline.
          </li>
          <li>
            <strong>Taxable account — the residual.</strong> What is left after statutory room is
            filled is invested with no shelter at all, which is exactly why it goes last.
          </li>
        </ol>
      </div>
      <p>
        One vehicle is deliberately absent from that list: the SEP-IRA is not a layer of the
        stack, it is the third bullet standing alone — the Solo 401(k)&apos;s employer bucket
        without the deferral bucket on top. When that trade is worth making is the first question
        below.
      </p>

      <h2 id="layer-one">Layer 1: the retirement ceiling</h2>
      <p>
        Two owner-only plans matter, and they share more machinery than their marketing suggests.
        A Solo 401(k) fills from <strong>two buckets</strong>: an employee elective deferral of up
        to {usd(RC.employeeDeferralLimit, 0)} in 2025 (IRC §402(g); IRS Notice 2024-80), plus an
        employer contribution. A SEP-IRA has exactly <strong>one bucket</strong>: the employer
        contribution, and nothing else at any age. The statutory employer rate is{' '}
        {pct(RC.employerRate * 100, 0)} of plan compensation — which, because the self-employed
        contribution shrinks its own base, solves to{' '}
        {pct(RC.employerRateSelfEmployed * 100, 0)} of (net profit − ½ SE tax), the deduction-rate
        equivalent in IRS Publication 560&apos;s rate table for the self-employed. Both plans
        land under the same §415(c) annual-additions ceiling of {usd(RC.totalAdditionsLimit, 0)},
        and catch-up deferrals sit <em>outside</em> that ceiling.
      </p>
      <p>
        Sweep both engines across profit levels, deferring the full age-based limit (owner under
        50, so no catch-up yet):
      </p>
      <table>
        <thead>
          <tr>
            <th>Net profit (2025)</th>
            <th>Solo 401(k) total</th>
            <th>SEP-IRA</th>
            <th>Solo advantage</th>
          </tr>
        </thead>
        <tbody>
          {SWEEP.map((row) => (
            <tr key={row.inputs.income}>
              <td>{usd(row.inputs.income, 0)}</td>
              <td>{usd(row.solo.total, 0)}</td>
              <td>{usd(row.sep.contribution, 0)}</td>
              <td>{usd(row.extraCapacity, 0)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p>
        Read the middle rows first: from roughly {usd(60_000, 0)} to {usd(200_000, 0)} of profit
        the Solo advantage is <strong>exactly {usd(RC.employeeDeferralLimit, 0)}</strong> at every
        income — the deferral bucket, no more and no less, because the two employer engines are
        the same engine (same rate, same base, same cap). In this band a Solo 401(k) is simply a
        SEP with a second bucket bolted on.
      </p>
      <p>
        The top of the table bends twice. At {usd(SOLO_CEILING_INCOME, 0)} of profit the Solo
        401(k) reaches its ceiling — the employer share fills the §415(c) headroom of{' '}
        {usd(RC.totalAdditionsLimit - RC.employeeDeferralLimit, 0)} ({usd(RC.totalAdditionsLimit, 0)}{' '}
        minus the deferral) and total capacity freezes at {usd(RC.totalAdditionsLimit, 0)}, while
        the SEP keeps climbing toward its own identical cap. The SEP finally catches up at{' '}
        <strong>{usd(CONVERGENCE_INCOME, 0)} of profit</strong> — the convergence point the
        engine&apos;s bisection finds. Above it, both plans hold{' '}
        {usd(RC.totalAdditionsLimit, 0)} and capacity stops being a reason to choose between
        them. If your profit lives permanently above {usd(CONVERGENCE_INCOME, 0)}, the plan
        decision is about administration and catch-ups, not room.
      </p>
      <p>
        The bottom of the table bends too, in the other direction. Publication 560&apos;s
        deduction worksheet caps the self-employed employer share at ½ of net earnings{' '}
        <em>after</em> elective deferrals — a clawback that binds at low profits. At{' '}
        {usd(40_000, 0)} of profit the plan base is {usd(AT_40K.solo.compensationBase, 0)}, so{' '}
        {pct(RC.employerRateSelfEmployed * 100, 0)} of it would allow{' '}
        {usd(SEP_40K.contribution, 0)} — but after the {usd(RC.employeeDeferralLimit, 0)}{' '}
        deferral, the worksheet&apos;s cap leaves only{' '}
        {usd(AT_40K.solo.employerContribution, 0)} of employer room, a{' '}
        {usd(CLAWBACK_40K, 0)} haircut that fades to zero by {usd(CLAWBACK_END_PROFIT, 0)} of
        profit — the exact breakpoint the engine bisects to, where the plan base reaches 5/3 of
        the deferral.
        The SEP has no such clawback (½ of its base always exceeds 20% of it), but at that income
        the comparison is {usd(AT_40K.solo.total, 0)} against {usd(SEP_40K.contribution, 0)} —
        the deferral bucket dwarfs the detail.
      </p>
      <p>
        Age re-opens the gap that high income closes. Catch-up deferrals sit outside the §415(c)
        ceiling, and a SEP has no catch-up of any kind. At {usd(400_000, 0)} of profit, above
        every threshold above:
      </p>
      <table>
        <thead>
          <tr>
            <th>Owner age</th>
            <th>Catch-up</th>
            <th>Solo 401(k) total</th>
            <th>SEP-IRA</th>
            <th>Solo advantage</th>
          </tr>
        </thead>
        <tbody>
          {CATCH_ROWS.map((row) => (
            <tr key={row.age}>
              <td>{row.age}</td>
              <td>{usd(row.catchUp, 0)}</td>
              <td>{usd(row.solo.total, 0)}</td>
              <td>{usd(row.sep.contribution, 0)}</td>
              <td>{usd(row.solo.total - row.sep.contribution, 0)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p>
        At 50 the standard catch-up adds {usd(RC.catchUpLimit, 0)} of deferral room
        ({usd(deferralLimitFor(52), 0)} total deferrable); at 60–63 the SECURE 2.0 §109 enhanced
        catch-up replaces it with {usd(RC.enhancedCatchUpLimit, 0)} ({usd(deferralLimitFor(62), 0)}{' '}
        total). Past the convergence income, the catch-up is the <em>entire</em> difference
        between the two plans — and it grows with age while the SEP stays flat at{' '}
        {usd(RC.sepLimit, 0)} forever.
      </p>
      <blockquote>
        <p>
          Decision rule: open the Solo 401(k) unless something specific stops you. It weakly
          dominates the SEP at every income — same employer engine, plus a deferral bucket, plus
          Roth deferrals, plus catch-ups. The SEP earns its keep on simplicity alone: a one-page
          Form 5305-SEP and no plan document to maintain. Its retroactivity edge is narrower
          than it used to be, too — since SECURE 2.0 §317, a sole proprietor with no employees
          can adopt a <em>new</em> solo 401(k) as late as the un-extended filing deadline
          (April 15 for a calendar year) and still make first-year elective deferrals and
          employer contributions for the prior year; only employer dollars ride past that, to
          the extended deadline (IRC §404(a)(6)), and that half of the window is identical in
          both plans. Neither plan stays &quot;solo&quot; once you hire W-2 staff — coverage
          and nondiscrimination rules arrive with the first employee and change everything.
        </p>
      </blockquote>

      <h2 id="flavor">Layer 2: the flavor decision</h2>
      <p>
        Employer dollars are pre-tax by statute; the flavor choice belongs to the{' '}
        {usd(RC.employeeDeferralLimit, 0)} deferral bucket, which a Solo 401(k) can take as Roth
        or pre-tax in any split. The{' '}
        <a href="/roth-vs-traditional-calculator/">Roth vs Traditional Calculator</a> engine
        reduces the choice to one dial: the rate you avoid today versus the rate you pay at
        withdrawal. Hold the worked deferral constant — {usd(RC.employeeDeferralLimit, 0)} a year
        for 25 years at a 6% return, saved in a 24% bracket — and vary only the retirement rate:
      </p>
      <table>
        <thead>
          <tr>
            <th>Retirement rate</th>
            <th>Traditional spendable</th>
            <th>Roth spendable</th>
            <th>Winner</th>
          </tr>
        </thead>
        <tbody>
          {ROTH_ROWS.map(({ rr, c }) => (
            <tr key={rr}>
              <td>{rr}%</td>
              <td>{usd(c.tradSpendable, 0)}</td>
              <td>{usd(c.rothSpendable, 0)}</td>
              <td>
                <strong>
                  {c.winner === 'roth' ? 'Roth' : c.winner === 'traditional' ? 'Traditional' : 'Tie'}
                  {c.winner !== 'tie' && `, ${usd(Math.abs(c.advantageRoth), 0)}`}
                </strong>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p>
        The lines cross at exactly 24% — today&apos;s rate, as the algebra demands — and the
        stakes per point are {usd(ROTH_EVEN.perPointSwing, 0)} of spendable money{' '}
        <em>per percentage point</em> of rate gap. The 12% row is a 12-point error in one
        direction and costs {usd(Math.abs(ROTH_ROWS[0].c.advantageRoth), 0)}; the same size error
        the other way pays the identical amount. Two consequences follow. First, precision about
        your <em>retirement</em> rate matters as much as knowing today&apos;s bracket — and real
        withdrawals fill brackets bottom-up from the standard deduction, so the effective rate on
        a Traditional balance usually sits below the retiree&apos;s top bracket, a point in favor
        of pre-tax that a flat-rate table understates. Second, a self-employed income that swings
        means the dial has a different setting each year: defer Roth in lean years when your
        marginal rate is cheap, pre-tax in fat years when the deduction is expensive, and split a
        year that straddles brackets.
      </p>
      <p>
        Income phase-outs are the second half of this layer, and the two Roth doors behave
        differently. Direct Roth <em>IRA</em> contributions phase out for single filers between{' '}
        {usd(ROTH_CONSTANTS.rothMagiPhaseOut.single.start, 0)} and{' '}
        {usd(ROTH_CONSTANTS.rothMagiPhaseOut.single.end, 0)} of MAGI in 2025 (IRS News Release
        IR-2024-285) — a band one good consulting year crosses without noticing. At{' '}
        {usd(158_000, 0)} of MAGI, only {usd(PHASE_MID_ALLOWED, 0)} of the{' '}
        {usd(ROTH_CONSTANTS.iraLimit, 0)} limit survives; at{' '}
        {usd(ROTH_CONSTANTS.rothMagiPhaseOut.single.end, 0)}, none of it. The Roth side of a Solo
        401(k) has <strong>no income phase-out at any MAGI</strong>, and the{' '}
        {usd(RC.employeeDeferralLimit, 0)} deferral limit is one shared bucket across both
        flavors — so the practical route in a high-income year is to split the deferral:
        pre-tax dollars for the deduction, Roth deferral for the lean-year dollars, no IRA band
        in the way. (One more engine output worth knowing: when both accounts receive
        the same <em>nominal</em> dollars, the Roth column ends {usd(ROTH_22.advantageRothLimitView, 0)}{' '}
        ahead at a 22% retirement rate over 25 years. That edge is real only because limits are
        nominal — a Roth slot at the limit shelters more spendable value — not because Roth
        dollars grow faster. The engine states the caveat; carry it with the number.)
      </p>

      <h2 id="hsa-layer">Layer 3: the HSA</h2>
      <p>
        The Health Savings Account is the only account in the tax code with three separate
        breaks: contributions inside the limit are deductible above the line even when you make
        them personally (IRC §223(a)); growth inside the account is never taxed (§223(e)); and
        withdrawals for qualified medical expenses are never taxed (§223(f)). The gate is
        coverage: you must be on an HSA-eligible high-deductible health plan. The 2025 room is{' '}
        {usd(HSA_CONSTANTS.selfLimit, 0)} self-only, {usd(hsaLimitFor('family', false), 0)} family,
        plus {usd(HSA_CONSTANTS.catchUp55, 0)} from age 55 (IRC §223(b)(3); limits per IRS Rev.
        Proc. 2024-25).
      </p>
      <p>
        How you <em>use</em> the account is itself a decision, and the{' '}
        <a href="/hsa-calculator/">HSA Advantage Calculator</a> engine prices all three usages
        against a taxable account fed the same pre-tax dollars ({usd(HSA_CONSTANTS.selfLimit, 0)}{' '}
        a year, 24% bracket, 7% return, 30 years):
      </p>
      <table>
        <thead>
          <tr>
            <th>Usage</th>
            <th>What you do</th>
            <th>Value at 30 years</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Spend as you go</td>
            <td>Each year&apos;s contribution pays that year&apos;s medical bills</td>
            <td>
              {usd(HSA_SPEND.spendNow.taxShield, 0)} of income tax never paid on 30 years of
              medical dollars ({usd(HSA_SPEND.spendNow.taxShieldCompounded, 0)} if the saved tax
              were itself invested)
            </td>
          </tr>
          <tr>
            <td>Mixed</td>
            <td>
              Spend 40% of each year&apos;s contribution on care, let the rest compound; 15% of
              the ending balance eventually cashed out non-qualified
            </td>
            <td>
              {usd(HSA_MIXED.mixed.value, 0)} spendable vs {usd(HSA_MIXED.mixed.taxableTwinBalance, 0)}{' '}
              for the taxable twin — {usd(HSA_MIXED.mixed.advantage, 0)} ahead
            </td>
          </tr>
          <tr>
            <td>Save to retire</td>
            <td>Pay care from outside cash; the whole contribution compounds</td>
            <td>
              {usd(HSA_SAVE.saveForLater.balance, 0)} balance — {usd(HSA_SAVE.saveForLater.advantageDrag, 0)}{' '}
              ahead of an annually-taxed twin, {usd(HSA_SAVE.saveForLater.advantageNoDrag, 0)}{' '}
              ahead even if the twin&apos;s growth were never taxed
            </td>
          </tr>
        </tbody>
      </table>
      <p>
        That last number is the one to sit with: even granting the taxable account a zero-tax
        growth assumption the HSA can&apos;t match, the HSA still ends{' '}
        {usd(HSA_SAVE.saveForLater.advantageNoDrag, 0)} ahead — exactly the 24% income tax the
        twin paid on the way in and the HSA never will. This is why the funding order puts the
        smallest bucket first: its advantage is structural, not a bet on returns.
      </p>
      <p>
        The &quot;save to retire&quot; row is the stealth retirement account play. An HSA funded
        and never spent behaves like a traditional IRA with a better exit ladder: after 65,
        non-medical withdrawals owe income tax but no penalty, worth{' '}
        {usd(HSA_SAVE.saveForLater.post65AnyUse, 0)} spendable from the same{' '}
        {usd(HSA_SAVE.saveForLater.balance, 0)} balance; qualified medical withdrawals stay free
        forever. Before 65 the exit is ugly — {usd(NQ_10K.gross, 0)} pulled for a non-medical
        reason nets {usd(NQ_10K.net, 0)}: income tax plus the 20% additional tax of §223(f)(4),
        44 cents on the dollar at this bracket. And because qualified receipts never expire, the
        disciplined version is to pay current medical bills from outside cash and keep the
        receipts — each one is a withdrawal right you can exercise decades later, tax-free.
      </p>

      <h2 id="order">The funding order and cash flow</h2>
      <p>
        The order in the opening card is not about which layer is biggest — the HSA is the
        smallest. It is about which dollars are least replaceable. HSA room for a given year can
        be filled as late as April 15 — never on extension — and vanishes for good after that; a
        prior-year elective deferral is likewise possible only until the un-extended deadline,
        and only when adopting a new plan (SECURE 2.0 §317) — which is a reason to calendar the
        election rather than rely on the back-fill; the employer share can wait all the way to
        the extended deadline; and Roth-ness can be purchased later through conversion. Rank the
        layers by how badly a missed deadline hurts, fund top-down, and the order writes itself:
        HSA, deferral, employer share, taxable.
      </p>
      <p>
        Now the cash-flow truth the stack sits on, at the worked owner. The full stack shelters{' '}
        {usd(STACK_TOTAL, 0)} — {usd(STACK.solo.total, 0)} of plan dollars plus{' '}
        {usd(HSA_CONSTANTS.selfLimit, 0)} of HSA — deferring {usd(STACK_TAX_DEFERRED, 0)} of
        income tax at 24%. But <strong>no contribution in any layer reduces self-employment
        tax</strong>: the {usd(STACK.solo.halfSeTax * 2, 0)} of SE tax on {usd(120_000, 0)} of
        profit is owed in full, and quarterly estimates have to be sized with that line in mind —
        the <a href="/guides/self-employed-tax-calendar/">Self-Employed Tax Calendar</a> guide
        maps those deadlines and safe harbors. One more interaction to price before booking the
        full 24% as savings: pre-tax contributions also shrink the qualified-business-income base
        that the §199A deduction is computed on, so at the margin part of every deferral
        dollar&apos;s benefit comes back as lost QBI — run the{' '}
        <a href="/qbi-deduction-calculator/">QBI Deduction Calculator</a> alongside the plan math
        before you spend the refund. Timing is the other honest constraint: the
        deferral is cash out the door during the year, while the employer share can be computed
        and funded by the filing deadline with extension — the natural home of the February
        decision, once you finally know what the year was. If you run an S corporation instead,
        the employer share keys to W-2 wages rather than profit, which makes the salary decision
        and the plan decision one decision — the{' '}
        <a href="/guides/paying-yourself-from-your-business/">Paying Yourself From Your
        Business</a> guide works that interaction end to end.
      </p>
      <p>
        Compressed to the situations the engines most often get asked about:
      </p>
      <table>
        <thead>
          <tr>
            <th>Your situation</th>
            <th>The move the math supports</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Lean year — marginal rate in the teens</td>
            <td>
              Roth deferral first. The deduction is worth only what this year&apos;s rate pays,
              and the break-even identity says the pre-tax route wins only if your retirement
              rate lands below this year&apos;s rate — whatever the lean year&apos;s rate
              actually is.
            </td>
          </tr>
          <tr>
            <td>Fat year — profit above {usd(CONVERGENCE_INCOME, 0)}</td>
            <td>
              Capacity ties at {usd(RC.totalAdditionsLimit, 0)} under 50, so flavor and timing
              decide: pre-tax deferral for the deduction, employer share by the extended filing
              deadline, catch-ups widening the Solo&apos;s edge from age 50.
            </td>
          </tr>
          <tr>
            <td>No HSA-eligible health plan</td>
            <td>
              Skip layer 3 without regret — the triple advantage is conditional on HDHP
              coverage, and a health-plan choice is a health decision, not a tax leak.
            </td>
          </tr>
          <tr>
            <td>Standing in February, wishing you had funded last year</td>
            <td>
              More time than you may think, but one hard wall: until April 15 a sole proprietor
              can still adopt a new solo 401(k) and defer for last year (SECURE 2.0 §317). Past
              that date only employer dollars remain open — to the extended deadline, in either
              plan — and the SEP&apos;s remaining edge is its one-page setup.
            </td>
          </tr>
          <tr>
            <td>First W-2 employee hired</td>
            <td>
              Both plans stop being &quot;solo&quot; — coverage and nondiscrimination rules
              arrive with the hire. Re-shop the plan with an administrator before the next
              plan year starts.
            </td>
          </tr>
        </tbody>
      </table>

      <h2 id="guardrails">What the engines do not model</h2>
      <p>
        Every figure above comes from the suite&apos;s 2025 federal engines, and each carries
        stated limits. Single owner, no employees — hiring W-2 staff voids the solo premise of
        both plans. No state income tax, and two states (CA and NJ) do not conform to HSA
        exclusion and tax HSA earnings. The §401(a)(17) compensation cap ({usd(RC.compensationCap, 0)}{' '}
        in 2025) is not modeled — at the self-employed 20% rate it exactly coincides with the{' '}
        {usd(RC.totalAdditionsLimit, 0)} plan cap, so it changes no answer at or below the
        ceiling. There is no defined-benefit (cash balance) layer, which is how very high earners
        legitimately go past {usd(RC.totalAdditionsLimit, 0)}; no Required Minimum Distribution
        modeling (Traditional accounts force distributions from age 73/75; Roth IRAs never); and
        the Roth engine applies one flat retirement rate to the whole balance rather than filling
        brackets bottom-up. Contribution limits index most years — the 2026 HSA limits are
        already announced at {usd(4_400, 0)} / {usd(8_750, 0)} (Rev. Proc. 2025-19) — so re-run
        the instruments at your own numbers before acting. This is a decision framework with
        illustrative arithmetic, not tax advice.
      </p>
    </>
  );
}

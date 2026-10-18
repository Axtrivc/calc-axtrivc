import { ArticleToc } from '@/components/Article';
import { computeLlc, TAX_CONSTANTS as LC } from '@/lib/llccorp';
import {
  breakevenPayrollCostFull,
  compareScorpFull,
  computeLlcFull,
  SCORP_FULL_CONSTANTS as SC,
} from '@/lib/scorpfull';
import { FED_BRACKETS_2025 } from '@/lib/tax';
import { usd, pct } from '@/lib/format';

/* State-tax guide — deliberately qualitative on the state side, anchored on
   the federal engines wherever a number appears. Every federal figure below
   is computed at build time by the same engines the instruments run:
   lib/llccorp for the pass-through federal baseline, lib/scorpfull for the
   S-election edge and its overhead ceiling. No state rate table appears in
   this guide by design — shapes and mechanisms are stable, rates are not;
   the state revenue department is the source of truth for current numbers. */

/* ---- Federal baseline ladder (lib/llccorp, 2025 single filer) ------------- */

const FED_LADDER = [80_000, 150_000, 300_000].map((p) => ({ profit: p, fed: computeLlc(p) }));

/** Hypothetical flat state layer — five cents on the dollar of the same
 *  profit. NOT any particular state's schedule; a deliberately neutral
 *  illustration that the state layer is additive on the federal stack. */
const STATE_RATE = 0.05;

/** Marginal federal bracket at a taxable income — walks the same 2025
 *  single-filer table the engines tax against (lib/tax.ts). */
function marginalRate(ti: number): number {
  let prev = 0;
  for (const b of FED_BRACKETS_2025) {
    if (ti > prev && ti <= b.upTo) return b.rate;
    if (ti > b.upTo) prev = b.upTo;
  }
  return FED_BRACKETS_2025[FED_BRACKETS_2025.length - 1].rate;
}

const SE_TAX_150K = computeLlc(150_000).seTax; // state-independent, Schedule SE

/* ---- SALT cap worked example (lib/scorpfull full-fidelity column) --------- */

const HIGH = computeLlcFull(700_000); // high-income filer for the phase-down zone
const HIGH_MARGINAL = marginalRate(HIGH.taxableIncome); // 0.37
/** The cap's statutory yardstick is MAGI; for this model's filer that is
 *  profit less the above-the-line half-SE adjustment, computed from the
 *  engine's own field rather than typed. */
const HIGH_MAGI = 700_000 - HIGH.halfSeTax;
const SALT_CAP_FLOOR = 10_000; // IRC §164(b)(6) floor the phase-down returns to
const SALT_PAID_EXAMPLE = 16_000; // state income tax + property tax, hypothetical
const SALT_DISALLOWED = SALT_PAID_EXAMPLE - SALT_CAP_FLOOR;
const SALT_FEDERAL_COST = SALT_DISALLOWED * HIGH_MARGINAL;

/* ---- S-election anchors (lib/scorpfull, canonical worked example) --------- */

const OH = SC.defaultPayrollCost; // $1,200/yr payroll + compliance overhead
const EX = compareScorpFull(200_000, 80_000, OH); // the same example the entity guide runs
const OVERHEAD_CEILING = breakevenPayrollCostFull(200_000, 80_000);

const CARDS = [
  {
    axis: 'You live and work in one state',
    verdict: 'Your state’s shape is most of the answer',
    body: 'No broad income tax, flat, or graduated — establish which shape your state runs, because it decides how far the federal numbers on this site understate your all-in rate.',
  },
  {
    axis: 'You itemize at high income',
    verdict: 'Price the deduction cap and the entity-tax detour',
    body: 'The state-and-local-tax deduction cap still binds once income phases it back down; a pass-through entity tax election, where your state offers one, routes around it.',
  },
  {
    axis: 'You cross state lines',
    verdict: 'Map nexus before you map growth',
    body: 'Where you physically work, where clients sit, and where any employee sits each determine whether a second state can claim a share — and whether you owe registration, not just tax.',
  },
  {
    axis: 'Your federal entity math is close',
    verdict: 'State layers are the tiebreaker',
    body: 'Franchise minimums, entity-level taxes, and the state treatment of salary versus distributions can flip a thin federal verdict. Re-run the entity decision with the state lines included.',
  },
  {
    axis: 'Any entity at all',
    verdict: 'Budget the chassis before you file',
    body: 'Annual reports, franchise taxes, and publication requirements cost money in profitable years and losing ones alike. A fee that survives a bad year is a fixed cost, not a tax on profit.',
  },
] as const;

export default function StateTaxesArticle() {
  const toc = [
    { id: 'framework', label: 'Five questions, one checklist' },
    { id: 'shapes', label: 'The four shapes of state income tax' },
    { id: 'salt', label: 'The SALT cap and the entity-tax detour' },
    { id: 'nexus', label: 'Nexus: where you owe, not just where you live' },
    { id: 'entity', label: 'State layers can flip a federal answer' },
    { id: 'fees', label: 'Annual fees no one budgets for' },
    { id: 'path', label: 'The verification path, in order' },
    { id: 'limits', label: 'What this guide cannot decide' },
  ];

  return (
    <>
      <ArticleToc items={toc} />

      <p>
        Every instrument on this site computes a <strong>federal baseline</strong>. The
        pass-through vs C-Corp crossover, the S-Corp salary engine, the estimated-tax
        calendar — all of them run 2025 federal brackets against one filer with no
        state lines drawn anywhere in the arithmetic. That is a disclosed modeling
        choice, and it is the honest one for a site that computes rather than
        approximates: state tax law is fifty different moving targets. But it means
        the federal verdicts you leave those tools with are necessary, not
        sufficient. The state layer sits on top, and in four decisions — where you
        claim residency, whether you itemize, where your work physically happens,
        and which entity chassis you pay for — the state layer does not merely add
        cost, it changes the answer. This guide covers the structure of that layer:
        the four shapes state income taxes take, the federal deduction cap that
        claws part of the layer back, the nexus rules that decide which states can
        reach you, and the fees and entity-level taxes that flip close calls. Every
        federal number is computed by the same engines the instruments run; every
        state-specific point is deliberately qualitative — name the shape, name the
        mechanism, and verify the current numbers with the state&apos;s own revenue
        department before acting on any of it.
      </p>

      {/* ================================================================== */}
      <h2 id="framework">Five questions, one checklist</h2>
      <p>
        State tax for a self-employed person resolves into five questions, asked in
        order. First, <strong>what shape is your state&apos;s income tax</strong> —
        the single biggest determinant of your all-in rate. Second, <strong>does the
        federal cap on state-tax deductions bind you</strong>, and if so, does your
        state offer the entity-level election that routes around it. Third,{' '}
        <strong>where do you have nexus</strong> beyond your home state — where the
        work is performed, where customers sit, where any helper sits. Fourth,{' '}
        <strong>does the state layer flip your federal entity verdict</strong> —
        franchise minimums and entity-level taxes are exactly the size of a thin
        S-election edge. Fifth, <strong>what does the chassis itself cost each
        year</strong>, whatever the profit. The cards below are the compressed
        verdicts; the sections that follow expose the mechanics behind each.
      </p>
      <div className="my-6 grid gap-4 sm:grid-cols-2">
        {CARDS.map((c) => (
          <div key={c.axis} className="panel p-5">
            <div className="chip bg-indigo-50 text-indigo-700 ring-1 ring-inset ring-indigo-200 dark:bg-indigo-500/15 dark:text-indigo-300 dark:ring-indigo-500/25">
              {c.axis}
            </div>
            <h3 className="!mt-3 !text-base !font-bold !leading-snug text-slate-900 dark:text-slate-100">
              {c.verdict}
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
              {c.body}
            </p>
          </div>
        ))}
      </div>
      <p>
        One scope note before the detail. This site&apos;s models are federal by
        construction — the engine headers say so explicitly — so treat every number
        the instruments hand you as a federal floor, with the state layer additive
        on top. And because state legislatures rewrite their rate schedules
        annually, this guide intentionally avoids reproducing any of them. Where a
        representative state is named, it is named for the <em>shape</em> of its
        system, and the current-year numbers live with the state tax department,
        not here.
      </p>

      {/* ================================================================== */}
      <h2 id="shapes">The four shapes of state income tax</h2>
      <p>
        State individual income taxes come in four structural shapes, and the shape
        matters more than any single rate because it decides how fast your tax
        grows as profit grows.
      </p>
      <ul>
        <li>
          <strong>No broad income tax at all.</strong> A handful of states — Texas,
          Florida, Nevada, Wyoming among them — levy no broad individual income tax
          on wages or self-employment profit. They still fund government: through
          sales taxes, gross-receipts-style business taxes, and franchise fees, which
          is why &quot;no income tax&quot; never means &quot;no state tax&quot; for
          a business owner. Verify the current roster with each state; it shifts at
          the margins.
        </li>
        <li>
          <strong>A flat rate.</strong> Some states — Pennsylvania and Illinois
          among them — charge one rate on most taxable income regardless of amount.
          For a growing business this is the predictable shape: your state layer is
          a constant share of your state base, and there is no bracket creep to
          model.
        </li>
        <li>
          <strong>Graduated brackets.</strong> Most states run several brackets,
          from gentle two-step schedules to steep stacks — California and New York
          sit at the steep end. A graduated shape behaves like the federal schedule
          does: your marginal state rate rises with profit, which changes the value
          of every deduction and every entity election below.
        </li>
        <li>
          <strong>Investment income only.</strong> The narrowest shape taxes
          dividends, interest, or capital gains while leaving wages and
          self-employment profit alone. Washington currently fits the pattern with
          a high-threshold capital-gains levy; New Hampshire, the long-standing
          example, finished phasing out its interest-and-dividends tax — a useful
          reminder that shapes themselves move, which is why this guide names
          structures and sends you to the state for numbers.
        </li>
      </ul>
      <p>
        Two complications sit on top of the shape. A few states tax{' '}
        <em>entities</em> rather than — or in addition to — owners: Tennessee and
        New Hampshire impose entity-level franchise or business-income taxes even
        when the federal return treats the business as a pass-through, and Texas
        taxes business margins above a revenue threshold. And the state line is
        often not the last line: New York City layers a resident income tax and an
        unincorporated-business tax on top of New York State&apos;s, and a number
        of states permit municipal earned-income taxes. Your state revenue
        department&apos;s current publications are the authority for all of it.
      </p>

      {/* ================================================================== */}
      <h2 id="salt">The SALT cap and the entity-tax detour</h2>
      <p>
        Here is a structural quirk worth more than most rate tables: for a sole
        proprietor or single-member LLC, the state income tax on your business
        profit is <strong>not</strong> a business deduction. It does not reduce
        Schedule C profit, it does not reduce self-employment tax — the engine
        computes {usd(SE_TAX_150K, 0)} of SE tax on {usd(150_000, 0)} of profit with
        no state line anywhere in the formula — and it does not reduce the{' '}
        §199A qualified-business-income base. Instead it lands on Schedule A as
        an itemized deduction, alongside state property tax, inside the bucket
        the Tax Cuts and Jobs Act capped. That cap — {usd(SALT_CAP_FLOOR, 0)} on the
        combined state-and-local total, IRC §164(b)(6) — ran from 2018 through
        2024, was raised for 2025 through 2029 by the One Big Beautiful Bill Act
        (P.L. 119-21, to roughly {usd(40_000, 0)}, with the cap and its income
        test each stepping up about 1% a year), phases back down — 30 cents per
        dollar of modified adjusted gross income above a threshold near{' '}
        {usd(500_000, 0)} — toward the original floor, and under current law
        reverts to that permanent {usd(SALT_CAP_FLOOR, 0)} limit in 2030, the
        phase-down mechanism expiring alongside the increase. Three practical
        consequences for the self-employed:
      </p>
      <ol>
        <li>
          <strong>Most itemizers below the phase-down zone are no longer
          squeezed.</strong> With the raised cap, a mid-income filer&apos;s state
          income and property taxes largely fit inside the allowance again, and the
          standard-versus-itemize decision is back to ordinary arithmetic.
        </li>
        <li>
          <strong>The squeeze concentrates at high income — exactly where the
          phase-down operates.</strong> A worked example on the full-fidelity
          engine: {usd(700_000, 0)} of profit leaves {usd(HIGH.taxableIncome, 0)}{' '}
          of federal taxable income after the wage-limited §199A chain, deep in the{' '}
          {pct(HIGH_MARGINAL * 100, 0)} bracket. The cap&apos;s yardstick is
          modified adjusted gross income rather than taxable income, and this
          filer&apos;s MAGI is about {usd(HIGH_MAGI, 0)} — {usd(700_000, 0)} of
          profit less the above-the-line half-SE adjustment — comfortably past
          the point at which the phase-down has pressed the allowance back to
          the {usd(SALT_CAP_FLOOR, 0)} floor. Paying {usd(SALT_PAID_EXAMPLE, 0)}{' '}
          of state income and property tax therefore leaves only the floor
          deductible — {usd(SALT_DISALLOWED, 0)} of deductions vanish, which is{' '}
          {usd(SALT_FEDERAL_COST, 0)} of federal tax on tax you already paid. The
          federal system is, in effect, charging you a toll for living in a
          high-tax state at precisely the income level where the state layer is
          largest.
        </li>
        <li>
          <strong>The detour exists, and it runs through the entity.</strong> Most
          states with an income tax now permit a pass-through entity tax election —
          the PTET you may have seen referenced — under which the LLC or S
          corporation itself pays the state income tax. The IRS confirmed in
          Notice 2020-75 that such an entity-level payment is a business
          deduction rather than an individual state-tax deduction, so it sits outside the individual
          cap entirely. In the worked example above, the same state tax paid at the
          entity level would not generate that {usd(SALT_FEDERAL_COST, 0)} federal
          cost. The trade-offs are real: election windows and irrevocability rules
          vary by state, owners take a credit against their own liability through
          state-specific mechanics, and the entity-level deduction reduces the QBI
          base the §199A deduction is computed on. This guide asserts only the
          existence and federal treatment of the mechanism; eligibility and
          mechanics belong with the state&apos;s guidance and a preparer who knows
          the year&apos;s rules.
        </li>
      </ol>
      <p>
        One adjacent detail compounds quietly in your favor: the{' '}
        <strong>business-use share of your home&apos;s property tax</strong> is a
        different animal from the personal remainder. Under the actual-expense
        method for the home office, the business percentage of real-estate taxes
        flows through the home-office computation as a business expense — not
        behind the individual cap — leaving only the personal share subject to it.
        That is one more reason the measurement effort behind the{' '}
        <a href="/home-office-deduction-calculator/">home-office instrument</a> and
        the <a href="/guides/deductions-home-office-and-vehicle/">deductions
        playbook</a> pays for itself; the same logic applies to no state in
        particular and every state in general.
      </p>

      {/* ================================================================== */}
      <h2 id="nexus">Nexus: where you owe, not just where you live</h2>
      <p>
        Your residence state taxes all of your income — that is the default of
        residency, and it follows you wherever the work originates. The interesting
        rules govern the <em>second</em> state, and the exposure arrives through
        three channels.
      </p>
      <p>
        <strong>Physical presence.</strong> Perform services inside a state and it
        can tax the income those services produce, whatever your home address.
        A two-week on-site engagement is technically sourcing income to the client&apos;s
        state; in practice small amounts go unassessed, but the liability rule is
        the rule, and a state that learns about you — through a client&apos;s
        filings, a registration, an audit of anyone upstream — can reach back.
        Moving yourself mid-year is the same channel at full scale: a permanent
        relocation splits the year between residences, and states with
        statutory-residency day counts will look closely at anyone keeping a foot
        in each.
      </p>
      <p>
        <strong>Economic presence.</strong> Since the Supreme Court&apos;s 2018{' '}
        <em>South Dakota v. Wayfair</em> decision upheld that state&apos;s
        sales-tax law — no tax owed until sales into the state pass{' '}
        {usd(100_000, 0)} or 200 transactions — most states have adopted similar
        bright-line thresholds for <em>sales</em> tax. That obligation arrives with
        no office and no travel: a website and enough in-state customers.
        Income-tax nexus is the more conservative cousin: most states still lean on
        facts like property, payroll, and presence rather than sales dollars alone,
        but the trend runs toward economic thresholds there too. A self-employed
        seller crossing a state&apos;s sales-tax line should assume registration,
        collection, and remittance duties now, and ask about income-tax exposure
        then.
      </p>
      <p>
        <strong>Other people&apos;s presence.</strong> This is the channel that
        surprises solo operators who grow. You, working from home, generate nexus
        only where you live and where you travel to work. Your first employee in
        another state generates it for you: their payroll, their unemployment
        account, their desk. Contractors generally do not — they are independent
        businesses with their own nexus — but the employee-versus-contractor
        classification question then decides your multistate footprint, which is
        one more reason to keep that classification honest from the start.
        Neighboring states sometimes hold reciprocity agreements that spare
        cross-border commuters from filing twice; whether one exists between your
        two states is a five-minute check with either revenue department.
      </p>

      {/* ================================================================== */}
      <h2 id="entity">State layers can flip a federal answer</h2>
      <p>
        Start from the honest baseline: the engines behind this site are
        federal-scope models, and they say so — the pass-through stack assumes one
        filer, 2025 federal brackets, the {usd(LC.stdDeduction, 0)} standard
        deduction, and no state lines. What does the state layer do to those
        numbers? Structurally, it adds. The{' '}
        <a href="/llc-vs-ccorp-tax-calculator/">LLC vs C-Corp instrument</a> runs
        this engine on your own profit and payout numbers; here is the federal
        stack at three representative profit levels:
      </p>
      <table>
        <thead>
          <tr>
            <th>Annual profit</th>
            <th>Federal stack (engine)</th>
            <th>+ hypothetical 5% state layer</th>
            <th>Combined effective rate</th>
          </tr>
        </thead>
        <tbody>
          {FED_LADDER.map(({ profit, fed }) => {
            const layer = profit * STATE_RATE;
            const combined = fed.totalTax + layer;
            return (
              <tr key={profit}>
                <td className="font-semibold text-slate-900 dark:text-slate-100">{usd(profit, 0)}</td>
                <td>
                  {usd(fed.totalTax, 0)}{' '}
                  <span className="text-slate-500 dark:text-slate-400">
                    ({pct(fed.effectiveRate)})
                  </span>
                </td>
                <td>{usd(layer, 0)}</td>
                <td>
                  {pct((combined / profit) * 100)}{' '}
                  <span className="text-slate-500 dark:text-slate-400">
                    (federal {pct(fed.effectiveRate)})
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="mb-4 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
        The state column is a deliberately hypothetical flat five cents on the
        dollar of the same profit — not any particular state&apos;s schedule. Real
        state bases differ from the federal one: some start from federal adjusted
        gross income, some tax a business&apos;s gross receipts instead of profit,
        and graduated shapes move the share as profit grows. The point the table
        makes is structural — at mid profits, a plausible state layer adds roughly
        five points to the all-in effective rate, which is larger than most
        federal planning levers move.
      </div>
      <p>
        Where the state layer changes <em>decisions</em> rather than just totals is
        the entity choice. The canonical worked example behind the{' '}
        <a href="/s-corp-tax-calculator/">S-Corp Salary instrument</a> —{' '}
        {usd(200_000, 0)} profit, {usd(80_000, 0)} salary, {usd(OH, 0)} of payroll
        and compliance overhead — shows a federal edge of{' '}
        <strong>{usd(EX.delta, 0)} a year</strong> for the S election, and the
        engine&apos;s own breakeven says the election survives up to{' '}
        <strong>{usd(OVERHEAD_CEILING ?? 0, 0)} a year</strong> of all-in overhead
        at those inputs. Now read what a single state can do to that budget.
        California charges an {usd(800, 0)} minimum franchise tax whether or not the
        year is profitable, plus an LLC fee scaled to gross receipts; Delaware
        levies an annual franchise tax that can run to five figures for
        corporations under the authorized-shares method; entity-level taxes like
        Tennessee&apos;s and New Hampshire&apos;s apply to pass-throughs the
        federal code ignores. None of those figures are in the federal engine,
        because they are not federal — they draw directly on the same{' '}
        {usd(OVERHEAD_CEILING ?? 0, 0)} budget that payroll service and return
        preparation draw on, and in a close call they decide it. The{' '}
        <a href="/guides/choosing-your-business-entity/">entity guide&apos;s</a>{' '}
        overhead-ceiling check is exactly where the state numbers belong.
      </p>
      <p>
        The state layer also moves the S-election mechanism itself, not just its
        overhead. The election&apos;s arithmetic is federal: salary pays payroll
        tax, distributions do not. But your state computes its own base — where it
        follows the federal salary-versus-distribution split, the election changes
        your state tax too; where a PTET election applies, the entity-level tax
        replaces the owner-level tax on pass-through income and the comparison
        restructures again; where the state taxes entities directly, the election
        can create state tax that did not exist before. There is no general rule
        across fifty states, which is the finding: <strong>never treat a federal
        S-election edge as final until the state line has been run with the same
        seriousness</strong>. The federal engines on this site give you the
        baseline; the state answer is a second computation, not a rounding error
        on the first.
      </p>

      {/* ================================================================== */}
      <h2 id="fees">Annual fees no one budgets for</h2>
      <p>
        The quietest state cost is the one that arrives regardless of profit: the
        annual price of the chassis itself. States recover entity-administration
        costs through recurring filings — annual reports, statements of
        information, franchise taxes, registered-agent expectations — and the
        amounts scale with everything except how well the business did that year.
        California&apos;s {usd(800, 0)} minimum applies to a loss year at full
        strength. New York famously requires newly formed LLCs to publish notice
        in county newspapers, a one-time cost that has surprised many a downstate
        founder. Delaware&apos;s franchise bill arrives every year for entities
        that never set foot there, because the choice of Delaware law as a
        liability-structure decision carries its own maintenance schedule.
      </p>
      <p>
        For decision-making, treat these as <strong>fixed costs of the entity
        chassis</strong>, in the same budget line as payroll service and return
        preparation. A sole proprietorship pays none of them — one of the real,
        recurring advantages of staying unformed — so the honest comparison when
        you consider forming an LLC is not just liability-versus-paperwork but
        liability-versus-an-annual-bill. And when an S election&apos;s federal edge
        is thin, these fees are frequently the line item that makes the difference:
        subtract them from the edge before you file the election, and re-check
        every year, because fee schedules move with state budgets. This guide
        deliberately publishes no fee table — the secretary of state&apos;s or
        revenue department&apos;s current fee schedule is a better source than any
        article, including this one.
      </p>

      {/* ================================================================== */}
      <h2 id="path">The verification path, in order</h2>
      <ol>
        <li>
          <strong>Fix your residence state and learn its shape.</strong> One
          afternoon with the state revenue department&apos;s individual-income-tax
          pages tells you the shape, the filing thresholds, and whether the state
          imposes estimates on its own calendar — many do, on dates that do not
          match the federal quarters. The{' '}
          <a href="/guides/self-employed-tax-calendar/">tax-calendar guide</a>{' '}
          covers the federal cadence; the state cadence is a separate page.
        </li>
        <li>
          <strong>Compute the federal baseline with the instruments.</strong> Run
          your real profit and payout numbers through the{' '}
          <a href="/llc-vs-ccorp-tax-calculator/">entity comparison</a> and the{' '}
          <a href="/s-corp-tax-calculator/">salary engine</a> — those are the
          federal floors every later step adds onto.
        </li>
        <li>
          <strong>If you itemize at high income, price the cap and the PTET
          election.</strong> Establish whether your income sits in the phase-down
          zone and whether your state offers an entity-level election; if it does,
          note the election deadline — these windows are typically early in the
          year and often irrevocable once made. This is a preparer conversation,
          not a website conversation.
        </li>
        <li>
          <strong>Map your nexus honestly.</strong> Where did you physically work
          this year? Where do your clients file your 1099s from? Does anyone work
          for you in another state? Each answer either closes the question or
          opens a registration one.
        </li>
        <li>
          <strong>Add the state lines to the entity math and re-run.</strong>{' '}
          Income-tax layer, entity-level taxes, franchise minimums, annual fees —
          into the overhead check, then re-read the verdict. A federal decision
          that survives the state lines is a decision; one that does not was never
          made.
        </li>
        <li>
          <strong>Diarize the state filing cadence.</strong> Estimates, annual
          reports, fee renewals — put each on the calendar with its own deadline.
          Late fees are the most avoidable state tax of all.
        </li>
      </ol>

      {/* ================================================================== */}
      <h2 id="limits">What this guide cannot decide</h2>
      <ul>
        <li>
          <strong>Current rates, anywhere.</strong> Shapes and mechanisms are
          durable; rate schedules are rewritten annually by fifty legislatures.
          This guide names no rate table on purpose — verify with the state.
        </li>
        <li>
          <strong>Multistate apportionment.</strong> Once nexus exists in more
          than one state, income is divided by formulas — sales factors,
          payroll factors — that are their own specialty. This guide stops at the
          border where that computation begins.
        </li>
        <li>
          <strong>Your PTET eligibility.</strong> The election&apos;s existence and
          federal treatment are stated; the eligibility rules, effective dates,
          credit mechanics, and irrevocability windows are state-specific and
          change often. A preparer who files in your state is the right source.
        </li>
        <li>
          <strong>Parameter drift.</strong> The federal anchors here are tax-year
          2025 — the {usd(LC.stdDeduction, 0)} standard deduction and 2025
          brackets the engines carry — and the SALT-cap schedule itself steps
          through 2029 and snaps back to a permanent {usd(10_000, 0)} limit in
          2030 under current law. The structure of every argument
          survives; the numbers move.
        </li>
        <li>
          <strong>Everything a licensed professional sees.</strong> This is an
          educational structural map, not advice: residency audits, voluntary
          disclosure for past nexus, city-level taxes, and credit stacking all
          change the answer. Take real numbers to a CPA who practices in your
          state before filing anything.
        </li>
      </ul>
    </>
  );
}

import Faq from '@/components/Faq';
import { ArticleToc, RelatedCalculators } from '@/components/Article';
import {
  compareRoth,
  horizonSweep,
  rothPhaseOutFraction,
  ROTH_CONSTANTS as RC,
  type RothInput,
} from '@/lib/roth';
import { pct, usd } from '@/lib/format';

/* Every number in the tables and vignettes below is computed at build time by
   the same engine the widget runs (lib/roth.ts) — nothing here is hand-typed. */

// The calculator's default scenario: 24% now, 12% expected in retirement,
// $7,000/yr for 30 years at 7%.
const DEF: RothInput = {
  currentRatePct: 24,
  retirementRatePct: 12,
  annualContribution: 7_000,
  years: 30,
  annualReturnPct: 7,
};
const EX = compareRoth(DEF);

// Equal rates — the exact tie that anchors the "misconceptions" section.
const TIE = compareRoth({ ...DEF, retirementRatePct: 24 });

// Same person, but rates move the other way (24% → 32%): Roth country.
const RISE = compareRoth({ ...DEF, retirementRatePct: 32 });

// Peak earner: 32% → 22%, maxing a 401(k) for 20 years.
const PEAK = compareRoth({
  currentRatePct: 32,
  retirementRatePct: 22,
  annualContribution: RC.k401Limit,
  years: 20,
  annualReturnPct: 7,
});

// Early-career / low-income year: 12% → 24%, the classic Roth case.
const EARLY = compareRoth({
  currentRatePct: 12,
  retirementRatePct: 24,
  annualContribution: RC.iraLimit,
  years: 25,
  annualReturnPct: 7,
});

// Horizon amplification of the default 12-point gap.
const HZ = horizonSweep(DEF, [10, 20, 30, 40]);

// Roth MAGI phase-out worked example: $158k single MAGI lands inside the band.
const PHASE = rothPhaseOutFraction(158_000, 'single');

export default function RothArticle() {
  const toc = [
    { id: 'decision', label: 'The one dial that decides it' },
    { id: 'framings', label: 'Two honest ways to compare' },
    { id: 'worked', label: 'Worked example: 24% now, 12% later' },
    { id: 'breakeven', label: 'The break-even rate, and what moves it' },
    { id: 'compounding', label: 'Compounding sizes the bet' },
    { id: 'limits', label: '2025 limits & eligibility gates' },
    { id: 'when-roth', label: 'When Roth is the right call' },
    { id: 'when-trad', label: 'When Traditional is the right call' },
    { id: 'both', label: 'Why “both” is a legitimate answer' },
    { id: 'ladder', label: 'The conversion ladder, briefly' },
    { id: 'misconceptions', label: 'Common misunderstandings' },
    { id: 'caveats', label: 'What this model does not do' },
    { id: 'faq', label: 'FAQ' },
  ];

  return (
    <article className="prose-article">
      <ArticleToc items={toc} />

      {/* ============================ The dial ============================ */}
      <h2 id="decision">The one dial that decides it</h2>
      <p>
        Strip away the vocabulary and the Roth-versus-Traditional question has exactly one moving
        part: <strong>the tax rate you avoid today versus the tax rate you pay when the money comes
        out</strong>. A Traditional contribution is deducted at your <em>current marginal rate</em>{' '}
        and taxed later, at whatever rate applies in retirement. A Roth contribution is taxed{' '}
        <em>now</em>, at that same current rate, and never again. Both accounts grow untaxed on the
        inside — the growth engine is identical, which is why an expected return never picks a
        winner in this comparison, it only scales the dollars at stake.
      </p>
      <p>
        That single dial has a clean algebraic reading. With a contribution of {usd(EX.tradBalance / EX.factor, 0)}{' '}
        per year for {DEF.years} years at {pct(DEF.annualReturnPct, 0)}, the annuity factor is{' '}
        {EX.factor.toFixed(2)} — and the spendable difference between the two accounts at retirement is
        exactly
      </p>
      <p>
        <strong>Δ = C × G × (t<sub>ret</sub> − t<sub>now</sub>)</strong>
      </p>
      <p>
        — the rate gap in points, multiplied by every dollar the plan would hold. At this page&apos;s
        default ({pct(DEF.currentRatePct, 0)} now, {pct(DEF.retirementRatePct, 0)} later), that is{' '}
        {usd(EX.advantageRoth, 0)}: negative means the Traditional account ends ahead, because a
        12-point rate drop is worth {usd(EX.perPointSwing, 0)} of spendable value per point on a{' '}
        {usd(EX.tradBalance, 0)} balance.
      </p>

      {/* ============================ Framings ============================ */}
      <h2 id="framings">Two honest ways to compare</h2>
      <p>
        Most confusion around this decision is really confusion about <em>which two things are being
        compared</em>. There are two defensible framings, and they answer different questions.
      </p>
      <h3>Framing A — equal pre-tax outlay (the decision framing)</h3>
      <p>
        Both strategies consume the same pre-tax income. {usd(DEF.annualContribution, 0)} of pre-tax
        income goes into the Traditional account untouched; the Roth contributor pays{' '}
        {pct(DEF.currentRatePct, 0)} first, so only {usd(EX.rothBalance / EX.factor, 0)} lands in the
        Roth account — the paychecks feel identical. At retirement:
      </p>
      <ul>
        <li>
          Traditional: {usd(EX.tradBalance, 0)} balance × (1 − {pct(DEF.retirementRatePct, 0)}) ={' '}
          <strong>{usd(EX.tradSpendable, 0)}</strong> spendable.
        </li>
        <li>
          Roth: <strong>{usd(EX.rothSpendable, 0)}</strong> — the whole balance, already taxed.
        </li>
      </ul>
      <p>
        This is the framing the verdict card uses, and the one under which equal rates produce an{' '}
        <em>exact tie</em> ({usd(TIE.rothSpendable, 0)} versus {usd(TIE.tradSpendable, 0)} at{' '}
        {pct(DEF.currentRatePct, 0)} both sides). It is the right framing because it holds your
        living standard constant and lets only the tax treatment vary.
      </p>
      <h3>Framing B — equal nominal contribution (the limit view)</h3>
      <p>
        The other comparison puts the same {usd(DEF.annualContribution, 0)} into <em>each</em> account
        — which is how contribution limits actually bind, since the 2025 IRA limit is{' '}
        {usd(RC.iraLimit, 0)} of either flavor. Now the Roth column reads{' '}
        {usd(EX.rothSpendableLimitView, 0)} against the Traditional column&apos;s{' '}
        {usd(EX.tradSpendable, 0)} — the Roth account appears ahead by{' '}
        {usd(EX.advantageRothLimitView, 0)} whenever the retirement rate is above zero.
      </p>
      <p>
        Read that edge carefully: <strong>it is produced by the framing, not the investment</strong>.
        The Roth column&apos;s extra dollars exist only because the tax paid to fund them was moved
        off the books. The framing still matters for one real reason — limits are nominal, so a
        dollar of Roth limit space buys a dollar of retirement spendable, while a dollar of
        Traditional limit space buys only{' '}
        {usd(DEF.annualContribution * (1 - DEF.retirementRatePct / 100), 0)} per {usd(DEF.annualContribution, 0)} at a{' '}
        {pct(DEF.retirementRatePct, 0)} retirement rate — each Roth slot is worth the same
        spendable as {usd(DEF.annualContribution / (1 - DEF.retirementRatePct / 100), 0)} of Traditional
        slot. For everyone contributing below the cap, Framing A is the honest lens and Framing B is
        a mirage; for savers at the cap, Framing B is the reason equal rates mildly favor Roth (the
        &ldquo;misconceptions&rdquo; section finishes this thought).
      </p>

      {/* ========================= Worked example ========================= */}
      <h2 id="worked">Worked example: 24% now, 12% later</h2>
      <p>
        A 35-year-old putting {usd(DEF.annualContribution, 0)} a year into an IRA for {DEF.years}{' '}
        years at {pct(DEF.annualReturnPct, 0)} expects to retire into a {pct(DEF.retirementRatePct, 0)}{' '}
        bracket — common for retirees whose income is mostly withdrawals stacked on a standard
        deduction. Line by line, same pre-tax outlay both ways:
      </p>
      <ol>
        <li>
          The Traditional account receives {usd(DEF.annualContribution, 0)}/yr and compounds to{' '}
          {usd(EX.tradBalance, 0)}. The Roth account receives{' '}
          {usd(EX.rothBalance / EX.factor, 0)}/yr (the after-tax equivalent) and compounds to{' '}
          {usd(EX.rothBalance, 0)}.
        </li>
        <li>
          Retirement tax takes {pct(DEF.retirementRatePct, 0)} off the Traditional balance —{' '}
          {usd(EX.tradBalance - EX.tradSpendable, 0)} — leaving {usd(EX.tradSpendable, 0)}. The Roth
          balance pays nothing: {usd(EX.rothSpendable, 0)}.
        </li>
        <li>
          Net: <strong>Traditional ahead by {usd(-EX.advantageRoth, 0)}</strong>. The 12-point rate
          drop is the entire result — flip it to 32% in retirement and the same saver flips to Roth
          ahead by {usd(RISE.advantageRoth, 0)}.
        </li>
      </ol>
      <p>
        Two more vignettes from the same engine: a peak earner at 32% deferring the full{' '}
        {usd(RC.k401Limit, 0)} 401(k) limit for 20 years and retiring 10 points lower keeps{' '}
        {usd(-PEAK.advantageRoth, 0)} more with Traditional; an early-career saver at 12% expecting
        24% later — the sabbatical, the PhD, the startup founder drawing little salary — comes out{' '}
        {usd(EARLY.advantageRoth, 0)} ahead with Roth on a {usd(RC.iraLimit, 0)}-a-year habit. The
        engine has no opinion; the rate path is the whole story.
      </p>

      {/* =========================== Break-even =========================== */}
      <h2 id="breakeven">The break-even rate, and what moves it</h2>
      <p>
        Under this model the break-even retirement rate is <strong>exactly your current marginal
        rate</strong> — visible in the scan chart as the crossing point sitting precisely on the
        marker. Left of it, Traditional wins; right of it, Roth does. The real world bends that line
        in both directions, and honest planning names the bends:
      </p>
      <ul>
        <li>
          <strong>Bracket stacking favors Traditional.</strong> Your retirement rate is not one
          bracket — withdrawals fill the standard deduction and the 10% and 12% shelves before they
          reach your &ldquo;bracket.&rdquo; The average rate on a Traditional balance is usually a
          few points below the top rate those withdrawals touch, which pushes the true break-even to
          the right of the naive line: more people than expected are Traditional candidates.
        </li>
        <li>
          <strong>Required distributions favor Roth.</strong> Traditional IRAs force distributions
          from age 73 (75 if born 1960 or later); Roth IRAs never do in the owner&apos;s lifetime.
          Forced distributions can stack on other income and raise the very rate the Traditional bet
          was counting on avoiding.
        </li>
        <li>
          <strong>State arbitrage favors Traditional</strong> if you will deduct in a high-tax state
          and retire in a none; the reverse trip favors Roth.
        </li>
        <li>
          <strong>Legislative risk favors Roth</strong> — its rate is locked today; the Traditional
          rate is whatever Congress says decades from now.
        </li>
      </ul>
      <p>
        None of these are modeled in the widget — it deliberately shows the clean line so you can
        see how far your own assumptions bend it.
      </p>

      {/* =========================== Compounding =========================== */}
      <h2 id="compounding">Compounding sizes the bet — it does not pick a side</h2>
      <p>
        A persistent misunderstanding is that &ldquo;more years of compounding&rdquo; favors Roth
        because Roth earnings escape tax. Both accounts compound identically — untaxed — on the
        inside, so the <em>ratio</em> of outcomes depends only on the rate gap. What the horizon
        actually does is multiply the dollars attached to your decision. The default 12-point drop,
        recomputed at four horizons, all from the same engine:
      </p>
      <table>
        <thead>
          <tr>
            <th scope="col">Horizon</th>
            <th scope="col" className="text-right">Traditional spendable</th>
            <th scope="col" className="text-right">Roth spendable</th>
            <th scope="col" className="text-right">Traditional edge</th>
          </tr>
        </thead>
        <tbody>
          {HZ.map((h) => (
            <tr key={h.years}>
              <th scope="row" className="readout font-semibold normal-case tracking-normal">
                {h.years} years
              </th>
              <td className="readout text-right">{usd(h.tradSpendable, 0)}</td>
              <td className="readout text-right">{usd(h.rothSpendable, 0)}</td>
              <td className="readout text-right font-semibold text-rose-600 dark:text-rose-400">
                {usd(-h.advantageRoth, 0)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p>
        The percentage edge is 12 points wide at every row; the dollars grow from{' '}
        {usd(-HZ[0].advantageRoth, 0)} at a 10-year runway to {usd(-HZ[3].advantageRoth, 0)} at 40 —
        a {((Math.abs(HZ[3].advantageRoth) / Math.abs(HZ[0].advantageRoth))).toFixed(1)}× amplification
        of the identical decision. Getting the rate call right matters little early and enormously
        late; getting it wrong is correspondingly cheap young and expensive old.
      </p>

      {/* ======================= Limits & eligibility ======================= */}
      <h2 id="limits">2025 limits and eligibility gates</h2>
      <p>
        The comparison math is account-agnostic, but the guardrails are not. The 2025 federal
        parameters this tool discloses:
      </p>
      <table>
        <thead>
          <tr>
            <th scope="col">Rule</th>
            <th scope="col">2025 amount</th>
            <th scope="col">Applies to</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <th scope="row" className="normal-case tracking-normal">IRA contribution limit</th>
            <td className="readout">{usd(RC.iraLimit, 0)} — aggregate across ALL your Roth + Traditional IRAs</td>
            <td>Both</td>
          </tr>
          <tr>
            <th scope="row" className="normal-case tracking-normal">IRA age-50 catch-up</th>
            <td className="readout">{usd(RC.iraCatchUp, 0)} (flat; no enhanced tier)</td>
            <td>Both</td>
          </tr>
          <tr>
            <th scope="row" className="normal-case tracking-normal">401(k) deferral limit</th>
            <td className="readout">{usd(RC.k401Limit, 0)} — one bucket shared by Roth + pre-tax deferrals</td>
            <td>Both</td>
          </tr>
          <tr>
            <th scope="row" className="normal-case tracking-normal">401(k) catch-up, 50+</th>
            <td className="readout">{usd(RC.k401CatchUp, 0)}</td>
            <td>Both</td>
          </tr>
          <tr>
            <th scope="row" className="normal-case tracking-normal">401(k) catch-up, 60–63</th>
            <td className="readout">{usd(RC.k401EnhancedCatchUp, 0)} (replaces the 50+ amount)</td>
            <td>Both</td>
          </tr>
          <tr>
            <th scope="row" className="normal-case tracking-normal">Roth IRA MAGI phase-out</th>
            <td className="readout">$150k–$165k single · $236k–$246k MFJ · $0–$10k MFS</td>
            <td>Roth IRA only</td>
          </tr>
          <tr>
            <th scope="row" className="normal-case tracking-normal">Roth 401(k) income limit</th>
            <td className="readout">None — no MAGI test at any income</td>
            <td>Roth 401(k)</td>
          </tr>
        </tbody>
      </table>
      <p>
        The MAGI phase-out is linear inside the band: a single filer at $158k of MAGI keeps only{' '}
        {pct(PHASE * 100, 0)} of the limit — {usd(RC.iraLimit * PHASE, 0)} of direct Roth IRA room
        (the IRS worksheet rounds contributions to the nearest $10). Above the top of the band,
        direct Roth IRA contributions are closed; the backdoor route (a non-deductible Traditional
        contribution converted to Roth) still works, but the pro-rata rule taxes the conversion by
        the pre-tax share of <em>all</em> your IRA balances — with existing pre-tax IRAs sitting in
        the account, the &ldquo;backdoor&rdquo; can quietly become a taxable event. A Roth 401(k)
        has no income test at all, which is why high earners defaulted to it once plans began
        offering the option.
      </p>
      <p>
        One mirror-image gate the tool does not enforce: <strong>Traditional IRA deductibility</strong>{' '}
        phases out when you are covered by a workplace plan — roughly $79k–$89k of MAGI single and
        $126k–$146k MFJ for 2025. Above those bands a non-deductible Traditional contribution keeps
        tax-deferral but not the deduction that this entire comparison prices; at that point the
        Roth side of the ledger is usually the only one still earning its keep.
      </p>

      {/* ============================ When Roth ============================ */}
      <h2 id="when-roth">When Roth is the right call</h2>
      <ul>
        <li>
          <strong>Your bracket today is low</strong> — early career, a sabbatical year, a founder
          drawing minimal salary. Paying 12% now to avoid 22–24% later is the trade the widget shows
          as {usd(EARLY.advantageRoth, 0)} on a modest habit.
        </li>
        <li>
          <strong>You genuinely expect higher rates later</strong> — a defined-benefit pension,
          rental income, deferred compensation, or a large pre-tax balance already waiting to be
          taxed in retirement.
        </li>
        <li>
          <strong>You are maxing every limit</strong> — at the cap, Roth limit-space shelters more
          spendable value per dollar of nominal limit (Framing B&apos;s one legitimate use).
        </li>
        <li>
          <strong>You want distribution control</strong> — no lifetime RMDs on a Roth IRA (and, since
          2024, none on a Roth 401(k) either) means the tax timing stays yours into your late
          seventies and beyond.
        </li>
        <li>
          <strong>Estate plumbing</strong> — inherited Roth assets pass income-tax-free to heirs
          (they still face the 10-year distribution window for most beneficiaries since 2020).
        </li>
      </ul>

      {/* ======================== When Traditional ======================== */}
      <h2 id="when-trad">When Traditional is the right call</h2>
      <ul>
        <li>
          <strong>You are in your peak brackets</strong> — deferring at 32–37% against a likely
          12–22% retirement rate is the single most reliable win on this page: the widget shows{' '}
          {usd(-PEAK.advantageRoth, 0)} on the maxed-401(k) vignette.
        </li>
        <li>
          <strong>The deduction has present-value you need</strong> — the tax saved this year is cash
          now; for a volatile business, smoothing income across years <em>is</em> the strategy.
        </li>
        <li>
          <strong>You will retire in a lower-tax state</strong> — deduct in California, withdraw in
          Texas is the classic arbitrage.
        </li>
        <li>
          <strong>Your retirement income will be modest</strong> — withdrawals stacked on the standard
          deduction make the effective rate on the first tranche of a Traditional balance very low,
          sometimes near zero.
        </li>
      </ul>

      {/* ============================== Both =============================== */}
      <h2 id="both">Why &ldquo;both&rdquo; is a legitimate answer</h2>
      <p>
        The break-even is a rate forecast, and rate forecasts are unreliable. Holding both account
        flavors is not indecision — it is hedging the forecast: Traditional dollars give you a
        deduction at a known rate today, Roth dollars give you a known rate of never, and the split
        lets you choose, <em>each year in retirement</em>, which account to draw from to steer your
        taxable income. That steering is worth real money around Medicare IRMAA surcharges and the
        capital-gains brackets, and it is the quiet argument for tax diversification that no pure
        break-even calculation captures.
      </p>

      {/* ============================= Ladder ============================== */}
      <h2 id="ladder">The conversion ladder, briefly</h2>
      <p>
        The two accounts are convertible — a Roth <em>conversion</em> moves Traditional money to
        Roth and pays ordinary tax on the converted amount at that year&apos;s rates. The well-known
        exploitation is the <strong>conversion ladder</strong>: in low-income years (early
        retirement before Social Security and RMDs begin, a bad business year, a sabbatical), convert
        roughly one year of future expenses from Traditional to Roth, filling the empty 10% and 12%
        brackets at a fraction of the rate the deduction originally avoided. Each conversion has its
        own five-year clock before its principal can come out penalty-free — start five years before
        you need the money. Done patiently, this is how a peak-bracket Traditional saver collects the
        deduction <em>and</em> the low rate: the best of both columns, paid for with nothing but
        planning. This tool does not model conversions; it models the contribution decision the
        ladder later harvests.
      </p>

      {/* ======================== Misconceptions ========================== */}
      <h2 id="misconceptions">Common misunderstandings</h2>
      <h3>&ldquo;Roth wins because withdrawals are tax-free&rdquo;</h3>
      <p>
        In the equal-outlay framing, equal rates produce an exact tie — {usd(TIE.tradSpendable, 0)}{' '}
        versus {usd(TIE.rothSpendable, 0)} at the default numbers. Multiplication does not care
        whether the tax is taken before or after compounding: C×(1−t)×G equals C×G×(1−t). Only the
        rate differential decides, which is why this page leads with it.
      </p>
      <h3>&ldquo;So why do people say Roth is slightly better at equal rates?&rdquo;</h3>
      <p>
        Three real mechanisms, none of which is &ldquo;tax-free growth&rdquo;:
      </p>
      <ol>
        <li>
          <strong>Nominal limits</strong> — the Framing B effect above: at the cap, Roth room shelters
          more spendable value per dollar of limit. Below the cap it does not apply.
        </li>
        <li>
          <strong>Side-account drag</strong> — also a Framing B effect, felt at the cap. When both
          accounts receive the same nominal dollars, the Traditional saver pays less out-of-pocket;
          making the columns comparable means investing that leftover money on the side, and the
          only place for it is a <em>taxable</em> account, where dividends and realized gains are
          taxed annually. The side pool compounds slower than the sheltered Roth dollars it is
          supposed to track — and that drag is the honest size of &ldquo;Roth is a bit better at
          equal rates&rdquo; for a saver who is maxing out.
        </li>
        <li>
          <strong>Distribution control</strong> — no RMDs and rate certainty are worth something
          option-like that a fixed-rate model prices at zero.
        </li>
      </ol>
      <p>
        Notice where all three live: the first two exist only at the cap (Framing B&apos;s world),
        the third only at withdrawal time. For a below-the-cap saver choosing in Framing A — where
        the paychecks are identical by construction and there is no refund to reinvest — equal rates
        remain an exact tie. Keeping the framings apart is exactly what stops these claims from
        bleeding into each other.
      </p>
      <h3>&ldquo;My bracket is my retirement rate&rdquo;</h3>
      <p>
        The rate that should go in the retirement field is the one that will actually apply to these
        withdrawals — an average across the standard deduction and the brackets the withdrawals fill,
        not your peak working bracket transplanted forward. Overestimating it is the most common way
        people talk themselves into Roth when Traditional was the better trade.
      </p>
      <h3>&ldquo;Roth money is penalty-free, period&rdquo;</h3>
      <p>
        Contributions yes — they come out first, tax- and penalty-free, any time. Earnings need age
        59½ plus the five-year clock; conversions each carry their own five-year seasoning for the
        penalty. The flexibility is real, but it is flexibility on principal, not on growth.
      </p>

      {/* ============================= Caveats ============================= */}
      <h2 id="caveats">What this model does not do</h2>
      <ul>
        <li>
          No bracket stacking — the retirement field is one flat rate on the whole balance, not the
          effective rate a withdrawal schedule would actually produce.
        </li>
        <li>
          No RMDs, no state tax, no Medicare IRMAA interactions, no saver&apos;s credit, no
          Traditional-IRA deductibility phase-ins.
        </li>
        <li>
          Constant returns and constant rates for the whole horizon; the real future is neither.
        </li>
        <li>
          The MAGI phase-out is disclosed, not modeled — the tool never blocks an ineligible
          contribution, it flags nothing about your income because it never asks.
        </li>
      </ul>

      <Faq
        items={[
          {
            question: 'Is Roth better because withdrawals are tax-free?',
            answer: (
              <p>
                Not by itself. Growth is tax-free inside both accounts, so at equal tax rates the two
                are worth exactly the same spendable dollars ({usd(TIE.tradSpendable, 0)} versus{' '}
                {usd(TIE.rothSpendable, 0)} at this page&apos;s default numbers). The decision is
                entirely the rate gap: pay a lower rate than you avoided and Roth wins, higher and
                Traditional does.
              </p>
            ),
          },
          {
            question: 'What exactly is my break-even retirement tax rate?',
            answer: (
              <p>
                Under this model, precisely your current marginal rate — that is where the scan
                chart&apos;s two lines cross. Real-world effects move the effective crossing: bracket
                stacking on withdrawals pushes it right (helping Traditional), RMDs and state
                arbitrage push it around in both directions. Treat the marker as the center of a
                band, not a cliff edge.
              </p>
            ),
          },
          {
            question: 'Can I contribute to both a Roth and a Traditional IRA?',
            answer: (
              <p>
                Yes, but the {usd(RC.iraLimit, 0)} limit is one bucket across every IRA you own —
                {usd(RC.iraLimit, 0)} total at any split, plus the {usd(RC.iraCatchUp, 0)} catch-up
                from age 50. Splitting is the tax-diversification play discussed above, not extra
                room.
              </p>
            ),
          },
          {
            question: 'My income is over the Roth phase-out — is Roth closed to me?',
            answer: (
              <p>
                Direct Roth IRA contributions are, above $165k single / $246k MFJ of MAGI (2025).
                Two doors remain: a Roth 401(k), which has no income test at all, and the backdoor
                IRA route — a non-deductible Traditional contribution converted to Roth. The
                backdoor&apos;s catch is the pro-rata rule: with existing pre-tax IRA money, the
                conversion is taxed in proportion to it, so clean backdoors usually require rolling
                those balances into a 401(k) first.
              </p>
            ),
          },
          {
            question: 'What about required minimum distributions?',
            answer: (
              <p>
                Traditional IRAs and pre-tax 401(k)s force distributions from age 73 (75 if born in
                1960 or later). Roth IRAs have no lifetime RMDs, and Roth 401(k)s stopped having
                them for tax years after 2023 — you can also roll a Roth 401(k) into a Roth IRA.
                RMDs matter here because they can push taxable income into brackets your younger
                self never planned on.
              </p>
            ),
          },
          {
            question: 'When can I pull Roth money out penalty-free?',
            answer: (
              <p>
                Contributions any time — they are deemed to come out first, tax- and penalty-free.
                Converted principal owes a 10% penalty only if withdrawn within five years of the
                conversion (before 59½). Earnings need both age 59½ and the account being open five
                tax years. In practice a Roth you funded with regular contributions is a deep
                emergency reserve long before retirement.
              </p>
            ),
          },
          {
            question: 'Should a peak earner ever choose Roth?',
            answer: (
              <p>
                Occasionally. If retirement will be funded by pensions, rentals, or a large existing
                pre-tax balance, your later rate may not fall much — the widget&apos;s RISE vignette
                shows {usd(RISE.advantageRoth, 0)} for the saver whose rate climbs instead of drops.
                And a peak earner already maxing every limit gets the nominal-limit effect working
                for Roth. The default peak-bracket answer remains Traditional —{' '}
                {usd(-PEAK.advantageRoth, 0)} on the 401(k) vignette — but &ldquo;peak earner&rdquo;
                is not a synonym for &ldquo;Traditional, always.&rdquo;
              </p>
            ),
          },
          {
            question: 'Does a higher investment return favor Roth?',
            answer: (
              <p>
                No. The annuity factor multiplies both columns equally — the percentage edge is the
                rate gap and nothing else. What a higher return does is enlarge the dollars attached
                to the decision ({usd(-HZ[0].advantageRoth, 0)} at ten years versus{' '}
                {usd(-HZ[3].advantageRoth, 0)} at forty, same decision), which is an argument for
                deciding carefully, not for either account.
              </p>
            ),
          },
          {
            question: 'Does my employer match care which flavor I pick?',
            answer: (
              <p>
                By default the match lands as pre-tax dollars whichever flavor your own deferrals
                are — though since 2024 (SECURE 2.0 §604) a plan <em>may</em> offer designated-Roth
                matching, taxable in the year it is contributed, if you elect it. Take the match
                before optimizing anything on this page — it is an immediate 100% return that dwarfs
                a few points of tax-rate arbitrage. Your Roth-vs-traditional choice applies to your
                own deferral slice.
              </p>
            ),
          },
        ]}
      />

      <RelatedCalculators
        links={[
          { href: '/solo-401k-calculator/', label: 'Solo 401(k) vs SEP-IRA Calculator' },
          { href: '/self-employment-tax-calculator/', label: 'Self-Employment Tax Calculator' },
          { href: '/quarterly-estimated-tax-calculator/', label: 'Quarterly Estimated Tax Calculator' },
          { href: '/s-corp-tax-calculator/', label: 'S-Corp Salary Calculator' },
        ]}
      />
    </article>
  );
}

import { ArticleToc } from '@/components/Article';
import {
  CAP_TABLE_PRESETS,
  ROUND_NAMES,
  DEFAULT_EXIT_VALUATION,
  simulateCapTable,
  foundersPct,
  founderPct,
  finalStage,
  stakePct,
} from '@/lib/captable';
import { convertSafeStack } from '@/lib/safe';
import { numFmt, pct, usd, usdCompact } from '@/lib/format';

/**
 * "Splitting Equity With Co-founders" — the guides-knowledge-base body for
 * /guides/founder-equity-splits/. Rendered through GuideShell, which supplies
 * the h1, breadcrumb, prose column, and the closing instrument panel; this
 * component starts at h2 and emits bare semantic markup (same contract as the
 * other guide bodies).
 *
 * Every figure that leans on an instrument is computed at module scope by the
 * same libraries that power the two instruments this guide hands off to
 * (lib/captable, lib/safe) — the vesting and ledger arithmetic is computed the
 * same way rather than hand-typed, so the guide cannot drift from the engines.
 * Values cross-checked against a tsc-compiled engine run during authoring
 * (see the workflow's mathChecks record).
 *
 * Legal references are stated at the source level (26 U.S.C. § 83, Treas. Reg.
 * § 1.83-2) and kept qualitative — this guide prices decisions, it does not
 * give tax or legal advice.
 */

/** Ownership deltas are percentage POINTS, never a bare "%". */
const pts = (v: number, d = 2) => `${v.toFixed(d)} points`;

/* ------------------------------------------------------------------ */
/* Pass 1 — the even split rehearsed through the standard path          */
/* (lib/captable preset 0 rounds; founders 5,000,000 / 5,000,000).     */
/* ------------------------------------------------------------------ */
const EVEN_FOUNDERS = [
  { name: 'Founder A', shares: 5_000_000 },
  { name: 'Founder B', shares: 5_000_000 },
];
const STD_ROUNDS = CAP_TABLE_PRESETS[0].rounds.map((r, i) => ({ name: ROUND_NAMES[i], ...r }));
const EVEN = simulateCapTable(EVEN_FOUNDERS, STD_ROUNDS);
const evenFinal = finalStage(EVEN)!;
const evenTrail = EVEN.stages.map((s) => founderPct(s, 0)); // 50 → 32.50 → 24.56 → 20.46 → 18.01
const evenCombinedTrail = EVEN.stages.map((s) => foundersPct(s)); // 100 → 65.00 → 49.11 → 40.93 → 36.01
const evenEachFinal = founderPct(evenFinal, 0); // 18.0074 → 18.01
const stdRaised = STD_ROUNDS.reduce((a, r) => a + r.investment, 0); // $52.5M
const evenFinalShares = evenFinal.shares; // 27,766,351 fully diluted after Series C

/* The same rounds over the calculator's own default table — 6M/4M, a 60/40. */
const SIXFOUR = simulateCapTable(
  CAP_TABLE_PRESETS[0].founders.map((f, i) => ({ name: i ? 'Founder B' : 'Founder A', shares: f.shares })),
  STD_ROUNDS,
);
const sixFour = finalStage(SIXFOUR)!;
const sixtyFinal = founderPct(sixFour, 0); // 21.61
const fortyFinal = founderPct(sixFour, 1); // 14.41
const gapFounding = 60 - 40; // 20.00 points
const gapFinal = sixtyFinal - fortyFinal; // 7.20 points
const gapRatio = sixtyFinal / fortyFinal; // exactly 1.5 — the ratio survives intact
const gapValueAtC = (gapFinal / 100) * STD_ROUNDS[3].postMoney; // $18.0M at the $250M C post-money
const gapValueAtExit = (gapFinal / 100) * DEFAULT_EXIT_VALUATION; // $7.2M at a $100M exit

/* ------------------------------------------------------------------ */
/* Pass 2 — the four-ledger contribution method.                       */
/* ------------------------------------------------------------------ */
const LEDGER_WEIGHTS = { cash: 0.3, time: 0.45, ip: 0.15, opp: 0.1 }; // must sum to 1
type LedgerInputs = {
  cashA: number; cashB: number;
  fteA: number; fteB: number;
  ipA: number; ipB: number;
  oppA: number; oppB: number;
};
/** Relative share of a two-way ledger, in percent. */
const twoWay = (a: number, b: number) => (100 * a) / (a + b);
/** Weighted blend of the four ledgers for one founder, in percent. */
const ledgerScore = (L: LedgerInputs, who: 'A' | 'B') =>
  LEDGER_WEIGHTS.cash * twoWay(L.cashA, L.cashB) +
  LEDGER_WEIGHTS.time * twoWay(L.fteA, L.fteB) +
  LEDGER_WEIGHTS.ip * (who === 'A' ? L.ipA : L.ipB) +
  LEDGER_WEIGHTS.opp * twoWay(L.oppA, L.oppB);

/* Month-0 scoring: 24-month planning window. A is the builder who took a
   smaller check and a bigger pay cut; B funded the company and starts half-time. */
const L0: LedgerInputs = {
  cashA: 20_000, cashB: 100_000,
  fteA: 24, fteB: 18, // B: 12 months at 50% + 12 at 100% = 18 FTE months
  ipA: 70, ipB: 30, // negotiated judgment scores, not book values
  oppA: 220_000, oppB: 150_000, // offers each founder declined to join
};
const sub = {
  cash: { A: twoWay(L0.cashA, L0.cashB), B: twoWay(L0.cashB, L0.cashA) }, // 16.67 / 83.33
  time: { A: twoWay(L0.fteA, L0.fteB), B: twoWay(L0.fteB, L0.fteA) }, // 57.14 / 42.86
  ip: { A: L0.ipA, B: L0.ipB }, // 70 / 30
  opp: { A: twoWay(L0.oppA, L0.oppB), B: twoWay(L0.oppB, L0.oppA) }, // 59.46 / 40.54
};
const ledgerA = ledgerScore(L0, 'A'); // 47.16
const ledgerB = 100 - ledgerA; // 52.84

/* Month-12 re-score: B went full-time at month six, not twelve — forecast FTE
   for the window rises from 18 to 21 months. */
const L12: LedgerInputs = { ...L0, fteB: 21 };
const ledgerA12 = ledgerScore(L12, 'A'); // 45.45
const ledgerB12 = 100 - ledgerA12; // 54.55
const ledgerShift = ledgerA12 - ledgerA; // −1.71 points, settled to B

/* What the ledger's split becomes after the same four rounds. */
const LEDGER_SIM = simulateCapTable(
  [
    { name: 'A', shares: Math.round(ledgerA * 100_000) },
    { name: 'B', shares: Math.round(ledgerB * 100_000) },
  ],
  STD_ROUNDS,
);
const ledgerFinalA = founderPct(finalStage(LEDGER_SIM)!, 0); // 16.98
const ledgerFinalB = founderPct(finalStage(LEDGER_SIM)!, 1); // 19.03

/* ------------------------------------------------------------------ */
/* Pass 3 — vesting: 48 months monthly, 12-month cliff, 5M-share grant. */
/* ------------------------------------------------------------------ */
const VEST_MONTHS = 48;
const CLIFF_MONTHS = 12;
const GRANT_SHARES = 5_000_000;
const vestedPctOf = (m: number) =>
  (m < CLIFF_MONTHS ? 0 : Math.min(m, VEST_MONTHS) / VEST_MONTHS) * 100;
const VEST_ROWS = [10, 12, 14, 24, 36, 48].map((m) => ({
  month: m,
  vested: vestedPctOf(m),
  kept: Math.round(GRANT_SHARES * (vestedPctOf(m) / 100)),
  repurchased: Math.round(GRANT_SHARES * (1 - vestedPctOf(m) / 100)),
}));
const M14 = VEST_ROWS.find((r) => r.month === 14)!; // 29.17% — 1,458,333 kept, 3,541,667 back
const M10 = VEST_ROWS.find((r) => r.month === 10)!; // the cliff walk: zero vested

/* The departure scenario: month-14 leaver keeps M14.kept shares; the company
   repurchases and cancels the rest; the survivor walks the standard rounds. */
const leaverKept = M14.kept; // 1,458,333
const leaverReturned = M14.repurchased; // 3,541,667
const stayerAfterBuyback = stakePct(GRANT_SHARES, GRANT_SHARES + leaverKept); // 77.42
const DEPARTURE = simulateCapTable(
  [
    { name: 'Stayer', shares: GRANT_SHARES },
    { name: 'Leaver', shares: leaverKept },
  ],
  STD_ROUNDS,
);
const departureFinal = finalStage(DEPARTURE)!;
const stayerFinal = founderPct(departureFinal, 0); // 27.88
const leaverFinal = founderPct(departureFinal, 1); // 8.13
const leaverNoVesting = evenEachFinal; // 18.01 — what the leaver keeps with no schedule
const clawbackPts = leaverNoVesting - leaverFinal; // 9.88 points returned by the schedule

/* ------------------------------------------------------------------ */
/* Pass 4 — the SAFE side: what a seed note does to a 50/50, and what  */
/* it cannot do. lib/safe standard preset: $500k at a $10M cap, 20%    */
/* off, converting in a $3M round at $15M pre over 10M existing shares.*/
/* ------------------------------------------------------------------ */
const Z = { amount: 0, cap: 0, discountPct: 0 } as const;
const SAFE_STACK = convertSafeStack(
  [{ amount: 500_000, cap: 10_000_000, discountPct: 20 }, { ...Z }],
  { investment: 3_000_000, preMoney: 15_000_000 },
  10_000_000,
);
const safePrePct = SAFE_STACK.safes[0].pctOfPreRound; // 5.00 — fixed the day it is signed
const foundersWithStack = SAFE_STACK.foundersPctAfter; // 79.17
const foundersNoStack = SAFE_STACK.foundersPctNoSafes; // 83.33
const stackCostPts = SAFE_STACK.foundersExtraDilutionPts; // 4.17 combined
const eachAfterStack = foundersWithStack / 2; // 39.58
const eachStackCost = stackCostPts / 2; // 2.08 per founder

/* ------------------------------------------------------------------ */

export default function FounderEquitySplitsGuide() {
  const toc = [
    { id: 'why-even', label: 'The 50/50 problem' },
    { id: 'ledger', label: 'The four ledgers' },
    { id: 'vesting', label: 'Vesting & the cliff' },
    { id: 'agreement', label: 'Five clauses in writing' },
    { id: 'dilution', label: 'The dilution rehearsal' },
    { id: 'protocol', label: 'Protocol & limits' },
  ];

  return (
    <>
      <ArticleToc items={toc} />

      <p>
        <strong>
          Split equity with a ledger, not a handshake; put every founder share — including
          your own — under four-year vesting with a one-year cliff; write the five clauses
          into an agreement before the first outside dollar moves; and rehearse the split
          through the financing path before you sign any of it.
        </strong>{' '}
        Those four moves settle almost every founder-equity dispute while it is still cheap
        to settle. The number that makes the stakes concrete: two founders who split{' '}
        {pct(50, 0)}/{pct(50, 0)} today and raise {usd(stdRaised, 0)} across four ordinary
        rounds each end up holding <strong>{pct(evenEachFinal, 2)}</strong> — and the ratio
        between them survives every round untouched. The split you sign is not a number; it
        is a proportion, and it is permanent in exactly the way &ldquo;we&rsquo;ll fix it
        later&rdquo; is not. This guide walks the decision with the same engines that power
        the{' '}
        <a href="/cap-table-dilution-calculator/">
          cap table calculator
        </a>{' '}
        and the{' '}
        <a href="/safe-note-calculator/">
          SAFE note calculator
        </a>{' '}
        — every figure below is computed, and reproducible on your own numbers.
      </p>

      <div className="my-8 rounded-xl border border-slate-200 bg-slate-50/60 p-5 sm:p-6 dark:border-white/[0.08] dark:bg-white/[0.03]">
        <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          The decision framework
        </div>
        <ol className="grid list-decimal gap-2 pl-5 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
          <li>
            <strong className="font-semibold text-slate-900 dark:text-slate-100">Score, don&rsquo;t guess:</strong>{' '}
            four ledgers — cash, time, intellectual property, opportunity cost — each weighted,
            each written down.
          </li>
          <li>
            <strong className="font-semibold text-slate-900 dark:text-slate-100">Open a window:</strong>{' '}
            re-score the ledger on facts and triggers, settle adjustments in shares within a
            pre-agreed band, close the window at the priced round.
          </li>
          <li>
            <strong className="font-semibold text-slate-900 dark:text-slate-100">Vest everyone:</strong>{' '}
            48 months monthly after a 12-month cliff, with the buyback price and leaver tiers
            written before anyone needs them.
          </li>
          <li>
            <strong className="font-semibold text-slate-900 dark:text-slate-100">Paper it:</strong>{' '}
            five clauses — split, vesting, IP, governance, and the 83(b) covenant — signed
            before money or code moves.
          </li>
          <li>
            <strong className="font-semibold text-slate-900 dark:text-slate-100">Rehearse:</strong>{' '}
            run today&rsquo;s split through the real financing path; argue about the founders&rsquo;
            line you will actually live with.
          </li>
        </ol>
      </div>

      <h2 id="why-even">Why an even handshake is the wrong opening</h2>
      <p>
        &ldquo;Let&rsquo;s just split it {pct(50, 0)}/{pct(50, 0)}&rdquo; sounds generous and
        neutral. It is neither — it is a precise claim that two careers, two bankrolls, two
        skill stacks, and two sets of sacrificed alternatives are worth <em>exactly</em> the
        same, asserted without evidence and usually without discussion. That is why the even
        handshake fails in a characteristic way: not at signing, but at the first asymmetry.
        One founder goes full-time and the other keeps a job; one funds the company and the
        other funds nothing; one ships the product while the other stalls. Because no line
        item produced the {pct(50, 0)}/{pct(50, 0)}, there is no line item to re-open — the
        renegotiation starts from zero, with feelings instead of figures. Noam
        Wasserman&rsquo;s research on thousands of US founding teams (<em>The
        Founder&rsquo;s Dilemmas</em>) associates quick, handshake splits with materially more
        founder regret and renegotiation than splits that took the negotiation seriously;
        the pattern is correlational, but the mechanism is not mysterious.
      </p>
      <p>
        An even split also has a mechanical problem no amount of goodwill fixes: {pct(50, 0)}
        /{pct(50, 0)} between two people is a deadlock machine. Fifty-fifty voting power with
        a two-member board means either founder can freeze the company — hire, fire, raise,
        pivot — and investors pricing a seed round know it. The cure is not a distorted
        split; it is governance terms (below) that break ties. But the split itself should
        still be <em>earned</em>, because of one arithmetic fact the next section
        demonstrates: dilution is multiplicative, so the ratio you set on day one survives
        every financing untouched. There is no round in your future that fixes a wrong
        split; there is only a harder renegotiation.
      </p>
      <p>
        What a defensible process produces is often <em>near</em> even — and that is fine.
        The point of the method below is not to manufacture precision; it is to make every
        input explicit, so that when facts change you argue about a ledger line instead of
        about each other.
      </p>

      <h2 id="ledger">The four ledgers: cash, time, IP, opportunity cost</h2>
      <p>
        Replace the handshake with four accounts, weight them, and score each founder within
        each. Cash and time are ledgers of fact — dollars deposited, full-time-equivalent
        months committed. IP and opportunity cost are ledgers of judgment, but the judgment
        is negotiated <em>before</em> the number is computed, not after. The weights are the
        real negotiation: they encode what this particular company needs most. A
        capital-intensive company weights cash higher; a deep-tech company weights IP; a
        services business weights time.
      </p>
      <p>
        Here is a worked ledger for the two founders this guide follows — A the builder who
        took the bigger pay cut, B the funder who starts half-time — scored over a 24-month
        planning window with weights {pct(LEDGER_WEIGHTS.cash * 100, 0)} cash /{' '}
        {pct(LEDGER_WEIGHTS.time * 100, 0)} time / {pct(LEDGER_WEIGHTS.ip * 100, 0)} IP /{' '}
        {pct(LEDGER_WEIGHTS.opp * 100, 0)} opportunity:
      </p>
      <table>
        <thead>
          <tr>
            <th scope="col">Ledger</th>
            <th scope="col" className="text-right">Weight</th>
            <th scope="col" className="text-right">Founder A</th>
            <th scope="col" className="text-right">Founder B</th>
            <th scope="col">Inputs behind the score</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Cash in</td>
            <td className="text-right">{pct(LEDGER_WEIGHTS.cash * 100, 0)}</td>
            <td className="text-right">{pct(sub.cash.A, 1)}</td>
            <td className="text-right">{pct(sub.cash.B, 1)}</td>
            <td>{usd(L0.cashA, 0)} vs {usd(L0.cashB, 0)} deposited at founding</td>
          </tr>
          <tr>
            <td>Full-time months</td>
            <td className="text-right">{pct(LEDGER_WEIGHTS.time * 100, 0)}</td>
            <td className="text-right">{pct(sub.time.A, 1)}</td>
            <td className="text-right">{pct(sub.time.B, 1)}</td>
            <td>{L0.fteA} vs {L0.fteB} FTE months — B plans a half-time first year</td>
          </tr>
          <tr>
            <td>IP contributed</td>
            <td className="text-right">{pct(LEDGER_WEIGHTS.ip * 100, 0)}</td>
            <td className="text-right">{pct(sub.ip.A, 0)}</td>
            <td className="text-right">{pct(sub.ip.B, 0)}</td>
            <td>Negotiated scores: A brings the core technology, B the brand and plan</td>
          </tr>
          <tr>
            <td>Opportunity cost</td>
            <td className="text-right">{pct(LEDGER_WEIGHTS.opp * 100, 0)}</td>
            <td className="text-right">{pct(sub.opp.A, 1)}</td>
            <td className="text-right">{pct(sub.opp.B, 1)}</td>
            <td>Declined offers: {usdCompact(L0.oppA)} vs {usdCompact(L0.oppB)}</td>
          </tr>
          <tr>
            <td><strong>Weighted split</strong></td>
            <td className="text-right">{pct(100, 0)}</td>
            <td className="text-right"><strong>{pct(ledgerA, 1)}</strong></td>
            <td className="text-right"><strong>{pct(ledgerB, 1)}</strong></td>
            <td>The number the founders sign</td>
          </tr>
        </tbody>
      </table>
      <p>
        The ledger lands at <strong>{pct(ledgerA, 1)}/{pct(ledgerB, 1)}</strong> — about{' '}
        {pts(Math.abs(ledgerA - 50), 1)} away from the handshake split, and every point of
        the difference is traceable to an input anyone can challenge without challenging a
        person. That traceability is the entire value of the method. Notice also what the
        ledger did <em>not</em> do: it did not hand A half the company for writing code
        (time is weighted, not revered), and it did not hand B control for writing checks
        (cash is one ledger of four).
      </p>
      <h3>The adjustment window</h3>
      <p>
        A ledger scored once is a snapshot that decays. The fix is a standing window: the
        ledger is re-scored quarterly, or on named triggers — a founder changes commitment,
        a major cash injection arrives, a promised IP transfer fails — and adjustments
        settle <em>in shares</em>, inside a pre-agreed band (a common policy is a cap of a
        few points per year, documented like any other corporate action). Watch the window
        work on the example: at month 12, B has gone full-time at month six instead of the
        planned twelve, so the time ledger re-scores from {pct(sub.time.A, 1)}/
        {pct(sub.time.B, 1)} toward the new fact, and the blended split moves to{' '}
        <strong>{pct(ledgerA12, 1)}/{pct(ledgerB12, 1)}</strong> — {pts(Math.abs(ledgerShift), 2)}{' '}
        settled to B, no renegotiation from scratch. The window closes at the first priced
        round: investors will not price a cap table whose founder line is still moving, so
        the agreement should say the last re-score happens before the term sheet is signed.
      </p>

      <h2 id="vesting">Four years vested, one-year cliff — for everyone</h2>
      <p>
        Founder shares should be <em>restricted stock subject to repurchase</em>: you own the
        shares from day one (vote them, dividend them, file the 83(b) election on them), but
        the company holds the right to buy back the unvested portion at your cost if you
        leave. The market-standard schedule under NVCA-style documents is{' '}
        <strong>{VEST_MONTHS} months of monthly vesting after a {CLIFF_MONTHS}-month
        cliff</strong>: nothing vests before month {CLIFF_MONTHS}; at the cliff{' '}
        {pct(vestedPctOf(CLIFF_MONTHS), 0)} vests at once; after that, the grant vests
        monthly. Applied to this guide&rsquo;s {numFmt(GRANT_SHARES)}-share grant:
      </p>
      <table>
        <thead>
          <tr>
            <th scope="col">Departure month</th>
            <th scope="col" className="text-right">Vested</th>
            <th scope="col" className="text-right">Shares kept</th>
            <th scope="col" className="text-right">Repurchased by the company</th>
          </tr>
        </thead>
        <tbody>
          {VEST_ROWS.map((r) => (
            <tr key={r.month}>
              <td>
                Month {r.month}
                {r.month === CLIFF_MONTHS ? ' (the cliff)' : ''}
                {r.month === VEST_MONTHS ? ' (fully vested)' : ''}
              </td>
              <td className="text-right">{pct(r.vested, r.vested % 1 === 0 ? 0 : 2)}</td>
              <td className="text-right">{numFmt(r.kept)}</td>
              <td className="text-right">{numFmt(r.repurchased)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p>
        Read the two boundary rows. Walk at month {M10.month} — one month before the cliff —
        and the company repurchases <strong>all {numFmt(GRANT_SHARES)} shares</strong>: the
        cliff exists precisely to make the first year a mutual commitment device. Stay to
        month {M14.month} and you keep {pct(M14.vested, 2)} — {numFmt(M14.kept)} shares —
        while {numFmt(M14.repurchased)} go back.
      </p>
      <h3>What the buyback is worth, through the rounds</h3>
      <p>
        The schedule&rsquo;s value is easiest to price on the engine. Take the{' '}
        {pct(50, 0)}/{pct(50, 0)} pair; founder B walks at month {M14.month}. Without
        vesting, B&rsquo;s {numFmt(GRANT_SHARES)} shares ride every future round and B ends
        where the rehearsal below puts every even founder:{' '}
        <strong>{pct(leaverNoVesting, 2)}</strong> after Series C. With the standard
        schedule, the company repurchases {numFmt(leaverReturned)} shares at cost, and B
        keeps {numFmt(leaverKept)}. The founding table becomes{' '}
        {numFmt(GRANT_SHARES)} + {numFmt(leaverKept)} shares, the survivor holds{' '}
        <strong>{pct(stayerAfterBuyback, 2)}</strong> of the company the day after the
        buyback, and after the same {usdCompact(stdRaised)} of rounds the two lines land at{' '}
        <strong>{pct(stayerFinal, 2)}</strong> (stayer) versus{' '}
        <strong>{pct(leaverFinal, 2)}</strong> (leaver). The schedule clawed back{' '}
        <strong>{pts(clawbackPts, 2)}</strong> from a founder who quit in month{' '}
        {M14.month} — and every point of it went to the people still building the company
        rather than to investors.
      </p>
      <p>
        Two terms around the schedule matter as much as the schedule. The{' '}
        <strong>repurchase price</strong> for unvested shares is whatever the agreement
        says: founder-stock agreements in the NVCA mold default to repurchasing at the
        founder&rsquo;s original cost, and lower-of-cost-and-current-fair-market-value is a
        common variant — either way the number is written down, not improvised at the
        goodbye meeting. And <strong>leaver tiers</strong> distinguish departures: a
        &ldquo;bad&rdquo; leaver who quits or is fired for cause keeps only vested shares;
        a &ldquo;good&rdquo; leaver — death, disability, termination without cause — often
        has part or all of the unvested balance vest or accelerate, per the agreement.
        Vesting is not suspicion of your co-founder; it is the mechanism that lets the
        survivor&rsquo;s equity story survive the survivorship.
      </p>

      <h2 id="agreement">The founders&rsquo; agreement: five clauses that must be written</h2>
      <p>
        Verbal founder arrangements die at the first term sheet, because diligence asks for
        the paper. Five clauses cover the ground:
      </p>
      <ol>
        <li>
          <strong>The split, the ledger, and the window.</strong> The percentages, the ledgers
          and weights that produced them, and the re-scoring protocol — triggers, band,
          settlement in shares, and the closing of the window at the priced round. If the
          split was judgment, the agreement records <em>which</em> judgment, so a future
          argument has a document to be about.
        </li>
        <li>
          <strong>Vesting and the buyback.</strong> {VEST_MONTHS} months monthly after a{' '}
          {CLIFF_MONTHS}-month cliff on every founder grant; the repurchase price for
          unvested shares; the leaver tiers and what each triggers; how a deceased or
          disabled founder&rsquo;s family is treated (usually a buyback on fair terms,
          not an inheritance of a board seat). Everyone signs the same schedule — founders
          exempting themselves is the classic seed-stage red flag.
        </li>
        <li>
          <strong>IP assignment.</strong> Every founder assigns to the company all work
          related to the business — done before founding <em>and</em> during. Pre-existing
          IP the company needs is licensed or assigned by name. Contractors sign the same
          assignment. When diligence finds a gap here, the price is not a fee; it is the
          round.
        </li>
        <li>
          <strong>Governance and deadlock.</strong> Who is CEO today and how that is
          revisited; which decisions need unanimity (new founder, sale of the company,
          winding down); the tie-break mechanism when a {pct(50, 0)}/{pct(50, 0)} pair
          disagrees — mediation escalation, a named decider, or a shotgun clause, chosen
          calmly in advance. Transfer restrictions belong here too: no founder share moves
          without a right of first refusal, so an ex-spouse or a stranger never appears on
          the register.
        </li>
        <li>
          <strong>The 83(b) covenant.</strong> Every founder covenants to make the 83(b)
          election for their restricted stock, delivers a signed copy and the mailing proof
          to the company, and the company calendars the deadline — see below for why this
          clause is on the list at all.
        </li>
      </ol>
      <h3>The 83(b) election: thirty days, no second chance</h3>
      <p>
        Restricted stock is compensation property under 26 U.S.C. § 83. Without an election,
        each share is taxed to the founder <em>as it vests</em>, at its fair market value on
        that vesting date — ordinary income, at a moment when the founder cannot sell a
        single share to pay the bill. The § 83(b) election moves the measurement to the{' '}
        <strong>grant</strong>: the founder recognizes as ordinary income only the excess of
        the shares&rsquo; value at grant over the price paid. For founders buying restricted
        stock at incorporation, at a price set at or near the stock&rsquo;s nominal value,
        that excess is typically little or nothing — the tax event happens at grant, when
        the shares are cheapest, and the capital-gain holding period starts running from
        the transfer. The cost of the election is real but small: if the company fails, the
        founder has paid tax (usually nil) on value that never arrived, and capital losses
        have their own limits.
      </p>
      <p>
        The deadline is what makes this a clause rather than a tip: under Treas. Reg.{' '}
        § 1.83-2 the election must be filed within <strong>30 days of the transfer</strong>,
        counting weekends and holidays, and the regulation provides no extension and no cure
        for a late filing. Miss the window and the founder is locked into taxation at each
        vesting date for the life of the grant — for a company that works, a growing
        ordinary-income tax bill on illiquid paper, every year for four years. The
        consequences are fact-specific (value at grant, state conformity, the
        founder&rsquo;s own tax picture), which is why the agreement&rsquo;s job is the
        process, not the arithmetic: covenant, proof of filing, and a calendar, so the
        30-day window is never discovered on day 31.
      </p>

      <h2 id="dilution">Rehearse the split through the rounds</h2>
      <p>
        A founder split exists in the future only as a proportion of whatever the founders
        collectively still own — so rehearse it through a real financing path before
        signing. The engine run below is the cap table calculator&rsquo;s standard path:
        this guide&rsquo;s even pair ({numFmt(GRANT_SHARES)} shares each), a seed and three
        follow-ons raising {usd(stdRaised, 0)} in total, mainstream pool targets (
        {STD_ROUNDS.map((r) => pct(r.poolPct, 0)).join(' / ')}):
      </p>
      <table>
        <thead>
          <tr>
            <th scope="col">Ownership</th>
            {EVEN.stages.map((s) => (
              <th key={s.label} scope="col" className="text-right">
                {s.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr>
            <th scope="row">Both founders</th>
            {evenCombinedTrail.map((v, i) => (
              <td key={i} className="text-right">
                {pct(v, i === 0 ? 0 : 2)}
              </td>
            ))}
          </tr>
          <tr>
            <th scope="row">Either founder (the 50/50)</th>
            {evenTrail.map((v, i) => (
              <td key={i} className="text-right">
                {pct(v, i === 0 ? 0 : 2)}
              </td>
            ))}
          </tr>
          <tr>
            <th scope="row">Founder A of a 60/40</th>
            {SIXFOUR.stages.map((s, i) => (
              <td key={i} className="text-right">
                {pct(founderPct(s, 0), i === 0 ? 0 : 2)}
              </td>
            ))}
          </tr>
          <tr>
            <th scope="row">Founder B of a 60/40</th>
            {SIXFOUR.stages.map((s, i) => (
              <td key={i} className="text-right">
                {pct(founderPct(s, 1), i === 0 ? 0 : 2)}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
      <p>
        Two readings, one per row. The <em>combined</em> line is the price of the path:
        the fully diluted cap table grows from {numFmt(10_000_000)} founding shares to{' '}
        {numFmt(Math.round(evenFinalShares))} after Series C — nobody takes shares from
        the founders; the denominator simply grows — and the block that was everything
        ends up <strong>{pct(evenCombinedTrail[4], 2)}</strong> of it. That is
        ordinary dilution — what raising {usdCompact(stdRaised)} at these marks costs, and{' '}
        <a href="/guides/reading-your-cap-table/">the cap-table guide</a> walks its levers
        (pool size, pool placement, SAFE stacks) in detail. The <em>per-founder</em> lines
        are the equity-split lesson: each {pct(50, 0)} founder ends at{' '}
        <strong>{pct(evenEachFinal, 2)}</strong>, and the 60/40 pair ends at{' '}
        <strong>{pct(sixtyFinal, 2)}</strong> and <strong>{pct(fortyFinal, 2)}</strong>. The
        absolute gap narrows — from {pts(gapFounding, 2)} at founding to{' '}
        {pts(gapFinal, 2)} after C — but only because both numbers shrank against a bigger
        denominator. The ratio is intact to six decimals: {pct(60, 0)}/{pct(40, 0)} in,
        {pct(60, 0)}/{pct(40, 0)} out (the engine&rsquo;s quotient is{' '}
        {gapRatio.toFixed(6)}). There is no financing that quietly repairs a split you
        already know is wrong.
      </p>
      <p>
        Scale the surviving gap to see what the founding argument was actually about. At the
        Series C post-money of {usdCompact(STD_ROUNDS[3].postMoney)}, the{' '}
        {pts(gapFinal, 2)} between the 60/40 pair corresponds to{' '}
        <strong>{usdCompact(gapValueAtC)}</strong> of stake-times-valuation — an upper
        bound, since liquidation preferences and participation sit between any percentage
        and any payout. At a {usdCompact(DEFAULT_EXIT_VALUATION)} exit the same gap is{' '}
        {usdCompact(gapValueAtExit)}. The same arithmetic prices the ledger&rsquo;s
        {pts(Math.abs(ledgerA - 50), 2)} argument from the kitchen table: it ends the path
        as {pct(ledgerFinalA, 2)} versus {pct(ledgerFinalB, 2)} — a smaller number of
        points over a much more valuable denominator, and exactly the same proportion.
      </p>
      <h3>What dilutes the split, and what cannot</h3>
      <p>
        Financing dilutes both founders identically and never touches the ratio — which also
        means the split can only move when founder shares themselves are issued or
        repurchased: the ledger&rsquo;s adjustment window, or the vesting buyback. The SAFE
        side of the rehearsal makes the point with the SAFE calculator&rsquo;s standard
        note: {usdCompact(500_000)} at a {usdCompact(10_000_000)} cap with{' '}
        {pct(20, 0)} off claims <strong>{pct(safePrePct, 2)}</strong> of the pre-round
        table the day it is signed; converting in a {usdCompact(3_000_000)} round at{' '}
        {usdCompact(15_000_000)} pre over {numFmt(10_000_000)} existing shares, it takes
        the founding pair from {pct(foundersNoStack, 2)} to{' '}
        {pct(foundersWithStack, 2)} — {pts(stackCostPts, 2)} combined,{' '}
        {pts(eachStackCost, 2)} each, with both founders landing on{' '}
        {pct(eachAfterStack, 2)} of the closed table and the 50/50 intact. The note
        cannot take from one founder and spare the other; only the founders&rsquo; own
        paper can do that. Which is the last reason the agreement comes first: it is the
        only document on this path that decides the ratio.
      </p>

      <h2 id="protocol">The signing protocol, and the honest limits</h2>
      <ol>
        <li>
          <strong>Run the ledger before anyone quits anything.</strong> Four accounts,
          written weights, written scores — {pct(LEDGER_WEIGHTS.cash * 100, 0)}/
          {pct(LEDGER_WEIGHTS.time * 100, 0)}/{pct(LEDGER_WEIGHTS.ip * 100, 0)}/
          {pct(LEDGER_WEIGHTS.opp * 100, 0)} is one honest weighting, not a law.
        </li>
        <li>
          <strong>Open the adjustment window with a band.</strong> Triggers named, re-scores
          quarterly, settlement in shares, a few points a year at most — and the window
          closes before the first priced round.
        </li>
        <li>
          <strong>Vest everyone identically.</strong> {VEST_MONTHS} months,{' '}
          {CLIFF_MONTHS}-month cliff, repurchase price and leaver tiers written. If a
          founder&rsquo;s shares are exempt from vesting, ask why theirs and not yours.
        </li>
        <li>
          <strong>Sign the five clauses before the first dollar or commit.</strong> Split
          and window; vesting and buyback; IP assignment; governance, deadlock, and transfer
          restrictions; the 83(b) covenant with proof of filing.
        </li>
        <li>
          <strong>File the 83(b) elections inside the window.</strong> Thirty days from the
          transfer, no extension, no cure — the one deadline in founder equity that never
          forgives.
        </li>
        <li>
          <strong>Rehearse before you sign the term sheet.</strong> Run today&rsquo;s split
          through the real rounds with the{' '}
          <a href="/cap-table-dilution-calculator/">
            cap table calculator
          </a>
          , and any SAFE stack with the{' '}
          <a href="/safe-note-calculator/">
            SAFE note calculator
          </a>
          , so the argument you settle is about the founders&rsquo; line you will actually
          live with.
        </li>
      </ol>
      <p>
        And the limits, stated plainly. The engines price ownership, not proceeds —
        preferences, participation, and debt sit between every percentage here and any
        payout, so treat stake times valuation as a ceiling. The cap table model walks
        priced rounds and the SAFE model the YC post-money form; pre-money SAFEs,
        convertible notes, and side letters compute against different denominators and need
        document-level math. Vesting specifics — acceleration, leaver tiers, buyback price
        floors — are contract terms whose market varies by jurisdiction and counsel, and
        the 83(b) consequences depend on facts (value at grant, state rules, your own
        return) this guide deliberately keeps qualitative. None of that softens the
        framework: score the split, vest it, paper it, file on time, rehearse it — in that
        order, before the money arrives.
      </p>
    </>
  );
}

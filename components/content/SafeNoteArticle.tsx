import type { ReactNode } from 'react';
import Faq from '@/components/Faq';
import { ArticleToc, RelatedCalculators } from '@/components/Article';
import {
  SAFE_PRESETS,
  classifySafeStack,
  convertSafeStack,
  crossoverPreMoney,
  type RoundTerms,
  type SafeTerms,
} from '@/lib/safe';
import { numFmt, pct, usd, usdCompact } from '@/lib/format';

/** Ownership deltas are percentage POINTS, never "%": 0.82pp ≠ 0.82%. */
const pts = (v: number, d = 2) => `${v.toFixed(d)} points`;

/* All prose numbers below are computed at build time by the same library that
   powers the widget — nothing is hand-typed, so the guide can never drift from
   the calculator. */

const Z: SafeTerms = { amount: 0, cap: 0, discountPct: 0 };
const N = 10_000_000;

// The canonical deal (the tool's default preset): 10M shares; one $500k SAFE
// on a $10M post-money cap with 20% off; Series A $3M at $15M pre.
const CANON_SAFE: SafeTerms = { amount: 500_000, cap: 10_000_000, discountPct: 20 };
const CANON_ROUND: RoundTerms = { investment: 3_000_000, preMoney: 15_000_000 };
const CANON = convertSafeStack([CANON_SAFE, Z, Z], CANON_ROUND, N);
const KINK = crossoverPreMoney(CANON_SAFE)!; // $12.5M — where cap and discount tie

// The same canonical SAFE at a ladder of round valuations, for the
// which-term-binds table and the crossover discussion.
const LADDER: { pre: number; note: string }[] = [
  { pre: 8_000_000, note: 'Round below the cap' },
  { pre: 11_000_000, note: 'Still under the crossover' },
  { pre: KINK, note: 'Exactly cap ÷ rate — the terms tie' },
  { pre: 15_000_000, note: 'The default scenario' },
  { pre: 30_000_000, note: 'Triple the cap' },
];
const LADDER_ROWS = LADDER.map(({ pre, note }) => ({
  pre,
  note,
  r: convertSafeStack([CANON_SAFE, Z, Z], { investment: 3_000_000, preMoney: pre }, N),
}));

// A cap-only SAFE in a round priced below its cap converts ABOVE the round price.
const CAPO = convertSafeStack(
  [{ amount: 500_000, cap: 10_000_000, discountPct: 0 }, Z, Z],
  { investment: 3_000_000, preMoney: 8_000_000 },
  N,
);

// An uncapped, no-discount (MFN-style) SAFE — converts at the round price itself.
const MFN = convertSafeStack([{ amount: 1_000_000, cap: 0, discountPct: 0 }, Z, Z], CANON_ROUND, N);

// Preset stacks.
const STACKED = convertSafeStack(SAFE_PRESETS[2].safes, SAFE_PRESETS[2].round, SAFE_PRESETS[2].shares);
const HEAVY = convertSafeStack(SAFE_PRESETS[3].safes, SAFE_PRESETS[3].round, SAFE_PRESETS[3].shares);
const stackedActive = STACKED.safes.filter((o) => o.binding !== 'inactive');

// Decision-boundary scan 1 — feasibility: identical $500k SAFEs at a $5M cap
// each claim 10% of the pre-round table; the tenth SAFE crosses 100%.
const nineOk = convertSafeStack(
  Array.from({ length: 9 }, () => ({ amount: 500_000, cap: 5_000_000, discountPct: 0 })),
  CANON_ROUND,
  N,
);
const tenBad = classifySafeStack(
  Array.from({ length: 10 }, () => ({ amount: 500_000, cap: 5_000_000, discountPct: 0 })),
  CANON_ROUND,
  N,
);

// Decision-boundary scan 2 — the majority line: k × $500k SAFEs at $8M caps
// with 20% off, canonical round. Each claims 6.25% of the pre-round table.
const K_ROWS = Array.from({ length: 8 }, (_, i) => {
  const k = i + 1;
  const r = convertSafeStack(
    Array.from({ length: k }, () => ({ amount: 500_000, cap: 8_000_000, discountPct: 20 })),
    CANON_ROUND,
    N,
  );
  return { k, founders: r.foundersPctAfter, stackPre: r.stackPctOfPreRound };
});
const majorityLostAtK = K_ROWS.find((row) => row.founders <= 50)?.k ?? null;
const lastMajorityK = majorityLostAtK !== null ? majorityLostAtK - 1 : null;
const lastMajority = lastMajorityK !== null ? K_ROWS[lastMajorityK - 1] : null;

// Decision-boundary scan 3 — the crossover valley: the canonical SAFE's
// post-round ownership at the kink versus its two flanks, plus its ceiling.
const valleyAt = LADDER_ROWS[2].r.stackPctAfter;
const valleyLeft = LADDER_ROWS[1].r.stackPctAfter;
const valleyRight = LADDER_ROWS[4].r.stackPctAfter;

// Infeasible trio for the FAQ: 0.4 + 0.5 + 0.25 = 1.15 of the pre-round table.
const BAD_TRIO = classifySafeStack(
  [
    { amount: 2_000_000, cap: 5_000_000, discountPct: 0 },
    { amount: 3_000_000, cap: 6_000_000, discountPct: 0 },
    { amount: 1_000_000, cap: 4_000_000, discountPct: 0 },
  ],
  CANON_ROUND,
  N,
);

// Glossary — first-pass definitions; every figure comes from the consts above.
const GLOSSARY: [string, ReactNode][] = [
  [
    'SAFE',
    <>
      Simple Agreement for Future Equity: cash today for the right to shares at the next priced
      round. No interest, no maturity, no valuation of the company today — the price question is
      deferred until someone else names one.
    </>,
  ],
  [
    'Post-money SAFE',
    <>
      The YC standard since 2018. The SAFE converts into a fixed share of the capitalization
      <em> immediately before</em> the round — including the other SAFEs — so a capped SAFE&apos;s{' '}
      {pct(CANON.stackPctOfPreRound, 0)} here is locked the day it is signed.
    </>,
  ],
  [
    'Valuation cap',
    <>
      The number the SAFE&apos;s dollars divide against in an up round:{' '}
      <code>SAFE price = cap ÷ Company Capitalization</code>. Ours is{' '}
      {usdCompact(CANON_SAFE.cap)}; it produced a {usd(CANON.safes[0].safePrice, 2)} price against a{' '}
      {usd(CANON.roundPrice, 2)} round.
    </>,
  ],
  [
    'Discount rate',
    <>
      The share of the round price the SAFE pays. &ldquo;A 20% discount&rdquo; is a rate of 0.80:{' '}
      <code>price = 0.80 × round price</code>. When it binds, the effective discount is exactly the
      stated one — see the {usdCompact(11_000_000)} row of the term table.
    </>,
  ],
  [
    'Company Capitalization',
    <>
      The fully diluted count immediately prior to the round: outstanding shares, granted and
      promised options (signed offers count), the reserved pool as it stands, and every converting
      SAFE — new investor shares excluded, and any pool increase adopted in connection with the
      round excluded too, per the form. It is the denominator of every price this tool prints ({' '}
      {numFmt(Math.round(CANON.companyCapitalization))} in the canonical deal).
    </>,
  ],
  [
    'Equity Financing',
    <>
      The form&rsquo;s term for the priced round that triggers conversion — no minimum size: YC&rsquo;s
      documents-page FAQ states plainly that &ldquo;there is no threshold amount of money in the
      post-money SAFE that your company needs to raise to trigger the conversion.&rdquo; (Note
      lawyers borrow &ldquo;qualified financing&rdquo; from the convertible-note world; the SAFE
      form&rsquo;s own word is Equity Financing.) This model converts the stack at exactly one such
      round; nothing before it, nothing after.
    </>,
  ],
  [
    'Converting securities',
    <>
      SAFEs, convertible notes, and anything else that turns into stock at the round. All of them
      count inside Company Capitalization — a stack of notes alongside these SAFEs would widen the
      same denominator.
    </>,
  ],
  [
    'MFN',
    <>
      Most-favored-nation clause: an uncapped SAFE with no discount converts at the round price
      ({pct(MFN.stackPctOfPreRound, 2)} of the pre-round table for our {usdCompact(1_000_000)}{' '}
      example) unless a later SAFE gets better terms, which it can then elect.
    </>,
  ],
  [
    'Pro-rata rights',
    <>
      A side-letter right to buy into the next round and hold your percentage. Granted to SAFE
      holders by negotiation, not by the standard form — outside this model.
    </>,
  ],
  [
    'Deferred dilution',
    <>
      The stack&apos;s cost is real from signing but invisible on the issued-share ledger until the
      round lands it all at once. The heavy preset moves existing holders from{' '}
      {pct(HEAVY.foundersPctNoSafes, 1)} to {pct(HEAVY.foundersPctAfter, 1)} on closing day.
    </>,
  ],
];

export default function SafeNoteArticle() {
  const toc = [
    { id: 'mechanics', label: 'What a post-money SAFE is' },
    { id: 'deferred', label: 'The dilution-deferral trap' },
    { id: 'cap-vs-discount', label: 'Cap vs discount: which binds' },
    { id: 'worked', label: 'A worked conversion' },
    { id: 'stacking', label: 'Stacking multiple SAFEs' },
    { id: 'safe-vs-priced', label: 'SAFEs vs priced rounds' },
    { id: 'limits', label: 'What this model leaves out' },
    { id: 'boundaries', label: 'Decision boundaries' },
    { id: 'caveats', label: 'Important caveats' },
    { id: 'glossary', label: 'Glossary' },
    { id: 'faq', label: 'FAQ' },
  ];

  return (
    <article className="prose-article">
      <ArticleToc items={toc} />

      <h2 id="mechanics">What a post-money SAFE is, mechanically</h2>
      <p>
        A SAFE trades cash now for shares later — but &ldquo;later&rdquo; is not a date, it is an
        event: the next priced round. The moment that round is signed, every SAFE on the stack
        converts, at a price the SAFE itself determines. For the YC post-money form this page
        models, the mechanics are four sentences:
      </p>
      <ol>
        <li>
          <strong>The round names a price.</strong> Our canonical deal:{' '}
          {usd(CANON_ROUND.investment, 0)} of new money at a {usd(CANON_ROUND.preMoney, 0)}{' '}
          pre-money, with {numFmt(N)} existing fully diluted shares.
        </li>
        <li>
          <strong>Each SAFE computes its own conversion price</strong> as the <em>lower</em> of{' '}
          <code>cap ÷ Company Capitalization</code> and{' '}
          <code>rate × round price</code> — the holder elects whichever pays more shares. In the
          canonical deal that is {usd(CANON.safes[0].safePrice, 2)} per share against the{' '}
          {usd(CANON.roundPrice, 2)} the investor pays.
        </li>
        <li>
          <strong>Company Capitalization counts every converting SAFE.</strong> It is the whole
          pre-round table — {numFmt(Math.round(CANON.companyCapitalization))} shares here, not the{' '}
          {numFmt(N)} on the ledger — because the SAFEs convert <em>immediately prior</em> to the
          round.
        </li>
        <li>
          <strong>Then the round dilutes everyone in that table pro-rata.</strong> The investor ends
          at {pct(CANON.investorPctAfter, 2)} ({usdCompact(CANON_ROUND.investment)} ÷{' '}
          {usdCompact(CANON_ROUND.preMoney + CANON_ROUND.investment)} post), the SAFE stack at{' '}
          {pct(CANON.stackPctAfter, 2)}, existing holders at {pct(CANON.foundersPctAfter, 2)}.
        </li>
      </ol>
      <p>
        That is the entire instrument. The famous property of the post-money design falls out of
        sentence 3: a capped SAFE owns{' '}
        <code>amount ÷ cap = {usdCompact(CANON_SAFE.amount)} ÷ {usdCompact(CANON_SAFE.cap)}</code> ={' '}
        <strong>{pct(CANON.stackPctOfPreRound, 0)}</strong> of the pre-round table — a number fixed
        on the day the SAFE is signed, whatever the round later turns out to be. Everything else in
        this guide is what that sentence does to founders who read only their issued-share ledger.
      </p>

      <h2 id="deferred">The trap: dilution is deferred, not avoided</h2>
      <p>
        Sign the canonical SAFE today and your cap table still says 100% founder-owned. Nothing
        issued, nothing filed — the {pct(CANON.stackPctOfPreRound, 0)} is a contract, not a share
        count. When the Series A closes, the entire claim lands at once: existing holders walk out
        at {pct(CANON.foundersPctAfter, 2)} instead of the {pct(CANON.foundersPctNoSafes, 2)} the
        same round would have left them with —{' '}
        <strong>{pts(CANON.foundersExtraDilutionPts, 2)}</strong> of ownership handed to the SAFE
        stack, on a day whose term sheet never mentions it.
      </p>
      <p>
        The honest way to read a cap table with SAFEs on it: your <em>effective</em> ownership today
        is existing shares ÷ Company Capitalization, not ÷ issued shares. The tool computes this
        number live. On the heavy preset — {usdCompact(4_500_000)} across three SAFEs at{' '}
        {usdCompact(6_000_000)}/{usdCompact(10_000_000)}/{usdCompact(14_000_000)} caps — the stack
        claims {pct(HEAVY.stackPctOfPreRound, 2)} of the pre-round table before the round even
        prices. Founders who think they are negotiating their Series A from 100% are negotiating it
        from {pct(100 - HEAVY.stackPctOfPreRound, 2)}. When the {usdCompact(8_000_000)} round at{' '}
        {usdCompact(30_000_000)} pre closes, they land at {pct(HEAVY.foundersPctAfter, 1)} — against{' '}
        {pct(HEAVY.foundersPctNoSafes, 1)} for the identical round with no stack:{' '}
        {pts(HEAVY.foundersExtraDilutionPts, 1)} gone.
      </p>
      <p>
        Two properties make the post-money form sharper than its pre-2018 predecessor at this.
        First, the claim is fixed at signing — it does not depend on how big the round gets, so{' '}
        &ldquo;we&apos;ll dilute later anyway&rdquo; is not a hedge. Second, SAFEs do not dilute each
        other: each one&apos;s percentage is computed against a capitalization that already includes
        all the others, so every incremental SAFE takes its full claim out of the common holders and
        none out of the earlier SAFEs. Stacking is additive — for you.
      </p>

      <h2 id="cap-vs-discount">Cap vs discount: which one binds, exactly</h2>
      <p>
        A SAFE carrying both terms never gets cap-then-discount or some chained combination — it
        gets the <strong>lower of the two candidate prices</strong>, computed independently at the
        round. Because both prices have the form <code>m ÷ Company Capitalization</code>, comparing
        them is comparing {usdCompact(CANON_SAFE.cap)} against{' '}
        <code>0.80 × pre-money</code>. They tie at exactly{' '}
        <code>cap ÷ rate</code> — <strong>{usdCompact(KINK)}</strong> here — and that single number
        splits the world:
      </p>
      <ul>
        <li>
          <strong>Round priced below {usdCompact(KINK)}</strong> — the discount binds. The SAFE pays
          80% of a round price that is already below its cap, and its ownership{' '}
          <em>shrinks as the round valuation rises</em>, because a fixed dollar claim buys fewer
          shares of an ever-cheaper round.
        </li>
        <li>
          <strong>Round priced above {usdCompact(KINK)}</strong> — the cap binds. The SAFE&apos;s
          price is pinned at {usd(CANON.safes[0].safePrice, 2)} no matter how rich the round, and its
          ownership climbs back toward the {pct(CANON.stackPctOfPreRound, 0)} ceiling as round
          dilution thins.
        </li>
      </ul>
      <table>
        <thead>
          <tr>
            <th scope="col">Series A pre-money</th>
            <th scope="col" className="text-right">Term that binds</th>
            <th scope="col" className="text-right">SAFE price</th>
            <th scope="col" className="text-right">Round price</th>
            <th scope="col" className="text-right">Effective discount</th>
            <th scope="col" className="text-right">SAFE after round</th>
          </tr>
        </thead>
        <tbody>
          {LADDER_ROWS.map(({ pre, note, r }) => (
            <tr key={pre}>
              <th scope="row">
                {usdCompact(pre)}
                <span className="block font-normal text-slate-500 dark:text-slate-400">{note}</span>
              </th>
              <td className="text-right capitalize">{r.safes[0].binding === 'round-price' ? 'Round price' : r.safes[0].binding}</td>
              <td className="text-right">{usd(r.safes[0].safePrice, 4)}</td>
              <td className="text-right">{usd(r.roundPrice, 4)}</td>
              <td className="text-right">
                {r.safes[0].effectiveDiscountPct >= 0
                  ? pct(r.safes[0].effectiveDiscountPct, 1)
                  : `+${pct(-r.safes[0].effectiveDiscountPct, 1)} premium`}
              </td>
              <td className="text-right">{pct(r.stackPctAfter, 2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p>
        Three readings of that table. At {usdCompact(11_000_000)} the effective discount is exactly
        the stated 20% — when the discount binds, it binds literally. At{' '}
        {usdCompact(CANON_ROUND.preMoney)} the cap binds and the same instrument quietly becomes a{' '}
        {pct(CANON.safes[0].effectiveDiscountPct, 1)} discount — the cap is doing the work, and it
        deepens without limit as the round gets richer ({pct(LADDER_ROWS[4].r.safes[0].effectiveDiscountPct, 1)}{' '}
        at {usdCompact(30_000_000)}). And the SAFE holder&apos;s worst outcome is not the down round
        — it is a round priced exactly <em>at</em> the crossover, where the post-round stake bottoms
        out at {pct(valleyAt, 2)} ({pct(valleyLeft, 2)} one flank below at{' '}
        {usdCompact(11_000_000)}, {pct(valleyRight, 2)} far above at {usdCompact(30_000_000)}). The
        sensitivity chart in the tool shows this valley directly.
      </p>
      <p>
        One more asymmetry the table cannot show but the tool flags: a cap-only SAFE in a round
        priced <em>below</em> its cap converts above the round price. Drop the discount from the
        canonical SAFE and run it at {usdCompact(8_000_000)} pre: the SAFE pays{' '}
        {usd(CAPO.safes[0].safePrice, 2)} for shares the investor bought at{' '}
        {usd(CAPO.roundPrice, 2)} — a {pct(-CAPO.safes[0].effectiveDiscountPct, 0)}{' '}
        <em>premium</em>. The cap is a ceiling on the SAFE&apos;s price, not a floor; the discount
        term is what stops a capped SAFE from overpaying in a down round.
      </p>

      <h2 id="worked">A worked conversion, line by line</h2>
      <p>
        The canonical deal, derived the way the engine derives it — checkable by hand against the
        widget at the same inputs ({numFmt(N)} shares; {usd(CANON_SAFE.amount, 0)} SAFE at a{' '}
        {usd(CANON_SAFE.cap / 1_000_000, 0)}M cap with 20% off; {usd(CANON_ROUND.investment, 0)} at{' '}
        {usd(CANON_ROUND.preMoney, 0)} pre).
      </p>
      <ol>
        <li>
          <strong>Which term binds?</strong> Compare the two candidate divisors:{' '}
          <code>min(cap, 0.80 × pre) = min({usdCompact(CANON_SAFE.cap)}, {usdCompact(0.8 * CANON_ROUND.preMoney)})</code>{' '}
          = <strong>{usdCompact(CANON.safes[0].effectiveCap)}</strong> — the cap, since{' '}
          {usdCompact(CANON_ROUND.preMoney)} sits above the {usdCompact(KINK)} crossover.
        </li>
        <li>
          <strong>The SAFE&apos;s fixed claim.</strong>{' '}
          <code>{usdCompact(CANON_SAFE.amount)} ÷ {usdCompact(CANON.safes[0].effectiveCap)}</code> ={' '}
          <strong>{pct(CANON.stackPctOfPreRound, 2)}</strong> of the pre-round table — known the day
          the SAFE was signed.
        </li>
        <li>
          <strong>Solve Company Capitalization.</strong> The {numFmt(N)} existing shares must fill{' '}
          <code>1 − {pct(CANON.stackPctOfPreRound, 2)}</code> of the table:{' '}
          <code>{numFmt(N)} ÷ {((1 - CANON.stackPctOfPreRound / 100)).toFixed(4)}</code> ={' '}
          <strong>{numFmt(Math.round(CANON.companyCapitalization))} shares</strong>.
        </li>
        <li>
          <strong>Price everything.</strong> SAFE price{' '}
          <code>{usdCompact(CANON.safes[0].effectiveCap)} ÷ {numFmt(Math.round(CANON.companyCapitalization))}</code>{' '}
          = <strong>{usd(CANON.safes[0].safePrice, 4)}</strong>; round price{' '}
          <code>{usdCompact(CANON_ROUND.preMoney)} ÷ {numFmt(Math.round(CANON.companyCapitalization))}</code>{' '}
          = <strong>{usd(CANON.roundPrice, 4)}</strong>. The SAFE converts{' '}
          {pct(CANON.safes[0].effectiveDiscountPct, 1)} below the round — the cap&apos;s doing, not
          the stated 20%.
        </li>
        <li>
          <strong>Issue shares, then dilute.</strong> The SAFE takes{' '}
          <code>{usdCompact(CANON_SAFE.amount)} ÷ {usd(CANON.safes[0].safePrice, 4)}</code> ={' '}
          {numFmt(Math.round(CANON.safes[0].shares))} shares; the investor{' '}
          <code>{usdCompact(CANON_ROUND.investment)} ÷ {usd(CANON.roundPrice, 4)}</code> ={' '}
          {numFmt(Math.round(CANON.investorShares))} shares; the table closes at{' '}
          <strong>{numFmt(Math.round(CANON.totalSharesAfter))}</strong> fully diluted.
        </li>
      </ol>
      <table>
        <thead>
          <tr>
            <th scope="col">Holder</th>
            <th scope="col" className="text-right">Shares</th>
            <th scope="col" className="text-right">Ownership</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Existing holders</td>
            <td className="text-right">{numFmt(N)}</td>
            <td className="text-right">{pct(CANON.foundersPctAfter, 2)}</td>
          </tr>
          <tr>
            <td>SAFE (converted)</td>
            <td className="text-right">{numFmt(Math.round(CANON.safes[0].shares))}</td>
            <td className="text-right">{pct(CANON.stackPctAfter, 2)}</td>
          </tr>
          <tr>
            <td>Series A investor</td>
            <td className="text-right">{numFmt(Math.round(CANON.investorShares))}</td>
            <td className="text-right">{pct(CANON.investorPctAfter, 2)}</td>
          </tr>
          <tr>
            <td>
              <strong>Fully diluted total</strong>
            </td>
            <td className="text-right">
              <strong>{numFmt(Math.round(CANON.totalSharesAfter))}</strong>
            </td>
            <td className="text-right">
              <strong>100%</strong>
            </td>
          </tr>
        </tbody>
      </table>
      <p>
        <strong>Conclusion.</strong> The SAFE entered the day owning{' '}
        {pct(CANON.stackPctOfPreRound, 2)} of the pre-round table and exits the round owning{' '}
        {pct(CANON.stackPctAfter, 2)} — diluted by the round exactly like everyone else in that
        table, by the factor{' '}
        <code>pre ÷ post = {usdCompact(CANON_ROUND.preMoney)} ÷ {usdCompact(CANON_ROUND.preMoney + CANON_ROUND.investment)}</code>.{' '}
        Existing holders bear {pts(CANON.foundersExtraDilutionPts, 2)} versus the same round with no
        stack; the investor is untouched at {pct(CANON.investorPctAfter, 2)}, as the round&apos;s own
        arithmetic dictates.
      </p>

      <h2 id="stacking">Stacking SAFEs: additive by design</h2>
      <p>
        Run the two-SAFE preset: {usdCompact(500_000)} at an {usdCompact(8_000_000)} cap and{' '}
        {usdCompact(1_000_000)} at a {usdCompact(16_000_000)} cap, both 15% off, at the canonical{' '}
        {usdCompact(3_000_000)}/{usdCompact(15_000_000)} round. The two instruments bind on{' '}
        <em>different</em> terms — that is the point of the example:
      </p>
      <ul>
        <li>
          SAFE 1: <code>min({usdCompact(8_000_000)}, 0.85 × {usdCompact(15_000_000)} = {usdCompact(12_750_000)})</code>{' '}
          → the cap binds. It claims {usdCompact(500_000)} ÷ {usdCompact(8_000_000)} ={' '}
          {pct(stackedActive[0].pctOfPreRound, 2)} of the pre-round table, at{' '}
          {usd(stackedActive[0].safePrice, 4)} per share.
        </li>
        <li>
          SAFE 2: <code>min({usdCompact(16_000_000)}, {usdCompact(12_750_000)})</code> → the discount
          binds. It claims {pct(stackedActive[1].pctOfPreRound, 2)} at{' '}
          {usd(stackedActive[1].safePrice, 4)} — exactly 85% of the {usd(STACKED.roundPrice, 4)}{' '}
          round price.
        </li>
      </ul>
      <p>
        Together: {pct(STACKED.stackPctOfPreRound, 2)} of the pre-round table,{' '}
        {pct(STACKED.stackPctAfter, 2)} after the round, and existing holders at{' '}
        {pct(STACKED.foundersPctAfter, 2)} instead of {pct(STACKED.foundersPctNoSafes, 2)} —{' '}
        {pts(STACKED.foundersExtraDilutionPts, 2)}. Notice what did <em>not</em> happen: SAFE 2
        claiming {pct(stackedActive[1].pctOfPreRound, 2)} did not shrink SAFE 1&apos;s{' '}
        {pct(stackedActive[0].pctOfPreRound, 2)}. Each percentage was struck against a
        capitalization that already contained the other. This is the post-money form&apos;s central
        bargain: investor-side certainty (your {pct(stackedActive[0].pctOfPreRound, 2)} is
        locked) bought with founder-side additivity (every new SAFE costs the common holders its
        full claim). The pre-2018 pre-money form diluted the SAFEs against each other in a tangled
        order-dependent way; the post-money form moved that entire cost onto one side of the table.
      </p>
      <p>
        The stack also has a hard ceiling: the claims must sum below 100% of the pre-round table
        before any round can close. The tool flags it; the boundary scan below prices it.
      </p>

      <h2 id="safe-vs-priced">SAFEs and registered rounds: the division of labor</h2>
      <p>
        This instrument converts SAFEs; its sibling{' '}
        <a href="/cap-table-dilution-calculator/">Cap Table &amp; Dilution Calculator</a> walks
        registered shares through priced rounds. The two meet at the exact moment this page models:
        SAFEs convert <em>immediately prior</em> to the priced round, so the priced round&apos;s
        pre-money is struck over the post-conversion table. Practical consequences:
      </p>
      <ul>
        <li>
          <strong>No price exists until the round.</strong> A SAFE is not equity — nothing is
          issued, no 409A valuation attaches to it, no per-share price appears on any ledger. That
          is precisely why its dilution is invisible until conversion.
        </li>
        <li>
          <strong>The pre-money convention matters.</strong> This model reads the term sheet the
          standard way: pre-money applies to the table <em>after</em> SAFE conversion. If your
          investor quotes pre-money &ldquo;before the SAFEs&rdquo;, the same documents produce a
          different split — a drafting point worth one explicit sentence in the term sheet.
        </li>
        <li>
          <strong>Converted SAFEs become round shares.</strong> The YC form converts into the same
          series the new money buys, with that series&apos; per-share preference. The percentage
          this tool prints is therefore an ownership number, not a proceeds number once preferences
          enter at exit — the cap table guide covers that waterfall.
        </li>
        <li>
          <strong>Pools behave differently.</strong> A priced round creates its option pool inside
          the pre-money (the shuffle the sibling tool models); the SAFE form instead{' '}
          <em>excludes</em> any pool increase adopted in connection with the round from Company
          Capitalization — the cap is &ldquo;post&rdquo; the existing pool, &ldquo;pre&rdquo; the
          round&apos;s new one. So entering today&apos;s pool is not a simplification; it is what
          the form does. What the form does <em>not</em> spare you: after conversion, that new pool
          dilutes everyone, SAFEs included — a step this model stops short of simulating.
        </li>
      </ul>

      <h2 id="limits">What this model deliberately leaves out</h2>
      <ul>
        <li>
          <strong>Pre-money SAFEs (pre-2018 form).</strong> Their conversion divides against a
          capitalization excluding other converting securities; mixed stacks need document-level
          math. Post-money form only, stated on the tin.
        </li>
        <li>
          <strong>Conversion at dissolution, change of control, or IPO.</strong> The form contains
          those provisions; they follow waterfall logic (who gets paid before whom) that
          percentage arithmetic cannot express. Priced Equity Financing only — and per YC&apos;s
          documents-page FAQ, there is no threshold amount that must be raised to trigger
          conversion.
        </li>
        <li>
          <strong>Option pools adopted in connection with the round.</strong> Excluded from Company
          Capitalization by the form itself, so entering today&apos;s fully diluted count matches
          the form exactly. What is not modeled is the step after: the new pool diluting everyone
          — SAFEs included — once conversion has happened. Size that pool with the{' '}
          <a href="/cap-table-dilution-calculator/">sibling tool</a>.
        </li>
        <li>
          <strong>Side letters.</strong> Pro-rata rights, MFN elections after signing, direct
          listings of secondary terms — negotiated individually, invisible to a model of the
          standard form.
        </li>
        <li>
          <strong>Share rounding.</strong> Real closings round to whole shares per the documents;
          fractional share counts are displayed exactly here.
        </li>
        <li>
          <strong>Liquidation preferences at exit.</strong> Converted SAFEs carry the round
          series&apos; preference; ownership percentage is not proceeds. Out of scope, flagged
          wherever an exit value could be implied.
        </li>
      </ul>

      <h2 id="boundaries">Decision boundaries</h2>
      <p>
        Three thresholds, each a scan over the same library the widget runs — reproducible from the
        inputs stated, never hand-typed.
      </p>
      <ol>
        <li>
          <strong>Feasibility: the stack must leave room for the company.</strong> Each capped SAFE
          claims <code>amount ÷ effective cap</code> of the pre-round table; the sum must stay under
          100%. Nine {usdCompact(500_000)} SAFEs at a {usdCompact(5_000_000)} cap claim 90% and
          still close ({pct(nineOk.foundersPctAfter, 2)} left for founders after the canonical
          round); the tenth hits 100% and the round cannot exist — the tool reports{' '}
          &ldquo;{tenBad.reason}&rdquo;. Near the boundary, a higher cap on the last check or a
          smaller amount is not a negotiation outcome; it is the difference between a round and no
          round.
        </li>
        <li>
          <strong>The majority line, priced in SAFEs.</strong> Stack {usdCompact(500_000)} SAFEs at
          an {usdCompact(8_000_000)} cap with 20% off at the canonical round — each takes 6.25% of
          the pre-round table:
          <table>
            <thead>
              <tr>
                <th scope="col">SAFEs on the stack</th>
                <th scope="col" className="text-right">Stack, pre-round</th>
                <th scope="col" className="text-right">Founders after</th>
              </tr>
            </thead>
            <tbody>
              {K_ROWS.map((row) => (
                <tr key={row.k}>
                  <th scope="row">
                    {row.k}
                    {majorityLostAtK === row.k && (
                      <span className="ml-2 font-normal text-rose-600 dark:text-rose-400">
                        majority gone
                      </span>
                    )}
                  </th>
                  <td className="text-right">{pct(row.stackPre, 2)}</td>
                  <td className="text-right">{pct(row.founders, 2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {lastMajority && majorityLostAtK !== null ? (
            <>
              Through {lastMajorityK} SAFEs founders stay above water at{' '}
              {pct(lastMajority.founders, 2)}; at {majorityLostAtK} they dip to{' '}
              {pct(K_ROWS[majorityLostAtK - 1].founders, 2)}. Note the asymmetry with boundary 1:
              feasibility would tolerate sixteen of these SAFEs (16 × 6.25% = 100%), but majority
              dies at {majorityLostAtK} — control is the binding constraint long before arithmetic
              is.
            </>
          ) : null}
        </li>
        <li>
          <strong>The crossover valley.</strong> The canonical SAFE&apos;s post-round ownership
          bottoms out where its two terms tie — {usdCompact(KINK)} pre — at{' '}
          {pct(valleyAt, 2)}, and rises on both flanks ({pct(valleyLeft, 2)} at{' '}
          {usdCompact(11_000_000)}, {pct(valleyRight, 2)} at {usdCompact(30_000_000)}, ceiling{' '}
          {pct(CANON.stackPctOfPreRound, 2)} as round dilution vanishes). If you are raising on
          SAFEs, the cap you set today determines whose valley your next round lands in; if you are
          signing one, the valley — not the down round — is your worst case.
        </li>
      </ol>

      <h2 id="caveats">Important caveats</h2>
      <ul>
        <li>
          Post-money SAFE form (YC standard) only; the tool does not price convertible notes
          (interest, maturity, different conversion) or pre-2018 pre-money SAFEs.
        </li>
        <li>
          The pre-money input is struck after conversion — the standard reading. Term sheets that
          quote pre-money before the SAFE stack produce different splits from identical documents.
        </li>
        <li>
          Existing shares should be the full pre-round count as the form defines it: common, granted
          options, <em>promised</em> options (signed offers count — a company with a batch of open
          offers must include them or it understates the capitalization and overstates the SAFE
          price), and the current unallocated pool. A pool increase tied to this round is excluded
          by the form and is a real cost the model deliberately does not hide inside a default.
        </li>
        <li>
          Share counts are exact fractions; closings round per the documents. Differences are far
          below one basis point at realistic sizes.
        </li>
        <li>
          Nothing here is legal, tax, or investment advice. SAFE side letters and amendments change
          the arithmetic; this models the standard form and nothing else.
        </li>
      </ul>

      <h2 id="glossary">Glossary</h2>
      <p>Ten terms this guide leans on, defined for a first pass through the subject.</p>
      <dl className="divide-y divide-slate-200 dark:divide-white/[0.07]">
        {GLOSSARY.map(([term, def]) => (
          <div key={term} className="py-4 first:pt-0 last:pb-0">
            <dt className="font-semibold text-slate-900 dark:text-slate-100">{term}</dt>
            <dd className="mt-1 text-sm leading-relaxed text-slate-600 dark:text-slate-300">{def}</dd>
          </div>
        ))}
      </dl>

      <Faq
        items={[
          {
            question: 'What is a post-money SAFE, in one sentence?',
            answer: (
              <p>
                Cash now for a fixed percentage of the round that prices it: a capped post-money
                SAFE owns <code>amount ÷ cap</code> of the pre-round table — our{' '}
                {usdCompact(CANON_SAFE.amount)} at a {usdCompact(CANON_SAFE.cap)} cap is{' '}
                {pct(CANON.stackPctOfPreRound, 0)}, locked at signing — then dilutes with everyone
                when the round closes.
              </p>
            ),
          },
          {
            question: 'Does signing a SAFE dilute me today?',
            answer: (
              <p>
                Economically, yes; legally, not yet. No shares are issued, so the ledger still reads{' '}
                {pct(100, 0)} — but your effective ownership is existing shares ÷ Company
                Capitalization, which already nets out the stack. On the heavy preset that is{' '}
                {pct(100 - HEAVY.stackPctOfPreRound, 2)}, not 100%.
              </p>
            ),
          },
          {
            question: 'Which applies first, the cap or the discount?',
            answer: (
              <p>
                Neither — the holder converts at the <em>lower</em> of the two prices, evaluated
                independently at the round. They tie when <code>cap = rate × pre-money</code>:
                {usdCompact(KINK)} for the canonical terms. Below it the discount binds; above it
                the cap binds.
              </p>
            ),
          },
          {
            question: 'What happens when the round prices far above my cap?',
            answer: (
              <p>
                The cap binds and the SAFE converts at <code>cap ÷ Company Capitalization</code>{' '}
                regardless — an ever-deeper effective discount ({pct(CANON.safes[0].effectiveDiscountPct, 1)}{' '}
                at {usdCompact(CANON_ROUND.preMoney)},{' '}
                {pct(LADDER_ROWS[4].r.safes[0].effectiveDiscountPct, 1)} at {usdCompact(30_000_000)}),
                while the stack&apos;s post-round ownership climbs back toward its{' '}
                {pct(CANON.stackPctOfPreRound, 2)} ceiling. That is the upside the investor paid
                the cap for.
              </p>
            ),
          },
          {
            question: 'Can a SAFE convert above the round price?',
            answer: (
              <p>
                Yes — a cap-only SAFE in a round priced below its cap. Without the 20% discount, the
                canonical SAFE at an {usdCompact(8_000_000)} pre converts at{' '}
                {usd(CAPO.safes[0].safePrice, 2)} against a {usd(CAPO.roundPrice, 2)} round price: a{' '}
                {pct(-CAPO.safes[0].effectiveDiscountPct, 0)} premium. The cap is a ceiling on the
                SAFE&apos;s price, not a floor.
              </p>
            ),
          },
          {
            question: 'Do SAFEs dilute each other when they stack?',
            answer: (
              <p>
                No — that is the defining feature of the post-money form. Each SAFE&apos;s
                percentage is computed against a capitalization that already includes all the
                others, so SAFE 2&apos;s {pct(stackedActive[1].pctOfPreRound, 2)} comes entirely out
                of existing holders, and SAFE 1 keeps its{' '}
                {pct(stackedActive[0].pctOfPreRound, 2)}. The pre-2018 pre-money form did dilute
                SAFEs against each other, order-dependently.
              </p>
            ),
          },
          {
            question: 'How much SAFE money can a company raise before nothing works?',
            answer: (
              <p>
                The stack&apos;s claims must sum below 100% of the pre-round table. Identical{' '}
                {usdCompact(500_000)} SAFEs at a {usdCompact(5_000_000)} cap each claim 10%: nine
                close, the tenth cannot. In practice majority dies much earlier — at 6.25% per
                SAFE, founders lose 50% at the seventh — and investors start resisting
                correspondingly heavy stacks long before the arithmetic does.
              </p>
            ),
          },
          {
            question: 'Is the SAFE percentage I see today what I will own after the Series A?',
            answer: (
              <p>
                No — it is what you own of the <em>pre-round</em> table. The round then dilutes
                everyone in it by <code>pre ÷ post</code>. The canonical{' '}
                {pct(CANON.stackPctOfPreRound, 2)} becomes {pct(CANON.stackPctAfter, 2)} after the{' '}
                {usdCompact(CANON_ROUND.investment)} round at {usdCompact(CANON_ROUND.preMoney)}{' '}
                pre.
              </p>
            ),
          },
          {
            question: 'Does the option pool the round creates count against my SAFE?',
            answer: (
              <p>
                No — per the form, the cap (and Company Capitalization) is &ldquo;post&rdquo; the
                pool that exists today but &ldquo;pre&rdquo; any pool created or increased in
                connection with the financing. So the existing pool belongs in the share count you
                enter; the round&apos;s new pool does not grow the SAFE&apos;s denominator. It does,
                however, dilute everyone — SAFEs included — after conversion, a later step this
                model does not simulate. Size that pool with the{' '}
                <a href="/cap-table-dilution-calculator/">cap table tool</a>.
              </p>
            ),
          },
          {
            question: 'What is the difference between a SAFE and a convertible note?',
            answer: (
              <p>
                Notes are debt: interest accrues, a maturity date forces a conversation, and
                conversion terms ride on the loan. SAFEs are none of that — no interest, no
                maturity, pure future equity. The conversion arithmetic for capped instruments is
                similar in spirit, but this tool implements the SAFE form exactly and does not
                model note mechanics.
              </p>
            ),
          },
          {
            question: 'Is the pre-money before or after the SAFEs convert?',
            answer: (
              <p>
                After — the standard reading of the form: SAFEs convert immediately prior to the
                financing, so the negotiated price applies to the post-conversion table (that is
                how this tool computes the round price of {usd(CANON.roundPrice, 4)}). Term sheets
                occasionally quote pre-money &ldquo;before the SAFEs&rdquo;; identical documents
                then produce a different split, so make the convention an explicit sentence.
              </p>
            ),
          },
          {
            question: 'What do I actually receive at exit as a SAFE holder?',
            answer: (
              <p>
                Converted SAFE shares carry the round series&apos; per-share preference, so
                ownership percentage is not proceeds — in a flat or down exit the preference stack
                can absorb most of the value while every percentage stays as printed. This tool
                stops at ownership; waterfalls are a documents exercise.
              </p>
            ),
          },
          {
            question: 'Why does the tool reject my three SAFEs?',
            answer: (
              <p>
                Their claims sum to 100%+ of the pre-round table — e.g. {usdCompact(2_000_000)} at{' '}
                {usdCompact(5_000_000)}, {usdCompact(3_000_000)} at {usdCompact(6_000_000)}, and{' '}
                {usdCompact(1_000_000)} at {usdCompact(4_000_000)} claim 40% + 50% + 25% = 115%.
                The tool reports &ldquo;{BAD_TRIO.reason}&rdquo; rather than printing a number that
                could never close.
              </p>
            ),
          },
          {
            question: 'Can I model a SAFE with no cap and no discount?',
            answer: (
              <p>
                Yes — leave both at zero. That is an MFN-style instrument that converts at the round
                price itself: our {usdCompact(1_000_000)} example claims{' '}
                {pct(MFN.stackPctOfPreRound, 2)} of the pre-round table at{' '}
                {usdCompact(CANON_ROUND.preMoney)}, exactly what the same dollars would buy in the
                round — the tool prices the election for you.
              </p>
            ),
          },
        ]}
      />

      <RelatedCalculators
        links={[
          { href: '/cap-table-dilution-calculator/', label: 'Cap Table & Dilution Calculator' },
          { href: '/saas-runway-calculator/', label: 'SaaS Runway Calculator' },
          { href: '/llc-vs-ccorp-tax-calculator/', label: 'LLC vs C-Corp Tax Calculator' },
        ]}
      />
    </article>
  );
}

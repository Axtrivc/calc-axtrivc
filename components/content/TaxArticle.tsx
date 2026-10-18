import Link from 'next/link';
import Faq from '@/components/Faq';
import { ArticleToc, RelatedCalculators } from '@/components/Article';
import {
  ccorpWinCount,
  compareEntities,
  computeCCorp,
  computeLlc,
  excludedAdditionalMedicare,
  excludedNiit,
  findCrossoverPayout,
  findCrossoverProfit,
  payoutThresholdShape,
  TAX_CONSTANTS,
} from '@/lib/llccorp';
import { numFmt, pct, usd } from '@/lib/format';

/* Every model figure below is generated at build time by the same pure
   functions the widget calls — hand-typed numbers would drift from the model.
   Statutory constants (bracket caps, thresholds) are cited inline with their
   sources; the two excluded surtaxes are quantified by lib/llccorp helpers. */
const WORKED = compareEntities(200_000, 1);
const COMPARE_ROWS = [50_000, 100_000, 200_000, 500_000, 1_000_000].map((profit) => ({
  profit,
  r: compareEntities(profit, 1),
}));
const RETAIN_500K = compareEntities(500_000, 0);
const CROSSOVER = findCrossoverProfit(0) ?? 0;
const TIE_1M = findCrossoverPayout(1_000_000) ?? 0;
const TIE_2M = findCrossoverPayout(2_000_000) ?? 0;
const SHAPE = payoutThresholdShape();
/* Excluded-surtax magnitudes (opposite directions) + the full-payout scan the
   intro paragraph asserts. All computed, never typed. */
const ADL_MEDICARE_500K = excludedAdditionalMedicare(500_000);
const ADL_MEDICARE_1M = excludedAdditionalMedicare(1_000_000);
const NIIT_1M = excludedNiit(1_000_000, 1);
/* NIIT, stated accurately: §1411 taxes the LESSER of net investment income and
   MAGI − $200,000. With the $1M full-payout dividends as the shareholder's only
   income, the exposed base is dividends − $200,000 — the engine's full-exposure
   helper (excludedNiit) is the upper bound, not the point estimate. */
const NIIT_BASE_1M = Math.max(0, COMPARE_ROWS[4].r.ccorp.dividends - 200_000);
const NIIT_LESSEROF_1M = 0.038 * NIIT_BASE_1M;
const TRUE_1M_SAVING_LESSEROF = COMPARE_ROWS[4].r.delta + NIIT_LESSEROF_1M - ADL_MEDICARE_1M;
/* §1(h) reality check: LTCG breakpoints attach to TAXABLE income, so a
   dividend-only shareholder also gets the standard deduction inside the 0%
   band — a wider shelter and a higher tax-free profit ceiling than the model's
   disclosed no-deduction convention. */
const DIV_SHELTER_STATUTORY = TAX_CONSTANTS.ltcg15Breakpoint + TAX_CONSTANTS.stdDeduction;
const DIV_FREE_PROFIT_STATUTORY = DIV_SHELTER_STATUTORY / (1 - TAX_CONSTANTS.corporateRate);
const FULL_PAYOUT_CCORP_WINS = ccorpWinCount(1, 5_000_000, 25_000);
const FULL_PAYOUT_RUNGS = 5_000_000 / 25_000 + 1;
/* The later sections (worked examples, decision boundaries, glossary, extended
   FAQ) follow the same rule — every figure is an engine call, including the
   boundary scans, which reuse the grid+bisection pattern the engine's own
   finders use. */
const WORKED_60K = compareEntities(60_000, 1);
/* 92.35% × 60,000, recovered from the engine's own SE line — shown in the
   worked-example table as the derivation's first step. */
const SE_BASE_60K = WORKED_60K.llc.seTax / TAX_CONSTANTS.seRate;
/* $48,350 ÷ 79% — below this profit even 100%-payout dividends sit entirely
   inside the 0% LTCG band, so the C-Corp pays exactly 21% and nothing more. */
const DIV_FREE_PROFIT = TAX_CONSTANTS.ltcg15Breakpoint / (1 - TAX_CONSTANTS.corporateRate);
const EX_1M_FULL = compareEntities(1_000_000, 1);
const EX_1M_HALF = compareEntities(1_000_000, 0.5);
/* The "eventually distribute everything" all-in at $500k — the honest counter-
   weight to the retention example's current-year framing. */
const FULL_500K = compareEntities(500_000, 1);
const SMALL_5K = compareEntities(5_000, 1);
const CCORP_10M = computeCCorp(10_000_000, 1); // near the fully-distributed ceiling
/* Composed stacks (rates × engine constants, never typed as results): the
   15%-band stack, its 20%-band ceiling, and the 75%-payout long-run trend. */
const CCORP_STACK_15 = TAX_CONSTANTS.corporateRate + 0.15 * (1 - TAX_CONSTANTS.corporateRate);
const CCORP_CEILING = TAX_CONSTANTS.corporateRate + 0.2 * (1 - TAX_CONSTANTS.corporateRate);
const CCORP_75_TREND = TAX_CONSTANTS.corporateRate + 0.2 * 0.75 * (1 - TAX_CONSTANTS.corporateRate);
const LLC_20M = computeLlc(20_000_000); // far-end plateau of the LLC curve
/* Decision-boundary scans. */
const CROSSOVER_25 = findCrossoverProfit(0.25);
const CROSSOVER_50 = findCrossoverProfit(0.5);
const CROSSOVER_75 = findCrossoverProfit(0.75);
/* Dividends at the crossover profit for the 25% / 50% payout rows — they stay
   inside the 0% band, which is why those crossovers coincide with payout 0. */
const DIVS_AT_CROSSOVER = [0.25, 0.5].map(
  (q) => q * (1 - TAX_CONSTANTS.corporateRate) * (CROSSOVER ?? 0),
);
const TIE_ROWS = [60_000, 150_000, 200_000, 300_000, 500_000, 1_000_000, 2_000_000, 5_000_000].map(
  (profit) => ({ profit, tie: findCrossoverPayout(profit) }),
);
/* At payout shares near the top, the C-Corp's win region is bounded: its
   long-run trend ends above the LLC's plateau, so the LLC re-overtakes at
   large profit. This finder scans $1,000 rungs from the first crossover to
   $5M and bisects the flip-back to the dollar — same grid+bisect pattern as
   the engine's own finders. */
function ccorpWinWindow(payout: number): { lo: number; hi: number | null } | null {
  const lo = findCrossoverProfit(payout);
  if (lo === null) return null;
  const diff = (x: number) => computeLlc(x).totalTax - computeCCorp(x, payout).totalTax;
  for (let x = lo + 1_000; x <= 5_000_000; x += 1_000) {
    if (diff(x) <= 0) {
      let a = x - 1_000;
      let b = x;
      while (b - a > 0.5) {
        const m = (a + b) / 2;
        if ((diff(a) > 0) !== (diff(m) > 0)) b = m;
        else a = m;
      }
      return { lo, hi: Math.round((a + b) / 2) };
    }
  }
  return { lo, hi: null };
}
const WINDOW_75 = ccorpWinWindow(0.75);
/* Glossary — the only numbers in these entries are statutory constants the
   engine's own parameter set carries (cited in the body elsewhere). */
const GLOSSARY: [string, string][] = [
  [
    'Pass-through taxation',
    'The business itself owes no federal income tax; profit lands on the owner\u2019s personal return and is taxed once. The default treatment for sole proprietorships, partnerships, and LLCs that have not elected otherwise.',
  ],
  [
    'Double taxation',
    'The C-Corp pattern: profit is taxed once inside the corporation at a flat 21%, then again at 0/15/20% when distributed as qualified dividends. The second layer applies only to what the first leaves behind — 79 cents per dollar.',
  ],
  [
    'Self-employment (SE) tax',
    'The owner-operator\u2019s version of FICA: 15.3% (12.4% Social Security + 2.9% Medicare) applied to 92.35% of net profit, with the Social Security component capped at the wage base. Half of the tax is deductible against income tax.',
  ],
  [
    'Social Security wage base',
    'The $176,100 (2025) ceiling on earnings subject to the 12.4% Social Security component. Above it the SE/FICA marginal rate drops from 15.3% to 2.9% — the kink that shapes this guide\u2019s crossover curves.',
  ],
  [
    'QBI deduction (§199A)',
    'A 20% deduction on qualified business income, available only to pass-through owners. It phases out for specified service businesses (SSTBs) above $197,300 of taxable income (single, 2025) — a limitation this tool discloses but does not model.',
  ],
  [
    'Qualified dividend',
    'A dividend eligible for long-term capital gains rates instead of ordinary rates. It is the shareholder-level half of C-Corp double taxation, and exactly what the payout share controls.',
  ],
  [
    'LTCG brackets',
    `The separate rate schedule for qualified dividends and long-term gains: 0% up to $48,350, 15% up to $533,400, 20% above (2025, single). This model runs dividends through the schedule without the standard deduction — a disclosed simplification, not the statute: under §1(h) the breakpoints attach to taxable income, so a shareholder with no other income can shelter ${usd(DIV_SHELTER_STATUTORY, 0)} of dividends ($48,350 plus the $15,750 standard deduction) and reach a tax-free profit ceiling near ${usd(DIV_FREE_PROFIT_STATUTORY, 0)}.`,
  ],
  [
    'Retained earnings',
    'After-corporate-tax profit kept inside the C-Corp rather than distributed. It carries no shareholder-level tax in the year earned — the deferral that makes the retention crossover possible — and pays LTCG rates whenever it is eventually paid out.',
  ],
  [
    'Payout share',
    'The C-Corp lever this tool isolates: the fraction of after-corporate-tax profit distributed as dividends this year, from 0% to 100%. The remainder is retained earnings.',
  ],
  [
    'Effective tax rate',
    'Total tax divided by profit — the one number that compares structures fairly across profit levels.',
  ],
  [
    'SSTB (specified service trade or business)',
    'Health, law, consulting, financial services, and similar businesses where skill and reputation drive the income. Above the §199A income threshold (see the QBI entry), an SSTB loses its QBI deduction over a narrow income range.',
  ],
  [
    'NIIT and Additional Medicare Tax',
    'The two surtaxes this model excludes, pulling in opposite directions: the 3.8% net investment income tax lands on the C-Corp\u2019s dividends; the 0.9% Additional Medicare Tax lands on SE income above a $200,000 base. The caveats quantify both.',
  ],
];

export default function TaxArticle() {
  const toc = [
    { id: 'how-it-works', label: 'How LLC vs C-Corp taxation works' },
    { id: 'examples', label: 'Worked examples' },
    { id: 'strategies', label: 'When each structure actually wins' },
    { id: 'crossover', label: 'The retention crossover' },
    { id: 'decision-boundaries', label: 'Decision boundaries' },
    { id: 'comparison', label: 'Side-by-side tax comparison' },
    { id: 'caveats', label: 'Important caveats' },
    { id: 'glossary', label: 'Glossary' },
    { id: 'faq', label: 'FAQ' },
  ];

  return (
    <article className="prose-article">
      <ArticleToc items={toc} />

      <h2 id="how-it-works">How LLC vs C-Corp taxation actually works</h2>
      <p>
        Choosing between an LLC and a C-Corp is one of the most consequential — and most
        misunderstood — decisions a US founder makes. The tax difference between the two comes down
        to one concept: <strong>how many times the same dollar of profit gets taxed before it
        reaches your pocket.</strong>
      </p>

      <h3>LLC (and other pass-through entities)</h3>
      <p>
        An LLC is a <strong>pass-through</strong> entity. The business itself pays no federal income
        tax. Instead, all profit &ldquo;passes through&rdquo; to the owner&apos;s personal return, where it is
        taxed <strong>once</strong>. As the owner of an LLC taxed as a sole proprietorship (the
        default), you pay:
      </p>
      <ol>
        <li>
          <strong>Self-employment (SE) tax</strong> of {pct(TAX_CONSTANTS.seRate * 100, 1)} — applied
          to 92.35% of net business income per Schedule SE, up to the Social Security wage base of
          {' ' + numFmt(TAX_CONSTANTS.seCap, 0)} (and 2.9% Medicare on the amount above that). This
          covers both the employer and employee halves of Social Security + Medicare.
        </li>
        <li>
          <strong>Ordinary federal income tax</strong> on that same profit, reduced by two
          deductions: half of the SE tax you paid, and the
          {' ' + pct(TAX_CONSTANTS.qbiRate * 100, 0)} <strong>Qualified Business Income (QBI)
          deduction</strong> — a major 2017 tax-reform benefit for most small businesses (made
          permanent by the 2025 One Big Beautiful Bill Act).
        </li>
      </ol>

      <h3>C-Corp</h3>
      <p>
        A C-Corp is a <strong>separate taxable entity</strong>. The same dollar of profit gets taxed
        twice before it reaches you:
      </p>
      <ol>
        <li>
          <strong>Corporate income tax</strong> of {pct(TAX_CONSTANTS.corporateRate * 100, 0)} (flat,
          post-2017 reform) on the business profit.
        </li>
        <li>
          <strong>Dividend tax</strong> on the qualified dividends you receive when the after-tax
          profit is distributed to you as a shareholder — taxed at long-term capital gains rates
          (0%, 15%, or 20%).
        </li>
      </ol>
      <p>
        This is the infamous &ldquo;<strong>double taxation</strong>&rdquo; of C-Corps. Even though the
        corporate rate dropped from 35% to {pct(TAX_CONSTANTS.corporateRate * 100, 0)} in 2017, the
        second layer of tax on dividends remains. The one escape hatch: profit that <em>stays
        inside</em> the corporation is taxed only at 21% this year — the dividend layer waits until
        you actually distribute.
      </p>

      <h2 id="examples">Worked examples, step by step</h2>
      <h3>The $200,000 baseline — every dollar distributed</h3>
      <p>
        Using the calculator above with $200,000 in net business profit (single filer, 2025 federal
        brackets, {`$${numFmt(TAX_CONSTANTS.stdDeduction, 0)}`} standard deduction, no state tax):
      </p>
      <table>
        <thead>
          <tr>
            <th>Line item</th>
            <th>LLC</th>
            <th>C-Corp</th>
          </tr>
        </thead>
        <tbody>
          <tr><td>Business profit</td><td>$200,000</td><td>$200,000</td></tr>
          <tr><td>Corporate tax (21%)</td><td>—</td><td>−{usd(WORKED.ccorp.corporateTax, 0)}</td></tr>
          <tr><td>Self-employment tax</td><td>−{usd(WORKED.llc.seTax, 0)}</td><td>—</td></tr>
          <tr><td>QBI deduction (20%)</td><td>−{usd(WORKED.llc.qbiDeduction, 0)}</td><td>—</td></tr>
          <tr><td>Dividend tax (LTCG)</td><td>—</td><td>−{usd(WORKED.ccorp.dividendTax, 0)}</td></tr>
          <tr><td>Ordinary income tax</td><td>−{usd(WORKED.llc.incomeTax, 0)}</td><td>—</td></tr>
          <tr><td><strong>Total federal tax</strong></td><td><strong>{usd(WORKED.llc.totalTax, 0)}</strong></td><td><strong>{usd(WORKED.ccorp.totalTax, 0)}</strong></td></tr>
          <tr><td><strong>After-tax income</strong></td><td><strong>{usd(WORKED.llc.afterTax, 0)}</strong></td><td><strong>{usd(WORKED.ccorp.afterTax, 0)}</strong></td></tr>
          <tr><td>Effective rate</td><td>{pct(WORKED.llc.effectiveRate, 1)}</td><td>{pct(WORKED.ccorp.effectiveRate, 1)}</td></tr>
        </tbody>
      </table>
      <p>
        At $200k with every dollar distributed, the LLC saves about{' '}
        <strong>{usd(WORKED.delta, 0)}/year</strong> in this simplified model. The gap widens with
        profit: at $1M, the LLC advantage grows to about{' '}
        <strong>{usd(COMPARE_ROWS[4].r.delta, 0)}/year</strong>.
      </p>

      <h3>Edge case at $60,000 — the dividend layer disappears</h3>
      <p>
        Full inputs: $60,000 of net business profit, 100% payout, single filer, 2025 federal
        parameters, no state tax. Walk each stack the way the engine walks it. On the LLC side,
        Schedule SE applies the 15.3% tax to 92.35% of profit — a base of{' '}
        {usd(SE_BASE_60K, 0)} — then half of the SE tax and the QBI deduction and the standard
        deduction come off before the ordinary brackets run. On the C-Corp side, the 21% corporate
        layer leaves {usd(WORKED_60K.ccorp.dividends, 0)} of after-tax profit, and distributing all
        of it lands <em>entirely inside the 0% LTCG band</em>, which reaches up to{' '}
        {usd(TAX_CONSTANTS.ltcg15Breakpoint, 0)} of dividends for a single filer:
      </p>
      <table>
        <thead>
          <tr>
            <th>Line item</th>
            <th>LLC</th>
            <th>C-Corp (100% payout)</th>
          </tr>
        </thead>
        <tbody>
          <tr><td>SE base (92.35% × profit)</td><td>{usd(SE_BASE_60K, 0)}</td><td>—</td></tr>
          <tr><td>Self-employment tax</td><td>−{usd(WORKED_60K.llc.seTax, 0)}</td><td>—</td></tr>
          <tr><td>QBI deduction</td><td>−{usd(WORKED_60K.llc.qbiDeduction, 0)}</td><td>—</td></tr>
          <tr><td>Taxable income (after ½ SE, QBI, standard)</td><td>{usd(WORKED_60K.llc.taxableIncome, 0)}</td><td>—</td></tr>
          <tr><td>Ordinary income tax</td><td>−{usd(WORKED_60K.llc.incomeTax, 0)}</td><td>—</td></tr>
          <tr><td>Corporate tax (21%)</td><td>—</td><td>−{usd(WORKED_60K.ccorp.corporateTax, 0)}</td></tr>
          <tr><td>Dividends distributed</td><td>—</td><td>{usd(WORKED_60K.ccorp.dividends, 0)}</td></tr>
          <tr><td>Dividend tax — 0% LTCG band</td><td>—</td><td>$0</td></tr>
          <tr><td><strong>Total federal tax</strong></td><td><strong>{usd(WORKED_60K.llc.totalTax, 0)}</strong></td><td><strong>{usd(WORKED_60K.ccorp.totalTax, 0)}</strong></td></tr>
          <tr><td>Effective rate</td><td>{pct(WORKED_60K.llc.effectiveRate, 1)}</td><td>{pct(WORKED_60K.ccorp.effectiveRate, 1)}</td></tr>
        </tbody>
      </table>
      <p>
        The LLC still wins — but only by <strong>{usd(WORKED_60K.delta, 0)}</strong>, a sliver set
        against the {usd(COMPARE_ROWS[4].r.delta, 0)} gap at $1M. The mechanism is the takeaway:
        while 79% of profit stays below the {usd(TAX_CONSTANTS.ltcg15Breakpoint, 0)} band top —
        profit under about <strong>{usd(DIV_FREE_PROFIT, 0)}</strong> in this model&apos;s convention —
        a fully-distributed C-Corp pays exactly {pct(TAX_CONSTANTS.corporateRate * 100, 0)} and
        not a cent more. The &ldquo;double tax&rdquo; is only double once dividends climb past the
        0% band.
      </p>

      <h3>The payout lever at $1,000,000 — same business, two verdicts</h3>
      <p>
        Full inputs: $1,000,000 of net business profit, single filer, 2025 federal parameters. The
        LLC column is payout-independent — pass-through profit is taxed the year it is earned, drawn
        or not. The C-Corp is run twice: once distributing everything, once distributing half. At
        the 50% setting, the corporate layer leaves{' '}
        {usd(EX_1M_HALF.ccorp.dividends + EX_1M_HALF.ccorp.retained, 0)} after tax; half of that is
        paid out as dividends, which clear the {usd(TAX_CONSTANTS.ltcg15Breakpoint, 0)} top of the
        0% band but stay under the {usd(TAX_CONSTANTS.ltcg20Breakpoint, 0)} top of the 15% band —
        so every taxable dividend dollar pays 15%:
      </p>
      <table>
        <thead>
          <tr>
            <th>Line item</th>
            <th>LLC</th>
            <th>C-Corp · 100% payout</th>
            <th>C-Corp · 50% payout</th>
          </tr>
        </thead>
        <tbody>
          <tr><td>Corporate tax (21%)</td><td>—</td><td>−{usd(EX_1M_FULL.ccorp.corporateTax, 0)}</td><td>−{usd(EX_1M_HALF.ccorp.corporateTax, 0)}</td></tr>
          <tr><td>After-corporate profit</td><td>—</td><td>{usd(EX_1M_FULL.ccorp.dividends + EX_1M_FULL.ccorp.retained, 0)}</td><td>{usd(EX_1M_HALF.ccorp.dividends + EX_1M_HALF.ccorp.retained, 0)}</td></tr>
          <tr><td>Dividends distributed</td><td>—</td><td>{usd(EX_1M_FULL.ccorp.dividends, 0)}</td><td>{usd(EX_1M_HALF.ccorp.dividends, 0)}</td></tr>
          <tr><td>Dividend tax (LTCG)</td><td>—</td><td>−{usd(EX_1M_FULL.ccorp.dividendTax, 0)}</td><td>−{usd(EX_1M_HALF.ccorp.dividendTax, 0)}</td></tr>
          <tr><td>Retained inside the corp (untaxed now)</td><td>—</td><td>{usd(EX_1M_FULL.ccorp.retained, 0)}</td><td>{usd(EX_1M_HALF.ccorp.retained, 0)}</td></tr>
          <tr><td>Self-employment tax</td><td>−{usd(EX_1M_FULL.llc.seTax, 0)}</td><td>—</td><td>—</td></tr>
          <tr><td>QBI deduction</td><td>−{usd(EX_1M_FULL.llc.qbiDeduction, 0)}</td><td>—</td><td>—</td></tr>
          <tr><td>Ordinary income tax</td><td>−{usd(EX_1M_FULL.llc.incomeTax, 0)}</td><td>—</td><td>—</td></tr>
          <tr><td><strong>Total federal tax</strong></td><td><strong>{usd(EX_1M_FULL.llc.totalTax, 0)}</strong></td><td><strong>{usd(EX_1M_FULL.ccorp.totalTax, 0)}</strong></td><td><strong>{usd(EX_1M_HALF.ccorp.totalTax, 0)}</strong></td></tr>
          <tr><td>Effective rate</td><td>{pct(EX_1M_FULL.llc.effectiveRate, 1)}</td><td>{pct(EX_1M_FULL.ccorp.effectiveRate, 1)}</td><td>{pct(EX_1M_HALF.ccorp.effectiveRate, 1)}</td></tr>
        </tbody>
      </table>
      <p>
        At full payout the LLC wins by <strong>{usd(EX_1M_FULL.delta, 0)}</strong> — the widest gap
        in the comparison grid. Drop the payout to half and the same business flips verdicts: the
        C-Corp&apos;s current-year bill falls to {usd(EX_1M_HALF.ccorp.totalTax, 0)}{' '}
        ({pct(EX_1M_HALF.ccorp.effectiveRate, 1)}), undercutting the LLC by{' '}
        <strong>{usd(EX_1M_HALF.delta, 0)}</strong> while{' '}
        {usd(EX_1M_HALF.ccorp.retained, 0)} of after-tax profit sits inside the corporation
        awaiting its eventual LTCG toll. The two verdicts bracket the computed tie point for this
        profit level: <strong>{pct(TIE_1M * 100, 1)}</strong> of after-corporate profit distributed
        — the exact threshold the decision-boundaries section scans.
      </p>

      <h2 id="strategies">When each structure actually wins</h2>
      <p>
        The simplified model above makes the LLC look universally better — but in the real world,
        the picture is more nuanced. The right entity depends on what you plan to <em>do</em> with
        the money.
      </p>

      <h3>Choose an LLC (or S-Corp) when…</h3>
      <ul>
        <li>
          <strong>You plan to distribute most profit to owners.</strong> Pass-through taxation is
          strictly better when cash leaves the business each year. Service businesses, agencies,
          and consultancies almost always fit this profile — with one caveat the model does not
          price: specified service trades (consulting, law, medicine, finance) can lose part or
          all of the 20% QBI deduction this model grants in full, which raises the real
          pass-through bill (see caveats).
        </li>
        <li>
          <strong>You want simple administration.</strong> LLCs have lighter compliance — no board,
          no formal minutes, fewer state filings.
        </li>
        <li>
          <strong>You qualify for QBI.</strong> The 20% QBI deduction is a major ongoing tax break
          for pass-through entities, with phase-outs only at high income levels and certain service
          trades.
        </li>
      </ul>

      <h3>Choose a C-Corp when…</h3>
      <ul>
        <li>
          <strong>You&apos;re raising venture capital.</strong> VCs and institutional investors almost
          universally require a C-Corp (preferred stock, familiar governance, clean cap table). An
          LLC routinely kills a term sheet.
        </li>
        <li>
          <strong>You plan to reinvest profits rather than distribute them.</strong> If the business
          keeps most of its earnings to fund growth, only the {pct(TAX_CONSTANTS.corporateRate * 100, 0)}
          corporate tax applies — no second dividend layer until you actually pay out. The next
          section puts exact numbers on that crossover.
        </li>
        <li>
          <strong>You want to offer broad equity / RSUs / stock options.</strong> C-Corps have a
          far more mature toolkit for employee equity than LLCs.
        </li>
        <li>
          <strong>You intend to eventually be acquired or go public.</strong> Acquirers and
          underwriters strongly prefer the certainty of a C-Corp structure.
        </li>
      </ul>
      <p>
        The takeaway: <strong>the tax comparison matters most for lifestyle / cash-flow
        businesses</strong>. For venture-backed startups, the entity choice is largely dictated by
        investors — and the C-Corp &ldquo;tax penalty&rdquo; is a price founders pay willingly in exchange
        for capital and optionality.
      </p>

      <h2 id="crossover">The retention crossover — where a C-Corp actually wins</h2>
      <p>
        The widget has a second input for a reason: <strong>the share of after-tax profit you
        actually distribute as dividends</strong>. At 100% payout the LLC wins at every profit
        level — the same scan runs at build time over $0 to $5M in $25k steps and returns{' '}
        {FULL_PAYOUT_CCORP_WINS.toLocaleString()} C-Corp wins across{' '}
        {FULL_PAYOUT_RUNGS.toLocaleString()} rungs. But drop the payout and the flat 21% corporate
        layer gets a fighting chance, because the dividend tax only applies to the share you pay
        out.
      </p>
      <p>
        Retention worked example at <strong>$500,000</strong> of profit, distributing nothing:
      </p>
      <table>
        <thead>
          <tr>
            <th>Line item</th>
            <th>LLC — full pass-through</th>
            <th>C-Corp — 0% distributed</th>
          </tr>
        </thead>
        <tbody>
          <tr><td>Self-employment + income tax</td><td>{usd(RETAIN_500K.llc.totalTax, 0)}</td><td>—</td></tr>
          <tr><td>Corporate tax (21%)</td><td>—</td><td>{usd(RETAIN_500K.ccorp.corporateTax, 0)}</td></tr>
          <tr><td>Dividend tax</td><td>—</td><td>$0 (nothing distributed)</td></tr>
          <tr><td><strong>Total federal tax</strong></td><td><strong>{usd(RETAIN_500K.llc.totalTax, 0)}</strong></td><td><strong>{usd(RETAIN_500K.ccorp.totalTax, 0)}</strong></td></tr>
          <tr><td>Effective rate</td><td>{pct(RETAIN_500K.llc.effectiveRate, 1)}</td><td>{pct(RETAIN_500K.ccorp.effectiveRate, 1)}</td></tr>
        </tbody>
      </table>
      <p>
        The C-Corp is ahead by <strong>{usd(RETAIN_500K.delta, 0)}</strong> in current-year federal
        tax — with <strong>{usd(RETAIN_500K.ccorp.retained, 0)}</strong> still sitting inside the
        corporation. That last clause is the whole trade: deferral is not elimination, and the
        retained dollars pay LTCG rates whenever they are eventually distributed.
      </p>
      <p>
        Two computed boundaries frame the whole decision:
      </p>
      <ul>
        <li>
          <strong>The profit crossover.</strong> Below about <strong>{usd(CROSSOVER, 0)}</strong> of
          profit, the LLC&apos;s full stack — SE tax plus progressive brackets, with the 20% QBI
          deduction sheltering a fifth of the pass-through base — stays under the flat 21%.
          Above it, a C-Corp that distributes little wins on current-year tax.
        </li>
        <li>
          <strong>The payout threshold — and how far it moves.</strong> &ldquo;How much can I
          distribute before the LLC wins again?&rdquo; has a profit-dependent answer: the threshold
          peaks at <strong>{pct(SHAPE.peak.payout * 100, 1)}</strong> just below{' '}
          {usd(SHAPE.seCapKinkProfit, 0)} of profit — the level at which Social Security tax caps
          out — falls to <strong>{pct(SHAPE.trough.payout * 100, 1)}</strong> near{' '}
          {usd(SHAPE.trough.profit, 0)}, recovers to a local peak of{' '}
          <strong>{pct(SHAPE.localPeak.payout * 100, 1)}</strong> near{' '}
          {usd(SHAPE.localPeak.profit, 0)} ({pct(TIE_1M * 100, 0)} at $1M, {pct(TIE_2M * 100, 0)}{' '}
          at $2M), and eases down to about {pct((SHAPE.at20M ?? 0) * 100, 0)} by $20M. In
          practice, for profits above $500k the threshold runs from{' '}
          {pct(SHAPE.above500kMin * 100, 0)} to {pct(SHAPE.localPeak.payout * 100, 0)} of
          after-tax profit: a payout in the 60s can still favor the C-Corp, so &ldquo;distributing
          most of it&rdquo; is not a guarantee — and the retention flip begins at{' '}
          {usd(CROSSOVER, 0)} of profit, not only at scale. The LLC&rsquo;s clean win needs a payout
          at or above the threshold for its profit level.
        </li>
      </ul>
      <p>
        One lever this guide deliberately does not compute: <strong>blending a deductible W-2 salary
        with dividends</strong> inside the C-Corp (and the closely related S-Corp election for
        LLCs). Salary shifts income out of both the 21% corporate layer and the SE-tax base, and
        modeling it properly requires payroll overhead and &ldquo;reasonable salary&rdquo; judgments — the{' '}
        <Link href="/s-corp-tax-calculator/" className="underline decoration-from-font underline-offset-2">
          S-Corp Salary Calculator
        </Link>{' '}
        is the instrument built for exactly that question.
      </p>

      <h2 id="decision-boundaries">Decision boundaries</h2>
      <p>
        Everything above describes mechanisms; this section states the lines the model actually
        draws. Each threshold comes from an engine scan; the method is spelled out below the
        tables.
      </p>

      <h3>When this comparison is the right instrument</h3>
      <ul>
        <li>
          <strong>One owner weighing the federal layer at the payout extremes.</strong> You want to
          know, in dollars, what pass-through taxation costs against a 21% corporate layer plus its
          dividend toll — and what retention actually buys.
        </li>
        <li>
          <strong>A cash-flow business deciding how much to distribute.</strong> The tie thresholds
          below say where the C-Corp&apos;s deferral stops paying for itself at your profit level.
        </li>
        <li>
          <strong>A directional check before professional modeling.</strong> The output is a
          simplified single-filer federal illustration — the right resolution for building intuition
          before a CPA adds salary, state, and benefits to the picture.
        </li>
      </ul>

      <h3>When to set it aside</h3>
      <ul>
        <li>
          <strong>You are raising venture capital.</strong> The C-Corp is dictated by the investor;
          the tax penalty is the price of the capital. This model&apos;s verdict is beside the
          point.
        </li>
        <li>
          <strong>You are profitable enough to blend a W-2 salary with dividends.</strong> A
          deductible salary moves income out of both the 21% layer and the SE-tax base, and it
          dominates the payout lever this tool models — the{' '}
          <Link href="/s-corp-tax-calculator/" className="underline decoration-from-font underline-offset-2">
            S-Corp Salary Calculator
          </Link>{' '}
          prices exactly that mix.
        </li>
        <li>
          <strong>You are an SSTB above the QBI threshold.</strong> The model grants the 20%
          deduction in full; a specified service business above the §199A income threshold loses
          part or all of it, which raises the real pass-through bill while the C-Corp column
          stands.
        </li>
        <li>
          <strong>State taxes are material.</strong> Franchise fees and state income taxes — from
          0% to over 13% — sit outside the model and can move the answer by themselves.
        </li>
      </ul>

      <h3>The computed thresholds</h3>
      <p>
        Where the C-Corp is cheaper in current-year federal tax, by payout share (the share of
        after-corporate-tax profit distributed as dividends):
      </p>
      <table>
        <thead>
          <tr>
            <th>Payout share</th>
            <th>C-Corp cheaper when…</th>
          </tr>
        </thead>
        <tbody>
          <tr><td>0% (retain everything)</td><td>profit above {usd(CROSSOVER, 0)}</td></tr>
          <tr>
            <td>25%</td>
            <td>
              above {usd(CROSSOVER_25 ?? 0, 0)} — the same crossover: at that profit even this
              payout keeps dividends ({usd(DIVS_AT_CROSSOVER[0], 0)}) inside the 0% LTCG band, and
              the C-Corp stays cheaper through the top of the scanned range
            </td>
          </tr>
          <tr>
            <td>50%</td>
            <td>
              above {usd(CROSSOVER_50 ?? 0, 0)} — same invariance ({usd(DIVS_AT_CROSSOVER[1], 0)}{' '}
              of dividends, still under the {usd(TAX_CONSTANTS.ltcg15Breakpoint, 0)} band top)
            </td>
          </tr>
          <tr>
            <td>75%</td>
            <td>
              only between {WINDOW_75 ? `${usd(WINDOW_75.lo, 0)} and ${usd(WINDOW_75.hi ?? 0, 0)}` : '—'}{' '}
              of profit — above that the LLC re-overtakes, because the 75%-payout stack trends
              toward {pct(CCORP_75_TREND * 100, 1)} at scale while the LLC plateaus near{' '}
              {pct(LLC_20M.effectiveRate, 1)}
            </td>
          </tr>
          <tr>
            <td>100%</td>
            <td>
              never in the scanned range — {FULL_PAYOUT_CCORP_WINS.toLocaleString()} C-Corp wins
              across {FULL_PAYOUT_RUNGS.toLocaleString()} rungs from $0 to $5M
            </td>
          </tr>
        </tbody>
      </table>
      <p>
        From the other direction — for a given profit, the payout share at which the two structures
        tie (distribute less and the C-Corp is cheaper on current-year tax; more and the LLC is).
        Note the shape is not monotone, for the Social Security cap reasons traced in the crossover
        section:
      </p>
      <table>
        <thead>
          <tr>
            <th>Profit</th>
            <th>Tie payout</th>
          </tr>
        </thead>
        <tbody>
          {TIE_ROWS.map(({ profit, tie }) => (
            <tr key={profit}>
              <td>{usd(profit, 0)}</td>
              <td>{tie === null ? '— (LLC cheaper at every payout)' : pct(tie * 100, 1)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-xs text-slate-500 dark:text-slate-400">
        Scan method, so every row is reproducible: profit crossovers use the engine&apos;s{' '}
        <code>findCrossoverProfit</code> — a $5,000-rung grid from $0 to $5M that detects the sign
        change of (LLC total tax − C-Corp total tax) and bisects it to the dollar. The 75%
        window&apos;s upper end uses the same pattern at $1,000 rungs; the tie column uses{' '}
        <code>findCrossoverPayout</code>, which bisects the payout share at fixed profit to one
        part in a million. The 100%-payout row is a count, not a root:{' '}
        <code>ccorpWinCount</code> walks $25,000 rungs from $0 to $5M and reports{' '}
        {FULL_PAYOUT_CCORP_WINS.toLocaleString()} C-Corp wins. All of it runs at build time against
        the same <code>lib/llccorp</code> functions the widget calls.
      </p>

      <h2 id="comparison">Side-by-side tax comparison</h2>
      <p>
        How total federal effective rates compare across profit levels when everything is
        distributed (figures generated from the same model as the widget — not hand-typed):
      </p>
      <table>
        <thead>
          <tr>
            <th>Profit</th>
            <th>LLC eff. rate</th>
            <th>C-Corp eff. rate</th>
            <th>LLC annual saving</th>
          </tr>
        </thead>
        <tbody>
          {COMPARE_ROWS.map(({ profit, r }) => (
            <tr key={profit}>
              <td>{usd(profit, 0)}</td>
              <td>{pct(r.llc.effectiveRate, 1)}</td>
              <td>{pct(r.ccorp.effectiveRate, 1)}</td>
              <td>{usd(r.delta, 0)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2 id="caveats">Important caveats (please read)</h2>
      <ul>
        <li>
          <strong>Real C-Corps mix salary and dividends.</strong> A C-Corp owner typically pays
          themselves a deductible W-2 salary (which the corp deducts, lowering corporate tax) and
          dividends only the surplus. Our calculator models the payout extremes and the payout
          ratio between them; the salary blend itself is what the S-Corp Salary Calculator
          models.
        </li>
        <li>
          <strong>LLCs can elect S-Corp taxation.</strong> Once an LLC is profitable enough, electing
          S-Corp status (via IRS Form 2553) can materially reduce SE tax by paying the owner a
          &ldquo;reasonable salary&rdquo; and taking the rest as distributions.
        </li>
        <li>
          <strong>Retained earnings are deferred, not forgiven.</strong> The 0%-payout comparison
          shows the C-Corp at a flat 21%, but every retained dollar is taxed again at LTCG rates in
          the year it is eventually distributed. The crossover tells you about <em>timing</em>, not
          a permanent 21% ceiling.
        </li>
        <li>
          <strong>Two surtaxes are excluded — and they pull in opposite directions.</strong> The
          0.9% Additional Medicare Tax (Form 8959) applies once the SE Medicare base — 92.35% of
          profit — crosses $200,000 for a single filer (about $216,568 of profit); excluding it
          understates the LLC bill by roughly {usd(ADL_MEDICARE_500K, 0)} a year at $500k and{' '}
          {usd(ADL_MEDICARE_1M, 0)} at $1M. The 3.8% net investment income tax, conversely, lands
          only on the C-Corp&rsquo;s dividends (active pass-through income is NIIT-exempt), and its
          base is the <em>lesser</em> of net investment income and MAGI minus $200,000 — so the
          exact size depends on what else sits on the return. With the{' '}
          {usd(COMPARE_ROWS[4].r.ccorp.dividends, 0)} of dividends a $1M full-payout C-Corp
          generates as the shareholder&rsquo;s only income, the exposed base is{' '}
          {usd(NIIT_BASE_1M, 0)} and the tax {usd(NIIT_LESSEROF_1M, 0)}; the{' '}
          {usd(NIIT_1M, 0)} full-exposure figure applies only when other income already fills the
          threshold. Counting both surtaxes on that lesser-of basis, the $1M LLC saving would be
          about {usd(TRUE_1M_SAVING_LESSEROF, 0)} rather than the modeled{' '}
          {usd(COMPARE_ROWS[4].r.delta, 0)}. The $200k worked example above sits below both
          triggers ($158,000 of dividends against a $200,000 MAGI threshold; SE base $184,700
          &lt; $200,000), so it is unaffected.
        </li>
        <li>
          <strong>State taxes vary enormously.</strong> California charges LLCs an $800 minimum
          franchise tax plus a gross-receipts fee; Texas has no state income tax but a franchise
          margin tax. Always model state-level impact.
        </li>
        <li>
          <strong>QBI has income limits and service-business phase-outs</strong> for certain
          &ldquo;specified service trades or businesses&rdquo; (SSTBs) like consulting, law, medicine, and
          financial services. Above $197,300 single / $394,600 married filing jointly (2025
          thresholds per Rev. Proc. 2024-40), the QBI deduction begins phasing out for SSTBs over a
          $50,000 / $100,000 range. This calculator does not model the phase-out.
        </li>
      </ul>
      <p>
        Use this calculator for directional guidance and to build intuition — then have a licensed
        CPA model your specific numbers before filing.
      </p>

      <h2 id="glossary">Glossary</h2>
      <p>
        Short definitions for readers meeting these terms for the first time. The only numbers here
        are the statutory constants the engine itself carries; everything computed lives in the
        sections above.
      </p>
      <dl className="mb-6 mt-2 space-y-5">
        {GLOSSARY.map(([term, definition]) => (
          <div key={term}>
            <dt className="font-semibold text-slate-900 dark:text-slate-100">{term}</dt>
            <dd className="mt-1 leading-relaxed text-slate-600 dark:text-slate-300">{definition}</dd>
          </div>
        ))}
      </dl>

      <Faq
        items={[
          {
            question: 'Is an LLC or C-Corp better for taxes?',
            answer: `For most small and cash-flow businesses, an LLC taxed as a pass-through results in lower total federal tax because profit is taxed only once (with a 20% QBI deduction). A C-Corp faces double taxation — once at the 21% corporate rate, then again as dividend tax when profit is distributed. The C-Corp comes out ahead on current-year tax only when you distribute lightly: the tie payout runs from the mid-50s to the high-70s percent depending on profit — ${pct((findCrossoverPayout(300_000) ?? 0) * 100, 1)} at $300k, ${pct((findCrossoverPayout(500_000) ?? 0) * 100, 1)} at $500k, ${pct(TIE_1M * 100, 1)} at $1M — and below ${usd(CROSSOVER, 0)} of profit no payout share favors it at all (see the decision-boundaries table). If you are raising venture capital, the C-Corp is usually dictated by investors regardless of tax.`,
          },
          {
            question: 'What is double taxation in a C-Corp?',
            answer:
              'Double taxation means the same dollar of business profit is taxed twice before reaching the owner: first as corporate income tax at a flat 21% federal rate, and again as personal income tax (at long-term capital gains rates of 0/15/20%) when the after-tax profit is distributed as a qualified dividend to shareholders.',
          },
          {
            question: 'What is the QBI deduction and who qualifies?',
            answer:
              'The Qualified Business Income (QBI) deduction lets eligible pass-through businesses (sole proprietorships, partnerships, S-corps, and most LLCs) deduct 20% of their qualified business income from taxable income. It phases out for certain "specified service trades or businesses" (consulting, law, medicine, finance, etc.) at high income — the caveats section carries the 2025 thresholds and phase-out ranges.',
          },
          {
            question: 'How much self-employment tax does an LLC owner pay?',
            answer:
              'An LLC owner taxed as a sole proprietorship pays 15.3% self-employment tax (12.4% Social Security + 2.9% Medicare) on 92.35% of net business income — Schedule SE reduces the base because half of the tax is itself deductible — until that base reaches the 2025 wage base of $176,100, then 2.9% Medicare on anything above. Half of the SE tax is deductible against income tax. Electing S-Corp status can reduce this by splitting income between a reasonable W-2 salary and distributions that are not subject to SE tax.',
          },
          {
            question: 'Can an LLC be taxed as a C-Corp or S-Corp?',
            answer:
              'Yes. An LLC is a state-law entity, not a federal tax classification. By default a single-member LLC is taxed as a sole proprietorship and a multi-member LLC as a partnership, but you can file IRS Form 8832 to be taxed as a C-Corp or Form 2553 to be taxed as an S-Corp. This flexibility is one of the LLC\'s biggest advantages — you choose the tax treatment that fits your situation.',
          },
          {
            question: 'Do these numbers include state taxes?',
            answer:
              'No. This calculator models federal taxes only for a simplified single-owner scenario. State taxes can add 0% (Texas, Florida, Nevada) to over 13% (California) on top of the federal bill, and states also differ in how they tax entities (e.g., California\'s $800 LLC franchise fee, Texas\'s margin tax). Always factor state taxes into your real-world decision.',
          },
          {
            question: 'Should I just pick whichever entity has the lower tax?',
            answer:
              'No — tax is one of several factors. If you plan to raise venture capital or offer broad employee equity, you almost certainly need a C-Corp regardless of the tax cost. If you run a cash-flow lifestyle business, an LLC (possibly electing S-Corp tax later) is usually better. Talk to a CPA and a startup attorney about your specific growth and funding plan.',
          },
          {
            question: 'Does the LLC win at every profit level if I distribute everything?',
            answer: `In this model, yes. The engine scans profit from $0 to $5M in $25,000 steps at 100% payout and the C-Corp wins ${FULL_PAYOUT_CCORP_WINS} of ${FULL_PAYOUT_RUNGS.toLocaleString()} rungs. The margin widens with profit — from about ${usd(COMPARE_ROWS[0].r.delta, 0)} at $50k to ${usd(COMPARE_ROWS[4].r.delta, 0)} at $1M — because the fully-distributed C-Corp's effective rate keeps climbing toward its computed ceiling of ${pct(CCORP_CEILING * 100, 1)} while the LLC's flattens well below it.`,
          },
          {
            question: "Isn't C-Corp double taxation just 21% + 15% = 36%?",
            answer: `No — the two layers do not add, they compound on what survives. The dividend tax applies to the 79% left after the corporate layer, so the true stack is 21% + 15% × 79% = ${pct(CCORP_STACK_15 * 100, 2)} in the 15% band, with a computed ceiling of 21% + 20% × 79% = ${pct(CCORP_CEILING * 100, 1)} where dividends reach the 20% band. A $10M fully-distributed C-Corp in this model levels off at ${pct(CCORP_10M.effectiveRate, 1)} — still under that ceiling.`,
          },
          {
            question: 'Is there a profit level where the dividend tax is zero even at full payout?',
            answer: `Yes. While 79% of profit stays under the $48,350 top of the 0% LTCG band — profit below about ${usd(DIV_FREE_PROFIT, 0)} ($48,350 ÷ 79%) under this model's convention — a fully-distributed C-Corp pays exactly 21% and nothing more. (Under §1(h) the breakpoints attach to taxable income, so a shareholder whose only income is dividends gets a wider real window, nearer ${usd(DIV_FREE_PROFIT_STATUTORY, 0)} — the glossary's LTCG entry explains the simplification.) At $60,000 of profit that is ${usd(WORKED_60K.ccorp.totalTax, 0)} against the LLC's ${usd(WORKED_60K.llc.totalTax, 0)}: the C-Corp still loses, but the entire second layer of the "double tax" vanishes (see the worked example above).`,
          },
          {
            question: 'At what profit does a retaining C-Corp overtake the LLC?',
            answer: `The engine puts the crossover at ${usd(CROSSOVER, 0)} of profit — both stacks cost almost exactly 21% there. Below it, the LLC's full pass-through stack is cheaper than the flat corporate layer; above it, a C-Corp that distributes little wins on current-year tax, by ${usd(RETAIN_500K.delta, 0)} a year at $500k with zero payout.`,
          },
          {
            question: 'How much can I distribute in dividends before the LLC wins again?',
            answer: `It depends on profit, and not smoothly: the computed tie payout is ${pct((findCrossoverPayout(500_000) ?? 0) * 100, 1)} at $500k, ${pct(TIE_1M * 100, 1)} at $1M, and ${pct(TIE_2M * 100, 1)} at $2M. Below ${usd(CROSSOVER, 0)} of profit there is no tie at all — the LLC is cheaper at every payout share, zero included. The full table and the reasons for its shape are in the decision-boundaries section.`,
          },
          {
            question: 'Why does the payout threshold peak just below about $190,700 of profit?',
            answer: `Because that is where the SE base catches the Social Security wage base: $176,100 ÷ 92.35% = ${usd(SHAPE.seCapKinkProfit, 0)} of profit. Below the kink the LLC pays 15.3% SE tax on its marginal dollar; just above, only 2.9% — so the LLC gets cheaper fast and the C-Corp's winning region shrinks. The computed threshold falls from a ${pct(SHAPE.peak.payout * 100, 1)} peak to a ${pct(SHAPE.trough.payout * 100, 1)} trough near ${usd(SHAPE.trough.profit, 0)} before recovering.`,
          },
          {
            question: 'My side business makes only a few thousand dollars — do I owe federal tax either way?',
            answer: `Below about $433 of net profit ($400 ÷ 92.35%, the Schedule SE floor) there is no SE tax at all. At $5,000 of profit the LLC's entire federal bill in this model is ${usd(SMALL_5K.llc.totalTax, 0)} of SE tax — the standard deduction alone zeroes out income tax — while the C-Corp would owe a flat ${usd(SMALL_5K.ccorp.totalTax, 0)}.`,
          },
          {
            question: 'Can I defer tax by leaving money inside my LLC?',
            answer: `No — that is the C-Corp's lever, not the LLC's. Pass-through profit is taxed on your personal return in the year it is earned, whether or not you draw it; leaving cash in the LLC's bank account changes nothing. Only the C-Corp can hold after-tax profit (${usd(RETAIN_500K.ccorp.retained, 0)} at $500k with zero payout) and defer the dividend layer to a later year.`,
          },
          {
            question: 'Does a C-Corp get the 20% QBI deduction?',
            answer:
              'No — §199A is a pass-through deduction by statute; a C-Corp has no QBI line at all. The C-Corp\u2019s rough equivalents are different in kind: a deductible owner salary (outside this model) and the flat 21% rate itself. This is one structural reason the two columns are not mirror images.',
          },
          {
            question: 'Do C-Corp owners pay self-employment tax?',
            answer:
              'Not on dividends — qualified dividends carry no SE or FICA tax, though they also earn no half-of-SE deduction. Owner salary inside a C-Corp is W-2 wages and pays FICA through payroll instead; this model excludes salary entirely, which is precisely the blend the S-Corp Salary Calculator was built to price.',
          },
          {
            question: 'What happens to retained C-Corp money when it is finally distributed?',
            answer: `It pays the LTCG schedule in the year of distribution — deferral, not forgiveness. At $500k of profit, distributing the retained ${usd(RETAIN_500K.ccorp.retained, 0)} later adds ${usd(FULL_500K.ccorp.dividendTax, 0)} of dividend tax, taking the C-Corp's all-in to ${usd(FULL_500K.ccorp.totalTax, 0)} — still ${usd(FULL_500K.delta, 0)} more than the LLC's ${usd(FULL_500K.llc.totalTax, 0)}. At this profit level, deferral buys timing, not an outright win once everything is eventually paid out.`,
          },
          {
            question: "I'm a consultant — an SSTB. Do the LLC numbers here hold for me?",
            answer: `Only below the phase-out. This model grants the 20% QBI deduction in full — a ${usd(FULL_500K.llc.qbiDeduction, 0)} deduction at $500k of profit. A specified service trade above the §199A income threshold loses it over a narrow income range, which raises the real pass-through bill while leaving the C-Corp column unchanged.`,
          },
          {
            question: 'What about married filing jointly?',
            answer:
              'This model is single-filer throughout. MFJ roughly doubles the standard deduction and bracket widths, which trims the LLC\u2019s income tax while leaving the flat 21% + LTCG C-Corp stack essentially untouched — so the LLC\u2019s edge generally widens slightly. Treat the direction as reliable and the dollar amounts as single-filer.',
          },
          {
            question: "Why does the LLC's effective-rate curve bend around $190,000 of profit?",
            answer: `The SE marginal rate drops from 15.3% to 2.9% once the SE base passes the $176,100 Social Security wage base — ${usd(SHAPE.seCapKinkProfit, 0)} of profit at the 92.35% base factor. The LLC's total-rate curve flattens accordingly, which is visible in the effective-rate chart on this page and is why the payout threshold peaks just below the kink.`,
          },
        ]}
      />

      <RelatedCalculators
        links={[
          { href: '/s-corp-tax-calculator/', label: 'S-Corp Salary Calculator' },
          { href: '/freelance-hourly-rate-calculator/', label: 'Freelance Hourly Rate' },
          { href: '/saas-runway-calculator/', label: 'SaaS Runway' },
        ]}
      />
    </article>
  );
}

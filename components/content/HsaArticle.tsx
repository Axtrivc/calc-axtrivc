import Faq from '@/components/Faq';
import { ArticleToc, RelatedCalculators } from '@/components/Article';
import { compareHsa, hsaLimitFor, hsaHorizonSweep, HSA_CONSTANTS, nonQualifiedWithdrawal } from '@/lib/hsa';
import { usd, pct } from '@/lib/format';

/**
 * Build-time-computed guide: every dollar figure below comes from lib/hsa.ts
 * at render time — the same engine that powers the widget — so the prose can
 * never drift from the model.
 */
export default function HsaArticle() {
  // Reference case: the calculator's own defaults — family limit, 24% bracket,
  // 7% return, 25 years, 40% spent on care, 25% forfeited.
  const BASE = {
    contribution: HSA_CONSTANTS.familyLimit,
    coverage: 'family' as const,
    age55: false,
    marginalRatePct: 24,
    returnRatePct: 7,
    years: 25,
    medicalSpendShare: 0.4,
    forfeitShare: 0.25,
  };
  const mixed = compareHsa(BASE);
  const saveAll = compareHsa({ ...BASE, medicalSpendShare: 0, forfeitShare: 0 });
  const spendNow = compareHsa({ ...BASE, medicalSpendShare: 1 });
  const lowBracket = compareHsa({ ...BASE, marginalRatePct: 12 });
  const highBracket = compareHsa({ ...BASE, marginalRatePct: 35 });
  const catchUpCase = compareHsa({ ...BASE, age55: true, contribution: hsaLimitFor('family', true) });

  // Horizon milestones from the same engine (1-indexed by year).
  const horizon = hsaHorizonSweep(BASE, 40);
  const at = (n: number) => horizon[n - 1];

  // Receipt strategy worked example: a $3,000 bill reimbursed 15 years later
  // at 7% — the growth earned inside the account on money that was already
  // deductible going in.
  const receiptGrowth = 3_000 * (Math.pow(1.07, 15) - 1);

  // The 20% caliber, at three withdrawal sizes and two brackets.
  const penalty5k24 = nonQualifiedWithdrawal(5_000, 24);
  const penalty5k32 = nonQualifiedWithdrawal(5_000, 32);
  const penalty20k24 = nonQualifiedWithdrawal(20_000, 24);

  // FICA illustration (arithmetic only, never part of the model): payroll
  // contributions at the family limit escape 7.65%.
  const ficaIllustration = HSA_CONSTANTS.familyLimit * 0.0765;

  const toc = [
    { id: 'why-triple', label: 'Three tax breaks, one account' },
    { id: 'three-usages', label: 'The three usages' },
    { id: 'worked-example', label: 'Worked example at $8,550' },
    { id: 'receipts', label: 'The receipt strategy' },
    { id: 'eligibility', label: 'Eligibility: the HDHP gate' },
    { id: 'limits', label: 'Limits and the 55+ catch-up' },
    { id: 'penalty', label: 'The 20% additional tax' },
    { id: 'fica', label: 'The FICA angle' },
    { id: 'caveats', label: 'Important caveats' },
    { id: 'glossary', label: 'Glossary' },
    { id: 'faq', label: 'FAQ' },
  ];

  return (
    <article className="prose-article">
      <ArticleToc items={toc} />

      <h2 id="why-triple">Three tax breaks, one account</h2>
      <p>
        Every other tax-advantaged account gives you two of the three. A traditional 401(k) or IRA:
        deductible going in, taxed coming out. A Roth: taxed going in, never again. A Health Savings
        Account does all three at once — contributions inside the annual limit are deductible
        (IRC §223(a), even when you write the check yourself rather than going through payroll),
        investment growth inside the account is never taxed (§223(e)), and withdrawals for qualified
        medical expenses are never taxed either (§223(f)). Money passes through the entire tax system
        untouched.
      </p>
      <p>
        That is why HSAs get called the <strong>stealth retirement account</strong>. Nothing forces
        you to spend the balance on care: you can pay this year&apos;s medical bills from outside cash,
        let the HSA compound for decades, and withdraw tax-free later — qualified medical expenses
        can be reimbursed at any future date. And the escape hatch is unusually forgiving: after age
        65, withdrawals for <em>anything</em> drop the 20% penalty and are taxed as ordinary income —
        exactly a traditional IRA — while medical withdrawals stay free. Medicare premiums (Part B, D,
        Medicare Advantage, and qualified long-term-care premiums within statutory limits) are
        themselves qualified expenses, which is why retirement planners treat the account as a
        dedicated medical 401(k): Fidelity&apos;s retiree-health-cost surveys put a typical
        couple&apos;s lifetime medical bill well into six figures.
      </p>
      <p>
        The catch is the gate: you must be covered by a High Deductible Health Plan and by nothing
        else that pays medical bills (see <a href="#eligibility">eligibility</a>). The reward for
        living behind a large deductible is the most efficient savings vehicle in the code.
      </p>

      <h2 id="three-usages">The three usages</h2>
      <p>
        The same dollars behave very differently depending on how you use the account. The
        calculator prices all three against a taxable twin that receives the <strong>same pre-tax
        earnings</strong> — the twin pays tax first, buys the same care, and invests the rest:
      </p>
      <table>
        <thead>
          <tr>
            <th>Usage</th>
            <th>What happens</th>
            <th>Value at year {BASE.years}</th>
            <th>Taxable twin</th>
            <th>Advantage</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Spend as you go</td>
            <td>Each year&apos;s contribution pays that year&apos;s care, tax-free</td>
            <td>{usd(spendNow.spendNow.taxShield, 0)}</td>
            <td>{usd(0, 0)}</td>
            <td><strong>{usd(spendNow.spendNow.taxShield, 0)}</strong></td>
          </tr>
          <tr>
            <td>Save to retire</td>
            <td>Nothing spent; balance compounds untouched</td>
            <td>{usd(saveAll.saveForLater.balance, 0)}</td>
            <td>{usd(saveAll.saveForLater.taxableTwinDrag, 0)}</td>
            <td><strong>{usd(saveAll.saveForLater.advantageDrag, 0)}</strong></td>
          </tr>
          <tr>
            <td>Mixed (40% spent, 25% forfeited)</td>
            <td>Care paid tax-free; remainder rides; a quarter cashed out non-medically at the end</td>
            <td>{usd(mixed.mixed.value, 0)}</td>
            <td>{usd(mixed.mixed.taxableTwinBalance, 0)}</td>
            <td><strong>{usd(mixed.mixed.advantage, 0)}</strong></td>
          </tr>
        </tbody>
      </table>
      <p>
        Computed at the family limit ({usd(HSA_CONSTANTS.familyLimit, 0)}), a {pct(24, 0)} bracket,{' '}
        {pct(7, 0)} return. Read the first row carefully: <em>even a balance that never exists</em>{' '}
        captures {usd(spendNow.spendNow.taxShield, 0)} — the income tax never paid on 25 years of
        medical dollars. The second row shows what compounding adds when the care is paid from
        outside cash instead. The third is where most real households live, and it is the number the
        tool treats as your headline.
      </p>

      <h2 id="worked-example">Worked example: {usd(HSA_CONSTANTS.familyLimit, 0)} a year at a {pct(24, 0)} bracket</h2>
      <p>
        Family HDHP coverage, no age-55 catch-up, {pct(7, 0)} expected return, 25-year horizon —
        computed by this page&apos;s own model:
      </p>
      <table>
        <thead>
          <tr>
            <th>Line</th>
            <th>HSA</th>
            <th>Taxable twin</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Pre-tax earnings earmarked / yr</td>
            <td>{usd(HSA_CONSTANTS.familyLimit, 0)}</td>
            <td>{usd(HSA_CONSTANTS.familyLimit, 0)}</td>
          </tr>
          <tr>
            <td>Tax on the way in</td>
            <td>— deductible (§223(a))</td>
            <td>−{usd(HSA_CONSTANTS.familyLimit * 0.24, 0)}</td>
          </tr>
          <tr>
            <td>Amount at work / yr</td>
            <td>{usd(HSA_CONSTANTS.familyLimit, 0)}</td>
            <td>{usd(HSA_CONSTANTS.familyLimit * 0.76, 0)}</td>
          </tr>
          <tr>
            <td>Effective growth rate</td>
            <td>{pct(7, 0)} — untaxed</td>
            <td>{pct(7 * 0.76, 2)} — growth taxed yearly at 24%</td>
          </tr>
          <tr>
            <td><strong>Balance at year 25</strong></td>
            <td><strong>{usd(saveAll.saveForLater.balance, 0)}</strong></td>
            <td><strong>{usd(saveAll.saveForLater.taxableTwinDrag, 0)}</strong></td>
          </tr>
          <tr>
            <td>Tax on the way out (qualified medical)</td>
            <td>none</td>
                <td>none — already taxed</td>
          </tr>
          <tr>
            <td><strong>Advantage</strong></td>
            <td colSpan={2}><strong>{usd(saveAll.saveForLater.advantageDrag, 0)}</strong></td>
          </tr>
        </tbody>
      </table>
      <p>
        Two honesty checks the model applies to itself. First, the taxable twin&apos;s growth is
        taxed <em>annually</em> at your full rate — exact for interest-like money, harsh for
        long-held equities. So the zero-drag bound is computed too: even if the twin&apos;s growth
        were never taxed at all, it ends at {usd(saveAll.saveForLater.taxableTwinNoDrag, 0)} and the
        HSA still wins by {usd(saveAll.saveForLater.advantageNoDrag, 0)}. The true taxable result
        sits between the two — the advantage is a range, not a point, and the tool brackets it
        rather than picking the flattering end. Second, the deduction is worth your marginal rate:
        the same inputs at a {pct(12, 0)} bracket end {usd(lowBracket.mixed.advantage, 0)} ahead
        (mixed usage), at {pct(35, 0)} it is {usd(highBracket.mixed.advantage, 0)} — the HSA is the
        one account whose sales pitch gets stronger the more you earn.
      </p>
      <p>
        The age-55 catch-up compounds too: it lifts the limit to{' '}
        {usd(hsaLimitFor('family', true), 0)}, and over the same 25 years the save-to-retire balance
        reaches {usd(catchUpCase.saveForLater.balance, 0)} —{' '}
        {usd(catchUpCase.saveForLater.balance - saveAll.saveForLater.balance, 0)} more than the same
        saver without it.
      </p>

      <h2 id="receipts">The receipt strategy</h2>
      <p>
        The least-exploited feature of the HSA is that <strong>reimbursement has no deadline</strong>.
        A qualified medical expense can be paid out of pocket today and reimbursed from the HSA in
        any later year — next year, or in retirement — while the law only requires that the expense
        was incurred <em>after</em> the HSA was established and while you were HSA-eligible. Keep the
        itemized receipts (provider statements, EOBs) somewhere durable; the burden of proof is
        yours if asked.
      </p>
      <p>
        The arithmetic is the whole game. Pay a {usd(3_000, 0)} bill from outside cash and reimburse
        yourself 15 years later, and the {usd(3_000, 0)} that stayed invested at {pct(7, 0)} earned{' '}
        {usd(receiptGrowth, 0)} of growth — tax-free, on money that was already deductible going in.
        Run the same strategy at scale and your year-25 save-to-retire balance looks like the
        horizon table below: {usd(at(10).hsa, 0)} at a decade, {usd(at(20).hsa, 0)} at two,{' '}
        {usd(at(30).hsa, 0)} at three — against a fully-taxed twin&apos;s {usd(at(30).taxableDrag, 0)}{' '}
        (zero-drag bound {usd(at(30).taxableNoDrag, 0)}).
      </p>
      <p>
        Coordination matters: expenses must not have been reimbursed by insurance or an FSA, and
        expenses incurred <em>before</em> the HSA existed never qualify. A limited-purpose FSA
        (dental/vision only) coexists fine with HSA eligibility; a general-purpose one does not.
      </p>

      <h2 id="eligibility">Eligibility: the HDHP gate</h2>
      <p>
        You may contribute for a month only if, on the first day of that month, you are covered by an
        HDHP and have no <em>other</em> coverage that pays medical expenses. For 2025 an HDHP is a
        plan whose annual deductible is at least {usd(HSA_CONSTANTS.hdhpMinDeductibleSelf, 0)}
        (self-only) / {usd(HSA_CONSTANTS.hdhpMinDeductibleFamily, 0)} (family) and whose annual
        out-of-pocket maximum does not exceed {usd(HSA_CONSTANTS.hdhpMaxOutOfPocketSelf, 0)} /{' '}
        {usd(HSA_CONSTANTS.hdhpMaxOutOfPocketFamily, 0)} (IRS Rev. Proc. 2024-25). The trips that
        disqualify people most often:
      </p>
      <ul>
        <li>
          <strong>A spouse&apos;s general-purpose FSA or non-HDHP plan</strong> covering you — even
          unused coverage blocks contributions (limited-purpose FSAs and HRAs are fine).
        </li>
        <li>
          <strong>Medicare</strong> — enrollment ends eligibility from its first month; apply for
          Part A late and retroactive coverage can reach back six months, turning earlier
          contributions into excess ones.
        </li>
        <li>
          <strong>The last-month rule</strong> — hold HDHP coverage on December 1 and you get the
          full-year limit, but you must stay eligible through the following testing period
          (all 12 months) or the excess is taxed back.
        </li>
        <li>
          Being claimed as a dependent, or <strong>VA/IHS/TRICARE-for-Life</strong> secondary
          coverage — check with a professional; the general rule is &ldquo;other medical coverage
          blocks the HSA.&rdquo;
        </li>
      </ul>

      <h2 id="limits">Limits and the 55+ catch-up</h2>
      <table>
        <thead>
          <tr>
            <th>Coverage tier</th>
            <th>2025 limit</th>
            <th>2026 (announced)</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Self-only HDHP</td>
            <td>{usd(HSA_CONSTANTS.selfLimit, 0)}</td>
            <td>{usd(4_400, 0)}</td>
          </tr>
          <tr>
            <td>Family HDHP</td>
            <td>{usd(HSA_CONSTANTS.familyLimit, 0)}</td>
            <td>{usd(8_750, 0)}</td>
          </tr>
          <tr>
            <td>Catch-up, age 55+</td>
            <td>+{usd(HSA_CONSTANTS.catchUp55, 0)}</td>
            <td>+{usd(HSA_CONSTANTS.catchUp55, 0)}</td>
          </tr>
        </tbody>
      </table>
      <p>
        2025 amounts per IRS Rev. Proc. 2024-25; 2026 per Rev. Proc. 2025-19 — the limits index
        annually and this tool stays pinned to 2025 (the calculator holds your contribution constant
        in nominal dollars; real contribution room grows with each COLA). The catch-up is statutory
        (§223(b)(3)) and never indexes. It belongs to the <em>account holder</em>: two 55+ spouses
        on one family HDHP each need their own HSA to bank two catch-ups. Prorate by eligible months
        if you were not HDHP-covered all year and did not qualify under the last-month rule, and
        coordinate with any employer contributions — the limit is shared, not additive. Excess
        contributions earn a 6% excise tax for every year they remain uncorrected; withdraw the
        excess (plus earnings) before the filing deadline to unwind it.
      </p>

      <h2 id="penalty">The 20% additional tax</h2>
      <p>
        Withdraw money for anything other than qualified medical expenses before 65 and two taxes
        stack: the distribution is ordinary income (§223(f)(1)) <em>plus</em> a 20% additional tax on
        the gross amount (§223(f)(4)). The calculator carries this caliber in its mixed scenario —
        the &ldquo;forfeit share&rdquo; haircut is exactly income tax + 20% on the share you assume
        gets cashed out:
      </p>
      <table>
        <thead>
          <tr>
            <th>Non-medical withdrawal</th>
            <th>Bracket</th>
            <th>Income tax</th>
            <th>20% additional</th>
            <th>Survives</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>{usd(penalty5k24.gross, 0)}</td>
            <td>{pct(24, 0)}</td>
            <td>−{usd(penalty5k24.incomeTax, 0)}</td>
            <td>−{usd(penalty5k24.additionalTax, 0)}</td>
            <td><strong>{usd(penalty5k24.net, 0)}</strong></td>
          </tr>
          <tr>
            <td>{usd(penalty5k32.gross, 0)}</td>
            <td>{pct(32, 0)}</td>
            <td>−{usd(penalty5k32.incomeTax, 0)}</td>
            <td>−{usd(penalty5k32.additionalTax, 0)}</td>
            <td><strong>{usd(penalty5k32.net, 0)}</strong></td>
          </tr>
          <tr>
            <td>{usd(penalty20k24.gross, 0)}</td>
            <td>{pct(24, 0)}</td>
            <td>−{usd(penalty20k24.incomeTax, 0)}</td>
            <td>−{usd(penalty20k24.additionalTax, 0)}</td>
            <td><strong>{usd(penalty20k24.net, 0)}</strong></td>
          </tr>
        </tbody>
      </table>
      <p>
        After 65 (or disability or death) the 20% surtax disappears; the income tax remains, making
        the account behave like a traditional IRA for non-medical money. In the worked example, the{' '}
        {usd(saveAll.saveForLater.balance, 0)} balance spent on qualified care in retirement is worth
        every dollar — used for anything else after 65 it is worth{' '}
        {usd(saveAll.saveForLater.post65AnyUse, 0)} at a {pct(24, 0)} bracket. For reference, the
        same-age withdrawal from a Roth IRA would be tax-free but never deducted going in, and from a
        traditional IRA fully taxed — the comparison the{' '}
        <a href="/roth-vs-traditional-calculator/">Roth vs Traditional Calculator</a> makes for
        retirement dollars.
      </p>

      <h2 id="fica">The FICA angle</h2>
      <p>
        One more tax break exists that this tool deliberately <em>never</em> claims: HSA
        contributions routed through an employer&apos;s cafeteria-plan payroll deduction are exempt
        from Social Security and Medicare tax — an extra 7.65% ({usd(ficaIllustration, 0)} a year at
        the family limit) that comes on top of everything modeled above. Two honest limits on it:
        the exemption rides the employee-side payroll machinery (wages above the Social Security
        tax cap save only the 1.45%+0.9% Medicare slice), and more-than-2% S-corp shareholders are
        treated like partners (IRC §1372): they cannot use cafeteria-plan salary reduction — their
        contributions reach the HSA as wages and get the above-the-line deduction instead, so the
        FICA saving generally does not apply to them. Counting nothing, the model&apos;s numbers are
        a floor for employees; owners running payroll through an S-corp should treat them as the
        whole story.
      </p>

      <h2 id="caveats">Important caveats</h2>
      <ul>
        <li>
          Nominal dollars throughout; the contribution is held constant (limits index annually —
          2026: {usd(4_400, 0)} / {usd(8_750, 0)}), returns are assumed level every year, and
          sequence risk is not modeled.
        </li>
        <li>
          The taxable-twin convention: growth taxed annually at your entered marginal rate
          (interest-like), with the zero-drag bound shown alongside — the true taxable result for a
          long-held equity portfolio sits between the two.
        </li>
        <li>
          Federal only, at the marginal rate you enter. California and New Jersey do not conform to
          HSA tax treatment and tax the account&apos;s earnings at the state level; other states
          vary.
        </li>
        <li>
          The model prices behavior, not eligibility: whether you may contribute at all is the HDHP
          gate above. FICA savings, HSA administration/investment fees, and state taxes are outside
          the math.
        </li>
        <li>
          Nothing here is tax, legal, or investment advice. Confirm current-year limits and your
          coverage situation with a qualified professional.
        </li>
      </ul>

      <h2 id="glossary">Glossary</h2>
      <dl className="mb-4">
        <dt className="mt-4 font-semibold text-slate-900 dark:text-slate-100">Triple tax advantage</dt>
        <dd className="ml-0 leading-relaxed text-slate-600 dark:text-slate-300">
          The three stacked breaks of IRC §223: deductible contributions, tax-free growth, tax-free
          qualified withdrawals. Every other account offers at most two.
        </dd>
        <dt className="mt-4 font-semibold text-slate-900 dark:text-slate-100">HDHP</dt>
        <dd className="ml-0 leading-relaxed text-slate-600 dark:text-slate-300">
          High Deductible Health Plan — the eligibility gate. For 2025: deductible at least{' '}
          {usd(HSA_CONSTANTS.hdhpMinDeductibleSelf, 0)} self-only /{' '}
          {usd(HSA_CONSTANTS.hdhpMinDeductibleFamily, 0)} family, out-of-pocket cap at most{' '}
          {usd(HSA_CONSTANTS.hdhpMaxOutOfPocketSelf, 0)} / {usd(HSA_CONSTANTS.hdhpMaxOutOfPocketFamily, 0)}.
        </dd>
        <dt className="mt-4 font-semibold text-slate-900 dark:text-slate-100">Qualified medical expense</dt>
        <dd className="ml-0 leading-relaxed text-slate-600 dark:text-slate-300">
          An expense under IRC §223(d)(2) / IRS Publication 502 — deductibles, copays, prescriptions,
          most dental and vision, and certain insurance premiums (COBRA, Medicare B/D and Advantage,
          long-term-care premiums within age-based limits). Cosmetic surgery and general wellness
          items are not; non-prescription drugs and menstrual products are (CARES Act).
        </dd>
        <dt className="mt-4 font-semibold text-slate-900 dark:text-slate-100">20% additional tax</dt>
        <dd className="ml-0 leading-relaxed text-slate-600 dark:text-slate-300">
          The surtax on non-qualified distributions (§223(f)(4)), stacked on ordinary income tax —
          44% total at a 24% bracket. Gone after 65, disability, or death.
        </dd>
        <dt className="mt-4 font-semibold text-slate-900 dark:text-slate-100">Last-month rule</dt>
        <dd className="ml-0 leading-relaxed text-slate-600 dark:text-slate-300">
          HDHP coverage on December 1 earns the full-year contribution limit, conditioned on staying
          eligible through the next year&apos;s testing period — fail it and the excess is income.
        </dd>
        <dt className="mt-4 font-semibold text-slate-900 dark:text-slate-100">Receipt strategy</dt>
        <dd className="ml-0 leading-relaxed text-slate-600 dark:text-slate-300">
          Paying qualified bills from outside cash and reimbursing yourself from the HSA years later,
          keeping the money invested in between. No reimbursement deadline exists; the expense just
          has to postdate the account.
        </dd>
        <dt className="mt-4 font-semibold text-slate-900 dark:text-slate-100">Taxable twin</dt>
        <dd className="ml-0 leading-relaxed text-slate-600 dark:text-slate-300">
          This tool&apos;s fairness device: the same pre-tax dollars paid to a normal taxable
          account — taxed on the way in, growth taxed annually, no special treatment. Every HSA
          number here is an advantage <em>over the twin</em>, not a stand-alone projection.
        </dd>
        <dt className="mt-4 font-semibold text-slate-900 dark:text-slate-100">Cafeteria plan</dt>
        <dd className="ml-0 leading-relaxed text-slate-600 dark:text-slate-300">
          The §125 payroll machinery that lets employees fund an HSA pre-FICA. The 7.65% saving it
          provides is real for employees and generally unavailable to more-than-2% S-corp
          shareholders — so this tool models none of it.
        </dd>
      </dl>

      <Faq
        items={[
          {
            question: 'Is an HSA really better than a 401(k)?',
            answer: (
              <p>
                For money you will spend on medical care, yes — structurally. A 401(k) offers two
                breaks (deduction, tax-deferred growth); the HSA adds the third (tax-free qualified
                withdrawals). Neither account escapes FICA on the funding dollars — 401(k) deferrals
                and personally funded HSA contributions both come out of FICA-taxed wages; only §125
                payroll funding escapes it (see the FICA angle below). At this page&apos;s worked
                example the save-to-retire usage ends{' '}
                {usd(saveAll.saveForLater.advantageDrag, 0)} ahead of the taxable twin after 25
                years. The 401(k) still wins on raw capacity — compare the two limits with the{' '}
                <a href="/solo-401k-calculator/">Solo 401(k) vs SEP-IRA Calculator</a> — and
                employer 401(k) matches beat any tax structure. Best order for most people:
                401(k) match → max the HSA → rest of the 401(k).
              </p>
            ),
          },
          {
            question: 'What counts as a qualified medical expense?',
            answer: (
              <p>
                The IRC §223(d)(2) list, interpreted by IRS Publication 502: deductibles, copays,
                coinsurance, prescriptions, glasses, dental work, braces, hearing aids, and certain
                premiums (COBRA, Medicare B/D and Advantage, long-term-care insurance within
                age-based caps). Not qualified: cosmetic surgery, gym memberships, most insurance
                premiums, and Medigap. Non-prescription drugs and menstrual products have qualified
                since the CARES Act.
              </p>
            ),
          },
          {
            question: 'Can I reimburse myself years later for old medical bills?',
            answer: (
              <p>
                Yes — there is no reimbursement deadline. The expense must have been incurred after
                your HSA was established and while you were HSA-eligible, and it must not have been
                reimbursed elsewhere (insurance, an FSA). Keep the itemized receipts: that is the
                entire administrative burden of the receipt strategy, and it makes this
                year&apos;s {usd(3_000, 0)} bill a legitimately tax-free {usd(3_000, 0)} withdrawal
                at any later date. The {usd(3_000, 0)} you did not withdraw keeps compounding
                untaxed in the meantime — the {usd(receiptGrowth, 0)} it earns at {pct(7, 0)} over
                15 years stays in the account, spendable tax-free only against future qualified
                medical expenses.
              </p>
            ),
          },
          {
            question: 'What happens if I withdraw HSA money for non-medical expenses?',
            answer: (
              <p>
                Before 65: the withdrawal is ordinary income plus a 20% additional tax on the full
                amount — {usd(penalty5k24.totalTax, 0)} of tax on a {usd(penalty5k24.gross, 0)}{' '}
                withdrawal at a 24% bracket. After 65 (or disability/death) the 20% disappears and
                only income tax remains, which is exactly how a traditional IRA treats withdrawals.
                Non-medical use is expensive early, merely ordinary late.
              </p>
            ),
          },
          {
            question: 'Do HSA contributions reduce self-employment tax?',
            answer: (
              <p>
                No. The deduction is an adjustment to gross income — it reduces income tax, never the
                15.3% Schedule SE bill on net profit (the same asymmetry as retirement-plan
                contributions; the{' '}
                <a href="/self-employment-tax-calculator/">Self-Employment Tax Calculator</a>{' '}
                computes that bill). The exception is payroll: cafeteria-plan HSA contributions are
                exempt from FICA entirely — an extra 7.65% that this tool, being conservative about
                it, never counts.
              </p>
            ),
          },
          {
            question: 'Can I contribute if I am enrolled in Medicare?',
            answer: (
              <p>
                No — eligibility ends the first month Medicare coverage starts. Watch the retroactive
                edge: applying for Social Security benefits at 65 can backdate Part A up to six
                months, which can make earlier contributions excess. You can keep and invest an
                existing balance, and Medicare premiums themselves are qualified expenses later.
              </p>
            ),
          },
          {
            question: 'My spouse has a general-purpose health FSA — can I still contribute?',
            answer: (
              <p>
                No. Other coverage that can pay medical expenses disqualifies you, and a
                general-purpose FSA covering the household counts even if you never use it. A
                limited-purpose FSA (dental and vision only) or a dependent-care FSA does not block
                HSA eligibility.
              </p>
            ),
          },
          {
            question: 'How much can I contribute in 2025 and 2026?',
            answer: (
              <p>
                2025: {usd(HSA_CONSTANTS.selfLimit, 0)} self-only, {usd(HSA_CONSTANTS.familyLimit, 0)}{' '}
                family, plus {usd(HSA_CONSTANTS.catchUp55, 0)} from age 55. 2026 (announced, Rev.
                Proc. 2025-19): {usd(4_400, 0)} / {usd(8_750, 0)}, catch-up unchanged. The limit is
                per account holder and shared with any employer contributions made for you.
              </p>
            ),
          },
          {
            question: 'What is the last-month rule?',
            answer: (
              <p>
                Have HDHP coverage on the first day of the last month of the tax year (December 1 for
                calendar filers) and you may contribute the full year&apos;s limit. The price is the
                testing period: stay HSA-eligible for all 12 following months, or the extra amount
                becomes income plus the 10% (not 20%) recapture tax. Lose coverage mid-testing and
                the prorated safe harbor would have been the smaller number.
              </p>
            ),
          },
          {
            question: 'HSA or FSA?',
            answer: (
              <p>
                Different machines. FSA money is use-it-or-lose-it (up to a small carryover or grace
                period), belongs to the employer, and cannot be invested — it is a one-year discount
                on predictable costs. The HSA is yours forever, investable, portable, and stacks
                three tax breaks. If you are HDHP-eligible, the HSA is strictly the better
                long-horizon vehicle; many households keep a limited-purpose FSA alongside it.
              </p>
            ),
          },
          {
            question: 'Should I invest the balance or pay current medical bills from the HSA?',
            answer: (
              <p>
                If you can afford the bills from outside cash, letting the balance ride is the
                arithmetic winner: at this page&apos;s defaults the save-to-retire usage ends{' '}
                {usd(saveAll.saveForLater.advantageDrag, 0)} ahead of the spend-as-you-go value of{' '}
                {usd(spendNow.spendNow.taxShield, 0)} — every dollar pulled early forgoes its
                tax-free compounding. The practical middle path is the mixed pattern the calculator
                defaults to: pay routine care from the account if cash is tight, save the receipts
                for the big stuff.
              </p>
            ),
          },
          {
            question: 'What if I contribute too much?',
            answer: (
              <p>
                Withdraw the excess plus its earnings by the filing deadline (including extensions)
                and it is untaxed as a mistake; leave it in and a 6% excise tax applies every year
                it stays. Mid-year coverage changes are the usual cause — losing HDHP eligibility
                prorates your limit, and the last-month rule can claw back a full-year contribution.
                The calculator&apos;s cap warning exists because over-limit dollars are the easiest
                mistake to make and the most annoying to unwind.
              </p>
            ),
          },
        ]}
      />

      <RelatedCalculators
        links={[
          { href: '/roth-vs-traditional-calculator/', label: 'Roth vs Traditional Calculator' },
          { href: '/solo-401k-calculator/', label: 'Solo 401(k) vs SEP-IRA Calculator' },
          { href: '/s-corp-tax-calculator/', label: 'S-Corp Salary Calculator' },
        ]}
      />
    </article>
  );
}

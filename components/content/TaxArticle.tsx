import Faq from '@/components/Faq';
import { ArticleToc, RelatedCalculators } from '@/components/Article';
import { TAX_CONSTANTS } from '@/lib/tax';
import { numFmt, pct } from '@/lib/format';

export default function TaxArticle() {
  const toc = [
    { id: 'how-it-works', label: 'How LLC vs C-Corp taxation works' },
    { id: 'examples', label: 'Worked example at $200k' },
    { id: 'strategies', label: 'When each structure actually wins' },
    { id: 'comparison', label: 'Side-by-side tax comparison' },
    { id: 'caveats', label: 'Important caveats' },
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
        tax. Instead, all profit &ldquo;passes through&rdquo; to the owner's personal return, where it is
        taxed <strong>once</strong>. As the owner of an LLC taxed as a sole proprietorship (the
        default), you pay:
      </p>
      <ol>
        <li>
          <strong>Self-employment (SE) tax</strong> of {pct(TAX_CONSTANTS.seRate * 100, 1)} on net
          business income, up to the Social Security wage base of
          {' ' + numFmt(TAX_CONSTANTS.seCap, 0)} (and 2.9% Medicare on the amount above that). This
          covers both the employer and employee halves of Social Security + Medicare.
        </li>
        <li>
          <strong>Ordinary federal income tax</strong> on that same profit, reduced by two
          deductions: half of the SE tax you paid, and the
          {' ' + pct(TAX_CONSTANTS.qbiRate * 100, 0)} <strong>Qualified Business Income (QBI)
          deduction</strong> — a major 2017 tax-reform benefit for most small businesses.
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
        second layer of tax on dividends remains.
      </p>

      <h2 id="examples">Worked example at $200,000 profit</h2>
      <p>
        Using the calculator above with $200,000 in net business profit (single filer, 2025 federal
        brackets, standard deduction, no state tax):
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
          <tr><td>Corporate tax (21%)</td><td>—</td><td>−$42,000</td></tr>
          <tr><td>Self-employment tax</td><td>−$24,834</td><td>—</td></tr>
          <tr><td>QBI deduction (20%)</td><td>−$35,033</td><td>—</td></tr>
          <tr><td>Dividend tax (LTCG)</td><td>—</td><td>−$16,448</td></tr>
          <tr><td>Ordinary income tax</td><td>−$27,892</td><td>—</td></tr>
          <tr><td><strong>Total federal tax</strong></td><td><strong>~$52,726</strong></td><td><strong>~$58,448</strong></td></tr>
          <tr><td><strong>After-tax income</strong></td><td><strong>~$147,274</strong></td><td><strong>~$141,552</strong></td></tr>
          <tr><td>Effective rate</td><td>26.4%</td><td>29.2%</td></tr>
        </tbody>
      </table>
      <p>
        At $200k, the LLC saves about <strong>$5,700/year</strong> in this simplified model. The gap
        widens with profit: at $1M, the LLC advantage is over $40k/year.
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
          strictly better when cash leaves the business each year. Service businesses, agencies, and
          consultancies almost always fit this profile.
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
          <strong>You're raising venture capital.</strong> VCs and institutional investors almost
          universally require a C-Corp (preferred stock, familiar governance, clean cap table). An
          LLC routinely kills a term sheet.
        </li>
        <li>
          <strong>You plan to reinvest profits rather than distribute them.</strong> If the business
          keeps most of its earnings to fund growth, only the {pct(TAX_CONSTANTS.corporateRate * 100, 0)}
          corporate tax applies — no second dividend layer until you actually pay out.
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

      <h2 id="comparison">Side-by-side tax comparison</h2>
      <p>How total federal effective rates compare across profit levels (simplified model):</p>
      <table>
        <thead>
          <tr>
            <th>Profit</th>
            <th>LLC eff. rate</th>
            <th>C-Corp eff. rate</th>
            <th>LLC annual savings</th>
          </tr>
        </thead>
        <tbody>
          <tr><td>$50,000</td><td>~20.2%</td><td>~21.0%</td><td>~$400</td></tr>
          <tr><td>$100,000</td><td>~23.3%</td><td>~25.6%</td><td>~$2,300</td></tr>
          <tr><td>$200,000</td><td>~26.4%</td><td>~29.2%</td><td>~$5,700</td></tr>
          <tr><td>$500,000</td><td>~27.1%</td><td>~31.4%</td><td>~$21,300</td></tr>
          <tr><td>$1,000,000</td><td>~29.1%</td><td>~33.4%</td><td>~$43,100</td></tr>
        </tbody>
      </table>

      <h2 id="caveats">Important caveats (please read)</h2>
      <ul>
        <li>
          <strong>Real C-Corps mix salary and dividends.</strong> A C-Corp owner typically pays
          themselves a deductible W-2 salary (which the corp deducts, lowering corporate tax) and
          dividends only the surplus. Our calculator models the extreme all-dividend case, which
          overstates the C-Corp's disadvantage at higher profits.
        </li>
        <li>
          <strong>LLCs can elect S-Corp taxation.</strong> Once an LLC is profitable enough, electing
          S-Corp status (via IRS Form 2553) can materially reduce SE tax by paying the owner a
          &ldquo;reasonable salary&rdquo; and taking the rest as distributions.
        </li>
        <li>
          <strong>State taxes vary enormously.</strong> California charges LLCs an $800 minimum
          franchise tax plus a gross-receipts fee; Texas has no state income tax but a franchise
          margin tax. Always model state-level impact.
        </li>
        <li>
          <strong>QBI has income limits and service-business phase-outs</strong> for certain
          &ldquo;specified service trades or businesses&rdquo; (SSTBs) like consulting, law, medicine, and
          financial services. Above ~$240k single / $480k married (2025), the QBI deduction phases
          out for SSTBs.
        </li>
      </ul>
      <p>
        Use this calculator for directional guidance and to build intuition — then have a licensed
        CPA model your specific numbers before filing.
      </p>

      <Faq
        items={[
          {
            question: 'Is an LLC or C-Corp better for taxes?',
            answer:
              'For most small and cash-flow businesses, an LLC taxed as a pass-through results in lower total federal tax because profit is taxed only once (with a 20% QBI deduction). A C-Corp faces double taxation — once at the 21% corporate rate, then again as dividend tax when profit is distributed. However, if you reinvest profits rather than distributing them, or if you are raising venture capital, the C-Corp can be preferable despite the headline tax cost.',
          },
          {
            question: 'What is double taxation in a C-Corp?',
            answer:
              'Double taxation means the same dollar of business profit is taxed twice before reaching the owner: first as corporate income tax at a flat 21% federal rate, and again as personal income tax (at long-term capital gains rates of 0/15/20%) when the after-tax profit is distributed as a qualified dividend to shareholders.',
          },
          {
            question: 'What is the QBI deduction and who qualifies?',
            answer:
              'The Qualified Business Income (QBI) deduction lets eligible pass-through businesses (sole proprietorships, partnerships, S-corps, and most LLCs) deduct 20% of their qualified business income from taxable income. It phases out for certain "specified service trades or businesses" (consulting, law, medicine, finance, etc.) at high income levels — roughly above $241,950 single / $483,900 married in 2025.',
          },
          {
            question: 'How much self-employment tax does an LLC owner pay?',
            answer:
              'An LLC owner taxed as a sole proprietorship pays 15.3% self-employment tax (12.4% Social Security + 2.9% Medicare) on the first $176,100 of 2025 net business income, then 2.9% Medicare on anything above that. Half of the SE tax is deductible against income tax. Electing S-Corp status can reduce this by splitting income between a reasonable W-2 salary and untaxed distributions.',
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
        ]}
      />

      <RelatedCalculators
        links={[
          { href: '/freelance-hourly-rate-calculator', label: 'Freelance Hourly Rate' },
          { href: '/saas-runway-calculator', label: 'SaaS Runway' },
          { href: '/stripe-fee-calculator', label: 'Stripe Fee Calculator' },
        ]}
      />
    </article>
  );
}

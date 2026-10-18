import Faq from '@/components/Faq';
import { ArticleToc, RelatedCalculators } from '@/components/Article';
import {
  computeQbiDeduction,
  taxValueOfDeduction,
  wagesNeededToUnlock,
  QBI_CONSTANTS,
  type QbiInputs,
} from '@/lib/qbi';
import { numFmt, pct, usd, usdCompact } from '@/lib/format';

/**
 * §199A deep-dive guide. Every worked-example number is computed from
 * lib/qbi.ts at build time (same functions as the widget) — nothing here is
 * hand-typed, in keeping with the suite's "computed, reproducible" standard.
 */

const TH_S = QBI_CONSTANTS.threshold.single;
const TH_M = QBI_CONSTANTS.threshold.mfj;
const RANGE_S = QBI_CONSTANTS.phaseInRange.single;
const RANGE_M = QBI_CONSTANTS.phaseInRange.mfj;

/** The five scenario presets from the widget, reused here as worked examples. */
const EXAMPLES: { label: string; inputs: QbiInputs }[] = [
  {
    label: 'Sole-prop consultant, TI $150k',
    inputs: { qbi: 120000, taxableIncome: 150000, w2Wages: 0, ubia: 0, sstb: true, filingStatus: 'single' },
  },
  {
    label: 'Same consultant, TI $220k (mid phase-out)',
    inputs: { qbi: 150000, taxableIncome: 220000, w2Wages: 0, ubia: 0, sstb: true, filingStatus: 'single' },
  },
  {
    label: 'S-Corp consultant, $90k owner salary, TI $220k',
    inputs: { qbi: 150000, taxableIncome: 220000, w2Wages: 90000, ubia: 0, sstb: true, filingStatus: 'single' },
  },
  {
    label: 'Product business, staff + equipment, TI $350k',
    inputs: { qbi: 300000, taxableIncome: 350000, w2Wages: 80000, ubia: 400000, sstb: false, filingStatus: 'single' },
  },
  {
    label: 'MFJ couple, TI $450k, $60k wages',
    inputs: { qbi: 250000, taxableIncome: 450000, w2Wages: 60000, ubia: 0, sstb: false, filingStatus: 'mfj' },
  },
];

function limiterPhrase(r: ReturnType<typeof computeQbiDeduction>): string {
  if (r.sstbExcluded) return 'SSTB excluded';
  if (r.qbiLoss) return 'no positive QBI';
  if (r.limiter === 'cap') return '20% of taxable income';
  if (r.limiter === 'wage') return 'W-2/UBIA limit';
  return 'none — full 20%';
}

/**
 * Smallest x in [lo, hi] where a monotone predicate flips true — bisection on
 * the §199A engine itself (60 halvings, sub-dollar tolerance), mirroring the
 * scan convention the suite's other decision-boundary sections use.
 */
function scanThreshold(p: (x: number) => boolean, lo: number, hi: number): number {
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (p(mid)) hi = mid;
    else lo = mid;
  }
  return hi;
}

export default function QbiArticle() {
  const toc = [
    { id: 'mechanics', label: 'How the 20% reaches your return' },
    { id: 'sstb-list', label: 'The SSTB list — and what is not on it' },
    { id: 'worked-examples', label: 'Five worked examples' },
    { id: 'line-by-line', label: 'Two computations, line by line' },
    { id: 'phase-out', label: 'Inside the phase-out band' },
    { id: 's-corp-link', label: 'S-Corp salary × QBI' },
    { id: 'wages-vs-ubia', label: 'Wages vs equipment (UBIA)' },
    { id: 'decision-boundaries', label: 'Decision boundaries' },
    { id: 'caveats', label: 'Caveats & scope' },
    { id: 'glossary', label: 'Glossary' },
    { id: 'faq', label: 'FAQ' },
  ];

  const results = EXAMPLES.map((e) => ({ ...e, r: computeQbiDeduction(e.inputs) }));

  // The mid-band trio used in the phase-out section.
  const noWageSstb = computeQbiDeduction({
    qbi: 150000, taxableIncome: 220000, w2Wages: 0, ubia: 0, sstb: true, filingStatus: 'single',
  });
  const salarySstb = computeQbiDeduction({
    qbi: 150000, taxableIncome: 220000, w2Wages: 90000, ubia: 0, sstb: true, filingStatus: 'single',
  });
  const noWageNonSstb = computeQbiDeduction({
    qbi: 150000, taxableIncome: 220000, w2Wages: 0, ubia: 0, sstb: false, filingStatus: 'single',
  });
  // Above the band, with the tool's default $40k of wages: the non-SSTB floor.
  const floorNonSstb = computeQbiDeduction({
    qbi: 150000, taxableIncome: 350000, w2Wages: 40000, ubia: 0, sstb: false, filingStatus: 'single',
  });

  // ---- Two line-by-line worked examples (every figure from the engine). ----
  // A: self-storage operator — property-heavy non-SSTB above the band.
  const storageCase = computeQbiDeduction({
    qbi: 200000, taxableIncome: 300000, w2Wages: 20000, ubia: 900000, sstb: false, filingStatus: 'single',
  });
  const storageWageLegOfAlt = storageCase.w2Effective * QBI_CONSTANTS.wageShareAlt; // 25% leg
  const storageUbiaLegOfAlt = storageCase.ubiaEffective * QBI_CONSTANTS.ubiaShare; // 2.5% leg
  const storageUnlockWithUbia = wagesNeededToUnlock({
    qbi: 200000, taxableIncome: 300000, w2Wages: 20000, ubia: 900000, sstb: false, filingStatus: 'single',
  });
  const storageUnlockWagesOnly = wagesNeededToUnlock({
    qbi: 200000, taxableIncome: 300000, w2Wages: 0, ubia: 0, sstb: false, filingStatus: 'single',
  });
  const storageTaxValue = taxValueOfDeduction(300000, storageCase.deduction, 'single');

  // B: MFJ law practice mid-band — the compounding, with payroll.
  const coupleCase = computeQbiDeduction({
    qbi: 300000, taxableIncome: 425000, w2Wages: 30000, ubia: 0, sstb: true, filingStatus: 'mfj',
  });
  const coupleNoWages = computeQbiDeduction({
    qbi: 300000, taxableIncome: 425000, w2Wages: 0, ubia: 0, sstb: true, filingStatus: 'mfj',
  });
  const coupleUnlock = wagesNeededToUnlock({
    qbi: 300000, taxableIncome: 425000, w2Wages: 30000, ubia: 0, sstb: true, filingStatus: 'mfj',
  });
  const coupleTaxValue = taxValueOfDeduction(425000, coupleCase.deduction, 'mfj');

  // ---- Decision-boundary scans: bisection on the engine itself (methodology in prose).
  // Net effect of one wage dollar funded from QBI (taxable income held fixed).
  const wageNetSingle = (ti: number) =>
    computeQbiDeduction({ qbi: 149999, taxableIncome: ti, w2Wages: 1, ubia: 0, sstb: false, filingStatus: 'single' }).deduction -
    computeQbiDeduction({ qbi: 150000, taxableIncome: ti, w2Wages: 0, ubia: 0, sstb: false, filingStatus: 'single' }).deduction;
  const wageNetMfj = (ti: number) =>
    computeQbiDeduction({ qbi: 149999, taxableIncome: ti, w2Wages: 1, ubia: 0, sstb: false, filingStatus: 'mfj' }).deduction -
    computeQbiDeduction({ qbi: 150000, taxableIncome: ti, w2Wages: 0, ubia: 0, sstb: false, filingStatus: 'mfj' }).deduction;
  const wageBreakEvenS = Math.ceil(scanThreshold((ti) => wageNetSingle(ti) >= 0, TH_S, TH_S + RANGE_S));
  const wageBreakEvenM = Math.ceil(scanThreshold((ti) => wageNetMfj(ti) >= 0, TH_M, TH_M + RANGE_M));
  // The crossing is SSTB-independent: the net effect of a swapped wage dollar is
  // ap × (0.7·pip − 0.2), so the applicable percentage scales the slope without
  // moving the sign flip — verified by running the same bisection with sstb=true.
  const wageNetSstb = (ti: number) =>
    computeQbiDeduction({ qbi: 149999, taxableIncome: ti, w2Wages: 1, ubia: 0, sstb: true, filingStatus: 'single' }).deduction -
    computeQbiDeduction({ qbi: 150000, taxableIncome: ti, w2Wages: 0, ubia: 0, sstb: true, filingStatus: 'single' }).deduction;
  const wageBreakEvenSstb = Math.ceil(scanThreshold((ti) => wageNetSstb(ti) >= 0, TH_S, TH_S + RANGE_S));
  const breakEvenPip = (wageBreakEvenS - TH_S) / RANGE_S; // the 2/7 of the slope arithmetic
  const ubiaCrossover = Math.round(
    scanThreshold(
      (u) =>
        computeQbiDeduction({ qbi: 200000, taxableIncome: 300000, w2Wages: 20000, ubia: u, sstb: false, filingStatus: 'single' }).wageLimitBasis ===
        '25-plus-ubia',
      0,
      1000000,
    ),
  );
  const capFlipTi = Math.round(
    scanThreshold(
      (ti) =>
        computeQbiDeduction({ qbi: 150000, taxableIncome: ti, w2Wages: 0, ubia: 0, sstb: false, filingStatus: 'single' }).limiter !== 'cap',
      10000,
      TH_S,
    ),
  );
  const sstbExcludedFromS = Math.round(
    scanThreshold(
      (ti) => computeQbiDeduction({ qbi: 150000, taxableIncome: ti, w2Wages: 0, ubia: 0, sstb: true, filingStatus: 'single' }).sstbExcluded,
      TH_S,
      TH_S + 4 * RANGE_S,
    ),
  );
  const sstbExcludedFromM = Math.round(
    scanThreshold(
      (ti) => computeQbiDeduction({ qbi: 150000, taxableIncome: ti, w2Wages: 0, ubia: 0, sstb: true, filingStatus: 'mfj' }).sstbExcluded,
      TH_M,
      TH_M + 4 * RANGE_M,
    ),
  );
  const unlockAboveBand = wagesNeededToUnlock({
    qbi: 150000, taxableIncome: 350000, w2Wages: 0, ubia: 0, sstb: false, filingStatus: 'single',
  });

  // ---- FAQ support figures. ----
  const thresholdCase = computeQbiDeduction({
    qbi: 150000, taxableIncome: TH_S, w2Wages: 0, ubia: 0, sstb: true, filingStatus: 'single',
  });
  const dollarOverThreshold = computeQbiDeduction({
    qbi: 150000, taxableIncome: TH_S + 1, w2Wages: 0, ubia: 0, sstb: true, filingStatus: 'single',
  });
  const perThousandAt220k =
    noWageSstb.deduction -
    computeQbiDeduction({ qbi: 150000, taxableIncome: 221000, w2Wages: 0, ubia: 0, sstb: true, filingStatus: 'single' }).deduction;
  const mfjAtThreshold = computeQbiDeduction({
    qbi: 150000, taxableIncome: TH_M, w2Wages: 0, ubia: 0, sstb: false, filingStatus: 'mfj',
  });
  const mfjHundredOver = computeQbiDeduction({
    qbi: 150000, taxableIncome: TH_M + 100, w2Wages: 0, ubia: 0, sstb: false, filingStatus: 'mfj',
  });
  // Front-loaded decay pair for the phase-out-speed FAQ (fresh inputs, not the
  // $220k anchor case, which the phase-out section already computes).
  const decayEarly = computeQbiDeduction({
    qbi: 150000, taxableIncome: 210000, w2Wages: 0, ubia: 0, sstb: true, filingStatus: 'single',
  });
  const decayEarlyStep =
    decayEarly.deduction -
    computeQbiDeduction({ qbi: 150000, taxableIncome: 211000, w2Wages: 0, ubia: 0, sstb: true, filingStatus: 'single' }).deduction;
  // Cash value of the full deduction at the threshold (24% bracket territory).
  const thresholdTaxValue = taxValueOfDeduction(TH_S, thresholdCase.deduction, 'single');
  const capCase = computeQbiDeduction({
    qbi: 150000, taxableIncome: 120000, w2Wages: 0, ubia: 0, sstb: true, filingStatus: 'single',
  });
  const solePropBelowTh = computeQbiDeduction({
    qbi: 120000, taxableIncome: 150000, w2Wages: 0, ubia: 0, sstb: true, filingStatus: 'single',
  });
  const salariedBelowTh = computeQbiDeduction({
    qbi: 80000, taxableIncome: 150000, w2Wages: 40000, ubia: 0, sstb: true, filingStatus: 'single',
  });
  const pastTopSstb = computeQbiDeduction({
    qbi: 150000, taxableIncome: 250000, w2Wages: 0, ubia: 0, sstb: true, filingStatus: 'single',
  });
  const pastTopBare = computeQbiDeduction({
    qbi: 150000, taxableIncome: 250000, w2Wages: 0, ubia: 0, sstb: false, filingStatus: 'single',
  });
  const pastTopWaged = computeQbiDeduction({
    qbi: 150000, taxableIncome: 250000, w2Wages: 60000, ubia: 0, sstb: false, filingStatus: 'single',
  });
  const formSwitchAt = computeQbiDeduction({
    qbi: 150000, taxableIncome: TH_S, w2Wages: 0, ubia: 0, sstb: false, filingStatus: 'single',
  }).aboveThreshold;

  return (
    <article className="prose-article">
      <ArticleToc items={toc} />

      <h2 id="mechanics">How the 20% actually reaches your return</h2>
      <p>
        Section 199A lets owners of pass-through businesses — sole proprietorships, partnerships,
        S-corporations, LLCs — deduct {pct(QBI_CONSTANTS.qbiRate * 100, 0)} of their qualified
        business income against ordinary income tax. It is a below-the-line deduction: it never
        reduces self-employment tax, and it is available whether or not you itemize. But the
        headline 20% passes through three gates before it lands on your return, and the order
        matters:
      </p>
      <ol>
        <li>
          <strong>The tentative deduction.</strong> {pct(QBI_CONSTANTS.qbiRate * 100, 0)} of QBI —
          your K-1 ordinary income, or Schedule C profit minus half of
          self-employment tax and your self-employed health-insurance and
          retirement-plan deductions (§199A(c)(1)). Your own
          W-2 wages, capital gains, and interest income are never QBI.
        </li>
        <li>
          <strong>The SSTB test.</strong> If the business is a specified service trade or business
          and your taxable income (before the deduction) is above {usd(TH_S, 0)} single /{' '}
          {usd(TH_M, 0)} joint, only the <em>applicable percentage</em> of it still counts — the
          share that declines linearly to zero across a {usd(RANGE_S, 0)} / {usd(RANGE_M, 0)} band.
          Above the band, an SSTB is excluded entirely.
        </li>
        <li>
          <strong>The W-2 wage / UBIA limit.</strong> Above the threshold (any business), the
          deduction cannot exceed the greater of{' '}
          <strong>50% of W-2 wages</strong> the business paid, or{' '}
          <strong>25% of wages + 2.5% of UBIA</strong> (original cost of qualified equipment and
          buildings). Inside the band this limit phases in alongside the SSTB reduction; below the
          threshold it does not apply at all.
        </li>
      </ol>
      <p>
        Whatever survives is finally capped at {pct(QBI_CONSTANTS.qbiRate * 100, 0)} of{' '}
        <em>taxable income before the deduction</em> (reduced by net capital gain — assumed zero in
        this tool). That cap is why a big QBI year with big deductions elsewhere can still produce
        a small deduction: the 20% must fit inside the income it is measured against.
      </p>

      <h2 id="sstb-list">The SSTB list — and what is not on it</h2>
      <p>
        A specified service trade or business is one where the principal asset is the skill or
        reputation of its owners or employees, in the fields the statute names. Per the IRS
        instructions for Form 8995-A, the list is:
      </p>
      <ul>
        <li><strong>Health</strong> — physicians, dentists, veterinarians, physical therapists, psychologists…</li>
        <li><strong>Law</strong> — lawyers, paralegals, arbitrators, mediators</li>
        <li><strong>Accounting</strong> — CPAs, enrolled agents, auditors, return preparers</li>
        <li><strong>Actuarial science</strong></li>
        <li><strong>Performing arts</strong> — but not broadcasting or facility operations</li>
        <li><strong>Consulting</strong> — professional advice and advocacy, including lobbying</li>
        <li><strong>Athletics</strong> — athletes, coaches, team managers</li>
        <li><strong>Financial services</strong> — wealth management, investment banking, retirement and wealth planning</li>
        <li><strong>Brokerage services</strong> — securities brokers (real-estate and insurance agents are excluded)</li>
        <li><strong>Investing and investment management</strong></li>
        <li><strong>Trading</strong> in securities, commodities, or partnership interests</li>
        <li><strong>Dealing</strong> in securities, commodities, or partnership interests</li>
        <li><strong>Reputation or skill</strong> — endorsing products, licensing your image or likeness, paid appearances</li>
      </ul>
      <p>
        Two carve-outs matter enormously and are widely missed. First:{' '}
        <strong>engineering and architecture are NOT SSTBs</strong> — the statute lists them
        nowhere, so a structural engineering firm keeps its full wage-limited deduction at any
        income. Second, the <strong>de minimis rules</strong>: with gross receipts of $25 million or
        less, a business with under 10% of receipts from specified services is not an SSTB at all
        (5% above $25 million). A bakery that also runs paid consulting workshops stays a
        non-SSTB. And the regulations (§1.199A-5(b)(2)(vii)) go further: consulting embedded in,
        or ancillary to, a non-SSTB business&apos;s goods or services is treated as part of that
        non-SSTB, so long as there is no separate payment for the consulting.
      </p>

      <h2 id="worked-examples">Five worked examples</h2>
      <p>
        Every number in the table is generated by this page&apos;s own §199A library — the same
        functions the widget above runs:
      </p>
      <table>
        <thead>
          <tr>
            <th>Scenario</th>
            <th>Filing</th>
            <th>SSTB</th>
            <th>W-2 wages</th>
            <th>Deduction</th>
            <th>Binding limit</th>
          </tr>
        </thead>
        <tbody>
          {results.map(({ label, inputs, r }) => (
            <tr key={label}>
              <td>{label}</td>
              <td>{inputs.filingStatus === 'mfj' ? 'MFJ' : 'Single'}</td>
              <td>{inputs.sstb ? 'yes' : 'no'}</td>
              <td>{usdCompact(inputs.w2Wages)}</td>
              <td><strong>{usd(r.deduction, 0)}</strong></td>
              <td>{limiterPhrase(r)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p>
        Read the second and third rows together: same consultant, same income, same QBI — the only
        difference is that one takes the income as K-1 draws and the other runs it through an
        S-corp with a {usd(90000, 0)} salary. The salary is not QBI, but it <em>is</em> W-2 wages
        for the limitation, and it nearly doubles the deduction. That interaction is the next
        section.
      </p>

      <h2 id="line-by-line">Two computations, line by line</h2>
      <p>
        The table above shows where five scenarios land; these two show every step of
        the descent. Both are computed by this page&apos;s engine at render time — the
        rows read straight off its intermediate fields, in the order Form 8995-A
        applies them.
      </p>

      <h3>A property-heavy business: the UBIA branch earning its keep</h3>
      <p>
        A single filer owns climate-controlled self-storage buildings placed in
        service three years ago: {usd(200000, 0)} of QBI, {usd(300000, 0)} of taxable
        income, a {usd(20000, 0)} part-time attendant on W-2, and {usd(900000, 0)} of
        UBIA in buildings and equipment. Not an SSTB, so Schedule A never touches the
        numbers — but the income sits above the threshold, so the wage limit applies
        in full:
      </p>
      <table>
        <thead>
          <tr>
            <th>Step (8995-A line order)</th>
            <th>Computation</th>
            <th>Amount</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Tentative deduction</td>
            <td>20% × {usd(200000, 0)} QBI</td>
            <td>{usd(storageCase.tentativeDeduction, 0)}</td>
          </tr>
          <tr>
            <td>Wage limit, 50% branch</td>
            <td>50% × {usd(20000, 0)} wages</td>
            <td>{usd(storageCase.wageLimit50, 0)}</td>
          </tr>
          <tr>
            <td>Wage limit, UBIA branch</td>
            <td>
              25% × {usd(20000, 0)} + 2.5% × {usd(900000, 0)} = {usd(storageWageLegOfAlt, 0)} +{' '}
              {usd(storageUbiaLegOfAlt, 0)}
            </td>
            <td>{usd(storageCase.wageLimitAlt, 0)}</td>
          </tr>
          <tr>
            <td>Limitation (the greater)</td>
            <td>max of the two branches</td>
            <td>{usd(storageCase.wageLimit, 0)}</td>
          </tr>
          <tr>
            <td>Excess, fully disallowed</td>
            <td>
              {usd(storageCase.tentativeDeduction, 0)} − {usd(storageCase.wageLimit, 0)} (phase-in{' '}
              {pct(storageCase.phaseInPct * 100, 0)})
            </td>
            <td>{usd(storageCase.excess, 0)}</td>
          </tr>
          <tr>
            <td>Component, then the cap</td>
            <td>20% × {usd(300000, 0)} taxable income</td>
            <td>
              {usd(storageCase.component, 0)} / {usd(storageCase.incomeCap, 0)}
            </td>
          </tr>
          <tr>
            <td><strong>Deduction</strong></td>
            <td>
              ≈ {usd(storageTaxValue, 0)} of federal tax —{' '}
              {pct((storageTaxValue / storageCase.deduction) * 100, 0)} on the dollar
            </td>
            <td><strong>{usd(storageCase.deduction, 0)}</strong></td>
          </tr>
        </tbody>
      </table>
      <p>
        Read the third row: {usd(storageUbiaLegOfAlt, 0)} of the{' '}
        {usd(storageCase.wageLimit, 0)} limit —{' '}
        {pct((storageUbiaLegOfAlt / storageCase.wageLimit) * 100, 0)} — is equipment basis, not
        payroll. Without the property, unlocking the full{' '}
        {usd(storageCase.tentativeDeduction, 0)} would take{' '}
        {usd(storageUnlockWagesOnly ?? 0, 0)} of wages (40% of QBI); with it,{' '}
        {usd(storageUnlockWithUbia ?? 0, 0)} suffices. And at the actual {usd(20000, 0)} wage
        bill, the UBIA branch alone carries the deduction to {usd(storageCase.deduction, 0)} —
        nearly triple what the 50% branch&apos;s {usd(storageCase.wageLimit50, 0)} could support.
      </p>

      <h3>A two-lawyer marriage inside the band: the compounding, with payroll</h3>
      <p>
        Married filers run a law practice (plainly an SSTB) with {usd(300000, 0)} of QBI,{' '}
        {usd(425000, 0)} of taxable income and one {usd(30000, 0)} office manager. At that
        income the couple is {usd(425000 - TH_M, 0)} into the {usd(RANGE_M, 0)} joint range:
        applicable percentage {pct(coupleCase.applicablePct * 100, 1)}, phase-in{' '}
        {pct(coupleCase.phaseInPct * 100, 1)}. Schedule A runs first — and it trims the wages
        as well as the income:
      </p>
      <table>
        <thead>
          <tr>
            <th>Step (8995-A line order)</th>
            <th>Computation</th>
            <th>Amount</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Schedule A reduction</td>
            <td>
              QBI and wages × {pct(coupleCase.applicablePct * 100, 1)}
            </td>
            <td>
              {usd(coupleCase.qbiEffective, 0)} / {usd(coupleCase.w2Effective, 0)}
            </td>
          </tr>
          <tr>
            <td>Tentative deduction</td>
            <td>20% × {usd(coupleCase.qbiEffective, 0)}</td>
            <td>{usd(coupleCase.tentativeDeduction, 0)}</td>
          </tr>
          <tr>
            <td>Wage limit</td>
            <td>
              max(50% × {usd(coupleCase.w2Effective, 0)}, 25% × {usd(coupleCase.w2Effective, 0)})
            </td>
            <td>{usd(coupleCase.wageLimit, 0)}</td>
          </tr>
          <tr>
            <td>Excess and its phase-in</td>
            <td>
              {usd(coupleCase.excess, 0)} × {pct(coupleCase.phaseInPct * 100, 1)} disallowed
            </td>
            <td>{usd(coupleCase.phaseInReduction)}</td>
          </tr>
          <tr>
            <td>Line 26 vs line 11</td>
            <td>
              {usd(coupleCase.tentativeDeduction, 0)} − {usd(coupleCase.phaseInReduction)} vs min(
              {usd(coupleCase.tentativeDeduction, 0)}, {usd(coupleCase.wageLimit, 0)})
            </td>
            <td>
              {usd(coupleCase.tentativeDeduction - coupleCase.phaseInReduction)} /{' '}
              {usd(Math.min(coupleCase.tentativeDeduction, coupleCase.wageLimit), 0)}
            </td>
          </tr>
          <tr>
            <td><strong>Deduction</strong> (cap {usd(coupleCase.incomeCap, 0)})</td>
            <td>≈ {usd(coupleTaxValue, 0)} of federal tax</td>
            <td><strong>{usd(coupleCase.deduction)}</strong></td>
          </tr>
        </tbody>
      </table>
      <p>
        Three checks fall out. The often-quoted single-reduction estimate — 20% × QBI ×
        ap — is {usd(coupleNoWages.tentativeDeduction, 0)}; it overstates by exactly the
        disallowed excess of {usd(coupleCase.phaseInReduction)}. Fire the manager and the
        deduction falls to {usd(coupleNoWages.deduction)} — 20% × {usd(300000, 0)} ×{' '}
        {pct(coupleCase.applicablePct * 100, 1)}², the compounding squared — so the{' '}
        {usd(30000, 0)} wage bill is worth {usd(coupleCase.deduction - coupleNoWages.deduction)}.{' '}
        And fully unlocking the {usd(coupleNoWages.tentativeDeduction, 0)} would take{' '}
        {usd(coupleUnlock ?? 0, 0)} of wages, because Schedule A trims every wage dollar to{' '}
        {pct(coupleCase.applicablePct * 100, 1)} before the limit ever sees it.
      </p>

      <h2 id="phase-out">Inside the phase-out band — where most explainers go wrong</h2>
      <p>
        Between {usd(TH_S, 0)} and {usd(TH_S + RANGE_S, 0)} single (double those for joint), two
        different reductions operate at once, and the IRS form applies them in sequence, not in
        parallel:
      </p>
      <ol>
        <li>
          Schedule A of Form 8995-A first multiplies an SSTB&apos;s QBI <em>and</em> its W-2 wages
          and UBIA by the applicable percentage.
        </li>
        <li>
          Part III then phases in the wage-limit <em>excess</em> — the amount by which 20% of that
          already-reduced QBI exceeds the (already-reduced) wage limit.
        </li>
      </ol>
      <p>
        The compounding is the punchline. At {usd(220000, 0)} of taxable income (single, 2025), the
        applicable percentage is {pct(noWageSstb.applicablePct * 100, 1)}. A consultant with{' '}
        {usd(150000, 0)} of QBI and no employees gets{' '}
        <strong>{usd(noWageSstb.deduction, 0)}</strong> — which is not the often-quoted
        &ldquo;20% × QBI × {pct(noWageSstb.applicablePct * 100, 1)}&rdquo; ({usd(noWageSstb.tentativeDeduction, 0)}),
        because the second reduction lands on top. This exact sequence is confirmed by the IRS
        form&apos;s own line order and by the AICPA Tax Adviser&apos;s published worked examples,
        which this tool reproduces to the dollar. Meanwhile an identical <em>non-SSTB</em> at the
        same income keeps {usd(noWageNonSstb.deduction, 0)} even with zero wages, and an SSTB with
        an S-corp salary keeps {usd(salarySstb.deduction, 0)} — the salary&apos;s wage limit
        absorbs the excess that the wage-less consultant loses.
      </p>
      <p>
        Above the band the difference is structural: the non-SSTB settles onto its wage-limited
        floor — with {usd(40000, 0)} of wages, {usd(floorNonSstb.wageLimit, 0)} = 50% of them —
        and stays there at any income, while the SSTB is gone. The two-line chart in the tool
        shows exactly this divergence for your numbers.
      </p>

      <h2 id="s-corp-link">S-Corp salary and QBI — the two-way lever</h2>
      <p>
        An S-corp owner sits at the hinge of §199A. Salary moves dollars <em>out</em> of QBI
        (reasonable compensation is excluded from QBI by statute) but moves the business{' '}
        <em>into</em> W-2 wages for the limitation — and the owner&apos;s own salary counts for
        that purpose. Three consequences:
      </p>
      <ul>
        <li>
          <strong>Below the threshold</strong>, salary strictly hurts: the wage limit does not
          apply, so converting QBI to salary only shrinks the 20% base. The{' '}
          <a href="/s-corp-tax-calculator/">S-Corp election analysis</a> still usually wins on
          payroll tax — but the QBI cost is real and that tool models it.
        </li>
        <li>
          <strong>Inside or above the band</strong>, salary becomes QBI medicine: as the worked
          examples show, it can nearly double an SSTB owner&apos;s deduction by covering the
          wage-limit excess. The classic pattern is an SSTB S-corp owner above {usd(TH_S, 0)} whose
          salary simultaneously triggers payroll tax (cost) and unlocks QBI (benefit).
        </li>
        <li>
          <strong>The marginal math.</strong> While the wage limit binds, each extra wage dollar
          adds 50% × the phase-in percentage to the deduction but removes 20% × (1 − the phase-in
          percentage) of QBI base — a net of <code>70% × pip − 20¢</code> per dollar. For an SSTB
          inside the band, both slopes shrink again by the applicable percentage, because Schedule
          A trims its wages before the limit sees them. Break-even is phase-in-independent in
          shape: wages pay for themselves only once the phase-in percentage clears ≈29% (a
          non-SSTB above the band nets +50¢ of deduction per wage dollar; an SSTB above the band
          has no deduction left to rescue). Wages also carry ~15.3% of payroll tax — price the
          full stack in the{' '}
          <a href="/s-corp-tax-calculator/">S-Corp calculator</a> before acting.
        </li>
      </ul>

      <h2 id="wages-vs-ubia">Wages vs equipment: the UBIA branch</h2>
      <p>
        The limitation is the <em>greater</em> of {pct(QBI_CONSTANTS.wageShare * 100, 0)} of wages
        or {pct(QBI_CONSTANTS.wageShareAlt * 100, 0)} of wages +{' '}
        {pct(QBI_CONSTANTS.ubiaShare * 100, 1)} of UBIA, so property-heavy businesses get relief
        without payroll. The second branch wins whenever UBIA exceeds ten times the wage bill
        (2.5% of UBIA &gt; 25% of wages ⟺ UBIA &gt; 10 × wages). A capital-intensive operator with{' '}
        {usd(40000, 0)} of wages and {usd(400000, 0)} of original-cost equipment is right at the
        crossover; add equipment and the 25% + 2.5% branch takes over. Note what UBIA is not: it is
        the <em>original</em> basis at placed-in-service, never depreciated down, and only property
        still inside its depreciable period (at least ten years) at year-end counts. Used equipment
        counts at your cost basis. The anti-abuse rules that do bite come from the §1.199A-2
        regulations: property acquired within 60 days of year-end, disposed of within 120 days, and
        used by the business for fewer than 45 days is generally not qualified property; and a
        transaction whose principal purpose is to step up UBIA is disregarded. Property received in
        a nonrecognition transaction — a §351 incorporation or §721 contribution, for example —
        keeps the transferor&apos;s UBIA rather than stepping up.
      </p>

      <h2 id="decision-boundaries">Decision boundaries: where each regime begins</h2>
      <p>
        §199A divides into regimes, and the boundaries between them are numbers this
        engine can find on its own. Every critical value below comes from a bisection
        on <code>computeQbiDeduction</code> — the same function the widget calls — run
        between bracketing incomes for 60 halvings to sub-dollar tolerance. The payroll
        break-even predicate is the engine&apos;s deduction at (QBI − $1, wages + $1)
        with taxable income held fixed, which is exactly the trade an S-corp owner
        faces when a salary dollar replaces a distribution dollar:
      </p>
      <table>
        <thead>
          <tr>
            <th>Taxable income (single / joint)</th>
            <th>Regime</th>
            <th>What changes</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>≤ {usd(TH_S, 0)} / {usd(TH_M, 0)}</td>
            <td>Clean 20%</td>
            <td>
              Form 8995; the wage limit is off. Only the cap can bind, and for a single
              business with no other income it binds below TI = QBI — the scan flips the
              limiter at exactly {usd(capFlipTi, 0)} on a {usd(150000, 0)} QBI. Payroll
              planning buys nothing here; the cap is the whole game.
            </td>
          </tr>
          <tr>
            <td>to ≈{usd(wageBreakEvenS, 0)} / ≈{usd(wageBreakEvenM, 0)}</td>
            <td>Reductions active, payroll still negative</td>
            <td>
              The phase-in is below {pct(breakEvenPip * 100, 1)} (2/7 exactly), so each wage
              dollar funded from QBI nets 0.7 × pip − 0.2 &lt; 0: the deduction loses more
              base than the limit gains back. A {usd(wageBreakEvenS - TH_S, 0)}-wide dead
              zone single, twice that joint.
            </td>
          </tr>
          <tr>
            <td>to {usd(TH_S + RANGE_S, 0)} / {usd(TH_M + RANGE_M, 0)}</td>
            <td>Payroll pays; SSTBs compound</td>
            <td>
              Past the break-even each such wage dollar nets +0.7 × pip − 0.2, rising to
              +50¢ at the top. For an SSTB the applicable percentage shrinks both slopes
              equally — the net becomes ap × (0.7 × pip − 0.2) — so it scales the payoff
              without moving the crossing: the bisection flips at {usd(wageBreakEvenSstb, 0)}{' '}
              with the SSTB switch on, the same {usd(wageBreakEvenS, 0)} as with it off. This
              is the only window where the salary question is genuinely close.
            </td>
          </tr>
          <tr>
            <td>above</td>
            <td>Floor — or nothing</td>
            <td>
              The SSTB exclusion completes at {usd(sstbExcludedFromS, 0)} /{' '}
              {usd(sstbExcludedFromM, 0)} — the scan flips exactly at the top of the
              statutory range. A non-SSTB keeps a permanent floor of max(50% wages, 25%
              wages + 2.5% UBIA), and zero with neither; the UBIA branch takes over above
              UBIA = 10 × wages — the scan flips at {usd(ubiaCrossover, 0)} of property on
              a {usd(20000, 0)} wage bill.
            </td>
          </tr>
        </tbody>
      </table>
      <p>
        <strong>When this tool is the wrong instrument.</strong> The regimes above assume
        this engine&apos;s world — one business, one owner, 2025 parameters, no capital
        gain — and the caveats below catalog those limits in full. Two bear repeating at
        the boundary itself: every critical value in the table shifts on 2026 parameters
        (the OBBBA widens the ranges and thresholds re-index), and state pass-through
        entity tax elections interact with QBI in ways no federal-only scan sees. Between
        those and the single-business assumption, treat the table as 2025 federal geometry
        for one clean situation — the shape survives; the coordinates move.
      </p>

      <h2 id="caveats">Caveats, scope, and what changed in 2025–2026</h2>
      <ul>
        <li>
          <strong>One business, one owner.</strong> The tool models a single trade or business.
          Multiple businesses apply the wage limit separately (unless aggregated); qualified-loss
          carryforwards from prior years are not modeled.
        </li>
        <li>
          <strong>Net capital gain.</strong> The 20%-of-taxable-income cap is really 20% of
          (taxable income − net capital gain − qualified dividends). This tool assumes none — if
          you have meaningful capital gains, the real cap is lower than shown.
        </li>
        <li>
          <strong>REIT/PTP income adds a parallel 20%</strong> outside the wage limit — not modeled
          here, but it stacks on top of the business deduction before the cap.
        </li>
        <li>
          <strong>Post-2025 law.</strong> §199A had been scheduled to sunset after 2025; the
          One Big Beautiful Bill Act (enacted July 2025) made it permanent for years beginning
          after 2025 — the rate stays 20% (the House bill&apos;s proposed ladder to 23% was not
          enacted), the SSTB phase-in ranges widen to $75,000 / $150,000, and a new small minimum
          deduction arrives for low-QBI taxpayers. This tool deliberately models the 2025
          parameters — {numFmt(TH_S, 0)} / {numFmt(TH_M, 0)} thresholds per Rev. Proc. 2024-40
          with the statutory {numFmt(RANGE_S, 0)} / {numFmt(RANGE_M, 0)} ranges — so re-check
          thresholds for later filing years.
        </li>
        <li>
          <strong>Source basis.</strong> The mechanics follow IRC §199A as laid out line-by-line on
          IRS Form 8995 / 8995-A (2025) and the IRS instructions; the mid-band sequence is
          cross-checked against the AICPA Tax Adviser&apos;s published worked examples. Where the
          statute is genuinely gray (aggregation, SSTB boundary calls, W-2 wage allocation), this
          page says so rather than guessing.
        </li>
        <li>Nothing here is tax advice. §199A is one of the most litigated corners of the code — confirm with a qualified professional before acting.</li>
      </ul>

      <h2 id="glossary">Glossary</h2>
      <p>
        The vocabulary this page runs on, roughly in the order a first pass through
        §199A meets it. The only numbers here are statutory constants the engine itself
        carries:
      </p>
      <dl className="mb-4">
        <dt className="mt-4 font-semibold text-slate-900 dark:text-slate-100">
          Qualified business income (QBI)
        </dt>
        <dd className="ml-0 leading-relaxed text-slate-600 dark:text-slate-300">
          The domestic business profit that enters the 20% computation: Schedule C net
          profit reduced by ½ SE tax and the self-employed health-insurance and
          retirement deductions, or K-1 ordinary income. Never your own W-2 wages,
          capital gains, or unallocable interest.
        </dd>
        <dt className="mt-4 font-semibold text-slate-900 dark:text-slate-100">
          Specified service trade or business (SSTB)
        </dt>
        <dd className="ml-0 leading-relaxed text-slate-600 dark:text-slate-300">
          A business whose principal asset is the skill or reputation of its owners or
          employees, in the fields §199A(d)(2) names — health, law, consulting, financial
          services and the rest of the list above. Above the threshold, its QBI phases to
          zero across the {usd(RANGE_S, 0)} / {usd(RANGE_M, 0)} band.
        </dd>
        <dt className="mt-4 font-semibold text-slate-900 dark:text-slate-100">
          Applicable percentage (ap)
        </dt>
        <dd className="ml-0 leading-relaxed text-slate-600 dark:text-slate-300">
          The share of an SSTB&apos;s QBI, wages and UBIA still counted: 100% at the
          threshold, declining linearly to zero at the top of the band. Schedule A line
          10 — the first reduction, applied before anything else.
        </dd>
        <dt className="mt-4 font-semibold text-slate-900 dark:text-slate-100">
          Phase-in percentage (pip)
        </dt>
        <dd className="ml-0 leading-relaxed text-slate-600 dark:text-slate-300">
          One minus the applicable percentage: the share of the wage-limit excess actually
          disallowed. The two percentages are complements, so &ldquo;phase-in&rdquo; and
          &ldquo;phase-out&rdquo; describe the same dollar of income from opposite ends.
        </dd>
        <dt className="mt-4 font-semibold text-slate-900 dark:text-slate-100">
          W-2 wage / UBIA limitation
        </dt>
        <dd className="ml-0 leading-relaxed text-slate-600 dark:text-slate-300">
          Above the threshold, the deduction cannot exceed the greater of{' '}
          {pct(QBI_CONSTANTS.wageShare * 100, 0)} of W-2 wages or{' '}
          {pct(QBI_CONSTANTS.wageShareAlt * 100, 0)} of wages plus{' '}
          {pct(QBI_CONSTANTS.ubiaShare * 100, 1)} of UBIA. Below the threshold it does not
          apply at all.
        </dd>
        <dt className="mt-4 font-semibold text-slate-900 dark:text-slate-100">UBIA</dt>
        <dd className="ml-0 leading-relaxed text-slate-600 dark:text-slate-300">
          Unadjusted basis immediately after acquisition: what qualified depreciable
          tangible property cost when placed in service, never reduced by depreciation,
          counted only if held at year-end and still inside its depreciable period.
        </dd>
        <dt className="mt-4 font-semibold text-slate-900 dark:text-slate-100">
          Taxable-income cap
        </dt>
        <dd className="ml-0 leading-relaxed text-slate-600 dark:text-slate-300">
          The final ceiling: {pct(QBI_CONSTANTS.qbiRate * 100, 0)} of taxable income
          before the deduction, reduced by net capital gain. The 20% must fit inside the
          income it is measured against.
        </dd>
        <dt className="mt-4 font-semibold text-slate-900 dark:text-slate-100">
          Form 8995 / 8995-A
        </dt>
        <dd className="ml-0 leading-relaxed text-slate-600 dark:text-slate-300">
          The simplified and full §199A computations. Form 8995 applies at or below the
          threshold; 8995-A carries Schedule A (the SSTB reduction) and Part III (the
          phase-in of the wage-limit excess) — the sequence this tool reproduces.
        </dd>
        <dt className="mt-4 font-semibold text-slate-900 dark:text-slate-100">
          Net capital gain
        </dt>
        <dd className="ml-0 leading-relaxed text-slate-600 dark:text-slate-300">
          Net capital gains plus qualified dividends, subtracted from taxable income
          before the cap is measured. Real portfolios shrink the cap below what this tool
          shows — the one input it assumes away.
        </dd>
        <dt className="mt-4 font-semibold text-slate-900 dark:text-slate-100">
          Qualified-loss carryforward
        </dt>
        <dd className="ml-0 leading-relaxed text-slate-600 dark:text-slate-300">
          A prior year&apos;s negative QBI for the same business, carried forward and
          netted against future QBI before any deduction is computed. Not modeled here.
        </dd>
        <dt className="mt-4 font-semibold text-slate-900 dark:text-slate-100">
          REIT/PTP component
        </dt>
        <dd className="ml-0 leading-relaxed text-slate-600 dark:text-slate-300">
          A separate 20% deduction on qualified REIT and publicly traded partnership
          dividends — outside the wage limit, stacked on the business component before the
          cap. Also not modeled here.
        </dd>
        <dt className="mt-4 font-semibold text-slate-900 dark:text-slate-100">Aggregation</dt>
        <dd className="ml-0 leading-relaxed text-slate-600 dark:text-slate-300">
          The election to treat multiple businesses as one for the wage limitation, so
          one business&apos;s payroll can support another&apos;s QBI. A
          facts-and-circumstances filing with its own tests — outside this tool&apos;s
          single-business world.
        </dd>
      </dl>

      <Faq
        items={[
          {
            question: 'What exactly counts as qualified business income?',
            answer: (
              <p>
                The net amount of qualified items of income, gain, deduction and loss from a
                domestic trade or business that lands in your taxable income: Schedule C profit
                reduced by half of self-employment tax plus your self-employed health-insurance
                and retirement-plan deductions (§199A(c)(1)), or your K-1 ordinary income from a
                partnership or S-corp. Excluded: your own W-2 wages, reasonable S-corp
                compensation, guaranteed
                payments, capital gains and losses, dividends, interest not allocable to the
                business, and REIT/PTP income (which gets its own separate 20% component).
              </p>
            ),
          },
          {
            question: 'I am an engineer or an architect — am I an SSTB?',
            answer: (
              <p>
                No. Engineering and architecture were deliberately left off the statutory list, so
                those firms keep the full (wage-limited) deduction at any income. The trap is the
                neighboring word &ldquo;consulting&rdquo;: if you sell advice rather than designs,
                you may be an SSTB even though your engineer friends are not. The boundary is
                facts-and-circumstances.
              </p>
            ),
          },
          {
            question: 'Why did my deduction fall to zero just past the top of the range?',
            answer: (
              <p>
                If your business is an SSTB, that is the statute: above{' '}
                {usd(TH_S + RANGE_S, 0)} single / {usd(TH_M + RANGE_M, 0)} joint of taxable income,
                the applicable percentage hits zero and the SSTB is excluded entirely. A non-SSTB
                never zeroes out the same way — it keeps a floor equal to the wage/UBIA limit. If
                your deduction fell to zero as a non-SSTB, your wage limit itself is zero: no
                employees and no depreciable property.
              </p>
            ),
          },
          {
            question: 'Does paying myself a bigger S-corp salary help my QBI deduction?',
            answer: (
              <p>
                Above the threshold it can — substantially, as the worked examples show — because
                your own salary counts as the business&apos;s W-2 wages for the limitation. Below
                the threshold it only hurts (the wage limit is off, so salary just shrinks the QBI
                base). And every salary dollar carries payroll tax, so run the full trade-off in
                the S-Corp calculator before moving real money.
              </p>
            ),
          },
          {
            question: 'Which form do I file — 8995 or 8995-A?',
            answer: (
              <p>
                Form 8995 (the simplified computation) if your taxable income before the QBI
                deduction is at or below {usd(TH_S, 0)} single / {usd(TH_M, 0)} joint — no wage
                limit applies, so the form skips the limitation machinery entirely. Above that,
                Form 8995-A with Schedule A for any SSTB, and the phase-in machinery this tool
                reproduces.
              </p>
            ),
          },
          {
            question: 'Is the QBI deduction still available after 2025?',
            answer: (
              <p>
                Yes. Section 199A was scheduled to expire after 2025, but the One Big Beautiful
                Bill Act enacted in July 2025 made it permanent — at the same 20% rate (the
                House bill&apos;s proposed step-up to 23% was not enacted) — with parameter
                adjustments beginning in 2026 (a small minimum deduction for low-QBI taxpayers,
                and SSTB phase-in ranges widened to $75,000/$150,000). The
                2025 thresholds this tool uses are the Rev. Proc. 2024-40 amounts.
              </p>
            ),
          },
          {
            question: 'What is UBIA in plain English?',
            answer: (
              <p>
                Unadjusted basis immediately after acquisition: what qualified property cost when
                it was placed in service, before any depreciation. Only tangible depreciable
                property used in the business, held at year-end, and still within its depreciable
                period (at least ten years) counts. For a consultant with a laptop, effectively
                zero; for a manufacturer or a landlord with recently acquired buildings, often the
                single biggest number in the computation.
              </p>
            ),
          },
          {
            question: 'Is a dollar of deduction really worth 20 cents of tax?',
            answer: (
              <p>
                No — §199A reduces taxable income, not tax. Cash value is the deduction times
                your marginal ordinary rate: the full {usd(thresholdCase.deduction, 0)} deduction
                at the threshold is worth {usd(thresholdTaxValue, 0)} of federal income tax —{' '}
                {pct((thresholdTaxValue / thresholdCase.deduction) * 100, 0)} on the dollar — and
                nothing at all against self-employment or payroll tax. Higher brackets lift the
                per-dollar rate as income rises; the phase-out shrinks the deduction itself.
              </p>
            ),
          },
          {
            question: 'My taxable income is below my QBI — why is the deduction under 20% of QBI?',
            answer: (
              <p>
                The overall cap: {pct(QBI_CONSTANTS.qbiRate * 100, 0)} of taxable income before
                the deduction. A proprietor with {usd(150000, 0)} of QBI but only {usd(120000, 0)}{' '}
                of taxable income deducts {usd(capCase.deduction, 0)} — 20% of the income, not{' '}
                {usd(capCase.tentativeDeduction, 0)} of the business. Large retirement or itemized
                deductions elsewhere shrink the deduction dollar for twenty cents.
              </p>
            ),
          },
          {
            question: 'Is there a cliff when income crosses the threshold?',
            answer: (
              <p>
                No — both reductions start at slope zero. Crossing {usd(TH_S, 0)} by a single
                dollar costs the wage-less consultant{' '}
                {usd(thresholdCase.deduction - dollarOverThreshold.deduction)} ({usd(thresholdCase.deduction, 0)}{' '}
                → {usd(dollarOverThreshold.deduction)}); a joint couple {usd(100, 0)} over keeps{' '}
                {usd(mfjHundredOver.deduction, 0)} of {usd(mfjAtThreshold.deduction, 0)}. The
                phase-out is a ramp; the wall, for SSTBs, waits at the top of the band.
              </p>
            ),
          },
          {
            question: 'How fast does the SSTB phase-out actually bite inside the band?',
            answer: (
              <p>
                Faster than the applicable percentage suggests, because the two reductions
                compound — and front-loaded. At {usd(210000, 0)} single, a wage-less SSTB with{' '}
                {usd(150000, 0)} of QBI keeps only {usd(decayEarly.deduction)} — 20% × QBI ×{' '}
                {pct(decayEarly.applicablePct * 100, 1)}² — and the next {usd(1000, 0)} of
                taxable income removes {usd(decayEarlyStep)}; by {usd(220000, 0)} the same step
                costs only {usd(perThousandAt220k)}, because less deduction remains to erode.
              </p>
            ),
          },
          {
            question: 'How many payroll dollars does it take to unlock the full 20%?',
            answer: (
              <p>
                While the 50%-of-wages branch binds, the unlock is 40% of effective QBI:{' '}
                {usd(unlockAboveBand ?? 0, 0)} of wages on a {usd(150000, 0)} QBI above the band,
                or {usd(coupleUnlock ?? 0, 0)} for the MFJ couple in the worked example, whose
                wages count at only {pct(coupleCase.applicablePct * 100, 1)}. Below the threshold
                the question does not arise — the limit is off.
              </p>
            ),
          },
          {
            question: 'I just crossed the top of the phase-out range — is the deduction really gone?',
            answer: (
              <p>
                For an SSTB, yes: at {usd(250000, 0)} single the {usd(150000, 0)}-QBI consultant
                deducts {usd(pastTopSstb.deduction, 0)} and no wage bill changes that. The
                identical non-SSTB keeps {usd(pastTopWaged.deduction, 0)} with {usd(60000, 0)} of
                wages — its permanent floor — and {usd(pastTopBare.deduction, 0)} with no wages
                and no qualified property.
              </p>
            ),
          },
          {
            question: 'My business had a down year and QBI is negative — is the deduction lost?',
            answer: (
              <p>
                A qualified loss produces no current-year deduction — the engine reports $0 — but
                it is not wasted: it carries forward and offsets the same business&apos;s QBI in
                later years. This tool does not model carryforwards, so enter the netted
                current-year figure, not the raw one.
              </p>
            ),
          },
          {
            question: 'Whose income counts toward the threshold — mine or the household&apos;s?',
            answer: (
              <p>
                Taxable income on the whole return: a spouse&apos;s W-2 salary, capital gains and
                other businesses all stack, which is why the joint amounts are exactly double the
                single ones ({usd(TH_M, 0)} vs {usd(TH_S, 0)}, with double the range). The
                phase-in starts at the first dollar over — a wage-less non-SSTB couple {usd(100, 0)}{' '}
                over the joint threshold already loses{' '}
                {usd(mfjAtThreshold.deduction - mfjHundredOver.deduction, 0)}.
              </p>
            ),
          },
          {
            question: 'Below the threshold, did my S-corp salary hurt the QBI deduction?',
            answer: (
              <p>
                For QBI alone, yes. A consultant with {usd(120000, 0)} of QBI at {usd(150000, 0)}{' '}
                of taxable income deducts {usd(solePropBelowTh.deduction, 0)}; converting{' '}
                {usd(40000, 0)} of it to owner salary — taxable income unchanged, since the salary
                is still your income — drops the deduction to {usd(salariedBelowTh.deduction, 0)}.{' '}
                Below the threshold the wage limit is off, so salary only shrinks the 20% base —
                the payroll-tax case has to stand on its own.
              </p>
            ),
          },
          {
            question: 'Does the QBI deduction reduce self-employment tax?',
            answer: (
              <p>
                No — §199A is a below-the-line income-tax deduction; SE and FICA tax are computed
                before it exists. The interaction runs the other way: ½ SE tax reduces QBI itself,
                which the QBI field expects you to have already subtracted. The{' '}
                <a href="/self-employment-tax-calculator/">self-employment tax calculator</a>{' '}
                prices that layer separately.
              </p>
            ),
          },
          {
            question: 'Is my rental real estate qualified business income?',
            answer: (
              <p>
                Only when the activity rises to a trade or business under §162 — the IRS safe
                harbor (Rev. Proc. 2019-38) turns on hours and services, and triple-net
                arrangements generally fail it. This tool takes QBI as an input, so settle the
                classification first; once cleared, an active rental&apos;s building basis can do
                real work through the UBIA branch.
              </p>
            ),
          },
          {
            question: 'Why does the widget say Form 8995 at exactly the threshold, but 8995-A one dollar later?',
            answer: (
              <p>
                The simplified form covers taxable income at or below {usd(TH_S, 0)} single /{' '}
                {usd(TH_M, 0)} joint — at that exact income the engine still treats the wage limit
                as off ({String(formSwitchAt)}); one dollar higher it files 8995-A. The dollars at
                stake at the boundary are trivial, but the form choice is binary.
              </p>
            ),
          },
          {
            question: 'Can I use these numbers on my 2026 return?',
            answer: (
              <p>
                Not as-is. The parameters are 2025 — {numFmt(TH_S, 0)}/{numFmt(TH_M, 0)}{' '}
                thresholds over the statutory {numFmt(RANGE_S, 0)}/{numFmt(RANGE_M, 0)} ranges.
                From 2026 the OBBBA widens the ranges and thresholds re-index, shifting every
                boundary in this guide; the mechanics themselves are unchanged.
              </p>
            ),
          },
        ]}
      />

      <RelatedCalculators
        links={[
          { href: '/s-corp-tax-calculator/', label: 'S-Corp Salary Calculator' },
          { href: '/llc-vs-ccorp-tax-calculator/', label: 'LLC vs C-Corp Tax Calculator' },
          { href: '/freelance-hourly-rate-calculator/', label: 'Freelance Hourly Rate' },
        ]}
      />
    </article>
  );
}

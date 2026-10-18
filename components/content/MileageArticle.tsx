import Faq from '@/components/Faq';
import { ArticleToc, RelatedCalculators } from '@/components/Article';
import {
  boundaryScans,
  compareMileage,
  marginalSaving,
  neutralMileage,
  MILEAGE_CONSTANTS_2025,
  type MileageInputs,
} from '@/lib/mileage';
import { numFmt, pct, usd } from '@/lib/format';

/** The tool's default scenario, computed from the same lib the widget uses:
 *  9,000 business miles on a car costing $9,600/yr to run, 65% business use. */
const EXAMPLE: MileageInputs = {
  businessMiles: 9000,
  depreciation: 3600,
  fuelEnergy: 2600,
  insurance: 1900,
  maintenance: 1200,
  registration: 300,
  businessSharePct: 65,
};
const EX = compareMileage(EXAMPLE, 24, true);
const EXN = neutralMileage(EXAMPLE);

/** Worked example B — the calculator's "New EV, low miles" preset, verbatim. */
const EV_EXAMPLE: MileageInputs = {
  businessMiles: 4500,
  depreciation: 8400,
  fuelEnergy: 700,
  insurance: 2600,
  maintenance: 400,
  registration: 600,
  businessSharePct: 40,
};
const EXV = compareMileage(EV_EXAMPLE, 24, true);
const EXVN = neutralMileage(EV_EXAMPLE);
/** 40% share × $12,700 = $5,080 ÷ 4,500 mi — the actual method's rate per mile. */
const EV_RATE_PER_MILE = EXV.actual.deduction / EV_EXAMPLE.businessMiles;

/** Worked example C — the "Rideshare, paid-off car" preset, verbatim. */
const RIDE_EXAMPLE: MileageInputs = {
  businessMiles: 28000,
  depreciation: 2200,
  fuelEnergy: 4800,
  insurance: 2800,
  maintenance: 2400,
  registration: 250,
  businessSharePct: 85,
};
const EXR = compareMileage(RIDE_EXAMPLE, 24, true);
const EXRN = neutralMileage(RIDE_EXAMPLE);
/** Basis a switch would have to recover: 33¢ × every standard-rate mile. */
const RIDE_BASIS_REDUCTION = RIDE_EXAMPLE.businessMiles * MILEAGE_CONSTANTS_2025.depreciationComponentPerMile;

/** The "Contractor truck" preset (FAQ scenario). */
const TRUCK = compareMileage(
  {
    businessMiles: 18000,
    depreciation: 7000,
    fuelEnergy: 5500,
    insurance: 2400,
    maintenance: 2800,
    registration: 450,
    businessSharePct: 75,
  },
  24,
  true,
);

/** The "Paid-off errand car" preset (FAQ scenario). */
const ERRAND = compareMileage(
  {
    businessMiles: 6000,
    depreciation: 0,
    fuelEnergy: 1600,
    insurance: 1400,
    maintenance: 900,
    registration: 200,
    businessSharePct: 35,
  },
  24,
  true,
);

/** What $1,000 of deduction is worth at 24%, with and without the SE-tax layer. */
const PER_K = marginalSaving(1000, 24, true);
const PER_K_NO_SE = marginalSaving(1000, 24, false);
/** 0.9235 × 15.3% — the SE-tax slice of every Schedule C dollar deducted. */
const SE_LAYER_PCT = MILEAGE_CONSTANTS_2025.seBaseFactor * MILEAGE_CONSTANTS_2025.seRate * 100;

/** Exact tie on the default profile: 65% × C = $6,300 → C = $9,692.31. */
const COST_TIE_EXACT = EX.standard.deduction / (EXAMPLE.businessSharePct / 100);
/** The engine's $0.50 winner tolerance expressed in cost dollars at the 65% share. */
const TOLERANCE_IN_COST = 0.5 / (EXAMPLE.businessSharePct / 100);
/** Sub-dollar rates render in cents, not rounded dollars — half a cent matters here. */
const cents = (rate: number) => `${(rate * 100).toFixed(1).replace(/\.0$/, '')}¢`;

/**
 * Decision-boundary flips, COMPUTED from this page's own engine at build
 * time via boundaryScans() (lib/mileage.ts): (a) business mileage at 1-mile
 * resolution on the default profile; (b) annual vehicle cost at $1
 * resolution (depreciation line only) at the default 9,000 miles / 65%
 * share; (c) business-use share at whole-percent resolution at the default
 * mileage and cost. Each value is the FIRST input at which the engine's
 * winner — which carries a built-in $0.50 tie tolerance — flips. Derived
 * rather than hand-typed, so the published flips cannot drift from the
 * arithmetic the widget runs; closed forms cross-check every scan, method
 * documented in "Decision boundaries" below.
 */
const SCAN = boundaryScans(EXAMPLE);

export default function MileageArticle() {
  const toc = [
    { id: 'what-counts', label: 'What counts as a business mile' },
    { id: 'methods', label: 'The two methods, exactly' },
    { id: 'worked-example', label: 'Worked example' },
    { id: 'worked-example-ev', label: 'A second example — actual wins' },
    { id: 'worked-example-highmile', label: 'A third example — standard wins' },
    { id: 'choosing', label: 'Which method wins, and when' },
    { id: 'boundaries', label: 'Decision boundaries' },
    { id: 'switching', label: 'Switching rules & basis recovery' },
    { id: 'records', label: 'The mileage log & audit reality' },
    { id: 'caveats', label: 'Important caveats' },
    { id: 'glossary', label: 'Glossary' },
    { id: 'faq', label: 'FAQ' },
  ];

  return (
    <article className="prose-article">
      <ArticleToc items={toc} />

      <h2 id="what-counts">What counts as a business mile — the rule the IRS actually audits</h2>
      <p>
        Both methods price the same raw material: <strong>qualifying business miles</strong>. The
        classification rules come first, because no method choice can rescue a personal mile:
      </p>
      <ul>
        <li>
          <strong>Commuting is never deductible.</strong> Daily travel between your home and a
          regular place of work is personal use — home-to-office miles are out under both methods,
          in both directions, every day (Pub 463). The &ldquo;business miles&rdquo; input of this
          tool is the count <em>after</em> these trips are excluded.
        </li>
        <li>
          <strong>The home-office exception.</strong> If a home office is your principal place of
          business, the calculus changes: trips from that home office to <em>other</em> work
          locations (clients, suppliers, the job site) are business miles — the commute has
          effectively already ended at the office. Pricing that qualification is a different
          instrument: see the{' '}
          <a href="/home-office-deduction-calculator/">Home Office Deduction Calculator</a>.
        </li>
        <li>
          <strong>Between-business-location trips count.</strong> Office to client, client to
          supplier, first work site to second work site — deductible in full for the distance
          driven (and a temporary stop for personal errands along the way does not poison the
          whole trip, though the extra miles it adds are personal).
        </li>
        <li>
          <strong>Errands and mixed days.</strong> Post office, bank, hardware store for supplies —
          business miles when the purpose is business. The IRS does not require perfect routing,
          only an honest record of where business driving started and stopped each day.
        </li>
      </ul>
      <p>
        One item sits outside both methods entirely: <strong>parking and tolls are 100% deductible
        in full</strong> whatever method you choose — they are not in the standard rate, and they
        are not prorated by the business share. Keep those receipts separately; this calculator
        deliberately excludes them from both columns.
      </p>

      <h2 id="methods">The two methods, exactly</h2>
      <p>
        Once the miles qualify, the tax code lets you price the vehicle&apos;s business use one of
        two ways — <strong>but only one per vehicle per year</strong>:
      </p>
      <ol>
        <li>
          <p>
            <strong>Standard mileage rate</strong>:{' '}
            <code>{usd(MILEAGE_CONSTANTS_2025.standardRatePerMile, 2)} × business miles</code>. The
            2025 rate is {usd(MILEAGE_CONSTANTS_2025.standardRatePerMile, 2)}/mile, set by the IRS
            in Notice 2025-5 — announced each December by news release (IR-2024-312 for 2025), up
            from {usd(MILEAGE_CONSTANTS_2025.standardRate2024PerMile, 2)} in 2024. The rate is a
            bundle: gas, oil, repairs, tires, insurance, license, registration{' '}
            <em>and depreciation</em>. Of the 2025 rate,{' '}
            <code>{usd(MILEAGE_CONSTANTS_2025.depreciationComponentPerMile, 2)}/mile</code>{' '}
            is treated as depreciation (Notice 2025-5) — which is why a standard-rate year permits
            no separate MACRS, §179 or bonus depreciation on the same vehicle, and why every
            standard-rate mile quietly reduces the car&apos;s tax basis.
          </p>
        </li>
        <li>
          <p>
            <strong>Actual-expense method</strong>:{' '}
            <code>business-use share × total annual operating cost</code>. Add up the year&apos;s
            depreciation (or lease payments), fuel and electricity, insurance, maintenance and
            repairs, registration and fees — then multiply by the share of the vehicle&apos;s use
            that was business. The share is usually computed in miles: business miles ÷ total
            miles. (Self-employed filers may also include the business share of vehicle-loan
            interest; that line is not modeled here.)
          </p>
        </li>
      </ol>
      <p>
        The structural difference is everything: the standard method <strong>scales with
        driving</strong> — every business mile is worth{' '}
        {usd(MILEAGE_CONSTANTS_2025.standardRatePerMile, 2)} whether the car is a beater or a
        Bentley — while the actual method <strong>scales with spending</strong> and does not care
        how far you drove. That is the whole decision: heavy mileage favors the rate, heavy cost
        per mile favors the ledger.
      </p>

      <h2 id="worked-example">Worked example — the default scenario</h2>
      <p>
        A consultant driving {numFmt(EXAMPLE.businessMiles)} qualifying business miles a year in a
        car that costs {usd(EX.actual.breakdown.totalCost, 0)}/yr to run —{' '}
        {usd(EXAMPLE.depreciation, 0)} of depreciation, {usd(EXAMPLE.fuelEnergy, 0)} fuel,{' '}
        {usd(EXAMPLE.insurance, 0)} insurance, {usd(EXAMPLE.maintenance, 0)} maintenance,{' '}
        {usd(EXAMPLE.registration, 0)} registration — used {pct(EXAMPLE.businessSharePct, 0)} for
        business. Sole proprietor, 24% federal bracket:
      </p>
      <table>
        <thead>
          <tr>
            <th>Line</th>
            <th>Standard rate</th>
            <th>Actual method</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Method formula</td>
            <td>{usd(MILEAGE_CONSTANTS_2025.standardRatePerMile, 2)} × {numFmt(EXAMPLE.businessMiles)} mi</td>
            <td>{pct(EXAMPLE.businessSharePct, 0)} × {usd(EX.actual.breakdown.totalCost, 0)}</td>
          </tr>
          <tr>
            <td>Deduction per year</td>
            <td>{usd(EX.standard.deduction, 0)}</td>
            <td>{usd(EX.actual.deduction, 0)}</td>
          </tr>
          <tr>
            <td>Federal income tax saved</td>
            <td>{usd(EX.standard.saving.incomeTax, 0)}</td>
            <td>{usd(EX.actual.saving.incomeTax, 0)}</td>
          </tr>
          <tr>
            <td>SE tax saved (14.13% layer)</td>
            <td>{usd(EX.standard.saving.seTax, 0)}</td>
            <td>{usd(EX.actual.saving.seTax, 0)}</td>
          </tr>
          <tr>
            <td><strong>Total tax saved</strong></td>
            <td><strong>{usd(EX.standard.saving.total, 0)}</strong></td>
            <td><strong>{usd(EX.actual.saving.total, 0)}</strong></td>
          </tr>
        </tbody>
      </table>
      <p>
        The standard rate deducts {usd(Math.abs(EX.deductionDelta), 0)} more and saves{' '}
        {usd(Math.abs(EX.savingDelta))}/yr more tax — both figures recomputed by the exact
        functions the calculator above runs. But notice how thin the margin is: at{' '}
        {usd(EX.actual.breakdown.effectiveRatePerMile ?? 0, 2)}/mile, the actual method is within
        a cent and a half of the {usd(MILEAGE_CONSTANTS_2025.standardRatePerMile, 2)} rate. The
        two methods tie at the neutral mileage —{' '}
        {numFmt(Math.round(EXN.exactMiles ?? 0))} business miles/yr — and this consultant drives
        only {numFmt(EXAMPLE.businessMiles - Math.round(EXN.exactMiles ?? 0))} miles past it, on
        the standard rate&apos;s side of the line. From here every extra business mile widens the
        standard rate&apos;s lead; it would take roughly one <em>fewer</em> client a month —
        dropping the year back below {numFmt(Math.round(EXN.exactMiles ?? 0))} miles — to flip
        the verdict to the actual method.
      </p>

      <h2 id="worked-example-ev">A second worked example — expensive car, light mileage</h2>
      <p>
        Now the calculator&apos;s &ldquo;New EV, low miles&rdquo; preset:{' '}
        {numFmt(EV_EXAMPLE.businessMiles)} business miles, {pct(EV_EXAMPLE.businessSharePct, 0)}{' '}
        business share, a vehicle costing {usd(EXV.actual.breakdown.totalCost, 0)}/yr — heavy
        depreciation ({usd(EV_EXAMPLE.depreciation, 0)}), trivial electricity, expensive coverage:
      </p>
      <table>
        <thead>
          <tr>
            <th>Line</th>
            <th>Standard rate</th>
            <th>Actual method</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Deduction per year</td>
            <td>{usd(EXV.standard.deduction, 0)}</td>
            <td>{usd(EXV.actual.deduction, 0)}</td>
          </tr>
          <tr>
            <td>Total tax saved @24% + SE</td>
            <td>{usd(EXV.standard.saving.total, 0)}</td>
            <td>{usd(EXV.actual.saving.total, 0)}</td>
          </tr>
        </tbody>
      </table>
      <p>
        The actual method deducts {usd(EXV.deductionDelta, 0)} more —{' '}
        {pct(EV_EXAMPLE.businessSharePct, 0)}{' '}
        of {usd(EXV.actual.breakdown.totalCost, 0)} beats {usd(MILEAGE_CONSTANTS_2025.standardRatePerMile, 2)} ×{' '}
        {numFmt(EV_EXAMPLE.businessMiles)}. The neutral mileage for this cost profile is{' '}
        {numFmt(Math.round(EXVN.exactMiles ?? 0))} miles — this driver would need to lift business
        driving {pct(((EXVN.exactMiles ?? 0) / EV_EXAMPLE.businessMiles - 1) * 100, 0)} (to{' '}
        {numFmt(Math.round(EXVN.exactMiles ?? 0))} mi/yr) before the standard rate caught up.
        Expressed per mile, the
        actual method recovers {usd(EV_RATE_PER_MILE, 2)}/mile against the standard rate&apos;s
        flat {usd(MILEAGE_CONSTANTS_2025.standardRatePerMile, 2)}.
        Low-mileage, high-cost vehicles are the actual method&apos;s home turf.
      </p>

      <h2 id="worked-example-highmile">A third worked example — heavy mileage, cheap car</h2>
      <p>
        The mirror image: the &ldquo;Rideshare, paid-off car&rdquo; preset —{' '}
        {numFmt(RIDE_EXAMPLE.businessMiles)} business miles at{' '}
        {pct(RIDE_EXAMPLE.businessSharePct, 0)} share on a car costing{' '}
        {usd(EXR.actual.breakdown.totalCost, 0)}/yr (no depreciation at all):
      </p>
      <table>
        <thead>
          <tr>
            <th>Line</th>
            <th>Standard rate</th>
            <th>Actual method</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Deduction per year</td>
            <td>{usd(EXR.standard.deduction, 0)}</td>
            <td>{usd(EXR.actual.deduction, 0)}</td>
          </tr>
          <tr>
            <td>Total tax saved @24% + SE</td>
            <td>{usd(EXR.standard.saving.total, 0)}</td>
            <td>{usd(EXR.actual.saving.total, 0)}</td>
          </tr>
        </tbody>
      </table>
      <p>
        The standard rate nearly doubles the actual method — {usd(EXR.standard.deduction, 0)}{' '}
        versus {usd(EXR.actual.deduction, 0)}, a {usd(Math.abs(EXR.deductionDelta), 0)} gap. The
        neutral mileage is {numFmt(Math.round(EXRN.exactMiles ?? 0))} miles/yr; a full-time driver
        blows past it in the first few months. This is the standard rate&apos;s structural
        advantage: it ignores how cheap your car is. The one caveat rides on the other side of the
        ledger — every one of those standard-rate miles carries{' '}
        {usd(MILEAGE_CONSTANTS_2025.depreciationComponentPerMile, 2)} of embedded depreciation, so{' '}
        {numFmt(RIDE_EXAMPLE.businessMiles)} miles silently reduces the car&apos;s basis by{' '}
        {usd(RIDE_BASIS_REDUCTION, 0)} this year alone (see &ldquo;Switching rules&rdquo; below).
      </p>

      <h2 id="choosing">Which method wins, and when</h2>
      <p>
        One comparison settles it. Compute the actual method&apos;s{' '}
        <strong>rate per business mile</strong> — share × annual cost ÷ business miles — and set
        it against the standard {usd(MILEAGE_CONSTANTS_2025.standardRatePerMile, 2)}:
      </p>
      <ul>
        <li>
          <strong>Above {usd(MILEAGE_CONSTANTS_2025.standardRatePerMile, 2)}/mile</strong> — the
          actual method deducts more <em>this year</em>. Expensive, lightly driven vehicles live
          here: new EVs, leased luxury cars, work trucks that idle more than they roll.
        </li>
        <li>
          <strong>Below {usd(MILEAGE_CONSTANTS_2025.standardRatePerMile, 2)}/mile</strong> — the
          standard rate deducts more. Paid-off cars and high-mileage drivers live here; the more
          you drive, the further ahead the rate runs.
        </li>
      </ul>
      <p>
        The same fact viewed along the mileage axis is the <strong>neutral mileage</strong>:{' '}
        share × cost ÷ {usd(MILEAGE_CONSTANTS_2025.standardRatePerMile, 2)}. Below it the flat
        actual line leads; above it the 70¢-per-mile line pulls away forever. The sensitivity
        chart above draws both lines and marks exactly this crossing.
      </p>
      <p>
        But the deduction is not the only currency. The standard rate asks for a mileage log and
        nothing else; the actual method asks for receipts, a depreciation schedule (MACRS, or
        lease accounting), and — for cars — the §280F luxury-automobile caps that can trim
        depreciation. And a defensible rule of thumb mirrors the home-office logic: when the two
        columns land within a few hundred dollars, take the method with the smaller record-keeping
        surface.
      </p>

      <h2 id="boundaries">Decision boundaries</h2>
      <p>
        The critical values below come from <code>boundaryScans()</code> in this page&apos;s own
        engine (<code>lib/mileage.ts</code>), computed at build time rather than quoted from
        statutory prose: business mileage is swept in 1-mile steps on the default profile, annual
        vehicle cost in $1 steps (applied to the depreciation line) at the default mileage and
        share, and the business share in whole-percent steps. Each scan reports the first input
        at which the engine&apos;s winner flips — the engine grants a {usd(0.5)} tie tolerance on
        the deduction, so the flips sit a step or two above the exact algebra. The closed forms
        cross-check every scan: the tie cost is deduction ÷ share, and the neutral mileage is
        share × cost ÷ rate.
      </p>
      <table>
        <thead>
          <tr>
            <th>Boundary</th>
            <th>Critical value</th>
            <th>What it decides</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Neutral mileage, default profile</td>
            <td>
              {numFmt(Math.round(EXN.exactMiles ?? 0))} mi closed form ·{' '}
              {numFmt(SCAN.mileageFlip ?? 0)} mi in the 1-mile scan
            </td>
            <td>
              Past this business mileage the standard rate leads — the engine&apos;s{' '}
              <code>neutralMileage</code>. The scan value sits {(SCAN.mileageFlip ?? 0) - Math.round(EXN.exactMiles ?? 0)}{' '}
              miles above the closed form purely because of the {usd(0.5)} winner tolerance.
            </td>
          </tr>
          <tr>
            <td>Vehicle cost flip, default profile</td>
            <td>
              {usd(SCAN.costFlip ?? 0, 0)}/yr ({usd(COST_TIE_EXACT, 2)} exact tie)
            </td>
            <td>
              First whole-dollar annual cost where the actual method strictly leads at{' '}
              {numFmt(EXAMPLE.businessMiles)} mi / {pct(EXAMPLE.businessSharePct, 0)} share. The
              exact tie is {usd(COST_TIE_EXACT, 2)}; the {usd(0.5)} tolerance costs{' '}
              {usd(TOLERANCE_IN_COST, 2)} of cost, and the first dollar past it is{' '}
              {usd(SCAN.costFlip ?? 0, 0)}.
            </td>
          </tr>
          <tr>
            <td>Share flip, default profile</td>
            <td>{pct(SCAN.shareFlip ?? 0, 0)} business share</td>
            <td>
              First whole-percent share at which actual leads at {numFmt(EXAMPLE.businessMiles)} mi
              and {usd(EX.actual.breakdown.totalCost, 0)}/yr of cost — the algebra ties at{' '}
              {pct((EX.standard.deduction / EX.actual.breakdown.totalCost) * 100, 2)}.
            </td>
          </tr>
          <tr>
            <td>Effective rate, per profile</td>
            <td>
              {usd(EX.actual.breakdown.effectiveRatePerMile ?? 0, 2)} default ·{' '}
              {usd(EV_RATE_PER_MILE, 2)} EV ·{' '}
              {usd(EXR.actual.breakdown.effectiveRatePerMile ?? 0, 2)} rideshare
            </td>
            <td>
              The one-number summary of the actual method — compare each directly to{' '}
              {usd(MILEAGE_CONSTANTS_2025.standardRatePerMile, 2)}.
            </td>
          </tr>
          <tr>
            <td>Neutral mileage, per profile</td>
            <td>
              {numFmt(Math.round(EXVN.exactMiles ?? 0))} mi EV ·{' '}
              {numFmt(Math.round(EXRN.exactMiles ?? 0))} mi rideshare
            </td>
            <td>
              How far the driving would have to move before the standard rate takes over —
              {numFmt(EV_EXAMPLE.businessMiles)} and {numFmt(RIDE_EXAMPLE.businessMiles)} actual,
              respectively.
            </td>
          </tr>
          <tr>
            <td>Rate history</td>
            <td>
              {usd(MILEAGE_CONSTANTS_2025.standardRate2024PerMile, 2)} (2024) ·{' '}
              {usd(MILEAGE_CONSTANTS_2025.standardRatePerMile, 2)} (2025)
            </td>
            <td>
              The rate moves every December — re-check it before filing; the neutral mileage moves
              with it.
            </td>
          </tr>
        </tbody>
      </table>
      <p>
        What no scan prices: the actual method&apos;s record burden, the §280F depreciation caps,
        and the basis reduction silently accumulating under standard-rate years. Those decide close
        cases — which is why the few-hundred-dollars rule of thumb survives every table here.
      </p>

      <h2 id="switching">Switching rules &amp; the depreciation basis you leave behind</h2>
      <ul>
        <li>
          <strong>One method per vehicle per year — but you may switch year to year.</strong> The
          election is annual and per-vehicle (a second vehicle may use the other method in the same
          year). The one hard door: a lessee who uses the standard rate must keep using it for the
          entire lease term.
        </li>
        <li>
          <strong>The first-year decision is a one-way door in one direction.</strong> Use the
          standard rate in the first year the vehicle enters business service and you may later
          switch to actual expenses (with depreciation then computed straight-line over the
          remaining life). Use actual with accelerated depreciation — MACRS 200% declining balance,
          §179 expensing, or bonus depreciation — in that first year, and{' '}
          <strong>the standard rate is closed to that vehicle forever</strong>.
        </li>
        <li>
          <strong>Basis recovery: standard-rate years shrink the car.</strong> The{' '}
          {usd(MILEAGE_CONSTANTS_2025.depreciationComponentPerMile, 2)}/mile depreciation embedded
          in the 2025 rate is treated as depreciation <em>allowed</em> — it reduces the
          vehicle&apos;s adjusted basis whether or not you ever touch a Form 4562. The rideshare
          example above accumulates {usd(RIDE_BASIS_REDUCTION, 0)} of basis reduction in a single
          year. When you switch to the actual method, your depreciation runs on that reduced
          basis; when you sell the car, gain is measured against it. Ignoring this is the classic
          mileage-deduction audit adjustment.
        </li>
        <li>
          <strong>Switching from actual to standard</strong> mid-ownership is allowed only if you
          never took §179/bonus/accelerated depreciation on the vehicle; straight-line actual
          years leave the door open. The standard rate then simply starts multiplying miles,
          indifferent to the depreciation already claimed.
        </li>
        <li>
          <strong>Leased vehicles</strong> price the actual method through lease payments rather
          than depreciation (with an &ldquo;inclusion amount&rdquo; adjustment on expensive
          leases — outside this model).
        </li>
      </ul>

      <h2 id="records">The mileage log &amp; audit reality</h2>
      <p>
        Vehicle expenses are <strong>listed property</strong> under §274(d): no deduction survives
        without substantiation, and the substantiation standard is <em>adequate records</em>, not
        estimates. A contemporaneous log — paper or app — is the entire defense. What each entry
        needs:
      </p>
      <ul>
        <li><strong>Amount</strong>: the mileage for each trip (odometer start and end, or the app&apos;s GPS trace).</li>
        <li><strong>Time and place</strong>: date and destination.</li>
        <li><strong>Business purpose</strong>: one honest line — &ldquo;client meeting,&rdquo; &ldquo;supplies pickup.&rdquo;</li>
        <li><strong>Business relationship</strong>: who the client or supplier was.</li>
      </ul>
      <p>
        The log must be <strong>contemporaneous</strong> — made near the time of the trip, weekly
        at the outside. A log reconstructed the week before filing is worth little; the IRS
        explicitly discounts it. Two abbreviations are accepted: a full-year odometer reading with
        trip-by-trip business entries, or a <strong>representative sample</strong> (commonly a
        90-day log or one week per month) extrapolated to the year — valid when the sampled period
        genuinely resembles the rest of the year. Apps that passively record GPS mileage make the
        whole requirement nearly free; there is no longer any excuse for the shoebox estimate.
      </p>
      <p>
        For the actual method, add the receipts: fuel, insurance premiums, repair invoices,
        registration, and the depreciation schedule (Form 4562 lineage). And one honesty note this
        page shares with the home-office tool: the deduction also shrinks qualified business income
        for §199A filers below the phase-out, cutting the QBI deduction by up to 20¢ per dollar —
        an effective rate near 80% of bracket rather than 100%.
      </p>

      <h2 id="caveats">Important caveats</h2>
      <ul>
        <li>Federal, tax year 2025 only. The standard rate is re-announced every December ({usd(MILEAGE_CONSTANTS_2025.standardRate2024PerMile, 2)} for 2024, {usd(MILEAGE_CONSTANTS_2025.standardRatePerMile, 2)} for 2025; 2026 has since been set at {cents(MILEAGE_CONSTANTS_2025.standardRate2026H1PerMile)} rising to {cents(MILEAGE_CONSTANTS_2025.standardRate2026H2PerMile)} mid-year — this tool stays pinned to 2025).</li>
        <li>Commuting miles are excluded by definition; the tool trusts the count you enter. If a home office is your principal place of business, its qualification changes which trips count — priced elsewhere on this site.</li>
        <li>Parking and tolls are 100% deductible on top of either method and are deliberately not modeled; neither is vehicle-loan interest&apos;s business share (an actual-method line for the self-employed).</li>
        <li>§280F luxury-automobile depreciation caps, lease inclusion amounts, and FAVR allowances are out of scope.</li>
        <li>SE-tax savings assume 2025 self-employment earnings below the {usd(MILEAGE_CONSTANTS_2025.ssWageBase2025, 0)} Social Security base; above it the marginal SE layer is 2.9%, not 15.3%.</li>
        <li>The business-use share is user-supplied. In practice it is usually mileage-based (business ÷ total); the tool surfaces the implied total mileage so a share that disagrees with the odometer shows itself.</li>
        <li>Nothing here is tax advice. Verify the current-year rate and your state&apos;s rules with a qualified professional.</li>
      </ul>

      <h2 id="glossary">Glossary</h2>
      <p>
        The vocabulary of the vehicle deduction in the sense this guide uses it — written for a
        reader meeting the mileage rules for the first time.
      </p>
      <dl className="mb-4">
        <dt className="mt-5 font-semibold text-slate-900 dark:text-slate-100">Standard mileage rate</dt>
        <dd className="mt-1 leading-relaxed text-slate-600 dark:text-slate-300">
          The IRS&apos;s per-mile price for business driving:{' '}
          {usd(MILEAGE_CONSTANTS_2025.standardRatePerMile, 2)}/mile in 2025 (Notice 2025-5),
          bundling fuel, maintenance, insurance, registration and depreciation. Multiplication
          replaces bookkeeping.
        </dd>
        <dt className="mt-5 font-semibold text-slate-900 dark:text-slate-100">Actual-expense method</dt>
        <dd className="mt-1 leading-relaxed text-slate-600 dark:text-slate-300">
          The ledger route: business-use share times the year&apos;s real operating cost. Deducts
          more for expensive, lightly driven vehicles — at the price of receipts and a
          depreciation schedule.
        </dd>
        <dt className="mt-5 font-semibold text-slate-900 dark:text-slate-100">Business-use share</dt>
        <dd className="mt-1 leading-relaxed text-slate-600 dark:text-slate-300">
          The fraction of the vehicle&apos;s use that is business — usually business miles ÷ total
          miles. Allocates every actual-method cost line; irrelevant to the standard rate, which
          only multiplies miles.
        </dd>
        <dt className="mt-5 font-semibold text-slate-900 dark:text-slate-100">Commuting</dt>
        <dd className="mt-1 leading-relaxed text-slate-600 dark:text-slate-300">
          Travel between home and a regular place of work. Personal by statute — never a business
          mile, under either method, however early the drive or how much work happens en route.
        </dd>
        <dt className="mt-5 font-semibold text-slate-900 dark:text-slate-100">Neutral mileage</dt>
        <dd className="mt-1 leading-relaxed text-slate-600 dark:text-slate-300">
          The business-mile count at which both methods tie: share × annual cost ÷ standard rate.
          Below it the actual method leads; above it the standard rate pulls away at{' '}
          {usd(MILEAGE_CONSTANTS_2025.standardRatePerMile, 2)}/mile.
        </dd>
        <dt className="mt-5 font-semibold text-slate-900 dark:text-slate-100">Depreciation component</dt>
        <dd className="mt-1 leading-relaxed text-slate-600 dark:text-slate-300">
          The slice of the standard rate the IRS treats as depreciation —{' '}
          {usd(MILEAGE_CONSTANTS_2025.depreciationComponentPerMile, 2)}/mile of the 2025 rate. It
          reduces the vehicle&apos;s basis, blocks §179/bonus/MACRS on the same car, and is what a
          later switch or sale has to account for.
        </dd>
        <dt className="mt-5 font-semibold text-slate-900 dark:text-slate-100">Adjusted basis</dt>
        <dd className="mt-1 leading-relaxed text-slate-600 dark:text-slate-300">
          Purchase price plus improvements, minus depreciation allowed or allowable — including the
          per-mile allowance embedded in standard-rate years. The number against which gain or loss
          is measured when the vehicle is sold.
        </dd>
        <dt className="mt-5 font-semibold text-slate-900 dark:text-slate-100">Listed property / §274(d)</dt>
        <dd className="mt-1 leading-relaxed text-slate-600 dark:text-slate-300">
          Vehicles are property the IRS watches for personal use: deductions require adequate
          records — amount, time, place, business purpose — not estimates.
        </dd>
        <dt className="mt-5 font-semibold text-slate-900 dark:text-slate-100">Contemporaneous log</dt>
        <dd className="mt-1 leading-relaxed text-slate-600 dark:text-slate-300">
          A mileage record made near the time of the trips — weekly at the outside. The single
          strongest piece of evidence a mileage deduction can have, and the first thing examined
          when it is missing.
        </dd>
        <dt className="mt-5 font-semibold text-slate-900 dark:text-slate-100">§280F cap</dt>
        <dd className="mt-1 leading-relaxed text-slate-600 dark:text-slate-300">
          The luxury-automobile limits: annual ceilings on depreciation for passenger cars,
          indexed each year. They trim the actual method&apos;s depreciation line on expensive
          vehicles; not modeled here.
        </dd>
        <dt className="mt-5 font-semibold text-slate-900 dark:text-slate-100">FAVR allowance</dt>
        <dd className="mt-1 leading-relaxed text-slate-600 dark:text-slate-300">
          Fixed and variable rate allowance — an employer reimbursement program combining a fixed
          monthly payment with a per-mile rate. An employer-side mechanism, outside this
          calculator&apos;s self-employment world.
        </dd>
      </dl>

      <Faq
        items={[
          {
            question: 'Can I deduct the drive from home to my office every day?',
            answer: (
              <p>
                No — that is commuting, personal by definition under either method. What changes
                the picture is a qualifying home office: if it is your principal place of business,
                trips from home to <em>other</em> work locations become business miles. The
                qualification itself is a separate test — see the Home Office Deduction Calculator
                on this site.
              </p>
            ),
          },
          {
            question: 'Which method should a heavy-mileage driver pick?',
            answer: (
              <p>
                Almost always the standard rate. The rideshare preset above is the archetype:{' '}
                {numFmt(RIDE_EXAMPLE.businessMiles)} business miles deduct{' '}
                {usd(EXR.standard.deduction, 0)} at the {usd(MILEAGE_CONSTANTS_2025.standardRatePerMile, 2)}{' '}
                rate — nearly double the actual method&apos;s{' '}
                {usd(EXR.actual.deduction, 0)} on a cheap paid-off car. Unless the vehicle is
                genuinely expensive to run (effective rate above{' '}
                {usd(MILEAGE_CONSTANTS_2025.standardRatePerMile, 2)}/mile), mileage volume wins.
              </p>
            ),
          },
          {
            question: 'I use the car 40% for business. Can I deduct 40% of the purchase price?',
            answer: (
              <p>
                Depreciation is not the purchase price — the actual method depreciates the
                vehicle&apos;s depreciable basis over time (5-year MACRS for cars, subject to the
                §280F annual caps, with §179/bonus possibly accelerated), then takes the business
                share. Enter the year&apos;s <em>depreciation allowance</em>, not the car&apos;s
                cost, in this tool — and remember that once you claim §179 or bonus on a vehicle,
                the standard rate is permanently off the table for it.
              </p>
            ),
          },
          {
            question: 'What happens if I switch from the standard rate to actual expenses?',
            answer: (
              <p>
                You may, year to year — with one bookkeeping debt: every standard-rate mile already
                reduced your basis by its depreciation component ({usd(MILEAGE_CONSTANTS_2025.depreciationComponentPerMile, 2)}/mile in 2025).
                Actual-method depreciation then runs on that reduced basis, straight-line over the
                remaining life. Skipping the reduction is the classic adjustment examiners make —
                the rideshare example above accrues {usd(RIDE_BASIS_REDUCTION, 0)} of it in one year.
              </p>
            ),
          },
          {
            question: 'Does the standard mileage rate include depreciation?',
            answer: (
              <p>
                Yes — {usd(MILEAGE_CONSTANTS_2025.depreciationComponentPerMile, 2)} of the{' '}
                {usd(MILEAGE_CONSTANTS_2025.standardRatePerMile, 2)} 2025 rate is depreciation
                (Notice 2025-5). That is why you may not also claim MACRS, §179 or bonus
                depreciation on a standard-rate vehicle, and why the rate quietly shrinks your
                basis mile by mile.
              </p>
            ),
          },
          {
            question: 'Are parking and tolls included in the standard rate?',
            answer: (
              <p>
                No — they sit outside both methods and are 100% deductible in full regardless of
                which method you elect, business or personal share aside (they must still be
                business parking). Keep those receipts separately; this calculator excludes them
                from both columns on purpose.
              </p>
            ),
          },
          {
            question: 'Do I really need a mileage log if I use the standard rate?',
            answer: (
              <p>
                Yes. The standard rate replaces the <em>expense</em> records, not the{' '}
                <em>mileage</em> records — §274(d) adequate-records rules apply either way: date,
                destination, business purpose, and miles per trip, recorded near the time. A GPS
                mileage app satisfies it almost automatically; a year-end estimate does not.
              </p>
            ),
          },
          {
            question: 'Can I estimate business miles from my calendar instead of a log?',
            answer: (
              <p>
                The IRS accepts <strong>representative sampling</strong> — commonly a 90-day log or
                one week per month — extrapolated across the year when the sampled period
                genuinely resembles the rest. It does not accept reconstruction from memory or
                inference. A calendar cross-check strengthens a log; it does not replace one.
              </p>
            ),
          },
          {
            question: 'Is my EV eligible for the standard mileage rate?',
            answer: (
              <p>
                Yes — the rate is fuel-agnostic, and its electricity belongs in the actual
                method&apos;s fuel line. The EV preset above is the case where it matters least:{' '}
                {pct(EV_EXAMPLE.businessSharePct, 0)} of {usd(EXV.actual.breakdown.totalCost, 0)}/yr
                of cost on light mileage makes the actual method deduct{' '}
                {usd(EXV.actual.deduction, 0)} against the standard rate&apos;s{' '}
                {usd(EXV.standard.deduction, 0)}.
              </p>
            ),
          },
          {
            question: 'I lease my car. Does that change the comparison?',
            answer: (
              <p>
                The actual method uses lease payments in place of depreciation (expensive leases
                add an &ldquo;inclusion amount&rdquo; back into income — out of scope here). The
                bigger rule cuts the other way: a lessee who elects the standard rate is locked
                into it for the <strong>entire lease term</strong>, not just the year.
              </p>
            ),
          },
          {
            question: 'Can I use the standard rate on one vehicle and actual on another?',
            answer: (
              <p>
                Yes — the election is per vehicle per year. What you cannot do is split methods on
                one vehicle in one year, or use the standard rate at all if you operate five or
                more vehicles simultaneously (the anti-fleet rule) or have claimed
                §179/bonus/accelerated depreciation on that vehicle.
              </p>
            ),
          },
          {
            question: 'Why does my business share matter if I enter business miles anyway?',
            answer: (
              <p>
                The two inputs drive different methods. Business miles feed the standard rate
                directly; the share allocates the actual method&apos;s costs. The tool surfaces the
                implied total mileage (business miles ÷ share) so the two stay honest with each
                other — if your share is mileage-based, that implied total should match what the
                odometer actually gained this year.
              </p>
            ),
          },
          {
            question: 'Does the deduction also reduce self-employment tax?',
            answer: (
              <p>
                On Schedule C, both. Per {usd(1000, 0)} of mileage deduction at a 24% bracket the
                engine books {usd(PER_K.seTax, 2)} of SE tax (the{' '}
                {pct(SE_LAYER_PCT, 2)} layer) plus {usd(PER_K.incomeTax, 2)} of income tax after a{' '}
                {usd(PER_K.halfSeClawback, 2)} clawback from the smaller half-of-SE deduction —{' '}
                {usd(PER_K.total, 2)} total, versus {usd(PER_K_NO_SE.total, 0)} for an
                income-tax-only filer.
              </p>
            ),
          },
          {
            question: 'What if my actual costs are higher than my business income?',
            answer: (
              <p>
                Unlike the home-office deduction, vehicle expenses carry no gross-income ceiling.
                They are ordinary §162 business expenses on Schedule C: either method can create or
                deepen a net loss, and the standard mileage rate has no income cap at all. (The
                stop-at-gross-income rule — §280A(c)(5) — is home-office law;{' '}
                <a href="/home-office-deduction-calculator/">that tool</a> documents it.) The one
                income-limited slice lives inside the actual method: §179 expensing is limited to
                income from the active conduct of your trades or businesses, with any excess
                carried forward. A vehicle-driven loss simply flows to your 1040 subject to the
                general at-risk and passive-loss rules — though a business that loses money year
                after year invites hobby-loss (§183) questions, so keep the log regardless.
              </p>
            ),
          },
          {
            question: 'My contractor truck costs a fortune to run. Which method?',
            answer: (
              <p>
                Run the numbers — heavy cost can outrun even heavy miles. The truck preset (75% of{' '}
                {usd(TRUCK.actual.breakdown.totalCost, 0)}/yr at {numFmt(18000)} business miles)
                lands actual at {usd(TRUCK.actual.deduction, 0)} versus the standard rate&apos;s{' '}
                {usd(TRUCK.standard.deduction, 0)} — the actual method wins by{' '}
                {usd(TRUCK.deductionDelta, 0)} despite serious mileage, because its effective rate
                is {usd(TRUCK.actual.breakdown.effectiveRatePerMile ?? 0, 2)}/mile.
              </p>
            ),
          },
          {
            question: 'Does the rate change every year?',
            answer: (
              <p>
                It is re-announced every December by IRS notice — {usd(MILEAGE_CONSTANTS_2025.standardRate2024PerMile, 2)}{' '}
                for 2024, {usd(MILEAGE_CONSTANTS_2025.standardRatePerMile, 2)} for 2025, and for
                2026 the IRS has since set {cents(MILEAGE_CONSTANTS_2025.standardRate2026H1PerMile)}{' '}
                for the first half with an unusual mid-year rise to{' '}
                {cents(MILEAGE_CONSTANTS_2025.standardRate2026H2PerMile)}. This tool is pinned to
                2025; re-check the current rate before filing, since the neutral mileage moves
                with it.
              </p>
            ),
          },
        ]}
      />

      <RelatedCalculators
        links={[
          { href: '/home-office-deduction-calculator/', label: 'Home Office Deduction Calculator' },
          { href: '/self-employment-tax-calculator/', label: 'Self-Employment Tax Calculator' },
          { href: '/quarterly-estimated-tax-calculator/', label: 'Quarterly Estimated Tax Calculator' },
        ]}
      />
    </article>
  );
}

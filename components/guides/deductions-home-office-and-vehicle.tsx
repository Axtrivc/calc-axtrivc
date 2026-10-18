import { ArticleToc } from '@/components/Article';
import {
  compareHomeOffice,
  marginalSaving,
  HOME_OFFICE_CONSTANTS,
  type HomeOfficeInputs,
} from '@/lib/homeoffice';
import {
  boundaryScans,
  compareMileage,
  neutralMileage,
  MILEAGE_CONSTANTS_2025,
  type MileageInputs,
} from '@/lib/mileage';
import { numFmt, pct, usd } from '@/lib/format';

/**
 * Guide body for /guides/deductions-home-office-and-vehicle/ — rendered
 * through GuideShell, which supplies the h1, the prose column, and the
 * closing instruments panel. This component emits the article itself:
 * sections, tables, and the two decision cards, starting at h2.
 *
 * Every instrument-math number below is computed at build time by the same
 * engines the calculators run (lib/homeoffice.ts, lib/mileage.ts) — module
 * scope, no hand-typed results — so the published figures cannot drift from
 * the tools. The two engine flips that need scanning (rent, office area) are
 * scanned here the same way the tool pages scan them.
 */

// ===== Home office — the calculator's default renter preset, verbatim =====
const HO_DEFAULT: HomeOfficeInputs = {
  homeSqFt: 1800,
  officeSqFt: 200,
  tenure: 'rent',
  rent: 21600,
  mortgageInterest: 0,
  propertyTax: 0,
  homeBasis: 0,
  utilities: 2400,
  insurance: 600,
  repairs: 800,
};
const HO = compareHomeOffice(HO_DEFAULT, 24, true);
const HO_SHARE = HO_DEFAULT.officeSqFt / HO_DEFAULT.homeSqFt; // 1/9 = 11.1%
/** Utilities + insurance + repairs on the default profile: the non-rent slice. */
const HO_OPERATING = HO_DEFAULT.utilities + HO_DEFAULT.insurance + HO_DEFAULT.repairs; // $3,800
/** Exact rent where both methods tie: $5 × 1,800 sq ft of home cost, minus operating. */
const HO_RENT_TIE = HO.actual.breakdown.breakevenAnnualHomeCost - HO_OPERATING; // $5,200
/** The engine's $0.50 winner tolerance, expressed in rent at the 1/9 share. */
const HO_TOLERANCE_IN_RENT = 0.5 / HO_SHARE; // $4.50
/** Rent above which the actual method strictly leads (tie + tolerance). */
const HO_STRICT_LEAD_RENT = HO_RENT_TIE + HO_TOLERANCE_IN_RENT; // $5,204.50
/** First whole-dollar rent where the engine's winner flips to 'actual' ($1 scan). */
const HO_RENT_FLIP = (() => {
  for (let rent = 5190; rent <= 5215; rent++) {
    if (compareHomeOffice({ ...HO_DEFAULT, rent }, 24, true).winner === 'actual') return rent;
  }
  return null;
})();

// ===== Home office — the low-cost-area preset, where the simplified option wins =====
const HO_LOW: HomeOfficeInputs = {
  homeSqFt: 3000,
  officeSqFt: 150,
  tenure: 'rent',
  rent: 9600,
  mortgageInterest: 0,
  propertyTax: 0,
  homeBasis: 0,
  utilities: 1500,
  insurance: 500,
  repairs: 200,
};
const LOW = compareHomeOffice(HO_LOW, 24, true);
/** First whole square foot of office where the engine's winner flips to 'actual'. */
const HO_OFFICE_FLIP = (() => {
  for (let sqft = 300; sqft <= 400; sqft++) {
    if (compareHomeOffice({ ...HO_LOW, officeSqFt: sqft }, 24, true).winner === 'actual') {
      return sqft;
    }
  }
  return null;
})();

/** What $1,000 of deduction is worth at 24% on Schedule C (engine-computed). */
const PER_K = marginalSaving(1000, 24, true);
/** 0.9235 × 15.3% — the SE-tax slice of every Schedule C dollar deducted. */
const SE_LAYER_PCT =
  HOME_OFFICE_CONSTANTS.seBaseFactor * HOME_OFFICE_CONSTANTS.seRate * 100; // 14.13%

// ===== Vehicle — the calculator's default preset, verbatim =====
const MI_DEFAULT: MileageInputs = {
  businessMiles: 9000,
  depreciation: 3600,
  fuelEnergy: 2600,
  insurance: 1900,
  maintenance: 1200,
  registration: 300,
  businessSharePct: 65,
};
const MI = compareMileage(MI_DEFAULT, 24, true);
/** The neutral mileage: closed form + the engine's whole-mile scan. */
const MI_NEUTRAL = neutralMileage(MI_DEFAULT);
/** Decision-boundary scans — the same calls the mileage tool page runs. */
const MI_SCANS = boundaryScans(MI_DEFAULT);
/** Exact annual-cost tie on the default profile (standard ÷ share). */
const MI_COST_TIE = MI.standard.deduction / (MI_DEFAULT.businessSharePct / 100);
/** The $0.50 winner tolerance in cost dollars at the 65% share. */
const MI_TOLERANCE_IN_COST = 0.5 / (MI_DEFAULT.businessSharePct / 100);
/** Exact share tie at the default miles and cost (standard ÷ total cost). */
const MI_SHARE_TIE_PCT = (MI.standard.deduction / MI.actual.breakdown.totalCost) * 100;

// ===== The standard rate across years, priced on the default 9,000 miles =====
const MRC = MILEAGE_CONSTANTS_2025;
/** The flat actual-side deduction of the default profile — every rate is compared to it. */
const MI_ACTUAL_FLAT = MI.actual.deduction; // $6,240
const RATE_ROWS = [
  { label: '2024', rate: MRC.standardRate2024PerMile, source: 'IR-2023-239' },
  { label: '2025', rate: MRC.standardRatePerMile, source: 'Notice 2025-5' },
  { label: '2026 H1', rate: MRC.standardRate2026H1PerMile, source: 'IR-2025-128' },
  { label: '2026 H2', rate: MRC.standardRate2026H2PerMile, source: 'IRB 2026-29' },
] as const;
/** Rate drift 2024 → 2025 at the default mileage, in deduction dollars. */
const RATE_DRIFT_24_25 = MI_DEFAULT.businessMiles * (MRC.standardRatePerMile - MRC.standardRate2024PerMile);
/** Basis a standard-rate year quietly books: 33¢ × every business mile (2025). */
const MI_BASIS_REDUCTION =
  MI_DEFAULT.businessMiles * MRC.depreciationComponentPerMile; // $2,970

// ===== Vehicle — the EV preset: expensive car, few miles, actual wins =====
const MI_EV: MileageInputs = {
  businessMiles: 4500,
  depreciation: 8400,
  fuelEnergy: 700,
  insurance: 2600,
  maintenance: 400,
  registration: 600,
  businessSharePct: 40,
};
const EV = compareMileage(MI_EV, 24, true);
const EV_NEUTRAL = neutralMileage(MI_EV);

export default function DeductionsHomeOfficeAndVehicleGuide() {
  const toc = [
    { id: 'verdict', label: 'The two decisions, up front' },
    { id: 'home-gate', label: 'Home office: the gate is the room' },
    { id: 'home-math', label: 'Simplified vs actual: the $5 line' },
    { id: 'home-across', label: 'Two homes, two years' },
    { id: 'vehicle-miles', label: 'What counts as a business mile' },
    { id: 'vehicle-rate', label: 'The 70¢ rate is a moving target' },
    { id: 'vehicle-neutral', label: 'The neutral mileage' },
    { id: 'records', label: 'Records decide audits' },
    { id: 'playbook', label: 'The playbook, in order' },
    { id: 'boundaries-of-the-model', label: 'Where the math stops' },
  ];

  return (
    <>
      <ArticleToc items={toc} />

      {/* ===== Decision card — the whole guide in two rules =====
          Plain p/div, not h2/h3: .prose-article's tag selectors would outrank
          the utilities used here, so the card carries its own type scale. */}
      <div className="mb-4 mt-8 rounded-2xl border border-indigo-100 bg-indigo-50/70 p-6 dark:border-indigo-500/20 dark:bg-indigo-500/10">
        <div className="text-lg font-bold text-slate-900 dark:text-slate-100">
          Two deductions, one decision shape
        </div>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-indigo-700 dark:text-indigo-300">
              Home office
            </div>
            <p className="mt-1.5 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
              Qualification first — a room used <strong>regularly and exclusively</strong> for
              business. Then one ratio decides the method:{' '}
              <strong>annual home running cost per sq ft vs {usd(5, 0)}</strong>. Above the line,
              actual expenses win; below it, the simplified {usd(5, 0)}-per-sq-ft shortcut wins.
            </p>
          </div>
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-indigo-700 dark:text-indigo-300">
              Vehicle
            </div>
            <p className="mt-1.5 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
              Classify the miles first — the commute is never deductible. Then one ratio decides
              the method:{' '}
              <strong>
                actual cost per business mile vs the standard rate (
                {usd(MRC.standardRatePerMile, 2)} in 2025)
              </strong>
              . Few business miles favor the ledger; many favor the rate.
            </p>
          </div>
        </div>
        <p className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
          Close cases are decided by a third factor no engine prices: the records you can actually
          produce. Both instruments — the{' '}
          <a href="/home-office-deduction-calculator/">Home Office Deduction Calculator</a> and the{' '}
          <a href="/mileage-deduction-calculator/">Mileage Deduction Calculator</a> — run the
          arithmetic below on your own numbers.
        </p>
      </div>

      <h2 id="verdict">The two decisions, up front</h2>
      <p>
        The home office deduction and the business-vehicle deduction are the two claims
        self-employed filers most often get wrong, and they fail in the same two places: the
        qualification (a legal test, not an arithmetic one) and the record (a habit, not a form).
        The method choice — simplified versus actual, standard rate versus actual expenses — is
        the part that computes cleanly, and it reduces to a single comparison in each case.
      </p>
      <p>
        For the home office, the comparison is <strong>cost per square foot</strong>. The
        simplified option pays a flat {usd(HOME_OFFICE_CONSTANTS.simplifiedRatePerSqFt, 0)} per
        square foot of office, capped at {HOME_OFFICE_CONSTANTS.simplifiedMaxSqFt} sq ft and{' '}
        {usd(HOME_OFFICE_CONSTANTS.simplifiedMaxDeduction, 0)}/yr (Rev. Proc. 2013-13, unchanged
        for 2025). The actual method pays your business share — office area ÷ home area — of
        everything the home costs to run. Within the cap, both methods price the same square
        footage, so one number settles the election: if running your home costs more than{' '}
        {usd(HOME_OFFICE_CONSTANTS.simplifiedRatePerSqFt, 0)}/sq ft per year, the actual method
        deducts more at <em>every</em> office size up to {HOME_OFFICE_CONSTANTS.simplifiedMaxSqFt}{' '}
        sq ft.
      </p>
      <p>
        For the vehicle, the comparison is <strong>cost per business mile</strong>. The standard
        rate pays {usd(MRC.standardRatePerMile, 2)} per qualifying mile in 2025 (IRS Notice
        2025-5); the actual method pays your business-use share of the year&apos;s operating
        costs. The standard side scales with driving, the actual side with spending — so the
        decision hinges on where your two lines cross, and that crossing point moves every year
        the IRS re-sets the rate.
      </p>
      <p>
        This guide walks both decisions end to end: the qualification boundaries that decide
        whether the deductions exist at all, the selection math with its exact tie points, the
        year-over-year rules (switching, carryovers, recapture, rate drift), and the record
        discipline that survives an audit. Every number cited from here on is computed by the
        same engines the two calculators run — the figures below are the engines&apos; own
        outputs on the calculators&apos; default scenarios, not restatements.
      </p>

      <h2 id="home-gate">Home office: the gate is the room, not the math</h2>
      <p>
        No method choice can rescue a space that fails the qualification test, so it comes first.
        The space must be a <strong>specific, identifiable area</strong> used{' '}
        <strong>regularly and exclusively</strong> for business (§280A). Both words carry weight:
      </p>
      <ul>
        <li>
          <strong>Exclusive</strong> means the area does nothing else — not &ldquo;mostly
          business.&rdquo; A desk in a bedroom someone also sleeps in fails. A spare bedroom that
          is an office around the clock passes. The spare bed that is &ldquo;basically never
          used&rdquo; still breaks exclusivity; if it is used — even rarely — the test is gone.
          Exclusivity turns on <em>actual</em> use, not on whether the space could serve a
          personal purpose.
        </li>
        <li>
          <strong>Regular</strong> means a pattern of ongoing use, not the occasional weekend.
          There is no minimum-hours threshold; consistency is the test.
        </li>
      </ul>
      <p>
        Exclusivity and regularity are necessary but not sufficient. The space must also carry a
        qualifying business connection: it is your <strong>principal place of business</strong> —
        which since 1999 explicitly includes a home office used for the{' '}
        <em>administrative and management</em> side of the work (invoicing, scheduling,
        bookkeeping) when no other fixed location handles that work — <em>or</em> you meet clients
        or customers there, <em>or</em> it is a separate structure (a studio, a converted garage)
        used exclusively for the business. Three boundaries finish the gate: W-2 employees cannot
        claim a home office at all for 2025 (the TCJA suspension of unreimbursed employee
        expenses — since made permanent by the One Big Beautiful Bill Act of 2025, P.L. 119-21 —
        keeps this a Schedule C tool); licensed daycare operators
        get a partial exception to exclusivity through a time-percentage formula; and S-corp
        owner-employees usually route the claim through an accountable-plan reimbursement instead
        (see the <a href="/s-corp-tax-calculator/">S-Corp Tax Calculator</a> for that plumbing).
      </p>
      <p>
        The decision framing: walk into the room with a tape measure, not a spreadsheet. If the
        room fails, stop — the simplified option&apos;s {usd(HOME_OFFICE_CONSTANTS.simplifiedMaxDeduction, 0)}{' '}
        shortcut changes the arithmetic, never the qualification. If it passes, measure both the
        office and the home&apos;s finished area: the ratio you write down is the single fraction
        the entire actual method hangs on.
      </p>

      <h2 id="home-math">Simplified vs actual: the $5 line, priced exactly</h2>
      <p>
        On the calculator&apos;s default scenario — a {numFmt(HO_DEFAULT.homeSqFt)} sq ft rental
        apartment, a {numFmt(HO_DEFAULT.officeSqFt)} sq ft spare bedroom (
        {pct(HO_SHARE * 100, 1)} of the home), {usd(HO_DEFAULT.rent, 0)}/yr rent plus{' '}
        {usd(HO_OPERATING, 0)} of utilities, insurance and repairs — the engine (lib/homeoffice.ts)
        books the actual method at {usd(HO.actual.deduction, 0)} against the simplified
        option&apos;s {usd(HO.simplified.deduction, 0)}: actual wins by{' '}
        {usd(HO.deductionDelta, 0)} of deduction, worth {usd(HO.savingDelta, 0)}/yr of tax at a
        24% bracket with the self-employment layer on ({usd(HO.actual.saving.total, 0)} versus{' '}
        {usd(HO.simplified.saving.total, 0)}). The home runs at{' '}
        {usd(HO.actual.breakdown.costPerSqFt, 2)}/sq ft — nearly three times the simplified
        rate — which is the typical shape for renters in expensive cities.
      </p>
      <p>
        Where exactly would the methods tie on this profile? The engine derives the tie line
        directly: both methods tie when the home&apos;s annual running cost equals{' '}
        {usd(HOME_OFFICE_CONSTANTS.simplifiedRatePerSqFt, 0)} × home area —{' '}
        {usd(HO.actual.breakdown.breakevenAnnualHomeCost, 0)}/yr for a{' '}
        {numFmt(HO_DEFAULT.homeSqFt)} sq ft home. Subtract the {usd(HO_OPERATING, 0)} of operating
        costs and the rent tie lands at <strong>{usd(HO_RENT_TIE, 0)}/yr — about{' '}
        {usd(HO_RENT_TIE / 12, 0)}/month</strong>. Pay less rent than that (with these operating
        costs, at this office share) and the simplified option deducts more; pay more and the
        actual method does.
      </p>
      <p>
        Two refinements make the tie line honest rather than merely neat. First, the comparison
        engine grants a {usd(0.5)} tolerance on the deduction before it declares a winner — a
        float-noise guard, but at the {pct(HO_SHARE * 100, 1)} business share it translates to{' '}
        <strong>{usd(HO_TOLERANCE_IN_RENT, 2)} of annual rent</strong>: rent must exceed{' '}
        {usd(HO_STRICT_LEAD_RENT, 2)} before the actual method strictly leads, and the first whole
        dollar that flips the engine&apos;s winner is{' '}
        {HO_RENT_FLIP !== null ? usd(HO_RENT_FLIP, 0) : '—'}. The practical reading is simpler:
        within roughly five dollars of rent a year, the methods are a tie — and a tie should be
        resolved toward the simplified option, which files in one line and keeps the audit
        surface small. Second, the tie line moves with your operating costs and your home size,
        not just rent: re-run the comparison whenever any of the three changes, or when you move.
      </p>
      <p>
        Below the {usd(5, 0)} line, simplified wins everywhere the cap allows — but not forever.
        On the calculator&apos;s low-cost preset (a {numFmt(HO_LOW.homeSqFt)} sq ft rental home at{' '}
        {usd(HO_LOW.rent, 0)}/yr plus {usd(HO_LOW.utilities + HO_LOW.insurance + HO_LOW.repairs, 0)}{' '}
        of operating costs — {usd(LOW.actual.breakdown.costPerSqFt, 2)}/sq ft), a{' '}
        {numFmt(HO_LOW.officeSqFt)} sq ft office deducts {usd(LOW.simplified.deduction, 0)}{' '}
        simplified versus {usd(LOW.actual.deduction, 0)} actual. But the simplified option is
        pinned flat at {usd(HOME_OFFICE_CONSTANTS.simplifiedMaxDeduction, 0)} past{' '}
        {HOME_OFFICE_CONSTANTS.simplifiedMaxSqFt} sq ft while the actual method keeps scaling
        with area — so the actual method retakes the lead at the crossover{' '}
        {usd(HOME_OFFICE_CONSTANTS.simplifiedMaxDeduction, 0)} ÷ cost per sq ft ={' '}
        {numFmt(LOW.crossoverSqFt ?? 0, 0)} sq ft (closed form), with the engine&apos;s 1-sq-ft
        scan flipping at {HO_OFFICE_FLIP !== null ? numFmt(HO_OFFICE_FLIP) : '—'} sq ft. A cheap
        home with a genuinely large office is actual-method territory.
      </p>
      <table>
        <thead>
          <tr>
            <th>Profile (engine defaults)</th>
            <th>Cost / sq ft</th>
            <th>Simplified</th>
            <th>Actual</th>
            <th>Engine winner</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>City renter — 200 sq ft office in 1,800 sq ft</td>
            <td>{usd(HO.actual.breakdown.costPerSqFt, 2)}</td>
            <td>{usd(HO.simplified.deduction, 0)}</td>
            <td>{usd(HO.actual.deduction, 0)}</td>
            <td>
              <strong>Actual</strong> by {usd(HO.deductionDelta, 0)}
            </td>
          </tr>
          <tr>
            <td>Low-cost area — 150 sq ft office in 3,000 sq ft</td>
            <td>{usd(LOW.actual.breakdown.costPerSqFt, 2)}</td>
            <td>{usd(LOW.simplified.deduction, 0)}</td>
            <td>{usd(LOW.actual.deduction, 0)}</td>
            <td>
              <strong>Simplified</strong> by {usd(Math.abs(LOW.deductionDelta), 0)}; crossover{' '}
              {numFmt(LOW.crossoverSqFt ?? 0, 0)} sq ft
            </td>
          </tr>
          <tr>
            <td>Tie line, any home</td>
            <td>{usd(5, 0)}</td>
            <td colSpan={2}>
              Methods tie at {usd(5, 0)} × home sq ft of running cost — on the city profile, rent
              of {usd(HO_RENT_TIE, 0)}/yr
            </td>
            <td>Tie</td>
          </tr>
        </tbody>
      </table>
      <p>
        One layer of the payoff deserves its own sentence: on Schedule C, the deduction cuts
        self-employment tax as well as income tax. The engine prices every{' '}
        {usd(1000, 0)} of deduction at a 24% bracket as {usd(PER_K.seTax, 0)} of SE tax (
        {pct(SE_LAYER_PCT, 2)} per dollar) plus {usd(PER_K.incomeTax, 0)} of income tax after a{' '}
        {usd(PER_K.halfSeClawback, 0)} clawback from the smaller half-of-SE-tax deduction —{' '}
        {usd(PER_K.total, 0)} total. That layering is why a deduction {usd(HO.deductionDelta, 0)}{' '}
        larger is worth {usd(HO.savingDelta, 0)}/yr, not {usd(HO.deductionDelta * 0.24, 0)}.
      </p>

      <h2 id="home-across">Two homes, two years: switching, carryovers, recapture</h2>
      <p>
        The method election is <strong>annual and per-home</strong>: exactly one method per tax
        year, freely switchable from year to year, made on a timely-filed original return and
        locked once made. Different homes may use different methods in the same year, but the
        simplified option can apply to only one home per year (IRS simplified-method FAQs).
        Three cross-year mechanics decide whether switching is actually free:
      </p>
      <ul>
        <li>
          <strong>Carryovers punish the simplified year.</strong> Under the actual method,
          operating expenses and depreciation clipped by the gross-income limit carry forward to
          profitable years — but they cannot be claimed in a year you elect the simplified
          option, and amounts clipped under the simplified option are gone for good. If you are
          sitting on disallowed carryovers, a simplified year is a year they sit still.
        </li>
        <li>
          <strong>Recapture punishes actual-method owners.</strong> Depreciation on the business
          share — <em>allowed or allowable</em>, whether or not you claimed it — is recaptured
          when the home sells, as unrecaptured §1250 gain taxed at up to 25%. Simplified years
          claim no depreciation and stop that clock. Owners near a sale often elect simplified
          for exactly this reason, even when actual deducts more.
        </li>
        <li>
          <strong>A new home resets everything.</strong> Moving means a new business share, and
          for actual-method owners a fresh depreciable basis and placed-in-service date. Both
          methods prorate by the months of qualified use in a part-year home. Re-measure; never
          carry the old percentage into the new floor plan.
        </li>
      </ul>

      <h2 id="vehicle-miles">Vehicle: first decide what a business mile is</h2>
      <p>
        The vehicle decision has the same shape as the home office&apos;s — classify first,
        compute second — and the classification rule is short and unforgiving:{' '}
        <strong>commuting is never deductible</strong>. Daily travel between your home and a
        regular place of work is personal use under both methods, in both directions, every day
        (Pub 463). The &ldquo;business miles&rdquo; you enter in any mileage tool are the count
        after these trips are excluded.
      </p>
      <p>
        The exceptions list is where the money hides, and one entry connects this guide&apos;s two
        halves:
      </p>
      <ol>
        <li>
          <strong>Between two business locations.</strong> Office to client, client to supplier,
          first job site to second — deductible in full for the distance driven, and a personal
          errand along the way does not poison the trip (the extra miles it adds are personal).
        </li>
        <li>
          <strong>The home-office hinge.</strong> If a home office is your{' '}
          <em>principal place of business</em>, the commute has already ended at the office:
          trips from home to other work locations — clients, sites, suppliers — are{' '}
          <strong>business miles</strong>. Qualify the room under the rules above and the same
          door the home office deduction prices also converts thousands of formerly personal
          miles into {usd(MRC.standardRatePerMile, 2)} each. This is the single largest
          interaction between the two instruments, and it runs in one direction: the vehicle
          benefit follows the home-office qualification, never the reverse.
        </li>
        <li>
          <strong>Business errands.</strong> Post office, bank, the hardware store for supplies —
          business miles when the purpose is business. The IRS asks for an honest record of where
          business driving started and stopped each day, not perfect routing.
        </li>
      </ol>
      <p>
        One item sits outside both methods entirely: parking and tolls are 100% deductible in
        full whichever method you choose — they are not in the standard rate and are not prorated
        by the business share. Keep those receipts separately.
      </p>

      <h2 id="vehicle-rate">The 70¢ rate is a moving target</h2>
      <p>
        The standard mileage rate is set by IRS notice, annually — and lately, more than
        annually. The engine&apos;s own rate constants price the drift on the default profile
        (9,000 qualifying business miles; the flat actual-side deduction is{' '}
        {usd(MI_ACTUAL_FLAT, 0)} = 65% × {usd(MI.actual.breakdown.totalCost, 0)} of operating
        cost):
      </p>
      <table>
        <thead>
          <tr>
            <th>Year</th>
            <th>Rate / mile</th>
            <th>Deduction @ 9,000 mi</th>
            <th>vs actual {usd(MI_ACTUAL_FLAT, 0)}</th>
            <th>Source</th>
          </tr>
        </thead>
        <tbody>
          {RATE_ROWS.map((r) => {
            const ded = MI_DEFAULT.businessMiles * r.rate;
            return (
              <tr key={r.label}>
                <td>{r.label}</td>
                <td>{usd(r.rate, 3)}</td>
                <td>{usd(ded, 0)}</td>
                <td>
                  {ded > MI_ACTUAL_FLAT + 0.5 ? (
                    <strong>standard leads by {usd(ded - MI_ACTUAL_FLAT, 0)}</strong>
                  ) : ded < MI_ACTUAL_FLAT - 0.5 ? (
                    <span>
                      actual leads by {usd(MI_ACTUAL_FLAT - ded, 0)}
                    </span>
                  ) : (
                    <span>tie</span>
                  )}
                </td>
                <td>{r.source}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p>
        Read the middle column as the annual adjustment in action: the same 9,000 miles paid{' '}
        {usd(MI_DEFAULT.businessMiles * MRC.standardRate2024PerMile, 0)} in 2024 and{' '}
        {usd(MI_DEFAULT.businessMiles * MRC.standardRatePerMile, 0)} in 2025 — a{' '}
        {usd(RATE_DRIFT_24_25, 0)} raise the driving did nothing to earn — and the 2026 rate
        rose twice, to {usd(MRC.standardRate2026H1PerMile, 2)} in the first half and{' '}
        {usd(MRC.standardRate2026H2PerMile, 2)} in the second. In cents: one hundred business
        miles were worth {usd(100 * MRC.standardRate2024PerMile, 0)} in 2024,{' '}
        {usd(100 * MRC.standardRatePerMile, 0)} in 2025, and{' '}
        {usd(100 * MRC.standardRate2026H2PerMile, 0)} at the 2026 second-half rate.
      </p>
      <p>
        What the rate bundles matters as much as its level: of the 2025 rate,{' '}
        {usd(MRC.depreciationComponentPerMile, 2)}/mile is depreciation (Notice 2025-5). A
        standard-rate year therefore books {usd(MI_BASIS_REDUCTION, 0)} of basis reduction at
        9,000 miles — and permits no separate MACRS, §179, or bonus depreciation on the same
        vehicle. The eligibility fences follow from that bundle: claim §179 or accelerated
        depreciation on the vehicle <em>ever</em> and the standard rate is off the table
        permanently; operate five or more vehicles at once and it is unavailable; use it on a
        lease and you must use it for the whole lease term. The strategic rule:{' '}
        <strong>using the standard rate in the vehicle&apos;s first year preserves the right to
        switch to actual later</strong> (straight-line depreciation only) — the reverse switch is
        what the fences block.
      </p>

      <h2 id="vehicle-neutral">The neutral mileage — where the methods tie</h2>
      <p>
        The two method curves have different shapes: the standard deduction is a straight line —{' '}
        {usd(MRC.standardRatePerMile, 2)} × miles — while the actual deduction is flat, your
        business share of the year&apos;s costs, indifferent to mileage. Exactly one crossing
        exists, and the engine returns it two ways: the closed form{' '}
        <code>share × total cost ÷ rate</code>, and a 1-mile scan that reports the first whole
        mile at which the engine&apos;s winner (with its {usd(0.5)} tolerance) flips to standard.
      </p>
      <p>
        On the default profile the answer is sharp: {pct(MI_DEFAULT.businessSharePct, 0)} ×{' '}
        {usd(MI.actual.breakdown.totalCost, 0)} = {usd(MI_ACTUAL_FLAT, 0)} flat, against{' '}
        {usd(MRC.standardRatePerMile, 2)} × m. The methods tie at{' '}
        <strong>{numFmt(MI_NEUTRAL.exactMiles ?? 0, 0)} miles</strong> (closed form), with the
        engine flip at <strong>{numFmt(MI_SCANS.mileageFlip ?? 0)} miles</strong> — the 1.7-mile
        gap is the {usd(0.5)} tolerance (about {usd(0.5 / MRC.standardRatePerMile, 2).replace('$', '')} of
        a mile) plus whole-mile rounding. At the profile&apos;s own 9,000 business miles the
        standard rate leads by a near-tie{' '}
        {usd(Math.abs(MI.deductionDelta), 0)} ({usd(MI.standard.deduction, 0)} vs{' '}
        {usd(MI.actual.deduction, 0)}); the actual side&apos;s effective rate is{' '}
        {usd(MI.actual.breakdown.effectiveRatePerMile ?? 0, 3)}/mile against the standard{' '}
        {usd(MRC.standardRatePerMile, 2)}. A $60 gap on a six-thousand-dollar deduction is a
        coin flip — and the tie-breaker should be the log you keep, not the last dime.
      </p>
      <p>
        The neutral point also moves with the rate — on the same car, same costs, same share:
      </p>
      <table>
        <thead>
          <tr>
            <th>Rate scenario</th>
            <th>Neutral mileage vs {usd(MI_ACTUAL_FLAT, 0)} actual</th>
            <th>Winner at 9,000 business miles</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>2024 — {usd(MRC.standardRate2024PerMile, 2)}/mi</td>
            <td>{numFmt(MI_ACTUAL_FLAT / MRC.standardRate2024PerMile, 0)} mi</td>
            <td>
              <strong>Actual</strong> by {usd(MI_ACTUAL_FLAT - MI_DEFAULT.businessMiles * MRC.standardRate2024PerMile, 0)}
            </td>
          </tr>
          <tr>
            <td>2025 — {usd(MRC.standardRatePerMile, 2)}/mi</td>
            <td>{numFmt(MI_NEUTRAL.exactMiles ?? 0, 0)} mi</td>
            <td>
              <strong>Standard</strong> by {usd(MI.deductionDelta === 0 ? 0 : Math.abs(MI.deductionDelta), 0)}
            </td>
          </tr>
          <tr>
            <td>2026 H2 — {usd(MRC.standardRate2026H2PerMile, 2)}/mi</td>
            <td>{numFmt(MI_ACTUAL_FLAT / MRC.standardRate2026H2PerMile, 0)} mi</td>
            <td>
              <strong>Standard</strong> by {usd(MI_DEFAULT.businessMiles * MRC.standardRate2026H2PerMile - MI_ACTUAL_FLAT, 0)}
            </td>
          </tr>
        </tbody>
      </table>
      <p>
        That table is the &ldquo;annual adjustment&rdquo; made concrete: the identical vehicle
        profile was an actual-method case in 2024, is a marginal standard-rate case in 2025, and
        stretches further toward standard at the 2026 rates. A method chosen once and never
        revisited is a method chosen by inertia — re-run the comparison each December when the
        new rate is announced.
      </p>
      <p>
        The other boundaries flip the same engine. Annual vehicle cost: the exact tie is{' '}
        {usd(MI_COST_TIE, 2)} ({usd(MI.standard.deduction, 0)} ÷ 0.65), the {usd(0.5)} tolerance
        is {usd(MI_TOLERANCE_IN_COST, 2)} of cost at this share, and the $1 scan flips to actual
        at {usd(MI_SCANS.costFlip ?? 0, 0)} — a {usd(MI.actual.breakdown.totalCost, 0)}-cost car
        is barely $92 from the line. Business share: the closed form puts the tie at{' '}
        {pct(MI_SHARE_TIE_PCT, 2)} and the whole-percent scan flips at{' '}
        {MI_SCANS.shareFlip !== null ? pct(MI_SCANS.shareFlip, 0) : '—'}. And for contrast, the
        expensive-car regime: the calculator&apos;s EV preset runs{' '}
        {usd(EV.actual.breakdown.totalCost, 0)}/yr of costs at a{' '}
        {pct(MI_EV.businessSharePct, 0)} share — {usd(EV.actual.deduction, 0)} actual against{' '}
        {usd(EV.standard.deduction, 0)} standard at its {numFmt(MI_EV.businessMiles)} business
        miles, an actual-method win of {usd(EV.deductionDelta, 0)} ({usd(EV.actual.breakdown.effectiveRatePerMile ?? 0, 3)}/business-mile
        against the {usd(MRC.standardRatePerMile, 2)} rate). Its neutral mileage is{' '}
        {numFmt(EV_NEUTRAL.exactMiles ?? 0, 0)} miles — far above the 4,500 it actually drives:
        when the car is expensive and the driving is light, the ledger beats the rate at any
        mileage the car will ever see.
      </p>

      <h2 id="records">Records decide audits — for both deductions</h2>
      <p>
        What gets examined in an audit is not the method arithmetic, which the forms check
        mechanically. It is the qualification and the log — the two things only your records can
        prove. The discipline is cheap and non-negotiable:
      </p>
      <ul>
        <li>
          <strong>Mileage: contemporaneous or not at all.</strong> A log made at the time of
          driving — app, notebook, spreadsheet — recording date, destination, business purpose,
          and miles for each trip, plus the odometer at year start and end. Reconstructed logs
          compiled after an IRS notice routinely lose. Every business mile is worth{' '}
          {usd(MRC.standardRatePerMile, 2)} in 2025; a year of unlogged driving is a year of
          unprovable deduction.
        </li>
        <li>
          <strong>Home office: photograph and measure.</strong> An annual photo of the space
          showing the desk and equipment and nothing personal in frame; a floor plan with both
          measurements and a note on how the percentage was computed; the year&apos;s bills
          (rent, utilities, insurance, repairs) kept with the return.
        </li>
        <li>
          <strong>Be plausible and consistent.</strong> A 300 sq ft &ldquo;office&rdquo; in a 600
          sq ft apartment, a business share that jumps without a physical change, or a mileage
          log that survives the commute only in one direction — these are the patterns that
          convert a routine claim into an examination. The simplified option is not an audit
          shield: the exclusivity test applies identically to both methods.
        </li>
      </ul>
      <blockquote>
        <p>
          The method you can substantiate beats the method that computes larger. A deduction
          disallowed for want of a log is worth exactly zero, whatever the engine said.
        </p>
      </blockquote>

      <h2 id="playbook">The playbook, in order</h2>
      <ol>
        <li>
          <strong>Qualify the room.</strong> One space, regular and exclusive use, principal-place
          or client-meeting or separate-structure connection. If it fails, neither method exists —
          stop here.
        </li>
        <li>
          <strong>Measure.</strong> Office square footage and finished home area. That ratio, and
          your annual home running cost, are the only inputs the method choice needs.
        </li>
        <li>
          <strong>Compute cost per square foot and compare to {usd(5, 0)}.</strong> Above{' '}
          {usd(5, 0)}, the actual method (Form 8829) deducts more at any office up to{' '}
          {HOME_OFFICE_CONSTANTS.simplifiedMaxSqFt} sq ft; below it, the simplified option wins
          until the office outgrows{' '}
          {usd(HOME_OFFICE_CONSTANTS.simplifiedMaxDeduction, 0)} ÷ cost-per-sq-ft. Near the line
          (recall the {usd(HO_RENT_TIE, 0)} rent tie and its {usd(HO_TOLERANCE_IN_RENT, 2)}{' '}
          tolerance band on the default profile), take the simpler method.
        </li>
        <li>
          <strong>Classify the miles before counting them.</strong> Commute out; between-location
          and business-errand miles in; home-to-client miles in only if the home office qualifies
          as your principal place — step 1 again, now worth {usd(MRC.standardRatePerMile, 2)}/mile.
        </li>
        <li>
          <strong>Compare cost per business mile to the current rate.</strong> Flat actual
          deduction ÷ business miles against {usd(MRC.standardRatePerMile, 2)} (2025); the neutral
          mileage — share × cost ÷ rate — tells you which side of the line your odometer is on.
          Re-run it every December when the new rate lands.
        </li>
        <li>
          <strong>Mind the one-way doors.</strong> First-year standard mileage preserves the later
          switch; §179 or accelerated depreciation burns the standard rate forever; actual-method
          depreciation recaptures at sale at up to 25%; simplified years stop that clock.
        </li>
        <li>
          <strong>Keep the records the method demands.</strong> The log, the photos, the floor
          plan, the bills — filed with each year&apos;s return. Then make the election, take the
          deduction, and revisit both decisions when the facts move: new home, new car, new rate.
        </li>
      </ol>
      <p>
        The instruments carry the arithmetic at every step — the{' '}
        <a href="/home-office-deduction-calculator/">home office comparison</a> and the{' '}
        <a href="/mileage-deduction-calculator/">vehicle comparison</a> with its neutral-mileage
        scan. For what these deductions feed — quarterly installments and the year-end close —
        see the <a href="/guides/self-employed-tax-calendar/">tax calendar guide</a> and the{' '}
        <a href="/guides/year-end-tax-checklist/">year-end checklist guide</a>.
      </p>

      <h2 id="boundaries-of-the-model">Where this playbook&apos;s math stops</h2>
      <p>
        The engines behind these figures are deliberately scoped: the home-office model does not
        apply the gross-income limitation (both methods stop at business gross income minus other
        expenses, and simplified loses the excess permanently), and neither engine models state
        taxes, the §199A/QBI interaction (each $1 of deduction trims the QBI deduction itself by
        up to 20¢ for filers below the phase-out), the §280F luxury-automobile depreciation caps,
        or vehicle-loan interest. Where those matter, the numbers above are pre-limit figures —
        treat them as the ceiling, not the floor. This is an illustrative federal model for tax
        year 2025, not tax advice; confirm method eligibility and your state&apos;s conformity
        with a qualified professional before filing.
      </p>
    </>
  );
}

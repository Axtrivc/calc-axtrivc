import Faq from '@/components/Faq';
import { ArticleToc, RelatedCalculators } from '@/components/Article';
import {
  compareHomeOffice,
  HOME_OFFICE_CONSTANTS,
  marginalSaving,
  type HomeOfficeInputs,
} from '@/lib/homeoffice';
import { numFmt, pct, usd } from '@/lib/format';

/** The tool's default scenario, computed from the same lib the widget uses. */
const EXAMPLE: HomeOfficeInputs = {
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
const EX = compareHomeOffice(EXAMPLE, 24, true);

const depRatePct = (HOME_OFFICE_CONSTANTS.depreciationAnnualRate * 100).toFixed(4);

/** Worked example B — the calculator's "Suburban homeowner" preset, verbatim. */
const OWNER_EXAMPLE: HomeOfficeInputs = {
  homeSqFt: 2400,
  officeSqFt: 240,
  tenure: 'own',
  rent: 0,
  mortgageInterest: 16800,
  propertyTax: 6200,
  homeBasis: 420000,
  utilities: 3600,
  insurance: 1500,
  repairs: 1000,
};
const EXO = compareHomeOffice(OWNER_EXAMPLE, 24, true);
const OBO = EXO.actual.breakdown;
/** 39 years of the office-share depreciation slice, and its §1250 recapture at 25%. */
const OWNER_DEP_LIFE = OBO.deductibleDepreciation * HOME_OFFICE_CONSTANTS.depreciationLifeYears;
const OWNER_RECAPTURE = OWNER_DEP_LIFE * 0.25;
/** Tax value of the depreciation line alone — non-cash now, recaptured later. */
const DEP_SAVING = marginalSaving(OBO.deductibleDepreciation, 24, true).total;
/** The genuinely new money: actual deduction minus the Schedule A transfer slice. */
const OWNER_NEW_MONEY = EXO.actual.deduction - OBO.scheduleATransfer;

/** Worked example C — the calculator's "Low-cost area" preset, verbatim. */
const LOW_EXAMPLE: HomeOfficeInputs = {
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
const EXL = compareHomeOffice(LOW_EXAMPLE, 24, true);

/** Compact-apartment preset (FAQ scenario) and a 60-sq-ft nook on the default profile. */
const COMPACT_EXAMPLE: HomeOfficeInputs = {
  homeSqFt: 750,
  officeSqFt: 90,
  tenure: 'rent',
  rent: 19200,
  mortgageInterest: 0,
  propertyTax: 0,
  homeBasis: 0,
  utilities: 1800,
  insurance: 400,
  repairs: 300,
};
const EXC = compareHomeOffice(COMPACT_EXAMPLE, 24, true);
const NOOK = compareHomeOffice({ ...EXAMPLE, officeSqFt: 60 }, 24, true);
/** The default example at a 32% bracket, for the "does my bracket pick the method?" FAQ. */
const EX32 = compareHomeOffice(EXAMPLE, 32, true);

/** What $1,000 of deduction is worth at 24%, with and without the SE-tax layer. */
const PER_K = marginalSaving(1000, 24, true);
const PER_K_NO_SE = marginalSaving(1000, 24, false);
/** 0.9235 × 15.3% — the SE-tax slice of every Schedule C dollar deducted. */
const SE_LAYER_PCT = HOME_OFFICE_CONSTANTS.seBaseFactor * HOME_OFFICE_CONSTANTS.seRate * 100;
/** Exact rent tie on the default profile: $5 × 1,800 sq ft minus the $3,800 of operating costs. */
const RENT_TIE_EXACT =
  EX.actual.breakdown.breakevenAnnualHomeCost -
  (EXAMPLE.utilities + EXAMPLE.insurance + EXAMPLE.repairs);
/** The engine's $0.50 winner tolerance expressed in rent terms at the 1/9 default share. */
const TOLERANCE_IN_RENT = 0.5 / (EXAMPLE.officeSqFt / EXAMPLE.homeSqFt);
/** Rent above which the actual method strictly leads: the exact tie plus the tolerance in rent. */
const STRICT_LEAD_RENT = RENT_TIE_EXACT + TOLERANCE_IN_RENT;

/**
 * Flip points from scanning this page's engine (lib/homeoffice.ts, compiled and
 * run offline): (a) annual rent swept in $1 steps on the default profile with
 * the office fixed at 200 sq ft; (b) office area swept in 1-sq-ft steps on the
 * low-cost profile's costs. Each value is the FIRST input at which the engine's
 * winner — which carries a built-in $0.50 tie tolerance — flips. Method
 * documented in "Decision boundaries" below; closed forms cross-check both.
 */
const SCAN = {
  rentFlip: 5205,
  officeFlip: 382,
} as const;

export default function HomeOfficeArticle() {
  const toc = [
    { id: 'qualification', label: 'Regular & exclusive use — the gate' },
    { id: 'methods', label: 'The two methods, exactly' },
    { id: 'worked-example', label: 'Worked example' },
    { id: 'worked-example-owner', label: 'A second example — the homeowner' },
    { id: 'worked-example-lowcost', label: 'A third example — simplified wins' },
    { id: 'choosing', label: 'Which method wins, and when' },
    { id: 'boundaries', label: 'Decision boundaries' },
    { id: 'switching', label: 'Switching, carryovers & recapture' },
    { id: 'audit', label: 'Audit reality & documentation' },
    { id: 'caveats', label: 'Important caveats' },
    { id: 'glossary', label: 'Glossary' },
    { id: 'faq', label: 'FAQ' },
  ];

  return (
    <article className="prose-article">
      <ArticleToc items={toc} />

      <h2 id="qualification">Regular &amp; exclusive use — the gate everything hangs on</h2>
      <p>
        The home office deduction has exactly one prerequisite, and it is not a dollar figure: a
        <strong> specific, identifiable area</strong> of your home used <strong>regularly and
        exclusively</strong> for business. Both words carry statutory weight (§280A):
      </p>
      <ul>
        <li>
          <strong>Exclusive</strong> means the space does nothing else. Not &ldquo;mostly business&rdquo;
          — <em>nothing else</em>. A desk in the corner of a bedroom that family members also sleep in
          fails. A spare bedroom that is an office 24/7 passes. The IRS does not care that the bed is
          &ldquo;basically never used&rdquo;; if it is there and could be used, exclusivity is gone.
        </li>
        <li>
          <strong>Regular</strong> means ongoing use, not the occasional weekend. There is no minimum
          hours threshold — a pattern of consistent use is what counts.
        </li>
      </ul>
      <p>
        Exclusive-and-regular is necessary but not sufficient. The space must also be{' '}
        <strong>your principal place of business</strong> — which since 1999 explicitly includes a home
        office you use for the <em>administrative and management</em> side of the business (invoicing,
        scheduling, bookkeeping) as long as you have no other fixed location where you do substantial
        administrative work. Alternatively the space qualifies if you use it to{' '}
        <strong>meet clients or customers</strong> in the normal course of business, or if it is a{' '}
        <strong>separate structure</strong> (a studio or converted garage) used exclusively for the
        business — separate structures do not need to be the principal place at all.
      </p>
      <p>
        Two boundaries worth knowing: <strong>W-2 employees cannot claim this deduction for
        2025</strong> — the TCJA suspension of unreimbursed employee expenses runs through the 2025 tax
        year, so this is a self-employed (Schedule C, and equivalent) tool only. And licensed{' '}
        <strong>daycare operators</strong> get a partial exception to exclusivity — hours of
        business use count even though the space is also the family living room, with a separate
        time-percentage formula.
      </p>

      <h2 id="methods">The two methods, exactly</h2>
      <p>
        Once the space qualifies, the IRS lets you price it one of two ways —{' '}
        <strong>but never both in the same year</strong>:
      </p>
      <ol>
        <li>
          <p>
            <strong>Simplified option</strong> (Rev. Proc. 2013-13, unchanged for 2025):{' '}
            <code>$5 × min(office sq ft, 300)</code>. That is it. The ceiling is{' '}
            {usd(HOME_OFFICE_CONSTANTS.simplifiedMaxDeduction, 0)}/yr no matter how big the office or
            how expensive the home. You keep no expense records, depreciate nothing, file no Form
            8829 — the amount goes straight on Schedule C, line 30.
          </p>
        </li>
        <li>
          <p>
            <strong>Actual method</strong> (Form 8829): your{' '}
            <strong>business share</strong> — office area ÷ home area — times the year&apos;s{' '}
            <strong>indirect home expenses</strong>: rent (renters), or mortgage interest + property
            taxes (owners), plus utilities, insurance, repairs and upkeep. Owners also depreciate the
            office share of the home&apos;s basis excluding land: straight-line over 39 years,{' '}
            <code>{depRatePct}%</code> per full year (first year slightly less, by month). Rent,
            utilities, insurance, repairs and depreciation clipped by the gross-income limit are{' '}
            <em>carried forward</em> to future years (Form 8829, Part IV) — but mortgage interest and
            property taxes are not: their limited slice flows back to Schedule A instead, where
            itemizers may still deduct it.
          </p>
        </li>
      </ol>
      <p>
        Both methods are subject to the same outer boundary: the deduction can never exceed{' '}
        <strong>business gross income minus your other business expenses</strong>. The deduction
        cannot manufacture a loss. Under the simplified option, whatever that limit clips off is
        simply <strong>lost</strong> — no carryover. This calculator does not model the limit (it has
        no business-income input); if your business barely breaks even, cap what you take.
      </p>

      <h2 id="worked-example">Worked example — the default scenario</h2>
      <p>
        A renter with a {numFmt(EXAMPLE.homeSqFt)} sq ft apartment, a{' '}
        {numFmt(EXAMPLE.officeSqFt)} sq ft spare bedroom used exclusively for the business
        ({pct((EXAMPLE.officeSqFt / EXAMPLE.homeSqFt) * 100, 1)} of the home), paying{' '}
        {usd(EXAMPLE.rent, 0)}/yr rent plus {usd(EXAMPLE.utilities + EXAMPLE.insurance + EXAMPLE.repairs, 0)}{' '}
        of utilities, insurance and repairs — sole proprietor, 24% federal bracket:
      </p>
      <table>
        <thead>
          <tr>
            <th>Line</th>
            <th>Simplified</th>
            <th>Actual</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Method formula</td>
            <td>$5 × {numFmt(EXAMPLE.officeSqFt)} sq ft</td>
            <td>{pct((EXAMPLE.officeSqFt / EXAMPLE.homeSqFt) * 100, 1)} × {usd(EXAMPLE.rent + EXAMPLE.utilities + EXAMPLE.insurance + EXAMPLE.repairs, 0)}</td>
          </tr>
          <tr>
            <td>Deduction per year</td>
            <td>{usd(EX.simplified.deduction, 0)}</td>
            <td>{usd(EX.actual.deduction, 0)}</td>
          </tr>
          <tr>
            <td>Federal income tax saved</td>
            <td>{usd(EX.simplified.saving.incomeTax, 0)}</td>
            <td>{usd(EX.actual.saving.incomeTax, 0)}</td>
          </tr>
          <tr>
            <td>SE tax saved (14.13% layer)</td>
            <td>{usd(EX.simplified.saving.seTax, 0)}</td>
            <td>{usd(EX.actual.saving.seTax, 0)}</td>
          </tr>
          <tr>
            <td><strong>Total tax saved</strong></td>
            <td><strong>{usd(EX.simplified.saving.total, 0)}</strong></td>
            <td><strong>{usd(EX.actual.saving.total, 0)}</strong></td>
          </tr>
        </tbody>
      </table>
      <p>
        The actual method deducts {usd(EX.deductionDelta, 0)} more and saves{' '}
        {usd(EX.savingDelta, 0)}/yr more tax — both figures recomputed by the exact functions the
        calculator above runs. That is the typical shape for renters in expensive cities: rent is such
        a large indirect expense that the business share of it dwarfs a flat {usd(5, 0)}/sq ft.
      </p>

      <h2 id="worked-example-owner">A second worked example — the suburban homeowner</h2>
      <p>
        The renter&apos;s story is the common one, but the owner&apos;s is where the mechanics earn
        their keep. A {numFmt(OWNER_EXAMPLE.homeSqFt)} sq ft house, a{' '}
        {numFmt(OWNER_EXAMPLE.officeSqFt)} sq ft office ({pct(OBO.share * 100, 0)} of the home),{' '}
        {usd(OWNER_EXAMPLE.mortgageInterest, 0)} of mortgage interest plus{' '}
        {usd(OWNER_EXAMPLE.propertyTax, 0)} of property tax,{' '}
        {usd(OWNER_EXAMPLE.utilities + OWNER_EXAMPLE.insurance + OWNER_EXAMPLE.repairs, 0)} of
        utilities, insurance and repairs, and a {usd(OWNER_EXAMPLE.homeBasis, 0)} depreciable
        basis — land always out, and per Pub 587 the lower of adjusted cost or the home&apos;s
        fair market value when business use began — same sole proprietor, same 24% bracket:
      </p>
      <table>
        <thead>
          <tr>
            <th>Actual-method line</th>
            <th>Whole-home cost</th>
            <th>Office share ({pct(OBO.share * 100, 0)})</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Housing: mortgage interest + property tax</td>
            <td>{usd(OBO.housingCost, 0)}</td>
            <td>{usd(OBO.deductibleHousing, 0)}</td>
          </tr>
          <tr>
            <td>Operating: utilities + insurance + repairs</td>
            <td>{usd(OBO.operatingCost, 0)}</td>
            <td>{usd(OBO.deductibleOperating, 0)}</td>
          </tr>
          <tr>
            <td>
              Depreciation: {usd(OWNER_EXAMPLE.homeBasis, 0)} × {depRatePct}% over{' '}
              {HOME_OFFICE_CONSTANTS.depreciationLifeYears} yrs
            </td>
            <td>{usd(OBO.depreciation, 0)}</td>
            <td>{usd(OBO.deductibleDepreciation, 0)}</td>
          </tr>
          <tr>
            <td><strong>Actual-method deduction</strong></td>
            <td>{usd(OBO.housingCost + OBO.operatingCost + OBO.depreciation, 0)}</td>
            <td><strong>{usd(EXO.actual.deduction, 0)}</strong></td>
          </tr>
          <tr>
            <td>Simplified option: {usd(HOME_OFFICE_CONSTANTS.simplifiedRatePerSqFt, 0)} ×{' '}
            {numFmt(OWNER_EXAMPLE.officeSqFt)} sq ft</td>
            <td>—</td>
            <td>{usd(EXO.simplified.deduction, 0)}</td>
          </tr>
        </tbody>
      </table>
      <p>
        The actual method deducts {usd(EXO.deductionDelta, 0)} more and saves{' '}
        {usd(EXO.savingDelta, 0)}/yr more tax ({usd(EXO.actual.saving.total, 0)} versus{' '}
        {usd(EXO.simplified.saving.total, 0)}) — at {usd(OBO.costPerSqFt, 2)}/sq ft of running
        cost, the engine returns no crossover point at all: the actual method leads from the first
        square foot of office. Two owner-specific caveats ride along. First,{' '}
        {usd(OBO.scheduleATransfer, 0)} of that {usd(EXO.actual.deduction, 0)} is mortgage interest
        and property tax moving from Schedule A to Schedule C — for an itemizer that slice was
        already deductible, so the genuinely new deduction is {usd(OWNER_NEW_MONEY, 0)}, though on
        Schedule C the whole amount also cuts SE tax, which Schedule A never did. Second, the{' '}
        {usd(OBO.deductibleDepreciation, 0)}/yr depreciation line is non-cash: it bankrolls{' '}
        {usd(DEP_SAVING, 0)}/yr of tax saving now and commits you to recapture later —{' '}
        {usd(OWNER_DEP_LIFE, 0)} of accumulated depreciation over the{' '}
        {HOME_OFFICE_CONSTANTS.depreciationLifeYears}-year life, worth up to{' '}
        {usd(OWNER_RECAPTURE, 0)} of tax when the home sells.
      </p>

      <h2 id="worked-example-lowcost">A third worked example — where the simplified method wins</h2>
      <p>
        Run the same engine on the calculator&apos;s low-cost-area preset: a{' '}
        {numFmt(LOW_EXAMPLE.homeSqFt)} sq ft rental home at {usd(LOW_EXAMPLE.rent, 0)}/yr with{' '}
        {usd(LOW_EXAMPLE.utilities + LOW_EXAMPLE.insurance + LOW_EXAMPLE.repairs, 0)} of
        utilities, insurance and repairs —{' '}
        {usd(EXL.actual.breakdown.housingCost + EXL.actual.breakdown.operatingCost, 0)}/yr to run
        the home, or {usd(EXL.actual.breakdown.costPerSqFt, 2)}/sq ft. A{' '}
        {numFmt(LOW_EXAMPLE.officeSqFt)} sq ft office is{' '}
        {pct(EXL.actual.breakdown.share * 100, 1)} of the home:
      </p>
      <table>
        <thead>
          <tr>
            <th>Line</th>
            <th>Simplified</th>
            <th>Actual</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Method formula</td>
            <td>${HOME_OFFICE_CONSTANTS.simplifiedRatePerSqFt} × {numFmt(LOW_EXAMPLE.officeSqFt)} sq ft</td>
            <td>{pct(EXL.actual.breakdown.share * 100, 1)} × {usd(EXL.actual.breakdown.housingCost + EXL.actual.breakdown.operatingCost, 0)}</td>
          </tr>
          <tr>
            <td>Deduction per year</td>
            <td>{usd(EXL.simplified.deduction, 0)}</td>
            <td>{usd(EXL.actual.deduction, 0)}</td>
          </tr>
          <tr>
            <td>Total tax saved</td>
            <td>{usd(EXL.simplified.saving.total)}</td>
            <td>{usd(EXL.actual.saving.total)}</td>
          </tr>
        </tbody>
      </table>
      <p>
        Simplified wins by {usd(Math.abs(EXL.deductionDelta), 0)} of deduction and{' '}
        {usd(Math.abs(EXL.savingDelta))}/yr of tax — and remember the second dividend: no
        receipts, no Form 8829, no depreciation schedule. The engine also reports the crossover
        for this cost profile: {numFmt(EXL.crossoverSqFt ?? 0, 0)} sq ft, the closed form{' '}
        {usd(HOME_OFFICE_CONSTANTS.simplifiedMaxDeduction, 0)} ÷{' '}
        {usd(EXL.actual.breakdown.costPerSqFt, 2)}. The office would have to grow past roughly{' '}
        {numFmt(EXL.crossoverSqFt ?? 0, 0)} sq ft before the actual method retakes the lead — a
        1-sq-ft scan of the engine puts the first whole square foot where it leads at{' '}
        {numFmt(SCAN.officeFlip)}.
      </p>

      <h2 id="choosing">Which method wins, and when</h2>
      <p>
        There is a clean way to see the whole decision in one number. Compute your home&apos;s{' '}
        <strong>annual running cost per square foot</strong> — (rent <em>or</em> mortgage interest +
        property tax) + utilities + insurance + repairs, plus depreciation for owners, all divided by
        home area:
      </p>
      <ul>
        <li>
          <strong>Above ${HOME_OFFICE_CONSTANTS.simplifiedRatePerSqFt}/sq ft</strong> — the actual
          method deducts more at <em>every</em> office size up to 300 sq ft. High-rent cities and
          mortgaged homes with healthy bases live here, often at $10–$20/sq ft.
        </li>
        <li>
          <strong>Below ${HOME_OFFICE_CONSTANTS.simplifiedRatePerSqFt}/sq ft</strong> — simplified wins
          for any office up to 300 sq ft. Paid-off homes in low-cost areas live here; the actual
          method only catches up past {usd(HOME_OFFICE_CONSTANTS.simplifiedMaxDeduction, 0)} ÷
          (cost per sq ft) of office space.
        </li>
        <li>
          <strong>Office above 300 sq ft</strong> — simplified is pinned at{' '}
          {usd(HOME_OFFICE_CONSTANTS.simplifiedMaxDeduction, 0)} while actual keeps scaling, so large
          offices strongly favor the actual method.
        </li>
      </ul>
      <p>
        But deduction size is not the only currency. The actual method costs you a year of receipts,
        Form 8829, and depreciation tracking — and if you later sell the home, every year of actual
        depreciation is <strong>recaptured</strong> as unrecaptured §1250 gain taxed at up to 25%.
        Simplified years create no depreciation and therefore no recapture. A defensible rule of
        thumb: if the two methods are within a few hundred dollars, take the simple one and keep the
        audit surface small.
      </p>

      <h2 id="boundaries">Decision boundaries</h2>
      <p>
        Before the arithmetic, the instrument itself has an edge. Use it when you file Schedule C
        (or an equivalent sole-proprietor schedule) and the space passes the exclusive-use gate.
        Do not reach for it as a W-2 employee — unreimbursed employee expenses stay suspended
        through 2025 — and run an S-corp home office through an accountable-plan reimbursement
        instead. And when business gross income barely clears your other business expenses, the
        gross-income limit described earlier clips both methods below the pre-limit figures this
        tool prints.
      </p>
      <p>
        The critical values below come from scanning this page&apos;s engine (
        <code>lib/homeoffice.ts</code>, compiled and run offline) rather than quoting statutory
        prose: annual rent was swept in $1 steps at a fixed {numFmt(EXAMPLE.officeSqFt)} sq ft
        office on the default profile, and office area in 1-sq-ft steps at the low-cost
        profile&apos;s costs. Each scan reports the first input at which the engine&apos;s winner
        flips — the engine grants a {usd(0.5)} tie tolerance on the deduction, which is why the
        rent flip sits a few dollars above the exact tie. The closed forms cross-check every
        scan: the tie line is {usd(HOME_OFFICE_CONSTANTS.simplifiedRatePerSqFt, 0)} × home sq ft,
        and the office crossover is{' '}
        {usd(HOME_OFFICE_CONSTANTS.simplifiedMaxDeduction, 0)} ÷ cost per sq ft.
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
            <td>Cost per sq ft at or above {usd(HOME_OFFICE_CONSTANTS.simplifiedRatePerSqFt, 0)}</td>
            <td>
              {usd(EX.actual.breakdown.costPerSqFt, 2)} city rental · {usd(OBO.costPerSqFt, 2)}{' '}
              homeowner · {usd(EXC.actual.breakdown.costPerSqFt, 2)} compact
            </td>
            <td>
              The actual method leads at every office size up to{' '}
              {HOME_OFFICE_CONSTANTS.simplifiedMaxSqFt} sq ft — this single number settles the
              whole election.
            </td>
          </tr>
          <tr>
            <td>Cost per sq ft below {usd(HOME_OFFICE_CONSTANTS.simplifiedRatePerSqFt, 0)}</td>
            <td>{usd(EXL.actual.breakdown.costPerSqFt, 2)} low-cost area</td>
            <td>
              Simplified wins for every office up to {HOME_OFFICE_CONSTANTS.simplifiedMaxSqFt}{' '}
              sq ft; the actual method retakes the lead only past the crossover two rows down.
            </td>
          </tr>
          <tr>
            <td>Tie line (any home)</td>
            <td>
              {usd(HOME_OFFICE_CONSTANTS.simplifiedRatePerSqFt, 0)} × home sq ft —{' '}
              {usd(EX.actual.breakdown.breakevenAnnualHomeCost, 0)} at{' '}
              {numFmt(EXAMPLE.homeSqFt)} sq ft, {usd(EXL.actual.breakdown.breakevenAnnualHomeCost, 0)}{' '}
              at {numFmt(LOW_EXAMPLE.homeSqFt)}
            </td>
            <td>
              The annual running cost at which both methods deduct identically below the cap —
              the engine&apos;s <code>breakevenAnnualHomeCost</code>.
            </td>
          </tr>
          <tr>
            <td>Rent flip, default profile</td>
            <td>
              {usd(SCAN.rentFlip, 0)}/yr ({usd(SCAN.rentFlip / 12, 2)}/mo)
            </td>
            <td>
              First whole-dollar rent where the actual method strictly leads at a{' '}
              {numFmt(EXAMPLE.officeSqFt)} sq ft office. The exact tie is{' '}
              {usd(RENT_TIE_EXACT, 0)}/yr; the engine&apos;s {usd(0.5)} winner tolerance moves the
              strict-lead line to {usd(STRICT_LEAD_RENT, 2)} ({usd(TOLERANCE_IN_RENT, 2)} of rent
              at the 1/9 business share), and the first whole dollar past it is{' '}
              {usd(SCAN.rentFlip, 0)} — the last half-dollar is rounding.
            </td>
          </tr>
          <tr>
            <td>Office flip, below-{usd(HOME_OFFICE_CONSTANTS.simplifiedRatePerSqFt, 0)} home</td>
            <td>
              {numFmt(EXL.crossoverSqFt ?? 0, 0)} sq ft closed form · {numFmt(SCAN.officeFlip)}{' '}
              sq ft in the 1-sq-ft scan
            </td>
            <td>
              Past this office size, share × running cost finally catches the flat{' '}
              {usd(HOME_OFFICE_CONSTANTS.simplifiedMaxDeduction, 0)}.
            </td>
          </tr>
          <tr>
            <td>Simplified ceiling</td>
            <td>
              {HOME_OFFICE_CONSTANTS.simplifiedMaxSqFt} sq ft ·{' '}
              {usd(HOME_OFFICE_CONSTANTS.simplifiedMaxDeduction, 0)}
            </td>
            <td>
              Offices beyond {HOME_OFFICE_CONSTANTS.simplifiedMaxSqFt} sq ft gain nothing under
              the simplified option — the boundary every large office hits first.
            </td>
          </tr>
        </tbody>
      </table>
      <p>
        What the scan cannot price: the actual method&apos;s year of receipts, Form 8829, and
        recapture exposure — the non-cash costs that decide close cases no table can. Which is
        why the few-hundred-dollars rule of thumb at the end of the previous section survives
        every scan here.
      </p>

      <h2 id="switching">Switching, carryovers &amp; recapture</h2>
      <ul>
        <li>
          <strong>You may switch methods every year</strong> — the election is annual, made on a
          timely-filed original return, and locked once made for that year. Within one home, every
          qualified business use must follow the same method. Different homes may use different
          methods in the same year — but the simplified option can apply to only one home per year
          (IRS Simplified Method FAQs, Q5–Q9).
        </li>
        <li>
          <strong>Carryovers:</strong> disallowed operating expenses (rent, utilities, insurance,
          repairs) and excess depreciation carry forward indefinitely under the actual method — but
          they cannot be <em>claimed</em> in a year you elect the simplified option, and limited
          mortgage interest and property taxes never enter the carryover at all (they return to
          Schedule A for itemizers). Amounts clipped under the simplified option are gone for good.
          When you return to the actual method after simplified years, depreciation resumes through
          the IRS optional depreciation tables.
        </li>
          <li>
          <strong>Recapture at sale (owners):</strong> depreciation <em>allowed or allowable</em> on the
          business share is recaptured when you sell — including years you used the actual method and
          chose not to claim depreciation. It is taxed as unrecaptured §1250 gain at up to 25%, and it
          can complicate the home-sale exclusion. This is the single strongest argument for the
          simplified method for owners nearing a sale.
        </li>
        <li>
          <strong>Moving or changing the space:</strong> a new home means a new percentage and, for
          actual-method depreciation, a fresh placed-in-service date and basis. Re-measure — do not
          carry the old share forward.
        </li>
      </ul>

      <h2 id="audit">Audit reality &amp; documentation</h2>
      <p>
        The home office deduction has an oversized reputation as an audit trigger, but what actually
        gets examined is not the method — it is the <strong>qualification</strong>. Exclusivity is a
        physical, checkable fact, and it is where claims die. Sensible hygiene, cheap to keep:
      </p>
      <ul>
        <li><strong>Photograph the space</strong> once a year, showing the desk, equipment, and nothing personal in the frame.</li>
        <li><strong>Keep a floor plan with measurements</strong> — office and total finished area — and note how the percentage was computed. Use finished living area, and be consistent with what your property-tax records and closing documents say.</li>
        <li><strong>Keep the bills</strong> you rely on for the actual method (rent, utilities, insurance, repairs) with the tax year&apos;s return.</li>
        <li><strong>Be plausible.</strong> A 300 sq ft &ldquo;office&rdquo; in a 600 sq ft apartment, or a percentage that jumps around without a physical change, invites questions the photos cannot answer.</li>
        <li>
          <strong>Simplified is not an audit shield.</strong> The space must still qualify — the
          {usd(HOME_OFFICE_CONSTANTS.simplifiedMaxDeduction, 0)} shortcut only changes the arithmetic,
          never the exclusivity test.
        </li>
      </ul>
      <p>
        One more honesty note: this page models <em>federal</em> mechanics only. Your state may
        conform, decouple, or have its own form; and for §199A filers below the QBI phase-out,
        each $1 of deduction also shrinks qualified business income by $1, cutting the §199A
        deduction itself by up to 20¢ — an effective rate near 80% of the bracket (filers whose
        QBI deduction is already capped or phased out get no such offset). That interaction is
        documented in the methodology section rather than computed here.
      </p>

      <h2 id="caveats">Important caveats</h2>
      <ul>
        <li>Self-employed filers only — W-2 employees cannot claim a home office for 2025 under the TCJA suspension.</li>
        <li>The gross-income limitation is not modeled; in reality neither method may exceed business gross income minus other business expenses, and simplified losses any excess permanently.</li>
        <li>Depreciation uses the full-year {depRatePct}% rate; a home placed in service this year deducts less (month-prorated, mid-month convention).</li>
        <li>SE-tax savings assume 2025 self-employment earnings below the {usd(HOME_OFFICE_CONSTANTS.ssWageBase2025, 0)} Social Security base; above it the marginal SE layer is 2.9%, not 15.3%.</li>
        <li>S-corp owner-employees usually handle the home office through an <strong>accountable plan</strong> reimbursement instead — same records, different mechanics, and outside this model.</li>
        <li>Nothing here is tax advice. Verify current-year rules and your state&apos;s conformity with a qualified professional.</li>
      </ul>

      <h2 id="glossary">Glossary</h2>
      <p>
        The vocabulary of the home office deduction in the sense this guide uses it — written for
        a reader meeting Form 8829 for the first time.
      </p>
      <dl className="mb-4">
        <dt className="mt-5 font-semibold text-slate-900 dark:text-slate-100">Exclusive use</dt>
        <dd className="mt-1 leading-relaxed text-slate-600 dark:text-slate-300">
          The gate everything hangs on: the specific area serves no personal purpose at all — not
          sleep, not TV, not guests. Occasional personal use breaks it, however rarely it happens.
        </dd>
        <dt className="mt-5 font-semibold text-slate-900 dark:text-slate-100">Regular use</dt>
        <dd className="mt-1 leading-relaxed text-slate-600 dark:text-slate-300">
          Ongoing, consistent use of the space for business rather than the occasional weekend.
          There is no minimum-hours threshold — a pattern of use is what counts.
        </dd>
        <dt className="mt-5 font-semibold text-slate-900 dark:text-slate-100">Principal place of business</dt>
        <dd className="mt-1 leading-relaxed text-slate-600 dark:text-slate-300">
          The qualifying business connection: the home office is where the business is run, or
          where its administrative and management work happens with no other fixed location for
          it. Client meetings and separate structures qualify on their own terms.
        </dd>
        <dt className="mt-5 font-semibold text-slate-900 dark:text-slate-100">Simplified option</dt>
        <dd className="mt-1 leading-relaxed text-slate-600 dark:text-slate-300">
          The shortcut election:{' '}
          {usd(HOME_OFFICE_CONSTANTS.simplifiedRatePerSqFt, 0)} × office square feet, capped at{' '}
          {HOME_OFFICE_CONSTANTS.simplifiedMaxSqFt} sq ft and{' '}
          {usd(HOME_OFFICE_CONSTANTS.simplifiedMaxDeduction, 0)}/yr. No expense records, no
          depreciation — and no carryover for anything the gross-income limit clips.
        </dd>
        <dt className="mt-5 font-semibold text-slate-900 dark:text-slate-100">Actual method (Form 8829)</dt>
        <dd className="mt-1 leading-relaxed text-slate-600 dark:text-slate-300">
          The full computation: business-use percentage times the year&apos;s indirect home
          expenses plus depreciation. Deducts more in most expensive homes, at the cost of
          records and depreciation tracking.
        </dd>
        <dt className="mt-5 font-semibold text-slate-900 dark:text-slate-100">Business-use percentage</dt>
        <dd className="mt-1 leading-relaxed text-slate-600 dark:text-slate-300">
          Office area ÷ total finished home area, capped at 100% — the single fraction that
          allocates every indirect expense under the actual method.
        </dd>
        <dt className="mt-5 font-semibold text-slate-900 dark:text-slate-100">Indirect expenses</dt>
        <dd className="mt-1 leading-relaxed text-slate-600 dark:text-slate-300">
          Whole-home running costs — rent (or mortgage interest plus property taxes), utilities,
          insurance, repairs — allocated by the business-use percentage. Costs incurred only for
          the office itself are direct expenses and belong elsewhere on Schedule C.
        </dd>
        <dt className="mt-5 font-semibold text-slate-900 dark:text-slate-100">Depreciable basis</dt>
        <dd className="mt-1 leading-relaxed text-slate-600 dark:text-slate-300">
          What actually gets depreciated under the actual method: the lower of the home&apos;s
          adjusted basis or its fair market value when business use began, excluding land —
          not simply the purchase price. Straight-line over{' '}
          {HOME_OFFICE_CONSTANTS.depreciationLifeYears} years at {depRatePct}% per full year,
          owners only, and the root of all recapture later.
        </dd>
        <dt className="mt-5 font-semibold text-slate-900 dark:text-slate-100">Gross-income limitation</dt>
        <dd className="mt-1 leading-relaxed text-slate-600 dark:text-slate-300">
          The outer fence around both methods: the deduction can never exceed business gross
          income minus other business expenses, however large the arithmetic says your home
          office is worth. This calculator does not model it.
        </dd>
        <dt className="mt-5 font-semibold text-slate-900 dark:text-slate-100">Carryover</dt>
        <dd className="mt-1 leading-relaxed text-slate-600 dark:text-slate-300">
          Amounts the gross-income limit disallowed under the actual method — operating expenses
          and depreciation, but not the interest-and-tax slice — held forward to profitable
          years. They cannot be claimed in a year you elect the simplified option.
        </dd>
        <dt className="mt-5 font-semibold text-slate-900 dark:text-slate-100">Recapture (unrecaptured §1250 gain)</dt>
        <dd className="mt-1 leading-relaxed text-slate-600 dark:text-slate-300">
          The bill for depreciation allowed or allowable on the business share, due when the home
          sells and taxed at up to 25% — including years you used the actual method but chose not
          to claim the depreciation.
        </dd>
        <dt className="mt-5 font-semibold text-slate-900 dark:text-slate-100">Accountable plan</dt>
        <dd className="mt-1 leading-relaxed text-slate-600 dark:text-slate-300">
          The S-corp route: the company reimburses the owner-employee for the documented business
          share of home costs, tax-free to the owner and deductible to the company — same
          qualification rules, different plumbing.
        </dd>
      </dl>

      <Faq
        items={[
          {
            question: 'Can I deduct a desk in my bedroom or living room?',
            answer: (
              <p>
                Almost certainly not. The exclusive-use test applies to the specific area: if any
                part of the space serves personal purposes — sleeping, TV, guests — the deduction for
                that area fails, however modest the personal use. You need a room (or a clearly
                delineated section) that does nothing but business, plus regular use and a qualifying
                business connection (principal place of business, client meetings, or a separate
                structure).
              </p>
            ),
          },
          {
            question: 'Can I switch between the simplified and actual methods?',
            answer: (
              <p>
                Yes — the election is annual, made on the timely-filed return and locked for
                that year, and all of one home&apos;s qualified uses must follow the same method
                (across homes you may mix, with simplified limited to one). What does not travel
                with you is the carryover arithmetic — see &ldquo;Switching, carryovers &amp;
                recapture&rdquo; above for how disallowed amounts and recapture move between
                methods.
              </p>
            ),
          },
          {
            question: 'My office is 480 sq ft. Why does the simplified method only count 300?',
            answer: (
              <p>
                The statute caps the simplified option at 300 square feet — a hard{' '}
                {usd(HOME_OFFICE_CONSTANTS.simplifiedMaxDeduction, 0)} ceiling regardless of true
                office size. The actual method has no square-foot cap at all; it is limited only by
                your business percentage and the gross-income rule, which is why large offices almost
                always belong on Form 8829.
              </p>
            ),
          },
          {
            question: 'Does using the simplified method hurt me when I sell my home?',
            answer: (
              <p>
                No. Simplified-method years claim no depreciation, so there is nothing to recapture
                for those years. Actual-method years are different: the depreciation on the business
                share — allowed or allowable, whether or not you actually claimed it — is recaptured
                on sale as unrecaptured §1250 gain, taxed at up to 25%. Owners planning to sell soon
                often choose the simplified method precisely to stop the depreciation clock.
              </p>
            ),
          },
          {
            question: 'What if my home office deduction is bigger than my business income?',
            answer: (
              <p>
                The deduction stops at business gross income minus your other business expenses — it
                can never create a loss. Under the actual method, disallowed operating expenses and
                depreciation carry forward to profitable years, while limited mortgage interest and
                property taxes instead return to Schedule A for itemizers; under the simplified
                method it disappears. This calculator does not apply that limit (there is no
                business-income input), so treat its output as the pre-limit deduction.
              </p>
            ),
          },
          {
            question: 'I run an S-Corp. Can I take this deduction?',
            answer: (
              <p>
                The Schedule C mechanics modeled here belong to sole proprietors and single-member
                LLCs. An S-corp owner-employee typically reimburses the home office through an{' '}
                <em>accountable plan</em>: the company pays you the same business-share amount
                tax-free, with the same qualification rules and substantiation. The economics are
                similar or better (the reimbursement is a business expense), but run it with your CPA —
                see the S-Corp Salary Calculator for the surrounding payroll picture.
              </p>
            ),
          },
          {
            question: 'Does the deduction reduce self-employment tax too, or just income tax?',
            answer: (
              <p>
                On Schedule C, both. Every dollar of home office deduction shrinks net
                self-employment earnings, saving {pct(SE_LAYER_PCT, 2)} of SE tax, and then
                income tax on the rest: per {usd(1000, 0)} of deduction at a 24% bracket the
                engine books {usd(PER_K.seTax, 2)} of SE tax plus {usd(PER_K.incomeTax, 2)} of
                income tax (after a {usd(PER_K.halfSeClawback, 2)} clawback from the smaller
                half-of-SE-tax deduction) — {usd(PER_K.total, 2)} total, versus{' '}
                {usd(PER_K_NO_SE.total, 0)} for an income-tax-only filer.
              </p>
            ),
          },
          {
            question: 'Why does the owner’s “actual” figure include depreciation I never pay in cash?',
            answer: (
              <p>
                Because the statute grants it: the office share of the home&apos;s basis is
                deducted as it wears out, whether or not money moves — in the homeowner example
                above, {usd(OBO.deductibleDepreciation, 0)}/yr of the deduction is pure
                depreciation. Treat it as deferral more than gift: every year of it returns as
                unrecaptured §1250 gain, taxed at up to 25% when the home sells (the worked
                example prices the full cycle).
              </p>
            ),
          },
          {
            question: 'Is a small apartment automatically a simplified-method case?',
            answer: (
              <p>
                No — small denominators cut both ways. The calculator&apos;s compact-apartment
                preset ({numFmt(COMPACT_EXAMPLE.homeSqFt)} sq ft home,{' '}
                {usd(COMPACT_EXAMPLE.rent, 0)}/yr rent) runs at{' '}
                {usd(EXC.actual.breakdown.costPerSqFt, 2)}/sq ft, so the actual method deducts{' '}
                {usd(EXC.actual.deduction, 0)} against the simplified option&apos;s{' '}
                {usd(EXC.simplified.deduction, 0)}. What decides the election is cost per square
                foot, not floor plan.
              </p>
            ),
          },
          {
            question: 'What about a really small office — a 60-square-foot writing nook?',
            answer: (
              <p>
                Size alone does not disqualify it: a specifically identifiable area qualifies on
                the same exclusive-use test. On the default renter profile a{' '}
                {numFmt(60)} sq ft nook still deducts {usd(NOOK.actual.deduction, 0)} under the
                actual method versus {usd(NOOK.simplified.deduction, 0)} simplified — rent at{' '}
                {usd(EX.actual.breakdown.costPerSqFt, 2)}/sq ft keeps the actual method ahead
                even at tiny shares.
              </p>
            ),
          },
          {
            question: 'Does a higher tax bracket make the actual method the right choice?',
            answer: (
              <p>
                No — the bracket scales the payoff, it never picks the winner. The engine
                compares deductions, and because tax saving rises strictly with the deduction at
                any fixed rate, the ordering is rate-invariant (the default example comes out
                &ldquo;actual&rdquo; at 12% and at 37% alike). The bracket only prices the gap:
                the default example&apos;s {usd(EX.deductionDelta, 0)} of extra deduction is
                worth {usd(EX.savingDelta)}/yr at 24% and {usd(EX32.savingDelta)} at 32%.
              </p>
            ),
          },
          {
            question: 'For owners, isn’t part of the actual deduction just moving numbers between schedules?',
            answer: (
              <p>
                Partly. For an itemizer, the mortgage-interest and property-tax slice of the
                actual method was already deductible on Schedule A — in the homeowner example,
                only {usd(OWNER_NEW_MONEY, 0)}/yr of the deduction is genuinely new money. The
                transfer still pays: on Schedule C the whole amount also cuts SE tax, which
                Schedule A never did, and standard-deduction filers gain the slice outright.
              </p>
            ),
          },
          {
            question: 'Can I run my internet and cell phone bills through the home office deduction?',
            answer: (
              <p>
                No — they are not Form 8829 lines. Telecom is deducted separately on Schedule C
                for its business-use share, with its own substantiation. The actual method here
                allocates the home&apos;s physical running costs only: rent or interest plus
                taxes, utilities, insurance, and repairs.
              </p>
            ),
          },
          {
            question: 'I also keep a coworking membership — does that disqualify the home office?',
            answer: (
              <p>
                Not by itself. The administrative-and-management test fails only if you have
                another <em>fixed</em> location where you do substantial administrative work — a
                hot-desk membership used for the work itself generally does not count. A
                dedicated outside office where the books also get done does, and would break the
                principal-place connection.
              </p>
            ),
          },
          {
            question: 'Does the office have to be a whole room?',
            answer: (
              <p>
                No — a clearly delineated section of a room can qualify, but it must be
                specifically identifiable and measured, and exclusivity applies to exactly that
                measured area. In practice a whole room is far easier to defend than an imagined
                boundary across a studio floor.
              </p>
            ),
          },
          {
            question: 'I moved mid-year. What happens to the deduction?',
            answer: (
              <p>
                Both methods prorate by the months the space was in qualified business use —
                part-year occupancy buys a part-year deduction. For actual-method owners the new
                home brings a fresh basis and placed-in-service date, so re-measure the
                percentage and restart depreciation rather than carrying the old share forward.
              </p>
            ),
          },
          {
            question: 'Two businesses share my office. Is the deduction doubled?',
            answer: (
              <p>
                No. The simplified option&apos;s{' '}
                {HOME_OFFICE_CONSTANTS.simplifiedMaxSqFt}-sq-ft /{' '}
                {usd(HOME_OFFICE_CONSTANTS.simplifiedMaxDeduction, 0)} allowance belongs to the
                home, not to each business, and the same square footage cannot be counted twice
                under either method. Allocate the one office across the schedules; do not stack
                two claims on the same space.
              </p>
            ),
          },
          {
            question: 'My spouse and I are both self-employed, each with an office in the same home. Can we both claim?',
            answer: (
              <p>
                Yes, if each space independently passes the exclusive-use gate — one home can
                carry two qualifying areas. Each spouse computes a separate business percentage
                on the measured area and claims it on their own Schedule C; the areas cannot
                overlap.
              </p>
            ),
          },
          {
            question: 'Is renter’s insurance included in the actual method?',
            answer: (
              <p>
                Yes — the business-use share of renter&apos;s (or homeowner&apos;s) insurance is
                an indirect home expense, allocated exactly like utilities and repairs. What
                never enters Form 8829 is insurance on business equipment itself: that is a
                direct business expense on Schedule C.
              </p>
            ),
          },
          {
            question: 'Are repairs to the office itself prorated by the business percentage?',
            answer: (
              <p>
                No — proration is for whole-home costs. A repair that benefits only the office
                (fixing its window, painting its walls) is 100% business, claimed directly on
                Schedule C rather than through the Form 8829 allocation. Whole-home repairs are
                the ones the share scales.
              </p>
            ),
          },
          {
            question: 'My business barely breaks even — does the method ranking still hold?',
            answer: (
              <p>
                Careful: the gross-income limit clips both methods to business gross income minus
                your other business expenses, and this calculator prices the pre-limit
                deduction. What flips at low profit is the <em>consequence</em> of the clip —
                simplified loses the excess permanently, while the actual method carries
                operating expenses and depreciation forward to profitable years. Near
                break-even, that carryover is often the deciding factor.
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

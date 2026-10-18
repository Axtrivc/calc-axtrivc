import Faq from '@/components/Faq';
import { ArticleToc, RelatedCalculators } from '@/components/Article';
import {
  PAYTYPE_CONSTANTS,
  PAYTYPE_DEFAULTS,
  billableHours,
  breakevenContractRate,
  breakevenMarkup,
  comparePayType,
  computeContractorSide,
  equivalentW2Salary,
  w2Hourly,
  type PayTypeInputs,
} from '@/lib/paytype';
import { numFmt, pct, usd, usdCompact } from '@/lib/format';

/**
 * The in-depth guide for the 1099 vs W-2 instrument. Every number in the
 * prose — worked examples, FAQ scenarios, glossary constants — is computed
 * from lib/paytype.ts at build time (the same functions the widget uses), so
 * the text cannot drift from the math. The four SCAN flip points below are
 * the one exception: they come from $1-step scans of the compiled engine run
 * offline, with the method documented in the "Decision boundaries" section.
 */

// ---- The default scenario (worked example 1 and the demo thread throughout).
const demo = comparePayType(PAYTYPE_DEFAULTS);
const demoBe = breakevenContractRate(PAYTYPE_DEFAULTS)!;
const demoMarkup = breakevenMarkup(PAYTYPE_DEFAULTS.salary, demoBe)!;
const demoEquiv = equivalentW2Salary(PAYTYPE_DEFAULTS)!;
// The employer's fully-loaded cost of the default package — the negotiation
// anchor: salary + the employer half of FICA (7.65%) + benefits at face.
const employerCost = demo.w2.salary * 1.0765 + demo.w2.benefits;
const loadedHourly = employerCost / PAYTYPE_CONSTANTS.hoursPerYear;

// ---- Package presets for the markup discussion — computed from the same
// library, never typed, so the prose cannot drift from the tool (the FAQ once
// contradicted the big-tech preset this way).
const RICH_OVERRIDES: Partial<PayTypeInputs> = {
  ptoDays: 20,
  healthPremium: 9000,
  retirementMatch: 6000,
  otherBenefits: 1000,
  seExpenses: 3000,
};
const NO_BENEFITS_OVERRIDES: Partial<PayTypeInputs> = {
  ptoDays: 0,
  healthPremium: 0,
  retirementMatch: 0,
  otherBenefits: 0,
};
// The zero-everything package: isolates the pure tax gap between the pay types.
const NO_PACKAGE: Partial<PayTypeInputs> = { ...NO_BENEFITS_OVERRIDES, seExpenses: 0 };

const markupAt = (overrides: Partial<PayTypeInputs>, salary: number) =>
  breakevenMarkup(salary, breakevenContractRate({ ...PAYTYPE_DEFAULTS, ...overrides, salary })) ?? 0;
const noneAt100k = markupAt(NO_BENEFITS_OVERRIDES, 100_000);
const richAt100k = markupAt(RICH_OVERRIDES, 100_000);
const richAt150k = markupAt(RICH_OVERRIDES, 150_000);
const richAt60k = markupAt(RICH_OVERRIDES, 60_000);

// Pure tax gap (zero benefits, zero PTO, zero expenses) at scan landmarks.
const gapAt50k = markupAt(NO_PACKAGE, 50_000);
const gapAt100k = markupAt(NO_PACKAGE, 100_000);
// Exactly at the employee-side wage base: the left edge of the two-caps window.
const gapAtWageBase = markupAt(NO_PACKAGE, PAYTYPE_CONSTANTS.ssWageBase);
const gapAt188k = markupAt(NO_PACKAGE, 188_000);
const gapAt400k = markupAt(NO_PACKAGE, 400_000);

/**
 * Flip points from $1-step scans of this page's engine (lib/paytype.ts,
 * compiled and run offline): each value is the FIRST whole dollar at which
 * the new condition holds — the dollar after the last one where the old
 * regime still did. Method documented in "Decision boundaries" below.
 */
const SCAN = {
  /** First $ of net profit carrying any SE tax ($400 floor ÷ 92.35% = 433.13). */
  seFloorNet: 434,
  /** First $ of net profit whose SE base reaches the $176,100 wage base. */
  ssCapNet: 190_688,
  /** First $ of net profit drawing the 0.9% Additional Medicare surcharge. */
  addlMedicareNet: 216_568,
  /** First salary (zero-benefit package) at which the breakeven markup < 0. */
  noBenefitsFirstNegative: 223_755,
} as const;

/**
 * Salary at which the required markup for a fixed package falls through
 * `target`% (markup decreases as the salary outgrows a fixed package), found
 * by bisection on the engine's own breakeven — the same scan run offline.
 */
function salaryWhereMarkupFallsThrough(
  overrides: Partial<PayTypeInputs>,
  target: number,
  from: number,
  to: number,
): number {
  let lo = from;
  let hi = to;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (markupAt(overrides, mid) > target) lo = mid;
    else hi = mid;
  }
  return Math.round((lo + hi) / 2);
}

/** The 30–50% rule-of-thumb band, mapped to the salary windows where it is literally correct. */
const defaultPkg50 = salaryWhereMarkupFallsThrough({}, 50, 20_000, 200_000);
const defaultPkg30 = salaryWhereMarkupFallsThrough({}, 30, 20_000, 250_000);
const richPkg50 = salaryWhereMarkupFallsThrough(RICH_OVERRIDES, 50, 20_000, 200_000);
const richPkg30 = salaryWhereMarkupFallsThrough(RICH_OVERRIDES, 30, 30_000, 300_000);

// ---- Worked examples 2 and 3: the calculator widget's scenario presets,
// verbatim (PayTypeCalculator.tsx SCENARIO_PRESETS) — a reader can load the
// preset in the widget and watch the same numbers appear.
const BIGTECH: PayTypeInputs = {
  salary: 150000,
  contractRate: 100,
  ptoDays: 20,
  healthPremium: 9000,
  retirementMatch: 6000,
  otherBenefits: 1000,
  seExpenses: 3000,
};
const STARTUP: PayTypeInputs = {
  salary: 110000,
  contractRate: 75,
  ptoDays: 10,
  healthPremium: 3600,
  retirementMatch: 0,
  otherBenefits: 0,
  seExpenses: 2500,
};
const SMB_PRESET: PayTypeInputs = {
  salary: 65000,
  contractRate: 50,
  ptoDays: 10,
  healthPremium: 6000,
  retirementMatch: 1500,
  otherBenefits: 0,
  seExpenses: 1500,
};

const exBig = comparePayType(BIGTECH);
const exBigBe = breakevenContractRate(BIGTECH)!;
const exBigMarkup = breakevenMarkup(BIGTECH.salary, exBigBe)!;
const exBigEquiv = equivalentW2Salary(BIGTECH)!;
// Derivation intermediates, all from the engine result object.
const bigSeBase = exBig.c1099.netSE * PAYTYPE_CONSTANTS.seBaseFactor;
const bigQbiBase = exBig.c1099.netSE - exBig.c1099.halfSeTax - exBig.c1099.sehiDeduction;
const bigQbiCap = (bigQbiBase - PAYTYPE_CONSTANTS.stdDeduction) * PAYTYPE_CONSTANTS.qbiRate;

const exStart = comparePayType(STARTUP);
const exStartBe = breakevenContractRate(STARTUP)!;
const exStartMarkup = breakevenMarkup(STARTUP.salary, exStartBe)!;
const exStartEquiv = equivalentW2Salary(STARTUP)!;
const startSeBase = exStart.c1099.netSE * PAYTYPE_CONSTANTS.seBaseFactor;
const startQbiBase = exStart.c1099.netSE - exStart.c1099.halfSeTax - exStart.c1099.sehiDeduction;
const startQbiCap = (startQbiBase - PAYTYPE_CONSTANTS.stdDeduction) * PAYTYPE_CONSTANTS.qbiRate;
const startRule13 = w2Hourly(STARTUP.salary) * 1.3;
const startQuoteMargin = STARTUP.contractRate - exStartBe;

const smbRes = comparePayType(SMB_PRESET);
const smbBe = breakevenContractRate(SMB_PRESET)!;
const smbMarkup = breakevenMarkup(SMB_PRESET.salary, smbBe)!;
const smbEquiv = equivalentW2Salary(SMB_PRESET)!;

// ---- FAQ scenario numbers ----------------------------------------------------
/** Contract rate at which the 1099 side's value kept reaches exactly `target` $/yr. */
function rateForValue(inputs: PayTypeInputs, target: number, cap = 1000): number {
  let lo = 0;
  let hi = cap;
  for (let i = 0; i < 80; i++) {
    const mid = (lo + hi) / 2;
    if (computeContractorSide({ ...inputs, contractRate: mid }).valueKept > target) hi = mid;
    else lo = mid;
  }
  return (lo + hi) / 2;
}
const benefitsTotal =
  PAYTYPE_DEFAULTS.healthPremium + PAYTYPE_DEFAULTS.retirementMatch + PAYTYPE_DEFAULTS.otherBenefits;
const beat5k = rateForValue(PAYTYPE_DEFAULTS, demo.w2.totalValue + 5_000);
const beat10k = rateForValue(PAYTYPE_DEFAULTS, demo.w2.totalValue + 10_000);
const beat20k = rateForValue(PAYTYPE_DEFAULTS, demo.w2.totalValue + 20_000);
const eqAt = (quote: number) => equivalentW2Salary({ ...PAYTYPE_DEFAULTS, contractRate: quote })!;
const eqAt50 = eqAt(50);
const eqAt75 = eqAt(75);
const eqAt100 = eqAt(100);
// Below this rate the contract cannot out-earn the benefits' face value, so
// the equivalent-salary solver bottoms out at zero.
const benefitsCliffRate = rateForValue(PAYTYPE_DEFAULTS, benefitsTotal);

const rateAtPto = (ptoDays: number) => breakevenContractRate({ ...PAYTYPE_DEFAULTS, ptoDays })!;
const ptoZero = rateAtPto(0);
const ptoMax = rateAtPto(40);
const rateAtExp = (seExpenses: number) => breakevenContractRate({ ...PAYTYPE_DEFAULTS, seExpenses })!;
const expNone = rateAtExp(0);
const expHeavy = rateAtExp(10_000);
const expPerThousand = (expHeavy - expNone) / 10;

// The SEHI counterfactual: on the contractor side the health premium enters
// ONLY through its above-the-line deduction, so re-running the engine with
// the premium zeroed isolates exactly what that deduction is worth.
const sehiWith = computeContractorSide(PAYTYPE_DEFAULTS);
const sehiWithout = computeContractorSide({ ...PAYTYPE_DEFAULTS, healthPremium: 0 });
const sehiTaxValue = sehiWithout.incomeTax - sehiWith.incomeTax;

// Marginal payroll cost per $1, per side, from the engine's own constants.
const cents = {
  seBelow: PAYTYPE_CONSTANTS.seRate * PAYTYPE_CONSTANTS.seBaseFactor * 100,
  seAbove: 0.029 * PAYTYPE_CONSTANTS.seBaseFactor * 100,
  seAddl: PAYTYPE_CONSTANTS.addlMedicareRate * PAYTYPE_CONSTANTS.seBaseFactor * 100,
  w2Below: (PAYTYPE_CONSTANTS.ssRate + PAYTYPE_CONSTANTS.medicareRate) * 100,
  w2Above: PAYTYPE_CONSTANTS.medicareRate * 100,
  w2Addl: PAYTYPE_CONSTANTS.addlMedicareRate * 100,
};

export default function PayTypeArticle() {
  const toc = [
    { id: 'mechanics', label: 'How the two pay types actually differ' },
    { id: 'worked-example', label: 'Worked example at $100k' },
    { id: 'worked-example-bigtech', label: 'A second example: big-tech at $150k' },
    { id: 'worked-example-startup', label: 'A third example: lean startup at $110k' },
    { id: 'markup', label: 'Breakeven markup vs the 1.3–1.5× rule of thumb' },
    { id: 'boundaries', label: 'Decision boundaries' },
    { id: 'misclassification', label: 'The misclassification boundary' },
    { id: 'negotiation', label: 'Negotiating from the numbers' },
    { id: 'glossary', label: 'Glossary' },
    { id: 'caveats', label: 'Important caveats' },
    { id: 'faq', label: 'FAQ' },
  ];

  return (
    <article className="prose-article">
      <ArticleToc items={toc} />

      <h2 id="mechanics">How the two pay types actually differ</h2>
      <p>
        A W-2 employee and a 1099 contractor can do identical work for identical money and end up in very
        different places. Four mechanical differences drive everything this calculator shows:
      </p>
      <ol>
        <li>
          <strong>Who pays the payroll tax.</strong> The W-2 employee pays one half of FICA —{' '}
          {pct(PAYTYPE_CONSTANTS.ssRate * 100, 1)} Social Security (up to the{' '}
          {numFmt(PAYTYPE_CONSTANTS.ssWageBase, 0)} wage base) + {pct(PAYTYPE_CONSTANTS.medicareRate * 100, 2)}{' '}
          Medicare — and the employer silently pays the other half. The contractor pays <em>both</em> halves as
          self-employment tax: {pct(PAYTYPE_CONSTANTS.seRate * 100, 1)} on the first{' '}
          {numFmt(PAYTYPE_CONSTANTS.ssWageBase, 0)} of Schedule SE base ({pct(PAYTYPE_CONSTANTS.seBaseFactor * 100, 2)}{' '}
          of net business income), then {pct(2.9, 1)} Medicare above it — plus the same{' '}
          {pct(PAYTYPE_CONSTANTS.addlMedicareRate * 100, 1)} Additional Medicare surcharge above{' '}
          {usd(PAYTYPE_CONSTANTS.addlMedicareThreshold, 0)} of SE base that employees pay on wages (Form 8959
          Part III). Unlike the rest of SE tax, that surcharge gets no half deduction.
        </li>
        <li>
          <strong>Benefits arrive as things, not cash.</strong> Health premiums the employer pays are excluded
          from your taxable income; a 401(k) match is your money, tax-deferred. A contractor buys the health
          plan with after-SE-tax cash — though the self-employed health insurance deduction and the 20% QBI
          deduction claw part of that back.
        </li>
        <li>
          <strong>Paid time off is a real number.</strong> The salary already pays for vacation days. On a
          contract, every PTO day is {PAYTYPE_CONSTANTS.ptoHoursPerDay} hours you cannot bill — at the default
          15 days that is {numFmt(PAYTYPE_DEFAULTS.ptoDays * PAYTYPE_CONSTANTS.ptoHoursPerDay)} unbilled hours a
          year.
        </li>
        <li>
          <strong>Expenses move to your side of the ledger.</strong> Software, liability insurance, equipment —
          deductible Schedule C costs, but cash out the door that an employer would have covered.
        </li>
      </ol>
      <p>
        The instrument lines all of this up on one axis — <strong>total value kept per year</strong> — and then
        solves for the one number that matters in a negotiation: the hourly rate at which the contract ties the
        job.
      </p>

      <h2 id="worked-example">Worked example at a $100,000 salary</h2>
      <p>
        The calculator&apos;s default scenario — a {usd(demo.w2.salary, 0)} salary with {usd(demo.w2.benefits, 0)}
        /yr of benefits ({numFmt(PAYTYPE_DEFAULTS.ptoDays)} PTO days, a {usd(PAYTYPE_DEFAULTS.healthPremium, 0)}{' '}
        health plan, a {usd(PAYTYPE_DEFAULTS.retirementMatch, 0)} match), against a{' '}
        {usd(PAYTYPE_DEFAULTS.contractRate)}/hr contract with {usd(PAYTYPE_DEFAULTS.seExpenses, 0)} of expenses.
        Single filer, 2025 federal rules, no state tax:
      </p>
      <table>
        <thead>
          <tr>
            <th>Line item</th>
            <th>W-2 employee</th>
            <th>1099 contractor</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Gross pay</td>
            <td>{usd(demo.w2.salary, 0)}</td>
            <td>{usd(demo.c1099.revenue, 0)}</td>
          </tr>
          <tr>
            <td>Employee FICA / SE tax</td>
            <td>−{usd(demo.w2.fica)}</td>
            <td>−{usd(demo.c1099.seTax)}</td>
          </tr>
          <tr>
            <td>Federal income tax</td>
            <td>−{usd(demo.w2.incomeTax)}</td>
            <td>−{usd(demo.c1099.incomeTax)}</td>
          </tr>
          <tr>
            <td>Benefits at face value</td>
            <td>+{usd(demo.w2.benefits, 0)}</td>
            <td>—</td>
          </tr>
          <tr>
            <td><strong>Total value kept</strong></td>
            <td><strong>{usd(demo.w2.totalValue, 0)}</strong></td>
            <td><strong>{usd(demo.c1099.valueKept, 0)}</strong></td>
          </tr>
        </tbody>
      </table>
      <p>
        Two subtleties hide inside the contractor column. First, the contractor really does write a{' '}
        {usd(PAYTYPE_DEFAULTS.healthPremium, 0)} premium check — but holds a {usd(PAYTYPE_DEFAULTS.healthPremium, 0)}{' '}
        policy, so it nets to zero except for its above-the-line deduction, already reflected in the income-tax
        line. Second, the contractor&apos;s income tax is <em>lower</em> despite higher gross pay: QBI (
        {usd(demo.c1099.qbiDeduction, 0)} deducted here) and the half-SE deduction do real work. That is exactly
        the interplay flat &ldquo;add 30% for taxes&rdquo; rules ignore.
      </p>

      <h2 id="worked-example-bigtech">A second worked example: the $150,000 big-tech package</h2>
      <p>
        Same engine, richer offer — the calculator&apos;s <em>Big-tech package</em> preset, so you can load it in
        the widget and follow along: a {usd(BIGTECH.salary, 0)} salary against a {usd(BIGTECH.contractRate)}/hr
        quote, 20 PTO days, a {usd(BIGTECH.healthPremium, 0)} health plan, a {usd(BIGTECH.retirementMatch, 0)}{' '}
        match, {usd(BIGTECH.otherBenefits, 0)} of other benefits, and {usd(BIGTECH.seExpenses, 0)} of business
        expenses. Single filer, 2025 federal, no state tax.
      </p>
      <p><strong>The employee side, four lines:</strong></p>
      <ol>
        <li>
          Employee FICA: all {usd(BIGTECH.salary, 0)} of wages sit under the{' '}
          {numFmt(PAYTYPE_CONSTANTS.ssWageBase, 0)} wage base and the {usd(PAYTYPE_CONSTANTS.addlMedicareThreshold, 0)}{' '}
          surcharge line, so FICA is a flat{' '}
          {pct((PAYTYPE_CONSTANTS.ssRate + PAYTYPE_CONSTANTS.medicareRate) * 100, 2)} × {usd(BIGTECH.salary, 0)} ={' '}
          {usd(exBig.w2.fica)}.
        </li>
        <li>
          Taxable income: {usd(BIGTECH.salary, 0)} − {usd(PAYTYPE_CONSTANTS.stdDeduction, 0)} standard deduction ={' '}
          {usd(exBig.w2.taxableIncome, 0)}, which runs through the 2025 brackets to{' '}
          {usd(exBig.w2.incomeTax)} of income tax.
        </li>
        <li>
          Cash after tax: {usd(BIGTECH.salary, 0)} − {usd(exBig.w2.fica)} − {usd(exBig.w2.incomeTax)} ={' '}
          {usd(exBig.w2.cashAfterTax, 0)}.
        </li>
        <li>
          Benefits at face: {usd(BIGTECH.healthPremium, 0)} + {usd(BIGTECH.retirementMatch, 0)} +{' '}
          {usd(BIGTECH.otherBenefits, 0)} = {usd(exBig.w2.benefits, 0)}, for a total value kept of{' '}
          <strong>{usd(exBig.w2.totalValue, 0)}</strong>.
        </li>
      </ol>
      <p><strong>The contractor side, in the engine&apos;s evaluation order:</strong></p>
      <ol>
        <li>
          Billable hours: 2,080 − 8 × 20 PTO days = {numFmt(exBig.c1099.hours)}; revenue ={' '}
          {usd(BIGTECH.contractRate)} × {numFmt(exBig.c1099.hours)} = {usd(exBig.c1099.revenue, 0)}.
        </li>
        <li>
          Schedule C net: {usd(exBig.c1099.revenue, 0)} − {usd(exBig.c1099.expenses, 0)} of expenses ={' '}
          {usd(exBig.c1099.netSE, 0)}. The SE base is {pct(PAYTYPE_CONSTANTS.seBaseFactor * 100, 2)} of that ={' '}
          {usd(bigSeBase)} — still {usd(SCAN.ssCapNet - exBig.c1099.netSE, 0)} of net profit short of the wage-base
          crossing, so the full {pct(PAYTYPE_CONSTANTS.seRate * 100, 1)} applies: SE tax ={' '}
          {usd(exBig.c1099.seTax)}.
        </li>
        <li>
          Half-SE deduction: {usd(exBig.c1099.halfSeTax)} (the 0.9% surcharge component is zero here, so half of
          the whole tax is deductible).
        </li>
        <li>
          SEHI deduction: the {usd(BIGTECH.healthPremium, 0)} premium is fully deductible — the cap (
          {'92.35% × net − ½SE'} = {usd(bigSeBase - exBig.c1099.halfSeTax, 0)}) is nowhere near binding.
        </li>
        <li>
          QBI: the base is {usd(exBig.c1099.netSE, 0)} − {usd(exBig.c1099.halfSeTax)} −{' '}
          {usd(exBig.c1099.sehiDeduction, 0)} = {usd(bigQbiBase, 0)}, but the deduction is capped at{' '}
          {pct(PAYTYPE_CONSTANTS.qbiRate * 100, 0)} of taxable income <em>before</em> it —{' '}
          {usd(bigQbiCap)} &lt; {usd(bigQbiBase * PAYTYPE_CONSTANTS.qbiRate)}, so the cap binds and QBI ={' '}
          {usd(exBig.c1099.qbiDeduction)}.
        </li>
        <li>
          Taxable income: {usd(bigQbiBase, 0)} − {usd(PAYTYPE_CONSTANTS.stdDeduction, 0)} −{' '}
          {usd(exBig.c1099.qbiDeduction)} = {usd(exBig.c1099.taxableIncome, 0)} → income tax{' '}
          {usd(exBig.c1099.incomeTax)} — again <em>below</em> the employee&apos;s {usd(exBig.w2.incomeTax)} despite{' '}
          {usd(exBig.c1099.revenue - exBig.w2.salary, 0)} more gross.
        </li>
        <li>
          Value kept: {usd(exBig.c1099.revenue, 0)} − {usd(exBig.c1099.expenses, 0)} −{' '}
          {usd(exBig.c1099.seTax)} − {usd(exBig.c1099.incomeTax)} = <strong>{usd(exBig.c1099.valueKept, 0)}</strong>.
        </li>
      </ol>
      <p>
        <strong>Verdict.</strong> The contract wins by {usd(exBig.deltaAnnual, 0)}/yr at the quoted{' '}
        {usd(BIGTECH.contractRate)}/hr. The tie point is {usd(exBigBe)}/hr — a +{pct(exBigMarkup, 1)} premium
        over the {usd(w2Hourly(BIGTECH.salary))}/hr salary equivalent — and the quote reads back as a{' '}
        {usdCompact(exBigEquiv)} W-2 salary with the same benefits. Note how little the requirement moved from
        the $100k default ({pct(demoMarkup, 1)} → {pct(exBigMarkup, 1)}): a richer package adds benefits, but a
        bigger salary dilutes them, and the two effects roughly cancel.
      </p>

      <h2 id="worked-example-startup">A third worked example: the $110,000 lean startup</h2>
      <p>
        The opposite corner — the widget&apos;s <em>Lean startup</em> preset: an {usd(STARTUP.salary, 0)} salary
        with only a {usd(STARTUP.healthPremium, 0)} health plan ({numFmt(STARTUP.ptoDays)} PTO days, no match, no
        other benefits), against a {usd(STARTUP.contractRate)}/hr quote with {usd(STARTUP.seExpenses, 0)} of
        expenses.
      </p>
      <p><strong>The employee side:</strong> FICA{' '}
        {pct((PAYTYPE_CONSTANTS.ssRate + PAYTYPE_CONSTANTS.medicareRate) * 100, 2)} × {usd(STARTUP.salary, 0)} ={' '}
        {usd(exStart.w2.fica)}; taxable income {usd(exStart.w2.taxableIncome, 0)} → income tax{' '}
        {usd(exStart.w2.incomeTax)}; cash after tax {usd(exStart.w2.cashAfterTax, 0)}; plus{' '}
        {usd(exStart.w2.benefits, 0)} of benefits for a total value kept of{' '}
        <strong>{usd(exStart.w2.totalValue, 0)}</strong>.
      </p>
      <p><strong>The contractor side:</strong></p>
      <ol>
        <li>
          {numFmt(exStart.c1099.hours)} billable hours (2,080 − 80) × {usd(STARTUP.contractRate)} ={' '}
          {usd(exStart.c1099.revenue, 0)} of revenue; net {usd(exStart.c1099.netSE, 0)} after{' '}
          {usd(exStart.c1099.expenses, 0)} of expenses; SE base {usd(startSeBase)} — far under the wage base —
          so SE tax is {pct(PAYTYPE_CONSTANTS.seRate * 100, 1)} × {usd(startSeBase)} ={' '}
          {usd(exStart.c1099.seTax)}, half of it ({usd(exStart.c1099.halfSeTax)}) deductible.
        </li>
        <li>
          SEHI: the full {usd(exStart.c1099.sehiDeduction, 0)} premium is deductible (cap room is ample).
        </li>
        <li>
          QBI: base {usd(startQbiBase, 0)}, capped at {usd(startQbiCap)} (the cap binds again) → deduction{' '}
          {usd(exStart.c1099.qbiDeduction)}; taxable income {usd(exStart.c1099.taxableIncome, 0)} → income tax{' '}
          {usd(exStart.c1099.incomeTax)} — just {usd(exStart.w2.incomeTax - exStart.c1099.incomeTax)} under the
          employee&apos;s despite {usd(exStart.c1099.revenue - exStart.w2.salary, 0)} more gross pay.
        </li>
        <li>
          Value kept: {usd(exStart.c1099.revenue, 0)} − {usd(exStart.c1099.expenses, 0)} −{' '}
          {usd(exStart.c1099.seTax)} − {usd(exStart.c1099.incomeTax)} ={' '}
          <strong>{usd(exStart.c1099.valueKept, 0)}</strong>.
        </li>
      </ol>
      <p>
        <strong>Verdict.</strong> The contract wins by {usd(exStart.deltaAnnual, 0)}/yr, and the tie point
        collapses to {usd(exStartBe)}/hr — only +{pct(exStartMarkup, 1)} over the{' '}
        {usd(w2Hourly(STARTUP.salary))}/hr salary equivalent, because there is almost no package to replace. The
        quote is worth a {usdCompact(exStartEquiv)} salary. And this is where the rule of thumb misprices in
        the other direction: 1.3× lands at {usd(startRule13)}/hr, already{' '}
        {usd(startRule13 - exStartBe)} above the computed floor, while the actual quote carries a{' '}
        {usd(startQuoteMargin)}/hr margin — a {pct((startQuoteMargin / exStartBe) * 100, 0)} risk buffer on
        top of the tie point.
      </p>

      <h2 id="markup">Breakeven markup — and where the 1.3–1.5× rule of thumb goes wrong</h2>
      <p>
        At these defaults the tie point is <strong>{usd(demoBe)}/hr</strong> — a{' '}
        <strong>+{pct(demoMarkup, 1)}</strong> premium over the {usd(w2Hourly(demo.w2.salary))}/hr salary
        equivalent. In other words, the contractor matches the whole package at a markup of roughly a quarter —
        under the conventional 30–50% at this salary level.
      </p>
      <p>Where the folklore goes wrong — in both directions:</p>
      <ul>
        <li>
          <strong>It usually double-counts taxes.</strong> It stacks &ldquo;both halves of FICA&rdquo; on top of
          a rate that already reflects income tax, forgetting the half-SE deduction, QBI, and the fact that the
          salary side pays income tax too.
        </li>
        <li>
          <strong>It ignores what benefits are actually worth — and that worth scales with the salary
          conversation.</strong> At a $100k salary the requirement swings from {pct(noneAt100k, 1)} with no
          benefits at all to {pct(richAt100k, 1)} under a rich package; that same rich package needs only{' '}
          {pct(richAt150k, 1)} at $150k (the worked examples above show real packages at both salaries).
        </li>
        <li>
          <strong>It undershoots at the low end.</strong> A small salary under a rich package is the
          rule of thumb&apos;s own worst case: at $60k the requirement is {pct(richAt60k, 1)} — past even 1.5× —
          because $16k of benefits and 20 PTO days loom large against a modest salary. The rule-of-thumb range
          is a band whose edges both miss; the honest number is salary- and package-specific.
        </li>
        <li>
          <strong>It is directionally right about risk.</strong> This model assumes every non-PTO hour is
          billable. Real contracts have bench time, sales cycles, late payments and self-funded retirement. The
          honest way to price that is a margin on top of the computed floor — or the{' '}
          <a href="/freelance-hourly-rate-calculator/">Freelance Hourly Rate Calculator</a>, which prices a
          billable ratio explicitly instead of assuming one.
        </li>
      </ul>
      <p>
        Reading the same result from the other side: the {usd(PAYTYPE_DEFAULTS.contractRate)}/hr quote is worth a{' '}
        <strong>{usdCompact(demoEquiv)} W-2 salary</strong> with the same benefits — {usd(demoEquiv, 0)} against
        the {usd(demo.w2.salary, 0)} on the table.
      </p>

      <h2 id="boundaries">Decision boundaries</h2>
      <p>
        This instrument answers one shaped question: a full-year engagement, federal tax year 2025, single
        filer, every non-PTO hour billable, and classification legally available (the next section). Outside
        that shape its floors stop being floors: when bench time and a billable ratio dominate the economics,
        this tool&apos;s floor is not your rate, and when the question is entity structure rather than pay
        type, the <a href="/s-corp-tax-calculator/">S-Corp Salary Calculator</a> is the right instrument.
        Married-filing-jointly brackets, a mid-year pay-type switch (the SEHI deduction counts only months
        without employer-plan eligibility), a combined wages-plus-self-employment year (Form 8959 Part V
        starts the 0.9% surcharge on <em>combined</em> income before either source alone crosses its
        threshold), and state income tax are all outside the model — fold the last one in before quoting in a
        high-tax state.
      </p>
      <p>
        The critical values below come from $1-step scans of this page&apos;s engine — <code>lib/paytype.ts</code>{' '}
        compiled and run offline, the same functions the widget calls. Each flip point is the first whole
        dollar at which the new condition holds; the last dollar of the old regime is one less.
      </p>
      <table>
        <thead>
          <tr>
            <th>Boundary</th>
            <th>Where it sits</th>
            <th>What flips</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>SE tax exists at all</td>
            <td>{usd(SCAN.seFloorNet, 0)} of net profit</td>
            <td>
              92.35% × net first reaches the $400 Schedule SE floor ({usd(400, 0)} ÷{' '}
              {pct(PAYTYPE_CONSTANTS.seBaseFactor * 100, 2)} = {usd(400 / PAYTYPE_CONSTANTS.seBaseFactor)});
              below it the contractor pays income tax only and the two sides nearly converge.
            </td>
          </tr>
          <tr>
            <td>Employee Social Security stops</td>
            <td>{numFmt(PAYTYPE_CONSTANTS.ssWageBase, 0)} of wages</td>
            <td>
              Marginal employee FICA drops from {numFmt(cents.w2Below, 2)}¢ to {numFmt(cents.w2Above, 2)}¢ per
              dollar (plus {numFmt(cents.w2Addl, 2)}¢ above{' '}
              {usd(PAYTYPE_CONSTANTS.addlMedicareThreshold, 0)} of wages).
            </td>
          </tr>
          <tr>
            <td>Contractor Social Security stops</td>
            <td>{numFmt(SCAN.ssCapNet, 0)} of net profit</td>
            <td>
              The SE base (92.35% of net) reaches the same {numFmt(PAYTYPE_CONSTANTS.ssWageBase, 0)} cap —{' '}
              {numFmt(SCAN.ssCapNet - PAYTYPE_CONSTANTS.ssWageBase, 0)} of net profit later than the employee&apos;s
              wage threshold — and marginal SE cost drops from {numFmt(cents.seBelow, 2)}¢ to{' '}
              {numFmt(cents.seAbove, 2)}¢.
            </td>
          </tr>
          <tr>
            <td>Additional Medicare Tax starts</td>
            <td>
              {usd(PAYTYPE_CONSTANTS.addlMedicareThreshold, 0)} wages / {numFmt(SCAN.addlMedicareNet, 0)} net
            </td>
            <td>
              +{numFmt(cents.w2Addl, 2)}¢ (wages) or +{numFmt(cents.seAddl, 2)}¢ (SE) per dollar — the same
              0.9% on both sides, and §164(f) gives it no half deduction on either.
            </td>
          </tr>
          <tr>
            <td>Pure tax gap turns negative</td>
            <td>{numFmt(SCAN.noBenefitsFirstNegative, 0)} salary, zero-benefit package</td>
            <td>
              The breakeven rate falls below salary ÷ 2,080 — see the caveat in the next paragraph.
            </td>
          </tr>
        </tbody>
      </table>
      <p>
        <strong>Where the 30–50% band is literally correct.</strong> Holding a package fixed and moving only
        the salary, the required markup falls through 50% at a salary of {usd(defaultPkg50, 0)} and through 30%
        at {usd(defaultPkg30, 0)} under the default package; under the rich package the same crossings land at{' '}
        {usd(richPkg50, 0)} and {usd(richPkg30, 0)}. That is the rule of thumb&apos;s honest domain: between
        those salaries the 30–50% band is roughly right, and outside it both edges miss — above the band the
        30% minimum overcharges (the lean-startup example needs only {pct(exStartMarkup, 1)}), below it even
        the 50% maximum undershoots (a rich package at $60k needs {pct(richAt60k, 1)}).
      </p>
      <p>
        <strong>The pure tax gap is a wash — with a hump in the middle.</strong> Strip the comparison to zero
        benefits, zero PTO and zero expenses and the whole pay-type difference collapses to SE-tax drag minus
        the QBI and half-SE claw-backs: {pct(gapAt50k, 1)} at a $50k salary, {pct(gapAt100k, 1)} at $100k. It
        briefly <em>rises</em> — from {pct(gapAtWageBase, 2)} right at the{' '}
        {numFmt(PAYTYPE_CONSTANTS.ssWageBase, 0)} wage base to {pct(gapAt188k, 2)} at $188k — inside the window
        where the employee&apos;s 6.2% has ended but the contractor&apos;s 12.4% runs on to{' '}
        {numFmt(SCAN.ssCapNet, 0)} of net. Above {numFmt(SCAN.noBenefitsFirstNegative, 0)} it turns negative,
        reaching {pct(gapAt400k, 1)} at $400k: the contract would tie the job at a rate below salary ÷ 2,080.
        Treat that region carefully — it is manufactured by the QBI deduction, and the §199A limits that would
        erode it at high incomes are outside this model (see the caveats). The honest reading is &ldquo;at high
        salaries with no benefits, taxes alone are close to a wash,&rdquo; not &ldquo;contractors should quote
        below their salary equivalent.&rdquo;
      </p>
      <p>
        <strong>The benefits floor at the bottom.</strong> The equivalent-salary readout has its own cliff:
        below {usd(benefitsCliffRate)}/hr the contract cannot out-earn the {usd(benefitsTotal, 0)} face value
        of the default benefits, so the solver reports the quote as worth a $0 salary rather than a negative
        one. Quotes in that region are not negotiations against this job — they are different jobs.
      </p>

      <h2 id="misclassification">The misclassification boundary</h2>
      <p>
        Everything above assumes the choice of pay type is yours to make. Often it is not: worker classification
        is a <strong>legal test applied to the working relationship</strong>, and relabeling an employee as a
        contractor does not survive contact with it. Three frameworks matter:
      </p>
      <ul>
        <li>
          <strong>The IRS common-law test</strong> (the one behind employment taxes) asks who controls the work:
          behavioral control (how, when, where, with what tools and training), financial control (who has
          unreimbursed expenses, investment, and a genuine opportunity for profit or loss, and how the worker is
          paid), and the relationship&apos;s shape (written contracts, benefits, permanence, whether the work is
          core to the business). No single factor decides; the totality does.
        </li>
        <li>
          <strong>The DOL wage-and-hour test</strong> has see-sawed between administrations: the 2024 rule&apos;s
          six-factor &ldquo;economic reality&rdquo; test was announced as non-enforced in May 2025 with a
          rescission proposed, leaving earlier multifactor economic-reality guidance operative — as of this
          writing the federal framework here is genuinely in flux, so verify the current rule rather than
          quoting any one factor list.
        </li>
        <li>
          <strong>State ABC tests</strong> (California under AB5/Dynamex, New Jersey, Massachusetts and others)
          presume employment unless all three prongs hold — and the B prong (&ldquo;the work is outside the
          usual course of the hiring entity&apos;s business&rdquo;) disqualifies most in-house specialists
          outright. In ABC states, a full-time embedded contractor arrangement is often simply illegal.
        </li>
      </ul>
      <p>
        <strong>What reclassification costs.</strong> If the relationship is recharacterized as employment, the
        hiring business generally owes back employment taxes — both FICA halves, plus penalties and interest —
        and can owe back benefits and overtime under wage-and-hour law. Businesses get partial protection from
        IRS Section 530 safe harbor if they had a reasonable basis for the classification, treated similar
        workers consistently, and filed the required 1099s. Workers who believe they were misclassified can ask
        the IRS for a determination (Form SS-8) and, with a reasonable basis, pay only their employee share of
        FICA via Form 8919 rather than full SE tax.
      </p>
      <p>
        The honest summary for pricing: the tax math above tells you what the contract is worth{' '}
        <em>to you</em>; the classification tests tell you whether the arrangement can exist at all. A real
        contractor engagement looks like multiple clients, your own tools and methods, deliverable-based
        pricing, profit-and-loss exposure, and a defined end — not an employee&apos;s calendar with an invoice
        attached.
      </p>

      <h2 id="negotiation">Negotiating from the numbers</h2>
      <ol>
        <li>
          <strong>Anchor on the employer&apos;s all-in cost.</strong> The default package costs the employer{' '}
          {usd(employerCost, 0)}/yr ({usd(loadedHourly)}/hr loaded) once you add their 7.65% FICA share and the
          benefits. Any contract priced below that saves them money on day one.
        </li>
        <li>
          <strong>Set your floor at the computed breakeven, not a rule-of-thumb multiplier.</strong> At the defaults that
          is {usd(demoBe)}/hr. Below it you are funding the client&apos;s flexibility out of your own pocket.
        </li>
        <li>
          <strong>Add a risk margin on top of the floor</strong> — typically 10–20% — for bench time between
          contracts, payment delay (net-30+ is a loan you extend), and the retirement account nobody funds for
          you. Note where a 1.3× multiplier of {usd(w2Hourly(demo.w2.salary) * 1.3)} sits: above the computed
          floor of {usd(demoBe)}/hr, but below a floor-plus-15% quote of {usd(demoBe * 1.15)}/hr — the rule of
          thumb is roughly a floor plus a thin margin, bundled into one number.
        </li>
        <li>
          <strong>Trade rate for terms, knowingly.</strong> A deposit, net-15 terms, a scope-change rate, or a
          minimum-hours guarantee is worth real money at the same headline rate — a contract at the floor with
          net-15 and a deposit often beats a higher rate with net-60.
        </li>
        <li>
          <strong>If the client insists on W-2</strong>, a staffing-agency conversion typically costs 20–30% of
          the rate — run this tool with the agency&apos;s salary offer to see which side of the table that fee
          actually lands on.
        </li>
      </ol>

      <h2 id="glossary">Glossary</h2>
      <p>
        The vocabulary of the 1099-versus-W-2 decision in the sense this guide uses it — written for a reader
        meeting these terms for the first time.
      </p>
      <dl className="mb-4">
        <dt className="mt-5 font-semibold text-slate-900 dark:text-slate-100">W-2</dt>
        <dd className="mt-1 leading-relaxed text-slate-600 dark:text-slate-300">
          The IRS form employers file for wages paid. &ldquo;Being a W-2&rdquo; is shorthand for employee
          status: taxes withheld from each paycheck, the employer paying half of payroll tax, and eligibility
          for the benefits package.
        </dd>
        <dt className="mt-5 font-semibold text-slate-900 dark:text-slate-100">1099-NEC</dt>
        <dd className="mt-1 leading-relaxed text-slate-600 dark:text-slate-300">
          The information return a business files for nonemployee compensation of $600 or more. &ldquo;Being a
          1099&rdquo; is shorthand for self-employed: no withholding, both halves of payroll tax as SE tax, and
          no benefits unless you buy them yourself.
        </dd>
        <dt className="mt-5 font-semibold text-slate-900 dark:text-slate-100">FICA</dt>
        <dd className="mt-1 leading-relaxed text-slate-600 dark:text-slate-300">
          The payroll tax that funds Social Security and Medicare: {' '}
          {pct((PAYTYPE_CONSTANTS.ssRate + PAYTYPE_CONSTANTS.medicareRate) * 100, 2)} on wages —{' '}
          {pct(PAYTYPE_CONSTANTS.ssRate * 100, 1)} Social Security up to the{' '}
          {numFmt(PAYTYPE_CONSTANTS.ssWageBase, 0)} wage base plus {pct(PAYTYPE_CONSTANTS.medicareRate * 100, 2)}{' '}
          Medicare on all wages — with the employer paying a matching half that never appears in the
          employee&apos;s take-home.
        </dd>
        <dt className="mt-5 font-semibold text-slate-900 dark:text-slate-100">Self-employment (SE) tax</dt>
        <dd className="mt-1 leading-relaxed text-slate-600 dark:text-slate-300">
          The contractor&apos;s version of FICA, computed on Schedule SE:{' '}
          {pct(PAYTYPE_CONSTANTS.seRate * 100, 1)} on {pct(PAYTYPE_CONSTANTS.seBaseFactor * 100, 2)} of net
          business earnings — both halves at once — with the 12.4% Social Security layer capped at the wage
          base and the 2.9% Medicare layer uncapped.
        </dd>
        <dt className="mt-5 font-semibold text-slate-900 dark:text-slate-100">One-half SE tax deduction (§164(f))</dt>
        <dd className="mt-1 leading-relaxed text-slate-600 dark:text-slate-300">
          An above-the-line deduction for half of SE tax, mirroring the employer half an employee never pays.
          It lowers income tax only — never SE tax itself — and the 0.9% Additional Medicare component gets no
          half deduction at all.
        </dd>
        <dt className="mt-5 font-semibold text-slate-900 dark:text-slate-100">
          Self-employed health insurance deduction (§162(l))
        </dt>
        <dd className="mt-1 leading-relaxed text-slate-600 dark:text-slate-300">
          An above-the-line deduction for the health premiums a self-employed person pays, capped at net
          earnings from self-employment (92.35% of profit minus half of SE tax). It applies only in months you
          are not eligible for any employer&apos;s plan.
        </dd>
        <dt className="mt-5 font-semibold text-slate-900 dark:text-slate-100">QBI deduction (§199A)</dt>
        <dd className="mt-1 leading-relaxed text-slate-600 dark:text-slate-300">
          20% of qualified business income (net profit less the half-SE and health-insurance deductions),
          capped at 20% of taxable income before the deduction. For specified service businesses — consulting,
          law, health, financial services — it phases out above $197,300 of taxable income.
        </dd>
        <dt className="mt-5 font-semibold text-slate-900 dark:text-slate-100">Social Security wage base</dt>
        <dd className="mt-1 leading-relaxed text-slate-600 dark:text-slate-300">
          The {numFmt(PAYTYPE_CONSTANTS.ssWageBase, 0)} ceiling (2025) on the 12.4% layer of payroll tax. On
          wages it applies directly; on self-employment it applies to the 92.35% base, so the contractor&apos;s
          12.4% layer runs until {numFmt(SCAN.ssCapNet, 0)} of net profit.
        </dd>
        <dt className="mt-5 font-semibold text-slate-900 dark:text-slate-100">Additional Medicare Tax (Form 8959)</dt>
        <dd className="mt-1 leading-relaxed text-slate-600 dark:text-slate-300">
          A {pct(PAYTYPE_CONSTANTS.addlMedicareRate * 100, 1)} surcharge above{' '}
          {usd(PAYTYPE_CONSTANTS.addlMedicareThreshold, 0)} of wages for employees, or above{' '}
          {numFmt(SCAN.addlMedicareNet, 0)} of net profit for the self-employed (the same $200,000 threshold
          applied to the 92.35% SE base). Deductible nowhere.
        </dd>
        <dt className="mt-5 font-semibold text-slate-900 dark:text-slate-100">Breakeven contract rate</dt>
        <dd className="mt-1 leading-relaxed text-slate-600 dark:text-slate-300">
          The hourly rate at which the contract&apos;s total value kept exactly ties the W-2 package&apos;s —
          the &ldquo;charge at least this&rdquo; number. The engine finds it by bisection, because value kept
          rises smoothly with the rate while the package stays fixed.
        </dd>
        <dt className="mt-5 font-semibold text-slate-900 dark:text-slate-100">Equivalent W-2 salary</dt>
        <dd className="mt-1 leading-relaxed text-slate-600 dark:text-slate-300">
          The same comparison run backwards: the salary (with the same benefits) worth exactly as much as the
          quoted contract rate. It reads zero when the quote cannot even out-earn the benefits&apos; face
          value.
        </dd>
        <dt className="mt-5 font-semibold text-slate-900 dark:text-slate-100">Fully-loaded cost</dt>
        <dd className="mt-1 leading-relaxed text-slate-600 dark:text-slate-300">
          What the employer actually spends on the employee: salary plus the employer&apos;s 7.65% FICA share
          plus benefits at face — {usd(employerCost, 0)}/yr ({usd(loadedHourly)}/hr) for this page&apos;s
          default package. The correct anchor when pricing a contract to a buyer.
        </dd>
      </dl>

      <h2 id="caveats">Important caveats</h2>
      <ul>
        <li>Federal, single-filer, tax-year 2025 model: {usd(PAYTYPE_CONSTANTS.stdDeduction, 0)} standard deduction, {numFmt(PAYTYPE_CONSTANTS.ssWageBase, 0)} wage base. No state income tax, state disability, or local taxes.</li>
        <li>
          Benefits are valued at face. Employer-paid health premiums are indeed tax-free, but a 401(k) match is
          tax-deferred rather than tax-free — face value slightly favors the W-2 side.
        </li>
        <li>
          The self-employed health insurance deduction applies only in months you are not eligible for any
          employer plan — switching mid-year changes it.
        </li>
        <li>
          SSTB QBI phase-outs above $197,300 of taxable income (consultants, health, law, financial services)
          are not modeled; above that line the 1099 side&apos;s advantage shrinks.
        </li>
        <li>
          The model bills every non-PTO hour. Marketing, sales and admin time are priced by the{' '}
          <a href="/freelance-hourly-rate-calculator/">Freelance Hourly Rate Calculator</a>, not here.
        </li>
        <li>Nothing here is tax or legal advice. Classification in particular is a facts-and-circumstances legal question — confirm with a qualified professional.</li>
      </ul>

      <Faq
        items={[
          {
            question: 'How much should a 1099 rate exceed my W-2 salary, as a rule of thumb?',
            answer: (
              <p>
                There is no universal multiplier — it depends on the salary level, the benefits package, PTO,
                and your expenses. At a $100k salary the full 2025 federal math runs {pct(noneAt100k, 1)} with
                no benefits at all (the QBI and half-SE deductions almost cancel the SE-tax drag),{' '}
                {pct(demoMarkup, 1)} on the default package, and {pct(richAt100k, 1)} under a rich one. That
                same rich package needs only {pct(richAt150k, 1)} at $150k — but {pct(richAt60k, 1)} at $60k.
                Run your actual package above, then add a 10–20% risk margin for bench time and payment delay
                rather than quoting a rule of thumb.
              </p>
            ),
          },
          {
            question: "Doesn't the employer 'paying half' of FICA make W-2 free money?",
            answer: (
              <p>
                Economically the employer half is part of your total cost of employment — money that could
                otherwise be salary. But it never reaches your W-2 take-home, so for a take-home comparison it
                is correctly excluded here. It reappears in the negotiation section as part of the
                employer&apos;s all-in cost, which is the right anchor for pricing a contract.
              </p>
            ),
          },
          {
            question: 'Can my employer just switch me to 1099 if I prefer it?',
            answer: (
              <p>
                No — classification follows the working relationship, not preference. If the company controls
                how, when and where you work, provides tools, sets your schedule and the work is core to the
                business, the arrangement is employment regardless of the paperwork. Relabeling it creates back
                taxes and penalties for the business. Genuine contractor engagements need real autonomy,
                typically multiple clients, and profit-and-loss exposure.
              </p>
            ),
          },
          {
            question: 'What are Form SS-8 and Form 8919?',
            answer: (
              <p>
                SS-8 is the IRS determination request a worker files to have a working relationship officially
                classified. Form 8919 lets a worker who reasonably believes they were misclassified pay only
                the employee share of Social Security and Medicare instead of the full self-employment tax —
                with the employer then on the hook for the rest if the IRS agrees.
              </p>
            ),
          },
          {
            question: 'Why is my computed markup lower than the 1.3×–1.5× I have been told?',
            answer: (
              <p>
                Because the folklore double-counts. It stacks both FICA halves on top of a number that already
                carries income tax, and ignores the half-SE deduction, the 20% QBI deduction, and the fact that
                benefits are worth their face value rather than some inflated multiple. The computed floor is
                the honest tie point; the extra 10–20% you add on top is where bench time, late payments and
                risk belong.
              </p>
            ),
          },
          {
            question: 'Does the calculator handle state taxes or HSA accounts?',
            answer: (
              <p>
                No. It is a federal single-filer 2025 model. State income tax would narrow the gap roughly
                proportionally on both sides; state disability and unemployment insurance, HSA contributions
                and elective 401(k) deferrals are outside the model. Fold recurring extras into the benefits
                and expenses inputs as face-value dollars.
              </p>
            ),
          },
          {
            question: 'Why does the contractor pay LESS income tax than the employee in the examples?',
            answer: (
              <p>
                Two deductions do it: the half-SE deduction ({usd(demo.c1099.halfSeTax)} at the defaults) and
                the QBI deduction ({usd(demo.c1099.qbiDeduction, 0)}), both subtracted before the brackets.
                Together they pull the contractor&apos;s taxable income down to {usd(demo.c1099.taxableIncome, 0)}{' '}
                against the employee&apos;s {usd(demo.w2.taxableIncome, 0)} — enough to drop the income-tax
                bill to {usd(demo.c1099.incomeTax)} from {usd(demo.w2.incomeTax)} despite{' '}
                {usd(demo.c1099.revenue - demo.w2.salary, 0)} more gross pay. The SE-tax line more than
                reclaims the difference; the income-tax line is why the total gap is so much smaller than
                &ldquo;both halves of FICA&rdquo; suggests.
              </p>
            ),
          },
          {
            question: 'What is each PTO day actually worth in the rate?',
            answer: (
              <p>
                Each PTO day removes 8 billable hours, so it must be re-earned through a higher rate across all
                remaining hours. At the defaults, moving from 0 to 40 PTO days lifts the required rate from{' '}
                {usd(ptoZero)}/hr to {usd(ptoMax)}/hr — roughly a quarter per hour per day. The default 15 days
                are already priced into the {usd(demoBe)}/hr floor.
              </p>
            ),
          },
          {
            question: 'How do business expenses change the required rate?',
            answer: (
              <p>
                Rate-wise, a deductible expense costs exactly its share of an hour: at the defaults, $0 of
                expenses needs {usd(expNone)}/hr while $10,000 needs {usd(expHeavy)}/hr —{' '}
                {usd(expPerThousand)} per $1,000, essentially $1,000 ÷{' '}
                {numFmt(billableHours(PAYTYPE_DEFAULTS.ptoDays))} billable hours. The tax gross-up you would
                expect never appears, because the expense and the extra billing that re-earns it travel the
                same Schedule C pipe at the same marginal SE and income-tax rates — the two effects cancel,
                and each deductible dollar buys back one dollar of pre-tax billing.
              </p>
            ),
          },
          {
            question: 'What is the self-employed health insurance deduction actually worth?',
            answer: (
              <p>
                At the defaults, the {usd(PAYTYPE_DEFAULTS.healthPremium, 0)} premium produces a{' '}
                {usd(sehiWith.sehiDeduction, 0)} above-the-line deduction worth {usd(sehiTaxValue, 0)} of
                income tax (the engine run with and without it: {usd(sehiWithout.incomeTax)} versus{' '}
                {usd(sehiWith.incomeTax)}). It also trims the QBI deduction by{' '}
                {usd(sehiWithout.qbiDeduction - sehiWith.qbiDeduction, 0)}, since the §199A base sits behind it
                — both effects are already inside every number on this page.
              </p>
            ),
          },
          {
            question: 'What changes once income passes the Social Security wage base?',
            answer: (
              <p>
                Marginal payroll cost drops on both sides, but at different points: the employee&apos;s falls
                from {numFmt(cents.w2Below, 2)}¢ to {numFmt(cents.w2Above, 2)}¢ per dollar above{' '}
                {numFmt(PAYTYPE_CONSTANTS.ssWageBase, 0)} of wages, while the contractor&apos;s falls from{' '}
                {numFmt(cents.seBelow, 2)}¢ to {numFmt(cents.seAbove, 2)}¢ only above{' '}
                {numFmt(SCAN.ssCapNet, 0)} of net profit. Between those two points the gap briefly widens in
                the employee&apos;s favor — one reason the big-tech example still needs a +{pct(exBigMarkup, 1)}{' '}
                markup.
              </p>
            ),
          },
          {
            question: 'When does the 0.9% Additional Medicare Tax start?',
            answer: (
              <p>
                Above {usd(PAYTYPE_CONSTANTS.addlMedicareThreshold, 0)} of wages for the employee, or above{' '}
                {numFmt(SCAN.addlMedicareNet, 0)} of net profit for the contractor — the same $200,000
                threshold applied to the 92.35% SE base. Both sides pay it, and neither gets a deduction for
                it: §164(f) excludes the surcharge from the half-SE deduction.
              </p>
            ),
          },
          {
            question: 'What salary is my quoted rate worth?',
            answer: (
              <p>
                Run the equivalent-salary readout: at the default package, {usd(50)}/hr is worth a{' '}
                {usdCompact(eqAt50)} salary, {usd(75)}/hr a {usdCompact(eqAt75)}, and {usd(100)}/hr a{' '}
                {usdCompact(eqAt100)} — all with the same benefits attached. It is the cleanest way to compare
                a contract quote against a concurrent offer that is denominated in salary.
              </p>
            ),
          },
          {
            question: 'Can the 1099 side ever win at a rate BELOW salary ÷ 2,080?',
            answer: (
              <p>
                Surprisingly, yes — at high salaries with no benefits at all. The pure tax gap (SE drag minus
                the QBI and half-SE claw-backs) turns negative above{' '}
                {numFmt(SCAN.noBenefitsFirstNegative, 0)} of salary, reaching {pct(gapAt400k, 1)} at $400k.
                Before relying on that, remember the model never phases the QBI deduction out (see the SSTB
                question below) — and real offers at that level always carry benefits.
              </p>
            ),
          },
          {
            question: 'Does going 1099 make sense against a rich big-tech package?',
            answer: (
              <p>
                Only above {usd(exBigBe)}/hr. The widget&apos;s big-tech preset — $150k salary under a rich
                package — ties at {usd(exBigBe)}/hr, a +{pct(exBigMarkup, 1)} markup, and the{' '}
                {usd(BIGTECH.contractRate)}/hr quote reads back as a {usdCompact(exBigEquiv)} salary; the second
                worked example above walks the full ledger. Rich packages raise the floor less than the rule of
                thumb expects because a big salary dilutes them.
              </p>
            ),
          },
          {
            question: 'What about a lean startup offer with almost no benefits?',
            answer: (
              <p>
                The floor collapses: the widget&apos;s lean-startup preset ($110k salary, a{' '}
                {usd(STARTUP.healthPremium, 0)}-premium health plan, no match) ties at just {usd(exStartBe)}/hr
                — +{pct(exStartMarkup, 1)} over the {usd(w2Hourly(STARTUP.salary))}/hr salary equivalent. The
                third worked example above carries the full comparison; the short version is that thin benefits
                are the contractor&apos;s best case.
              </p>
            ),
          },
          {
            question: 'I work a trade at a modest salary — does any of this still apply?',
            answer: (
              <p>
                Yes, with the package doing the work. The widget&apos;s SMB preset ($65k salary,{' '}
                {usd(SMB_PRESET.healthPremium, 0)} health plan, {usd(SMB_PRESET.retirementMatch, 0)} match) ties
                at {usd(smbBe)}/hr — a +{pct(smbMarkup, 1)} markup — and its {usd(SMB_PRESET.contractRate)}/hr
                quote wins by {usd(smbRes.deltaAnnual, 0)}/yr, worth a {usdCompact(smbEquiv)} salary. Benefits
                loom large against a modest salary, which is exactly where underpricing a contract hurts most.
              </p>
            ),
          },
          {
            question: 'What rate do I need to beat the job by a specific amount?',
            answer: (
              <p>
                At the defaults, clearing the W-2 package by $5,000/yr takes {usd(beat5k)}/hr, by $10,000{' '}
                {usd(beat10k)}/hr, and by $20,000 {usd(beat20k)}/hr — the same {usd(beat5k - demoBe)} of rate
                per $5,000 tranche at every step ({usd(beat20k - beat10k)} for the $10,000 jump, exactly twice
                as much for twice the target). The slope is flat because every extra billed dollar arrives net
                of SE and income tax at a steady marginal rate, so margin scales linearly. The first{' '}
                {usd(demoBe)}/hr only achieves parity; everything you actually want has to be quoted above it.
              </p>
            ),
          },
          {
            question: 'Why does the model bill 1,960 hours a year, not 2,080?',
            answer: (
              <p>
                2,080 is the paid-hours basis of a salary (40 × 52); the contractor sells only{' '}
                {numFmt(billableHours(PAYTYPE_DEFAULTS.ptoDays))} because the default 15 PTO days are unpaid
                there — each one is 8 hours you cannot invoice. Set PTO days to zero and both sides share the
                same 2,080-hour basis.
              </p>
            ),
          },
          {
            question: "What if I can't realistically bill every non-PTO hour?",
            answer: (
              <p>
                Then this tool understates the rate you need: it prices a full billable year, and every 100
                unbilled hours at the default {usd(PAYTYPE_DEFAULTS.contractRate)}/hr quote is{' '}
                {usd(100 * PAYTYPE_DEFAULTS.contractRate, 0)} of revenue that never arrives. Bench time, sales
                cycles and admin need a billable-ratio model — the{' '}
                <a href="/freelance-hourly-rate-calculator/">Freelance Hourly Rate Calculator</a> — or a margin
                on top of the computed floor here.
              </p>
            ),
          },
          {
            question: 'Why does a very low quote show "worth a $0 W-2 salary"?',
            answer: (
              <p>
                Because the equivalent-salary solver bottoms out: below {usd(benefitsCliffRate)}/hr at the
                defaults, the contract&apos;s value kept cannot even out-earn the {usd(benefitsTotal, 0)} face
                value of the benefits package, so no positive salary matches it. A quote in that region is not
                a weaker version of the job — it is a different category of offer entirely.
              </p>
            ),
          },
          {
            question: 'I am married filing jointly — can I still use this?',
            answer: (
              <p>
                Directionally yes, numerically no: the brackets, standard deduction and surcharge thresholds
                here are all single-filer 2025 values. Joint filing generally lowers income tax on both sides,
                which slightly raises the breakeven markup; re-run the important decisions with joint numbers
                before quoting.
              </p>
            ),
          },
          {
            question: "I'm an SSTB consultant above the QBI phase-out — does the 1099 advantage survive?",
            answer: (
              <p>
                Partly. This model grants the full 20% QBI deduction at every income, but for specified service
                trades it phases out above $197,300 of taxable income (2025, single) and disappears entirely
                above the top of the range — and every dollar of deduction lost is a dollar taxed at your
                marginal bracket, which is 32% just above that phase-out. Expect the computed floor to sit
                visibly higher than this page reports. The{' '}
                <a href="/qbi-deduction-calculator/">QBI Deduction Calculator</a> prices the phase-out itself.
              </p>
            ),
          },
          {
            question: 'The client offers a W-2 contract through a staffing agency instead — is that the same as this job?',
            answer: (
              <p>
                It is a third pay type, not a tie: agency W-2 keeps employee withholding but typically swaps
                benefits for the agency&apos;s margin on the bill rate (the negotiation section above gives the
                typical range). Run this tool with the agency&apos;s salary offer and its thinner benefits to
                see which side of the table that margin lands on before accepting the conversion.
              </p>
            ),
          },
        ]}
      />

      <RelatedCalculators
        links={[
          { href: '/freelance-hourly-rate-calculator/', label: 'Freelance Hourly Rate Calculator' },
          { href: '/s-corp-tax-calculator/', label: 'S-Corp Salary Calculator' },
          { href: '/llc-vs-ccorp-tax-calculator/', label: 'LLC vs C-Corp Tax Calculator' },
        ]}
      />
    </article>
  );
}

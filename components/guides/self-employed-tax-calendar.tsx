import Link from 'next/link';
import { AlertTriangle, CalendarDays, CheckCircle2, Flag } from 'lucide-react';
import { ArticleToc } from '@/components/Article';
import {
  computeEstimatedTax,
  seTaxOf,
  EST_CONSTANTS,
  QUARTERS_2025,
  type QuarterlyInstallment,
} from '@/lib/estimated';
import { computeSeTax, quarterlySeInstallment } from '@/lib/setax';
import {
  solo401kCapacity,
  sepCapacity,
  deferralLimitFor,
  RETIREMENT_CONSTANTS,
} from '@/lib/retirement';
import { usd } from '@/lib/format';

/**
 * "The Self-Employed Tax Calendar" — guide body for /guides/self-employed-tax-calendar/.
 *
 * Renders inside GuideShell's .prose-article column (the shell supplies the h1
 * and the closing instrument panel), so this component starts at h2 and uses
 * bare semantic markup plus the site's callout-card vocabulary.
 *
 * Every dollar figure is computed at module scope by the same engines that
 * power the instruments (lib/estimated.ts, lib/setax.ts, lib/retirement.ts) —
 * nothing is hand-typed. The worked persona is $120,000 of net Schedule C
 * profit, single filer, no W-2 withholding, tax year 2025; the same inputs
 * were verified offline against these engines (tsc-compiled, node-run).
 */

/* ===== Persona A — $120k net SE income, prior-year tax unknown (90% line only) ===== */
const BASE = computeEstimatedTax({
  netSE: 120000,
  filingStatus: 'single',
  w2Withholding: 0,
  priorTax: null,
  priorAgiOver150k: false,
});

/* ===== Persona B — same income, prior-year total tax $22,000, prior AGI ≤ $150k (100% harbor) ===== */
const PRIOR100 = computeEstimatedTax({
  netSE: 120000,
  filingStatus: 'single',
  w2Withholding: 0,
  priorTax: 22000,
  priorAgiOver150k: false,
});

/* ===== Persona C — same income, prior AGI over $150k → the 110% harbor replaces 100% ===== */
const PRIOR110 = computeEstimatedTax({
  netSE: 120000,
  filingStatus: 'single',
  w2Withholding: 0,
  priorTax: 22000,
  priorAgiOver150k: true,
});

/* ===== Persona D — first year in business: prior-year tax was $0 → §6654(e)(2) exempt ===== */
const FIRST_YEAR = computeEstimatedTax({
  netSE: 120000,
  filingStatus: 'single',
  w2Withholding: 0,
  priorTax: 0,
  priorAgiOver150k: false,
});

/* SE tax layer, both engines at the same persona (2025 wage base $176,100):
 * lib/estimated's Schedule SE and lib/setax's year-parameterized model agree. */
const SE_DETAIL = seTaxOf(120000);
const SE_2025 = computeSeTax(120000, 0, 'single', 2025);
const SE_PER_QUARTER = quarterlySeInstallment(SE_2025.totalSeTax);
const INCOME_TAX_PER_QUARTER = BASE.incomeTax / 4;
/** The full quarterly cost of the year — total tax ÷ 4, BEFORE the 90% harbor
 *  discount. The installment at the 90% line is 90% of THIS figure, in the same
 *  SE/income mix — not a different decomposition (review finding: never pair the
 *  undiscounted SE share against the discounted installment). */
const FULL_COST_PER_QUARTER = BASE.currentTotalTax / 4;
const SE_SHARE_OF_TOTAL = (BASE.seTax / BASE.currentTotalTax) * 100;

/* Marginal SE tax per dollar of net profit below the wage base — 92.35% × 15.3%. */
const SE_CENTS_PER_DOLLAR = EST_CONSTANTS.seBaseFactor * EST_CONSTANTS.seRate * 100;
const SE_SS_CENTS = EST_CONSTANTS.seBaseFactor * 0.124 * 100;
const SE_MEDICARE_CENTS = EST_CONSTANTS.seBaseFactor * EST_CONSTANTS.medicareRate * 100;

/* Retirement capacity at the same $120k (2025 limits, sole-prop mode). */
const SOLO_40 = solo401kCapacity({ mode: 'sole-prop', income: 120000, age: 40, plannedDeferral: 23500 });
const SOLO_52 = solo401kCapacity({ mode: 'sole-prop', income: 120000, age: 52, plannedDeferral: deferralLimitFor(52) });
const SEP = sepCapacity('sole-prop', 120000);

/**
 * Penalty estimate for missing exactly ONE installment and settling at the
 * Apr 15 filing — the single-quarter slice of the engine's simplified model
 * (skipPenaltyEstimate prices all four): installment × 7% × days-to-Apr-15 ÷ 365.
 * Same labeled-estimate caveat as the engine: simple interest, flat 2025 rate.
 */
function missedInstallmentPenalty(perQuarter: number, daysToApr15Filing: number): number {
  return perQuarter * EST_CONSTANTS.penaltyRate * (daysToApr15Filing / 365);
}

const MISSED_90 = QUARTERS_2025.map((q) => ({
  label: q.label,
  due: q.due,
  days: q.daysToApr15Filing,
  penalty: missedInstallmentPenalty(BASE.perQuarter, q.daysToApr15Filing),
}));

/** The installment row shown for each harbor: label/due come from the engine. */
function installmentRows(perQuarter: number): QuarterlyInstallment[] {
  return QUARTERS_2025.map((q, i) => ({
    label: q.label,
    due: q.due,
    installment: perQuarter,
    cumulative: perQuarter * (i + 1),
  }));
}

export default function SelfEmployedTaxCalendar() {
  const toc = [
    { id: 'framework', label: 'The decision, stated first' },
    { id: 'calendar', label: 'The dates that run your year' },
    { id: 'harbor', label: 'Choose the safe harbor first' },
    { id: 'se-tax', label: 'Why SE tax dominates the installments' },
    { id: 'installments', label: 'The four installments, priced' },
    { id: 'penalty', label: 'What missing a quarter costs' },
    { id: 'december-31', label: 'December 31: the immovable deadline' },
    { id: 'last-two-weeks', label: 'The last two weeks of the year' },
    { id: 'january', label: 'January and the April wrap' },
    { id: 'decision-table', label: 'The year as one decision' },
    { id: 'scope', label: 'Scope & caveats' },
  ];

  return (
    <>
      <ArticleToc items={toc} />

      {/* ============================ Framework ============================ */}
      <h2 id="framework">The decision, stated first</h2>
      <p>
        Nobody withholds for you, and the IRS will not send a bill until the year is over — so the
        self-employed run their own payroll, four times a year, against a target they choose in
        advance. The whole calendar reduces to three decisions, and the rest of this guide is the
        arithmetic behind them:
      </p>
      <ol>
        <li>
          <strong>Pick your safe harbor before you compute anything.</strong> The required annual
          payment is the <em>lesser</em> of 90% of this year&apos;s tax or a floor built on last
          year&apos;s (100% of it, or 110% if last year&apos;s AGI exceeded $150,000) — IRC
          §6654(d)(1). Income rising? The prior-year floor lets you prepay less and settle the
          difference in April, penalty-free. Income falling? Take the 90% line and stop lending the
          IRS money. First year with zero prior-year tax? No penalty exposure at all.
        </li>
        <li>
          <strong>Pay four equal installments against that target.</strong> April 15, June 15,
          September 15, January 15 — shifted to the next business day when the 15th lands on a
          weekend. Missing one is priced like interest, not like a fine, and late January cures
          most of it.
        </li>
        <li>
          <strong>Protect December 31 hardest.</strong> It is the only deadline in the self-employed
          year with no extension: the solo 401(k) employee deferral bucket —{' '}
          {usd(RETIREMENT_CONSTANTS.employeeDeferralLimit, 0)} in 2025 — exists only if the plan
          exists and the election is made before the year closes. Almost everything else, including
          the entire SEP-IRA and the employer side of the solo 401(k), can be decided after the
          year ends, as late as the extended filing deadline.
        </li>
      </ol>
      <div className="my-8 rounded-2xl border border-indigo-100 bg-indigo-50 p-6 dark:border-indigo-500/20 dark:bg-indigo-500/10">
        <div className="flex items-start gap-2.5 text-sm leading-relaxed text-slate-700 dark:text-slate-200">
          <Flag
            className="mt-0.5 h-4 w-4 shrink-0 text-indigo-600 dark:text-indigo-300"
            aria-hidden="true"
          />
          <span>
            The running example throughout this guide is one person: {usd(120000, 0)} of net
            Schedule C profit, single filer, no W-2 withholding, tax year 2025. Every dollar figure
            below is computed by the same engines behind the{' '}
            <Link
              href="/quarterly-estimated-tax-calculator/"
            >
              quarterly estimated tax calculator
            </Link>
            , the{' '}
            <Link
              href="/self-employment-tax-calculator/"
            >
              self-employment tax calculator
            </Link>{' '}
            and the{' '}
            <Link
              href="/solo-401k-calculator/"
            >
              solo 401(k) calculator
            </Link>
            — recompute each one on your own numbers.
          </span>
        </div>
      </div>

      {/* ============================ Calendar ============================ */}
      <h2 id="calendar">The dates that run your year</h2>
      <p>
        The estimated-tax calendar is four installment dates plus the filing date that closes the
        year — and one retirement deadline that has nothing to do with the IRS payment schedule but
        binds harder than all of them. For tax year 2025 the dates are:
      </p>
      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>What it is</th>
            <th>What is actually at stake</th>
          </tr>
        </thead>
        <tbody>
          {installmentRows(BASE.perQuarter).map((q) => (
            <tr key={q.label}>
              <td>
                <strong>{q.due}</strong>
              </td>
              <td>Installment {q.label} of the tax year</td>
              <td>One quarter of your required annual payment — {usd(q.installment, 0)} at the example&apos;s 90% line</td>
            </tr>
          ))}
          <tr>
            <td>
              <strong>Dec 31, 2025</strong>
            </td>
            <td>Solo 401(k) establishment + employee deferral election</td>
            <td>
              The {usd(RETIREMENT_CONSTANTS.employeeDeferralLimit, 0)} deferral bucket — gone after
              this date, no extension
            </td>
          </tr>
          <tr>
            <td>
              <strong>Jan 31, 2026</strong>
            </td>
            <td>Q4 cure window closes</td>
            <td>File and pay in full by Jan 31 and the Jan 15 installment is not required (Form 1040-ES instructions)</td>
          </tr>
          <tr>
            <td>
              <strong>Apr 15, 2026</strong>
            </td>
            <td>2025 return + Q1 2026 installment — same day</td>
            <td>The remaining balance; and next year&apos;s first payment, on the same check run</td>
          </tr>
          <tr>
            <td>
              <strong>Apr 15 → Oct 15, 2026</strong>
            </td>
            <td>Employer retirement contributions &amp; SEP window (with extension)</td>
            <td>
              Solo 401(k) employer share and the whole SEP — {usd(SOLO_40.employerContribution, 0)}{' '}
              at the example&apos;s income
            </td>
          </tr>
        </tbody>
      </table>
      <p>
        Two patterns are worth internalizing. First, the installment dates are{' '}
        <em>payment</em> deadlines, not filing deadlines — there is no form to file, just money to
        move (IRS Direct Pay or EFTPS; select estimated tax, 1040-ES, as the reason, so the payment
        lands in the right bucket). Second, the calendar is back-loaded with escape hatches: the
        January installment has a January 31 cure, and the largest retirement levers stretch all the
        way to the extended filing deadline. December 31 is the one date with no cure — which is
        why it gets its own section below.
      </p>

      {/* ============================ Safe harbor ============================ */}
      <h2 id="harbor">Choose the safe harbor first</h2>
      <p>
        The penalty the calendar protects you from is the §6654 underpayment charge, and §6654(d)(1)
        defines the escape: prepay the <strong>lesser</strong> of two amounts and the penalty cannot
        attach, however large your final bill turns out to be. The three lines on that menu:
      </p>
      <ul>
        <li>
          <strong>90% of the current year&apos;s tax</strong> — §6654(d)(1)(A). Precise but
          forecast-dependent: you are pricing income you will not fully know until the year closes.
        </li>
        <li>
          <strong>100% of the prior year&apos;s tax</strong> — §6654(d)(1)(B). One number off last
          year&apos;s Form 1040; requires a 12-month prior year and US citizen/resident status.
        </li>
        <li>
          <strong>110% of the prior year&apos;s tax</strong> — replaces the 100% line entirely when{' '}
          <em>prior-year</em> AGI exceeded {usd(EST_CONSTANTS.highIncomeAgiThreshold, 0)}. This is
          not an election: above that AGI the 100% line does not exist.
        </li>
      </ul>
      <p>
        At the example persona — {usd(120000, 0)} of net profit, and a prior year that ended with{' '}
        {usd(22000, 0)} of total tax — the engine prices all three:
      </p>
      <table>
        <thead>
          <tr>
            <th>Harbor</th>
            <th>Required annual payment</th>
            <th>Per installment</th>
            <th>Binding?</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>90% of current-year tax ({usd(BASE.currentTotalTax, 0)} × 0.9)</td>
            <td>{usd(BASE.current90)}</td>
            <td>{usd(BASE.perQuarter)}</td>
            <td>Only if prior year is unknown</td>
          </tr>
          <tr>
            <td>100% of prior-year tax (AGI ≤ $150k)</td>
            <td>{usd(PRIOR100.requiredAnnualPayment, 0)}</td>
            <td>{usd(PRIOR100.perQuarter, 0)}</td>
            <td>
              <strong>Yes — it is lower</strong>
            </td>
          </tr>
          <tr>
            <td>110% of prior-year tax (AGI &gt; $150k)</td>
            <td>{usd(PRIOR110.requiredAnnualPayment, 0)}</td>
            <td>{usd(PRIOR110.perQuarter, 0)}</td>
            <td>Only for high-prior-AGI filers</td>
          </tr>
        </tbody>
      </table>
      <p>
        The selection logic, as decisions rather than definitions:
      </p>
      <ul>
        <li>
          <strong>Income rising</strong> (this example): the prior-year floor binds at{' '}
          {usd(PRIOR100.requiredAnnualPayment, 0)}, four installments of{' '}
          {usd(PRIOR100.perQuarter, 0)}. The true bill will be {usd(BASE.currentTotalTax, 0)}; the{' '}
          {usd(PRIOR100.expectedAtFiling, 0)} difference rides to April 15 penalty-free — an
          interest-free deferral that grows with your growth. The catch: you still need the cash in
          April, and the deferral is a one-year device (next year&apos;s floor is this year&apos;s
          higher tax).
        </li>
        <li>
          <strong>Income falling or volatile:</strong> the 90% line is lower — but it is only as
          good as your forecast. Overpaying toward the 90% line of an optimistic forecast is just an
          interest-free loan you get back as a refund.
        </li>
        <li>
          <strong>Prior-year tax unknown or $0:</strong> with last year&apos;s return unavailable,
          only the 90% line exists ({usd(BASE.current90, 0)} here). If last year&apos;s tax was{' '}
          <em>actually zero</em> — the first full year in business — §6654(e)(2) exempts you
          entirely: the engine returns a required payment of {usd(FIRST_YEAR.requiredAnnualPayment, 0)}{' '}
          and zero penalty exposure, so April settlement is legitimate, not reckless.
        </li>
        <li>
          <strong>Owe under {usd(EST_CONSTANTS.deMinimisThreshold, 0)} after withholding:</strong>{' '}
          §6654(e)(1) removes the requirement altogether. This is the small-hustle exit, and W-2
          withholding (yours or a spouse&apos;s) counts toward the requirement as if paid evenly
          across the year, §6654(g) — a December bonus with heavy withholding can cover a freelancer
          spouse&apos;s entire obligation.
        </li>
      </ul>

      {/* ============================ SE tax ============================ */}
      <h2 id="se-tax">Why SE tax dominates the installments</h2>
      <p>
        Self-employment tax is the line self-employed filers underestimate most consistently,
        because it does not exist on a W-2 paycheck as a separate item — it is both halves of FICA
        (12.4% Social Security + 2.9% Medicare) applied to{' '}
        {Math.round(EST_CONSTANTS.seBaseFactor * 10000) / 100}% of net profit, the factor IRC
        §1402(a)(2) substitutes for the employer-half deduction a corporation gets. At the example:
      </p>
      <table>
        <thead>
          <tr>
            <th>Layer</th>
            <th>Computation</th>
            <th>Amount</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>SE base</td>
            <td>92.35% × {usd(120000, 0)}</td>
            <td>{usd(SE_DETAIL.seBase, 0)}</td>
          </tr>
          <tr>
            <td>SE tax</td>
            <td>
              15.3% × {usd(SE_DETAIL.seBase, 0)} (all under the {usd(EST_CONSTANTS.ssWageBase, 0)}{' '}
              wage base)
            </td>
            <td>{usd(SE_DETAIL.seTax)}</td>
          </tr>
          <tr>
            <td>½ SE deduction (§164(f), above the line)</td>
            <td>SE tax ÷ 2</td>
            <td>−{usd(SE_DETAIL.halfSe)}</td>
          </tr>
          <tr>
            <td>QBI deduction (§199A, 20%, taxable-capped)</td>
            <td>engine-computed</td>
            <td>−{usd(BASE.qbiDeduction, 0)}</td>
          </tr>
          <tr>
            <td>Federal income tax</td>
            <td>
              2025 brackets on {usd(BASE.taxableIncome, 0)} taxable (standard deduction{' '}
              {usd(EST_CONSTANTS.stdDeductionSingle, 0)})
            </td>
            <td>{usd(BASE.incomeTax)}</td>
          </tr>
          <tr>
            <td>
              <strong>Total tax</strong>
            </td>
            <td>
              SE + income — {Math.round(BASE.effectiveRate * 100) / 100}% of net profit, all-in
            </td>
            <td>
              <strong>{usd(BASE.currentTotalTax)}</strong>
            </td>
          </tr>
        </tbody>
      </table>
      <p>
        The structural point: the SE layer is{' '}
        <strong>{Math.round(SE_SHARE_OF_TOTAL * 10) / 10}% of the total bill</strong> (
        {usd(BASE.seTax, 0)} of {usd(BASE.currentTotalTax, 0)}), it starts from the first dollar
        past a tiny floor (no SE tax until the base reaches {usd(EST_CONSTANTS.seMinBase, 0)} — but
        it is a cliff, and one more dollar of profit past roughly $433 of net profit triggers{' '}
        {usd(seTaxOf(434).seTax)} of tax on the whole base), and no deduction touches it: retirement
        contributions reduce income tax only, never SE tax. Every marginal dollar of net profit
        below the wage base costs {Math.round(SE_CENTS_PER_DOLLAR * 100) / 100}¢ of SE tax before
        income tax even starts — {Math.round(SE_SS_CENTS * 100) / 100}¢ Social Security plus{' '}
        {Math.round(SE_MEDICARE_CENTS * 100) / 100}¢ Medicare. When you size an installment, you are
        mostly prepaying SE tax. Quartered, the year costs {usd(SE_PER_QUARTER)} of SE tax against{' '}
        {usd(INCOME_TAX_PER_QUARTER)} of income tax — {usd(FULL_COST_PER_QUARTER)} per quarter in
        total — and the {usd(BASE.perQuarter)} installment at the 90% line is 90% of that same mix
        ({usd(SE_PER_QUARTER * 0.9)} SE tax + {usd(INCOME_TAX_PER_QUARTER * 0.9)} income tax), a
        discount on the prepayment, not a smaller tax.
      </p>
      <div className="my-8 rounded-2xl border border-slate-200 bg-white p-6 dark:border-white/[0.08] dark:bg-slate-900/60">
        <p className="flex items-start gap-2.5 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
          <AlertTriangle
            className="mt-0.5 h-4 w-4 shrink-0 text-amber-500 dark:text-amber-400"
            aria-hidden="true"
          />
          <span>
            Both engines agree at this persona: the estimated-tax engine&apos;s Schedule SE and the{' '}
            <Link
              href="/self-employment-tax-calculator/"
            >
              self-employment tax calculator
            </Link>
            &apos;s 2025-parameterized model both return {usd(SE_2025.totalSeTax)} —{' '}
            {usd(SE_2025.ssPart)} Social Security + {usd(SE_2025.medicarePart)} Medicare on a{' '}
            {usd(SE_2025.base, 0)} base. The Medicare layer never caps; only the 12.4% layer stops,
            at the {usd(EST_CONSTANTS.ssWageBase, 0)} wage base.
          </span>
        </p>
      </div>

      {/* ============================ Installments ============================ */}
      <h2 id="installments">The four installments, priced</h2>
      <p>
        The regular method divides the required payment into four equal installments — the dates
        below are the engine&apos;s tax-year 2025 schedule (Q2 moved to June 16 because June 15
        fell on a Sunday):
      </p>
      <table>
        <thead>
          <tr>
            <th>Installment</th>
            <th>Due</th>
            <th>90% line ({usd(BASE.perQuarter, 0)}/qtr)</th>
            <th>Cumulative</th>
          </tr>
        </thead>
        <tbody>
          {BASE.quarterly.map((q) => (
            <tr key={q.label}>
              <td>
                <strong>{q.label}</strong>
              </td>
              <td>{q.due}</td>
              <td>{usd(q.installment)}</td>
              <td>{usd(q.cumulative)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p>
        Under the prior-year harbor instead, the same table is simply four payments of{' '}
        {usd(PRIOR100.perQuarter, 0)} (or {usd(PRIOR110.perQuarter, 0)} under the 110% line) —
        the payment amount does not track your income at all within the year. That is the feature:
        once the harbor is chosen, the April/June/September payments are mechanical, and the only
        number you re-estimate is the April balance.
      </p>
      <p>
        Income that arrives unevenly has its own relief valve: the <strong>annualized income
        installment method</strong> (Form 2210 Schedule AI) re-prices each installment against what
        you had actually earned by each period — a June-heavy freelancer does not have to prepay
        April against income not yet received. The trade is a significantly harder computation at
        filing time; treat it as a cure for lumpy income, not a default.
      </p>

      {/* ============================ Penalty ============================ */}
      <h2 id="penalty">What missing a quarter actually costs</h2>
      <p>
        The §6654 penalty is computed like interest — simple, not compounded (IRM 20.1.3), at the
        federal underpayment rate, 7% in every quarter of 2025. It is the price of money, not a
        punitive fine, and its size depends entirely on <em>which</em> installment you skip, because
        each one accrues from its own due date to the day the shortage is settled:
      </p>
      <table>
        <thead>
          <tr>
            <th>Missed installment</th>
            <th>Accrual window to an Apr 15 settlement</th>
            <th>Penalty at the 90% line ({usd(BASE.perQuarter, 0)})</th>
            <th>At the prior-year line ({usd(PRIOR100.perQuarter, 0)})</th>
          </tr>
        </thead>
        <tbody>
          {MISSED_90.map((m, i) => (
            <tr key={m.label}>
              <td>
                <strong>{m.label}</strong> ({m.due})
              </td>
              <td>{m.days} days</td>
              <td>{usd(m.penalty)}</td>
              <td>{usd(missedInstallmentPenalty(PRIOR100.perQuarter, m.days))}</td>
            </tr>
          ))}
          <tr>
            <td>
              <strong>All four skipped</strong> (engine estimate)</td>
            <td>sum of the four windows</td>
            <td>
              <strong>{usd(BASE.penaltyEstimate)}</strong>
            </td>
            <td>
              <strong>{usd(PRIOR100.penaltyEstimate)}</strong>
            </td>
          </tr>
        </tbody>
      </table>
      <p>
        Read the asymmetry: skipping Q1 alone costs about four times skipping Q4 alone (
        {usd(MISSED_90[0].penalty)} vs {usd(MISSED_90[3].penalty)}) because Q1&apos;s money is
        outstanding for a full year. The practical rules that follow:
      </p>
      <ul>
        <li>
          If you must skip one, skip the latest one you can — and pay the missed amount with the
          return rather than letting it drift; the meter runs until paid, not until April 15.
        </li>
        <li>
          The whole penalty scale is small relative to the cash flow it protects: skipping
          everything costs roughly {usd(BASE.penaltyEstimate)} on a {usd(BASE.currentTotalTax, 0)}{' '}
          bill. That does not make skipping wise — it makes <em>panic</em> unnecessary. If cash is
          short in June, paying Q2 late costs {usd(MISSED_90[1].penalty)}-scale money, not a
          percentage-of-income catastrophe.
        </li>
        <li>
          These figures are the engine&apos;s labeled estimate — flat 7% simple interest, settlement
          on Apr 15, 2026. Your filed number comes from Form 2210 at quarterly rates on actual
          payment dates; treat the estimate as magnitude, not invoice.
        </li>
      </ul>

      {/* ============================ December 31 ============================ */}
      <h2 id="december-31">December 31: the immovable deadline</h2>
      <p>
        The IRS payment calendar is forgiving; the retirement-plan calendar is not, in one specific
        place. A solo 401(k) has two contribution buckets with two different clocks:
      </p>
      <ul>
        <li>
          <strong>Employee deferral — dies December 31.</strong> The{' '}
          {usd(RETIREMENT_CONSTANTS.employeeDeferralLimit, 0)} elective deferral (2025, §402(g);{' '}
          {usd(RETIREMENT_CONSTANTS.catchUpLimit, 0)} more from age 50, and{' '}
          {usd(RETIREMENT_CONSTANTS.enhancedCatchUpLimit, 0)} at ages 60–63 under SECURE 2.0 §109)
          must be elected, and the plan must exist, before the plan year closes. Under IRS
          Pub 560 guidance a sole proprietor generally cannot retroactively create a solo 401(k) or
          deferral election for a year that has already ended. Miss December 31 and the bucket is
          simply gone for that year.
        </li>
        <li>
          <strong>Employer contribution — lives until the filing deadline.</strong> The employer
          share ({usd(SOLO_40.employerContribution, 0)} at this persona — 20% of net
          profit after the ½ SE tax adjustment, capped by §415(c) at{' '}
          {usd(RETIREMENT_CONSTANTS.totalAdditionsLimit, 0)}) can be calculated after the year ends
          and funded as late as the return due date, extensions included. The same window covers
          adopting the plan for employer-only purposes.
        </li>
      </ul>
      <p>
        The SEP-IRA is the fully back-loaded alternative: no deferral bucket at all, one lever —{' '}
        <strong>
          {Math.round(SEP.effectiveRate * 10000) / 100}% of the same base, {usd(SEP.contribution)}
        </strong>{' '}
        at this income — and it can be <em>opened and funded</em> any time up to the filing
        deadline, extensions included. That is the SEP&apos;s entire advantage and its entire
        ceiling:
      </p>
      <table>
        <thead>
          <tr>
            <th>Vehicle at {usd(120000, 0)} net profit (age 40 / age 52)</th>
            <th>Deferral (12/31 clock)</th>
            <th>Employer / SEP (tax-deadline clock)</th>
            <th>Total capacity</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Solo 401(k), elected by Dec 31</td>
            <td>{usd(SOLO_40.deferralTotal, 0)} / {usd(SOLO_52.deferralTotal, 0)}</td>
            <td>{usd(SOLO_40.employerContribution, 0)}</td>
            <td>
              <strong>{usd(SOLO_40.total, 0)} / {usd(SOLO_52.total, 0)}</strong>
            </td>
          </tr>
          <tr>
            <td>Solo 401(k) opened after year end (employer-only)</td>
            <td>$0 — bucket expired</td>
            <td>{usd(SOLO_40.employerContribution, 0)}</td>
            <td>{usd(SOLO_40.employerContribution, 0)}</td>
          </tr>
          <tr>
            <td>SEP-IRA, opened any time to the filing deadline</td>
            <td>none exists</td>
            <td>{usd(SEP.contribution, 0)}</td>
            <td>{usd(SEP.contribution, 0)}</td>
          </tr>
        </tbody>
      </table>
      <p>
        The decision this table encodes: at moderate incomes the solo 401(k)&apos;s entire
        superiority over a SEP <em>is</em> the deferral bucket —{' '}
        {usd(SOLO_40.total - SEP.contribution, 0)} of capacity here, exactly the deferral — and that
        bucket exists only on the December 31 side of the line. A 52-year-old who lets December 31
        pass without a plan in place forfeits {usd(SOLO_52.total - SEP.contribution, 0)} of 2025
        capacity (deferral + catch-up); the same person who opened the plan on December 15 keeps it
        all, and can still take until October 15, 2026 to fund the employer half. Both bases are the
        same number, {usd(SOLO_40.compensationBase, 0)} — net profit minus the{' '}
        {usd(SOLO_40.halfSeTax, 0)} half-SE adjustment — which is why the employer share of a solo
        401(k) and a same-income SEP contribution match to the dollar.
      </p>

      {/* ============================ Last two weeks ============================ */}
      <h2 id="last-two-weeks">The last two weeks of the year</h2>
      <p>
        December is when the estimate and the plan meet. The moves that still work in the final two
        weeks, roughly in order of leverage:
      </p>
      <ol>
        <li>
          <strong>Re-run the forecast and true up Q4.</strong> By mid-December the year&apos;s
          profit is mostly knowable. Recompute the 90% line on the actual number; if you have been
          paying the prior-year harbor and income fell, the January installment is the last chance
          to stop overpaying — and if you have been under the 90% line, a larger January payment
          reduces (but does not erase) accrued penalty on the earlier installments.
        </li>
        <li>
          <strong>Open the solo 401(k) — paperwork only.</strong> Establishing the plan before
          December 31 preserves the deferral bucket, and the election that preserves it can name
          any amount up to the limit — but the election itself, not just the plan, must be made
          before the year closes; the cash can land later, once the profit picture is known. This
          is the single highest-stakes administrative task of the self-employed calendar, and it
          takes days, not hours, with a provider.
        </li>
        <li>
          <strong>Set the deferral against cash reality.</strong> The deferral does not have to be
          the full {usd(RETIREMENT_CONSTANTS.employeeDeferralLimit, 0)} — any amount up to the limit
          elected by year end counts. What cannot happen is deciding in February that you meant to
          defer.
        </li>
        <li>
          <strong>Time income and deductions — within the cash method.</strong> If you are on the
          cash basis, December invoicing versus January invoicing moves revenue across year lines.
          Useful at the margin; do not let it distort collections. Equipment placed in service by
          December 31 (Section 179 or bonus depreciation) is similarly a year-end-or-never election
          for that year.
        </li>
        <li>
          <strong>Check the $1,000 line one last time.</strong> If withholding plus estimates have
          the year&apos;s balance under {usd(EST_CONSTANTS.deMinimisThreshold, 0)}, the January
          installment can legitimately be zero — that is the de minimis exemption doing its work,
          not an oversight.
        </li>
      </ol>

      {/* ============================ January ============================ */}
      <h2 id="january">January and the April wrap</h2>
      <p>
        The January 15 installment closes the payment year, with two quirks worth knowing. First,
        the <strong>January 31 cure</strong>: per the Form 1040-ES instructions, if you file the
        return and pay the entire balance by January 31, the January 15 installment is not required
        — a real option when the paperwork is ready early. Second, January 15 is the only
        installment paid in the <em>following</em> calendar year, which makes it the natural place
        to absorb a late-year surprise: a booming Q4 raises the eventual bill, but the harbor (not
        the bill) sets what January owes.
      </p>
      <p>
        April 15 then arrives twice on the same day: the balance that closes last year and the
        installment that opens this one. The self-employed failure mode is treating April as one
        number — it is two payments to two different tax years (select the right year and reason in
        Direct Pay, or the payment posts to the wrong year). And with an extension, the return can
        wait until October 15, but the <em>balance</em> cannot: an extension extends filing, not
        paying — interest and penalty accrue on anything unpaid after April 15. The retirement
        window is the generous one: employer contributions and SEP dollars funded by the extended
        deadline still count for the prior year, which is the last lagging dependency of the tax
        year you are closing.
      </p>

      {/* ============================ Decision table ============================ */}
      <h2 id="decision-table">The year as one decision</h2>
      <p>The calendar collapses into a lookup table. Find your situation, pay the line it names:</p>
      <div className="my-8 overflow-x-auto rounded-2xl border border-slate-200 dark:border-white/[0.08]">
        <table className="w-full border-collapse text-left text-sm">
          <thead>
            <tr className="bg-slate-50 dark:bg-white/[0.04]">
              <th className="px-4 py-3 font-semibold text-slate-900 dark:text-slate-100">Your situation</th>
              <th className="px-4 py-3 font-semibold text-slate-900 dark:text-slate-100">The move</th>
              <th className="px-4 py-3 font-semibold text-slate-900 dark:text-slate-100">At $120k, that is</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-white/[0.06]">
            <tr>
              <td className="px-4 py-3 text-slate-600 dark:text-slate-300">First year, prior-year tax $0</td>
              <td className="px-4 py-3 text-slate-600 dark:text-slate-300">No installments required (§6654(e)(2)); reserve cash for April</td>
              <td className="px-4 py-3 text-slate-600 dark:text-slate-300">$0/quarter, {usd(BASE.currentTotalTax, 0)} in April</td>
            </tr>
            <tr>
              <td className="px-4 py-3 text-slate-600 dark:text-slate-300">Income rising, prior year known</td>
              <td className="px-4 py-3 text-slate-600 dark:text-slate-300">100%/110% prior-year harbor; defer the growth to April</td>
              <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{usd(PRIOR100.perQuarter, 0)}/quarter, {usd(PRIOR100.expectedAtFiling, 0)} at filing</td>
            </tr>
            <tr>
              <td className="px-4 py-3 text-slate-600 dark:text-slate-300">Income falling or prior year unknown</td>
              <td className="px-4 py-3 text-slate-600 dark:text-slate-300">90% of the current-year forecast; re-true at each installment</td>
              <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{usd(BASE.perQuarter, 0)}/quarter</td>
            </tr>
            <tr>
              <td className="px-4 py-3 text-slate-600 dark:text-slate-300">Lumpy income (big H2)</td>
              <td className="px-4 py-3 text-slate-600 dark:text-slate-300">Annualized method (Form 2210 Sch AI) or front-load the prior-year harbor</td>
              <td className="px-4 py-3 text-slate-600 dark:text-slate-300">same totals, later payments</td>
            </tr>
            <tr>
              <td className="px-4 py-3 text-slate-600 dark:text-slate-300">No retirement plan, before Dec 31</td>
              <td className="px-4 py-3 text-slate-600 dark:text-slate-300">Open the solo 401(k) now; decide amounts later</td>
              <td className="px-4 py-3 text-slate-600 dark:text-slate-300">up to {usd(SOLO_40.total, 0)} preserved</td>
            </tr>
            <tr>
              <td className="px-4 py-3 text-slate-600 dark:text-slate-300">No plan, after Dec 31</td>
              <td className="px-4 py-3 text-slate-600 dark:text-slate-300">SEP-IRA to the filing deadline (+ extensions)</td>
              <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{usd(SEP.contribution, 0)} still available</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div className="my-8 grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 dark:border-emerald-500/20 dark:bg-emerald-500/10">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
            <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
            Immovable
          </div>
          <div className="mt-2 text-sm leading-relaxed text-emerald-900 dark:text-emerald-100">
            Dec 31 — solo 401(k) plan existence + deferral election. No cure, no extension.
          </div>
        </div>
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 dark:border-amber-500/20 dark:bg-amber-500/10">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-300">
            <CalendarDays className="h-4 w-4" aria-hidden="true" />
            Curable
          </div>
          <div className="mt-2 text-sm leading-relaxed text-amber-900 dark:text-amber-100">
            The four installments — missed ones accrue 7%-simple interest ({usd(MISSED_90[0].penalty)}–
            {usd(BASE.penaltyEstimate)} scale at this persona); Q4 even has the Jan 31 cure.
          </div>
        </div>
        <div className="rounded-2xl border border-sky-200 bg-sky-50 p-5 dark:border-sky-500/20 dark:bg-sky-500/10">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-sky-700 dark:text-sky-300">
            <Flag className="h-4 w-4" aria-hidden="true" />
            Back-loaded
          </div>
          <div className="mt-2 text-sm leading-relaxed text-sky-900 dark:text-sky-100">
            Employer retirement dollars and the whole SEP — decidable as late as Oct 15 with an
            extension ({usd(SOLO_40.employerContribution, 0)} here).
          </div>
        </div>
      </div>

      {/* ============================ Scope ============================ */}
      <h2 id="scope">Scope &amp; caveats</h2>
      <p>
        All parameters are tax-year 2025 federal figures — the year the estimated-tax instrument
        models (standard deduction {usd(EST_CONSTANTS.stdDeductionSingle, 0)} per P.L. 119-21
        §70102; wage base {usd(EST_CONSTANTS.ssWageBase, 0)}; retirement limits per IRS Notice
        2024-80). The model prices single and married-filing-jointly statuses, Schedule C income
        only, no state estimated tax, no Additional Medicare Tax on SE income, and it assumes no W-2
        wages behind any withholding credit. Penalty figures are the engine&apos;s labeled
        flat-rate estimates; Form 2210 computes the filed number. Deadlines shift to the next
        business day when they land on weekends or holidays (June 16, 2025 is the worked example),
        and different years will shift differently — the dates in the tables are 2025&apos;s, the
        pattern is durable. This is an illustrative model, not tax advice; confirm the current
        year&apos;s dates, rates, and limits before acting.
      </p>
    </>
  );
}

// Freelance hourly-rate engine — permanent regression matrix for lib/freelance.ts.
//
// RUN PREREQUISITE (owned by the unified test runner, NOT by this file):
//   lib/freelance.ts must be compiled to JS before this file is executed, e.g.
//
//     npx tsc lib/stripe.ts lib/freelance.ts \
//       --outDir scripts/tests/.build \
//       --module es2022 --target es2022 --moduleResolution node \
//       --strict --skipLibCheck
//
//   (with both lib files as inputs their common root is lib/, so tsc writes a
//   flat layout: scripts/tests/.build/stripe.js + freelance.js — verified.)
//
//   The compiled module is resolved from the first existing candidate:
//     1. $CALC_TEST_BUILD/lib/freelance.js   (rootDir-projected layout)
//     2. $CALC_TEST_BUILD/freelance.js       (flat layout, command above)
//   The build dir defaults to <this file's dir>/.build and can be overridden
//   with the CALC_TEST_BUILD environment variable. (Compiling with
//   --module commonjs also loads fine and silences node's
//   MODULE_TYPELESS_PACKAGE_JSON reparse warning.)
//
// Model under test (lib/freelance.ts):
//   gross   = expenses + takeHome / (1 − t)      (expenses deductible pre-tax)
//   weeks   = 52 − vacation/5                    (floored at 0.5; unreachable
//                                                — vacation clamps at 120 → 28 wks)
//   hours   = weeks × weeklyHours                (≥ 1; weeklyHours clamps to [1, 80])
//   hourly  = gross / hours ·  day = 8×hourly ·  monthly = gross/12
//   util%   = hours / 2080 × 100                 (can exceed 100 — over-capacity)
//   clamps: tax ∈ [0, 70], vacation ∈ [0, 120], weeklyHours ∈ [1, 80].
//
// Every expected value below is double-confirmed: hand-derived from the model
// (derivation noted per assertion) and re-computed by the compiled engine
// (tsc → node) before being written in. Anchors marked [article] reproduce
// flagship numbers printed in components/content/FreelanceArticle.tsx;
// anchors marked [default] reproduce the calculator defaults in
// components/calculators/FreelanceCalculator.tsx
// ({ takeHome: 90000, expenses: 12000, taxRate: 30, vacation: 25, weeklyHours: 25 }).
//
// Style: plain node assertions — no test framework, no new dependencies.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const BUILD = process.env.CALC_TEST_BUILD || path.join(HERE, '.build');

async function loadLib(name) {
  const candidates = [
    path.join(BUILD, 'lib', `${name}.js`),
    path.join(BUILD, `${name}.js`),
  ];
  for (const file of candidates) {
    if (fs.existsSync(file)) return import(pathToFileURL(file).href);
  }
  throw new Error(
    `compiled lib/${name}.ts not found — compile first (see header comment)\n` +
      `  tried:   ${candidates.join('\n  tried:   ')}\n` +
      `  build dir: ${BUILD} (override with CALC_TEST_BUILD)`,
  );
}

const { computeFreelanceRate } = await loadLib('freelance');

let passed = 0;

/** Numeric assertion: |actual − expected| ≤ tol, else throw input → expected → actual. */
function close(label, input, expected, actual, tol = 1e-9) {
  if (!(Math.abs(actual - expected) <= tol)) {
    throw new Error(
      `FAIL [${label}]\n  input    : ${input}\n  expected : ${expected}\n  actual   : ${actual}`,
    );
  }
  passed += 1;
}

/** Strict-identity assertion (exact integers, …). */
function same(label, input, expected, actual) {
  if (actual !== expected) {
    throw new Error(
      `FAIL [${label}]\n  input    : ${input}\n  expected : ${expected}\n  actual   : ${actual}`,
    );
  }
  passed += 1;
}

/* ------------------------------------------------------------------ */
/* [default + article flagship] $90k / $12k / 30% / 25d / 25h/wk        */
/* ------------------------------------------------------------------ */

// gross = 12,000 + 90,000/0.7 = 12,000 + 128,571.428571… = 140,571.4285714286
//   (exact fraction 984,000/7); weeks = 52 − 25/5 = 47; hours = 47×25 = 1,175;
// hourly = 984,000/(7×1,175) = 984,000/8,225 = 119.63525835866…  → "$119.64/hr";
// day = 8×hourly = 957.0820668693 → "$957/day"; monthly = gross/12 = 11,714.2857142857;
// utilization = 1,175/2,080 = 56.49038461538…%  → "56.5%".
{
  const r = computeFreelanceRate({
    targetTakeHome: 90000,
    businessExpenses: 12000,
    taxRate: 30,
    vacationDays: 25,
    weeklyBillableHours: 25,
  });
  const input = '{90,000 · 12,000 · 30% · 25d · 25h}';
  close('default grossNeeded', input, 140571.4285714286, r.grossNeeded);
  same('default billableWeeks', input, 47, r.billableWeeks);
  same('default billableHours', input, 1175, r.billableHours);
  close('default hourlyRate', input, 119.6352583587, r.hourlyRate);
  close('default dayRate', input, 957.0820668693, r.dayRate);
  close('default monthlyRate', input, 11714.2857142857, r.monthlyRate);
  close('default utilization%', input, 56.4903846154, r.utilization);
}

// [article / JSDoc tax-asymmetry anchor] The WRONG shortcut
// (takeHome + expenses)/(1 − t) inflates revenue by exactly E·t/(1−t):
// 12,000×0.30/0.70 = 3,600/0.7 = 5,142.857142857… ≈ "$5,143/yr".
{
  const r = computeFreelanceRate({
    targetTakeHome: 90000,
    businessExpenses: 12000,
    taxRate: 30,
    vacationDays: 25,
    weeklyBillableHours: 25,
  });
  const wrongShortcut = (90000 + 12000) / (1 - 0.3);
  close(
    'tax asymmetry: shortcut − engine = E·t/(1−t)',
    'wrongShortcut(90,000·12,000·30%) − computeFreelanceRate(…).grossNeeded',
    5142.8571428571,
    wrongShortcut - r.grossNeeded,
  );
}

/* ------------------------------------------------------------------ */
/* Article personas                                                    */
/* ------------------------------------------------------------------ */

// [article] Marketer: $75k / $6.5k / 28% / 20d / 22h/wk.
// gross = 6,500 + 75,000/0.72 = 110,666.6667 (exact 332,000/3); hours 48×22 = 1,056;
// hourly = 332,000/3,168 = 104.79797979798 → "$104.80"; day = 838.3838383838 → "$838";
// util = 1,056/2,080 = 50.7692307692% → "50.8%".
{
  const r = computeFreelanceRate({
    targetTakeHome: 75000,
    businessExpenses: 6500,
    taxRate: 28,
    vacationDays: 20,
    weeklyBillableHours: 22,
  });
  const input = '{75,000 · 6,500 · 28% · 20d · 22h}';
  close('marketer grossNeeded', input, 110666.6666666667, r.grossNeeded);
  same('marketer billableHours', input, 1056, r.billableHours);
  close('marketer hourlyRate', input, 104.797979798, r.hourlyRate);
  close('marketer dayRate', input, 838.3838383838, r.dayRate);
  close('marketer utilization%', input, 50.7692307692, r.utilization);
}

// [article] Side hustle: $24k / $3k / 22% / 10d / 12h/wk.
// gross = 3,000 + 24,000/0.78 = 33,769.230769; weeks 50, hours 600;
// hourly = 56.2820512821 → "$56.28"; day = 450.2564102564 → "$450";
// util = 600/2,080 = 28.8461538462% → "28.8%".
{
  const r = computeFreelanceRate({
    targetTakeHome: 24000,
    businessExpenses: 3000,
    taxRate: 22,
    vacationDays: 10,
    weeklyBillableHours: 12,
  });
  const input = '{24,000 · 3,000 · 22% · 10d · 12h}';
  close('side-hustle grossNeeded', input, 33769.2307692308, r.grossNeeded);
  same('side-hustle billableHours', input, 600, r.billableHours);
  close('side-hustle hourlyRate', input, 56.2820512821, r.hourlyRate);
  close('side-hustle dayRate', input, 450.2564102564, r.dayRate);
  close('side-hustle utilization%', input, 28.8461538462, r.utilization);
}

// [article] Senior specialist: $120k / $18k / 32% / 30d / 30h/wk.
// gross = 18,000 + 120,000/0.68 = 194,470.5882352941; weeks = 52 − 6 = 46; hours 1,380;
// hourly = 140.9207161125 → "$140.92"; util = 1,380/2,080 = 66.3461538462% → "66.3%".
{
  const r = computeFreelanceRate({
    targetTakeHome: 120000,
    businessExpenses: 18000,
    taxRate: 32,
    vacationDays: 30,
    weeklyBillableHours: 30,
  });
  const input = '{120,000 · 18,000 · 32% · 30d · 30h}';
  close('specialist grossNeeded', input, 194470.5882352941, r.grossNeeded);
  same('specialist billableWeeks', input, 46, r.billableWeeks);
  same('specialist billableHours', input, 1380, r.billableHours);
  close('specialist hourlyRate', input, 140.9207161125, r.hourlyRate);
  close('specialist utilization%', input, 66.3461538462, r.utilization);
}

// [article] Fractional consultant: $70k / $9k / 28% / 50d / 32h/wk.
// gross = 9,000 + 70,000/0.72 = 106,222.2222 (exact 956,000/9); weeks 42, hours 1,344;
// hourly = 956,000/(9×1,344) = 956,000/12,096 = 79.03439153439 → "$79.03";
// day = 632.2751322751 → "$632"; util = 1,344/2,080 = 64.6153846154% → "64.6%".
{
  const r = computeFreelanceRate({
    targetTakeHome: 70000,
    businessExpenses: 9000,
    taxRate: 28,
    vacationDays: 50,
    weeklyBillableHours: 32,
  });
  const input = '{70,000 · 9,000 · 28% · 50d · 32h}';
  close('consultant grossNeeded', input, 106222.2222222222, r.grossNeeded);
  same('consultant billableHours', input, 1344, r.billableHours);
  close('consultant hourlyRate', input, 79.0343915344, r.hourlyRate);
  close('consultant dayRate', input, 632.2751322751, r.dayRate);
  close('consultant utilization%', input, 64.6153846154, r.utilization);
}

// [article audit scenario] $80k / $10k / 30% / 20d — quoted $105 at 25 h/wk.
// gross = 10,000 + 80,000/0.7 = 124,285.7142857143 → "$124,286";
// hours 48×25 = 1,200; floor = 124,285.714…/1,200 = 103.5714285714 → "$103.57".
{
  const r = computeFreelanceRate({
    targetTakeHome: 80000,
    businessExpenses: 10000,
    taxRate: 30,
    vacationDays: 20,
    weeklyBillableHours: 25,
  });
  const input = '{80,000 · 10,000 · 30% · 20d · 25h}';
  close('audit grossNeeded', input, 124285.7142857143, r.grossNeeded);
  same('audit billableHours', input, 1200, r.billableHours);
  close('audit floor @25h', input, 103.5714285714, r.hourlyRate);
}

// Same audit plan delivered at 18 h/wk: hours 48×18 = 864;
// honest floor = 124,285.714…/864 = 143.8492063492 → article "$143.85/hr".
{
  const r = computeFreelanceRate({
    targetTakeHome: 80000,
    businessExpenses: 10000,
    taxRate: 30,
    vacationDays: 20,
    weeklyBillableHours: 18,
  });
  const input = '{80,000 · 10,000 · 30% · 20d · 18h}';
  same('audit@18h billableHours', input, 864, r.billableHours);
  close('audit@18h floor', input, 143.8492063492, r.hourlyRate);
}

/* ------------------------------------------------------------------ */
/* Input-domain clamps (mirror the UI limits; deep-links reach raw)    */
/* ------------------------------------------------------------------ */

const BASE = { targetTakeHome: 90000, businessExpenses: 12000, taxRate: 30, vacationDays: 25 };

// weeklyHours 0 → clamps to 1: hours = 47; hourly = 984,000/(7×47) = 984,000/329
//   = 2,990.88145896657 → "$2,991/hr" degenerate floor.
{
  const r = computeFreelanceRate({ ...BASE, weeklyBillableHours: 0 });
  const input = '{90,000 · 12,000 · 30% · 25d · 0h → clamp 1}';
  same('clamp weeklyHours 0→1 hours', input, 47, r.billableHours);
  close('clamp weeklyHours 0→1 hourly', input, 2990.8814589666, r.hourlyRate);
}

// weeklyHours 100 → clamps to 80: hours = 47×80 = 3,760;
//   hourly = 140,571.428571…/3,760 = 37.3860182371.
{
  const r = computeFreelanceRate({ ...BASE, weeklyBillableHours: 100 });
  const input = '{90,000 · 12,000 · 30% · 25d · 100h → clamp 80}';
  same('clamp weeklyHours 100→80 hours', input, 3760, r.billableHours);
  close('clamp weeklyHours 100→80 hourly', input, 37.3860182371, r.hourlyRate);
}

// vacation 200 → clamps to 120: weeks = 52 − 120/5 = 28; hours 700;
//   hourly = 140,571.428571…/700 = 200.8163265306.
{
  const r = computeFreelanceRate({ ...BASE, vacationDays: 200, weeklyBillableHours: 25 });
  const input = '{90,000 · 12,000 · 30% · 200d → clamp 120 · 25h}';
  same('clamp vacation 200→120 weeks', input, 28, r.billableWeeks);
  same('clamp vacation 200→120 hours', input, 700, r.billableHours);
  close('clamp vacation 200→120 hourly', input, 200.8163265306, r.hourlyRate);
}

// taxRate 100 → clamps to 70 (this is what keeps 1−t away from 0):
//   gross = 12,000 + 90,000/0.30 = 312,000; hourly = 312,000/1,175 = 265.5319148936.
// Identical to a raw taxRate of exactly 70 (the clamp ceiling).
{
  const r100 = computeFreelanceRate({ ...BASE, taxRate: 100, weeklyBillableHours: 25 });
  const r70 = computeFreelanceRate({ ...BASE, taxRate: 70, weeklyBillableHours: 25 });
  close('clamp tax 100→70 gross', '{… · 100% tax → clamp 70}', 312000, r100.grossNeeded);
  close('clamp tax 100→70 hourly', '{… · 100% tax → clamp 70}', 265.5319148936, r100.hourlyRate);
  close('tax 70 exact gross', '{… · 70% tax}', 312000, r70.grossNeeded);
  close('tax 70 == tax 100 (clamped)', 'grossNeeded(70%) vs grossNeeded(100%)', r70.grossNeeded, r100.grossNeeded);
}

// taxRate −10 → clamps to 0: gross = 12,000 + 90,000 = 102,000;
//   hourly = 102,000/1,175 = 86.8085106383.
{
  const r = computeFreelanceRate({ ...BASE, taxRate: -10, weeklyBillableHours: 25 });
  const input = '{90,000 · 12,000 · −10% → clamp 0 · 25d · 25h}';
  close('clamp tax −10→0 gross', input, 102000, r.grossNeeded);
  close('clamp tax −10→0 hourly', input, 86.8085106383, r.hourlyRate);
}

// Negative money inputs clamp to 0: gross 0 → hourly 0 (hours still 1,175).
{
  const r = computeFreelanceRate({
    targetTakeHome: -5000,
    businessExpenses: -1000,
    taxRate: 30,
    vacationDays: 25,
    weeklyBillableHours: 25,
  });
  const input = '{−5,000 · −1,000 · 30% · 25d · 25h}';
  same('negative inputs gross 0', input, 0, r.grossNeeded);
  same('negative inputs hourly 0', input, 0, r.hourlyRate);
}

// All-minimum inputs {0 · 0 · 0% · 0d · 1h}: gross 0, weeks 52, hours 52,
//   hourly/day/month 0, utilization = 52/2,080 = 2.5% exactly.
{
  const r = computeFreelanceRate({
    targetTakeHome: 0,
    businessExpenses: 0,
    taxRate: 0,
    vacationDays: 0,
    weeklyBillableHours: 1,
  });
  const input = '{0 · 0 · 0% · 0d · 1h}';
  same('all-min gross', input, 0, r.grossNeeded);
  same('all-min weeks', input, 52, r.billableWeeks);
  same('all-min hours', input, 52, r.billableHours);
  same('all-min hourly', input, 0, r.hourlyRate);
  same('all-min day', input, 0, r.dayRate);
  same('all-min monthly', input, 0, r.monthlyRate);
  same('all-min utilization%', input, 2.5, r.utilization);
}

/* ------------------------------------------------------------------ */
/* Sensitivity anchors (article "what moves the rate" table)           */
/* ------------------------------------------------------------------ */

// Tax 30% → 36% (baseline else): gross = 12,000 + 90,000/0.64 = 152,625;
//   hourly = 152,625/1,175 = 129.8936170213 → "$129.89" (+8.6%).
{
  const r = computeFreelanceRate({ ...BASE, taxRate: 36, weeklyBillableHours: 25 });
  const input = '{90,000 · 12,000 · 36% · 25d · 25h}';
  close('sens tax36 gross', input, 152625, r.grossNeeded);
  close('sens tax36 hourly', input, 129.8936170213, r.hourlyRate);
}

// Take-home 90k → 108k: gross = 12,000 + 108,000/0.7 = 166,285.7142857;
//   hourly = 166,285.714…/1,175 = 141.5197568389 → "$141.52" (+18.3%).
{
  const r = computeFreelanceRate({
    targetTakeHome: 108000,
    businessExpenses: 12000,
    taxRate: 30,
    vacationDays: 25,
    weeklyBillableHours: 25,
  });
  close('sens th108k hourly', '{108,000 · 12,000 · 30% · 25d · 25h}', 141.5197568389, r.hourlyRate);
}

// Hours 25 → 20: hours 940; hourly = 140,571.428…/940 = 149.5440729483 → "$149.54" (+25.0%).
{
  const r = computeFreelanceRate({ ...BASE, weeklyBillableHours: 20 });
  const input = '{90,000 · 12,000 · 30% · 25d · 20h}';
  same('sens h20 hours', input, 940, r.billableHours);
  close('sens h20 hourly', input, 149.5440729483, r.hourlyRate);
}

// 26 h/wk — the article's utilization-threshold point: hours 47×26 = 1,222;
//   utilization = 1,222/2,080 = 58.75% exactly ("58.8%"); hourly = 115.0339022679 ("$115.03").
{
  const r = computeFreelanceRate({ ...BASE, weeklyBillableHours: 26 });
  const input = '{90,000 · 12,000 · 30% · 25d · 26h}';
  same('sens h26 hours', input, 1222, r.billableHours);
  same('sens h26 utilization%', input, 58.75, r.utilization);
  close('sens h26 hourly', input, 115.0339022679, r.hourlyRate);
}

// Over-capacity signal: 45 h/wk → hours 47×45 = 2,115 > the 2,080-hour FTE year;
//   utilization = 2,115/2,080 = 101.6826923077% → article "101.7%" (>100 flag).
{
  const r = computeFreelanceRate({ ...BASE, weeklyBillableHours: 45 });
  const input = '{90,000 · 12,000 · 30% · 25d · 45h}';
  same('over-capacity hours', input, 2115, r.billableHours);
  close('over-capacity utilization%', input, 101.6826923077, r.utilization);
}

console.log(`PASS freelance.test.mjs — ${passed} assertions`);

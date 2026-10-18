// HSA triple-tax-advantage model — tax year 2025.
//
// Stage 4 of the suite workflow ("Compensate yourself"): after entity and
// salary structure, the Health Savings Account is the most tax-favored
// account in the code — the only one with three separate tax breaks:
//
//   1. Contributions inside the annual limit are deductible ("above the
//      line", IRC §223(a)) even when made personally, not through payroll.
//   2. Investment growth inside the account is never taxed (§223(e)).
//   3. Withdrawals for qualified medical expenses are never taxed (§223(f)).
//
// This module quantifies that advantage against a taxable account that
// receives the SAME pre-tax earnings, under three usage patterns:
//
//   spend-as-you-go — every year's contribution is spent on qualified care
//                     in the same year (m = 1). Value = income tax never paid.
//   save-to-retire  — nothing is spent from the account (m = 0); medical
//                     bills are paid from outside cash and the balance rides
//                     to retirement ("save your receipts" strategy).
//   mixed           — the account holder's actual behavior: a share m of each
//                     year's contribution is spent on current care, the rest
//                     compounds; at the horizon a share p of the balance is
//                     assumed cashed out non-qualified (taxed + 20% penalty).
//
// 2025 federal parameters (sources: IRS Rev. Proc. 2024-25 for the COLA'd
// limits; IRC §223 for the statutory mechanics):
//   - HSA contribution limit, self-only ............ $4,300
//   - HSA contribution limit, family ............... $8,550
//   - Age-55 catch-up (IRC §223(b)(3), statutory,
//     not inflation-indexed) ....................... $1,000
//   - HDHP gate for 2025 (docs only): minimum annual
//     deductible $1,650 self / $3,300 family; maximum annual
//     out-of-pocket $8,300 / $16,600 (Rev. Proc. 2024-25).
//   - Non-qualified distribution additional tax .... 20% of the
//     distribution (IRC §223(f)(4)); distributions after age 65,
//     disability, or death escape the 20% surtax but remain
//     includible in income (§223(f)(1), as amended by ACA §9004).
//
// Modeling conventions (each is stated so the numbers are reproducible):
//   - Contributions occur at the START of each year (annuity-due); care
//     withdrawals for the current year are assumed to leave the account
//     immediately after the contribution, so only the unspent share compounds.
//   - The taxable twin earmarks the SAME pre-tax dollars C: it pays tax first
//     (leaving C·(1−t)), buys the same care from that, and invests the rest.
//     Its investment share per year is therefore C·(1−t−m) — which can go
//     NEGATIVE when care exceeds the after-tax pool (m > 1−t); the model then
//     reads it as the twin borrowing at the taxable growth rate.
//   - Taxable-account drag: the twin's growth is taxed ANNUALLY at the entered
//     marginal rate (exact for interest-like assets; overstated for long-held
//     equities). A zero-drag bound (growth never taxed) is computed alongside
//     so every headline advantage is bracketed: the true taxable result lies
//     between the two.
//   - The "tax shield" of spend-as-you-go is reported BOTH as uninvested cash
//     (N × C × t — conservative, no compounding) and as the compounded
//     equivalent (C × t × annuity factor at the taxable rate = the borrowing
//     twin's debt at year N).
//   - Nominal dollars throughout; contribution held constant (limits actually
//     index — 2026 is already announced at $4,400 / $8,750 per Rev. Proc.
//     2025-19); no payroll/FICA layer (see the article: only cafeteria-plan
//     payroll contributions escape FICA, and >2% S-corp shareholders cannot
//     use salary reduction at all); no state tax (CA and NJ do not conform
//     and tax HSA earnings).
//
// Simplified, illustrative US federal model — NOT tax or investment advice.

/* ========================= 2025 federal parameters ======================== */

export const HSA_CONSTANTS = {
  /** 2025 contribution limit, self-only HDHP coverage (Rev. Proc. 2024-25). */
  selfLimit: 4_300,
  /** 2025 contribution limit, family HDHP coverage (Rev. Proc. 2024-25). */
  familyLimit: 8_550,
  /** Age-55+ catch-up (IRC §223(b)(3)): statutory $1,000, not indexed. */
  catchUp55: 1_000,
  /** Youngest age eligible for the HSA catch-up. */
  catchUpMinAge: 55,
  /** Additional tax on non-qualified distributions (IRC §223(f)(4)). */
  nonQualifiedPenaltyRate: 0.2,
  /**
   * 2025 HDHP gate (Rev. Proc. 2024-25) — documentation only; eligibility is
   * not computed, it is asserted by the visitor.
   */
  hdhpMinDeductibleSelf: 1_650,
  hdhpMinDeductibleFamily: 3_300,
  hdhpMaxOutOfPocketSelf: 8_300,
  hdhpMaxOutOfPocketFamily: 16_600,
} as const;

export type HsaCoverage = 'self' | 'family';

export type HsaInputs = {
  /** Planned annual contribution (capped at the statutory limit). */
  contribution: number;
  coverage: HsaCoverage;
  /** Eligible for the $1,000 age-55 catch-up. */
  age55: boolean;
  /** Combined marginal ordinary income-tax rate, percent (e.g. 24 → 0.24). */
  marginalRatePct: number;
  /** Expected annual return before tax, percent (e.g. 7 → 0.07). */
  returnRatePct: number;
  /** Horizon in years. */
  years: number;
  /**
   * Share (0..1) of each year's contribution spent on qualified care in the
   * same year — "current medical spend share".
   */
  medicalSpendShare: number;
  /**
   * Share (0..1) of the terminal balance assumed withdrawn non-qualified
   * (income tax + the 20% additional tax). The "作废"/forfeit share.
   */
  forfeitShare: number;
};

/** Clamp n into [lo, hi], NaN-safe. */
function bounded(n: number, lo: number, hi: number): number {
  if (!Number.isFinite(n)) return lo;
  return Math.min(hi, Math.max(lo, n));
}

/* ============================== Core formulas ============================= */

/**
 * 2025 statutory contribution limit for one account holder:
 *
 *   limit = $4,300 (self-only) | $8,550 (family) + $1,000 if 55+
 *
 * Source: IRS Rev. Proc. 2024-25 (COLA'd limits); IRC §223(b)(3) (catch-up).
 * Family coverage means the family HDHP tier — the limit belongs to the
 * account holder, not the household (a spouse needs their own HSA for a
 * second catch-up).
 */
export function hsaLimitFor(coverage: HsaCoverage, age55: boolean): number {
  const base = coverage === 'family' ? HSA_CONSTANTS.familyLimit : HSA_CONSTANTS.selfLimit;
  return base + (age55 ? HSA_CONSTANTS.catchUp55 : 0);
}

/**
 * Future-value factor of a constant annual investment, contributed at the
 * START of each year (annuity-due), growing at `rate` for `years`:
 *
 *   AF(r, N) = ((1 + r)^N − 1) / r × (1 + r)     (r > 0)
 *   AF(0, N) = N
 *
 * Start-of-year contributions match how people actually fund HSAs (lump sum
 * early in the year, or payroll through it); applying growth after the
 * withdrawal for current-year care is what makes the unspent share the only
 * part that compounds.
 */
export function annuityDueFactor(rate: number, years: number): number {
  const n = Math.max(1, Math.round(bounded(years, 1, 60)));
  const r = bounded(rate, -0.9, 0.9);
  if (Math.abs(r) <= 1e-9) return n;
  return (((1 + r) ** n - 1) / r) * (1 + r);
}

/* ========================= Non-qualified withdrawal ======================= */

export type NonQualifiedWithdrawal = {
  gross: number;
  /** Ordinary income tax on the distribution: gross × marginal rate. */
  incomeTax: number;
  /** The 20% additional tax of IRC §223(f)(4). */
  additionalTax: number;
  totalTax: number;
  net: number;
};

/**
 * Cost of pulling HSA money out for anything other than qualified medical
 * expenses, before age 65:
 *
 *   net = gross × (1 − t − 20%)
 *
 * The distribution is includible in income (§223(f)(1)) AND carries a 20%
 * additional tax (§223(f)(4)) — the two stack. After age 65, disability, or
 * death, the 20% surtax disappears but the income tax remains: the account
 * then behaves like a traditional IRA (with medical withdrawals still free).
 */
export function nonQualifiedWithdrawal(gross: number, marginalRatePct: number): NonQualifiedWithdrawal {
  const g = bounded(gross, 0, 1e12);
  const t = bounded(marginalRatePct, 0, 85) / 100;
  const incomeTax = g * t;
  const additionalTax = g * HSA_CONSTANTS.nonQualifiedPenaltyRate;
  return { gross: g, incomeTax, additionalTax, totalTax: incomeTax + additionalTax, net: g - incomeTax - additionalTax };
}

/* ============================== The comparison ============================ */

export type HsaComparison = {
  /** Statutory 2025 limit for the chosen coverage / age. */
  limit: number;
  /** Contribution actually modeled after the cap. */
  contribution: number;
  /** True when the entered contribution exceeded the limit. */
  contributionCapped: boolean;
  /** Marginal rate as a fraction. */
  rate: number;
  /** Annual return as a fraction. */
  growth: number;
  years: number;
  medicalSpendShare: number;
  forfeitShare: number;

  spendNow: {
    /**
     * N × C × t — income tax never paid on N years of medical dollars, held
     * as uninvested cash (no compounding; the conservative reading).
     */
    taxShield: number;
    /** C × t × AF(g_tax, N): the same shield compounded — the year-N debt the borrowing taxable twin would carry. */
    taxShieldCompounded: number;
  };

  saveForLater: {
    /** HSA balance at N — spendable tax-free for qualified medical care. */
    balance: number;
    /** Same balance used for anything else after 65: ×(1−t), no 20% surtax. */
    post65AnyUse: number;
    /** Taxable twin, growth taxed annually at the marginal rate. */
    taxableTwinDrag: number;
    /** Taxable twin, zero growth drag — the bound that flatters the twin most. */
    taxableTwinNoDrag: number;
    /** balance − taxableTwinDrag. */
    advantageDrag: number;
    /** balance − taxableTwinNoDrag — the HSA's edge even with zero drag. */
    advantageNoDrag: number;
  };

  mixed: {
    /** Care bought through the HSA each year: m × C, tax-free. */
    annualMedical: number;
    /** Balance at N from the unspent share: (1−m) × C × AF(r, N). */
    balance: number;
    /** Income tax on the forfeited share: p × balance × t. */
    forfeitTax: number;
    /** 20% additional tax on the forfeited share: p × balance × 20%. */
    forfeitPenalty: number;
    /** Spendable value at N: balance − forfeit tax − forfeit penalty. */
    value: number;
    /** What the twin invests per year: C × (1−t−m); negative = borrowing. */
    twinAnnualInvestment: number;
    /** True when care exceeds the twin's after-tax pool (m > 1−t). */
    twinBorrowing: boolean;
    /** Twin's terminal value — negative when it ends in debt. */
    taxableTwinBalance: number;
    /** value − taxableTwinBalance. */
    advantage: number;
  };
};

/**
 * The full three-usage comparison at one set of inputs.
 *
 * One formula underlies all three usages — they differ only in the spend
 * share m and the forfeit share p:
 *
 *   HSA value(N)   = (1−m)·C·AF(r,N) − p·(1−m)·C·AF(r,N)·(t + 20%)
 *   Twin value(N)  = C·(1−t−m)·AF(r·(1−t), N)          … may be negative
 *   spend-as-you-go = the m = 1 case: shield = N·C·t (cash) or C·t·AF (debt)
 *   save-to-retire  = the m = 0, p = 0 case.
 *
 * Fairness: both sides receive the same pre-tax earnings C; the taxable twin
 * pays tax on it first, buys the same care, and invests what remains. When
 * care exceeds the twin's after-tax pool (m > 1−t) the twin is modeled as
 * borrowing at its own growth rate — the honest alternative to pretending it
 * could skip the care. Clamps: rate [0, 85%], return [0, 50%], years [1, 60],
 * m and p [0, 1].
 */
export function compareHsa(inputs: HsaInputs): HsaComparison {
  const limit = hsaLimitFor(inputs.coverage, inputs.age55);
  const entered = bounded(inputs.contribution, 0, 1e9);
  const C = Math.min(entered, limit);
  const t = bounded(inputs.marginalRatePct, 0, 85) / 100;
  const r = bounded(inputs.returnRatePct, 0, 50) / 100;
  const N = Math.round(bounded(inputs.years, 1, 60));
  const m = bounded(inputs.medicalSpendShare, 0, 1);
  const p = bounded(inputs.forfeitShare, 0, 1);

  const g = r * (1 - t); // taxable twin's after-tax growth rate
  const afHsa = annuityDueFactor(r, N);
  const afTwin = annuityDueFactor(g, N);

  // --- Spend-as-you-go (m = 1): every year's contribution leaves for care. ---
  const taxShield = N * C * t;
  const taxShieldCompounded = C * t * afTwin;

  // --- Save-to-retire (m = 0, p = 0): the whole contribution compounds. ---
  const balance = C * afHsa;
  const taxableTwinDrag = C * (1 - t) * afTwin;
  const taxableTwinNoDrag = C * (1 - t) * afHsa;

  // --- Mixed at the entered m and p. ---
  const annualMedical = m * C;
  const mixedBalance = (1 - m) * C * afHsa;
  const forfeitTax = p * mixedBalance * t;
  const forfeitPenalty = p * mixedBalance * HSA_CONSTANTS.nonQualifiedPenaltyRate;
  const mixedValue = mixedBalance - forfeitTax - forfeitPenalty;
  const twinAnnualInvestment = C * (1 - t - m);
  const taxableTwinBalance = twinAnnualInvestment * afTwin;

  return {
    limit,
    contribution: C,
    contributionCapped: entered > limit + 0.5,
    rate: t,
    growth: r,
    years: N,
    medicalSpendShare: m,
    forfeitShare: p,
    spendNow: { taxShield, taxShieldCompounded },
    saveForLater: {
      balance,
      post65AnyUse: balance * (1 - t),
      taxableTwinDrag,
      taxableTwinNoDrag,
      advantageDrag: balance - taxableTwinDrag,
      advantageNoDrag: balance - taxableTwinNoDrag,
    },
    mixed: {
      annualMedical,
      balance: mixedBalance,
      forfeitTax,
      forfeitPenalty,
      value: mixedValue,
      twinAnnualInvestment,
      twinBorrowing: twinAnnualInvestment < -1e-9,
      taxableTwinBalance,
      advantage: mixedValue - taxableTwinBalance,
    },
  };
}

/* =============================== Sweeps =================================== */

export type RateSensitivityPoint = {
  /** Marginal rate in percent. */
  rate: number;
  /** Mixed-usage advantage at that rate. */
  mixed: number;
  /** Save-to-retire advantage at that rate (taxable twin, annual drag). */
  saveAll: number;
};

/**
 * Advantage of the HSA across the 2025 federal ordinary brackets (10–37%),
 * everything else held at the caller's inputs. The mixed line uses the
 * entered spend/forfeit shares; the save-all line is the m = 0, p = 0 case.
 */
export function hsaRateSensitivity(inputs: HsaInputs, from = 10, to = 37): RateSensitivityPoint[] {
  const out: RateSensitivityPoint[] = [];
  const lo = Math.round(bounded(from, 0, 85));
  const hi = Math.round(bounded(to, 0, 85));
  for (let rate = lo; rate <= hi; rate++) {
    const c = compareHsa({ ...inputs, marginalRatePct: rate });
    out.push({ rate, mixed: c.mixed.advantage, saveAll: c.saveForLater.advantageDrag });
  }
  return out;
}

export type HorizonPoint = {
  years: number;
  /** HSA balance (save-to-retire usage). */
  hsa: number;
  /** Taxable twin, growth taxed annually. */
  taxableDrag: number;
  /** Taxable twin, zero growth drag. */
  taxableNoDrag: number;
};

/**
 * Save-to-retire terminal balances by horizon (1..`to` years) — the build-time
 * curve behind the page chart: three lines that bracket the taxable account's
 * true result between the two drag conventions.
 */
export function hsaHorizonSweep(inputs: HsaInputs, to = 40): HorizonPoint[] {
  const limit = hsaLimitFor(inputs.coverage, inputs.age55);
  const C = Math.min(bounded(inputs.contribution, 0, 1e9), limit);
  const t = bounded(inputs.marginalRatePct, 0, 85) / 100;
  const r = bounded(inputs.returnRatePct, 0, 50) / 100;
  const g = r * (1 - t);
  const out: HorizonPoint[] = [];
  const top = Math.round(bounded(to, 1, 60));
  for (let n = 1; n <= top; n++) {
    const afHsa = annuityDueFactor(r, n);
    out.push({
      years: n,
      hsa: C * afHsa,
      taxableDrag: C * (1 - t) * annuityDueFactor(g, n),
      taxableNoDrag: C * (1 - t) * afHsa,
    });
  }
  return out;
}

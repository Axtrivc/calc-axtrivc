// Stripe (US) processing fee model — standard published rates.
// Last verified against Stripe's published US pricing: 2026-10.
// (Online domestic card 2.9% + $0.30; international +1.5% cross-border;
// ACH direct debit 0.8% capped at $5. Stripe Terminal in-person 2.7% + 5¢
// and manually keyed entry 3.4% + $0.30 are separate published rates and
// are intentionally NOT modeled here — this instrument covers online card
// and bank-debit collection only.)
// These constants are documented and referenced by the SEO article.

export type StripeRateConfig = {
  label: string;
  description: string;
  rate: number;
  fixed: number;
  cap?: number;
};

export type StripeFeeType = 'domestic' | 'international' | 'ach';

export const STRIPE_RATES: Record<StripeFeeType, StripeRateConfig> = {
  domestic: {
    label: 'Domestic card',
    description: '2.9% + $0.30 per transaction',
    rate: 0.029,
    fixed: 0.3,
  },
  international: {
    label: 'International card',
    description: '4.4% + $0.30 (2.9% + 1.5% cross-border + $0.30)',
    rate: 0.044,
    fixed: 0.3,
  },
  ach: {
    label: 'ACH transfer',
    description: '0.8% capped at $5.00',
    rate: 0.008,
    fixed: 0,
    cap: 5,
  },
};

/** Charge amount at which the ACH $5.00 cap engages: $5.00 ÷ 0.8% = $625. */
export const ACH_CAP_THRESHOLD = STRIPE_RATES.ach.cap! / STRIPE_RATES.ach.rate; // 625

export type FeeBreakdown = {
  charge: number; // amount charged to customer
  fee: number; // processor fee
  net: number; // amount you receive
  effectiveRate: number; // fee / charge * 100
  type: StripeFeeType;
};

/**
 * Compute the fee for a given charge amount and fee type (forward calculation).
 *
 * Formula (2025–2026 published US pricing, unchanged across that window):
 *   card types:  fee = charge × rate + fixed      (domestic 2.9% + $0.30;
 *                                               international 4.4% + $0.30)
 *   ACH:         fee = min(charge × 0.8%, $5.00)  (cap engages at $625)
 *   effective %  = fee ÷ charge × 100
 */
export function computeFee(charge: number, type: StripeFeeType): FeeBreakdown {
  const r = STRIPE_RATES[type];
  const safe = Math.max(0, charge);
  let fee: number;
  if (type === 'ach' && r.cap !== undefined) {
    fee = Math.min(safe * r.rate, r.cap);
  } else {
    fee = safe * r.rate + r.fixed;
  }
  // Card fee exceeds the charge itself once charge < fixed ÷ (1 − rate)
  // (= $0.309 for domestic, $0.314 for international). Clamp net at 0 so the
  // UI doesn't show negative takes.
  fee = Math.max(0, Math.min(fee, safe));
  const net = safe - fee;
  const effectiveRate = safe > 0 ? (fee / safe) * 100 : 0;
  return { charge: safe, fee, net, effectiveRate, type };
}

/**
 * Reverse calculation: given a desired net amount you want to keep, compute the
 * charge (invoice total) that yields that net after Stripe's fee.
 *
 * - percentage + fixed (domestic / international):
 *     net = charge*(1 - rate) - fixed
 *     =>  charge = (net + fixed) / (1 - rate)
 *
 * - ACH (0.8% capped at $5): two regimes depending on whether the charge is
 *   above or below the cap threshold ($5 / 0.8% = $625).
 *     * Capped regime (charge >= $625): fee = $5, charge = net + $5.
 *     * Uncapped regime (charge < $625): fee = charge*0.8%, charge = net / 0.992.
 *   We attempt the capped branch first; if it yields a charge below the
 *   threshold we fall back to the uncapped formula.
 *
 * Verified by construction: the solved charge is pushed back through the
 * forward formula in dev builds (see invariant below), so both regimes of the
 * $625 boundary round-trip to the target net exactly.
 */
export function reverseFromNet(targetNet: number, type: StripeFeeType): FeeBreakdown {
  const r = STRIPE_RATES[type];
  const net = Math.max(0, targetNet);

  let charge: number;
  if (type === 'ach' && r.cap !== undefined) {
    const cap = r.cap;
    const cappedCharge = net + cap; // assume fee is the $5 cap
    if (cappedCharge >= cap / r.rate) {
      // 625 threshold — cap applies
      charge = cappedCharge;
    } else {
      // uncapped: net = charge * (1 - 0.008)
      charge = net / (1 - r.rate);
    }
  } else {
    charge = (net + r.fixed) / (1 - r.rate);
  }

  // Re-derive fee/net from the computed charge for consistency.
  let fee: number;
  if (type === 'ach' && r.cap !== undefined) {
    fee = Math.min(charge * r.rate, r.cap);
  } else {
    fee = charge * r.rate + r.fixed;
  }
  fee = Math.max(0, fee);
  const effectiveRate = charge > 0 ? (fee / charge) * 100 : 0;

  // Dev-only invariant: the reverse solution must survive the forward path —
  // fee(charge) must land back on the target net (which also proves the solved
  // charge sits on the correct side of the ACH $625 boundary). Dead-code
  // eliminated from production bundles by the bundler's NODE_ENV replace.
  if (process.env.NODE_ENV !== 'production') {
    const fwd = computeFee(charge, type);
    const drift = Math.abs(fwd.net - net);
    if (drift > 1e-6) {
      throw new Error(
        `reverseFromNet invariant violated (type=${type}, net=${net}, charge=${charge}, round-trip drift=${drift})`,
      );
    }
  }

  return { charge, fee, net: charge - fee, effectiveRate, type };
}

/* ------------------------------------------------------------------ */
/* Monthly volume model — blended cost across a payment mix            */
/* ------------------------------------------------------------------ */

export type VolumeLeg = {
  type: StripeFeeType;
  /** Successful transactions of this kind per month (≥ 0). */
  count: number;
  /** Average ticket size for this kind, in dollars (≥ 0). */
  averageTicket: number;
};

export type VolumeLegResult = VolumeLeg & {
  /** count × averageTicket */
  volume: number;
  /** count × fee(averageTicket) — ACH cap applied per transaction */
  fee: number;
  net: number;
  /** leg fee ÷ leg volume × 100 (0 when the leg is empty) */
  effectiveRate: number;
};

export type VolumeSummary = {
  legs: VolumeLegResult[];
  transactionCount: number;
  totalVolume: number;
  totalFee: number;
  totalNet: number;
  /** Blended effective rate: totalFee ÷ totalVolume × 100 (0 when empty). */
  blendedRate: number;
  /**
   * Counterfactual monthly fee if EVERY payment in the mix were collected as
   * ACH (0.8% capped at $5, no fixed fee — cheaper than either card rate on
   * any positive ticket). `null` when the mix has no non-ACH transactions,
   * i.e. it already collects entirely as ACH.
   */
  achFloorFee: number | null;
  /** totalFee − achFloorFee (0 when achFloorFee is null). */
  achFloorSaving: number;
};

/**
 * Monthly cost simulation over a mix of transaction types.
 *
 * Formulas (per leg, ticket uniform within the leg):
 *   leg volume = count × averageTicket
 *   leg fee    = count × fee(averageTicket, type)   // forward fee, cap included
 *   blended %  = Σ fees ÷ Σ volumes × 100
 *   ACH floor  = Σ over ALL legs: count × min(ticket × 0.8%, $5.00)
 *                — the all-ACH counterfactual; ACH has no fixed fee, so it
 *                  undercuts both card rates on every positive ticket
 */
export function monthlyVolume(legs: VolumeLeg[]): VolumeSummary {
  const cleaned: VolumeLeg[] = legs.map((l) => ({
    type: l.type,
    count: Math.max(0, l.count),
    averageTicket: Math.max(0, l.averageTicket),
  }));

  const results: VolumeLegResult[] = cleaned.map((l) => {
    const one = computeFee(l.averageTicket, l.type);
    const volume = l.count * l.averageTicket;
    const fee = l.count * one.fee;
    return {
      ...l,
      volume,
      fee,
      net: volume - fee,
      effectiveRate: volume > 0 ? (fee / volume) * 100 : 0,
    };
  });

  const transactionCount = cleaned.reduce((s, l) => s + l.count, 0);
  const totalVolume = results.reduce((s, r) => s + r.volume, 0);
  const totalFee = results.reduce((s, r) => s + r.fee, 0);

  // All-ACH counterfactual: ACH's 0.8% with no fixed fee (and $5 cap) is
  // cheaper than either card rate at every positive ticket, so the floor
  // prices EVERY leg as ACH — Σ count × min(ticket × 0.8%, $5.00). Legs
  // already on ACH keep exactly their current fee.
  let floorFee = 0;
  for (const l of cleaned) {
    floorFee += l.count * computeFee(l.averageTicket, 'ach').fee;
  }
  const cardCount = cleaned.reduce((s, l) => s + (l.type !== 'ach' ? l.count : 0), 0);

  return {
    legs: results,
    transactionCount,
    totalVolume,
    totalFee,
    totalNet: totalVolume - totalFee,
    blendedRate: totalVolume > 0 ? (totalFee / totalVolume) * 100 : 0,
    achFloorFee: cardCount > 0 ? floorFee : null,
    achFloorSaving: cardCount > 0 ? Math.max(0, totalFee - floorFee) : 0,
  };
}

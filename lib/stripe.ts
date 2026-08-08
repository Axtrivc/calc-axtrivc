// Stripe (US) processing fee model — standard published rates, 2024–2025.
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

export type FeeBreakdown = {
  charge: number; // amount charged to customer
  fee: number; // processor fee
  net: number; // amount you receive
  effectiveRate: number; // fee / charge * 100
  type: StripeFeeType;
};

/** Compute the fee for a given charge amount and fee type (forward calculation). */
export function computeFee(charge: number, type: StripeFeeType): FeeBreakdown {
  const r = STRIPE_RATES[type];
  const safe = Math.max(0, charge);
  let fee: number;
  if (type === 'ach' && r.cap !== undefined) {
    fee = Math.min(safe * r.rate, r.cap);
  } else {
    fee = safe * r.rate + r.fixed;
  }
  // A charge smaller than ~$0.10 with a fixed $0.30 fee can produce a fee > charge.
  // Clamp net at 0 so the UI doesn't show negative takes.
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
  return { charge, fee, net: charge - fee, effectiveRate, type };
}

// Cap table & dilution model — priced rounds on a post-money input basis.
//
// This is the stage-3 "Structure" instrument: once an entity exists, financing
// decides who owns it. The model walks a founding cap table through up to four
// priced rounds, each entered as (investment, post-money valuation, option
// pool target), and returns every stakeholder's ownership after each round.
//
// Convention (2025 US venture practice, NVCA-style priced rounds):
//  - The investor's stake in a round is fixed by the money: f = investment / post-money.
//  - The option pool target is a % of the POST-round fully diluted cap table,
//    but the pool shares are created BEFORE the new money prices the round —
//    i.e. funded from the pre-money (the "option pool shuffle"). Naming is a
//    trap: term sheets quote the target on post-round shares, while the cost
//    lands in the pre-money. Both framings describe this same model, which is
//    the US market default. The pro-founder alternative — creating the pool
//    from the CLOSED (post-round) table so everyone dilutes pro-rata — is a
//    different structure, exposed as postMoneyPoolRound() below for comparison.
//  - Existing UNALLOCATED pool shares count toward the target: a round only adds
//    pool shares when the old pool has diluted below the target (board-style
//    "top-up to target"). Granted options are not tracked separately — moving a
//    share from "pool" to "employee" never changes anyone else's percentage, so
//    founder dilution is identical either way.
//
// Simplified, illustrative model — NOT legal or financial advice. Deliberate
// limitations (documented on the page):
//  - Priced rounds only. SAFEs, convertible notes, and warrants are not modeled.
//  - Rounds are modeled in order; the chain stops at the first round that is
//    empty (no money entered) or invalid (investment >= post-money, or the
//    investor stake + pool target leave nothing for existing holders).
//  - No anti-dilution adjustments, no secondary sales, no vesting/repurchase,
//    no option grants consuming the pool between rounds.
//  - "Value at exit" = stake % x exit valuation. It ignores liquidation
//    preferences, participation, debt, and taxes — treat it as an upper bound.
//
// The library is deliberately dependency-free so every number it returns is
// reproducible by hand from the formulas in the JSDoc below.

/** Maximum founder rows the UI offers. */
export const MAX_FOUNDERS = 5;
/** Maximum priced rounds the model walks through. */
export const MAX_ROUNDS = 4;
/** Default hypothetical exit valuation used by the UI ($100M). */
export const DEFAULT_EXIT_VALUATION = 100_000_000;

/** Display names for the four round slots (editable amounts, fixed order). */
export const ROUND_NAMES = ['Seed', 'Series A', 'Series B', 'Series C'] as const;

export type FounderInput = { name: string; shares: number };

export type RoundInput = {
  name: string;
  /** New money invested in this round, dollars. > 0 required to model. */
  investment: number;
  /** Post-money valuation of this round, dollars. Must exceed `investment`. */
  postMoney: number;
  /** Target unallocated option pool, PERCENT (0..100) of post-round fully diluted shares. */
  poolPct: number;
};

export type StakeKind = 'founder' | 'pool' | 'investor';

/** One line of the cap table. Share counts NEVER change after issuance; only the denominator grows. */
export type Stake = {
  /** Stable key: `f0..f4` founders, `pool`, `r0..r3` investors. */
  key: string;
  name: string;
  kind: StakeKind;
  /** Round index for investors, else null. */
  round: number | null;
  shares: number;
};

/** Per-round bookkeeping, all formulas exact. */
export type RoundOutcome = {
  index: number;
  name: string;
  investment: number;
  postMoney: number;
  /** postMoney - investment. */
  preMoney: number;
  /**
   * Price per share = preMoney / (sharesBefore + poolTopUp).
   * The top-up sits in the pre-money denominator — that is the shuffle.
   */
  pricePerShare: number;
  /** New shares issued to the investor = (investment / postMoney) x sharesAfter. */
  investorShares: number;
  /** New shares added to the unallocated pool (0 when the old pool already meets the target). */
  poolTopUp: number;
  /** Fully diluted shares before the round. */
  sharesBefore: number;
  /** Fully diluted shares after the round = sharesBefore + investorShares + poolTopUp. */
  sharesAfter: number;
  /** Investor's post-round ownership as a FRACTION (= investment / postMoney). */
  investorPct: number;
  /** Unallocated pool's post-round ownership as a fraction (>= target, = target when topped up). */
  poolPctAfter: number;
  /** Whether this round actually added pool shares. */
  topUpApplied: boolean;
};

/** A cap table snapshot: after founding, and after each modeled round. */
export type CapTableStage = {
  label: string;
  /** Fully diluted share count at this point. */
  shares: number;
  stakes: Stake[];
  round: RoundOutcome | null;
};

export type Simulation = {
  stages: CapTableStage[];
  /** How many rounds were actually applied. */
  modeledRounds: number;
  /** Index of the round that halted the chain (first empty/invalid), or null if all four modeled. */
  haltedAt: number | null;
  /** Human-readable reason the chain halted ('' when all rounds modeled). */
  haltReason: string;
  /** False when no founder holds a positive share count — nothing to dilute. */
  valid: boolean;
};

export type RoundStatus = {
  state: 'empty' | 'modeled' | 'invalid';
  reason?: string;
};

/**
 * Classify one round's inputs.
 *
 * A round is:
 *  - 'empty'   — no money on the table (investment <= 0);
 *  - 'invalid' — money present but contradictory: postMoney <= investment
 *                (nothing left for existing holders), or
 *                investment/postMoney + poolPct/100 >= 1 (the round would claim
 *                >= 100% of the post-round cap table);
 *  - 'modeled' — otherwise.
 */
export function classifyRound(r: RoundInput): RoundStatus {
  // No new money on the table -> nothing to model, whatever the other fields say.
  if (r.investment <= 0) return { state: 'empty' };
  if (r.postMoney <= r.investment) {
    return {
      state: 'invalid',
      reason: 'Post-money must exceed the investment',
    };
  }
  const f = r.investment / r.postMoney;
  const pool = Math.min(Math.max(r.poolPct, 0), 100) / 100;
  if (f + pool >= 1 - 1e-9) {
    return {
      state: 'invalid',
      reason: 'Investor stake + pool target exceed 100% of the post-round cap table',
    };
  }
  return { state: 'modeled' };
}

/**
 * Walk a founding cap table through up to four priced rounds.
 *
 * Per round (all inputs already validated by classifyRound):
 *
 *   f        = investment / postMoney                       (investor's fraction, post-round)
 *   denom    = 1 - f - poolFraction
 *   T_topup  = (sharesBefore - unallocatedPoolBefore) / denom   (post-round FD shares, if topped up)
 *   topUp    = poolFraction x T_topup - unallocatedPoolBefore   (>= 0 by construction)
 *   T_flat   = sharesBefore / (1 - f)                           (no-top-up branch)
 *
 * The branch with topUp >= 0 wins; if the existing unallocated pool already
 * exceeds the target once diluted, no shares are added (topUp = 0, T = T_flat).
 *
 *   investorShares = f x T
 *   pricePerShare  = (postMoney - investment) / (sharesBefore + topUp)
 *
 * Rounds are applied in order; the first empty or invalid round halts the chain
 * (a Series B cannot be modeled without a Series A). Later rounds are ignored.
 */
export function simulateCapTable(founders: FounderInput[], rounds: RoundInput[]): Simulation {
  const founderStakes: Stake[] = founders
    .map((f, i) => ({
      key: `f${i}`,
      name: (f.name || '').trim() || `Founder ${i + 1}`,
      kind: 'founder' as const,
      round: null,
      shares: Math.max(0, f.shares),
    }))
    .filter((s) => s.shares > 0);

  if (founderStakes.length === 0) {
    return {
      stages: [],
      modeledRounds: 0,
      haltedAt: null,
      haltReason: 'Enter at least one founder with shares above zero.',
      valid: false,
    };
  }

  const clone = (stakes: Stake[]) => stakes.map((s) => ({ ...s }));

  let stakes = founderStakes;
  let total = stakes.reduce((a, s) => a + s.shares, 0);
  const stages: CapTableStage[] = [
    { label: 'Founding', shares: total, stakes: clone(stakes), round: null },
  ];

  let haltedAt: number | null = null;
  let haltReason = '';

  rounds.slice(0, MAX_ROUNDS).forEach((r, idx) => {
    if (haltedAt !== null) return; // chain already stopped — ignore the rest

    const status = classifyRound(r);
    if (status.state !== 'modeled') {
      haltedAt = idx;
      haltReason =
        status.state === 'empty'
          ? `Chain ends at ${r.name}: no investment entered.`
          : `${r.name}: ${status.reason}.`;
      return;
    }

    const inv = r.investment;
    const post = r.postMoney;
    const f = inv / post; // investor fraction of the post-round table
    const poolFrac = Math.min(Math.max(r.poolPct, 0), 100) / 100;

    const poolBefore = stakes
      .filter((s) => s.kind === 'pool')
      .reduce((a, s) => a + s.shares, 0);
    const nonPoolBefore = total - poolBefore; // shares that are "real capitalization"

    // Default: no top-up — the round simply adds the investor's shares.
    let sharesAfter = total / (1 - f);
    let topUp = 0;
    let topUpApplied = false;

    if (poolFrac > 0) {
      const denom = 1 - f - poolFrac; // > 0 — guaranteed by classifyRound
      const t = nonPoolBefore / denom;
      const candidate = poolFrac * t - poolBefore;
      // Only a genuinely positive shortfall tops the pool up. A candidate of
      // exactly zero (the diluted pool lands ON the target) or float noise
      // below 1 share takes the flat branch: both branches are algebraically
      // identical there, and flagging a "+0 shares" top-up would be display
      // noise, not information.
      if (candidate > 1e-9) {
        sharesAfter = t;
        topUp = candidate;
        topUpApplied = true;
      }
    }

    const investorShares = f * sharesAfter;
    const preMoney = post - inv;
    const pricePerShare = preMoney / (total + topUp);
    const poolAfter = poolBefore + topUp;
    const sharesBefore = total; // FD count BEFORE this round's issuance

    const next = clone(stakes);
    if (topUp > 0) {
      const poolStake = next.find((s) => s.kind === 'pool');
      if (poolStake) poolStake.shares += topUp;
      else
        next.push({
          key: 'pool',
          name: 'Employees & option pool',
          kind: 'pool',
          round: null,
          shares: topUp,
        });
    }
    next.push({
      key: `r${idx}`,
      name: r.name,
      kind: 'investor',
      round: idx,
      shares: investorShares,
    });

    stakes = next;
    total = sharesAfter;

    stages.push({
      label: r.name,
      shares: total,
      stakes: clone(stakes),
      round: {
        index: idx,
        name: r.name,
        investment: inv,
        postMoney: post,
        preMoney,
        pricePerShare,
        investorShares,
        poolTopUp: topUp,
        sharesBefore,
        sharesAfter,
        investorPct: f,
        poolPctAfter: total > 0 ? poolAfter / total : 0,
        topUpApplied,
      },
    });
  });

  return {
    stages,
    modeledRounds: stages.length - 1,
    haltedAt,
    haltReason,
    valid: true,
  };
}

/** Ownership percentage of `shares` within `total` (0 when total is 0). */
export function stakePct(shares: number, total: number): number {
  return total > 0 ? (shares / total) * 100 : 0;
}

/** Combined founder ownership at a stage, in percent. */
export function foundersPct(stage: CapTableStage): number {
  const shares = stage.stakes
    .filter((s) => s.kind === 'founder')
    .reduce((a, s) => a + s.shares, 0);
  return stakePct(shares, stage.shares);
}

/** Ownership of founder slot `index` at a stage, in percent (0 if that slot is empty). */
export function founderPct(stage: CapTableStage, index = 0): number {
  const s = stage.stakes.find((st) => st.key === `f${index}`);
  return s ? stakePct(s.shares, stage.shares) : 0;
}

/** The last stage of a simulation (the founding table when no rounds are modeled). */
export function finalStage(sim: Simulation): CapTableStage | null {
  return sim.stages.length > 0 ? sim.stages[sim.stages.length - 1] : null;
}

export type PoolSensitivityRow = {
  /** Points added to every modeled round's pool target (e.g. +2 = 10% -> 12%). */
  shiftPct: number;
  /**
   * Founder slot 0's ownership after the final modeled round, percent.
   * NaN when the shifted path is infeasible (see `infeasible`).
   */
  youPct: number;
  /** All founders combined after the final modeled round, percent. NaN when infeasible. */
  foundersPct: number;
  /**
   * True when the shift pushes some round's investor stake + pool target to
   * >= 100% of the post-round cap table — that round cannot close, so there is
   * no honest ownership number for this row. Callers must render these rows as
   * infeasible rather than falling back to an earlier stage's snapshot (which
   * would read as "more pool -> more founder", the exact reverse of reality).
   */
  infeasible: boolean;
};

/**
 * Sensitivity of final founder ownership to the option pool knob: re-run the
 * whole simulation with every round's pool target shifted by the same points
 * (clamped at 0 on the low side). This is the negotiation lever the guide
 * focuses on.
 *
 * On the high side the shift is NOT clamped: if investor stake + shifted pool
 * would claim >= 100% of a round's post-round table, the row is marked
 * `infeasible` with NaN percentages instead of silently reporting the
 * pre-halt snapshot.
 */
export function poolSensitivity(
  founders: FounderInput[],
  rounds: RoundInput[],
  shifts: number[] = [-4, -2, 0, 2, 4],
): PoolSensitivityRow[] {
  return shifts.map((shiftPct) => {
    const shifted = rounds.map((r) => ({ ...r, poolPct: Math.max(0, r.poolPct + shiftPct) }));
    const infeasible = shifted.some((r) => classifyRound(r).state === 'invalid');
    const sim = simulateCapTable(founders, shifted);
    const last = finalStage(sim);
    return {
      shiftPct,
      youPct: !infeasible && last ? founderPct(last, 0) : NaN,
      foundersPct: !infeasible && last ? foundersPct(last) : NaN,
      infeasible,
    };
  });
}

/**
 * The pro-founder alternative pool structure, for a single round off a clean
 * table: the round closes FIRST (pool % = 0), and only then is the option pool
 * carved out of the closed table, so every holder — including the new
 * investor — dilutes by the same pro-rata factor:
 *
 *   T_close = sharesBefore / (1 - f)                  (the round itself)
 *   T_final = T_close / (1 - poolFraction)            (the carve-out)
 *   holder%' = holder%' at close x (1 - poolFraction)
 *
 * The round's price per share is untouched (the pool shares are issued from
 * authorized stock after close). Contrast with the default model, where the
 * same target costs existing holders the full pool percentage because the
 * investor's f is contractually protected — see the guide's pre-vs-post
 * section for the worked 70% vs 72% example.
 */
export function postMoneyPoolRound(
  sharesBefore: number,
  investment: number,
  postMoney: number,
  poolPct: number,
): {
  sharesAfterClose: number;
  sharesFinal: number;
  foundersPct: number;
  investorPct: number;
  poolPct: number;
} | null {
  if (sharesBefore <= 0 || investment <= 0 || postMoney <= investment) return null;
  const f = investment / postMoney;
  const poolFrac = Math.min(Math.max(poolPct, 0), 100) / 100;
  const sharesAfterClose = sharesBefore / (1 - f);
  const sharesFinal = sharesAfterClose / (1 - poolFrac);
  return {
    sharesAfterClose,
    sharesFinal,
    foundersPct: stakePct(sharesBefore, sharesFinal),
    investorPct: stakePct(f * sharesAfterClose, sharesFinal),
    poolPct: poolFrac * 100,
  };
}

/* ------------------------------------------------------------------ */
/* Scenario presets (numeric inputs only — names are UI-level)         */
/* ------------------------------------------------------------------ */

export type CapTablePreset = {
  id: string;
  label: string;
  description: string;
  founders: { shares: number }[];
  /** Always MAX_ROUNDS entries; inactive rounds carry investment = 0. */
  rounds: { investment: number; postMoney: number; poolPct: number }[];
};

const zeroRound = () => ({ investment: 0, postMoney: 0, poolPct: 0 });

function padRounds(
  rounds: { investment: number; postMoney: number; poolPct: number }[],
): CapTablePreset['rounds'] {
  return Array.from({ length: MAX_ROUNDS }, (_, i) => rounds[i] ?? zeroRound());
}

export const CAP_TABLE_PRESETS: CapTablePreset[] = [
  {
    id: 'standard',
    label: 'Standard path',
    description: 'Seed → A → B → C raising $52.5M total; mainstream pool targets.',
    founders: [{ shares: 6_000_000 }, { shares: 4_000_000 }],
    rounds: padRounds([
      { investment: 1_500_000, postMoney: 6_000_000, poolPct: 10 },
      { investment: 6_000_000, postMoney: 30_000_000, poolPct: 12 },
      { investment: 15_000_000, postMoney: 90_000_000, poolPct: 8 },
      { investment: 30_000_000, postMoney: 250_000_000, poolPct: 5 },
    ]),
  },
  {
    id: 'friendly',
    label: 'Founder-friendly',
    description: 'Lighter rounds, leaner pools — what patient capital looks like.',
    founders: [{ shares: 6_000_000 }, { shares: 4_000_000 }],
    rounds: padRounds([
      { investment: 1_000_000, postMoney: 6_000_000, poolPct: 8 },
      { investment: 4_000_000, postMoney: 30_000_000, poolPct: 8 },
      { investment: 10_000_000, postMoney: 100_000_000, poolPct: 5 },
      { investment: 20_000_000, postMoney: 300_000_000, poolPct: 3 },
    ]),
  },
  {
    id: 'heavy',
    label: 'Heavy dilution',
    description: 'Big checks at modest markups, fat pools — dilution stacking every round.',
    founders: [{ shares: 6_000_000 }, { shares: 4_000_000 }],
    rounds: padRounds([
      { investment: 2_000_000, postMoney: 6_000_000, poolPct: 15 },
      { investment: 8_000_000, postMoney: 20_000_000, poolPct: 15 },
      { investment: 20_000_000, postMoney: 50_000_000, poolPct: 10 },
      { investment: 40_000_000, postMoney: 120_000_000, poolPct: 8 },
    ]),
  },
  {
    id: 'seed-only',
    label: 'Single seed round',
    description: 'Where most companies actually are today: one round, one pool.',
    founders: [{ shares: 6_000_000 }, { shares: 4_000_000 }],
    rounds: padRounds([{ investment: 1_500_000, postMoney: 8_000_000, poolPct: 12 }]),
  },
];

/** Default UI state = the "Standard path" preset, slot 1 named "You". */
export const DEFAULT_FOUNDERS: FounderInput[] = CAP_TABLE_PRESETS[0].founders.map((f, i) => ({
  name: i === 0 ? 'You' : `Cofounder ${i}`,
  shares: f.shares,
}));

export const DEFAULT_ROUNDS: RoundInput[] = CAP_TABLE_PRESETS[0].rounds.map((r, i) => ({
  name: ROUND_NAMES[i],
  investment: r.investment,
  postMoney: r.postMoney,
  poolPct: r.poolPct,
}));

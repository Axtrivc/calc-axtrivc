'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Info,
  Layers,
  PieChart,
  Plus,
  RotateCcw,
  SlidersHorizontal,
  Trash2,
  TrendingDown,
} from 'lucide-react';
import NumberInput, { AnimatedNumber, CopyButton, SliderControl } from '@/components/NumberInput';
import ScenarioButtons from '@/components/ScenarioButtons';
import {
  CAP_TABLE_PRESETS,
  DEFAULT_EXIT_VALUATION,
  DEFAULT_FOUNDERS,
  DEFAULT_ROUNDS,
  MAX_FOUNDERS,
  MAX_ROUNDS,
  ROUND_NAMES,
  classifyRound,
  finalStage,
  founderPct,
  foundersPct,
  poolSensitivity,
  simulateCapTable,
  stakePct,
  type CapTablePreset,
  type CapTableStage,
  type Stake,
} from '@/lib/captable';
import { clamp, numFmt, pct, usd, usdCompact } from '@/lib/format';
import { useWorkbenchInputs, recordRecent } from '@/lib/workbench';

const SLUG = 'cap-table-dilution-calculator';
const HREF = '/cap-table-dilution-calculator/';

const DEFAULT_NAMES = ['You', 'Cofounder 1', 'Cofounder 2', 'Cofounder 3', 'Cofounder 4'];

/** Site palette for cap-table lines: founders (cool blues/violets), pool (amber), investors (greens/teals). */
const FOUNDER_COLORS = ['#6366f1', '#0ea5e9', '#a855f7', '#f472b6', '#94a3b8'];
const POOL_COLOR = '#f59e0b';
const INVESTOR_COLORS = ['#10b981', '#22d3ee', '#84cc16', '#f43f5e'];

function colorOf(stake: Stake): string {
  if (stake.kind === 'pool') return POOL_COLOR;
  if (stake.kind === 'investor') return INVESTOR_COLORS[clamp(stake.round ?? 0, 0, MAX_ROUNDS - 1)];
  return FOUNDER_COLORS[clamp(Number(stake.key.slice(1)) || 0, 0, MAX_FOUNDERS - 1)];
}

/** Workbench defaults: the "Standard path" preset (numeric inputs only). */
function defaultInputs(): Record<string, number> {
  const d: Record<string, number> = { exitValuation: DEFAULT_EXIT_VALUATION };
  for (let i = 0; i < MAX_FOUNDERS; i++) {
    d[`f${i + 1}`] = DEFAULT_FOUNDERS[i]?.shares ?? 0;
  }
  for (let i = 0; i < MAX_ROUNDS; i++) {
    const r = DEFAULT_ROUNDS[i];
    d[`r${i + 1}Amount`] = r.investment;
    d[`r${i + 1}Post`] = r.postMoney;
    d[`r${i + 1}Pool`] = r.poolPct;
  }
  return d;
}

function matchesPreset(v: Record<string, number>, p: CapTablePreset): boolean {
  for (let i = 0; i < MAX_FOUNDERS; i++) {
    if (v[`f${i + 1}`] !== (p.founders[i]?.shares ?? 0)) return false;
  }
  for (let i = 0; i < MAX_ROUNDS; i++) {
    const r = p.rounds[i];
    if (
      v[`r${i + 1}Amount`] !== r.investment ||
      v[`r${i + 1}Post`] !== r.postMoney ||
      v[`r${i + 1}Pool`] !== r.poolPct
    ) {
      return false;
    }
  }
  return true;
}

export default function CapTableCalculator() {
  const { values, set, reset } = useWorkbenchInputs(SLUG, defaultInputs());
  const [names, setNames] = useState<string[]>(DEFAULT_NAMES);
  const [visible, setVisible] = useState(2);

  useEffect(() => {
    recordRecent(SLUG);
  }, []);

  // Reveal founder rows that carry shares from a restored scenario / deep link.
  useEffect(() => {
    let highest = 1;
    for (let i = 1; i <= MAX_FOUNDERS; i++) {
      if ((values[`f${i}`] ?? 0) > 0) highest = i;
    }
    setVisible((v) => Math.max(v, Math.min(MAX_FOUNDERS, Math.max(2, highest))));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [values.f1, values.f2, values.f3, values.f4, values.f5]);

  const foundersArray = useMemo(
    () =>
      Array.from({ length: MAX_FOUNDERS }, (_, i) => ({
        name: names[i] || DEFAULT_NAMES[i],
        shares: values[`f${i + 1}`] ?? 0,
      })),
    [names, values],
  );

  const roundsArray = useMemo(
    () =>
      Array.from({ length: MAX_ROUNDS }, (_, i) => ({
        name: ROUND_NAMES[i],
        investment: values[`r${i + 1}Amount`] ?? 0,
        postMoney: values[`r${i + 1}Post`] ?? 0,
        poolPct: values[`r${i + 1}Pool`] ?? 0,
      })),
    [values],
  );

  const sim = useMemo(
    () => simulateCapTable(foundersArray, roundsArray),
    [foundersArray, roundsArray],
  );
  const last = finalStage(sim);
  const sensitivity = useMemo(
    () => (sim.valid ? poolSensitivity(foundersArray, roundsArray) : []),
    [sim.valid, foundersArray, roundsArray],
  );

  const youPct = last ? founderPct(last, 0) : 0;
  const allFoundersPct = last ? foundersPct(last) : 0;
  const exitValue = (youPct / 100) * Math.max(0, values.exitValuation);

  const youName = foundersArray[0]?.name || DEFAULT_NAMES[0];

  function applyPreset(p: CapTablePreset) {
    for (let i = 0; i < MAX_FOUNDERS; i++) set(`f${i + 1}`, p.founders[i]?.shares ?? 0);
    for (let i = 0; i < MAX_ROUNDS; i++) {
      const r = p.rounds[i];
      set(`r${i + 1}Amount`, r.investment);
      set(`r${i + 1}Post`, r.postMoney);
      set(`r${i + 1}Pool`, r.poolPct);
    }
    setNames(DEFAULT_NAMES);
    setVisible(Math.min(MAX_FOUNDERS, Math.max(2, p.founders.length)));
  }

  function resetAll() {
    reset();
    setNames(DEFAULT_NAMES);
    setVisible(2);
  }

  function removeFounder(index: number) {
    set(`f${index + 1}`, 0);
    if (index === visible - 1 && visible > 1) setVisible(visible - 1);
  }

  // Verb-free template: safe for any founder name, including the default "You".
  const copySummary = `Cap table after ${sim.modeledRounds} modeled round${
    sim.modeledRounds === 1 ? '' : 's'
  }: ${youName} — ${pct(youPct, 1)} of the fully diluted cap table (all founders: ${pct(
    allFoundersPct,
    1,
  )}), ~${usd(exitValue, 0)} at a ${usdCompact(values.exitValuation)} exit. Fully diluted: ${numFmt(
    Math.round(last?.shares ?? 0),
  )} shares.`;

  const stageCols = sim.stages; // Founding + each modeled round
  const sensZero = sensitivity.find((r) => r.shiftPct === 0);
  const sensPlus2 = sensitivity.find((r) => r.shiftPct === 2);
  const perTwoPoints =
    sensZero && sensPlus2 && Number.isFinite(sensZero.youPct) && Number.isFinite(sensPlus2.youPct)
      ? sensZero.youPct - sensPlus2.youPct
      : null;
  const anyInfeasible = sensitivity.some((r) => r.infeasible);

  // Where do the founders lose outright majority (<= 50%)?
  const majorityLostAt =
    sim.valid && last
      ? sim.stages.find((s) => foundersPct(s) <= 50)?.label ?? null
      : null;

  return (
    <div className="grid gap-6 lg:grid-cols-5">
      {/* ================= Inputs ================= */}
      <div className="card p-6 sm:p-8 lg:col-span-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
          Cap table inputs
        </h2>

        {/* Scenario presets */}
        <div className="mt-5">
          <div className="mb-2 flex items-baseline justify-between">
            <span className="label mb-0">Scenario presets</span>
            <span className="text-[11px] text-slate-500 dark:text-slate-400">
              full paths, one click
            </span>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {CAP_TABLE_PRESETS.map((p) => {
              const active = matchesPreset(values, p);
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => applyPreset(p)}
                  aria-pressed={active}
                  className={`rounded-xl border p-3 text-left transition duration-150 focus-calm ${
                    active
                      ? 'border-indigo-500 bg-indigo-50/80 ring-1 ring-indigo-500/25 dark:border-indigo-400 dark:bg-indigo-500/10 dark:ring-indigo-400/25'
                      : 'border-slate-200 bg-white hover:border-indigo-300 hover:shadow-sm dark:border-white/10 dark:bg-white/[0.03] dark:hover:border-indigo-400/40'
                  }`}
                >
                  <span
                    className={`block text-sm font-semibold ${
                      active
                        ? 'text-indigo-700 dark:text-indigo-300'
                        : 'text-slate-700 dark:text-slate-200'
                    }`}
                  >
                    {p.label}
                  </span>
                  <span className="mt-0.5 block text-xs leading-snug text-slate-500 dark:text-slate-400">
                    {p.description}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Founding cap table */}
        <div className="mt-7">
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
            Founding cap table
          </h3>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            Fully-diluted common shares at incorporation, before any financing.
          </p>
          <div className="mt-3 space-y-3">
            {Array.from({ length: visible }, (_, i) => (
              <div key={i} className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label htmlFor={`cap-name-${i}`} className="label">
                    Name
                  </label>
                  <input
                    id={`cap-name-${i}`}
                    type="text"
                    autoComplete="off"
                    maxLength={28}
                    value={names[i] ?? ''}
                    onChange={(e) =>
                      setNames((prev) => {
                        const next = [...prev];
                        next[i] = e.target.value;
                        return next;
                      })
                    }
                    placeholder={DEFAULT_NAMES[i]}
                    className="input-field"
                  />
                </div>
                <div className="flex items-end gap-2">
                  <div className="min-w-0 flex-1">
                    <NumberInput
                      id={`cap-shares-${i}`}
                      label="Common shares"
                      value={values[`f${i + 1}`] ?? 0}
                      onChange={(n) => set(`f${i + 1}`, n)}
                      min={0}
                      max={1_000_000_000}
                      placeholder="6,000,000"
                      helpText={i === 0 ? 'Slot 1 is treated as you.' : undefined}
                    />
                  </div>
                  {i === visible - 1 && visible > 1 && (
                    <button
                      type="button"
                      onClick={() => removeFounder(i)}
                      aria-label={`Remove founder row ${i + 1}`}
                      className="btn-ghost mb-0.5 shrink-0 px-2.5"
                    >
                      <Trash2
                        className="h-4 w-4 text-slate-400 dark:text-slate-500"
                        aria-hidden="true"
                      />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
          {visible < MAX_FOUNDERS && (
            <button
              type="button"
              onClick={() => setVisible(visible + 1)}
              className="btn-ghost mt-3"
            >
              <Plus className="h-4 w-4 text-indigo-500 dark:text-indigo-300" aria-hidden="true" />
              Add founder
            </button>
          )}
        </div>

        {/* Rounds */}
        <div className="mt-7">
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
            Funding rounds (modeled in order)
          </h3>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            Enter money on a round to model it. The chain stops at the first round without an
            investment — a Series B cannot happen without a Series A.
          </p>
          <div className="mt-3 space-y-3">
            {roundsArray.map((r, i) => {
              const modeled = i < sim.modeledRounds;
              const isHalt = sim.haltedAt === i;
              const status = classifyRound(r);
              const dimmed = sim.haltedAt !== null && i >= sim.haltedAt;
              return (
                <div
                  key={r.name}
                  className={`panel p-4 transition ${dimmed ? 'opacity-70' : ''}`}
                >
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <span className="text-sm font-bold text-slate-800 dark:text-slate-100">
                      {r.name}
                    </span>
                    {modeled ? (
                      <span className="chip bg-emerald-50 text-[10px] font-semibold uppercase tracking-wider text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
                        Modeled
                      </span>
                    ) : status.state === 'invalid' ? (
                      // Contradictory inputs get their reason even when they sit
                      // past the halt — the halt card only names the FIRST stopper.
                      <span
                        className="chip bg-rose-50 text-[10px] font-semibold text-rose-700 dark:bg-rose-500/15 dark:text-rose-300"
                        title={isHalt ? undefined : 'This round also has contradictory inputs — fix it before it can be modeled.'}
                      >
                        <AlertTriangle className="h-3 w-3" aria-hidden="true" />
                        {status.reason}
                      </span>
                    ) : (
                      <span className="chip bg-slate-100 text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:bg-white/[0.06] dark:text-slate-400">
                        {isHalt ? 'Chain ends here' : 'Not modeled'}
                      </span>
                    )}
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <NumberInput
                      id={`cap-inv-${i}`}
                      label="New money invested"
                      value={r.investment}
                      onChange={(n) => set(`r${i + 1}Amount`, n)}
                      min={0}
                      max={1_000_000_000}
                      prefix="$"
                      placeholder="1,500,000"
                    />
                    <NumberInput
                      id={`cap-post-${i}`}
                      label="Post-money valuation"
                      value={r.postMoney}
                      onChange={(n) => set(`r${i + 1}Post`, n)}
                      min={0}
                      max={10_000_000_000}
                      prefix="$"
                      placeholder="6,000,000"
                    />
                    <div className="sm:col-span-2 lg:col-span-2">
                      <SliderControl
                        id={`cap-pool-${i}`}
                        label="Option pool target"
                        ariaLabel={`${r.name} option pool target`}
                        value={r.poolPct}
                        onChange={(n) => set(`r${i + 1}Pool`, n)}
                        min={0}
                        max={30}
                        step={0.5}
                        suffix="%"
                        presets={[0, 10, 15, 20]}
                        helpText="% of post-round shares; carved from the pre-money."
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Exit valuation */}
        <div className="mt-7">
          <NumberInput
            id="cap-exit"
            label="Hypothetical exit valuation"
            value={values.exitValuation}
            onChange={(n) => set('exitValuation', n)}
            min={0}
            max={5_000_000_000}
            prefix="$"
            placeholder="100,000,000"
            helpText="Stake % × exit value. Ignores liquidation preferences, debt, and taxes — an upper bound."
          />
          <div className="mt-3">
            <SliderControl
              id="cap-exit-slider"
              label="Exit valuation"
              value={values.exitValuation}
              onChange={(n) => set('exitValuation', n)}
              min={1}
              max={5_000_000_000}
              logarithmic
              presets={[10_000_000, 50_000_000, 100_000_000, 500_000_000, 1_000_000_000]}
              formatValue={(n) => usdCompact(n)}
            />
          </div>
        </div>

        <div className="mt-6 flex items-start gap-2 rounded-lg bg-slate-50 p-3 text-xs leading-relaxed text-slate-600 dark:bg-white/[0.03] dark:text-slate-300">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-slate-400 dark:text-slate-500" aria-hidden="true" />
          <p>
            Post-money basis: the investor&apos;s stake is investment ÷ post-money, and the pool
            target is a % of the post-round cap table created before the new money prices the round
            — the standard &ldquo;pool in the pre-money&rdquo; shuffle. Existing unallocated pool
            shares count toward the target. SAFEs, convertible notes, preferences, and anti-dilution
            are outside this model.
          </p>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" onClick={resetAll} className="btn-ghost">
            <RotateCcw className="h-4 w-4 text-indigo-500 dark:text-indigo-300" aria-hidden="true" />
            Reset
          </button>
          <CopyButton text={copySummary} label="Copy result" />
          <ScenarioButtons slug={SLUG} shortTitle="Cap Table" href={HREF} params={{ ...values }} />
        </div>
      </div>

      {/* ================= Results ================= */}
      <div className="space-y-4 lg:col-span-2">
        {sim.valid && last ? (
          <>
            <div className="card p-6 sm:p-8">
              <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                <PieChart className="h-4 w-4" aria-hidden="true" />
                {sim.modeledRounds === 0
                  ? 'Before any financing'
                  : `After ${sim.modeledRounds} round${sim.modeledRounds === 1 ? '' : 's'}`}
              </h2>
              <div className="mt-3">
                <div className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  {youName} owns
                </div>
                <AnimatedNumber
                  value={youPct}
                  format={(n) => pct(n, 1)}
                  className="readout mt-1 block text-4xl font-extrabold tracking-tight text-indigo-600 dark:text-indigo-300"
                />
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  of the fully diluted cap table
                  {sim.modeledRounds > 0 ? ` — down from ${pct(founderPct(sim.stages[0], 0), 1)} at founding.` : '.'}
                </p>
              </div>

              <dl className="mt-5 divide-y divide-slate-100 text-sm dark:divide-white/[0.06]">
                <div className="flex items-center justify-between py-2.5">
                  <dt className="text-slate-600 dark:text-slate-300">All founders combined</dt>
                  <dd className="readout font-semibold text-slate-900 dark:text-slate-100">
                    {pct(allFoundersPct, 1)}
                  </dd>
                </div>
                <div className="flex items-center justify-between py-2.5">
                  <dt className="text-slate-600 dark:text-slate-300">
                    Stake value at {usdCompact(values.exitValuation)} exit
                  </dt>
                  <dd className="readout font-semibold text-slate-900 dark:text-slate-100">
                    ~{usd(exitValue, 0)}
                  </dd>
                </div>
                <div className="flex items-center justify-between py-2.5">
                  <dt className="text-slate-600 dark:text-slate-300">Fully diluted shares</dt>
                  <dd className="readout font-semibold text-slate-900 dark:text-slate-100">
                    {numFmt(Math.round(last.shares))}
                  </dd>
                </div>
              </dl>
              <p className="mt-3 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
                Exit value assumes your percentage holds to the exit and ignores liquidation
                preferences, participation, and taxes — a deliberately optimistic ceiling.
              </p>
            </div>

            {/* Price-per-share ladder */}
            {sim.stages.length > 1 && (
              <div className="card p-6 sm:p-8">
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  Price per share, round by round
                </h3>
                <dl className="mt-3 divide-y divide-slate-100 text-sm dark:divide-white/[0.06]">
                  {sim.stages
                    .filter((s) => s.round)
                    .map((s) => (
                      <div key={s.label} className="flex items-center justify-between gap-3 py-2">
                        <dt className="min-w-0">
                          <span className="block truncate font-medium text-slate-700 dark:text-slate-200">
                            {s.label}
                          </span>
                          <span className="block text-[11px] text-slate-500 dark:text-slate-400">
                            {usdCompact(s.round!.investment)} at {usdCompact(s.round!.postMoney)} post
                            {Math.round(s.round!.poolTopUp) > 0
                              ? ` · pool +${numFmt(Math.round(s.round!.poolTopUp))} sh`
                              : (roundsArray[s.round!.index]?.poolPct ?? 0) > 0
                                ? ` · pool ${pct(s.round!.poolPctAfter * 100, 1)} ≥ ${pct(roundsArray[s.round!.index].poolPct, 1)} target — no top-up`
                                : ''}
                          </span>
                        </dt>
                        <dd className="readout shrink-0 font-semibold text-slate-900 dark:text-slate-100">
                          {usd(s.round!.pricePerShare, 2)}
                        </dd>
                      </div>
                    ))}
                </dl>
              </div>
            )}

            {sim.haltedAt !== null && (
              <div className="card border-amber-200 p-5 dark:border-amber-500/25">
                <div className="flex items-start gap-2 text-xs leading-relaxed text-amber-700 dark:text-amber-300">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                  <p>{sim.haltReason} Later rounds are shown for input only.</p>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="card p-6 sm:p-8">
            <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              <PieChart className="h-4 w-4" aria-hidden="true" />
              Nothing to dilute yet
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
              Enter share counts for at least one founder — slot 1 is treated as you. The cap table,
              dilution waterfall, and pool sensitivity all build from those shares.
            </p>
          </div>
        )}
      </div>

      {/* ================= Round-by-round matrix ================= */}
      {sim.valid && last && (
        <div className="lg:col-span-5">
          <div className="card overflow-hidden">
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 px-5 py-4 sm:px-6 dark:border-white/[0.07]">
              <div className="max-w-xl">
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  Ownership after each round
                </h3>
                <p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                  Share counts never change — every round only grows the denominator. Founding column
                  shows the split before any financing.
                </p>
              </div>
              <span className="readout rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600 dark:bg-white/[0.05] dark:text-slate-300">
                {numFmt(Math.round(last.shares))} FD shares final
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="data-table min-w-[680px]">
                <thead>
                  <tr>
                    <th scope="col">Shareholder</th>
                    {stageCols.map((s) => (
                      <th key={s.label} scope="col" className="text-right">
                        {s.label}
                      </th>
                    ))}
                    <th scope="col" className="text-right">Final shares</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-white/[0.06]">
                  {last.stakes.map((stake) => (
                    <tr key={stake.key}>
                      <th
                        scope="row"
                        className="readout whitespace-nowrap font-semibold normal-case tracking-normal text-slate-900 dark:text-slate-100"
                      >
                        <span className="flex items-center gap-2">
                          <span
                            aria-hidden="true"
                            className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                            style={{ background: colorOf(stake) }}
                          />
                          {stake.name}
                        </span>
                      </th>
                      {stageCols.map((s) => {
                        const at = s.stakes.find((x) => x.key === stake.key);
                        return (
                          <td key={s.label} className="text-right">
                            {at ? (
                              <span className="readout font-medium text-slate-700 dark:text-slate-200">
                                {pct(stakePct(at.shares, s.shares), 1)}
                              </span>
                            ) : (
                              <span className="text-slate-500 dark:text-slate-400">—</span>
                            )}
                          </td>
                        );
                      })}
                      <td className="text-right">
                        <span className="readout font-medium text-slate-700 dark:text-slate-200">
                          {numFmt(Math.round(stake.shares))}
                        </span>
                      </td>
                    </tr>
                  ))}
                  <tr className="border-t-2 border-slate-200 dark:border-white/10">
                    <th
                      scope="row"
                      className="readout whitespace-nowrap font-semibold normal-case tracking-normal text-slate-500 dark:text-slate-400"
                    >
                      Fully diluted total
                    </th>
                    {stageCols.map((s) => (
                      <td key={s.label} className="readout text-right text-xs text-slate-500 dark:text-slate-400">
                        {numFmt(Math.round(s.shares))}
                      </td>
                    ))}
                    <td className="readout text-right text-xs text-slate-500 dark:text-slate-400">
                      100.0%
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ================= Dilution waterfall ================= */}
      {sim.valid && last && (
        <div className="lg:col-span-5">
          <div className="card p-5 sm:p-6">
            <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
              <div>
                <h3 className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-slate-100">
                  <Layers className="h-4 w-4 text-slate-400 dark:text-slate-500" aria-hidden="true" />
                  Dilution waterfall
                </h3>
                <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                  The same cap table, stage by stage — each band is one shareholder&apos;s slice of 100%.
                </p>
              </div>
              <span className="readout rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600 dark:bg-white/[0.05] dark:text-slate-300">
                founders: {pct(foundersPct(sim.stages[0]), 1)} → {pct(allFoundersPct, 1)}
              </span>
            </div>

            <ul className="mb-4 flex flex-wrap gap-x-4 gap-y-1.5">
              {last.stakes.map((s) => (
                <li
                  key={s.key}
                  className="flex items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-slate-300"
                >
                  <span
                    aria-hidden="true"
                    className="inline-block h-2 w-3.5 rounded-full"
                    style={{ background: colorOf(s) }}
                  />
                  {s.name}
                </li>
              ))}
            </ul>

            <div className="space-y-2">
              {sim.stages.map((stage) => (
                <div key={stage.label} className="flex items-center gap-3">
                  <span className="w-20 shrink-0 text-right font-mono text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    {stage.label}
                  </span>
                  <div
                    className="flex h-8 min-w-0 flex-1 overflow-hidden rounded-lg ring-1 ring-inset ring-slate-200 dark:ring-white/10"
                    aria-hidden="true"
                  >
                    {stage.stakes.map((s) => {
                      const share = stakePct(s.shares, stage.shares);
                      if (share <= 0.02) return null;
                      return (
                        <div
                          key={s.key}
                          title={`${s.name} — ${pct(share, 1)}`}
                          className="flex min-w-[2px] items-center justify-center"
                          style={{ width: `${share}%`, background: colorOf(s) }}
                        >
                          {share >= 8 && (
                            <span className="px-1 font-mono text-[10px] font-bold text-white">
                              {Math.round(share)}%
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
            <p className="sr-only" role="img">
              {sim.stages
                .map(
                  (s) =>
                    `${s.label}: founders ${pct(foundersPct(s), 1)}, pool ${pct(
                      stakePct(
                        s.stakes.find((x) => x.kind === 'pool')?.shares ?? 0,
                        s.shares,
                      ),
                      1,
                    )}`,
                )
                .join('. ')}
            </p>
          </div>
        </div>
      )}

      {/* ================= Trajectory + pool sensitivity ================= */}
      {sim.valid && last && stageCols.length > 1 && (
        <>
          <div className="lg:col-span-3">
            <div className="card p-5 sm:p-6">
              <div className="mb-2">
                <h3 className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-slate-100">
                  <TrendingDown className="h-4 w-4 text-slate-400 dark:text-slate-500" aria-hidden="true" />
                  Founder ownership trajectory
                </h3>
                <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                  {youName} versus all founders combined, round by round.
                </p>
              </div>
              <StageLineChart stages={sim.stages} youName={youName} />
              <p className="mt-3 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                {majorityLostAt
                  ? `Founders drop to a minority (≤50%) at ${majorityLostAt} — after that, protective provisions and board control matter more than percentage points.`
                  : 'Founders keep outright majority (over 50%) across every modeled round.'}
              </p>
            </div>
          </div>

          <div className="lg:col-span-2">
            <div className="card h-full p-5 sm:p-6">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Sensitivity: pool targets ±points
              </h3>
              <p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                Re-runs the whole path with every round&apos;s pool target shifted by the same points.
              </p>
              <table className="data-table mt-3 min-w-full">
                <thead>
                  <tr>
                    <th scope="col">Pool shift</th>
                    <th scope="col" className="text-right">{youName}</th>
                    <th scope="col" className="text-right">Founders</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-white/[0.06]">
                  {sensitivity.map((row) => {
                    const isCurrent = row.shiftPct === 0;
                    return (
                      <tr key={row.shiftPct} className={isCurrent ? 'bg-indigo-50/60 dark:bg-indigo-500/10' : ''}>
                        <th
                          scope="row"
                          className="readout whitespace-nowrap font-semibold normal-case tracking-normal text-slate-900 dark:text-slate-100"
                        >
                          {row.shiftPct > 0 ? `+${row.shiftPct}` : row.shiftPct} pts
                          {isCurrent && (
                            <span className="ml-1.5 text-[10px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-300">
                              yours
                            </span>
                          )}
                        </th>
                        <td className="text-right">
                          {row.infeasible || !Number.isFinite(row.youPct) ? (
                            <span
                              title="Infeasible: at this pool target the round's investor stake + pool would claim 100% of the post-round cap table, so the round cannot close."
                              className="cursor-help text-slate-500 dark:text-slate-400"
                            >
                              —
                            </span>
                          ) : (
                            <span
                              className={`readout inline-block whitespace-nowrap rounded-full px-2 py-0.5 font-semibold ${
                                row.shiftPct < 0
                                  ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400'
                                  : row.shiftPct > 0
                                    ? 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400'
                                    : 'bg-slate-100 text-slate-700 dark:bg-white/[0.06] dark:text-slate-200'
                              }`}
                            >
                              {pct(row.youPct, 1)}
                            </span>
                          )}
                        </td>
                        <td className="readout text-right font-medium text-slate-700 dark:text-slate-200">
                          {row.infeasible || !Number.isFinite(row.foundersPct) ? (
                            <span className="text-slate-500 dark:text-slate-400">—</span>
                          ) : (
                            pct(row.foundersPct, 1)
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {anyInfeasible && (
                <p className="mt-3 flex items-start gap-1.5 text-xs leading-relaxed text-amber-700 dark:text-amber-300">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  Rows marked — cannot close: at that pool target the round&rsquo;s investor stake +
                  pool would claim 100% of the post-round cap table. More pool from there is not a
                  negotiation outcome — it is a different deal.
                </p>
              )}
              {perTwoPoints !== null && (
                <p className="mt-3 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                  Every <strong>+2 points</strong> of pool target across the path costs you about{' '}
                  <strong className="text-slate-700 dark:text-slate-200">
                    {perTwoPoints.toFixed(2)} percentage points
                  </strong>{' '}
                  of ownership — the single most negotiable line in a term sheet.
                </p>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Stage trajectory chart — compact categorical SVG (client-side)      */
/* ------------------------------------------------------------------ */

function StageLineChart({ stages, youName }: { stages: CapTableStage[]; youName: string }) {
  const W = 720;
  const H = 260;
  const M = { top: 18, right: 24, bottom: 32, left: 44 };
  const iw = W - M.left - M.right;
  const ih = H - M.top - M.bottom;
  const n = stages.length;

  const x = (i: number) => M.left + (n > 1 ? (i / (n - 1)) * iw : iw / 2);
  const y = (v: number) => M.top + (1 - clamp(v, 0, 100) / 100) * ih;

  const youPts = stages.map((s, i) => ({ i, v: founderPct(s, 0) }));
  const allPts = stages.map((s, i) => ({ i, v: foundersPct(s) }));
  const path = (pts: { i: number; v: number }[]) =>
    pts.map((p, k) => `${k === 0 ? 'M' : 'L'}${x(p.i).toFixed(1)},${y(p.v).toFixed(1)}`).join(' ');

  const gridTicks = [0, 25, 50, 75, 100];
  const lastYou = youPts[n - 1].v;
  const lastAll = allPts[n - 1].v;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="h-auto w-full"
      role="img"
      aria-label={`Founder ownership by round. ${youName}: ${pct(lastYou, 1)} final; all founders combined: ${pct(
        lastAll,
        1,
      )} final.`}
    >
      {gridTicks.map((t) => (
        <g key={t}>
          <line
            x1={M.left}
            x2={W - M.right}
            y1={y(t)}
            y2={y(t)}
            stroke="currentColor"
            className={
              t === 50
                ? 'text-slate-400 dark:text-white/25'
                : 'text-slate-200 dark:text-white/10'
            }
            strokeWidth={t === 50 ? 1.25 : 1}
          />
          <text
            x={M.left - 8}
            y={y(t) + 3.5}
            textAnchor="end"
            className="fill-slate-500 font-mono dark:fill-slate-400 print:fill-slate-600 dark:print:fill-slate-600"
            fontSize="10"
          >
            {t}%
          </text>
        </g>
      ))}
      {/* majority line label */}
      <text
        x={W - M.right}
        y={y(50) - 4}
        textAnchor="end"
        className="fill-slate-500 font-mono dark:fill-slate-400 print:fill-slate-600 dark:print:fill-slate-600"
        fontSize="9"
      >
        majority 50%
      </text>

      {/* x labels: stage names */}
      {stages.map((s, i) => (
        <text
          key={s.label}
          x={x(i)}
          y={H - M.bottom + 18}
          textAnchor="middle"
          className="fill-slate-500 font-mono dark:fill-slate-400 print:fill-slate-600 dark:print:fill-slate-600"
          fontSize="10"
        >
          {s.label}
        </text>
      ))}

      {/* founders combined — dashed */}
      <path
        d={path(allPts)}
        fill="none"
        stroke="#0ea5e9"
        strokeWidth="2.5"
        strokeDasharray="6 4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* you — solid */}
      <path
        d={path(youPts)}
        fill="none"
        stroke="#6366f1"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {allPts.map((p) => (
        <circle key={`a${p.i}`} cx={x(p.i)} cy={y(p.v)} r="3" fill="#0ea5e9" />
      ))}
      {youPts.map((p) => (
        <circle key={`y${p.i}`} cx={x(p.i)} cy={y(p.v)} r="3.5" fill="#6366f1" />
      ))}

      {/* value labels above the "you" dots */}
      {youPts.map((p) => (
        <text
          key={`yt${p.i}`}
          x={x(p.i)}
          y={y(p.v) - 9}
          textAnchor="middle"
          className="fill-indigo-500 font-mono dark:fill-indigo-300"
          fontSize="9.5"
        >
          {pct(p.v, 1)}
        </text>
      ))}
      {/* final value of the founders line */}
      <text
        x={x(n - 1)}
        y={y(lastAll) + 16}
        textAnchor="end"
        className="fill-sky-600 font-mono dark:fill-sky-400"
        fontSize="9.5"
      >
        {pct(lastAll, 1)}
      </text>
    </svg>
  );
}

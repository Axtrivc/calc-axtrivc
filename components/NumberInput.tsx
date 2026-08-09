'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Copy } from 'lucide-react';
import { useToast } from '@/components/Toast';

type NumberInputProps = {
  id: string;
  label: string;
  value: number;
  onChange: (n: number) => void;
  min?: number;
  max?: number;
  step?: number;
  prefix?: string;
  suffix?: string;
  helpText?: string;
  placeholder?: string;
};

/**
 * Controlled numeric input that accepts user-friendly typing (commas, decimals).
 * Emits a parsed number up via onChange.
 */
export default function NumberInput({
  id,
  label,
  value,
  onChange,
  min,
  max,
  step,
  prefix,
  suffix,
  helpText,
  placeholder,
}: NumberInputProps) {
  // Keep a raw string so the user can type values like "" or "1." without fighting the formatter.
  const [raw, setRaw] = useState<string>(() => (value ? String(value) : ''));
  // Track focus so external value changes (slider drags, presets, Reset) never
  // clobber what the user is mid-way through typing.
  const focusedRef = useRef(false);

  // Two-way sync: when the parent value changes from OUTSIDE this input
  // (e.g. the paired slider, a preset pill, or a Reset button), refresh the
  // displayed text — but only while the user is not actively typing.
  useEffect(() => {
    if (focusedRef.current) return;
    const cleaned = raw.replace(/[, $%]/g, '');
    const parsed = parseFloat(cleaned);
    const current = Number.isFinite(parsed) ? parsed : 0;
    if (current !== value) {
      // toPrecision(12) strips float artifacts like 10000000.000000006 that
      // the log slider's exp() math can produce.
      const clean = Number(value.toPrecision(12));
      setRaw(clean ? String(clean) : '');
    }
    // `raw` is intentionally not a dependency — this effect reacts to external
    // value changes only; including raw would loop while typing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  function handle(e: React.ChangeEvent<HTMLInputElement>) {
    const next = e.target.value;
    // Allow the raw field to hold anything, but only propagate finite numeric values.
    setRaw(next);
    const cleaned = next.replace(/[, $%]/g, '');
    const parsed = parseFloat(cleaned);
    if (Number.isFinite(parsed)) {
      onChange(parsed);
    } else if (next === '' || next === '-' || next === '.') {
      onChange(0);
    }
  }

  return (
    <div>
      <label htmlFor={id} className="label">
        {label}
      </label>
      <div className="relative">
        {prefix && (
          <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
            {prefix}
          </span>
        )}
        <input
          id={id}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          min={min}
          max={max}
          step={step}
          value={raw}
          onChange={handle}
          onFocus={() => {
            focusedRef.current = true;
          }}
          onBlur={() => {
            focusedRef.current = false;
            // Normalize the displayed text on blur (e.g. "1." -> "1").
            const clean = Number(value.toPrecision(12));
            setRaw(clean ? String(clean) : '');
          }}
          placeholder={placeholder}
          className={`input-field ${prefix ? 'pl-7' : ''} ${suffix ? 'pr-12' : ''}`}
        />
        {suffix && (
          <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3.5 font-mono text-xs text-slate-400">
            {suffix}
          </span>
        )}
      </div>
      {helpText && <p className="mt-1.5 text-xs text-slate-500">{helpText}</p>}
    </div>
  );
}

/**
 * Animated numeric readout: smoothly interpolates from the previous value to
 * the next whenever `value` changes (rolling-number effect). Uses requestAnimationFrame
 * with an ease-out curve. Short duration keeps it springy without lagging drags.
 */
export function AnimatedNumber({
  value,
  format,
  duration = 400,
  className,
}: {
  value: number;
  format: (n: number) => string;
  duration?: number;
  className?: string;
}) {
  const [display, setDisplay] = useState(value);
  const fromRef = useRef(value);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const from = fromRef.current;
    const to = value;
    if (from === to) return;
    const start = performance.now();

    const tick = (now: number) => {
      const elapsed = now - start;
      const t = Math.min(1, elapsed / duration);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - t, 3);
      const current = from + (to - from) * eased;
      setDisplay(current);
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        fromRef.current = to;
        setDisplay(to);
      }
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      fromRef.current = value; // if interrupted, resume from the latest target
    };
  }, [value, duration]);

  return <span className={className}>{format(display)}</span>;
}

/**
 * Slider + quick preset pill buttons. Designed for FLUID, jank-free dragging:
 *
 *  - Linear sliders (logarithmic=false) use the NATIVE min/max/step on the
 *    <input type="range">. The browser handles thumb positioning directly, so
 *    the handle always tracks the cursor with zero remap round-trips.
 *  - Logarithmic sliders remap a 0..1000 position to value space (for huge
 *    ranges like $100→$10M) but NEVER round the value — the exact float is
 *    passed straight up, so dragging stays smooth and continuous.
 *
 * The fill track is driven by a CSS var updated each render; the slider itself
 * is uncontrolled-friendly (native handles pointer capture during drags).
 */
export function SliderControl({
  id,
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  prefix,
  suffix,
  presets,
  helpText,
  logarithmic = false,
  formatValue,
}: {
  id: string;
  label: string;
  value: number;
  onChange: (n: number) => void;
  min: number;
  max: number;
  step?: number;
  prefix?: string;
  suffix?: string;
  presets?: number[];
  helpText?: string;
  logarithmic?: boolean;
  formatValue?: (n: number) => string;
}) {
  const fmt = (n: number) =>
    formatValue
      ? formatValue(n)
      : `${prefix ?? ''}${n.toLocaleString('en-US', { maximumFractionDigits: 2 })}${suffix ?? ''}`;

  // Logarithmic sliders need a strictly positive lower bound — Math.log(0) is
  // -Infinity and would turn every position into NaN. When a caller passes
  // min=0 ("cash can be zero"), we substitute a small positive floor for the
  // SCALE only. The numeric input still accepts 0; values below the floor
  // simply sit at the slider's leftmost stop.
  const logFloor = logarithmic && min <= 0 ? Math.max(1, max / 1_000_000) : min;

  const pct = (() => {
    const clamped = Math.min(max, Math.max(min, value));
    if (logarithmic && max > logFloor) {
      const lmin = Math.log(logFloor);
      const lmax = Math.log(max);
      const v = Math.max(logFloor, clamped);
      return Math.max(0, Math.min(100, ((Math.log(v) - lmin) / (lmax - lmin)) * 100));
    }
    return Math.max(0, Math.min(100, ((clamped - min) / (max - min)) * 100));
  })();

  return (
    <div>
      {label && (
        <div className="mb-2 flex items-baseline justify-between">
          <label htmlFor={id} className="label mb-0">
            {label}
          </label>
          <span className="readout text-sm font-semibold text-indigo-600">{fmt(value)}</span>
        </div>
      )}

      {logarithmic ? (
        <LogSlider id={id} value={value} onChange={onChange} min={logFloor} max={max} />
      ) : (
        // NATIVE range — min/max/step drive the handle directly. No position remap
        // means zero thumb-fighting during continuous drags.
        <input
          id={id}
          type="range"
          min={min}
          max={max}
          step={step}
          value={Math.min(max, Math.max(min, value))}
          onChange={(e) => onChange(Number(e.target.value))}
          className="ws-slider"
          style={{ ['--fill' as string]: `${pct}%` }}
          aria-label={label || undefined}
        />
      )}

      <div className="mt-1 flex justify-between font-mono text-[10px] text-slate-400">
        <span>{fmt(min)}</span>
        <span>{fmt(max)}</span>
      </div>

      {presets && presets.length > 0 && (
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {presets.map((p) => {
            const active = Math.abs(p - value) < (logarithmic ? p * 0.001 : step);
            const plabel = `${prefix ?? ''}${p.toLocaleString('en-US', { notation: p >= 1000000 ? 'compact' : 'standard', maximumFractionDigits: 1 })}${suffix ?? ''}`;
            return (
              <button
                key={p}
                type="button"
                onClick={() => onChange(p)}
                className={`rounded-full px-2.5 py-1 text-xs font-medium transition-all duration-150 ${
                  active
                    ? 'border border-indigo-500 bg-indigo-50 text-indigo-700'
                    : 'border border-slate-200 bg-white text-slate-500 hover:border-indigo-300 hover:text-indigo-600'
                }`}
                aria-pressed={active}
              >
                {plabel}
              </button>
            );
          })}
        </div>
      )}

      {helpText && <p className="mt-2 text-xs text-slate-500">{helpText}</p>}
    </div>
  );
}

/**
 * Logarithmic slider: position (0..1000) ↔ value via log scale. Crucially the
 * value is NOT rounded on change, so dragging is continuous and smooth.
 */
function LogSlider({
  id,
  value,
  onChange,
  min,
  max,
}: {
  id: string;
  value: number;
  onChange: (n: number) => void;
  min: number;
  max: number;
}) {
  const POS_MAX = 1000;
  // Defensive: a log scale is undefined at 0 — clamp to a positive floor.
  const safeMin = min > 0 ? min : 1;
  const lmin = Math.log(safeMin);
  const lmax = Math.log(Math.max(max, safeMin + 1));

  const toPos = (v: number) => {
    const c = Math.min(max, Math.max(safeMin, v));
    return Math.round(((Math.log(c) - lmin) / (lmax - lmin)) * POS_MAX);
  };
  const fromPos = (p: number) => Math.exp(lmin + (p / POS_MAX) * (lmax - lmin));

  const pos = toPos(value);
  return (
    <input
      id={id}
      type="range"
      min={0}
      max={POS_MAX}
      step={1}
      value={pos}
      onChange={(e) => {
        // Pass the EXACT float up — never round, or the thumb fights the cursor.
        onChange(fromPos(Number(e.target.value)));
      }}
      className="ws-slider"
      style={{ ['--fill' as string]: `${(pos / POS_MAX) * 100}%` }}
    />
  );
}

/** Copy-to-clipboard button with toast confirmation. */
export function CopyButton({
  text,
  label = 'Copy result',
  className = '',
}: {
  text: string;
  label?: string;
  className?: string;
}) {
  const { show } = useToast();
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      setCopied(true);
      show('Copied to clipboard');
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      show('Copy failed', 'info');
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={`btn-ghost ${className}`}
      aria-label={label}
    >
      <Copy className="h-4 w-4 text-indigo-500" aria-hidden="true" />
      {label}
    </button>
  );
}

/** A labeled result tile used in output summary grids. */
export function StatCard({
  label,
  value,
  sublabel,
  emphasis = false,
  animate = true,
}: {
  label: string;
  value: ReactNode;
  sublabel?: string;
  emphasis?: boolean;
  animate?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border p-4 transition ${
        emphasis
          ? 'border-indigo-200 bg-indigo-50/60'
          : 'border-slate-200 bg-slate-50/60'
      }`}
    >
      <div
        className={`text-xs font-medium uppercase tracking-wide ${
          emphasis ? 'text-indigo-600' : 'text-slate-500'
        }`}
      >
        {label}
      </div>
      <div
        className={`mt-1 readout text-2xl font-bold ${
          emphasis ? 'text-indigo-700' : 'text-slate-900'
        }`}
      >
        {value}
      </div>
      {sublabel && <div className="mt-0.5 text-xs text-slate-500">{sublabel}</div>}
    </div>
  );
}

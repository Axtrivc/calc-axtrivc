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
          <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-cyan-400/80">
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
          placeholder={placeholder}
          className={`input-field ${prefix ? 'pl-7' : ''} ${suffix ? 'pr-12' : ''}`}
        />
        {suffix && (
          <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3.5 font-mono text-xs text-slate-500">
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
 * with an ease-out curve.
 */
export function AnimatedNumber({
  value,
  format,
  duration = 650,
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
 * Slider + quick preset badges control. Replaces plain numeric inputs with a
 * HUD-style range slider and one-tap preset buttons.
 *
 * `logarithmic` makes the slider feel natural across huge ranges (e.g. $100 → $1M).
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
  // Convert real value <-> slider position (0..1000 for fine control)
  const SLIDER_MAX = 1000;
  const toSlider = (v: number) => {
    const clamped = Math.min(max, Math.max(min, v));
    if (logarithmic && min > 0 && max > min) {
      const lmin = Math.log(min);
      const lmax = Math.log(max);
      return Math.round(((Math.log(clamped) - lmin) / (lmax - lmin)) * SLIDER_MAX);
    }
    return Math.round(((clamped - min) / (max - min)) * SLIDER_MAX);
  };
  const fromSlider = (p: number) => {
    if (logarithmic && min > 0 && max > min) {
      const lmin = Math.log(min);
      const lmax = Math.log(max);
      return Math.exp(lmin + (p / SLIDER_MAX) * (lmax - lmin));
    }
    return min + (p / SLIDER_MAX) * (max - min);
  };

  const pos = toSlider(value);
  const displayed = formatValue
    ? formatValue(value)
    : `${prefix ?? ''}${value.toLocaleString('en-US', { maximumFractionDigits: 2 })}${suffix ?? ''}`;

  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between">
        <label htmlFor={id} className="label mb-0">
          {label}
        </label>
        <span className="readout text-sm font-semibold text-cyan-300">{displayed}</span>
      </div>
      <input
        id={id}
        type="range"
        min={0}
        max={SLIDER_MAX}
        step={1}
        value={pos}
        onChange={(e) => {
          const next = fromSlider(Number(e.target.value));
          // snap to step on linear sliders
          const snapped = logarithmic ? next : Math.round(next / step) * step;
          onChange(Math.min(max, Math.max(min, snapped)));
        }}
        className="cyber-slider"
        style={{ ['--fill' as string]: `${(pos / SLIDER_MAX) * 100}%` }}
        aria-label={label}
      />
      <div className="mt-1 flex justify-between font-mono text-[10px] text-slate-600">
        <span>{formatValue ? formatValue(min) : `${prefix ?? ''}${min.toLocaleString()}${suffix ?? ''}`}</span>
        <span>{formatValue ? formatValue(max) : `${prefix ?? ''}${max.toLocaleString()}${suffix ?? ''}`}</span>
      </div>

      {presets && presets.length > 0 && (
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {presets.map((p) => {
            const active = Math.abs(p - value) < (logarithmic ? p * 0.001 : step);
            const label = `${prefix ?? ''}${p.toLocaleString('en-US', {
              notation: p >= 1000000 ? 'compact' : 'standard',
              maximumFractionDigits: 1,
            })}${suffix ?? ''}`;
            return (
              <button
                key={p}
                type="button"
                onClick={() => onChange(p)}
                className={`rounded-md px-2.5 py-1 font-mono text-xs font-medium transition ${
                  active
                    ? 'border border-cyan-500/60 bg-cyan-500/15 text-cyan-300 shadow-glow-cyan'
                    : 'border border-slate-700 bg-base-700/50 text-slate-400 hover:border-cyan-500/40 hover:text-cyan-300'
                }`}
                aria-pressed={active}
              >
                {label}
              </button>
            );
          })}
        </div>
      )}

      {helpText && <p className="mt-2 text-xs text-slate-500">{helpText}</p>}
    </div>
  );
}

/** Copy-to-clipboard button with HUD toast confirmation. */
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
        // fallback for older browsers
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
      <Copy className="h-4 w-4 text-cyan-400" aria-hidden="true" />
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
      className={`rounded-xl border p-4 backdrop-blur transition ${
        emphasis
          ? 'border-cyan-500/40 bg-cyan-500/5 shadow-glow-cyan'
          : 'border-slate-800 bg-base-700/40'
      }`}
    >
      <div
        className={`text-xs font-medium uppercase tracking-wide ${
          emphasis ? 'text-cyan-400' : 'text-slate-500'
        }`}
      >
        {label}
      </div>
      <div
        className={`mt-1 readout text-2xl font-bold ${
          emphasis ? 'text-cyan-300 text-glow-cyan' : 'text-slate-100'
        }`}
      >
        {value}
      </div>
      {sublabel && <div className="mt-0.5 text-xs text-slate-500">{sublabel}</div>}
    </div>
  );
}

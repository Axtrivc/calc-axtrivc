'use client';

import { useState, type ReactNode } from 'react';

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
          placeholder={placeholder}
          className={`input-field ${prefix ? 'pl-7' : ''} ${suffix ? 'pr-10' : ''}`}
        />
        {suffix && (
          <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3.5 text-slate-400">
            {suffix}
          </span>
        )}
      </div>
      {helpText && <p className="mt-1.5 text-xs text-slate-500">{helpText}</p>}
    </div>
  );
}

/** A labeled result tile used in output summary grids. */
export function StatCard({
  label,
  value,
  sublabel,
  emphasis = false,
}: {
  label: string;
  value: ReactNode;
  sublabel?: string;
  emphasis?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border p-4 ${
        emphasis
          ? 'border-emerald-200 bg-emerald-50'
          : 'border-slate-200 bg-slate-50'
      }`}
    >
      <div className={`text-xs font-medium uppercase tracking-wide ${emphasis ? 'text-emerald-700' : 'text-slate-500'}`}>
        {label}
      </div>
      <div className={`mt-1 text-2xl font-bold tabular-nums ${emphasis ? 'text-emerald-900' : 'text-slate-900'}`}>
        {value}
      </div>
      {sublabel && <div className="mt-0.5 text-xs text-slate-500">{sublabel}</div>}
    </div>
  );
}

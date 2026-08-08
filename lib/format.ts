// Small, dependency-free formatting + numeric helpers shared across calculators.

export function clamp(n: number, min: number, max: number): number {
  if (Number.isNaN(n)) return min;
  return Math.min(Math.max(n, min), max);
}

/** Parse a user input string to a number, returning 0 for empty/invalid input. */
export function num(value: string | number): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (value == null) return 0;
  const cleaned = String(value).replace(/[, $%]/g, '');
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : 0;
}

/** Format a value as USD currency, e.g. $1,234.56 */
export function usd(value: number, fractionDigits = 2): string {
  if (!Number.isFinite(value)) value = 0;
  return value.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  });
}

/** Compact USD for large chart/summary numbers, e.g. $12.3k or $1.2M */
export function usdCompact(value: number): string {
  if (!Number.isFinite(value)) value = 0;
  return value.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    notation: 'compact',
    maximumFractionDigits: 1,
  });
}

/** Format a number as a percentage with a fixed number of decimals, e.g. 12.4% */
export function pct(value: number, fractionDigits = 1): string {
  if (!Number.isFinite(value)) value = 0;
  return `${value.toFixed(fractionDigits)}%`;
}

/** Format a plain number with thousands separators, e.g. 1,234.5 */
export function numFmt(value: number, fractionDigits = 0): string {
  if (!Number.isFinite(value)) value = 0;
  return value.toLocaleString('en-US', {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  });
}

/** Round to 2 decimal places, avoiding float artifacts like 0.1 + 0.2. */
export function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

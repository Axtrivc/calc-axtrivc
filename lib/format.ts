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

const COMPACT_SUFFIXES = ['', 'K', 'M', 'B', 'T'] as const;

/**
 * Round a non-negative number to at most 1 decimal place — half-up on the
 * decimal representation, matching ICU — and return it as a plain string
 * with any trailing ".0" stripped (e.g. "500", "1.2", "999.9", "0.1").
 */
function roundHalfUp1(x: number): string {
  if (x < 0.05) return '0';
  const s = String(x);
  const dot = s.indexOf('.');
  if (dot === -1) return s; // integer
  const intPart = s.slice(0, dot);
  const dec = s.slice(dot + 1);
  if (dec.length === 1) return s;
  const roundUp = Number(`0.${dec.slice(1)}`) >= 0.5;
  if (!roundUp) return dec[0] === '0' ? intPart : `${intPart}.${dec[0]}`;
  // Increment the digit string intPart + dec[0] by one, carrying over 9s.
  const digits = (intPart + dec[0]).split('');
  let i = digits.length - 1;
  while (i >= 0 && digits[i] === '9') {
    digits[i] = '0';
    i--;
  }
  if (i < 0) digits.unshift('1');
  else digits[i] = String(Number(digits[i]) + 1);
  const newInt = digits.slice(0, -1).join('');
  const newDec = digits[digits.length - 1];
  return newDec === '0' ? newInt : `${newInt}.${newDec}`;
}

/**
 * Compact USD for large chart/summary numbers, e.g. $500K or $1.2M.
 * Pure arithmetic + string formatting — deliberately free of Intl/ICU so
 * SSR output is byte-identical across build machines and browsers.
 */
export function usdCompact(value: number): string {
  if (!Number.isFinite(value)) value = 0;
  const sign = value < 0 || Object.is(value, -0) ? '-' : '';
  const abs = Math.abs(value);
  // Tier by raw magnitude; T absorbs everything >= 1e12 (ICU's en-US short
  // compact patterns stop at T, so e.g. 1e15 renders as $1000T).
  let tier = 0;
  while (tier < COMPACT_SUFFIXES.length - 1 && abs >= 1000 ** (tier + 1)) tier++;
  let rounded = roundHalfUp1(abs / 1000 ** tier);
  // Rounding can spill into the next tier: 999.95K -> 1000K -> $1M.
  if (tier < COMPACT_SUFFIXES.length - 1 && Number(rounded) >= 1000) {
    tier++;
    rounded = '1';
  }
  // Thousands separators — only reachable at the T tier, and CLDR only groups
  // mantissas of 5+ digits: $1000T (4 digits) but $10,000T (5 digits).
  const dot = rounded.indexOf('.');
  const intPart = dot === -1 ? rounded : rounded.slice(0, dot);
  const grouped =
    intPart.length > 4 ? intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',') : intPart;
  return `${sign}$${grouped}${dot === -1 ? '' : rounded.slice(dot)}${COMPACT_SUFFIXES[tier]}`;
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

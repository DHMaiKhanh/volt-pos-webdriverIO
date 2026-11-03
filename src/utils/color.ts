/**
 * Colour helpers for specs that compare a rendered colour against a hex value.
 *
 * `getComputedStyle` reports `rgb(r, g, b)` / `rgba(r, g, b, a)`, the app's
 * constants are `#RRGGBB` in mixed case — {@link toHex} normalises either side
 * to upper-case `#RRGGBB` so the two compare as strings.
 */

/** `rgb(227, 170, 138)` / `rgba(…)` / `#e3aa8a` / `#E3AA8A` → `#E3AA8A`; `''` when unparseable. */
export function toHex(value: string | null | undefined): string {
  const text = (value ?? '').trim();
  const hex = /^#([0-9a-f]{6})$/i.exec(text);
  if (hex?.[1]) return `#${hex[1].toUpperCase()}`;
  const rgb = /^rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/i.exec(text);
  if (!rgb) return '';
  return `#${[rgb[1], rgb[2], rgb[3]]
    .map((part) => Number(part).toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase()}`;
}

/** WCAG relative luminance of a `#RRGGBB`. */
export function luminance(hex: string): number {
  const h = toHex(hex);
  if (h === '') return Number.NaN;
  const channel = (i: number): number => {
    const c = parseInt(h.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
}

/** WCAG contrast ratio between two colours (1 … 21). */
export function contrastRatio(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** Pure white — the text colour VP-4039 replaced. */
export const WHITE_HEX = '#FFFFFF';

/**
 * Admin can mark a banner as non-navigable (display-only on home).
 *
 * Compatibility rules:
 * - If `isNavigable` is explicitly set:
 *   - true → tappable
 *   - false / null → not tappable
 *   - string/number forms → coerced (e.g. "true", 1)
 * - If the field is absent (legacy/default), treat as tappable.
 */
export function bannerIsTapEnabled(item: unknown): boolean {
  if (!item || typeof item !== 'object') return false;
  const obj = item as Record<string, unknown>;
  if (!Object.prototype.hasOwnProperty.call(obj, 'isNavigable')) {
    return true;
  }
  const v = obj.isNavigable;
  if (v === true) return true;
  if (v === false || v == null) return false;
  if (typeof v === 'number') return v === 1;
  if (typeof v === 'string') {
    const s = v.trim().toLowerCase();
    if (s === 'true' || s === '1' || s === 'yes') return true;
    if (s === 'false' || s === '0' || s === 'no' || s === 'null' || s === 'undefined') return false;
    return false;
  }
  return Boolean(v);
}

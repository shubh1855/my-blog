/**
 * Pure helpers for the in-page list filter (archives, categories, tags).
 * The DOM wiring lives in `src/components/common/ListFilter.astro`.
 */

/** Latin combining diacritics (U+0300–U+036F); kept narrow so CJK/kana marks survive. */
const LATIN_DIACRITICS = /[\u0300-\u036f]/g;

/** Lower-case, strip diacritics and collapse whitespace so matching is forgiving. */
export function normalizeFilterText(value: string): string {
  return value.normalize('NFKD').replace(LATIN_DIACRITICS, '').toLowerCase().replace(/\s+/g, ' ').trim();
}

/** Split a raw query into normalized, de-duplicated tokens. */
export function tokenizeFilterQuery(query: string): string[] {
  const normalized = normalizeFilterText(query);
  return normalized ? [...new Set(normalized.split(' '))] : [];
}

/**
 * True when every token appears somewhere in the haystack (AND semantics, any order).
 * An empty token list matches everything.
 */
export function matchesFilterTokens(haystack: string, tokens: readonly string[]): boolean {
  if (tokens.length === 0) return true;
  const text = normalizeFilterText(haystack);
  return tokens.every((token) => text.includes(token));
}

/** Join the searchable fields of a list entry into one `data-filter-text` value. */
export function buildFilterText(...parts: (string | readonly string[] | null | undefined)[]): string {
  return normalizeFilterText(parts.flat().filter(Boolean).join(' '));
}

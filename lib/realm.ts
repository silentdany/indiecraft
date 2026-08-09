/**
 * Realms.
 *
 * A country code is where a business is registered; a realm is where a
 * character lives. They are the same fact, and the second one is the one people
 * feel — an armory has always been a thing you browse by realm, and "the 14
 * founders on FR" is a smaller, more interesting ladder than the global top
 * hundred a French founder will never appear on.
 *
 * The names come from `Intl.DisplayNames`, which ships with the runtime and
 * knows all 249 codes. A hand-written map would cover the 28 that exist in the
 * corpus today and quietly print a bare code for the twenty-ninth.
 *
 * No flag emoji anywhere. They render as two letters on half of Linux, they are
 * a political statement in at least three of the countries in this dataset, and
 * Satori cannot draw them at all — so the OG image and the page would disagree.
 * The code in a bordered square is the armory's own idiom and works everywhere.
 */

const NAMES = new Intl.DisplayNames(['en'], { type: 'region', fallback: 'none' })

/** A realm is a valid ISO 3166-1 alpha-2 code, uppercased. Anything else is not a realm. */
export function isRealm(value: string | null | undefined): value is string {
  return typeof value === 'string' && /^[A-Za-z]{2}$/.test(value) && realmName(value) !== null
}

/** "FR" → "France". Null when the code is not one the runtime recognises. */
export function realmName(code: string): string | null {
  try {
    return NAMES.of(code.toUpperCase()) ?? null
  } catch {
    return null
  }
}

/** "FR" → "France", falling back to the code itself so a label is never empty. */
export function realmLabel(code: string): string {
  return realmName(code) ?? code.toUpperCase()
}

export function normalizeRealm(value: string | null | undefined): string | null {
  if (!isRealm(value)) return null
  return value.toUpperCase()
}

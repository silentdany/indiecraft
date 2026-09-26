/**
 * An X handle, taken out of whatever a person actually pastes.
 *
 * The box accepts `@name`, a bare name, or a profile URL. Anything that is
 * not a handle afterwards is empty, so it cannot become a path segment or a
 * query against the armory.
 */
export function parseHandle(raw: string): string {
  const clean = raw
    .trim()
    .replace(/^https?:\/\/(www\.)?(x|twitter)\.com\//i, '')
    .replace(/^@/, '')
    .split(/[/?#]/)[0]
    ?.toLowerCase()
  if (!clean || !/^[a-z0-9_]{1,15}$/.test(clean)) return ''
  return clean
}

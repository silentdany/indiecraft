import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

/**
 * Cinzel, from the repo, as an ArrayBuffer.
 *
 * Never fetched from Google Fonts at runtime: slow, fragile, and it breaks at
 * the edge. Loaded once per process and shared by every OG route, so the four
 * of them do not each hold their own copy.
 */
export const ogFonts = (async () => {
  const dir = join(process.cwd(), 'public', 'fonts')
  const [regular, medium] = await Promise.all([
    readFile(join(dir, 'Cinzel-Regular.ttf')),
    readFile(join(dir, 'Cinzel-Medium.ttf')),
  ])
  return [
    { name: 'Cinzel', data: regular, weight: 400 as const, style: 'normal' as const },
    { name: 'Cinzel', data: medium, weight: 500 as const, style: 'normal' as const },
  ]
})()

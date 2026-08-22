/**
 * Render the run-up, both cuts of each film, named by the day it posts.
 *
 *   pnpm films              # all four
 *   pnpm films Film-4       # only the ones whose id contains this
 *
 * Named by date because the calendar is the thing anybody actually holds in
 * their head — "which file is Tuesday's" is a question somebody will ask at
 * 8am, and `indiecraft-08-25-nostalgia-9x16.mp4` answers it without opening
 * anything.
 */
import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { FILMS } from '../src/films'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(here, '..')

const filter = process.argv[2]
const chosen = filter ? FILMS.filter((film) => film.id.includes(filter)) : FILMS

if (chosen.length === 0) {
  console.error(`No film id contains "${filter}". Known: ${FILMS.map((f) => f.id).join(', ')}`)
  process.exit(1)
}

/** `Film-1-Nostalgia` → `nostalgia`. The date carries the ordering already. */
const slug = (id: string) => id.split('-').slice(2).join('-').toLowerCase()

for (const film of chosen) {
  for (const [suffix, shape] of [
    ['Vertical', '9x16'],
    ['Landscape', '16x9'],
  ] as const) {
    const out = path.join('out', `indiecraft-${film.posts}-${slug(film.id)}-${shape}.mp4`)
    console.log(`\n→ ${film.id} ${suffix}  (${film.about})`)
    execFileSync('npx', ['remotion', 'render', `${film.id}-${suffix}`, out, '--concurrency=2'], {
      cwd: root,
      stdio: 'inherit',
    })
  }
}

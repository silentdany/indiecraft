/**
 * Loads real pages in a real browser and fails on anything a user would see.
 *
 *   CHROME_PATH=/path/to/chrome pnpm smoke [baseUrl]
 *
 * Every other gate in this repo reasons about the code. None of them run it:
 * tsc checks types, vitest checks the engine offline, biome checks style, and
 * `next build` only proves the thing compiles. Three defects shipped in one week
 * straight through all four —
 *
 *   - a share panel reading `window.location.origin`, so the server rendered
 *     "/c/handle" and the browser rendered "indiecraft.quest/c/handle". React
 *     threw a hydration error and rebuilt the subtree on every sheet, probably
 *     for weeks.
 *   - a column present in a CTE but missing from the outer select, which became
 *     `undefined`, then NaN, and reached production as "$NaN more lifetime
 *     revenue". NaN loses every comparison, so the threshold meant to gate it
 *     let it through in silence.
 *   - a tuning weight whose edit never applied, because the block had been
 *     reformatted and the replacement matched nothing.
 *
 * Nothing in a type system has an opinion about any of those. What catches them
 * is opening the page: the first shows up as a console error, the second as the
 * literal text "NaN" on screen, the third as a quest that stopped appearing.
 *
 * So this asks three questions per page, and they are the three that were
 * missed rather than a general-purpose crawl:
 *   1. did the browser log an error?
 *   2. does the visible text contain a value that leaked from code?
 *   3. is the thing that page exists for actually on it?
 *
 * Networked and browser-driven, so NOT a vitest file, same reasoning as the icon
 * checks: the suite has to run offline and without a Chrome. Point it at
 * production by passing a URL.
 */

import { spawn } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const BASE = process.argv[2] ?? process.env.SMOKE_URL ?? 'http://localhost:3000'
const CHROME = process.env.CHROME_PATH

/**
 * Values that mean a bug reached the screen.
 *
 * Checked against `innerText` rather than the HTML on purpose: "null" and
 * "undefined" appear legitimately inside the serialised React payload on every
 * page, and scanning the source would make this cry wolf until somebody turned
 * it off. What a user can read is the only thing worth failing on.
 */
const LEAKED = ['NaN', 'undefined', 'null', '[object Object]', 'Invalid Date', 'Infinity']

/** What each page is FOR. A page that renders without its reason is broken. */
const MUST: { path: string; contains: string[] }[] = [
  { path: '/', contains: ['INDIECRAFT', 'THE LADDER'] },
  // Upper-cased because `innerText` applies CSS: the markup says "iLvl" and the
  // `label` class transforms it. Matching what is READ rather than what is
  // written is the point of driving a browser at all.
  { path: '/ladder', contains: ['THE LADDER', 'ILVL'] },
  { path: '/rules', contains: ['THE RULES', 'EQUIPMENT', 'THE QUEST LOG', 'ACHIEVEMENTS'] },
  { path: '/compare', contains: ['COMPARE'] },
]

interface Result {
  url: string
  status: 'ok' | 'fail'
  problems: string[]
}

async function main() {
  if (!CHROME) {
    console.log('CHROME_PATH is not set — nothing to drive. See the docblock.')
    process.exitCode = 1
    return
  }

  const sheets = await discoverSheets()
  const pages = [...MUST, ...sheets.map((handle) => ({ path: `/c/${handle}`, contains: SHEET }))]

  /*
   * Warm every route with a plain fetch first.
   *
   * A dev server compiles a route the first time anybody asks for it, which can
   * take twenty seconds — long enough that the browser pass read empty bodies
   * and reported the whole site missing. Paying that cost over HTTP, where there
   * is no timing to get wrong, means the browser only ever sees a warm page.
   */
  for (const page of pages) await fetch(`${BASE}${page.path}`).catch(() => undefined)

  const profile = mkdtempSync(join(tmpdir(), 'indiecraft-smoke-'))
  const port = 9222 + Math.floor(Math.random() * 500)
  const chrome = spawn(
    CHROME,
    [
      '--headless',
      '--no-sandbox',
      '--disable-gpu',
      '--hide-scrollbars',
      `--remote-debugging-port=${port}`,
      `--user-data-dir=${profile}`,
      'about:blank',
    ],
    { stdio: 'ignore' },
  )

  const results: Result[] = []
  try {
    await waitForChrome(port)
    for (const page of pages) results.push(await check(port, page))
  } finally {
    chrome.kill()
    // Chrome is still writing its profile out as we ask for it back, and a
    // failed tidy-up must never bury the result the run was for.
    await new Promise((r) => setTimeout(r, 300))
    try {
      rmSync(profile, { recursive: true, force: true })
    } catch {
      // /tmp outlives us and the OS sweeps it.
    }
  }

  const failed = results.filter((r) => r.status === 'fail')
  console.log(`${results.length - failed.length}/${results.length} pages clean  (${BASE})`)
  for (const r of failed) {
    console.log(`\n  ${r.url}`)
    for (const p of r.problems) console.log(`    ${p}`)
  }
  if (failed.length > 0) process.exitCode = 1
  else console.log('\n✓ no browser errors, no leaked values, nothing missing')
}

/** Every sheet the doll draws, and the panels a founder came for. */
const SHEET = ['LEVEL', 'ILVL', 'SLOTS FILLED', 'PRODUCT']

/**
 * Sheets are read off the live ladder rather than hard-coded.
 *
 * A fixed list of handles rots: founders opt out, get delisted, or change shape
 * until the page under test is no longer the interesting one. Taking whoever is
 * on the ladder today means this always exercises real current data.
 */
async function discoverSheets(): Promise<string[]> {
  const seen = new Set<string>()
  // Two pages far apart, so the sample covers a dressed sheet and a thin one.
  for (const page of ['1', '30']) {
    const res = await fetch(`${BASE}/ladder?page=${page}`)
    const html = await res.text()
    for (const m of html.matchAll(/href="\/c\/([a-z0-9_]+)"/g)) {
      if (seen.size < (page === '1' ? 2 : 4)) seen.add(m[1]!)
    }
  }
  return [...seen]
}

async function waitForChrome(port: number) {
  for (let i = 0; i < 100; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/json/version`)
      if (res.ok) return
    } catch {
      // not listening yet
    }
    await new Promise((r) => setTimeout(r, 100))
  }
  throw new Error('chrome never opened its debugging port')
}

async function check(port: number, page: { path: string; contains: string[] }): Promise<Result> {
  const url = `${BASE}${page.path}`
  const problems: string[] = []

  const tab = (await (
    await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: 'PUT' })
  ).json()) as { id: string; webSocketDebuggerUrl: string }

  const ws = new WebSocket(tab.webSocketDebuggerUrl)
  const errors: string[] = []
  let id = 0
  const pending = new Map<number, (value: unknown) => void>()

  const send = (method: string, params: unknown = {}) =>
    new Promise<Record<string, unknown>>((resolve) => {
      const n = ++id
      pending.set(n, resolve as (v: unknown) => void)
      ws.send(JSON.stringify({ id: n, method, params }))
    })

  await new Promise((resolve) => ws.addEventListener('open', resolve, { once: true }))
  ws.addEventListener('message', (event) => {
    const msg = JSON.parse(String(event.data)) as {
      id?: number
      method?: string
      result?: Record<string, unknown>
      params?: Record<string, unknown>
    }
    if (msg.id !== undefined) return pending.get(msg.id)?.(msg.result ?? {})
    // An uncaught throw and a console.error are the same news to a reader.
    if (msg.method === 'Runtime.exceptionThrown') {
      const d = (msg.params?.exceptionDetails ?? {}) as {
        text?: string
        exception?: { description?: string }
      }
      errors.push(String(d.exception?.description ?? d.text ?? 'exception').split('\n')[0] ?? '')
    }
    if (msg.method === 'Log.entryAdded') {
      const e = (msg.params?.entry ?? {}) as { level?: string; text?: string }
      if (e.level === 'error' && !isNoise(String(e.text))) {
        errors.push(String(e.text).split('\n')[0] ?? '')
      }
    }
  })

  await send('Runtime.enable')
  await send('Log.enable')
  await send('Page.enable')
  // Wait for the load event rather than a fixed delay, then give hydration its
  // own moment — a mismatch is thrown after the document is done, so stopping at
  // load would miss the class of bug this exists to catch.
  const loaded = new Promise<void>((resolve) => {
    const onMessage = (event: MessageEvent) => {
      const m = JSON.parse(String(event.data)) as { method?: string }
      if (m.method === 'Page.loadEventFired') {
        ws.removeEventListener('message', onMessage)
        resolve()
      }
    }
    ws.addEventListener('message', onMessage)
  })
  await send('Page.navigate', { url })
  await Promise.race([loaded, new Promise((r) => setTimeout(r, 30_000))])
  await new Promise((r) => setTimeout(r, 2000))

  const read = async (expression: string) => {
    const res = (await send('Runtime.evaluate', { expression, returnByValue: true })) as {
      result?: { value?: string }
    }
    return res.result?.value ?? ''
  }
  const text = await read('document.body.innerText')
  ws.close()
  await fetch(`http://127.0.0.1:${port}/json/close/${tab.id}`)

  if (text.trim() === '') problems.push('rendered nothing')
  for (const e of dedupe(errors)) problems.push(`console: ${e.slice(0, 120)}`)
  for (const bad of LEAKED) {
    // Word-bounded: "null" inside "annuller" is not a leak, and neither is a
    // founder whose product is called Infinity.
    if (new RegExp(`\\b${bad.replace(/[[\]]/g, '\\$&')}\\b`).test(text)) {
      problems.push(`leaked value on screen: ${bad}`)
    }
  }
  for (const need of page.contains) {
    if (!text.includes(need)) problems.push(`missing: ${need}`)
  }

  return { url, status: problems.length === 0 ? 'ok' : 'fail', problems }
}

const dedupe = (xs: string[]) => [...new Set(xs)]

/**
 * Errors that are about the harness, not the product.
 *
 * The dev server's hot-reload socket drops whenever it restarts, and a founder
 * never sees it. A gate that cries wolf gets switched off, so the few things
 * that are genuinely not the site's fault are named here rather than tolerated
 * by lowering the bar for everything.
 */
function isNoise(text: string): boolean {
  return text.includes('/_next/hmr') || text.includes('_next/static/chunks/_error')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})

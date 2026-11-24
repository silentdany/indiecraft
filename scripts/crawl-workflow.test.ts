import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * The crawl workflow, read as the thing it is: the only place that knows when
 * a night's collection actually ended.
 *
 * Checked here for the same reason negotiable.routes.test.ts reads the file
 * tree — the subject IS the file, and every way it goes wrong is silent. A
 * night that collects 800 snapshots and never tells the site about them looks
 * exactly like a night that worked, right up until somebody notices their
 * character sheet is a week old.
 *
 * That is not hypothetical. Between 2026-08-20 and 2026-08-27 eight consecutive
 * runs were killed at the job ceiling with the compute trigger sitting on the
 * line after the one that died, and the failure surfaced as a founder saying
 * "my sheet isn't updating".
 */
const workflow = readFileSync(join(import.meta.dirname, '../.github/workflows/crawl.yml'), 'utf8')

/** `timeout-minutes` at job level (4 spaces) and at step level (8). */
const timeoutAt = (indent: number) =>
  Number(workflow.match(new RegExp(`^ {${indent}}timeout-minutes: (\\d+)$`, 'm'))?.[1])

/** One step, from its `- name:`/`- uses:` line to the next one. */
const steps = workflow.split(/^ {6}- /m).slice(1)
const step = (name: string) => steps.find((s) => s.startsWith(`name: ${name}`))

describe('the crawl workflow', () => {
  it('cuts the crawl short before the job that still has to trigger compute', () => {
    const job = timeoutAt(4)
    const crawl = timeoutAt(8)
    expect(job).toBeGreaterThan(0)
    expect(crawl).toBeGreaterThan(0)
    // Enough room left for the trigger to run and be retried, not just enough
    // to start it.
    expect(job - crawl).toBeGreaterThanOrEqual(15)
  })

  it('triggers compute even when the crawl step never reached the end', () => {
    const trigger = step('Trigger compute')
    expect(trigger).toBeDefined()
    expect(trigger).toMatch(/^\s*if: always\(\)$/m)
  })

  it('leaves the triggering to that step, so a good night does not compute twice', () => {
    expect(step('Crawl')).toMatch(/--no-compute/)
  })

  it('gives the trigger step the secrets it needs to authenticate', () => {
    const trigger = step('Trigger compute') ?? ''
    expect(trigger).toMatch(/CRON_SECRET/)
    expect(trigger).toMatch(/SITE_URL/)
  })

  it('calls the canonical domain and treats a redirect as a failure', () => {
    // A 308 from an alias is not an error to curl, so a green run could mean
    // compute never ran. The step names its target and wants a 200.
    const trigger = step('Trigger compute') ?? ''
    expect(trigger).toMatch(/SITE_URL: https:\/\/indiecraft\.quest$/m)
    expect(trigger).not.toMatch(/vars\.SITE_URL/)
    expect(trigger).toMatch(/--write-out '%\{http_code\}'/)
    expect(trigger).toMatch(/!= "200"/)
    expect(trigger).not.toMatch(/(^|\s)(-L|--location)(\s|$)/m)
  })

  it('pins every action by commit, since the job holds the secrets', () => {
    const uses = [...workflow.matchAll(/^\s*- uses: (\S+)/gm)].map((m) => m[1])
    expect(uses.length).toBeGreaterThan(0)
    for (const ref of uses) expect(ref).toMatch(/@[0-9a-f]{40}$/)
  })
})

import { createHmac } from 'node:crypto'

/**
 * Opt-out stays one click, no account, no email, immediate — that is the
 * spec's rule and it is not negotiable. What this file adds is the guardrail
 * the rule needs to survive contact with the internet.
 *
 * The endpoint is deliberately unauthenticated, so "anyone can remove their own
 * sheet" is also "anyone can remove anyone's". That asymmetry is intended: the
 * worst case is a sheet disappearing when its owner wanted it, and they ask for
 * it back. What is NOT intended is one script emptying the whole ladder — and
 * /ladder hands out a hundred handles at a time.
 */

/**
 * Requests allowed per IP per hour.
 *
 * A real person removes one sheet, once. Five leaves room for an office NAT or
 * a shared connection while stopping a hundred-handle loop on request six.
 */
export const OPT_OUT_MAX_PER_HOUR = 5

/**
 * Deliberately per-IP only, never global.
 *
 * A site-wide cap would let an attacker exhaust the budget and thereby block
 * real people from removing their own sheets. Rate limiting must never become
 * a way to trap someone on a page they asked to leave.
 */
export function clientIp(request: Request): string | null {
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0]?.trim() || null
  return request.headers.get('x-real-ip')
}

/**
 * Hash, never store, the address.
 *
 * This table records people exercising a privacy right. Keeping raw IPs would
 * turn the safeguard into the surveillance it exists to prevent. The hash is
 * good for exactly two things: counting requests from one source, and spotting
 * a mass wipe after the fact.
 *
 * Salted with CRON_SECRET so the digest is useless to anyone who only has the
 * database. Rotating that secret breaks grouping across the rotation, which
 * costs nothing we need.
 */
export function hashIp(ip: string | null): string | null {
  if (!ip) return null
  const salt = process.env.CRON_SECRET ?? 'indiecraft-unsalted'
  return createHmac('sha256', salt).update(ip).digest('hex').slice(0, 32)
}

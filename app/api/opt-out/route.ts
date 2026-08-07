import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db'

/**
 * One-click opt-out.
 *
 * No account, no email, applied immediately. That is deliberate: we crawl the
 * numbers of people who never asked for any of this, so leaving must cost less
 * than arriving.
 *
 * Accepted consequence: anyone can remove anyone's sheet. The worst case is a
 * sheet disappearing when its owner wanted it — they ask for it back. The
 * opposite failure, a sheet that cannot be removed, is far worse.
 */
export const runtime = 'nodejs'

export async function POST(request: Request) {
  let handle: string
  try {
    const body = (await request.json()) as { handle?: unknown }
    if (typeof body.handle !== 'string') throw new Error('missing handle')
    handle = body.handle.replace(/^@/, '').toLowerCase()
  } catch {
    return Response.json({ error: 'invalid request' }, { status: 400 })
  }

  const sql = db()
  const result = await sql`
    update founders set opted_out_at = now()
    where handle = ${handle} and opted_out_at is null
  `

  revalidatePath(`/c/${handle}`)
  revalidatePath('/ladder')

  return Response.json({ ok: true, changed: result.count })
}
